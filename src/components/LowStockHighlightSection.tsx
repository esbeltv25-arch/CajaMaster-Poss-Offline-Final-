import { useState, useMemo } from "react";
import type { Product, ExchangeRates } from "../types";
import { formatCurrency } from "../utils/currency";
import {
  IconAlert,
  IconArrowUp,
  IconEdit,
  IconCheck,
  IconChevronDown,
  IconSliders,
  IconBell,
  IconFilter,
  IconPlus,
  IconMinus,
} from "./Icons";

interface LowStockHighlightSectionProps {
  products: Product[];
  rates: ExchangeRates;
  onRestock: (productId: string) => void;
  onEditProduct: (product: Product) => void;
  onOpenAlertSettings?: () => void;
  onFilterInCatalog?: () => void;
  isFilterActive?: boolean;
}

export function LowStockHighlightSection({
  products,
  rates,
  onRestock,
  onEditProduct,
  onOpenAlertSettings,
  onFilterInCatalog,
  isFilterActive = false,
}: LowStockHighlightSectionProps) {
  // Threshold mode: "product" uses each item's lowStockAlert, "custom" applies a global threshold
  const [thresholdMode, setThresholdMode] = useState<"product" | "custom">("product");
  const [customThreshold, setCustomThreshold] = useState<number>(5);
  const [filterMode, setFilterMode] = useState<"all" | "out">("all");
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Compute effective threshold per product
  const getProductThreshold = (p: Product): number => {
    if (thresholdMode === "custom") {
      return customThreshold;
    }
    return p.lowStockAlert && p.lowStockAlert > 0 ? p.lowStockAlert : 5;
  };

  // Find all products below or at threshold
  const criticalProducts = useMemo(() => {
    return products
      .filter((p) => {
        const thresh = getProductThreshold(p);
        const isBelow = p.stock <= thresh;
        if (!isBelow) return false;
        if (filterMode === "out") {
          return p.stock <= 0;
        }
        return true;
      })
      .sort((a, b) => {
        // Out of stock items first
        if (a.stock <= 0 && b.stock > 0) return -1;
        if (b.stock <= 0 && a.stock > 0) return 1;
        // Then by absolute stock ascending
        if (a.stock !== b.stock) return a.stock - b.stock;
        return a.name.localeCompare(b.name);
      });
  }, [products, thresholdMode, customThreshold, filterMode]);

  const outOfStockCount = useMemo(() => {
    return products.filter((p) => p.stock <= 0).length;
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => {
      const thresh = getProductThreshold(p);
      return p.stock > 0 && p.stock <= thresh;
    }).length;
  }, [products, thresholdMode, customThreshold]);

  const totalCriticalCount = outOfStockCount + lowStockCount;
  const hasCriticalItems = criticalProducts.length > 0;

  return (
    <section
      aria-label="Sección de productos con stock bajo"
      className={`rounded-3xl border transition-all duration-200 overflow-hidden ${
        hasCriticalItems
          ? "bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-slate-50 border-rose-300/80 shadow-xs"
          : "bg-emerald-500/5 border-emerald-200/80"
      }`}
    >
      {/* Header bar */}
      <div className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-black/5">
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${
              hasCriticalItems
                ? outOfStockCount > 0
                  ? "bg-rose-600 text-white"
                  : "bg-amber-500 text-slate-950"
                : "bg-emerald-600 text-white"
            }`}
          >
            {hasCriticalItems ? <IconAlert size={20} /> : <IconCheck size={20} />}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-xs sm:text-sm tracking-wide text-slate-900 uppercase">
                Alerta de Stock Mínimo & Reabastecimiento
              </h3>
              {hasCriticalItems ? (
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-rose-600 text-white shadow-2xs">
                  {totalCriticalCount} {totalCriticalCount === 1 ? "crítico" : "críticos"}
                </span>
              ) : (
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                  Óptimo
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-600 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
              {hasCriticalItems ? (
                <>
                  <span>
                    {outOfStockCount > 0 ? `${outOfStockCount} agotados` : "Sin agotados"}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>{lowStockCount} por debajo del umbral mínimo</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="text-slate-500">
                    {thresholdMode === "product"
                      ? "Umbral: Configuración por producto"
                      : `Umbral global: ≤ ${customThreshold} u`}
                  </span>
                </>
              ) : (
                <span>
                  Todos los {products.length} productos registrados superan su umbral mínimo de seguridad.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right side controls: Threshold Mode & Collapse */}
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0 flex-wrap">
          {/* Threshold Mode Selector */}
          <div className="flex items-center bg-white rounded-xl border border-slate-200 p-0.5 shadow-2xs text-[11px]">
            <button
              type="button"
              onClick={() => setThresholdMode("product")}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                thresholdMode === "product"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Evaluar según la alerta de stock mínimo configurada en cada producto"
            >
              Por producto
            </button>
            <button
              type="button"
              onClick={() => setThresholdMode("custom")}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                thresholdMode === "custom"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Definir un umbral numérico global para inspeccionar el catálogo"
            >
              Umbral fijo
            </button>
          </div>

          {/* Stepper when Custom Threshold is chosen */}
          {thresholdMode === "custom" && (
            <div className="flex items-center bg-white rounded-xl border border-slate-200 px-1 py-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setCustomThreshold((prev) => Math.max(1, prev - 1))}
                className="w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700 transition cursor-pointer"
                title="Disminuir umbral"
                aria-label="Disminuir umbral"
              >
                <IconMinus size={12} />
              </button>
              <span className="font-mono font-black text-xs px-2 text-slate-900">
                ≤ {customThreshold} u
              </span>
              <button
                type="button"
                onClick={() => setCustomThreshold((prev) => prev + 1)}
                className="w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700 transition cursor-pointer"
                title="Aumentar umbral"
                aria-label="Aumentar umbral"
              >
                <IconPlus size={12} />
              </button>
            </div>
          )}

          {/* Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition cursor-pointer"
            title={isCollapsed ? "Expandir sección de alertas" : "Plegar sección de alertas"}
            aria-label={isCollapsed ? "Expandir" : "Plegar"}
          >
            <div className={`transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`}>
              <IconChevronDown size={16} />
            </div>
          </button>
        </div>
      </div>

      {/* Main Body */}
      {!isCollapsed && (
        <div className="p-3.5 sm:p-4 space-y-3">
          {/* Quick Sub-actions bar */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            {/* Filter pills inside section */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  filterMode === "all"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                Todos los críticos ({totalCriticalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("out")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  filterMode === "out"
                    ? "bg-rose-600 text-white shadow-2xs"
                    : "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50"
                }`}
              >
                Solo agotados ({outOfStockCount})
              </button>
            </div>

            {/* General helper actions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {onFilterInCatalog && (
                <button
                  type="button"
                  onClick={onFilterInCatalog}
                  className={`px-2.5 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer shadow-2xs ${
                    isFilterActive
                      ? "bg-rose-600 text-white"
                      : "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50"
                  }`}
                  title="Activar o desactivar filtro en el catálogo principal"
                >
                  <IconFilter size={12} />
                  <span>{isFilterActive ? "Filtro activo" : "Filtrar en lista"}</span>
                </button>
              )}

              {onOpenAlertSettings && (
                <button
                  type="button"
                  onClick={onOpenAlertSettings}
                  className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title="Configurar notificaciones de sonido, push y vibración"
                >
                  <IconBell size={12} className="text-amber-500" />
                  <span className="hidden sm:inline">Avisos & Notificaciones</span>
                  <span className="sm:hidden">Avisos</span>
                </button>
              )}
            </div>
          </div>

          {/* Cards Grid or Healthy State */}
          {hasCriticalItems ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {criticalProducts.map((p) => {
                const thresh = getProductThreshold(p);
                const isOutOfStock = p.stock <= 0;
                const deficit = Math.max(0, thresh - p.stock);
                const progressPct =
                  thresh > 0 ? Math.min(100, Math.max(0, (p.stock / thresh) * 100)) : 0;

                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl p-3 border transition flex flex-col justify-between gap-2.5 bg-white shadow-xs hover:shadow-md ${
                      isOutOfStock
                        ? "border-rose-300 ring-1 ring-rose-200/50"
                        : "border-amber-300/80 ring-1 ring-amber-200/40"
                    }`}
                  >
                    {/* Top Row: Thumbnail + Product Info */}
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center text-xl shrink-0 bg-slate-900 shadow-2xs"
                        style={{
                          background: p.image
                            ? "#0F172A"
                            : `linear-gradient(135deg, ${p.color}30, ${p.color}70)`,
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
                          <span>{p.emoji || "📦"}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-extrabold text-xs text-slate-900 truncate leading-snug">
                            {p.name}
                          </h4>
                          <span
                            className={`text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase shrink-0 ${
                              isOutOfStock
                                ? "bg-rose-100 text-rose-700"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {isOutOfStock ? "Agotado" : "Bajo"}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                          <span>{p.category || "General"}</span>
                          <span aria-hidden="true" className="mx-1">·</span>
                          <span>{formatCurrency(p.price, "CUP", rates)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Middle Section: Stock Meter and Deficit */}
                    <div className="space-y-1.5 bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-extrabold text-slate-700">
                          Existencia:{" "}
                          <span
                            className={
                              isOutOfStock
                                ? "text-rose-600 font-black"
                                : "text-amber-700 font-black"
                            }
                          >
                            {p.stock} {p.unit}
                          </span>
                        </span>
                        <span className="text-slate-500 font-medium">
                          Mínimo: {thresh} {p.unit}
                        </span>
                      </div>

                      {/* Visual progress meter */}
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOutOfStock
                              ? "bg-rose-600 w-0"
                              : progressPct < 40
                              ? "bg-rose-500"
                              : "bg-amber-500"
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>

                      <div className="text-[10px] font-bold text-slate-500 flex items-center justify-between">
                        <span>
                          {isOutOfStock
                            ? "Sin existencias para la venta"
                            : `Faltan +${deficit} ${p.unit} para seguridad`}
                        </span>
                        {p.cost > 0 && (
                          <span className="text-slate-400">
                            Costo: {formatCurrency(p.cost, "CUP", rates)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Action Buttons */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => onRestock(p.id)}
                        className="flex-1 py-1.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1 transition shadow-2xs active:scale-95 cursor-pointer"
                        title="Registrar entrada de existencias (compra o reposición) para este producto"
                      >
                        <IconArrowUp size={13} />
                        <span>Reabastecer</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onEditProduct(p)}
                        className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                        title="Modificar precio, costo o umbral de alerta de este producto"
                      >
                        <IconEdit size={12} />
                        <span className="hidden xs:inline">Editar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-white border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <IconCheck size={20} />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">
                    Nivel de inventario óptimo
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    No se encontraron productos por debajo del umbral actual ({thresholdMode === "product" ? "configuración por producto" : `≤ ${customThreshold} u`}).
                  </p>
                </div>
              </div>

              {thresholdMode === "product" && (
                <button
                  type="button"
                  onClick={() => {
                    setThresholdMode("custom");
                    setCustomThreshold(10);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition cursor-pointer"
                >
                  Inspeccionar con umbral de 10 u
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
