import { useState, useRef, useEffect, type ChangeEvent } from "react";
import {
  IconDownload,
  IconUpload,
  IconCheck,
  IconAlert,
  IconTrash,
  IconDoc,
  IconFileSpreadsheet,
  IconRefreshCw,
  IconSliders,
  IconShare,
} from "./Icons";
import { useStore, actions } from "../store";
import type { AppState } from "../types";
import {
  downloadOrShareInventoryCatalogCsv,
  downloadOrShareAllClosingsCsv,
  buildInventoryCatalogCsvPayload,
  buildAllClosingsCsvPayload,
} from "../utils/csvExport";
import { StorageDestinationModal } from "./StorageDestinationModal";
import type { FileExportPayload } from "../utils/fileStorage";
import {
  buildBackupPayload,
  buildProductsAndSalesJson,
  getAutoBackupSettings,
  saveAutoBackupSettings,
  getBackupHistory,
  recordBackupInHistory,
  type BackupMetadata,
  type AutoBackupSettings,
} from "../utils/backupEngine";

export function BackupModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const state = useStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<"export" | "auto" | "import" | "history">("export");
  const [importedData, setImportedData] = useState<AppState | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [storagePayload, setStoragePayload] = useState<FileExportPayload | null>(null);

  // Auto-backup configuration state
  const [autoConfig, setAutoConfig] = useState<AutoBackupSettings>(() => getAutoBackupSettings());
  const [historyList, setHistoryList] = useState<BackupMetadata[]>(() => getBackupHistory());

  useEffect(() => {
    if (isOpen) {
      setAutoConfig(getAutoBackupSettings());
      setHistoryList(getBackupHistory());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Toggle Auto-backup setting
  const handleToggleAutoBackup = (key: keyof AutoBackupSettings, val: any) => {
    const updated = saveAutoBackupSettings({ [key]: val });
    setAutoConfig(updated);
    setSuccessMsg("Configuración de respaldo automático actualizada.");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // 1. Respaldo Integral Completo (JSON)
  const handleExportFullJson = () => {
    const fullPayload = buildBackupPayload(state, "MANUAL_USER");
    const jsonStr = JSON.stringify(fullPayload, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });

    recordBackupInHistory(fullPayload.metadata);
    setHistoryList(getBackupHistory());

    setStoragePayload({
      filename: fullPayload.metadata.filename,
      blob,
      mimeType: "application/json",
      title: `Copia Integral (${state.products.length} prods, ${state.sales.length} ventas)`,
      description: `Respaldo integral del sistema: inventario en piso, almacén, ventas, arqueos Z y configuración.`,
      category: "JSON",
    });
  };

  // 2. Exportar Base de Datos de Productos y Ventas Específicamente (JSON)
  const handleExportProductsAndSalesJson = () => {
    const { blob, filename, summary } = buildProductsAndSalesJson(state);
    setStoragePayload({
      filename,
      blob,
      mimeType: "application/json",
      title: `Base de Datos: Productos y Ventas (${summary.productsCount} prods, ${summary.salesCount} ventas)`,
      description: `Respaldo enfocado en catálogo de artículos, existencias actuales y transacciones comerciales.`,
      category: "JSON",
    });
  };

  // 3. Exportar Catálogo de Inventario (JSON)
  const handleExportInventoryJson = () => {
    const dataStr = JSON.stringify(state.products, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const filename = `CajaMaster_Inventario_${new Date().toISOString().slice(0, 10)}.json`;
    setStoragePayload({
      filename,
      blob,
      mimeType: "application/json",
      title: `Catálogo de Inventario (${state.products.length} productos)`,
      description: `Catálogo de stock, almacén, costos, precios y códigos de barra.`,
      category: "JSON",
    });
  };

  // 4. Exportar Registro de Ventas (JSON)
  const handleExportSalesJson = () => {
    const dataStr = JSON.stringify(state.sales, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const filename = `CajaMaster_Ventas_${new Date().toISOString().slice(0, 10)}.json`;
    setStoragePayload({
      filename,
      blob,
      mimeType: "application/json",
      title: `Registro de Ventas (${state.sales.length} transacciones)`,
      description: `Historial de tickets, líneas de venta y métodos de pago.`,
      category: "JSON",
    });
  };

  // 5. Inventario CSV
  const handleExportInventoryCsv = () => {
    try {
      const { payload } = buildInventoryCatalogCsvPayload(
        state.products,
        state.business,
        state.rates
      );
      setStoragePayload(payload);
    } catch {
      setImportError("Error al generar CSV de inventario.");
    }
  };

  // 6. Cierres CSV
  const handleExportClosingsCsv = () => {
    if (!state.closings || state.closings.length === 0) {
      setImportError("No hay registros de cierres de caja guardados para exportar.");
      setTimeout(() => setImportError(null), 3500);
      return;
    }
    try {
      const { payload } = buildAllClosingsCsvPayload(
        state.closings,
        state.business,
        state.rates
      );
      setStoragePayload(payload);
    } catch {
      setImportError("Error al generar CSV de cierres de caja.");
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = ev.target?.result as string;
        const parsed = JSON.parse(raw);

        // Accept either full payload wrapper or direct state
        const targetState = parsed.snapshot ? parsed.snapshot : parsed;

        if (!targetState.products || !Array.isArray(targetState.products)) {
          throw new Error("El archivo no contiene una estructura válida de productos.");
        }

        setImportedData(targetState);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "El archivo JSON no tiene un formato válido.";
        setImportError(msg);
      }
    };
    reader.onerror = () => setImportError("Error al leer el archivo seleccionado.");
    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!importedData) return;
    actions.restoreBackup(importedData);
    setSuccessMsg("¡Base de datos restaurada con éxito!");
    setImportedData(null);
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1800);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 md:p-6"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-pop"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/20">
                <IconDownload size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 leading-tight">
                  Respaldos & Copias de Seguridad
                </h3>
                <p className="text-xs text-slate-500">
                  Exportación JSON de productos, ventas, inventario y cierres Z
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-100/80 px-4 pt-2 gap-1.5 overflow-x-auto shrink-0">
            <button
              onClick={() => setActiveTab("export")}
              className={`px-3.5 py-2 text-xs font-extrabold rounded-t-xl transition cursor-pointer shrink-0 ${
                activeTab === "export"
                  ? "bg-white text-emerald-950 border-t-2 border-emerald-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📥 Exportar JSON / CSV
            </button>
            <button
              onClick={() => setActiveTab("auto")}
              className={`px-3.5 py-2 text-xs font-extrabold rounded-t-xl transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeTab === "auto"
                  ? "bg-white text-emerald-950 border-t-2 border-emerald-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>⚙️ Respaldo Automático</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3.5 py-2 text-xs font-extrabold rounded-t-xl transition cursor-pointer shrink-0 ${
                activeTab === "history"
                  ? "bg-white text-emerald-950 border-t-2 border-emerald-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📋 Historial ({historyList.length})
            </button>
            <button
              onClick={() => setActiveTab("import")}
              className={`px-3.5 py-2 text-xs font-extrabold rounded-t-xl transition cursor-pointer shrink-0 ${
                activeTab === "import"
                  ? "bg-white text-emerald-950 border-t-2 border-emerald-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📤 Restaurar
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-pop">
                <IconCheck size={16} className="text-emerald-600 shrink-0" />
                {successMsg}
              </div>
            )}

            {importError && (
              <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-pop">
                <IconAlert size={16} className="text-rose-600 shrink-0" />
                {importError}
              </div>
            )}

            {/* TAB 1: EXPORTACIÓN MANUAL */}
            {activeTab === "export" && (
              <div className="space-y-3.5">
                {/* Local Storage Status Indicator */}
                <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">💾</span>
                    <div>
                      <div className="font-extrabold text-amber-400">
                        Base de Datos Local Activa
                      </div>
                      <div className="text-[11px] text-slate-300">
                        {state.products.length} productos • {state.sales.length} ventas • {state.closings?.length || 0} cierres Z
                      </div>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-[10px] font-mono font-bold text-emerald-400 border border-emerald-400/30">
                    100% OFFLINE
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Productos y Ventas JSON (Solicitud Específica) */}
                  <button
                    onClick={handleExportProductsAndSalesJson}
                    className="p-3.5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/60 hover:bg-emerald-100/60 text-left transition flex flex-col gap-1.5 cursor-pointer shadow-xs active:scale-98"
                  >
                    <div className="flex items-center gap-2 text-slate-900 font-black text-xs">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                        <IconDoc size={14} />
                      </div>
                      <span className="text-emerald-950">Productos y Ventas (JSON)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-tight">
                      Exporta el catálogo completo, precios, costos, existencias físicas y el registro histórico de todas las ventas.
                    </p>
                  </button>

                  {/* Respaldo Total del Sistema */}
                  <button
                    onClick={handleExportFullJson}
                    className="p-3.5 rounded-2xl border-2 border-slate-300 hover:border-slate-400 bg-slate-50 text-left transition flex flex-col gap-1.5 cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs">
                      <div className="w-7 h-7 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center">
                        <IconDownload size={14} />
                      </div>
                      <span>Respaldo Total del Sistema (JSON)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Incluye absolutamente todo: productos, ventas, movimientos de stock, cierres Z, comandas y configuración del negocio.
                    </p>
                  </button>

                  {/* Catálogo de Inventario JSON */}
                  <button
                    onClick={handleExportInventoryJson}
                    className="p-3.5 rounded-2xl border-2 border-slate-200 hover:border-slate-300 bg-white text-left transition flex flex-col gap-1.5 cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs">
                      <div className="w-7 h-7 rounded-lg bg-sky-500 text-white flex items-center justify-center">
                        <IconDoc size={14} />
                      </div>
                      <span>Solo Inventario & Almacén (JSON)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Códigos de barra, stock físico, costos de compra, categorías y unidades de medida.
                    </p>
                  </button>

                  {/* Solo Ventas JSON */}
                  <button
                    onClick={handleExportSalesJson}
                    className="p-3.5 rounded-2xl border-2 border-slate-200 hover:border-slate-300 bg-white text-left transition flex flex-col gap-1.5 cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs">
                      <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center">
                        <IconDownload size={14} />
                      </div>
                      <span>Solo Registro de Ventas (JSON)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Tickets emitidos, desglose de cobro por moneda y métodos de pago (Efectivo/Transferencia).
                    </p>
                  </button>

                  {/* Inventario CSV (Excel) */}
                  <button
                    onClick={handleExportInventoryCsv}
                    className="p-3.5 rounded-2xl border-2 border-slate-200 hover:border-slate-300 bg-white text-left transition flex flex-col gap-1.5 cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs">
                      <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
                        <IconFileSpreadsheet size={14} />
                      </div>
                      <span>Inventario en CSV (Excel)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Tabla de existencias y costos con compatibilidad para Microsoft Excel y Google Sheets.
                    </p>
                  </button>

                  {/* Cierres CSV (Excel) */}
                  <button
                    onClick={handleExportClosingsCsv}
                    className="p-3.5 rounded-2xl border-2 border-slate-200 hover:border-slate-300 bg-white text-left transition flex flex-col gap-1.5 cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs">
                      <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center">
                        <IconFileSpreadsheet size={14} />
                      </div>
                      <span>Cierres de Caja Z en CSV (Excel)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Historial contable de cuadres, balances de arqueo físico y diferencias de caja.
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: AUTOMATIZACIÓN DE RESPALDOS DIARIOS */}
            {activeTab === "auto" && (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-950 font-extrabold text-sm">
                    <span>⚡ ¿Cómo funciona el Respaldo Automático Diario?</span>
                  </div>
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    Al final de la jornada de trabajo, cuando el cajero o administrador genera el <strong>Cierre de Caja (Arqueo Z)</strong>, CajaMaster compila automáticamente un archivo JSON completo con:
                  </p>
                  <ul className="text-xs text-emerald-900 space-y-1 list-disc list-inside font-medium pt-1">
                    <li>El estado exacto del inventario a la venta y existencias en almacén.</li>
                    <li>Todas las ventas y tickets procesados en el día y en el historial.</li>
                    <li>Los movimientos de entrada, merma y ajustes físicos realizados.</li>
                    <li>El desglose financiero de efectivo, transferencias y descuadres.</li>
                  </ul>
                  <p className="text-[11px] text-emerald-800 pt-1">
                    El archivo se guarda en la memoria interna del equipo (carpeta <code>Documents/</code> o <code>Descargas</code>) y queda registrado en el historial para auditoría inmediata.
                  </p>
                </div>

                {/* Switch Principal */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-extrabold text-sm text-slate-900">
                      Respaldo Automático al Cerrar Caja (Arqueo Z)
                    </div>
                    <div className="text-xs text-slate-500">
                      Guarda un snapshot JSON cada vez que se finaliza un cierre diario.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoConfig.autoBackupOnClosing}
                      onChange={(e) => handleToggleAutoBackup("autoBackupOnClosing", e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                  </label>
                </div>

                {/* Notificación en pantalla */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-extrabold text-sm text-slate-900">
                      Aviso en Pantalla al Generar Respaldo
                    </div>
                    <div className="text-xs text-slate-500">
                      Muestra un mensaje confirmando el nombre del archivo JSON guardado.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoConfig.notifyOnSuccess}
                      onChange={(e) => handleToggleAutoBackup("notifyOnSuccess", e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                  </label>
                </div>

                {/* Retención de copias en historial */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-extrabold text-sm text-slate-900">
                      Retención de Respaldos en Memoria Local
                    </div>
                    <div className="text-xs text-slate-500">
                      Cantidad de registros a conservar en el visor del sistema.
                    </div>
                  </div>
                  <select
                    value={autoConfig.keepHistoryCount}
                    onChange={(e) => handleToggleAutoBackup("keepHistoryCount", Number(e.target.value))}
                    className="bg-white border border-slate-300 text-slate-900 font-bold text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-600"
                  >
                    <option value={10}>10 copias</option>
                    <option value={20}>20 copias</option>
                    <option value={30}>30 copias</option>
                    <option value={50}>50 copias</option>
                  </select>
                </div>
              </div>
            )}

            {/* TAB 3: HISTORIAL DE RESPALDOS GENERADOS */}
            {activeTab === "history" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Respaldos registrados en este dispositivo:</span>
                  <span className="font-bold text-slate-800">{historyList.length} registro(s)</span>
                </div>

                {historyList.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                    <span className="text-3xl">📦</span>
                    <div className="text-xs font-bold text-slate-600">Aún no se han generado respaldos</div>
                    <div className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Al realizar un Cierre de Caja Z o pulsar en "Exportar JSON" quedará registrado aquí.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {historyList.map((meta) => (
                      <div
                        key={meta.id}
                        className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs hover:border-slate-300 transition"
                      >
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <div className="font-extrabold text-slate-900 truncate">
                            {meta.filename}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-2">
                            <span>📅 {new Date(meta.timestamp).toLocaleString("es-ES")}</span>
                            <span>•</span>
                            <span className="font-bold text-emerald-700">
                              {meta.triggeredBy === "DAILY_CLOSING_AUTO" ? "⚡ Cierre Z Automático" : "👤 Manual"}
                            </span>
                          </div>
                          <div className="text-[10.5px] text-slate-600">
                            {meta.totalProducts} productos • {meta.totalSales} ventas • Stock: {meta.inventoryUnits} u
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              // Descargar copia inmediata del estado actual
                              handleExportFullJson();
                            }}
                            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-emerald-700 font-bold text-xs transition cursor-pointer"
                            title="Descargar respaldo"
                          >
                            <IconDownload size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: RESTAURAR DESDE ARCHIVO JSON */}
            {activeTab === "import" && (
              <div className="space-y-3.5">
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1.5">
                  <div className="font-extrabold flex items-center gap-1.5">
                    <IconAlert size={15} className="text-amber-600" />
                    <span>Restauración de Copia de Seguridad</span>
                  </div>
                  <p className="leading-relaxed">
                    Al cargar un archivo JSON de respaldo, se restaurará el catálogo de productos, las existencias, el historial de ventas y los arqueos de caja tal como estaban cuando se creó el respaldo.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border-2 border-dashed border-slate-300 text-center space-y-3 bg-slate-50">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-slate-200 text-slate-700 flex items-center justify-center mx-auto text-xl">
                    📁
                  </div>
                  <div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs cursor-pointer transition shadow-xs"
                    >
                      Seleccionar Archivo JSON
                    </button>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Admite respaldos completos de CajaMaster POS (.json)
                    </p>
                  </div>
                </div>

                {importedData && (
                  <div className="p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50 space-y-3 animate-pop">
                    <div className="flex items-center gap-2 text-emerald-950 font-black text-xs">
                      <IconCheck size={16} className="text-emerald-600" />
                      <span>Archivo Válido Detectado</span>
                    </div>

                    <div className="text-xs text-slate-700 grid grid-cols-2 gap-2 bg-white p-3 rounded-xl border border-emerald-200">
                      <div>
                        <strong>Productos:</strong> {importedData.products?.length || 0}
                      </div>
                      <div>
                        <strong>Ventas:</strong> {importedData.sales?.length || 0}
                      </div>
                      <div>
                        <strong>Cierres Z:</strong> {importedData.closings?.length || 0}
                      </div>
                      <div>
                        <strong>Negocio:</strong> {importedData.business?.name || "Sin nombre"}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleConfirmRestore}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition cursor-pointer shadow-md"
                      >
                        Confirmar y Restaurar Base de Datos
                      </button>
                      <button
                        onClick={() => setImportedData(null)}
                        className="px-3 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <span className="text-[11px]">CajaMaster POS • Motor Offline v1.3.3</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-xs transition cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Storage Destination Modal for Universal Saving (Device/USB/Cloud/Share) */}
      {storagePayload && (
        <StorageDestinationModal
          isOpen={true}
          onClose={() => setStoragePayload(null)}
          payload={storagePayload}
          defaultDestination="internal"
        />
      )}
    </>
  );
}
