const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { createQueueManager } = require("./queue-manager");
const {
  DEFAULT_QUEUE_BOT_FILL_MS,
  normalizeMatchType,
  getRequiredPlayers
} = require("./bot-fill-policy");
const {
  createMatchRecord,
  buildGameStartPayload,
  inferMatchTypeFromSlots
} = require("./match-lifecycle");
const { createAuthoritativeMatchRuntime } = require("./authoritative-match-runtime");

const PORT = process.env.PORT || 3040;
const SLOTS = 4;
const COLOR_COUNT = 36;
const RECONNECT_GRACE_MS = 30 * 1000;
const PUBLIC_SERVER_URL = process.env.GAME_SERVER_URL || process.env.PUBLIC_SERVER_URL || "";
const RELEASE_CHANNEL = process.env.RELEASE_CHANNEL || "local";
const DEFAULT_AUTHORITY_MODE = "server";
const AUTHORITY_MODE = process.env.VOIDFRONT_AUTHORITY_MODE || DEFAULT_AUTHORITY_MODE;
const ENABLE_DEBUG_TOOLS = !/^(0|false)$/i.test(process.env.VOIDFRONT_ENABLE_DEBUG_TOOLS || "1");
const ENABLE_TEST_UI = !/^(0|false)$/i.test(process.env.VOIDFRONT_ENABLE_TEST_UI || "1");
const ENABLE_PERF_HUD = !/^(0|false)$/i.test(process.env.VOIDFRONT_ENABLE_PERF_HUD || "1");
const ENABLE_YANDEX_SDK = /^(1|true)$/i.test(process.env.VOIDFRONT_ENABLE_YANDEX_SDK || "0");
const SHUTDOWN_GRACE_MS = 10 * 1000;
const SERVER_STARTED_AT = Date.now();
const queueManager = createQueueManager({ timeoutMs: DEFAULT_QUEUE_BOT_FILL_MS });
const sessions = new Map();
const matches = new Map();
const authoritativeRuntimes = new Map();
let shuttingDown = false;

// ─── LAN / VPN detection ──────────────────────────────────────────

function getServerLanUrl() {
  try {
    const ifaces = os.networkInterfaces();
    const candidates = [];
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name]) {
        if (iface.family !== "IPv4" || iface.address === "127.0.0.1") continue;
        candidates.push(iface.address);
      }
    }
    if (candidates.length === 0) return null;
    const radmin = candidates.find((a) => a.startsWith("26."));
    const addr = radmin || candidates.find((a) => !a.startsWith("127.")) || candidates[0];
    return "http://" + addr + ":" + PORT;
  } catch (_) { /* ignore */ }
  return null;
}

function getRequestOrigin(req) {
  if (!req || !req.headers) return "";
  const host = req.headers.host || "";
  if (!host) return "";
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || (req.socket && req.socket.encrypted ? "https" : "http");
  return protocol + "://" + host;
}

function normalizeOrigin(value) {
  if (!value) return "";
  try {
    return new URL(String(value)).origin;
  } catch (_) {
    return "";
  }
}

function resolveSocketCorsPolicy() {
  const explicit = String(process.env.VOIDFRONT_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => normalizeOrigin(value.trim()))
    .filter(Boolean);
  if (explicit.includes("*")) return { allowAll: true, origins: new Set() };
  if (explicit.length > 0) return { allowAll: false, origins: new Set(explicit) };
  const origins = new Set();
  const publicOrigin = normalizeOrigin(PUBLIC_SERVER_URL);
  if (publicOrigin) origins.add(publicOrigin);
  if (!publicOrigin || RELEASE_CHANNEL === "local") {
    origins.add("http://localhost:" + PORT);
    origins.add("http://127.0.0.1:" + PORT);
    const lanOrigin = normalizeOrigin(getServerLanUrl());
    if (lanOrigin) origins.add(lanOrigin);
  }
  return { allowAll: origins.size === 0, origins };
}

const SOCKET_CORS_POLICY = resolveSocketCorsPolicy();

function isSocketOriginAllowed(origin) {
  if (!origin) return true;
  if (SOCKET_CORS_POLICY.allowAll) return true;
  const normalized = normalizeOrigin(origin);
  return !!normalized && SOCKET_CORS_POLICY.origins.has(normalized);
}

function buildHealthPayload() {
  return {
    status: shuttingDown ? "draining" : "ok",
    authorityMode: AUTHORITY_MODE,
    releaseChannel: RELEASE_CHANNEL,
    uptimeSec: Math.round((Date.now() - SERVER_STARTED_AT) / 1000),
    rooms: rooms.size,
    matches: matches.size,
    authoritativeRuntimes: authoritativeRuntimes.size,
    sessions: sessions.size,
    socketCors: SOCKET_CORS_POLICY.allowAll ? "*" : Array.from(SOCKET_CORS_POLICY.origins)
  };
}

// ─── Static HTTP server ───────────────────────────────────────────

const MIME = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".mp3":  "audio/mpeg",
  ".ogg":  "audio/ogg",
  ".wav":  "audio/wav",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".gif":  "image/gif",
  ".svg":  "image/svg+xml",
  ".woff": "font/woff",
  ".woff2":"font/woff2"
};

function resolveStaticPath(urlPath) {
  const raw = (urlPath === "/" || urlPath === "")
    ? "index.html"
    : urlPath.replace(/^\//, "").replace(/[?].*$/, "");
  const decoded = decodeURIComponent(raw);
  const normalized = path.normalize(decoded);
  const candidate = path.join(__dirname, normalized);
  const root = __dirname;
  const relative = path.relative(root, candidate);

  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;

  try {
    const stat = fs.statSync(candidate);
    if (stat.isDirectory()) {
      const indexPath = path.join(candidate, "index.html");
      if (fs.existsSync(indexPath)) return indexPath;
      return null;
    }
    if (stat.isFile()) return candidate;
  } catch (_) {
    if (!path.extname(candidate)) {
      const indexPath = path.join(candidate, "index.html");
      if (fs.existsSync(indexPath)) return indexPath;
    }
  }

  return null;
}

const httpServer = http.createServer((req, res) => {
  const clientIp = req.socket.remoteAddress || "?";
  console.log("[HTTP]", req.method, req.url, "from", clientIp);
  const requestPath = (req.url || "").replace(/[?].*$/, "");

  if (requestPath === "/health" || requestPath === "/healthz") {
    const payload = JSON.stringify(buildHealthPayload());
    res.writeHead(shuttingDown ? 503 : 200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Length": Buffer.byteLength(payload)
    });
    if (req.method === "HEAD") return res.end();
    return res.end(payload);
  }

  if (requestPath === "/runtime-config.js") {
    const config = {
      serverUrl: PUBLIC_SERVER_URL || getRequestOrigin(req) || "",
      authorityMode: AUTHORITY_MODE,
      releaseChannel: RELEASE_CHANNEL,
      enableDebugTools: ENABLE_DEBUG_TOOLS,
      enablePerfHud: ENABLE_PERF_HUD,
      enableTestUi: ENABLE_TEST_UI,
      yandexSdkEnabled: ENABLE_YANDEX_SDK
    };
    const payload = "window.__VOIDFRONT_RUNTIME_CONFIG = Object.assign({}, window.__VOIDFRONT_RUNTIME_CONFIG || {}, " + JSON.stringify(config) + ");\n";
    res.writeHead(200, {
      "Content-Type": "application/javascript",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Length": Buffer.byteLength(payload)
    });
    if (req.method === "HEAD") return res.end();
    return res.end(payload);
  }

  const filePath = resolveStaticPath(req.url || "/");
  if (!filePath) {
    console.log("[HTTP] 404", req.url);
    res.writeHead(404);
    return res.end();
  }
  const ext = path.extname(filePath);

  fs.stat(filePath, (err, stat) => {
    if (err) {
      console.log("[HTTP] 404", filePath);
      res.writeHead(404);
      return res.end();
    }

    const isAsset = ext === ".png" || ext === ".jpg" || ext === ".gif" || ext === ".mp3" || ext === ".ogg" || ext === ".wav" || ext === ".woff" || ext === ".woff2" || ext === ".svg";
    const cacheControl = isAsset
      ? "public, max-age=86400, immutable"
      : "no-cache";
    const headers = {
      "Content-Type": MIME[ext] || "text/plain",
      "Cache-Control": cacheControl,
      "Accept-Ranges": "bytes",
      "Content-Length": stat.size
    };
    const range = req.headers.range;

    if (range && /^bytes=/.test(range)) {
      const value = range.replace(/^bytes=/, "");
      const parts = value.split("-");
      let start = 0;
      let end = stat.size - 1;

      if (parts[0] === "" && parts[1]) {
        const suffixLength = parseInt(parts[1], 10);
        if (Number.isFinite(suffixLength) && suffixLength > 0) {
          start = Math.max(0, stat.size - suffixLength);
        }
      } else {
        start = parseInt(parts[0], 10);
        if (!Number.isFinite(start)) start = 0;
        if (parts[1]) {
          end = parseInt(parts[1], 10);
          if (!Number.isFinite(end)) end = stat.size - 1;
        }
      }

      start = Math.max(0, start);
      end = Math.min(stat.size - 1, end);

      if (start > end || start >= stat.size) {
        res.writeHead(416, {
          "Content-Range": "bytes */" + stat.size,
          "Accept-Ranges": "bytes"
        });
        return res.end();
      }

      const chunkSize = end - start + 1;
      res.writeHead(206, {
        "Content-Type": MIME[ext] || "text/plain",
        "Cache-Control": cacheControl,
        "Accept-Ranges": "bytes",
        "Content-Range": "bytes " + start + "-" + end + "/" + stat.size,
        "Content-Length": chunkSize
      });

      if (req.method === "HEAD") return res.end();

      const stream = fs.createReadStream(filePath, { start, end });
      stream.on("error", () => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      stream.pipe(res);
      return;
    }

    res.writeHead(200, headers);
    if (req.method === "HEAD") return res.end();

    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
    stream.pipe(res);
  });
});

// ─── Socket.IO setup ─────────────────────────────────────────────

const io = new Server(httpServer, {
  cors: {
    origin(origin, callback) {
      if (isSocketOriginAllowed(origin)) return callback(null, true);
      return callback(new Error("Socket origin is not allowed by server policy."), false);
    }
  },
  maxHttpBufferSize: 5e6
});

// ─── Room management ─────────────────────────────────────────────

const rooms = new Map();
/** Комнаты без игроков показываем в списке ещё N мс (хост мог отключиться) */
const ROOM_GRACE_MS = 5 * 60 * 1000;

function makeOpaqueId(prefix) {
  return prefix + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

function sanitizeNickname(nickname) {
  return String(nickname || "Игрок").trim().slice(0, 24) || "Игрок";
}

function toSessionAuth(session) {
  return {
    sessionId: session.sessionId,
    reconnectToken: session.reconnectToken,
    nickname: session.nickname || "Игрок"
  };
}

function getSessionFromAuth(auth) {
  if (!auth || typeof auth !== "object") return null;
  if (!auth.sessionId || !auth.reconnectToken) return null;
  const session = sessions.get(String(auth.sessionId));
  if (!session) return null;
  if (session.reconnectToken !== String(auth.reconnectToken)) return null;
  return session;
}

function bindSessionToSocket(socket, session, nickname) {
  if (nickname) session.nickname = sanitizeNickname(nickname);
  session.lastSocketId = socket.id;
  session.connectedAt = Date.now();
  socket.sessionId = session.sessionId;
  socket.reconnectToken = session.reconnectToken;
  socket.emit("sessionAssigned", toSessionAuth(session));
  return session;
}

function ensureSessionRecord(socket, auth, nickname) {
  let session = getSessionFromAuth(auth);
  if (!session && socket && socket.sessionId) {
    session = sessions.get(socket.sessionId) || null;
  }
  if (!session) {
    session = {
      sessionId: makeOpaqueId("sess_"),
      reconnectToken: makeOpaqueId("reco_"),
      nickname: sanitizeNickname(nickname),
      roomId: null,
      slotIndex: null,
      matchId: null,
      matchType: null,
      lastSocketId: socket.id,
      connectedAt: Date.now()
    };
    sessions.set(session.sessionId, session);
  }
  return bindSessionToSocket(socket, session, nickname);
}

function getRoom(roomId) {
  return roomId ? (rooms.get(roomId) || null) : null;
}

function createRoom(roomId) {
  const room = {
    hostId: null,
    createdAt: Date.now(),
    emptySince: null,
    matchId: null,
    matchType: null,
    seed: null,
    startedAt: null,
    slots: Array.from({ length: SLOTS }, (_, i) => ({
      id: null, sessionId: null, name: null, colorIndex: i, isBot: false, spawnIndex: i, disconnected: false, reservedUntil: null
    })),
    chat: []
  };
  rooms.set(roomId, room);
  return room;
}

function ensureRoom(roomId) {
  return getRoom(roomId) || createRoom(roomId);
}

function roomHasHumanPlayers(room) {
  return !!(room && room.slots.some((s) => !!s.id));
}

function roomHasReservedPlayers(room, now) {
  return !!(room && room.slots.some((s) => !!s.sessionId && !s.isBot && s.reservedUntil != null && s.reservedUntil > (now || Date.now())));
}

function roomHasOccupants(room) {
  return !!(room && room.slots.some((s) => !!(s.id || s.isBot)));
}

function touchRoomOccupancy(room) {
  if (!room) return;
  room.emptySince = roomHasHumanPlayers(room) ? null : (room.emptySince || Date.now());
}

function pruneRooms() {
  const now = Date.now();
  for (const [roomId, room] of rooms) {
    if (roomHasHumanPlayers(room) || roomHasReservedPlayers(room, now)) {
      room.emptySince = null;
      continue;
    }
    const emptySince = room.emptySince ?? room.createdAt ?? now;
    if ((now - emptySince) >= ROOM_GRACE_MS) {
      const runtime = authoritativeRuntimes.get(roomId);
      if (runtime) {
        runtime.stop();
        authoritativeRuntimes.delete(roomId);
      }
      rooms.delete(roomId);
    }
  }
}

function startAuthoritativeRuntime(roomId, room) {
  if (AUTHORITY_MODE !== "server" || !roomId || !room) return null;
  const existing = authoritativeRuntimes.get(roomId);
  if (existing) return existing;
  const runtime = createAuthoritativeMatchRuntime({
    io,
    roomId,
    matchId: room.matchId,
    matchType: room.matchType,
    seed: room.seed,
    slots: slotSummary(room)
  });
  runtime.start();
  authoritativeRuntimes.set(roomId, runtime);
  return runtime;
}

function makeRoomId() {
  let roomId = "";
  do {
    roomId = "r_" + Math.random().toString(36).slice(2, 10);
  } while (rooms.has(roomId));
  return roomId;
}

function getHostSlot(room) {
  if (!room || !room.hostId) return -1;
  return room.slots.findIndex((s) => s.id === room.hostId);
}

function getUsedColors(room, excludeSlot) {
  const used = new Set();
  for (let i = 0; i < SLOTS; i++) {
    if (i === excludeSlot) continue;
    const s = room.slots[i];
    if (s.id || s.isBot) used.add(s.colorIndex);
  }
  return used;
}

function getUsedSpawns(room, excludeSlot) {
  const used = new Set();
  for (let i = 0; i < SLOTS; i++) {
    if (i === excludeSlot) continue;
    const s = room.slots[i];
    if (s.id || s.isBot) used.add(s.spawnIndex != null ? s.spawnIndex : i);
  }
  return used;
}

function nextFreeColor(room, excludeSlot) {
  const used = getUsedColors(room, excludeSlot);
  for (let c = 0; c < COLOR_COUNT; c++) {
    if (!used.has(c)) return c;
  }
  return 0;
}

function nextFreeSpawn(room, excludeSlot) {
  const used = getUsedSpawns(room, excludeSlot);
  for (let s = 0; s < SLOTS; s++) {
    if (!used.has(s)) return s;
  }
  return 0;
}

function slotSummary(room) {
  return room.slots.map((s, i) => ({
    index: i,
    id: s.id,
    name: s.name || (s.isBot ? "Бот" : "Пусто"),
    colorIndex: s.colorIndex,
    isBot: s.isBot,
    spawnIndex: s.spawnIndex != null ? s.spawnIndex : i,
    disconnected: !!s.disconnected
  }));
}

function roomSnapshot(room) {
  return {
    slots: slotSummary(room),
    hostSlot: getHostSlot(room)
  };
}

function emitRoomSlots(roomId, room) {
  io.to(roomId).emit("slots", roomSnapshot(room));
}

function getLiveQueueEntries(matchType) {
  const type = normalizeMatchType(matchType);
  return queueManager.queues[type].filter((entry) => io.sockets.sockets.get(entry.socketId));
}

function broadcastQueueStatus(matchType) {
  const type = normalizeMatchType(matchType);
  const liveEntries = getLiveQueueEntries(type);
  const status = queueManager.getStatus(type, Date.now());
  for (const entry of liveEntries) {
    const queuedSocket = io.sockets.sockets.get(entry.socketId);
    if (queuedSocket) queuedSocket.emit("queueStatus", status);
  }
}

function broadcastAllQueues() {
  broadcastQueueStatus("duel");
  broadcastQueueStatus("ffa4");
}

function attachSessionToRoomSlot(sessionId, roomId, slotIndex, matchId, matchType) {
  const session = sessionId ? sessions.get(sessionId) : null;
  if (!session) return;
  session.roomId = roomId;
  session.slotIndex = slotIndex;
  session.matchId = matchId;
  session.matchType = matchType;
}

function buildMatchForQueue(matchType, humanEntries) {
  const type = normalizeMatchType(matchType);
  const roomId = makeRoomId();
  const room = createRoom(roomId);
  const seed = (Date.now() >>> 0);
  const requiredPlayers = getRequiredPlayers(type);
  const liveHumans = (humanEntries || []).filter((entry) => io.sockets.sockets.get(entry.socketId));
  const matchId = makeOpaqueId("match_");
  room.matchId = matchId;
  room.matchType = type;
  room.seed = seed;
  room.startedAt = Date.now();
  let slotIndex = 0;
  for (const entry of liveHumans) {
    const playerSocket = io.sockets.sockets.get(entry.socketId);
    if (!playerSocket) continue;
    const session = ensureSessionRecord(playerSocket, { sessionId: entry.sessionId, reconnectToken: playerSocket.reconnectToken }, entry.nickname);
    room.slots[slotIndex] = {
      id: playerSocket.id,
      sessionId: session.sessionId,
      name: sanitizeNickname(entry.nickname),
      colorIndex: nextFreeColor(room, slotIndex),
      isBot: false,
      spawnIndex: nextFreeSpawn(room, slotIndex),
      disconnected: false,
      reservedUntil: null
    };
    if (!room.hostId) room.hostId = playerSocket.id;
    playerSocket.join(roomId);
    playerSocket.roomId = roomId;
    playerSocket.slotIndex = slotIndex;
    playerSocket.isHost = room.hostId === playerSocket.id;
    playerSocket.queueMatchType = null;
    attachSessionToRoomSlot(session.sessionId, roomId, slotIndex, matchId, type);
    slotIndex++;
  }
  while (slotIndex < requiredPlayers && slotIndex < SLOTS) {
    room.slots[slotIndex] = {
      id: null,
      sessionId: null,
      name: "Бот",
      colorIndex: nextFreeColor(room, slotIndex),
      isBot: true,
      spawnIndex: nextFreeSpawn(room, slotIndex),
      disconnected: false,
      reservedUntil: null
    };
    slotIndex++;
  }
  const slots = slotSummary(room);
  matches.set(matchId, createMatchRecord({ matchId, roomId, matchType: type, authorityMode: AUTHORITY_MODE, seed, slots }));
  emitRoomSlots(roomId, room);
  for (const slot of room.slots) {
    if (!slot.id) continue;
    const playerSocket = io.sockets.sockets.get(slot.id);
    if (!playerSocket) continue;
    const session = sessions.get(slot.sessionId);
    playerSocket.emit("queueStatus", { active: false, matchType: type, playersInQueue: 0, requiredPlayers, botFillAfterMs: DEFAULT_QUEUE_BOT_FILL_MS });
    playerSocket.emit("matchFound", {
      roomId,
      matchId,
      matchType: type,
      authorityMode: AUTHORITY_MODE,
      seed,
      slots,
      mySlot: playerSocket.slotIndex,
      hostSlot: getHostSlot(room),
      isHost: playerSocket.isHost
    });
    playerSocket.emit("sessionAssigned", toSessionAuth(session || { sessionId: playerSocket.sessionId, reconnectToken: playerSocket.reconnectToken, nickname: slot.name }));
  }
  io.to(roomId).emit("gameStart", buildGameStartPayload({
    roomId,
    matchId,
    matchType: type,
    authorityMode: AUTHORITY_MODE,
    seed,
    slots
  }));
  startAuthoritativeRuntime(roomId, room);
}

function attemptQueueMatch(matchType) {
  const type = normalizeMatchType(matchType);
  const group = queueManager.takeReadyGroup(type, Date.now());
  if (!group || group.length === 0) {
    broadcastAllQueues();
    return;
  }
  buildMatchForQueue(type, group);
  broadcastAllQueues();
}

function removePlayerFromRoom(socket) {
  const roomId = socket.roomId;
  if (!roomId) return;
  const room = getRoom(roomId);
  if (!room) {
    socket.roomId = null;
    socket.slotIndex = null;
    socket.isHost = false;
    return;
  }

  for (let i = 0; i < SLOTS; i++) {
    if (room.slots[i].id === socket.id) {
      const existing = room.slots[i];
      if (room.startedAt && existing.sessionId) {
        room.slots[i] = {
          ...existing,
          id: null,
          disconnected: true,
          reservedUntil: Date.now() + RECONNECT_GRACE_MS
        };
        attachSessionToRoomSlot(existing.sessionId, roomId, i, room.matchId, room.matchType);
      } else {
        room.slots[i] = {
          id: null,
          sessionId: null,
          name: null,
          colorIndex: room.slots[i].colorIndex,
          isBot: false,
          spawnIndex: room.slots[i].spawnIndex,
          disconnected: false,
          reservedUntil: null
        };
        if (existing.sessionId) {
          const session = sessions.get(existing.sessionId);
          if (session) {
            session.roomId = null;
            session.slotIndex = null;
            session.matchId = null;
            session.matchType = null;
          }
        }
      }
      break;
    }
  }

  if (room.hostId === socket.id) {
    const next = room.slots.find((s) => s.id);
    room.hostId = next ? next.id : null;
    if (next && next.id) {
      const nextSocket = io.sockets.sockets.get(next.id);
      if (nextSocket) nextSocket.isHost = true;
    }
  }

  touchRoomOccupancy(room);
  socket.roomId = null;
  socket.slotIndex = null;
  socket.isHost = false;
  socket.queueMatchType = null;
  socket.leave(roomId);
  emitRoomSlots(roomId, room);
  pruneRooms();
}

// ─── Connection handler ──────────────────────────────────────────

io.on("connection", (socket) => {
  if (shuttingDown) {
    socket.emit("serverShutdown", { reason: "server_shutdown", draining: true });
    socket.disconnect(true);
    return;
  }
  const clientIp = socket.handshake.address || "?";
  console.log("[Socket] connect:", socket.id, "IP:", clientIp);
  ensureSessionRecord(socket, null, "Игрок");

  const lanUrl = getServerLanUrl();
  if (lanUrl) socket.emit("serverUrl", lanUrl);

  // ── RTT measurement ──
  socket.on("net:ping", (seq) => {
    socket.emit("net:pong", seq);
  });

  socket.on("reconnectAttempt", (auth) => {
    const session = getSessionFromAuth(auth);
    if (!session) {
      socket.emit("reconnectFailed", { reason: "invalid_session" });
      return;
    }
    bindSessionToSocket(socket, session, session.nickname);
    if (!session.roomId || session.slotIndex == null) return;
    const room = getRoom(session.roomId);
    if (!room) {
      socket.emit("reconnectFailed", { reason: "room_missing" });
      return;
    }
    const slot = room.slots[session.slotIndex];
    if (!slot || slot.sessionId !== session.sessionId) {
      socket.emit("reconnectFailed", { reason: "slot_missing" });
      return;
    }
    if (slot.reservedUntil != null && slot.reservedUntil < Date.now() && !slot.id) {
      socket.emit("reconnectFailed", { reason: "reconnect_expired" });
      return;
    }
    socket.join(session.roomId);
    slot.id = socket.id;
    slot.disconnected = false;
    slot.reservedUntil = null;
    socket.roomId = session.roomId;
    socket.slotIndex = session.slotIndex;
    if (!room.hostId) room.hostId = socket.id;
    socket.isHost = room.hostId === socket.id;
    emitRoomSlots(session.roomId, room);
    socket.emit("reconnectGranted", {
      roomId: session.roomId,
      matchId: room.matchId,
      matchType: room.matchType || inferMatchTypeFromSlots(slotSummary(room)),
      authorityMode: AUTHORITY_MODE,
      slots: slotSummary(room),
      mySlot: session.slotIndex,
      hostSlot: getHostSlot(room),
      isHost: socket.isHost,
      seed: room.seed
    });
    if (room.startedAt) {
      socket.emit("gameStart", buildGameStartPayload({
        roomId: session.roomId,
        matchId: room.matchId,
        matchType: room.matchType,
        authorityMode: AUTHORITY_MODE,
        seed: room.seed,
        slots: slotSummary(room),
        reconnected: true
      }));
    }
  });

  socket.on("queueJoin", (payload) => {
    const data = (payload && typeof payload === "object") ? payload : {};
    const matchType = normalizeMatchType(data.matchType);
    const name = sanitizeNickname(data.nickname);
    const previousQueueType = socket.queueMatchType ? normalizeMatchType(socket.queueMatchType) : null;
    ensureSessionRecord(socket, data, name);
    removePlayerFromRoom(socket);
    queueManager.join(matchType, {
      socketId: socket.id,
      sessionId: socket.sessionId,
      nickname: name,
      joinedAt: Date.now()
    });
    socket.queueMatchType = matchType;
    if (previousQueueType && previousQueueType !== matchType) broadcastAllQueues();
    broadcastAllQueues();
    attemptQueueMatch(matchType);
    setTimeout(() => attemptQueueMatch(matchType), DEFAULT_QUEUE_BOT_FILL_MS + 50);
  });

  socket.on("queueLeave", () => {
    const type = socket.queueMatchType ? normalizeMatchType(socket.queueMatchType) : null;
    queueManager.leaveBySocket(socket.id);
    socket.queueMatchType = null;
    if (type) broadcastAllQueues();
    socket.emit("queueStatus", { active: false, matchType: type || "duel", playersInQueue: 0, requiredPlayers: type === "ffa4" ? 4 : 2, botFillAfterMs: DEFAULT_QUEUE_BOT_FILL_MS });
  });

  // ── Lobby: create room ──
  socket.on("create", (nickname, cb) => {
    pruneRooms();
    const previousQueueType = socket.queueMatchType ? normalizeMatchType(socket.queueMatchType) : null;
    queueManager.leaveBySocket(socket.id);
    socket.queueMatchType = null;
    broadcastAllQueues();
    if (previousQueueType) {
      socket.emit("queueStatus", { active: false, matchType: previousQueueType, playersInQueue: 0, requiredPlayers: previousQueueType === "ffa4" ? 4 : 2, botFillAfterMs: DEFAULT_QUEUE_BOT_FILL_MS });
    }
    removePlayerFromRoom(socket);
    const name = sanitizeNickname(nickname);
    const session = ensureSessionRecord(socket, null, name);
    const roomId = makeRoomId();
    const room = createRoom(roomId);
    room.hostId = socket.id;
    room.emptySince = null;
    room.slots[0] = { id: socket.id, sessionId: session.sessionId, name, colorIndex: 0, isBot: false, spawnIndex: 0, disconnected: false, reservedUntil: null };
    socket.join(roomId);
    socket.roomId = roomId;
    socket.slotIndex = 0;
    socket.isHost = true;
    attachSessionToRoomSlot(session.sessionId, roomId, 0, null, null);
    console.log("[Socket] create room", roomId.replace(/^r_/, ""),
      "host:", name, "IP:", clientIp);
    if (typeof cb === "function")
      cb({ roomId, slots: slotSummary(room), mySlot: 0, isHost: true, hostSlot: 0, sessionId: session.sessionId, matchType: room.matchType });
  });

  // ── Lobby: list rooms ──
  socket.on("listRooms", (cb) => {
    pruneRooms();
    const list = [];
    const now = Date.now();
    for (const [roomId, room] of rooms) {
      if (room.startedAt) continue;
      const hasPlayers = roomHasHumanPlayers(room);
      const recent = room.emptySince != null
        ? (now - room.emptySince) < ROOM_GRACE_MS
        : true;
      if (!hasPlayers && !recent) continue;
      const slotsUsed = room.slots.filter((s) => s.id || s.isBot).length;
      const hostSlot = room.slots.find((s) => s.id === room.hostId);
      list.push({
        roomId,
        code: roomId.replace(/^r_/, ""),
        hostName: hostSlot ? (hostSlot.name || "Хост") : (hasPlayers ? "Хост" : "—"),
        slotsUsed,
        slotsTotal: SLOTS
      });
    }
    if (typeof cb === "function") cb(list);
  });

  // ── Lobby: join room ──
  socket.on("join", (roomId, nickname, cb) => {
    pruneRooms();
    const previousQueueType = socket.queueMatchType ? normalizeMatchType(socket.queueMatchType) : null;
    queueManager.leaveBySocket(socket.id);
    socket.queueMatchType = null;
    broadcastAllQueues();
    if (previousQueueType) {
      socket.emit("queueStatus", { active: false, matchType: previousQueueType, playersInQueue: 0, requiredPlayers: previousQueueType === "ffa4" ? 4 : 2, botFillAfterMs: DEFAULT_QUEUE_BOT_FILL_MS });
    }
    removePlayerFromRoom(socket);
    const name = sanitizeNickname(nickname);
    const session = ensureSessionRecord(socket, null, name);
    let rid = String(roomId || "").trim();
    if (rid && !rid.startsWith("r_")) rid = "r_" + rid;
    const room = getRoom(rid);
    if (!room) {
      console.log("[Socket] join FAIL missing room:", rid.replace(/^r_/, ""),
        "nick:", name, "IP:", clientIp);
      if (typeof cb === "function") cb({ error: "Комната не найдена" });
      return;
    }

    let slotIndex = -1;
    for (let i = 0; i < SLOTS; i++) {
      const slot = room.slots[i];
      const reserved = slot.reservedUntil != null && slot.reservedUntil > Date.now();
      if (!slot.id && !slot.isBot && !reserved) { slotIndex = i; break; }
    }
    if (slotIndex < 0) {
      console.log("[Socket] join FAIL room:", rid.replace(/^r_/, ""),
        "nick:", name, "IP:", clientIp);
      if (typeof cb === "function") cb({ error: "Нет свободных слотов" });
      return;
    }

    room.slots[slotIndex] = {
      id: socket.id, sessionId: session.sessionId, name,
      colorIndex: nextFreeColor(room, slotIndex),
      isBot: false,
      spawnIndex: nextFreeSpawn(room, slotIndex),
      disconnected: false,
      reservedUntil: null
    };
    if (!room.hostId) {
      room.hostId = socket.id;
    }
    room.emptySince = null;
    socket.join(rid);
    socket.roomId = rid;
    socket.slotIndex = slotIndex;
    socket.isHost = room.hostId === socket.id;
    attachSessionToRoomSlot(session.sessionId, rid, slotIndex, room.matchId, room.matchType);
    console.log("[Socket] join OK room:", rid.replace(/^r_/, ""),
      "slot:", slotIndex, "nick:", name, "isHost:", socket.isHost, "IP:", clientIp);
    emitRoomSlots(rid, room);
    if (typeof cb === "function")
      cb({ roomId: rid, slots: slotSummary(room),
           mySlot: slotIndex, isHost: socket.isHost, hostSlot: getHostSlot(room), sessionId: session.sessionId, matchType: room.matchType });
  });

  // ── Lobby: slot / color / chat ──
  socket.on("setSlot", (slotIndex, isBot) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (slotIndex < 0 || slotIndex >= SLOTS) return;
    if (isBot) {
      room.slots[slotIndex] = {
        id: null, sessionId: null, name: "Бот",
        colorIndex: nextFreeColor(room, slotIndex),
        isBot: true,
        spawnIndex: nextFreeSpawn(room, slotIndex),
        disconnected: false,
        reservedUntil: null
      };
    } else {
      room.slots[slotIndex] = {
        id: null, sessionId: null, name: null,
        colorIndex: room.slots[slotIndex].colorIndex, isBot: false,
        spawnIndex: room.slots[slotIndex].spawnIndex,
        disconnected: false,
        reservedUntil: null
      };
    }
    touchRoomOccupancy(room);
    emitRoomSlots(roomId, room);
  });

  socket.on("setColor", (colorIndex) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;
    const idx = room.slots.findIndex((s) => s.id === socket.id);
    if (idx < 0) return;
    const ci = Math.max(0, Math.min(COLOR_COUNT - 1, colorIndex | 0));
    const used = getUsedColors(room, idx);
    if (used.has(ci)) return;
    room.slots[idx].colorIndex = ci;
    emitRoomSlots(roomId, room);
  });

  socket.on("setSlotColor", (slotIndex, colorIndex) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (slotIndex < 0 || slotIndex >= SLOTS) return;
    const ci = Math.max(0, Math.min(COLOR_COUNT - 1, colorIndex | 0));
    const used = getUsedColors(room, slotIndex);
    if (used.has(ci)) return;
    room.slots[slotIndex].colorIndex = ci;
    emitRoomSlots(roomId, room);
  });

  socket.on("setSpawn", (spawnIndex) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;
    const idx = room.slots.findIndex((s) => s.id === socket.id);
    if (idx < 0) return;
    const si = Math.max(0, Math.min(SLOTS - 1, spawnIndex | 0));
    const taken = room.slots.some((s, j) => j !== idx && s.spawnIndex === si && (s.id || s.isBot));
    if (taken) return;
    room.slots[idx].spawnIndex = si;
    emitRoomSlots(roomId, room);
  });

  socket.on("setSlotSpawn", (slotIndex, spawnIndex) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (slotIndex < 0 || slotIndex >= SLOTS) return;
    const si = Math.max(0, Math.min(SLOTS - 1, spawnIndex | 0));
    const taken = room.slots.some((s, j) => j !== slotIndex && s.spawnIndex === si && (s.id || s.isBot));
    if (taken) return;
    room.slots[slotIndex].spawnIndex = si;
    emitRoomSlots(roomId, room);
  });

  socket.on("chat", (text) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;
    const idx = room.slots.findIndex((s) => s.id === socket.id);
    const name = idx >= 0 ? (room.slots[idx].name || "Игрок") : "?";
    const msg = { name, text: String(text).slice(0, 200), t: Date.now() };
    room.chat.push(msg);
    if (room.chat.length > 100) room.chat.shift();
    io.to(roomId).emit("chat", msg);
  });

  // ── Lobby: leave ──
  socket.on("leave", () => removePlayerFromRoom(socket));

  // ── Game: state relay (host → clients) ──
  let _gsLogCtr = 0;
  socket.on("gameState", (data) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;
    if (AUTHORITY_MODE === "server") return;
    if (room.hostId !== socket.id) return;
    _gsLogCtr++;
    if (_gsLogCtr % 500 === 1) {
      const seq = data?._seq ?? "?";
      const full = data?._fullSync ? "FULL" : "delta";
      console.log(`[Relay] #${_gsLogCtr} seq=${seq} ${full}` +
        ` units=${(data?.units || []).length}`);
    }
    socket.to(roomId).emit("gameState", data);
  });

  // ── Game: player actions (client → host) ──
  socket.on("playerAction", (data) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room || !room.hostId) return;
    const senderSlot = room.slots.findIndex((s) => s.id === socket.id);
    if (senderSlot < 0) return;
    const payload = (data && typeof data === "object") ? { ...data } : { type: "invalid" };
    payload._senderSlot = senderSlot;
    payload._senderSocketId = socket.id;
    payload._senderPlayerId = senderSlot + 1;
    payload._senderSessionId = socket.sessionId || room.slots[senderSlot].sessionId || null;
    if (AUTHORITY_MODE === "server") {
      const runtime = authoritativeRuntimes.get(roomId);
      if (runtime) runtime.enqueueAction(payload);
      return;
    }
    io.to(room.hostId).emit("playerAction", payload);
  });

  // ── Game: map regeneration (host → clients) ──
  socket.on("mapRegenerate", (data) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;
    if (room.hostId !== socket.id) return;
    socket.to(roomId).emit("mapRegenerate", data);
  });

  socket.on("cardState", (data) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;
    if (room.hostId !== socket.id) return;
    socket.to(roomId).emit("cardState", data);
  });

  // ── Game: start ──
  socket.on("start", (payload) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;
    if (room.hostId !== socket.id) return;
    const occupiedCount = room.slots.filter((s) => s.id || s.isBot).length;
    if (occupiedCount !== 2 && occupiedCount !== 4) {
      socket.emit("startRejected", "Матч можно запускать только в формате 1v1 или 1v1v1v1.");
      return;
    }
    const slots = slotSummary(room);
    const seed = (payload && typeof payload.seed === "number")
      ? payload.seed
      : (Date.now() >>> 0);
    room.matchId = room.matchId || makeOpaqueId("match_");
    room.matchType = normalizeMatchType((payload && payload.matchType) || inferMatchTypeFromSlots(slots));
    room.seed = seed;
    room.startedAt = Date.now();
    matches.set(room.matchId, createMatchRecord({
      matchId: room.matchId,
      roomId,
      matchType: room.matchType,
      authorityMode: AUTHORITY_MODE,
      seed,
      slots
    }));
    for (let i = 0; i < room.slots.length; i++) {
      if (room.slots[i].sessionId) attachSessionToRoomSlot(room.slots[i].sessionId, roomId, i, room.matchId, room.matchType);
    }
    io.to(roomId).emit("gameStart", buildGameStartPayload({
      roomId,
      matchId: room.matchId,
      matchType: room.matchType,
      authorityMode: AUTHORITY_MODE,
      seed,
      slots
    }));
    startAuthoritativeRuntime(roomId, room);
  });

  // ── Disconnect ──
  socket.on("disconnect", (reason) => {
    console.log("[Socket] disconnect:", socket.id, "reason:", reason);
    if (socket.queueMatchType) {
      queueManager.leaveBySocket(socket.id);
      broadcastAllQueues();
    }
    removePlayerFromRoom(socket);
  });

  socket.on("error", (err) => {
    console.error("[Socket] error", socket.id, err);
  });
});

function stopAllAuthoritativeRuntimes() {
  for (const runtime of authoritativeRuntimes.values()) {
    try {
      runtime.stop();
    } catch (err) {
      console.error("[Shutdown] runtime stop failed:", err && err.message ? err.message : err);
    }
  }
  authoritativeRuntimes.clear();
}

let shutdownStarted = false;
function beginGracefulShutdown(signal) {
  if (shutdownStarted) return;
  shutdownStarted = true;
  shuttingDown = true;
  console.log("[Shutdown]", signal, "received. Draining sockets and authoritative runtimes...");
  stopAllAuthoritativeRuntimes();
  try {
    io.emit("serverShutdown", { reason: "server_shutdown", signal });
  } catch (_) { /* ignore */ }
  const forceExitTimer = setTimeout(() => {
    console.error("[Shutdown] Grace period exceeded. Forcing exit.");
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  if (typeof forceExitTimer.unref === "function") forceExitTimer.unref();
  io.close(() => {
    httpServer.close(() => {
      clearTimeout(forceExitTimer);
      console.log("[Shutdown] Completed cleanly.");
      process.exit(0);
    });
  });
}

process.once("SIGINT", () => beginGracefulShutdown("SIGINT"));
process.once("SIGTERM", () => beginGracefulShutdown("SIGTERM"));

// ─── Start ────────────────────────────────────────────────────────

httpServer.listen(PORT, "0.0.0.0", () => {
  const lanUrl = getServerLanUrl();
  const useTunnel = process.env.USE_TUNNEL === "1" || process.argv.includes("--tunnel");

  console.log("VoidFront lobby server: http://localhost:" + PORT);
  if (lanUrl) console.log("  LAN: " + lanUrl);
  console.log("  Authority mode: " + AUTHORITY_MODE);
  console.log("  Health: http://localhost:" + PORT + "/healthz");
  if (!SOCKET_CORS_POLICY.allowAll) {
    console.log("  Allowed origins:", Array.from(SOCKET_CORS_POLICY.origins).join(", "));
  }

  if (useTunnel) {
    require("localtunnel")({ port: PORT })
      .then((tunnel) => {
        console.log("  Tunnel: " + tunnel.url);
        tunnel.on("close", () => console.log("  Tunnel closed."));
        tunnel.on("error", (err) => console.error("  Tunnel error:", err.message));
      })
      .catch((err) => console.error("  Tunnel failed:", err.message));
  }
});
