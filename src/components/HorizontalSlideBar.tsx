import React, { useRef, useState, useEffect, useCallback } from "react";
import { IconChevronLeft, IconChevronRight } from "./Icons";

interface HorizontalSlideBarProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  showArrows?: boolean;
  showTrack?: boolean;
  scrollStep?: number;
}

export function HorizontalSlideBar({
  children,
  className = "",
  containerClassName = "",
  showArrows = true,
  showTrack = true,
  scrollStep = 160,
}: HorizontalSlideBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0); // 0 to 1
  const [viewportRatio, setViewportRatio] = useState(1);
  const [isDraggingTrack, setIsDraggingTrack] = useState(false);

  // Mouse drag support for desktop
  const isMouseDown = useRef(false);
  const startX = useRef(0);
  const startScrollLeft = useRef(0);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
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
    const el = scrollRef.current;
    if (!el) return;

    const handleResize = () => updateScrollState();
    window.addEventListener("resize", handleResize);
    el.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      el.removeEventListener("scroll", updateScrollState);
    };
  }, [updateScrollState, children]);

  const scrollByAmount = (offset: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    isMouseDown.current = true;
    startX.current = e.pageX - el.offsetLeft;
    startScrollLeft.current = el.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown.current || !scrollRef.current) return;
    const el = scrollRef.current;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX.current) * 1.2;
    el.scrollLeft = startScrollLeft.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isMouseDown.current = false;
  };

  // Slider track dragging
  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const container = scrollRef.current;
    if (!track || !container) return;

    setIsDraggingTrack(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const rect = track.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = rect.width > 0 ? clickX / rect.width : 0;
    const maxScroll = container.scrollWidth - container.clientWidth;
    container.scrollTo({ left: ratio * maxScroll, behavior: "auto" });
  };

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingTrack) return;
    const track = trackRef.current;
    const container = scrollRef.current;
    if (!track || !container) return;

    const rect = track.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = rect.width > 0 ? clickX / rect.width : 0;
    const maxScroll = container.scrollWidth - container.clientWidth;
    container.scrollLeft = ratio * maxScroll;
  };

  const handleTrackPointerUp = () => {
    setIsDraggingTrack(false);
  };

  const isOverflowing = viewportRatio < 0.98 || canScrollLeft || canScrollRight;

  return (
    <div className={`relative select-none ${className}`}>
      {/* Navigation Left Arrow */}
      {showArrows && canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByAmount(-scrollStep)}
          aria-label="Desplazar a la izquierda"
          className="absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-slate-900 text-white shadow-md flex items-center justify-center cursor-pointer transition hover:scale-110 active:scale-95 hover:bg-slate-800"
        >
          <IconChevronLeft size={16} />
        </button>
      )}

      {/* Left Edge Gradient Fade */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-5 bg-gradient-to-r from-white/90 to-transparent pointer-events-none z-10 rounded-l-xl" />
      )}

      {/* Horizontal Scroll Area */}
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onScroll={updateScrollState}
        className={`flex items-center gap-1.5 overflow-x-auto scrollbar-none touch-pan-x scroll-smooth cursor-grab active:cursor-grabbing ${containerClassName}`}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {children}
      </div>

      {/* Right Edge Gradient Fade */}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-5 bg-gradient-to-l from-white/90 to-transparent pointer-events-none z-10 rounded-r-xl" />
      )}

      {/* Navigation Right Arrow */}
      {showArrows && canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByAmount(scrollStep)}
          aria-label="Desplazar a la derecha"
          className="absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-slate-900 text-white shadow-md flex items-center justify-center cursor-pointer transition hover:scale-110 active:scale-95 hover:bg-slate-800"
        >
          <IconChevronRight size={16} />
        </button>
      )}

      {/* Slide Bar Track (Visible when content overflows) */}
      {showTrack && isOverflowing && (
        <div className="flex items-center justify-between gap-2 px-1 pt-1.5 mt-0.5">
          <button
            type="button"
            onClick={() => scrollByAmount(-scrollStep)}
            disabled={!canScrollLeft}
            className={`text-[10px] font-extrabold flex items-center gap-0.5 transition cursor-pointer shrink-0 ${
              canScrollLeft ? "text-slate-700 hover:text-slate-950" : "text-slate-300 cursor-not-allowed"
            }`}
          >
            <IconChevronLeft size={12} />
            <span className="hidden xs:inline">Prev</span>
          </button>

          <div
            ref={trackRef}
            onPointerDown={handleTrackPointerDown}
            onPointerMove={handleTrackPointerMove}
            onPointerUp={handleTrackPointerUp}
            onPointerCancel={handleTrackPointerUp}
            className="relative flex-1 h-2 bg-slate-200/90 hover:bg-slate-300/80 rounded-full cursor-pointer touch-none transition-colors p-0.5"
            title="Desliza para mover los botones"
          >
            {(() => {
              const thumbWidth = Math.max(22, Math.min(80, viewportRatio * 100));
              const thumbLeft = scrollProgress * (100 - thumbWidth);
              return (
                <div
                  className={`h-full rounded-full transition-all duration-75 ${
                    isDraggingTrack
                      ? "bg-amber-600 scale-y-125 shadow-xs"
                      : "bg-amber-500 hover:bg-amber-600 shadow-2xs"
                  }`}
                  style={{
                    width: `${thumbWidth}%`,
                    marginLeft: `${thumbLeft}%`,
                  }}
                />
              );
            })()}
          </div>

          <button
            type="button"
            onClick={() => scrollByAmount(scrollStep)}
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
  );
}
