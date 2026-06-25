"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Clock,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { atualizarStatusReserva, type ReservaStatus } from "./actions";

export interface DoorReserva {
  id: number;
  hora: string;
  cliente_nome: string;
  qtd_pessoas: number;
  area: string;
  mesa: string | null;
  status: ReservaStatus;
  /** Data formatada (ex.: "qua, 24/06") — exibida só em itens pendentes/passados. */
  data?: string;
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

// Cada ação pede confirmação num pop-up antes de aplicar (evita clique errado).
const ACOES: Record<
  "concluida" | "no_show" | "cancelada",
  { verbo: string; sucesso: (nome: string) => string }
> = {
  concluida: { verbo: "compareceu", sucesso: (n) => `${n} chegou` },
  no_show: { verbo: "não veio", sucesso: (n) => `${n} não veio` },
  cancelada: { verbo: "cancelou", sucesso: (n) => `${n}: reserva cancelada` },
};

function DoorCard({ reserva: r }: { reserva: DoorReserva }) {
  const [pending, startTransition] = useTransition();
  const [confirmar, setConfirmar] = useState<keyof typeof ACOES | null>(null);
  const router = useRouter();

  function aplicar(next: keyof typeof ACOES) {
    setConfirmar(null);
    startTransition(async () => {
      const res = await atualizarStatusReserva(r.id, next);
      if (res?.error) {
        toast.error("Não foi possível marcar", { description: res.error });
        // Reserva pode ter expirado com a tela aberta → atualiza pra refletir.
        router.refresh();
      } else {
        toast.success(ACOES[next].sucesso(r.cliente_nome));
      }
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
              {r.data && (
                <>
                  <span className="font-medium text-foreground/70">{r.data}</span>
                  <span>·</span>
                </>
              )}
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
            onClick={() => setConfirmar("concluida")}
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
            onClick={() => setConfirmar("no_show")}
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
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmar("cancelada")}
            className="col-span-2 flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <XCircle className="h-3.5 w-3.5" /> Cancelou
          </button>
        </div>
      )}

      <Dialog open={confirmar !== null} onOpenChange={(o) => !o && setConfirmar(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar marcação</DialogTitle>
          </DialogHeader>
          {confirmar && (
            <p className="text-sm text-muted-foreground">
              Marcar que <span className="font-medium text-foreground">{r.cliente_nome}</span>{" "}
              <span className="font-medium text-foreground">{ACOES[confirmar].verbo}</span>?
              {r.hora && (
                <>
                  {" "}
                  <span className="text-xs">({r.hora}{r.data ? ` · ${r.data}` : ""})</span>
                </>
              )}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirmar(null)}>
              Voltar
            </Button>
            <Button onClick={() => confirmar && aplicar(confirmar)}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
