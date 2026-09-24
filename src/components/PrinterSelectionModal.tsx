import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  IconPrinter,
  IconBluetooth,
  IconUsb,
  IconEthernet,
  IconWifi,
  IconCheck,
  IconTrash,
  IconPlus,
  IconRefreshCw,
  IconSliders,
  IconBolt,
  IconHelp,
} from "./Icons";
import {
  getPrinterSettings,
  savePrinterDevice,
  deletePrinterDevice,
  setDefaultPrinterId,
  savePrinterSettings,
  scanBluetoothPrinter,
  scanUsbPrinter,
  printTestTicket,
  type DEFAULT_PRINTER_SETTINGS,
} from "../services/printerService";
import type {
  PrinterDevice,
  PrinterSettings,
  PrinterConnectionType,
  PrinterPaperWidth,
  BusinessInfo,
  ExchangeRates,
} from "../types";
import { useStore } from "../store";

export interface PrinterSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAndPrint?: (printer: PrinterDevice) => void;
  title?: string;
  subtitle?: string;
}

export function PrinterSelectionModal({
  isOpen,
  onClose,
  onSelectAndPrint,
  title = "Gestor & Selección de Impresoras",
  subtitle = "Bluetooth, Wi-Fi, USB, Ethernet y Sistema",
}: PrinterSelectionModalProps) {
  const state = useStore();
  const [settings, setSettings] = useState<PrinterSettings>(() => getPrinterSettings());
  const [activeTab, setActiveTab] = useState<"select" | "add" | "options">("select");
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>(() => {
    return settings.defaultPrinterId || (settings.printers[0]?.id ?? "system-default");
  });

  // New Printer Form State
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<PrinterConnectionType>("bluetooth");
  const [newWidth, setNewWidth] = useState<PrinterPaperWidth>("58mm");
  const [newIp, setNewIp] = useState("192.168.1.100");
  const [newPort, setNewPort] = useState(9100);
  const [newAutoCut, setNewAutoCut] = useState(true);
  const [newOpenDrawer, setNewOpenDrawer] = useState(false);
  const [newSetDefault, setNewSetDefault] = useState(true);

  // Scanning & Testing States
  const [isScanning, setIsScanning] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setFeedbackToast({ text, type });
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  const refreshSettings = () => {
    const updated = getPrinterSettings();
    setSettings(updated);
    if (!updated.printers.some((p) => p.id === selectedPrinterId)) {
      setSelectedPrinterId(updated.defaultPrinterId || updated.printers[0]?.id || "");
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshSettings();
    }
  }, [isOpen]);

  const handleScanBluetooth = async () => {
    try {
      setIsScanning(true);
      const res = await scanBluetoothPrinter();
      if (res) {
        setNewName(res.name);
        setNewType("bluetooth");
        showToast(`Dispositivo Bluetooth encontrado: ${res.name}`, "success");
      }
    } catch (err: any) {
      console.warn("Bluetooth scan error:", err);
      showToast(err.message || "Error al buscar Bluetooth", "error");
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanUsb = async () => {
    try {
      setIsScanning(true);
      const res = await scanUsbPrinter();
      if (res) {
        setNewName(res.name);
        setNewType("usb");
        showToast(`Dispositivo USB detectado: ${res.name}`, "success");
      }
    } catch (err: any) {
      console.warn("USB scan error:", err);
      showToast(err.message || "Error al conectar por USB", "error");
    } finally {
      setIsScanning(false);
    }
  };

  const handleCreatePrinter = () => {
    const printerName =
      newName.trim() ||
      (newType === "bluetooth"
        ? "Térmica Bluetooth 58mm"
        : newType === "wifi"
        ? `Impresora Wi-Fi (${newIp})`
        : newType === "usb"
        ? "Impresora USB POS"
        : newType === "ethernet"
        ? `Impresora Ethernet LAN (${newIp})`
        : "Impresora del Sistema");

    const device: PrinterDevice = {
      id: `printer_${Date.now()}`,
      name: printerName,
      connectionType: newType,
      paperWidth: newWidth,
      ipAddress: newType === "wifi" || newType === "ethernet" ? newIp.trim() : undefined,
      port: newType === "wifi" || newType === "ethernet" ? Number(newPort) || 9100 : undefined,
      autoCut: newAutoCut,
      openCashDrawer: newOpenDrawer,
      isDefault: newSetDefault,
      createdAt: Date.now(),
    };

    savePrinterDevice(device);
    refreshSettings();
    setSelectedPrinterId(device.id);
    setActiveTab("select");
    showToast(`¡Impresora "${printerName}" vinculada con éxito!`, "success");

    // Reset form
    setNewName("");
    setNewIp("192.168.1.100");
  };

  const handleDelete = (id: string, name: string) => {
    if (id === "system-default") {
      showToast("La impresora del sistema es obligatoria como respaldo.", "info");
      return;
    }
    if (confirm(`¿Eliminar la impresora "${name}"?`)) {
      deletePrinterDevice(id);
      refreshSettings();
      showToast(`Impresora "${name}" eliminada.`, "info");
    }
  };

  const handleSetDefault = (id: string) => {
    setDefaultPrinterId(id);
    refreshSettings();
    setSelectedPrinterId(id);
    showToast("Impresora predeterminada actualizada.", "success");
  };

  const handleTestPrint = async (printer: PrinterDevice) => {
    try {
      setIsTesting(true);
      const res = await printTestTicket(printer, state.business, state.rates);
      if (res.success) {
        showToast(`Ticket de prueba enviado a "${printer.name}"`, "success");
      } else {
        showToast(res.message || "Error al imprimir prueba", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Error al ejecutar prueba", "error");
    } finally {
      setIsTesting(false);
    }
  };

  const handleConfirmAndPrint = () => {
    const p = settings.printers.find((item) => item.id === selectedPrinterId) || settings.printers[0];
    if (!p) {
      showToast("Selecciona una impresora válida.", "error");
      return;
    }
    if (onSelectAndPrint) {
      onSelectAndPrint(p);
    }
    onClose();
  };

  if (!isOpen) return null;

  const currentPrinter = settings.printers.find((p) => p.id === selectedPrinterId) || settings.printers[0];

  const getConnectionIcon = (type: PrinterConnectionType) => {
    switch (type) {
      case "bluetooth":
        return <IconBluetooth size={16} className="text-blue-500" />;
      case "wifi":
        return <IconWifi size={16} className="text-emerald-500" />;
      case "usb":
        return <IconUsb size={16} className="text-purple-500" />;
      case "ethernet":
        return <IconEthernet size={16} className="text-amber-500" />;
      default:
        return <IconPrinter size={16} className="text-slate-600" />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="printer-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          key="printer-modal-card"
          initial={{ scale: 0.92, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                <IconPrinter size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm leading-tight">{title}</h3>
                <p className="text-[11px] text-slate-400">{subtitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs cursor-pointer transition"
            >
              ✕
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="p-2 bg-slate-100 border-b border-slate-200 flex items-center gap-1 shrink-0">
            <button
              onClick={() => setActiveTab("select")}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === "select"
                  ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/10"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <IconPrinter size={14} />
              <span>Impresoras ({settings.printers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("add")}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === "add"
                  ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/10"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <IconPlus size={14} />
              <span>Vincular Nueva</span>
            </button>

            <button
              onClick={() => setActiveTab("options")}
              className={`py-1.5 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === "options"
                  ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/10"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <IconSliders size={14} />
              <span>Ajustes</span>
            </button>
          </div>

          {/* Toast Alert */}
          {feedbackToast && (
            <div
              className={`px-3 py-2 text-xs font-bold flex items-center justify-between animate-pop shrink-0 ${
                feedbackToast.type === "success"
                  ? "bg-emerald-600 text-white"
                  : feedbackToast.type === "error"
                  ? "bg-rose-600 text-white"
                  : "bg-amber-400 text-slate-950 font-black"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <IconCheck size={14} />
                <span>{feedbackToast.text}</span>
              </div>
              <button onClick={() => setFeedbackToast(null)} className="font-bold text-xs opacity-80 hover:opacity-100">
                ✕
              </button>
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-slate-900 min-h-0">
            {/* TAB 1: LIST / SELECT PRINTER */}
            {activeTab === "select" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Terminales e Impresoras Disponibles
                  </span>
                  <button
                    onClick={() => setActiveTab("add")}
                    className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
                  >
                    <IconPlus size={12} />
                    <span>Añadir otra</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {settings.printers.map((printer) => {
                    const isSelected = printer.id === selectedPrinterId;
                    const isDefault = printer.id === settings.defaultPrinterId;

                    return (
                      <div
                        key={printer.id}
                        onClick={() => setSelectedPrinterId(printer.id)}
                        className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col gap-2.5 ${
                          isSelected
                            ? "bg-slate-50 border-slate-900 ring-2 ring-slate-900/10 shadow-xs"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                printer.connectionType === "bluetooth"
                                  ? "bg-blue-100 text-blue-800"
                                  : printer.connectionType === "wifi"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : printer.connectionType === "usb"
                                  ? "bg-purple-100 text-purple-800"
                                  : printer.connectionType === "ethernet"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-200 text-slate-800"
                              }`}
                            >
                              {getConnectionIcon(printer.connectionType)}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-xs text-slate-900 truncate">
                                  {printer.name}
                                </span>
                                {isDefault && (
                                  <span className="text-[9.5px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-2xs">
                                    ⭐ Predeterminada
                                  </span>
                                )}
                              </div>
                              <div className="text-[10.5px] text-slate-500 flex items-center gap-2 mt-0.5">
                                <span className="uppercase font-bold">
                                  {printer.connectionType} • {printer.paperWidth}
                                </span>
                                {printer.ipAddress && (
                                  <span className="font-mono text-slate-400">
                                    {printer.ipAddress}:{printer.port || 9100}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTestPrint(printer);
                              }}
                              disabled={isTesting}
                              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition cursor-pointer"
                              title="Imprimir ticket de prueba"
                            >
                              Probar
                            </button>

                            {printer.id !== "system-default" && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(printer.id, printer.name);
                                }}
                                className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                title="Eliminar impresora"
                              >
                                <IconTrash size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Quick actions for selected */}
                        {isSelected && !isDefault && (
                          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 font-medium">
                              ¿Usar siempre esta impresora por defecto?
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetDefault(printer.id);
                              }}
                              className="text-[11px] font-extrabold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
                            >
                              <span>Establecer como Predeterminada</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Helpful hardware tip */}
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-[11px] text-amber-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <IconBolt size={14} className="text-amber-600 shrink-0" />
                    <span>Compatibilidad Universal POS:</span>
                  </div>
                  <p className="text-slate-700">
                    Soporta marcas térmicas universales (Epson, Xprinter, GOOJPRT, POS-58/80, Munbyn, Zijiang, Netum).
                    Si imprimes desde móvil Android/iOS sin Bluetooth vinculado, la opción <strong>Impresora del Sistema</strong> te permite imprimir directamente por el diálogo nativo o guardar en PDF.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: ADD NEW PRINTER */}
            {activeTab === "add" && (
              <div className="space-y-4">
                {/* Connection Type Grid */}
                <div>
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1.5">
                    1. Tipo de Conexión
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { type: "bluetooth", label: "Bluetooth", icon: <IconBluetooth size={16} /> },
                      { type: "wifi", label: "Wi-Fi (Red)", icon: <IconWifi size={16} /> },
                      { type: "usb", label: "USB / Cable", icon: <IconUsb size={16} /> },
                      { type: "ethernet", label: "Ethernet LAN", icon: <IconEthernet size={16} /> },
                      { type: "system", label: "Sistema / PDF", icon: <IconPrinter size={16} /> },
                    ].map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => setNewType(item.type as PrinterConnectionType)}
                        className={`p-2.5 rounded-2xl border text-xs font-extrabold flex items-center gap-2 transition cursor-pointer ${
                          newType === item.type
                            ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Direct Scan Actions for Bluetooth or USB */}
                {newType === "bluetooth" && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-blue-950">
                        Vincular Bluetooth Inalámbrico
                      </div>
                      <button
                        type="button"
                        onClick={handleScanBluetooth}
                        disabled={isScanning}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition active:scale-95"
                      >
                        <IconRefreshCw size={13} className={isScanning ? "animate-spin" : ""} />
                        <span>{isScanning ? "Buscando..." : "Escanear Bluetooth"}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-blue-800">
                      Enciende tu impresora térmica portátil y activa el Bluetooth en tu móvil o tableta.
                    </p>
                  </div>
                )}

                {newType === "usb" && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-purple-950">
                        Conexión Cable USB / Serie POS
                      </div>
                      <button
                        type="button"
                        onClick={handleScanUsb}
                        disabled={isScanning}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition active:scale-95"
                      >
                        <IconRefreshCw size={13} className={isScanning ? "animate-spin" : ""} />
                        <span>{isScanning ? "Detectando..." : "Detectar Puerto USB"}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-purple-800">
                      Ideal para computadoras de mostrador y cajas fijas con impresora cableada.
                    </p>
                  </div>
                )}

                {/* Network IP & Port inputs for Wi-Fi / Ethernet */}
                {(newType === "wifi" || newType === "ethernet") && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                    <div className="text-xs font-bold text-emerald-950">
                      Configuración de Dirección de Red (IP & Puerto)
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Dirección IP en la red local:
                        </label>
                        <input
                          type="text"
                          value={newIp}
                          onChange={(e) => setNewIp(e.target.value)}
                          placeholder="192.168.1.100"
                          className="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-white text-slate-900 outline-none focus:border-emerald-600"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Puerto Raw:
                        </label>
                        <input
                          type="number"
                          value={newPort}
                          onChange={(e) => setNewPort(Number(e.target.value))}
                          placeholder="9100"
                          className="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-white text-slate-900 outline-none focus:border-emerald-600"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Name and Paper Width */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      2. Nombre o Alias del Dispositivo
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Ej: Impresora Térmica Barra / Cocina / Caja 1"
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 text-slate-900 outline-none focus:border-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      3. Formato y Ancho del Rollo de Papel
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewWidth("58mm")}
                        className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                          newWidth === "58mm"
                            ? "bg-amber-50 border-amber-400 ring-2 ring-amber-400/20"
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="font-extrabold text-xs text-slate-900">58 mm (Estándar)</div>
                        <div className="text-[10.5px] text-slate-500">Rollos estándar de 32 columnas</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewWidth("80mm")}
                        className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                          newWidth === "80mm"
                            ? "bg-amber-50 border-amber-400 ring-2 ring-amber-400/20"
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="font-extrabold text-xs text-slate-900">80 mm (Ancho)</div>
                        <div className="text-[10.5px] text-slate-500">Formato ancho de 48 columnas</div>
                      </button>
                    </div>
                  </div>

                  {/* Hardware Toggles */}
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
                      <span>Corte automático de papel (Auto-Cut ESC/POS)</span>
                      <input
                        type="checkbox"
                        checked={newAutoCut}
                        onChange={(e) => setNewAutoCut(e.target.checked)}
                        className="w-4 h-4 rounded text-slate-900 accent-amber-500"
                      />
                    </label>

                    <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
                      <span>Apertura de cajón portamonedas al imprimir</span>
                      <input
                        type="checkbox"
                        checked={newOpenDrawer}
                        onChange={(e) => setNewOpenDrawer(e.target.checked)}
                        className="w-4 h-4 rounded text-slate-900 accent-amber-500"
                      />
                    </label>

                    <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
                      <span>Establecer como impresora predeterminada</span>
                      <input
                        type="checkbox"
                        checked={newSetDefault}
                        onChange={(e) => setNewSetDefault(e.target.checked)}
                        className="w-4 h-4 rounded text-slate-900 accent-amber-500"
                      />
                    </label>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleCreatePrinter}
                    className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg transition cursor-pointer"
                  >
                    <IconCheck size={16} />
                    <span>Guardar y Vincular Impresora</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: GLOBAL PREFERENCES */}
            {activeTab === "options" && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">
                        Imprimir automáticamente al cobrar
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Envía el ticket directo a la impresora predeterminada al registrar la venta
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoPrintOnFinishSale}
                      onChange={(e) => {
                        const updated = { ...settings, autoPrintOnFinishSale: e.target.checked };
                        setSettings(updated);
                        savePrinterSettings(updated);
                      }}
                      className="w-5 h-5 rounded accent-amber-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">
                        Abrir selector dinámico si no hay impresora predeterminada
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Permite elegir la impresora en cada operación
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoOpenSelectorIfNoDefault}
                      onChange={(e) => {
                        const updated = { ...settings, autoOpenSelectorIfNoDefault: e.target.checked };
                        setSettings(updated);
                        savePrinterSettings(updated);
                      }}
                      className="w-5 h-5 rounded accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1">
                  <strong className="text-slate-900 block font-extrabold">Información del Sistema:</strong>
                  <div>Dispositivos vinculados: {settings.printers.length}</div>
                  <div>
                    Predeterminada:{" "}
                    <span className="font-bold text-slate-900">
                      {settings.printers.find((p) => p.id === settings.defaultPrinterId)?.name || "Ninguna"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <div className="text-[11px] text-slate-500 truncate hidden sm:block">
              {currentPrinter ? (
                <span>
                  Seleccionada: <strong className="text-slate-900">{currentPrinter.name}</strong>
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition cursor-pointer"
              >
                Cerrar
              </button>

              {onSelectAndPrint && (
                <button
                  type="button"
                  onClick={handleConfirmAndPrint}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg transition cursor-pointer"
                >
                  <IconPrinter size={15} />
                  <span>Imprimir con esta</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
