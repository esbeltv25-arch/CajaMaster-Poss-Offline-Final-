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
 * Consistent layout color palette:
 * - Base Slate / Navy: #0F172A & #1E293B
 * - Emerald Green: #10B981 & #34D399 (Sales, Balance, Checkout)
 * - Amber / Gold: #F59E0B & #FCD34D (Revenue, Hardware, Value)
 * - Sky Cyan: #38BDF8
 * - Clean White / Soft Slate: #FFFFFF & #94A3B8
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

  // Ultra-clean, modern geometric SVG with vector scalability
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
        <defs>
          <linearGradient id="logoEmeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
          <linearGradient id="logoGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>

        {/* 1. Ticket / Receipt emerging upwards */}
        <path
          d="M32 14 H68 V38 L62 35 L56 38 L50 35 L44 38 L38 35 L32 38 Z"
          fill="#F8FAFC"
        />
        {/* Ticket Amber Header */}
        <rect x="36" y="19" width="22" height="3.5" rx="1.75" fill="url(#logoGoldGrad)" />
        <circle cx="62" cy="20.75" r="1.75" fill="url(#logoGoldGrad)" />
        {/* Ticket Item Stripe */}
        <rect x="36" y="24.5" width="28" height="2.5" rx="1.25" fill="#94A3B8" />
        {/* Ticket Emerald Total */}
        <rect x="36" y="29" width="28" height="4.5" rx="2.25" fill="url(#logoEmeraldGrad)" />

        {/* 2. Main POS Register Screen & Body */}
        <rect
          x="14"
          y="42"
          width="72"
          height="32"
          rx="7"
          fill="#1E293B"
          stroke="#334155"
          strokeWidth="2.5"
        />
        {/* Emerald Header Status Bar on Screen */}
        <rect x="20" y="47" width="60" height="7" rx="3" fill="url(#logoEmeraldGrad)" />
        <circle cx="24" cy="50.5" r="1.5" fill="#FFFFFF" />
        <rect x="28" y="49" width="16" height="3" rx="1.5" fill="#FFFFFF" opacity="0.9" />
        <circle cx="75" cy="50.5" r="1.5" fill="url(#logoGoldGrad)" />

        {/* Minimalist Keypad & Pay Action Indicators */}
        <rect x="20" y="57" width="12" height="11" rx="3" fill="#0F172A" />
        <circle cx="26" cy="62.5" r="2.5" fill="#38BDF8" />

        <rect x="35" y="57" width="12" height="11" rx="3" fill="#0F172A" />
        <circle cx="41" cy="62.5" r="2.5" fill="url(#logoGoldGrad)" />

        <rect x="50" y="57" width="30" height="11" rx="3" fill="url(#logoEmeraldGrad)" />
        {/* Checkmark inside Pay button */}
        <path
          d="M62 62.5 L65 65.5 L72 59.5"
          stroke="#FFFFFF"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 3. Base Platform & Cash Drawer */}
        <rect x="18" y="76" width="64" height="10" rx="4" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />
        <rect x="32" y="79.5" width="26" height="3" rx="1.5" fill="#1E293B" />
        <circle cx="68" cy="81" r="2" fill="url(#logoGoldGrad)" />
      </svg>
    </div>
  );
}
