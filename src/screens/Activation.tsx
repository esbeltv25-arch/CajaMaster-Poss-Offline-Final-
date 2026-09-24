import { useState } from "react";
import { IconKey, IconCheck, IconLock, IconCopy, IconAlert, IconShield } from "../components/Icons";
import { AppLogo } from "../components/AppLogo";
import {
  validateLicenseKey,
  saveLicenseActivation,
  getPersistentDeviceId,
} from "../utils/licenseSecurity";

export { getPersistentDeviceId as getDeviceId };

export function ActivationScreen({
  deviceId,
  onActivated,
}: {
  deviceId: string;
  onActivated: () => void;
}) {
  const [licenseKey, setLicenseKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [successAnim, setSuccessAnim] = useState(false);

  const cleanDeviceId = (deviceId || getPersistentDeviceId()).trim().toUpperCase();

  const handleActivate = () => {
    setIsValidating(true);
    setError(null);

    // Small timeout for smooth feedback
    setTimeout(() => {
      try {
        const isValid = validateLicenseKey(cleanDeviceId, licenseKey);

        if (isValid) {
          saveLicenseActivation(licenseKey);
          setSuccessAnim(true);
          setTimeout(() => {
            onActivated();
          }, 600);
        } else {
          setError("Licencia o contraseña no válida para este dispositivo.");
        }
      } catch (err) {
        console.error("Error al validar licencia:", err);
        setError("Error al procesar la clave de activación. Intente nuevamente.");
      } finally {
        setIsValidating(false);
      }
    }, 250);
  };

  const handleCopyDeviceId = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(cleanDeviceId).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  };

  const handlePasteLicense = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setLicenseKey(text.trim().toUpperCase());
          setError(null);
        }
      }
    } catch {
      // ignore clipboard permission rejection
    }
  };

  const handleSendWhatsApp = () => {
    const message = encodeURIComponent(
      `Hola, necesito la clave de activación para CajaMaster POS.\n\n📱 Mi Device ID es:\n*${cleanDeviceId}*\n\nQuedo a la espera de la licencia.`
    );
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  return (
    <div
      id="activation-screen"
      className="flex-1 flex flex-col items-center justify-center px-4 py-8 min-h-screen bg-gradient-to-b from-[#081814] via-[#0f2c25] to-[#081814] text-white"
    >
      <div className="w-full max-w-md">
        {/* App Logo & Header */}
        <div className="flex justify-center mb-4">
          <AppLogo size={74} rounded="rounded-3xl" className="shadow-2xl ring-4 ring-amber-400/25" />
        </div>

        <h1 className="text-center font-extrabold text-2xl tracking-tight text-white">
          CajaMaster POS
        </h1>
        <p className="text-center text-emerald-200/80 text-xs mt-1 mb-6 font-medium flex items-center justify-center gap-1.5">
          <IconShield size={14} className="text-amber-400" />
          <span>Activación de Licencia por Hardware ID</span>
        </p>

        {/* Step 1: Device ID */}
        <div
          id="card-device-id"
          className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-4 border border-white/15 shadow-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black tracking-widest text-amber-300 uppercase flex items-center gap-1.5">
              <span>1. Identificador de Dispositivo</span>
            </span>
            <span className="text-[10px] bg-emerald-950/60 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
              Device ID
            </span>
          </div>

          <p className="text-[11.5px] text-white/75 leading-relaxed mb-3">
            Para activar su terminal, copie y envíe este identificador único a su proveedor de software:
          </p>

          <div className="bg-black/40 border border-white/15 rounded-xl p-3 flex items-center justify-between gap-2 shadow-inner">
            <div
              id="text-device-id"
              className="font-mono text-sm sm:text-base font-black text-amber-400 tracking-wider break-all select-all"
            >
              {cleanDeviceId}
            </div>

            <button
              type="button"
              id="btn-copy-device-id"
              onClick={handleCopyDeviceId}
              className="shrink-0 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 text-white font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Copiar Device ID al portapapeles"
            >
              {copied ? (
                <>
                  <IconCheck size={15} className="text-emerald-400" />
                  <span className="text-emerald-400">¡Copiado!</span>
                </>
              ) : (
                <>
                  <IconCopy size={15} />
                  <span>Copiar ID</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-3">
            <button
              type="button"
              id="btn-share-whatsapp"
              onClick={handleSendWhatsApp}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
            >
              <span>💬 Enviar ID al Proveedor por WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Step 2: License Input */}
        <div
          id="card-license-input"
          className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-4 border border-white/15 shadow-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="input-license-key"
              className="text-[11px] font-black tracking-widest text-amber-300 uppercase block"
            >
              2. Clave de Activación
            </label>
            <button
              type="button"
              id="btn-paste-license"
              onClick={handlePasteLicense}
              className="text-[11px] text-amber-300/90 hover:text-amber-200 underline cursor-pointer font-bold transition"
            >
              Pegar clave
            </button>
          </div>

          <p className="text-[11.5px] text-white/75 leading-relaxed mb-3">
            Ingrese la contraseña o código de activación de 12 caracteres recibido:
          </p>

          <div className="bg-black/40 border border-white/15 rounded-xl flex items-center gap-2 px-3 h-14 mb-3 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/30 transition">
            <IconKey size={20} className="text-amber-400 shrink-0" />
            <input
              id="input-license-key"
              value={licenseKey}
              onChange={(e) => {
                setLicenseKey(e.target.value.toUpperCase());
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && licenseKey.trim() && !isValidating) {
                  handleActivate();
                }
              }}
              placeholder="Ej: A1B2-C3D4-E5F6"
              className="flex-1 bg-transparent outline-none font-mono font-bold text-base tracking-widest text-white placeholder:text-white/25 uppercase"
              autoFocus
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck="false"
            />
          </div>

          {/* Validation Error Banner */}
          {error && (
            <div
              id="license-error-banner"
              className="p-3 rounded-xl bg-rose-500/25 border border-rose-500/50 text-rose-200 text-xs font-bold mb-3 flex items-center gap-2.5 animate-shake"
            >
              <IconAlert size={16} className="text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Activation Button */}
          <button
            type="button"
            id="btn-activate-license"
            onClick={handleActivate}
            disabled={isValidating || !licenseKey.trim() || successAnim}
            className={`w-full h-13 rounded-xl font-extrabold text-sm tracking-wide shadow-xl transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ${
              successAnim
                ? "bg-emerald-500 text-white shadow-emerald-500/30"
                : "bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-400/20 disabled:opacity-40 disabled:pointer-events-none"
            }`}
          >
            {isValidating ? (
              <span>Verificando firma criptográfica...</span>
            ) : successAnim ? (
              <>
                <IconCheck size={20} />
                <span>¡TERMINAL ACTIVADA CON ÉXITO!</span>
              </>
            ) : (
              <>
                <IconCheck size={18} />
                <span>ACTIVAR LICENCIA</span>
              </>
            )}
          </button>
        </div>

        {/* Security & Offline Policy */}
        <div className="text-center space-y-2 text-white/70 text-xs px-2">
          <div className="flex items-center justify-center gap-1.5 text-amber-300/80 text-[11px] font-bold">
            <IconLock size={13} />
            <span>Validación HMAC-SHA256 Offline • Licencia Perpetua</span>
          </div>
          <p className="text-[10.5px] text-white/45 leading-relaxed">
            Una vez activada, la aplicación funcionará de manera permanente en este equipo sin requerir conexión a internet.
          </p>
        </div>
      </div>
    </div>
  );
}
