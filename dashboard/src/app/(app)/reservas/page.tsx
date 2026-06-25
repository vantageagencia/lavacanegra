import { addDays, format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Users, AlertTriangle } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRole, isAdminRole } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatHora,
  periodoLabel,
  statusLabel,
  statusVariant,
  formatPhone,
  type ReservaStatus,
} from "@/lib/format";

import { Filters } from "./filters";
import { RealtimeListener } from "./realtime-listener";
import { WeeklyGrid } from "./weekly-grid";
import { NovaReservaDialog } from "./nova-reserva-dialog";
import { RowActions } from "./row-actions";
import { ServiceTabs } from "./service-tabs";
import { WeekNav } from "./week-nav";
import { DoorList } from "./door-list";

export const dynamic = "force-dynamic";

type Reserva = {
  id: number;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string | null;
  area_codigo: string;
  qtd_pessoas: number;
  data_reserva: string;
  horario: string;
  periodo: string;
  status: ReservaStatus;
  observacoes: string | null;
  reservas_mesas: { mesa_id: number }[] | null;
};

type Area = {
  codigo: string;
  nome: string;
  capacidade_max: number;
  evento_fechado: boolean;
};

type Mesa = {
  id: number;
  area_codigo: string;
  nome: string;
  capacidade: number;
};

type SP = Promise<{
  data?: string;
  periodo?: string;
  area?: string;
  status?: string;
}>;

function defaultPeriodoByTime(): "almoco" | "jantar" {
  // Manaus = UTC-4 (sem horário de verão)
  const horaManaus = (new Date().getUTCHours() - 4 + 24) % 24;
  return horaManaus < 16 ? "almoco" : "jantar";
}

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const params = await searchParams;
  const role = await getUserRole();
  const isAdmin = isAdminRole(role);
  // Usa admin client pras queries de dados — RLS bloqueava areas/mesas pro colaborador
  const supabase = createAdminClient();

  const today = new Date();
  // Colaborador só enxerga o dia atual, não pode trocar via ?data=
  const filterDate = isAdmin
    ? (params.data ?? format(today, "yyyy-MM-dd"))
    : format(today, "yyyy-MM-dd");
  const refDate = new Date(filterDate + "T00:00:00");
  const weekStart = startOfWeek(refDate, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);

  // Período efetivo: explícito (almoco/jantar/all) ou default pelo horário atual
  const periodoParam = params.periodo;
  const effectivePeriodo: "almoco" | "jantar" | "all" =
    periodoParam === "almoco" || periodoParam === "jantar"
      ? periodoParam
      : periodoParam === "all"
        ? "all"
        : defaultPeriodoByTime();

  const [areasRes, mesasRes, listRes, semanaRes, pendentesRes] = await Promise.all([
    supabase
      .from("areas")
      .select("codigo, nome, capacidade_max, evento_fechado")
      .eq("ativa", true)
      .order("nome"),
    supabase
      .from("mesas")
      .select("id, area_codigo, nome, capacidade")
      .eq("ativa", true)
      .order("nome"),
    (() => {
      let q = supabase
        .from("reservas")
        .select(
          "id, cliente_nome, cliente_telefone, cliente_email, area_codigo, qtd_pessoas, data_reserva, horario, periodo, status, observacoes, reservas_mesas(mesa_id)"
        )
        .eq("data_reserva", filterDate)
        .order("horario");
      if (effectivePeriodo !== "all") q = q.eq("periodo", effectivePeriodo);
      if (params.area) q = q.eq("area_codigo", params.area);
      if (params.status) q = q.eq("status", params.status);
      return q;
    })(),
    supabase
      .from("reservas")
      .select("data_reserva, periodo, qtd_pessoas")
      .gte("data_reserva", format(weekStart, "yyyy-MM-dd"))
      .lte("data_reserva", format(weekEnd, "yyyy-MM-dd")),
    // Pendentes de marcação: reservas passadas ainda "confirmada" (ninguém
    // marcou chegou/não veio/cancelou). Vira a fila de trabalho do responsável.
    supabase
      .from("reservas")
      .select(
        "id, cliente_nome, area_codigo, qtd_pessoas, horario, data_reserva, status, reservas_mesas(mesa_id)"
      )
      .eq("status", "confirmada")
      .lt("data_reserva", format(today, "yyyy-MM-dd"))
      .order("data_reserva", { ascending: false })
      .limit(50),
  ]);

  const areas = (areasRes.data ?? []) as Area[];
  const mesas = (mesasRes.data ?? []) as Mesa[];
  const reservas = (listRes.data ?? []) as Reserva[];
  const pendentes = (pendentesRes.data ?? []) as Reserva[];
  const semana = (semanaRes.data ?? []) as {
    data_reserva: string;
    periodo: string;
    qtd_pessoas: number;
  }[];

  const mesasPorArea = mesas.reduce<
    Record<string, { id: number; nome: string; capacidade: number }[]>
  >((acc, m) => {
    if (!acc[m.area_codigo]) acc[m.area_codigo] = [];
    acc[m.area_codigo].push({
      id: m.id,
      nome: m.nome,
      capacidade: m.capacidade,
    });
    return acc;
  }, {});

  const areaNome = (codigo: string) =>
    areas.find((a) => a.codigo === codigo)?.nome ?? codigo;

  const mesasDaReserva = (r: Reserva) => {
    const ids = (r.reservas_mesas ?? []).map((rm) => rm.mesa_id);
    if (ids.length === 0) return null;
    return ids
      .map((id) => mesas.find((m) => m.id === id)?.nome ?? `#${id}`)
      .join(", ");
  };

  const totalPessoas = reservas.reduce((s, r) => s + (r.qtd_pessoas ?? 0), 0);

  const listaLabel =
    effectivePeriodo === "almoco"
      ? "Almoço"
      : effectivePeriodo === "jantar"
        ? "Jantar"
        : "Lista do dia";

  return (
    <>
      <RealtimeListener />

      <PageHeader
        title="Reservas"
        subtitle={format(refDate, "EEEE, dd 'de' MMMM 'de' yyyy", {
          locale: ptBR,
        })}
        actions={
          <NovaReservaDialog
            areas={areas}
            mesasPorArea={mesasPorArea}
            defaultData={filterDate}
          />
        }
      />

      {pendentes.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Pendentes de marcação
            </CardTitle>
            <Badge variant="warning">{pendentes.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Reservas passadas que ainda não foram marcadas. Marque cada uma como
              compareceu, não veio ou cancelou.
            </p>
            <DoorList
              reservas={pendentes.map((r) => ({
                id: r.id,
                hora: formatHora(r.horario),
                cliente_nome: r.cliente_nome,
                qtd_pessoas: r.qtd_pessoas,
                area: areaNome(r.area_codigo),
                mesa: mesasDaReserva(r),
                status: r.status,
                data: format(new Date(r.data_reserva + "T00:00:00"), "EEE, dd/MM", {
                  locale: ptBR,
                }),
              }))}
            />
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardContent className="p-4">
            <Filters areas={areas} />
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" />
              Semana de {format(weekStart, "dd/MM", { locale: ptBR })} a{" "}
              {format(weekEnd, "dd/MM", { locale: ptBR })}
            </CardTitle>
            <WeekNav weekStart={format(weekStart, "yyyy-MM-dd")} />
          </CardHeader>
          <CardContent>
            <WeeklyGrid weekRef={refDate} reservas={semana} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              {listaLabel}
            </CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                {reservas.length} reserva{reservas.length === 1 ? "" : "s"}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {totalPessoas} pessoas
              </span>
            </div>
          </div>
          <ServiceTabs active={effectivePeriodo} />
        </CardHeader>
        <CardContent className={isAdmin ? "p-0" : "p-4"}>
          {!isAdmin ? (
            <DoorList
              reservas={reservas.map((r) => ({
                id: r.id,
                hora: formatHora(r.horario),
                cliente_nome: r.cliente_nome,
                qtd_pessoas: r.qtd_pessoas,
                area: areaNome(r.area_codigo),
                mesa: mesasDaReserva(r),
                status: r.status,
              }))}
            />
          ) : reservas.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Nenhuma reserva encontrada para os filtros atuais.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && <TableHead className="w-16">Hora</TableHead>}
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Mesa</TableHead>
                  <TableHead className="w-16 text-right">Pess.</TableHead>
                  <TableHead className="w-24">Período</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservas.map((r) => {
                  const mesa = mesasDaReserva(r);
                  return (
                    <TableRow key={r.id}>
                      {isAdmin && (
                        <TableCell className="font-mono text-primary">
                          {formatHora(r.horario)}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm">{r.cliente_nome}</p>
                          {r.cliente_email && (
                            <p className="text-xs text-muted-foreground truncate max-w-[14rem]">
                              {r.cliente_email}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatPhone(r.cliente_telefone)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {areaNome(r.area_codigo)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {mesa ? (
                          <span className="font-mono">{mesa}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.qtd_pessoas}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {periodoLabel[r.periodo] ?? r.periodo}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[r.status] ?? "outline"}>
                          {statusLabel[r.status] ?? r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <RowActions id={r.id} status={r.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
