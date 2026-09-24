import { useTheme, THEMES, ThemeId, LayoutMode } from "../themeContext";
import { IconCheck, IconBolt } from "./Icons";

export function ThemeSelectorModal() {
  const {
    themeId,
    setThemeId,
    layoutMode,
    setLayoutMode,
    isThemePickerOpen,
    setIsThemePickerOpen,
  } = useTheme();

  if (!isThemePickerOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-pop"
      onClick={() => setIsThemePickerOpen(false)}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-extrabold shadow-lg">
              <IconBolt size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-lg leading-tight">Estudio de Ambientes y Diseños</h2>
              <p className="text-xs text-white/70">Selecciona el aspecto visual ideal para tu negocio</p>
            </div>
          </div>
          <button
            onClick={() => setIsThemePickerOpen(false)}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-sm cursor-pointer transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-slate-900">
          {/* Layout Mode Selector */}
          <div>
            <div className="text-[11px] tracking-widest font-extrabold text-slate-500 uppercase mb-2.5">
              1. FORMATO DE PANTALLA / DISPOSITIVO
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setLayoutMode("phone")}
                className={`p-3.5 rounded-2xl border-2 text-left transition flex flex-col gap-1 cursor-pointer ${
                  layoutMode === "phone"
                    ? "border-amber-500 bg-amber-50 shadow-sm"
                    : "border-slate-200 hover:border-slate-300 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    📱 Modo Móvil
                  </span>
                  {layoutMode === "phone" && (
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs">
                      <IconCheck size={12} />
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Formato compacto vertical tipo smartphone, ideal para ventas ágiles y portátiles.
                </p>
              </button>

              <button
                onClick={() => setLayoutMode("tablet")}
                className={`p-3.5 rounded-2xl border-2 text-left transition flex flex-col gap-1 cursor-pointer ${
                  layoutMode === "tablet"
                    ? "border-amber-500 bg-amber-50 shadow-sm"
                    : "border-slate-200 hover:border-slate-300 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    🖥️ Modo Mostrador / Tablet
                  </span>
                  {layoutMode === "tablet" && (
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs">
                      <IconCheck size={12} />
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Pantalla ancha con catálogo y ticket lateral simultáneo para computadoras y tablets.
                </p>
              </button>
            </div>
          </div>

          {/* Theme list */}
          <div>
            <div className="text-[11px] tracking-widest font-extrabold text-slate-500 uppercase mb-2.5">
              2. ELIGE UN AMBIENTE Y ESTILO VISUAL
            </div>

            <div className="space-y-3">
              {(Object.keys(THEMES) as ThemeId[]).map((id) => {
                const item = THEMES[id];
                const active = themeId === id;

                return (
                  <button
                    key={id}
                    onClick={() => setThemeId(id)}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition relative flex flex-col gap-2 cursor-pointer ${
                      active
                        ? "border-slate-900 shadow-md ring-2 ring-slate-900/10 bg-slate-50"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {/* Swatch dots */}
                        <div className="flex -space-x-1.5">
                          {item.previewColors.map((col, idx) => (
                            <span
                              key={idx}
                              className="w-5 h-5 rounded-full border border-white shadow-xs inline-block"
                              style={{ backgroundColor: col }}
                            />
                          ))}
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-900 text-sm">
                            {item.name}
                          </span>
                          <span className="ml-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                            {item.tag}
                          </span>
                        </div>
                      </div>

                      {active ? (
                        <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center gap-1">
                          <IconCheck size={13} /> Activo
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-bold hover:text-slate-700">
                          Seleccionar →
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed pr-6">
                      {item.description}
                    </p>

                    {/* Preview Bar */}
                    <div
                      className="h-2 w-full rounded-full mt-1 opacity-80"
                      style={{ background: item.bannerGradient }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Tema activo: <strong className="text-slate-800">{THEMES[themeId].name}</strong>
          </span>
          <button
            onClick={() => setIsThemePickerOpen(false)}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Listo, aplicar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

export function FloatingThemeButton() {
  const { setIsThemePickerOpen, theme } = useTheme();

  return (
    <button
      onClick={() => setIsThemePickerOpen(true)}
      className="fixed bottom-4 left-4 z-40 px-3.5 py-2 rounded-full bg-slate-900 text-white text-xs font-extrabold shadow-xl flex items-center gap-2 border border-white/20 hover:scale-105 active:scale-95 transition cursor-pointer"
      title="Cambiar diseño y ambiente visual"
    >
      <span className="text-sm">🎨</span>
      <span className="hidden sm:inline">Diseño:</span>
      <span className="text-[var(--color-gold)] font-bold truncate max-w-[120px]">
        {theme.name.split("&")[0].trim()}
      </span>
    </button>
  );
}
