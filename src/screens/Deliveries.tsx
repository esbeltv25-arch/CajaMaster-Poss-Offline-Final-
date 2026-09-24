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
    <div className="flex-1 flex flex-col h-full bg-slate-100/70 overflow-hidden">
      {/* Top Banner / Navigation Bar */}
      <header className="bg-white border-b border-slate-200/80 px-3.5 sm:px-5 py-3 shrink-0 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Title & Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
              <IconTruck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none">
                  Gestión de Envíos & Deliveries
                </h1>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300/60 shrink-0">
                  En Vivo
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Recepción WhatsApp • Repartidores propios • Despacho y agencias
              </p>
            </div>
          </div>

          {/* Unified Responsive Segmented Control for Tablet, Mobile & Desktop */}
          <div className="w-full md:w-auto bg-slate-100/90 p-1 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="grid grid-cols-3 md:flex md:items-center gap-1.5 w-full md:w-auto">
              {/* Tab 1: Pedidos */}
              <button
                type="button"
                id="btn-deliveries-tab-orders"
                onClick={() => setCurrentTab("orders")}
                className={`px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                  currentTab === "orders"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                <IconTruck size={15} className="shrink-0" />
                <span className="truncate">Pedidos</span>
                {activeOrdersCount > 0 && (
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
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
                className={`px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                  currentTab === "drivers"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                <IconMotorcycle size={15} className="shrink-0" />
                <span className="truncate">Repartidores</span>
                {availableDriversCount > 0 && (
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
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
                className={`px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                  currentTab === "agencies"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                <IconBuilding size={15} className="shrink-0" />
                <span className="truncate">Agencias</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-5 max-w-7xl w-full mx-auto pb-20 sm:pb-8">
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
