import { useMemo, useState } from "react";
import { useStore, actions } from "../store";
import { TopBar } from "../components/Layout";
import {
  IconSearch,
  IconPlus,
  IconEdit,
  IconTrash,
  IconFilter,
  IconAlert,
  IconCamera,
  IconBox,
  IconDownload,
  IconCheck,
  IconShare,
  IconTag,
  IconLayers,
  IconHistory,
  IconArrowUp,
  IconArrowDown,
  IconFileSpreadsheet,
} from "../components/Icons";
import { formatCurrency } from "../utils/currency";
import { CategorySlider } from "../components/CategorySlider";
import { CategoryManagerModal } from "../components/CategoryManagerModal";
import { StockHistoryView } from "../components/StockHistoryView";
import { StockMovementModal } from "../components/StockMovementModal";
import { LowStockHighlightSection } from "../components/LowStockHighlightSection";
import { LowStockAlertModal } from "../components/LowStockAlertModal";
import type { Product, AppState } from "../types";
import { generateInventoryPdf } from "../utils/pdfExport";
import { downloadOrShareInventoryCatalogCsv } from "../utils/csvExport";

interface ProductRowProps {
  key?: string;
  p: Product;
  state: AppState;
  onEdit: () => void;
  onDelete: () => void;
  onQuickMovement: () => void;
}

export function InventarioScreen({
  onAdd,
  onEdit,
}: {
  onAdd: () => void;
  onEdit: (p: Product) => void;
}) {
  const state = useStore();
  const [activeTab, setActiveTab] = useState<"catalog" | "kardex">("catalog");
  const [query, setQuery] = useState("");
  const [showLow, setShowLow] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [confirmDel, setConfirmDel] = useState<Product | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [pdfToast, setPdfToast] = useState<string | null>(null);
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [movementModalProductId, setMovementModalProductId] = useState<string | null>(null);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isLowStockAlertModalOpen, setIsLowStockAlertModalOpen] = useState(false);

  const handleExportPdf = async (preferShare = false) => {
    try {
      setIsExportingPdf(true);
      const res = await generateInventoryPdf(state.products, state.business, state.rates, preferShare);
      if (res.method === "share" && res.success) {
        setPdfToast("¡Catálogo compartido!");
      } else if (res.method === "download" && res.success) {
        setPdfToast("Catálogo PDF descargado.");
      }
    } catch (err) {
      console.error("Error exporting inventory PDF:", err);
      setPdfToast("Error al compilar PDF.");
    } finally {
      setIsExportingPdf(false);
      setTimeout(() => setPdfToast(null), 3000);
    }
  };

  const handleExportCsv = async (preferShare = false) => {
    try {
      setIsExportingCsv(true);
      const targetProducts =
        list.length > 0 && (query.trim() || categoryFilter !== "Todos" || showLow)
          ? list
          : state.products;

      const res = await downloadOrShareInventoryCatalogCsv(
        targetProducts,
        state.business,
        state.rates,
        preferShare
      );
      if (res.method === "share" && res.success) {
        setPdfToast("¡Catálogo CSV compartido!");
      } else if (res.method === "download" && res.success) {
        setPdfToast("Inventario CSV descargado (compatible con Excel y Google Sheets).");
      }
    } catch (err) {
      console.error("Error exporting inventory CSV:", err);
      setPdfToast("Error al exportar inventario a CSV.");
    } finally {
      setIsExportingCsv(false);
      setTimeout(() => setPdfToast(null), 3500);
    }
  };

  // Derive categories from dynamic state.categories and products
  const categories = useMemo(() => {
    const set = new Set<string>();
    (state.categories || []).forEach((c) => {
      if (c.name) set.add(c.name);
    });
    state.products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ["Todos", ...Array.from(set)];
  }, [state.categories, state.products]);

  // Inventory valuation metrics
  const totalStockUnits = useMemo(() => {
    return state.products.reduce((a, b) => a + b.stock, 0);
  }, [state.products]);

  const totalValuationCost = useMemo(() => {
    return state.products.reduce((a, b) => a + b.stock * b.cost, 0);
  }, [state.products]);

  const totalValuationSale = useMemo(() => {
    return state.products.reduce((a, b) => a + b.stock * b.price, 0);
  }, [state.products]);

  const totalLowStockCount = useMemo(() => {
    return state.products.filter((p) => p.stock <= p.lowStockAlert).length;
  }, [state.products]);

  const list = useMemo(() => {
    return state.products
      .filter((p) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.includes(q))
        );
      })
      .filter((p) => categoryFilter === "Todos" || p.category === categoryFilter)
      .filter((p) => !showLow || p.stock <= p.lowStockAlert)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.products, query, showLow, categoryFilter]);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <TopBar
        title="Almacén & Inventario"
        subtitle={
          activeTab === "catalog"
            ? `${state.products.length} productos registrados`
            : `${state.movements.length} movimientos en Kardex`
        }
        right={
          <div className="flex items-center gap-1.5">
            {activeTab === "catalog" ? (
              <>
                <button
                  onClick={() => {
                    setMovementModalProductId(state.products[0]?.id || "");
                    setIsMovementModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs flex items-center gap-1 transition cursor-pointer shadow-xs"
                  title="Registrar entrada o salida manual de existencias"
                >
                  <IconPlus size={13} />
                  <span className="hidden sm:inline">Movimiento</span>
                </button>
                <button
                  onClick={() => setIsCatManagerOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center gap-1 transition cursor-pointer border border-slate-200"
                  title="Gestionar Categorías del Catálogo"
                >
                  <IconTag size={13} className="text-amber-600" />
                  <span className="hidden sm:inline">Categorías</span>
                </button>
                <button
                  onClick={() => handleExportPdf(false)}
                  disabled={isExportingPdf}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-xs flex items-center gap-1 transition cursor-pointer shadow-xs active:scale-95"
                  title="Descargar Catálogo de Inventario en PDF"
                >
                  {isExportingPdf ? (
                    <div className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <IconDownload size={13} />
                  )}
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => handleExportCsv(false)}
                  disabled={isExportingCsv}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-1 transition cursor-pointer shadow-xs active:scale-95"
                  title="Exportar inventario a CSV para abrir en Excel o Google Sheets"
                >
                  {isExportingCsv ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <IconFileSpreadsheet size={13} />
                  )}
                  <span>CSV</span>
                </button>
              </>
            ) : null}
          </div>
        }
      />

      {/* Main Tab Switcher: Catálogo vs Kardex */}
      <div className="px-3 md:px-5 pt-1 pb-2 shrink-0">
        <div className="bg-slate-900/95 p-1 rounded-2xl border border-slate-800 flex items-center gap-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={`flex-1 py-2 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === "catalog"
                ? "bg-amber-400 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <IconBox size={14} />
            <span>Catálogo de Stock</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                activeTab === "catalog"
                  ? "bg-slate-950/20 text-slate-950 font-bold"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {state.products.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("kardex")}
            className={`flex-1 py-2 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === "kardex"
                ? "bg-amber-400 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <IconHistory size={14} />
            <span>Historial / Kardex</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                activeTab === "kardex"
                  ? "bg-slate-950/20 text-slate-950 font-bold"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {state.movements.length}
            </span>
          </button>
        </div>
      </div>

      {pdfToast && (
        <div className="mx-3 md:mx-5 mb-2 p-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-between shadow-md animate-pop">
          <div className="flex items-center gap-2">
            <IconCheck size={15} />
            <span>{pdfToast}</span>
          </div>
          <button onClick={() => setPdfToast(null)} className="font-bold text-xs">✕</button>
        </div>
      )}

      {/* View Content: Catalog or Kardex */}
      {activeTab === "kardex" ? (
        <div className="flex-1 overflow-y-auto px-3 md:px-5 pb-24 md:pb-6">
          <StockHistoryView
            movements={state.movements}
            products={state.products}
            business={state.business}
            rates={state.rates}
          />
        </div>
      ) : (
        <>
          <div className="px-3 md:px-5 space-y-2.5 mb-2 shrink-0">
            {/* Inventory Summary Valuation Card */}
            <div className="p-3.5 rounded-2xl bg-slate-900 text-white shadow-md flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                  VALORACIÓN TOTAL DE STOCK
                </div>
                <div className="text-lg font-extrabold text-amber-400">
                  {formatCurrency(totalValuationSale, "CUP", state.rates)}
                </div>
                <div className="text-[11px] text-slate-300">
                  Costo de inversión: {formatCurrency(totalValuationCost, "CUP", state.rates)}
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block px-2.5 py-1 rounded-xl bg-white/10 text-white font-extrabold text-xs">
                  {totalStockUnits} Unidades
                </span>
              </div>
            </div>

            {/* Search Bar */}
            <div className="neu-inset rounded-2xl flex items-center gap-2 px-3.5 h-11">
              <IconSearch size={17} className="text-slate-400 shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por producto o código..."
                className="flex-1 bg-transparent outline-none text-xs font-semibold text-slate-900"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="text-xs text-slate-400 hover:text-slate-700 font-bold px-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category & Low Stock Filter Slider */}
            <CategorySlider
              categories={categories}
              selectedCategory={showLow ? "" : categoryFilter}
              onSelectCategory={(cat) => {
                setShowLow(false);
                setCategoryFilter(cat);
              }}
              prefixElement={
                <button
                  type="button"
                  onClick={() => setShowLow((s) => !s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 shrink-0 transition cursor-pointer active:scale-95 ${
                    showLow
                      ? "bg-rose-600 text-white shadow-sm ring-1 ring-rose-600"
                      : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
                  }`}
                >
                  <IconAlert size={14} />
                  <span>
                    {showLow
                      ? `Stock Bajo (${totalLowStockCount})`
                      : `Stock Bajo (${totalLowStockCount})`}
                  </span>
                </button>
              }
            />
          </div>

          {/* Product List */}
          <div className="flex-1 overflow-y-auto px-3 md:px-5 pb-24 md:pb-6 space-y-3">
            {/* Low Stock Highlight & Restock Section */}
            {state.products.length > 0 && (
              <LowStockHighlightSection
                products={state.products}
                rates={state.rates}
                onRestock={(productId) => {
                  setMovementModalProductId(productId);
                  setIsMovementModalOpen(true);
                }}
                onEditProduct={(p) => onEdit(p)}
                onOpenAlertSettings={() => setIsLowStockAlertModalOpen(true)}
                onFilterInCatalog={() => setShowLow((s) => !s)}
                isFilterActive={showLow}
              />
            )}

            {list.map((p) => (
              <ProductRow
                key={p.id}
                p={p}
                state={state}
                onEdit={() => onEdit(p)}
                onDelete={() => setConfirmDel(p)}
                onQuickMovement={() => {
                  setMovementModalProductId(p.id);
                  setIsMovementModalOpen(true);
                }}
              />
            ))}

            {state.products.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 my-6 text-center bg-white rounded-3xl border border-slate-200 shadow-xs">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-3xl mb-3 shadow-xs">
                  📦
                </div>
                <h3 className="font-extrabold text-sm text-slate-900 mb-1">
                  Catálogo de Inventario Vacío
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">
                  Aún no tienes productos registrados en el inventario. Empieza registrando tu primer producto o configura tus categorías.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
                  <button
                    onClick={onAdd}
                    className="flex-1 py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer active:scale-95"
                  >
                    <IconPlus size={16} className="text-amber-400" />
                    <span>+ AÑADIR PRODUCTO</span>
                  </button>
                  <button
                    onClick={() => setIsCatManagerOpen(true)}
                    className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-200 active:scale-95"
                  >
                    <IconTag size={15} />
                    <span>Categorías</span>
                  </button>
                </div>
              </div>
            ) : list.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs font-semibold">
                No se encontraron productos coincidentes con los filtros seleccionados.
              </div>
            ) : null}
          </div>

          {/* Floating Action Button */}
          <button
            onClick={onAdd}
            className="absolute right-4 bottom-20 md:bottom-6 w-14 h-14 rounded-full
                       bg-amber-400 hover:bg-amber-300 text-slate-950
                       shadow-2xl flex items-center justify-center
                       active:scale-95 transition z-20 cursor-pointer"
            aria-label="Añadir producto"
            title="Crear nuevo producto"
          >
            <IconPlus size={26} />
          </button>
        </>
      )}

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCatManagerOpen}
        onClose={() => setIsCatManagerOpen(false)}
      />

      {/* Quick Movement Modal */}
      <StockMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => {
          setIsMovementModalOpen(false);
          setMovementModalProductId(null);
        }}
        products={state.products}
        selectedProductId={movementModalProductId || undefined}
        onSuccess={(msg) => {
          setPdfToast(msg);
          setTimeout(() => setPdfToast(null), 3000);
        }}
      />

      {/* Low Stock Notifications & Alert Settings Modal */}
      <LowStockAlertModal
        isOpen={isLowStockAlertModalOpen}
        onClose={() => setIsLowStockAlertModalOpen(false)}
        onEditProduct={(p) => onEdit(p)}
      />

      {/* Delete Confirmation Modal */}
      {confirmDel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-pop"
          onClick={() => setConfirmDel(null)}
        >
          <div
            className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-black/10 text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-extrabold text-base">¿Eliminar producto?</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              "{confirmDel.name}" será eliminado del inventario activo. Esta acción no afecta las ventas ya registradas.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setConfirmDel(null)}
                className="flex-1 py-2.5 rounded-xl neu-sm font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  actions.deleteProduct(confirmDel.id);
                  setConfirmDel(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md cursor-pointer transition"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductRow({ p, state, onEdit, onDelete, onQuickMovement }: ProductRowProps) {
  const isOutOfStock = p.stock <= 0;
  const isLow = p.stock <= p.lowStockAlert && !isOutOfStock;

  return (
    <div
      className={`card p-3 rounded-2xl flex gap-3 items-center border transition ${
        isOutOfStock
          ? "border-rose-300 border-l-4 border-l-rose-600 bg-rose-50/25 shadow-2xs"
          : isLow
          ? "border-amber-300 border-l-4 border-l-amber-500 bg-amber-50/20 shadow-2xs"
          : "border-black/5 hover:border-black/10"
      }`}
    >
      {/* Product Image / Icon */}
      <div
        className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center text-3xl shrink-0 bg-slate-900 shadow-xs"
        style={{
          background: p.image
            ? "#0F172A"
            : `linear-gradient(135deg, ${p.color}30, ${p.color}65)`,
        }}
      >
        {p.image ? (
          <img
            src={p.image}
            alt={p.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span>{p.emoji}</span>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0">
            <h4 className="font-extrabold text-xs text-slate-900 truncate leading-tight">
              {p.name}
            </h4>
            <div className="text-[11px] text-slate-500 font-medium truncate">
              {p.category} • Costo: {formatCurrency(p.cost, "CUP", state.rates)}
            </div>
          </div>

          <span className="text-xs font-extrabold bg-amber-100 text-slate-950 px-2 py-0.5 rounded-lg whitespace-nowrap">
            {formatCurrency(p.price, "CUP", state.rates)}
          </span>
        </div>

        {/* Stock & Quick Adjust */}
        <div className="flex items-center justify-between mt-2 pt-1 border-t border-black/5">
          <div
            className={`flex items-center gap-1 text-xs font-extrabold ${
              isOutOfStock
                ? "text-rose-600"
                : isLow
                ? "text-amber-600"
                : "text-slate-700"
            }`}
          >
            {(isOutOfStock || isLow) && <IconAlert size={13} />}
            Stock: {p.stock} {p.unit}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onQuickMovement}
              className="px-2 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition border border-emerald-200"
              title="Registrar entrada o merma para este producto"
            >
              <IconArrowUp size={11} className="text-emerald-600" />
              <span>Movimiento</span>
            </button>
            <button
              onClick={onEdit}
              className="px-2 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition"
            >
              <IconEdit size={11} /> Editar
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer transition"
              title="Eliminar producto"
              aria-label="Eliminar"
            >
              <IconTrash size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
