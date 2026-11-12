import { Peer, type DataConnection } from "peerjs";
import mqtt, { type MqttClient } from "mqtt";
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
import { isNativePlatform, getLocalIp, startSyncServer, stopSyncServer } from "../utils/nativeBridge";

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
  isCloudContainer?: boolean;
}

export interface SyncStats {
  packetsSent: number;
  packetsReceived: number;
  lastSyncTimestamp: number;
  connectedAt?: number;
  reconnectAttempts: number;
  p2pPeersCount?: number;
  mqttConnected?: boolean;
  wsConnected?: boolean;
}

type EventCallback<T = any> = (data: T) => void;

class MultiDeviceSyncService {
  private config: SyncConfig;
  private status: SyncConnectionStatus = "disconnected";
  private devices: ConnectedDevice[] = [];
  
  // Transports
  private ws: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private peer: Peer | null = null;
  private peerConnections: Map<string, DataConnection> = new Map();
  private hostConnection: DataConnection | null = null;
  private mqttClient: MqttClient | null = null;
  
  // Timers
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private cleanupTimer: any = null;
  private reconnectAttempts = 0;
  
  // Message deduplication
  private processedMsgIds = new Set<string>();
  
  private stats: SyncStats = {
    packetsSent: 0,
    packetsReceived: 0,
    lastSyncTimestamp: 0,
    reconnectAttempts: 0,
    p2pPeersCount: 0,
    mqttConnected: false,
    wsConnected: false,
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

  private detectedLocalIp: string = "127.0.0.1";

  constructor() {
    this.config = this.loadConfig();
    this.initBroadcastChannel();
    this.checkUrlParameters();
    this.startPeriodicCleanup();
    this.detectLocalNetwork();
  }

  private async detectLocalNetwork() {
    try {
      const ip = await getLocalIp();
      if (ip && ip !== "127.0.0.1") {
        this.detectedLocalIp = ip;
      }
    } catch {}
  }

  private loadConfig(): SyncConfig {
    try {
      const saved = localStorage.getItem(SYNC_CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          enabled: parsed.enabled ?? true,
          role: parsed.role || "primary",
          // Default to cloud if not explicitly set to something else
          connectionMode: parsed.connectionMode || "cloud",
          roomKey: parsed.roomKey || ("CM-" + Math.floor(1000 + Math.random() * 9000)),
          deviceName: parsed.deviceName || (parsed.role === "secondary" ? "Terminal Móvil" : "Caja Central"),
          serverHost: parsed.serverHost,
          autoSyncOnChanges: parsed.autoSyncOnChanges ?? true,
        };
      }
    } catch (e) {
      console.error("[SYNC] Error loading config:", e);
    }

    // Default configuration (Cloud mode by default for zero-config Internet & P2P pairing)
    const randomRoom = "CM-" + Math.floor(1000 + Math.random() * 9000);
    return {
      enabled: true,
      role: "primary",
      connectionMode: "cloud",
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

  // Alias for compatibility with components calling configure
  public configure(newConfig: Partial<SyncConfig>) {
    this.saveConfig(newConfig);
  }

  public updateConfig(newConfig: Partial<SyncConfig>) {
    this.saveConfig(newConfig);
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

    const now = Date.now();
    // Filter out inactive devices older than 45 seconds (except self)
    const others = this.devices.filter((d) => d.deviceId !== myId && now - d.lastPing < 45000);
    return [selfDevice, ...others];
  }

  public getStats(): SyncStats {
    return {
      ...this.stats,
      p2pPeersCount: this.peerConnections.size + (this.hostConnection ? 1 : 0),
    };
  }

  // Check URL params for instant pairing (e.g. from QR code scan or share link)
  private checkUrlParameters() {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const syncRoom = params.get("syncRoom") || params.get("roomKey") || params.get("room");
      const syncRole = (params.get("syncRole") || params.get("role")) as DeviceRole | null;
      const syncHost = params.get("syncHost") || params.get("serverHost") || params.get("host");
      const syncName = params.get("syncName") || params.get("deviceName");
      const syncMode = (params.get("syncMode") || params.get("mode")) as SyncConnectionMode | null;

      if (syncRoom) {
        const update: Partial<SyncConfig> = {
          roomKey: syncRoom.toUpperCase().trim(),
          enabled: true,
        };
        if (syncRole) update.role = syncRole;
        if (syncHost) update.serverHost = syncHost;
        if (syncMode) update.connectionMode = syncMode;
        if (syncName) update.deviceName = syncName;
        else if (syncRole === "secondary" && (this.config.deviceName === "Caja Central" || !this.config.deviceName)) {
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
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    // 1. Close local WebSocket
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.stats.wsConnected = false;

    // 2. Close WebRTC PeerJS
    if (this.hostConnection) {
      try {
        this.hostConnection.close();
      } catch (e) {}
      this.hostConnection = null;
    }
    for (const conn of this.peerConnections.values()) {
      try {
        conn.close();
      } catch (e) {}
    }
    this.peerConnections.clear();
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {}
      this.peer = null;
    }
    this.stats.p2pPeersCount = 0;

    // 3. Close Cloud MQTT Client
    if (this.mqttClient) {
      try {
        this.mqttClient.end(true);
      } catch (e) {}
      this.mqttClient = null;
    }
    this.stats.mqttConnected = false;

    this.setStatus("disconnected");
    this.devices = [];
    this.notifyDevices();
  }

  private connect() {
    if (!this.config.enabled) return;

    this.setStatus("connecting");

    // Start heartbeat
    this.startHeartbeat();

    // CONNECT TRANSPORTS BASED ON MODE
    if (this.config.connectionMode === "cloud") {
      // CLOUD / UNIVERSAL MODE:
      // Run WebRTC (PeerJS) AND Public MQTT over WSS in parallel
      this.connectCloudWebRtc();
      this.connectCloudMqtt();
    } else {
      // LOCAL WI-FI MODE:
      // Connect to local Node/Vite server WebSocket
      this.connectLocalWebSocket();
    }
  }

  // ----------------------------------------------------
  // TRANSPORT 1: WEBRTC P2P (PeerJS)
  // ----------------------------------------------------
  private connectCloudWebRtc() {
    if (typeof window === "undefined") return;
    try {
      const sanitizedRoom = this.config.roomKey.toLowerCase().replace(/[^a-z0-9]/g, "");
      const isPrimary = this.config.role === "primary";

      // STUN configuration for NAT traversal
      const peerOptions = {
        debug: 0,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun.cloudflare.com:3478" },
          ],
        },
      };

      if (isPrimary) {
        // Primary Host / Caja Central uses a predictable room peer ID
        const hostPeerId = `cajamaster-room-${sanitizedRoom}`;
        this.peer = new Peer(hostPeerId, peerOptions);

        this.peer.on("open", (id) => {
          console.log("[SYNC-PEER] Host abierto con ID:", id);
          this.stats.connectedAt = Date.now();
          this.setStatus("connected");
        });

        this.peer.on("connection", (conn) => {
          console.log("[SYNC-PEER] Conexión entrante de terminal:", conn.peer);
          this.setupPeerDataConnection(conn);
        });

        this.peer.on("error", (err: any) => {
          console.warn("[SYNC-PEER] Host peer error:", err?.type || err?.message);
          // If ID is already taken by a recent session or reload, connect client-side or wait
          if (err?.type === "unavailable-id") {
            console.log("[SYNC-PEER] El ID del host ya está registrado. Conectando como peer dinámico.");
          }
        });
      } else {
        // Secondary terminal / Camarero / Móvil generates a unique peer ID and connects to Host
        const clientPeerId = `cm-cli-${getDeviceId().slice(0, 6)}-${Math.floor(Math.random() * 10000)}`;
        this.peer = new Peer(clientPeerId, peerOptions);

        this.peer.on("open", () => {
          const hostPeerId = `cajamaster-room-${sanitizedRoom}`;
          console.log("[SYNC-PEER] Cliente abierto. Conectando con Host:", hostPeerId);
          const conn = this.peer!.connect(hostPeerId, { reliable: true });
          this.hostConnection = conn;
          this.setupPeerDataConnection(conn);
        });

        this.peer.on("error", (err) => {
          console.warn("[SYNC-PEER] Client peer issue:", err);
        });
      }
    } catch (e) {
      console.warn("[SYNC-PEER] Error initializing PeerJS:", e);
    }
  }

  private setupPeerDataConnection(conn: DataConnection) {
    conn.on("open", () => {
      console.log("[SYNC-PEER] Canal de datos WebRTC ABIERTO con:", conn.peer);
      this.peerConnections.set(conn.peer, conn);
      this.stats.p2pPeersCount = this.peerConnections.size;
      this.setStatus("connected");

      // Send JOIN packet immediately
      const joinPayload = {
        type: "join",
        roomKey: this.config.roomKey,
        deviceId: getDeviceId(),
        deviceName: this.config.deviceName,
        role: this.config.role,
        mode: this.config.connectionMode,
        timestamp: Date.now(),
      };
      this.sendPeerSingle(conn, joinPayload);

      // If secondary, request full initial snapshot
      if (this.config.role === "secondary") {
        setTimeout(() => {
          this.requestFullState();
        }, 300);
      }
    });

    conn.on("data", (data: any) => {
      this.stats.packetsReceived++;
      this.stats.lastSyncTimestamp = Date.now();
      this.handleInboundSyncMessage(data);
    });

    conn.on("close", () => {
      console.log("[SYNC-PEER] Conexión P2P cerrada con:", conn.peer);
      this.peerConnections.delete(conn.peer);
      if (this.hostConnection === conn) {
        this.hostConnection = null;
      }
      this.stats.p2pPeersCount = this.peerConnections.size;
      this.notifyDevices();
    });

    conn.on("error", (err) => {
      console.warn("[SYNC-PEER] Error en canal de datos P2P:", err);
    });
  }

  private sendPeerSingle(conn: DataConnection, payload: any) {
    if (conn && conn.open) {
      try {
        conn.send(payload);
        this.stats.packetsSent++;
      } catch (e) {
        console.warn("[SYNC-PEER] Error sending to peer:", e);
      }
    }
  }

  // ----------------------------------------------------
  // TRANSPORT 2: CLOUD MQTT RELAY OVER WSS (PORT 443 / 8884)
  // ----------------------------------------------------
  private connectCloudMqtt() {
    if (typeof window === "undefined") return;
    try {
      const sanitizedRoom = this.config.roomKey.toUpperCase().trim();
      const topic = `cajamaster/sync/${sanitizedRoom}`;
      
      // Public, rock-solid broker with secure WebSockets
      const brokerUrl = "wss://broker.hivemq.com:8884/mqtt";
      const clientId = `cm_${getDeviceId().slice(0, 8)}_${Math.floor(Math.random() * 10000)}`;

      this.mqttClient = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 7000,
        reconnectPeriod: 6000,
      });

      this.mqttClient.on("connect", () => {
        console.log("[SYNC-MQTT] Conectado a la nube MQTT. Suscribiendo a:", topic);
        this.stats.mqttConnected = true;
        this.stats.connectedAt = this.stats.connectedAt || Date.now();
        this.setStatus("connected");

        this.mqttClient?.subscribe(topic, { qos: 0 }, (err) => {
          if (!err) {
            // Send JOIN message
            this.sendMqttRaw({
              type: "join",
              roomKey: this.config.roomKey,
              deviceId: getDeviceId(),
              deviceName: this.config.deviceName,
              role: this.config.role,
              mode: this.config.connectionMode,
              timestamp: Date.now(),
            });

            if (this.config.role === "secondary") {
              setTimeout(() => {
                this.requestFullState();
              }, 400);
            }
          }
        });
      });

      this.mqttClient.on("message", (_t, payload) => {
        try {
          const raw = payload.toString();
          const msg = JSON.parse(raw);
          this.stats.packetsReceived++;
          this.stats.lastSyncTimestamp = Date.now();
          this.handleInboundSyncMessage(msg);
        } catch (e) {
          console.error("[SYNC-MQTT] Error parsing MQTT message:", e);
        }
      });

      this.mqttClient.on("error", (err) => {
        console.warn("[SYNC-MQTT] MQTT connection issue:", err);
      });

      this.mqttClient.on("close", () => {
        this.stats.mqttConnected = false;
      });
    } catch (e) {
      console.warn("[SYNC-MQTT] Failed to start MQTT relay:", e);
    }
  }

  private sendMqttRaw(payload: any) {
    if (this.mqttClient && this.mqttClient.connected) {
      try {
        const sanitizedRoom = this.config.roomKey.toUpperCase().trim();
        const topic = `cajamaster/sync/${sanitizedRoom}`;
        this.mqttClient.publish(topic, JSON.stringify(payload), { qos: 0 });
        this.stats.packetsSent++;
      } catch (e) {
        console.warn("[SYNC-MQTT] Failed to publish message:", e);
      }
    }
  }

  private getWebSocketUrl(): string {
    if (typeof window === "undefined") return "";

    if (isNativePlatform()) {
      if (this.config.role === "primary") {
        return "ws://127.0.0.1:8787";
      }
      if (this.config.serverHost) {
        let clean = this.config.serverHost.replace(/^https?:\/\//, "").replace(/^wss?:\/\//, "");
        if (!clean.includes(":")) clean += ":8787";
        return `ws://${clean}`;
      }
      return "ws://127.0.0.1:8787";
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let host = window.location.host;

    if (this.config.connectionMode === "local" && this.config.serverHost) {
      host = this.config.serverHost.replace(/^https?:\/\//, "").replace(/^wss?:\/\//, "");
    }

    return `${protocol}//${host}/api/sync/ws`;
  }

  private async connectLocalWebSocket() {
    if (isNativePlatform() && this.config.role === "primary") {
      try {
        await startSyncServer(8787);
      } catch (err) {
        console.warn("[SYNC] Could not start native sync server:", err);
      }
    }

    const wsUrl = this.getWebSocketUrl();
    if (!wsUrl) return;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.stats.wsConnected = true;
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
          timestamp: Date.now(),
        };
        this.sendWsRaw(joinPayload);

        // If secondary, ask primary for initial snapshot
        if (this.config.role === "secondary") {
          setTimeout(() => {
            this.requestFullState();
          }, 300);
        }
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
        this.stats.wsConnected = false;
        if (this.config.connectionMode === "local") {
          this.setStatus("disconnected");
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn("[SYNC] WebSocket connection issue:", err);
        if (this.config.connectionMode === "local") {
          this.setStatus("error");
        }
      };
    } catch (e) {
      console.error("[SYNC] Failed to construct WebSocket:", e);
      if (this.config.connectionMode === "local") {
        this.setStatus("error");
        this.scheduleReconnect();
      }
    }
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

  private scheduleReconnect() {
    if (!this.config.enabled) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectAttempts++;
    this.stats.reconnectAttempts = this.reconnectAttempts;

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 12000);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (!this.config.enabled) return;

      const pingPayload = {
        type: "ping",
        roomKey: this.config.roomKey,
        deviceId: getDeviceId(),
        deviceName: this.config.deviceName,
        role: this.config.role,
        mode: this.config.connectionMode,
        timestamp: Date.now(),
      };

      // Broadcast heartbeat over active channels
      this.sendWsRaw(pingPayload);
      this.sendMqttRaw(pingPayload);
      if (this.hostConnection && this.hostConnection.open) {
        this.sendPeerSingle(this.hostConnection, pingPayload);
      }
      for (const peerConn of this.peerConnections.values()) {
        this.sendPeerSingle(peerConn, pingPayload);
      }
    }, 12000);
  }

  private startPeriodicCleanup() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const initialCount = this.devices.length;
      this.devices = this.devices.filter((d) => now - d.lastPing < 45000);
      if (this.devices.length !== initialCount) {
        this.notifyDevices();
      }
    }, 15000);
  }

  // Unified outbound broadcast across all channels
  private broadcastToAll(message: any) {
    if (!this.config.enabled) return;

    // Unique message ID for deduplication across dual transports
    const msgId = `${getDeviceId()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.processedMsgIds.add(msgId);

    const fullMessage = {
      ...message,
      msgId,
      roomKey: this.config.roomKey,
      senderId: getDeviceId(),
      senderName: this.config.deviceName,
      senderRole: this.config.role,
      senderMode: this.config.connectionMode,
      timestamp: Date.now(),
    };

    // 1. Send via WebRTC P2P DataChannels
    if (this.hostConnection && this.hostConnection.open) {
      this.sendPeerSingle(this.hostConnection, fullMessage);
    }
    for (const peerConn of this.peerConnections.values()) {
      this.sendPeerSingle(peerConn, fullMessage);
    }

    // 2. Send via Cloud MQTT Relay
    this.sendMqttRaw(fullMessage);

    // 3. Send via local WebSocket
    this.sendWsRaw(fullMessage);

    // 4. Send via BroadcastChannel to local tabs
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
    if (!msg || typeof msg !== "object") return;
    const { type, senderId, senderName, senderRole, senderMode, msgId, roomKey } = msg;

    // Ignore self messages
    if (senderId === getDeviceId()) return;

    // Verify roomKey if specified
    if (roomKey && roomKey.toUpperCase() !== this.config.roomKey.toUpperCase()) {
      return;
    }

    // Deduplication check
    if (msgId) {
      if (this.processedMsgIds.has(msgId)) return;
      this.processedMsgIds.add(msgId);

      // Memory limit for deduplication cache
      if (this.processedMsgIds.size > 800) {
        const iter = this.processedMsgIds.values();
        for (let i = 0; i < 200; i++) {
          const val = iter.next().value;
          if (val) this.processedMsgIds.delete(val);
        }
      }
    }

    // Track/update device presence
    if (senderId) {
      this.trackDevicePresence(senderId, senderName, senderRole, senderMode);
    }

    // If we are Host and receive an order/message, relay to other P2P peers
    if (this.config.role === "primary" && type !== "ping" && type !== "pong" && type !== "presence") {
      for (const peerConn of this.peerConnections.values()) {
        if (peerConn.peer !== senderId) {
          this.sendPeerSingle(peerConn, msg);
        }
      }
    }

    switch (type) {
      case "join": {
        // If we are primary and a secondary device joins, immediately send current state snapshot
        if (this.config.role === "primary") {
          this.emitToast(`📱 Terminal conectado: ${senderName || "Nuevo dispositivo"}`, "info");
          setTimeout(() => {
            this.listeners.stateRequested.forEach((cb) =>
              cb({ requesterId: senderId, requesterName: senderName || "Terminal" })
            );
          }, 200);
        }
        break;
      }

      case "ping": {
        // Heartbeat received, presence already updated
        break;
      }

      case "presence": {
        if (Array.isArray(msg.devices)) {
          for (const d of msg.devices) {
            if (d.deviceId && d.deviceId !== getDeviceId()) {
              this.trackDevicePresence(d.deviceId, d.deviceName, d.role, d.mode);
            }
          }
        }
        break;
      }

      case "state:init":
      case "state:snapshot": {
        if (msg.state) {
          this.listeners.remoteSnapshot.forEach((cb) =>
            cb({ state: msg.state, senderName: senderName || "Terminal Central" })
          );
          this.emitToast(`Catálogo y mesas sincronizados desde ${senderName || "Terminal Central"}`, "success");
        }
        break;
      }

      case "state:request": {
        if (this.config.role === "primary") {
          this.listeners.stateRequested.forEach((cb) =>
            cb({ requesterId: senderId, requesterName: senderName })
          );
        }
        break;
      }

      case "order:update":
      case "account:update": {
        if (msg.account) {
          this.listeners.remoteAccount.forEach((cb) =>
            cb({ account: msg.account, senderName: senderName || "Camarero", action: msg.action || "updated" })
          );
          this.emitToast(`Comanda actualizada: ${msg.account.name} (por ${senderName || "Camarero"})`, "info");
        }
        break;
      }

      case "account:delete": {
        if (msg.accountId) {
          this.listeners.remoteAccountDelete.forEach((cb) =>
            cb({ accountId: msg.accountId, senderName: senderName || "Camarero" })
          );
          this.emitToast(`Mesa/Cuenta cerrada desde ${senderName || "Camarero"}`, "info");
        }
        break;
      }

      case "sale:new": {
        if (msg.sale) {
          this.listeners.remoteSale.forEach((cb) =>
            cb({ sale: msg.sale, senderName: senderName || "Caja" })
          );
          this.emitToast(`Venta #${msg.sale.ticketNumber} registrada por ${senderName || "Caja"}`, "success");
        }
        break;
      }

      case "stock:update": {
        if (msg.productId !== undefined && msg.stock !== undefined) {
          this.listeners.remoteStock.forEach((cb) =>
            cb({ productId: msg.productId, stock: msg.stock, senderName: senderName || "Terminal" })
          );
        }
        break;
      }

      case "product:update": {
        if (msg.product) {
          this.listeners.remoteProduct.forEach((cb) =>
            cb({ product: msg.product, senderName: senderName || "Terminal" })
          );
        }
        break;
      }

      case "category:update": {
        if (Array.isArray(msg.categories)) {
          this.listeners.remoteCategories.forEach((cb) =>
            cb({ categories: msg.categories, senderName: senderName || "Terminal" })
          );
        }
        break;
      }

      default:
        break;
    }
  }

  private trackDevicePresence(
    deviceId: string,
    deviceName?: string,
    role?: DeviceRole,
    mode?: SyncConnectionMode
  ) {
    const existingIndex = this.devices.findIndex((d) => d.deviceId === deviceId);
    const updatedDevice: ConnectedDevice = {
      deviceId,
      deviceName: deviceName || (role === "primary" ? "Caja Central" : "Terminal"),
      role: role || "secondary",
      mode: mode || this.config.connectionMode,
      joinedAt: existingIndex >= 0 ? this.devices[existingIndex].joinedAt : Date.now(),
      lastPing: Date.now(),
      isSelf: false,
    };

    if (existingIndex >= 0) {
      this.devices[existingIndex] = updatedDevice;
    } else {
      this.devices.push(updatedDevice);
    }

    this.notifyDevices();
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
        deliveries: state.deliveries,
        drivers: state.drivers,
        deliveryAgencies: state.deliveryAgencies,
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

  public async fetchNetworkInfo(): Promise<NetworkInfoResponse | null> {
    if (isNativePlatform()) {
      try {
        const ip = await getLocalIp();
        if (ip) {
          this.detectedLocalIp = ip;
          return {
            port: 8787,
            localIps: [{ name: "wlan0", ip, internal: false }],
            primaryIp: ip,
            hostname: "cajamaster-pos",
            platform: "android",
            activeSyncRooms: 1,
            connectedSockets: 1,
            isCloudContainer: false,
          };
        }
      } catch (e) {
        console.warn("[SYNC] Could not fetch native network info", e);
      }
    }

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

  public generatePairingLink(role: DeviceRole = "secondary", overrideHost?: string): string {
    if (typeof window === "undefined") return "";

    const room = encodeURIComponent(this.config.roomKey);
    const roleParam = encodeURIComponent(role);
    const mode = this.config.connectionMode;

    if (mode === "cloud") {
      // In cloud mode, the pairing payload is universal and does not depend on local IP
      let origin = window.location.origin;
      if (!origin || origin.includes("localhost") || origin === "null") {
        origin = "https://cajamaster.app";
      }
      return `${origin}/?syncRoom=${room}&syncRole=${roleParam}&syncMode=cloud`;
    }

    // In local Wi-Fi mode:
    let host = overrideHost || this.config.serverHost;
    if (!host && isNativePlatform() && this.detectedLocalIp && this.detectedLocalIp !== "127.0.0.1") {
      host = `${this.detectedLocalIp}:8787`;
    }
    let origin = window.location.origin;
    if (host) {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      origin = `${protocol}//${host.replace(/^https?:\/\//, "")}`;
    }
    const hostParam = encodeURIComponent(host || (isNativePlatform() && this.detectedLocalIp !== "127.0.0.1" ? `${this.detectedLocalIp}:8787` : window.location.host));
    return `${origin}/?syncRoom=${room}&syncRole=${roleParam}&syncHost=${hostParam}&syncMode=local`;
  }

  public getPairingLink(role: DeviceRole = "secondary", overrideHost?: string): string {
    return this.generatePairingLink(role, overrideHost);
  }

  public getConnectedDevices(): ConnectedDevice[] {
    return this.getDevices();
  }

  public onDevicesListChange(cb: EventCallback<ConnectedDevice[]>): () => void {
    return this.onDevicesChange(cb);
  }

  /**
   * Processes a QR code payload scanned from within the application,
   * extracts the roomKey, role, serverHost, deviceName, and connectionMode,
   * configures the local device and immediately connects/synchronizes.
   */
  public pairFromQrCode(qrData: string): {
    success: boolean;
    message: string;
    config?: Partial<SyncConfig>;
    details?: { roomKey: string; serverHost?: string; role: DeviceRole; deviceName?: string; mode?: SyncConnectionMode };
  } {
    if (!qrData || typeof qrData !== "string") {
      return { success: false, message: "Contenido del código QR vacío o inválido." };
    }

    const trimmed = qrData.trim();
    let roomKey = "";
    let role: DeviceRole = "secondary";
    let serverHost: string | undefined = undefined;
    let deviceName: string | undefined = undefined;
    let connectionMode: SyncConnectionMode = "cloud"; // Default to cloud for universal cross-device pairing

    try {
      // 1. Try URL parsing
      if (
        trimmed.includes("?") ||
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.includes("syncRoom=") ||
        trimmed.includes("roomKey=") ||
        trimmed.includes("room=")
      ) {
        let queryString = "";
        if (trimmed.includes("?")) {
          queryString = trimmed.substring(trimmed.indexOf("?"));
        } else if (trimmed.includes("&") || trimmed.includes("=")) {
          queryString = `?${trimmed}`;
        }
        const params = new URLSearchParams(queryString);
        const parsedRoom = params.get("syncRoom") || params.get("roomKey") || params.get("room");
        if (parsedRoom) roomKey = parsedRoom;
        const parsedRole = params.get("syncRole") || params.get("role");
        if (parsedRole === "primary" || parsedRole === "secondary") role = parsedRole;
        const parsedHost = params.get("syncHost") || params.get("serverHost") || params.get("host");
        if (parsedHost) serverHost = parsedHost;
        const parsedName = params.get("syncName") || params.get("deviceName");
        if (parsedName) deviceName = parsedName;
        const parsedMode = params.get("syncMode") || params.get("mode");
        if (parsedMode === "local" || parsedMode === "cloud") {
          connectionMode = parsedMode;
        } else if (serverHost && (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(serverHost) || serverHost.includes("localhost"))) {
          connectionMode = "local";
        }
      }

      // 2. Try JSON parsing
      if (!roomKey && trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.roomKey || parsed.room || parsed.syncRoom) {
            roomKey = parsed.roomKey || parsed.room || parsed.syncRoom;
            if (parsed.role) role = parsed.role;
            if (parsed.serverHost || parsed.syncHost || parsed.host) {
              serverHost = parsed.serverHost || parsed.syncHost || parsed.host;
            }
            if (parsed.deviceName || parsed.name) deviceName = parsed.deviceName || parsed.name;
            if (parsed.connectionMode || parsed.mode) connectionMode = parsed.connectionMode || parsed.mode;
          }
        } catch {
          // not json
        }
      }

      // 3. Fallback: Check if it's a plain room key like "CM-1234"
      if (!roomKey) {
        if (/^CM-\d{3,6}$/i.test(trimmed)) {
          roomKey = trimmed.toUpperCase();
        } else if (trimmed.toLowerCase().includes("roomkey=")) {
          const match = trimmed.match(/roomkey=([a-zA-Z0-9_-]+)/i);
          if (match) roomKey = match[1];
        } else if (/^[a-zA-Z0-9_-]{3,16}$/.test(trimmed)) {
          roomKey = trimmed.toUpperCase();
        }
      }

      if (!roomKey) {
        return {
          success: false,
          message: "El código escaneado no contiene una clave de sala de CajaMaster reconocida.",
        };
      }

      roomKey = roomKey.toUpperCase().trim();

      // Determine default name for secondary
      if (!deviceName) {
        if (role === "secondary" && (this.config.deviceName === "Caja Central" || !this.config.deviceName)) {
          deviceName = `Comandero ${Math.floor(1 + Math.random() * 9)}`;
        } else {
          deviceName = this.config.deviceName;
        }
      }

      const update: Partial<SyncConfig> = {
        enabled: true,
        roomKey,
        role,
        deviceName,
        connectionMode,
      };
      if (serverHost) {
        update.serverHost = serverHost;
      }

      this.saveConfig(update);
      this.emitToast(`¡Vinculado con éxito a la sala ${roomKey}!`, "success");

      return {
        success: true,
        message: `¡Vinculado con éxito a la sala ${roomKey}!`,
        config: update,
        details: {
          roomKey,
          serverHost,
          role,
          deviceName,
          mode: connectionMode,
        },
      };
    } catch (e: any) {
      console.error("[SYNC] Error in pairFromQrCode:", e);
      return {
        success: false,
        message: "Error al procesar el código: " + (e?.message || "formato no reconocido"),
      };
    }
  }
}

export const syncService = new MultiDeviceSyncService();
