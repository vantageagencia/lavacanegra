"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Escuta INSERTs/UPDATEs em `reservas` e dispara toast + refresh.
 * O cliente Supabase (@supabase/supabase-js, pesado) é carregado via import()
 * dinâmico dentro do effect — fica fora do bundle inicial da /reservas, já que
 * o realtime não é crítico pro primeiro paint.
 */
export function RealtimeListener() {
  const router = useRouter();

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      if (cancelled) return;

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

      cleanup = () => {
        supabase.removeChannel(channel);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [router]);

  return null;
}
