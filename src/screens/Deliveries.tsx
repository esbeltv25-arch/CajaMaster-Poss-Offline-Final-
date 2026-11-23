import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  IconTruck,
  IconMotorcycle,
  IconBuilding,
  IconPlus,
  IconWhatsApp,
} from "../components/Icons";
import { useStore } from "../store";
import { useTheme } from "../themeContext";
import { DeliveryOrdersTab } from "../components/deliveries/DeliveryOrdersTab";
import { DeliveryDriversTab } from "../components/deliveries/DeliveryDriversTab";
import { DeliveryAgenciesTab } from "../components/deliveries/DeliveryAgenciesTab";
import { NewDeliveryOrderModal } from "../components/deliveries/NewDeliveryOrderModal";
import { QuickDispatchModal } from "../components/deliveries/QuickDispatchModal";
import { WhatsAppMessageModal } from "../components/deliveries/WhatsAppMessageModal";
import { DeliveryOrderDetailModal } from "../components/deliveries/DeliveryOrderDetailModal";
import { NewDriverModal } from "../components/deliveries/NewDriverModal";
import { NewAgencyModal } from "../components/deliveries/NewAgencyModal";
import { WebhookSimulatorModal } from "../components/deliveries/WebhookSimulatorModal";
import type { DeliveryOrder, DeliveryDriver, DeliveryAgency } from "../types";

type DeliveryModuleTab = "orders" | "drivers" | "agencies";

export function Deliveries() {
  const state = useStore();
  const { layoutMode, calibration } = useTheme();
  const isPhone = layoutMode === "phone";
  const [currentTab, setCurrentTab] = useState<DeliveryModuleTab>("orders");

  // Modals state
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<DeliveryOrder | null>(null);
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<DeliveryOrder | null>(null);
  const [selectedOrderForWhatsApp, setSelectedOrderForWhatsApp] = useState<DeliveryOrder | null>(null);

  // Driver modal state
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [driverToEdit, setDriverToEdit] = useState<DeliveryDriver | null>(null);

  // Agency modal state
  const [isAgencyModalOpen, setIsAgencyModalOpen] = useState(false);
  const [agencyToEdit, setAgencyToEdit] = useState<DeliveryAgency | null>(null);
  const [agencyForSimulator, setAgencyForSimulator] = useState<DeliveryAgency | null>(null);

  const activeOrdersCount = (state.deliveries || []).filter(
    (o) => o.status !== "ENTREGADO" && o.status !== "CANCELADO"
  ).length;

  const availableDriversCount = (state.drivers || []).filter(
    (d) => d.status === "AVAILABLE"
  ).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden">
      {/* Top Banner / Navigation Bar with Safe Area Clearance */}
      <header
        className="bg-[var(--color-card-bg)] border-b border-black/10 px-3 sm:px-5 pb-2 shrink-0 shadow-2xs transition-all"
        style={{
          paddingTop: "max(calc(env(safe-area-inset-top, 0px) + var(--app-safe-top, 0px) + 0.65rem), 3rem)",
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2">
          {/* Title & Brand */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0 text-sm">
              <IconTruck size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs sm:text-base md:text-lg font-black text-slate-900 tracking-tight leading-none truncate">
                  Gestión de Envíos & Deliveries
                </h1>
                <span className="text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300/60 shrink-0">
                  En Vivo
                </span>
              </div>
              {!isPhone && (
                <p className="text-[10.5px] sm:text-xs text-slate-500 font-medium mt-0.5 truncate">
                  Recepción WhatsApp y Telegram • Repartidores propios • Despacho y agencias
                </p>
              )}
            </div>
          </div>

          {/* Unified Responsive Segmented Control for Tablet, Mobile & Desktop */}
          <div className="w-full md:w-auto bg-slate-100/90 p-0.5 sm:p-1 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="grid grid-cols-3 md:flex md:items-center gap-1 sm:gap-1.5 w-full md:w-auto">
              {/* Tab 1: Pedidos */}
              <button
                type="button"
                id="btn-deliveries-tab-orders"
                onClick={() => setCurrentTab("orders")}
                className={`px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10.5px] sm:text-xs font-black transition cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 active:scale-95 ${
                  currentTab === "orders"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                <IconTruck size={14} className="shrink-0" />
                <span className="truncate">Pedidos</span>
                {activeOrdersCount > 0 && (
                  <span
                    className={`text-[9px] sm:text-[10px] font-black px-1.5 py-0.2 rounded-full shrink-0 ${
                      currentTab === "orders" ? "bg-amber-400 text-slate-950" : "bg-slate-300 text-slate-800"
                    }`}
                  >
                    {activeOrdersCount}
                  </span>
                )}
              </button>

              {/* Tab 2: Repartidores */}
              <button
                type="button"
                id="btn-deliveries-tab-drivers"
                onClick={() => setCurrentTab("drivers")}
                className={`px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10.5px] sm:text-xs font-black transition cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 active:scale-95 ${
                  currentTab === "drivers"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                <IconMotorcycle size={14} className="shrink-0" />
                <span className="truncate">Repartidores</span>
                {availableDriversCount > 0 && (
                  <span
                    className={`text-[9px] sm:text-[10px] font-black px-1.5 py-0.2 rounded-full shrink-0 ${
                      currentTab === "drivers" ? "bg-emerald-400 text-emerald-950" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {availableDriversCount}
                  </span>
                )}
              </button>

              {/* Tab 3: Agencias */}
              <button
                type="button"
                id="btn-deliveries-tab-agencies"
                onClick={() => setCurrentTab("agencies")}
                className={`px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10.5px] sm:text-xs font-black transition cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 active:scale-95 ${
                  currentTab === "agencies"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                <IconBuilding size={14} className="shrink-0" />
                <span className="truncate">Agencias</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area with Safe Bottom Padding */}
      <main
        className="flex-1 overflow-y-auto p-3 sm:p-5 max-w-7xl w-full mx-auto"
        style={{
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + var(--app-safe-bottom, 0px) + 5.5rem), 7rem)",
        }}
      >
        <AnimatePresence mode="wait">
          {currentTab === "orders" && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <DeliveryOrdersTab
                onOpenNewOrder={() => setIsNewOrderModalOpen(true)}
                onOpenDetail={(order) => setSelectedOrderForDetail(order)}
                onOpenDispatch={(order) => setSelectedOrderForDispatch(order)}
                onOpenWhatsApp={(order) => setSelectedOrderForWhatsApp(order)}
              />
            </motion.div>
          )}

          {currentTab === "drivers" && (
            <motion.div
              key="drivers"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <DeliveryDriversTab
                onOpenNewDriver={() => {
                  setDriverToEdit(null);
                  setIsDriverModalOpen(true);
                }}
                onEditDriver={(driver) => {
                  setDriverToEdit(driver);
                  setIsDriverModalOpen(true);
                }}
              />
            </motion.div>
          )}

          {currentTab === "agencies" && (
            <motion.div
              key="agencies"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <DeliveryAgenciesTab
                onOpenNewAgency={() => {
                  setAgencyToEdit(null);
                  setIsAgencyModalOpen(true);
                }}
                onEditAgency={(agency) => {
                  setAgencyToEdit(agency);
                  setIsAgencyModalOpen(true);
                }}
                onOpenSimulator={(agency) => {
                  setAgencyForSimulator(agency);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* MODALS */}
      {/* 1. New Delivery Order Modal */}
      <NewDeliveryOrderModal
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        onOrderCreated={(order) => {
          setSelectedOrderForDetail(order);
        }}
      />

      {/* 2. Quick Dispatch Modal */}
      <QuickDispatchModal
        isOpen={Boolean(selectedOrderForDispatch)}
        order={selectedOrderForDispatch}
        onClose={() => setSelectedOrderForDispatch(null)}
      />

      {/* 3. WhatsApp Notification Message Modal */}
      <WhatsAppMessageModal
        isOpen={Boolean(selectedOrderForWhatsApp)}
        order={selectedOrderForWhatsApp}
        onClose={() => setSelectedOrderForWhatsApp(null)}
      />

      {/* 4. Order Detail Modal */}
      <DeliveryOrderDetailModal
        isOpen={Boolean(selectedOrderForDetail)}
        order={selectedOrderForDetail}
        onClose={() => setSelectedOrderForDetail(null)}
        onOpenDispatch={(order) => {
          setSelectedOrderForDetail(null);
          setSelectedOrderForDispatch(order);
        }}
        onOpenWhatsApp={(order) => {
          setSelectedOrderForDetail(null);
          setSelectedOrderForWhatsApp(order);
        }}
      />

      {/* 5. New / Edit Driver Modal */}
      <NewDriverModal
        isOpen={isDriverModalOpen}
        driverToEdit={driverToEdit}
        onClose={() => {
          setIsDriverModalOpen(false);
          setDriverToEdit(null);
        }}
      />

      {/* 6. New / Edit Agency Modal */}
      <NewAgencyModal
        isOpen={isAgencyModalOpen}
        agencyToEdit={agencyToEdit}
        onClose={() => {
          setIsAgencyModalOpen(false);
          setAgencyToEdit(null);
        }}
      />

      {/* 7. Webhook Simulator Modal */}
      <WebhookSimulatorModal
        isOpen={Boolean(agencyForSimulator)}
        agency={agencyForSimulator}
        order={state.deliveries?.[0] || null}
        onClose={() => setAgencyForSimulator(null)}
      />
    </div>
  );
}
