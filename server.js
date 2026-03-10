const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = process.env.PORT || 3040;
const SLOTS = 6;
const COLOR_COUNT = 36;

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

const httpServer = http.createServer((req, res) => {
  const clientIp = req.socket.remoteAddress || "?";
  console.log("[HTTP]", req.method, req.url, "from", clientIp);

  const raw = (req.url === "/" || req.url === "")
    ? "index.html"
    : req.url.replace(/^\//, "").replace(/[?].*$/, "");
  const file = decodeURIComponent(raw);

  const filePath = path.join(__dirname, file);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.log("[HTTP] 404", filePath);
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "text/plain",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    });
    res.end(data);
  });
});

// ─── Socket.IO setup ─────────────────────────────────────────────

const io = new Server(httpServer, {
  cors: { origin: "*" },
  maxHttpBufferSize: 5e6
});

// ─── Room management ─────────────────────────────────────────────

const rooms = new Map();
/** Комнаты без игроков показываем в списке ещё N мс (хост мог отключиться) */
const ROOM_GRACE_MS = 5 * 60 * 1000;

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      hostId: null,
      createdAt: Date.now(),
      slots: Array.from({ length: SLOTS }, (_, i) => ({
        id: null, name: null, colorIndex: i, isBot: false, spawnIndex: i
      })),
      chat: []
    });
  }
  return rooms.get(roomId);
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
    spawnIndex: s.spawnIndex != null ? s.spawnIndex : i
  }));
}

function removePlayerFromRoom(socket) {
  const roomId = socket.roomId;
  if (!roomId) return;
  const room = getRoom(roomId);

  for (let i = 0; i < SLOTS; i++) {
    if (room.slots[i].id === socket.id) {
      room.slots[i] = {
        id: null, name: null,
        colorIndex: room.slots[i].colorIndex, isBot: false,
        spawnIndex: room.slots[i].spawnIndex
      };
      break;
    }
  }

  if (room.hostId === socket.id) {
    const next = room.slots.find((s) => s.id);
    room.hostId = next ? next.id : null;
  }

  socket.roomId = null;
  socket.leave(roomId);
  io.to(roomId).emit("slots", slotSummary(room));
}

// ─── Connection handler ──────────────────────────────────────────

io.on("connection", (socket) => {
  const clientIp = socket.handshake.address || "?";
  console.log("[Socket] connect:", socket.id, "IP:", clientIp);

  const lanUrl = getServerLanUrl();
  if (lanUrl) socket.emit("serverUrl", lanUrl);

  // ── RTT measurement ──
  socket.on("net:ping", (seq) => {
    socket.emit("net:pong", seq);
  });

  // ── Lobby: create room ──
  socket.on("create", (nickname, cb) => {
    const name = String(nickname || "Игрок").trim().slice(0, 24) || "Игрок";
    const roomId = "r_" + Math.random().toString(36).slice(2, 10);
    const room = getRoom(roomId);
    room.hostId = socket.id;
    room.slots[0] = { id: socket.id, name, colorIndex: 0, isBot: false, spawnIndex: 0 };
    socket.join(roomId);
    socket.roomId = roomId;
    socket.slotIndex = 0;
    socket.isHost = true;
    console.log("[Socket] create room", roomId.replace(/^r_/, ""),
      "host:", name, "IP:", clientIp);
    if (typeof cb === "function")
      cb({ roomId, slots: slotSummary(room), mySlot: 0, isHost: true });
  });

  // ── Lobby: list rooms ──
  socket.on("listRooms", (cb) => {
    const list = [];
    const now = Date.now();
    for (const [roomId, room] of rooms) {
      const hasPlayers = room.slots.some((s) => s.id);
      const recent = room.createdAt && (now - room.createdAt) < ROOM_GRACE_MS;
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
    const name = String(nickname || "Игрок").trim().slice(0, 24) || "Игрок";
    let rid = String(roomId || "").trim();
    if (rid && !rid.startsWith("r_")) rid = "r_" + rid;
    const room = getRoom(rid);

    let slotIndex = -1;
    for (let i = 0; i < SLOTS; i++) {
      if (!room.slots[i].id && !room.slots[i].isBot) { slotIndex = i; break; }
    }
    if (slotIndex < 0) {
      console.log("[Socket] join FAIL room:", rid.replace(/^r_/, ""),
        "nick:", name, "IP:", clientIp);
      if (typeof cb === "function") cb({ error: "Нет свободных слотов" });
      return;
    }

    room.slots[slotIndex] = {
      id: socket.id, name,
      colorIndex: nextFreeColor(room, slotIndex),
      isBot: false,
      spawnIndex: nextFreeSpawn(room, slotIndex)
    };
    if (!room.hostId) {
      room.hostId = socket.id;
    }
    socket.join(rid);
    socket.roomId = rid;
    socket.slotIndex = slotIndex;
    socket.isHost = room.hostId === socket.id;
    console.log("[Socket] join OK room:", rid.replace(/^r_/, ""),
      "slot:", slotIndex, "nick:", name, "isHost:", socket.isHost, "IP:", clientIp);
    io.to(rid).emit("slots", slotSummary(room));
    if (typeof cb === "function")
      cb({ roomId: rid, slots: slotSummary(room),
           mySlot: slotIndex, isHost: socket.isHost });
  });

  // ── Lobby: slot / color / chat ──
  socket.on("setSlot", (slotIndex, isBot) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (room.hostId !== socket.id) return;
    if (slotIndex < 0 || slotIndex >= SLOTS) return;
    if (isBot) {
      room.slots[slotIndex] = {
        id: null, name: "Бот",
        colorIndex: nextFreeColor(room, slotIndex),
        isBot: true,
        spawnIndex: nextFreeSpawn(room, slotIndex)
      };
    } else {
      room.slots[slotIndex] = {
        id: null, name: null,
        colorIndex: room.slots[slotIndex].colorIndex, isBot: false,
        spawnIndex: room.slots[slotIndex].spawnIndex
      };
    }
    io.to(roomId).emit("slots", slotSummary(room));
  });

  socket.on("setColor", (colorIndex) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    const idx = room.slots.findIndex((s) => s.id === socket.id);
    if (idx < 0) return;
    const ci = Math.max(0, Math.min(COLOR_COUNT - 1, colorIndex | 0));
    const used = getUsedColors(room, idx);
    if (used.has(ci)) return;
    room.slots[idx].colorIndex = ci;
    io.to(roomId).emit("slots", slotSummary(room));
  });

  socket.on("setSlotColor", (slotIndex, colorIndex) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (room.hostId !== socket.id) return;
    if (slotIndex < 0 || slotIndex >= SLOTS) return;
    const ci = Math.max(0, Math.min(COLOR_COUNT - 1, colorIndex | 0));
    const used = getUsedColors(room, slotIndex);
    if (used.has(ci)) return;
    room.slots[slotIndex].colorIndex = ci;
    io.to(roomId).emit("slots", slotSummary(room));
  });

  socket.on("setSpawn", (spawnIndex) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    const idx = room.slots.findIndex((s) => s.id === socket.id);
    if (idx < 0) return;
    const si = Math.max(0, Math.min(SLOTS - 1, spawnIndex | 0));
    const taken = room.slots.some((s, j) => j !== idx && s.spawnIndex === si && (s.id || s.isBot));
    if (taken) return;
    room.slots[idx].spawnIndex = si;
    io.to(roomId).emit("slots", slotSummary(room));
  });

  socket.on("setSlotSpawn", (slotIndex, spawnIndex) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (room.hostId !== socket.id) return;
    if (slotIndex < 0 || slotIndex >= SLOTS) return;
    const si = Math.max(0, Math.min(SLOTS - 1, spawnIndex | 0));
    const taken = room.slots.some((s, j) => j !== slotIndex && s.spawnIndex === si && (s.id || s.isBot));
    if (taken) return;
    room.slots[slotIndex].spawnIndex = si;
    io.to(roomId).emit("slots", slotSummary(room));
  });

  socket.on("chat", (text) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
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
    if (room.hostId)
      io.to(room.hostId).emit("playerAction", data);
  });

  // ── Game: map regeneration (host → clients) ──
  socket.on("mapRegenerate", (data) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (room.hostId !== socket.id) return;
    socket.to(roomId).emit("mapRegenerate", data);
  });

  // ── Game: start ──
  socket.on("start", (payload) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (room.hostId !== socket.id) return;
    const slots = slotSummary(room);
    const seed = (payload && typeof payload.seed === "number")
      ? payload.seed
      : (Date.now() >>> 0);
    io.to(roomId).emit("gameStart", { slots, seed });
  });

  // ── Disconnect ──
  socket.on("disconnect", (reason) => {
    console.log("[Socket] disconnect:", socket.id, "reason:", reason);
    removePlayerFromRoom(socket);
  });

  socket.on("error", (err) => {
    console.error("[Socket] error", socket.id, err);
  });
});

// ─── Start ────────────────────────────────────────────────────────

httpServer.listen(PORT, "0.0.0.0", () => {
  const lanUrl = getServerLanUrl();
  const useTunnel = process.env.USE_TUNNEL === "1" || process.argv.includes("--tunnel");

  console.log("VoidFront lobby server: http://localhost:" + PORT);
  if (lanUrl) console.log("  LAN: " + lanUrl);

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
