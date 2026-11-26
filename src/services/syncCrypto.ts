/**
 * Encryption of multi-device sync messages.
 *
 * Every device of a business shares the room key (e.g. CM-7KQ4-M9XT). From it, each device
 * derives with PBKDF2-SHA256:
 *   - an AES-256-GCM key: sync messages travel encrypted and authenticated, so only devices
 *     that know the room key can read them or send valid ones;
 *   - a room tag (24 hex chars): the name used on the public servers (MQTT topic, PeerJS id,
 *     local relay room). It does not reveal the room key.
 *
 * Pure JavaScript (@noble), so it also works where WebCrypto is not available (the app opened
 * from a browser over plain http on the local network).
 */
import { pbkdf2Async } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha256";
import { gcm } from "@noble/ciphers/aes";
import { randomBytes } from "@noble/ciphers/webcrypto";

export interface RoomCrypto {
  roomKey: string;
  tag: string;
  key: Uint8Array;
}

export interface SealedBox {
  /** Format version */
  v: 2;
  iv: string;
  d: string;
}

const SALT = new TextEncoder().encode("cajamaster-sync-v2");
const ITERATIONS = 120_000;
/** Letters and digits that are not easily confused (no 0/O, 1/I/L). */
const ROOM_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function normalizeRoomKey(roomKey: string): string {
  return String(roomKey || "").toUpperCase().trim();
}

/** New random room key: CM-XXXX-XXXX (≈ 40 bits). */
export function generateRoomKey(): string {
  const bytes = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
  return `CM-${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Old-style short keys (CM-1234) are easy to guess: the app suggests generating a new one. */
export function isWeakRoomKey(roomKey: string): boolean {
  const k = normalizeRoomKey(roomKey).replace(/^CM-/, "").replace(/[^A-Z0-9]/g, "");
  return k.length < 8;
}

const cache = new Map<string, Promise<RoomCrypto>>();

/** Derives (once per room key) the message key and the public room tag. */
export function getRoomCrypto(roomKey: string): Promise<RoomCrypto> {
  const rk = normalizeRoomKey(roomKey);
  let p = cache.get(rk);
  if (!p) {
    p = (async () => {
      const bits = await pbkdf2Async(sha256, new TextEncoder().encode(rk), SALT, { c: ITERATIONS, dkLen: 64 });
      const key = bits.slice(0, 32);
      const tag = toHex(sha256(bits.slice(32))).slice(0, 24);
      return { roomKey: rk, tag, key };
    })();
    cache.set(rk, p);
  }
  return p;
}

export function sealMessage(rc: RoomCrypto, message: unknown): SealedBox {
  const iv = randomBytes(12);
  const data = new TextEncoder().encode(JSON.stringify(message));
  const ct = gcm(rc.key, iv).encrypt(data);
  return { v: 2, iv: toB64(iv), d: toB64(ct) };
}

/** Returns the original message, or null if it was not sealed with this room key (or was altered). */
export function openMessage(rc: RoomCrypto, box: unknown): any | null {
  try {
    const b = box as SealedBox;
    if (!b || b.v !== 2 || typeof b.iv !== "string" || typeof b.d !== "string") return null;
    const pt = gcm(rc.key, fromB64(b.iv)).decrypt(fromB64(b.d));
    return JSON.parse(new TextDecoder().decode(pt));
  } catch {
    return null;
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function toB64(bytes: Uint8Array): string {
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
