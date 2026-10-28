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
    <div className="absolute top-2.5 inset-x-2 sm:inset-x-3 z-50 pointer-events-none flex flex-col items-center gap-2">
      <AnimatePresence>
        {alerts.map((alert) => {
          const isOut = alert.type === "out_of_stock";
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -20, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 450, damping: 28 }}
              className="pointer-events-auto w-full max-w-[390px] bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3 shadow-2xl border border-white/15 flex flex-col gap-2 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                      isOut ? "bg-rose-600 text-white animate-pulse" : "bg-amber-400 text-slate-950"
                    }`}
                  >
                    {alert.product?.emoji ? (
                      <span className="text-base">{alert.product.emoji}</span>
                    ) : (
                      <IconAlert size={16} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-xs text-white leading-tight truncate">
                      {alert.title}
                    </h4>
                    <p className="text-[10.5px] text-slate-300 font-medium truncate">
                      {alert.message}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => dismiss(alert.id)}
                  className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-[10px] font-bold cursor-pointer transition shrink-0"
                  aria-label="Cerrar notificación"
                >
                  ✕
                </button>
              </div>

              {/* Quick Actions */}
              {alert.product && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
                  <button
                    onClick={() => handleQuickAdd(alert, 5)}
                    className="flex-1 py-1 px-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[10.5px] flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <IconPlus size={12} /> Reponer +5 {alert.product.unit}
                  </button>

                  {onOpenInventory && (
                    <button
                      onClick={() => {
                        dismiss(alert.id);
                        onOpenInventory();
                      }}
                      className="py-1 px-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-[10.5px] transition cursor-pointer shrink-0"
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
