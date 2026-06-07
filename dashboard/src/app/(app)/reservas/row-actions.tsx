"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MoreHorizontal,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  atualizarStatusReserva,
  deletarReserva,
  type ReservaStatus,
} from "./actions";

interface RowActionsProps {
  id: number;
  status: ReservaStatus;
}

export function RowActions({ id, status }: RowActionsProps) {
  const [pending, startTransition] = useTransition();
  const [confirmDel, setConfirmDel] = useState(false);

  function update(next: ReservaStatus, label: string) {
    startTransition(async () => {
      const res = await atualizarStatusReserva(id, next);
      if (res?.error) toast.error("Erro", { description: res.error });
      else toast.success(label);
    });
  }

  function del() {
    if (!confirmDel) {
      setConfirmDel(true);
      setTimeout(() => setConfirmDel(false), 3000);
      return;
    }
    startTransition(async () => {
      const res = await deletarReserva(id);
      if (res?.error) toast.error("Erro", { description: res.error });
      else toast.success("Reserva removida");
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={pending}>
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MoreHorizontal className="h-3.5 w-3.5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {status !== "concluida" && (
          <DropdownMenuItem
            onClick={() => update("concluida", "Marcada como compareceu")}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Compareceu
          </DropdownMenuItem>
        )}
        {status !== "no_show" && (
          <DropdownMenuItem
            onClick={() => update("no_show", "Marcada como não veio")}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Não veio
          </DropdownMenuItem>
        )}
        {status !== "cancelada" && (
          <DropdownMenuItem
            onClick={() => update("cancelada", "Reserva cancelada")}
          >
            <XCircle className="h-3.5 w-3.5 text-destructive" /> Cancelar
          </DropdownMenuItem>
        )}
        {status !== "confirmada" && (
          <DropdownMenuItem
            onClick={() => update("confirmada", "Reativada como confirmada")}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Reabrir
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={del}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {confirmDel ? "Confirmar exclusão?" : "Excluir"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
