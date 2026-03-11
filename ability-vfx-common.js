/**
 * AbilityVfxCommon — shared pure helpers for ability renderers.
 * No PIXI, no DOM, no game-state mutation.
 */
(function () {
  "use strict";

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(a, b, x) {
    if (a === b) return x >= b ? 1 : 0;
    var t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  }

  function hexToRgb(hex) {
    var raw = String(hex == null ? "" : hex).trim().replace(/^#/, "");
    if (raw.length === 3) raw = raw.split("").map(function (ch) { return ch + ch; }).join("");
    raw = raw.padStart(6, "0").slice(0, 6);
    return {
      r: parseInt(raw.slice(0, 2), 16) || 0,
      g: parseInt(raw.slice(2, 4), 16) || 0,
      b: parseInt(raw.slice(4, 6), 16) || 0
    };
  }

  function rgbaFromHex(hex, alpha) {
    var rgb = hexToRgb(hex);
    var a = alpha == null ? 1 : alpha;
    return "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + a + ")";
  }

  function rgbStringToRgba(rgb, alpha) {
    var parts = String(rgb == null ? "" : rgb).split(",");
    var r = Math.max(0, Math.min(255, Number(parts[0]) || 0));
    var g = Math.max(0, Math.min(255, Number(parts[1]) || 0));
    var b = Math.max(0, Math.min(255, Number(parts[2]) || 0));
    var a = alpha == null ? 1 : alpha;
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  function directionFromAngle(angle) {
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }

  function perpendicular(dir) {
    return { x: -dir.y, y: dir.x };
  }

  function getBlackHoleLife(elapsedSec, cfg) {
    var appear = cfg && cfg.appear != null ? cfg.appear : 0.9;
    var exist = cfg && cfg.exist != null ? cfg.exist : 10;
    var vanish = cfg && cfg.vanish != null ? cfg.vanish : 1.4;
    var total = Math.max(0.001, appear + exist + vanish);
    var local = ((elapsedSec % total) + total) % total;

    if (local < appear) {
      var ka = local / Math.max(appear, 0.001);
      var flash = 1 - smoothstep(0.0, 0.28, ka);
      return {
        state: "appear",
        k: ka,
        visibility: ka,
        coreScale: 0.18 + 0.82 * smoothstep(0.0, 1.0, ka),
        previewScale: 0.35 + 0.65 * smoothstep(0.0, 1.0, ka),
        heat: 1 - ka * 0.35,
        redShift: 0,
        appearFlash: flash,
        vanishFlash: 0
      };
    }

    if (local < appear + exist) {
      var ke = (local - appear) / Math.max(exist, 0.001);
      return {
        state: "exist",
        k: ke,
        visibility: 1,
        coreScale: 1,
        previewScale: 1,
        heat: 0.62 + Math.sin(ke * Math.PI * 2) * 0.05,
        redShift: 0,
        appearFlash: 0,
        vanishFlash: 0
      };
    }

    var kv = (local - appear - exist) / Math.max(vanish, 0.001);
    var collapseFlash = smoothstep(0.60, 1.0, kv);
    return {
      state: "vanish",
      k: kv,
      visibility: 1 - kv * 0.12,
      coreScale: 1 - kv * 0.58,
      previewScale: 1 + kv * 0.16,
      heat: 0.82 + kv * 0.92,
      redShift: kv,
      appearFlash: 0,
      vanishFlash: collapseFlash
    };
  }

  function getIonStormLife(elapsedSec, cfg, phaseOffsetSec) {
    var appear = cfg && cfg.appear != null ? cfg.appear : 0.8;
    var active = cfg && cfg.active != null ? cfg.active : 10;
    var vanish = cfg && cfg.vanish != null ? cfg.vanish : 1.2;
    var total = Math.max(0.001, appear + active + vanish);
    var sec = elapsedSec - (phaseOffsetSec || 0);
    var local = ((sec % total) + total) % total;

    if (local < appear) {
      var ka = local / Math.max(appear, 0.001);
      return {
        state: "appear",
        k: ka,
        visibility: ka,
        radiusScale: 0.35 + 0.65 * smoothstep(0, 1, ka),
        density: 0.45 + 0.55 * ka,
        surge: 1 - smoothstep(0, 0.22, ka)
      };
    }

    if (local < appear + active) {
      var km = (local - appear) / Math.max(active, 0.001);
      return {
        state: "active",
        k: km,
        visibility: 1,
        radiusScale: 1,
        density: 1,
        surge: 0
      };
    }

    var kv = (local - appear - active) / Math.max(vanish, 0.001);
    return {
      state: "vanish",
      k: kv,
      visibility: 1 - kv * 0.4,
      radiusScale: 1 - kv * 0.18,
      density: 1 - kv * 0.55,
      surge: smoothstep(0.76, 1.0, kv)
    };
  }

  function buildMeteorCorridor(targetX, targetY, dirX, dirY, halfWidth, worldDiag) {
    var nx = -dirY * halfWidth;
    var ny = dirX * halfWidth;
    var startX = targetX - dirX * worldDiag;
    var startY = targetY - dirY * worldDiag;
    var endX = targetX + dirX * worldDiag;
    var endY = targetY + dirY * worldDiag;
    return {
      startX: startX, startY: startY,
      endX: endX, endY: endY,
      nx: nx, ny: ny,
      points: [
        { x: startX + nx, y: startY + ny },
        { x: endX + nx, y: endY + ny },
        { x: endX - nx, y: endY - ny },
        { x: startX - nx, y: startY - ny }
      ]
    };
  }

  var AbilityVfxCommon = {
    clamp01: clamp01,
    lerp: lerp,
    smoothstep: smoothstep,
    hexToRgb: hexToRgb,
    rgbaFromHex: rgbaFromHex,
    rgbStringToRgba: rgbStringToRgba,
    directionFromAngle: directionFromAngle,
    perpendicular: perpendicular,
    getBlackHoleLife: getBlackHoleLife,
    getIonStormLife: getIonStormLife,
    buildMeteorCorridor: buildMeteorCorridor
  };

  if (typeof window !== "undefined") window.AbilityVfxCommon = AbilityVfxCommon;
  if (typeof module !== "undefined") module.exports = AbilityVfxCommon;
})();
