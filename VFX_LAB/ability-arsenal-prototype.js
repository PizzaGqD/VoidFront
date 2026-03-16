(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var canvas = document.getElementById("scene");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var controls = {
    effect: document.getElementById("effect"),
    variant: document.getElementById("variant"),
    palette: document.getElementById("palette"),
    lodMode: document.getElementById("lodMode"),
    tempo: document.getElementById("tempo"),
    radius: document.getElementById("radius"),
    cycleEffect: document.getElementById("cycleEffect"),
    cycleVariant: document.getElementById("cycleVariant"),
    triggerPulse: document.getElementById("triggerPulse")
  };

  var texts = {
    title: document.getElementById("variantTitle"),
    subtitle: document.getElementById("variantSubtitle"),
    status: document.getElementById("statusLine"),
    gameplay: document.getElementById("legendGameplay"),
    read: document.getElementById("legendRead"),
    focus: document.getElementById("legendFocus")
  };

  var PALETTES = {
    cyan:    { core: "#7dd6ff", trim: "#d9f6ff", line: "#6ebeff", dark: "#09131f", hull: "#183149", glow: "125,214,255" },
    amber:   { core: "#ffb86b", trim: "#ffefc9", line: "#ffcf78", dark: "#171007", hull: "#4a2d11", glow: "255,184,107" },
    violet:  { core: "#cba3ff", trim: "#f3e6ff", line: "#c28bff", dark: "#120d1f", hull: "#32224e", glow: "203,163,255" },
    crimson: { core: "#ff8aa5", trim: "#ffe1ea", line: "#ff6b8d", dark: "#180d14", hull: "#4a1b2c", glow: "255,138,165" },
    emerald: { core: "#7de1a8", trim: "#e0ffed", line: "#67d497", dark: "#0a1610", hull: "#1b4330", glow: "125,225,168" }
  };

  var VARIANTS = [
    {
      key: "plasma-lance",
      name: "Plasma Lance",
      note: "Чистый горячий импульс, собранные трассы и яркий ударный фронт.",
      read: "Лучший вариант, если suite должен ощущаться как элитное оружие большой мощности.",
      trail: 1.0,
      flicker: 0.8,
      ring: 1.0
    },
    {
      key: "ion-chisel",
      name: "Ion Chisel",
      note: "Более холодный и резкий язык: игольчатые разряды, узкие прожилки и чистые сечения.",
      read: "Хорошо продает precision-strike и технологическую агрессию.",
      trail: 0.72,
      flicker: 1.05,
      ring: 0.86
    },
    {
      key: "royal-flare",
      name: "Royal Flare",
      note: "Импакты крупнее, ореолы насыщеннее, а центр эффекта ощущается дороже и торжественнее.",
      read: "Идеален для ультимативных или legendary-способностей.",
      trail: 1.18,
      flicker: 0.62,
      ring: 1.14
    },
    {
      key: "obsidian-shard",
      name: "Obsidian Shard",
      note: "Темное ядро и резкая кромка. Больше контраста, меньше мягкой дымки.",
      read: "Хороший выбор, если визуалы не должны расползаться по экрану.",
      trail: 0.86,
      flicker: 0.92,
      ring: 0.78
    },
    {
      key: "scrap-burner",
      name: "Scrap Burner",
      note: "Грубый рейдерский язык: больше искр, горячих обломков и нестабильной геометрии трасс.",
      read: "Подходит для грязных пиратских или brute-force умений.",
      trail: 1.08,
      flicker: 1.22,
      ring: 0.94
    },
    {
      key: "signal-bloom",
      name: "Signal Bloom",
      note: "Больше HUD-ответа, сеток, цифровых колец и псевдо-сенсорного отклика.",
      read: "Лучший кандидат для телепорта, дронов и орбитального наведения.",
      trail: 0.94,
      flicker: 0.88,
      ring: 1.06
    }
  ];

  var EFFECTS = [
    {
      id: "directedMeteor",
      name: "Directed Meteor",
      gameplay: "Первая цель на траектории погибает мгновенно, если это не ядро. Дополнительно позади удара проходит AoE: 50% max HP кораблей + 100.",
      focus: "Смотрим язык трассы, импакт в первую цель и читаемость заднего AoE-шлейфа."
    },
    {
      id: "meteorSwarm",
      name: "Meteor Swarm",
      gameplay: "Пачка из 5 сонаправленных метеоров: 1 большой, 1 средний и 3 малых. Большой бьет только сильным AoE, средний вдвое слабее, малые по 10% большого.",
      focus: "Смотрим групповую композицию, массогабариты и синхронность скоростей без хаотичного роя."
    },
    {
      id: "orbitalStrike",
      name: "Orbital Strike",
      gameplay: "После выбора области идут 3 каскадных AoE-залпа по 5 выстрелов. Для каждого залпа радиус раскладки и размер поражения меняются, а каждый взрыв держит затухающий импакт ровно 1 секунду.",
      focus: "Смотрим три последовательных волны, смену радиусов, читаемость 15 точек удара и общий ритм орбитального каскада."
    },
    {
      id: "droneSwarm",
      name: "Drone Swarm",
      gameplay: "Внутри радиуса частицы и микро-дроны будто выедают корабли, не давая им спокойно стоять в зоне.",
      focus: "Смотрим плотность роя, микропоедание корпуса и радиус опасности."
    },
    {
      id: "seismobomb",
      name: "Seismobomb",
      gameplay: "Бомба ложится в точку и детонирует ровно через 3 секунды. Нужен мощный предупреждающий телеграф и тяжёлый подземный разлом.",
      focus: "Смотрим countdown, нервное ожидание и момент разрыва."
    },
    {
      id: "teleportField",
      name: "Teleport Field",
      gameplay: "Все корабли в выбранном радиусе, даже вражеские, переносятся в новую точку. Слишком близко к вражеской базе переносить нельзя. Неполный захват отряда должен визуально разбивать строй.",
      focus: "Смотрим source zone, destination zone, запрет возле вражеской базы и split-переезд строя."
    }
  ];

  var state = {
    time: 0,
    variantIndex: 0,
    effectIndex: 0,
    pulseUntil: 0,
    stars: []
  };

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function quadraticPoint(a, b, c, t) {
    var ab = lerp(a, b, t);
    var bc = lerp(b, c, t);
    return lerp(ab, bc, t);
  }

  function smoothstep(a, b, v) {
    var t = clamp01((v - a) / Math.max(0.0001, b - a));
    return t * t * (3 - 2 * t);
  }

  function hexToRgb(hex) {
    var clean = String(hex || "#000000").replace("#", "");
    var value = parseInt(clean, 16) || 0;
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }

  function rgbaHex(hex, alpha) {
    var rgb = hexToRgb(hex);
    return "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + alpha + ")";
  }

  function rgba(rgb, alpha) {
    return "rgba(" + rgb + "," + alpha + ")";
  }

  function orbitalNoise(seed) {
    var value = Math.sin(seed * 127.1 + seed * seed * 0.013) * 43758.5453123;
    return value - Math.floor(value);
  }

  function getPalette() {
    return PALETTES[controls.palette.value] || PALETTES.cyan;
  }

  function getVariant() {
    return VARIANTS[state.variantIndex] || VARIANTS[0];
  }

  function getEffect() {
    return EFFECTS[state.effectIndex] || EFFECTS[0];
  }

  function getTempo() {
    return Number(controls.tempo.value) / 100;
  }

  function getRadiusFactor() {
    return Number(controls.radius.value) / 100;
  }

  function getLodKey() {
    if (controls.lodMode.value !== "auto") return controls.lodMode.value;
    var radius = getRadiusFactor();
    var tempo = getTempo();
    if (radius > 0.78 || tempo > 1.08) return "far";
    if (radius > 0.52 || tempo > 0.82) return "mid";
    return "near";
  }

  function rebuildStars(width, height) {
    state.stars = [];
    var count = Math.max(80, Math.floor(width * height / 13000));
    for (var i = 0; i < count; i++) {
      state.stars.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.4 + Math.random() * 1.4,
        alpha: 0.1 + Math.random() * 0.5,
        depth: 0.2 + Math.random() * 0.8
      });
    }
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    var width = Math.max(320, Math.floor(rect.width));
    var height = Math.max(320, Math.floor(rect.height));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildStars(width, height);
  }

  function drawBackdrop(width, height, palette) {
    var grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "rgba(4,7,14,1)");
    grad.addColorStop(0.56, "rgba(5,9,18,1)");
    grad.addColorStop(1, "rgba(2,4,9,1)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255,255,255,0.018)";
    ctx.fillRect(0, 0, width, 1);
    ctx.fillStyle = "rgba(0,0,0,0.24)";
    ctx.fillRect(0, height - 2, width, 2);

    for (var i = 0; i < state.stars.length; i++) {
      var star = state.stars[i];
      var sx = star.x * width + Math.sin(state.time * (0.06 + star.depth * 0.16) + i * 1.7) * star.depth * 10;
      var sy = star.y * height + Math.cos(state.time * (0.08 + star.depth * 0.15) + i * 1.9) * star.depth * 7;
      ctx.beginPath();
      ctx.fillStyle = "rgba(230,238,255," + star.alpha + ")";
      ctx.arc(sx, sy, star.r, 0, TAU);
      ctx.fill();
    }
  }

  function drawShip(x, y, angle, scale, fill, edge, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.moveTo(2.8, 0);
    ctx.lineTo(1.2, -0.55);
    ctx.lineTo(0.15, -1.0);
    ctx.lineTo(-0.86, -0.56);
    ctx.lineTo(-1.42, 0);
    ctx.lineTo(-0.86, 0.56);
    ctx.lineTo(0.15, 1.0);
    ctx.lineTo(1.2, 0.55);
    ctx.closePath();
    ctx.fillStyle = rgbaHex(fill, 0.84 * alpha);
    ctx.fill();
    ctx.lineWidth = 0.18;
    ctx.strokeStyle = rgbaHex(edge, 0.72 * alpha);
    ctx.stroke();
    ctx.restore();
  }

  function drawCore(x, y, radius, palette) {
    ctx.save();
    var grad = ctx.createRadialGradient(x, y, radius * 0.08, x, y, radius);
    grad.addColorStop(0, rgbaHex(palette.trim, 0.80));
    grad.addColorStop(0.35, rgbaHex(palette.core, 0.34));
    grad.addColorStop(1, rgbaHex(palette.core, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgbaHex(palette.trim, 0.42);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.58, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawRing(x, y, radius, color, alpha, width) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.strokeStyle = rgbaHex(color, alpha);
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function drawMeteor(x, y, angle, scale, palette, variant, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    var glowLen = 34 * variant.trail;
    var grad = ctx.createLinearGradient(-glowLen, 0, 6, 0);
    grad.addColorStop(0, rgba(palette.glow, 0));
    grad.addColorStop(0.4, rgba(palette.glow, 0.24 * alpha));
    grad.addColorStop(1, rgba(palette.glow, 0.76 * alpha));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-glowLen, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();

    ctx.fillStyle = rgbaHex(palette.core, 0.86 * alpha);
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-2, -3.2);
    ctx.lineTo(-6, -1.8);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-6, 1.8);
    ctx.lineTo(-2, 3.2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = rgbaHex(palette.trim, 0.92 * alpha);
    ctx.beginPath();
    ctx.arc(1.6, 0, 1.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawTargetArea(cx, cy, radius, palette, variant) {
    var pulse = 0.5 + 0.5 * Math.sin(state.time * (1.1 + variant.flicker * 0.25));
    drawRing(cx, cy, radius, palette.line, 0.20 + pulse * 0.08, 2);
    drawRing(cx, cy, radius * 0.72, palette.core, 0.10 + pulse * 0.06, 1.2);
  }

  function getOrbitalStrikeStyle(variant, lodKey) {
    var style = {
      salvoSpread: [0.34, 0.60, 0.46],
      aoeScale: [0.13, 0.22, 0.17],
      beamLift: lodKey === "far" ? 94 : 116,
      beamWidth: 2.0 + variant.trail * 0.75,
      beamAlpha: lodKey === "far" ? 0.10 : 0.16,
      trimAlpha: 0.44,
      headRadius: 3.6,
      ringAlpha: 0.16,
      impactGlow: 0.14,
      shockWidth: 1.0,
      spikeCount: lodKey === "far" ? 4 : (lodKey === "mid" ? 6 : 8),
      sparkCount: lodKey === "far" ? 2 : (lodKey === "mid" ? 4 : 6),
      debrisAlpha: 0.50,
      markerAlpha: 0.18,
      yScale: 0.72,
      darkTrail: false,
      doubleRail: false,
      ragged: false,
      telemetry: false,
      crown: false
    };

    if (variant.key === "plasma-lance") {
      style.beamLift += 18;
      style.beamWidth = 2.6;
      style.beamAlpha = lodKey === "far" ? 0.12 : 0.22;
      style.trimAlpha = 0.58;
      style.headRadius = 4.1;
      style.ringAlpha = 0.18;
      style.impactGlow = 0.18;
      style.doubleRail = true;
      style.spikeCount += 1;
    } else if (variant.key === "ion-chisel") {
      style.salvoSpread = [0.30, 0.54, 0.40];
      style.aoeScale = [0.11, 0.19, 0.15];
      style.beamLift -= 10;
      style.beamWidth = 1.6;
      style.beamAlpha = lodKey === "far" ? 0.10 : 0.15;
      style.trimAlpha = 0.54;
      style.headRadius = 3.0;
      style.ringAlpha = 0.14;
      style.impactGlow = 0.10;
      style.shockWidth = 0.86;
      style.doubleRail = true;
      style.yScale = 0.66;
      style.sparkCount = Math.max(1, style.sparkCount - 1);
    } else if (variant.key === "royal-flare") {
      style.salvoSpread = [0.40, 0.66, 0.52];
      style.aoeScale = [0.16, 0.28, 0.22];
      style.beamLift += 30;
      style.beamWidth = 3.1;
      style.beamAlpha = lodKey === "far" ? 0.14 : 0.26;
      style.trimAlpha = 0.62;
      style.headRadius = 5.0;
      style.ringAlpha = 0.24;
      style.impactGlow = 0.24;
      style.shockWidth = 1.24;
      style.crown = true;
      style.spikeCount += 4;
      style.debrisAlpha = 0.64;
    } else if (variant.key === "obsidian-shard") {
      style.salvoSpread = [0.32, 0.52, 0.42];
      style.aoeScale = [0.12, 0.20, 0.16];
      style.beamLift -= 18;
      style.beamWidth = 1.5;
      style.beamAlpha = lodKey === "far" ? 0.06 : 0.10;
      style.trimAlpha = 0.22;
      style.headRadius = 3.0;
      style.ringAlpha = 0.10;
      style.impactGlow = 0.06;
      style.shockWidth = 0.80;
      style.debrisAlpha = 0.30;
      style.yScale = 0.62;
      style.darkTrail = true;
      style.spikeCount = Math.max(3, style.spikeCount - 2);
      style.sparkCount = Math.max(1, style.sparkCount - 2);
    } else if (variant.key === "scrap-burner") {
      style.salvoSpread = [0.36, 0.58, 0.48];
      style.aoeScale = [0.14, 0.24, 0.18];
      style.beamLift += 6;
      style.beamWidth = 2.2;
      style.beamAlpha = lodKey === "far" ? 0.12 : 0.18;
      style.trimAlpha = 0.34;
      style.headRadius = 3.9;
      style.ringAlpha = 0.18;
      style.impactGlow = 0.12;
      style.debrisAlpha = 0.78;
      style.ragged = true;
      style.spikeCount += 2;
      style.sparkCount += 2;
    } else if (variant.key === "signal-bloom") {
      style.salvoSpread = [0.35, 0.57, 0.44];
      style.aoeScale = [0.12, 0.21, 0.16];
      style.beamLift += 10;
      style.beamWidth = 1.9;
      style.beamAlpha = lodKey === "far" ? 0.10 : 0.16;
      style.trimAlpha = 0.52;
      style.headRadius = 3.3;
      style.ringAlpha = 0.18;
      style.impactGlow = 0.10;
      style.shockWidth = 0.96;
      style.doubleRail = true;
      style.telemetry = true;
      style.yScale = 0.68;
      style.spikeCount += 1;
    }

    return style;
  }

  function getOrbitalStrikeTrajectory(seed, salvoIndex, shotIndex, coreX, coreY, tx, ty, style) {
    var dx = tx - coreX;
    var dy = ty - coreY;
    var dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    var dirX = dx / dist;
    var dirY = dy / dist;
    var nx = -dirY;
    var ny = dirX;
    var baseCtrlX = lerp(coreX, tx, 0.42);
    var baseCtrlY = Math.min(coreY, ty) - style.beamLift - salvoIndex * 16 + (shotIndex - 2) * 7;
    var modeRoll = orbitalNoise(seed + 41);
    var side = (orbitalNoise(seed + 53) - 0.5) * dist * 0.34;
    var trajectory = {
      kind: "high",
      ctrlX: baseCtrlX,
      ctrlY: baseCtrlY
    };

    if (modeRoll < 0.26) {
      trajectory.kind = "straight";
      return trajectory;
    }

    if (modeRoll < 0.52) {
      trajectory.kind = "shallow";
      trajectory.ctrlX = baseCtrlX + nx * side * 0.28;
      trajectory.ctrlY = lerp(coreY, ty, 0.36) - style.beamLift * 0.34;
      return trajectory;
    }

    if (modeRoll < 0.78) {
      trajectory.kind = "high";
      trajectory.ctrlX = baseCtrlX + nx * side * 0.20;
      trajectory.ctrlY = baseCtrlY - dist * 0.06;
      return trajectory;
    }

    trajectory.kind = "swing";
    trajectory.ctrlX = baseCtrlX + nx * side * 0.95;
    trajectory.ctrlY = baseCtrlY - dist * 0.02;
    return trajectory;
  }

  function getOrbitalStrikeTrajectoryPoint(coreX, coreY, tx, ty, trajectory, travel) {
    if (trajectory.kind === "straight") {
      return {
        x: lerp(coreX, tx, travel),
        y: lerp(coreY, ty, travel)
      };
    }

    return {
      x: quadraticPoint(coreX, trajectory.ctrlX, tx, travel),
      y: quadraticPoint(coreY, trajectory.ctrlY, ty, travel)
    };
  }

  function drawMeteorSparkField(x, y, angle, count, spread, distance, palette, alpha) {
    for (var i = 0; i < count; i++) {
      var t = count <= 1 ? 0.5 : i / (count - 1);
      var localAng = angle + (t - 0.5) * spread + Math.sin(state.time * 1.4 + i * 1.7) * 0.05;
      var len = 8 + (i % 3) * 4;
      var sx = x - Math.cos(localAng) * distance * (0.68 + t * 0.38);
      var sy = y - Math.sin(localAng) * distance * (0.68 + t * 0.38);
      var ex = sx - Math.cos(localAng) * len;
      var ey = sy - Math.sin(localAng) * len;
      ctx.strokeStyle = rgba(palette.glow, alpha * (0.35 + (i % 4) * 0.08));
      ctx.lineWidth = 1 + (i % 2) * 0.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
  }

  function drawTelemetryBrackets(x, y, radius, palette, alpha) {
    var corner = radius * 0.26;
    ctx.strokeStyle = rgbaHex(palette.trim, alpha);
    ctx.lineWidth = 2;
    for (var i = 0; i < 4; i++) {
      var sx = i < 2 ? -1 : 1;
      var sy = i % 2 === 0 ? -1 : 1;
      var px = x + sx * radius;
      var py = y + sy * radius;
      ctx.beginPath();
      ctx.moveTo(px, py + sy * corner);
      ctx.lineTo(px, py);
      ctx.lineTo(px + sx * corner, py);
      ctx.stroke();
    }
  }

  function drawMeteorBodyStyled(x, y, angle, scale, palette, style, alpha) {
    var tailLen = 34 * style.tailLen;
    var tailW = 4.4 * style.tailWidth;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    var tailGrad = ctx.createLinearGradient(-tailLen, 0, 8, 0);
    tailGrad.addColorStop(0, rgba(palette.glow, 0));
    tailGrad.addColorStop(style.darkCore ? 0.18 : 0.34, rgba(palette.glow, 0.10 * alpha));
    tailGrad.addColorStop(1, rgba(palette.glow, 0.74 * alpha));
    ctx.fillStyle = tailGrad;
    ctx.beginPath();
    ctx.moveTo(6.5, 0);
    ctx.lineTo(-3.8, -tailW);
    ctx.lineTo(-tailLen, -tailW * 0.28);
    ctx.lineTo(-tailLen * 0.56, 0);
    ctx.lineTo(-tailLen, tailW * 0.28);
    ctx.lineTo(-3.8, tailW);
    ctx.closePath();
    ctx.fill();

    for (var i = 0; i < style.striationCount; i++) {
      var frac = (i + 1) / (style.striationCount + 1);
      var offs = (frac - 0.5) * tailW * 1.55;
      ctx.strokeStyle = rgbaHex(palette.trim, alpha * 0.08 * (1 - Math.abs(frac - 0.5) * 1.2));
      ctx.lineWidth = 0.36 + frac * 0.12;
      ctx.beginPath();
      ctx.moveTo(-tailLen * 0.88, offs);
      ctx.lineTo(-5, offs * 0.42);
      ctx.stroke();
    }

    ctx.fillStyle = style.darkCore ? rgbaHex(palette.dark, 0.96 * alpha) : rgbaHex(palette.core, 0.90 * alpha);
    ctx.beginPath();
    ctx.moveTo(6.6, 0);
    ctx.lineTo(3.2, -2.5 * style.coreTall);
    ctx.lineTo(-0.8, -3.5);
    ctx.lineTo(-4.8, -2.1);
    ctx.lineTo(-7.0, -0.2);
    ctx.lineTo(-6.1, 2.0);
    ctx.lineTo(-1.6, 3.6);
    ctx.lineTo(2.8, 2.5 * style.coreTall);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = style.darkCore ? rgbaHex(palette.trim, 0.26 * alpha) : rgbaHex(palette.trim, 0.56 * alpha);
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.fillStyle = rgbaHex(style.darkCore ? palette.core : palette.trim, (style.darkCore ? 0.42 : 0.88) * alpha);
    ctx.beginPath();
    ctx.arc(2.1, -0.1, 1.55, 0, TAU);
    ctx.fill();

    ctx.fillStyle = rgbaHex(palette.core, (style.darkCore ? 0.28 : 0.16) * alpha);
    ctx.beginPath();
    ctx.moveTo(3.8, 0.2);
    ctx.lineTo(0.6, -1.6);
    ctx.lineTo(-2.7, -1.0);
    ctx.lineTo(-3.5, 0.8);
    ctx.lineTo(-0.4, 1.9);
    ctx.closePath();
    ctx.fill();

    if (style.signal) {
      ctx.strokeStyle = rgbaHex(palette.trim, 0.24 * alpha);
      ctx.lineWidth = 0.34;
      ctx.beginPath();
      ctx.arc(-0.8, 0, 5.6, -0.7, 0.7);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawMeteorFlightAura(x, y, angle, scale, palette, style, alpha) {
    var dirX = Math.cos(angle);
    var dirY = Math.sin(angle);
    var nx = -dirY;
    var ny = dirX;
    var haloR = scale * (3.1 + style.tailWidth * 0.85);
    var halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
    halo.addColorStop(0, rgbaHex(palette.trim, 0.14 * alpha));
    halo.addColorStop(0.45, rgbaHex(palette.core, 0.10 * alpha));
    halo.addColorStop(1, rgbaHex(palette.core, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, TAU);
    ctx.fill();

    var shardCount = style.flightFxCount || 8;
    for (var i = 0; i < shardCount; i++) {
      var t = shardCount <= 1 ? 0.5 : i / (shardCount - 1);
      var wave = state.time * (1.8 + style.tailLen * 0.35) + i * 1.37;
      var along = 12 + t * (28 + scale * 1.6);
      var side = Math.sin(wave) * (4 + style.tailWidth * 4) + (t - 0.5) * 12;
      var px = x - dirX * along + nx * side;
      var py = y - dirY * along + ny * side;
      var len = 6 + (i % 3) * 3;
      ctx.strokeStyle = rgba(palette.glow, alpha * (0.16 + (i % 4) * 0.05));
      ctx.lineWidth = 1 + (i % 2) * 0.45;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - dirX * len + nx * Math.sin(wave * 1.4) * 2.2, py - dirY * len + ny * Math.sin(wave * 1.4) * 2.2);
      ctx.stroke();

      if (i % 2 === 0) {
        ctx.fillStyle = rgbaHex(palette.trim, alpha * 0.22);
        ctx.beginPath();
        ctx.arc(px + nx * 1.4, py + ny * 1.4, 1.2 + (i % 3) * 0.28, 0, TAU);
        ctx.fill();
      }
    }
  }

  function drawImpactDebris(x, y, angle, radius, palette, alpha, lodKey, variant) {
    var count = lodKey === "far" ? 6 : (lodKey === "mid" ? 10 : 16);
    if (variant.key === "scrap-burner") count += lodKey === "far" ? 2 : 4;
    if (variant.key === "royal-flare") count += lodKey === "near" ? 2 : 1;
    if (variant.key === "obsidian-shard") count = Math.max(4, count - 2);
    for (var i = 0; i < count; i++) {
      var t = count <= 1 ? 0.5 : i / (count - 1);
      var ang = angle + (t - 0.5) * 2.4 + Math.sin(i * 2.13) * 0.16;
      var dist = radius * (0.16 + t * 0.72);
      var len = 6 + (i % 4) * 2 + (variant.key === "obsidian-shard" ? 2 : 0);
      var px = x + Math.cos(ang) * dist;
      var py = y + Math.sin(ang) * dist;
      var ex = px + Math.cos(ang) * len;
      var ey = py + Math.sin(ang) * len;
      ctx.strokeStyle = variant.key === "obsidian-shard"
        ? rgbaHex(palette.trim, alpha * (0.10 + (i % 3) * 0.05))
        : rgba(palette.glow, alpha * (0.14 + (i % 4) * 0.05));
      ctx.lineWidth = 1.1 + (i % 2) * 0.55;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      if (lodKey !== "far" || i % 2 === 0) {
        ctx.fillStyle = rgbaHex(palette.trim, alpha * 0.16);
        ctx.beginPath();
        ctx.arc(px, py, 1.1 + (i % 3) * 0.35, 0, TAU);
        ctx.fill();
      }
    }
  }

  function drawDirectedMeteor(width, height, palette, variant, lodKey) {
    var tempo = getTempo();
    var radius = lerp(90, 170, getRadiusFactor());
    var impactX = width * 0.68;
    var impactY = height * 0.48;
    var startX = -140;
    var startY = height * 0.16;
    var flightDurationSec = 0.42 / Math.max(0.45, tempo);
    var impactFadeDurationSec = 1.5;
    var totalCycleSec = flightDurationSec + impactFadeDurationSec;
    var cycleSec = state.time % totalCycleSec;
    var travelK = clamp01(cycleSec / flightDurationSec);
    var mx = lerp(startX, impactX, travelK);
    var my = lerp(startY, impactY, travelK);
    var shipX = width * 0.61;
    var shipY = height * 0.42;
    var impactAge = Math.max(0, cycleSec - flightDurationSec);
    var hitRise = smoothstep(flightDurationSec - 0.06, flightDurationSec + 0.10, cycleSec);
    var hitFade = 1 - smoothstep(0, impactFadeDurationSec, impactAge);
    var hitK = hitRise * hitFade;
    var debrisK = hitRise * (1 - smoothstep(0.06, impactFadeDurationSec, impactAge));
    var meteorAlpha = 1 - smoothstep(flightDurationSec - 0.01, flightDurationSec + 0.08, cycleSec);
    var angle = Math.atan2(impactY - startY, impactX - startX);
    var dirX = Math.cos(angle);
    var dirY = Math.sin(angle);
    var nx = -dirY;
    var ny = dirX;
    var style = {
      tailLen: 1.12,
      tailWidth: 1.0,
      coreTall: 1.0,
      striationCount: 3,
      darkCore: false,
      signal: false,
      trailAlpha: 0.16,
      corridorAlpha: 0.12,
      sparkCount: lodKey === "far" ? 6 : 10,
      flightFxCount: lodKey === "far" ? 7 : 13
    };

    if (variant.key === "plasma-lance") {
      style.tailLen = 1.44;
      style.tailWidth = 0.84;
      style.coreTall = 1.34;
      style.striationCount = 4;
      style.trailAlpha = 0.22;
      style.corridorAlpha = 0.14;
      style.flightFxCount += 1;
    } else if (variant.key === "ion-chisel") {
      style.tailLen = 1.08;
      style.tailWidth = 0.64;
      style.coreTall = 1.52;
      style.striationCount = 5;
      style.trailAlpha = 0.14;
      style.corridorAlpha = 0.08;
      style.flightFxCount -= 1;
    } else if (variant.key === "royal-flare") {
      style.tailLen = 1.60;
      style.tailWidth = 1.30;
      style.coreTall = 1.10;
      style.striationCount = 4;
      style.trailAlpha = 0.24;
      style.corridorAlpha = 0.16;
      style.sparkCount += 2;
      style.flightFxCount += 3;
    } else if (variant.key === "obsidian-shard") {
      style.tailLen = 0.86;
      style.tailWidth = 0.72;
      style.coreTall = 0.92;
      style.striationCount = 2;
      style.darkCore = true;
      style.trailAlpha = 0.10;
      style.corridorAlpha = 0.06;
      style.flightFxCount -= 2;
    } else if (variant.key === "scrap-burner") {
      style.tailLen = 1.22;
      style.tailWidth = 1.08;
      style.coreTall = 0.98;
      style.striationCount = 2;
      style.darkCore = true;
      style.trailAlpha = 0.18;
      style.corridorAlpha = 0.10;
      style.sparkCount += 4;
      style.flightFxCount += 4;
    } else if (variant.key === "signal-bloom") {
      style.tailLen = 1.02;
      style.tailWidth = 0.78;
      style.coreTall = 1.06;
      style.striationCount = 4;
      style.signal = true;
      style.trailAlpha = 0.12;
      style.corridorAlpha = 0.10;
      style.flightFxCount += 2;
    }

    drawTargetArea(impactX, impactY, radius * 0.58, palette, variant);
    drawShip(shipX, shipY, 0.12, 12, palette.hull, palette.trim, 1 - hitK * 0.72);
    drawShip(impactX + 52, impactY + 26, -0.1, 10, palette.hull, palette.trim, 0.68);
    drawShip(impactX + 96, impactY - 18, 0.18, 8, palette.hull, palette.trim, 0.52);

    if (lodKey !== "far") {
      ctx.strokeStyle = rgba(palette.glow, style.trailAlpha);
      ctx.lineWidth = 1.4 + variant.trail * 0.8;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(mx, my);
      ctx.stroke();
    }

    if (variant.key === "plasma-lance" || variant.key === "royal-flare") {
      ctx.strokeStyle = rgbaHex(palette.trim, (variant.key === "royal-flare" ? 0.26 : 0.18) * meteorAlpha);
      ctx.lineWidth = variant.key === "royal-flare" ? 3.2 : 2.2;
      ctx.beginPath();
      ctx.moveTo(mx - dirX * 120, my - dirY * 120);
      ctx.lineTo(mx + dirX * 34, my + dirY * 34);
      ctx.stroke();
    }

    if (variant.key === "ion-chisel") {
      for (var i = -1; i <= 1; i += 2) {
        ctx.strokeStyle = rgbaHex(palette.trim, 0.18 * meteorAlpha);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(mx - dirX * 64 + nx * i * 18, my - dirY * 64 + ny * i * 18);
        ctx.lineTo(mx + dirX * 18 + nx * i * 8, my + dirY * 18 + ny * i * 8);
        ctx.stroke();
      }
    }

    if (variant.key === "signal-bloom") {
      drawTelemetryBrackets(impactX, impactY, radius * 0.42, palette, 0.32);
      for (var s = 0; s < 4; s++) {
        var frac = (s + 1) / 5;
        var px = lerp(startX, impactX, frac);
        var py = lerp(startY, impactY, frac);
        drawTelemetryBrackets(px, py, 12 + s * 3, palette, 0.10 + s * 0.04);
      }
    }

    if (variant.key === "obsidian-shard") {
      ctx.strokeStyle = rgbaHex(palette.trim, 0.09);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(impactX, impactY);
      ctx.stroke();
    } else if (variant.key !== "ion-chisel") {
      var halfW = radius * 0.12;
      ctx.fillStyle = rgba(palette.glow, style.corridorAlpha * 0.7);
      ctx.beginPath();
      ctx.moveTo(startX + nx * halfW, startY + ny * halfW);
      ctx.lineTo(impactX + nx * halfW, impactY + ny * halfW);
      ctx.lineTo(impactX - nx * halfW, impactY - ny * halfW);
      ctx.lineTo(startX - nx * halfW, startY - ny * halfW);
      ctx.closePath();
      ctx.fill();
    }

    if (meteorAlpha > 0.02) {
      var meteorScale = 8.8 + variant.ring * 0.9;
      drawMeteorFlightAura(mx, my, angle, meteorScale, palette, style, meteorAlpha);
      drawMeteorSparkField(mx, my, angle, style.sparkCount + 4, 1.05, 34 * style.tailLen, palette, 0.40 * meteorAlpha);
      drawMeteorBodyStyled(mx, my, angle, meteorScale, palette, style, meteorAlpha);
    }

    if (hitK > 0.01) {
      var flashR = radius * (0.54 + hitK * 0.82) * variant.ring;
      var grad = ctx.createRadialGradient(impactX, impactY, 0, impactX, impactY, flashR);
      grad.addColorStop(0, rgbaHex(palette.trim, 0.96 * hitK));
      grad.addColorStop(0.22, rgbaHex(palette.core, 0.42 * hitK));
      grad.addColorStop(1, rgbaHex(palette.core, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(impactX, impactY, flashR, 0, TAU);
      ctx.fill();

      drawRing(impactX, impactY, flashR, palette.trim, 0.68 * hitK, 4.8);
      drawRing(impactX, impactY, flashR * 1.28, palette.core, 0.34 * hitK, 3.2);
      drawRing(impactX, impactY, flashR * 1.62, palette.trim, 0.18 * hitK, 1.9);

      ctx.strokeStyle = rgba(palette.glow, 0.26 * hitK);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(impactX - dirX * flashR * 0.18, impactY - dirY * flashR * 0.18);
      ctx.lineTo(impactX + dirX * flashR * 0.94, impactY + dirY * flashR * 0.94);
      ctx.stroke();

      ctx.strokeStyle = rgbaHex(palette.trim, 0.48 * hitK);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(shipX - 18, shipY - 12);
      ctx.lineTo(shipX + 22, shipY + 8);
      ctx.stroke();

      if (variant.key === "plasma-lance") {
        ctx.strokeStyle = rgbaHex(palette.trim, 0.54 * hitK);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(impactX - dirX * flashR * 0.56, impactY - dirY * flashR * 0.56);
        ctx.lineTo(impactX + dirX * flashR * 0.30, impactY + dirY * flashR * 0.30);
        ctx.stroke();
      } else if (variant.key === "ion-chisel") {
        for (var j = 0; j < 2; j++) {
          var slashAng = angle + (j === 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
          ctx.strokeStyle = rgbaHex(palette.trim, 0.46 * hitK);
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(impactX - Math.cos(slashAng) * flashR * 0.42, impactY - Math.sin(slashAng) * flashR * 0.42);
          ctx.lineTo(impactX + Math.cos(slashAng) * flashR * 0.42, impactY + Math.sin(slashAng) * flashR * 0.42);
          ctx.stroke();
        }
      } else if (variant.key === "royal-flare") {
        for (var k = 0; k < 10; k++) {
          var burstAng = (k / 10) * TAU + state.time * 0.12;
          ctx.strokeStyle = rgba(palette.glow, 0.24 * hitK);
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(impactX + Math.cos(burstAng) * 12, impactY + Math.sin(burstAng) * 12);
          ctx.lineTo(impactX + Math.cos(burstAng) * flashR * 1.18, impactY + Math.sin(burstAng) * flashR * 1.18);
          ctx.stroke();
        }
      } else if (variant.key === "obsidian-shard") {
        for (var q = 0; q < 6; q++) {
          var shardAng = angle + (q - 2.5) * 0.24;
          ctx.strokeStyle = rgbaHex(palette.trim, 0.24 * hitK);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(impactX, impactY);
          ctx.lineTo(impactX + Math.cos(shardAng) * flashR * (0.6 + q * 0.08), impactY + Math.sin(shardAng) * flashR * (0.6 + q * 0.08));
          ctx.stroke();
        }
      } else if (variant.key === "scrap-burner") {
        drawMeteorSparkField(impactX, impactY, angle, lodKey === "far" ? 7 : 12, 1.5, 18 + flashR * 0.4, palette, 0.40 * hitK);
      } else if (variant.key === "signal-bloom") {
        drawTelemetryBrackets(impactX, impactY, flashR * 0.84, palette, 0.46 * hitK);
        drawTelemetryBrackets(impactX, impactY, flashR * 1.12, palette, 0.22 * hitK);
      }

      ctx.strokeStyle = rgba(palette.glow, 0.30 * hitK);
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(impactX, impactY);
      ctx.lineTo(impactX + 76, impactY + 26);
      ctx.lineTo(impactX + 118, impactY - 16);
      ctx.stroke();
    }

    if (debrisK > 0.01) {
      drawImpactDebris(impactX, impactY, angle, radius * (0.24 + debrisK * 0.62), palette, debrisK, lodKey, variant);
    }
  }

  function getMeteorSwarmStyle(variant, lodKey) {
    var style = {
      tailLen: 1.08,
      tailWidth: 0.94,
      coreTall: 1.0,
      striationCount: 3,
      darkCore: false,
      signal: false,
      trailAlpha: lodKey === "far" ? 0.10 : 0.16,
      corridorAlpha: 0.09,
      sparkCount: lodKey === "far" ? 5 : (lodKey === "mid" ? 8 : 11),
      flightFxCount: lodKey === "far" ? 6 : (lodKey === "mid" ? 9 : 13),
      impactGlow: 0.18,
      impactRingAlpha: 0.26,
      debrisAlpha: 0.48,
      markerAlpha: 0.16,
      spreadBoost: 1.0,
      sizeBoost: 1.0,
      telemetry: false,
      crown: false,
      ragged: false,
      shockWidth: 1.0
    };

    if (variant.key === "plasma-lance") {
      style.tailLen = 1.34;
      style.tailWidth = 0.84;
      style.coreTall = 1.22;
      style.striationCount = 4;
      style.trailAlpha = lodKey === "far" ? 0.12 : 0.22;
      style.corridorAlpha = 0.12;
      style.impactGlow = 0.22;
      style.impactRingAlpha = 0.30;
      style.sizeBoost = 1.06;
    } else if (variant.key === "ion-chisel") {
      style.tailLen = 0.98;
      style.tailWidth = 0.70;
      style.coreTall = 1.40;
      style.striationCount = 5;
      style.trailAlpha = lodKey === "far" ? 0.09 : 0.14;
      style.corridorAlpha = 0.07;
      style.impactGlow = 0.12;
      style.impactRingAlpha = 0.20;
      style.spreadBoost = 0.90;
      style.sizeBoost = 0.94;
      style.shockWidth = 0.86;
    } else if (variant.key === "royal-flare") {
      style.tailLen = 1.48;
      style.tailWidth = 1.20;
      style.coreTall = 1.08;
      style.striationCount = 4;
      style.trailAlpha = lodKey === "far" ? 0.14 : 0.25;
      style.corridorAlpha = 0.15;
      style.sparkCount += 2;
      style.flightFxCount += 2;
      style.impactGlow = 0.28;
      style.impactRingAlpha = 0.34;
      style.debrisAlpha = 0.58;
      style.spreadBoost = 1.10;
      style.sizeBoost = 1.12;
      style.crown = true;
      style.shockWidth = 1.18;
    } else if (variant.key === "obsidian-shard") {
      style.tailLen = 0.86;
      style.tailWidth = 0.72;
      style.coreTall = 0.92;
      style.striationCount = 2;
      style.darkCore = true;
      style.trailAlpha = lodKey === "far" ? 0.06 : 0.10;
      style.corridorAlpha = 0.05;
      style.sparkCount = Math.max(3, style.sparkCount - 3);
      style.flightFxCount = Math.max(4, style.flightFxCount - 3);
      style.impactGlow = 0.08;
      style.impactRingAlpha = 0.14;
      style.debrisAlpha = 0.30;
      style.spreadBoost = 0.92;
      style.shockWidth = 0.78;
    } else if (variant.key === "scrap-burner") {
      style.tailLen = 1.18;
      style.tailWidth = 1.04;
      style.coreTall = 0.98;
      style.striationCount = 2;
      style.darkCore = true;
      style.trailAlpha = lodKey === "far" ? 0.12 : 0.18;
      style.corridorAlpha = 0.10;
      style.sparkCount += 4;
      style.flightFxCount += 3;
      style.impactGlow = 0.14;
      style.impactRingAlpha = 0.22;
      style.debrisAlpha = 0.76;
      style.ragged = true;
    } else if (variant.key === "signal-bloom") {
      style.tailLen = 0.98;
      style.tailWidth = 0.78;
      style.coreTall = 1.04;
      style.striationCount = 4;
      style.signal = true;
      style.trailAlpha = lodKey === "far" ? 0.10 : 0.15;
      style.corridorAlpha = 0.08;
      style.impactGlow = 0.12;
      style.impactRingAlpha = 0.22;
      style.telemetry = true;
      style.spreadBoost = 0.96;
    }

    return style;
  }

  function drawMeteorSwarm(width, height, palette, variant, lodKey) {
    var tempo = getTempo();
    var radius = lerp(84, 156, getRadiusFactor());
    var impactX = width * 0.70;
    var impactY = height * 0.50;
    var style = getMeteorSwarmStyle(variant, lodKey);
    var prepSec = 0.22;
    var flightBaseSec = 0.84 / Math.max(0.52, tempo);
    var staggerSec = 0.10 / Math.max(0.60, tempo);
    var impactFadeSec = 0.95;
    var lastArrivalSec = prepSec + staggerSec * 4 + flightBaseSec / 0.86;
    var totalCycleSec = lastArrivalSec + impactFadeSec + 0.42;
    var cycleSec = state.time % totalCycleSec;
    var baseSizes = [8.3, 5.8, 4.4, 3.6, 3.2];
    var swarmPulse = 0.5 + 0.5 * Math.sin(state.time * (0.86 + variant.flicker * 0.18));
    var clusterRadius = radius * (0.48 + swarmPulse * 0.08);
    var groupBurst = smoothstep(prepSec + flightBaseSec * 0.24, lastArrivalSec, cycleSec) * (1 - smoothstep(lastArrivalSec, lastArrivalSec + impactFadeSec, cycleSec));

    drawTargetArea(impactX, impactY, radius, palette, variant);
    drawRing(impactX, impactY, clusterRadius, palette.trim, 0.10 + swarmPulse * 0.08, 1.8);
    drawRing(impactX, impactY, clusterRadius * 0.66, palette.core, 0.06 + swarmPulse * 0.05, 1.1);
    drawShip(impactX + 54, impactY + 30, -0.08, 10, palette.hull, palette.trim, 0.66);
    drawShip(impactX + 94, impactY - 18, 0.18, 8, palette.hull, palette.trim, 0.48);

    if (style.telemetry) {
      drawTelemetryBrackets(impactX, impactY, radius * 0.60, palette, 0.22);
    }

    if (groupBurst > 0.01) {
      drawRing(impactX, impactY, clusterRadius * (0.54 + groupBurst * 0.52), palette.trim, 0.12 * groupBurst, 2.2 * style.shockWidth);
      drawRing(impactX, impactY, clusterRadius * (0.24 + groupBurst * 0.24), palette.core, 0.08 * groupBurst, 4.6);
    }

    for (var i = 0; i < 5; i++) {
      var seed = 211 + i * 37;
      var spreadAngle = -1.06 + (i / 5) * TAU + (orbitalNoise(seed) - 0.5) * 0.24;
      var spreadRadius = clusterRadius * (0.22 + orbitalNoise(seed + 7) * 0.54 * style.spreadBoost);
      var tx = impactX + Math.cos(spreadAngle) * spreadRadius;
      var ty = impactY + Math.sin(spreadAngle) * spreadRadius * 0.64 + (orbitalNoise(seed + 13) - 0.5) * radius * 0.08;
      var startX = -150 + i * 42 + orbitalNoise(seed + 17) * 92;
      var startY = height * 0.08 - 150 - i * 18 - orbitalNoise(seed + 19) * 70;
      var speedMul = 0.86 + orbitalNoise(seed + 23) * 0.30;
      var flightDurationSec = flightBaseSec / speedMul;
      var launchTime = prepSec + i * staggerSec;
      var arrivalTime = launchTime + flightDurationSec;
      var launchAge = cycleSec - launchTime;
      var impactAge = cycleSec - arrivalTime;
      var scale = baseSizes[i] * (0.94 + orbitalNoise(seed + 29) * 0.20) * style.sizeBoost;
      var aoeRadius = radius * (0.13 + orbitalNoise(seed + 31) * 0.13) * variant.ring;
      var markerLead = launchTime - cycleSec;
      var markerK = markerLead > 0 ? 1 - clamp01(markerLead / 0.48) : 1 - smoothstep(0, 0.30, -markerLead);
      var markerAlpha = (0.05 + markerK * style.markerAlpha) * (impactAge > 0 ? 0.32 : 1);
      var angle = Math.atan2(ty - startY, tx - startX);
      var dirX = Math.cos(angle);
      var dirY = Math.sin(angle);
      var nx = -dirY;
      var ny = dirX;

      drawRing(tx, ty, aoeRadius * 0.62, palette.line, markerAlpha, 1.0);
      drawRing(tx, ty, aoeRadius * 0.28, palette.trim, markerAlpha * 1.12, 1.6);

      if (style.telemetry) {
        drawTelemetryBrackets(tx, ty, aoeRadius * 0.90, palette, markerAlpha * 0.76);
      }

      if (launchAge >= 0 && launchAge <= flightDurationSec + 0.04) {
        var travel = clamp01(launchAge / flightDurationSec);
        var eased = smoothstep(0, 1, travel);
        var mx = lerp(startX, tx, eased);
        var my = lerp(startY, ty, eased);
        var meteorAlpha = 1 - smoothstep(0.86, 1.02, travel);
        var wakeLen = (lodKey === "far" ? 40 : 62) * (0.88 + speedMul * 0.24) * style.tailLen;
        var wakeStartX = mx - dirX * wakeLen;
        var wakeStartY = my - dirY * wakeLen;

        ctx.save();
        ctx.strokeStyle = style.darkCore ? rgbaHex(palette.trim, 0.10 * meteorAlpha) : rgba(palette.glow, style.trailAlpha * meteorAlpha);
        ctx.lineWidth = scale * 0.34;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(wakeStartX, wakeStartY);
        ctx.lineTo(mx, my);
        ctx.stroke();

        if (variant.key === "plasma-lance" || variant.key === "royal-flare") {
          ctx.strokeStyle = rgbaHex(palette.trim, (variant.key === "royal-flare" ? 0.24 : 0.18) * meteorAlpha);
          ctx.lineWidth = variant.key === "royal-flare" ? 2.8 : 2.1;
          ctx.beginPath();
          ctx.moveTo(mx - dirX * wakeLen * 1.3, my - dirY * wakeLen * 1.3);
          ctx.lineTo(mx + dirX * 14, my + dirY * 14);
          ctx.stroke();
        } else if (variant.key === "ion-chisel") {
          for (var rail = -1; rail <= 1; rail += 2) {
            ctx.strokeStyle = rgbaHex(palette.trim, 0.16 * meteorAlpha);
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(wakeStartX + nx * rail * 10, wakeStartY + ny * rail * 10);
            ctx.lineTo(mx + nx * rail * 4, my + ny * rail * 4);
            ctx.stroke();
          }
        }
        ctx.restore();

        drawMeteorFlightAura(mx, my, angle, scale, palette, style, meteorAlpha);
        drawMeteorSparkField(
          mx,
          my,
          angle,
          style.sparkCount,
          style.ragged ? 1.30 : 1.02,
          30 * style.tailLen,
          palette,
          (style.ragged ? 0.42 : 0.30) * meteorAlpha
        );
        drawMeteorBodyStyled(mx, my, angle, scale, palette, style, meteorAlpha);
      }

      if (impactAge >= 0 && impactAge <= impactFadeSec) {
        var impactFade = 1 - smoothstep(0, impactFadeSec, impactAge);
        var impactExpand = smoothstep(0, impactFadeSec, impactAge);
        var flashR = aoeRadius * (0.38 + impactExpand * 0.92);
        var coreR = aoeRadius * (0.12 + impactExpand * 0.22);
        var burst = ctx.createRadialGradient(tx, ty, 0, tx, ty, flashR);
        burst.addColorStop(0, style.darkCore ? rgbaHex(palette.dark, 0.90 * impactFade) : rgbaHex(palette.trim, 0.92 * impactFade));
        burst.addColorStop(0.24, rgbaHex(palette.trim, 0.26 * impactFade));
        burst.addColorStop(0.52, rgbaHex(palette.core, style.impactGlow * impactFade));
        burst.addColorStop(1, rgbaHex(palette.core, 0));
        ctx.fillStyle = burst;
        ctx.beginPath();
        ctx.arc(tx, ty, flashR, 0, TAU);
        ctx.fill();

        ctx.fillStyle = style.darkCore ? rgbaHex(palette.dark, 0.88 * impactFade) : rgbaHex(palette.trim, 0.88 * impactFade);
        ctx.beginPath();
        ctx.arc(tx, ty, coreR, 0, TAU);
        ctx.fill();

        drawRing(tx, ty, flashR * 0.86, palette.trim, style.impactRingAlpha * impactFade, 2.3 * style.shockWidth);
        drawRing(tx, ty, flashR * 1.12, palette.core, 0.18 * impactFade, 1.5 * style.shockWidth);
        drawRing(tx, ty, flashR * 0.58, palette.line, 0.10 * impactFade, 1.0);

        if (style.crown) {
          for (var crown = 0; crown < 8; crown++) {
            var crownAng = (crown / 8) * TAU + i * 0.2 + state.time * 0.10;
            ctx.strokeStyle = rgba(palette.glow, 0.18 * impactFade);
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(tx + Math.cos(crownAng) * 8, ty + Math.sin(crownAng) * 8);
            ctx.lineTo(tx + Math.cos(crownAng) * flashR * 1.16, ty + Math.sin(crownAng) * flashR * 1.16);
            ctx.stroke();
          }
        } else if (variant.key === "ion-chisel") {
          for (var slash = 0; slash < 2; slash++) {
            var slashAng = angle + (slash === 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
            ctx.strokeStyle = rgbaHex(palette.trim, 0.34 * impactFade);
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(tx - Math.cos(slashAng) * flashR * 0.34, ty - Math.sin(slashAng) * flashR * 0.34);
            ctx.lineTo(tx + Math.cos(slashAng) * flashR * 0.34, ty + Math.sin(slashAng) * flashR * 0.34);
            ctx.stroke();
          }
        } else if (style.ragged) {
          drawMeteorSparkField(tx, ty, angle, lodKey === "far" ? 6 : 10, 1.6, 14 + flashR * 0.36, palette, 0.30 * impactFade);
        }

        if (style.telemetry) {
          drawTelemetryBrackets(tx, ty, flashR * 0.82, palette, 0.30 * impactFade);
        }

        drawImpactDebris(
          tx,
          ty,
          angle,
          aoeRadius * (0.18 + impactExpand * 0.72),
          palette,
          impactFade * style.debrisAlpha,
          lodKey,
          variant
        );
      }
    }
  }

  function drawOrbitalStrike(width, height, palette, variant, lodKey) {
    var tempo = getTempo();
    var radius = lerp(78, 150, getRadiusFactor());
    var coreX = width * 0.23;
    var coreY = height * 0.76;
    var zoneX = width * 0.73;
    var zoneY = height * 0.47;
    var style = getOrbitalStrikeStyle(variant, lodKey);
    var flightDurationSec = 0.68 / Math.max(0.52, tempo);
    var shotIntervalSec = 0.082 / Math.max(0.60, tempo);
    var salvoGapSec = 0.36 / Math.max(0.60, tempo);
    var impactFadeDurationSec = 1.0;
    var salvoBlockSec = shotIntervalSec * 5 + salvoGapSec;
    var totalCycleSec = salvoBlockSec * 3 + flightDurationSec + impactFadeDurationSec + 0.26;
    var cycleSec = state.time % totalCycleSec;
    var tickCount = style.telemetry ? 20 : 16;

    // Stable seeds keep the 3x5 orbital pattern readable instead of reshuffling every frame.
    drawCore(coreX, coreY, 42, palette);
    drawShip(zoneX - radius * 0.22, zoneY - radius * 0.16, 0.18, 9.6, palette.hull, palette.trim, 0.76);
    drawShip(zoneX + radius * 0.28, zoneY + radius * 0.10, -0.08, 8.8, palette.hull, palette.trim, 0.70);
    drawShip(zoneX + radius * 0.06, zoneY - radius * 0.30, 0.30, 7.4, palette.hull, palette.trim, 0.54);

    ctx.save();
    ctx.setLineDash(style.telemetry ? [8, 10] : [12, 14]);
    ctx.lineDashOffset = -state.time * (style.telemetry ? 30 : 18);
    drawRing(zoneX, zoneY, radius, palette.line, 0.14, 2.2);
    ctx.restore();
    drawRing(zoneX, zoneY, radius * 0.82, palette.core, 0.08, 1.1);

    for (var tick = 0; tick < tickCount; tick++) {
      var tickAng = (tick / tickCount) * TAU + state.time * 0.04;
      var tickInner = radius * 0.91;
      var tickOuter = radius * 1.04;
      ctx.strokeStyle = rgba(palette.glow, style.telemetry ? 0.10 : 0.06);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(zoneX + Math.cos(tickAng) * tickInner, zoneY + Math.sin(tickAng) * tickInner);
      ctx.lineTo(zoneX + Math.cos(tickAng) * tickOuter, zoneY + Math.sin(tickAng) * tickOuter);
      ctx.stroke();
    }

    if (style.telemetry) {
      drawTelemetryBrackets(zoneX, zoneY, radius * 0.84, palette, 0.22);
    }

    for (var charge = 0; charge < 3; charge++) {
      var chargeCenter = charge * salvoBlockSec + shotIntervalSec * 2;
      var chargeK = 1 - clamp01(Math.abs(cycleSec - chargeCenter) / (flightDurationSec + 0.34));
      drawRing(coreX, coreY, 24 + charge * 9, palette.trim, 0.06 + chargeK * 0.18, 1.4 + chargeK * 1.2);
    }

    for (var salvoIndex = 0; salvoIndex < 3; salvoIndex++) {
      var salvoStart = salvoIndex * salvoBlockSec;
      var salvoCenter = salvoStart + shotIntervalSec * 2;
      var salvoPulse = 1 - clamp01(Math.abs(cycleSec - salvoCenter) / (flightDurationSec + 0.38));
      var salvoRadius = radius * style.salvoSpread[salvoIndex];
      var salvoRingAlpha = 0.06 + salvoPulse * (style.ringAlpha + 0.04);
      drawRing(zoneX, zoneY, salvoRadius, palette.trim, salvoRingAlpha, 1.1 + salvoPulse * 2.0);
      drawRing(zoneX, zoneY, salvoRadius * 0.68, palette.core, salvoRingAlpha * 0.55, 0.9 + salvoPulse * 0.8);

      if (style.crown && salvoPulse > 0.01) {
        for (var crown = 0; crown < 10; crown++) {
          var crownAng = (crown / 10) * TAU + salvoIndex * 0.45 + state.time * 0.05;
          ctx.strokeStyle = rgba(palette.glow, 0.08 + salvoPulse * 0.12);
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(zoneX + Math.cos(crownAng) * salvoRadius * 0.92, zoneY + Math.sin(crownAng) * salvoRadius * 0.92);
          ctx.lineTo(zoneX + Math.cos(crownAng) * salvoRadius * 1.16, zoneY + Math.sin(crownAng) * salvoRadius * 1.16);
          ctx.stroke();
        }
      }

      for (var shotIndex = 0; shotIndex < 5; shotIndex++) {
        var seed = (salvoIndex + 1) * 101 + shotIndex * 17 + 13;
        var baseAng = -1.22 + (shotIndex / 5) * TAU + salvoIndex * 0.68;
        var ang = baseAng + (orbitalNoise(seed) - 0.5) * 0.48;
        var rr = salvoRadius * (0.46 + orbitalNoise(seed + 11) * 0.50);
        var tx = zoneX + Math.cos(ang) * rr;
        var ty = zoneY + Math.sin(ang) * rr * style.yScale;
        var trajectory = getOrbitalStrikeTrajectory(seed, salvoIndex, shotIndex, coreX, coreY, tx, ty, style);
        var aoeRadius = radius * style.aoeScale[salvoIndex] * (0.84 + orbitalNoise(seed + 23) * 0.32);
        var launchTime = salvoStart + shotIndex * shotIntervalSec;
        var arrivalTime = launchTime + flightDurationSec;
        var timeToLaunch = launchTime - cycleSec;
        var launchAge = cycleSec - launchTime;
        var impactAge = cycleSec - arrivalTime;
        var markerK = timeToLaunch > 0 ? 1 - clamp01(timeToLaunch / 0.44) : 1 - smoothstep(0, 0.26, -timeToLaunch);
        var markerAlpha = (0.04 + markerK * style.markerAlpha) * (impactAge > 0 ? 0.30 : 1);
        var impactPrevPoint = getOrbitalStrikeTrajectoryPoint(coreX, coreY, tx, ty, trajectory, 0.96);
        var impactAngle = Math.atan2(ty - impactPrevPoint.y, tx - impactPrevPoint.x);

        drawRing(tx, ty, aoeRadius * 0.58, palette.line, markerAlpha, 1);
        drawRing(tx, ty, aoeRadius * 0.24, palette.trim, markerAlpha * 1.12, 1.8);

        if (style.telemetry) {
          drawTelemetryBrackets(tx, ty, aoeRadius * 0.80, palette, markerAlpha * 0.78);
        }

        if (launchAge >= 0 && launchAge <= flightDurationSec + 0.05) {
          var travel = clamp01(launchAge / flightDurationSec);
          var trailFade = 1 - smoothstep(flightDurationSec * 0.82, flightDurationSec + 0.04, launchAge);
          var tailSpan = trajectory.kind === "straight" ? 0.24 : (trajectory.kind === "shallow" ? 0.18 : 0.14);
          var tailTravel = Math.max(0, travel - tailSpan);
          var midTravel = lerp(tailTravel, travel, 0.56);
          var headRefTravel = Math.min(1, travel + 0.03);
          var tailPoint = getOrbitalStrikeTrajectoryPoint(coreX, coreY, tx, ty, trajectory, tailTravel);
          var midPoint = getOrbitalStrikeTrajectoryPoint(coreX, coreY, tx, ty, trajectory, midTravel);
          var currentPoint = getOrbitalStrikeTrajectoryPoint(coreX, coreY, tx, ty, trajectory, travel);
          var headRefPoint = getOrbitalStrikeTrajectoryPoint(coreX, coreY, tx, ty, trajectory, headRefTravel);
          var px = currentPoint.x;
          var py = currentPoint.y;
          var segAngle = headRefTravel > travel
            ? Math.atan2(headRefPoint.y - py, headRefPoint.x - px)
            : impactAngle;
          var dirX = Math.cos(segAngle);
          var dirY = Math.sin(segAngle);
          var nx = -dirY;
          var ny = dirX;
          var glowAlpha = style.beamAlpha * trailFade;

          ctx.save();
          ctx.lineCap = "round";
          ctx.strokeStyle = style.darkTrail ? rgbaHex(palette.dark, 0.54 * trailFade) : rgba(palette.glow, glowAlpha * 0.55);
          ctx.lineWidth = style.beamWidth * (style.crown ? 2.4 : 2.1);
          ctx.beginPath();
          ctx.moveTo(tailPoint.x, tailPoint.y);
          if (trajectory.kind === "straight") {
            ctx.lineTo(px, py);
          } else {
            ctx.quadraticCurveTo(midPoint.x, midPoint.y, px, py);
          }
          ctx.stroke();

          ctx.strokeStyle = style.darkTrail ? rgbaHex(palette.trim, style.trimAlpha * trailFade) : rgba(palette.glow, glowAlpha);
          ctx.lineWidth = style.beamWidth;
          ctx.beginPath();
          ctx.moveTo(tailPoint.x, tailPoint.y);
          if (trajectory.kind === "straight") {
            ctx.lineTo(px, py);
          } else {
            ctx.quadraticCurveTo(midPoint.x, midPoint.y, px, py);
          }
          ctx.stroke();

          ctx.strokeStyle = rgbaHex(palette.trim, style.trimAlpha * 0.88 * trailFade);
          ctx.lineWidth = Math.max(0.8, style.beamWidth * 0.32);
          ctx.beginPath();
          ctx.moveTo(tailPoint.x, tailPoint.y);
          if (trajectory.kind === "straight") {
            ctx.lineTo(px, py);
          } else {
            ctx.quadraticCurveTo(midPoint.x, midPoint.y, px, py);
          }
          ctx.stroke();

          if (style.doubleRail) {
            ctx.strokeStyle = rgbaHex(palette.trim, 0.20 * trailFade);
            ctx.lineWidth = 1;
            for (var rail = -1; rail <= 1; rail += 2) {
              ctx.beginPath();
              ctx.moveTo(tailPoint.x + nx * rail * 3, tailPoint.y + ny * rail * 3);
              if (trajectory.kind === "straight") {
                ctx.lineTo(px + nx * rail * 2, py + ny * rail * 2);
              } else {
                ctx.quadraticCurveTo(midPoint.x + nx * rail * 2, midPoint.y + ny * rail * 2, px + nx * rail * 2, py + ny * rail * 2);
              }
              ctx.stroke();
            }
          }
          ctx.restore();

          for (var spark = 0; spark < style.sparkCount; spark++) {
            var sparkWave = state.time * 7 + seed * 0.14 + spark * 1.2;
            var sparkLag = 8 + spark * (style.ragged ? 4.8 : 3.2);
            var sparkSide = Math.sin(sparkWave) * (style.ragged ? 8 : 4) + (spark - style.sparkCount * 0.5) * (style.ragged ? 2.6 : 1.3);
            var sparkX = px - dirX * sparkLag + nx * sparkSide;
            var sparkY = py - dirY * sparkLag + ny * sparkSide;
            var sparkLen = 4 + (spark % 3) * 2;
            ctx.strokeStyle = rgba(palette.glow, trailFade * (style.ragged ? 0.22 : 0.14));
            ctx.lineWidth = 1 + (spark % 2) * 0.4;
            ctx.beginPath();
            ctx.moveTo(sparkX, sparkY);
            ctx.lineTo(
              sparkX - dirX * sparkLen + nx * Math.sin(sparkWave * 1.3) * (style.ragged ? 4.0 : 1.8),
              sparkY - dirY * sparkLen + ny * Math.sin(sparkWave * 1.3) * (style.ragged ? 4.0 : 1.8)
            );
            ctx.stroke();
          }

          var halo = ctx.createRadialGradient(px, py, 0, px, py, style.headRadius * (style.crown ? 4.6 : 3.8));
          halo.addColorStop(0, rgbaHex(palette.trim, 0.34 * trailFade));
          halo.addColorStop(0.45, style.darkTrail ? rgbaHex(palette.dark, 0.22 * trailFade) : rgbaHex(palette.core, 0.18 * trailFade));
          halo.addColorStop(1, rgbaHex(palette.core, 0));
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(px, py, style.headRadius * (style.crown ? 4.6 : 3.8), 0, TAU);
          ctx.fill();

          ctx.fillStyle = style.darkTrail ? rgbaHex(palette.dark, 0.82 * trailFade) : rgbaHex(palette.core, 0.82 * trailFade);
          ctx.beginPath();
          ctx.arc(px, py, style.headRadius, 0, TAU);
          ctx.fill();
          ctx.fillStyle = rgbaHex(palette.trim, 0.94 * trailFade);
          ctx.beginPath();
          ctx.arc(px, py, style.headRadius * 0.48, 0, TAU);
          ctx.fill();
        }

        if (impactAge >= 0 && impactAge <= impactFadeDurationSec) {
          var impactFade = 1 - smoothstep(0, impactFadeDurationSec, impactAge);
          var impactExpand = smoothstep(0, impactFadeDurationSec, impactAge);
          var flashR = aoeRadius * (0.36 + impactExpand * 0.84);
          var coreR = aoeRadius * (0.12 + impactExpand * 0.22);
          var spikeCount = style.spikeCount + (salvoIndex === 1 ? 1 : 0);
          var burst = ctx.createRadialGradient(tx, ty, 0, tx, ty, flashR);
          burst.addColorStop(0, style.darkTrail ? rgbaHex(palette.dark, 0.82 * impactFade) : rgbaHex(palette.trim, 0.86 * impactFade));
          burst.addColorStop(0.22, rgbaHex(palette.trim, 0.24 * impactFade));
          burst.addColorStop(0.48, rgbaHex(palette.core, style.impactGlow * impactFade));
          burst.addColorStop(1, rgbaHex(palette.core, 0));
          ctx.fillStyle = burst;
          ctx.beginPath();
          ctx.arc(tx, ty, flashR, 0, TAU);
          ctx.fill();

          ctx.fillStyle = style.darkTrail ? rgbaHex(palette.dark, 0.90 * impactFade) : rgbaHex(palette.trim, 0.88 * impactFade);
          ctx.beginPath();
          ctx.arc(tx, ty, coreR, 0, TAU);
          ctx.fill();

          drawRing(tx, ty, flashR * 0.82, palette.trim, (style.ringAlpha + 0.16) * impactFade, 2.2 * style.shockWidth);
          drawRing(tx, ty, flashR * 1.08, palette.core, 0.18 * impactFade, 1.4 * style.shockWidth);
          drawRing(tx, ty, flashR * 0.56, palette.line, 0.12 * impactFade, 1.1);

          for (var spike = 0; spike < spikeCount; spike++) {
            var spikeAng = (spike / spikeCount) * TAU + orbitalNoise(seed + spike * 9) * 0.24 + shotIndex * 0.11;
            var spikeLen = flashR * (style.crown ? 1.26 : 0.90) * (0.56 + orbitalNoise(seed + spike * 17) * 0.44);
            ctx.strokeStyle = style.darkTrail
              ? rgbaHex(palette.trim, 0.16 * impactFade)
              : rgba(palette.glow, (0.10 + (spike % 3) * 0.03) * impactFade);
            ctx.lineWidth = style.crown ? 2.2 : 1.4;
            ctx.beginPath();
            ctx.moveTo(tx + Math.cos(spikeAng) * coreR * 0.8, ty + Math.sin(spikeAng) * coreR * 0.8);
            ctx.lineTo(tx + Math.cos(spikeAng) * spikeLen, ty + Math.sin(spikeAng) * spikeLen);
            ctx.stroke();
          }

          if (style.telemetry) {
            ctx.save();
            ctx.setLineDash([6, 6]);
            drawRing(tx, ty, flashR * 0.94, palette.trim, 0.18 * impactFade, 1.2);
            ctx.restore();
            drawTelemetryBrackets(tx, ty, flashR * 0.74, palette, 0.34 * impactFade);
          }

          if (style.ragged) {
            drawMeteorSparkField(tx, ty, impactAngle, lodKey === "far" ? 5 : 9, 1.7, 10 + flashR * 0.22, palette, 0.22 * impactFade);
          }

          drawImpactDebris(
            tx,
            ty,
            impactAngle,
            aoeRadius * (0.16 + impactExpand * 0.72),
            palette,
            impactFade * style.debrisAlpha,
            lodKey,
            variant
          );
        }
      }
    }
  }

  function drawDroneSwarm(width, height, palette, variant, lodKey) {
    var radius = lerp(80, 160, getRadiusFactor());
    var zoneX = width * 0.63;
    var zoneY = height * 0.48;
    var drones = lodKey === "far" ? 34 : (lodKey === "mid" ? 56 : 88);
    drawTargetArea(zoneX, zoneY, radius, palette, variant);
    drawShip(zoneX - 34, zoneY - 18, 0.16, 12, palette.hull, palette.trim, 1);
    drawShip(zoneX + 36, zoneY + 22, -0.08, 11, palette.hull, palette.trim, 0.92);
    drawShip(zoneX + 4, zoneY - 46, 0.22, 8, palette.hull, palette.trim, 0.76);

    for (var i = 0; i < drones; i++) {
      var ring = (i % 5) / 5;
      var ang = state.time * (0.8 + ring * 0.5 + variant.flicker * 0.16) + i * 0.43;
      var rr = radius * (0.18 + ring * 0.18 + Math.sin(state.time * 0.8 + i) * 0.05);
      var x = zoneX + Math.cos(ang) * rr;
      var y = zoneY + Math.sin(ang) * rr;
      ctx.fillStyle = rgba(palette.glow, 0.18 + (i % 4) * 0.04);
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + (i % 3) * 0.35, 0, TAU);
      ctx.fill();
    }
  }

  function drawSeismobomb(width, height, palette, variant) {
    var radius = lerp(90, 170, getRadiusFactor());
    var bombX = width * 0.66;
    var bombY = height * 0.50;
    var cycle = (state.time * getTempo() * 0.18) % 1;
    var countdown = 3 * (1 - cycle);

    drawTargetArea(bombX, bombY, radius * 0.82, palette, variant);
    ctx.beginPath();
    ctx.fillStyle = rgbaHex(palette.core, 0.20);
    ctx.arc(bombX, bombY, 24, 0, TAU);
    ctx.fill();
    drawRing(bombX, bombY, 20, palette.trim, 0.64, 2.4);

    ctx.strokeStyle = rgbaHex(palette.line, 0.50);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(bombX, bombY, 28, -Math.PI * 0.5, -Math.PI * 0.5 + TAU * cycle);
    ctx.stroke();

    ctx.fillStyle = "#f4f8ff";
    ctx.font = "700 26px Segoe UI, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(countdown.toFixed(1), bombX, bombY + 8);

    var burst = smoothstep(0.84, 1.0, cycle);
    if (burst > 0.01) {
      drawRing(bombX, bombY, radius * (0.22 + burst * 0.86), palette.trim, 0.44 * burst, 5);
      drawRing(bombX, bombY, radius * (0.12 + burst * 0.56), palette.core, 0.22 * burst, 9);
      for (var i = 0; i < 9; i++) {
        var ang = (i / 9) * TAU + state.time * 0.2;
        ctx.strokeStyle = rgba(palette.glow, 0.20 * burst);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bombX + Math.cos(ang) * 12, bombY + Math.sin(ang) * 12);
        ctx.lineTo(bombX + Math.cos(ang) * radius * (0.18 + burst * 0.64), bombY + Math.sin(ang) * radius * (0.18 + burst * 0.64));
        ctx.stroke();
      }
    }
  }

  function drawTeleportField(width, height, palette, variant) {
    var radius = lerp(70, 140, getRadiusFactor());
    var srcX = width * 0.32;
    var srcY = height * 0.56;
    var dstX = width * 0.72;
    var dstY = height * 0.44;
    var enemyBaseX = width * 0.84;
    var enemyBaseY = height * 0.18;
    var cycle = (state.time * getTempo() * 0.24) % 1;

    drawCore(enemyBaseX, enemyBaseY, 34, palette);
    drawRing(enemyBaseX, enemyBaseY, 88, palette.core, 0.12, 2);
    drawTargetArea(srcX, srcY, radius, palette, variant);
    drawTargetArea(dstX, dstY, radius * 0.82, palette, variant);

    var shipOffsets = [
      { x: -24, y: -18 }, { x: 6, y: -26 }, { x: 28, y: 12 }, { x: -8, y: 26 }, { x: 34, y: -12 }
    ];
    for (var i = 0; i < shipOffsets.length; i++) {
      var off = shipOffsets[i];
      var dissolve = smoothstep(0.18, 0.55, cycle);
      var reform = smoothstep(0.52, 0.92, cycle);
      var px = lerp(srcX + off.x, dstX + off.x * 0.72 + (i % 2 === 0 ? 20 : -16), smoothstep(0.18, 0.85, cycle));
      var py = lerp(srcY + off.y, dstY + off.y * 0.64 + (i % 3 === 0 ? 12 : -8), smoothstep(0.18, 0.85, cycle));
      if (cycle < 0.48) {
        drawShip(srcX + off.x, srcY + off.y, 0.14, 8.5, palette.hull, palette.trim, 1 - dissolve);
      }
      ctx.strokeStyle = rgba(palette.glow, 0.16 + reform * 0.16);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(srcX + off.x, srcY + off.y);
      ctx.lineTo(px, py);
      ctx.stroke();
      if (cycle > 0.36) {
        drawShip(px, py, -0.10, 8.5, palette.hull, palette.trim, reform);
      }
    }
  }

  function renderEffect(width, height, palette, variant, effect, lodKey) {
    if (effect.id === "directedMeteor") {
      drawDirectedMeteor(width, height, palette, variant, lodKey);
      return;
    }
    if (effect.id === "meteorSwarm") {
      drawMeteorSwarm(width, height, palette, variant, lodKey);
      return;
    }
    if (effect.id === "orbitalStrike") {
      drawOrbitalStrike(width, height, palette, variant, lodKey);
      return;
    }
    if (effect.id === "droneSwarm") {
      drawDroneSwarm(width, height, palette, variant, lodKey);
      return;
    }
    if (effect.id === "seismobomb") {
      drawSeismobomb(width, height, palette, variant, lodKey);
      return;
    }
    drawTeleportField(width, height, palette, variant, lodKey);
  }

  function drawVariantStrip(width, height, palette) {
    var pad = 18;
    var slotW = (width - pad * 2) / VARIANTS.length;
    var y = height - 64;
    for (var i = 0; i < VARIANTS.length; i++) {
      var active = i === state.variantIndex;
      var v = VARIANTS[i];
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.56;
      ctx.fillStyle = "rgba(8,12,21,0.78)";
      ctx.strokeStyle = active ? rgba(palette.glow, 0.38) : "rgba(150,172,220,0.12)";
      ctx.lineWidth = 1;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(pad + slotW * i + slotW * 0.08, y - 18, slotW * 0.84, 42, 12);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = "#edf5ff";
      ctx.font = "600 11px Segoe UI, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(v.name, pad + slotW * i + slotW * 0.5, y + 7);
      ctx.restore();
    }
  }

  function updateTexts() {
    var effect = getEffect();
    var variant = getVariant();
    texts.title.textContent = "Ability Arsenal Prototype 01 - " + effect.name + " / " + variant.name;
    texts.subtitle.textContent = variant.note;
    texts.status.textContent = effect.name + " with " + variant.name + ": " + effect.gameplay;
    texts.gameplay.textContent = effect.gameplay;
    texts.read.textContent = variant.read;
    texts.focus.textContent = effect.focus;
  }

  function render() {
    var width = canvas.clientWidth || 1;
    var height = canvas.clientHeight || 1;
    var palette = getPalette();
    var variant = getVariant();
    var effect = getEffect();
    var lodKey = getLodKey();
    drawBackdrop(width, height, palette);
    renderEffect(width, height, palette, variant, effect, lodKey);
    drawVariantStrip(width, height, palette);
    updateTexts();
  }

  function tick(ts) {
    state.time = ts * 0.001;
    render();
    requestAnimationFrame(tick);
  }

  function syncSelect(select, list) {
    select.innerHTML = "";
    for (var i = 0; i < list.length; i++) {
      var option = document.createElement("option");
      option.value = String(i);
      option.textContent = list[i].name;
      select.appendChild(option);
    }
  }

  syncSelect(controls.effect, EFFECTS);
  syncSelect(controls.variant, VARIANTS);
  controls.effect.value = String(state.effectIndex);
  controls.variant.value = String(state.variantIndex);

  controls.effect.addEventListener("change", function () {
    state.effectIndex = Math.max(0, Math.min(EFFECTS.length - 1, Number(controls.effect.value) || 0));
    updateTexts();
  });

  controls.variant.addEventListener("change", function () {
    state.variantIndex = Math.max(0, Math.min(VARIANTS.length - 1, Number(controls.variant.value) || 0));
    updateTexts();
  });

  controls.cycleEffect.addEventListener("click", function () {
    state.effectIndex = (state.effectIndex + 1) % EFFECTS.length;
    controls.effect.value = String(state.effectIndex);
    updateTexts();
  });

  controls.cycleVariant.addEventListener("click", function () {
    state.variantIndex = (state.variantIndex + 1) % VARIANTS.length;
    controls.variant.value = String(state.variantIndex);
    updateTexts();
  });

  controls.triggerPulse.addEventListener("click", function () {
    state.pulseUntil = state.time + 2;
  });

  window.addEventListener("resize", resize);
  resize();
  updateTexts();
  requestAnimationFrame(tick);
})();
