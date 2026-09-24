import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type ThemeId = "emerald" | "cyber-dark" | "nordic" | "artisan" | "fintech";
export type LayoutMode = "phone" | "tablet";

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  subtitle: string;
  tag: string;
  bgGradient: string;
  frameBg: string;
  inkColor: string;
  inkSoftColor: string;
  accentColor: string;
  accentDeepColor: string;
  cardBg: string;
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
    frameBg: "#F1EFE8",
    inkColor: "#0E3A2F",
    inkSoftColor: "#1A4D3F",
    accentColor: "#F5B82E",
    accentDeepColor: "#E8A911",
    cardBg: "#FFFFFF",
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
    frameBg: "#0F172A",
    inkColor: "#F8FAFC",
    inkSoftColor: "#94A3B8",
    accentColor: "#06B6D4",
    accentDeepColor: "#0891B2",
    cardBg: "#1E293B",
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
    frameBg: "#FFFFFF",
    inkColor: "#0F172A",
    inkSoftColor: "#334155",
    accentColor: "#2563EB",
    accentDeepColor: "#1D4ED8",
    cardBg: "#FFFFFF",
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
    frameBg: "#FAF5F0",
    inkColor: "#4A2810",
    inkSoftColor: "#78350F",
    accentColor: "#D97706",
    accentDeepColor: "#B45309",
    cardBg: "#FFFFFF",
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
    frameBg: "#FAFAFC",
    inkColor: "#111827",
    inkSoftColor: "#4B5563",
    accentColor: "#F43F5E",
    accentDeepColor: "#E11D48",
    cardBg: "#FFFFFF",
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
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  isThemePickerOpen: boolean;
  setIsThemePickerOpen: (open: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem("cajamaster_theme") as ThemeId;
    return saved && THEMES[saved] ? saved : "emerald";
  });

  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(() => {
    const saved = localStorage.getItem("cajamaster_layout") as LayoutMode;
    return saved === "tablet" ? "tablet" : "phone";
  });

  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);

  const setThemeId = (id: ThemeId) => {
    setThemeIdState(id);
    localStorage.setItem("cajamaster_theme", id);
  };

  const setLayoutMode = (mode: LayoutMode) => {
    setLayoutModeState(mode);
    localStorage.setItem("cajamaster_layout", mode);
  };

  const theme = THEMES[themeId];

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-bg", theme.frameBg);
    root.style.setProperty("--color-ink", theme.inkColor);
    root.style.setProperty("--color-ink-soft", theme.inkSoftColor);
    root.style.setProperty("--color-gold", theme.accentColor);
    root.style.setProperty("--color-gold-deep", theme.accentDeepColor);

    if (theme.isDark) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeId,
        setThemeId,
        layoutMode,
        setLayoutMode,
        isThemePickerOpen,
        setIsThemePickerOpen,
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
