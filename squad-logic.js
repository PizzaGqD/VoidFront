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
    autoJoinDistanceThreshold: 300,
    zoneMergeOverlap: 0.5,
    facingLerpSpeed: 3.0,
    steeringPush: 0.6,
    steeringRadius: 40
  };

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

  function cloneWaypoints(wp) {
    return Array.isArray(wp) ? wp.map(clonePoint).filter(Boolean) : [];
  }

  function cloneOrder(order) {
    if (!order) return null;
    return {
      type: order.type || "idle",
      waypoints: cloneWaypoints(order.waypoints),
      holdPoint: clonePoint(order.holdPoint),
      targetUnitId: order.targetUnitId,
      targetCityId: order.targetCityId,
      mineId: order.mineId,
      angle: order.angle,
      suppressPathPreview: !!order.suppressPathPreview
    };
  }

  function ensureRuntime(state) {
    if (!state.squads) state.squads = new Map();
    if (!state.engagementZones) state.engagementZones = new Map();
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
      resumeOrder: cloneOrder(c?.resumeOrder)
    };
  }

  function buildDefaultOrder(leader) {
    if (!leader) return { type: "idle", waypoints: [] };
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

    if (opts.allowAutoJoinRecentSpawn) {
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
      if ((other.autoGroupUntil ?? -Infinity) < now) continue;
      if (other.combat.mode !== "idle") continue;
      if (!areOrdersCompatible(other, squad)) continue;
      if (!best || (other.createdAt ?? 0) < (best.createdAt ?? 0)) best = other;
    }
    if (!best) return null;
    return absorbSquad(state, best, squad);
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
        formationType: form.type, formationRows: form.rows, formationWidth: form.width, order: existing
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

  function issueMoveOrder(state, squadId, waypoints, angle) {
    const order = { type: "move", waypoints, holdPoint: null, angle, suppressPathPreview: false };
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

  function issueAttackUnitOrder(state, squadId, targetUnitId, waypoints) {
    const order = { type: "attackUnit", targetUnitId, waypoints: cloneWaypoints(waypoints), suppressPathPreview: true };
    const queued = queueIfLocked(state, squadId, order);
    if (queued) return queued;
    clearCombatForSquad(state, squadId, false);
    return setSquadOrder(state, squadId, order);
  }

  function issueSiegeOrder(state, squadId, targetCityId, waypoints) {
    const order = { type: "siege", targetCityId, waypoints: cloneWaypoints(waypoints), suppressPathPreview: true };
    const queued = queueIfLocked(state, squadId, order);
    if (queued) return queued;
    clearCombatForSquad(state, squadId, false);
    return setSquadOrder(state, squadId, order);
  }

  function issueCaptureOrder(state, squadId, mineId, point, waypoints) {
    const wp = cloneWaypoints(waypoints != null ? waypoints : (point ? [point] : []));
    const order = { type: "capture", mineId, waypoints: wp, suppressPathPreview: false };
    const queued = queueIfLocked(state, squadId, order);
    if (queued) return queued;
    clearCombatForSquad(state, squadId, false);
    return setSquadOrder(state, squadId, order);
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

  function buildEngagementZones(state, helpers) {
    ensureRuntime(state);
    const squads = [...state.squads.values()].filter((sq) => getSquadUnits(state, sq).length > 0);

    const pairSet = new Set();

    for (let i = 0; i < squads.length; i++) {
      for (let j = i + 1; j < squads.length; j++) {
        const sA = squads[i], sB = squads[j];
        if (sA.ownerId === sB.ownerId) continue;
        if (unitPairInRange(state, sA, sB, helpers)) {
          pairSet.add(sA.id + ":" + sB.id);
        }
      }
    }

    const squadToZone = new Map();

    for (const zone of state.engagementZones.values()) {
      const alive = (zone.squadIds || []).filter((sid) => {
        const s = state.squads.get(sid);
        return s && getSquadUnits(state, s).length > 0;
      });
      let hasConflict = false;
      const owners = new Set();
      for (const sid of alive) {
        const sq = state.squads.get(sid);
        if (sq) owners.add(sq.ownerId);
      }
      if (owners.size >= 2) hasConflict = true;

      if (!hasConflict) {
        for (const sid of alive) {
          const sq = state.squads.get(sid);
          if (sq && sq.combat.mode !== "idle") exitCombat(state, sq);
        }
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
      if (sq._zoneImmunityUntil && state.t < sq._zoneImmunityUntil) continue;
      for (const zone of state.engagementZones.values()) {
        if (zone.squadIds.includes(sq.id)) continue;
        const zoneOwners = new Set(zone.squadIds.map((sid) => state.squads.get(sid)?.ownerId));
        if (zoneOwners.has(sq.ownerId) && zoneOwners.size < 2) continue;

        const sqUnits = getSquadUnits(state, sq);
        let touching = false;
        const joinR = (zone.displayRadius || zone.radius || 70) + 20;

        for (const u of sqUnits) {
          if (zone.anchorX != null && d(u.x, u.y, zone.anchorX, zone.anchorY) <= joinR) {
            touching = true; break;
          }
        }

        if (!touching) {
          const zUnits = [];
          for (const sid of zone.squadIds) {
            const s = state.squads.get(sid);
            if (s && s.ownerId !== sq.ownerId) zUnits.push(...getSquadUnits(state, s));
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

    for (const zone of state.engagementZones.values()) {
      updateZoneGeometry(state, zone);
    }
  }

  function unitPairInRange(state, sqA, sqB, helpers) {
    const uA = getSquadUnits(state, sqA), uB = getSquadUnits(state, sqB);
    for (const a of uA) {
      const aR = (helpers.getUnitAtkRange ? helpers.getUnitAtkRange(a) : 60) * config.engageRangeFactor;
      for (const b of uB) {
        if (d(a.x, a.y, b.x, b.y) <= aR) return true;
      }
    }
    return false;
  }

  const ZONE_MIN_R = 168;
  const ZONE_RADIUS_UPDATE_INTERVAL = 1.0;

  function updateZoneGeometry(state, zone) {
    let sx = 0, sy = 0, cnt = 0, rad = 0;
    for (const sid of zone.squadIds) {
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
        for (const u of getSquadUnits(state, state.squads.get(sid))) {
          rad = Math.max(rad, d(zone.anchorX, zone.anchorY, u.x, u.y));
        }
      }
      const zoneMaxR = ZONE_MIN_R * 2;
      const shipScale = Math.min(1, cnt / 30);
      const dynamicMax = ZONE_MIN_R + (zoneMaxR - ZONE_MIN_R) * shipScale;
      const desiredRadius = Math.min(dynamicMax, Math.max(ZONE_MIN_R, rad + 30));
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

  function updateSquadCombatState(state, squad, helpers) {
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
      return;
    }

    if (squad.combat.mode === "approach" || squad.combat.mode === "engaged") {
      if (squad.combat._disengageTimer == null) {
        squad.combat._disengageTimer = state.t + config.disengageDelay;
      }
      if (state.t >= squad.combat._disengageTimer) {
        exitCombat(state, squad);
      }
      return;
    }

    squad.combat.mode = "idle";
    squad.combat.zoneId = null;
    squad.combat._disengageTimer = null;
  }

  function findZoneForSquad(state, squadId) {
    for (const zone of state.engagementZones.values()) {
      if (zone.squadIds.includes(squadId)) return zone;
    }
    return null;
  }

  function exitCombat(state, squad) {
    squad.combat.mode = "idle";
    squad.combat.zoneId = null;
    squad.combat._disengageTimer = null;
    squad._zoneImmunityUntil = state.t + 3;

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
    applyCompatibility(state, squad);

    for (const u of getSquadUnits(state, squad)) {
      u._combatState = "idle";
      u._currentTargetId = undefined;
      u._squadCombatPhase = null;
      u._engagementZoneId = null;
    }
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
      if (order.waypoints && order.waypoints.length > 0) {
        const wp = order.waypoints[0];
        desX = wp.x; desY = wp.y;
        desFacing = order.angle ?? Math.atan2(wp.y - center.y, wp.x - center.x);
        if (d(center.x, center.y, wp.x, wp.y) <= config.waypointReachRadius) {
          order.holdPoint = clonePoint(wp);
          order.waypoints.shift();
          if (order.waypoints.length > 0) {
            desX = order.waypoints[0].x; desY = order.waypoints[0].y;
            desFacing = order.angle ?? Math.atan2(desY - center.y, desX - center.x);
          }
        }
      } else if (order.holdPoint) {
        desX = order.holdPoint.x; desY = order.holdPoint.y;
        desFacing = order.angle ?? desFacing;
      }
    } else if (order.type === "attackUnit") {
      const target = getUnit(state, order.targetUnitId);
      if (!target || target.hp <= 0) {
        squad.order = { type: "idle", waypoints: [] };
      } else if (order.waypoints && order.waypoints.length > 0) {
        const wp = order.waypoints[0];
        desX = wp.x; desY = wp.y;
        desFacing = Math.atan2(wp.y - center.y, wp.x - center.x);
        if (d(center.x, center.y, wp.x, wp.y) <= config.waypointReachRadius) order.waypoints.shift();
      } else {
        desX = target.x; desY = target.y;
        desFacing = Math.atan2(target.y - center.y, target.x - center.x);
      }
    } else if (order.type === "siege") {
      const city = order.targetCityId != null ? state.players.get(order.targetCityId) : null;
      if (!city || city.eliminated) {
        squad.order = { type: "idle", waypoints: [] };
      } else if (order.waypoints && order.waypoints.length > 0) {
        const wp = order.waypoints[0];
        desX = wp.x; desY = wp.y;
        desFacing = Math.atan2(wp.y - center.y, wp.x - center.x);
        if (d(center.x, center.y, wp.x, wp.y) <= config.waypointReachRadius) order.waypoints.shift();
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

  function getUnitMovementTarget(u, state, helpers) {
    ensureRuntime(state);
    const sq = u.squadId != null ? state.squads.get(u.squadId) : null;
    if (!sq) return { tx: u.x, ty: u.y, moveMode: "stop" };
    const leader = getLeader(state, sq);
    if (!leader) return { tx: u.x, ty: u.y, moveMode: "stop" };

    // ── Engaged mode: FREE CHASE to nearest enemy ──
    if (sq.combat.mode === "engaged") {
      const zone = sq.combat.zoneId != null ? state.engagementZones.get(sq.combat.zoneId) : null;
      const enemies = getEnemiesInZone(state, sq, zone);

      let targetPos = null;
      if (typeof COMBAT !== "undefined" && COMBAT.pickTarget) {
        const target = COMBAT.pickTarget(u, enemies, state);
        if (target) targetPos = { x: target.x, y: target.y };
      } else {
        let best = null, bestD = Infinity;
        for (const e of enemies) {
          const dd = d(u.x, u.y, e.x, e.y);
          if (dd < bestD) { bestD = dd; best = e; }
        }
        if (best) {
          u._currentTargetId = best.id;
          targetPos = { x: best.x, y: best.y };
        }
      }

      if (targetPos && zone) {
        const clamped = clampToZone(targetPos.x, targetPos.y, zone);
        return { tx: clamped.x, ty: clamped.y, moveMode: "free_chase" };
      }
      if (targetPos) return { tx: targetPos.x, ty: targetPos.y, moveMode: "free_chase" };

      return { tx: u.x, ty: u.y, moveMode: "stop" };
    }

    // ── Siege circle formation around target ──
    if (sq.order.type === "siege" && sq.order.waypoints && sq.order.waypoints.length === 0) {
      const city = sq.order.targetCityId != null ? state.players.get(sq.order.targetCityId) : null;
      if (city && !city.eliminated) {
        const units = getSquadUnits(state, sq);
        const avgR = getAvgAttackRange(units, helpers);
        const shR = helpers.shieldRadius ? helpers.shieldRadius(city) : 0;
        const circleR = Math.max(shR + 8, avgR * 0.85);
        const idx = units.indexOf(u);
        const angle = (idx / units.length) * Math.PI * 2;
        const tx = city.x + Math.cos(angle) * circleR;
        const ty = city.y + Math.sin(angle) * circleR;
        return { tx, ty, moveMode: "squad_anchor" };
      }
    }

    // ── Approach / Move / Idle: formation-based ──
    const facing = sq.formation.targetFacing ?? sq.formation.facing ?? leader._lastFacingAngle ?? 0;
    const anchorX = sq.anchor.x ?? leader.x;
    const anchorY = sq.anchor.y ?? leader.y;

    if (u.id === sq.leaderUnitId) {
      return { tx: anchorX, ty: anchorY, moveMode: sq.combat.mode === "approach" ? "formation_approach" : (sq.order.type !== "idle" ? "squad_anchor" : "formation_hold") };
    }

    const target = getSlotPosition(state, sq, u, leader, anchorX, anchorY, facing);
    const mode = sq.combat.mode === "approach" ? "formation_approach" : (sq.order.type !== "idle" && sq.order.type != null ? "formation_move" : "formation_hold");
    return { tx: target.x, ty: target.y, moveMode: mode };
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
    if (!zone) {
      if (squad.order.type === "attackUnit") {
        const t = getUnit(state, squad.order.targetUnitId);
        return t && t.hp > 0 ? [t] : [];
      }
      return [];
    }
    const out = [];
    for (const sid of zone.squadIds) {
      const other = state.squads.get(sid);
      if (!other || other.ownerId === squad.ownerId) continue;
      out.push(...getSquadUnits(state, other));
    }
    return out;
  }

  function chooseLocalTarget(u, state, helpers) {
    const sq = u.squadId != null ? state.squads.get(u.squadId) : null;
    if (!sq) return null;
    const range = helpers.getUnitAtkRange ? helpers.getUnitAtkRange(u) : (u.attackRange || 60);
    const zone = sq.combat.zoneId != null ? state.engagementZones.get(sq.combat.zoneId) : null;
    const enemies = getEnemiesInZone(state, sq, zone);

    const cur = u._localTargetId != null ? state.units.get(u._localTargetId) : null;
    if (cur && cur.hp > 0 && d(u.x, u.y, cur.x, cur.y) <= range) return cur;

    let best = null, bestD = Infinity;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const dd = d(u.x, u.y, e.x, e.y);
      if (dd <= range && dd < bestD) { bestD = dd; best = e; }
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
        if (d(u.x, u.y, city.x, city.y) <= pR * 2.5) {
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
      else if (squad.order.type === "siege") u._combatState = "move";
      else if (squad.order.type === "attackUnit") u._combatState = "chase";
      else if (squad.order.type === "move" || squad.order.type === "capture") u._combatState = "move";
      else u._combatState = "idle";
    }

    const leader = getLeader(state, squad);
    if (leader) {
      leader._squadCombatPhase = phase;
      leader._engagedEnemyIds = engagedEnemyIds.size ? engagedEnemyIds : null;
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
    squad.formation.dirty = true;
    squad.formation.dirtyAt = state.t ?? 0;
  }

  // ─── Main Step ────────────────────────────────────────────────────

  function step(state, dt, helpers) {
    ensureRuntime(state);
    syncSquadsFromState(state);
    buildEngagementZones(state, helpers);

    for (const sq of state.squads.values()) {
      cacheSquadSpeed(state, sq, helpers);
      updateSquadCombatState(state, sq, helpers);
    }
    for (const sq of state.squads.values()) {
      lerpFacing(state, sq, dt);
      updateOrderAnchors(state, sq, helpers);
      recalculateFormation(state, sq.id, helpers, false);
      applyCompatibility(state, sq);
      writeCompatFields(state, sq);
    }
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
    issueCaptureOrder,
    clearCombatForSquad,
    mergeSquads,
    splitSquadByType,
    step,
    getSquadEngagementRadius,
    getZoneJoinRadius,
    getUnitMovementTarget,
    getUnitFirePlan,
    getZoneBoundarySteer,
    recordDamageSource,
    cloneOrder,
    getSquadSpeed,
    cacheSquadSpeed
  };

  if (typeof window !== "undefined") window.SQUADLOGIC = api;
  if (typeof module !== "undefined") module.exports = api;
})();
