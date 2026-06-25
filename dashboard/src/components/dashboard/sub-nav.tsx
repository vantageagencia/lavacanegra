"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SubNavItem {
  href: string;
  label: string;
  icon?: LucideIcon;
}

/**
 * Sub-navegação em abas (link real, preserva SSR/guards de cada rota).
 * Usada pra agrupar páginas no menu enxuto: Visão geral ⇄ Período,
 * Clientes ⇄ Olivia.
 */
export function SubNav({ items }: { items: SubNavItem[] }) {
  const pathname = usePathname();

  return (
    <div className="inline-flex rounded-md border border-border bg-background/40 p-1">
      {items.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {label}
          </Link>
        );
      })}
    </div>
  );
}
