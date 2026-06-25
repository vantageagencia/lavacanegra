import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Map,
  Settings,
  type LucideIcon,
} from "lucide-react";

import { isAdminRole, type UserRole } from "@/lib/auth-types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly: boolean;
}

// Menu enxuto: Ocupação vive como aba de "Visão geral" (/), Olivia como aba
// de "Clientes", e a exportação (antiga /relatorios) virou botão nas páginas.
export const NAV_ALL: NavItem[] = [
  { href: "/reservas", label: "Reservas", icon: CalendarDays, adminOnly: false },
  { href: "/planta", label: "Mapa de reservas", icon: Map, adminOnly: true },
  { href: "/", label: "Visão geral", icon: LayoutDashboard, adminOnly: true },
  { href: "/clientes", label: "Clientes", icon: Users, adminOnly: true },
  { href: "/gestao", label: "Gestão", icon: Settings, adminOnly: true },
];

export function getNavForRole(role: UserRole | null): NavItem[] {
  const isAdmin = isAdminRole(role);
  return NAV_ALL.filter((item) => !item.adminOnly || isAdmin);
}
