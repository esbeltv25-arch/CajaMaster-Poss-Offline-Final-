/**
 * Automated & Manual Daily Backup System for CajaMaster POS
 * Generates an exhaustive snapshot of the entire database:
 * - Products, prices, costs, barcodes, units and categories
 * - Sales, tickets, lines, payments and cashier signatures
 * - Stock movements, entries, transfers and inventory adjustments
 * - Warehouse vs. Store floor physical counts & balances
 * - Daily Closings (Arqueos Z) and financial cash audits
 * - Delivery orders, drivers, agencies and rates
 * - Business settings, taxonomy and licensing status
 * 
 * Capable of:
 * 1. Automatic triggered backup right upon Daily Closing registration
 * 2. On-demand backup anytime by the user
 * 3. Saving to Internal Storage (Capacitor Documents), Downloads, USB, Cloud or LocalStorage history
 */

import { AppState, DailyClosing, Product } from "../types";
import { saveToInternalOrDownload } from "./fileStorage";
import { universalShare } from "./universalShare";

export interface BackupMetadata {
  id: string;
  timestamp: number;
  dateStr: string;
  filename: string;
  triggeredBy: "DAILY_CLOSING_AUTO" | "MANUAL_USER" | "SCHEDULED";
  closingId?: string;
  totalProducts: number;
  totalSales: number;
  totalMovements: number;
  totalClosings: number;
  inventoryUnits: number;
  inventoryTotalCost: number;
  inventoryTotalValue: number;
}

export interface FullBackupPayload {
  version: string;
  appName: string;
  system: string;
  metadata: BackupMetadata;
  snapshot: AppState;
}

const BACKUP_HISTORY_STORAGE_KEY = "cajamaster_backup_history_v1";
const AUTO_BACKUP_SETTINGS_KEY = "cajamaster_auto_backup_config_v1";

export interface AutoBackupSettings {
  autoBackupOnClosing: boolean; // Automático al hacer Arqueo / Cierre Z
  keepHistoryCount: number; // Cantidad de respaldos a retener (ej. 15)
  notifyOnSuccess: boolean;
  promptStorageDestination: boolean; // Si pregunta destino o guarda silenciosamente
}

export const DEFAULT_AUTO_BACKUP_SETTINGS: AutoBackupSettings = {
  autoBackupOnClosing: true,
  keepHistoryCount: 20,
  notifyOnSuccess: true,
  promptStorageDestination: false,
};

/**
 * Gets the current auto-backup configuration
 */
export function getAutoBackupSettings(): AutoBackupSettings {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_AUTO_BACKUP_SETTINGS;
    const raw = localStorage.getItem(AUTO_BACKUP_SETTINGS_KEY);
    if (!raw) return DEFAULT_AUTO_BACKUP_SETTINGS;
    return { ...DEFAULT_AUTO_BACKUP_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_AUTO_BACKUP_SETTINGS;
  }
}

/**
 * Saves the auto-backup configuration
 */
export function saveAutoBackupSettings(settings: Partial<AutoBackupSettings>): AutoBackupSettings {
  const current = getAutoBackupSettings();
  const updated = { ...current, ...settings };
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(AUTO_BACKUP_SETTINGS_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error("Error saving auto backup settings:", e);
  }
  return updated;
}

/**
 * Calculates current inventory totals for the metadata
 */
function calculateInventorySummary(products: Product[]) {
  let units = 0;
  let totalCost = 0;
  let totalValue = 0;

  for (const p of products) {
    const qty = Math.max(0, p.stock || 0);
    units += qty;
    totalCost += qty * (p.cost || 0);
    totalValue += qty * (p.price || 0);
  }

  return {
    units,
    totalCost: Math.round(totalCost * 100) / 100,
    totalValue: Math.round(totalValue * 100) / 100,
  };
}

/**
 * Builds the exhaustive JSON backup payload from current state
 */
export function buildBackupPayload(
  state: AppState,
  triggeredBy: BackupMetadata["triggeredBy"] = "MANUAL_USER",
  closingId?: string
): FullBackupPayload {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "-");
  const filename = `CajaMaster_Respaldo_${dateStr}_${timeStr}_${triggeredBy === "DAILY_CLOSING_AUTO" ? "CierreZ" : "Manual"}.json`;
  const inv = calculateInventorySummary(state.products || []);

  const metadata: BackupMetadata = {
    id: `bk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    dateStr,
    filename,
    triggeredBy,
    closingId,
    totalProducts: state.products?.length || 0,
    totalSales: state.sales?.length || 0,
    totalMovements: state.movements?.length || 0,
    totalClosings: state.closings?.length || 0,
    inventoryUnits: inv.units,
    inventoryTotalCost: inv.totalCost,
    inventoryTotalValue: inv.totalValue,
  };

  return {
    version: "1.3.3",
    appName: "CajaMaster POS",
    system: "Android / PWA Offline POS Engine",
    metadata,
    snapshot: state,
  };
}

/**
 * Stores the backup metadata into local history for auditability
 */
export function recordBackupInHistory(meta: BackupMetadata): void {
  try {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(BACKUP_HISTORY_STORAGE_KEY);
    const history: BackupMetadata[] = raw ? JSON.parse(raw) : [];
    const settings = getAutoBackupSettings();

    const updated = [meta, ...history.filter((b) => b.id !== meta.id)].slice(0, settings.keepHistoryCount);
    localStorage.setItem(BACKUP_HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Error storing backup history:", err);
  }
}

/**
 * Gets the list of past backups recorded by the system
 */
export function getBackupHistory(): BackupMetadata[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(BACKUP_HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Triggers an immediate automatic backup when a Daily Closing is registered.
 * Saves the JSON file to device Documents/Downloads and records metadata in history.
 */
export async function performAutomaticClosingBackup(
  state: AppState,
  closing: DailyClosing
): Promise<{ success: boolean; filename: string; message: string }> {
  const settings = getAutoBackupSettings();
  if (!settings.autoBackupOnClosing) {
    return {
      success: false,
      filename: "",
      message: "Respaldo automático desactivado en los ajustes.",
    };
  }

  try {
    const payload = buildBackupPayload(state, "DAILY_CLOSING_AUTO", closing.id);
    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });

    // Guardar en almacenamiento interno / descargas del teléfono o PC
    await saveToInternalOrDownload(blob, payload.metadata.filename);
    recordBackupInHistory(payload.metadata);

    console.info(`[AutoBackup] Respaldo automático de cierre Z generado con éxito: ${payload.metadata.filename}`);

    return {
      success: true,
      filename: payload.metadata.filename,
      message: `Respaldo automático del Cierre Z guardado con éxito (${payload.metadata.totalProducts} productos, ${payload.metadata.totalSales} ventas).`,
    };
  } catch (err: any) {
    console.error("[AutoBackup] Error generando respaldo automático de cierre Z:", err);
    return {
      success: false,
      filename: "",
      message: "No se pudo guardar el respaldo automático: " + (err?.message || "error desconocido"),
    };
  }
}

/**
 * Exports products and sales explicitly as requested
 */
export function buildProductsAndSalesJson(state: AppState): {
  blob: Blob;
  filename: string;
  summary: { productsCount: number; salesCount: number };
} {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const filename = `CajaMaster_Productos_y_Ventas_${dateStr}.json`;

  const payload = {
    appName: "CajaMaster POS",
    exportedAt: now.toISOString(),
    business: {
      name: state.business?.name || "CajaMaster POS",
      owner: state.business?.owner || "",
      taxId: state.business?.taxId || "",
    },
    inventorySummary: calculateInventorySummary(state.products || []),
    categories: state.categories || [],
    products: state.products || [],
    sales: state.sales || [],
    inventoryMovements: state.movements || [],
    closings: state.closings || [],
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });

  return {
    blob,
    filename,
    summary: {
      productsCount: state.products?.length || 0,
      salesCount: state.sales?.length || 0,
    },
  };
}
