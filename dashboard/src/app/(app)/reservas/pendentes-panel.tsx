"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, ChevronDown, ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DoorList, type DoorReserva } from "./door-list";

interface PendentesPanelProps {
  periodo: number; // 7 | 30 | 90
  resumoColaboradores: { nome: string; marcadas: number }[];
  naoMarcadas: number;
  pendentes: DoorReserva[]; // pós-corte, o admin resolve
  legado: DoorReserva[]; // pré-corte, neutro
}

const PERIODOS = [7, 30, 90];

export function PendentesPanel({
  periodo,
  resumoColaboradores,
  naoMarcadas,
  pendentes,
  legado,
}: PendentesPanelProps) {
  const [verLegado, setVerLegado] = useState(false);

  return (
    <div className="space-y-4">
      {/* Resumo por colaborador */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" /> Marcação por colaborador
          </CardTitle>
          <div className="inline-flex rounded-md border border-border bg-background/40 p-1">
            {PERIODOS.map((p) => (
              <Link
                key={p}
                href={`/reservas?view=pendentes&pper=${p}`}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                  p === periodo
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p}d
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {resumoColaboradores.length === 0 && naoMarcadas === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nada no período selecionado.
            </p>
          ) : (
            <>
              {resumoColaboradores.map((c) => (
                <div
                  key={c.nome}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{c.nome}</span>
                  <span className="font-medium">{c.marcadas} marcadas</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                <span className="text-muted-foreground">
                  Não marcadas a tempo
                  <span className="ml-1 text-xs">(admin resolveu ou ainda aberto)</span>
                </span>
                <span
                  className={cn(
                    "font-semibold",
                    naoMarcadas > 0 ? "text-amber-500" : "text-emerald-500"
                  )}
                >
                  {naoMarcadas}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Lista pra resolver (pós-corte) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            A resolver
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {pendentes.length} pendente{pendentes.length === 1 ? "" : "s"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tudo marcado. 🎉
            </p>
          ) : (
            <DoorList reservas={pendentes} />
          )}
        </CardContent>
      </Card>

      {/* Legado (pré-corte), recolhido */}
      {legado.length > 0 && (
        <Card>
          <button
            type="button"
            onClick={() => setVerLegado((v) => !v)}
            className="flex w-full items-center justify-between px-6 py-4 text-left"
          >
            <span className="text-sm font-medium text-muted-foreground">
              Antigas (antes do sistema) · {legado.length}
            </span>
            {verLegado ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {verLegado && (
            <CardContent className="p-4 pt-0">
              <p className="mb-3 text-xs text-muted-foreground">
                Reservas de antes do go-live — não contam na análise do colaborador.
                Marque pra limpar quando quiser.
              </p>
              <DoorList reservas={legado} />
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
