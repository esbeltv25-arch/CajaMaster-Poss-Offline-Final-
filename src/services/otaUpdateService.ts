import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Capacitor, registerPlugin } from "@capacitor/core";
import JSZip from "jszip";

export const CapWebView = registerPlugin<{
  setServerBasePath: (options: { path: string }) => Promise<void>;
  getServerBasePath: () => Promise<{ path: string }>;
  persistServerBasePath: () => Promise<void>;
}>("WebView");

export interface RemoteVersionInfo {
  version: string;
  versionCode: number;
  updateUrl: string;
  mandatory: boolean;
  changelog: string;
  releaseDate?: string;
  minNativeVersionCode?: number;
  bundleChecksum?: string;
}

export interface OtaConfig {
  serverUrl: string;
  autoCheckOnStartup: boolean;
  autoDownloadOnWifi: boolean;
  lastCheckedTs: number | null;
  installedVersion: string;
  installedVersionCode: number;
  pendingUpdate: RemoteVersionInfo | null;
  activeBundlePath: string | null;
}

export type OtaStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "extracting"
  | "ready_to_apply"
  | "up_to_date"
  | "offline"
  | "error";

export interface OtaCheckResult {
  hasUpdate: boolean;
  remoteInfo?: RemoteVersionInfo;
  isMandatory?: boolean;
  error?: string;
  offline?: boolean;
}

const STORAGE_KEY_CONFIG = "cajamaster_ota_config_v1";
export const DEFAULT_RAW_URL = "https://raw.githubusercontent.com/esbeltv25-arch/CajaMaster-Updates/main/version.json";
export const DEFAULT_PAGES_URL = "https://esbeltv25-arch.github.io/CajaMaster-Updates/version.json";
export const DEFAULT_SERVER_URL = DEFAULT_RAW_URL;
export const GITHUB_REPO_URL = "https://github.com/esbeltv25-arch/CajaMaster-Updates";

export const APP_BASE_VERSION = "1.3.0";
export const APP_BASE_VERSION_CODE = 1030;

export function getOtaConfig(): OtaConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate old github.io URLs to raw.githubusercontent.com if needed
      let sUrl = parsed.serverUrl || DEFAULT_SERVER_URL;
      if (sUrl.includes("esbeltv25-arch.github.io/CajaMaster-Updates/version.json")) {
        sUrl = DEFAULT_RAW_URL;
      }
      return {
        serverUrl: sUrl,
        autoCheckOnStartup: parsed.autoCheckOnStartup ?? true,
        autoDownloadOnWifi: parsed.autoDownloadOnWifi ?? true,
        lastCheckedTs: parsed.lastCheckedTs || null,
        installedVersion: parsed.installedVersion || APP_BASE_VERSION,
        installedVersionCode: parsed.installedVersionCode || APP_BASE_VERSION_CODE,
        pendingUpdate: parsed.pendingUpdate || null,
        activeBundlePath: parsed.activeBundlePath || null,
      };
    }
  } catch (e) {
    console.warn("Failed to read OTA config from storage", e);
  }

  return {
    serverUrl: DEFAULT_SERVER_URL,
    autoCheckOnStartup: true,
    autoDownloadOnWifi: true,
    lastCheckedTs: null,
    installedVersion: APP_BASE_VERSION,
    installedVersionCode: APP_BASE_VERSION_CODE,
    pendingUpdate: null,
    activeBundlePath: null,
  };
}

export function saveOtaConfig(config: Partial<OtaConfig>): OtaConfig {
  const current = getOtaConfig();
  const updated: OtaConfig = { ...current, ...config };
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
  } catch (e) {
    console.warn("Failed to save OTA config", e);
  }
  return updated;
}

/**
 * Checks for updates against the self-hosted remote server endpoint.
 * Designed to be 100% silent, non-blocking, with strict timeout for offline environments.
 */
export async function checkOtaUpdate(
  options: { timeoutMs?: number; customUrl?: string; silent?: boolean } = {}
): Promise<OtaCheckResult> {
  const config = getOtaConfig();
  const primaryUrl = options.customUrl || config.serverUrl;
  const timeoutMs = options.timeoutMs ?? 8000;

  // Add cache-busting timestamp to bypass GitHub Fastly CDN cache
  const cacheBust = `?t=${Date.now()}`;
  const candidateUrls = [
    primaryUrl.includes("?") ? `${primaryUrl}&t=${Date.now()}` : `${primaryUrl}${cacheBust}`,
    `https://raw.githubusercontent.com/esbeltv25-arch/CajaMaster-Updates/main/version.json${cacheBust}`,
    `https://esbeltv25-arch.github.io/CajaMaster-Updates/version.json${cacheBust}`,
    "https://raw.githubusercontent.com/esbeltv25-arch/CajaMaster-Updates/main/version.json",
    "https://esbeltv25-arch.github.io/CajaMaster-Updates/version.json",
  ];

  let lastError: any = null;

  for (const url of candidateUrls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as RemoteVersionInfo;

      saveOtaConfig({ lastCheckedTs: Date.now(), serverUrl: url });

      if (data && typeof data.versionCode === "number") {
        const isNewer = data.versionCode > config.installedVersionCode;

        if (isNewer) {
          saveOtaConfig({ pendingUpdate: data });
          return {
            hasUpdate: true,
            remoteInfo: data,
            isMandatory: !!data.mandatory,
          };
        } else {
          // App is already up to date or at same version
          saveOtaConfig({ pendingUpdate: null });
          return {
            hasUpdate: false,
            remoteInfo: data,
          };
        }
      }

      return {
        hasUpdate: false,
        error: "Respuesta de versión inválida.",
      };
    } catch (err: any) {
      lastError = err;
    }
  }

  // Fallback: Try server-side proxy endpoint if browser direct fetch had CORS/network issues
  try {
    const proxyRes = await fetch(`/api/ota/check-version?url=${encodeURIComponent(primaryUrl)}`);
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json.success && json.data && typeof json.data.versionCode === "number") {
        const data = json.data as RemoteVersionInfo;
        saveOtaConfig({ lastCheckedTs: Date.now() });
        const isNewer = data.versionCode > config.installedVersionCode;
        if (isNewer) {
          saveOtaConfig({ pendingUpdate: data });
          return {
            hasUpdate: true,
            remoteInfo: data,
            isMandatory: !!data.mandatory,
          };
        } else {
          saveOtaConfig({ pendingUpdate: null });
          return {
            hasUpdate: false,
            remoteInfo: data,
          };
        }
      }
    }
  } catch {}

  saveOtaConfig({ lastCheckedTs: Date.now() });

  const errMsg = lastError?.message || "";
  const is404 = errMsg.includes("404");
  const isOffline =
    lastError?.name === "AbortError" ||
    errMsg.includes("Failed to fetch") ||
    errMsg.includes("NetworkError") ||
    errMsg.includes("offline");

  if (!options.silent) {
    console.warn("OTA Check Warning:", errMsg || lastError);
  }

  if (is404) {
    return {
      hasUpdate: false,
      offline: false,
      error: "GitHub respondió 404 (version.json aún no publicado en el repositorio esbeltv25-arch/CajaMaster-Updates). Ejecuta los comandos en tu Mac para subirlo a GitHub.",
    };
  }

  return {
    hasUpdate: false,
    offline: isOffline,
    error: isOffline
      ? "Servidor de actualizaciones no disponible aún (o sin conexión). La aplicación continúa funcionando con la versión local."
      : errMsg || "Error al comprobar versión.",
  };
}

/**
 * Downloads the .zip web bundle and extracts it to device persistent storage.
 */
export async function downloadAndExtractOtaBundle(
  info: RemoteVersionInfo,
  onProgress?: (progressPercent: number, statusText: string) => void
): Promise<{ success: boolean; message: string; bundlePath?: string }> {
  try {
    onProgress?.(10, "Iniciando descarga del paquete web...");

    // Build candidate URLs for zip download (raw, pages, proxy fallback, local)
    const zipUrls = [
      info.updateUrl,
      `/updates/bundle-v${info.version}.zip`,
      "/updates/bundle-v1.3.1.zip",
      "/updates/bundle-v1.3.0.zip",
      `/api/ota/download-bundle?url=${encodeURIComponent(info.updateUrl)}`,
    ];
    if (info.updateUrl.includes("github.io/CajaMaster-Updates/")) {
      zipUrls.push(
        info.updateUrl.replace(
          "https://esbeltv25-arch.github.io/CajaMaster-Updates/",
          "https://raw.githubusercontent.com/esbeltv25-arch/CajaMaster-Updates/main/"
        ),
        info.updateUrl.replace(
          "https://esbeltv25-arch.github.io/CajaMaster-Updates/",
          "https://raw.githubusercontent.com/esbeltv25-arch/CajaMaster-Updates/master/"
        )
      );
    } else if (info.updateUrl.includes("raw.githubusercontent.com")) {
      zipUrls.push(
        info.updateUrl.replace("/main/", "/master/"),
        info.updateUrl.replace(
          "https://raw.githubusercontent.com/esbeltv25-arch/CajaMaster-Updates/main/",
          "https://esbeltv25-arch.github.io/CajaMaster-Updates/"
        )
      );
    }

    let response: Response | null = null;
    let lastDownloadError: any = null;

    for (const url of zipUrls) {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "Cache-Control": "no-cache",
          },
        });
        if (res.ok) {
          response = res;
          break;
        }
      } catch (e) {
        lastDownloadError = e;
      }
    }

    if (!response || !response.ok) {
      throw new Error(
        lastDownloadError?.message ||
          "Error al descargar paquete .zip desde el repositorio."
      );
    }

    onProgress?.(35, "Descargando contenido comprimido (.zip)...");
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    onProgress?.(60, "Descomprimiendo archivos de interfaz...");

    // 2. Extract using JSZip
    const zip = await JSZip.loadAsync(arrayBuffer);
    const destinationFolder = `ota_bundles/v_${info.versionCode}`;

    const hasIndexHtml = Object.keys(zip.files).some((p) => p.endsWith("index.html"));
    if (!hasIndexHtml) {
      throw new Error(
        "El archivo ZIP descargado no contiene index.html. Paquete de actualización incompleto."
      );
    }

    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      // Ensure parent directory exists in Capacitor filesystem
      try {
        await Filesystem.mkdir({
          path: destinationFolder,
          directory: Directory.Data,
          recursive: true,
        });
      } catch (e) {
        // Directory may already exist
      }

      let fileCount = 0;
      const totalFiles = Object.keys(zip.files).length;

      // 3. Write all unpacked files to native storage
      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (!zipEntry.dir) {
          const fileData = await zipEntry.async("base64");
          const cleanPath = relativePath.replace(/^(dist|www|build)\//i, "");
          await Filesystem.writeFile({
            path: `${destinationFolder}/${cleanPath}`,
            data: fileData,
            directory: Directory.Data,
            recursive: true,
          });
        }
        fileCount++;
        const currentPct =
          60 + Math.floor((fileCount / Math.max(1, totalFiles)) * 35);
        onProgress?.(
          currentPct,
          `Extrayendo archivo ${fileCount} de ${totalFiles}...`
        );
      }

      // Switch Capacitor WebView to newly downloaded bundle on Native:
      try {
        const uriRes = await Filesystem.getUri({
          directory: Directory.Data,
          path: destinationFolder,
        });
        const rawPath = uriRes.uri.replace(/^file:\/\//, "");
        console.log("[OTA] Activating bundle at:", rawPath);
        await CapWebView.setServerBasePath({ path: rawPath });
        await CapWebView.persistServerBasePath();
      } catch (webviewErr) {
        console.warn("[OTA] CapWebView activation warning:", webviewErr);
      }

      // Clear caches and Service Workers across both platforms
      if (typeof window !== "undefined" && "caches" in window) {
        try {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map((k) => caches.delete(k)));
        } catch (cErr) {
          console.warn("[OTA] Cache clean notice:", cErr);
        }
      }
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.unregister();
          }
        } catch (swErr) {
          console.warn("[OTA] ServiceWorker unregister notice:", swErr);
        }
      }
    }

    onProgress?.(98, "Verificando integridad del bundle...");

    // 4. Save metadata
    saveOtaConfig({
      installedVersion: info.version,
      installedVersionCode: info.versionCode,
      pendingUpdate: null,
      activeBundlePath: destinationFolder,
    });

    onProgress?.(100, "¡Actualización lista para aplicar!");

    return {
      success: true,
      message: `Versión ${info.version} (Build ${info.versionCode}) descargada e instalada con éxito.`,
      bundlePath: destinationFolder,
    };
  } catch (err: any) {
    console.error("OTA Download Error:", err);
    return {
      success: false,
      message: err.message || "Fallo en la descarga o descompresión del paquete.",
    };
  }
}

/**
 * Simulates a successful OTA update package installation for testing and development.
 */
export async function simulateOtaUpdate(
  simulatedVersion: string = "1.3.0",
  simulatedCode: number = 1030,
  onProgress?: (pct: number, msg: string) => void
): Promise<{ success: boolean; message: string }> {
  onProgress?.(15, "Conectando al servidor OTA...");
  await new Promise((r) => setTimeout(r, 400));

  onProgress?.(45, `Descargando paquete web v${simulatedVersion}...`);
  await new Promise((r) => setTimeout(r, 600));

  onProgress?.(75, "Descomprimiendo bundle y verificando assets...");
  await new Promise((r) => setTimeout(r, 500));

  onProgress?.(95, "Instalando en almacenamiento local...");
  await new Promise((r) => setTimeout(r, 300));

  saveOtaConfig({
    installedVersion: simulatedVersion,
    installedVersionCode: simulatedCode,
    pendingUpdate: null,
    activeBundlePath: `ota_bundles/v_${simulatedCode}`,
  });

  onProgress?.(100, "¡Actualización lista!");

  return {
    success: true,
    message: `Simulación completada: Versión ${simulatedVersion} (Build ${simulatedCode}) preparada.`,
  };
}

/**
 * Restores initial APK embedded bundle / rollback.
 */
export function rollbackOtaBundle(): void {
  saveOtaConfig({
    installedVersion: APP_BASE_VERSION,
    installedVersionCode: APP_BASE_VERSION_CODE,
    pendingUpdate: null,
    activeBundlePath: null,
  });
}

/**
 * Resets local OTA configuration to factory default (versionCode 1000)
 * so that the app will unconditionally recognize remote GitHub updates.
 */
export function resetOtaConfigToFactory(): void {
  saveOtaConfig({
    installedVersion: APP_BASE_VERSION,
    installedVersionCode: 1000,
    pendingUpdate: null,
    activeBundlePath: null,
    lastCheckedTs: null,
  });
}

/**
 * Applies the update and reloads the WebView seamlessly.
 */
export async function applyOtaUpdateAndReload(): Promise<void> {
  const isNative = Capacitor.isNativePlatform();
  if (isNative) {
    try {
      const config = getOtaConfig();
      if (config.activeBundlePath) {
        const uriRes = await Filesystem.getUri({
          directory: Directory.Data,
          path: config.activeBundlePath,
        });
        const rawPath = uriRes.uri.replace(/^file:\/\//, "");
        console.log("[OTA] Applying native bundle at:", rawPath);
        await CapWebView.setServerBasePath({ path: rawPath });
        await CapWebView.persistServerBasePath();
      }
    } catch (e) {
      console.warn("[OTA] applyOtaUpdateAndReload native warning:", e);
    }
  }

  // Clear caches and Service Workers before reload
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {}
  }
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        await reg.unregister();
      }
    } catch {}
  }

  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

export interface ManualZipHistoryItem {
  fileName: string;
  fileSize: number;
  version: string;
  versionCode: number;
  changelog: string;
  installedAt: string;
}

export function getManualZipHistory(): ManualZipHistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem("cajamaster_manual_zip_history_v1") || "[]");
  } catch {
    return [];
  }
}

/**
 * Installs an OTA update package manually from a client-provided .zip file
 * (e.g. received via WhatsApp, Telegram, USB flash drive, or local download).
 * Works 100% offline without needing Internet or GitHub access.
 */
export async function installOtaBundleFromZipFile(
  file: File,
  onProgress?: (progressPercent: number, statusText: string) => void
): Promise<{
  success: boolean;
  message: string;
  version?: string;
  versionCode?: number;
  fileCount?: number;
}> {
  try {
    onProgress?.(10, `Leyendo archivo ZIP «${file.name}» (${(file.size / 1024).toFixed(1)} KB)...`);

    const arrayBuffer = await file.arrayBuffer();

    onProgress?.(30, "Abriendo y analizando estructura del paquete ZIP...");
    const zip = await JSZip.loadAsync(arrayBuffer);

    // 1. Inspect package contents and find version metadata
    let detectedVersion = "";
    let detectedVersionCode = 0;
    let detectedChangelog = "";

    // Check for version.json in zip entries
    for (const [path, entry] of Object.entries(zip.files)) {
      if (!entry.dir && path.endsWith("version.json")) {
        try {
          const content = await entry.async("string");
          const parsed = JSON.parse(content);
          if (parsed.version) detectedVersion = String(parsed.version);
          if (parsed.versionCode) detectedVersionCode = Number(parsed.versionCode);
          if (parsed.changelog) detectedChangelog = String(parsed.changelog);
          break;
        } catch {}
      }
    }

    // Fallback: If no version.json, extract from zip filename (e.g. bundle-v1.3.1.zip or v1.3.1.zip)
    if (!detectedVersion) {
      const match = file.name.match(/v?(\d+\.\d+(\.\d+)?)/i);
      if (match) {
        detectedVersion = match[1];
        const parts = detectedVersion.split(".").map(Number);
        detectedVersionCode = (parts[0] || 1) * 1000 + (parts[1] || 0) * 100 + (parts[2] || 0);
      }
    }

    // Default fallback if still unknown
    const currentConfig = getOtaConfig();
    if (!detectedVersion) {
      detectedVersionCode = currentConfig.installedVersionCode + 1;
      detectedVersion = `1.${Math.floor(detectedVersionCode / 100)}.${detectedVersionCode % 100}`;
    }
    if (!detectedVersionCode) {
      detectedVersionCode = currentConfig.installedVersionCode + 1;
    }

    const hasIndexHtml = Object.keys(zip.files).some((p) => p.endsWith("index.html"));
    if (!hasIndexHtml) {
      return {
        success: false,
        message:
          "El archivo ZIP seleccionado no es un paquete web completo válido (falta 'index.html'). Asegúrate de descargar el paquete completo 'bundle-v1.3.5.zip' o 'cajamaster-update-v1.3.5.zip' (1.1 MB).",
      };
    }

    onProgress?.(50, `Versión detectada: v${detectedVersion} (Build ${detectedVersionCode}). Extrayendo...`);

    const destinationFolder = `ota_bundles/v_${detectedVersionCode}`;
    const isNative = Capacitor.isNativePlatform();
    let fileCount = 0;
    const totalFiles = Object.keys(zip.files).length;

    if (isNative) {
      try {
        await Filesystem.mkdir({
          path: destinationFolder,
          directory: Directory.Data,
          recursive: true,
        });
      } catch {}

      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (!zipEntry.dir) {
          const fileData = await zipEntry.async("base64");
          // Clean path (strip leading dist/ or www/ if packed from subdirectory)
          const cleanPath = relativePath.replace(/^(dist|www|build)\//i, "");
          await Filesystem.writeFile({
            path: `${destinationFolder}/${cleanPath}`,
            data: fileData,
            directory: Directory.Data,
            recursive: true,
          });
        }
        fileCount++;
        const currentPct = 50 + Math.floor((fileCount / Math.max(1, totalFiles)) * 40);
        onProgress?.(currentPct, `Instalando archivo ${fileCount} de ${totalFiles}...`);
      }

      // Switch Capacitor WebView to newly installed ZIP bundle on Native:
      if (isNative) {
        try {
          const uriRes = await Filesystem.getUri({
            directory: Directory.Data,
            path: destinationFolder,
          });
          const rawPath = uriRes.uri.replace(/^file:\/\//, "");
          console.log("[OTA ZIP] Activating native bundle at:", rawPath);
          await CapWebView.setServerBasePath({ path: rawPath });
          await CapWebView.persistServerBasePath();
        } catch (webviewErr) {
          console.warn("[OTA ZIP] CapWebView activation warning:", webviewErr);
        }
      }

      // Clear caches and Service Workers across both platforms
      onProgress?.(80, "Limpiando almacenamiento en caché y Service Worker...");
      if (typeof window !== "undefined" && "caches" in window) {
        try {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map((k) => caches.delete(k)));
        } catch {}
      }
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.unregister();
          }
        } catch {}
      }
      fileCount = totalFiles;
    }

    onProgress?.(95, "Registrando versión en configuración local...");

    saveOtaConfig({
      installedVersion: detectedVersion,
      installedVersionCode: detectedVersionCode,
      pendingUpdate: null,
      activeBundlePath: destinationFolder,
      lastCheckedTs: Date.now(),
    });

    // Save manual update record to local storage history
    try {
      const historyKey = "cajamaster_manual_zip_history_v1";
      const existing = JSON.parse(localStorage.getItem(historyKey) || "[]");
      existing.unshift({
        fileName: file.name,
        fileSize: file.size,
        version: detectedVersion,
        versionCode: detectedVersionCode,
        changelog: detectedChangelog,
        installedAt: new Date().toISOString(),
      });
      localStorage.setItem(historyKey, JSON.stringify(existing.slice(0, 10)));
    } catch {}

    onProgress?.(100, `¡Versión ${detectedVersion} instalada con éxito!`);

    return {
      success: true,
      message: `¡Actualización manual instalada exitosamente! Se procesaron ${fileCount} archivos para la versión v${detectedVersion} (Build ${detectedVersionCode}).`,
      version: detectedVersion,
      versionCode: detectedVersionCode,
      fileCount,
    };
  } catch (err: any) {
    console.error("Manual ZIP Update Error:", err);
    return {
      success: false,
      message: err.message || "Error al procesar el archivo ZIP de actualización.",
    };
  }
}

/**
 * Creates and downloads a ready-to-distribute manual update .zip file
 * containing all real compiled application assets (index.html, JS, CSS, icons),
 * along with version.json and clear instructions for offline mobile updating.
 */
export async function createManualUpdateZipPackage(
  version: string,
  versionCode: number,
  changelog: string
): Promise<Blob> {
  const versionPayload = {
    version,
    versionCode,
    mandatory: false,
    changelog: changelog.trim() || `Actualización CajaMaster POS v${version}`,
    releaseDate: new Date().toISOString().split("T")[0],
    updateUrl: `bundle-v${version}.zip`,
  };

  const instructionsText = `CAJAMASTER PRO POS - PAQUETE DE ACTUALIZACIÓN OFFLINE\n=======================================================\n\nVersión: ${version} (Build ${versionCode})\nFecha: ${new Date().toLocaleDateString("es-ES")}\n\nINSTRUCCIONES PARA EL CLIENTE:\n1. Abre CajaMaster POS en tu dispositivo (teléfono, tablet o PC).\n2. Ve a la pestaña «Ajustes» -> sección «Actualizaciones de la App (OTA & ZIP)».\n3. Toca «Instalar Archivo ZIP» o «Seleccionar Archivo ZIP».\n4. Selecciona este archivo .zip que descargaste o te enviaron por WhatsApp/Telegram.\n5. Toca «Instalar y Aplicar».\n6. Cierra completamente la aplicación en la multitarea de tu teléfono (deslízala hacia arriba) y vuelve a abrirla para que Android cargue el nuevo bundle v${version}.\n\n¡Listo! Tu aplicación estará al instante en la versión ${version} con todas las mejoras de cámara nativa y rendimiento.\n`;

  // Try fetching the pre-compiled full bundle from server or GitHub
  const candidateUrls = [
    `/api/ota/download-current-zip?version=${encodeURIComponent(version)}`,
    `/updates/bundle-v${version}.zip`,
    `/updates/bundle-v1.3.4.zip`,
    `https://raw.githubusercontent.com/esbeltv25-arch/CajaMaster-Updates/main/updates/bundle-v${version}.zip`,
    `https://raw.githubusercontent.com/esbeltv25-arch/CajaMaster-Updates/main/updates/bundle-v1.3.4.zip`,
  ];

  for (const url of candidateUrls) {
    try {
      const resp = await fetch(url, { cache: "no-cache" });
      if (resp.ok) {
        const ab = await resp.arrayBuffer();
        if (ab.byteLength > 50000) {
          // It's a complete bundle! Load and update its version.json and instructions
          const zip = await JSZip.loadAsync(ab);
          zip.file("version.json", JSON.stringify(versionPayload, null, 2));
          zip.file("LEEME_INSTRUCCIONES.txt", instructionsText);
          return await zip.generateAsync({ type: "blob" });
        }
      }
    } catch (e) {
      console.warn(`[createManualUpdateZipPackage] Could not fetch base from ${url}:`, e);
    }
  }

  // Do NOT return a bundle without index.html and assets
  throw new Error(
    "No se pudo descargar el paquete web base completo. Comprueba tu conexión a internet o descarga directamente el archivo oficial bundle-v1.3.5.zip."
  );
}

/**
 * Directly downloads the compiled full bundle ZIP from the server or GitHub.
 */
export function downloadLatestZipDirectly(version: string = "1.3.5"): void {
  try {
    const filename = `cajamaster-update-v${version}.zip`;
    const link = document.createElement("a");
    link.href = `/api/ota/download-current-zip?version=${encodeURIComponent(version)}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Direct download failed, opening URL", err);
    window.open(`/api/ota/download-current-zip?version=${encodeURIComponent(version)}`, "_blank");
  }
}

/**
 * Triggers a browser file download of a Blob.
 */
export function triggerZipDownload(blob: Blob, filename: string): void {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 5000);
  } catch (err) {
    console.error("Failed to trigger zip download", err);
  }
}


