"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Utensils, Moon, Sun, Users, Calendar } from "lucide-react";

import { cn } from "@/lib/utils";

interface Totals {
  all: { reservas: number; pessoas: number };
  almoco: { reservas: number; pessoas: number };
  jantar: { reservas: number; pessoas: number };
}

interface PeriodTabsProps {
  active: "almoco" | "jantar" | "all";
  totals: Totals;
}

export function PeriodTabs({ active, totals }: PeriodTabsProps) {
  const router = useRouter();
  const params = useSearchParams();

  const select = useCallback(
    (value: "almoco" | "jantar" | "all") => {
      const next = new URLSearchParams(params.toString());
      if (value === "all") next.delete("periodo");
      else next.set("periodo", value);
      router.replace(`/planta?${next.toString()}`, { scroll: false });
    },
    [params, router]
  );

  const cards: {
    value: "all" | "almoco" | "jantar";
    label: string;
    icon: typeof Calendar;
    data: { reservas: number; pessoas: number };
  }[] = [
    { value: "all", label: "Dia todo", icon: Sun, data: totals.all },
    { value: "almoco", label: "Almoço", icon: Utensils, data: totals.almoco },
    { value: "jantar", label: "Jantar", icon: Moon, data: totals.jantar },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {cards.map(({ value, label, icon: Icon, data }) => {
        const isActive = active === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => select(value)}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors min-h-[88px] flex flex-col justify-between",
              isActive
                ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                : "border-border bg-card hover:border-primary/30"
            )}
          >
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">
              <Icon
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span className="truncate">{label}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  "font-display text-2xl sm:text-3xl tabular-nums",
                  isActive ? "text-primary" : "text-foreground"
                )}
              >
                {data.reservas}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                <Users className="h-3 w-3" />
                {data.pessoas}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {data.reservas === 1 ? "reserva" : "reservas"}
            </div>
          </button>
        );
      })}
    </div>
  );
}
