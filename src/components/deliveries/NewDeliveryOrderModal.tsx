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
  IconCheck,
} from "../Icons";
import { useStore, actions } from "../../store";
import { formatCurrency } from "../../utils/currency";
import {
  parseWhatsAppOrderText,
  generateGoogleMapsSearchUrl,
  extractGpsUrlOrCoordinates,
  type ParsedWhatsAppOrder,
} from "../../utils/whatsappDelivery";
import type { DeliveryOrderItem, PaymentMethod, PaymentStatus, DeliveryOrder } from "../../types";

const SAMPLE_WHATSAPP_MESSAGES = [
  {
    title: "1. Cuba: Vedado (+53 y enlace GPS)",
    text: `👤 *Cliente:* Alejandro Pérez
📞 *Teléfono:* +53 52123456
📍 *Dirección:* Calle 23 #456 e/ J e I, Apto 3B, Vedado
🗺️ https://maps.app.goo.gl/wJ128xY9z
🍔 *Pedido:*
• 2x Hamburguesa Especial ($950 CUP)
• 2x Cerveza Cristal ($400)
• 1x Papas Fritas ($350)
🛵 *Envío:* $300 CUP
💳 *Pago:* Transfermóvil (Ya transferido)
📝 *Notas:* Tocar el timbre del apto 3B al llegar`,
  },
  {
    title: "2. Internacional: Miami (+1 y Coordenadas GPS)",
    text: `Cliente: Michael Johnson
Teléfono: +1 (786) 555-8921
Dirección: 1420 SW 8th St, Little Havana, Miami, FL 33135
Coordenadas: 25.7654, -80.2185
2x Sandwich Cubano Especial $750
1x Pizza 4 Quesos $1200
2x Refresco TuKola $250
Envío: 350
Pago: Efectivo contra entrega
Notas: Casa blanca con cerca de madera`,
  },
  {
    title: "3. Internacional: Madrid (+34 y formato casual)",
    text: `Buenas tardes, quiero pedir para la casa:
Nombre: Laura Gómez
Móvil: +34 612 34 56 78
Dirección: Calle Gran Vía 32, Piso 4 A, Madrid
1 Pizza Jamón y Queso a 850
2x Batido de Fruta 350
Envío: 250
Pago: EnZona (Pagado)`,
  },
];

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
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("PENDIENTE");
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
  const [clipboardStatus, setClipboardStatus] = useState<string | null>(null);

  // Live parsed state from WhatsApp text
  const liveParsed: ParsedWhatsAppOrder = useMemo(() => {
    return parseWhatsAppOrderText(rawWhatsAppText, state.products);
  }, [rawWhatsAppText, state.products]);

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

  const liveItemsSubtotal = liveParsed.items.reduce((acc, it) => acc + it.price * it.qty, 0);
  const liveTotal = liveItemsSubtotal + (liveParsed.deliveryFee || 0) + (liveParsed.tip || 0);

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

  // Clipboard paste handler for mobile & desktop
  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setRawWhatsAppText(text);
          setClipboardStatus("¡Texto pegado exitosamente!");
          setTimeout(() => setClipboardStatus(null), 2000);
          return;
        }
      }
      setClipboardStatus("Portapapeles vacío o no soportado");
      setTimeout(() => setClipboardStatus(null), 2500);
    } catch {
      setClipboardStatus("Permiso denegado. Pega manualmente en el recuadro.");
      setTimeout(() => setClipboardStatus(null), 3000);
    }
  };

  // Process WhatsApp text and sync into form state
  const handleProcessWhatsAppText = () => {
    if (!rawWhatsAppText.trim()) return;
    const parsed = parseWhatsAppOrderText(rawWhatsAppText, state.products);

    if (parsed.customerName) setCustomerName(parsed.customerName);
    if (parsed.customerPhone) setCustomerPhone(parsed.customerPhone);
    if (parsed.customerAddress) setCustomerAddress(parsed.customerAddress);
    if (parsed.customerLocationUrl) setCustomerLocationUrl(parsed.customerLocationUrl);
    if (parsed.deliveryFee >= 0) setDeliveryFee(parsed.deliveryFee);
    if (parsed.tip !== undefined && parsed.tip >= 0) setTip(parsed.tip);
    if (parsed.paymentMethod) setPaymentMethod(parsed.paymentMethod);
    if (parsed.paymentStatus) setPaymentStatus(parsed.paymentStatus);
    if (parsed.estimatedMinutes) setEstimatedMinutes(parsed.estimatedMinutes);
    if (parsed.notes) setNotes(parsed.notes);
    if (parsed.items && parsed.items.length > 0) setItems(parsed.items);

    setParsedNotification(`✅ ¡Comanda extraída con éxito! (${parsed.items.length} productos detectados)`);
    setTimeout(() => {
      setParsedNotification(null);
      setTab("manual");
    }, 900);
  };

  // Direct order creation straight from WhatsApp tab
  const handleDirectCreateFromWhatsApp = () => {
    const parsed = parseWhatsAppOrderText(rawWhatsAppText, state.products);

    const finalName = parsed.customerName || customerName;
    const finalAddress = parsed.customerAddress || customerAddress;
    const finalPhone = parsed.customerPhone || customerPhone;
    const finalItems = parsed.items.length > 0 ? parsed.items : items;

    if (!finalName.trim() || !finalAddress.trim()) {
      alert("Por favor asegúrate de que el texto incluya al menos el Nombre del Cliente y la Dirección de Entrega.");
      return;
    }
    if (finalItems.length === 0) {
      alert("No se detectaron productos en el texto. Por favor agrega al menos un producto.");
      return;
    }

    const createdOrder = actions.addDeliveryOrder({
      customerName: finalName.trim(),
      customerPhone: finalPhone.trim(),
      customerAddress: finalAddress.trim(),
      customerLocationUrl: parsed.customerLocationUrl || customerLocationUrl.trim() || undefined,
      notes: (parsed.notes || notes).trim() || undefined,
      items: finalItems,
      deliveryFee: parsed.deliveryFee >= 0 ? parsed.deliveryFee : deliveryFee,
      tip: parsed.tip || tip,
      paymentMethod: parsed.paymentMethod || paymentMethod,
      paymentStatus: parsed.paymentStatus || paymentStatus,
      estimatedMinutes: parsed.estimatedMinutes || estimatedMinutes,
      source: "WHATSAPP",
      whatsappRawText: rawWhatsAppText.trim() || undefined,
    });

    if (onOrderCreated) {
      onOrderCreated(createdOrder);
    }
    onClose();
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
        className="bg-white rounded-3xl w-full max-w-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-100"
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
                Recepción inteligente de comandas y despacho
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

        {/* Tab switcher: WhatsApp Smart Parser vs Manual Form */}
        <div className="px-5 pt-3 pb-1 border-b border-slate-100 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("whatsapp")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
              tab === "whatsapp"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            <IconWhatsApp size={16} />
            <span>Lector Inteligente WhatsApp</span>
            {rawWhatsAppText.trim() && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("manual")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
              tab === "manual"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <span>📝 Formulario ({items.length} prod.)</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {tab === "whatsapp" ? (
            <div className="space-y-3.5">
              {/* Informative banner with quick paste button */}
              <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200/80 text-xs text-emerald-950 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-extrabold flex items-center gap-1.5 text-emerald-900">
                    <IconWhatsApp size={16} className="text-emerald-700" />
                    Lector Inteligente de Comandas WhatsApp
                  </p>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-[11px] rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>📋 Pegar Portapapeles</span>
                  </button>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                  Copia el mensaje de WhatsApp y pégalo aquí. El lector analiza automáticamente el cliente, teléfono, dirección, productos, cantidades, precios, costo de envío, propina, enlace GPS y forma de pago.
                </p>
                {clipboardStatus && (
                  <p className="text-[11px] font-bold text-emerald-900 bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-300">
                    {clipboardStatus}
                  </p>
                )}
              </div>

              {/* Text Area */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Texto de la comanda recibida:
                  </label>
                  {rawWhatsAppText && (
                    <button
                      type="button"
                      onClick={() => setRawWhatsAppText("")}
                      className="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer"
                    >
                      Limpiar texto
                    </button>
                  )}
                </div>
                <textarea
                  value={rawWhatsAppText}
                  onChange={(e) => setRawWhatsAppText(e.target.value)}
                  rows={6}
                  placeholder={`Ejemplo:\n👤 Cliente: Alejandro Pérez\n📞 Teléfono: 52123456\n📍 Dirección: Calle 23 #456 e/ J e I, Vedado\n🍔 Pedido:\n- 2x Hamburguesa Especial ($950)\n- 2x Cerveza Cristal ($400)\n🛵 Envío: 300\n💳 Pago: Transfermóvil (Pagado)\n📝 Notas: Tocar timbre apto 3B`}
                  className="w-full text-xs font-mono p-3 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-slate-900 leading-relaxed shadow-inner"
                />
              </div>

              {/* Sample Templates Helper */}
              {!rawWhatsAppText.trim() && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                  <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <span>💡 ¿Quieres probar un ejemplo rápido?</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SAMPLE_WHATSAPP_MESSAGES.map((sample, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setRawWhatsAppText(sample.text)}
                        className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-[11px] font-bold text-slate-700 transition cursor-pointer shadow-2xs"
                      >
                        {sample.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Extraction Preview Card */}
              {rawWhatsAppText.trim() && (
                <div className="p-3.5 bg-white rounded-2xl border border-emerald-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Información Detectada en Tiempo Real:
                    </span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {liveParsed.items.length} productos
                    </span>
                  </div>

                  {/* Extracted Fields Badges */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/60">
                      <span className="text-[10px] text-slate-500 font-bold block">👤 Destinatario / Cliente:</span>
                      <span className="font-extrabold text-slate-900 truncate block">
                        {liveParsed.customerName || <span className="text-amber-600 italic">No especificado</span>}
                      </span>
                    </div>

                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/60">
                      <span className="text-[10px] text-slate-500 font-bold block">📞 Teléfono:</span>
                      <span className="font-extrabold text-slate-900 block font-mono">
                        {liveParsed.customerPhone || <span className="text-amber-600 italic">No especificado</span>}
                      </span>
                    </div>

                    <div className="sm:col-span-2 p-2 bg-slate-50 rounded-xl border border-slate-200/60">
                      <span className="text-[10px] text-slate-500 font-bold block">📍 Dirección de Entrega:</span>
                      <span className="font-bold text-slate-900 block">
                        {liveParsed.customerAddress || <span className="text-amber-600 italic">No especificada</span>}
                      </span>
                      {liveParsed.customerLocationUrl && (
                        <div className="mt-1 pt-1 border-t border-slate-200/60 flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                          <IconMapPin size={12} className="shrink-0" />
                          <span className="truncate">GPS detectado: {liveParsed.customerLocationUrl}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Extracted Items */}
                  {liveParsed.items.length > 0 ? (
                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                      <span className="text-[11px] font-bold text-slate-600 block">
                        🛒 Productos Reconocidos ({liveParsed.items.length}):
                      </span>
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                        {liveParsed.items.map((it, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="text-base">{it.emoji || "📦"}</span>
                              <div className="truncate">
                                <span className="font-extrabold text-slate-900">{it.qty}x </span>
                                <span className="font-bold text-slate-800">{it.name}</span>
                              </div>
                            </div>
                            <span className="font-extrabold text-slate-900 shrink-0">
                              {formatCurrency(it.price * it.qty, "CUP", state.rates)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs font-medium">
                      ⚠️ No se identificaron productos todavía. Asegúrate de incluir líneas como `• 2x Hamburguesa ($950)` o `1 Pizza Jamón 800`.
                    </div>
                  )}

                  {/* Pricing and Details Badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-bold text-slate-700">
                    <span className="px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200">
                      🛵 Envío: <strong className="text-slate-900">${liveParsed.deliveryFee} CUP</strong>
                    </span>
                    <span className="px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200">
                      💳 Pago: <strong className="text-slate-900">{liveParsed.paymentMethod.toUpperCase()}</strong> ({liveParsed.paymentStatus})
                    </span>
                    {liveParsed.notes && (
                      <span className="px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200 truncate max-w-xs">
                        📝 Nota: {liveParsed.notes}
                      </span>
                    )}
                  </div>

                  {/* Subtotal Banner */}
                  <div className="p-2.5 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Calculado</span>
                      <span className="text-base font-black text-amber-400">
                        {formatCurrency(liveTotal, "CUP", state.rates)}
                      </span>
                    </div>
                    <span className="text-xs text-slate-300 font-medium">
                      Prod: ${liveItemsSubtotal} + Envío: ${liveParsed.deliveryFee}
                    </span>
                  </div>
                </div>
              )}

              {parsedNotification && (
                <div className="p-3 bg-emerald-600 text-white rounded-2xl text-xs font-extrabold text-center shadow-md animate-bounce">
                  {parsedNotification}
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleProcessWhatsAppText}
                  disabled={!rawWhatsAppText.trim()}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                >
                  <IconCheck size={16} />
                  <span>Autocompletar Formulario</span>
                </button>

                <button
                  type="button"
                  onClick={handleDirectCreateFromWhatsApp}
                  disabled={!rawWhatsAppText.trim() || liveParsed.items.length === 0}
                  className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-95 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                >
                  <span>🚀 Crear Pedido Directamente</span>
                </button>
              </div>
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
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:outline-hidden bg-slate-50 font-bold"
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
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:outline-hidden bg-slate-50 font-bold font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Dirección de Entrega Exacta *
                  </label>
                  {customerAddress.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        const url = generateGoogleMapsSearchUrl(customerAddress);
                        setCustomerLocationUrl(url);
                      }}
                      className="text-[10.5px] font-extrabold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                    >
                      <IconMapPin size={12} />
                      <span>Generar Enlace GPS</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={customerAddress}
                  onChange={(e) => {
                    setCustomerAddress(e.target.value);
                    // If no custom GPS url was manually pasted, update auto-generated search URL
                    if (!customerLocationUrl || customerLocationUrl.includes("maps.google.com/search")) {
                      if (e.target.value.trim()) {
                        setCustomerLocationUrl(generateGoogleMapsSearchUrl(e.target.value));
                      }
                    }
                  }}
                  placeholder="Ej. Calle 23 #456 e/ J e I, Apto 3B, Vedado (o cualquier dirección del mundo)"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:outline-hidden bg-slate-50 font-bold"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Enlace GPS / Google Maps (Opcional):
                  </label>
                  {customerLocationUrl && (
                    <a
                      href={customerLocationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10.5px] font-extrabold text-blue-700 hover:text-blue-900 flex items-center gap-1"
                    >
                      <span>🗺️ Probar Mapa ↗</span>
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    <IconMapPin size={16} />
                  </div>
                  <input
                    type="url"
                    value={customerLocationUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      // If user pastes raw coordinates like "25.7617, -80.1918", auto-convert to Google Maps URL
                      const coordsUrl = extractGpsUrlOrCoordinates(val);
                      setCustomerLocationUrl(coordsUrl || val);
                    }}
                    placeholder="https://maps.google.com/?q=... o coordenadas lat, lng"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:outline-hidden bg-slate-50 font-mono"
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
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
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
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/80">
          <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
            {tab === "whatsapp"
              ? "Pega el WhatsApp o selecciona un ejemplo para autocompletar."
              : `Comanda lista con ${items.length} producto(s).`}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer"
            >
              Cerrar
            </button>
            {tab === "manual" ? (
              <button
                type="submit"
                form="delivery-order-form"
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <span>💾 Guardar Pedido</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleProcessWhatsAppText}
                disabled={!rawWhatsAppText.trim()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <span>⚡ Transferir a Formulario</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
