"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { salvarConfigMarcacao } from "./actions";

export function ConfigMarcacaoForm({
  janelaMin,
  corte,
}: {
  janelaMin: number;
  corte: string;
}) {
  const [janela, setJanela] = useState(String(janelaMin));
  const [dataCorte, setDataCorte] = useState(corte);
  const [pending, startTransition] = useTransition();

  function salvar() {
    startTransition(async () => {
      const res = await salvarConfigMarcacao(parseInt(janela, 10), dataCorte);
      if (res?.error) toast.error("Erro", { description: res.error });
      else toast.success("Configuração salva.");
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="space-y-1">
        <Label htmlFor="janela" className="text-[10px] uppercase">
          Janela de marcação (min)
        </Label>
        <Input
          id="janela"
          type="number"
          min="0"
          max="1440"
          value={janela}
          onChange={(e) => setJanela(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground">
          Tempo após o horário em que o colaborador ainda pode marcar.
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="corte" className="text-[10px] uppercase">
          Data de corte (go-live)
        </Label>
        <Input
          id="corte"
          type="date"
          value={dataCorte}
          onChange={(e) => setDataCorte(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground">
          A cobrança do colaborador só conta a partir desta data.
        </p>
      </div>
      <Button onClick={salvar} disabled={pending} className="sm:mb-6">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Salvar
      </Button>
    </div>
  );
}
