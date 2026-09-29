import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  IconPlus,
  IconTrash,
  IconEdit,
  IconCheck,
  IconX,
  IconSparkles,
} from "./Icons";
import { useStore, actions, TEMPLATE_PRESETS } from "../store";
import type { Category } from "../types";

const CATEGORY_COLORS = [
  "#0E3A2F",
  "#6B3F1D",
  "#C0392B",
  "#D4A24E",
  "#A0522D",
  "#E67E22",
  "#F1C40F",
  "#3498DB",
  "#8E44AD",
  "#16A085",
  "#E84393",
  "#5D4037",
  "#1E293B",
  "#059669",
];

const CATEGORY_ICONS = [
  // Gastronomía, Alimentos y Bebidas (conservando existentes y complementarios)
  "📦", "☕", "🥤", "🍽️", "🍔", "🍕", "🥪", "🍰", "🍩", "🍹", "🍺", "🍷",
  "🥫", "🧀", "🥩", "🍎", "🥑", "🍪", "🍫", "🥐", "🥖", "🍗", "🍦", "💧",
  "🥭", "🍌", "🍞", "🧁", "🍸", "🍬", "🥚", "🌮", "🥗", "🍇", "🍓", "🍉",
  "🌽", "🥕", "🌾", "🚬",

  // Informática, Tecnología y Electrónica
  "💻", "🖥️", "📱", "⌨️", "🖱️", "💾", "🔋", "🔌", "🖨️", "📡", "🖲️",

  // Audio, Video, Fotografía y Entretenimiento
  "🎧", "🔊", "🎙️", "📷", "📺", "📻", "🎬", "🎮", "🕹️",

  // Hogar, Decoración, Muebles y Ferretería
  "💡", "🛋️", "🛏️", "🪴", "⏰", "🔨", "🪚", "🪛", "🧰", "🚪", "🪑", "🔑",
  "🎨", "🧱",

  // Productos de Limpieza, Higiene y Aseo
  "🧼", "🧴", "🧹", "🧻", "🪥", "🧽", "🧺", "🪣", "🚿",

  // Comercio General, Papelería, Moda y Accesorios
  "🛒", "🏷️", "📚", "🎒", "🧸", "⚽", "🏀", "👓", "💍", "⌚", "🎁", "🛍️",
  "🔖", "📎", "📏", "📐", "✏️", "🖊️",

  // Textil, Calzado, Servicios, Salud y Transporte
  "👕", "👟", "👗", "🥾", "🧢", "🔧", "💼", "🛠️", "⚡", "🔩", "📋", "✂️",
  "💊", "🍂", "✨", "💈", "💅", "💄", "🩺", "🩹", "🚕", "🚗", "🚲", "🛵",
  "🏍️", "🚚"
];

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCategory?: (categoryName: string) => void;
}

export function CategoryManagerModal({
  isOpen,
  onClose,
  onSelectCategory,
}: CategoryManagerModalProps) {
  const state = useStore();
  const categories = state.categories || [];

  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0E3A2F");
  const [icon, setIcon] = useState("📦");
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (!isOpen) return null;

  const startCreate = () => {
    setEditingCat(null);
    setName("");
    setColor(CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)]);
    setIcon("📦");
    setError(null);
    setIsCreating(true);
  };

  const startEdit = (cat: Category) => {
    setIsCreating(false);
    setEditingCat(cat);
    setName(cat.name);
    setColor(cat.color || "#0E3A2F");
    setIcon(cat.icon || "📦");
    setError(null);
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("El nombre de la categoría es obligatorio");
      return;
    }

    // Check duplicate
    const duplicate = categories.find(
      (c) =>
        c.name.toLowerCase() === trimmed.toLowerCase() &&
        (editingCat ? c.id !== editingCat.id : true)
    );
    if (duplicate) {
      setError("Ya existe una categoría con este nombre");
      return;
    }

    if (editingCat) {
      actions.updateCategory(editingCat.id, {
        name: trimmed,
        color,
        icon,
      });
    } else {
      actions.addCategory({
        name: trimmed,
        color,
        icon,
      });
      if (onSelectCategory) {
        onSelectCategory(trimmed);
      }
    }

    setIsCreating(false);
    setEditingCat(null);
    setName("");
  };

  const handleDelete = (id: string) => {
    actions.deleteCategory(id);
    setDeleteConfirmId(null);
  };

  const getProductCount = (catName: string) => {
    return state.products.filter(
      (p) => p.category.toLowerCase() === catName.toLowerCase()
    ).length;
  };

  return (
    <div
      id="category-manager-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-sm">
              🏷️
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white">
                Gestión de Categorías
              </h2>
              <p className="text-[11px] text-slate-400">
                {categories.length} categorías activas en el catálogo
              </p>
            </div>
          </div>
          <button
            id="close-category-manager-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Create or Edit Form */}
          <AnimatePresence>
            {(isCreating || editingCat) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="card p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-xs text-slate-900 uppercase tracking-wide">
                    {editingCat ? "Editar Categoría" : "Nueva Categoría"}
                  </h3>
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setEditingCat(null);
                    }}
                    className="text-slate-400 hover:text-slate-700 text-xs font-bold"
                  >
                    Cancelar
                  </button>
                </div>

                {error && (
                  <div className="text-[11px] font-bold text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-200">
                    {error}
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1">
                    Nombre de la Categoría
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Cafetería, Bebidas, Abarrotes, Servicios"
                    className="w-full neu-inset rounded-xl px-3 h-10 text-xs font-bold text-slate-900 outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-extrabold text-slate-600 uppercase block">
                      Icono Representativo
                    </label>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {CATEGORY_ICONS.length} opciones disponibles
                    </span>
                  </div>
                  <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5 max-h-32 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200 shadow-inner">
                    {CATEGORY_ICONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setIcon(emoji)}
                        className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition cursor-pointer shrink-0 ${
                          icon === emoji
                            ? "bg-slate-900 text-white scale-110 shadow-xs ring-2 ring-amber-400"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-800"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1">
                    Color de Etiqueta
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {CATEGORY_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                          color === c
                            ? "border-amber-400 scale-110 shadow-md ring-2 ring-amber-400/40"
                            : "border-white"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleSave}
                    className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <IconCheck size={14} className="text-amber-400" />
                    <span>{editingCat ? "Guardar Cambios" : "Crear Categoría"}</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add Category Button */}
          {!isCreating && !editingCat && (
            <button
              id="add-new-category-btn"
              onClick={startCreate}
              className="w-full py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-98 cursor-pointer"
            >
              <IconPlus size={16} />
              <span>+ CREAR NUEVA CATEGORÍA</span>
            </button>
          )}

          {/* Categories List */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
              Categorías en Uso ({categories.length})
            </label>

            {categories.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200">
                <p className="text-xs text-slate-500 font-bold">
                  No hay categorías registradas.
                </p>
              </div>
            ) : (
              categories.map((cat) => {
                const count = getProductCount(cat.name);
                const isConfirmingDelete = deleteConfirmId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className="p-3 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 flex items-center justify-between gap-2 shadow-xs transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 shadow-xs"
                        style={{ backgroundColor: `${cat.color || "#0E3A2F"}20` }}
                      >
                        <span>{cat.icon || "📦"}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-xs text-slate-900 truncate flex items-center gap-1.5">
                          <span>{cat.name}</span>
                          <span
                            className="w-2 h-2 rounded-full inline-block shrink-0"
                            style={{ backgroundColor: cat.color || "#0E3A2F" }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold">
                          {count} {count === 1 ? "producto" : "productos"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1 animate-pop">
                          <button
                            onClick={() => handleDelete(cat.id)}
                            className="px-2 py-1 rounded-lg bg-rose-600 text-white font-extrabold text-[10px] hover:bg-rose-700"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 font-bold text-[10px]"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(cat)}
                            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                            title="Editar categoría"
                          >
                            <IconEdit size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(cat.id)}
                            className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Eliminar categoría"
                          >
                            <IconTrash size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Business Templates Loader */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center gap-1.5 mb-2">
              <IconSparkles size={14} className="text-amber-500" />
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                Plantillas Rápidas por Sector
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(TEMPLATE_PRESETS) as (keyof typeof TEMPLATE_PRESETS)[]).map(
                (key) => {
                  const preset = TEMPLATE_PRESETS[key];
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        actions.applyBusinessPreset(key);
                      }}
                      className="p-2 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 text-left transition cursor-pointer"
                    >
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <span>{preset.icon}</span>
                        <span className="truncate">{preset.label.split(" ")[0]}</span>
                      </div>
                      <div className="text-[9.5px] text-slate-500 truncate">
                        {preset.categories.length} categorías
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-right shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition cursor-pointer"
          >
            Listo
          </button>
        </div>
      </motion.div>
    </div>
  );
}
