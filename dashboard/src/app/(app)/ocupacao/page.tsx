import { format, subDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TrendingUp,
  CalendarX,
  Users,
  Flame,
  AlertTriangle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SubNav } from "@/components/dashboard/sub-nav";
import { ExportButton } from "@/components/dashboard/export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

import { RangePicker } from "./range-picker";

export const dynamic = "force-dynamic";

type Ocupacao = {
  data_reserva: string;
  area_codigo: string;
  area_nome: string;
  capacidade_max: number;
  periodo: string;
  qtd_reservas: number;
  total_pessoas: number;
  pct_ocupacao: number;
  no_shows: number;
  cancelamentos: number;
};

type SP = Promise<{ range?: string; direction?: string }>;

export default async function OcupacaoPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  await requireAdmin();
  const params = await searchParams;
  const range = parseInt(params.range ?? "30", 10);
  const direction: "past" | "future" =
    params.direction === "future" ? "future" : "past";

  const supabase = await createClient();
  const today = new Date();
  const [start, end] =
    direction === "future"
      ? [today, addDays(today, range)]
      : [subDays(today, range), today];

  const [ocupacaoRes, reservasRes] = await Promise.all([
    supabase
      .from("v_ocupacao_diaria")
      .select("*")
      .gte("data_reserva", format(start, "yyyy-MM-dd"))
      .lte("data_reserva", format(end, "yyyy-MM-dd")),
    supabase
      .from("reservas")
      .select("status, qtd_pessoas")
      .gte("data_reserva", format(start, "yyyy-MM-dd"))
      .lte("data_reserva", format(end, "yyyy-MM-dd")),
  ]);

  const ocupacao = (ocupacaoRes.data ?? []) as Ocupacao[];
  const reservas = (reservasRes.data ?? []) as {
    status: string;
    qtd_pessoas: number;
  }[];

  // ── KPIs ─────────────────────
  const totalReservas = reservas.length;
  const totalPessoas = reservas.reduce(
    (s, r) => s + (r.qtd_pessoas ?? 0),
    0
  );
  const noShows = reservas.filter((r) => r.status === "no_show").length;
  const cancelados = reservas.filter((r) => r.status === "cancelada").length;
  const noShowPct = totalReservas
    ? Math.round((noShows / totalReservas) * 1000) / 10
    : 0;
  const cancelPct = totalReservas
    ? Math.round((cancelados / totalReservas) * 1000) / 10
    : 0;

  const totalCapDia = 49 + 77 + 8 + 8 + 16; // interna + externa + tendas + vip_container
  // capacidade total considerando 2 turnos por dia por `range` dias:
  const ocupacaoMedia = totalCapDia
    ? Math.round(
        (totalPessoas / (totalCapDia * 2 * range)) * 1000
      ) / 10
    : 0;

  // ── Heatmap por área ─────────
  // Agrupa por (area, periodo) e calcula média de pct_ocupacao no range
  const groupBy = new Map<
    string,
    { nome: string; valores: number[] }
  >();
  ocupacao.forEach((o) => {
    const key = `${o.area_codigo}|${o.periodo}`;
    const cur = groupBy.get(key) ?? { nome: o.area_nome, valores: [] };
    cur.valores.push(o.pct_ocupacao ?? 0);
    groupBy.set(key, cur);
  });

  // Areas únicas para linhas do heatmap
  const areasSet = new Map<string, string>();
  ocupacao.forEach((o) => areasSet.set(o.area_codigo, o.area_nome));
  const areas = Array.from(areasSet.entries());

  const mediaArea = (codigo: string, periodo: "almoco" | "jantar") => {
    const v = groupBy.get(`${codigo}|${periodo}`)?.valores ?? [];
    if (!v.length) return null;
    return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
  };

  const cellColor = (pct: number | null) => {
    if (pct === null) return "bg-muted/30 text-muted-foreground/50";
    if (pct < 10) return "bg-muted text-muted-foreground";
    if (pct < 30) return "bg-primary/15 text-foreground";
    if (pct < 60) return "bg-primary/40 text-foreground";
    if (pct < 85) return "bg-primary/70 text-primary-foreground";
    return "bg-primary text-primary-foreground";
  };

  // ── Top dias ─────────────────
  const porDia = new Map<string, { pessoas: number; reservas: number }>();
  ocupacao.forEach((o) => {
    const cur = porDia.get(o.data_reserva) ?? { pessoas: 0, reservas: 0 };
    cur.pessoas += o.total_pessoas ?? 0;
    cur.reservas += o.qtd_reservas ?? 0;
    porDia.set(o.data_reserva, cur);
  });
  const topDias = Array.from(porDia.entries())
    .sort(([, a], [, b]) => b.pessoas - a.pessoas)
    .slice(0, 5);

  // ── Almoço vs Jantar ─────────
  const almocoPessoas = ocupacao
    .filter((o) => o.periodo === "almoco")
    .reduce((s, o) => s + (o.total_pessoas ?? 0), 0);
  const almocoReservas = ocupacao
    .filter((o) => o.periodo === "almoco")
    .reduce((s, o) => s + (o.qtd_reservas ?? 0), 0);
  const jantarPessoas = ocupacao
    .filter((o) => o.periodo === "jantar")
    .reduce((s, o) => s + (o.total_pessoas ?? 0), 0);
  const jantarReservas = ocupacao
    .filter((o) => o.periodo === "jantar")
    .reduce((s, o) => s + (o.qtd_reservas ?? 0), 0);
  const totalPer = almocoPessoas + jantarPessoas;
  const pctAlmoco = totalPer ? Math.round((almocoPessoas / totalPer) * 100) : 0;
  const pctJantar = totalPer ? Math.round((jantarPessoas / totalPer) * 100) : 0;

  const subtitleLabel =
    direction === "future"
      ? `Previsão de ${format(start, "dd/MM", { locale: ptBR })} a ${format(end, "dd/MM/yyyy", { locale: ptBR })}`
      : `Desempenho de ${format(start, "dd/MM", { locale: ptBR })} a ${format(end, "dd/MM/yyyy", { locale: ptBR })}`;

  return (
    <>
      <PageHeader
        title="Visão geral"
        subtitle={subtitleLabel}
        actions={
          <>
            <SubNav
              items={[
                { href: "/", label: "Hoje", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
                { href: "/ocupacao", label: "Período", icon: <BarChart3 className="h-3.5 w-3.5" /> },
              ]}
            />
            <ExportButton
              tipo="ocupacao"
              label="Exportar"
              defaultFrom={format(start, "yyyy-MM-dd")}
              defaultTo={format(end, "yyyy-MM-dd")}
            />
            <RangePicker />
          </>
        }
      />

      {/* KPIs */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Reservas"
          value={totalReservas}
          hint={`${totalPessoas} pessoas`}
          icon={Users}
          accent="primary"
        />
        <KpiCard
          label="Ocupação média"
          value={`${ocupacaoMedia}%`}
          hint="almoço + jantar"
          icon={TrendingUp}
          accent="primary"
        />
        <KpiCard
          label="No-show"
          value={`${noShowPct}%`}
          hint={`${noShows} reservas`}
          icon={CalendarX}
          accent="accent"
        />
        <KpiCard
          label="Cancelamentos"
          value={`${cancelPct}%`}
          hint={`${cancelados} reservas`}
          icon={AlertTriangle}
          accent="muted"
        />
      </section>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-4 w-4 text-primary" /> Heatmap por área (%
            ocupação média)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {areas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem dados no período selecionado.
            </p>
          ) : (
            <div className="grid grid-cols-[minmax(8rem,auto)_repeat(2,1fr)] gap-1 text-xs">
              <div />
              <div className="text-center text-muted-foreground uppercase tracking-wider py-1">
                Almoço
              </div>
              <div className="text-center text-muted-foreground uppercase tracking-wider py-1">
                Jantar
              </div>

              {areas.map(([codigo, nome]) => {
                const alm = mediaArea(codigo, "almoco");
                const jan = mediaArea(codigo, "jantar");
                return (
                  <div key={codigo} className="contents">
                    <div className="flex items-center text-sm py-2 pr-2">
                      {nome}
                    </div>
                    <div
                      className={cn(
                        "rounded-md text-center py-3 font-display text-lg tracking-wider",
                        cellColor(alm)
                      )}
                    >
                      {alm === null ? "—" : `${alm}%`}
                    </div>
                    <div
                      className={cn(
                        "rounded-md text-center py-3 font-display text-lg tracking-wider",
                        cellColor(jan)
                      )}
                    >
                      {jan === null ? "—" : `${jan}%`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Período + Top dias */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Almoço × Jantar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="uppercase text-muted-foreground">Almoço</span>
                <span className="font-mono">
                  {almocoReservas} res · {almocoPessoas} pessoas ({pctAlmoco}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${pctAlmoco}%` }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="uppercase text-muted-foreground">Jantar</span>
                <span className="font-mono">
                  {jantarReservas} res · {jantarPessoas} pessoas ({pctJantar}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-chart-2"
                  style={{ width: `${pctJantar}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 dias mais cheios</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topDias.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                Sem dados.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {topDias.map(([data, { pessoas, reservas: resCount }]) => (
                  <li
                    key={data}
                    className="flex items-center justify-between px-6 py-3"
                  >
                    <span className="text-sm">
                      {format(new Date(data + "T00:00:00"), "EEE, dd 'de' MMMM", {
                        locale: ptBR,
                      })}
                    </span>
                    <span className="font-mono text-primary">
                      {resCount} res · {pessoas} pessoas
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
