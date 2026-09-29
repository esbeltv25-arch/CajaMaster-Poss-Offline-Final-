/**
 * Storage and Export Destination Management System for CajaMaster POS
 * Supports:
 * 1. Memoria Interna (Local Device Storage / Downloads / Documents)
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
  methodUsed?: "download" | "fileSystemAccess" | "webShare" | "urlOpen";
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
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        const file = new File([blob], filename, { type: mimeType });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: title || filename,
            text: description || `${title} - Generado desde CajaMaster POS`,
            files: [file],
          });
          return {
            success: true,
            destination: "cloud",
            message: "¡Documento enviado al selector de la nube / compartir!",
            methodUsed: "webShare",
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
        console.warn("WebShare with file not supported on this browser/environment, falling back to cloud download:", err);
      }
    }

    // Cloud Fallback: Download file with explicit cloud-ready notice + trigger download
    triggerBrowserDownload(blob, filename);
    return {
      success: true,
      destination: "cloud",
      message: "Archivo generado para subir a Google Drive, Dropbox o OneDrive.",
      methodUsed: "download",
    };
  }

  // 2. MEMORIA EXTERNA (USB, Tarjeta MicroSD, Disco Extraíble, OTG)
  if (destination === "external") {
    // Check if the modern Native File System Access API is supported (Chrome, Edge, Android Chrome with OTG/SD support)
    if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
      try {
        const extension = filename.includes(".") ? filename.split(".").pop() : "";
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: title || "Archivo de CajaMaster POS",
              accept: { [mimeType]: extension ? [`.${extension}`] : [] },
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
    triggerBrowserDownload(blob, filename);
    return {
      success: true,
      destination: "external",
      message: `Archivo listo para transferir a Memoria USB o Tarjeta SD (${filename}).`,
      methodUsed: "download",
    };
  }

  // 3. MEMORIA INTERNA (Descargas / Almacenamiento Local del Dispositivo)
  if (destination === "internal") {
    triggerBrowserDownload(blob, filename);
    return {
      success: true,
      destination: "internal",
      message: `¡Archivo guardado en la memoria interna del dispositivo (${filename})!`,
      methodUsed: "download",
    };
  }

  // 4. VISTA PREVIA DIRECTA
  if (destination === "preview") {
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      triggerBrowserDownload(blob, filename);
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
  }, 1000);
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
