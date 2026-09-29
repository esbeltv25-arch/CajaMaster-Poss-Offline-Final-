import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  subscribeToInAppAlerts,
  type InAppAlert,
} from "../utils/notifications";
import { IconAlert, IconTrash, IconPlus, IconCheck } from "./Icons";
import { actions } from "../store";

export function NotificationBanner({
  onOpenInventory,
}: {
  onOpenInventory?: () => void;
}) {
  const [alerts, setAlerts] = useState<InAppAlert[]>([]);

  useEffect(() => {
    const unsub = subscribeToInAppAlerts((alert) => {
      setAlerts((prev) => [alert, ...prev.slice(0, 2)]);

      // Auto dismiss this alert after 7 seconds
      setTimeout(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
      }, 7000);
    });

    return unsub;
  }, []);

  const dismiss = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleQuickAdd = (alert: InAppAlert, amount = 5) => {
    if (!alert.product) return;
    actions.adjustStock(
      alert.product.id,
      alert.product.stock + amount,
      `Reposición rápida (+${amount} ${alert.product.unit})`
    );
    dismiss(alert.id);
  };

  return (
    <div className="fixed top-4 inset-x-0 z-50 pointer-events-none flex flex-col items-center gap-2 px-3">
      <AnimatePresence>
        {alerts.map((alert) => {
          const isOut = alert.type === "out_of_stock";
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -30, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 450, damping: 28 }}
              className="pointer-events-auto w-full max-w-md bg-slate-900/95 backdrop-blur-md text-white rounded-3xl p-3.5 shadow-2xl border border-white/15 flex flex-col gap-2.5 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                      isOut ? "bg-rose-600 text-white animate-pulse" : "bg-amber-400 text-slate-950"
                    }`}
                  >
                    {alert.product?.emoji ? (
                      <span className="text-lg">{alert.product.emoji}</span>
                    ) : (
                      <IconAlert size={18} />
                    )}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-white leading-tight">
                      {alert.title}
                    </h4>
                    <p className="text-[11px] text-slate-300 font-medium">
                      {alert.message}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => dismiss(alert.id)}
                  className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer transition shrink-0"
                  aria-label="Cerrar notificación"
                >
                  ✕
                </button>
              </div>

              {/* Quick Actions */}
              {alert.product && (
                <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                  <button
                    onClick={() => handleQuickAdd(alert, 5)}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <IconPlus size={13} /> Reponer +5 {alert.product.unit}
                  </button>

                  {onOpenInventory && (
                    <button
                      onClick={() => {
                        dismiss(alert.id);
                        onOpenInventory();
                      }}
                      className="py-1.5 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-[11px] transition cursor-pointer"
                    >
                      Ver Stock
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
