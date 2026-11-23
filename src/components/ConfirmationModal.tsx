import { motion } from "motion/react";
import { IconAlert, IconTrash, IconCheck, IconX } from "./Icons";

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  icon?: "trash" | "alert" | "check";
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  danger = true,
  icon = "trash",
  onConfirm,
  onClose,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-slate-100 flex flex-col"
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              danger
                ? "bg-rose-100 text-rose-600"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {icon === "trash" ? (
              <IconTrash size={22} />
            ) : icon === "check" ? (
              <IconCheck size={22} />
            ) : (
              <IconAlert size={22} />
            )}
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 leading-tight">
              {title}
            </h3>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed mb-5">
          {message}
        </p>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer active:scale-98"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 py-2.5 rounded-xl text-white font-extrabold text-xs shadow-md transition cursor-pointer active:scale-98 ${
              danger
                ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                : "bg-slate-900 hover:bg-slate-800 shadow-slate-900/20"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
