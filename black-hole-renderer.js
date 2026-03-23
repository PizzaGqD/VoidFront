/**
 * BlackHoleRenderer — visual-only renderer for black hole abilities.
 * Uses the approved VFX_LAB directions directly in-game:
 * - blackHole => Event Horizon Bloom
 * - microBlackHole => Blood Meridian
 */
(function () {
  "use strict";

  var LODRef = (typeof window !== "undefined" && window.LOD) ? window.LOD : null;
  var TAU = Math.PI * 2;
  var DEFAULT_STYLE_KEY = "event-horizon-bloom";
  var MICRO_STYLE_KEY = "blood-meridian";

  var STYLE_DEFS = {
    "event-horizon-bloom": {
      key: "event-horizon-bloom",
      accent: "#8a73ff",
      shell: "bloom",
      shardMode: "petal",
      ringTilt: 0.46,
      halo: "122,92,255",
      rim: "222,206,255",
      core: "10,8,22",
      hot: "255,248,255",
      flash: "231,222,255",
      ember: "132,106,255",
      extentMul: 5.6
    },
    "blood-meridian": {
      key: "blood-meridian",
      accent: "#d64f64",
      shell: "maelstrom",
      shardMode: "ember",
      ringTilt: 0.58,
      halo: "226,72,102",
      rim: "255,214,220",
      core: "18,4,8",
      hot: "255,242,224",
      flash: "255,190,198",
      ember: "255,104,76",
      extentMul: 5.2
    }
  };

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(a, b, v) {
    if (a === b) return v >= b ? 1 : 0;
    var t = clamp01((v - a) / Math.max(0.0001, b - a));
    return t * t * (3 - 2 * t);
  }

  function easeOutCubic(v) {
    var t = clamp01(v);
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInCubic(v) {
    var t = clamp01(v);
    return t * t * t;
  }

  function rgba(rgb, alpha) {
    return "rgba(" + rgb + "," + alpha + ")";
  }

  function getZoomLevel(zoom) {
    return LODRef && typeof LODRef.getLevel === "function" ? LODRef.getLevel(zoom || 0.22) : "near";
  }

  function getStyle(styleKey) {
    return STYLE_DEFS[styleKey] || STYLE_DEFS[DEFAULT_STYLE_KEY];
  }

  function chooseStyleKey(styleKey, radius) {
    if (STYLE_DEFS[styleKey]) return styleKey;
    return radius != null && radius <= 170 ? MICRO_STYLE_KEY : DEFAULT_STYLE_KEY;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = seed + 0x6d2b79f5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function noise(seed) {
    var x = Math.sin(seed * 127.1 + seed * seed * 0.019) * 43758.5453123;
    return x - Math.floor(x);
  }

  function levelForZoom(zoom) {
    return getZoomLevel(zoom || 0.22);
  }

  function getDetailSpec(level, zoom, isRemote, radius, extentMul) {
    var nearZoom = zoom || 0.22;
    var dpr = Math.min((typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1, 2);
    var visualExtentMul = extentMul || 5.4;
    var projectedPx = Math.max(128, (radius || 0) * visualExtentMul * 2 * nearZoom * dpr);
    var size = 640;
    var fps = 24;
    var shellCount = 10;
    var shardCount = 34;
    var ringCount = 5;
    if (level === "mid") {
      size = 416;
      fps = 18;
      shellCount = 8;
      shardCount = 24;
      ringCount = 4;
    } else if (level === "far") {
      size = 256;
      fps = 12;
      shellCount = 6;
      shardCount = 14;
      ringCount = 3;
    } else if (nearZoom >= 0.9) {
      size = 704;
      fps = 28;
      shellCount = 12;
      shardCount = 42;
      ringCount = 6;
    }
    var targetFromScreen = projectedPx * (level === "far" ? 0.75 : level === "mid" ? 0.95 : 1.18);
    size = Math.max(size, Math.round(targetFromScreen));
    if (isRemote) {
      size = Math.max(224, Math.round(size * 0.82));
      fps = Math.max(10, Math.round(fps * 0.82));
      shellCount = Math.max(5, Math.round(shellCount * 0.82));
      shardCount = Math.max(12, Math.round(shardCount * 0.78));
      ringCount = Math.max(3, Math.round(ringCount * 0.8));
    }
    if ((radius || 0) <= 170) {
      size = Math.max(256, Math.round(size * 0.92));
      shardCount = Math.max(10, Math.round(shardCount * 0.88));
    }
    var maxSize = level === "far" ? 640 : level === "mid" ? 1024 : 1600;
    if (nearZoom >= 0.95 && !isRemote) maxSize = 2048;
    if (isRemote) maxSize = Math.min(maxSize, 1152);
    size = Math.min(maxSize, size);
    if (size >= 1700) fps = Math.min(fps, 18);
    else if (size >= 1300) fps = Math.min(fps, 20);
    return {
      size: size,
      fps: fps,
      shellCount: shellCount,
      shardCount: shardCount,
      ringCount: ringCount
    };
  }

  function buildTimeline(elapsed, cfg) {
    var castDuration = Math.max(0.05, cfg.growthTime || 0.9);
    var holdDuration = Math.max(0, cfg.holdTime || 0);
    var collapseDuration = Math.max(0.05, cfg.fadeTime || 1.4);
    var total = castDuration + holdDuration + collapseDuration;
    var local = Math.max(0, Math.min(elapsed, total));
    var castT = 0;
    var holdT = 0;
    var collapseT = 0;
    var stage = "cast";

    if (local < castDuration) {
      stage = "cast";
      castT = local / castDuration;
    } else if (local < castDuration + holdDuration) {
      stage = "sustain";
      holdT = holdDuration <= 0 ? 1 : (local - castDuration) / holdDuration;
    } else {
      stage = "collapse";
      collapseT = (local - castDuration - holdDuration) / collapseDuration;
    }

    var openK = 0;
    if (stage === "cast") {
      openK = easeOutCubic(smoothstep(0.12, 0.82, castT));
    } else if (stage === "sustain") {
      openK = 1;
    } else {
      openK = 1 - easeInCubic(smoothstep(0.12, 0.90, collapseT));
    }

    var effectK = 0;
    if (stage === "cast") {
      effectK = easeOutCubic(smoothstep(0.24, 0.92, castT));
    } else if (stage === "sustain") {
      effectK = 1;
    } else {
      effectK = 1 - easeInCubic(smoothstep(0.02, 0.72, collapseT));
    }

    var pointK = 0;
    if (stage === "cast") {
      pointK = 1 - smoothstep(0.08, 0.44, castT);
    } else if (stage === "collapse") {
      pointK = smoothstep(0.68, 0.98, collapseT);
    }

    var castFlash = stage === "cast" ? (1 - smoothstep(0.03, 0.24, castT)) * 1.15 : 0;
    var castRing = stage === "cast" ? smoothstep(0.10, 0.34, castT) * (1 - smoothstep(0.42, 0.70, castT)) : 0;
    var holdPulse = 0.5 + 0.5 * Math.sin(elapsed * 2.2);
    var collapseFlash = stage === "collapse" ? smoothstep(0.72, 0.90, collapseT) * (1 - smoothstep(0.94, 1.00, collapseT)) * 1.45 : 0;
    var collapseRing = stage === "collapse" ? smoothstep(0.78, 0.92, collapseT) * (1 - smoothstep(0.95, 1.00, collapseT)) : 0;
    var implodeK = stage === "collapse" ? smoothstep(0.18, 1.00, collapseT) : 0;
    var radiusMul = 0.035 + openK * 0.965;

    return {
      stage: stage,
      castT: castT,
      holdT: holdT,
      collapseT: collapseT,
      openK: openK,
      effectK: effectK,
      pointK: pointK,
      radiusMul: radiusMul,
      castFlash: castFlash,
      castRing: castRing,
      holdPulse: holdPulse,
      collapseFlash: collapseFlash,
      collapseRing: collapseRing,
      implodeK: implodeK,
      visibility: Math.max(effectK, pointK * 0.88, collapseFlash * 0.9)
    };
  }

  function resetVisualRefs(bh) {
    bh._bodyContainer = null;
    bh._bodySprite = null;
    bh._bodyTexture = null;
    bh._bodyCanvas = null;
    bh._bodyCtx = null;
    bh._overlayGfx = null;
  }

  function ensureFxState(bh) {
    if (bh._bhFxState) return;
    var seedBase = Math.round(((bh.x || 0) * 31 + (bh.y || 0) * 17 + (bh.spawnedAt || 0) * 1000) * 100) >>> 0;
    var rng = mulberry32(seedBase || 1);
    var shards = [];
    for (var i = 0; i < 96; i++) {
      shards.push({
        orbit: 0.88 + rng() * 1.32,
        angle: rng() * TAU,
        speed: 0.18 + rng() * 0.72,
        size: 0.5 + rng() * 1.5,
        wobble: rng() * TAU,
        lean: rng() * 2 - 1
      });
    }
    bh._bhFxState = { shards: shards };
    bh._spawnRealAt = null;
    bh._lastDrawAt = -Infinity;
    bh._lastCanvasSize = 0;
    bh._lastStage = "";
  }

  function ensureVisual(bh, layer) {
    if (bh._bodySprite && bh._bodySprite.destroyed) resetVisualRefs(bh);
    if (!bh._bodySprite || bh._bodySprite.destroyed) {
      bh._bodyCanvas = document.createElement("canvas");
      bh._bodyCanvas.width = 2;
      bh._bodyCanvas.height = 2;
      bh._bodyCtx = bh._bodyCanvas.getContext("2d");
      bh._bodyTexture = PIXI.Texture.from(bh._bodyCanvas);
      bh._bodySprite = new PIXI.Sprite(bh._bodyTexture || PIXI.Texture.EMPTY);
      bh._bodySprite.anchor.set(0.5);
      bh._bodySprite.roundPixels = false;
      layer.addChild(bh._bodySprite);
      bh._bodyContainer = bh._bodySprite;
    } else if (bh._bodySprite.parent !== layer) {
      layer.addChild(bh._bodySprite);
    }
  }

  function ensureCanvasSize(bh, size) {
    size = Math.max(2, Math.floor(size || 2));
    if (bh._bodyCanvas && bh._bodyCanvas.width === size && bh._bodyCanvas.height === size && bh._bodyCtx && bh._bodyTexture) {
      return false;
    }
    if (bh._bodyTexture && typeof bh._bodyTexture.destroy === "function") {
      bh._bodyTexture.destroy(true);
    }
    bh._bodyCanvas = document.createElement("canvas");
    bh._bodyCanvas.width = size;
    bh._bodyCanvas.height = size;
    bh._bodyCtx = bh._bodyCanvas.getContext("2d");
    if (bh._bodyCtx) bh._bodyCtx.imageSmoothingEnabled = true;
    bh._bodyTexture = PIXI.Texture.from(bh._bodyCanvas);
    if (bh._bodySprite && !bh._bodySprite.destroyed) bh._bodySprite.texture = bh._bodyTexture;
    bh._lastCanvasSize = size;
    return true;
  }

  function destroy(bh) {
    if (!bh) return;
    if (bh._bodyTexture && typeof bh._bodyTexture.destroy === "function") {
      bh._bodyTexture.destroy(true);
    }
    if (bh._bodySprite && !bh._bodySprite.destroyed) {
      bh._bodySprite.parent && bh._bodySprite.parent.removeChild(bh._bodySprite);
      bh._bodySprite.destroy({ children: true, texture: false, textureSource: false });
    }
    resetVisualRefs(bh);
  }

  function hide(bh) {
    if (!bh) return;
    if (bh._bodySprite) bh._bodySprite.visible = false;
  }

  function updateTexture(texture) {
    if (!texture) return;
    if (texture.source && typeof texture.source.update === "function") texture.source.update();
    else if (typeof texture.update === "function") texture.update();
  }

  function drawGlow(ctx, x, y, rx, ry, rgbValue, alpha, rotation) {
    if (!ctx || alpha <= 0 || rx <= 0 || ry <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation || 0);
    ctx.scale(rx, ry);
    var gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, rgba(rgbValue, alpha));
    gradient.addColorStop(0.55, rgba(rgbValue, alpha * 0.32));
    gradient.addColorStop(1, rgba(rgbValue, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawRing(ctx, x, y, radius, rgbValue, alpha, width) {
    if (!ctx || alpha <= 0 || radius <= 0 || width <= 0) return;
    ctx.save();
    ctx.lineWidth = width;
    ctx.strokeStyle = rgba(rgbValue, alpha);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawEllipseRing(ctx, x, y, rx, ry, rotation, rgbValue, alpha, width) {
    if (!ctx || alpha <= 0 || rx <= 0 || ry <= 0 || width <= 0) return;
    ctx.save();
    ctx.lineWidth = width;
    ctx.strokeStyle = rgba(rgbValue, alpha);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rotation || 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawArc(ctx, x, y, radius, start, end, rgbValue, alpha, width) {
    if (!ctx || alpha <= 0 || radius <= 0 || width <= 0) return;
    ctx.save();
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.strokeStyle = rgba(rgbValue, alpha);
    ctx.beginPath();
    ctx.arc(x, y, radius, start, end);
    ctx.stroke();
    ctx.restore();
  }

  function drawSingularitySeed(ctx, style, cx, cy, maxRadius, timeline, animTime) {
    var seedAlpha = Math.max(timeline.pointK, timeline.castFlash * 0.9, timeline.collapseFlash * 0.9);
    if (seedAlpha <= 0.001) return;
    var flashBias = Math.max(timeline.castFlash, timeline.collapseFlash);
    var dotRadius = maxRadius * (0.018 + timeline.pointK * 0.028 + flashBias * 0.012);
    var haloRadius = maxRadius * (0.18 + timeline.pointK * 0.62 + flashBias * 0.26);
    var spokeCount = 10;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    drawGlow(ctx, cx, cy, haloRadius, haloRadius, style.flash, 0.10 + seedAlpha * 0.34, 0);
    drawGlow(ctx, cx, cy, haloRadius * 1.35, haloRadius * 0.42, style.ember, 0.06 + seedAlpha * 0.20, animTime * 0.18);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = rgba(style.hot, 0.16 + seedAlpha * 0.42);
    ctx.lineWidth = Math.max(1, maxRadius * 0.010);
    ctx.lineCap = "round";
    for (var i = 0; i < spokeCount; i++) {
      var angle = (i / spokeCount) * TAU + animTime * 0.22;
      var r0 = dotRadius * 1.4;
      var r1 = haloRadius * (0.66 + 0.12 * Math.sin(animTime * 2.0 + i));
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
      ctx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = rgba(style.hot, 0.56 + seedAlpha * 0.34);
    ctx.beginPath();
    ctx.arc(cx, cy, dotRadius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawAccretionDisk(ctx, style, cx, cy, baseRadius, timeline, detail, animTime) {
    var open = timeline.openK;
    var diskRx = baseRadius * (1.70 + open * 0.28);
    var diskRy = baseRadius * (0.34 + open * 0.08);
    var tilt = style.ringTilt + animTime * 0.04;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    drawGlow(ctx, cx, cy, diskRx * 0.94, diskRy * 2.8, style.halo, 0.12 + timeline.castFlash * 0.24, tilt);
    drawGlow(ctx, cx, cy, diskRx * 0.72, diskRy * 2.0, style.ember, 0.18 + timeline.holdPulse * 0.10, tilt);
    drawGlow(ctx, cx, cy, diskRx * 0.48, diskRy * 1.4, style.flash, 0.08 + timeline.collapseFlash * 0.24, tilt);
    ctx.restore();

    for (var i = 0; i < detail.ringCount; i++) {
      var frac = detail.ringCount <= 1 ? 0 : i / (detail.ringCount - 1);
      var rx = diskRx * (0.58 + frac * 0.62);
      var ry = diskRy * (0.42 + frac * 0.64);
      drawEllipseRing(ctx, cx, cy, rx, ry, tilt + frac * 0.12, style.rim, 0.08 + frac * 0.05 + timeline.castFlash * 0.04, 1.1 + frac * 0.9);
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    var grad = ctx.createLinearGradient(-diskRx, 0, diskRx, 0);
    grad.addColorStop(0, rgba(style.ember, 0));
    grad.addColorStop(0.24, rgba(style.halo, 0.26));
    grad.addColorStop(0.52, rgba(style.flash, 0.42));
    grad.addColorStop(0.78, rgba(style.ember, 0.22));
    grad.addColorStop(1, rgba(style.ember, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, diskRx, diskRy, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawCore(ctx, style, cx, cy, baseRadius, timeline, animTime) {
    var open = timeline.openK;
    var radius = baseRadius * (0.54 + open * 0.10);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    drawGlow(ctx, cx, cy, radius * 2.2, radius * 2.2, style.halo, 0.10 + timeline.castFlash * 0.22 + timeline.collapseFlash * 0.14, 0);
    drawGlow(ctx, cx, cy, radius * 1.32, radius * 1.32, style.flash, 0.06 + timeline.collapseFlash * 0.24, 0);
    ctx.restore();

    var outer = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.08);
    outer.addColorStop(0, rgba(style.core, 0.06));
    outer.addColorStop(0.48, rgba(style.core, 0.82));
    outer.addColorStop(0.82, rgba(style.core, 0.96));
    outer.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.06, 0, TAU);
    ctx.fill();

    drawRing(ctx, cx, cy, radius * 0.98, style.rim, 0.20 + timeline.castFlash * 0.34 + timeline.collapseFlash * 0.28, Math.max(1.2, baseRadius * 0.025));
    drawRing(ctx, cx, cy, radius * 0.82, style.flash, 0.08 + timeline.holdPulse * 0.06, Math.max(1, baseRadius * 0.010));

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(animTime * 0.40);
    for (var i = 0; i < 3; i++) {
      var frac = i / 3;
      ctx.strokeStyle = rgba(style.hot, 0.06 + frac * 0.03 + timeline.collapseFlash * 0.08);
      ctx.lineWidth = Math.max(1, baseRadius * (0.014 + frac * 0.006));
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * (0.46 + frac * 0.10), radius * (0.18 + frac * 0.03), i * 0.94, 0.15, Math.PI + 0.35);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShardSprite(ctx, style, x, y, size, angle, timeline) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = "screen";
    if (style.shardMode === "petal") {
      drawGlow(ctx, 0, 0, size * 1.8, size * 0.66, style.ember, 0.14 + timeline.castFlash * 0.10, 0);
      ctx.strokeStyle = rgba(style.rim, 0.38);
      ctx.lineWidth = Math.max(1, size * 0.20);
      ctx.beginPath();
      ctx.moveTo(size * 1.5, 0);
      ctx.quadraticCurveTo(size * 0.2, size * 0.7, -size * 1.2, 0);
      ctx.quadraticCurveTo(size * 0.2, -size * 0.7, size * 1.5, 0);
      ctx.stroke();
    } else {
      drawGlow(ctx, 0, 0, size * 1.4, size * 1.2, style.ember, 0.18 + timeline.holdPulse * 0.05, 0);
      ctx.fillStyle = rgba(style.flash, 0.34);
      ctx.beginPath();
      ctx.moveTo(size * 0.9, 0);
      ctx.lineTo(0, size * 0.4);
      ctx.lineTo(-size * 1.1, 0);
      ctx.lineTo(0, -size * 0.4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawOrbitShards(ctx, style, fxState, cx, cy, baseRadius, timeline, detail, animTime) {
    if (!fxState || !fxState.shards) return;
    var count = Math.min(detail.shardCount, fxState.shards.length);
    for (var i = 0; i < count; i++) {
      var shard = fxState.shards[i];
      var orbit = baseRadius * shard.orbit * (1 - timeline.implodeK * 0.12);
      var speedMul = style.key === MICRO_STYLE_KEY ? 1.6 : 0.9;
      var angle = shard.angle + animTime * shard.speed * speedMul + shard.lean * 0.15 * timeline.holdPulse;
      var x = cx + Math.cos(angle) * orbit;
      var y = cy + Math.sin(angle) * orbit * (0.58 + 0.08 * Math.sin(shard.wobble));
      var size = baseRadius * 0.034 * shard.size * (0.78 + timeline.openK * 0.42);
      drawShardSprite(ctx, style, x, y, size, angle + shard.wobble, timeline);
    }
  }

  function drawBloomShell(ctx, style, cx, cy, baseRadius, timeline, detail, animTime) {
    for (var i = 0; i < detail.shellCount; i++) {
      var frac = i / detail.shellCount;
      var angle = frac * TAU + animTime * 0.18;
      var dist = baseRadius * (1.30 + 0.08 * Math.sin(animTime * 1.4 + frac * 8));
      var px = cx + Math.cos(angle) * dist;
      var py = cy + Math.sin(angle) * dist;
      var rx = baseRadius * (0.54 + 0.10 * timeline.holdPulse);
      var ry = baseRadius * (0.17 + 0.03 * Math.sin(angle * 3 + animTime));
      drawGlow(ctx, px, py, rx, ry, style.halo, 0.16 + timeline.castFlash * 0.14, angle);
      drawArc(ctx, cx, cy, dist, angle - 0.34, angle + 0.34, style.rim, 0.18, Math.max(1.2, baseRadius * 0.015));
    }
  }

  function drawMaelstromShell(ctx, style, cx, cy, baseRadius, timeline, detail, animTime) {
    ctx.save();
    ctx.strokeStyle = rgba(style.ember, 0.28 + timeline.castFlash * 0.14);
    ctx.lineWidth = Math.max(1.2, baseRadius * 0.018);
    ctx.lineCap = "round";
    for (var i = 0; i < detail.shellCount; i++) {
      var frac = i / detail.shellCount;
      var angle = frac * TAU + animTime * 0.32;
      var r0 = baseRadius * 1.02;
      var r1 = baseRadius * (1.42 + 0.22 * noise(i * 2.1 + animTime));
      var r2 = baseRadius * (1.64 + 0.24 * noise(i * 7.4 + animTime * 0.5));
      var x0 = cx + Math.cos(angle) * r0;
      var y0 = cy + Math.sin(angle) * r0;
      var x1 = cx + Math.cos(angle + 0.16) * r1;
      var y1 = cy + Math.sin(angle + 0.16) * r1;
      var x2 = cx + Math.cos(angle + 0.08 * Math.sin(i + animTime)) * r2;
      var y2 = cy + Math.sin(angle + 0.08 * Math.sin(i + animTime)) * r2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x1, y1, x2, y2);
      ctx.stroke();
    }
    ctx.restore();
    drawGlow(ctx, cx, cy, baseRadius * 2.3, baseRadius * 2.0, style.ember, 0.08 + timeline.holdPulse * 0.06, 0);
  }

  function drawVariantShell(ctx, style, cx, cy, baseRadius, timeline, detail, animTime) {
    if (style.shell === "maelstrom") drawMaelstromShell(ctx, style, cx, cy, baseRadius, timeline, detail, animTime);
    else drawBloomShell(ctx, style, cx, cy, baseRadius, timeline, detail, animTime);
  }

  function drawCastFlash(ctx, style, cx, cy, maxRadius, timeline, animTime) {
    if (timeline.castFlash <= 0.001 && timeline.castRing <= 0.001) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    drawGlow(ctx, cx, cy, maxRadius * (2.2 + timeline.castFlash * 1.8), maxRadius * (2.2 + timeline.castFlash * 1.8), style.flash, 0.16 + timeline.castFlash * 0.44, 0);
    drawGlow(ctx, cx, cy, maxRadius * (3.6 + timeline.castFlash * 2.2), maxRadius * (1.0 + timeline.castFlash * 0.5), style.ember, 0.08 + timeline.castFlash * 0.18, animTime * 0.12);
    ctx.restore();
    drawRing(ctx, cx, cy, maxRadius * (1.4 + timeline.castRing * 3.8), style.flash, 0.34 * (1 - timeline.castRing), Math.max(2, maxRadius * 0.024));
    drawRing(ctx, cx, cy, maxRadius * (1.0 + timeline.castRing * 2.4), style.halo, 0.22 * (1 - timeline.castRing), Math.max(1.4, maxRadius * 0.012));
  }

  function drawCollapseFlash(ctx, style, cx, cy, maxRadius, timeline, animTime) {
    if (timeline.collapseFlash <= 0.001 && timeline.collapseRing <= 0.001) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    drawGlow(ctx, cx, cy, maxRadius * (2.0 - timeline.implodeK * 0.8), maxRadius * (2.0 - timeline.implodeK * 0.8), style.flash, 0.14 + timeline.collapseFlash * 0.46, 0);
    drawGlow(ctx, cx, cy, maxRadius * (2.8 + timeline.collapseFlash * 1.4), maxRadius * (0.82 + timeline.collapseFlash * 0.18), style.halo, 0.06 + timeline.collapseFlash * 0.20, animTime * 0.16);
    ctx.restore();
    drawRing(ctx, cx, cy, maxRadius * (0.6 + timeline.collapseRing * 3.1), style.flash, 0.38 * (1 - timeline.collapseRing), Math.max(2.4, maxRadius * 0.028));
    drawRing(ctx, cx, cy, maxRadius * (0.4 + timeline.collapseRing * 2.0), style.ember, 0.18 * (1 - timeline.collapseRing), Math.max(1.4, maxRadius * 0.012));
  }

  function drawStageOverlay(ctx, style, cx, cy, maxRadius, timeline, animTime) {
    drawCastFlash(ctx, style, cx, cy, maxRadius, timeline, animTime);
    drawCollapseFlash(ctx, style, cx, cy, maxRadius, timeline, animTime);
  }

  function renderFrameToCanvas(ctx, size, style, baseRadius, timeline, detail, fxState, animTime) {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size, size);

    var extentMul = style.extentMul || 5.4;
    var scale = size / (baseRadius * extentMul * 2);
    var cx = size * 0.5;
    var cy = size * 0.5;
    var maxRadius = baseRadius * scale;
    var effectRadius = maxRadius * timeline.radiusMul;

    drawSingularitySeed(ctx, style, cx, cy, maxRadius, timeline, animTime);

    ctx.save();
    ctx.globalAlpha = Math.max(0.08, timeline.effectK);
    drawVariantShell(ctx, style, cx, cy, effectRadius, timeline, detail, animTime);
    drawAccretionDisk(ctx, style, cx, cy, effectRadius, timeline, detail, animTime);
    drawOrbitShards(ctx, style, fxState, cx, cy, effectRadius, timeline, detail, animTime);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = Math.max(0.18, 0.24 + timeline.openK * 0.76);
    drawCore(ctx, style, cx, cy, effectRadius, timeline, animTime);
    ctx.restore();

    drawStageOverlay(ctx, style, cx, cy, maxRadius, timeline, animTime);
  }

  function render(bh, opts) {
    if (!bh || !opts || !opts.layer) return;
    ensureFxState(bh);
    ensureVisual(bh, opts.layer);
    if (!bh._bodySprite || bh._bodySprite.destroyed) return;

    var level = levelForZoom(opts.zoom || 0.22);
    var cfg = {
      growthTime: opts.growthTime || 3,
      holdTime: opts.holdTime || 10,
      fadeTime: opts.fadeTime || 4
    };
    var simTime = opts.simTimeSec != null ? opts.simTimeSec : 0;
    var animTime = opts.animTimeSec != null ? opts.animTimeSec : simTime;
    var simElapsed = Math.max(0, simTime - (bh.spawnedAt || 0));
    var targetSpawnReal = animTime - simElapsed;
    if (bh._spawnRealAt == null || !isFinite(bh._spawnRealAt)) bh._spawnRealAt = targetSpawnReal;
    else bh._spawnRealAt = lerp(bh._spawnRealAt, targetSpawnReal, 0.08);

    var elapsed = Math.max(0, animTime - bh._spawnRealAt);
    var timeline = buildTimeline(elapsed, cfg);
    var baseRadius = bh.radius || 0;
    if (baseRadius < 2 || timeline.visibility <= 0.001) {
      hide(bh);
      return;
    }

    var styleKey = chooseStyleKey(bh.styleKey, baseRadius);
    var style = getStyle(styleKey);
    var detail = getDetailSpec(level, opts.zoom || 0.22, !!opts.multiplayerRemote, baseRadius, style.extentMul);
    var sizeChanged = ensureCanvasSize(bh, detail.size);
    var mustRedraw = sizeChanged || bh._lastStage !== timeline.stage || (animTime - (bh._lastDrawAt || -Infinity)) >= (1 / Math.max(10, detail.fps));

    if (mustRedraw && bh._bodyCtx) {
      renderFrameToCanvas(bh._bodyCtx, detail.size, style, baseRadius, timeline, detail, bh._bhFxState, animTime);
      updateTexture(bh._bodyTexture);
      bh._lastDrawAt = animTime;
      bh._lastStage = timeline.stage;
    }

    bh._drawX = bh.x;
    bh._drawY = bh.y;
    bh._bodySprite.visible = true;
    bh._bodySprite.position.set(bh._drawX, bh._drawY);
    bh._bodySprite.width = baseRadius * style.extentMul * 2;
    bh._bodySprite.height = baseRadius * style.extentMul * 2;
    bh._bodySprite.alpha = 1;
    bh._visualExtentMul = style.extentMul;
    bh._visualBaseRadius = baseRadius;
  }

  function drawBloomPreview(g, x, y, radius, now, pxToWorld) {
    var pulse = 0.5 + 0.5 * Math.sin(now * 1.7);
    g.circle(x, y, radius * 1.01);
    g.stroke({ color: 0xe2ceff, width: 2.2 * pxToWorld, alpha: 0.34 + pulse * 0.08 });
    g.circle(x, y, radius * 0.82);
    g.stroke({ color: 0x7a5dff, width: 1.2 * pxToWorld, alpha: 0.22 + pulse * 0.05 });
    g.circle(x, y, radius * 0.42);
    g.stroke({ color: 0xfff7ff, width: 1.8 * pxToWorld, alpha: 0.22 + pulse * 0.05 });
    var markerCount = 8;
    for (var i = 0; i < markerCount; i++) {
      var ang = (i / markerCount) * TAU + now * 0.22;
      var rr = radius * (0.80 + (i % 2) * 0.05);
      var px = x + Math.cos(ang) * rr;
      var py = y + Math.sin(ang) * rr;
      g.circle(px, py, Math.max(1.1 * pxToWorld, radius * 0.008));
      g.fill({ color: 0xc5b4ff, alpha: 0.16 });
    }
  }

  function drawMeridianPreview(g, x, y, radius, now, pxToWorld) {
    var pulse = 0.5 + 0.5 * Math.sin(now * 2.2);
    g.circle(x, y, radius * 1.01);
    g.stroke({ color: 0xffb8c2, width: 2.1 * pxToWorld, alpha: 0.32 + pulse * 0.08 });
    g.circle(x, y, radius * 0.80);
    g.stroke({ color: 0xff5b5b, width: 1.2 * pxToWorld, alpha: 0.24 + pulse * 0.06 });
    g.circle(x, y, radius * 0.40);
    g.stroke({ color: 0xfff1de, width: 1.6 * pxToWorld, alpha: 0.20 + pulse * 0.06 });
    var tongueCount = 7;
    for (var i = 0; i < tongueCount; i++) {
      var frac = i / tongueCount;
      var angle = frac * TAU + now * 0.28;
      var inner = radius * 0.92;
      var outer = radius * (1.18 + 0.08 * Math.sin(now * 3.0 + i));
      g.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
      g.lineTo(x + Math.cos(angle + 0.10) * outer, y + Math.sin(angle + 0.10) * outer);
      g.stroke({ color: 0xff6b59, width: 1.4 * pxToWorld, alpha: 0.18 + pulse * 0.06 });
    }
  }

  function drawPreview(g, x, y, radius, animTimeSec, zoom, styleKey) {
    if (!g || !radius) return;
    var now = animTimeSec || 0;
    var pxToWorld = 1 / Math.max(zoom || 0.22, 0.08);
    var key = chooseStyleKey(styleKey, radius);
    if (key === MICRO_STYLE_KEY) drawMeridianPreview(g, x, y, radius, now, pxToWorld);
    else drawBloomPreview(g, x, y, radius, now, pxToWorld);
  }

  var BlackHoleRenderer = {
    render: render,
    drawPreview: drawPreview,
    hide: hide,
    destroy: destroy
  };

  if (typeof window !== "undefined") window.BlackHoleRenderer = BlackHoleRenderer;
  if (typeof module !== "undefined") module.exports = BlackHoleRenderer;
})();
