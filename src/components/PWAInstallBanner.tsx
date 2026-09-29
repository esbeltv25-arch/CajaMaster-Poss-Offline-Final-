import React, { useState } from "react";
import { usePWAInstall } from "../utils/usePWAInstall";
import { IconCheck, IconShield } from "./Icons";

export const PWAInstallCard: React.FC = () => {
  const { isInstallable, isInstalled, isWindows, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  // If already running inside standalone PWA window or native Capacitor APK
  if (isInstalled) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <IconCheck size={20} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--color-ink)]">Aplicación Instalada (Standalone)</h4>
            <p className="text-[11px] text-[var(--color-ink-muted)]">
              Ejecutando en modo app de escritorio/móvil con almacenamiento y caché offline activo.
            </p>
          </div>
        </div>
        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-1 rounded-lg">
          Activo
        </span>
      </div>
    );
  }

  const handleInstallClick = async () => {
    setInstalling(true);
    try {
      await install();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-900/30 via-slate-900/40 to-indigo-900/30 border border-blue-500/30 rounded-2xl p-4.5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-600/25 border border-blue-400/40 text-blue-400 flex items-center justify-center font-bold text-lg shadow-inner">
            💻
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black tracking-wide text-white uppercase">
                {isWindows ? "Instalar en Windows (PWA Desktop)" : "Instalar App de Escritorio / PWA"}
              </h4>
              <span className="text-[9px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-400/30">
                Offline
              </span>
            </div>
            <p className="text-[11.5px] text-slate-300 leading-relaxed mt-0.5">
              Instala CajaMaster TPV en tu PC con Windows (Chrome/Edge) para ejecutarlo en una ventana propia sin barras de navegador y con carga ultrarrápida.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {isInstallable ? (
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={installing}
            className="flex-1 min-w-[200px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-blue-500/25 transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>⬇️</span>
            <span>{installing ? "Instalando..." : "Instalar CajaMaster en este Equipo"}</span>
          </button>
        ) : isIOS ? (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
          >
            <span>📱 Instrucciones para iOS / Safari</span>
          </button>
        ) : (
          <div className="flex-1 flex items-center justify-between text-[11px] text-slate-400 bg-slate-800/60 border border-white/5 rounded-xl px-3 py-2">
            <span>Para instalar en PC: Haz clic en el ícono de instalación (🖥️ / ⊕) en la barra de direcciones de Chrome o Edge.</span>
          </div>
        )}
      </div>

      {showIOSGuide && (
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-700/60 text-slate-200 text-xs space-y-1.5">
          <p className="font-bold text-amber-400">Instalación en iPhone / iPad:</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px]">
            <li>Toca el botón <strong>Compartir</strong> (ícono con flecha hacia arriba) en Safari.</li>
            <li>Baja y selecciona <strong>"Agregar a la pantalla de inicio"</strong>.</li>
          </ol>
          <button
            type="button"
            onClick={() => setShowIOSGuide(false)}
            className="mt-2 text-[10px] text-blue-400 hover:underline font-bold"
          >
            Entendido
          </button>
        </div>
      )}
    </div>
  );
};
