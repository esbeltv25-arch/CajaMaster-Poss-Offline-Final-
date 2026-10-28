import React, { useState } from "react";
import type { Product, MovementType } from "../types";
import { actions } from "../store";
import {
  IconPlus,
  IconMinus,
  IconArrowUp,
  IconArrowDown,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconPackage,
  IconUser,
} from "./Icons";
import { formatCurrency } from "../utils/currency";

interface StockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  selectedProductId?: string;
  onSuccess?: (msg: string) => void;
}

const COMMON_REASONS = {
  ENTRY: [
    "Compra / Reabastecimiento de proveedor",
    "Producción interna / Elaboración",
    "Devolución de cliente",
    "Corrección de inventario (Sobrante)",
  ],
  LOSS: [
    "Merma / Producto vencido o caducado",
    "Rotura / Deterioro en almacén o tienda",
    "Consumo interno / Degustación del personal",
    "Pérdida / Extravío no justificado",
  ],
  ADJUST: [
    "Ajuste por recuento físico",
    "Corrección de descuadre",
    "Actualización de stock inicial",
  ],
  RETURN: [
    "Devolución de cliente con ticket",
    "Reingreso de producto cancelado",
  ],
};

export const StockMovementModal: React.FC<StockMovementModalProps> = ({
  isOpen,
  onClose,
  products,
  selectedProductId,
  onSuccess,
}) => {
  const [productId, setProductId] = useState(
    selectedProductId || (products.length > 0 ? products[0].id : "")
  );
  const [type, setType] = useState<MovementType>("ENTRY");
  const [qty, setQty] = useState<string>("1");
  const [reason, setReason] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [user, setUser] = useState<string>("Administrador");
  const [unitCost, setUnitCost] = useState<string>("");

  if (!isOpen) return null;

  const currentProduct = products.find((p) => p.id === productId);

  const handleProductChange = (id: string) => {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) {
      setUnitCost(p.cost > 0 ? String(p.cost) : "");
    }
  };

  const activeReasons =
    type === "ENTRY"
      ? COMMON_REASONS.ENTRY
      : type === "LOSS"
      ? COMMON_REASONS.LOSS
      : type === "RETURN"
      ? COMMON_REASONS.RETURN
      : COMMON_REASONS.ADJUST;

  const numQty = parseFloat(qty) || 0;
  const numCost = unitCost ? parseFloat(unitCost) : currentProduct?.cost || 0;

  const prevStock = currentProduct?.stock || 0;
  let resultingStock = prevStock;
  if (type === "ENTRY" || type === "INITIAL" || type === "RETURN") {
    resultingStock = prevStock + numQty;
  } else if (type === "LOSS" || type === "SALE") {
    resultingStock = Math.max(0, prevStock - numQty);
  } else if (type === "ADJUST") {
    resultingStock = Math.max(0, numQty); // in adjust mode, quantity can be explicit resulting stock
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct || numQty <= 0) return;

    const finalReason = customReason.trim() || reason || "Ajuste manual de existencias";

    actions.registerStockMovement({
      productId: currentProduct.id,
      type,
      qty: type === "ADJUST" ? numQty : numQty,
      reason: finalReason,
      notes: notes.trim() || undefined,
      user: user.trim() || "Cajero",
      unitCost: numCost > 0 ? numCost : undefined,
    });

    if (onSuccess) {
      onSuccess(
        `Movimiento registrado: ${type === "ENTRY" ? "+" : "-"}${numQty} ${currentProduct.unit} en "${currentProduct.name}"`
      );
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                type === "ENTRY" || type === "RETURN"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : type === "LOSS"
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
              }`}
            >
              {type === "ENTRY" || type === "RETURN" ? (
                <IconArrowUp size={18} />
              ) : type === "LOSS" ? (
                <IconArrowDown size={18} />
              ) : (
                <IconPackage size={18} />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Registrar Movimiento de Stock
              </h2>
              <p className="text-xs text-slate-400">
                Auditoría Kardex y trazabilidad de existencias
              </p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-sm flex-1">
          {/* Movement Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Tipo de Movimiento
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setType("ENTRY");
                  setReason(COMMON_REASONS.ENTRY[0]);
                }}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs flex flex-col items-center gap-1 border transition ${
                  type === "ENTRY"
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-xs"
                    : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span className="flex items-center gap-1">
                  <IconPlus size={14} className="text-emerald-400" />
                  Entrada (+)
                </span>
                <span className="text-[10px] font-normal text-slate-400">Compra / Reingreso</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setType("LOSS");
                  setReason(COMMON_REASONS.LOSS[0]);
                }}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs flex flex-col items-center gap-1 border transition ${
                  type === "LOSS"
                    ? "bg-rose-500/20 border-rose-500 text-rose-300 shadow-xs"
                    : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span className="flex items-center gap-1">
                  <IconMinus size={14} className="text-rose-400" />
                  Salida / Merma (-)
                </span>
                <span className="text-[10px] font-normal text-slate-400">Merma / Rotura</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setType("ADJUST");
                  setReason(COMMON_REASONS.ADJUST[0]);
                }}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs flex flex-col items-center gap-1 border transition ${
                  type === "ADJUST"
                    ? "bg-purple-500/20 border-purple-500 text-purple-300 shadow-xs"
                    : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span className="flex items-center gap-1">
                  <IconPackage size={14} className="text-purple-400" />
                  Ajuste Físico
                </span>
                <span className="text-[10px] font-normal text-slate-400">Fijar existencia</span>
              </button>
            </div>
          </div>

          {/* Product Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Producto
            </label>
            <select
              value={productId}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium focus:border-amber-400 focus:outline-hidden"
              required
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji || "📦"} {p.name} (Stock actual: {p.stock} {p.unit}) - Costo: ${p.cost.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity & Unit Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                {type === "ADJUST" ? "Nuevo Stock Total" : "Cantidad a Mover"}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="1"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-bold text-base focus:border-amber-400 focus:outline-hidden"
                  required
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">
                  {currentProduct?.unit || "u"}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Costo Unitario (CUP)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitCost || (currentProduct?.cost !== undefined ? currentProduct.cost : "")}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder={String(currentProduct?.cost || 0)}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium text-base focus:border-amber-400 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Stock Simulation Preview */}
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3.5 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="text-slate-400">Stock Previo</span>
              <div className="font-bold text-white text-sm">
                {prevStock} {currentProduct?.unit || "u"}
              </div>
            </div>
            <div className="text-center font-bold text-slate-500">➔</div>
            <div className="space-y-0.5 text-right">
              <span className="text-slate-400">Stock Resultante</span>
              <div
                className={`font-bold text-sm ${
                  resultingStock < 5 ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                {resultingStock} {currentProduct?.unit || "u"}
              </div>
            </div>
          </div>

          {/* Preset Reasons */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Motivo del Movimiento
            </label>
            <div className="space-y-1.5">
              <select
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (e.target.value !== "OTRO") {
                    setCustomReason("");
                  }
                }}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-xs focus:border-amber-400 focus:outline-hidden"
              >
                {activeReasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                <option value="OTRO">Otro motivo específico...</option>
              </select>

              {reason === "OTRO" && (
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Escribe el motivo detallado..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-xs focus:border-amber-400 focus:outline-hidden mt-1.5"
                  required
                />
              )}
            </div>
          </div>

          {/* User / Responsible & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Usuario / Responsable
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="Administrador / Cajero"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-amber-400 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Nota Adicional (Opcional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nº de factura, albarán o detalle"
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-amber-400 focus:outline-hidden"
              />
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!currentProduct || numQty <= 0}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition ${
              type === "ENTRY" || type === "RETURN"
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : type === "LOSS"
                ? "bg-rose-600 hover:bg-rose-500 text-white"
                : "bg-purple-600 hover:bg-purple-500 text-white"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <IconCheck size={15} />
            Confirmar Movimiento
          </button>
        </div>
      </div>
    </div>
  );
};
