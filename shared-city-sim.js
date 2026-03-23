(function () {
  "use strict";

  const ZONE_GRID_CELL = 40;

  function install(deps) {
    const {
      state,
      CFG,
      fbm,
      clamp,
      isPointInPolygon,
      polygonArea,
      getPlanetRadius,
      shieldRadius,
      xpNeed,
      getActiveGrowthBonusPerMin,
      getMapSeed
    } = deps;

    let zoneGrid = null;
    let zoneGridW = 0;
    let zoneGridH = 0;

    function getTerrainType(wx, wy) {
      const nx = wx / CFG.WORLD_W;
      const ny = wy / CFG.WORLD_H;
      const dx = nx - 0.52;
      const dy = ny - 0.52;
      const falloff = Math.sqrt(dx * dx + dy * dy) * (CFG.FALLOFF_STRENGTH || 1.15);
      let n = fbm(wx, wy, getMapSeed());
      n = n - falloff * (CFG.FALLOFF_AMOUNT ?? 0.65);
      const lt = CFG.LAND_THRESHOLD ?? 0.08;
      if (n <= lt - 0.08) return "deepWater";
      if (n <= lt) return "shallowWater";
      const t = clamp((n - lt) / 0.55, 0, 1);
      if (t < 0.35) return "lowland";
      if (t < 0.75) return "hill";
      return "mountain";
    }

    function getTerrainInfluenceCost(wx, wy) {
      const type = getTerrainType(wx, wy);
      const terrain = CFG.TERRAIN_TYPES[type];
      return terrain ? terrain.influenceCost : 1;
    }

    function computeInfluencePolygon(cx, cy, pop) {
      const budgetTotal = CFG.INFLUENCE_R(pop);
      const lowlandCost = CFG.TERRAIN_TYPES.lowland?.influenceCost ?? 0.75;
      const step = CFG.TERRAIN_STEP ?? 2;
      const budget = (budgetTotal * lowlandCost) / step;
      const numRays = CFG.TERRAIN_RAYS ?? 96;
      const points = [];
      for (let i = 0; i < numRays; i++) {
        const angle = (i / numRays) * Math.PI * 2;
        let x = cx;
        let y = cy;
        let remainingBudget = budget;
        while (remainingBudget > 0) {
          const cost = getTerrainInfluenceCost(x, y);
          remainingBudget -= cost;
          if (remainingBudget <= 0) break;
          x += Math.cos(angle) * step;
          y += Math.sin(angle) * step;
          if (x < 0 || x > CFG.WORLD_W || y < 0 || y > CFG.WORLD_H) break;
        }
        points.push({ x, y });
      }
      return points;
    }

    function sampleWaterRatioAround(cx, cy, radius, samples) {
      let water = 0;
      for (let i = 0; i < samples; i++) {
        const angle = (i / samples) * Math.PI * 2;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        const terrain = getTerrainType(x, y);
        if (terrain === "deepWater" || terrain === "shallowWater") water++;
      }
      return water / samples;
    }

    function rebuildZoneGrid() {
      const cellsWide = Math.ceil(CFG.WORLD_W / ZONE_GRID_CELL);
      const cellsHigh = Math.ceil(CFG.WORLD_H / ZONE_GRID_CELL);
      if (!zoneGrid || zoneGridW !== cellsWide || zoneGridH !== cellsHigh) {
        zoneGrid = new Int8Array(cellsWide * cellsHigh);
        zoneGridW = cellsWide;
        zoneGridH = cellsHigh;
      } else {
        zoneGrid.fill(0);
      }
      for (let gy = 0; gy < cellsHigh; gy++) {
        for (let gx = 0; gx < cellsWide; gx++) {
          const wx = (gx + 0.5) * ZONE_GRID_CELL;
          const wy = (gy + 0.5) * ZONE_GRID_CELL;
          let ownerCount = 0;
          let ownerId = 0;
          for (const player of state.players.values()) {
            if (!player.influencePolygon || player.influencePolygon.length < 3) continue;
            const dx = wx - player.x;
            const dy = wy - player.y;
            const maxReach = (player.influenceR + ZONE_GRID_CELL) * (player.influenceR + ZONE_GRID_CELL);
            if (dx * dx + dy * dy > maxReach) continue;
            if (isPointInPolygon(wx, wy, player.influencePolygon)) {
              ownerCount++;
              ownerId = player.id;
              if (ownerCount >= 2) break;
            }
          }
          zoneGrid[gy * cellsWide + gx] = ownerCount >= 2 ? -1 : (ownerCount === 1 ? ownerId : 0);
        }
      }
      return zoneGrid;
    }

    function getZoneOwnerFast(x, y) {
      if (!zoneGrid) return 0;
      const gx = Math.floor(x / ZONE_GRID_CELL);
      const gy = Math.floor(y / ZONE_GRID_CELL);
      if (gx < 0 || gx >= zoneGridW || gy < 0 || gy >= zoneGridH) return 0;
      const value = zoneGrid[gy * zoneGridW + gx];
      return value === -1 ? 0 : value;
    }

    function isInOverlapFast(x, y) {
      if (!zoneGrid) return false;
      const gx = Math.floor(x / ZONE_GRID_CELL);
      const gy = Math.floor(y / ZONE_GRID_CELL);
      if (gx < 0 || gx >= zoneGridW || gy < 0 || gy >= zoneGridH) return false;
      return zoneGrid[gy * zoneGridW + gx] === -1;
    }

    function getZoneGridState() {
      return {
        grid: zoneGrid,
        width: zoneGridW,
        height: zoneGridH,
        cellSize: ZONE_GRID_CELL
      };
    }

    function stepCities(dt) {
      const unitCountByOwner = new Map();
      for (const unit of state.units.values()) {
        unitCountByOwner.set(unit.owner, (unitCountByOwner.get(unit.owner) || 0) + 1);
      }

      for (const player of state.players.values()) {
        if (player.cooldown > 0) player.cooldown = Math.max(0, player.cooldown - dt);
        player.activeUnits = unitCountByOwner.get(player.id) || 0;
        const active = player.activeUnits;

        if (player._waterRatioCache == null || (state._frameCtr || 0) % 120 === 0) {
          player._waterRatioCache = sampleWaterRatioAround(player.x, player.y, 80, 16);
        }
        player.waterBonus = player._waterRatioCache >= CFG.WATER_RATIO_THRESHOLD;

        let base = CFG.GROWTH_BASE_PER_MIN + Math.floor(player.popFloat / 100) * CFG.GROWTH_PER_100;
        if (player.waterBonus) base += CFG.WATER_GROWTH_BONUS;

        let penalty = Math.min(CFG.ACTIVE_SOLDIER_PENALTY_CAP, active * CFG.ACTIVE_SOLDIER_PENALTY_PER);
        if (player.waterBonus) penalty = Math.max(0, penalty - CFG.WATER_PENALTY_REDUCTION);
        const timedGrowthBonus = getActiveGrowthBonusPerMin(player);
        const growthMul = player.growthMul != null ? player.growthMul : 1;
        const perMin = (base * (1 - penalty) + timedGrowthBonus) * growthMul;
        const perSec = perMin / 60;

        player.popFloat = Math.max(0, player.popFloat + perSec * dt);
        player.pop = Math.floor(player.popFloat);

        const popCreditPerSec = Math.floor(player.pop / 100);
        if (popCreditPerSec > 0) {
          player.eCredits = (player.eCredits || 0) + popCreditPerSec * dt;
        }

        const numRays = CFG.TERRAIN_RAYS ?? 96;
        const popBucket = Math.floor(player.popFloat / 5);
        if (popBucket !== player._lastPopBucket) {
          player._lastPopBucket = popBucket;
          player._cachedTargetPoly = computeInfluencePolygon(player.x, player.y, player.popFloat);
        }
        const targetPoly = player._cachedTargetPoly || computeInfluencePolygon(player.x, player.y, player.popFloat);
        if (!player._targetDist || player._targetDist.length !== numRays) player._targetDist = new Array(numRays);
        if (!player._boost || player._boost.length !== numRays) player._boost = new Array(numRays);
        if (!player._polyBuf || player._polyBuf.length !== numRays) {
          player._polyBuf = [];
          for (let i = 0; i < numRays; i++) player._polyBuf.push({ x: 0, y: 0 });
        }
        const targetDist = player._targetDist;
        const boost = player._boost;
        for (let i = 0; i < numRays; i++) {
          const pt = targetPoly[i] || targetPoly[0];
          targetDist[i] = Math.hypot(pt.x - player.x, pt.y - player.y);
        }
        if (!player.influenceRayDistances || player.influenceRayDistances.length !== numRays) {
          player.influenceRayDistances = targetPoly.map((pt) => Math.hypot(pt.x - player.x, pt.y - player.y));
        }
        for (let i = 0; i < numRays; i++) boost[i] = 1;
        const activeUnits = player.activeUnits ?? 0;
        const armyPenalty = Math.max(0.1, 1 - activeUnits * 0.0045);
        const influenceSpeedMul = (player.influenceSpeedMul != null ? player.influenceSpeedMul : 1) * armyPenalty;
        for (const other of state.players.values()) {
          if (other.id === player.id || !other.influencePolygon || other.influencePolygon.length < 3) continue;
          const myPressure = (player.pop || 0) * (player.influenceSpeedMul != null ? player.influenceSpeedMul : 1) * armyPenalty;
          const otherPressure = (other.pop || 0) * (other.influenceSpeedMul != null ? other.influenceSpeedMul : 1) * Math.max(0.1, 1 - (other.activeUnits ?? 0) * 0.0045);
          if (otherPressure <= myPressure) continue;
          const otherR = other.influenceR || 0;
          const distToOther = Math.hypot(player.x - other.x, player.y - other.y);
          const maxPossibleReach = (player.influenceR || 0) + 20;
          if (distToOther > maxPossibleReach + otherR) continue;
          for (let i = 0; i < numRays; i++) {
            const angle = (i / numRays) * Math.PI * 2;
            const distance = player.influenceRayDistances[i] ?? 0;
            const ex = player.x + Math.cos(angle) * distance;
            const ey = player.y + Math.sin(angle) * distance;
            const distanceToOther = (ex - other.x) ** 2 + (ey - other.y) ** 2;
            if (distanceToOther > otherR * otherR) continue;
            if (isPointInPolygon(ex, ey, other.influencePolygon)) boost[i] = 0;
          }
        }
        const speed = (CFG.INFLUENCE_GROWTH_SPEED ?? 0.15) * influenceSpeedMul;
        const maxGrowthDelta = 2;
        let maxR = 0;
        const planetRadius = getPlanetRadius(player);
        const minInfluenceR = Math.max(planetRadius * 3, (player.shieldHp || 0) > 0 ? shieldRadius(player) + 3 : 0);
        for (let i = 0; i < numRays; i++) {
          const target = targetDist[i] ?? 0;
          let current = player.influenceRayDistances[i] ?? target;
          const mul = boost[i];
          const lerpFactor = Math.min(1, dt * speed * mul);
          let delta = (target - current) * lerpFactor;
          delta = delta > 0 ? Math.min(delta, maxGrowthDelta) : Math.max(delta, -maxGrowthDelta);
          current = Math.max(minInfluenceR, current + delta);
          player.influenceRayDistances[i] = current;
          if (current > maxR) maxR = current;
        }
        const polyBuf = player._polyBuf;
        for (let i = 0; i < numRays; i++) {
          const angle = (i / numRays) * Math.PI * 2;
          const distance = player.influenceRayDistances[i];
          polyBuf[i].x = player.x + Math.cos(angle) * distance;
          polyBuf[i].y = player.y + Math.sin(angle) * distance;
        }
        player.influencePolygon = polyBuf;
        player.influenceR = maxR;
      }

      const pressure = (player) => {
        const influenceMul = player.influenceSpeedMul != null ? player.influenceSpeedMul : 1;
        const armyPenalty = Math.max(0.1, 1 - (player.activeUnits ?? 0) * 0.0045);
        return (player.pop || 0) * influenceMul * armyPenalty;
      };

      const numRays = CFG.TERRAIN_RAYS ?? 96;
      for (const player of state.players.values()) {
        if (!player._rayTmp || player._rayTmp.length !== numRays) player._rayTmp = new Array(numRays);
        if (!player._raySmooth || player._raySmooth.length !== numRays) {
          player._raySmooth = new Float64Array(numRays);
          for (let i = 0; i < numRays; i++) player._raySmooth[i] = player.influenceRayDistances[i] ?? 0;
        }
        const rayTmp = player._rayTmp;
        for (let i = 0; i < numRays; i++) rayTmp[i] = player.influenceRayDistances[i];
      }

      for (let pass = 0; pass < 2; pass++) {
        for (const player of state.players.values()) {
          const rays = player._rayTmp;
          if (!rays || rays.length !== numRays) continue;
          const myPressure = pressure(player);
          for (const other of state.players.values()) {
            if (other.id === player.id || !other.influencePolygon || other.influencePolygon.length < 3) continue;
            const otherPressure = pressure(other);
            const pushRatio = otherPressure / (myPressure + otherPressure + 1);
            const cx = other.x;
            const cy = other.y;
            const otherR = other.influenceR || 100;
            for (let i = 0; i < numRays; i++) {
              const angle = (i / numRays) * Math.PI * 2;
              const distance = rays[i] ?? 0;
              const ex = player.x + Math.cos(angle) * distance;
              const ey = player.y + Math.sin(angle) * distance;
              if (isPointInPolygon(ex, ey, other.influencePolygon)) {
                const distToOther = Math.hypot(ex - cx, ey - cy);
                const penetration = Math.max(0, otherR - distToOther);
                const targetDistance = Math.max(10, distance - penetration * Math.max(pushRatio, 0.3));
                const smoothFactor = 0.04;
                const delta = (targetDistance - distance) * smoothFactor;
                const maxDelta = 1.5;
                const clampedDelta = delta > 0 ? Math.min(delta, maxDelta) : Math.max(delta, -maxDelta);
                rays[i] = distance + clampedDelta;
              }
            }
          }
        }
      }

      for (const player of state.players.values()) {
        const rays = player._rayTmp;
        if (!rays) continue;
        const turretRangeMul = player.turretRangeMul != null ? player.turretRangeMul : 1;
        const cityRange = CFG.CITY_ATTACK_RADIUS * turretRangeMul * (player.waterBonus ? 1.25 : 1);
        const minZoneR = cityRange * 0.5;
        for (let i = 0; i < numRays; i++) {
          if (rays[i] < minZoneR) rays[i] = minZoneR;
        }
        player.influenceRayDistances = rays;
        const polyBuf = player._polyBuf;
        for (let i = 0; i < numRays; i++) {
          const angle = (i / numRays) * Math.PI * 2;
          const distance = rays[i];
          polyBuf[i].x = player.x + Math.cos(angle) * distance;
          polyBuf[i].y = player.y + Math.sin(angle) * distance;
        }
        player.influencePolygon = polyBuf;
        let maxR = 0;
        for (let i = 0; i < numRays; i++) {
          const pt = polyBuf[i];
          const distance = Math.hypot(pt.x - player.x, pt.y - player.y);
          if (distance > maxR) maxR = distance;
        }
        player.influenceR = maxR;
        const totalArea = CFG.WORLD_W * CFG.WORLD_H;
        const zoneArea = polygonArea(player.influencePolygon);
        player.xpZonePct = totalArea > 0 ? (zoneArea / totalArea * 100) : 0;
        player.xpGainMul = player.xpZonePct < 5 ? 1.2 : 1;
        player.xpNext = xpNeed(player.level, player);
      }
    }

    return {
      ZONE_GRID_CELL,
      getTerrainType,
      getTerrainInfluenceCost,
      computeInfluencePolygon,
      sampleWaterRatioAround,
      rebuildZoneGrid,
      getZoneOwnerFast,
      isInOverlapFast,
      getZoneGridState,
      stepCities
    };
  }

  const api = { install };
  if (typeof window !== "undefined") window.SharedCitySim = api;
  if (typeof module !== "undefined") module.exports = api;
})();
