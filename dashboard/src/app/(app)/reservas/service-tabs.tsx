"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Utensils, Moon, List } from "lucide-react";

import { cn } from "@/lib/utils";

interface ServiceTabsProps {
  active: "almoco" | "jantar" | "all";
}

const TABS = [
  { value: "almoco" as const, label: "Almoço", icon: Utensils },
  { value: "jantar" as const, label: "Jantar", icon: Moon },
  { value: "all" as const, label: "Lista do dia", icon: List },
];

export function ServiceTabs({ active }: ServiceTabsProps) {
  const router = useRouter();
  const params = useSearchParams();

  const select = useCallback(
    (value: "almoco" | "jantar" | "all") => {
      const next = new URLSearchParams(params.toString());
      next.set("periodo", value);
      router.replace(`/reservas?${next.toString()}`, { scroll: false });
    },
    [params, router]
  );

  return (
    <div className="inline-flex rounded-md border border-border bg-background/40 p-1">
      {TABS.map(({ value, label, icon: Icon }) => {
        const isActive = active === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => select(value)}
            className={cn(
              "flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
