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
    length: document.getElementById("length"),
    retargetCenter: document.getElementById("retargetCenter"),
    retargetAngle: document.getElementById("retargetAngle"),
    cycleVariant: document.getElementById("cycleVariant"),
    triggerCollapse: document.getElementById("triggerCollapse")
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
    violet:  { core: "#caa0ff", trim: "#f2e5ff", line: "#b77bff", dark: "#10081a", glow: "202,160,255", haze: "110,58,176" },
    cyan:    { core: "#80deff", trim: "#eafcff", line: "#5bcaff", dark: "#07111a", glow: "128,222,255", haze: "35,128,186" },
    crimson: { core: "#ff9ab6", trim: "#ffe7ef", line: "#ff6d95", dark: "#170911", glow: "255,154,182", haze: "166,34,84" },
    amber:   { core: "#ffc97c", trim: "#fff2d7", line: "#ffb44f", dark: "#171004", glow: "255,201,124", haze: "179,110,25" },
    emerald: { core: "#86e7b2", trim: "#e6fff1", line: "#60d39a", dark: "#08150f", glow: "134,231,178", haze: "38,145,98" }
  };

  var VARIANTS = [
    {
      key: "veil-scar",
      name: "Veil Scar",
      note: "Базовая рана пространства: длинный фиолетовый шрам с мягким halo, чужими звездами внутри и spark-fade на концах.",
      read: "Самая чистая версия family direction: parallel slice, mystery и hostile calm.",
      focus: "Смотрим общий язык раны пространства, свечения кромки и ясный fold-in collapse.",
      profile: [0, -0.34, -0.18, -0.02, 0.12, 0.24, 0.10, 0],
      widthMul: 0.94,
      tendrils: 7,
      debris: 15,
      innerStars: 28,
      haloMul: 1.00,
      sparkMul: 1.00
    },
    {
      key: "shiver-scar",
      name: "Shiver Scar",
      note: "Нервная и злая версия: сильнее ломается, дрожит по кромке и обрастает пространственными волокнами.",
      read: "Лучше продает instability и ощущение, что разлом с трудом держится открытым.",
      focus: "Фокус на агрессивном силуэте, множестве tendrils и более рваном поведении свечения.",
      profile: [0, -0.42, -0.30, -0.10, 0.08, 0.26, 0.18, 0.04, 0],
      widthMul: 1.00,
      tendrils: 11,
      debris: 18,
      innerStars: 22,
      haloMul: 1.10,
      sparkMul: 1.18
    },
    {
      key: "abyss-thread",
      name: "Abyss Thread",
      note: "Более тонкая и глубокая рана, где внутри особенно хорошо читается другой звездный слой.",
      read: "Самый мистический вариант семьи: меньше грубой ярости, больше impossible depth.",
      focus: "Фокус на внутреннем чужом слое и ощущении, что внутри шрама лежит другой космос.",
      profile: [0, -0.28, -0.12, 0.00, 0.10, 0.22, 0.08, 0],
      widthMul: 0.86,
      tendrils: 6,
      debris: 13,
      innerStars: 38,
      haloMul: 0.94,
      sparkMul: 0.92
    },
    {
      key: "fold-wound",
      name: "Fold Wound",
      note: "Рана слоистого мира: кажется, что пласты пространства сложились внутрь и надорвались друг о друга.",
      read: "Лучше всего продает именно схлопывание как fold-in, а не flash-взрыв.",
      focus: "Фокус на тяжести складок, ширине шрама и вязком ощущении torn reality.",
      profile: [0, -0.40, -0.28, -0.14, 0.02, 0.20, 0.22, 0.08, 0],
      widthMul: 1.14,
      tendrils: 9,
      debris: 17,
      innerStars: 24,
      haloMul: 1.06,
      sparkMul: 0.96
    },
    {
      key: "night-shear",
      name: "Night Shear",
      note: "Самая злая версия семьи: ярче кромка, тяжелее засасывание мусора и темнее разрыв в центре.",
      read: "Подходит, если хочется больше мяса и угрозы, но без ухода в техно-HUD.",
      focus: "Фокус на hostile edge-light, straight-pull debris и ощущении злобного космического шрама.",
      profile: [0, -0.24, -0.10, -0.02, 0.08, 0.18, 0.06, 0],
      widthMul: 1.02,
      tendrils: 8,
      debris: 22,
      innerStars: 20,
      haloMul: 1.18,
      sparkMul: 1.22
    },
    {
      key: "parallax-gash",
      name: "Parallax Gash",
      note: "Самый зрелищный вариант: сильный излом, много пространственной ткани, заметный parallel slice и яркие искрящиеся концы.",
      read: "Это кульминация всей линии: spectacle first, но все еще в рамках одной и той же fantasy.",
      focus: "Фокус на wow-эффекте, сильном свечении, параллельном слое и богатом debris inflow.",
      profile: [0, -0.38, -0.22, -0.08, 0.04, 0.18, 0.20, 0.06, 0],
      widthMul: 1.08,
      tendrils: 13,
      debris: 24,
      innerStars: 34,
      haloMul: 1.28,
      sparkMul: 1.32
    }
  ];

  var SHIP_SPECS = [
    { id: 1, role: "cross", speed: 0.071, lane: -0.30, phase: 0.06, size: 1.00, owner: 0 },
    { id: 2, role: "cross", speed: 0.061, lane: 0.18, phase: 0.31, size: 0.94, owner: 1 },
    { id: 3, role: "cross", speed: 0.075, lane: -0.02, phase: 0.57, size: 1.10, owner: 0 },
    { id: 4, role: "cross", speed: 0.054, lane: 0.44, phase: 0.79, size: 1.08, owner: 1 },
    { id: 5, role: "orbit", speed: 0.185, lane: 0.0, phase: 0.10, size: 0.84, owner: 0 },
    { id: 6, role: "orbit", speed: 0.162, lane: 0.0, phase: 0.58, size: 0.80, owner: 1 },
    { id: 7, role: "skirmish", speed: 0.089, lane: -0.58, phase: 0.18, size: 0.92, owner: 0 },
    { id: 8, role: "skirmish", speed: 0.084, lane: 0.62, phase: 0.68, size: 0.96, owner: 1 },
    { id: 9, role: "crossLate", speed: 0.048, lane: 0.06, phase: 0.43, size: 1.16, owner: 0 },
    { id: 10, role: "crossLate", speed: 0.046, lane: -0.16, phase: 0.91, size: 1.04, owner: 1 }
  ];

  var state = {
    time: 0,
    variantIndex: 0,
    targetPhase: "point",
    pointerX: 0,
    pointerY: 0,
    targetNormX: 0.52,
    targetNormY: 0.50,
    targetX: 0,
    targetY: 0,
    angle: -0.24,
    cycleStart: 0,
    stars: []
  };

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(a, b, v) {
    var t = clamp01((v - a) / Math.max(0.0001, b - a));
    return t * t * (3 - 2 * t);
  }

  function pingPong(v) {
    var t = ((v % 1) + 1) % 1;
    return t < 0.5 ? t * 2 : (1 - (t - 0.5) * 2);
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

  function getPalette() {
    return PALETTES[controls.palette.value] || PALETTES.violet;
  }

  function getVariant() {
    return VARIANTS[state.variantIndex] || VARIANTS[0];
  }

  function getTempo() {
    return Number(controls.tempo.value) / 100;
  }

  function getRadiusFactor() {
    return Number(controls.radius.value) / 100;
  }

  function getLengthFactor() {
    return Number(controls.length.value) / 100;
  }

  function getLodKey() {
    if (controls.lodMode.value !== "auto") return controls.lodMode.value;
    var density = getRadiusFactor() * 0.50 + getLengthFactor() * 0.50;
    if (density > 0.78 || getTempo() > 1.08) return "far";
    if (density > 0.56 || getTempo() > 0.86) return "mid";
    return "near";
  }

  function getLodSpec() {
    var key = getLodKey();
    if (key === "far") return { tendrils: 0.60, debris: 0.60, inner: 0.60, sparks: 0.55 };
    if (key === "mid") return { tendrils: 0.82, debris: 0.82, inner: 0.80, sparks: 0.80 };
    return { tendrils: 1.00, debris: 1.00, inner: 1.00, sparks: 1.00 };
  }

  function updateTargetFromNorm() {
    var width = Math.max(1, canvas.clientWidth || 1);
    var height = Math.max(1, canvas.clientHeight || 1);
    state.targetX = width * state.targetNormX;
    state.targetY = height * state.targetNormY;
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
        depth: 0.18 + Math.random() * 0.82,
        phase: Math.random() * TAU
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
    updateTargetFromNorm();
    state.pointerX = width * 0.72;
    state.pointerY = height * 0.42;
  }

  function populateVariantSelect() {
    for (var i = 0; i < VARIANTS.length; i++) {
      var option = document.createElement("option");
      option.value = String(i);
      option.textContent = VARIANTS[i].name;
      controls.variant.appendChild(option);
    }
    controls.variant.value = String(state.variantIndex);
  }

  function restartCycle() {
    state.cycleStart = state.time;
  }

  function triggerCollapseNow() {
    state.cycleStart = state.time - 4.9 / Math.max(0.1, getTempo());
  }

  function getGeom() {
    var width = Math.max(1, canvas.clientWidth || 1);
    var height = Math.max(1, canvas.clientHeight || 1);
    return {
      width: width,
      height: height,
      centerX: state.targetX || width * 0.52,
      centerY: state.targetY || height * 0.50,
      angle: state.angle,
      radius: lerp(92, Math.min(width, height) * 0.28, getRadiusFactor()),
      length: lerp(width * 0.30, width * 0.72, getLengthFactor())
    };
  }

  function getTimeline() {
    var local = (state.time - state.cycleStart) * getTempo();
    var loop = ((local % 7.8) + 7.8) % 7.8;
    var openSparkT = clamp01((loop - 0.00) / 0.95);
    var openSparkK = 1 - smoothstep(0.92, 1.16, loop);
    var openRevealT = clamp01((loop - 0.98) / 1.18);
    var openK = smoothstep(0.98, 2.06, loop);
    var activeK = openK * (1 - smoothstep(5.65, 6.45, loop));
    var pulseK = smoothstep(4.85, 5.45, loop) * (1 - smoothstep(5.75, 6.20, loop));
    var closeSparkT = clamp01((loop - 5.55) / 0.92);
    var closeSparkK = smoothstep(5.42, 5.66, loop) * (1 - smoothstep(6.42, 6.70, loop));
    var foldK = smoothstep(5.95, 6.28, loop) * (1 - smoothstep(6.95, 7.40, loop));
    var flashK = smoothstep(6.05, 6.28, loop) * (1 - smoothstep(6.28, 6.70, loop));
    return {
      loop: loop,
      openSparkT: openSparkT,
      openSparkK: openSparkK,
      openRevealT: openRevealT,
      openK: openK,
      activeK: activeK,
      pulseK: pulseK,
      closeSparkT: closeSparkT,
      closeSparkK: closeSparkK,
      foldK: foldK,
      flashK: flashK
    };
  }

  function updateTexts() {
    var variant = getVariant();
    var geom = getGeom();
    var phaseText = state.targetPhase === "point"
      ? "Stage 1: click to place the collapse center."
      : state.targetPhase === "angle"
        ? "Stage 2: move the mouse and click to lock the wound angle."
        : "Target locked. Retarget center or angle at any time.";

    texts.title.textContent = "Ability Rift Prototype 01 - " + variant.name;
    texts.subtitle.textContent = variant.note;
    texts.gameplay.textContent = "Сначала выбирается точка-центр с радиусом " + Math.round(geom.radius) + "px, потом угол длинного шрама длиной " + Math.round(geom.length) + "px. Любой юнит, пересекающий тело раны, получает 5 + 50% max HP, а при fold-in схлопывании все внутри центра исчезают.";
    texts.read.textContent = variant.read;
    texts.focus.textContent = variant.focus;
    texts.status.textContent = phaseText + " Radius " + Math.round(geom.radius) + " / Length " + Math.round(geom.length) + " / LOD " + getLodKey().toUpperCase() + ". Demo hitbox follows the visible wound body.";
  }

  function drawBackdrop(width, height, palette) {
    var bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "rgba(4,7,14,1)");
    bg.addColorStop(0.58, "rgba(5,8,18,1)");
    bg.addColorStop(1, "rgba(2,3,8,1)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    var haze = ctx.createRadialGradient(width * 0.52, height * 0.46, height * 0.08, width * 0.52, height * 0.46, height * 0.78);
    haze.addColorStop(0, rgba(palette.haze, 0.12));
    haze.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);

    for (var i = 0; i < state.stars.length; i++) {
      var star = state.stars[i];
      var sx = star.x * width + Math.sin(state.time * (0.08 + star.depth * 0.18) + star.phase) * star.depth * 10;
      var sy = star.y * height + Math.cos(state.time * (0.06 + star.depth * 0.14) + star.phase) * star.depth * 7;
      var pulse = 0.56 + 0.44 * Math.sin(state.time * (0.7 + star.depth) + star.phase);
      ctx.beginPath();
      ctx.fillStyle = "rgba(228,236,255," + (star.alpha * pulse) + ")";
      ctx.arc(sx, sy, star.r, 0, TAU);
      ctx.fill();
    }
  }

  function drawGrid(width, height, palette, geom) {
    var step = Math.max(38, Math.round(Math.min(width, height) / 13));
    ctx.strokeStyle = rgba(palette.glow, 0.08);
    ctx.lineWidth = 1;
    for (var x = 0; x <= width + step; x += step) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
    }
    for (var y = 0; y <= height + step; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }

  }

  function traceLine(points) {
    if (!points.length) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  }

  function tracePolygon(points) {
    if (!points.length) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
  }

  function buildCenterline(geom, variant) {
    var points = [];
    var dirX = Math.cos(geom.angle);
    var dirY = Math.sin(geom.angle);
    var nx = -dirY;
    var ny = dirX;
    var profile = variant.profile || [0, -0.34, -0.18, -0.02, 0.12, 0.24, 0.10, 0];
    for (var i = 0; i < profile.length; i++) {
      var t = profile.length <= 1 ? 0 : i / (profile.length - 1);
      var along = (t - 0.5) * geom.length;
      var side = geom.radius * profile[i] * 0.76;
      points.push({
        x: geom.centerX + dirX * along + nx * side,
        y: geom.centerY + dirY * along + ny * side,
        t: t
      });
    }
    return points;
  }

  function sampleLine(points, subdivisions) {
    var out = [];
    if (points.length === 0) return out;
    var segs = Math.max(1, points.length - 1);
    for (var i = 0; i < segs; i++) {
      var a = points[i];
      var b = points[i + 1];
      for (var s = 0; s < subdivisions; s++) {
        var localT = s / subdivisions;
        out.push({
          x: lerp(a.x, b.x, localT),
          y: lerp(a.y, b.y, localT),
          t: (i + localT) / segs
        });
      }
    }
    out.push({
      x: points[points.length - 1].x,
      y: points[points.length - 1].y,
      t: 1
    });
    return out;
  }

  function getLinePoint(points, t) {
    if (points.length === 0) return { x: 0, y: 0 };
    if (points.length === 1) return points[0];
    var scaled = clamp01(t) * (points.length - 1);
    var idx = Math.min(points.length - 2, Math.floor(scaled));
    var localT = scaled - idx;
    return {
      x: lerp(points[idx].x, points[idx + 1].x, localT),
      y: lerp(points[idx].y, points[idx + 1].y, localT),
      t: clamp01(t)
    };
  }

  function getLineTangent(points, t) {
    var a = getLinePoint(points, Math.max(0, t - 0.02));
    var b = getLinePoint(points, Math.min(1, t + 0.02));
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  function getEndFade(t) {
    return smoothstep(0.03, 0.18, t) * (1 - smoothstep(0.82, 0.97, t));
  }

  function getVisibleHalfWidth(t, geom, variant, timeline) {
    var base = geom.radius * 0.050 * variant.widthMul;
    var taper = Math.pow(Math.sin(Math.PI * clamp01(t)), 0.92);
    var midBulge = 0.86 + 0.18 * Math.sin(Math.PI * t);
    var scarNoise = 0.94 + 0.14 * Math.sin(t * Math.PI * 6 + variant.widthMul * 3.7);
    return Math.max(2.2, base * (0.20 + 0.80 * taper) * midBulge * scarNoise * (0.90 + timeline.openK * 0.14));
  }

  function buildWoundGeometry(geom, variant, timeline) {
    var centerline = sampleLine(buildCenterline(geom, variant), 10);
    var left = [];
    var right = [];
    var halfWidths = [];
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;

    for (var i = 0; i < centerline.length; i++) {
      var p = centerline[i];
      var tan;
      if (i === 0) tan = { x: centerline[1].x - p.x, y: centerline[1].y - p.y };
      else if (i === centerline.length - 1) tan = { x: p.x - centerline[i - 1].x, y: p.y - centerline[i - 1].y };
      else tan = { x: centerline[i + 1].x - centerline[i - 1].x, y: centerline[i + 1].y - centerline[i - 1].y };

      var len = Math.hypot(tan.x, tan.y) || 1;
      var tx = tan.x / len;
      var ty = tan.y / len;
      var nx = -ty;
      var ny = tx;
      var half = getVisibleHalfWidth(p.t, geom, variant, timeline);
      halfWidths.push(half);

      var lx = p.x + nx * half;
      var ly = p.y + ny * half;
      var rx = p.x - nx * half;
      var ry = p.y - ny * half;
      left.push({ x: lx, y: ly, t: p.t });
      right.push({ x: rx, y: ry, t: p.t });

      minX = Math.min(minX, lx, rx);
      minY = Math.min(minY, ly, ry);
      maxX = Math.max(maxX, lx, rx);
      maxY = Math.max(maxY, ly, ry);
    }

    return {
      centerline: centerline,
      left: left,
      right: right,
      polygon: left.concat(right.slice().reverse()),
      halfWidths: halfWidths,
      bounds: { minX: minX, minY: minY, maxX: maxX, maxY: maxY }
    };
  }

  function getClosestRibbonInfo(px, py, wound) {
    var bestDist = Infinity;
    var bestT = 0;
    var bestHalf = wound.halfWidths[0] || 1;
    var points = wound.centerline;
    var segCount = Math.max(1, points.length - 1);

    for (var i = 0; i < points.length - 1; i++) {
      var a = points[i];
      var b = points[i + 1];
      var vx = b.x - a.x;
      var vy = b.y - a.y;
      var len2 = vx * vx + vy * vy;
      var localT = len2 <= 0.0001 ? 0 : ((px - a.x) * vx + (py - a.y) * vy) / len2;
      localT = clamp01(localT);
      var qx = a.x + vx * localT;
      var qy = a.y + vy * localT;
      var dx = px - qx;
      var dy = py - qy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestT = (i + localT) / segCount;
        bestHalf = lerp(wound.halfWidths[i], wound.halfWidths[i + 1], localT);
      }
    }

    return { dist: bestDist, t: bestT, half: bestHalf };
  }

  function drawGlowDisc(x, y, radius, rgb, alpha) {
    var grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, rgba(rgb, alpha));
    grad.addColorStop(0.45, rgba(rgb, alpha * 0.35));
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }

  function strokeLineFaded(points, lineWidth, color, alpha, isHex) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = lineWidth;
    for (var i = 0; i < points.length - 1; i++) {
      var fade = getEndFade((points[i].t + points[i + 1].t) * 0.5);
      if (fade <= 0.002) continue;
      ctx.beginPath();
      ctx.strokeStyle = isHex ? rgbaHex(color, alpha * fade) : rgba(color, alpha * fade);
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i + 1].x, points[i + 1].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function getRiftSegmentAlpha(t, timeline) {
    var revealThreshold = 1 - timeline.openRevealT;
    var reveal = smoothstep(revealThreshold - 0.12, revealThreshold + 0.02, t);
    if (timeline.openK >= 0.999) reveal = 1;
    var collapse = timeline.closeSparkK > 0.001
      ? smoothstep(timeline.closeSparkT - 0.10, timeline.closeSparkT + 0.03, t)
      : 1;
    return clamp01(reveal * collapse * timeline.activeK);
  }

  function strokeLineAnimated(points, lineWidth, color, alpha, isHex, timeline) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = lineWidth;
    for (var i = 0; i < points.length - 1; i++) {
      var t = (points[i].t + points[i + 1].t) * 0.5;
      var fade = getEndFade(t);
      var life = getRiftSegmentAlpha(t, timeline);
      if (fade * life <= 0.002) continue;
      ctx.beginPath();
      ctx.strokeStyle = isHex ? rgbaHex(color, alpha * fade * life) : rgba(color, alpha * fade * life);
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i + 1].x, points[i + 1].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTargetingOverlay(geom, wound, palette, timeline) {
    ctx.save();
    ctx.setLineDash([12, 10]);
    traceLine(wound.centerline);
    ctx.strokeStyle = rgbaHex(palette.line, 0.10 + timeline.openSparkK * 0.18 + timeline.activeK * 0.05);
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
  }

  function drawParallelInterior(wound, palette, variant, timeline) {
    var b = wound.bounds;
    var bodyAlpha = Math.max(0, timeline.activeK * (0.70 + timeline.pulseK * 0.45));

    ctx.save();
    tracePolygon(wound.polygon);
    ctx.clip();

    var g = ctx.createLinearGradient(b.minX, b.minY, b.maxX, b.maxY);
    g.addColorStop(0, "rgba(6,8,16," + (0.86 * bodyAlpha) + ")");
    g.addColorStop(0.30, rgba(palette.haze, 0.18 * bodyAlpha));
    g.addColorStop(0.50, "rgba(10,12,26," + (0.96 * bodyAlpha) + ")");
    g.addColorStop(0.72, rgba(palette.haze, 0.16 * bodyAlpha));
    g.addColorStop(1, "rgba(6,8,16," + (0.86 * bodyAlpha) + ")");
    ctx.fillStyle = g;
    ctx.fillRect(b.minX - 24, b.minY - 24, (b.maxX - b.minX) + 48, (b.maxY - b.minY) + 48);

    var cloudCount = 5;
    for (var i = 0; i < cloudCount; i++) {
      var cx = lerp(b.minX, b.maxX, noise(i * 7.3 + variant.widthMul * 11));
      var cy = lerp(b.minY, b.maxY, noise(i * 5.1 + 14.2));
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

    var lod = getLodSpec();
    var starCount = Math.max(18, Math.round(variant.innerStars * lod.inner));
    for (var s = 0; s < starCount; s++) {
      var seed = s * 8.37 + variant.widthMul * 19;
      var x = lerp(b.minX, b.maxX, noise(seed + 0.6));
      var y = lerp(b.minY, b.maxY, noise(seed + 2.1));
      var dx = Math.sin(state.time * (0.18 + noise(seed + 3.2) * 0.22) + seed) * 4;
      var dy = Math.cos(state.time * (0.16 + noise(seed + 4.8) * 0.20) + seed) * 3;
      var r = 0.6 + noise(seed + 5.5) * 1.5;
      var alpha = 0.12 + noise(seed + 6.9) * 0.26;
      ctx.beginPath();
        ctx.fillStyle = "rgba(228,238,255," + (alpha * bodyAlpha) + ")";
      ctx.arc(x + dx, y + dy, r, 0, TAU);
      ctx.fill();
    }

    for (var j = 0; j < 5; j++) {
      var seed2 = j * 11.4 + variant.tendrils;
      var x0 = lerp(b.minX, b.maxX, noise(seed2 + 1.0));
      var y0 = lerp(b.minY, b.maxY, noise(seed2 + 2.4));
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

  function drawWoundEdges(wound, palette, variant, timeline) {
    var pulse = 1 + timeline.pulseK * 0.55 + timeline.flashK * 0.30;
    var haloAlpha = 0.12 + timeline.activeK * 0.12 + timeline.pulseK * 0.10;
    var coreAlpha = 0.18 + timeline.activeK * 0.10 + timeline.pulseK * 0.08;
    var edgeAlpha = 0.72 + timeline.activeK * 0.14 + timeline.pulseK * 0.14;

    strokeLineAnimated(wound.centerline, 34 * variant.haloMul * pulse, palette.glow, haloAlpha, false, timeline);
    strokeLineAnimated(wound.centerline, 22 * variant.haloMul * pulse, palette.line, 0.10 + timeline.activeK * 0.08 + timeline.pulseK * 0.08, true, timeline);
    strokeLineAnimated(wound.left, 3.0, palette.trim, edgeAlpha, true, timeline);
    strokeLineAnimated(wound.right, 3.0, palette.trim, edgeAlpha, true, timeline);
    strokeLineAnimated(wound.left, 1.2, palette.line, 0.46 + timeline.activeK * 0.10 + timeline.pulseK * 0.08, true, timeline);
    strokeLineAnimated(wound.right, 1.2, palette.line, 0.46 + timeline.activeK * 0.10 + timeline.pulseK * 0.08, true, timeline);
    strokeLineAnimated(wound.centerline, 10 * variant.widthMul, "0,0,0", 0.84 + timeline.activeK * 0.06, false, timeline);
    strokeLineAnimated(wound.centerline, 2.0, palette.core, coreAlpha, true, timeline);
  }

  function drawSpaceFabricTendrils(wound, palette, variant, timeline) {
    var lod = getLodSpec();
    var count = Math.max(4, Math.round(variant.tendrils * lod.tendrils));
    for (var i = 0; i < count; i++) {
      var frac = 0.08 + (i / Math.max(1, count - 1)) * 0.84 + (noise(i * 2.1 + variant.widthMul) - 0.5) * 0.03;
      frac = clamp01(frac);
      var p = getLinePoint(wound.centerline, frac);
      var tangent = getLineTangent(wound.centerline, frac);
      var nx = -tangent.y;
      var ny = tangent.x;
      var side = i % 2 === 0 ? 1 : -1;
      var fade = getEndFade(frac);
      var startDist = 24 + noise(i * 5.7 + 1.3) * 42;
      var curl = 18 + noise(i * 7.1 + 2.8) * 34;
      var startX = p.x + nx * startDist * side + tangent.x * curl * 0.20;
      var startY = p.y + ny * startDist * side + tangent.y * curl * 0.20;
      var cp1X = p.x + nx * startDist * side * 0.76 + tangent.x * curl;
      var cp1Y = p.y + ny * startDist * side * 0.76 + tangent.y * curl;
      var cp2X = p.x + nx * 7 * side - tangent.x * 12;
      var cp2Y = p.y + ny * 7 * side - tangent.y * 12;
      ctx.beginPath();
      ctx.strokeStyle = rgbaHex(palette.line, fade * getRiftSegmentAlpha(frac, timeline) * (0.08 + timeline.activeK * 0.12 + timeline.pulseK * 0.08));
      ctx.lineWidth = 1.0 + noise(i * 6.1) * 1.4;
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, p.x, p.y);
      ctx.stroke();
    }
  }

  function drawDebrisInflow(wound, palette, variant, timeline) {
    var lod = getLodSpec();
    var count = Math.max(12, Math.round(variant.debris * lod.debris));
    for (var i = 0; i < count; i++) {
      var seed = i * 9.71 + variant.widthMul * 15;
      var frac = (noise(seed + 1.3) + state.time * (0.06 + noise(seed + 4.2) * 0.06)) % 1;
      var pull = ((state.time * (0.28 + noise(seed + 5.8) * 0.18)) + noise(seed + 7.1)) % 1;
      var anchor = getLinePoint(wound.centerline, frac);
      var tangent = getLineTangent(wound.centerline, frac);
      var nx = -tangent.y;
      var ny = tangent.x;
      var side = noise(seed + 8.2) > 0.5 ? 1 : -1;
      var outerDist = 34 + noise(seed + 9.8) * 92;
      var innerDist = 4 + noise(seed + 10.4) * 10;
      var eased = smoothstep(0, 1, pull);
      var curDist = lerp(outerDist, innerDist, eased);
      var prevDist = lerp(outerDist, innerDist, Math.max(0, eased - 0.12));
      var drift = (noise(seed + 12.2) - 0.5) * 16;
      var px = anchor.x + nx * curDist * side + tangent.x * drift;
      var py = anchor.y + ny * curDist * side + tangent.y * drift;
      var prevX = anchor.x + nx * prevDist * side + tangent.x * drift * 0.82;
      var prevY = anchor.y + ny * prevDist * side + tangent.y * drift * 0.82;
      var alpha = getEndFade(frac) * getRiftSegmentAlpha(frac, timeline) * (0.10 + (1 - pull) * 0.24);
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

  function drawRiftParticles(wound, palette, variant, timeline) {
    var lod = getLodSpec();
    var count = Math.max(5, Math.round((5 + variant.sparkMul * 4) * lod.sparks));
    for (var i = 0; i < count; i++) {
      var seed = i * 13.7 + variant.haloMul * 8.9;
      var frac = ((state.time * (0.10 + noise(seed) * 0.10)) + noise(seed + 1.2)) % 1;
      var p = getLinePoint(wound.centerline, frac);
      var tangent = getLineTangent(wound.centerline, frac);
      var nx = -tangent.y;
      var ny = tangent.x;
      var side = noise(seed + 2.3) > 0.5 ? 1 : -1;
      var dist = 8 + noise(seed + 4.9) * 14;
      var px = p.x + nx * dist * side;
      var py = p.y + ny * dist * side;
      var burstLen = 8 + noise(seed + 5.2) * 18 + timeline.flashK * 10;
      ctx.beginPath();
      ctx.strokeStyle = rgbaHex(palette.trim, getEndFade(frac) * getRiftSegmentAlpha(frac, timeline) * (0.18 + timeline.activeK * 0.28 + timeline.flashK * 0.18 + timeline.pulseK * 0.10));
      ctx.lineWidth = 1.3;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(px + nx * burstLen * 0.35 * side, py + ny * burstLen * 0.35 * side);
      ctx.stroke();
      drawGlowDisc(px, py, 8 + noise(seed + 7.1) * 10, palette.glow, 0.10 + timeline.activeK * 0.12);
    }
  }

  function drawEndSparks(wound, palette, variant, timeline) {
    var ends = [wound.centerline[0], wound.centerline[wound.centerline.length - 1]];
    var tangents = [
      getLineTangent(wound.centerline, 0.02),
      getLineTangent(wound.centerline, 0.98)
    ];
    for (var e = 0; e < ends.length; e++) {
      var pt = ends[e];
      var tan = tangents[e];
      var dir = e === 0 ? -1 : 1;
      drawGlowDisc(pt.x, pt.y, 18 * variant.sparkMul, palette.glow, 0.08 + timeline.activeK * 0.10 + timeline.pulseK * 0.10);
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

  function drawTravelSpark(wound, palette, t, alphaMul, sizeMul) {
    var p = getLinePoint(wound.centerline, t);
    var tangent = getLineTangent(wound.centerline, t);
    var ang = Math.atan2(tangent.y, tangent.x);
    drawGlowDisc(p.x, p.y, 20 * sizeMul, palette.glow, 0.14 * alphaMul);
    drawGlowDisc(p.x, p.y, 10 * sizeMul, palette.glow, 0.22 * alphaMul);
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

  function drawFormationPass(wound, palette, timeline) {
    if (timeline.openSparkK > 0.001) {
      strokeLineFaded(wound.centerline, 6.0, palette.line, 0.08 + timeline.openSparkK * 0.16, true);
      drawTravelSpark(wound, palette, timeline.openSparkT, 0.70 + timeline.openSparkK * 0.30, 1.0);
    }
    if (timeline.closeSparkK > 0.001) {
      strokeLineFaded(wound.centerline, 6.0, palette.line, 0.06 + timeline.closeSparkK * 0.14, true);
      drawTravelSpark(wound, palette, timeline.closeSparkT, 0.76 + timeline.closeSparkK * 0.34, 1.08);
    }
  }

  function drawCollapse(geom, palette, timeline) {
    if (timeline.foldK <= 0.01) return;
    drawGlowDisc(geom.centerX, geom.centerY, geom.radius * (0.78 + timeline.flashK * 0.32), palette.glow, 0.16 + timeline.flashK * 0.24);

    for (var i = 0; i < 14; i++) {
      var ang = i / 14 * TAU + state.time * 0.18;
      var outer = geom.radius * (0.90 + Math.sin(state.time * 0.8 + i) * 0.02);
      var inner = geom.radius * (0.10 + timeline.foldK * 0.38);
      ctx.beginPath();
      ctx.strokeStyle = rgbaHex(palette.line, 0.10 + timeline.flashK * 0.24);
      ctx.lineWidth = 1.0;
      ctx.moveTo(geom.centerX + Math.cos(ang) * outer, geom.centerY + Math.sin(ang) * outer);
      ctx.lineTo(geom.centerX + Math.cos(ang) * inner, geom.centerY + Math.sin(ang) * inner);
      ctx.stroke();
    }
  }

  function drawShip(x, y, angle, scale, palette, alpha, enemy) {
    var fill = enemy ? rgbaHex("#f7c2cb", alpha * 0.86) : rgbaHex("#d7ebff", alpha * 0.82);
    var edge = enemy ? rgbaHex("#ff6d90", alpha * 0.9) : rgbaHex(palette.core, alpha * 0.78);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(6.0 * scale, 6.0 * scale);
    ctx.beginPath();
    ctx.moveTo(2.9, 0);
    ctx.lineTo(1.1, -0.62);
    ctx.lineTo(0.12, -1.05);
    ctx.lineTo(-1.34, -0.48);
    ctx.lineTo(-1.65, 0);
    ctx.lineTo(-1.34, 0.48);
    ctx.lineTo(0.12, 1.05);
    ctx.lineTo(1.1, 0.62);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.20;
    ctx.stroke();
    ctx.restore();
  }

  function drawDamageMarker(ship, palette, hitK) {
    var size = 10 + hitK * 8;
    ctx.beginPath();
    ctx.strokeStyle = rgbaHex(palette.trim, 0.26 + hitK * 0.44);
    ctx.lineWidth = 1.3;
    ctx.arc(ship.x, ship.y, size, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ship.x - size * 0.9, ship.y - size * 0.9);
    ctx.lineTo(ship.x + size * 0.9, ship.y + size * 0.9);
    ctx.moveTo(ship.x + size * 0.9, ship.y - size * 0.9);
    ctx.lineTo(ship.x - size * 0.9, ship.y + size * 0.9);
    ctx.stroke();
    ctx.fillStyle = rgbaHex(palette.trim, 0.72 * hitK);
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("-5  -50% HP", ship.x, ship.y - size - 8);
  }

  function drawEraseMarker(ship, palette, eraseK) {
    drawGlowDisc(ship.x, ship.y, 24 + eraseK * 28, palette.glow, 0.18 + eraseK * 0.26);
    ctx.beginPath();
    ctx.strokeStyle = rgbaHex(palette.trim, 0.34 + eraseK * 0.56);
    ctx.lineWidth = 2;
    ctx.arc(ship.x, ship.y, 16 + eraseK * 14, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = rgbaHex(palette.trim, 0.82 * eraseK);
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ERASE", ship.x, ship.y - 24 - eraseK * 8);
  }

  function getShipPose(spec, geom) {
    var dirX = Math.cos(geom.angle);
    var dirY = Math.sin(geom.angle);
    var nx = -dirY;
    var ny = dirX;
    var t = state.time * spec.speed + spec.phase;

    if (spec.role === "orbit") {
      var ang = t * TAU * 0.72;
      var orbitR = geom.radius * (0.34 + 0.16 * (spec.id % 2));
      return {
        x: geom.centerX + Math.cos(ang) * orbitR * 1.05,
        y: geom.centerY + Math.sin(ang) * orbitR * 0.74,
        angle: ang + Math.PI * 0.5,
        scale: spec.size,
        owner: spec.owner
      };
    }

    if (spec.role === "skirmish") {
      var sk = ((t % 1) + 1) % 1;
      var alongA = Math.sin(sk * TAU) * geom.length * 0.34;
      var sideA = geom.radius * spec.lane + Math.cos(sk * TAU * 2.0) * geom.radius * 0.18;
      var pxA = geom.centerX + dirX * alongA + nx * sideA;
      var pyA = geom.centerY + dirY * alongA + ny * sideA;
      var nextAlongA = Math.sin((sk + 0.02) * TAU) * geom.length * 0.34;
      var nextSideA = geom.radius * spec.lane + Math.cos((sk + 0.02) * TAU * 2.0) * geom.radius * 0.18;
      var pxB = geom.centerX + dirX * nextAlongA + nx * nextSideA;
      var pyB = geom.centerY + dirY * nextAlongA + ny * nextSideA;
      return {
        x: pxA,
        y: pyA,
        angle: Math.atan2(pyB - pyA, pxB - pxA),
        scale: spec.size,
        owner: spec.owner
      };
    }

    var move = pingPong(t);
    var lateBias = spec.role === "crossLate" ? 0.14 : 0;
    var along = lerp(-geom.length * (0.68 + lateBias), geom.length * (0.68 + lateBias), move);
    var side = geom.radius * spec.lane + Math.sin(state.time * 0.82 + spec.id * 0.8) * geom.radius * 0.08;
    var x = geom.centerX + dirX * along + nx * side;
    var y = geom.centerY + dirY * along + ny * side;
    var nextMove = pingPong(t + 0.012);
    var nextAlong = lerp(-geom.length * (0.68 + lateBias), geom.length * (0.68 + lateBias), nextMove);
    var nextX = geom.centerX + dirX * nextAlong + nx * side;
    var nextY = geom.centerY + dirY * nextAlong + ny * side;
    return {
      x: x,
      y: y,
      angle: Math.atan2(nextY - y, nextX - x),
      scale: spec.size,
      owner: spec.owner
    };
  }

  function drawShips(geom, palette, wound, timeline) {
    for (var i = 0; i < SHIP_SPECS.length; i++) {
      var spec = SHIP_SPECS[i];
      var ship = getShipPose(spec, geom);
      var hitInfo = getClosestRibbonInfo(ship.x, ship.y, wound);
      var distToCenter = Math.hypot(ship.x - geom.centerX, ship.y - geom.centerY);
      var hitK = getRiftSegmentAlpha(hitInfo.t, timeline) * getEndFade(hitInfo.t) * smoothstep(hitInfo.half * 1.18, hitInfo.half * 0.76, hitInfo.dist);
      var eraseK = timeline.flashK * (distToCenter <= geom.radius ? 1 : 0);
      var alpha = eraseK > 0 ? Math.max(0.06, 1 - eraseK * 1.35) : 1;

      drawShip(ship.x, ship.y, ship.angle, ship.scale, palette, alpha, spec.owner === 1);
      if (hitK > 0.12) drawDamageMarker(ship, palette, hitK);
      if (eraseK > 0.08) drawEraseMarker(ship, palette, eraseK);
    }
  }

  function drawPhaseHint(geom, palette) {
    if (state.targetPhase !== "angle") return;
    var dx = state.pointerX - geom.centerX;
    var dy = state.pointerY - geom.centerY;
    var len = Math.hypot(dx, dy) || 1;
    var dirX = dx / len;
    var dirY = dy / len;
    ctx.save();
    ctx.setLineDash([12, 8]);
    ctx.strokeStyle = rgbaHex(palette.trim, 0.34);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(geom.centerX - dirX * geom.length * 0.52, geom.centerY - dirY * geom.length * 0.52);
    ctx.lineTo(geom.centerX + dirX * geom.length * 0.52, geom.centerY + dirY * geom.length * 0.52);
    ctx.stroke();
    ctx.restore();
  }

  function drawHudLabels(geom, palette, timeline) {
    ctx.save();
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = rgbaHex(palette.trim, 0.64);
    ctx.fillText(timeline.flashK > 0.01 ? "closing fold-in" : timeline.pulseK > 0.08 ? "wound pulsing" : timeline.activeK > 0.08 ? "wound armed" : "wound opening", 20, 28);
    ctx.restore();
  }

  function getPointerPos(ev) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top
    };
  }

  function setTargetCenter(x, y) {
    var width = Math.max(1, canvas.clientWidth || 1);
    var height = Math.max(1, canvas.clientHeight || 1);
    state.targetX = x;
    state.targetY = y;
    state.targetNormX = clamp01(x / width);
    state.targetNormY = clamp01(y / height);
  }

  function lockAngleToPoint(x, y) {
    state.angle = Math.atan2(y - state.targetY, x - state.targetX);
    state.targetPhase = "locked";
    restartCycle();
    updateTexts();
  }

  canvas.addEventListener("mousemove", function (ev) {
    var p = getPointerPos(ev);
    state.pointerX = p.x;
    state.pointerY = p.y;
    if (state.targetPhase === "angle") {
      state.angle = Math.atan2(p.y - state.targetY, p.x - state.targetX);
    }
  });

  canvas.addEventListener("click", function (ev) {
    var p = getPointerPos(ev);
    if (state.targetPhase === "point") {
      setTargetCenter(p.x, p.y);
      state.targetPhase = "angle";
      updateTexts();
      return;
    }
    lockAngleToPoint(p.x, p.y);
  });

  controls.variant.addEventListener("change", function () {
    state.variantIndex = Math.max(0, Math.min(VARIANTS.length - 1, Number(controls.variant.value) || 0));
    restartCycle();
    updateTexts();
  });

  controls.palette.addEventListener("change", updateTexts);
  controls.lodMode.addEventListener("change", updateTexts);
  controls.tempo.addEventListener("input", updateTexts);
  controls.radius.addEventListener("input", updateTexts);
  controls.length.addEventListener("input", updateTexts);

  controls.retargetCenter.addEventListener("click", function () {
    state.targetPhase = "point";
    updateTexts();
  });

  controls.retargetAngle.addEventListener("click", function () {
    state.targetPhase = "angle";
    updateTexts();
  });

  controls.cycleVariant.addEventListener("click", function () {
    state.variantIndex = (state.variantIndex + 1) % VARIANTS.length;
    controls.variant.value = String(state.variantIndex);
    restartCycle();
    updateTexts();
  });

  controls.triggerCollapse.addEventListener("click", function () {
    triggerCollapseNow();
  });

  function render() {
    var geom = getGeom();
    var palette = getPalette();
    var variant = getVariant();
    var timeline = getTimeline();
    var wound = buildWoundGeometry(geom, variant, timeline);

    drawBackdrop(geom.width, geom.height, palette);
    drawGrid(geom.width, geom.height, palette, geom);
    drawTargetingOverlay(geom, wound, palette, timeline);
    drawPhaseHint(geom, palette);
    drawFormationPass(wound, palette, timeline);
    drawSpaceFabricTendrils(wound, palette, variant, timeline);
    drawParallelInterior(wound, palette, variant, timeline);
    drawWoundEdges(wound, palette, variant, timeline);
    drawDebrisInflow(wound, palette, variant, timeline);
    drawRiftParticles(wound, palette, variant, timeline);
    drawEndSparks(wound, palette, variant, timeline);
    drawCollapse(geom, palette, timeline);
    drawShips(geom, palette, wound, timeline);
    drawHudLabels(geom, palette, timeline);
  }

  function frame(now) {
    if (!frame._last) frame._last = now;
    var dt = Math.min(0.033, Math.max(0.001, (now - frame._last) / 1000));
    frame._last = now;
    state.time += dt;
    render();
    requestAnimationFrame(frame);
  }

  populateVariantSelect();
  resize();
  restartCycle();
  updateTexts();
  window.addEventListener("resize", function () {
    resize();
    updateTexts();
  });
  requestAnimationFrame(frame);
})();
