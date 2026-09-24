import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppLogo } from "./AppLogo";
import {
  IconCamera,
  IconCart,
  IconCheck,
  IconArrowRight,
  IconArrowLeft,
  IconSparkles,
  IconBox,
  IconCash,
  IconReceipt,
  IconBolt,
  IconCoins,
  IconHelp,
  IconWhatsApp,
  IconMail,
  IconCopy,
  IconPrinter,
  IconBellRing,
  IconDownload,
  IconUpload,
  IconAlert,
  IconInfo,
  IconSettings,
  IconChart,
  IconSearch,
  IconPlus,
  IconMinus,
  IconEdit,
  IconTrash,
  IconClipboardCheck,
  IconPalette,
  IconLock,
  IconShare,
  IconChevronLeft,
  IconChevronRight,
} from "./Icons";

const ONBOARDING_KEY = "cajamaster_onboarding_completed";

export function isOnboardingCompleted(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingCompleted(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch (err) {
    console.error("Error marking onboarding completed", err);
  }
}

export function resetOnboarding(): void {
  try {
    localStorage.removeItem(ONBOARDING_KEY);
  } catch (err) {
    console.error("Error resetting onboarding", err);
  }
}

export type GuideSection =
  | "wizard"
  | "caja"
  | "inventario"
  | "cierre"
  | "reportes"
  | "ajustes"
  | "glosario";

interface GuideTabItem {
  id: GuideSection;
  label: string;
  icon: React.ReactNode;
}

const GUIDE_TABS: GuideTabItem[] = [
  { id: "wizard", label: "Inicio Rápido", icon: <IconSparkles size={14} /> },
  { id: "caja", label: "Caja (POS)", icon: <IconCart size={14} /> },
  { id: "inventario", label: "Inventario & Stock", icon: <IconBox size={14} /> },
  { id: "cierre", label: "Cierre & Arqueo Z", icon: <IconClipboardCheck size={14} /> },
  { id: "reportes", label: "Reportes IPVE", icon: <IconChart size={14} /> },
  { id: "ajustes", label: "Ajustes & JSON", icon: <IconSettings size={14} /> },
  { id: "glosario", label: "Glosario de Botones", icon: <IconInfo size={14} /> },
];

interface QuickStartGuideModalProps {
  isOpen?: boolean;
  initialSection?: GuideSection;
  onClose?: () => void;
  onGoToInventory?: () => void;
  onGoToCaja?: () => void;
  onGoToNewProduct?: () => void;
}

export function QuickStartGuideModal({
  isOpen: controlledIsOpen,
  initialSection = "wizard",
  onClose: controlledOnClose,
  onGoToInventory,
  onGoToCaja,
  onGoToNewProduct,
}: QuickStartGuideModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<GuideSection>(initialSection);
  const [wizardStep, setWizardStep] = useState<number>(0);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  useEffect(() => {
    if (controlledIsOpen === undefined) {
      if (!isOnboardingCompleted()) {
        setInternalIsOpen(true);
      }
    }
  }, [controlledIsOpen]);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const handleClose = () => {
    markOnboardingCompleted();
    if (controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  const totalWizardSteps = 4;

  const nextWizardStep = () => {
    if (wizardStep < totalWizardSteps - 1) {
      setWizardStep(wizardStep + 1);
    } else {
      setActiveSection("caja");
    }
  };

  const prevWizardStep = () => {
    if (wizardStep > 0) {
      setWizardStep(wizardStep - 1);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 md:p-6"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 15 }}
          transition={{ type: "spring", damping: 26, stiffness: 360 }}
          className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-slate-800 border border-black/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Bar */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <AppLogo size={42} rounded="rounded-2xl" className="shadow-md shrink-0" />
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                  <span>Manual & Guía Completa</span>
                  <span className="text-[10px] font-extrabold bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    CajaMaster POS
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Todo lo que necesitas saber para operar y dominar tu negocio
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold cursor-pointer transition active:scale-90"
              title="Cerrar guía"
              aria-label="Cerrar guía"
            >
              ✕
            </button>
          </div>

          {/* Interactive Navigation Category Tabs with Slide Line beneath */}
          <GuideTabsSlider
            tabs={GUIDE_TABS}
            activeSection={activeSection}
            onSelectSection={setActiveSection}
          />

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-800">
            <AnimatePresence mode="wait">
              {activeSection === "wizard" && (
                <WizardSection
                  key="wizard"
                  step={wizardStep}
                  setStep={setWizardStep}
                  totalSteps={totalWizardSteps}
                  onNext={nextWizardStep}
                  onPrev={prevWizardStep}
                  onClose={handleClose}
                  onGoToCaja={onGoToCaja}
                  onGoToNewProduct={onGoToNewProduct}
                  onGoToInventory={onGoToInventory}
                />
              )}

              {activeSection === "caja" && (
                <CajaGuideSection
                  key="caja"
                  onGoToCaja={() => {
                    handleClose();
                    onGoToCaja?.();
                  }}
                />
              )}

              {activeSection === "inventario" && (
                <InventarioGuideSection
                  key="inventario"
                  onGoToInventory={() => {
                    handleClose();
                    onGoToInventory?.();
                  }}
                  onGoToNewProduct={() => {
                    handleClose();
                    onGoToNewProduct?.();
                  }}
                />
              )}

              {activeSection === "cierre" && (
                <CierreGuideSection key="cierre" />
              )}

              {activeSection === "reportes" && (
                <ReportesGuideSection key="reportes" />
              )}

              {activeSection === "ajustes" && (
                <AjustesGuideSection key="ajustes" />
              )}

              {activeSection === "glosario" && (
                <GlosarioGuideSection key="glosario" />
              )}
            </AnimatePresence>
          </div>

          {/* Modal Bottom Footer */}
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
            <div className="flex items-center gap-2 text-slate-500 font-bold">
              <IconInfo size={15} className="text-amber-500" />
              <span className="hidden sm:inline">Disponible en cualquier momento desde Ajustes</span>
              <span className="sm:hidden">Guía Oficial</span>
            </div>

            <div className="flex items-center gap-2">
              {activeSection !== "wizard" && (
                <button
                  onClick={() => {
                    setActiveSection("wizard");
                    setWizardStep(0);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold transition cursor-pointer"
                >
                  Ver Tutorial Inicial
                </button>
              )}
              <button
                onClick={handleClose}
                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold transition cursor-pointer shadow-xs active:scale-95"
              >
                Cerrar Guía
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* =========================================================================
   INTERACTIVE TABS SLIDER WITH SLIDE LINE BENEATH
   ========================================================================= */
function GuideTabsSlider({
  tabs,
  activeSection,
  onSelectSection,
}: {
  tabs: GuideTabItem[];
  activeSection: GuideSection;
  onSelectSection: (section: GuideSection) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [thumbWidthRatio, setThumbWidthRatio] = useState(1);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;

    setCanScrollLeft(scrollLeft > 3);
    setCanScrollRight(scrollLeft < maxScroll - 3);

    if (maxScroll > 0) {
      setScrollProgress(Math.min(1, Math.max(0, scrollLeft / maxScroll)));
      setThumbWidthRatio(Math.min(1, Math.max(0.18, clientWidth / scrollWidth)));
    } else {
      setScrollProgress(0);
      setThumbWidthRatio(1);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    const el = containerRef.current;
    if (!el) return;

    const handleResize = () => checkScroll();
    window.addEventListener("resize", handleResize);
    el.addEventListener("scroll", checkScroll, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      el.removeEventListener("scroll", checkScroll);
    };
  }, [checkScroll, tabs]);

  const scrollByAmount = (offset: number) => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  const handleSelect = (section: GuideSection, btnElement: HTMLButtonElement) => {
    onSelectSection(section);
    if (btnElement && containerRef.current) {
      const container = containerRef.current;
      const btnLeft = btnElement.offsetLeft;
      const btnRight = btnLeft + btnElement.offsetWidth;
      const scrollLeft = container.scrollLeft;
      const containerWidth = container.clientWidth;

      if (btnLeft < scrollLeft + 40) {
        container.scrollTo({ left: Math.max(0, btnLeft - 40), behavior: "smooth" });
      } else if (btnRight > scrollLeft + containerWidth - 40) {
        container.scrollTo({
          left: btnRight - containerWidth + 40,
          behavior: "smooth",
        });
      }
    }
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || !containerRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const maxScroll = containerRef.current.scrollWidth - containerRef.current.clientWidth;
    containerRef.current.scrollTo({
      left: ratio * maxScroll,
      behavior: "smooth",
    });
  };

  const isOverflowing = thumbWidthRatio < 0.98;

  return (
    <div className="bg-slate-800 px-3 pt-2 pb-2.5 border-b border-slate-700/80 shrink-0 space-y-1.5 select-none relative">
      {/* Tab Buttons Row with Smooth Horizontal Scrolling and Chevron Arrows */}
      <div className="relative flex items-center group">
        {/* Left Arrow Button */}
        {isOverflowing && canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollByAmount(-180)}
            className="absolute -left-2 z-20 w-7 h-7 rounded-full bg-slate-900/95 text-white shadow-md flex items-center justify-center cursor-pointer transition active:scale-90 hover:bg-black backdrop-blur-xs border border-white/10"
            aria-label="Ver botones anteriores"
          >
            <IconChevronLeft size={15} />
          </button>
        )}

        {/* Scrollable Tabs Box */}
        <div
          ref={containerRef}
          className="w-full flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x py-0.5 px-0.5"
        >
          {tabs.map((tab) => {
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={(e) => handleSelect(tab.id, e.currentTarget)}
                className={`px-3.5 py-1.5 rounded-xl font-extrabold flex items-center gap-1.5 whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 active:scale-95 text-xs ${
                  isActive
                    ? "bg-amber-400 text-slate-950 shadow-sm ring-1 ring-amber-400"
                    : "bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Arrow Button */}
        {isOverflowing && canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByAmount(180)}
            className="absolute -right-2 z-20 w-7 h-7 rounded-full bg-slate-900/95 text-white shadow-md flex items-center justify-center cursor-pointer transition active:scale-90 hover:bg-black backdrop-blur-xs border border-white/10"
            aria-label="Ver más botones"
          >
            <IconChevronRight size={15} />
          </button>
        )}
      </div>

      {/* Slide Line (Scroll Track & Thumb) directly beneath the buttons */}
      {isOverflowing && (
        <div className="flex items-center gap-2 pt-0.5 px-1">
          <div
            ref={trackRef}
            onClick={handleTrackClick}
            className="relative flex-1 h-1.5 bg-white/15 rounded-full cursor-pointer overflow-hidden transition-all hover:h-2"
            title="Desliza para mover los botones de la guía"
          >
            <div
              className="absolute top-0 bottom-0 bg-amber-400 rounded-full transition-all duration-75 shadow-xs"
              style={{
                width: `${Math.max(16, thumbWidthRatio * 100)}%`,
                left: `${scrollProgress * (100 - Math.max(16, thumbWidthRatio * 100))}%`,
              }}
            />
          </div>
          <span className="text-[9px] font-extrabold text-amber-300/80 uppercase tracking-widest shrink-0">
            {tabs.length} Módulos
          </span>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   SECTION 1: ONBOARDING WIZARD
   ========================================================================= */
function WizardSection({
  step,
  setStep,
  totalSteps,
  onNext,
  onPrev,
  onClose,
  onGoToCaja,
  onGoToNewProduct,
  onGoToInventory,
}: {
  key?: React.Key;
  step: number;
  setStep: (s: number) => void;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onGoToCaja?: () => void;
  onGoToNewProduct?: () => void;
  onGoToInventory?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-5"
    >
      {/* Wizard Progress Dots */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
          Paso {step + 1} de {totalSteps}
        </div>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                step === i ? "w-6 bg-slate-900" : "w-2 bg-slate-300 hover:bg-slate-400"
              }`}
              aria-label={`Ir al paso ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div className="text-center space-y-1.5 py-1">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-3xl bg-amber-100 text-amber-600 mb-1">
              <span className="text-3xl">🇨🇺</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              ¡Bienvenido a CajaMaster POS!
            </h2>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              El sistema ágil de punto de venta, inventario fotográfico y liquidación fiscal diseñado para negocios y trabajadores por cuenta propia en Cuba.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <FeatureCard
              icon={<IconBolt size={16} />}
              iconBg="bg-emerald-100 text-emerald-700"
              title="100% Offline"
              desc="Funciona sin conexión a internet ni consumo de datos. Tu información reside segura en tu propio dispositivo."
            />
            <FeatureCard
              icon={<IconCamera size={16} />}
              iconBg="bg-amber-100 text-amber-700"
              title="Cámara Integrada"
              desc="Fotografía tus productos directamente con la cámara del móvil y genera un catálogo visual instantáneo."
            />
            <FeatureCard
              icon={<IconCoins size={16} />}
              iconBg="bg-blue-100 text-blue-700"
              title="Multimoneda CUP/USD/EUR"
              desc="Cobro en efectivo con cálculo de vuelto o mediante transferencia QR (Transfermóvil / EnZona)."
            />
            <FeatureCard
              icon={<IconClipboardCheck size={16} />}
              iconBg="bg-purple-100 text-purple-700"
              title="Cierre Z & Reportes IPVE"
              desc="Arqueos de caja con detección de descuadres y generación automática de la liquidación oficial de existencias y precios."
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-extrabold shrink-0 shadow-xs">
              <IconCamera size={22} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Paso 1: Crear Productos e Inventario 📸
              </h3>
              <p className="text-xs text-slate-500">
                Registra tus artículos con foto, precio de costo y precio de venta
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <StepItem
              num="1"
              title="Accede a Inventario"
              desc="Pulsa en la pestaña 'Inventario' y luego en el botón '+ Nuevo Producto'."
            />
            <StepItem
              num="2"
              title="Captura la Foto con la Cámara"
              desc="Toca el icono de la cámara para abrir el visor en vivo. Apunta al producto y presiona disparar para recortar y optimizar la imagen automáticamente."
            />
            <StepItem
              num="3"
              title="Define Costos, Precios y Stock Mínimo"
              desc="Ingresa el costo de compra, el precio de venta al público y el umbral de stock bajo para que la aplicación te avise con sonido y vibración cuando te queden pocas unidades."
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-extrabold shrink-0 shadow-xs">
              <IconCart size={22} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Paso 2: Realizar Ventas y Cobros 🛒
              </h3>
              <p className="text-xs text-slate-500">
                Flujo ultra rápido para atender clientes en segundos
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <StepItem
              num="1"
              title="Agrega productos al ticket"
              desc="En la pestaña 'Caja', toca las tarjetas de productos para sumarlos. Puedes filtrar por categoría usando la barra deslizante o buscar por nombre."
            />
            <StepItem
              num="2"
              title="Pulsa 'Cobrar Ticket'"
              desc="Selecciona si el cliente paga en Efectivo (CUP, USD, EUR, MLC) o por Transferencia (Transfermóvil / EnZona). La app calcula el vuelto exacto al instante."
            />
            <StepItem
              num="3"
              title="Comprobante e Impacto en Inventario"
              desc="Al confirmar, se descuenta el stock automáticamente y puedes imprimir el comprobante o enviarlo por WhatsApp."
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 text-center py-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 shadow-xs mb-1">
            <IconCheck size={32} />
          </div>
          <h3 className="text-xl font-extrabold text-slate-900">
            ¡Todo listo para trabajar con tu negocio!
          </h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            Puedes explorar las pestañas superiores de este manual para consultar detalles avanzados sobre <b>Caja</b>, <b>Stock</b>, <b>Cierre Z</b>, <b>Reportes IPVE</b> y <b>Copias de Seguridad</b>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
            <button
              onClick={() => {
                onClose();
                if (onGoToNewProduct) onGoToNewProduct();
                else onGoToInventory?.();
              }}
              className="py-3 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer active:scale-98"
            >
              <IconCamera size={16} />
              <span>Crear Mi Primer Producto</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onGoToCaja?.();
              }}
              className="py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer active:scale-98"
            >
              <IconCart size={16} />
              <span>Ir al Punto de Venta</span>
            </button>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        {step > 0 ? (
          <button
            onClick={onPrev}
            className="py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <IconArrowLeft size={14} /> Anterior
          </button>
        ) : (
          <div />
        )}

        {step < totalSteps - 1 ? (
          <button
            onClick={onNext}
            className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            Siguiente <IconArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={onNext}
            className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            Explorar Manual Completo <IconArrowRight size={14} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* =========================================================================
   SECTION 2: CAJA (PUNTO DE VENTA) GUIDE
   ========================================================================= */
function CajaGuideSection({ onGoToCaja }: { key?: React.Key; onGoToCaja: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold">
            <IconCart size={18} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Módulo de Caja (Punto de Venta)
            </h3>
            <p className="text-xs text-slate-500">
              Gestión del ticket activo, cobro multimoneda y cálculo de cambio
            </p>
          </div>
        </div>

        <button
          onClick={onGoToCaja}
          className="px-3 py-1.5 rounded-xl bg-slate-900 text-amber-400 font-extrabold text-xs hover:bg-slate-800 transition cursor-pointer flex items-center gap-1"
        >
          <span>Abrir Caja</span> <IconArrowRight size={13} />
        </button>
      </div>

      <div className="space-y-3 text-xs leading-relaxed text-slate-700">
        <GuideBox title="1. Selección de Artículos & Barra de Categorías">
          <p>
            Al pulsar sobre cualquier tarjeta de producto, se agrega una unidad a la orden activa. Utiliza la <b>barra deslizante de categorías</b> ubicada bajo la barra de búsqueda para filtrar rápidamente entre <i>Cafetería, Bebidas, Alimentos, etc.</i> o toca el botón <span className="font-bold text-rose-600">Stock Bajo</span> para ver los productos a punto de agotarse.
          </p>
        </GuideBox>

        <GuideBox title="2. Control del Ticket Activo">
          <p>
            En la barra o panel del ticket puedes modificar la cantidad de cada producto con los botones <b>+</b> y <b>-</b>, o eliminar un producto con el icono de la papelera. Tocar <b>"Vaciar Ticket"</b> reinicia la venta actual.
          </p>
        </GuideBox>

        <GuideBox title="3. Métodos de Pago y Multimoneda (CUP, USD, EUR, MLC)">
          <p>
            Al presionar <b>"Cobrar Ticket"</b> se abrirá la ventana de liquidación:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-1 text-slate-600">
            <li><b>Efectivo en CUP:</b> Ingresa el importe entregado por el cliente y la app calculará el vuelto exacto.</li>
            <li><b>Divisas (USD / EUR / MLC):</b> La app convierte automáticamente el total en CUP a la divisa seleccionada según la tasa configurada en Ajustes, y te indica el importe equivalente a recibir.</li>
            <li><b>Transferencia QR:</b> Muestra el botón para pagos digitales mediante <i>Transfermóvil</i> o <i>EnZona</i>, generando un registro separado para cuadres contables.</li>
          </ul>
        </GuideBox>

        <GuideBox title="4. Comprobante Digital & Ticket de Impresión">
          <p>
            Una vez finalizada la venta, se genera el comprobante fiscal. Puedes imprimirlo en una impresora térmica/PDF o compartirlo con el cliente directamente mediante <b>WhatsApp</b>.
          </p>
        </GuideBox>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   SECTION 3: INVENTARIO & STOCK GUIDE
   ========================================================================= */
function InventarioGuideSection({
  onGoToInventory,
  onGoToNewProduct,
}: {
  key?: React.Key;
  onGoToInventory: () => void;
  onGoToNewProduct: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
            <IconBox size={18} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Control de Inventario & Stock
            </h3>
            <p className="text-xs text-slate-500">
              Catálogo fotográfico, márgenes de ganancia y alertas preventivas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onGoToNewProduct}
            className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-extrabold text-xs hover:bg-amber-300 transition cursor-pointer flex items-center gap-1"
          >
            <IconPlus size={13} /> <span>Nuevo</span>
          </button>
          <button
            onClick={onGoToInventory}
            className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-extrabold text-xs hover:bg-slate-800 transition cursor-pointer"
          >
            Ver Stock
          </button>
        </div>
      </div>

      <div className="space-y-3 text-xs leading-relaxed text-slate-700">
        <GuideBox title="1. Ficha del Producto & Fotografía con Cámara">
          <p>
            Al crear o editar un producto puedes activar la <b>Cámara integrada</b> del dispositivo o seleccionar una imagen guardada. La app ajusta, recorta y optimiza la imagen para un rendimiento ultra rápido en el punto de venta.
          </p>
        </GuideBox>

        <GuideBox title="2. Precio de Costo vs. Precio de Venta (Margen)">
          <p>
            - <b>Costo Unitario (CUP):</b> Lo que te cuesta adquirir o elaborar el producto. Es la base para calcular el costo de ventas en la liquidación IPUE.<br />
            - <b>Precio de Venta (CUP):</b> El importe final al público. La app calcula en tiempo real tu margen de ganancia porcentual y bruto.
          </p>
        </GuideBox>

        <GuideBox title="3. Alertas de Stock Bajo (Sonido, Vibración y Notificación)">
          <p>
            Cada producto cuenta con un campo <b>"Alerta Stock Bajo"</b> (ej. avisar si quedan menos de 5 unidades). Cuando las existencias caen por debajo de esa cifra, la app muestra una insignia roja en caja y emite una alerta acústica y táctil.
          </p>
        </GuideBox>

        <GuideBox title="4. Ajustes Rápidos de Existencias (+ / -)">
          <p>
            En la lista de inventario puedes ajustar unidades directamente con los botones <b>+</b> y <b>-</b> sin necesidad de abrir la ficha completa de edición.
          </p>
        </GuideBox>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   SECTION 4: CIERRE DE CAJA & ARQUEO GUIDE
   ========================================================================= */
function CierreGuideSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-bold">
          <IconClipboardCheck size={18} />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-900">
            Cierre Diario & Arqueo de Efectivo (Informe Z)
          </h3>
          <p className="text-xs text-slate-500">
            Control de caja, conteo físico de inventario y detección de descuadres
          </p>
        </div>
      </div>

      <div className="space-y-3 text-xs leading-relaxed text-slate-700">
        <GuideBox title="1. Resumen de la Jornada (Ventas de Hoy)">
          <p>
            El sistema calcula de manera automática la suma de ventas en <b>Efectivo</b>, ventas por <b>Transferencia</b> y el número total de tickets emitidos durante el día en curso.
          </p>
        </GuideBox>

        <GuideBox title="2. Arqueo de Efectivo & Detección de Descuadre">
          <p>
            - <b>Fondo de Caja Inicial:</b> El dinero en efectivo con el que se abrió la jornada.<br />
            - <b>Efectivo Teórico Esperado:</b> <i>Fondo Inicial + Ventas en Efectivo</i>.<br />
            - <b>Efectivo Físico Contado:</b> El dinero real que cuentas en la gaveta.<br />
            - <b>Diferencia / Descuadre:</b> La app resalta en verde si la caja está <b>Cuadrada</b>, en azul si hay <b>Sobrante</b> o en rojo si hay <b>Faltante</b>.
          </p>
        </GuideBox>

        <GuideBox title="3. Conteo Físico de Inventario">
          <p>
            Permite ingresar el recuento físico real de cada producto para comparar contra el stock teórico del sistema y registrar la valoración total de tu almacén a costo y a precio de venta.
          </p>
        </GuideBox>

        <GuideBox title="4. Registro y Envío Digital del Informe Z (WhatsApp / Email)">
          <p>
            Al pulsar <b>"Cerrar Día y Registrar Balance Z"</b> se guarda el cierre en el historial. Desde cada tarjeta histórica puedes:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-1 text-slate-600">
            <li><b>WhatsApp:</b> Envía el resumen estructurado completo al dueño o administrador con un solo toque.</li>
            <li><b>Email:</b> Abre tu cliente de correo con el informe pre-formateado.</li>
            <li><b>Copiar:</b> Copia el texto al portapapeles para pegarlo en notas, Telegram o SMS.</li>
            <li><b>Imprimir / PDF:</b> Genera el ticket físico de cierre con líneas de firma para cajero y auditor.</li>
          </ul>
        </GuideBox>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   SECTION 5: REPORTES IPVE GUIDE
   ========================================================================= */
function ReportesGuideSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold">
          <IconChart size={18} />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-900">
            Reportes IPVE & Liquidación Fiscal
          </h3>
          <p className="text-xs text-slate-500">
            Hoja oficial de liquidación periódica, costo de ventas, existencias y margen de utilidad
          </p>
        </div>
      </div>

      <div className="space-y-3 text-xs leading-relaxed text-slate-700">
        <GuideBox title="1. ¿Qué es el Reporte IPVE / IPV?">
          <p>
            Es el modelo oficial de <b>Informe de Precios, Ventas y Existencias (IPVE / IPV / IPUE)</b> utilizado para documentar legal y contablemente las operaciones comerciales: inventario inicial, entradas de mercancía, existencias finales, unidades vendidas, importe en CUP, costo total y márgenes de utilidad en negocios gastronómicos, comerciales y de servicios.
          </p>
        </GuideBox>

        <GuideBox title="2. Filtros por Período de Tiempo">
          <p>
            Puedes consultar y liquidar por <b>Hoy</b>, <b>Esta Semana</b>, <b>Este Mes</b>, <b>Mes Anterior</b>, <b>Todo el Historial</b> o seleccionar un <b>Rango Personalizado</b> de fechas con día inicial y final.
          </p>
        </GuideBox>

        <GuideBox title="3. Edición de Encabezado Comercial y Firmas">
          <p>
            El botón superior <b>"Editar Encabezado"</b> te permite personalizar el Nombre del Establecimiento, Titular / Responsable, Teléfono, Dirección, Títulos Oficiales y Cargos de Auditoría para que figuren tanto en la cabecera como en el pie de firmas del documento oficial.
          </p>
        </GuideBox>

        <GuideBox title="4. Impresión y Descarga en PDF / JSON">
          <p>
            - <b>Imprimir / Guardar PDF:</b> Genera el documento oficial en formato horizontal (Landscape A4) con tabla detallada y líneas de firma para cajero y auditor.<br />
            - <b>Exportar JSON:</b> Descarga los datos crudos del reporte para auditoría digital o respaldo.
          </p>
        </GuideBox>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   SECTION 6: AJUSTES & COPIAS JSON GUIDE
   ========================================================================= */
function AjustesGuideSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold">
          <IconSettings size={18} />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-900">
            Ajustes, Tasas & Seguridad de Datos (JSON)
          </h3>
          <p className="text-xs text-slate-500">
            Copias de seguridad, monedas extranjeras y personalización
          </p>
        </div>
      </div>

      <div className="space-y-3 text-xs leading-relaxed text-slate-700">
        <GuideBox title="1. ¿Qué es el Archivo JSON y por qué debes guardarlo?">
          <p>
            El archivo <b>JSON</b> es la <b>copia de seguridad completa</b> de tu negocio. Contiene todos tus productos, fotos, precios, ventas históricas y cierres de caja. Dado que la aplicación almacena los datos de forma local y offline, exportar el archivo JSON te protege ante limpiezas de navegador, cambios de teléfono o roturas del equipo.
          </p>
        </GuideBox>

        <GuideBox title="2. Cómo Crear y Restaurar una Copia de Seguridad">
          <p>
            - <b>Crear Copia:</b> En <i>Ajustes &gt; Seguridad de Datos y Respaldo</i>, pulsa <b>"Descargar Copia de Seguridad"</b> para guardar el archivo en tu teléfono o enviártelo a tu correo o Google Drive.<br />
            - <b>Restaurar Copia:</b> Pulsa <b>"Restaurar copia de seguridad"</b>, selecciona el archivo <code>.json</code> guardado y toda tu información se cargará al instante exactamente como estaba.
          </p>
        </GuideBox>

        <GuideBox title="3. Tasas de Cambio Multimoneda (USD, MLC, EUR)">
          <p>
            En la sección <b>"Tasas de Cambio Oficiales"</b> puedes actualizar en cualquier momento el valor en CUP de 1 USD, 1 EUR y 1 MLC. La caja usará estos valores automáticamente al cobrar.
          </p>
        </GuideBox>

        <GuideBox title="4. Datos del Negocio & Temas Visuales">
          <p>
            Configura el nombre comercial, teléfono y dirección que aparecerán en los tickets impresos y elige entre temas visuales como <i>Día Neumórfico, Noche Índigo, Verde Esmeralda, Café Cálido o Alto Contraste</i>.
          </p>
        </GuideBox>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   SECTION 7: GLOSARIO DE BOTONES & FUNCIONES
   ========================================================================= */
function GlosarioGuideSection() {
  const [search, setSearch] = useState("");

  const items = [
    {
      icon: <IconCart size={16} className="text-amber-500" />,
      name: "Pestaña Caja",
      desc: "Abre la pantalla de punto de venta y despacho de pedidos.",
    },
    {
      icon: <IconBox size={16} className="text-blue-500" />,
      name: "Pestaña Inventario",
      desc: "Muestra el catálogo completo, niveles de existencias y botón de nuevo producto.",
    },
    {
      icon: <IconClipboardCheck size={16} className="text-purple-500" />,
      name: "Pestaña Cierre de Caja",
      desc: "Permite realizar el arqueo de efectivo de la jornada y emitir el informe Z.",
    },
    {
      icon: <IconChart size={16} className="text-emerald-500" />,
      name: "Pestaña Reportes IPVE",
      desc: "Presenta la liquidación IPVE oficial, costo de ventas, existencias y márgenes.",
    },
    {
      icon: <IconSettings size={16} className="text-slate-700" />,
      name: "Pestaña Ajustes",
      desc: "Configuración del negocio, tasas de cambio, temas y copias de seguridad.",
    },
    {
      icon: <IconCamera size={16} className="text-amber-600" />,
      name: "Cámara / Foto",
      desc: "Abre el visor en tiempo real para tomar la fotografía del producto.",
    },
    {
      icon: <IconAlert size={16} className="text-rose-600" />,
      name: "Filtro Stock Bajo",
      desc: "Muestra únicamente los artículos que están por debajo de su umbral mínimo.",
    },
    {
      icon: <IconWhatsApp size={16} className="text-emerald-600" />,
      name: "Enviar por WhatsApp",
      desc: "Redacta y comparte de forma instantánea el comprobante o informe Z.",
    },
    {
      icon: <IconMail size={16} className="text-blue-600" />,
      name: "Enviar por Email",
      desc: "Abre el gestor de correo electrónico con el resumen financiero listo.",
    },
    {
      icon: <IconCopy size={16} className="text-slate-600" />,
      name: "Copiar al Portapapeles",
      desc: "Copia el texto del informe Z o comprobante para pegarlo donde desees.",
    },
    {
      icon: <IconPrinter size={16} className="text-slate-900" />,
      name: "Imprimir / Guardar PDF",
      desc: "Envía el documento a tu impresora térmica o lo exporta como archivo PDF.",
    },
    {
      icon: <IconDownload size={16} className="text-emerald-600" />,
      name: "Exportar JSON / Backup",
      desc: "Descarga la base de datos completa en formato de texto JSON.",
    },
    {
      icon: <IconUpload size={16} className="text-blue-600" />,
      name: "Restaurar Copia JSON",
      desc: "Carga un archivo de respaldo previo para restaurar todos tus datos.",
    },
    {
      icon: <IconPlus size={16} className="text-emerald-600" />,
      name: "Botón '+'",
      desc: "Aumenta la cantidad de unidades en el ticket o añade stock en inventario.",
    },
    {
      icon: <IconMinus size={16} className="text-rose-600" />,
      name: "Botón '-'",
      desc: "Reduce la cantidad de unidades en el ticket o descuenta stock en inventario.",
    },
  ];

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (it) => it.name.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q)
    );
  }, [search, items]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-extrabold text-slate-900">
            Glosario de Botones & Funciones
          </h3>
          <p className="text-xs text-slate-500">
            Referencia rápida de los controles y símbolos de la aplicación
          </p>
        </div>
      </div>

      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar botón o función..."
          className="w-full h-10 pl-9 pr-3 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-semibold outline-none text-slate-800 focus:bg-white focus:border-slate-400"
        />
        <div className="absolute left-3 top-3 text-slate-400">
          <IconSearch size={15} />
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {filtered.map((item, idx) => (
          <div
            key={idx}
            className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
              {item.icon}
            </div>
            <div className="text-xs">
              <div className="font-extrabold text-slate-900">{item.name}</div>
              <div className="text-slate-600 text-[11px] mt-0.5">{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* =========================================================================
   HELPER MINI COMPONENTS
   ========================================================================= */
function FeatureCard({
  icon,
  iconBg,
  title,
  desc,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
      <div
        className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center shrink-0 font-bold`}
      >
        {icon}
      </div>
      <div>
        <h4 className="font-extrabold text-xs text-slate-900">{title}</h4>
        <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function StepItem({
  num,
  title,
  desc,
}: {
  num: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
      <span className="w-6 h-6 rounded-full bg-slate-900 text-amber-400 font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
        {num}
      </span>
      <div className="text-xs space-y-0.5">
        <div className="font-bold text-slate-900">{title}</div>
        <div className="text-slate-600 text-[11px] leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

function GuideBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 shadow-2xs">
      <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">
        {title}
      </h4>
      <div className="text-slate-600 text-[11px] leading-relaxed">
        {children}
      </div>
    </div>
  );
}
