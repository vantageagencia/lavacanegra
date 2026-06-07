export type UserRole = "admin" | "user" | "admin_geral";

/** Páginas que o role `user` pode ver. Admin vê tudo. */
export const USER_ALLOWED_PATHS = ["/reservas", "/planta", "/clientes"];

export function isAdminRole(role: UserRole | null) {
  return role === "admin" || role === "admin_geral";
}
