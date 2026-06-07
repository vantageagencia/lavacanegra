import type { jsPDF } from "jspdf";

// ── Paleta nova (papel kraft + coral La Vaca Negra) ──────────
// Sincronizada com src/app/globals.css
const BRAND_CORAL: [number, number, number] = [228, 69, 46];      // ~#E4452E — --primary
const BG_CREAM: [number, number, number] = [248, 243, 232];       // --background
const CARD_CREAM: [number, number, number] = [252, 248, 240];     // --card
const TEXT_DARK: [number, number, number] = [39, 32, 25];         // --foreground
const TEXT_MUTED: [number, number, number] = [117, 97, 87];       // --muted-foreground
const BORDER: [number, number, number] = [221, 209, 198];         // --border
const ROW_ALT: [number, number, number] = [245, 238, 226];        // tom alternado para tabelas

interface BrandAssets {
  /** PNG/JPEG do logo como data URL, ex.: "data:image/png;base64,iVBOR…" */
  logoDataUrl?: string;
}

/**
 * Desenha o header da marca no topo de cada página do PDF.
 * Faixa creme com logo circular + wordmark coral, no estilo papel kraft do dashboard.
 */
export function drawBrandHeader(
  doc: jsPDF,
  opts: { title: string; subtitle?: string; brand?: BrandAssets }
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerH = 30;

  // Fundo creme do cabeçalho
  doc.setFillColor(...BG_CREAM);
  doc.rect(0, 0, pageWidth, headerH, "F");

  // ── Logo circular ──
  // Se vier um PNG, usa a imagem. Senão, fallback pra disco preto com "LV" coral.
  const logoSize = 18;
  const logoX = 12;
  const logoY = 6;
  if (opts.brand?.logoDataUrl) {
    try {
      doc.addImage(
        opts.brand.logoDataUrl,
        "PNG",
        logoX,
        logoY,
        logoSize,
        logoSize,
        undefined,
        "FAST"
      );
    } catch {
      drawFallbackBadge(doc, logoX + logoSize / 2, logoY + logoSize / 2);
    }
  } else {
    drawFallbackBadge(doc, logoX + logoSize / 2, logoY + logoSize / 2);
  }

  // ── Wordmark ──
  const textX = logoX + logoSize + 5;
  doc.setTextColor(...TEXT_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("LA VACA NEGRA", textX, 14);

  // Tagline em itálico (aproximação do "El Fuego nos une" script)
  doc.setTextColor(...BRAND_CORAL);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text("El fuego nos une", textX, 19);

  doc.setTextColor(...TEXT_MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text("PARRILLA ARGENTINA · MANAUS", textX, 23);

  // Faixa coral fina abaixo
  doc.setFillColor(...BRAND_CORAL);
  doc.rect(0, headerH, pageWidth, 1.2, "F");

  // ── Título do relatório (à direita) ──
  doc.setTextColor(...TEXT_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(opts.title.toUpperCase(), pageWidth - 14, 14, { align: "right" });

  if (opts.subtitle) {
    doc.setTextColor(...TEXT_MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(opts.subtitle, pageWidth - 14, 20, { align: "right" });
  }
}

function drawFallbackBadge(doc: jsPDF, cx: number, cy: number) {
  doc.setFillColor(15, 12, 10);
  doc.circle(cx, cy, 9, "F");
  doc.setFillColor(...BRAND_CORAL);
  doc.circle(cx, cy, 7.5, "F");
  doc.setTextColor(15, 12, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("LV", cx, cy + 1, { align: "center" });
}

/**
 * Desenha o footer com paginação e timestamp.
 */
export function drawBrandFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Linha coral fina
    doc.setDrawColor(...BRAND_CORAL);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setTextColor(...TEXT_MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(
      `La Vaca Negra · Dashboard de Gestão · Gerado em ${new Date().toLocaleString(
        "pt-BR"
      )}`,
      14,
      pageHeight - 7
    );
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - 14,
      pageHeight - 7,
      { align: "right" }
    );
  }
}

export const PDF_THEME = {
  BRAND_CORAL,
  BG_CREAM,
  CARD_CREAM,
  TEXT_DARK,
  TEXT_MUTED,
  BORDER,
  ROW_ALT,
};
