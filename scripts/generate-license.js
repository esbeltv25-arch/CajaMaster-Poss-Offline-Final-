#!/usr/bin/env node

/**
 * CajaMaster - Generador de Licencias de Activación (macOS / Linux / Windows)
 * Uso:
 *   node scripts/generate-license.js [ID_DEL_DISPOSITIVO]
 *   O ejecuta sin argumentos para modo interactivo.
 */

import crypto from "crypto";
import readline from "readline";
import { execSync } from "child_process";

const SECRET = "CAJAMASTER_2026";

export function computeKey(deviceId) {
  const cleanId = (deviceId || "").trim().toUpperCase();
  if (!cleanId) return null;
  const hash = crypto.createHash("sha256").update(cleanId + SECRET).digest("hex");
  const k = hash.slice(0, 16).toUpperCase();
  return `${k.slice(0, 4)}-${k.slice(4, 8)}-${k.slice(8, 12)}-${k.slice(12, 16)}`;
}

export function printLicense(deviceId, key) {
  console.log("\n=======================================================");
  console.log("             🔑 CAJAMASTER - LICENCIA GENERADA         ");
  console.log("=======================================================");
  console.log(`📱 ID de Dispositivo : ${deviceId.trim().toUpperCase()}`);
  console.log(`🔐 Clave de Activación: \x1b[32m\x1b[1m${key}\x1b[0m`);
  console.log("=======================================================");
  console.log("ℹ️  Esta clave es única para este dispositivo.");
  console.log("   El usuario solo la ingresa una vez al instalar la app.");
  console.log("=======================================================\n");

  // Attempt pbcopy on macOS
  if (process.platform === "darwin") {
    try {
      execSync(`echo "${key}" | pbcopy`);
      console.log("📋 ¡Clave copiada automáticamente al portapapeles de tu Mac!\n");
    } catch {
      // ignore
    }
  }
}

const argId = process.argv[2];

if (argId) {
  const key = computeKey(argId);
  printLicense(argId, key);
  process.exit(0);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("\n=======================================================");
console.log("   🏪 CajaMaster - Generador de Claves de Licencia     ");
console.log("=======================================================");
rl.question("Introduce el ID del dispositivo del cliente (ej. CM-ABCD-EFGH-1234): ", (answer) => {
  const clean = answer.trim();
  if (!clean) {
    console.log("❌ Error: No se proporcionó ningún ID de dispositivo.");
  } else {
    const key = computeKey(clean);
    printLicense(clean, key);
  }
  rl.close();
});
