var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_http = __toESM(require("http"), 1);
var import_os = __toESM(require("os"), 1);
var import_path = __toESM(require("path"), 1);
var import_ws = require("ws");
var import_vite = require("vite");
var salesDatabase = /* @__PURE__ */ new Map();
var webhookEventLogs = [];
var syncRooms = /* @__PURE__ */ new Map();
var roomSnapshots = /* @__PURE__ */ new Map();
async function startServer() {
  const app = (0, import_express.default)();
  const server = import_http.default.createServer(app);
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "25mb" }));
  app.use(import_express.default.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });
  const wss = new import_ws.WebSocketServer({ noServer: true });
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
  function broadcastPresence(roomKey) {
    const room = syncRooms.get(roomKey);
    if (!room) return;
    const devices = Array.from(room.values()).map((c) => ({
      deviceId: c.deviceId,
      deviceName: c.deviceName,
      role: c.role,
      mode: c.mode,
      joinedAt: c.joinedAt,
      lastPing: c.lastPing,
      ip: c.ip
    }));
    const message = JSON.stringify({
      type: "presence",
      roomKey,
      devices,
      timestamp: Date.now()
    });
    for (const client of room.values()) {
      if (client.ws.readyState === import_ws.WebSocket.OPEN) {
        try {
          client.ws.send(message);
        } catch (e) {
          console.error("[WS BROADCAST ERROR]", e);
        }
      }
    }
  }
  function broadcastToRoom(roomKey, message, excludeDeviceId) {
    const room = syncRooms.get(roomKey);
    if (!room) return;
    const payload = typeof message === "string" ? message : JSON.stringify(message);
    for (const client of room.values()) {
      if (excludeDeviceId && client.deviceId === excludeDeviceId) continue;
      if (client.ws.readyState === import_ws.WebSocket.OPEN) {
        try {
          client.ws.send(payload);
        } catch (e) {
          console.error("[WS SEND ERROR]", e);
        }
      }
    }
  }
  wss.on("connection", (ws, req) => {
    let clientInfo = null;
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
              syncRooms.set(roomKey, /* @__PURE__ */ new Map());
            }
            const room = syncRooms.get(roomKey);
            clientInfo = {
              ws,
              deviceId,
              deviceName: deviceName || (role === "primary" ? "Caja Principal" : "Terminal M\xF3vil"),
              role,
              roomKey,
              mode,
              joinedAt: Date.now(),
              lastPing: Date.now(),
              ip: clientIp
            };
            room.set(deviceId, clientInfo);
            console.log(`[WS SYNC] Device joined: ${clientInfo.deviceName} (${deviceId}) [${role}] in room ${roomKey}. Active in room: ${room.size}`);
            ws.send(
              JSON.stringify({
                type: "joined",
                roomKey,
                deviceId,
                role,
                serverTime: Date.now()
              })
            );
            const snapshot = roomSnapshots.get(roomKey);
            if (snapshot && role === "secondary") {
              ws.send(
                JSON.stringify({
                  type: "state:init",
                  roomKey,
                  state: snapshot.state,
                  updatedAt: snapshot.updatedAt,
                  masterDeviceId: snapshot.masterDeviceId
                })
              );
            }
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
                  masterDeviceId: clientInfo.deviceId
                });
                broadcastToRoom(roomKey, {
                  type: "state:snapshot",
                  roomKey,
                  state,
                  senderId: clientInfo.deviceId,
                  senderName: clientInfo.deviceName,
                  timestamp: Date.now()
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
                timestamp: msg.timestamp || Date.now()
              };
              broadcastToRoom(roomKey, broadcastPayload, clientInfo.deviceId);
            }
            break;
          }
          case "state:request": {
            if (clientInfo) {
              const { roomKey } = clientInfo;
              broadcastToRoom(roomKey, {
                type: "state:request",
                requesterId: clientInfo.deviceId,
                requesterName: clientInfo.deviceName,
                timestamp: Date.now()
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
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      serverTime: Date.now(),
      activeTransactions: salesDatabase.size,
      webhookLogsCount: webhookEventLogs.length,
      activeSyncRooms: syncRooms.size,
      connectedSockets: wss.clients.size
    });
  });
  app.get("/api/sync/network-info", (_req, res) => {
    try {
      const interfaces = import_os.default.networkInterfaces();
      const localIps = [];
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
        hostname: import_os.default.hostname(),
        platform: import_os.default.platform(),
        activeSyncRooms: syncRooms.size,
        connectedSockets: wss.clients.size
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to detect network info", details: err.message });
    }
  });
  app.get("/api/sync/room/:roomKey", (req, res) => {
    const { roomKey } = req.params;
    const room = syncRooms.get(roomKey);
    if (!room) {
      return res.json({
        roomKey,
        active: false,
        deviceCount: 0,
        devices: []
      });
    }
    const devices = Array.from(room.values()).map((c) => ({
      deviceId: c.deviceId,
      deviceName: c.deviceName,
      role: c.role,
      mode: c.mode,
      joinedAt: c.joinedAt,
      lastPing: c.lastPing,
      ip: c.ip
    }));
    return res.json({
      roomKey,
      active: true,
      deviceCount: devices.length,
      devices,
      hasSnapshot: roomSnapshots.has(roomKey)
    });
  });
  app.post("/api/sync/publish", (req, res) => {
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
        timestamp: Date.now()
      }, senderId);
      return res.json({ success: true, broadcastedToRoom: roomKey });
    } catch (err) {
      return res.status(500).json({ error: "Publish failed", details: err.message });
    }
  });
  app.get(["/generador", "/generador.html", "/generador-licencias", "/admin-licencia"], (_req, res) => {
    const filePath = import_path.default.join(process.cwd(), "public", "generador.html");
    res.sendFile(filePath);
  });
  app.post("/api/sales/sync", (req, res) => {
    try {
      const { sales, syncedAt } = req.body;
      if (!Array.isArray(sales)) {
        return res.status(400).json({ error: "Invalid sales payload. Expected array." });
      }
      const syncedIds = [];
      const updatedStatuses = [];
      for (const sale of sales) {
        if (!sale.id) continue;
        syncedIds.push(sale.id);
        const existing = salesDatabase.get(sale.id);
        const resolvedStatus = existing?.paymentStatus || sale.paymentStatus || sale.estado_pago || (sale.paymentMethod === "cash" ? "COMPLETADO" : "PENDIENTE");
        const record = {
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
          raw: sale
        };
        salesDatabase.set(sale.id, record);
        if (existing && existing.paymentStatus !== sale.paymentStatus) {
          updatedStatuses.push({
            id: sale.id,
            status: existing.paymentStatus,
            estado_pago: existing.estado_pago
          });
        }
      }
      console.log(`[SYNC] Synced ${syncedIds.length} sales. Total in database: ${salesDatabase.size}`);
      return res.json({
        success: true,
        syncedCount: syncedIds.length,
        syncedIds,
        updatedStatuses
      });
    } catch (err) {
      console.error("[SYNC ERROR]", err);
      return res.status(500).json({ error: "Failed to sync sales", details: err.message });
    }
  });
  app.get("/api/payments/status/:saleId", (req, res) => {
    const { saleId } = req.params;
    const record = salesDatabase.get(saleId);
    if (!record) {
      return res.status(404).json({
        saleId,
        status: "PENDIENTE",
        estado_pago: "PENDIENTE",
        message: "Transacci\xF3n no encontrada o a\xFAn no sincronizada."
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
      updatedAt: record.syncedAt
    });
  });
  app.post("/api/payments/transfermovil/webhook", (req, res) => {
    try {
      const payload = req.body;
      const saleId = payload.saleId || payload.sale_id || payload.ref;
      const statusRaw = String(payload.status || "COMPLETADO").toUpperCase();
      const status = statusRaw === "SUCCESS" || statusRaw === "OK" || statusRaw === "COMPLETADO" ? "COMPLETADO" : "FALLIDO";
      const logEntry = {
        id: "wh_tm_" + Date.now(),
        timestamp: Date.now(),
        provider: "Transferm\xF3vil",
        saleId,
        payload,
        actionTaken: `Estado actualizado a ${status}`
      };
      webhookEventLogs.unshift(logEntry);
      if (saleId && salesDatabase.has(saleId)) {
        const current = salesDatabase.get(saleId);
        current.paymentStatus = status;
        current.estado_pago = status;
        current.gatewayReference = payload.transaction_id || payload.authorization_code || current.gatewayReference;
        current.syncedAt = Date.now();
        salesDatabase.set(saleId, current);
        console.log(`[TRANSFERMOVIL WEBHOOK] Sale ${saleId} updated to ${status}`);
      } else if (saleId) {
        salesDatabase.set(saleId, {
          id: saleId,
          ticketNumber: 0,
          ts: Date.now(),
          total: payload.amount || 0,
          paymentMethod: "transfermovil",
          paymentStatus: status,
          estado_pago: status,
          gatewayReference: payload.transaction_id || payload.authorization_code,
          syncedAt: Date.now()
        });
      }
      return res.json({
        received: true,
        provider: "transfermovil",
        saleId,
        new_status: status,
        estado_pago: status
      });
    } catch (err) {
      console.error("[TM WEBHOOK ERROR]", err);
      return res.status(500).json({ error: "Transferm\xF3vil webhook failed", details: err.message });
    }
  });
  app.post("/api/payments/enzona/webhook", (req, res) => {
    try {
      const payload = req.body;
      const saleId = payload.sale_id || payload.saleId || payload.transaction_id;
      const statusCode = payload.status_code || payload.status;
      const isComplete = statusCode === "1111" || statusCode === "COMPLETE" || statusCode === "COMPLETADO" || statusCode === 1111;
      const status = isComplete ? "COMPLETADO" : "FALLIDO";
      const logEntry = {
        id: "wh_ez_" + Date.now(),
        timestamp: Date.now(),
        provider: "EnZona",
        saleId,
        payload,
        actionTaken: `Estado actualizado a ${status}`
      };
      webhookEventLogs.unshift(logEntry);
      if (saleId && salesDatabase.has(saleId)) {
        const current = salesDatabase.get(saleId);
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
          syncedAt: Date.now()
        });
      }
      return res.json({
        received: true,
        provider: "enzona",
        saleId,
        new_status: status,
        estado_pago: status
      });
    } catch (err) {
      console.error("[ENZONA WEBHOOK ERROR]", err);
      return res.status(500).json({ error: "EnZona webhook failed", details: err.message });
    }
  });
  app.post("/api/payments/webhook", (req, res) => {
    try {
      const { saleId, provider = "generic", status = "COMPLETADO", estado_pago, transactionId } = req.body;
      const resolvedStatus = estado_pago || status || "COMPLETADO";
      if (saleId) {
        const current = salesDatabase.get(saleId) || {
          id: saleId,
          ticketNumber: 0,
          ts: Date.now(),
          total: 0,
          paymentMethod: provider,
          paymentStatus: resolvedStatus,
          estado_pago: resolvedStatus,
          syncedAt: Date.now()
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
        estado_pago: resolvedStatus
      });
    } catch (err) {
      return res.status(500).json({ error: "Generic webhook failed", details: err.message });
    }
  });
  app.get("/api/payments/webhook-logs", (_req, res) => {
    res.json({
      total: webhookEventLogs.length,
      logs: webhookEventLogs.slice(0, 50)
    });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[CAJAMASTER POS] Full-stack Server running at http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
