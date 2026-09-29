import { useState } from "react";
import { motion } from "motion/react";
import {
  IconBuilding,
  IconPlus,
  IconPhone,
  IconGlobe,
  IconCode,
  IconTrash,
  IconCheck,
} from "../Icons";
import { useStore, actions } from "../../store";
import { formatCurrency } from "../../utils/currency";
import type { DeliveryAgency } from "../../types";

export function DeliveryAgenciesTab({
  onOpenNewAgency,
  onEditAgency,
  onOpenSimulator,
}: {
  onOpenNewAgency: () => void;
  onEditAgency: (agency: DeliveryAgency) => void;
  onOpenSimulator: (agency: DeliveryAgency) => void;
}) {
  const state = useStore();
  const agencies = state.deliveryAgencies || [];

  const activeCount = agencies.filter((a) => a.active).length;
  const totalDispatched = agencies.reduce((acc, a) => acc + a.totalOrdersDispatched, 0);
  const avgFee = agencies.length > 0
    ? Math.round(agencies.reduce((acc, a) => acc + a.baseFee, 0) / agencies.length)
    : 0;

  const handleToggleActive = (agency: DeliveryAgency) => {
    actions.updateDeliveryAgency(agency.id, { active: !agency.active });
  };

  const handleDeleteAgency = (agency: DeliveryAgency) => {
    if (confirm(`¿Eliminar a la agencia "${agency.name}"?`)) {
      actions.deleteDeliveryAgency(agency.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="p-3 sm:p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wide truncate">
              Empresas Conectadas
            </span>
            <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-xs shrink-0">
              🏢
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900">{agencies.length}</p>
        </div>

        <div className="p-3 sm:p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wide truncate">
              Habilitadas
            </span>
            <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs shrink-0">
              🟢
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600">{activeCount}</p>
        </div>

        <div className="p-3 sm:p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wide truncate">
              Despachos Totales
            </span>
            <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xs shrink-0">
              📦
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-blue-600">{totalDispatched}</p>
        </div>

        <div className="p-3 sm:p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wide truncate">
              Tarifa Promedio
            </span>
            <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xs shrink-0">
              🏷️
            </span>
          </div>
          <p className="text-sm sm:text-base font-black text-slate-900 truncate">
            {formatCurrency(avgFee, "CUP", state.rates)}
          </p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
          Agencias y Plataformas de Mensajería Externa
        </h3>

        <button
          type="button"
          onClick={onOpenNewAgency}
          className="px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
        >
          <IconPlus size={15} />
          <span>+ Conectar Agencia</span>
        </button>
      </div>

      {/* Agencies List Grid */}
      {agencies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {agencies.map((agency) => {
            const hasWebhook = Boolean(agency.webhookUrl);

            return (
              <motion.div
                key={agency.id}
                layout
                className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-700 flex items-center justify-center text-lg font-bold shrink-0">
                        🏢
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-extrabold text-slate-900 truncate">
                          {agency.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate">
                          Tarifa base: <span className="font-bold text-slate-800">{formatCurrency(agency.baseFee, "CUP", state.rates)}</span>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(agency)}
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full transition cursor-pointer ${
                        agency.active
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {agency.active ? "🟢 Activa" : "⚪ Desactivada"}
                    </button>
                  </div>

                  {/* Contact info */}
                  <div className="space-y-1.5 mb-3 text-[11px]">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Teléfono:</span>
                      <a
                        href={`tel:${agency.phone}`}
                        className="font-bold text-slate-800 hover:underline flex items-center gap-1"
                      >
                        <IconPhone size={12} /> {agency.phone}
                      </a>
                    </div>

                    {agency.contactPerson && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Contacto:</span>
                        <span className="font-medium text-slate-800 truncate max-w-[160px]">
                          {agency.contactPerson}
                        </span>
                      </div>
                    )}

                    {agency.websiteOrApp && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Portal:</span>
                        <a
                          href={agency.websiteOrApp}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <IconGlobe size={12} /> Visitar Web ↗
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Webhook & Stats Box */}
                  <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5 mb-3">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-500">API Webhook:</span>
                      <span
                        className={`font-extrabold px-1.5 py-0.2 rounded-md ${
                          hasWebhook
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {hasWebhook ? "⚡ Configurado" : "Sin Webhook"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-500">Órdenes Despachadas:</span>
                      <span className="font-black text-slate-900">
                        {agency.totalOrdersDispatched} pedidos
                      </span>
                    </div>
                  </div>

                  {agency.notes && (
                    <p className="text-[10px] text-slate-500 italic mb-2 line-clamp-2 leading-relaxed">
                      📌 {agency.notes}
                    </p>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => onOpenSimulator(agency)}
                    className="px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition"
                  >
                    <IconCode size={13} />
                    <span>Simular API ⚡</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEditAgency(agency)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer transition"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAgency(agency)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      <IconTrash size={13} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 px-4 text-center bg-white rounded-3xl border border-slate-200/80 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto text-xl">
            🏢
          </div>
          <h3 className="text-sm font-extrabold text-slate-800">
            No hay agencias o empresas de mensajería registradas
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Integra agencias aliadas como Mandao, EnZona Envíos o mensajerías locales para despachar pedidos externos.
          </p>
          <button
            type="button"
            onClick={onOpenNewAgency}
            className="mt-2 px-4 py-2 bg-slate-900 text-white font-extrabold text-xs rounded-xl shadow-xs hover:bg-slate-800 transition cursor-pointer"
          >
            + Conectar Primera Agencia
          </button>
        </div>
      )}
    </div>
  );
}
