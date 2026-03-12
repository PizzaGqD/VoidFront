/**
 * ZoneRenderer — Tactical overlay zone drawing for VoidFront.
 * Replaces the old "bubble" zone style with segmented edges,
 * inner rings, radial markers, and sensor nodes.
 *
 * Depends on: PIXI, FACTION_VIS, LOD (all on window).
 */
(function () {
  "use strict";

  function zoneShapeHash(p) {
    const r = p.influenceRayDistances;
    if (!r || r.length === 0) return -1;
    let h = 1;
    for (let i = 0; i < r.length; i += 4) h = (h * 31 + (r[i] | 0)) >>> 0;
    return h || 1;
  }

  function smoothedPoly(pts) {
    if (!pts || pts.length < 3) return pts;
    const n = pts.length;
    const out = [];
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const cur = pts[i];
      const next = pts[(i + 1) % n];
      out.push({
        x: cur.x * 0.6 + prev.x * 0.2 + next.x * 0.2,
        y: cur.y * 0.6 + prev.y * 0.2 + next.y * 0.2,
      });
    }
    return out;
  }

  function traceSmoothClosed(gfx, pts) {
    if (!pts || pts.length < 3) return;
    const n = pts.length;
    const midX = (pts[n - 1].x + pts[0].x) / 2;
    const midY = (pts[n - 1].y + pts[0].y) / 2;
    gfx.moveTo(midX, midY);
    for (let i = 0; i < n; i++) {
      const next = pts[(i + 1) % n];
      const mx = (pts[i].x + next.x) / 2;
      const my = (pts[i].y + next.y) / 2;
      gfx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    gfx.closePath();
  }

  function drawSmoothClosed(gfx, pts, width, color, alpha) {
    if (!pts || pts.length < 3) return;
    traceSmoothClosed(gfx, pts);
    gfx.stroke({ width: width, color: color, alpha: alpha });
  }

  function fillSmoothClosed(gfx, pts, color, alpha) {
    if (!pts || pts.length < 3) return;
    traceSmoothClosed(gfx, pts);
    gfx.fill({ color: color, alpha: alpha });
  }

  function scaledPoly(pts, cx, cy, scale) {
    return pts.map(function (pt) {
      return { x: cx + (pt.x - cx) * scale, y: cy + (pt.y - cy) * scale };
    });
  }

  function polyPerimeter(pts) {
    let len = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      len += Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
    }
    return len;
  }

  function drawDashedClosed(gfx, pts, dashLen, gapLen, width, color, alpha) {
    if (!pts || pts.length < 3) return;
    var drawing = true;
    var remain = dashLen;
    var idx = 0;
    var n = pts.length;
    var cx = pts[0].x, cy = pts[0].y;
    gfx.moveTo(cx, cy);
    var totalSteps = 0;
    var maxSteps = n * 60;

    while (totalSteps < maxSteps) {
      totalSteps++;
      var ni = (idx + 1) % n;
      var nx = pts[ni].x, ny = pts[ni].y;
      var dx = nx - cx, dy = ny - cy;
      var segLen = Math.hypot(dx, dy);
      if (segLen < 0.5) { idx = ni; cx = nx; cy = ny; if (ni === 0) break; continue; }

      if (segLen <= remain) {
        if (drawing) gfx.lineTo(nx, ny);
        else gfx.moveTo(nx, ny);
        remain -= segLen;
        cx = nx; cy = ny; idx = ni;
        if (remain <= 0) {
          drawing = !drawing;
          remain = drawing ? dashLen : gapLen;
        }
        if (ni === 0) break;
      } else {
        var frac = remain / segLen;
        var mx = cx + dx * frac, my = cy + dy * frac;
        if (drawing) gfx.lineTo(mx, my);
        else gfx.moveTo(mx, my);
        cx = mx; cy = my;
        drawing = !drawing;
        remain = drawing ? dashLen : gapLen;
      }
    }
    gfx.stroke({ width: width, color: color, alpha: alpha });
  }

  function drawSegment(gfx, x1, y1, x2, y2, width, color, alpha) {
    gfx.moveTo(x1, y1);
    gfx.lineTo(x2, y2);
    gfx.stroke({ width: width, color: color, alpha: alpha });
  }

  function drawCircleStroke(gfx, x, y, r, width, color, alpha) {
    gfx.circle(x, y, r);
    gfx.stroke({ width: width, color: color, alpha: alpha });
  }

  function drawCircleFill(gfx, x, y, r, color, alpha) {
    gfx.circle(x, y, r);
    gfx.fill({ color: color, alpha: alpha });
  }

  function drawElectricLine(gfx, x0, y0, x1, y1, glowColor, coreColor, alpha, jitterAmp, time, pxToWorld) {
    var dx = x1 - x0;
    var dy = y1 - y0;
    var len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len;
    var ny = dx / len;
    var steps = 4;
    var pts = [{ x: x0, y: y0 }];
    for (var s = 1; s < steps; s++) {
      var t = s / steps;
      var jitter = Math.sin((time || 0) * 24 + t * 18 + x0 * 0.01 + y0 * 0.01) * jitterAmp;
      pts.push({
        x: x0 + dx * t + nx * jitter,
        y: y0 + dy * t + ny * jitter
      });
    }
    pts.push({ x: x1, y: y1 });
    for (var i = 0; i < pts.length - 1; i++) {
      drawSegment(gfx, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 1.15 * pxToWorld, glowColor, alpha);
    }
    drawSegment(gfx, x0, y0, x1, y1, 0.55 * pxToWorld, coreColor, alpha * 0.55);
  }

  function drawPressureBands(gfx, shell, palette, pxToWorld) {
    for (var i = 0; i < shell.length; i++) {
      var s = shell[i];
      if (s.pressure <= 0.08) continue;
      var rOuter = 7 * pxToWorld + s.pressure * 17 * pxToWorld;
      var rInner = 3 * pxToWorld + s.pressure * 7 * pxToWorld;
      drawCircleStroke(gfx, s.x, s.y, rOuter, 1.7 * pxToWorld, palette.bright || palette.edge, 0.07 + s.pressure * 0.12);
      drawCircleStroke(gfx, s.x, s.y, rInner, 0.85 * pxToWorld, palette.edge, 0.08 + s.pressure * 0.10);
    }
  }

  function drawHotspot(gfx, shell, palette, pxToWorld) {
    var hotspot = null;
    for (var i = 0; i < shell.length; i++) {
      if (!hotspot || shell[i].pressure > hotspot.pressure) hotspot = shell[i];
    }
    if (!hotspot || hotspot.pressure <= 0.08) return;
    var glowR = 10 * pxToWorld + hotspot.pressure * 26 * pxToWorld;
    drawCircleFill(gfx, hotspot.x, hotspot.y, glowR, palette.glow || palette.core, 0.04 + hotspot.pressure * 0.05);
    drawCircleStroke(gfx, hotspot.x, hotspot.y, glowR * 0.62, 1.2 * pxToWorld, palette.bright || palette.edge, 0.14 + hotspot.pressure * 0.10);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(a, b, x) {
    if (a === b) return x >= b ? 1 : 0;
    var t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function fract(v) {
    return v - Math.floor(v);
  }

  function seeded(seed) {
    return fract(Math.sin(seed * 127.1 + 311.7) * 43758.5453123);
  }

  function layeredNoise(seed, angle, time) {
    return (
      Math.sin(angle * 2.8 + time * 1.15 + seed * 0.17) * 0.55 +
      Math.cos(angle * 5.2 - time * 0.76 + seed * 0.31) * 0.30 +
      Math.sin(angle * 9.3 + time * 0.38 + seed * 0.08) * 0.15
    );
  }

  function pointInPolygon(x, y, poly) {
    if (!poly || poly.length < 3) return false;
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i].x, yi = poly[i].y;
      var xj = poly[j].x, yj = poly[j].y;
      var intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-6) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function pressureValue(player) {
    if (!player) return 1;
    var inflMul = player.influenceSpeedMul != null ? player.influenceSpeedMul : 1;
    var armyPenalty = Math.max(0.1, 1 - (player.activeUnits || 0) * 0.0045);
    return (player.pop || 0) * inflMul * armyPenalty;
  }

  function distanceAtAngle(player, angle) {
    var rays = player && player.influenceRayDistances;
    if (!rays || !rays.length) return player && player.influenceR ? player.influenceR : 0;
    var ratio = (((angle / (Math.PI * 2)) % 1) + 1) % 1;
    var idx = ratio * rays.length;
    var i0 = Math.floor(idx) % rays.length;
    var i1 = (i0 + 1) % rays.length;
    var frac = idx - Math.floor(idx);
    var a = rays[i0] || 0;
    var b = rays[i1] || a;
    return a + (b - a) * frac;
  }

  function buildVisualShell(p, smoothPoly, cfg) {
    var time = cfg.time || 0;
    var players = cfg.players || [];
    var myPressure = pressureValue(p);
    var shell = [];
    var seed = (p.id || 1) * 37.3;

    for (var i = 0; i < smoothPoly.length; i++) {
      var pt = smoothPoly[i];
      var angle = Math.atan2(pt.y - p.y, pt.x - p.x);
      var realD = Math.hypot(pt.x - p.x, pt.y - p.y);
      var nx = Math.cos(angle);
      var ny = Math.sin(angle);
      var baseOffset = 18 + layeredNoise(seed + 11, angle, time * 0.45) * 3.5 + Math.sin(time * 0.85 + angle * 4.0 + seed) * 1.3;
      var shellBaseR = realD + baseOffset;
      shell.push({
        angle: angle,
        realD: realD,
        shellBaseR: shellBaseR,
        shellR: shellBaseR,
        nx: nx,
        ny: ny,
        tangentX: -ny,
        tangentY: nx,
        pressure: 0,
        conflictTarget: null
      });
    }

    for (var s = 0; s < shell.length; s++) {
      var sample = shell[s];
      var ex = p.x + sample.nx * sample.shellR;
      var ey = p.y + sample.ny * sample.shellR;
      var bestPressure = 0;
      var bestTarget = null;

      for (var pi = 0; pi < players.length; pi++) {
        var other = players[pi];
        if (!other || other.id === p.id || !other.influencePolygon || other.influencePolygon.length < 3) continue;

        var dx = other.x - ex;
        var dy = other.y - ey;
        var dist = Math.hypot(dx, dy) || 1;
        var dirX = dx / dist;
        var dirY = dy / dist;
        var facing = clamp(sample.nx * dirX + sample.ny * dirY, 0, 1);
        if (facing <= 0.02) continue;

        var otherPressure = pressureValue(other);
        var pushRatio = otherPressure / (myPressure + otherPressure + 1);
        var shellReach = (other.influenceR || 0) + 30;
        var proximity = smoothstep(shellReach + 22, (other.influenceR || 0) * 0.62, dist);
        var inside = pointInPolygon(ex, ey, other.influencePolygon);
        var corePressure = proximity * Math.pow(facing, 2.1);
        var pressure = proximity * Math.pow(facing, 1.45);
        if (inside) pressure = Math.max(pressure, 0.35 + proximity * 0.65);
        pressure = Math.max(pressure, corePressure) * Math.max(pushRatio, 0.28);
        if (pressure <= 0.015) continue;

        var penetration = inside
          ? Math.max(0, shellReach - dist + 18)
          : Math.max(0, shellReach * 0.72 - dist);
        var crush = penetration * (0.22 + pushRatio * 0.75) + pressure * 26;
        var minShellR = sample.realD + 3;
        sample.shellR = Math.max(minShellR, sample.shellR - crush);
        if (pressure > bestPressure) {
          var otherAngle = Math.atan2(ey - other.y, ex - other.x);
          var otherShellR = distanceAtAngle(other, otherAngle) + 18 + layeredNoise((other.id || 1) * 37.3 + 11, otherAngle, time * 0.9) * 7;
          bestPressure = pressure;
          bestTarget = {
            x: other.x + Math.cos(otherAngle) * otherShellR,
            y: other.y + Math.sin(otherAngle) * otherShellR
          };
        }
      }

      sample.pressure = clamp(bestPressure, 0, 1);
      sample.conflictTarget = bestTarget;
    }

    var nextValues = new Array(shell.length);
    for (var j = 0; j < shell.length; j++) {
      var prev = shell[(j - 1 + shell.length) % shell.length];
      var cur = shell[j];
      var next = shell[(j + 1) % shell.length];
      var jelly = (cur.pressure * 0.68 + ((prev.pressure + next.pressure) * 0.5) * 0.32) * 14;
      var blended = cur.shellR * 0.54 + prev.shellR * 0.23 + next.shellR * 0.23;
      nextValues[j] = clamp(Math.min(cur.shellR, blended - jelly), cur.realD + 3, cur.shellBaseR + 4);
    }
    for (var k = 0; k < shell.length; k++) {
      shell[k].shellR = nextValues[k];
      shell[k].x = p.x + shell[k].nx * shell[k].shellR;
      shell[k].y = p.y + shell[k].ny * shell[k].shellR;
    }

    return shell;
  }

  function drawPlexusShell(gfx, shell, palette, pxToWorld, detail, time) {
    if (!gfx || !shell || shell.length < 3) return;
    var shellPts = shell.map(function (s) { return { x: s.x, y: s.y }; });
    var lodMul = detail.sensorNodes ? 1 : (detail.radialMarkers ? 0.78 : 0.55);

    // Plexus: edge-only shell above the real contour.
    drawSmoothClosed(gfx, shellPts, 6.2 * pxToWorld, palette.glow || palette.core, 0.060 * lodMul);
    drawSmoothClosed(gfx, shellPts, 2.8 * pxToWorld, palette.edge || palette.core, 0.26 * lodMul);
    drawDashedClosed(gfx, shellPts, 8 * pxToWorld, 6 * pxToWorld, 1.4 * pxToWorld, palette.line || palette.core, 0.25 * lodMul);

    var desiredNodes = detail.sensorNodes ? 20 : (detail.radialMarkers ? 12 : 8);
    var nodeSpacing = Math.max(1, Math.floor(shell.length / desiredNodes));
    for (var i = 0; i < shell.length; i += nodeSpacing) {
      var a = shell[i];
      var b = shell[(i + nodeSpacing) % shell.length];

      drawSegment(gfx, a.x, a.y, b.x, b.y, 0.9 * pxToWorld, palette.line || palette.core, (0.10 + a.pressure * 0.12) * lodMul);

      if (detail.sensorNodes && a.pressure > 0.08) {
        var prev = shell[(i - nodeSpacing + shell.length) % shell.length];
        drawSegment(gfx, prev.x, prev.y, a.x, a.y, 0.8 * pxToWorld, palette.line || palette.core, 0.08 + a.pressure * 0.12);
      }

      var nodeR = 1.2 * pxToWorld + a.pressure * 0.8 * pxToWorld;
      drawCircleFill(gfx, a.x, a.y, nodeR, palette.glow || palette.core, (0.22 + a.pressure * 0.20) * lodMul);
      drawCircleStroke(gfx, a.x, a.y, nodeR + 0.55 * pxToWorld, 0.6 * pxToWorld, palette.edge, 0.48 * lodMul);

      if (a.pressure > 0.12) {
        drawElectricLine(
          gfx,
          a.x,
          a.y,
          b.x,
          b.y,
          palette.glow || palette.core,
          palette.bright || palette.edge,
          0.10 + a.pressure * 0.14,
          3 * pxToWorld,
          time,
          pxToWorld
        );
        if (a.conflictTarget && Math.hypot(a.conflictTarget.x - a.x, a.conflictTarget.y - a.y) <= 120 * pxToWorld) {
          drawElectricLine(
            gfx,
            a.x,
            a.y,
            a.conflictTarget.x,
            a.conflictTarget.y,
            palette.glow || palette.core,
            palette.bright || palette.edge,
            0.12 + a.pressure * 0.16,
            5 * pxToWorld,
            time,
            pxToWorld
          );
        }
      }

      if (detail.sensorNodes) {
        var shimmerPhase = 0.5 + 0.5 * Math.sin((time || 0) * 1.7 + i * 0.73 + (shell.length * 0.11));
        if (shimmerPhase > 0.92) {
          var farNode = shell[(i + nodeSpacing * 2) % shell.length];
          drawElectricLine(
            gfx,
            a.x,
            a.y,
            farNode.x,
            farNode.y,
            palette.glow || palette.core,
            palette.bright || palette.edge,
            0.04 + a.pressure * 0.06,
            1.8 * pxToWorld,
            time,
            pxToWorld
          );
        }
      }
    }

    drawPressureBands(gfx, shell, palette, pxToWorld);
    drawHotspot(gfx, shell, palette, pxToWorld);
  }

  /**
   * Main zone redraw — tactical overlay style.
   * @param {object} p - player object with influencePolygon, influenceRayDistances, x, y, color, zoneGfx, zoneGlow
   * @param {object} cfg - { INFLUENCE_ARMY_MARGIN, zoom }
   */
  function redraw(p, cfg) {
    if (!p.zoneGfx || !p.zoneGlow || p.zoneGfx.destroyed || p.zoneGlow.destroyed) return;
    var poly = p.influencePolygon;
    if (!poly || poly.length < 3) return;

    var zoom = cfg.zoom || 0.22;
    var detail = LOD.getDetail("zone", zoom);
    var shapeHash = zoneShapeHash(p);
    var renderKey = [
      shapeHash,
      LOD.getLevel(zoom),
      p.color || 0,
      cfg.INFLUENCE_ARMY_MARGIN || 40,
      Math.floor((cfg.time || 0) * (detail.sensorNodes ? 8 : 4))
    ].join(":");
    if (p._lastZoneHash === shapeHash && p._lastZoneRenderKey === renderKey) return;
    p._lastZoneHash = shapeHash;
    p._lastZoneRenderKey = renderKey;

    p.zoneGfx.clear();
    p.zoneGlow.clear();
    if (p.zoneShellGfx && !p.zoneShellGfx.destroyed) p.zoneShellGfx.clear();

    var smoothPoly = smoothedPoly(poly);
    var palette = FACTION_VIS.getFactionPalette(p.color);
    var margin = cfg.INFLUENCE_ARMY_MARGIN || 40;
    var pxToWorld = 1 / Math.max(zoom, 0.08);
    var shell = buildVisualShell(p, smoothPoly, cfg);
    var lodAlpha = detail.sensorNodes ? 1.0 : (detail.innerRings > 0 ? 0.78 : 0.52);

    // Real zone body: layered fills toward the real radius, fading with zoom.
    var fillLodMul = detail.sensorNodes ? 1.0 : (detail.innerRings > 0 ? 0.42 : 0.14);
    var fillScales = [0.78, 0.88, 0.93, 0.95, 0.99];
    var fillAlphas = [0.018, 0.068, 0.053, 0.040, 0.026];
    for (var fi = 0; fi < fillScales.length; fi++) {
      var fillPoly = scaledPoly(smoothPoly, p.x, p.y, fillScales[fi]);
      fillSmoothClosed(p.zoneGfx, fillPoly, palette.core, fillAlphas[fi] * fillLodMul);
    }

    // Real contour: multiple translucent edge layers near the border, LOD-faded.
    drawSmoothClosed(p.zoneGlow, smoothPoly, 16 * pxToWorld, palette.core, 0.020 * lodAlpha);
    drawSmoothClosed(p.zoneGlow, smoothPoly, 9 * pxToWorld, palette.edge, 0.032 * lodAlpha);
    drawSmoothClosed(p.zoneGfx, smoothPoly, 2.4 * pxToWorld, palette.core, 0.11 * lodAlpha);
    drawSmoothClosed(p.zoneGfx, smoothPoly, 1.2 * pxToWorld, palette.edge, 0.18 * lodAlpha);
    drawDashedClosed(p.zoneGfx, smoothPoly, 9 * pxToWorld, 7 * pxToWorld, detail.edgeWidth * pxToWorld, palette.core, 0.20 * lodAlpha);

    var ringScales = [0.70, 0.84, 0.93];
    var ringAlphas = [0.020, 0.032, 0.048];
    var ringWidths = [0.30 * pxToWorld, 0.42 * pxToWorld, 0.56 * pxToWorld];
    var ringCount = Math.min(detail.innerRings, ringScales.length);
    for (var ri = 0; ri < ringCount; ri++) {
      var ringPoly = scaledPoly(smoothPoly, p.x, p.y, ringScales[ri]);
      drawSmoothClosed(p.zoneGfx, ringPoly, ringWidths[ri], palette.edge, ringAlphas[ri] * lodAlpha);
    }

    if (detail.radialMarkers && ringCount > 0) {
      var markerRing = scaledPoly(smoothPoly, p.x, p.y, 0.88);
      var markerStep = Math.max(5, Math.floor(markerRing.length / 16));
      for (var mi = 0; mi < markerRing.length; mi += markerStep) {
        var mp = markerRing[mi];
        var dx = mp.x - p.x, dy = mp.y - p.y;
        var dl = Math.hypot(dx, dy) || 1;
        var tickLen = 5 * pxToWorld;
        var nx = dx / dl, ny = dy / dl;
        drawSegment(
          p.zoneGfx,
          mp.x - nx * tickLen,
          mp.y - ny * tickLen,
          mp.x + nx * tickLen,
          mp.y + ny * tickLen,
          0.34 * pxToWorld,
          palette.edge,
          0.055 * lodAlpha
        );
      }
    }

    // --- 6. Outer glow (subtle) ---
    drawSmoothClosed(p.zoneGlow, smoothPoly, 2.2 * pxToWorld, palette.glow || palette.core, 0.015 * lodAlpha);

    if (p.zoneShellGfx && !p.zoneShellGfx.destroyed) {
      drawPlexusShell(p.zoneShellGfx, shell, palette, pxToWorld, detail, cfg.time || 0);
    }

    var numRays = poly.length;
    var innerPoly = [];
    for (var i = 0; i < numRays; i++) {
      var angle = (i / numRays) * Math.PI * 2;
      var rayD = (p.influenceRayDistances && p.influenceRayDistances[i]) ? p.influenceRayDistances[i] : Math.hypot(poly[i].x - p.x, poly[i].y - p.y);
      var d = Math.max(0, rayD - margin);
      innerPoly.push({ x: p.x + Math.cos(angle) * d, y: p.y + Math.sin(angle) * d });
    }
    var smoothInner = smoothedPoly(innerPoly);
    if (smoothInner.length >= 3 && margin > 0 && detail.sensorNodes) {
      drawDashedClosed(p.zoneGfx, smoothInner, 7 * pxToWorld, 8 * pxToWorld, 0.44 * pxToWorld, palette.edge, 0.06 * lodAlpha);
    }

  }

  var ZoneRenderer = {
    redraw: redraw,
    zoneShapeHash: zoneShapeHash,
    smoothedPoly: smoothedPoly,
    drawSmoothClosed: drawSmoothClosed,
    scaledPoly: scaledPoly,
    drawDashedClosed: drawDashedClosed,
  };

  if (typeof window !== "undefined") window.ZoneRenderer = ZoneRenderer;
  if (typeof module !== "undefined") module.exports = ZoneRenderer;
})();
