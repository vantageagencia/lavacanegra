"use client";

import { useRef, useState } from "react";
import { Download, FileType, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface DownloadFormProps {
  tipo: string;
  defaultFrom: string | null;
  defaultTo: string;
}

export function DownloadForm({ tipo, defaultFrom, defaultTo }: DownloadFormProps) {
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState<"csv" | "pdf" | null>(null);

  async function download(formato: "csv" | "pdf") {
    setDownloading(formato);
    try {
      const sp = new URLSearchParams({ formato });
      if (fromRef.current?.value) sp.set("from", fromRef.current.value);
      if (toRef.current?.value) sp.set("to", toRef.current.value);

      const res = await fetch(`/api/relatorios/${tipo}?${sp.toString()}`);
      if (!res.ok) {
        alert("Erro ao gerar relatório");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Extrai filename do Content-Disposition
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `relatorio.${formato}`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-3">
      {defaultFrom !== null && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              De
            </label>
            <input
              ref={fromRef}
              type="date"
              defaultValue={defaultFrom}
              className="h-9 w-full rounded-md border border-input bg-background/60 px-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Até
            </label>
            <input
              ref={toRef}
              type="date"
              defaultValue={defaultTo}
              className="h-9 w-full rounded-md border border-input bg-background/60 px-2.5 text-sm"
            />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          onClick={() => download("csv")}
          disabled={downloading !== null}
          variant="outline"
          size="sm"
        >
          {downloading === "csv" ? (
            <Loader2 className="animate-spin h-3.5 w-3.5" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          CSV
        </Button>
        <Button
          type="button"
          onClick={() => download("pdf")}
          disabled={downloading !== null}
          size="sm"
        >
          {downloading === "pdf" ? (
            <Loader2 className="animate-spin h-3.5 w-3.5" />
          ) : (
            <FileType className="h-3.5 w-3.5" />
          )}
          PDF
        </Button>
      </div>
    </div>
  );
}
