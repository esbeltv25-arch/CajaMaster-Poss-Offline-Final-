import { Filesystem, Directory } from "@capacitor/filesystem";
import { universalShare } from "./universalShare";

/**
 * Storage and Export Destination Management System for CajaMaster POS
 * Supports:
 * 1. Memoria Interna (Local Device Storage / Downloads / Documents / Capacitor Native)
 * 2. Memoria Externa (USB OTG / MicroSD / External Drives / Native File System Access)
 * 3. Almacenamiento en la Nube & Compartir (Google Drive, OneDrive, Dropbox, WhatsApp, Gmail, Telegram)
 * 4. Vista Previa / Impresión Directa
 */

export type StorageDestination = "internal" | "external" | "cloud" | "preview" | "print";

export interface FileExportPayload {
  filename: string;
  blob: Blob;
  mimeType: string;
  title: string;
  description?: string;
  category?: "PDF" | "CSV" | "JSON" | "EXCEL" | "TICKET";
}

export interface SaveResult {
  success: boolean;
  destination: StorageDestination;
  message: string;
  methodUsed?: "download" | "fileSystemAccess" | "webShare" | "urlOpen" | "capacitorFilesystem" | "capacitorShare" | "clipboardFallback" | "appLink" | "nativePlugin" | "downloadFallback";
}

/**
 * Helper to convert Blob to Base64
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Detects if app is running inside Capacitor native container (Android APK / iOS)
 */
export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return !!(cap && (cap.isNativePlatform?.() || cap.getPlatform?.() === "android" || cap.getPlatform?.() === "ios"));
}

/**
 * Universal dispatcher that executes the save or export action
 * according to the chosen storage destination.
 */
export async function saveFileWithDestination(
  payload: FileExportPayload,
  destination: StorageDestination
): Promise<SaveResult> {
  const { filename, blob, mimeType, title, description } = payload;

  // 1. ALMACENAMIENTO EN LA NUBE / COMPARTIR (Google Drive, OneDrive, Dropbox, WhatsApp, Email, etc.)
  if (destination === "cloud") {
    try {
      const shareRes = await universalShare({
        title: title || filename,
        text: description || `${title} - Generado desde CajaMaster POS`,
        file: {
          blob,
          filename,
          mimeType,
        },
      });

      if (shareRes.success) {
        return {
          success: true,
          destination: "cloud",
          message: shareRes.message || "¡Documento enviado al selector de compartir!",
          methodUsed: shareRes.methodUsed,
        };
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        return {
          success: false,
          destination: "cloud",
          message: "Envío cancelado por el usuario.",
        };
      }
      console.warn("universalShare error in fileStorage:", err);
    }

    // Cloud Fallback: Download file with explicit cloud-ready notice + trigger download
    await saveToInternalOrDownload(blob, filename);
    return {
      success: true,
      destination: "cloud",
      message: "Archivo guardado para subir a Google Drive, Dropbox o OneDrive.",
      methodUsed: "download",
    };
  }

  // 2. MEMORIA EXTERNA (USB, Tarjeta MicroSD, Disco Extraíble, OTG)
  if (destination === "external") {
    // Check if the modern Native File System Access API is supported (Chrome, Edge, Android Chrome with OTG/SD support)
    if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
      try {
        const extension = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() || "" : "";
        const acceptObj: Record<string, string[]> = {};
        if (extension === "pdf") {
          acceptObj["application/pdf"] = [".pdf"];
        } else if (extension === "csv") {
          acceptObj["text/csv"] = [".csv"];
        } else if (extension === "json") {
          acceptObj["application/json"] = [".json"];
        } else {
          acceptObj[mimeType || "application/octet-stream"] = extension ? [`.${extension}`] : [];
        }

        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: title || "Archivo de CajaMaster POS",
              accept: acceptObj,
            },
          ],
        });

        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();

        return {
          success: true,
          destination: "external",
          message: `¡Guardado en memoria externa / carpeta seleccionada: ${filename}!`,
          methodUsed: "fileSystemAccess",
        };
      } catch (err: any) {
        if (err.name === "AbortError") {
          return {
            success: false,
            destination: "external",
            message: "Operación de guardado externo cancelada.",
          };
        }
        console.warn("Native File System Access failed, falling back to download for external storage:", err);
      }
    }

    // Direct mobile download tagged for USB / SD card
    await saveToInternalOrDownload(blob, filename);
    return {
      success: true,
      destination: "external",
      message: `Archivo guardado para transferir a Memoria USB o Tarjeta SD (${filename}).`,
      methodUsed: "download",
    };
  }

  // 3. MEMORIA INTERNA (Descargas / Almacenamiento Local del Dispositivo / Capacitor Documents)
  if (destination === "internal") {
    const result = await saveToInternalOrDownload(blob, filename);
    return {
      success: true,
      destination: "internal",
      message: result.nativeSaved
        ? `¡Archivo guardado en Documentos / Almacenamiento del dispositivo (${filename})!`
        : `¡Archivo descargado en la memoria del dispositivo (${filename})!`,
      methodUsed: result.nativeSaved ? "capacitorFilesystem" : "download",
    };
  }

  // 4. VISTA PREVIA DIRECTA
  if (destination === "preview") {
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      await saveToInternalOrDownload(blob, filename);
    }
    return {
      success: true,
      destination: "preview",
      message: "Abriendo vista previa...",
      methodUsed: "urlOpen",
    };
  }

  return {
    success: false,
    destination,
    message: "Destino no reconocido.",
  };
}

/**
 * Saves file to Capacitor native filesystem or standard browser download
 */
export async function saveToInternalOrDownload(
  blob: Blob,
  filename: string
): Promise<{ nativeSaved: boolean }> {
  if (isCapacitorNative()) {
    try {
      const base64Data = await blobToBase64(blob);
      await Filesystem.writeFile({
        path: `Documents/${filename}`,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });
      // Also trigger native share so Android shows the user the file and allows opening/sharing it
      await universalShare({
        title: filename,
        text: `Documento generado: ${filename}`,
        file: { blob, filename },
        dialogTitle: `Guardar o Abrir ${filename}`,
      });
      return { nativeSaved: true };
    } catch (e) {
      console.warn("Capacitor Filesystem write failed, attempting universal share fallback", e);
      try {
        await universalShare({
          title: filename,
          text: `Documento: ${filename}`,
          file: { blob, filename },
        });
        return { nativeSaved: true };
      } catch (shareErr) {
        console.warn("Share fallback also failed", shareErr);
      }
    }
  }

  triggerBrowserDownload(blob, filename);
  return { nativeSaved: false };
}

/**
 * Standard robust browser download helper
 */
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1200);
}

/**
 * Helper to get human-readable file size from Blob
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return "0 KB";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
