/**
 * Users (sellers / administrators) and work shifts.
 *
 * - Optional: while no user exists the app works as before (no PIN screen).
 * - Each user has a 4–6 digit PIN, stored only as a salted SHA-256 hash.
 * - The active shift (who is working now) signs sales, stock movements and
 *   the Z closing. Closing the Z ends the shift and asks for the next user.
 * - Stored per device (localStorage); not shared through multi-device sync.
 */
import { useSyncExternalStore } from "react";
import { sha256 } from "@noble/hashes/sha256";

export type UserRole = "admin" | "seller";

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
  pinHash: string;
  salt: string;
  createdAt: number;
}

export interface ShiftSession {
  userId: string;
  userName: string;
  role: UserRole;
  startedAt: number;
}

const USERS_KEY = "cajamaster_users_v1";
const SESSION_KEY = "cajamaster_session_v1";
const LOCK_SETTINGS_KEY = "cajamaster_lock_settings_v1";
const LOCKED_KEY = "cajamaster_locked_v1";
const ACTIVITY_KEY = "cajamaster_last_activity_v1";

/**
 * Screen lock (extra security). The shift stays open while locked: only the
 * seller on shift (or an administrator) can unlock it with their PIN.
 * - lockOnOpen: ask for the PIN when the app is opened, or when it comes back
 *   after more than BACKGROUND_GRACE_MS in the background.
 * - autoLockMinutes: lock after that many minutes without touching the screen (0 = off).
 */
export interface LockSettings {
  lockOnOpen: boolean;
  autoLockMinutes: number;
}
export const AUTO_LOCK_MAX_MINUTES = 240;
const BACKGROUND_GRACE_MS = 30_000;

export const ROLE_LABELS: Record<UserRole, string> = { admin: "Administrador", seller: "Vendedor" };

const listeners = new Set<() => void>();
let snapshot: { users: AppUser[]; session: ShiftSession | null; locked: boolean; lock: LockSettings } = initialSnapshot();

function initialSnapshot() {
  const users = readUsers();
  const session = readSession();
  const lock = readLockSettings();
  let locked = false;
  if (session && users.length > 0) {
    // Stays locked if the app was closed while locked
    locked = localStorage.getItem(LOCKED_KEY) === "1";
    // Opening the app
    if (lock.lockOnOpen) locked = true;
    // Closing and reopening the app does not skip the inactivity timer
    const last = Number(localStorage.getItem(ACTIVITY_KEY) || 0);
    if (lock.autoLockMinutes > 0 && last > 0 && Date.now() - last >= lock.autoLockMinutes * 60_000) locked = true;
  }
  return { users, session, locked, lock };
}

function readLockSettings(): LockSettings {
  try {
    const v = JSON.parse(localStorage.getItem(LOCK_SETTINGS_KEY) || "{}");
    return {
      lockOnOpen: v.lockOnOpen === true,
      autoLockMinutes: clampMinutes(Number(v.autoLockMinutes) || 0),
    };
  } catch {
    return { lockOnOpen: false, autoLockMinutes: 0 };
  }
}

function clampMinutes(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(AUTO_LOCK_MAX_MINUTES, Math.max(1, Math.round(n)));
}

function readUsers(): AppUser[] {
  try {
    const v = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function readSession(): ShiftSession | null {
  try {
    const v = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return v && v.userId ? v : null;
  } catch {
    return null;
  }
}

function commit(
  users: AppUser[],
  session: ShiftSession | null,
  locked: boolean = snapshot.locked,
  lock: LockSettings = snapshot.lock
) {
  // Without an open shift there is nothing to lock
  if (!session || users.length === 0) locked = false;
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
    if (locked) localStorage.setItem(LOCKED_KEY, "1");
    else localStorage.removeItem(LOCKED_KEY);
    localStorage.setItem(LOCK_SETTINGS_KEY, JSON.stringify(lock));
  } catch {}
  snapshot = { users, session, locked, lock };
  listeners.forEach((l) => l());
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hashPin(pin: string, salt: string): string {
  return toHex(sha256(new TextEncoder().encode(`cajamaster-pin|${salt}|${pin}`)));
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
export function getUsers(): AppUser[] {
  return snapshot.users;
}

export function usersEnabled(): boolean {
  return snapshot.users.length > 0;
}

export function getSession(): ShiftSession | null {
  // A session whose user was deleted is not valid
  const s = snapshot.session;
  if (s && !snapshot.users.some((u) => u.id === s.userId)) return null;
  return s;
}

/** Name to sign actions with: the active user, or the given fallback. */
export function currentUserName(fallback: string): string {
  return getSession()?.userName || fallback;
}

export function isAdminSession(): boolean {
  // Without users everyone acts as administrator (previous behaviour)
  if (!usersEnabled()) return true;
  return getSession()?.role === "admin";
}

/** React hook: re-renders when users or the active shift change. */
export function useUserSession() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot
  );
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
export function createUser(input: { name: string; role: UserRole; pin: string }): { ok: boolean; error?: string; user?: AppUser } {
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "Escribe el nombre (mínimo 2 letras)." };
  if (!isValidPin(input.pin)) return { ok: false, error: "El PIN debe tener entre 4 y 6 números." };
  const users = getUsers();
  if (users.some((u) => u.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: "Ya existe un usuario con ese nombre." };
  }
  // The first user is always an administrator, so nobody gets locked out
  const role: UserRole = users.length === 0 ? "admin" : input.role;
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = toHex(saltBytes);
  const user: AppUser = {
    id: "usr_" + Date.now().toString(36) + "_" + toHex(saltBytes.slice(0, 3)),
    name,
    role,
    salt,
    pinHash: hashPin(input.pin, salt),
    createdAt: Date.now(),
  };
  const next = [...users, user];
  // Creating the first user starts their shift right away
  commit(next, users.length === 0 ? sessionFor(user) : snapshot.session);
  return { ok: true, user };
}

export function deleteUser(id: string): { ok: boolean; error?: string } {
  const users = getUsers();
  const target = users.find((u) => u.id === id);
  if (!target) return { ok: false, error: "Usuario no encontrado." };
  const admins = users.filter((u) => u.role === "admin");
  if (target.role === "admin" && admins.length === 1 && users.length > 1) {
    return { ok: false, error: "No puedes borrar el único administrador mientras existan otros usuarios." };
  }
  const next = users.filter((u) => u.id !== id);
  const session = snapshot.session?.userId === id ? null : snapshot.session;
  commit(next, session);
  return { ok: true };
}

export function changePin(id: string, pin: string): { ok: boolean; error?: string } {
  if (!isValidPin(pin)) return { ok: false, error: "El PIN debe tener entre 4 y 6 números." };
  const next = getUsers().map((u) => (u.id === id ? { ...u, pinHash: hashPin(pin, u.salt) } : u));
  commit(next, snapshot.session);
  return { ok: true };
}

export function verifyPin(user: AppUser, pin: string): boolean {
  return hashPin(pin, user.salt) === user.pinHash;
}

function sessionFor(user: AppUser): ShiftSession {
  return { userId: user.id, userName: user.name, role: user.role, startedAt: Date.now() };
}

/** Starts the shift of `userId` if the PIN is correct. */
export function startShift(userId: string, pin: string): { ok: boolean; error?: string } {
  const user = getUsers().find((u) => u.id === userId);
  if (!user) return { ok: false, error: "Usuario no encontrado." };
  if (!verifyPin(user, pin)) return { ok: false, error: "PIN incorrecto." };
  commit(getUsers(), sessionFor(user), false);
  markActivity(true);
  return { ok: true };
}

/** Ends the active shift (the PIN screen appears again). */
export function endShift() {
  commit(getUsers(), null, false);
}

// ---------------------------------------------------------------------------
// Screen lock
// ---------------------------------------------------------------------------
export function getLockSettings(): LockSettings {
  return snapshot.lock;
}

export function saveLockSettings(next: Partial<LockSettings>): LockSettings {
  const lock: LockSettings = {
    lockOnOpen: next.lockOnOpen ?? snapshot.lock.lockOnOpen,
    autoLockMinutes: clampMinutes(next.autoLockMinutes ?? snapshot.lock.autoLockMinutes),
  };
  commit(snapshot.users, snapshot.session, snapshot.locked, lock);
  markActivity(true);
  return lock;
}

export function isLocked(): boolean {
  return snapshot.locked && Boolean(getSession());
}

/** Locks the screen keeping the shift open (manual "Bloquear" button or timers). */
export function lockNow() {
  if (!getSession()) return;
  commit(snapshot.users, snapshot.session, true);
}

/** Unlocks with the PIN of the user on shift or of any administrator. */
export function unlockShift(pin: string): { ok: boolean; error?: string } {
  const session = getSession();
  if (!session) return { ok: true };
  const allowed = getUsers().filter((u) => u.id === session.userId || u.role === "admin");
  if (!allowed.some((u) => verifyPin(u, pin))) {
    return { ok: false, error: `PIN incorrecto. Usa el PIN de ${session.userName} o de un administrador.` };
  }
  commit(snapshot.users, snapshot.session, false);
  markActivity(true);
  return { ok: true };
}

let lastActivity = 0;
let lastActivitySaved = 0;
/** Until when leaving the app is expected (camera, file picker) and must not lock it. */
let outsideAllowedUntil = 0;

/**
 * Call right before opening another app on purpose (system camera, photo picker):
 * coming back within `maxMinutes` does not lock the screen and counts as activity.
 */
export function allowLeavingApp(maxMinutes = 10) {
  outsideAllowedUntil = Date.now() + maxMinutes * 60_000;
  markActivity(true);
}

/** The camera / picker came back: normal locking rules apply again. */
export function leftAppDone() {
  outsideAllowedUntil = 0;
  markActivity(true);
}

function saveActivity() {
  lastActivitySaved = Date.now();
  try {
    localStorage.setItem(ACTIVITY_KEY, String(lastActivity));
  } catch {}
}

/** Records a touch on the screen (the inactivity timer starts again). */
function markActivity(force = false) {
  lastActivity = Date.now();
  // Persist at most every 10 s (touch events are frequent)
  if (force || lastActivity - lastActivitySaved > 10_000) saveActivity();
}

/**
 * Starts watching screen activity for the automatic lock. Call once (App).
 * Returns a cleanup function.
 */
export function startLockWatcher(): () => void {
  // Keep counting from the last real touch: closing and reopening the app does not reset the timer
  if (!lastActivity) {
    const stored = Number(localStorage.getItem(ACTIVITY_KEY) || 0);
    if (stored > 0 && stored <= Date.now()) lastActivity = stored;
    else markActivity(true);
  }
  let hiddenAt = 0;
  const onActivity = () => {
    // Touching the app again ends a camera / picker exception that never reported back (cancelled)
    outsideAllowedUntil = 0;
    if (!snapshot.locked) markActivity();
  };
  const check = () => {
    if (snapshot.locked || !getSession() || Date.now() < outsideAllowedUntil) return;
    const mins = snapshot.lock.autoLockMinutes;
    if (mins > 0 && Date.now() - lastActivity >= mins * 60_000) lockNow();
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      saveActivity();
      return;
    }
    const away = hiddenAt ? Date.now() - hiddenAt : 0;
    hiddenAt = 0;
    if (Date.now() < outsideAllowedUntil) {
      // Back from the camera or the photo picker opened by the app itself (one time only)
      outsideAllowedUntil = 0;
      markActivity(true);
      return;
    }
    if (snapshot.lock.lockOnOpen && away >= BACKGROUND_GRACE_MS) lockNow();
    else check();
  };
  const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
  events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
  document.addEventListener("visibilitychange", onVisibility);
  const timer = window.setInterval(check, 15_000);
  return () => {
    events.forEach((e) => window.removeEventListener(e, onActivity));
    document.removeEventListener("visibilitychange", onVisibility);
    window.clearInterval(timer);
  };
}
