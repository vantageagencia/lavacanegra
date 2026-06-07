import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isAdminRole, type UserRole } from "@/lib/auth-types";

export { isAdminRole, USER_ALLOWED_PATHS, type UserRole } from "@/lib/auth-types";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getUserRole(): Promise<UserRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  return ((data as { role?: UserRole } | null)?.role ?? null) as UserRole | null;
}

/** Bloqueia o acesso e redireciona pra /reservas se o usuário não for admin. */
export async function requireAdmin() {
  const role = await getUserRole();
  if (!isAdminRole(role)) {
    redirect("/reservas");
  }
  return role;
}
