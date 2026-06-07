import {
  LayoutDashboard,
  CalendarDays,
  BarChart3,
  Bot,
  Users,
  Map,
  Settings,
  FileText,
  type LucideIcon,
} from "lucide-react";

import { isAdminRole, type UserRole } from "@/lib/auth-types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly: boolean;
}

export const NAV_ALL: NavItem[] = [
  { href: "/planta", label: "Mapa de reservas", icon: Map, adminOnly: true },
  { href: "/", label: "Overview", icon: LayoutDashboard, adminOnly: true },
  { href: "/reservas", label: "Reservas", icon: CalendarDays, adminOnly: false },
  { href: "/ocupacao", label: "Ocupação", icon: BarChart3, adminOnly: true },
  { href: "/olivia", label: "Olivia (IA)", icon: Bot, adminOnly: true },
  { href: "/clientes", label: "Clientes", icon: Users, adminOnly: true },
  { href: "/gestao", label: "Gestão", icon: Settings, adminOnly: true },
  { href: "/relatorios", label: "Relatórios", icon: FileText, adminOnly: true },
];

export function getNavForRole(role: UserRole | null): NavItem[] {
  const isAdmin = isAdminRole(role);
  return NAV_ALL.filter((item) => !item.adminOnly || isAdmin);
}
