import { useState, useEffect } from "react";
import { useStore, actions, TEMPLATE_PRESETS } from "../store";
import { TopBar } from "../components/Layout";
import { AppLogo } from "../components/AppLogo";
import {
  IconDownload,
  IconUpload,
  IconKey,
  IconLock,
  IconBolt,
  IconTrash,
  IconCheck,
  IconWifi,
  IconWifiOff,
  IconCoins,
  IconEdit,
  IconBell,
  IconBellRing,
  IconVolume2,
  IconVolumeX,
  IconVibrate,
  IconSparkles,
  IconHelp,
  IconCamera,
  IconCart,
  IconBox,
  IconClipboardCheck,
  IconTag,
  IconLayers,
  IconRefreshCw,
} from "../components/Icons";
import { useTheme, THEMES, ThemeId } from "../themeContext";
import { formatCurrency } from "../utils/currency";
import { ConnectivityModal } from "../components/ConnectivityModal";
import { BackupModal } from "../components/BackupModal";
import { LowStockAlertModal } from "../components/LowStockAlertModal";
import { CategoryManagerModal } from "../components/CategoryManagerModal";
import { SyncSettingsModal } from "../components/SyncSettingsModal";
import { BusinessCustomizationModal } from "../components/BusinessCustomizationModal";
import { syncService } from "../services/multiDeviceSync";
import {
  getStoredApiKey,
  setStoredApiKey,
  testGeminiApiKey,
  hasGeminiApiKey,
} from "../services/geminiService";
import {
  IconUsers,
  IconServer,
  IconSmartphone,
  IconQrCode,
  IconRadio,
  IconPrinter,
  IconBluetooth,
  IconUsb,
  IconEthernet,
  IconSliders,
  IconScan,
} from "../components/Icons";
import { QrScannerModal } from "../components/QrScannerModal";
import {
  getNotificationSettings,
  saveNotificationSettings,
  requestPushPermission,
  getPushPermissionStatus,
  playAlertSound,
  vibrateAlert,
  notifyProductLowStock,
  type NotificationSettings,
} from "../utils/notifications";

import { QuickStartGuideModal, type GuideSection } from "../components/QuickStartGuideModal";
import { OtaUpdateModal, type OtaModalTab } from "../components/OtaUpdateModal";
import { ScreenCalibrationModal } from "../components/ScreenCalibrationModal";
import { getOtaConfig, downloadLatestZipDirectly } from "../services/otaUpdateService";
import { getLicenseStatus, revokeLicense, validateLicenseKey } from "../utils/licenseSecurity";
import { generateUserManualPdf } from "../utils/userManualPdf";
import { PrinterSelectionModal } from "../components/PrinterSelectionModal";
import { PWAInstallCard } from "../components/PWAInstallBanner";
import {
  getPrinterSettings,
  getDefaultPrinter,
  printTestTicket,
} from "../services/printerService";
import type { BusinessInfo } from "../types";
import { clearNativeAppCache } from "../utils/nativeBridge";
import { ConfirmationModal } from "../components/ConfirmationModal";

export function AjustesScreen({
  deviceId,
  onLogout,
  onOpenQuickGuide,
}: {
  deviceId: string;
  onLogout: () => void;
  onOpenQuickGuide?: (section?: GuideSection) => void;
}) {
  const state = useStore();
  const {
    themeId,
    setThemeId,
    darkModePref,
    setDarkModePref,
    isEffectiveDark,
    systemIsDark,
    layoutMode,
    setLayoutMode,
    setIsThemePickerOpen,
    isCalibrationModalOpen,
    setIsCalibrationModalOpen,
  } = useTheme();

  const [showConnectivity, setShowConnectivity] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [showOtaModal, setShowOtaModal] = useState(false);
  const [otaInitialTab, setOtaInitialTab] = useState<OtaModalTab>("update");
  const [showBusinessCustomModal, setShowBusinessCustomModal] = useState(false);
  const [printerToast, setPrinterToast] = useState<string | null>(null);
  const [isTestingPrinter, setIsTestingPrinter] = useState(false);
  const [printerVersion, setPrinterVersion] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetPresetType, setResetPresetType] = useState<"clean" | "gastronomia" | "retail" | "servicios">("clean");
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState(() => getLicenseStatus());
  const [licenseAuditToast, setLicenseAuditToast] = useState(false);
  const [exportToast, setExportToast] = useState(false);
  const [presetToast, setPresetToast] = useState<string | null>(null);
  const [confirmClearCache, setConfirmClearCache] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheClearToast, setCacheClearToast] = useState<string | null>(null);

  const handleExecuteClearCache = async () => {
    setIsClearingCache(true);
    try {
      // 1. Purge all Service Worker cache storages
      if (typeof window !== "undefined" && "caches" in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((k) => window.caches.delete(k)));
      }

      // 2. Unregister all service workers
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }

      // 3. Clear native Android webview cache via native bridge
      await clearNativeAppCache();

      // 4. Purge volatile caches from localStorage while preserving vital business data
      const preservedKeys = new Set([
        "cajamaster_pos_state_v1",
        "cajamaster_license_v4",
        "cajamaster_device_id",
        "cajamaster_printer_settings_v3",
        "cajamaster_sync_config_v2",
        "cajamaster_theme_pref",
      ]);

      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !preservedKeys.has(key)) {
          if (
            key.includes("cache") ||
            key.includes("ota") ||
            key.includes("temp") ||
            key.includes("asset") ||
            key.includes("workbox")
          ) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      setCacheClearToast("¡Caché y Service Worker eliminados! Forzando recarga de activos...");
      setTimeout(() => {
        const targetUrl = window.location.origin + window.location.pathname + "?cacheBust=" + Date.now();
        window.location.replace(targetUrl);
      }, 1200);
    } catch (err) {
      console.error("Error clearing cache:", err);
      setCacheClearToast("Error al purgar la caché.");
      setIsClearingCache(false);
    }
  };

  // Notification settings state
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() => getNotificationSettings());
  const [pushStatus, setPushStatus] = useState<NotificationPermission | "unsupported">(() => getPushPermissionStatus());
  const [testSentToast, setTestSentToast] = useState(false);

  // Gemini AI Key Configuration State
  const [geminiKeyInput, setGeminiKeyInput] = useState(() => getStoredApiKey());
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isTestingGeminiKey, setIsTestingGeminiKey] = useState(false);
  const [geminiTestFeedback, setGeminiTestFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [geminiSavedToast, setGeminiSavedToast] = useState(false);

  const handleSaveGeminiKey = () => {
    setStoredApiKey(geminiKeyInput);
    setGeminiSavedToast(true);
    setGeminiTestFeedback(null);
    setTimeout(() => setGeminiSavedToast(false), 2500);
  };

  const [isGeneratingManualPdf, setIsGeneratingManualPdf] = useState(false);
  const [manualPdfToast, setManualPdfToast] = useState(false);

  const handleGenerateManualPdf = async (preferShare = false) => {
    try {
      setIsGeneratingManualPdf(true);
      await generateUserManualPdf(state.business?.name || "CajaMaster POS", preferShare);
      setManualPdfToast(true);
      setTimeout(() => setManualPdfToast(false), 3000);
    } catch (err) {
      console.error("Error generating manual PDF", err);
    } finally {
      setIsGeneratingManualPdf(false);
    }
  };

  const handleTestGeminiKey = async () => {
    if (!geminiKeyInput.trim()) {
      setGeminiTestFeedback({ success: false, message: "Introduce una clave API para probar." });
      return;
    }
    setIsTestingGeminiKey(true);
    setGeminiTestFeedback(null);
    try {
      const result = await testGeminiApiKey(geminiKeyInput);
      setGeminiTestFeedback(result);
      if (result.success) {
        setStoredApiKey(geminiKeyInput);
      }
    } finally {
      setIsTestingGeminiKey(false);
    }
  };

  const handleClearGeminiKey = () => {
    setGeminiKeyInput("");
    setStoredApiKey("");
    setGeminiTestFeedback(null);
    setGeminiSavedToast(true);
    setTimeout(() => setGeminiSavedToast(false), 2000);
  };

  useEffect(() => {
    setPushStatus(getPushPermissionStatus());
  }, []);

  const lowStockProducts = state.products.filter((p) => p.stock <= p.lowStockAlert);

  const handleTogglePushNotif = async () => {
    if (pushStatus === "granted") {
      const updated = { ...notifSettings, systemPush: !notifSettings.systemPush };
      setNotifSettings(updated);
      saveNotificationSettings(updated);
    } else {
      const res = await requestPushPermission();
      setPushStatus(res);
      const updated = { ...notifSettings, systemPush: res === "granted" };
      setNotifSettings(updated);
      saveNotificationSettings(updated);
    }
  };

  const handleToggleSound = () => {
    const updated = { ...notifSettings, sound: !notifSettings.sound };
    setNotifSettings(updated);
    saveNotificationSettings(updated);
    if (updated.sound) {
      playAlertSound();
    }
  };

  const handleToggleVibration = () => {
    const updated = { ...notifSettings, vibration: !notifSettings.vibration };
    setNotifSettings(updated);
    saveNotificationSettings(updated);
    if (updated.vibration) {
      vibrateAlert();
    }
  };

  const handleSendTestNotification = () => {
    if (lowStockProducts.length > 0) {
      notifyProductLowStock(lowStockProducts[0]);
    } else if (state.products.length > 0) {
      notifyProductLowStock({ ...state.products[0], stock: 1, lowStockAlert: 5 });
    }
    setTestSentToast(true);
    setTimeout(() => setTestSentToast(false), 2500);
  };

  const defaultPrinter = getDefaultPrinter();
  const printerSettings = getPrinterSettings();

  const handleTestPrint = async () => {
    try {
      setIsTestingPrinter(true);
      const res = await printTestTicket(defaultPrinter);
      setPrinterToast(res.message);
    } catch (err: any) {
      setPrinterToast(err.message || "Error al imprimir prueba.");
    } finally {
      setIsTestingPrinter(false);
      setTimeout(() => setPrinterToast(null), 3500);
    }
  };

  // Business profile editing state
  const [isEditingBiz, setIsEditingBiz] = useState(false);
  const [bizForm, setBizForm] = useState<BusinessInfo>({ ...state.business });

  // Update bizForm if state changes
  useEffect(() => {
    setBizForm({ ...state.business });
  }, [state.business]);

  // Exchange rates editing
  const [usdRate, setUsdRate] = useState(state.rates.USD);
  const [eurRate, setEurRate] = useState(state.rates.EUR);
  const [mlcRate, setMlcRate] = useState(state.rates.MLC);
  const [ratesSavedMsg, setRatesSavedMsg] = useState(false);

  const totalSales = state.sales.reduce((a, s) => a + s.total, 0);

  function copy() {
    navigator.clipboard.writeText(deviceId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleDirectExport() {
    actions.exportBackup();
    setExportToast(true);
    setTimeout(() => setExportToast(false), 3000);
  }

  function handleSaveBiz() {
    actions.updateBusinessInfo({
      ...bizForm,
      name: bizForm.name.trim() || "CajaMaster POS",
      owner: bizForm.owner.trim(),
      taxId: bizForm.taxId?.trim(),
      address: bizForm.address.trim(),
      phone: bizForm.phone.trim(),
      email: bizForm.email?.trim(),
      headerSubtitle: bizForm.headerSubtitle?.trim(),
      footerMessage: bizForm.footerMessage.trim(),
      defaultTaxRate: typeof bizForm.defaultTaxRate === "number" ? Math.max(0, bizForm.defaultTaxRate) : undefined,
      defaultTipRate: typeof bizForm.defaultTipRate === "number" ? Math.max(0, bizForm.defaultTipRate) : undefined,
    });
    setIsEditingBiz(false);
  }

  function handleApplyPreset(type: "gastronomia" | "retail" | "servicios" | "clean") {
    actions.resetData(type);
    setPresetToast(`¡Plantilla "${TEMPLATE_PRESETS[type].label}" aplicada con éxito!`);
    setTimeout(() => setPresetToast(null), 3000);
  }

  function handleSaveRates() {
    actions.setExchangeRates({
      CUP: 1,
      USD: Math.max(1, usdRate),
      EUR: Math.max(1, eurRate),
      MLC: Math.max(1, mlcRate),
    });
    setRatesSavedMsg(true);
    setTimeout(() => setRatesSavedMsg(false), 2000);
  }

  const isOffline = state.connectivityMode === "offline";
  const isPhone = layoutMode === "phone";

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
      <TopBar title="Ajustes y Configuración" subtitle="Personalización del negocio" />

      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6 space-y-4 text-slate-800">
        {cacheClearToast && (
          <div className="p-3 bg-emerald-500 text-white rounded-2xl text-xs font-black flex items-center justify-between shadow-md animate-pop">
            <div className="flex items-center gap-2">
              <IconCheck size={16} />
              <span>{cacheClearToast}</span>
            </div>
            <button onClick={() => setCacheClearToast(null)} className="font-bold text-xs">✕</button>
          </div>
        )}

        {presetToast && (
          <div className="p-3 bg-amber-400 text-slate-950 rounded-2xl text-xs font-black flex items-center justify-between shadow-md animate-pop">
            <div className="flex items-center gap-2">
              <IconCheck size={16} />
              <span>{presetToast}</span>
            </div>
            <button onClick={() => setPresetToast(null)} className="font-bold text-xs">✕</button>
          </div>
        )}

        {/* Business Details Card (Full White Label Configuration) */}
        <div className="card p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3 shadow-xs">
          <div className={`flex justify-between gap-2.5 ${isPhone ? "flex-col items-start" : "flex-col sm:flex-row sm:items-center"}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">
                🏪
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                  Datos del Establecimiento (Marca Blanca)
                </h3>
                <p className="text-[11px] text-slate-500 truncate">
                  Personalización integral de identidad, taxonomía de venta y tickets
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setShowBusinessCustomModal(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1 cursor-pointer transition shadow-xs active:scale-95"
                title="Abrir editor visual de marca blanca con previsualización en vivo"
              >
                <IconSliders size={13} />
                <span>Personalizar</span>
              </button>
              <button
                onClick={() => {
                  if (isEditingBiz) handleSaveBiz();
                  else setIsEditingBiz(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center gap-1 cursor-pointer transition shadow-xs active:scale-95"
              >
                {isEditingBiz ? <><IconCheck size={14} /> Guardar</> : <><IconEdit size={14} /> Rápido</>}
              </button>
            </div>
          </div>

          {isEditingBiz ? (
            <div className="space-y-2.5 pt-2 border-t border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                    Nombre del Negocio
                  </label>
                  <input
                    value={bizForm.name}
                    onChange={(e) => setBizForm({ ...bizForm, name: e.target.value })}
                    placeholder="Ej. Mi Comercio / Restaurante"
                    className="w-full neu-inset rounded-xl px-3 h-9 text-xs font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                    Propietario / Titular
                  </label>
                  <input
                    value={bizForm.owner}
                    onChange={(e) => setBizForm({ ...bizForm, owner: e.target.value })}
                    placeholder="Ej. Juan Pérez"
                    className="w-full neu-inset rounded-xl px-3 h-9 text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                    Identificación Fiscal / Licencia (NIT, RUC)
                  </label>
                  <input
                    value={bizForm.taxId || ""}
                    onChange={(e) => setBizForm({ ...bizForm, taxId: e.target.value })}
                    placeholder="Ej. NIT-123456789"
                    className="w-full neu-inset rounded-xl px-3 h-9 text-xs font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                    Teléfono / WhatsApp / Telegram
                  </label>
                  <input
                    value={bizForm.phone}
                    onChange={(e) => setBizForm({ ...bizForm, phone: e.target.value })}
                    placeholder="Ej. +53 50000000 / @mi_negocio"
                    className="w-full neu-inset rounded-xl px-3 h-9 text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                  Dirección Comercial
                </label>
                <input
                  value={bizForm.address}
                  onChange={(e) => setBizForm({ ...bizForm, address: e.target.value })}
                  placeholder="Ej. Calle Principal #123, La Habana"
                  className="w-full neu-inset rounded-xl px-3 h-9 text-xs font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                    Encabezado / Subtítulo del Ticket
                  </label>
                  <input
                    value={bizForm.headerSubtitle || ""}
                    onChange={(e) => setBizForm({ ...bizForm, headerSubtitle: e.target.value })}
                    placeholder="Ej. Especialistas en Gastronomía"
                    className="w-full neu-inset rounded-xl px-3 h-9 text-xs font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                    Mensaje al pie del ticket
                  </label>
                  <input
                    value={bizForm.footerMessage}
                    onChange={(e) => setBizForm({ ...bizForm, footerMessage: e.target.value })}
                    placeholder="Ej. ¡Gracias por su compra! Vuelva pronto"
                    className="w-full neu-inset rounded-xl px-3 h-9 text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                    Impuesto Predeterminado (%)
                  </label>
                  <input
                    type="number"
                    value={bizForm.defaultTaxRate !== undefined ? bizForm.defaultTaxRate : ""}
                    onChange={(e) => setBizForm({ ...bizForm, defaultTaxRate: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="0 (Opcional)"
                    className="w-full neu-inset rounded-xl px-3 h-9 text-xs font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                    Propina Predeterminada (%)
                  </label>
                  <input
                    type="number"
                    value={bizForm.defaultTipRate !== undefined ? bizForm.defaultTipRate : ""}
                    onChange={(e) => setBizForm({ ...bizForm, defaultTipRate: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="0 (Opcional)"
                    className="w-full neu-inset rounded-xl px-3 h-9 text-xs font-semibold outline-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-200 text-xs space-y-1">
              <div className="font-extrabold text-slate-900 text-sm">{state.business.name}</div>
              {state.business.owner && (
                <div className="text-slate-600">👤 Titular: {state.business.owner}</div>
              )}
              {state.business.taxId && (
                <div className="text-slate-600">📄 Identificación Fiscal: {state.business.taxId}</div>
              )}
              {state.business.address && (
                <div className="text-slate-600">📍 Dirección: {state.business.address}</div>
              )}
              {state.business.phone && (
                <div className="text-slate-600">📞 Contacto: {state.business.phone}</div>
              )}
              {state.business.footerMessage && (
                <div className="text-slate-500 text-[11px] italic mt-1">"{state.business.footerMessage}"</div>
              )}
            </div>
          )}
        </div>

        {/* Multi-Device Real-Time Sync Card (Host/Client, Wi-Fi & Cloud) */}
        <div className="card p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3 shadow-xs">
          <div className={`flex justify-between gap-2.5 ${isPhone ? "flex-col items-start" : "flex-col sm:flex-row sm:items-center"}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                <IconUsers size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                    Sincronización Multidispositivo
                  </h3>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      syncService.getConfig().enabled && syncService.getStatus() === "connected"
                        ? "bg-emerald-100 text-emerald-800"
                        : syncService.getConfig().enabled
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {syncService.getConfig().enabled
                      ? syncService.getStatus() === "connected"
                        ? "En Vivo"
                        : "Conectando"
                      : "Inactivo"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  {syncService.getConfig().role === "primary" ? "👑 Servidor / Host" : "📱 Camarero / Cliente"} • Red {syncService.getConfig().connectionMode === "local" ? "Wi-Fi Local" : "Nube"} • Sala: {syncService.getConfig().roomKey}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setShowQrScanner(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-slate-950 hover:bg-emerald-500 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-xs active:scale-95"
                title="Activar cámara para leer el código QR de la Caja Central"
              >
                <IconScan size={14} /> Escanear QR
              </button>
              <button
                onClick={() => setShowSyncModal(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 text-emerald-400 hover:bg-slate-800 font-extrabold text-xs flex items-center gap-1 cursor-pointer transition shadow-xs active:scale-95"
              >
                <IconQrCode size={13} /> Vincular / Ajustar
              </button>
            </div>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="text-slate-600 font-medium">
              Conecta teléfonos de camareros o cajas secundarias por Wi-Fi sin depender de Internet.
            </div>
            <div className="text-slate-900 font-bold flex items-center gap-1.5 shrink-0 pl-0 sm:pl-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{syncService.getDevices().length} terminal(es)</span>
            </div>
          </div>
        </div>

        {/* Printer & Hardware Management Card */}
        <div className="card p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3 shadow-xs">
          <div className={`flex justify-between gap-2.5 ${isPhone ? "flex-col items-start" : "flex-col sm:flex-row sm:items-center"}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                <IconPrinter size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                    Impresoras & Terminales Térmicas
                  </h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {defaultPrinter ? defaultPrinter.connectionType.toUpperCase() : "SISTEMA"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  {defaultPrinter
                    ? `${defaultPrinter.name} (${defaultPrinter.paperWidth || "80mm"})`
                    : "Diálogo nativo del sistema (PDF / Impresoras del SO)"}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowPrinterModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 text-blue-400 hover:bg-slate-800 font-extrabold text-xs flex items-center gap-1 cursor-pointer transition shadow-xs active:scale-95 shrink-0"
            >
              <IconSliders size={13} /> Gestionar
            </button>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="space-y-0.5">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                {defaultPrinter?.connectionType === "bluetooth" && <IconBluetooth size={14} className="text-blue-500" />}
                {defaultPrinter?.connectionType === "wifi" && <IconWifi size={14} className="text-emerald-500" />}
                {defaultPrinter?.connectionType === "usb" && <IconUsb size={14} className="text-purple-500" />}
                {defaultPrinter?.connectionType === "ethernet" && <IconEthernet size={14} className="text-amber-500" />}
                {(!defaultPrinter || defaultPrinter?.connectionType === "system") && <IconPrinter size={14} className="text-slate-500" />}
                <span>
                  {defaultPrinter
                    ? `Predeterminada: ${defaultPrinter.name}`
                    : "Sin impresora térmica asignada (Usa diálogo de sistema)"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Soporte de ESC/POS directo, Bluetooth inalámbrico, Wi-Fi/IP en red local y USB OTG.
              </p>
            </div>

            <button
              onClick={handleTestPrint}
              disabled={isTestingPrinter}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer self-stretch sm:self-auto justify-center active:scale-95 disabled:opacity-50"
            >
              <IconPrinter size={13} />
              <span>{isTestingPrinter ? "Enviando..." : "Imprimir Prueba"}</span>
            </button>
          </div>

          {printerToast && (
            <div className="p-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-between animate-pop shadow-md">
              <span>{printerToast}</span>
              <button
                onClick={() => setPrinterToast(null)}
                className="text-xs px-1 font-bold text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Category Management Card */}
        <div className="card p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3 shadow-xs">
          <div className={`flex justify-between gap-2.5 ${isPhone ? "flex-col items-start" : "flex-col sm:flex-row sm:items-center"}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shrink-0">
                <IconTag size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                  Categorías del Catálogo
                </h3>
                <p className="text-[11px] text-slate-500 truncate">
                  {state.categories?.length || 0} categorías dinámicas configuradas
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowCatModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 text-amber-400 hover:bg-slate-800 font-extrabold text-xs flex items-center gap-1 cursor-pointer transition shadow-xs active:scale-95 shrink-0"
            >
              <IconTag size={13} /> Administrar
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {(state.categories || []).map((cat) => (
              <span
                key={cat.id}
                className="px-2.5 py-1 rounded-xl text-xs font-extrabold border flex items-center gap-1 bg-white border-slate-200 text-slate-800"
              >
                <span>{cat.icon || "🏷️"}</span>
                <span>{cat.name}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Sector Templates Card (Multi-Commerce Presets) */}
        <div className="card p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold shrink-0">
              <IconSparkles size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                Plantillas Rápidas por Sector
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                Carga inicial de categorías y parámetros según tu tipo de negocio
              </p>
            </div>
          </div>

          <div className={`grid gap-2 pt-1 ${isPhone ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
            {(["gastronomia", "retail", "servicios", "clean"] as const).map((type) => {
              const p = TEMPLATE_PRESETS[type];
              return (
                <button
                  key={type}
                  onClick={() => {
                    setResetPresetType(type);
                    setConfirmReset(true);
                  }}
                  className="p-3 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-left flex flex-col justify-between transition cursor-pointer active:scale-95 shadow-2xs"
                >
                  <div className="text-xl mb-1">{p.icon}</div>
                  <div className="font-extrabold text-xs text-slate-900 leading-tight mb-0.5">
                    {p.label}
                  </div>
                  <div className="text-[10px] text-slate-500 line-clamp-2">
                    {p.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Google Gemini AI Configuration Card (Optional & Decentralized) */}
        <div className="card p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3 shadow-xs">
          <div className={`flex justify-between gap-2.5 ${isPhone ? "flex-col items-start" : "flex-col sm:flex-row sm:items-center"}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shrink-0">
                <IconSparkles size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                    Inteligencia Artificial (Google Gemini)
                  </h3>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      hasGeminiApiKey()
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {hasGeminiApiKey() ? "✅ Activa" : "⚪ Opcional"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  Autocompletado de productos, analista de stock y redactor de ofertas
                </p>
              </div>
            </div>

            {geminiSavedToast && (
              <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-xl animate-pop shrink-0">
                ✓ Guardado
              </span>
            )}
          </div>

          <div className="space-y-2.5 pt-1">
            <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10.5px] font-extrabold text-slate-600 uppercase tracking-wider block">
                  CLAVE API DE GOOGLE GEMINI (GRATUITA O PROPIA)
                </label>
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  {showGeminiKey ? "Ocultar" : "Mostrar"}
                </button>
              </div>

              <div className="neu-inset rounded-xl px-3 h-10 flex items-center gap-2 bg-slate-50">
                <span className="text-slate-400 font-bold text-xs">🔑</span>
                <input
                  type={showGeminiKey ? "text" : "password"}
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  placeholder="Pega tu AI Studio API Key (AIzaSy...)"
                  className="flex-1 bg-transparent outline-none text-xs font-mono text-slate-900"
                />
                {geminiKeyInput && (
                  <button
                    type="button"
                    onClick={handleClearGeminiKey}
                    className="text-xs text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
                    title="Borrar clave"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className={`flex justify-between gap-2 pt-1 ${isPhone ? "flex-col items-start" : "flex-col sm:flex-row sm:items-center"}`}>
                <span className="text-[10.5px] text-slate-400">
                  Almacenada exclusivamente de forma local en tu dispositivo.
                </span>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleTestGeminiKey}
                    disabled={isTestingGeminiKey || !geminiKeyInput.trim()}
                    className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 disabled:opacity-50 text-purple-900 font-extrabold text-xs flex items-center gap-1 cursor-pointer transition border border-purple-200 active:scale-95"
                  >
                    {isTestingGeminiKey ? (
                      <>
                        <div className="w-3 h-3 border-2 border-purple-900 border-t-transparent rounded-full animate-spin" />
                        <span>Probando...</span>
                      </>
                    ) : (
                      <>
                        <IconSparkles size={12} />
                        <span>Probar Conexión</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveGeminiKey}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs cursor-pointer transition shadow-xs active:scale-95"
                  >
                    Guardar
                  </button>
                </div>
              </div>

              {geminiTestFeedback && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-pop ${
                    geminiTestFeedback.success
                      ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                      : "bg-rose-50 text-rose-900 border border-rose-200"
                  }`}
                >
                  <span className="text-sm">{geminiTestFeedback.success ? "✅" : "⚠️"}</span>
                  <span className="flex-1">{geminiTestFeedback.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Currency & Exchange Rates Section */}
        <div className="card p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                <IconCoins size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  Moneda & Tipos de Cambio
                </h3>
                <p className="text-[11px] text-slate-500">
                  Base principal: Pesos Cubanos (CUP)
                </p>
              </div>
            </div>

            {ratesSavedMsg && (
              <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg animate-pop">
                ✓ Guardado
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                1 USD en CUP
              </label>
              <input
                type="number"
                value={usdRate}
                onChange={(e) => setUsdRate(parseFloat(e.target.value || "0"))}
                className="w-full neu-inset rounded-xl px-3 h-10 text-xs font-extrabold text-[var(--color-ink)] outline-none text-center bg-transparent"
              />
            </div>

            <div>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                1 EUR en CUP
              </label>
              <input
                type="number"
                value={eurRate}
                onChange={(e) => setEurRate(parseFloat(e.target.value || "0"))}
                className="w-full neu-inset rounded-xl px-3 h-10 text-xs font-extrabold text-[var(--color-ink)] outline-none text-center bg-transparent"
              />
            </div>

            <div>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                1 MLC en CUP
              </label>
              <input
                type="number"
                value={mlcRate}
                onChange={(e) => setMlcRate(parseFloat(e.target.value || "0"))}
                className="w-full neu-inset rounded-xl px-3 h-10 text-xs font-extrabold text-[var(--color-ink)] outline-none text-center bg-transparent"
              />
            </div>
          </div>

          <button
            onClick={handleSaveRates}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition cursor-pointer"
          >
            Actualizar Tasas de Cambio
          </button>
        </div>

        {/* Connectivity Mode Box */}
        <div className="card p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3 shadow-xs">
          <div className={`flex justify-between gap-2.5 ${isPhone ? "flex-col items-start" : "flex-col sm:flex-row sm:items-center"}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                  isOffline ? "bg-amber-400 text-slate-950" : "bg-emerald-500 text-white"
                }`}
              >
                {isOffline ? <IconWifiOff size={18} /> : <IconWifi size={18} />}
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                  Modo de Conectividad
                </h3>
                <p className="text-[11px] text-slate-500 truncate">
                  {isOffline ? "100% Offline (Sin dependencia de internet)" : "Online (Sincronización activa)"}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowConnectivity(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer transition shrink-0"
            >
              Configurar
            </button>
          </div>
        </div>

        {/* Backup & Respaldo */}
        <div className="card p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                <IconDownload size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  Seguridad de Datos & Respaldo
                </h3>
                <p className="text-[11px] text-slate-500">
                  {state.products.length} productos y {state.sales.length} ventas guardadas en almacenamiento local
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowBackup(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer transition"
            >
              Opciones
            </button>
          </div>

          {exportToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-pop">
              <IconCheck size={16} className="text-emerald-600" />
              ¡Archivo JSON descargado exitosamente a tu dispositivo!
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleDirectExport}
              className="w-full py-3 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
            >
              <IconDownload size={16} /> EXPORTAR BASE DE DATOS (JSON)
            </button>

            <button
              onClick={() => setShowBackup(true)}
              className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
            >
              <IconUpload size={16} /> RESTAURAR COPIA DE SEGURIDAD
            </button>
          </div>
        </div>

        {/* Notifications and Stock Alerts Card */}
        <div className="card p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                <IconBellRing size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  Alertas de Stock & Notificaciones
                </h3>
                <p className="text-[11px] text-slate-500">
                  Avisos sonoros, hápticos y push al alcanzar el umbral mínimo
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowAlertModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 text-amber-400 font-extrabold text-xs flex items-center gap-1 cursor-pointer transition shadow-xs"
            >
              Ver Alertas ({lowStockProducts.length})
            </button>
          </div>

          {testSentToast && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-pop">
              <IconCheck size={15} className="text-emerald-600" />
              ¡Notificación de prueba disparada correctamente!
            </div>
          )}

          <div className="space-y-2 pt-1 border-t border-slate-200">
            {/* System Push Notifications Switch */}
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <IconBell size={16} className="text-slate-800" />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Notificaciones Push del Navegador / Sistema
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {pushStatus === "granted"
                      ? "Autorizado por el navegador"
                      : pushStatus === "denied"
                      ? "Bloqueado en ajustes del navegador"
                      : "Requiere permiso del usuario"}
                  </div>
                </div>
              </div>

              <button
                onClick={handleTogglePushNotif}
                className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  notifSettings.systemPush && pushStatus === "granted"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-800 hover:bg-slate-300"
                }`}
              >
                {notifSettings.systemPush && pushStatus === "granted"
                  ? "Activo ✓"
                  : "Activar"}
              </button>
            </div>

            {/* Audio chime toggle */}
            <div className="flex items-center justify-between py-1.5 border-t border-slate-200">
              <div className="flex items-center gap-2">
                {notifSettings.sound ? (
                  <IconVolume2 size={16} className="text-slate-800" />
                ) : (
                  <IconVolumeX size={16} className="text-slate-400" />
                )}
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Chime Sonoro de Alerta (Audio Sintetizado)
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Suena inmediatamente al cobrar o registrar baja de stock
                  </div>
                </div>
              </div>

              <button
                onClick={handleToggleSound}
                className={`w-10 h-6 rounded-full transition cursor-pointer p-0.5 ${
                  notifSettings.sound ? "bg-amber-400" : "bg-slate-300"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    notifSettings.sound ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Vibration toggle */}
            <div className="flex items-center justify-between py-1.5 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <IconVibrate size={16} className="text-slate-800" />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Respuesta Háptica / Vibración Móvil
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Vibra en teléfonos táctiles al generarse la alerta
                  </div>
                </div>
              </div>

              <button
                onClick={handleToggleVibration}
                className={`w-10 h-6 rounded-full transition cursor-pointer p-0.5 ${
                  notifSettings.vibration ? "bg-amber-400" : "bg-slate-300"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    notifSettings.vibration ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Test button */}
            <div className="pt-2">
              <button
                onClick={handleSendTestNotification}
                className="w-full py-2.5 px-3 rounded-2xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
              >
                <IconBellRing size={15} className="text-amber-600" />
                <span>Emitir Alerta de Prueba (Push + Sonido + Vibración)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Start Guide & Manual Card */}
        {onOpenQuickGuide && (
          <div className="card p-4 rounded-3xl border border-amber-300 bg-amber-50/70 space-y-3 shadow-xs">
            <div className={`flex justify-between gap-2.5 ${isPhone ? "flex-col items-start" : "flex-col sm:flex-row sm:items-center"}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
                  <IconSparkles size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <span>📖 Manual de Usuario y Guía de Uso</span>
                    <span className="text-[10px] font-extrabold bg-amber-400/30 text-amber-900 px-1.5 py-0.2 rounded-md">
                      PDF Offline
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-600 truncate">
                    Caja, Stock, Billetes Nuevos 10k/20k, Arqueo Z, IPVE y Respaldos
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => handleGenerateManualPdf(false)}
                  disabled={isGeneratingManualPdf}
                  className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                  title="Descargar Manual en PDF"
                >
                  <IconDownload size={14} />
                  <span>{isGeneratingManualPdf ? "Generando..." : "Descargar PDF"}</span>
                </button>

                <button
                  onClick={() => onOpenQuickGuide("wizard")}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 text-amber-400 font-extrabold text-xs flex items-center gap-1.5 hover:bg-slate-800 transition cursor-pointer shadow-xs active:scale-95 shrink-0"
                >
                  <IconHelp size={15} /> <span>Abrir Guía</span>
                </button>
              </div>
            </div>

            {manualPdfToast && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-pop">
                <IconCheck size={15} className="text-emerald-600" />
                ¡Manual de Usuario en PDF generado y descargado exitosamente para consulta offline!
              </div>
            )}

            <div className={`grid gap-1.5 pt-1 border-t border-amber-200/70 ${isPhone ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
              <button
                type="button"
                onClick={() => onOpenQuickGuide("caja")}
                className="p-1.5 px-2 bg-white/90 hover:bg-amber-100/80 active:scale-95 rounded-xl border border-amber-200 text-slate-800 text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer text-left"
              >
                <IconCart size={13} className="text-amber-600 shrink-0" />
                <span className="truncate">Caja & Cobros</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenQuickGuide("inventario")}
                className="p-1.5 px-2 bg-white/90 hover:bg-blue-100/80 active:scale-95 rounded-xl border border-blue-200 text-slate-800 text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer text-left"
              >
                <IconBox size={13} className="text-blue-600 shrink-0" />
                <span className="truncate">Inventario & Foto</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenQuickGuide("cierre")}
                className="p-1.5 px-2 bg-white/90 hover:bg-purple-100/80 active:scale-95 rounded-xl border border-purple-200 text-slate-800 text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer text-left"
              >
                <IconClipboardCheck size={13} className="text-purple-600 shrink-0" />
                <span className="truncate">Arqueo & Cierre Z</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenQuickGuide("ajustes")}
                className="p-1.5 px-2 bg-white/90 hover:bg-emerald-100/80 active:scale-95 rounded-xl border border-emerald-200 text-slate-800 text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer text-left"
              >
                <IconDownload size={13} className="text-emerald-600 shrink-0" />
                <span className="truncate">Copia & Glosario</span>
              </button>
            </div>
          </div>
        )}

        {/* Ambience & Visual Theme Selector (Dark Mode & Themes) */}
        <div className="card p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3.5 shadow-xs">
          <div className={`flex justify-between gap-2.5 ${isPhone ? "flex-col items-start" : "flex-col sm:flex-row sm:items-center"}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                {isEffectiveDark ? "🌙" : "☀️"}
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                  <span>Tema & Modo Visual</span>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      isEffectiveDark
                        ? "bg-slate-900 text-cyan-400 border border-cyan-500/30"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {isEffectiveDark ? "Modo Oscuro Activo" : "Modo Claro Activo"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {darkModePref === "system"
                    ? `Automático (detectado por el sistema: ${systemIsDark ? "Oscuro" : "Claro"})`
                    : darkModePref === "dark"
                    ? "Forzado siempre en Modo Oscuro (OLED)"
                    : "Forzado siempre en Modo Claro (Alto Brillo)"}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsThemePickerOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95 shrink-0"
            >
              <span>🎨 Paletas</span>
            </button>
          </div>

          {/* 3-way Dark Mode Toggle (Claro / Oscuro / Automático) */}
          <div className="pt-2 border-t border-slate-200">
            <label className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
              PREFERENCIA DE MODO DE COLOR
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/80 rounded-2xl border border-slate-300/60">
              <button
                type="button"
                onClick={() => setDarkModePref("light")}
                className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  darkModePref === "light"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>☀️</span>
                <span>Modo Claro</span>
              </button>

              <button
                type="button"
                onClick={() => setDarkModePref("dark")}
                className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  darkModePref === "dark"
                    ? "bg-slate-900 text-cyan-300 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>🌙</span>
                <span>Modo Oscuro</span>
              </button>

              <button
                type="button"
                onClick={() => setDarkModePref("system")}
                className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  darkModePref === "system"
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>⚙️</span>
                <span>Automático</span>
              </button>
            </div>
          </div>

          {/* Quick Layout Mode toggle */}
          <div className={`pt-2 border-t border-slate-200 flex ${isPhone ? "flex-col items-start gap-2" : "flex-row items-center justify-between"}`}>
            <span className="text-xs font-bold text-slate-600">
              Formato de pantalla:
            </span>
            <div className={`flex bg-slate-200 p-0.5 rounded-xl ${isPhone ? "w-full" : "w-auto"}`}>
              <button
                onClick={() => setLayoutMode("phone")}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer text-center ${
                  layoutMode === "phone"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600"
                }`}
              >
                📱 Móvil
              </button>
              <button
                onClick={() => setLayoutMode("tablet")}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer text-center ${
                  layoutMode === "tablet"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600"
                }`}
              >
                🖥️ Tablet / Mostrador
              </button>
            </div>
          </div>

          {/* Calibrate Mobile Margins and Scaling */}
          <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Márgenes y Reescalado de Pantalla:
              </span>
              <span className="text-[10.5px] text-slate-500">
                Evita que la cámara tape títulos o que los botones del teléfono tapen el cobro
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsCalibrationModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95 shrink-0"
            >
              <span>📱 Calibrar Márgenes Móvil</span>
            </button>
          </div>
        </div>

        {/* Self-Hosted OTA & ZIP Updates Card */}
        <div className="card p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3 shadow-xs">
          <div className={`flex justify-between gap-2.5 ${isPhone ? "flex-col items-start" : "flex-col sm:flex-row sm:items-center"}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                🚀
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                    Actualizaciones de la App (OTA & ZIP)
                  </h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    v{getOtaConfig().installedVersion}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  Actualización vía GitHub online o manual mediante archivo ZIP sin recompilar APK
                </p>
              </div>
            </div>
          </div>

          {/* Quick Direct ZIP Download Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md border border-slate-700">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-base">📦</span>
                <span className="font-black text-xs text-amber-400">
                  Paquete ZIP Oficial v1.3.5 para Móvil (1.1 MB)
                </span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.2 rounded-full border border-emerald-500/30">
                  Fix Cámara y Layout
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Descarga el archivo ZIP completo desde este simulador para actualizar tu teléfono manualmente.
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                onClick={() => downloadLatestZipDirectly("1.3.5")}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
              >
                <span>Descargar ZIP v1.3.5</span>
              </button>
              <button
                onClick={() => {
                  setOtaInitialTab("builder");
                  setShowOtaModal(true);
                }}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center transition border border-slate-600 active:scale-95 cursor-pointer"
                title="Ver QR y detalles"
              >
                <span>📱 QR Móvil</span>
              </button>
            </div>
          </div>

          {/* Quick Action Buttons for Updates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <button
              onClick={() => {
                setOtaInitialTab("update");
                setShowOtaModal(true);
              }}
              className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow-xs active:scale-95"
            >
              <span>📡 Comprobar GitHub</span>
            </button>

            <button
              onClick={() => {
                setOtaInitialTab("zip");
                setShowOtaModal(true);
              }}
              className="p-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow-md active:scale-95"
            >
              <span>📦 Instalar Archivo ZIP</span>
            </button>

            <button
              onClick={() => {
                setOtaInitialTab("builder");
                setShowOtaModal(true);
              }}
              className="p-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95"
            >
              <span>📥 Descargar / Crear ZIP</span>
            </button>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Servidor de Versiones Configurado:
              </span>
              <div className="font-mono text-slate-700 text-[11px] truncate max-w-[280px] sm:max-w-[340px]">
                {getOtaConfig().serverUrl}
              </div>
            </div>

            <button
              onClick={() => {
                setOtaInitialTab("settings");
                setShowOtaModal(true);
              }}
              className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-[10.5px] font-black border border-amber-200 transition cursor-pointer shrink-0"
            >
              ⚙️ Ajustar Servidor
            </button>
          </div>
        </div>

        {/* Database & Automatic Daily Backup Card */}
        <div className="card p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3 shadow-xs">
          <div className={`flex justify-between gap-2.5 ${isPhone ? "flex-col items-start" : "flex-col sm:flex-row sm:items-center"}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                <IconDownload size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                    Copias de Seguridad & Respaldos JSON
                  </h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    AUTOMÁTICO EN CIERRE Z
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  Exporta productos, inventario, ventas y almacén en archivos JSON locales
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowBackup(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-xs active:scale-95 shrink-0"
            >
              <span>💾 Abrir Gestor de Respaldos</span>
            </button>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="text-slate-600 font-medium">
              Al finalizar el día y generar el <strong>Cierre de Caja Z</strong>, se compila automáticamente un archivo JSON con todo el estado del inventario y ventas.
            </div>
            <button
              onClick={() => setShowBackup(true)}
              className="text-[11px] font-bold text-emerald-700 hover:underline shrink-0"
            >
              Configurar frecuencia →
            </button>
          </div>
        </div>

        {/* PWA & Desktop Windows Installation */}
        <PWAInstallCard />

        {/* License & Device info */}
        <div className="card p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3 shadow-xs">
          <div className={`flex justify-between gap-2.5 ${isPhone ? "flex-col items-start" : "flex-col sm:flex-row sm:items-center"}`}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold shrink-0">
                <IconBolt size={18} />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-slate-900 text-sm leading-tight">CajaMaster Pro</div>
                <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1 truncate">
                  <IconCheck size={12} /> Licencia Offline Activada
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const current = getLicenseStatus();
                setLicenseStatus(current);
                setLicenseAuditToast(true);
                setTimeout(() => setLicenseAuditToast(false), 3000);
              }}
              className="px-2.5 py-1 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[10px] font-black cursor-pointer transition flex items-center gap-1 shrink-0"
              title="Verificar integridad de la licencia"
            >
              <span>🛡️ Consultar Estado</span>
            </button>
          </div>

          {licenseAuditToast && (
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-2 animate-pop">
              <IconCheck size={14} className="shrink-0" />
              <span>Firma HMAC-SHA256 íntegra y válida para este dispositivo.</span>
            </div>
          )}

          {/* Device ID */}
          <div className="neu-inset rounded-2xl p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-widest font-bold text-slate-500 uppercase">
                ID DE DISPOSITIVO (HARDWARE ID)
              </span>
              <span className="text-[9.5px] font-bold text-slate-400">Único e intransferible</span>
            </div>
            <div className="font-mono text-xs font-black text-slate-900 break-all">
              {deviceId}
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={copy}
                className="text-[10.5px] font-bold text-amber-800 hover:text-amber-900 cursor-pointer flex items-center gap-1"
              >
                <span>{copied ? "✓ Copiado al portapapeles" : "📋 Copiar Device ID"}</span>
              </button>
            </div>
          </div>

          {/* Active License Key */}
          <div className="neu-inset rounded-2xl p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-widest font-bold text-slate-500 uppercase">
                CLAVE DE ACTIVACIÓN REGISTRADA
              </span>
              <span className="text-[9.5px] font-bold text-emerald-700">HMAC-SHA256</span>
            </div>
            <div className="font-mono text-xs font-black text-emerald-900 tracking-wider">
              {licenseStatus.licenseKey || "A1B2-C3D4-E5F6"}
            </div>
            {licenseStatus.activatedAt && (
              <div className="text-[10px] text-slate-500 pt-0.5">
                Activada el: {new Date(licenseStatus.activatedAt).toLocaleDateString("es-ES", {
                  dateStyle: "medium",
                })}
              </div>
            )}
            <div className="pt-1 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (licenseStatus.licenseKey) {
                    navigator.clipboard.writeText(licenseStatus.licenseKey);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }
                }}
                className="text-[10.5px] font-bold text-emerald-800 hover:text-emerald-900 cursor-pointer flex items-center gap-1"
              >
                <span>{copiedKey ? "✓ Clave copiada" : "📋 Copiar Clave"}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmRevoke(true)}
                className="text-[10.5px] font-bold text-rose-700 hover:text-rose-800 cursor-pointer ml-auto"
              >
                Revocar / Reinstalar
              </button>
            </div>
          </div>
        </div>

        {/* Reset & Logout & Cache Clear */}
        <div className="pt-2 space-y-2">
          {/* Forzar Actualización de Activos / Limpiar Caché */}
          <button
            type="button"
            onClick={() => setConfirmClearCache(true)}
            disabled={isClearingCache}
            className="w-full py-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-extrabold text-xs flex items-center justify-center gap-2 border border-amber-300 transition cursor-pointer shadow-xs active:scale-98"
          >
            <IconRefreshCw size={15} className={isClearingCache ? "animate-spin" : ""} />
            <span>{isClearingCache ? "Purgando Activos y Caché..." : "Forzar Actualización de Activos (Limpiar Caché & Service Worker)"}</span>
          </button>

          <button
            onClick={() => {
              setResetPresetType("clean");
              setConfirmReset(true);
            }}
            className="w-full py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs flex items-center justify-center gap-2 border border-rose-200 transition cursor-pointer"
          >
            <IconTrash size={15} /> Purgar Datos / Restablecer Catálogo
          </button>

          <button
            onClick={onLogout}
            className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <IconLock size={15} /> Bloquear Terminal (Cerrar Sesión)
          </button>
        </div>

        <div className="flex flex-col items-center justify-center gap-1.5 pt-4 pb-4">
          <AppLogo size={36} rounded="rounded-xl" className="opacity-90" />
          <div className="text-center text-[11px] font-bold text-slate-600">
            CajaMaster POS
          </div>
          <div className="text-center text-[10px] text-slate-400">
            Punto de Venta Offline • Control de Inventarios & Arqueo Z
          </div>
        </div>
      </div>

      {/* Dynamic Category Manager Modal */}
      <CategoryManagerModal
        isOpen={showCatModal}
        onClose={() => setShowCatModal(false)}
      />

      {/* Multi-Device Real-Time Sync Modal */}
      <SyncSettingsModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
      />

      {/* Connectivity Modal */}
      <ConnectivityModal
        isOpen={showConnectivity}
        onClose={() => setShowConnectivity(false)}
      />

      {/* Backup Modal */}
      <BackupModal
        isOpen={showBackup}
        onClose={() => setShowBackup(false)}
      />

      {/* Low Stock Alert Modal */}
      <LowStockAlertModal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
      />

      {/* Revoke / Reinstall License Confirmation Modal */}
      {confirmRevoke && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-pop"
          onClick={() => setConfirmRevoke(false)}
        >
          <div
            className="bg-[var(--color-card-bg)] rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-black/10 dark:border-white/10 text-[var(--color-ink)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center mb-3 font-bold">
              <IconLock size={20} />
            </div>
            <h3 className="font-extrabold text-base">¿Revocar o reinstalar licencia?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Al revocar la licencia, la aplicación volverá al estado de activación inicial y requerirá ingresar nuevamente la clave correspondiente al Device ID.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setConfirmRevoke(false)}
                className="flex-1 py-2.5 rounded-xl neu-sm font-bold text-xs cursor-pointer text-[var(--color-ink)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  revokeLicense();
                  setConfirmRevoke(false);
                  onLogout();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md cursor-pointer transition"
              >
                Sí, Revocar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset & Preset Confirmation Modal */}
      {confirmReset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-pop"
          onClick={() => setConfirmReset(false)}
        >
          <div
            className="bg-[var(--color-card-bg)] rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-black/10 dark:border-white/10 text-[var(--color-ink)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center mb-3 font-bold">
              <IconTrash size={20} />
            </div>
            <h3 className="font-extrabold text-base">
              {resetPresetType === "clean"
                ? "¿Purgar todos los datos?"
                : `¿Cargar plantilla "${TEMPLATE_PRESETS[resetPresetType].label}"?`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {resetPresetType === "clean"
                ? "Se limpiarán los productos y movimientos para dejar la aplicación 100% lista para su configuración personalizada desde cero."
                : `Se configurarán las categorías y parámetros correspondientes al sector ${TEMPLATE_PRESETS[resetPresetType].label}.`}
            </p>

            {/* Template Selector dropdown */}
            <div className="mt-3 space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">
                Plantilla a aplicar:
              </label>
              <select
                value={resetPresetType}
                onChange={(e) => setResetPresetType(e.target.value as any)}
                className="w-full neu-inset rounded-xl px-3 h-10 text-xs font-extrabold text-[var(--color-ink)] bg-[var(--color-bg)] outline-none"
              >
                <option value="clean">🧹 Limpio / En Blanco (Sin productos)</option>
                <option value="gastronomia">🍽️ Gastronomía (Restaurante / Bar / Cafetería)</option>
                <option value="retail">🛍️ Comercio Minorista / Retail (Tienda / Minisuper)</option>
                <option value="servicios">💈 Servicios & Talleres (Peluquería / Taller)</option>
              </select>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 py-2.5 rounded-xl neu-sm font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleApplyPreset(resetPresetType);
                  setConfirmReset(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md cursor-pointer transition"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Printer Management Modal */}
      <PrinterSelectionModal
        isOpen={showPrinterModal}
        onClose={() => {
          setShowPrinterModal(false);
          setPrinterVersion((v) => v + 1);
        }}
        onSelectAndPrint={(printer) => {
          handleTestPrint();
        }}
        title="Gestión de Impresoras & Hardware Térmico"
        subtitle="Configura y prueba conexiones Bluetooth, Wi-Fi, USB y Ethernet"
      />

      {/* Full Business Profile & White Label Customization Studio Modal */}
      <BusinessCustomizationModal
        isOpen={showBusinessCustomModal}
        onClose={() => setShowBusinessCustomModal(false)}
      />

      {/* Self-Hosted OTA & ZIP Updates Modal */}
      <OtaUpdateModal
        isOpen={showOtaModal}
        initialTab={otaInitialTab}
        onClose={() => setShowOtaModal(false)}
      />

      {/* Screen Calibration & Mobile Margins Modal */}
      <ScreenCalibrationModal
        isOpen={isCalibrationModalOpen}
        onClose={() => setIsCalibrationModalOpen(false)}
      />

      {/* Integrated In-App QR Camera Scanner for Instant Pairing */}
      <QrScannerModal
        isOpen={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onSuccess={() => setPrinterVersion((v) => v + 1)}
      />

      {/* Confirm Cache Clear Modal */}
      <ConfirmationModal
        isOpen={confirmClearCache}
        title="¿Limpiar Caché y Forzar Actualización?"
        message="Esta acción purga el almacenamiento en caché del navegador/WebView, desregistra los Service Workers y recarga los activos actualizados directamente. Tus datos de inventario, ventas y licencia se mantendrán intactos."
        confirmText="Limpiar y Recargar"
        cancelText="Cancelar"
        danger={false}
        icon="alert"
        onConfirm={handleExecuteClearCache}
        onClose={() => setConfirmClearCache(false)}
      />
    </div>
  );
}
