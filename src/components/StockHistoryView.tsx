import React, { useState, useMemo } from "react";
import type { Movement, Product, BusinessInfo, ExchangeRates, MovementType } from "../types";
import {
  IconSearch,
  IconCalendar,
  IconFilter,
  IconPlus,
  IconArrowUp,
  IconArrowDown,
  IconHistory,
  IconReceipt,
  IconFileSpreadsheet,
  IconDownload,
  IconPackage,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconChevronDown,
} from "./Icons";
import { formatCurrency } from "../utils/currency";
import { StockMovementModal } from "./StockMovementModal";
import { StockMovementDetailModal } from "./StockMovementDetailModal";
import { downloadOrShareKardexCsv } from "../utils/csvExport";
import { generateKardexPdf } from "../utils/pdfExport";

interface StockHistoryViewProps {
  movements: Movement[];
  products: Product[];
  business: BusinessInfo;
  rates: ExchangeRates;
  onViewReceipt?: (saleId: string) => void;
  onBackToInventory?: () => void;
}

type DateRangePreset = "today" | "7days" | "month" | "all" | "custom";
type FilterType = "ALL" | "ENTRY" | "SALE" | "LOSS" | "ADJUST";

export const StockHistoryView: React.FC<StockHistoryViewProps> = ({
  movements,
  products,
  business,
  rates,
  onViewReceipt,
  onBackToInventory,
}) => {
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<FilterType>("ALL");
  const [datePreset, setDatePreset] = useState<DateRangePreset>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);

  // Modals
  const [showNewMovementModal, setShowNewMovementModal] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Product Map for quick lookup
  const productMap = useMemo(() => {
    return new Map(products.map((p) => [p.id, p]));
  }, [products]);

  // Date Filtering Logic
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 86400000 - 1;

    switch (datePreset) {
      case "today":
        return { start: startOfToday, end: endOfToday, label: "Hoy" };
      case "7days": {
        const start7 = startOfToday - 6 * 86400000;
        return { start: start7, end: endOfToday, label: "Últimos 7 días" };
      }
      case "month": {
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        return { start: startMonth, end: endOfToday, label: "Este mes" };
      }
      case "custom": {
        let start = 0;
        let end = Infinity;
        if (customStartDate) {
          const s = new Date(customStartDate + "T00:00:00");
          start = s.getTime();
        }
        if (customEndDate) {
          const e = new Date(customEndDate + "T23:59:59");
          end = e.getTime();
        }
        const label =
          customStartDate && customEndDate
            ? `${customStartDate} al ${customEndDate}`
            : customStartDate
            ? `Desde ${customStartDate}`
            : customEndDate
            ? `Hasta ${customEndDate}`
            : "Personalizado";
        return { start, end, label };
      }
      case "all":
      default:
        return { start: 0, end: Infinity, label: "Todo el historial" };
    }
  }, [datePreset, customStartDate, customEndDate]);

  // Filtered Movements
  const filteredMovements = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return movements.filter((m) => {
      // Date Check
      if (m.ts < dateRangeBounds.start || m.ts > dateRangeBounds.end) {
        return false;
      }

      // Type Check
      if (selectedType === "ENTRY") {
        if (m.type !== "ENTRY" && m.type !== "INITIAL" && m.type !== "RETURN") return false;
      } else if (selectedType === "SALE") {
        if (m.type !== "SALE") return false;
      } else if (selectedType === "LOSS") {
        if (m.type !== "LOSS") return false;
      } else if (selectedType === "ADJUST") {
        if (m.type !== "ADJUST" && m.type !== "PHYSICAL_COUNT") return false;
      }

      // Text Search
      if (q) {
        const prod = productMap.get(m.productId);
        const name = (m.productName || prod?.name || "").toLowerCase();
        const sku = (prod?.barcode || prod?.sku || "").toLowerCase();
        const cat = (m.productCategory || prod?.category || "").toLowerCase();
        const reason = (m.reason || "").toLowerCase();
        const notes = (m.notes || "").toLowerCase();
        const user = (m.user || "").toLowerCase();
        const ticket = m.ticketNumber ? `ticket #${m.ticketNumber}` : "";

        const match =
          name.includes(q) ||
          sku.includes(q) ||
          cat.includes(q) ||
          reason.includes(q) ||
          notes.includes(q) ||
          user.includes(q) ||
          ticket.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [movements, dateRangeBounds, selectedType, searchTerm, productMap]);

  // KPI Summary
  const kpiStats = useMemo(() => {
    let entriesQty = 0;
    let entriesCost = 0;
    let salesQty = 0;
    let salesCost = 0;
    let lossQty = 0;
    let lossCost = 0;
    let adjustOps = 0;

    filteredMovements.forEach((m) => {
      const cost = m.totalCost !== undefined ? m.totalCost : m.qty * (m.unitCost || 0);
      if (m.type === "ENTRY" || m.type === "INITIAL" || m.type === "RETURN") {
        entriesQty += m.qty;
        entriesCost += cost;
      } else if (m.type === "SALE") {
        salesQty += m.qty;
        salesCost += cost;
      } else if (m.type === "LOSS") {
        lossQty += m.qty;
        lossCost += cost;
      } else {
        adjustOps += 1;
      }
    });

    return {
      entriesQty,
      entriesCost,
      salesQty,
      salesCost,
      lossQty,
      lossCost,
      adjustOps,
      totalMovements: filteredMovements.length,
    };
  }, [filteredMovements]);

  // Export handlers
  const handleExportCsv = async () => {
    if (filteredMovements.length === 0) {
      showToast("No hay registros en el período seleccionado");
      return;
    }
    try {
      setIsExporting(true);
      const res = await downloadOrShareKardexCsv(filteredMovements, business, rates, true);
      showToast(res.method === "share" ? "Archivo compartido con éxito" : "CSV exportado a descargas");
    } catch (e) {
      console.error(e);
      showToast("Error al exportar CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (filteredMovements.length === 0) {
      showToast("No hay registros en el período seleccionado");
      return;
    }
    try {
      setIsExporting(true);
      const filterSummary = [
        selectedType !== "ALL" ? `Tipo: ${selectedType}` : "",
        searchTerm ? `Búsqueda: "${searchTerm}"` : "",
      ].filter(Boolean).join(" • ");

      const res = await generateKardexPdf(
        filteredMovements,
        business,
        rates,
        dateRangeBounds.label,
        filterSummary,
        true
      );
      showToast(res.method === "share" ? "PDF compartido con éxito" : "PDF descargado correctamente");
    } catch (e) {
      console.error(e);
      showToast("Error al generar PDF");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200 text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-amber-500/40 text-amber-300 text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-150">
          <IconCheck size={14} className="text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <IconHistory size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white leading-tight">
                  Kardex & Auditoría de Stock
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {filteredMovements.length} ops
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Trazabilidad permanente de entradas, salidas, ventas y ajustes
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowNewMovementModal(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95"
            >
              <IconPlus size={14} />
              <span>Registrar Movimiento</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isExporting || filteredMovements.length === 0}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
              title="Exportar a CSV / Excel"
            >
              <IconFileSpreadsheet size={14} className="text-emerald-400" />
              <span className="hidden sm:inline">CSV / Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting || filteredMovements.length === 0}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
              title="Exportar PDF de Auditoría"
            >
              <IconDownload size={14} className="text-amber-400" />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>

        {/* KPI Quick Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
          {/* Entradas */}
          <div className="bg-slate-800/50 border border-emerald-500/20 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                <IconArrowUp size={11} /> Entradas (+)
              </span>
              <span className="text-[10px] text-slate-400">Reabastecimiento</span>
            </div>
            <div className="text-base font-extrabold text-white mt-1">
              +{kpiStats.entriesQty} u
            </div>
            <div className="text-[11px] text-emerald-400/90 font-medium">
              {formatCurrency(kpiStats.entriesCost, "CUP", rates)}
            </div>
          </div>

          {/* Ventas */}
          <div className="bg-slate-800/50 border border-blue-500/20 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider flex items-center gap-1">
                <IconReceipt size={11} /> Ventas (-)
              </span>
              <span className="text-[10px] text-slate-400">Tickets POS</span>
            </div>
            <div className="text-base font-extrabold text-white mt-1">
              -{kpiStats.salesQty} u
            </div>
            <div className="text-[11px] text-blue-400/90 font-medium">
              {formatCurrency(kpiStats.salesCost, "CUP", rates)}
            </div>
          </div>

          {/* Mermas */}
          <div className="bg-slate-800/50 border border-rose-500/20 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider flex items-center gap-1">
                <IconArrowDown size={11} /> Mermas / Bajas
              </span>
              <span className="text-[10px] text-slate-400">Roturas</span>
            </div>
            <div className="text-base font-extrabold text-white mt-1">
              -{kpiStats.lossQty} u
            </div>
            <div className="text-[11px] text-rose-400/90 font-medium">
              {formatCurrency(kpiStats.lossCost, "CUP", rates)}
            </div>
          </div>

          {/* Ajustes */}
          <div className="bg-slate-800/50 border border-purple-500/20 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider flex items-center gap-1">
                <IconPackage size={11} /> Ajustes
              </span>
              <span className="text-[10px] text-slate-400">Arqueos Z</span>
            </div>
            <div className="text-base font-extrabold text-white mt-1">
              {kpiStats.adjustOps} ops
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              Recuentos físicos
            </div>
          </div>
        </div>

        {/* Filter Toolbar (Search, Type Chips, Date Selector) */}
        <div className="space-y-3 pt-1 border-t border-slate-800">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <IconSearch
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por producto, código, ticket, motivo o usuario..."
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-9 py-2 text-xs text-white placeholder-slate-400 focus:border-amber-400 focus:outline-hidden"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <IconX size={14} />
                </button>
              )}
            </div>

            {/* Date Range Selector Trigger */}
            <button
              type="button"
              onClick={() => setShowDatePickerModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-between gap-2 transition"
            >
              <div className="flex items-center gap-2">
                <IconCalendar size={14} className="text-amber-400" />
                <span>{dateRangeBounds.label}</span>
              </div>
              <IconChevronDown size={14} className="text-slate-400" />
            </button>
          </div>

          {/* Type Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedType("ALL")}
              className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 ${
                selectedType === "ALL"
                  ? "bg-amber-400 text-slate-950 shadow-xs"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
              }`}
            >
              Todos ({movements.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedType("ENTRY")}
              className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 flex items-center gap-1 ${
                selectedType === "ENTRY"
                  ? "bg-emerald-500 text-slate-950 shadow-xs"
                  : "bg-slate-800/80 text-emerald-400 hover:bg-slate-800"
              }`}
            >
              <IconArrowUp size={12} />
              Entradas (+)
            </button>

            <button
              type="button"
              onClick={() => setSelectedType("SALE")}
              className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 flex items-center gap-1 ${
                selectedType === "SALE"
                  ? "bg-blue-500 text-slate-950 shadow-xs"
                  : "bg-slate-800/80 text-blue-400 hover:bg-slate-800"
              }`}
            >
              <IconReceipt size={12} />
              Ventas (-)
            </button>

            <button
              type="button"
              onClick={() => setSelectedType("LOSS")}
              className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 flex items-center gap-1 ${
                selectedType === "LOSS"
                  ? "bg-rose-500 text-white shadow-xs"
                  : "bg-slate-800/80 text-rose-400 hover:bg-slate-800"
              }`}
            >
              <IconArrowDown size={12} />
              Mermas / Roturas (-)
            </button>

            <button
              type="button"
              onClick={() => setSelectedType("ADJUST")}
              className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 flex items-center gap-1 ${
                selectedType === "ADJUST"
                  ? "bg-purple-500 text-white shadow-xs"
                  : "bg-slate-800/80 text-purple-400 hover:bg-slate-800"
              }`}
            >
              <IconPackage size={12} />
              Ajustes & Arqueos
            </button>
          </div>
        </div>
      </div>

      {/* Movements Table & List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-lg overflow-hidden">
        {filteredMovements.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <IconHistory size={24} />
            </div>
            <div className="text-slate-300 font-bold text-sm">
              No hay movimientos registrados
            </div>
            <p className="text-slate-500 text-xs max-w-sm mx-auto">
              No se encontraron registros para los filtros seleccionados. Realiza una venta, ingresa mercancía o ajusta el rango de fechas.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setSelectedType("ALL");
                setDatePreset("all");
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold transition mt-2"
            >
              Restablecer Filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Fecha & Hora</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">Tipo de Movimiento</th>
                  <th className="py-3 px-4 text-right">Cantidad</th>
                  <th className="py-3 px-4 text-center hidden md:table-cell">Stock Previo ➔ Resultante</th>
                  <th className="py-3 px-4 text-right hidden lg:table-cell">Costo Total</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Motivo / Usuario</th>
                  <th className="py-3 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredMovements.map((m) => {
                  const dateObj = new Date(m.ts);
                  const isEntry = m.type === "ENTRY" || m.type === "INITIAL" || m.type === "RETURN";
                  const isLoss = m.type === "LOSS";
                  const isSale = m.type === "SALE";
                  const totalCost = m.totalCost !== undefined ? m.totalCost : m.qty * (m.unitCost || 0);

                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedMovement(m)}
                      className="hover:bg-slate-800/40 transition cursor-pointer group"
                    >
                      {/* Date & Time */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-200">
                          {dateObj.toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {dateObj.toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>

                      {/* Product */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{m.productEmoji || "📦"}</span>
                          <div>
                            <div className="font-bold text-white group-hover:text-amber-300 transition">
                              {m.productName || "Producto"}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {m.productCategory || "General"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Movement Type */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            isEntry
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : isLoss
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : isSale
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isEntry
                                ? "bg-emerald-400"
                                : isLoss
                                ? "bg-rose-400"
                                : isSale
                                ? "bg-blue-400"
                                : "bg-purple-400"
                            }`}
                          />
                          {m.type === "ENTRY"
                            ? "Entrada (+)"
                            : m.type === "SALE"
                            ? m.ticketNumber ? `Venta #${m.ticketNumber}` : "Venta (-)"
                            : m.type === "LOSS"
                            ? "Merma (-)"
                            : m.type === "INITIAL"
                            ? "Inicial (+)"
                            : m.type === "PHYSICAL_COUNT"
                            ? "Arqueo Z"
                            : m.type === "RETURN"
                            ? "Devolución (+)"
                            : "Ajuste"}
                        </span>
                      </td>

                      {/* Qty Moved */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div
                          className={`font-black text-sm ${
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
                          {m.qty} {m.productUnit || "u"}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {formatCurrency(m.unitCost || 0, "CUP", rates)}/u
                        </div>
                      </td>

                      {/* Stock Transition */}
                      <td className="py-3 px-4 text-center whitespace-nowrap hidden md:table-cell">
                        {m.previousStock !== undefined && m.resultingStock !== undefined ? (
                          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] bg-slate-950/60 px-2.5 py-1 rounded-lg border border-slate-800">
                            <span className="text-slate-400">{m.previousStock}</span>
                            <span className="text-slate-600">➔</span>
                            <span
                              className={`font-bold ${
                                m.resultingStock < 5 ? "text-amber-400" : "text-emerald-400"
                              }`}
                            >
                              {m.resultingStock} {m.productUnit || "u"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      {/* Total Cost */}
                      <td className="py-3 px-4 text-right whitespace-nowrap hidden lg:table-cell">
                        <span className="font-semibold text-slate-300">
                          {formatCurrency(totalCost, "CUP", rates)}
                        </span>
                      </td>

                      {/* Reason & User */}
                      <td className="py-3 px-4 max-w-[200px] truncate hidden sm:table-cell">
                        <div className="text-slate-200 truncate font-medium">
                          {m.reason || m.notes || "-"}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          Por: {m.user || "Sistema"}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMovement(m);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 group-hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 transition"
                        >
                          Ver Detalle
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Date Range Modal */}
      {showDatePickerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowDatePickerModal(false)}
        >
          <div
            className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <IconCalendar size={18} className="text-amber-400" />
                <h3 className="font-bold text-sm text-white">Filtrar por Fecha</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDatePickerModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setDatePreset("today");
                  setShowDatePickerModal(false);
                }}
                className={`p-2.5 rounded-xl font-bold border transition ${
                  datePreset === "today"
                    ? "bg-amber-400 text-slate-950 border-amber-400"
                    : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                }`}
              >
                Hoy
              </button>

              <button
                type="button"
                onClick={() => {
                  setDatePreset("7days");
                  setShowDatePickerModal(false);
                }}
                className={`p-2.5 rounded-xl font-bold border transition ${
                  datePreset === "7days"
                    ? "bg-amber-400 text-slate-950 border-amber-400"
                    : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                }`}
              >
                Últimos 7 días
              </button>

              <button
                type="button"
                onClick={() => {
                  setDatePreset("month");
                  setShowDatePickerModal(false);
                }}
                className={`p-2.5 rounded-xl font-bold border transition ${
                  datePreset === "month"
                    ? "bg-amber-400 text-slate-950 border-amber-400"
                    : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                }`}
              >
                Este Mes
              </button>

              <button
                type="button"
                onClick={() => {
                  setDatePreset("all");
                  setShowDatePickerModal(false);
                }}
                className={`p-2.5 rounded-xl font-bold border transition ${
                  datePreset === "all"
                    ? "bg-amber-400 text-slate-950 border-amber-400"
                    : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                }`}
              >
                Todo el Historial
              </button>
            </div>

            {/* Custom Range */}
            <div className="border-t border-slate-800 pt-3 space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Rango Personalizado
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-amber-400 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Fecha Fin</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-amber-400 focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (customStartDate || customEndDate) {
                    setDatePreset("custom");
                  }
                  setShowDatePickerModal(false);
                }}
                className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-md transition"
              >
                Aplicar Rango Personalizado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Movement Modal */}
      <StockMovementModal
        isOpen={showNewMovementModal}
        onClose={() => setShowNewMovementModal(false)}
        products={products}
        onSuccess={(msg) => showToast(msg)}
      />

      {/* Movement Detail Modal */}
      <StockMovementDetailModal
        isOpen={!!selectedMovement}
        onClose={() => setSelectedMovement(null)}
        movement={selectedMovement}
        business={business}
        rates={rates}
        onViewReceipt={onViewReceipt}
      />
    </div>
  );
};
