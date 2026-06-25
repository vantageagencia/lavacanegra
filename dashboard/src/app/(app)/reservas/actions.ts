"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAuth, getUserRole, isAdminRole } from "@/lib/auth";
import { minPessoasGrupo } from "@/lib/mesa-minimo";

// Manaus não tem horário de verão → offset fixo UTC−4.
const MANAUS_OFFSET = "-04:00";

/** Hoje (yyyy-MM-dd) no fuso de Manaus. */
function hojeManaus(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
  }).format(new Date());
}

/** Instante (ms) do fim da janela de marcação de uma reserva. */
function deadlineMs(
  data_reserva: string,
  horario: string | null,
  janelaMin: number
): number {
  const hhmmss = (horario ?? "23:59:00").slice(0, 8);
  const full = hhmmss.length === 5 ? `${hhmmss}:00` : hhmmss;
  const instante = new Date(`${data_reserva}T${full}${MANAUS_OFFSET}`).getTime();
  return instante + janelaMin * 60 * 1000;
}

export type ReservaStatus = "confirmada" | "cancelada" | "no_show" | "concluida";

// Fallback hardcoded — usado se a env var não existe OU está vazia
const FALLBACK_WEBHOOK =
  "https://hooks.vantagemanaus.com.br/webhook/bd984da3-6152-45f1-bd07-acdc058a96f8";
const RAW_WEBHOOK = (process.env.N8N_DASHBOARD_WEBHOOK_URL || "")
  .replace(/^﻿/, "") // Remove BOM (U+FEFF) caso entre via editor
  .trim();
const N8N_WEBHOOK_URL = RAW_WEBHOOK || FALLBACK_WEBHOOK;
const N8N_DASHBOARD_TOKEN = process.env.N8N_DASHBOARD_TOKEN ?? "";

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  return digits.includes("@") ? input : `${digits}@s.whatsapp.net`;
}

export async function criarReserva(formData: FormData) {
  await assertAuth();
  const cliente_nome = String(formData.get("cliente_nome") ?? "").trim();
  const telefone = String(formData.get("cliente_telefone") ?? "").trim();
  const cliente_email =
    String(formData.get("cliente_email") ?? "").trim() || "";
  const area_codigo = String(formData.get("area_codigo") ?? "");
  const qtd_pessoas = parseInt(String(formData.get("qtd_pessoas") ?? "1"), 10);
  const data_reserva = String(formData.get("data_reserva") ?? "");
  const horario = String(formData.get("horario") ?? "");
  const observacoes =
    String(formData.get("observacoes") ?? "").trim() || "";
  const mesaIdSingle = String(formData.get("mesa_id") ?? "").trim();
  const mesaIdsRaw = String(formData.get("mesa_ids") ?? "").trim();

  let mesaIds: number[] = [];
  if (mesaIdsRaw) {
    try {
      const parsed = JSON.parse(mesaIdsRaw) as unknown;
      if (Array.isArray(parsed)) {
        mesaIds = parsed
          .map((x) => parseInt(String(x), 10))
          .filter((n) => Number.isFinite(n));
      }
    } catch {
      // ignora — segue sem mesa explícita
    }
  } else if (mesaIdSingle) {
    const n = parseInt(mesaIdSingle, 10);
    if (Number.isFinite(n)) mesaIds = [n];
  }

  if (!cliente_nome || !telefone || !area_codigo || !data_reserva || !horario) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  // Valida o mínimo de pessoas da(s) mesa(s) escolhida(s) — não dá pra burlar
  // pelo client. Só aplica quando há mesa específica selecionada.
  if (mesaIds.length > 0) {
    const adminCheck = createAdminClient();
    const { data: mesasSel } = await adminCheck
      .from("mesas")
      .select("capacidade, area_codigo")
      .in("id", mesaIds);
    if (mesasSel && mesasSel.length > 0) {
      const min = minPessoasGrupo(
        mesasSel.map((m: { capacidade: number; area_codigo: string }) => ({
          capacidade: m.capacidade,
          area_codigo: m.area_codigo,
        }))
      );
      if (qtd_pessoas < min) {
        return {
          error: `Esta mesa aceita no mínimo ${min} pessoas. Ajuste a quantidade.`,
        };
      }
    }
  }

  const cliente_telefone = normalizePhone(telefone);

  // Chama o webhook do n8n → executa o mesmo fluxo da Olivia
  // (check disponibilidade + criar evento Google Calendar + insert reserva + alocar mesa)
  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Dashboard-Token": N8N_DASHBOARD_TOKEN,
      },
      body: JSON.stringify({
        cliente_nome,
        cliente_telefone,
        cliente_email,
        area: area_codigo,
        qtd_pessoas,
        data: data_reserva,
        horario,
        nome_titular: cliente_nome,
        telefone_lembrete: cliente_telefone,
        observacoes,
        mesa_id: mesaIds.length === 1 ? mesaIds[0] : undefined,
        mesa_ids: mesaIds.length > 0 ? mesaIds : undefined,
      }),
      cache: "no-store",
      // Não deixa a action pendurada se o n8n travar.
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        error: `Falha no webhook n8n (${res.status}): ${text.slice(0, 300)}`,
      };
    }

    const json = (await res.json()) as {
      sucesso?: boolean;
      mensagem?: string;
      reserva_id?: number;
    };

    if (!json.sucesso) {
      return {
        error:
          json.mensagem ?? "Não foi possível criar a reserva nesse horário.",
      };
    }

    // Se o usuário escolheu mesa(s) explicitamente, sobrescreve a alocação
    // automática feita pelo n8n para garantir que a reserva fique nas mesas
    // selecionadas (importante quando o mapa enviou um grupo de mesas unidas).
    if (json.reserva_id && mesaIds.length > 0) {
      const admin = createAdminClient();
      await admin
        .from("reservas_mesas")
        .delete()
        .eq("reserva_id", json.reserva_id);
      await admin.from("reservas_mesas").insert(
        mesaIds.map((mesa_id) => ({
          reserva_id: json.reserva_id,
          mesa_id,
        }))
      );
    }

    revalidatePath("/reservas");
    revalidatePath("/planta");
    revalidatePath("/");
    return { ok: true, reserva_id: json.reserva_id, mensagem: json.mensagem };
  } catch (err) {
    return {
      error: `Erro de rede ao falar com o webhook: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

export async function atualizarStatusReserva(
  id: number,
  status: ReservaStatus
) {
  const user = await assertAuth();
  const role = await getUserRole();
  const isAdmin = isAdminRole(role);

  // A action é o porteiro (Opção 1): valida tudo e grava via service-role,
  // pois o RLS de `reservas` é admin-only e o colaborador não passaria por ele.
  const admin = createAdminClient();

  const { data: reserva } = await admin
    .from("reservas")
    .select("data_reserva, horario, status")
    .eq("id", id)
    .maybeSingle();

  if (!reserva) return { error: "Reserva não encontrada." };

  // Colaborador só marca reserva de HOJE e dentro da janela; depois trava.
  if (!isAdmin) {
    const { data: cfg } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "marcacao_janela_min")
      .maybeSingle();
    const janelaMin = parseInt(cfg?.value ?? "60", 10) || 60;

    const ehHoje = reserva.data_reserva === hojeManaus();
    const dentroJanela =
      Date.now() <= deadlineMs(reserva.data_reserva, reserva.horario, janelaMin);

    if (!ehHoje || !dentroJanela) {
      return {
        error:
          "Essa reserva já expirou (fora da janela de marcação). Fale com o admin.",
      };
    }
  }

  const { error } = await admin
    .from("reservas")
    .update({
      status,
      marked_by: user.id,
      marked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/reservas");
  revalidatePath("/planta");
  revalidatePath("/");
  return { ok: true };
}

export async function editarReserva(id: number, formData: FormData) {
  await assertAuth();
  const supabase = await createClient();
  const update: Record<string, unknown> = {
    cliente_nome: String(formData.get("cliente_nome") ?? "").trim(),
    cliente_email:
      String(formData.get("cliente_email") ?? "").trim() || null,
    area_codigo: String(formData.get("area_codigo") ?? ""),
    qtd_pessoas: parseInt(String(formData.get("qtd_pessoas") ?? "1"), 10),
    data_reserva: String(formData.get("data_reserva") ?? ""),
    horario: String(formData.get("horario") ?? ""),
    periodo: String(formData.get("periodo") ?? "almoco"),
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("reservas")
    .update(update)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/reservas");
  return { ok: true };
}

export async function deletarReserva(
  id: number
): Promise<{ ok?: true; error?: string }> {
  await assertAuth();
  const supabase = await createClient();
  await supabase.from("reservas_mesas").delete().eq("reserva_id", id);
  const { error } = await supabase.from("reservas").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/reservas");
  revalidatePath("/planta");
  return { ok: true };
}
