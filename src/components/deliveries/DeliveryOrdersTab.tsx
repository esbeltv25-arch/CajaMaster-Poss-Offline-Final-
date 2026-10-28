import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  IconTruck,
  IconPlus,
  IconSearch,
  IconFilter,
  IconWhatsApp,
  IconTelegram,
  IconMapPin,
  IconPhone,
  IconMotorcycle,
  IconBuilding,
  IconCheck,
  IconClock,
  IconCoins,
  IconEye,
  IconChevronRight,
  IconChevronLeft,
  IconGrid,
  IconList,
} from "../Icons";
import { useStore, actions } from "../../store";
import { formatCurrency } from "../../utils/currency";
import type { DeliveryOrder, DeliveryStatus } from "../../types";

const STATUS_FILTERS: { key: string; label: string; countKey?: DeliveryStatus }[] = [
  { key: "ALL", label: "Todos" },
  { key: "ACTIVE", label: "🔥 Activos" },
  { key: "NUEVO", label: "📥 Nuevos", countKey: "NUEVO" },
  { key: "PREPARACION", label: "🍳 En Cocina", countKey: "PREPARACION" },
  { key: "LISTO", label: "📦 Listos", countKey: "LISTO" },
  { key: "EN_RUTA", label: "🛵 En Ruta", countKey: "EN_RUTA" },
  { key: "ENTREGADO", label: "✅ Entregados", countKey: "ENTREGADO" },
];

export function DeliveryOrdersTab({
  onOpenNewOrder,
  onOpenDetail,
  onOpenDispatch,
  onOpenWhatsApp,
}: {
  onOpenNewOrder: () => void;
  onOpenDetail: (order: DeliveryOrder) => void;
  onOpenDispatch: (order: DeliveryOrder) => void;
  onOpenWhatsApp: (order: DeliveryOrder) => void;
}) {
  const state = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ACTIVE");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");

  // Filter slider & scroll management
  const filterContainerRef = useRef<HTMLDivElement>(null);
  const slideTrackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0); // 0 to 1
  const [viewportRatio, setViewportRatio] = useState(1); // clientWidth / scrollWidth
  const [isDraggingTrack, setIsDraggingTrack] = useState(false);

  // Mouse drag-to-scroll on the buttons row
  const isMouseDown = useRef(false);
  const mouseStartX = useRef(0);
  const mouseScrollLeft = useRef(0);
  const mouseMovedDistance = useRef(0);

  const deliveries = state.deliveries || [];

  const updateScrollState = useCallback(() => {
    const el = filterContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = Math.max(0, scrollWidth - clientWidth);

    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(maxScroll > 6 && scrollLeft < maxScroll - 6);

    const ratio = scrollWidth > 0 ? Math.min(1, clientWidth / scrollWidth) : 1;
    setViewportRatio(ratio);

    const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollLeft / maxScroll)) : 0;
    setScrollProgress(progress);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = filterContainerRef.current;
    if (!el) return;

    const handleResize = () => updateScrollState();
    window.addEventListener("resize", handleResize);
    el.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      el.removeEventListener("scroll", updateScrollState);
    };
  }, [updateScrollState, deliveries.length]);

  const scrollByAmount = (offset: number) => {
    if (filterContainerRef.current) {
      filterContainerRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  const handleFilterClick = (filterKey: string, element: HTMLButtonElement) => {
    if (mouseMovedDistance.current > 6) return;
    setSelectedStatusFilter(filterKey);
    element.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = filterContainerRef.current;
    if (!el) return;
    isMouseDown.current = true;
    mouseStartX.current = e.pageX - el.offsetLeft;
    mouseScrollLeft.current = el.scrollLeft;
    mouseMovedDistance.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current || !filterContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - filterContainerRef.current.offsetLeft;
    const walk = (x - mouseStartX.current) * 1.5;
    mouseMovedDistance.current = Math.abs(x - mouseStartX.current);
    filterContainerRef.current.scrollLeft = mouseScrollLeft.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isMouseDown.current = false;
  };

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingTrack(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleTrackSeek(e);
  };

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingTrack) return;
    handleTrackSeek(e);
  };

  const handleTrackSeek = (e: React.PointerEvent<HTMLDivElement>) => {
    const track = slideTrackRef.current;
    const container = filterContainerRef.current;
    if (!track || !container) return;

    const rect = track.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = rect.width > 0 ? clickX / rect.width : 0;

    const maxScroll = container.scrollWidth - container.clientWidth;
    container.scrollLeft = ratio * maxScroll;
  };

  const handleTrackPointerUp = () => {
    setIsDraggingTrack(false);
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return deliveries.filter((order) => {
      // Status filter
      if (selectedStatusFilter === "ACTIVE") {
        if (order.status === "ENTREGADO" || order.status === "CANCELADO") return false;
      } else if (selectedStatusFilter !== "ALL") {
        if (order.status !== selectedStatusFilter) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCustomer = order.customerName.toLowerCase().includes(q);
        const matchesPhone = order.customerPhone?.toLowerCase().includes(q);
        const matchesAddress = order.customerAddress.toLowerCase().includes(q);
        const matchesOrderNumber = order.orderNumber.toString().includes(q);
        const matchesDriver = order.driverName?.toLowerCase().includes(q);
        const matchesItems = order.items.some((it) => it.name.toLowerCase().includes(q));

        if (!matchesCustomer && !matchesPhone && !matchesAddress && !matchesOrderNumber && !matchesDriver && !matchesItems) {
          return false;
        }
      }

      return true;
    });
  }, [deliveries, selectedStatusFilter, searchQuery]);

  // Metrics
  const activeOrdersCount = deliveries.filter((o) => o.status !== "ENTREGADO" && o.status !== "CANCELADO").length;
  const inRouteCount = deliveries.filter((o) => o.status === "EN_RUTA").length;
  const inPrepCount = deliveries.filter((o) => o.status === "PREPARACION" || o.status === "NUEVO").length;
  const totalPendingDeliveryCash = deliveries
    .filter((o) => o.status !== "CANCELADO" && o.paymentStatus === "PENDIENTE")
    .reduce((acc, o) => acc + o.total, 0);

  const handleNextStatus = (order: DeliveryOrder) => {
    if (order.status === "NUEVO") {
      actions.updateDeliveryStatus(order.id, "PREPARACION");
    } else if (order.status === "PREPARACION") {
      actions.updateDeliveryStatus(order.id, "LISTO");
    } else if (order.status === "LISTO") {
      onOpenDispatch(order);
    } else if (order.status === "EN_RUTA") {
      actions.updateDeliveryStatus(order.id, "ENTREGADO");
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="p-3 sm:p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wide truncate">
              Envíos Activos
            </span>
            <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xs shrink-0">
              🔥
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900">{activeOrdersCount}</p>
        </div>

        <div className="p-3 sm:p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wide truncate">
              En Ruta / Moto
            </span>
            <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xs shrink-0">
              🛵
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-blue-700">{inRouteCount}</p>
        </div>

        <div className="p-3 sm:p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wide truncate">
              En Preparación
            </span>
            <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs shrink-0">
              🍳
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-700">{inPrepCount}</p>
        </div>

        <div className="p-3 sm:p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wide truncate">
              Por Cobrar
            </span>
            <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xs shrink-0">
              💵
            </span>
          </div>
          <p className="text-sm sm:text-base font-black text-slate-900 truncate">
            {formatCurrency(totalPendingDeliveryCash, "CUP", state.rates)}
          </p>
        </div>
      </div>

      {/* Control Bar: Action Button, Search & View Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente, teléfono, dirección o #..."
            className="w-full text-xs pl-8 pr-3 py-2 rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xs focus:ring-2 focus:ring-amber-400 focus:outline-hidden placeholder:text-slate-400"
          />
          <span className="absolute left-2.5 top-2.5 text-slate-400">
            <IconSearch size={14} />
          </span>
        </div>

        {/* View Toggle (Tablero / Lista) & New Order Button */}
        <div className="flex items-center justify-between sm:justify-end gap-2">
          {/* Selector de Vista: Tablero vs Lista */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              id="btn-delivery-view-board"
              onClick={() => setViewMode("board")}
              title="Vista de Tablero / Tarjetas"
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                viewMode === "board"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <IconGrid size={13} className="shrink-0" />
              <span>Tablero</span>
            </button>
            <button
              type="button"
              id="btn-delivery-view-list"
              onClick={() => setViewMode("list")}
              title="Vista de Lista / Tabla Compacta"
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                viewMode === "list"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <IconList size={13} className="shrink-0" />
              <span>Lista</span>
            </button>
          </div>

          <button
            type="button"
            id="btn-new-delivery-order"
            onClick={onOpenNewOrder}
            className="px-3.5 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer shrink-0 active:scale-95"
          >
            <IconPlus size={15} />
            <span>+ Nuevo Pedido</span>
          </button>
        </div>
      </div>

      {/* Filter Chips & Horizontal Slide Controller */}
      <div className="relative select-none">
        {/* Navigation Left Arrow (Desktop/Tablet only) */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollByAmount(-160)}
            aria-label="Desplazar a la izquierda"
            className="hidden md:flex absolute -left-1 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-slate-900 text-white shadow-md items-center justify-center cursor-pointer transition hover:scale-110 active:scale-95 hover:bg-slate-800"
          >
            <IconChevronLeft size={16} />
          </button>
        )}

        {/* Left Edge Gradient Fade */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-4 w-6 bg-gradient-to-r from-slate-100/90 to-transparent pointer-events-none z-10 rounded-l-xl" />
        )}

        {/* Scrollable Button Container */}
        <div
          ref={filterContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onScroll={updateScrollState}
          className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none touch-pan-x scroll-smooth cursor-grab active:cursor-grabbing"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {STATUS_FILTERS.map((f) => {
            const count = f.countKey
              ? deliveries.filter((o) => o.status === f.countKey).length
              : f.key === "ACTIVE"
              ? activeOrdersCount
              : deliveries.length;

            const isSelected = selectedStatusFilter === f.key;

            return (
              <button
                key={f.key}
                type="button"
                onClick={(e) => handleFilterClick(f.key, e.currentTarget)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border active:scale-95 ${
                  isSelected
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-900/20"
                    : "bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span>{f.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold transition-colors ${
                    isSelected
                      ? "bg-slate-800 text-amber-300"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Edge Gradient Fade */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-4 w-6 bg-gradient-to-l from-slate-100/90 to-transparent pointer-events-none z-10 rounded-r-xl" />
        )}

        {/* Navigation Right Arrow (Desktop/Tablet only) */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByAmount(160)}
            aria-label="Desplazar a la derecha"
            className="hidden md:flex absolute -right-1 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-slate-900 text-white shadow-md items-center justify-center cursor-pointer transition hover:scale-110 active:scale-95 hover:bg-slate-800"
          >
            <IconChevronRight size={16} />
          </button>
        )}

        {/* Slide Bar (Deslizador visual e interactivo debajo de los botones) */}
        {(viewportRatio < 0.98 || canScrollLeft || canScrollRight) && (
          <div className="flex items-center justify-between gap-2 px-1 pt-0.5">
            {/* Quick left scroll button on mobile */}
            <button
              type="button"
              onClick={() => scrollByAmount(-140)}
              disabled={!canScrollLeft}
              className={`text-[10px] font-extrabold flex items-center gap-0.5 transition cursor-pointer shrink-0 ${
                canScrollLeft ? "text-slate-700 hover:text-slate-950" : "text-slate-300 cursor-not-allowed"
              }`}
            >
              <IconChevronLeft size={12} />
              <span className="hidden xs:inline">Prev</span>
            </button>

            {/* Interactive Slide Track */}
            <div
              ref={slideTrackRef}
              onPointerDown={handleTrackPointerDown}
              onPointerMove={handleTrackPointerMove}
              onPointerUp={handleTrackPointerUp}
              onPointerCancel={handleTrackPointerUp}
              className="flex-1 h-2 bg-slate-200/80 rounded-full relative cursor-pointer overflow-hidden touch-none"
            >
              {(() => {
                const thumbWidth = Math.max(14, Math.round(viewportRatio * 100));
                const maxLeft = 100 - thumbWidth;
                const thumbLeft = Math.max(0, Math.min(maxLeft, Math.round(scrollProgress * maxLeft)));

                return (
                  <div
                    className={`h-full rounded-full transition-transform duration-75 pointer-events-none ${
                      isDraggingTrack ? "bg-amber-600 scale-y-125 shadow-xs" : "bg-amber-500 hover:bg-amber-600 shadow-2xs"
                    }`}
                    style={{
                      width: `${thumbWidth}%`,
                      marginLeft: `${thumbLeft}%`,
                    }}
                  />
                );
              })()}
            </div>

            {/* Quick right scroll button on mobile */}
            <button
              type="button"
              onClick={() => scrollByAmount(140)}
              disabled={!canScrollRight}
              className={`text-[10px] font-extrabold flex items-center gap-0.5 transition cursor-pointer shrink-0 ${
                canScrollRight ? "text-slate-700 hover:text-slate-950" : "text-slate-300 cursor-not-allowed"
              }`}
            >
              <span className="hidden xs:inline">Más</span>
              <IconChevronRight size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Orders View: TABLERO (Grid de Tarjetas) vs LISTA (Tabla / Filas Detalladas) */}
      {filteredOrders.length > 0 ? (
        viewMode === "board" ? (
          /* ==================== VISTA 1: TABLERO DE TARJETAS ==================== */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredOrders.map((order) => {
              const isDelivered = order.status === "ENTREGADO";
              const isInRoute = order.status === "EN_RUTA";
              const isReady = order.status === "LISTO";
              const isPrep = order.status === "PREPARACION";
              const isNew = order.status === "NUEVO";

              return (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3.5 bg-white rounded-3xl border transition flex flex-col justify-between shadow-2xs hover:shadow-md ${
                    isInRoute
                      ? "border-blue-300 ring-2 ring-blue-100"
                      : isReady
                      ? "border-amber-300"
                      : isDelivered
                      ? "border-emerald-200 opacity-80"
                      : "border-slate-200/80"
                  }`}
                >
                  <div>
                    {/* Top Bar: Order Number & Status Pill */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-sm text-slate-900">
                          #{order.orderNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            isDelivered
                              ? "bg-emerald-100 text-emerald-800"
                              : isInRoute
                              ? "bg-blue-100 text-blue-800"
                              : isReady
                              ? "bg-amber-100 text-amber-800"
                              : isPrep
                              ? "bg-orange-100 text-orange-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isInRoute
                                ? "bg-blue-600 animate-pulse"
                                : isDelivered
                                ? "bg-emerald-600"
                                : isReady
                                ? "bg-amber-600"
                                : "bg-slate-500"
                            }`}
                          />
                          {order.status}
                        </span>
                      </div>
                    </div>

                    {/* Customer & Address */}
                    <div className="mb-2.5">
                      <h4 className="text-xs font-extrabold text-slate-900 truncate">
                        {order.customerName}
                      </h4>
                      <div className="flex items-start gap-1 text-[11px] text-slate-600 mt-0.5">
                        <span className="text-rose-500 shrink-0 mt-0.5">
                          <IconMapPin size={12} />
                        </span>
                        <span className="line-clamp-2 leading-tight">
                          {order.customerAddress}
                        </span>
                      </div>
                    </div>

                    {/* Products summary badge */}
                    <div className="p-2 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-700 mb-2.5 space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span>{order.items.length} productos</span>
                        <span className="text-amber-800 font-extrabold">
                          Total: {formatCurrency(order.total, "CUP", state.rates)}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">
                        {order.items.map((i) => `${i.qty}x ${i.name}`).join(", ")}
                      </p>
                    </div>

                    {/* Assignment Pill */}
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-3">
                      <div className="flex items-center gap-1.5 truncate">
                        {order.assignmentType === "DRIVER" && order.driverName ? (
                          <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded-lg flex items-center gap-1 truncate">
                            <IconMotorcycle size={11} /> {order.driverName}
                          </span>
                        ) : order.assignmentType === "AGENCY" && order.agencyName ? (
                          <span className="bg-purple-50 text-purple-800 px-2 py-0.5 rounded-lg flex items-center gap-1 truncate">
                            <IconBuilding size={11} /> {order.agencyName}
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg">
                            ⚠️ Sin Asignar
                          </span>
                        )}
                      </div>

                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                          order.paymentStatus === "COMPLETADO"
                            ? "bg-emerald-50 text-emerald-700 font-extrabold"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {order.paymentStatus === "COMPLETADO" ? "Cobrado" : "Por Cobrar"}
                      </span>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenDetail(order)}
                        title="Ver detalles completos"
                        className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer shrink-0"
                      >
                        <IconEye size={14} />
                      </button>

                      {order.customerPhone && (
                        <>
                          <button
                            type="button"
                            onClick={() => onOpenWhatsApp(order)}
                            title="Notificar por WhatsApp"
                            className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center transition cursor-pointer shrink-0"
                          >
                            <IconWhatsApp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenWhatsApp(order)}
                            title="Notificar por Telegram"
                            className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-600 flex items-center justify-center transition cursor-pointer shrink-0"
                          >
                            <IconTelegram size={14} />
                          </button>
                        </>
                      )}

                      {!isDelivered && (
                        <button
                          type="button"
                          onClick={() => onOpenDispatch(order)}
                          title="Asignar repartidor o agencia"
                          className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center transition cursor-pointer shrink-0"
                        >
                          <IconTruck size={14} />
                        </button>
                      )}
                    </div>

                    {/* Primary Next Action Button */}
                    {!isDelivered && (
                      <button
                        type="button"
                        onClick={() => handleNextStatus(order)}
                        className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-black flex items-center gap-1 transition cursor-pointer shadow-2xs shrink-0 active:scale-95 ${
                          isNew
                            ? "bg-orange-500 hover:bg-orange-600 text-white"
                            : isPrep
                            ? "bg-amber-500 hover:bg-amber-600 text-slate-950"
                            : isReady
                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        }`}
                      >
                        <span className="truncate">
                          {isNew
                            ? "A Cocina 🍳"
                            : isPrep
                            ? "Marcar Listo 📦"
                            : isReady
                            ? "Despachar 🛵"
                            : "Entregar ✅"}
                        </span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* ==================== VISTA 2: LISTA / TABLA DETALLADA ==================== */
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-3 sm:px-4"># Pedido</th>
                    <th className="py-3 px-3 sm:px-4">Cliente & Destino</th>
                    <th className="py-3 px-3 sm:px-4">Estado</th>
                    <th className="py-3 px-3 sm:px-4">Asignación</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Total</th>
                    <th className="py-3 px-3 sm:px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => {
                    const isDelivered = order.status === "ENTREGADO";
                    const isInRoute = order.status === "EN_RUTA";
                    const isReady = order.status === "LISTO";
                    const isPrep = order.status === "PREPARACION";
                    const isNew = order.status === "NUEVO";

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        {/* 1. Pedido & Hora */}
                        <td className="py-3 px-3 sm:px-4 font-black text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-slate-900">
                              #{order.orderNumber}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold block">
                            {new Date(order.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>

                        {/* 2. Cliente, teléfono y dirección */}
                        <td className="py-3 px-3 sm:px-4 min-w-[200px]">
                          <div className="font-extrabold text-slate-900 truncate">
                            {order.customerName}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate mt-0.5">
                            <IconMapPin size={11} className="text-rose-500 shrink-0" />
                            <span className="truncate">{order.customerAddress}</span>
                          </div>
                          {order.customerPhone && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              📞 {order.customerPhone}
                            </span>
                          )}
                        </td>

                        {/* 3. Estado Pill */}
                        <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                              isDelivered
                                ? "bg-emerald-100 text-emerald-800"
                                : isInRoute
                                ? "bg-blue-100 text-blue-800"
                                : isReady
                                ? "bg-amber-100 text-amber-800"
                                : isPrep
                                ? "bg-orange-100 text-orange-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isInRoute
                                  ? "bg-blue-600 animate-pulse"
                                  : isDelivered
                                  ? "bg-emerald-600"
                                  : isReady
                                  ? "bg-amber-600"
                                  : "bg-slate-500"
                              }`}
                            />
                            {order.status}
                          </span>
                        </td>

                        {/* 4. Asignación */}
                        <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                          {order.assignmentType === "DRIVER" && order.driverName ? (
                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 text-[10.5px] font-bold px-2 py-0.5 rounded-lg">
                              <IconMotorcycle size={11} /> {order.driverName}
                            </span>
                          ) : order.assignmentType === "AGENCY" && order.agencyName ? (
                            <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 text-[10.5px] font-bold px-2 py-0.5 rounded-lg">
                              <IconBuilding size={11} /> {order.agencyName}
                            </span>
                          ) : (
                            <span className="inline-flex items-center bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                              ⚠️ Sin Asignar
                            </span>
                          )}
                        </td>

                        {/* 5. Total & Pago */}
                        <td className="py-3 px-3 sm:px-4 text-right whitespace-nowrap">
                          <div className="font-black text-slate-900 text-xs">
                            {formatCurrency(order.total, "CUP", state.rates)}
                          </div>
                          <span
                            className={`text-[9.5px] font-extrabold px-1.5 py-0.2 rounded-md inline-block mt-0.5 ${
                              order.paymentStatus === "COMPLETADO"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {order.paymentStatus === "COMPLETADO" ? "Cobrado" : "Por Cobrar"}
                          </span>
                        </td>

                        {/* 6. Acciones */}
                        <td className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => onOpenDetail(order)}
                              title="Ver detalles"
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer"
                            >
                              <IconEye size={13} />
                            </button>

                            {order.customerPhone && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onOpenWhatsApp(order)}
                                  title="Notificar por WhatsApp"
                                  className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center transition cursor-pointer"
                                >
                                  <IconWhatsApp size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onOpenWhatsApp(order)}
                                  title="Notificar por Telegram"
                                  className="w-7 h-7 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-600 flex items-center justify-center transition cursor-pointer"
                                >
                                  <IconTelegram size={13} />
                                </button>
                              </>
                            )}

                            {!isDelivered && (
                              <button
                                type="button"
                                onClick={() => onOpenDispatch(order)}
                                title="Asignar repartidor"
                                className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center transition cursor-pointer"
                              >
                                <IconTruck size={13} />
                              </button>
                            )}

                            {!isDelivered && (
                              <button
                                type="button"
                                onClick={() => handleNextStatus(order)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-black transition cursor-pointer shadow-2xs active:scale-95 ${
                                  isNew
                                    ? "bg-orange-500 hover:bg-orange-600 text-white"
                                    : isPrep
                                    ? "bg-amber-500 hover:bg-amber-600 text-slate-950"
                                    : isReady
                                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                }`}
                              >
                                {isNew
                                  ? "A Cocina 🍳"
                                  : isPrep
                                  ? "Listo 📦"
                                  : isReady
                                  ? "Despachar 🛵"
                                  : "Entregar ✅"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="py-12 px-4 text-center bg-white rounded-3xl border border-slate-200/80 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto text-xl">
            📦
          </div>
          <h3 className="text-sm font-extrabold text-slate-800">
            No se encontraron pedidos de delivery
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? "Prueba cambiando el término de búsqueda o el filtro de estado."
              : "Registra tu primer pedido a domicilio con el botón '+ Nuevo Pedido' o pegando una comanda de WhatsApp o Telegram."}
          </p>
          <button
            type="button"
            onClick={onOpenNewOrder}
            className="mt-2 px-4 py-2 bg-slate-900 text-white font-extrabold text-xs rounded-xl shadow-xs hover:bg-slate-800 transition cursor-pointer"
          >
            + Crear Pedido a Domicilio
          </button>
        </div>
      )}
    </div>
  );
}
