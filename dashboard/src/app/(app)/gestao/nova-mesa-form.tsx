"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { criarMesa } from "./actions";

interface NovaMesaFormProps {
  areas: { codigo: string; nome: string }[];
}

export function NovaMesaForm({ areas }: NovaMesaFormProps) {
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      await criarMesa(formData);
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline" size="sm">
        <Plus className="h-3.5 w-3.5" /> Nova mesa
      </Button>
    );
  }

  return (
    <form
      action={onSubmit}
      className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 rounded-md border border-primary/30 bg-primary/5"
    >
      <div className="space-y-1">
        <Label htmlFor="area_codigo" className="text-[10px] uppercase">
          Área
        </Label>
        <select
          id="area_codigo"
          name="area_codigo"
          required
          className="h-9 w-full rounded-md border border-input bg-background/60 px-2 text-sm"
        >
          {areas.map((a) => (
            <option key={a.codigo} value={a.codigo}>
              {a.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="nome" className="text-[10px] uppercase">
          Nome
        </Label>
        <Input id="nome" name="nome" placeholder="M01" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="capacidade" className="text-[10px] uppercase">
          Capacidade
        </Label>
        <Input
          id="capacidade"
          name="capacidade"
          type="number"
          min="1"
          max="30"
          defaultValue={4}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tipo" className="text-[10px] uppercase">
          Tipo
        </Label>
        <select
          id="tipo"
          name="tipo"
          className="h-9 w-full rounded-md border border-input bg-background/60 px-2 text-sm"
        >
          <option value="regular">Regular</option>
          <option value="alta">Alta (bistrô)</option>
          <option value="redonda">Redonda</option>
          <option value="vip">VIP</option>
        </select>
      </div>
      <div className="flex items-end gap-1">
        <Button type="submit" disabled={pending} size="sm" className="flex-1">
          {pending && <Loader2 className="animate-spin h-3.5 w-3.5" />}
          Salvar
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          ✕
        </Button>
      </div>
    </form>
  );
}
