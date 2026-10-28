import type { Sale, PaymentStatus } from "../types";
import { actions } from "../store";

export interface SyncStatusInfo {
  isBrowserOnline: boolean;
  isSyncing: boolean;
  pendingSyncCount: number;
  lastSyncTimestamp: number | null;
  lastSyncError: string | null;
}

let isSyncing = false;
let lastSyncTime: number | null = null;
let lastSyncErr: string | null = null;

const syncListeners = new Set<(info: SyncStatusInfo) => void>();

export function getSyncStatus(sales: Sale[]): SyncStatusInfo {
  const pending = sales.filter((s) => s.syncStatus === "pending_sync").length;
  return {
    isBrowserOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isSyncing,
    pendingSyncCount: pending,
    lastSyncTimestamp: lastSyncTime,
    lastSyncError: lastSyncErr,
  };
}

function notifySyncListeners(sales: Sale[]) {
  const info = getSyncStatus(sales);
  syncListeners.forEach((l) => l(info));
}

export function subscribeToSyncStatus(listener: (info: SyncStatusInfo) => void): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

/**
 * Synchronize all pending sales with the backend server (/api/sales/sync).
 */
export async function syncSalesWithBackend(sales: Sale[]): Promise<{ syncedCount: number; success: boolean }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { syncedCount: 0, success: false };
  }

  const unsynced = sales.filter((s) => s.syncStatus === "pending_sync");
  if (unsynced.length === 0) {
    return { syncedCount: 0, success: true };
  }

  isSyncing = true;
  notifySyncListeners(sales);

  try {
    const response = await fetch("/api/sales/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sales: unsynced.map((s) => ({
          ...s,
          estado_pago: s.paymentStatus || s.estado_pago || "COMPLETADO",
        })),
        syncedAt: Date.now(),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const syncedIds: string[] = data.syncedIds || unsynced.map((s) => s.id);
      
      // Update local state to mark them synced
      actions.markSalesSynced(syncedIds);

      // If any backend status changes were returned (e.g. pending gateway updated to COMPLETADO via webhook)
      if (Array.isArray(data.updatedStatuses)) {
        data.updatedStatuses.forEach((u: { id: string; status: PaymentStatus }) => {
          actions.updateSalePaymentStatus(u.id, u.status);
        });
      }

      lastSyncTime = Date.now();
      lastSyncErr = null;
      isSyncing = false;
      notifySyncListeners(sales);
      return { syncedCount: syncedIds.length, success: true };
    } else {
      throw new Error(`HTTP Error ${response.status}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("Could not sync sales with backend:", message);
    lastSyncErr = message;
    isSyncing = false;
    notifySyncListeners(sales);
    return { syncedCount: 0, success: false };
  }
}

/**
 * Poll backend for any updates on pending online gateway sales
 */
export async function pollPendingGatewaySales(sales: Sale[]): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const pendingSales = sales.filter(
    (s) => (s.paymentStatus === "PENDIENTE" || s.estado_pago === "PENDIENTE") && s.paymentMethod !== "cash"
  );

  if (pendingSales.length === 0) return;

  for (const sale of pendingSales) {
    try {
      const res = await fetch(`/api/payments/status/${encodeURIComponent(sale.id)}`);
      if (res.ok) {
        const info = await res.json();
        if (info.status && info.status !== "PENDIENTE") {
          actions.updateSalePaymentStatus(sale.id, info.status);
        }
      }
    } catch {
      // Non-blocking catch
    }
  }
}
