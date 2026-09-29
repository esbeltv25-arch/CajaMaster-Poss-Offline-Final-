import React from "react";
import type { Movement, BusinessInfo, ExchangeRates } from "../types";
import {
  IconX,
  IconClock,
  IconPackage,
  IconUser,
  IconReceipt,
  IconArrowUp,
  IconArrowDown,
  IconAlertTriangle,
} from "./Icons";
import { formatCurrency } from "../utils/currency";

interface StockMovementDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  movement: Movement | null;
  business: BusinessInfo;
  rates: ExchangeRates;
  onViewReceipt?: (saleId: string) => void;
}

export const StockMovementDetailModal: React.FC<StockMovementDetailModalProps> = ({
  isOpen,
  onClose,
  movement,
  business,
  rates,
  onViewReceipt,
}) => {
  if (!isOpen || !movement) return null;

  const dateObj = new Date(movement.ts);
  const formattedDate = dateObj.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = dateObj.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const isEntry = movement.type === "ENTRY" || movement.type === "INITIAL" || movement.type === "RETURN";
  const isLoss = movement.type === "LOSS";
  const isSale = movement.type === "SALE";
  const isAdjust = movement.type === "ADJUST" || movement.type === "PHYSICAL_COUNT";

  const totalCost =
    movement.totalCost !== undefined
      ? movement.totalCost
      : movement.qty * (movement.unitCost || 0);

  const getBadgeStyle = () => {
    if (isEntry) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (isLoss) return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    if (isSale) return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    return "bg-purple-500/15 text-purple-400 border-purple-500/30";
  };

  const getTypeTitle = () => {
    switch (movement.type) {
      case "ENTRY":
        return "Entrada / Reabastecimiento (+)";
      case "SALE":
        return `Salida por Venta ${movement.ticketNumber ? `#${movement.ticketNumber}` : ""}`;
      case "LOSS":
        return "Salida por Merma / Rotura (-)";
      case "ADJUST":
        return "Ajuste Directo de Existencias";
      case "INITIAL":
        return "Alta Inicial en Catálogo";
      case "PHYSICAL_COUNT":
        return "Ajuste por Arqueo Físico (Cierre Z)";
      case "RETURN":
        return "Devolución / Reingreso (+)";
      default:
        return movement.type;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-base">
              {movement.productEmoji || "📦"}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">
                Auditoría de Movimiento
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                ID: {movement.id}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Main Indicator Card */}
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getBadgeStyle()}`}
              >
                {isEntry && <IconArrowUp size={13} />}
                {isLoss && <IconArrowDown size={13} />}
                {isSale && <IconReceipt size={13} />}
                {isAdjust && <IconPackage size={13} />}
                {getTypeTitle()}
              </span>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase">Cantidad Movida</span>
                <span
                  className={`text-lg font-black ${
                    isEntry
                      ? "text-emerald-400"
                      : isLoss
                      ? "text-rose-400"
                      : isSale
                      ? "text-blue-400"
                      : "text-purple-400"
                  }`}
                >
                  {isEntry ? "+" : isLoss || isSale ? "-" : ""}
                  {movement.qty} {movement.productUnit || "u"}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-700/60 pt-3">
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Producto</div>
              <div className="text-sm font-bold text-white mt-0.5">
                {movement.productName || "Producto"}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Categoría: {movement.productCategory || "General"}
              </div>
            </div>
          </div>

          {/* Stock Transition Metrics */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3">
              <span className="text-slate-400 text-[10px] uppercase font-semibold block">Stock Previo</span>
              <span className="text-sm font-bold text-slate-300 mt-1 block">
                {movement.previousStock !== undefined ? `${movement.previousStock} ${movement.productUnit || "u"}` : "No registrado"}
              </span>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3">
              <span className="text-slate-400 text-[10px] uppercase font-semibold block">Stock Resultante</span>
              <span className="text-sm font-bold text-emerald-400 mt-1 block">
                {movement.resultingStock !== undefined ? `${movement.resultingStock} ${movement.productUnit || "u"}` : "No registrado"}
              </span>
            </div>
          </div>

          {/* Costs & Valuation */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Costo Unitario de Adquisición</span>
              <span className="font-semibold text-white">
                {formatCurrency(movement.unitCost || 0, "CUP", rates)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-700/50 pt-1.5">
              <span className="text-slate-400">Impacto Total en Valor</span>
              <span className="font-bold text-amber-400">
                {formatCurrency(totalCost, "CUP", rates)}
              </span>
            </div>
          </div>

          {/* Audit Metadata (User, Motive, Time) */}
          <div className="space-y-2 bg-slate-800/30 rounded-xl p-3.5 border border-slate-800">
            <div className="flex items-start justify-between gap-2">
              <span className="text-slate-400 flex items-center gap-1.5 min-w-[70px]">
                <IconUser size={13} className="text-slate-500" />
                Responsable:
              </span>
              <span className="font-semibold text-slate-200 text-right">
                {movement.user || "Sistema POS"}
              </span>
            </div>

            <div className="flex items-start justify-between gap-2 border-t border-slate-800 pt-1.5">
              <span className="text-slate-400 flex items-center gap-1.5 min-w-[70px]">
                <IconClock size={13} className="text-slate-500" />
                Fecha & Hora:
              </span>
              <span className="text-slate-300 text-right capitalize">
                {formattedDate} • {formattedTime}
              </span>
            </div>

            <div className="border-t border-slate-800 pt-1.5">
              <span className="text-slate-400 block font-semibold mb-0.5">Motivo / Razón:</span>
              <p className="text-slate-200 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80 leading-relaxed text-[11px]">
                {movement.reason || movement.notes || "Sin motivo registrado"}
              </p>
            </div>

            {movement.notes && movement.notes !== movement.reason && (
              <div className="border-t border-slate-800 pt-1.5">
                <span className="text-slate-400 block font-semibold mb-0.5">Nota adicional:</span>
                <p className="text-slate-300 text-[11px] italic">
                  {movement.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          {movement.saleId && onViewReceipt ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewReceipt(movement.saleId!);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-blue-500/30 flex items-center gap-1.5 transition"
            >
              <IconReceipt size={14} />
              Ver Comprobante Ticket
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition ml-auto"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
