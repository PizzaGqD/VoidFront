/**
 * LOD — Level-of-Detail visual policy for VoidFront.
 * Determines what to draw and at what quality based on camera zoom.
 * Pure functions, no PIXI dependency, no game state.
 */
(function () {
  "use strict";

  const FAR_THRESHOLD  = 0.12;
  const MID_THRESHOLD  = 0.30;

  const LEVELS = { FAR: "far", MID: "mid", NEAR: "near" };

  function getLevel(zoom) {
    if (zoom < FAR_THRESHOLD) return LEVELS.FAR;
    if (zoom < MID_THRESHOLD) return LEVELS.MID;
    return LEVELS.NEAR;
  }

  const DETAIL_TABLE = {
    zone: {
      far:  { innerRings: 1, radialMarkers: false, sensorNodes: false, dashEdge: true,  fillAlpha: 0.10, edgeWidth: 1.5 },
      mid:  { innerRings: 2, radialMarkers: true,  sensorNodes: false, dashEdge: true,  fillAlpha: 0.14, edgeWidth: 2.0 },
      near: { innerRings: 3, radialMarkers: true,  sensorNodes: true,  dashEdge: true,  fillAlpha: 0.16, edgeWidth: 2.5 },
    },
    ship: {
      far:  { fullShape: false, glow: false, trails: false, hitRadius: true  },
      mid:  { fullShape: true,  glow: false, trails: true,  hitRadius: false },
      near: { fullShape: true,  glow: true,  trails: true,  hitRadius: false },
    },
    turret: {
      far:  { shape: "dot",     radiusOverlay: false, glow: false, connectionLine: false },
      mid:  { shape: "diamond", radiusOverlay: true,  glow: false, connectionLine: false },
      near: { shape: "diamond", radiusOverlay: true,  glow: true,  connectionLine: true  },
    },
    gem: {
      far:  { body: false, pulseLine: true,  glow: false },
      mid:  { body: true,  pulseLine: false, glow: false },
      near: { body: true,  pulseLine: false, glow: true  },
    },
    bullet: {
      far:  { line: true,  glow: false, hitFlash: false },
      mid:  { line: true,  glow: false, hitFlash: true  },
      near: { line: true,  glow: true,  hitFlash: true  },
    },
    base: {
      far:  { core: true,  rings: 0, glow: false, label: true  },
      mid:  { core: true,  rings: 1, glow: true,  label: true  },
      near: { core: true,  rings: 2, glow: true,  label: true  },
    },
    patrol: {
      far:  { shape: false, trail: false },
      mid:  { shape: true,  trail: false },
      near: { shape: true,  trail: true  },
    },
  };

  function getDetail(type, zoom) {
    const level = getLevel(zoom);
    const table = DETAIL_TABLE[type];
    if (!table) return {};
    return table[level] || table.near || {};
  }

  function shouldDraw(type, zoom) {
    if (type === "hitFlash" && zoom < FAR_THRESHOLD) return false;
    if (type === "trail" && zoom < FAR_THRESHOLD) return false;
    return true;
  }

  const VISIBLE_CAPS = {
    gems:       150,
    tracers:     80,
    hitFlashes:  40,
    pulses:      60,
  };

  const LOD = {
    LEVELS,
    FAR_THRESHOLD,
    MID_THRESHOLD,
    getLevel,
    getDetail,
    shouldDraw,
    VISIBLE_CAPS,
  };

  if (typeof window !== "undefined") window.LOD = LOD;
  if (typeof module !== "undefined") module.exports = LOD;
})();
