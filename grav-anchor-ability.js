(function () {
  "use strict";

  var STYLE_KEY = "shear-knot";
  var PALETTE_KEY = "violet";
  var DURATION_SEC = 20.0;
  var RADIUS = 420;
  var PREVIEW_RADIUS = 420;
  var PULL_BLEND = 0.05;

  function hash01(seed) {
    var x = Math.sin(seed * 12.9898) * 43758.5453123;
    return x - Math.floor(x);
  }

  function getSeed(x, y, ownerId) {
    var sx = Math.round((x || 0) * 10);
    var sy = Math.round((y || 0) * 10);
    var so = Math.round(ownerId || 0);
    return ((sx * 73856093) ^ (sy * 19349663) ^ (so * 83492791)) >>> 0;
  }

  function buildEffect(x, y, ownerId, opts) {
    var options = opts || {};
    return {
      type: "anchor",
      seed: options.seed != null ? options.seed : getSeed(x, y, ownerId || 0),
      styleKey: STYLE_KEY,
      paletteKey: PALETTE_KEY,
      ownerId: ownerId || 0,
      x: x,
      y: y,
      duration: Math.max(0.2, options.duration || DURATION_SEC),
      radius: Math.max(20, options.radius || RADIUS),
      previewRadius: Math.max(20, options.previewRadius || PREVIEW_RADIUS),
      pullBlend: options.pullBlend != null ? options.pullBlend : PULL_BLEND
    };
  }

  var api = {
    STYLE_KEY: STYLE_KEY,
    PALETTE_KEY: PALETTE_KEY,
    DURATION_SEC: DURATION_SEC,
    RADIUS: RADIUS,
    PREVIEW_RADIUS: PREVIEW_RADIUS,
    PULL_BLEND: PULL_BLEND,
    hash01: hash01,
    getSeed: getSeed,
    buildEffect: buildEffect
  };

  if (typeof window !== "undefined") window.GravAnchorAbility = api;
  if (typeof module !== "undefined") module.exports = api;
})();
