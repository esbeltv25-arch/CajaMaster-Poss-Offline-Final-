import { useState } from "react";
import { motion } from "motion/react";
import { IconX, IconCode, IconCheck, IconCopy, IconBuilding } from "../Icons";
import type { DeliveryAgency, DeliveryOrder } from "../../types";

export function WebhookSimulatorModal({
  agency,
  order,
  isOpen,
  onClose,
}: {
  agency: DeliveryAgency | null;
  order: DeliveryOrder | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: number; message: string; trackingId: string } | null>(null);

  if (!isOpen || !agency) return null;

  const samplePayload = {
    event: "delivery.dispatch_requested",
    timestamp: new Date().toISOString(),
    agency: {
      id: agency.id,
      name: agency.name,
    },
    order: {
      id: order?.id || "del_sample_101",
      orderNumber: order?.orderNumber || 101,
      customer: {
        name: order?.customerName || "Alejandro Pérez",
        phone: order?.customerPhone || "+53 52123456",
        address: order?.customerAddress || "Calle 23 #456 e/ J e I, Vedado, La Habana",
        locationUrl: order?.customerLocationUrl || "https://maps.google.com/?q=23.134,-82.385",
      },
      items: order?.items || [
        { name: "Hamburguesa Especial Res", qty: 2, price: 950 },
        { name: "Cerveza Cristal 350ml", qty: 2, price: 400 },
      ],
      financials: {
        subtotal: order?.itemsSubtotal || 2700,
        deliveryFee: order?.deliveryFee || agency.baseFee,
        tip: order?.tip || 0,
        total: order?.total || 3000,
        currency: "CUP",
        paymentMethod: order?.paymentMethod || "cash",
        paymentStatus: order?.paymentStatus || "PENDIENTE",
      },
      notes: order?.notes || "Entregar en puerta del apartamento 3B",
    },
  };

  const payloadString = JSON.stringify(samplePayload, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(payloadString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunSimulation = () => {
    setTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setTesting(false);
      setTestResult({
        status: 200,
        message: "Despacho procesado y recibido correctamente por el servidor de la agencia.",
        trackingId: `${agency.name.substring(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`,
      });
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <IconCode size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white leading-tight">
                Simulador de API / Webhook
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {agency.name} • Endpoint de Integración
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 text-xs">
          <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-2xl text-blue-950 space-y-1">
            <p className="font-extrabold flex items-center gap-1.5 text-blue-900">
              <IconBuilding size={15} /> Protocolo de Conexión Externa
            </p>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              Las agencias de mensajería (Mandao, EnZona, o bots propios) reciben las órdenes en tiempo real mediante una petición POST con el formato JSON estandarizado a continuación.
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">Webhook URL:</span>
              <span className="font-mono text-[11px] text-slate-500 truncate max-w-[260px]">
                {agency.webhookUrl || "https://api.agencia.cu/v1/deliveries/dispatch"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">Auth Token:</span>
              <span className="font-mono text-[11px] text-slate-500">
                {agency.apiKey ? `Bearer ${agency.apiKey.substring(0, 8)}...` : "Bearer live_sec_..."}
              </span>
            </div>
          </div>

          {/* JSON Payload Display */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">
                JSON Payload (Estructura de Envío):
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
              >
                {copied ? (
                  <span className="text-emerald-600 flex items-center gap-0.5 font-extrabold">
                    <IconCheck size={13} /> ¡Copiado!
                  </span>
                ) : (
                  <>
                    <IconCopy size={13} /> Copiar JSON
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-2xl overflow-x-auto max-h-48 leading-tight">
              {payloadString}
            </pre>
          </div>

          {/* Simulation Output */}
          {testResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-emerald-900 flex items-center gap-1">
                  <IconCheck size={14} /> HTTP {testResult.status} OK (Conexión Exitosa)
                </span>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg text-[10px]">
                  Tracking: {testResult.trackingId}
                </span>
              </div>
              <p className="text-[11px] text-emerald-800">
                {testResult.message}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer"
          >
            Cerrar
          </button>

          <button
            type="button"
            onClick={handleRunSimulation}
            disabled={testing}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
          >
            <span>{testing ? "Probando..." : "⚡ Ejecutar Envío de Prueba"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
