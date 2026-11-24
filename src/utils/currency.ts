import type { CurrencyCode, ExchangeRates } from "../types";

export const DEFAULT_RATES: ExchangeRates = {
  CUP: 1,
  USD: 350,
  EUR: 370,
  MLC: 300,
};

/**
 * Redondeo contable exacto a 2 decimales para evitar arrastre de coma flotante IEEE 754.
 */
export function roundCurrency(amount: number): number {
  if (isNaN(amount) || !isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function formatGroupedNumber(num: number, minDecimals: number, maxDecimals: number): string {
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round((num + Number.EPSILON) * factor) / factor;
  const isNeg = rounded < 0;
  const absVal = Math.abs(rounded);

  let fixed = absVal.toFixed(maxDecimals);
  if (minDecimals < maxDecimals) {
    // Trim trailing zeros down to minDecimals
    const [intPart, decPart = ""] = fixed.split(".");
    let trimmedDec = decPart.replace(/0+$/, "");
    while (trimmedDec.length < minDecimals) {
      trimmedDec += "0";
    }
    fixed = trimmedDec.length > 0 ? `${intPart}.${trimmedDec}` : intPart;
  }

  const [intPart, decPart] = fixed.split(".");
  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const combined = decPart !== undefined ? `${groupedInt}.${decPart}` : groupedInt;
  return isNeg ? `-${combined}` : combined;
}

/**
 * Formateo estándar uniforme para montos contables en tablas, reportes y PDF.
 * Garantiza comas para miles y punto para decimales (estándar contable cubano y latinoamericano).
 * Elimina por completo discrepancias de máscaras como "12.000" o "1.100.00".
 *
 * Ejemplos:
 *   formatAccounting(2000) -> "2,000.00"
 *   formatAccounting(12000) -> "12,000.00"
 *   formatAccounting(0, { dashIfZero: true }) -> "-"
 */
export function formatAccounting(
  amount: number,
  options?: {
    decimals?: number;
    currencySymbol?: string;
    dashIfZero?: boolean;
  }
): string {
  if (isNaN(amount) || !isFinite(amount)) return "0.00";
  const decimals = options?.decimals ?? 2;
  const rounded = roundCurrency(amount);

  if (options?.dashIfZero && Math.abs(rounded) < 0.0001) {
    return "-";
  }

  const formatted = formatGroupedNumber(rounded, decimals, decimals);

  if (options?.currencySymbol) {
    return `${options.currencySymbol} ${formatted}`;
  }
  return formatted;
}

/**
 * Formateo numérico para cantidades de unidades (Stock, Ventas, Entradas, Mermas).
 * Muestra números enteros sin decimales innecesarios, o hasta 2 decimales si es peso fraccionario.
 * Elimina sufijos pegados como "0 u" que visualmente se confunden con "Ou".
 *
 * Ejemplos:
 *   formatQuantity(0) -> "0"
 *   formatQuantity(1500) -> "1,500"
 *   formatQuantity(2.5) -> "2.5"
 */
export function formatQuantity(qty: number): string {
  if (isNaN(qty) || !isFinite(qty)) return "0";
  return formatGroupedNumber(qty, 0, 2);
}

/**
 * Formato universal de moneda para la interfaz de usuario.
 * Garantiza que montos en CUP, USD, EUR y MLC tengan representación homogénea.
 */
/**
 * One unambiguous label per currency. "$" is NOT used: in Cuba it can mean CUP
 * or US dollar, and "CUP $ 1,250.00" looked like dollars.
 */
export function currencyLabel(currency: CurrencyCode): string {
  return currency || "CUP";
}

/**
 * Formats an amount stored in CUP (the base currency) in the requested currency,
 * converting with the app exchange rates. Examples:
 *   formatCurrency(15000)                 -> "CUP 15,000.00"
 *   formatCurrency(15000, "USD", rates)   -> "USD 42.86"
 */
export function formatCurrency(
  amountInCUP: number,
  currency: CurrencyCode = "CUP",
  rates: ExchangeRates = DEFAULT_RATES
): string {
  const label = currencyLabel(currency);
  if (isNaN(amountInCUP) || !isFinite(amountInCUP)) return `${label} 0.00`;
  const value = currency === "CUP" ? amountInCUP : amountInCUP / (rates[currency] || 1);
  return `${label} ${formatGroupedNumber(roundCurrency(value), 2, 2)}`;
}

/** Bills offered as quick buttons when charging in each currency. */
export const QUICK_BILLS: Record<CurrencyCode, number[]> = {
  CUP: [100, 200, 500, 1000, 2000, 5000, 10000, 20000],
  USD: [1, 5, 10, 20, 50, 100],
  EUR: [5, 10, 20, 50, 100, 200],
  MLC: [1, 5, 10, 20, 50, 100],
};

export function convertFromCUP(
  amountInCUP: number,
  toCurrency: CurrencyCode,
  rates: ExchangeRates = DEFAULT_RATES
): number {
  if (toCurrency === "CUP") return amountInCUP;
  const rate = rates[toCurrency] || 1;
  return amountInCUP / rate;
}

export function convertToCUP(
  amount: number,
  fromCurrency: CurrencyCode,
  rates: ExchangeRates = DEFAULT_RATES
): number {
  if (fromCurrency === "CUP") return amount;
  const rate = rates[fromCurrency] || 1;
  return amount * rate;
}
