"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand/brand-mark";
import { type UserRole } from "@/lib/auth-types";
import { getNavForRole } from "./nav-items";

interface SidebarProps {
  role: UserRole | null;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const nav = getNavForRole(role);

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar px-4 py-6">
      <div className="px-2 flex justify-center">
        <BrandMark variant="full" width={96} />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-2 space-y-1">
        {role && (
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            <span>{role.replace("_", " ")}</span>
          </div>
        )}
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          v0.1 · {new Date().getFullYear()}
        </div>
      </div>
    </aside>
  );
}
