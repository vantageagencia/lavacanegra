"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { CalendarDays, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FiltersProps {
  areas: { codigo: string; nome: string }[];
}

const SELECT_CLS =
  "h-9 rounded-md border border-input bg-background/60 px-2.5 text-sm " +
  "outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background";

export function Filters({ areas }: FiltersProps) {
  const router = useRouter();
  const params = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
      router.replace(`/reservas?${next.toString()}`, { scroll: false });
    },
    [params, router]
  );

  const data = params.get("data") ?? "";
  const area = params.get("area") ?? "all";
  const status = params.get("status") ?? "all";

  const hasFilters = data || area !== "all" || status !== "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarDays className="h-4 w-4" />
        <input
          type="date"
          value={data}
          onChange={(e) => update("data", e.target.value)}
          className={cn(SELECT_CLS, "[color-scheme:dark]")}
        />
      </label>

      <select
        value={area}
        onChange={(e) => update("area", e.target.value)}
        className={SELECT_CLS}
        aria-label="Área"
      >
        <option value="all">Área: todas</option>
        {areas.map((a) => (
          <option key={a.codigo} value={a.codigo}>
            {a.nome}
          </option>
        ))}
      </select>

      <select
        value={status}
        onChange={(e) => update("status", e.target.value)}
        className={SELECT_CLS}
        aria-label="Status"
      >
        <option value="all">Status: todos</option>
        <option value="confirmada">Confirmada</option>
        <option value="concluida">Compareceu</option>
        <option value="cancelada">Cancelada</option>
        <option value="no_show">Não veio</option>
      </select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.replace("/reservas", { scroll: false })}
        >
          <X className="h-3.5 w-3.5" /> Limpar
        </Button>
      )}
    </div>
  );
}
