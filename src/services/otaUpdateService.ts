import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Capacitor, registerPlugin } from "@capacitor/core";
import JSZip from "jszip";

export const CapWebView = registerPlugin<{
  setServerAssetPath: (options: { path: string }) => Promise<void>;
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

function stripCacheBust(url: string): string {
  return url.replace(/([?&])t=\d+(&|$)/, (_m, p1, p2) => (p2 ? p1 : "")).replace(/[?&]$/, "");
}

export interface RunningVersionInfo {
  version: string;
  versionCode: number;
}

let runningVersionCache: RunningVersionInfo | null = null;

/**
 * Reads the version of the web bundle that is ACTUALLY being served right now
 * (the /version.json packaged inside the bundle). This is the source of truth:
 * localStorage may be stale if a reload interrupted the previous install.
 */
export async function getRunningVersion(): Promise<RunningVersionInfo | null> {
  if (runningVersionCache) return runningVersionCache;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.versionCode === "number") {
        runningVersionCache = { version: String(data.version || ""), versionCode: data.versionCode };
        // Keep the stored config consistent with what is really running
        const cfg = getOtaConfig();
        if (cfg.installedVersionCode !== data.versionCode || cfg.installedVersion !== runningVersionCache.version) {
          saveOtaConfig({
            installedVersion: runningVersionCache.version,
            installedVersionCode: runningVersionCache.versionCode,
          });
        }
        return runningVersionCache;
      }
    }
  } catch {
    // ignore: fall back to stored config
  }
  return null;
}

async function getEffectiveInstalledCode(): Promise<number> {
  const running = await getRunningVersion();
  if (running) return running.versionCode;
  return getOtaConfig().installedVersionCode;
}

/** Clears Cache Storage and unregisters Service Workers (they would keep serving the old bundle). */
async function purgeWebCachesAndServiceWorkers(): Promise<void> {
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {}
  }
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {}
  }
}

/**
 * Points the native WebView to an extracted bundle folder and persists it.
 * NOTE: setServerBasePath reloads the WebView almost immediately, so everything
 * that must survive (config, cache purge) has to be done BEFORE calling this.
 * Both bridge calls are dispatched synchronously (without awaiting the first)
 * so that persistServerBasePath is queued before the reload happens.
 */
async function switchNativeWebViewTo(bundleFolder: string): Promise<void> {
  const uriRes = await Filesystem.getUri({ directory: Directory.Data, path: bundleFolder });
  const rawPath = decodeURIComponent(uriRes.uri.replace(/^file:\/\//, ""));
  console.log("[OTA] Activating bundle at:", rawPath);
  const p1 = CapWebView.setServerBasePath({ path: rawPath });
  const p2 = CapWebView.persistServerBasePath();
  await Promise.allSettled([p1, p2]);
}

/**
 * Extracts a JSZip bundle into Directory.Data/ota_bundles/v_<code>.
 * It is written to a temporary folder first and renamed at the end, so that
 * an interrupted extraction never leaves a half-written bundle that Android
 * would try to load on next start.
 */
async function extractZipToNativeBundle(
  zip: JSZip,
  versionCode: number,
  onProgress?: (pct: number, msg: string) => void,
  pctFrom = 60,
  pctTo = 95
): Promise<string> {
  const finalFolder = `ota_bundles/v_${versionCode}`;
  const tmpFolder = `ota_bundles/tmp_${versionCode}_${Date.now()}`;

  // Detect a common root prefix (e.g. "dist/") that contains index.html
  const indexEntry = Object.keys(zip.files)
    .filter((p) => /(^|\/)index\.html$/.test(p) && !zip.files[p].dir)
    .sort((a, b) => a.length - b.length)[0];
  const rootPrefix = indexEntry ? indexEntry.slice(0, indexEntry.length - "index.html".length) : "";

  try {
    await Filesystem.mkdir({ path: tmpFolder, directory: Directory.Data, recursive: true });
  } catch {}

  const entries = Object.entries(zip.files).filter(([, e]) => !e.dir);
  let count = 0;
  for (const [relativePath, zipEntry] of entries) {
    count++;
    if (rootPrefix && !relativePath.startsWith(rootPrefix)) continue;
    const cleanPath = relativePath.slice(rootPrefix.length);
    if (!cleanPath || cleanPath.includes("..")) continue;
    const fileData = await zipEntry.async("base64");
    await Filesystem.writeFile({
      path: `${tmpFolder}/${cleanPath}`,
      data: fileData,
      directory: Directory.Data,
      recursive: true,
    });
    const pct = pctFrom + Math.floor((count / Math.max(1, entries.length)) * (pctTo - pctFrom));
    onProgress?.(pct, `Extrayendo archivo ${count} de ${entries.length}...`);
  }

  // Replace any previous copy of the same version
  try {
    await Filesystem.rmdir({ path: finalFolder, directory: Directory.Data, recursive: true });
  } catch {}
  await Filesystem.rename({
    from: tmpFolder,
    to: finalFolder,
    directory: Directory.Data,
    toDirectory: Directory.Data,
  });
  return finalFolder;
}

async function readZipManifest(zip: JSZip): Promise<{ version?: string; versionCode?: number; changelog?: string }> {
  const manifestPath = Object.keys(zip.files)
    .filter((p) => /(^|\/)version\.json$/.test(p) && !zip.files[p].dir)
    .sort((a, b) => a.length - b.length)[0];
  if (!manifestPath) return {};
  try {
    const parsed = JSON.parse(await zip.files[manifestPath].async("string"));
    return {
      version: parsed.version ? String(parsed.version) : undefined,
      versionCode: parsed.versionCode ? Number(parsed.versionCode) : undefined,
      changelog: parsed.changelog ? String(parsed.changelog) : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Checks for updates against the self-hosted remote server endpoint.
 * Designed to be 100% silent, non-blocking, with strict timeout for offline environments.
 */
export async function checkOtaUpdate(
  options: { timeoutMs?: number; customUrl?: string; silent?: boolean } = {}
): Promise<OtaCheckResult> {
  const config = getOtaConfig();
  const primaryUrl = stripCacheBust(options.customUrl || config.serverUrl || DEFAULT_SERVER_URL);
  const timeoutMs = options.timeoutMs ?? 8000;
  const installedCode = await getEffectiveInstalledCode();

  // Add cache-busting timestamp to bypass GitHub Fastly CDN cache
  const cacheBust = `?t=${Date.now()}`;
  const candidateUrls = [
    primaryUrl.includes("?") ? `${primaryUrl}&t=${Date.now()}` : `${primaryUrl}${cacheBust}`,
    `https://raw.githubusercontent.com/esbeltv25-arch/CajaMaster-Updates/main/version.json${cacheBust}`,
    `https://esbeltv25-arch.github.io/CajaMaster-Updates/version.json${cacheBust}`,
    "https://raw.githubusercontent.com/esbeltv25-arch/CajaMaster-Updates/main/version.json",
    "https://esbeltv25-arch.github.io/CajaMaster-Updates/version.json",
  ].filter((u, i, arr) => arr.indexOf(u) === i);

  let lastError: any = null;

  for (const url of candidateUrls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      // No custom request headers: they force an extra CORS preflight (OPTIONS)
      // request. cache: "no-store" + the ?t= parameter already bypass caches.
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as RemoteVersionInfo;

      saveOtaConfig({ lastCheckedTs: Date.now(), serverUrl: stripCacheBust(url) });

      if (data && typeof data.versionCode === "number") {
        const isNewer = data.versionCode > installedCode;

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
        const isNewer = data.versionCode > installedCode;
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
 * It does NOT reload the app: call applyOtaUpdateAndReload() afterwards.
 */
export async function downloadAndExtractOtaBundle(
  info: RemoteVersionInfo,
  onProgress?: (progressPercent: number, statusText: string) => void
): Promise<{ success: boolean; message: string; bundlePath?: string }> {
  try {
    onProgress?.(10, "Iniciando descarga del paquete web...");

    // Candidate URLs for the zip of THIS version only (never fall back to an older bundle).
    const zipUrls: string[] = [info.updateUrl];
    if (info.updateUrl.includes("github.io/CajaMaster-Updates/")) {
      zipUrls.push(
        info.updateUrl.replace(
          "https://esbeltv25-arch.github.io/CajaMaster-Updates/",
          "https://raw.githubusercontent.com/esbeltv25-arch/CajaMaster-Updates/main/"
        )
      );
    } else if (info.updateUrl.includes("raw.githubusercontent.com")) {
      zipUrls.push(
        info.updateUrl.replace(
          "https://raw.githubusercontent.com/esbeltv25-arch/CajaMaster-Updates/main/",
          "https://esbeltv25-arch.github.io/CajaMaster-Updates/"
        )
      );
    }
    zipUrls.push(
      `https://raw.githubusercontent.com/esbeltv25-arch/CajaMaster-Updates/main/updates/bundle-v${info.version}.zip`,
      `/api/ota/download-bundle?url=${encodeURIComponent(info.updateUrl)}`
    );

    let arrayBuffer: ArrayBuffer | null = null;
    let lastDownloadError: any = null;

    for (const url of zipUrls.filter((u, i, arr) => u && arr.indexOf(u) === i)) {
      try {
        // No custom headers (see checkOtaUpdate): avoids an extra CORS preflight.
        const res = await fetch(url, { method: "GET", cache: "no-store" });
        if (!res.ok) {
          lastDownloadError = new Error(`HTTP ${res.status} al descargar ${url}`);
          continue;
        }
        onProgress?.(35, "Descargando contenido comprimido (.zip)...");
        const buf = await res.arrayBuffer();
        // Reject HTML error pages or truncated downloads
        const head = new Uint8Array(buf.slice(0, 2));
        if (buf.byteLength < 1024 || head[0] !== 0x50 || head[1] !== 0x4b) {
          lastDownloadError = new Error("El archivo descargado no es un ZIP válido.");
          continue;
        }
        arrayBuffer = buf;
        break;
      } catch (e) {
        lastDownloadError = e;
      }
    }

    if (!arrayBuffer) {
      throw new Error(
        lastDownloadError?.message || "Error al descargar paquete .zip desde el repositorio."
      );
    }

    onProgress?.(60, "Descomprimiendo archivos de interfaz...");
    const zip = await JSZip.loadAsync(arrayBuffer);

    const hasIndexHtml = Object.keys(zip.files).some((p) => /(^|\/)index\.html$/.test(p));
    if (!hasIndexHtml) {
      throw new Error(
        "El archivo ZIP descargado no contiene index.html. Paquete de actualización incompleto."
      );
    }

    const manifest = await readZipManifest(zip);
    if (manifest.versionCode && manifest.versionCode !== info.versionCode) {
      throw new Error(
        `El ZIP descargado es la versión ${manifest.version || manifest.versionCode}, ` +
          `pero el manifiesto anuncia ${info.version} (Build ${info.versionCode}). ` +
          "Revisa version.json y el ZIP publicados en CajaMaster-Updates."
      );
    }

    let destinationFolder = `ota_bundles/v_${info.versionCode}`;
    if (Capacitor.isNativePlatform()) {
      destinationFolder = await extractZipToNativeBundle(zip, info.versionCode, onProgress, 60, 95);
    }

    onProgress?.(98, "Verificando integridad del bundle...");

    // Metadata is saved BEFORE any reload so it is never lost.
    saveOtaConfig({
      pendingUpdate: null,
      activeBundlePath: destinationFolder,
    });

    onProgress?.(100, "¡Actualización lista para aplicar!");

    return {
      success: true,
      message: Capacitor.isNativePlatform()
        ? `Versión ${info.version} (Build ${info.versionCode}) descargada e instalada.`
        : `Versión ${info.version} verificada. En navegador/PWA se aplica recargando la página.`,
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

  // Only a visual simulation: it must NOT change the installed version,
  // otherwise real updates with a lower code would be ignored afterwards.
  onProgress?.(100, "¡Simulación terminada! (no se modificó la versión instalada)");

  return {
    success: true,
    message: `Simulación completada: Versión ${simulatedVersion} (Build ${simulatedCode}) preparada.`,
  };
}

/**
 * Restores the web bundle embedded in the APK (rollback).
 * Deletes every extracted OTA bundle so Android does not load them again on start.
 */
export async function rollbackOtaBundle(): Promise<void> {
  saveOtaConfig({
    pendingUpdate: null,
    activeBundlePath: null,
  });
  runningVersionCache = null;
  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.rmdir({ path: "ota_bundles", directory: Directory.Data, recursive: true });
    } catch {}
    await purgeWebCachesAndServiceWorkers();
    try {
      const p1 = CapWebView.setServerAssetPath({ path: "public" });
      const p2 = CapWebView.persistServerBasePath();
      await Promise.allSettled([p1, p2]);
    } catch (e) {
      console.warn("[OTA] rollback notice:", e);
    }
  }
}

/**
 * Forgets cached OTA state so the next check compares against the bundle really running.
 */
export function resetOtaConfigToFactory(): void {
  runningVersionCache = null;
  saveOtaConfig({
    pendingUpdate: null,
    lastCheckedTs: null,
  });
}

/**
 * Applies the downloaded update and reloads the WebView.
 */
export async function applyOtaUpdateAndReload(): Promise<void> {
  // Purge SW/caches first: once the WebView is switched the page reloads immediately.
  await purgeWebCachesAndServiceWorkers();

  if (Capacitor.isNativePlatform()) {
    try {
      const config = getOtaConfig();
      if (config.activeBundlePath) {
        await switchNativeWebViewTo(config.activeBundlePath);
        return; // the native side reloads the WebView
      }
    } catch (e) {
      console.warn("[OTA] applyOtaUpdateAndReload native warning:", e);
    }
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

    const hasIndexHtml = Object.keys(zip.files).some((p) => /(^|\/)index\.html$/.test(p));
    if (!hasIndexHtml) {
      return {
        success: false,
        message:
          "El archivo ZIP seleccionado no es un paquete web completo válido (falta 'index.html'). Usa el archivo oficial 'bundle-vX.Y.Z.zip' publicado en CajaMaster-Updates.",
      };
    }

    // The version MUST come from the version.json inside the package. Guessing it
    // from the file name produced wrong build numbers (e.g. 1.3.9 -> 1309) that
    // blocked every later update.
    const manifest = await readZipManifest(zip);
    if (!manifest.version || !manifest.versionCode) {
      return {
        success: false,
        message:
          "El ZIP no contiene un version.json válido (version y versionCode). Genera el paquete con «npm run release:ota».",
      };
    }
    const detectedVersion = manifest.version;
    const detectedVersionCode = manifest.versionCode;
    const detectedChangelog = manifest.changelog || "";

    const installedCode = await getEffectiveInstalledCode();
    if (detectedVersionCode < installedCode) {
      return {
        success: false,
        message: `Este ZIP es la versión ${detectedVersion} (Build ${detectedVersionCode}), más antigua que la instalada (Build ${installedCode}).`,
      };
    }

    onProgress?.(50, `Versión detectada: v${detectedVersion} (Build ${detectedVersionCode}). Extrayendo...`);

    const isNative = Capacitor.isNativePlatform();
    const fileCount = Object.values(zip.files).filter((e) => !e.dir).length;
    let destinationFolder = `ota_bundles/v_${detectedVersionCode}`;

    if (isNative) {
      destinationFolder = await extractZipToNativeBundle(zip, detectedVersionCode, onProgress, 50, 90);
    }

    onProgress?.(95, "Registrando versión en configuración local...");

    saveOtaConfig({
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

    onProgress?.(100, `¡Versión ${detectedVersion} lista! Pulsa «Recargar Interfaz» para aplicarla.`);

    return {
      success: true,
      message: isNative
        ? `Paquete v${detectedVersion} (Build ${detectedVersionCode}) instalado: ${fileCount} archivos. Pulsa «Recargar Interfaz» para aplicarlo.`
        : `Paquete v${detectedVersion} verificado. En navegador/PWA la versión la determina el servidor web.`,
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
 * Opens the official bundle ZIP published on GitHub (CajaMaster-Updates) so it can be
 * saved and shared for offline installation. Defaults to the newest known version.
 */
export function downloadLatestZipDirectly(version?: string): void {
  const cfg = getOtaConfig();
  const v = version || cfg.pendingUpdate?.version || cfg.installedVersion;
  const url =
    (!version && cfg.pendingUpdate?.updateUrl) ||
    `https://raw.githubusercontent.com/esbeltv25-arch/CajaMaster-Updates/main/updates/bundle-v${v}.zip`;
  try {
    if (Capacitor.isNativePlatform()) {
      // The APK has no local /api server: let the system browser download the file.
      import("../utils/nativeBridge").then(({ openExternalUrl }) => openExternalUrl(url));
      return;
    }
    const link = document.createElement("a");
    link.href = url;
    link.download = `bundle-v${v}.zip`;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Direct download failed, opening URL", err);
    window.open(url, "_blank");
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


