"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { History, CalendarRange } from "lucide-react";

import { cn } from "@/lib/utils";

const RANGES = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
];

const DIRECTIONS = [
  { value: "past", label: "Passado", icon: History },
  { value: "future", label: "Futuro", icon: CalendarRange },
];

export function RangePicker() {
  const router = useRouter();
  const params = useSearchParams();
  const currentRange = params.get("range") ?? "30";
  const currentDir = params.get("direction") ?? "past";

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.replace(`/ocupacao?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex rounded-md border border-border bg-card p-0.5">
        {DIRECTIONS.map(({ value, label, icon: Icon }) => {
          const active = currentDir === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => update("direction", value)}
              className={cn(
                "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      <div className="inline-flex rounded-md border border-border bg-card p-0.5">
        {RANGES.map((o) => {
          const active = currentRange === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => update("range", o.value)}
              className={cn(
                "rounded px-3 py-1.5 text-xs transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
