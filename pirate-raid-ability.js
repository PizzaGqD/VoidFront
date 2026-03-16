(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var STYLE_KEY = "blood-horizon";
  var PALETTE_KEY = "amber";
  var ZONE_RADIUS = 320;
  var PORTAL_DISTANCE_MIN = 250;
  var PORTAL_DISTANCE_MAX = 340;
  var PORTAL_DURATION_SEC = 2.8;
  var TOTAL_DURATION_SEC = 5.4;
  var SHIP_RELEASE_SPREAD = 108;
  var SHIP_TARGET_SPREAD = 70;
  var HYPER_DURATION_SEC = 9.0;
  var RAID_SHIPS = [
    { unitType: "fighter", lane: -2.8, launch: 0.14 },
    { unitType: "fighter", lane: -1.8, launch: 0.22 },
    { unitType: "fighter", lane: -0.9, launch: 0.30 },
    { unitType: "fighter", lane: 0.2, launch: 0.38 },
    { unitType: "fighter", lane: 1.2, launch: 0.46 },
    { unitType: "destroyer", lane: -1.4, launch: 0.56 },
    { unitType: "destroyer", lane: 0.8, launch: 0.68 },
    { unitType: "cruiser", lane: 0.0, launch: 0.82 }
  ];

  function hash01(seed) {
    var x = Math.sin(seed * 12.9898) * 43758.5453123;
    return x - Math.floor(x);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function getSeed(targetX, targetY, ownerId) {
    var sx = Math.round((targetX || 0) * 10);
    var sy = Math.round((targetY || 0) * 10);
    var so = Math.round(ownerId || 0);
    return ((sx * 73856093) ^ (sy * 19349663) ^ (so * 83492791)) >>> 0;
  }

  function smoothHash01(x, y, ownerId, phase) {
    var value = Math.sin((x || 0) * 0.0107 + (y || 0) * 0.0149 + (ownerId || 0) * 0.73 + (phase || 0) * 1.91);
    return value * 0.5 + 0.5;
  }

  function buildCast(targetX, targetY, ownerId, opts) {
    var options = opts || {};
    var seed = options.seed != null ? options.seed : getSeed(targetX, targetY, ownerId || 0);
    var sideAngle = options.sideAngle != null ? options.sideAngle : smoothHash01(targetX, targetY, ownerId || 0, 1) * TAU;
    var portalDistance = options.portalDistance != null
      ? options.portalDistance
      : lerp(PORTAL_DISTANCE_MIN, PORTAL_DISTANCE_MAX, smoothHash01(targetX, targetY, ownerId || 0, 2));
    var portalX = targetX + Math.cos(sideAngle) * portalDistance;
    var portalY = targetY + Math.sin(sideAngle) * portalDistance;
    var attackAngle = Math.atan2(targetY - portalY, targetX - portalX);
    var nx = -Math.sin(attackAngle);
    var ny = Math.cos(attackAngle);
    var ships = [];

    for (var i = 0; i < RAID_SHIPS.length; i++) {
      var spec = RAID_SHIPS[i];
      var laneSpread = spec.lane * 14;
      var laneX = nx * laneSpread;
      var laneY = ny * laneSpread;
      var spawnJitter = (hash01(seed + i * 11 + 3) - 0.5) * SHIP_RELEASE_SPREAD * 0.35;
      var targetJitter = (hash01(seed + i * 13 + 9) - 0.5) * SHIP_TARGET_SPREAD;
      ships.push({
        index: i,
        unitType: spec.unitType,
        launch: spec.launch,
        spawnX: portalX - Math.cos(attackAngle) * 28 + laneX + nx * spawnJitter,
        spawnY: portalY - Math.sin(attackAngle) * 28 + laneY + ny * spawnJitter,
        targetX: targetX + laneX * 0.36 + nx * targetJitter,
        targetY: targetY + laneY * 0.36 + ny * targetJitter
      });
    }

    return {
      seed: seed,
      styleKey: STYLE_KEY,
      paletteKey: PALETTE_KEY,
      ownerId: ownerId || 0,
      targetX: targetX,
      targetY: targetY,
      zoneRadius: options.zoneRadius || ZONE_RADIUS,
      portalX: portalX,
      portalY: portalY,
      portalDistance: portalDistance,
      sideAngle: sideAngle,
      attackAngle: attackAngle,
      portalDuration: options.portalDuration || PORTAL_DURATION_SEC,
      duration: options.duration || TOTAL_DURATION_SEC,
      hyperDuration: options.hyperDuration || HYPER_DURATION_SEC,
      ships: ships
    };
  }

  var api = {
    STYLE_KEY: STYLE_KEY,
    PALETTE_KEY: PALETTE_KEY,
    ZONE_RADIUS: ZONE_RADIUS,
    PORTAL_DURATION_SEC: PORTAL_DURATION_SEC,
    TOTAL_DURATION_SEC: TOTAL_DURATION_SEC,
    HYPER_DURATION_SEC: HYPER_DURATION_SEC,
    RAID_SHIPS: RAID_SHIPS,
    hash01: hash01,
    getSeed: getSeed,
    buildCast: buildCast
  };

  if (typeof window !== "undefined") window.PirateRaidAbility = api;
  if (typeof module !== "undefined") module.exports = api;
})();
