import React from "react";
import {
  IconShieldCheck,
  IconCheck,
  IconXCircle,
  IconSliders,
  IconCoins,
  IconBox,
} from "./Icons";
import type { AuditReport, AuditCheckItem } from "../utils/auditEngine";

interface AuditReportModalProps {
  report: AuditReport | null;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export const AuditReportModal: React.FC<AuditReportModalProps> = ({
  report,
  onClose,
  title = "Auditoría Contable & Matemática",
  subtitle = "Verificación de fórmulas de balance e inventario en tiempo real",
}) => {
  if (!report) return null;

  const getCategoryIcon = (category: AuditCheckItem["category"]) => {
    switch (category) {
      case "CASH_DRAWER":
      case "SALES":
        return <IconCoins size={14} className="text-amber-500" />;
      case "INVENTORY":
      case "MARGINS":
        return <IconBox size={14} className="text-blue-500" />;
      default:
        return <IconSliders size={14} className="text-teal-500" />;
    }
  };

  const passCount = report.checks.filter((c) => c.status === "PASS").length;
  const failCount = report.checks.filter((c) => c.status === "FAIL").length;
  const warnCount = report.checks.filter((c) => c.status === "WARNING").length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                report.status === "PASS"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : report.status === "WARNING"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
              }`}
            >
              <IconShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">{title}</h3>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    report.status === "PASS"
                      ? "bg-emerald-500 text-slate-950"
                      : report.status === "WARNING"
                      ? "bg-amber-400 text-slate-950"
                      : "bg-rose-500 text-white"
                  }`}
                >
                  {report.score}% CONFORME
                </span>
              </div>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center transition cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>

        {/* Audit Highlights Summary */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-xl">
              <IconCheck size={14} /> {passCount} Verificados
            </span>
            {warnCount > 0 && (
              <span className="inline-flex items-center gap-1 font-extrabold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-xl">
                ⚠️ {warnCount} Avisos
              </span>
            )}
            {failCount > 0 && (
              <span className="inline-flex items-center gap-1 font-extrabold text-rose-800 bg-rose-100 px-2.5 py-1 rounded-xl">
                <IconXCircle size={14} /> {failCount} Corregidos
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Fecha de auditoría: {new Date(report.timestamp).toLocaleTimeString("es-ES")}
          </div>
        </div>

        {/* Checklist details list */}
        <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
          <div className="text-xs font-semibold text-slate-600 bg-blue-50 border border-blue-200 p-3 rounded-2xl">
            {report.summary}
          </div>

          <div className="space-y-2.5">
            <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              PRUEBAS MATEMÁTICAS EJECUTADAS
            </h4>
            {report.checks.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition ${
                  item.status === "PASS"
                    ? "bg-white border-slate-200 hover:border-slate-300"
                    : item.status === "WARNING"
                    ? "bg-amber-50/50 border-amber-200"
                    : "bg-rose-50/50 border-rose-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(item.category)}
                    <span className="font-extrabold text-xs text-slate-900">
                      {item.name}
                    </span>
                  </div>
                  <div>
                    {item.status === "PASS" ? (
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <IconCheck size={11} /> OK
                      </span>
                    ) : item.status === "WARNING" ? (
                      <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Aviso
                      </span>
                    ) : (
                      <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        Corregido
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {item.description}
                </p>

                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Valor Calculado: <strong className="text-slate-800">{String(item.expectedValue)}</strong></span>
                  <span>Declarado: <strong className="text-slate-800">{String(item.actualValue)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <IconShieldCheck size={14} className="text-emerald-600" />
            <span>Motor de Auditoría ISO-POS Integrado</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition cursor-pointer active:scale-95"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
