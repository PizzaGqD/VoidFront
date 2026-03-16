(function () {
  "use strict";

  var Common = (typeof window !== "undefined" && window.AbilityVfxCommon) ? window.AbilityVfxCommon : null;
  var LODRef = (typeof window !== "undefined" && window.LOD) ? window.LOD : null;
  var TAU = Math.PI * 2;
  var ANIM_SPEED = 3.0; // 2x over the lab max tempo.
  var PALETTE = {
    trim: 0xe0ffed,
    core: 0x7de1a8,
    line: 0x67d497,
    dark: 0x0a1610,
    shadow: 0x06100b
  };
  var VARIANT = {
    fog: 0.20,
    cells: 20,
    tendrils: 10,
    shards: 10,
    halo: 0.16,
    suppression: 0.48
  };

  function clamp01(x) {
    if (Common && typeof Common.clamp01 === "function") return Common.clamp01(x);
    return Math.max(0, Math.min(1, x));
  }

  function lerp(a, b, t) {
    if (Common && typeof Common.lerp === "function") return Common.lerp(a, b, t);
    return a + (b - a) * t;
  }

  function smoothstep(a, b, x) {
    if (Common && typeof Common.smoothstep === "function") return Common.smoothstep(a, b, x);
    if (a === b) return x >= b ? 1 : 0;
    var t = clamp01((x - a) / Math.max(0.0001, b - a));
    return t * t * (3 - 2 * t);
  }

  function getZoomLevel(zoom) {
    if (!LODRef || typeof LODRef.getLevel !== "function" || !LODRef.LEVELS) return "near";
    var level = LODRef.getLevel(zoom || 0.22);
    if (level === LODRef.LEVELS.FAR) return "far";
    if (level === LODRef.LEVELS.MID) return "mid";
    return "near";
  }

  function getDetail(level) {
    if (level === "far") return { cells: 12, shards: 6, tendrils: 5, bites: 6, overlays: false };
    if (level === "mid") return { cells: 20, shards: 10, tendrils: 8, bites: 7, overlays: true };
    return { cells: 28, shards: 14, tendrils: 12, bites: 8, overlays: true };
  }

  function destroyGraphicRef(owner, key) {
    if (!owner || !owner[key]) return;
    if (owner[key].parent) owner[key].parent.removeChild(owner[key]);
    owner[key].destroy(true);
    owner[key] = null;
  }

  function ensureGraphicRef(owner, key, layer) {
    if (!owner) return null;
    if (owner[key] && owner[key].destroyed) owner[key] = null;
    if (!owner[key]) {
      owner[key] = new PIXI.Graphics();
      if (layer) layer.addChild(owner[key]);
    } else if (layer && owner[key].parent !== layer) {
      layer.addChild(owner[key]);
    }
    return owner[key];
  }

  function hash01(seed) {
    var x = Math.sin(seed * 12.9898) * 43758.5453123;
    return x - Math.floor(x);
  }

  function drawRing(g, x, y, radius, width, color, alpha) {
    g.lineStyle(width, color, alpha);
    g.drawCircle(x, y, radius);
  }

  function drawTelemetryBrackets(g, x, y, radius, alpha, width) {
    var corner = radius * 0.24;
    g.lineStyle(width || 1.2, PALETTE.trim, alpha);
    for (var i = 0; i < 4; i++) {
      var sx = i < 2 ? -1 : 1;
      var sy = i % 2 === 0 ? -1 : 1;
      var px = x + sx * radius;
      var py = y + sy * radius;
      g.moveTo(px, py + sy * corner);
      g.lineTo(px, py);
      g.lineTo(px + sx * corner, py);
    }
  }

  function drawSuppressionMarks(g, x, y, shipScale, alpha, animTimeSec) {
    for (var i = 0; i < 3; i++) {
      var sway = Math.sin(animTimeSec * ANIM_SPEED * 0.8 + i * 0.7) * shipScale * 0.18;
      var px = x + shipScale * (1.2 + i * 0.55);
      var py = y - shipScale * 0.7 + i * shipScale * 0.42 + sway;
      g.lineStyle(1.2, PALETTE.trim, alpha * (0.52 - i * 0.10));
      g.moveTo(px - shipScale * 0.5, py - shipScale * 0.18);
      g.lineTo(px, py + shipScale * 0.28);
      g.lineTo(px + shipScale * 0.5, py - shipScale * 0.18);
    }
    g.lineStyle(1.0, PALETTE.line, alpha * 0.34);
    g.moveTo(x + shipScale * 1.0, y - shipScale * 1.0);
    g.lineTo(x + shipScale * 2.4, y + shipScale * 0.4);
    g.moveTo(x + shipScale * 2.4, y - shipScale * 1.0);
    g.lineTo(x + shipScale * 1.0, y + shipScale * 0.4);
  }

  function drawCorrosion(g, x, y, shipScale, alpha, seed, animTimeSec) {
    for (var i = 0; i < 6; i++) {
      var ang = hash01(seed + i * 7) * TAU + animTimeSec * ANIM_SPEED * 0.30;
      var dist = shipScale * (0.9 + hash01(seed + i * 11) * 1.8);
      var len = shipScale * (0.8 + hash01(seed + i * 13) * 1.4);
      var sx = x + Math.cos(ang) * dist;
      var sy = y + Math.sin(ang) * dist;
      g.lineStyle(1.0 + hash01(seed + i * 5), i % 2 === 0 ? PALETTE.trim : PALETTE.line, alpha * (i % 2 === 0 ? 0.22 : 0.16));
      g.moveTo(sx, sy);
      g.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
    }
  }

  function drawCloudLobe(g, x, y, radius, alpha) {
    g.beginFill(PALETTE.core, alpha);
    g.drawCircle(x, y, radius);
    g.endFill();
  }

  function drawPerimeterBite(g, x, y, angle, radius, alpha) {
    var biteX = x + Math.cos(angle) * radius;
    var biteY = y + Math.sin(angle) * radius * 0.78;
    g.beginFill(PALETTE.trim, 0.16 * alpha);
    g.drawCircle(biteX, biteY, radius * 0.08);
    g.endFill();
    g.beginFill(PALETTE.core, 0.10 * alpha);
    g.drawCircle(biteX, biteY, radius * 0.13);
    g.endFill();
    drawRing(g, biteX, biteY, radius * 0.18, 0.9, PALETTE.trim, 0.10 * alpha);
  }

  function renderZone(zone, opts) {
    if (!zone || !opts || !opts.layer) return;
    var gfx = ensureGraphicRef(zone, "gfx", opts.layer);
    if (!gfx) return;
    gfx.clear();

    if (opts.visible === false) return;

    var simTimeSec = opts.simTimeSec || 0;
    var animTimeSec = opts.animTimeSec || simTimeSec;
    var elapsed = Math.max(0, simTimeSec - (zone.spawnedAt || 0));
    var duration = Math.max(0.001, zone.duration || 10);
    var fadeIn = smoothstep(0, Math.min(0.8, duration * 0.14), elapsed);
    var fadeOut = 1 - smoothstep(duration * 0.80, duration, elapsed);
    var alpha = Math.max(0, fadeIn * fadeOut);
    if (alpha <= 0.001) return;

    var radius = zone.radius || 240;
    var detail = getDetail(getZoomLevel(opts.zoom || 0.22));
    var cycleSec = animTimeSec * ANIM_SPEED;
    var pulse = 0.5 + 0.5 * Math.sin(cycleSec * 0.9 + (zone.seed || 0) * 0.001);
    var intensity = 0.72 + pulse * 0.40;

    drawRing(gfx, zone.x, zone.y, radius, 2.4, PALETTE.line, (0.24 + pulse * 0.10) * alpha);
    drawRing(gfx, zone.x, zone.y, radius * 0.72, 1.3, PALETTE.core, (0.12 + pulse * 0.06) * alpha);

    gfx.beginFill(PALETTE.dark, (0.28 + pulse * 0.06) * alpha);
    gfx.drawCircle(zone.x, zone.y, radius * 0.56);
    gfx.endFill();
    gfx.beginFill(PALETTE.shadow, (0.18 + pulse * 0.04) * alpha);
    gfx.drawCircle(zone.x, zone.y, radius * 0.32);
    gfx.endFill();
    gfx.beginFill(PALETTE.core, (VARIANT.fog * 0.42) * intensity * alpha);
    gfx.drawCircle(zone.x, zone.y, radius * 1.18);
    gfx.endFill();
    gfx.beginFill(PALETTE.core, (VARIANT.fog * 0.62) * intensity * alpha);
    gfx.drawCircle(zone.x, zone.y, radius * 0.88);
    gfx.endFill();

    for (var l = 0; l < 6; l++) {
      var lobeAng = (l / 6) * TAU + cycleSec * 0.24 * (l % 2 === 0 ? 1 : -1);
      var lobeDist = radius * (0.22 + (l % 3) * 0.07);
      var lx = zone.x + Math.cos(lobeAng) * lobeDist;
      var ly = zone.y + Math.sin(lobeAng) * lobeDist * 0.78;
      drawCloudLobe(gfx, lx, ly, radius * (0.22 + (l % 2) * 0.04), 0.07 * intensity * alpha);
    }

    for (var b = 0; b < detail.bites; b++) {
      drawPerimeterBite(gfx, zone.x, zone.y, (b / detail.bites) * TAU + cycleSec * 0.18, radius * (0.78 + (b % 2) * 0.06), alpha * (0.8 + pulse * 0.2));
    }

    for (var c = 0; c < detail.cells; c++) {
      var cellSeed = (zone.seed || 0) + c * 19 + 211;
      var ang = hash01(cellSeed + 1) * TAU + cycleSec * (0.08 + hash01(cellSeed + 2) * 0.14);
      var rr = radius * (0.10 + hash01(cellSeed + 3) * 0.86);
      var x = zone.x + Math.cos(ang) * rr;
      var y = zone.y + Math.sin(ang) * rr * 0.74;
      var r = 1.1 + hash01(cellSeed + 4) * 3.1;
      gfx.beginFill(c % 3 === 0 ? PALETTE.trim : PALETTE.core, (c % 3 === 0 ? 0.14 : 0.10) * intensity * alpha);
      gfx.drawCircle(x, y, r);
      gfx.endFill();
    }

    for (var sh = 0; sh < detail.shards; sh++) {
      var shardSeed = (zone.seed || 0) + sh * 29 + 337;
      var shardAng = hash01(shardSeed) * TAU + cycleSec * 0.20;
      var shardR = radius * (0.14 + hash01(shardSeed + 1) * 0.82);
      var sx = zone.x + Math.cos(shardAng) * shardR;
      var sy = zone.y + Math.sin(shardAng) * shardR * 0.78;
      var len = 4 + hash01(shardSeed + 2) * 12;
      gfx.lineStyle(1.0 + hash01(shardSeed + 3), sh % 2 === 0 ? PALETTE.trim : PALETTE.line, (0.14 + intensity * 0.10) * alpha);
      gfx.moveTo(sx - Math.cos(shardAng) * len * 0.4, sy - Math.sin(shardAng) * len * 0.4);
      gfx.lineTo(sx + Math.cos(shardAng) * len, sy + Math.sin(shardAng) * len);
    }

    var unitsInZone = [];
    if (opts.units) {
      for (var unit of opts.units) {
        if (!unit || unit.hp <= 0 || unit.owner === zone.ownerId) continue;
        var dx = unit.x - zone.x;
        var dy = unit.y - zone.y;
        if (dx * dx + dy * dy > radius * radius) continue;
        unitsInZone.push(unit);
      }
    }

    var tendrilCount = Math.max(Math.min(detail.tendrils, Math.max(1, unitsInZone.length)), Math.min(4, detail.tendrils));
    for (var t = 0; t < tendrilCount; t++) {
      var target = unitsInZone.length ? unitsInZone[t % unitsInZone.length] : {
        x: zone.x + Math.cos((t / Math.max(1, tendrilCount)) * TAU + cycleSec * 0.22) * radius * 0.54,
        y: zone.y + Math.sin((t / Math.max(1, tendrilCount)) * TAU + cycleSec * 0.22) * radius * 0.40
      };
      var rootAng = (t / Math.max(1, detail.tendrils)) * TAU + cycleSec * 0.14;
      var rootX = zone.x + Math.cos(rootAng) * radius * (0.26 + (t % 3) * 0.08);
      var rootY = zone.y + Math.sin(rootAng) * radius * (0.20 + (t % 2) * 0.10);
      var bendX = lerp(rootX, target.x, 0.46) + Math.sin(animTimeSec * ANIM_SPEED * 0.5 + t) * 18;
      var bendY = lerp(rootY, target.y, 0.46) - Math.cos(animTimeSec * ANIM_SPEED * 0.5 + t) * 18;
      gfx.lineStyle(1.0 + (t % 2) * 0.6, PALETTE.trim, (0.12 + intensity * 0.12) * alpha);
      gfx.moveTo(rootX, rootY);
      gfx.quadraticCurveTo(bendX, bendY, target.x, target.y);
    }

    if (detail.overlays && typeof opts.getUnitHitRadius === "function") {
      for (var i = 0; i < unitsInZone.length; i++) {
        var overlayUnit = unitsInZone[i];
        var hitR = opts.getUnitHitRadius(overlayUnit) + 6;
        drawCorrosion(gfx, overlayUnit.x, overlayUnit.y, hitR * 1.08, alpha * intensity * 1.12, (zone.seed || 0) + (overlayUnit.id || i) * 41, animTimeSec);
        drawRing(gfx, overlayUnit.x, overlayUnit.y, hitR * 1.16, 1.1, PALETTE.trim, (0.12 + intensity * 0.10) * alpha);
        drawRing(gfx, overlayUnit.x, overlayUnit.y, hitR * 1.82, 0.9, PALETTE.core, (0.08 + intensity * 0.06) * alpha);
        drawTelemetryBrackets(gfx, overlayUnit.x, overlayUnit.y, hitR * 1.54, (0.08 + intensity * 0.08) * alpha, 1.0);
        drawSuppressionMarks(gfx, overlayUnit.x, overlayUnit.y, hitR, alpha * (0.44 + pulse * 0.20), animTimeSec);
      }
    }
  }

  function drawPreview(g, preview, opts) {
    if (!g || !preview) return;
    var timeSec = (opts && opts.timeSec) || 0;
    var radius = preview.radius || preview.previewRadius || 240;
    var pulse = 0.5 + 0.5 * Math.sin(timeSec * ANIM_SPEED * 0.9);
    var cycleSec = timeSec * ANIM_SPEED;

    drawRing(g, preview.x, preview.y, radius, 2.4, PALETTE.line, 0.28 + pulse * 0.10);
    drawRing(g, preview.x, preview.y, radius * 0.72, 1.3, PALETTE.core, 0.14 + pulse * 0.05);
    g.beginFill(PALETTE.dark, 0.18 + pulse * 0.05);
    g.drawCircle(preview.x, preview.y, radius * 0.54);
    g.endFill();
    g.beginFill(PALETTE.core, 0.08 + pulse * 0.03);
    g.drawCircle(preview.x, preview.y, radius * 1.12);
    g.endFill();
    for (var l = 0; l < 6; l++) {
      var lobeAng = (l / 6) * TAU + cycleSec * 0.24 * (l % 2 === 0 ? 1 : -1);
      var lx = preview.x + Math.cos(lobeAng) * radius * 0.24;
      var ly = preview.y + Math.sin(lobeAng) * radius * 0.24 * 0.78;
      drawCloudLobe(g, lx, ly, radius * (0.20 + (l % 2) * 0.04), 0.07 + pulse * 0.02);
    }
    for (var p = 0; p < 8; p++) {
      drawPerimeterBite(g, preview.x, preview.y, (p / 8) * TAU + cycleSec * 0.18, radius * (0.78 + (p % 2) * 0.06), 0.9 + pulse * 0.2);
    }
    for (var i = 0; i < 10; i++) {
      var ang = (i / 10) * TAU + cycleSec * 0.20;
      g.lineStyle(1.2, i % 2 === 0 ? PALETTE.trim : PALETTE.line, 0.20 + pulse * 0.06);
      g.moveTo(preview.x + Math.cos(ang) * radius * 0.22, preview.y + Math.sin(ang) * radius * 0.22);
      g.lineTo(preview.x + Math.cos(ang) * radius * 0.82, preview.y + Math.sin(ang) * radius * 0.82);
    }
  }

  function destroyZone(zone) {
    destroyGraphicRef(zone, "gfx");
  }

  var api = {
    STYLE_KEY: "eclipse-mites",
    PALETTE_KEY: "emerald",
    TEMPO_MULT: ANIM_SPEED,
    renderZone: renderZone,
    drawPreview: drawPreview,
    destroyZone: destroyZone
  };

  if (typeof window !== "undefined") window.NanoSwarmRenderer = api;
  if (typeof module !== "undefined") module.exports = api;
})();
