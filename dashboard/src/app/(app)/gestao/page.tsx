import { Settings, MapPin, Users, Lock, Trash2, UserCircle2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, type UserRole } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddColaboradorDialog } from "@/components/dashboard/add-colaborador-dialog";

import { NovaMesaForm } from "./nova-mesa-form";
import { deletarMesa } from "./actions";
import { removerColaborador } from "../colaboradores/actions";

export const dynamic = "force-dynamic";

type Area = {
  codigo: string;
  nome: string;
  capacidade_min: number;
  capacidade_max: number;
  evento_fechado: boolean;
  ativa: boolean;
  observacoes: string | null;
};

type Mesa = {
  id: number;
  area_codigo: string;
  nome: string;
  capacidade: number;
  tipo: string;
  ativa: boolean;
};

export default async function GestaoPage() {
  const role = await requireAdmin();
  const supabase = await createClient();
  const canCreateAdmin = role === "admin_geral";

  // Sessão atual (pra esconder o botão "remover" da própria linha)
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  // Lista de colaboradores via admin client (precisa do service_role)
  type Colaborador = {
    id: string;
    email: string;
    nome: string;
    role: UserRole;
  };
  let colaboradores: Colaborador[] = [];
  let colaboradoresErro: string | null = null;
  try {
    const admin = createAdminClient();
    const [rolesRes, usersRes] = await Promise.all([
      admin.from("user_roles").select("user_id, role"),
      admin.auth.admin.listUsers(),
    ]);
    const rolesMap = new Map<string, UserRole>(
      ((rolesRes.data ?? []) as { user_id: string; role: UserRole }[]).map((r) => [
        r.user_id,
        r.role,
      ])
    );
    colaboradores = (usersRes.data?.users ?? [])
      .filter((u) => rolesMap.has(u.id))
      .map((u) => ({
        id: u.id,
        email: u.email ?? "",
        nome: (u.user_metadata?.nome as string | undefined) ?? "",
        role: rolesMap.get(u.id)!,
      }))
      .sort((a, b) => {
        // admin_geral primeiro, depois admin, depois user; dentro de cada grupo, por nome
        const order = { admin_geral: 0, admin: 1, user: 2 } as const;
        if (order[a.role] !== order[b.role]) return order[a.role] - order[b.role];
        return (a.nome || a.email).localeCompare(b.nome || b.email);
      });
  } catch (e) {
    colaboradoresErro =
      e instanceof Error ? e.message : "Erro ao listar colaboradores.";
  }

  const roleLabel: Record<UserRole, { label: string; variant: "default" | "warning" | "outline" }> = {
    admin_geral: { label: "Admin geral", variant: "warning" },
    admin: { label: "Administrador", variant: "default" },
    user: { label: "Colaborador", variant: "outline" },
  };

  const [areasRes, mesasRes] = await Promise.all([
    supabase
      .from("areas")
      .select("*")
      .order("ativa", { ascending: false })
      .order("nome"),
    supabase.from("mesas").select("*").order("area_codigo").order("nome"),
  ]);

  const areas = (areasRes.data ?? []) as Area[];
  const mesas = (mesasRes.data ?? []) as Mesa[];

  const areasAtivas = areas.filter((a) => a.ativa);
  const mesasPorArea = new Map<string, Mesa[]>();
  mesas.forEach((m) => {
    if (!mesasPorArea.has(m.area_codigo)) mesasPorArea.set(m.area_codigo, []);
    mesasPorArea.get(m.area_codigo)!.push(m);
  });

  return (
    <>
      <PageHeader
        title="Gestão"
        subtitle="Áreas, mesas e configurações operacionais"
      />

      {/* COLABORADORES */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCircle2 className="h-4 w-4 text-primary" /> Colaboradores
            <span className="text-xs text-muted-foreground ml-2 font-normal normal-case tracking-normal">
              ({colaboradores.length} {colaboradores.length === 1 ? "conta" : "contas"})
            </span>
          </CardTitle>
          <AddColaboradorDialog canCreateAdmin={canCreateAdmin} />
        </CardHeader>
        <CardContent className="p-0">
          {colaboradoresErro ? (
            <p className="px-6 pb-6 text-sm text-destructive">
              Erro ao listar: {colaboradoresErro}
            </p>
          ) : colaboradores.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Nenhum colaborador cadastrado ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead className="w-16 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {colaboradores.map((c) => {
                  const isSelf = currentUser?.id === c.id;
                  const isAdminGeral = c.role === "admin_geral";
                  const canRemoveTarget =
                    !isSelf && !isAdminGeral && (c.role !== "admin" || canCreateAdmin);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <span className="text-sm">
                          {c.nome || "—"}
                          {isSelf && (
                            <span className="text-[10px] text-muted-foreground ml-2 uppercase tracking-wider">
                              (você)
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={roleLabel[c.role].variant}>
                          {roleLabel[c.role].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canRemoveTarget && (
                          <form
                            action={async () => {
                              "use server";
                              await removerColaborador(c.id);
                            }}
                          >
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-label={`Remover ${c.email}`}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </form>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {!canCreateAdmin && (
            <p className="px-6 py-3 text-[11px] text-muted-foreground border-t border-border">
              Apenas o admin geral pode criar ou remover outros administradores.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ÁREAS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Áreas do salão
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="text-center">Capacidade</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areas.map((a) => (
                <TableRow key={a.codigo}>
                  <TableCell>
                    <span className="font-display tracking-wide">
                      {a.nome}
                    </span>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs text-muted-foreground">
                      {a.codigo}
                    </code>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {a.capacidade_min} – {a.capacidade_max} lugares
                  </TableCell>
                  <TableCell>
                    {a.evento_fechado ? (
                      <Badge variant="warning">
                        <Lock className="h-3 w-3" /> Evento fechado
                      </Badge>
                    ) : (
                      <Badge variant="outline">Aberta ao público</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {a.ativa ? (
                      <Badge variant="success">Ativa</Badge>
                    ) : (
                      <Badge variant="secondary">Inativa</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MESAS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" /> Mesas cadastradas
            <span className="text-xs text-muted-foreground ml-2 font-normal normal-case tracking-normal">
              ({mesas.length} mesas no total)
            </span>
          </CardTitle>
          <NovaMesaForm areas={areasAtivas} />
        </CardHeader>
        <CardContent>
          {mesas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma mesa cadastrada ainda. Use <span className="text-primary">Nova mesa</span> para
              começar a montar a planta baixa.
            </p>
          ) : (
            <div className="space-y-6">
              {Array.from(mesasPorArea.entries()).map(([codigo, lista]) => {
                const area = areas.find((a) => a.codigo === codigo);
                const totalLugares = lista.reduce(
                  (s, m) => s + m.capacidade,
                  0
                );
                return (
                  <div key={codigo}>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-display tracking-wide">
                        {area?.nome ?? codigo}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {lista.length} mesas · {totalLugares} lugares
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {lista.map((m) => (
                        <div
                          key={m.id}
                          className="border border-border rounded-md p-3 bg-card flex items-center justify-between gap-2 group"
                        >
                          <div>
                            <p className="font-display text-base tracking-wide">
                              {m.nome}
                            </p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Users className="h-2.5 w-2.5" /> {m.capacidade}{" "}
                              · {m.tipo}
                            </p>
                          </div>
                          <form action={async () => {
                            "use server";
                            await deletarMesa(m.id);
                          }}>
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </form>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
