"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DateNavProps {
  data: string; // yyyy-MM-dd
}

export function DateNav({ data }: DateNavProps) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();

  const update = (newDate: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("data", newDate);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const shift = (days: number) => {
    const ref = new Date(data + "T00:00:00");
    update(format(addDays(ref, days), "yyyy-MM-dd"));
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={() => shift(-1)}
        aria-label="Dia anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <label className="flex items-center gap-1.5">
        <CalendarDays className="h-4 w-4 text-muted-foreground hidden sm:block" />
        <input
          type="date"
          value={data}
          onChange={(e) => update(e.target.value)}
          className={cn(
            "h-9 rounded-md border border-input bg-background/60 px-2.5 text-sm",
            "outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          )}
        />
      </label>
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={() => shift(1)}
        aria-label="Próximo dia"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
