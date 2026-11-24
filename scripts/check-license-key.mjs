#!/usr/bin/env node
// Stops a release build if the app has no licensing PUBLIC key:
// such a build could not be activated by anyone.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "src/utils/licensePublicKey.ts"), "utf-8");
const key = (src.match(/LICENSE_PUBLIC_KEY_HEX = "([0-9a-fA-F]*)"/) || [])[1] || "";
if (!/^[0-9a-fA-F]{64}$/.test(key)) {
  console.error("\n❌ La app no tiene clave pública de licencias (src/utils/licensePublicKey.ts).");
  console.error("   Ejecuta una vez:  npm run license:keygen   y haz commit de licensePublicKey.ts.\n");
  process.exit(1);
}
console.log("🔐 Clave pública de licencias configurada: " + key.slice(0, 16) + "…");
