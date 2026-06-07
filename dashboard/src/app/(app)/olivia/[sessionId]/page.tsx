import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Bot, User } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { extractMessage, isToolMessage, formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ChatRow = {
  id: number;
  session_id: string;
  message: { type?: string; content?: string };
};

type Contato = {
  user_number: string;
  user_name: string | null;
  nome_completo: string | null;
  created_at: string;
};

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function ConversaPage({ params }: PageProps) {
  await requireAdmin();
  const { sessionId: sessionIdRaw } = await params;
  const sessionId = decodeURIComponent(sessionIdRaw);
  const supabase = await createClient();

  const [msgsRes, contatoRes, reservasRes] = await Promise.all([
    supabase
      .from("n8n_chat_histories")
      .select("id, session_id, message")
      .eq("session_id", sessionId)
      .order("id", { ascending: true }),
    supabase
      .from("contatos_agente")
      .select("user_number, user_name, nome_completo, created_at")
      .eq("user_number", sessionId)
      .maybeSingle(),
    supabase
      .from("reservas")
      .select("id, data_reserva, horario, qtd_pessoas, status, area_codigo")
      .eq("cliente_telefone", sessionId)
      .order("data_reserva", { ascending: false })
      .limit(5),
  ]);

  const mensagensRaw = (msgsRes.data ?? []) as ChatRow[];
  // Filtra tool calls e tool results internos do n8n — só mostra texto WhatsApp
  const mensagens = mensagensRaw.filter((m) => {
    const ex = extractMessage(m.message);
    return !isToolMessage(ex);
  });
  const contato = (contatoRes.data ?? null) as Contato | null;
  const reservas = (reservasRes.data ?? []) as Array<{
    id: number;
    data_reserva: string;
    horario: string;
    qtd_pessoas: number;
    status: string;
    area_codigo: string;
  }>;

  const nome =
    contato?.user_name ?? contato?.nome_completo ?? formatPhone(sessionId);
  const telefoneFmt = formatPhone(sessionId);

  return (
    <>
      <PageHeader
        title={nome}
        subtitle={`${telefoneFmt}${contato ? ` · contato desde ${format(parseISO(contato.created_at), "dd 'de' MMM yyyy", { locale: ptBR })}` : ""}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/olivia">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
        }
      />

      {reservas.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Reservas deste cliente
            </p>
            <ul className="space-y-1.5">
              {reservas.map((r) => (
                <li key={r.id} className="text-sm flex items-center gap-3">
                  <span className="font-mono text-primary">
                    {format(parseISO(r.data_reserva), "dd/MM/yyyy")}
                  </span>
                  <span className="text-muted-foreground">
                    {r.horario?.slice(0, 5)}
                  </span>
                  <span>·</span>
                  <span>
                    {r.qtd_pessoas} {r.qtd_pessoas === 1 ? "pessoa" : "pessoas"}
                  </span>
                  <span>·</span>
                  <span className="text-muted-foreground capitalize">
                    {r.status === "concluida"
                      ? "Compareceu"
                      : r.status === "no_show"
                        ? "Não veio"
                        : r.status}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 sm:p-6">
          {mensagens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <MessageCircle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhuma mensagem registrada nessa sessão.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {mensagens.map((m) => {
                const ex = extractMessage(m.message);
                const isAi = ex.type === "ai";
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex gap-2 items-end",
                      isAi ? "justify-start" : "justify-end"
                    )}
                  >
                    {isAi && (
                      <div className="shrink-0 h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words",
                        isAi
                          ? "bg-muted text-foreground rounded-bl-sm"
                          : "bg-primary text-primary-foreground rounded-br-sm"
                      )}
                    >
                      {ex.content || (
                        <span className="italic opacity-60">
                          (mensagem vazia)
                        </span>
                      )}
                    </div>
                    {!isAi && (
                      <div className="shrink-0 h-7 w-7 rounded-full bg-muted text-foreground flex items-center justify-center">
                        <User className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground text-center mt-6">
            {mensagens.length}{" "}
            {mensagens.length === 1 ? "mensagem" : "mensagens"} · sessão{" "}
            <code className="text-[10px]">{sessionId}</code>
          </p>
        </CardContent>
      </Card>
    </>
  );
}
