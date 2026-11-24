#!/usr/bin/env tsx
/**
 * CajaMaster POS — vendor license tool (only for the app OWNER).
 *
 *   npm run license:keygen                         Create your key pair (ONCE)
 *   npm run license -- sign <DEVICE_ID>            Permanent license
 *   npm run license -- sign <DEVICE_ID> --days 365 License valid for N days
 *   npm run license -- sign <DEVICE_ID> --until 2027-12-31
 *   npm run license -- verify <DEVICE_ID> <LICENCIA>
 *   npm run license -- list                        Licenses issued from this computer
 *
 * The PRIVATE key lives in .license/private-key.json (never committed: see .gitignore).
 * Whoever has that file can issue licenses — keep it safe and keep a backup.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import {
  generateKeyPair,
  publicKeyFromPrivate,
  createLicense,
  verifyLicenseWithKey,
  normalizeDeviceId,
  formatLicenseExpiry,
} from "../src/utils/licenseFormat";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keyDir = path.join(root, ".license");
const keyFile = path.join(keyDir, "private-key.json");
const registryFile = path.join(keyDir, "licencias-emitidas.csv");
const publicKeyTs = path.join(root, "src", "utils", "licensePublicKey.ts");

function fail(msg: string): never {
  console.error("\n❌ " + msg + "\n");
  process.exit(1);
}

function loadPrivateKey(): string {
  if (!fs.existsSync(keyFile)) fail("No existe .license/private-key.json. Ejecuta primero: npm run license:keygen");
  const data = JSON.parse(fs.readFileSync(keyFile, "utf-8"));
  if (!/^[0-9a-f]{64}$/i.test(data.privateKeyHex || "")) fail("private-key.json no es válido.");
  return data.privateKeyHex;
}

function writePublicKey(publicKeyHex: string) {
  const content = fs.readFileSync(publicKeyTs, "utf-8").replace(
    /export const LICENSE_PUBLIC_KEY_HEX = ".*";/,
    `export const LICENSE_PUBLIC_KEY_HEX = "${publicKeyHex}";`
  );
  fs.writeFileSync(publicKeyTs, content);
}

function readAppPublicKey(): string {
  const m = fs.readFileSync(publicKeyTs, "utf-8").match(/LICENSE_PUBLIC_KEY_HEX = "([0-9a-fA-F]*)"/);
  return m ? m[1] : "";
}

const [cmd, ...args] = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (cmd === "keygen") {
  if (fs.existsSync(keyFile) && !args.includes("--force")) {
    fail(
      "Ya existe una clave privada en .license/private-key.json.\n" +
        "   Crear otra INVALIDARÍA todas las licencias ya emitidas.\n" +
        "   Si de verdad quieres reemplazarla: npm run license:keygen -- --force"
    );
  }
  const { privateKeyHex, publicKeyHex } = generateKeyPair();
  fs.mkdirSync(keyDir, { recursive: true });
  fs.writeFileSync(
    keyFile,
    JSON.stringify({ app: "CajaMaster POS", privateKeyHex, publicKeyHex, createdAt: new Date().toISOString() }, null, 2),
    { mode: 0o600 }
  );
  writePublicKey(publicKeyHex);
  console.log("\n✅ Par de claves creado.");
  console.log("   🔒 Clave PRIVADA: .license/private-key.json  (NO la compartas, NO la subas a GitHub, haz copia de seguridad)");
  console.log("   🔓 Clave PÚBLICA escrita en src/utils/licensePublicKey.ts:");
  console.log("      " + publicKeyHex);
  console.log("\n   Siguiente paso: compila la app (APK / OTA) para que incluya la clave pública.\n");
} else if (cmd === "sign") {
  const deviceId = normalizeDeviceId(args[0] || "");
  if (!deviceId || deviceId.startsWith("--")) fail("Indica el ID del dispositivo. Ej: npm run license -- sign CM-AB12-CD34-EF56");
  const priv = loadPrivateKey();
  let expiresAt: Date | null = null;
  if (flag("--days")) {
    const days = Number(flag("--days"));
    if (!(days > 0)) fail("--days debe ser un número mayor que 0");
    expiresAt = new Date(Date.now() + days * 86400000);
  } else if (flag("--until")) {
    expiresAt = new Date(flag("--until") + "T12:00:00Z");
    if (isNaN(expiresAt.getTime())) fail("--until debe tener formato AAAA-MM-DD");
  }
  const license = createLicense(priv, deviceId, expiresAt);
  // Self-check against the public key compiled into the app
  const appKey = readAppPublicKey();
  const check = verifyLicenseWithKey(appKey || publicKeyFromPrivate(priv), deviceId, license);
  if (!check.valid) fail("La licencia generada no verifica (" + check.reason + ").");
  if (appKey && appKey.toLowerCase() !== publicKeyFromPrivate(priv).toLowerCase()) {
    fail("La clave pública de la app no corresponde a tu clave privada. Revisa src/utils/licensePublicKey.ts");
  }
  const note = flag("--cliente") || "";
  fs.appendFileSync(
    registryFile,
    (fs.existsSync(registryFile) ? "" : "fecha,dispositivo,caduca,cliente,licencia\n") +
      `${new Date().toISOString()},${deviceId},${formatLicenseExpiry(check.expiresAt)},"${note.replace(/"/g, "'")}",${license}\n`
  );
  console.log("\n=======================================================");
  console.log("  🔑 CAJAMASTER — LICENCIA GENERADA");
  console.log("=======================================================");
  console.log("  Dispositivo : " + deviceId);
  console.log("  Válida hasta: " + (check.expiresAt ? formatLicenseExpiry(check.expiresAt) + " (inclusive)" : "Permanente"));
  console.log("\n" + license + "\n");
  console.log("=======================================================\n");
  if (process.platform === "darwin") {
    try {
      execSync("pbcopy", { input: license });
      console.log("📋 Copiada al portapapeles.\n");
    } catch {}
  }
} else if (cmd === "verify") {
  const [deviceId, ...rest] = args;
  const license = rest.join("");
  const key = readAppPublicKey();
  if (!key) fail("La app aún no tiene clave pública (ejecuta npm run license:keygen).");
  const r = verifyLicenseWithKey(key, deviceId || "", license);
  console.log(r.valid ? `\n✅ Válida${r.expiresAt ? " hasta el " + formatLicenseExpiry(r.expiresAt) + " (inclusive)" : " (permanente)"}\n` : `\n❌ No válida: ${r.reason}\n`);
  process.exit(r.valid ? 0 : 1);
} else if (cmd === "list") {
  console.log(fs.existsSync(registryFile) ? fs.readFileSync(registryFile, "utf-8") : "Aún no has emitido licencias desde este equipo.");
} else {
  console.log(`
CajaMaster — herramienta de licencias
  npm run license:keygen                              Crear tus claves (una sola vez)
  npm run license -- sign <ID> [--days N | --until AAAA-MM-DD] [--cliente "Nombre"]
  npm run license -- verify <ID> <LICENCIA>
  npm run license -- list
`);
}
