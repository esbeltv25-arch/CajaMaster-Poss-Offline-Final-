import { useState, useEffect } from "react";
import {
  getOtaConfig,
  saveOtaConfig,
  checkOtaUpdate,
  downloadAndExtractOtaBundle,
  simulateOtaUpdate,
  rollbackOtaBundle,
  applyOtaUpdateAndReload,
  type RemoteVersionInfo,
  APP_BASE_VERSION,
  APP_BASE_VERSION_CODE,
} from "../services/otaUpdateService";
import { IconCheck, IconDownload, IconRotate, IconAlert, IconBolt, IconSliders } from "./Icons";

interface OtaUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OtaUpdateModal({ isOpen, onClose }: OtaUpdateModalProps) {
  if (!isOpen) return null;

  const [config, setConfig] = useState(() => getOtaConfig());
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [remoteUpdate, setRemoteUpdate] = useState<RemoteVersionInfo | null>(config.pendingUpdate);
  const [editServerUrl, setEditServerUrl] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(config.serverUrl);
  const [activeTab, setActiveTab] = useState<"update" | "settings" | "docs">("update");

  const handleCheck = async () => {
    try {
      setIsChecking(true);
      setCheckMessage(null);
      const res = await checkOtaUpdate({ timeoutMs: 5000 });
      setConfig(getOtaConfig());

      if (res.hasUpdate && res.remoteInfo) {
        setRemoteUpdate(res.remoteInfo);
        setCheckMessage(`¡Nueva versión ${res.remoteInfo.version} disponible!`);
      } else if (res.offline) {
        setCheckMessage("Modo Offline: No se pudo conectar al servidor remoto. La aplicación continúa funcionando con la versión local.");
      } else if (res.error) {
        setCheckMessage(res.error);
      } else {
        setRemoteUpdate(null);
        setCheckMessage("¡Tu versión está completamente al día!");
      }
    } catch (err: any) {
      setCheckMessage(err.message || "Error al comprobar versión.");
    } finally {
      setIsChecking(false);
    }
  };

  const handleDownload = async () => {
    if (!remoteUpdate) return;
    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      setStatusText("Iniciando descarga...");

      const res = await downloadAndExtractOtaBundle(remoteUpdate, (pct, msg) => {
        setDownloadProgress(pct);
        setStatusText(msg);
      });

      if (res.success) {
        setConfig(getOtaConfig());
        setRemoteUpdate(null);
      } else {
        setStatusText(res.message);
      }
    } catch (err: any) {
      setStatusText("Error durante la actualización: " + (err.message || err));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSimulate = async () => {
    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      setStatusText("Ejecutando simulación de actualización OTA...");

      const nextCode = config.installedVersionCode + 10;
      const nextVersion = `1.${Math.floor(nextCode / 100)}.${nextCode % 100}`;

      const res = await simulateOtaUpdate(nextVersion, nextCode, (pct, msg) => {
        setDownloadProgress(pct);
        setStatusText(msg);
      });

      if (res.success) {
        setConfig(getOtaConfig());
        setRemoteUpdate(null);
      }
    } catch (err: any) {
      setStatusText("Error: " + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveUrl = () => {
    const updated = saveOtaConfig({ serverUrl: serverUrlInput.trim() });
    setConfig(updated);
    setEditServerUrl(false);
    setCheckMessage("URL del servidor actualizada correctamente.");
  };

  const handleRollback = () => {
    rollbackOtaBundle();
    setConfig(getOtaConfig());
    setCheckMessage("Se ha restablecido la versión base empaquetada con el APK.");
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 animate-pop"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-black/10 text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg text-lg">
              🚀
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base sm:text-lg leading-tight">
                  Actualizaciones OTA Self-Hosted
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950">
                  Capacitor
                </span>
              </div>
              <p className="text-xs text-white/70">
                Actualizaciones Over-The-Air para la interfaz web (www) sin recompilar APK
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs cursor-pointer transition active:scale-90"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-4 pt-2 shrink-0 gap-1">
          <button
            onClick={() => setActiveTab("update")}
            className={`px-3 py-2 text-xs font-black border-b-2 transition cursor-pointer ${
              activeTab === "update"
                ? "border-amber-500 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Actualización & Estado
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-3 py-2 text-xs font-black border-b-2 transition cursor-pointer ${
              activeTab === "settings"
                ? "border-amber-500 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Servidor Remoto (JSON)
          </button>
          <button
            onClick={() => setActiveTab("docs")}
            className={`px-3 py-2 text-xs font-black border-b-2 transition cursor-pointer ${
              activeTab === "docs"
                ? "border-amber-500 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Reglas de Arquitectura
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeTab === "update" && (
            <div className="space-y-4">
              {/* Version Comparison Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                      Versión Instalada Actualmente:
                    </span>
                    <span className="text-base font-black text-slate-900">
                      v{config.installedVersion}
                    </span>
                    <span className="ml-2 text-xs font-bold text-slate-500">
                      (Build {config.installedVersionCode})
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                      Última Comprobación:
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      {config.lastCheckedTs
                        ? new Date(config.lastCheckedTs).toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })
                        : "Nunca"}
                    </span>
                  </div>
                </div>

                {config.activeBundlePath && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <IconCheck size={15} className="text-emerald-600 shrink-0" />
                      <span>Ejecutando desde bundle OTA: {config.activeBundlePath}</span>
                    </div>
                    <button
                      onClick={handleRollback}
                      className="text-[10px] text-rose-700 font-extrabold hover:underline cursor-pointer"
                      title="Volver a la versión original del APK"
                    >
                      Restablecer APK base
                    </button>
                  </div>
                )}
              </div>

              {/* Feedback messages */}
              {checkMessage && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2 animate-pop">
                  <span>ℹ️</span>
                  <span className="flex-1">{checkMessage}</span>
                </div>
              )}

              {/* Update Available Card */}
              {remoteUpdate && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-400 space-y-3 animate-pop">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">✨</span>
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900">
                          Nueva Versión v{remoteUpdate.version} (Build {remoteUpdate.versionCode})
                        </h4>
                        <span className="text-[10px] font-bold text-amber-800">
                          {remoteUpdate.mandatory ? "⚠️ Actualización Requerida" : "Opcional / Recomendada"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {remoteUpdate.changelog && (
                    <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs text-slate-700">
                      <strong className="block text-slate-900 mb-1">Novedades y Mejoras:</strong>
                      <p className="whitespace-pre-line leading-relaxed">{remoteUpdate.changelog}</p>
                    </div>
                  )}

                  {isDownloading ? (
                    <div className="space-y-2 pt-1">
                      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-amber-500 h-full transition-all duration-300 rounded-full"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
                        <span>{statusText}</span>
                        <span>{downloadProgress}%</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleDownload}
                      className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md active:scale-95"
                    >
                      <IconDownload size={16} />
                      <span>Descargar e Instalar Paquete Web (.zip)</span>
                    </button>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                <button
                  onClick={handleCheck}
                  disabled={isChecking || isDownloading}
                  className="py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                >
                  <IconRotate size={15} className={isChecking ? "animate-spin" : ""} />
                  <span>{isChecking ? "Comprobando..." : "Comprobar Servidor Ahora"}</span>
                </button>

                <button
                  onClick={handleSimulate}
                  disabled={isDownloading}
                  className="py-3 px-4 rounded-2xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Simula la recepción y descompresión de una versión superior para verificar el flujo"
                >
                  <span>🧪 Simular Actualización OTA</span>
                </button>
              </div>

              {/* Restart Button */}
              <div className="pt-2">
                <button
                  onClick={applyOtaUpdateAndReload}
                  className="w-full py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <span>🔄 Recargar Interfaz / Reiniciar WebView</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                    Endpoint del Servidor Propio
                  </h4>
                  <button
                    onClick={() => setEditServerUrl(!editServerUrl)}
                    className="text-xs font-bold text-amber-600 hover:underline cursor-pointer"
                  >
                    {editServerUrl ? "Cancelar" : "Modificar URL"}
                  </button>
                </div>

                {editServerUrl ? (
                  <div className="space-y-2">
                    <input
                      type="url"
                      value={serverUrlInput}
                      onChange={(e) => setServerUrlInput(e.target.value)}
                      placeholder="https://esbeltv25-arch.github.io/CajaMaster-Updates/version.json"
                      className="w-full px-3 py-2 rounded-xl neu-inset text-xs font-bold text-slate-900 outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setServerUrlInput("https://esbeltv25-arch.github.io/CajaMaster-Updates/version.json");
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs cursor-pointer"
                      >
                        Restablecer Oficial GitHub
                      </button>
                      <button
                        onClick={handleSaveUrl}
                        className="px-4 py-2 rounded-xl bg-slate-900 text-amber-400 font-extrabold text-xs cursor-pointer shadow-xs"
                      >
                        Guardar URL
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-700 break-all flex items-center justify-between">
                      <span>{config.serverUrl}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href="https://github.com/esbeltv25-arch/CajaMaster-Updates"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <span>🔗 Ver Repositorio en GitHub: esbeltv25-arch/CajaMaster-Updates</span>
                      </a>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-slate-500">
                  La app realiza una petición GET HTTP a este endpoint JSON para comparar el versionCode.
                </p>
              </div>

              {/* JSON Example Format */}
              <div className="p-4 rounded-2xl bg-slate-900 text-slate-200 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between text-amber-400 font-bold">
                  <span>📄 Estructura esperada de version.json:</span>
                </div>
                <pre className="text-[11px] leading-relaxed overflow-x-auto text-emerald-300">
{`{
  "version": "1.3.0",
  "versionCode": 1030,
  "updateUrl": "https://tuservidor.com/cajamaster/updates/bundle-v1.3.0.zip",
  "mandatory": false,
  "changelog": "Corrección de errores en cálculo de billetes y mejoras en tickets."
}`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === "docs" && (
            <div className="space-y-3 text-xs leading-relaxed text-slate-700">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                <h4 className="font-extrabold text-emerald-950 flex items-center gap-1.5 text-xs">
                  <span>✅ CUÁNDO APLICA LA ACTUALIZACIÓN OTA (Sin Recompilar APK)</span>
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-emerald-900">
                  <li>Cambios visuales, temas claro/oscuro, estilos y layouts CSS.</li>
                  <li>Lógica de cobros, calculadora de billetes de 10k/20k CUP y TPV.</li>
                  <li>Nuevos formatos de reportes contables IPVE, exportaciones PDF y CSV.</li>
                  <li>Ampliación de catálogo de productos, monedas y prompts de IA.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 space-y-1.5">
                <h4 className="font-extrabold text-rose-950 flex items-center gap-1.5 text-xs">
                  <span>⚠️ CUÁNDO SE REQUIERE UN NUEVO APK FIRMADO</span>
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-rose-900">
                  <li>Modificaciones de código nativo Kotlin / Java en Capacitor.</li>
                  <li>Instalación de nuevos plugins nativos de hardware (ej. drivers Bluetooth específicos).</li>
                  <li>Cambios en permisos del <code>AndroidManifest.xml</code>.</li>
                  <li>Actualización del nivel de API o target SDK de Android.</li>
                </ul>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600">
                <strong>Garantía Offline:</strong> Si el comercio no tiene conexión a Internet, la petición falla silenciosamente sin bloquear la caja ni emitir alertas intrusivas.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            CajaMaster POS • OTA Engine v1.2
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
