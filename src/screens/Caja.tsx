import { useState, useMemo, useEffect, type SyntheticEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useStore, useTicket, actions } from "../store";
import { TopBar } from "../components/Layout";
import {
  IconSearch,
  IconPlus,
  IconMinus,
  IconTrash,
  IconCheck,
  IconCart,
  IconReceipt,
  IconCoins,
  IconLayers,
  IconTag,
  IconGrid,
  IconList,
  IconShelves,
  IconWifi,
  IconWifiOff,
  IconRotate,
  IconAlert,
  IconBolt,
} from "../components/Icons";
import { formatCurrency } from "../utils/currency";
import { ReceiptModal } from "../components/ReceiptModal";
import { CategorySlider } from "../components/CategorySlider";
import { useTheme } from "../themeContext";
import type { Sale, CurrencyCode, PaymentMethod, PaymentStatus, GatewayPayload } from "../types";
import {
  TransfermovilGateway,
  EnzonaGateway,
  openGatewayDeepLink,
  fetchPaymentStatusFromBackend,
} from "../services/paymentGateways";
import { syncSalesWithBackend, pollPendingGatewaySales } from "../services/syncService";

const QUICK_CASH_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

const CART_SESSION_KEY = "cajamaster_cart_session_v1";

interface CartSessionState {
  paymentMethod?: PaymentMethod;
  cashPaid?: number | "";
  isCheckoutOpen?: boolean;
  showDiscountInput?: boolean;
  selectedCategory?: string;
  viewMode?: "shelves" | "grid" | "list";
  search?: string;
}

function loadCartSession(): CartSessionState {
  try {
    const raw = localStorage.getItem(CART_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Error loading cart session:", e);
  }
  return {};
}

export function CajaScreen({
  onNewProduct,
}: {
  onNewProduct?: () => void;
} = {}) {
  const state = useStore();
  const { layoutMode } = useTheme();
  const ticket = useTicket();

  // Load persisted session on initial render
  const initialSession = useMemo(() => loadCartSession(), []);

  const [search, setSearch] = useState(initialSession.search || "");
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialSession.selectedCategory || "Todos"
  );
  
  // Mobile Checkout & Order Sheet
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(
    !!initialSession.isCheckoutOpen && (ticket.items.length > 0)
  );
  
  // Modals
  const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initialSession.paymentMethod || "cash"
  );
  const [cashPaid, setCashPaid] = useState<number | "">(
    initialSession.cashPaid !== undefined ? initialSession.cashPaid : ""
  );
  const [showDiscountInput, setShowDiscountInput] = useState(
    !!initialSession.showDiscountInput
  );
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Background Auto-Sync and Gateway Status Polling
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const runSync = async () => {
      const isOnline =
        state.connectivityMode === "online" &&
        (typeof navigator === "undefined" || navigator.onLine);
      if (!isOnline) return;

      try {
        setIsSyncing(true);
        // 1. Sync pending local sales to backend server
        await syncSalesWithBackend(state.sales);

        // 2. Poll status for any pending online gateway payments
        await pollPendingGatewaySales(state.sales);
      } catch (err) {
        console.warn("Background sync error:", err);
      } finally {
        setIsSyncing(false);
      }
    };

    // Run on mount or when sales change
    runSync();
    timer = setInterval(runSync, 15000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [state.sales, state.connectivityMode]);

  // View mode for mobile (shelves / carousels vs grid vs list)
  const [viewMode, setViewMode] = useState<"shelves" | "grid" | "list">(
    initialSession.viewMode || "shelves"
  );

  // Automatically save current shopping cart view & checkout session to local storage
  useEffect(() => {
    try {
      const session: CartSessionState = {
        paymentMethod,
        cashPaid,
        isCheckoutOpen: isCheckoutOpen && ticket.items.length > 0,
        showDiscountInput,
        selectedCategory,
        viewMode,
        search,
      };
      localStorage.setItem(CART_SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      console.error("Error saving cart session:", e);
    }
  }, [
    paymentMethod,
    cashPaid,
    isCheckoutOpen,
    showDiscountInput,
    selectedCategory,
    viewMode,
    search,
    ticket.items.length,
  ]);
  
  // Recent Sales modal
  const [showRecentSales, setShowRecentSales] = useState(false);
  const [recentSalesSearch, setRecentSalesSearch] = useState("");

  // Categories list derived from state.categories and products
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

  // Count of active products per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { Todos: 0 };
    state.products.forEach((p) => {
      if (!p.active) return;
      counts.Todos = (counts.Todos || 0) + 1;
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });
    return counts;
  }, [state.products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return state.products
      .filter((p) => p.active)
      .filter(
        (p) =>
          selectedCategory === "Todos" ||
          p.category.toLowerCase() === selectedCategory.toLowerCase()
      )
      .filter((p) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.includes(q))
        );
      });
  }, [state.products, selectedCategory, search]);

  const totalCUP = ticket.total;
  const numPaid = typeof cashPaid === "number" ? cashPaid : (cashPaid === "" ? totalCUP : 0);
  const changeDue = Math.max(0, (typeof cashPaid === "number" ? cashPaid : totalCUP) - totalCUP);

  const handleFinishSale = (
    customMethod?: PaymentMethod,
    customCash?: number,
    customStatus?: PaymentStatus,
    gatewayRef?: string,
    gatewayPayload?: GatewayPayload,
    event?: SyntheticEvent
  ) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (ticket.items.length === 0) return;

    try {
      const method = customMethod || paymentMethod;
      const finalCash =
        method === "cash"
          ? (customCash !== undefined
              ? customCash
              : (typeof cashPaid === "number" && cashPaid > 0 ? cashPaid : ticket.total))
          : undefined;

      const finalChange =
        method === "cash" && finalCash && finalCash > totalCUP
          ? Math.max(0, finalCash - totalCUP)
          : 0;

      // Determine initial payment status
      const resolvedStatus: PaymentStatus =
        customStatus ||
        (method === "cash" ? "COMPLETADO" : "PENDIENTE");

      const sale = actions.registerSale({
        items: ticket.items,
        subtotal: ticket.subtotal,
        discount: ticket.discount,
        total: ticket.total,
        paymentMethod: method,
        paymentStatus: resolvedStatus,
        estado_pago: resolvedStatus,
        gatewayReference: gatewayRef,
        gatewayPayload: gatewayPayload,
        cashPaid: finalCash,
        change: finalChange,
        currency: state.selectedCurrency,
        notes: ticket.notes || undefined,
      });

      // Pure local state updates without any page reloads or redirects
      setIsCheckoutOpen(false);
      setCashPaid("");
      setLastCompletedSale(sale);

      try {
        const session: CartSessionState = {
          paymentMethod: "cash",
          cashPaid: "",
          isCheckoutOpen: false,
          showDiscountInput: false,
          selectedCategory,
          viewMode,
          search: "",
        };
        localStorage.setItem(CART_SESSION_KEY, JSON.stringify(session));
      } catch (e) {
        console.error("Error updating cart session on sale finish:", e);
      }
    } catch (err) {
      console.error("Error finalizing sale:", err);
    }
  };

  const handleCreateAccount = (customName?: string) => {
    const nameToUse = customName || newAccountName.trim();
    ticket.createAccount(nameToUse || undefined);
    setNewAccountName("");
    setIsNewAccountModalOpen(false);
  };

  const handleRenameAccount = () => {
    if (renameValue.trim()) {
      ticket.renameAccount(ticket.activeAccountId, renameValue.trim());
      setIsRenameModalOpen(false);
      setRenameValue("");
    }
  };

  const [isWideScreen, setIsWideScreen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 880;
    }
    return false;
  });

  useEffect(() => {
    const checkWidth = () => {
      setIsWideScreen(window.innerWidth >= 880);
    };
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  const isTablet = layoutMode === "tablet" && isWideScreen;
  const accounts = ticket.accounts || [];
  const totalItemCount = ticket.items.reduce((a, b) => a + b.qty, 0);

  return (
    <div id="caja-screen-container" className="flex-1 flex flex-col min-h-0 relative bg-transparent overflow-hidden">
      {/* TopBar with Quick Currency and Recent Sales Button */}
      <TopBar
        title="Punto de Venta"
        subtitle={`${filteredProducts.length} productos`}
        right={
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Currency Switcher */}
            {isTablet ? (
              <div className="flex items-center bg-black/5 rounded-2xl p-1">
                {(["CUP", "USD", "EUR"] as CurrencyCode[]).map((cur) => (
                  <button
                    key={cur}
                    id={`btn-currency-${cur}`}
                    onClick={() => actions.setSelectedCurrency(cur)}
                    className={`px-2 py-1 rounded-xl text-[11px] font-extrabold transition cursor-pointer ${
                      state.selectedCurrency === cur
                        ? "bg-[var(--color-ink)] text-white shadow-xs"
                        : "text-[var(--color-ink)] opacity-60 hover:opacity-100"
                    }`}
                  >
                    {cur}
                  </button>
                ))}
              </div>
            ) : (
              <button
                id="btn-currency-mobile-toggle"
                onClick={() => {
                  const list: CurrencyCode[] = ["CUP", "USD", "EUR", "MLC"];
                  const next = list[(list.indexOf(state.selectedCurrency) + 1) % list.length];
                  actions.setSelectedCurrency(next);
                }}
                className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl neu-sm text-[11px] sm:text-xs font-black text-[var(--color-ink)] flex items-center gap-1 cursor-pointer active:scale-95 transition"
                title="Toca para alternar divisa"
              >
                <span>{state.selectedCurrency}</span>
                <span className="text-[9px] opacity-60">⇄</span>
              </button>
            )}

            {/* Mobile Ticket / Cart button */}
            {!isTablet && (
              <button
                id="btn-topbar-ticket"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCashPaid(ticket.total);
                  setIsCheckoutOpen(true);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCashPaid(ticket.total);
                  setIsCheckoutOpen(true);
                }}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl neu-sm text-[var(--color-ink)] flex items-center justify-center transition cursor-pointer hover:scale-105 active:scale-95 relative select-none"
                title="Ver pedido y cobrar"
                aria-label="Ver pedido y cobrar"
              >
                <IconCart size={14} />
                {totalItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 text-slate-950 text-[8px] font-black flex items-center justify-center shadow-xs">
                    {totalItemCount}
                  </span>
                )}
              </button>
            )}

            {/* Recent Sales / Tickets Button */}
            <button
              id="btn-recent-sales"
              onClick={() => setShowRecentSales(true)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl neu-sm text-[var(--color-ink)] flex items-center justify-center transition cursor-pointer hover:scale-105 active:scale-95 relative"
              title="Historial de Tickets y Comprobantes"
              aria-label="Historial de Tickets"
            >
              <IconReceipt size={14} />
              {state.sales.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 text-slate-950 text-[8px] font-black flex items-center justify-center shadow-xs">
                  {state.sales.length > 99 ? "99+" : state.sales.length}
                </span>
              )}
            </button>
          </div>
        }
      />

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Catalog & Categories Area */}
        <div className="flex-1 flex flex-col min-h-0 px-1.5 sm:px-3 pt-1 pb-0 overflow-hidden">
          {/* Header Controls: Search + Accounts Tab Selector + View Mode */}
          <div className="space-y-1.5 shrink-0 pb-1.5">
            {/* Search + View Toggle + Accounts Bar */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              {/* Search input */}
              <div className="flex-1 neu-inset rounded-2xl px-2.5 sm:px-3 h-9 sm:h-10 flex items-center gap-2 bg-white/70">
                <IconSearch size={14} className="text-[var(--color-ink)] opacity-50 shrink-0" />
                <input
                  id="input-search-caja"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar producto o código..."
                  className="w-full bg-transparent outline-none text-xs font-bold text-[var(--color-ink)] placeholder:text-[var(--color-ink)] placeholder:opacity-40"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="text-xs text-[var(--color-ink)] opacity-50 hover:opacity-100 font-bold px-1 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* View Mode Segmented Controls */}
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-2xl shrink-0 gap-0.5">
                <button
                  id="btn-view-shelves"
                  onClick={() => setViewMode("shelves")}
                  className={`h-8 sm:h-9 px-2 rounded-xl transition cursor-pointer flex items-center justify-center ${
                    viewMode === "shelves"
                      ? "bg-white text-slate-950 shadow-xs font-black"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Estantes horizontales por categoría"
                  aria-label="Vista de estantes horizontales"
                >
                  <IconShelves size={14} />
                </button>
                <button
                  id="btn-view-grid"
                  onClick={() => setViewMode("grid")}
                  className={`h-8 sm:h-9 px-2 rounded-xl transition cursor-pointer flex items-center justify-center ${
                    viewMode === "grid"
                      ? "bg-white text-slate-950 shadow-xs font-black"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Cuadrícula compacta"
                  aria-label="Vista en cuadrícula"
                >
                  <IconGrid size={14} />
                </button>
                <button
                  id="btn-view-list"
                  onClick={() => setViewMode("list")}
                  className={`h-8 sm:h-9 px-2 rounded-xl transition cursor-pointer flex items-center justify-center ${
                    viewMode === "list"
                      ? "bg-white text-slate-950 shadow-xs font-black"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Lista compacta de caja"
                  aria-label="Vista en lista"
                >
                  <IconList size={14} />
                </button>
              </div>

              {/* Accounts / Mesas Dropdown or Add Button */}
              {accounts.length > 1 ? (
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 max-w-[130px] sm:max-w-none">
                  {accounts.map((acc) => {
                    const isActive = acc.id === ticket.activeAccountId;
                    const count = acc.items.reduce((a, b) => a + b.qty, 0);
                    return (
                      <button
                        key={acc.id}
                        id={`btn-account-${acc.id}`}
                        onClick={() => ticket.switchAccount(acc.id)}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer shrink-0 flex items-center gap-1 ${
                          isActive
                            ? "bg-slate-900 text-white shadow-xs"
                            : "neu-sm text-slate-700 opacity-75 hover:opacity-100"
                        }`}
                      >
                        <span className="truncate max-w-[60px]">{acc.name}</span>
                        {count > 0 && (
                          <span
                            className={`w-4 h-4 rounded-full text-[9px] font-extrabold flex items-center justify-center ${
                              isActive ? "bg-amber-400 text-slate-950" : "bg-slate-200 text-slate-800"
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setIsNewAccountModalOpen(true)}
                    className="p-2 rounded-xl neu-sm text-slate-700 hover:text-slate-950 transition cursor-pointer shrink-0"
                    title="Crear nueva cuenta o mesa"
                  >
                    <IconPlus size={13} />
                  </button>
                </div>
              ) : (
                <button
                  id="btn-add-account"
                  onClick={() => setIsNewAccountModalOpen(true)}
                  className="px-2 sm:px-2.5 h-9 sm:h-10 rounded-2xl neu-sm text-[var(--color-ink)] text-xs font-black flex items-center gap-1 shrink-0 hover:scale-105 active:scale-95 transition cursor-pointer"
                  title="Abrir otra cuenta / mesa"
                >
                  <IconLayers size={14} />
                  <span className="hidden sm:inline">Mesas</span>
                  <IconPlus size={12} />
                </button>
              )}
            </div>

            {/* Swipeable & Wrap-capable Category Slider Bar with reduced padding */}
            <CategorySlider
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              categoryCounts={categoryCounts}
              activeColorClass="bg-slate-900 text-white shadow-xs ring-1 ring-slate-900"
              inactiveColorClass="neu-sm text-slate-700 opacity-80 hover:opacity-100 bg-white/80"
              compact={!isTablet}
              allowWrapToggle={true}
            />
          </div>

          {/* Product Items: Horizontal Shelves, Responsive Grid or Fast List Mode */}
          <div className="flex-1 overflow-y-auto pr-0.5 pb-2 pt-0.5 min-h-0">
            {viewMode === "shelves" ? (
              /* HORIZONTAL SCROLLING SHELVES BY CATEGORY */
              <div className="space-y-3 pb-2">
                {selectedCategory === "Todos" && !search.trim() ? (
                  /* Render each category row with horizontal scrolling container */
                  categories
                    .filter((c) => c !== "Todos")
                    .map((catName) => {
                      const catProds = filteredProducts.filter(
                        (p) => p.category.toLowerCase() === catName.toLowerCase()
                      );
                      if (catProds.length === 0) return null;

                      return (
                        <div key={catName} className="space-y-1.5">
                          <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-xs text-slate-900">
                                {catName}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                                {catProds.length}
                              </span>
                            </div>
                            <button
                              onClick={() => setSelectedCategory(catName)}
                              className="text-[10.5px] font-bold text-amber-700 hover:text-amber-900 transition cursor-pointer active:scale-95"
                            >
                              Ver todos &gt;
                            </button>
                          </div>

                          {/* Horizontal Scrolling Container (overflow-x-auto flex-nowrap) */}
                          <div className="flex flex-nowrap items-stretch overflow-x-auto gap-2 pb-1 px-0.5 no-scrollbar touch-pan-x overscroll-x-contain">
                            {catProds.map((p) => {
                              const isOutOfStock = p.stock <= 0;
                              const isLow = p.stock <= p.lowStockAlert && !isOutOfStock;
                              const inTicketItem = ticket.items.find((i) => i.productId === p.id);

                              return (
                                <motion.button
                                  key={p.id}
                                  id={`btn-product-shelf-${p.id}`}
                                  onClick={() => {
                                    if (!isOutOfStock) {
                                      ticket.add(p, 1);
                                    }
                                  }}
                                  disabled={isOutOfStock}
                                  whileTap={!isOutOfStock ? { scale: 0.96 } : undefined}
                                  className={`w-[130px] xs:w-[142px] sm:w-[155px] shrink-0 p-1.5 sm:p-2 rounded-2xl bg-white border text-left flex flex-col justify-between relative cursor-pointer shadow-2xs transition select-none ${
                                    isOutOfStock
                                      ? "opacity-40 grayscale cursor-not-allowed border-slate-200"
                                      : inTicketItem
                                      ? "border-amber-400 ring-2 ring-amber-300/60 bg-amber-50/20"
                                      : "border-slate-200/90 hover:border-slate-300"
                                  }`}
                                >
                                  {/* Top Thumbnail Container */}
                                  <div
                                    className="w-full aspect-[4/3] rounded-xl overflow-hidden mb-1 relative flex items-center justify-center bg-slate-100 shadow-inner"
                                    style={{
                                      background: p.image
                                        ? "#0F172A"
                                        : `linear-gradient(135deg, ${p.color}25, ${p.color}50)`,
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
                                      <span className="text-2xl select-none">{p.emoji}</span>
                                    )}

                                    {/* Stock badge */}
                                    <span
                                      className={`absolute bottom-1 left-1 px-1.5 py-0.2 rounded-md text-[8px] sm:text-[8.5px] font-black shadow-xs ${
                                        isOutOfStock
                                          ? "bg-rose-600 text-white"
                                          : isLow
                                          ? "bg-amber-500 text-white"
                                          : "bg-black/65 text-white backdrop-blur-xs"
                                      }`}
                                    >
                                      {isOutOfStock ? "Agotado" : `${p.stock} ${p.unit}`}
                                    </span>

                                    {/* In-ticket counter badge */}
                                    <AnimatePresence>
                                      {inTicketItem && (
                                        <motion.span
                                          key={`badge-${inTicketItem.qty}`}
                                          initial={{ scale: 0, opacity: 0 }}
                                          animate={{ scale: [1.3, 0.9, 1], opacity: 1 }}
                                          exit={{ scale: 0, opacity: 0 }}
                                          transition={{ duration: 0.18, type: "spring", stiffness: 500, damping: 20 }}
                                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-md"
                                        >
                                          {inTicketItem.qty}
                                        </motion.span>
                                      )}
                                    </AnimatePresence>
                                  </div>

                                  {/* Product Name */}
                                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                                    <div className="min-w-0">
                                      <h4 className="font-extrabold text-[11px] sm:text-xs text-slate-900 line-clamp-2 leading-tight break-words">
                                        {p.name}
                                      </h4>
                                    </div>

                                    {/* Price Row */}
                                    <div className="mt-1 pt-1 border-t border-slate-100 flex items-baseline justify-between gap-1">
                                      <span className="font-black text-xs sm:text-sm text-slate-950">
                                        {formatCurrency(p.price, "CUP", state.rates)}
                                      </span>
                                      {state.selectedCurrency !== "CUP" && (
                                        <span className="text-[8px] sm:text-[9px] font-bold text-amber-700 truncate">
                                          {formatCurrency(p.price, state.selectedCurrency, state.rates)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                ) : (
                  /* Single category or search: Horizontal shelf + wrap */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-black text-slate-800">
                        {selectedCategory === "Todos" ? "Búsqueda" : selectedCategory} ({filteredProducts.length})
                      </span>
                      {selectedCategory !== "Todos" && (
                        <button
                          onClick={() => setSelectedCategory("Todos")}
                          className="text-[10.5px] font-bold text-amber-700 hover:text-amber-900 cursor-pointer"
                        >
                          ← Ver todas las categorías
                        </button>
                      )}
                    </div>

                    {/* Horizontal scroll shelf */}
                    <div className="flex flex-nowrap items-stretch overflow-x-auto gap-2 pb-2 px-0.5 no-scrollbar touch-pan-x overscroll-x-contain">
                      {filteredProducts.map((p) => {
                        const isOutOfStock = p.stock <= 0;
                        const isLow = p.stock <= p.lowStockAlert && !isOutOfStock;
                        const inTicketItem = ticket.items.find((i) => i.productId === p.id);

                        return (
                          <motion.button
                            key={p.id}
                            id={`btn-product-shelf-${p.id}`}
                            onClick={() => {
                              if (!isOutOfStock) {
                                ticket.add(p, 1);
                              }
                            }}
                            disabled={isOutOfStock}
                            whileTap={!isOutOfStock ? { scale: 0.96 } : undefined}
                            className={`w-[130px] xs:w-[142px] sm:w-[155px] shrink-0 p-1.5 sm:p-2 rounded-2xl bg-white border text-left flex flex-col justify-between relative cursor-pointer shadow-2xs transition select-none ${
                              isOutOfStock
                                ? "opacity-40 grayscale cursor-not-allowed border-slate-200"
                                : inTicketItem
                                ? "border-amber-400 ring-2 ring-amber-300/60 bg-amber-50/20"
                                : "border-slate-200/90 hover:border-slate-300"
                            }`}
                          >
                            {/* Top Thumbnail Container */}
                            <div
                              className="w-full aspect-[4/3] rounded-xl overflow-hidden mb-1 relative flex items-center justify-center bg-slate-100 shadow-inner"
                              style={{
                                background: p.image
                                  ? "#0F172A"
                                  : `linear-gradient(135deg, ${p.color}25, ${p.color}50)`,
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
                                <span className="text-2xl select-none">{p.emoji}</span>
                              )}

                              {/* Stock badge */}
                              <span
                                className={`absolute bottom-1 left-1 px-1.5 py-0.2 rounded-md text-[8px] sm:text-[8.5px] font-black shadow-xs ${
                                  isOutOfStock
                                    ? "bg-rose-600 text-white"
                                    : isLow
                                    ? "bg-amber-500 text-white"
                                    : "bg-black/65 text-white backdrop-blur-xs"
                                }`}
                              >
                                {isOutOfStock ? "Agotado" : `${p.stock} ${p.unit}`}
                              </span>

                              {/* In-ticket counter badge */}
                              <AnimatePresence>
                                {inTicketItem && (
                                  <motion.span
                                    key={`badge-${inTicketItem.qty}`}
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: [1.3, 0.9, 1], opacity: 1 }}
                                    exit={{ scale: 0, opacity: 0 }}
                                    transition={{ duration: 0.18, type: "spring", stiffness: 500, damping: 20 }}
                                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-md"
                                  >
                                    {inTicketItem.qty}
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Product Name */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div className="min-w-0">
                                <h4 className="font-extrabold text-[11px] sm:text-xs text-slate-900 line-clamp-2 leading-tight break-words">
                                  {p.name}
                                </h4>
                              </div>

                              {/* Price Row */}
                              <div className="mt-1 pt-1 border-t border-slate-100 flex items-baseline justify-between gap-1">
                                <span className="font-black text-xs sm:text-sm text-slate-950">
                                  {formatCurrency(p.price, "CUP", state.rates)}
                                </span>
                                {state.selectedCurrency !== "CUP" && (
                                  <span className="text-[8px] sm:text-[9px] font-bold text-amber-700 truncate">
                                    {formatCurrency(p.price, state.selectedCurrency, state.rates)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : viewMode === "grid" ? (
              <div
                className={`grid ${
                  isTablet
                    ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3"
                    : "grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 sm:gap-2"
                }`}
              >
                {filteredProducts.map((p) => {
                  const isOutOfStock = p.stock <= 0;
                  const isLow = p.stock <= p.lowStockAlert && !isOutOfStock;
                  const inTicketItem = ticket.items.find((i) => i.productId === p.id);

                  return (
                    <motion.button
                      key={p.id}
                      id={`btn-product-card-${p.id}`}
                      onClick={() => {
                        if (!isOutOfStock) {
                          ticket.add(p, 1);
                        }
                      }}
                      disabled={isOutOfStock}
                      whileTap={!isOutOfStock ? { scale: 0.96 } : undefined}
                      className={`p-1.5 sm:p-2.5 rounded-2xl bg-white border text-left flex flex-col justify-between relative cursor-pointer shadow-2xs transition duration-150 active:scale-[0.97] min-w-0 ${
                        isOutOfStock
                          ? "opacity-40 grayscale cursor-not-allowed border-slate-200"
                          : inTicketItem
                          ? "border-amber-400 ring-2 ring-amber-300/60 bg-amber-50/20"
                          : "border-slate-200/90 hover:border-slate-300"
                      }`}
                    >
                      {/* Top Thumbnail Container */}
                      <div
                        className="w-full aspect-[4/3] rounded-xl overflow-hidden mb-1 relative flex items-center justify-center bg-slate-100 shadow-inner"
                        style={{
                          background: p.image
                            ? "#0F172A"
                            : `linear-gradient(135deg, ${p.color}25, ${p.color}50)`,
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
                          <span className="text-2xl sm:text-3xl select-none">{p.emoji}</span>
                        )}

                        {/* Stock badge */}
                        <span
                          className={`absolute bottom-1 left-1 px-1.5 py-0.2 rounded-md text-[8px] sm:text-[9px] font-black shadow-xs ${
                            isOutOfStock
                              ? "bg-rose-600 text-white"
                              : isLow
                              ? "bg-amber-500 text-white"
                              : "bg-black/65 text-white backdrop-blur-xs"
                          }`}
                        >
                          {isOutOfStock ? "Agotado" : `${p.stock} ${p.unit}`}
                        </span>

                        {/* In-ticket counter badge */}
                        <AnimatePresence>
                          {inTicketItem && (
                            <motion.span
                              key={`badge-${inTicketItem.qty}`}
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: [1.3, 0.9, 1], opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ duration: 0.18, type: "spring", stiffness: 500, damping: 20 }}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] sm:text-[11px] flex items-center justify-center shadow-md"
                            >
                              {inTicketItem.qty}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Product Name & Category */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-[11px] sm:text-xs text-slate-900 line-clamp-2 leading-tight break-words">
                            {p.name}
                          </h4>
                          <span className="text-[9.5px] text-slate-400 font-medium truncate block mt-0.5">
                            {p.category}
                          </span>
                        </div>

                        {/* Price Row */}
                        <div className="mt-1 pt-1 border-t border-slate-100 flex items-baseline justify-between gap-1">
                          <span className="font-black text-xs sm:text-sm text-slate-950">
                            {formatCurrency(p.price, "CUP", state.rates)}
                          </span>
                          {state.selectedCurrency !== "CUP" && (
                            <span className="text-[8px] sm:text-[9px] font-bold text-amber-700 truncate">
                              {formatCurrency(p.price, state.selectedCurrency, state.rates)}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              /* LIST VIEW MODE (High density cashier row mode) */
              <div className="flex flex-col gap-1.5 pb-2">
                {filteredProducts.map((p) => {
                  const isOutOfStock = p.stock <= 0;
                  const isLow = p.stock <= p.lowStockAlert && !isOutOfStock;
                  const inTicketItem = ticket.items.find((i) => i.productId === p.id);

                  return (
                    <motion.div
                      key={p.id}
                      id={`btn-product-row-${p.id}`}
                      onClick={() => {
                        if (!isOutOfStock) {
                          ticket.add(p, 1);
                        }
                      }}
                      whileTap={!isOutOfStock ? { scale: 0.98 } : undefined}
                      className={`p-1.5 sm:p-2 rounded-2xl bg-white border flex items-center justify-between gap-2 transition cursor-pointer shadow-2xs ${
                        isOutOfStock
                          ? "opacity-45 grayscale cursor-not-allowed border-slate-200"
                          : inTicketItem
                          ? "border-amber-400 ring-1 ring-amber-300 bg-amber-50/20"
                          : "border-slate-200/90 hover:border-slate-300"
                      }`}
                    >
                      {/* Left Thumbnail + Info */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex items-center justify-center bg-slate-100 shrink-0 shadow-inner"
                          style={{
                            background: p.image
                              ? "#0F172A"
                              : `linear-gradient(135deg, ${p.color}25, ${p.color}50)`,
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
                            <span className="text-base sm:text-lg select-none">{p.emoji}</span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="font-extrabold text-[11px] sm:text-xs text-slate-900 truncate leading-tight">
                            {p.name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9.5px] text-slate-400 truncate">
                              {p.category}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[8px] sm:text-[8.5px] font-black ${
                                isOutOfStock
                                  ? "bg-rose-600 text-white"
                                  : isLow
                                  ? "bg-amber-500 text-white"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {isOutOfStock ? "Agotado" : `${p.stock} ${p.unit}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Price + Action Controls */}
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <div className="text-right">
                          <div className="font-black text-xs sm:text-sm text-slate-950 leading-tight">
                            {formatCurrency(p.price, "CUP", state.rates)}
                          </div>
                          {state.selectedCurrency !== "CUP" && (
                            <div className="text-[8.5px] font-bold text-amber-700">
                              {formatCurrency(p.price, state.selectedCurrency, state.rates)}
                            </div>
                          )}
                        </div>

                        {inTicketItem ? (
                          <div
                            className="flex items-center bg-amber-100/90 rounded-xl p-0.5 border border-amber-300"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => ticket.dec(p.id)}
                              className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-lg bg-white text-slate-900 flex items-center justify-center font-bold text-xs shadow-2xs hover:bg-slate-50 active:scale-90 cursor-pointer"
                            >
                              <IconMinus size={10} />
                            </button>
                            <span className="w-5 sm:w-6 text-center font-black text-xs text-slate-950">
                              {inTicketItem.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => ticket.add(p, 1)}
                              disabled={isOutOfStock || inTicketItem.qty >= p.stock}
                              className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-xs shadow-2xs hover:bg-amber-500 active:scale-90 cursor-pointer disabled:opacity-40"
                            >
                              <IconPlus size={10} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            className="w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs active:scale-90 transition cursor-pointer disabled:opacity-40"
                          >
                            <IconPlus size={12} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {state.products.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 my-6 text-center bg-white rounded-3xl border border-slate-200 shadow-xs">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-3xl mb-3 shadow-xs">
                  📦
                </div>
                <h3 className="font-extrabold text-sm text-slate-900 mb-1">
                  Catálogo Inicial en Blanco
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">
                  Aún no tienes productos registrados. Añade tu primer producto con precio, stock e imagen para comenzar a facturar.
                </p>
                {onNewProduct && (
                  <button
                    onClick={onNewProduct}
                    className="py-3 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer active:scale-95"
                  >
                    <IconPlus size={16} className="text-amber-400" />
                    <span>+ AÑADIR PRIMER PRODUCTO</span>
                  </button>
                )}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                No se encontraron productos coincidentes con "{search || selectedCategory}".
              </div>
            ) : null}
          </div>
        </div>

        {/* Right Panel: Persistent Ticket & Checkout in Tablet Mode */}
        {isTablet && (
          <div className="w-[380px] lg:w-[420px] border-l border-black/10 bg-white flex flex-col min-h-0 shrink-0 z-10 shadow-lg">
            <UnifiedTicketAndCheckout
              ticket={ticket}
              state={state}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              cashPaid={cashPaid}
              setCashPaid={setCashPaid}
              showDiscountInput={showDiscountInput}
              setShowDiscountInput={setShowDiscountInput}
              onRenameAccount={() => {
                setRenameValue(ticket.account.name);
                setIsRenameModalOpen(true);
              }}
              onFinishSale={handleFinishSale}
            />
          </div>
        )}
      </div>

      {/* FLOATING ACTION BUTTON (FAB) FOR TICKET / CHECKOUT ON MOBILE */}
      {!isTablet && (
        <div className="absolute bottom-4 right-3.5 z-30 pointer-events-auto">
          <motion.button
            id="btn-mobile-floating-ticket"
            type="button"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCashPaid(ticket.total);
              setIsCheckoutOpen(true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCashPaid(ticket.total);
              setIsCheckoutOpen(true);
            }}
            className={`px-3.5 py-2.5 rounded-full flex items-center gap-2.5 transition cursor-pointer shadow-2xl border select-none ${
              totalItemCount > 0
                ? "bg-slate-950 text-white border-amber-400/60 shadow-slate-950/50 ring-2 ring-amber-400/40"
                : "bg-white/95 text-slate-800 border-slate-200/90 shadow-lg hover:bg-slate-50"
            }`}
            title={totalItemCount > 0 ? "Ver pedido y cobrar" : "Ver cuenta / ticket"}
            aria-label="Abrir pedido y cobro"
          >
            {/* Counter Badge */}
            <div
              className={`w-6 h-6 rounded-full font-black text-xs flex items-center justify-center shrink-0 ${
                totalItemCount > 0
                  ? "bg-amber-400 text-slate-950 shadow-xs"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {totalItemCount}
            </div>

            {/* Total / Label */}
            <div className="flex flex-col text-left leading-none pr-1">
              {totalItemCount > 0 ? (
                <>
                  <span className="font-black text-xs text-amber-300">
                    {formatCurrency(ticket.total, "CUP", state.rates)}
                  </span>
                  <span className="text-[9px] font-extrabold text-slate-300 uppercase tracking-wider mt-0.5">
                    Cobrar ↗
                  </span>
                </>
              ) : (
                <span className="font-extrabold text-xs text-slate-700">
                  Ticket (0)
                </span>
              )}
            </div>
          </motion.button>
        </div>
      )}

      {/* MOBILE UNIFIED FULL-SCREEN COBRO & TICKET SHEET */}
      <AnimatePresence>
        {!isTablet && isCheckoutOpen && (
          <motion.div
            key="mobile-checkout-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setIsCheckoutOpen(false)}
          >
            <motion.div
              key="mobile-checkout-card"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="w-full max-w-md h-[92%] sm:h-[88%] max-h-[95%] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden relative border-t sm:border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle & Top Bar */}
              <div className="w-full pt-2.5 pb-1 bg-slate-900 flex flex-col items-center shrink-0">
                <div className="w-12 h-1.5 rounded-full bg-white/30 mb-1.5" />
              </div>

              {/* Unified Ticket + Payment Form */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
                <UnifiedTicketAndCheckout
                  ticket={ticket}
                  state={state}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  cashPaid={cashPaid}
                  setCashPaid={setCashPaid}
                  showDiscountInput={showDiscountInput}
                  setShowDiscountInput={setShowDiscountInput}
                  onClose={() => setIsCheckoutOpen(false)}
                  onRenameAccount={() => {
                    setRenameValue(ticket.account.name);
                    setIsRenameModalOpen(true);
                  }}
                  onFinishSale={handleFinishSale}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completed Sale Receipt Modal */}
      <AnimatePresence>
        {lastCompletedSale && (
          <ReceiptModal
            key={`receipt-modal-${lastCompletedSale.id}`}
            sale={lastCompletedSale}
            onClose={() => setLastCompletedSale(null)}
          />
        )}
      </AnimatePresence>

      {/* Create Account Modal */}
      <AnimatePresence>
        {isNewAccountModalOpen && (
          <motion.div
            key="new-account-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsNewAccountModalOpen(false)}
          >
            <motion.div
              key="new-account-card"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                    <IconLayers size={18} />
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-900">Nueva Cuenta / Mesa</h3>
                </div>
                <button
                  onClick={() => setIsNewAccountModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Nombre de la Cuenta o Mesa
                </label>
                <input
                  id="input-new-account-name"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder={`Ej. Mesa ${accounts.length + 1}, Barra, Para llevar...`}
                  className="w-full neu-inset rounded-2xl px-3.5 h-11 text-xs font-bold outline-none text-slate-900 bg-slate-50"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateAccount();
                  }}
                />
              </div>

              {/* Quick suggestions */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Sugerencias rápidas:</span>
                <div className="flex flex-wrap gap-1.5">
                  {["Mesa 1", "Mesa 2", "Mesa 3", "Barra", "Terraza", "Para Llevar", "Cliente 1"].map(
                    (sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => handleCreateAccount(sug)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold transition cursor-pointer"
                      >
                        {sug}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsNewAccountModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  id="btn-confirm-create-account"
                  onClick={() => handleCreateAccount()}
                  className="flex-1 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-lg cursor-pointer transition"
                >
                  Crear y Abrir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename Account Modal */}
      <AnimatePresence>
        {isRenameModalOpen && (
          <motion.div
            key="rename-account-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsRenameModalOpen(false)}
          >
            <motion.div
              key="rename-account-card"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-extrabold text-sm text-slate-900">Renombrar Cuenta</h3>
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Nombre de la cuenta..."
                className="w-full neu-inset rounded-2xl px-3.5 h-11 text-xs font-bold outline-none text-slate-900 bg-slate-50"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameAccount();
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsRenameModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRenameAccount}
                  className="flex-1 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-lg cursor-pointer transition"
                >
                  Guardar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Sales Modal */}
      <AnimatePresence>
        {showRecentSales && (
          <motion.div
            key="recent-sales-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 md:p-6"
            onClick={() => setShowRecentSales(false)}
          >
            <motion.div
              key="recent-sales-card"
              initial={{ scale: 0.92, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 400 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-black/10 flex flex-col max-h-[88vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-xs">
                    <IconReceipt size={18} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm">Historial de Tickets y Ventas</h3>
                    <p className="text-[11px] text-white/60">
                      {state.sales.length} ventas registradas
                    </p>
                  </div>
                </div>
                <button
                  id="btn-close-recent-sales"
                  onClick={() => setShowRecentSales(false)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold cursor-pointer transition"
                >
                  ✕
                </button>
              </div>

              {/* Search filter for past sales */}
              <div className="p-3 bg-slate-50 border-b border-slate-200 shrink-0">
                <div className="neu-inset rounded-xl flex items-center gap-2 px-3 h-10 bg-white">
                  <IconSearch size={15} className="text-slate-400 shrink-0" />
                  <input
                    value={recentSalesSearch}
                    onChange={(e) => setRecentSalesSearch(e.target.value)}
                    placeholder="Buscar por ticket, producto o fecha..."
                    className="w-full bg-transparent outline-none text-xs font-bold text-slate-800"
                  />
                  {recentSalesSearch && (
                    <button
                      onClick={() => setRecentSalesSearch("")}
                      className="text-xs text-slate-400 hover:text-slate-700 font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Sales List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 text-slate-900">
                {state.sales
                  .slice()
                  .reverse()
                  .filter((s) => {
                    if (!recentSalesSearch.trim()) return true;
                    const q = recentSalesSearch.toLowerCase();
                    const ticketNum = String(s.ticketNumber || "");
                    const itemsStr = s.items.map((i) => i.name).join(" ").toLowerCase();
                    const dateStr = new Date(s.ts).toLocaleString("es-ES").toLowerCase();
                    return ticketNum.includes(q) || itemsStr.includes(q) || dateStr.includes(q);
                  })
                  .map((sale) => {
                    const status = sale.paymentStatus || sale.estado_pago || "COMPLETADO";
                    const isPending = status === "PENDIENTE";

                    return (
                      <div
                        key={sale.id}
                        className={`p-3 rounded-2xl border flex flex-col gap-2 transition ${
                          isPending
                            ? "bg-amber-50/60 border-amber-300"
                            : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-xs text-slate-900">
                                Ticket #{sale.ticketNumber || String(sale.id).slice(-4)}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 font-bold text-slate-700 uppercase">
                                {sale.paymentMethod === "cash"
                                  ? "EFECTIVO"
                                  : sale.paymentMethod === "transfermovil"
                                  ? "TRANSFERMÓVIL"
                                  : sale.paymentMethod === "enzona"
                                  ? "ENZONA"
                                  : sale.paymentMethod === "transfer"
                                  ? "TRANSFERMÓVIL"
                                  : "MIXTO"}
                              </span>
                              <span
                                className={`text-[9.5px] px-2 py-0.5 rounded-full font-black uppercase ${
                                  status === "COMPLETADO"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : status === "PENDIENTE"
                                    ? "bg-amber-200 text-amber-900 animate-pulse"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-1">
                              {sale.items.map((i) => `${i.qty}x ${i.name}`).join(", ")}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                              <span>
                                {new Date(sale.ts).toLocaleString("es-ES", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </span>
                              {sale.gatewayReference && (
                                <span className="font-mono text-[9px] text-slate-600 font-bold">
                                  Ref: {sale.gatewayReference}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                            <span className="font-black text-sm text-slate-900">
                              {formatCurrency(sale.total, "CUP", state.rates)}
                            </span>
                            <button
                              onClick={() => {
                                setLastCompletedSale(sale);
                                setShowRecentSales(false);
                              }}
                              className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] flex items-center gap-1 cursor-pointer transition shadow-xs"
                            >
                              <IconReceipt size={12} /> Ver Recibo
                            </button>
                          </div>
                        </div>

                        {/* Quick actions for Pending Online Gateway Sales */}
                        {isPending && (
                          <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-amber-900 font-bold flex items-center gap-1">
                              <span>⏳ Esperando acreditación</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={async () => {
                                  const result = await fetchPaymentStatusFromBackend(sale.id);
                                  if (result) {
                                    actions.updateSalePaymentStatus(
                                      sale.id,
                                      result.status,
                                      result.reference
                                    );
                                  }
                                }}
                                className="px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[10px] flex items-center gap-1 transition cursor-pointer"
                                title="Consultar pasarela"
                              >
                                <IconRotate size={11} /> Consultar
                              </button>
                              <button
                                onClick={() => {
                                  actions.updateSalePaymentStatus(sale.id, "COMPLETADO");
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] flex items-center gap-1 transition cursor-pointer shadow-xs"
                                title="Confirmar pago manualmente"
                              >
                                <IconCheck size={11} /> Marcar Pagado
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                {state.sales.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No hay ventas registradas aún.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * UNIFIED TICKET & CHECKOUT COMPONENT
 * Shows the full items breakdown + payment methods + 1-tap fast checkout
 * in a clean, scrollable, reliable view for both Phone & Tablet.
 */
function UnifiedTicketAndCheckout({
  ticket,
  state,
  paymentMethod,
  setPaymentMethod,
  cashPaid,
  setCashPaid,
  showDiscountInput,
  setShowDiscountInput,
  onClose,
  onRenameAccount,
  onFinishSale,
}: {
  ticket: ReturnType<typeof useTicket>;
  state: ReturnType<typeof useStore>;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (m: PaymentMethod) => void;
  cashPaid: number | "";
  setCashPaid: (val: number | "") => void;
  showDiscountInput: boolean;
  setShowDiscountInput: (val: boolean) => void;
  onClose?: () => void;
  onRenameAccount: () => void;
  onFinishSale: (
    customMethod?: PaymentMethod,
    customCash?: number,
    customStatus?: PaymentStatus,
    gatewayRef?: string,
    gatewayPayload?: GatewayPayload,
    event?: SyntheticEvent
  ) => void;
}) {
  const totalCUP = ticket.total;
  const numPaid = typeof cashPaid === "number" ? cashPaid : (cashPaid === "" ? totalCUP : 0);
  const changeDue = Math.max(0, (typeof cashPaid === "number" ? cashPaid : totalCUP) - totalCUP);
  const totalItemsCount = ticket.items.reduce((a, b) => a + b.qty, 0);

  // Online / Offline Connectivity Check
  const isOnline =
    state.connectivityMode === "online" &&
    (typeof navigator === "undefined" || navigator.onLine);

  // Gateway Pending vs Completed mode state
  const [gatewayStatusSelection, setGatewayStatusSelection] = useState<PaymentStatus>("PENDIENTE");
  const [copiedUSSD, setCopiedUSSD] = useState(false);

  // Pre-generate gateway payloads for current ticket
  const phoneTarget = state.business.phone || "+53 5000-0000";
  const conceptText = `Ticket #${state.ticketSequence}`;

  const transfermovilPayload = useMemo(() => {
    return TransfermovilGateway.generatePaymentPayload(totalCUP, phoneTarget, conceptText);
  }, [totalCUP, phoneTarget, conceptText]);

  const enzonaPayload = useMemo(() => {
    return EnzonaGateway.generatePaymentPayload(totalCUP, phoneTarget, conceptText);
  }, [totalCUP, phoneTarget, conceptText]);

  const handleLaunchGateway = (gateway: "transfermovil" | "enzona") => {
    if (gateway === "transfermovil") {
      openGatewayDeepLink(transfermovilPayload.deepLink);
    } else {
      openGatewayDeepLink(enzonaPayload.deepLink);
    }
  };

  const handleCopyUSSD = () => {
    if (transfermovilPayload.ussdCode) {
      navigator.clipboard?.writeText(transfermovilPayload.ussdCode);
      setCopiedUSSD(true);
      setTimeout(() => setCopiedUSSD(false), 2500);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white text-slate-900 overflow-hidden">
      {/* Header */}
      <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
            <IconCoins size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-extrabold text-sm truncate">{ticket.account.name}</h3>
              <button
                onClick={onRenameAccount}
                className="text-[10px] bg-white/20 hover:bg-white/30 text-white px-1.5 py-0.5 rounded cursor-pointer shrink-0"
                title="Editar nombre"
              >
                ✏️
              </button>
            </div>
            <span className="text-[10.5px] text-white/70 block">
              Ticket #{state.ticketSequence} • {totalItemsCount} artículos
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {ticket.items.length > 0 && (
            <button
              onClick={ticket.clear}
              className="text-[11px] text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
              title="Vaciar artículos"
            >
              Vaciar
            </button>
          )}

          {ticket.accounts.length > 1 && (
            <button
              onClick={() => ticket.deleteAccount(ticket.activeAccountId)}
              className="text-[11px] text-slate-400 hover:text-rose-300 font-bold cursor-pointer"
              title="Cerrar mesa"
            >
              Cerrar
            </button>
          )}

          {onClose && (
            <button
              id="btn-close-ticket-checkout"
              onClick={onClose}
              className="px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center gap-1 text-xs font-black cursor-pointer transition ml-1"
              title="Volver a los productos"
            >
              <span>✕</span>
              <span className="hidden sm:inline">Volver</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Scrollable Content: Items List + Payment Configuration */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 bg-slate-50/60 min-h-0">
        {/* Items Section */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
            <span>ARTÍCULOS EN ESTE PEDIDO ({ticket.items.length})</span>
            <span>SUBTOTAL</span>
          </div>

          {ticket.items.length > 0 ? (
            <div className="space-y-1.5">
              {ticket.items.map((item) => {
                const prod = state.products.find((p) => p.id === item.productId);
                const isMaxStockReached = prod ? item.qty >= prod.stock : false;
                const lineTotal = item.qty * item.price;

                return (
                  <div
                    key={item.productId}
                    className="p-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2 transition hover:border-slate-300"
                  >
                    {/* Item Thumbnail */}
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-xl select-none">{item.emoji || "📦"}</span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-xs text-slate-900 truncate leading-tight">
                        {item.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                        <span className="font-medium text-slate-500">
                          {formatCurrency(item.price, "CUP", state.rates)}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-extrabold text-amber-700">
                          {formatCurrency(lineTotal, "CUP", state.rates)}
                        </span>
                      </div>
                    </div>

                    {/* Qty Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => ticket.dec(item.productId)}
                        className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs active:scale-95 transition cursor-pointer"
                        title="Disminuir"
                      >
                        <IconMinus size={12} />
                      </button>

                      <span className="w-5 text-center font-extrabold text-xs text-slate-900 select-none">
                        {item.qty}
                      </span>

                      <button
                        disabled={isMaxStockReached}
                        onClick={() => {
                          if (prod && !isMaxStockReached) {
                            ticket.add(prod, 1);
                          }
                        }}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs active:scale-95 transition cursor-pointer ${
                          isMaxStockReached
                            ? "bg-slate-100 text-slate-300 opacity-50 cursor-not-allowed"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                        }`}
                        title={isMaxStockReached ? "Stock máximo alcanzado" : "Aumentar"}
                      >
                        <IconPlus size={12} />
                      </button>

                      <button
                        onClick={() => ticket.remove(item.productId)}
                        className="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center ml-0.5 active:scale-95 transition cursor-pointer"
                        title="Quitar"
                      >
                        <IconTrash size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-1.5">
              <div className="w-10 h-10 mx-auto rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                <IconCart size={20} />
              </div>
              <div className="font-extrabold text-xs text-slate-700">Cuenta sin productos</div>
              <p className="text-[11px] text-slate-400">
                Selecciona productos en el catálogo para agregarlos.
              </p>
            </div>
          )}
        </div>

        {/* Big Total Box */}
        <div className="p-3.5 rounded-2xl bg-slate-950 text-white text-center space-y-0.5 shadow-md">
          <div className="flex items-center justify-between text-[10px] tracking-widest text-slate-400 font-extrabold uppercase px-1">
            <span>TOTAL A COBRAR</span>
            {ticket.discount > 0 && (
              <span className="text-rose-400">Desc: -${ticket.discount} CUP</span>
            )}
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400">
            {formatCurrency(ticket.total, "CUP", state.rates)}
          </div>
          {state.selectedCurrency !== "CUP" && (
            <div className="text-xs text-slate-300 font-semibold">
              Equivalente: {formatCurrency(ticket.total, state.selectedCurrency, state.rates)}
            </div>
          )}
        </div>

        {/* Discount Row */}
        <div className="bg-white rounded-2xl p-2.5 border border-slate-200">
          {showDiscountInput ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-600 font-bold flex items-center gap-1">
                <IconTag size={13} /> Descuento (CUP):
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={ticket.discount || ""}
                  onChange={(e) => ticket.setDiscount(parseFloat(e.target.value || "0"))}
                  placeholder="0"
                  className="w-20 px-2 py-1 rounded-lg border border-slate-300 text-xs font-bold outline-none text-right"
                  autoFocus
                />
                <button
                  onClick={() => setShowDiscountInput(false)}
                  className="text-xs text-slate-500 font-bold px-1.5 hover:text-slate-800 cursor-pointer"
                >
                  OK
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setShowDiscountInput(true)}
                className="text-amber-700 hover:underline font-extrabold flex items-center gap-1 cursor-pointer"
              >
                <IconTag size={13} />
                <span>{ticket.discount > 0 ? "Modificar Descuento" : "+ Aplicar Descuento"}</span>
              </button>
              {ticket.discount > 0 && (
                <span className="text-rose-600 font-black text-xs">
                  -{formatCurrency(ticket.discount, "CUP", state.rates)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Payment Method Selector */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider block">
              MÉTODO DE PAGO
            </label>
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
              {isOnline ? (
                <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                  <IconWifi size={11} /> Pasarelas Online
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md">
                  <IconWifiOff size={11} /> Modo Offline
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              id="btn-paymethod-cash"
              onClick={() => setPaymentMethod("cash")}
              className={`py-2 px-1 rounded-xl font-extrabold text-[11px] transition cursor-pointer flex flex-col items-center gap-0.5 ${
                paymentMethod === "cash"
                  ? "bg-slate-900 text-white shadow-md ring-2 ring-amber-400"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="text-base">💵</span>
              <span>Efectivo</span>
            </button>

            <button
              type="button"
              id="btn-paymethod-transfermovil"
              onClick={() => setPaymentMethod("transfermovil")}
              className={`py-2 px-1 rounded-xl font-extrabold text-[11px] transition cursor-pointer flex flex-col items-center gap-0.5 ${
                paymentMethod === "transfermovil" || paymentMethod === "transfer"
                  ? "bg-slate-900 text-white shadow-md ring-2 ring-amber-400"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="text-base">💳</span>
              <span className="truncate w-full text-center">Transfermóvil</span>
            </button>

            <button
              type="button"
              id="btn-paymethod-enzona"
              onClick={() => setPaymentMethod("enzona")}
              className={`py-2 px-1 rounded-xl font-extrabold text-[11px] transition cursor-pointer flex flex-col items-center gap-0.5 ${
                paymentMethod === "enzona"
                  ? "bg-slate-900 text-white shadow-md ring-2 ring-amber-400"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="text-base">📱</span>
              <span>EnZona</span>
            </button>

            <button
              type="button"
              id="btn-paymethod-mixed"
              onClick={() => setPaymentMethod("mixed")}
              className={`py-2 px-1 rounded-xl font-extrabold text-[11px] transition cursor-pointer flex flex-col items-center gap-0.5 ${
                paymentMethod === "mixed"
                  ? "bg-slate-900 text-white shadow-md ring-2 ring-amber-400"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="text-base">🔀</span>
              <span>Mixto</span>
            </button>
          </div>
        </div>

        {/* Cash Given & Quick Bills Buttons */}
        {paymentMethod === "cash" && (
          <div className="bg-white rounded-2xl p-3 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider block">
                EFECTIVO RECIBIDO (CUP)
              </label>
              <button
                type="button"
                onClick={() => setCashPaid(ticket.total)}
                className="text-[11px] font-extrabold text-amber-700 hover:underline cursor-pointer"
              >
                Exacto (${ticket.total})
              </button>
            </div>
            <div className="neu-inset rounded-xl px-3 h-10 flex items-center gap-2 bg-slate-50">
              <span className="text-slate-400 font-bold text-sm">$</span>
              <input
                id="input-cash-paid"
                type="number"
                value={cashPaid}
                onChange={(e) =>
                  setCashPaid(e.target.value === "" ? "" : parseFloat(e.target.value))
                }
                placeholder={String(ticket.total)}
                className="flex-1 bg-transparent outline-none font-black text-base text-slate-900"
              />
              {cashPaid !== "" && (
                <button
                  type="button"
                  onClick={() => setCashPaid("")}
                  className="text-xs text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Quick Bills Row */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 pt-0.5">
              {QUICK_CASH_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    const cur = typeof cashPaid === "number" ? cashPaid : 0;
                    setCashPaid(cur + amt);
                  }}
                  className="py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10.5px] font-extrabold transition cursor-pointer active:scale-95"
                >
                  +${amt}
                </button>
              ))}
            </div>

            {/* Change Output */}
            {numPaid >= totalCUP && (
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between mt-1">
                <span className="text-xs font-extrabold text-emerald-900">
                  CAMBIO A DEVOLVER:
                </span>
                <span className="text-sm sm:text-base font-black text-emerald-700">
                  {formatCurrency(changeDue, "CUP", state.rates)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Transfermóvil Online Gateway Flow */}
        {(paymentMethod === "transfermovil" || paymentMethod === "transfer") && (
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 space-y-3">
            {!isOnline ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-black text-amber-950">
                  <IconAlert size={14} className="text-amber-600 shrink-0" />
                  <span>Sin conexión online para pasarelas</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900/90">
                  Transfermóvil requiere conectividad a internet para validar el pago. Puedes cobrar en Efectivo o habilitar el Modo Online.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cash")}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-950 font-extrabold text-[11px] cursor-pointer"
                  >
                    💵 Cambiar a Efectivo
                  </button>
                  <button
                    type="button"
                    onClick={() => actions.setConnectivityMode("online")}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-[11px] cursor-pointer"
                  >
                    🌐 Activar Modo Online
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs font-black flex items-center justify-center">
                      TM
                    </span>
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 block">
                        Pasarela Transfermóvil
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Destino: {phoneTarget}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                    ${totalCUP} CUP
                  </span>
                </div>

                {/* Direct Action Launchers */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleLaunchGateway("transfermovil")}
                    className="py-2.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                  >
                    <IconBolt size={14} /> Abrir Transfermóvil
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyUSSD}
                    className="py-2.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center justify-center gap-1 transition cursor-pointer active:scale-95"
                  >
                    <span>{copiedUSSD ? "✓ Copiado" : "📲 Código USSD"}</span>
                  </button>
                </div>

                {/* Status Choice */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
                    ESTADO INICIAL DEL TICKET
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGatewayStatusSelection("PENDIENTE")}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                        gatewayStatusSelection === "PENDIENTE"
                          ? "bg-amber-400 text-slate-950 font-black shadow-xs"
                          : "bg-white border border-slate-200 text-slate-700"
                      }`}
                    >
                      ⏳ Pago Pendiente
                    </button>
                    <button
                      type="button"
                      onClick={() => setGatewayStatusSelection("COMPLETADO")}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                        gatewayStatusSelection === "COMPLETADO"
                          ? "bg-emerald-600 text-white font-black shadow-xs"
                          : "bg-white border border-slate-200 text-slate-700"
                      }`}
                    >
                      ✅ Ya Confirmado
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-0.5">
                    {gatewayStatusSelection === "PENDIENTE"
                      ? "El ticket se registrará como Pendiente hasta recibir confirmación por SMS o pasarela."
                      : "El cobro se marcará de inmediato como Completado en caja."}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* EnZona Online Gateway Flow */}
        {paymentMethod === "enzona" && (
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 space-y-3">
            {!isOnline ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-black text-amber-950">
                  <IconAlert size={14} className="text-amber-600 shrink-0" />
                  <span>Sin conexión online para EnZona</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900/90">
                  EnZona requiere conectividad a internet para procesar la transacción y recibir la confirmación.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cash")}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-950 font-extrabold text-[11px] cursor-pointer"
                  >
                    💵 Cambiar a Efectivo
                  </button>
                  <button
                    type="button"
                    onClick={() => actions.setConnectivityMode("online")}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-[11px] cursor-pointer"
                  >
                    🌐 Activar Modo Online
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-red-600 text-white text-xs font-black flex items-center justify-center">
                      EZ
                    </span>
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 block">
                        Pasarela EnZona
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Comercio: {state.business.name || "Cajamaster POS"}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-black text-red-700 bg-red-50 px-2 py-0.5 rounded-md">
                    ${totalCUP} CUP
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleLaunchGateway("enzona")}
                  className="w-full py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                >
                  <IconBolt size={14} /> Abrir App EnZona
                </button>

                {/* Status Choice */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
                    ESTADO INICIAL DEL TICKET
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGatewayStatusSelection("PENDIENTE")}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                        gatewayStatusSelection === "PENDIENTE"
                          ? "bg-amber-400 text-slate-950 font-black shadow-xs"
                          : "bg-white border border-slate-200 text-slate-700"
                      }`}
                    >
                      ⏳ Pago Pendiente
                    </button>
                    <button
                      type="button"
                      onClick={() => setGatewayStatusSelection("COMPLETADO")}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                        gatewayStatusSelection === "COMPLETADO"
                          ? "bg-emerald-600 text-white font-black shadow-xs"
                          : "bg-white border border-slate-200 text-slate-700"
                      }`}
                    >
                      ✅ Ya Confirmado
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Optional Notes */}
        <div>
          <label className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 block">
            NOTA / REFERENCIA (OPCIONAL)
          </label>
          <input
            value={ticket.notes}
            onChange={(e) => ticket.setNotes(e.target.value)}
            placeholder="Ej. Mesa 4, Para llevar, Cliente VIP..."
            className="w-full neu-inset rounded-xl px-3 h-9 text-xs font-semibold outline-none text-slate-800 bg-white"
          />
        </div>
      </div>

      {/* Bottom Sticky Action Buttons */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0 flex gap-2 shadow-lg">
        {/* 1-Tap Quick Cash Checkout */}
        <button
          id="btn-quick-cash-action"
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFinishSale("cash", ticket.total, "COMPLETADO", undefined, undefined, e);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFinishSale("cash", ticket.total, "COMPLETADO", undefined, undefined, e);
          }}
          disabled={ticket.items.length === 0}
          className={`px-3.5 h-12 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 select-none ${
            ticket.items.length > 0
              ? "bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md active:scale-95"
              : "bg-slate-100 text-slate-400 cursor-not-allowed opacity-50"
          }`}
          title="Cobro rápido en efectivo exacto"
        >
          ⚡ Rápido
        </button>

        {/* Main Confirmar Cobro Button */}
        <button
          id="btn-confirm-checkout"
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const method = paymentMethod;
            const status =
              method === "cash"
                ? "COMPLETADO"
                : gatewayStatusSelection;
            const payload =
              method === "transfermovil" || method === "transfer"
                ? transfermovilPayload
                : method === "enzona"
                ? enzonaPayload
                : undefined;
            const ref = payload?.reference;

            onFinishSale(method, undefined, status, ref, payload, e);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const method = paymentMethod;
            const status =
              method === "cash"
                ? "COMPLETADO"
                : gatewayStatusSelection;
            const payload =
              method === "transfermovil" || method === "transfer"
                ? transfermovilPayload
                : method === "enzona"
                ? enzonaPayload
                : undefined;
            const ref = payload?.reference;

            onFinishSale(method, undefined, status, ref, payload, e);
          }}
          disabled={ticket.items.length === 0}
          className={`flex-1 h-12 rounded-2xl font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 transition cursor-pointer select-none ${
            ticket.items.length > 0
              ? "bg-slate-900 hover:bg-slate-800 text-white active:scale-98 shadow-slate-900/20"
              : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
          }`}
        >
          <IconCheck size={16} className={ticket.items.length > 0 ? "text-amber-400" : "text-slate-400"} />
          <span>
            {paymentMethod !== "cash" && gatewayStatusSelection === "PENDIENTE"
              ? `REGISTRAR PENDIENTE (${formatCurrency(ticket.total, "CUP", state.rates)})`
              : `CONFIRMAR COBRO (${formatCurrency(ticket.total, "CUP", state.rates)})`}
          </span>
        </button>
      </div>
    </div>
  );
}
