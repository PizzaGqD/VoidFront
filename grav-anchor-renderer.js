(function () {
  "use strict";

  var Common = (typeof window !== "undefined" && window.AbilityVfxCommon) ? window.AbilityVfxCommon : null;
  var LODRef = (typeof window !== "undefined" && window.LOD) ? window.LOD : null;
  var TAU = Math.PI * 2;
  var ANIM_SPEED = 3.0; // 2x over the lab max tempo.
  var PALETTE = {
    trim: 0xf1e8ff,
    core: 0xb694ff,
    line: 0x9f77ff,
    dark: 0x120d1f,
    shadow: 0x1b1331
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
    if (level === "far") {
      return { contours: 2, spikes: 7, braces: 2, nodes: 0, unitOverlays: false, jitter: 0.10 };
    }
    if (level === "mid") {
      return { contours: 3, spikes: 10, braces: 4, nodes: 2, unitOverlays: true, jitter: 0.15 };
    }
    return { contours: 4, spikes: 12, braces: 4, nodes: 2, unitOverlays: true, jitter: 0.18 };
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

  function drawIrregularContour(g, x, y, radius, wobble, points, color, alpha, width, spin, shear) {
    var pCount = Math.max(12, points || 56);
    var shearK = shear || 0;
    g.lineStyle(width, color, alpha);
    for (var i = 0; i <= pCount; i++) {
      var t = i / pCount;
      var ang = spin + t * TAU;
      var wave = Math.sin(ang * 3.0 + spin * 1.6) * wobble + Math.cos(ang * 5.0 - spin * 0.7) * wobble * 0.58;
      var rr = radius + wave;
      var px = x + Math.cos(ang) * rr + Math.sin(ang * 2.0 + spin) * radius * shearK * 0.20;
      var py = y + Math.sin(ang) * rr * 0.86 + Math.cos(ang * 3.0 - spin * 0.8) * radius * shearK * 0.10;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
  }

  function drawBeam(g, x1, y1, x2, y2, bendK, color, alpha, width, animTimeSec) {
    var mx = lerp(x1, x2, 0.5);
    var my = lerp(y1, y2, 0.5);
    var dx = x2 - x1;
    var dy = y2 - y1;
    var len = Math.max(1, Math.hypot(dx, dy));
    var nx = -dy / len;
    var ny = dx / len;
    var sway = Math.sin(animTimeSec * ANIM_SPEED * 1.2 + len * 0.01) * bendK;
    g.lineStyle(width + 1.8, PALETTE.shadow, alpha * 0.18);
    g.moveTo(x1, y1);
    g.quadraticCurveTo(mx + nx * sway, my + ny * sway, x2, y2);
    g.lineStyle(width, color, alpha);
    g.moveTo(x1, y1);
    g.quadraticCurveTo(mx + nx * sway, my + ny * sway, x2, y2);
  }

  function drawBrace(g, x, y, angle, radius, alpha) {
    var dx = Math.cos(angle);
    var dy = Math.sin(angle);
    var nx = -dy;
    var ny = dx;
    var px = x + dx * radius;
    var py = y + dy * radius;
    var arm = radius * 0.12;
    g.lineStyle(2.0, PALETTE.trim, alpha);
    g.moveTo(px + nx * arm, py + ny * arm);
    g.lineTo(px, py);
    g.lineTo(px - nx * arm, py - ny * arm);
  }

  function drawNode(g, x, y, radius, alpha) {
    g.beginFill(PALETTE.core, 0.18 * alpha);
    g.drawCircle(x, y, radius * 1.8);
    g.endFill();
    g.beginFill(PALETTE.trim, 0.72 * alpha);
    g.drawCircle(x, y, radius * 0.78);
    g.endFill();
    drawRing(g, x, y, radius * 1.1, 1.2, PALETTE.trim, 0.28 * alpha);
  }

  function drawCenterSigil(g, x, y, radius, alpha) {
    g.lineStyle(2.0, PALETTE.trim, 0.72 * alpha);
    g.moveTo(x, y - radius * 0.70);
    g.lineTo(x, y + radius * 0.42);
    g.moveTo(x - radius * 0.34, y - radius * 0.18);
    g.lineTo(x + radius * 0.34, y - radius * 0.18);
    g.arc(x, y + radius * 0.14, radius * 0.42, Math.PI * 0.12, Math.PI * 0.88);
    g.lineStyle(1.3, PALETTE.trim, 0.82 * alpha);
    g.drawCircle(x, y - radius * 0.82, radius * 0.16);
  }

  function drawLockGlyph(g, x, y, radius, alpha, spin) {
    drawRing(g, x, y, radius, 1.1, PALETTE.trim, 0.16 * alpha);
    drawRing(g, x, y, radius * 0.68, 0.9, PALETTE.line, 0.14 * alpha);
    var dx = Math.cos(spin);
    var dy = Math.sin(spin);
    var nx = -dy;
    var ny = dx;
    g.lineStyle(1.0, PALETTE.trim, 0.18 * alpha);
    g.moveTo(x - dx * radius * 0.72, y - dy * radius * 0.72);
    g.lineTo(x + dx * radius * 0.72, y + dy * radius * 0.72);
    g.moveTo(x - nx * radius * 0.72, y - ny * radius * 0.72);
    g.lineTo(x + nx * radius * 0.72, y + ny * radius * 0.72);
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
    var duration = Math.max(0.001, zone.duration || 5);
    var fadeIn = smoothstep(0, Math.min(0.55, duration * 0.18), elapsed);
    var fadeOut = 1 - smoothstep(duration * 0.76, duration, elapsed);
    var alpha = Math.max(0, fadeIn * fadeOut);
    if (alpha <= 0.001) return;

    var radius = zone.radius || 195;
    var detail = getDetail(getZoomLevel(opts.zoom || 0.22));
    var pulse = 0.5 + 0.5 * Math.sin(animTimeSec * ANIM_SPEED * 1.4 + (zone.seed || 0) * 0.001);
    var intensity = 0.62 + pulse * 0.38;
    var spin = animTimeSec * ANIM_SPEED * 0.20;

    gfx.beginFill(PALETTE.dark, 0.10 * alpha);
    gfx.drawCircle(zone.x, zone.y, radius * 1.10);
    gfx.endFill();
    gfx.beginFill(PALETTE.shadow, (0.12 + pulse * 0.04) * alpha);
    gfx.drawCircle(zone.x, zone.y, radius * 0.46);
    gfx.endFill();
    gfx.beginFill(PALETTE.core, (0.03 + intensity * 0.03) * alpha);
    gfx.drawCircle(zone.x, zone.y, radius * 0.82);
    gfx.endFill();

    for (var c = 0; c < detail.contours; c++) {
      var frac = detail.contours <= 1 ? 0 : c / (detail.contours - 1);
      var contourR = radius * (0.34 + frac * 0.70);
      drawIrregularContour(
        gfx,
        zone.x,
        zone.y,
        contourR,
        contourR * (0.016 + detail.jitter * 0.12),
        54,
        c % 2 === 0 ? PALETTE.trim : PALETTE.line,
        (0.22 - frac * 0.06) * alpha,
        1.2 + frac * 1.3,
        spin * (0.8 + frac * 0.4) + c * 0.42,
        detail.jitter
      );
    }

    for (var i = 0; i < detail.spikes; i++) {
      var ang = spin * 1.8 + (i / Math.max(1, detail.spikes)) * TAU;
      var outerR = radius * (0.94 + (i % 3) * 0.04);
      var innerR = radius * (0.44 + (i % 4) * 0.05);
      gfx.lineStyle(i % 3 === 0 ? 1.8 : 1.1, i % 2 === 0 ? PALETTE.trim : PALETTE.line, (0.10 + intensity * 0.12) * alpha);
      gfx.moveTo(zone.x + Math.cos(ang) * outerR, zone.y + Math.sin(ang) * outerR);
      gfx.lineTo(zone.x + Math.cos(ang) * innerR, zone.y + Math.sin(ang) * innerR);
    }

    for (var b = 0; b < detail.braces; b++) {
      drawBrace(gfx, zone.x, zone.y, spin * 0.7 + b * (TAU / detail.braces), radius * 1.01, (0.12 + pulse * 0.08) * alpha);
    }

    var nodes = [];
    for (var n = 0; n < detail.nodes; n++) {
      var nAng = spin * 1.4 + n * Math.PI;
      var nx = zone.x + Math.cos(nAng) * radius * 0.88;
      var ny = zone.y + Math.sin(nAng) * radius * 0.62;
      nodes.push({ x: nx, y: ny });
      drawNode(gfx, nx, ny, radius * 0.08, alpha);
      drawBeam(gfx, zone.x, zone.y, nx, ny, radius * 0.06, PALETTE.line, 0.18 * alpha, 1.1, animTimeSec);
    }

    if (detail.unitOverlays && opts.units && typeof opts.getUnitHitRadius === "function") {
      for (var unit of opts.units) {
        if (!unit || unit.hp <= 0 || unit.owner === zone.ownerId) continue;
        var dx = unit.x - zone.x;
        var dy = unit.y - zone.y;
        if (dx * dx + dy * dy > radius * radius) continue;
        var hitR = opts.getUnitHitRadius(unit) + 7;
        var source = nodes.length ? nodes[(unit.id || 0) % nodes.length] : { x: zone.x, y: zone.y };
        drawBeam(gfx, source.x, source.y, unit.x, unit.y, hitR * 0.8, PALETTE.trim, (0.10 + intensity * 0.12) * alpha, 1.3, animTimeSec);
        gfx.lineStyle(1.4, PALETTE.line, 0.16 * alpha);
        gfx.moveTo(unit.x + dx * 0.08, unit.y + dy * 0.08);
        gfx.lineTo(unit.x + dx * 0.42, unit.y + dy * 0.42);
        drawLockGlyph(gfx, unit.x, unit.y, hitR * 1.5, alpha, spin + (unit.id || 0) * 0.1);
        drawRing(gfx, unit.x, unit.y, hitR * 1.08, 1.2, PALETTE.trim, 0.16 * alpha);
      }
    }

    drawCenterSigil(gfx, zone.x, zone.y, radius * 0.24, alpha * (0.86 + pulse * 0.16));
    drawRing(gfx, zone.x, zone.y, radius, 2.4, PALETTE.trim, (0.18 + pulse * 0.12) * alpha);
    drawRing(gfx, zone.x, zone.y, radius * 0.68, 1.2, PALETTE.line, 0.12 * alpha);
    drawRing(gfx, zone.x, zone.y, radius * 0.20, 1.5, PALETTE.trim, 0.20 * alpha);
  }

  function drawPreview(g, preview, opts) {
    if (!g || !preview) return;
    var timeSec = (opts && opts.timeSec) || 0;
    var radius = preview.radius || preview.previewRadius || 195;
    var pulse = 0.5 + 0.5 * Math.sin(timeSec * ANIM_SPEED * 1.4);
    var spin = timeSec * ANIM_SPEED * 0.20;

    g.beginFill(PALETTE.dark, 0.08);
    g.drawCircle(preview.x, preview.y, radius * 1.08);
    g.endFill();
    g.beginFill(PALETTE.core, 0.05 + pulse * 0.03);
    g.drawCircle(preview.x, preview.y, radius * 0.78);
    g.endFill();

    drawIrregularContour(g, preview.x, preview.y, radius * 0.52, radius * 0.024, 52, PALETTE.trim, 0.20 + pulse * 0.06, 1.8, spin, 0.18);
    drawIrregularContour(g, preview.x, preview.y, radius * 0.90, radius * 0.032, 52, PALETTE.line, 0.18 + pulse * 0.06, 2.2, spin * 1.3, 0.18);
    for (var i = 0; i < 12; i++) {
      var ang = spin * 1.8 + (i / 12) * TAU;
      g.lineStyle(i % 3 === 0 ? 1.8 : 1.1, i % 2 === 0 ? PALETTE.trim : PALETTE.line, 0.16 + pulse * 0.08);
      g.moveTo(preview.x + Math.cos(ang) * radius * 0.96, preview.y + Math.sin(ang) * radius * 0.96);
      g.lineTo(preview.x + Math.cos(ang) * radius * 0.48, preview.y + Math.sin(ang) * radius * 0.48);
    }
    for (var b = 0; b < 4; b++) drawBrace(g, preview.x, preview.y, spin * 0.7 + b * (TAU / 4), radius * 1.02, 0.18 + pulse * 0.08);
    drawCenterSigil(g, preview.x, preview.y, radius * 0.24, 0.92);
    drawRing(g, preview.x, preview.y, radius, 2.4, PALETTE.trim, 0.30 + pulse * 0.10);
    drawRing(g, preview.x, preview.y, radius * 0.68, 1.2, PALETTE.line, 0.18 + pulse * 0.06);
  }

  function destroyZone(zone) {
    destroyGraphicRef(zone, "gfx");
  }

  var api = {
    STYLE_KEY: "shear-knot",
    PALETTE_KEY: "violet",
    TEMPO_MULT: ANIM_SPEED,
    renderZone: renderZone,
    drawPreview: drawPreview,
    destroyZone: destroyZone
  };

  if (typeof window !== "undefined") window.GravAnchorRenderer = api;
  if (typeof module !== "undefined") module.exports = api;
})();
