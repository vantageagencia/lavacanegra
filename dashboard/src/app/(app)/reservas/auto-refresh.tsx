"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Atualiza a página em intervalo fixo. Usado no modo porta pra reservas que
 * passaram da janela sumirem sozinhas, sem o colaborador precisar recarregar.
 */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
