import { useState } from "react";
import { NumericInput } from "./NumericInput";
import {
  useUserSession,
  createUser,
  deleteUser,
  changePin,
  endShift,
  lockNow,
  saveLockSettings,
  AUTO_LOCK_MAX_MINUTES,
  isAdminSession,
  ROLE_LABELS,
  type UserRole,
} from "../services/userSession";

/**
 * Ajustes → Usuarios y turnos. Optional: without users the app works as before.
 * Only an administrator can create, delete users or change PINs.
 */
export function UsersCard() {
  const { users, session, lock } = useUserSession();
  const canManage = isAdminSession();
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("seller");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [newPin, setNewPin] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  const handleCreate = () => {
    if (pin !== pin2) return flash("Los dos PIN no coinciden.", false);
    const res = createUser({ name, role, pin });
    if (!res.ok) return flash(res.error || "No se pudo crear.", false);
    setName("");
    setPin("");
    setPin2("");
    setRole("seller");
    flash(
      users.length === 0
        ? `✓ ${res.user!.name} creado como Administrador. Su turno ya está abierto.`
        : `✓ Usuario ${res.user!.name} creado.`,
      true
    );
  };

  const input = "w-full neu-inset rounded-xl px-3 h-10 text-xs font-bold bg-transparent outline-none";

  return (
    <div className="card p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3 shadow-xs" id="card-users">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">👤</div>
        <div className="min-w-0">
          <h3 className="font-extrabold text-sm text-slate-900">Usuarios y turnos</h3>
          <p className="text-[11px] text-slate-500 leading-snug">
            Cada vendedor entra con su PIN. Las ventas y el cierre de caja quedan a su nombre.
          </p>
        </div>
      </div>

      {session && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white border border-slate-200 p-3">
          <span className="text-xs text-slate-700">
            Turno abierto: <b>{session.userName}</b> ({ROLE_LABELS[session.role]}) desde{" "}
            {new Date(session.startedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            type="button"
            id="btn-end-shift"
            onClick={endShift}
            className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-extrabold cursor-pointer"
          >
            Cambiar de usuario
          </button>
        </div>
      )}

      {users.length > 0 && (
        <div className="space-y-1.5">
          {users.map((u) => (
            <div key={u.id} className="rounded-2xl bg-white border border-slate-200 p-2.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-slate-900">
                  {u.name} <span className="font-semibold text-slate-500">· {ROLE_LABELS[u.role]}</span>
                </span>
                {canManage && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPinFor(pinFor === u.id ? null : u.id);
                        setNewPin("");
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-bold cursor-pointer"
                    >
                      Cambiar PIN
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`¿Eliminar el usuario ${u.name}?`)) return;
                        const r = deleteUser(u.id);
                        flash(r.ok ? `Usuario ${u.name} eliminado.` : r.error || "No se pudo eliminar.", r.ok);
                      }}
                      className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 text-[11px] font-bold cursor-pointer"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
              {pinFor === u.id && (
                <div className="flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Nuevo PIN (4-6 números)"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    className={input}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const r = changePin(u.id, newPin);
                      flash(r.ok ? "✓ PIN actualizado." : r.error || "Error", r.ok);
                      if (r.ok) setPinFor(null);
                    }}
                    className="px-3 rounded-xl bg-slate-900 text-white text-xs font-extrabold cursor-pointer shrink-0"
                  >
                    Guardar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {users.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 p-3 space-y-2.5" id="card-lock-settings">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-extrabold text-slate-900">🔒 Seguridad de la pantalla</div>
            {session && (
              <button
                type="button"
                id="btn-lock-now-settings"
                onClick={() => lockNow()}
                className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-extrabold cursor-pointer"
              >
                Bloquear ahora
              </button>
            )}
          </div>
          <p className="text-[10.5px] text-slate-500 leading-snug">
            Al bloquear, el turno sigue abierto: solo el vendedor del turno o un administrador lo desbloquean con su PIN.
            También puedes bloquear en cualquier momento con el candado de la barra superior.
          </p>
          <label className="flex items-start gap-2 text-[11px] font-bold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              id="lock-on-open"
              className="mt-0.5"
              disabled={!canManage}
              checked={lock.lockOnOpen}
              onChange={(e) => saveLockSettings({ lockOnOpen: e.target.checked })}
            />
            <span>
              Pedir PIN al abrir la app
              <span className="block font-semibold text-slate-500">
                También al volver a la app después de más de 30 segundos fuera de ella.
              </span>
            </span>
          </label>
          <div className="space-y-1.5">
            <label className="flex items-start gap-2 text-[11px] font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                id="auto-lock-enabled"
                className="mt-0.5"
                disabled={!canManage}
                checked={lock.autoLockMinutes > 0}
                onChange={(e) => saveLockSettings({ autoLockMinutes: e.target.checked ? 5 : 0 })}
              />
              <span>Bloquear si nadie toca la pantalla durante un tiempo</span>
            </label>
            {lock.autoLockMinutes > 0 && (
              <div className="pl-6 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                  <span>Bloquear tras</span>
                  <NumericInput
                    id="auto-lock-minutes"
                    integer
                    emptyValue={lock.autoLockMinutes}
                    disabled={!canManage}
                    value={lock.autoLockMinutes}
                    onValueChange={(n) => {
                      if (n > 0) saveLockSettings({ autoLockMinutes: n });
                    }}
                    className="w-16 neu-inset rounded-lg px-2 h-8 text-xs font-extrabold text-center bg-transparent outline-none"
                  />
                  <span>minutos sin uso (1 a {AUTO_LOCK_MAX_MINUTES})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 5, 10, 15, 30, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      id={`auto-lock-${m}`}
                      disabled={!canManage}
                      onClick={() => saveLockSettings({ autoLockMinutes: m })}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer disabled:opacity-50 ${
                        lock.autoLockMinutes === m ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {m < 60 ? `${m} min` : "1 hora"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {!canManage && (
            <p className="text-[10.5px] text-slate-500">Solo un administrador puede cambiar estas opciones.</p>
          )}
        </div>
      )}

      {canManage ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-3 space-y-2">
          <div className="text-xs font-extrabold text-slate-900">
            {users.length === 0 ? "Crear el primer usuario (será Administrador)" : "Añadir usuario"}
          </div>
          <input id="input-user-name" placeholder="Nombre (ej. Ana)" value={name} onChange={(e) => setName(e.target.value)} className={input} />
          {users.length > 0 && (
            <select
              id="input-user-role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className={input}
            >
              <option value="seller">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input
              id="input-user-pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="PIN (4-6 números)"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className={input}
            />
            <input
              id="input-user-pin2"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="Repetir PIN"
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
              className={input}
            />
          </div>
          <button
            type="button"
            id="btn-create-user"
            onClick={handleCreate}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs cursor-pointer"
          >
            {users.length === 0 ? "Crear administrador y activar turnos" : "Crear usuario"}
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">Solo un administrador puede crear o modificar usuarios.</p>
      )}

      {msg && <p className={`text-[11px] font-bold ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</p>}
    </div>
  );
}
