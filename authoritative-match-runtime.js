const NET = require("./net");
const UTILS = require("./utils");
const NOISE = require("./noise");
const SharedSimState = require("./shared-sim-state");
const SharedCitySim = require("./shared-city-sim");
const SharedMatchBootstrap = require("./shared-match-bootstrap");
const { createSharedGameConfig } = require("./shared-game-config");

const TICK_MS = 1000 / 30;

const DEFAULT_PLAYER_COLORS = {
  1: 0xff8800,
  2: 0xcc2222,
  3: 0xddcc00,
  4: 0x4488ff,
  5: 0x22aa44,
  6: 0xaa44cc,
  7: 0x44cccc
};

function colorForId(id) {
  if (DEFAULT_PLAYER_COLORS[id] != null) return DEFAULT_PLAYER_COLORS[id];
  return 0x888888;
}

function getPlanetRadius(player, CFG) {
  const baseInfluence = CFG.INFLUENCE_BASE_R || 240;
  const current = player && player.influenceR ? player.influenceR : baseInfluence;
  const scale = Math.max(1, Math.min(2.5, current / baseInfluence));
  return 16 * scale;
}

function shieldRadius(player, CFG) {
  return getPlanetRadius(player, CFG) + 12;
}

function xpNeed(level, player, CFG) {
  let base = Math.floor(CFG.XP_BASE + CFG.XP_PER_LEVEL * level * CFG.XP_LEVEL_MUL);
  if (player && typeof player.xpZonePct === "number") {
    if (player.xpZonePct >= 5) base = Math.floor(base * (1 + (player.xpZonePct / 10) * 0.11));
    else base = Math.floor(base * 0.8);
  }
  return Math.max(1, base);
}

function normalizeFilledSlots(slots) {
  return (Array.isArray(slots) ? slots : []).filter((slot) => slot && (slot.id || slot.isBot));
}

function createAuthoritativeMatchRuntime(options) {
  const opts = options || {};
  const io = opts.io;
  const roomId = opts.roomId;
  const seed = Number.isFinite(opts.seed) ? opts.seed : (Date.now() >>> 0);
  const rawSlots = Array.isArray(opts.slots) ? opts.slots : [];
  const CFG = createSharedGameConfig();
  const state = {};
  SharedSimState.applyBaseState(state, CFG);

  const citySimApi = SharedCitySim.install({
    state,
    CFG,
    fbm: NOISE.fbm,
    clamp: UTILS.clamp,
    isPointInPolygon: UTILS.isPointInPolygon,
    polygonArea: UTILS.polygonArea,
    getPlanetRadius: (player) => getPlanetRadius(player, CFG),
    shieldRadius: (player) => shieldRadius(player, CFG),
    xpNeed: (level, player) => xpNeed(level, player, CFG),
    getActiveGrowthBonusPerMin: () => 0,
    getMapSeed: () => seed
  });

  const bootstrapApi = SharedMatchBootstrap.install({
    CFG,
    clamp: UTILS.clamp,
    computeInfluencePolygon: citySimApi.computeInfluencePolygon,
    colorForId,
    nameForId: (id) => "Player#" + id,
    cardSystemApi: null
  });

  const serializer = new NET.SnapshotSerializer();
  const filledSlots = normalizeFilledSlots(rawSlots);
  const slotToPid = {};
  for (let i = 0; i < filledSlots.length; i++) {
    const sourceIndex = rawSlots.indexOf(filledSlots[i]);
    slotToPid[sourceIndex] = sourceIndex + 1;
  }

  const allSpawns = bootstrapApi.getFixedSpawnPositions(4);
  const activeSpawnIndices = filledSlots.length === 2 ? [0, 2] : [0, 1, 2, 3];
  for (let i = 0; i < filledSlots.length; i++) {
    const slot = filledSlots[i];
    const slotIndex = rawSlots.indexOf(slot);
    const playerId = slotToPid[slotIndex];
    const spawnIndex = activeSpawnIndices[i] ?? i;
    const pos = allSpawns[spawnIndex] || allSpawns[0];
    const player = bootstrapApi.makePlayer(playerId, slot.name || ("Player#" + playerId), pos.x, pos.y, CFG.POP_START);
    if (slot.colorIndex != null) player.colorIndex = slot.colorIndex;
    player.spawnIndex = slot.spawnIndex != null ? slot.spawnIndex : spawnIndex;
    state.players.set(player.id, player);
  }
  citySimApi.rebuildZoneGrid();

  let tickTimer = null;
  const queuedActions = [];

  function broadcastSnapshot() {
    if (!io || !roomId) return;
    const snap = serializer.serialize(state);
    io.to(roomId).emit("gameState", snap);
  }

  function tick() {
    state.t += TICK_MS / 1000;
    citySimApi.stepCities(TICK_MS / 1000);
    citySimApi.rebuildZoneGrid();
    while (queuedActions.length > 0) queuedActions.shift();
    broadcastSnapshot();
  }

  return {
    roomId,
    seed,
    state,
    slotToPid,
    start() {
      if (tickTimer != null) return;
      broadcastSnapshot();
      tickTimer = setInterval(tick, TICK_MS);
    },
    stop() {
      if (tickTimer != null) clearInterval(tickTimer);
      tickTimer = null;
    },
    enqueueAction(action) {
      queuedActions.push(action);
    }
  };
}

module.exports = {
  createAuthoritativeMatchRuntime
};
