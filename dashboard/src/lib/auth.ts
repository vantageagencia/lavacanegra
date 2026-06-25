import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isAdminRole, type UserRole } from "@/lib/auth-types";

export { isAdminRole, type UserRole } from "@/lib/auth-types";

// `cache()` deduplica por request: layout + página + guards compartilham
// o mesmo getUser()/role em vez de bater no Supabase Auth várias vezes.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getUserRole = cache(async (): Promise<UserRole | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  return ((data as { role?: UserRole } | null)?.role ?? null) as UserRole | null;
});

/**
 * Garante que há um usuário logado em server actions / route handlers.
 * Lança erro se não houver sessão — não depende só do proxy, já que actions
 * são endpoints POST invocáveis diretamente. Use em ações abertas a qualquer
 * usuário autenticado (ex.: gestão de reservas pelo colaborador da porta).
 */
export async function assertAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Não autorizado: faça login para continuar.");
  }
  return user;
}

/** Bloqueia o acesso e redireciona pra /reservas se o usuário não for admin. */
export async function requireAdmin() {
  const role = await getUserRole();
  if (!isAdminRole(role)) {
    redirect("/reservas");
  }
  return role;
}

/**
 * Garante admin em contextos sem redirect (server actions / route handlers):
 * lança erro se o caller não for admin. Defesa em profundidade — server actions
 * e rotas são invocáveis diretamente, independente do gating da página.
 */
export async function assertAdmin(): Promise<UserRole> {
  const role = await getUserRole();
  if (!isAdminRole(role)) {
    throw new Error("Não autorizado: ação restrita a administradores.");
  }
  return role;
}
