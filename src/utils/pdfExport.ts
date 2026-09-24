import jsPDF from "jspdf";
import type { Sale, DailyClosing, BusinessInfo, ExchangeRates, Product, Movement } from "../types";
import type { IPVRow } from "./ipv";
import { formatCurrency } from "./currency";

export interface IPUESettings {
  documentTitle: string;
  documentSubtitle: string;
  signature1: string;
  signature2: string;
  signature3: string;
  customNotes: string;
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
  const file = new File([pdfBlob], filename, { type: "application/pdf" });

  if (preferShare && typeof navigator !== "undefined" && navigator.share) {
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          files: [file],
        });
        return { method: "share", success: true };
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.warn("Native share failed, falling back to download:", err);
      } else {
        return { method: "share", success: false };
      }
    }
  }

  // Direct download / save to storage (internal or external USB/SD)
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);

  return { method: "download", success: true };
}

/**
 * Generates a clean, high-contrast POS Receipt Ticket PDF (80mm width standard).
 */
export async function generateTicketPdf(
  sale: Sale,
  biz: BusinessInfo,
  rates: ExchangeRates,
  preferShare = false
): Promise<{ method: "share" | "download"; success: boolean }> {
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
  return deliverPdfFile(doc, filename, `Ticket #${ticketNum}`, preferShare);
}

/**
 * Generates an executive Z-Report / Daily Closing PDF Document.
 */
export async function generateZReportPdf(
  closing: DailyClosing,
  biz: BusinessInfo,
  rates: ExchangeRates,
  preferShare = false
): Promise<{ method: "share" | "download"; success: boolean }> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4", // 595 x 842 pt
  });

  const pageWidth = 595;
  let y = 36;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(36, y, pageWidth - 72, 65, 8, 8, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(biz.name ? biz.name.toUpperCase() : "ESTABLECIMIENTO COMERCIAL", 54, y + 26);

  doc.setFontSize(10);
  doc.setTextColor(245, 158, 11);
  doc.text("INFORME Z - CIERRE DE CAJA & ARQUEO DIARIO", 54, y + 42);

  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Fecha: ${closing.date} • Hora: ${new Date(closing.closedAt).toLocaleTimeString("es-ES")} • Emitido por CajaMaster POS`,
    54,
    y + 54
  );

  y += 82;

  // Business Info & Responsable
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (biz.owner) doc.text(`Responsable: ${biz.owner}`, 40, y);
  if (biz.phone) doc.text(`Tel: ${biz.phone}`, 240, y);
  if (biz.address) doc.text(`Dirección: ${biz.address}`, 400, y);
  y += 18;

  // SECTION 1: BALANCE DE CAJA Y VENTAS
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(36, y, pageWidth - 72, 110, 6, 6, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("1. RESUMEN DE VENTAS Y EFECTIVO EN CAJA", 48, y + 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);

  doc.text("Fondo de Caja Inicial:", 48, y + 40);
  doc.text(formatCurrency(closing.openingCash, "CUP", rates), 200, y + 40, { align: "right" });

  doc.text("Ventas en Efectivo:", 48, y + 56);
  doc.text(formatCurrency(closing.cashSales, "CUP", rates), 200, y + 56, { align: "right" });

  doc.text("Ventas por Transferencia:", 48, y + 72);
  doc.text(formatCurrency(closing.transferSales, "CUP", rates), 200, y + 72, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Total Ventas de la Jornada:", 48, y + 92);
  doc.text(formatCurrency(closing.totalSales, "CUP", rates), 200, y + 92, { align: "right" });

  // Column 2
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Tickets Emitidos:", 310, y + 40);
  doc.text(String(closing.totalTickets), 480, y + 40, { align: "right" });

  doc.text("Efectivo Físico Contado:", 310, y + 56);
  doc.text(formatCurrency(closing.countedCash, "CUP", rates), 480, y + 56, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.text("Descuadre / Diferencia:", 310, y + 76);
  if (closing.cashDiscrepancy === 0) {
    doc.setTextColor(16, 185, 129);
    doc.text("0.00 CUP (Cuadrada Perfecta)", 480, y + 76, { align: "right" });
  } else if (closing.cashDiscrepancy > 0) {
    doc.setTextColor(37, 99, 235);
    doc.text(`+${closing.cashDiscrepancy.toFixed(2)} CUP (Sobrante)`, 480, y + 76, { align: "right" });
  } else {
    doc.setTextColor(225, 29, 72);
    doc.text(`${closing.cashDiscrepancy.toFixed(2)} CUP (Faltante)`, 480, y + 76, { align: "right" });
  }

  y += 124;

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
  return deliverPdfFile(doc, filename, `Informe Z - ${closing.date}`, preferShare);
}

/**
 * Generates the Official IPVE / IPV Document in PDF format (Landscape A4 Table).
 */
export async function generateIPVReportPdf(
  rows: IPVRow[],
  totals: any,
  periodLabel: string,
  biz: BusinessInfo,
  settings: IPUESettings,
  rates: ExchangeRates,
  preferShare = false
): Promise<{ method: "share" | "download"; success: boolean }> {
  // A4 Landscape: 842 pt width x 595 pt height
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = 842;
  const pageHeight = 595;
  let y = 30;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(28, y, pageWidth - 56, 52, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text((biz.name || "ESTABLECIMIENTO COMERCIAL").toUpperCase(), 40, y + 20);

  doc.setFontSize(9);
  doc.setTextColor(245, 158, 11);
  doc.text(settings.documentTitle.toUpperCase(), 40, y + 34);

  if (settings.documentSubtitle) {
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    doc.text(settings.documentSubtitle, 40, y + 45);
  }

  // Right Header details
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Periodo: ${periodLabel}`, pageWidth - 40, y + 18, { align: "right" });
  doc.text(`Moneda Base: CUP`, pageWidth - 40, y + 28, { align: "right" });
  doc.text(`Emitido: ${new Date().toLocaleDateString("es-ES")} ${new Date().toLocaleTimeString("es-ES")}`, pageWidth - 40, y + 38, { align: "right" });
  doc.text(`CajaMaster POS`, pageWidth - 40, y + 48, { align: "right" });

  y += 62;

  // Business metadata row
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const metadataParts = [];
  if (biz.owner) metadataParts.push(`Responsable: ${biz.owner}`);
  if (biz.phone) metadataParts.push(`Tel: ${biz.phone}`);
  if (biz.address) metadataParts.push(`Dirección: ${biz.address}`);
  if (metadataParts.length > 0) {
    doc.text(metadataParts.join("  •  "), 32, y);
    y += 12;
  }

  // Table Columns Widths & Offsets (Sum = pageWidth - 56 = 786 pt)
  // Columns:
  // 1. Producto (176)
  // 2. U/M (36)
  // 3. Inv. Inicial (58)
  // 4. Entradas (54)
  // 5. Disp. Venta (60)
  // 6. Inv. Final (60)
  // 7. Cant. Vendida (64)
  // 8. Precio (60)
  // 9. Importe CUP (80)
  // 10. Costo Total (74)
  // 11. Margen (64)

  const cols = [
    { title: "PRODUCTO", width: 176, align: "left" },
    { title: "U/M", width: 36, align: "center" },
    { title: "INV. INIC.", width: 58, align: "right" },
    { title: "ENTRADAS", width: 54, align: "right" },
    { title: "DISP. VENTA", width: 60, align: "right" },
    { title: "INV. FINAL", width: 60, align: "right" },
    { title: "VENDIDO", width: 64, align: "right" },
    { title: "PRECIO", width: 60, align: "right" },
    { title: "IMPORTE CUP", width: 80, align: "right" },
    { title: "COSTO TOTAL", width: 74, align: "right" },
    { title: "MARGEN", width: 64, align: "right" },
  ];

  // Draw Table Header
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(28, y, pageWidth - 56, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);

  let currentX = 28;
  cols.forEach((col) => {
    const textX =
      col.align === "left"
        ? currentX + 6
        : col.align === "center"
        ? currentX + col.width / 2
        : currentX + col.width - 6;
    doc.text(col.title, textX, y + 12, { align: col.align as any });
    currentX += col.width;
  });

  y += 18;

  // Table Body Rows
  const maxRowsPerPage = 22;
  let pageIndex = 1;

  rows.forEach((r, idx) => {
    // Check page overflow
    if (y > pageHeight - 90) {
      doc.addPage("a4", "landscape");
      pageIndex++;
      y = 30;

      // Repeat Table Header
      doc.setFillColor(30, 41, 59);
      doc.rect(28, y, pageWidth - 56, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);

      currentX = 28;
      cols.forEach((col) => {
        const textX =
          col.align === "left"
            ? currentX + 6
            : col.align === "center"
            ? currentX + col.width / 2
            : currentX + col.width - 6;
        doc.text(col.title, textX, y + 12, { align: col.align as any });
        currentX += col.width;
      });
      y += 18;
    }

    // Row alternating background
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(28, y, pageWidth - 56, 13, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);

    const profit = r.importeVendido - r.costoTotal;
    const margin = r.importeVendido > 0 ? (profit / r.importeVendido) * 100 : 0;

    currentX = 28;

    // 1. Producto
    const pName = r.name.length > 30 ? r.name.substring(0, 28) + "..." : r.name;
    doc.setFont("helvetica", "bold");
    doc.text(pName, currentX + 6, y + 9.5);
    currentX += cols[0].width;

    doc.setFont("helvetica", "normal");
    // 2. U/M
    doc.text(r.unit || "u", currentX + cols[1].width / 2, y + 9.5, { align: "center" });
    currentX += cols[1].width;

    // 3. Inv Inicial
    doc.text(String(r.invInicialCant), currentX + cols[2].width - 6, y + 9.5, { align: "right" });
    currentX += cols[2].width;

    // 4. Entradas
    if (r.entradasCant > 0) {
      doc.setTextColor(16, 185, 129);
      doc.setFont("helvetica", "bold");
      doc.text(`+${r.entradasCant}`, currentX + cols[3].width - 6, y + 9.5, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
    } else {
      doc.text("-", currentX + cols[3].width - 6, y + 9.5, { align: "right" });
    }
    currentX += cols[3].width;

    // 5. Disp Venta
    doc.text(String(r.dispVentaCant), currentX + cols[4].width - 6, y + 9.5, { align: "right" });
    currentX += cols[4].width;

    // 6. Inv Final
    doc.text(String(r.invFinalCant), currentX + cols[5].width - 6, y + 9.5, { align: "right" });
    currentX += cols[5].width;

    // 7. Vendido
    doc.setFont("helvetica", "bold");
    doc.text(String(r.vendidoCant), currentX + cols[6].width - 6, y + 9.5, { align: "right" });
    doc.setFont("helvetica", "normal");
    currentX += cols[6].width;

    // 8. Precio
    doc.text(formatCurrency(r.precioVenta, "CUP", rates), currentX + cols[7].width - 6, y + 9.5, { align: "right" });
    currentX += cols[7].width;

    // 9. Importe CUP
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(r.importeVendido, "CUP", rates), currentX + cols[8].width - 6, y + 9.5, { align: "right" });
    doc.setFont("helvetica", "normal");
    currentX += cols[8].width;

    // 10. Costo Total
    doc.text(formatCurrency(r.costoTotal, "CUP", rates), currentX + cols[9].width - 6, y + 9.5, { align: "right" });
    currentX += cols[9].width;

    // 11. Margen
    doc.text(`${margin.toFixed(1)}%`, currentX + cols[10].width - 6, y + 9.5, { align: "right" });

    y += 13;
  });

  // TOTALS SUMMARY ROW
  doc.setFillColor(245, 158, 11); // Amber
  doc.rect(28, y, pageWidth - 56, 16, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);

  doc.text("TOTALES GENERALES:", 34, y + 11);
  doc.text(`${totals.vendidoCant} u`, 28 + cols[0].width + cols[1].width + cols[2].width + cols[3].width + cols[4].width + cols[5].width + cols[6].width - 6, y + 11, { align: "right" });
  
  const importeX = 28 + cols[0].width + cols[1].width + cols[2].width + cols[3].width + cols[4].width + cols[5].width + cols[6].width + cols[7].width + cols[8].width - 6;
  doc.text(formatCurrency(totals.importeVendido, "CUP", rates), importeX, y + 11, { align: "right" });

  const costoX = importeX + cols[9].width;
  doc.text(formatCurrency(totals.costoTotal, "CUP", rates), costoX, y + 11, { align: "right" });

  const grossProfit = totals.importeVendido - totals.costoTotal;
  const overallMargin = totals.importeVendido > 0 ? (grossProfit / totals.importeVendido) * 100 : 0;
  doc.text(`${overallMargin.toFixed(1)}%`, pageWidth - 34, y + 11, { align: "right" });

  y += 26;

  // Custom Notes
  if (settings.customNotes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Observaciones:", 32, y);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(settings.customNotes, 32, y, { maxWidth: pageWidth - 64 });
    y += 16;
  }

  // Official Signatures Blocks (3 signatures)
  y = Math.max(y + 14, pageHeight - 75);
  const sigColWidth = (pageWidth - 80) / 3;

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.75);

  [settings.signature1, settings.signature2, settings.signature3].forEach((sigText, i) => {
    const startX = 40 + i * sigColWidth + 20;
    const endX = startX + sigColWidth - 40;
    const centerX = (startX + endX) / 2;

    doc.line(startX, y, endX, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(sigText, centerX, y + 11, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const subLabel = i === 0 ? "Firma y Cuño" : i === 1 ? "Verificado Conforme" : "Auditoría y Cierre";
    doc.text(subLabel, centerX, y + 20, { align: "center" });
  });

  const cleanDate = new Date().toISOString().slice(0, 10);
  const filename = `Informe_IPVE_${cleanDate}.pdf`;
  return deliverPdfFile(doc, filename, `Informe IPVE - ${periodLabel}`, preferShare);
}

/**
 * Generates an Inventory Stock Valuation Catalog PDF Document.
 */
export async function generateInventoryPdf(
  products: Product[],
  biz: BusinessInfo,
  rates: ExchangeRates,
  preferShare = false
): Promise<{ method: "share" | "download"; success: boolean }> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = 595;
  const pageHeight = 842;
  let y = 36;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(36, y, pageWidth - 72, 60, 6, 6, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text((biz.name || "CAJAMASTER POS").toUpperCase(), 50, y + 24);

  doc.setFontSize(9.5);
  doc.setTextColor(245, 158, 11);
  doc.text("CATÁLOGO & VALORACIÓN GENERAL DE INVENTARIO", 50, y + 38);

  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Fecha: ${new Date().toLocaleDateString("es-ES")} • Total: ${products.length} productos registrados`,
    50,
    y + 50
  );

  y += 76;

  // Metrics
  const totalUnits = products.reduce((a, b) => a + b.stock, 0);
  const totalCost = products.reduce((a, b) => a + b.stock * b.cost, 0);
  const totalValue = products.reduce((a, b) => a + b.stock * b.price, 0);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(36, y, pageWidth - 72, 40, 6, 6, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Unidades en Stock: ${totalUnits} u`, 50, y + 18);
  doc.text(`Inversión (Costo): ${formatCurrency(totalCost, "CUP", rates)}`, 220, y + 18);
  doc.text(`Valoración Venta: ${formatCurrency(totalValue, "CUP", rates)}`, 400, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Margen Potencial: ${formatCurrency(totalValue - totalCost, "CUP", rates)}`, 50, y + 30);

  y += 52;

  // Table Headers
  const cols = [
    { title: "PRODUCTO / DESCRIPCIÓN", width: 200, align: "left" },
    { title: "CATEGORÍA", width: 90, align: "left" },
    { title: "STOCK", width: 60, align: "right" },
    { title: "COSTO", width: 75, align: "right" },
    { title: "PRECIO VENTA", width: 98, align: "right" },
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
  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));
  sorted.forEach((p, idx) => {
    if (y > pageHeight - 50) {
      doc.addPage("a4", "portrait");
      y = 36;
      renderTableHeader();
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(36, y, pageWidth - 72, 14, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);

    let curX = 36;
    const pName = p.name.length > 34 ? p.name.substring(0, 32) + "..." : p.name;
    doc.setFont("helvetica", "bold");
    doc.text(pName, curX + 6, y + 10);
    curX += cols[0].width;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(p.category || "General", curX + 6, y + 10);
    curX += cols[1].width;

    // Stock alert highlight
    if (p.stock <= p.lowStockAlert) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(225, 29, 72);
    } else {
      doc.setTextColor(15, 23, 42);
    }
    doc.text(`${p.stock} ${p.unit || "u"}`, curX + cols[2].width - 6, y + 10, { align: "right" });
    curX += cols[2].width;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(formatCurrency(p.cost, "CUP", rates), curX + cols[3].width - 6, y + 10, { align: "right" });
    curX += cols[3].width;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrency(p.price, "CUP", rates), curX + cols[4].width - 6, y + 10, { align: "right" });

    y += 14;
  });

  const filename = `Inventario_${new Date().toISOString().slice(0, 10)}.pdf`;
  return deliverPdfFile(doc, filename, "Catálogo de Inventario", preferShare);
}

/**
 * Generates an Enterprise-grade Kardex / Stock Movement Audit PDF report.
 */
export async function generateKardexPdf(
  movements: Movement[],
  business: BusinessInfo,
  rates: ExchangeRates,
  periodLabel = "Historial Completo",
  filterSummary = "",
  preferShare = false
): Promise<{ method: "share" | "download"; success: boolean }> {
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

  const filename = `Kardex_Inventario_${new Date().toISOString().slice(0, 10)}.pdf`;
  return deliverPdfFile(doc, filename, "Kardex de Inventario", preferShare);
}

