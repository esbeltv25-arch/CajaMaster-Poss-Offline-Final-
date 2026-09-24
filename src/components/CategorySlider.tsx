import React, { useRef, useState, useEffect, useCallback } from "react";
import { IconChevronLeft, IconChevronRight } from "./Icons";

interface CategorySliderProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  prefixElement?: React.ReactNode;
  activeColorClass?: string;
  inactiveColorClass?: string;
  compact?: boolean;
  categoryCounts?: Record<string, number>;
  allowWrapToggle?: boolean;
}

const CATEGORY_EMOJIS: Record<string, string> = {
  todos: "✨",
  cafeteria: "☕",
  café: "☕",
  cafe: "☕",
  bebidas: "🥤",
  bebida: "🥤",
  refrescos: "🥤",
  alimentos: "🥪",
  comida: "🍔",
  snacks: "🍿",
  postres: "🍰",
  dulces: "🍩",
  cervezas: "🍺",
  cocteles: "🍹",
  tragos: "🍸",
  cigarrillos: "🚬",
  tabaco: "🚬",
  aseo: "🧼",
  limpieza: "🧹",
  otros: "📦",
};

export function CategorySlider({
  categories,
  selectedCategory,
  onSelectCategory,
  prefixElement,
  activeColorClass,
  inactiveColorClass,
  compact = false,
  categoryCounts,
  allowWrapToggle = true,
}: CategorySliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isWrapped, setIsWrapped] = useState(false);

  // Mouse drag-to-scroll (desktop only, avoids interfering with mobile touch)
  const isMouseDown = useRef(false);
  const mouseStartX = useRef(0);
  const mouseScrollLeft = useRef(0);
  const mouseMovedDistance = useRef(0);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || isWrapped) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;

    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft < maxScroll - 6);
  }, [isWrapped]);

  useEffect(() => {
    checkScroll();
    const el = containerRef.current;
    if (!el) return;

    const handleResize = () => checkScroll();
    window.addEventListener("resize", handleResize);
    el.addEventListener("scroll", checkScroll, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      el.removeEventListener("scroll", checkScroll);
    };
  }, [checkScroll, categories, isWrapped]);

  const scrollByAmount = (offset: number) => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isWrapped) return;
    const el = containerRef.current;
    if (!el) return;
    isMouseDown.current = true;
    mouseStartX.current = e.pageX - el.offsetLeft;
    mouseScrollLeft.current = el.scrollLeft;
    mouseMovedDistance.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown.current || !containerRef.current || isWrapped) return;
    const el = containerRef.current;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - mouseStartX.current) * 1.2;
    mouseMovedDistance.current = Math.abs(walk);
    el.scrollLeft = mouseScrollLeft.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isMouseDown.current = false;
  };

  const handleCategoryClick = (cat: string, btnElement: HTMLButtonElement) => {
    if (mouseMovedDistance.current > 6) {
      mouseMovedDistance.current = 0;
      return;
    }
    mouseMovedDistance.current = 0;
    onSelectCategory(cat);

    // Auto-scroll selected button into view if in horizontal mode
    if (!isWrapped && btnElement && containerRef.current) {
      const container = containerRef.current;
      const btnLeft = btnElement.offsetLeft;
      const btnRight = btnLeft + btnElement.offsetWidth;
      const scrollLeft = container.scrollLeft;
      const containerWidth = container.clientWidth;

      if (btnLeft < scrollLeft + 20) {
        container.scrollTo({ left: Math.max(0, btnLeft - 24), behavior: "smooth" });
      } else if (btnRight > scrollLeft + containerWidth - 20) {
        container.scrollTo({
          left: btnRight - containerWidth + 24,
          behavior: "smooth",
        });
      }
    }
  };

  const getEmoji = (cat: string) => {
    const key = cat.toLowerCase().trim();
    return CATEGORY_EMOJIS[key] || "🏷️";
  };

  return (
    <div className="w-full relative select-none">
      <div className="relative flex items-center gap-1">
        {/* Left Arrow for Desktop/Tablet */}
        {!isWrapped && canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollByAmount(-180)}
            className="hidden md:flex absolute -left-2 z-20 w-6 h-6 rounded-full bg-slate-900 text-white shadow-md items-center justify-center cursor-pointer transition hover:scale-110 active:scale-95"
            aria-label="Desplazar a la izquierda"
          >
            <IconChevronLeft size={14} />
          </button>
        )}

        {/* Categories Container: Responsive Horizontal Scroll or Flex-Wrap */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className={`w-full flex ${
            isWrapped
              ? "flex-wrap gap-1.5 py-0.5 px-0.5 max-h-36 overflow-y-auto"
              : "flex-nowrap items-center gap-1.5 overflow-x-auto py-0.5 px-0.5 no-scrollbar touch-pan-x overscroll-x-contain cursor-grab active:cursor-grabbing"
          } ${compact ? "text-[11px]" : "text-xs"}`}
          style={{
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {prefixElement}

          {categories.map((cat) => {
            const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
            const emoji = getEmoji(cat);
            const count = categoryCounts ? categoryCounts[cat] : undefined;

            return (
              <button
                key={cat}
                type="button"
                id={`btn-cat-${cat.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={(e) => handleCategoryClick(cat, e.currentTarget)}
                className={`min-h-[30px] sm:min-h-[34px] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-xl font-extrabold whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 active:scale-95 flex items-center gap-1.5 select-none ${
                  compact ? "text-[11px]" : "text-xs"
                } ${
                  isActive
                    ? activeColorClass || "bg-slate-950 text-white shadow-xs ring-1 ring-slate-950"
                    : inactiveColorClass || "neu-sm text-slate-700 opacity-80 hover:opacity-100 bg-white/80"
                }`}
              >
                {emoji && <span className="text-xs leading-none">{emoji}</span>}
                <span className="leading-tight">{cat}</span>
                {count !== undefined && (
                  <span
                    className={`text-[9.5px] font-black px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? "bg-amber-400 text-slate-950"
                        : "bg-slate-200/80 text-slate-700"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Arrow for Desktop/Tablet */}
        {!isWrapped && canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByAmount(180)}
            className="hidden md:flex absolute -right-2 z-20 w-6 h-6 rounded-full bg-slate-900 text-white shadow-md items-center justify-center cursor-pointer transition hover:scale-110 active:scale-95"
            aria-label="Desplazar a la derecha"
          >
            <IconChevronRight size={14} />
          </button>
        )}

        {/* Optional Toggle Button to switch between Horizontal Scroll and Flex-Wrap Grid on mobile */}
        {allowWrapToggle && categories.length > 3 && (
          <button
            type="button"
            onClick={() => setIsWrapped(!isWrapped)}
            className={`shrink-0 p-1.5 rounded-xl neu-sm text-slate-700 hover:text-slate-950 transition cursor-pointer active:scale-95 text-[10px] font-bold flex items-center justify-center ${
              isWrapped ? "bg-amber-100 text-amber-900 border border-amber-300" : ""
            }`}
            title={isWrapped ? "Modo carrusel horizontal" : "Ver todas las categorías desplegadas"}
            aria-label="Alternar vista de categorías"
          >
            {isWrapped ? "▲ Carrusel" : "▼ Todas"}
          </button>
        )}
      </div>

      {/* Fade edges for mobile swipe indicator when in horizontal mode */}
      {!isWrapped && canScrollLeft && (
        <div className="md:hidden pointer-events-none absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-[var(--color-bg,#F1EFE8)] to-transparent z-10" />
      )}
      {!isWrapped && canScrollRight && (
        <div className="md:hidden pointer-events-none absolute right-8 top-0 bottom-0 w-4 bg-gradient-to-l from-[var(--color-bg,#F1EFE8)] to-transparent z-10" />
      )}
    </div>
  );
}

