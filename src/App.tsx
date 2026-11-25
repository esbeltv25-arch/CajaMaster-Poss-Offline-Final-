import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PhoneFrame, BottomNav } from "./components/Layout";
import type { Tab } from "./components/Layout";
import { CajaScreen } from "./screens/Caja";
import { InventarioScreen } from "./screens/Inventario";
import { Deliveries } from "./screens/Deliveries";
import { CierreCajaScreen } from "./screens/CierreCaja";
import { EditProductScreen } from "./screens/EditProduct";
import { ReportesScreen } from "./screens/Reportes";
import { AjustesScreen } from "./screens/Ajustes";
import { ActivationScreen } from "./screens/Activation";
import { getLicenseStatus, revokeLicense, getPersistentDeviceId } from "./utils/licenseSecurity";
import { ThemeProvider } from "./themeContext";
import { ThemeSelectorModal } from "./components/ThemeSelectorModal";
import { NotificationBanner } from "./components/NotificationBanner";
import { QuickStartGuideModal, type GuideSection } from "./components/QuickStartGuideModal";
import {
  checkOtaUpdate,
  downloadAndExtractOtaBundle,
  applyOtaUpdateAndReload,
  type RemoteVersionInfo,
} from "./services/otaUpdateService";
import type { Product } from "./types";
import { actions, getStoreRates } from "./store";
import { updateRatesFromElToque } from "./services/eltoqueRates";
import { useUserSession, startLockWatcher } from "./services/userSession";
import { ShiftLockScreen } from "./components/ShiftLockScreen";
import { takeProductDraft, type ProductDraft } from "./services/productDraft";

type View =
  | { kind: "tab"; tab: Tab }
  | { kind: "edit"; product?: Product; draft?: ProductDraft };

function AppContent() {
  const [activated, setActivated] = useState(() => getLicenseStatus().isActivated);
  const [deviceId] = useState(() => getPersistentDeviceId());
  // If Android closed the app while the camera was open, reopen the product form that was being filled
  const [view, setView] = useState<View>(() => {
    const draft = takeProductDraft();
    return draft ? { kind: "edit", draft } : { kind: "tab", tab: "caja" };
  });
  const [showQuickGuide, setShowQuickGuide] = useState(false);
  const [quickGuideSection, setQuickGuideSection] = useState<GuideSection>("wizard");
  const [otaAvailable, setOtaAvailable] = useState<RemoteVersionInfo | null>(null);
  const userSession = useUserSession();
  // Automatic lock (inactivity / reopening the app), configured in Ajustes → Usuarios y turnos
  useEffect(() => startLockWatcher(), []);
  const [otaDismissed, setOtaDismissed] = useState(false);
  const [otaBusy, setOtaBusy] = useState(false);
  const [otaStatus, setOtaStatus] = useState<string>("");

  async function installOtaNow() {
    if (!otaAvailable || otaBusy) return;
    setOtaBusy(true);
    setOtaStatus("Descargando actualización...");
    const res = await downloadAndExtractOtaBundle(otaAvailable, (pct, msg) => setOtaStatus(`${pct}% · ${msg}`));
    if (res.success) {
      setOtaStatus("Aplicando nueva versión...");
      await applyOtaUpdateAndReload();
    } else {
      setOtaStatus("Error: " + res.message);
      setOtaBusy(false);
    }
  }

  // Exchange rates from elTOQUE: on start and every 3 h (only if enabled, with token and internet)
  useEffect(() => {
    if (!activated) return;
    const run = () =>
      updateRatesFromElToque(getStoreRates(), (r) => actions.setExchangeRates(r)).catch(() => undefined);
    const first = setTimeout(run, 4000);
    const every = setInterval(run, 30 * 60 * 1000); // checks every 30 min; fetches at most every 3 h
    window.addEventListener("online", run);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      window.removeEventListener("online", run);
    };
  }, [activated]);

  // Silent, non-blocking background check on app start
  useEffect(() => {
    if (!activated) return;
    const timer = setTimeout(async () => {
      try {
        const res = await checkOtaUpdate({ silent: true, timeoutMs: 3500 });
        if (res.hasUpdate && res.remoteInfo) {
          setOtaAvailable(res.remoteInfo);
        }
      } catch (e) {
        // Silently ignore in background
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [activated]);

  useEffect(() => {
    const handleNav = (e: any) => {
      if (e?.detail) {
        setView({ kind: "tab", tab: e.detail as Tab });
      }
    };
    window.addEventListener("cajamaster-nav", handleNav);
    return () => window.removeEventListener("cajamaster-nav", handleNav);
  }, []);

  if (!activated) {
    return (
      <ActivationScreen
        deviceId={deviceId}
        onActivated={() => setActivated(true)}
      />
    );
  }

  // Users configured and nobody on shift: ask who is working
  const activeShift =
    userSession.session && userSession.users.some((u) => u.id === userSession.session!.userId);
  if (userSession.users.length > 0 && !activeShift) {
    return <ShiftLockScreen />;
  }
  // Locked screen: shown ON TOP of the app (not instead of it), so whatever was open
  // underneath (a product form waiting for a camera photo, a payment, the ticket) is kept.
  const screenLocked = userSession.users.length > 0 && userSession.locked;

  function logout() {
    revokeLicense();
    setActivated(false);
  }

  const currentTab: Tab = view.kind === "tab" ? view.tab : "inventario";

  return (
    <>
      {screenLocked && (
        <div className="fixed inset-0 z-[1000] overflow-y-auto" id="shift-lock-overlay">
          <ShiftLockScreen locked />
        </div>
      )}
      <div inert={screenLocked} aria-hidden={screenLocked || undefined} className="contents">
      <PhoneFrame>
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          <AnimatePresence mode="wait" initial={false}>
            {view.kind === "edit" ? (
              <motion.div
                key="edit-product"
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
              >
                <EditProductScreen
                  initial={view.product}
                  draft={view.draft}
                  onClose={() => setView({ kind: "tab", tab: "inventario" })}
                />
              </motion.div>
            ) : view.tab === "caja" ? (
              <motion.div
                key="tab-caja"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
              >
                <CajaScreen onNewProduct={() => setView({ kind: "edit" })} />
              </motion.div>
            ) : view.tab === "inventario" ? (
              <motion.div
                key="tab-inventario"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
              >
                <InventarioScreen
                  onAdd={() => setView({ kind: "edit" })}
                  onEdit={(p) => setView({ kind: "edit", product: p })}
                />
              </motion.div>
            ) : view.tab === "deliveries" ? (
              <motion.div
                key="tab-deliveries"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
              >
                <Deliveries />
              </motion.div>
            ) : view.tab === "cierre" ? (
              <motion.div
                key="tab-cierre"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
              >
                <CierreCajaScreen />
              </motion.div>
            ) : view.tab === "reportes" ? (
              <motion.div
                key="tab-reportes"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
              >
                <ReportesScreen />
              </motion.div>
            ) : (
              <motion.div
                key="tab-ajustes"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
              >
                <AjustesScreen
                  deviceId={deviceId}
                  onLogout={logout}
                  onOpenQuickGuide={(section) => {
                    setQuickGuideSection(section || "wizard");
                    setShowQuickGuide(true);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {view.kind === "tab" && (
          <BottomNav tab={currentTab} onChange={(t) => setView({ kind: "tab", tab: t })} />
        )}

        {/* OTA update available banner */}
        {otaAvailable && !otaDismissed && (
          <div className="absolute left-3 right-3 bottom-20 z-40 rounded-2xl bg-slate-900 text-white shadow-2xl border border-amber-400/40 p-3 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-black text-amber-300">
                  Nueva versión {otaAvailable.version} disponible
                </p>
                <p className="text-[11px] text-slate-300 line-clamp-2">
                  {otaStatus || otaAvailable.changelog}
                </p>
              </div>
              {!otaBusy && !otaAvailable.mandatory && (
                <button
                  type="button"
                  onClick={() => setOtaDismissed(true)}
                  className="text-slate-400 hover:text-white text-xs font-bold px-1 cursor-pointer"
                  aria-label="Cerrar aviso"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={installOtaNow}
              disabled={otaBusy}
              className="w-full py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black disabled:opacity-60 cursor-pointer"
            >
              {otaBusy ? "Actualizando..." : "Actualizar ahora"}
            </button>
          </div>
        )}

        {/* In-App Stock Notification Banner stays strictly inside the frame */}
        <NotificationBanner onOpenInventory={() => setView({ kind: "tab", tab: "inventario" })} />
      </PhoneFrame>

      {/* Theme Selector Modal */}
      <ThemeSelectorModal />

      {/* First-Time & On-Demand Quick Start Guide Modal */}
      <QuickStartGuideModal
        isOpen={showQuickGuide}
        initialSection={quickGuideSection}
        onClose={() => setShowQuickGuide(false)}
        onGoToInventory={() => setView({ kind: "tab", tab: "inventario" })}
        onGoToCaja={() => setView({ kind: "tab", tab: "caja" })}
        onGoToNewProduct={() => setView({ kind: "edit" })}
      />
      </div>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
