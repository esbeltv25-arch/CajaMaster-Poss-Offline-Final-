/**
 * nativeBridge.ts
 * Unified bridge between CajaMaster POS frontend and Android native capabilities.
 * Communicates with the native CajaNativePlugin on Android (Capacitor),
 * and transparently falls back to browser standard APIs on Web/PWA.
 */

import { registerPlugin, Capacitor } from "@capacitor/core";

export interface NativeShareOptions {
  title?: string;
  text?: string;
  url?: string;
  file?: {
    blob: Blob;
    filename: string;
    mimeType?: string;
  };
  dialogTitle?: string;
}

export interface NativeShareResult {
  success: boolean;
  methodUsed: "nativePlugin" | "webShare" | "downloadFallback" | "clipboardFallback";
  message?: string;
}

export interface SyncServerInfo {
  running: boolean;
  port: number;
  clientCount?: number;
  ip: string;
}

interface CajaNativePluginInterface {
  checkCameraPermission(): Promise<{ granted: boolean }>;
  requestCameraPermission(): Promise<{ granted: boolean }>;
  getLocalIpAddress(): Promise<{ ip: string }>;
  startSyncServer(options?: { port?: number }): Promise<SyncServerInfo>;
  stopSyncServer(): Promise<{ running: boolean }>;
  getSyncServerStatus(): Promise<SyncServerInfo>;
  share(options: {
    title?: string;
    text?: string;
    url?: string;
    base64File?: string;
    filename?: string;
    mimeType?: string;
    dialogTitle?: string;
  }): Promise<{ success: boolean; methodUsed: string }>;
  openExternalUrl(options: { url: string }): Promise<{ success: boolean }>;
  clearAppCache(): Promise<{ success: boolean }>;
}

const CajaNative = registerPlugin<CajaNativePluginInterface>("CajaNative");

export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Checks runtime camera permission directly with Android OS.
 */
export async function checkCameraPermission(): Promise<boolean> {
  if (!isNativePlatform()) {
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      try {
        const res = await navigator.permissions.query({ name: "camera" as any });
        return res.state === "granted";
      } catch {
        return true;
      }
    }
    return true;
  }

  try {
    const res = await CajaNative.checkCameraPermission();
    return !!res.granted;
  } catch (e) {
    console.warn("[nativeBridge] checkCameraPermission error:", e);
    return false;
  }
}

/**
 * Requests runtime camera permission directly through Android OS native dialog.
 */
export async function requestCameraPermission(): Promise<boolean> {
  if (!isNativePlatform()) {
    return true;
  }

  try {
    const res = await CajaNative.requestCameraPermission();
    return !!res.granted;
  } catch (e) {
    console.warn("[nativeBridge] requestCameraPermission error:", e);
    return false;
  }
}

/**
 * Obtains the device's local IPv4 address (e.g. 192.168.x.x) on Wi-Fi or Hotspot.
 */
export async function getLocalIp(): Promise<string> {
  if (!isNativePlatform()) {
    // On web, ask the backend API if available
    try {
      const res = await fetch("/api/sync/network-info");
      if (res.ok) {
        const data = await res.json();
        if (data.recommendedIp) return data.recommendedIp;
        if (data.interfaces && data.interfaces.length > 0) return data.interfaces[0].ip;
      }
    } catch {}
    return "127.0.0.1";
  }

  try {
    const res = await CajaNative.getLocalIpAddress();
    return res.ip || "127.0.0.1";
  } catch (e) {
    console.warn("[nativeBridge] getLocalIp error:", e);
    return "127.0.0.1";
  }
}

/**
 * Starts the embedded Android WebSocket Sync Server on the master device.
 */
export async function startSyncServer(port = 8787): Promise<SyncServerInfo> {
  if (!isNativePlatform()) {
    return {
      running: true,
      port: 3000,
      ip: window.location.hostname || "127.0.0.1",
    };
  }

  try {
    return await CajaNative.startSyncServer({ port });
  } catch (e) {
    console.error("[nativeBridge] startSyncServer error:", e);
    throw e;
  }
}

/**
 * Stops the embedded Android WebSocket Sync Server.
 */
export async function stopSyncServer(): Promise<boolean> {
  if (!isNativePlatform()) return true;
  try {
    const res = await CajaNative.stopSyncServer();
    return !res.running;
  } catch (e) {
    console.warn("[nativeBridge] stopSyncServer error:", e);
    return false;
  }
}

/**
 * Queries the status of the embedded sync server.
 */
export async function getSyncServerStatus(): Promise<SyncServerInfo> {
  if (!isNativePlatform()) {
    return {
      running: true,
      port: 3000,
      clientCount: 1,
      ip: window.location.hostname || "127.0.0.1",
    };
  }

  try {
    return await CajaNative.getSyncServerStatus();
  } catch (e) {
    return { running: false, port: 8787, ip: "127.0.0.1" };
  }
}

/**
 * Converts a Blob to a raw base64 string (without the data:... prefix).
 */
async function blobToBase64Raw(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      const base64 = res.includes(",") ? res.split(",")[1] : res;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Shares text, tickets, or files (PDF, CSV) using Android's native Intent chooser.
 * Never fails silently or gets blocked by WebView restrictions.
 */
export async function nativeShare(options: NativeShareOptions): Promise<NativeShareResult> {
  const { title = "CajaMaster POS", text = "", url, file, dialogTitle = "Compartir con CajaMaster" } = options;

  if (isNativePlatform()) {
    try {
      let base64File: string | undefined = undefined;
      let filename: string | undefined = undefined;
      let mimeType: string | undefined = undefined;

      if (file) {
        base64File = await blobToBase64Raw(file.blob);
        filename = file.filename;
        mimeType = file.mimeType || file.blob.type || "application/octet-stream";
      }

      const res = await CajaNative.share({
        title,
        text: text || undefined,
        url: url || undefined,
        base64File,
        filename,
        mimeType,
        dialogTitle,
      });

      return {
        success: true,
        methodUsed: "nativePlugin",
        message: "¡Compartido con éxito!",
      };
    } catch (e: any) {
      console.warn("[nativeBridge] CajaNative.share failed, trying fallbacks:", e);
    }
  }

  // Web Share API fallback (for desktop or PWA)
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      if (file) {
        const nativeFile = new File([file.blob], file.filename, {
          type: file.mimeType || file.blob.type || "application/octet-stream",
        });

        if (navigator.canShare && navigator.canShare({ files: [nativeFile] })) {
          await navigator.share({
            title,
            text,
            files: [nativeFile],
          });
          return { success: true, methodUsed: "webShare", message: "¡Archivo compartido con éxito!" };
        }
      }

      await navigator.share({
        title,
        text,
        url,
      });
      return { success: true, methodUsed: "webShare", message: "¡Compartido con éxito!" };
    } catch (webErr: any) {
      if (webErr.name === "AbortError") {
        return { success: false, methodUsed: "webShare", message: "Compartir cancelado." };
      }
    }
  }

  // Browser download fallback for files
  if (file) {
    try {
      const blobUrl = URL.createObjectURL(file.blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 1000);

      return {
        success: true,
        methodUsed: "downloadFallback",
        message: `Archivo descargado: ${file.filename}`,
      };
    } catch {}
  }

  // Clipboard fallback for text
  if (text) {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return {
          success: true,
          methodUsed: "clipboardFallback",
          message: "¡Copiado al portapapeles! Puedes pegarlo donde desees.",
        };
      }
    } catch {}
  }

  return {
    success: false,
    methodUsed: "clipboardFallback",
    message: "No se pudo compartir.",
  };
}

/**
 * Universal external URL opener.
 * In Android APK, launches an Android Intent (Intent.ACTION_VIEW) which reliably opens
 * WhatsApp, Telegram, Gmail, phone dialer, or browser.
 * On Web, uses window.open or window.location.href.
 */
export async function openExternalUrl(urlString: string): Promise<boolean> {
  if (!urlString) return false;

  if (isNativePlatform()) {
    try {
      const res = await CajaNative.openExternalUrl({ url: urlString });
      if (res.success) return true;
    } catch (e) {
      console.warn("[nativeBridge] openExternalUrl native error:", e);
    }
  }

  // Web fallback
  try {
    const win = window.open(urlString, "_blank", "noopener,noreferrer");
    if (!win) {
      window.location.href = urlString;
    }
    return true;
  } catch {
    window.location.href = urlString;
    return true;
  }
}

/**
 * Purges native app cache, Webview cache, and clears temporary files.
 */
export async function clearNativeAppCache(): Promise<boolean> {
  if (!isNativePlatform()) return true;
  try {
    const res = await CajaNative.clearAppCache();
    return !!res.success;
  } catch (e) {
    console.warn("[nativeBridge] clearAppCache error:", e);
    return false;
  }
}

/**
 * Universal safe confirmation helper.
 * If running in a WebView or environment where window.confirm() might fail or be disabled,
 * ensures a graceful prompt or fallback without freezing the UI.
 */
export function safeConfirm(message: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.confirm(message);
  } catch (e) {
    console.warn("[nativeBridge] window.confirm error:", e);
    return true;
  }
}
