import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Users,
  Clock,
  StickyNote,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatPhone,
  formatBR,
  formatHora,
  periodoLabel,
  statusLabel,
  statusVariant,
  type ReservaStatus,
} from "@/lib/format";

export const dynamic = "force-dynamic";

type MesaRef = { nome: string | null; area_codigo: string | null } | null;

type ReservaRow = {
  id: number;
  data_reserva: string;
  horario: string;
  periodo: string;
  area_codigo: string;
  qtd_pessoas: number;
  status: ReservaStatus;
  observacoes: string | null;
  reservas_mesas: { mesas: MesaRef | MesaRef[] }[] | null;
};

function mesaOf(rm: { mesas: MesaRef | MesaRef[] }): MesaRef {
  return Array.isArray(rm.mesas) ? rm.mesas[0] ?? null : rm.mesas;
}

type Cliente360 = {
  jid: string;
  user_name: string | null;
  nome_completo: string | null;
  email: string | null;
  contato_desde: string | null;
};

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const jid = decodeURIComponent(id);
  const supabase = await createClient();

  const todayStr = new Date().toISOString().slice(0, 10);

  const [clienteRes, reservasRes, areasRes] = await Promise.all([
    supabase
      .from("v_clientes_360")
      .select("jid, user_name, nome_completo, email, contato_desde")
      .eq("jid", jid)
      .maybeSingle(),
    supabase
      .from("reservas")
      .select(
        "id, data_reserva, horario, periodo, area_codigo, qtd_pessoas, status, observacoes, reservas_mesas(mesas(nome, area_codigo))"
      )
      .eq("cliente_telefone", jid)
      .order("data_reserva", { ascending: false })
      .order("horario", { ascending: false }),
    supabase.from("areas").select("codigo, nome"),
  ]);

  const cliente = clienteRes.data as Cliente360 | null;
  const reservas = (reservasRes.data ?? []) as unknown as ReservaRow[];

  // Cliente sem contato cadastrado nem reservas → 404
  if (!cliente && reservas.length === 0) notFound();

  const areaNomeMap = new Map<string, string>(
    ((areasRes.data ?? []) as { codigo: string; nome: string }[]).map((a) => [
      a.codigo,
      a.nome,
    ])
  );
  const areaNome = (codigo: string) => areaNomeMap.get(codigo) ?? codigo;

  const nome =
    cliente?.nome_completo || cliente?.user_name || formatPhone(jid);

  // ── Ativas (futuras confirmadas) vs passadas ──────────────
  const ativas = reservas.filter(
    (r) => r.status === "confirmada" && r.data_reserva >= todayStr
  );
  const passadas = reservas.filter(
    (r) => !(r.status === "confirmada" && r.data_reserva >= todayStr)
  );

  const compareceu = reservas.filter((r) => r.status === "concluida").length;
  const noShow = reservas.filter((r) => r.status === "no_show").length;

  // ── Lugares onde costuma ficar ────────────────────────────
  // Conta frequência de mesa e de área (ignora canceladas).
  const mesaFreq = new Map<string, number>();
  const areaFreq = new Map<string, number>();
  reservas
    .filter((r) => r.status !== "cancelada")
    .forEach((r) => {
      areaFreq.set(r.area_codigo, (areaFreq.get(r.area_codigo) ?? 0) + 1);
      (r.reservas_mesas ?? []).forEach((rm) => {
        const m = mesaOf(rm);
        if (m?.nome) mesaFreq.set(m.nome, (mesaFreq.get(m.nome) ?? 0) + 1);
      });
    });
  const topMesas = Array.from(mesaFreq.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const topAreas = Array.from(areaFreq.entries()).sort(
    ([, a], [, b]) => b - a
  );

  return (
    <>
      <PageHeader
        title={nome}
        subtitle={formatPhone(jid)}
        actions={
          <Link
            href="/clientes"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        }
      />

      {/* ── Resumo do contato ──────────────────────── */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Total de reservas
            </p>
            <p className="font-display text-2xl leading-none mt-1">
              {reservas.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Ativas
            </p>
            <p className="font-display text-2xl leading-none mt-1 text-primary">
              {ativas.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Compareceu
              </p>
              <p className="font-display text-2xl leading-none mt-1">
                {compareceu}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-amber-400 shrink-0" />
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Não veio
              </p>
              <p className="font-display text-2xl leading-none mt-1">
                {noShow}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {/* ── Contato + lugares ───────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5" /> {formatPhone(jid)}
              </p>
              {cliente?.email && (
                <p className="flex items-center gap-2 text-muted-foreground break-all">
                  <Mail className="h-3.5 w-3.5 shrink-0" /> {cliente.email}
                </p>
              )}
              {cliente?.contato_desde && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" /> Cliente desde{" "}
                  {formatBR(cliente.contato_desde, "dd/MM/yyyy")}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Onde costuma ficar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topAreas.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sem histórico de mesas ainda.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {topAreas.map(([codigo, n]) => (
                      <Badge key={codigo} variant="secondary">
                        {areaNome(codigo)} · {n}x
                      </Badge>
                    ))}
                  </div>
                  {topMesas.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                        Mesas preferidas
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {topMesas.map(([mesa, n]) => (
                          <span
                            key={mesa}
                            className="rounded-md border border-border bg-background/40 px-2 py-0.5 text-xs font-mono"
                          >
                            {mesa}
                            <span className="text-muted-foreground"> · {n}x</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Reservas (ativas + passadas) ────────── */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Reservas ativas
                <span className="text-xs font-normal text-muted-foreground">
                  ({ativas.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {ativas.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">
                  Nenhuma reserva ativa no momento.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {ativas.map((r) => (
                    <ReservaItem key={r.id} r={r} areaNome={areaNome} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" /> Reservas
                passadas
                <span className="text-xs font-normal text-muted-foreground">
                  ({passadas.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {passadas.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">
                  Sem reservas anteriores.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {passadas.map((r) => (
                    <ReservaItem key={r.id} r={r} areaNome={areaNome} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

function ReservaItem({
  r,
  areaNome,
}: {
  r: ReservaRow;
  areaNome: (codigo: string) => string;
}) {
  const mesas = (r.reservas_mesas ?? [])
    .map((rm) => mesaOf(rm)?.nome)
    .filter(Boolean)
    .join(" + ");
  return (
    <li className="flex items-center justify-between gap-4 px-6 py-3">
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex flex-col items-end shrink-0 w-16">
          <span className="font-mono text-sm">
            {formatBR(r.data_reserva, "dd/MM/yy")}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {formatHora(r.horario)}
          </span>
        </div>
        <div className="min-w-0 text-xs text-muted-foreground space-y-0.5">
          <p className="text-sm text-foreground">
            {areaNome(r.area_codigo)}
            {mesas && (
              <span className="font-mono text-primary ml-1.5">{mesas}</span>
            )}
          </p>
          <p className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" /> {r.qtd_pessoas}
            </span>
            <span>· {periodoLabel[r.periodo] ?? r.periodo}</span>
          </p>
          {r.observacoes && (
            <p className="flex items-start gap-1 italic">
              <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
              {r.observacoes}
            </p>
          )}
        </div>
      </div>
      <Badge variant={statusVariant[r.status] ?? "outline"}>
        {statusLabel[r.status] ?? r.status}
      </Badge>
    </li>
  );
}
