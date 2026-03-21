/**
 * Squad Logic — Single Source of Truth for Combat + Formations
 *
 * Owns: squad registry, engagement zones, combat mode transitions,
 * order buffering, formation recalc scheduling, per-unit movement targets.
 *
 * Calls FORMATIONS for pure geometry offsets.
 * Calls COMBAT.pickTarget for engaged-mode free-chase targets.
 */
(function () {
  "use strict";

  const DEFAULT_CFG = {
    engageRangeFactor: 0.95,
    zoneJoinPadding: 80,
    disengageDelay: 0.6,
    formationRecalcCooldown: 2.0,
    spawnAutoGroupWindow: 3.0,
    waypointReachRadius: 28,
    mineCaptureDoneRadius: 55,
    autoJoinDistanceThreshold: 300,
    routeJoinDistanceThreshold: 720,
    zoneMergeOverlap: 0.5,
    facingLerpSpeed: 3.0,
    steeringPush: 0.6,
    steeringRadius: 40
  };

  const SIDE_LANE_HALF_WIDTH = 130;
  const CENTER_LANE_HALF_WIDTH = 162;

  let config = { ...DEFAULT_CFG };

  function loadConfig(balanceObj) {
    if (!balanceObj) return;
    const c = balanceObj.combat || {};
    const f = balanceObj.formations || {};
    if (c.engageRangeFactor != null) config.engageRangeFactor = c.engageRangeFactor;
    if (c.zoneJoinRadiusPadding != null) config.zoneJoinPadding = c.zoneJoinRadiusPadding;
    if (c.disengageDelay != null) config.disengageDelay = c.disengageDelay;
    if (f.formationCooldown != null) config.formationRecalcCooldown = Math.max(1.0, f.formationCooldown);
    if (f.facingLerpSpeed != null) config.facingLerpSpeed = f.facingLerpSpeed;
    if (f.steeringPush != null) config.steeringPush = f.steeringPush;
    if (f.steeringRadius != null) config.steeringRadius = f.steeringRadius;
  }

  // ─── Utilities ────────────────────────────────────────────────────

  function d(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

  function clonePoint(p) { return p ? { x: p.x, y: p.y } : null; }

  function getOrderWaypointReachRadius(order) {
    const base = config.waypointReachRadius || 28;
    if (order && order.strictLaneApproach) {
      return Math.max(base, Math.min(84, SIDE_LANE_HALF_WIDTH * 0.55));
    }
    return base;
  }

  function cloneWaypoints(wp) {
    return Array.isArray(wp) ? wp.map(clonePoint).filter(Boolean) : [];
  }

  function cloneCaptureQueue(queue) {
    return Array.isArray(queue)
      ? queue.map((entry) => ({
          mineId: entry?.mineId ?? null,
          point: clonePoint(entry?.point)
        })).filter((entry) => entry.mineId != null && entry.point)
      : [];
  }

  function cloneQueuedOrder(order) {
    if (!order) return null;
    return {
      type: order.type || "idle",
      waypoints: cloneWaypoints(order.waypoints),
      holdPoint: clonePoint(order.holdPoint),
      laneHoldPoint: clonePoint(order.laneHoldPoint),
      targetUnitId: order.targetUnitId,
      targetCityId: order.targetCityId,
      targetPirateBase: !!order.targetPirateBase,
      mineId: order.mineId,
      captureQueue: cloneCaptureQueue(order.captureQueue),
      commandQueue: [],
      angle: order.angle,
      suppressPathPreview: !!order.suppressPathPreview,
      strictLaneApproach: !!order.strictLaneApproach
    };
  }

  function cloneCommandQueue(queue) {
    return Array.isArray(queue) ? queue.map(cloneQueuedOrder).filter(Boolean) : [];
  }

  function cloneOrder(order) {
    const out = cloneQueuedOrder(order);
    if (!out) return null;
    out.commandQueue = cloneCommandQueue(order.commandQueue);
    return out;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function isFrontLaneTag(tag) {
    return typeof tag === "string" && tag.startsWith("front:");
  }

  function buildCaptureQueueOrders(captureQueue) {
    return cloneCaptureQueue(captureQueue).map((entry) => ({
      type: "capture",
      mineId: entry.mineId,
      waypoints: entry.point ? [clonePoint(entry.point)] : [],
      holdPoint: null,
      targetUnitId: null,
      targetCityId: null,
      targetPirateBase: false,
      captureQueue: [],
      commandQueue: [],
      angle: null,
      suppressPathPreview: false
    }));
  }

  function getNextQueuedOrder(order) {
    const queue = cloneCommandQueue(order?.commandQueue);
    if (!queue.length) return null;
    const next = queue.shift();
    next.commandQueue = queue;
    return next;
  }

  function ensureRuntime(state) {
    if (!state.squads) state.squads = new Map();
    if (!state.engagementZones) state.engagementZones = new Map();
    if (!state._zoneBySquadId) state._zoneBySquadId = new Map();
    if (state.nextSquadId == null) state.nextSquadId = 1;
    if (state.nextEngagementZoneId == null) state.nextEngagementZoneId = 1;
  }

  // ─── Squad Queries ────────────────────────────────────────────────

  function getUnit(state, id) { return id == null ? null : state.units.get(id); }

  function getSquadUnits(state, squadOrId) {
    ensureRuntime(state);
    const sq = typeof squadOrId === "object" ? squadOrId : state.squads.get(squadOrId);
    if (!sq) return [];
    const out = [];
    for (const uid of sq.unitIds) {
      const u = state.units.get(uid);
      if (u && u.hp > 0) out.push(u);
    }
    return out;
  }

  function getLeader(state, squadOrId) {
    const sq = typeof squadOrId === "object" ? squadOrId : state.squads.get(squadOrId);
    if (!sq) return null;
    return getUnit(state, sq.leaderUnitId);
  }

  function getSquadCenter(state, squadOrId) {
    const units = getSquadUnits(state, squadOrId);
    if (!units.length) return { x: 0, y: 0 };
    let x = 0, y = 0;
    for (const u of units) { x += u.x; y += u.y; }
    return { x: x / units.length, y: y / units.length };
  }

  function getSquadList(state) { ensureRuntime(state); return [...state.squads.values()]; }
  function getZoneList(state) { ensureRuntime(state); return [...state.engagementZones.values()]; }

  function getAvgAttackRange(units, helpers) {
    if (!units.length) return 60;
    let t = 0;
    for (const u of units) t += helpers.getUnitAtkRange ? helpers.getUnitAtkRange(u) : (u.attackRange || 60);
    return t / units.length;
  }

  function getSquadEngagementRadius(state, squad, helpers) {
    const units = getSquadUnits(state, squad);
    if (!units.length) return 0;
    let mx = 0;
    for (const u of units) {
      const r = (helpers.getUnitAtkRange ? helpers.getUnitAtkRange(u) : (u.attackRange || 60)) * config.engageRangeFactor;
      if (r > mx) mx = r;
    }
    return mx;
  }

  function getZoneJoinRadius(state, zone, helpers) {
    return (zone.displayRadius || zone.radius || 70) + 20;
  }

  // ─── Squad CRUD ───────────────────────────────────────────────────

  function normalizeFormation(f) {
    return {
      type: f?.type || "line",
      rows: Math.max(1, f?.rows ?? 3),
      width: f?.width ?? 1,
      facing: f?.facing ?? 0,
      targetFacing: f?.targetFacing ?? (f?.facing ?? 0),
      slotAssignments: Array.isArray(f?.slotAssignments) ? f.slotAssignments.slice() : [],
      dirty: f?.dirty !== false,
      dirtyAt: f?.dirtyAt ?? 0,
      lastRecalcAt: f?.lastRecalcAt ?? -Infinity
    };
  }

  function normalizeCombat(c) {
    return {
      mode: c?.mode || "idle",
      zoneId: c?.zoneId ?? null,
      queuedOrder: cloneOrder(c?.queuedOrder),
      resumeOrder: cloneOrder(c?.resumeOrder),
      focusTargetUnitId: c?.focusTargetUnitId,
      combatTargetSquadId: c?.combatTargetSquadId ?? null,
      _pendingResume: !!c?._pendingResume,
      _disengageTimer: c?._disengageTimer ?? null,
      lastContactAt: c?.lastContactAt ?? null
    };
  }

  function buildDefaultOrder(leader) {
    if (!leader) return { type: "idle", waypoints: [] };
    if (leader._orderType === "attackPirateBase") {
      return { type: "attackPirateBase", waypoints: cloneWaypoints(leader.waypoints), targetPirateBase: true, suppressPathPreview: true };
    }
    if (leader.chaseTargetCityId != null) {
      return { type: "siege", waypoints: cloneWaypoints(leader.waypoints), targetCityId: leader.chaseTargetCityId, suppressPathPreview: true };
    }
    if (leader.chaseTargetUnitId != null) {
      return { type: "attackUnit", waypoints: cloneWaypoints(leader.waypoints), targetUnitId: leader.chaseTargetUnitId, suppressPathPreview: true };
    }
    return { type: leader._captureTarget ? "capture" : "move", waypoints: cloneWaypoints(leader.waypoints), suppressPathPreview: false };
  }

  function pickLeaderUnitId(state, squad) {
    const units = getSquadUnits(state, squad);
    if (!units.length) return null;
    const c = getSquadCenter(state, squad);
    units.sort((a, b) => d(a.x, a.y, c.x, c.y) - d(b.x, b.y, c.x, c.y) || a.id - b.id);
    return units[0].id;
  }

  function applyCompatibility(state, squad) {
    const leader = getLeader(state, squad);
    if (!leader) return;
    const order = squad.order || { type: "idle", waypoints: [] };
    const wp = cloneWaypoints(order.waypoints);
    leader.squadId = squad.id;
    leader.leaderId = null;
    leader.formationType = squad.formation.type;
    leader.formationRows = squad.formation.rows;
    leader.formationPigWidth = squad.formation.width;
    leader._formationAngle = squad.formation.facing;
    leader.waypoints = wp;
    leader.waypointIndex = Math.min(leader.waypointIndex ?? 0, Math.max(0, wp.length - 1));
    leader.chaseTargetUnitId = order.type === "attackUnit" ? order.targetUnitId : undefined;
    leader.chaseTargetCityId = order.type === "siege" ? order.targetCityId : undefined;
    leader._captureTarget = order.type === "capture" ? true : undefined;

    for (const uid of squad.unitIds) {
      const u = state.units.get(uid);
      if (!u) continue;
      u.squadId = squad.id;
      u.leaderId = u.id === leader.id ? null : leader.id;
      u._orderType = order.type;
      u.waypoints = wp;
      u.waypointIndex = leader.waypointIndex ?? 0;
      u.chaseTargetUnitId = undefined;
      u.chaseTargetCityId = undefined;
      if (u.id !== leader.id) u._captureTarget = order.type === "capture" ? true : undefined;
    }
  }

  function createSquad(state, unitIds, opts = {}) {
    ensureRuntime(state);
    const filtered = unitIds.filter((id) => state.units.has(id));
    if (!filtered.length) return null;
    const leaderUnitId = opts.leaderUnitId && filtered.includes(opts.leaderUnitId) ? opts.leaderUnitId : filtered[0];
    const leader = state.units.get(leaderUnitId);
    const squadId = opts.id ?? state.nextSquadId++;
    const center = getSquadCenter(state, { unitIds: filtered });
    const facing = leader?._formationAngle ?? leader?._lastFacingAngle ?? 0;

    const squad = {
      id: squadId,
      ownerId: leader?.owner ?? opts.ownerId ?? 0,
      leaderUnitId,
      unitIds: filtered.slice(),
      order: cloneOrder(opts.order || buildDefaultOrder(leader)),
      formation: normalizeFormation({
        type: opts.formationType || leader?.formationType || "line",
        rows: opts.formationRows ?? leader?.formationRows ?? 3,
        width: opts.formationWidth ?? leader?.formationPigWidth ?? 1,
        facing,
        dirty: true,
        dirtyAt: state.t ?? 0
      }),
      combat: normalizeCombat(opts.combat),
      createdAt: opts.createdAt ?? state.t ?? 0,
      autoGroupUntil: opts.autoGroupUntil ?? null,
      sourceTag: opts.sourceTag || null,
      anchor: { x: center.x, y: center.y }
    };

    state.squads.set(squadId, squad);

    if (opts.allowAutoJoinRecentSpawn && !isFrontLaneTag(opts.sourceTag)) {
      const merged = tryAutoJoin(state, squad);
      if (merged) return merged;
    }

    applyCompatibility(state, squad);
    return squad;
  }

  function areOrdersCompatible(a, b) {
    const oA = a?.order || {}, oB = b?.order || {};
    if ((oA.type || "idle") !== (oB.type || "idle")) return false;
    if ((oA.targetCityId ?? null) !== (oB.targetCityId ?? null)) return false;
    if ((oA.targetUnitId ?? null) !== (oB.targetUnitId ?? null)) return false;
    const pA = oA.waypoints?.[0] || oA.holdPoint, pB = oB.waypoints?.[0] || oB.holdPoint;
    if (!pA && !pB) return true;
    if (!pA || !pB) return false;
    return d(pA.x, pA.y, pB.x, pB.y) <= config.autoJoinDistanceThreshold;
  }

  function absorbSquad(state, target, source) {
    if (!target || !source || target.id === source.id) return target;
    for (const uid of source.unitIds) {
      if (!target.unitIds.includes(uid)) target.unitIds.push(uid);
      const u = state.units.get(uid);
      if (u) { u.squadId = target.id; u.leaderId = uid === target.leaderUnitId ? null : target.leaderUnitId; }
    }
    target.autoGroupUntil = Math.max(target.autoGroupUntil ?? 0, source.autoGroupUntil ?? 0, (state.t ?? 0) + config.spawnAutoGroupWindow);
    target.createdAt = Math.min(target.createdAt ?? state.t ?? 0, source.createdAt ?? state.t ?? 0);
    target.formation.dirty = true;
    target.formation.dirtyAt = state.t ?? 0;
    state.squads.delete(source.id);
    applyCompatibility(state, target);
    return target;
  }

  function tryAutoJoin(state, squad) {
    if (!squad || !squad.sourceTag) return null;
    const now = state.t ?? 0;
    let best = null;
    for (const other of state.squads.values()) {
      if (other.id === squad.id || other.ownerId !== squad.ownerId) continue;
      if (other.sourceTag !== squad.sourceTag) continue;
      if (other.combat.mode !== "idle") continue;
      if (!areOrdersCompatible(other, squad)) continue;
      const recentJoin = (other.autoGroupUntil ?? -Infinity) >= now;
      if (!recentJoin) {
        const frontLaneTag = typeof squad.sourceTag === "string" && squad.sourceTag.startsWith("front:");
        if (!frontLaneTag) continue;
        const otherCenter = getSquadCenter(state, other);
        const squadCenter = getSquadCenter(state, squad);
        if (d(otherCenter.x, otherCenter.y, squadCenter.x, squadCenter.y) > config.routeJoinDistanceThreshold) continue;
      }
      if (!best || (other.createdAt ?? 0) < (best.createdAt ?? 0)) best = other;
    }
    if (!best) return null;
    return absorbSquad(state, best, squad);
  }

  function mergeRouteCompatibleSquads(state) {
    ensureRuntime(state);
    return false;
  }

  function destroySquad(state, squadId) {
    ensureRuntime(state);
    const sq = state.squads.get(squadId);
    if (!sq) return;
    for (const uid of sq.unitIds) {
      const u = state.units.get(uid);
      if (u) { u.squadId = undefined; u.leaderId = null; }
    }
    state.squads.delete(squadId);
  }

  function mergeSquads(state, squadIds, formationType, formationRows, formationWidth) {
    ensureRuntime(state);
    const units = [];
    for (const sid of squadIds) {
      const sq = state.squads.get(sid);
      if (!sq) continue;
      for (const uid of sq.unitIds) if (!units.includes(uid)) units.push(uid);
    }
    if (units.length < 2) return null;
    const first = state.squads.get(squadIds[0]);
    const ownerId = first?.ownerId ?? getUnit(state, units[0])?.owner ?? 0;
    for (const sid of squadIds) destroySquad(state, sid);
    return createSquad(state, units, {
      ownerId,
      formationType: formationType || "line",
      formationRows: formationRows ?? 3,
      formationWidth: formationWidth ?? 1,
      sourceTag: first?.sourceTag || null,
      order: { type: "idle", waypoints: [] }
    });
  }

  function splitSquadByType(state, squadId) {
    ensureRuntime(state);
    const sq = state.squads.get(squadId);
    if (!sq) return [];
    const byType = new Map();
    for (const u of getSquadUnits(state, sq)) {
      const key = u.unitType || "fighter";
      if (!byType.has(key)) byType.set(key, []);
      byType.get(key).push(u.id);
    }
    if (byType.size <= 1) return [sq];
    const existing = cloneOrder(sq.order);
    const form = { ...sq.formation };
    destroySquad(state, squadId);
    const out = [];
    for (const key of [...byType.keys()].sort()) {
      const ns = createSquad(state, byType.get(key), {
        formationType: form.type, formationRows: form.rows, formationWidth: form.width, sourceTag: sq.sourceTag || null, order: existing
      });
      if (ns) out.push(ns);
    }
    return out;
  }

  // ─── Orders ───────────────────────────────────────────────────────

  function isOrderLocked(squad) {
    if (!squad) return false;
    return squad.combat.mode !== "idle";
  }

  function summarizeOrder(order) {
    if (!order) return null;
    return {
      type: order.type || "idle",
      targetUnitId: order.targetUnitId ?? null,
      targetCityId: order.targetCityId ?? null,
      mineId: order.mineId ?? null,
      waypointCount: Array.isArray(order.waypoints) ? order.waypoints.length : 0,
      queuedCount: Array.isArray(order.commandQueue) ? order.commandQueue.length : 0,
      holdPoint: clonePoint(order.holdPoint)
    };
  }

  function getSquadDebugState(state, squadOrId) {
    const sq = typeof squadOrId === "object" ? squadOrId : state.squads.get(squadOrId);
    if (!sq) return null;
    return {
      squadId: sq.id,
      ownerId: sq.ownerId,
      mode: sq.combat.mode || "idle",
      inCombat: sq.combat.mode !== "idle",
      combatLocked: isOrderLocked(sq),
      combatZoneId: sq.combat.zoneId ?? null,
      queuedOrder: summarizeOrder(sq.combat.queuedOrder),
      resumeOrder: summarizeOrder(sq.combat.resumeOrder),
      combatTargetSquadId: sq.combat.combatTargetSquadId ?? null
    };
  }

  function queueIfLocked(state, squadId, order) {
    const sq = state.squads.get(squadId);
    if (!sq || !isOrderLocked(sq)) return null;
    sq.combat.queuedOrder = cloneOrder(order);
    return sq;
  }

  function setSquadOrder(state, squadId, order) {
    const sq = state.squads.get(squadId);
    if (!sq) return null;
    sq.order = cloneOrder(order) || { type: "idle", waypoints: [] };
    applyCompatibility(state, sq);
    return sq;
  }

  function clearCombatForSquad(state, squadId, preserveResume) {
    const sq = state.squads.get(squadId);
    if (!sq) return;
    const resume = preserveResume ? sq.combat.resumeOrder : null;
    sq.combat = normalizeCombat({ mode: "idle", resumeOrder: resume });
    for (const u of getSquadUnits(state, sq)) {
      u._combatState = "idle";
      u._currentTargetId = undefined;
      u._squadCombatPhase = null;
      u._engagementZoneId = null;
      u._engagementAnchorX = undefined;
      u._engagementAnchorY = undefined;
    }
  }

  function issueMoveOrder(state, squadId, waypoints, angle, commandQueue) {
    const order = {
      type: "move",
      waypoints,
      holdPoint: null,
      angle,
      commandQueue: cloneCommandQueue(commandQueue),
      suppressPathPreview: false
    };
    const queued = queueIfLocked(state, squadId, order);
    if (queued) return queued;
    clearCombatForSquad(state, squadId, false);
    const sq = setSquadOrder(state, squadId, order);
    if (!sq) return null;
    if (angle != null) { sq.formation.facing = angle; sq.formation.targetFacing = angle; }
    sq.formation.dirty = true;
    sq.formation.dirtyAt = state.t ?? 0;
    return sq;
  }

  function issueAttackUnitOrder(state, squadId, targetUnitId, waypoints, commandQueue) {
    const order = {
      type: "attackUnit",
      targetUnitId,
      waypoints: cloneWaypoints(waypoints),
      commandQueue: cloneCommandQueue(commandQueue),
      suppressPathPreview: true
    };
    const queued = queueIfLocked(state, squadId, order);
    if (queued) return queued;
    clearCombatForSquad(state, squadId, false);
    return setSquadOrder(state, squadId, order);
  }

  function issueSiegeOrder(state, squadId, targetCityId, waypoints, commandQueue, opts) {
    const order = {
      type: "siege",
      targetCityId,
      waypoints: cloneWaypoints(waypoints),
      commandQueue: cloneCommandQueue(commandQueue),
      suppressPathPreview: true,
      strictLaneApproach: !!opts?.strictLaneApproach,
      laneHoldPoint: clonePoint(opts?.laneHoldPoint)
    };
    const queued = queueIfLocked(state, squadId, order);
    if (queued) return queued;
    clearCombatForSquad(state, squadId, false);
    return setSquadOrder(state, squadId, order);
  }

  function issuePirateBaseOrder(state, squadId, waypoints, commandQueue) {
    const order = {
      type: "attackPirateBase",
      targetPirateBase: true,
      waypoints: cloneWaypoints(waypoints),
      commandQueue: cloneCommandQueue(commandQueue),
      suppressPathPreview: true
    };
    const queued = queueIfLocked(state, squadId, order);
    if (queued) return queued;
    clearCombatForSquad(state, squadId, false);
    return setSquadOrder(state, squadId, order);
  }

  function issueCaptureOrder(state, squadId, mineId, point, waypoints, captureQueue, commandQueue) {
    const wp = cloneWaypoints(waypoints != null ? waypoints : (point ? [point] : []));
    const legacyCaptureOrders = buildCaptureQueueOrders(captureQueue);
    const nextQueue = cloneCommandQueue(commandQueue);
    if (legacyCaptureOrders.length > 0) nextQueue.unshift(...legacyCaptureOrders);
    const order = {
      type: "capture",
      mineId,
      waypoints: wp,
      captureQueue: cloneCaptureQueue(captureQueue),
      commandQueue: nextQueue,
      suppressPathPreview: false
    };
    const queued = queueIfLocked(state, squadId, order);
    if (queued) return queued;
    clearCombatForSquad(state, squadId, false);
    return setSquadOrder(state, squadId, order);
  }

  function setSquadFocusTarget(state, squadId, targetUnitId) {
    const sq = state.squads.get(squadId);
    if (!sq) return null;
    sq.combat = normalizeCombat(sq.combat);
    sq.combat.focusTargetUnitId = targetUnitId != null ? targetUnitId : undefined;
    return sq;
  }

  function setSquadFormation(state, squadId, formationType, formationRows, formationWidth) {
    const sq = state.squads.get(squadId);
    if (!sq) return null;
    sq.formation.type = formationType || sq.formation.type || "line";
    sq.formation.rows = Math.max(1, formationRows ?? sq.formation.rows ?? 3);
    sq.formation.width = formationWidth ?? sq.formation.width ?? 1;
    sq.formation.dirty = true;
    sq.formation.dirtyAt = state.t ?? 0;
    return sq;
  }

  // ─── Formation Recalculation ──────────────────────────────────────

  function requestFormationRecalc(state, squadId, force) {
    const sq = state.squads.get(squadId);
    if (!sq) return;
    sq.formation.dirty = true;
    sq.formation.dirtyAt = state.t ?? 0;
    if (force) sq.formation.lastRecalcAt = -Infinity;
  }

  function canRecalculateFormation(squad, state) {
    return !!squad && (squad.formation.lastRecalcAt == null || (state.t - squad.formation.lastRecalcAt) >= config.formationRecalcCooldown);
  }

  function recalculateFormation(state, squadId, helpers, force) {
    const sq = state.squads.get(squadId);
    if (!sq) return false;
    const units = getSquadUnits(state, sq);
    if (!units.length) return false;
    if (!force && !sq.formation.dirty) return false;
    if (!force && !canRecalculateFormation(sq, state)) return false;
    const leader = getLeader(state, sq);
    if (!leader) return false;

    const preserved = sq.formation.slotAssignments.filter((uid) => units.some((u) => u.id === uid));
    const leftovers = units.map((u) => u.id).filter((uid) => !preserved.includes(uid));
    sq.formation.slotAssignments = preserved.concat(leftovers);

    const facing = sq.formation.targetFacing ?? sq.formation.facing ?? leader._lastFacingAngle ?? 0;
    const orderedUnits = sq.formation.slotAssignments.map((uid) => state.units.get(uid)).filter(Boolean);

    let offsets;
    if (typeof FORMATIONS !== "undefined" && FORMATIONS.getFormationOffsets) {
      const unitTypes = orderedUnits.map((u) => u.unitType || "fighter");
      offsets = FORMATIONS.getFormationOffsets(unitTypes, sq.formation.type, sq.formation.rows, facing, sq.formation.width);
    } else if (helpers && helpers.getFormationOffsets) {
      const dirX = Math.cos(facing), dirY = Math.sin(facing);
      offsets = helpers.getFormationOffsets(orderedUnits.length, sq.formation.type, sq.formation.rows, dirX, dirY, sq.formation.width, orderedUnits);
    } else {
      offsets = orderedUnits.map(() => ({ x: 0, y: 0 }));
    }

    for (let i = 0; i < orderedUnits.length; i++) {
      const u = orderedUnits[i];
      const off = offsets[i] || { x: 0, y: 0 };
      u.formationOffsetX = off.x;
      u.formationOffsetY = off.y;
      u._execSlotIndex = i;
    }

    sq.formation.lastRecalcAt = state.t;
    sq.formation.facing = facing;
    sq.formation.dirty = false;
    applyCompatibility(state, sq);
    return true;
  }

  // ─── Sync & Bootstrap ─────────────────────────────────────────────

  function bootstrapFromUnits(state) {
    ensureRuntime(state);
    if (state.squads.size > 0) return;
    const groups = new Map();
    for (const u of state.units.values()) {
      if (u.hp <= 0) continue;
      const key = u.squadId ?? (u.leaderId ?? u.id);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(u);
    }
    for (const units of groups.values()) {
      units.sort((a, b) => a.id - b.id);
      const leader = units.find((u) => u.leaderId == null) || units[0];
      createSquad(state, units.map((u) => u.id), {
        leaderUnitId: leader.id,
        formationType: leader.formationType || "line",
        formationRows: leader.formationRows ?? 3,
        formationWidth: leader.formationPigWidth ?? 1,
        order: buildDefaultOrder(leader)
      });
    }
  }

  function syncSquadsFromState(state) {
    ensureRuntime(state);
    bootstrapFromUnits(state);

    const seen = new Set();
    for (const [sid, sq] of [...state.squads.entries()]) {
      sq.unitIds = sq.unitIds.filter((uid) => { const u = state.units.get(uid); return !!u && u.hp > 0; });
      if (!sq.unitIds.length) { state.squads.delete(sid); continue; }
      if (!sq.unitIds.includes(sq.leaderUnitId)) sq.leaderUnitId = pickLeaderUnitId(state, sq);
      sq.ownerId = getLeader(state, sq)?.owner ?? sq.ownerId;
      sq.formation = normalizeFormation(sq.formation);
      sq.combat = normalizeCombat(sq.combat);
      if (!sq.anchor) sq.anchor = { x: 0, y: 0 };
      for (const uid of sq.unitIds) seen.add(uid);
      applyCompatibility(state, sq);
    }

    for (const u of state.units.values()) {
      if (u.hp <= 0 || seen.has(u.id)) continue;
      createSquad(state, [u.id], {
        leaderUnitId: u.id,
        formationType: u.formationType || "line",
        formationRows: u.formationRows ?? 3,
        formationWidth: u.formationPigWidth ?? 1,
        order: buildDefaultOrder(u)
      });
    }
  }

  // ─── Engagement Zones ─────────────────────────────────────────────

  const ENGAGEMENT_HASH_CELL = 320;

  function buildSquadCombatInfos(state, helpers) {
    const infos = [];
    const byId = new Map();
    for (const sq of state.squads.values()) {
      if (!sq) continue;
      const units = getSquadUnits(state, sq);
      if (!units.length) continue;
      let sx = 0;
      let sy = 0;
      let maxAttackRange = 0;
      let hpSum = 0;
      for (const u of units) {
        sx += u.x;
        sy += u.y;
        hpSum += u.hp || 0;
        const atkRange = (helpers.getUnitAtkRange ? helpers.getUnitAtkRange(u) : (u.attackRange || 60)) * config.engageRangeFactor;
        if (atkRange > maxAttackRange) maxAttackRange = atkRange;
      }
      const centerX = sx / units.length;
      const centerY = sy / units.length;
      let radius = 0;
      for (const u of units) {
        const hitRadius = helpers.getUnitHitRadius ? helpers.getUnitHitRadius(u) : 10;
        const unitRadius = d(centerX, centerY, u.x, u.y) + hitRadius;
        if (unitRadius > radius) radius = unitRadius;
      }
      const info = {
        squad: sq,
        id: sq.id,
        ownerId: sq.ownerId,
        units,
        unitCount: units.length,
        centerX,
        centerY,
        radius,
        maxAttackRange,
        pairRadius: radius + maxAttackRange + config.zoneJoinPadding,
        hpSum
      };
      infos.push(info);
      byId.set(info.id, info);
    }
    return { infos, byId };
  }

  function buildEngagementSpatialHash(infos) {
    const buckets = new Map();
    for (const info of infos) {
      const cx = Math.floor(info.centerX / ENGAGEMENT_HASH_CELL);
      const cy = Math.floor(info.centerY / ENGAGEMENT_HASH_CELL);
      const key = cx + ":" + cy;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = [];
        buckets.set(key, bucket);
      }
      bucket.push(info);
    }
    return buckets;
  }

  function forEachNearbySquadInfo(info, buckets, visit) {
    const cx = Math.floor(info.centerX / ENGAGEMENT_HASH_CELL);
    const cy = Math.floor(info.centerY / ENGAGEMENT_HASH_CELL);
    const radiusCells = Math.max(1, Math.ceil((info.pairRadius || ENGAGEMENT_HASH_CELL) / ENGAGEMENT_HASH_CELL));
    for (let dx = -radiusCells; dx <= radiusCells; dx++) {
      for (let dy = -radiusCells; dy <= radiusCells; dy++) {
        const bucket = buckets.get((cx + dx) + ":" + (cy + dy));
        if (!bucket) continue;
        for (const other of bucket) visit(other);
      }
    }
  }

  function buildEngagementZones(state, helpers) {
    ensureRuntime(state);
    const squadData = buildSquadCombatInfos(state, helpers);
    const squads = squadData.infos;
    const squadInfoById = squadData.byId;
    const spatialHash = buildEngagementSpatialHash(squads);

    const pairSet = new Set();

    for (const info of squads) {
      forEachNearbySquadInfo(info, spatialHash, (other) => {
        if (!other || other.id <= info.id) return;
        if (info.ownerId === other.ownerId) return;
        const maxCenterReach = (info.pairRadius || 0) + (other.pairRadius || 0);
        if (d(info.centerX, info.centerY, other.centerX, other.centerY) > maxCenterReach) return;
        if (unitPairInRange(info, other, helpers)) {
          pairSet.add(info.id + ":" + other.id);
        }
      });
    }

    const squadToZone = new Map();

    for (const zone of state.engagementZones.values()) {
      const alive = [];
      const seenAlive = new Set();
      for (const sid of zone.squadIds || []) {
        if (seenAlive.has(sid) || !squadInfoById.has(sid)) continue;
        seenAlive.add(sid);
        alive.push(sid);
      }
      let hasConflict = false;
      const owners = new Set();
      for (const sid of alive) {
        const info = squadInfoById.get(sid);
        if (info) owners.add(info.ownerId);
      }
      if (owners.size >= 2) hasConflict = true;

      if (!hasConflict) {
        state.engagementZones.delete(zone.id);
        continue;
      }

      for (const sid of alive) squadToZone.set(sid, zone.id);
      zone.squadIds = alive;
    }

    for (const pairKey of pairSet) {
      const [aStr, bStr] = pairKey.split(":");
      const aId = parseInt(aStr), bId = parseInt(bStr);
      const zA = squadToZone.get(aId), zB = squadToZone.get(bId);

      if (zA != null && zB != null) {
        if (zA !== zB) {
          const zoneA = state.engagementZones.get(zA);
          const zoneB = state.engagementZones.get(zB);
          if (zoneA && zoneB) {
            for (const sid of zoneB.squadIds) {
              if (!zoneA.squadIds.includes(sid)) zoneA.squadIds.push(sid);
              squadToZone.set(sid, zA);
            }
            state.engagementZones.delete(zB);
          }
        }
        continue;
      }

      if (zA != null) {
        const zone = state.engagementZones.get(zA);
        if (zone && !zone.squadIds.includes(bId)) { zone.squadIds.push(bId); squadToZone.set(bId, zA); }
        continue;
      }
      if (zB != null) {
        const zone = state.engagementZones.get(zB);
        if (zone && !zone.squadIds.includes(aId)) { zone.squadIds.push(aId); squadToZone.set(aId, zB); }
        continue;
      }

      const zoneId = state.nextEngagementZoneId++;
      const zone = { id: zoneId, squadIds: [aId, bId], anchorX: null, anchorY: null, radius: 0, displayRadius: 0, lastActiveAt: state.t, createdAt: state.t };
      state.engagementZones.set(zoneId, zone);
      squadToZone.set(aId, zoneId);
      squadToZone.set(bId, zoneId);
    }

    for (const sq of squads) {
      if (squadToZone.has(sq.id)) continue;
      if (sq.squad && sq.squad._zoneImmunityUntil && state.t < sq.squad._zoneImmunityUntil) continue;
      for (const zone of state.engagementZones.values()) {
        if (zone.squadIds.includes(sq.id)) continue;
        const zoneOwners = new Set(zone.squadIds.map((sid) => squadInfoById.get(sid)?.ownerId).filter((ownerId) => ownerId != null));
        if (zoneOwners.has(sq.ownerId) && zoneOwners.size < 2) continue;

        const sqUnits = sq.units;
        let touching = false;
        const joinR = (zone.displayRadius || zone.radius || 70) + config.zoneJoinPadding;

        if (zone.anchorX != null && d(sq.centerX, sq.centerY, zone.anchorX, zone.anchorY) <= joinR + sq.radius) {
          touching = true;
        }

        if (!touching) {
          const zUnits = [];
          for (const sid of zone.squadIds) {
            const other = squadInfoById.get(sid);
            if (other && other.ownerId !== sq.ownerId) zUnits.push(...other.units);
          }
          for (const a of sqUnits) {
            const aR = (helpers.getUnitAtkRange ? helpers.getUnitAtkRange(a) : 60) * config.engageRangeFactor;
            for (const b of zUnits) {
              if (d(a.x, a.y, b.x, b.y) <= aR) { touching = true; break; }
            }
            if (touching) break;
          }
        }

        if (touching) {
          zone.squadIds.push(sq.id);
          squadToZone.set(sq.id, zone.id);
          break;
        }
      }
    }

    state._zoneBySquadId = squadToZone;
    for (const zone of state.engagementZones.values()) {
      updateZoneGeometry(state, zone, squadInfoById);
    }
  }

  function unitPairInRange(infoA, infoB, helpers) {
    const uA = infoA.units;
    const uB = infoB.units;
    for (const a of uA) {
      const aR = (helpers.getUnitAtkRange ? helpers.getUnitAtkRange(a) : 60) * config.engageRangeFactor;
      for (const b of uB) {
        if (d(a.x, a.y, b.x, b.y) <= aR) return true;
      }
    }
    return false;
  }

  const COMBAT_ZONE_RADIUS_SCALE = 0.6;
  const ZONE_MIN_R = Math.round(168 * COMBAT_ZONE_RADIUS_SCALE);
  const ZONE_RADIUS_UPDATE_INTERVAL = 0.2;

  function updateZoneGeometry(state, zone, squadInfoById) {
    let sx = 0, sy = 0, cnt = 0, rad = 0;
    for (const sid of zone.squadIds) {
      const info = squadInfoById && squadInfoById.get(sid);
      if (info) {
        sx += info.centerX * info.unitCount;
        sy += info.centerY * info.unitCount;
        cnt += info.unitCount;
        continue;
      }
      for (const u of getSquadUnits(state, state.squads.get(sid))) {
        sx += u.x; sy += u.y; cnt++;
      }
    }
    if (cnt === 0) return;

    const targetX = sx / cnt, targetY = sy / cnt;
    zone.anchorX = zone.anchorX != null ? zone.anchorX + (targetX - zone.anchorX) * 0.05 : targetX;
    zone.anchorY = zone.anchorY != null ? zone.anchorY + (targetY - zone.anchorY) * 0.05 : targetY;

    if (zone._lastRadiusUpdate == null) zone._lastRadiusUpdate = 0;
    const elapsed = state.t - zone._lastRadiusUpdate;
    const needsRadiusUpdate = zone.radius === 0 || elapsed >= ZONE_RADIUS_UPDATE_INTERVAL;

    if (needsRadiusUpdate) {
      zone._lastRadiusUpdate = state.t;
      for (const sid of zone.squadIds) {
        const info = squadInfoById && squadInfoById.get(sid);
        if (info) {
          rad = Math.max(rad, d(zone.anchorX, zone.anchorY, info.centerX, info.centerY) + info.radius);
          continue;
        }
        for (const u of getSquadUnits(state, state.squads.get(sid))) {
          rad = Math.max(rad, d(zone.anchorX, zone.anchorY, u.x, u.y));
        }
      }
      const zoneMaxR = Math.round(ZONE_MIN_R * 2);
      const shipScale = Math.min(1, cnt / 30);
      const dynamicMax = ZONE_MIN_R + (zoneMaxR - ZONE_MIN_R) * shipScale;
      const desiredRadius = Math.min(dynamicMax, Math.max(ZONE_MIN_R, (rad + 30) * COMBAT_ZONE_RADIUS_SCALE));
      zone.radius = desiredRadius;
    }

    const age = state.t - (zone.createdAt || 0);
    if (age < 1.0) {
      zone.displayRadius = zone.radius * Math.min(1, age);
    } else {
      zone.displayRadius = zone.radius;
    }
    zone.lastActiveAt = state.t;

    const owners = new Set();
    const powerByOwner = new Map();
    for (const sid of zone.squadIds) {
      const info = squadInfoById && squadInfoById.get(sid);
      if (info) {
        owners.add(info.ownerId);
        powerByOwner.set(info.ownerId, (powerByOwner.get(info.ownerId) || 0) + info.hpSum);
        continue;
      }
      const sq = state.squads.get(sid);
      if (!sq) continue;
      owners.add(sq.ownerId);
      const units = getSquadUnits(state, sq);
      let power = 0;
      for (const u of units) power += u.hp;
      powerByOwner.set(sq.ownerId, (powerByOwner.get(sq.ownerId) || 0) + power);
    }
    zone.owners = [...owners];
    zone.balanceSegments = [...powerByOwner.entries()].map(([ownerId, power]) => ({ ownerId, power }));
  }

  // ─── Combat Mode Transitions ──────────────────────────────────────

  function updateSingleSquadCombatState(state, squad, helpers) {
    const units = getSquadUnits(state, squad);
    if (!units.length) return;
    const leader = getLeader(state, squad);
    if (!leader) return;

    const zone = findZoneForSquad(state, squad.id);

    if (zone) {
      squad.combat.zoneId = zone.id;

      if (squad.combat.mode === "idle" && squad.order.type !== "idle") {
        squad.combat.resumeOrder = cloneOrder(squad.order);
      }

      const avgRange = getAvgAttackRange(units, helpers);
      const leaderDist = d(leader.x, leader.y, zone.anchorX, zone.anchorY);
      const threshold = avgRange * 1.3;

      if (leaderDist > threshold && squad.combat.mode !== "engaged") {
        squad.combat.mode = "approach";
      } else {
        squad.combat.mode = "engaged";
      }

      squad.combat._disengageTimer = null;
      squad.combat._pendingResume = false;
      return;
    }

    if (squad.combat.mode === "approach" || squad.combat.mode === "engaged") {
      if (squad.combat._disengageTimer == null) {
        squad.combat._disengageTimer = state.t + config.disengageDelay;
      }
      if (state.t >= squad.combat._disengageTimer) {
        queueCombatExit(state, squad);
      }
      return;
    }

    squad.combat.mode = "idle";
    squad.combat.zoneId = null;
    squad.combat._disengageTimer = null;
    squad.combat.combatTargetSquadId = null;
    squad.combat._pendingResume = false;
  }

  function updateSquadCombatState(state, helpers) {
    ensureRuntime(state);
    for (const sq of state.squads.values()) {
      updateSingleSquadCombatState(state, sq, helpers);
    }
  }

  function findZoneForSquad(state, squadId) {
    if (state._zoneBySquadId && typeof state._zoneBySquadId.get === "function") {
      const zoneId = state._zoneBySquadId.get(squadId);
      if (zoneId != null) {
        const zone = state.engagementZones.get(zoneId);
        if (zone) return zone;
      }
    }
    for (const zone of state.engagementZones.values()) {
      if (zone.squadIds.includes(squadId)) return zone;
    }
    return null;
  }

  function queueCombatExit(state, squad) {
    squad.combat.mode = "idle";
    squad.combat.zoneId = null;
    squad.combat._disengageTimer = null;
    squad.combat.focusTargetUnitId = undefined;
    squad.combat.combatTargetSquadId = null;
    squad.combat._pendingResume = true;
    squad._zoneImmunityUntil = state.t + 3;
  }

  function exitCombat(state, squad) {
    if (squad.combat.queuedOrder) {
      squad.order = cloneOrder(squad.combat.queuedOrder);
      squad.combat.queuedOrder = null;
      squad.combat.resumeOrder = null;
    } else if (squad.combat.resumeOrder) {
      squad.order = cloneOrder(squad.combat.resumeOrder);
      squad.combat.resumeOrder = null;
    } else {
      const center = getSquadCenter(state, squad);
      squad.order = { type: "idle", waypoints: [], holdPoint: { x: center.x, y: center.y } };
    }

    squad.formation.dirty = true;
    squad.formation.dirtyAt = state.t ?? 0;
    squad.combat._pendingResume = false;
    applyCompatibility(state, squad);

    for (const u of getSquadUnits(state, squad)) {
      u._combatState = "idle";
      u._currentTargetId = undefined;
      u._squadCombatPhase = null;
      u._engagementZoneId = null;
      u._engagementAnchorX = undefined;
      u._engagementAnchorY = undefined;
    }
  }

  function getEnemySquadCandidates(state, squad, zone) {
    if (!zone) return [];
    const out = [];
    for (const sid of zone.squadIds) {
      const other = state.squads.get(sid);
      if (!other || other.ownerId === squad.ownerId) continue;
      if (!getSquadUnits(state, other).length) continue;
      out.push(other);
    }
    return out;
  }

  function selectCombatTargetSquadId(state, squad, zone) {
    if (!zone) return null;
    const candidates = getEnemySquadCandidates(state, squad, zone);
    if (!candidates.length) return null;

    const focusTarget = squad.combat?.focusTargetUnitId != null ? state.units.get(squad.combat.focusTargetUnitId) : null;
    if (focusTarget && focusTarget.hp > 0 && focusTarget.owner !== squad.ownerId && focusTarget.squadId != null) {
      if (candidates.some((other) => other.id === focusTarget.squadId)) return focusTarget.squadId;
    }

    if (squad.combat?.combatTargetSquadId != null) {
      const current = state.squads.get(squad.combat.combatTargetSquadId);
      if (current && current.ownerId !== squad.ownerId && zone.squadIds.includes(current.id) && getSquadUnits(state, current).length > 0) {
        return current.id;
      }
    }

    const center = getSquadCenter(state, squad);
    let best = null;
    let bestDist = Infinity;
    for (const other of candidates) {
      const otherCenter = getSquadCenter(state, other);
      const dist = d(center.x, center.y, otherCenter.x, otherCenter.y);
      if (dist < bestDist || (Math.abs(dist - bestDist) < 0.001 && other.id < (best?.id ?? Infinity))) {
        best = other;
        bestDist = dist;
      }
    }
    return best ? best.id : null;
  }

  function getEnemyBuckets(state, squad, zone) {
    if (!zone) {
      if (squad.order.type === "attackUnit") {
        const t = getUnit(state, squad.order.targetUnitId);
        return { primary: t && t.hp > 0 ? [t] : [], secondary: [] };
      }
      return { primary: [], secondary: [] };
    }
    const primary = [];
    const secondary = [];
    const preferredSquadId = squad.combat?.combatTargetSquadId ?? null;
    for (const sid of zone.squadIds) {
      const other = state.squads.get(sid);
      if (!other || other.ownerId === squad.ownerId) continue;
      const bucket = preferredSquadId != null && sid !== preferredSquadId ? secondary : primary;
      bucket.push(...getSquadUnits(state, other));
    }
    return { primary, secondary };
  }

  // ─── Anchor & Order Resolution ────────────────────────────────────

  function updateOrderAnchors(state, squad, helpers) {
    const units = getSquadUnits(state, squad);
    if (!units.length) return;
    const leader = getLeader(state, squad);
    if (!leader) return;
    const center = getSquadCenter(state, squad);

    if (squad.combat.mode === "approach") {
      const zone = squad.combat.zoneId != null ? state.engagementZones.get(squad.combat.zoneId) : null;
      if (zone) {
        squad.anchor.x = zone.anchorX;
        squad.anchor.y = zone.anchorY;
        const facing = Math.atan2(zone.anchorY - center.y, zone.anchorX - center.x);
        squad.formation.targetFacing = facing;
      }
      return;
    }

    if (squad.combat.mode === "engaged") return;

    const order = squad.order || { type: "idle", waypoints: [] };
    let desX = center.x, desY = center.y;
    let desFacing = squad.formation.targetFacing ?? squad.formation.facing ?? 0;

    if (order.type === "move" || order.type === "capture") {
      if (order.type === "capture" && order.mineId != null && state.mines) {
        const mine = state.mines.get(order.mineId);
        if (!mine) {
          const nextQueuedOrder = getNextQueuedOrder(order);
          if (nextQueuedOrder) {
            squad.order = nextQueuedOrder;
          } else if (squad.combat.queuedOrder) {
            squad.order = cloneOrder(squad.combat.queuedOrder);
            squad.combat.queuedOrder = null;
            squad.combat.resumeOrder = null;
          } else {
            squad.order = { type: "idle", waypoints: [] };
          }
          applyCompatibility(state, squad);
          return;
        }
        const distToMine = d(center.x, center.y, mine.x, mine.y);
        const inRadius = distToMine <= (config.mineCaptureDoneRadius || 55);
        const mineOurs = mine.ownerId === squad.ownerId && (mine.captureProgress >= 1 || mine.captureProgress === undefined);
        const weCapturing = mine._capturingOwner === squad.ownerId;
        if (mineOurs) {
          const remainingWaypoints = cloneWaypoints(order.waypoints || []);
          if (remainingWaypoints.length > 0) {
            const firstWp = remainingWaypoints[0];
            if (firstWp && d(firstWp.x, firstWp.y, mine.x, mine.y) <= config.waypointReachRadius) {
              remainingWaypoints.shift();
            }
          }
          const nextQueuedOrder = getNextQueuedOrder(order);
          if (nextQueuedOrder) {
            squad.order = nextQueuedOrder;
          } else if (remainingWaypoints.length > 0) {
            squad.order = {
              type: "move",
              waypoints: remainingWaypoints,
              holdPoint: null,
              angle: order.angle,
              suppressPathPreview: false
            };
          } else if (squad.combat.queuedOrder) {
            squad.order = cloneOrder(squad.combat.queuedOrder);
            squad.combat.queuedOrder = null;
            squad.combat.resumeOrder = null;
          } else {
            squad.order = { type: "idle", waypoints: [] };
          }
          applyCompatibility(state, squad);
          return;
        }
        if (inRadius || weCapturing) {
          desX = center.x;
          desY = center.y;
          desFacing = order.angle ?? Math.atan2(mine.y - center.y, mine.x - center.x);
          squad.anchor.x = desX;
          squad.anchor.y = desY;
          squad.formation.targetFacing = desFacing;
          return;
        }
        const stopR = config.mineCaptureDoneRadius || 55;
        const dx = center.x - mine.x;
        const dy = center.y - mine.y;
        const len = Math.hypot(dx, dy) || 1;
        desX = mine.x + (dx / len) * stopR;
        desY = mine.y + (dy / len) * stopR;
        desFacing = order.angle ?? Math.atan2(mine.y - center.y, mine.x - center.x);
        squad.anchor.x = desX;
        squad.anchor.y = desY;
        squad.formation.targetFacing = desFacing;
        return;
      }
      if (order.waypoints && order.waypoints.length > 0) {
        const wp = order.waypoints[0];
        const waypointReachRadius = getOrderWaypointReachRadius(order);
        desX = wp.x; desY = wp.y;
        desFacing = order.angle ?? Math.atan2(wp.y - center.y, wp.x - center.x);
        if (d(center.x, center.y, wp.x, wp.y) <= waypointReachRadius) {
          order.holdPoint = clonePoint(wp);
          order.waypoints.shift();
          if (order.waypoints.length > 0) {
            desX = order.waypoints[0].x; desY = order.waypoints[0].y;
            desFacing = order.angle ?? Math.atan2(desY - center.y, desX - center.x);
          } else {
            const nextQueuedOrder = getNextQueuedOrder(order);
            if (nextQueuedOrder) {
              squad.order = nextQueuedOrder;
              applyCompatibility(state, squad);
              return;
            }
          }
        }
      } else if (order.holdPoint) {
        desX = order.holdPoint.x; desY = order.holdPoint.y;
        desFacing = order.angle ?? desFacing;
      } else {
        const nextQueuedOrder = getNextQueuedOrder(order);
        if (nextQueuedOrder) {
          squad.order = nextQueuedOrder;
          applyCompatibility(state, squad);
          return;
        }
      }
    } else if (order.type === "attackUnit") {
      const target = getUnit(state, order.targetUnitId);
      if (!target || target.hp <= 0) {
        const nextQueuedOrder = getNextQueuedOrder(order);
        squad.order = nextQueuedOrder || { type: "idle", waypoints: [] };
        applyCompatibility(state, squad);
        return;
      } else if (order.waypoints && order.waypoints.length > 0) {
        const wp = order.waypoints[0];
        const waypointReachRadius = getOrderWaypointReachRadius(order);
        desX = wp.x; desY = wp.y;
        desFacing = Math.atan2(wp.y - center.y, wp.x - center.x);
        if (d(center.x, center.y, wp.x, wp.y) <= waypointReachRadius) order.waypoints.shift();
      } else {
        desX = target.x; desY = target.y;
        desFacing = Math.atan2(target.y - center.y, target.x - center.x);
      }
    } else if (order.type === "siege") {
      const city = order.targetCityId != null ? state.players.get(order.targetCityId) : null;
      if (!city || city.eliminated) {
        if (order.waypoints && order.waypoints.length > 0) {
          const wp = order.waypoints[0];
          const waypointReachRadius = getOrderWaypointReachRadius(order);
          desX = wp.x; desY = wp.y;
          desFacing = Math.atan2(wp.y - center.y, wp.x - center.x);
          if (d(center.x, center.y, wp.x, wp.y) <= waypointReachRadius) {
            order.waypoints.shift();
            if (order.waypoints.length > 0) {
              desX = order.waypoints[0].x;
              desY = order.waypoints[0].y;
              desFacing = Math.atan2(desY - center.y, desX - center.x);
            } else {
              const nextQueuedOrder = getNextQueuedOrder(order);
              squad.order = nextQueuedOrder || { type: "idle", waypoints: [] };
              applyCompatibility(state, squad);
              return;
            }
          }
        } else {
          const nextQueuedOrder = getNextQueuedOrder(order);
          squad.order = nextQueuedOrder || { type: "idle", waypoints: [] };
          applyCompatibility(state, squad);
          return;
        }
      } else if (order.waypoints && order.waypoints.length > 0) {
        const wp = order.waypoints[0];
        const waypointReachRadius = getOrderWaypointReachRadius(order);
        desX = wp.x; desY = wp.y;
        desFacing = Math.atan2(wp.y - center.y, wp.x - center.x);
        if (d(center.x, center.y, wp.x, wp.y) <= waypointReachRadius) order.waypoints.shift();
      } else if (order.strictLaneApproach && order.laneHoldPoint) {
        desX = order.laneHoldPoint.x;
        desY = order.laneHoldPoint.y;
        desFacing = Math.atan2(city.y - center.y, city.x - center.x);
      } else {
        const avgR = getAvgAttackRange(units, helpers);
        const shR = helpers.shieldRadius ? helpers.shieldRadius(city) : 0;
        const stopR = Math.max(shR + 8, avgR * 0.85);
        const dx = center.x - city.x, dy = center.y - city.y;
        const len = Math.hypot(dx, dy) || 1;
        desX = city.x + (dx / len) * stopR;
        desY = city.y + (dy / len) * stopR;
        desFacing = Math.atan2(city.y - center.y, city.x - center.x);
      }
    } else if (order.type === "attackPirateBase") {
      const pirateBase = state.pirateBase && state.pirateBase.hp > 0 ? state.pirateBase : null;
      if (!pirateBase) {
        const nextQueuedOrder = getNextQueuedOrder(order);
        squad.order = nextQueuedOrder || { type: "idle", waypoints: [] };
        applyCompatibility(state, squad);
        return;
      } else if (order.waypoints && order.waypoints.length > 0) {
        const wp = order.waypoints[0];
        const waypointReachRadius = getOrderWaypointReachRadius(order);
        desX = wp.x; desY = wp.y;
        desFacing = Math.atan2(wp.y - center.y, wp.x - center.x);
        if (d(center.x, center.y, wp.x, wp.y) <= waypointReachRadius) order.waypoints.shift();
      } else {
        const avgR = getAvgAttackRange(units, helpers);
        const stopR = Math.max(52, avgR * 0.85);
        const dx = center.x - pirateBase.x, dy = center.y - pirateBase.y;
        const len = Math.hypot(dx, dy) || 1;
        desX = pirateBase.x + (dx / len) * stopR;
        desY = pirateBase.y + (dy / len) * stopR;
        desFacing = Math.atan2(pirateBase.y - center.y, pirateBase.x - center.x);
      }
    } else if (order.holdPoint) {
      desX = order.holdPoint.x; desY = order.holdPoint.y;
    }

    squad.anchor.x = desX;
    squad.anchor.y = desY;
    squad.formation.targetFacing = desFacing;
  }

  // ─── Movement Target per Unit ─────────────────────────────────────

  function clampToZone(tx, ty, zone) {
    if (!zone || zone.anchorX == null) return { x: tx, y: ty };
    const r = zone.radius || 120;
    const dx = tx - zone.anchorX, dy = ty - zone.anchorY;
    const dist = Math.hypot(dx, dy);
    const margin = r * 0.85;
    if (dist <= margin) return { x: tx, y: ty };
    const scale = margin / Math.max(1, dist);
    return { x: zone.anchorX + dx * scale, y: zone.anchorY + dy * scale };
  }

  function getZoneBoundarySteer(ux, uy, zone) {
    if (!zone || zone.anchorX == null) return null;
    const r = zone.radius || 120;
    const dx = ux - zone.anchorX, dy = uy - zone.anchorY;
    const dist = Math.hypot(dx, dy);
    if (dist < r * 0.75) return null;
    const strength = Math.min(1, (dist - r * 0.75) / (r * 0.25));
    const nx = dx / Math.max(1, dist), ny = dy / Math.max(1, dist);
    return { sx: -nx * strength, sy: -ny * strength, strength };
  }

  function buildLaneSegmentsForFrontType(state, ownerId, frontType, targetCityId) {
    if (!frontType) return [];
    const owner = state.players.get(ownerId);
    if (!owner || owner.eliminated) return [];
    const centerPoint = {
      x: Number.isFinite(state.centerObjectives?.centerX) ? state.centerObjectives.centerX : (owner.x || 0),
      y: Number.isFinite(state.centerObjectives?.centerY) ? state.centerObjectives.centerY : (owner.y || 0)
    };
    const halfWidth = frontType === "center" ? CENTER_LANE_HALF_WIDTH : SIDE_LANE_HALF_WIDTH;
    if (frontType === "center") {
      const segments = [{
        from: { x: owner.x || 0, y: owner.y || 0 },
        to: centerPoint,
        halfWidth
      }];
      if (targetCityId != null) {
        const city = state.players.get(targetCityId);
        if (city && !city.eliminated) {
          segments.push({
            from: centerPoint,
            to: { x: city.x || 0, y: city.y || 0 },
            halfWidth
          });
        }
      }
      return segments;
    }
    const graph = state.frontGraph && state.frontGraph[ownerId] ? state.frontGraph[ownerId] : null;
    const path = frontType === "left" ? graph?.leftPath : graph?.rightPath;
    if (!Array.isArray(path) || path.length === 0) return [];
    const points = [{ x: owner.x || 0, y: owner.y || 0 }].concat(path.map((point) => ({ x: point.x || 0, y: point.y || 0 })));
    const out = [];
    for (let i = 1; i < points.length; i++) {
      out.push({
        from: points[i - 1],
        to: points[i],
        halfWidth
      });
    }
    return out;
  }

  function getFrontTypeForSquad(state, sq) {
    if (!sq) return null;
    const assignment = state.squadFrontAssignments && state.squadFrontAssignments[sq.id];
    if (assignment && assignment.frontType) return assignment.frontType;
    if (isFrontLaneTag(sq.sourceTag)) return String(sq.sourceTag).slice(6);
    const targetCityId = sq.order?.targetCityId ?? null;
    const ownerGraph = state.frontGraph && state.frontGraph[sq.ownerId] ? state.frontGraph[sq.ownerId] : null;
    if (!ownerGraph) return null;
    const squadCenter = getSquadCenter(state, sq);
    let best = null;
    const candidates = ["left", "center", "right"];
    for (const frontType of candidates) {
      const segments = buildLaneSegmentsForFrontType(state, sq.ownerId, frontType, targetCityId);
      if (!segments.length) continue;
      const sample = projectPointOnLaneSegments(squadCenter.x || 0, squadCenter.y || 0, segments);
      if (!sample) continue;
      let score = sample.score;
      if (frontType === "left" && ownerGraph.leftTargetCoreId === targetCityId) score -= 24;
      if (frontType === "right" && ownerGraph.rightTargetCoreId === targetCityId) score -= 24;
      if (frontType === "center" && targetCityId != null && ownerGraph.leftTargetCoreId !== targetCityId && ownerGraph.rightTargetCoreId !== targetCityId) score -= 12;
      if (!best || score < best.score) best = { frontType, score };
    }
    return best ? best.frontType : null;
  }

  function getLaneSegmentsForSquad(state, sq) {
    const frontType = getFrontTypeForSquad(state, sq);
    if (!frontType) return [];
    return buildLaneSegmentsForFrontType(state, sq.ownerId, frontType, sq.order?.targetCityId ?? null);
  }

  function projectPointOnLaneSegments(x, y, segments) {
    let best = null;
    let traveled = 0;
    for (const segment of segments || []) {
      if (!segment || !segment.from || !segment.to) continue;
      const dx = (segment.to.x || 0) - (segment.from.x || 0);
      const dy = (segment.to.y || 0) - (segment.from.y || 0);
      const len2 = dx * dx + dy * dy;
      const len = Math.sqrt(len2);
      if (len <= 1e-6) continue;
      const t = clamp((((x || 0) - (segment.from.x || 0)) * dx + ((y || 0) - (segment.from.y || 0)) * dy) / len2, 0, 1);
      const px = (segment.from.x || 0) + dx * t;
      const py = (segment.from.y || 0) + dy * t;
      const dist = Math.hypot((x || 0) - px, (y || 0) - py);
      const score = dist - (segment.halfWidth || 0);
      if (!best || score < best.score) {
        best = {
          x: px,
          y: py,
          dist,
          halfWidth: segment.halfWidth || 0,
          progress: traveled + len * t,
          score
        };
      }
      traveled += len;
    }
    return best;
  }

  function getPointOnLaneAtProgress(segments, progress) {
    let remaining = Math.max(0, progress || 0);
    for (const segment of segments || []) {
      if (!segment || !segment.from || !segment.to) continue;
      const len = Math.hypot((segment.to.x || 0) - (segment.from.x || 0), (segment.to.y || 0) - (segment.from.y || 0));
      if (len <= 1e-6) continue;
      if (remaining <= len) {
        const t = clamp(remaining / len, 0, 1);
        return {
          x: (segment.from.x || 0) + ((segment.to.x || 0) - (segment.from.x || 0)) * t,
          y: (segment.from.y || 0) + ((segment.to.y || 0) - (segment.from.y || 0)) * t,
          progress
        };
      }
      remaining -= len;
    }
    const last = segments && segments.length ? segments[segments.length - 1] : null;
    return last && last.to ? { x: last.to.x || 0, y: last.to.y || 0, progress: progress || 0 } : null;
  }

  function keepTargetInsideLane(target, sample, margin) {
    if (!target || !sample) return target;
    const safeMargin = margin != null ? margin : 10;
    const allowed = Math.max(0, (sample.halfWidth || 0) - safeMargin);
    if (sample.dist <= allowed + 1e-3) return target;
    const dx = (target.x || 0) - sample.x;
    const dy = (target.y || 0) - sample.y;
    const len = Math.hypot(dx, dy);
    if (len <= 1e-6) return { x: sample.x, y: sample.y };
    const scale = allowed / len;
    return { x: sample.x + dx * scale, y: sample.y + dy * scale };
  }

  function constrainTargetToSquadLane(u, sq, target, moveMode, state) {
    if (!target || !sq || moveMode === "stop") return target;
    const frontType = getFrontTypeForSquad(state, sq);
    const strict = !!(sq.order && sq.order.strictLaneApproach);
    if (!strict && frontType !== "left" && frontType !== "right") return target;
    const laneSegments = getLaneSegmentsForSquad(state, sq);
    if (!laneSegments.length) return target;
    const unitSample = projectPointOnLaneSegments(u.x || 0, u.y || 0, laneSegments);
    const targetSample = projectPointOnLaneSegments(target.x || 0, target.y || 0, laneSegments);
    if (!targetSample) return target;
    if (unitSample && unitSample.dist > Math.max(18, unitSample.halfWidth * 0.78)) {
      return { x: unitSample.x, y: unitSample.y };
    }
    const clampedTarget = keepTargetInsideLane(target, targetSample, 10);
    if (!unitSample) return clampedTarget;
    const desiredProgress = Math.max(unitSample.progress || 0, targetSample.progress || 0);
    const lookAhead = strict ? 68 : 54;
    const cappedProgress = Math.min(desiredProgress, (unitSample.progress || 0) + lookAhead);
    if (cappedProgress + 4 < desiredProgress) {
      const lanePoint = getPointOnLaneAtProgress(laneSegments, cappedProgress);
      if (lanePoint) return { x: lanePoint.x, y: lanePoint.y };
    }
    return clampedTarget;
  }

  function getLaneClampForUnit(u, state, margin) {
    if (!u || u.squadId == null) return null;
    const sq = state.squads.get(u.squadId);
    if (!sq) return null;
    const frontType = getFrontTypeForSquad(state, sq);
    const strict = !!(sq.order && sq.order.strictLaneApproach);
    if (!strict && frontType !== "left" && frontType !== "right") return null;
    const laneSegments = getLaneSegmentsForSquad(state, sq);
    if (!laneSegments.length) return null;
    const sample = projectPointOnLaneSegments(u.x || 0, u.y || 0, laneSegments);
    if (!sample) return null;
    const safeMargin = margin != null ? margin : 12;
    const allowed = Math.max(8, (sample.halfWidth || 0) - safeMargin);
    if (sample.dist <= allowed + 1e-3) return null;
    const dx = (u.x || 0) - sample.x;
    const dy = (u.y || 0) - sample.y;
    const len = Math.hypot(dx, dy);
    if (len <= 1e-6) return { x: sample.x, y: sample.y };
    const scale = allowed / len;
    return {
      x: sample.x + dx * scale,
      y: sample.y + dy * scale
    };
  }

  function getUnitMovementTarget(u, state, helpers) {
    ensureRuntime(state);
    const sq = u.squadId != null ? state.squads.get(u.squadId) : null;
    if (!sq) return { tx: u.x, ty: u.y, moveMode: "stop" };
    const leader = getLeader(state, sq);
    if (!leader) return { tx: u.x, ty: u.y, moveMode: "stop" };

    // ── Engaged mode: FREE CHASE to nearest enemy ──
    if (sq.combat.mode === "engaged") {
      const zone = sq.combat.zoneId != null ? state.engagementZones.get(sq.combat.zoneId) : null;
      const enemyBuckets = getEnemyBuckets(state, sq, zone);

      let targetPos = null;
      if (typeof COMBAT !== "undefined" && COMBAT.pickTarget) {
        let target = enemyBuckets.primary.length ? COMBAT.pickTarget(u, enemyBuckets.primary, state) : null;
        if (!target && enemyBuckets.secondary.length) target = COMBAT.pickTarget(u, enemyBuckets.secondary, state);
        if (target) targetPos = { x: target.x, y: target.y };
      } else {
        let best = null, bestD = Infinity;
        const groups = [enemyBuckets.primary, enemyBuckets.secondary];
        for (const group of groups) {
          for (const e of group) {
            const dd = d(u.x, u.y, e.x, e.y);
            if (dd < bestD) { bestD = dd; best = e; }
          }
          if (best) break;
        }
        if (best) {
          u._currentTargetId = best.id;
          targetPos = { x: best.x, y: best.y };
        }
      }

      if (targetPos && zone) {
        const clamped = clampToZone(targetPos.x, targetPos.y, zone);
        const laneClamped = constrainTargetToSquadLane(u, sq, { x: clamped.x, y: clamped.y }, "free_chase", state);
        return { tx: laneClamped.x, ty: laneClamped.y, moveMode: "free_chase" };
      }
      if (targetPos) {
        const laneClamped = constrainTargetToSquadLane(u, sq, { x: targetPos.x, y: targetPos.y }, "free_chase", state);
        return { tx: laneClamped.x, ty: laneClamped.y, moveMode: "free_chase" };
      }

      return { tx: u.x, ty: u.y, moveMode: "stop" };
    }

    // ── Siege circle formation around target ──
    const frontType = getFrontTypeForSquad(state, sq);
    if (
      (sq.order.type === "siege" || sq.order.type === "attackPirateBase") &&
      sq.order.waypoints &&
      sq.order.waypoints.length === 0 &&
      !sq.order.strictLaneApproach &&
      frontType !== "left" &&
      frontType !== "right"
    ) {
      const pirateBase = sq.order.type === "attackPirateBase" ? (state.pirateBase && state.pirateBase.hp > 0 ? state.pirateBase : null) : null;
      const city = sq.order.targetCityId != null ? state.players.get(sq.order.targetCityId) : null;
      const target = pirateBase || (city && !city.eliminated ? city : null);
      if (target) {
        const units = getSquadUnits(state, sq);
        const avgR = getAvgAttackRange(units, helpers);
        const shR = pirateBase ? 44 : (helpers.shieldRadius ? helpers.shieldRadius(city) : 0);
        const circleR = Math.max(shR + 8, avgR * 0.85);
        const idx = units.indexOf(u);
        const angle = (idx / units.length) * Math.PI * 2;
        const tx = target.x + Math.cos(angle) * circleR;
        const ty = target.y + Math.sin(angle) * circleR;
        const laneClamped = constrainTargetToSquadLane(u, sq, { x: tx, y: ty }, "squad_anchor", state);
        return { tx: laneClamped.x, ty: laneClamped.y, moveMode: "squad_anchor" };
      }
    }

    // ── Approach / Move / Idle: formation-based ──
    const facing = sq.formation.targetFacing ?? sq.formation.facing ?? leader._lastFacingAngle ?? 0;
    const anchorX = sq.anchor.x ?? leader.x;
    const anchorY = sq.anchor.y ?? leader.y;

    if (u.id === sq.leaderUnitId) {
      const moveMode = sq.combat.mode === "approach" ? "formation_approach" : (sq.order.type !== "idle" ? "squad_anchor" : "formation_hold");
      const laneClamped = constrainTargetToSquadLane(u, sq, { x: anchorX, y: anchorY }, moveMode, state);
      return { tx: laneClamped.x, ty: laneClamped.y, moveMode };
    }

    const target = getSlotPosition(state, sq, u, leader, anchorX, anchorY, facing);
    const mode = sq.combat.mode === "approach" ? "formation_approach" : (sq.order.type !== "idle" && sq.order.type != null ? "formation_move" : "formation_hold");
    const laneClamped = constrainTargetToSquadLane(u, sq, target, mode, state);
    return { tx: laneClamped.x, ty: laneClamped.y, moveMode: mode };
  }

  function getSlotPosition(state, sq, u, leader, anchorX, anchorY, facing) {
    const ox = u.formationOffsetX ?? 0;
    const oy = u.formationOffsetY ?? 0;
    const formFacing = sq.formation.facing ?? 0;
    const delta = facing - formFacing;
    const cosD = Math.cos(delta), sinD = Math.sin(delta);
    const rx = ox * cosD - oy * sinD;
    const ry = ox * sinD + oy * cosD;

    const leaderOx = leader.formationOffsetX ?? 0;
    const leaderOy = leader.formationOffsetY ?? 0;
    const lrx = leaderOx * cosD - leaderOy * sinD;
    const lry = leaderOx * sinD + leaderOy * cosD;

    return { x: anchorX + (rx - lrx), y: anchorY + (ry - lry) };
  }

  // ─── Fire Plan ────────────────────────────────────────────────────

  function getEnemiesInZone(state, squad, zone) {
    const buckets = getEnemyBuckets(state, squad, zone);
    return buckets.primary.concat(buckets.secondary);
  }

  function chooseLocalTarget(u, state, helpers) {
    const sq = u.squadId != null ? state.squads.get(u.squadId) : null;
    if (!sq) return null;
    const range = helpers.getUnitAtkRange ? helpers.getUnitAtkRange(u) : (u.attackRange || 60);
    const zone = sq.combat.zoneId != null ? state.engagementZones.get(sq.combat.zoneId) : null;
    const enemyBuckets = getEnemyBuckets(state, sq, zone);
    const focusTarget = sq.combat && sq.combat.focusTargetUnitId != null ? state.units.get(sq.combat.focusTargetUnitId) : null;

    if (focusTarget && focusTarget.hp > 0 && focusTarget.owner !== u.owner && d(u.x, u.y, focusTarget.x, focusTarget.y) <= range) {
      u._localTargetId = focusTarget.id;
      return focusTarget;
    }
    if (sq.combat && sq.combat.focusTargetUnitId != null && (!focusTarget || focusTarget.hp <= 0 || focusTarget.owner === u.owner)) {
      sq.combat.focusTargetUnitId = undefined;
    }

    const cur = u._localTargetId != null ? state.units.get(u._localTargetId) : null;
    if (cur && cur.hp > 0 && d(u.x, u.y, cur.x, cur.y) <= range) return cur;

    let best = null, bestD = Infinity;
    const groups = [enemyBuckets.primary, enemyBuckets.secondary];
    for (const group of groups) {
      for (const e of group) {
        if (e.hp <= 0) continue;
        const dd = d(u.x, u.y, e.x, e.y);
        if (dd <= range && dd < bestD) { bestD = dd; best = e; }
      }
      if (best) break;
    }

    u._localTargetId = best ? best.id : undefined;
    return best;
  }

  function getUnitFirePlan(u, state, helpers) {
    const sq = u.squadId != null ? state.squads.get(u.squadId) : null;
    if (!sq) return { type: "none" };
    const range = helpers.getUnitAtkRange ? helpers.getUnitAtkRange(u) : (u.attackRange || 60);
    const maxTargets = Math.max(1, u.maxTargets || 1);
    const chosen = [];

    const primary = chooseLocalTarget(u, state, helpers);
    if (primary) chosen.push(primary);

    if (chosen.length < maxTargets) {
      const zone = sq.combat.zoneId != null ? state.engagementZones.get(sq.combat.zoneId) : null;
      const enemies = getEnemiesInZone(state, sq, zone)
        .filter((e) => e.hp > 0 && !chosen.some((c) => c.id === e.id))
        .map((e) => ({ target: e, d: d(u.x, u.y, e.x, e.y) }))
        .filter((e) => e.d <= range)
        .sort((a, b) => a.d - b.d);
      for (const entry of enemies) {
        chosen.push(entry.target);
        if (chosen.length >= maxTargets) break;
      }
    }

    if (chosen.length) {
      u._currentTargetId = chosen[0].id;
      while (chosen.length < maxTargets) {
        chosen.push(chosen[0]);
      }
      return { type: "units", targets: chosen };
    }

    if (sq.order.type === "siege" && sq.combat.mode !== "engaged" && sq.order.targetCityId != null) {
      const city = state.players.get(sq.order.targetCityId);
      if (city && !city.eliminated) {
        const pR = helpers.getPlanetRadius ? helpers.getPlanetRadius(city) : 0;
        const shR = helpers.shieldRadius ? helpers.shieldRadius(city) : 0;
        const coreR = helpers.getCoreCollisionRadius ? helpers.getCoreCollisionRadius(city) : (pR + 20);
        // Keep siege fire valid after shield collapse. Squads often hold near range,
        // which can be farther than the old fixed city-center threshold.
        const cityAttackRadius = Math.max(pR * 2.9, shR + 10, coreR + 14, range * 0.95);
        if (d(u.x, u.y, city.x, city.y) <= cityAttackRadius) {
          u._currentTargetId = undefined;
          return { type: "city", city };
        }
      }
    }

    if (sq.order.type === "siege" || sq.order.type === "move" || sq.order.type === "attackUnit") {
      if (state.turrets) {
        for (const turret of state.turrets.values()) {
          if (turret.owner === u.owner || turret.hp <= 0) continue;
          if (d(u.x, u.y, turret.x, turret.y) <= range) return { type: "turret", turret };
        }
      }
    }

    u._currentTargetId = undefined;
    return { type: "none" };
  }

  // ─── Damage Tracking ──────────────────────────────────────────────

  function recordDamageSource(u, attackerId, state) {
    if (attackerId == null) return;
    const attacker = state.units.get(attackerId);
    if (!attacker || attacker.owner === u.owner) return;
    u._lastDamagedByUnitId = attackerId;
    u._lastDamagedAt = state.t;

    const sq = u.squadId != null ? state.squads.get(u.squadId) : null;
    if (sq) {
      sq.combat.lastContactAt = state.t;
    }
  }

  // ─── Compat Fields for client.js ──────────────────────────────────

  function writeCompatFields(state, squad) {
    const zone = squad.combat.zoneId != null ? state.engagementZones.get(squad.combat.zoneId) : null;
    const zoneX = zone ? zone.anchorX : undefined;
    const zoneY = zone ? zone.anchorY : undefined;
    const phase = squad.combat.mode === "engaged" ? "engaged" : (squad.combat.mode === "approach" ? "approach" : null);

    const engagedEnemyIds = new Set();
    if (zone) {
      for (const sid of zone.squadIds) {
        const other = state.squads.get(sid);
        if (!other || other.ownerId === squad.ownerId) continue;
        for (const enemy of getSquadUnits(state, other)) engagedEnemyIds.add(enemy.id);
      }
    }

    for (const u of getSquadUnits(state, squad)) {
      u._engagementZoneId = zone ? zone.id : null;
      u._engagementAnchorX = zoneX;
      u._engagementAnchorY = zoneY;
      u._combatFacingAngle = squad.formation.targetFacing;
      u._squadCombatPhase = u.id === squad.leaderUnitId ? phase : null;

      if (squad.combat.mode === "engaged") u._combatState = "attack";
      else if (squad.combat.mode === "approach") u._combatState = "chase";
      else if (squad.order.type === "siege" || squad.order.type === "attackPirateBase") u._combatState = "move";
      else if (squad.order.type === "attackUnit") u._combatState = "chase";
      else if (squad.order.type === "move" || squad.order.type === "capture") u._combatState = "move";
      else u._combatState = "idle";
    }

    const leader = getLeader(state, squad);
    if (leader) {
      leader._squadCombatPhase = phase;
      leader._engagedEnemyIds = engagedEnemyIds.size ? engagedEnemyIds : null;
      leader._combatTargetSquadId = squad.combat.combatTargetSquadId ?? null;
    }
  }

  function finalizeSquadState(state, squad, dt, helpers) {
    cacheSquadSpeed(state, squad, helpers);
    if (squad.combat.mode !== "idle") {
      const zone = squad.combat.zoneId != null ? state.engagementZones.get(squad.combat.zoneId) : null;
      squad.combat.combatTargetSquadId = selectCombatTargetSquadId(state, squad, zone);
    } else {
      squad.combat.combatTargetSquadId = null;
    }
    lerpFacing(state, squad, dt);
    updateOrderAnchors(state, squad, helpers);
    recalculateFormation(state, squad.id, helpers, false);
    applyCompatibility(state, squad);
    writeCompatFields(state, squad);
  }

  function updateCombat(state, dt, helpers) {
    ensureRuntime(state);
    for (const sq of state.squads.values()) {
      finalizeSquadState(state, sq, dt, helpers);
    }
  }

  function updateResumeOrders(state, dt, helpers) {
    ensureRuntime(state);
    for (const sq of state.squads.values()) {
      if (!sq.combat?._pendingResume) continue;
      exitCombat(state, sq);
      finalizeSquadState(state, sq, dt, helpers);
    }
  }

  // ─── Squad Speed Cache ────────────────────────────────────────────

  function cacheSquadSpeed(state, squad, helpers) {
    const units = getSquadUnits(state, squad);
    if (!units.length) { squad._cachedBaseSpeed = 0; return; }
    let slowest = Infinity;
    for (const u of units) {
      const spd = helpers.getUnitBaseSpeed ? helpers.getUnitBaseSpeed(u) : (u.speed || 9);
      if (spd < slowest) slowest = spd;
    }
    squad._cachedBaseSpeed = slowest;
  }

  function getSquadSpeed(state, squadId) {
    const sq = state.squads.get(squadId);
    return sq ? (sq._cachedBaseSpeed ?? 9) : 9;
  }

  // ─── Smooth Formation Facing ─────────────────────────────────────

  function lerpFacing(state, squad, dt) {
    const cur = squad.formation.facing ?? 0;
    const tgt = squad.formation.targetFacing ?? cur;
    let delta = tgt - cur;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    if (Math.abs(delta) < 0.01) {
      squad.formation.facing = tgt;
      return;
    }
    const step = config.facingLerpSpeed * dt;
    if (Math.abs(delta) <= step) {
      squad.formation.facing = tgt;
    } else {
      squad.formation.facing = cur + Math.sign(delta) * step;
    }
  }

  // ─── Main Step ────────────────────────────────────────────────────

  function step(state, dt, helpers) {
    ensureRuntime(state);
    syncSquadsFromState(state);
    buildEngagementZones(state, helpers);
    updateSquadCombatState(state, helpers);
    updateCombat(state, dt, helpers);
    updateResumeOrders(state, dt, helpers);
  }

  // ─── Public API ───────────────────────────────────────────────────

  const api = {
    CONFIG: config,
    loadConfig,
    ensureRuntime,
    bootstrapFromUnits,
    syncSquadsFromState,
    createSquad,
    destroySquad,
    getSquadUnits,
    getLeader,
    getSquadCenter,
    getSquadList,
    getZoneList,
    setSquadFormation,
    requestFormationRecalc,
    canRecalculateFormation,
    recalculateFormation,
    issueMoveOrder,
    issueAttackUnitOrder,
    issueSiegeOrder,
    issuePirateBaseOrder,
    issueCaptureOrder,
    setSquadFocusTarget,
    isOrderLocked,
    clearCombatForSquad,
    mergeSquads,
    splitSquadByType,
    mergeRouteCompatibleSquads,
    buildEngagementZones,
    updateSquadCombatState,
    updateCombat,
    updateResumeOrders,
    step,
    getSquadEngagementRadius,
    getZoneJoinRadius,
    getUnitMovementTarget,
    getUnitFirePlan,
    getZoneBoundarySteer,
    getLaneClampForUnit,
    recordDamageSource,
    cloneOrder,
    getSquadSpeed,
    cacheSquadSpeed,
    getSquadDebugState
  };

  if (typeof window !== "undefined") window.SQUADLOGIC = api;
  if (typeof module !== "undefined") module.exports = api;
})();
