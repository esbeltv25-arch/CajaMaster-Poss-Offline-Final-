/**
 * Keeps the product form safe while the system camera is open.
 *
 * On many Android phones (Samsung especially) the system may close CajaMaster completely
 * while its camera app is in front, to free memory. When the user comes back the app starts
 * from zero: the product form and the photo would be lost.
 *
 * So, right before opening the native camera, the form is saved here. When the app starts
 * again it reopens the form, and the photo taken meanwhile arrives through Capacitor's
 * `appRestoredResult` event (see listenForRestoredCameraPhoto).
 */
import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import type { Product } from "../types";

const DRAFT_KEY = "cajamaster_product_draft_v1";
/** A draft older than this is not reopened. */
const MAX_AGE_MS = 30 * 60_000;

export interface ProductDraft {
  /** Product being edited (undefined = new product). */
  productId?: string;
  fields: Partial<Product>;
  savedAt: number;
}

/** Saves the form right before leaving the app for the camera. */
export function saveProductDraftForCamera(productId: string | undefined, fields: Partial<Product>) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ productId, fields, savedAt: Date.now() } satisfies ProductDraft));
  } catch {
    // storage full: try again without the current photo
    try {
      const { image: _image, ...rest } = fields;
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ productId, fields: rest, savedAt: Date.now() }));
    } catch {
      /* nothing else to do */
    }
  }
}

/** The camera came back normally (the app was not closed): the draft is not needed. */
export function clearProductDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/** Draft left by a camera trip during which Android closed the app (read once at start-up). */
export function takeProductDraft(): ProductDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as ProductDraft;
    if (!d || typeof d.savedAt !== "number" || Date.now() - d.savedAt > MAX_AGE_MS) return null;
    return d;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Photo recovered after the app was restarted
// ---------------------------------------------------------------------------
let restoredPhoto: string | null = null;
const listeners = new Set<() => void>();

/** Photo delivered by Android after restarting the app (null when there is none). */
export function useRestoredCameraPhoto(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => restoredPhoto
  );
}

export function consumeRestoredCameraPhoto() {
  restoredPhoto = null;
  listeners.forEach((l) => l());
}

let listening = false;

/** Call once at start-up: receives the photo of a camera trip that outlived the app. */
export async function listenForRestoredCameraPhoto() {
  if (listening || !Capacitor.isNativePlatform()) return;
  listening = true;
  try {
    const { App } = await import("@capacitor/app");
    await App.addListener("appRestoredResult", (result) => {
      const data = result?.data as { dataUrl?: string } | undefined;
      if (result?.pluginId === "Camera" && result.methodName === "getPhoto" && result.success && data?.dataUrl) {
        restoredPhoto = data.dataUrl;
        listeners.forEach((l) => l());
      }
    });
  } catch (e) {
    console.warn("[productDraft] appRestoredResult no disponible:", e);
  }
}
