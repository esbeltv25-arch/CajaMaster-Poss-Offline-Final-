import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useStore, actions } from "../store";
import {
  IconAlert,
  IconBell,
  IconBellRing,
  IconVolume2,
  IconVolumeX,
  IconVibrate,
  IconPlus,
  IconCheck,
  IconEdit,
} from "./Icons";
import {
  getNotificationSettings,
  saveNotificationSettings,
  requestPushPermission,
  getPushPermissionStatus,
  playAlertSound,
  vibrateAlert,
  notifyProductLowStock,
  type NotificationSettings,
} from "../utils/notifications";
import { formatCurrency } from "../utils/currency";
import type { Product } from "../types";

export function LowStockAlertModal({
  isOpen,
  onClose,
  onEditProduct,
}: {
  isOpen: boolean;
  onClose: () => void;
  onEditProduct?: (product: Product) => void;
}) {
  const state = useStore();
  const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings());
  const [pushStatus, setPushStatus] = useState<NotificationPermission | "unsupported">("default");
  const [activeTab, setActiveTab] = useState<"items" | "settings">("items");
  const [quickAdjustedId, setQuickAdjustedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(getNotificationSettings());
      setPushStatus(getPushPermissionStatus());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter low stock and out of stock products
  const criticalProducts = state.products.filter(
    (p) => p.stock <= p.lowStockAlert
  );
  const outOfStock = criticalProducts.filter((p) => p.stock <= 0);
  const lowStock = criticalProducts.filter((p) => p.stock > 0);

  const handleTogglePush = async () => {
    if (pushStatus === "granted") {
      const updated = { ...settings, systemPush: !settings.systemPush };
      setSettings(updated);
      saveNotificationSettings(updated);
    } else {
      const res = await requestPushPermission();
      setPushStatus(res);
      const updated = {
        ...settings,
        systemPush: res === "granted",
      };
      setSettings(updated);
      saveNotificationSettings(updated);
    }
  };

  const handleToggleSound = () => {
    const updated = { ...settings, sound: !settings.sound };
    setSettings(updated);
    saveNotificationSettings(updated);
    if (updated.sound) {
      playAlertSound();
    }
  };

  const handleToggleVibration = () => {
    const updated = { ...settings, vibration: !settings.vibration };
    setSettings(updated);
    saveNotificationSettings(updated);
    if (updated.vibration) {
      vibrateAlert();
    }
  };

  const handleTestAlert = () => {
    if (criticalProducts.length > 0) {
      notifyProductLowStock(criticalProducts[0]);
    } else if (state.products.length > 0) {
      const sample = { ...state.products[0], stock: 2, lowStockAlert: 5 };
      notifyProductLowStock(sample);
    }
  };

  const handleQuickAdd = (p: Product, amount: number) => {
    actions.adjustStock(
      p.id,
      p.stock + amount,
      `Reposición rápida (+${amount} ${p.unit})`
    );
    setQuickAdjustedId(p.id);
    setTimeout(() => setQuickAdjustedId(null), 2000);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 380 }}
          className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-slate-800 border border-black/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                <IconBellRing size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white">
                  Centro de Alertas de Stock
                </h3>
                <p className="text-[11px] text-slate-400">
                  {criticalProducts.length} productos en umbral de alerta
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold cursor-pointer transition"
              aria-label="Cerrar modal"
            >
              ✕
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 shrink-0 gap-2">
            <button
              onClick={() => setActiveTab("items")}
              className={`pb-2 px-3 text-xs font-extrabold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "items"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <IconAlert size={14} className="text-amber-500" />
              <span>Productos Críticos ({criticalProducts.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`pb-2 px-3 text-xs font-extrabold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "settings"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <IconBell size={14} />
              <span>Configuración de Avisos</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeTab === "items" ? (
              <div className="space-y-4">
                {/* Out of Stock Section */}
                {outOfStock.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 text-xs font-extrabold text-rose-700 uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                      AGOTADOS (0 UNIDADES) • {outOfStock.length}
                    </div>

                    <div className="space-y-2">
                      {outOfStock.map((p) => (
                        <CriticalProductCard
                          key={p.id}
                          product={p}
                          state={state}
                          isOut={true}
                          quickAdjusted={quickAdjustedId === p.id}
                          onAdd={(qty) => handleQuickAdd(p, qty)}
                          onEdit={() => {
                            onClose();
                            onEditProduct?.(p);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Low Stock Section */}
                {lowStock.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 text-xs font-extrabold text-amber-700 uppercase tracking-wider">
                      <IconAlert size={14} className="text-amber-600" />
                      POR DEBAJO DEL UMBRAL • {lowStock.length}
                    </div>

                    <div className="space-y-2">
                      {lowStock.map((p) => (
                        <CriticalProductCard
                          key={p.id}
                          product={p}
                          state={state}
                          isOut={false}
                          quickAdjusted={quickAdjustedId === p.id}
                          onAdd={(qty) => handleQuickAdd(p, qty)}
                          onEdit={() => {
                            onClose();
                            onEditProduct?.(p);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {criticalProducts.length === 0 && (
                  <div className="text-center py-12 space-y-2 text-slate-500">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-xl font-bold">
                      ✓
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-800">
                      ¡Todo el inventario está en niveles óptimos!
                    </h4>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      Ningún producto está por debajo de su umbral mínimo configurado.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Settings Tab */
              <div className="space-y-4">
                {/* Push Notifications Toggle Box */}
                <div className="card p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                        <IconBell size={18} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs text-slate-900">
                          Notificaciones Push del Sistema
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Recibe alertas en tu dispositivo incluso si la app está en segundo plano
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleTogglePush}
                      className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition cursor-pointer ${
                        settings.systemPush && pushStatus === "granted"
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-900 text-amber-400"
                      }`}
                    >
                      {settings.systemPush && pushStatus === "granted"
                        ? "Activadas ✓"
                        : "Permitir Push"}
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                    Estado en navegador:{" "}
                    <span className="font-bold">
                      {pushStatus === "granted"
                        ? "Permitido ✓"
                        : pushStatus === "denied"
                        ? "Bloqueado por el usuario"
                        : "Pendiente de autorización"}
                    </span>
                  </div>
                </div>

                {/* Sound & Vibration Controls */}
                <div className="card p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <h4 className="font-extrabold text-xs text-slate-900">
                    Alertas Sonoras & Hápticas Locales
                  </h4>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        {settings.sound ? (
                          <IconVolume2 size={16} className="text-slate-800" />
                        ) : (
                          <IconVolumeX size={16} className="text-slate-400" />
                        )}
                        <span className="text-xs font-bold text-slate-800">
                          Chime Sonoro de Alerta (Sintetizador Offline)
                        </span>
                      </div>
                      <button
                        onClick={handleToggleSound}
                        className={`w-10 h-6 rounded-full transition cursor-pointer p-0.5 ${
                          settings.sound ? "bg-amber-400" : "bg-slate-300"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition-transform ${
                            settings.sound ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between py-1 border-t border-slate-200">
                      <div className="flex items-center gap-2">
                        <IconVibrate size={16} className="text-slate-800" />
                        <span className="text-xs font-bold text-slate-800">
                          Vibración en Dispositivos Móviles
                        </span>
                      </div>
                      <button
                        onClick={handleToggleVibration}
                        className={`w-10 h-6 rounded-full transition cursor-pointer p-0.5 ${
                          settings.vibration ? "bg-amber-400" : "bg-slate-300"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition-transform ${
                            settings.vibration ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Test Alert Button */}
                <button
                  onClick={handleTestAlert}
                  className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
                >
                  <IconBellRing size={16} className="text-amber-400" />
                  <span>Probar Notificación de Prueba Ahora</span>
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function CriticalProductCard({
  product,
  state,
  isOut,
  quickAdjusted,
  onAdd,
  onEdit,
}: {
  key?: string;
  product: Product;
  state: ReturnType<typeof useStore>;
  isOut: boolean;
  quickAdjusted: boolean;
  onAdd: (qty: number) => void;
  onEdit: () => void;
}) {
  return (
    <div
      className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
        isOut
          ? "bg-rose-50/80 border-rose-200"
          : "bg-amber-50/70 border-amber-200"
      }`}
    >
      {/* Visual media */}
      <div className="w-12 h-12 rounded-xl bg-slate-900 overflow-hidden flex items-center justify-center text-2xl shrink-0 shadow-2xs">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span>{product.emoji}</span>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h5 className="font-extrabold text-xs text-slate-900 truncate">
            {product.name}
          </h5>
          <span
            className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
              isOut
                ? "bg-rose-600 text-white"
                : "bg-amber-400 text-slate-950"
            }`}
          >
            {product.stock} {product.unit}
          </span>
        </div>

        <div className="text-[11px] text-slate-500 font-medium">
          Umbral: ≤ {product.lowStockAlert} {product.unit} • {formatCurrency(product.price, "CUP", state.rates)}
        </div>
      </div>

      {/* Quick Add buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onAdd(5)}
          className="px-2 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer transition shadow-2xs active:scale-95"
          title="Añadir 5 unidades"
        >
          <IconPlus size={11} /> +5
        </button>

        <button
          onClick={() => onAdd(10)}
          className="px-2 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer transition shadow-2xs active:scale-95"
          title="Añadir 10 unidades"
        >
          <IconPlus size={11} /> +10
        </button>

        <button
          onClick={onEdit}
          className="p-1.5 rounded-xl bg-slate-900 text-amber-400 hover:bg-slate-800 transition cursor-pointer"
          title="Editar Ficha"
        >
          <IconEdit size={13} />
        </button>

        {quickAdjusted && (
          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-lg animate-pop">
            ✓
          </span>
        )}
      </div>
    </div>
  );
}
