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

  function drawSmoothClosed(gfx, pts) {
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
    gfx.setStrokeStyle({ width: width, color: color, alpha: alpha });
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
      cfg.INFLUENCE_ARMY_MARGIN || 40
    ].join(":");
    if (p._lastZoneHash === shapeHash && p._lastZoneRenderKey === renderKey) return;
    p._lastZoneHash = shapeHash;
    p._lastZoneRenderKey = renderKey;

    p.zoneGfx.clear();
    p.zoneGlow.clear();

    var smoothPoly = smoothedPoly(poly);
    var palette = FACTION_VIS.getFactionPalette(p.color);
    var margin = cfg.INFLUENCE_ARMY_MARGIN || 40;
    var pxToWorld = 1 / Math.max(zoom, 0.08);

    // --- 1. Soft translucent fill (always light — almost invisible tint) ---
    var fillAlpha = detail.fillAlpha != null ? detail.fillAlpha : 0.012;
    p.zoneGfx.beginFill(palette.soft, fillAlpha);
    drawSmoothClosed(p.zoneGfx, smoothPoly);
    p.zoneGfx.endFill();

    // --- 1b. Readable outer coverage band for the turret edge area ---
    p.zoneGfx.lineStyle(16 * pxToWorld, palette.core, 0.020);
    drawSmoothClosed(p.zoneGfx, smoothPoly);
    p.zoneGfx.lineStyle(9 * pxToWorld, palette.edge, 0.030);
    drawSmoothClosed(p.zoneGfx, smoothPoly);

    // --- 2. Inner rings ---
    var ringScales = [0.70, 0.85, 0.93];
    var ringAlphas = [0.018, 0.028, 0.040];
    var ringWidths = [0.30 * pxToWorld, 0.42 * pxToWorld, 0.56 * pxToWorld];
    var ringCount = Math.min(detail.innerRings, ringScales.length);
    for (var ri = 0; ri < ringCount; ri++) {
      var ringPoly = scaledPoly(smoothPoly, p.x, p.y, ringScales[ri]);
      p.zoneGfx.lineStyle(ringWidths[ri], palette.edge, ringAlphas[ri]);
      drawSmoothClosed(p.zoneGfx, ringPoly);
    }

    // --- 3. Radial markers (short tick lines on inner rings) ---
    if (detail.radialMarkers && ringCount >= 2) {
      var markerRing = scaledPoly(smoothPoly, p.x, p.y, ringScales[ringCount - 1]);
      var markerStep = Math.max(6, Math.floor(markerRing.length / 16));
      p.zoneGfx.lineStyle(0.34 * pxToWorld, palette.edge, 0.055);
      for (var mi = 0; mi < markerRing.length; mi += markerStep) {
        var mp = markerRing[mi];
        var dx = mp.x - p.x, dy = mp.y - p.y;
        var dl = Math.hypot(dx, dy) || 1;
        var tickLen = 4.5 * pxToWorld;
        var nx = dx / dl, ny = dy / dl;
        p.zoneGfx.moveTo(mp.x - nx * tickLen, mp.y - ny * tickLen);
        p.zoneGfx.lineTo(mp.x + nx * tickLen, mp.y + ny * tickLen);
      }
    }

    // --- 4. Segmented outer edge (dashed) ---
    drawDashedClosed(p.zoneGfx, smoothPoly, 9 * pxToWorld, 7 * pxToWorld, detail.edgeWidth * pxToWorld, palette.core, 0.20);

    // --- 5. Sensor nodes along outer edge ---
    if (detail.sensorNodes) {
      var perim = polyPerimeter(smoothPoly);
      var nodeSpacing = Math.max(90, Math.min(160, perim / 14));
      var nodeCount = Math.max(4, Math.floor(perim / nodeSpacing));
      var stepPts = Math.max(1, Math.floor(smoothPoly.length / nodeCount));
      for (var si = 0; si < smoothPoly.length; si += stepPts) {
        var sp = smoothPoly[si];
        var sdx = sp.x - p.x, sdy = sp.y - p.y;
        var sdl = Math.hypot(sdx, sdy) || 1;
        // small diamond
        var ns = 1.35 * pxToWorld;
        var nnx = sdx / sdl, nny = sdy / sdl;
        var perpx = -nny, perpy = nnx;
        p.zoneGfx.beginFill(palette.core, 0.10);
        p.zoneGfx.moveTo(sp.x + nnx * ns, sp.y + nny * ns);
        p.zoneGfx.lineTo(sp.x + perpx * ns * 0.6, sp.y + perpy * ns * 0.6);
        p.zoneGfx.lineTo(sp.x - nnx * ns, sp.y - nny * ns);
        p.zoneGfx.lineTo(sp.x - perpx * ns * 0.6, sp.y - perpy * ns * 0.6);
        p.zoneGfx.closePath();
        p.zoneGfx.endFill();
      }
    }

    // --- 6. Outer glow (subtle) ---
    p.zoneGlow.lineStyle(2.2 * pxToWorld, palette.glow || palette.core, 0.015);
    drawSmoothClosed(p.zoneGlow, smoothPoly);

    // --- 7. Inner defense margin ring ---
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
      drawDashedClosed(p.zoneGfx, smoothInner, 7 * pxToWorld, 8 * pxToWorld, 0.44 * pxToWorld, palette.edge, 0.06);
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
