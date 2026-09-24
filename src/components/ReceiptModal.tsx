import { useState } from "react";
import { motion } from "motion/react";
import {
  IconPrinter,
  IconCheck,
  IconReceipt,
  IconDownload,
  IconShare,
  IconWhatsApp,
  IconBluetooth,
  IconWifi,
  IconUsb,
  IconEthernet,
  IconSliders,
} from "./Icons";
import { formatCurrency } from "../utils/currency";
import { useStore } from "../store";
import type { Sale, PrinterDevice } from "../types";
import { generateTicketPdf } from "../utils/pdfExport";
import {
  printSaleTicket,
  getDefaultPrinter,
  getPrinterSettings,
} from "../services/printerService";
import { PrinterSelectionModal } from "./PrinterSelectionModal";

export interface ReceiptModalProps {
  sale: Sale;
  onClose: () => void;
  key?: string;
}

export function ReceiptModal({
  sale,
  onClose,
}: ReceiptModalProps) {
  const state = useStore();
  const biz = state.business;
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [ticketToast, setTicketToast] = useState<string | null>(null);
  const [showPrinterSelector, setShowPrinterSelector] = useState(false);

  const handleGeneratePdf = async (preferShare = false) => {
    try {
      setIsGeneratingPdf(true);
      const res = await generateTicketPdf(sale, biz, state.rates, preferShare);
      if (res.method === "share" && res.success) {
        setTicketToast("¡Ticket compartido!");
      } else if (res.method === "download" && res.success) {
        setTicketToast("Ticket PDF descargado.");
      }
    } catch (err) {
      console.error("Error generating ticket PDF:", err);
      setTicketToast("Error al compilar PDF.");
    } finally {
      setIsGeneratingPdf(false);
      setTimeout(() => setTicketToast(null), 3000);
    }
  };

  const handleWhatsAppText = () => {
    const ticketNum = sale.ticketNumber || String(sale.id).slice(-4);
    const dateStr = new Date(sale.ts).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
    let text = `🧾 *${(biz.name || "CAJAMASTER POS").toUpperCase()}*\n`;
    text += `*Comprobante de Venta #${ticketNum}*\n`;
    text += `📅 ${dateStr}\n\n`;
    text += `*Artículos:*\n`;
    sale.items.forEach((it) => {
      text += `• ${it.qty} ${it.unit || "u"} x ${it.name} = ${formatCurrency(it.qty * it.price, "CUP", state.rates)}\n`;
    });
    text += `\n*TOTAL PAGADO:* ${formatCurrency(sale.total, "CUP", state.rates)}\n`;
    text += `Método: ${String(sale.paymentMethod).toUpperCase()}\n`;
    if (sale.gatewayReference) {
      text += `Ref: ${sale.gatewayReference}\n`;
    }
    text += `\n_${biz.footerMessage || "¡Gracias por su compra!"}_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleExecutePrint = async (printer?: PrinterDevice) => {
    const settings = getPrinterSettings();
    const target = printer || getDefaultPrinter();

    // If no printer or user preference is to always choose and no specific printer was given
    if (!target && settings.autoOpenSelectorIfNoDefault) {
      setShowPrinterSelector(true);
      return;
    }

    try {
      setIsPrinting(true);
      const res = await printSaleTicket(sale, biz, state.rates, target);
      setTicketToast(res.message);
    } catch (err: any) {
      console.warn("Print receipt error:", err);
      setTicketToast(err.message || "Error al procesar la impresión.");
    } finally {
      setIsPrinting(false);
      setTimeout(() => setTicketToast(null), 3500);
    }
  };

  const currentDefaultPrinter = getDefaultPrinter();

  const formattedDate = new Date(sale.ts).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <>
      <motion.div
        id="receipt-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 print:bg-white print:p-0 print:static"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] print:max-w-none print:shadow-none print:border-none print:rounded-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Toolbar (hidden on print) */}
          <div className="p-3 bg-slate-900 text-white flex items-center justify-between print:hidden shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shrink-0">
                <IconReceipt size={16} />
              </div>
              <div>
                <span className="font-extrabold text-xs block leading-tight">Venta Finalizada</span>
                <span className="text-[10px] text-amber-300 font-bold block">
                  Ticket #{sale.ticketNumber || String(sale.id).slice(-4)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleGeneratePdf(false)}
                disabled={isGeneratingPdf}
                className="px-2 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-xs flex items-center gap-1 shadow-sm transition cursor-pointer active:scale-95"
                title="Descargar Ticket en PDF"
              >
                {isGeneratingPdf ? (
                  <div className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <IconDownload size={13} />
                )}
                <span>PDF</span>
              </button>

              {/* Combined Print Button with quick manager dropdown */}
              <div className="flex items-center bg-slate-800 rounded-xl overflow-hidden shadow-sm border border-slate-700">
                <button
                  onClick={() => handleExecutePrint()}
                  disabled={isPrinting}
                  className="px-2.5 py-1.5 hover:bg-slate-700 text-white font-black text-xs flex items-center gap-1 transition cursor-pointer active:scale-95 disabled:opacity-50"
                  title={`Imprimir ticket en ${currentDefaultPrinter?.name || "impresora predeterminada"}`}
                >
                  <IconPrinter size={13} />
                  <span>{isPrinting ? "Enviando..." : "Imprimir"}</span>
                </button>
                <button
                  onClick={() => setShowPrinterSelector(true)}
                  className="px-1.5 py-1.5 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border-l border-slate-700"
                  title="Cambiar impresora o configurar Bluetooth/Wi-Fi/USB"
                >
                  <IconSliders size={12} />
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs cursor-pointer transition"
                title="Cerrar"
              >
                ✕
              </button>
            </div>
          </div>

        {/* Quick Action Share Bar */}
        <div className="p-2 bg-slate-100 border-b border-slate-200 print:hidden grid grid-cols-2 gap-1.5 shrink-0">
          <button
            onClick={() => handleGeneratePdf(true)}
            disabled={isGeneratingPdf}
            className="py-1.5 px-2 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
            title="Compartir PDF del Ticket vía Sistema Operativo"
          >
            <IconShare size={13} />
            <span>Compartir PDF</span>
          </button>
          <button
            onClick={handleWhatsAppText}
            className="py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
            title="Enviar Comprobante por WhatsApp"
          >
            <IconWhatsApp size={13} />
            <span>WhatsApp</span>
          </button>
        </div>

        {ticketToast && (
          <div className="bg-amber-400 text-slate-950 font-black text-xs px-3 py-1.5 flex items-center justify-between animate-pop">
            <span>{ticketToast}</span>
            <button onClick={() => setTicketToast(null)} className="font-bold">✕</button>
          </div>
        )}

        {/* Printable Ticket Body */}
        <div className="p-5 overflow-y-auto bg-[#FFFDF9] font-mono text-slate-900 text-xs space-y-3.5 flex-1 min-h-0">
          {/* Header */}
          <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
            <div className="font-black text-base tracking-wider uppercase text-slate-950">
              {biz.name || "CAJAMASTER POS"}
            </div>
            {biz.address && (
              <div className="text-[10.5px] text-slate-600 font-sans">{biz.address}</div>
            )}
            {biz.phone && (
              <div className="text-[10.5px] text-slate-600 font-sans">Tel: {biz.phone}</div>
            )}
            <div className="text-[10px] text-slate-500 font-sans pt-1 font-semibold">
              Ticket #{sale.ticketNumber || String(sale.id).slice(-4)} • {formattedDate}
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-2 border-b border-dashed border-slate-300 pb-3">
            <div className="flex justify-between font-bold text-[10px] text-slate-500 uppercase tracking-wider">
              <span>Cant. / Descripción</span>
              <span>Importe</span>
            </div>

            {sale.items.map((it, idx) => (
              <div key={idx} className="flex justify-between items-start text-xs leading-tight">
                <div className="flex-1 pr-2">
                  <div className="font-extrabold text-slate-900">{it.name}</div>
                  <div className="text-[10.5px] text-slate-500 font-sans">
                    {it.qty} {it.unit || "u"} x {formatCurrency(it.price, "CUP", state.rates)}
                  </div>
                </div>
                <div className="font-black text-slate-900 whitespace-nowrap">
                  {formatCurrency(it.qty * it.price, "CUP", state.rates)}
                </div>
              </div>
            ))}
          </div>

          {/* Totals Calculation */}
          <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Subtotal:</span>
              <span>{formatCurrency(sale.subtotal || sale.total, "CUP", state.rates)}</span>
            </div>

            {sale.discount > 0 && (
              <div className="flex justify-between text-xs text-rose-600 font-bold">
                <span>Descuento:</span>
                <span>-{formatCurrency(sale.discount, "CUP", state.rates)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-black text-slate-950 pt-1">
              <span>TOTAL PAGADO:</span>
              <span className="text-base text-slate-950">{formatCurrency(sale.total, "CUP", state.rates)}</span>
            </div>

            {/* Method of payment */}
            <div className="flex justify-between items-center text-[11px] text-slate-600 font-sans pt-1">
              <span>Método de pago:</span>
              <span className="font-bold uppercase text-slate-800 flex items-center gap-1.5">
                <span>
                  {sale.paymentMethod === "cash"
                    ? "EFECTIVO"
                    : sale.paymentMethod === "transfermovil"
                    ? "TRANSFERMÓVIL"
                    : sale.paymentMethod === "enzona"
                    ? "ENZONA"
                    : sale.paymentMethod === "transfer"
                    ? "TRANSFERMÓVIL"
                    : sale.paymentMethod === "mixed"
                    ? "MIXTO"
                    : String(sale.paymentMethod).toUpperCase()}
                </span>
                {/* Status indicator tag */}
                {(sale.paymentStatus || sale.estado_pago) && (
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.2 rounded-md ${
                      (sale.paymentStatus === "COMPLETADO" || sale.estado_pago === "COMPLETADO")
                        ? "bg-emerald-100 text-emerald-800"
                        : (sale.paymentStatus === "PENDIENTE" || sale.estado_pago === "PENDIENTE")
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {(sale.paymentStatus || sale.estado_pago) === "COMPLETADO"
                      ? "COMPLETADO"
                      : (sale.paymentStatus || sale.estado_pago) === "PENDIENTE"
                      ? "PENDIENTE"
                      : "FALLIDO"}
                  </span>
                )}
              </span>
            </div>

            {/* Gateway transaction reference code if present */}
            {sale.gatewayReference && (
              <div className="flex justify-between text-[10px] text-slate-500 font-sans">
                <span>Referencia / Op:</span>
                <span className="font-mono text-[9.5px] font-bold text-slate-700">
                  {sale.gatewayReference}
                </span>
              </div>
            )}

            {/* Multi-currency equivalent for customer transparency */}
            <div className="flex justify-between text-[10.5px] text-slate-500 font-sans pt-0.5">
              <span>Equiv. en USD:</span>
              <span>{formatCurrency(sale.total, "USD", state.rates)}</span>
            </div>
            <div className="flex justify-between text-[10.5px] text-slate-500 font-sans">
              <span>Equiv. en EUR:</span>
              <span>{formatCurrency(sale.total, "EUR", state.rates)}</span>
            </div>

            {sale.cashPaid !== undefined && sale.cashPaid > 0 && (
              <div className="pt-2 border-t border-slate-200 mt-2 space-y-1">
                <div className="flex justify-between text-xs text-slate-700">
                  <span>Efectivo Entregado:</span>
                  <span>{formatCurrency(sale.cashPaid, "CUP", state.rates)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-emerald-700">
                  <span>Cambio devuelto:</span>
                  <span className="font-black">{formatCurrency(sale.change || 0, "CUP", state.rates)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Message */}
          <div className="text-center text-[10.5px] text-slate-500 font-sans space-y-1 pt-1">
            <div className="font-bold text-slate-800">
              {biz.footerMessage || "¡Gracias por su compra!"}
            </div>
            <div className="text-[9.5px]">Conservar este ticket para cualquier reclamación</div>
          </div>
        </div>

        {/* Action Button on bottom */}
        <div className="p-3 bg-white border-t border-slate-200 print:hidden shrink-0">
          <button
            id="btn-close-receipt-modal"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md active:scale-95"
          >
            <IconCheck size={16} className="text-amber-400" /> Nueva Venta / Listo
          </button>
        </div>
      </motion.div>
    </motion.div>

    {/* Dynamic Printer Selector Modal */}
    <PrinterSelectionModal
      isOpen={showPrinterSelector}
      onClose={() => setShowPrinterSelector(false)}
      onSelectAndPrint={(selectedPrinter) => {
        handleExecutePrint(selectedPrinter);
      }}
      title="Seleccionar Impresora para Ticket"
      subtitle={`Venta #${sale.ticketNumber || String(sale.id).slice(-4)} - ${formatCurrency(sale.total, "CUP", state.rates)}`}
    />
  </>
  );
}
