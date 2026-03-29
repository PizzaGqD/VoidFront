(function () {
  "use strict";

  const DEFAULT_POLICY = Object.freeze({
    left: { weight: 30, mode: "push" },
    center: { weight: 40, mode: "push" },
    right: { weight: 30, mode: "push" }
  });

  const ASSIGN_LOCK_SEC = 3.0;
  const REISSUE_SEC = 1.25;
  const CENTER_MINE_RADIUS = 165;
  const CORE_DEFENSE_THREAT_RADIUS = 235;
  const CORE_DEFENSE_RESPONSE_RADIUS = 300;
  const SIDE_MINE_EDGE_T = 0.24;
  const SIDE_LANE_HALF_WIDTH = 130;
  const CENTER_LANE_HALF_WIDTH = 162;
  const SIDE_MINE_OUTER_OFFSET = SIDE_LANE_HALF_WIDTH + 34;
  const LANE_BATTLE_THREAT_RADIUS = 240;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function clampWeight(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function clonePolicy(policy) {
    const src = policy || DEFAULT_POLICY;
    return {
      left: {
        weight: clampWeight(src.left && src.left.weight, DEFAULT_POLICY.left.weight),
        mode: src.left && src.left.mode || DEFAULT_POLICY.left.mode
      },
      center: {
        weight: clampWeight(src.center && src.center.weight, DEFAULT_POLICY.center.weight),
        mode: src.center && src.center.mode || DEFAULT_POLICY.center.mode
      },
      right: {
        weight: clampWeight(src.right && src.right.weight, DEFAULT_POLICY.right.weight),
        mode: src.right && src.right.mode || DEFAULT_POLICY.right.mode
      }
    };
  }

  function ensureState(state) {
    if (!state.coreFrontPolicies) state.coreFrontPolicies = {};
    if (!state.frontGraph) state.frontGraph = {};
    if (!state.squadFrontAssignments) state.squadFrontAssignments = {};
    if (!state.centerObjectives) {
      state.centerObjectives = {
        centerX: 0,
        centerY: 0,
        richMineId: null,
        centerMineIds: [],
        pirateBaseIds: [],
        livePirateBaseIds: [],
        securedByPlayerId: null,
        requiredMineCount: 0
      };
    }
  }

  function getCoreFrontPolicy(state, coreId) {
    ensureState(state);
    if (!state.coreFrontPolicies[coreId]) state.coreFrontPolicies[coreId] = clonePolicy(DEFAULT_POLICY);
    return state.coreFrontPolicies[coreId];
  }

  function setCoreFrontPolicy(state, coreId, patch) {
    const base = clonePolicy(getCoreFrontPolicy(state, coreId));
    const next = clonePolicy({
      left: { ...base.left, ...(patch && patch.left) },
      center: { ...base.center, ...(patch && patch.center) },
      right: { ...base.right, ...(patch && patch.right) }
    });
    state.coreFrontPolicies[coreId] = next;
    return next;
  }

  function setCoreFrontWeights(state, coreId, weights) {
    return setCoreFrontPolicy(state, coreId, {
      left: { weight: weights && weights.left },
      center: { weight: weights && weights.center },
      right: { weight: weights && weights.right }
    });
  }

  function setCoreFrontMode(state, coreId, frontType, mode) {
    if (!frontType || !["left", "center", "right"].includes(frontType)) return getCoreFrontPolicy(state, coreId);
    return setCoreFrontPolicy(state, coreId, { [frontType]: { mode: mode || "push" } });
  }

  function getPirateBases(state) {
    if (Array.isArray(state.pirateBases) && state.pirateBases.length > 0) return state.pirateBases;
    return state.pirateBase ? [state.pirateBase] : [];
  }

  function getAliveCorePlayers(state) {
    const out = [];
    for (const p of state.players.values()) {
      if (!p || p.id == null || p.id <= 0) continue;
      if (p.eliminated) continue;
      out.push(p);
    }
    return out;
  }

  function getWorldCenter(state) {
    const pirateBases = getPirateBases(state);
    if (pirateBases.length > 0) {
      const withOrbit = pirateBases.find((pb) => pb && pb.orbitCenter);
      if (withOrbit && withOrbit.orbitCenter) {
        return { x: withOrbit.orbitCenter.x, y: withOrbit.orbitCenter.y };
      }
      let px = 0, py = 0;
      for (const pb of pirateBases) { px += pb.x || 0; py += pb.y || 0; }
      return { x: px / pirateBases.length, y: py / pirateBases.length };
    }

    let richMine = null;
    for (const mine of state.mines.values()) {
      if (!richMine && mine && mine.isRich) richMine = mine;
    }
    if (richMine) return { x: richMine.x, y: richMine.y };

    const players = getAliveCorePlayers(state);
    if (players.length === 0) return { x: 0, y: 0 };
    let x = 0, y = 0;
    for (const p of players) { x += p.x; y += p.y; }
    return { x: x / players.length, y: y / players.length };
  }

  function sortCoreEntriesByAngle(entries, center) {
    const pivot = center || { x: 0, y: 0 };
    return (entries || [])
      .filter((entry) => entry && entry.id != null)
      .map((entry) => ({
        id: entry.id,
        x: entry.x || 0,
        y: entry.y || 0,
        eliminated: !!entry.eliminated,
        angle: Math.atan2((entry.y || 0) - pivot.y, (entry.x || 0) - pivot.x)
      }))
      .sort((a, b) => a.angle - b.angle);
  }

  function buildAdjacentCorePairs(entries, center) {
    const ordered = sortCoreEntriesByAngle(entries, center);
    const out = [];
    const seen = new Set();
    if (ordered.length < 2) return out;
    for (let i = 0; i < ordered.length; i++) {
      const a = ordered[i];
      const b = ordered[(i + 1) % ordered.length];
      if (!a || !b || a.id === b.id) continue;
      const pairKey = [a.id, b.id].sort((x, y) => x - y).join(":");
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      out.push({
        aCoreId: a.id,
        bCoreId: b.id,
        a,
        b,
        midpoint: { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 }
      });
    }
    return out;
  }

  function getCoreLaneNeighbors(entries, center) {
    const ordered = sortCoreEntriesByAngle(entries, center);
    const out = {};
    for (let i = 0; i < ordered.length; i++) {
      const core = ordered[i];
      const left = ordered.length > 1 ? ordered[(i - 1 + ordered.length) % ordered.length] : null;
      const right = ordered.length > 1 ? ordered[(i + 1) % ordered.length] : null;
      out[core.id] = { core, left, right };
    }
    return out;
  }

  function getAllCorePlayers(state) {
    const out = [];
    for (const p of state.players.values()) {
      if (!p || p.id == null || p.id <= 0) continue;
      out.push(p);
    }
    return out;
  }

  function buildDirectionalRoute(orderedCores, startIndex, dir) {
    const out = [];
    let targetCoreId = null;
    if (!Array.isArray(orderedCores) || orderedCores.length < 2) return { targetCoreId, waypoints: out };
    for (let step = 1; step < orderedCores.length; step++) {
      const idx = (startIndex + dir * step + orderedCores.length * 8) % orderedCores.length;
      const node = orderedCores[idx];
      if (!node) continue;
      out.push({
        x: node.x || 0,
        y: node.y || 0,
        coreId: node.id,
        eliminated: !!node.eliminated
      });
      if (!node.eliminated) {
        targetCoreId = node.id;
        break;
      }
    }
    return { targetCoreId, waypoints: out };
  }

  function buildDuelGhostRingEntries(entries, center) {
    const ordered = sortCoreEntriesByAngle(entries, center);
    if (ordered.length !== 2) return ordered;
    const a = ordered[0];
    const b = ordered[1];
    if (Math.abs((a.x || 0) - (b.x || 0)) < 8 || Math.abs((a.y || 0) - (b.y || 0)) < 8) {
      return ordered;
    }
    const candidates = [
      {
        id: "ghost:" + a.id + ":" + b.id + ":a",
        x: a.x || 0,
        y: b.y || 0,
        eliminated: true,
        isGhost: true
      },
      {
        id: "ghost:" + a.id + ":" + b.id + ":b",
        x: b.x || 0,
        y: a.y || 0,
        eliminated: true,
        isGhost: true
      }
    ];
    const ghosts = candidates.filter((ghost, index) => {
      if (Math.hypot((ghost.x || 0) - (a.x || 0), (ghost.y || 0) - (a.y || 0)) < 8) return false;
      if (Math.hypot((ghost.x || 0) - (b.x || 0), (ghost.y || 0) - (b.y || 0)) < 8) return false;
      for (let i = 0; i < index; i++) {
        const other = candidates[i];
        if (Math.hypot((ghost.x || 0) - (other.x || 0), (ghost.y || 0) - (other.y || 0)) < 8) return false;
      }
      return true;
    });
    return sortCoreEntriesByAngle([a, b, ...ghosts], center);
  }

  function closestPointOnSegment(point, a, b) {
    const dx = (b.x || 0) - (a.x || 0);
    const dy = (b.y || 0) - (a.y || 0);
    const len2 = dx * dx + dy * dy;
    if (len2 <= 1e-6) return { x: a.x || 0, y: a.y || 0, t: 0 };
    const t = clamp((((point.x || 0) - (a.x || 0)) * dx + ((point.y || 0) - (a.y || 0)) * dy) / len2, 0, 1);
    return {
      x: (a.x || 0) + dx * t,
      y: (a.y || 0) + dy * t,
      t
    };
  }

  function distanceToSegment(point, a, b) {
    const closest = closestPointOnSegment(point, a, b);
    return {
      point: closest,
      dist: Math.hypot((point.x || 0) - closest.x, (point.y || 0) - closest.y),
      t: closest.t
    };
  }

  function getLaneLength(segments) {
    let total = 0;
    for (const segment of segments || []) {
      if (!segment || !segment.from || !segment.to) continue;
      const len = Math.hypot((segment.to.x || 0) - (segment.from.x || 0), (segment.to.y || 0) - (segment.from.y || 0));
      total += len;
    }
    return total;
  }

  function getLaneProjection(point, segments) {
    let best = null;
    let traveled = 0;
    for (const segment of segments || []) {
      if (!segment || !segment.from || !segment.to) continue;
      const len = Math.hypot((segment.to.x || 0) - (segment.from.x || 0), (segment.to.y || 0) - (segment.from.y || 0));
      if (len <= 1e-6) continue;
      const sample = distanceToSegment(point, segment.from, segment.to);
      if (!best || sample.dist - (segment.halfWidth || 0) < best.score) {
        best = {
          point: sample.point,
          dist: sample.dist,
          halfWidth: segment.halfWidth || 0,
          score: sample.dist - (segment.halfWidth || 0),
          to: segment.to,
          progress: traveled + len * sample.t
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
          progress: progress
        };
      }
      remaining -= len;
    }
    const last = segments && segments.length ? segments[segments.length - 1] : null;
    return last && last.to ? { x: last.to.x || 0, y: last.to.y || 0, progress: getLaneLength(segments) } : null;
  }

  function getLaneReturnPoint(point, segments, minProgress) {
    const best = getLaneProjection(point, segments);
    if (!best) return null;
    const laneLength = getLaneLength(segments);
    const minClamped = clamp(minProgress || 0, 0, laneLength);
    const clamped = best.progress < minClamped
      ? getPointOnLaneAtProgress(segments, minClamped)
      : { x: best.point.x, y: best.point.y, progress: best.progress };
    if (!clamped) return null;
    if (best.dist <= best.halfWidth && clamped.progress <= best.progress + 1e-3) return null;
    return {
      x: clamped.x,
      y: clamped.y,
      progress: clamped.progress
    };
  }

  function buildLaneAdvanceWaypoints(segments, startProgress) {
    const out = [];
    const laneLength = getLaneLength(segments);
    const start = clamp(startProgress || 0, 0, laneLength);
    if (start > 8) {
      const leadPoint = getPointOnLaneAtProgress(segments, Math.min(laneLength, start + 42));
      if (leadPoint && leadPoint.progress > start + 6) pushUniqueWaypoint(out, leadPoint, 8);
    }
    let traveled = 0;
    for (const segment of segments || []) {
      if (!segment || !segment.from || !segment.to) continue;
      const len = Math.hypot((segment.to.x || 0) - (segment.from.x || 0), (segment.to.y || 0) - (segment.from.y || 0));
      if (len <= 1e-6) continue;
      const segEnd = traveled + len;
      if (segEnd <= start + 6) {
        traveled = segEnd;
        continue;
      }
      pushUniqueWaypoint(out, segment.to, 8);
      traveled = segEnd;
    }
    return out;
  }

  function getLaneSiegeHoldPoint(segments, standOff) {
    const laneLength = getLaneLength(segments);
    if (!(laneLength > 1)) return null;
    const desiredStandOff = Math.max(56, standOff || 96);
    const progress = clamp(laneLength - desiredStandOff, 0, laneLength);
    return getPointOnLaneAtProgress(segments, progress);
  }

  function pushUniqueWaypoint(waypoints, point, minDist) {
    if (!Array.isArray(waypoints) || !point) return;
    const last = waypoints.length ? waypoints[waypoints.length - 1] : null;
    const threshold = minDist != null ? minDist : 10;
    if (last && Math.hypot((last.x || 0) - (point.x || 0), (last.y || 0) - (point.y || 0)) <= threshold) return;
    waypoints.push({ x: point.x || 0, y: point.y || 0 });
  }

  function buildSideLaneMinePlacements(entries, center) {
    const laneEntries = Array.isArray(entries) && entries.length === 2
      ? buildDuelGhostRingEntries(entries, center)
      : entries;
    const pairs = buildAdjacentCorePairs(laneEntries, center);
    const out = [];
    for (const pair of pairs) {
      const dx = pair.b.x - pair.a.x;
      const dy = pair.b.y - pair.a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const midOffset = Math.min(SIDE_MINE_OUTER_OFFSET, len * 0.22);
      const midMoney = {
        x: pair.midpoint.x + nx * midOffset,
        y: pair.midpoint.y + ny * midOffset,
        resourceType: "money",
        laneRole: "mid",
        pairKey: pair.aCoreId + ":" + pair.bCoreId,
        triggerTo: { x: pair.midpoint.x, y: pair.midpoint.y }
      };
      const midXp = {
        x: pair.midpoint.x - nx * midOffset,
        y: pair.midpoint.y - ny * midOffset,
        resourceType: "xp",
        laneRole: "mid",
        pairKey: pair.aCoreId + ":" + pair.bCoreId,
        triggerTo: { x: pair.midpoint.x, y: pair.midpoint.y }
      };
      out.push(midMoney, midXp);
    }
    return out;
  }

  function frontSourceTag(frontType) {
    return ["left", "center", "right"].includes(frontType) ? ("front:" + frontType) : null;
  }

  function getTaggedFrontType(squad) {
    if (!squad || typeof squad.sourceTag !== "string") return null;
    const match = /^front:(left|center|right)$/.exec(squad.sourceTag);
    return match ? match[1] : null;
  }

  function buildCenterObjectives(state) {
    ensureState(state);
    const center = getWorldCenter(state);
    let richMineId = null;
    const centerMineIds = [];
    const mineOwnerCounts = {};

    for (const mine of state.mines.values()) {
      if (!mine) continue;
      const dist = Math.hypot((mine.x || 0) - center.x, (mine.y || 0) - center.y);
      if (mine.isRich && richMineId == null) richMineId = mine.id;
      if (mine.isRich || dist <= CENTER_MINE_RADIUS) {
        centerMineIds.push(mine.id);
        if (mine.ownerId != null && mine.ownerId > 0 && mine.captureProgress >= 1) {
          mineOwnerCounts[mine.ownerId] = (mineOwnerCounts[mine.ownerId] || 0) + 1;
        }
      }
    }

    const pirateBases = getPirateBases(state);
    const livePirateBaseIds = pirateBases.filter((pb) => pb && (pb.hp == null || pb.hp > 0)).map((pb) => pb.id);
    const requiredMineCount = centerMineIds.length > 0 ? Math.max(1, Math.ceil(centerMineIds.length * 0.5)) : 0;
    let securedByPlayerId = null;
    if (livePirateBaseIds.length === 0) {
      let bestOwner = null;
      let bestCount = 0;
      for (const ownerId of Object.keys(mineOwnerCounts)) {
        const count = mineOwnerCounts[ownerId];
        if (count > bestCount) {
          bestCount = count;
          bestOwner = ownerId;
        }
      }
      if (bestOwner != null && bestCount >= requiredMineCount) securedByPlayerId = Number(bestOwner);
    }

    state.centerObjectives = {
      centerX: center.x,
      centerY: center.y,
      richMineId,
      centerMineIds,
      pirateBaseIds: pirateBases.map((pb) => pb.id),
      livePirateBaseIds,
      securedByPlayerId,
      requiredMineCount
    };
    return state.centerObjectives;
  }

  function buildFrontGraph(state) {
    ensureState(state);
    const center = getWorldCenter(state);
    const allCores = sortCoreEntriesByAngle(getAllCorePlayers(state), center);
    const liveCores = allCores.filter((core) => !core.eliminated);

    if (allCores.length === 2) {
      const ringEntries = buildDuelGhostRingEntries(allCores, center);
      const nextGraph = {};
      for (let i = 0; i < ringEntries.length; i++) {
        const core = ringEntries[i];
        if (!core || core.eliminated) continue;
        const leftRoute = buildDirectionalRoute(ringEntries, i, -1);
        const rightRoute = buildDirectionalRoute(ringEntries, i, 1);
        const enemyCoreIds = liveCores.filter((entry) => entry.id !== core.id).map((entry) => entry.id);
        nextGraph[core.id] = {
          coreId: core.id,
          leftTargetCoreId: leftRoute.targetCoreId,
          rightTargetCoreId: rightRoute.targetCoreId,
          leftPath: leftRoute.waypoints,
          rightPath: rightRoute.waypoints,
          enemyCoreIds,
          centerMode: state.centerObjectives && state.centerObjectives.securedByPlayerId === core.id ? "fanout" : "secure"
        };
      }
      state.frontGraph = nextGraph;
      return nextGraph;
    }

    const nextGraph = {};
    for (let i = 0; i < allCores.length; i++) {
      const core = allCores[i];
      if (!core || core.eliminated) continue;
      const leftRoute = buildDirectionalRoute(allCores, i, -1);
      const rightRoute = buildDirectionalRoute(allCores, i, 1);
      const enemyCoreIds = liveCores.filter((entry) => entry.id !== core.id).map((entry) => entry.id);
      nextGraph[core.id] = {
        coreId: core.id,
        leftTargetCoreId: leftRoute.targetCoreId,
        rightTargetCoreId: rightRoute.targetCoreId,
        leftPath: leftRoute.waypoints,
        rightPath: rightRoute.waypoints,
        enemyCoreIds,
        centerMode: state.centerObjectives && state.centerObjectives.securedByPlayerId === core.id ? "fanout" : "secure"
      };
    }
    state.frontGraph = nextGraph;
    return nextGraph;
  }

  function buildOwnerSquadLists(state, squadLogic) {
    const byOwner = new Map();
    if (!state.squads) return byOwner;
    for (const sq of state.squads.values()) {
      if (!sq) continue;
      const unitCount = squadLogic.getSquadUnits(state, sq).length;
      if (unitCount <= 0) continue;
      let list = byOwner.get(sq.ownerId);
      if (!list) {
        list = [];
        byOwner.set(sq.ownerId, list);
      }
      list.push({ squad: sq, unitCount });
    }
    for (const list of byOwner.values()) {
      list.sort((a, b) => b.unitCount - a.unitCount || a.squad.id - b.squad.id);
    }
    return byOwner;
  }

  function listOwnerSquads(state, squadLogic, ownerId, ownerSquadLists) {
    const out = ownerSquadLists instanceof Map
      ? (ownerSquadLists.get(ownerId) || [])
      : [];
    if (out.length > 0) return out.map((entry) => entry.squad);
    if (!state.squads) return [];
    const fallback = [];
    for (const sq of state.squads.values()) {
      if (!sq || sq.ownerId !== ownerId) continue;
      const unitCount = squadLogic.getSquadUnits(state, sq).length;
      if (unitCount > 0) fallback.push({ squad: sq, unitCount });
    }
    const source = fallback.length > 0 ? fallback : out;
    source.sort((a, b) => b.unitCount - a.unitCount || a.squad.id - b.squad.id);
    return source.map((entry) => entry.squad);
  }

  function makeFrontTargets(policy, graph, centerObjectives) {
    const fronts = [];
    if (graph.leftTargetCoreId != null) {
      fronts.push({ frontType: "left", targetCoreId: graph.leftTargetCoreId, weight: 1 });
    }
    if (centerObjectives.centerMineIds.length > 0 || graph.enemyCoreIds.length > 0) {
      fronts.push({ frontType: "center", targetCoreId: null, weight: 1 });
    }
    if (graph.rightTargetCoreId != null) {
      fronts.push({ frontType: "right", targetCoreId: graph.rightTargetCoreId, weight: 1 });
    }
    if (fronts.length === 0 && graph.enemyCoreIds.length > 0) {
      fronts.push({ frontType: "center", targetCoreId: null, weight: 100 });
    }
    return fronts;
  }

  function allocateFrontCounts(fronts, squadCount) {
    if (!fronts.length || squadCount <= 0) return {};
    const totalWeight = fronts.reduce((sum, front) => sum + Math.max(0, front.weight || 0), 0) || fronts.length;
    const counts = {};
    let assigned = 0;
    const sorted = fronts.map((front) => ({
      frontType: front.frontType,
      exact: (Math.max(0, front.weight || 0) || 1) / totalWeight * squadCount
    }));

    for (const front of sorted) {
      counts[front.frontType] = Math.floor(front.exact);
      assigned += counts[front.frontType];
    }

    const priority = { center: 3, left: 2, right: 1 };
    sorted.sort((a, b) => {
      const fracA = a.exact - Math.floor(a.exact);
      const fracB = b.exact - Math.floor(b.exact);
      if (fracB !== fracA) return fracB - fracA;
      return (priority[b.frontType] || 0) - (priority[a.frontType] || 0);
    });

    while (assigned < squadCount && sorted.length > 0) {
      for (const front of sorted) {
        counts[front.frontType] = (counts[front.frontType] || 0) + 1;
        assigned++;
        if (assigned >= squadCount) break;
      }
    }

    return counts;
  }

  function splitSquadInHalf(state, squadLogic, squadId, helpers) {
    const sq = state.squads && state.squads.get(squadId);
    if (!sq) return [];
    const units = squadLogic.getSquadUnits(state, sq);
    if (units.length < 2) return [sq];
    const ids = units.map((u) => u.id);
    const cut = Math.floor(ids.length / 2);
    const firstIds = ids.slice(0, cut);
    const secondIds = ids.slice(cut);
    if (firstIds.length === 0 || secondIds.length === 0) return [sq];

    const order = squadLogic.cloneOrder(sq.order);
    const formation = { ...sq.formation };
    squadLogic.destroySquad(state, sq.id);
    const first = squadLogic.createSquad(state, firstIds, {
      ownerId: sq.ownerId,
      formationType: formation.type,
      formationRows: formation.rows,
      formationWidth: formation.width,
      sourceTag: sq.sourceTag || null,
      order
    });
    const second = squadLogic.createSquad(state, secondIds, {
      ownerId: sq.ownerId,
      formationType: formation.type,
      formationRows: formation.rows,
      formationWidth: formation.width,
      sourceTag: sq.sourceTag || null,
      order
    });
    const out = [];
    if (first) {
      squadLogic.recalculateFormation(state, first.id, helpers, true);
      out.push(first);
    }
    if (second) {
      squadLogic.recalculateFormation(state, second.id, helpers, true);
      out.push(second);
    }
    return out;
  }

  function ensureFanoutCapacity(state, squadLogic, ownerId, desiredCount, helpers) {
    let centerSquads = Object.values(state.squadFrontAssignments)
      .filter((entry) => entry && entry.ownerId === ownerId && entry.frontType === "center")
      .map((entry) => state.squads && state.squads.get(entry.squadId))
      .filter(Boolean);

    while (centerSquads.length < desiredCount) {
      let largest = null;
      let largestUnits = 0;
      for (const sq of centerSquads) {
        const unitCount = squadLogic.getSquadUnits(state, sq).length;
        if (unitCount > largestUnits) {
          largestUnits = unitCount;
          largest = sq;
        }
      }
      if (!largest || largestUnits < 2) break;
      delete state.squadFrontAssignments[largest.id];
      const split = splitSquadInHalf(state, squadLogic, largest.id, helpers);
      centerSquads = centerSquads.filter((sq) => sq.id !== largest.id).concat(split.filter(Boolean));
    }
    return centerSquads;
  }

  function rebuildAssignmentsForOwner(state, squadLogic, ownerId, graph, helpers, ownerSquadLists) {
    const policy = getCoreFrontPolicy(state, ownerId);
    const fronts = makeFrontTargets(policy, graph, state.centerObjectives);
    const squads = listOwnerSquads(state, squadLogic, ownerId, ownerSquadLists);

    for (const squadId of Object.keys(state.squadFrontAssignments)) {
      const entry = state.squadFrontAssignments[squadId];
      if (!entry || entry.ownerId !== ownerId) continue;
      if (!state.squads || !state.squads.has(entry.squadId)) delete state.squadFrontAssignments[squadId];
    }

    const activeTypes = new Set(fronts.map((front) => front.frontType));
    const now = state.t || 0;
    const assignmentsByType = { left: [], center: [], right: [] };
    const desiredCounts = allocateFrontCounts(fronts, Math.max(fronts.length, squads.length));

    const unassigned = [];
    for (const sq of squads) {
      const entry = state.squadFrontAssignments[sq.id];
      const taggedFrontType = getTaggedFrontType(sq);
      if (taggedFrontType && activeTypes.has(taggedFrontType)) {
        const front = fronts.find((item) => item.frontType === taggedFrontType) || null;
        if (!entry || entry.frontType !== taggedFrontType) {
          state.squadFrontAssignments[sq.id] = {
            squadId: sq.id,
            ownerId,
            frontId: ownerId + ":" + taggedFrontType,
            frontType: taggedFrontType,
            role: taggedFrontType === "center" ? "center" : "pressure",
            originCoreId: ownerId,
            targetCoreId: front ? front.targetCoreId : null,
            assignedAt: now,
            assignmentLockUntil: now + ASSIGN_LOCK_SEC,
            lastIssuedAt: entry && entry.lastIssuedAt || 0,
            lastOrderSignature: entry && entry.lastOrderSignature || ""
          };
        } else if (front) {
          entry.targetCoreId = front.targetCoreId;
          entry.frontId = ownerId + ":" + taggedFrontType;
        }
        assignmentsByType[taggedFrontType].push(state.squadFrontAssignments[sq.id]);
        continue;
      }
      if (!entry || !activeTypes.has(entry.frontType)) {
        unassigned.push(sq);
        continue;
      }
    }

    for (const sq of unassigned) {
      let bestFront = fronts[0] || null;
      let bestDeficit = -Infinity;
      for (const front of fronts) {
        const wanted = desiredCounts[front.frontType] || 0;
        const current = assignmentsByType[front.frontType].length;
        const deficit = wanted - current;
        const bias = front.frontType === "center" ? 0.1 : 0;
        if (deficit + bias > bestDeficit) {
          bestDeficit = deficit + bias;
          bestFront = front;
        }
      }
      if (!bestFront) continue;
      const entry = {
        squadId: sq.id,
        ownerId,
        frontId: ownerId + ":" + bestFront.frontType,
        frontType: bestFront.frontType,
        role: bestFront.frontType === "center" ? "center" : "pressure",
        originCoreId: ownerId,
        targetCoreId: bestFront.targetCoreId,
        assignedAt: now,
        assignmentLockUntil: now + ASSIGN_LOCK_SEC,
        lastIssuedAt: 0,
        lastOrderSignature: ""
      };
      state.squadFrontAssignments[sq.id] = entry;
      assignmentsByType[entry.frontType].push(entry);
    }

    if (graph.centerMode === "fanout" && graph.enemyCoreIds.length > 1) {
      const desiredCenterCount = Math.min(graph.enemyCoreIds.length, squads.length > 0 ? squads.length + 4 : 0);
      ensureFanoutCapacity(state, squadLogic, ownerId, desiredCenterCount, helpers);
      const refreshedSquads = listOwnerSquads(state, squadLogic, ownerId);
      for (const sq of refreshedSquads) {
        const existing = state.squadFrontAssignments[sq.id];
        if (existing || !squadLogic.getSquadUnits(state, sq).length) continue;
        state.squadFrontAssignments[sq.id] = {
          squadId: sq.id,
          ownerId,
          frontId: ownerId + ":center",
          frontType: "center",
          role: "center",
          originCoreId: ownerId,
          targetCoreId: null,
          assignedAt: now,
          assignmentLockUntil: now + ASSIGN_LOCK_SEC,
          lastIssuedAt: 0,
          lastOrderSignature: ""
        };
      }
      const centerEntries = Object.values(state.squadFrontAssignments)
        .filter((entry) => entry && entry.ownerId === ownerId && entry.frontType === "center")
        .sort((a, b) => a.squadId - b.squadId);
      for (let i = 0; i < centerEntries.length; i++) {
        centerEntries[i].targetCoreId = graph.enemyCoreIds[i % graph.enemyCoreIds.length] || null;
        centerEntries[i].frontId = ownerId + ":center:" + (centerEntries[i].targetCoreId ?? "secure");
      }
    } else {
      const securedCenterTargetId = state.centerObjectives && state.centerObjectives.securedByPlayerId === ownerId
        ? (graph.enemyCoreIds[0] || null)
        : null;
      for (const entry of Object.values(state.squadFrontAssignments)) {
        if (!entry || entry.ownerId !== ownerId || entry.frontType !== "center") continue;
        entry.targetCoreId = securedCenterTargetId;
        entry.frontId = ownerId + ":center:" + (securedCenterTargetId ?? "secure");
      }
    }
  }

  function getCoreDefenseThreat(state, ownerId, squadCenter) {
    const owner = state.players.get(ownerId);
    if (!owner || !squadCenter) return null;
    if (Math.hypot(squadCenter.x - owner.x, squadCenter.y - owner.y) > CORE_DEFENSE_RESPONSE_RADIUS) return null;
    let best = null;
    let bestScore = Infinity;
    for (const unit of state.units.values()) {
      if (!unit || unit.hp <= 0 || unit.owner === ownerId) continue;
      const distToCore = Math.hypot((unit.x || 0) - owner.x, (unit.y || 0) - owner.y);
      if (distToCore > CORE_DEFENSE_THREAT_RADIUS) continue;
      const distToSquad = Math.hypot((unit.x || 0) - squadCenter.x, (unit.y || 0) - squadCenter.y);
      const score = distToCore * 2 + distToSquad;
      if (score < bestScore) {
        bestScore = score;
        best = unit;
      }
    }
    return best;
  }

  function getFrontWaypoint(state, ownerId, frontType) {
    ensureState(state);
    const centerObjectives = state.centerObjectives && Number.isFinite(state.centerObjectives.centerX)
      ? state.centerObjectives
      : buildCenterObjectives(state);
    const frontGraph = state.frontGraph && state.frontGraph[ownerId]
      ? state.frontGraph
      : buildFrontGraph(state);
    const graph = frontGraph[ownerId] || {};
    if (frontType === "center") {
      return [{
        x: Number.isFinite(centerObjectives.centerX) ? centerObjectives.centerX : 0,
        y: Number.isFinite(centerObjectives.centerY) ? centerObjectives.centerY : 0
      }];
    }
    const path = frontType === "left" ? graph.leftPath : graph.rightPath;
    if (Array.isArray(path) && path.length > 0) {
      return path.map((point) => ({ x: point.x || 0, y: point.y || 0 }));
    }
    const targetId = frontType === "left" ? graph.leftTargetCoreId : graph.rightTargetCoreId;
    const target = targetId != null ? state.players.get(targetId) : null;
    if (target && !target.eliminated) return [{ x: target.x || 0, y: target.y || 0 }];
    return [{
      x: Number.isFinite(centerObjectives.centerX) ? centerObjectives.centerX : 0,
      y: Number.isFinite(centerObjectives.centerY) ? centerObjectives.centerY : 0
    }];
  }

  function getLaneSegmentsForEntry(state, entry) {
    const owner = state.players.get(entry.ownerId);
    const centerObjectives = state.centerObjectives || {};
    const centerPoint = {
      x: Number.isFinite(centerObjectives.centerX) ? centerObjectives.centerX : (owner?.x || 0),
      y: Number.isFinite(centerObjectives.centerY) ? centerObjectives.centerY : (owner?.y || 0)
    };
    if (!owner) return [];
    if (entry.frontType === "left" || entry.frontType === "right") {
      const graph = state.frontGraph && state.frontGraph[entry.ownerId] ? state.frontGraph[entry.ownerId] : null;
      const path = entry.frontType === "left" ? graph?.leftPath : graph?.rightPath;
      if (!Array.isArray(path) || path.length === 0) return [];
      const points = [{ x: owner.x || 0, y: owner.y || 0 }]
        .concat(path.map((point) => ({ x: point.x || 0, y: point.y || 0 })));
      const out = [];
      for (let i = 1; i < points.length; i++) {
        out.push({
          from: points[i - 1],
          to: points[i],
          halfWidth: SIDE_LANE_HALF_WIDTH
        });
      }
      return out;
    }
    if (entry.frontType !== "center") return [];
    if (entry.targetCoreId != null && centerObjectives.securedByPlayerId === entry.ownerId) {
      const target = state.players.get(entry.targetCoreId);
      if (!target || target.eliminated) return [];
      return [
        {
          from: { x: owner.x || 0, y: owner.y || 0 },
          to: centerPoint,
          halfWidth: CENTER_LANE_HALF_WIDTH
        },
        {
          from: centerPoint,
          to: { x: target.x || 0, y: target.y || 0 },
          halfWidth: CENTER_LANE_HALF_WIDTH
        }
      ];
    }
    return [{
      from: { x: owner.x || 0, y: owner.y || 0 },
      to: centerPoint,
      halfWidth: CENTER_LANE_HALF_WIDTH
    }];
  }

  function getSpawnFrontSpecs(state, ownerId) {
    buildCenterObjectives(state);
    buildFrontGraph(state);
    return ["left", "center", "right"].map((frontType) => ({
      frontType,
      sourceTag: frontSourceTag(frontType),
      waypoints: getFrontWaypoint(state, ownerId, frontType)
    }));
  }

  function orderSignature(order) {
    if (!order) return "idle";
    const tail = Array.isArray(order.waypoints) && order.waypoints.length > 0
      ? order.waypoints[order.waypoints.length - 1]
      : null;
    return [
      order.type || "idle",
      order.targetCityId ?? "",
      order.mineId ?? "",
      order.targetPirateBase ? 1 : 0,
      tail ? Math.round(tail.x) : "",
      tail ? Math.round(tail.y) : ""
    ].join("|");
  }

  function waypointsSignature(waypoints) {
    return (Array.isArray(waypoints) ? waypoints : [])
      .map((point) => `${Math.round(point.x || 0)},${Math.round(point.y || 0)}`)
      .join(">");
  }

  function isWaypointRouteProgressed(currentWaypoints, desiredWaypoints) {
    const current = Array.isArray(currentWaypoints) ? currentWaypoints : [];
    const desired = Array.isArray(desiredWaypoints) ? desiredWaypoints : [];
    if (current.length === 0) return true;
    if (current.length > desired.length) return false;
    const offset = desired.length - current.length;
    for (let i = 0; i < current.length; i++) {
      const a = current[i];
      const b = desired[offset + i];
      if (!a || !b) return false;
      if (Math.round(a.x || 0) !== Math.round(b.x || 0)) return false;
      if (Math.round(a.y || 0) !== Math.round(b.y || 0)) return false;
    }
    return true;
  }

  function isSiegeRouteProgressed(order, target, desiredWaypoints) {
    if (!order || order.type !== "siege" || !target || order.targetCityId !== target.id) return false;
    if (isWaypointRouteProgressed(order.waypoints, desiredWaypoints)) return true;
    const current = Array.isArray(order.waypoints) ? order.waypoints : [];
    if (current.length === 0) return true;
    const tail = current[current.length - 1];
    if (!tail) return false;
    return (
      Math.round(tail.x || 0) === Math.round(target.x || 0) &&
      Math.round(tail.y || 0) === Math.round(target.y || 0)
    );
  }

  function issuePlannerOrder(state, squadLogic, squad, entry, desiredSignature, issueFn) {
    const now = state.t || 0;
    if (entry.lastOrderSignature === desiredSignature && (now - (entry.lastIssuedAt || 0)) < REISSUE_SEC) return;
    if (squadLogic.isOrderLocked(squad)) return;
    issueFn();
    entry.lastIssuedAt = now;
    entry.lastOrderSignature = desiredSignature;
  }

  function getNearestMineTarget(state, ownerId, centerObjectives, fromPoint) {
    if (centerObjectives && centerObjectives.securedByPlayerId === ownerId) return null;
    let best = null;
    let bestDist = Infinity;
    for (const mineId of centerObjectives.centerMineIds || []) {
      const mine = state.mines.get(mineId);
      if (!mine) continue;
      if (mine.ownerId === ownerId && mine.captureProgress >= 1) continue;
      const dist = Math.hypot((mine.x || 0) - fromPoint.x, (mine.y || 0) - fromPoint.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = mine;
      }
    }
    return best;
  }

  function getPreferredLiveEnemyCore(state, ownerId, preferredTargetId) {
    if (preferredTargetId != null) {
      const preferred = state.players.get(preferredTargetId);
      if (preferred && !preferred.eliminated && preferred.id !== ownerId) return preferred;
    }
    const graph = state.frontGraph && state.frontGraph[ownerId] ? state.frontGraph[ownerId] : null;
    const enemyCoreIds = Array.isArray(graph?.enemyCoreIds) ? graph.enemyCoreIds : [];
    for (const enemyId of enemyCoreIds) {
      const candidate = state.players.get(enemyId);
      if (candidate && !candidate.eliminated && candidate.id !== ownerId) return candidate;
    }
    return null;
  }

  function getNearestPirateBase(state, fromPoint) {
    let best = null;
    let bestDist = Infinity;
    for (const pb of getPirateBases(state)) {
      if (!pb || pb.hp <= 0) continue;
      const dist = Math.hypot((pb.x || 0) - fromPoint.x, (pb.y || 0) - fromPoint.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = pb;
      }
    }
    return best;
  }

  function getLaneThreat(state, entry, squadCenter, laneSegments) {
    if (!squadCenter || !Array.isArray(laneSegments) || laneSegments.length === 0) return null;
    let best = null;
    let bestScore = Infinity;
    for (const unit of state.units.values()) {
      if (!unit || unit.hp <= 0 || unit.owner === entry.ownerId) continue;
      let nearestLaneScore = Infinity;
      for (const segment of laneSegments) {
        if (!segment || !segment.from || !segment.to) continue;
        const sample = distanceToSegment(unit, segment.from, segment.to);
        const laneSlack = sample.dist - ((segment.halfWidth || 0) + 16);
        if (laneSlack < nearestLaneScore) nearestLaneScore = laneSlack;
      }
      if (nearestLaneScore > 42) continue;
      const distToSquad = Math.hypot((unit.x || 0) - squadCenter.x, (unit.y || 0) - squadCenter.y);
      if (distToSquad > LANE_BATTLE_THREAT_RADIUS) continue;
      const score = Math.max(0, nearestLaneScore) * 5 + distToSquad;
      if (score < bestScore) {
        bestScore = score;
        best = unit;
      }
    }
    return best;
  }

  function applyAssignments(state, squadLogic) {
    ensureState(state);
    for (const squadId of Object.keys(state.squadFrontAssignments)) {
      const entry = state.squadFrontAssignments[squadId];
      const squad = state.squads && state.squads.get(Number(squadId));
      if (!entry || !squad) {
        delete state.squadFrontAssignments[squadId];
        continue;
      }
      const owner = state.players.get(entry.ownerId);
      if (!owner || owner.eliminated) {
        delete state.squadFrontAssignments[squadId];
        continue;
      }

      const centerObjectives = state.centerObjectives || {};
      const centerPoint = {
        x: Number.isFinite(centerObjectives.centerX) ? centerObjectives.centerX : (owner.x || 0),
        y: Number.isFinite(centerObjectives.centerY) ? centerObjectives.centerY : (owner.y || 0)
      };
      const currentSig = orderSignature(squad.order);
      const squadCenter = squadLogic.getSquadCenter(state, squad);
      const laneSegments = getLaneSegmentsForEntry(state, entry);
      const laneProjection = getLaneProjection(squadCenter, laneSegments);
      if (laneProjection) {
        entry._laneMaxProgress = Math.max(entry._laneMaxProgress || 0, laneProjection.progress || 0);
      } else if (!laneSegments.length) {
        entry._laneMaxProgress = 0;
      }
      const laneReturnPoint = getLaneReturnPoint(squadCenter, laneSegments, entry._laneMaxProgress || 0);
      const defenseTarget = getCoreDefenseThreat(state, entry.ownerId, squadCenter);
      if (defenseTarget) {
        const desiredSignature = ["defend", defenseTarget.id, Math.round(defenseTarget.x), Math.round(defenseTarget.y)].join("|");
        if (currentSig !== desiredSignature) {
          issuePlannerOrder(state, squadLogic, squad, entry, desiredSignature, () => {
            squadLogic.issueAttackUnitOrder(state, squad.id, defenseTarget.id, [{ x: defenseTarget.x, y: defenseTarget.y }]);
          });
        }
        continue;
      }

      const laneThreat = getLaneThreat(state, entry, squadCenter, laneSegments);
      if (laneThreat) {
        const desiredSignature = [
          "laneThreat",
          laneThreat.id,
          laneReturnPoint ? Math.round(laneReturnPoint.x) : "",
          laneReturnPoint ? Math.round(laneReturnPoint.y) : "",
          Math.round(laneThreat.x),
          Math.round(laneThreat.y)
        ].join("|");
        if (currentSig !== desiredSignature) {
          issuePlannerOrder(state, squadLogic, squad, entry, desiredSignature, () => {
            const waypoints = laneReturnPoint
              ? [{ x: laneReturnPoint.x, y: laneReturnPoint.y }, { x: laneThreat.x, y: laneThreat.y }]
              : [{ x: laneThreat.x, y: laneThreat.y }];
            squadLogic.issueAttackUnitOrder(state, squad.id, laneThreat.id, waypoints, undefined, {
              strictLaneApproach: entry.frontType === "left" || entry.frontType === "right"
            });
          });
        }
        continue;
      }

      if (entry.frontType === "left" || entry.frontType === "right") {
        const graph = state.frontGraph && state.frontGraph[entry.ownerId] ? state.frontGraph[entry.ownerId] : null;
        let target = state.players.get(entry.targetCoreId);
        if ((!target || target.eliminated) && graph) {
          const routePath = entry.frontType === "left" ? graph.leftPath : graph.rightPath;
          for (const point of routePath || []) {
            const candidate = state.players.get(point && point.coreId);
            if (candidate && !candidate.eliminated && candidate.id !== entry.ownerId) {
              target = candidate;
              break;
            }
          }
        }
        if (!target || target.eliminated) continue;
        const canTrimRoute = !!(
          squad.order &&
          squad.order.type === "siege" &&
          squad.order.targetCityId === target.id
        );
        const routeProgress = canTrimRoute
          ? Math.max(
              entry._laneMaxProgress || 0,
              laneReturnPoint && Number.isFinite(laneReturnPoint.progress) ? laneReturnPoint.progress : 0,
              laneProjection && Number.isFinite(laneProjection.progress) ? laneProjection.progress : 0
            )
          : 0;
        const routeWaypoints = buildLaneAdvanceWaypoints(laneSegments, routeProgress);
        const laneHoldPoint = getLaneSiegeHoldPoint(laneSegments, 104);
        const desiredWaypoints = [];
        if (laneReturnPoint) desiredWaypoints.push({ x: laneReturnPoint.x, y: laneReturnPoint.y });
        const routeTail = laneHoldPoint && routeWaypoints.length > 0
          ? routeWaypoints.slice(0, -1)
          : routeWaypoints;
        desiredWaypoints.push(...routeTail.map((point) => ({ x: point.x, y: point.y })));
        if (laneHoldPoint) {
          pushUniqueWaypoint(desiredWaypoints, laneHoldPoint, 12);
        }
        if (
          isSiegeRouteProgressed(squad.order, target, desiredWaypoints)
        ) {
          continue;
        }
        const desiredSignature = [
          "siege",
          target.id,
          waypointsSignature(desiredWaypoints)
        ].join("|");
        if (currentSig === desiredSignature) continue;
        issuePlannerOrder(state, squadLogic, squad, entry, desiredSignature, () => {
          squadLogic.issueSiegeOrder(state, squad.id, target.id, desiredWaypoints, undefined, {
            strictLaneApproach: true,
            laneHoldPoint
          });
        });
        continue;
      }

      if (entry.frontType !== "center") continue;

      if (centerObjectives.securedByPlayerId === entry.ownerId && entry.targetCoreId != null) {
        const target = getPreferredLiveEnemyCore(state, entry.ownerId, entry.targetCoreId);
        if (!target) continue;
        const waypoints = [];
        if (laneReturnPoint) waypoints.push({ x: laneReturnPoint.x, y: laneReturnPoint.y });
        waypoints.push({ x: centerPoint.x, y: centerPoint.y }, { x: target.x, y: target.y });
        const desiredSignature = [
          "fanout",
          target.id,
          laneReturnPoint ? Math.round(laneReturnPoint.x) : "",
          laneReturnPoint ? Math.round(laneReturnPoint.y) : "",
          Math.round(target.x),
          Math.round(target.y)
        ].join("|");
        if (
          isSiegeRouteProgressed(squad.order, target, waypoints)
        ) {
          continue;
        }
        if (currentSig === desiredSignature) continue;
        issuePlannerOrder(state, squadLogic, squad, entry, desiredSignature, () => {
          squadLogic.issueSiegeOrder(state, squad.id, target.id, waypoints);
        });
        continue;
      }

      const pirateBase = getNearestPirateBase(state, squadCenter);
      if (pirateBase) {
        const desiredSignature = [
          "pirate",
          pirateBase.id,
          laneReturnPoint ? Math.round(laneReturnPoint.x) : "",
          laneReturnPoint ? Math.round(laneReturnPoint.y) : "",
          Math.round(pirateBase.x),
          Math.round(pirateBase.y)
        ].join("|");
        if (currentSig === desiredSignature) continue;
        issuePlannerOrder(state, squadLogic, squad, entry, desiredSignature, () => {
          const waypoints = [];
          if (laneReturnPoint) pushUniqueWaypoint(waypoints, laneReturnPoint, 8);
          pushUniqueWaypoint(waypoints, centerPoint, 18);
          pushUniqueWaypoint(waypoints, pirateBase, 8);
          squadLogic.issuePirateBaseOrder(state, squad.id, waypoints);
        });
        continue;
      }

      const mine = getNearestMineTarget(state, entry.ownerId, centerObjectives, squadCenter);
      if (mine) {
        const desiredSignature = [
          "capture",
          mine.id,
          laneReturnPoint ? Math.round(laneReturnPoint.x) : "",
          laneReturnPoint ? Math.round(laneReturnPoint.y) : "",
          Math.round(mine.x),
          Math.round(mine.y)
        ].join("|");
        if (currentSig === desiredSignature) continue;
        issuePlannerOrder(state, squadLogic, squad, entry, desiredSignature, () => {
          const waypoints = [];
          if (laneReturnPoint) pushUniqueWaypoint(waypoints, laneReturnPoint, 8);
          pushUniqueWaypoint(waypoints, centerPoint, 18);
          pushUniqueWaypoint(waypoints, mine, 8);
          squadLogic.issueCaptureOrder(state, squad.id, mine.id, { x: mine.x, y: mine.y }, waypoints);
        });
        continue;
      }

      const fallbackTarget = getPreferredLiveEnemyCore(state, entry.ownerId, entry.targetCoreId);
      if (fallbackTarget) {
        const mode = centerObjectives.securedByPlayerId === entry.ownerId ? "fanout" : "centerSiege";
        const desiredSignature = [
          mode,
          fallbackTarget.id,
          laneReturnPoint ? Math.round(laneReturnPoint.x) : "",
          laneReturnPoint ? Math.round(laneReturnPoint.y) : "",
          Math.round(fallbackTarget.x),
          Math.round(fallbackTarget.y)
        ].join("|");
        const waypoints = [];
        if (laneReturnPoint) waypoints.push({ x: laneReturnPoint.x, y: laneReturnPoint.y });
        waypoints.push({ x: centerPoint.x, y: centerPoint.y }, { x: fallbackTarget.x, y: fallbackTarget.y });
        if (
          isSiegeRouteProgressed(squad.order, fallbackTarget, waypoints)
        ) {
          continue;
        }
        if (currentSig === desiredSignature) continue;
        issuePlannerOrder(state, squadLogic, squad, entry, desiredSignature, () => {
          squadLogic.issueSiegeOrder(state, squad.id, fallbackTarget.id, waypoints);
        });
      }
    }
  }

  function step(state, dt, context) {
    ensureState(state);
    const squadLogic = context && context.squadLogic;
    if (!squadLogic || !state.players) return;

    buildCenterObjectives(state);
    const frontGraph = buildFrontGraph(state);
    const ownerSquadLists = buildOwnerSquadLists(state, squadLogic);
    const helpers = { getFormationOffsets: context && context.getFormationOffsets };

    for (const ownerId of Object.keys(frontGraph).map(Number)) {
      rebuildAssignmentsForOwner(state, squadLogic, ownerId, frontGraph[ownerId], helpers, ownerSquadLists);
    }

    applyAssignments(state, squadLogic);
  }

  const api = {
    DEFAULT_POLICY,
    ensureState,
    getCoreFrontPolicy,
    setCoreFrontPolicy,
    setCoreFrontWeights,
    setCoreFrontMode,
    buildCenterObjectives,
    buildFrontGraph,
    buildAdjacentCorePairs,
    getCoreLaneNeighbors,
    buildSideLaneMinePlacements,
    frontSourceTag,
    getTaggedFrontType,
    getFrontWaypoint,
    getSpawnFrontSpecs,
    step
  };

  if (typeof window !== "undefined") window.FrontPlanner = api;
  if (typeof module !== "undefined") module.exports = api;
})();
