/**
 * licenseFormat.ts — pure license format + Ed25519 helpers.
 *
 * Shared by the app (verification only) and by the vendor tools
 * (scripts/license.ts and Generador_CajaMaster_POS.html), so the three always
 * agree on the exact format. No Capacitor / browser-only imports here.
 *
 * License text: "CM1-" + Crockford Base32 of [version(1) | expiryDay(2, big-endian) | signature(64)]
 * Signed message: "CAJAMASTER-LIC-v1|<DEVICE_ID>|<expiryDay>"
 * expiryDay = days since 2026-01-01 UTC; 0 = perpetual.
 */
import { ed25519 } from "@noble/curves/ed25519";

export const LICENSE_PREFIX = "CM1-";
export const LICENSE_FORMAT_VERSION = 1;
const MESSAGE_PREFIX = "CAJAMASTER-LIC-v1";
const EPOCH_MS = Date.UTC(2026, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford: no I, L, O, U

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = ((value << 8) | b) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Uint8Array | null {
  const clean = text.toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) return null;
    value = ((value << 5) | idx) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeDeviceId(deviceId: string): string {
  return (deviceId || "").trim().toUpperCase();
}

export function licenseMessage(deviceId: string, expiryDay: number): Uint8Array {
  return new TextEncoder().encode(`${MESSAGE_PREFIX}|${normalizeDeviceId(deviceId)}|${expiryDay}`);
}

/** Day index (UTC, since 2026-01-01) of the LAST valid day of the license. */
export function expiryDayFromDate(date: Date | null): number {
  if (!date) return 0;
  return Math.min(65535, Math.max(1, Math.floor((date.getTime() - EPOCH_MS) / DAY_MS)));
}

/** Exclusive end instant: the license is valid until the end of its last day (UTC). */
export function dateFromExpiryDay(day: number): Date | null {
  return day > 0 ? new Date(EPOCH_MS + (day + 1) * DAY_MS) : null;
}

/** "dd/mm/aaaa" of the last valid day, identical in the app and in the vendor tools. */
export function formatLicenseExpiry(expiresAt: Date | null | undefined): string {
  if (!expiresAt) return "permanente";
  return new Date(expiresAt.getTime() - DAY_MS).toLocaleDateString("es-ES", { timeZone: "UTC" });
}

// ---------------------------------------------------------------------------
// Vendor side: key generation and signing (needs the PRIVATE key)
// ---------------------------------------------------------------------------
export function generateKeyPair(): { privateKeyHex: string; publicKeyHex: string } {
  const priv = ed25519.utils.randomPrivateKey();
  return { privateKeyHex: bytesToHex(priv), publicKeyHex: bytesToHex(ed25519.getPublicKey(priv)) };
}

export function publicKeyFromPrivate(privateKeyHex: string): string {
  return bytesToHex(ed25519.getPublicKey(hexToBytes(privateKeyHex)));
}

/** Creates the license text for one device. expiresAt = null -> perpetual. */
export function createLicense(privateKeyHex: string, deviceId: string, expiresAt: Date | null): string {
  const expiryDay = expiryDayFromDate(expiresAt);
  const sig = ed25519.sign(licenseMessage(deviceId, expiryDay), hexToBytes(privateKeyHex));
  const payload = new Uint8Array(67);
  payload[0] = LICENSE_FORMAT_VERSION;
  payload[1] = (expiryDay >> 8) & 255;
  payload[2] = expiryDay & 255;
  payload.set(sig, 3);
  const body = base32Encode(payload);
  return LICENSE_PREFIX + (body.match(/.{1,6}/g) || []).join("-");
}

// ---------------------------------------------------------------------------
// Verification (app side — only the PUBLIC key)
// ---------------------------------------------------------------------------
export interface LicenseCheck {
  valid: boolean;
  reason?: "empty" | "format" | "signature" | "expired" | "no_public_key";
  expiresAt?: Date | null;
}

export function verifyLicenseWithKey(
  publicKeyHex: string,
  deviceId: string,
  licenseText: string,
  now = Date.now()
): LicenseCheck {
  if (!licenseText || !licenseText.trim()) return { valid: false, reason: "empty" };
  if (!/^[0-9a-fA-F]{64}$/.test(publicKeyHex || "")) return { valid: false, reason: "no_public_key" };

  // Accept spaces, line breaks and dashes (pasted from WhatsApp/Telegram)
  // The body always starts with "0" (version byte 1), so stripping "CM1" is unambiguous
  // even if the dash after it was lost when the text was forwarded.
  let body = licenseText.toUpperCase().replace(/[\s-]+/g, "");
  if (body.startsWith("CM1")) body = body.slice(3);

  const bytes = base32Decode(body);
  if (!bytes || bytes.length < 67 || bytes[0] !== LICENSE_FORMAT_VERSION) {
    return { valid: false, reason: "format" };
  }
  const expiryDay = (bytes[1] << 8) | bytes[2];
  const signature = bytes.slice(3, 67);

  let ok = false;
  try {
    ok = ed25519.verify(signature, licenseMessage(deviceId, expiryDay), hexToBytes(publicKeyHex));
  } catch {
    ok = false;
  }
  if (!ok) return { valid: false, reason: "signature" };

  const expiresAt = dateFromExpiryDay(expiryDay);
  if (expiresAt && now > expiresAt.getTime()) return { valid: false, reason: "expired", expiresAt };
  return { valid: true, expiresAt };
}
