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
      far:  { innerRings: 0, radialMarkers: false, sensorNodes: false, dashEdge: true,  fillAlpha: 0.010, edgeWidth: 1.15 },
      mid:  { innerRings: 1, radialMarkers: false, sensorNodes: false, dashEdge: true,  fillAlpha: 0.012, edgeWidth: 1.30 },
      near: { innerRings: 2, radialMarkers: true,  sensorNodes: true,  dashEdge: true,  fillAlpha: 0.015, edgeWidth: 1.45 },
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
      far:  { shape: true,  trail: false, sizeMul: 0.95 },
      mid:  { shape: true,  trail: false, sizeMul: 1.05 },
      near: { shape: true,  trail: true,  sizeMul: 1.20 },
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
    bullets:    120,
  };

  var _frameCounts = {};

  function resetFrameCounts() {
    _frameCounts = {};
  }

  /**
   * Check if we can draw one more of this type this frame.
   * @param {string} type - e.g. "gems", "tracers", "bullets"
   * @returns {boolean}
   */
  function canDraw(type) {
    var cap = VISIBLE_CAPS[type];
    if (cap == null) return true;
    var cur = _frameCounts[type] || 0;
    if (cur >= cap) return false;
    _frameCounts[type] = cur + 1;
    return true;
  }

  function getFrameCount(type) {
    return _frameCounts[type] || 0;
  }

  /**
   * Check if a world point is visible on screen given camera state.
   * @param {number} wx - world x
   * @param {number} wy - world y
   * @param {object} cam - { x, y, zoom, screenW, screenH }
   * @param {number} [margin] - extra margin in screen pixels
   * @returns {boolean}
   */
  function isOnScreen(wx, wy, cam, margin) {
    if (!cam) return true;
    var m = margin || 50;
    var halfW = (cam.screenW || 1920) / (2 * (cam.zoom || 0.22));
    var halfH = (cam.screenH || 1080) / (2 * (cam.zoom || 0.22));
    return wx >= cam.x - halfW - m && wx <= cam.x + halfW + m &&
           wy >= cam.y - halfH - m && wy <= cam.y + halfH + m;
  }

  /**
   * Check if an object at world coords is too small to see.
   * @param {number} worldSize - size in world units
   * @param {number} zoom - camera zoom
   * @param {number} [minPixels] - minimum screen pixels to be visible (default 2)
   * @returns {boolean} true if too small
   */
  function tooSmallToSee(worldSize, zoom, minPixels) {
    return worldSize * (zoom || 0.22) < (minPixels || 2);
  }

  const LOD = {
    LEVELS,
    FAR_THRESHOLD,
    MID_THRESHOLD,
    getLevel,
    getDetail,
    shouldDraw,
    VISIBLE_CAPS,
    resetFrameCounts,
    canDraw,
    getFrameCount,
    isOnScreen,
    tooSmallToSee,
  };

  if (typeof window !== "undefined") window.LOD = LOD;
  if (typeof module !== "undefined") module.exports = LOD;
})();
