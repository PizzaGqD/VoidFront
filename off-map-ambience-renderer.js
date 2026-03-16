(function () {
  "use strict";

  if (typeof window === "undefined") return;

  var PIXI = window.PIXI;
  if (!PIXI) return;

  var PRESET = {
    outsideShadeAlpha: 0.68,
    planetScale: 0.84,
    fxDensity: 0.82,
    drift: 0.54,
    planetPalette: [0x514c61, 0x766e8a, 0x8f879e],
    glowColor: 0xaeb4d6,
    trimColor: 0xe1e7f7,
    dustColor: 0xb9c3e0,
    wreckColor: 0x474353,
    beaconColor: 0xc7d7ff,
    shadowColor: 0x090a12
  };

  var runtime = {
    root: null,
    layers: [],
    planetScreenLayers: [],
    worldW: 0,
    worldH: 0,
    screenW: 0,
    screenH: 0,
    fieldRect: { x: 0, y: 0, w: 0, h: 0 },
    camera: { x: 0, y: 0, zoom: 1 },
    seed: 0,
    hazes: [],
    planets: [],
    dust: [],
    shards: [],
    hulks: [],
    beacons: []
  };

  var LAYER_ORDER = [
    { key: "far", parallax: 0.020, scaleMul: 0.11 },
    { key: "mid", parallax: 0.036, scaleMul: 0.16 },
    { key: "near", parallax: 0.052, scaleMul: 0.22 }
  ];

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function mulberry32(seed) {
    return function () {
      var t = seed += 0x6d2b79f5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function addCircle(g, x, y, r, color, alpha) {
    g.circle(x, y, r);
    g.fill({ color: color, alpha: alpha });
  }

  function addEllipseStroke(g, x, y, rx, ry, color, alpha, width, rotation) {
    if (rotation) {
      var cos = Math.cos(rotation);
      var sin = Math.sin(rotation);
      var steps = 42;
      for (var i = 0; i <= steps; i++) {
        var t = (i / steps) * Math.PI * 2;
        var px = Math.cos(t) * rx;
        var py = Math.sin(t) * ry;
        var wx = x + px * cos - py * sin;
        var wy = y + px * sin + py * cos;
        if (i === 0) g.moveTo(wx, wy);
        else g.lineTo(wx, wy);
      }
      g.stroke({ color: color, alpha: alpha, width: width });
      return;
    }
    g.ellipse(x, y, rx, ry);
    g.stroke({ color: color, alpha: alpha, width: width });
  }

  function addSoftEllipse(g, x, y, rx, ry, color, alpha, rot) {
    var driftX = Math.cos(rot || 0) * rx * 0.08;
    var driftY = Math.sin(rot || 0) * ry * 0.08;
    g.ellipse(x - driftX * 0.45, y - driftY * 0.45, rx * 1.42, ry * 1.32);
    g.fill({ color: color, alpha: alpha * 0.20 });
    g.ellipse(x - driftX * 0.18, y - driftY * 0.18, rx * 1.16, ry * 1.10);
    g.fill({ color: color, alpha: alpha * 0.34 });
    g.ellipse(x + driftX * 0.10, y + driftY * 0.10, rx, ry);
    g.fill({ color: color, alpha: alpha * 0.28 });
    g.ellipse(x + driftX * 0.26, y + driftY * 0.24, rx * 0.78, ry * 0.74);
    g.fill({ color: color, alpha: alpha * 0.12 });
  }

  function addRotatedEllipseArc(g, x, y, rx, ry, startAngle, endAngle, color, alpha, width, rotation) {
    var steps = 34;
    var cos = Math.cos(rotation || 0);
    var sin = Math.sin(rotation || 0);
    for (var i = 0; i <= steps; i++) {
      var t = startAngle + (endAngle - startAngle) * (i / steps);
      var px = Math.cos(t) * rx;
      var py = Math.sin(t) * ry;
      var wx = x + px * cos - py * sin;
      var wy = y + px * sin + py * cos;
      if (i === 0) g.moveTo(wx, wy);
      else g.lineTo(wx, wy);
    }
    g.stroke({ color: color, alpha: alpha, width: width });
  }

  function getLayerBucket(key) {
    for (var i = 0; i < runtime.layers.length; i++) {
      if (runtime.layers[i].key === key) return runtime.layers[i];
    }
    return runtime.layers[0] || null;
  }

  function getPlanetScreenBucket(key) {
    for (var i = 0; i < runtime.planetScreenLayers.length; i++) {
      if (runtime.planetScreenLayers[i].key === key) return runtime.planetScreenLayers[i];
    }
    return runtime.planetScreenLayers[0] || null;
  }

  function getLodLevel(zoom) {
    if (window.LOD && typeof window.LOD.getLevel === "function") return window.LOD.getLevel(zoom || 0.22);
    if ((zoom || 0.22) < 0.12) return "far";
    if ((zoom || 0.22) < 0.30) return "mid";
    return "near";
  }

  function getDetail(zoom) {
    var level = getLodLevel(zoom);
    if (level === "far") {
      return { hazeCount: 3, dustCount: 10, shardCount: 16, hulkCount: 2, beaconCount: 4 };
    }
    if (level === "mid") {
      return { hazeCount: 4, dustCount: 16, shardCount: 26, hulkCount: 3, beaconCount: 6 };
    }
    return { hazeCount: 5, dustCount: 24, shardCount: 38, hulkCount: 4, beaconCount: 8 };
  }

  function pickBandPoint(rng, worldW, worldH, padX, padY) {
    var side = Math.floor(rng() * 4);
    var px = padX == null ? 40 : padX;
    var py = padY == null ? px : padY;
    if (side === 0) return { side: side, x: -px - rng() * 240, y: rng() * worldH };
    if (side === 1) return { side: side, x: worldW + px + rng() * 240, y: rng() * worldH };
    if (side === 2) return { side: side, x: rng() * worldW, y: -py - rng() * 180 };
    return { side: side, x: rng() * worldW, y: worldH + py + rng() * 180 };
  }

  function buildLayout() {
    var rng = mulberry32((runtime.seed ^ 0x51f15e5) >>> 0);
    var worldW = runtime.worldW;
    var worldH = runtime.worldH;
    var fx = PRESET.fxDensity;
    var planetScale = PRESET.planetScale;

    runtime.hazes = [];
    runtime.planets = [];
    runtime.dust = [];
    runtime.shards = [];
    runtime.hulks = [];
    runtime.beacons = [];

    // Legacy off-map debris/beacons created blurry dashes and circles on the foreground.
    // Keep this renderer focused on distant ambience only.
  }

  function ensureAttached(layer, worldW, worldH) {
    runtime.worldW = worldW;
    runtime.worldH = worldH;
    if (runtime.root) return;
    runtime.root = new PIXI.Container();
    runtime.root.eventMode = "none";
    runtime.layers = [];
    for (var i = 0; i < LAYER_ORDER.length; i++) {
      var info = LAYER_ORDER[i];
      var bucket = {
        key: info.key,
        parallax: info.parallax,
        scaleMul: info.scaleMul,
        container: new PIXI.Container(),
        hazeGfx: new PIXI.Graphics(),
        ringBackGfx: new PIXI.Graphics(),
        planetGfx: new PIXI.Graphics(),
        ringFrontGfx: new PIXI.Graphics(),
        debrisGfx: new PIXI.Graphics(),
        beaconGfx: new PIXI.Graphics()
      };
      bucket.container._parallax = info.parallax;
      bucket.container.addChild(
        bucket.hazeGfx,
        bucket.ringBackGfx,
        bucket.planetGfx,
        bucket.ringFrontGfx,
        bucket.debrisGfx,
        bucket.beaconGfx
      );
      runtime.layers.push(bucket);
      runtime.root.addChild(bucket.container);
    }
    runtime.planetScreenLayers = [];
    for (var j = 0; j < LAYER_ORDER.length; j++) {
      var info2 = LAYER_ORDER[j];
      var screenBucket = {
        key: info2.key,
        parallax: info2.parallax,
        ringBackGfx: new PIXI.Graphics(),
        planetGfx: new PIXI.Graphics(),
        ringFrontGfx: new PIXI.Graphics()
      };
      runtime.planetScreenLayers.push(screenBucket);
      runtime.root.addChild(screenBucket.ringBackGfx, screenBucket.planetGfx, screenBucket.ringFrontGfx);
    }
    if (layer) layer.addChild(runtime.root);
  }

  function drawHazes(timeSec, detail) {
    for (var li = 0; li < runtime.layers.length; li++) runtime.layers[li].hazeGfx.clear();
    for (var i = 0; i < Math.min(detail.hazeCount, runtime.hazes.length); i++) {
      var haze = runtime.hazes[i];
      var bucket = getLayerBucket(haze.layerKey);
      if (!bucket) continue;
      var g = bucket.hazeGfx;
      var pulse = 0.5 + 0.5 * Math.sin(timeSec * 0.18 + haze.rot * 7 + i * 0.6);
      var alpha = haze.alpha * (0.78 + pulse * 0.28);
      addSoftEllipse(g, haze.x, haze.y, haze.rx, haze.ry, haze.color, alpha, haze.rot);
      addSoftEllipse(g, haze.x + Math.cos(haze.rot + i) * haze.rx * 0.06, haze.y - Math.sin(haze.rot + i) * haze.ry * 0.05, haze.rx * 0.66, haze.ry * 0.58, PRESET.trimColor, alpha * 0.62, haze.rot + 0.45);
    }
  }

  function drawPlanets(timeSec) {
    for (var li = 0; li < runtime.planetScreenLayers.length; li++) {
      runtime.planetScreenLayers[li].planetGfx.clear();
      runtime.planetScreenLayers[li].ringBackGfx.clear();
      runtime.planetScreenLayers[li].ringFrontGfx.clear();
    }
  }

  function drawHulk(g, x, y, size, rot, alpha) {
    var cos = Math.cos(rot);
    var sin = Math.sin(rot);
    var pts = [
      { x: size, y: 0 },
      { x: size * 0.16, y: -size * 0.42 },
      { x: -size * 0.66, y: -size * 0.20 },
      { x: -size * 0.82, y: size * 0.14 },
      { x: size * 0.10, y: size * 0.42 }
    ];
    for (var i = 0; i < pts.length; i++) {
      var px = x + pts[i].x * cos - pts[i].y * sin;
      var py = y + pts[i].x * sin + pts[i].y * cos;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.lineTo(x + pts[0].x * cos - pts[0].y * sin, y + pts[0].x * sin + pts[0].y * cos);
    g.fill({ color: PRESET.wreckColor, alpha: alpha });
    g.moveTo(x - Math.cos(rot) * size * 0.40, y - Math.sin(rot) * size * 0.40);
    g.lineTo(x + Math.cos(rot) * size * 0.55, y + Math.sin(rot) * size * 0.55);
    g.stroke({ color: PRESET.trimColor, alpha: alpha * 0.28, width: 1.2 });
  }

  function drawDebris(timeSec, detail) {
    for (var li = 0; li < runtime.layers.length; li++) runtime.layers[li].debrisGfx.clear();
    var driftMul = 0.55 + PRESET.drift;

    for (var i = 0; i < Math.min(detail.dustCount, runtime.dust.length); i++) {
      var dust = runtime.dust[i];
      var bucket = getLayerBucket(dust.layerKey);
      if (!bucket) continue;
      var g = bucket.debrisGfx;
      var sway = Math.sin(timeSec * dust.speed * driftMul + dust.phase) * 12;
      var angle = dust.angle + Math.sin(timeSec * dust.speed + dust.phase) * 0.08;
      var dx = Math.cos(angle) * dust.len * 0.5;
      var dy = Math.sin(angle) * dust.len * 0.5;
      g.moveTo(dust.x - dx, dust.y - dy + sway);
      g.lineTo(dust.x + dx, dust.y + dy + sway);
      g.stroke({ color: PRESET.dustColor, alpha: dust.alpha, width: dust.width });
    }

    for (var j = 0; j < Math.min(detail.shardCount, runtime.shards.length); j++) {
      var shard = runtime.shards[j];
      var bucket2 = getLayerBucket(shard.layerKey);
      if (!bucket2) continue;
      var g2 = bucket2.debrisGfx;
      var spin = timeSec * shard.speed * driftMul + shard.phase;
      var angle2 = shard.angle + Math.sin(spin) * 0.24;
      var sx = shard.x + Math.cos(spin * 0.8) * 8;
      var sy = shard.y + Math.sin(spin) * 8;
      var sdx = Math.cos(angle2) * shard.len;
      var sdy = Math.sin(angle2) * shard.len;
      g2.moveTo(sx - sdx * 0.24, sy - sdy * 0.24);
      g2.lineTo(sx + sdx, sy + sdy);
      g2.stroke({ color: PRESET.trimColor, alpha: shard.alpha, width: shard.width });
    }

    for (var h = 0; h < Math.min(detail.hulkCount, runtime.hulks.length); h++) {
      var hulk = runtime.hulks[h];
      var bucket3 = getLayerBucket(hulk.layerKey);
      if (!bucket3) continue;
      drawHulk(
        bucket3.debrisGfx,
        hulk.x + Math.sin(timeSec * 0.10 + hulk.rot) * 5,
        hulk.y + Math.cos(timeSec * 0.08 + hulk.rot) * 4,
        hulk.size,
        hulk.rot + Math.sin(timeSec * 0.06 + hulk.rot) * 0.03,
        hulk.alpha
      );
    }
  }

  function drawBeacons(timeSec, detail) {
    for (var li = 0; li < runtime.layers.length; li++) runtime.layers[li].beaconGfx.clear();
    for (var i = 0; i < Math.min(detail.beaconCount, runtime.beacons.length); i++) {
      var beacon = runtime.beacons[i];
      var bucket = getLayerBucket(beacon.layerKey);
      if (!bucket) continue;
      var g = bucket.beaconGfx;
      var pulse = 0.5 + 0.5 * Math.sin(timeSec * 1.6 + beacon.phase);
      g.circle(beacon.x, beacon.y, beacon.r * (0.86 + pulse * 0.18));
      g.stroke({ color: PRESET.beaconColor, alpha: beacon.alpha * 0.5, width: 1.2 });
      addCircle(g, beacon.x, beacon.y, 2.0 + pulse * 2.2, PRESET.beaconColor, 0.24 + pulse * 0.10);
    }
  }

  function attach(opts) {
    opts = opts || {};
    runtime.screenW = opts.screenWidth || runtime.screenW || 1920;
    runtime.screenH = opts.screenHeight || runtime.screenH || 1080;
    ensureAttached(opts.layer, opts.worldWidth || runtime.worldW || 1600, opts.worldHeight || runtime.worldH || 900);
  }

  function rebuild(opts) {
    opts = opts || {};
    runtime.seed = (opts.seed >>> 0) || 1;
    runtime.worldW = opts.worldWidth || runtime.worldW || 1600;
    runtime.worldH = opts.worldHeight || runtime.worldH || 900;
    runtime.screenW = opts.screenWidth || runtime.screenW || 1920;
    runtime.screenH = opts.screenHeight || runtime.screenH || 1080;
    buildLayout();
  }

  function step(dt, timeSec, zoom) {
    if (!runtime.root) return;
    var detail = getDetail(zoom || 0.22);
    drawHazes(timeSec || 0, detail);
    drawPlanets(timeSec || 0);
  }

  function applyCamera(camX, camY, zoom, screenW, screenH) {
    var z = Math.max(0.001, zoom || 0.22);
    if (screenW != null) runtime.screenW = screenW;
    if (screenH != null) runtime.screenH = screenH;
    var sw = runtime.screenW || 1920;
    var sh = runtime.screenH || 1080;
    runtime.camera.x = camX || 0;
    runtime.camera.y = camY || 0;
    runtime.camera.zoom = z;
    runtime.fieldRect.x = camX || 0;
    runtime.fieldRect.y = camY || 0;
    runtime.fieldRect.w = runtime.worldW * z;
    runtime.fieldRect.h = runtime.worldH * z;
    var viewCx = (sw * 0.5 - (camX || 0)) / z;
    var viewCy = (sh * 0.5 - (camY || 0)) / z;
    for (var i = 0; i < runtime.layers.length; i++) {
      var layer = runtime.layers[i];
      if (!layer || !layer.container) continue;
      var pivotX = runtime.worldW * 0.5 + (viewCx - runtime.worldW * 0.5) * layer.parallax;
      var pivotY = runtime.worldH * 0.5 + (viewCy - runtime.worldH * 0.5) * layer.parallax;
      layer.container.pivot.set(pivotX, pivotY);
      layer.container.position.set(sw * 0.5, sh * 0.5);
      var scale = z * layer.scaleMul;
      layer.container.scale.set(scale, scale);
    }
  }

  function getOutsideShadeAlpha() {
    return PRESET.outsideShadeAlpha;
  }

  window.OffMapAmbienceRenderer = {
    attach: attach,
    rebuild: rebuild,
    step: step,
    applyCamera: applyCamera,
    getOutsideShadeAlpha: getOutsideShadeAlpha
  };
})();
