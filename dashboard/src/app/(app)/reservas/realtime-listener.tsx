"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

/**
 * Escuta INSERTs em `reservas` e dispara toast + refresh da página atual.
 * Roda enquanto o usuário está na rota /reservas.
 */
export function RealtimeListener() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("reservas-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reservas" },
        (payload) => {
          const r = payload.new as {
            cliente_nome?: string;
            area_codigo?: string;
            qtd_pessoas?: number;
            horario?: string;
          };
          toast.success("Nova reserva!", {
            description: `${r.cliente_nome ?? "Cliente"} · ${r.area_codigo ?? "?"} · ${r.qtd_pessoas ?? "?"} pessoas às ${(
              r.horario ?? ""
            ).slice(0, 5)}`,
          });
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reservas" },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
