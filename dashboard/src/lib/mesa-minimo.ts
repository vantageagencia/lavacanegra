// Regra de mínimo de pessoas por mesa.
//
// - Mesas de áreas regulares (interna/externa): mínimo depende da capacidade.
// - Áreas de evento fechado (Tendas, Sala VIP, Container): a área inteira é
//   reservada num "banquete", então o mínimo é fixo por área.
//
// Valores definidos com o cliente (La Vaca Negra):
//   capacidade 4 → 2 · 5 → 3 · 6 → 3 · 7 → 4 · 8 → 5
//   Tenda 1/2 → 4 · Sala VIP / Banquete VIP → 12 · Banquete Container → 8

const MIN_POR_CAPACIDADE: Record<number, number> = {
  4: 2,
  5: 3,
  6: 3,
  7: 4,
  8: 5,
};

const MIN_POR_AREA_FECHADA: Record<string, number> = {
  tenda1: 4,
  tenda2: 4,
  vip1: 12, // Sala VIP / Banquete VIP
  vip_container: 8, // Banquete Container (em obra)
};

export interface MesaMinInput {
  capacidade: number;
  area_codigo: string;
  evento_fechado?: boolean;
}

export function minPessoasPorCapacidade(capacidade: number): number {
  return (
    MIN_POR_CAPACIDADE[capacidade] ?? Math.max(1, Math.ceil(capacidade / 2))
  );
}

/** Mínimo de pessoas para ocupar uma mesa específica. */
export function minPessoasMesa(mesa: MesaMinInput): number {
  const fixoArea = MIN_POR_AREA_FECHADA[mesa.area_codigo];
  if (fixoArea !== undefined) return fixoArea;
  if (mesa.evento_fechado) return 1; // área fechada sem regra específica
  return minPessoasPorCapacidade(mesa.capacidade);
}

/**
 * Mínimo para um grupo de mesas unidas. Usa o maior mínimo individual —
 * unir mesas é para grupos grandes, então respeita a maior exigência.
 */
export function minPessoasGrupo(mesas: MesaMinInput[]): number {
  if (mesas.length === 0) return 1;
  return Math.max(...mesas.map(minPessoasMesa));
}
