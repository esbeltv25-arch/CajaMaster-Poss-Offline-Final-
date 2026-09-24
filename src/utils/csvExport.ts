import type {
  Movement,
  BusinessInfo,
  ExchangeRates,
  Product,
  DailyClosing,
} from "../types";
import type { IPVRow } from "./ipv";

const escapeCsv = (val: any) => {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
};

const pad = (n: number) => n.toString().padStart(2, "0");

const triggerCsvDownloadOrShare = async (
  filename: string,
  csvContent: string,
  title: string,
  text: string,
  preferShare = false
): Promise<{ success: boolean; method: "share" | "download" }> => {
  // UTF-8 BOM (\uFEFF) ensures Excel and Google Sheets open Spanish characters (ñ, á, é, í, ó, ú) flawlessly
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });

  if (preferShare && typeof navigator !== "undefined" && navigator.share) {
    try {
      const file = new File([blob], filename, { type: "text/csv" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          text,
          files: [file],
        });
        return { success: true, method: "share" };
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.warn("Share failed, falling back to download:", e);
      } else {
        return { success: false, method: "share" };
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);

  return { success: true, method: "download" };
};

/**
 * Formats movements as CSV compatible with Microsoft Excel and Google Sheets.
 */
export function exportKardexToCsv(
  movements: Movement[],
  business: BusinessInfo,
  _rates: ExchangeRates
): { filename: string; blob: Blob; url: string; csvContent: string } {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const filename = `Kardex_Movimientos_${(business.name || "Negocio").replace(/[^a-zA-Z0-9]/g, "_")}_${dateStr}.csv`;

  const headers = [
    "Fecha",
    "Hora",
    "ID Movimiento",
    "Producto",
    "Categoría",
    "Tipo de Movimiento",
    "Cantidad",
    "Unidad",
    "Stock Previo",
    "Stock Resultante",
    "Costo Unitario (CUP)",
    "Impacto Costo Total (CUP)",
    "Motivo / Referencia",
    "Usuario / Responsable",
    "Ticket / Venta ID",
  ];

  const getMovementLabel = (type: string) => {
    switch (type) {
      case "ENTRY":
        return "Entrada / Reabastecimiento (+)";
      case "SALE":
        return "Salida por Venta (-)";
      case "LOSS":
        return "Salida por Merma / Rotura (-)";
      case "ADJUST":
        return "Ajuste de Inventario";
      case "INITIAL":
        return "Alta Inicial de Catálogo (+)";
      case "PHYSICAL_COUNT":
        return "Arqueo Físico Cierre Z";
      case "RETURN":
        return "Devolución / Reingreso (+)";
      default:
        return type;
    }
  };

  const rows = movements.map((m) => {
    const dateObj = new Date(m.ts);
    const fecha = dateObj.toLocaleDateString("es-ES");
    const hora = dateObj.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const movLabel = getMovementLabel(m.type);
    const sign = m.type === "ENTRY" || m.type === "INITIAL" || m.type === "RETURN" ? "+" : (m.type === "SALE" || m.type === "LOSS" ? "-" : "");
    const qtyFormatted = `${sign}${m.qty}`;
    const totalCost = m.totalCost !== undefined ? m.totalCost : m.qty * (m.unitCost || 0);

    return [
      escapeCsv(fecha),
      escapeCsv(hora),
      escapeCsv(m.id),
      escapeCsv(m.productName || "Producto"),
      escapeCsv(m.productCategory || "General"),
      escapeCsv(movLabel),
      escapeCsv(qtyFormatted),
      escapeCsv(m.productUnit || "u"),
      escapeCsv(m.previousStock !== undefined ? m.previousStock : "-"),
      escapeCsv(m.resultingStock !== undefined ? m.resultingStock : "-"),
      escapeCsv((m.unitCost || 0).toFixed(2)),
      escapeCsv(totalCost.toFixed(2)),
      escapeCsv(m.reason || m.notes || "-"),
      escapeCsv(m.user || "Sistema"),
      escapeCsv(m.ticketNumber ? `Ticket #${m.ticketNumber}` : (m.saleId || "-")),
    ].join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  return { filename, blob, url, csvContent };
}

export async function downloadOrShareKardexCsv(
  movements: Movement[],
  business: BusinessInfo,
  rates: ExchangeRates,
  preferShare = false
): Promise<{ success: boolean; method: "share" | "download" }> {
  const { filename, csvContent } = exportKardexToCsv(movements, business, rates);
  return triggerCsvDownloadOrShare(
    filename,
    csvContent,
    `Auditoría Kardex - ${business.name || "Negocio"}`,
    `Informe de movimientos de inventario de ${business.name || "Negocio"}`,
    preferShare
  );
}

/**
 * Exports current Inventory Catalog (Stock, Cost, Price, Valuation) to CSV.
 */
export function exportInventoryCatalogToCsv(
  products: Product[],
  business: BusinessInfo,
  _rates?: ExchangeRates
): { filename: string; csvContent: string } {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const filename = `Inventario_Stock_${(business.name || "Negocio").replace(/[^a-zA-Z0-9]/g, "_")}_${dateStr}.csv`;

  const headers = [
    "Código / Barras",
    "Producto",
    "Categoría",
    "Stock Actual",
    "Unidad",
    "Costo Unitario (CUP)",
    "Precio Venta (CUP)",
    "Valor Total Costo (CUP)",
    "Valor Total Venta (CUP)",
    "Margen Estimado (%)",
    "Stock Mínimo Alerta",
    "Estado de Stock",
    "Estado Catálogo",
  ];

  let totalUnits = 0;
  let totalCostVal = 0;
  let totalSaleVal = 0;

  const rows = products.map((p) => {
    const costVal = p.stock * (p.cost || 0);
    const saleVal = p.stock * (p.price || 0);
    totalUnits += p.stock;
    totalCostVal += costVal;
    totalSaleVal += saleVal;

    const marginPct = p.price > 0 ? (((p.price - p.cost) / p.price) * 100).toFixed(1) : "0.0";
    let status = "Óptimo";
    if (p.stock <= 0) {
      status = "Agotado";
    } else if (p.stock <= p.lowStockAlert) {
      status = "Bajo Stock";
    }

    return [
      escapeCsv(p.barcode || p.id),
      escapeCsv(p.name),
      escapeCsv(p.category || "General"),
      escapeCsv(p.stock),
      escapeCsv(p.unit || "u"),
      escapeCsv((p.cost || 0).toFixed(2)),
      escapeCsv((p.price || 0).toFixed(2)),
      escapeCsv(costVal.toFixed(2)),
      escapeCsv(saleVal.toFixed(2)),
      escapeCsv(`${marginPct}%`),
      escapeCsv(p.lowStockAlert || 5),
      escapeCsv(status),
      escapeCsv(p.active !== false ? "Activo" : "Inactivo"),
    ].join(",");
  });

  // Summary Totals Row
  const totalMarginPct = totalSaleVal > 0 ? (((totalSaleVal - totalCostVal) / totalSaleVal) * 100).toFixed(1) : "0.0";
  const totalsRow = [
    escapeCsv("TOTALES GENERALES"),
    escapeCsv(`${products.length} productos`),
    escapeCsv("-"),
    escapeCsv(totalUnits),
    escapeCsv("u"),
    escapeCsv("-"),
    escapeCsv("-"),
    escapeCsv(totalCostVal.toFixed(2)),
    escapeCsv(totalSaleVal.toFixed(2)),
    escapeCsv(`${totalMarginPct}%`),
    escapeCsv("-"),
    escapeCsv("-"),
    escapeCsv("-"),
  ].join(",");

  const csvContent = [headers.join(","), ...rows, totalsRow].join("\r\n");
  return { filename, csvContent };
}

export async function downloadOrShareInventoryCatalogCsv(
  products: Product[],
  business: BusinessInfo,
  rates?: ExchangeRates,
  preferShare = false
): Promise<{ success: boolean; method: "share" | "download" }> {
  const { filename, csvContent } = exportInventoryCatalogToCsv(products, business, rates);
  return triggerCsvDownloadOrShare(
    filename,
    csvContent,
    `Catálogo de Inventario - ${business.name || "Negocio"}`,
    `Existencias y valoración de inventario de ${business.name || "Negocio"}`,
    preferShare
  );
}

/**
 * Exports IPVE (Informe Periódico de Ventas y Existencias) to CSV.
 */
export function exportIpvReportToCsv(
  rows: IPVRow[],
  totals: {
    invInicialValor: number;
    entradasValor: number;
    dispVentaValor: number;
    invFinalValor: number;
    vendidoCant: number;
    importeVendido: number;
    costoTotal: number;
  },
  periodLabel: string,
  business: BusinessInfo,
  _rates?: ExchangeRates
): { filename: string; csvContent: string } {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const filename = `Reporte_IPVE_${(business.name || "Negocio").replace(/[^a-zA-Z0-9]/g, "_")}_${dateStr}.csv`;

  const metaRows = [
    [escapeCsv("INFORME PERIÓDICO DE VENTAS Y EXISTENCIAS (IPVE / IPV)")].join(","),
    [escapeCsv("Establecimiento:"), escapeCsv(business.name || "Negocio"), escapeCsv("Responsable:"), escapeCsv(business.owner || "-")].join(","),
    [escapeCsv("Período de Liquidación:"), escapeCsv(periodLabel), escapeCsv("Fecha de Emisión:"), escapeCsv(d.toLocaleDateString("es-ES"))].join(","),
    "",
  ];

  const headers = [
    "No.",
    "Producto",
    "Unidad",
    "Inv. Inicial (Cant)",
    "Inv. Inicial (Valor CUP)",
    "Entradas (Cant)",
    "Entradas (Valor CUP)",
    "Disp. Venta (Cant)",
    "Disp. Venta (Valor CUP)",
    "Inv. Final Físico (Cant)",
    "Inv. Final Físico (Valor CUP)",
    "Cantidad Vendida",
    "Precio Venta (CUP)",
    "Importe Vendido (CUP)",
    "Costo Unitario (CUP)",
    "Costo Total Mercancía (CUP)",
    "Ganancia Bruta (CUP)",
    "Margen Bruto (%)",
  ];

  let totalInicialCant = 0;
  let totalEntradasCant = 0;
  let totalDispCant = 0;
  let totalFinalCant = 0;

  const dataRows = rows.map((r, idx) => {
    totalInicialCant += r.invInicialCant;
    totalEntradasCant += r.entradasCant;
    totalDispCant += r.dispVentaCant;
    totalFinalCant += r.invFinalCant;

    const rowProfit = r.importeVendido - r.costoTotal;
    const rowMargin = r.importeVendido > 0 ? ((rowProfit / r.importeVendido) * 100).toFixed(1) : "0.0";

    return [
      escapeCsv(idx + 1),
      escapeCsv(r.name),
      escapeCsv(r.unit || "u"),
      escapeCsv(r.invInicialCant),
      escapeCsv(r.invInicialValor.toFixed(2)),
      escapeCsv(r.entradasCant),
      escapeCsv(r.entradasValor.toFixed(2)),
      escapeCsv(r.dispVentaCant),
      escapeCsv(r.dispVentaValor.toFixed(2)),
      escapeCsv(r.invFinalCant),
      escapeCsv(r.invFinalValor.toFixed(2)),
      escapeCsv(r.vendidoCant),
      escapeCsv(r.precioVenta.toFixed(2)),
      escapeCsv(r.importeVendido.toFixed(2)),
      escapeCsv(r.costoUnitario.toFixed(2)),
      escapeCsv(r.costoTotal.toFixed(2)),
      escapeCsv(rowProfit.toFixed(2)),
      escapeCsv(`${rowMargin}%`),
    ].join(",");
  });

  const grossProfit = totals.importeVendido - totals.costoTotal;
  const overallMargin = totals.importeVendido > 0 ? ((grossProfit / totals.importeVendido) * 100).toFixed(1) : "0.0";

  const totalsRow = [
    escapeCsv("TOTALES"),
    escapeCsv(`${rows.length} productos`),
    escapeCsv("-"),
    escapeCsv(totalInicialCant),
    escapeCsv(totals.invInicialValor.toFixed(2)),
    escapeCsv(totalEntradasCant),
    escapeCsv(totals.entradasValor.toFixed(2)),
    escapeCsv(totalDispCant),
    escapeCsv(totals.dispVentaValor.toFixed(2)),
    escapeCsv(totalFinalCant),
    escapeCsv(totals.invFinalValor.toFixed(2)),
    escapeCsv(totals.vendidoCant),
    escapeCsv("-"),
    escapeCsv(totals.importeVendido.toFixed(2)),
    escapeCsv("-"),
    escapeCsv(totals.costoTotal.toFixed(2)),
    escapeCsv(grossProfit.toFixed(2)),
    escapeCsv(`${overallMargin}%`),
  ].join(",");

  const csvContent = [...metaRows, headers.join(","), ...dataRows, totalsRow].join("\r\n");
  return { filename, csvContent };
}

export async function downloadOrShareIpvCsv(
  rows: IPVRow[],
  totals: {
    invInicialValor: number;
    entradasValor: number;
    dispVentaValor: number;
    invFinalValor: number;
    vendidoCant: number;
    importeVendido: number;
    costoTotal: number;
  },
  periodLabel: string,
  business: BusinessInfo,
  rates?: ExchangeRates,
  preferShare = false
): Promise<{ success: boolean; method: "share" | "download" }> {
  const { filename, csvContent } = exportIpvReportToCsv(rows, totals, periodLabel, business, rates);
  return triggerCsvDownloadOrShare(
    filename,
    csvContent,
    `Liquidación IPVE - ${business.name || "Negocio"}`,
    `Informe Periódico de Ventas y Existencias IPVE (${periodLabel})`,
    preferShare
  );
}

/**
 * Exports an individual Daily Cash Closing (Cierre Z) with detailed counts to CSV.
 */
export function exportDailyClosingToCsv(
  closing: DailyClosing,
  business: BusinessInfo,
  _rates?: ExchangeRates
): { filename: string; csvContent: string } {
  const filename = `Cierre_Caja_Z_${closing.date}_${(business.name || "Negocio").replace(/[^a-zA-Z0-9]/g, "_")}.csv`;
  const timeStr = new Date(closing.closedAt).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

  let statusText = "Cuadrada (0.00 CUP)";
  if (closing.cashDiscrepancy > 0) {
    statusText = `Sobrante (+${closing.cashDiscrepancy.toFixed(2)} CUP)`;
  } else if (closing.cashDiscrepancy < 0) {
    statusText = `Faltante (${closing.cashDiscrepancy.toFixed(2)} CUP)`;
  }

  const sections: string[] = [
    // Header
    [escapeCsv("INFORME Z - CIERRE DIARIO Y ARQUEO DE CAJA")].join(","),
    [escapeCsv("Establecimiento:"), escapeCsv(business.name || "Negocio"), escapeCsv("Responsable / Cajero:"), escapeCsv(closing.cashier || business.owner || "Cajero")].join(","),
    [escapeCsv("Fecha del Cierre:"), escapeCsv(closing.date), escapeCsv("Hora de Emisión:"), escapeCsv(timeStr)].join(","),
    "",
    // Cash Drawer Reconciliation Summary
    [escapeCsv("1. BALANCE FINANCIERO Y ARQUEO DE CAJA")].join(","),
    [escapeCsv("Concepto"), escapeCsv("Importe (CUP)")].join(","),
    [escapeCsv("Fondo de Caja Inicial"), escapeCsv(closing.openingCash.toFixed(2))].join(","),
    [escapeCsv("Ventas en Efectivo"), escapeCsv(closing.cashSales.toFixed(2))].join(","),
    [escapeCsv("Ventas por Transferencia"), escapeCsv(closing.transferSales.toFixed(2))].join(","),
    [escapeCsv("Total de Ventas de la Jornada"), escapeCsv(closing.totalSales.toFixed(2))].join(","),
    [escapeCsv("Tickets / Facturas Emitidos"), escapeCsv(closing.totalTickets)].join(","),
    [escapeCsv("Efectivo Esperado en Gaveta"), escapeCsv((closing.openingCash + closing.cashSales).toFixed(2))].join(","),
    [escapeCsv("Efectivo Físico Real Contado"), escapeCsv(closing.countedCash.toFixed(2))].join(","),
    [escapeCsv("Diferencia / Descuadre en Caja"), escapeCsv(closing.cashDiscrepancy.toFixed(2))].join(","),
    [escapeCsv("Estado del Arqueo"), escapeCsv(statusText)].join(","),
    [escapeCsv("Observaciones"), escapeCsv(closing.notes || "Sin observaciones")].join(","),
    "",
    // Inventory Counts Table
    [escapeCsv("2. BALANCE FÍSICO DE INVENTARIO CONCILIADO")].join(","),
    [
      escapeCsv("Producto"),
      escapeCsv("Unidad"),
      escapeCsv("Stock Sistema"),
      escapeCsv("Conteo Físico Real"),
      escapeCsv("Diferencia / Cuadre"),
      escapeCsv("Costo Unitario (CUP)"),
      escapeCsv("Precio Venta (CUP)"),
      escapeCsv("Subtotal Costo Físico (CUP)"),
      escapeCsv("Subtotal Venta Física (CUP)"),
    ].join(","),
  ];

  if (closing.counts && closing.counts.length > 0) {
    closing.counts.forEach((item) => {
      const disc = item.physicalStock - item.systemStock;
      const subCost = item.physicalStock * (item.cost || 0);
      const subPrice = item.physicalStock * (item.price || 0);

      sections.push(
        [
          escapeCsv(item.name),
          escapeCsv(item.unit || "u"),
          escapeCsv(item.systemStock),
          escapeCsv(item.physicalStock),
          escapeCsv(disc > 0 ? `+${disc}` : disc),
          escapeCsv((item.cost || 0).toFixed(2)),
          escapeCsv((item.price || 0).toFixed(2)),
          escapeCsv(subCost.toFixed(2)),
          escapeCsv(subPrice.toFixed(2)),
        ].join(",")
      );
    });

    // Totals row for inventory
    sections.push(
      [
        escapeCsv("TOTALES INVENTARIO FÍSICO"),
        escapeCsv("-"),
        escapeCsv("-"),
        escapeCsv(closing.inventoryUnitsCounted),
        escapeCsv("-"),
        escapeCsv("-"),
        escapeCsv("-"),
        escapeCsv(closing.inventoryTotalCost.toFixed(2)),
        escapeCsv(closing.inventoryTotalValue.toFixed(2)),
      ].join(",")
    );
  } else {
    sections.push([escapeCsv("Sin desglose físico registrado")].join(","));
  }

  const csvContent = sections.join("\r\n");
  return { filename, csvContent };
}

export async function downloadOrShareDailyClosingCsv(
  closing: DailyClosing,
  business: BusinessInfo,
  rates?: ExchangeRates,
  preferShare = false
): Promise<{ success: boolean; method: "share" | "download" }> {
  const { filename, csvContent } = exportDailyClosingToCsv(closing, business, rates);
  return triggerCsvDownloadOrShare(
    filename,
    csvContent,
    `Cierre de Caja Z - ${closing.date}`,
    `Arqueo de caja y balance de inventario del día ${closing.date}`,
    preferShare
  );
}

/**
 * Exports historical list of all Daily Cash Closings to a consolidated CSV ledger.
 */
export function exportAllClosingsHistoryToCsv(
  closings: DailyClosing[],
  business: BusinessInfo,
  _rates?: ExchangeRates
): { filename: string; csvContent: string } {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const filename = `Historial_Cierres_Caja_${(business.name || "Negocio").replace(/[^a-zA-Z0-9]/g, "_")}_${dateStr}.csv`;

  const headers = [
    "ID Cierre",
    "Fecha",
    "Hora Cierre",
    "Responsable / Cajero",
    "Tickets Emitidos",
    "Fondo Inicial (CUP)",
    "Ventas Efectivo (CUP)",
    "Ventas Transferencia (CUP)",
    "Ventas Totales (CUP)",
    "Efectivo Real Contado (CUP)",
    "Diferencia en Caja (CUP)",
    "Estado del Arqueo",
    "Unidades Stock Contadas",
    "Valoración Costo Stock (CUP)",
    "Valoración Venta Stock (CUP)",
    "Notas / Observaciones",
  ];

  let sumTickets = 0;
  let sumCashSales = 0;
  let sumTransSales = 0;
  let sumTotalSales = 0;
  let sumCountedCash = 0;
  let sumDiscrepancy = 0;

  const rows = closings.map((c) => {
    const timeStr = new Date(c.closedAt).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    sumTickets += c.totalTickets || 0;
    sumCashSales += c.cashSales || 0;
    sumTransSales += c.transferSales || 0;
    sumTotalSales += c.totalSales || 0;
    sumCountedCash += c.countedCash || 0;
    sumDiscrepancy += c.cashDiscrepancy || 0;

    let status = "Cuadrada";
    if (c.cashDiscrepancy > 0) {
      status = `Sobrante (+${c.cashDiscrepancy.toFixed(2)})`;
    } else if (c.cashDiscrepancy < 0) {
      status = `Faltante (${c.cashDiscrepancy.toFixed(2)})`;
    }

    return [
      escapeCsv(c.id),
      escapeCsv(c.date),
      escapeCsv(timeStr),
      escapeCsv(c.cashier || business.owner || "Cajero"),
      escapeCsv(c.totalTickets),
      escapeCsv(c.openingCash.toFixed(2)),
      escapeCsv(c.cashSales.toFixed(2)),
      escapeCsv(c.transferSales.toFixed(2)),
      escapeCsv(c.totalSales.toFixed(2)),
      escapeCsv(c.countedCash.toFixed(2)),
      escapeCsv(c.cashDiscrepancy.toFixed(2)),
      escapeCsv(status),
      escapeCsv(c.inventoryUnitsCounted),
      escapeCsv(c.inventoryTotalCost.toFixed(2)),
      escapeCsv(c.inventoryTotalValue.toFixed(2)),
      escapeCsv(c.notes || "-"),
    ].join(",");
  });

  // Totals Row
  const totalsRow = [
    escapeCsv("TOTALES CONSOLIDADOS"),
    escapeCsv(`${closings.length} cierres`),
    escapeCsv("-"),
    escapeCsv("-"),
    escapeCsv(sumTickets),
    escapeCsv("-"),
    escapeCsv(sumCashSales.toFixed(2)),
    escapeCsv(sumTransSales.toFixed(2)),
    escapeCsv(sumTotalSales.toFixed(2)),
    escapeCsv(sumCountedCash.toFixed(2)),
    escapeCsv(sumDiscrepancy.toFixed(2)),
    escapeCsv("-"),
    escapeCsv("-"),
    escapeCsv("-"),
    escapeCsv("-"),
    escapeCsv("-"),
  ].join(",");

  const csvContent = [headers.join(","), ...rows, totalsRow].join("\r\n");
  return { filename, csvContent };
}

export async function downloadOrShareAllClosingsCsv(
  closings: DailyClosing[],
  business: BusinessInfo,
  rates?: ExchangeRates,
  preferShare = false
): Promise<{ success: boolean; method: "share" | "download" }> {
  const { filename, csvContent } = exportAllClosingsHistoryToCsv(closings, business, rates);
  return triggerCsvDownloadOrShare(
    filename,
    csvContent,
    `Historial de Cierres de Caja - ${business.name || "Negocio"}`,
    `Historial consolidado de cierres de caja Z de ${business.name || "Negocio"}`,
    preferShare
  );
}
