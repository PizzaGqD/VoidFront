const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = process.env.PORT || 3040;

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
  } catch (e) {}
  return null;
}
const SLOTS = 5;
const COLOR_COUNT = 36;

const server = http.createServer((req, res) => {
  const clientIp = req.socket.remoteAddress || req.socket.remoteFamily || "?";
  console.log("[HTTP]", req.method, req.url, "from", clientIp);
  const file = req.url === "/" || req.url === "" ? "index.html" : req.url.replace(/^\//, "").replace(/[?].*$/, "");
  const filePath = path.join(__dirname, file);
  const ext = path.extname(filePath);
  const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json" };
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.log("[HTTP] 404", filePath);
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { "Content-Type": types[ext] || "text/plain", "Cache-Control": "no-store, no-cache, must-revalidate" });
    res.end(data);
  });
});

const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 5e6 });

const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      hostId: null,
      slots: Array.from({ length: SLOTS }, () => ({ id: null, name: null, colorIndex: 0, isBot: false })),
      chat: []
    });
  }
  return rooms.get(roomId);
}

function slotSummary(room) {
  return room.slots.map((s, i) => ({
    index: i,
    id: s.id,
    name: s.name || (s.isBot ? "Бот" : "Пусто"),
    colorIndex: s.colorIndex,
    isBot: s.isBot
  }));
}

io.on("connection", (socket) => {
  const clientIp = socket.handshake.address || socket.conn?.remoteAddress || "?";
  console.log("[Socket] подключение:", socket.id, "IP:", clientIp);

  const lanUrl = getServerLanUrl();
  if (lanUrl) socket.emit("serverUrl", lanUrl);

  socket.on("create", (nickname, cb) => {
    const name = String(nickname || "Игрок").trim().slice(0, 24) || "Игрок";
    const roomId = "r_" + Math.random().toString(36).slice(2, 10);
    const room = getRoom(roomId);
    room.hostId = socket.id;
    room.slots[0] = { id: socket.id, name, colorIndex: 0, isBot: false };
    socket.join(roomId);
    socket.roomId = roomId;
    socket.slotIndex = 0;
    socket.isHost = true;
    console.log("[Socket] create room", roomId.replace(/^r_/, ""), "host:", name, "IP:", clientIp);
    if (typeof cb === "function") cb({ roomId, slots: slotSummary(room), mySlot: 0, isHost: true });
  });

  socket.on("listRooms", (cb) => {
    const list = [];
    for (const [roomId, room] of rooms) {
      const hasHost = room.slots.some(s => s.id);
      if (!hasHost) continue;
      const slotsUsed = room.slots.filter(s => s.id || s.isBot).length;
      const hostSlot = room.slots.find(s => s.id === room.hostId);
      list.push({
        roomId,
        code: roomId.replace(/^r_/, ""),
        hostName: hostSlot ? (hostSlot.name || "Хост") : "Хост",
        slotsUsed,
        slotsTotal: SLOTS
      });
    }
    if (typeof cb === "function") cb(list);
  });

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
      console.log("[Socket] join FAIL (нет слотов) room:", rid.replace(/^r_/, ""), "nick:", name, "IP:", clientIp);
      if (typeof cb === "function") cb({ error: "Нет свободных слотов" });
      return;
    }
    room.slots[slotIndex] = { id: socket.id, name, colorIndex: slotIndex % COLOR_COUNT, isBot: false };
    socket.join(rid);
    socket.roomId = rid;
    socket.slotIndex = slotIndex;
    socket.isHost = room.hostId === socket.id;
    console.log("[Socket] join OK room:", rid.replace(/^r_/, ""), "slot:", slotIndex, "nick:", name, "IP:", clientIp);
    io.to(rid).emit("slots", slotSummary(room));
    if (typeof cb === "function") cb({ roomId: rid, slots: slotSummary(room), mySlot: slotIndex, isHost: socket.isHost });
  });

  socket.on("setSlot", (slotIndex, isBot) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (room.hostId !== socket.id) return;
    if (slotIndex < 0 || slotIndex >= SLOTS) return;
    if (isBot) {
      room.slots[slotIndex] = { id: null, name: "Бот", colorIndex: room.slots[slotIndex].colorIndex, isBot: true };
    } else {
      room.slots[slotIndex] = { id: null, name: null, colorIndex: room.slots[slotIndex].colorIndex, isBot: false };
    }
    io.to(roomId).emit("slots", slotSummary(room));
  });

  socket.on("setColor", (colorIndex) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    const idx = room.slots.findIndex(s => s.id === socket.id);
    if (idx < 0) return;
    const c = Math.max(0, Math.min(COLOR_COUNT - 1, colorIndex | 0));
    room.slots[idx].colorIndex = c;
    io.to(roomId).emit("slots", slotSummary(room));
  });

  socket.on("chat", (text) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    const idx = room.slots.findIndex(s => s.id === socket.id);
    const name = idx >= 0 ? (room.slots[idx].name || "Игрок") : "?";
    const msg = { name, text: String(text).slice(0, 200), t: Date.now() };
    room.chat.push(msg);
    if (room.chat.length > 80) room.chat.shift();
    io.to(roomId).emit("chat", msg);
  });

  socket.on("leave", () => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    for (let i = 0; i < SLOTS; i++) {
      if (room.slots[i].id === socket.id) {
        room.slots[i] = { id: null, name: null, colorIndex: room.slots[i].colorIndex, isBot: false };
        break;
      }
    }
    if (room.hostId === socket.id) {
      const next = room.slots.find(s => s.id);
      room.hostId = next ? next.id : null;
    }
    socket.roomId = null;
    socket.leave(roomId);
    io.to(roomId).emit("slots", slotSummary(room));
  });

  let _gsLogCtr = 0;
  socket.on("gameState", (data) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    _gsLogCtr++;
    if (_gsLogCtr % 100 === 1) {
      const size = JSON.stringify(data).length;
      console.log("[Socket] gameState relay #" + _gsLogCtr, "size:", size, "bytes, units:", (data?.units||[]).length, "players:", (data?.players||[]).length);
    }
    socket.to(roomId).emit("gameState", data);
  });
  socket.on("playerAction", (data) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    console.log("[Socket] playerAction from", socket.id, "type:", data?.type, "pid:", data?.pid, "-> host:", room.hostId);
    if (room.hostId) io.to(room.hostId).emit("playerAction", data);
  });
  socket.on("mapRegenerate", (data) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (room.hostId !== socket.id) return;
    socket.to(roomId).emit("mapRegenerate", data);
  });

  socket.on("start", (payload) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (room.hostId !== socket.id) return;
    const slots = slotSummary(room);
    const seed = (payload && typeof payload.seed === "number") ? payload.seed : (Date.now() >>> 0);
    io.to(roomId).emit("gameStart", { slots, seed });
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket] отключение:", socket.id, "reason:", reason);
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    for (let i = 0; i < SLOTS; i++) {
      if (room.slots[i].id === socket.id) {
        room.slots[i] = { id: null, name: null, colorIndex: room.slots[i].colorIndex, isBot: false };
        break;
      }
    }
    if (room.hostId === socket.id) {
      const next = room.slots.find(s => s.id);
      room.hostId = next ? next.id : null;
    }
    io.to(roomId).emit("slots", slotSummary(room));
  });

  socket.on("error", (err) => console.error("[Socket] error", socket.id, err));
});

server.listen(PORT, "0.0.0.0", () => {
  const lanUrl = getServerLanUrl();
  const useTunnel = process.env.USE_TUNNEL === "1" || process.argv.includes("--tunnel");
  console.log("Hoi2D lobby server: http://localhost:" + PORT);
  if (lanUrl) console.log("  По локальной сети: " + lanUrl);
  console.log("  Логи: каждое HTTP-запрос и Socket подключение/отключение/join/create.");

  if (useTunnel) {
    require("localtunnel")({ port: PORT })
      .then((tunnel) => {
        console.log("  По интернету (туннель): " + tunnel.url);
        console.log("  Отправь эту ссылку тому, с кем играешь — пусть откроет в браузере.");
        tunnel.on("close", () => console.log("  Туннель закрыт."));
        tunnel.on("error", (err) => console.error("  Туннель ошибка:", err.message));
      })
      .catch((err) => console.error("  Туннель не запустился:", err.message));
  }
});
