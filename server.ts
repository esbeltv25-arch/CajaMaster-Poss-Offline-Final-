import express, { Request, Response } from "express";
import http from "http";
import os from "os";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

interface ServerSaleRecord {
  id: string;
  ticketNumber: number;
  ts: number;
  total: number;
  paymentMethod: string;
  paymentStatus: "COMPLETADO" | "PENDIENTE" | "FALLIDO" | "CANCELADO";
  estado_pago: "COMPLETADO" | "PENDIENTE" | "FALLIDO" | "CANCELADO";
  gatewayReference?: string;
  gatewayPayload?: any;
  syncedAt: number;
  raw?: any;
}

interface ConnectedClientInfo {
  ws: WebSocket;
  deviceId: string;
  deviceName: string;
  role: "primary" | "secondary";
  roomKey: string;
  mode: "local" | "cloud";
  joinedAt: number;
  lastPing: number;
  ip: string;
}

// In-memory backend database of transactions and gateway status records
const salesDatabase = new Map<string, ServerSaleRecord>();
const webhookEventLogs: Array<{
  id: string;
  timestamp: number;
  provider: string;
  saleId?: string;
  payload: any;
  actionTaken: string;
}> = [];

// Multi-device sync rooms and state snapshots
const syncRooms = new Map<string, Map<string, ConnectedClientInfo>>();
const roomSnapshots = new Map<string, { state: any; updatedAt: number; masterDeviceId?: string }>();

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // JSON Body Parser for API and Webhook payloads
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Request logger for API calls
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // ----------------------------------------------------
  // WEBSOCKET MULTI-DEVICE SYNC ENGINE
  // ----------------------------------------------------
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : "";
    if (pathname === "/api/sync/ws" || pathname === "/api/ws" || pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  function broadcastPresence(roomKey: string) {
    const room = syncRooms.get(roomKey);
    if (!room) return;

    const devices = Array.from(room.values()).map((c) => ({
      deviceId: c.deviceId,
      deviceName: c.deviceName,
      role: c.role,
      mode: c.mode,
      joinedAt: c.joinedAt,
      lastPing: c.lastPing,
      ip: c.ip,
    }));

    const message = JSON.stringify({
      type: "presence",
      roomKey,
      devices,
      timestamp: Date.now(),
    });

    for (const client of room.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
        } catch (e) {
          console.error("[WS BROADCAST ERROR]", e);
        }
      }
    }
  }

  function broadcastToRoom(roomKey: string, message: any, excludeDeviceId?: string) {
    const room = syncRooms.get(roomKey);
    if (!room) return;

    const payload = typeof message === "string" ? message : JSON.stringify(message);

    for (const client of room.values()) {
      if (excludeDeviceId && client.deviceId === excludeDeviceId) continue;
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(payload);
        } catch (e) {
          console.error("[WS SEND ERROR]", e);
        }
      }
    }
  }

  wss.on("connection", (ws: WebSocket, req) => {
    let clientInfo: ConnectedClientInfo | null = null;
    const clientIp = req.socket.remoteAddress || "127.0.0.1";

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const { type } = msg;

        switch (type) {
          case "join": {
            const { roomKey = "DEFAULT_ROOM", deviceId, deviceName, role = "secondary", mode = "local" } = msg;
            if (!deviceId) return;

            if (!syncRooms.has(roomKey)) {
              syncRooms.set(roomKey, new Map());
            }

            const room = syncRooms.get(roomKey)!;
            clientInfo = {
              ws,
              deviceId,
              deviceName: deviceName || (role === "primary" ? "Caja Principal" : "Terminal Móvil"),
              role,
              roomKey,
              mode,
              joinedAt: Date.now(),
              lastPing: Date.now(),
              ip: clientIp,
            };

            room.set(deviceId, clientInfo);
            console.log(`[WS SYNC] Device joined: ${clientInfo.deviceName} (${deviceId}) [${role}] in room ${roomKey}. Active in room: ${room.size}`);

            // Send confirmation back
            ws.send(
              JSON.stringify({
                type: "joined",
                roomKey,
                deviceId,
                role,
                serverTime: Date.now(),
              })
            );

            // Send cached snapshot if available and device is secondary
            const snapshot = roomSnapshots.get(roomKey);
            if (snapshot && role === "secondary") {
              ws.send(
                JSON.stringify({
                  type: "state:init",
                  roomKey,
                  state: snapshot.state,
                  updatedAt: snapshot.updatedAt,
                  masterDeviceId: snapshot.masterDeviceId,
                })
              );
            }

            // Notify all peers in room
            broadcastPresence(roomKey);
            break;
          }

          case "ping": {
            if (clientInfo) {
              clientInfo.lastPing = Date.now();
              ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
            }
            break;
          }

          case "state:snapshot": {
            if (clientInfo) {
              const { roomKey, state } = msg;
              if (state && roomKey) {
                roomSnapshots.set(roomKey, {
                  state,
                  updatedAt: Date.now(),
                  masterDeviceId: clientInfo.deviceId,
                });
                // Broadcast state to other devices
                broadcastToRoom(roomKey, {
                  type: "state:snapshot",
                  roomKey,
                  state,
                  senderId: clientInfo.deviceId,
                  senderName: clientInfo.deviceName,
                  timestamp: Date.now(),
                }, clientInfo.deviceId);
              }
            }
            break;
          }

          case "sync:event":
          case "order:update":
          case "sale:new":
          case "stock:update":
          case "account:update":
          case "product:update":
          case "category:update": {
            if (clientInfo) {
              const { roomKey } = clientInfo;
              const broadcastPayload = {
                ...msg,
                senderId: clientInfo.deviceId,
                senderName: clientInfo.deviceName,
                senderRole: clientInfo.role,
                timestamp: msg.timestamp || Date.now(),
              };

              broadcastToRoom(roomKey, broadcastPayload, clientInfo.deviceId);
            }
            break;
          }

          case "state:request": {
            if (clientInfo) {
              const { roomKey } = clientInfo;
              // Forward request to primary terminal in room
              broadcastToRoom(roomKey, {
                type: "state:request",
                requesterId: clientInfo.deviceId,
                requesterName: clientInfo.deviceName,
                timestamp: Date.now(),
              }, clientInfo.deviceId);
            }
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error("[WS MESSAGE PARSE ERROR]", err);
      }
    });

    ws.on("close", () => {
      if (clientInfo) {
        const { roomKey, deviceId, deviceName } = clientInfo;
        const room = syncRooms.get(roomKey);
        if (room) {
          room.delete(deviceId);
          console.log(`[WS SYNC] Device left: ${deviceName} (${deviceId}) from room ${roomKey}. Remaining: ${room.size}`);
          if (room.size === 0) {
            syncRooms.delete(roomKey);
          } else {
            broadcastPresence(roomKey);
          }
        }
      }
    });

    ws.on("error", (err) => {
      console.error("[WS CLIENT ERROR]", err);
    });
  });

  // ----------------------------------------------------
  // API ENDPOINTS
  // ----------------------------------------------------

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      serverTime: Date.now(),
      activeTransactions: salesDatabase.size,
      webhookLogsCount: webhookEventLogs.length,
      activeSyncRooms: syncRooms.size,
      connectedSockets: wss.clients.size,
    });
  });

  // Network Interfaces and Local IP Detection for Wi-Fi Sync
  app.get("/api/sync/network-info", (_req: Request, res: Response) => {
    try {
      const interfaces = os.networkInterfaces();
      const localIps: Array<{ name: string; ip: string; internal: boolean }> = [];

      for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name] || []) {
          if (net.family === "IPv4" && !net.internal) {
            localIps.push({ name, ip: net.address, internal: false });
          }
        }
      }

      if (localIps.length === 0) {
        localIps.push({ name: "loopback", ip: "127.0.0.1", internal: true });
      }

      res.json({
        port: PORT,
        localIps,
        primaryIp: localIps[0]?.ip || "127.0.0.1",
        hostname: os.hostname(),
        platform: os.platform(),
        activeSyncRooms: syncRooms.size,
        connectedSockets: wss.clients.size,
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to detect network info", details: err.message });
    }
  });

  // Room Inspection endpoint
  app.get("/api/sync/room/:roomKey", (req: Request, res: Response) => {
    const { roomKey } = req.params;
    const room = syncRooms.get(roomKey);
    if (!room) {
      return res.json({
        roomKey,
        active: false,
        deviceCount: 0,
        devices: [],
      });
    }

    const devices = Array.from(room.values()).map((c) => ({
      deviceId: c.deviceId,
      deviceName: c.deviceName,
      role: c.role,
      mode: c.mode,
      joinedAt: c.joinedAt,
      lastPing: c.lastPing,
      ip: c.ip,
    }));

    return res.json({
      roomKey,
      active: true,
      deviceCount: devices.length,
      devices,
      hasSnapshot: roomSnapshots.has(roomKey),
    });
  });

  // HTTP fallback for publishing state updates
  app.post("/api/sync/publish", (req: Request, res: Response) => {
    try {
      const { roomKey = "DEFAULT_ROOM", event, senderId, senderName, payload } = req.body;
      if (!event) {
        return res.status(400).json({ error: "Missing event parameter" });
      }

      broadcastToRoom(roomKey, {
        type: event,
        senderId: senderId || "http_client",
        senderName: senderName || "Terminal HTTP",
        payload,
        timestamp: Date.now(),
      }, senderId);

      return res.json({ success: true, broadcastedToRoom: roomKey });
    } catch (err: any) {
      return res.status(500).json({ error: "Publish failed", details: err.message });
    }
  });

  // Direct standalone License Generator HTML
  app.get(["/generador", "/generador.html", "/generador-licencias", "/admin-licencia"], (_req: Request, res: Response) => {
    const filePath = path.join(process.cwd(), "public", "generador.html");
    res.sendFile(filePath);
  });

  // Batch Sales Synchronization endpoint
  app.post("/api/sales/sync", (req: Request, res: Response) => {
    try {
      const { sales, syncedAt } = req.body;
      if (!Array.isArray(sales)) {
        return res.status(400).json({ error: "Invalid sales payload. Expected array." });
      }

      const syncedIds: string[] = [];
      const updatedStatuses: Array<{ id: string; status: string; estado_pago: string }> = [];

      for (const sale of sales) {
        if (!sale.id) continue;
        syncedIds.push(sale.id);

        const existing = salesDatabase.get(sale.id);
        const resolvedStatus =
          existing?.paymentStatus ||
          sale.paymentStatus ||
          sale.estado_pago ||
          (sale.paymentMethod === "cash" ? "COMPLETADO" : "PENDIENTE");

        const record: ServerSaleRecord = {
          id: sale.id,
          ticketNumber: sale.ticketNumber || 0,
          ts: sale.ts || Date.now(),
          total: sale.total || 0,
          paymentMethod: sale.paymentMethod || "cash",
          paymentStatus: resolvedStatus,
          estado_pago: resolvedStatus,
          gatewayReference: sale.gatewayReference || existing?.gatewayReference,
          gatewayPayload: sale.gatewayPayload || existing?.gatewayPayload,
          syncedAt: syncedAt || Date.now(),
          raw: sale,
        };

        salesDatabase.set(sale.id, record);

        // If backend has a different status than client sent (e.g. gateway verified via webhook)
        if (existing && existing.paymentStatus !== sale.paymentStatus) {
          updatedStatuses.push({
            id: sale.id,
            status: existing.paymentStatus,
            estado_pago: existing.estado_pago,
          });
        }
      }

      console.log(`[SYNC] Synced ${syncedIds.length} sales. Total in database: ${salesDatabase.size}`);
      return res.json({
        success: true,
        syncedCount: syncedIds.length,
        syncedIds,
        updatedStatuses,
      });
    } catch (err: any) {
      console.error("[SYNC ERROR]", err);
      return res.status(500).json({ error: "Failed to sync sales", details: err.message });
    }
  });

  // Query status of a specific payment
  app.get("/api/payments/status/:saleId", (req: Request, res: Response) => {
    const { saleId } = req.params;
    const record = salesDatabase.get(saleId);

    if (!record) {
      return res.status(404).json({
        saleId,
        status: "PENDIENTE",
        estado_pago: "PENDIENTE",
        message: "Transacción no encontrada o aún no sincronizada.",
      });
    }

    return res.json({
      saleId: record.id,
      ticketNumber: record.ticketNumber,
      total: record.total,
      paymentMethod: record.paymentMethod,
      status: record.paymentStatus,
      estado_pago: record.estado_pago,
      gatewayReference: record.gatewayReference,
      updatedAt: record.syncedAt,
    });
  });

  // Transfermóvil Official Webhook Receiver
  app.post("/api/payments/transfermovil/webhook", (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const saleId = payload.saleId || payload.sale_id || payload.ref;
      const statusRaw = String(payload.status || "COMPLETADO").toUpperCase();
      const status: "COMPLETADO" | "FALLIDO" =
        statusRaw === "SUCCESS" || statusRaw === "OK" || statusRaw === "COMPLETADO"
          ? "COMPLETADO"
          : "FALLIDO";

      const logEntry = {
        id: "wh_tm_" + Date.now(),
        timestamp: Date.now(),
        provider: "Transfermóvil",
        saleId,
        payload,
        actionTaken: `Estado actualizado a ${status}`,
      };
      webhookEventLogs.unshift(logEntry);

      if (saleId && salesDatabase.has(saleId)) {
        const current = salesDatabase.get(saleId)!;
        current.paymentStatus = status;
        current.estado_pago = status;
        current.gatewayReference = payload.transaction_id || payload.authorization_code || current.gatewayReference;
        current.syncedAt = Date.now();
        salesDatabase.set(saleId, current);
        console.log(`[TRANSFERMOVIL WEBHOOK] Sale ${saleId} updated to ${status}`);
      } else if (saleId) {
        // Record placeholder for future sync
        salesDatabase.set(saleId, {
          id: saleId,
          ticketNumber: 0,
          ts: Date.now(),
          total: payload.amount || 0,
          paymentMethod: "transfermovil",
          paymentStatus: status,
          estado_pago: status,
          gatewayReference: payload.transaction_id || payload.authorization_code,
          syncedAt: Date.now(),
        });
      }

      return res.json({
        received: true,
        provider: "transfermovil",
        saleId,
        new_status: status,
        estado_pago: status,
      });
    } catch (err: any) {
      console.error("[TM WEBHOOK ERROR]", err);
      return res.status(500).json({ error: "Transfermóvil webhook failed", details: err.message });
    }
  });

  // EnZona Official Webhook Receiver
  app.post("/api/payments/enzona/webhook", (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const saleId = payload.sale_id || payload.saleId || payload.transaction_id;
      const statusCode = payload.status_code || payload.status;
      
      // EnZona status_code "1111" or "COMPLETE" denotes successful payment
      const isComplete =
        statusCode === "1111" ||
        statusCode === "COMPLETE" ||
        statusCode === "COMPLETADO" ||
        statusCode === 1111;

      const status: "COMPLETADO" | "FALLIDO" = isComplete ? "COMPLETADO" : "FALLIDO";

      const logEntry = {
        id: "wh_ez_" + Date.now(),
        timestamp: Date.now(),
        provider: "EnZona",
        saleId,
        payload,
        actionTaken: `Estado actualizado a ${status}`,
      };
      webhookEventLogs.unshift(logEntry);

      if (saleId && salesDatabase.has(saleId)) {
        const current = salesDatabase.get(saleId)!;
        current.paymentStatus = status;
        current.estado_pago = status;
        current.gatewayReference = payload.transaction_uuid || payload.transaction_id || current.gatewayReference;
        current.syncedAt = Date.now();
        salesDatabase.set(saleId, current);
        console.log(`[ENZONA WEBHOOK] Sale ${saleId} updated to ${status}`);
      } else if (saleId) {
        salesDatabase.set(saleId, {
          id: saleId,
          ticketNumber: 0,
          ts: Date.now(),
          total: payload.amount || 0,
          paymentMethod: "enzona",
          paymentStatus: status,
          estado_pago: status,
          gatewayReference: payload.transaction_uuid || payload.transaction_id,
          syncedAt: Date.now(),
        });
      }

      return res.json({
        received: true,
        provider: "enzona",
        saleId,
        new_status: status,
        estado_pago: status,
      });
    } catch (err: any) {
      console.error("[ENZONA WEBHOOK ERROR]", err);
      return res.status(500).json({ error: "EnZona webhook failed", details: err.message });
    }
  });

  // Generic Gateway Webhook endpoint
  app.post("/api/payments/webhook", (req: Request, res: Response) => {
    try {
      const { saleId, provider = "generic", status = "COMPLETADO", estado_pago, transactionId } = req.body;
      const resolvedStatus: "COMPLETADO" | "FALLIDO" | "PENDIENTE" =
        estado_pago || status || "COMPLETADO";

      if (saleId) {
        const current: ServerSaleRecord = salesDatabase.get(saleId) || {
          id: saleId,
          ticketNumber: 0,
          ts: Date.now(),
          total: 0,
          paymentMethod: provider,
          paymentStatus: resolvedStatus,
          estado_pago: resolvedStatus,
          syncedAt: Date.now(),
        };

        current.paymentStatus = resolvedStatus;
        current.estado_pago = resolvedStatus;
        if (transactionId) current.gatewayReference = transactionId;
        current.syncedAt = Date.now();
        salesDatabase.set(saleId, current);
      }

      return res.json({
        success: true,
        saleId,
        status: resolvedStatus,
        estado_pago: resolvedStatus,
      });
    } catch (err: any) {
      return res.status(500).json({ error: "Generic webhook failed", details: err.message });
    }
  });

  // Webhook Event Logs endpoint for inspection / debug
  app.get("/api/payments/webhook-logs", (_req: Request, res: Response) => {
    res.json({
      total: webhookEventLogs.length,
      logs: webhookEventLogs.slice(0, 50),
    });
  });

  // ----------------------------------------------------
  // VITE & FRONTEND INTEGRATION
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[CAJAMASTER POS] Full-stack Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
