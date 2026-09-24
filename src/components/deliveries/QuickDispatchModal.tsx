import { useState } from "react";
import { motion } from "motion/react";
import {
  IconX,
  IconTruck,
  IconMotorcycle,
  IconBicycle,
  IconCar,
  IconScooter,
  IconFootprints,
  IconBuilding,
  IconWhatsApp,
  IconCheck,
} from "../Icons";
import { useStore, actions } from "../../store";
import { formatCurrency } from "../../utils/currency";
import { getWhatsAppChatUrl, generateWhatsAppMessage } from "../../utils/whatsappDelivery";
import type { DeliveryOrder, VehicleType } from "../../types";

function getVehicleIcon(type: VehicleType) {
  switch (type) {
    case "MOTORCYCLE":
      return <IconMotorcycle size={16} />;
    case "BICYCLE":
      return <IconBicycle size={16} />;
    case "CAR":
      return <IconCar size={16} />;
    case "ELECTRIC_SCOOTER":
      return <IconScooter size={16} />;
    case "WALK":
      return <IconFootprints size={16} />;
    default:
      return <IconMotorcycle size={16} />;
  }
}

export function QuickDispatchModal({
  order,
  isOpen,
  onClose,
}: {
  order: DeliveryOrder | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const state = useStore();
  const [dispatchType, setDispatchType] = useState<"DRIVER" | "AGENCY">("DRIVER");
  const [selectedDriverId, setSelectedDriverId] = useState<string>(
    order?.driverId || state.drivers?.find((d) => d.status === "AVAILABLE")?.id || state.drivers?.[0]?.id || ""
  );
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>(
    order?.agencyId || state.deliveryAgencies?.[0]?.id || ""
  );
  const [trackingCode, setTrackingCode] = useState(
    order?.trackingCode || `MND-${Math.floor(100000 + Math.random() * 900000)}`
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState(order?.estimatedMinutes || 25);
  const [autoNotifyWhatsApp, setAutoNotifyWhatsApp] = useState(true);

  if (!isOpen || !order) return null;

  const drivers = state.drivers || [];
  const agencies = state.deliveryAgencies || [];

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);
  const selectedAgency = agencies.find((a) => a.id === selectedAgencyId);

  const handleConfirmDispatch = () => {
    if (dispatchType === "DRIVER" && !selectedDriverId) {
      alert("Por favor selecciona un repartidor para la asignación.");
      return;
    }
    if (dispatchType === "AGENCY" && !selectedAgencyId) {
      alert("Por favor selecciona una agencia de mensajería.");
      return;
    }

    if (dispatchType === "DRIVER") {
      actions.updateDeliveryStatus(order.id, "EN_RUTA", selectedDriverId, undefined, undefined);
    } else {
      actions.updateDeliveryStatus(order.id, "EN_RUTA", undefined, selectedAgencyId, trackingCode);
    }

    if (estimatedMinutes !== order.estimatedMinutes) {
      actions.updateDeliveryOrder(order.id, { estimatedMinutes });
    }

    // Auto trigger WhatsApp update if enabled and phone exists
    if (autoNotifyWhatsApp && order.customerPhone) {
      const msg = generateWhatsAppMessage(
        { ...order, status: "EN_RUTA", estimatedMinutes, trackingCode },
        "IN_ROUTE",
        state.business.name || "Nuestro Negocio",
        state.rates,
        dispatchType === "DRIVER" ? selectedDriver : undefined,
        dispatchType === "AGENCY" ? selectedAgency : undefined
      );
      const url = getWhatsAppChatUrl(order.customerPhone, msg);
      if (url) {
        window.open(url, "_blank");
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <IconTruck size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                Despachar Pedido #{order.orderNumber}
              </h2>
              <p className="text-xs text-slate-500 font-medium truncate max-w-[240px]">
                {order.customerName} • {order.customerAddress}
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

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Order Snapshot */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
            <div>
              <p className="text-slate-500 text-[11px] font-semibold">Total a Cobrar:</p>
              <p className="font-extrabold text-sm text-slate-900">
                {formatCurrency(order.total, "CUP", state.rates)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-[11px] font-semibold">Tarifa Delivery:</p>
              <p className="font-bold text-slate-800">
                {formatCurrency(order.deliveryFee, "CUP", state.rates)}
              </p>
            </div>
          </div>

          {/* Dispatch Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Tipo de Asignación / Logística:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDispatchType("DRIVER")}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                  dispatchType === "DRIVER"
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <IconMotorcycle size={16} />
                <span>Repartidor Propio</span>
              </button>

              <button
                type="button"
                onClick={() => setDispatchType("AGENCY")}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                  dispatchType === "AGENCY"
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <IconBuilding size={16} />
                <span>Agencia Externa</span>
              </button>
            </div>
          </div>

          {/* Option A: Repartidor Propio */}
          {dispatchType === "DRIVER" ? (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Seleccionar Conductor / Mensajero:
              </label>

              {drivers.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {drivers.map((drv) => {
                    const isSelected = selectedDriverId === drv.id;
                    const isAvailable = drv.status === "AVAILABLE";
                    const isOnRoute = drv.status === "ON_ROUTE";

                    return (
                      <div
                        key={drv.id}
                        onClick={() => setSelectedDriverId(drv.id)}
                        className={`p-2.5 rounded-2xl border transition cursor-pointer flex items-center justify-between text-xs ${
                          isSelected
                            ? "bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/20"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 font-bold shrink-0">
                            {drv.avatarEmoji || getVehicleIcon(drv.vehicleType)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-extrabold text-slate-900 truncate">
                              {drv.name}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {drv.phone} • {drv.vehicleType} {drv.licensePlate ? `(${drv.licensePlate})` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              isAvailable
                                ? "bg-emerald-100 text-emerald-800"
                                : isOnRoute
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isAvailable
                                  ? "bg-emerald-600 animate-pulse"
                                  : isOnRoute
                                  ? "bg-blue-600"
                                  : "bg-slate-400"
                              }`}
                            />
                            {isAvailable ? "Disponible" : isOnRoute ? "En Ruta" : "Inactivo"}
                          </span>
                          {isSelected && <IconCheck size={16} className="text-amber-600 font-black" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-amber-50 text-amber-900 rounded-2xl text-xs font-medium">
                  No hay repartidores registrados en la flotilla. Regístralos en la pestaña de Repartidores.
                </div>
              )}
            </div>
          ) : (
            /* Option B: Agencia Externa */
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Empresa / Agencia de Mensajería:
                </label>
                <select
                  value={selectedAgencyId}
                  onChange={(e) => setSelectedAgencyId(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                >
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      🏢 {a.name} (Base: ${a.baseFee} CUP - Tel: {a.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Código de Seguimiento / Tracking ID:
                </label>
                <input
                  type="text"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  placeholder="Ej. MND-982310"
                  className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                />
              </div>
            </div>
          )}

          {/* Estimated minutes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tiempo Estimado de Entrega (Minutos):
            </label>
            <div className="flex items-center gap-2">
              {[15, 25, 35, 45, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setEstimatedMinutes(m)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    estimatedMinutes === m
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          {/* WhatsApp Notification Checkbox */}
          {order.customerPhone && (
            <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 text-xs text-emerald-950 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoNotifyWhatsApp}
                onChange={(e) => setAutoNotifyWhatsApp(e.target.checked)}
                className="mt-0.5 rounded-sm text-emerald-600 focus:ring-emerald-500"
              />
              <div className="min-w-0 flex-1">
                <span className="font-extrabold flex items-center gap-1 text-emerald-900">
                  <IconWhatsApp size={14} /> Abrir WhatsApp con aviso de despacho
                </span>
                <p className="text-[11px] text-emerald-700">
                  Envía automáticamente el mensaje con datos del repartidor y tiempo estimado a {order.customerPhone}.
                </p>
              </div>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmDispatch}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
          >
            <IconTruck size={16} />
            <span>Despachar y Poner en Ruta 🛵</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
