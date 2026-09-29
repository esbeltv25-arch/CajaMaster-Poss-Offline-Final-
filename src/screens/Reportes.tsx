import { useState, useMemo, useRef, useEffect } from "react";
import { useStore, actions } from "../store";
import { TopBar } from "../components/Layout";
import {
  IconDoc,
  IconPrinter,
  IconCalendar,
  IconChart,
  IconCoins,
  IconDownload,
  IconEdit,
  IconCheck,
  IconSearch,
  IconBox,
  IconFilter,
  IconShare,
  IconWhatsApp,
  IconSliders,
  IconFileSpreadsheet,
  IconShieldCheck,
  IconSparkles,
} from "../components/Icons";
import { generateIPVReport, IPVRow } from "../utils/ipv";
import { formatCurrency, roundCurrency } from "../utils/currency";
import { generateIPVReportPdf } from "../utils/pdfExport";
import { downloadOrShareIpvCsv, buildIpvCsvPayload, buildSalesCsvPayload } from "../utils/csvExport";
import {
  printIPVEReportTicket,
  getDefaultPrinter,
  getPrinterSettings,
} from "../services/printerService";
import { PrinterSelectionModal } from "../components/PrinterSelectionModal";
import type { PrinterDevice } from "../types";
import { auditInventoryData, type AuditReport } from "../utils/auditEngine";
import { AuditReportModal } from "../components/AuditReportModal";
import { StorageDestinationModal } from "../components/StorageDestinationModal";
import type { FileExportPayload } from "../utils/fileStorage";
import { analyzeStockAndSales, hasGeminiApiKey } from "../services/geminiService";
import jsPDF from "jspdf";

type PeriodPreset = "today" | "week" | "month" | "last_month" | "all" | "custom";
type ViewMode = "table" | "cards";

const IPV_CUSTOM_SETTINGS_KEY = "cajamaster_ipue_custom_settings_v8";

interface IPUESettings {
  documentTitle: string;
  documentSubtitle: string;
  signature1: string;
  signature2: string;
  signature3: string;
  customNotes: string;
}

export function ReportesScreen() {
  const state = useStore();

  const [preset, setPreset] = useState<PeriodPreset>("month");
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showPrinterSelector, setShowPrinterSelector] = useState(false);

  // Editable header state
  const [bizName, setBizName] = useState(state.business.name || "");
  const [bizOwner, setBizOwner] = useState(state.business.owner || "");
  const [bizAddress, setBizAddress] = useState(state.business.address || "");
  const [bizPhone, setBizPhone] = useState(state.business.phone || "");

  const [ipueSettings, setIpueSettings] = useState<IPUESettings>(() => {
    try {
      const raw = localStorage.getItem(IPV_CUSTOM_SETTINGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      documentTitle: "CONTROL DE MERCANCÍA EN ÁREA DE VENTA (INFORME IPVE / IPV)",
      documentSubtitle: "Control Oficial de Existencias, Precios y Utilidades",
      signature1: "Conformado por (Dependiente)",
      signature2: "Fondo de Caja & Efectivo",
      signature3: "Aprobado por (Administrador)",
      customNotes: "",
    };
  });

  const [editDocTitle, setEditDocTitle] = useState(ipueSettings.documentTitle);
  const [editDocSubtitle, setEditDocSubtitle] = useState(ipueSettings.documentSubtitle);
  const [editSig1, setEditSig1] = useState(ipueSettings.signature1);
  const [editSig2, setEditSig2] = useState(ipueSettings.signature2);
  const [editSig3, setEditSig3] = useState(ipueSettings.signature3);
  const [editNotes, setEditNotes] = useState(ipueSettings.customNotes);

  // Synchronize when state.business changes
  useEffect(() => {
    if (!isEditingHeader) {
      setBizName(state.business.name || "");
      setBizOwner(state.business.owner || "");
      setBizAddress(state.business.address || "");
      setBizPhone(state.business.phone || "");
    }
  }, [state.business, isEditingHeader]);

  // Mobile Table Scroll Ref & State
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = tableContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    const totalScrollable = scrollWidth - clientWidth;
    if (totalScrollable > 0) {
      setScrollProgress(Math.min(100, Math.max(0, (scrollLeft / totalScrollable) * 100)));
    }
  };

  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    checkScroll();
    return () => el.removeEventListener("scroll", checkScroll);
  }, [viewMode]);

  const slideTable = (direction: "left" | "right") => {
    const el = tableContainerRef.current;
    if (!el) return;
    const amount = direction === "left" ? -240 : 240;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  const jumpToColumnSection = (position: number) => {
    const el = tableContainerRef.current;
    if (!el) return;
    el.scrollTo({ left: position, behavior: "smooth" });
  };

  // Calculate timestamps from period
  const { fromTs, toTs, periodLabel } = useMemo(() => {
    const now = new Date();

    if (preset === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
      return { fromTs: start, toTs: end, periodLabel: "Hoy (" + now.toLocaleDateString("es-ES") + ")" };
    }

    if (preset === "week") {
      const day = now.getDay() || 7;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1, 0, 0, 0).getTime();
      const end = new Date().getTime();
      return { fromTs: start, toTs: end, periodLabel: "Esta Semana" };
    }

    if (preset === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0).getTime();
      const end = new Date().getTime();
      return {
        fromTs: start,
        toTs: end,
        periodLabel: now.toLocaleString("es-ES", { month: "long", year: "numeric" }),
      };
    }

    if (preset === "last_month") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0).getTime();
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).getTime();
      const refDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return {
        fromTs: start,
        toTs: end,
        periodLabel: refDate.toLocaleString("es-ES", { month: "long", year: "numeric" }),
      };
    }

    if (preset === "all") {
      return { fromTs: 0, toTs: Date.now() + 86400000, periodLabel: "Todo el Histórico" };
    }

    // Custom
    const start = new Date(customFrom + "T00:00:00").getTime();
    const end = new Date(customTo + "T23:59:59").getTime();
    return {
      fromTs: isNaN(start) ? 0 : start,
      toTs: isNaN(end) ? Date.now() : end,
      periodLabel: `Del ${customFrom} al ${customTo}`,
    };
  }, [preset, customFrom, customTo]);

  // Generate IPV rows
  const allIpvRows = useMemo(() => {
    return generateIPVReport(state, fromTs, toTs);
  }, [state, fromTs, toTs]);

  // Filtered rows by search term
  const ipvRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return allIpvRows;
    return allIpvRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.unit.toLowerCase().includes(q)
    );
  }, [allIpvRows, searchTerm]);

  // Totals with exact financial rounding
  const totals = useMemo(() => {
    const raw = ipvRows.reduce(
      (acc, r) => ({
        invInicialValor: acc.invInicialValor + r.invInicialValor,
        entradasValor: acc.entradasValor + r.entradasValor,
        dispVentaValor: acc.dispVentaValor + r.dispVentaValor,
        invFinalValor: acc.invFinalValor + r.invFinalValor,
        vendidoCant: acc.vendidoCant + r.vendidoCant,
        importeVendido: acc.importeVendido + r.importeVendido,
        costoTotal: acc.costoTotal + r.costoTotal,
      }),
      {
        invInicialValor: 0,
        entradasValor: 0,
        dispVentaValor: 0,
        invFinalValor: 0,
        vendidoCant: 0,
        importeVendido: 0,
        costoTotal: 0,
      }
    );
    return {
      invInicialValor: roundCurrency(raw.invInicialValor),
      entradasValor: roundCurrency(raw.entradasValor),
      dispVentaValor: roundCurrency(raw.dispVentaValor),
      invFinalValor: roundCurrency(raw.invFinalValor),
      vendidoCant: raw.vendidoCant,
      importeVendido: roundCurrency(raw.importeVendido),
      costoTotal: roundCurrency(raw.costoTotal),
    };
  }, [ipvRows]);

  const grossProfit = roundCurrency(totals.importeVendido - totals.costoTotal);
  const overallMargin = totals.importeVendido > 0 ? (grossProfit / totals.importeVendido) * 100 : 0;

  // Period Closings and Cash Reconciliation
  const periodClosings = useMemo(() => {
    return (state.closings || []).filter((c) => {
      const ts = c.closedAt || new Date(c.date).getTime();
      return ts >= fromTs && ts <= toTs;
    });
  }, [state.closings, fromTs, toTs]);

  const totalPeriodCountedCash = periodClosings.reduce((sum, c) => sum + (c.countedCash || 0), 0);
  const totalPeriodCashDiscrepancy = periodClosings.reduce((sum, c) => sum + (c.cashDiscrepancy || 0), 0);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [pdfToast, setPdfToast] = useState<string | null>(null);
  const [auditModalReport, setAuditModalReport] = useState<AuditReport | null>(null);
  const [storagePayload, setStoragePayload] = useState<FileExportPayload | null>(null);

  // AI Analyst State
  const [aiQuery, setAiQuery] = useState("");
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [aiAnalystError, setAiAnalystError] = useState<string | null>(null);
  const [showAiAnalystPanel, setShowAiAnalystPanel] = useState(false);
  const hasAiKey = hasGeminiApiKey();

  const handleRunAIAnalysis = async (customQuestion?: string) => {
    const questionToAsk = customQuestion || aiQuery.trim();
    if (!questionToAsk) return;

    if (!hasAiKey) {
      setAiAnalystError("Configura tu clave de Google Gemini en Ajustes para activar el analista.");
      return;
    }

    setIsAnalyzingAI(true);
    setAiAnalystError(null);
    try {
      const topProducts = [...ipvRows]
        .sort((a, b) => b.importeVendido - a.importeVendido)
        .slice(0, 5)
        .map((p) => ({ name: p.name, qty: p.vendidoCant, total: p.importeVendido }));

      const lowStockProducts = state.products
        .filter((p) => p.stock <= p.lowStockAlert)
        .map((p) => ({ name: p.name, stock: p.stock, unit: p.unit }));

      const answer = await analyzeStockAndSales(questionToAsk, {
        periodLabel,
        totalSales: totals.importeVendido,
        totalCost: totals.costoTotal,
        grossProfit,
        marginPercent: overallMargin,
        topProducts,
        lowStockProducts,
        businessName: state.business?.name,
      });

      setAiAnalysisResult(answer);
    } catch (err: any) {
      setAiAnalystError(err.message || "Error al procesar la consulta con Gemini.");
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  // Mathematical audit of all inventory valuations and formulas
  const inventoryAuditReport = useMemo(() => {
    return auditInventoryData(state.products, state.movements);
  }, [state.products, state.movements]);

  const handleOpenPdfDestinationModal = async () => {
    try {
      setIsGeneratingPdf(true);
      // Generate the official IPVE PDF doc & blob
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });
      // Call generator to fill doc (we can also run generateIPVReportPdf or direct payload)
      const res = await generateIPVReportPdf(
        ipvRows,
        totals,
        periodLabel,
        state.business,
        ipueSettings,
        state.rates,
        false
      );

      const d = new Date();
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const filename = `Informe_IPVE_${(state.business.name || "Negocio").replace(/[^a-zA-Z0-9]/g, "_")}_${dateStr}.pdf`;

      // Build payload for user storage selection
      const blob = doc.output("blob");
      setStoragePayload({
        filename,
        blob,
        mimeType: "application/pdf",
        title: `Informe IPVE / IPV (${periodLabel})`,
        description: `Documento oficial de control de mercancía, precios y márgenes`,
        category: "PDF",
      });
    } catch (err) {
      console.error("Error preparing IPVE PDF:", err);
      setPdfToast("Error al compilar el PDF.");
      setTimeout(() => setPdfToast(null), 3000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleOpenCsvDestinationModal = () => {
    try {
      setIsExportingCsv(true);
      const { payload } = buildIpvCsvPayload(
        ipvRows,
        totals,
        periodLabel,
        state.business,
        state.rates
      );
      setStoragePayload(payload);
    } catch (err) {
      console.error("Error preparing CSV:", err);
      setPdfToast("Error al exportar a CSV.");
      setTimeout(() => setPdfToast(null), 3000);
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleOpenSalesJsonDestinationModal = () => {
    const dataStr = JSON.stringify(state.sales, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const filename = `Ventas_CajaMaster_${new Date().toISOString().slice(0, 10)}.json`;
    setStoragePayload({
      filename,
      blob,
      mimeType: "application/json",
      title: `Registro de Ventas (${state.sales.length} ventas)`,
      description: `Historial de tickets y ventas en formato JSON`,
      category: "JSON",
    });
  };

  const handleGeneratePdf = async (preferShare = false) => {
    if (!preferShare) {
      handleOpenPdfDestinationModal();
      return;
    }
    try {
      setIsGeneratingPdf(true);
      const res = await generateIPVReportPdf(
        ipvRows,
        totals,
        periodLabel,
        state.business,
        ipueSettings,
        state.rates,
        preferShare
      );

      if (res.method === "share" && res.success) {
        setPdfToast("¡Informe compartido con éxito!");
      }
    } catch (err) {
      console.error("Error generating IPUE PDF:", err);
      setPdfToast("Error al compilar el PDF.");
    } finally {
      setIsGeneratingPdf(false);
      setTimeout(() => setPdfToast(null), 3500);
    }
  };

  const handleExportCsv = async (preferShare = false) => {
    if (!preferShare) {
      handleOpenCsvDestinationModal();
      return;
    }
    try {
      setIsExportingCsv(true);
      const res = await downloadOrShareIpvCsv(
        ipvRows,
        totals,
        periodLabel,
        state.business,
        state.rates,
        preferShare
      );

      if (res.method === "share" && res.success) {
        setPdfToast("¡Informe IPVE (CSV) compartido con éxito!");
      }
    } catch (err) {
      console.error("Error exporting IPVE CSV:", err);
      setPdfToast("Error al exportar el reporte a CSV.");
    } finally {
      setIsExportingCsv(false);
      setTimeout(() => setPdfToast(null), 3500);
    }
  };

  const handlePrint = async (printer?: PrinterDevice) => {
    const settings = getPrinterSettings();
    const target = printer || getDefaultPrinter();

    if (!target && settings.autoOpenSelectorIfNoDefault) {
      setShowPrinterSelector(true);
      return;
    }

    try {
      setIsPrinting(true);
      const res = await printIPVEReportTicket(
        ipvRows,
        totals,
        periodLabel,
        state.business,
        state.rates,
        target
      );
      setPdfToast(res.message);
    } catch (err: any) {
      console.warn("Print IPVE error:", err);
      setPdfToast(err.message || "Error al imprimir reporte IPVE.");
    } finally {
      setIsPrinting(false);
      setTimeout(() => setPdfToast(null), 3500);
    }
  };

  const currentDefaultPrinter = getDefaultPrinter();

  const handleSaveHeader = () => {
    // Save to global business state
    actions.updateBusinessInfo({
      name: bizName.trim(),
      owner: bizOwner.trim(),
      address: bizAddress.trim(),
      phone: bizPhone.trim(),
    });

    const newSettings: IPUESettings = {
      documentTitle: editDocTitle.trim() || "CONTROL DE MERCANCÍA EN ÁREA DE VENTA (INFORME IPVE / IPV)",
      documentSubtitle: editDocSubtitle.trim(),
      signature1: editSig1.trim() || "Conformado por (Dependiente)",
      signature2: editSig2.trim() || "Fondo de Caja & Efectivo",
      signature3: editSig3.trim() || "Aprobado por (Administrador)",
      customNotes: editNotes.trim(),
    };

    setIpueSettings(newSettings);
    try {
      localStorage.setItem(IPV_CUSTOM_SETTINGS_KEY, JSON.stringify(newSettings));
    } catch {}

    setIsEditingHeader(false);
  };

  const handleResetHeaderToDefaults = () => {
    if (window.confirm("¿Restablecer los títulos y firmas a los valores por defecto?")) {
      setBizName("Mi Establecimiento Comercial");
      setBizOwner("Administración");
      setBizAddress("");
      setBizPhone("");
      setEditDocTitle("CONTROL DE MERCANCÍA EN ÁREA DE VENTA (INFORME IPVE / IPV)");
      setEditDocSubtitle("Control Oficial de Existencias, Precios y Utilidades");
      setEditSig1("Conformado por (Dependiente)");
      setEditSig2("Fondo de Caja & Efectivo");
      setEditSig3("Aprobado por (Administrador)");
      setEditNotes("");
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
      <TopBar
        title="Informe IPVE / IPV"
        subtitle="Control de Mercancía, Existencias y Precios"
        right={
          <div className="flex items-center gap-1 sm:gap-1.5 print:hidden">
            <button
              onClick={() => setAuditModalReport(inventoryAuditReport)}
              className="px-2 sm:px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer border border-emerald-300 shrink-0 whitespace-nowrap shadow-2xs"
              title="Auditoría matemática de fórmulas de inventario y márgenes"
            >
              <IconShieldCheck size={14} className="shrink-0 text-emerald-700" />
              <span className="hidden xs:inline">Auditoría: {inventoryAuditReport.score}% OK</span>
              <span className="xs:hidden">Auditoría</span>
            </button>
            <button
              onClick={() => setIsEditingHeader(true)}
              className="px-2 sm:px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer border border-purple-200 shrink-0 whitespace-nowrap shadow-2xs"
              title="Personalizar datos del establecimiento y encabezado"
            >
              <IconEdit size={14} className="shrink-0" />
              <span className="hidden xs:inline">Editar Encabezado</span>
              <span className="xs:hidden">Encabezado</span>
            </button>
            <button
              onClick={handleOpenSalesJsonDestinationModal}
              className="px-2 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-300 shrink-0 whitespace-nowrap shadow-2xs"
              title="Descargar registro de ventas en JSON"
            >
              <IconDownload size={14} className="shrink-0" />
              <span className="hidden xs:inline">Exportar JSON</span>
              <span className="xs:hidden">JSON</span>
            </button>
            <button
              onClick={() => handleExportCsv(false)}
              disabled={isExportingCsv}
              className="px-2 sm:px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer border border-teal-200 shrink-0 whitespace-nowrap shadow-2xs"
              title="Exportar informe IPVE en formato CSV para Excel o Google Sheets"
            >
              <IconFileSpreadsheet size={14} className="shrink-0 text-teal-700" />
              <span className="hidden xs:inline">Exportar CSV</span>
              <span className="xs:hidden">CSV</span>
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 text-slate-900">
        {/* Period Selector Controls (Hidden on print) */}
        <div className="p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3 print:hidden shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconCalendar size={18} className="text-slate-800" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700">
                Periodo del Informe IPVE / IPV
              </h3>
            </div>

            <button
              onClick={() => setIsEditingHeader(true)}
              className="text-[11px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
            >
              <IconEdit size={12} />
              <span>Personalizar Establecimiento</span>
            </button>
          </div>

          {/* Quick Presets (Fluid Responsive Pills) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: "today", label: "Hoy" },
              { key: "week", label: "Esta Semana" },
              { key: "month", label: "Este Mes" },
              { key: "last_month", label: "Mes Anterior" },
              { key: "all", label: "Todo el Historial" },
              { key: "custom", label: "Personalizado" },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key as PeriodPreset)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer shrink-0 active:scale-95 ${
                  preset === p.key
                    ? "bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/20"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers (Shown when custom is selected) */}
          {preset === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 animate-pop">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  Desde (Fecha inicial):
                </label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full neu-inset rounded-xl px-3 h-10 text-xs font-bold outline-none text-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  Hasta (Fecha final):
                </label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full neu-inset rounded-xl px-3 h-10 text-xs font-bold outline-none text-slate-800"
                />
              </div>
            </div>
          )}
        </div>

        {/* Documento Oficial de Liquidación IPVE - Cuadro Superior con Compartir e Imprimir 2 botones pequeños debajo */}
        <div className="p-4 rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white shadow-md border border-blue-800/40 print:hidden space-y-3">
          {/* Header arriba */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-400 shadow-inner">
                <IconDoc size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black tracking-wide text-white">
                    Documento Oficial de Liquidación IPVE
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold hidden sm:inline-block">
                    Oficial
                  </span>
                </div>
                <div className="text-xs text-blue-200/80 font-medium mt-0.5">
                  Genera el archivo PDF, compártelo por WhatsApp o imprímelo al instante
                </div>
              </div>
            </div>

            {/* Acciones complementarias compactas en pantallas medianas */}
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleGeneratePdf(false)}
                disabled={isGeneratingPdf}
                className="px-2.5 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/30 text-amber-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer active:scale-95 disabled:opacity-50"
                title="Descargar archivo PDF"
              >
                <IconDownload size={13} />
                <span>PDF</span>
              </button>
              <button
                onClick={() => handleExportCsv(false)}
                disabled={isExportingCsv}
                className="px-2.5 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer active:scale-95 disabled:opacity-50"
                title="Descargar reporte IPVE en formato CSV para Excel o Google Sheets"
              >
                <IconFileSpreadsheet size={13} />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* 2 Botones Pequeños Debajo: Compartir e Imprimir */}
          <div className="flex items-center gap-2 pt-2 border-t border-blue-900/60">
            {/* Botón Pequeño: Compartir */}
            <button
              onClick={() => handleGeneratePdf(true)}
              disabled={isGeneratingPdf}
              className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
              title="Compartir PDF por WhatsApp, Correo o Redes Sociales"
            >
              {isGeneratingPdf ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Compartiendo...</span>
                </>
              ) : (
                <>
                  <IconShare size={14} />
                  <span>Compartir</span>
                </>
              )}
            </button>

            {/* Botón Pequeño: Imprimir */}
            <div className="flex-1 sm:flex-initial flex items-center bg-blue-900/90 hover:bg-blue-800/90 border border-blue-500/40 rounded-xl overflow-hidden shadow-sm transition">
              <button
                onClick={() => handlePrint()}
                disabled={isPrinting}
                className="flex-1 sm:flex-initial px-3.5 py-1.5 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 disabled:opacity-50"
                title={`Imprimir reporte en ${currentDefaultPrinter?.name || "impresora predeterminada"}`}
              >
                <IconPrinter size={14} />
                <span>{isPrinting ? "Enviando..." : "Imprimir"}</span>
              </button>
              <button
                onClick={() => setShowPrinterSelector(true)}
                className="px-2 py-1.5 hover:bg-blue-700 text-blue-200 hover:text-white transition cursor-pointer border-l border-blue-500/40"
                title="Configurar o seleccionar impresora (Bluetooth, Wi-Fi, USB)"
              >
                <IconSliders size={13} />
              </button>
            </div>

            {/* Botón PDF compacto en móvil */}
            <button
              onClick={() => handleGeneratePdf(false)}
              disabled={isGeneratingPdf}
              className="sm:hidden px-2.5 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/30 text-amber-300 text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
              title="Descargar archivo PDF"
            >
              <IconDownload size={13} />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* Dynamic Toast Feedback Notification */}
        {pdfToast && (
          <div className="p-3 rounded-2xl bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-between shadow-lg animate-pop print:hidden">
            <div className="flex items-center gap-2">
              <IconCheck size={16} />
              <span>{pdfToast}</span>
            </div>
            <button
              onClick={() => setPdfToast(null)}
              className="text-xs px-2 py-0.5 font-bold hover:opacity-75"
            >
              ✕
            </button>
          </div>
        )}

        {/* Executive KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 print:hidden">
          <div className="p-3.5 rounded-2xl bg-slate-900 text-white shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="text-[10px] sm:text-[11px] text-slate-400 font-extrabold uppercase tracking-wide truncate">IMPORTE VENDIDO</div>
            <div className="text-base sm:text-lg font-extrabold text-amber-400 mt-0.5 truncate">
              {formatCurrency(totals.importeVendido, "CUP", state.rates)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">{totals.vendidoCant} u vendidas</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between">
            <div className="text-[10px] sm:text-[11px] text-slate-500 font-extrabold uppercase tracking-wide truncate">COSTO DE MERCANCÍA</div>
            <div className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5 truncate">
              {formatCurrency(totals.costoTotal, "CUP", state.rates)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">Inversión directa</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-xs overflow-hidden flex flex-col justify-between">
            <div className="text-[10px] sm:text-[11px] text-emerald-800 font-extrabold uppercase tracking-wide truncate">GANANCIA BRUTA</div>
            <div className="text-base sm:text-lg font-extrabold text-emerald-700 mt-0.5 truncate">
              {formatCurrency(grossProfit, "CUP", state.rates)}
            </div>
            <div className="text-[10px] text-emerald-700 mt-0.5 truncate">Margen {overallMargin.toFixed(1)}%</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between">
            <div className="text-[10px] sm:text-[11px] text-slate-500 font-extrabold uppercase tracking-wide truncate">VALOR STOCK FINAL</div>
            <div className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5 truncate">
              {formatCurrency(totals.invFinalValor, "CUP", state.rates)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">Remanente en tienda</div>
          </div>
        </div>

        {/* Cash & Arqueo Reconciliation with IPVE */}
        {periodClosings.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs print:hidden space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconCoins size={16} className="text-amber-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Conciliación de Efectivo & Cierres Z ({periodClosings.length} arqueo(s))
                </span>
              </div>
              <span className="text-[10.5px] font-bold text-slate-500">
                Soporte de billetes de 10.000 y 20.000 CUP
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Efectivo Contado (Físico):</span>
                <span className="text-sm font-extrabold text-slate-900">
                  {formatCurrency(totalPeriodCountedCash, "CUP", state.rates)}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Venta en Mercancía (IPVE):</span>
                <span className="text-sm font-extrabold text-amber-700">
                  {formatCurrency(totals.importeVendido, "CUP", state.rates)}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Descuadre Neto Acumulado:</span>
                <span
                  className={`text-sm font-black ${
                    totalPeriodCashDiscrepancy === 0
                      ? "text-emerald-700"
                      : totalPeriodCashDiscrepancy > 0
                      ? "text-blue-700"
                      : "text-rose-700"
                  }`}
                >
                  {totalPeriodCashDiscrepancy === 0
                    ? "0.00 CUP (Cuadrada)"
                    : (totalPeriodCashDiscrepancy > 0 ? "+" : "") + formatCurrency(totalPeriodCashDiscrepancy, "CUP", state.rates)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* AI Stock & Sales Analyst Card (Google Gemini) */}
        <div className="p-4 rounded-3xl border border-purple-200 bg-gradient-to-br from-purple-50/70 via-white to-slate-50 shadow-xs print:hidden space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-xs">
                <IconSparkles size={16} />
              </div>
              <div>
                <h3 className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                  <span>Analista de Ventas & Stock con IA</span>
                  <span className="text-[9px] bg-purple-200 text-purple-950 font-black px-2 py-0.2 rounded-full uppercase">
                    Google Gemini
                  </span>
                </h3>
                <p className="text-[10.5px] text-slate-500">
                  Consulta tus métricas, rentabilidad y riesgos de inventario en lenguaje natural
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAiAnalystPanel(!showAiAnalystPanel)}
              className="px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-950 font-black text-xs transition cursor-pointer active:scale-95 border border-purple-300"
            >
              {showAiAnalystPanel ? "Ocultar" : "Abrir Analista"}
            </button>
          </div>

          {showAiAnalystPanel && (
            <div className="space-y-2.5 pt-2 border-t border-purple-100 animate-pop">
              {/* Pre-canned Quick Questions */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Preguntas rápidas sugeridas:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "¿Cuáles son mis 3 productos más rentables y cuáles no se venden?",
                    "¿Qué productos tienen riesgo de agotarse pronto?",
                    "¿Cómo puedo mejorar mi margen de ganancia general?",
                    "Resume el rendimiento general de las ventas de este periodo.",
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setAiQuery(q);
                        handleRunAIAnalysis(q);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-white hover:bg-purple-100 text-slate-700 hover:text-purple-950 text-[11px] font-semibold transition cursor-pointer border border-purple-200 active:scale-95 text-left"
                    >
                      💡 {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Free-form Input */}
              <div className="flex gap-2">
                <div className="neu-inset rounded-2xl flex-1 px-3.5 h-11 flex items-center bg-white">
                  <input
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRunAIAnalysis();
                    }}
                    placeholder="Escribe tu pregunta sobre las ventas o stock..."
                    className="w-full bg-transparent outline-none text-xs font-semibold text-slate-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRunAIAnalysis()}
                  disabled={isAnalyzingAI || !aiQuery.trim()}
                  className="px-4 h-11 rounded-2xl bg-purple-900 hover:bg-purple-800 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition active:scale-95 shrink-0"
                >
                  {isAnalyzingAI ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Analizando...</span>
                    </>
                  ) : (
                    <>
                      <IconSparkles size={14} className="text-amber-300" />
                      <span>Preguntar</span>
                    </>
                  )}
                </button>
              </div>

              {aiAnalystError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{aiAnalystError}</span>
                </div>
              )}

              {aiAnalysisResult && (
                <div className="p-3.5 rounded-2xl bg-white border-2 border-purple-200 text-slate-800 text-xs space-y-2 shadow-xs leading-relaxed animate-pop">
                  <div className="flex items-center justify-between border-b border-purple-100 pb-1.5">
                    <span className="font-extrabold text-purple-950 flex items-center gap-1.5">
                      <span>✨ Análisis Financiero & Stock:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAiAnalysisResult(null)}
                      className="text-[10.5px] font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      Limpiar
                    </button>
                  </div>
                  <div className="whitespace-pre-line text-slate-800 text-[11.5px] font-medium">
                    {aiAnalysisResult}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* View Mode & Search Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 print:hidden">
          {/* Search Box */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar producto en la tabla IPVE..."
              className="w-full h-10 pl-9 pr-3 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-semibold outline-none focus:border-slate-800 transition"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <IconSearch size={14} />
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0">
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <IconDoc size={13} />
              <span>Vista Tabla (Hoja)</span>
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === "cards"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <IconBox size={13} />
              <span>Vista Fichas Móvil</span>
            </button>
          </div>
        </div>

        {/* Mobile Slide Controls Bar (Visible on mobile / responsive) */}
        {viewMode === "table" && (
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-sm space-y-2.5 print:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-200">
                  Deslizador de Columnas
                </span>
              </div>

              {/* Slider Action Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => slideTable("left")}
                  disabled={!canScrollLeft}
                  className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-extrabold flex items-center gap-1 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                  title="Deslizar hacia la izquierda"
                >
                  ◀ Izq
                </button>
                <button
                  onClick={() => slideTable("right")}
                  disabled={!canScrollRight}
                  className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 shadow-xs"
                  title="Deslizar hacia la derecha"
                >
                  Der ▶
                </button>
              </div>
            </div>

            {/* Quick Column Jumps (Shortcuts) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0 mr-1">
                Ir a:
              </span>
              <button
                onClick={() => jumpToColumnSection(0)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-slate-200 whitespace-nowrap transition cursor-pointer"
              >
                🏷️ Producto
              </button>
              <button
                onClick={() => jumpToColumnSection(220)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-slate-200 whitespace-nowrap transition cursor-pointer"
              >
                📦 Inventarios
              </button>
              <button
                onClick={() => jumpToColumnSection(480)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-amber-300 whitespace-nowrap transition cursor-pointer"
              >
                💰 Ventas & CUP
              </button>
              <button
                onClick={() => jumpToColumnSection(750)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-emerald-300 whitespace-nowrap transition cursor-pointer"
              >
                📈 Rentabilidad
              </button>
            </div>

            {/* Progress bar line */}
            <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
              <div
                className="bg-amber-400 h-full transition-all duration-150 rounded-full"
                style={{ width: `${Math.max(15, scrollProgress)}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Official IPV Printable Document Section */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm print:border-none print:shadow-none print:p-0 space-y-4">
          {/* Printable Header with Interactive Edit Button */}
          <div className="relative border-b border-slate-300 pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="font-extrabold text-base md:text-xl uppercase tracking-tight text-slate-950">
                    {state.business.name || "ESTABLECIMIENTO COMERCIAL"}
                  </h2>
                  <button
                    onClick={() => setIsEditingHeader(true)}
                    className="p-1 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-800 transition cursor-pointer print:hidden"
                    title="Editar nombre y datos del negocio"
                  >
                    <IconEdit size={13} />
                  </button>
                </div>

                <h3 className="font-bold text-xs md:text-sm text-purple-900 uppercase tracking-wide">
                  {ipueSettings.documentTitle}
                </h3>
                {ipueSettings.documentSubtitle && (
                  <p className="text-[11px] text-slate-600 font-medium">
                    {ipueSettings.documentSubtitle}
                  </p>
                )}

                <div className="text-[11px] text-slate-600 font-medium flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-1">
                  <span>
                    Periodo evaluado: <strong className="text-slate-900">{periodLabel}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Moneda base: <strong className="text-slate-900">CUP</strong>
                  </span>
                  {state.business.owner && (
                    <>
                      <span>•</span>
                      <span>
                        Responsable: <strong className="text-slate-900">{state.business.owner}</strong>
                      </span>
                    </>
                  )}
                  {state.business.address && (
                    <>
                      <span>•</span>
                      <span>{state.business.address}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
                <div className="text-left sm:text-right text-[11px] text-slate-500 font-mono">
                  <div className="font-bold text-slate-700">
                    Emitido: {new Date().toLocaleDateString("es-ES")} {new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div>CajaMaster Pro POS</div>
                  {state.business.phone && (
                    <div className="text-[10px] text-slate-400">Tel: {state.business.phone}</div>
                  )}
                </div>

                {/* 2 Botones Pequeños: Compartir e Imprimir dentro de este cuadro */}
                <div className="flex items-center gap-1.5 print:hidden pt-0.5">
                  <button
                    onClick={() => handleGeneratePdf(true)}
                    disabled={isGeneratingPdf}
                    className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-[11px] flex items-center gap-1 transition cursor-pointer shadow-2xs active:scale-95"
                    title="Compartir documento oficial IPVE (PDF, WhatsApp, Correo)"
                  >
                    <IconShare size={12} />
                    <span>Compartir</span>
                  </button>

                  <div className="flex items-center bg-blue-900/90 hover:bg-blue-800 border border-blue-700 text-white rounded-xl overflow-hidden shadow-2xs">
                    <button
                      onClick={() => handlePrint()}
                      disabled={isPrinting}
                      className="px-2.5 py-1 text-white font-extrabold text-[11px] flex items-center gap-1 transition cursor-pointer active:scale-95 disabled:opacity-50"
                      title="Imprimir documento oficial en impresora térmica o predeterminada"
                    >
                      <IconPrinter size={12} />
                      <span>{isPrinting ? "Enviando..." : "Imprimir"}</span>
                    </button>
                    <button
                      onClick={() => setShowPrinterSelector(true)}
                      className="px-1.5 py-1 hover:bg-blue-700 text-blue-200 hover:text-white transition cursor-pointer border-l border-blue-700/60"
                      title="Configurar o seleccionar impresora"
                    >
                      <IconSliders size={11} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* VIEW MODE: SPREADSHEET TABLE */}
          {viewMode === "table" ? (
            <div
              ref={tableContainerRef}
              className="overflow-x-auto relative rounded-2xl border border-slate-200 shadow-inner scroll-smooth"
            >
              <table className="w-full text-[11px] text-left border-collapse min-w-[840px]">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] uppercase font-extrabold sticky top-0 z-30">
                    <th className="p-2.5 border border-slate-800 sticky left-0 bg-slate-900 z-30 min-w-[150px] shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                      Producto
                    </th>
                    <th className="p-2 border border-slate-800 text-center min-w-[45px]">U/M</th>
                    <th className="p-2 border border-slate-800 text-right min-w-[70px]">Inv. Inicial</th>
                    <th className="p-2 border border-slate-800 text-right min-w-[65px]">Entradas</th>
                    <th className="p-2 border border-slate-800 text-right min-w-[70px]">Disp. Venta</th>
                    <th className="p-2 border border-slate-800 text-right min-w-[70px]">Inv. Final</th>
                    <th className="p-2 border border-slate-800 text-right min-w-[75px] bg-slate-800">Cant. Vendida</th>
                    <th className="p-2 border border-slate-800 text-right min-w-[70px]">Precio</th>
                    <th className="p-2 border border-slate-800 text-right bg-amber-500 text-slate-950 min-w-[95px] font-black">
                      Importe CUP
                    </th>
                    <th className="p-2 border border-slate-800 text-right min-w-[80px]">Costo Total</th>
                    <th className="p-2 border border-slate-800 text-right min-w-[65px]">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ipvRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-500 font-semibold text-xs">
                        No se encontraron productos que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    ipvRows.map((r) => {
                      const itemProfit = r.importeVendido - r.costoTotal;
                      const itemMargin = r.importeVendido > 0 ? (itemProfit / r.importeVendido) * 100 : 0;

                      return (
                        <tr key={r.productId} className="hover:bg-slate-50 transition">
                          {/* Sticky Product Column */}
                          <td className="p-2.5 border border-slate-200 font-extrabold text-slate-950 sticky left-0 bg-white hover:bg-slate-50 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.06)]">
                            <div className="truncate max-w-[150px] sm:max-w-[200px]" title={r.name}>
                              {r.name}
                            </div>
                          </td>
                          <td className="p-2 border border-slate-200 text-center font-semibold text-slate-600">
                            {r.unit}
                          </td>
                          <td className="p-2 border border-slate-200 text-right font-mono font-medium">
                            {r.invInicialCant}
                          </td>
                          <td className="p-2 border border-slate-200 text-right font-mono text-emerald-700 font-bold">
                            {r.entradasCant > 0 ? `+${r.entradasCant}` : "-"}
                          </td>
                          <td className="p-2 border border-slate-200 text-right font-mono font-bold text-slate-800">
                            {r.dispVentaCant}
                          </td>
                          <td className="p-2 border border-slate-200 text-right font-mono font-bold text-slate-800">
                            {r.invFinalCant}
                          </td>
                          <td className="p-2 border border-slate-200 text-right font-mono font-extrabold text-slate-950 bg-amber-50/60">
                            {r.vendidoCant}
                          </td>
                          <td className="p-2 border border-slate-200 text-right font-mono text-slate-700">
                            {r.precioVenta.toFixed(2)}
                          </td>
                          <td className="p-2 border border-slate-200 text-right font-mono font-extrabold text-slate-950 bg-amber-100/70">
                            {r.importeVendido.toFixed(2)}
                          </td>
                          <td className="p-2 border border-slate-200 text-right font-mono text-slate-700">
                            {r.costoTotal.toFixed(2)}
                          </td>
                          <td className="p-2 border border-slate-200 text-right font-mono font-bold text-emerald-700">
                            {r.importeVendido > 0 ? `${itemMargin.toFixed(1)}%` : "-"}
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* Table Totals Row */}
                  <tr className="bg-slate-900 text-white font-extrabold text-xs sticky bottom-0 z-30">
                    <td className="p-2.5 border border-slate-800 sticky left-0 bg-slate-900 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                      TOTALES (CUP)
                    </td>
                    <td className="p-2.5 border border-slate-800 text-center">-</td>
                    <td className="p-2.5 border border-slate-800 text-right font-mono">
                      {formatCurrency(totals.invInicialValor, "CUP", state.rates)}
                    </td>
                    <td className="p-2.5 border border-slate-800 text-right font-mono">
                      {formatCurrency(totals.entradasValor, "CUP", state.rates)}
                    </td>
                    <td className="p-2.5 border border-slate-800 text-right font-mono">
                      {formatCurrency(totals.dispVentaValor, "CUP", state.rates)}
                    </td>
                    <td className="p-2.5 border border-slate-800 text-right font-mono">
                      {formatCurrency(totals.invFinalValor, "CUP", state.rates)}
                    </td>
                    <td className="p-2.5 border border-slate-800 text-right font-mono text-amber-300">
                      {totals.vendidoCant} u
                    </td>
                    <td className="p-2.5 border border-slate-800 text-right">-</td>
                    <td className="p-2.5 border border-slate-800 text-right font-mono text-amber-400 font-black">
                      {formatCurrency(totals.importeVendido, "CUP", state.rates)}
                    </td>
                    <td className="p-2.5 border border-slate-800 text-right font-mono">
                      {formatCurrency(totals.costoTotal, "CUP", state.rates)}
                    </td>
                    <td className="p-2.5 border border-slate-800 text-right font-mono text-emerald-400">
                      {overallMargin.toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            /* VIEW MODE: MOBILE CARDS */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {ipvRows.map((r) => {
                const itemProfit = r.importeVendido - r.costoTotal;
                const itemMargin = r.importeVendido > 0 ? (itemProfit / r.importeVendido) * 100 : 0;

                return (
                  <div
                    key={r.productId}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2">
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900">{r.name}</h4>
                        <span className="text-[11px] text-slate-500 font-medium">
                          U/M: <strong className="text-slate-800">{r.unit}</strong> • Precio: {r.precioVenta.toFixed(2)} CUP • Costo: {r.costoUnitario.toFixed(2)} CUP
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-extrabold uppercase text-slate-500 block">
                          IMPORTE
                        </span>
                        <span className="font-mono font-black text-sm text-amber-600">
                          {r.importeVendido.toFixed(2)} CUP
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="p-2 rounded-xl bg-white border border-slate-200">
                        <div className="text-[9px] font-extrabold text-slate-400 uppercase">INICIAL</div>
                        <div className="font-mono font-bold text-slate-800">{r.invInicialCant}</div>
                      </div>
                      <div className="p-2 rounded-xl bg-white border border-slate-200">
                        <div className="text-[9px] font-extrabold text-slate-400 uppercase">ENTRADAS</div>
                        <div className="font-mono font-bold text-emerald-700">
                          {r.entradasCant > 0 ? `+${r.entradasCant}` : "-"}
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-white border border-slate-200">
                        <div className="text-[9px] font-extrabold text-slate-400 uppercase">DISPONIBLE</div>
                        <div className="font-mono font-bold text-slate-900">{r.dispVentaCant}</div>
                      </div>
                      <div className="p-2 rounded-xl bg-white border border-slate-200">
                        <div className="text-[9px] font-extrabold text-slate-400 uppercase">FINAL</div>
                        <div className="font-mono font-bold text-slate-800">{r.invFinalCant}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                      <span className="text-slate-600 font-semibold">
                        Vendidas: <strong className="text-slate-900">{r.vendidoCant} {r.unit}</strong>
                      </span>
                      <span className="text-slate-600 font-semibold">
                        Costo: <strong className="text-slate-900">{r.costoTotal.toFixed(2)}</strong>
                      </span>
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md text-[11px]">
                        Margen: {itemMargin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Custom Notes Section */}
          {ipueSettings.customNotes && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 font-medium">
              <strong className="text-slate-900 block mb-0.5">Observaciones:</strong>
              <p className="whitespace-pre-line">{ipueSettings.customNotes}</p>
            </div>
          )}

          {/* Official Signatures for IPUE / IPV Printout */}
          <div className="pt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-xs text-slate-600 font-sans border-t border-slate-300 mt-6">
            <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 print:bg-transparent print:border-none">
              <div className="border-t border-slate-900 pt-2 font-bold text-slate-900">
                {ipueSettings.signature1}
              </div>
              <div className="text-[10px] text-slate-500">Firma y Cuño</div>
            </div>
            <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 print:bg-transparent print:border-none">
              <div className="border-t border-slate-900 pt-2 font-bold text-slate-900">
                {ipueSettings.signature2}
              </div>
              <div className="text-[10px] text-slate-500">Verificado conforme</div>
            </div>
            <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 print:bg-transparent print:border-none">
              <div className="border-t border-slate-900 pt-2 font-bold text-slate-900">
                {ipueSettings.signature3}
              </div>
              <div className="text-[10px] text-slate-500">Auditoría y Cierre</div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: PERSONALIZAR ENCABEZADO Y DATOS DE LA TABLA IPUE */}
      {isEditingHeader && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setIsEditingHeader(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto border border-slate-200 animate-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <IconEdit size={16} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Personalizar Encabezado IPVE
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Edita el nombre del establecimiento, títulos oficiales y firmas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditingHeader(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 max-h-[65vh] overflow-y-auto pr-1">
              {/* Business Name */}
              <div>
                <label className="text-[11px] font-extrabold text-slate-700 block mb-1 uppercase">
                  Nombre del Establecimiento / Negocio *
                </label>
                <input
                  type="text"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  placeholder="Ej: Cafetería El Prado / Mi Negocio"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-900 outline-none focus:border-purple-600 transition"
                  autoFocus
                />
              </div>

              {/* Document Title */}
              <div>
                <label className="text-[11px] font-extrabold text-slate-700 block mb-1 uppercase">
                  Título Principal del Informe
                </label>
                <input
                  type="text"
                  value={editDocTitle}
                  onChange={(e) => setEditDocTitle(e.target.value)}
                  placeholder="Ej: CONTROL DE MERCANCÍA EN ÁREA DE VENTA (INFORME IPVE / IPV)"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 font-semibold text-xs text-slate-900 outline-none focus:border-purple-600 transition"
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="text-[11px] font-extrabold text-slate-700 block mb-1 uppercase">
                  Subtítulo / Régimen
                </label>
                <input
                  type="text"
                  value={editDocSubtitle}
                  onChange={(e) => setEditDocSubtitle(e.target.value)}
                  placeholder="Ej: Control Oficial de Existencias, Precios y Utilidades"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 text-xs text-slate-900 outline-none focus:border-purple-600 transition"
                />
              </div>

              {/* Owner & Phone Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-extrabold text-slate-700 block mb-1 uppercase">
                    Administrador / Responsable
                  </label>
                  <input
                    type="text"
                    value={bizOwner}
                    onChange={(e) => setBizOwner(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 text-xs text-slate-900 outline-none focus:border-purple-600 transition"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-extrabold text-slate-700 block mb-1 uppercase">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    value={bizPhone}
                    onChange={(e) => setBizPhone(e.target.value)}
                    placeholder="Ej: +53 5200-0000"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 text-xs text-slate-900 outline-none focus:border-purple-600 transition"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="text-[11px] font-extrabold text-slate-700 block mb-1 uppercase">
                  Dirección del Local
                </label>
                <input
                  type="text"
                  value={bizAddress}
                  onChange={(e) => setBizAddress(e.target.value)}
                  placeholder="Ej: Calle 23 entre G y H, Vedado"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 text-xs text-slate-900 outline-none focus:border-purple-600 transition"
                />
              </div>

              {/* Signatures customization */}
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[11px] font-extrabold text-slate-700 block mb-2 uppercase">
                  Cargos y Firmas en el Pie del Informe
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-0.5">Firma 1:</label>
                    <input
                      type="text"
                      value={editSig1}
                      onChange={(e) => setEditSig1(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-0.5">Firma 2:</label>
                    <input
                      type="text"
                      value={editSig2}
                      onChange={(e) => setEditSig2(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-0.5">Firma 3:</label>
                    <input
                      type="text"
                      value={editSig3}
                      onChange={(e) => setEditSig3(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Custom Notes */}
              <div>
                <label className="text-[11px] font-extrabold text-slate-700 block mb-1 uppercase">
                  Notas u Observaciones adicionales (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Escribe aclaraciones que aparecerán impresas en el informe..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 outline-none focus:border-purple-600 transition"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                onClick={handleResetHeaderToDefaults}
                className="text-xs font-bold text-slate-500 hover:text-rose-600 transition cursor-pointer"
              >
                Valores por defecto
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditingHeader(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveHeader}
                  className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <IconCheck size={14} />
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Printer Selector Modal */}
      <PrinterSelectionModal
        isOpen={showPrinterSelector}
        onClose={() => setShowPrinterSelector(false)}
        onSelectAndPrint={(selectedPrinter) => {
          handlePrint(selectedPrinter);
        }}
        title="Seleccionar Impresora para Reporte IPVE"
        subtitle={`Periodo: ${periodLabel} - Total: ${formatCurrency(totals.importeVendido, "CUP", state.rates)}`}
      />

      {/* Interactive Inventory & IPVE Audit Inspection Modal */}
      <AuditReportModal
        report={auditModalReport}
        onClose={() => setAuditModalReport(null)}
        title="Auditoría de Mercancía e Inventario"
        subtitle="Verificación de fórmulas de existencias, márgenes y Kardex"
      />

      {/* Universal Storage Destination Dialog (Memoria Interna / Externa / Nube) */}
      <StorageDestinationModal
        isOpen={!!storagePayload}
        payload={storagePayload}
        onClose={() => setStoragePayload(null)}
        onSaved={(res) => {
          if (res.success) {
            setPdfToast(res.message);
            setTimeout(() => setPdfToast(null), 3500);
          }
        }}
      />
    </div>
  );
}
