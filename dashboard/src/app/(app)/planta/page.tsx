import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Map as MapIcon } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { AreaTabs } from "./area-tabs";
import { DateNav } from "./date-nav";
import { PeriodTabs } from "./period-tabs";
import { FloorPlan, type Mesa, type ReservaCard } from "./floor-plan";

export const dynamic = "force-dynamic";

type Area = {
  codigo: string;
  nome: string;
  capacidade_max: number;
  evento_fechado: boolean;
};

const AREA_CANVAS: Record<string, { w: number; h: number }> = {
  interna: { w: 500, h: 820 },
  externa: { w: 800, h: 620 },
  vip1: { w: 400, h: 280 },
  vip_container: { w: 400, h: 280 },
  tenda1: { w: 320, h: 200 },
  tenda2: { w: 320, h: 200 },
};

type SP = Promise<{ area?: string; data?: string; periodo?: string }>;

type ReservaJoin = {
  id: number;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string | null;
  horario: string;
  qtd_pessoas: number;
  status: string;
  periodo: string;
  area_codigo: string;
  observacoes: string | null;
};

type ReservaRow = {
  mesa_id: number;
  reservas: ReservaJoin | ReservaJoin[];
};

export default async function PlantaPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  await requireAdmin();
  const params = await searchParams;
  // Usa admin pra evitar surpresas com RLS — página é restrita a admin
  const supabase = createAdminClient();

  const today = format(new Date(), "yyyy-MM-dd");
  const filterDate = params.data ?? today;
  const periodoParam =
    params.periodo === "almoco" || params.periodo === "jantar"
      ? params.periodo
      : "all";

  const [areasRes, mesasRes, reservasMesasRes] = await Promise.all([
    supabase
      .from("areas")
      .select("codigo, nome, capacidade_max, evento_fechado")
      .eq("ativa", true)
      .order("nome"),
    supabase
      .from("mesas")
      .select("*")
      .eq("ativa", true)
      .order("nome"),
    supabase
      .from("reservas_mesas")
      .select(
        "mesa_id, reservas!inner(id, cliente_nome, cliente_telefone, cliente_email, horario, qtd_pessoas, status, periodo, area_codigo, observacoes)"
      )
      .eq("reservas.data_reserva", filterDate)
      .in("reservas.status", ["confirmada", "concluida"]),
  ]);

  const areas = (areasRes.data ?? []) as Area[];
  const todasMesas = (mesasRes.data ?? []) as Mesa[];
  const todasReservasMesas = (reservasMesasRes.data ?? []) as unknown as ReservaRow[];

  const currentCodigo = params.area ?? areas[0]?.codigo ?? "interna";
  const currentArea = areas.find((a) => a.codigo === currentCodigo);

  // Mesas da área atual
  const mesasArea = todasMesas.filter((m) => m.area_codigo === currentCodigo);

  // ── mapa mesa_id → reservas (lista, pode ter mais de uma no dia)
  // filtra por período se selecionado
  const reservasPorMesa = new Map<number, ReservaCard[]>();
  todasReservasMesas.forEach((rm) => {
    const r = Array.isArray(rm.reservas) ? rm.reservas[0] : rm.reservas;
    if (!r) return;
    if (periodoParam !== "all" && r.periodo !== periodoParam) return;
    if (r.area_codigo !== currentCodigo) return;
    const arr = reservasPorMesa.get(rm.mesa_id) ?? [];
    arr.push({
      id: r.id,
      cliente_nome: r.cliente_nome,
      cliente_telefone: r.cliente_telefone,
      cliente_email: r.cliente_email,
      horario: r.horario,
      qtd_pessoas: r.qtd_pessoas,
      observacoes: r.observacoes,
      periodo: r.periodo,
    });
    reservasPorMesa.set(rm.mesa_id, arr);
  });

  const mesas: Mesa[] = mesasArea.map((m) => {
    const reservas = reservasPorMesa.get(m.id) ?? [];
    const pessoas = reservas.reduce((s, r) => s + (r.qtd_pessoas ?? 0), 0);
    return {
      ...m,
      pessoas_reserva: pessoas,
      reservas,
    };
  });

  // ── totais por período (todas as áreas do dia) ───────────────
  // Conta UMA reserva por id (uma reserva com 2 mesas conta como 1)
  const seen = new Set<number>();
  const totals = { all: { reservas: 0, pessoas: 0 }, almoco: { reservas: 0, pessoas: 0 }, jantar: { reservas: 0, pessoas: 0 } };
  todasReservasMesas.forEach((rm) => {
    const r = Array.isArray(rm.reservas) ? rm.reservas[0] : rm.reservas;
    if (!r || seen.has(r.id)) return;
    seen.add(r.id);
    totals.all.reservas += 1;
    totals.all.pessoas += r.qtd_pessoas ?? 0;
    if (r.periodo === "almoco") {
      totals.almoco.reservas += 1;
      totals.almoco.pessoas += r.qtd_pessoas ?? 0;
    } else if (r.periodo === "jantar") {
      totals.jantar.reservas += 1;
      totals.jantar.pessoas += r.qtd_pessoas ?? 0;
    }
  });

  // ── mesasPorArea pra NovaReservaDialog (todas as áreas)
  const mesasPorArea = todasMesas.reduce<
    Record<string, { id: number; nome: string; capacidade: number }[]>
  >((acc, m) => {
    if (!acc[m.area_codigo]) acc[m.area_codigo] = [];
    acc[m.area_codigo].push({ id: m.id, nome: m.nome, capacidade: m.capacidade });
    return acc;
  }, {});

  const refDate = new Date(filterDate + "T00:00:00");
  const dateSubtitle = format(refDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <>
      <PageHeader
        title="Mapa de reservas"
        subtitle={dateSubtitle}
        actions={<DateNav data={filterDate} />}
      />

      <PeriodTabs active={periodoParam} totals={totals} />

      <AreaTabs areas={areas} />

      {currentArea && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapIcon className="h-4 w-4 text-primary" />
              {currentArea.nome}
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              Capacidade total:{" "}
              <span className="text-foreground font-medium">
                {currentArea.capacidade_max} lugares
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <FloorPlan
              mesas={mesas}
              width={AREA_CANVAS[currentCodigo]?.w ?? 800}
              height={AREA_CANVAS[currentCodigo]?.h ?? 500}
              areaCodigo={currentCodigo}
              data={filterDate}
              areas={areas}
              mesasPorArea={mesasPorArea}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
