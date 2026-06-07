import {
  CalendarDays,
  Users,
  TrendingUp,
  AlertTriangle,
  MessageCircle,
  Bot,
  Clock,
  CalendarRange,
  Sparkles,
} from "lucide-react";
import {
  format,
  parseISO,
  addDays,
  subDays,
  isValid,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DateNav } from "@/app/(app)/planta/date-nav";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatHora,
  periodoLabel,
  statusLabel,
  statusVariant,
  extractMessage,
  type ReservaStatus,
} from "@/lib/format";

export const dynamic = "force-dynamic";

type Reserva = {
  id: number;
  horario: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  area_codigo: string;
  qtd_pessoas: number;
  periodo: string;
  status: ReservaStatus;
  data_reserva: string;
  created_at: string;
};

type Area = {
  codigo: string;
  nome: string;
  capacidade_max: number;
  evento_fechado: boolean;
};

type ChatRow = {
  id: number;
  session_id: string;
  message: { type?: string; content?: string };
};

interface OverviewPageProps {
  searchParams: Promise<{ data?: string }>;
}

export default async function OverviewPage({ searchParams }: OverviewPageProps) {
  await requireAdmin();
  const supabase = await createClient();

  const today = new Date();
  const sp = await searchParams;
  const dayParsed = sp.data ? parseISO(sp.data) : null;
  const day = dayParsed && isValid(dayParsed) ? dayParsed : today;
  // Visão de dia único — o seletor com setas controla o dia exibido.
  const fromDate = day;
  const toDate = day;
  const fromStr = format(day, "yyyy-MM-dd");
  const toStr = fromStr;

  const rangeDays = 1;
  const prevTo = subDays(fromDate, 1);
  const prevFrom = prevTo;
  const prevFromStr = format(prevFrom, "yyyy-MM-dd");
  const prevToStr = format(prevTo, "yyyy-MM-dd");

  const todayStr = format(today, "yyyy-MM-dd");
  const nextSevenDays = format(addDays(today, 7), "yyyy-MM-dd");

  const thirtyDaysAgo = format(subDays(today, 30), "yyyy-MM-dd");

  const [
    reservasPeriodoRes,
    areasRes,
    reservasPeriodoAntRes,
    proxSemanaRes,
    contatosNovosRes,
    reservasViaJIDRes,
    ultimasMsgsRes,
    reservasHojeRes,
    pastConfirmadasRes,
  ] = await Promise.all([
    supabase
      .from("reservas")
      .select(
        "id, horario, cliente_nome, cliente_telefone, area_codigo, qtd_pessoas, periodo, status, data_reserva, created_at"
      )
      .gte("data_reserva", fromStr)
      .lte("data_reserva", toStr)
      .order("data_reserva", { ascending: false })
      .order("horario"),
    supabase
      .from("areas")
      .select("codigo, nome, capacidade_max, evento_fechado")
      .eq("ativa", true),
    supabase
      .from("reservas")
      .select("qtd_pessoas, status")
      .gte("data_reserva", prevFromStr)
      .lte("data_reserva", prevToStr),
    supabase
      .from("reservas")
      .select("id, qtd_pessoas, data_reserva")
      .gt("data_reserva", todayStr)
      .lte("data_reserva", nextSevenDays)
      .eq("status", "confirmada"),
    supabase
      .from("contatos_agente")
      .select("user_number")
      .gte("created_at", fromStr)
      .lte("created_at", `${toStr}T23:59:59`)
      .like("user_number", "%@s.whatsapp.net"),
    supabase
      .from("reservas")
      .select("cliente_telefone")
      .gte("created_at", fromStr)
      .lte("created_at", `${toStr}T23:59:59`)
      .like("cliente_telefone", "%@s.whatsapp.net"),
    supabase
      .from("n8n_chat_histories")
      .select("id, session_id, message")
      .order("id", { ascending: false })
      .limit(5),
    supabase
      .from("reservas")
      .select(
        "id, horario, cliente_nome, area_codigo, qtd_pessoas, periodo, status, reservas_mesas(mesa_id)"
      )
      .eq("data_reserva", todayStr),
    supabase
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmada")
      .gte("data_reserva", thirtyDaysAgo)
      .lt("data_reserva", todayStr),
  ]);

  const reservasPeriodo = (reservasPeriodoRes.data ?? []) as Reserva[];
  const areas = (areasRes.data ?? []) as Area[];
  const reservasPeriodoAnt = (reservasPeriodoAntRes.data ?? []) as {
    qtd_pessoas: number;
    status: string;
  }[];
  const proxSemana = (proxSemanaRes.data ?? []) as {
    qtd_pessoas: number;
    data_reserva: string;
  }[];
  const ultimasMsgs = (ultimasMsgsRes.data ?? []) as ChatRow[];
  const reservasHoje = (reservasHojeRes.data ?? []) as Array<{
    id: number;
    horario: string;
    cliente_nome: string;
    area_codigo: string;
    qtd_pessoas: number;
    periodo: string;
    status: ReservaStatus;
    reservas_mesas: { mesa_id: number }[] | null;
  }>;
  const pastConfirmadasCount = pastConfirmadasRes.count ?? 0;

  // ── Agregados do período ─────────────────────
  const pessoasPeriodo = reservasPeriodo.reduce(
    (s, r) => s + (r.qtd_pessoas ?? 0),
    0
  );
  const totalReservas = reservasPeriodo.length;

  const capacidadeDia = areas.reduce(
    (s, a) => s + (a.capacidade_max ?? 0),
    0
  );
  // Capacidade total no período = capacidade/dia × 2 serviços × dias
  const capacidadeTotal = capacidadeDia * 2 * rangeDays;
  const ocupacaoPct = capacidadeTotal
    ? Math.min(100, Math.round((pessoasPeriodo / capacidadeTotal) * 100))
    : 0;

  // ── Comparativo vs período anterior ──────────
  const pessoasAnt = reservasPeriodoAnt.reduce(
    (s, r) => s + (r.qtd_pessoas ?? 0),
    0
  );
  const reservasAnt = reservasPeriodoAnt.length;

  const trendPessoas = pessoasAnt
    ? Math.round(((pessoasPeriodo - pessoasAnt) / pessoasAnt) * 100)
    : 0;
  const trendReservas = reservasAnt
    ? Math.round(((totalReservas - reservasAnt) / reservasAnt) * 100)
    : 0;

  // No-show rate
  const noShowsPeriodo = reservasPeriodo.filter(
    (r) => r.status === "no_show"
  ).length;
  const noShowPctPeriodo = totalReservas
    ? Math.round((noShowsPeriodo / totalReservas) * 1000) / 10
    : 0;

  // ── Próx. 7 dias (forward booking) ───────────
  const pessoasProx7d = proxSemana.reduce(
    (s, r) => s + (r.qtd_pessoas ?? 0),
    0
  );

  // ── Olivia ───────────────────────────────────
  // Conversão = % dos contatos novos do período que viraram reserva.
  // (mesma coorte no numerador e denominador → sempre ≤ 100%)
  const contatosNovosList = (contatosNovosRes.data ?? []) as {
    user_number: string;
  }[];
  const reservasWhatsList = (reservasViaJIDRes.data ?? []) as {
    cliente_telefone: string;
  }[];
  const contatosNovos = contatosNovosList.length;
  const jidsComReservaPeriodo = new Set(
    reservasWhatsList.map((r) => r.cliente_telefone)
  );
  const reservasViaJID = contatosNovosList.filter((c) =>
    jidsComReservaPeriodo.has(c.user_number)
  ).length;
  const conversaoPct = contatosNovos
    ? Math.min(100, Math.round((reservasViaJID / contatosNovos) * 100))
    : 0;
  const reservasWhatsPeriodo = reservasPeriodo.filter((r) =>
    r.cliente_telefone?.endsWith("@s.whatsapp.net")
  ).length;
  const canalWhatsPct = totalReservas
    ? Math.round((reservasWhatsPeriodo / totalReservas) * 100)
    : 0;

  // ── Mix por tamanho de grupo ─────────────────
  const small = reservasPeriodo.filter((r) => r.qtd_pessoas <= 2).length;
  const medium = reservasPeriodo.filter(
    (r) => r.qtd_pessoas >= 3 && r.qtd_pessoas <= 6
  ).length;
  const large = reservasPeriodo.filter((r) => r.qtd_pessoas >= 7).length;
  const totalGrupo = small + medium + large || 1;
  const pctSmall = Math.round((small / totalGrupo) * 100);
  const pctMedium = Math.round((medium / totalGrupo) * 100);
  const pctLarge = Math.round((large / totalGrupo) * 100);

  // ── Horário de pico ──────────────────────────
  const porHora = new Map<number, number>();
  reservasPeriodo.forEach((r) => {
    const h = parseInt(r.horario?.slice(0, 2) ?? "0", 10);
    porHora.set(h, (porHora.get(h) ?? 0) + 1);
  });
  const horas = Array.from({ length: 13 }, (_, i) => i + 11);
  const maxHora = Math.max(...horas.map((h) => porHora.get(h) ?? 0), 1);
  const horaPico =
    Array.from(porHora.entries()).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

  // ── Mix por área ─────────────────────────────
  const porArea = new Map<string, number>();
  reservasPeriodo.forEach((r) => {
    porArea.set(
      r.area_codigo,
      (porArea.get(r.area_codigo) ?? 0) + (r.qtd_pessoas ?? 0)
    );
  });
  const topAreas = Array.from(porArea.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([codigo, pessoas]) => ({
      codigo,
      nome: areas.find((a) => a.codigo === codigo)?.nome ?? codigo,
      pessoas,
      pct: pessoasPeriodo ? Math.round((pessoas / pessoasPeriodo) * 100) : 0,
    }));

  const areaNome = (codigo: string) =>
    areas.find((a) => a.codigo === codigo)?.nome ?? codigo;

  // ── Alertas ──────────────────────────────────
  const alertas: string[] = [];

  // 1. Área lotando hoje (>=85% de ocupação por área + serviço)
  const areaPeriodoCount = new Map<string, number>();
  reservasHoje.forEach((r) => {
    if (r.status === "cancelada" || r.status === "no_show") return;
    const key = `${r.area_codigo}:${r.periodo}`;
    areaPeriodoCount.set(
      key,
      (areaPeriodoCount.get(key) ?? 0) + (r.qtd_pessoas ?? 0)
    );
  });
  areaPeriodoCount.forEach((pessoas, key) => {
    const [codigo, periodo] = key.split(":");
    const cap = areas.find((a) => a.codigo === codigo)?.capacidade_max ?? 0;
    const pct = cap ? (pessoas / cap) * 100 : 0;
    if (pct >= 85) {
      alertas.push(
        `${areaNome(codigo)} no ${periodoLabel[periodo] ?? periodo} de hoje: ${Math.round(pct)}% de ocupação`
      );
    }
  });

  // 2. Reservas VIP/Tendas hoje sem mesa atribuída
  const vipAreaCodigos = new Set(
    areas.filter((a) => a.evento_fechado).map((a) => a.codigo)
  );
  const vipSemMesa = reservasHoje.filter(
    (r) =>
      vipAreaCodigos.has(r.area_codigo) &&
      (r.reservas_mesas?.length ?? 0) === 0 &&
      r.status === "confirmada"
  );
  if (vipSemMesa.length > 0) {
    alertas.push(
      `${vipSemMesa.length} reserva${vipSemMesa.length > 1 ? "s" : ""} VIP/Tendas hoje sem mesa atribuída`
    );
  }

  // 3. Grupos grandes (7+) chegando hoje
  const gruposGrandesHoje = reservasHoje.filter(
    (r) => r.qtd_pessoas >= 7 && r.status === "confirmada"
  );
  if (gruposGrandesHoje.length > 0) {
    alertas.push(
      `${gruposGrandesHoje.length} grupo${gruposGrandesHoje.length > 1 ? "s" : ""} grande${gruposGrandesHoje.length > 1 ? "s" : ""} (7+) chegando hoje`
    );
  }

  // 4. Reservas confirmadas em datas passadas (não atualizadas)
  if (pastConfirmadasCount > 0) {
    alertas.push(
      `${pastConfirmadasCount} reserva${pastConfirmadasCount > 1 ? "s" : ""} confirmada${pastConfirmadasCount > 1 ? "s" : ""} com data passada — atualize para Concluída ou No-show`
    );
  }

  // 5. Calendário vazio: sem reservas confirmadas nos próximos 3 dias
  const tresDiasStr = format(addDays(today, 3), "yyyy-MM-dd");
  const proxTresDias = proxSemana.filter((r) => r.data_reserva <= tresDiasStr);
  if (proxTresDias.length === 0) {
    alertas.push("Sem reservas confirmadas nos próximos 3 dias");
  }

  // 6. No-show alto no período
  if (noShowPctPeriodo > 10) {
    alertas.push(
      `Taxa de no-show alta: ${noShowPctPeriodo}% no período selecionado`
    );
  }

  // 7. Queda forte de pessoas atendidas vs período anterior
  if (pessoasAnt > 0 && trendPessoas < -20) {
    alertas.push(
      `Queda de ${Math.abs(trendPessoas)}% em pessoas atendidas vs período anterior`
    );
  }

  // 8. Conversão Olivia baixa (só alerta se houver volume mínimo de contatos)
  if (contatosNovos >= 10 && conversaoPct < 15) {
    alertas.push(
      `Conversão da Olivia baixa: ${conversaoPct}% (${reservasViaJID}/${contatosNovos} contatos viraram reserva)`
    );
  }

  // 9. % WhatsApp baixo (só se houver volume mínimo de reservas)
  if (totalReservas >= 10 && canalWhatsPct < 30) {
    alertas.push(
      `Apenas ${canalWhatsPct}% das reservas no período vieram pelo WhatsApp — Olivia subaproveitada`
    );
  }

  // ── Período em rótulos legíveis ──────────────
  const isSameDay = fromStr === toStr;
  const isToday = isSameDay && fromStr === todayStr;
  const subtitlePeriodo = isToday
    ? format(today, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : isSameDay
      ? format(fromDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      : `${format(fromDate, "dd 'de' MMM", { locale: ptBR })} — ${format(
          toDate,
          "dd 'de' MMM 'de' yyyy",
          { locale: ptBR }
        )}`;

  const periodoLabelCurto = isSameDay
    ? format(fromDate, "dd 'de' MMM", { locale: ptBR })
    : `${format(fromDate, "dd/MM", { locale: ptBR })} — ${format(
        toDate,
        "dd/MM",
        { locale: ptBR }
      )}`;

  // Limita a lista de reservas exibida quando o período é longo
  const reservasParaListar = reservasPeriodo.slice(0, 50);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={subtitlePeriodo}
        actions={<DateNav data={fromStr} />}
      />

      {/* ── KPIs do período ──────────────── */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-sm tracking-wider text-muted-foreground">
            Resumo do dia
          </h2>
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Reservas"
            value={totalReservas}
            hint={`${pessoasPeriodo} pessoas`}
            icon={CalendarDays}
            accent="primary"
          />
          <KpiCard
            label="Ocupação média"
            value={`${ocupacaoPct}%`}
            hint="almoço + jantar"
            icon={TrendingUp}
            accent="accent"
          />
          <KpiCard
            label="Próx. 7 dias"
            value={pessoasProx7d}
            hint={`${proxSemana.length} reservas`}
            icon={CalendarRange}
            accent="muted"
          />
        </div>
      </section>

      {/* ── KPIs comparativo ──────────────── */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-sm tracking-wider text-muted-foreground">
            {periodoLabelCurto}
          </h2>
          <span className="text-xs text-muted-foreground">
            vs dia anterior
          </span>
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Pessoas atendidas"
            value={pessoasPeriodo}
            trend={{
              direction:
                trendPessoas > 0 ? "up" : trendPessoas < 0 ? "down" : "flat",
              label: `${trendPessoas >= 0 ? "+" : ""}${trendPessoas}%`,
            }}
            icon={Users}
            accent="primary"
          />
          <KpiCard
            label="Reservas"
            value={totalReservas}
            trend={{
              direction:
                trendReservas > 0 ? "up" : trendReservas < 0 ? "down" : "flat",
              label: `${trendReservas >= 0 ? "+" : ""}${trendReservas}%`,
            }}
            icon={CalendarDays}
            accent="accent"
          />
          <KpiCard
            label="No-show rate"
            value={`${noShowPctPeriodo}%`}
            hint={`${noShowsPeriodo} faltas`}
            icon={AlertTriangle}
            accent="muted"
          />
          <KpiCard
            label="Conversão Olivia"
            value={`${conversaoPct}%`}
            hint={`${canalWhatsPct}% das reservas via WhatsApp`}
            icon={Bot}
            accent="primary"
          />
        </div>
      </section>

      {/* ── Insights: mix grupo + hora pico + área ──── */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Mix por tamanho
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Casal (1-2)", count: small, pct: pctSmall, color: "bg-chart-3" },
              { label: "Grupo (3-6)", count: medium, pct: pctMedium, color: "bg-primary" },
              { label: "Grande (7+)", count: large, pct: pctLarge, color: "bg-chart-2" },
            ].map((g) => (
              <div key={g.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{g.label}</span>
                  <span className="font-mono">{g.count} ({g.pct}%)</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full", g.color)}
                    style={{ width: `${g.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Horário de pico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-24 mb-2">
              {horas.map((h) => {
                const count = porHora.get(h) ?? 0;
                const pct = (count / maxHora) * 100;
                const isPeak = h === horaPico;
                return (
                  <div
                    key={h}
                    className="flex-1 flex flex-col items-center gap-1"
                    title={`${h}h: ${count} reservas`}
                  >
                    <div className="flex-1 w-full flex items-end">
                      <div
                        className={cn(
                          "w-full rounded-t transition-all",
                          count > 0
                            ? isPeak
                              ? "bg-primary"
                              : "bg-primary/40"
                            : "bg-muted"
                        )}
                        style={{
                          height: count > 0 ? `${Math.max(pct, 8)}%` : "3px",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>11h</span>
              <span>17h</span>
              <span>23h</span>
            </div>
            {horaPico !== null && (
              <p className="text-xs text-muted-foreground mt-2">
                Pico em <span className="text-primary">{horaPico}h</span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Áreas mais usadas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {topAreas.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sem dados no período
              </p>
            ) : (
              topAreas.slice(0, 5).map((a) => (
                <div key={a.codigo}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{a.nome}</span>
                    <span className="font-mono text-muted-foreground">
                      {a.pessoas}p · {a.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${a.pct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Reservas do período + Últimas conversas ──── */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" />
              Reservas do dia
              {reservasPeriodo.length > 50 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (mostrando 50 de {reservasPeriodo.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {reservasParaListar.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                Nenhuma reserva no período selecionado.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {reservasParaListar.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex flex-col items-end shrink-0">
                        <span className="font-mono text-sm text-primary">
                          {formatHora(r.horario)}
                        </span>
                        {!isSameDay && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {format(parseISO(r.data_reserva), "dd/MM")}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm truncate">{r.cliente_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {areaNome(r.area_codigo)} ·{" "}
                          {periodoLabel[r.periodo] ?? r.periodo} ·{" "}
                          {r.qtd_pessoas} pessoas
                        </p>
                      </div>
                    </div>
                    <Badge variant={statusVariant[r.status] ?? "outline"}>
                      {statusLabel[r.status] ?? r.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4 text-primary" /> Últimas
              conversas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {ultimasMsgs.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                Sem conversas registradas.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {ultimasMsgs.map((m) => {
                  const ex = extractMessage(m.message);
                  return (
                    <li key={m.id} className="px-6 py-3 space-y-1">
                      <p className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">
                          {ex.type === "ai" ? "🤖 Olivia" : "🧑 Cliente"}
                        </span>
                        <span className="text-muted-foreground truncate max-w-[8rem]">
                          {m.session_id.replace("@s.whatsapp.net", "")}
                        </span>
                      </p>
                      <p className="text-sm line-clamp-2">{ex.content}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Alertas ───────────────────────── */}
      {alertas.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Alertas operacionais</p>
              <ul className="text-sm text-muted-foreground space-y-0.5">
                {alertas.map((a, i) => (
                  <li key={i}>· {a}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
