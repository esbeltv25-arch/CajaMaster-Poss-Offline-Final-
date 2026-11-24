/**
 * elTOQUE exchange rates (Cuban informal market) — https://eltoque.com/tasas-de-cambio-cuba
 *
 * Official API: GET https://tasas.eltoque.com/v1/trmi  (Authorization: Bearer <token>)
 *  - One token per integrated application, requested for free at https://tasas-token.eltoque.com/
 *  - Limits: 60 requests/minute per token.
 *  - Terms: cite elTOQUE as the source; rates are REFERENTIAL; do not share the token.
 *
 * The API does not send CORS headers, so a browser page cannot call it directly.
 * In the Android APK the request goes through the native HTTP layer (CapacitorHttp),
 * which is not subject to CORS. On the web it is attempted and fails gracefully.
 *
 * Rates are always optional: without token or internet the app keeps the last rates.
 */
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import type { ExchangeRates } from "../types";

export type RateCurrency = "USD" | "EUR" | "MLC";
export const RATE_CURRENCIES: RateCurrency[] = ["USD", "EUR", "MLC"];

export const ELTOQUE_API_URL = "https://tasas.eltoque.com/v1/trmi";
export const ELTOQUE_TOKEN_FORM_URL = "https://tasas-token.eltoque.com/";
export const ELTOQUE_PAGE_URL = "https://eltoque.com/tasas-de-cambio-cuba";
const AUTO_INTERVAL_MS = 3 * 60 * 60 * 1000; // every 3 hours
const STORAGE_KEY = "cajamaster_rates_sync_v1";

export interface RateSyncSettings {
  /** Token entered by the user in Ajustes (optional if the build includes one). */
  token: string;
  /** Update automatically when the app opens (and every 3 h) if there is internet. */
  autoUpdate: boolean;
  /** Per currency: follow elTOQUE (+ offset) or keep the manual value. */
  modes: Record<RateCurrency, "eltoque" | "manual">;
  /** CUP added to the elTOQUE rate (negative = below the estimate). */
  offsets: Record<RateCurrency, number>;
  /** Last values received from elTOQUE. */
  last?: { fetchedAt: number; values: Partial<Record<RateCurrency, number>>; sourceDate?: string };
}

export const DEFAULT_RATE_SYNC: RateSyncSettings = {
  token: "",
  autoUpdate: true,
  modes: { USD: "eltoque", EUR: "eltoque", MLC: "eltoque" },
  offsets: { USD: 0, EUR: 0, MLC: 0 },
};

export function getRateSyncSettings(): RateSyncSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        ...DEFAULT_RATE_SYNC,
        ...p,
        modes: { ...DEFAULT_RATE_SYNC.modes, ...(p.modes || {}) },
        offsets: { ...DEFAULT_RATE_SYNC.offsets, ...(p.offsets || {}) },
      };
    }
  } catch {}
  return { ...DEFAULT_RATE_SYNC, modes: { ...DEFAULT_RATE_SYNC.modes }, offsets: { ...DEFAULT_RATE_SYNC.offsets } };
}

export function saveRateSyncSettings(update: Partial<RateSyncSettings>): RateSyncSettings {
  const next = { ...getRateSyncSettings(), ...update };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

/** Token from Ajustes, or the one compiled into this build (VITE_ELTOQUE_TOKEN, never committed). */
export function getEffectiveToken(settings = getRateSyncSettings()): string {
  const built = (import.meta as any).env?.VITE_ELTOQUE_TOKEN || "";
  return (settings.token || built || "").trim();
}

export function hasBuiltInToken(): boolean {
  return Boolean(((import.meta as any).env?.VITE_ELTOQUE_TOKEN || "").trim());
}

/**
 * Extracts USD / EUR / MLC (CUP per unit) from the API response.
 * elTOQUE names the euro "ECU"; the rates may come at the root or inside "tasas".
 */
export function parseElToqueResponse(json: any): { values: Partial<Record<RateCurrency, number>>; sourceDate?: string } {
  const obj = json && typeof json === "object" ? (json.tasas && typeof json.tasas === "object" ? json.tasas : json) : {};
  const num = (v: any) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return typeof n === "number" && isFinite(n) && n > 0 ? n : undefined;
  };
  const values: Partial<Record<RateCurrency, number>> = {};
  const usd = num(obj.USD);
  const eur = num(obj.ECU) ?? num(obj.EUR);
  const mlc = num(obj.MLC);
  if (usd) values.USD = usd;
  if (eur) values.EUR = eur;
  if (mlc) values.MLC = mlc;
  let sourceDate: string | undefined;
  if (json?.date) {
    sourceDate = String(json.date) + (json.hour !== undefined ? ` ${String(json.hour).padStart(2, "0")}:${String(json.minutes ?? 0).padStart(2, "0")}` : "");
  }
  return { values, sourceDate };
}

export interface FetchResult {
  ok: boolean;
  values?: Partial<Record<RateCurrency, number>>;
  sourceDate?: string;
  error?: string;
}

/** Calls the elTOQUE API. Never throws. */
export async function fetchElToqueRates(token = getEffectiveToken()): Promise<FetchResult> {
  if (!token) return { ok: false, error: "Falta la clave de la API de elTOQUE (Ajustes → Moneda y tipos de cambio)." };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, error: "Sin conexión a internet. Se mantienen las últimas tasas." };
  }
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  try {
    let status = 0;
    let data: any = null;
    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.get({ url: ELTOQUE_API_URL, headers, connectTimeout: 10000, readTimeout: 10000 });
      status = res.status;
      data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
    } else {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch(ELTOQUE_API_URL, { headers, signal: controller.signal, cache: "no-store" });
        status = res.status;
        data = await res.json().catch(() => null);
      } finally {
        clearTimeout(timer);
      }
    }
    if (status === 401 || status === 403) return { ok: false, error: "La clave de elTOQUE no es válida o ha caducado." };
    if (status === 429) return { ok: false, error: "Demasiadas consultas a elTOQUE. Inténtalo en un minuto." };
    if (status < 200 || status >= 300) return { ok: false, error: `elTOQUE respondió con error ${status}.` };
    const parsed = parseElToqueResponse(data);
    if (!Object.keys(parsed.values).length) return { ok: false, error: "La respuesta de elTOQUE no contiene tasas reconocibles." };
    return { ok: true, ...parsed };
  } catch (e: any) {
    const web = !Capacitor.isNativePlatform();
    return {
      ok: false,
      error: web
        ? "El navegador bloquea la consulta directa a elTOQUE (CORS). La actualización automática funciona en la app Android."
        : "No se pudo conectar con elTOQUE. Se mantienen las últimas tasas.",
    };
  }
}

/** Rates to apply: elTOQUE value + offset for currencies in "eltoque" mode; current value otherwise. */
export function computeAppliedRates(
  current: ExchangeRates,
  settings: RateSyncSettings,
  values = settings.last?.values || {}
): ExchangeRates {
  const next: ExchangeRates = { ...current, CUP: 1 };
  for (const c of RATE_CURRENCIES) {
    const base = values[c];
    if (settings.modes[c] === "eltoque" && base && base > 0) {
      next[c] = Math.max(1, Math.round((base + (Number(settings.offsets[c]) || 0)) * 100) / 100);
    }
  }
  return next;
}

/**
 * Fetches and applies elTOQUE rates. `force` ignores the 3-hour interval.
 * `apply` receives the new rates (the store action), so this module does not import the store.
 */
export async function updateRatesFromElToque(
  currentRates: ExchangeRates,
  apply: (rates: ExchangeRates) => void,
  force = false
): Promise<FetchResult & { applied?: ExchangeRates; skipped?: boolean }> {
  const settings = getRateSyncSettings();
  if (!force) {
    if (!settings.autoUpdate) return { ok: false, skipped: true };
    if (!RATE_CURRENCIES.some((c) => settings.modes[c] === "eltoque")) return { ok: false, skipped: true };
    if (settings.last && Date.now() - settings.last.fetchedAt < AUTO_INTERVAL_MS) return { ok: false, skipped: true };
    if (!getEffectiveToken(settings)) return { ok: false, skipped: true };
  }
  const res = await fetchElToqueRates(getEffectiveToken(settings));
  if (!res.ok || !res.values) return res;
  const updated = saveRateSyncSettings({
    last: { fetchedAt: Date.now(), values: { ...(settings.last?.values || {}), ...res.values }, sourceDate: res.sourceDate },
  });
  const applied = computeAppliedRates(currentRates, updated);
  apply(applied);
  return { ...res, applied };
}
