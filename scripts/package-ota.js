#!/usr/bin/env node
/**
 * CajaMaster POS - OTA Release Packaging Script
 * 
 * Automates creating a self-hosted OTA update package for:
 * https://github.com/esbeltv25-arch/CajaMaster-Updates
 * 
 * Usage:
 *   node scripts/package-ota.js [version] [versionCode] [changelog] [mandatory]
 * 
 * Example:
 *   node scripts/package-ota.js 1.3.0 1030 "Mejoras en modo oscuro y arqueo de caja" false
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import JSZip from "jszip";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const GITHUB_USER = "esbeltv25-arch";
const GITHUB_REPO = "CajaMaster-Updates";
const BASE_URL = `https://${GITHUB_USER}.github.io/${GITHUB_REPO}`;

// 1. Read existing version.json or set defaults
let currentManifest = {
  version: "1.3.0",
  versionCode: 1030,
  updateUrl: `${BASE_URL}/updates/bundle-v1.3.0.zip`,
  mandatory: false,
  changelog: "Actualización de interfaz y mejoras de rendimiento.",
  releaseDate: new Date().toISOString().split("T")[0],
  minNativeVersionCode: 1000,
};

const manifestPath = path.join(rootDir, "version.json");
if (fs.existsSync(manifestPath)) {
  try {
    currentManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch (e) {
    console.warn("Could not parse existing version.json, using defaults.");
  }
}

// 2. Parse CLI arguments
const args = process.argv.slice(2);
const newVersion = args[0] || currentManifest.version || "1.3.0";
const newVersionCode = args[1] ? parseInt(args[1], 10) : (currentManifest.versionCode ? currentManifest.versionCode + 10 : 1030);
const newChangelog = args[2] || currentManifest.changelog || "Actualización OTA de interfaz web (www) de CajaMaster POS.";
const isMandatory = args[3] === "true" || args[3] === "1";

console.log("=================================================");
console.log("🚀 CajaMaster POS - Empaquetador de Actualización OTA");
console.log("=================================================");
console.log(`📦 Versión:      v${newVersion}`);
console.log(`🔢 VersionCode:  ${newVersionCode}`);
console.log(`📝 Changelog:    "${newChangelog}"`);
console.log(`⚠️  Obligatoria:  ${isMandatory ? "SÍ" : "NO"}`);
console.log(`🌐 Repositorio:  https://github.com/${GITHUB_USER}/${GITHUB_REPO}`);
console.log("-------------------------------------------------");

// 3. Compile Web Assets
console.log("⚙️  1/4 Compilando aplicación web con Vite...");
try {
  execSync("npx vite build", { cwd: rootDir, stdio: "inherit" });
} catch (err) {
  console.error("❌ Error durante la compilación de Vite:", err);
  process.exit(1);
}

// 4. Locate dist/ or www/ directory
const distDir = path.join(rootDir, "dist");
if (!fs.existsSync(distDir)) {
  console.error("❌ No se encontró la carpeta 'dist' compilada.");
  process.exit(1);
}

// 5. Create ZIP package
console.log("🗜️  2/4 Comprimiendo bundle web (.zip)...");
const zip = new JSZip();

function addFilesRecursively(currentPath, zipFolder) {
  const items = fs.readdirSync(currentPath);
  for (const item of items) {
    const fullPath = path.join(currentPath, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      // Exclude server.cjs or server maps if any
      if (item !== "server" && item !== "node_modules") {
        const subFolder = zipFolder.folder(item);
        addFilesRecursively(fullPath, subFolder);
      }
    } else {
      // Exclude server-side files from client bundle
      if (!item.endsWith(".cjs") && !item.endsWith(".map") && item !== "server.js") {
        const fileData = fs.readFileSync(fullPath);
        zipFolder.file(item, fileData);
      }
    }
  }
}

addFilesRecursively(distDir, zip);

const updatesDir = path.join(rootDir, "updates");
if (!fs.existsSync(updatesDir)) {
  fs.mkdirSync(updatesDir, { recursive: true });
}

const bundleFileName = `bundle-v${newVersion}.zip`;
const bundleFilePath = path.join(updatesDir, bundleFileName);

zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } })
  .then((buffer) => {
    fs.writeFileSync(bundleFilePath, buffer);
    const sizeKb = (buffer.length / 1024).toFixed(1);
    console.log(`✅ Archivo generado: updates/${bundleFileName} (${sizeKb} KB)`);

    // 6. Update version.json
    console.log("📄 3/4 Actualizando manifest version.json...");
    const updatedManifest = {
      version: newVersion,
      versionCode: newVersionCode,
      updateUrl: `${BASE_URL}/updates/${bundleFileName}`,
      mandatory: isMandatory,
      changelog: newChangelog,
      releaseDate: new Date().toISOString().split("T")[0],
      minNativeVersionCode: currentManifest.minNativeVersionCode || 1000,
    };

    fs.writeFileSync(manifestPath, JSON.stringify(updatedManifest, null, 2) + "\n");
    console.log("✅ version.json actualizado con éxito.");

    // 7. Instructions for Developer
    console.log("-------------------------------------------------");
    console.log("🎉 4/4 ¡Paquete OTA listo para publicar!");
    console.log("-------------------------------------------------");
    console.log("Pasos para subir la actualización a GitHub:");
    console.log(`1. Copia o sube 'version.json' y 'updates/${bundleFileName}' al repo:`);
    console.log(`   https://github.com/${GITHUB_USER}/${GITHUB_REPO}`);
    console.log(`2. Ejecuta en tu terminal:`);
    console.log(`   git add version.json updates/${bundleFileName}`);
    console.log(`   git commit -m "Release OTA v${newVersion} (Build ${newVersionCode})"`);
    console.log(`   git push origin main`);
    console.log(`3. ¡Listo! Tus terminales de CajaMaster recibirán la actualización de forma automática.`);
    console.log("=================================================");
  })
  .catch((err) => {
    console.error("❌ Error al generar el archivo .zip:", err);
    process.exit(1);
  });
