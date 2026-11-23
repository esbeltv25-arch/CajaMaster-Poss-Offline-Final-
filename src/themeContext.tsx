import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";

export type ThemeId = "emerald" | "cyber-dark" | "nordic" | "artisan" | "fintech";
export type LayoutMode = "phone" | "tablet" | "fullscreen";
export type DarkModePreference = "light" | "dark" | "system";

export interface ScreenCalibration {
  zoom: number; // 75 to 125 (%)
  paddingTop: number; // 0 to 80 (px)
  paddingBottom: number; // 0 to 80 (px)
  paddingHorizontal: number; // 0 to 40 (px)
  displayMode: "phone-frame" | "tablet-frame" | "fit-screen";
}

export const DEFAULT_SCREEN_CALIBRATION: ScreenCalibration = {
  zoom: 100,
  paddingTop: 0,
  paddingBottom: 0,
  paddingHorizontal: 0,
  displayMode: "phone-frame",
};

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  subtitle: string;
  tag: string;
  bgGradient: string;
  darkBgGradient: string;
  frameBg: string;
  darkFrameBg: string;
  inkColor: string;
  darkInkColor: string;
  inkSoftColor: string;
  darkInkSoftColor: string;
  accentColor: string;
  accentDeepColor: string;
  cardBg: string;
  darkCardBg: string;
  cardBorder: string;
  neuBg: string;
  neuInsetBg: string;
  isDark: boolean;
  previewColors: string[];
  bannerGradient: string;
  description: string;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  emerald: {
    id: "emerald",
    name: "Neo-Esmeralda & Ámbar",
    subtitle: "Clásico Elegante Modernizado",
    tag: "Original Pro",
    bgGradient: "from-[#E6E2D6] via-[#F1EFE8] to-[#DDD8C8]",
    darkBgGradient: "from-[#081510] via-[#0D251E] to-[#06110D]",
    frameBg: "#F1EFE8",
    darkFrameBg: "#0B1D17",
    inkColor: "#0E3A2F",
    darkInkColor: "#F2FBF7",
    inkSoftColor: "#1A4D3F",
    darkInkSoftColor: "#6EE7B7",
    accentColor: "#F5B82E",
    accentDeepColor: "#E8A911",
    cardBg: "#FFFFFF",
    darkCardBg: "#122A22",
    cardBorder: "border-black/5",
    neuBg: "#F1EFE8",
    neuInsetBg: "#ECEAE2",
    isDark: false,
    previewColors: ["#0E3A2F", "#F5B82E", "#F1EFE8"],
    bannerGradient: "linear-gradient(135deg, #0E3A2F 0%, #1A4D3F 60%, #0E3A2F 100%)",
    description: "Paleta distinguida inspirada en boutiques de alta gama. Contraste suave sobre marfil satinado con detalles en oro viejo.",
  },
  "cyber-dark": {
    id: "cyber-dark",
    name: "Cyber Titanium Dark",
    subtitle: "OLED Terminal High-Tech",
    tag: "Oscuro Moderno",
    bgGradient: "from-[#090D14] via-[#0F172A] to-[#0B0F19]",
    darkBgGradient: "from-[#05080E] via-[#090D16] to-[#04060A]",
    frameBg: "#0F172A",
    darkFrameBg: "#0B1120",
    inkColor: "#F8FAFC",
    darkInkColor: "#F8FAFC",
    inkSoftColor: "#94A3B8",
    darkInkSoftColor: "#94A3B8",
    accentColor: "#06B6D4",
    accentDeepColor: "#0891B2",
    cardBg: "#1E293B",
    darkCardBg: "#152033",
    cardBorder: "border-cyan-500/20",
    neuBg: "#1E293B",
    neuInsetBg: "#0F172A",
    isDark: true,
    previewColors: ["#0F172A", "#06B6D4", "#1E293B"],
    bannerGradient: "linear-gradient(135deg, #1E1B4B 0%, #0F172A 50%, #064E3B 100%)",
    description: "Estilo futurista de alto contraste con tarjetas oscuras de bordes cian luminescente. Diseñado para trabajar sin fatiga visual.",
  },
  nordic: {
    id: "nordic",
    name: "Nordic Minimalist Slate",
    subtitle: "Inspirado en Apple / Studio Limpio",
    tag: "Ultra Clean",
    bgGradient: "from-[#F1F5F9] via-[#F8FAFC] to-[#E2E8F0]",
    darkBgGradient: "from-[#0B0F19] via-[#0F172A] to-[#080C14]",
    frameBg: "#FFFFFF",
    darkFrameBg: "#0F172A",
    inkColor: "#0F172A",
    darkInkColor: "#F9FAFB",
    inkSoftColor: "#334155",
    darkInkSoftColor: "#94A3B8",
    accentColor: "#2563EB",
    accentDeepColor: "#1D4ED8",
    cardBg: "#FFFFFF",
    darkCardBg: "#1E293B",
    cardBorder: "border-slate-200/80 shadow-sm",
    neuBg: "#F8FAFC",
    neuInsetBg: "#F1F5F9",
    isDark: false,
    previewColors: ["#0F172A", "#2563EB", "#FFFFFF"],
    bannerGradient: "linear-gradient(135deg, #1E293B 0%, #2563EB 100%)",
    description: "Minimalismo nórdico puro: fondo blanco níveo, bordes precisos de 1px, acento azul cobalto eléctrico y tipografía de máxima nitidez.",
  },
  artisan: {
    id: "artisan",
    name: "Artisan Latte & Terracota",
    subtitle: "Cafetería & Panadería Gourmet",
    tag: "Cálido & Acogedor",
    bgGradient: "from-[#F5EBE1] via-[#FAF5F0] to-[#EBD9C8]",
    darkBgGradient: "from-[#170D07] via-[#241309] to-[#110904]",
    frameBg: "#FAF5F0",
    darkFrameBg: "#1D0F08",
    inkColor: "#4A2810",
    darkInkColor: "#FDF4EE",
    inkSoftColor: "#78350F",
    darkInkSoftColor: "#FBBF24",
    accentColor: "#D97706",
    accentDeepColor: "#B45309",
    cardBg: "#FFFFFF",
    darkCardBg: "#2B160B",
    cardBorder: "border-amber-900/10",
    neuBg: "#FAF5F0",
    neuInsetBg: "#F3ECE4",
    isDark: false,
    previewColors: ["#4A2810", "#D97706", "#FAF5F0"],
    bannerGradient: "linear-gradient(135deg, #451A03 0%, #78350F 50%, #B45309 100%)",
    description: "Ambiente cálido con tonos canela, moca tostado y arcilla. Ideal para restaurantes, bistrós, panaderías y locales artesanales.",
  },
  fintech: {
    id: "fintech",
    name: "Sunset Neo-Fintech",
    subtitle: "Vibrante, Energético y Dinámico",
    tag: "Stripe Style",
    bgGradient: "from-[#F0F4FF] via-[#F8FAFC] to-[#FFE4E6]",
    darkBgGradient: "from-[#120718] via-[#1D0B26] to-[#0D0512]",
    frameBg: "#FAFAFC",
    darkFrameBg: "#170A1E",
    inkColor: "#111827",
    darkInkColor: "#FDF2F8",
    inkSoftColor: "#4B5563",
    darkInkSoftColor: "#F472B6",
    accentColor: "#F43F5E",
    accentDeepColor: "#E11D48",
    cardBg: "#FFFFFF",
    darkCardBg: "#240E30",
    cardBorder: "border-slate-200/80 shadow-md",
    neuBg: "#F1F5F9",
    neuInsetBg: "#E2E8F0",
    isDark: false,
    previewColors: ["#111827", "#F43F5E", "#818CF8"],
    bannerGradient: "linear-gradient(135deg, #4F46E5 0%, #E11D48 100%)",
    description: "Diseño fresco inspirado en aplicaciones fintech modernas con degradados vibrantes coral y azul ultramar, cifras audaces y botones vivos.",
  },
};

interface ThemeContextType {
  theme: ThemeConfig;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  darkModePref: DarkModePreference;
  setDarkModePref: (pref: DarkModePreference) => void;
  isEffectiveDark: boolean;
  systemIsDark: boolean;
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  isThemePickerOpen: boolean;
  setIsThemePickerOpen: (open: boolean) => void;
  calibration: ScreenCalibration;
  setCalibration: (calib: Partial<ScreenCalibration> | ((prev: ScreenCalibration) => ScreenCalibration)) => void;
  resetCalibration: () => void;
  isCalibrationModalOpen: boolean;
  setIsCalibrationModalOpen: (open: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem("cajamaster_theme") as ThemeId;
    return saved && THEMES[saved] ? saved : "emerald";
  });

  const [darkModePref, setDarkModePrefState] = useState<DarkModePreference>(() => {
    const saved = localStorage.getItem("cajamaster_dark_mode_pref") as DarkModePreference;
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(() => {
    const saved = localStorage.getItem("cajamaster_layout") as LayoutMode;
    return saved === "tablet" || saved === "fullscreen" ? saved : "phone";
  });

  const [calibration, setCalibrationState] = useState<ScreenCalibration>(() => {
    try {
      const saved = localStorage.getItem("cajamaster_screen_calibration");
      if (saved) {
        return { ...DEFAULT_SCREEN_CALIBRATION, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn("Failed to load screen calibration", e);
    }
    return DEFAULT_SCREEN_CALIBRATION;
  });

  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  const [isCalibrationModalOpen, setIsCalibrationModalOpen] = useState(false);

  // Listen to OS system color scheme changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handler);
      return () => (mediaQuery as any).removeListener(handler);
    }
  }, []);

  const isEffectiveDark =
    darkModePref === "dark" ? true : darkModePref === "light" ? false : systemIsDark;

  const setThemeId = (id: ThemeId) => {
    setThemeIdState(id);
    localStorage.setItem("cajamaster_theme", id);
  };

  const setDarkModePref = (pref: DarkModePreference) => {
    setDarkModePrefState(pref);
    localStorage.setItem("cajamaster_dark_mode_pref", pref);
  };

  const setLayoutMode = (mode: LayoutMode) => {
    setLayoutModeState(mode);
    localStorage.setItem("cajamaster_layout", mode);
  };

  const setCalibration = (
    updater: Partial<ScreenCalibration> | ((prev: ScreenCalibration) => ScreenCalibration)
  ) => {
    setCalibrationState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      try {
        localStorage.setItem("cajamaster_screen_calibration", JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to save screen calibration", e);
      }
      return next;
    });
  };

  const resetCalibration = () => {
    setCalibrationState(DEFAULT_SCREEN_CALIBRATION);
    try {
      localStorage.removeItem("cajamaster_screen_calibration");
    } catch (e) {
      console.warn("Failed to reset screen calibration", e);
    }
  };

  const baseTheme = THEMES[themeId] || THEMES.emerald;

  const effectiveTheme: ThemeConfig = useMemo(() => {
    return {
      ...baseTheme,
      frameBg: isEffectiveDark ? baseTheme.darkFrameBg : baseTheme.frameBg,
      bgGradient: isEffectiveDark ? baseTheme.darkBgGradient : baseTheme.bgGradient,
      cardBg: isEffectiveDark ? baseTheme.darkCardBg : baseTheme.cardBg,
      inkColor: isEffectiveDark ? baseTheme.darkInkColor : baseTheme.inkColor,
      inkSoftColor: isEffectiveDark ? baseTheme.darkInkSoftColor : baseTheme.inkSoftColor,
      isDark: isEffectiveDark,
    };
  }, [baseTheme, isEffectiveDark]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.style.setProperty("--color-bg", effectiveTheme.frameBg);
    root.style.setProperty("--color-ink", effectiveTheme.inkColor);
    root.style.setProperty("--color-ink-soft", effectiveTheme.inkSoftColor);
    root.style.setProperty("--color-card-bg", effectiveTheme.cardBg);
    root.style.setProperty("--color-gold", effectiveTheme.accentColor);
    root.style.setProperty("--color-gold-deep", effectiveTheme.accentDeepColor);

    // Apply safe area and scaling CSS custom properties
    root.style.setProperty("--app-zoom", `${calibration.zoom}%`);
    root.style.setProperty("--app-safe-top", `${calibration.paddingTop}px`);
    root.style.setProperty("--app-safe-bottom", `${calibration.paddingBottom}px`);
    root.style.setProperty("--app-safe-sides", `${calibration.paddingHorizontal}px`);

    if (isEffectiveDark) {
      root.classList.add("dark");
      root.classList.remove("light");
      body.classList.add("dark-mode");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
      body.classList.remove("dark-mode");
    }
  }, [effectiveTheme, calibration, isEffectiveDark]);

  return (
    <ThemeContext.Provider
      value={{
        theme: effectiveTheme,
        themeId,
        setThemeId,
        darkModePref,
        setDarkModePref,
        isEffectiveDark,
        systemIsDark,
        layoutMode,
        setLayoutMode,
        isThemePickerOpen,
        setIsThemePickerOpen,
        calibration,
        setCalibration,
        resetCalibration,
        isCalibrationModalOpen,
        setIsCalibrationModalOpen,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
