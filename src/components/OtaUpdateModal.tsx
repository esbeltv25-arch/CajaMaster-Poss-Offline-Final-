import { useState, useEffect, useRef, type ChangeEvent } from "react";
import QRCode from "qrcode";
import {
  getOtaConfig,
  saveOtaConfig,
  checkOtaUpdate,
  downloadAndExtractOtaBundle,
  simulateOtaUpdate,
  rollbackOtaBundle,
  applyOtaUpdateAndReload,
  installOtaBundleFromZipFile,
  createManualUpdateZipPackage,
  downloadLatestZipDirectly,
  triggerZipDownload,
  getManualZipHistory,
  resetOtaConfigToFactory,
  type RemoteVersionInfo,
  type ManualZipHistoryItem,
  APP_BASE_VERSION,
  APP_BASE_VERSION_CODE,
} from "../services/otaUpdateService";
import {
  IconCheck,
  IconDownload,
  IconRotate,
  IconAlert,
  IconBolt,
  IconSliders,
  IconBox,
} from "./Icons";

export type OtaModalTab = "update" | "zip" | "builder" | "settings" | "docs";

interface OtaUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: OtaModalTab;
}

export function OtaUpdateModal({ isOpen, onClose, initialTab = "update" }: OtaUpdateModalProps) {
  if (!isOpen) return null;

  const [config, setConfig] = useState(() => getOtaConfig());
  const [activeTab, setActiveTab] = useState<OtaModalTab>(initialTab);

  // Online GitHub State
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [remoteUpdate, setRemoteUpdate] = useState<RemoteVersionInfo | null>(config.pendingUpdate);
  const [editServerUrl, setEditServerUrl] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(config.serverUrl);

  // Manual ZIP File State
  const [selectedZipFile, setSelectedZipFile] = useState<File | null>(null);
  const [isZipInstalling, setIsZipInstalling] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [zipStatusText, setZipStatusText] = useState("");
  const [zipMessage, setZipMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [zipHistory, setZipHistory] = useState<ManualZipHistoryItem[]>(() => getManualZipHistory());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ZIP Package Builder State (for admin/merchant)
  const [builderVersion, setBuilderVersion] = useState("1.3.5");
  const [builderCode, setBuilderCode] = useState(1050);
  const [builderChangelog, setBuilderChangelog] = useState(
    "• Cámara universal Android/hardware con selector nativo y captura instantánea.\n• Eliminación total de errores de cámara antigua y soporte offline 100%.\n• Activación directa de bundles OTA en WebView sin reinicios manuales."
  );
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [builderMessage, setBuilderMessage] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Generate QR code for mobile phone direct download
  const GITHUB_ZIP_URL =
    "https://raw.githubusercontent.com/esbeltv25-arch/CajaMaster-Updates/main/updates/bundle-v1.3.5.zip";

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    QRCode.toDataURL(GITHUB_ZIP_URL, {
      width: 256,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((e) => console.warn("Could not generate QR code:", e));
  }, []);

  // Online Check Handler
  const handleCheck = async () => {
    try {
      setIsChecking(true);
      setCheckMessage(null);
      const res = await checkOtaUpdate({ timeoutMs: 5000 });
      setConfig(getOtaConfig());

      if (res.hasUpdate && res.remoteInfo) {
        setRemoteUpdate(res.remoteInfo);
        setCheckMessage(`¡Nueva versión ${res.remoteInfo.version} disponible en GitHub!`);
      } else if (res.offline) {
        setCheckMessage(
          "Modo Offline: No se pudo conectar a GitHub. Puedes usar la pestaña «Instalar ZIP» para actualizar 100% sin internet."
        );
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
        setCheckMessage(`${res.message} Pulsa «Recargar Interfaz» para aplicar los cambios ahora.`);
        setStatusText("¡Instalación completada con éxito!");
      } else {
        setStatusText(res.message);
        setCheckMessage("Error: " + res.message);
      }
    } catch (err: any) {
      setStatusText("Error durante la actualización: " + (err.message || err));
      setCheckMessage("Error durante la actualización: " + (err.message || err));
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

  // Manual ZIP File Installation Handler
  const handleZipFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".zip")) {
        setZipMessage({
          text: "El archivo seleccionado debe tener extensión .zip",
          isError: true,
        });
        return;
      }
      setSelectedZipFile(file);
      setZipMessage(null);
    }
  };

  const handleInstallZip = async () => {
    if (!selectedZipFile) return;

    try {
      setIsZipInstalling(true);
      setZipProgress(10);
      setZipStatusText("Leyendo archivo ZIP...");
      setZipMessage(null);

      const res = await installOtaBundleFromZipFile(selectedZipFile, (pct, msg) => {
        setZipProgress(pct);
        setZipStatusText(msg);
      });

      if (res.success) {
        setConfig(getOtaConfig());
        setZipHistory(getManualZipHistory());
        setZipMessage({
          text: res.message,
          isError: false,
        });
        setSelectedZipFile(null);
      } else {
        setZipMessage({
          text: res.message,
          isError: true,
        });
      }
    } catch (err: any) {
      setZipMessage({
        text: "Error al instalar el archivo ZIP: " + (err.message || err),
        isError: true,
      });
    } finally {
      setIsZipInstalling(false);
    }
  };

  // ZIP Package Builder Handler
  const handleGenerateZip = async () => {
    try {
      setIsGeneratingZip(true);
      setBuilderMessage("Generando paquete ZIP de actualización...");

      const blob = await createManualUpdateZipPackage(
        builderVersion.trim(),
        Number(builderCode),
        builderChangelog
      );

      const fileName = `cajamaster-update-v${builderVersion.trim()}.zip`;
      triggerZipDownload(blob, fileName);

      setBuilderMessage(
        `¡Paquete «${fileName}» generado y descargado! Puedes enviarlo por WhatsApp o Telegram a tus clientes.`
      );
    } catch (err: any) {
      setBuilderMessage("Error al generar paquete ZIP: " + (err.message || err));
    } finally {
      setIsGeneratingZip(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 animate-pop"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-black/10 text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg text-lg">
              🚀
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base sm:text-lg leading-tight">
                  Sistema de Actualizaciones
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950">
                  OTA & ZIP
                </span>
              </div>
              <p className="text-xs text-white/70">
                Actualiza vía GitHub Online o mediante archivos ZIP enviados por WhatsApp/Telegram
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs cursor-pointer transition active:scale-90"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs (Scrollable on small mobile) */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-2 sm:px-4 pt-1.5 shrink-0 gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("update")}
            className={`px-3 py-2 text-xs font-black border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === "update"
                ? "border-amber-500 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            📡 GitHub Online
          </button>

          <button
            onClick={() => setActiveTab("zip")}
            className={`px-3 py-2 text-xs font-black border-b-2 transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "zip"
                ? "border-amber-500 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>📦 Instalar Archivo ZIP</span>
            <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full">
              Offline
            </span>
          </button>

          <button
            onClick={() => setActiveTab("builder")}
            className={`px-3 py-2 text-xs font-black border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === "builder"
                ? "border-amber-500 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            📥 Descargar / Crear ZIP
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`px-3 py-2 text-xs font-black border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === "settings"
                ? "border-amber-500 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            ⚙️ Servidor
          </button>

          <button
            onClick={() => setActiveTab("docs")}
            className={`px-3 py-2 text-xs font-black border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === "docs"
                ? "border-amber-500 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            📖 Manual
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* TAB 1: GITHUB ONLINE */}
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
                    <div className="flex items-center gap-1.5 min-w-0">
                      <IconCheck size={15} className="text-emerald-600 shrink-0" />
                      <span className="truncate">Ejecutando desde bundle OTA: {config.activeBundlePath}</span>
                    </div>
                    <button
                      onClick={handleRollback}
                      className="text-[10px] text-rose-700 font-extrabold hover:underline cursor-pointer shrink-0 ml-2"
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
                  <span>{isChecking ? "Comprobando..." : "Comprobar GitHub Ahora"}</span>
                </button>

                <button
                  onClick={() => setActiveTab("zip")}
                  className="py-3 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md active:scale-95"
                >
                  <IconBox size={16} />
                  <span>📦 Instalar ZIP Manual</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={handleSimulate}
                  disabled={isDownloading}
                  className="py-2.5 px-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Simula la recepción y descompresión de una versión superior para verificar el flujo"
                >
                  <span>🧪 Simular OTA</span>
                </button>

                <button
                  onClick={applyOtaUpdateAndReload}
                  className="py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
                >
                  <span>🔄 Recargar Interfaz</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  resetOtaConfigToFactory();
                  setConfig(getOtaConfig());
                  handleCheck();
                }}
                className="w-full py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 border border-slate-200"
                title="Restablece la versión detectada para forzar la descarga de la última versión desde GitHub"
              >
                <span>🔄 Forzar Búsqueda / Reinstalar desde GitHub</span>
              </button>
            </div>
          )}

          {/* TAB 2: MANUAL ZIP INSTALLATION (OFFLINE) */}
          {activeTab === "zip" && (
            <div className="space-y-4">
              {/* Direct Download Helper Banner for v1.3.5 */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 text-white space-y-2.5 shadow-md border border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⚡</span>
                    <div>
                      <h4 className="font-black text-xs text-amber-400">
                        ¿Necesitas el archivo ZIP v1.3.5 (1.1 MB)?
                      </h4>
                      <p className="text-[11px] text-slate-300">
                        Descárgalo en tu Mac / PC o en tu móvil para actualizar 100% offline.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                    30 Archivos Web
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => downloadLatestZipDirectly("1.3.5")}
                    className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer transition shadow-xs active:scale-95"
                  >
                    <IconDownload size={14} />
                    <span>Descargar «cajamaster-update-v1.3.5.zip»</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition border border-slate-600 active:scale-95"
                  >
                    <span>📱 Ver Código QR para Móvil</span>
                  </button>
                </div>
              </div>

              {/* Highlight Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📦</span>
                  <div>
                    <h3 className="font-black text-sm text-amber-950">
                      Instalador de Paquete ZIP (100% Offline)
                    </h3>
                    <p className="text-xs text-amber-900/80">
                      Selecciona el archivo .zip descargado para extraer la actualización en este dispositivo.
                    </p>
                  </div>
                </div>
              </div>

              {/* File Selection Box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-3xl p-6 text-center cursor-pointer bg-slate-50/70 hover:bg-amber-50/30 transition flex flex-col items-center justify-center gap-2 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleZipFileSelected}
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 group-hover:bg-amber-400 group-hover:text-slate-950 flex items-center justify-center font-bold text-2xl transition">
                  📥
                </div>

                {selectedZipFile ? (
                  <div className="space-y-1">
                    <span className="font-extrabold text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-block">
                      ✓ Archivo Seleccionado
                    </span>
                    <div className="font-black text-sm text-slate-900 break-all">
                      {selectedZipFile.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      Tamaño: {(selectedZipFile.size / 1024).toFixed(1)} KB • Toca para cambiar archivo
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="font-extrabold text-xs text-slate-800">
                      Toca aquí para seleccionar el archivo .ZIP de actualización
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Busca el archivo cajamaster-update-v1.3.4.zip descargado o recibido por WhatsApp
                    </div>
                  </div>
                )}
              </div>

              {/* Progress bar during installation */}
              {isZipInstalling && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 animate-pop">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>{zipStatusText}</span>
                    <span>{zipProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${zipProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Status Message */}
              {zipMessage && (
                <div
                  className={`p-3.5 rounded-2xl text-xs font-bold flex items-start gap-2.5 animate-pop ${
                    zipMessage.isError
                      ? "bg-rose-50 border border-rose-200 text-rose-900"
                      : "bg-emerald-50 border border-emerald-200 text-emerald-900"
                  }`}
                >
                  <span className="text-base shrink-0">{zipMessage.isError ? "⚠️" : "✅"}</span>
                  <div className="space-y-1">
                    <p className="leading-relaxed">{zipMessage.text}</p>
                    {!zipMessage.isError && (
                      <div className="p-2.5 rounded-xl bg-white border border-emerald-300 text-[11px] text-emerald-950 font-normal space-y-2">
                        <strong className="text-emerald-900 block font-black">
                          📱 PASO PARA ACTIVAR LA ACTUALIZACIÓN:
                        </strong>
                        <p>
                          Puedes tocar el botón de abajo para recargar la app con la versión v1.3.5, o cerrar la app en la multitarea de tu móvil y volver a abrirla.
                        </p>
                        <button
                          type="button"
                          onClick={applyOtaUpdateAndReload}
                          className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
                        >
                          <IconRotate size={14} />
                          <span>🔄 Aplicar y Recargar la App Ahora</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons for ZIP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleInstallZip}
                  disabled={!selectedZipFile || isZipInstalling}
                  className="py-3 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <IconBolt size={16} />
                  <span>{isZipInstalling ? "Instalando..." : "Instalar Paquete ZIP"}</span>
                </button>

                <button
                  type="button"
                  onClick={applyOtaUpdateAndReload}
                  className="py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm active:scale-95"
                >
                  <IconRotate size={15} />
                  <span>🔄 Recargar Interfaz Ahora</span>
                </button>
              </div>

              {/* Instructions for clients */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
                <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <span>📋 Pasos para el Teléfono Móvil:</span>
                </h4>
                <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed text-[11.5px]">
                  <li>Descarga el archivo <code>cajamaster-update-v1.3.5.zip</code> (desde el botón arriba o enviándolo por WhatsApp).</li>
                  <li>Toca el recuadro arriba («Seleccionar archivo .ZIP»).</li>
                  <li>Selecciona el archivo descargado.</li>
                  <li>Toca <strong>«Instalar Paquete ZIP»</strong>.</li>
                  <li>Toca <strong>«Aplicar y Recargar la App Ahora»</strong> (o reinicia la app en multitarea).</li>
                </ol>
              </div>

              {/* History of manual updates */}
              {zipHistory.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <h4 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">
                    Historial de Actualizaciones ZIP en este dispositivo ({zipHistory.length})
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {zipHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 truncate">
                            v{item.version} (Build {item.versionCode})
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {item.fileName} • {new Date(item.installedAt).toLocaleDateString("es-ES")}
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md shrink-0">
                          Instalado
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DOWNLOAD & BUILD ZIP PACKAGE */}
          {activeTab === "builder" && (
            <div className="space-y-4">
              {/* Featured: Official Package v1.3.5 */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white space-y-3 shadow-lg border border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-lg shadow-sm">
                      📦
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm text-amber-400">
                          Paquete Oficial v1.3.5 (Build 1050)
                        </h3>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                          Completo (1.1 MB)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Incluye todos los 30 archivos compilados (HTML, CSS, JS, imágenes) y el fix de cámara y layout.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => downloadLatestZipDirectly("1.3.5")}
                    className="py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md active:scale-95"
                  >
                    <IconDownload size={16} />
                    <span>Descargar «cajamaster-update-v1.3.5.zip»</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
                  >
                    <span>📱 Escanear QR con Móvil</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800 flex-wrap gap-2">
                  <div className="truncate max-w-[280px] font-mono text-[10px] text-slate-400">
                    {GITHUB_ZIP_URL}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(GITHUB_ZIP_URL);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2500);
                    }}
                    className="text-amber-400 hover:underline font-bold cursor-pointer flex items-center gap-1"
                  >
                    <span>{copiedLink ? "✓ ¡Enlace Copiado!" : "📋 Copiar Enlace Directo"}</span>
                  </button>
                </div>
              </div>

              {/* Instructions on how to apply on mobile */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
                <div className="flex items-center gap-1.5 font-black text-amber-900">
                  <span>📱 Pasos para Actualizar tu Teléfono Móvil con este Archivo:</span>
                </div>
                <ol className="list-decimal pl-4 space-y-1.5 text-[11.5px] leading-relaxed">
                  <li>
                    <strong>Descarga el archivo ZIP</strong>: Pulsa el botón amarillo arriba (o escanea el código QR con la cámara de tu móvil para que se descargue directo en la carpeta <em>Descargas</em> de tu teléfono).
                  </li>
                  <li>
                    <strong>Abre CajaMaster en tu móvil</strong>: Ve a <strong>Ajustes</strong> ➔ <strong>Actualizaciones de la App</strong> ➔ pestaña <strong>«Instalar Archivo ZIP»</strong>.
                  </li>
                  <li>
                    <strong>Selecciona el archivo</strong>: Toca el recuadro gris y selecciona <code>cajamaster-update-v1.3.4.zip</code> (o <code>bundle-v1.3.4.zip</code>).
                  </li>
                  <li>
                    <strong>Pulsa «Instalar Paquete ZIP»</strong>: Verás la barra avanzar hasta el 100% mientras se descomprimen los 30 archivos.
                  </li>
                  <li>
                    <strong className="text-amber-900 underline">PASO CLAVE FINAL EN ANDROID</strong>: Cierra la app CajaMaster desde las aplicaciones recientes de tu móvil (deslízala hacia arriba para forzar el cierre completo) y vuelve a abrirla. Al arrancar de nuevo, Android cargará automáticamente el nuevo bundle v1.3.4 con la cámara funcionando al 100%.
                  </li>
                </ol>
              </div>

              {/* Custom Builder Section */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🛠️ Generador Personalizado de Paquetes</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Si deseas crear un paquete con un número de versión o notas de cambio específicas para tus clientes:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Versión (ej. 1.3.4):
                    </label>
                    <input
                      type="text"
                      value={builderVersion}
                      onChange={(e) => setBuilderVersion(e.target.value)}
                      placeholder="1.3.4"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Código de Build (ej. 1044):
                    </label>
                    <input
                      type="number"
                      value={builderCode}
                      onChange={(e) => setBuilderCode(Number(e.target.value))}
                      placeholder="1044"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                    Novedades / Changelog (lo que verá el cliente):
                  </label>
                  <textarea
                    rows={3}
                    value={builderChangelog}
                    onChange={(e) => setBuilderChangelog(e.target.value)}
                    placeholder="Describe los cambios y mejoras..."
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 outline-none"
                  />
                </div>

                {builderMessage && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs font-bold">
                    {builderMessage}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleGenerateZip}
                  disabled={isGeneratingZip}
                  className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                >
                  <IconDownload size={16} />
                  <span>
                    {isGeneratingZip
                      ? "Empaquetando con todos los archivos web..."
                      : `Generar y Descargar «cajamaster-update-v${builderVersion}.zip»`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {activeTab === "settings" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                    Endpoint del Servidor Propio (GitHub)
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
                      placeholder="https://raw.githubusercontent.com/esbeltv25-arch/CajaMaster-Updates/main/version.json"
                      className="w-full px-3 py-2 rounded-xl neu-inset text-xs font-bold text-slate-900 outline-none"
                    />
                    <div className="flex justify-end gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setServerUrlInput("https://raw.githubusercontent.com/esbeltv25-arch/CajaMaster-Updates/main/version.json");
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
  "version": "1.3.1",
  "versionCode": 1031,
  "updateUrl": "bundle-v1.3.1.zip",
  "mandatory": false,
  "changelog": "Ajuste de márgenes móviles y correcciones de cobro."
}`}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 5: DOCS & RULES */}
          {activeTab === "docs" && (
            <div className="space-y-3 text-xs leading-relaxed text-slate-700">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                <h4 className="font-extrabold text-emerald-950 flex items-center gap-1.5 text-xs">
                  <span>✅ CUÁNDO APLICA LA ACTUALIZACIÓN OTA / ZIP (Sin Recompilar APK)</span>
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-emerald-900">
                  <li>Cambios visuales, márgenes móviles, temas claro/oscuro y estilos CSS.</li>
                  <li>Lógica de cobros, calculadora de billetes de 10k/20k CUP y pasarelas de pago.</li>
                  <li>Nuevos formatos de reportes contables IPVE, exportaciones PDF y CSV.</li>
                  <li>Gestión de envíos, mensajería WhatsApp y nuevas características.</li>
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
                <strong>Garantía Offline:</strong> Tanto las comprobaciones en línea como la carga manual de archivos ZIP funcionan de forma segura sin interrumpir el funcionamiento continuo del negocio ni emitir alertas bloqueantes.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            CajaMaster POS • OTA & ZIP Engine v1.3.4 (Build 1044)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* QR Code Modal for Mobile Direct Download */}
      {showQrModal && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-slate-200 animate-pop">
            <div className="space-y-1">
              <span className="text-3xl">📱</span>
              <h3 className="font-black text-base text-slate-900">
                Descarga Directa al Móvil
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Apunta la cámara de tu móvil a este código QR para descargar <strong>cajamaster-update-v1.3.4.zip</strong> directamente a tu teléfono.
              </p>
            </div>

            {qrCodeDataUrl ? (
              <div className="p-3 bg-white border-2 border-slate-900 rounded-2xl inline-block shadow-md">
                <img
                  src={qrCodeDataUrl}
                  alt="QR Descarga ZIP"
                  className="w-48 h-48 mx-auto"
                />
              </div>
            ) : (
              <div className="w-48 h-48 mx-auto flex items-center justify-center bg-slate-100 rounded-2xl text-xs text-slate-500">
                Generando QR...
              </div>
            )}

            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-950 text-left space-y-1">
              <strong>Pasos en tu teléfono:</strong>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Escanea el código QR y descarga el ZIP.</li>
                <li>Abre CajaMaster en tu móvil ➔ Ajustes ➔ «Instalar Archivo ZIP».</li>
                <li>Selecciona el ZIP descargado e instala.</li>
                <li>Cierra la app en la multitarea y vuelve a abrirla.</li>
              </ol>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(GITHUB_ZIP_URL);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs transition cursor-pointer"
              >
                {copiedLink ? "✓ ¡Enlace Copiado al Portapapeles!" : "📋 Copiar Enlace Directo"}
              </button>

              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-xs transition cursor-pointer"
              >
                Cerrar Ventana QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
