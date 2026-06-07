"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, X, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand/brand-mark";
import { type UserRole } from "@/lib/auth-types";
import { getNavForRole } from "./nav-items";

interface MobileNavProps {
  role: UserRole | null;
}

export function MobileNav({ role }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const nav = getNavForRole(role);

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label="Abrir menu"
        className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Menu className="h-5 w-5" />
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out md:hidden"
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[85vw] flex-col gap-6 border-r border-sidebar-border bg-sidebar px-4 py-6 shadow-2xl",
            "data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out",
            "md:hidden"
          )}
        >
          <DialogPrimitive.Title className="sr-only">Menu de navegação</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Acessa as áreas do painel.
          </DialogPrimitive.Description>

          <div className="flex items-center justify-between px-2">
            <BrandMark variant="full" width={72} />
            <DialogPrimitive.Close
              aria-label="Fechar menu"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
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
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
