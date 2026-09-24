import { useState, type ReactNode, useRef, type ChangeEvent } from "react";
import { actions, useStore } from "../store";
import { TopBar } from "../components/Layout";
import {
  IconCamera,
  IconPlus,
  IconMinus,
  IconCheck,
  IconEdit,
  IconTrash,
  IconImage,
  IconBarcode,
  IconSparkles,
} from "../components/Icons";
import { CameraCaptureModal } from "../components/CameraCaptureModal";
import { CategoryManagerModal } from "../components/CategoryManagerModal";
import { compressImage } from "../utils/imageUtils";
import type { Product } from "../types";

const EMOJI_PALETTE = [
  "☕", "🥤", "🥖", "🍗", "🍕", "🍦", "💧", "🍪", "🥪", "🍂",
  "🥭", "🍫", "🍎", "🍌", "🥑", "🥩", "🧀", "🍞", "🧁", "🍰",
  "🍺", "🍷", "🍸", "🍹", "🧼", "🧴", "🍬", "🥚", "🥫", "🚬",
  "📦", "💼", "🛠️", "⚡", "🔩", "📋", "👕", "👟", "🔧", "✂️",
  "💻", "🖥️", "📱", "⌨️", "🖱️", "💾", "🔋", "🔌", "🖨️", "📡",
  "🎧", "🔊", "🎙️", "📷", "📺", "📻", "🎬", "🎮",
  "💡", "🛋️", "🛏️", "🪴", "⏰", "🔨", "🪚", "🪛", "🧰", "🚪", "🪑", "🔑", "🎨", "🧱",
  "🧹", "🧻", "🪥", "🧽", "🧺", "🪣", "🚿",
  "🛒", "🏷️", "📚", "🎒", "🧸", "⚽", "🏀", "👓", "💍", "⌚", "🎁", "🛍️",
  "👗", "🥾", "🧢", "💈", "💅", "💄", "🩺", "🩹", "🚕", "🚗", "🚲", "🛵", "🏍️", "🚚"
];

const COLORS = [
  "#0E3A2F", "#6B3F1D", "#C0392B", "#D4A24E", "#A0522D",
  "#E67E22", "#F1C40F", "#3498DB", "#8E44AD", "#16A085",
  "#E84393", "#5D4037", "#1E293B", "#059669"
];

const UNITS_OF_MEASURE = [
  { value: "u", label: "u (Unidades / Piezas)" },
  { value: "porción", label: "porción (Porción / Ración)" },
  { value: "kg", label: "kg (Kilogramos)" },
  { value: "g", label: "g (Gramos)" },
  { value: "lb", label: "lb (Libras)" },
  { value: "oz", label: "oz (Onzas)" },
  { value: "L", label: "L (Litros)" },
  { value: "ml", label: "ml (Mililitros)" },
  { value: "servicio", label: "servicio (Servicio Profesional)" },
  { value: "hora", label: "hora (Tarifa por Hora)" },
  { value: "pq", label: "pq (Paquete)" },
  { value: "caja", label: "caja (Caja / Bulto)" },
  { value: "par", label: "par (Par)" },
  { value: "m", label: "m (Metros)" },
];

export function EditProductScreen({
  initial,
  onClose,
}: {
  initial?: Product;
  onClose: () => void;
}) {
  const store = useStore();
  const categories = store.categories || [];

  const isNew = !initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(
    initial?.category ?? (categories[0]?.name || "General")
  );
  const [stock, setStock] = useState(initial?.stock ?? 1);
  const [cost, setCost] = useState<number>(initial?.cost ?? 0);
  const [price, setPrice] = useState<number>(initial?.price ?? 0);
  const [unit, setUnit] = useState(initial?.unit ?? "u");
  const [barcode, setBarcode] = useState(initial?.barcode ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [emoji, setEmoji] = useState(initial?.emoji ?? "📦");
  const [image, setImage] = useState<string | undefined>(initial?.image);
  const [color, setColor] = useState(initial?.color ?? "#0E3A2F");
  const [lowAlert, setLowAlert] = useState(initial?.lowStockAlert ?? 5);

  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const filePickerRef = useRef<HTMLInputElement | null>(null);

  const margin = price > 0 && cost > 0 ? ((price - cost) / price) * 100 : 0;
  const profit = price - cost;

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file, 600, 600, 0.85);
      setImage(dataUrl);
    } catch (err) {
      console.error("Error processing image upload", err);
    }
  };

  const handleGenerateSku = () => {
    const randomCode = "SKU-" + Math.floor(100000 + Math.random() * 900000);
    setBarcode(randomCode);
  };

  function save() {
    if (!name.trim()) return;
    const finalCategory = category.trim() || categories[0]?.name || "General";

    const p: Product = {
      id: initial?.id ?? "p_" + Date.now(),
      name: name.trim(),
      category: finalCategory,
      stock: Math.max(0, Math.floor(stock)),
      cost: Math.max(0, cost),
      price: Math.max(0, price),
      unit,
      active,
      emoji,
      image,
      color,
      barcode: barcode.trim() || undefined,
      lowStockAlert: Math.max(0, Math.floor(lowAlert)),
      createdAt: initial?.createdAt ?? Date.now(),
    };
    actions.addOrUpdateProduct(p, isNew);
    onClose();
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      <TopBar
        title={isNew ? "Nuevo Producto / Servicio" : "Ficha de Producto"}
        subtitle="Registro de catálogo e inventario"
        onBack={onClose}
      />

      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-8 space-y-4 text-slate-800">
        {/* Visual Media Card (Camera & Photo / Emoji) */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="relative group">
            <div
              className="w-36 h-36 rounded-3xl overflow-hidden shadow-xl border-4 border-white flex items-center justify-center relative bg-slate-900"
              style={{
                background: image
                  ? "#0F172A"
                  : `linear-gradient(135deg, ${color}35, ${color}70)`,
              }}
            >
              {image ? (
                <img
                  src={image}
                  alt="Foto de producto"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-6xl select-none">{emoji}</span>
              )}
            </div>

            {/* Quick remove photo button if image exists */}
            {image && (
              <button
                onClick={() => setImage(undefined)}
                className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg hover:bg-rose-700 transition cursor-pointer"
                title="Quitar foto"
              >
                <IconTrash size={14} />
              </button>
            )}
          </div>

          {/* Media Capture Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCameraModal(true)}
              className="px-3.5 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <IconCamera size={16} /> Tomar Foto
            </button>

            <button
              onClick={() => filePickerRef.current?.click()}
              className="p-2 rounded-2xl neu-sm text-slate-700 hover:text-slate-950 transition cursor-pointer"
              title="Subir imagen desde archivo"
            >
              <IconImage size={18} />
            </button>

            <button
              onClick={() => setShowEmojiPicker(true)}
              className="p-2 rounded-2xl neu-sm text-slate-700 hover:text-slate-950 transition cursor-pointer"
              title="Elegir icono / emoji representativo"
            >
              <IconEdit size={18} />
            </button>
          </div>

          <input
            ref={filePickerRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Active Toggle Switch */}
        <div className="flex justify-center">
          <button
            onClick={() => setActive(!active)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide flex items-center gap-2 transition cursor-pointer ${
              active
                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                : "bg-rose-100 text-rose-900 border border-rose-300"
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                active ? "bg-emerald-600 animate-pulse" : "bg-rose-600"
              }`}
            />
            PRODUCTO {active ? "ACTIVO PARA VENTA" : "INACTIVO (OCULTO EN CAJA)"}
          </button>
        </div>

        {/* Product Name */}
        <Field label="NOMBRE DEL PRODUCTO / SERVICIO *">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Café Expreso, Camisa Polo, Hamburguesa Especial"
            className="w-full bg-transparent outline-none px-4 h-12 text-slate-900 font-extrabold text-sm"
            autoFocus={isNew}
          />
        </Field>

        {/* Dynamic Category & Unit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="text-[11px] tracking-widest font-extrabold text-slate-500 uppercase">
                CATEGORÍA
              </label>
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="text-[10.5px] font-black text-amber-700 hover:text-amber-800 flex items-center gap-0.5 cursor-pointer"
              >
                <span>⚙️ Gestionar</span>
              </button>
            </div>
            <div className="neu-inset rounded-2xl flex items-center pr-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex-1 bg-transparent outline-none px-4 h-12 text-slate-900 font-bold text-xs appearance-none cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.icon || "📦"} {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="w-7 h-7 rounded-xl bg-amber-400/90 text-slate-950 font-bold flex items-center justify-center text-xs shrink-0 cursor-pointer shadow-xs"
                title="Añadir nueva categoría"
              >
                +
              </button>
            </div>
          </div>

          <Field label="UNIDAD DE MEDIDA (U/M)">
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full bg-transparent outline-none px-4 h-12 text-slate-900 font-bold text-xs appearance-none cursor-pointer"
            >
              {UNITS_OF_MEASURE.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Stock Level Selector */}
        <div>
          <label className="text-[11px] tracking-widest font-extrabold text-slate-500 mb-1.5 block uppercase">
            STOCK DISPONIBLE EN TIENDA / INVENTARIO
          </label>
          <div className="neu-inset rounded-2xl flex items-center justify-between px-3 h-14">
            <button
              type="button"
              onClick={() => setStock((s) => Math.max(0, s - 1))}
              className="w-10 h-10 rounded-full neu-sm flex items-center justify-center font-bold text-slate-800 cursor-pointer"
            >
              <IconMinus size={16} />
            </button>
            <div className="flex items-baseline gap-2">
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(parseInt(e.target.value || "0", 10))}
                className="w-24 text-center bg-transparent outline-none font-extrabold text-2xl text-slate-900"
              />
              <span className="text-xs text-slate-500 font-bold">{unit}</span>
            </div>
            <button
              type="button"
              onClick={() => setStock((s) => s + 1)}
              className="w-10 h-10 rounded-full neu-sm flex items-center justify-center font-bold text-slate-800 cursor-pointer"
            >
              <IconPlus size={16} />
            </button>
          </div>
        </div>

        {/* Cost & Price in CUP */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="PRECIO DE VENTA (CUP) *" hint="Precio público">
            <div className="flex items-center px-4 h-12 gap-1.5">
              <span className="text-slate-400 font-bold text-sm">$</span>
              <input
                type="number"
                min="0"
                step="any"
                value={price || ""}
                onChange={(e) => setPrice(parseFloat(e.target.value || "0"))}
                placeholder="0.00"
                className="flex-1 bg-transparent outline-none font-extrabold text-base text-slate-900"
              />
            </div>
          </Field>

          <Field label="COSTO DE COMPRA (CUP)" hint="Para balance de ganancias">
            <div className="flex items-center px-4 h-12 gap-1.5">
              <span className="text-slate-400 font-bold text-sm">$</span>
              <input
                type="number"
                min="0"
                step="any"
                value={cost || ""}
                onChange={(e) => setCost(parseFloat(e.target.value || "0"))}
                placeholder="0.00"
                className="flex-1 bg-transparent outline-none font-extrabold text-base text-slate-900"
              />
            </div>
          </Field>
        </div>

        {/* Profit Margin Preview Card */}
        {price > 0 && (
          <div className="p-3.5 rounded-2xl bg-slate-900 text-white flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
                Margen & Ganancia Unitaria
              </span>
              <div className="text-xs font-bold text-slate-200">
                Ganancia neta: <span className="text-emerald-400 font-extrabold">${profit.toFixed(2)} CUP</span>
              </div>
            </div>
            <div className="text-right">
              <span
                className={`inline-block px-2.5 py-1 rounded-xl text-xs font-black ${
                  margin > 35
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : margin > 15
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                }`}
              >
                {margin.toFixed(1)}% Margen
              </span>
            </div>
          </div>
        )}

        {/* Barcode / SKU with Autogenerate button */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label className="text-[11px] tracking-widest font-extrabold text-slate-500 uppercase">
              CÓDIGO DE BARRAS / SKU (OPCIONAL)
            </label>
            <button
              type="button"
              onClick={handleGenerateSku}
              className="text-[10.5px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
            >
              <IconSparkles size={12} />
              <span>Generar Código</span>
            </button>
          </div>
          <div className="neu-inset rounded-2xl flex items-center px-4 h-12 gap-2">
            <IconBarcode size={18} className="text-slate-400" />
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Ej. 780123456789 o SKU-84920"
              className="flex-1 bg-transparent outline-none text-slate-800 font-mono text-xs font-bold"
            />
          </div>
        </div>

        {/* Low Stock Alert Threshold */}
        <Field label="UMBRAL DE ALERTA (STOCK BAJO)">
          <input
            type="number"
            min="0"
            value={lowAlert}
            onChange={(e) => setLowAlert(parseInt(e.target.value || "0", 10))}
            className="w-full bg-transparent outline-none px-4 h-12 text-slate-900 font-bold text-sm"
          />
        </Field>

        {/* Card Accent Color */}
        <div>
          <label className="text-[11px] tracking-widest font-extrabold text-slate-500 mb-2 block uppercase">
            COLOR DE IDENTIFICACIÓN
          </label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 transition cursor-pointer ${
                  color === c
                    ? "border-amber-400 scale-110 shadow-md ring-2 ring-amber-400/40"
                    : "border-white"
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        {/* Save & Cancel Actions */}
        <div className="pt-3 space-y-2">
          <button
            id="save-product-btn"
            onClick={save}
            disabled={!name.trim()}
            className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-xl flex items-center justify-center gap-2 transition disabled:opacity-40 active:scale-[0.98] cursor-pointer"
          >
            <IconCheck size={18} className="text-amber-400" />
            <span>{isNew ? "REGISTRAR PRODUCTO EN CATÁLOGO" : "GUARDAR CAMBIOS DE PRODUCTO"}</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl text-slate-600 hover:text-slate-900 font-bold text-xs transition cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onSelectCategory={(newCat) => setCategory(newCat)}
      />

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={(img) => setImage(img)}
        currentImage={image}
        productName={name}
      />

      {/* Emoji Picker Sheet */}
      {showEmojiPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-xs"
          onClick={() => setShowEmojiPicker(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl p-5 animate-slide-up shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 rounded-full bg-slate-200 mx-auto mb-4" />
            <h3 className="font-extrabold text-sm text-slate-900 mb-3">
              Selecciona un Icono para el Catálogo
            </h3>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2.5 max-h-60 overflow-y-auto p-1">
              {EMOJI_PALETTE.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    setEmoji(e);
                    setShowEmojiPicker(false);
                  }}
                  className={`aspect-square rounded-2xl text-2xl flex items-center justify-center transition cursor-pointer ${
                    emoji === e
                      ? "bg-slate-900 text-white scale-105 shadow-md"
                      : "bg-slate-100 hover:bg-slate-200"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-[11px] tracking-widest font-extrabold text-slate-500 uppercase">
          {label}
        </label>
        {hint && (
          <span className="text-[10px] text-amber-700 font-bold">{hint}</span>
        )}
      </div>
      <div className="neu-inset rounded-2xl">{children}</div>
    </div>
  );
}
