import type { CSSProperties } from "react";

export interface AppLogoProps {
  size?: number;
  className?: string;
  variant?: "vector" | "image";
  rounded?: "squircle" | "rounded-xl" | "rounded-2xl" | "rounded-3xl" | "rounded-full" | "rounded-lg" | "none";
  style?: CSSProperties;
}

/**
 * Official Minimalist Application Icon for CajaMaster POS.
 * Palette:
 * - Base Navy: #0F172A / #1E293B
 * - Emerald Green Accent: #10B981
 * - Warm Gold / Amber Accent: #F59E0B
 * - Secondary Details: #F8FAFC & #334155
 */
export function AppLogo({
  size = 40,
  className = "",
  variant = "vector",
  rounded = "rounded-2xl",
  style,
}: AppLogoProps) {
  const roundedClass =
    rounded === "squircle"
      ? "rounded-[22%]"
      : rounded === "rounded-xl"
      ? "rounded-xl"
      : rounded === "rounded-2xl"
      ? "rounded-2xl"
      : rounded === "rounded-3xl"
      ? "rounded-3xl"
      : rounded === "rounded-full"
      ? "rounded-full"
      : rounded === "rounded-lg"
      ? "rounded-lg"
      : "";

  if (variant === "image") {
    return (
      <img
        src="/icon.png"
        alt="CajaMaster POS Logo"
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className={`object-cover shadow-sm select-none ${roundedClass} ${className}`}
        style={{ width: size, height: size, ...style }}
      />
    );
  }

  // Ultra-clean, modern geometric SVG with infinite vector scalability
  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 shadow-sm overflow-hidden select-none ${roundedClass} ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "#0F172A",
        ...style,
      }}
      title="CajaMaster POS"
    >
      <svg
        viewBox="0 0 100 100"
        width="82%"
        height="82%"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Receipt Ticket with Golden Header */}
        <path
          d="M32 14 H68 V38 L62 35 L56 38 L50 35 L44 38 L38 35 L32 38 Z"
          fill="#F8FAFC"
        />
        <rect x="37" y="19" width="26" height="3.5" rx="1.75" fill="#F59E0B" />
        <rect x="37" y="25" width="18" height="2.5" rx="1.25" fill="#94A3B8" />
        <rect x="37" y="30" width="26" height="4" rx="2" fill="#10B981" />

        {/* Terminal Screen & Body */}
        <rect
          x="16"
          y="42"
          width="68"
          height="32"
          rx="7"
          fill="#1E293B"
          stroke="#334155"
          strokeWidth="3"
        />
        {/* Emerald Live Sales Bar on Screen */}
        <rect x="22" y="47" width="56" height="8" rx="3.5" fill="#10B981" />
        
        {/* Keypad & Enter Matrix */}
        <rect x="22" y="59" width="12" height="10" rx="3" fill="#0F172A" />
        <circle cx="28" cy="64" r="2.5" fill="#38BDF8" />

        <rect x="38" y="59" width="12" height="10" rx="3" fill="#0F172A" />
        <circle cx="44" cy="64" r="2.5" fill="#10B981" />

        <rect x="54" y="59" width="24" height="10" rx="3" fill="#F59E0B" />
        <circle cx="66" cy="64" r="2.5" fill="#0F172A" />

        {/* Base Stand & Cash Drawer */}
        <rect x="22" y="76" width="56" height="10" rx="4" fill="#0F172A" />
        <circle cx="68" cy="81" r="2" fill="#F59E0B" />
      </svg>
    </div>
  );
}
