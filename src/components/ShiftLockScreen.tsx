import { useState } from "react";
import { AppLogo } from "./AppLogo";
import { useStore } from "../store";
import { useUserSession, startShift, ROLE_LABELS, type AppUser } from "../services/userSession";

/**
 * "¿Quién trabaja ahora?" — shown when users exist and no shift is open.
 * The chosen user enters their PIN; from then on sales and the Z closing are signed with their name.
 */
export function ShiftLockScreen() {
  const state = useStore();
  const { users } = useUserSession();
  const [selected, setSelected] = useState<AppUser | null>(users.length === 1 ? users[0] : null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (value = pin) => {
    if (!selected) return;
    const res = startShift(selected.id, value);
    if (!res.ok) {
      setError(res.error || "PIN incorrecto.");
      setPin("");
    }
  };

  const press = (d: string) => {
    setError(null);
    const next = (pin + d).slice(0, 6);
    setPin(next);
  };

  return (
    <div
      id="shift-lock-screen"
      className="min-h-[100dvh] w-full flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-b from-[#081814] via-[#0f2c25] to-[#081814] text-white"
    >
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-2">
          <AppLogo size={60} rounded="rounded-2xl" className="shadow-xl ring-4 ring-amber-400/25" />
          <h1 className="font-extrabold text-xl text-center">{state.business.name || "CajaMaster POS"}</h1>
          <p className="text-emerald-200/80 text-sm font-semibold">¿Quién trabaja ahora?</p>
        </div>

        {!selected ? (
          <div className="grid grid-cols-2 gap-2">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                id={`shift-user-${u.id}`}
                onClick={() => {
                  setSelected(u);
                  setPin("");
                  setError(null);
                }}
                className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-left cursor-pointer transition active:scale-95"
              >
                <div className="w-9 h-9 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center mb-1.5">
                  {u.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="font-extrabold text-sm truncate">{u.name}</div>
                <div className="text-[11px] text-white/60">{ROLE_LABELS[u.role]}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white/10 rounded-3xl p-4 border border-white/15 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-extrabold truncate">{selected.name}</div>
                <div className="text-[11px] text-white/60">{ROLE_LABELS[selected.role]} · introduce tu PIN</div>
              </div>
              {users.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setPin("");
                    setError(null);
                  }}
                  className="text-xs font-bold text-amber-300 underline cursor-pointer shrink-0"
                >
                  Cambiar
                </button>
              )}
            </div>

            <div className="flex justify-center gap-2" aria-label="PIN">
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <span
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full border-2 ${i < pin.length ? "bg-amber-400 border-amber-400" : "border-white/40"}`}
                />
              ))}
            </div>

            {error && (
              <p className="text-center text-sm font-bold text-rose-300" id="shift-pin-error">
                {error}
              </p>
            )}

            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => press(d)}
                  className="h-14 rounded-2xl bg-white/10 hover:bg-white/20 text-xl font-black cursor-pointer active:scale-95 transition"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPin((p) => p.slice(0, -1))}
                className="h-14 rounded-2xl bg-white/5 hover:bg-white/15 text-sm font-bold cursor-pointer active:scale-95 transition"
              >
                Borrar
              </button>
              <button
                type="button"
                onClick={() => press("0")}
                className="h-14 rounded-2xl bg-white/10 hover:bg-white/20 text-xl font-black cursor-pointer active:scale-95 transition"
              >
                0
              </button>
              <button
                type="button"
                id="shift-pin-enter"
                onClick={() => submit()}
                disabled={pin.length < 4}
                className="h-14 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 text-sm font-black cursor-pointer active:scale-95 transition"
              >
                Entrar
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-white/45 leading-relaxed">
          Las ventas, movimientos de stock y el cierre de caja quedarán registrados a nombre de quien inicie el turno.
        </p>
      </div>
    </div>
  );
}
