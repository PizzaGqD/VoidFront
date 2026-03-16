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
    toxicity: document.getElementById("toxicity"),
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
    cyan:    { core: "#7dd6ff", trim: "#d9f6ff", line: "#6ebeff", dark: "#09131f", hull: "#183149", glow: "125,214,255" },
    amber:   { core: "#ffb86b", trim: "#ffefc9", line: "#ffcf78", dark: "#171007", hull: "#4a2d11", glow: "255,184,107" },
    violet:  { core: "#cba3ff", trim: "#f3e6ff", line: "#c28bff", dark: "#120d1f", hull: "#32224e", glow: "203,163,255" },
    crimson: { core: "#ff8aa5", trim: "#ffe1ea", line: "#ff6b8d", dark: "#180d14", hull: "#4a1b2c", glow: "255,138,165" },
    emerald: { core: "#7de1a8", trim: "#e0ffed", line: "#67d497", dark: "#0a1610", hull: "#1b4330", glow: "125,225,168" }
  };

  var OWNER_COLORS = [
    { fill: "#5caeff", edge: "#e0f1ff" },
    { fill: "#ff879f", edge: "#ffe4ea" },
    { fill: "#8ce38a", edge: "#ecffe9" },
    { fill: "#ffc26e", edge: "#fff1d6" }
  ];

  var VARIANTS = [
    {
      key: "grey-goo-bloom",
      name: "Grey Goo Bloom",
      note: "Плотная масса микрочастиц и блеклый коррозионный туман, который буквально съедает корпус внутри зоны.",
      read: "Лучший кандидат, если `Нанорой` должен ощущаться как технологическая чума, а не просто зеленый яд.",
      focus: "Подчеркивает чувство ненасытной массы и грязного mechanical decay на кораблях.",
      fog: 0.26,
      cells: 26,
      tendrils: 8,
      shards: 0,
      telemetry: false,
      eclipse: false,
      halo: 0.14,
      suppression: 0.52
    },
    {
      key: "hunter-fog",
      name: "Hunter Fog",
      note: "Хищный туман с длинными усиками тянется к корпусам, будто рой сам ищет жертвы внутри облака.",
      read: "Самый агрессивный и живой вариант. Хорошо продает, что облако actively hunts targets, а не просто висит на месте.",
      focus: "Подходит, если у DoT-зоны должен быть почти звериный характер преследования.",
      fog: 0.22,
      cells: 18,
      tendrils: 14,
      shards: 4,
      telemetry: false,
      eclipse: false,
      halo: 0.18,
      suppression: 0.46
    },
    {
      key: "prism-spore",
      name: "Prism Spore",
      note: "Светящиеся ячейки и спороподобные кластеры делают рой экзотическим и чуть более alien-biotech.",
      read: "Если хочется необычного и красивого sci-fi without losing readability, это самый выразительный biotic вариант.",
      focus: "Сильнее всего продает рой как умную биотехнологическую заразу, а не просто металл или кислоту.",
      fog: 0.18,
      cells: 32,
      tendrils: 6,
      shards: 2,
      telemetry: false,
      eclipse: false,
      halo: 0.22,
      suppression: 0.40
    },
    {
      key: "razor-mist",
      name: "Razor Mist",
      note: "Рой ощущается как режущий micro-blade storm: меньше молочной дымки, больше полос, резов и сухой механической коррозии.",
      read: "Лучший вариант, если облако должно выглядеть опасно даже без плотного тумана и мягких светящихся лобов.",
      focus: "Подходит для более жесткого, почти weaponized варианта нанооблака.",
      fog: 0.14,
      cells: 12,
      tendrils: 5,
      shards: 20,
      telemetry: false,
      eclipse: false,
      halo: 0.12,
      suppression: 0.54
    },
    {
      key: "lattice-bloom",
      name: "Lattice Bloom",
      note: "Внутри облака читаются цифровые соты, braces и направляющие скобы, как будто рой управляется алгоритмом.",
      read: "Самая умная и технологичная подача. Хорошо показывает debuff, tracking и calculated suppression.",
      focus: "Идеален, если Нанорой в игре должен восприниматься как controlled smart-cloud, а не хаос.",
      fog: 0.16,
      cells: 24,
      tendrils: 8,
      shards: 6,
      telemetry: true,
      eclipse: false,
      halo: 0.20,
      suppression: 0.62
    },
    {
      key: "eclipse-mites",
      name: "Eclipse Mites",
      note: "Темное ядро и яркие укусы по краям делают облако мрачным и очень контрастным даже в силуэте.",
      read: "Самый темный и опасный вариант. Хорошо читается на черной карте и не растворяется в фоне.",
      focus: "Подходит, если нужна угроза через контраст: тьма в центре, светящиеся bite-marks и яркая граница риска.",
      fog: 0.20,
      cells: 20,
      tendrils: 10,
      shards: 10,
      telemetry: false,
      eclipse: true,
      halo: 0.16,
      suppression: 0.48
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

  function getToxicity() {
    return Number(controls.toxicity.value) / 100;
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
        alpha: 0.08 + Math.random() * 0.42,
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

    var haze = ctx.createRadialGradient(width * 0.62, height * 0.44, 0, width * 0.62, height * 0.44, Math.max(width, height) * 0.60);
    haze.addColorStop(0, rgba(palette.glow, 0.08));
    haze.addColorStop(0.50, rgba(palette.glow, 0.02));
    haze.addColorStop(1, rgba(palette.glow, 0));
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);

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

  function drawRing(x, y, radius, color, alpha, width) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.strokeStyle = rgbaHex(color, alpha);
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function drawTelemetryBrackets(x, y, radius, palette, alpha, width) {
    var corner = radius * 0.25;
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

  function drawTargetArea(cx, cy, radius, palette, variantPower) {
    var pulse = 0.5 + 0.5 * Math.sin(state.time * (1.0 + variantPower * 0.3));
    drawRing(cx, cy, radius, palette.line, 0.18 + pulse * 0.10, 2.2);
    drawRing(cx, cy, radius * 0.72, palette.core, 0.08 + pulse * 0.06, 1.2);
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

    ctx.strokeStyle = rgbaHex(colors.edge, 0.44 * hullAlpha);
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

  function buildShips(zoneX, zoneY, radius) {
    var base = [
      { ang: -2.10, dist: 0.26, size: 11.2, cls: "cruiser", owner: 0, inside: true },
      { ang: -0.80, dist: 0.42, size: 8.4, cls: "destroyer", owner: 1, inside: true },
      { ang: 0.90, dist: 0.24, size: 7.4, cls: "fighter", owner: 2, inside: true },
      { ang: 2.20, dist: 0.40, size: 12.4, cls: "carrier", owner: 3, inside: true },
      { ang: 0.06, dist: 1.12, size: 8.8, cls: "destroyer", owner: 0, inside: false }
    ];
    var ships = [];
    for (var i = 0; i < base.length; i++) {
      var ref = base[i];
      var jitterA = (hash01(state.shipSeed + i * 19 + 1) - 0.5) * (ref.inside ? 0.40 : 0.18);
      var jitterR = (hash01(state.shipSeed + i * 19 + 5) - 0.5) * radius * (ref.inside ? 0.12 : 0.18);
      var ang = ref.ang + jitterA;
      var dist = ref.dist * radius + jitterR;
      ships.push({
        x: zoneX + Math.cos(ang) * dist,
        y: zoneY + Math.sin(ang) * dist * 0.82,
        angle: ang + Math.PI,
        size: ref.size,
        cls: ref.cls,
        owner: ref.owner,
        inside: ref.inside
      });
    }
    return ships;
  }

  function drawNanoShipCorrosion(shipX, shipY, shipScale, intensity, palette, variant, seed) {
    var biteCount = variant.shards > 0 ? Math.max(5, Math.floor(variant.shards * 0.36)) : 6;
    for (var i = 0; i < biteCount; i++) {
      var ang = hash01(seed + i * 7) * TAU + state.time * 0.4;
      var dist = shipScale * (0.9 + hash01(seed + i * 11) * 2.0);
      var len = shipScale * (0.8 + hash01(seed + i * 13) * 1.6);
      var x = shipX + Math.cos(ang) * dist;
      var y = shipY + Math.sin(ang) * dist;
      ctx.strokeStyle = i % 2 === 0 ? rgbaHex(palette.trim, 0.24 * intensity) : rgba(palette.glow, 0.18 * intensity);
      ctx.lineWidth = 1.0 + hash01(seed + i * 5);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
  }

  function drawSuppressionMarks(x, y, shipScale, palette, alpha, seed) {
    for (var i = 0; i < 3; i++) {
      var sway = Math.sin(state.time * 1.6 + seed + i * 0.8) * shipScale * 0.18;
      var px = x + shipScale * (1.2 + i * 0.55);
      var py = y - shipScale * 0.7 + i * shipScale * 0.42 + sway;
      ctx.strokeStyle = rgbaHex(palette.trim, alpha * (0.54 - i * 0.10));
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px - shipScale * 0.5, py - shipScale * 0.18);
      ctx.lineTo(px, py + shipScale * 0.28);
      ctx.lineTo(px + shipScale * 0.5, py - shipScale * 0.18);
      ctx.stroke();
    }
    ctx.strokeStyle = rgbaHex(palette.line, alpha * 0.48);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + shipScale * 1.0, y - shipScale * 1.0);
    ctx.lineTo(x + shipScale * 2.4, y + shipScale * 0.4);
    ctx.moveTo(x + shipScale * 2.4, y - shipScale * 1.0);
    ctx.lineTo(x + shipScale * 1.0, y + shipScale * 0.4);
    ctx.stroke();
  }

  function drawNanoSwarm(width, height, palette, variant, lodKey) {
    var tempo = getTempo();
    var toxicity = getToxicity();
    var radius = lerp(90, 170, getRadiusFactor());
    var zoneX = width * 0.58;
    var zoneY = height * 0.50;
    var cycleSec = ((state.time - state.pulseOrigin) * Math.max(0.48, tempo)) % 6;
    var cloudPulse = 0.5 + 0.5 * Math.sin(cycleSec * 0.9);
    var intensity = (0.64 + cloudPulse * 0.36) * (0.82 + toxicity * 0.28);
    var ships = buildShips(zoneX, zoneY, radius);
    var lobeCount = variant.eclipse ? 6 : 5;
    var cellCountBase = Math.round(variant.cells * (0.85 + toxicity * 0.35));
    var shardCountBase = Math.round(variant.shards * (0.85 + toxicity * 0.35));
    var cellCount = lodKey === "far" ? Math.max(10, Math.floor(cellCountBase * 0.4)) : (lodKey === "mid" ? Math.floor(cellCountBase * 0.7) : cellCountBase);
    var tendrilCount = lodKey === "far" ? Math.floor(variant.tendrils * 0.5) : variant.tendrils;
    var shardCount = lodKey === "far" ? Math.floor(shardCountBase * 0.5) : shardCountBase;

    drawBackdrop(width, height, palette);
    drawTargetArea(zoneX, zoneY, radius, palette, variant.halo * 2.8 + 0.4);
    if (variant.telemetry) drawTelemetryBrackets(zoneX, zoneY, radius * 0.82, palette, 0.22 + cloudPulse * 0.06, 1.5);

    var cloud = ctx.createRadialGradient(zoneX, zoneY, radius * 0.12, zoneX, zoneY, radius * 1.16);
    cloud.addColorStop(0, variant.eclipse ? rgbaHex(palette.dark, 0.64 * intensity) : rgbaHex(palette.trim, 0.10 * intensity));
    cloud.addColorStop(0.22, rgbaHex(palette.core, variant.fog * intensity));
    cloud.addColorStop(0.60, rgbaHex(palette.core, variant.fog * 0.56 * intensity));
    cloud.addColorStop(1, rgbaHex(palette.core, 0));
    ctx.fillStyle = cloud;
    ctx.beginPath();
    ctx.arc(zoneX, zoneY, radius * 1.16, 0, TAU);
    ctx.fill();

    for (var l = 0; l < lobeCount; l++) {
      var lobeAng = (l / lobeCount) * TAU + cycleSec * 0.24 * (l % 2 === 0 ? 1 : -1);
      var lobeR = radius * (0.24 + (l % 3) * 0.08 + variant.halo * 0.12);
      var lx = zoneX + Math.cos(lobeAng) * radius * 0.30;
      var ly = zoneY + Math.sin(lobeAng) * radius * 0.20;
      var lobeGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, lobeR);
      lobeGrad.addColorStop(0, rgbaHex(variant.eclipse ? palette.dark : palette.trim, 0.14 * intensity));
      lobeGrad.addColorStop(0.44, rgbaHex(palette.core, 0.08 * intensity));
      lobeGrad.addColorStop(1, rgbaHex(palette.core, 0));
      ctx.fillStyle = lobeGrad;
      ctx.beginPath();
      ctx.arc(lx, ly, lobeR, 0, TAU);
      ctx.fill();
    }

    for (var c = 0; c < cellCount; c++) {
      var seed = 211 + c * 19;
      var ang = hash01(seed + 1) * TAU + cycleSec * (0.12 + hash01(seed + 2) * 0.18);
      var rr = radius * (0.10 + hash01(seed + 3) * 0.88);
      var x = zoneX + Math.cos(ang) * rr;
      var y = zoneY + Math.sin(ang) * rr * 0.74;
      var r = 1.0 + hash01(seed + 4) * 3.4;
      ctx.beginPath();
      ctx.fillStyle = c % 3 === 0 ? rgbaHex(palette.trim, 0.10 + intensity * 0.10) : rgbaHex(palette.core, 0.08 + intensity * 0.08);
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      if (variant.telemetry && c % 4 === 0) {
        drawRing(x, y, r * 2.4, palette.trim, 0.08 * intensity, 0.8);
      }
    }

    for (var sh = 0; sh < shardCount; sh++) {
      var shardSeed = 337 + sh * 29;
      var shardAng = hash01(shardSeed) * TAU + cycleSec * 0.20;
      var shardR = radius * (0.14 + hash01(shardSeed + 1) * 0.82);
      var sx = zoneX + Math.cos(shardAng) * shardR;
      var sy = zoneY + Math.sin(shardAng) * shardR * 0.78;
      var len = 4 + hash01(shardSeed + 2) * 12;
      ctx.strokeStyle = rgbaHex(palette.trim, 0.12 + intensity * 0.10);
      ctx.lineWidth = 1.0 + hash01(shardSeed + 3);
      ctx.beginPath();
      ctx.moveTo(sx - Math.cos(shardAng) * len * 0.4, sy - Math.sin(shardAng) * len * 0.4);
      ctx.lineTo(sx + Math.cos(shardAng) * len, sy + Math.sin(shardAng) * len);
      ctx.stroke();
    }

    for (var t = 0; t < tendrilCount; t++) {
      var ship = ships[t % 4];
      var rootAng = (t / Math.max(1, tendrilCount)) * TAU + cycleSec * 0.14;
      var rootX = zoneX + Math.cos(rootAng) * radius * (0.26 + (t % 3) * 0.08);
      var rootY = zoneY + Math.sin(rootAng) * radius * (0.20 + (t % 2) * 0.10);
      var bendX = lerp(rootX, ship.x, 0.46) + Math.sin(state.time * 1.6 + t) * 18;
      var bendY = lerp(rootY, ship.y, 0.46) - Math.cos(state.time * 1.6 + t) * 18;
      ctx.strokeStyle = rgbaHex(palette.trim, 0.08 + intensity * 0.12);
      ctx.lineWidth = 1.1 + (t % 2) * 0.6;
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.quadraticCurveTo(bendX, bendY, ship.x, ship.y);
      ctx.stroke();
    }

    for (var i = 0; i < ships.length; i++) {
      var target = ships[i];
      var insideIntensity = target.inside ? intensity : 0.22;
      if (!target.inside) {
        drawShipTrail(target.x, target.y, target.angle, target.size * 2.8, palette.line, 0.14 + cloudPulse * 0.06, 1.8);
        drawShipSprite(target.x, target.y, target.angle, target.size, target.cls, target.owner, 0.80);
        continue;
      }

      drawShipTrail(target.x, target.y, target.angle, target.size * 1.8, palette.core, 0.04, 1.2);
      drawShipSprite(target.x, target.y, target.angle, target.size, target.cls, target.owner, 0.92);
      drawNanoShipCorrosion(target.x, target.y, target.size, insideIntensity, palette, variant, i * 47 + 13);
      drawRing(target.x, target.y, target.size * 2.1, palette.trim, 0.10 + insideIntensity * 0.08, 1.1);
      drawTelemetryBrackets(target.x, target.y, target.size * 1.84, palette, 0.06 + insideIntensity * 0.08, 1.0);
      drawSuppressionMarks(target.x, target.y, target.size, palette, variant.suppression * insideIntensity * 0.72, i * 0.7);
      ctx.strokeStyle = rgbaHex(palette.trim, 0.10 + insideIntensity * 0.10);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(target.x + target.size * 0.3, target.y);
      ctx.lineTo(target.x + target.size * 2.0, target.y + Math.sin(state.time * 2 + i) * 8);
      ctx.stroke();
    }
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
    texts.title.textContent = "Ability Nano Swarm Prototype 01 - " + variant.name;
    texts.subtitle.textContent = variant.note;
    texts.status.textContent = "nanoSwarm / " + variant.name + ": 10s corrosive zone, 160 radius, DoT pressure and visible attack suppression.";
    texts.gameplay.textContent = "Текущая игровая способность `nanoSwarm` - точечная зона `160` радиуса на `10с`, где враги получают постепенный урон и `-25%` к атаке.";
    texts.read.textContent = variant.read;
    texts.focus.textContent = variant.focus;
  }

  function render() {
    var width = canvas.clientWidth || 1;
    var height = canvas.clientHeight || 1;
    var palette = getPalette();
    var variant = getVariant();
    var lodKey = getLodKey();
    drawNanoSwarm(width, height, palette, variant, lodKey);
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
    state.shipSeed += 101;
  });

  controls.triggerPulse.addEventListener("click", function () {
    state.pulseOrigin = state.time;
  });

  controls.variant.addEventListener("change", updateTexts);
  controls.palette.addEventListener("change", updateTexts);
  controls.lodMode.addEventListener("change", updateTexts);
  controls.tempo.addEventListener("input", updateTexts);
  controls.radius.addEventListener("input", updateTexts);
  controls.toxicity.addEventListener("input", updateTexts);

  window.addEventListener("resize", resize);
  resize();
  updateTexts();
  requestAnimationFrame(tick);
})();
