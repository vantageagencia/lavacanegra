"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth";

type ActionResult = { ok?: true; error?: string };

export async function toggleArea(
  codigo: string,
  ativa: boolean
): Promise<ActionResult> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("areas")
    .update({ ativa })
    .eq("codigo", codigo);
  if (error) return { error: error.message };
  revalidatePath("/gestao");
  revalidatePath("/planta");
  return { ok: true };
}

export async function updateAreaCapacidade(
  codigo: string,
  min: number,
  max: number
): Promise<ActionResult> {
  await assertAdmin();
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0) {
    return { error: "Capacidades inválidas." };
  }
  if (min > max) {
    return { error: "A capacidade mínima não pode ser maior que a máxima." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("areas")
    .update({ capacidade_min: min, capacidade_max: max })
    .eq("codigo", codigo);
  if (error) return { error: error.message };
  revalidatePath("/gestao");
  return { ok: true };
}

export async function criarMesa(formData: FormData): Promise<ActionResult> {
  await assertAdmin();
  const supabase = await createClient();
  const area_codigo = String(formData.get("area_codigo") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const capacidade = parseInt(String(formData.get("capacidade") ?? "4"), 10);
  const tipo = String(formData.get("tipo") ?? "regular");
  const shape = tipo === "redonda" ? "circle" : "rect";

  if (!area_codigo || !nome || !Number.isFinite(capacidade) || capacidade <= 0) {
    return { error: "Preencha área, nome e capacidade válida." };
  }

  const { error } = await supabase.from("mesas").insert({
    area_codigo,
    nome,
    capacidade,
    tipo,
    shape,
  });
  if (error) return { error: error.message };

  revalidatePath("/gestao");
  revalidatePath("/planta");
  return { ok: true };
}

export async function deletarMesa(id: number): Promise<ActionResult> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("mesas").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/gestao");
  revalidatePath("/planta");
  return { ok: true };
}

/** Salva a config de marcação de presença (janela em minutos + data de corte). */
export async function salvarConfigMarcacao(
  janelaMin: number,
  corte: string
): Promise<ActionResult> {
  await assertAdmin();
  if (!Number.isFinite(janelaMin) || janelaMin < 0 || janelaMin > 1440) {
    return { error: "Janela inválida (use de 0 a 1440 minutos)." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(corte)) {
    return { error: "Data de corte inválida." };
  }
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("app_settings").upsert([
    { key: "marcacao_janela_min", value: String(janelaMin), updated_at: now },
    { key: "marcacao_corte", value: corte, updated_at: now },
  ]);
  if (error) return { error: error.message };
  revalidatePath("/gestao");
  revalidatePath("/reservas");
  return { ok: true };
}
