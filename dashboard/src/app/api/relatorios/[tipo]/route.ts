import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdminRole } from "@/lib/auth";
import { drawBrandHeader, drawBrandFooter, PDF_THEME } from "@/lib/pdf/brand-header";

// ───────────────────────── Logo cache ─────────────────────────
let logoCache: string | null = null;
async function getLogoDataUrl(): Promise<string | undefined> {
  if (logoCache) return logoCache;
  try {
    const p = path.join(process.cwd(), "public", "brand", "logo.png");
    const buf = await readFile(p);
    logoCache = `data:image/png;base64,${buf.toString("base64")}`;
    return logoCache;
  } catch {
    return undefined;
  }
}

// ───────────────────────── CSV helpers ─────────────────────────
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Neutraliza formula injection: nomes/observações vêm do WhatsApp (não-confiável).
  // Excel/Sheets executam células que começam com = + - @ tab CR.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(rows: Record<string, unknown>[], headers: string[]): string {
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ].join("\n");
}

// ───────────────────────── PDF builder ─────────────────────────
interface PdfSpec {
  title: string;
  subtitle: string;
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  logoDataUrl?: string;
}

function buildPdf({
  title,
  subtitle,
  filename,
  headers,
  rows,
  logoDataUrl,
}: PdfSpec): {
  buffer: ArrayBuffer;
  filename: string;
} {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const tableStartY = 40;

  autoTable(doc, {
    startY: tableStartY,
    head: [headers],
    body: rows,
    theme: "grid",
    styles: {
      lineColor: PDF_THEME.BORDER,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: PDF_THEME.BRAND_CORAL,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: PDF_THEME.BRAND_CORAL,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: PDF_THEME.TEXT_DARK,
      fillColor: PDF_THEME.CARD_CREAM,
    },
    alternateRowStyles: {
      fillColor: PDF_THEME.ROW_ALT,
    },
    margin: { top: tableStartY, left: 12, right: 12, bottom: 16 },
    didDrawPage: () =>
      drawBrandHeader(doc, {
        title,
        subtitle,
        brand: { logoDataUrl },
      }),
  });

  drawBrandFooter(doc);

  const buffer = doc.output("arraybuffer");
  return { buffer, filename };
}

// ───────────────────────── ROUTE ─────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tipo: string }> }
) {
  const { tipo } = await params;
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ?? "1900-01-01";
  const to = sp.get("to") ?? format(new Date(), "yyyy-MM-dd");
  const formato = sp.get("formato") ?? "csv"; // 'csv' | 'pdf'

  // Relatórios expõem PII (nomes, telefones, emails) — restrito a admin.
  // A rota é invocável direto, então o guard não pode depender do nav/página.
  const role = await getUserRole();
  if (!isAdminRole(role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const supabase = await createClient();
  const logoDataUrl = await getLogoDataUrl();
  const periodoLabel =
    from === "1900-01-01"
      ? `Até ${format(new Date(to + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}`
      : `${format(new Date(from + "T00:00:00"), "dd/MM/yyyy", {
          locale: ptBR,
        })} a ${format(new Date(to + "T00:00:00"), "dd/MM/yyyy", {
          locale: ptBR,
        })}`;

  // ───────── RESERVAS ─────────
  if (tipo === "reservas") {
    const { data } = await supabase
      .from("reservas")
      .select(
        "id, cliente_nome, cliente_telefone, cliente_email, area_codigo, qtd_pessoas, data_reserva, horario, periodo, status, created_at"
      )
      .gte("data_reserva", from)
      .lte("data_reserva", to)
      .order("data_reserva", { ascending: false });

    const rows = data ?? [];
    const filenameBase = `reservas_${from}_${to}`;

    if (formato === "pdf") {
      const { buffer, filename } = buildPdf({
        logoDataUrl,
        title: "Relatório de Reservas",
        subtitle: periodoLabel,
        filename: `${filenameBase}.pdf`,
        headers: [
          "Data",
          "Horário",
          "Cliente",
          "Telefone",
          "Área",
          "Pessoas",
          "Período",
          "Status",
        ],
        rows: rows.map((r) => [
          r.data_reserva,
          (r.horario ?? "").slice(0, 5),
          r.cliente_nome,
          r.cliente_telefone,
          r.area_codigo,
          r.qtd_pessoas,
          r.periodo,
          r.status,
        ]),
      });
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const csv = toCSV(rows, [
      "id",
      "cliente_nome",
      "cliente_telefone",
      "cliente_email",
      "area_codigo",
      "qtd_pessoas",
      "data_reserva",
      "horario",
      "periodo",
      "status",
      "created_at",
    ]);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    });
  }

  // ───────── OCUPAÇÃO ─────────
  if (tipo === "ocupacao") {
    const { data } = await supabase
      .from("v_ocupacao_diaria")
      .select("*")
      .gte("data_reserva", from)
      .lte("data_reserva", to);

    const rows = data ?? [];
    const filenameBase = `ocupacao_${from}_${to}`;

    if (formato === "pdf") {
      const { buffer, filename } = buildPdf({
        logoDataUrl,
        title: "Relatório de Ocupação",
        subtitle: periodoLabel,
        filename: `${filenameBase}.pdf`,
        headers: [
          "Data",
          "Área",
          "Período",
          "Cap. Máx",
          "Reservas",
          "Pessoas",
          "% Ocupação",
          "No-shows",
          "Cancelados",
        ],
        rows: rows.map((r) => [
          r.data_reserva,
          r.area_nome,
          r.periodo,
          r.capacidade_max,
          r.qtd_reservas,
          r.total_pessoas,
          `${r.pct_ocupacao ?? 0}%`,
          r.no_shows,
          r.cancelamentos,
        ]),
      });
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const csv = toCSV(rows, [
      "data_reserva",
      "area_codigo",
      "area_nome",
      "periodo",
      "capacidade_max",
      "qtd_reservas",
      "total_pessoas",
      "pct_ocupacao",
      "no_shows",
      "cancelamentos",
    ]);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    });
  }

  // ───────── CLIENTES ─────────
  if (tipo === "clientes") {
    const { data } = await supabase
      .from("v_clientes_360")
      .select("*")
      .order("ultima_visita", { ascending: false, nullsFirst: false });

    const rows = data ?? [];
    const filenameBase = `clientes`;

    if (formato === "pdf") {
      const { buffer, filename } = buildPdf({
        logoDataUrl,
        title: "Base de Clientes",
        subtitle: `Exportada em ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}`,
        filename: `${filenameBase}.pdf`,
        headers: [
          "Nome",
          "Telefone (JID)",
          "Email",
          "Desde",
          "Reservas",
          "Concl.",
          "No-show",
          "Cancel.",
          "Última visita",
          "Msgs",
        ],
        rows: rows.map((r) => [
          r.nome_completo ?? r.user_name ?? "—",
          r.jid,
          r.email ?? "—",
          r.contato_desde
            ? format(new Date(r.contato_desde), "dd/MM/yy")
            : "—",
          r.total_reservas,
          r.reservas_concluidas,
          r.reservas_no_show,
          r.reservas_canceladas,
          r.ultima_visita
            ? format(new Date(r.ultima_visita + "T00:00:00"), "dd/MM/yy")
            : "—",
          r.msgs_total,
        ]),
      });
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const csv = toCSV(rows, [
      "jid",
      "user_name",
      "nome_completo",
      "email",
      "contato_desde",
      "total_reservas",
      "reservas_concluidas",
      "reservas_no_show",
      "reservas_canceladas",
      "ultima_visita",
      "msgs_total",
    ]);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
}
