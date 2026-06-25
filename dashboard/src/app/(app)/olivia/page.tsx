import {
  format,
  subDays,
  parseISO,
  isValid,
  differenceInCalendarDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users,
  TrendingUp,
  CheckCircle2,
  CalendarCheck,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { SubNav } from "@/components/dashboard/sub-nav";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { Users as UsersIcon, Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Contato = {
  user_number: string;
  user_name: string | null;
  nome_completo: string | null;
  created_at: string;
};

type Reserva = {
  cliente_telefone: string;
  data_reserva: string;
  status: string;
};

interface OliviaPageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function OliviaPage({ searchParams }: OliviaPageProps) {
  await requireAdmin();
  const supabase = await createClient();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  // ── Período selecionável (padrão: últimos 7 dias) ─────────
  const sp = await searchParams;
  const fromParsed = sp.from ? parseISO(sp.from) : null;
  const toParsed = sp.to ? parseISO(sp.to) : null;
  const fromDate =
    fromParsed && isValid(fromParsed) ? fromParsed : subDays(today, 6);
  const toDate = toParsed && isValid(toParsed) ? toParsed : today;
  const fromStr = format(fromDate, "yyyy-MM-dd");
  const toStr = format(toDate, "yyyy-MM-dd");
  const rangeDays = Math.max(1, differenceInCalendarDays(toDate, fromDate) + 1);

  // 1) Contatos novos no período
  const contatosRes = await supabase
    .from("contatos_agente")
    .select("user_number, user_name, nome_completo, created_at")
    .gte("created_at", fromStr)
    .lte("created_at", `${toStr}T23:59:59`)
    .like("user_number", "%@s.whatsapp.net");

  const contatosPeriodo = (contatosRes.data ?? []) as Contato[];

  // 2) Todas as reservas desses contatos (qualquer data) — assim um lead que
  //    reservou depois da janela ainda conta como conversão/presença.
  const phones = contatosPeriodo.map((c) => c.user_number);
  const reservasRes = phones.length
    ? await supabase
        .from("reservas")
        .select("cliente_telefone, data_reserva, status")
        .in("cliente_telefone", phones)
    : { data: [] as Reserva[] };
  const reservas = (reservasRes.data ?? []) as Reserva[];

  // ── Funil ─────────────────────────────
  const novosContatos = contatosPeriodo.length;

  // Reservas: contatos que viraram reserva (qualquer reserva não cancelada)
  const jidsComReserva = new Set(
    reservas
      .filter((r) => r.status !== "cancelada")
      .map((r) => r.cliente_telefone)
  );
  const reservasCount = contatosPeriodo.filter((c) =>
    jidsComReserva.has(c.user_number)
  ).length;

  // Presenças: compareceu de fato — reserva concluída OU reserva passada
  // confirmada (não cancelada / não no-show).
  const jidsComPresenca = new Set(
    reservas
      .filter(
        (r) =>
          r.status === "concluida" ||
          (r.status === "confirmada" && r.data_reserva <= todayStr)
      )
      .map((r) => r.cliente_telefone)
  );
  const presencasCount = contatosPeriodo.filter((c) =>
    jidsComPresenca.has(c.user_number)
  ).length;

  const taxaContatoReserva = novosContatos
    ? Math.round((reservasCount / novosContatos) * 100)
    : 0;
  const taxaReservaPresenca = reservasCount
    ? Math.round((presencasCount / reservasCount) * 100)
    : 0;
  const taxaPresencaTotal = novosContatos
    ? Math.round((presencasCount / novosContatos) * 100)
    : 0;

  // ── Contatos por dia (no período selecionado) ─────────
  const porDia = new Map<string, number>();
  for (let i = 0; i < rangeDays; i++) {
    porDia.set(format(subDays(toDate, rangeDays - 1 - i), "yyyy-MM-dd"), 0);
  }
  contatosPeriodo.forEach((c) => {
    const d = c.created_at.slice(0, 10);
    if (porDia.has(d)) porDia.set(d, (porDia.get(d) ?? 0) + 1);
  });
  const maxDia = Math.max(...porDia.values(), 1);

  // ── Larguras do funil ─────────────────
  const widthReservas = novosContatos
    ? Math.max(20, Math.round((reservasCount / novosContatos) * 100))
    : 20;
  const widthPresencas = novosContatos
    ? Math.max(15, Math.round((presencasCount / novosContatos) * 100))
    : 15;

  return (
    <>
      <PageHeader
        title="Olivia"
        subtitle={
          fromStr === toStr
            ? `Funil de conversão — ${format(fromDate, "dd 'de' MMM", {
                locale: ptBR,
              })}`
            : `Funil de conversão — ${format(fromDate, "dd/MM", {
                locale: ptBR,
              })} a ${format(toDate, "dd/MM", { locale: ptBR })}`
        }
        actions={
          <>
            <SubNav
              items={[
                { href: "/clientes", label: "Clientes", icon: <UsersIcon className="h-3.5 w-3.5" /> },
                { href: "/olivia", label: "Olivia (IA)", icon: <Bot className="h-3.5 w-3.5" /> },
              ]}
            />
            <DateRangePicker from={fromStr} to={toStr} />
          </>
        }
      />

      {/* ── FUNIL ────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Funil de conversão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Etapa 1 — Novos contatos */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-mono text-primary">
                  1
                </span>
                <Users className="h-3.5 w-3.5" /> Novos contatos
              </span>
              <span className="font-display text-2xl">{novosContatos}</span>
            </div>
            <div className="h-10 rounded-md bg-primary flex items-center px-4 text-primary-foreground text-sm font-mono">
              100%
            </div>
          </div>

          {/* Etapa 2 — Reservas */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-mono text-primary">
                  2
                </span>
                <CalendarCheck className="h-3.5 w-3.5" /> Reservas
              </span>
              <span className="font-display text-2xl">
                {reservasCount}
                <span className="text-xs font-sans text-muted-foreground ml-2 normal-case tracking-normal">
                  · {taxaContatoReserva}% dos contatos
                </span>
              </span>
            </div>
            <div className="relative h-10">
              <div
                className="absolute inset-y-0 left-0 rounded-md bg-primary/65 flex items-center px-4 text-primary-foreground text-sm font-mono transition-all"
                style={{ width: `${widthReservas}%` }}
              >
                {taxaContatoReserva}%
              </div>
            </div>
          </div>

          {/* Etapa 3 — Presenças */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-mono text-primary">
                  3
                </span>
                <CheckCircle2 className="h-3.5 w-3.5" /> Presenças
              </span>
              <span className="font-display text-2xl">
                {presencasCount}
                <span className="text-xs font-sans text-muted-foreground ml-2 normal-case tracking-normal">
                  · {taxaReservaPresenca}% das reservas
                </span>
              </span>
            </div>
            <div className="relative h-10">
              <div
                className="absolute inset-y-0 left-0 rounded-md bg-primary/40 flex items-center px-4 text-foreground text-sm font-mono transition-all"
                style={{ width: `${widthPresencas}%` }}
              >
                {taxaPresencaTotal}%
              </div>
            </div>
          </div>

          {/* Taxa de presenças final */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Taxa de presenças
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                contatos → presenças no salão
              </p>
            </div>
            <span className="font-display text-4xl text-primary">
              {taxaPresencaTotal}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de barras */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Contatos novos por dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1.5 h-32">
            {Array.from(porDia.entries()).map(([dia, count]) => {
              const heightPct = (count / maxDia) * 100;
              return (
                <div
                  key={dia}
                  className="flex-1 flex flex-col items-center gap-1.5"
                  title={`${dia}: ${count} contato(s)`}
                >
                  <div className="flex-1 w-full flex items-end">
                    <div
                      className={cn(
                        "w-full rounded-t transition-all",
                        count > 0 ? "bg-primary" : "bg-muted"
                      )}
                      style={{ height: count > 0 ? `${heightPct}%` : "4px" }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {dia.slice(8)}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

    </>
  );
}
