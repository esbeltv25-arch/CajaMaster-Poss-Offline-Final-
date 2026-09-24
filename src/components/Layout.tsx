import { ReactNode, ComponentType, useState, useRef, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { AppLogo } from "./AppLogo";
import {
  IconCash,
  IconBox,
  IconChart,
  IconSettings,
  IconBolt,
  IconWifi,
  IconWifiOff,
  IconClipboardCheck,
  IconCoins,
  IconDownload,
  IconBell,
  IconBellRing,
  IconTruck,
  IconChevronLeft,
  IconChevronRight,
} from "./Icons";
import { useTheme } from "../themeContext";
import { useStore, actions } from "../store";
import { ConnectivityModal } from "./ConnectivityModal";
import { BackupModal } from "./BackupModal";
import { LowStockAlertModal } from "./LowStockAlertModal";
import { SyncSettingsModal } from "./SyncSettingsModal";
import { SyncStatusBadge } from "./SyncStatusBadge";
import type { CurrencyCode } from "../types";

export type Tab = "caja" | "inventario" | "deliveries" | "cierre" | "reportes" | "ajustes";

export function PhoneFrame({ children }: { children: ReactNode }) {
  const { theme, layoutMode, setIsThemePickerOpen } = useTheme();
  const state = useStore();
  const [showConnectivity, setShowConnectivity] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  const isOffline = state.connectivityMode === "offline";
  const lowStockCount = state.products.filter((p) => p.stock <= p.lowStockAlert).length;

  if (layoutMode === "tablet") {
    return (
      <div
        className={`h-[100dvh] md:min-h-screen w-full flex flex-col bg-gradient-to-br ${theme.bgGradient} p-0 md:p-6 transition-all duration-300 font-sans overflow-hidden md:overflow-auto`}
      >
        {/* Counter Top Utility Bar (Visible on Tablet/Desktop screens) */}
        <div className="hidden md:flex w-full max-w-7xl mx-auto mb-3 items-center justify-between px-4 py-2 bg-white/85 backdrop-blur-md rounded-2xl border border-black/5 shadow-xs shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <AppLogo size={28} rounded="rounded-xl" />
              <span className="text-xs text-slate-800 font-extrabold hidden sm:inline tracking-tight">
                {state.business.name || "CajaMaster POS"}
              </span>
            </div>

            <button
              onClick={() => setShowConnectivity(true)}
              className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOffline ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
                }`}
              />
              <span>{isOffline ? "Modo Offline" : "Online"}</span>
            </button>

            {/* Multi-Device Real-Time Sync Badge */}
            <SyncStatusBadge onOpenModal={() => setShowSyncModal(true)} />
          </div>

          <div className="flex items-center gap-2">
            {/* Stock Alerts Bell in Tablet Bar */}
            <button
              onClick={() => setShowAlertModal(true)}
              className={`p-1.5 px-3 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer relative ${
                lowStockCount > 0
                  ? "bg-rose-100 text-rose-900 border border-rose-300"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
              title="Alertas de Inventario"
            >
              <IconBellRing size={14} className={lowStockCount > 0 ? "text-rose-600 animate-bounce" : ""} />
              <span>Alertas</span>
              {lowStockCount > 0 && (
                <span className="bg-rose-600 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ml-0.5">
                  {lowStockCount}
                </span>
              )}
            </button>

            {/* Quick Currency Selector */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
              {(["CUP", "USD", "EUR", "MLC"] as CurrencyCode[]).map((c) => (
                <button
                  key={c}
                  onClick={() => actions.setSelectedCurrency(c)}
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    state.selectedCurrency === c
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowBackup(true)}
              className="p-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Copias de Seguridad"
            >
              <IconDownload size={14} />
              <span className="hidden md:inline">Respaldos</span>
            </button>

            <button
              onClick={() => setIsThemePickerOpen(true)}
              className="px-3 py-1 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-slate-800 transition cursor-pointer shadow-xs"
            >
              <span>🎨</span> <span className="hidden sm:inline">Ambiente</span>
            </button>
          </div>
        </div>

        {/* Counter / Tablet Container */}
        <div
          className="w-full max-w-7xl mx-auto rounded-none md:rounded-[36px] shadow-2xl border-0 md:border md:border-white/40 overflow-hidden flex-1 flex flex-col relative h-[100dvh] md:h-auto md:min-h-[760px]"
          style={{ backgroundColor: theme.frameBg }}
        >
          {children}
        </div>

        <BackupModal
          isOpen={showBackup}
          onClose={() => setShowBackup(false)}
        />
        <ConnectivityModal
          isOpen={showConnectivity}
          onClose={() => setShowConnectivity(false)}
          onOpenSyncModal={() => setShowSyncModal(true)}
        />
        <LowStockAlertModal
          isOpen={showAlertModal}
          onClose={() => setShowAlertModal(false)}
        />
        <SyncSettingsModal
          isOpen={showSyncModal}
          onClose={() => setShowSyncModal(false)}
        />
      </div>
    );
  }

  // Default Smartphone Frame Mode
  return (
    <div
      className={`h-[100dvh] md:min-h-screen w-full flex items-stretch md:items-center justify-center bg-gradient-to-br ${theme.bgGradient} md:py-6 transition-all duration-300 font-sans overflow-hidden`}
    >
      <div
        className="w-full h-[100dvh] max-h-[100dvh] md:h-[890px] md:max-h-[890px] md:max-w-[440px] md:rounded-[44px] md:shadow-[0_30px_90px_-20px_rgba(0,0,0,0.35)] md:border md:border-white/60 overflow-hidden flex flex-col relative transition-all duration-300"
        style={{ backgroundColor: theme.frameBg }}
      >
        {children}
      </div>
    </div>
  );
}

export function TopBar({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const { theme, setIsThemePickerOpen } = useTheme();
  const state = useStore();
  const [showConnectivity, setShowConnectivity] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  const isOffline = state.connectivityMode === "offline";
  const lowStockCount = state.products.filter((p) => p.stock <= p.lowStockAlert).length;

  const actionsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = actionsRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = actionsRef.current;
    if (!el) return;
    window.addEventListener("resize", checkScroll);
    el.addEventListener("scroll", checkScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", checkScroll);
      el.removeEventListener("scroll", checkScroll);
    };
  }, [checkScroll, right]);

  const scrollActions = (amount: number) => {
    actionsRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <>
      <div
        className="px-3 sm:px-4 pt-6 sm:pt-5 md:pt-3 pb-2.5 flex items-center justify-between gap-2 shrink-0 border-b border-black/5"
        style={{
          paddingTop: "max(env(safe-area-inset-top, 0px) + 0.6rem, 1.75rem)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {onBack && (
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-xl neu-sm flex items-center justify-center text-[var(--color-ink)] active:scale-95 transition cursor-pointer shrink-0"
              aria-label="Atrás"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-[var(--color-ink)] font-black text-sm sm:text-base md:text-lg leading-tight truncate tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[10px] sm:text-xs text-[var(--color-ink)] opacity-70 truncate font-semibold">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Action Bar with Horizontal Slide Controls */}
        <div className="relative flex items-center min-w-0 max-w-[64%] sm:max-w-none">
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollActions(-90)}
              className="absolute -left-2 z-20 w-5 h-5 rounded-full bg-slate-900/90 text-white shadow-md flex items-center justify-center cursor-pointer transition hover:scale-110 active:scale-95"
              aria-label="Desplazar botones a la izquierda"
            >
              <IconChevronLeft size={12} />
            </button>
          )}

          <div
            ref={actionsRef}
            className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none touch-pan-x py-0.5 scroll-smooth"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {right}

            {/* Sync Status Badge in TopBar */}
            <SyncStatusBadge onOpenModal={() => setShowSyncModal(true)} />

            {/* Stock Alerts Bell */}
            <button
              onClick={() => setShowAlertModal(true)}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl neu-sm flex items-center justify-center relative transition cursor-pointer shrink-0 ${
                lowStockCount > 0
                  ? "text-rose-600 bg-rose-50"
                  : "text-[var(--color-ink)]"
              }`}
              title={
                lowStockCount > 0
                  ? `${lowStockCount} productos en umbral de alerta`
                  : "Alertas de Inventario"
              }
              aria-label="Alertas de Inventario"
            >
              {lowStockCount > 0 ? (
                <IconBellRing size={13} className="animate-pulse text-rose-600" />
              ) : (
                <IconBell size={13} />
              )}

              {lowStockCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-600 text-white font-black text-[8px] flex items-center justify-center shadow-xs">
                  {lowStockCount > 9 ? "9+" : lowStockCount}
                </span>
              )}
            </button>

            {/* Connectivity Pill Badge */}
            <button
              onClick={() => setShowConnectivity(true)}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl neu-sm flex items-center justify-center transition cursor-pointer shrink-0 ${
                isOffline ? "text-amber-600" : "text-emerald-600"
              }`}
              title={`Modo: ${isOffline ? "Offline" : "Online"}`}
            >
              {isOffline ? <IconWifiOff size={13} /> : <IconWifi size={13} />}
            </button>

            {/* Theme Selector Icon */}
            <button
              onClick={() => setIsThemePickerOpen(true)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl neu-sm flex items-center justify-center text-xs hover:scale-105 active:scale-95 transition cursor-pointer shrink-0"
              title="Cambiar Ambiente y Diseño"
              aria-label="Ambiente"
            >
              🎨
            </button>
          </div>

          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollActions(90)}
              className="absolute -right-2 z-20 w-5 h-5 rounded-full bg-slate-900/90 text-white shadow-md flex items-center justify-center cursor-pointer transition hover:scale-110 active:scale-95"
              aria-label="Desplazar botones a la derecha"
            >
              <IconChevronRight size={12} />
            </button>
          )}
        </div>
      </div>

      <ConnectivityModal
        isOpen={showConnectivity}
        onClose={() => setShowConnectivity(false)}
        onOpenSyncModal={() => setShowSyncModal(true)}
      />
      <LowStockAlertModal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
      />
      <SyncSettingsModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
      />
    </>
  );
}

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const { theme } = useTheme();
  const state = useStore();

  const activeDeliveriesCount = (state.deliveries || []).filter(
    (o) => o.status !== "ENTREGADO" && o.status !== "CANCELADO"
  ).length;

  const items: {
    key: Tab;
    label: string;
    icon: ComponentType<{ size?: number; className?: string }>;
    badge?: number;
  }[] = [
    { key: "caja", label: "CAJA", icon: IconCash },
    { key: "inventario", label: "STOCK", icon: IconBox },
    { key: "deliveries", label: "ENVÍOS", icon: IconTruck, badge: activeDeliveriesCount },
    { key: "cierre", label: "CIERRE", icon: IconClipboardCheck },
    { key: "reportes", label: "IPVE", icon: IconChart },
    { key: "ajustes", label: "AJUSTES", icon: IconSettings },
  ];

  return (
    <div
      className="shrink-0 px-1 sm:px-2 pt-2 pb-3 md:pb-2.5 border-t border-black/5 z-20 select-none shadow-[0_-4px_16px_rgba(0,0,0,0.03)]"
      style={{
        backgroundColor: theme.frameBg,
        paddingBottom: "max(env(safe-area-inset-bottom, 0px) + 0.65rem, 1.25rem)",
      }}
    >
      <div className="flex items-center justify-around max-w-xl mx-auto gap-0.5 sm:gap-1">
        {items.map((it) => {
          const Active = tab === it.key;
          const Icon = it.icon;
          return (
            <motion.button
              key={it.key}
              id={`btn-bottom-nav-${it.key}`}
              onClick={() => onChange(it.key)}
              whileTap={{ scale: 0.92 }}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 px-0.5 rounded-2xl transition cursor-pointer relative ${
                Active
                  ? "shadow-md"
                  : "text-[var(--color-ink)] opacity-60 hover:opacity-90"
              }`}
              style={{
                backgroundColor: Active
                  ? theme.isDark
                    ? "#334155"
                    : "var(--color-ink)"
                  : "transparent",
                color: Active ? "var(--color-gold)" : undefined,
              }}
            >
              <div className="relative">
                <Icon size={17} />
                {it.badge && it.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2 bg-amber-500 text-slate-950 font-black text-[8px] min-w-3.5 h-3.5 px-0.5 rounded-full flex items-center justify-center shadow-xs">
                    {it.badge > 9 ? "9+" : it.badge}
                  </span>
                ) : null}
              </div>
              <span
                className={`text-[9px] tracking-wider font-extrabold leading-none ${
                  Active ? "text-white" : ""
                }`}
              >
                {it.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export function SectionTitle({ children, accent }: { children: ReactNode; accent?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <h2 className="text-[var(--color-ink)] font-extrabold text-2xl leading-none">{children}</h2>
      {accent}
    </div>
  );
}

export const formatCUP = (n: number) =>
  "CUP " + n.toLocaleString("es-ES", { maximumFractionDigits: 0 });
