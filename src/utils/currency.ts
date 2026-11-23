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
export function formatCurrency(
  amountInCUP: number,
  currency: CurrencyCode = "CUP",
  rates: ExchangeRates = DEFAULT_RATES
): string {
  if (isNaN(amountInCUP) || !isFinite(amountInCUP)) return "CUP $ 0.00";

  if (currency === "CUP") {
    const formatted = formatGroupedNumber(roundCurrency(amountInCUP), 2, 2);
    return `CUP $ ${formatted}`;
  }

  const rate = rates[currency] || 1;
  const converted = roundCurrency(amountInCUP / rate);
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "MLC";
  const formatted = formatGroupedNumber(converted, 2, 2);

  return `${symbol} ${formatted} ${currency}`;
}

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
