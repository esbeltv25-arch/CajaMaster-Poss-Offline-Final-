import { useState, useRef, type ChangeEvent } from "react";
import {
  IconDownload,
  IconUpload,
  IconCheck,
  IconAlert,
  IconTrash,
  IconDoc,
  IconFileSpreadsheet,
} from "./Icons";
import { useStore, actions } from "../store";
import type { AppState } from "../types";
import {
  downloadOrShareInventoryCatalogCsv,
  downloadOrShareAllClosingsCsv,
} from "../utils/csvExport";

export function BackupModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const state = useStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importedData, setImportedData] = useState<AppState | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExportJson = () => {
    actions.exportBackup();
    setSuccessMsg("Copia de seguridad completa (JSON) descargada exitosamente.");
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleExportSalesJson = () => {
    actions.exportSalesJson();
    setSuccessMsg("Historial de ventas (JSON) descargado exitosamente.");
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleExportInventoryJson = () => {
    actions.exportInventoryJson();
    setSuccessMsg("Catálogo de inventario (JSON) descargado exitosamente.");
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleExportInventoryCsv = async () => {
    try {
      await downloadOrShareInventoryCatalogCsv(state.products, state.business, state.rates);
      setSuccessMsg("Catálogo de inventario (CSV) descargado para Excel y Google Sheets.");
    } catch {
      setImportError("Error al generar CSV de inventario.");
    } finally {
      setTimeout(() => {
        setSuccessMsg(null);
        setImportError(null);
      }, 3500);
    }
  };

  const handleExportClosingsCsv = async () => {
    if (!state.closings || state.closings.length === 0) {
      setImportError("No hay registros de cierres de caja guardados para exportar.");
      setTimeout(() => setImportError(null), 3500);
      return;
    }
    try {
      await downloadOrShareAllClosingsCsv(state.closings, state.business, state.rates);
      setSuccessMsg("Historial de cierres de caja (CSV) descargado para Excel y Google Sheets.");
    } catch {
      setImportError("Error al generar CSV de cierres de caja.");
    } finally {
      setTimeout(() => {
        setSuccessMsg(null);
        setImportError(null);
      }, 3500);
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

        // Basic validation
        if (!parsed.products || !Array.isArray(parsed.products)) {
          throw new Error("El archivo no contiene una estructura válida de productos.");
        }

        setImportedData(parsed);
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
    setImportedData(null);
    setSuccessMsg("¡Datos restaurados correctamente!");
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-pop"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-black/10 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-extrabold shadow-md">
              <IconDownload size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-base leading-tight">
                Copias de Seguridad y Respaldo
              </h2>
              <p className="text-xs text-white/70">
                Exporta, importa y resguarda todo tu negocio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs cursor-pointer transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto text-slate-800">
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-pop">
              <IconCheck size={16} className="text-emerald-600" />
              {successMsg}
            </div>
          )}

          {importError && (
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-pop">
              <IconAlert size={16} className="text-rose-600 shrink-0" />
              {importError}
            </div>
          )}

          {/* Local Storage Status Indicator */}
          <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">💾</span>
              <div>
                <div className="font-extrabold text-amber-400">
                  Almacenamiento Local Activo
                </div>
                <div className="text-[11px] text-slate-300">
                  {state.products.length} productos • {state.sales.length} ventas guardadas
                </div>
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-white/10 text-[10px] font-mono font-bold text-emerald-400 border border-emerald-400/30">
              OFFLINE OK
            </div>
          </div>

          {/* Export Section */}
          <div>
            <div className="text-[11px] tracking-widest font-extrabold text-slate-500 uppercase mb-2.5">
              1. DESCARGAR COPIA DE SEGURIDAD (JSON / CSV)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Full JSON */}
              <button
                onClick={handleExportJson}
                className="p-3.5 rounded-2xl border-2 border-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 text-left transition flex flex-col gap-1.5 cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                    <IconDownload size={14} />
                  </div>
                  <span className="text-emerald-950">Respaldo Total (JSON)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-tight">
                  Descarga completa: Inventario con fotos, registro de ventas, cierres Z, reportes IPVE y configuración.
                </p>
              </button>

              {/* Sales JSON */}
              <button
                onClick={handleExportSalesJson}
                className="p-3.5 rounded-2xl border-2 border-slate-200 hover:border-slate-400 bg-slate-50 text-left transition flex flex-col gap-1.5 cursor-pointer"
              >
                <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs">
                  <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center">
                    <IconDownload size={14} />
                  </div>
                  <span>Registro de Ventas (JSON)</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Descarga solo el historial cronológico de ventas, tickets emitidos y desglose de cobro.
                </p>
              </button>

              {/* Inventory JSON */}
              <button
                onClick={handleExportInventoryJson}
                className="p-3.5 rounded-2xl border-2 border-slate-200 hover:border-slate-400 bg-slate-50 text-left transition flex flex-col gap-1.5 cursor-pointer"
              >
                <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs">
                  <div className="w-7 h-7 rounded-lg bg-sky-500 text-white flex items-center justify-center">
                    <IconDoc size={14} />
                  </div>
                  <span>Catálogo de Inventario (JSON)</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Descarga productos, precios, costos, existencias físicas, códigos de barra y categorías.
                </p>
              </button>

              {/* Inventory CSV */}
              <button
                onClick={handleExportInventoryCsv}
                className="p-3.5 rounded-2xl border-2 border-slate-200 hover:border-slate-400 bg-slate-50 text-left transition flex flex-col gap-1.5 cursor-pointer"
              >
                <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                    <IconFileSpreadsheet size={14} />
                  </div>
                  <span>Inventario en CSV (Excel)</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Formato tabular con existencias, costos, precios y márgenes para abrir en Excel o Sheets.
                </p>
              </button>

              {/* Closings CSV */}
              <button
                onClick={handleExportClosingsCsv}
                className="p-3.5 rounded-2xl border-2 border-slate-200 hover:border-slate-400 bg-slate-50 text-left transition flex flex-col gap-1.5 cursor-pointer"
              >
                <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs">
                  <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center">
                    <IconFileSpreadsheet size={14} />
                  </div>
                  <span>Cierres de Caja en CSV (Excel)</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Historial consolidado de arqueos de caja, ventas en efectivo/transferencia y balances Z.
                </p>
              </button>
            </div>
          </div>

          {/* Import / Restore Section */}
          <div>
            <div className="text-[11px] tracking-widest font-extrabold text-slate-500 uppercase mb-2.5">
              2. RESTAURAR DESDE UN ARCHIVO DE RESPALDO
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />

            {!importedData ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/70 hover:bg-slate-50 transition flex flex-col items-center justify-center gap-2 text-center cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-200 text-slate-700 flex items-center justify-center">
                  <IconUpload size={22} />
                </div>
                <div className="font-extrabold text-xs text-slate-800">
                  Seleccionar archivo de copia de seguridad (.json)
                </div>
                <div className="text-[11px] text-slate-500">
                  Toca aquí para buscar el archivo descargado en tu dispositivo
                </div>
              </button>
            ) : (
              /* Confirmation Box when file loaded */
              <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-3 animate-pop">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-amber-950 flex items-center gap-1.5">
                    <IconCheck size={16} className="text-emerald-600" /> Archivo Válido Detectado
                  </span>
                  <button
                    onClick={() => setImportedData(null)}
                    className="text-xs text-slate-500 hover:text-slate-900 font-bold"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center bg-white p-3 rounded-xl border border-amber-200">
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold">PRODUCTOS</div>
                    <div className="text-base font-extrabold text-slate-900">
                      {importedData.products?.length || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold">VENTAS</div>
                    <div className="text-base font-extrabold text-slate-900">
                      {importedData.sales?.length || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold">CIERRES</div>
                    <div className="text-base font-extrabold text-slate-900">
                      {importedData.closings?.length || 0}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-amber-900">
                  ⚠️ <strong>Atención:</strong> Al restaurar este archivo, el catálogo actual será reemplazado por la información contenida en el respaldo.
                </p>

                <button
                  onClick={handleConfirmRestore}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer"
                >
                  <IconCheck size={15} /> Confirmar y Restaurar Datos
                </button>
              </div>
            )}
          </div>

          {/* Quick Snapshot info */}
          <div className="p-3.5 bg-slate-100 rounded-2xl text-[11px] text-slate-600 leading-relaxed">
            💾 <strong>Almacenamiento Local Seguro:</strong> La aplicación guarda automáticamente cada movimiento de venta o ajuste en el almacenamiento persistente del dispositivo.
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
