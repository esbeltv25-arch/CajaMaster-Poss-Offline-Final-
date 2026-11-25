import React from "react";
import { useTheme, uiScaleFor, UI_SCALE_MIN, UI_SCALE_MAX, type LayoutMode } from "../themeContext";
import { IconCheck, IconRotate, IconSliders } from "./Icons";

interface ScreenCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScreenCalibrationModal({ isOpen, onClose }: ScreenCalibrationModalProps) {
  const { calibration, setCalibration, resetCalibration, layoutMode } = useTheme();
  const uiScale = uiScaleFor(calibration, layoutMode);
  const MODE_LABELS: Record<LayoutMode, string> = { phone: "Móvil", tablet: "Tablet / Mostrador", fullscreen: "Escritorio" };
  const setUiScale = (v: number) =>
    setCalibration((prev) => ({
      ...prev,
      uiScaleByMode: { ...(prev.uiScaleByMode || {}), [layoutMode]: Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Math.round(v))) },
    }));

  if (!isOpen) return null;

  const handlePreset = (preset: "standard" | "large_buttons" | "gestures" | "compact") => {
    switch (preset) {
      case "standard":
        setCalibration({
          paddingTop: 16,
          paddingBottom: 24,
          paddingHorizontal: 0,
          zoom: 100,
        });
        break;
      case "large_buttons":
        setCalibration({
          paddingTop: 20,
          paddingBottom: 40,
          paddingHorizontal: 0,
          zoom: 97,
        });
        break;
      case "gestures":
        setCalibration({
          paddingTop: 12,
          paddingBottom: 12,
          paddingHorizontal: 0,
          zoom: 100,
        });
        break;
      case "compact":
        setCalibration({
          paddingTop: 0,
          paddingBottom: 0,
          paddingHorizontal: 0,
          zoom: 95,
        });
        setUiScale(95);
        break;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-pop"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-lg max-h-[calc(92vh/var(--app-scale,1))] flex flex-col overflow-hidden shadow-2xl border border-slate-200 text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-lg shadow-md">
              📱
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg leading-tight">
                Márgenes y Reescalado Móvil
              </h2>
              <p className="text-xs text-slate-300">
                Salva la cámara/notch y los botones de navegación del teléfono
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs cursor-pointer transition active:scale-95"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Quick Presets */}
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider block">
              Configuraciones Rápidas (Recomendadas)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handlePreset("standard")}
                className="p-2.5 rounded-2xl border border-slate-200 hover:border-amber-400 bg-slate-50 hover:bg-amber-50/50 text-left transition cursor-pointer group active:scale-95"
              >
                <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                  <span>📱 Estándar Móvil</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Salva cámara frontal y barra estándar
                </div>
              </button>

              <button
                type="button"
                onClick={() => handlePreset("large_buttons")}
                className="p-2.5 rounded-2xl border border-slate-200 hover:border-amber-400 bg-slate-50 hover:bg-amber-50/50 text-left transition cursor-pointer group active:scale-95"
              >
                <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                  <span>📲 Botones Android Grandes</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  + Espacio inferior para evitar toques falsos
                </div>
              </button>

              <button
                type="button"
                onClick={() => handlePreset("gestures")}
                className="p-2.5 rounded-2xl border border-slate-200 hover:border-amber-400 bg-slate-50 hover:bg-amber-50/50 text-left transition cursor-pointer group active:scale-95"
              >
                <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                  <span>✨ Gestos / Todo Pantalla</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Para móviles sin los 3 botones en pantalla
                </div>
              </button>

              <button
                type="button"
                onClick={() => handlePreset("compact")}
                className="p-2.5 rounded-2xl border border-slate-200 hover:border-amber-400 bg-slate-50 hover:bg-amber-50/50 text-left transition cursor-pointer group active:scale-95"
              >
                <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                  <span>🔍 Modo Compacto 95%</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Reescala para ver más información
                </div>
              </button>
            </div>
          </div>

          {/* Detailed Fine-Tuning Sliders */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <IconSliders size={14} className="text-amber-600" />
              <span>Ajuste Milimétrico Manual</span>
            </h4>

            {/* Top Margin (Camera / Notch) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <span>📷</span> Margen Superior Extra (Cámara / Notch)
                </span>
                <span className="font-mono text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md font-extrabold text-[11px]">
                  +{calibration.paddingTop}px
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                step={2}
                value={calibration.paddingTop}
                onChange={(e) => setCalibration({ paddingTop: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500">
                Añade espacio en la parte superior para que la lente de la cámara y el reloj no tapen títulos ni botones.
              </p>
            </div>

            {/* Bottom Margin (Navigation Buttons) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <span>🕹️</span> Margen Inferior Extra (Botones del Teléfono)
                </span>
                <span className="font-mono text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md font-extrabold text-[11px]">
                  +{calibration.paddingBottom}px
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                step={4}
                value={calibration.paddingBottom}
                onChange={(e) => setCalibration({ paddingBottom: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500">
                Eleva los botones de cobro y el menú inferior para que no choquen con los botones Atrás / Inicio / Menú de Android.
              </p>
            </div>

            {/* Size of text and buttons (per screen format) */}
            <div className="space-y-2 pt-2 border-t border-slate-200" id="ui-scale-control">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <span>🔠</span> Tamaño de letra y botones
                </span>
                <span className="font-mono text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md font-extrabold text-[11px]" id="ui-scale-value">
                  {uiScale}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { v: 100, label: "Normal" },
                  { v: 115, label: "Grande" },
                  { v: 130, label: "Muy grande" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    id={`ui-scale-${o.v}`}
                    onClick={() => setUiScale(o.v)}
                    className={`py-2 rounded-xl text-xs font-extrabold cursor-pointer transition ${
                      uiScale === o.v ? "bg-slate-900 text-amber-400" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {o.label}
                    <span className="block text-[10px] font-semibold opacity-70">{o.v}%</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="ui-scale-minus"
                  aria-label="Más pequeño"
                  onClick={() => setUiScale(uiScale - 5)}
                  className="w-9 h-9 rounded-xl bg-white border border-slate-200 font-black text-sm cursor-pointer shrink-0"
                >
                  A−
                </button>
                <input
                  type="range"
                  id="ui-scale-range"
                  min={UI_SCALE_MIN}
                  max={UI_SCALE_MAX}
                  step={5}
                  value={uiScale}
                  onChange={(e) => setUiScale(Number(e.target.value))}
                  className="flex-1 min-w-0 accent-amber-500 cursor-pointer"
                />
                <button
                  type="button"
                  id="ui-scale-plus"
                  aria-label="Más grande"
                  onClick={() => setUiScale(uiScale + 5)}
                  className="w-9 h-9 rounded-xl bg-white border border-slate-200 font-black text-base cursor-pointer shrink-0"
                >
                  A+
                </button>
              </div>
              <p className="text-[10px] text-slate-500 leading-snug">
                Agranda o reduce <b>toda la app</b> (letras, botones e iconos) para verla mejor. Se guarda para el formato{" "}
                <b>{MODE_LABELS[layoutMode]}</b>; cada formato recuerda su propio tamaño. En pantallas pequeñas, con tamaños grandes
                cabe menos información y habrá que desplazarse más.
              </p>
            </div>
          </div>

          {/* Information Callout */}
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
            <span className="text-base shrink-0">💡</span>
            <p className="leading-relaxed">
              Los cambios se aplican al instante en toda la aplicación (pantalla de <strong>Ventas y Cobro</strong>, <strong>Envíos / Deliveries</strong>, <strong>Stock</strong> y <strong>Cierre de Caja</strong>) y se guardan permanentemente en este dispositivo.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={resetCalibration}
            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer flex items-center gap-1"
          >
            <IconRotate size={13} />
            <span>Restablecer</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md active:scale-95"
          >
            <IconCheck size={15} className="text-amber-400" />
            <span>Listo y Guardar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
