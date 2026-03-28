(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var STYLE_KEY = "swarm-cyan-scrap-burner";
  var SHOT_COUNT = 5;
  var IMPACT_DURATION_SEC = 1.0;
  var IMPACT_RADIUS_SCALE = 1.25;
  var PREVIEW_RADIUS = Math.round(140 * IMPACT_RADIUS_SCALE);
  var BASE_VISUAL_SCALES = [1.16, 0.98, 0.86, 0.78, 0.72];

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

  function getRayDistanceToBounds(x, y, dirX, dirY, worldW, worldH) {
    var maxX = Math.max(1, worldW || 1);
    var maxY = Math.max(1, worldH || 1);
    var tMin = Infinity;
    if (dirX > 0.001) {
      tMin = Math.min(tMin, (maxX - x) / dirX);
    } else if (dirX < -0.001) {
      tMin = Math.min(tMin, (0 - x) / dirX);
    }
    if (dirY > 0.001) {
      tMin = Math.min(tMin, (maxY - y) / dirY);
    } else if (dirY < -0.001) {
      tMin = Math.min(tMin, (0 - y) / dirY);
    }
    if (!isFinite(tMin) || tMin <= 0) {
      return Math.hypot(maxX, maxY);
    }
    return tMin;
  }

  function buildCast(targetX, targetY, ownerId, opts) {
    var options = opts || {};
    var worldW = Math.max(1, options.worldW || 1);
    var worldH = Math.max(1, options.worldH || 1);
    var baseSpeed = Math.max(1, options.baseSpeed || 1);
    var seed = options.seed != null ? options.seed : getSeed(targetX, targetY, ownerId || 0);
    var baseAngle = options.baseAngle != null ? options.baseAngle : hash01(seed + 1) * TAU;
    var shots = [];

    for (var i = 0; i < SHOT_COUNT; i++) {
      var shotSeed = seed + i * 37 + 11;
      var angle = baseAngle + (hash01(shotSeed + 1) - 0.5) * 0.22;
      var dirX = Math.cos(angle);
      var dirY = Math.sin(angle);
      var nx = -dirY;
      var ny = dirX;
      var side = (i - (SHOT_COUNT - 1) * 0.5) * 52 + (hash01(shotSeed + 2) - 0.5) * 22;
      var along = (hash01(shotSeed + 3) - 0.5) * 58;
      var aimX = targetX + nx * side + dirX * along * 0.28;
      var aimY = targetY + ny * side + dirY * along * 0.28;
      var backT = getRayDistanceToBounds(aimX, aimY, -dirX, -dirY, worldW, worldH);
      var forwardT = getRayDistanceToBounds(aimX, aimY, dirX, dirY, worldW, worldH);
      var entryX = aimX - dirX * backT;
      var entryY = aimY - dirY * backT;
      var exitX = aimX + dirX * forwardT;
      var exitY = aimY + dirY * forwardT;
      var backOffset = 90 + i * 44 + hash01(shotSeed + 4) * 70;
      var startX = entryX - dirX * backOffset;
      var startY = entryY - dirY * backOffset;
      var speedMul = 0.88 + hash01(shotSeed + 5) * 0.28;
      var sizeMul = 0.92 + hash01(shotSeed + 6) * 0.18;
      var impactMul = 0.86 + hash01(shotSeed + 7) * 0.30;
      var visualScale = BASE_VISUAL_SCALES[i] * sizeMul;
      var bodyRadius = 7.4 * visualScale;
      var aoeRadius = (46 + i * 5) * impactMul * IMPACT_RADIUS_SCALE;

      shots.push({
        swarmIndex: i,
        seed: shotSeed,
        angle: angle,
        aimX: aimX,
        aimY: aimY,
        entryX: entryX,
        entryY: entryY,
        exitX: exitX,
        exitY: exitY,
        x: startX,
        y: startY,
        vx: dirX * baseSpeed * speedMul,
        vy: dirY * baseSpeed * speedMul,
        radius: Math.max(3, bodyRadius),
        aoeR: Math.max(18, aoeRadius),
        impactDuration: IMPACT_DURATION_SEC,
        visualScale: visualScale,
        styleKey: STYLE_KEY
      });
    }

    return {
      seed: seed,
      angle: baseAngle,
      previewRadius: PREVIEW_RADIUS,
      shots: shots
    };
  }

  var api = {
    STYLE_KEY: STYLE_KEY,
    SHOT_COUNT: SHOT_COUNT,
    IMPACT_DURATION_SEC: IMPACT_DURATION_SEC,
    PREVIEW_RADIUS: PREVIEW_RADIUS,
    hash01: hash01,
    getSeed: getSeed,
    buildCast: buildCast
  };

  if (typeof window !== "undefined") window.MeteorSwarmAbility = api;
  if (typeof module !== "undefined") module.exports = api;
})();
