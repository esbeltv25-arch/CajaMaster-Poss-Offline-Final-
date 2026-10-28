package com.cajamaster.pos;

import android.util.Log;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import org.json.JSONArray;
import org.json.JSONObject;

import java.net.InetSocketAddress;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * SyncRelayServer - WebSocket Relay Engine running directly on Android.
 * Enables CajaMaster Master POS to act as a local hub for subordinate terminals
 * over local Wi-Fi or Hotspot without requiring any external server.
 */
public class SyncRelayServer extends WebSocketServer {

    private static final String TAG = "CajaMaster_SyncServer";

    public static class ClientSession {
        public WebSocket ws;
        public String deviceId;
        public String deviceName;
        public String role;
        public String roomKey;
        public String mode;
        public long joinedAt;
        public long lastPing;
        public String ip;
    }

    // roomKey -> (deviceId -> ClientSession)
    private final Map<String, Map<String, ClientSession>> rooms = new ConcurrentHashMap<>();
    // roomKey -> stateSnapshot
    private final Map<String, JSONObject> roomSnapshots = new ConcurrentHashMap<>();
    // WebSocket connection -> ClientSession
    private final Map<WebSocket, ClientSession> socketToSession = new ConcurrentHashMap<>();

    public SyncRelayServer(int port) {
        super(new InetSocketAddress(port));
        setReuseAddr(true);
        setTcpNoDelay(true);
    }

    public SyncRelayServer(InetSocketAddress address) {
        super(address);
        setReuseAddr(true);
        setTcpNoDelay(true);
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        Log.i(TAG, "New WebSocket client connected from: " + conn.getRemoteSocketAddress());
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        ClientSession session = socketToSession.remove(conn);
        if (session != null) {
            String roomKey = session.roomKey;
            Map<String, ClientSession> room = rooms.get(roomKey);
            if (room != null) {
                room.remove(session.deviceId);
                Log.i(TAG, "Device disconnected: " + session.deviceName + " (" + session.deviceId + ") from room " + roomKey);
                if (room.isEmpty()) {
                    rooms.remove(roomKey);
                } else {
                    broadcastPresence(roomKey);
                }
            }
        }
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        try {
            JSONObject msg = new JSONObject(message);
            String type = msg.optString("type", "");

            switch (type) {
                case "join": {
                    String roomKey = msg.optString("roomKey", "DEFAULT_ROOM");
                    String deviceId = msg.optString("deviceId", "");
                    if (deviceId.isEmpty()) return;

                    String deviceName = msg.optString("deviceName", "Terminal POS");
                    String role = msg.optString("role", "secondary");
                    String mode = msg.optString("mode", "local");
                    String remoteIp = conn.getRemoteSocketAddress() != null
                            ? conn.getRemoteSocketAddress().getAddress().getHostAddress()
                            : "127.0.0.1";

                    ClientSession session = new ClientSession();
                    session.ws = conn;
                    session.deviceId = deviceId;
                    session.deviceName = deviceName;
                    session.role = role;
                    session.roomKey = roomKey;
                    session.mode = mode;
                    session.joinedAt = System.currentTimeMillis();
                    session.lastPing = System.currentTimeMillis();
                    session.ip = remoteIp;

                    rooms.computeIfAbsent(roomKey, k -> new ConcurrentHashMap<>()).put(deviceId, session);
                    socketToSession.put(conn, session);

                    Log.i(TAG, "Device joined: " + deviceName + " (" + deviceId + ") [" + role + "] in room " + roomKey);

                    // Acknowledge join
                    JSONObject ack = new JSONObject();
                    ack.put("type", "joined");
                    ack.put("roomKey", roomKey);
                    ack.put("deviceId", deviceId);
                    ack.put("role", role);
                    ack.put("serverTime", System.currentTimeMillis());
                    conn.send(ack.toString());

                    // If secondary joins and snapshot exists, send it
                    JSONObject snapshot = roomSnapshots.get(roomKey);
                    if (snapshot != null && "secondary".equals(role)) {
                        JSONObject initMsg = new JSONObject();
                        initMsg.put("type", "state:init");
                        initMsg.put("roomKey", roomKey);
                        initMsg.put("state", snapshot.opt("state"));
                        initMsg.put("updatedAt", snapshot.optLong("updatedAt", System.currentTimeMillis()));
                        initMsg.put("masterDeviceId", snapshot.optString("masterDeviceId", ""));
                        conn.send(initMsg.toString());
                    }

                    broadcastPresence(roomKey);
                    break;
                }

                case "ping": {
                    ClientSession s = socketToSession.get(conn);
                    if (s != null) {
                        s.lastPing = System.currentTimeMillis();
                    }
                    JSONObject pong = new JSONObject();
                    pong.put("type", "pong");
                    pong.put("timestamp", System.currentTimeMillis());
                    conn.send(pong.toString());
                    break;
                }

                case "state:snapshot": {
                    ClientSession s = socketToSession.get(conn);
                    if (s != null) {
                        String roomKey = msg.optString("roomKey", s.roomKey);
                        JSONObject stateObj = msg.optJSONObject("state");
                        if (stateObj != null && !roomKey.isEmpty()) {
                            JSONObject snap = new JSONObject();
                            snap.put("state", stateObj);
                            snap.put("updatedAt", System.currentTimeMillis());
                            snap.put("masterDeviceId", s.deviceId);
                            roomSnapshots.put(roomKey, snap);

                            // Broadcast snapshot to other devices in room
                            JSONObject broadcastObj = new JSONObject();
                            broadcastObj.put("type", "state:snapshot");
                            broadcastObj.put("roomKey", roomKey);
                            broadcastObj.put("state", stateObj);
                            broadcastObj.put("senderId", s.deviceId);
                            broadcastObj.put("senderName", s.deviceName);
                            broadcastObj.put("timestamp", System.currentTimeMillis());
                            broadcastToRoom(roomKey, broadcastObj.toString(), s.deviceId);
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
                    ClientSession s = socketToSession.get(conn);
                    if (s != null) {
                        msg.put("senderId", s.deviceId);
                        msg.put("senderName", s.deviceName);
                        msg.put("senderRole", s.role);
                        if (!msg.has("timestamp")) {
                            msg.put("timestamp", System.currentTimeMillis());
                        }
                        broadcastToRoom(s.roomKey, msg.toString(), s.deviceId);
                    }
                    break;
                }

                case "state:request": {
                    ClientSession s = socketToSession.get(conn);
                    if (s != null) {
                        JSONObject reqMsg = new JSONObject();
                        reqMsg.put("type", "state:request");
                        reqMsg.put("requesterId", s.deviceId);
                        reqMsg.put("requesterName", s.deviceName);
                        reqMsg.put("timestamp", System.currentTimeMillis());
                        broadcastToRoom(s.roomKey, reqMsg.toString(), s.deviceId);
                    }
                    break;
                }

                default: {
                    ClientSession s = socketToSession.get(conn);
                    if (s != null) {
                        broadcastToRoom(s.roomKey, message, s.deviceId);
                    }
                    break;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing WS message", e);
        }
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        Log.e(TAG, "WebSocket server error: " + (conn != null ? conn.getRemoteSocketAddress() : "server"), ex);
    }

    @Override
    public void onStart() {
        Log.i(TAG, "SyncRelayServer started successfully on port " + getPort());
    }

    private void broadcastPresence(String roomKey) {
        Map<String, ClientSession> room = rooms.get(roomKey);
        if (room == null) return;

        try {
            JSONArray devArr = new JSONArray();
            for (ClientSession c : room.values()) {
                JSONObject d = new JSONObject();
                d.put("deviceId", c.deviceId);
                d.put("deviceName", c.deviceName);
                d.put("role", c.role);
                d.put("mode", c.mode);
                d.put("joinedAt", c.joinedAt);
                d.put("lastPing", c.lastPing);
                d.put("ip", c.ip);
                devArr.put(d);
            }

            JSONObject pres = new JSONObject();
            pres.put("type", "presence");
            pres.put("roomKey", roomKey);
            pres.put("devices", devArr);
            pres.put("timestamp", System.currentTimeMillis());
            String presStr = pres.toString();

            for (ClientSession c : room.values()) {
                if (c.ws != null && c.ws.isOpen()) {
                    try {
                        c.ws.send(presStr);
                    } catch (Exception ignored) {}
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error broadcasting presence", e);
        }
    }

    private void broadcastToRoom(String roomKey, String payload, String excludeDeviceId) {
        Map<String, ClientSession> room = rooms.get(roomKey);
        if (room == null) return;

        for (ClientSession c : room.values()) {
            if (excludeDeviceId != null && excludeDeviceId.equals(c.deviceId)) continue;
            if (c.ws != null && c.ws.isOpen()) {
                try {
                    c.ws.send(payload);
                } catch (Exception e) {
                    Log.e(TAG, "Error sending to client " + c.deviceId, e);
                }
            }
        }
    }

    public int getClientCount() {
        return socketToSession.size();
    }
}
