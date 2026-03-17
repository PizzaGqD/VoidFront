(function () {
  "use strict";

  var Common = (typeof window !== "undefined" && window.AbilityVfxCommon) ? window.AbilityVfxCommon : null;
  var LODRef = (typeof window !== "undefined" && window.LOD) ? window.LOD : null;
  var TAU = Math.PI * 2;
  var PALETTE = {
    core: 0x7dd6ff,
    trim: 0xd9f6ff,
    line: 0x6ebeff,
    dark: 0x09131f,
    hull: 0x183149
  };

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(a, b, x) {
    if (Common && typeof Common.smoothstep === "function") return Common.smoothstep(a, b, x);
    if (a === b) return x >= b ? 1 : 0;
    var t = clamp01((x - a) / Math.max(0.0001, b - a));
    return t * t * (3 - 2 * t);
  }

  function hash01(seed) {
    var value = Math.sin(seed * 12.9898) * 43758.5453123;
    return value - Math.floor(value);
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
      return {
        sparkCount: 5,
        debrisCount: 6,
        trailAlpha: 0.14,
        wakeLen: 54,
        ringCount: 2
      };
    }
    if (level === "mid") {
      return {
        sparkCount: 8,
        debrisCount: 10,
        trailAlpha: 0.18,
        wakeLen: 72,
        ringCount: 3
      };
    }
    return {
      sparkCount: 12,
      debrisCount: 14,
      trailAlpha: 0.22,
      wakeLen: 92,
      ringCount: 4
    };
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

  function drawTelemetryBrackets(g, x, y, radius, alpha, width) {
    var corner = radius * 0.24;
    g.lineStyle(width || 1, PALETTE.trim, alpha);
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

  function drawMeteorCore(g, meteor, angle, scale, alpha, timeSec, detail) {
    var dirX = Math.cos(angle);
    var dirY = Math.sin(angle);
    var nx = -dirY;
    var ny = dirX;
    var radius = scale;
    var wakeLen = detail.wakeLen * (0.75 + scale * 0.08);
    var wakeWidth = radius * 0.56;

    g.beginFill(PALETTE.dark, 0.34 * alpha);
    g.moveTo(meteor.x + dirX * radius * 0.8, meteor.y + dirY * radius * 0.8);
    g.lineTo(meteor.x - dirX * radius * 1.2 - nx * wakeWidth, meteor.y - dirY * radius * 1.2 - ny * wakeWidth);
    g.lineTo(meteor.x - dirX * wakeLen - nx * wakeWidth * 0.18, meteor.y - dirY * wakeLen - ny * wakeWidth * 0.18);
    g.lineTo(meteor.x - dirX * wakeLen * 0.56, meteor.y - dirY * wakeLen * 0.56);
    g.lineTo(meteor.x - dirX * wakeLen + nx * wakeWidth * 0.18, meteor.y - dirY * wakeLen + ny * wakeWidth * 0.18);
    g.lineTo(meteor.x - dirX * radius * 1.2 + nx * wakeWidth, meteor.y - dirY * radius * 1.2 + ny * wakeWidth);
    g.closePath();
    g.endFill();

    g.lineStyle(Math.max(2, radius * 0.74), PALETTE.line, detail.trailAlpha * alpha);
    g.moveTo(meteor.x - dirX * wakeLen * 0.92, meteor.y - dirY * wakeLen * 0.92);
    g.lineTo(meteor.x + dirX * radius * 0.45, meteor.y + dirY * radius * 0.45);

    g.lineStyle(Math.max(1.4, radius * 0.34), PALETTE.trim, 0.28 * alpha);
    g.moveTo(meteor.x - dirX * wakeLen * 0.56 - nx * radius * 0.22, meteor.y - dirY * wakeLen * 0.56 - ny * radius * 0.22);
    g.lineTo(meteor.x + nx * radius * 0.12, meteor.y + ny * radius * 0.12);
    g.moveTo(meteor.x - dirX * wakeLen * 0.50 + nx * radius * 0.24, meteor.y - dirY * wakeLen * 0.50 + ny * radius * 0.24);
    g.lineTo(meteor.x - nx * radius * 0.10, meteor.y - ny * radius * 0.10);

    for (var i = 0; i < detail.sparkCount; i++) {
      var seed = (meteor.seed || 1) + i * 13.7;
      var along = radius * (0.8 + hash01(seed + 1) * 3.2);
      var side = (hash01(seed + 2) - 0.5) * radius * 2.8;
      var len = radius * (0.4 + hash01(seed + 3) * 0.9);
      var px = meteor.x - dirX * along + nx * side;
      var py = meteor.y - dirY * along + ny * side;
      var wave = Math.sin((timeSec || 0) * 8 + i * 1.3);
      g.lineStyle(1 + hash01(seed + 4), i % 2 === 0 ? PALETTE.trim : PALETTE.line, alpha * (0.16 + hash01(seed + 5) * 0.16));
      g.moveTo(px, py);
      g.lineTo(px - dirX * len + nx * wave * radius * 0.12, py - dirY * len + ny * wave * radius * 0.12);
    }

    g.beginFill(PALETTE.hull, 0.88 * alpha);
    g.moveTo(meteor.x + dirX * radius * 0.96, meteor.y + dirY * radius * 0.96);
    g.lineTo(meteor.x + dirX * radius * 0.26 - nx * radius * 0.56, meteor.y + dirY * radius * 0.26 - ny * radius * 0.56);
    g.lineTo(meteor.x - dirX * radius * 0.82 - nx * radius * 0.34, meteor.y - dirY * radius * 0.82 - ny * radius * 0.34);
    g.lineTo(meteor.x - dirX * radius * 1.24, meteor.y - dirY * radius * 1.24);
    g.lineTo(meteor.x - dirX * radius * 0.82 + nx * radius * 0.34, meteor.y - dirY * radius * 0.82 + ny * radius * 0.34);
    g.lineTo(meteor.x + dirX * radius * 0.26 + nx * radius * 0.56, meteor.y + dirY * radius * 0.26 + ny * radius * 0.56);
    g.closePath();
    g.endFill();

    g.lineStyle(Math.max(1.1, radius * 0.18), PALETTE.trim, 0.42 * alpha);
    g.moveTo(meteor.x - dirX * radius * 0.44, meteor.y - dirY * radius * 0.44);
    g.lineTo(meteor.x + dirX * radius * 0.92, meteor.y + dirY * radius * 0.92);

    g.beginFill(PALETTE.core, 0.82 * alpha);
    g.drawCircle(meteor.x + dirX * radius * 0.56, meteor.y + dirY * radius * 0.56, radius * 0.44);
    g.endFill();
    g.beginFill(PALETTE.trim, 0.92 * alpha);
    g.drawCircle(meteor.x + dirX * radius * 0.70, meteor.y + dirY * radius * 0.70, radius * 0.18);
    g.endFill();
  }

  function renderMeteor(meteor, opts) {
    if (!meteor || !opts || !opts.layer) return;
    var trail = ensureGraphicRef(meteor, "trajGfx", opts.layer);
    var gfx = ensureGraphicRef(meteor, "gfx", opts.layer);
    if (!trail || !gfx) return;
    var level = getZoomLevel(opts.zoom || 0.22);
    var detail = getDetail(level);
    var timeSec = opts.timeSec || 0;
    var angle = meteor.angle != null ? meteor.angle : Math.atan2(meteor.vy || 0, meteor.vx || 1);
    var dirX = Math.cos(angle);
    var dirY = Math.sin(angle);
    var speed = Math.hypot(meteor.vx || 0, meteor.vy || 0) || 1;
    var wakeLen = detail.wakeLen + Math.min(50, speed * 0.018);
    var radius = Math.max(4.2, 8.4 * (meteor.visualScale || 1));
    var nx = -dirY;
    var ny = dirX;
    var pulse = 0.72 + 0.28 * Math.sin(timeSec * 9 + (meteor.seed || 1) * 0.01);

    trail.clear();
    gfx.clear();

    trail.lineStyle(Math.max(4, radius * 0.9), PALETTE.dark, 0.16 * pulse);
    trail.moveTo(meteor.x - dirX * wakeLen * 1.08, meteor.y - dirY * wakeLen * 1.08);
    trail.lineTo(meteor.x + dirX * radius * 0.1, meteor.y + dirY * radius * 0.1);
    trail.lineStyle(Math.max(2.6, radius * 0.44), PALETTE.line, detail.trailAlpha * pulse);
    trail.moveTo(meteor.x - dirX * wakeLen * 0.82, meteor.y - dirY * wakeLen * 0.82);
    trail.lineTo(meteor.x + dirX * radius * 0.22, meteor.y + dirY * radius * 0.22);
    trail.lineStyle(1.2, PALETTE.trim, 0.22 * pulse);
    trail.moveTo(meteor.x - dirX * wakeLen * 0.58 + nx * radius * 0.22, meteor.y - dirY * wakeLen * 0.58 + ny * radius * 0.22);
    trail.lineTo(meteor.x + nx * radius * 0.08, meteor.y + ny * radius * 0.08);
    trail.moveTo(meteor.x - dirX * wakeLen * 0.50 - nx * radius * 0.24, meteor.y - dirY * wakeLen * 0.50 - ny * radius * 0.24);
    trail.lineTo(meteor.x - nx * radius * 0.10, meteor.y - ny * radius * 0.10);

    gfx.beginFill(PALETTE.trim, 0.10 * pulse);
    gfx.drawCircle(meteor.x, meteor.y, radius * 2.2);
    gfx.endFill();
    gfx.beginFill(PALETTE.core, 0.08 * pulse);
    gfx.drawCircle(meteor.x, meteor.y, radius * 1.4);
    gfx.endFill();

    drawMeteorCore(gfx, meteor, angle, radius, pulse, timeSec, detail);
  }

  function renderImpact(fx, opts) {
    if (!fx || !opts || !opts.layer) return;
    var gfx = ensureGraphicRef(fx, "gfx", opts.layer);
    if (!gfx) return;
    var level = getZoomLevel(opts.zoom || 0.22);
    var detail = getDetail(level);
    var elapsed = Math.max(0, (opts.simTimeSec || 0) - (fx.t0 || 0));
    var duration = Math.max(0.001, fx.duration || 1.0);
    if (elapsed >= duration) {
      gfx.clear();
      return;
    }

    var fade = 1 - smoothstep(0, duration, elapsed);
    var expand = smoothstep(0, duration, elapsed);
    var radius = Math.max(8, fx.radius || 40);
    var flashR = radius * (0.82 + expand * 1.04);
    var angle = fx.angle || 0;

    gfx.clear();
    gfx.beginFill(PALETTE.trim, 0.42 * fade);
    gfx.drawCircle(fx.x, fx.y, radius * (0.34 + expand * 0.24));
    gfx.endFill();
    gfx.beginFill(PALETTE.core, 0.24 * fade);
    gfx.drawCircle(fx.x, fx.y, flashR);
    gfx.endFill();
    gfx.beginFill(PALETTE.line, 0.12 * fade);
    gfx.drawCircle(fx.x, fx.y, flashR * 1.24);
    gfx.endFill();
    gfx.beginFill(PALETTE.dark, 0.08 * fade);
    gfx.drawCircle(fx.x, fx.y, flashR * 1.44);
    gfx.endFill();

    for (var ring = 0; ring < detail.ringCount; ring++) {
      var frac = detail.ringCount <= 1 ? 0 : ring / (detail.ringCount - 1);
      var ringR = flashR * (0.84 + frac * 0.82);
      var alpha = Math.max(0, fade * (0.34 - frac * 0.06));
      gfx.lineStyle(Math.max(1.1, 3.8 - frac * 0.8), ring % 2 === 0 ? PALETTE.trim : PALETTE.line, alpha);
      gfx.drawCircle(fx.x, fx.y, ringR);
    }

    for (var spike = 0; spike < 8; spike++) {
      var spikeAng = angle + (spike / 8) * TAU + expand * 0.20;
      var sx = fx.x + Math.cos(spikeAng) * radius * 0.14;
      var sy = fx.y + Math.sin(spikeAng) * radius * 0.14;
      var ex = fx.x + Math.cos(spikeAng) * flashR * (0.70 + (spike % 3) * 0.12);
      var ey = fx.y + Math.sin(spikeAng) * flashR * (0.70 + (spike % 3) * 0.12);
      gfx.lineStyle(1.4 + (spike % 2) * 0.7, spike % 2 === 0 ? PALETTE.trim : PALETTE.line, 0.22 * fade);
      gfx.moveTo(sx, sy);
      gfx.lineTo(ex, ey);
    }

    for (var i = 0; i < detail.debrisCount; i++) {
      var seed = (fx.seed || 1) + i * 19.7;
      var ang = angle + (hash01(seed + 1) - 0.5) * 2.1;
      var dist = radius * (0.16 + hash01(seed + 2) * 0.88) * (0.34 + expand * 1.0);
      var len = 4 + hash01(seed + 3) * 10;
      var px = fx.x + Math.cos(ang) * dist;
      var py = fx.y + Math.sin(ang) * dist;
      var ex = px + Math.cos(ang) * len;
      var ey = py + Math.sin(ang) * len;
      gfx.lineStyle(1.0 + hash01(seed + 4), i % 2 === 0 ? PALETTE.trim : PALETTE.line, fade * (0.14 + hash01(seed + 5) * 0.14));
      gfx.moveTo(px, py);
      gfx.lineTo(ex, ey);
    }

    drawTelemetryBrackets(gfx, fx.x, fx.y, flashR * 0.76, 0.16 * fade, 1.0);
  }

  function drawPreview(g, preview, opts) {
    if (!g || !preview) return;
    var timeSec = opts && opts.timeSec ? opts.timeSec : 0;
    var pulse = 0.5 + 0.5 * Math.sin(timeSec * 2.4);
    var radius = preview.radius || 120;
    var shots = preview.shots || [];

    g.beginFill(PALETTE.dark, 0.040 + pulse * 0.018);
    g.drawCircle(preview.x, preview.y, radius);
    g.endFill();
    g.beginFill(PALETTE.core, 0.028 + pulse * 0.014);
    g.drawCircle(preview.x, preview.y, radius * 0.82);
    g.endFill();

    g.lineStyle(4.0, PALETTE.trim, 0.46 + pulse * 0.18);
    g.drawCircle(preview.x, preview.y, radius);
    g.lineStyle(2.4, PALETTE.line, 0.20 + pulse * 0.10);
    g.drawCircle(preview.x, preview.y, radius * 0.86);
    g.lineStyle(1.6, PALETTE.core, 0.22 + pulse * 0.08);
    g.drawCircle(preview.x, preview.y, radius * 0.68);
    g.beginFill(PALETTE.trim, 0.78);
    g.drawCircle(preview.x, preview.y, 5.0 + pulse * 1.4);
    g.endFill();
    drawTelemetryBrackets(g, preview.x, preview.y, radius * 0.72, 0.24 + pulse * 0.06, 1.4);

    if (!shots.length) {
      for (var tick = 0; tick < 12; tick++) {
        var ang = (tick / 12) * TAU + timeSec * 0.35;
        var inner = radius * 0.94;
        var outer = radius * 1.08;
        g.lineStyle(tick % 3 === 0 ? 2.2 : 1.3, tick % 2 === 0 ? PALETTE.trim : PALETTE.line, 0.22 + pulse * 0.10);
        g.moveTo(preview.x + Math.cos(ang) * inner, preview.y + Math.sin(ang) * inner);
        g.lineTo(preview.x + Math.cos(ang) * outer, preview.y + Math.sin(ang) * outer);
      }
      return;
    }

    for (var i = 0; i < shots.length; i++) {
      var shot = shots[i];
      var aimX = shot.predictedImpactX != null ? shot.predictedImpactX : shot.aimX;
      var aimY = shot.predictedImpactY != null ? shot.predictedImpactY : shot.aimY;
      g.lineStyle(1.2, PALETTE.line, 0.10 + pulse * 0.05);
      g.moveTo(shot.entryX, shot.entryY);
      g.lineTo(aimX, aimY);
      g.lineStyle(shot.swarmIndex === 0 ? 1.8 : 1.2, shot.swarmIndex === 0 ? PALETTE.trim : PALETTE.core, 0.24 + pulse * 0.08);
      g.drawCircle(aimX, aimY, shot.previewRadius || shot.aoeR || 30);
      g.beginFill(PALETTE.trim, 0.76);
      g.drawCircle(shot.entryX, shot.entryY, 3.0);
      g.endFill();
      g.beginFill(PALETTE.core, 0.82);
      g.drawCircle(aimX, aimY, 4.4);
      g.endFill();
      if (shot.predictedTargetRadius && shot.predictedTargetX != null && shot.predictedTargetY != null) {
        g.lineStyle(1.4, PALETTE.trim, 0.42);
        g.drawCircle(shot.predictedTargetX, shot.predictedTargetY, shot.predictedTargetRadius);
      }
    }
  }

  function destroyMeteor(meteor) {
    destroyGraphicRef(meteor, "gfx");
    destroyGraphicRef(meteor, "trajGfx");
  }

  function destroyImpact(fx) {
    destroyGraphicRef(fx, "gfx");
  }

  var api = {
    renderMeteor: renderMeteor,
    renderImpact: renderImpact,
    drawPreview: drawPreview,
    destroyMeteor: destroyMeteor,
    destroyImpact: destroyImpact
  };

  if (typeof window !== "undefined") window.MeteorSwarmRenderer = api;
  if (typeof module !== "undefined") module.exports = api;
})();
