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

/**
 * Formateo estándar uniforme para montos contables en tablas, reportes y PDF.
 * Garantiza comas para miles y punto para decimales (estándar contable cubano y latinoamericano).
 * Elimina por completo discrepancias de máscaras como "12.000" frente a "2000".
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

  const formatted = rounded.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

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
  const rounded = Math.round((qty + Number.EPSILON) * 100) / 100;
  return rounded.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
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
    const formatted = roundCurrency(amountInCUP).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `CUP $ ${formatted}`;
  }

  const rate = rates[currency] || 1;
  const converted = roundCurrency(amountInCUP / rate);
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "MLC";
  const formatted = converted.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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
