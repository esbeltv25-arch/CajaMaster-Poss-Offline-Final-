import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  IconX,
  IconWhatsApp,
  IconCopy,
  IconCheck,
  IconSend,
  IconPhone,
} from "../Icons";
import { useStore } from "../../store";
import { generateWhatsAppMessage, getWhatsAppChatUrl } from "../../utils/whatsappDelivery";
import type { DeliveryOrder } from "../../types";

type MessageTemplateType = "ORDER_CONFIRMATION" | "IN_ROUTE" | "DELIVERED" | "BILL_SUMMARY" | "CUSTOM";

export function WhatsAppMessageModal({
  order,
  isOpen,
  onClose,
}: {
  order: DeliveryOrder | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const state = useStore();
  const [template, setTemplate] = useState<MessageTemplateType>("IN_ROUTE");
  const [messageText, setMessageText] = useState("");
  const [copied, setCopied] = useState(false);

  const driver = state.drivers?.find((d) => d.id === order?.driverId);
  const agency = state.deliveryAgencies?.find((a) => a.id === order?.agencyId);

  useEffect(() => {
    if (!order) return;
    if (template === "CUSTOM") return;

    const generated = generateWhatsAppMessage(
      order,
      template,
      state.business.name || "Nuestro Negocio",
      state.rates,
      driver,
      agency
    );
    setMessageText(generated);
  }, [order, template, state.business.name, state.rates, driver, agency]);

  if (!isOpen || !order) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    if (!order.customerPhone) {
      alert("Este pedido no tiene número telefónico registrado.");
      return;
    }
    const url = getWhatsAppChatUrl(order.customerPhone, messageText);
    if (url) {
      window.open(url, "_blank");
    }
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
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
              <IconWhatsApp size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                Notificar por WhatsApp
              </h2>
              <p className="text-xs text-slate-500 font-medium truncate max-w-[240px]">
                {order.customerName} ({order.customerPhone || "Sin teléfono"})
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Templates Pills */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Plantilla Rápida de Mensaje:
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTemplate("ORDER_CONFIRMATION")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  template === "ORDER_CONFIRMATION"
                    ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                🍳 En Preparación
              </button>

              <button
                type="button"
                onClick={() => setTemplate("IN_ROUTE")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  template === "IN_ROUTE"
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                🛵 En Camino
              </button>

              <button
                type="button"
                onClick={() => setTemplate("DELIVERED")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  template === "DELIVERED"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                ✅ Entregado
              </button>

              <button
                type="button"
                onClick={() => setTemplate("BILL_SUMMARY")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  template === "BILL_SUMMARY"
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                🧾 Comprobante
              </button>
            </div>
          </div>

          {/* Textarea Preview & Edit */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Texto del Mensaje (Editable):
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
              >
                {copied ? (
                  <span className="text-emerald-600 flex items-center gap-0.5 font-extrabold">
                    <IconCheck size={13} /> ¡Copiado!
                  </span>
                ) : (
                  <>
                    <IconCopy size={13} /> Copiar
                  </>
                )}
              </button>
            </div>

            <textarea
              value={messageText}
              onChange={(e) => {
                setMessageText(e.target.value);
                setTemplate("CUSTOM");
              }}
              rows={9}
              className="w-full text-xs font-sans p-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden leading-relaxed"
            />
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
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <IconCopy size={14} />
              <span>Copiar</span>
            </button>

            <button
              type="button"
              onClick={handleOpenWhatsApp}
              disabled={!order.customerPhone}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
            >
              <IconWhatsApp size={16} />
              <span>Abrir WhatsApp 🚀</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
