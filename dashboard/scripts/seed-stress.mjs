// Seed de reservas de teste pra estressar o /planta e /reservas.
// Uso:
//   node scripts/seed-stress.mjs           → insere
//   node scripts/seed-stress.mjs --clean   → remove todas reservas com cliente_nome começando em "[TESTE]"
//
// Não passa pelo webhook do n8n — escreve direto no Supabase via service_role.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Carrega .env.local manualmente ────────────────────────
const envPath = join(__dirname, "..", ".env.local");
const envText = readFileSync(envPath, "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltando NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TAG = "[TESTE]";

// ── Cleanup mode ───────────────────────────────────────────
if (process.argv.includes("--clean")) {
  console.log("Removendo reservas de teste…");
  const { data: testRes, error: err1 } = await sb
    .from("reservas")
    .select("id")
    .ilike("cliente_nome", `${TAG}%`);
  if (err1) {
    console.error("Erro listando:", err1.message);
    process.exit(1);
  }
  const ids = (testRes ?? []).map((r) => r.id);
  if (ids.length === 0) {
    console.log("Nada pra limpar.");
    process.exit(0);
  }
  const { error: err2 } = await sb
    .from("reservas_mesas")
    .delete()
    .in("reserva_id", ids);
  if (err2) {
    console.error("Erro limpando reservas_mesas:", err2.message);
  }
  const { error: err3 } = await sb.from("reservas").delete().in("id", ids);
  if (err3) {
    console.error("Erro limpando reservas:", err3.message);
    process.exit(1);
  }
  console.log(`Removidas ${ids.length} reservas de teste.`);
  process.exit(0);
}

// ── Carrega áreas e mesas ─────────────────────────────────
const [{ data: areas, error: areasErr }, { data: mesas, error: mesasErr }] =
  await Promise.all([
    sb
      .from("areas")
      .select("codigo, nome, capacidade_max, evento_fechado")
      .eq("ativa", true),
    sb
      .from("mesas")
      .select("id, area_codigo, nome, capacidade")
      .eq("ativa", true)
      .order("nome"),
  ]);
if (areasErr || mesasErr) {
  console.error("Erro carregando schema:", areasErr ?? mesasErr);
  process.exit(1);
}

const mesasPorArea = new Map();
for (const m of mesas) {
  if (!mesasPorArea.has(m.area_codigo)) mesasPorArea.set(m.area_codigo, []);
  mesasPorArea.get(m.area_codigo).push(m);
}

// ── Helpers de RNG ────────────────────────────────────────
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function weightedPick(items) {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of items) {
    if ((r -= w) <= 0) return v;
  }
  return items[items.length - 1][0];
}

const PRIMEIROS = [
  "Mariana", "João", "Pedro", "Camila", "Lucas", "Beatriz", "Felipe", "Carla",
  "Ricardo", "Juliana", "Bruno", "Larissa", "Rafael", "Aline", "Diego",
  "Fernanda", "Gustavo", "Patrícia", "André", "Sabrina", "Marcelo", "Renata",
  "Vinícius", "Tatiana", "Thiago", "Priscila", "Eduardo", "Bianca", "Caio",
  "Letícia", "Henrique", "Vanessa", "Rodrigo", "Mônica", "Igor", "Helena",
];
const SOBRENOMES = [
  "Silva", "Souza", "Oliveira", "Santos", "Lima", "Costa", "Rocha", "Almeida",
  "Pereira", "Carvalho", "Gomes", "Ribeiro", "Martins", "Araújo", "Barbosa",
  "Cardoso", "Dias", "Nogueira", "Mendes", "Castro", "Moreira", "Fernandes",
];
const OBSERVACOES = [
  null, null, null, null,
  "Aniversário",
  "Alergia a frutos do mar",
  "Cadeira de bebê",
  "Comemoração de noivado",
  "Cliente fidelidade",
  "Solicitou mesa perto da janela",
  "Vegetariano",
  null, null,
];

function nomeFake() {
  return `${TAG} ${pick(PRIMEIROS)} ${pick(SOBRENOMES)}`;
}
function telefoneFake() {
  const n = `5592${rand(90000, 99999)}${rand(1000, 9999)}`;
  return `${n}@s.whatsapp.net`;
}
function emailFake(nome) {
  const limpo = nome.replace(TAG, "").trim().toLowerCase().replace(/[^a-z]/g, ".");
  return `${limpo}@teste.com`;
}

// ── Allocator simples: distribui mesas por (área, período) ──
// Pra cada (área, período) começa do início do array de mesas e vai ocupando.
// Permite re-uso entre slots de horário diferentes (ou seja, mesa cheia 19:30
// pode ser reservada de novo 21:30). Pra um stress teste isso já basta.
function makeAllocator() {
  // key = `${areaCodigo}|${periodo}|${slot}` → conjunto de mesa_ids ocupadas
  const ocup = new Map();
  return function allocate(areaCodigo, periodo, slotIdx, qtdPessoas) {
    const key = `${areaCodigo}|${periodo}|${slotIdx}`;
    const usadas = ocup.get(key) ?? new Set();
    const lista = mesasPorArea.get(areaCodigo) ?? [];

    // primeiro tenta uma mesa única que comporte
    const cabe = lista.find(
      (m) => !usadas.has(m.id) && m.capacidade >= qtdPessoas
    );
    if (cabe) {
      usadas.add(cabe.id);
      ocup.set(key, usadas);
      return [cabe.id];
    }

    // se não cabe em uma, combina mesas adjacentes (da mesma ordem)
    const escolhidas = [];
    let cap = 0;
    for (const m of lista) {
      if (usadas.has(m.id)) continue;
      escolhidas.push(m);
      cap += m.capacidade;
      if (cap >= qtdPessoas) break;
    }
    if (cap >= qtdPessoas) {
      for (const m of escolhidas) usadas.add(m.id);
      ocup.set(key, usadas);
      return escolhidas.map((m) => m.id);
    }

    // não cabe nem combinando → não aloca (reserva fica sem mesa)
    return [];
  };
}

// ── Gera reservas pra uma data ────────────────────────────
function gerarReservasDoDia(data, totalReservas) {
  const reservas = [];
  const alloc = makeAllocator();

  // Horários típicos por período
  const horariosAlmoco = ["11:30", "12:00", "12:30", "13:00", "13:30", "14:00"];
  const horariosJantar = ["18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"];

  // 40% almoço, 60% jantar
  for (let i = 0; i < totalReservas; i++) {
    const periodo = Math.random() < 0.4 ? "almoco" : "jantar";
    const horarios = periodo === "almoco" ? horariosAlmoco : horariosJantar;
    const horario = pick(horarios);
    const slotIdx = horarios.indexOf(horario);

    // Distribuição de área (peso por capacidade)
    const areaCodigo = weightedPick([
      ["externa", 5],
      ["interna", 3],
      ["vip_container", 1],
      ["vip1", 1],
      ["tenda1", 1],
      ["tenda2", 1],
    ]);

    // Tamanho do grupo: 2-4 mais comum, ocasional 5-8, raro 9-12
    const qtdPessoas = weightedPick([
      [2, 25], [3, 15], [4, 25],
      [5, 10], [6, 10], [7, 5], [8, 5],
      [9, 2], [10, 2], [12, 1],
    ]);

    const mesa_ids = alloc(areaCodigo, periodo, slotIdx, qtdPessoas);

    const cliente_nome = nomeFake();
    const cliente_telefone = telefoneFake();
    const cliente_email = emailFake(cliente_nome);
    const observacoes = pick(OBSERVACOES);

    reservas.push({
      cliente_nome,
      cliente_telefone,
      cliente_email,
      area_codigo: areaCodigo,
      qtd_pessoas: qtdPessoas,
      data_reserva: data,
      horario: `${horario}:00`,
      periodo,
      status: "confirmada",
      observacoes,
      _mesa_ids: mesa_ids,
    });
  }
  return reservas;
}

// ── Insere no banco ───────────────────────────────────────
async function inserirDia(data, total) {
  console.log(`\n→ Gerando ${total} reservas pra ${data}`);
  const reservas = gerarReservasDoDia(data, total);

  // 1) Insert reservas (descarta _mesa_ids — só usado depois pra alocar mesas)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const payload = reservas.map(({ _mesa_ids, ...r }) => r);
  const { data: inserted, error } = await sb
    .from("reservas")
    .insert(payload)
    .select("id");
  if (error) {
    console.error(`  ✗ Erro:`, error.message);
    return;
  }

  // 2) Insert reservas_mesas
  const joinRows = [];
  inserted.forEach((row, i) => {
    const mesa_ids = reservas[i]._mesa_ids;
    for (const mesa_id of mesa_ids) {
      joinRows.push({ reserva_id: row.id, mesa_id });
    }
  });
  if (joinRows.length > 0) {
    const { error: joinErr } = await sb.from("reservas_mesas").insert(joinRows);
    if (joinErr) {
      console.error(`  ✗ Erro alocando mesas:`, joinErr.message);
      return;
    }
  }

  const semMesa = reservas.filter((r) => r._mesa_ids.length === 0).length;
  const totalPessoas = reservas.reduce((s, r) => s + r.qtd_pessoas, 0);
  console.log(
    `  ✓ ${inserted.length} reservas, ${joinRows.length} alocações de mesa, ${totalPessoas} pessoas` +
      (semMesa > 0 ? ` (${semMesa} sem mesa por falta de espaço)` : "")
  );
}

// ── Datas ─────────────────────────────────────────────────
function dataStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const hoje = new Date();
const amanha = new Date(hoje.getTime() + 24 * 60 * 60 * 1000);

console.log(`Áreas: ${areas.length} | Mesas: ${mesas.length}`);
await inserirDia(dataStr(hoje), 35);
await inserirDia(dataStr(amanha), 45);

console.log("\n✓ Seed concluído. Pra limpar depois: node scripts/seed-stress.mjs --clean");
