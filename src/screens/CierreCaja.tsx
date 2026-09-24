import { useState, useMemo } from "react";
import { useStore, actions } from "../store";
import { TopBar } from "../components/Layout";
import {
  IconClipboardCheck,
  IconCoins,
  IconCheck,
  IconPrinter,
  IconAlert,
  IconCalendar,
  IconReceipt,
  IconBox,
  IconWhatsApp,
  IconMail,
  IconCopy,
  IconShare,
  IconSend,
  IconDownload,
  IconSliders,
  IconFileSpreadsheet,
} from "../components/Icons";
import { formatCurrency } from "../utils/currency";
import type { DailyClosing, PhysicalCountItem, BusinessInfo, ExchangeRates, PrinterDevice } from "../types";
import { generateZReportPdf } from "../utils/pdfExport";
import {
  downloadOrShareDailyClosingCsv,
  downloadOrShareAllClosingsCsv,
} from "../utils/csvExport";
import {
  printZReportTicket,
  getDefaultPrinter,
  getPrinterSettings,
} from "../services/printerService";
import { PrinterSelectionModal } from "../components/PrinterSelectionModal";

export function generateZReportShareText(
  closing: DailyClosing,
  biz: BusinessInfo,
  rates: ExchangeRates
): string {
  const dateStr = closing.date;
  const timeStr = new Date(closing.closedAt).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const bizName = biz.name || "ESTABLECIMIENTO COMERCIAL";

  let statusText = "✅ Caja Cuadrada Perfecta (0.00 CUP)";
  if (closing.cashDiscrepancy > 0) {
    statusText = `🔵 Sobrante en Caja: +${closing.cashDiscrepancy.toFixed(2)} CUP`;
  } else if (closing.cashDiscrepancy < 0) {
    statusText = `🔴 Faltante en Caja: ${closing.cashDiscrepancy.toFixed(2)} CUP`;
  }

  const lines = [
    `📊 *INFORME Z - CIERRE DIARIO*`,
    `🏢 *${bizName.toUpperCase()}*`,
    biz.owner ? `👤 Responsable: ${biz.owner}` : "",
    biz.phone ? `📞 Tel: ${biz.phone}` : "",
    biz.address ? `📍 Dirección: ${biz.address}` : "",
    `📅 Fecha: ${dateStr} • ⏰ Hora: ${timeStr}`,
    `--------------------------------`,
    `💰 *BALANCE DE VENTAS Y CAJA:*`,
    `• Fondo Inicial: ${closing.openingCash.toFixed(2)} CUP`,
    `• Ventas en Efectivo: ${closing.cashSales.toFixed(2)} CUP`,
    `• Ventas por Transferencia: ${closing.transferSales.toFixed(2)} CUP`,
    `• 💵 *TOTAL VENTAS:* ${closing.totalSales.toFixed(2)} CUP`,
    `• 🧾 Tickets Emitidos: ${closing.totalTickets}`,
    `• 💵 Efectivo Físico Contado: ${closing.countedCash.toFixed(2)} CUP`,
    `• ${statusText}`,
    `--------------------------------`,
    `📦 *BALANCE FÍSICO DE INVENTARIO:*`,
    `• Total Unidades Contadas: ${closing.inventoryUnitsCounted} u`,
    `• Valoración a Costo: ${closing.inventoryTotalCost.toFixed(2)} CUP`,
    `• Valoración a Venta: ${closing.inventoryTotalValue.toFixed(2)} CUP`,
  ];

  if (closing.notes) {
    lines.push(`--------------------------------`);
    lines.push(`📝 *Observaciones:* ${closing.notes}`);
  }

  lines.push(`--------------------------------`);
  lines.push(`Emitido con CajaMaster Pro POS 📱`);

  return lines.filter(Boolean).join("\n");
}

export function CierreCajaScreen() {
  const state = useStore();

  const [openingCash, setOpeningCash] = useState<number>(1000); // Fondo de caja inicial sugerido
  const [countedCash, setCountedCash] = useState<number | "">("");
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    state.products.forEach((p) => {
      map[p.id] = p.stock;
    });
    return map;
  });
  const [notes, setNotes] = useState("");
  const [lastClosing, setLastClosing] = useState<DailyClosing | null>(null);
  const [selectedHistoricalClosing, setSelectedHistoricalClosing] = useState<DailyClosing | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Today's Sales Calculation
  const startOfDay = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }, []);

  const todaySales = useMemo(() => {
    return state.sales.filter((s) => s.ts >= startOfDay);
  }, [state.sales, startOfDay]);

  const cashSalesTotal = useMemo(() => {
    return todaySales
      .filter((s) => s.paymentMethod === "cash" || s.paymentMethod === "mixed")
      .reduce((a, b) => a + b.total, 0);
  }, [todaySales]);

  const transferSalesTotal = useMemo(() => {
    return todaySales
      .filter(
        (s) =>
          s.paymentMethod === "transfer" ||
          s.paymentMethod === "transfermovil" ||
          s.paymentMethod === "enzona"
      )
      .reduce((a, b) => a + b.total, 0);
  }, [todaySales]);

  const totalSalesAmount = cashSalesTotal + transferSalesTotal;
  const expectedCashInDrawer = openingCash + cashSalesTotal;

  const realCountedNum = typeof countedCash === "number" ? countedCash : 0;
  const cashDiscrepancy = realCountedNum - expectedCashInDrawer;

  // Physical Inventory Metrics
  const countItems: PhysicalCountItem[] = useMemo(() => {
    return state.products.map((p) => {
      const physical = physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : p.stock;
      return {
        productId: p.id,
        name: p.name,
        unit: p.unit,
        systemStock: p.stock,
        physicalStock: physical,
        discrepancy: physical - p.stock,
        cost: p.cost,
        price: p.price,
      };
    });
  }, [state.products, physicalCounts]);

  const totalPhysicalUnits = countItems.reduce((a, b) => a + b.physicalStock, 0);
  const totalPhysicalCost = countItems.reduce((a, b) => a + b.physicalStock * b.cost, 0);
  const totalPhysicalValue = countItems.reduce((a, b) => a + b.physicalStock * b.price, 0);

  const handleUpdateCount = (productId: string, val: number) => {
    setPhysicalCounts((prev) => ({
      ...prev,
      [productId]: Math.max(0, val),
    }));
  };

  const handleRegisterClosing = () => {
    const closing = actions.registerDailyClosing({
      date: new Date().toISOString().slice(0, 10),
      openingCash,
      cashSales: cashSalesTotal,
      transferSales: transferSalesTotal,
      totalSales: totalSalesAmount,
      totalTickets: todaySales.length,
      countedCash: realCountedNum || expectedCashInDrawer,
      cashDiscrepancy: countedCash === "" ? 0 : cashDiscrepancy,
      inventoryUnitsCounted: totalPhysicalUnits,
      inventoryTotalCost: totalPhysicalCost,
      inventoryTotalValue: totalPhysicalValue,
      counts: countItems,
      notes: notes.trim() || undefined,
    });

    setLastClosing(closing);
  };

  const handleQuickWhatsApp = (c: DailyClosing) => {
    const text = generateZReportShareText(c, state.business, state.rates);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleQuickEmail = (c: DailyClosing) => {
    const text = generateZReportShareText(c, state.business, state.rates);
    const subject = `Cierre de Caja Z - ${c.date} - ${state.business.name || "Mi Negocio"}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  };

  const handleQuickCopy = (c: DailyClosing) => {
    const text = generateZReportShareText(c, state.business, state.rates);
    navigator.clipboard.writeText(text);
    setCopyToast("¡Informe Z copiado al portapapeles!");
    setTimeout(() => setCopyToast(null), 3000);
  };

  const handleExportAllClosingsCsv = async (preferShare = false) => {
    if (!state.closings || state.closings.length === 0) {
      setCopyToast("No hay cierres registrados para exportar.");
      setTimeout(() => setCopyToast(null), 3000);
      return;
    }
    try {
      const res = await downloadOrShareAllClosingsCsv(
        state.closings,
        state.business,
        state.rates,
        preferShare
      );
      if (res.method === "share" && res.success) {
        setCopyToast("¡Historial de cierres compartido!");
      } else if (res.method === "download" && res.success) {
        setCopyToast("Historial de cierres descargado en CSV.");
      }
    } catch (err) {
      console.error("Error exporting closings CSV:", err);
      setCopyToast("Error al exportar cierres a CSV.");
    } finally {
      setTimeout(() => setCopyToast(null), 3000);
    }
  };

  const handleExportSingleClosingCsv = async (c: DailyClosing, preferShare = false) => {
    try {
      const res = await downloadOrShareDailyClosingCsv(
        c,
        state.business,
        state.rates,
        preferShare
      );
      if (res.method === "share" && res.success) {
        setCopyToast("¡Cierre Z compartido!");
      } else if (res.method === "download" && res.success) {
        setCopyToast("Cierre Z descargado en CSV.");
      }
    } catch (err) {
      console.error("Error exporting closing CSV:", err);
      setCopyToast("Error al exportar cierre a CSV.");
    } finally {
      setTimeout(() => setCopyToast(null), 3000);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      <TopBar
        title="Cierre de Caja & Conteo"
        subtitle="Arqueo diario y balance físico de inventario"
        right={
          state.closings && state.closings.length > 0 ? (
            <button
              onClick={() => handleExportAllClosingsCsv(false)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer border border-teal-200 shadow-2xs active:scale-95"
              title="Descargar libro de cierres de caja en formato CSV para Excel o Google Sheets"
            >
              <IconFileSpreadsheet size={14} className="text-teal-700 shrink-0" />
              <span className="hidden sm:inline">Exportar Cierres (CSV)</span>
              <span className="sm:hidden">CSV</span>
            </button>
          ) : null
        }
      />

      {copyToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl font-bold text-xs flex items-center gap-2 border border-slate-700 animate-pop">
          <IconCheck size={16} className="text-emerald-400" />
          <span>{copyToast}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 text-slate-900">
        {/* Section 1: Sales of the Day Summary */}
        <div className="rounded-3xl bg-slate-900 text-white p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconCoins size={20} className="text-amber-400" />
              <h2 className="font-extrabold text-sm uppercase tracking-wider">
                Ventas de la Jornada (Hoy)
              </h2>
            </div>
            <span className="text-xs bg-white/10 px-2.5 py-1 rounded-full font-bold">
              {todaySales.length} Tickets Emitidos
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
            <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
              <div className="text-[10px] text-slate-400 font-bold uppercase">VENTAS EN EFECTIVO</div>
              <div className="text-base font-extrabold text-white mt-0.5">
                {formatCurrency(cashSalesTotal, "CUP", state.rates)}
              </div>
            </div>

            <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
              <div className="text-[10px] text-slate-400 font-bold uppercase">TRANSFERENCIAS</div>
              <div className="text-base font-extrabold text-white mt-0.5">
                {formatCurrency(transferSalesTotal, "CUP", state.rates)}
              </div>
            </div>

            <div className="bg-amber-400/10 p-3 rounded-2xl border border-amber-400/30 col-span-2 sm:col-span-1">
              <div className="text-[10px] text-amber-300 font-bold uppercase">TOTAL GENERAL DÍA</div>
              <div className="text-base font-extrabold text-amber-400 mt-0.5">
                {formatCurrency(totalSalesAmount, "CUP", state.rates)}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Cash Drawer Reconciliation (Arqueo de Efectivo) */}
        <div className="p-5 rounded-3xl border border-slate-200 bg-slate-50 space-y-4 shadow-xs">
          <div className="flex items-center gap-2">
            <IconCoins size={18} className="text-slate-800" />
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-900">
              1. Arqueo de Efectivo en Caja
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-extrabold text-slate-500 uppercase block mb-1">
                FONDO DE CAJA INICIAL (CUP)
              </label>
              <div className="neu-inset rounded-2xl px-3.5 h-12 flex items-center gap-1.5">
                <span className="text-slate-400 font-bold text-sm">$</span>
                <input
                  type="number"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(parseFloat(e.target.value || "0"))}
                  className="flex-1 bg-transparent outline-none font-extrabold text-base text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-extrabold text-slate-500 uppercase block mb-1">
                EFECTIVO FÍSICO CONTADO EN CAJA (CUP)
              </label>
              <div className="neu-inset rounded-2xl px-3.5 h-12 flex items-center gap-1.5">
                <span className="text-slate-400 font-bold text-sm">$</span>
                <input
                  type="number"
                  value={countedCash}
                  onChange={(e) =>
                    setCountedCash(e.target.value === "" ? "" : parseFloat(e.target.value))
                  }
                  placeholder={String(expectedCashInDrawer)}
                  className="flex-1 bg-transparent outline-none font-extrabold text-base text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Cash Balance Box */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500 font-bold">
                Efectivo Teórico Esperado (Fondo + Ventas):
              </div>
              <div className="text-base font-extrabold text-slate-900">
                {formatCurrency(expectedCashInDrawer, "CUP", state.rates)}
              </div>
            </div>

            {countedCash !== "" && (
              <div
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 ${
                  cashDiscrepancy === 0
                    ? "bg-emerald-100 text-emerald-900"
                    : cashDiscrepancy > 0
                    ? "bg-blue-100 text-blue-900"
                    : "bg-rose-100 text-rose-900"
                }`}
              >
                {cashDiscrepancy === 0 ? (
                  <>
                    <IconCheck size={16} className="text-emerald-700" /> Caja Cuadrada Perfecta
                  </>
                ) : cashDiscrepancy > 0 ? (
                  `Sobrante en Caja: +${formatCurrency(cashDiscrepancy, "CUP", state.rates)}`
                ) : (
                  `Faltante en Caja: ${formatCurrency(cashDiscrepancy, "CUP", state.rates)}`
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Physical Inventory Count (Conteo Físico) */}
        <div className="p-5 rounded-3xl border border-slate-200 bg-slate-50 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconBox size={18} className="text-slate-800" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-900">
                2. Conteo Físico de Inventario
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-bold">
              {state.products.length} Líneas de Producto
            </span>
          </div>

          {/* Physical Inventory Valuation Metrics */}
          <div className="grid grid-cols-3 gap-2.5 text-center bg-slate-900 text-white p-4 rounded-2xl">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">TOTAL UNIDADES</div>
              <div className="text-base font-extrabold text-amber-400">{totalPhysicalUnits}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">VALOR A COSTO</div>
              <div className="text-xs md:text-sm font-extrabold text-white">
                {formatCurrency(totalPhysicalCost, "CUP", state.rates)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">VALOR A VENTA</div>
              <div className="text-xs md:text-sm font-extrabold text-white">
                {formatCurrency(totalPhysicalValue, "CUP", state.rates)}
              </div>
            </div>
          </div>

          {/* Table of Counts */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {countItems.map((it) => (
              <div
                key={it.productId}
                className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-xs text-slate-900 truncate">
                    {it.name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Stock Sistema: <span className="font-bold">{it.systemStock} {it.unit}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-500 font-bold">Conteo:</span>
                    <input
                      type="number"
                      value={it.physicalStock}
                      onChange={(e) =>
                        handleUpdateCount(
                          it.productId,
                          parseInt(e.target.value || "0", 10)
                        )
                      }
                      className="w-16 h-9 rounded-xl border border-slate-300 text-center font-extrabold text-sm outline-none bg-slate-50 focus:bg-white"
                    />
                    <span className="text-xs text-slate-400 font-bold">{it.unit}</span>
                  </div>

                  {it.discrepancy !== 0 && (
                    <span
                      className={`text-[10px] font-extrabold px-2 py-1 rounded-lg ${
                        it.discrepancy > 0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {it.discrepancy > 0 ? `+${it.discrepancy}` : it.discrepancy}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Notes and Closure Action */}
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
              OBSERVACIONES DEL CIERRE DIARIO (OPCIONAL)
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Todo conforme, incidencia con lote de panes..."
              className="w-full neu-inset rounded-2xl px-4 h-12 text-xs font-semibold outline-none text-slate-800"
            />
          </div>

          <button
            onClick={handleRegisterClosing}
            className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-xl flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
          >
            <IconClipboardCheck size={20} className="text-amber-400" />
            <span>CERRAR DÍA Y REGISTRAR BALANCE Z</span>
          </button>
        </div>

        {/* Historical Closures Table */}
        {state.closings.length > 0 && (
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <IconCalendar size={16} /> Historial de Cierres Registrados
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportAllClosingsCsv(false)}
                  className="px-2.5 py-1 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-95"
                  title="Exportar todo el historial de cierres a archivo CSV compatible con Excel"
                >
                  <IconFileSpreadsheet size={13} className="text-teal-700" />
                  <span>Exportar Historial (CSV)</span>
                </button>
                <span className="text-[11px] font-bold text-slate-400">
                  {state.closings.length} {state.closings.length === 1 ? "cierre" : "cierres"}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {state.closings.map((c) => {
                const dateObj = new Date(c.closedAt);
                const timeStr = dateObj.toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={c.id}
                    className="p-4 rounded-3xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition space-y-3"
                  >
                    {/* Header: Date, Time & Balance Status Badge */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-950">
                            Cierre del {c.date}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            {timeStr}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {c.totalTickets} {c.totalTickets === 1 ? "ticket emitido" : "tickets emitidos"}
                        </div>
                      </div>

                      {/* Discrepancy Badge */}
                      <div>
                        {c.cashDiscrepancy === 0 ? (
                          <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                            <IconCheck size={12} className="text-emerald-700" />
                            <span>Cuadrada</span>
                          </span>
                        ) : c.cashDiscrepancy > 0 ? (
                          <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 inline-flex items-center gap-1">
                            <span>+{c.cashDiscrepancy.toFixed(0)} CUP Sobrante</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                            <span>{c.cashDiscrepancy.toFixed(0)} CUP Faltante</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Compact Metrics Row */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="text-[9px] font-extrabold text-slate-400 uppercase">VENTAS TOTAL</div>
                        <div className="font-mono font-black text-slate-900 mt-0.5 text-xs sm:text-sm">
                          {formatCurrency(c.totalSales, "CUP", state.rates)}
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="text-[9px] font-extrabold text-slate-400 uppercase">EFECTIVO CONTADO</div>
                        <div className="font-mono font-bold text-slate-800 mt-0.5 text-xs sm:text-sm">
                          {formatCurrency(c.countedCash, "CUP", state.rates)}
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="text-[9px] font-extrabold text-slate-400 uppercase">UNIDADES STOCK</div>
                        <div className="font-mono font-bold text-slate-800 mt-0.5 text-xs sm:text-sm">
                          {c.inventoryUnitsCounted} u
                        </div>
                      </div>
                    </div>

                    {/* Actions Toolbar: Primary "Ver Z-Report" + Quick Share Buttons */}
                    <div className="pt-1 flex items-center justify-between gap-2">
                      {/* Primary Z-Report View Button */}
                      <button
                        onClick={() => setSelectedHistoricalClosing(c)}
                        className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-98"
                      >
                        <IconReceipt size={14} className="text-amber-400" />
                        <span>Ver Z-Report</span>
                      </button>

                      {/* Quick Digital Dispatch Tools: Compact, elegant icon buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleExportSingleClosingCsv(c)}
                          className="w-8.5 h-8.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 flex items-center justify-center cursor-pointer transition active:scale-95 shadow-2xs"
                          title="Descargar este Cierre Z en CSV para Excel o Google Sheets"
                          aria-label="Exportar CSV"
                        >
                          <IconFileSpreadsheet size={15} className="text-teal-700" />
                        </button>

                        <button
                          onClick={() => handleQuickWhatsApp(c)}
                          className="w-8.5 h-8.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center cursor-pointer transition active:scale-95 shadow-2xs"
                          title="Enviar resumen por WhatsApp"
                          aria-label="WhatsApp"
                        >
                          <IconWhatsApp size={15} className="text-emerald-700" />
                        </button>

                        <button
                          onClick={() => handleQuickEmail(c)}
                          className="w-8.5 h-8.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 flex items-center justify-center cursor-pointer transition active:scale-95 shadow-2xs"
                          title="Enviar resumen por Correo Electrónico"
                          aria-label="Email"
                        >
                          <IconMail size={15} className="text-blue-700" />
                        </button>

                        <button
                          onClick={() => handleQuickCopy(c)}
                          className="w-8.5 h-8.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center cursor-pointer transition active:scale-95 shadow-2xs"
                          title="Copiar texto al portapapeles"
                          aria-label="Copiar"
                        >
                          <IconCopy size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Printable and Digitally Shareable Z-Report Modal for Today or Historic Closing */}
      {(lastClosing || selectedHistoricalClosing) && (
        <ZReportModal
          closing={lastClosing || selectedHistoricalClosing!}
          onClose={() => {
            setLastClosing(null);
            setSelectedHistoricalClosing(null);
          }}
        />
      )}
    </div>
  );
}

function ZReportModal({
  closing,
  onClose,
}: {
  closing: DailyClosing;
  onClose: () => void;
  onShareText?: (text: string) => void;
}) {
  const state = useStore();
  const biz = state.business;
  const [modalCopyToast, setModalCopyToast] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showPrinterSelector, setShowPrinterSelector] = useState(false);
  const [pdfToast, setPdfToast] = useState<string | null>(null);

  const reportText = useMemo(() => {
    return generateZReportShareText(closing, biz, state.rates);
  }, [closing, biz, state.rates]);

  const handleGeneratePdf = async (preferShare = false) => {
    try {
      setIsGeneratingPdf(true);
      const res = await generateZReportPdf(closing, biz, state.rates, preferShare);
      if (res.method === "share" && res.success) {
        setPdfToast("¡Informe Z compartido!");
      } else if (res.method === "download" && res.success) {
        setPdfToast("Informe Z guardado en PDF.");
      }
    } catch (err) {
      console.error("Error generating Z PDF:", err);
      setPdfToast("Error al compilar PDF.");
    } finally {
      setIsGeneratingPdf(false);
      setTimeout(() => setPdfToast(null), 3000);
    }
  };

  const handleExportCsv = async (preferShare = false) => {
    try {
      setIsExportingCsv(true);
      const res = await downloadOrShareDailyClosingCsv(
        closing,
        biz,
        state.rates,
        preferShare
      );
      if (res.method === "share" && res.success) {
        setPdfToast("¡Informe Z (CSV) compartido!");
      } else if (res.method === "download" && res.success) {
        setPdfToast("Informe Z descargado en CSV (para Excel o Google Sheets).");
      }
    } catch (err) {
      console.error("Error exporting Z CSV:", err);
      setPdfToast("Error al exportar a CSV.");
    } finally {
      setIsExportingCsv(false);
      setTimeout(() => setPdfToast(null), 3000);
    }
  };

  const handleExecutePrint = async (printer?: PrinterDevice) => {
    const settings = getPrinterSettings();
    const target = printer || getDefaultPrinter();

    if (!target && settings.autoOpenSelectorIfNoDefault) {
      setShowPrinterSelector(true);
      return;
    }

    try {
      setIsPrinting(true);
      const res = await printZReportTicket(closing, biz, state.rates, target);
      setPdfToast(res.message);
    } catch (err: any) {
      console.warn("Print Z-report error:", err);
      setPdfToast(err.message || "Error al procesar la impresión.");
    } finally {
      setIsPrinting(false);
      setTimeout(() => setPdfToast(null), 3500);
    }
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(reportText)}`, "_blank");
  };

  const handleEmail = () => {
    const subject = `Cierre de Caja Z - ${closing.date} - ${biz.name || "Mi Negocio"}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(reportText)}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setModalCopyToast(true);
    setTimeout(() => setModalCopyToast(false), 2500);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Informe Z Cierre Diario - ${closing.date}`,
          text: reportText,
        });
      } catch {}
    } else {
      handleCopy();
    }
  };

  const currentDefaultPrinter = getDefaultPrinter();

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 print:p-0 print:bg-white print:static overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-black/10 flex flex-col max-h-[94vh] print:max-w-none print:shadow-none print:border-none print:rounded-none animate-pop my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Title and Close Button */}
          <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden shrink-0">
            <div className="flex items-center gap-2">
              <IconClipboardCheck size={18} className="text-amber-400" />
              <span className="font-extrabold text-xs">Comprobante Z - Cierre Diario</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleGeneratePdf(false)}
                disabled={isGeneratingPdf}
                className="px-2.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-extrabold text-xs flex items-center gap-1 shadow-xs cursor-pointer transition active:scale-95"
                title="Generar y descargar archivo PDF"
              >
                {isGeneratingPdf ? (
                  <div className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <IconDownload size={13} />
                )}
                <span>PDF</span>
              </button>

              <button
                onClick={() => handleExportCsv(false)}
                disabled={isExportingCsv}
                className="px-2.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs flex items-center gap-1 shadow-xs cursor-pointer transition active:scale-95"
                title="Descargar este Cierre Z en formato CSV para Excel o Google Sheets"
              >
                {isExportingCsv ? (
                  <div className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <IconFileSpreadsheet size={13} />
                )}
                <span>CSV</span>
              </button>

              <div className="flex items-center bg-slate-800 rounded-xl overflow-hidden shadow-xs border border-slate-700">
                <button
                  onClick={() => handleExecutePrint()}
                  disabled={isPrinting}
                  className="px-2.5 py-1.5 hover:bg-slate-700 text-white font-extrabold text-xs flex items-center gap-1 cursor-pointer transition active:scale-95 disabled:opacity-50"
                  title={`Imprimir informe Z en ${currentDefaultPrinter?.name || "impresora predeterminada"}`}
                >
                  <IconPrinter size={13} />
                  <span className="hidden sm:inline">{isPrinting ? "Enviando..." : "Imprimir"}</span>
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
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold cursor-pointer transition"
              >
                ✕
              </button>
            </div>
          </div>

        {/* Digital Sharing Bar (PDF, CSV, WhatsApp, Email, Copy) */}
        <div className="p-2 bg-slate-100 border-b border-slate-200 print:hidden grid grid-cols-5 gap-1 shrink-0">
          <button
            onClick={() => handleGeneratePdf(true)}
            disabled={isGeneratingPdf}
            className="py-2 px-1 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
            title="Compartir PDF vía sistema operativo"
          >
            <IconShare size={12} />
            <span className="hidden xs:inline">PDF</span>
            <span className="xs:hidden">PDF</span>
          </button>

          <button
            onClick={() => handleExportCsv(true)}
            disabled={isExportingCsv}
            className="py-2 px-1 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
            title="Compartir o descargar archivo CSV para Excel"
          >
            <IconFileSpreadsheet size={12} />
            <span>CSV</span>
          </button>

          <button
            onClick={handleWhatsApp}
            className="py-2 px-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
            title="Enviar texto por WhatsApp"
          >
            <IconWhatsApp size={12} />
            <span className="hidden sm:inline">WhatsApp</span>
            <span className="sm:hidden">WApp</span>
          </button>

          <button
            onClick={handleEmail}
            className="py-2 px-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
            title="Enviar por Correo Electrónico"
          >
            <IconMail size={12} />
            <span>Email</span>
          </button>

          <button
            onClick={handleCopy}
            className="py-2 px-1 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-extrabold text-[11px] flex items-center justify-center gap-1 border border-slate-300 transition active:scale-95 cursor-pointer"
            title="Copiar texto para pegar en cualquier app"
          >
            {modalCopyToast ? (
              <>
                <IconCheck size={12} className="text-emerald-600" />
                <span className="text-emerald-700 font-bold text-[10px]">¡Copiado!</span>
              </>
            ) : (
              <>
                <IconCopy size={12} />
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>

        {pdfToast && (
          <div className="bg-amber-400 text-slate-950 font-black text-xs px-3 py-1.5 flex items-center justify-between animate-pop">
            <span>{pdfToast}</span>
            <button onClick={() => setPdfToast(null)} className="font-bold">✕</button>
          </div>
        )}

        {/* Printable Ticket Receipt Area */}
        <div className="p-5 md:p-6 overflow-y-auto bg-[#FFFDF9] font-mono text-slate-900 text-xs space-y-4">
          <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
            <div className="font-extrabold text-base tracking-wider uppercase text-slate-950">
              {biz.name || "CAJAMASTER POS"}
            </div>
            <div className="font-bold text-xs text-slate-700">
              INFORME Z DE CIERRE DIARIO
            </div>
            <div className="text-[10px] text-slate-500 font-sans">
              Fecha: {closing.date} • Hora: {new Date(closing.closedAt).toLocaleTimeString("es-ES")}
            </div>
            {biz.owner && (
              <div className="text-[10px] text-slate-500 font-sans">
                Responsable: {biz.owner}
              </div>
            )}
            {biz.phone && (
              <div className="text-[10px] text-slate-500 font-sans">
                Tel: {biz.phone}
              </div>
            )}
          </div>

          <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 text-xs">
            <div className="font-bold text-slate-800 mb-1">BALANCE DE CAJA:</div>
            <div className="flex justify-between">
              <span>Fondo Inicial:</span>
              <span>{formatCurrency(closing.openingCash, "CUP", state.rates)}</span>
            </div>
            <div className="flex justify-between">
              <span>Ventas en Efectivo:</span>
              <span>{formatCurrency(closing.cashSales, "CUP", state.rates)}</span>
            </div>
            <div className="flex justify-between">
              <span>Ventas por Transferencia:</span>
              <span>{formatCurrency(closing.transferSales, "CUP", state.rates)}</span>
            </div>
            <div className="flex justify-between font-extrabold pt-1 border-t border-slate-200">
              <span>TOTAL VENTAS DEL DÍA:</span>
              <span>{formatCurrency(closing.totalSales, "CUP", state.rates)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tickets Emitidos:</span>
              <span>{closing.totalTickets}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span>Efectivo Contado:</span>
              <span>{formatCurrency(closing.countedCash, "CUP", state.rates)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Descuadre / Diferencia:</span>
              <span className={closing.cashDiscrepancy === 0 ? "text-emerald-700" : closing.cashDiscrepancy > 0 ? "text-blue-700" : "text-rose-700"}>
                {closing.cashDiscrepancy === 0 ? "0.00 CUP" : formatCurrency(closing.cashDiscrepancy, "CUP", state.rates)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 text-xs">
            <div className="font-bold text-slate-800 mb-1">BALANCE FÍSICO DE INVENTARIO:</div>
            <div className="flex justify-between">
              <span>Unidades Físicas Contadas:</span>
              <span>{closing.inventoryUnitsCounted} u</span>
            </div>
            <div className="flex justify-between">
              <span>Valoración al Costo:</span>
              <span>{formatCurrency(closing.inventoryTotalCost, "CUP", state.rates)}</span>
            </div>
            <div className="flex justify-between font-extrabold">
              <span>Valoración a la Venta:</span>
              <span>{formatCurrency(closing.inventoryTotalValue, "CUP", state.rates)}</span>
            </div>
          </div>

          {closing.notes && (
            <div className="text-[11px] text-slate-600 italic">
              Nota: {closing.notes}
            </div>
          )}

          <div className="pt-6 grid grid-cols-2 gap-4 text-center text-[10px] text-slate-500 font-sans border-t border-dashed border-slate-300">
            <div>
              <div className="border-t border-slate-400 pt-1 mt-6">Cajero / Responsable</div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-1 mt-6">Administrador / Auditor</div>
            </div>
          </div>
        </div>

        {/* Bottom Actions Footer */}
        <div className="p-3 bg-white border-t border-slate-200 print:hidden flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleExecutePrint()}
            disabled={isPrinting}
            className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow-xs active:scale-98"
          >
            <IconPrinter size={15} />
            <span>{isPrinting ? "Enviando a impresora..." : "Imprimir Informe Z"}</span>
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs cursor-pointer transition active:scale-98"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>

    {/* Dynamic Printer Selector Modal */}
    <PrinterSelectionModal
      isOpen={showPrinterSelector}
      onClose={() => setShowPrinterSelector(false)}
      onSelectAndPrint={(selectedPrinter) => {
        handleExecutePrint(selectedPrinter);
      }}
      title="Seleccionar Impresora para Informe Z"
      subtitle={`Cierre de Caja - Fecha: ${closing.date}`}
    />
  </>
  );
}
