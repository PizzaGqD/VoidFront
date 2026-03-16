(function () {
  "use strict";

  var STYLE_KEY = "quietus-engine";
  var PREVIEW_RADIUS = 500;
  var IMPACT_RADIUS = 500;
  var FLIGHT_DURATION_SEC = 10.0;
  var IMPACT_FADE_SEC = 2.6;
  var DEBRIS_FADE_SEC = 8.0;
  var START_OFFSET = 56;

  function hash01(seed) {
    var x = Math.sin(seed * 12.9898) * 43758.5453123;
    return x - Math.floor(x);
  }

  function getSeed(targetX, targetY, ownerId) {
    var sx = Math.round((targetX || 0) * 10);
    var sy = Math.round((targetY || 0) * 10);
    var so = Math.round(ownerId || 0);
    return ((sx * 73856093) ^ (sy * 19349663) ^ (so * 83492791)) >>> 0;
  }

  function buildCast(targetX, targetY, ownerId, opts) {
    var options = opts || {};
    var originX = options.originX != null ? options.originX : targetX;
    var originY = options.originY != null ? options.originY : (targetY - 260);
    var seed = options.seed != null ? options.seed : getSeed(targetX, targetY, ownerId || 0);
    var previewRadius = Math.max(40, options.previewRadius || PREVIEW_RADIUS);
    var impactRadius = Math.max(40, options.impactRadius || IMPACT_RADIUS);
    var flightDuration = Math.max(0.25, options.flightDuration || FLIGHT_DURATION_SEC);
    var impactFadeDuration = Math.max(0.25, options.impactFadeDuration || IMPACT_FADE_SEC);
    var startOffset = options.startOffset != null ? options.startOffset : START_OFFSET;
    var dx = targetX - originX;
    var dy = targetY - originY;
    var dist = Math.hypot(dx, dy);
    var dirX = dist > 0.001 ? dx / dist : 0;
    var dirY = dist > 0.001 ? dy / dist : -1;
    var startX = originX + dirX * startOffset;
    var startY = originY + dirY * startOffset;
    var travelDx = targetX - startX;
    var travelDy = targetY - startY;

    return {
      seed: seed,
      styleKey: STYLE_KEY,
      ownerId: ownerId || 0,
      x: startX,
      y: startY,
      originX: originX,
      originY: originY,
      startX: startX,
      startY: startY,
      targetX: targetX,
      targetY: targetY,
      dirX: dirX,
      dirY: dirY,
      vx: travelDx / flightDuration,
      vy: travelDy / flightDuration,
      distance: Math.hypot(travelDx, travelDy),
      flightDuration: flightDuration,
      impactAt: flightDuration,
      impactFadeDuration: impactFadeDuration,
      previewRadius: previewRadius,
      impactRadius: impactRadius,
      duration: flightDuration + impactFadeDuration + DEBRIS_FADE_SEC,
      resolved: false
    };
  }

  var api = {
    STYLE_KEY: STYLE_KEY,
    PREVIEW_RADIUS: PREVIEW_RADIUS,
    IMPACT_RADIUS: IMPACT_RADIUS,
    FLIGHT_DURATION_SEC: FLIGHT_DURATION_SEC,
    IMPACT_FADE_SEC: IMPACT_FADE_SEC,
    DEBRIS_FADE_SEC: DEBRIS_FADE_SEC,
    hash01: hash01,
    getSeed: getSeed,
    buildCast: buildCast
  };

  if (typeof window !== "undefined") window.ThermoNukeAbility = api;
  if (typeof module !== "undefined") module.exports = api;
})();
