/**
 * licenseSecurity.ts — CajaMaster POS licensing (offline, digital signatures).
 *
 * How it works
 * ------------
 * - The vendor owns an Ed25519 KEY PAIR. The PRIVATE key never leaves the vendor's
 *   computer (scripts/license.mjs / Generador_CajaMaster_POS.html). Only the PUBLIC
 *   key is compiled into the app (licensePublicKey.ts).
 * - A license is a signature of "CAJAMASTER-LIC-v1|<DEVICE_ID>|<EXPIRY_DAY>" made with
 *   the private key. The app verifies it with the public key, 100% offline.
 * - Knowing the public key does NOT allow creating licenses, so inspecting or
 *   decompiling the APK no longer gives anyone a key generator.
 *
 * License text format: "CM1-" + Crockford Base32 of [version(1) | expiryDay(2) | signature(64)]
 * expiryDay = days since 2026-01-01 (UTC); 0 = perpetual license.
 */

import { sha256 } from "@noble/hashes/sha256";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { LICENSE_PUBLIC_KEY_HEX } from "./licensePublicKey";
import { base32Encode, verifyLicenseWithKey, formatLicenseExpiry, type LicenseCheck } from "./licenseFormat";

export type { LicenseCheck } from "./licenseFormat";
export { LICENSE_PREFIX, formatLicenseExpiry } from "./licenseFormat";

const STORAGE_KEYS = {
  ACTIVATED: "cajamaster_activated",
  LICENSE_KEY: "cajamaster_license_key",
  ACTIVATED_AT: "cajamaster_activated_at",
  DEVICE_ID: "cajamaster_device_id",
};

export function isPublicKeyConfigured(): boolean {
  return /^[0-9a-fA-F]{64}$/.test(LICENSE_PUBLIC_KEY_HEX);
}

/** Verifies a license against the public key compiled into this app. */
export function verifyLicense(deviceId: string, licenseText: string, now = Date.now()): LicenseCheck {
  return verifyLicenseWithKey(LICENSE_PUBLIC_KEY_HEX, deviceId, licenseText, now);
}

/** Backwards-compatible boolean helper. */
export function validateLicenseKey(deviceId: string, inputKey: string): boolean {
  return verifyLicense(deviceId, inputKey).valid;
}

export function licenseErrorMessage(check: LicenseCheck): string {
  switch (check.reason) {
    case "empty":
      return "Escribe o pega la licencia que te envió el proveedor.";
    case "format":
      return "La licencia está incompleta o mal copiada. Cópiala entera (empieza por CM1-) y vuelve a pegarla.";
    case "signature":
      return "Licencia no válida para este dispositivo. Comprueba que enviaste el ID correcto al proveedor.";
    case "expired":
      return `La licencia caducó el ${formatLicenseExpiry(check.expiresAt)}. Solicita una renovación.`;
    case "no_public_key":
      return "Esta compilación no tiene configurada la clave pública de licencias (ver README-CONTROL-LICENCIAS.md).";
    default:
      return "Licencia no válida.";
  }
}

// ---------------------------------------------------------------------------
// Device identity
// ---------------------------------------------------------------------------
const CajaNativeId = registerPlugin<{ getHardwareId(): Promise<{ id: string }> }>("CajaNative");

function deriveDeviceId(seed: string): string {
  const digest = sha256(new TextEncoder().encode("cajamaster-device|" + seed));
  const code = base32Encode(digest).slice(0, 12);
  return `CM-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

/**
 * Must run once before the app renders.
 * On Android the ID is derived from the hardware/app identifier (Settings.Secure.ANDROID_ID):
 * it survives clearing data and reinstalling, and copying the app data to another phone
 * does not move the license.
 */
export async function initDeviceIdentity(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await CajaNativeId.getHardwareId();
      if (res?.id && res.id.length >= 8) {
        const id = deriveDeviceId("android|" + res.id);
        localStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
        return id;
      }
    } catch (e) {
      // APK built before getHardwareId existed: fall back to the stored random ID
      console.warn("[license] getHardwareId not available, using stored ID", e);
    }
  }
  return getPersistentDeviceId();
}

/**
 * Retrieves the persistent Device ID (hardware-based on Android once initDeviceIdentity ran,
 * random and stored on Web/PWA).
 */
export function getPersistentDeviceId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (!id || id.trim().length < 6) {
      const rnd = new Uint8Array(16);
      crypto.getRandomValues(rnd);
      id = deriveDeviceId("web|" + base32Encode(rnd));
      localStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
    }
    return id.trim();
  } catch {
    return "CM-WEB0-0000-0000";
  }
}

/**
 * Clock high-water mark: setting the phone date backwards does not extend a
 * license with an expiry date (the latest time ever seen is used instead).
 */
function trustedNow(): number {
  const KEY = "cajamaster_clock_hw";
  const now = Date.now();
  try {
    const seen = Number(localStorage.getItem(KEY)) || 0;
    const trusted = Math.max(now, seen);
    if (trusted !== seen) localStorage.setItem(KEY, String(trusted));
    return trusted;
  } catch {
    return now;
  }
}

// ---------------------------------------------------------------------------
// Activation state
// ---------------------------------------------------------------------------
export function getLicenseStatus(): {
  isActivated: boolean;
  licenseKey: string | null;
  activatedAt: string | null;
  expiresAt: Date | null;
  deviceId: string;
  reason?: LicenseCheck["reason"];
} {
  const deviceId = getPersistentDeviceId();
  try {
    const licenseKey = localStorage.getItem(STORAGE_KEYS.LICENSE_KEY);
    const activatedAt = localStorage.getItem(STORAGE_KEYS.ACTIVATED_AT);
    if (licenseKey) {
      // The stored flag alone is never trusted: the signature is re-verified on every start.
      const check = verifyLicense(deviceId, licenseKey, trustedNow());
      if (check.valid) {
        return { isActivated: true, licenseKey, activatedAt, expiresAt: check.expiresAt ?? null, deviceId };
      }
      return { isActivated: false, licenseKey: null, activatedAt: null, expiresAt: check.expiresAt ?? null, deviceId, reason: check.reason };
    }
  } catch {
    // fall through
  }
  return { isActivated: false, licenseKey: null, activatedAt: null, expiresAt: null, deviceId };
}

/** Verifies and stores a license. Returns the verification result. */
export function saveLicenseActivation(licenseKey: string): LicenseCheck {
  const check = verifyLicense(getPersistentDeviceId(), licenseKey);
  if (!check.valid) return check;
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVATED, "1");
    localStorage.setItem(STORAGE_KEYS.LICENSE_KEY, licenseKey.trim().toUpperCase().replace(/\s+/g, ""));
    localStorage.setItem(STORAGE_KEYS.ACTIVATED_AT, new Date().toISOString());
  } catch (err) {
    console.error("Error saving license activation:", err);
  }
  return check;
}

export function revokeLicense(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.ACTIVATED);
    localStorage.removeItem(STORAGE_KEYS.LICENSE_KEY);
    localStorage.removeItem(STORAGE_KEYS.ACTIVATED_AT);
  } catch (err) {
    console.error("Error revoking license:", err);
  }
}
