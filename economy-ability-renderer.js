(function () {
  "use strict";

  var LODRef = (typeof window !== "undefined" && window.LOD) ? window.LOD : null;
  var TAU = Math.PI * 2;
  var SIGNAL = {
    core: 0xff4259,
    edge: 0xffd6dd,
    glow: 0xff6b7e,
    dark: 0x21080d
  };
  var GOLD = {
    core: 0xffcb54,
    edge: 0xfff0b7,
    glow: 0xffd97b,
    dark: 0x241606
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

  function easeOutCubic(t) {
    var v = 1 - clamp01(t);
    return 1 - v * v * v;
  }

  function easeInCubic(t) {
    var v = clamp01(t);
    return v * v * v;
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
        routeSamples: 6,
        previewAlpha: 0.55,
        packetCountMul: 0.42,
        trailMul: 0.40,
        sparkMul: 0.42,
        haloMul: 0.54
      };
    }
    if (level === "mid") {
      return {
        routeSamples: 10,
        previewAlpha: 0.78,
        packetCountMul: 0.68,
        trailMul: 0.68,
        sparkMul: 0.72,
        haloMul: 0.78
      };
    }
    return {
      routeSamples: 15,
      previewAlpha: 1.00,
      packetCountMul: 1.00,
      trailMul: 1.00,
      sparkMul: 1.00,
      haloMul: 1.00
    };
  }

  function colorToRgba(color, alpha) {
    var value = Number(color) >>> 0;
    var r = (value >> 16) & 255;
    var g = (value >> 8) & 255;
    var b = value & 255;
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
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

  function distance(a, b) {
    var dx = (b.x || 0) - (a.x || 0);
    var dy = (b.y || 0) - (a.y || 0);
    return Math.hypot(dx, dy);
  }

  function lerpPoint(a, b, t) {
    return { x: lerp(a.x || 0, b.x || 0, t), y: lerp(a.y || 0, b.y || 0, t) };
  }

  function pushFromCenter(point, center, amount) {
    var dx = (point.x || 0) - (center.x || 0);
    var dy = (point.y || 0) - (center.y || 0);
    var len = Math.hypot(dx, dy) || 1;
    return {
      x: (point.x || 0) + dx / len * amount,
      y: (point.y || 0) + dy / len * amount
    };
  }

  function hermitePoint(p0, p1, p2, p3, t, tension) {
    var tt = t * t;
    var ttt = tt * t;
    var scale = (1 - (tension || 0)) * 0.5;
    var m1x = ((p2.x || 0) - (p0.x || 0)) * scale;
    var m1y = ((p2.y || 0) - (p0.y || 0)) * scale;
    var m2x = ((p3.x || 0) - (p1.x || 0)) * scale;
    var m2y = ((p3.y || 0) - (p1.y || 0)) * scale;
    var h00 = 2 * ttt - 3 * tt + 1;
    var h10 = ttt - 2 * tt + t;
    var h01 = -2 * ttt + 3 * tt;
    var h11 = ttt - tt;
    return {
      x: h00 * (p1.x || 0) + h10 * m1x + h01 * (p2.x || 0) + h11 * m2x,
      y: h00 * (p1.y || 0) + h10 * m1y + h01 * (p2.y || 0) + h11 * m2y
    };
  }

  function buildHermiteChain(points, samplesPerSegment, tension) {
    if (!points || points.length < 2) return points ? points.slice() : [];
    var out = [];
    var samples = Math.max(4, samplesPerSegment || 8);
    for (var i = 0; i < points.length - 1; i++) {
      var p0 = points[Math.max(0, i - 1)];
      var p1 = points[i];
      var p2 = points[i + 1];
      var p3 = points[Math.min(points.length - 1, i + 2)];
      for (var j = 0; j <= samples; j++) {
        if (i > 0 && j === 0) continue;
        out.push(hermitePoint(p0, p1, p2, p3, j / samples, tension));
      }
    }
    return out;
  }

  function makeRoute(points) {
    var lengths = [0];
    var total = 0;
    for (var i = 1; i < points.length; i++) {
      total += distance(points[i - 1], points[i]);
      lengths.push(total);
    }
    return { points: points, lengths: lengths, total: total };
  }

  function sampleRoute(route, distanceValue) {
    if (!route || !route.points || route.points.length < 2) return { x: 0, y: 0, angle: 0 };
    var d = Math.max(0, Math.min(route.total, distanceValue));
    for (var i = 1; i < route.points.length; i++) {
      var prev = route.lengths[i - 1];
      var next = route.lengths[i];
      if (d <= next || i === route.points.length - 1) {
        var seg = Math.max(0.0001, next - prev);
        var t = clamp01((d - prev) / seg);
        var a = route.points[i - 1];
        var b = route.points[i];
        return {
          x: lerp(a.x, b.x, t),
          y: lerp(a.y, b.y, t),
          angle: Math.atan2((b.y || 0) - (a.y || 0), (b.x || 0) - (a.x || 0))
        };
      }
    }
    var last = route.points[route.points.length - 1];
    var before = route.points[route.points.length - 2] || last;
    return {
      x: last.x || 0,
      y: last.y || 0,
      angle: Math.atan2((last.y || 0) - (before.y || 0), (last.x || 0) - (before.x || 0))
    };
  }

  function buildRouteSegment(route, fromDistance, toDistance, steps, offset) {
    var from = Math.max(0, Math.min(route.total, fromDistance));
    var to = Math.max(0, Math.min(route.total, toDistance));
    var count = Math.max(2, steps || 6);
    var out = [];
    var laneOffset = offset || 0;
    for (var i = 0; i <= count; i++) {
      var d = lerp(from, to, i / count);
      var sample = sampleRoute(route, d);
      var perpX = -Math.sin(sample.angle || 0);
      var perpY = Math.cos(sample.angle || 0);
      out.push({ x: sample.x + perpX * laneOffset, y: sample.y + perpY * laneOffset });
    }
    return out;
  }

  function drawPolyline(g, points, width, color, alpha) {
    if (!points || points.length < 2) return;
    g.lineStyle(width, color, alpha);
    g.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
  }

  function drawRoutePreview(g, route, color, alpha, width, offset) {
    if (!route) return;
    var points = offset ? buildRouteSegment(route, 0, route.total, 18, offset) : route.points;
    drawPolyline(g, points, (width || 2) + 5, color, alpha * 0.10);
    drawPolyline(g, points, width || 2, color, alpha);
  }

  function getBounds(worldWidth, worldHeight) {
    var w = Math.max(400, worldWidth || 2200);
    var h = Math.max(400, worldHeight || 1400);
    var pad = Math.max(74, Math.min(w, h) * 0.055);
    return {
      left: pad,
      top: pad,
      right: w - pad,
      bottom: h - pad,
      center: { x: w * 0.5, y: h * 0.5 },
      pad: pad
    };
  }

  function getCornerKey(point, bounds) {
    var left = (point.x || 0) <= bounds.center.x;
    var top = (point.y || 0) <= bounds.center.y;
    if (left && top) return "tl";
    if (!left && top) return "tr";
    if (!left && !top) return "br";
    return "bl";
  }

  function getCornerPoint(key, bounds) {
    if (key === "tr") return { key: key, x: bounds.right, y: bounds.top };
    if (key === "br") return { key: key, x: bounds.right, y: bounds.bottom };
    if (key === "bl") return { key: key, x: bounds.left, y: bounds.bottom };
    return { key: "tl", x: bounds.left, y: bounds.top };
  }

  function getPerimeterKeys(startKey, endKey, clockwise) {
    var order = clockwise ? ["tl", "tr", "br", "bl"] : ["tl", "bl", "br", "tr"];
    var startIndex = order.indexOf(startKey);
    var endIndex = order.indexOf(endKey);
    var keys = [];
    var idx = startIndex;
    while (idx !== endIndex) {
      keys.push(order[idx]);
      idx = (idx + 1) % order.length;
    }
    keys.push(order[endIndex]);
    return keys;
  }

  function buildEnergyStealRoute(effect, detail, bounds) {
    var start = { x: effect.startX || 0, y: effect.startY || 0 };
    var target = { x: effect.targetX || 0, y: effect.targetY || 0 };
    var startKey = getCornerKey(start, bounds);
    var targetKey = getCornerKey(target, bounds);
    var clockwise = (startKey === "tl" && targetKey === "br") || (startKey === "bl" && targetKey === "tr");
    var keys = getPerimeterKeys(startKey, targetKey, clockwise);
    var c0 = getCornerPoint(keys[0], bounds);
    var c1 = getCornerPoint(keys[1], bounds);
    var c2 = getCornerPoint(keys[2], bounds);
    var pad = bounds.pad;
    var center = bounds.center;
    var entry = pushFromCenter(lerpPoint(start, c0, 0.48), center, pad * 0.50);
    var edgeA0 = pushFromCenter(lerpPoint(c0, c1, 0.18), center, pad * 0.80);
    var edgeA1 = pushFromCenter(lerpPoint(c0, c1, 0.70), center, pad * 1.00);
    var apex = pushFromCenter(c1, center, pad * 1.42);
    var edgeB0 = pushFromCenter(lerpPoint(c1, c2, 0.30), center, pad * 1.00);
    var edgeB1 = pushFromCenter(lerpPoint(c1, c2, 0.82), center, pad * 0.80);
    var exit = pushFromCenter(lerpPoint(target, c2, 0.48), center, pad * 0.50);
    var anchors = [start, entry, edgeA0, edgeA1, apex, edgeB0, edgeB1, exit, target];
    return makeRoute(buildHermiteChain(anchors, Math.max(5, detail.routeSamples), 0.38));
  }

  function buildResourceSurgeRoute(effect, detail, bounds) {
    var target = { x: effect.targetX || 0, y: effect.targetY || 0 };
    var targetKey = getCornerKey(target, bounds);
    var corner = getCornerPoint(targetKey, bounds);
    var source = pushFromCenter(corner, bounds.center, bounds.pad * 0.72 + 110);
    var toTargetX = (target.x || 0) - (source.x || 0);
    var toTargetY = (target.y || 0) - (source.y || 0);
    var toTargetLen = Math.hypot(toTargetX, toTargetY) || 1;
    var perpX = -toTargetY / toTargetLen;
    var perpY = toTargetX / toTargetLen;
    var bendSign = (targetKey === "tl" || targetKey === "br") ? 1 : -1;
    var bend = Math.min(bounds.pad * 0.22, toTargetLen * 0.10) * bendSign;
    var gate = lerpPoint(source, target, 0.16);
    var midA = {
      x: lerp(source.x, target.x, 0.40) + perpX * bend,
      y: lerp(source.y, target.y, 0.40) + perpY * bend
    };
    var midB = {
      x: lerp(source.x, target.x, 0.70) + perpX * bend * 0.52,
      y: lerp(source.y, target.y, 0.70) + perpY * bend * 0.52
    };
    var inner = lerpPoint(midB, target, 0.72);
    var anchors = [source, gate, midA, midB, inner, target];
    return {
      source: source,
      route: makeRoute(buildHermiteChain(anchors, Math.max(5, detail.routeSamples - 1), 0.34))
    };
  }

  function drawCoreAura(g, x, y, radius, color, alpha) {
    g.beginFill(color, alpha);
    g.drawCircle(x, y, radius);
    g.endFill();
  }

  function drawEnergySignalHead(g, sample, size, alpha) {
    var angle = sample.angle || 0;
    var cosA = Math.cos(angle);
    var sinA = Math.sin(angle);
    var nx = -sinA;
    var ny = cosA;
    g.beginFill(SIGNAL.glow, 0.26 * alpha);
    g.drawCircle(sample.x, sample.y, size * 1.55);
    g.endFill();
    g.lineStyle(1.4, SIGNAL.edge, 0.38 * alpha);
    g.drawCircle(sample.x, sample.y, size * 1.18);
    g.beginFill(SIGNAL.core, 0.84 * alpha);
    g.moveTo(sample.x + cosA * size * 1.28, sample.y + sinA * size * 1.28);
    g.lineTo(sample.x - cosA * size * 0.64 + nx * size * 0.68, sample.y - sinA * size * 0.64 + ny * size * 0.68);
    g.lineTo(sample.x - cosA * size * 1.02, sample.y - sinA * size * 1.02);
    g.lineTo(sample.x - cosA * size * 0.64 - nx * size * 0.68, sample.y - sinA * size * 0.64 - ny * size * 0.68);
    g.closePath();
    g.endFill();
    g.beginFill(SIGNAL.edge, 0.34 * alpha);
    g.drawCircle(sample.x + cosA * size * 0.34, sample.y + sinA * size * 0.34, size * 0.30);
    g.endFill();
  }

  function drawEnergyPacket(g, sample, size, alpha, targetColor) {
    var angle = (sample.angle || 0) + Math.PI;
    var cosA = Math.cos(angle);
    var sinA = Math.sin(angle);
    var nx = -sinA;
    var ny = cosA;
    g.beginFill(SIGNAL.glow, 0.12 * alpha);
    g.drawCircle(sample.x, sample.y, size * 1.2);
    g.endFill();
    g.beginFill(targetColor, 0.24 * alpha);
    g.moveTo(sample.x + cosA * size * 0.88, sample.y + sinA * size * 0.88);
    g.lineTo(sample.x + nx * size * 0.54, sample.y + ny * size * 0.54);
    g.lineTo(sample.x - cosA * size * 0.88, sample.y - sinA * size * 0.88);
    g.lineTo(sample.x - nx * size * 0.54, sample.y - ny * size * 0.54);
    g.closePath();
    g.endFill();
    g.lineStyle(1.2, SIGNAL.core, 0.26 * alpha);
    g.drawCircle(sample.x, sample.y, size * 1.04);
    g.beginFill(SIGNAL.core, 0.30 * alpha);
    g.drawCircle(sample.x, sample.y, size * 0.36);
    g.endFill();
  }

  function drawBurstPacket(g, sample, size, alpha) {
    var angle = sample.angle || 0;
    var cosA = Math.cos(angle);
    var sinA = Math.sin(angle);
    var nx = -sinA;
    var ny = cosA;
    g.beginFill(GOLD.glow, 0.22 * alpha);
    g.moveTo(sample.x + cosA * size * 1.34, sample.y + sinA * size * 1.34);
    g.lineTo(sample.x + nx * size * 0.72, sample.y + ny * size * 0.72);
    g.lineTo(sample.x - cosA * size * 0.96, sample.y - sinA * size * 0.96);
    g.lineTo(sample.x - nx * size * 0.72, sample.y - ny * size * 0.72);
    g.closePath();
    g.endFill();
    g.lineStyle(1.4, GOLD.edge, 0.28 * alpha);
    g.drawCircle(sample.x, sample.y, size * 1.04);
    g.beginFill(GOLD.core, 0.86 * alpha);
    g.moveTo(sample.x + cosA * size * 0.96, sample.y + sinA * size * 0.96);
    g.lineTo(sample.x + nx * size * 0.48, sample.y + ny * size * 0.48);
    g.lineTo(sample.x - cosA * size * 0.66, sample.y - sinA * size * 0.66);
    g.lineTo(sample.x - nx * size * 0.48, sample.y - ny * size * 0.48);
    g.closePath();
    g.endFill();
    g.beginFill(GOLD.edge, 0.36 * alpha);
    g.drawCircle(sample.x + cosA * size * 0.28, sample.y + sinA * size * 0.28, size * 0.24);
    g.endFill();
  }

  function drawVictimSparks(g, effect, elapsed, detail) {
    var count = Math.max(3, Math.floor(8 * detail.sparkMul));
    var targetColor = effect.targetColor || 0x68d8ff;
    for (var i = 0; i < count; i++) {
      var ang = elapsed * (2.2 + i * 0.05) + i * 0.76;
      var orbit = 26 + Math.sin(elapsed * 6 + i) * 6;
      var x = (effect.targetX || 0) + Math.cos(ang) * orbit;
      var y = (effect.targetY || 0) + Math.sin(ang) * orbit;
      var dx = Math.cos(ang + 0.42) * (8 + i * 0.5);
      var dy = Math.sin(ang + 0.42) * (8 + i * 0.5);
      g.lineStyle(1.2, SIGNAL.core, 0.20);
      g.moveTo(x, y);
      g.lineTo(x + dx, y + dy);
      g.beginFill(targetColor, 0.10);
      g.drawCircle(x, y, 1.6 + (i % 2) * 0.5);
      g.endFill();
    }
  }

  function drawCrackLines(g, effect, elapsed) {
    for (var i = 0; i < 7; i++) {
      var ang = -1.0 + i * 0.34 + Math.sin(elapsed * 10 + i * 1.4) * 0.06;
      var len = 18 + i * 4 + Math.sin(elapsed * 5 + i) * 5;
      g.lineStyle(1.5, SIGNAL.glow, 0.14);
      g.moveTo(effect.targetX || 0, effect.targetY || 0);
      g.lineTo((effect.targetX || 0) + Math.cos(ang) * len, (effect.targetY || 0) + Math.sin(ang) * len);
    }
  }

  function drawEnergySteal(effect, traj, gfx, overlay, elapsed, detail, route) {
    var signalDuration = Math.max(0.1, effect.signalDuration || 0.88);
    var drainDuration = Math.max(0.1, effect.drainDuration || 3.0);
    var finishDuration = Math.max(0.1, effect.finishDuration || 0.56);
    var targetColor = effect.targetColor || 0x68d8ff;

    drawRoutePreview(traj, route, SIGNAL.core, 0.10 * detail.previewAlpha, 2.2, 0);
    drawRoutePreview(traj, route, targetColor, 0.08 * detail.previewAlpha, 1.5, 0);

    if (elapsed < signalDuration) {
      var signalT = clamp01(elapsed / signalDuration);
      var headDistance = easeOutCubic(signalT) * route.total;
      var tailLen = route.total * 0.22;
      var seg = buildRouteSegment(route, Math.max(0, headDistance - tailLen), headDistance, Math.max(6, detail.routeSamples));
      drawPolyline(traj, seg, 14 * detail.trailMul, SIGNAL.dark, 0.14);
      drawPolyline(traj, seg, 8 * detail.trailMul, SIGNAL.glow, 0.24);
      drawPolyline(traj, seg, 3.8, SIGNAL.edge, 0.30);
      drawPolyline(traj, seg, 1.6, SIGNAL.core, 0.70);
      var head = sampleRoute(route, headDistance);
      drawEnergySignalHead(gfx, head, 10.4, 1);
    }

    if (elapsed >= signalDuration) {
      drawCrackLines(gfx, effect, elapsed);
      drawVictimSparks(gfx, effect, elapsed, detail);
      drawCoreAura(gfx, effect.targetX || 0, effect.targetY || 0, 24 + Math.sin(elapsed * 5) * 4, SIGNAL.glow, 0.08 * detail.haloMul);
      var phaseT = clamp01((elapsed - signalDuration) / (drainDuration + finishDuration));
      drawCoreAura(gfx, effect.startX || 0, effect.startY || 0, 28 + phaseT * 10, SIGNAL.glow, 0.10 * detail.haloMul);
    }

    if (elapsed >= signalDuration && elapsed < signalDuration + drainDuration) {
      var drainT = clamp01((elapsed - signalDuration) / drainDuration);
      var count = Math.max(8, Math.floor(18 * detail.packetCountMul));
      var spacing = 42;
      var travel = drainT * (route.total + spacing * count);
      var chainStart = Math.max(0, route.total - Math.min(route.total, travel));
      var chainSeg = buildRouteSegment(route, chainStart, route.total, Math.max(8, detail.routeSamples + 2));
      drawPolyline(traj, chainSeg, 11 * detail.trailMul, SIGNAL.dark, 0.06);
      drawPolyline(traj, chainSeg, 5.8 * detail.trailMul, targetColor, 0.10);
      drawPolyline(traj, chainSeg, 2.4, SIGNAL.core, 0.16);
      for (var i = 0; i < count; i++) {
        var along = travel - i * spacing;
        if (along < 0 || along > route.total) continue;
        var headD = route.total - along;
        var laneOffset = Math.sin(i * 0.8 + elapsed * 2.4) * 2.2;
        var tailD = Math.min(route.total, headD + 58);
        var packetSeg = buildRouteSegment(route, tailD, headD, Math.max(4, detail.routeSamples - 2), laneOffset);
        drawPolyline(traj, packetSeg, 8 * detail.trailMul, SIGNAL.glow, 0.10);
        drawPolyline(traj, packetSeg, 3.4, targetColor, 0.20);
        drawPolyline(traj, packetSeg, 1.4, SIGNAL.core, 0.24);
        var packet = sampleRoute(route, headD);
        var perpX = -Math.sin(packet.angle || 0);
        var perpY = Math.cos(packet.angle || 0);
        packet.x += perpX * laneOffset;
        packet.y += perpY * laneOffset;
        drawEnergyPacket(gfx, packet, 7.8, 1, targetColor);
      }
    }

    if (elapsed > signalDuration + drainDuration) {
      var finishT = clamp01((elapsed - signalDuration - drainDuration) / finishDuration);
      var ringR = 24 + easeOutCubic(finishT) * 34;
      overlay.lineStyle(4 - finishT * 2.2, SIGNAL.glow, 0.22 * (1 - finishT));
      overlay.drawCircle(effect.startX || 0, effect.startY || 0, ringR);
      overlay.lineStyle(2, SIGNAL.edge, 0.28 * (1 - finishT));
      overlay.drawCircle(effect.startX || 0, effect.startY || 0, ringR * 0.74);
    }
  }

  function drawBurstSource(g, point, elapsed, detail) {
    var pulse = 0.5 + 0.5 * Math.sin(elapsed * 7);
    drawCoreAura(g, point.x, point.y, 28 + pulse * 10, GOLD.glow, 0.18 * detail.haloMul);
    for (var i = 0; i < 5; i++) {
      var ang = -0.8 + i * 0.40 + Math.sin(elapsed * 3 + i) * 0.03;
      g.lineStyle(2.4, GOLD.glow, 0.18);
      g.moveTo(point.x, point.y);
      g.lineTo(point.x + Math.cos(ang) * 36, point.y + Math.sin(ang) * 36);
    }
  }

  function drawResourceSurge(effect, traj, gfx, overlay, elapsed, detail, routeInfo) {
    var route = routeInfo.route;
    var burstDuration = Math.max(0.1, effect.burstDuration || 3.7);
    var finishDuration = Math.max(0.1, effect.finishDuration || 0.60);

    drawRoutePreview(traj, route, GOLD.core, 0.12 * detail.previewAlpha, 2.6, 0);
    drawRoutePreview(traj, route, GOLD.edge, 0.08 * detail.previewAlpha, 1.6, 0);
    drawBurstSource(gfx, routeInfo.source, elapsed, detail);
    drawCoreAura(gfx, effect.targetX || 0, effect.targetY || 0, 22 + Math.sin(elapsed * 4.8) * 3, GOLD.glow, 0.10 * detail.haloMul);

    if (elapsed < burstDuration) {
      var progress = clamp01(elapsed / burstDuration);
      var ramp = smoothstep(0, 1, progress);
      var count = Math.max(8, Math.floor(16 * detail.packetCountMul));
      var spacing = 54;
      var travel = ramp * (route.total + spacing * count);
      for (var i = 0; i < count; i++) {
        var along = travel - i * spacing;
        if (along < 0 || along > route.total) continue;
        var laneOffset = Math.sin(i * 0.6) * 1.8;
        var head = sampleRoute(route, along);
        var perpX = -Math.sin(head.angle || 0);
        var perpY = Math.cos(head.angle || 0);
        head.x += perpX * laneOffset;
        head.y += perpY * laneOffset;
        var tail = Math.max(0, along - 82);
        var seg = buildRouteSegment(route, tail, along, Math.max(4, detail.routeSamples - 2), laneOffset);
        drawPolyline(traj, seg, 13 * detail.trailMul, GOLD.glow, 0.14 + ramp * 0.10);
        drawPolyline(traj, seg, 6.2, GOLD.core, 0.24 + ramp * 0.16);
        drawPolyline(traj, seg, 2.0, GOLD.edge, 0.28 + ramp * 0.14);
        drawBurstPacket(gfx, head, 7.6 + ramp * 2.2, 0.96);
      }
    }

    if (elapsed > burstDuration) {
      var finishT = clamp01((elapsed - burstDuration) / finishDuration);
      var ringR = 24 + easeOutCubic(finishT) * 32;
      overlay.lineStyle(4 - finishT * 2.2, GOLD.glow, 0.22 * (1 - finishT));
      overlay.drawCircle(effect.targetX || 0, effect.targetY || 0, ringR);
      overlay.lineStyle(1.8, GOLD.edge, 0.28 * (1 - finishT));
      overlay.drawCircle(effect.targetX || 0, effect.targetY || 0, ringR * 0.72);
    }
  }

  function renderEffect(effect, opts) {
    if (!effect || !opts || !opts.layer) return;
    var traj = ensureGraphicRef(effect, "trajGfx", opts.layer);
    var gfx = ensureGraphicRef(effect, "gfx", opts.layer);
    var overlay = ensureGraphicRef(effect, "overlayGfx", opts.layer);
    if (!traj || !gfx || !overlay) return;

    var timeSec = opts.simTimeSec || 0;
    var elapsed = Math.max(0, timeSec - (effect.spawnedAt || 0));
    var duration = Math.max(0.1, effect.duration || 3.6);
    var detail = getDetail(getZoomLevel(opts.zoom || 0.22));
    var bounds = getBounds(opts.worldWidth, opts.worldHeight);

    traj.clear();
    gfx.clear();
    overlay.clear();

    if (elapsed >= duration) return;

    if (effect.type === "energySteal") {
      drawEnergySteal(effect, traj, gfx, overlay, elapsed, detail, buildEnergyStealRoute(effect, detail, bounds));
      return;
    }

    if (effect.type === "resourceSurge") {
      drawResourceSurge(effect, traj, gfx, overlay, elapsed, detail, buildResourceSurgeRoute(effect, detail, bounds));
    }
  }

  function destroyEffect(effect) {
    destroyGraphicRef(effect, "gfx");
    destroyGraphicRef(effect, "trajGfx");
    destroyGraphicRef(effect, "overlayGfx");
  }

  var api = {
    renderEffect: renderEffect,
    destroyEffect: destroyEffect
  };

  if (typeof window !== "undefined") window.EconomyAbilityRenderer = api;
  if (typeof module !== "undefined") module.exports = api;
})();
