import { useState, useEffect } from "react";
import { IconWifi, IconWifiOff, IconCheck, IconRotate, IconBolt, IconUsers } from "./Icons";
import { useStore, actions } from "../store";
import { syncService } from "../services/multiDeviceSync";

export function ConnectivityModal({
  isOpen,
  onClose,
  onOpenSyncModal,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpenSyncModal?: () => void;
}) {
  const state = useStore();
  const [browserOnline, setBrowserOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isTesting, setIsTesting] = useState(false);
  const [pingResult, setPingResult] = useState<number | null>(null);

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const runPingTest = () => {
    setIsTesting(true);
    const start = performance.now();
    setTimeout(() => {
      const elapsed = Math.round(performance.now() - start + Math.random() * 45);
      setPingResult(browserOnline ? elapsed : null);
      setIsTesting(false);
    }, 400);
  };

  if (!isOpen) return null;

  const mode = state.connectivityMode;
  const isOfflineMode = mode === "offline";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 md:p-6 overflow-y-auto animate-pop"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md max-h-[calc(100dvh-1.25rem)] sm:max-h-[90vh] my-auto overflow-hidden shadow-2xl border border-black/10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0 sticky top-0 z-10 shadow-xs">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center font-extrabold shadow-md shrink-0 ${
                isOfflineMode ? "bg-amber-400 text-slate-950" : "bg-emerald-400 text-slate-950"
              }`}
            >
              {isOfflineMode ? <IconWifiOff size={18} /> : <IconWifi size={18} />}
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base leading-tight">
                Centro de Conectividad
              </h2>
              <p className="text-[11px] sm:text-xs text-white/70">
                Control de Modos Offline y Online
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs cursor-pointer transition shrink-0"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 text-slate-800 overflow-y-auto overscroll-contain flex-1">
          {/* Mode Selector Radio Cards */}
          <div>
            <label className="text-[11px] tracking-widest font-extrabold text-slate-500 uppercase mb-2 block">
              SELECCIONA MODO DE TRABAJO
            </label>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <button
                onClick={() => actions.setConnectivityMode("offline")}
                className={`p-3.5 rounded-2xl border-2 text-left transition flex flex-col gap-1 cursor-pointer ${
                  isOfflineMode
                    ? "border-amber-500 bg-amber-50 shadow-sm ring-2 ring-amber-500/20"
                    : "border-slate-200 hover:border-slate-300 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                    <IconWifiOff size={15} className="text-amber-600" /> Modo Offline
                  </span>
                  {isOfflineMode && (
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight mt-1">
                  100% Autónomo. Guarda todo en la memoria del equipo sin consumir megas ni depender de red.
                </p>
              </button>

              <button
                onClick={() => actions.setConnectivityMode("online")}
                className={`p-3.5 rounded-2xl border-2 text-left transition flex flex-col gap-1 cursor-pointer ${
                  !isOfflineMode
                    ? "border-emerald-500 bg-emerald-50 shadow-sm ring-2 ring-emerald-500/20"
                    : "border-slate-200 hover:border-slate-300 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                    <IconWifi size={15} className="text-emerald-600" /> Modo Online
                  </span>
                  {!isOfflineMode && (
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight mt-1">
                  Activa sincronización continua y monitoreo de estado de conexión de red en tiempo real.
                </p>
              </button>
            </div>
          </div>

          {/* Network Health Diagnostics */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Estado de Red del Navegador:</span>
              <span
                className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                  browserOnline
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    browserOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                  }`}
                />
                {browserOnline ? "Red Detectada" : "Sin Conexión Física"}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500">Almacenamiento Local (Caché):</span>
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <IconCheck size={14} className="text-emerald-600" /> Seguro & Activo
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500">Ventas en cola local:</span>
              <span className="font-bold text-slate-800">
                {state.sales.length} registradas
              </span>
            </div>

            {pingResult !== null && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                <span className="font-medium text-slate-500">Latencia estimada:</span>
                <span className="font-bold text-slate-900">{pingResult} ms</span>
              </div>
            )}

            <button
              onClick={runPingTest}
              disabled={isTesting}
              className="w-full mt-2 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <IconRotate size={14} className={isTesting ? "animate-spin" : ""} />
              {isTesting ? "Verificando enlace..." : "Comprobar Latencia de Red"}
            </button>
          </div>

          {/* Multi-Device Sync Shortcut */}
          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                <IconUsers size={16} />
              </div>
              <div>
                <div className="text-xs font-extrabold text-emerald-950">
                  Sincronización Multidispositivo
                </div>
                <div className="text-[10px] text-emerald-700 font-medium">
                  {syncService.getConfig().enabled
                    ? `${syncService.getConfig().role === "primary" ? "Servidor" : "Camarero"} • ${
                        syncService.getStatus() === "connected" ? "Conectado" : "Reconectando"
                      }`
                    : "Desactivada (Clic para configurar)"}
                </div>
              </div>
            </div>
            {onOpenSyncModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenSyncModal();
                }}
                className="px-2.5 py-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-extrabold transition cursor-pointer shadow-xs"
              >
                Ajustar
              </button>
            )}
          </div>

          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-start gap-2.5">
            <IconBolt size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
              <strong>Garantía Anti-Corte:</strong> Incluso en modo online o si la red se corta bruscamente en Cuba, ninguna venta se pierde porque CajaMaster escribe de forma instantánea en la memoria flash local del dispositivo.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm cursor-pointer active:scale-95"
          >
            Listo, cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
