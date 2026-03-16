(function () {
  "use strict";

  var LODRef = (typeof window !== "undefined" && window.LOD) ? window.LOD : null;
  var TAU = Math.PI * 2;
  var PALETTE = {
    trim: 0xffefc9,
    core: 0xffb86b,
    line: 0xffcf78,
    dark: 0x171007,
    hull: 0x4a2d11
  };

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(a, b, x) {
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
    if (level === "far") return { arrows: 4, petals: 3, debris: 5, corridorAlpha: 0.12 };
    if (level === "mid") return { arrows: 5, petals: 4, debris: 8, corridorAlpha: 0.16 };
    return { arrows: 6, petals: 5, debris: 12, corridorAlpha: 0.20 };
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

  function drawArrow(g, x, y, angle, size, alpha) {
    var cosA = Math.cos(angle);
    var sinA = Math.sin(angle);
    var nx = -sinA;
    var ny = cosA;
    g.lineStyle(1.3, PALETTE.trim, alpha);
    g.moveTo(x - cosA * size - nx * size * 0.36, y - sinA * size - ny * size * 0.36);
    g.lineTo(x, y);
    g.lineTo(x - cosA * size + nx * size * 0.36, y - sinA * size + ny * size * 0.36);
  }

  function drawTargetArea(g, x, y, radius, timeSec, alpha) {
    var pulse = 0.5 + 0.5 * Math.sin((timeSec || 0) * 2.0);
    g.beginFill(PALETTE.dark, 0.08 * alpha);
    g.drawCircle(x, y, radius);
    g.endFill();
    g.beginFill(PALETTE.core, (0.04 + pulse * 0.02) * alpha);
    g.drawCircle(x, y, radius * 0.76);
    g.endFill();
    g.lineStyle(2.2, PALETTE.line, (0.26 + pulse * 0.10) * alpha);
    g.drawCircle(x, y, radius);
    g.lineStyle(1.2, PALETTE.trim, 0.18 * alpha);
    g.drawCircle(x, y, radius * 0.76);
    g.beginFill(PALETTE.trim, 0.62 * alpha);
    g.drawCircle(x, y, 7);
    g.endFill();
  }

  function drawFlagIcon(g, x, y, size, alpha) {
    var poleH = size * 1.7;
    var flagW = size * 1.18;
    var flagH = size * 0.82;
    g.lineStyle(2.0, PALETTE.trim, 0.42 * alpha);
    g.moveTo(x - size * 0.38, y + poleH * 0.58);
    g.lineTo(x - size * 0.38, y - poleH * 0.58);
    g.beginFill(PALETTE.core, 0.18 * alpha);
    g.moveTo(x - size * 0.34, y - poleH * 0.54);
    g.lineTo(x + flagW * 0.52, y - poleH * 0.44);
    g.lineTo(x + flagW * 0.08, y - poleH * 0.08);
    g.lineTo(x + flagW * 0.54, y + flagH * 0.16 - poleH * 0.18);
    g.lineTo(x - size * 0.34, y + flagH * 0.18 - poleH * 0.10);
    g.closePath();
    g.endFill();
    g.lineStyle(1.2, PALETTE.trim, 0.38 * alpha);
    g.moveTo(x - size * 0.10, y - size * 0.06);
    g.lineTo(x + size * 0.18, y + size * 0.18);
    g.moveTo(x + size * 0.18, y - size * 0.06);
    g.lineTo(x - size * 0.10, y + size * 0.18);
    g.drawCircle(x + size * 0.04, y + size * 0.26, size * 0.14);
  }

  function drawRift(g, x, y, angle, scale, openK, detail) {
    var openRadius = scale * (0.42 + openK * 0.72) * 1.18;
    var slitRadius = openRadius * (0.30 + openK * 0.36);
    var perpAngle = angle + Math.PI * 0.5;
    var petals = detail.petals;

    g.beginFill(PALETTE.core, 0.08 * openK);
    g.drawCircle(x, y, openRadius * 1.6);
    g.endFill();
    g.beginFill(PALETTE.trim, 0.05 * openK);
    g.drawCircle(x, y, openRadius * 1.2);
    g.endFill();

    g.beginFill(PALETTE.dark, 0.92 * openK);
    g.drawEllipse(x, y, openRadius, slitRadius);
    g.endFill();

    g.lineStyle(3.0, PALETTE.trim, 0.72 * openK);
    g.moveTo(x - openRadius * 0.82, y);
    g.bezierCurveTo(
      x - openRadius * 0.24, y - slitRadius * 0.84,
      x + openRadius * 0.24, y + slitRadius * 0.84,
      x + openRadius * 0.82, y
    );
    g.lineStyle(5.2, PALETTE.core, 0.26 * openK);
    g.moveTo(x - openRadius * 0.82, y + slitRadius * 0.10);
    g.bezierCurveTo(
      x - openRadius * 0.24, y - slitRadius * 0.70,
      x + openRadius * 0.24, y + slitRadius * 0.70,
      x + openRadius * 0.82, y - slitRadius * 0.10
    );

    for (var i = 0; i < petals; i++) {
      var petalAng = perpAngle + (i / Math.max(1, petals)) * TAU;
      var px = x + Math.cos(petalAng) * openRadius * 1.04;
      var py = y + Math.sin(petalAng) * slitRadius * 1.55;
      var len = openRadius * (0.18 + (i % 2) * 0.05);
      g.beginFill(PALETTE.trim, 0.18 * openK);
      g.moveTo(px, py);
      g.lineTo(px - Math.cos(petalAng) * len + Math.sin(petalAng) * len * 0.35, py - Math.sin(petalAng) * len - Math.cos(petalAng) * len * 0.35);
      g.lineTo(px - Math.cos(petalAng) * len - Math.sin(petalAng) * len * 0.35, py - Math.sin(petalAng) * len + Math.cos(petalAng) * len * 0.35);
      g.closePath();
      g.endFill();
    }
  }

  function drawCorridor(g, raid, alpha, detail, timeSec) {
    var angle = raid.attackAngle || 0;
    var nx = -Math.sin(angle);
    var ny = Math.cos(angle);
    var corridorHalfW = (raid.zoneRadius || 320) * 0.26;
    var pulse = 0.5 + 0.5 * Math.sin((timeSec || 0) * 1.6);

    g.beginFill(PALETTE.core, detail.corridorAlpha * alpha);
    g.moveTo(raid.portalX + nx * corridorHalfW, raid.portalY + ny * corridorHalfW);
    g.lineTo(raid.targetX + nx * corridorHalfW * 0.8, raid.targetY + ny * corridorHalfW * 0.8);
    g.lineTo(raid.targetX - nx * corridorHalfW * 0.8, raid.targetY - ny * corridorHalfW * 0.8);
    g.lineTo(raid.portalX - nx * corridorHalfW, raid.portalY - ny * corridorHalfW);
    g.closePath();
    g.endFill();

    g.lineStyle(1.5, PALETTE.trim, (0.18 + pulse * 0.08) * alpha);
    g.moveTo(raid.portalX, raid.portalY);
    g.lineTo(raid.targetX, raid.targetY);

    for (var i = 0; i < detail.arrows; i++) {
      var frac = (i + 1) / (detail.arrows + 1);
      var px = lerp(raid.portalX, raid.targetX, frac);
      var py = lerp(raid.portalY, raid.targetY, frac);
      drawArrow(g, px, py, angle, 12 + i * 1.5, (0.12 + frac * 0.12) * alpha);
    }
  }

  function drawDebris(g, raid, alpha, detail, timeSec) {
    var radius = (raid.zoneRadius || 320) * 0.74;
    var spin = (timeSec || 0) * 0.22;
    for (var i = 0; i < detail.debris; i++) {
      var frac = i / Math.max(1, detail.debris);
      var ang = spin + frac * TAU;
      var dist = radius * (0.42 + (i % 3) * 0.12);
      var len = 6 + (i % 4) * 3;
      var x = raid.targetX + Math.cos(ang) * dist;
      var y = raid.targetY + Math.sin(ang) * dist;
      g.lineStyle(1.1 + (i % 2) * 0.5, i % 2 === 0 ? PALETTE.trim : PALETTE.core, 0.18 * alpha);
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    }
  }

  function renderRaid(raid, opts) {
    if (!raid || !opts || !opts.layer) return;
    var gfx = ensureGraphicRef(raid, "gfx", opts.layer);
    if (!gfx) return;
    var timeSec = opts.simTimeSec || 0;
    var elapsed = Math.max(0, timeSec - (raid.spawnedAt || 0));
    var detail = getDetail(getZoomLevel(opts.zoom || 0.22));
    var portalDuration = Math.max(0.1, raid.portalDuration || 2.8);
    var totalDuration = Math.max(portalDuration, raid.duration || 5.4);
    var portalFade = 1 - smoothstep(portalDuration * 0.55, portalDuration, elapsed);
    var overallFade = 1 - smoothstep(totalDuration * 0.82, totalDuration, elapsed);
    var alpha = Math.max(0, Math.max(portalFade * 0.92, overallFade * 0.42));

    gfx.clear();
    if (alpha <= 0.001) return;

    drawTargetArea(gfx, raid.targetX, raid.targetY, raid.zoneRadius || 320, timeSec, 0.75 * overallFade);
    drawCorridor(gfx, raid, Math.min(1, portalFade * 0.9 + 0.15), detail, timeSec);
    drawRift(gfx, raid.portalX, raid.portalY, raid.attackAngle || 0, (raid.zoneRadius || 320) * 0.44, portalFade, detail);
    if (elapsed > portalDuration * 0.42) drawDebris(gfx, raid, overallFade, detail, timeSec);
  }

  function drawPreview(g, preview, opts) {
    if (!g || !preview) return;
    var timeSec = opts && opts.timeSec ? opts.timeSec : 0;
    var radius = preview.zoneRadius || 320;
    var pulse = 0.5 + 0.5 * Math.sin(timeSec * 2.2);
    g.beginFill(PALETTE.dark, 0.035);
    g.drawCircle(preview.targetX, preview.targetY, radius);
    g.endFill();
    g.lineStyle(2.4, PALETTE.line, 0.34 + pulse * 0.10);
    g.drawCircle(preview.targetX, preview.targetY, radius);
    g.lineStyle(1.3, PALETTE.trim, 0.22 + pulse * 0.08);
    g.drawCircle(preview.targetX, preview.targetY, radius * 0.78);
    drawFlagIcon(g, preview.targetX, preview.targetY, radius * 0.14, 0.95);
  }

  function destroyRaid(raid) {
    destroyGraphicRef(raid, "gfx");
  }

  var api = {
    renderRaid: renderRaid,
    drawPreview: drawPreview,
    destroyRaid: destroyRaid
  };

  if (typeof window !== "undefined") window.PirateRaidRenderer = api;
  if (typeof module !== "undefined") module.exports = api;
})();
