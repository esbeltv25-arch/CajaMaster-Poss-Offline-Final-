import { useState } from "react";
import { NumericInput } from "./NumericInput";
import { useStore, actions } from "../store";
import { IconCoins, IconRefreshCw } from "./Icons";
import {
  RATE_CURRENCIES,
  type RateCurrency,
  type RateSyncSettings,
  getRateSyncSettings,
  saveRateSyncSettings,
  computeAppliedRates,
  updateRatesFromElToque,
  getEffectiveToken,
  hasBuiltInToken,
  ELTOQUE_TOKEN_FORM_URL,
  ELTOQUE_PAGE_URL,
} from "../services/eltoqueRates";
import { openExternalUrl } from "../utils/nativeBridge";

const LABELS: Record<RateCurrency, string> = { USD: "Dólar (USD)", EUR: "Euro (EUR)", MLC: "MLC" };

/**
 * Exchange rates: per currency, follow elTOQUE (+/- an adjustment in CUP) or a manual value.
 * elTOQUE rates are referential estimates; the merchant decides the rate actually applied.
 */
export function ExchangeRatesCard() {
  const state = useStore();
  const [sync, setSync] = useState<RateSyncSettings>(() => getRateSyncSettings());
  const [manual, setManual] = useState<Record<RateCurrency, number>>({
    USD: state.rates.USD,
    EUR: state.rates.EUR,
    MLC: state.rates.MLC,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showToken, setShowToken] = useState(false);

  const last = sync.last;
  const tokenReady = Boolean(getEffectiveToken(sync));

  const preview = (c: RateCurrency): number => {
    if (sync.modes[c] === "eltoque" && last?.values[c]) {
      return Math.max(1, Math.round((last.values[c]! + (Number(sync.offsets[c]) || 0)) * 100) / 100);
    }
    return manual[c];
  };

  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 5000);
  };

  const handleSave = () => {
    const saved = saveRateSyncSettings({ modes: sync.modes, offsets: sync.offsets, autoUpdate: sync.autoUpdate, token: sync.token.trim() });
    setSync(saved);
    const base = { CUP: 1, USD: Math.max(1, manual.USD), EUR: Math.max(1, manual.EUR), MLC: Math.max(1, manual.MLC) };
    const applied = computeAppliedRates(base, saved);
    actions.setExchangeRates(applied);
    setManual({ USD: applied.USD, EUR: applied.EUR, MLC: applied.MLC });
    flash("✓ Tasas guardadas y aplicadas", true);
  };

  const handleUpdateNow = async () => {
    setBusy(true);
    // Save the current choices first so the update uses them
    saveRateSyncSettings({ modes: sync.modes, offsets: sync.offsets, autoUpdate: sync.autoUpdate, token: sync.token.trim() });
    // Currencies in manual mode keep the value typed on screen (not the previously saved one)
    const current = { ...state.rates, CUP: 1 };
    for (const c of RATE_CURRENCIES) {
      if (sync.modes[c] === "manual") current[c] = Math.max(1, manual[c]);
    }
    const res = await updateRatesFromElToque(current, (r) => actions.setExchangeRates(r), true);
    const fresh = getRateSyncSettings();
    setSync(fresh);
    if (res.ok && res.applied) {
      const applied = res.applied;
      setManual((m) => ({
        USD: fresh.modes.USD === "eltoque" ? applied.USD : m.USD,
        EUR: fresh.modes.EUR === "eltoque" ? applied.EUR : m.EUR,
        MLC: fresh.modes.MLC === "eltoque" ? applied.MLC : m.MLC,
      }));
      flash("✓ Tasas actualizadas desde elTOQUE", true);
    } else {
      flash(res.error || "No se pudo actualizar.", false);
    }
    setBusy(false);
  };

  const setMode = (c: RateCurrency, mode: "eltoque" | "manual") =>
    setSync((s) => ({ ...s, modes: { ...s.modes, [c]: mode } }));

  return (
    <div className="card p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3 shadow-xs" id="card-exchange-rates">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shrink-0">
          <IconCoins size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="font-extrabold text-sm text-slate-900">Moneda & Tipos de Cambio</h3>
          <p className="text-[11px] text-slate-500 leading-snug">
            Base: Pesos Cubanos (CUP). Cada divisa puede seguir la tasa de elTOQUE (con tu ajuste) o un valor manual.
          </p>
        </div>
      </div>

      {/* elTOQUE status */}
      <div className="rounded-2xl bg-white border border-slate-200 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] text-slate-600 leading-snug min-w-0">
            <span className="font-extrabold text-slate-900">Tasas de elTOQUE</span>
            {last ? (
              <>
                {" "}· actualizadas {new Date(last.fetchedAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                {RATE_CURRENCIES.filter((c) => last.values[c]).length > 0 && (
                  <div className="font-mono font-bold text-slate-800 pt-0.5">
                    {RATE_CURRENCIES.filter((c) => last.values[c])
                      .map((c) => `${c} ${last.values[c]!.toLocaleString("es-ES")}`)
                      .join(" · ")}
                  </div>
                )}
              </>
            ) : (
              <> · aún no consultadas</>
            )}
          </div>
          <button
            type="button"
            id="btn-eltoque-update"
            onClick={handleUpdateNow}
            disabled={busy || !tokenReady}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <IconRefreshCw size={13} className={busy ? "animate-spin" : ""} />
            {busy ? "Consultando..." : "Actualizar ahora"}
          </button>
        </div>
        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={sync.autoUpdate}
            onChange={(e) => setSync((s) => ({ ...s, autoUpdate: e.target.checked }))}
          />
          Actualizar automáticamente al abrir la app y cada 3 horas (si hay internet)
        </label>
        <p className="text-[10px] text-slate-500 leading-snug">
          Fuente:{" "}
          <button type="button" className="underline font-bold cursor-pointer" onClick={() => openExternalUrl(ELTOQUE_PAGE_URL)}>
            elTOQUE
          </button>{" "}
          — tasa representativa del mercado informal. Es una referencia: ajusta cada divisa por encima o por debajo según tu negocio.
        </p>
      </div>

      {/* Per-currency rows */}
      <div className="space-y-2">
        {RATE_CURRENCIES.map((c) => {
          const isAuto = sync.modes[c] === "eltoque";
          const ref = last?.values[c];
          return (
            <div key={c} className="rounded-2xl bg-white border border-slate-200 p-3 space-y-2" id={`rate-row-${c}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-extrabold text-xs text-slate-900">
                  1 {c} = <span className="font-mono">{preview(c).toLocaleString("es-ES")}</span> CUP
                  <span className="block text-[10px] font-semibold text-slate-500">{LABELS[c]}</span>
                </span>
                <div className="flex rounded-xl bg-slate-100 p-0.5 text-[11px] font-extrabold">
                  <button
                    type="button"
                    id={`rate-mode-${c}-eltoque`}
                    onClick={() => setMode(c, "eltoque")}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer ${isAuto ? "bg-slate-900 text-white" : "text-slate-600"}`}
                  >
                    elTOQUE
                  </button>
                  <button
                    type="button"
                    id={`rate-mode-${c}-manual`}
                    onClick={() => setMode(c, "manual")}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer ${!isAuto ? "bg-slate-900 text-white" : "text-slate-600"}`}
                  >
                    Manual
                  </button>
                </div>
              </div>

              {isAuto ? (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                  <span>
                    elTOQUE: <b className="font-mono text-slate-900">{ref ? ref.toLocaleString("es-ES") : "—"}</b>
                  </span>
                  <span>Ajuste (CUP):</span>
                  <NumericInput
                    
                    id={`rate-offset-${c}`}
                    value={sync.offsets[c] || ""}
                    placeholder="0"
                    onValueChange={(n) => setSync((s) => ({ ...s, offsets: { ...s.offsets, [c]: n } }))}
                    className="w-20 neu-inset rounded-lg px-2 h-8 text-xs font-extrabold text-center bg-transparent outline-none"
                  />
                  <span className="text-[10px] text-slate-400">ej. −10 = 10 CUP por debajo</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-600">Tasa manual:</span>
                  <NumericInput
                    
                    id={`rate-manual-${c}`}
                    value={manual[c]}
                    onValueChange={(n) => setManual((m) => ({ ...m, [c]: n }))}
                    className="w-28 neu-inset rounded-lg px-2 h-8 text-xs font-extrabold text-center bg-transparent outline-none"
                  />
                  <span className="text-[11px] text-slate-500">CUP</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* API key */}
      <div className="rounded-2xl bg-white border border-slate-200 p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-extrabold text-slate-700">Clave de la API de elTOQUE</span>
          <button type="button" className="text-[11px] font-bold text-amber-700 underline cursor-pointer" onClick={() => setShowToken((v) => !v)}>
            {showToken ? "Ocultar" : sync.token ? "Cambiar" : hasBuiltInToken() ? "Usar otra" : "Configurar"}
          </button>
        </div>
        {hasBuiltInToken() && !sync.token && (
          <p className="text-[10.5px] text-emerald-700 font-semibold">✓ Esta versión de la app ya incluye una clave.</p>
        )}
        {!tokenReady && (
          <p className="text-[10.5px] text-slate-500 leading-snug">
            Necesaria para la actualización automática. Se solicita gratis en{" "}
            <button type="button" className="underline font-bold cursor-pointer" onClick={() => openExternalUrl(ELTOQUE_TOKEN_FORM_URL)}>
              el formulario de elTOQUE
            </button>
            .
          </p>
        )}
        {showToken && (
          <input
            type="password"
            id="input-eltoque-token"
            value={sync.token}
            onChange={(e) => setSync((s) => ({ ...s, token: e.target.value }))}
            placeholder="Pega aquí la clave (token)"
            autoComplete="off"
            className="w-full neu-inset rounded-lg px-3 h-9 text-xs font-mono bg-transparent outline-none"
          />
        )}
      </div>

      {msg && (
        <p className={`text-[11px] font-bold ${msg.ok ? "text-emerald-700" : "text-rose-700"}`} id="rates-message">
          {msg.text}
        </p>
      )}

      <button
        type="button"
        id="btn-save-rates"
        onClick={handleSave}
        className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition cursor-pointer"
      >
        Guardar y aplicar tasas
      </button>
    </div>
  );
}
