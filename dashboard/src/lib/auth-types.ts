export type UserRole = "admin" | "user" | "admin_geral";

export function isAdminRole(role: UserRole | null) {
  return role === "admin" || role === "admin_geral";
}
