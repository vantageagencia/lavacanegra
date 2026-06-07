"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function toggleArea(codigo: string, ativa: boolean) {
  const supabase = await createClient();
  await supabase.from("areas").update({ ativa }).eq("codigo", codigo);
  revalidatePath("/gestao");
  revalidatePath("/planta");
}

export async function updateAreaCapacidade(
  codigo: string,
  min: number,
  max: number
) {
  const supabase = await createClient();
  await supabase
    .from("areas")
    .update({ capacidade_min: min, capacidade_max: max })
    .eq("codigo", codigo);
  revalidatePath("/gestao");
}

export async function criarMesa(formData: FormData) {
  const supabase = await createClient();
  const area_codigo = String(formData.get("area_codigo") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const capacidade = parseInt(String(formData.get("capacidade") ?? "4"), 10);
  const tipo = String(formData.get("tipo") ?? "regular");
  const shape = tipo === "redonda" ? "circle" : "rect";

  if (!area_codigo || !nome || capacidade <= 0) return;

  await supabase.from("mesas").insert({
    area_codigo,
    nome,
    capacidade,
    tipo,
    shape,
  });

  revalidatePath("/gestao");
  revalidatePath("/planta");
}

export async function deletarMesa(id: number) {
  const supabase = await createClient();
  await supabase.from("mesas").delete().eq("id", id);
  revalidatePath("/gestao");
  revalidatePath("/planta");
}
