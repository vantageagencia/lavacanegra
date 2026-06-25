"use client";

import { useTransition } from "react";
import { CheckCircle2, AlertTriangle, Loader2, Clock, Users } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { atualizarStatusReserva, type ReservaStatus } from "./actions";

export interface DoorReserva {
  id: number;
  hora: string;
  cliente_nome: string;
  qtd_pessoas: number;
  area: string;
  mesa: string | null;
  status: ReservaStatus;
}

const STATUS_LABEL: Record<ReservaStatus, string> = {
  confirmada: "Aguardando",
  concluida: "Chegou",
  no_show: "Não veio",
  cancelada: "Cancelada",
};

/**
 * Modo porta — lista do dia otimizada pra toque (tablet/celular no balcão).
 * Cada reserva é um card com botões grandes Chegou / Não veio.
 */
export function DoorList({ reservas }: { reservas: DoorReserva[] }) {
  if (reservas.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
        Nenhuma reserva para hoje ainda.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reservas.map((r) => (
        <DoorCard key={r.id} reserva={r} />
      ))}
    </div>
  );
}

function DoorCard({ reserva: r }: { reserva: DoorReserva }) {
  const [pending, startTransition] = useTransition();

  function setStatus(next: ReservaStatus, label: string) {
    startTransition(async () => {
      const res = await atualizarStatusReserva(r.id, next);
      if (res?.error) toast.error("Erro", { description: res.error });
      else toast.success(label);
    });
  }

  const chegou = r.status === "concluida";
  const naoVeio = r.status === "no_show";
  const cancelada = r.status === "cancelada";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition-colors",
        chegou && "border-emerald-500/40 bg-emerald-500/5",
        naoVeio && "border-amber-500/40 bg-amber-500/5",
        cancelada && "border-border opacity-60"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 font-mono text-lg font-semibold text-primary tabular-nums">
            <Clock className="h-4 w-4" />
            {r.hora}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-medium leading-tight">
              {r.cliente_nome}
            </p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" /> {r.qtd_pessoas}
              </span>
              <span>·</span>
              <span>{r.area}</span>
              {r.mesa && (
                <>
                  <span>·</span>
                  <span className="font-mono">{r.mesa}</span>
                </>
              )}
            </p>
          </div>
        </div>
        {(chegou || naoVeio || cancelada) && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
              chegou && "bg-emerald-500/15 text-emerald-400",
              naoVeio && "bg-amber-500/15 text-amber-400",
              cancelada && "bg-muted text-muted-foreground"
            )}
          >
            {STATUS_LABEL[r.status]}
          </span>
        )}
      </div>

      {!cancelada && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus("concluida", `${r.cliente_nome} chegou`)}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50",
              chegou
                ? "bg-emerald-600 text-white"
                : "border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
            )}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Chegou
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus("no_show", `${r.cliente_nome} não veio`)}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50",
              naoVeio
                ? "bg-amber-600 text-white"
                : "border border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
            )}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            Não veio
          </button>
        </div>
      )}
    </div>
  );
}
