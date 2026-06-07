"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  subMonths,
  isValid,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Range = { from: Date; to: Date };

interface DateRangePickerProps {
  from: string;
  to: string;
  className?: string;
}

function fmt(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function labelOf(range: Range, today: Date): string {
  const thisMonth = { from: startOfMonth(today), to: today };
  const lastMonthStart = startOfMonth(subMonths(today, 1));
  const lastMonthEnd = endOfMonth(subMonths(today, 1));

  if (fmt(range.from) === fmt(thisMonth.from) && fmt(range.to) === fmt(thisMonth.to)) {
    return "Este mês";
  }
  if (fmt(range.from) === fmt(lastMonthStart) && fmt(range.to) === fmt(lastMonthEnd)) {
    return "Mês passado";
  }
  if (fmt(range.from) === fmt(range.to)) {
    return format(range.from, "dd 'de' MMM", { locale: ptBR });
  }
  return `${format(range.from, "dd/MM", { locale: ptBR })} — ${format(
    range.to,
    "dd/MM",
    { locale: ptBR }
  )}`;
}

export function DateRangePicker({ from, to, className }: DateRangePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const today = React.useMemo(() => new Date(), []);
  const current: Range = React.useMemo(() => {
    const f = parseISO(from);
    const t = parseISO(to);
    return {
      from: isValid(f) ? f : startOfMonth(today),
      to: isValid(t) ? t : today,
    };
  }, [from, to, today]);

  const [draftFrom, setDraftFrom] = React.useState(from);
  const [draftTo, setDraftTo] = React.useState(to);

  React.useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
  }, [from, to]);

  function apply(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams();
    params.set("from", nextFrom);
    params.set("to", nextTo);
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  function applyPreset(preset: "thisMonth" | "lastMonth") {
    if (preset === "thisMonth") {
      apply(fmt(startOfMonth(today)), fmt(today));
    } else {
      apply(fmt(startOfMonth(subMonths(today, 1))), fmt(endOfMonth(subMonths(today, 1))));
    }
  }

  function applyCustom() {
    const f = parseISO(draftFrom);
    const t = parseISO(draftTo);
    if (!isValid(f) || !isValid(t)) return;
    if (f > t) {
      apply(draftTo, draftFrom);
    } else {
      apply(draftFrom, draftTo);
    }
  }

  const triggerLabel = labelOf(current, today);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)}>
          <CalendarRange className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground tracking-wider uppercase">
            Atalhos
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("thisMonth")}
            >
              Este mês
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("lastMonth")}
            >
              Mês passado
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground tracking-wider uppercase">
            Período personalizado
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] text-muted-foreground">De</span>
              <input
                type="date"
                value={draftFrom}
                max={draftTo || undefined}
                onChange={(e) => setDraftFrom(e.target.value)}
                className="w-full h-8 rounded-md border border-border bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-muted-foreground">Até</span>
              <input
                type="date"
                value={draftTo}
                min={draftFrom || undefined}
                onChange={(e) => setDraftTo(e.target.value)}
                className="w-full h-8 rounded-md border border-border bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={applyCustom}
            disabled={!draftFrom || !draftTo}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
