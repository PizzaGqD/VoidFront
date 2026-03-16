/**
 * BlackHoleRenderer — visual-only renderer for black hole abilities.
 * Keeps gameplay and net state outside this module.
 */
(function () {
  "use strict";

  var Common = (typeof window !== "undefined" && window.AbilityVfxCommon) ? window.AbilityVfxCommon : null;
  var LODRef = (typeof window !== "undefined" && window.LOD) ? window.LOD : null;
  var BODY_CANVAS_SIZE = 2048;
  var FIXED_EXTENT_MUL = 8.6;

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function smoothstep(a, b, x) {
    if (Common && typeof Common.smoothstep === "function") return Common.smoothstep(a, b, x);
    if (a === b) return x >= b ? 1 : 0;
    var t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function mixColor(a, b, t) {
    var tt = clamp01(t);
    var ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    var br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    var rr = Math.round(lerp(ar, br, tt));
    var rg = Math.round(lerp(ag, bg, tt));
    var rb = Math.round(lerp(ab, bb, tt));
    return (rr << 16) | (rg << 8) | rb;
  }

  var TAU = Math.PI * 2;

  function getLife(elapsedSec, cfg) {
    if (Common && typeof Common.getBlackHoleLife === "function") {
      return Common.getBlackHoleLife(elapsedSec, {
        appear: cfg.growthTime,
        exist: cfg.holdTime,
        vanish: cfg.fadeTime
      });
    }
    var total = cfg.growthTime + cfg.holdTime + cfg.fadeTime;
    var local = ((elapsedSec % total) + total) % total;
    if (local < cfg.growthTime) {
      var ka = local / Math.max(cfg.growthTime, 0.001);
      return {
        state: "appear",
        k: ka,
        visibility: ka,
        coreScale: 0.18 + 0.82 * smoothstep(0, 1, ka),
        previewScale: 0.35 + 0.65 * smoothstep(0, 1, ka),
        heat: 1 - ka * 0.35,
        redShift: 0,
        appearFlash: 1 - smoothstep(0.0, 0.18, ka),
        vanishFlash: 0
      };
    }
    if (local < cfg.growthTime + cfg.holdTime) {
      return {
        state: "exist",
        k: 0,
        visibility: 1,
        coreScale: 1,
        previewScale: 1,
        heat: 0.62,
        redShift: 0,
        appearFlash: 0,
        vanishFlash: 0
      };
    }
    var kv = (local - cfg.growthTime - cfg.holdTime) / Math.max(cfg.fadeTime, 0.001);
    return {
      state: "vanish",
      k: kv,
      visibility: 1 - kv * 0.18,
      coreScale: 1 - kv * 0.58,
      previewScale: 1 + kv * 0.1,
      heat: 0.75 + kv * 0.75,
      redShift: kv,
      appearFlash: 0,
      vanishFlash: smoothstep(0.82, 1.0, kv)
    };
  }

  function getRadiusScale(elapsedSec, cfg) {
    if (elapsedSec < cfg.growthTime) return elapsedSec / Math.max(cfg.growthTime, 0.001);
    if (elapsedSec < cfg.growthTime + cfg.holdTime) return 1;
    return Math.max(0, 1 - (elapsedSec - cfg.growthTime - cfg.holdTime) / Math.max(cfg.fadeTime, 0.001));
  }

  function getZoomLevel(zoom) {
    return LODRef && typeof LODRef.getLevel === "function" ? LODRef.getLevel(zoom || 0.22) : "near";
  }

  function getCounts(level) {
    if (level === "far") return { rocks: 10, motes: 18 };
    if (level === "mid") return { rocks: 18, motes: 30 };
    return { rocks: 26, motes: 44 };
  }

  function resetVisualRefs(bh) {
    bh._bodyContainer = null;
    bh._bodySprite = null;
    bh._bodyTexture = null;
    bh._bodyCanvas = null;
    bh._bodyCtx = null;
  }

  function ensureSeedState(bh) {
    if (bh._bhFxState) return;
    var rocks = [];
    var motes = [];
    for (var i = 0; i < 32; i++) {
      rocks.push({
        phase: Math.random() * Math.PI * 2,
        speed: 0.30 + Math.random() * 0.62,
        orbitMul: 0.56 + Math.random() * 0.78,
        size: 0.82 + Math.random() * 1.15,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() * 2 - 1) * 0.42,
        elongation: 1 + Math.random() * 0.88,
        tint: i % 4 === 0 ? "cold" : (i % 4 === 1 ? "iron" : (i % 4 === 2 ? "ember" : "violet"))
      });
    }
    for (var j = 0; j < 56; j++) {
      motes.push({
        phase: Math.random() * Math.PI * 2,
        speed: 0.10 + Math.random() * 0.26,
        orbitMul: 0.50 + Math.random() * 0.84,
        size: 0.65 + Math.random() * 1.0,
        alphaBias: 0.72 + Math.random() * 0.22
      });
    }
    bh._bhFxState = { rocks: rocks, motes: motes };
    bh._spawnRealAt = null;
  }

  function ensureVisual(bh, layer) {
    var targetSize = bh._bodyCanvasTargetSize || BODY_CANVAS_SIZE;
    if (bh._bodySprite && bh._bodySprite.destroyed) resetVisualRefs(bh);
    if (bh._bodyTexture && bh._bodyTexture.destroyed) resetVisualRefs(bh);
    if (!bh._bodyCanvas || !bh._bodyCtx || !bh._bodyTexture || !bh._bodySprite || bh._bodyCanvas.width !== targetSize || bh._bodyCanvas.height !== targetSize) {
      if (bh._bodySprite && !bh._bodySprite.destroyed) {
        bh._bodySprite.parent && bh._bodySprite.parent.removeChild(bh._bodySprite);
        bh._bodySprite.destroy();
      }
      resetVisualRefs(bh);
      bh._bodyCanvas = document.createElement("canvas");
      bh._bodyCanvas.width = targetSize;
      bh._bodyCanvas.height = targetSize;
      bh._bodyCtx = bh._bodyCanvas.getContext("2d");
      if (bh._bodyCtx) bh._bodyCtx.imageSmoothingEnabled = true;
      bh._bodyTexture = PIXI.Texture.from(bh._bodyCanvas);
      bh._bodySprite = new PIXI.Sprite(bh._bodyTexture);
      bh._bodySprite.anchor.set(0.5);
      bh._bodySprite.roundPixels = false;
      layer.addChild(bh._bodySprite);
      bh._bodyContainer = bh._bodySprite;
    } else if (bh._bodySprite && bh._bodySprite.parent !== layer) {
      layer.addChild(bh._bodySprite);
    }
  }

  function destroy(bh) {
    if (!bh) return;
    if (bh._bodySprite && !bh._bodySprite.destroyed) {
      bh._bodySprite.parent && bh._bodySprite.parent.removeChild(bh._bodySprite);
      bh._bodySprite.destroy();
    }
    resetVisualRefs(bh);
  }

  function hide(bh) {
    if (!bh) return;
    if (bh._bodySprite) bh._bodySprite.visible = false;
  }

  function drawEllipsePath(g, rx, ry, rotation, steps) {
    var cosR = Math.cos(rotation || 0);
    var sinR = Math.sin(rotation || 0);
    var count = steps || 40;
    for (var i = 0; i <= count; i++) {
      var a = (i / count) * Math.PI * 2;
      var ex = Math.cos(a) * rx;
      var ey = Math.sin(a) * ry;
      var px = ex * cosR - ey * sinR;
      var py = ex * sinR + ey * cosR;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
  }

  function rgbaHex(hex, alpha) {
    var r = (hex >> 16) & 255;
    var g = (hex >> 8) & 255;
    var b = hex & 255;
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function drawCirclePath(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
  }

  function drawRock(ctx, x, y, r, rot, alpha, tint, elongation, scale) {
    var fill = "rgba(68,72,84," + alpha + ")";
    var stroke = "rgba(205,215,232," + (alpha * 0.28) + ")";
    if (tint === "cold") {
      fill = "rgba(80,96,124," + alpha + ")";
      stroke = "rgba(190,226,255," + (alpha * 0.30) + ")";
    } else if (tint === "ember") {
      fill = "rgba(112,76,58," + alpha + ")";
      stroke = "rgba(255,196,126," + (alpha * 0.34) + ")";
    } else if (tint === "violet") {
      fill = "rgba(86,64,116," + alpha + ")";
      stroke = "rgba(224,176,255," + (alpha * 0.30) + ")";
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(elongation || 1, 1 / Math.max(0.7, (elongation || 1) * 0.85));
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = (TAU * i) / 8;
      var rr = r * (0.68 + ((i * 29) % 6) * 0.07);
      var px = Math.cos(a) * rr;
      var py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = Math.max(0.7, scale * 0.8);
    ctx.strokeStyle = stroke;
    ctx.stroke();
    ctx.restore();
  }

  function updateTexture(texture) {
    if (!texture) return;
    if (texture.source && typeof texture.source.update === "function") texture.source.update();
    else if (typeof texture.update === "function") texture.update();
  }

  function drawCanvasBlackHole(ctx, size, baseRadius, radius, life, animTime, counts, zoom, fxState) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size, size);

    var extentMul = FIXED_EXTENT_MUL;
    var worldExtent = Math.max(baseRadius, radius) * extentMul;
    var scale = size / (worldExtent * 2);
    var cx = size * 0.5;
    var cy = size * 0.5;
    var rPx = baseRadius * scale;
    var innerCorePx = rPx * (0.12 + 0.30 * clamp01(life.coreScale || 1));
    var redShift = clamp01(life.redShift || 0);
    var sinkK = life.state === "vanish" ? smoothstep(0.08, 1.0, life.k) : 0;
    var pulse = 0.5 + 0.5 * Math.sin(animTime * 0.82);

    var outer = ctx.createRadialGradient(cx, cy, rPx * 0.12, cx, cy, rPx * 1.05 * life.previewScale);
    outer.addColorStop(0, "rgba(12,14,24,0)");
    outer.addColorStop(0.18, "rgba(48,36,88," + (0.070 * life.visibility) + ")");
    outer.addColorStop(0.46, "rgba(132,58,205," + (0.145 * life.visibility) + ")");
    outer.addColorStop(0.72, "rgba(82,156,255," + (0.120 * life.visibility) + ")");
    outer.addColorStop(1, "rgba(20,24,40,0)");
    ctx.fillStyle = outer;
    drawCirclePath(ctx, cx, cy, rPx * 1.05 * life.previewScale);
    ctx.fill();

    var veil = ctx.createRadialGradient(cx, cy, rPx * 0.18, cx, cy, rPx * 0.98);
    veil.addColorStop(0, "rgba(0,0,0,0)");
    veil.addColorStop(0.36, "rgba(146,92,235," + (0.060 * life.visibility) + ")");
    veil.addColorStop(0.66, "rgba(95,185,255," + (0.090 * life.visibility) + ")");
    veil.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = veil;
    drawCirclePath(ctx, cx, cy, rPx * 1.02);
    ctx.fill();

    var compression = ctx.createRadialGradient(cx, cy, rPx * 0.42, cx, cy, rPx * 1.18);
    compression.addColorStop(0, "rgba(0,0,0,0)");
    compression.addColorStop(0.44, "rgba(255,196,122," + (0.050 * life.visibility * (0.65 + pulse * 0.35)) + ")");
    compression.addColorStop(0.64, "rgba(255,96,150," + (0.080 * life.visibility * (0.7 + pulse * 0.3)) + ")");
    compression.addColorStop(0.82, "rgba(116,170,255," + (0.070 * life.visibility) + ")");
    compression.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = compression;
    drawCirclePath(ctx, cx, cy, rPx * 1.16);
    ctx.fill();

    if (life.appearFlash > 0.001) {
      var spawnR = rPx * (1.35 + (1 - life.k) * 2.10);
      var spawnFlash = ctx.createRadialGradient(cx, cy, 0, cx, cy, spawnR);
      spawnFlash.addColorStop(0, "rgba(255,255,255," + (0.60 * life.appearFlash) + ")");
      spawnFlash.addColorStop(0.08, "rgba(255,248,235," + (0.42 * life.appearFlash) + ")");
      spawnFlash.addColorStop(0.22, "rgba(255,180,120," + (0.30 * life.appearFlash) + ")");
      spawnFlash.addColorStop(0.40, "rgba(255,80,180," + (0.18 * life.appearFlash) + ")");
      spawnFlash.addColorStop(1, "rgba(255,170,110,0)");
      ctx.fillStyle = spawnFlash;
      drawCirclePath(ctx, cx, cy, spawnR);
      ctx.fill();

      ctx.lineWidth = 4.0 * scale;
      ctx.strokeStyle = "rgba(255,245,230," + (0.42 * life.appearFlash) + ")";
      drawCirclePath(ctx, cx, cy, spawnR);
      ctx.stroke();

      ctx.lineWidth = 7.5 * scale;
      ctx.strokeStyle = "rgba(116,205,255," + (0.16 * life.appearFlash) + ")";
      drawCirclePath(ctx, cx, cy, spawnR * 0.78);
      ctx.stroke();

      var spawnCore = ctx.createRadialGradient(cx, cy, 0, cx, cy, rPx * (0.50 + life.appearFlash * 0.45));
      spawnCore.addColorStop(0, "rgba(255,255,255," + (0.55 * life.appearFlash) + ")");
      spawnCore.addColorStop(0.22, "rgba(255,224,188," + (0.28 * life.appearFlash) + ")");
      spawnCore.addColorStop(1, "rgba(255,140,90,0)");
      ctx.fillStyle = spawnCore;
      drawCirclePath(ctx, cx, cy, rPx * (0.50 + life.appearFlash * 0.45));
      ctx.fill();
    }

    if (life.vanishFlash > 0.001) {
      var collapseR = rPx * (1.15 + life.vanishFlash * 8.6);
      var collapseFlash = ctx.createRadialGradient(cx, cy, 0, cx, cy, collapseR);
      collapseFlash.addColorStop(0, "rgba(255,252,244," + (0.84 * life.vanishFlash) + ")");
      collapseFlash.addColorStop(0.10, "rgba(255,176,120," + (0.50 * life.vanishFlash) + ")");
      collapseFlash.addColorStop(0.22, "rgba(255,88,168," + (0.34 * life.vanishFlash) + ")");
      collapseFlash.addColorStop(0.38, "rgba(155,90,255," + (0.28 * life.vanishFlash) + ")");
      collapseFlash.addColorStop(1, "rgba(255,70,35,0)");
      ctx.fillStyle = collapseFlash;
      drawCirclePath(ctx, cx, cy, collapseR);
      ctx.fill();

      ctx.lineWidth = 4.8 * scale;
      ctx.strokeStyle = "rgba(255,245,230," + (0.34 * life.vanishFlash) + ")";
      drawCirclePath(ctx, cx, cy, collapseR * 0.82);
      ctx.stroke();

      var collapseCore = ctx.createRadialGradient(cx, cy, 0, cx, cy, rPx * (0.30 + life.vanishFlash * 0.58));
      collapseCore.addColorStop(0, "rgba(255,255,255," + (0.68 * life.vanishFlash) + ")");
      collapseCore.addColorStop(0.16, "rgba(255,236,210," + (0.34 * life.vanishFlash) + ")");
      collapseCore.addColorStop(0.42, "rgba(255,120,82," + (0.20 * life.vanishFlash) + ")");
      collapseCore.addColorStop(1, "rgba(255,120,82,0)");
      ctx.fillStyle = collapseCore;
      drawCirclePath(ctx, cx, cy, rPx * (0.30 + life.vanishFlash * 0.58));
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(255,245,230," + (0.64 * life.visibility) + ")";
    ctx.lineWidth = 3.8 * scale;
    drawCirclePath(ctx, cx, cy, rPx * 0.44);
    ctx.stroke();

    ctx.strokeStyle = "rgba(130,235,255," + (0.34 * life.visibility) + ")";
    ctx.lineWidth = 8.4 * scale;
    drawCirclePath(ctx, cx, cy, rPx * 0.46);
    ctx.stroke();

    ctx.strokeStyle = "rgba(210,232,255," + (0.24 * life.visibility) + ")";
    ctx.lineWidth = 3.0 * scale;
    drawCirclePath(ctx, cx, cy, rPx * 0.96);
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(animTime * 0.18);
    ctx.scale(1, 0.32);
    var disk = ctx.createRadialGradient(0, 0, rPx * 0.10, 0, 0, rPx * 0.95);
    disk.addColorStop(0, "rgba(255,240,220,0)");
    disk.addColorStop(0.26, "rgba(255,236,205," + (0.14 * life.visibility) + ")");
    disk.addColorStop(0.44, "rgba(" + (212 + Math.floor(redShift * 30)) + "," + (120 - Math.floor(redShift * 25)) + "," + (255 - Math.floor(redShift * 120)) + "," + (0.28 * life.visibility) + ")");
    disk.addColorStop(0.68, "rgba(" + (255) + "," + (140 - Math.floor(redShift * 28)) + "," + (155 - Math.floor(redShift * 80)) + "," + (0.22 * life.visibility) + ")");
    disk.addColorStop(0.84, "rgba(" + (255) + "," + (190 - Math.floor(redShift * 55)) + "," + (95 - Math.floor(redShift * 55)) + "," + (0.16 * life.visibility) + ")");
    disk.addColorStop(1, "rgba(255,120,70,0)");
    ctx.fillStyle = disk;
    drawCirclePath(ctx, 0, 0, rPx * 0.92);
    ctx.fill();
    ctx.restore();

    var innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerCorePx);
    innerGlow.addColorStop(0, "rgba(0,0,0,1)");
    innerGlow.addColorStop(0.76, "rgba(2,2,4,1)");
    innerGlow.addColorStop(0.92, "rgba(255,245,210," + (0.22 * life.heat * life.visibility) + ")");
    innerGlow.addColorStop(1, "rgba(" + (190 + Math.floor(redShift * 36)) + "," + (78 + Math.floor((1 - redShift) * 82)) + "," + (188 - Math.floor(redShift * 110)) + "," + (0.30 * life.visibility) + ")");
    ctx.fillStyle = innerGlow;
    drawCirclePath(ctx, cx, cy, innerCorePx);
    ctx.fill();

    var appearDebrisK = life.state === "appear" ? smoothstep(0.14, 0.68, life.k) : 1;
    var moteColor = "rgba(" + (218 + Math.floor(redShift * 32)) + "," + (228 - Math.floor(redShift * 36)) + "," + (255 - Math.floor(redShift * 118)) + ",";
    var moteCount = Math.min(counts.motes, fxState.motes.length);
    for (var i = 0; i < moteCount; i++) {
      var mote = fxState.motes[i];
      if (!mote) continue;
      var orbitMul = 0.76 + mote.orbitMul * 0.34;
      var orbitPx = rPx * orbitMul * Math.max(0.04, 1 - sinkK);
      var angle = mote.phase - animTime * mote.speed * 0.18 + sinkK * 1.28;
      var mx = cx + Math.cos(angle) * orbitPx;
      var my = cy + Math.sin(angle) * orbitPx;
      var moteAlpha = (levelForZoom(zoom) === "far" ? 0.18 : 0.26) * life.visibility * mote.alphaBias * appearDebrisK;
      ctx.fillStyle = moteColor + moteAlpha + ")";
      drawCirclePath(ctx, mx, my, Math.max(1.4, rPx * 0.0100 * mote.size));
      ctx.fill();
    }

    var rockCount = Math.min(counts.rocks, fxState.rocks.length);
    for (var j = 0; j < rockCount; j++) {
      var rock = fxState.rocks[j];
      if (!rock) continue;
      var orbitBase = rPx * (0.86 + rock.orbitMul * 0.26);
      var orbit = orbitBase * Math.max(0.08, 1 - sinkK * 0.95);
      var angleR = rock.phase + animTime * rock.speed * 0.34 + sinkK * (1.2 + rock.orbitMul * 0.6);
      var rx = cx + Math.cos(angleR) * orbit;
      var ry = cy + Math.sin(angleR) * orbit * (0.88 + rock.orbitMul * 0.10);
      var rockAlpha = (levelForZoom(zoom) === "far" ? 0.54 : 0.78) * life.visibility * (1 - sinkK * 0.12) * appearDebrisK;
      drawRock(ctx, rx, ry, Math.max(1.9, rPx * 0.027 * rock.size), rock.rot + animTime * rock.spin, rockAlpha, rock.tint, rock.elongation, scale);
    }

    return extentMul;
  }

  function levelForZoom(zoom) {
    return getZoomLevel(zoom || 0.22);
  }

  function getCanvasSizeForOpts(opts) {
    var zoom = opts && opts.zoom != null ? opts.zoom : 0.22;
    var remote = !!(opts && opts.multiplayerRemote);
    if (remote) return zoom < 0.8 ? 768 : 1024;
    if (zoom < 0.75) return 1024;
    if (zoom < 1.05) return 1536;
    return BODY_CANVAS_SIZE;
  }

  function render(bh, opts) {
    if (!bh || !opts || !opts.layer) return;

    ensureSeedState(bh);
    bh._bodyCanvasTargetSize = getCanvasSizeForOpts(opts);
    ensureVisual(bh, opts.layer);
    if (!bh._bodyCanvas || !bh._bodyCtx || !bh._bodyTexture || !bh._bodySprite || bh._bodySprite.destroyed) return;

    var level = levelForZoom(opts.zoom || 0.22);
    var counts = getCounts(level);
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
    var life = getLife(elapsed, cfg);
    var sizeFrac = bh._curRadius != null && bh.radius ? (bh._curRadius / Math.max(1, bh.radius)) : getRadiusScale(elapsed, cfg);
    var radius = bh._curRadius != null ? bh._curRadius : (bh.radius || 0) * sizeFrac;
    var baseRadius = bh.radius || radius;
    if (baseRadius < 2 || life.visibility <= 0.001) {
      hide(bh);
      return;
    }

    bh._drawX = bh.x;
    bh._drawY = bh.y;

    var extentMul = drawCanvasBlackHole(bh._bodyCtx, bh._bodyCanvas.width, baseRadius, radius, life, animTime, counts, opts.zoom || 0.22, bh._bhFxState);
    updateTexture(bh._bodyTexture);

    bh._bodySprite.visible = true;
    bh._bodySprite.position.set(bh._drawX, bh._drawY);
    bh._visualExtentMul = extentMul;
    bh._visualBaseRadius = baseRadius;
    // Keep the world-space footprint stable when the renderer swaps LOD canvas sizes.
    bh._bodySprite.width = baseRadius * extentMul * 2;
    bh._bodySprite.height = baseRadius * extentMul * 2;
    bh._bodySprite.alpha = 1;
  }

  function drawPreview(g, x, y, radius, animTimeSec, zoom) {
    if (!g || !radius) return;
    var level = levelForZoom(zoom || 0.22);
    var now = animTimeSec || 0;
    var pulse = 0.5 + 0.5 * Math.sin(now * 1.25);
    var pxToWorld = 1 / Math.max(zoom || 0.22, 0.08);
    var outerAlpha = level === "far" ? 0.026 : (level === "mid" ? 0.034 : 0.040);
    var perimeterAlpha = level === "far" ? 0.11 : (level === "mid" ? 0.13 : 0.15);

    g.circle(x, y, radius * 1.04);
    g.fill({ color: 0x1a2236, alpha: outerAlpha });
    g.circle(x, y, radius * 0.82);
    g.fill({ color: 0x111725, alpha: outerAlpha + 0.010 });
    g.circle(x, y, radius - 2 * pxToWorld);
    g.stroke({ color: 0xd7e0ef, width: 2.0 * pxToWorld, alpha: perimeterAlpha + pulse * 0.025 });
    g.circle(x, y, radius * 0.46);
    g.stroke({ color: 0x82ebff, width: 4.6 * pxToWorld, alpha: 0.10 + pulse * 0.02 });
    g.circle(x, y, radius * 0.44);
    g.stroke({ color: 0xfff5e6, width: 2.2 * pxToWorld, alpha: 0.20 + pulse * 0.03 });
    g.circle(x, y, radius * 0.42);
    g.fill({ color: 0x020204, alpha: 0.88 });

    var markerCount = level === "far" ? 6 : 8;
    for (var i = 0; i < markerCount; i++) {
      var ang = (i / markerCount) * Math.PI * 2 + now * 0.12;
      var rr = radius * (0.72 + (i % 2) * 0.10);
      var px = x + Math.cos(ang) * rr;
      var py = y + Math.sin(ang) * rr;
      g.circle(px, py, Math.max(1.2 * pxToWorld, radius * 0.0065));
      g.fill({ color: 0xd7dff1, alpha: 0.12 });
    }
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
