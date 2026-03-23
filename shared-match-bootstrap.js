(function () {
  "use strict";

  function install(deps) {
    const {
      CFG,
      clamp,
      computeInfluencePolygon,
      colorForId,
      nameForId,
      cardSystemApi
    } = deps;

    function getFixedSpawnPositions(count) {
      const cx = CFG.WORLD_W * 0.5;
      const cy = CFG.WORLD_H * 0.5;
      const halfSide = Math.min(CFG.WORLD_W, CFG.WORLD_H) * 0.28;
      if (count <= 2) {
        return [
          { x: clamp(cx - halfSide, CFG.WORLD_W * 0.08, CFG.WORLD_W * 0.92), y: clamp(cy - halfSide, CFG.WORLD_H * 0.08, CFG.WORLD_H * 0.92) },
          { x: clamp(cx + halfSide, CFG.WORLD_W * 0.08, CFG.WORLD_W * 0.92), y: clamp(cy + halfSide, CFG.WORLD_H * 0.08, CFG.WORLD_H * 0.92) }
        ];
      }
      if (count === 4) {
        return [
          { x: cx - halfSide, y: cy - halfSide },
          { x: cx + halfSide, y: cy - halfSide },
          { x: cx + halfSide, y: cy + halfSide },
          { x: cx - halfSide, y: cy + halfSide }
        ].map((pos) => ({
          x: clamp(pos.x, CFG.WORLD_W * 0.08, CFG.WORLD_W * 0.92),
          y: clamp(pos.y, CFG.WORLD_H * 0.08, CFG.WORLD_H * 0.92)
        }));
      }
      const radius = Math.min(CFG.WORLD_W, CFG.WORLD_H) * 0.34;
      return Array.from({ length: Math.max(1, count) }, (_, i) => ({
        x: clamp(cx + Math.cos((i / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2) * radius, CFG.WORLD_W * 0.08, CFG.WORLD_W * 0.92),
        y: clamp(cy + Math.sin((i / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2) * radius, CFG.WORLD_H * 0.08, CFG.WORLD_H * 0.92)
      }));
    }

    function makePlayer(id, name, x, y, popStart) {
      const startPop = Math.max(1, popStart ?? CFG.POP_START);
      const color = colorForId(id);
      const displayName = name ?? nameForId(id);
      const poly = computeInfluencePolygon(x, y, startPop);
      let maxR = 0;
      for (const pt of poly) {
        const distance = Math.hypot(pt.x - x, pt.y - y);
        if (distance > maxR) maxR = distance;
      }
      const player = {
        id,
        name: displayName,
        x,
        y,
        color,
        pop: startPop,
        popFloat: startPop,
        eCredits: CFG.ECREDITS_START,
        level: 1,
        xp: 0,
        xpNext: Math.floor(CFG.XP_BASE + CFG.XP_PER_LEVEL * 1 * CFG.XP_LEVEL_MUL),
        _levelBonusMul: 1.01,
        activeUnits: 0,
        deadUnits: 0,
        influenceR: Math.max(maxR, CFG.INFLUENCE_R(startPop)),
        influencePolygon: poly,
        influenceRayDistances: poly.map((pt) => Math.hypot(pt.x - x, pt.y - y)),
        waterBonus: false,
        turretIds: [],
        mineYieldBonus: 0,
        unitCostMul: 1,
        cityTargetBonus: 0,
        turretTargetBonus: 0,
        attackEffect: null,
        attackEffects: {},
        unitHpMul: 1,
        unitDmgMul: 1,
        unitAtkRateMul: 1,
        unitSpeedMul: 1,
        unitAtkRangeMul: 1,
        growthMul: 1,
        influenceSpeedMul: 1,
        turretHpMul: 1,
        turretDmgMul: 1,
        turretRangeMul: 1,
        shieldHp: Math.max(5, startPop * 2),
        shieldMaxHp: Math.max(5, startPop * 2),
        shieldRegenCd: 0,
        pendingCardPicks: 0,
        rerollCount: 0,
        xpZonePct: 0,
        xpGainMul: 1,
        _patrolCount: 1,
        _patrols: [{ t: 0, atkCd: 0 }],
        buffHand: [],
        abilityHand: [],
        activeBuffs: [],
        legendaryBuffs: [],
        nextCardInstanceId: 1,
        cardStateVersion: 0,
        burnedCards: [],
        pendingAbilityCardId: null,
        cityGfx: null,
        zoneGfx: null,
        zoneGlow: null,
        label: null
      };
      return cardSystemApi && cardSystemApi.ensurePlayerCardState
        ? cardSystemApi.ensurePlayerCardState(player)
        : player;
    }

    return {
      getFixedSpawnPositions,
      makePlayer
    };
  }

  const api = { install };
  if (typeof window !== "undefined") window.SharedMatchBootstrap = api;
  if (typeof module !== "undefined") module.exports = api;
})();
