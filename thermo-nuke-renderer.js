(function () {
  "use strict";

  var Common = (typeof window !== "undefined" && window.AbilityVfxCommon) ? window.AbilityVfxCommon : null;
  var LODRef = (typeof window !== "undefined" && window.LOD) ? window.LOD : null;
  var TAU = Math.PI * 2;
  var PALETTE = {
    trim: 0xf6fbff,
    core: 0xd6efff,
    line: 0x98ceff,
    shock: 0x5fa9ff,
    ember: 0xffa34a,
    emberHot: 0xff7a24,
    emberWhite: 0xffe3b7,
    hull: 0x1c3249,
    dark: 0x07101b,
    void: 0x02060a
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
        trailLen: 96,
        dash: 24,
        gap: 17,
        ringCount: 2,
        spikeCount: 8,
        debrisCount: 8,
        emberCount: 8
      };
    }
    if (level === "mid") {
      return {
        trailLen: 126,
        dash: 20,
        gap: 14,
        ringCount: 3,
        spikeCount: 10,
        debrisCount: 12,
        emberCount: 12
      };
    }
    return {
      trailLen: 154,
      dash: 16,
      gap: 10,
      ringCount: 4,
      spikeCount: 12,
      debrisCount: 16,
      emberCount: 18
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

  function drawArcPolyline(g, x, y, radius, startAngle, endAngle, width, color, alpha, steps) {
    var count = Math.max(3, steps || 8);
    g.lineStyle(width, color, alpha);
    for (var i = 0; i < count; i++) {
      var t0 = i / count;
      var t1 = (i + 1) / count;
      var a0 = lerp(startAngle, endAngle, t0);
      var a1 = lerp(startAngle, endAngle, t1);
      var x0 = x + Math.cos(a0) * radius;
      var y0 = y + Math.sin(a0) * radius;
      var x1 = x + Math.cos(a1) * radius;
      var y1 = y + Math.sin(a1) * radius;
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
    }
  }

  function drawDashedCircle(g, x, y, radius, width, color, alpha, dashCount, gapFrac, spin) {
    var count = Math.max(8, dashCount || 18);
    var gap = clamp01(gapFrac != null ? gapFrac : 0.34);
    var step = TAU / count;
    var offset = spin || 0;
    for (var i = 0; i < count; i++) {
      var start = offset + i * step;
      var end = start + step * (1 - gap);
      drawArcPolyline(g, x, y, radius, start, end, width, color, alpha, 4);
    }
  }

  function drawDashedLine(g, x1, y1, x2, y2, dashLen, gapLen, width, color, alpha, offset) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var len = Math.hypot(dx, dy);
    if (len <= 0.001) return;
    var nx = dx / len;
    var ny = dy / len;
    var period = Math.max(1, dashLen + gapLen);
    var start = offset != null ? offset % period : 0;
    if (start < 0) start += period;
    var pos = -start;
    while (pos < len) {
      var segStart = Math.max(0, pos);
      var segEnd = Math.min(len, pos + dashLen);
      if (segEnd > segStart) {
        g.lineStyle(width, color, alpha);
        g.moveTo(x1 + nx * segStart, y1 + ny * segStart);
        g.lineTo(x1 + nx * segEnd, y1 + ny * segEnd);
      }
      pos += period;
    }
  }

  function drawPassedTrail(g, x1, y1, x2, y2, width, baseAlpha) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var len = Math.hypot(dx, dy);
    if (len <= 0.001) return;
    var dirX = dx / len;
    var dirY = dy / len;
    var dashLen = 12;
    var gapLen = 7;
    var step = dashLen + gapLen;
    var pos = 0;
    while (pos < len) {
      var segStart = pos;
      var segEnd = Math.min(len, pos + dashLen);
      var segMid = (segStart + segEnd) * 0.5;
      var frac = segEnd / Math.max(1, len);
      var color = frac > 0.86 ? PALETTE.emberHot : (frac > 0.66 ? PALETTE.ember : (frac > 0.38 ? PALETTE.trim : PALETTE.line));
      var alpha = (baseAlpha || 0.3) * (0.55 + frac * 0.95);
      var segWidth = width * (0.82 + frac * 0.30);
      g.lineStyle(segWidth + 1.6, PALETTE.dark, alpha * 0.18);
      g.moveTo(x1 + dirX * segStart, y1 + dirY * segStart);
      g.lineTo(x1 + dirX * segEnd, y1 + dirY * segEnd);
      g.lineStyle(segWidth, color, alpha);
      g.moveTo(x1 + dirX * segStart, y1 + dirY * segStart);
      g.lineTo(x1 + dirX * segEnd, y1 + dirY * segEnd);
      g.beginFill(color, Math.min(1, alpha * 0.9));
      g.drawCircle(x1 + dirX * segMid, y1 + dirY * segMid, Math.max(1.8, segWidth * 0.34));
      g.endFill();
      pos += step;
    }
  }

  function drawFilledSector(g, x, y, innerR, outerR, startAngle, endAngle, color, alpha) {
    var steps = 8;
    g.beginFill(color, alpha);
    for (var i = 0; i <= steps; i++) {
      var outerT = i / steps;
      var outerA = lerp(startAngle, endAngle, outerT);
      var ox = x + Math.cos(outerA) * outerR;
      var oy = y + Math.sin(outerA) * outerR;
      if (i === 0) g.moveTo(ox, oy);
      else g.lineTo(ox, oy);
    }
    for (var j = steps; j >= 0; j--) {
      var innerT = j / steps;
      var innerA = lerp(startAngle, endAngle, innerT);
      g.lineTo(x + Math.cos(innerA) * innerR, y + Math.sin(innerA) * innerR);
    }
    g.closePath();
    g.endFill();
  }

  function drawRadiationPreview(g, x, y, radius, alpha, timeSec, originX, originY) {
    var pulse = 0.5 + 0.5 * Math.sin((timeSec || 0) * 2.0);
    var spin = (timeSec || 0) * 0.18;
    var outerR = radius;
    var midR = radius * 0.78;
    var bladeInner = radius * 0.20;
    var bladeOuter = radius * 0.62;
    var hubR = radius * 0.12;

    g.beginFill(PALETTE.void, 0.08 * alpha);
    g.drawCircle(x, y, outerR * 1.02);
    g.endFill();
    g.beginFill(PALETTE.shock, (0.05 + pulse * 0.02) * alpha);
    g.drawCircle(x, y, midR);
    g.endFill();

    drawDashedCircle(g, x, y, outerR, 2.8, PALETTE.trim, (0.24 + pulse * 0.10) * alpha, 24, 0.42, spin);
    drawDashedCircle(g, x, y, midR, 1.6, PALETTE.line, (0.18 + pulse * 0.08) * alpha, 18, 0.36, -spin * 1.2);

    for (var i = 0; i < 3; i++) {
      var ang = spin + (i / 3) * TAU - Math.PI / 2;
      drawFilledSector(g, x, y, bladeInner, bladeOuter, ang - 0.38, ang + 0.38, PALETTE.core, 0.16 * alpha);
      drawArcPolyline(g, x, y, bladeOuter, ang - 0.28, ang + 0.28, 1.6, PALETTE.trim, 0.42 * alpha, 5);
    }

    g.beginFill(PALETTE.trim, 0.78 * alpha);
    g.drawCircle(x, y, hubR);
    g.endFill();
    g.beginFill(PALETTE.core, 0.38 * alpha);
    g.drawCircle(x, y, hubR * 2.0);
    g.endFill();

    if (originX != null && originY != null) {
      drawDashedLine(g, originX, originY, x, y, 14, 10, 1.6, PALETTE.line, 0.18 * alpha, (timeSec || 0) * 42);
    }
  }

  function drawRocketBody(g, x, y, angle, scale, alpha) {
    var dirX = Math.cos(angle);
    var dirY = Math.sin(angle);
    var nx = -dirY;
    var ny = dirX;
    var noseLen = 18 * scale;
    var bodyLen = 30 * scale;
    var bodyHalf = 6.4 * scale;
    var finBack = 10 * scale;
    var finSpan = 9 * scale;

    g.beginFill(PALETTE.hull, 0.96 * alpha);
    g.moveTo(x + dirX * noseLen, y + dirY * noseLen);
    g.lineTo(x - dirX * bodyLen + nx * bodyHalf, y - dirY * bodyLen + ny * bodyHalf);
    g.lineTo(x - dirX * bodyLen - nx * bodyHalf, y - dirY * bodyLen - ny * bodyHalf);
    g.closePath();
    g.endFill();

    g.beginFill(PALETTE.trim, 0.88 * alpha);
    g.moveTo(x + dirX * noseLen, y + dirY * noseLen);
    g.lineTo(x - dirX * 6 * scale + nx * bodyHalf * 0.64, y - dirY * 6 * scale + ny * bodyHalf * 0.64);
    g.lineTo(x - dirX * 6 * scale - nx * bodyHalf * 0.64, y - dirY * 6 * scale - ny * bodyHalf * 0.64);
    g.closePath();
    g.endFill();

    g.beginFill(PALETTE.shock, 0.52 * alpha);
    g.drawCircle(x - dirX * 2.0 * scale, y - dirY * 2.0 * scale, 3.0 * scale);
    g.endFill();

    g.lineStyle(Math.max(1.0, 1.3 * scale), PALETTE.line, 0.42 * alpha);
    g.moveTo(x - dirX * bodyLen * 0.84, y - dirY * bodyLen * 0.84);
    g.lineTo(x + dirX * noseLen * 0.76, y + dirY * noseLen * 0.76);

    g.beginFill(PALETTE.hull, 0.82 * alpha);
    g.moveTo(x - dirX * finBack + nx * bodyHalf * 0.92, y - dirY * finBack + ny * bodyHalf * 0.92);
    g.lineTo(x - dirX * (bodyLen + 3 * scale) + nx * finSpan, y - dirY * (bodyLen + 3 * scale) + ny * finSpan);
    g.lineTo(x - dirX * (bodyLen - 1 * scale), y - dirY * (bodyLen - 1 * scale));
    g.closePath();
    g.endFill();
    g.beginFill(PALETTE.hull, 0.82 * alpha);
    g.moveTo(x - dirX * finBack - nx * bodyHalf * 0.92, y - dirY * finBack - ny * bodyHalf * 0.92);
    g.lineTo(x - dirX * (bodyLen + 3 * scale) - nx * finSpan, y - dirY * (bodyLen + 3 * scale) - ny * finSpan);
    g.lineTo(x - dirX * (bodyLen - 1 * scale), y - dirY * (bodyLen - 1 * scale));
    g.closePath();
    g.endFill();
  }

  function drawImpactBurst(g, strike, elapsed, fade, expand, detail) {
    var x = strike.targetX;
    var y = strike.targetY;
    var radius = Math.max(80, strike.impactRadius || 500);
    var flashR = radius * (0.34 + expand * 0.84);
    var coreR = radius * (0.12 + expand * 0.12);
    var seed = strike.seed || 1;

    g.beginFill(PALETTE.trim, 0.42 * fade);
    g.drawCircle(x, y, coreR * 1.2);
    g.endFill();
    g.beginFill(PALETTE.core, 0.24 * fade);
    g.drawCircle(x, y, flashR * 0.86);
    g.endFill();
    g.beginFill(PALETTE.shock, 0.14 * fade);
    g.drawCircle(x, y, flashR * 1.12);
    g.endFill();
    g.beginFill(PALETTE.emberWhite, 0.16 * fade);
    g.drawCircle(x, y, flashR * 0.42);
    g.endFill();
    g.beginFill(PALETTE.ember, 0.20 * fade);
    g.drawCircle(x, y, flashR * 0.56);
    g.endFill();
    g.beginFill(PALETTE.emberHot, 0.14 * fade);
    g.drawCircle(x, y, flashR * 0.72);
    g.endFill();
    g.beginFill(PALETTE.dark, 0.12 * fade);
    g.drawCircle(x, y, radius * (0.08 + expand * 0.18));
    g.endFill();

    for (var ring = 0; ring < detail.ringCount; ring++) {
      var frac = detail.ringCount <= 1 ? 0 : ring / (detail.ringCount - 1);
      var ringR = flashR * (0.86 + frac * 0.70);
      var ringAlpha = Math.max(0, fade * (0.32 - frac * 0.05));
      drawDashedCircle(g, x, y, ringR, Math.max(1.0, 3.2 - frac * 0.55), ring % 2 === 0 ? PALETTE.trim : PALETTE.line, ringAlpha, 18 + ring * 4, 0.30, elapsed * 0.7 + ring * 0.18);
    }

    for (var spike = 0; spike < detail.spikeCount; spike++) {
      var ang = (spike / detail.spikeCount) * TAU + elapsed * 0.48 + (seed % 7) * 0.03;
      var inner = radius * 0.10;
      var outer = flashR * (0.90 + (spike % 3) * 0.12);
      g.lineStyle(1.2 + (spike % 2) * 0.8, spike % 2 === 0 ? PALETTE.trim : PALETTE.shock, 0.20 * fade);
      g.moveTo(x + Math.cos(ang) * inner, y + Math.sin(ang) * inner);
      g.lineTo(x + Math.cos(ang) * outer, y + Math.sin(ang) * outer);
    }

    for (var ember = 0; ember < detail.emberCount; ember++) {
      var emberSeed = seed + ember * 23.7;
      var emberA = ((emberSeed % 360) / 360) * TAU - expand * 0.8;
      var emberDist = radius * (0.12 + ((emberSeed % 17) / 17) * 0.58) * (0.26 + expand * 1.0);
      var emberX = x + Math.cos(emberA) * emberDist;
      var emberY = y + Math.sin(emberA) * emberDist;
      var emberR = 2.2 + (ember % 3) * 0.9;
      g.beginFill(ember % 3 === 0 ? PALETTE.emberWhite : (ember % 2 === 0 ? PALETTE.ember : PALETTE.emberHot), 0.24 * fade);
      g.drawCircle(emberX, emberY, emberR);
      g.endFill();
      g.lineStyle(1.0, ember % 2 === 0 ? PALETTE.emberHot : PALETTE.ember, 0.14 * fade);
      g.moveTo(emberX, emberY);
      g.lineTo(emberX + Math.cos(emberA) * (6 + (ember % 4) * 2), emberY + Math.sin(emberA) * (6 + (ember % 4) * 2));
    }
  }

  function drawImplosion(g, x, y, radius, t, alpha) {
    var spokes = 14;
    var pull = 1 - Math.pow(1 - clamp01(t), 2);
    var inner = radius * (0.06 + pull * 0.18);
    var outer = radius * (0.62 - pull * 0.24);
    g.beginFill(PALETTE.void, 0.10 * alpha);
    g.drawCircle(x, y, radius * (0.18 + pull * 0.12));
    g.endFill();
    for (var i = 0; i < spokes; i++) {
      var ang = (i / spokes) * TAU + t * 0.8;
      g.lineStyle(1.3 + (i % 3) * 0.4, i % 2 === 0 ? PALETTE.dark : PALETTE.shock, 0.20 * alpha);
      g.moveTo(x + Math.cos(ang) * outer, y + Math.sin(ang) * outer);
      g.lineTo(x + Math.cos(ang) * inner, y + Math.sin(ang) * inner);
    }
  }

  function drawLingeringDebris(g, strike, elapsed, fade, detail) {
    var x = strike.targetX || 0;
    var y = strike.targetY || 0;
    var radius = Math.max(80, strike.impactRadius || 500);
    var seed = strike.seed || 1;
    var t = clamp01(elapsed);
    var easeOut = 1 - Math.pow(1 - t, 1.35);
    for (var i = 0; i < detail.debrisCount * 4; i++) {
      var localSeed = seed + i * 19.17;
      var ang = ((localSeed % 360) / 360) * TAU + i * 0.07;
      var speedMul = 0.36 + ((localSeed % 29) / 29) * 1.28;
      var baseDist = radius * (0.36 + ((localSeed % 23) / 23) * 1.08);
      var dist = baseDist * (0.04 + easeOut * speedMul);
      var px = x + Math.cos(ang) * dist;
      var py = y + Math.sin(ang) * dist;
      var tail = 7 + (i % 5) * 2;
      var rockR = 1.3 + (i % 4) * 0.7;
      g.lineStyle(0.9 + (i % 2) * 0.6, i % 3 === 0 ? PALETTE.emberHot : PALETTE.line, 0.16 * fade);
      g.moveTo(px - Math.cos(ang) * tail * (0.55 + (1 - t) * 0.55), py - Math.sin(ang) * tail * (0.55 + (1 - t) * 0.55));
      g.lineTo(px, py);
      g.beginFill(i % 2 === 0 ? PALETTE.hull : PALETTE.dark, 0.32 * fade);
      g.drawCircle(px, py, rockR);
      g.endFill();
      if (i % 3 === 0) {
        g.beginFill(i % 2 === 0 ? PALETTE.ember : PALETTE.emberWhite, 0.14 * fade);
        g.drawCircle(px, py, rockR + 1.6);
        g.endFill();
      }
    }
  }

  function renderStrike(strike, opts) {
    if (!strike || !opts || !opts.layer) return;
    var traj = ensureGraphicRef(strike, "trajGfx", opts.layer);
    var gfx = ensureGraphicRef(strike, "gfx", opts.layer);
    var overlay = ensureGraphicRef(strike, "overlayGfx", opts.layer);
    if (!traj || !gfx || !overlay) return;

    var timeSec = opts.simTimeSec || 0;
    var elapsed = Math.max(0, timeSec - (strike.spawnedAt || 0));
    var flightDuration = Math.max(0.001, strike.flightDuration || 10.0);
    var impactFadeDuration = Math.max(0.001, strike.impactFadeDuration || 2.6);
    var totalDuration = Math.max(flightDuration + impactFadeDuration, strike.duration || (flightDuration + impactFadeDuration));
    var debrisFadeDuration = Math.max(0.001, totalDuration - flightDuration - impactFadeDuration);
    var level = getZoomLevel(opts.zoom || 0.22);
    var detail = getDetail(level);
    var angle = Math.atan2((strike.targetY || 0) - (strike.startY || 0), (strike.targetX || 1) - (strike.startX || 0));

    traj.clear();
    gfx.clear();
    overlay.clear();

    if (elapsed < flightDuration) {
      var travel = clamp01(elapsed / flightDuration);
      var missileX = lerp(strike.startX || 0, strike.targetX || 0, travel);
      var missileY = lerp(strike.startY || 0, strike.targetY || 0, travel);
      var dirX = Math.cos(angle);
      var dirY = Math.sin(angle);
      var nx = -dirY;
      var ny = dirX;
      var pulse = 0.5 + 0.5 * Math.sin(timeSec * 15 + (strike.seed || 1) * 0.01);
      var flash = 0.28 + pulse * 0.72;
      var trailLen = detail.trailLen;

      drawRadiationPreview(
        overlay,
        strike.targetX || 0,
        strike.targetY || 0,
        strike.previewRadius || strike.impactRadius || 500,
        0.60,
        timeSec,
        strike.startX,
        strike.startY
      );

      drawDashedLine(
        traj,
        missileX,
        missileY,
        strike.targetX || 0,
        strike.targetY || 0,
        detail.dash,
        detail.gap,
        0.9,
        PALETTE.line,
        0.06 + pulse * 0.03,
        timeSec * 120
      );

      drawPassedTrail(
        traj,
        strike.startX || 0,
        strike.startY || 0,
        missileX,
        missileY,
        3.6,
        0.42 + flash * 0.22
      );

      traj.lineStyle(7.0, PALETTE.dark, 0.14 + flash * 0.10);
      traj.moveTo(missileX - dirX * trailLen, missileY - dirY * trailLen);
      traj.lineTo(missileX + dirX * 6, missileY + dirY * 6);
      traj.lineStyle(4.2, PALETTE.emberHot, 0.28 + flash * 0.18);
      traj.moveTo(missileX - dirX * trailLen * 0.88, missileY - dirY * trailLen * 0.88);
      traj.lineTo(missileX + dirX * 8, missileY + dirY * 8);
      traj.lineStyle(3.2, PALETTE.shock, 0.30 + flash * 0.18);
      traj.moveTo(missileX - dirX * trailLen * 0.82, missileY - dirY * trailLen * 0.82);
      traj.lineTo(missileX + dirX * 10, missileY + dirY * 10);
      traj.lineStyle(1.2, PALETTE.trim, 0.34 + flash * 0.24);
      traj.moveTo(missileX - dirX * trailLen * 0.52 + nx * 5, missileY - dirY * trailLen * 0.52 + ny * 5);
      traj.lineTo(missileX - nx * 2, missileY - ny * 2);
      traj.moveTo(missileX - dirX * trailLen * 0.52 - nx * 5, missileY - dirY * trailLen * 0.52 - ny * 5);
      traj.lineTo(missileX + nx * 2, missileY + ny * 2);

      var heat = travel;
      var glowX = missileX - dirX * 13;
      var glowY = missileY - dirY * 13;
      var colorPhase = (Math.sin(timeSec * 20 + heat * 4) + 1) * 0.5;
      var hotCore = colorPhase > 0.72 ? PALETTE.emberHot : (colorPhase > 0.42 ? PALETTE.ember : PALETTE.shock);
      var hotHalo = colorPhase > 0.76 ? PALETTE.emberWhite : (colorPhase > 0.38 ? PALETTE.ember : PALETTE.trim);
      gfx.beginFill(hotHalo, 0.28 + flash * 0.26);
      gfx.drawCircle(glowX, glowY, 8 + flash * 2);
      gfx.endFill();
      gfx.beginFill(hotCore, 0.28 + flash * 0.26 + heat * 0.16);
      gfx.drawCircle(glowX, glowY, 4.2 + flash * 1.1);
      gfx.endFill();
      gfx.beginFill(PALETTE.emberWhite, 0.26 + flash * 0.18 + heat * 0.10);
      gfx.drawCircle(glowX, glowY, 1.9 + flash * 0.6);
      gfx.endFill();

      drawRocketBody(gfx, missileX, missileY, angle, 1.0, 0.98);
    } else if (elapsed < totalDuration) {
      var postImpactElapsed = elapsed - flightDuration;
      var impactElapsed = Math.min(impactFadeDuration, postImpactElapsed);
      var fade = 1 - smoothstep(0, impactFadeDuration, impactElapsed);
      var expand = smoothstep(0, impactFadeDuration, impactElapsed);
      var debrisElapsed = Math.max(0, postImpactElapsed - impactFadeDuration);
      var debrisT = clamp01(debrisFadeDuration > 0.001 ? debrisElapsed / debrisFadeDuration : 1);
      var debrisFade = 1 - debrisT;
      var debrisTravelT = clamp01(postImpactElapsed / Math.max(0.001, impactFadeDuration + debrisFadeDuration));

      drawRadiationPreview(
        overlay,
        strike.targetX || 0,
        strike.targetY || 0,
        (strike.previewRadius || strike.impactRadius || 500) * (0.96 + expand * 0.10),
        0.18 * Math.max(fade, debrisFade * 0.35),
        timeSec
      );
      drawImplosion(gfx, strike.targetX || 0, strike.targetY || 0, strike.impactRadius || 500, clamp01(postImpactElapsed / 0.9), Math.max(fade, 0.16));
      if (postImpactElapsed <= impactFadeDuration) drawImpactBurst(gfx, strike, impactElapsed, fade, expand, detail);
      drawLingeringDebris(gfx, strike, debrisTravelT, Math.max(debrisFade, fade * 0.45), detail);
    }
  }

  function drawPreview(g, preview, opts) {
    if (!g || !preview) return;
    drawRadiationPreview(
      g,
      preview.x || 0,
      preview.y || 0,
      preview.radius || 500,
      1.0,
      opts && opts.timeSec ? opts.timeSec : 0,
      preview.originX,
      preview.originY
    );
  }

  function destroyStrike(strike) {
    destroyGraphicRef(strike, "gfx");
    destroyGraphicRef(strike, "trajGfx");
    destroyGraphicRef(strike, "overlayGfx");
  }

  var api = {
    renderStrike: renderStrike,
    drawPreview: drawPreview,
    destroyStrike: destroyStrike
  };

  if (typeof window !== "undefined") window.ThermoNukeRenderer = api;
  if (typeof module !== "undefined") module.exports = api;
})();
