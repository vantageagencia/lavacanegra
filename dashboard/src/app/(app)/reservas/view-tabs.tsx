"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

/** Sub-aba do admin em Reservas: dia/semana × Pendentes (com contador). */
export function ViewTabs({ pendentesCount }: { pendentesCount: number }) {
  const sp = useSearchParams();
  const isPendentes = sp.get("view") === "pendentes";

  const tab = (active: boolean) =>
    cn(
      "flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
    );

  return (
    <div className="inline-flex rounded-md border border-border bg-background/40 p-1">
      <Link href="/reservas" className={tab(!isPendentes)}>
        <CalendarDays className="h-3.5 w-3.5" /> Reservas
      </Link>
      <Link href="/reservas?view=pendentes" className={tab(isPendentes)}>
        <AlertTriangle className="h-3.5 w-3.5" /> Pendentes
        {pendentesCount > 0 && (
          <span
            className={cn(
              "ml-1 rounded-full px-1.5 text-[10px] font-semibold",
              isPendentes
                ? "bg-primary-foreground/20"
                : "bg-amber-500/20 text-amber-500"
            )}
          >
            {pendentesCount}
          </span>
        )}
      </Link>
    </div>
  );
}
