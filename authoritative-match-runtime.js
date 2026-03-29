const NET = require("./net");
const UTILS = require("./utils");
const NOISE = require("./noise");
const SharedSimState = require("./shared-sim-state");
const SharedCitySim = require("./shared-city-sim");
const SharedMatchBootstrap = require("./shared-match-bootstrap");
const SQUADLOGIC = require("./squad-logic");
const FrontPlanner = require("./front-planner");
const CardSystem = require("./card-system");
const GravAnchorAbility = require("./grav-anchor-ability");
const MeteorSwarmAbility = require("./meteor-swarm-ability");
const ThermoNukeAbility = require("./thermo-nuke-ability");
const balance = require("./shared/balance.json");
const { createSharedGameConfig } = require("./shared-game-config");

const TICK_MS = 1000 / 30;
const GAME_SPEED = 2.5;
const FULL_SYNC_EVERY = 15;
function gs(realSec) { return realSec * GAME_SPEED; }
const CORE_ROSTER_UNIT_TYPES = new Set(["destroyer", "cruiser", "battleship"]);
const UNIT_TYPES = balance.unitTypes || {};
const UNIT_CAPS = { fighter: 300, destroyer: 100, cruiser: 50, battleship: 10, hyperDestroyer: 10 };
const STORM_DMG_INTERVAL = gs(0.5);
const ION_NEBULA_DURATION_SEC = gs(10);
const METEOR_RADIUS = 11;
const METEOR_AOE_RADIUS = 120;
const METEOR_PREVIEW_RADIUS = Math.round(METEOR_AOE_RADIUS * 1.25);
const METEOR_IMPACT_DURATION = gs(1.85);
const PIRATE_OWNER_ID = -1;
const PATROL_LIGHT_SPEED = 0.018;
const PATROL_ATTACK_R = 170;
const PATROL_ATTACK_RATE = 1.2;
const PATROL_DMG = 18;
const PATROL_BASE_SHOTS = 2;
const MINE_FLOW_PHASE_NONE = "none";
const MINE_LANE_TRIGGER_COOLDOWN_SEC = gs(7.5);
const UNIT_BOUNDING_MUL = { fighter: 1.8, destroyer: 2, cruiser: 2, battleship: 2.2, hyperDestroyer: 2.5 };
const UNIT_XP_DROPS = { fighter: 1, destroyer: 8, cruiser: 25, battleship: 50, hyperDestroyer: 100 };
const UNIT_CREDIT_DROPS = { fighter: 5, destroyer: 50, cruiser: 150, battleship: 400, hyperDestroyer: 800 };
const UNIT_KILL_ENERGY_BONUSES = {
  fighter: { amount: 0.1 * 60, durationSec: 10 },
  destroyer: { amount: 0.5 * 60, durationSec: 15 },
  cruiser: { amount: 1 * 60, durationSec: 25 },
  battleship: { amount: 4 * 60, durationSec: 60 },
  hyperDestroyer: { amount: 10 * 60, durationSec: 120 }
};

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

function hash01(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453123;
  return x - Math.floor(x);
}

function getMeteorSwarmBaseSpeed(CFG) {
  return Math.hypot(CFG.WORLD_W, CFG.WORLD_H) / 19;
}

function getOrbitalStrikeConfig(abilityId) {
  if (abilityId === "orbitalBarrage") {
    return {
      abilityId: "orbitalBarrage",
      zoneRadius: 156,
      primaryRadius: 84,
      supportRadius: 72,
      damageBase: 10,
      damageMaxHpPct: 0.06,
      flightDurationSec: 6.0,
      flightVarianceSec: 0.55,
      shotIntervalSec: 0.08,
      salvoGapSec: 2.0,
      impactFadeSec: 1.0,
      salvoCount: 10,
      shotsPerSalvo: 5
    };
  }
  return {
    abilityId: "orbitalStrike",
    zoneRadius: 128,
    primaryRadius: 90,
    supportRadius: 78,
    damageBase: 12,
    damageMaxHpPct: 0.08,
    flightDurationSec: 4.9,
    flightVarianceSec: 0.35,
    shotIntervalSec: 0.06,
    salvoGapSec: 1.05,
    impactFadeSec: 1.0,
    salvoCount: 2,
    shotsPerSalvo: 5
  };
}

function getOrbitalStrikeTotalDuration(cfg) {
  return cfg.salvoGapSec * Math.max(0, cfg.salvoCount - 1) +
    cfg.flightDurationSec + cfg.flightVarianceSec +
    cfg.impactFadeSec +
    0.26;
}

function buildOrbitalSalvoTargets(zoneX, zoneY, seed, salvoIndex, cfg) {
  if ((cfg.shotsPerSalvo || 1) <= 1) {
    return [{ primary: true, tx: zoneX, ty: zoneY, radius: cfg.primaryRadius }];
  }
  const targets = [];
  for (let shotIndex = 0; shotIndex < cfg.shotsPerSalvo; shotIndex++) {
    const shotSeed = seed + salvoIndex * 181 + shotIndex * 47 + 19;
    const ang = hash01(shotSeed + 1) * Math.PI * 2;
    const rr = cfg.zoneRadius * (0.14 + Math.pow(hash01(shotSeed + 2), 0.72) * 0.72);
    targets.push({
      primary: shotIndex === 0,
      tx: zoneX + Math.cos(ang) * rr,
      ty: zoneY + Math.sin(ang) * rr * 0.74,
      radius: shotIndex === 0 ? cfg.primaryRadius : cfg.supportRadius
    });
  }
  return targets;
}

function applyBalanceToConfig(CFG) {
  const world = balance.world || {};
  const city = balance.city || {};
  const econ = balance.eCredits || {};
  const terrain = balance.terrain || {};
  CFG.WORLD_W = world.width || CFG.WORLD_W;
  CFG.WORLD_H = world.height || CFG.WORLD_H;
  CFG.POP_START = city.startPopulation || CFG.POP_START;
  CFG.ECREDITS_START = econ.startingAmount || CFG.ECREDITS_START;
  CFG.GROWTH_BASE_PER_MIN = city.baseGrowthPerMinute || CFG.GROWTH_BASE_PER_MIN;
  CFG.GROWTH_PER_100 = city.growthPer100Population || CFG.GROWTH_PER_100;
  CFG.ACTIVE_SOLDIER_PENALTY_PER = city.activeUnitPenaltyPercent || CFG.ACTIVE_SOLDIER_PENALTY_PER;
  CFG.ACTIVE_SOLDIER_PENALTY_CAP = city.activeUnitPenaltyCap || CFG.ACTIVE_SOLDIER_PENALTY_CAP;
  CFG.INFLUENCE_BASE_R = city.influenceBaseRadius || CFG.INFLUENCE_BASE_R;
  CFG.INFLUENCE_POP_FACTOR = city.influencePopFactor || CFG.INFLUENCE_POP_FACTOR;
  CFG.TERRAIN_RAYS = terrain.influenceNumRays || CFG.TERRAIN_RAYS;
  CFG.TERRAIN_STEP = terrain.influenceStepSize || CFG.TERRAIN_STEP;
  CFG.BLACKHOLE_DURATION = balance.blackHole?.duration || 17;
  CFG.BLACKHOLE_RADIUS = balance.blackHole?.radius || 400;
  CFG.BLACKHOLE_GROWTH_TIME = balance.blackHole?.growthTime || 3;
  CFG.BLACKHOLE_HOLD_TIME = balance.blackHole?.holdTime || 10;
  CFG.BLACKHOLE_FADE_TIME = balance.blackHole?.fadeTime || 4;
  CFG.BLACKHOLE_GRAVITY = balance.blackHole?.gravityStrength || 70;
  CFG.BLACKHOLE_MIN_DPS = balance.blackHole?.minDamagePerSec || 1;
  CFG.BLACKHOLE_MAX_DPS = balance.blackHole?.maxDamagePerSec || 10;
  CFG.INFLUENCE_R = function (pop) {
    return CFG.INFLUENCE_BASE_R + CFG.INFLUENCE_POP_FACTOR * pop;
  };
  return CFG;
}

function getPlanetRadius(player, CFG) {
  const baseInfluence = CFG.INFLUENCE_BASE_R || 80;
  const current = player && player.influenceR ? player.influenceR : baseInfluence;
  const scale = Math.max(1, Math.min(2.5, current / Math.max(1, baseInfluence)));
  return 16 * scale;
}

function getCoreCollisionRadius(player, CFG) {
  return getPlanetRadius(player, CFG) + 20;
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

function cloneWaypoints(points) {
  return Array.isArray(points) ? points.map((pt) => ({ x: pt.x, y: pt.y })) : [];
}

function clonePoint(point) {
  if (!point) return null;
  return { x: point.x || 0, y: point.y || 0 };
}

function getSenderPid(state, action) {
  if (!action) return null;
  if (action._senderPlayerId != null) return action._senderPlayerId | 0;
  if (action._senderSlot != null && state._slotToPid) {
    const pid = state._slotToPid[action._senderSlot];
    return pid != null ? pid : ((action._senderSlot | 0) + 1);
  }
  return null;
}

function getLevelBonusMul(player) {
  return player && player._levelBonusMul != null ? player._levelBonusMul : 1;
}

function getUnitBaseSpeed(unit) {
  return unit.baseSpeed || unit.speed || 9;
}

function getUnitHitRadius(unit) {
  const type = UNIT_TYPES[unit.unitType] || UNIT_TYPES.fighter || { sizeMultiplier: 1 };
  const size = type.sizeMultiplier * 6 + 6;
  const mul = UNIT_BOUNDING_MUL[unit.unitType] ?? UNIT_BOUNDING_MUL.fighter;
  return size * mul;
}

function lineFormationOffsets(n, rows, dirX, dirY, sizeMul, hitSpacing, CFG) {
  const sm = sizeMul || 1;
  const hs = hitSpacing || 32;
  const sx = Math.max((CFG.FORM_SPACING_X || 18) * sm, hs);
  const sy = Math.max((CFG.FORM_SPACING_Y || 22) * sm, hs);
  const cols = Math.ceil(n / Math.max(1, rows));
  const out = [];
  let idx = 0;
  const angle = Math.atan2(dirY || 0, dirX || 1) + Math.PI / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let r = 0; r < rows && idx < n; r++) {
    for (let c = 0; c < cols && idx < n; c++) {
      const x = (c - (cols - 1) / 2) * sx;
      const y = r * sy;
      out.push({ x: x * cos - y * sin, y: x * sin + y * cos });
      idx++;
    }
  }
  return out;
}

function pigFormationOffsets(n, dirX, dirY, depth, widthMul, sizeMul, hitSpacing, CFG) {
  const depthRows = Math.max(1, depth || 3);
  const wMul = Math.max(0.5, Math.min(2, widthMul || 1));
  const sm = sizeMul || 1;
  const hs = hitSpacing || 32;
  const sx = Math.max((CFG.FORM_SPACING_X || 18) * wMul * sm, hs * wMul);
  const sy = Math.max((CFG.FORM_SPACING_Y || 22) * sm, hs);
  const out = [];
  const angle = Math.atan2(dirY || 0, dirX || 1) + Math.PI / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let placed = 0;
  let row = 0;
  while (placed < n) {
    const inRow = Math.min(Math.max(1, Math.min(depthRows, row + 1)), n - placed);
    for (let c = 0; c < inRow && placed < n; c++) {
      const x = (c - (inRow - 1) / 2) * sx;
      const y = row * sy * 1.85;
      out.push({ x: x * cos - y * sin, y: x * sin + y * cos });
      placed++;
    }
    row++;
  }
  return out;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 1e-6) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const qx = ax + dx * t;
  const qy = ay + dy * t;
  return Math.hypot(px - qx, py - qy);
}

function getMeteorSpeed(CFG) {
  return Math.hypot(CFG.WORLD_W, CFG.WORLD_H) / 11;
}

function getMeteorVisualScale(aoeRadius) {
  return Math.max(1, (aoeRadius || METEOR_AOE_RADIUS) / Math.max(1, METEOR_AOE_RADIUS));
}

function createAuthoritativeMatchRuntime(options) {
  const opts = options || {};
  const io = opts.io;
  const roomId = opts.roomId;
  const seed = Number.isFinite(opts.seed) ? opts.seed : (Date.now() >>> 0);
  const enableLaneFighterWaves = opts.enableLaneFighterWaves !== false;
  const rawSlots = Array.isArray(opts.slots) ? opts.slots : [];
  const CFG = applyBalanceToConfig(createSharedGameConfig());
  const state = {};
  SharedSimState.applyBaseState(state, CFG);
  state._authorityMode = "server";
  state._multiIsHost = true;
  state._runsAuthoritativeSim = true;
  state._multiSlots = rawSlots;
  state._blackHoles = [];
  state._abilityStorms = [];
  state._abilityZoneEffects = [];
  state._activeMeteors = [];
  state._orbitalStrikes = [];
  state._thermoNukes = [];
  state._economyAbilityFx = [];
  state._fleetBoostUntil = {};
  state._battleMarchUntil = {};
  state._abilityCooldownsByPlayer = {};
  state._abilityUsedByPlayer = {};
  state._loanDebts = [];
  state._nextAbilityMineId = 1;
  state.sectorObjectives = [];
  let nextMineId = 1;

  SQUADLOGIC.loadConfig(balance);

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
    getActiveGrowthBonusPerMin: (player) => getActiveGrowthBonusPerMin(player),
    getMapSeed: () => seed
  });

  const bootstrapApi = SharedMatchBootstrap.install({
    CFG,
    clamp: UTILS.clamp,
    computeInfluencePolygon: citySimApi.computeInfluencePolygon,
    colorForId,
    nameForId: (id) => "Player#" + id,
    cardSystemApi: CardSystem
  });

  const serializer = new NET.SnapshotSerializer();
  const filledSlots = normalizeFilledSlots(rawSlots);
  const slotToPid = {};
  for (let i = 0; i < filledSlots.length; i++) {
    const sourceIndex = rawSlots.indexOf(filledSlots[i]);
    slotToPid[sourceIndex] = sourceIndex + 1;
  }
  state._slotToPid = slotToPid;

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
  const mineEntries = [];
  for (let i = 0; i < filledSlots.length; i++) {
    const slot = filledSlots[i];
    const slotIndex = rawSlots.indexOf(slot);
    const pid = slotToPid[slotIndex];
    const spawnIndex = activeSpawnIndices[i] ?? i;
    const pos = allSpawns[spawnIndex] || allSpawns[0];
    mineEntries.push({ pos, ownerId: pid, virtualId: spawnIndex + 1 });
  }
  if (filledSlots.length === 2) {
    for (let i = 0; i < allSpawns.length; i++) {
      if (!activeSpawnIndices.includes(i)) {
        mineEntries.push({ pos: allSpawns[i], ownerId: null, virtualId: -(i + 1), sectorObjectiveId: "sector:" + i });
      }
    }
  }
  placeMines(mineEntries);
  placeNebulae();
  for (const player of state.players.values()) rebuildTurrets(player);
  FrontPlanner.buildCenterObjectives(state);
  citySimApi.rebuildZoneGrid();

  let tickTimer = null;
  const queuedActions = [];

  const botPids = [];
  for (let i = 0; i < filledSlots.length; i++) {
    const slot = filledSlots[i];
    if (slot.isBot) {
      const slotIndex = rawSlots.indexOf(slot);
      const pid = slotToPid[slotIndex];
      if (pid != null) botPids.push(pid);
    }
  }
  const botState = {};
  for (const pid of botPids) {
    botState[pid] = { nextPurchaseAt: gs(3 + Math.random() * 2), nextAbilityAt: gs(25 + Math.random() * 10), purchaseInterval: 4 };
  }

  function stepBotAI(dt) {
    if (botPids.length === 0) return;
    for (const pid of botPids) {
      const player = state.players.get(pid);
      if (!player || player.eliminated) continue;
      const bs = botState[pid];
      if (!bs) continue;

      if (state.t >= bs.nextPurchaseAt) {
        const destroyerType = UNIT_TYPES.destroyer;
        const cruiserType = UNIT_TYPES.cruiser;
        const battleshipType = UNIT_TYPES.battleship;
        const credits = player.eCredits || 0;
        let unitType = "destroyer";
        if (battleshipType && credits >= (battleshipType.cost || 9999) * 3 && Math.random() < 0.15) unitType = "battleship";
        else if (cruiserType && credits >= (cruiserType.cost || 9999) * 3 && Math.random() < 0.35) unitType = "cruiser";
        const type = UNIT_TYPES[unitType];
        const costPer = type ? (type.cost || 0) : 999999;
        const unitCostMul = player.unitCostMul != null ? player.unitCostMul : 1;
        const totalCost = Math.max(1, Math.round(costPer * unitCostMul)) * 3;
        if (credits >= totalCost) {
          purchaseFrontTriplet(pid, unitType);
        }
        const interval = Math.max(2, bs.purchaseInterval - (player.level || 0) * 0.08);
        bs.nextPurchaseAt = state.t + gs(interval) + Math.random() * gs(1.5);
      }

      if (state.t >= bs.nextAbilityAt) {
        if (isAbilityAvailable(pid, "resourceSurge")) {
          executeAbilityAction({ pid, abilityId: "resourceSurge" });
        } else if (isAbilityAvailable(pid, "fleetBoost")) {
          executeAbilityAction({ pid, abilityId: "fleetBoost" });
        } else if (isAbilityAvailable(pid, "activeShield")) {
          executeAbilityAction({ pid, abilityId: "activeShield" });
        }
        bs.nextAbilityAt = state.t + gs(20) + Math.random() * gs(15);
      }
    }
  }

  function getAbilityDef(abilityId) {
    return CardSystem.getAbilityDef(abilityId) || null;
  }

  function getUnitAtkRange(unit) {
    const owner = unit ? state.players.get(unit.owner) : null;
    const mul = (owner && owner.unitAtkRangeMul != null ? owner.unitAtkRangeMul : 1) * getLevelBonusMul(owner);
    return (unit.attackRange || unit.baseAttackRange || 60) * mul;
  }

  function getUnitEngagementRange(unit) {
    return getUnitAtkRange(unit) * 1.15;
  }

  function getPlayerUnitSpeedMul(player) {
    return (player && player.unitSpeedMul != null ? player.unitSpeedMul : 1) * getLevelBonusMul(player);
  }

  function getPlayerDamageMul(player) {
    return (player && player.unitDmgMul != null ? player.unitDmgMul : 1) * getLevelBonusMul(player);
  }

  function getPlayerAttackRateMul(player) {
    return (player && player.unitAtkRateMul != null ? player.unitAtkRateMul : 1) * getLevelBonusMul(player);
  }

  function getCombatHelpers() {
    return {
      getUnitAtkRange,
      getUnitEngagementRange,
      getUnitBaseSpeed,
      getUnitHitRadius,
      shieldRadius: (player) => shieldRadius(player, CFG),
      getPlanetRadius: (player) => getPlanetRadius(player, CFG),
      getCoreCollisionRadius: (player) => getCoreCollisionRadius(player, CFG)
    };
  }

  function getFormationOffsets(n, formationType, formationRows, dirX, dirY, formationPigWidth, squad) {
    let sizeMul = 1;
    let maxHitR = 12;
    if (Array.isArray(squad) && squad.length > 0) {
      let maxSz = 0;
      for (const unit of squad) {
        const type = UNIT_TYPES[unit.unitType] || UNIT_TYPES.fighter || { sizeMultiplier: 1 };
        if (type.sizeMultiplier > maxSz) maxSz = type.sizeMultiplier;
        const hitR = getUnitHitRadius(unit);
        if (hitR > maxHitR) maxHitR = hitR;
      }
      sizeMul = Math.max(1, maxSz * 0.6 + 0.4);
    }
    const hitSpacing = maxHitR * 2 + 8;
    if (formationType === "line") {
      return lineFormationOffsets(n, Math.max(1, formationRows || 1), dirX || 1, dirY || 0, sizeMul, hitSpacing, CFG);
    }
    return pigFormationOffsets(n, dirX || 1, dirY || 0, formationRows || 3, formationPigWidth ?? 1, sizeMul, hitSpacing, CFG);
  }

  function getActiveGrowthBonusPerMin(player) {
    if (!player) return 0;
    if (Array.isArray(player._growthBonuses)) {
      player._growthBonuses = player._growthBonuses.filter((bonus) => bonus && bonus.expiresAt > state.t);
    }
    return (player._growthBonuses || []).reduce((sum, bonus) => sum + (bonus.amount || 0), 0);
  }

  function addTimedGrowthBonus(player, amountPerMin, durationSec) {
    if (!player || !amountPerMin || !durationSec) return;
    if (!Array.isArray(player._growthBonuses)) player._growthBonuses = [];
    player._growthBonuses.push({ amount: amountPerMin, expiresAt: state.t + gs(durationSec) });
  }

  function bumpCardStateVersion(player) {
    if (player) player.cardStateVersion = (player.cardStateVersion || 0) + 1;
  }

  function grantLevelCardDrops(player, sourceLabel) {
    if (!player || typeof CardSystem.drawRandomCardForPlayer !== "function") return 0;
    let drops = 0;
    for (let i = 0; i < 2; i++) {
      const result = CardSystem.drawRandomCardForPlayer(player, {
        now: state.t,
        level: player.level || 1,
        rng: Math.random,
        source: sourceLabel || "levelUp"
      });
      if (result && result.ok) drops++;
    }
    if (drops > 0) bumpCardStateVersion(player);
    return drops;
  }

  function gainXP(player, amount) {
    if (!player || !(amount > 0)) return;
    const prevLevel = player.level || 1;
    const gainMul = player.xpGainMul != null ? player.xpGainMul : 1;
    player.xp = (player.xp || 0) + amount * gainMul;
    while ((player.xp || 0) >= (player.xpNext || 1)) {
      player.xp -= player.xpNext;
      player.level = (player.level || 1) + 1;
      if (player.level % 5 === 0) player.rerollCount = (player.rerollCount || 0) + 1;
      player.pop = (player.pop || 0) + 10;
      player.popFloat = (player.popFloat || player.pop || 0) + 10;
      player._levelBonusMul = 1 + player.level * 0.01;
      player.xpNext = xpNeed(player.level, player, CFG);
      grantLevelCardDrops(player, "levelUp");
    }
    if ((player.level || 1) !== prevLevel) recomputeBuffDerivedStats(player);
    player.pendingCardPicks = 0;
  }

  function createMine(x, y, ownerId, isRich, resourceType, opts) {
    const options2 = opts || {};
    const mine = {
      id: nextMineId++,
      x,
      y,
      ownerId: ownerId || null,
      captureProgress: ownerId ? 1 : 0,
      capturingUnitId: null,
      isRich: !!isRich,
      resourceType: resourceType || "money",
      yieldAcc: 0,
      laneRole: options2.laneRole || null,
      pairKey: options2.pairKey || null,
      homeMine: !!options2.homeMine,
      instantLaneTrigger: options2.triggerTo ? { x: options2.triggerTo.x || 0, y: options2.triggerTo.y || 0 } : null,
      sectorObjectiveId: options2.sectorObjectiveId || null,
      _flowRate: 0,
      _flowTargetPlayerId: ownerId || null,
      _flowVisualTargetPlayerId: null,
      _flowInterceptUnitId: null,
      _flowInterceptSourceId: null,
      _flowInterceptX: null,
      _flowInterceptY: null,
      _flowInterceptT: null,
      _flowPhase: MINE_FLOW_PHASE_NONE,
      _flowPhaseStartedAt: state.t,
      _flowVersion: 0
    };
    state.mines.set(mine.id, mine);
    return mine;
  }

  function createSectorObjective(x, y, opts) {
    const options2 = opts || {};
    const objective = {
      id: options2.id || ("sector-objective-" + Math.round(x) + "-" + Math.round(y)),
      anchorId: options2.anchorId != null ? options2.anchorId : null,
      x,
      y,
      ownerId: options2.ownerId || null,
      linkedMineIds: Array.isArray(options2.linkedMineIds) ? options2.linkedMineIds.slice() : [],
      captureRadius: options2.captureRadius || Math.max((CFG.MINE_CAPTURE_RADIUS || 140) * 0.9, 120),
      visualRadius: options2.visualRadius || 54,
      _touchProtectedUntil: 0
    };
    if (!Array.isArray(state.sectorObjectives)) state.sectorObjectives = [];
    state.sectorObjectives.push(objective);
    return objective;
  }

  function setPirateBases(bases) {
    state.pirateBases = Array.isArray(bases) ? bases : [];
    state.pirateBase = state.pirateBases[0] || null;
  }

  function getPirateBases() {
    return Array.isArray(state.pirateBases) ? state.pirateBases : [];
  }

  function getAlivePirateBases() {
    return getPirateBases().filter((base) => base && (base.hp == null || base.hp > 0));
  }

  function refreshPirateBaseOrbitAnchors() {
    const centerMines = [...state.mines.values()].filter((mine) => mine && (mine.isRich || mine.ownerId !== PIRATE_OWNER_ID));
    if (!centerMines.length) return;
    for (const pirateBase of getPirateBases()) {
      if (!pirateBase) continue;
      let bestMine = null;
      let bestDist = Infinity;
      for (const mine of centerMines) {
        const dist = Math.hypot((pirateBase.x || 0) - (mine.x || 0), (pirateBase.y || 0) - (mine.y || 0));
        if (dist < bestDist) {
          bestDist = dist;
          bestMine = mine;
        }
      }
      if (!bestMine) continue;
      pirateBase.orbitCenter = { x: bestMine.x || 0, y: bestMine.y || 0 };
      pirateBase.orbitRadius = Math.max(160, Math.min(330, bestDist * 1.34));
    }
  }

  function placeNebulae() {
    state.nebulae = [];
  }

  function placeMines(entries) {
    state.mines.clear();
    state.sectorObjectives = [];
    nextMineId = 1;
    const centerX = CFG.WORLD_W * 0.5;
    const centerY = CFG.WORLD_H * 0.5;
    const centerMine = createMine(centerX, centerY, null, true);
    setPirateBases([{
      id: "pirate-base-center",
      x: centerX,
      y: centerY,
      hp: 4000,
      maxHp: 4000,
      lastDamagedBy: null,
      spawnCd: 0,
      unitLimit: 12,
      atkCd: 0,
      attackRange: 520,
      orbitCenter: { x: centerX, y: centerY },
      orbitRadius: 150,
      patrolAngleDeg: 0,
      _respawnTimer: 0,
      _initialSpawned: false
    }]);
    centerMine.ownerId = null;
    centerMine.captureProgress = 0;
    centerMine._captureProtectedUntil = Number.POSITIVE_INFINITY;
    centerMine._pirateLocked = true;
    centerMine._richYieldMultiplier = 3;

    const inflR = CFG.INFLUENCE_R(CFG.POP_START);
    const laneEntries = (Array.isArray(entries) ? entries : []).map((entry) => ({
      id: entry.ownerId != null ? entry.ownerId : (entry.virtualId != null ? entry.virtualId : null),
      x: entry.pos.x,
      y: entry.pos.y
    }));
    for (const entry of entries || []) {
      const spawn = entry.pos;
      const playerId = entry.ownerId;
      const linkedMineIds = [];
      const startCount = CFG.MINE_START_PER_PLAYER || 2;
      for (let index = 0; index < startCount; index++) {
        const baseAngle = Math.atan2(spawn.y - centerY, spawn.x - centerX);
        const spread = ((index - (startCount - 1) / 2) / Math.max(1, startCount - 1)) * 1.4;
        const angle = baseAngle + spread;
        const dist = inflR * 0.80;
        const resourceType = index < Math.ceil(startCount / 2) ? "money" : "xp";
        const mine = createMine(
          UTILS.clamp(spawn.x + Math.cos(angle) * dist, 40, CFG.WORLD_W - 40),
          UTILS.clamp(spawn.y + Math.sin(angle) * dist, 40, CFG.WORLD_H - 40),
          playerId,
          false,
          resourceType,
          {
            homeMine: playerId != null,
            sectorObjectiveId: playerId == null ? (entry.sectorObjectiveId || null) : null
          }
        );
        if (playerId == null) linkedMineIds.push(mine.id);
      }
      if (playerId == null && entry.sectorObjectiveId) {
        createSectorObjective(spawn.x, spawn.y, {
          id: entry.sectorObjectiveId,
          anchorId: entry.virtualId != null ? entry.virtualId : null,
          linkedMineIds,
          captureRadius: Math.max((CFG.MINE_CAPTURE_RADIUS || 140) * 0.92, 128)
        });
      }
    }
    const sideLaneMines = FrontPlanner.buildSideLaneMinePlacements
      ? FrontPlanner.buildSideLaneMinePlacements(laneEntries, { x: centerX, y: centerY })
      : [];
    for (const mine of sideLaneMines) {
      createMine(
        UTILS.clamp(mine.x, 48, CFG.WORLD_W - 48),
        UTILS.clamp(mine.y, 48, CFG.WORLD_H - 48),
        null,
        false,
        mine.resourceType || "money",
        mine
      );
    }
    refreshPirateBaseOrbitAnchors();
    FrontPlanner.buildCenterObjectives(state);
  }

  function clearMineFlowState(mine) {
    if (!mine) return;
    mine._flowRate = 0;
    mine._flowTargetPlayerId = mine.ownerId || null;
    mine._flowVisualTargetPlayerId = null;
    mine._flowInterceptUnitId = null;
    mine._flowInterceptSourceId = null;
    mine._flowInterceptX = null;
    mine._flowInterceptY = null;
    mine._flowInterceptT = null;
    mine._flowPhase = MINE_FLOW_PHASE_NONE;
    mine._flowPhaseStartedAt = state.t;
    mine._flowVersion = (mine._flowVersion || 0) + 1;
  }

  function setMineOwnerInstantly(mine, ownerId) {
    if (!mine) return false;
    const nextOwnerId = ownerId || null;
    if (mine.ownerId === nextOwnerId && mine.captureProgress >= 1) return false;
    mine.ownerId = nextOwnerId;
    mine.captureProgress = nextOwnerId ? 1 : 0;
    mine._capturingOwner = null;
    mine._captureProtectedUntil = state.t + MINE_LANE_TRIGGER_COOLDOWN_SEC;
    mine._instantLaneTriggerCooldownUntil = state.t + MINE_LANE_TRIGGER_COOLDOWN_SEC;
    clearMineFlowState(mine);
    return true;
  }

  function findLaneMineTriggerOwner(mine) {
    const trigger = mine && mine.instantLaneTrigger;
    if (!mine || !trigger) return null;
    if ((mine._instantLaneTriggerCooldownUntil || 0) > state.t) return null;
    let bestOwnerId = null;
    let bestDist = Infinity;
    for (const unit of state.units.values()) {
      if (!unit || unit.hp <= 0 || unit.owner === PIRATE_OWNER_ID) continue;
      if (unit.owner === mine.ownerId) continue;
      const owner = state.players.get(unit.owner);
      if (!owner || owner.pop <= 0 || owner.eliminated) continue;
      const touchR = Math.max((CFG.MINE_GEM_INTERCEPT_R || 30), getUnitHitRadius(unit) + 6);
      const dist = distToSegment(unit.x, unit.y, mine.x, mine.y, trigger.x, trigger.y);
      if (dist > touchR) continue;
      if (dist < bestDist) {
        bestDist = dist;
        bestOwnerId = unit.owner;
      }
    }
    return bestOwnerId;
  }

  function findSectorObjectiveTriggerOwner(objective) {
    if (!objective) return null;
    if ((objective._touchProtectedUntil || 0) > state.t) return null;
    let bestOwnerId = null;
    let bestDist = Infinity;
    const touchRadius = objective.captureRadius || Math.max((CFG.MINE_CAPTURE_RADIUS || 140) * 0.9, 120);
    for (const unit of state.units.values()) {
      if (!unit || unit.hp <= 0 || unit.owner === PIRATE_OWNER_ID) continue;
      const owner = state.players.get(unit.owner);
      if (!owner || owner.pop <= 0 || owner.eliminated) continue;
      const dist = Math.hypot((unit.x || 0) - (objective.x || 0), (unit.y || 0) - (objective.y || 0));
      if (dist > touchRadius) continue;
      if (dist < bestDist) {
        bestDist = dist;
        bestOwnerId = unit.owner;
      }
    }
    return bestOwnerId;
  }

  function setSectorObjectiveOwnerInstantly(objective, ownerId) {
    if (!objective) return false;
    const nextOwnerId = ownerId || null;
    if (objective.ownerId === nextOwnerId) return false;
    objective.ownerId = nextOwnerId;
    objective._touchProtectedUntil = state.t + gs(3.5);
    for (const mineId of objective.linkedMineIds || []) {
      const mine = state.mines.get(mineId);
      if (!mine) continue;
      setMineOwnerInstantly(mine, nextOwnerId);
    }
    return true;
  }

  function stepSectorObjectives() {
    for (const objective of state.sectorObjectives || []) {
      if (!objective) continue;
      if (objective.ownerId != null) {
        const owner = state.players.get(objective.ownerId);
        if (!owner || owner.pop <= 0 || owner.eliminated) {
          setSectorObjectiveOwnerInstantly(objective, null);
          continue;
        }
      }
      const triggerOwnerId = findSectorObjectiveTriggerOwner(objective);
      if (triggerOwnerId != null && triggerOwnerId !== objective.ownerId) {
        setSectorObjectiveOwnerInstantly(objective, triggerOwnerId);
      }
    }
  }

  function mineYieldMul(player) {
    return 1 + ((player && player.mineYieldBonus) || 0) / 100;
  }

  function getMineYieldPerSecond(mine, owner) {
    let rate = (CFG.MINE_YIELD_PER_SEC || 1) * mineYieldMul(owner);
    if (mine && mine.isRich) rate *= (mine._richYieldMultiplier || CFG.MINE_RICH_MULTIPLIER || 1);
    return rate;
  }

  function getMineEnergyPerSecond(mine, owner) {
    let rate = (CFG.MINE_ENERGY_PER_SEC || 0) * mineYieldMul(owner);
    if (mine && mine.isRich) rate *= (mine._richYieldMultiplier || CFG.MINE_RICH_MULTIPLIER || 1);
    return rate;
  }

  function stepMines(dt) {
    stepSectorObjectives();
    for (const mine of state.mines.values()) {
      const triggerOwnerId = findLaneMineTriggerOwner(mine);
      if (triggerOwnerId != null) setMineOwnerInstantly(mine, triggerOwnerId);
      const ownersInRadius = new Map();
      for (const unit of state.units.values()) {
        if (!unit || unit.hp <= 0 || unit.owner === PIRATE_OWNER_ID) continue;
        if (Math.hypot(unit.x - mine.x, unit.y - mine.y) <= (CFG.MINE_CAPTURE_RADIUS || 140)) {
          if (mine.ownerId && unit.owner === mine.ownerId) continue;
          ownersInRadius.set(unit.owner, (ownersInRadius.get(unit.owner) || 0) + 1);
        }
      }
      const ownerIds = [...ownersInRadius.keys()];
      const contested = ownerIds.length > 1;
      const unitInRadiusOwner = ownerIds.length === 1 ? ownerIds[0] : null;
      const unitInRadius = unitInRadiusOwner != null;
      const protectedCapture = (mine._captureProtectedUntil != null) && state.t < mine._captureProtectedUntil;
      mine._contested = contested;
      if (contested) mine._capturingOwner = null;
      if (!protectedCapture && !contested && unitInRadius && mine.ownerId !== unitInRadiusOwner) {
        if (mine.ownerId && mine.captureProgress >= 1) {
          mine.captureProgress = Math.max(0, mine.captureProgress - dt / (CFG.MINE_CAPTURE_TIME || 5));
          if (mine.captureProgress <= 0) {
            mine.ownerId = null;
            mine.captureProgress = 0;
            mine._capturingOwner = unitInRadiusOwner;
          }
        } else {
          mine._capturingOwner = unitInRadiusOwner;
          mine.captureProgress = Math.min(1, mine.captureProgress + dt / (CFG.MINE_CAPTURE_TIME || 5));
          if (mine.captureProgress >= 1) {
            mine.ownerId = unitInRadiusOwner;
            mine.captureProgress = 1;
            mine._capturingOwner = null;
            mine._captureProtectedUntil = state.t + gs(CFG.MINE_CAPTURE_PROTECTION || 5);
          }
        }
      } else if (!protectedCapture && !contested && !unitInRadius && !mine.ownerId && mine.captureProgress > 0) {
        mine.captureProgress = Math.max(0, mine.captureProgress - dt / Math.max(1, (CFG.MINE_CAPTURE_TIME || 5) * 2));
        if (mine.captureProgress <= 0) mine._capturingOwner = null;
      }

      if (mine.ownerId && mine.captureProgress >= 1) {
        const owner = state.players.get(mine.ownerId);
        if (!owner || owner.pop <= 0 || owner.eliminated) {
          mine.ownerId = null;
          mine.captureProgress = 0;
          clearMineFlowState(mine);
          continue;
        }
        mine._flowRate = getMineYieldPerSecond(mine, owner);
        mine._flowTargetPlayerId = mine.ownerId;
        mine._flowVisualTargetPlayerId = null;
        const gain = (mine._flowRate || 0) * dt;
        const energyGain = getMineEnergyPerSecond(mine, owner) * dt;
        if (gain > 0 || energyGain > 0) {
          const xpGain = gain * (CFG.MINE_XP_YIELD_MUL || 1);
          if (mine.isRich) {
            owner.eCredits = (owner.eCredits || 0) + gain;
            gainXP(owner, xpGain);
          } else if ((mine.resourceType || "money") === "money") {
            owner.eCredits = (owner.eCredits || 0) + gain;
          } else {
            gainXP(owner, xpGain);
          }
          if (energyGain > 0) {
            owner.popFloat = (owner.popFloat || owner.pop || 0) + energyGain;
            owner.pop = Math.floor(owner.popFloat);
          }
        }
      } else {
        clearMineFlowState(mine);
      }
    }
  }

  function getTurretOrbitRadius(player) {
    const coreRadius = getCoreCollisionRadius(player, CFG);
    const planetRadius = getPlanetRadius(player, CFG);
    const base = coreRadius + Math.max(34, planetRadius * 1.72);
    const rangeMul = player && player.turretRangeMul != null ? player.turretRangeMul : 1;
    return base * (1 + Math.max(0, rangeMul - 1) * 0.65);
  }

  function getTurretOrbitState(player, orbitT) {
    const phase = ((((orbitT || 0) % 1) + 1) % 1) * Math.PI * 2 - Math.PI / 2;
    const orbitRadius = getTurretOrbitRadius(player);
    const nx = Math.cos(phase);
    const ny = Math.sin(phase);
    return {
      x: player.x + nx * orbitRadius,
      y: player.y + ny * orbitRadius,
      orbitRadius,
      nx,
      ny
    };
  }

  function getPatrolOrbitState(player, orbitT) {
    const phase = ((((orbitT || 0) % 1) + 1) % 1) * Math.PI * 2 - Math.PI / 2;
    const orbitRadius = getTurretOrbitRadius(player) + Math.max(22, getPlanetRadius(player, CFG) * 1.02);
    return {
      x: player.x + Math.cos(phase) * orbitRadius,
      y: player.y + Math.sin(phase) * orbitRadius,
      orbitRadius
    };
  }

  function rebuildTurrets(player) {
    if (!player) return;
    const turretCount = 6;
    player._fixedTurretCount = turretCount;
    const turretHpMul = (player.turretHpMul != null ? player.turretHpMul : 1) * getLevelBonusMul(player);
    const maxHp = Math.max(1, Math.round((player.pop || CFG.POP_START) * (CFG.TURRET_HP_RATIO ?? 0.1) * turretHpMul));
    const oldTurrets = [];
    for (const turretId of player.turretIds || []) {
      const turret = state.turrets.get(turretId);
      if (turret) oldTurrets.push(turret);
    }
    oldTurrets.sort((a, b) => (a.orbitSlot ?? 0) - (b.orbitSlot ?? 0));
    const newTurretIds = [];
    const reused = new Set();
    for (let index = 0; index < turretCount; index++) {
      const orbitT = index / turretCount;
      const orbit = getTurretOrbitState(player, orbitT + state.t * 0.012);
      let turret = oldTurrets.find((entry) => !reused.has(entry.id) && (entry.orbitSlot ?? -1) === index);
      if (!turret) turret = oldTurrets.find((entry) => !reused.has(entry.id));
      if (turret) {
        turret.x = orbit.x;
        turret.y = orbit.y;
        turret.nx = orbit.nx;
        turret.ny = orbit.ny;
        turret.orbitSlot = index;
        turret.orbitT = orbitT;
        if (!turret._diedAt) {
          turret.maxHp = maxHp;
          if (turret.hp > maxHp) turret.hp = maxHp;
        }
        reused.add(turret.id);
        newTurretIds.push(turret.id);
      } else {
        const turretId = state.nextTurretId++;
        state.turrets.set(turretId, {
          id: turretId,
          owner: player.id,
          x: orbit.x,
          y: orbit.y,
          nx: orbit.nx,
          ny: orbit.ny,
          orbitSlot: index,
          orbitT,
          hp: maxHp,
          maxHp,
          atkCd: 0
        });
        newTurretIds.push(turretId);
      }
    }
    for (const turret of oldTurrets) {
      if (!reused.has(turret.id) && !turret._diedAt) state.turrets.delete(turret.id);
    }
    player.turretIds = newTurretIds;
  }

  function syncTurretOrbit(turret, player) {
    if (!turret || !player) return;
    const orbitT = (turret.orbitT != null ? turret.orbitT : ((turret.orbitSlot || 0) / Math.max(1, player._fixedTurretCount || 6))) + state.t * 0.012;
    const orbit = getTurretOrbitState(player, orbitT);
    turret.x = orbit.x;
    turret.y = orbit.y;
    if (!turret._aimUntil || state.t > turret._aimUntil) {
      turret.nx = orbit.nx;
      turret.ny = orbit.ny;
    }
  }

  function stepTurrets(dt) {
    for (const turret of state.turrets.values()) {
      if (!turret || turret.hp <= 0) continue;
      const owner = state.players.get(turret.owner);
      if (!owner) continue;
      syncTurretOrbit(turret, owner);
      turret.atkCd = Math.max(0, (turret.atkCd || 0) - dt);
      if (turret.atkCd > 0) continue;
      const turretRangeMul = owner.turretRangeMul != null ? owner.turretRangeMul : 1;
      const range = (CFG.TURRET_ATTACK_RADIUS ?? 45) * turretRangeMul * 1.6;
      let best = null;
      let bestDist = Infinity;
      for (const unit of state.units.values()) {
        if (!unit || unit.hp <= 0 || unit.owner === turret.owner) continue;
        const dist = (unit.x - turret.x) ** 2 + (unit.y - turret.y) ** 2;
        if (dist <= range * range && dist < bestDist) {
          bestDist = dist;
          best = { target: unit, targetType: "unit" };
        }
      }
      for (const otherTurret of state.turrets.values()) {
        if (!otherTurret || otherTurret.hp <= 0 || otherTurret.owner === turret.owner) continue;
        const dist = (otherTurret.x - turret.x) ** 2 + (otherTurret.y - turret.y) ** 2;
        if (dist <= range * range && dist < bestDist) {
          bestDist = dist;
          best = { target: otherTurret, targetType: "turret" };
        }
      }
      if (!best) continue;
      const turretDmgMul = (owner.turretDmgMul != null ? owner.turretDmgMul : 1) * getLevelBonusMul(owner);
      const damage = Math.max(1, Math.round((CFG.TURRET_ATTACK_DMG ?? 3) * turretDmgMul));
      const dx = best.target.x - turret.x;
      const dy = best.target.y - turret.y;
      const dist = Math.hypot(dx, dy) || 1;
      turret.nx = dx / dist;
      turret.ny = dy / dist;
      turret._aimUntil = state.t + gs(0.18);
      turret.atkCd = 1 / (CFG.TURRET_ATTACK_RATE ?? 1.2);
      state.bullets.push({
        type: "laser",
        fromX: turret.x,
        fromY: turret.y,
        toX: best.target.x,
        toY: best.target.y,
        ownerId: turret.owner,
        dmg: damage,
        duration: gs(0.38),
        progress: 0,
        targetId: best.target.id,
        targetType: best.targetType,
        sourceUnitId: null
      });
    }
    for (const turret of state.turrets.values()) {
      if (turret.hp <= 0 && turret._diedAt && state.t - turret._diedAt >= 60) {
        const owner = state.players.get(turret.owner);
        if (owner && owner.pop > 0) {
          const turretHpMul = (owner.turretHpMul != null ? owner.turretHpMul : 1) * getLevelBonusMul(owner);
          turret.maxHp = Math.max(1, Math.round(owner.pop * (CFG.TURRET_HP_RATIO ?? 0.1) * turretHpMul));
          turret.hp = turret.maxHp;
          turret._diedAt = null;
        }
      }
    }
  }

  function stepPatrols(dt) {
    for (const player of state.players.values()) {
      if (!player || player.eliminated || (player._patrolCount || 0) === 0) continue;
      player._patrols = player._patrols || [];
      while (player._patrols.length < (player._patrolCount || 0)) player._patrols.push({ t: 0, atkCd: 0 });
      const rangeMul = player.turretRangeMul != null ? player.turretRangeMul : 1;
      const range = PATROL_ATTACK_R * rangeMul;
      const dmgMul = (player.turretDmgMul != null ? player.turretDmgMul : 1) * getLevelBonusMul(player);
      const damage = Math.max(1, Math.round(PATROL_DMG * dmgMul));
      const shotCount = PATROL_BASE_SHOTS + (player.turretTargetBonus || 0);
      for (const patrol of player._patrols) {
        patrol.t = ((patrol.t || 0) + dt * PATROL_LIGHT_SPEED) % 1;
        const pos = getPatrolOrbitState(player, patrol.t || 0);
        patrol.atkCd = (patrol.atkCd || 0) - dt;
        if (patrol.atkCd > 0) continue;
        const enemies = [];
        for (const unit of state.units.values()) {
          if (!unit || unit.hp <= 0 || unit.owner === player.id) continue;
          if ((unit.x - pos.x) ** 2 + (unit.y - pos.y) ** 2 <= range * range) enemies.push(unit);
        }
        if (!enemies.length) continue;
        enemies.sort((a, b) => ((a.x - pos.x) ** 2 + (a.y - pos.y) ** 2) - ((b.x - pos.x) ** 2 + (b.y - pos.y) ** 2));
        patrol.atkCd = 1 / PATROL_ATTACK_RATE;
        for (let shot = 0; shot < Math.max(1, shotCount); shot++) {
          const target = enemies[shot % enemies.length];
          if (!target) continue;
          state.bullets.push({
            type: "laser",
            fromX: pos.x,
            fromY: pos.y,
            toX: target.x,
            toY: target.y,
            ownerId: player.id,
            dmg: damage,
            duration: gs(0.38),
            progress: 0,
            targetId: target.id,
            targetType: "unit",
            sourceUnitId: null
          });
        }
      }
    }
  }

  function handlePirateBaseDestroyed(pirateBase) {
    if (!pirateBase) return;
    const killerId = pirateBase.lastDamagedBy;
    const killer = killerId != null ? state.players.get(killerId) : null;
    if (killer) {
      for (let level = 0; level < 3; level++) {
        killer.level = (killer.level || 1) + 1;
        killer._levelBonusMul = 1 + (killer.level || 1) * 0.01;
        killer.xpNext = xpNeed(killer.level, killer, CFG);
        grantLevelCardDrops(killer, "pirateBaseLevel");
      }
      killer.eCredits = (killer.eCredits || 0) + 2000;
      killer.popFloat = (killer.popFloat || killer.pop || 0) + 150;
      killer.pop = Math.floor(killer.popFloat);
    }
    for (const mine of state.mines.values()) {
      if (!mine.isRich) continue;
      mine.ownerId = null;
      mine.captureProgress = 0;
      mine._capturingOwner = null;
      mine._captureProtectedUntil = 0;
      mine._pirateLocked = false;
      mine._richYieldMultiplier = 3;
      break;
    }
    const remaining = getPirateBases().filter((entry) => entry && entry.id !== pirateBase.id);
    setPirateBases(remaining);
    FrontPlanner.buildCenterObjectives(state);
  }

  function getAutoFrontSpecs(ownerId) {
    if (FrontPlanner && typeof FrontPlanner.getSpawnFrontSpecs === "function") {
      const specs = FrontPlanner.getSpawnFrontSpecs(state, ownerId);
      if (Array.isArray(specs) && specs.length > 0) return specs;
    }
    const me = state.players.get(ownerId);
    if (!me) return [];
    let enemy = null;
    let bestDist = Infinity;
    for (const other of state.players.values()) {
      if (!other || other.id === ownerId || other.eliminated) continue;
      const dist = Math.hypot(other.x - me.x, other.y - me.y);
      if (dist < bestDist) {
        bestDist = dist;
        enemy = other;
      }
    }
    const center = {
      x: state.centerObjectives?.centerX || me.x,
      y: state.centerObjectives?.centerY || me.y
    };
    const targetX = enemy ? enemy.x : center.x;
    const targetY = enemy ? enemy.y : center.y;
    const [vx, vy] = UTILS.norm(targetX - me.x, targetY - me.y);
    const px = -vy;
    const py = vx;
    const laneLead = Math.min(900, Math.max(320, bestDist * 0.45 || 520));
    const laneOffset = 220;
    return [
      { frontType: "left", sourceTag: "front:left", waypoints: [{ x: me.x + vx * laneLead + px * laneOffset, y: me.y + vy * laneLead + py * laneOffset }] },
      { frontType: "center", sourceTag: "front:center", waypoints: [{ x: me.x + vx * laneLead, y: me.y + vy * laneLead }] },
      { frontType: "right", sourceTag: "front:right", waypoints: [{ x: me.x + vx * laneLead - px * laneOffset, y: me.y + vy * laneLead - py * laneOffset }] }
    ];
  }

  function ensureCooldownBucket(pid) {
    if (!state._abilityCooldownsByPlayer[pid]) state._abilityCooldownsByPlayer[pid] = {};
    return state._abilityCooldownsByPlayer[pid];
  }

  function setAbilityCooldown(pid, abilityId, secondsOverride) {
    const def = getAbilityDef(abilityId);
    if (!def || def.oneTime) return;
    ensureCooldownBucket(pid)[abilityId] = secondsOverride != null ? secondsOverride : (def.cooldown || 0);
  }

  function markAbilityUsed(pid, abilityId) {
    const def = getAbilityDef(abilityId);
    if (!def || !def.oneTime) return;
    if (!Array.isArray(state._abilityUsedByPlayer[pid])) state._abilityUsedByPlayer[pid] = [];
    if (!state._abilityUsedByPlayer[pid].includes(abilityId)) state._abilityUsedByPlayer[pid].push(abilityId);
  }

  function isAbilityAvailable(pid, abilityId) {
    const def = getAbilityDef(abilityId);
    if (!def) return false;
    if (def.oneTime) {
      return !((state._abilityUsedByPlayer[pid] || []).includes(abilityId));
    }
    const cooldowns = state._abilityCooldownsByPlayer[pid] || {};
    return !(cooldowns[abilityId] > 0);
  }

  function getShipBuildQueue(ownerId) {
    let queue = state._shipBuildQueues.get(ownerId);
    if (!queue) {
      queue = { entries: [], lastQueuedAt: state.t || 0 };
      state._shipBuildQueues.set(ownerId, queue);
    }
    return queue;
  }

  function countPlayerUnits(ownerId, typeKey) {
    let count = 0;
    for (const unit of state.units.values()) {
      if (unit.owner === ownerId && unit.unitType === typeKey && unit.hp > 0) count++;
    }
    return count;
  }

  function countQueuedPlayerUnits(ownerId, typeKey) {
    const queue = state._shipBuildQueues.get(ownerId);
    if (!queue || !Array.isArray(queue.entries)) return 0;
    let count = 0;
    for (const entry of queue.entries) {
      if (!entry || entry.unitTypeKey !== typeKey) continue;
      count += entry.kind === "frontTriplet" ? 3 : 1;
    }
    return count;
  }

  function queueShipBuild(ownerId, entry) {
    const queue = getShipBuildQueue(ownerId);
    const now = state.t || 0;
    const executeAt = Math.max(now, queue.lastQueuedAt || now) + gs(1.0);
    const queued = { ...entry, ownerId, executeAt };
    queue.entries.push(queued);
    queue.lastQueuedAt = executeAt;
    return queued;
  }

  function getUnitPurchaseQuote(ownerId, unitTypeKey, purchaseCount, bundleUnits) {
    const player = state.players.get(ownerId);
    const type = UNIT_TYPES[unitTypeKey];
    if (!player) return { ok: false, reason: "no_player" };
    if (!type || (!CORE_ROSTER_UNIT_TYPES.has(unitTypeKey) && unitTypeKey !== "fighter")) {
      return { ok: false, reason: "unknown_type" };
    }
    const cap = UNIT_CAPS[unitTypeKey] ?? 300;
    const current = countPlayerUnits(ownerId, unitTypeKey);
    const queued = countQueuedPlayerUnits(ownerId, unitTypeKey);
    const requestedUnits = Math.max(1, purchaseCount | 0) * Math.max(1, bundleUnits | 0);
    if (current + queued + requestedUnits > cap) return { ok: false, reason: "cap_reached" };
    const unitCostMul = player.unitCostMul != null ? player.unitCostMul : 1;
    const costPerPurchase = Math.max(1, Math.round((type.cost || 0) * unitCostMul));
    const totalCost = costPerPurchase * Math.max(1, purchaseCount | 0);
    if ((player.eCredits || 0) < totalCost) return { ok: false, reason: "no_credits" };
    return { ok: true, player, type, costPerPurchase, totalCost };
  }

  function seedFrontAssignment(ownerId, squadId, frontType) {
    if (squadId == null || !frontType) return;
    const graph = state.frontGraph && state.frontGraph[ownerId] ? state.frontGraph[ownerId] : null;
    const targetCoreId = frontType === "left"
      ? graph && graph.leftTargetCoreId
      : frontType === "right"
        ? graph && graph.rightTargetCoreId
        : (state.centerObjectives && state.centerObjectives.securedByPlayerId === ownerId
            ? (graph && Array.isArray(graph.enemyCoreIds) ? (graph.enemyCoreIds[0] || null) : null)
            : null);
    state.squadFrontAssignments = state.squadFrontAssignments || {};
    const existing = state.squadFrontAssignments[squadId] || {};
    const squad = state.squads && state.squads.get(squadId);
    if (squad) squad.frontType = frontType;
    state.squadFrontAssignments[squadId] = {
      squadId,
      ownerId,
      frontId: ownerId + ":" + frontType,
      frontType,
      role: frontType === "center" ? "center" : "pressure",
      originCoreId: ownerId,
      targetCoreId,
      assignedAt: state.t || 0,
      assignmentLockUntil: (state.t || 0) + 3,
      lastIssuedAt: existing.lastIssuedAt || 0,
      lastOrderSignature: existing.lastOrderSignature || ""
    };
  }

  function spawnPurchasedSquad(ownerId, unitTypeKey, waypoints, opts) {
    const player = state.players.get(ownerId);
    const type = UNIT_TYPES[unitTypeKey];
    if (!player || !type) return { ok: false, spawned: 0, squadId: null, unitIds: [] };
    const points = cloneWaypoints(waypoints);
    const firstTarget = points[0] || { x: player.x + 200, y: player.y };
    const dir = UTILS.norm(firstTarget.x - player.x, firstTarget.y - player.y);
    const spawnRadius = getPlanetRadius(player, CFG) * 1.2;
    const id = state.nextUnitId++;
    const ownerLevelMul = getLevelBonusMul(player);
    const unit = {
      id,
      owner: ownerId,
      color: player.color,
      unitType: unitTypeKey,
      x: player.x + dir[0] * spawnRadius,
      y: player.y + dir[1] * spawnRadius,
      vx: dir[0] * type.speed,
      vy: dir[1] * type.speed,
      hp: Math.round((type.hp || 0) * (player.unitHpMul != null ? player.unitHpMul : 1) * ownerLevelMul),
      maxHp: Math.round((type.hp || 0) * (player.unitHpMul != null ? player.unitHpMul : 1) * ownerLevelMul),
      dmg: type.damage,
      atkCd: UTILS.rand(0, 1 / Math.max(0.01, (type.attackRate || 0.2) * getPlayerAttackRateMul(player))),
      attackRange: type.attackRange,
      maxTargets: type.maxTargets,
      speed: type.speed,
      baseMaxHp: type.hp,
      baseDamage: type.damage,
      baseAttackRate: type.attackRate,
      baseAttackRange: type.attackRange,
      baseSpeed: type.speed,
      orbitTarget: !!type.orbitTarget,
      popPenalty: type.popPenaltyPerUnit,
      regenPerSec: 0,
      gfx: null,
      waypoints: points.length ? points : [{ x: firstTarget.x, y: firstTarget.y }],
      waypointIndex: 0,
      leaderId: null,
      formationOffsetX: 0,
      formationOffsetY: 0,
      formationType: "line",
      formationRows: 1,
      formationPigWidth: 1,
      spawnTime: state.t,
      _cryoSlowUntil: 0,
      _fireDotUntil: 0,
      _fireDotDps: 0,
      _lastFacingAngle: Math.atan2(dir[1], dir[0]),
      _formationAngle: Math.atan2(dir[1], dir[0])
    };
    if (opts && typeof opts.mutateUnit === "function") opts.mutateUnit(unit);
    state.units.set(id, unit);
    const squad = SQUADLOGIC.createSquad(state, [id], {
      leaderUnitId: id,
      formationType: "line",
      formationRows: 1,
      formationWidth: 1,
      sourceTag: opts && opts.sourceTag ? opts.sourceTag : "spawn",
      frontType: opts && opts.frontType ? opts.frontType : null,
      autoGroupUntil: state.t + gs(3),
      allowAutoJoinRecentSpawn: !!(opts && opts.allowAutoJoinRecentSpawn),
      order: { type: "move", waypoints: cloneWaypoints(unit.waypoints), holdPoint: null }
    });
    if (squad && opts && opts.frontType) seedFrontAssignment(ownerId, squad.id, opts.frontType);
    return { ok: true, spawned: 1, squadId: squad ? squad.id : null, leaderId: id, unitIds: [id] };
  }

  function spawnLaneAbilityUnits(ownerId, frontType, unitTypeKey, count, options) {
    const frontSpecs = getAutoFrontSpecs(ownerId);
    const spec = frontSpecs.find((entry) => entry.frontType === (frontType || "center")) || frontSpecs[1] || frontSpecs[0];
    if (!spec || !spec.waypoints || !spec.waypoints[0]) return { ok: false, reason: "no_front" };
    const player = state.players.get(ownerId);
    if (!player) return { ok: false, reason: "no_player" };
    const point = spec.waypoints[0];
    const [vx, vy] = UTILS.norm(point.x - player.x, point.y - player.y);
    const nx = -vy;
    const ny = vx;
    const spread = options && options.spread != null ? options.spread : 20;
    const forwardStep = options && options.forwardStep != null ? options.forwardStep : 0;
    const unitIds = [];
    const squadIds = [];
    for (let i = 0; i < Math.max(1, count | 0); i++) {
      const offset = count <= 1 ? 0 : (i - (count - 1) / 2) * spread;
      const spawnPoint = {
        x: point.x + nx * offset + vx * forwardStep * i,
        y: point.y + ny * offset + vy * forwardStep * i
      };
      const out = spawnPurchasedSquad(ownerId, unitTypeKey, [spawnPoint], {
        ...(options || {}),
        frontType: spec.frontType
      });
      if (out.ok) {
        unitIds.push(...(out.unitIds || []));
        if (out.squadId != null) squadIds.push(out.squadId);
      }
    }
    return { ok: unitIds.length > 0, unitIds, squadIds, frontType: spec.frontType };
  }

  function completeQueuedPurchaseUnit(ownerId, unitTypeKey, waypoints, opts) {
    return spawnPurchasedSquad(ownerId, unitTypeKey, waypoints, opts);
  }

  function completeQueuedFrontTriplet(ownerId, unitTypeKey) {
    const frontSpecs = getAutoFrontSpecs(ownerId);
    if (!frontSpecs.length) return { ok: false, reason: "no_fronts" };
    const spawned = [];
    for (const spec of frontSpecs) {
      const result = spawnPurchasedSquad(ownerId, unitTypeKey, spec.waypoints, {
        sourceTag: spec.sourceTag,
        frontType: spec.frontType,
        allowAutoJoinRecentSpawn: true
      });
      if (result.ok) spawned.push(result);
    }
    return {
      ok: true,
      spawned: spawned.length,
      squadIds: spawned.map((entry) => entry.squadId).filter((id) => id != null)
    };
  }

  function purchaseUnit(ownerId, unitTypeKey, waypoints, opts) {
    const quote = getUnitPurchaseQuote(ownerId, unitTypeKey, 1, 1);
    if (!quote.ok) return quote;
    quote.player.eCredits -= quote.costPerPurchase;
    const queued = queueShipBuild(ownerId, {
      kind: "single",
      unitTypeKey,
      refundCost: quote.costPerPurchase,
      waypoints: cloneWaypoints(waypoints),
      opts: opts || null
    });
    return { ok: true, queued: true, eta: Math.max(0, queued.executeAt - (state.t || 0)) };
  }

  function purchaseFrontTriplet(ownerId, unitTypeKey) {
    const quote = getUnitPurchaseQuote(ownerId, unitTypeKey, 1, 3);
    if (!quote.ok) return quote;
    quote.player.eCredits -= quote.totalCost;
    const queued = queueShipBuild(ownerId, {
      kind: "frontTriplet",
      unitTypeKey,
      refundCost: quote.totalCost
    });
    return { ok: true, queued: true, eta: Math.max(0, queued.executeAt - (state.t || 0)) };
  }

  function processShipBuildQueues() {
    const now = state.t || 0;
    for (const [ownerId, queue] of state._shipBuildQueues.entries()) {
      if (!queue || !Array.isArray(queue.entries) || queue.entries.length === 0) continue;
      while (queue.entries.length > 0 && (queue.entries[0].executeAt || 0) <= now) {
        const entry = queue.entries.shift();
        let result = null;
        if (entry.kind === "frontTriplet") result = completeQueuedFrontTriplet(ownerId, entry.unitTypeKey);
        else result = completeQueuedPurchaseUnit(ownerId, entry.unitTypeKey, entry.waypoints, entry.opts || null);
        if (!result || result.ok === false) {
          const player = state.players.get(ownerId);
          if (player && entry.refundCost) player.eCredits = (player.eCredits || 0) + entry.refundCost;
        }
      }
      if (queue.entries.length === 0) queue.lastQueuedAt = now;
    }
  }

  function applyUnitDamage(target, damage, attackerUnitId, attackerOwnerId) {
    if (!target || target.hp <= 0 || damage <= 0) return;
    let remaining = damage;
    if (target._activeShieldHp && target._activeShieldHp > 0) {
      const absorbed = Math.min(target._activeShieldHp, remaining);
      target._activeShieldHp -= absorbed;
      if (target._activeShieldHp <= 0) target._activeShieldHp = null;
      remaining -= absorbed;
    }
    if (remaining > 0) {
      target.hp = Math.max(0, target.hp - remaining);
      if (attackerUnitId != null) SQUADLOGIC.recordDamageSource(target, attackerUnitId, state);
      if (attackerOwnerId != null) target.lastDamagedBy = attackerOwnerId;
    }
  }

  function applyCityDamage(city, damage, attackerOwnerId) {
    if (!city || city.eliminated || damage <= 0) return;
    let remaining = damage;
    if ((city.shieldHp || 0) > 0) {
      const absorbed = Math.min(city.shieldHp, remaining);
      city.shieldHp = Math.max(0, city.shieldHp - absorbed);
      city.shieldRegenCd = Math.max(city.shieldRegenCd || 0, 6);
      remaining -= absorbed;
    }
    if (remaining > 0) {
      city.popFloat = Math.max(0, (city.popFloat || city.pop || 0) - remaining);
      city.pop = Math.max(0, Math.floor(city.popFloat));
      if (city.pop <= 0) {
        city.eliminated = true;
        city.shieldHp = 0;
      }
    }
    if (attackerOwnerId != null) city.lastDamagedBy = attackerOwnerId;
  }

  function applyAreaDamage(centerX, centerY, radius, ownerId, damageFn) {
    const radiusSq = radius * radius;
    for (const unit of state.units.values()) {
      if (!unit || unit.hp <= 0 || unit.owner === ownerId) continue;
      const dx = unit.x - centerX;
      const dy = unit.y - centerY;
      if (dx * dx + dy * dy > radiusSq) continue;
      applyUnitDamage(unit, damageFn(unit), null, ownerId);
    }
    for (const player of state.players.values()) {
      if (!player || player.eliminated || player.id === ownerId) continue;
      const dx = player.x - centerX;
      const dy = player.y - centerY;
      if (dx * dx + dy * dy > radiusSq) continue;
      applyCityDamage(player, damageFn(player), ownerId);
    }
  }

  function stepPlayerState(dt) {
    for (const player of state.players.values()) {
      CardSystem.expireTimedBuffs(player, state.t);
      if ((player.shieldRegenCd || 0) > 0) {
        player.shieldRegenCd = Math.max(0, player.shieldRegenCd - dt);
      } else if ((player.shieldHp || 0) < (player.shieldMaxHp || 0)) {
        player.shieldHp = Math.min(player.shieldMaxHp, player.shieldHp + dt * 2.5);
      }
    }
  }

  function stepAbilityCooldowns(dt) {
    for (const pid of Object.keys(state._abilityCooldownsByPlayer)) {
      const cooldowns = state._abilityCooldownsByPlayer[pid];
      for (const key of Object.keys(cooldowns)) {
        cooldowns[key] = Math.max(0, cooldowns[key] - dt);
      }
    }
  }

  function stepLoanDebts() {
    if (!Array.isArray(state._loanDebts) || state._loanDebts.length === 0) return;
    for (let i = state._loanDebts.length - 1; i >= 0; i--) {
      const debt = state._loanDebts[i];
      if (!debt || debt.deductAt > state.t) continue;
      const player = state.players.get(debt.pid);
      if (player) player.eCredits = (player.eCredits || 0) - (debt.amount || 0);
      state._loanDebts.splice(i, 1);
    }
  }

  function stepEconomyAbilityFx() {
    if (!Array.isArray(state._economyAbilityFx) || state._economyAbilityFx.length === 0) return;
    for (let i = state._economyAbilityFx.length - 1; i >= 0; i--) {
      const fx = state._economyAbilityFx[i];
      if (!fx || state.t - fx.spawnedAt <= (fx.duration || 0)) continue;
      state._economyAbilityFx.splice(i, 1);
    }
  }

  function buildStormBlobs(radius) {
    const stretch = 0.8 + Math.random() * 0.6;
    const rotAngle = Math.random() * Math.PI * 2;
    const blobCount = 5;
    const blobs = [];
    for (let i = 0; i < blobCount; i++) {
      const t = (i / Math.max(1, blobCount - 1)) - 0.5;
      const blob = {
        ox: t * radius * stretch * 0.9 + UTILS.rand(-15, 15),
        oy: UTILS.rand(-radius * 0.25, radius * 0.25),
        r: radius * (0.45 + Math.random() * 0.25),
        _baseOx: 0,
        _baseOy: 0,
        _baseR: 0,
        _phase: i * 1.3
      };
      blob._baseOx = blob.ox;
      blob._baseOy = blob.oy;
      blob._baseR = blob.r;
      blobs.push(blob);
    }
    return { blobs, rotAngle, stretch };
  }

  function isUnitInsideStorm(unit, storm) {
    for (const blob of storm.blobs || []) {
      const bx = storm.x + blob.ox;
      const by = storm.y + blob.oy;
      const dx = unit.x - bx;
      const dy = unit.y - by;
      if (dx * dx + dy * dy <= blob.r * blob.r) return true;
    }
    return false;
  }

  function spawnIonStorm(ownerId, x, y, options) {
    const opts2 = options || {};
    const radius = Math.max(80, opts2.radius || 210);
    const built = buildStormBlobs(radius);
    state._abilityStorms.push({
      x,
      y,
      vx: 0,
      vy: 0,
      spawnedAt: state.t,
      duration: opts2.durationSec != null ? opts2.durationSec : ION_NEBULA_DURATION_SEC,
      lastDmgTick: state.t,
      lastDirChange: state.t,
      rotAngle: built.rotAngle,
      stretch: built.stretch,
      blobs: built.blobs,
      ownerId,
      tickDamagePct: opts2.tickDamagePct,
      finalBurstPct: opts2.finalBurstPct,
      _finalBurstDone: false
    });
  }

  function stepAbilityStorms() {
    for (let i = state._abilityStorms.length - 1; i >= 0; i--) {
      const storm = state._abilityStorms[i];
      const elapsed = state.t - storm.spawnedAt;
      if (elapsed > storm.duration) {
        if (!storm._finalBurstDone) {
          storm._finalBurstDone = true;
          const burstPct = storm.finalBurstPct != null ? storm.finalBurstPct : 0.02;
          for (const unit of state.units.values()) {
            if (!unit || unit.hp <= 0 || unit.owner === storm.ownerId) continue;
            if (!isUnitInsideStorm(unit, storm)) continue;
            const maxHp = Math.max(1, unit.maxHp || unit.hp || 1);
            applyUnitDamage(unit, Math.max(1, Math.floor(maxHp * burstPct)), null, storm.ownerId);
          }
        }
        state._abilityStorms.splice(i, 1);
        continue;
      }
      for (const blob of storm.blobs || []) {
        blob.ox = blob._baseOx + Math.sin(state.t * 0.3 + blob._phase) * 20;
        blob.oy = blob._baseOy + Math.cos(state.t * 0.25 + blob._phase * 0.7) * 15;
        blob.r = blob._baseR * (0.85 + 0.15 * Math.sin(state.t * 0.4 + blob._phase * 1.5));
      }
      if (state.t - storm.lastDmgTick < STORM_DMG_INTERVAL) continue;
      storm.lastDmgTick = state.t;
      const tickDamagePct = storm.tickDamagePct != null ? storm.tickDamagePct : 0.10;
      for (const unit of state.units.values()) {
        if (!unit || unit.hp <= 1 || unit.owner === storm.ownerId) continue;
        if (!isUnitInsideStorm(unit, storm)) continue;
        const damage = Math.max(1, Math.floor(unit.hp * tickDamagePct));
        unit.hp = Math.max(1, unit.hp - damage);
      }
    }
  }

  function buildAnchorEffect(ownerId, x, y, abilityId) {
    const isMicro = abilityId === "microAnchor";
    const defaults = isMicro
      ? { duration: gs(7), radius: 220, previewRadius: 220, pullBlend: 0.09 }
      : { duration: gs(20), radius: 420, previewRadius: 420, pullBlend: 0.065 };
    const built = GravAnchorAbility && typeof GravAnchorAbility.buildEffect === "function"
      ? GravAnchorAbility.buildEffect(x, y, ownerId, defaults)
      : {
          type: "anchor",
          x,
          y,
          ownerId,
          duration: defaults.duration,
          radius: defaults.radius,
          previewRadius: defaults.previewRadius,
          pullBlend: defaults.pullBlend
        };
    return {
      ...built,
      ownerId,
      spawnedAt: state.t
    };
  }

  function deployMinefield(abilityId, x, y, ownerId) {
    const large = abilityId === "minefieldLarge";
    const mineCount = large ? 25 : 5;
    const ringRadius = large ? 120 : 55;
    const triggerRadius = large ? 44 : 34;
    const blastRadius = large ? 110 : 85;
    const damageBase = large ? 180 : 110;
    const damageMaxHpPct = large ? 0.18 : 0.12;
    for (let i = 0; i < mineCount; i++) {
      const angle = (i / mineCount) * Math.PI * 2;
      const radial = i === 0 ? 0 : ringRadius * (0.5 + (i % 3) * 0.22);
      state._abilityZoneEffects.push({
        id: "mine:" + (state._nextAbilityMineId++),
        type: "minefieldMine",
        sourceAbilityId: abilityId,
        x: x + Math.cos(angle) * radial,
        y: y + Math.sin(angle) * radial,
        ownerId,
        spawnedAt: state.t,
        duration: gs(800),
        armedAt: state.t + gs(0.35),
        triggerRadius,
        blastRadius,
        damageBase,
        damageMaxHpPct,
        blinkSpeed: large ? 1.4 : 1.8
      });
    }
    return { ok: true, mineCount };
  }

  function spawnMinefieldBlast(mine) {
    state._abilityZoneEffects.push({
      id: "mineblast:" + mine.id,
      type: "minefieldBlast",
      x: mine.x,
      y: mine.y,
      ownerId: mine.ownerId,
      spawnedAt: state.t,
      duration: gs(0.55),
      radius: mine.blastRadius,
      blastRadius: mine.blastRadius,
      damageBase: mine.damageBase,
      damageMaxHpPct: mine.damageMaxHpPct,
      _damageApplied: false
    });
  }

  function stepAbilityZoneEffects(dt) {
    for (let i = state._abilityZoneEffects.length - 1; i >= 0; i--) {
      const zone = state._abilityZoneEffects[i];
      const elapsed = state.t - zone.spawnedAt;
      if (elapsed > (zone.duration || 0)) {
        state._abilityZoneEffects.splice(i, 1);
        continue;
      }

      if (zone.type === "minefieldMine") {
        if (state.t < (zone.armedAt || zone.spawnedAt || 0)) continue;
        let triggered = false;
        for (const unit of state.units.values()) {
          if (!unit || unit.hp <= 0 || unit.owner === zone.ownerId) continue;
          const dx = unit.x - zone.x;
          const dy = unit.y - zone.y;
          const radius = (zone.triggerRadius || 0) + 10;
          if (dx * dx + dy * dy <= radius * radius) {
            triggered = true;
            break;
          }
        }
        if (triggered) {
          spawnMinefieldBlast(zone);
          state._abilityZoneEffects.splice(i, 1);
        }
        continue;
      }

      if (zone.type === "minefieldBlast") {
        if (!zone._damageApplied) {
          zone._damageApplied = true;
          const blastRadius = zone.blastRadius || zone.radius || 80;
          applyAreaDamage(zone.x, zone.y, blastRadius, zone.ownerId, (target) => {
            const maxHp = Math.max(1, target.maxHp || target.hp || 1);
            return Math.max(1, (zone.damageBase || 100) + maxHp * (zone.damageMaxHpPct || 0.1));
          });
        }
        continue;
      }

      if (zone.type === "anchor") {
        for (const unit of state.units.values()) {
          if (!unit || unit.hp <= 0 || unit.owner === zone.ownerId) continue;
          const dx = unit.x - zone.x;
          const dy = unit.y - zone.y;
          const dist = Math.hypot(dx, dy);
          if (dist > (zone.radius || 0)) continue;
          const pullBlend = zone.pullBlend != null ? zone.pullBlend : 0.05;
          unit.x = unit.x * (1 - pullBlend) + zone.x * pullBlend;
          unit.y = unit.y * (1 - pullBlend) + zone.y * pullBlend;
          unit.vx = 0;
          unit.vy = 0;
          unit._anchorStasisUntil = state.t + gs(0.6);
          unit._cryoSlowUntil = state.t + gs(0.6);
          unit._cryoSlowAmount = 1;
          if (unit.squadId != null) {
            SQUADLOGIC.clearCombatForSquad(state, unit.squadId, true);
            const squad = state.squads.get(unit.squadId);
            if (squad) squad._zoneImmunityUntil = state.t + gs(0.6);
          }
        }
        continue;
      }

      if (zone.type === "nano") {
        for (const unit of state.units.values()) {
          if (!unit || unit.hp <= 0 || unit.owner === zone.ownerId) continue;
          const dx = unit.x - zone.x;
          const dy = unit.y - zone.y;
          if (dx * dx + dy * dy > (zone.radius || 0) * (zone.radius || 0)) continue;
          const maxHp = Math.max(1, unit.maxHp || unit.hp || 1);
          applyUnitDamage(unit, ((zone.dps || 5) + maxHp * (zone.maxHpPctPerSec || 0)) * dt, null, zone.ownerId);
        }
      }
    }
  }

  function spawnMeteor(targetX, targetY, angle, ownerId, options) {
    const opts2 = options || {};
    const cosA = Math.cos(angle || 0);
    const sinA = Math.sin(angle || 0);
    let tMin = Infinity;
    if (cosA > 0.001) {
      const t = targetX / cosA;
      if (t > 0 && t < tMin) tMin = t;
    }
    if (cosA < -0.001) {
      const t = (targetX - CFG.WORLD_W) / cosA;
      if (t > 0 && t < tMin) tMin = t;
    }
    if (sinA > 0.001) {
      const t = targetY / sinA;
      if (t > 0 && t < tMin) tMin = t;
    }
    if (sinA < -0.001) {
      const t = (targetY - CFG.WORLD_H) / sinA;
      if (t > 0 && t < tMin) tMin = t;
    }
    if (tMin === Infinity || tMin <= 0) tMin = Math.hypot(CFG.WORLD_W, CFG.WORLD_H);
    const speed = opts2.speed || getMeteorSpeed(CFG);
    const aoeRadius = opts2.aoeR || METEOR_PREVIEW_RADIUS;
    const startX = targetX - cosA * tMin;
    const startY = targetY - sinA * tMin;
    state._activeMeteors.push({
      x: startX,
      y: startY,
      targetX,
      targetY,
      vx: cosA * speed,
      vy: sinA * speed,
      angle: angle || 0,
      radius: opts2.radius || METEOR_RADIUS,
      aoeR: aoeRadius,
      ownerId,
      alive: true,
      spawnedAt: state.t,
      impactDuration: METEOR_IMPACT_DURATION,
      styleKey: opts2.styleKey || "signal-bloom",
      visualScale: opts2.visualScale || getMeteorVisualScale(aoeRadius),
      seed: opts2.seed != null ? opts2.seed : (((Math.round(targetX * 10) * 73856093) ^ (Math.round(targetY * 10) * 19349663)) >>> 0)
    });
  }

  function spawnMeteorSwarm(targetX, targetY, angle, ownerId) {
    const built = MeteorSwarmAbility && typeof MeteorSwarmAbility.buildCast === "function"
      ? MeteorSwarmAbility.buildCast(targetX, targetY, ownerId, {
          worldW: CFG.WORLD_W,
          worldH: CFG.WORLD_H,
          baseSpeed: getMeteorSwarmBaseSpeed(CFG),
          baseAngle: angle
        })
      : null;
    const shots = built && Array.isArray(built.shots) ? built.shots : null;
    if (!shots || shots.length === 0) {
      spawnMeteor(targetX, targetY, angle || 0, ownerId, { aoeR: METEOR_AOE_RADIUS, styleKey: "signal-bloom" });
      return;
    }
    for (const shot of shots) {
      state._activeMeteors.push({
        x: shot.x,
        y: shot.y,
        targetX: shot.aimX,
        targetY: shot.aimY,
        vx: shot.vx,
        vy: shot.vy,
        angle: shot.angle,
        radius: shot.radius,
        aoeR: shot.aoeR,
        ownerId,
        alive: true,
        spawnedAt: state.t,
        impactDuration: shot.impactDuration || 1.0,
        styleKey: shot.styleKey || "signal-bloom",
        visualScale: shot.visualScale || 1.0,
        seed: shot.seed
      });
    }
  }

  function detonateMeteor(meteor) {
    if (!meteor || !meteor.alive) return;
    meteor.alive = false;
    applyAreaDamage(meteor.targetX, meteor.targetY, meteor.aoeR || METEOR_AOE_RADIUS, meteor.ownerId, (target) => {
      const maxHp = Math.max(1, target.maxHp || target.hp || 1);
      return Math.max(1, Math.round(maxHp * 0.5 + 100));
    });
  }

  function stepMeteors(dt) {
    for (let i = state._activeMeteors.length - 1; i >= 0; i--) {
      const meteor = state._activeMeteors[i];
      if (!meteor || !meteor.alive) {
        state._activeMeteors.splice(i, 1);
        continue;
      }
      meteor.x += (meteor.vx || 0) * dt;
      meteor.y += (meteor.vy || 0) * dt;
      const dx = meteor.targetX - meteor.x;
      const dy = meteor.targetY - meteor.y;
      if (dx * dx + dy * dy <= Math.max(25, (meteor.radius || 0) * (meteor.radius || 0))) {
        detonateMeteor(meteor);
      }
      if (!meteor.alive) state._activeMeteors.splice(i, 1);
    }
  }

  function queueOrbitalStrike(zoneX, zoneY, ownerId, abilityId) {
    const cfg = getOrbitalStrikeConfig(abilityId);
    const seed = ((Math.round(zoneX * 10) * 73856093) ^ (Math.round(zoneY * 10) * 19349663) ^ ownerId) >>> 0;
    const owner = state.players.get(ownerId);
    const coreX = owner ? owner.x : zoneX - cfg.zoneRadius * 2.2;
    const coreY = owner ? owner.y : zoneY + cfg.zoneRadius * 1.6;
    const shots = [];
    for (let salvoIndex = 0; salvoIndex < cfg.salvoCount; salvoIndex++) {
      const salvoStart = salvoIndex * cfg.salvoGapSec;
      const salvoTargets = buildOrbitalSalvoTargets(zoneX, zoneY, seed, salvoIndex, cfg);
      for (let shotIndex = 0; shotIndex < salvoTargets.length; shotIndex++) {
        const shotSeed = seed + salvoIndex * 101 + shotIndex * 17 + 13;
        const target = salvoTargets[shotIndex];
        const launchAt = salvoStart + shotIndex * cfg.shotIntervalSec;
        const flightDuration = cfg.flightDurationSec + (hash01(shotSeed + 77) - 0.5) * cfg.flightVarianceSec * 2;
        shots.push({
          salvoIndex,
          shotIndex,
          seed: shotSeed,
          primary: !!target.primary,
          sx: coreX,
          sy: coreY,
          tx: target.tx,
          ty: target.ty,
          radius: target.radius,
          launchAt,
          arriveAt: launchAt + flightDuration,
          impactAt: launchAt + flightDuration,
          fadeDuration: cfg.impactFadeSec,
          resolved: false
        });
      }
    }
    state._orbitalStrikes.push({
      x: zoneX,
      y: zoneY,
      radius: cfg.zoneRadius,
      abilityId: cfg.abilityId,
      ownerId,
      spawnedAt: state.t,
      duration: getOrbitalStrikeTotalDuration(cfg),
      damageBase: cfg.damageBase,
      damageMaxHpPct: cfg.damageMaxHpPct,
      seed,
      coreX,
      coreY,
      shots
    });
  }

  function applyOrbitalStrikeImpact(strike, shot) {
    applyAreaDamage(shot.tx, shot.ty, shot.radius || 120, strike.ownerId, (target) => {
      const maxHp = Math.max(1, target.maxHp || target.hp || 1);
      return Math.max(1, (strike.damageBase || 280) + maxHp * (strike.damageMaxHpPct || 0.1));
    });
  }

  function stepOrbitalStrikes() {
    for (let i = state._orbitalStrikes.length - 1; i >= 0; i--) {
      const strike = state._orbitalStrikes[i];
      const elapsed = state.t - strike.spawnedAt;
      if (elapsed > (strike.duration || 0)) {
        state._orbitalStrikes.splice(i, 1);
        continue;
      }
      for (const shot of strike.shots || []) {
        if (shot.resolved || elapsed < shot.impactAt) continue;
        shot.resolved = true;
        applyOrbitalStrikeImpact(strike, shot);
      }
    }
  }

  function queueThermoNuke(targetX, targetY, ownerId) {
    const owner = state.players.get(ownerId);
    const originX = owner ? owner.x : targetX;
    const originY = owner ? owner.y : targetY - 260;
    const built = ThermoNukeAbility && typeof ThermoNukeAbility.buildCast === "function"
      ? ThermoNukeAbility.buildCast(targetX, targetY, ownerId, { originX, originY })
      : null;
    const fallbackDistance = Math.hypot(targetX - originX, targetY - originY) || 1;
    const fallbackDirX = (targetX - originX) / fallbackDistance;
    const fallbackDirY = (targetY - originY) / fallbackDistance;
    state._thermoNukes.push({
      ...(built || {
        seed: ((Math.round(targetX * 10) * 73856093) ^ (Math.round(targetY * 10) * 19349663) ^ ownerId) >>> 0,
        x: originX,
        y: originY,
        originX,
        originY,
        startX: originX,
        startY: originY,
        targetX,
        targetY,
        dirX: fallbackDirX,
        dirY: fallbackDirY,
        vx: 0,
        vy: 0,
        distance: fallbackDistance,
        flightDuration: 10,
        impactAt: 10,
        impactFadeDuration: 2.6,
        previewRadius: 500,
        impactRadius: 500,
        duration: 20.6,
        styleKey: "quietus-engine",
        resolved: false
      }),
      ownerId,
      spawnedAt: state.t
    });
  }

  function applyThermoNukeImpact(strike) {
    const radiusSq = (strike.impactRadius || 500) * (strike.impactRadius || 500);
    for (const unit of state.units.values()) {
      if (!unit || unit.hp <= 0) continue;
      const dx = unit.x - strike.targetX;
      const dy = unit.y - strike.targetY;
      if (dx * dx + dy * dy > radiusSq) continue;
      unit._activeShieldHp = null;
      unit.hp = 0;
      unit.lastDamagedBy = unit.owner === strike.ownerId ? null : strike.ownerId;
    }
    for (const player of state.players.values()) {
      if (!player || player.eliminated) continue;
      const dx = player.x - strike.targetX;
      const dy = player.y - strike.targetY;
      if (dx * dx + dy * dy > radiusSq) continue;
      player.shieldHp = 0;
      player.shieldRegenCd = Math.max(player.shieldRegenCd || 0, 6);
    }
  }

  function stepThermoNukes(dt) {
    for (let i = state._thermoNukes.length - 1; i >= 0; i--) {
      const strike = state._thermoNukes[i];
      const elapsed = state.t - strike.spawnedAt;
      if (!strike.resolved) {
        strike.x = strike.startX + strike.vx * Math.min(elapsed, strike.flightDuration);
        strike.y = strike.startY + strike.vy * Math.min(elapsed, strike.flightDuration);
      }
      if (!strike.resolved && elapsed >= (strike.impactAt || strike.flightDuration || 0)) {
        strike.resolved = true;
        strike.x = strike.targetX;
        strike.y = strike.targetY;
        applyThermoNukeImpact(strike);
      }
      if (elapsed > (strike.duration || 0)) state._thermoNukes.splice(i, 1);
    }
  }

  function stepLaneFighterWaves() {
    if (state._laneFighterWaveNextAt == null) state._laneFighterWaveNextAt = 0;
    const waveInterval = 30;
    while (state.t >= (state._laneFighterWaveNextAt || 0)) {
      for (const player of state.players.values()) {
        if (!player || player.id == null || player.id <= 0 || player.eliminated) continue;
        const wavePlan = [
          { frontType: "left", count: 3 },
          { frontType: "center", count: 3 },
          { frontType: "right", count: 3 }
        ];
        for (const plan of wavePlan) {
          spawnLaneAbilityUnits(player.id, plan.frontType, "fighter", plan.count, {
            sourceTag: "timed:laneFighters:" + player.id + ":" + plan.frontType,
            spread: 22,
            forwardStep: 7,
            allowAutoJoinRecentSpawn: false,
            mutateUnit: (unit) => {
              unit._autoLaneFighterWave = true;
            }
          });
        }
      }
      state._laneFighterWaveNextAt = (state._laneFighterWaveNextAt || 0) + waveInterval;
      if (waveInterval <= 0) break;
    }
  }

  const RANDOM_BLACKHOLE_INTERVAL = gs(300);

  function stepRandomEvents() {
    if (state._randomBlackHoleNextAt == null) state._randomBlackHoleNextAt = state.t + RANDOM_BLACKHOLE_INTERVAL;
    if (state.t >= (state._randomBlackHoleNextAt || 0)) {
      state._randomBlackHoleNextAt = state.t + RANDOM_BLACKHOLE_INTERVAL;
      const margin = 200;
      const x = margin + Math.random() * (CFG.WORLD_W - 2 * margin);
      const y = margin + Math.random() * (CFG.WORLD_H - 2 * margin);
      spawnBlackHole(null, x, y, null);
    }
  }

  const PIRATE_FULL_SQUAD = ["destroyer", "destroyer", "destroyer", "destroyer", "cruiser", "cruiser", "cruiser", "battleship"];
  const PIRATE_RESPAWN_CD = gs(180);

  function spawnPirateUnit(x, y, unitTypeKey, pirateBaseId, batchTag) {
    const type = UNIT_TYPES[unitTypeKey] || UNIT_TYPES.destroyer;
    if (!type) return null;
    const id = state.nextUnitId++;
    const unit = {
      id, owner: PIRATE_OWNER_ID, color: 0x666666,
      unitType: unitTypeKey,
      x, y, vx: 0, vy: 0,
      hp: Math.round((type.hp || 100) * 1.5),
      maxHp: Math.round((type.hp || 100) * 1.5),
      dmg: type.damage, atkCd: 0,
      attackRange: type.attackRange, maxTargets: type.maxTargets,
      speed: type.speed * 0.7,
      baseMaxHp: Math.round((type.hp || 100) * 1.5),
      baseDamage: type.damage, baseAttackRate: type.attackRate,
      baseAttackRange: type.attackRange, baseSpeed: type.speed * 0.7,
      orbitTarget: false, popPenalty: 0, regenPerSec: 0, gfx: null,
      waypoints: [], waypointIndex: 0,
      leaderId: null, formationOffsetX: 0, formationOffsetY: 0,
      formationType: "line", formationRows: 1, formationPigWidth: 1,
      spawnTime: state.t,
      _cryoSlowUntil: 0, _fireDotUntil: 0, _fireDotDps: 0,
      _lastFacingAngle: 0, _formationAngle: 0,
      _piratePatrol: true, _pirateBaseId: pirateBaseId
    };
    state.units.set(id, unit);
    SQUADLOGIC.createSquad(state, [id], {
      leaderUnitId: id, formationType: "line", formationRows: 1, formationWidth: 1,
      sourceTag: batchTag || "pirate", autoGroupUntil: state.t + gs(3),
      allowAutoJoinRecentSpawn: true,
      order: { type: "idle", waypoints: [], holdPoint: null }
    });
    return unit;
  }

  function stepPirateBaseBehavior(dt) {
    for (const pb of getAlivePirateBases()) {
      if (!pb || pb.hp <= 0) continue;
      const basePirateUnits = [];
      for (const u of state.units.values()) {
        if (u.owner === PIRATE_OWNER_ID && u._pirateBaseId === pb.id && u.hp > 0) basePirateUnits.push(u);
      }
      const pirateCount = basePirateUnits.length;
      if (pb._respawnTimer == null) pb._respawnTimer = 0;
      const needsInitialSpawn = !pb._initialSpawned && pirateCount === 0;

      if (pirateCount === 0) {
        if (needsInitialSpawn) pb._respawnTimer = 0;
        else if (pb._respawnTimer <= 0) pb._respawnTimer = PIRATE_RESPAWN_CD;
        if (!needsInitialSpawn) pb._respawnTimer -= dt;
        if (needsInitialSpawn || pb._respawnTimer <= 0) {
          pb._respawnTimer = 0;
          pb._initialSpawned = true;
          const oc = pb.orbitCenter || { x: pb.x, y: pb.y };
          const oR = pb.orbitRadius || 280;
          const batchTag = pb.id + "-" + Math.floor(state.t);
          for (let i = 0; i < PIRATE_FULL_SQUAD.length; i++) {
            const a = (Math.PI * 2 * i) / PIRATE_FULL_SQUAD.length + Math.random() * 0.2;
            spawnPirateUnit(
              oc.x + Math.cos(a) * oR * 0.52,
              oc.y + Math.sin(a) * oR * 0.52,
              PIRATE_FULL_SQUAD[i], pb.id, batchTag
            );
          }
        }
      } else {
        pb._respawnTimer = 0;
        pb._initialSpawned = true;
      }

      const oc = pb.orbitCenter || { x: pb.x, y: pb.y };
      const patrolRadius = Math.max(108, (pb.orbitRadius || 260) * 1.15);
      const pirateSquads = [...state.squads.values()].filter((sq) => {
        if (sq.ownerId !== PIRATE_OWNER_ID) return false;
        const leader = state.units.get(sq.leaderUnitId);
        return leader && leader._pirateBaseId === pb.id;
      });
      for (let si = 0; si < pirateSquads.length; si++) {
        const sq = pirateSquads[si];
        if (sq.combat.mode === "approach" || sq.combat.mode === "engaged") continue;
        const leader = state.units.get(sq.leaderUnitId);
        if (!leader) continue;
        if (!sq._patrolAngle) sq._patrolAngle = (si / Math.max(1, pirateSquads.length)) * Math.PI * 2;
        sq._patrolAngle += dt * 0.15;
        const targetX = oc.x + Math.cos(sq._patrolAngle) * patrolRadius;
        const targetY = oc.y + Math.sin(sq._patrolAngle) * patrolRadius;
        const dist = Math.hypot(leader.x - targetX, leader.y - targetY);
        if (dist > 40 || !sq._patrolIssued) {
          SQUADLOGIC.issueMoveOrder(state, sq.id, [{ x: targetX, y: targetY }], sq._patrolAngle);
          sq._patrolIssued = true;
        }
      }
    }
  }

  const TURN_RATES = { fighter: 8.5, destroyer: 5.5, cruiser: 3.8, battleship: 2.5, hyperDestroyer: 4.0 };

  function getUnitTurnRate(unitType) { return TURN_RATES[unitType] || TURN_RATES.fighter; }

  function getUnitSpeed(unit) {
    const owner = state.players.get(unit.owner);
    const isPirate = unit.owner === PIRATE_OWNER_ID;
    const classOrder = ["fighter", "destroyer", "cruiser", "battleship", "hyperDestroyer"];
    const classIdx = classOrder.indexOf(unit.unitType || "fighter");
    const baseIndividual = (unit.speed || UNIT_TYPES[unit.unitType || "fighter"]?.speed || 9) * 1.1 * Math.max(0.5, 1 - classIdx * 0.06);
    const squadSpeed = (unit.squadId != null && typeof SQUADLOGIC.getSquadSpeed === "function")
      ? (SQUADLOGIC.getSquadSpeed(state, unit.squadId) || baseIndividual)
      : baseIndividual;
    let mul = isPirate ? 1 : getPlayerUnitSpeedMul(owner);
    if (!isPirate && state._fleetBoostUntil[unit.owner] && state._fleetBoostUntil[unit.owner] > state.t) mul *= 1.5;
    if (!isPirate && state._battleMarchUntil[unit.owner] && state._battleMarchUntil[unit.owner] > state.t) mul *= 1.3;
    const cryoMul = (unit._cryoSlowUntil && state.t < unit._cryoSlowUntil) ? Math.max(0.2, 1 - (unit._cryoSlowAmount || 0.4)) : 1;
    const hyperMul = (unit._pirateHyperUntil && state.t < unit._pirateHyperUntil) ? 6 : 1;
    return { squad: squadSpeed * mul * cryoMul * hyperMul, individual: baseIndividual * mul * cryoMul * hyperMul };
  }

  function stepUnits(dt) {
    const helpers = getCombatHelpers();
    for (const unit of state.units.values()) {
      if (!unit || unit.hp <= 0) continue;
      const owner = state.players.get(unit.owner);
      const isPirate = unit.owner === PIRATE_OWNER_ID;
      if (!isPirate && (!owner || owner.eliminated)) continue;
      if (unit._anchorStasisUntil && state.t < unit._anchorStasisUntil) {
        unit.vx = 0; unit.vy = 0; continue;
      }
      if (unit._fireDotUntil && state.t < unit._fireDotUntil && unit._fireDotDps) {
        applyUnitDamage(unit, unit._fireDotDps * dt, null, unit.lastDamagedBy || null);
      }
      if (unit.regenPerSec) unit.hp = Math.min(unit.maxHp || unit.hp, unit.hp + unit.regenPerSec * dt);

      let desired = SQUADLOGIC.getUnitMovementTarget(unit, state, helpers);
      if (unit._blackHolePullUntil && state.t < unit._blackHolePullUntil) {
        desired = { tx: unit._blackHolePullX ?? unit.x, ty: unit._blackHolePullY ?? unit.y, moveMode: "blackhole_pull" };
      }
      const speeds = getUnitSpeed(unit);
      const isFreeChase = desired.moveMode === "free_chase";
      const isBlackHole = desired.moveMode === "blackhole_pull";
      let dx = (desired.tx || unit.x) - unit.x;
      let dy = (desired.ty || unit.y) - unit.y;
      let dist = Math.hypot(dx, dy);

      if (isFreeChase && dist > 1) {
        const atkR = getUnitAtkRange(unit) * 0.72;
        if (dist <= atkR) {
          unit._lastFacingAngle = Math.atan2(dy, dx);
          unit.vx = Math.cos(unit._lastFacingAngle);
          unit.vy = Math.sin(unit._lastFacingAngle);
          continue;
        }
      }

      if (dist <= 0.5 || desired.moveMode === "stop") {
        unit.vx = 0; unit.vy = 0; continue;
      }

      const desiredAngle = Math.atan2(dy, dx);
      let curFacing = unit._lastFacingAngle ?? desiredAngle;
      let angleDiff = desiredAngle - curFacing;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      const turnStep = getUnitTurnRate(unit.unitType || "fighter") * dt;
      if (Math.abs(angleDiff) > turnStep) curFacing += Math.sign(angleDiff) * turnStep;
      else curFacing = desiredAngle;
      unit._lastFacingAngle = curFacing;

      const moveScale = Math.max(0.3, 1 - Math.abs(angleDiff) * 0.2);
      const effectiveSpeed = isBlackHole ? Math.max(speeds.squad, unit._blackHolePullSpeed || 0)
        : (isFreeChase ? speeds.individual : speeds.squad);
      const maxMove = effectiveSpeed * dt;
      const decel = (!isFreeChase && !isBlackHole && dist < 20) ? (dist / 20) : 1;
      const moveDist = Math.min(maxMove * decel * moveScale, dist);
      if (moveDist > 0.01) {
        unit.x += Math.cos(curFacing) * moveDist;
        unit.y += Math.sin(curFacing) * moveDist;
      }
      const spd = dt > 0 ? moveDist / dt : 0;
      unit.vx = Math.cos(curFacing) * spd;
      unit.vy = Math.sin(curFacing) * spd;
    }

    for (const unit of state.units.values()) {
      if (!unit || unit.hp <= 0) continue;
      const sq = unit.squadId != null ? state.squads.get(unit.squadId) : null;
      if (sq && (sq.combat.mode === "engaged" || sq.combat.mode === "approach")) continue;
      const uHitR = getUnitHitRadius(unit);
      for (const other of state.units.values()) {
        if (!other || other.id === unit.id || other.hp <= 0 || other.owner === unit.owner) continue;
        const oHitR = getUnitHitRadius(other);
        const minD = (uHitR + oHitR) * 0.5;
        const cdx = unit.x - other.x, cdy = unit.y - other.y;
        const cDist = Math.hypot(cdx, cdy);
        if (cDist < minD && cDist > 0.01) {
          const overlap = minD - cDist;
          const push = overlap * 0.03 * dt;
          unit.x += (cdx / cDist) * push;
          unit.y += (cdy / cDist) * push;
        }
      }
    }

    for (const unit of state.units.values()) {
      if (!unit || unit.hp <= 0) continue;
      for (const cp of state.players.values()) {
        if (cp.eliminated) continue;
        const noFlyR = getCoreCollisionRadius(cp, CFG);
        const dToCity = Math.hypot(unit.x - cp.x, unit.y - cp.y);
        if (dToCity > 0 && dToCity < noFlyR) {
          const scale = noFlyR / dToCity;
          unit.x = cp.x + (unit.x - cp.x) * scale;
          unit.y = cp.y + (unit.y - cp.y) * scale;
        }
      }
      if (typeof SQUADLOGIC.getLaneClampForUnit === "function") {
        const clampPt = SQUADLOGIC.getLaneClampForUnit(unit, state, 12);
        if (clampPt) { unit.x = clampPt.x; unit.y = clampPt.y; }
      }
      unit.x = UTILS.clamp(unit.x, 0, CFG.WORLD_W);
      unit.y = UTILS.clamp(unit.y, 0, CFG.WORLD_H);
    }
  }

  function stepCombat(dt) {
    const helpers = getCombatHelpers();
    for (const unit of state.units.values()) {
      if (!unit || unit.hp <= 0) continue;
      const owner = state.players.get(unit.owner);
      const isPirate = unit.owner === PIRATE_OWNER_ID;
      if (!isPirate && (!owner || owner.eliminated)) continue;
      unit.atkCd = Math.max(0, (unit.atkCd || 0) - dt);
      if (unit.atkCd > 0) continue;
      const plan = SQUADLOGIC.getUnitFirePlan(unit, state, helpers);
      const damage = Math.max(1, (unit.baseDamage || unit.dmg || 0) * (isPirate ? 1 : getPlayerDamageMul(owner)));
      const attackRate = Math.max(0.05, (unit.baseAttackRate || 0.2) * (isPirate ? 1 : getPlayerAttackRateMul(owner)));
      if (plan && plan.type === "units") {
        for (const target of plan.targets || []) {
          if (!target || target.owner === unit.owner || target.hp <= 0) continue;
          applyUnitDamage(target, damage, unit.id, unit.owner);
          state.bullets.push({
            type: "laser",
            fromX: unit.x, fromY: unit.y,
            toX: target.x, toY: target.y,
            ownerId: unit.owner, dmg: damage,
            duration: gs(0.38), progress: 0,
            targetId: target.id, targetType: "unit",
            sourceUnitId: unit.id
          });
          if (owner && owner.attackEffect === "cryo") {
            target._cryoSlowUntil = Math.max(target._cryoSlowUntil || 0, state.t + gs(balance.cryoEffect?.duration || 2));
            target._cryoSlowAmount = balance.cryoEffect?.slowPercent || 0.4;
          }
          if (owner && owner.attackEffect === "fire") {
            target._fireDotUntil = Math.max(target._fireDotUntil || 0, state.t + gs(balance.fireEffect?.duration || 3));
            target._fireDotDps = Math.max(target._fireDotDps || 0, balance.fireEffect?.dotDamagePerSec || 3);
          }
        }
      } else if (plan && plan.type === "city" && plan.city) {
        applyCityDamage(plan.city, damage, unit.owner);
        state.bullets.push({
          type: "laser",
          fromX: unit.x, fromY: unit.y,
          toX: plan.city.x, toY: plan.city.y,
          ownerId: unit.owner, dmg: damage,
          duration: gs(0.38), progress: 0,
          targetId: plan.city.id, targetType: "city",
          sourceUnitId: unit.id
        });
      } else if (plan && plan.type === "turret" && plan.turret) {
        plan.turret.hp = Math.max(0, (plan.turret.hp || 0) - damage);
        if (plan.turret.hp <= 0 && plan.turret._diedAt == null) plan.turret._diedAt = state.t;
        state.bullets.push({
          type: "laser",
          fromX: unit.x, fromY: unit.y,
          toX: plan.turret.x, toY: plan.turret.y,
          ownerId: unit.owner, dmg: damage,
          duration: gs(0.38), progress: 0,
          targetId: plan.turret.id, targetType: "turret",
          sourceUnitId: unit.id
        });
      } else {
        const squad = unit.squadId != null ? state.squads.get(unit.squadId) : null;
        const pirateBase = squad && squad.order && squad.order.type === "attackPirateBase" ? state.pirateBase : null;
        if (!pirateBase || pirateBase.hp <= 0) continue;
        const attackRadius = Math.max(44, getUnitAtkRange(unit));
        if (Math.hypot(unit.x - pirateBase.x, unit.y - pirateBase.y) > attackRadius) continue;
        pirateBase.hp = Math.max(0, pirateBase.hp - damage);
        pirateBase.lastDamagedBy = unit.owner;
        if (pirateBase.hp <= 0) handlePirateBaseDestroyed(pirateBase);
      }
      unit.atkCd = 1 / attackRate;
    }
  }

  function stepBullets(dt) {
    for (let index = state.bullets.length - 1; index >= 0; index--) {
      const bullet = state.bullets[index];
      if (!bullet) {
        state.bullets.splice(index, 1);
        continue;
      }
      if (bullet.type === "laser") {
        if (bullet.targetType === "unit" && bullet.targetId != null && !state.units.has(bullet.targetId)) {
          state.bullets.splice(index, 1);
          continue;
        }
        if (bullet.targetType === "turret" && bullet.targetId != null) {
          const turret = state.turrets.get(bullet.targetId);
          if (!turret || turret.hp <= 0) {
            state.bullets.splice(index, 1);
            continue;
          }
        }
        bullet.progress = (bullet.progress || 0) + dt / Math.max(0.01, bullet.duration || 0.2);
        if (bullet.progress < 1) continue;
        if (bullet.targetType === "unit") {
          const unit = state.units.get(bullet.targetId);
          if (unit && unit.owner !== bullet.ownerId) applyUnitDamage(unit, bullet.dmg || 0, bullet.sourceUnitId, bullet.ownerId);
        } else if (bullet.targetType === "turret") {
          const turret = state.turrets.get(bullet.targetId);
          if (turret && turret.owner !== bullet.ownerId) {
            turret.hp = Math.max(0, (turret.hp || 0) - (bullet.dmg || 0));
            if (turret.hp <= 0 && turret._diedAt == null) turret._diedAt = state.t;
          }
        } else if (bullet.targetType === "pirateBase") {
          const pirateBase = state.pirateBase;
          if (pirateBase && pirateBase.hp > 0) {
            pirateBase.hp = Math.max(0, pirateBase.hp - (bullet.dmg || 0));
            pirateBase.lastDamagedBy = bullet.ownerId;
            if (pirateBase.hp <= 0) handlePirateBaseDestroyed(pirateBase);
          }
        }
        state.bullets.splice(index, 1);
        continue;
      }
      bullet.progress = (bullet.progress || 0) + dt / Math.max(0.01, bullet.duration || 0.5);
      if (bullet.progress >= 1) state.bullets.splice(index, 1);
    }
  }

  function spawnBlackHole(ownerId, x, y, opts) {
    const options2 = opts || {};
    state._blackHoles.push({
      x,
      y,
      ownerId,
      radius: options2.radius != null ? options2.radius : CFG.BLACKHOLE_RADIUS,
      duration: options2.durationSec != null ? options2.durationSec : CFG.BLACKHOLE_DURATION,
      spawnedAt: state.t,
      phase: 0,
      styleKey: options2.styleKey || null,
      damageScale: options2.damageScale != null ? options2.damageScale : 1
    });
  }

  function stepBlackHoles(dt) {
    const growTBase = CFG.BLACKHOLE_GROWTH_TIME || 3;
    const fadeTBase = CFG.BLACKHOLE_FADE_TIME || 4;
    for (let i = state._blackHoles.length - 1; i >= 0; i--) {
      const bh = state._blackHoles[i];
      const elapsed = state.t - bh.spawnedAt;
      if (elapsed > bh.duration) {
        state._blackHoles.splice(i, 1);
        continue;
      }
      const totalT = Math.max(0.1, bh.duration || CFG.BLACKHOLE_DURATION || 10);
      const growT = Math.min(growTBase, totalT * 0.35);
      const fadeT = Math.min(fadeTBase, totalT * 0.35);
      const holdT = Math.max(0, totalT - growT - fadeT);
      let sizeFrac;
      if (elapsed < growT) sizeFrac = elapsed / growT;
      else if (elapsed < growT + holdT) sizeFrac = 1;
      else sizeFrac = Math.max(0, 1 - (elapsed - growT - holdT) / fadeT);
      const currentRadius = bh.radius * sizeFrac;
      bh._curRadius = currentRadius;
      bh._sizeFrac = sizeFrac;
      for (const unit of state.units.values()) {
        if (!unit || unit.hp <= 0) continue;
        const dx = bh.x - unit.x;
        const dy = bh.y - unit.y;
        const dist = Math.hypot(dx, dy);
        if (dist > currentRadius) continue;
        const safeDist = Math.max(1, dist);
        const influence = Math.max(0, 1 - safeDist / Math.max(1, currentRadius));
        const pullSpeed = Math.max(
          CFG.BLACKHOLE_GRAVITY * 2.4,
          (bh.radius || currentRadius) * (0.35 + influence * 1.35)
        ) * Math.max(0.55, sizeFrac * sizeFrac);
        unit._blackHolePullUntil = state.t + gs(0.18);
        unit._blackHolePullX = bh.x;
        unit._blackHolePullY = bh.y;
        unit._blackHolePullSpeed = pullSpeed;
        const maxHp = Math.max(1, unit.maxHp || unit.hp || 1);
        const minDps = CFG.BLACKHOLE_MIN_DPS || 1;
        const maxDps = CFG.BLACKHOLE_MAX_DPS || 10;
        const pctDps = minDps + (maxDps - minDps) * influence;
        const damage = maxHp * (pctDps / 100) * (bh.damageScale != null ? bh.damageScale : 1) * dt;
        applyUnitDamage(unit, damage, null, bh.ownerId);
      }
    }
  }

  function cleanupDestroyed() {
    const deadUnitIds = [];
    for (const unit of state.units.values()) {
      if (!unit || unit.hp > 0) continue;
      deadUnitIds.push(unit.id);
      const owner = state.players.get(unit.owner);
      if (owner) {
        owner.deadUnits = (owner.deadUnits || 0) + 1;
        const penalty = unit.popPenalty || 1;
        owner.popFloat = Math.max(0, (owner.popFloat || owner.pop || 0) - penalty);
        owner.pop = Math.floor(owner.popFloat);
      }
      const killerId = state.players.has(unit.lastDamagedBy) ? unit.lastDamagedBy : null;
      if (killerId != null && killerId !== unit.owner) {
        const killer = state.players.get(killerId);
        if (killer) {
          gainXP(killer, UNIT_XP_DROPS[unit.unitType] || 1);
          killer.eCredits = (killer.eCredits || 0) + (UNIT_CREDIT_DROPS[unit.unitType] || 0);
          const bonus = UNIT_KILL_ENERGY_BONUSES[unit.unitType];
          if (bonus) addTimedGrowthBonus(killer, bonus.amount, bonus.durationSec);
        }
      }
    }
    for (const id of deadUnitIds) state.units.delete(id);
    SQUADLOGIC.syncSquadsFromState(state);
    for (const player of state.players.values()) {
      if (player.eliminated) continue;
      if ((player.pop || 0) <= 0) {
        player.pop = 0;
        player.popFloat = 0;
        player.eliminated = true;
      }
    }
  }

  function applyAbilitySuccess(pid, abilityId) {
    setAbilityCooldown(pid, abilityId);
    markAbilityUsed(pid, abilityId);
  }

  function useResourceSurge(pid) {
    const player = state.players.get(pid);
    if (!player) return false;
    player.eCredits = (player.eCredits || 0) + 2200;
    state._economyAbilityFx.push({
      id: "econ:" + (state.nextResId++),
      type: "resourceSurge",
      ownerId: pid,
      ownerColor: player.color || 0xffc84b,
      spawnedAt: state.t,
      duration: gs(4.35),
      burstDuration: 3.75,
      finishDuration: 0.6,
      targetX: player.x || 0,
      targetY: player.y || 0,
      amount: 2200,
      variantKey: "auric-surge"
    });
    return true;
  }

  function useRaiderCapture(pid, targetCityId) {
    const player = state.players.get(pid);
    const targetCity = state.players.get(targetCityId);
    if (!player || !targetCity || targetCity.eliminated || targetCityId === pid) return false;
    const steal = Math.max(1, Math.min(70, Math.floor((targetCity.pop || 0) * 0.12)));
    targetCity.popFloat = Math.max(0, (targetCity.popFloat || targetCity.pop || 0) - steal);
    targetCity.pop = Math.floor(targetCity.popFloat);
    player.popFloat = (player.popFloat || player.pop || 0) + steal;
    player.pop = Math.floor(player.popFloat);
    state._economyAbilityFx.push({
      id: "econ:" + (state.nextResId++),
      type: "energySteal",
      ownerId: pid,
      targetId: targetCityId,
      ownerColor: player.color || 0xff8f48,
      targetColor: targetCity.color || 0x68d8ff,
      spawnedAt: state.t,
      duration: gs(4.44),
      signalDuration: 0.88,
      drainDuration: 3.0,
      finishDuration: 0.56,
      startX: player.x || 0,
      startY: player.y || 0,
      targetX: targetCity.x || 0,
      targetY: targetCity.y || 0,
      amount: steal,
      variantKey: "eclipse-siphon"
    });
    return true;
  }

  function executeAbilityAction(action) {
    const player = state.players.get(action.pid);
    if (!player || player.eliminated || !action.abilityId) return false;
    const abilityId = action.abilityId;
    if (!isAbilityAvailable(action.pid, abilityId)) return false;

    if (abilityId === "ionNebula" || abilityId === "ionField") {
      spawnIonStorm(action.pid, action.x, action.y, abilityId === "ionField" ? { durationSec: 3 } : null);
      applyAbilitySuccess(action.pid, abilityId);
      return true;
    }
    if (abilityId === "meteor") {
      spawnMeteor(action.x, action.y, action.angle || 0, action.pid, null);
      applyAbilitySuccess(action.pid, abilityId);
      return true;
    }
    if (abilityId === "meteorSwarm") {
      spawnMeteorSwarm(action.x, action.y, action.angle || 0, action.pid);
      applyAbilitySuccess(action.pid, abilityId);
      return true;
    }
    if (abilityId === "blackHole") {
      spawnBlackHole(action.pid, action.x, action.y, { styleKey: "event-horizon-bloom" });
      applyAbilitySuccess(action.pid, abilityId);
      return true;
    }
    if (abilityId === "microBlackHole") {
      spawnBlackHole(action.pid, action.x, action.y, {
        radius: Math.max(60, CFG.BLACKHOLE_RADIUS / 3),
        durationSec: 5,
        damageScale: 1 / 3,
        styleKey: "blood-meridian"
      });
      applyAbilitySuccess(action.pid, abilityId);
      return true;
    }
    if (abilityId === "activeShield") {
      for (const unit of state.units.values()) {
        if (unit.owner !== action.pid || unit.hp <= 0) continue;
        unit._activeShieldHp = (unit._activeShieldHp || 0) + Math.max(1, (unit.maxHp || unit.hp) * 0.25);
      }
      applyAbilitySuccess(action.pid, abilityId);
      return true;
    }
    if (abilityId === "fleetBoost") {
      state._fleetBoostUntil[action.pid] = state.t + gs(20);
      applyAbilitySuccess(action.pid, abilityId);
      return true;
    }
    if (abilityId === "gloriousBattleMarch") {
      state._battleMarchUntil[action.pid] = state.t + gs(30);
      applyAbilitySuccess(action.pid, abilityId);
      return true;
    }
    if (abilityId === "resourceSurge") {
      const ok = useResourceSurge(action.pid);
      if (ok) applyAbilitySuccess(action.pid, abilityId);
      return ok;
    }
    if (abilityId === "raiderCapture") {
      const ok = useRaiderCapture(action.pid, action.targetCityId);
      if (ok) applyAbilitySuccess(action.pid, abilityId);
      return ok;
    }
    if (abilityId === "minefield" || abilityId === "minefieldLarge") {
      const out = deployMinefield(abilityId, action.x, action.y, action.pid);
      if (out.ok) applyAbilitySuccess(action.pid, abilityId);
      return out.ok;
    }
    if (abilityId === "gravAnchor" || abilityId === "microAnchor") {
      state._abilityZoneEffects.push(buildAnchorEffect(action.pid, action.x, action.y, abilityId));
      applyAbilitySuccess(action.pid, abilityId);
      return true;
    }
    if (abilityId === "orbitalStrike" || abilityId === "orbitalBarrage") {
      queueOrbitalStrike(action.x, action.y, action.pid, abilityId);
      applyAbilitySuccess(action.pid, abilityId);
      return true;
    }
    if (abilityId === "thermoNuke") {
      queueThermoNuke(action.x, action.y, action.pid);
      applyAbilitySuccess(action.pid, abilityId);
      return true;
    }
    if (abilityId === "loan") {
      player.eCredits = (player.eCredits || 0) + 5000;
      state._loanDebts.push({ pid: action.pid, deductAt: state.t + gs(180), amount: 7500 });
      applyAbilitySuccess(action.pid, abilityId);
      return true;
    }
    return false;
  }

  function recomputeBuffDerivedStats(player) {
    player.unitHpMul = 1;
    player.unitDmgMul = 1;
    player.unitAtkRateMul = 1;
    player.unitSpeedMul = 1;
    player.unitAtkRangeMul = 1;
    player.growthMul = 1;
    player.influenceSpeedMul = 1;
    player.unitCostMul = 1;
    player.attackEffect = null;
    const entries = []
      .concat(Array.isArray(player.activeBuffs) ? player.activeBuffs : [])
      .concat(Array.isArray(player.legendaryBuffs) ? player.legendaryBuffs : []);
    for (const entry of entries) {
      const card = CardSystem.getCardDef(entry.cardId);
      if (!card) continue;
      if (card.unitHpMul) player.unitHpMul *= card.unitHpMul;
      if (card.unitDmgMul) player.unitDmgMul *= card.unitDmgMul;
      if (card.unitAtkRateMul) player.unitAtkRateMul *= card.unitAtkRateMul;
      if (card.unitSpeedMul) player.unitSpeedMul *= card.unitSpeedMul;
      if (card.unitAtkRangeMul) player.unitAtkRangeMul *= card.unitAtkRangeMul;
      if (card.growthMul) player.growthMul *= card.growthMul;
      if (card.influenceSpeedMul) player.influenceSpeedMul *= card.influenceSpeedMul;
      if (card.unitCostMul) player.unitCostMul *= card.unitCostMul;
      if (card.attackEffect) player.attackEffect = card.attackEffect;
    }
    syncOwnedUnitsForPlayerBuffStats(player);
  }

  function syncOwnedUnitsForPlayerBuffStats(player) {
    if (!player || player.id == null) return;
    const hpMul = (player.unitHpMul != null ? player.unitHpMul : 1) * getLevelBonusMul(player);
    for (const unit of state.units.values()) {
      if (!unit || unit.owner !== player.id || unit.hp <= 0) continue;
      if (unit.baseMaxHp == null) unit.baseMaxHp = (UNIT_TYPES[unit.unitType] && UNIT_TYPES[unit.unitType].hp) || unit.maxHp || unit.hp || 1;
      const prevMax = Math.max(1, unit.maxHp || unit.baseMaxHp || 1);
      const nextMax = Math.max(1, Math.round(unit.baseMaxHp * hpMul));
      if (prevMax !== nextMax) {
        const ratio = prevMax > 0 ? (unit.hp || prevMax) / prevMax : 1;
        unit.maxHp = nextMax;
        unit.hp = Math.max(0, Math.min(nextMax, ratio * nextMax));
      } else {
        unit.maxHp = nextMax;
      }
    }
  }

  function getOwnedSquadIdsFromLeaderIds(action, senderPid) {
    const out = [];
    for (const leaderId of action.leaderIds || []) {
      const unit = state.units.get(leaderId);
      if (!unit || unit.owner !== senderPid) continue;
      if (unit.squadId == null) continue;
      if (!out.includes(unit.squadId)) out.push(unit.squadId);
    }
    return out;
  }

  function handlePlayerAction(action) {
    if (!action || typeof action !== "object") return;
    const senderPid = getSenderPid(state, action);
    if (senderPid == null) return;
    if (action.type === "purchaseFrontTriplet") {
      purchaseFrontTriplet(senderPid, CORE_ROSTER_UNIT_TYPES.has(action.unitType) ? action.unitType : "destroyer");
      return;
    }
    if (action.type === "purchase" || action.type === "spawn") {
      purchaseUnit(senderPid, CORE_ROSTER_UNIT_TYPES.has(action.unitType) ? action.unitType : "destroyer", action.waypoints, null);
      return;
    }
    if (action.type === "move") {
      const squadIds = getOwnedSquadIdsFromLeaderIds(action, senderPid);
      const waypoints = cloneWaypoints(action.waypoints && action.waypoints.length ? action.waypoints : [{ x: action.x, y: action.y }]);
      for (const squadId of squadIds) {
        if (action.capture) SQUADLOGIC.issueCaptureOrder(state, squadId, action.mineId, waypoints[0] || null, waypoints, action.captureQueue, action.commandQueue);
        else SQUADLOGIC.issueMoveOrder(state, squadId, waypoints, action.angle, action.commandQueue);
      }
      return;
    }
    if (action.type === "attackPirateBase") {
      const squadIds = getOwnedSquadIdsFromLeaderIds(action, senderPid);
      const waypoints = cloneWaypoints(action.waypoints && action.waypoints.length ? action.waypoints : [{ x: action.x, y: action.y }]);
      for (const squadId of squadIds) SQUADLOGIC.issuePirateBaseOrder(state, squadId, waypoints, action.commandQueue);
      return;
    }
    if (action.type === "chase") {
      const squadIds = getOwnedSquadIdsFromLeaderIds(action, senderPid);
      const waypoints = cloneWaypoints(action.waypoints && action.waypoints.length ? action.waypoints : [{ x: action.x, y: action.y }]);
      for (const squadId of squadIds) SQUADLOGIC.issueAttackUnitOrder(state, squadId, action.targetUnitId, waypoints, action.commandQueue);
      return;
    }
    if (action.type === "chaseCity") {
      const squadIds = getOwnedSquadIdsFromLeaderIds(action, senderPid);
      const waypoints = cloneWaypoints(action.waypoints && action.waypoints.length ? action.waypoints : [{ x: action.x, y: action.y }]);
      for (const squadId of squadIds) SQUADLOGIC.issueSiegeOrder(state, squadId, action.targetCityId, waypoints, action.commandQueue);
      return;
    }
    if (action.type === "focusFire") {
      const squadIds = getOwnedSquadIdsFromLeaderIds(action, senderPid);
      for (const squadId of squadIds) {
        const squad = state.squads.get(squadId);
        if (squad && squad.combat && squad.combat.mode !== "idle") SQUADLOGIC.setSquadFocusTarget(state, squadId, action.targetUnitId);
        else SQUADLOGIC.issueAttackUnitOrder(state, squadId, action.targetUnitId, [], action.commandQueue);
      }
      return;
    }
    if (action.type === "formation") {
      const squadIds = getOwnedSquadIdsFromLeaderIds(action, senderPid);
      for (const squadId of squadIds) {
        SQUADLOGIC.setSquadFormation(state, squadId, action.formationType || "line", action.formationRows || 1, action.formationPigWidth || 1);
        SQUADLOGIC.requestFormationRecalc(state, squadId, true);
        if (typeof SQUADLOGIC.recalculateFormation === "function") {
          SQUADLOGIC.recalculateFormation(state, squadId, { getFormationOffsets }, true);
        }
      }
      return;
    }
    if (action.type === "mergeSquad") {
      const ownedSquadIds = Array.isArray(action.squadIds)
        ? action.squadIds.filter((id) => state.squads.get(id)?.ownerId === senderPid)
        : [];
      if (ownedSquadIds.length >= 2) {
        const merged = SQUADLOGIC.mergeSquads(state, ownedSquadIds, action.formationType || "line", action.formationRows || 1, action.formationPigWidth || 1);
        if (merged && typeof SQUADLOGIC.recalculateFormation === "function") {
          SQUADLOGIC.recalculateFormation(state, merged.id, { getFormationOffsets }, true);
        }
      }
      return;
    }
    if (action.type === "splitSquadByType" && action.squadId != null) {
      const squad = state.squads.get(action.squadId);
      if (squad && squad.ownerId === senderPid) SQUADLOGIC.splitSquadByType(state, squad.id);
      return;
    }
    if (action.type === "useAbility") {
      executeAbilityAction({ ...action, pid: senderPid });
      return;
    }
    if (action.type === "activateBuffCard") {
      const player = state.players.get(senderPid);
      if (!player) return;
      const result = CardSystem.activateBuffCard(player, action.instanceId, state.t);
      if (result && result.ok) {
        recomputeBuffDerivedStats(player);
        bumpCardStateVersion(player);
      }
      return;
    }
    if (action.type === "castAbilityCard") {
      const player = state.players.get(senderPid);
      if (!player) return;
      const result = CardSystem.consumeAbilityCard(player, action.instanceId);
      if (!result || !result.ok || !result.cardDef) return;
      bumpCardStateVersion(player);
      executeAbilityAction({ ...action, pid: senderPid, abilityId: result.cardDef.abilityId || action.abilityId });
    }
  }

  function broadcastSnapshot() {
    if (!io || !roomId) return;
    const snap = serializer.serialize(state);
    io.to(roomId).emit("gameState", snap);
  }

  function tick() {
    try {
      const dt = (TICK_MS / 1000) * GAME_SPEED;
      state.t += dt;
      state._frameCtr = (state._frameCtr || 0) + 1;
      while (queuedActions.length > 0) handlePlayerAction(queuedActions.shift());
      stepPlayerState(dt);
      stepAbilityCooldowns(dt);
      processShipBuildQueues();
      stepBotAI(dt);
      citySimApi.stepCities(dt);
      if ((state._frameCtr % 15) === 0) {
        for (const player of state.players.values()) rebuildTurrets(player);
      }
      SQUADLOGIC.syncSquadsFromState(state);
      FrontPlanner.step(state, dt, { squadLogic: SQUADLOGIC, getFormationOffsets });
      SQUADLOGIC.buildEngagementZones(state, getCombatHelpers());
      SQUADLOGIC.updateSquadCombatState(state, getCombatHelpers());
      SQUADLOGIC.updateCombat(state, dt, getCombatHelpers());
      SQUADLOGIC.updateResumeOrders(state, dt, getCombatHelpers());
      stepUnits(dt);
      stepCombat(dt);
      for (const unit of state.units.values()) {
        if (unit && unit._formationRebuildAt != null && state.t >= unit._formationRebuildAt && unit.squadId != null) {
          unit._formationRebuildAt = undefined;
          SQUADLOGIC.requestFormationRecalc(state, unit.squadId, false);
          if (typeof SQUADLOGIC.recalculateFormation === "function") {
            SQUADLOGIC.recalculateFormation(state, unit.squadId, { getFormationOffsets }, false);
          }
        }
      }
      stepTurrets(dt);
      stepPatrols(dt);
      stepBullets(dt);
      stepMines(dt);
      stepAbilityStorms();
      stepAbilityZoneEffects(dt);
      stepMeteors(dt);
      stepOrbitalStrikes();
      stepThermoNukes(dt);
      if (enableLaneFighterWaves) stepLaneFighterWaves();
      stepBlackHoles(dt);
      stepLoanDebts();
      stepEconomyAbilityFx();
      stepPirateBaseBehavior(dt);
      stepRandomEvents();
      cleanupDestroyed();
      citySimApi.rebuildZoneGrid();
      broadcastSnapshot();
    } catch (err) {
      console.error("[AUTH-RUNTIME] tick error (room=" + roomId + " t=" + (state.t || 0).toFixed(2) + "):", err);
    }
  }

  return {
    roomId,
    seed,
    state,
    slotToPid,
    start() {
      if (tickTimer != null) return;
      try {
        broadcastSnapshot();
      } catch (err) {
        console.error("[AUTH-RUNTIME] start error (room=" + roomId + "):", err);
      }
      tickTimer = setInterval(tick, TICK_MS);
    },
    stop() {
      if (tickTimer != null) clearInterval(tickTimer);
      tickTimer = null;
    },
    enqueueAction(action) {
      queuedActions.push(action && typeof action === "object" ? { ...action } : { type: "invalid" });
    },
    tick,
    broadcastSnapshot
  };
}

module.exports = {
  createAuthoritativeMatchRuntime
};
