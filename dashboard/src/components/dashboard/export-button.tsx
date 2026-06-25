"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { DownloadForm } from "./download-form";

interface ExportButtonProps {
  /** Tipo do relatório na rota /api/relatorios/[tipo] */
  tipo: string;
  /** Rótulo do botão (ex.: "Exportar reservas") */
  label?: string;
  /** Início do período (null = sem seletor de data, exporta tudo) */
  defaultFrom: string | null;
  /** Fim do período */
  defaultTo: string;
}

/**
 * Botão "Exportar" que abre um popover com a geração de CSV/PDF.
 * Substitui a antiga página /relatorios — exportação fica junto do dado.
 */
export function ExportButton({
  tipo,
  label = "Exportar",
  defaultFrom,
  defaultTo,
}: ExportButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-3.5 w-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="mb-3 text-xs text-muted-foreground">
          Baixe em CSV (planilha) ou PDF (com a marca La Vaca Negra).
        </p>
        <DownloadForm tipo={tipo} defaultFrom={defaultFrom} defaultTo={defaultTo} />
      </PopoverContent>
    </Popover>
  );
}
