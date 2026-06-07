"use client";

import { useMemo, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

import { minPessoasMesa, minPessoasGrupo } from "@/lib/mesa-minimo";

import { criarReserva } from "./actions";

interface NovaReservaDialogProps {
  areas: { codigo: string; nome: string; evento_fechado: boolean }[];
  mesasPorArea: Record<string, { id: number; nome: string; capacidade: number }[]>;
  defaultData?: string;
  defaultAreaCodigo?: string;
  defaultMesaIds?: number[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function NovaReservaDialog({
  areas,
  mesasPorArea,
  defaultData,
  defaultAreaCodigo,
  defaultMesaIds,
  open: controlledOpen,
  onOpenChange,
  hideTrigger,
}: NovaReservaDialogProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? (controlledOpen as boolean) : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  const [pending, setPending] = useState(false);
  const [mesaId, setMesaId] = useState("");
  const [area, setArea] = useState(defaultAreaCodigo ?? areas[0]?.codigo ?? "");
  // Re-sync area se a prop defaultAreaCodigo mudar (clique em mesa de outra área)
  const [lastDefaultArea, setLastDefaultArea] = useState(defaultAreaCodigo);
  if (defaultAreaCodigo !== lastDefaultArea) {
    setLastDefaultArea(defaultAreaCodigo);
    if (defaultAreaCodigo) setArea(defaultAreaCodigo);
  }

  const mesas = useMemo(() => mesasPorArea[area] ?? [], [mesasPorArea, area]);
  const isVip = areas.find((a) => a.codigo === area)?.evento_fechado;

  // Mesas pré-selecionadas (grupo do mapa)
  const lockedMesaIds = useMemo(
    () => (defaultMesaIds && defaultMesaIds.length > 0 ? defaultMesaIds : null),
    [defaultMesaIds]
  );
  const lockedMesasNomes = useMemo(() => {
    if (!lockedMesaIds) return "";
    return lockedMesaIds
      .map((id) => mesas.find((m) => m.id === id)?.nome ?? `#${id}`)
      .join(" + ");
  }, [lockedMesaIds, mesas]);
  const lockedCapacidade = useMemo(() => {
    if (!lockedMesaIds) return null;
    return lockedMesaIds.reduce(
      (s, id) => s + (mesas.find((m) => m.id === id)?.capacidade ?? 0),
      0
    );
  }, [lockedMesaIds, mesas]);

  // ── Mínimo de pessoas exigido pela mesa/grupo selecionado ──────
  const selectedMesa = useMemo(
    () => mesas.find((m) => String(m.id) === mesaId) ?? null,
    [mesas, mesaId]
  );
  const minPessoas = useMemo(() => {
    if (lockedMesaIds) {
      const grp = lockedMesaIds
        .map((id) => mesas.find((m) => m.id === id))
        .filter((m): m is NonNullable<typeof m> => Boolean(m))
        .map((m) => ({
          capacidade: m.capacidade,
          area_codigo: area,
          evento_fechado: isVip,
        }));
      return minPessoasGrupo(grp);
    }
    if (selectedMesa) {
      return minPessoasMesa({
        capacidade: selectedMesa.capacidade,
        area_codigo: area,
        evento_fechado: isVip,
      });
    }
    return 1;
  }, [lockedMesaIds, selectedMesa, mesas, area, isVip]);

  const minMesaLabel = lockedMesaIds
    ? lockedMesasNomes
    : selectedMesa?.nome ?? "Esta mesa";

  async function onSubmit(formData: FormData) {
    const qtd = parseInt(String(formData.get("qtd_pessoas") ?? "0"), 10);
    if (minPessoas > 1 && qtd < minPessoas) {
      toast.error("Pessoas abaixo do mínimo da mesa", {
        description: `${minMesaLabel} aceita no mínimo ${minPessoas} pessoas.`,
      });
      return;
    }
    setPending(true);
    try {
      if (lockedMesaIds) {
        formData.set("mesa_ids", JSON.stringify(lockedMesaIds));
      }
      const res = await criarReserva(formData);
      if (res?.error) {
        toast.error("Erro ao criar reserva", { description: res.error });
        return;
      }
      toast.success("Reserva criada!");
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4" /> Nova reserva
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova reserva</DialogTitle>
          <DialogDescription>
            {lockedMesaIds
              ? `Reservando para ${lockedMesasNomes}`
              : "Cadastro manual — para reservas que chegam fora do WhatsApp."}
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="cliente_nome">Nome do cliente *</Label>
              <Input
                id="cliente_nome"
                name="cliente_nome"
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cliente_telefone">Telefone *</Label>
              <Input
                id="cliente_telefone"
                name="cliente_telefone"
                placeholder="92 9 9999-9999"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cliente_email">Email</Label>
              <Input
                id="cliente_email"
                name="cliente_email"
                type="email"
                placeholder="opcional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data_reserva">Data *</Label>
              <Input
                id="data_reserva"
                name="data_reserva"
                type="date"
                defaultValue={defaultData}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="horario">Horário *</Label>
              <Input
                id="horario"
                name="horario"
                type="time"
                defaultValue="19:30"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="periodo">Período</Label>
              <select
                id="periodo"
                name="periodo"
                defaultValue="jantar"
                className="h-9 w-full rounded-md border border-input px-2.5 text-sm"
              >
                <option value="almoco">Almoço</option>
                <option value="jantar">Jantar</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qtd_pessoas">Pessoas *</Label>
              <Input
                id="qtd_pessoas"
                name="qtd_pessoas"
                type="number"
                min={minPessoas}
                max="50"
                defaultValue={lockedCapacidade ?? 2}
                required
              />
              {minPessoas > 1 && (
                <p className="text-[11px] text-muted-foreground">
                  Mínimo {minPessoas} pessoas nesta mesa
                </p>
              )}
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="area_codigo">Área *</Label>
              <select
                id="area_codigo"
                name="area_codigo"
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  setMesaId("");
                }}
                className="h-9 w-full rounded-md border border-input px-2.5 text-sm"
                required
                disabled={!!lockedMesaIds}
              >
                {areas.map((a) => (
                  <option key={a.codigo} value={a.codigo}>
                    {a.nome}
                    {a.evento_fechado ? " · evento fechado" : ""}
                  </option>
                ))}
              </select>
            </div>
            {lockedMesaIds ? (
              <div className="space-y-1.5 col-span-2">
                <Label>Mesa(s)</Label>
                <div className="h-9 w-full rounded-md border border-input bg-background/40 px-2.5 text-sm flex items-center font-mono">
                  {lockedMesasNomes}
                  {lockedCapacidade !== null && (
                    <span className="ml-auto text-muted-foreground text-xs">
                      {lockedCapacidade} lugares
                    </span>
                  )}
                </div>
              </div>
            ) : (
              (isVip || mesas.length > 0) && (
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="mesa_id">
                    Mesa específica{" "}
                    {isVip
                      ? "(obrigatória para VIP/Tendas)"
                      : "(opcional)"}
                  </Label>
                  <select
                    id="mesa_id"
                    name="mesa_id"
                    className="h-9 w-full rounded-md border border-input px-2.5 text-sm"
                    required={isVip}
                    value={mesaId}
                    onChange={(e) => setMesaId(e.target.value)}
                  >
                    <option value="">
                      {isVip ? "— selecionar —" : "Sem mesa específica"}
                    </option>
                    {mesas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome} ({m.capacidade} lugares)
                      </option>
                    ))}
                  </select>
                </div>
              )
            )}
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="observacoes">Observações</Label>
              <textarea
                id="observacoes"
                name="observacoes"
                rows={2}
                className="w-full rounded-md border border-input bg-background/40 px-3 py-1.5 text-sm"
                placeholder="Aniversário, alergia, pedido especial..."
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin h-3.5 w-3.5" />}
              Salvar reserva
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
