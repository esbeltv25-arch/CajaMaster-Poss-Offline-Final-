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
  doc.text((biz.name || "CAJAMASTER POS").toUpperCase(), pageWidth / 2, 22, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(245, 158, 11); // #F59E0B
  doc.text("COMPROBANTE OFICIAL DE VENTA", pageWidth / 2, 33, { align: "center" });

  y = 52;
  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  if (biz.address) {
    doc.text(biz.address, pageWidth / 2, y, { align: "center" });
    y += 10;
  }
  if (biz.phone) {
    doc.text(`Tel: ${biz.phone}`, pageWidth / 2, y, { align: "center" });
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
    const nameText = item.name.length > 24 ? item.name.substring(0, 22) + "..." : item.name;
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
  doc.text(biz.name ? biz.name.toUpperCase() : "ESTABLECIMIENTO COMERCIAL", 54, y + 24);

  doc.setFontSize(9.5);
  doc.setTextColor(245, 158, 11);
  doc.text("INFORME Z - CIERRE DE CAJA & ARQUEO DIARIO", 54, y + 39);

  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Fecha: ${closing.date} • Hora: ${new Date(closing.closedAt).toLocaleTimeString("es-ES")} • CajaMaster POS`,
    54,
    y + 51
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(52, 211, 153);
  doc.text("✓ AUDITORÍA CONTABLE & MATEMÁTICA VERIFICADA", 54, y + 62);

  y += 86;

  // Business Info & Responsable
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (biz.owner) doc.text(`Responsable: ${biz.owner}`, 40, y);
  if (biz.phone) doc.text(`Tel: ${biz.phone}`, 240, y);
  if (biz.address) doc.text(`Dirección: ${biz.address}`, 400, y);
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
    doc.text(`+${closing.cashDiscrepancy.toFixed(2)} CUP (Sobrante)`, 480, y + 90, { align: "right" });
  } else {
    doc.setTextColor(225, 29, 72);
    doc.text(`${closing.cashDiscrepancy.toFixed(2)} CUP (Faltante)`, 480, y + 90, { align: "right" });
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

/**
 * Builds the Official IPVE / IPV Document PDF and payload (Landscape A4 Table).
 */
export function buildIPVReportPdfPayload(
  rows: IPVRow[],
  totals: any,
  periodLabel: string,
  biz: BusinessInfo,
  settings: IPUESettings,
  rates: ExchangeRates
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
  const cleanDocTitle = sanitizeTextForPdf((settings.documentTitle || "CONTROL DE MERCANCÍA EN ÁREA DE VENTA (INFORME IPVE / IPV)").toUpperCase(), 60);
  doc.text(cleanDocTitle, marginX + 12, y + 32);

  if (settings.documentSubtitle) {
    doc.setFontSize(7);
    doc.setTextColor(203, 213, 225);
    const cleanSub = sanitizeTextForPdf(settings.documentSubtitle, 70);
    doc.text(cleanSub, marginX + 12, y + 43);
  }

  // Right Header Metadata
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Período: ${periodLabel}`, pageWidth - marginX - 12, y + 17, { align: "right" });
  doc.text(`Moneda Base: CUP`, pageWidth - marginX - 12, y + 27, { align: "right" });
  doc.text(`Emisión: ${new Date().toLocaleDateString("es-ES")} ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`, pageWidth - marginX - 12, y + 37, { align: "right" });
  doc.setTextColor(245, 158, 11);
  doc.setFont("helvetica", "bold");
  doc.text(`CajaMaster POS • Sentinel Activo`, pageWidth - marginX - 12, y + 46, { align: "right" });

  y += 58;

  // Business Metadata & Sentinel Status Row
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  const metadataParts = [];
  if (biz.owner) metadataParts.push(`Responsable: ${sanitizeTextForPdf(biz.owner, 30)}`);
  if (biz.phone) metadataParts.push(`Tel: ${sanitizeTextForPdf(biz.phone, 20)}`);
  if (biz.address) metadataParts.push(`Dir: ${sanitizeTextForPdf(biz.address, 35)}`);
  if (metadataParts.length > 0) {
    doc.text(metadataParts.join("  •  "), marginX + 4, y);
  }

  // Sentinel Badge on the right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(16, 185, 129); // emerald-600
  const sentinelTag = sentinel.healedCount > 0
    ? `🛡️ Sentinel: ${auditedRows.length} ítems auditados (${sentinel.healedCount} autocorrecciones aplicadas)`
    : `🛡️ Sentinel: ${auditedRows.length} ítems auditados con 100% de consistencia`;
  doc.text(sentinelTag, pageWidth - marginX - 4, y, { align: "right" });

  y += 11;

  // Table Columns Definition (Exact sum = 792 pt, matching printableWidth exactly)
  // 138 + 22 + 42 + 42 + 44 + 40 + 44 + 42 + 54 + 54 + 70 + 72 + 68 + 40 = 792 pt
  const cols = [
    { title: "PRODUCTO", width: 138, align: "left" },
    { title: "U/M", width: 22, align: "center" },
    { title: "INV. INIC.", width: 42, align: "right" },
    { title: "ENTRADAS", width: 42, align: "right" },
    { title: "DISP. VTA", width: 44, align: "right" },
    { title: "MERMAS", width: 40, align: "right" },
    { title: "INV. FINAL", width: 44, align: "right" },
    { title: "VENDIDO", width: 42, align: "right" },
    { title: "COSTO UNIT.", width: 54, align: "right" },
    { title: "PRECIO VTA", width: 54, align: "right" },
    { title: "IMPORTE (CUP)", width: 70, align: "right" },
    { title: "COSTO DE VENTA", width: 72, align: "right" },
    { title: "UTILIDAD (CUP)", width: 68, align: "right" },
    { title: "MARGEN", width: 40, align: "right" },
  ];

  const renderTableHeader = () => {
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(marginX, y, printableWidth, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.9);

    let curX = marginX;
    cols.forEach((col) => {
      const textX =
        col.align === "left"
          ? curX + 4
          : col.align === "center"
          ? curX + col.width / 2
          : curX + col.width - 4;
      doc.text(col.title, textX, y + 11.5, { align: col.align as any });
      curX += col.width;
    });
    y += 18;
  };

  renderTableHeader();

  // Table Body Rows
  const rowHeight = 14.5;

  auditedRows.forEach((r, idx) => {
    // Check page overflow
    if (y > pageHeight - 95) {
      doc.addPage("a4", "landscape");
      y = 26;
      renderTableHeader();
    }

    // Row alternating background
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(marginX, y, printableWidth, rowHeight, "F");
    }

    // Grid divider lines
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.35);
    doc.line(marginX, y + rowHeight, marginX + printableWidth, y + rowHeight);

    let curX = marginX;

    // 1. PRODUCTO (Title Case, sanitizado sin saltos de línea y acotado al ancho de celda)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.1);
    doc.setTextColor(15, 23, 42); // slate-900
    const safeTitleName = sanitizeTextForPdf(toTitleCase(r.name), 30);
    doc.text(safeTitleName, curX + 4, y + 10, { maxWidth: cols[0].width - 8 });
    curX += cols[0].width;

    // 2. U/M (Estrictamente normalizado a "U" u otra unidad limpia)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.0);
    doc.setTextColor(71, 85, 105);
    doc.text(normalizeUnit(r.unit), curX + cols[1].width / 2, y + 10, { align: "center" });
    curX += cols[1].width;

    // 3. INV. INICIAL (Cantidad limpia sin 'u' pegada para evitar 'Ou')
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(formatQuantity(r.invInicialCant), curX + cols[2].width - 4, y + 10, { align: "right" });
    curX += cols[2].width;

    // 4. ENTRADAS
    if (r.entradasCant > 0) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129); // emerald-600
      doc.text(`+${formatQuantity(r.entradasCant)}`, curX + cols[3].width - 4, y + 10, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
    } else {
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text("-", curX + cols[3].width - 4, y + 10, { align: "right" });
      doc.setTextColor(15, 23, 42);
    }
    curX += cols[3].width;

    // 5. DISP. VTA (Inicial + Entradas)
    doc.text(formatQuantity(r.dispVentaCant), curX + cols[4].width - 4, y + 10, { align: "right" });
    curX += cols[4].width;

    // 6. MERMAS (Bajas, roturas y ajustes autorizados)
    if (r.mermasCant > 0) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(225, 29, 72); // rose-600
      doc.text(`-${formatQuantity(r.mermasCant)}`, curX + cols[5].width - 4, y + 10, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
    } else {
      doc.setTextColor(148, 163, 184);
      doc.text("-", curX + cols[5].width - 4, y + 10, { align: "right" });
      doc.setTextColor(15, 23, 42);
    }
    curX += cols[5].width;

    // 7. INV. FINAL (Disp - Mermas - Vendido)
    doc.text(formatQuantity(r.invFinalCant), curX + cols[6].width - 4, y + 10, { align: "right" });
    curX += cols[6].width;

    // 8. VENDIDO
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(formatQuantity(r.vendidoCant), curX + cols[7].width - 4, y + 10, { align: "right" });
    doc.setFont("helvetica", "normal");
    curX += cols[7].width;

    // 9. COSTO UNIT. (Costo unitario de adquisición para cruce fiscal)
    doc.setTextColor(71, 85, 105);
    doc.text(formatAccounting(r.costoUnitario), curX + cols[8].width - 4, y + 10, { align: "right" });
    curX += cols[8].width;

    // 10. PRECIO VTA (Precio de venta unitario)
    doc.setTextColor(15, 23, 42);
    doc.text(formatAccounting(r.precioVenta), curX + cols[9].width - 4, y + 10, { align: "right" });
    curX += cols[9].width;

    // 11. IMPORTE (CUP)
    doc.setFont("helvetica", "bold");
    doc.text(formatAccounting(r.importeVendido), curX + cols[10].width - 4, y + 10, { align: "right" });
    doc.setFont("helvetica", "normal");
    curX += cols[10].width;

    // 12. COSTO DE VENTA (Mercancía que salió: Vendido * Costo Unitario)
    doc.text(formatAccounting(r.costoTotal), curX + cols[11].width - 4, y + 10, { align: "right" });
    curX += cols[11].width;

    // 13. UTILIDAD (CUP) (Ganancia neta en dinero: Importe - Costo de Venta)
    doc.setFont("helvetica", "bold");
    doc.setTextColor(r.gananciaBruta >= 0 ? 16 : 225, r.gananciaBruta >= 0 ? 185 : 29, r.gananciaBruta >= 0 ? 129 : 72);
    doc.text(formatAccounting(r.gananciaBruta), curX + cols[12].width - 4, y + 10, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    curX += cols[12].width;

    // 14. MARGEN %
    doc.text(`${r.margenPct.toFixed(1)}%`, curX + cols[13].width - 4, y + 10, { align: "right" });

    y += rowHeight;
  });

  // TOTALS ROW (Fila de Totales Generales con Ancho Completo y Cero Desbordamiento)
  doc.setFillColor(245, 158, 11); // amber-500
  doc.rect(marginX, y, printableWidth, 17, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.4);
  doc.setTextColor(15, 23, 42);

  // Totals Label
  doc.text("TOTALES GENERALES:", marginX + 4, y + 11.5);

  let colX = marginX + cols[0].width + cols[1].width;

  // Col 2: Total Inv. Inicial
  doc.text(formatQuantity(auditedTotals.invInicialCant), colX + cols[2].width - 4, y + 11.5, { align: "right" });
  colX += cols[2].width;

  // Col 3: Total Entradas
  const entradasStr = auditedTotals.entradasCant > 0 ? `+${formatQuantity(auditedTotals.entradasCant)}` : "-";
  doc.text(entradasStr, colX + cols[3].width - 4, y + 11.5, { align: "right" });
  colX += cols[3].width;

  // Col 4: Total Disp. Venta
  doc.text(formatQuantity(auditedTotals.dispVentaCant), colX + cols[4].width - 4, y + 11.5, { align: "right" });
  colX += cols[4].width;

  // Col 5: Total Mermas
  const mermasStr = auditedTotals.mermasCant > 0 ? `-${formatQuantity(auditedTotals.mermasCant)}` : "-";
  doc.text(mermasStr, colX + cols[5].width - 4, y + 11.5, { align: "right" });
  colX += cols[5].width;

  // Col 6: Total Inv. Final
  doc.text(formatQuantity(auditedTotals.invFinalCant), colX + cols[6].width - 4, y + 11.5, { align: "right" });
  colX += cols[6].width;

  // Col 7: Total Vendido
  doc.text(formatQuantity(auditedTotals.vendidoCant), colX + cols[7].width - 4, y + 11.5, { align: "right" });
  colX += cols[7].width;

  // Col 8: Costo Unit. (-)
  doc.text("-", colX + cols[8].width - 4, y + 11.5, { align: "right" });
  colX += cols[8].width;

  // Col 9: Precio Vta (-)
  doc.text("-", colX + cols[9].width - 4, y + 11.5, { align: "right" });
  colX += cols[9].width;

  // Col 10: Total Importe CUP
  doc.text(formatAccounting(auditedTotals.importeVendido), colX + cols[10].width - 4, y + 11.5, { align: "right" });
  colX += cols[10].width;

  // Col 11: Total Costo de Venta
  doc.text(formatAccounting(auditedTotals.costoTotal), colX + cols[11].width - 4, y + 11.5, { align: "right" });
  colX += cols[11].width;

  // Col 12: Total Utilidad (CUP)
  doc.text(formatAccounting(auditedTotals.gananciaBruta), colX + cols[12].width - 4, y + 11.5, { align: "right" });
  colX += cols[12].width;

  // Col 13: Margen General %
  doc.text(`${auditedTotals.margenPct.toFixed(1)}%`, colX + cols[13].width - 4, y + 11.5, { align: "right" });

  y += 24;

  // Observaciones & Custom Notes
  if (settings.customNotes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Observaciones:", marginX + 4, y);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(sanitizeTextForPdf(settings.customNotes, 160), marginX + 4, y, { maxWidth: printableWidth - 8 });
    y += 14;
  }

  // Official Signatures Blocks (3 signatures)
  y = Math.max(y + 12, pageHeight - 75);
  const sigColWidth = (printableWidth - 40) / 3;

  doc.setDrawColor(148, 163, 184); // slate-400
  doc.setLineWidth(0.75);

  [settings.signature1, settings.signature2, settings.signature3].forEach((sigText, i) => {
    const startX = marginX + 20 + i * sigColWidth;
    const endX = startX + sigColWidth - 20;
    const centerX = (startX + endX) / 2;

    doc.line(startX, y, endX, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    const cleanSig = sanitizeTextForPdf(sigText || `Firma ${i + 1}`, 30);
    doc.text(cleanSig, centerX, y + 11, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const subLabel = i === 0 ? "Firma y Cuño" : i === 1 ? "Verificado Conforme" : "Auditoría y Cierre";
    doc.text(subLabel, centerX, y + 20, { align: "center" });
  });

  const cleanDate = new Date().toISOString().slice(0, 10);
  const bizSlug = (biz.name || "Negocio").replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `Informe_IPVE_${bizSlug}_${cleanDate}.pdf`;
  const { blob, payload } = createPdfPayload(
    doc,
    filename,
    `Informe IPVE - ${periodLabel}`,
    `Documento oficial de control de mercancía, precios y márgenes (${periodLabel})`
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
  preferShare = false
): Promise<{ method: "share" | "download"; success: boolean; blob: Blob; doc: jsPDF; filename: string; payload: FileExportPayload }> {
  const built = buildIPVReportPdfPayload(rows, totals, periodLabel, biz, settings, rates);
  const deliverRes = await deliverPdfFile(built.doc, built.filename, `Informe IPVE - ${periodLabel}`, preferShare);
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
  doc.text((business.name || "CAJAMASTER POS").toUpperCase(), 36, 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // slate-300
  const bizSub = [
    business.owner ? `Titular: ${business.owner}` : "",
    business.taxId ? `NIT/RUC: ${business.taxId}` : "",
    business.address || "",
    business.phone ? `Tel: ${business.phone}` : "",
  ].filter(Boolean).join(" • ");
  doc.text(bizSub || "Sistema de Control de Inventario y Kardex", 36, 48);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(251, 191, 36); // amber-400
  doc.text("KARDEX DE INVENTARIO • AUDITORÍA DE MOVIMIENTOS", 36, 68);

  // Metadata Right Aligned
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text(`Período: ${periodLabel}`, pageWidth - 36, 32, { align: "right" });
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
    const pName = (m.productName || "Producto").length > 24 ? (m.productName || "Producto").substring(0, 22) + "..." : (m.productName || "Producto");
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

