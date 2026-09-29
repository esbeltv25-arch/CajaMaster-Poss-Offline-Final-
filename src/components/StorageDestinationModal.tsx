import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  IconSmartphone,
  IconUsb,
  IconWifi,
  IconDownload,
  IconShare,
  IconX,
  IconCheck,
  IconDoc,
  IconFileSpreadsheet,
  IconLayers,
  IconAlert,
} from "./Icons";
import {
  saveFileWithDestination,
  formatFileSize,
  type FileExportPayload,
  type StorageDestination,
  type SaveResult,
} from "../utils/fileStorage";

export interface StorageDestinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: FileExportPayload | null;
  onSaved?: (result: SaveResult) => void;
}

export function StorageDestinationModal({
  isOpen,
  onClose,
  payload,
  onSaved,
}: StorageDestinationModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDest, setSelectedDest] = useState<StorageDestination | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen || !payload) return null;

  const handleSelectDestination = async (dest: StorageDestination) => {
    setSelectedDest(dest);
    setIsProcessing(true);
    setStatusMessage("Procesando y guardando archivo...");

    try {
      const res = await saveFileWithDestination(payload, dest);
      setStatusMessage(res.message);
      if (onSaved) {
        onSaved(res);
      }
      setTimeout(() => {
        setIsProcessing(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error("Storage error:", err);
      setStatusMessage("Error al procesar el almacenamiento.");
      setIsProcessing(false);
    }
  };

  const isPdf = payload.filename.toLowerCase().endsWith(".pdf") || payload.mimeType.includes("pdf");
  const isCsv = payload.filename.toLowerCase().endsWith(".csv") || payload.mimeType.includes("csv");
  const isJson = payload.filename.toLowerCase().endsWith(".json") || payload.mimeType.includes("json");

  return (
    <div
      id="storage-destination-backdrop"
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200"
      onClick={!isProcessing ? onClose : undefined}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 15 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-sm">
              {isPdf ? (
                <IconDoc size={20} />
              ) : isCsv ? (
                <IconFileSpreadsheet size={20} />
              ) : (
                <IconDownload size={20} />
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight leading-tight">
                ¿Dónde deseas guardar el reporte?
              </h3>
              <p className="text-[11px] text-blue-200/90 font-medium mt-0.5">
                Selecciona la ubicación de almacenamiento
              </p>
            </div>
          </div>

          {!isProcessing && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            >
              <IconX size={16} />
            </button>
          )}
        </div>

        {/* File Details Card */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80">
          <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                  isPdf
                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                    : isCsv
                    ? "bg-teal-100 text-teal-800 border border-teal-200"
                    : "bg-amber-100 text-amber-900 border border-amber-200"
                }`}
              >
                {isPdf ? "PDF" : isCsv ? "EXCEL CSV" : isJson ? "JSON" : "DOC"}
              </span>
              <div className="min-w-0">
                <div className="font-extrabold text-xs text-slate-900 truncate">
                  {payload.filename}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  {payload.title} • {formatFileSize(payload.blob.size)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Options Grid */}
        <div className="p-4 sm:p-5 space-y-2.5">
          {/* Option 1: Memoria Interna */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleSelectDestination("internal")}
            className="w-full text-left p-3.5 rounded-2xl bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-400/80 shadow-2xs hover:shadow-sm transition group cursor-pointer active:scale-98 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 group-hover:bg-amber-500 group-hover:text-slate-950 flex items-center justify-center font-bold transition shrink-0">
                <IconSmartphone size={22} />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                  <span>Memoria Interna</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-bold border border-slate-200">
                    Descargas / Local
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-snug">
                  Guarda directamente en la carpeta de Descargas o almacenamiento interno del dispositivo.
                </p>
              </div>
            </div>
            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 group-hover:bg-amber-500 group-hover:text-slate-950 flex items-center justify-center shrink-0 transition">
              <IconDownload size={13} />
            </div>
          </button>

          {/* Option 2: Memoria Externa (USB / Tarjeta SD) */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleSelectDestination("external")}
            className="w-full text-left p-3.5 rounded-2xl bg-white hover:bg-blue-50/60 border border-slate-200 hover:border-blue-400/80 shadow-2xs hover:shadow-sm transition group cursor-pointer active:scale-98 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center font-bold transition shrink-0">
                <IconUsb size={22} />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                  <span>Memoria Externa / USB / SD</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 font-bold border border-blue-200">
                    OTG / MicroSD
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-snug">
                  Permite elegir unidad USB externa, tarjeta MicroSD o carpeta dedicada para copias de seguridad.
                </p>
              </div>
            </div>
            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center shrink-0 transition">
              <IconUsb size={13} />
            </div>
          </button>

          {/* Option 3: Almacenamiento en la Nube / Compartir */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleSelectDestination("cloud")}
            className="w-full text-left p-3.5 rounded-2xl bg-white hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-400/80 shadow-2xs hover:shadow-sm transition group cursor-pointer active:scale-98 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center font-bold transition shrink-0">
                <IconShare size={22} />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                  <span>Nube & Compartir</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                    Drive • WhatsApp • Email
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-snug">
                  Sube directamente a Google Drive, OneDrive, Dropbox o comparte el archivo vía WhatsApp / Gmail.
                </p>
              </div>
            </div>
            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center shrink-0 transition">
              <IconShare size={13} />
            </div>
          </button>
        </div>

        {/* Processing / Status Toast Area */}
        {statusMessage && (
          <div className="p-3 bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-2 border-t border-slate-800 animate-pop">
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <IconCheck size={16} className="text-emerald-400" />
            )}
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-xs transition cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
