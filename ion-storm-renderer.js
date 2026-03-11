/**
 * IonStormRenderer — visual-only renderer for roaming storm and ion ability storms.
 * Rebuilt around the approved prototype language: soft ion fog, living wisps,
 * mote cloud, short-lived electric strikes, and explicit appear/vanish pulses.
 */
(function () {
  "use strict";

  var Common = (typeof window !== "undefined" && window.AbilityVfxCommon) ? window.AbilityVfxCommon : null;
  var LODRef = (typeof window !== "undefined" && window.LOD) ? window.LOD : null;
  var CANVAS_SIZE = 1024;
  var EXTENT_MUL = 1.62;
  var TAU = Math.PI * 2;
  var STRIKE_COLORS = ["110,220,255", "150,120,255", "255,110,130"];

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(a, b, x) {
    if (Common && typeof Common.smoothstep === "function") return Common.smoothstep(a, b, x);
    if (a === b) return x >= b ? 1 : 0;
    var t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  }

  function rgbaRgb(rgb, alpha) {
    return "rgba(" + rgb + "," + alpha + ")";
  }

  function getZoomLevel(zoom) {
    return LODRef && typeof LODRef.getLevel === "function" ? LODRef.getLevel(zoom || 0.22) : "near";
  }

  function getCounts(level) {
    if (level === "far") return { wisps: 6, motes: 24, strikeBursts: 1, ringBlobs: 1 };
    if (level === "mid") return { wisps: 10, motes: 56, strikeBursts: 2, ringBlobs: 2 };
    return { wisps: 16, motes: 120, strikeBursts: 3, ringBlobs: 2 };
  }

  function getLife(elapsedSec, totalDurationSec) {
    if (Common && typeof Common.getIonStormLife === "function") {
      var appear = Math.min(0.85, totalDurationSec * 0.12);
      var vanish = Math.min(1.15, totalDurationSec * 0.16);
      var active = Math.max(0.1, totalDurationSec - appear - vanish);
      return Common.getIonStormLife(elapsedSec, { appear: appear, active: active, vanish: vanish }, 0);
    }
    return { state: "active", k: 0, visibility: 1, radiusScale: 1, density: 1, surge: 0 };
  }

  function updateTexture(texture) {
    if (!texture) return;
    if (texture.source && typeof texture.source.update === "function") texture.source.update();
    else if (typeof texture.update === "function") texture.update();
  }

  function resetVisualRefs(storm) {
    storm.gfx = null;
    storm._stormCanvas = null;
    storm._stormCtx = null;
    storm._stormTexture = null;
    storm._stormSprite = null;
  }

  function ensureVisual(storm, layer) {
    var targetSize = storm._stormCanvasTargetSize || CANVAS_SIZE;
    if (storm._stormSprite && storm._stormSprite.destroyed) resetVisualRefs(storm);
    if (storm._stormTexture && storm._stormTexture.destroyed) resetVisualRefs(storm);
    if (!storm._stormCanvas || !storm._stormCtx || !storm._stormTexture || !storm._stormSprite || storm._stormCanvas.width !== targetSize || storm._stormCanvas.height !== targetSize) {
      if (storm._stormSprite && !storm._stormSprite.destroyed) {
        storm._stormSprite.parent && storm._stormSprite.parent.removeChild(storm._stormSprite);
        storm._stormSprite.destroy();
      }
      resetVisualRefs(storm);
      storm._stormCanvas = document.createElement("canvas");
      storm._stormCanvas.width = targetSize;
      storm._stormCanvas.height = targetSize;
      storm._stormCtx = storm._stormCanvas.getContext("2d");
      if (storm._stormCtx) storm._stormCtx.imageSmoothingEnabled = true;
      storm._stormTexture = PIXI.Texture.from(storm._stormCanvas);
      storm._stormSprite = new PIXI.Sprite(storm._stormTexture);
      storm._stormSprite.anchor.set(0.5);
      storm._stormSprite.roundPixels = false;
      layer.addChild(storm._stormSprite);
      storm.gfx = storm._stormSprite;
    } else if (storm._stormSprite.parent !== layer) {
      layer.addChild(storm._stormSprite);
    }
  }

  function destroy(storm) {
    if (!storm) return;
    if (storm._stormSprite && !storm._stormSprite.destroyed) {
      storm._stormSprite.parent && storm._stormSprite.parent.removeChild(storm._stormSprite);
      storm._stormSprite.destroy();
    }
    resetVisualRefs(storm);
  }

  function hide(storm) {
    if (!storm) return;
    if (storm._stormSprite) storm._stormSprite.visible = false;
  }

  function worldToCanvas(radius, size) {
    var extent = radius * EXTENT_MUL;
    var scale = size / (extent * 2);
    return { extent: extent, scale: scale, cx: size * 0.5, cy: size * 0.5 };
  }

  function getCanvasSizeForOpts(opts) {
    var zoom = opts && opts.zoom != null ? opts.zoom : 0.22;
    var remote = !!(opts && opts.multiplayerRemote);
    if (remote) return zoom < 0.8 ? 640 : 768;
    if (zoom < 0.75) return 768;
    if (zoom < 1.05) return 896;
    return CANVAS_SIZE;
  }

  function contourToCanvas(contour, cxWorld, cyWorld, cx, cy, scale, radiusScale) {
    var out = [];
    for (var i = 0; i < contour.length; i++) {
      var pt = contour[i];
      out.push({
        x: cx + (pt.x - cxWorld) * scale * radiusScale,
        y: cy + (pt.y - cyWorld) * scale * radiusScale
      });
    }
    return out;
  }

  function drawPolygon(ctx, pts) {
    if (!pts || !pts.length) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  }

  function pickStrikeColor() {
    var roll = Math.random();
    if (roll < 0.64) return STRIKE_COLORS[0];
    if (roll < 0.88) return STRIKE_COLORS[1];
    return STRIKE_COLORS[2];
  }

  function buildDamageBlobs(storm, cx, cy, scale, radiusScale) {
    var out = [];
    var blobs = storm && storm.blobs ? storm.blobs : [];
    var cosA = Math.cos(storm.rotAngle || 0);
    var sinA = Math.sin(storm.rotAngle || 0);
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      var ox = b.ox * cosA - b.oy * sinA;
      var oy = b.ox * sinA + b.oy * cosA;
      out.push({
        x: cx + ox * scale * radiusScale,
        y: cy + oy * scale * radiusScale,
        r: Math.max(1, b.r * scale * radiusScale)
      });
    }
    return out;
  }

  function selectKeyBlobs(blobs, maxCount) {
    if (!blobs || !blobs.length) return [];
    return blobs.slice().sort(function (a, b) { return b.r - a.r; }).slice(0, Math.max(1, maxCount || 1));
  }

  function allocStrike(pool) {
    for (var i = 0; i < pool.length; i++) {
      if (!pool[i].active) return pool[i];
    }
    return pool[0];
  }

  function ensureFxState(storm) {
    if (storm._stormFxState) return;
    var wisps = [];
    var motes = [];
    var strikePool = [];
    for (var i = 0; i < 16; i++) {
      wisps.push({
        a: (TAU * i) / 16 + Math.random() * 0.5,
        orbit: 0.22 + Math.random() * 0.58,
        width: 0.18 + Math.random() * 0.24,
        wobble: Math.random() * TAU,
        speed: 0.15 + Math.random() * 0.5
      });
    }
    for (var j = 0; j < 120; j++) {
      motes.push({
        a: Math.random() * TAU,
        r: Math.random(),
        size: 0.8 + Math.random() * 2.2,
        speed: 0.2 + Math.random() * 0.6,
        wobble: Math.random() * TAU,
        tint: ["cyan", "white", "violet"][(Math.random() * 3) | 0]
      });
    }
    for (var k = 0; k < 18; k++) {
      strikePool.push({
        active: false,
        born: 0,
        ttl: 0.18,
        points: [],
        glow: 0,
        cx: 0,
        cy: 0,
        rgb: STRIKE_COLORS[k % STRIKE_COLORS.length]
      });
    }
    storm._stormFxState = { wisps: wisps, motes: motes, strikePool: strikePool };
    storm._stormSpawnRealAt = null;
  }

  function emitStrike(pool, now, blob) {
    if (!pool || !pool.length || !blob) return;
    var strike = allocStrike(pool);
    strike.active = true;
    strike.born = now;
    strike.ttl = 0.16 + Math.random() * 0.18;
    strike.rgb = pickStrikeColor();
    strike.points.length = 0;

    var a0 = Math.random() * TAU;
    var a1 = a0 + (Math.random() * 1.2 - 0.6);
    var r0 = blob.r * (0.18 + Math.random() * 0.55);
    var r1 = blob.r * (0.35 + Math.random() * 0.55);
    var p0x = blob.x + Math.cos(a0) * r0;
    var p0y = blob.y + Math.sin(a0) * r0;
    var p1x = blob.x + Math.cos(a1) * r1;
    var p1y = blob.y + Math.sin(a1) * r1;
    var segs = 6 + ((Math.random() * 5) | 0);
    for (var i = 0; i <= segs; i++) {
      var t = i / segs;
      var x = lerp(p0x, p1x, t);
      var y = lerp(p0y, p1y, t);
      var nx = (Math.random() * 2 - 1) * blob.r * 0.045 * (1 - Math.abs(t - 0.5));
      var ny = (Math.random() * 2 - 1) * blob.r * 0.045 * (1 - Math.abs(t - 0.5));
      strike.points.push({ x: x + nx, y: y + ny });
    }
    strike.cx = (p0x + p1x) * 0.5;
    strike.cy = (p0y + p1y) * 0.5;
    strike.glow = blob.r * (0.20 + Math.random() * 0.14);
  }

  function updateStrikes(fxState, now, life, blobs, counts) {
    if (!fxState || !fxState.strikePool) return;
    if (life.visibility > 0.2 && blobs && blobs.length) {
      var chance = life.state === "active" ? 0.16 : (life.state === "appear" ? 0.09 : 0.13);
      var bursts = counts.strikeBursts || 1;
      for (var i = 0; i < bursts; i++) {
        if (Math.random() < chance) emitStrike(fxState.strikePool, now, blobs[(Math.random() * blobs.length) | 0]);
      }
    }
    for (var j = 0; j < fxState.strikePool.length; j++) {
      var strike = fxState.strikePool[j];
      if (!strike.active) continue;
      if ((now - strike.born) > strike.ttl) strike.active = false;
    }
  }

  function drawStrike(ctx, strike, now, widthMul) {
    if (!strike.active) return;
    var age = now - strike.born;
    var alpha = 1 - age / Math.max(0.001, strike.ttl);
    if (alpha <= 0.001 || !strike.points.length) return;

    var glowR = Math.max(1.5, strike.glow);
    var gg = ctx.createRadialGradient(strike.cx, strike.cy, 0, strike.cx, strike.cy, glowR);
    gg.addColorStop(0, "rgba(200,245,255," + (0.18 * alpha) + ")");
    gg.addColorStop(1, "rgba(200,245,255,0)");
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(strike.cx, strike.cy, glowR, 0, TAU);
    ctx.fill();

    ctx.lineCap = "round";
    ctx.strokeStyle = rgbaRgb(strike.rgb || STRIKE_COLORS[0], 0.95 * alpha);
    ctx.lineWidth = Math.max(0.8, widthMul * 1.9);
    ctx.beginPath();
    for (var i = 0; i < strike.points.length; i++) {
      var p = strike.points[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(235,248,255," + (0.70 * alpha) + ")";
    ctx.lineWidth = Math.max(0.45, widthMul * 0.8);
    ctx.beginPath();
    for (var j = 0; j < strike.points.length; j++) {
      var q = strike.points[j];
      if (j === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
  }

  function drawBlobPreview(ctx, blob, life, now, widthMul) {
    var preview = ctx.createRadialGradient(blob.x, blob.y, blob.r * 0.2, blob.x, blob.y, blob.r * 1.06);
    preview.addColorStop(0, "rgba(30,60,90,0)");
    preview.addColorStop(0.52, "rgba(95,170,255," + (0.055 * life.visibility) + ")");
    preview.addColorStop(0.82, "rgba(150,220,255," + (0.060 * life.visibility) + ")");
    preview.addColorStop(1, "rgba(150,220,255,0)");
    ctx.fillStyle = preview;
    ctx.beginPath();
    ctx.arc(blob.x, blob.y, blob.r * 1.04, 0, TAU);
    ctx.fill();

    var outlineAlpha = (0.14 + (0.5 + 0.5 * Math.sin(now * 1.7)) * 0.08) * life.visibility;
    ctx.strokeStyle = "rgba(185,225,255," + outlineAlpha + ")";
    ctx.lineWidth = Math.max(0.9, widthMul * 1.6);
    ctx.beginPath();
    ctx.arc(blob.x, blob.y, blob.r, 0, TAU);
    ctx.stroke();
  }

  function drawBlobPulse(ctx, blob, life, widthMul) {
    if (life.state === "appear" && life.surge > 0.001) {
      var shockR = blob.r * (1.2 + life.surge * 1.8);
      var shock = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, shockR);
      shock.addColorStop(0, "rgba(255,255,255," + (0.24 * life.surge) + ")");
      shock.addColorStop(0.12, "rgba(180,235,255," + (0.18 * life.surge) + ")");
      shock.addColorStop(0.38, "rgba(120,185,255," + (0.10 * life.surge) + ")");
      shock.addColorStop(1, "rgba(120,185,255,0)");
      ctx.fillStyle = shock;
      ctx.beginPath();
      ctx.arc(blob.x, blob.y, shockR, 0, TAU);
      ctx.fill();
    }

    if (life.state === "vanish" && life.surge > 0.001) {
      var snapR = blob.r * (0.9 + life.surge * 2.2);
      var snap = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, snapR);
      snap.addColorStop(0, "rgba(255,255,255," + (0.30 * life.surge) + ")");
      snap.addColorStop(0.12, "rgba(205,240,255," + (0.22 * life.surge) + ")");
      snap.addColorStop(0.34, "rgba(90,170,255," + (0.16 * life.surge) + ")");
      snap.addColorStop(1, "rgba(90,170,255,0)");
      ctx.fillStyle = snap;
      ctx.beginPath();
      ctx.arc(blob.x, blob.y, snapR, 0, TAU);
      ctx.fill();
    }
  }

  function drawBlobFog(ctx, blob, life) {
    var fog = ctx.createRadialGradient(blob.x, blob.y, blob.r * 0.08, blob.x, blob.y, blob.r);
    fog.addColorStop(0, "rgba(215,245,255," + (0.08 * life.visibility) + ")");
    fog.addColorStop(0.22, "rgba(135,220,255," + (0.16 * life.visibility) + ")");
    fog.addColorStop(0.52, "rgba(90,150,255," + (0.12 * life.visibility) + ")");
    fog.addColorStop(0.8, "rgba(120,100,255," + (0.06 * life.visibility) + ")");
    fog.addColorStop(1, "rgba(120,100,255,0)");
    ctx.fillStyle = fog;
    ctx.beginPath();
    ctx.arc(blob.x, blob.y, blob.r, 0, TAU);
    ctx.fill();
  }

  function drawBlobWisps(ctx, blob, wisps, count, life, now, widthMul) {
    ctx.save();
    ctx.translate(blob.x, blob.y);
    ctx.lineCap = "round";
    for (var i = 0; i < Math.min(count, wisps.length); i++) {
      var w = wisps[i];
      var a = w.a + now * 0.22 * w.speed;
      var rr = blob.r * (w.orbit + Math.sin(now + w.wobble) * 0.03);
      var span = w.width + Math.sin(now * 1.6 + w.wobble) * 0.05;
      ctx.strokeStyle = i % 3 === 0
        ? "rgba(220,245,255," + (0.11 * life.visibility * life.density) + ")"
        : (i % 3 === 1
          ? "rgba(145,235,255," + (0.13 * life.visibility * life.density) + ")"
          : "rgba(140,120,255," + (0.08 * life.visibility * life.density) + ")");
      ctx.lineWidth = Math.max(0.9, widthMul * 2.0);
      ctx.beginPath();
      ctx.arc(0, 0, rr, a, a + span);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBlobMotes(ctx, blobs, motes, count, life, now) {
    if (!blobs.length) return;
    for (var i = 0; i < Math.min(count, motes.length); i++) {
      var mote = motes[i];
      var blob = blobs[i % blobs.length];
      var a = mote.a + now * 0.25 * mote.speed + Math.sin(now * 1.8 + mote.wobble) * 0.05;
      var rr = blob.r * mote.r * (0.8 + Math.sin(now + mote.wobble) * 0.08);
      var px = blob.x + Math.cos(a) * rr;
      var py = blob.y + Math.sin(a) * rr;
      var col = "rgba(180,225,255," + (0.08 * life.visibility) + ")";
      if (mote.tint === "cyan") col = "rgba(145,235,255," + (0.11 * life.visibility) + ")";
      else if (mote.tint === "violet") col = "rgba(160,130,255," + (0.08 * life.visibility) + ")";
      var g = ctx.createRadialGradient(px, py, 0, px, py, mote.size * 4.8);
      g.addColorStop(0, col);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, mote.size * 4.8, 0, TAU);
      ctx.fill();
    }
  }

  function drawStormCanvas(ctx, size, storm, contour, life, now, zoom, counts) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size, size);

    var contourRadius = 0;
    for (var i = 0; i < contour.length; i++) {
      var dx = contour[i].x - storm.x;
      var dy = contour[i].y - storm.y;
      contourRadius = Math.max(contourRadius, Math.hypot(dx, dy));
    }
    contourRadius = Math.max(1, contourRadius);

    var tr = worldToCanvas(contourRadius, size);
    var pts = contourToCanvas(contour, storm.x, storm.y, tr.cx, tr.cy, tr.scale, life.radiusScale || 1);
    var cx = tr.cx;
    var cy = tr.cy;
    var radiusPx = contourRadius * tr.scale;
    var allBlobs = buildDamageBlobs(storm, cx, cy, tr.scale, life.radiusScale || 1);
    var keyBlobs = selectKeyBlobs(allBlobs, counts.ringBlobs);
    var fxState = storm._stormFxState;

    drawPolygon(ctx, pts);
    ctx.fillStyle = "rgba(25,40,92," + (0.08 * life.visibility * life.density) + ")";
    ctx.fill();

    for (var a = 0; a < allBlobs.length; a++) {
      drawBlobPreview(ctx, allBlobs[a], life, now, tr.scale);
      drawBlobPulse(ctx, allBlobs[a], life, tr.scale);
    }

    for (var b = 0; b < keyBlobs.length; b++) {
      drawBlobFog(ctx, keyBlobs[b], life);
      drawBlobWisps(ctx, keyBlobs[b], fxState.wisps, counts.wisps, life, now, tr.scale);
    }

    drawBlobMotes(ctx, keyBlobs, fxState.motes, counts.motes, life, now);
    updateStrikes(fxState, now, life, allBlobs.length ? allBlobs : keyBlobs, counts);
    for (var s = 0; s < fxState.strikePool.length; s++) {
      drawStrike(ctx, fxState.strikePool[s], now, tr.scale);
    }

    var perimeterAlpha = 0.10 + (0.5 + 0.5 * Math.sin(now * 1.7)) * 0.05;
    ctx.setLineDash([Math.max(6, radiusPx * 0.030), Math.max(8, radiusPx * 0.042)]);
    drawPolygon(ctx, pts);
    ctx.lineWidth = Math.max(0.8, tr.scale * 1.6);
    ctx.strokeStyle = "rgba(210,240,255," + (perimeterAlpha * life.visibility) + ")";
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function renderStorm(storm, opts) {
    if (!storm || !opts || !opts.layer || !opts.contour) return;
    ensureFxState(storm);
    storm._stormCanvasTargetSize = getCanvasSizeForOpts(opts);
    ensureVisual(storm, opts.layer);
    if (!storm._stormCanvas || !storm._stormCtx || !storm._stormTexture || !storm._stormSprite || storm._stormSprite.destroyed) return;

    var now = opts.animTimeSec != null ? opts.animTimeSec : 0;
    var total = opts.durationSec || 10;
    var elapsedSim = Math.max(0, (opts.simTimeSec != null ? opts.simTimeSec : 0) - (storm.spawnedAt || 0));
    var targetSpawnReal = now - elapsedSim;
    if (storm._stormSpawnRealAt == null || !isFinite(storm._stormSpawnRealAt)) storm._stormSpawnRealAt = targetSpawnReal;
    else storm._stormSpawnRealAt = lerp(storm._stormSpawnRealAt, targetSpawnReal, 0.08);
    var elapsed = Math.max(0, now - storm._stormSpawnRealAt);
    var life = getLife(elapsed, total);
    var level = getZoomLevel(opts.zoom || 0.22);
    var counts = getCounts(level);

    drawStormCanvas(storm._stormCtx, storm._stormCanvas.width, storm, opts.contour, life, now, opts.zoom || 0.22, counts);
    updateTexture(storm._stormTexture);

    var maxRadius = 0;
    for (var i = 0; i < opts.contour.length; i++) {
      var dx = opts.contour[i].x - storm.x;
      var dy = opts.contour[i].y - storm.y;
      maxRadius = Math.max(maxRadius, Math.hypot(dx, dy));
    }
    maxRadius = Math.max(1, maxRadius);
    storm._stormSprite.visible = true;
    storm._stormSprite.position.set(storm.x, storm.y);
    var spriteSize = maxRadius * EXTENT_MUL * 2;
    storm._stormSprite.width = spriteSize;
    storm._stormSprite.height = spriteSize;
    storm._stormSprite.alpha = 1;
  }

  var IonStormRenderer = {
    renderStorm: renderStorm,
    hide: hide,
    destroy: destroy
  };

  if (typeof window !== "undefined") window.IonStormRenderer = IonStormRenderer;
  if (typeof module !== "undefined") module.exports = IonStormRenderer;
})();
