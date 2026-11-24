// Browser entry of Generador_CajaMaster_POS.html (bundled by scripts/build-license-generator.mjs).
import {
  createLicense,
  verifyLicenseWithKey,
  publicKeyFromPrivate,
  normalizeDeviceId,
  formatLicenseExpiry,
} from "../../src/utils/licenseFormat";

declare const __APP_PUBLIC_KEY__: string;

const PK_STORAGE = "cm_vendor_private_key";
const REG_STORAGE = "cm_vendor_registry";
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

type Entry = { date: string; deviceId: string; expires: string; client: string; license: string };

function getKey(): string {
  try {
    return localStorage.getItem(PK_STORAGE) || "";
  } catch {
    return "";
  }
}

function parsePrivateKey(text: string): string | null {
  const t = text.trim();
  try {
    const j = JSON.parse(t);
    if (j && /^[0-9a-f]{64}$/i.test(j.privateKeyHex)) return j.privateKeyHex;
  } catch {}
  return /^[0-9a-f]{64}$/i.test(t) ? t : null;
}

function registry(): Entry[] {
  try {
    return JSON.parse(localStorage.getItem(REG_STORAGE) || "[]");
  } catch {
    return [];
  }
}

function renderKeyState() {
  const key = getKey();
  const ok = $("key-ok");
  const setup = $("key-setup");
  const gen = $("gen-card");
  if (!key) {
    ok.hidden = true;
    setup.hidden = false;
    gen.hidden = true;
    return;
  }
  const pub = publicKeyFromPrivate(key);
  const match = !__APP_PUBLIC_KEY__ || __APP_PUBLIC_KEY__.toLowerCase() === pub.toLowerCase();
  ok.hidden = false;
  setup.hidden = true;
  gen.hidden = false;
  $("key-pub").textContent = pub;
  $("key-warn").textContent = !__APP_PUBLIC_KEY__
    ? "⚠️ Este generador se creó cuando la app aún no tenía clave pública. Vuelve a generarlo tras «npm run license:keygen»."
    : match
      ? ""
      : "❌ Esta clave privada NO corresponde a la clave pública de la app: las licencias no funcionarán.";
}

function renderRegistry() {
  const rows = registry();
  $("reg-count").textContent = String(rows.length);
  $("reg-body").innerHTML = rows
    .slice(0, 50)
    .map(
      (r) =>
        `<tr><td>${r.date.slice(0, 10)}</td><td class="mono">${r.deviceId}</td><td>${r.expires}</td><td>${r.client.replace(/</g, "&lt;")}</td></tr>`
    )
    .join("");
}

function expiryFromForm(): Date | null {
  const v = ($("duration") as HTMLSelectElement).value;
  if (v === "perm") return null;
  if (v === "date") {
    const d = ($("until") as HTMLInputElement).value;
    return d ? new Date(d + "T12:00:00Z") : null;
  }
  return new Date(Date.now() + Number(v) * 86400000);
}

function generate() {
  const deviceId = normalizeDeviceId(($("device") as HTMLInputElement).value);
  const out = $("result");
  if (!/^[A-Z0-9][A-Z0-9-]{5,}$/.test(deviceId)) {
    out.hidden = false;
    $("license").textContent = "Escribe el ID del dispositivo que te envió el cliente (ej. CM-AB12-CD34-EF56).";
    return;
  }
  const key = getKey();
  const expires = expiryFromForm();
  if (($("duration") as HTMLSelectElement).value === "date" && !expires) {
    alert("Elige la fecha de caducidad.");
    return;
  }
  const license = createLicense(key, deviceId, expires);
  const check = verifyLicenseWithKey(__APP_PUBLIC_KEY__ || publicKeyFromPrivate(key), deviceId, license);
  if (!check.valid) {
    alert("La licencia generada no verifica (" + check.reason + ").");
    return;
  }
  const client = ($("client") as HTMLInputElement).value.trim();
  const entry: Entry = {
    date: new Date().toISOString(),
    deviceId,
    expires: formatLicenseExpiry(check.expiresAt),
    client,
    license,
  };
  try {
    localStorage.setItem(REG_STORAGE, JSON.stringify([entry, ...registry()]));
  } catch {}
  out.hidden = false;
  $("license").textContent = license;
  $("lic-info").textContent =
    `Dispositivo ${deviceId} · ${check.expiresAt ? "válida hasta el " + formatLicenseExpiry(check.expiresAt) + " (inclusive)" : "permanente"}`;
  const msg =
    `Licencia de CajaMaster POS para el dispositivo ${deviceId}` +
    (check.expiresAt ? ` (válida hasta el ${formatLicenseExpiry(check.expiresAt)} inclusive)` : "") +
    `:\n\n${license}\n\nCópiala completa y pégala en la app con el botón «Pegar clave».`;
  ($("wa") as HTMLAnchorElement).href = "https://wa.me/?text=" + encodeURIComponent(msg);
  ($("tg") as HTMLAnchorElement).href = "https://t.me/share/url?url=%20&text=" + encodeURIComponent(msg);
  renderRegistry();
}

function exportCsv() {
  const rows = registry();
  const csv =
    "fecha,dispositivo,caduca,cliente,licencia\n" +
    rows.map((r) => `${r.date},${r.deviceId},${r.expires},"${r.client.replace(/"/g, "'")}",${r.license}`).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "licencias-emitidas.csv";
  a.click();
}

function init() {
  $("key-save").addEventListener("click", () => {
    const k = parsePrivateKey(($("key-input") as HTMLTextAreaElement).value);
    if (!k) {
      alert("No es una clave privada válida. Pega el contenido completo de .license/private-key.json");
      return;
    }
    localStorage.setItem(PK_STORAGE, k);
    ($("key-input") as HTMLTextAreaElement).value = "";
    renderKeyState();
  });
  $("key-file").addEventListener("change", async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) ($("key-input") as HTMLTextAreaElement).value = await f.text();
  });
  $("key-forget").addEventListener("click", () => {
    if (confirm("¿Borrar la clave privada de ESTE navegador? (tu archivo .license/private-key.json no se toca)")) {
      localStorage.removeItem(PK_STORAGE);
      renderKeyState();
    }
  });
  $("duration").addEventListener("change", () => {
    $("until-wrap").hidden = ($("duration") as HTMLSelectElement).value !== "date";
  });
  $("gen").addEventListener("click", generate);
  $("copy").addEventListener("click", () => {
    navigator.clipboard.writeText($("license").textContent || "");
    $("copy").textContent = "¡Copiada!";
    setTimeout(() => ($("copy").textContent = "Copiar licencia"), 1500);
  });
  $("csv").addEventListener("click", exportCsv);
  $("app-pub").textContent = __APP_PUBLIC_KEY__ || "(sin configurar)";
  renderKeyState();
  renderRegistry();
}

init();
