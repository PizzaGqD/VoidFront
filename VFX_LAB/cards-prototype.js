(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var canvas = document.getElementById("scene");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var controls = {
    variant: document.getElementById("variant"),
    rarity: document.getElementById("rarity"),
    palette: document.getElementById("palette"),
    edgeGlow: document.getElementById("edgeGlow"),
    glassFrost: document.getElementById("glassFrost"),
    circuitDensity: document.getElementById("circuitDensity"),
    cycleVariant: document.getElementById("cycleVariant"),
    shufflePalette: document.getElementById("shufflePalette"),
    pulseInspect: document.getElementById("pulseInspect"),
    playActivation: document.getElementById("playActivation")
  };

  var texts = {
    title: document.getElementById("variantTitle"),
    subtitle: document.getElementById("variantSubtitle"),
    status: document.getElementById("statusLine"),
    surface: document.getElementById("legendSurface"),
    readability: document.getElementById("legendReadability"),
    goal: document.getElementById("legendGoal")
  };

  var PALETTES = {
    cyan:    { core: "#7dd6ff", trim: "#d9f6ff", line: "#6ebeff", dark: "#0d1727", panel: "#152338", panel2: "#0f1b2e", glow: "125,214,255" },
    amber:   { core: "#ffb86b", trim: "#ffefc9", line: "#ffcf78", dark: "#1a1208", panel: "#302113", panel2: "#261a0e", glow: "255,184,107" },
    violet:  { core: "#cba3ff", trim: "#f3e6ff", line: "#c28bff", dark: "#150f24", panel: "#291d3e", panel2: "#211634", glow: "203,163,255" },
    crimson: { core: "#ff8aa5", trim: "#ffe1ea", line: "#ff6b8d", dark: "#1d1018", panel: "#381826", panel2: "#29111d", glow: "255,138,165" },
    emerald: { core: "#7de1a8", trim: "#e0ffed", line: "#67d497", dark: "#0d1913", panel: "#183226", panel2: "#12271d", glow: "125,225,168" }
  };

  var RARITIES = {
    common:    { color: "#9fb2d8", pin: "C", label: "Common" },
    rare:      { color: "#57bfff", pin: "R", label: "Rare" },
    epic:      { color: "#c86dff", pin: "E", label: "Epic" },
    legendary: { color: "#ffb94a", pin: "L", label: "Legendary" }
  };

  var VARIANTS = [
    {
      key: "aegis-prism",
      name: "Aegis Prism",
      emoji: "🛡️",
      note: "Самый дисциплинированный и чистый вариант: прямой shield-tech язык, ровные фаски и собранная кромка.",
      readability: "Лучший кандидат, если нужна строгая боевая карта без визуального шума.",
      goal: "Подходит для базового стандарта всей колоды: дорогой sci-fi пластик плюс матовое стекло.",
      chamfer: 22,
      halo: 1.0,
      stripeBias: 0.18,
      circuitBias: 0.80,
      cornerCut: 0.18
    },
    {
      key: "circuit-bloom",
      name: "Circuit Bloom",
      emoji: "🌸",
      note: "Более живой glow-контур с мягкой внутренней дымкой и микросхемной сетью, расходящейся от центра.",
      readability: "Подходит, если хочется богаче и \"магичнее\", но без потери техно-ощущения.",
      goal: "Надо смотреть, не станет ли circuit-layer слишком декоративным для дальнего чтения.",
      chamfer: 18,
      halo: 1.18,
      stripeBias: 0.28,
      circuitBias: 1.10,
      cornerCut: 0.08
    },
    {
      key: "obsidian-relay",
      name: "Obsidian Relay",
      emoji: "📡",
      note: "Темное ядро, сильный контраст по ребру и узкие яркие шины будто внутри карты проходят релейные трассы.",
      readability: "Самый \"контрастный\" вариант. Хорошо собирает глаз на цветной кромке.",
      goal: "Сильный кандидат для редких и эпических карт, где хочется темного премиум-ощущения.",
      chamfer: 26,
      halo: 0.92,
      stripeBias: 0.12,
      circuitBias: 0.65,
      cornerCut: 0.22
    },
    {
      key: "solar-spine",
      name: "Solar Spine",
      emoji: "☀️",
      note: "Жесткий центральный хребет, теплые энергетические жилы и более агрессивная верхняя зона имени.",
      readability: "Хорошо подходит для ударных способностей и взрывных карт, потому что сам говорит про импульс.",
      goal: "Нужно проверить, не будет ли перегревать легендарную редкость вместе с оранжевым контуром.",
      chamfer: 16,
      halo: 1.14,
      stripeBias: 0.36,
      circuitBias: 0.86,
      cornerCut: 0.14
    },
    {
      key: "royal-lattice",
      name: "Royal Lattice",
      emoji: "👑",
      note: "Четкая дворцовая решетка: кромка ярче, внутренний рисунок симметричнее, а редкость ощущается элитной.",
      readability: "Очень сильный вариант под legendary и premium buff-карты.",
      goal: "Если нужен \"королевский\" high-end стиль без золоченой мишуры, это хороший ориентир.",
      chamfer: 28,
      halo: 1.08,
      stripeBias: 0.22,
      circuitBias: 0.58,
      cornerCut: 0.26
    },
    {
      key: "nova-ledger",
      name: "Nova Ledger",
      emoji: "🧾",
      note: "Более интерфейсный вариант: много аккуратных технических делений, каскадных слотов и HUD-панелей.",
      readability: "Самый системный и UI-heavy. Подходит, если карта должна ощущаться как тактический дисплей.",
      goal: "Нужно следить, чтобы микролинии не превратились в шум на плотной раскладке 20+ карт.",
      chamfer: 12,
      halo: 0.98,
      stripeBias: 0.30,
      circuitBias: 1.20,
      cornerCut: 0.05
    }
  ];

  var SAMPLE_CARDS = [
    { title: "Aegis Relay", type: "Timed Buff", text: "+25% shield regen for 16 sec", chips: ["12 sec", "Fleet", "Rare"] },
    { title: "Directed Meteor", type: "Ability", text: "Pierces first target and detonates behind it", chips: ["Active", "AoE", "Epic"] },
    { title: "Salvage Fever", type: "Economy", text: "+45% mine output while active", chips: ["18 sec", "Income", "Common"] },
    { title: "Seismobomb", type: "Ability", text: "Arms for 3 sec, then ruptures the zone", chips: ["Delay", "Blast", "Legendary"] }
  ];

  var ACTIVATION_NOTES = {
    "aegis-prism": "shield-rings + vertical seal burst",
    "circuit-bloom": "circuit bloom + node discharge",
    "obsidian-relay": "relay slashes + edge vents",
    "solar-spine": "solar beam + ember rays",
    "royal-lattice": "royal halo + crown flare",
    "nova-ledger": "HUD shutters + data sweep"
  };

  var state = {
    time: 0,
    variantIndex: 0,
    inspectUntil: 0,
    activationStartedAt: -999,
    stars: []
  };

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function pingPong01(t) {
    var wrapped = ((t % 2) + 2) % 2;
    return wrapped <= 1 ? wrapped : 2 - wrapped;
  }

  function rgba(rgb, alpha) {
    return "rgba(" + rgb + "," + alpha + ")";
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

  function getPointOnPolyline(points, t) {
    if (!points || points.length === 0) return { x: 0, y: 0 };
    if (points.length === 1) return { x: points[0].x, y: points[0].y };
    var lengths = [];
    var total = 0;
    for (var i = 0; i < points.length - 1; i++) {
      var ax = points[i].x;
      var ay = points[i].y;
      var bx = points[i + 1].x;
      var by = points[i + 1].y;
      var len = Math.hypot(bx - ax, by - ay);
      lengths.push(len);
      total += len;
    }
    if (total <= 0.0001) return { x: points[0].x, y: points[0].y };
    var target = clamp01(t) * total;
    var acc = 0;
    for (var j = 0; j < lengths.length; j++) {
      var seg = lengths[j];
      if (acc + seg >= target) {
        var local = (target - acc) / Math.max(seg, 0.0001);
        return {
          x: lerp(points[j].x, points[j + 1].x, local),
          y: lerp(points[j].y, points[j + 1].y, local)
        };
      }
      acc += seg;
    }
    return { x: points[points.length - 1].x, y: points[points.length - 1].y };
  }

  function getPalette() {
    return PALETTES[controls.palette.value] || PALETTES.cyan;
  }

  function getRarity() {
    return RARITIES[controls.rarity.value] || RARITIES.common;
  }

  function getVariant() {
    return VARIANTS[state.variantIndex] || VARIANTS[0];
  }

  function getInspectPulse() {
    return state.time < state.inspectUntil ? 1 : 0;
  }

  function getActivationState() {
    var startedAt = state.activationStartedAt != null ? state.activationStartedAt : -999;
    var elapsed = state.time - startedAt;
    if (elapsed < 0 || elapsed > 1.5) return null;
    return {
      elapsed: elapsed,
      flash: clamp01(elapsed / 0.12),
      burst: clamp01(elapsed / 0.32),
      fade: clamp01((elapsed - 0.48) / 0.86),
      pulse: Math.sin(Math.min(1, elapsed / 1.5) * Math.PI)
    };
  }

  function pathCardFrame(width, height, radius, cut) {
    var r = Math.max(6, radius);
    var c = Math.max(0, Math.min(width * 0.2, cut));
    ctx.beginPath();
    ctx.moveTo(-width * 0.5 + r + c * 0.5, -height * 0.5);
    ctx.lineTo(width * 0.5 - r - c, -height * 0.5);
    ctx.quadraticCurveTo(width * 0.5 - c * 0.24, -height * 0.5, width * 0.5, -height * 0.5 + r + c * 0.2);
    ctx.lineTo(width * 0.5, height * 0.5 - r - c * 0.4);
    ctx.quadraticCurveTo(width * 0.5, height * 0.5, width * 0.5 - r - c * 0.18, height * 0.5);
    ctx.lineTo(-width * 0.5 + r + c, height * 0.5);
    ctx.quadraticCurveTo(-width * 0.5, height * 0.5, -width * 0.5, height * 0.5 - r - c * 0.25);
    ctx.lineTo(-width * 0.5, -height * 0.5 + r + c);
    ctx.quadraticCurveTo(-width * 0.5, -height * 0.5, -width * 0.5 + r + c * 0.2, -height * 0.5);
    ctx.closePath();
  }

  function strokeCardFrameScaled(width, height, radius, cut, scale, color, alpha, lineWidth) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha *= Math.max(0, alpha);
    ctx.lineWidth = lineWidth;
    pathCardFrame(width * scale, height * scale, radius * scale, cut * scale);
    ctx.stroke();
    ctx.restore();
  }

  function drawActivationRayBurst(count, innerR, outerR, rotation, color, alpha, width) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha *= Math.max(0, alpha);
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    for (var i = 0; i < count; i++) {
      var ang = rotation + (i / Math.max(1, count)) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * innerR, Math.sin(ang) * innerR);
      ctx.lineTo(Math.cos(ang) * outerR, Math.sin(ang) * outerR);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawActivationCardSweep(width, height, alpha, skew, color) {
    ctx.save();
    ctx.globalAlpha *= Math.max(0, alpha);
    ctx.fillStyle = color;
    ctx.transform(1, skew, 0, 1, 0, 0);
    ctx.fillRect(-width * 0.55, -height * 0.56, width * 0.18, height * 1.12);
    ctx.restore();
  }

  function drawActivationEffect(width, height, variant, palette, rarity, activation) {
    if (!activation) return;
    var flash = activation.flash;
    var burst = activation.burst;
    var fade = activation.fade;
    var pulse = activation.pulse;
    var trimGlow = rgbaHex(palette.trim, 0.85);
    var rarityGlow = rgbaHex(rarity.color, 0.92);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    if (variant.key === "aegis-prism") {
      strokeCardFrameScaled(width, height, 28, width * variant.cornerCut, 1 + burst * 0.06, rarityGlow, 0.85 - fade * 0.6, 2.6);
      strokeCardFrameScaled(width, height, 28, width * variant.cornerCut, 1 + burst * 0.14, trimGlow, 0.42 - fade * 0.3, 1.6);
      drawActivationCardSweep(width, height, 0.34 * (1 - fade), 0.14, rgbaHex(rarity.color, 0.34));
      drawActivationRayBurst(10, width * 0.12, width * (0.22 + burst * 0.12), state.time * 0.2, trimGlow, 0.22 + flash * 0.18, 2.1);
    } else if (variant.key === "circuit-bloom") {
      drawActivationRayBurst(14, width * 0.10, width * (0.26 + burst * 0.14), state.time * 0.35, rgba(palette.glow, 0.96), 0.24 + pulse * 0.2, 1.6);
      for (var cb = 0; cb < 6; cb++) {
        var prog = ((state.time * 1.7) + cb * 0.13) % 1;
        var x = -width * 0.28 + prog * width * 0.56;
        var y = -height * 0.18 + (cb - 2.5) * 18;
        ctx.beginPath();
        ctx.fillStyle = rgbaHex(palette.trim, 0.78 - fade * 0.4);
        ctx.arc(x, y, 3.5 + pulse * 1.8, 0, TAU);
        ctx.fill();
      }
      strokeCardFrameScaled(width, height, 28, width * variant.cornerCut, 1 + burst * 0.08, rgba(palette.glow, 0.95), 0.58 - fade * 0.4, 2.1);
    } else if (variant.key === "obsidian-relay") {
      for (var orx = 0; orx < 3; orx++) {
        var ox = -width * 0.34 + orx * width * 0.28 + burst * 26;
        ctx.fillStyle = rgbaHex(rarity.color, 0.12 + (0.18 - fade * 0.12));
        ctx.fillRect(ox, -height * 0.50, width * 0.10, height);
      }
      drawActivationCardSweep(width, height, 0.28 * (1 - fade), -0.18, rgbaHex(rarity.color, 0.30));
      drawActivationRayBurst(8, width * 0.18, width * (0.34 + burst * 0.08), -0.4, trimGlow, 0.18 + flash * 0.16, 2.4);
      strokeCardFrameScaled(width, height, 28, width * variant.cornerCut, 1 + burst * 0.04, rarityGlow, 0.72 - fade * 0.48, 3.0);
    } else if (variant.key === "solar-spine") {
      ctx.fillStyle = rgbaHex(rarity.color, 0.16 + flash * 0.18);
      ctx.fillRect(-width * 0.07, -height * 0.52, width * 0.14, height * (0.9 - fade * 0.15));
      drawActivationRayBurst(12, width * 0.08, width * (0.32 + burst * 0.16), -Math.PI / 2, rgbaHex("#fff1c4", 0.92), 0.28 + pulse * 0.22, 2.0);
      drawActivationRayBurst(6, width * 0.18, width * (0.42 + burst * 0.18), Math.PI / 6, rgbaHex(rarity.color, 0.96), 0.18 + flash * 0.14, 3.6);
    } else if (variant.key === "royal-lattice") {
      ctx.beginPath();
      ctx.strokeStyle = rarityGlow;
      ctx.globalAlpha *= 0.58 - fade * 0.36;
      ctx.lineWidth = 2.4;
      ctx.arc(0, -height * 0.04, width * (0.16 + burst * 0.12), 0, TAU);
      ctx.stroke();
      drawActivationRayBurst(5, width * 0.18, width * (0.30 + burst * 0.14), -Math.PI / 2, rgbaHex("#fff2cf", 0.96), 0.30 + flash * 0.14, 2.6);
      strokeCardFrameScaled(width, height, 28, width * variant.cornerCut, 1 + burst * 0.1, rarityGlow, 0.74 - fade * 0.5, 2.9);
    } else if (variant.key === "nova-ledger") {
      for (var nl = 0; nl < 4; nl++) {
        var laneY = -height * 0.28 + nl * 34;
        var laneW = width * (0.18 + nl * 0.08);
        var slide = burst * (26 + nl * 10);
        ctx.fillStyle = rgba(palette.glow, 0.14 + flash * 0.10);
        ctx.fillRect(-laneW - slide, laneY, laneW, 10);
        ctx.fillRect(slide, laneY, laneW, 10);
      }
      drawActivationCardSweep(width, height, 0.24 * (1 - fade), 0.08, rgba(palette.glow, 0.22));
      strokeCardFrameScaled(width, height, 28, width * variant.cornerCut, 1 + burst * 0.05, rgba(palette.glow, 0.96), 0.54 - fade * 0.34, 1.9);
    }
    ctx.restore();
  }

  function rebuildStars(width, height) {
    state.stars = [];
    var count = Math.max(90, Math.floor(width * height / 12000));
    for (var i = 0; i < count; i++) {
      state.stars.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.4 + Math.random() * 1.2,
        alpha: 0.12 + Math.random() * 0.42,
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
    grad.addColorStop(0, "rgba(6,10,18,1)");
    grad.addColorStop(0.46, "rgba(5,8,15,1)");
    grad.addColorStop(1, "rgba(3,5,10,1)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    for (var i = 0; i < state.stars.length; i++) {
      var star = state.stars[i];
      var sx = star.x * width + Math.sin(state.time * (0.12 + star.depth * 0.15) + i * 1.7) * star.depth * 8;
      var sy = star.y * height + Math.cos(state.time * (0.11 + star.depth * 0.14) + i * 2.1) * star.depth * 6;
      ctx.beginPath();
      ctx.fillStyle = "rgba(220,235,255," + star.alpha + ")";
      ctx.arc(sx, sy, star.r, 0, TAU);
      ctx.fill();
    }

    ctx.strokeStyle = rgba(palette.glow, 0.08);
    ctx.lineWidth = 1;
    for (var x = 0; x < width; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (var y = 0; y < height; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  function drawGlassTexture(width, height, palette, frost) {
    var rows = 16;
    var cols = 10;
    ctx.save();
    for (var r = 0; r < rows; r++) {
      var yy = -height * 0.42 + (r / (rows - 1)) * height * 0.84;
      var alpha = 0.018 + frost * 0.030 + (r % 3 === 0 ? 0.012 : 0);
      ctx.strokeStyle = "rgba(255,255,255," + alpha + ")";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-width * 0.38, yy);
      ctx.lineTo(width * 0.38, yy);
      ctx.stroke();
    }
    for (var c = 0; c < cols; c++) {
      var xx = -width * 0.34 + (c / (cols - 1)) * width * 0.68;
      ctx.strokeStyle = rgba(palette.glow, 0.020 + frost * 0.025);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(xx, -height * 0.34);
      ctx.lineTo(xx, height * 0.34);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCircuitLayer(width, height, palette, variant, density, rarity, glowAmount, inspectPulse) {
    var buses = Math.max(4, Math.round(4 + density * 5 * variant.circuitBias));
    var rails = Math.max(4, Math.round(4 + density * 4 * variant.circuitBias));
    var left = -width * 0.39;
    var right = width * 0.39;
    var top = -height * 0.35;
    var bottom = height * 0.35;
    var centerLeft = -width * 0.12;
    var centerRight = width * 0.12;
    var lineW = 1.8 + density * 0.95;
    var nodeR = 2.5 + density * 0.45;
    var currentPaths = [];
    ctx.save();
    ctx.strokeStyle = rgba(palette.glow, 0.11 + density * 0.12);
    ctx.lineWidth = lineW;
    for (var i = 0; i < buses; i++) {
      var y = top + (i / Math.max(1, buses - 1)) * (bottom - top);
      var leftPath = [
        { x: left, y: y },
        { x: centerLeft, y: y },
        { x: centerLeft, y: y + (i % 2 === 0 ? -height * 0.06 : height * 0.06) }
      ];
      ctx.beginPath();
      ctx.moveTo(leftPath[0].x, leftPath[0].y);
      ctx.lineTo(leftPath[1].x, leftPath[1].y);
      ctx.lineTo(leftPath[2].x, leftPath[2].y);
      ctx.stroke();
      currentPaths.push(leftPath);
      var rightPath = [
        { x: right, y: y },
        { x: centerRight, y: y },
        { x: centerRight, y: y + (i % 2 === 0 ? height * 0.06 : -height * 0.06) }
      ];
      ctx.beginPath();
      ctx.moveTo(rightPath[0].x, rightPath[0].y);
      ctx.lineTo(rightPath[1].x, rightPath[1].y);
      ctx.lineTo(rightPath[2].x, rightPath[2].y);
      ctx.stroke();
      currentPaths.push(rightPath);
    }
    for (var j = 0; j < rails; j++) {
      var x = -width * 0.24 + (j / Math.max(1, rails - 1)) * width * 0.48;
      var railPath = [
        { x: x, y: top },
        { x: x, y: -height * 0.08 },
        { x: x + (j % 2 === 0 ? width * 0.08 : -width * 0.08), y: -height * 0.08 },
        { x: x + (j % 2 === 0 ? width * 0.08 : -width * 0.08), y: height * 0.10 }
      ];
      ctx.beginPath();
      ctx.moveTo(railPath[0].x, railPath[0].y);
      ctx.lineTo(railPath[1].x, railPath[1].y);
      ctx.lineTo(railPath[2].x, railPath[2].y);
      ctx.lineTo(railPath[3].x, railPath[3].y);
      ctx.stroke();
      currentPaths.push(railPath);
    }
    ctx.fillStyle = rgba(palette.glow, 0.18 + density * 0.14);
    for (var a = 0; a < buses; a++) {
      var nodeY = top + (a / Math.max(1, buses - 1)) * (bottom - top);
      ctx.beginPath();
      ctx.arc(centerLeft, nodeY, nodeR, 0, TAU);
      ctx.arc(centerRight, nodeY, nodeR, 0, TAU);
      ctx.fill();
    }
    for (var b = 0; b < rails; b++) {
      var nodeX = -width * 0.24 + (b / Math.max(1, rails - 1)) * width * 0.48;
      ctx.beginPath();
      ctx.arc(nodeX, -height * 0.08, nodeR - 0.2, 0, TAU);
      ctx.arc(nodeX + (b % 2 === 0 ? width * 0.08 : -width * 0.08), height * 0.10, nodeR - 0.2, 0, TAU);
      ctx.fill();
    }
    var legendary = rarity && rarity.label === "Legendary";
    for (var p = 0; p < currentPaths.length; p++) {
      var path = currentPaths[p];
      var progress = pingPong01(state.time * (0.28 + p * 0.014) + p * 0.17);
      var point = getPointOnPolyline(path, progress);
      var pulse = 0.58 + 0.42 * Math.sin(state.time * 3.8 + p * 0.6);
      ctx.shadowBlur = 8 + glowAmount * 10;
      ctx.shadowColor = rgbaHex(legendary ? rarity.color : palette.line, legendary ? (0.55 + inspectPulse * 0.16) : 0.28);
      ctx.beginPath();
      ctx.fillStyle = legendary
        ? rgbaHex(rarity.color, 0.62 + pulse * 0.18)
        : rgba(palette.glow, 0.20 + pulse * 0.12);
      ctx.arc(point.x, point.y, legendary ? 3.1 : 2.35, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = rgbaHex(palette.trim, legendary ? 0.96 : 0.76);
      ctx.arc(point.x, point.y, legendary ? 1.2 : 0.9, 0, TAU);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawEdgeBulbs(width, height, palette, rarity, glowAmount, inspectPulse) {
    var positions = [];
    var sideCount = 5;
    for (var i = 0; i < sideCount; i++) {
      var s = (i + 1) / (sideCount + 1);
      positions.push({ x: width * 0.43, y: -height * 0.28 + s * height * 0.56 });
    }
    var rarityLamp = { x: width * 0.43, y: -height * 0.43 };
    var legendary = rarity && rarity.label === "Legendary";
    ctx.save();
    ctx.shadowBlur = 14 + glowAmount * 14;
    ctx.shadowColor = rgbaHex(rarity.color, 0.42 + glowAmount * 0.18);
    ctx.beginPath();
    ctx.fillStyle = rgbaHex(rarity.color, (legendary ? (0.54 + 0.28 * (0.5 + 0.5 * Math.sin(state.time * 4.2))) : 0.68) + inspectPulse * 0.12);
    ctx.arc(rarityLamp.x, rarityLamp.y, 13.5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "rgba(8,12,22,0.44)";
    ctx.arc(rarityLamp.x, rarityLamp.y, 9.8, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = rgbaHex(palette.trim, 0.86);
    ctx.stroke();
    ctx.fillStyle = rarity.color;
    ctx.font = "700 14px Segoe UI, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(rarity.pin, rarityLamp.x, rarityLamp.y + 0.5);
    for (var k = 0; k < positions.length; k++) {
      var bulb = positions[k];
      var pulse = 0.62 + 0.38 * Math.sin(state.time * 1.6 + k * 0.55);
      if (legendary) pulse = 0.46 + 0.54 * Math.sin(state.time * 4.8 + k * 1.2);
      var alpha = 0.20 + glowAmount * 0.26 + inspectPulse * 0.12;
      ctx.beginPath();
      ctx.fillStyle = rgba(palette.glow, alpha * pulse);
      ctx.arc(bulb.x, bulb.y, 5.2 + pulse * 0.9, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = rgbaHex(palette.trim, 0.60 + pulse * 0.18);
      ctx.arc(bulb.x, bulb.y, 1.8, 0, TAU);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawChip(x, y, text, palette, active) {
    ctx.save();
    ctx.font = "600 12px Segoe UI, Arial, sans-serif";
    var padX = 10;
    var w = ctx.measureText(text).width + padX * 2;
    var h = 22;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w * 0.5, y - h * 0.5, w, h, 10);
    else ctx.rect(x - w * 0.5, y - h * 0.5, w, h);
    ctx.fillStyle = active ? rgba(palette.glow, 0.20) : "rgba(225,235,255,0.07)";
    ctx.fill();
    ctx.strokeStyle = active ? rgba(palette.glow, 0.44) : "rgba(180,200,235,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = active ? "#f6fbff" : "#b9c9e5";
    ctx.fillText(text, x, y + 1);
    ctx.restore();
  }

  function drawCard(x, y, w, h, scale, variant, palette, rarity, sample, isMain, index) {
    var glowAmount = Number(controls.edgeGlow.value) / 100;
    var frost = Number(controls.glassFrost.value) / 100;
    var density = Number(controls.circuitDensity.value) / 100;
    var inspectPulse = getInspectPulse();
    var activation = isMain ? getActivationState() : null;
    var hoverLift = isMain ? (18 + Math.sin(state.time * 1.8) * 6 + inspectPulse * 10) : 0;
    var activationLift = activation ? (18 * activation.pulse + activation.fade * 34) : 0;
    var tilt = isMain ? Math.sin(state.time * 0.8) * 0.025 : (-0.18 + index * 0.06);
    var activationTilt = activation ? Math.sin(activation.elapsed * 10.5) * 0.018 * (1 - activation.fade) : 0;
    var edgeAlpha = 0.38 + glowAmount * 0.34 + inspectPulse * 0.12;
    var legendary = rarity && rarity.label === "Legendary";
    var edgeGlowMul = legendary ? 1.55 : 1;
    var activationScale = activation ? (1 + activation.flash * 0.05 - activation.fade * 0.12) : 1;
    ctx.save();
    ctx.translate(x, y - hoverLift - activationLift);
    ctx.rotate(tilt + activationTilt);
    ctx.scale(scale * activationScale, scale * activationScale);
    if (activation) ctx.globalAlpha *= Math.max(0.12, 1 - activation.fade * 0.78);

    pathCardFrame(w, h, 28, w * variant.cornerCut);
    ctx.fillStyle = rgbaHex(palette.dark, 0.98);
    ctx.fill();

    pathCardFrame(w, h, 28, w * variant.cornerCut);
    var outer = ctx.createLinearGradient(-w * 0.42, -h * 0.5, w * 0.42, h * 0.5);
    outer.addColorStop(0, rgbaHex(palette.panel2, 0.94));
    outer.addColorStop(0.45, rgbaHex(palette.panel, 0.97));
    outer.addColorStop(1, rgbaHex(palette.panel2, 0.96));
    ctx.fillStyle = outer;
    ctx.fill();

    var haze = ctx.createLinearGradient(-w * 0.4, -h * 0.48, w * 0.26, h * 0.34);
    haze.addColorStop(0, "rgba(255,255,255," + (0.05 + frost * 0.10) + ")");
    haze.addColorStop(0.35, rgba(palette.glow, 0.05 + frost * 0.08));
    haze.addColorStop(1, "rgba(255,255,255,0)");
    pathCardFrame(w * 0.94, h * 0.94, 24, w * variant.cornerCut * 0.72);
    ctx.fillStyle = haze;
    ctx.fill();

    drawGlassTexture(w * 0.92, h * 0.88, palette, frost);
    drawCircuitLayer(w * 0.92, h * 0.88, palette, variant, density, rarity, glowAmount, inspectPulse);

    ctx.beginPath();
    ctx.moveTo(-w * 0.5 + 24, -h * 0.18);
    ctx.lineTo(w * 0.5 - 24, -h * 0.28 + variant.stripeBias * 22);
    ctx.strokeStyle = rgba(palette.glow, 0.10 + glowAmount * 0.12);
    ctx.lineWidth = 7;
    ctx.stroke();

    ctx.save();
    ctx.shadowBlur = (isMain ? 18 : 10) * (0.9 + glowAmount * 1.2) * edgeGlowMul;
    ctx.shadowColor = rgbaHex(legendary ? rarity.color : palette.line, legendary ? (0.62 + inspectPulse * 0.18) : (0.30 + glowAmount * 0.18));
    ctx.strokeStyle = rgbaHex(rarity.color, edgeAlpha);
    ctx.lineWidth = legendary ? 3.2 : 2.6;
    pathCardFrame(w - 8, h - 8, 26, w * variant.cornerCut);
    ctx.stroke();

    ctx.strokeStyle = rgba(palette.glow, (0.16 + glowAmount * 0.20) * (legendary ? 1.25 : 1));
    ctx.lineWidth = legendary ? 1.9 : 1.4;
    pathCardFrame(w - 22, h - 22, 22, w * variant.cornerCut * 0.65);
    ctx.stroke();
    if (legendary) {
      ctx.strokeStyle = rgbaHex(rarity.color, 0.24 + inspectPulse * 0.12);
      ctx.lineWidth = 5.2;
      pathCardFrame(w - 4, h - 4, 28, w * variant.cornerCut);
      ctx.stroke();
    }
    ctx.restore();

    drawEdgeBulbs(w, h, palette, rarity, glowAmount, inspectPulse);

    ctx.fillStyle = rgbaHex(palette.trim, 0.98);
    ctx.font = (isMain ? "600 44px" : "600 20px") + " Segoe UI Emoji, Segoe UI Symbol, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(sample.emoji || variant.emoji, 0, -h * 0.22);

    ctx.fillStyle = "#f1f7ff";
    ctx.font = (isMain ? "700 24px" : "700 12px") + " Segoe UI, Arial, sans-serif";
    ctx.fillText(sample.title, 0, -h * 0.06);

    ctx.fillStyle = rgba(palette.glow, 0.18);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-w * 0.33, h * 0.02, w * 0.66, 30, 12);
    else ctx.rect(-w * 0.33, h * 0.02, w * 0.66, 30);
    ctx.fill();

    ctx.fillStyle = "#c2d5f7";
    ctx.font = (isMain ? "600 13px" : "600 9px") + " Segoe UI, Arial, sans-serif";
    ctx.fillText(sample.type, 0, h * 0.06 + 15);

    ctx.fillStyle = "#d8e5fb";
    ctx.font = (isMain ? "500 15px" : "500 8px") + " Segoe UI, Arial, sans-serif";
    var textY = h * 0.20;
    if (isMain) {
      ctx.fillText(sample.text, 0, textY);
    } else {
      ctx.fillText(sample.text.slice(0, 24), 0, textY);
    }

    if (isMain) {
      drawChip(-70, h * 0.34, sample.chips[0], palette, false);
      drawChip(0, h * 0.34, sample.chips[1], palette, true);
      drawChip(74, h * 0.34, sample.chips[2], palette, false);
    }

    if (activation) drawActivationEffect(w, h, variant, palette, rarity, activation);

    ctx.restore();
  }

  function drawFanScene(width, height, variant, palette, rarity) {
    var mainW = Math.min(width, height) * 0.34;
    var mainH = mainW * 1.42;
    var centerX = width * 0.50;
    var centerY = height * 0.44;
    var baseCard = SAMPLE_CARDS[state.variantIndex % SAMPLE_CARDS.length];
    baseCard.emoji = variant.emoji;

    for (var i = 0; i < 4; i++) {
      var offset = i - 1.5;
      drawCard(centerX + offset * 112, centerY + Math.abs(offset) * 18, mainW * 0.78, mainH * 0.78, 1, variant, palette, rarity, SAMPLE_CARDS[(i + 1) % SAMPLE_CARDS.length], false, i);
    }
    drawCard(centerX, centerY, mainW, mainH, 1, variant, palette, rarity, baseCard, true, 0);
  }

  function drawVariantStrip(width, height, palette, rarity) {
    var pad = 18;
    var totalW = width - pad * 2;
    var slotW = totalW / VARIANTS.length;
    var y = height - 84;
    for (var i = 0; i < VARIANTS.length; i++) {
      var active = i === state.variantIndex;
      var variant = VARIANTS[i];
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.56;
      drawCard(
        pad + slotW * i + slotW * 0.5,
        y,
        Math.min(120, slotW * 0.8),
        Math.min(160, slotW * 1.08),
        active ? 0.68 : 0.54,
        variant,
        palette,
        rarity,
        { title: variant.name, type: "Style", text: variant.emoji, chips: ["", "", ""], emoji: variant.emoji },
        false,
        i
      );
      ctx.restore();
    }
  }

  function updateTexts() {
    var variant = getVariant();
    var rarity = getRarity();
    texts.title.textContent = "Card Style Prototype 01 - " + variant.name;
    texts.subtitle.textContent = variant.note;
    texts.status.textContent = variant.name + " / " + rarity.label + ": matte-glass body, sharper color edge, microcircuit layer and activation read -> " + (ACTIVATION_NOTES[variant.key] || "generic burst") + ".";
    texts.surface.textContent = variant.note;
    texts.readability.textContent = variant.readability;
    texts.goal.textContent = variant.goal;
  }

  function render() {
    var width = canvas.clientWidth || 1;
    var height = canvas.clientHeight || 1;
    var palette = getPalette();
    var rarity = getRarity();
    var variant = getVariant();
    drawBackdrop(width, height, palette);
    drawFanScene(width, height, variant, palette, rarity);
    drawVariantStrip(width, height, palette, rarity);
    updateTexts();
  }

  function tick(ts) {
    state.time = ts * 0.001;
    render();
    requestAnimationFrame(tick);
  }

  function syncVariantSelect() {
    controls.variant.innerHTML = "";
    for (var i = 0; i < VARIANTS.length; i++) {
      var option = document.createElement("option");
      option.value = String(i);
      option.textContent = VARIANTS[i].name;
      controls.variant.appendChild(option);
    }
    controls.variant.value = String(state.variantIndex);
  }

  syncVariantSelect();

  controls.variant.addEventListener("change", function () {
    state.variantIndex = Math.max(0, Math.min(VARIANTS.length - 1, Number(controls.variant.value) || 0));
    updateTexts();
  });

  controls.cycleVariant.addEventListener("click", function () {
    state.variantIndex = (state.variantIndex + 1) % VARIANTS.length;
    controls.variant.value = String(state.variantIndex);
    updateTexts();
  });

  controls.shufflePalette.addEventListener("click", function () {
    var keys = Object.keys(PALETTES);
    controls.palette.value = keys[Math.floor(Math.random() * keys.length)];
    updateTexts();
  });

  controls.pulseInspect.addEventListener("click", function () {
    state.inspectUntil = state.time + 2.8;
  });

  if (controls.playActivation) {
    controls.playActivation.addEventListener("click", function () {
      state.activationStartedAt = state.time;
    });
  }

  window.addEventListener("resize", resize);
  resize();
  updateTexts();
  requestAnimationFrame(tick);
})();
