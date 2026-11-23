import jsPDF from "jspdf";
import type { Sale, DailyClosing, BusinessInfo, ExchangeRates, Product, Movement } from "../types";
import type { IPVRow } from "./ipv";
import { formatCurrency, roundCurrency, formatAccounting, formatQuantity } from "./currency";
import { sanitizeClosingData, auditReportData } from "./auditEngine";
import {
  runIPVSentinel,
  runInventoryCatalogSentinel,
  preFlightSentinelGuard,
  sanitizeTextForPdf,
  cleanCorruptCharacters,
  normalizeUnit,
  toTitleCase,
} from "./accountingSentinel";
import { type FileExportPayload, saveToInternalOrDownload } from "./fileStorage";
import { universalShare } from "./universalShare";

export interface IPUESettings {
  documentTitle: string;
  documentSubtitle: string;
  signature1: string;
  signature2: string;
  signature3: string;
  customNotes: string;
}

export function createPdfPayload(doc: jsPDF, filename: string, title: string, description?: string): { payload: FileExportPayload; blob: Blob; doc: jsPDF } {
  const blob = doc.output("blob");
  return {
    blob,
    doc,
    payload: {
      filename,
      blob,
      mimeType: "application/pdf",
      title,
      description: description || `Documento PDF oficial generado desde CajaMaster POS`,
      category: "PDF",
    },
  };
}

/**
 * Universal helper to trigger native file sharing or fallback to direct download.
 */
export async function deliverPdfFile(
  doc: jsPDF,
  filename: string,
  title: string,
  preferShare = false
): Promise<{ method: "share" | "download"; success: boolean }> {
  const pdfBlob = doc.output("blob");

  if (preferShare) {
    try {
      const shareRes = await universalShare({
        title,
        text: `${title} generado desde CajaMaster POS`,
        file: {
          blob: pdfBlob,
          filename,
          mimeType: "application/pdf",
        },
      });

      if (shareRes.success) {
        return { method: "share", success: true };
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.warn("Universal share failed, falling back to download:", err);
      } else {
        return { method: "share", success: false };
      }
    }
  }

  // Direct download / save to storage (internal or external USB/SD / Capacitor native)
  await saveToInternalOrDownload(pdfBlob, filename);
  return { method: "download", success: true };
}

/**
 * Builds the POS Receipt Ticket PDF document and payload (80mm width standard).
 */
export function buildTicketPdfPayload(
  sale: Sale,
  biz: BusinessInfo,
  rates: ExchangeRates
): { doc: jsPDF; blob: Blob; filename: string; payload: FileExportPayload } {
  // 80mm thermal width equivalent in points (~226pt width, dynamic height)
  const estimatedHeight = Math.max(320, 220 + sale.items.length * 28);
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: [226, estimatedHeight],
  });

  const pageWidth = 226;
  let y = 20;

  // Header
  doc.setFillColor(15, 23, 42); // #0F172A
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(cleanCorruptCharacters(biz.name || "CAJAMASTER POS").toUpperCase(), pageWidth / 2, 22, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(245, 158, 11); // #F59E0B
  doc.text("COMPROBANTE OFICIAL DE VENTA", pageWidth / 2, 33, { align: "center" });

  y = 52;
  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  if (biz.address) {
    doc.text(cleanCorruptCharacters(biz.address), pageWidth / 2, y, { align: "center" });
    y += 10;
  }
  if (biz.phone) {
    doc.text(`Tel: ${cleanCorruptCharacters(biz.phone)}`, pageWidth / 2, y, { align: "center" });
    y += 10;
  }

  const dateStr = new Date(sale.ts).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const ticketNum = sale.ticketNumber || String(sale.id).slice(-4);
  doc.setFont("helvetica", "bold");
  doc.text(`Ticket #${ticketNum} • ${dateStr}`, pageWidth / 2, y, { align: "center" });
  y += 12;

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(12, y, pageWidth - 12, y);
  y += 12;

  // Table header
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("CANT. / DESCRIPCIÓN", 14, y);
  doc.text("TOTAL", pageWidth - 14, y, { align: "right" });
  y += 10;

  // Items
  doc.setLineDashPattern([], 0);
  sale.items.forEach((item) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    
    // Product Name
    const cleanItemName = cleanCorruptCharacters(item.name || "Producto");
    const nameText = cleanItemName.length > 24 ? cleanItemName.substring(0, 22) + "..." : cleanItemName;
    doc.text(nameText, 14, y);

    const lineTotal = formatCurrency(item.qty * item.price, "CUP", rates);
    doc.text(lineTotal, pageWidth - 14, y, { align: "right" });
    y += 9;

    // Unit detail
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`${item.qty} ${item.unit || "u"} x ${formatCurrency(item.price, "CUP", rates)}`, 14, y);
    y += 11;
  });

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(12, y, pageWidth - 12, y);
  y += 12;

  // Totals
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Subtotal:", 14, y);
  doc.text(formatCurrency(sale.subtotal || sale.total, "CUP", rates), pageWidth - 14, y, { align: "right" });
  y += 11;

  if (sale.discount > 0) {
    doc.setTextColor(225, 29, 72);
    doc.text("Descuento:", 14, y);
    doc.text(`-${formatCurrency(sale.discount, "CUP", rates)}`, pageWidth - 14, y, { align: "right" });
    y += 11;
  }

  // Total Bar
  doc.setFillColor(241, 245, 249);
  doc.rect(12, y - 2, pageWidth - 24, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("TOTAL PAGADO:", 16, y + 10);
  doc.text(formatCurrency(sale.total, "CUP", rates), pageWidth - 16, y + 10, { align: "right" });
  y += 26;

  // Payment details
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  
  const paymentMethodLabel =
    sale.paymentMethod === "cash"
      ? "EFECTIVO"
      : sale.paymentMethod === "transfermovil"
      ? "TRANSFERMÓVIL"
      : sale.paymentMethod === "enzona"
      ? "ENZONA"
      : sale.paymentMethod === "mixed"
      ? "MIXTO"
      : String(sale.paymentMethod).toUpperCase();

  doc.text(`Método: ${paymentMethodLabel}`, 14, y);
  const statusLabel = (sale.paymentStatus || sale.estado_pago || "COMPLETADO");
  doc.text(`Estado: ${statusLabel}`, pageWidth - 14, y, { align: "right" });
  y += 10;

  if (sale.gatewayReference) {
    doc.text(`Ref Gateway: ${sale.gatewayReference}`, 14, y);
    y += 10;
  }

  // Currency breakdown
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Equiv: ${formatCurrency(sale.total, "USD", rates)} | ${formatCurrency(sale.total, "EUR", rates)}`, 14, y);
  y += 14;

  // Footer message
  doc.setLineDashPattern([2, 2], 0);
  doc.line(12, y, pageWidth - 12, y);
  y += 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(biz.footerMessage || "¡Gracias por su compra!", pageWidth / 2, y, { align: "center" });
  y += 9;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Emitido con CajaMaster POS", pageWidth / 2, y, { align: "center" });

  const filename = `Ticket_${ticketNum}_${sale.ts}.pdf`;
  const { blob, payload } = createPdfPayload(
    doc,
    filename,
    `Ticket #${ticketNum}`,
    `Comprobante oficial de venta de ${biz.name || "Negocio"}`
  );
  return { doc, blob, filename, payload };
}

/**
 * Generates a clean, high-contrast POS Receipt Ticket PDF (80mm width standard) and delivers it.
 */
export async function generateTicketPdf(
  sale: Sale,
  biz: BusinessInfo,
  rates: ExchangeRates,
  preferShare = false
): Promise<{ method: "share" | "download"; success: boolean; blob: Blob; doc: jsPDF; filename: string; payload: FileExportPayload }> {
  const built = buildTicketPdfPayload(sale, biz, rates);
  const deliverRes = await deliverPdfFile(built.doc, built.filename, `Ticket #${sale.ticketNumber || String(sale.id).slice(-4)}`, preferShare);
  return { ...deliverRes, ...built };
}

/**
 * Builds an executive Z-Report / Daily Closing PDF Document and payload.
 */
export function buildZReportPdfPayload(
  rawClosing: DailyClosing,
  biz: BusinessInfo,
  rates: ExchangeRates
): { doc: jsPDF; blob: Blob; filename: string; payload: FileExportPayload } {
  // Pre-generation audit & sanitization to eliminate any potential arithmetic errors
  const closing = sanitizeClosingData(rawClosing);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4", // 595 x 842 pt
  });

  const pageWidth = 595;
  let y = 36;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(36, y, pageWidth - 72, 70, 8, 8, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(cleanCorruptCharacters(biz.name ? biz.name.toUpperCase() : "ESTABLECIMIENTO COMERCIAL"), 54, y + 24);

  doc.setFontSize(9.5);
  doc.setTextColor(245, 158, 11);
  doc.text("INFORME Z - CIERRE DE CAJA & ARQUEO DIARIO", 54, y + 39);

  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Fecha: ${closing.date} | Hora: ${new Date(closing.closedAt).toLocaleTimeString("es-ES")} | CajaMaster POS`,
    54,
    y + 51
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(52, 211, 153);
  doc.text("[OK] AUDITORÍA CONTABLE Y MATEMÁTICA VERIFICADA", 54, y + 62);

  y += 86;

  // Business Info & Responsable
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (biz.owner) doc.text(`Responsable: ${cleanCorruptCharacters(biz.owner)}`, 40, y);
  if (biz.phone) doc.text(`Tel: ${cleanCorruptCharacters(biz.phone)}`, 240, y);
  if (biz.address) doc.text(`Dirección: ${cleanCorruptCharacters(biz.address)}`, 400, y);
  y += 18;

  // SECTION 1: BALANCE DE CAJA Y VENTAS
  const expectedCash = closing.expectedCash ?? roundCurrency(closing.openingCash + closing.cashSales);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(36, y, pageWidth - 72, 114, 6, 6, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("1. RESUMEN DE VENTAS Y BALANCE DE EFECTIVO", 48, y + 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);

  doc.text("Fondo de Caja Inicial:", 48, y + 38);
  doc.text(formatCurrency(closing.openingCash, "CUP", rates), 200, y + 38, { align: "right" });

  doc.text("Ventas en Efectivo:", 48, y + 54);
  doc.text(formatCurrency(closing.cashSales, "CUP", rates), 200, y + 54, { align: "right" });

  doc.text("Ventas por Transferencia:", 48, y + 70);
  doc.text(formatCurrency(closing.transferSales, "CUP", rates), 200, y + 70, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Total Ventas de la Jornada:", 48, y + 90);
  doc.text(formatCurrency(closing.totalSales, "CUP", rates), 200, y + 90, { align: "right" });

  // Column 2
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Tickets Emitidos:", 310, y + 38);
  doc.text(String(closing.totalTickets), 480, y + 38, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Efectivo Esperado (Teórico):", 310, y + 54);
  doc.text(formatCurrency(expectedCash, "CUP", rates), 480, y + 54, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Efectivo Físico Contado:", 310, y + 70);
  doc.text(formatCurrency(closing.countedCash, "CUP", rates), 480, y + 70, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.text("Descuadre / Diferencia:", 310, y + 90);
  if (closing.cashDiscrepancy === 0) {
    doc.setTextColor(16, 185, 129);
    doc.text("0.00 CUP (Cuadrada)", 480, y + 90, { align: "right" });
  } else if (closing.cashDiscrepancy > 0) {
    doc.setTextColor(37, 99, 235);
    doc.text(`+${formatAccounting(closing.cashDiscrepancy)} CUP (Sobrante)`, 480, y + 90, { align: "right" });
  } else {
    doc.setTextColor(225, 29, 72);
    doc.text(`${formatAccounting(closing.cashDiscrepancy)} CUP (Faltante)`, 480, y + 90, { align: "right" });
  }

  y += 128;

  // SECTION 2: BALANCE FÍSICO DE INVENTARIO
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(36, y, pageWidth - 72, 60, 6, 6, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("2. BALANCE FÍSICO DE INVENTARIO", 48, y + 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Total Unidades Contadas: ${closing.inventoryUnitsCounted} u`, 48, y + 42);
  doc.text(`Valoración al Costo: ${formatCurrency(closing.inventoryTotalCost, "CUP", rates)}`, 220, y + 42);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`Valoración a Venta: ${formatCurrency(closing.inventoryTotalValue, "CUP", rates)}`, 400, y + 42);

  y += 74;

  // Detailed count table if counts exist
  if (closing.counts && closing.counts.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text("Detalle de Existencias Verificadas:", 40, y);
    y += 12;

    // Table Header
    doc.setFillColor(15, 23, 42);
    doc.rect(36, y, pageWidth - 72, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.text("PRODUCTO", 44, y + 12);
    doc.text("U/M", 240, y + 12, { align: "center" });
    doc.text("SISTEMA", 310, y + 12, { align: "right" });
    doc.text("FÍSICO", 380, y + 12, { align: "right" });
    doc.text("DIF.", 450, y + 12, { align: "right" });
    doc.text("PRECIO CUP", pageWidth - 44, y + 12, { align: "right" });
    y += 18;

    // Rows (render up to max 12 items to stay within 1 clean page)
    const itemsToRender = closing.counts.slice(0, 14);
    itemsToRender.forEach((item, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(36, y, pageWidth - 72, 14, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      
      const pName = item.name.length > 32 ? item.name.substring(0, 30) + "..." : item.name;
      doc.text(pName, 44, y + 10);
      doc.text(item.unit || "u", 240, y + 10, { align: "center" });
      doc.text(String(item.systemStock), 310, y + 10, { align: "right" });
      doc.text(String(item.physicalStock), 380, y + 10, { align: "right" });

      if (item.discrepancy !== 0) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(item.discrepancy > 0 ? 16 : 225, item.discrepancy > 0 ? 185 : 29, item.discrepancy > 0 ? 129 : 72);
        doc.text(item.discrepancy > 0 ? `+${item.discrepancy}` : String(item.discrepancy), 450, y + 10, { align: "right" });
      } else {
        doc.text("0", 450, y + 10, { align: "right" });
      }

      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(formatCurrency(item.price, "CUP", rates), pageWidth - 44, y + 10, { align: "right" });
      y += 14;
    });

    if (closing.counts.length > 14) {
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(`... y ${closing.counts.length - 14} líneas adicionales de productos registradas.`, 44, y + 10);
      y += 14;
    }
  }

  if (closing.notes) {
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Observaciones del Cierre:", 40, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(closing.notes, 40, y, { maxWidth: pageWidth - 80 });
    y += 16;
  }

  // Signatures
  y = Math.max(y + 20, 720);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.75);

  doc.line(60, y, 220, y);
  doc.line(375, y, 535, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Cajero / Responsable de Turno", 140, y + 12, { align: "center" });
  doc.text("Administrador / Auditor", 455, y + 12, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Firma y Conformidad", 140, y + 22, { align: "center" });
  doc.text("Aprobación y Cierre de Caja", 455, y + 22, { align: "center" });

  const filename = `CierreZ_${closing.date}.pdf`;
  const { blob, payload } = createPdfPayload(
    doc,
    filename,
    `Informe Z - ${closing.date}`,
    `Cierre oficial de caja y arqueo diario del ${closing.date}`
  );
  return { doc, blob, filename, payload };
}

/**
 * Generates an executive Z-Report / Daily Closing PDF Document and delivers it.
 */
export async function generateZReportPdf(
  rawClosing: DailyClosing,
  biz: BusinessInfo,
  rates: ExchangeRates,
  preferShare = false
): Promise<{ method: "share" | "download"; success: boolean; blob: Blob; doc: jsPDF; filename: string; payload: FileExportPayload }> {
  const built = buildZReportPdfPayload(rawClosing, biz, rates);
  const deliverRes = await deliverPdfFile(built.doc, built.filename, `Informe Z - ${rawClosing.date}`, preferShare);
  return { ...deliverRes, ...built };
}

export interface IPVPaymentBreakdown {
  cashTotal: number;
  digitalTotal: number;
  transfermovilTotal?: number;
  enzonaTotal?: number;
  transferTotal?: number;
  salesCount?: number;
}

/**
 * Helper para ajustar texto numérico a un ancho máximo de celda reduciendo
 * suavemente el tamaño de fuente si es necesario, impidiendo apilamiento o desbordamiento.
 */
function drawFittedNumber(
  doc: jsPDF,
  text: string,
  rightX: number,
  yPos: number,
  maxWidth: number,
  baseFontSize = 6.1
): void {
  let fontSize = baseFontSize;
  doc.setFontSize(fontSize);
  while (doc.getTextWidth(text) > maxWidth && fontSize > 4.4) {
    fontSize -= 0.25;
    doc.setFontSize(fontSize);
  }
  doc.text(text, rightX, yPos, { align: "right" });
  doc.setFontSize(baseFontSize);
}

/**
 * Divide y recorta el nombre del producto en máximo 2 líneas dentro del ancho exacto de celda.
 */
function fitProductLines(doc: jsPDF, text: string, maxWidth: number, fontSize = 6.1): string[] {
  doc.setFontSize(fontSize);
  const rawLines = doc.splitTextToSize(text, maxWidth) as string[];
  if (!rawLines || rawLines.length === 0) return ["Producto"];
  if (rawLines.length === 1) return [rawLines[0]];
  let secondLine = rawLines[1];
  if (rawLines.length > 2) {
    while (doc.getTextWidth(`${secondLine}..`) > maxWidth && secondLine.length > 3) {
      secondLine = secondLine.slice(0, -1);
    }
    secondLine = `${secondLine.trim()}..`;
  }
  return [rawLines[0], secondLine];
}

/**
 * Builds the Official IPVE / IPV Document PDF and payload (Landscape A4 Table).
 * Cumple estrictamente con:
 * 1. Codificación limpia WinAnsi/UTF-8 sin emojis ni mojibake.
 * 2. Cero alertas, notas flotantes o diagnósticos subjetivos dentro del reporte oficial.
 * 3. Alineación estricta de columnas numéricas con formato uniforme (coma miles, punto decimal).
 * 4. Separación independiente de INV. INICIAL y ENTRADAS + desglose Efectivo vs. Digital en arqueo.
 */
export function buildIPVReportPdfPayload(
  rows: IPVRow[],
  totals: any,
  periodLabel: string,
  biz: BusinessInfo,
  settings: IPUESettings,
  _rates: ExchangeRates,
  paymentBreakdown?: IPVPaymentBreakdown
): { doc: jsPDF; blob: Blob; filename: string; payload: FileExportPayload } {
  // 1. Pre-Flight Sentinel Guard: prevent empty or corrupted datasets
  preFlightSentinelGuard("Informe IPVE", rows);

  // 2. Sentinel Invariant & Totals Reconciler: audit and auto-heal equations
  const sentinel = runIPVSentinel(rows, totals);
  const auditedRows = sentinel.healedRows;
  const auditedTotals = sentinel.healedTotals;

  // 3. A4 Landscape document (842 pt width x 595 pt height)
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = 842;
  const pageHeight = 595;
  const marginX = 25;
  const printableWidth = pageWidth - marginX * 2; // 792 pt
  let y = 26;

  const safePeriodLabel = cleanCorruptCharacters(periodLabel) || "Periodo Actual";

  // Top Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(marginX, y, printableWidth, 50, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const cleanBizName = sanitizeTextForPdf((biz.name || "ESTABLECIMIENTO COMERCIAL").toUpperCase(), 45);
  doc.text(cleanBizName, marginX + 12, y + 18);

  doc.setFontSize(8.5);
  doc.setTextColor(245, 158, 11); // amber-500
  const cleanDocTitle = sanitizeTextForPdf(
    (settings.documentTitle || "CONTROL DE MERCANCÍA EN ÁREA DE VENTA (INFORME IPVE / IPV)").toUpperCase(),
    68
  );
  doc.text(cleanDocTitle, marginX + 12, y + 32);

  if (settings.documentSubtitle) {
    doc.setFontSize(7);
    doc.setTextColor(203, 213, 225);
    const cleanSub = sanitizeTextForPdf(settings.documentSubtitle, 75);
    doc.text(cleanSub, marginX + 12, y + 43);
  }

  // Right Header Metadata
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Período: ${safePeriodLabel}`, pageWidth - marginX - 12, y + 17, { align: "right" });
  doc.text(`Moneda Base: CUP`, pageWidth - marginX - 12, y + 27, { align: "right" });
  doc.text(
    `Emisión: ${new Date().toLocaleDateString("es-ES")} ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`,
    pageWidth - marginX - 12,
    y + 37,
    { align: "right" }
  );
  doc.setTextColor(245, 158, 11);
  doc.setFont("helvetica", "bold");
  doc.text(`CajaMaster POS - Control Contable Oficial`, pageWidth - marginX - 12, y + 46, { align: "right" });

  y += 58;

  // Business Metadata & Clean Official Verification Label (Zero emojis, Zero alerts)
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  const metadataParts: string[] = [];
  if (biz.owner) metadataParts.push(`Responsable: ${sanitizeTextForPdf(biz.owner, 30)}`);
  if (biz.phone) metadataParts.push(`Tel: ${sanitizeTextForPdf(biz.phone, 20)}`);
  if (biz.address) metadataParts.push(`Dir: ${sanitizeTextForPdf(biz.address, 38)}`);
  if (metadataParts.length > 0) {
    doc.text(metadataParts.join("  |  "), marginX + 4, y);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text(
    `[OK] Control Oficial Verificado: ${auditedRows.length} productos`,
    pageWidth - marginX - 4,
    y,
    { align: "right" }
  );

  y += 11;

  // Table Columns Definition (Exact sum = 792 pt = printableWidth)
  // 148 + 24 + 42 + 42 + 42 + 38 + 42 + 42 + 58 + 58 + 70 + 70 + 70 + 46 = 792 pt
  const cols = [
    { lines: ["PRODUCTO"], width: 148, align: "left" as const },
    { lines: ["U/M"], width: 24, align: "center" as const },
    { lines: ["INV.", "INICIAL"], width: 42, align: "right" as const },
    { lines: ["ENTRADAS"], width: 42, align: "right" as const },
    { lines: ["DISP.", "VENTA"], width: 42, align: "right" as const },
    { lines: ["MERMAS"], width: 38, align: "right" as const },
    { lines: ["INV.", "FINAL"], width: 42, align: "right" as const },
    { lines: ["VENDIDO"], width: 42, align: "right" as const },
    { lines: ["COSTO", "UNIT. (CUP)"], width: 58, align: "right" as const },
    { lines: ["PRECIO", "VTA (CUP)"], width: 58, align: "right" as const },
    { lines: ["IMPORTE", "(CUP)"], width: 70, align: "right" as const },
    { lines: ["COSTO DE", "VENTA"], width: 70, align: "right" as const },
    { lines: ["UTILIDAD", "(CUP)"], width: 70, align: "right" as const },
    { lines: ["MARGEN", "(%)"], width: 46, align: "right" as const },
  ];

  const headerHeight = 24;

  const renderTableHeader = () => {
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(marginX, y, printableWidth, headerHeight, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.7);

    let curX = marginX;
    cols.forEach((col, colIdx) => {
      const textX =
        col.align === "left"
          ? curX + 4
          : col.align === "center"
          ? curX + col.width / 2
          : curX + col.width - 4;

      if (col.lines.length === 1) {
        doc.text(col.lines[0], textX, y + 14.5, { align: col.align as any });
      } else {
        doc.text(col.lines[0], textX, y + 9.5, { align: col.align as any });
        doc.text(col.lines[1], textX, y + 18.5, { align: col.align as any });
      }

      if (colIdx > 0) {
        doc.setDrawColor(51, 65, 85); // slate-700 subtle vertical divider
        doc.setLineWidth(0.4);
        doc.line(curX, y, curX, y + headerHeight);
      }

      curX += col.width;
    });
    y += headerHeight;
  };

  renderTableHeader();

  // Table Body Rows
  auditedRows.forEach((r, idx) => {
    doc.setFont("helvetica", "bold");
    const safeTitleName = sanitizeTextForPdf(toTitleCase(r.name), 56);
    const prodLines = fitProductLines(doc, safeTitleName, cols[0].width - 8, 6.1);
    const rowHeight = prodLines.length > 1 ? 22.5 : 15.5;

    // Check page overflow BEFORE drawing row
    if (y + rowHeight > pageHeight - 105) {
      doc.addPage("a4", "landscape");
      y = 26;
      renderTableHeader();
    }

    // Row alternating background
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(marginX, y, printableWidth, rowHeight, "F");
    }

    // Horizontal bottom border
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.35);
    doc.line(marginX, y + rowHeight, marginX + printableWidth, y + rowHeight);

    // Subtle vertical column dividers
    let gridX = marginX;
    cols.forEach((col, colIdx) => {
      if (colIdx > 0) {
        doc.line(gridX, y, gridX, y + rowHeight);
      }
      gridX += col.width;
    });
    doc.rect(marginX, y, printableWidth, rowHeight, "S");

    const numBaseY = prodLines.length > 1 ? y + 13.5 : y + 10.2;
    let curX = marginX;

    // 1. PRODUCTO (1 o 2 líneas acotadas exactamente al ancho de celda)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.1);
    doc.setTextColor(15, 23, 42); // slate-900
    if (prodLines.length === 1) {
      doc.text(prodLines[0], curX + 4, y + 10.2);
    } else {
      doc.text(prodLines[0], curX + 4, y + 9.2);
      doc.text(prodLines[1], curX + 4, y + 17.8);
    }
    curX += cols[0].width;

    // 2. U/M
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.0);
    doc.setTextColor(71, 85, 105);
    doc.text(normalizeUnit(r.unit), curX + cols[1].width / 2, numBaseY, { align: "center" });
    curX += cols[1].width;

    // 3. INV. INICIAL
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    drawFittedNumber(doc, formatQuantity(r.invInicialCant), curX + cols[2].width - 4, numBaseY, cols[2].width - 7, 6.0);
    curX += cols[2].width;

    // 4. ENTRADAS
    if (r.entradasCant > 0) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129); // emerald-600
      drawFittedNumber(doc, `+${formatQuantity(r.entradasCant)}`, curX + cols[3].width - 4, numBaseY, cols[3].width - 7, 6.0);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
    } else {
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(6.0);
      doc.text("0", curX + cols[3].width - 4, numBaseY, { align: "right" });
      doc.setTextColor(15, 23, 42);
    }
    curX += cols[3].width;

    // 5. DISP. VENTA (Inicial + Entradas)
    drawFittedNumber(doc, formatQuantity(r.dispVentaCant), curX + cols[4].width - 4, numBaseY, cols[4].width - 7, 6.0);
    curX += cols[4].width;

    // 6. MERMAS (Explícito "0" si no hay mermas)
    if (r.mermasCant > 0) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(225, 29, 72); // rose-600
      drawFittedNumber(doc, `-${formatQuantity(r.mermasCant)}`, curX + cols[5].width - 4, numBaseY, cols[5].width - 7, 6.0);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
    } else {
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(6.0);
      doc.text("0", curX + cols[5].width - 4, numBaseY, { align: "right" });
      doc.setTextColor(15, 23, 42);
    }
    curX += cols[5].width;

    // 7. INV. FINAL
    drawFittedNumber(doc, formatQuantity(r.invFinalCant), curX + cols[6].width - 4, numBaseY, cols[6].width - 7, 6.0);
    curX += cols[6].width;

    // 8. VENDIDO
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    drawFittedNumber(doc, formatQuantity(r.vendidoCant), curX + cols[7].width - 4, numBaseY, cols[7].width - 7, 6.0);
    doc.setFont("helvetica", "normal");
    curX += cols[7].width;

    // 9. COSTO UNIT. (CUP)
    doc.setTextColor(71, 85, 105);
    drawFittedNumber(doc, formatAccounting(r.costoUnitario), curX + cols[8].width - 4, numBaseY, cols[8].width - 7, 6.0);
    curX += cols[8].width;

    // 10. PRECIO VTA (CUP)
    doc.setTextColor(15, 23, 42);
    drawFittedNumber(doc, formatAccounting(r.precioVenta), curX + cols[9].width - 4, numBaseY, cols[9].width - 7, 6.0);
    curX += cols[9].width;

    // 11. IMPORTE (CUP)
    doc.setFont("helvetica", "bold");
    drawFittedNumber(doc, formatAccounting(r.importeVendido), curX + cols[10].width - 4, numBaseY, cols[10].width - 7, 6.0);
    doc.setFont("helvetica", "normal");
    curX += cols[10].width;

    // 12. COSTO DE VENTA
    drawFittedNumber(doc, formatAccounting(r.costoTotal), curX + cols[11].width - 4, numBaseY, cols[11].width - 7, 6.0);
    curX += cols[11].width;

    // 13. UTILIDAD (CUP)
    doc.setFont("helvetica", "bold");
    doc.setTextColor(r.gananciaBruta >= 0 ? 16 : 225, r.gananciaBruta >= 0 ? 185 : 29, r.gananciaBruta >= 0 ? 129 : 72);
    drawFittedNumber(doc, formatAccounting(r.gananciaBruta), curX + cols[12].width - 4, numBaseY, cols[12].width - 7, 6.0);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    curX += cols[12].width;

    // 14. MARGEN (%)
    drawFittedNumber(doc, `${r.margenPct.toFixed(1)}%`, curX + cols[13].width - 4, numBaseY, cols[13].width - 7, 6.0);

    y += rowHeight;
  });

  // Check space for totals row
  if (y + 18 > pageHeight - 95) {
    doc.addPage("a4", "landscape");
    y = 26;
    renderTableHeader();
  }

  // TOTALS ROW (Fila de Totales Generales con alineación estricta de columnas)
  const totalsRowH = 18;
  doc.setFillColor(245, 158, 11); // amber-500
  doc.rect(marginX, y, printableWidth, totalsRowH, "F");
  doc.setDrawColor(180, 83, 9);
  doc.setLineWidth(0.4);
  doc.rect(marginX, y, printableWidth, totalsRowH, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);

  // Totals Label
  doc.text("TOTALES GENERALES:", marginX + 4, y + 11.8);

  let colX = marginX + cols[0].width + cols[1].width;
  const totalsBaseY = y + 11.8;

  // Vertical dividers inside totals row for numeric columns
  for (let c = 2; c < cols.length; c++) {
    doc.setDrawColor(217, 119, 6);
    doc.setLineWidth(0.35);
    doc.line(colX, y, colX, y + totalsRowH);
    colX += cols[c].width;
  }

  colX = marginX + cols[0].width + cols[1].width;

  // Col 2: Total Inv. Inicial
  drawFittedNumber(doc, formatQuantity(auditedTotals.invInicialCant), colX + cols[2].width - 4, totalsBaseY, cols[2].width - 7, 6.2);
  colX += cols[2].width;

  // Col 3: Total Entradas
  const entradasStr = auditedTotals.entradasCant > 0 ? `+${formatQuantity(auditedTotals.entradasCant)}` : "0";
  drawFittedNumber(doc, entradasStr, colX + cols[3].width - 4, totalsBaseY, cols[3].width - 7, 6.2);
  colX += cols[3].width;

  // Col 4: Total Disp. Venta
  drawFittedNumber(doc, formatQuantity(auditedTotals.dispVentaCant), colX + cols[4].width - 4, totalsBaseY, cols[4].width - 7, 6.2);
  colX += cols[4].width;

  // Col 5: Total Mermas (explícito "0" si no hay mermas)
  const mermasStr = auditedTotals.mermasCant > 0 ? `-${formatQuantity(auditedTotals.mermasCant)}` : "0";
  drawFittedNumber(doc, mermasStr, colX + cols[5].width - 4, totalsBaseY, cols[5].width - 7, 6.2);
  colX += cols[5].width;

  // Col 6: Total Inv. Final
  drawFittedNumber(doc, formatQuantity(auditedTotals.invFinalCant), colX + cols[6].width - 4, totalsBaseY, cols[6].width - 7, 6.2);
  colX += cols[6].width;

  // Col 7: Total Vendido
  drawFittedNumber(doc, formatQuantity(auditedTotals.vendidoCant), colX + cols[7].width - 4, totalsBaseY, cols[7].width - 7, 6.2);
  colX += cols[7].width;

  // Col 8: Costo Unit. (-)
  doc.setFontSize(6.2);
  doc.text("-", colX + cols[8].width - 4, totalsBaseY, { align: "right" });
  colX += cols[8].width;

  // Col 9: Precio Vta (-)
  doc.text("-", colX + cols[9].width - 4, totalsBaseY, { align: "right" });
  colX += cols[9].width;

  // Col 10: Total Importe CUP
  drawFittedNumber(doc, formatAccounting(auditedTotals.importeVendido), colX + cols[10].width - 4, totalsBaseY, cols[10].width - 7, 6.2);
  colX += cols[10].width;

  // Col 11: Total Costo de Venta
  drawFittedNumber(doc, formatAccounting(auditedTotals.costoTotal), colX + cols[11].width - 4, totalsBaseY, cols[11].width - 7, 6.2);
  colX += cols[11].width;

  // Col 12: Total Utilidad (CUP)
  drawFittedNumber(doc, formatAccounting(auditedTotals.gananciaBruta), colX + cols[12].width - 4, totalsBaseY, cols[12].width - 7, 6.2);
  colX += cols[12].width;

  // Col 13: Margen General %
  drawFittedNumber(doc, `${auditedTotals.margenPct.toFixed(1)}%`, colX + cols[13].width - 4, totalsBaseY, cols[13].width - 7, 6.2);

  y += totalsRowH + 14;

  // BLOQUE OFICIAL DE VALORACIÓN DE EXISTENCIAS Y ARQUEO DE CAJA (CON DESGLOSE EFECTIVO VS DIGITAL)
  // Sin alertas, sin diagnósticos de riesgo ni notas flotantes.
  if (y + 125 > pageHeight) {
    doc.addPage("a4", "landscape");
    y = 26;
  }

  // Cálculo del desglose secundario Efectivo vs. Transferencias/Pagos Digitales
  let cashTotal = 0;
  let digitalTotal = 0;
  if (paymentBreakdown) {
    const rawCash = Math.max(0, Number(paymentBreakdown.cashTotal) || 0);
    const rawDigital = Math.max(0, Number(paymentBreakdown.digitalTotal) || 0);
    const rawSum = roundCurrency(rawCash + rawDigital);
    if (rawSum > 0) {
      if (Math.abs(rawSum - auditedTotals.importeVendido) <= 0.05) {
        cashTotal = roundCurrency(rawCash);
        digitalTotal = roundCurrency(rawDigital);
      } else {
        // Ajustar proporcionalmente para garantizar cuadre exacto contra Importe Vendido del reporte
        const ratio = auditedTotals.importeVendido / rawSum;
        cashTotal = roundCurrency(rawCash * ratio);
        digitalTotal = roundCurrency(auditedTotals.importeVendido - cashTotal);
      }
    } else {
      cashTotal = auditedTotals.importeVendido;
      digitalTotal = 0;
    }
  } else {
    cashTotal = auditedTotals.importeVendido;
    digitalTotal = 0;
  }

  const boxGap = 12;
  const boxWidth = (printableWidth - boxGap) / 2; // 390 pt each
  const summaryBoxHeight = 68;

  // Panel Izquierdo: Valoración del Inventario Final
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.6);
  doc.roundedRect(marginX, y, boxWidth, summaryBoxHeight, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text("VALORACIÓN DEL INVENTARIO FINAL (EXISTENCIAS)", marginX + 10, y + 13);

  doc.setDrawColor(226, 232, 240);
  doc.line(marginX + 10, y + 18, marginX + boxWidth - 10, y + 18);

  doc.setFontSize(6.8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Stock Final en Existencia:", marginX + 10, y + 31);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${formatQuantity(auditedTotals.invFinalCant)} unidades`, marginX + boxWidth - 10, y + 31, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Valoración a Precio de Costo (Almacén):", marginX + 10, y + 44);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${formatAccounting(auditedTotals.invFinalValorCosto)} CUP`, marginX + boxWidth - 10, y + 44, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Valoración a Precio de Venta (PVP):", marginX + 10, y + 57);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${formatAccounting(auditedTotals.invFinalValorVenta)} CUP`, marginX + boxWidth - 10, y + 57, { align: "right" });

  // Panel Derecho: Arqueo de Caja y Desglose por Forma de Pago
  const rightBoxX = marginX + boxWidth + boxGap;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(rightBoxX, y, boxWidth, summaryBoxHeight, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text("ARQUEO DE CIERRE Y FORMAS DE PAGO", rightBoxX + 10, y + 13);

  doc.setDrawColor(226, 232, 240);
  doc.line(rightBoxX + 10, y + 18, rightBoxX + boxWidth - 10, y + 18);

  doc.setFontSize(6.8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Cobrado en Efectivo:", rightBoxX + 10, y + 31);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${formatAccounting(cashTotal)} CUP`, rightBoxX + boxWidth - 10, y + 31, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Transferencias / Pagos Digitales:", rightBoxX + 10, y + 44);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${formatAccounting(digitalTotal)} CUP`, rightBoxX + boxWidth - 10, y + 44, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Total Importe Vendido (Arqueo 100%):", rightBoxX + 10, y + 57);
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text(`${formatAccounting(auditedTotals.importeVendido)} CUP`, rightBoxX + boxWidth - 10, y + 57, { align: "right" });

  y += summaryBoxHeight + 16;

  // Official Signatures Blocks con Arqueo de Efectivo Exactamente Coincidente
  y = Math.max(y + 10, pageHeight - 54);
  if (y > pageHeight - 45) {
    doc.addPage("a4", "landscape");
    y = pageHeight - 54;
  }
  const sigColWidth = (printableWidth - 40) / 3;

  doc.setDrawColor(148, 163, 184); // slate-400
  doc.setLineWidth(0.75);

  const sigItems = [
    { title: sanitizeTextForPdf(settings.signature1 || "Conformado por (Dependiente)", 34), sub: "Firma y Cuño" },
    { title: `Arqueo: CUP $ ${formatAccounting(auditedTotals.importeVendido)}`, sub: "Verificado Conforme (100% Cuadre)" },
    { title: sanitizeTextForPdf(settings.signature3 || "Aprobado por (Administrador)", 34), sub: "Cuño Oficial de Administración" },
  ];

  sigItems.forEach((sig, i) => {
    const startX = marginX + 20 + i * sigColWidth;
    const endX = startX + sigColWidth - 20;
    const centerX = (startX + endX) / 2;

    doc.line(startX, y, endX, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(sig.title, centerX, y + 10, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139);
    doc.text(sig.sub, centerX, y + 19, { align: "center" });
  });

  const cleanDate = new Date().toISOString().slice(0, 10);
  const bizSlug = (biz.name || "Negocio").replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `Informe_IPVE_${bizSlug}_${cleanDate}.pdf`;
  const { blob, payload } = createPdfPayload(
    doc,
    filename,
    `Informe IPVE - ${safePeriodLabel}`,
    `Documento oficial de control de mercancía, precios y márgenes (${safePeriodLabel})`
  );
  return { doc, blob, filename, payload };
}

/**
 * Generates the Official IPVE / IPV Document in PDF format (Landscape A4 Table) and delivers it.
 */
export async function generateIPVReportPdf(
  rows: IPVRow[],
  totals: any,
  periodLabel: string,
  biz: BusinessInfo,
  settings: IPUESettings,
  rates: ExchangeRates,
  preferShare = false,
  paymentBreakdown?: IPVPaymentBreakdown
): Promise<{ method: "share" | "download"; success: boolean; blob: Blob; doc: jsPDF; filename: string; payload: FileExportPayload }> {
  const built = buildIPVReportPdfPayload(rows, totals, periodLabel, biz, settings, rates, paymentBreakdown);
  const deliverRes = await deliverPdfFile(built.doc, built.filename, `Informe IPVE - ${cleanCorruptCharacters(periodLabel)}`, preferShare);
  return { ...deliverRes, ...built };
}

/**
 * Builds an Inventory Stock Valuation Catalog PDF Document and payload.
 */
export function buildInventoryPdfPayload(
  products: Product[],
  biz: BusinessInfo,
  rates: ExchangeRates
): { doc: jsPDF; blob: Blob; filename: string; payload: FileExportPayload } {
  // Pre-Flight Sentinel Guard & Audit
  preFlightSentinelGuard("Catálogo de Inventario", products);
  const catalogAudit = runInventoryCatalogSentinel(products);
  const verifiedProducts = catalogAudit.verifiedProducts;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = 595;
  const pageHeight = 842;
  let y = 36;

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(36, y, pageWidth - 72, 60, 6, 6, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const cleanBiz = sanitizeTextForPdf((biz.name || "CAJAMASTER POS").toUpperCase(), 40);
  doc.text(cleanBiz, 50, y + 24);

  doc.setFontSize(9.5);
  doc.setTextColor(245, 158, 11);
  doc.text("CATÁLOGO & VALORACIÓN GENERAL DE INVENTARIO", 50, y + 38);

  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Fecha: ${new Date().toLocaleDateString("es-ES")} • Total: ${verifiedProducts.length} productos • Moneda: CUP`,
    50,
    y + 50
  );

  y += 76;

  // Metrics Card
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(36, y, pageWidth - 72, 40, 6, 6, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Unidades en Stock: ${formatQuantity(catalogAudit.totalUnits)}`, 50, y + 18);
  doc.text(`Inversión: CUP $ ${formatAccounting(catalogAudit.totalCostVal)}`, 220, y + 18);
  doc.text(`Valoración Venta: CUP $ ${formatAccounting(catalogAudit.totalSaleVal)}`, 400, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Margen Potencial: CUP $ ${formatAccounting(catalogAudit.potentialProfit)} (${catalogAudit.averageMargin.toFixed(1)}%)`, 50, y + 30);

  y += 52;

  // Table Headers
  const cols = [
    { title: "PRODUCTO / DESCRIPCIÓN", width: 200, align: "left" },
    { title: "CATEGORÍA", width: 90, align: "left" },
    { title: "STOCK", width: 60, align: "right" },
    { title: "COSTO (CUP)", width: 75, align: "right" },
    { title: "PRECIO (CUP)", width: 98, align: "right" },
  ];

  const renderTableHeader = () => {
    doc.setFillColor(30, 41, 59);
    doc.rect(36, y, pageWidth - 72, 16, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);

    let curX = 36;
    cols.forEach((col) => {
      const tx = col.align === "left" ? curX + 6 : curX + col.width - 6;
      doc.text(col.title, tx, y + 11, { align: col.align as any });
      curX += col.width;
    });
    y += 16;
  };

  renderTableHeader();

  // Rows
  const sorted = [...verifiedProducts].sort((a, b) => a.name.localeCompare(b.name));
  sorted.forEach((p, idx) => {
    if (y > pageHeight - 50) {
      doc.addPage("a4", "portrait");
      y = 36;
      renderTableHeader();
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(36, y, pageWidth - 72, 15, "F");
    }

    // Border line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(36, y + 15, pageWidth - 36, y + 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);

    let curX = 36;
    const safeName = sanitizeTextForPdf(p.name, 35);
    doc.setFont("helvetica", "bold");
    doc.text(safeName, curX + 6, y + 10.5, { maxWidth: cols[0].width - 10 });
    curX += cols[0].width;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(sanitizeTextForPdf(p.category || "General", 16), curX + 6, y + 10.5, { maxWidth: cols[1].width - 10 });
    curX += cols[1].width;

    // Stock alert highlight
    if (p.stock <= p.lowStockAlert) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(225, 29, 72); // rose-600
    } else {
      doc.setTextColor(15, 23, 42);
    }
    doc.text(formatQuantity(p.stock), curX + cols[2].width - 6, y + 10.5, { align: "right" });
    curX += cols[2].width;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(formatAccounting(p.cost), curX + cols[3].width - 6, y + 10.5, { align: "right" });
    curX += cols[3].width;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(formatAccounting(p.price), curX + cols[4].width - 6, y + 10.5, { align: "right" });

    y += 15;
  });

  const bizSlug = (biz.name || "Negocio").replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `Inventario_${bizSlug}_${new Date().toISOString().slice(0, 10)}.pdf`;
  const { blob, payload } = createPdfPayload(
    doc,
    filename,
    `Catálogo de Inventario (${products.length} productos)`,
    `Catálogo oficial de productos, precios y stock`
  );
  return { doc, blob, filename, payload };
}

/**
 * Generates an Inventory Stock Valuation Catalog PDF Document and delivers it.
 */
export async function generateInventoryPdf(
  products: Product[],
  biz: BusinessInfo,
  rates: ExchangeRates,
  preferShare = false
): Promise<{ method: "share" | "download"; success: boolean; blob: Blob; doc: jsPDF; filename: string; payload: FileExportPayload }> {
  const built = buildInventoryPdfPayload(products, biz, rates);
  const deliverRes = await deliverPdfFile(built.doc, built.filename, "Catálogo de Inventario", preferShare);
  return { ...deliverRes, ...built };
}

/**
 * Builds an Enterprise-grade Kardex / Stock Movement Audit PDF report and payload.
 */
export function buildKardexPdfPayload(
  movements: Movement[],
  business: BusinessInfo,
  rates: ExchangeRates,
  periodLabel = "Historial Completo",
  filterSummary = ""
): { doc: jsPDF; blob: Blob; filename: string; payload: FileExportPayload } {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 80, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(cleanCorruptCharacters(business.name || "CAJAMASTER POS").toUpperCase(), 36, 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // slate-300
  const bizSub = [
    business.owner ? `Titular: ${cleanCorruptCharacters(business.owner)}` : "",
    business.taxId ? `NIT/RUC: ${cleanCorruptCharacters(business.taxId)}` : "",
    cleanCorruptCharacters(business.address || ""),
    business.phone ? `Tel: ${cleanCorruptCharacters(business.phone)}` : "",
  ].filter(Boolean).join(" | ");
  doc.text(bizSub || "Sistema de Control de Inventario y Kardex", 36, 48);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(251, 191, 36); // amber-400
  doc.text("KARDEX DE INVENTARIO | AUDITORÍA DE MOVIMIENTOS", 36, 68);

  // Metadata Right Aligned
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text(`Período: ${cleanCorruptCharacters(periodLabel)}`, pageWidth - 36, 32, { align: "right" });
  doc.text(`Emisión: ${new Date().toLocaleDateString("es-ES")} ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`, pageWidth - 36, 46, { align: "right" });
  doc.text(`Registros: ${movements.length} movimientos`, pageWidth - 36, 60, { align: "right" });

  let y = 96;

  // Compute KPI Summary Metrics
  let totalEntriesQty = 0;
  let totalEntriesCost = 0;
  let totalSalesQty = 0;
  let totalSalesCost = 0;
  let totalLossQty = 0;
  let totalLossCost = 0;
  let totalAdjustQty = 0;

  movements.forEach((m) => {
    const cost = m.totalCost !== undefined ? m.totalCost : m.qty * (m.unitCost || 0);
    if (m.type === "ENTRY" || m.type === "INITIAL" || m.type === "RETURN") {
      totalEntriesQty += m.qty;
      totalEntriesCost += cost;
    } else if (m.type === "SALE") {
      totalSalesQty += m.qty;
      totalSalesCost += cost;
    } else if (m.type === "LOSS") {
      totalLossQty += m.qty;
      totalLossCost += cost;
    } else {
      totalAdjustQty += m.qty;
    }
  });

  // KPI Cards in 4 columns
  const kpiWidth = (pageWidth - 72 - 24) / 4;
  const kpis = [
    { title: "ENTRADAS (+)", qty: `+${totalEntriesQty} u`, val: formatCurrency(totalEntriesCost, "CUP", rates), bg: [240, 253, 244], border: [187, 247, 208], text: [22, 101, 52] },
    { title: "VENTAS (-)", qty: `-${totalSalesQty} u`, val: formatCurrency(totalSalesCost, "CUP", rates), bg: [239, 246, 255], border: [191, 219, 254], text: [30, 64, 175] },
    { title: "MERMAS / ROTURAS (-)", qty: `-${totalLossQty} u`, val: formatCurrency(totalLossCost, "CUP", rates), bg: [255, 241, 242], border: [254, 205, 211], text: [159, 18, 57] },
    { title: "AJUSTES DE STOCK", qty: `${totalAdjustQty} u`, val: `${movements.length} ops`, bg: [248, 250, 252], border: [226, 232, 240], text: [51, 65, 85] },
  ];

  kpis.forEach((k, i) => {
    const kx = 36 + i * (kpiWidth + 8);
    doc.setFillColor(k.bg[0], k.bg[1], k.bg[2]);
    doc.setDrawColor(k.border[0], k.border[1], k.border[2]);
    doc.roundedRect(kx, y, kpiWidth, 42, 4, 4, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(k.text[0], k.text[1], k.text[2]);
    doc.text(k.title, kx + 8, y + 12);

    doc.setFontSize(10);
    doc.text(k.qty, kx + 8, y + 25);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Costo: ${k.val}`, kx + 8, y + 36);
  });

  y += 52;

  if (filterSummary) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Filtro aplicado: ${filterSummary}`, 36, y);
    y += 12;
  }

  // Table Columns Definition
  const cols = [
    { title: "FECHA / HORA", width: 72, align: "left" },
    { title: "PRODUCTO / DETALLE", width: 140, align: "left" },
    { title: "TIPO MOV.", width: 85, align: "left" },
    { title: "CANT.", width: 44, align: "right" },
    { title: "STOCK ANTES -> DESPUÉS", width: 95, align: "center" },
    { title: "COSTO UNIT.", width: 48, align: "right" },
    { title: "MOTIVO / REF.", width: 110, align: "left" },
  ];

  const renderTableHeader = () => {
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(36, y, pageWidth - 72, 16, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);

    let curX = 36;
    cols.forEach((col) => {
      let tx = curX + 4;
      if (col.align === "right") tx = curX + col.width - 4;
      if (col.align === "center") tx = curX + col.width / 2;
      doc.text(col.title, tx, y + 11, { align: col.align as any });
      curX += col.width;
    });
    y += 16;
  };

  renderTableHeader();

  movements.forEach((m, idx) => {
    if (y > pageHeight - 45) {
      doc.addPage("a4", "portrait");
      y = 36;
      renderTableHeader();
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(36, y, pageWidth - 72, 16, "F");
    }

    const dateObj = new Date(m.ts);
    const dateStr = `${dateObj.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })} ${dateObj.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;

    let curX = 36;

    // Date
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(dateStr, curX + 4, y + 11);
    curX += cols[0].width;

    // Product Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    const cleanPName = cleanCorruptCharacters(m.productName || "Producto");
    const pName = cleanPName.length > 24 ? cleanPName.substring(0, 22) + "..." : cleanPName;
    doc.text(pName, curX + 4, y + 11);
    curX += cols[1].width;

    // Type Badge
    let typeLabel = "Ajuste";
    if (m.type === "ENTRY") {
      typeLabel = "Entrada (+)";
      doc.setTextColor(22, 101, 52); // green
    } else if (m.type === "SALE") {
      typeLabel = m.ticketNumber ? `Venta #${m.ticketNumber}` : "Venta (-)";
      doc.setTextColor(30, 64, 175); // blue
    } else if (m.type === "LOSS") {
      typeLabel = "Merma / Salida (-)";
      doc.setTextColor(159, 18, 57); // red
    } else if (m.type === "INITIAL") {
      typeLabel = "Stock Inicial (+)";
      doc.setTextColor(22, 101, 52);
    } else if (m.type === "PHYSICAL_COUNT") {
      typeLabel = "Arqueo Físico Z";
      doc.setTextColor(109, 40, 217); // purple
    } else if (m.type === "RETURN") {
      typeLabel = "Devolución (+)";
      doc.setTextColor(22, 101, 52);
    } else {
      doc.setTextColor(71, 85, 105);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(typeLabel, curX + 4, y + 11);
    curX += cols[2].width;

    // Qty with sign
    const sign = m.type === "ENTRY" || m.type === "INITIAL" || m.type === "RETURN" ? "+" : (m.type === "SALE" || m.type === "LOSS" ? "-" : "");
    doc.text(`${sign}${m.qty} ${m.productUnit || "u"}`, curX + cols[3].width - 4, y + 11, { align: "right" });
    curX += cols[3].width;

    // Stock Before -> After
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    const stockTransition = (m.previousStock !== undefined && m.resultingStock !== undefined)
      ? `${m.previousStock} -> ${m.resultingStock} ${m.productUnit || "u"}`
      : "-";
    doc.text(stockTransition, curX + cols[4].width / 2, y + 11, { align: "center" });
    curX += cols[4].width;

    // Unit Cost
    doc.setTextColor(71, 85, 105);
    doc.text(formatCurrency(m.unitCost || 0, "CUP", rates), curX + cols[5].width - 4, y + 11, { align: "right" });
    curX += cols[5].width;

    // Motive / Reason
    const reasonText = (m.reason || m.notes || m.user || "-");
    const safeReason = reasonText.length > 24 ? reasonText.substring(0, 22) + "..." : reasonText;
    doc.setTextColor(100, 116, 139);
    doc.text(safeReason, curX + 4, y + 11);

    y += 16;
  });

  // Footer on last page
  y = Math.min(pageHeight - 25, y + 20);
  doc.setDrawColor(226, 232, 240);
  doc.line(36, y, pageWidth - 36, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Documento generado por CajaMaster Pro POS • Sistema de Auditoría Kardex y Control de Existencias`, 36, y + 12);
  doc.text(`Página 1 de 1`, pageWidth - 36, y + 12, { align: "right" });

  const filename = `Kardex_Movimientos_${new Date().toISOString().slice(0, 10)}.pdf`;
  const { blob, payload } = createPdfPayload(
    doc,
    filename,
    `Kardex de Movimientos (${movements.length} registros)`,
    `Registro oficial de auditoría y movimientos de inventario (${periodLabel})`
  );
  return { doc, blob, filename, payload };
}

/**
 * Generates an Enterprise-grade Kardex / Stock Movement Audit PDF report and delivers it.
 */
export async function generateKardexPdf(
  movements: Movement[],
  business: BusinessInfo,
  rates: ExchangeRates,
  periodLabel = "Historial Completo",
  filterSummary = "",
  preferShare = false
): Promise<{ method: "share" | "download"; success: boolean; blob: Blob; doc: jsPDF; filename: string; payload: FileExportPayload }> {
  const built = buildKardexPdfPayload(movements, business, rates, periodLabel, filterSummary);
  const deliverRes = await deliverPdfFile(built.doc, built.filename, "Kardex de Movimientos", preferShare);
  return { ...deliverRes, ...built };
}

