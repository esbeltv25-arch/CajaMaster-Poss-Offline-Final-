import { useState } from "react";
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
import type { Product } from "./types";

type View =
  | { kind: "tab"; tab: Tab }
  | { kind: "edit"; product?: Product };

function AppContent() {
  const [activated, setActivated] = useState(() => getLicenseStatus().isActivated);
  const [deviceId] = useState(() => getPersistentDeviceId());
  const [view, setView] = useState<View>({ kind: "tab", tab: "caja" });
  const [showQuickGuide, setShowQuickGuide] = useState(false);
  const [quickGuideSection, setQuickGuideSection] = useState<GuideSection>("wizard");

  if (!activated) {
    return (
      <ActivationScreen
        deviceId={deviceId}
        onActivated={() => setActivated(true)}
      />
    );
  }

  function logout() {
    revokeLicense();
    setActivated(false);
  }

  const currentTab: Tab = view.kind === "tab" ? view.tab : "inventario";

  return (
    <>
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
      </PhoneFrame>

      {/* Theme Selector Modal */}
      <NotificationBanner onOpenInventory={() => setView({ kind: "tab", tab: "inventario" })} />
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
