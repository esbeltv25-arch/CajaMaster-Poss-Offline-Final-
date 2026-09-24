import { useState } from "react";
import { motion } from "motion/react";
import {
  IconX,
  IconTruck,
  IconMapPin,
  IconPhone,
  IconWhatsApp,
  IconMotorcycle,
  IconBuilding,
  IconCheck,
  IconClock,
  IconChevronRight,
  IconCoins,
  IconCreditCard,
  IconTrash,
} from "../Icons";
import { useStore, actions } from "../../store";
import { formatCurrency } from "../../utils/currency";
import { getWhatsAppChatUrl } from "../../utils/whatsappDelivery";
import type { DeliveryOrder, DeliveryStatus } from "../../types";

const STATUS_STEPS: { key: DeliveryStatus; label: string; icon: string }[] = [
  { key: "NUEVO", label: "Nuevo", icon: "📥" },
  { key: "PREPARACION", label: "Cocina / Prep", icon: "🍳" },
  { key: "LISTO", label: "Listo para salir", icon: "📦" },
  { key: "EN_RUTA", label: "En Ruta", icon: "🛵" },
  { key: "ENTREGADO", label: "Entregado", icon: "✅" },
];

export function DeliveryOrderDetailModal({
  order,
  isOpen,
  onClose,
  onOpenDispatch,
  onOpenWhatsApp,
}: {
  order: DeliveryOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenDispatch?: (order: DeliveryOrder) => void;
  onOpenWhatsApp?: (order: DeliveryOrder) => void;
}) {
  const state = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOpen || !order) return null;

  const driver = state.drivers?.find((d) => d.id === order.driverId);
  const agency = state.deliveryAgencies?.find((a) => a.id === order.agencyId);

  const handleStatusChange = (newStatus: DeliveryStatus) => {
    actions.updateDeliveryStatus(order.id, newStatus);
  };

  const handleTogglePaymentStatus = () => {
    const nextStatus = order.paymentStatus === "COMPLETADO" ? "PENDIENTE" : "COMPLETADO";
    actions.updateDeliveryOrder(order.id, { paymentStatus: nextStatus });
  };

  const handleDelete = () => {
    actions.deleteDeliveryOrder(order.id);
    onClose();
  };

  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === order.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-100"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black text-sm">
              #{order.orderNumber}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                  Pedido #{order.orderNumber}
                </h2>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    order.status === "ENTREGADO"
                      ? "bg-emerald-100 text-emerald-800"
                      : order.status === "EN_RUTA"
                      ? "bg-blue-100 text-blue-800"
                      : order.status === "CANCELADO"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {order.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Recibido {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • Vía {order.source || "MANUAL"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Status Stepper Progression */}
          {order.status !== "CANCELADO" && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
              <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
                Estado del Pedido (Toca para actualizar):
              </p>
              <div className="grid grid-cols-5 gap-1">
                {STATUS_STEPS.map((step, idx) => {
                  const isPassed = idx <= currentStepIdx;
                  const isCurrent = step.key === order.status;

                  return (
                    <button
                      key={step.key}
                      type="button"
                      onClick={() => handleStatusChange(step.key)}
                      className={`flex flex-col items-center py-2 px-1 rounded-xl text-center transition cursor-pointer ${
                        isCurrent
                          ? "bg-slate-900 text-white shadow-xs"
                          : isPassed
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200/60"
                          : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-xs mb-0.5">{step.icon}</span>
                      <span className="text-[9px] font-extrabold leading-tight truncate max-w-full">
                        {step.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Customer & Address Details */}
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 space-y-2.5 shadow-2xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Destinatario
                </p>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {order.customerName}
                </h3>
              </div>

              {/* Quick WhatsApp & Call Actions */}
              <div className="flex items-center gap-1.5">
                {order.customerPhone && (
                  <>
                    <a
                      href={`tel:${order.customerPhone}`}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition"
                    >
                      <IconPhone size={13} />
                      <span>{order.customerPhone}</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => onOpenWhatsApp && onOpenWhatsApp(order)}
                      className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                    >
                      <IconWhatsApp size={13} />
                      <span>WhatsApp</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1 border-t border-slate-100">
              <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                <IconMapPin size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 leading-snug">
                  {order.customerAddress}
                </p>
                {order.notes && (
                  <p className="text-[11px] text-amber-700 bg-amber-50/80 p-1.5 rounded-lg mt-1 font-medium border border-amber-200/50">
                    📝 Nota: {order.notes}
                  </p>
                )}
              </div>

              {order.customerLocationUrl && (
                <a
                  href={order.customerLocationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold shrink-0 transition"
                >
                  Ver Mapa ↗
                </a>
              )}
            </div>
          </div>

          {/* Assigned Driver or Agency Card */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-slate-800 border border-slate-200 shadow-2xs font-bold shrink-0">
                {order.assignmentType === "AGENCY" ? (
                  <IconBuilding size={16} />
                ) : (
                  <IconMotorcycle size={16} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Asignación de Entrega
                </p>
                <p className="text-xs font-extrabold text-slate-900 truncate">
                  {order.assignmentType === "DRIVER" && order.driverName
                    ? `🛵 Repartidor: ${order.driverName}`
                    : order.assignmentType === "AGENCY" && order.agencyName
                    ? `🏢 Agencia: ${order.agencyName} (${order.trackingCode || "Sin tracking"})`
                    : "⚠️ Sin Asignar todavía"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenDispatch && onOpenDispatch(order)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition cursor-pointer shadow-xs shrink-0"
            >
              {order.driverId || order.agencyId ? "Cambiar" : "Asignar 🛵"}
            </button>
          </div>

          {/* Items Breakdown */}
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-extrabold text-slate-900">
                Productos Solicitados ({order.items.length})
              </p>
              <span className="text-xs font-bold text-slate-500">
                Subtotal: {formatCurrency(order.itemsSubtotal, "CUP", state.rates)}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-1.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span>{item.emoji || "📦"}</span>
                    <span className="font-bold text-slate-800">
                      {item.qty}x {item.name}
                    </span>
                  </div>
                  <span className="font-extrabold text-slate-900">
                    {formatCurrency(item.price * item.qty, "CUP", state.rates)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Summary */}
          <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-2 shadow-md">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Subtotal Productos:</span>
              <span className="font-bold">{formatCurrency(order.itemsSubtotal, "CUP", state.rates)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Tarifa de Envío / Mensajería:</span>
              <span className="font-bold">+{formatCurrency(order.deliveryFee, "CUP", state.rates)}</span>
            </div>
            {order.tip ? (
              <div className="flex items-center justify-between text-xs text-amber-300">
                <span>Propina Conductor:</span>
                <span className="font-bold">+{formatCurrency(order.tip, "CUP", state.rates)}</span>
              </div>
            ) : null}

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Total a Cobrar</p>
                <p className="text-lg font-black text-amber-400">
                  {formatCurrency(order.total, "CUP", state.rates)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTogglePaymentStatus}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition ${
                    order.paymentStatus === "COMPLETADO"
                      ? "bg-emerald-500 text-white"
                      : "bg-amber-500/20 text-amber-300 border border-amber-400/40"
                  }`}
                >
                  <IconCoins size={13} />
                  <span>{order.paymentStatus === "COMPLETADO" ? "✅ Cobrado" : "⏳ Pendiente"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Delete confirmation */}
          <div className="pt-2 flex items-center justify-between text-xs">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-rose-600 font-bold">¿Eliminar pedido definitivamente?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-extrabold cursor-pointer"
                >
                  Sí, eliminar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg font-bold cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <IconTrash size={13} />
                <span>Eliminar pedido</span>
              </button>
            )}

            {order.status !== "CANCELADO" && order.status !== "ENTREGADO" && (
              <button
                type="button"
                onClick={() => handleStatusChange("CANCELADO")}
                className="text-slate-500 hover:text-slate-700 text-xs font-bold cursor-pointer"
              >
                Marcar Cancelado
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-2">
            {order.status !== "ENTREGADO" && (
              <button
                type="button"
                onClick={() => {
                  handleStatusChange("ENTREGADO");
                  onClose();
                }}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <IconCheck size={16} />
                <span>Marcar Entregado</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
