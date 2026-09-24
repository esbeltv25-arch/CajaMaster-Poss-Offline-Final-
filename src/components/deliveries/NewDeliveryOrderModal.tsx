import { useState, useMemo, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  IconX,
  IconPlus,
  IconMinus,
  IconTrash,
  IconWhatsApp,
  IconSearch,
  IconMapPin,
  IconTruck,
  IconCoins,
} from "../Icons";
import { useStore, actions } from "../../store";
import { formatCurrency } from "../../utils/currency";
import { parseWhatsAppOrderText } from "../../utils/whatsappDelivery";
import type { DeliveryOrderItem, PaymentMethod, DeliveryOrder } from "../../types";

export function NewDeliveryOrderModal({
  isOpen,
  onClose,
  onOrderCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (order: DeliveryOrder) => void;
}) {
  const state = useStore();
  const [tab, setTab] = useState<"manual" | "whatsapp">("manual");

  // Form Fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerLocationUrl, setCustomerLocationUrl] = useState("");
  const [deliveryFee, setDeliveryFee] = useState<number>(300);
  const [tip, setTip] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentStatus, setPaymentStatus] = useState<"PENDIENTE" | "COMPLETADO">("PENDIENTE");
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(30);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DeliveryOrderItem[]>([]);

  // Product selector state
  const [searchProduct, setSearchProduct] = useState("");
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState<number>(0);

  // WhatsApp raw parser state
  const [rawWhatsAppText, setRawWhatsAppText] = useState("");
  const [parsedNotification, setParsedNotification] = useState<string | null>(null);

  // Filtered catalog products
  const filteredProducts = useMemo(() => {
    if (!searchProduct.trim()) return state.products.slice(0, 8);
    const q = searchProduct.toLowerCase();
    return state.products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }, [state.products, searchProduct]);

  const itemsSubtotal = items.reduce((acc, it) => acc + it.price * it.qty, 0);
  const total = itemsSubtotal + deliveryFee + tip;

  const handleAddProduct = (productId?: string, name?: string, price?: number, emoji?: string, unit?: string) => {
    if (!name) return;
    setItems((prev) => {
      const idx = prev.findIndex((it) => (productId && it.productId === productId) || it.name === name);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          productId,
          name,
          price: price || 0,
          emoji: emoji || "📦",
          qty: 1,
          unit: unit || "u",
        },
      ];
    });
  };

  const handleUpdateQty = (index: number, delta: number) => {
    setItems((prev) => {
      const next = [...prev];
      const newQty = next[index].qty + delta;
      if (newQty <= 0) {
        return next.filter((_, i) => i !== index);
      }
      next[index] = { ...next[index], qty: newQty };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddCustomItem = () => {
    if (!customItemName.trim() || customItemPrice <= 0) return;
    setItems((prev) => [
      ...prev,
      {
        name: customItemName.trim(),
        price: customItemPrice,
        emoji: "🏷️",
        qty: 1,
        unit: "u",
      },
    ]);
    setCustomItemName("");
    setCustomItemPrice(0);
  };

  const handleProcessWhatsAppText = () => {
    if (!rawWhatsAppText.trim()) return;
    const parsed = parseWhatsAppOrderText(rawWhatsAppText, state.products);

    if (parsed.customerName) setCustomerName(parsed.customerName);
    if (parsed.customerPhone) setCustomerPhone(parsed.customerPhone);
    if (parsed.customerAddress) setCustomerAddress(parsed.customerAddress);
    if (parsed.customerLocationUrl) setCustomerLocationUrl(parsed.customerLocationUrl);
    if (parsed.deliveryFee > 0) setDeliveryFee(parsed.deliveryFee);
    if (parsed.paymentMethod) setPaymentMethod(parsed.paymentMethod);
    if (parsed.notes) setNotes(parsed.notes);
    if (parsed.items && parsed.items.length > 0) setItems(parsed.items);

    setParsedNotification(`¡Comanda extraída con éxito! (${parsed.items.length} productos identificados)`);
    setTimeout(() => {
      setParsedNotification(null);
      setTab("manual");
    }, 1200);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerAddress.trim()) {
      alert("Por favor completa al menos el Nombre del Cliente y la Dirección de Entrega.");
      return;
    }
    if (items.length === 0) {
      alert("Debes agregar al menos un producto a la comanda de envío.");
      return;
    }

    const createdOrder = actions.addDeliveryOrder({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      customerLocationUrl: customerLocationUrl.trim() || undefined,
      notes: notes.trim() || undefined,
      items,
      deliveryFee,
      tip,
      paymentMethod,
      paymentStatus,
      estimatedMinutes,
      source: tab === "whatsapp" || rawWhatsAppText ? "WHATSAPP" : "MANUAL",
      whatsappRawText: rawWhatsAppText.trim() || undefined,
    });

    if (onOrderCreated) {
      onOrderCreated(createdOrder);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <IconTruck size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                Nuevo Pedido a Domicilio
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Recepción y despacho de comanda
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

        {/* Tab switcher: Manual vs WhatsApp Import */}
        <div className="px-5 pt-3 pb-1 border-b border-slate-100 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("manual")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              tab === "manual"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>📝 Formulario Directo</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("whatsapp")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              tab === "whatsapp"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            <IconWhatsApp size={16} />
            <span>Pegar de WhatsApp</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {tab === "whatsapp" ? (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200/60 text-xs text-emerald-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                  <IconWhatsApp size={15} /> Lector Inteligente de Comandas WhatsApp
                </p>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  Pega el mensaje tal como te llegó por WhatsApp. El sistema extraerá automáticamente el cliente, teléfono, dirección, productos, costo de envío y método de pago.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Texto de WhatsApp Recibido:
                </label>
                <textarea
                  value={rawWhatsAppText}
                  onChange={(e) => setRawWhatsAppText(e.target.value)}
                  rows={8}
                  placeholder={`Ejemplo:\nCliente: Alejandro Pérez\nTeléfono: 52123456\nDirección: Calle 23 #456 e/ J e I, Vedado\nProductos:\n- 2x Hamburguesa Especial ($950)\n- 2x Cerveza Cristal ($400)\nEnvío: 300\nPago: Transfermóvil\nNotas: Tocar el timbre del apto 3`}
                  className="w-full text-xs font-mono p-3 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-slate-800"
                />
              </div>

              {parsedNotification && (
                <div className="p-2.5 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-bold text-center animate-pulse">
                  {parsedNotification}
                </div>
              )}

              <button
                type="button"
                onClick={handleProcessWhatsAppText}
                disabled={!rawWhatsAppText.trim()}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <span>⚡ Procesar y Autocompletar Comanda</span>
              </button>
            </div>
          ) : (
            <form id="delivery-order-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Customer Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Cliente / Destinatario *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:outline-hidden bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Teléfono / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Ej. 52345678"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:outline-hidden bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Dirección de Entrega Exacta *
                </label>
                <input
                  type="text"
                  required
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Ej. Calle 23 #456 e/ J e I, Apto 3B, Vedado"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:outline-hidden bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Enlace GPS / Google Maps (Opcional):
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    <IconMapPin size={16} />
                  </div>
                  <input
                    type="url"
                    value={customerLocationUrl}
                    onChange={(e) => setCustomerLocationUrl(e.target.value)}
                    placeholder="https://maps.google.com/?q=..."
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:outline-hidden bg-slate-50"
                  />
                </div>
              </div>

              {/* Order Items Section */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                    <span>🛒 Productos de la Comanda</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full font-bold">
                      {items.length}
                    </span>
                  </h3>
                  <span className="text-xs font-extrabold text-slate-900">
                    Subtotal: {formatCurrency(itemsSubtotal, "CUP", state.rates)}
                  </span>
                </div>

                {/* Items List */}
                {items.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-100 text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-sm shrink-0">{item.emoji || "📦"}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-800 truncate leading-tight">
                              {item.name}
                            </p>
                            <p className="text-[10px] text-slate-500 font-medium">
                              {formatCurrency(item.price, "CUP", state.rates)} c/u
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(idx, -1)}
                              className="w-5 h-5 rounded-md hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold cursor-pointer"
                            >
                              <IconMinus size={11} />
                            </button>
                            <span className="w-6 text-center font-extrabold text-xs text-slate-900">
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(idx, 1)}
                              className="w-5 h-5 rounded-md hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold cursor-pointer"
                            >
                              <IconPlus size={11} />
                            </button>
                          </div>

                          <span className="font-extrabold text-slate-900 w-16 text-right">
                            {formatCurrency(item.price * item.qty, "CUP", state.rates)}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                          >
                            <IconTrash size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic text-center py-2">
                    Aún no has agregado productos a esta comanda.
                  </p>
                )}

                {/* Catalog Quick Add */}
                <div className="pt-2 border-t border-slate-200/60 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={searchProduct}
                        onChange={(e) => setSearchProduct(e.target.value)}
                        placeholder="Buscar producto en catálogo..."
                        className="w-full text-xs pl-7 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                      />
                      <span className="absolute left-2 top-2 text-slate-400">
                        <IconSearch size={13} />
                      </span>
                    </div>
                  </div>

                  {filteredProducts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {filteredProducts.map((prod) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() =>
                            handleAddProduct(prod.id, prod.name, prod.price, prod.emoji, prod.unit)
                          }
                          className="px-2.5 py-1 bg-white hover:bg-amber-50 hover:border-amber-300 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                        >
                          <span>{prod.emoji}</span>
                          <span className="truncate max-w-[110px]">{prod.name}</span>
                          <span className="text-amber-700 font-extrabold">
                            ${prod.price}
                          </span>
                          <IconPlus size={11} className="text-slate-400" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Add manual custom item row */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      value={customItemName}
                      onChange={(e) => setCustomItemName(e.target.value)}
                      placeholder="Producto personalizado..."
                      className="flex-1 text-xs px-2.5 py-1 rounded-xl border border-slate-200 bg-white"
                    />
                    <input
                      type="number"
                      value={customItemPrice || ""}
                      onChange={(e) => setCustomItemPrice(parseFloat(e.target.value) || 0)}
                      placeholder="Precio CUP"
                      className="w-20 text-xs px-2.5 py-1 rounded-xl border border-slate-200 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomItem}
                      disabled={!customItemName.trim() || customItemPrice <= 0}
                      className="px-2.5 py-1 rounded-xl bg-slate-800 disabled:opacity-50 text-white font-bold text-xs hover:bg-slate-900 cursor-pointer"
                    >
                      + Añadir
                    </button>
                  </div>
                </div>
              </div>

              {/* Delivery Fee, Tip & Payment */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tarifa de Envío (CUP)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Propina (CUP)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={tip}
                    onChange={(e) => setTip(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tiempo Estimado (min)
                  </label>
                  <input
                    type="number"
                    min={5}
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(Math.max(5, parseInt(e.target.value) || 25))}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                  />
                </div>
              </div>

              {/* Payment Method & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Método de Pago
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                  >
                    <option value="cash">💵 Efectivo al entregar</option>
                    <option value="transfermovil">📱 Transfermóvil</option>
                    <option value="enzona">⚡ EnZona</option>
                    <option value="transfer">🏦 Transferencia Bancaria</option>
                    <option value="mixed">🔄 Mixto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Estado de Pago
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                  >
                    <option value="PENDIENTE">⏳ Pendiente de Cobro</option>
                    <option value="COMPLETADO">✅ Pagado por Adelantado</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Notas / Observaciones de Entrega:
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Tocar timbre, llamar al llegar, apartamento interior..."
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              {/* Total Banner */}
              <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-md">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Total a Cobrar
                  </p>
                  <p className="text-lg font-black tracking-tight text-amber-400">
                    {formatCurrency(total, "CUP", state.rates)}
                  </p>
                </div>
                <div className="text-right text-[10px] text-slate-300 font-medium">
                  <span>Prod: ${itemsSubtotal}</span> + <span>Envío: ${deliveryFee}</span>
                  {tip > 0 && <span> + Prop: ${tip}</span>}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer"
          >
            Cancelar
          </button>
          {tab === "manual" && (
            <button
              type="submit"
              form="delivery-order-form"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
            >
              <span>💾 Crear y Registrar Pedido</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
