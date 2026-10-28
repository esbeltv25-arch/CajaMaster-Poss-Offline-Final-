import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  IconUsers,
  IconServer,
  IconSmartphone,
  IconQrCode,
  IconRefreshCw,
  IconWifi,
  IconWifiOff,
  IconCheck,
  IconCopy,
  IconRadio,
  IconBolt,
  IconScan,
  IconCamera,
} from "./Icons";
import { syncService } from "../services/multiDeviceSync";
import type { SyncConfig, ConnectedDevice, DeviceRole, SyncConnectionMode } from "../types";
import { useStore } from "../store";
import { QrScannerModal } from "./QrScannerModal";

export function SyncSettingsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const store = useStore();
  const [config, setConfig] = useState<SyncConfig>(() => syncService.getConfig());
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
  const [status, setStatus] = useState(syncService.getStatus());
  const [stats, setStats] = useState(syncService.getStats());
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"config" | "qr" | "devices" | "diagnostics">("config");
  const [networkInfo, setNetworkInfo] = useState<{
    localIps?: Array<{ name: string; ip: string; internal: boolean }>;
    port?: number;
    primaryIp?: string;
    isCloudContainer?: boolean;
  }>({});
  const [customHost, setCustomHost] = useState<string>("");
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  // Keep state in sync with service
  useEffect(() => {
    if (!isOpen) return;

    setConfig(syncService.getConfig());
    setStatus(syncService.getStatus());
    setStats(syncService.getStats());
    setConnectedDevices(syncService.getDevices());

    const unsubStatus = syncService.onStatusChange((s) => {
      setStatus(s);
      setStats(syncService.getStats());
    });
    const unsubDevices = syncService.onDevicesChange((devs) => setConnectedDevices(devs));

    // Fetch server network info (local IP addresses)
    syncService.fetchNetworkInfo().then((info) => {
      if (info) {
        setNetworkInfo(info);
        if (!config.serverHost && info.primaryIp && info.primaryIp !== "127.0.0.1") {
          setCustomHost(`${info.primaryIp}:${info.port || 3000}`);
        }
      }
    });

    const interval = setInterval(() => {
      setStats(syncService.getStats());
    }, 2000);

    return () => {
      unsubStatus();
      unsubDevices();
      clearInterval(interval);
    };
  }, [isOpen]);

  const getEffectivePairingLink = () => {
    if (config.connectionMode === "cloud") {
      return syncService.getPairingLink("secondary");
    }
    const hostToUse = customHost || config.serverHost || (networkInfo.primaryIp && networkInfo.primaryIp !== "127.0.0.1" ? `${networkInfo.primaryIp}:${networkInfo.port || 3000}` : undefined);
    return syncService.getPairingLink("secondary", hostToUse);
  };

  // Generate QR code when room key or pairing link changes
  useEffect(() => {
    if (!isOpen) return;
    const link = getEffectivePairingLink();
    QRCode.toDataURL(link, {
      width: 280,
      margin: 2,
      color: {
        dark: "#0F172A",
        light: "#FFFFFF",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Error generating QR code:", err));
  }, [isOpen, config.roomKey, config.connectionMode, config.serverHost, customHost, networkInfo]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleUpdateConfig = (updates: Partial<SyncConfig>) => {
    syncService.saveConfig(updates);
    setConfig(syncService.getConfig());
  };

  const handleCopyPairingLink = () => {
    const link = getEffectivePairingLink();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        setCopied(true);
        showToast("Enlace de vinculación copiado al portapapeles");
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleCopyPin = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(config.roomKey).then(() => {
        setPinCopied(true);
        showToast(`PIN ${config.roomKey} copiado al portapapeles`);
        setTimeout(() => setPinCopied(false), 2000);
      });
    }
  };

  const handleGenerateNewRoomKey = () => {
    const newKey = "CM-" + Math.floor(1000 + Math.random() * 9000);
    handleUpdateConfig({ roomKey: newKey });
    showToast(`Nueva sala generada: ${newKey}`);
  };

  const handleForceFullSync = () => {
    setIsSyncingNow(true);
    syncService.broadcastFullStateSnapshot(store);
    setTimeout(() => {
      setIsSyncingNow(false);
      showToast("Catálogo, mesas y ventas transmitidos a todos los dispositivos");
    }, 600);
  };

  const handleQrScanSuccess = (details: { roomKey: string; serverHost?: string; role: DeviceRole }) => {
    setConfig(syncService.getConfig());
    setStatus(syncService.getStatus());
    setStats(syncService.getStats());
    setConnectedDevices(syncService.getDevices());
    showToast(`¡Vinculado con éxito a la sala ${details.roomKey}!`);
  };

  const isServer = config.role === "primary";
  const isLocalMode = config.connectionMode === "local";
  const isConnected = status === "connected";

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-pop"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-black/10 flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold shadow-md ${
                  config.enabled && isConnected
                    ? "bg-emerald-400 text-slate-950"
                    : config.enabled
                    ? "bg-amber-400 text-slate-950"
                    : "bg-slate-700 text-white"
                }`}
              >
                <IconUsers size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-extrabold text-base leading-tight">
                    Sincronización Multidispositivo
                  </h2>
                  <span
                    className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${
                      config.enabled && isConnected
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : config.enabled
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {config.enabled
                      ? isConnected
                        ? "En Línea"
                        : "Conectando..."
                      : "Inactivo"}
                  </span>
                </div>
                <p className="text-xs text-white/70">
                  Red Local Wi-Fi & Nube para Restaurantes, Comanderos y Cajas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsQrScannerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-sm active:scale-95"
                title="Activar cámara para escanear código QR de la Caja Central"
              >
                <IconScan size={14} />
                <span className="hidden sm:inline">Escanear QR</span>
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs cursor-pointer transition"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-1 overflow-x-auto shrink-0">
            <button
              onClick={() => setActiveTab("config")}
              className={`px-3 py-2 text-xs font-bold rounded-t-xl transition border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === "config"
                  ? "border-emerald-600 text-emerald-800 bg-white shadow-sm"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              ⚙️ Configuración & Rol
            </button>
            <button
              onClick={() => setActiveTab("qr")}
              className={`px-3 py-2 text-xs font-bold rounded-t-xl transition border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === "qr"
                  ? "border-emerald-600 text-emerald-800 bg-white shadow-sm"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <IconQrCode size={14} /> Vincular / Código QR
            </button>
            <button
              type="button"
              onClick={() => setIsQrScannerOpen(true)}
              className="px-3 py-2 text-xs font-bold rounded-t-xl transition border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 border-transparent text-emerald-700 bg-emerald-50 hover:bg-emerald-100/70"
            >
              <IconScan size={14} className="text-emerald-600" /> Escanear QR (Cámara)
            </button>
            <button
              onClick={() => setActiveTab("devices")}
              className={`px-3 py-2 text-xs font-bold rounded-t-xl transition border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === "devices"
                  ? "border-emerald-600 text-emerald-800 bg-white shadow-sm"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <IconSmartphone size={14} /> Equipos Conectados ({connectedDevices.length})
            </button>
            <button
              onClick={() => setActiveTab("diagnostics")}
              className={`px-3 py-2 text-xs font-bold rounded-t-xl transition border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === "diagnostics"
                  ? "border-emerald-600 text-emerald-800 bg-white shadow-sm"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <IconRadio size={14} /> Diagnóstico
            </button>
          </div>

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto space-y-5 text-slate-800 flex-1">
          {toastMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-fadeIn">
              <IconCheck size={16} className="text-emerald-600 shrink-0" />
              <span>{toastMsg}</span>
            </div>
          )}

          {/* TAB: CONFIG & ROLE */}
          {activeTab === "config" && (
            <div className="space-y-4">
              {/* Enable / Disable Master Toggle */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Sincronización en Tiempo Real
                  </h4>
                  <p className="text-xs text-slate-500">
                    Permite que comandas, mesas, stock y ventas se compartan al instante.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => handleUpdateConfig({ enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Role Selection */}
              <div>
                <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider block mb-2">
                  ROL DE ESTE DISPOSITIVO
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleUpdateConfig({ role: "primary" as DeviceRole })}
                    className={`p-3.5 rounded-2xl border-2 text-left transition cursor-pointer flex flex-col gap-1 ${
                      isServer
                        ? "border-emerald-600 bg-emerald-50 shadow-sm ring-2 ring-emerald-600/20"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                        <IconServer size={16} className="text-emerald-700" />
                        Terminal Principal (Host / Caja Central)
                      </span>
                      {isServer && (
                        <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight mt-1">
                      Es el servidor central. Guarda la base de datos maestra y emite datos a los comandadores.
                    </p>
                  </button>

                  <button
                    onClick={() => handleUpdateConfig({ role: "secondary" as DeviceRole })}
                    className={`p-3.5 rounded-2xl border-2 text-left transition cursor-pointer flex flex-col gap-1 ${
                      !isServer
                        ? "border-emerald-600 bg-emerald-50 shadow-sm ring-2 ring-emerald-600/20"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                        <IconSmartphone size={16} className="text-blue-700" />
                        Terminal Secundario (Camarero / Comandero)
                      </span>
                      {!isServer && (
                        <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight mt-1">
                      Toma pedidos desde mesas o mostrador secundario y los envía de inmediato a la caja central.
                    </p>
                  </button>
                </div>
              </div>

              {/* Mode Selection: Local Wi-Fi vs Cloud */}
              <div>
                <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider block mb-2">
                  MODO DE TRANSMISIÓN DE RED
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleUpdateConfig({ connectionMode: "cloud" as SyncConnectionMode })}
                    className={`p-3.5 rounded-2xl border-2 text-left transition cursor-pointer flex flex-col gap-1 ${
                      !isLocalMode
                        ? "border-emerald-600 bg-emerald-50 shadow-sm ring-2 ring-emerald-600/20"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                        <IconWifi size={16} className="text-emerald-600" />
                        Modo Nube / P2P Universal (Internet)
                      </span>
                      {!isLocalMode && (
                        <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight mt-1">
                      Enlaza este Mac (simulador de AI Studio) con tu teléfono móvil físico sin configurar IPs. Conexión directa y rápida.
                    </p>
                  </button>

                  <button
                    onClick={() => handleUpdateConfig({ connectionMode: "local" as SyncConnectionMode })}
                    className={`p-3.5 rounded-2xl border-2 text-left transition cursor-pointer flex flex-col gap-1 ${
                      isLocalMode
                        ? "border-emerald-600 bg-emerald-50 shadow-sm ring-2 ring-emerald-600/20"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                        <IconWifiOff size={16} className="text-amber-600" />
                        Red Local Wi-Fi (Offline / Sin Internet)
                      </span>
                      {isLocalMode && (
                        <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight mt-1">
                      Para routers físicos locales dentro del restaurante sin conexión a Internet. Conecta al WebSocket local.
                    </p>
                  </button>
                </div>
              </div>

              {/* Cloud Container Warning for Local Mode */}
              {isLocalMode && (networkInfo.isCloudContainer || networkInfo.primaryIp?.startsWith("172.17.") || networkInfo.primaryIp?.startsWith("172.18.")) && (
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-300 text-xs space-y-2 text-amber-900">
                  <div className="font-extrabold flex items-center gap-1.5 text-amber-950">
                    ⚠️ Entorno de Simulador / Nube Detectado (Google AI Studio)
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Las direcciones IP de contenedor (como <code>{networkInfo.primaryIp || "172.17.0.2"}</code>) no son accesibles desde un teléfono móvil externo. Para enlazar este Mac con tu móvil físico, activa el <strong>Modo Nube / P2P Universal</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleUpdateConfig({ connectionMode: "cloud" })}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition flex items-center gap-1.5"
                  >
                    <IconWifi size={14} /> Cambiar a Modo Nube / P2P Universal (Recomendado)
                  </button>
                </div>
              )}

              {/* Room Key & Device Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Nombre del Dispositivo / Terminal:
                  </label>
                  <input
                    type="text"
                    value={config.deviceName}
                    onChange={(e) => handleUpdateConfig({ deviceName: e.target.value })}
                    placeholder="Ej. Caja Central, Comandero 1"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-600 block">
                      Clave de Sala / Negocio (PIN):
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsQrScannerOpen(true)}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200"
                        title="Escanear QR con la cámara"
                      >
                        <IconScan size={11} /> Escanear QR
                      </button>
                      <button
                        onClick={handleGenerateNewRoomKey}
                        className="text-[10px] font-bold text-slate-600 hover:underline cursor-pointer"
                      >
                        Generar Nueva
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={config.roomKey}
                    onChange={(e) => handleUpdateConfig({ roomKey: e.target.value })}
                    placeholder="CM-1234"
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                  />
                </div>
              </div>

              {/* Local IP helper */}
              {isLocalMode && networkInfo.localIps && networkInfo.localIps.length > 0 && (
                <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                  <div className="font-bold text-slate-700 flex items-center gap-1.5">
                    <IconRadio size={14} className="text-emerald-600" />
                    Direcciones IP detectadas en esta red local:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {networkInfo.localIps.map((item) => (
                      <span
                        key={item.ip}
                        className="px-2.5 py-1 bg-white font-mono font-bold text-slate-800 rounded-lg border border-slate-300 text-[11px]"
                      >
                        {item.ip}:{networkInfo.port || 3000} ({item.name})
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Los demás teléfonos deben estar conectados al mismo Wi-Fi y apuntar a esta dirección IP.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB: QR & QUICK PAIRING */}
          {activeTab === "qr" && (
            <div className="space-y-5 text-center">
              {/* In-App Direct QR Scanner Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 text-white shadow-md text-left flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-black text-sm">
                    <IconScan size={18} className="text-amber-300" />
                    <span>¿Estás en un teléfono de camarero o terminal cliente?</span>
                  </div>
                  <p className="text-xs text-emerald-100 font-medium">
                    Activa la cámara dentro de esta app para leer el código QR de la Caja Central o ingresa el PIN abajo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQrScannerOpen(true)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm active:scale-98 shrink-0"
                >
                  <IconCamera size={16} /> Abrir Lector QR Integrado
                </button>
              </div>

              {/* Prominent PIN Display Box */}
              <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl border border-slate-700 max-w-sm mx-auto text-center space-y-1">
                <span className="text-[10px] uppercase font-black tracking-widest text-emerald-400">
                  CLAVE DE SALA / PIN DE VINCULACIÓN
                </span>
                <div className="text-3xl font-mono font-black tracking-widest text-white py-1">
                  {config.roomKey}
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    onClick={handleCopyPin}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
                  >
                    <IconCopy size={13} /> {pinCopied ? "¡PIN Copiado!" : "Copiar PIN"}
                  </button>
                  <button
                    onClick={handleGenerateNewRoomKey}
                    className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Generar Nuevo
                  </button>
                </div>
              </div>

              <div className="max-w-md mx-auto space-y-3">
                <div className="text-xs text-slate-600 leading-relaxed font-medium">
                  {config.connectionMode === "cloud" ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                      <IconWifi size={13} /> Sincronización Universal por Internet (Mac ↔ Móvil activo)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-amber-700 font-bold bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                      <IconWifiOff size={13} /> Red Local Wi-Fi (Requiere mismo router físico)
                    </span>
                  )}
                </div>

                {/* IP Selector only for Local Network Sync */}
                {isLocalMode && networkInfo.localIps && networkInfo.localIps.length > 0 && (
                  <div className="bg-slate-100 p-2.5 rounded-2xl text-left text-xs border border-slate-200 space-y-1">
                    <label className="text-[10.5px] font-bold text-slate-600 block">
                      Dirección IP Wi-Fi de este equipo (Servidor):
                    </label>
                    <select
                      value={customHost || (networkInfo.primaryIp ? `${networkInfo.primaryIp}:${networkInfo.port || 3000}` : "")}
                      onChange={(e) => setCustomHost(e.target.value)}
                      className="w-full bg-white px-2.5 py-1.5 rounded-xl border border-slate-300 font-mono text-xs font-bold text-slate-800"
                    >
                      {networkInfo.localIps.map((item) => (
                        <option key={item.ip} value={`${item.ip}:${networkInfo.port || 3000}`}>
                          {item.ip}:{networkInfo.port || 3000} ({item.name})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {qrDataUrl ? (
                  <div className="p-4 bg-white border-2 border-slate-200 rounded-3xl inline-block shadow-lg">
                    <img
                      src={qrDataUrl}
                      alt="Código QR de Vinculación"
                      className="w-56 h-56 mx-auto rounded-xl"
                    />
                    <div className="mt-2 text-[11px] font-mono font-black text-slate-700 bg-slate-100 py-1 px-2 rounded-lg break-all">
                      Sala: {config.roomKey} • {config.connectionMode === "cloud" ? "P2P Nube" : "Wi-Fi Local"}
                    </div>
                  </div>
                ) : (
                  <div className="w-56 h-56 mx-auto bg-slate-100 rounded-2xl flex items-center justify-center text-xs text-slate-400 font-bold">
                    Generando Código QR...
                  </div>
                )}

                {/* Direct URL Display & Link Copier */}
                <div className="space-y-1.5">
                  <div className="p-2 bg-slate-100 rounded-xl font-mono text-[10.5px] text-slate-600 break-all border border-slate-200">
                    {getEffectivePairingLink()}
                  </div>
                  <button
                    onClick={handleCopyPairingLink}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm active:scale-98"
                  >
                    <IconCopy size={16} />
                    {copied ? "¡Enlace Copiado!" : "Copiar Enlace de Vinculación Directo"}
                  </button>
                </div>

                {/* Step by Step instructions */}
                <div className="text-left bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2 mt-4">
                  <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                    <IconSmartphone size={15} className="text-emerald-600" />
                    Pasos para conectar tu teléfono móvil con este Mac:
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-relaxed font-medium">
                    <li>Abre la aplicación en tu teléfono móvil (en el navegador o app APK).</li>
                    <li>Abre el menú lateral y selecciona <strong>Sincronización Multidispositivo</strong>.</li>
                    <li>
                      Pulsa <strong>Escanear QR</strong> y apunta a este código con la cámara, o introduce el PIN <strong>{config.roomKey}</strong>.
                    </li>
                    <li>
                      ¡Listo! El teléfono descargará todo el catálogo, precios y mesas al instante.
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CONNECTED DEVICES */}
          {activeTab === "devices" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Terminales Conectadas en Tiempo Real
                  </h4>
                  <p className="text-xs text-slate-500">
                    Equipos activos sincronizados con esta sala ({config.roomKey})
                  </p>
                </div>
                <button
                  onClick={() => {
                    syncService.start();
                    showToast("Actualizando lista de terminales...");
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <IconRefreshCw size={13} /> Refrescar
                </button>
              </div>

              {connectedDevices.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto mb-3">
                    <IconSmartphone size={22} />
                  </div>
                  <p className="font-extrabold text-xs text-slate-700">
                    No hay otros dispositivos vinculados aún
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                    Ve a la pestaña "Vincular / Código QR" para emparejar un teléfono de camarero o comandero.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {connectedDevices.map((dev) => (
                    <div
                      key={dev.deviceId}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                            dev.role === "primary"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {dev.role === "primary" ? <IconServer size={18} /> : <IconSmartphone size={18} />}
                        </div>
                        <div>
                          <div className="font-extrabold text-xs text-slate-900 flex items-center gap-2">
                            <span>{dev.deviceName}</span>
                            {dev.isSelf && (
                              <span className="text-[10px] bg-slate-900 text-white px-1.5 py-0.2 rounded font-black">
                                ESTE EQUIPO
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>
                              Rol:{" "}
                              <strong className="capitalize text-slate-700">
                                {dev.role === "primary" ? "Servidor / Host" : "Camarero / Cliente"}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>Modo: {dev.mode}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs font-bold text-emerald-700">Activo</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: DIAGNOSTICS */}
          {activeTab === "diagnostics" && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600">Estado de Sincronización:</span>
                  <span
                    className={`font-extrabold px-2.5 py-0.5 rounded-full ${
                      isConnected
                        ? "bg-emerald-100 text-emerald-800"
                        : status === "connecting"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {isConnected ? "🟢 En Línea / Sincronizado" : status === "connecting" ? "🟡 Conectando..." : "⚪ Desconectado"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-500">Modo Activo:</span>
                  <span className="font-bold text-slate-800">
                    {config.connectionMode === "cloud" ? "🌐 Modo Nube / P2P Universal" : "📶 Red Local Wi-Fi (Offline)"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-500">Pares WebRTC P2P Directos:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {stats.p2pPeersCount || 0} terminal(es) conectados
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-500">Broker Nube MQTT (WSS):</span>
                  <span className={`font-bold ${stats.mqttConnected ? "text-emerald-700" : "text-slate-500"}`}>
                    {stats.mqttConnected ? "🟢 Conectado (HiveMQ WSS:8884)" : "⚪ Inactivo / Reconectando"}
                  </span>
                </div>

                {config.connectionMode === "local" && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-500">WebSocket Local:</span>
                    <span className={`font-bold ${stats.wsConnected ? "text-emerald-700" : "text-slate-500"}`}>
                      {stats.wsConnected ? "🟢 Conectado a server.ts" : "⚪ Desconectado"}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-500">Paquetes Emitidos:</span>
                  <span className="font-mono font-bold text-slate-800">{stats.packetsSent}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-500">Paquetes Recibidos:</span>
                  <span className="font-mono font-bold text-slate-800">{stats.packetsReceived}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-500">Última Transmisión:</span>
                  <span className="font-bold text-slate-800">
                    {stats.lastSyncTimestamp
                      ? new Date(stats.lastSyncTimestamp).toLocaleTimeString()
                      : "Ninguna aún"}
                  </span>
                </div>
              </div>

              {/* Diagnostic Test Ping */}
              <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Probar Conectividad en Tiempo Real</div>
                  <div className="text-[11px] text-slate-500">Emite un ping de diagnóstico a todos los canales</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    syncService.start();
                    showToast("Ping de prueba emitido a la red");
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer transition active:scale-95"
                >
                  Emitir Ping
                </button>
              </div>

              {/* Force Full Sync Action */}
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-3">
                <div className="flex items-start gap-2.5">
                  <IconBolt size={20} className="text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-extrabold text-xs text-emerald-950">
                      Sincronización Total Forzada (Broadcast Snapshot)
                    </h5>
                    <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                      Transmite de forma inmediata todo el inventario de productos, categorías, cuentas abiertas y configuraciones a todos los camareros conectados.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleForceFullSync}
                  disabled={isSyncingNow}
                  className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
                >
                  <IconRefreshCw size={14} className={isSyncingNow ? "animate-spin" : ""} />
                  {isSyncingNow ? "Transmitiendo datos..." : "Forzar Sincronización Completa Ahora"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="font-mono font-bold text-slate-700">Sala: {config.roomKey}</span>
            <span>•</span>
            <span>{config.role === "primary" ? "Modo Servidor" : "Modo Cliente"}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Listo, guardar y cerrar
          </button>
        </div>
      </div>
    </div>

    {/* Integrated In-App QR Camera Scanner */}
    <QrScannerModal
      isOpen={isQrScannerOpen}
      onClose={() => setIsQrScannerOpen(false)}
      onSuccess={handleQrScanSuccess}
    />
  </>
  );
}
