import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  IconX,
  IconWhatsApp,
  IconTelegram,
  IconCopy,
  IconCheck,
  IconSend,
  IconPhone,
  IconSparkles,
} from "../Icons";
import { useStore } from "../../store";
import { generateWhatsAppMessage, getWhatsAppChatUrl } from "../../utils/whatsappDelivery";
import { openTelegramShare } from "../../utils/telegramSharing";
import { openWhatsAppUniversal, openTelegramUniversal } from "../../utils/universalShare";
import { generateWhatsAppOffer, hasGeminiApiKey } from "../../services/geminiService";
import type { DeliveryOrder } from "../../types";

type MessageTemplateType = "ORDER_CONFIRMATION" | "IN_ROUTE" | "DELIVERED" | "BILL_SUMMARY" | "AI_PROMO" | "CUSTOM";

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
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const hasAiKey = hasGeminiApiKey();

  const driver = state.drivers?.find((d) => d.id === order?.driverId);
  const agency = state.deliveryAgencies?.find((a) => a.id === order?.agencyId);

  const handleGenerateWithAI = async () => {
    if (!order) return;
    if (!hasAiKey) {
      setAiError("Configura tu clave de Gemini en Ajustes para generar ofertas con IA.");
      setTimeout(() => setAiError(null), 3500);
      return;
    }

    setIsGeneratingAI(true);
    setAiError(null);
    try {
      const itemsToPromote = order.items && order.items.length > 0
        ? order.items.map((i) => ({ name: i.name, price: i.price, unit: "u" }))
        : (state.products || []).slice(0, 4).map((p) => ({ name: p.name, price: p.price, unit: p.unit }));

      const generated = await generateWhatsAppOffer(
        itemsToPromote,
        state.business.name || "Nuestro Negocio",
        `Promoción especial para ${order.customerName || "nuestros clientes"}`
      );

      setTemplate("AI_PROMO");
      setMessageText(generated);
    } catch (err: any) {
      setAiError(err.message || "Error al generar oferta con IA.");
      setTimeout(() => setAiError(null), 3500);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  useEffect(() => {
    if (!order) return;
    if (template === "CUSTOM" || template === "AI_PROMO") return;

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
    openWhatsAppUniversal(messageText, order.customerPhone);
  };

  const handleOpenTelegram = () => {
    openTelegramUniversal(messageText);
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
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-sky-50 to-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center -space-x-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                <IconWhatsApp size={17} />
              </div>
              <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center font-bold shadow-xs">
                <IconTelegram size={17} />
              </div>
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                Notificar por WhatsApp / Telegram
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

              <button
                type="button"
                onClick={handleGenerateWithAI}
                disabled={isGeneratingAI}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer border flex items-center gap-1 active:scale-95 ${
                  template === "AI_PROMO"
                    ? "bg-purple-900 text-white border-purple-900 shadow-xs"
                    : "bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100"
                }`}
                title={
                  hasAiKey
                    ? "Redactar oferta publicitaria atractiva con Google Gemini"
                    : "Configura tu clave Gemini en Ajustes para habilitar la IA"
                }
              >
                {isGeneratingAI ? (
                  <>
                    <div className="w-3 h-3 border-2 border-purple-900 border-t-transparent rounded-full animate-spin" />
                    <span>Redactando...</span>
                  </>
                ) : (
                  <>
                    <IconSparkles size={12} className={hasAiKey ? "text-purple-600" : "text-slate-400"} />
                    <span>✨ Oferta con IA</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {aiError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-2">
              <span>⚠️</span>
              <span>{aiError}</span>
            </div>
          )}

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
        <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-50/80">
          <div className="flex items-center gap-1.5 flex-1">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="py-2 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
            >
              <IconCopy size={13} />
              <span>Copiar</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5">
            <button
              type="button"
              onClick={handleOpenTelegram}
              className="py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              title="Compartir o enviar por Telegram"
            >
              <IconTelegram size={14} />
              <span>Telegram ✈️</span>
            </button>

            <button
              type="button"
              onClick={handleOpenWhatsApp}
              disabled={!order.customerPhone}
              className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
            >
              <IconWhatsApp size={14} />
              <span>WhatsApp 🚀</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
