(function () {
  "use strict";

  var Ability = (typeof window !== "undefined" && window.SpatialRiftAbility) ? window.SpatialRiftAbility : null;
  var LODRef = (typeof window !== "undefined" && window.LOD) ? window.LOD : null;
  var TAU = Math.PI * 2;
  var MAX_TEXTURE_DIM = 1536;
  var PALETTE = {
    core: "#caa0ff",
    trim: "#f2e5ff",
    line: "#b77bff",
    dark: "#10081a",
    glow: "202,160,255",
    haze: "110,58,176"
  };

  function clamp01(v) {
    return Ability && typeof Ability.clamp01 === "function" ? Ability.clamp01(v) : Math.max(0, Math.min(1, v));
  }

  function smoothstep(a, b, v) {
    if (Ability && typeof Ability.smoothstep === "function") return Ability.smoothstep(a, b, v);
    var t = clamp01((v - a) / Math.max(0.0001, b - a));
    return t * t * (3 - 2 * t);
  }

  function rgba(rgb, alpha) {
    return "rgba(" + rgb + "," + alpha + ")";
  }

  function hexToRgb(hex) {
    var clean = String(hex || "#000000").replace("#", "");
    var value = parseInt(clean, 16) || 0;
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255
    };
  }

  function rgbaHex(hex, alpha) {
    var rgb = hexToRgb(hex);
    return "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + alpha + ")";
  }

  function noise(seed) {
    var value = Math.sin(seed * 127.1 + seed * seed * 0.013) * 43758.5453123;
    return value - Math.floor(value);
  }

  function getZoomLevel(zoom) {
    if (!LODRef || typeof LODRef.getLevel !== "function" || !LODRef.LEVELS) return "near";
    var level = LODRef.getLevel(zoom || 0.22);
    if (level === LODRef.LEVELS.FAR) return "far";
    if (level === LODRef.LEVELS.MID) return "mid";
    return "near";
  }

  function getLodSpec(level) {
    if (level === "far") return { tendrils: 0.60, debris: 0.60, inner: 0.60, sparks: 0.55, collapseStride: 2 };
    if (level === "mid") return { tendrils: 0.82, debris: 0.82, inner: 0.80, sparks: 0.80, collapseStride: 1 };
    return { tendrils: 1.00, debris: 1.00, inner: 1.00, sparks: 1.00, collapseStride: 1 };
  }

  function getResolutionForZoom(zoom) {
    var level = getZoomLevel(zoom);
    if (level === "far") return 0.55;
    if (level === "mid") return 0.78;
    return 0.95;
  }

  function fitResolutionToBounds(bounds, resolution) {
    var baseW = Math.max(1, Math.ceil(bounds.width * resolution));
    var baseH = Math.max(1, Math.ceil(bounds.height * resolution));
    if (baseW <= MAX_TEXTURE_DIM && baseH <= MAX_TEXTURE_DIM) return resolution;
    var scaleDown = Math.min(MAX_TEXTURE_DIM / baseW, MAX_TEXTURE_DIM / baseH);
    return Math.max(0.35, resolution * scaleDown);
  }

  function updateTexture(texture) {
    if (!texture) return;
    if (texture.source && typeof texture.source.update === "function") texture.source.update();
    else if (typeof texture.update === "function") texture.update();
  }

  function destroyVisual(owner, key) {
    if (!owner || !owner[key]) return;
    var visual = owner[key];
    if (visual.sprite && !visual.sprite.destroyed) {
      if (visual.sprite.parent) visual.sprite.parent.removeChild(visual.sprite);
      visual.sprite.destroy();
    }
    owner[key] = null;
  }

  function ensureVisual(owner, key, layer, bounds, resolution, zIndex) {
    if (!owner) return null;
    var visual = owner[key];
    var fittedResolution = fitResolutionToBounds(bounds, resolution);
    var targetW = Math.max(1, Math.ceil(bounds.width * fittedResolution));
    var targetH = Math.max(1, Math.ceil(bounds.height * fittedResolution));
    if (
      !visual ||
      !visual.canvas ||
      !visual.ctx ||
      !visual.texture ||
      !visual.sprite ||
      visual.sprite.destroyed ||
      visual.canvas.width !== targetW ||
      visual.canvas.height !== targetH
    ) {
      destroyVisual(owner, key);
      visual = {
        canvas: document.createElement("canvas"),
        ctx: null,
        texture: null,
        sprite: null,
        bounds: null,
        resolution: fittedResolution
      };
      visual.canvas.width = targetW;
      visual.canvas.height = targetH;
      visual.ctx = visual.canvas.getContext("2d");
      if (visual.ctx) visual.ctx.imageSmoothingEnabled = true;
      visual.texture = PIXI.Texture.from(visual.canvas);
      visual.sprite = new PIXI.Sprite(visual.texture);
      visual.sprite.anchor.set(0, 0);
      visual.sprite.eventMode = "none";
      visual.sprite.roundPixels = false;
      if (zIndex != null) visual.sprite.zIndex = zIndex;
      owner[key] = visual;
      if (layer) layer.addChild(visual.sprite);
    } else if (layer && visual.sprite.parent !== layer) {
      layer.addChild(visual.sprite);
    }

    visual.bounds = bounds;
    visual.resolution = fittedResolution;
    visual.sprite.visible = true;
    visual.sprite.position.set(bounds.left, bounds.top);
    visual.sprite.width = bounds.width;
    visual.sprite.height = bounds.height;
    return visual;
  }

  function clearVisual(visual) {
    if (!visual || !visual.ctx || !visual.canvas) return;
    visual.ctx.setTransform(1, 0, 0, 1, 0, 0);
    visual.ctx.clearRect(0, 0, visual.canvas.width, visual.canvas.height);
    visual.ctx.setTransform(
      visual.resolution,
      0,
      0,
      visual.resolution,
      -visual.bounds.left * visual.resolution,
      -visual.bounds.top * visual.resolution
    );
  }

  function drawGlowDisc(ctx, x, y, radius, rgb, alpha) {
    var grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, rgba(rgb, alpha));
    grad.addColorStop(0.45, rgba(rgb, alpha * 0.35));
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }

  function tracePolygon(ctx, points) {
    if (!points || !points.length) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
  }

  function strokeLineFaded(ctx, points, lineWidth, color, alpha, isHex) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = lineWidth;
    for (var i = 0; i < points.length - 1; i++) {
      var fade = Ability.getEndFade((points[i].t + points[i + 1].t) * 0.5);
      if (fade <= 0.002) continue;
      ctx.beginPath();
      ctx.strokeStyle = isHex ? rgbaHex(color, alpha * fade) : rgba(color, alpha * fade);
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i + 1].x, points[i + 1].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function strokeLineAnimated(ctx, points, lineWidth, color, alpha, isHex, timeline) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = lineWidth;
    for (var i = 0; i < points.length - 1; i++) {
      var t = (points[i].t + points[i + 1].t) * 0.5;
      var fade = Ability.getEndFade(t);
      var life = Ability.getRiftSegmentAlpha(t, timeline);
      if (fade * life <= 0.002) continue;
      ctx.beginPath();
      ctx.strokeStyle = isHex ? rgbaHex(color, alpha * fade * life) : rgba(color, alpha * fade * life);
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i + 1].x, points[i + 1].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParallelInterior(ctx, runtime, palette, lodSpec, animTimeSec) {
    var wound = runtime.wound;
    var timeline = runtime.timeline;
    var variant = runtime.variant;
    var b = wound.bounds;
    var bodyAlpha = Math.max(0, timeline.activeK * (0.70 + timeline.pulseK * 0.45));

    ctx.save();
    tracePolygon(ctx, wound.polygon);
    ctx.clip();

    var g = ctx.createLinearGradient(b.minX, b.minY, b.maxX, b.maxY);
    g.addColorStop(0, "rgba(6,8,16," + (0.86 * bodyAlpha) + ")");
    g.addColorStop(0.30, rgba(palette.haze, 0.18 * bodyAlpha));
    g.addColorStop(0.50, "rgba(10,12,26," + (0.96 * bodyAlpha) + ")");
    g.addColorStop(0.72, rgba(palette.haze, 0.16 * bodyAlpha));
    g.addColorStop(1, "rgba(6,8,16," + (0.86 * bodyAlpha) + ")");
    ctx.fillStyle = g;
    ctx.fillRect(b.minX - 24, b.minY - 24, (b.maxX - b.minX) + 48, (b.maxY - b.minY) + 48);

    for (var i = 0; i < 5; i++) {
      var cx = b.minX + (b.maxX - b.minX) * noise(i * 7.3 + variant.widthMul * 11);
      var cy = b.minY + (b.maxY - b.minY) * noise(i * 5.1 + 14.2);
      var rx = (b.maxX - b.minX) * (0.12 + noise(i * 4.9 + 3.8) * 0.18);
      var ry = (b.maxY - b.minY) * (0.16 + noise(i * 6.7 + 9.2) * 0.20);
      var cloud = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
      cloud.addColorStop(0, rgba(palette.haze, 0.12 * bodyAlpha));
      cloud.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cloud;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, noise(i * 2.7) * TAU, 0, TAU);
      ctx.fill();
    }

    var starCount = Math.max(18, Math.round(runtime.variant.innerStars * lodSpec.inner));
    for (var s = 0; s < starCount; s++) {
      var seed = s * 8.37 + variant.widthMul * 19;
      var x = b.minX + (b.maxX - b.minX) * noise(seed + 0.6);
      var y = b.minY + (b.maxY - b.minY) * noise(seed + 2.1);
      var dx = Math.sin(animTimeSec * (0.18 + noise(seed + 3.2) * 0.22) + seed) * 4;
      var dy = Math.cos(animTimeSec * (0.16 + noise(seed + 4.8) * 0.20) + seed) * 3;
      var r = 0.6 + noise(seed + 5.5) * 1.5;
      var alpha = 0.12 + noise(seed + 6.9) * 0.26;
      ctx.beginPath();
      ctx.fillStyle = "rgba(228,238,255," + (alpha * bodyAlpha) + ")";
      ctx.arc(x + dx, y + dy, r, 0, TAU);
      ctx.fill();
    }

    for (var j = 0; j < 5; j++) {
      var seed2 = j * 11.4 + variant.tendrils;
      var x0 = b.minX + (b.maxX - b.minX) * noise(seed2 + 1.0);
      var y0 = b.minY + (b.maxY - b.minY) * noise(seed2 + 2.4);
      var x1 = x0 + (noise(seed2 + 4.2) - 0.5) * (b.maxX - b.minX) * 0.8;
      var y1 = y0 + (noise(seed2 + 6.3) - 0.5) * (b.maxY - b.minY) * 0.6;
      var grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(0.5, rgba(palette.glow, (0.10 + timeline.activeK * 0.06) * bodyAlpha));
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.0 + noise(seed2 + 8.1) * 1.4;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) * 0.5 + (noise(seed2 + 9.2) - 0.5) * 24, (y0 + y1) * 0.5 + (noise(seed2 + 10.2) - 0.5) * 24, x1, y1);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawWoundEdges(ctx, runtime, palette) {
    var wound = runtime.wound;
    var timeline = runtime.timeline;
    var variant = runtime.variant;
    var pulse = 1 + timeline.pulseK * 0.55 + timeline.flashK * 0.30;
    var haloAlpha = 0.12 + timeline.activeK * 0.12 + timeline.pulseK * 0.10;
    var coreAlpha = 0.18 + timeline.activeK * 0.10 + timeline.pulseK * 0.08;
    var edgeAlpha = 0.72 + timeline.activeK * 0.14 + timeline.pulseK * 0.14;

    strokeLineAnimated(ctx, wound.centerline, 34 * variant.haloMul * pulse, palette.glow, haloAlpha, false, timeline);
    strokeLineAnimated(ctx, wound.centerline, 22 * variant.haloMul * pulse, palette.line, 0.10 + timeline.activeK * 0.08 + timeline.pulseK * 0.08, true, timeline);
    strokeLineAnimated(ctx, wound.left, 3.0, palette.trim, edgeAlpha, true, timeline);
    strokeLineAnimated(ctx, wound.right, 3.0, palette.trim, edgeAlpha, true, timeline);
    strokeLineAnimated(ctx, wound.left, 1.2, palette.line, 0.46 + timeline.activeK * 0.10 + timeline.pulseK * 0.08, true, timeline);
    strokeLineAnimated(ctx, wound.right, 1.2, palette.line, 0.46 + timeline.activeK * 0.10 + timeline.pulseK * 0.08, true, timeline);
    strokeLineAnimated(ctx, wound.centerline, 10 * variant.widthMul, "0,0,0", 0.84 + timeline.activeK * 0.06, false, timeline);
    strokeLineAnimated(ctx, wound.centerline, 2.0, palette.core, coreAlpha, true, timeline);
  }

  function drawSpaceFabricTendrils(ctx, runtime, palette, lodSpec) {
    var wound = runtime.wound;
    var timeline = runtime.timeline;
    var variant = runtime.variant;
    var count = Math.max(4, Math.round(variant.tendrils * lodSpec.tendrils));
    for (var i = 0; i < count; i++) {
      var frac = 0.08 + (i / Math.max(1, count - 1)) * 0.84 + (noise(i * 2.1 + variant.widthMul) - 0.5) * 0.03;
      frac = clamp01(frac);
      var p = Ability.getLinePoint(wound.centerline, frac);
      var tangent = Ability.getLineTangent(wound.centerline, frac);
      var nx = -tangent.y;
      var ny = tangent.x;
      var side = i % 2 === 0 ? 1 : -1;
      var fade = Ability.getEndFade(frac);
      var startDist = 24 + noise(i * 5.7 + 1.3) * 42;
      var curl = 18 + noise(i * 7.1 + 2.8) * 34;
      var startX = p.x + nx * startDist * side + tangent.x * curl * 0.20;
      var startY = p.y + ny * startDist * side + tangent.y * curl * 0.20;
      var cp1X = p.x + nx * startDist * side * 0.76 + tangent.x * curl;
      var cp1Y = p.y + ny * startDist * side * 0.76 + tangent.y * curl;
      var cp2X = p.x + nx * 7 * side - tangent.x * 12;
      var cp2Y = p.y + ny * 7 * side - tangent.y * 12;
      ctx.beginPath();
      ctx.strokeStyle = rgbaHex(palette.line, fade * Ability.getRiftSegmentAlpha(frac, timeline) * (0.08 + timeline.activeK * 0.12 + timeline.pulseK * 0.08));
      ctx.lineWidth = 1.0 + noise(i * 6.1) * 1.4;
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, p.x, p.y);
      ctx.stroke();
    }
  }

  function drawDebrisInflow(ctx, runtime, palette, lodSpec, animTimeSec) {
    var wound = runtime.wound;
    var timeline = runtime.timeline;
    var variant = runtime.variant;
    var count = Math.max(12, Math.round(variant.debris * lodSpec.debris));
    for (var i = 0; i < count; i++) {
      var seed = i * 9.71 + variant.widthMul * 15;
      var frac = (noise(seed + 1.3) + animTimeSec * (0.06 + noise(seed + 4.2) * 0.06)) % 1;
      var pull = ((animTimeSec * (0.28 + noise(seed + 5.8) * 0.18)) + noise(seed + 7.1)) % 1;
      var anchor = Ability.getLinePoint(wound.centerline, frac);
      var tangent = Ability.getLineTangent(wound.centerline, frac);
      var nx = -tangent.y;
      var ny = tangent.x;
      var side = noise(seed + 8.2) > 0.5 ? 1 : -1;
      var outerDist = 34 + noise(seed + 9.8) * 92;
      var innerDist = 4 + noise(seed + 10.4) * 10;
      var eased = smoothstep(0, 1, pull);
      var curDist = outerDist + (innerDist - outerDist) * eased;
      var prevDist = outerDist + (innerDist - outerDist) * Math.max(0, eased - 0.12);
      var drift = (noise(seed + 12.2) - 0.5) * 16;
      var px = anchor.x + nx * curDist * side + tangent.x * drift;
      var py = anchor.y + ny * curDist * side + tangent.y * drift;
      var prevX = anchor.x + nx * prevDist * side + tangent.x * drift * 0.82;
      var prevY = anchor.y + ny * prevDist * side + tangent.y * drift * 0.82;
      var alpha = Ability.getEndFade(frac) * Ability.getRiftSegmentAlpha(frac, timeline) * (0.10 + (1 - pull) * 0.24);
      var ang = Math.atan2(anchor.y - py, anchor.x - px);

      ctx.beginPath();
      ctx.strokeStyle = rgbaHex(palette.line, alpha);
      ctx.lineWidth = 1.0;
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(px, py);
      ctx.stroke();

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.fillStyle = "rgba(232,238,248," + (alpha * 0.86) + ")";
      ctx.moveTo(2.5, 0);
      ctx.lineTo(-1.8, -1.2);
      ctx.lineTo(-1.8, 1.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.fillStyle = "rgba(228,238,255," + (alpha * 0.68) + ")";
      ctx.arc(px, py, 0.7 + noise(seed + 14.1) * 1.7, 0, TAU);
      ctx.fill();
    }
  }

  function drawRiftParticles(ctx, runtime, palette, lodSpec, animTimeSec) {
    var wound = runtime.wound;
    var timeline = runtime.timeline;
    var variant = runtime.variant;
    var count = Math.max(5, Math.round((5 + variant.sparkMul * 4) * lodSpec.sparks));
    for (var i = 0; i < count; i++) {
      var seed = i * 13.7 + variant.haloMul * 8.9;
      var frac = ((animTimeSec * (0.10 + noise(seed) * 0.10)) + noise(seed + 1.2)) % 1;
      var p = Ability.getLinePoint(wound.centerline, frac);
      var tangent = Ability.getLineTangent(wound.centerline, frac);
      var nx = -tangent.y;
      var ny = tangent.x;
      var side = noise(seed + 2.3) > 0.5 ? 1 : -1;
      var dist = 8 + noise(seed + 4.9) * 14;
      var px = p.x + nx * dist * side;
      var py = p.y + ny * dist * side;
      var burstLen = 8 + noise(seed + 5.2) * 18 + timeline.flashK * 10;
      ctx.beginPath();
      ctx.strokeStyle = rgbaHex(palette.trim, Ability.getEndFade(frac) * Ability.getRiftSegmentAlpha(frac, timeline) * (0.18 + timeline.activeK * 0.28 + timeline.flashK * 0.18 + timeline.pulseK * 0.10));
      ctx.lineWidth = 1.3;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(px + nx * burstLen * 0.35 * side, py + ny * burstLen * 0.35 * side);
      ctx.stroke();
      drawGlowDisc(ctx, px, py, 8 + noise(seed + 7.1) * 10, palette.glow, 0.10 + timeline.activeK * 0.12);
    }
  }

  function drawEndSparks(ctx, runtime, palette) {
    var wound = runtime.wound;
    var timeline = runtime.timeline;
    var variant = runtime.variant;
    var ends = [wound.centerline[0], wound.centerline[wound.centerline.length - 1]];
    var tangents = [
      Ability.getLineTangent(wound.centerline, 0.02),
      Ability.getLineTangent(wound.centerline, 0.98)
    ];
    for (var e = 0; e < ends.length; e++) {
      var pt = ends[e];
      var tan = tangents[e];
      var dir = e === 0 ? -1 : 1;
      drawGlowDisc(ctx, pt.x, pt.y, 18 * variant.sparkMul, palette.glow, 0.08 + timeline.activeK * 0.10 + timeline.pulseK * 0.10);
      for (var i = 0; i < 6; i++) {
        var spread = (i - 2.5) * 0.20;
        var ang = Math.atan2(tan.y, tan.x) + Math.PI * spread;
        var len = (10 + i * 4) * variant.sparkMul;
        ctx.beginPath();
        ctx.strokeStyle = rgbaHex(palette.trim, 0.18 + timeline.activeK * 0.24 + timeline.pulseK * 0.16);
        ctx.lineWidth = 1.0;
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x + Math.cos(ang) * len * dir, pt.y + Math.sin(ang) * len * dir);
        ctx.stroke();
      }
    }
  }

  function drawTravelSpark(ctx, runtime, palette, t, alphaMul, sizeMul) {
    var wound = runtime.wound;
    var p = Ability.getLinePoint(wound.centerline, t);
    var tangent = Ability.getLineTangent(wound.centerline, t);
    var ang = Math.atan2(tangent.y, tangent.x);
    drawGlowDisc(ctx, p.x, p.y, 20 * sizeMul, palette.glow, 0.14 * alphaMul);
    drawGlowDisc(ctx, p.x, p.y, 10 * sizeMul, palette.glow, 0.22 * alphaMul);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    var grad = ctx.createLinearGradient(-26 * sizeMul, 0, 12 * sizeMul, 0);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.38, rgbaHex(palette.line, 0.10 * alphaMul));
    grad.addColorStop(1, rgbaHex(palette.trim, 0.72 * alphaMul));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.2 * sizeMul;
    ctx.beginPath();
    ctx.moveTo(-26 * sizeMul, 0);
    ctx.lineTo(10 * sizeMul, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawFormationPass(ctx, runtime, palette) {
    var timeline = runtime.timeline;
    if (timeline.openSparkK > 0.001) {
      strokeLineFaded(ctx, runtime.wound.centerline, 6.0, palette.line, 0.08 + timeline.openSparkK * 0.16, true);
      drawTravelSpark(ctx, runtime, palette, timeline.openSparkT, 0.70 + timeline.openSparkK * 0.30, 1.0);
    }
    if (timeline.closeSparkK > 0.001) {
      strokeLineFaded(ctx, runtime.wound.centerline, 6.0, palette.line, 0.06 + timeline.closeSparkK * 0.14, true);
      drawTravelSpark(ctx, runtime, palette, timeline.closeSparkT, 0.76 + timeline.closeSparkK * 0.34, 1.08);
    }
  }

  function drawCollapseGuides(ctx, effect, alpha, dashed, stride) {
    var nodes = Array.isArray(effect && effect.collapseNodes) ? effect.collapseNodes : [];
    if (!nodes.length) return;
    ctx.save();
    if (dashed) ctx.setLineDash([12, 10]);
    ctx.lineWidth = 1.2;
    for (var i = 0; i < nodes.length; i += Math.max(1, stride || 1)) {
      var node = nodes[i];
      var fade = Ability.getEndFade(node.t);
      ctx.beginPath();
      ctx.strokeStyle = rgbaHex(PALETTE.line, alpha * fade);
      ctx.arc(node.x, node.y, node.radius, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = rgbaHex(PALETTE.trim, alpha * 0.65 * fade);
      ctx.arc(node.x, node.y, 3.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCollapse(ctx, effect, runtime, palette, animTimeSec, lodSpec) {
    var timeline = runtime.timeline;
    if (timeline.foldK <= 0.01) return;
    var nodes = Array.isArray(effect && effect.collapseNodes) ? effect.collapseNodes : [];
    for (var i = 0; i < nodes.length; i += Math.max(1, lodSpec.collapseStride || 1)) {
      var node = nodes[i];
      var fade = Ability.getEndFade(node.t);
      var radius = node.radius || effect.radius || 120;
      drawGlowDisc(ctx, node.x, node.y, radius * (0.84 + timeline.flashK * 0.26), palette.glow, fade * (0.06 + timeline.flashK * 0.12));
      ctx.beginPath();
      ctx.strokeStyle = rgbaHex(palette.line, fade * (0.10 + timeline.flashK * 0.18));
      ctx.lineWidth = 1.3;
      ctx.arc(node.x, node.y, radius * (0.88 + timeline.foldK * 0.08), 0, TAU);
      ctx.stroke();

      var spokeCount = lodSpec.collapseStride > 1 ? 4 : 6;
      for (var s = 0; s < spokeCount; s++) {
        var ang = (s / spokeCount) * TAU + animTimeSec * 0.18 + i * 0.11;
        var outer = radius * (0.90 + Math.sin(animTimeSec * 0.8 + i + s) * 0.02);
        var inner = radius * (0.10 + timeline.foldK * 0.38);
        ctx.beginPath();
        ctx.strokeStyle = rgbaHex(palette.line, fade * (0.08 + timeline.flashK * 0.18));
        ctx.lineWidth = 1.0;
        ctx.moveTo(node.x + Math.cos(ang) * outer, node.y + Math.sin(ang) * outer);
        ctx.lineTo(node.x + Math.cos(ang) * inner, node.y + Math.sin(ang) * inner);
        ctx.stroke();
      }
    }
  }

  function renderStack(ctx, effect, runtime, animTimeSec, lodSpec) {
    drawFormationPass(ctx, runtime, PALETTE);
    drawSpaceFabricTendrils(ctx, runtime, PALETTE, lodSpec);
    drawParallelInterior(ctx, runtime, PALETTE, lodSpec, animTimeSec);
    drawWoundEdges(ctx, runtime, PALETTE);
    drawDebrisInflow(ctx, runtime, PALETTE, lodSpec, animTimeSec);
    drawRiftParticles(ctx, runtime, PALETTE, lodSpec, animTimeSec);
    drawEndSparks(ctx, runtime, PALETTE);
    drawCollapse(ctx, effect, runtime, PALETTE, animTimeSec, lodSpec);
  }

  function buildPreviewTimeline(timeSec) {
    var pulse = 0.26 + (0.5 + 0.5 * Math.sin(timeSec * 2.0)) * 0.26;
    return {
      openSparkT: 1,
      openSparkK: 0,
      openRevealT: 1,
      openK: 1,
      activeK: 1,
      pulseK: pulse,
      closeSparkT: 1,
      closeSparkK: 0,
      foldK: 0,
      flashK: 0
    };
  }

  function renderZone(zone, opts) {
    if (!zone || !opts || !opts.layer || !Ability) return;
    var visible = opts.visible !== false;
    var bounds = zone.renderBounds || Ability.getRenderBounds(Ability.buildGeom(zone.x, zone.y, zone.angle, zone.radius, zone.length), zone.radius, Ability.VARIANT);
    var resolution = getResolutionForZoom(opts.zoom || 0.22);
    var visual = ensureVisual(zone, "gfx", opts.layer, bounds, resolution, 30);
    if (!visual) return;
    visual.sprite.visible = visible;
    if (!visible) return;

    var elapsed = Math.max(0, (opts.simTimeSec || 0) - (zone.spawnedAt || 0));
    var runtime = Ability.buildRuntime(zone, elapsed);
    if (runtime.timeline.activeK <= 0.001 && runtime.timeline.closeSparkK <= 0.001 && runtime.timeline.foldK <= 0.001 && elapsed > 0.2) {
      visual.sprite.visible = false;
      return;
    }

    clearVisual(visual);
    renderStack(visual.ctx, zone, runtime, opts.animTimeSec || opts.simTimeSec || 0, getLodSpec(getZoomLevel(opts.zoom || 0.22)));
    updateTexture(visual.texture);
  }

  function renderPointPreview(ctx, preview, timeSec) {
    drawGlowDisc(ctx, preview.x, preview.y, preview.radius * 0.34, PALETTE.glow, 0.10);
    drawGlowDisc(ctx, preview.x, preview.y, preview.radius * 0.18, PALETTE.glow, 0.16);
    for (var i = 0; i < 10; i++) {
      var ang = (i / 10) * TAU + timeSec * 0.35;
      var inner = preview.radius * 0.12;
      var outer = preview.radius * (0.32 + (i % 2) * 0.08);
      ctx.beginPath();
      ctx.strokeStyle = rgbaHex(PALETTE.trim, 0.20 + (i % 2) * 0.08);
      ctx.lineWidth = 1.2;
      ctx.moveTo(preview.x + Math.cos(ang) * inner, preview.y + Math.sin(ang) * inner);
      ctx.lineTo(preview.x + Math.cos(ang) * outer, preview.y + Math.sin(ang) * outer);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.strokeStyle = rgbaHex(PALETTE.line, 0.34);
    ctx.lineWidth = 2.0;
    ctx.arc(preview.x, preview.y, preview.radius * 0.22, 0, TAU);
    ctx.stroke();
  }

  function renderPreview(host, preview, opts) {
    if (!host || !preview || !opts || !opts.layer || !Ability) return;
    var zoom = opts.zoom || 0.22;
    var resolution = getResolutionForZoom(zoom);
    var bounds;
    if (preview.phase === "point") {
      bounds = {
        left: preview.x - preview.radius * 1.2,
        top: preview.y - preview.radius * 1.2,
        width: preview.radius * 2.4,
        height: preview.radius * 2.4
      };
    } else {
      var previewEffect = Ability.buildEffect(preview.x, preview.y, preview.angle || 0, 0, {
        radius: preview.radius,
        length: preview.length
      });
      bounds = previewEffect.renderBounds;
      host._spatialRiftPreviewEffect = previewEffect;
    }

    var visual = ensureVisual(host, "_spatialRiftPreview", opts.layer, bounds, resolution, 35);
    if (!visual) return;
    visual.sprite.visible = true;
    clearVisual(visual);

    if (preview.phase === "point") {
      renderPointPreview(visual.ctx, preview, opts.timeSec || 0);
      updateTexture(visual.texture);
      return;
    }

    var geom = Ability.buildGeom(preview.x, preview.y, preview.angle || 0, preview.radius, preview.length);
    var runtime = {
      geom: geom,
      timeline: buildPreviewTimeline(opts.timeSec || 0),
      wound: Ability.buildWoundGeometry(geom, Ability.VARIANT, buildPreviewTimeline(opts.timeSec || 0)),
      variant: Ability.VARIANT
    };

    renderStack(visual.ctx, host._spatialRiftPreviewEffect, runtime, opts.timeSec || 0, getLodSpec(getZoomLevel(zoom)));
    drawCollapseGuides(visual.ctx, host._spatialRiftPreviewEffect, 0.12 + (0.5 + 0.5 * Math.sin((opts.timeSec || 0) * 2.0)) * 0.12, true, getZoomLevel(zoom) === "far" ? 2 : 1);
    updateTexture(visual.texture);
  }

  function hidePreview(host) {
    if (host && host._spatialRiftPreview && host._spatialRiftPreview.sprite) host._spatialRiftPreview.sprite.visible = false;
  }

  function destroyPreview(host) {
    if (!host) return;
    destroyVisual(host, "_spatialRiftPreview");
    host._spatialRiftPreviewEffect = null;
  }

  function destroyZone(zone) {
    destroyVisual(zone, "gfx");
  }

  var api = {
    STYLE_KEY: Ability ? Ability.STYLE_KEY : "parallax-gash",
    PALETTE_KEY: Ability ? Ability.PALETTE_KEY : "violet",
    renderZone: renderZone,
    renderPreview: renderPreview,
    hidePreview: hidePreview,
    destroyPreview: destroyPreview,
    destroyZone: destroyZone
  };

  if (typeof window !== "undefined") window.SpatialRiftRenderer = api;
  if (typeof module !== "undefined") module.exports = api;
})();
