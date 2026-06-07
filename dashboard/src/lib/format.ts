import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatBR(date: Date | string, fmt = "dd/MM/yyyy"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, fmt, { locale: ptBR });
}

export function formatHora(time: string): string {
  // "11:30:00" → "11:30"
  return time?.slice(0, 5) ?? "—";
}

export type ReservaStatus =
  | "confirmada"
  | "cancelada"
  | "no_show"
  | "concluida";

export const statusLabel: Record<ReservaStatus, string> = {
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  no_show: "Não veio",
  concluida: "Compareceu",
};

export const statusVariant: Record<
  ReservaStatus,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  confirmada: "default",
  cancelada: "destructive",
  no_show: "warning",
  concluida: "success",
};

export const periodoLabel: Record<string, string> = {
  almoco: "Almoço",
  jantar: "Jantar",
};

/**
 * Limpa um JID do WhatsApp "559292589214@s.whatsapp.net" → "(92) 99258-9214"
 */
export function formatPhone(jid: string | null | undefined): string {
  if (!jid) return "—";
  const num = jid.replace(/[^0-9]/g, "");
  if (!num) return "—";
  // 55 92 99258-9214
  if (num.length >= 12) {
    const ddi = num.slice(0, 2);
    const ddd = num.slice(2, 4);
    const rest = num.slice(4);
    const part1 = rest.slice(0, rest.length - 4);
    const part2 = rest.slice(-4);
    return `+${ddi} (${ddd}) ${part1}-${part2}`;
  }
  return num;
}

/** Extrai o conteúdo de uma mensagem n8n no formato { type, content } */
export function extractMessage(msg: unknown): { type: string; content: string } {
  if (typeof msg === "object" && msg !== null) {
    const m = msg as { type?: string; content?: string };
    return {
      type: m.type ?? "unknown",
      content: m.content ?? "",
    };
  }
  return { type: "unknown", content: String(msg ?? "") };
}

/**
 * Detecta mensagens internas do agente n8n que não fazem parte do WhatsApp:
 * - Tool calls: "Calling xxx with input: {...}"
 * - Tool results: '{"response": "..."}' / payloads JSON puros
 * - type === "tool" | "function"
 */
export function isToolMessage(msg: { type: string; content: string }): boolean {
  if (msg.type === "tool" || msg.type === "function") return true;
  const c = msg.content?.trim() ?? "";
  if (!c) return false;
  if (c.startsWith("Calling ") && c.includes("with input:")) return true;
  if (
    c.startsWith("{") &&
    c.endsWith("}") &&
    /^\{\s*"(response|error|result|output)"\s*:/.test(c)
  ) {
    return true;
  }
  return false;
}
