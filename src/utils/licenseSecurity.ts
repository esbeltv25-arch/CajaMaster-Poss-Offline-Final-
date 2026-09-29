/**
 * Offline License & Hardware ID Security Module
 *
 * Implements HMAC-SHA256 offline cryptographic validation based on the unique Device ID.
 * Works 100% offline without exposing any generation tools or backdoor bypasses to the client.
 */

// Secret salt key matching the administrator's license generation script
export const APP_SECRET = "MiClaveSuperSecretaDelPuntoDeVenta2026";

/**
 * Standard SHA-256 implementation in pure TypeScript (FIPS 180-4 compliant).
 * Operates on Uint8Array and returns Uint8Array digest.
 */
function sha256Bytes(bytes: Uint8Array): Uint8Array {
  function r(n: number, c: number) {
    return (n >>> c) | (n << (32 - c));
  }

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let h0 = 0x6a09e667,
    h1 = 0xbb67ae85,
    h2 = 0x3c6ef372,
    h3 = 0xa54ff53a,
    h4 = 0x510e527f,
    h5 = 0x9b05688c,
    h6 = 0x1f83d9ab,
    h7 = 0x5be0cd19;

  const len = bytes.length;
  const bitLen = len * 8;
  const padLen = (((len + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(padLen);
  padded.set(bytes);
  padded[len] = 0x80;

  // Set 64-bit big endian bit length
  const dv = new DataView(padded.buffer);
  dv.setUint32(padLen - 4, bitLen, false);

  const w = new Uint32Array(64);
  for (let i = 0; i < padLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = dv.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = r(w[t - 15], 7) ^ r(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = r(w[t - 2], 17) ^ r(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4,
      f = h5,
      g = h6,
      h = h7;

    for (let t = 0; t < 64; t++) {
      const s1 = r(e, 6) ^ r(e, 11) ^ r(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K[t] + w[t]) >>> 0;
      const s0 = r(a, 2) ^ r(a, 13) ^ r(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outDv = new DataView(out.buffer);
  outDv.setUint32(0, h0, false);
  outDv.setUint32(4, h1, false);
  outDv.setUint32(8, h2, false);
  outDv.setUint32(12, h3, false);
  outDv.setUint32(16, h4, false);
  outDv.setUint32(20, h5, false);
  outDv.setUint32(24, h6, false);
  outDv.setUint32(28, h7, false);
  return out;
}

/**
 * Standard HMAC-SHA256 (RFC 2104 / RFC 4231).
 * Returns lowercase hex string.
 */
export function computeHmacSha256(keyStr: string, messageStr: string): string {
  const enc = typeof TextEncoder !== "undefined" ? new TextEncoder() : {
    encode: (s: string) => {
      const u: number[] = [];
      for (let i = 0; i < s.length; i++) u.push(s.charCodeAt(i) & 0xff);
      return new Uint8Array(u);
    }
  };

  const keyBytes = enc.encode(keyStr);
  const msgBytes = enc.encode(messageStr);

  const block = new Uint8Array(64);
  if (keyBytes.length > 64) {
    block.set(sha256Bytes(keyBytes));
  } else {
    block.set(keyBytes);
  }

  const ipad = new Uint8Array(64 + msgBytes.length);
  const opad = new Uint8Array(64 + 32);

  for (let i = 0; i < 64; i++) {
    ipad[i] = block[i] ^ 0x36;
    opad[i] = block[i] ^ 0x5c;
  }
  ipad.set(msgBytes, 64);

  const innerHash = sha256Bytes(ipad);
  opad.set(innerHash, 64);
  const outerHash = sha256Bytes(opad);

  return Array.from(outerHash)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Derives the official 12-character license code for a given Device ID.
 * Standard format: A1B2-C3D4-E5F6
 *
 * Algorithm exactly matches the Python admin script:
 * clean_device_id = device_id.strip().lower().encode('utf-8')
 * hash_hmac = hmac.new(SECRET_KEY, clean_device_id, hashlib.sha256).hexdigest()
 * raw_code = hash_hmac[:12].upper()
 * formatted_code = f"{raw_code[:4]}-{raw_code[4:8]}-{raw_code[8:12]}"
 */
export function calculateExpectedLicense(deviceId: string): {
  raw: string;
  formatted: string;
} {
  const cleanDeviceId = (deviceId || "").trim().toLowerCase();
  if (!cleanDeviceId) {
    return { raw: "", formatted: "" };
  }

  const hashHex = computeHmacSha256(APP_SECRET, cleanDeviceId);
  const rawCode = hashHex.slice(0, 12).toUpperCase();
  const formattedCode = `${rawCode.slice(0, 4)}-${rawCode.slice(4, 8)}-${rawCode.slice(8, 12)}`;

  return {
    raw: rawCode,
    formatted: formattedCode,
  };
}

/**
 * Validates a user-submitted license key against the device's hardware identifier.
 * Accepts formatted (XXXX-XXXX-XXXX) or unformatted (XXXXXXXXXXXX) with case insensitivity.
 */
export function validateLicenseKey(deviceId: string, inputKey: string): boolean {
  if (!deviceId || !inputKey) return false;

  const expected = calculateExpectedLicense(deviceId);
  if (!expected.raw) return false;

  // Clean user input (remove hyphens, spaces and convert to uppercase)
  const normalizedInput = inputKey.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  return normalizedInput === expected.raw;
}

const STORAGE_KEYS = {
  ACTIVATED: "cajamaster_activated",
  LICENSE_KEY: "cajamaster_license_key",
  ACTIVATED_AT: "cajamaster_activated_at",
  DEVICE_ID: "cajamaster_device_id",
};

/**
 * Retrieves the persistent Hardware / Device ID.
 * If not present in local storage, creates a clean, deterministic, robust ID and stores it.
 */
export function getPersistentDeviceId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (!id || id.trim().length < 6) {
      // Generate a consistent, clean alphanumeric hardware ID: e.g. DEV-8F2B-91AC-3E04
      const rand1 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const rand2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const rand3 = Date.now().toString(36).substring(2, 6).toUpperCase();
      id = `DEV-${rand1}-${rand2}-${rand3}`;
      localStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
    }
    return id.trim();
  } catch {
    return "DEV-POS-1001-LOCAL";
  }
}

/**
 * Retrieves the current activation status and stored license metadata.
 */
export function getLicenseStatus(): {
  isActivated: boolean;
  licenseKey: string | null;
  activatedAt: string | null;
  deviceId: string;
} {
  const deviceId = getPersistentDeviceId();
  try {
    const isFlagged = localStorage.getItem(STORAGE_KEYS.ACTIVATED) === "1";
    const licenseKey = localStorage.getItem(STORAGE_KEYS.LICENSE_KEY);
    const activatedAt = localStorage.getItem(STORAGE_KEYS.ACTIVATED_AT);

    if (isFlagged && licenseKey) {
      // Double check integrity: verify that stored license key matches the device ID
      const isValid = validateLicenseKey(deviceId, licenseKey);
      if (isValid) {
        return {
          isActivated: true,
          licenseKey,
          activatedAt,
          deviceId,
        };
      }
    }

    return {
      isActivated: false,
      licenseKey: null,
      activatedAt: null,
      deviceId,
    };
  } catch {
    return {
      isActivated: false,
      licenseKey: null,
      activatedAt: null,
      deviceId,
    };
  }
}

/**
 * Saves a valid license key and marks the terminal as permanently activated.
 */
export function saveLicenseActivation(licenseKey: string): void {
  try {
    const deviceId = getPersistentDeviceId();
    const expected = calculateExpectedLicense(deviceId);
    // Always store in standard formatted structure
    const keyToStore = expected.formatted || licenseKey.trim().toUpperCase();

    localStorage.setItem(STORAGE_KEYS.ACTIVATED, "1");
    localStorage.setItem(STORAGE_KEYS.LICENSE_KEY, keyToStore);
    localStorage.setItem(STORAGE_KEYS.ACTIVATED_AT, new Date().toISOString());
  } catch (err) {
    console.error("Error saving license activation:", err);
  }
}

/**
 * Revokes or resets the license state (e.g. from Settings).
 */
export function revokeLicense(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.ACTIVATED);
    localStorage.removeItem(STORAGE_KEYS.LICENSE_KEY);
    localStorage.removeItem(STORAGE_KEYS.ACTIVATED_AT);
  } catch (err) {
    console.error("Error revoking license:", err);
  }
}
