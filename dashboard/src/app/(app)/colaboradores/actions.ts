"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdminRole, type UserRole } from "@/lib/auth";

interface CriarColaboradorResult {
  ok?: true;
  error?: string;
}

export async function criarColaborador(
  formData: FormData
): Promise<CriarColaboradorResult> {
  const callerRole = await getUserRole();
  if (!isAdminRole(callerRole)) {
    return { error: "Apenas administradores podem criar colaboradores." };
  }

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const role = String(formData.get("role") ?? "user") as UserRole;

  if (!nome || !email || !senha) {
    return { error: "Preencha nome, email e senha." };
  }
  if (senha.length < 6) {
    return { error: "A senha precisa ter pelo menos 6 caracteres." };
  }
  if (!["admin", "user"].includes(role)) {
    return { error: "Role inválido." };
  }
  // Só admin_geral pode criar outros admins
  if (role === "admin" && callerRole !== "admin_geral") {
    return { error: "Apenas o admin geral pode criar outros admins." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Erro ao inicializar o cliente admin.",
    };
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });

  if (createErr || !created.user) {
    return {
      error: createErr?.message ?? "Não foi possível criar o usuário.",
    };
  }

  const { error: roleErr } = await admin.from("user_roles").insert({
    user_id: created.user.id,
    role,
  });

  if (roleErr) {
    // Tenta limpar o auth user pra não deixar resíduo
    await admin.auth.admin.deleteUser(created.user.id);
    return {
      error: `Usuário criado mas falhou ao atribuir role: ${roleErr.message}`,
    };
  }

  revalidatePath("/gestao");
  return { ok: true };
}

export async function removerColaborador(
  userId: string
): Promise<CriarColaboradorResult> {
  const callerRole = await getUserRole();
  if (!isAdminRole(callerRole)) {
    return { error: "Apenas administradores podem remover colaboradores." };
  }

  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  if (caller?.id === userId) {
    return { error: "Você não pode remover a própria conta." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Erro ao inicializar o cliente admin.",
    };
  }

  // Busca o role do alvo pra checar permissão
  const { data: targetRole } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  const targetRoleValue = (targetRole as { role?: UserRole } | null)?.role;

  // Não permite remover admin_geral nunca
  if (targetRoleValue === "admin_geral") {
    return { error: "O admin geral não pode ser removido por aqui." };
  }
  // Só admin_geral remove outro admin
  if (targetRoleValue === "admin" && callerRole !== "admin_geral") {
    return { error: "Apenas o admin geral pode remover outros admins." };
  }

  // Remove role primeiro (referência), depois o auth user
  const { error: roleErr } = await admin
    .from("user_roles")
    .delete()
    .eq("user_id", userId);
  if (roleErr) {
    return { error: `Erro ao remover role: ${roleErr.message}` };
  }

  const { error: authErr } = await admin.auth.admin.deleteUser(userId);
  if (authErr) {
    return { error: `Erro ao remover usuário: ${authErr.message}` };
  }

  revalidatePath("/gestao");
  return { ok: true };
}
