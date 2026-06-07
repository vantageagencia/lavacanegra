"use client";

import { useState } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { criarColaborador } from "@/app/(app)/colaboradores/actions";

interface AddColaboradorDialogProps {
  /** Caller pode criar outros admins? (só admin_geral). */
  canCreateAdmin?: boolean;
}

export function AddColaboradorDialog({
  canCreateAdmin = false,
}: AddColaboradorDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      const res = await criarColaborador(formData);
      if (res?.error) {
        toast.error("Erro ao criar colaborador", { description: res.error });
        return;
      }
      toast.success("Colaborador criado!");
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4" /> Adicionar colaborador
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Novo colaborador
          </DialogTitle>
          <DialogDescription>
            Cria a conta de acesso ao painel e define o nível de permissão.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" name="nome" required placeholder="Nome completo" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="colaborador@lavacanegra.com"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="senha">Senha *</Label>
            <Input
              id="senha"
              name="senha"
              type="password"
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              O colaborador poderá logar imediatamente com essa senha.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">Nível de acesso *</Label>
            <select
              id="role"
              name="role"
              defaultValue="user"
              className="h-9 w-full rounded-md border border-input bg-background/60 px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="user">Colaborador (só Reservas)</option>
              {canCreateAdmin && (
                <option value="admin">Administrador (acesso total)</option>
              )}
            </select>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Criando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" /> Criar colaborador
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
