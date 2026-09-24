import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { IconX, IconBuilding } from "../Icons";
import { actions } from "../../store";
import type { DeliveryAgency } from "../../types";

export function NewAgencyModal({
  agencyToEdit,
  isOpen,
  onClose,
}: {
  agencyToEdit?: DeliveryAgency | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(agencyToEdit?.name || "");
  const [phone, setPhone] = useState(agencyToEdit?.phone || "");
  const [email, setEmail] = useState(agencyToEdit?.email || "");
  const [baseFee, setBaseFee] = useState<number>(agencyToEdit?.baseFee || 300);
  const [contactPerson, setContactPerson] = useState(agencyToEdit?.contactPerson || "");
  const [websiteOrApp, setWebsiteOrApp] = useState(agencyToEdit?.websiteOrApp || "");
  const [webhookUrl, setWebhookUrl] = useState(agencyToEdit?.webhookUrl || "");
  const [apiKey, setApiKey] = useState(agencyToEdit?.apiKey || "");
  const [notes, setNotes] = useState(agencyToEdit?.notes || "");
  const [active, setActive] = useState(agencyToEdit?.active ?? true);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert("Por favor completa el nombre y teléfono de la empresa/agencia.");
      return;
    }

    if (agencyToEdit) {
      actions.updateDeliveryAgency(agencyToEdit.id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        baseFee,
        contactPerson: contactPerson.trim() || undefined,
        websiteOrApp: websiteOrApp.trim() || undefined,
        webhookUrl: webhookUrl.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
        notes: notes.trim() || undefined,
        active,
      });
    } else {
      actions.addDeliveryAgency({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        baseFee,
        contactPerson: contactPerson.trim() || undefined,
        websiteOrApp: websiteOrApp.trim() || undefined,
        webhookUrl: webhookUrl.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
        notes: notes.trim() || undefined,
        active,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <IconBuilding size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                {agencyToEdit ? "Editar Agencia de Mensajería" : "Nueva Empresa de Delivery"}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Conexión y gestión de mensajería externa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form id="agency-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Nombre de la Empresa *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Mandao Logistics"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Teléfono de Contacto *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. +53 78330000"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Tarifa Base Promedio (CUP)
              </label>
              <input
                type="number"
                min={0}
                value={baseFee}
                onChange={(e) => setBaseFee(parseFloat(e.target.value) || 0)}
                placeholder="300"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Persona de Contacto / Soporte
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Ej. Lic. Yanet Valdés"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Sitio Web o Portal
              </label>
              <input
                type="url"
                value={websiteOrApp}
                onChange={(e) => setWebsiteOrApp(e.target.value)}
                placeholder="https://..."
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="soporte@empresa.cu"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
              />
            </div>
          </div>

          {/* Webhook & API Key */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
              Integración Digital / API Webhook (Opcional)
            </p>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                Endpoint Webhook de Despacho:
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://api.empresa.cu/v1/dispatch"
                className="w-full text-xs font-mono px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                API Key / Token de Autorización:
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full text-xs font-mono px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Notas y Condiciones:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Despachan de 9:00am a 11:00pm, cobran en efectivo..."
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
            />
          </div>

          {/* Active switch */}
          <label className="flex items-center gap-2 pt-1 text-xs font-bold text-slate-800 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded-sm text-slate-900 focus:ring-slate-900"
            />
            <span>Empresa / Agencia Habilitada para Envíos</span>
          </label>
        </form>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="agency-form"
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition cursor-pointer"
          >
            {agencyToEdit ? "Guardar Cambios" : "Registrar Empresa"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
