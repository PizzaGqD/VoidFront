/**
 * TimeRewindRenderer — screen-space visual renderer for the global rewind event.
 * Purely visual: no authoritative rollback logic lives here.
 */
(function () {
  "use strict";

  var MAX_PARTICLES = 28;

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function smoothstep(a, b, x) {
    if (a === b) return x >= b ? 1 : 0;
    var t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  }

  function hash01(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }

  function updateTexture(texture) {
    if (!texture) return;
    if (texture.source && typeof texture.source.update === "function") texture.source.update();
    else if (typeof texture.update === "function") texture.update();
  }

  function resetVisualRefs(effect) {
    effect._rewindCanvas = null;
    effect._rewindCtx = null;
    effect._rewindTexture = null;
    effect._rewindSprite = null;
  }

  function ensureParticles(effect) {
    if (Array.isArray(effect._echoParticles) && effect._echoParticles.length === MAX_PARTICLES) return;
    effect._echoParticles = [];
    for (var i = 0; i < MAX_PARTICLES; i++) {
      effect._echoParticles.push({
        a: hash01(i * 17 + 1) * Math.PI * 2,
        r: 0.2 + hash01(i * 17 + 2) * 0.65,
        wobble: hash01(i * 17 + 3) * Math.PI * 2,
        size: 1.0 + hash01(i * 17 + 4) * 3.2
      });
    }
  }

  function ensureVisual(effect, layer, width, height) {
    if (effect._rewindSprite && effect._rewindSprite.destroyed) resetVisualRefs(effect);
    if (effect._rewindTexture && effect._rewindTexture.destroyed) resetVisualRefs(effect);
    if (!effect._rewindCanvas || !effect._rewindCtx || !effect._rewindTexture || !effect._rewindSprite) {
      effect._rewindCanvas = document.createElement("canvas");
      effect._rewindCtx = effect._rewindCanvas.getContext("2d");
      if (effect._rewindCtx) effect._rewindCtx.imageSmoothingEnabled = true;
      effect._rewindTexture = PIXI.Texture.from(effect._rewindCanvas);
      effect._rewindSprite = new PIXI.Sprite(effect._rewindTexture);
      effect._rewindSprite.anchor.set(0);
      effect._rewindSprite.position.set(0, 0);
      effect._rewindSprite.eventMode = "none";
    }

    var dpr = Math.max(1, Math.min(2, (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1));
    var targetW = Math.max(1, Math.floor(width * dpr));
    var targetH = Math.max(1, Math.floor(height * dpr));
    if (effect._rewindCanvas.width !== targetW || effect._rewindCanvas.height !== targetH) {
      effect._rewindCanvas.width = targetW;
      effect._rewindCanvas.height = targetH;
      effect._rewindCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    effect._rewindSprite.width = width;
    effect._rewindSprite.height = height;
    if (layer && effect._rewindSprite.parent !== layer) layer.addChild(effect._rewindSprite);
  }

  function getLife(effect, nowSec) {
    var startedAt = effect.startedAtReal || nowSec;
    var elapsed = Math.max(0, nowSec - startedAt);
    var freezeEnter = effect.freezeEnterSec || 1.0;
    var pulseSeq = effect.pulseSeqSec || 2.3;
    var rewindSec = effect.rewindSec || 2.0;
    var resumeSec = effect.resumeSec || 1.5;
    var flashSeqEnd = freezeEnter + pulseSeq;
    var rewindEnd = flashSeqEnd + rewindSec;
    var total = effect.totalSec || (freezeEnter + pulseSeq + rewindSec + resumeSec);

    if (elapsed < freezeEnter) {
      var k0 = elapsed / Math.max(freezeEnter, 0.001);
      return {
        state: "freeze_enter",
        elapsed: elapsed,
        freeze: k0,
        rewindMix: 0,
        flashes: 0,
        flashPulse: 0,
        flashSeqEnd: flashSeqEnd,
        total: total
      };
    }
    if (elapsed < flashSeqEnd) {
      var local = (elapsed - freezeEnter) / Math.max(pulseSeq, 0.001);
      var flashIndex = Math.min(4, Math.floor(local * 5));
      var flashPhase = (local * 5) % 1;
      return {
        state: "flash_sequence",
        elapsed: elapsed,
        freeze: 1,
        rewindMix: 0,
        flashes: flashIndex,
        flashPulse: 1 - Math.abs(flashPhase - 0.5) * 2,
        flashSeqEnd: flashSeqEnd,
        total: total
      };
    }
    if (elapsed < rewindEnd) {
      var k1 = (elapsed - flashSeqEnd) / Math.max(rewindSec, 0.001);
      return {
        state: "rewind",
        elapsed: elapsed,
        freeze: 1,
        rewindMix: k1,
        flashes: 5,
        flashPulse: 0,
        flashSeqEnd: flashSeqEnd,
        total: total
      };
    }
    if (elapsed < total) {
      var k2 = (elapsed - rewindEnd) / Math.max(resumeSec, 0.001);
      return {
        state: "resume",
        elapsed: elapsed,
        freeze: 1 - k2,
        rewindMix: 1 - k2,
        flashes: 5,
        flashPulse: 0,
        flashSeqEnd: flashSeqEnd,
        total: total
      };
    }
    return {
      state: "normal",
      elapsed: elapsed,
      freeze: 0,
      rewindMix: 0,
      flashes: 0,
      flashPulse: 0,
      flashSeqEnd: flashSeqEnd,
      total: total
    };
  }

  function drawFreezeOverlay(ctx, width, height, life) {
    if (life.freeze <= 0.001) return;
    var cx = width * 0.5;
    var cy = height * 0.5;
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.7);
    g.addColorStop(0, "rgba(220,235,255," + (0.03 * life.freeze) + ")");
    g.addColorStop(0.35, "rgba(130,180,255," + (0.07 * life.freeze) + ")");
    g.addColorStop(1, "rgba(70,110,180," + (0.14 * life.freeze) + ")");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  function drawTemporalEchoes(ctx, effect, width, height, zoom, life, nowSec) {
    if (life.freeze <= 0.001) return;
    ensureParticles(effect);
    var cx = width * 0.5;
    var cy = height * 0.5;
    var radius = 220 * Math.max(0.78, zoom || 1);
    for (var i = 0; i < effect._echoParticles.length; i++) {
      var p = effect._echoParticles[i];
      var a = p.a + Math.sin(nowSec * 1.7 + p.wobble) * 0.06;
      var rr = radius * p.r;
      var x = cx + Math.cos(a) * rr;
      var y = cy + Math.sin(a) * rr;
      var glowR = p.size * Math.max(0.8, zoom || 1) * 7;
      var g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      g.addColorStop(0, "rgba(220,235,255," + (0.08 * life.freeze) + ")");
      g.addColorStop(0.5, "rgba(150,205,255," + (0.05 * life.freeze) + ")");
      g.addColorStop(1, "rgba(150,205,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawShipGhost(ctx, x, y, scale, angle, color, alpha, auraAlpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    if (auraAlpha > 0.001) {
      var aura = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
      aura.addColorStop(0, "rgba(180,225,255," + auraAlpha + ")");
      aura.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(220,235,255,0.18)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "rgba(8,14,28,0.88)";
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(8, -4);
    ctx.lineTo(10, 8);
    ctx.lineTo(0, 12);
    ctx.lineTo(-10, 8);
    ctx.lineTo(-8, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.globalAlpha = alpha * 0.88;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(5, -3);
    ctx.lineTo(6, 6);
    ctx.lineTo(0, 8);
    ctx.lineTo(-6, 6);
    ctx.lineTo(-5, -3);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(235,245,255,0.92)";
    ctx.beginPath();
    ctx.arc(0, -2, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawUnitEchoes(ctx, width, height, life, nowSec, camera, units) {
    if (!units || !units.length) return;
    var zoom = (camera && camera.zoom) || 1;
    var maxUnits = zoom < 0.75 ? 10 : (zoom < 1.05 ? 18 : 28);
    var drawn = 0;
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      if (!u || u.hp <= 0) continue;
      var sx = (u.x - camera.x) * zoom + width * 0.5;
      var sy = (u.y - camera.y) * zoom + height * 0.5;
      if (sx < -80 || sx > width + 80 || sy < -80 || sy > height + 80) continue;

      var seed = (u.id || i + 1);
      var orbit = hash01(seed * 7 + 13);
      var motion = life.freeze > 0.98 ? 0 : 1;
      var driftX = Math.cos(nowSec * 0.7 + orbit * Math.PI * 2) * 12 * motion * zoom;
      var driftY = Math.sin(nowSec * 0.9 + orbit * Math.PI * 6) * 10 * motion * zoom;
      var mainX = sx + driftX - 42 * life.rewindMix + (hash01(seed * 11 + 2) * 2 - 1) * 16 * life.rewindMix;
      var mainY = sy + driftY + 18 * life.rewindMix - (hash01(seed * 11 + 3) * 2 - 1) * 10 * life.rewindMix;
      var angle = u.a != null ? u.a : Math.atan2(u.vy || 0, u.vx || 1);
      var color = u._rewindColor || "#79a9ff";
      drawShipGhost(ctx, mainX, mainY, Math.max(0.48, zoom * 0.95), angle, color, 1, 0.08 * life.freeze);

      if (life.freeze > 0.1) {
        var echoX = mainX + 26 * life.rewindMix;
        var echoY = mainY - 12 * life.rewindMix;
        drawShipGhost(ctx, echoX, echoY, Math.max(0.48, zoom * 0.95), angle, color, 0.16 * life.freeze, 0);
      }
      drawn++;
      if (drawn >= maxUnits) break;
    }
  }

  function drawCentralClock(ctx, width, height, life, rewindSeconds) {
    if (life.freeze <= 0.001) return;
    var cx = width * 0.5;
    var cy = height * 0.5;
    var radius = 160;

    var halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.8);
    halo.addColorStop(0, "rgba(255,255,255," + (0.06 * life.freeze) + ")");
    halo.addColorStop(0.24, "rgba(185,225,255," + (0.08 * life.freeze) + ")");
    halo.addColorStop(1, "rgba(185,225,255,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(220,235,255," + (0.24 * life.freeze) + ")";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(150,210,255," + (0.12 * life.freeze) + ")";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    for (var i = 0; i < 12; i++) {
      var a = (Math.PI * 2 * i) / 12 - Math.PI / 2;
      var r1 = radius * 0.82;
      var r2 = i % 3 === 0 ? radius * 0.98 : radius * 0.93;
      ctx.strokeStyle = "rgba(230,242,255," + ((i % 3 === 0 ? 0.28 : 0.16) * life.freeze) + ")";
      ctx.lineWidth = i % 3 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }

    for (var j = 0; j < 5; j++) {
      var pa = -Math.PI / 2 + (Math.PI * 2 * j) / 5;
      var rr = radius * 1.18;
      var active = j < life.flashes || (life.state === "flash_sequence" && j === life.flashes);
      var pulseA = life.state === "flash_sequence" && j === life.flashes ? life.flashPulse : 0;
      var gx = cx + Math.cos(pa) * rr;
      var gy = cy + Math.sin(pa) * rr;
      var g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 18 + pulseA * 18);
      g.addColorStop(0, "rgba(255,255,255," + (active ? 0.55 + pulseA * 0.2 : 0.08) + ")");
      g.addColorStop(0.45, "rgba(190,225,255," + (active ? 0.22 + pulseA * 0.1 : 0.03) + ")");
      g.addColorStop(1, "rgba(190,225,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(gx, gy, 18 + pulseA * 18, 0, Math.PI * 2);
      ctx.fill();
    }

    var totalRewind = Math.max(1, rewindSeconds || 60);
    var rewindShown = life.rewindMix * totalRewind;
    var minuteAngle = -Math.PI / 2 - (rewindShown / totalRewind) * Math.PI * 2;
    var secondAngle = -Math.PI / 2 - (rewindShown / totalRewind) * Math.PI * 2 * 6;

    ctx.strokeStyle = "rgba(235,245,255," + (0.42 * life.freeze) + ")";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(minuteAngle) * radius * 0.58, cy + Math.sin(minuteAngle) * radius * 0.58);
    ctx.stroke();

    ctx.strokeStyle = "rgba(150,220,255," + (0.34 * life.freeze) + ")";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(secondAngle) * radius * 0.78, cy + Math.sin(secondAngle) * radius * 0.78);
    ctx.stroke();

    ctx.fillStyle = "rgba(240,248,255," + (0.86 * life.freeze) + ")";
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(230,242,255," + (0.78 * life.freeze) + ")";
    ctx.font = "700 32px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("- 00:" + (totalRewind < 10 ? "0" : "") + Math.round(totalRewind), cx, cy + 62);

    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(185,220,255," + (0.62 * life.freeze) + ")";
    ctx.fillText("TIME REWIND", cx, cy - 74);
    ctx.textAlign = "left";
  }

  function drawFlashBursts(ctx, width, height, life) {
    if (life.state !== "flash_sequence") return;
    var alpha = clamp01(life.flashPulse);
    var cx = width * 0.5;
    var cy = height * 0.5;
    var burst = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * (0.22 + alpha * 0.22));
    burst.addColorStop(0, "rgba(255,255,255," + (0.24 * alpha) + ")");
    burst.addColorStop(0.18, "rgba(220,235,255," + (0.15 * alpha) + ")");
    burst.addColorStop(0.42, "rgba(140,190,255," + (0.08 * alpha) + ")");
    burst.addColorStop(1, "rgba(140,190,255,0)");
    ctx.fillStyle = burst;
    ctx.fillRect(0, 0, width, height);
  }

  function drawApplyFlash(ctx, width, height, effect, nowSec) {
    if (effect.appliedAtReal == null) return;
    var age = Math.max(0, nowSec - effect.appliedAtReal);
    if (age > 0.55) return;
    var k = 1 - smoothstep(0, 0.55, age);
    var cx = width * 0.5;
    var cy = height * 0.5;
    var burst = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * (0.24 + k * 0.26));
    burst.addColorStop(0, "rgba(255,255,255," + (0.40 * k) + ")");
    burst.addColorStop(0.16, "rgba(215,235,255," + (0.24 * k) + ")");
    burst.addColorStop(0.34, "rgba(145,195,255," + (0.12 * k) + ")");
    burst.addColorStop(1, "rgba(145,195,255,0)");
    ctx.fillStyle = burst;
    ctx.fillRect(0, 0, width, height);
  }

  function render(effect, opts) {
    if (!effect || !effect.active || !opts || !opts.layer) {
      if (effect) hide(effect);
      return;
    }

    var width = Math.max(1, opts.width || 1);
    var height = Math.max(1, opts.height || 1);
    var nowSec = opts.nowSec || 0;
    ensureVisual(effect, opts.layer, width, height);
    ensureParticles(effect);

    var life = getLife(effect, nowSec);
    if (!effect._rewindSprite || !effect._rewindCtx) return;
    if (life.freeze <= 0.001 && effect.appliedAtReal == null) {
      effect._rewindSprite.visible = false;
      return;
    }

    var ctx = effect._rewindCtx;
    ctx.clearRect(0, 0, width, height);

    drawTemporalEchoes(ctx, effect, width, height, (opts.camera && opts.camera.zoom) || 1, life, nowSec);
    drawUnitEchoes(ctx, width, height, life, nowSec, opts.camera || { x: 0, y: 0, zoom: 1 }, opts.units || []);
    drawFreezeOverlay(ctx, width, height, life);
    drawCentralClock(ctx, width, height, life, effect.rewindSeconds || 60);
    drawFlashBursts(ctx, width, height, life);
    drawApplyFlash(ctx, width, height, effect, nowSec);

    effect._rewindSprite.visible = true;
    updateTexture(effect._rewindTexture);
  }

  function hide(effect) {
    if (effect && effect._rewindSprite) effect._rewindSprite.visible = false;
  }

  function destroy(effect) {
    if (!effect) return;
    if (effect._rewindSprite && effect._rewindSprite.parent) effect._rewindSprite.parent.removeChild(effect._rewindSprite);
    if (effect._rewindSprite && effect._rewindSprite.destroy) effect._rewindSprite.destroy({ texture: true });
    resetVisualRefs(effect);
  }

  window.TimeRewindRenderer = {
    render: render,
    hide: hide,
    destroy: destroy,
    getLife: getLife
  };
})();
