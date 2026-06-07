"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

interface AreaTabsProps {
  areas: { codigo: string; nome: string; capacidade_max: number }[];
}

export function AreaTabs({ areas }: AreaTabsProps) {
  const params = useSearchParams();
  const current = params.get("area") ?? areas[0]?.codigo;

  return (
    <div className="flex flex-wrap gap-1 border-b border-border pb-2">
      {areas.map((a) => {
        const active = current === a.codigo;
        const sp = new URLSearchParams(params.toString());
        sp.set("area", a.codigo);
        return (
          <Link
            key={a.codigo}
            href={`/planta?${sp.toString()}`}
            scroll={false}
            className={cn(
              "px-3 py-2 text-sm rounded-md transition-colors",
              active
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="font-display tracking-wider">{a.nome}</span>
            <span className="ml-2 text-[10px] opacity-70">
              {a.capacidade_max} lugares
            </span>
          </Link>
        );
      })}
    </div>
  );
}
