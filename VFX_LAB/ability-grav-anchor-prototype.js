(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var canvas = document.getElementById("scene");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var controls = {
    variant: document.getElementById("variant"),
    palette: document.getElementById("palette"),
    lodMode: document.getElementById("lodMode"),
    tempo: document.getElementById("tempo"),
    radius: document.getElementById("radius"),
    drag: document.getElementById("drag"),
    cycleVariant: document.getElementById("cycleVariant"),
    shuffleShips: document.getElementById("shuffleShips"),
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
    cyan:    { core: "#72d4ff", trim: "#e7f7ff", line: "#5db6ff", dark: "#071120", hull: "#17314a", glow: "114,212,255" },
    violet:  { core: "#b694ff", trim: "#f1e8ff", line: "#9f77ff", dark: "#120d1f", hull: "#31224b", glow: "182,148,255" },
    amber:   { core: "#ffbf79", trim: "#fff1d7", line: "#ffcf78", dark: "#171108", hull: "#49311a", glow: "255,191,121" },
    crimson: { core: "#ff8ca8", trim: "#ffe7ee", line: "#ff6d94", dark: "#190d14", hull: "#45192a", glow: "255,140,168" },
    emerald: { core: "#7fe0ad", trim: "#e3ffef", line: "#62d792", dark: "#0a1611", hull: "#1b4332", glow: "127,224,173" }
  };

  var OWNER_COLORS = [
    { fill: "#5caeff", edge: "#e0f1ff" },
    { fill: "#ff879f", edge: "#ffe4ea" },
    { fill: "#8ce38a", edge: "#ecffe9" },
    { fill: "#ffc26e", edge: "#fff1d6" }
  ];

  var VARIANTS = [
    {
      key: "event-horizon-clamp",
      name: "Event Horizon Clamp",
      note: "Мягкая гравлинза с плотным темным сердечником и ровными концентрическими кольцами удержания.",
      read: "Самый чистый и понятный вариант. Сразу продает, что в точке возникла тяжелая зона остановки движения.",
      focus: "Нужен, если `Грав. Якорь` должен ощущаться как дорогой sci-fi crowd control без лишней декоративной агрессии.",
      lens: 0.34,
      rings: 4,
      spikes: 10,
      nodes: 0,
      tide: 0.08,
      lattice: 0.0,
      braces: 0.0,
      shear: 0.04,
      arrest: 0.88
    },
    {
      key: "trinity-pins",
      name: "Trinity Pins",
      note: "Три орбитальные грав-узла с триангуляцией и жесткими лучами фиксации по целям внутри радиуса.",
      read: "Лучший вариант, если хочется подчеркнуть именно point-lock и технологическое удержание, а не туманную аномалию.",
      focus: "Подходит для более инженерного визуального языка: цель буквально пришпилена к точке несколькими узлами.",
      lens: 0.20,
      rings: 2,
      spikes: 6,
      nodes: 3,
      tide: 0.04,
      lattice: 0.18,
      braces: 0.0,
      shear: 0.02,
      arrest: 0.82
    },
    {
      key: "tidal-cage",
      name: "Tidal Cage",
      note: "Вместо жесткого круга работает приливная клетка: кольца плывут, слои смещаются и вся зона дышит тяжелой приливной массой.",
      read: "Если важнее чувство медленного, но неизбежного гравитационного сдавливания, это самый атмосферный вариант.",
      focus: "Хорошо продает массу поля и контроль через pressure-wave, а не через механические якоря.",
      lens: 0.22,
      rings: 5,
      spikes: 8,
      nodes: 0,
      tide: 0.26,
      lattice: 0.0,
      braces: 0.0,
      shear: 0.06,
      arrest: 0.78
    },
    {
      key: "lattice-arrestor",
      name: "Lattice Arrestor",
      note: "Соты, телеметрия и крестовая решетка превращают зону в умный контур, который вычисляет и останавливает движение.",
      read: "Самый high-tech вариант. Читается как control-tech, а не чистая гравитационная аномалия.",
      focus: "Подходит, если способность должна выглядеть как продвинутый field suppressor с хорошей UI-подачей.",
      lens: 0.16,
      rings: 3,
      spikes: 4,
      nodes: 4,
      tide: 0.03,
      lattice: 1.0,
      braces: 0.56,
      shear: 0.02,
      arrest: 0.84
    },
    {
      key: "prison-halo",
      name: "Prison Halo",
      note: "Толстый периметр, inward-spikes и тяжелые боковые скобы делают зону похожей на тюремный ворот.",
      read: "Самый прямолинейный и агрессивный вариант. Хорошо продает запрет движения и опасный контур даже издалека.",
      focus: "Если хочется большего визуального веса у самой границы зоны, это самый читаемый кандидат.",
      lens: 0.24,
      rings: 2,
      spikes: 18,
      nodes: 0,
      tide: 0.02,
      lattice: 0.24,
      braces: 1.0,
      shear: 0.0,
      arrest: 0.94
    },
    {
      key: "shear-knot",
      name: "Shear Knot",
      note: "Асимметричный узел со скрученными срезами пространства, нестабильными дугами и рваными contour-перехватами.",
      read: "Самый нервный и опасный вариант. Хорошо подходит, если контроль должен ощущаться почти как violent spacetime failure.",
      focus: "Нужен, если у способности должен быть более злой характер, но без ухода в чистый урон или взрыв.",
      lens: 0.30,
      rings: 3,
      spikes: 12,
      nodes: 2,
      tide: 0.14,
      lattice: 0.0,
      braces: 0.32,
      shear: 0.18,
      arrest: 1.0
    }
  ];

  var state = {
    time: 0,
    pulseOrigin: 0,
    shipSeed: 0,
    stars: []
  };

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function hexToRgb(hex) {
    var clean = String(hex || "#000000").replace("#", "");
    if (clean.length === 3) clean = clean.split("").map(function (ch) { return ch + ch; }).join("");
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

  function hash01(seed) {
    var value = Math.sin(seed * 127.1 + seed * seed * 0.013) * 43758.5453123;
    return value - Math.floor(value);
  }

  function getPalette() {
    return PALETTES[controls.palette.value] || PALETTES.cyan;
  }

  function getVariant() {
    return VARIANTS[Math.max(0, Math.min(VARIANTS.length - 1, Number(controls.variant.value) || 0))] || VARIANTS[0];
  }

  function getTempo() {
    return Number(controls.tempo.value) / 100;
  }

  function getRadiusFactor() {
    return Number(controls.radius.value) / 100;
  }

  function getDragFactor() {
    return Number(controls.drag.value) / 100;
  }

  function getLodKey() {
    if (controls.lodMode.value !== "auto") return controls.lodMode.value;
    var radius = getRadiusFactor();
    if (radius < 0.52) return "far";
    if (radius < 0.76) return "mid";
    return "near";
  }

  function rebuildStars(width, height) {
    state.stars = [];
    var count = Math.max(90, Math.floor(width * height / 12000));
    for (var i = 0; i < count; i++) {
      state.stars.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.4 + Math.random() * 1.4,
        alpha: 0.08 + Math.random() * 0.40,
        depth: 0.18 + Math.random() * 0.82
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

    var haze = ctx.createRadialGradient(width * 0.58, height * 0.48, 0, width * 0.58, height * 0.48, Math.max(width, height) * 0.62);
    haze.addColorStop(0, rgba(palette.glow, 0.10));
    haze.addColorStop(0.54, rgba(palette.glow, 0.024));
    haze.addColorStop(1, rgba(palette.glow, 0));
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);

    for (var i = 0; i < state.stars.length; i++) {
      var star = state.stars[i];
      var sx = star.x * width + Math.sin(state.time * (0.05 + star.depth * 0.14) + i * 1.7) * star.depth * 9;
      var sy = star.y * height + Math.cos(state.time * (0.08 + star.depth * 0.12) + i * 2.2) * star.depth * 6;
      ctx.beginPath();
      ctx.fillStyle = "rgba(230,238,255," + star.alpha + ")";
      ctx.arc(sx, sy, star.r, 0, TAU);
      ctx.fill();
    }
  }

  function drawGrid(width, height, zoneX, zoneY, palette, radius) {
    var spacing = 56;
    ctx.strokeStyle = rgbaHex(palette.line, 0.07);
    ctx.lineWidth = 1;
    for (var x = (zoneX % spacing) - spacing; x < width + spacing; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (var y = (zoneY % spacing) - spacing; y < height + spacing; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = rgbaHex(palette.trim, 0.08);
    ctx.beginPath();
    ctx.moveTo(zoneX - radius * 1.6, zoneY);
    ctx.lineTo(zoneX + radius * 1.6, zoneY);
    ctx.moveTo(zoneX, zoneY - radius * 1.6);
    ctx.lineTo(zoneX, zoneY + radius * 1.6);
    ctx.stroke();
  }

  function drawRing(x, y, radius, color, alpha, width) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.strokeStyle = rgbaHex(color, alpha);
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function drawTelemetryBrackets(x, y, radius, palette, alpha, width) {
    var corner = radius * 0.24;
    ctx.strokeStyle = rgbaHex(palette.trim, alpha);
    ctx.lineWidth = width || 1.6;
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

  function drawIrregularContour(x, y, radius, wobble, points, color, alpha, width, spin) {
    ctx.beginPath();
    for (var i = 0; i <= points; i++) {
      var t = i / Math.max(1, points);
      var ang = t * TAU + (spin || 0);
      var wave = Math.sin(ang * 3.0 + state.time * 0.8) * wobble + Math.cos(ang * 5.0 - state.time * 0.6) * wobble * 0.58;
      var rr = radius + wave;
      var px = x + Math.cos(ang) * rr;
      var py = y + Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = rgbaHex(color, alpha);
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function traceShipHullPath(classKey) {
    ctx.beginPath();
    if (classKey === "fighter") {
      ctx.moveTo(3.0, 0);
      ctx.lineTo(1.4, -0.55);
      ctx.lineTo(0.2, -1.0);
      ctx.lineTo(-0.8, -0.6);
      ctx.lineTo(-1.4, 0);
      ctx.lineTo(-0.8, 0.6);
      ctx.lineTo(0.2, 1.0);
      ctx.lineTo(1.4, 0.55);
    } else if (classKey === "destroyer") {
      ctx.moveTo(3.8, 0);
      ctx.lineTo(1.8, -0.76);
      ctx.lineTo(0.1, -1.24);
      ctx.lineTo(-1.3, -0.88);
      ctx.lineTo(-2.0, -0.20);
      ctx.lineTo(-2.2, 0);
      ctx.lineTo(-2.0, 0.20);
      ctx.lineTo(-1.3, 0.88);
      ctx.lineTo(0.1, 1.24);
      ctx.lineTo(1.8, 0.76);
    } else if (classKey === "cruiser") {
      ctx.moveTo(4.8, 0);
      ctx.lineTo(2.1, -1.0);
      ctx.lineTo(0.3, -1.42);
      ctx.lineTo(-1.5, -1.0);
      ctx.lineTo(-2.9, -0.34);
      ctx.lineTo(-3.3, 0);
      ctx.lineTo(-2.9, 0.34);
      ctx.lineTo(-1.5, 1.0);
      ctx.lineTo(0.3, 1.42);
      ctx.lineTo(2.1, 1.0);
    } else {
      ctx.moveTo(5.0, 0);
      ctx.lineTo(2.8, -1.18);
      ctx.lineTo(-0.2, -1.38);
      ctx.lineTo(-2.8, -0.86);
      ctx.lineTo(-4.0, 0);
      ctx.lineTo(-2.8, 0.86);
      ctx.lineTo(-0.2, 1.38);
      ctx.lineTo(2.8, 1.18);
    }
    ctx.closePath();
  }

  function getOwnerColors(index) {
    return OWNER_COLORS[index % OWNER_COLORS.length];
  }

  function drawShipTrail(x, y, angle, length, color, alpha, width) {
    var dx = Math.cos(angle);
    var dy = Math.sin(angle);
    ctx.strokeStyle = rgbaHex(color, alpha);
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - dx * length, y - dy * length);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function drawShipSilhouette(x, y, angle, scale, classKey, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    traceShipHullPath(classKey);
    ctx.fillStyle = "rgba(246,250,255," + (0.80 * alpha) + ")";
    ctx.fill();
    ctx.strokeStyle = "rgba(184,224,255," + (0.32 * alpha) + ")";
    ctx.lineWidth = 0.20;
    ctx.stroke();
    ctx.restore();
  }

  function drawShipSprite(x, y, angle, scale, classKey, ownerIndex, alpha) {
    var colors = getOwnerColors(ownerIndex);
    var hullAlpha = alpha == null ? 1 : alpha;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    traceShipHullPath(classKey);
    ctx.fillStyle = rgbaHex(colors.fill, 0.84 * hullAlpha);
    ctx.fill();
    ctx.lineWidth = 0.20;
    ctx.strokeStyle = rgbaHex(colors.edge, 0.76 * hullAlpha);
    ctx.stroke();

    ctx.strokeStyle = rgbaHex(colors.edge, 0.42 * hullAlpha);
    ctx.lineWidth = 0.16;
    ctx.beginPath();
    ctx.moveTo(1.8, 0);
    ctx.lineTo(-1.4, 0);
    ctx.moveTo(0.4, -0.56);
    ctx.lineTo(-0.7, -0.9);
    ctx.moveTo(0.4, 0.56);
    ctx.lineTo(-0.7, 0.9);
    ctx.stroke();

    ctx.restore();
  }

  function buildShips(zoneX, zoneY, radius) {
    var base = [
      { ang: -2.18, dist: 0.34, size: 11.6, cls: "cruiser", owner: 1, inside: true },
      { ang: -0.76, dist: 0.42, size: 8.6, cls: "destroyer", owner: 0, inside: true },
      { ang: 0.92, dist: 0.28, size: 7.2, cls: "fighter", owner: 2, inside: true },
      { ang: 2.10, dist: 0.48, size: 12.2, cls: "carrier", owner: 3, inside: true },
      { ang: -0.14, dist: 1.22, size: 9.2, cls: "destroyer", owner: 0, inside: false },
      { ang: 2.96, dist: 1.40, size: 10.6, cls: "cruiser", owner: 2, inside: false }
    ];
    var ships = [];
    for (var i = 0; i < base.length; i++) {
      var ref = base[i];
      var jitterA = (hash01(state.shipSeed + i * 13 + 1) - 0.5) * (ref.inside ? 0.32 : 0.20);
      var jitterR = (hash01(state.shipSeed + i * 13 + 4) - 0.5) * radius * (ref.inside ? 0.08 : 0.14);
      var ang = ref.ang + jitterA;
      var dist = ref.dist * radius + jitterR;
      var x = zoneX + Math.cos(ang) * dist;
      var y = zoneY + Math.sin(ang) * dist * 0.84;
      ships.push({
        x: x,
        y: y,
        angle: ang + Math.PI,
        size: ref.size,
        cls: ref.cls,
        owner: ref.owner,
        inside: ref.inside
      });
    }
    return ships;
  }

  function drawLockGlyph(x, y, radius, palette, alpha, phase) {
    drawRing(x, y, radius, palette.trim, 0.20 * alpha, 1.2);
    drawRing(x, y, radius * 0.64, palette.line, 0.18 * alpha, 1.0);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(phase);
    ctx.strokeStyle = rgbaHex(palette.trim, 0.20 * alpha);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.72, 0);
    ctx.lineTo(radius * 0.72, 0);
    ctx.moveTo(0, -radius * 0.72);
    ctx.lineTo(0, radius * 0.72);
    ctx.stroke();
    ctx.restore();
  }

  function drawAnchorNode(x, y, radius, palette, alpha) {
    var grad = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
    grad.addColorStop(0, rgbaHex(palette.trim, 0.84 * alpha));
    grad.addColorStop(0.40, rgbaHex(palette.core, 0.28 * alpha));
    grad.addColorStop(1, rgbaHex(palette.core, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
    drawRing(x, y, radius * 0.56, palette.trim, 0.42 * alpha, 1.4);
    drawTelemetryBrackets(x, y, radius * 1.8, palette, 0.14 * alpha, 1.1);
  }

  function drawAnchorSigil(x, y, radius, palette, alpha) {
    ctx.strokeStyle = rgbaHex(palette.trim, alpha);
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(x, y - radius * 0.70);
    ctx.lineTo(x, y + radius * 0.42);
    ctx.moveTo(x - radius * 0.34, y - radius * 0.18);
    ctx.lineTo(x + radius * 0.34, y - radius * 0.18);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y + radius * 0.14, radius * 0.42, Math.PI * 0.12, Math.PI * 0.88, false);
    ctx.stroke();
    drawRing(x, y - radius * 0.82, radius * 0.16, palette.trim, alpha * 0.82, 1.4);
  }

  function drawLattice(zoneX, zoneY, radius, palette, alpha, phase) {
    for (var h = 0; h < 3; h++) {
      var rr = radius * (0.40 + h * 0.18);
      ctx.save();
      ctx.translate(zoneX, zoneY);
      ctx.rotate(phase * (h % 2 === 0 ? 1 : -1) + h * 0.32);
      ctx.strokeStyle = rgbaHex(h % 2 === 0 ? palette.trim : palette.line, alpha * (0.54 - h * 0.10));
      ctx.lineWidth = 1.0 + h * 0.15;
      ctx.beginPath();
      for (var i = 0; i <= 6; i++) {
        var ang = (i / 6) * TAU;
        var px = Math.cos(ang) * rr;
        var py = Math.sin(ang) * rr * 0.90;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawGravAnchor(width, height, palette, variant, lodKey) {
    var tempo = getTempo();
    var radius = lerp(90, 168, getRadiusFactor());
    var drag = getDragFactor();
    var zoneX = width * 0.56;
    var zoneY = height * 0.50;
    var cycle = ((state.time - state.pulseOrigin) * Math.max(0.46, tempo)) % 6;
    var pulse = 0.5 + 0.5 * Math.sin(cycle * 1.15);
    var intensity = 0.62 + pulse * 0.38;
    var ships = buildShips(zoneX, zoneY, radius);
    var spikeCount = lodKey === "far" ? Math.floor(variant.spikes * 0.55) : (lodKey === "mid" ? Math.floor(variant.spikes * 0.80) : variant.spikes);
    var ringCount = lodKey === "far" ? Math.max(2, Math.floor(variant.rings * 0.7)) : variant.rings;
    var nodeCount = lodKey === "far" ? Math.max(0, variant.nodes - 1) : variant.nodes;
    var phase = state.time * (0.28 + tempo * 0.16);

    drawBackdrop(width, height, palette);
    drawGrid(width, height, zoneX, zoneY, palette, radius);

    var halo = ctx.createRadialGradient(zoneX, zoneY, radius * 0.10, zoneX, zoneY, radius * 1.46);
    halo.addColorStop(0, rgbaHex(palette.dark, (0.24 + variant.lens * 0.34) * intensity));
    halo.addColorStop(0.24, rgbaHex(palette.core, (0.06 + variant.lens * 0.16) * intensity));
    halo.addColorStop(0.62, rgbaHex(palette.core, (0.05 + variant.tide * 0.10) * intensity));
    halo.addColorStop(1, rgbaHex(palette.core, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(zoneX, zoneY, radius * 1.46, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(zoneX, zoneY);
    ctx.rotate(phase * 0.3);
    ctx.scale(1, 0.74 + variant.tide * 0.24);
    drawRing(0, 0, radius * (0.90 + variant.tide * 0.10), palette.line, 0.14 + pulse * 0.08, 2.0);
    drawRing(0, 0, radius * (0.62 + variant.tide * 0.12), palette.core, 0.10 + pulse * 0.04, 1.2);
    ctx.restore();

    for (var r = 0; r < ringCount; r++) {
      var frac = ringCount <= 1 ? 0 : r / (ringCount - 1);
      var rr = radius * (0.28 + frac * 0.82);
      drawIrregularContour(zoneX, zoneY, rr, rr * (0.010 + variant.shear * 0.14), 64, r % 2 === 0 ? palette.trim : palette.line, (0.28 - frac * 0.10) * intensity, 1.4 + frac * 1.4, phase * (0.2 + frac * 0.14) + r * 0.42);
    }

    for (var s = 0; s < spikeCount; s++) {
      var ang = (s / Math.max(1, spikeCount)) * TAU + phase * 0.42;
      var start = radius * (0.92 + (s % 3) * 0.05);
      var end = radius * (0.42 + (s % 4) * 0.04);
      ctx.strokeStyle = rgbaHex(s % 2 === 0 ? palette.trim : palette.line, 0.10 + intensity * 0.12);
      ctx.lineWidth = s % 4 === 0 ? 1.7 : 1.1;
      ctx.beginPath();
      ctx.moveTo(zoneX + Math.cos(ang) * start, zoneY + Math.sin(ang) * start);
      ctx.lineTo(zoneX + Math.cos(ang) * end, zoneY + Math.sin(ang) * end);
      ctx.stroke();
    }

    if (variant.lattice > 0.01) {
      drawLattice(zoneX, zoneY, radius, palette, 0.18 + pulse * 0.08, phase);
      drawTelemetryBrackets(zoneX, zoneY, radius * 0.92, palette, 0.18 + pulse * 0.06, 1.4);
    }

    if (variant.braces > 0.01) {
      for (var b = 0; b < 4; b++) {
        var sideAng = b * Math.PI * 0.5 + phase * 0.16;
        var bx = zoneX + Math.cos(sideAng) * radius * 1.04;
        var by = zoneY + Math.sin(sideAng) * radius * 1.04;
        ctx.strokeStyle = rgbaHex(palette.trim, (0.10 + variant.braces * 0.10) * intensity);
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(bx + Math.cos(sideAng + Math.PI * 0.5) * radius * 0.12, by + Math.sin(sideAng + Math.PI * 0.5) * radius * 0.12);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx + Math.cos(sideAng - Math.PI * 0.5) * radius * 0.12, by + Math.sin(sideAng - Math.PI * 0.5) * radius * 0.12);
        ctx.stroke();
      }
    }

    var nodes = [];
    for (var n = 0; n < nodeCount; n++) {
      var nang = (n / Math.max(1, nodeCount)) * TAU - Math.PI * 0.5 + phase * 0.44;
      var nx = zoneX + Math.cos(nang) * radius * 0.92;
      var ny = zoneY + Math.sin(nang) * radius * 0.72;
      nodes.push({ x: nx, y: ny, ang: nang });
      drawAnchorNode(nx, ny, radius * 0.10, palette, 0.84);
      ctx.strokeStyle = rgbaHex(palette.line, 0.16 + pulse * 0.08);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(zoneX, zoneY);
      ctx.lineTo(nx, ny);
      ctx.stroke();
    }

    for (var i = 0; i < ships.length; i++) {
      var ship = ships[i];
      if (!ship.inside) {
        drawShipTrail(ship.x, ship.y, ship.angle, ship.size * 2.6, i % 2 === 0 ? hexToRgb(palette.core).r ? palette.line : palette.line : palette.core, 0.10 + pulse * 0.05, 1.8);
        drawShipSprite(ship.x, ship.y, ship.angle, ship.size, ship.cls, ship.owner, 0.88);
        continue;
      }

      var angToCenter = Math.atan2(ship.y - zoneY, ship.x - zoneX);
      var pull = radius * (0.09 + drag * 0.12) * variant.arrest;
      var ghostX = ship.x + Math.cos(angToCenter) * pull * 0.56;
      var ghostY = ship.y + Math.sin(angToCenter) * pull * 0.56;
      var wobble = Math.sin(state.time * 2.0 + i * 1.7) * radius * 0.010;
      var lockedX = ship.x - Math.sin(angToCenter) * wobble;
      var lockedY = ship.y + Math.cos(angToCenter) * wobble;

      drawShipTrail(ghostX, ghostY, ship.angle, ship.size * 2.8, palette.core, 0.08 + intensity * 0.05, 1.5);
      drawShipSilhouette(ghostX, ghostY, ship.angle, ship.size, ship.cls, 0.18);

      var beamStart = nodeCount ? nodes[i % Math.max(1, nodeCount)] : { x: zoneX, y: zoneY };
      var bendX = lerp(beamStart.x, lockedX, 0.56) + Math.sin(state.time * 1.2 + i) * 16 * variant.tide;
      var bendY = lerp(beamStart.y, lockedY, 0.56) - Math.cos(state.time * 1.3 + i) * 16 * (variant.shear + 0.06);
      ctx.strokeStyle = rgbaHex(palette.trim, 0.12 + intensity * 0.12);
      ctx.lineWidth = 1.4 + (i % 2) * 0.4;
      ctx.beginPath();
      ctx.moveTo(beamStart.x, beamStart.y);
      ctx.quadraticCurveTo(bendX, bendY, lockedX, lockedY);
      ctx.stroke();

      drawLockGlyph(lockedX, lockedY, ship.size * 1.9, palette, 0.82, phase + i * 0.4);
      drawTelemetryBrackets(lockedX, lockedY, ship.size * 1.54, palette, 0.08 + intensity * 0.08, 1.0);
      drawShipSprite(lockedX, lockedY, ship.angle, ship.size, ship.cls, ship.owner, 0.94);
    }

    drawAnchorSigil(zoneX, zoneY, radius * 0.26, palette, 0.64 + pulse * 0.18);
    drawRing(zoneX, zoneY, radius, palette.trim, 0.22 + pulse * 0.12, 2.6);
    drawRing(zoneX, zoneY, radius * 0.68, palette.core, 0.12 + pulse * 0.05, 1.2);
    drawRing(zoneX, zoneY, radius * 0.18, palette.trim, 0.34 + pulse * 0.12, 1.8);
  }

  function drawVariantStrip(width, height, palette) {
    var pad = 18;
    var slotW = (width - pad * 2) / Math.max(1, VARIANTS.length);
    var y = height - 64;
    var activeIndex = Math.max(0, Math.min(VARIANTS.length - 1, Number(controls.variant.value) || 0));
    for (var i = 0; i < VARIANTS.length; i++) {
      var active = i === activeIndex;
      var variant = VARIANTS[i];
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
      } else {
        ctx.fillRect(pad + slotW * i + slotW * 0.08, y - 18, slotW * 0.84, 42);
      }
      ctx.fillStyle = "#edf5ff";
      ctx.font = "600 11px Segoe UI, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(variant.name, pad + slotW * i + slotW * 0.5, y + 7);
      ctx.restore();
    }
  }

  function updateTexts() {
    var variant = getVariant();
    texts.title.textContent = "Ability Grav Anchor Prototype 01 - " + variant.name;
    texts.subtitle.textContent = variant.note;
    texts.status.textContent = "gravAnchor / " + variant.name + ": immobilization zone with 5s point-lock, 150 radius and arrested-motion ships.";
    texts.gameplay.textContent = "Текущая игровая способность `gravAnchor` - точечный контроль радиуса `150` на `5с`, где враги должны выглядеть не ранеными, а именно пойманными и лишенными хода.";
    texts.read.textContent = variant.read;
    texts.focus.textContent = variant.focus;
  }

  function render() {
    var width = canvas.clientWidth || 1;
    var height = canvas.clientHeight || 1;
    var palette = getPalette();
    var variant = getVariant();
    var lodKey = getLodKey();
    drawGravAnchor(width, height, palette, variant, lodKey);
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

  syncSelect(controls.variant, VARIANTS);
  controls.variant.value = "0";

  controls.cycleVariant.addEventListener("click", function () {
    var next = (Number(controls.variant.value) + 1) % VARIANTS.length;
    controls.variant.value = String(next);
    updateTexts();
  });

  controls.shuffleShips.addEventListener("click", function () {
    state.shipSeed += 97;
  });

  controls.triggerPulse.addEventListener("click", function () {
    state.pulseOrigin = state.time;
  });

  controls.variant.addEventListener("change", updateTexts);
  controls.palette.addEventListener("change", updateTexts);
  controls.lodMode.addEventListener("change", updateTexts);
  controls.tempo.addEventListener("input", updateTexts);
  controls.radius.addEventListener("input", updateTexts);
  controls.drag.addEventListener("input", updateTexts);

  window.addEventListener("resize", resize);
  resize();
  updateTexts();
  requestAnimationFrame(tick);
})();
