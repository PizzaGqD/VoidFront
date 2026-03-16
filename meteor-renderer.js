/**
 * MeteorStrikeRenderer - visual-only renderer for directed meteor
 * and orbital strike abilities.
 */
(function () {
  "use strict";

  var Common = (typeof window !== "undefined" && window.AbilityVfxCommon) ? window.AbilityVfxCommon : null;
  var LODRef = (typeof window !== "undefined" && window.LOD) ? window.LOD : null;
  var TAU = Math.PI * 2;
  var PALETTE = {
    core: 0xff8aa5,
    trim: 0xffe1ea,
    line: 0xff6b8d,
    dark: 0x180d14,
    glow: "255,138,165"
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
    var x = Math.sin(seed * 12.9898) * 43758.5453123;
    return x - Math.floor(x);
  }

  function getZoomLevel(zoom) {
    if (!LODRef || typeof LODRef.getLevel !== "function" || !LODRef.LEVELS) return "near";
    var level = LODRef.getLevel(zoom || 0.22);
    if (level === LODRef.LEVELS.FAR) return "far";
    if (level === LODRef.LEVELS.MID) return "mid";
    return "near";
  }

  function getMeteorDetail(level) {
    if (level === "far") {
      return {
        corridorFillAlpha: 0.08,
        corridorEdgeAlpha: 0.36,
        centerLineAlpha: 0.22,
        telemetrySteps: 3,
        sparkCount: 6,
        flightFxCount: 8,
        debrisCount: 6,
        ringCount: 2
      };
    }
    if (level === "mid") {
      return {
        corridorFillAlpha: 0.11,
        corridorEdgeAlpha: 0.50,
        centerLineAlpha: 0.30,
        telemetrySteps: 4,
        sparkCount: 8,
        flightFxCount: 11,
        debrisCount: 10,
        ringCount: 3
      };
    }
    return {
      corridorFillAlpha: 0.14,
      corridorEdgeAlpha: 0.64,
      centerLineAlpha: 0.38,
      telemetrySteps: 5,
      sparkCount: 10,
      flightFxCount: 15,
      debrisCount: 14,
      ringCount: 4
    };
  }

  function getSignalBloomMeteorStyle(level) {
    return {
      tailLen: 1.02,
      tailWidth: 0.78,
      coreTall: 1.06,
      striationCount: 4,
      trailAlpha: level === "far" ? 0.08 : 0.12
    };
  }

  function getOrbitalStyle(level) {
    var far = level === "far";
    var mid = level === "mid";
    return {
      beamWidth: 1.9,
      beamAlpha: far ? 0.10 : 0.16,
      trimAlpha: 0.52,
      headRadius: 3.3,
      ringAlpha: 0.18,
      impactGlow: 0.10,
      shockWidth: 0.96,
      spikeCount: far ? 5 : (mid ? 7 : 9),
      sparkCount: far ? 2 : (mid ? 4 : 6),
      debrisAlpha: 0.50,
      markerAlpha: 0.18
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
    var corner = radius * 0.26;
    g.lineStyle(width || 2, PALETTE.trim, alpha);
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

  function buildCorridor(targetX, targetY, angle, halfWidth, worldW, worldH) {
    var dirX = Math.cos(angle);
    var dirY = Math.sin(angle);
    var diag = Math.hypot(worldW || 0, worldH || 0) + 400;
    var geom = Common && typeof Common.buildMeteorCorridor === "function"
      ? Common.buildMeteorCorridor(targetX, targetY, dirX, dirY, halfWidth, diag)
      : null;
    if (!geom) {
      var nx = -dirY * halfWidth;
      var ny = dirX * halfWidth;
      var sx = targetX - dirX * diag;
      var sy = targetY - dirY * diag;
      var ex = targetX + dirX * diag;
      var ey = targetY + dirY * diag;
      geom = {
        startX: sx,
        startY: sy,
        endX: ex,
        endY: ey,
        nx: nx,
        ny: ny,
        points: [
          { x: sx + nx, y: sy + ny },
          { x: ex + nx, y: ey + ny },
          { x: ex - nx, y: ey - ny },
          { x: sx - nx, y: sy - ny }
        ]
      };
    }
    geom.dirX = dirX;
    geom.dirY = dirY;
    geom.cosA = dirX;
    geom.sinA = dirY;
    return geom;
  }

  function drawArcStroke(g, x, y, radius, startAngle, endAngle, color, alpha, width) {
    var steps = 14;
    g.lineStyle(width || 1, color, alpha == null ? 1 : alpha);
    for (var i = 0; i < steps; i++) {
      var t0 = i / steps;
      var t1 = (i + 1) / steps;
      var a0 = lerp(startAngle, endAngle, t0);
      var a1 = lerp(startAngle, endAngle, t1);
      var sx = x + Math.cos(a0) * radius;
      var sy = y + Math.sin(a0) * radius;
      var ex = x + Math.cos(a1) * radius;
      var ey = y + Math.sin(a1) * radius;
      g.moveTo(sx, sy);
      g.lineTo(ex, ey);
    }
  }

  function drawCorridor(g, targetX, targetY, angle, halfWidth, detail, timeSec, worldW, worldH, strong) {
    var geom = buildCorridor(targetX, targetY, angle, halfWidth, worldW, worldH);
    var fillAlpha = (strong ? Math.max(detail.corridorFillAlpha, 0.18) : detail.corridorFillAlpha) * 0.78;
    var edgeAlpha = strong ? Math.max(detail.corridorEdgeAlpha, 0.78) : detail.corridorEdgeAlpha;
    var centerAlpha = strong ? Math.max(detail.centerLineAlpha, 0.50) : detail.centerLineAlpha;

    g.beginFill(PALETTE.line, fillAlpha);
    g.moveTo(geom.points[0].x, geom.points[0].y);
    g.lineTo(geom.points[1].x, geom.points[1].y);
    g.lineTo(geom.points[2].x, geom.points[2].y);
    g.lineTo(geom.points[3].x, geom.points[3].y);
    g.closePath();
    g.endFill();

    g.lineStyle(strong ? 3.75 : 2.0, PALETTE.trim, edgeAlpha);
    g.moveTo(geom.points[0].x, geom.points[0].y);
    g.lineTo(geom.points[1].x, geom.points[1].y);
    g.moveTo(geom.points[3].x, geom.points[3].y);
    g.lineTo(geom.points[2].x, geom.points[2].y);

    g.lineStyle(strong ? 2.75 : 1.4, PALETTE.core, centerAlpha * 0.86);
    g.moveTo(geom.startX, geom.startY);
    g.lineTo(geom.endX, geom.endY);

    g.lineStyle(1.0, PALETTE.dark, centerAlpha * 0.40);
    g.moveTo(geom.startX + geom.nx * 0.22, geom.startY + geom.ny * 0.22);
    g.lineTo(geom.endX + geom.nx * 0.22, geom.endY + geom.ny * 0.22);
    g.moveTo(geom.startX - geom.nx * 0.22, geom.startY - geom.ny * 0.22);
    g.lineTo(geom.endX - geom.nx * 0.22, geom.endY - geom.ny * 0.22);

    for (var i = 0; i < detail.telemetrySteps; i++) {
      var frac = (i + 1) / (detail.telemetrySteps + 1);
      var px = lerp(geom.startX, targetX, frac);
      var py = lerp(geom.startY, targetY, frac);
      var pulse = 0.16 + 0.05 * Math.sin((timeSec || 0) * 3.4 + i * 0.8);
      drawTelemetryBrackets(g, px, py, 10 + i * 3, pulse + (strong ? 0.08 : 0), 1.3);
    }
    return geom;
  }

  function drawMeteorSparkField(g, x, y, angle, count, spread, distance, alpha, timeSec) {
    for (var i = 0; i < count; i++) {
      var t = count <= 1 ? 0.5 : i / (count - 1);
      var localAng = angle + (t - 0.5) * spread + Math.sin((timeSec || 0) * 1.4 + i * 1.7) * 0.05;
      var len = 8 + (i % 3) * 4;
      var sx = x - Math.cos(localAng) * distance * (0.68 + t * 0.38);
      var sy = y - Math.sin(localAng) * distance * (0.68 + t * 0.38);
      var ex = sx - Math.cos(localAng) * len;
      var ey = sy - Math.sin(localAng) * len;
      g.lineStyle(1 + (i % 2) * 0.5, PALETTE.line, alpha * (0.35 + (i % 4) * 0.08));
      g.moveTo(sx, sy);
      g.lineTo(ex, ey);
    }
  }

  function drawMeteorFlightAura(g, x, y, angle, scale, style, alpha, count, timeSec) {
    var dirX = Math.cos(angle);
    var dirY = Math.sin(angle);
    var nx = -dirY;
    var ny = dirX;
    var haloR = scale * (3.1 + style.tailWidth * 0.85);
    g.beginFill(PALETTE.trim, 0.10 * alpha);
    g.drawCircle(x, y, haloR);
    g.endFill();
    g.beginFill(PALETTE.core, 0.07 * alpha);
    g.drawCircle(x, y, haloR * 0.62);
    g.endFill();

    for (var i = 0; i < count; i++) {
      var t = count <= 1 ? 0.5 : i / (count - 1);
      var wave = (timeSec || 0) * (1.8 + style.tailLen * 0.35) + i * 1.37;
      var along = 12 + t * (28 + scale * 1.6);
      var side = Math.sin(wave) * (4 + style.tailWidth * 4) + (t - 0.5) * 12;
      var px = x - dirX * along + nx * side;
      var py = y - dirY * along + ny * side;
      var len = 6 + (i % 3) * 3;
      g.lineStyle(1 + (i % 2) * 0.45, PALETTE.line, alpha * (0.16 + (i % 4) * 0.05));
      g.moveTo(px, py);
      g.lineTo(px - dirX * len + nx * Math.sin(wave * 1.4) * 2.2, py - dirY * len + ny * Math.sin(wave * 1.4) * 2.2);
      if (i % 2 === 0) {
        g.beginFill(PALETTE.trim, alpha * 0.22);
        g.drawCircle(px + nx * 1.4, py + ny * 1.4, 1.2 + (i % 3) * 0.28);
        g.endFill();
      }
    }
  }

  function drawMeteorBody(g, x, y, angle, scale, style, alpha) {
    var dirX = Math.cos(angle);
    var dirY = Math.sin(angle);
    var nx = -dirY;
    var ny = dirX;
    var tailLen = 34 * style.tailLen * scale;
    var tailW = 4.4 * style.tailWidth * scale;

    for (var layer = 0; layer < 3; layer++) {
      var layerFrac = layer / 2;
      var layerLen = tailLen * (1 - layerFrac * 0.18);
      var layerW = tailW * (1 - layerFrac * 0.14);
      g.beginFill(PALETTE.line, (0.16 - layerFrac * 0.03) * alpha);
      g.moveTo(x + dirX * 6.5 * scale, y + dirY * 6.5 * scale);
      g.lineTo(x - dirX * 3.8 * scale - nx * layerW, y - dirY * 3.8 * scale - ny * layerW);
      g.lineTo(x - dirX * layerLen - nx * layerW * 0.28, y - dirY * layerLen - ny * layerW * 0.28);
      g.lineTo(x - dirX * layerLen * 0.56, y - dirY * layerLen * 0.56);
      g.lineTo(x - dirX * layerLen + nx * layerW * 0.28, y - dirY * layerLen + ny * layerW * 0.28);
      g.lineTo(x - dirX * 3.8 * scale + nx * layerW, y - dirY * 3.8 * scale + ny * layerW);
      g.closePath();
      g.endFill();
    }

    for (var i = 0; i < style.striationCount; i++) {
      var frac = (i + 1) / (style.striationCount + 1);
      var offs = (frac - 0.5) * tailW * 1.55;
      g.lineStyle(0.36 + frac * 0.12, PALETTE.trim, alpha * 0.08 * (1 - Math.abs(frac - 0.5) * 1.2));
      g.moveTo(x - dirX * tailLen * 0.88 + nx * offs, y - dirY * tailLen * 0.88 + ny * offs);
      g.lineTo(x - dirX * 5 * scale + nx * offs * 0.42, y - dirY * 5 * scale + ny * offs * 0.42);
    }

    g.beginFill(PALETTE.core, 0.90 * alpha);
    g.moveTo(x + dirX * 6.6 * scale, y + dirY * 6.6 * scale);
    g.lineTo(x + dirX * 3.2 * scale - nx * 2.5 * style.coreTall * scale, y + dirY * 3.2 * scale - ny * 2.5 * style.coreTall * scale);
    g.lineTo(x - dirX * 0.8 * scale - nx * 3.5 * scale, y - dirY * 0.8 * scale - ny * 3.5 * scale);
    g.lineTo(x - dirX * 4.8 * scale - nx * 2.1 * scale, y - dirY * 4.8 * scale - ny * 2.1 * scale);
    g.lineTo(x - dirX * 7.0 * scale - nx * 0.2 * scale, y - dirY * 7.0 * scale - ny * 0.2 * scale);
    g.lineTo(x - dirX * 6.1 * scale + nx * 2.0 * scale, y - dirY * 6.1 * scale + ny * 2.0 * scale);
    g.lineTo(x - dirX * 1.6 * scale + nx * 3.6 * scale, y - dirY * 1.6 * scale + ny * 3.6 * scale);
    g.lineTo(x + dirX * 2.8 * scale + nx * 2.5 * style.coreTall * scale, y + dirY * 2.8 * scale + ny * 2.5 * style.coreTall * scale);
    g.closePath();
    g.endFill();

    g.lineStyle(0.5, PALETTE.trim, 0.56 * alpha);
    g.beginFill(PALETTE.trim, 0.88 * alpha);
    g.drawCircle(x + dirX * 2.1 * scale, y + dirY * 2.1 * scale, 1.55 * scale);
    g.endFill();

    g.beginFill(PALETTE.core, 0.18 * alpha);
    g.moveTo(x + dirX * 3.8 * scale + nx * 0.2 * scale, y + dirY * 3.8 * scale + ny * 0.2 * scale);
    g.lineTo(x + dirX * 0.6 * scale - nx * 1.6 * scale, y + dirY * 0.6 * scale - ny * 1.6 * scale);
    g.lineTo(x - dirX * 2.7 * scale - nx * 1.0 * scale, y - dirY * 2.7 * scale - ny * 1.0 * scale);
    g.lineTo(x - dirX * 3.5 * scale + nx * 0.8 * scale, y - dirY * 3.5 * scale + ny * 0.8 * scale);
    g.lineTo(x - dirX * 0.4 * scale + nx * 1.9 * scale, y - dirY * 0.4 * scale + ny * 1.9 * scale);
    g.closePath();
    g.endFill();

    drawArcStroke(g, x - dirX * 0.8 * scale, y - dirY * 0.8 * scale, 5.6 * scale, angle - 0.7, angle + 0.7, PALETTE.trim, 0.24 * alpha, 0.34);
  }

  function renderMeteor(meteor, opts) {
    if (!meteor || !opts || !opts.layer) return;
    var timeSec = opts.timeSec || 0;
    var level = getZoomLevel(opts.zoom || 0.22);
    var detail = getMeteorDetail(level);
    var style = getSignalBloomMeteorStyle(level);
    var angle = meteor.angle != null ? meteor.angle : Math.atan2(meteor.vy || 0, meteor.vx || 1);
    var halfWidth = meteor.aoeR || 30;
    var traj = ensureGraphicRef(meteor, "trajGfx", opts.layer);
    var body = ensureGraphicRef(meteor, "gfx", opts.layer);
    if (!traj || !body) return;
    traj.clear();
    body.clear();
    drawCorridor(traj, meteor.x, meteor.y, angle, halfWidth, detail, timeSec, opts.worldW, opts.worldH, false);

    var alpha = 1;
    var meteorScale = (meteor.visualScale || 1.0) * 8.8;
    drawMeteorFlightAura(body, meteor.x, meteor.y, angle, meteorScale, style, alpha, detail.flightFxCount, timeSec);
    drawMeteorSparkField(body, meteor.x, meteor.y, angle, detail.sparkCount + 4, 1.05, 34 * style.tailLen * meteorScale, 0.40 * alpha, timeSec);
    drawMeteorBody(body, meteor.x, meteor.y, angle, meteorScale, style, alpha);
  }

  function renderMeteorImpact(fx, opts) {
    if (!fx || !opts || !opts.layer) return;
    var gfx = ensureGraphicRef(fx, "gfx", opts.layer);
    if (!gfx) return;
    var level = getZoomLevel(opts.zoom || 0.22);
    var detail = getMeteorDetail(level);
    var elapsed = Math.max(0, (opts.simTimeSec || 0) - (fx.t0 || 0));
    var duration = Math.max(0.001, fx.duration || 1.5);
    var f = elapsed / duration;
    if (f >= 1) {
      gfx.clear();
      return;
    }
    var hitFade = 1 - smoothstep(0, duration, elapsed);
    var hitExpand = smoothstep(0, duration, elapsed);
    var radius = fx.radius || 30;
    var earlyFlash = 1 - smoothstep(0, duration * 0.26, elapsed);
    var flashR = radius * (0.94 + hitExpand * 1.36);
    gfx.clear();

    gfx.beginFill(0xffffff, 0.52 * earlyFlash);
    gfx.drawCircle(fx.x, fx.y, radius * (0.56 + hitExpand * 0.34));
    gfx.endFill();
    gfx.beginFill(PALETTE.trim, 0.56 * hitFade);
    gfx.drawCircle(fx.x, fx.y, flashR);
    gfx.endFill();
    gfx.beginFill(PALETTE.core, 0.34 * hitFade);
    gfx.drawCircle(fx.x, fx.y, flashR * 0.72);
    gfx.endFill();
    gfx.beginFill(PALETTE.line, 0.22 * hitFade);
    gfx.drawCircle(fx.x, fx.y, flashR * 1.12);
    gfx.endFill();
    gfx.beginFill(PALETTE.dark, 0.16 * hitFade);
    gfx.drawCircle(fx.x, fx.y, flashR * 1.34);
    gfx.endFill();

    for (var ring = 0; ring < detail.ringCount; ring++) {
      var frac = detail.ringCount <= 1 ? 0 : ring / (detail.ringCount - 1);
      var ringR = flashR * (0.92 + frac * 0.88);
      var ringAlpha = Math.max(0, hitFade * (0.48 - frac * 0.08));
      gfx.lineStyle(Math.max(1.2, 5.4 - frac * 1.2), ring % 2 === 0 ? PALETTE.trim : PALETTE.core, ringAlpha);
      gfx.drawCircle(fx.x, fx.y, ringR);
    }

    for (var spike = 0; spike < 10; spike++) {
      var spikeAng = (fx.angle || 0) + spike * (TAU / 10) + hitExpand * 0.22;
      var spikeLen = radius * (0.62 + (spike % 3) * 0.18 + hitExpand * 0.72);
      var sx = fx.x + Math.cos(spikeAng) * radius * 0.14;
      var sy = fx.y + Math.sin(spikeAng) * radius * 0.14;
      var ex = fx.x + Math.cos(spikeAng) * spikeLen;
      var ey = fx.y + Math.sin(spikeAng) * spikeLen;
      gfx.lineStyle(1.8 + (spike % 2) * 0.7, spike % 2 === 0 ? PALETTE.trim : PALETTE.line, hitFade * 0.32);
      gfx.moveTo(sx, sy);
      gfx.lineTo(ex, ey);
    }

    drawTelemetryBrackets(gfx, fx.x, fx.y, flashR * 0.84, 0.44 * hitFade, 2.2);
    drawTelemetryBrackets(gfx, fx.x, fx.y, flashR * 1.12, 0.24 * hitFade, 1.4);

    for (var i = 0; i < detail.debrisCount; i++) {
      var seed = (fx.seed || 1) + i * 17.13;
      var ang = (fx.angle || 0) + (i / Math.max(1, detail.debrisCount - 1) - 0.5) * 2.1;
      var dist = radius * (0.24 + hash01(seed + 1) * 0.60) * (0.4 + hitExpand * 1.1);
      var len = 6 + hash01(seed + 2) * 10;
      var px = fx.x + Math.cos(ang) * dist;
      var py = fx.y + Math.sin(ang) * dist;
      var ex = px + Math.cos(ang) * len;
      var ey = py + Math.sin(ang) * len;
      var alpha = hitFade * (0.20 + hash01(seed + 3) * 0.18);
      gfx.lineStyle(1.1 + hash01(seed + 4) * 1.0, i % 2 === 0 ? PALETTE.trim : PALETTE.line, alpha);
      gfx.moveTo(px, py);
      gfx.lineTo(ex, ey);
    }
  }

  function drawMeteorPreview(g, preview, opts) {
    if (!g || !preview) return;
    var timeSec = opts && opts.timeSec ? opts.timeSec : 0;
    var level = getZoomLevel(opts && opts.zoom != null ? opts.zoom : 0.22);
    var detail = getMeteorDetail(level);
    if (preview.phase === "point") {
      g.beginFill(PALETTE.line, 0.12);
      g.drawCircle(preview.mouseX, preview.mouseY, preview.aoeRadius);
      g.endFill();
      g.lineStyle(4.25, PALETTE.trim, 0.92);
      g.drawCircle(preview.mouseX, preview.mouseY, preview.aoeRadius);
      g.lineStyle(2.5, PALETTE.core, 0.52);
      g.drawCircle(preview.mouseX, preview.mouseY, preview.aoeRadius * 0.72);
      g.lineStyle(1.8, PALETTE.line, 0.24);
      g.drawCircle(preview.mouseX, preview.mouseY, preview.aoeRadius * 0.88);
      drawTelemetryBrackets(g, preview.mouseX, preview.mouseY, preview.aoeRadius * 0.64, 0.28, 1.4);
      return;
    }

    var geom = drawCorridor(g, preview.x, preview.y, preview.angle, preview.aoeRadius, detail, timeSec, preview.worldW, preview.worldH, true);
    var impactX = preview.impactX != null ? preview.impactX : preview.x;
    var impactY = preview.impactY != null ? preview.impactY : preview.y;
    g.beginFill(PALETTE.line, 0.12);
    g.drawCircle(impactX, impactY, preview.aoeRadius);
    g.endFill();
    g.lineStyle(4.0, PALETTE.trim, 0.90);
    g.drawCircle(impactX, impactY, preview.aoeRadius);
    g.lineStyle(2.5, PALETTE.core, 0.52);
    g.drawCircle(impactX, impactY, preview.aoeRadius * 0.72);
    g.lineStyle(1.8, PALETTE.line, 0.24);
    g.drawCircle(impactX, impactY, preview.aoeRadius * 0.88);
    g.beginFill(PALETTE.trim, 0.86);
    g.drawCircle(impactX, impactY, 7);
    g.endFill();
    if (preview.predictedTargetRadius && preview.predictedTargetX != null && preview.predictedTargetY != null) {
      g.lineStyle(2.75, PALETTE.trim, 0.70);
      g.drawCircle(preview.predictedTargetX, preview.predictedTargetY, preview.predictedTargetRadius);
    }
    return geom;
  }

  function drawOrbitalPreview(g, preview, opts) {
    if (!g || !preview) return;
    var timeSec = opts && opts.timeSec ? opts.timeSec : 0;
    var pulse = 0.5 + 0.5 * Math.sin(timeSec * 1.4);
    var radius = preview.radius;
    g.lineStyle(4.8, PALETTE.trim, 0.54 + pulse * 0.20);
    g.drawCircle(preview.x, preview.y, radius);
    g.lineStyle(2.6, PALETTE.core, 0.28 + pulse * 0.12);
    g.drawCircle(preview.x, preview.y, radius * 0.82);
    g.lineStyle(1.4, PALETTE.line, 0.16 + pulse * 0.07);
    g.drawCircle(preview.x, preview.y, radius * 0.62);
    drawTelemetryBrackets(g, preview.x, preview.y, radius * 0.84, 0.34 + pulse * 0.08, 2.1);
    drawArcStroke(g, preview.x, preview.y, radius * 1.03, timeSec * 0.9, timeSec * 0.9 + 0.85, PALETTE.trim, 0.34 + pulse * 0.08, 2.4);
    drawArcStroke(g, preview.x, preview.y, radius * 0.78, -timeSec * 0.7, -timeSec * 0.7 + 0.68, PALETTE.core, 0.24 + pulse * 0.08, 1.8);
    for (var i = 0; i < (preview.shots || []).length; i++) {
      var shot = preview.shots[i];
      g.lineStyle(shot.primary ? 1.8 : 1.3, shot.primary ? PALETTE.trim : PALETTE.core, 0.44 + pulse * 0.10);
      g.drawCircle(shot.tx, shot.ty, shot.radius);
      g.lineStyle(shot.primary ? 1.2 : 0.95, PALETTE.trim, 0.26 + pulse * 0.06);
      g.drawCircle(shot.tx, shot.ty, shot.radius * 0.72);
      drawTelemetryBrackets(g, shot.tx, shot.ty, shot.radius * 0.52, 0.14 + pulse * 0.04, 0.85);
    }
  }

  function renderOrbitalStrike(strike, opts) {
    if (!strike || !opts || !opts.layer) return;
    var gfx = ensureGraphicRef(strike, "gfx", opts.layer);
    if (!gfx) return;
    var timeSec = opts.simTimeSec || 0;
    var level = getZoomLevel(opts.zoom || 0.22);
    var style = getOrbitalStyle(level);
    var elapsed = Math.max(0, timeSec - (strike.spawnedAt || 0));
    gfx.clear();

    var shots = strike.shots || [];
    for (var i = 0; i < shots.length; i++) {
      var shot = shots[i];
      if (elapsed >= shot.launchAt && elapsed <= shot.arriveAt) {
        var travel = (elapsed - shot.launchAt) / Math.max(0.001, shot.arriveAt - shot.launchAt);
        var px = lerp(shot.sx, shot.tx, travel);
        var py = lerp(shot.sy, shot.ty, travel);
        var angle = Math.atan2(shot.ty - shot.sy, shot.tx - shot.sx);
        var dirX = Math.cos(angle);
        var dirY = Math.sin(angle);
        var nx = -dirY;
        var ny = dirX;
        var tailX = lerp(shot.sx, shot.tx, Math.max(0, travel - 0.18));
        var tailY = lerp(shot.sy, shot.ty, Math.max(0, travel - 0.18));
        var headRadius = style.headRadius * (shot.primary ? 1.45 : 1.20);
        gfx.lineStyle(style.beamWidth * 3.2, PALETTE.line, Math.max(style.beamAlpha * 0.90, 0.22));
        gfx.moveTo(tailX, tailY);
        gfx.lineTo(px, py);
        gfx.lineStyle(style.beamWidth * 1.8, PALETTE.core, Math.max(style.trimAlpha * 0.82, 0.30));
        gfx.moveTo(tailX, tailY);
        gfx.lineTo(px, py);
        gfx.lineStyle(style.beamWidth, PALETTE.trim, Math.max(style.trimAlpha, 0.48));
        gfx.moveTo(tailX, tailY);
        gfx.lineTo(px, py);
        gfx.lineStyle(1.4, PALETTE.trim, 0.26);
        gfx.moveTo(tailX + nx * 3, tailY + ny * 3);
        gfx.lineTo(px + nx * 2, py + ny * 2);
        gfx.moveTo(tailX - nx * 3, tailY - ny * 3);
        gfx.lineTo(px - nx * 2, py - ny * 2);
        drawMeteorSparkField(gfx, px, py, angle, style.sparkCount + 2, 0.72, 26, 0.34, timeSec);
        gfx.beginFill(PALETTE.line, 0.16);
        gfx.drawCircle(px, py, headRadius * 2.4);
        gfx.endFill();
        gfx.beginFill(PALETTE.core, 0.34);
        gfx.drawCircle(px, py, headRadius * 1.55);
        gfx.endFill();
        gfx.beginFill(PALETTE.core, 0.88);
        gfx.drawCircle(px, py, headRadius);
        gfx.endFill();
        gfx.beginFill(PALETTE.trim, 0.98);
        gfx.drawCircle(px, py, headRadius * 0.46);
        gfx.endFill();
      }

      if (shot.impactAt != null && elapsed >= shot.impactAt) {
        var impactAge = elapsed - shot.impactAt;
        if (impactAge <= shot.fadeDuration) {
          var hitFade = 1 - smoothstep(0, shot.fadeDuration, impactAge);
          var hitExpand = smoothstep(0, shot.fadeDuration, impactAge);
          var flashR = shot.radius * (0.36 + hitExpand * 0.84);
          var outerRadius = shot.radius * (1.0 + hitExpand * 0.18);
          gfx.lineStyle(1.8, shot.primary ? PALETTE.trim : PALETTE.core, 0.36 * hitFade);
          gfx.drawCircle(shot.tx, shot.ty, outerRadius);
          gfx.lineStyle(1.1, PALETTE.line, 0.22 * hitFade);
          gfx.drawCircle(shot.tx, shot.ty, outerRadius * 0.74);
          drawArcStroke(gfx, shot.tx, shot.ty, outerRadius * 0.90, impactAge * 1.6, impactAge * 1.6 + 1.15, PALETTE.trim, 0.24 * hitFade, 1.3);
          drawArcStroke(gfx, shot.tx, shot.ty, outerRadius * 0.66, -impactAge * 1.2, -impactAge * 1.2 + 0.82, PALETTE.core, 0.18 * hitFade, 1.0);
          drawTelemetryBrackets(gfx, shot.tx, shot.ty, outerRadius * 0.78, 0.18 * hitFade, 1.0);
          gfx.lineStyle(1.1, PALETTE.trim, 0.20 * hitFade);
          gfx.drawCircle(shot.tx, shot.ty, flashR * 0.74);
          gfx.lineStyle(0.8, PALETTE.core, 0.12 * hitFade);
          gfx.drawCircle(shot.tx, shot.ty, flashR * 1.04);
          gfx.lineStyle(1.6, 0xffffff, 0.12 * hitFade);
          gfx.drawCircle(shot.tx, shot.ty, flashR * 0.34);
          gfx.lineStyle(2.2 * style.shockWidth, PALETTE.trim, (style.ringAlpha + 0.16) * hitFade);
          gfx.drawCircle(shot.tx, shot.ty, flashR * 0.82);
          gfx.lineStyle(1.4 * style.shockWidth, PALETTE.core, 0.18 * hitFade);
          gfx.drawCircle(shot.tx, shot.ty, flashR * 1.08);
        }
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

  function destroyOrbitalStrike(strike) {
    destroyGraphicRef(strike, "gfx");
  }

  var api = {
    renderMeteor: renderMeteor,
    renderMeteorImpact: renderMeteorImpact,
    drawMeteorPreview: drawMeteorPreview,
    renderOrbitalStrike: renderOrbitalStrike,
    drawOrbitalPreview: drawOrbitalPreview,
    destroyMeteor: destroyMeteor,
    destroyImpact: destroyImpact,
    destroyOrbitalStrike: destroyOrbitalStrike
  };

  if (typeof window !== "undefined") window.MeteorStrikeRenderer = api;
  if (typeof module !== "undefined") module.exports = api;
})();
