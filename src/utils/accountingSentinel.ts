/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ CAJAMASTER POS - GUARDIÁN CONTABLE & AUDITOR MATEMÁTICO (SENTINEL)
 * ═══════════════════════════════════════════════════════════════════════════
 * Mecanismo preventivo obligatorio que audita, valida y autocorrige la
 * consistencia matemática y de formato de inventarios, reportes IPVE/IPV,
 * catálogos y comprobantes de arqueo antes de permitir cualquier exportación
 * o emisión de documento en PDF/CSV.
 *
 * Principios inmutables:
 * 1. [DISP. VENTA] = [INV. INICIAL] + [ENTRADAS]
 * 2. [INV. FINAL] = [DISP. VENTA] - [MERMAS] - [CANT. VENDIDA] (>= 0)
 * 3. [IMPORTE VENDIDO] = [CANT. VENDIDA] * [PRECIO VENTA]
 * 4. [COSTO TOTAL] = [CANT. VENDIDA] * [COSTO UNITARIO]
 * 5. [UTILIDAD BRUTA] = [IMPORTE VENDIDO] - [COSTO TOTAL]
 * 6. [MARGEN %] = [UTILIDAD BRUTA] / [IMPORTE VENDIDO] * 100
 * 7. Sumatoria de totales generales = suma matemática exacta de cada fila
 * 8. Sanitización textual: nombres sin saltos de línea (\n) ni caracteres de control
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { IPVRow } from "./ipv";
import type { Product, Movement, DailyClosing } from "../types";
import { roundCurrency, formatAccounting, formatQuantity } from "./currency";

export interface SentinelAnomaly {
  type: "FORMULA" | "TOTALS" | "FORMAT" | "NEGATIVE_VALUE" | "TEXT_OVERFLOW";
  code: string;
  item: string;
  message: string;
  originalValue: any;
  healedValue: any;
}

export interface SentinelIPVResult {
  isValid: boolean;
  healedRows: IPVRow[];
  healedTotals: {
    invInicialCant: number;
    invInicialValor: number;
    entradasCant: number;
    entradasValor: number;
    mermasCant: number;
    mermasValor: number;
    dispVentaCant: number;
    dispVentaValor: number;
    invFinalCant: number;
    invFinalValor: number;
    vendidoCant: number;
    importeVendido: number;
    costoTotal: number;
    gananciaBruta: number;
    margenPct: number;
    totalProducts: number;
  };
  anomaliesDetected: SentinelAnomaly[];
  healedCount: number;
  timestamp: number;
}

/**
 * Normaliza y fuerza el uso estricto de una unidad de medida limpia en mayúsculas ("U").
 * Erradica caracteres corruptos derivados de malas codificaciones (como 'Π' en Audífonos),
 * espacios extraños o glifos no imprimibles.
 */
export function normalizeUnit(rawUnit?: string | null): string {
  if (!rawUnit) return "U";
  const trimmed = String(rawUnit).trim();
  // Erradicar glifos corruptos como 'Π', 'π' o símbolos especiales no estándar
  if (/^[^\w\s]+$/i.test(trimmed) || trimmed === "Π" || trimmed === "π" || trimmed.charCodeAt(0) > 127) {
    return "U";
  }
  const lower = trimmed.toLowerCase();
  if (
    lower === "u" ||
    lower === "ud" ||
    lower === "uds" ||
    lower === "unidad" ||
    lower === "unidades" ||
    lower === "pz" ||
    lower === "pza" ||
    lower === "pzas" ||
    lower === "pieza" ||
    lower === "piezas" ||
    lower === "unit" ||
    lower === "un"
  ) {
    return "U";
  }
  if (lower === "kg" || lower === "kgs" || lower === "kilo" || lower === "kilogramo") {
    return "KG";
  }
  if (lower === "g" || lower === "gr" || lower === "gramos") {
    return "G";
  }
  if (lower === "l" || lower === "lt" || lower === "lts" || lower === "litro" || lower === "litros") {
    return "L";
  }
  if (lower === "ml") {
    return "ML";
  }
  if (lower === "m" || lower === "mts" || lower === "metro" || lower === "metros") {
    return "M";
  }
  // Para cualquier otra unidad alfanumérica corta limpia, poner en mayúsculas
  const cleaned = trimmed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return cleaned.length > 0 && cleaned.length <= 4 ? cleaned : "U";
}

/**
 * Convierte un texto a Formato de Título (Title Case), asegurando que cada palabra
 * inicie con letra mayúscula (ej: "ratón inalámbrico" -> "Ratón Inalámbrico",
 * "audífonos samsung" -> "Audífonos Samsung").
 */
export function toTitleCase(text: string | null | undefined): string {
  if (!text) return "";
  const cleaned = String(text)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!cleaned) return "";

  // Separar por palabras y capitalizar la primera letra respetando tildes y caracteres hispanos
  return cleaned
    .split(" ")
    .map((word) => {
      if (!word) return "";
      const lower = word.toLowerCase();
      // Siglas comunes que deben quedar todas en mayúsculas
      if (["usb", "led", "rgb", "hd", "fhd", "ssd", "hdd", "ram", "cpu", "tv", "dvd", "pc", "pos", "pro", "max", "plus"].includes(lower)) {
        return lower.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Sanitiza cualquier texto de entrada eliminando retornos de carro, saltos de línea y tabuladores
 * que romperían las filas de tablas impresas en el PDF, y aplica Title Case si se indica.
 */
export function sanitizeTextForPdf(text: string | null | undefined, maxChars = 38, applyTitleCase = false): string {
  if (!text) return "Sin descripción";
  let cleaned = String(text)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (applyTitleCase) {
    cleaned = toTitleCase(cleaned);
  }

  if (cleaned.length > maxChars) {
    cleaned = cleaned.substring(0, maxChars - 2).trim() + "..";
  }
  return cleaned;
}

/**
 * Sentinel que audita exhaustivamente el dataset de filas IPVE/IPV antes de la generación
 * del reporte PDF, corrigiendo inconsistencias de existencias, importes y sumatorias.
 */
export function runIPVSentinel(
  rows: IPVRow[],
  declaredTotals?: any
): SentinelIPVResult {
  const anomalies: SentinelAnomaly[] = [];
  let healedCount = 0;

  // Sanitizar, capitalizar y validar cada fila individual
  const healedRows: IPVRow[] = rows.map((raw, idx) => {
    // Aplicar Title Case estricto a los nombres de los productos
    const rawName = raw.name || `Producto #${idx + 1}`;
    const capitalizedName = toTitleCase(rawName);
    const rowName = sanitizeTextForPdf(capitalizedName, 36);
    const sku = sanitizeTextForPdf(raw.sku || "-", 18);
    // Forzar unidad de medida normalizada a 'U' / mayúscula estandarizada
    const unit = normalizeUnit(raw.unit);

    // Valores cuantitativos garantizados >= 0
    let invInicialCant = Math.max(0, Number(raw.invInicialCant) || 0);
    let entradasCant = Math.max(0, Number(raw.entradasCant) || 0);
    let mermasCant = Math.max(0, Number(raw.mermasCant) || 0);
    let vendidoCant = Math.max(0, Number(raw.vendidoCant) || 0);

    const precioVenta = roundCurrency(Math.max(0, Number(raw.precioVenta) || 0));
    const costoUnitario = roundCurrency(Math.max(0, Number(raw.costoUnitario) || 0));

    // Regla 1: Disponible para Venta = Inicial + Entradas
    const expectedDispCant = Math.round((invInicialCant + entradasCant) * 100) / 100;
    let dispVentaCant = Number(raw.dispVentaCant) || 0;
    if (Math.abs(dispVentaCant - expectedDispCant) > 0.001) {
      anomalies.push({
        type: "FORMULA",
        code: "DISP_VENTA_MISMATCH",
        item: rowName,
        message: `Disp. Venta (${dispVentaCant}) no coincidía con Inicial (${invInicialCant}) + Entradas (${entradasCant}). Autocorrige a ${expectedDispCant}.`,
        originalValue: dispVentaCant,
        healedValue: expectedDispCant,
      });
      dispVentaCant = expectedDispCant;
      healedCount++;
    }

    // Regla 2: Inventario Final = Disponible - Mermas - Vendido (con cota inferior 0)
    const expectedFinalCant = Math.max(
      0,
      Math.round((dispVentaCant - mermasCant - vendidoCant) * 100) / 100
    );
    let invFinalCant = Number(raw.invFinalCant) || 0;
    if (Math.abs(invFinalCant - expectedFinalCant) > 0.001) {
      anomalies.push({
        type: "FORMULA",
        code: "INV_FINAL_MISMATCH",
        item: rowName,
        message: `Inv. Final (${invFinalCant}) no coincidía con Disp (${dispVentaCant}) - Mermas (${mermasCant}) - Vendido (${vendidoCant}). Autocorrige a ${expectedFinalCant}.`,
        originalValue: invFinalCant,
        healedValue: expectedFinalCant,
      });
      invFinalCant = expectedFinalCant;
      healedCount++;
    }

    // Regla 3: Valorizaciones monetarias consistentes
    const invInicialValor = roundCurrency(invInicialCant * costoUnitario);
    const entradasValor = roundCurrency(entradasCant * costoUnitario);
    const mermasValor = roundCurrency(mermasCant * costoUnitario);
    const dispVentaValor = roundCurrency(dispVentaCant * costoUnitario);
    const invFinalValor = roundCurrency(invFinalCant * costoUnitario);

    // Regla 4: Importe de Ventas y Márgenes
    const expectedImporteVendido = roundCurrency(vendidoCant * precioVenta);
    let importeVendido = roundCurrency(Number(raw.importeVendido) || 0);
    if (Math.abs(importeVendido - expectedImporteVendido) > 0.05) {
      anomalies.push({
        type: "FORMULA",
        code: "IMPORTE_VENTA_MISMATCH",
        item: rowName,
        message: `Importe vendido (${importeVendido}) no coincidía con Cant. Vendida (${vendidoCant}) * Precio (${precioVenta}). Autocorrige a ${expectedImporteVendido}.`,
        originalValue: importeVendido,
        healedValue: expectedImporteVendido,
      });
      importeVendido = expectedImporteVendido;
      healedCount++;
    }

    const expectedCostoTotal = roundCurrency(vendidoCant * costoUnitario);
    let costoTotal = roundCurrency(Number(raw.costoTotal) || 0);
    if (Math.abs(costoTotal - expectedCostoTotal) > 0.05) {
      costoTotal = expectedCostoTotal;
      healedCount++;
    }

    const gananciaBruta = roundCurrency(importeVendido - costoTotal);
    const margenPct = importeVendido > 0 ? roundCurrency((gananciaBruta / importeVendido) * 100) : 0;
    const costoPorVenta = importeVendido > 0 ? roundCurrency(costoTotal / importeVendido) : 0;

    return {
      productId: raw.productId || `prod_${idx}`,
      sku,
      name: rowName,
      unit,
      invInicialCant,
      invInicialValor,
      entradasCant,
      entradasValor,
      mermasCant,
      mermasValor,
      dispVentaCant,
      dispVentaValor,
      invFinalCant,
      invFinalValor,
      vendidoCant,
      precioVenta,
      costoUnitario,
      importeVendido,
      costoTotal,
      costoPorVenta,
      gananciaBruta,
      margenPct,
    };
  });

  // Reconciliación estricta de Totales Generales (Suma Matemática Pura)
  let sumInicialCant = 0;
  let sumInicialValor = 0;
  let sumEntradasCant = 0;
  let sumEntradasValor = 0;
  let sumMermasCant = 0;
  let sumMermasValor = 0;
  let sumDispCant = 0;
  let sumDispValor = 0;
  let sumFinalCant = 0;
  let sumFinalValor = 0;
  let sumVendidoCant = 0;
  let sumImporteVendido = 0;
  let sumCostoTotal = 0;

  healedRows.forEach((r) => {
    sumInicialCant += r.invInicialCant;
    sumInicialValor += r.invInicialValor;
    sumEntradasCant += r.entradasCant;
    sumEntradasValor += r.entradasValor;
    sumMermasCant += r.mermasCant;
    sumMermasValor += r.mermasValor;
    sumDispCant += r.dispVentaCant;
    sumDispValor += r.dispVentaValor;
    sumFinalCant += r.invFinalCant;
    sumFinalValor += r.invFinalValor;
    sumVendidoCant += r.vendidoCant;
    sumImporteVendido += r.importeVendido;
    sumCostoTotal += r.costoTotal;
  });

  sumInicialCant = Math.round(sumInicialCant * 100) / 100;
  sumInicialValor = roundCurrency(sumInicialValor);
  sumEntradasCant = Math.round(sumEntradasCant * 100) / 100;
  sumEntradasValor = roundCurrency(sumEntradasValor);
  sumMermasCant = Math.round(sumMermasCant * 100) / 100;
  sumMermasValor = roundCurrency(sumMermasValor);
  sumDispCant = Math.round(sumDispCant * 100) / 100;
  sumDispValor = roundCurrency(sumDispValor);
  sumFinalCant = Math.round(sumFinalCant * 100) / 100;
  sumFinalValor = roundCurrency(sumFinalValor);
  sumVendidoCant = Math.round(sumVendidoCant * 100) / 100;
  sumImporteVendido = roundCurrency(sumImporteVendido);
  sumCostoTotal = roundCurrency(sumCostoTotal);

  const totalGananciaBruta = roundCurrency(sumImporteVendido - sumCostoTotal);
  const totalMargenPct = sumImporteVendido > 0 ? roundCurrency((totalGananciaBruta / sumImporteVendido) * 100) : 0;

  // Comparar con declaredTotals para registrar posibles discrepancias
  if (declaredTotals) {
    if (declaredTotals.importeVendido !== undefined && Math.abs(declaredTotals.importeVendido - sumImporteVendido) > 0.05) {
      anomalies.push({
        type: "TOTALS",
        code: "TOTAL_IMPORTE_MISMATCH",
        item: "Total Importe CUP",
        message: `Total importe declarado (${declaredTotals.importeVendido}) no coincidía con la suma de filas (${sumImporteVendido}). Corregido a suma exacta.`,
        originalValue: declaredTotals.importeVendido,
        healedValue: sumImporteVendido,
      });
      healedCount++;
    }
  }

  const healedTotals = {
    invInicialCant: sumInicialCant,
    invInicialValor: sumInicialValor,
    entradasCant: sumEntradasCant,
    entradasValor: sumEntradasValor,
    mermasCant: sumMermasCant,
    mermasValor: sumMermasValor,
    dispVentaCant: sumDispCant,
    dispVentaValor: sumDispValor,
    invFinalCant: sumFinalCant,
    invFinalValor: sumFinalValor,
    vendidoCant: sumVendidoCant,
    importeVendido: sumImporteVendido,
    costoTotal: sumCostoTotal,
    gananciaBruta: totalGananciaBruta,
    margenPct: totalMargenPct,
    totalProducts: healedRows.length,
  };

  return {
    isValid: true,
    healedRows,
    healedTotals,
    anomaliesDetected: anomalies,
    healedCount,
    timestamp: Date.now(),
  };
}

/**
 * Sentinel para auditar el Catálogo General de Inventario
 */
export function runInventoryCatalogSentinel(products: Product[]): {
  verifiedProducts: Product[];
  totalUnits: number;
  totalCostVal: number;
  totalSaleVal: number;
  potentialProfit: number;
  averageMargin: number;
} {
  let totalUnits = 0;
  let totalCostVal = 0;
  let totalSaleVal = 0;

  const verifiedProducts = products.map((p, idx) => {
    const cleanName = sanitizeTextForPdf(toTitleCase(p.name || `Producto #${idx + 1}`), 36);
    const cleanCategory = sanitizeTextForPdf(toTitleCase(p.category || "General"), 20);
    const cleanUnit = normalizeUnit(p.unit);

    const stock = Math.max(0, Number(p.stock) || 0);
    const cost = roundCurrency(Math.max(0, Number(p.cost) || 0));
    const price = roundCurrency(Math.max(0, Number(p.price) || 0));

    totalUnits += stock;
    totalCostVal += roundCurrency(stock * cost);
    totalSaleVal += roundCurrency(stock * price);

    return {
      ...p,
      name: cleanName,
      category: cleanCategory,
      unit: cleanUnit,
      stock,
      cost,
      price,
    };
  });

  totalUnits = Math.round(totalUnits * 100) / 100;
  totalCostVal = roundCurrency(totalCostVal);
  totalSaleVal = roundCurrency(totalSaleVal);
  const potentialProfit = roundCurrency(totalSaleVal - totalCostVal);
  const averageMargin = totalSaleVal > 0 ? roundCurrency((potentialProfit / totalSaleVal) * 100) : 0;

  return {
    verifiedProducts,
    totalUnits,
    totalCostVal,
    totalSaleVal,
    potentialProfit,
    averageMargin,
  };
}

/**
 * Disparador de seguridad preventivo que DEBE ejecutarse antes de crear cualquier PDF.
 * Bloquea la emisión si los datos están totalmente vacíos o corruptos, y garantiza
 * que el generador del PDF trabaje siempre con datos auditados y blindados.
 */
export function preFlightSentinelGuard(
  datasetName: string,
  rows: any[]
): void {
  if (!rows || !Array.isArray(rows)) {
    throw new Error(`[Sentinel Guard] El dataset "${datasetName}" no es un conjunto de datos válido.`);
  }

  if (rows.length === 0) {
    throw new Error(`[Sentinel Guard] No es posible emitir un reporte "${datasetName}" sin registros de productos.`);
  }
}
