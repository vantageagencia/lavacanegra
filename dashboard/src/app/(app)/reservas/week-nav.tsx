"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

interface WeekNavProps {
  weekStart: string;
}

export function WeekNav({ weekStart }: WeekNavProps) {
  const router = useRouter();
  const params = useSearchParams();

  const go = useCallback(
    (deltaDays: number) => {
      const start = new Date(weekStart + "T00:00:00");
      const target = format(addDays(start, deltaDays), "yyyy-MM-dd");
      const next = new URLSearchParams(params.toString());
      next.set("data", target);
      router.replace(`/reservas?${next.toString()}`, { scroll: false });
    },
    [params, router, weekStart]
  );

  const today = useCallback(() => {
    const t = format(new Date(), "yyyy-MM-dd");
    const next = new URLSearchParams(params.toString());
    next.set("data", t);
    router.replace(`/reservas?${next.toString()}`, { scroll: false });
  }, [params, router]);

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => go(-7)}
        aria-label="Semana anterior"
        className="h-8 w-8"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={today}
        className="h-8 px-3"
      >
        Hoje
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => go(7)}
        aria-label="Próxima semana"
        className="h-8 w-8"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
