const NET = require("./net");
const UTILS = require("./utils");
const NOISE = require("./noise");
const SharedSimState = require("./shared-sim-state");
const SharedCitySim = require("./shared-city-sim");
const SharedMatchBootstrap = require("./shared-match-bootstrap");
const SQUADLOGIC = require("./squad-logic");
const CardSystem = require("./card-system");
const GravAnchorAbility = require("./grav-anchor-ability");
const balance = require("./shared/balance.json");
const { createSharedGameConfig } = require("./shared-game-config");

const TICK_MS = 1000 / 30;
const FULL_SYNC_EVERY = 15;
const CORE_ROSTER_UNIT_TYPES = new Set(["destroyer", "cruiser", "battleship"]);
const UNIT_TYPES = balance.unitTypes || {};
const UNIT_CAPS = { fighter: 300, destroyer: 100, cruiser: 50, battleship: 10, hyperDestroyer: 10 };
const STORM_DMG_INTERVAL = 0.5;
const ION_NEBULA_DURATION_SEC = 10;
const METEOR_RADIUS = 11;
const METEOR_AOE_RADIUS = 120;
const METEOR_IMPACT_DURATION = 1.85;
const TIME_JUMP_REWIND_SEC = 60;
const TIME_SNAPSHOT_INTERVAL = 5;
const TIME_SNAPSHOT_HISTORY_SEC = 75;

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

function cloneDeep(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  throw new Error("structuredClone is required for authoritative match runtime");
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

function getMeteorSpeed(CFG) {
  return Math.hypot(CFG.WORLD_W, CFG.WORLD_H) / 11;
}

function createAuthoritativeMatchRuntime(options) {
  const opts = options || {};
  const io = opts.io;
  const roomId = opts.roomId;
  const seed = Number.isFinite(opts.seed) ? opts.seed : (Date.now() >>> 0);
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
  state._timeSnapshots = [];
  state._nextAbilityMineId = 1;

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
    getActiveGrowthBonusPerMin: () => 0,
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
  const centerX = [...state.players.values()].reduce((sum, player) => sum + player.x, 0) / Math.max(1, state.players.size);
  const centerY = [...state.players.values()].reduce((sum, player) => sum + player.y, 0) / Math.max(1, state.players.size);
  state.centerObjectives.centerX = centerX || CFG.WORLD_W * 0.5;
  state.centerObjectives.centerY = centerY || CFG.WORLD_H * 0.5;
  citySimApi.rebuildZoneGrid();

  let tickTimer = null;
  const queuedActions = [];

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
      shieldRadius: (player) => shieldRadius(player, CFG),
      getPlanetRadius: (player) => getPlanetRadius(player, CFG),
      getCoreCollisionRadius: (player) => getCoreCollisionRadius(player, CFG)
    };
  }

  function getAutoFrontSpecs(ownerId) {
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
    const executeAt = Math.max(now, queue.lastQueuedAt || now) + 1.0;
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
      autoGroupUntil: state.t + 3,
      allowAutoJoinRecentSpawn: !!(opts && opts.allowAutoJoinRecentSpawn),
      order: { type: "move", waypoints: cloneWaypoints(unit.waypoints), holdPoint: null }
    });
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
      const out = spawnPurchasedSquad(ownerId, unitTypeKey, [spawnPoint], options || null);
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
    const quote = getUnitPurchaseQuote(ownerId, unitTypeKey, 3, 1);
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
      ? { duration: 7, radius: 220, previewRadius: 220, pullBlend: 0.09 }
      : { duration: 20, radius: 420, previewRadius: 420, pullBlend: 0.065 };
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
        duration: large ? 22 : 15,
        armedAt: state.t + 0.65,
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
      duration: 0.55,
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
          unit._anchorStasisUntil = state.t + 0.6;
          unit._cryoSlowUntil = state.t + 0.6;
          unit._cryoSlowAmount = 1;
          if (unit.squadId != null) {
            SQUADLOGIC.clearCombatForSquad(state, unit.squadId, true);
            const squad = state.squads.get(unit.squadId);
            if (squad) squad._zoneImmunityUntil = state.t + 0.6;
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
    const dist = Math.hypot(CFG.WORLD_W, CFG.WORLD_H);
    const speed = opts2.speed || getMeteorSpeed(CFG);
    const startX = targetX - cosA * dist;
    const startY = targetY - sinA * dist;
    state._activeMeteors.push({
      x: startX,
      y: startY,
      targetX,
      targetY,
      vx: cosA * speed,
      vy: sinA * speed,
      angle: angle || 0,
      radius: opts2.radius || METEOR_RADIUS,
      aoeR: opts2.aoeR || METEOR_AOE_RADIUS,
      ownerId,
      alive: true,
      spawnedAt: state.t,
      impactDuration: METEOR_IMPACT_DURATION,
      styleKey: opts2.styleKey || "signal-bloom",
      visualScale: opts2.visualScale || 1.0,
      seed: opts2.seed != null ? opts2.seed : (((Math.round(targetX * 10) * 73856093) ^ (Math.round(targetY * 10) * 19349663)) >>> 0)
    });
  }

  function spawnMeteorSwarm(targetX, targetY, angle, ownerId) {
    const baseAngle = angle || 0;
    const count = 6;
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.08;
      const radial = i * 24;
      spawnMeteor(
        targetX + Math.cos(baseAngle + Math.PI / 2) * radial,
        targetY + Math.sin(baseAngle + Math.PI / 2) * radial,
        baseAngle + spread,
        ownerId,
        { aoeR: METEOR_AOE_RADIUS, styleKey: "signal-bloom" }
      );
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
    const barrage = abilityId === "orbitalBarrage";
    const salvoCount = barrage ? 6 : 2;
    const shotsPerSalvo = 5;
    const radius = barrage ? 320 : 250;
    const damageBase = barrage ? 260 : 340;
    const damageMaxHpPct = barrage ? 0.10 : 0.15;
    const owner = state.players.get(ownerId);
    const coreX = owner ? owner.x : zoneX;
    const coreY = owner ? owner.y : zoneY - 220;
    const shots = [];
    for (let salvoIndex = 0; salvoIndex < salvoCount; salvoIndex++) {
      for (let shotIndex = 0; shotIndex < shotsPerSalvo; shotIndex++) {
        const ang = ((salvoIndex * shotsPerSalvo + shotIndex) / Math.max(1, salvoCount * shotsPerSalvo)) * Math.PI * 2;
        const dist = shotIndex === 0 ? 0 : radius * (0.2 + ((shotIndex % 3) * 0.22));
        const tx = zoneX + Math.cos(ang) * dist;
        const ty = zoneY + Math.sin(ang) * dist;
        const launchAt = salvoIndex * 0.5 + shotIndex * 0.08;
        const flightDuration = 0.8 + (shotIndex % 3) * 0.05;
        shots.push({
          salvoIndex,
          shotIndex,
          seed: ((salvoIndex + 1) * 101 + shotIndex * 17 + ownerId) >>> 0,
          primary: shotIndex === 0,
          sx: coreX,
          sy: coreY,
          tx,
          ty,
          radius: barrage ? 110 : 130,
          launchAt,
          arriveAt: launchAt + flightDuration,
          impactAt: launchAt + flightDuration,
          fadeDuration: 0.5,
          resolved: false
        });
      }
    }
    state._orbitalStrikes.push({
      x: zoneX,
      y: zoneY,
      radius,
      abilityId,
      ownerId,
      spawnedAt: state.t,
      duration: (salvoCount - 1) * 0.5 + 2.4,
      damageBase,
      damageMaxHpPct,
      seed: ((Math.round(zoneX * 10) * 73856093) ^ (Math.round(zoneY * 10) * 19349663) ^ ownerId) >>> 0,
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
    const dx = targetX - originX;
    const dy = targetY - originY;
    const distance = Math.hypot(dx, dy) || 1;
    const dirX = dx / distance;
    const dirY = dy / distance;
    const flightDuration = 3.2;
    const speed = distance / flightDuration;
    state._thermoNukes.push({
      ownerId,
      spawnedAt: state.t,
      duration: 7.2,
      seed: ((Math.round(targetX * 10) * 73856093) ^ (Math.round(targetY * 10) * 19349663) ^ ownerId) >>> 0,
      x: originX,
      y: originY,
      originX,
      originY,
      startX: originX,
      startY: originY,
      targetX,
      targetY,
      dirX,
      dirY,
      vx: dirX * speed,
      vy: dirY * speed,
      distance,
      flightDuration,
      impactAt: flightDuration,
      impactFadeDuration: 2.6,
      previewRadius: 500,
      impactRadius: 500,
      styleKey: "thermo-nuke",
      resolved: false
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

  function saveTimeSnapshot() {
    if (state.t < TIME_SNAPSHOT_INTERVAL) return;
    const snapshots = state._timeSnapshots;
    const last = snapshots.length ? snapshots[snapshots.length - 1] : null;
    if (last && state.t - last.t < TIME_SNAPSHOT_INTERVAL) return;
    const snapshotState = {};
    for (const key of Object.keys(state)) {
      if (key === "_timeSnapshots") continue;
      snapshotState[key] = cloneDeep(state[key]);
    }
    snapshots.push({ t: state.t, state: snapshotState });
    while (snapshots.length && state.t - snapshots[0].t > TIME_SNAPSHOT_HISTORY_SEC) snapshots.shift();
  }

  function restoreTimeSnapshot(snapshot) {
    if (!snapshot || !snapshot.state) return false;
    const keepSnapshots = (state._timeSnapshots || []).filter((entry) => entry.t <= snapshot.t);
    for (const key of Object.keys(state)) {
      if (key === "_timeSnapshots") continue;
      delete state[key];
    }
    const cloned = cloneDeep(snapshot.state);
    for (const key of Object.keys(cloned)) {
      state[key] = cloned[key];
    }
    state._timeSnapshots = keepSnapshots;
    state._authorityMode = "server";
    state._multiIsHost = true;
    state._runsAuthoritativeSim = true;
    state._multiSlots = rawSlots;
    state._slotToPid = slotToPid;
    serializer._prev.clear();
    serializer.tickCount = FULL_SYNC_EVERY - 1;
    return true;
  }

  function stepUnits(dt) {
    const movementCfg = balance.movement || {};
    const waypointRadius = movementCfg.waypointRadius || 28;
    const helpers = getCombatHelpers();
    for (const unit of state.units.values()) {
      if (!unit || unit.hp <= 0) continue;
      const owner = state.players.get(unit.owner);
      if (!owner || owner.eliminated) continue;
      if (unit._anchorStasisUntil && state.t < unit._anchorStasisUntil) {
        unit.vx = 0;
        unit.vy = 0;
        continue;
      }
      if (unit._fireDotUntil && state.t < unit._fireDotUntil && unit._fireDotDps) {
        applyUnitDamage(unit, unit._fireDotDps * dt, null, unit.lastDamagedBy || null);
      }
      if (unit.regenPerSec) unit.hp = Math.min(unit.maxHp || unit.hp, unit.hp + unit.regenPerSec * dt);
      let desired = SQUADLOGIC.getUnitMovementTarget(unit, state, helpers);
      if (unit._blackHolePullUntil && state.t < unit._blackHolePullUntil) {
        desired = {
          tx: unit._blackHolePullX != null ? unit._blackHolePullX : unit.x,
          ty: unit._blackHolePullY != null ? unit._blackHolePullY : unit.y,
          moveMode: "blackhole_pull"
        };
      }
      const dx = (desired.tx || unit.x) - unit.x;
      const dy = (desired.ty || unit.y) - unit.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 1) {
        unit.vx = 0;
        unit.vy = 0;
        continue;
      }
      let speed = getUnitBaseSpeed(unit) * getPlayerUnitSpeedMul(owner);
      if (state._fleetBoostUntil[unit.owner] && state._fleetBoostUntil[unit.owner] > state.t) speed *= 1.5;
      if (state._battleMarchUntil[unit.owner] && state._battleMarchUntil[unit.owner] > state.t) speed *= 1.3;
      if (unit._cryoSlowUntil && state.t < unit._cryoSlowUntil) speed *= Math.max(0.2, 1 - (unit._cryoSlowAmount || 0.4));
      if (desired.moveMode === "blackhole_pull" && unit._blackHolePullSpeed) speed = Math.max(speed, unit._blackHolePullSpeed);
      const moveDist = Math.min(speed * dt, dist);
      const nx = dx / Math.max(1e-6, dist);
      const ny = dy / Math.max(1e-6, dist);
      unit.x += nx * moveDist;
      unit.y += ny * moveDist;
      unit.vx = nx * speed;
      unit.vy = ny * speed;
      unit._lastFacingAngle = Math.atan2(ny, nx);
      if (dist <= waypointRadius && Array.isArray(unit.waypoints) && unit.waypointIndex < unit.waypoints.length) {
        unit.waypointIndex += 1;
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
      if (!owner || owner.eliminated) continue;
      unit.atkCd = Math.max(0, (unit.atkCd || 0) - dt);
      if (unit.atkCd > 0) continue;
      const plan = SQUADLOGIC.getUnitFirePlan(unit, state, helpers);
      if (!plan || plan.type === "none") continue;
      const damage = Math.max(1, (unit.baseDamage || unit.dmg || 0) * getPlayerDamageMul(owner));
      const attackRate = Math.max(0.05, (unit.baseAttackRate || 0.2) * getPlayerAttackRateMul(owner));
      if (plan.type === "units") {
        for (const target of plan.targets || []) {
          if (!target || target.owner === unit.owner || target.hp <= 0) continue;
          applyUnitDamage(target, damage, unit.id, unit.owner);
          if (owner.attackEffect === "cryo") {
            target._cryoSlowUntil = Math.max(target._cryoSlowUntil || 0, state.t + (balance.cryoEffect?.duration || 2));
            target._cryoSlowAmount = balance.cryoEffect?.slowPercent || 0.4;
          }
          if (owner.attackEffect === "fire") {
            target._fireDotUntil = Math.max(target._fireDotUntil || 0, state.t + (balance.fireEffect?.duration || 3));
            target._fireDotDps = Math.max(target._fireDotDps || 0, balance.fireEffect?.dotDamagePerSec || 3);
          }
        }
      } else if (plan.type === "city" && plan.city) {
        applyCityDamage(plan.city, damage, unit.owner);
      } else if (plan.type === "turret" && plan.turret) {
        plan.turret.hp = Math.max(0, (plan.turret.hp || 0) - damage);
      }
      unit.atkCd = 1 / attackRate;
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
        unit._blackHolePullUntil = state.t + 0.18;
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
      if (owner) owner.deadUnits = (owner.deadUnits || 0) + 1;
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
      duration: 4.35,
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
      duration: 4.44,
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
      state._fleetBoostUntil[action.pid] = state.t + 20;
      applyAbilitySuccess(action.pid, abilityId);
      return true;
    }
    if (abilityId === "gloriousBattleMarch") {
      state._battleMarchUntil[action.pid] = state.t + 30;
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
    if (abilityId === "droneSwarm") {
      const out = spawnLaneAbilityUnits(action.pid, action.frontType || "center", "fighter", 6, {
        sourceTag: "ability:fighterWing:" + (action.frontType || "center"),
        spread: 24,
        forwardStep: 8,
        allowAutoJoinRecentSpawn: true,
        mutateUnit: (unit) => {
          unit._fighterWingSummon = true;
          unit.hp = Math.round(unit.hp * 0.72);
          unit.maxHp = unit.hp;
          unit.baseMaxHp = Math.max(1, unit.hp);
          unit.dmg = Math.max(1, Math.round((unit.dmg || 1) * 1.12));
          unit.baseDamage = unit.dmg;
        }
      });
      if (out.ok) applyAbilitySuccess(action.pid, abilityId);
      return out.ok;
    }
    if (abilityId === "frigateWarp") {
      const out = spawnLaneAbilityUnits(action.pid, action.frontType || "center", "destroyer", 1, {
        sourceTag: "ability:frigateWarp:" + (action.frontType || "center"),
        allowAutoJoinRecentSpawn: true,
        mutateUnit: (unit) => {
          unit._frigateSummon = true;
          unit.hp = Math.round((unit.hp || 1) * 1.6);
          unit.maxHp = unit.hp;
          unit.baseMaxHp = unit.hp;
          unit.dmg = Math.max(1, Math.round((unit.dmg || 1) * 1.35));
          unit.baseDamage = unit.dmg;
          unit.attackRange = Math.round((unit.attackRange || 1) * 1.12);
          unit.baseAttackRange = unit.attackRange;
          unit.speed = (unit.speed || 1) * 1.18;
          unit.baseSpeed = unit.speed;
        }
      });
      if (out.ok) applyAbilitySuccess(action.pid, abilityId);
      return out.ok;
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
      state._loanDebts.push({ pid: action.pid, deductAt: state.t + 180, amount: 7500 });
      applyAbilitySuccess(action.pid, abilityId);
      return true;
    }
    if (abilityId === "timeJump") {
      const targetT = Math.max(0, state.t - TIME_JUMP_REWIND_SEC);
      let snap = null;
      for (let i = state._timeSnapshots.length - 1; i >= 0; i--) {
        if (state._timeSnapshots[i].t <= targetT) {
          snap = state._timeSnapshots[i];
          break;
        }
      }
      const ok = restoreTimeSnapshot(snap);
      if (ok) applyAbilitySuccess(action.pid, abilityId);
      return ok;
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
      for (const squadId of squadIds) SQUADLOGIC.issueMoveOrder(state, squadId, waypoints, action.angle, action.commandQueue);
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
      for (const squadId of squadIds) SQUADLOGIC.setSquadFocusTarget(state, squadId, action.targetUnitId);
      return;
    }
    if (action.type === "formation") {
      const squadIds = getOwnedSquadIdsFromLeaderIds(action, senderPid);
      for (const squadId of squadIds) {
        SQUADLOGIC.setSquadFormation(state, squadId, action.formationType || "line", action.formationRows || 1, action.formationPigWidth || 1);
        SQUADLOGIC.requestFormationRecalc(state, squadId, true);
      }
      return;
    }
    if (action.type === "mergeSquad") {
      const ownedSquadIds = Array.isArray(action.squadIds)
        ? action.squadIds.filter((id) => state.squads.get(id)?.ownerId === senderPid)
        : [];
      if (ownedSquadIds.length >= 2) {
        SQUADLOGIC.mergeSquads(state, ownedSquadIds, action.formationType || "line", action.formationRows || 1, action.formationPigWidth || 1);
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
      if (result && result.ok) recomputeBuffDerivedStats(player);
      return;
    }
    if (action.type === "castAbilityCard") {
      const player = state.players.get(senderPid);
      if (!player) return;
      const result = CardSystem.consumeAbilityCard(player, action.instanceId);
      if (!result || !result.ok || !result.cardDef) return;
      executeAbilityAction({ ...action, pid: senderPid, abilityId: result.cardDef.abilityId || action.abilityId });
    }
  }

  function broadcastSnapshot() {
    if (!io || !roomId) return;
    const snap = serializer.serialize(state);
    io.to(roomId).emit("gameState", snap);
  }

  function tick() {
    const dt = TICK_MS / 1000;
    state.t += dt;
    state._frameCtr = (state._frameCtr || 0) + 1;
    while (queuedActions.length > 0) handlePlayerAction(queuedActions.shift());
    stepPlayerState(dt);
    stepAbilityCooldowns(dt);
    processShipBuildQueues();
    citySimApi.stepCities(dt);
    SQUADLOGIC.step(state, dt, getCombatHelpers());
    stepUnits(dt);
    stepCombat(dt);
    stepAbilityStorms();
    stepAbilityZoneEffects(dt);
    stepMeteors(dt);
    stepOrbitalStrikes();
    stepThermoNukes(dt);
    stepBlackHoles(dt);
    stepLoanDebts();
    stepEconomyAbilityFx();
    cleanupDestroyed();
    citySimApi.rebuildZoneGrid();
    saveTimeSnapshot();
    broadcastSnapshot();
  }

  return {
    roomId,
    seed,
    state,
    slotToPid,
    start() {
      if (tickTimer != null) return;
      saveTimeSnapshot();
      broadcastSnapshot();
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
