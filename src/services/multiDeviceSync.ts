import type {
  SyncConfig,
  DeviceRole,
  SyncConnectionMode,
  SyncConnectionStatus,
  ConnectedDevice,
  SyncNetworkEvent,
  OpenAccount,
  Sale,
  Product,
  Category,
  AppState,
} from "../types";
import { getPersistentDeviceId } from "../utils/licenseSecurity";

const getDeviceId = () => getPersistentDeviceId();

const SYNC_CONFIG_KEY = "cajamaster_sync_config_v2";

export interface NetworkInfoResponse {
  port: number;
  localIps: Array<{ name: string; ip: string; internal: boolean }>;
  primaryIp: string;
  hostname?: string;
  platform?: string;
  activeSyncRooms?: number;
  connectedSockets?: number;
}

export interface SyncStats {
  packetsSent: number;
  packetsReceived: number;
  lastSyncTimestamp: number;
  connectedAt?: number;
  reconnectAttempts: number;
}

type EventCallback<T = any> = (data: T) => void;

class MultiDeviceSyncService {
  private config: SyncConfig;
  private status: SyncConnectionStatus = "disconnected";
  private devices: ConnectedDevice[] = [];
  private ws: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private reconnectAttempts = 0;
  private stats: SyncStats = {
    packetsSent: 0,
    packetsReceived: 0,
    lastSyncTimestamp: 0,
    reconnectAttempts: 0,
  };

  private listeners = {
    status: new Set<EventCallback<SyncConnectionStatus>>(),
    devices: new Set<EventCallback<ConnectedDevice[]>>(),
    remoteAccount: new Set<EventCallback<{ account: OpenAccount; senderName: string; action: string }>>(),
    remoteAccountDelete: new Set<EventCallback<{ accountId: string; senderName: string }>>(),
    remoteSale: new Set<EventCallback<{ sale: Sale; senderName: string }>>(),
    remoteStock: new Set<EventCallback<{ productId: string; stock: number; senderName: string }>>(),
    remoteProduct: new Set<EventCallback<{ product: Product; senderName: string }>>(),
    remoteCategories: new Set<EventCallback<{ categories: Category[]; senderName: string }>>(),
    remoteSnapshot: new Set<EventCallback<{ state: AppState; senderName: string }>>(),
    stateRequested: new Set<EventCallback<{ requesterId: string; requesterName: string }>>(),
    toast: new Set<EventCallback<{ message: string; type: "info" | "success" | "warning" }>>(),
  };

  constructor() {
    this.config = this.loadConfig();
    this.initBroadcastChannel();
    this.checkUrlParameters();
  }

  private loadConfig(): SyncConfig {
    try {
      const saved = localStorage.getItem(SYNC_CONFIG_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("[SYNC] Error loading config:", e);
    }

    // Default configuration
    const randomRoom = "CM-" + Math.floor(1000 + Math.random() * 9000);
    return {
      enabled: true,
      role: "primary",
      connectionMode: "local",
      roomKey: randomRoom,
      deviceName: "Caja Central",
      autoSyncOnChanges: true,
    };
  }

  public saveConfig(newConfig: Partial<SyncConfig>) {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.error("[SYNC] Error saving config:", e);
    }

    if (!this.config.enabled) {
      this.disconnect();
    } else {
      this.reconnect();
    }
  }

  public getConfig(): SyncConfig {
    return { ...this.config };
  }

  public getStatus(): SyncConnectionStatus {
    return this.status;
  }

  public getDevices(): ConnectedDevice[] {
    const myId = getDeviceId();
    const selfDevice: ConnectedDevice = {
      deviceId: myId,
      deviceName: this.config.deviceName,
      role: this.config.role,
      mode: this.config.connectionMode,
      joinedAt: this.stats.connectedAt || Date.now(),
      lastPing: Date.now(),
      isSelf: true,
    };

    const others = this.devices.filter((d) => d.deviceId !== myId);
    return [selfDevice, ...others];
  }

  public getStats(): SyncStats {
    return { ...this.stats };
  }

  // Check URL params for instant pairing (e.g. from QR code scan)
  private checkUrlParameters() {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const syncRoom = params.get("syncRoom");
      const syncRole = params.get("syncRole") as DeviceRole | null;
      const syncHost = params.get("syncHost");
      const syncName = params.get("syncName");

      if (syncRoom) {
        const update: Partial<SyncConfig> = {
          roomKey: syncRoom,
          enabled: true,
        };
        if (syncRole) update.role = syncRole;
        if (syncHost) update.serverHost = syncHost;
        if (syncName) update.deviceName = syncName;
        else if (syncRole === "secondary" && this.config.deviceName === "Caja Central") {
          update.deviceName = "Comandero " + Math.floor(1 + Math.random() * 9);
        }

        this.saveConfig(update);
        // Clean URL to avoid re-triggering on reload
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, "", newUrl);
        this.emitToast("¡Conectado a la sala " + syncRoom + " mediante enlace de emparejamiento!", "success");
      }
    } catch (e) {
      console.error("[SYNC] Error parsing URL params:", e);
    }
  }

  private initBroadcastChannel() {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    try {
      this.broadcastChannel = new BroadcastChannel("cajamaster_local_multidevice_bus");
      this.broadcastChannel.onmessage = (event) => {
        const msg = event.data;
        if (msg && msg.roomKey === this.config.roomKey && msg.senderId !== getDeviceId()) {
          this.stats.packetsReceived++;
          this.stats.lastSyncTimestamp = Date.now();
          this.handleInboundSyncMessage(msg);
        }
      };
    } catch (e) {
      console.warn("[SYNC] BroadcastChannel not available", e);
    }
  }

  public start() {
    if (!this.config.enabled) {
      this.setStatus("disconnected");
      return;
    }
    this.connect();
  }

  public reconnect() {
    this.disconnect();
    this.start();
  }

  public disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    this.setStatus("disconnected");
    this.devices = [];
    this.notifyDevices();
  }

  private getWebSocketUrl(): string {
    if (typeof window === "undefined") return "";

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let host = window.location.host;

    if (this.config.connectionMode === "local" && this.config.serverHost) {
      host = this.config.serverHost.replace(/^https?:\/\//, "").replace(/^wss?:\/\//, "");
    }

    return `${protocol}//${host}/api/sync/ws`;
  }

  private connect() {
    if (!this.config.enabled) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus("connecting");
    const wsUrl = this.getWebSocketUrl();

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.stats.connectedAt = Date.now();
        this.setStatus("connected");

        // Send JOIN packet
        const joinPayload = {
          type: "join",
          roomKey: this.config.roomKey,
          deviceId: getDeviceId(),
          deviceName: this.config.deviceName,
          role: this.config.role,
          mode: this.config.connectionMode,
        };
        this.sendWsRaw(joinPayload);

        // If secondary, ask primary for initial snapshot
        if (this.config.role === "secondary") {
          setTimeout(() => {
            this.requestFullState();
          }, 300);
        }

        // Start heartbeat ping
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.stats.packetsReceived++;
          this.stats.lastSyncTimestamp = Date.now();
          this.handleInboundSyncMessage(msg);
        } catch (e) {
          console.error("[SYNC] Error processing incoming WS message:", e);
        }
      };

      this.ws.onclose = () => {
        this.setStatus("disconnected");
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn("[SYNC] WebSocket connection issue:", err);
        this.setStatus("error");
      };
    } catch (e) {
      console.error("[SYNC] Failed to construct WebSocket:", e);
      this.setStatus("error");
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.config.enabled) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectAttempts++;
    this.stats.reconnectAttempts = this.reconnectAttempts;

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendWsRaw({ type: "ping" });
      }
    }, 15000);
  }

  private sendWsRaw(payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
        this.stats.packetsSent++;
      } catch (e) {
        console.error("[SYNC] WS send failed:", e);
      }
    }
  }

  private broadcastToAll(message: any) {
    if (!this.config.enabled) return;

    const fullMessage = {
      ...message,
      roomKey: this.config.roomKey,
      senderId: getDeviceId(),
      senderName: this.config.deviceName,
      senderRole: this.config.role,
      timestamp: Date.now(),
    };

    // 1. Send via WebSocket to remote terminals
    this.sendWsRaw(fullMessage);

    // 2. Send via BroadcastChannel to local tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(fullMessage);
        this.stats.packetsSent++;
      } catch (e) {
        console.warn("[SYNC] BroadcastChannel send error:", e);
      }
    }

    this.stats.lastSyncTimestamp = Date.now();
  }

  private handleInboundSyncMessage(msg: any) {
    const { type, senderId, senderName } = msg;
    if (senderId === getDeviceId()) return; // ignore self

    switch (type) {
      case "presence": {
        if (Array.isArray(msg.devices)) {
          this.devices = msg.devices;
          this.notifyDevices();
        }
        break;
      }

      case "state:init":
      case "state:snapshot": {
        if (msg.state) {
          this.listeners.remoteSnapshot.forEach((cb) => cb({ state: msg.state, senderName: senderName || "Terminal Central" }));
          this.emitToast(`Estado general sincronizado desde ${senderName || "Terminal Central"}`, "info");
        }
        break;
      }

      case "state:request": {
        if (this.config.role === "primary") {
          this.listeners.stateRequested.forEach((cb) => cb({ requesterId: msg.requesterId, requesterName: msg.requesterName }));
        }
        break;
      }

      case "order:update":
      case "account:update": {
        if (msg.account) {
          this.listeners.remoteAccount.forEach((cb) => cb({ account: msg.account, senderName: senderName || "Camarero", action: msg.action || "updated" }));
          this.emitToast(`Comanda actualizada: ${msg.account.name} (por ${senderName || "Camarero"})`, "info");
        }
        break;
      }

      case "account:delete": {
        if (msg.accountId) {
          this.listeners.remoteAccountDelete.forEach((cb) => cb({ accountId: msg.accountId, senderName: senderName || "Camarero" }));
          this.emitToast(`Mesa/Cuenta cerrada desde ${senderName || "Camarero"}`, "info");
        }
        break;
      }

      case "sale:new": {
        if (msg.sale) {
          this.listeners.remoteSale.forEach((cb) => cb({ sale: msg.sale, senderName: senderName || "Caja" }));
          this.emitToast(`Venta #${msg.sale.ticketNumber} registrada por ${senderName || "Caja"}`, "success");
        }
        break;
      }

      case "stock:update": {
        if (msg.productId !== undefined && msg.stock !== undefined) {
          this.listeners.remoteStock.forEach((cb) => cb({ productId: msg.productId, stock: msg.stock, senderName: senderName || "Terminal" }));
        }
        break;
      }

      case "product:update": {
        if (msg.product) {
          this.listeners.remoteProduct.forEach((cb) => cb({ product: msg.product, senderName: senderName || "Terminal" }));
        }
        break;
      }

      case "category:update": {
        if (Array.isArray(msg.categories)) {
          this.listeners.remoteCategories.forEach((cb) => cb({ categories: msg.categories, senderName: senderName || "Terminal" }));
        }
        break;
      }

      default:
        break;
    }
  }

  private setStatus(newStatus: SyncConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.listeners.status.forEach((cb) => cb(newStatus));
    }
  }

  private notifyDevices() {
    const list = this.getDevices();
    this.listeners.devices.forEach((cb) => cb(list));
  }

  private emitToast(message: string, type: "info" | "success" | "warning") {
    this.listeners.toast.forEach((cb) => cb({ message, type }));
  }

  // --- OUTBOUND BROADCAST API ---

  public broadcastAccountUpdate(account: OpenAccount, action: "created" | "updated" = "updated") {
    if (!this.config.autoSyncOnChanges) return;
    this.broadcastToAll({
      type: "account:update",
      action,
      account,
    });
  }

  public broadcastAccountDelete(accountId: string) {
    if (!this.config.autoSyncOnChanges) return;
    this.broadcastToAll({
      type: "account:delete",
      accountId,
    });
  }

  public broadcastNewSale(sale: Sale) {
    this.broadcastToAll({
      type: "sale:new",
      sale,
    });
  }

  public broadcastStockUpdate(productId: string, stock: number) {
    this.broadcastToAll({
      type: "stock:update",
      productId,
      stock,
    });
  }

  public broadcastProductUpdate(product: Product) {
    this.broadcastToAll({
      type: "product:update",
      product,
    });
  }

  public broadcastCategoriesUpdate(categories: Category[]) {
    this.broadcastToAll({
      type: "category:update",
      categories,
    });
  }

  public broadcastFullStateSnapshot(state: AppState) {
    this.broadcastToAll({
      type: "state:snapshot",
      state: {
        categories: state.categories,
        products: state.products,
        rates: state.rates,
        openAccounts: state.openAccounts,
        business: state.business,
        ticketSequence: state.ticketSequence,
      },
    });
    this.emitToast("Catálogo y mesas transmitidos a todos los terminales", "success");
  }

  public requestFullState() {
    this.broadcastToAll({
      type: "state:request",
      requesterId: getDeviceId(),
      requesterName: this.config.deviceName,
    });
  }

  // --- SUBSCRIPTIONS ---

  public onStatusChange(cb: EventCallback<SyncConnectionStatus>): () => void {
    this.listeners.status.add(cb);
    cb(this.status);
    return () => this.listeners.status.delete(cb);
  }

  public onDevicesChange(cb: EventCallback<ConnectedDevice[]>): () => void {
    this.listeners.devices.add(cb);
    cb(this.getDevices());
    return () => this.listeners.devices.delete(cb);
  }

  public onRemoteAccount(cb: EventCallback<{ account: OpenAccount; senderName: string; action: string }>): () => void {
    this.listeners.remoteAccount.add(cb);
    return () => this.listeners.remoteAccount.delete(cb);
  }

  public onRemoteAccountDelete(cb: EventCallback<{ accountId: string; senderName: string }>): () => void {
    this.listeners.remoteAccountDelete.add(cb);
    return () => this.listeners.remoteAccountDelete.delete(cb);
  }

  public onRemoteSale(cb: EventCallback<{ sale: Sale; senderName: string }>): () => void {
    this.listeners.remoteSale.add(cb);
    return () => this.listeners.remoteSale.delete(cb);
  }

  public onRemoteStock(cb: EventCallback<{ productId: string; stock: number; senderName: string }>): () => void {
    this.listeners.remoteStock.add(cb);
    return () => this.listeners.remoteStock.delete(cb);
  }

  public onRemoteProduct(cb: EventCallback<{ product: Product; senderName: string }>): () => void {
    this.listeners.remoteProduct.add(cb);
    return () => this.listeners.remoteProduct.delete(cb);
  }

  public onRemoteCategories(cb: EventCallback<{ categories: Category[]; senderName: string }>): () => void {
    this.listeners.remoteCategories.add(cb);
    return () => this.listeners.remoteCategories.delete(cb);
  }

  public onRemoteSnapshot(cb: EventCallback<{ state: AppState; senderName: string }>): () => void {
    this.listeners.remoteSnapshot.add(cb);
    return () => this.listeners.remoteSnapshot.delete(cb);
  }

  public onStateRequested(cb: EventCallback<{ requesterId: string; requesterName: string }>): () => void {
    this.listeners.stateRequested.add(cb);
    return () => this.listeners.stateRequested.delete(cb);
  }

  public onToast(cb: EventCallback<{ message: string; type: "info" | "success" | "warning" }>): () => void {
    this.listeners.toast.add(cb);
    return () => this.listeners.toast.delete(cb);
  }

  // --- NETWORK INFO & PAIRING LINK UTILS ---

  public async fetchNetworkInfo(): Promise<NetworkInfoResponse | null> {
    try {
      const res = await fetch("/api/sync/network-info");
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("[SYNC] Could not fetch network info from API", e);
    }
    return null;
  }

  public generatePairingLink(role: DeviceRole = "secondary"): string {
    if (typeof window === "undefined") return "";
    const origin = window.location.origin;
    const room = encodeURIComponent(this.config.roomKey);
    const roleParam = encodeURIComponent(role);
    const hostParam = encodeURIComponent(this.config.serverHost || window.location.host);

    return `${origin}/?syncRoom=${room}&syncRole=${roleParam}&syncHost=${hostParam}`;
  }

  public getPairingLink(role: DeviceRole = "secondary"): string {
    return this.generatePairingLink(role);
  }

  public getConnectedDevices(): ConnectedDevice[] {
    return this.getDevices();
  }

  public onDevicesListChange(cb: EventCallback<ConnectedDevice[]>): () => void {
    return this.onDevicesChange(cb);
  }

  public updateConfig(newConfig: Partial<SyncConfig>) {
    this.saveConfig(newConfig);
  }
}

export const syncService = new MultiDeviceSyncService();
