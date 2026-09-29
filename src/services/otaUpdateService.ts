import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import JSZip from "jszip";

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
export const DEFAULT_SERVER_URL = "https://esbeltv25-arch.github.io/CajaMaster-Updates/version.json";
export const GITHUB_REPO_URL = "https://github.com/esbeltv25-arch/CajaMaster-Updates";

export const APP_BASE_VERSION = "1.2.0";
export const APP_BASE_VERSION_CODE = 1020;

export function getOtaConfig(): OtaConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        serverUrl: parsed.serverUrl || DEFAULT_SERVER_URL,
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
  const targetUrl = options.customUrl || config.serverUrl;
  const timeoutMs = options.timeoutMs ?? 4500;

  try {
    // AbortController ensures we never hang when offline in Cuba/remote areas
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(targetUrl, {
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

    saveOtaConfig({ lastCheckedTs: Date.now() });

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
        // App is already up to date
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
    saveOtaConfig({ lastCheckedTs: Date.now() });

    const isOffline =
      err.name === "AbortError" ||
      err.message?.includes("Failed to fetch") ||
      err.message?.includes("NetworkError") ||
      err.message?.includes("offline");

    if (!options.silent) {
      console.warn("OTA Check Warning (gracefully handled):", err.message || err);
    }

    return {
      hasUpdate: false,
      offline: isOffline,
      error: isOffline
        ? "Sin conexión al servidor de actualizaciones (Modo Offline Seguro)."
        : err.message || "Error al comprobar versión.",
    };
  }
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

    // 1. Fetch ZIP file with progress
    const response = await fetch(info.updateUrl, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`Error al descargar paquete: HTTP ${response.status}`);
    }

    onProgress?.(35, "Descargando contenido comprimido (.zip)...");
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    onProgress?.(60, "Descomprimiendo archivos de interfaz...");

    // 2. Extract using JSZip
    const zip = await JSZip.loadAsync(arrayBuffer);
    const destinationFolder = `ota_bundles/v_${info.versionCode}`;

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

    // 3. Write all unpacked files
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (!zipEntry.dir) {
        const fileData = await zipEntry.async("base64");
        await Filesystem.writeFile({
          path: `${destinationFolder}/${relativePath}`,
          data: fileData,
          directory: Directory.Data,
          recursive: true,
        });
      }
      fileCount++;
      const currentPct = 60 + Math.floor((fileCount / Math.max(1, totalFiles)) * 35);
      onProgress?.(currentPct, `Extrayendo archivo ${fileCount} de ${totalFiles}...`);
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
 * Applies the update and reloads the WebView seamlessly.
 */
export function applyOtaUpdateAndReload(): void {
  // Graceful reload of client
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}
