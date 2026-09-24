import type { CurrencyCode, ExchangeRates } from "../types";

export const DEFAULT_RATES: ExchangeRates = {
  CUP: 1,
  USD: 350,
  EUR: 370,
  MLC: 300,
};

export function formatCurrency(
  amountInCUP: number,
  currency: CurrencyCode = "CUP",
  rates: ExchangeRates = DEFAULT_RATES
): string {
  if (currency === "CUP") {
    return `CUP ${amountInCUP.toLocaleString("es-ES", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  const rate = rates[currency] || 1;
  const converted = amountInCUP / rate;

  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "MLC";
  return `${symbol} ${converted.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
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
