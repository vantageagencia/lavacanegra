import Link from "next/link";
import {
  Users,
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { SubNav } from "@/components/dashboard/sub-nav";
import { ExportButton } from "@/components/dashboard/export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users as UsersIcon, Bot } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPhone, formatBR } from "@/lib/format";

import { SearchInput } from "./search-input";

export const dynamic = "force-dynamic";

type Cliente360 = {
  jid: string;
  contato_id: number | null;
  user_name: string | null;
  nome_completo: string | null;
  email: string | null;
  contato_desde: string | null;
  total_reservas: number;
  reservas_concluidas: number;
  reservas_no_show: number;
  reservas_canceladas: number;
  ultima_visita: string | null;
  msgs_total: number;
  msgs_humano: number | null;
  msgs_ai: number | null;
};

type SP = Promise<{ q?: string; filter?: string }>;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("v_clientes_360")
    .select("*")
    .order("ultima_visita", { ascending: false, nullsFirst: false });

  if (params.q) {
    // Remove os delimitadores do PostgREST (, . ( ) * \) pra não quebrar/injetar
    // no filtro .or() — o termo entra só como conteúdo do ilike.
    const safe = params.q.replace(/[,.()*\\]/g, " ").trim();
    if (safe) {
      const term = `%${safe}%`;
      query = query.or(
        `user_name.ilike.${term},nome_completo.ilike.${term},jid.ilike.${term}`
      );
    }
  }

  const { data } = await query.limit(200);
  const clientes = (data ?? []) as Cliente360[];

  // KPIs do CRM
  const comReserva = clientes.filter((c) => c.total_reservas > 0).length;
  const semReserva = clientes.filter((c) => c.total_reservas === 0).length;
  const totalMsgs = clientes.reduce((s, c) => s + (c.msgs_total ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Visão 360° por número do WhatsApp"
        actions={
          <>
            <SubNav
              items={[
                { href: "/clientes", label: "Clientes", icon: UsersIcon },
                { href: "/olivia", label: "Olivia (IA)", icon: Bot },
              ]}
            />
            <ExportButton
              tipo="clientes"
              label="Exportar"
              defaultFrom={null}
              defaultTo={format(new Date(), "yyyy-MM-dd")}
            />
            <SearchInput />
          </>
        }
      />

      <section className="grid gap-4 grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="grid place-items-center h-9 w-9 rounded-full bg-primary/15 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Total
              </p>
              <p className="font-display text-2xl leading-none">
                {clientes.length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="grid place-items-center h-9 w-9 rounded-full bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Com reserva
              </p>
              <p className="font-display text-2xl leading-none">{comReserva}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="grid place-items-center h-9 w-9 rounded-full bg-muted text-muted-foreground">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Sem reserva
              </p>
              <p className="font-display text-2xl leading-none">{semReserva}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {totalMsgs} msgs trocadas
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lista de clientes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {clientes.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              {params.q
                ? `Nenhum cliente encontrado para "${params.q}".`
                : "Nenhum cliente cadastrado ainda."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="text-center">Reservas</TableHead>
                  <TableHead>Última visita</TableHead>
                  <TableHead className="text-center">Msgs Olivia</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((c) => {
                  const nome =
                    c.nome_completo ||
                    c.user_name ||
                    formatPhone(c.jid);
                  return (
                    <TableRow key={c.jid}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <Link
                            href={`/clientes/${encodeURIComponent(c.jid)}`}
                            className="text-sm hover:text-primary hover:underline"
                          >
                            {nome}
                          </Link>
                          {c.contato_desde && (
                            <p className="text-[10px] text-muted-foreground">
                              desde{" "}
                              {formatBR(c.contato_desde, "dd/MM/yyyy")}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5 text-xs">
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {formatPhone(c.jid)}
                          </p>
                          {c.email && (
                            <p className="flex items-center gap-1 text-muted-foreground truncate max-w-[12rem]">
                              <Mail className="h-3 w-3" />
                              {c.email}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {c.total_reservas === 0 ? (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <span className="font-display text-lg">
                              {c.total_reservas}
                            </span>
                            {c.reservas_no_show > 0 && (
                              <Badge variant="warning" className="text-[10px]">
                                {c.reservas_no_show} no-show
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.ultima_visita ? (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{formatBR(c.ultima_visita, "dd/MM/yy")}</span>
                            <span className="text-[10px]">
                              (
                              {formatDistanceToNow(
                                new Date(c.ultima_visita + "T00:00:00"),
                                { locale: ptBR, addSuffix: true }
                              )}
                              )
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                        {c.msgs_total > 0 ? c.msgs_total : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/clientes/${encodeURIComponent(c.jid)}`}
                          aria-label={`Ver ${nome}`}
                          className="inline-flex text-muted-foreground hover:text-primary"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
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
