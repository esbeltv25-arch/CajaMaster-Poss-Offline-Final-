#!/usr/bin/env node
/**
 * CLI License Generator for NodeJS / Terminal
 * Usage: node scripts/generate_license.js DEV-1234-5678-ABCD
 */
import crypto from "crypto";

const SECRET_KEY = "MiClaveSuperSecretaDelPuntoDeVenta2026";

function generateLicense(deviceId) {
  const cleanId = String(deviceId || "").trim().toLowerCase();
  const hash = crypto.createHmac("sha256", SECRET_KEY).update(cleanId, "utf8").digest("hex");
  const raw = hash.slice(0, 12).toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

const argId = process.argv[2];
if (argId) {
  console.log("-----------------------------------------");
  console.log("Device ID: " + argId.trim());
  console.log("Clave de Activación: " + generateLicense(argId));
  console.log("-----------------------------------------");
} else {
  console.log("Uso: node scripts/generate_license.js <DEVICE_ID>");
}
