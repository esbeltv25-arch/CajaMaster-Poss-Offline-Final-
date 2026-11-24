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

export const ROLE_LABELS: Record<UserRole, string> = { admin: "Administrador", seller: "Vendedor" };

const listeners = new Set<() => void>();
let snapshot: { users: AppUser[]; session: ShiftSession | null } = { users: readUsers(), session: readSession() };

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

function commit(users: AppUser[], session: ShiftSession | null) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
  snapshot = { users, session };
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
  commit(getUsers(), sessionFor(user));
  return { ok: true };
}

/** Ends the active shift (the PIN screen appears again). */
export function endShift() {
  commit(getUsers(), null);
}
