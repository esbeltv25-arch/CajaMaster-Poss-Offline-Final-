import type { Product } from "../types";

export interface NotificationSettings {
  enabled: boolean;
  systemPush: boolean;
  sound: boolean;
  vibration: boolean;
  defaultThreshold: number;
}

const SETTINGS_KEY = "cajamaster_notif_config";

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  systemPush: false,
  sound: true,
  vibration: true,
  defaultThreshold: 5,
};

export function getNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error("Error saving notification settings", err);
  }
}

// In-App Toast Alert Subscriptions
export interface InAppAlert {
  id: string;
  type: "low_stock" | "out_of_stock" | "test";
  title: string;
  message: string;
  product?: Product;
  ts: number;
}

type AlertListener = (alert: InAppAlert) => void;
const alertListeners = new Set<AlertListener>();

export function subscribeToInAppAlerts(listener: AlertListener): () => void {
  alertListeners.add(listener);
  return () => alertListeners.delete(listener);
}

export function emitInAppAlert(alert: InAppAlert): void {
  alertListeners.forEach((fn) => {
    try {
      fn(alert);
    } catch (e) {
      console.error("Error invoking alert listener", e);
    }
  });
}

let lastSoundPlayedAt = 0;
let sharedAudioCtx: AudioContext | null = null;

// Web Audio synthesizer for alert sound (works completely offline and throttled)
export function playAlertSound(): void {
  try {
    const now = Date.now();
    if (now - lastSoundPlayedAt < 800) return; // throttle sounds
    lastSoundPlayedAt = now;

    setTimeout(() => {
      try {
        if (typeof window === "undefined") return;
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;

        if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
          sharedAudioCtx = new AudioCtx();
        }

        if (sharedAudioCtx.state === "suspended") {
          sharedAudioCtx.resume().catch(() => {});
        }

        const ctx = sharedAudioCtx;
        if (!ctx || ctx.state === "closed") return;

        const curTime = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, curTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, curTime + 0.12); // A5

        gain.gain.setValueAtTime(0.01, curTime);
        gain.gain.linearRampToValueAtTime(0.25, curTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, curTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(curTime);
        osc.stop(curTime + 0.35);
      } catch (err) {
        // Safe catch for iframe security restrictions
      }
    }, 10);
  } catch (err) {
    // Safe catch
  }
}

// Vibration for Mobile Devices
export function vibrateAlert(): void {
  try {
    if (typeof window !== "undefined" && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([80, 40, 100]);
    }
  } catch {
    // Ignore vibration errors
  }
}

// Request Browser Push Notification Permission
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  try {
    const permission = await Notification.requestPermission();
    const current = getNotificationSettings();
    saveNotificationSettings({
      ...current,
      systemPush: permission === "granted",
    });
    return permission;
  } catch (err) {
    console.warn("Notification permission error", err);
    return "denied";
  }
}

// Check current browser permission status
export function getPushPermissionStatus(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

// Send system notification
export function sendSystemNotification(title: string, body: string, icon = "/favicon.ico"): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const notif = new Notification(title, {
      body,
      icon,
      badge: icon,
      tag: "stock-alert-" + Date.now(),
      requireInteraction: false,
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  } catch (err) {
    console.warn("Error sending native notification", err);
  }
}

// Notify single product threshold breach
export function notifyProductLowStock(product: Product): void {
  try {
    const settings = getNotificationSettings();
    if (!settings.enabled) return;

    const isOut = product.stock <= 0;
    const title = isOut
      ? `🚨 Producto Agotado: ${product.name}`
      : `⚠️ Stock Crítico: ${product.name}`;
    const message = isOut
      ? `Quedan 0 ${product.unit}. ¡Se requiere reposición urgente!`
      : `Quedan sólo ${product.stock} ${product.unit} (umbral: ${product.lowStockAlert} ${product.unit}).`;

    // 1. Emit In-App Toast Banner
    emitInAppAlert({
      id: "alert_" + product.id + "_" + Date.now(),
      type: isOut ? "out_of_stock" : "low_stock",
      title,
      message,
      product,
      ts: Date.now(),
    });

    // 2. Play Sound if enabled
    if (settings.sound) {
      playAlertSound();
    }

    // 3. Vibrate if enabled
    if (settings.vibration) {
      vibrateAlert();
    }

    // 4. System Push Notification if enabled & granted
    if (settings.systemPush && typeof Notification !== "undefined" && Notification.permission === "granted") {
      sendSystemNotification(title, message, product.image);
    }
  } catch (err) {
    // Non-blocking catch
  }
}

// Check array of products for newly breached thresholds after sales or adjustments
export function checkAndNotifyStockBreaches(
  prevProducts: Product[],
  currentProducts: Product[]
): void {
  try {
    const settings = getNotificationSettings();
    if (!settings.enabled) return;

    currentProducts.forEach((curr) => {
      const prev = prevProducts.find((p) => p.id === curr.id);
      if (!prev) return;

      const threshold = curr.lowStockAlert ?? settings.defaultThreshold;

      // Trigger alert if stock decreased AND crossed into <= threshold or reached 0
      const wasAbove = prev.stock > threshold;
      const isNowLow = curr.stock <= threshold;
      const reachedZero = prev.stock > 0 && curr.stock <= 0;

      if (reachedZero || (wasAbove && isNowLow)) {
        notifyProductLowStock(curr);
      }
    });
  } catch (err) {
    // Non-blocking catch
  }
}
