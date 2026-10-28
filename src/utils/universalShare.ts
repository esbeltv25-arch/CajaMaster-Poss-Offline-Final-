/**
 * Universal Native & Web Sharing Helper for CajaMaster POS
 * Handles sharing text, tickets, reports, and binary files (PDF, CSV)
 * across Android APK (via CajaNativePlugin / nativeBridge), PWA, and desktop browsers.
 */

import { nativeShare, openExternalUrl as bridgeOpenExternalUrl, isNativePlatform } from "./nativeBridge";

export interface UniversalShareOptions {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
  file?: {
    blob: Blob;
    filename: string;
    mimeType?: string;
  };
}

export interface UniversalShareResult {
  success: boolean;
  methodUsed: "capacitorShare" | "webShare" | "appLink" | "clipboardFallback" | "nativePlugin" | "downloadFallback";
  message?: string;
}

export { isNativePlatform };

/**
 * Shares text or files universally.
 * 1. Checks and uses native Android Intent chooser via nativeBridge if running in native APK
 * 2. Falls back to Web Share API (navigator.share)
 * 3. Falls back to downloading or copying to clipboard
 */
export async function universalShare(options: UniversalShareOptions): Promise<UniversalShareResult> {
  const result = await nativeShare({
    title: options.title || "CajaMaster POS",
    text: options.text || "",
    url: options.url,
    file: options.file,
    dialogTitle: options.dialogTitle || "Compartir con CajaMaster",
  });

  return {
    success: result.success,
    methodUsed: result.methodUsed,
    message: result.message,
  };
}

/**
 * Universal WhatsApp opener that works reliably in WebView, APK, and Desktop.
 * In Android APK, launches native Intent directly to prevent WebView pop-up block.
 */
export function openWhatsAppUniversal(text: string, phone = ""): void {
  const cleanPhone = phone ? phone.replace(/\D/g, "") : "";
  const encodedText = encodeURIComponent(text);
  
  const targetUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  bridgeOpenExternalUrl(targetUrl);
}

/**
 * Universal Telegram opener that works reliably in WebView, APK, and Desktop.
 */
export function openTelegramUniversal(text: string): void {
  const encodedText = encodeURIComponent(text);
  const targetUrl = `https://t.me/share/url?text=${encodedText}`;

  bridgeOpenExternalUrl(targetUrl);
}
