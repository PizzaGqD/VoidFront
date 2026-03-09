/**
 * Combat Module — Fire Plan Only
 *
 * Target picking with retarget cooldown, fire plan generation.
 * No state machine, no movement, no engagement zones.
 * Zones and combat modes live in squad-logic.js.
 */
(function () {
  "use strict";

  let cfg = {
    retargetCooldown: 1.0,
    detectRangeMul: 1.5,
    targetStickinessBonus: 0.8
  };

  const debugState = {
    enabled: false,
    drawRanges: true,
    drawTargetLines: true,
    drawStateLabels: true,
    drawCooldownBars: true
  };

  function loadConfig(balance) {
    if (!balance || !balance.combat) return;
    const c = balance.combat;
    if (c.retargetCooldownSec != null) cfg.retargetCooldown = c.retargetCooldownSec;
    if (c.detectRangeMul != null) cfg.detectRangeMul = c.detectRangeMul;
    if (c.targetStickinessBonus != null) cfg.targetStickinessBonus = c.targetStickinessBonus;
  }

  /**
   * Pick nearest enemy from a set of candidates. Respects retarget cooldown.
   * @param {Object} u - the unit looking for a target
   * @param {Array} enemies - candidate enemy units
   * @param {Object} state - game state (for timing)
   * @returns {Object|null} target unit or null
   */
  function pickTarget(u, enemies, state) {
    if (!enemies || !enemies.length) {
      u._currentTargetId = undefined;
      return null;
    }

    const now = state.t;
    const onCooldown = u._lastRetargetAt != null && (now - u._lastRetargetAt) < cfg.retargetCooldown;

    if (onCooldown && u._currentTargetId != null) {
      const cur = state.units.get(u._currentTargetId);
      if (cur && cur.hp > 0 && cur.owner !== u.owner) return cur;
    }

    let best = null, bestDist = Infinity;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.hp <= 0 || e.owner === u.owner) continue;
      const d = Math.hypot(e.x - u.x, e.y - u.y);

      if (onCooldown && u._currentTargetId === e.id) {
        best = e;
        break;
      }
      if (d < bestDist) { bestDist = d; best = e; }
    }

    if (best) {
      if (best.id !== u._currentTargetId) u._lastRetargetAt = now;
      u._currentTargetId = best.id;
    } else {
      u._currentTargetId = undefined;
    }
    return best;
  }

  /**
   * Get fire plan. Delegates to SQUADLOGIC.getUnitFirePlan when available.
   */
  function getFirePlan(u, state, helpers) {
    if (typeof SQUADLOGIC !== "undefined" && SQUADLOGIC.getUnitFirePlan) {
      return SQUADLOGIC.getUnitFirePlan(u, state, helpers);
    }
    return { type: "none" };
  }

  function recordDamageSource(u, attackerId, state) {
    if (typeof SQUADLOGIC !== "undefined" && SQUADLOGIC.recordDamageSource) {
      SQUADLOGIC.recordDamageSource(u, attackerId, state);
      return;
    }
    if (attackerId == null) return;
    const attacker = state.units.get(attackerId);
    if (!attacker || attacker.owner === u.owner) return;
    u._lastDamagedByUnitId = attackerId;
    u._lastDamagedAt = state.t;
  }

  function clearCombatState(u) {
    u._combatState = "idle";
    u._currentTargetId = undefined;
    u._lastRetargetAt = undefined;
    u._siegeTargetId = undefined;
    u._siegeFixedPos = undefined;
    u._siegeWpSet = false;
    u._savedSiegeTargetId = undefined;
    u._engagementZoneId = null;
    u._squadCombatPhase = null;
    u._engagedEnemyIds = null;
    u._engagementAnchorX = undefined;
    u._engagementAnchorY = undefined;
    u._combatFacingAngle = undefined;
  }

  function stepCombatSystem(state, dt, helpers) {
    if (typeof SQUADLOGIC !== "undefined" && SQUADLOGIC.step) {
      SQUADLOGIC.step(state, dt, helpers);
    }
  }

  function getUnitCombatMovement() {
    return null;
  }

  function isInCombat(u) {
    const s = u._combatState;
    return s === "attack" || s === "chase" || s === "siege";
  }

  // ─── Debug labels ────────────────────────────────────────────────

  const STATE_LABELS = {
    idle: "I", move: "M", chase: "C", attack: "ATK",
    siege: "S", regroup: "R", dead: "X", acquire: "A"
  };

  function getStateLabel(u) {
    return STATE_LABELS[u._combatState] || "?";
  }

  function getEngagementLabel(u) {
    if (!u._squadCombatPhase) return "";
    const phase = u._squadCombatPhase === "engaged" ? "ENG" : "APR";
    const enemies = u._engagedEnemyIds ? u._engagedEnemyIds.size : 0;
    return `[${phase}:${enemies}]`;
  }

  // ─── Debug rendering ─────────────────────────────────────────────

  function drawCombatDebug(gfx, state, helpers) {
    if (!debugState.enabled || !gfx) return;
    const { getUnitAtkRange, inView } = helpers;
    gfx.clear();

    if (typeof SQUADLOGIC !== "undefined") {
      const zones = SQUADLOGIC.getZoneList(state);
      for (const zone of zones) {
        if (zone.anchorX == null) continue;
        if (inView && !inView(zone.anchorX, zone.anchorY)) continue;
        gfx.circle(zone.anchorX, zone.anchorY, zone.radius || 70);
        gfx.stroke({ color: 0xff6644, width: 2, alpha: 0.35 });
        gfx.moveTo(zone.anchorX - 10, zone.anchorY);
        gfx.lineTo(zone.anchorX + 10, zone.anchorY);
        gfx.moveTo(zone.anchorX, zone.anchorY - 10);
        gfx.lineTo(zone.anchorX, zone.anchorY + 10);
        gfx.stroke({ color: 0xff6644, width: 2, alpha: 0.6 });
      }
    }

    for (const u of state.units.values()) {
      if (u.hp <= 0) continue;
      if (inView && !inView(u.x, u.y)) continue;

      const atkRange = getUnitAtkRange ? getUnitAtkRange(u) : 60;

      if (debugState.drawRanges) {
        gfx.circle(u.x, u.y, atkRange);
        gfx.stroke({ color: 0x44ff44, width: 1, alpha: 0.3 });
      }

      if (debugState.drawTargetLines && u._currentTargetId != null) {
        const target = state.units.get(u._currentTargetId);
        if (target) {
          gfx.moveTo(u.x, u.y);
          gfx.lineTo(target.x, target.y);
          gfx.stroke({ color: 0xff4444, width: 1.5, alpha: 0.6 });
        }
      }

      if (debugState.drawCooldownBars && u.atkCd > 0) {
        const cdPct = Math.min(1, u.atkCd / 0.5);
        const barW = 20, barH = 3;
        gfx.rect(u.x - barW / 2, u.y + 15, barW * (1 - cdPct), barH);
        gfx.fill({ color: 0x44aaff, alpha: 0.8 });
        gfx.rect(u.x - barW / 2, u.y + 15, barW, barH);
        gfx.stroke({ color: 0x4488ff, width: 1, alpha: 0.4 });
      }

      if (u.leaderId == null && u._squadCombatPhase) {
        const ax = u._engagementAnchorX;
        const ay = u._engagementAnchorY;
        if (ax != null && ay != null) {
          const phaseColor = u._squadCombatPhase === "engaged" ? 0xff4444 : 0xffaa44;
          gfx.moveTo(u.x, u.y);
          gfx.lineTo(ax, ay);
          gfx.stroke({ color: phaseColor, width: 2, alpha: 0.5 });
        }
      }
    }
  }

  function toggleDebug() {
    debugState.enabled = !debugState.enabled;
    return debugState.enabled;
  }

  // ─── Public API ──────────────────────────────────────────────────

  const COMBAT = {
    CONFIG: cfg,
    DEBUG: debugState,
    loadConfig,
    pickTarget,
    getFirePlan,
    recordDamageSource,
    clearCombatState,
    stepCombatSystem,
    getUnitCombatMovement,
    isInCombat,
    drawCombatDebug,
    toggleDebug,
    getStateLabel,
    getEngagementLabel
  };

  if (typeof window !== "undefined") window.COMBAT = COMBAT;
  if (typeof module !== "undefined") module.exports = COMBAT;
})();
