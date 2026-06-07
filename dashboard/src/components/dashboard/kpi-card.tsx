import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  icon?: LucideIcon;
  accent?: "primary" | "accent" | "muted";
}

export function KpiCard({
  label,
  value,
  hint,
  trend,
  icon: Icon,
  accent = "primary",
}: KpiCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <span
        className={cn(
          "absolute inset-x-0 top-0 h-px",
          accent === "primary" && "bg-gradient-to-r from-transparent via-primary/60 to-transparent",
          accent === "accent" && "bg-gradient-to-r from-transparent via-accent/60 to-transparent",
          accent === "muted" && "bg-gradient-to-r from-transparent via-muted-foreground/40 to-transparent"
        )}
      />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              {label}
            </p>
            <p className="font-display text-4xl leading-none tracking-wide">
              {value}
            </p>
          </div>
          {Icon && (
            <span
              className={cn(
                "grid place-items-center h-9 w-9 rounded-full",
                accent === "primary" && "bg-primary/10 text-primary",
                accent === "accent" && "bg-accent/15 text-accent",
                accent === "muted" && "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
          )}
        </div>
        {(hint || trend) && (
          <div className="mt-4 flex items-center justify-between text-xs">
            {hint && <span className="text-muted-foreground">{hint}</span>}
            {trend && (
              <span
                className={cn(
                  "flex items-center gap-1 font-medium",
                  trend.direction === "up" && "text-emerald-400",
                  trend.direction === "down" && "text-destructive",
                  trend.direction === "flat" && "text-muted-foreground"
                )}
              >
                {trend.direction === "up" && "▲"}
                {trend.direction === "down" && "▼"}
                {trend.direction === "flat" && "—"}
                {trend.label}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
