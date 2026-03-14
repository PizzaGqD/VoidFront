(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var WORLD_W = 1280;
  var WORLD_H = 820;

  var canvas = document.getElementById("scene");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var controls = {
    variantSelect: document.getElementById("variantSelect"),
    lodMode: document.getElementById("lodMode"),
    radius: document.getElementById("radius"),
    distortion: document.getElementById("distortion"),
    coreGlow: document.getElementById("coreGlow"),
    outerHaze: document.getElementById("outerHaze"),
    fringe: document.getElementById("fringe"),
    filaments: document.getElementById("filaments"),
    dischargeRate: document.getElementById("dischargeRate"),
    randomizeSeed: document.getElementById("randomizeSeed"),
    randomizeShape: document.getElementById("randomizeShape"),
    calmPreset: document.getElementById("calmPreset"),
    stormPreset: document.getElementById("stormPreset")
  };

  var texts = {
    title: document.getElementById("variantTitle"),
    subtitle: document.getElementById("variantSubtitle"),
    status: document.getElementById("statusLine"),
    spawn: document.getElementById("legendSpawn"),
    visual: document.getElementById("legendVisual"),
    focus: document.getElementById("legendFocus")
  };

  var VARIANTS = [
    {
      key: "veil-mass",
      name: "01. Veil Mass",
      subtitle: "Тихая холодная туманность с мягкой массой, большим outer haze и спокойным живым fringe.",
      accent: "#8dc9ff",
      bgTop: "#050915",
      bgBottom: "#02050c",
      starRgb: "190,220,255",
      cloudRgbs: ["74,128,238", "104,116,255", "86,168,246"],
      edgeRgb: "216,236,255",
      sparkRgb: "170,218,255",
      outerMul: 1.08,
      innerMul: 0.96,
      edgeMul: 0.86,
      shapeMul: 0.90,
      visualText: "Тело живет за счет veil-слоев и мягких внутренних облаков, а не за счет яркого контура. Это ближе к настоящей космической дымке.",
      focusText: "Хороший baseline для продовой туманности, если нужен красивый, но тихий силуэт без лишнего шума."
    },
    {
      key: "storm-heart",
      name: "02. Storm Heart",
      subtitle: "Плотнее центр, ярче внутренняя турбулентность и сильнее электрическая жизнь внутри массы.",
      accent: "#9ea8ff",
      bgTop: "#040713",
      bgBottom: "#02040a",
      starRgb: "176,198,255",
      cloudRgbs: ["72,96,220", "124,92,255", "94,132,236"],
      edgeRgb: "222,228,255",
      sparkRgb: "198,214,255",
      outerMul: 0.98,
      innerMul: 1.08,
      edgeMul: 1.06,
      shapeMul: 1.08,
      visualText: "Центр гуще и активнее, края сильнее рвутся, а разряды ощущаются как часть массы, а не отдельный эффект поверх нее.",
      focusText: "Полезен, если хочется чуть более опасную и живую зону, но все еще сохранить форму как единое облако."
    },
    {
      key: "ion-anvil",
      name: "03. Ion Anvil",
      subtitle: "Широкая лобастая форма с тяжелым верхним объемом, глубокой синей массой и упругим электрическим fringe.",
      accent: "#7eb6ff",
      bgTop: "#050816",
      bgBottom: "#02040b",
      starRgb: "184,214,255",
      cloudRgbs: ["66,118,214", "92,146,255", "108,96,230"],
      edgeRgb: "210,232,255",
      sparkRgb: "182,226,255",
      outerMul: 1.02,
      innerMul: 1.02,
      edgeMul: 1.00,
      shapeMul: 1.14,
      visualText: "Форма чувствуется не круглой, а как тяжелая аномалия с нависающей массой и более выраженным асимметричным силуэтом.",
      focusText: "Лучший вариант, если хочется уйти от идеального круга и сделать туманность более характерной уже на дальнем плане."
    },
    {
      key: "rift-plasma",
      name: "04. Rift Plasma",
      subtitle: "Чуть более редкий и насыщенный вариант: фиолетово-янтарный разлом с плазменным сердцем.",
      accent: "#ffb087",
      bgTop: "#090714",
      bgBottom: "#03040a",
      starRgb: "255,214,188",
      cloudRgbs: ["140,78,224", "208,100,146", "255,124,92"],
      edgeRgb: "255,230,220",
      sparkRgb: "255,192,156",
      outerMul: 0.96,
      innerMul: 1.12,
      edgeMul: 1.10,
      shapeMul: 1.00,
      visualText: "Это уже скорее редкий special-biome, но он хорошо показывает верхнюю границу по насыщенности и плазменности без распада в круги.",
      focusText: "Полезен как stress-test палитры и как ориентир для редких особых туманностей."
    }
  ];

  var LODS = {
    near: { stars: 180, outlineSteps: 84, plumeCount: 16, ribbons: 10, fringePoints: 18 },
    mid: { stars: 120, outlineSteps: 56, plumeCount: 12, ribbons: 7, fringePoints: 12 },
    far: { stars: 72, outlineSteps: 34, plumeCount: 8, ribbons: 4, fringePoints: 8 }
  };

  var state = {
    seed: 120731,
    shapeSeed: 9911,
    time: 0,
    lastNow: 0,
    variantIndex: 0,
    stars: [],
    nebula: null,
    dragging: null,
    screenW: 0,
    screenH: 0,
    viewScale: 1,
    viewX: 0,
    viewY: 0
  };

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function mulberry32(seed) {
    return function () {
      var t = seed += 0x6d2b79f5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function rgba(rgb, a) {
    return "rgba(" + rgb + "," + a.toFixed(3) + ")";
  }

  function controlRatio(input, fallback) {
    return input ? Number(input.value || fallback) / 100 : fallback / 100;
  }

  function controlInt(input, fallback) {
    return input ? Math.round(Number(input.value || fallback)) : fallback;
  }

  function getVariant() {
    return VARIANTS[state.variantIndex] || VARIANTS[0];
  }

  function getLod() {
    var mode = controls.lodMode ? controls.lodMode.value : "auto";
    if (mode === "near" || mode === "mid" || mode === "far") return LODS[mode];
    if (state.viewScale > 0.82) return LODS.near;
    if (state.viewScale > 0.50) return LODS.mid;
    return LODS.far;
  }

  function resizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    state.screenW = Math.max(1, Math.round(rect.width * dpr));
    state.screenH = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = state.screenW;
    canvas.height = state.screenH;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var margin = 44 * dpr;
    state.viewScale = Math.min((state.screenW - margin * 2) / WORLD_W, (state.screenH - margin * 2) / WORLD_H);
    state.viewX = (state.screenW - WORLD_W * state.viewScale) * 0.5;
    state.viewY = (state.screenH - WORLD_H * state.viewScale) * 0.5;
  }

  function worldToScreen(x, y) {
    return {
      x: state.viewX + x * state.viewScale,
      y: state.viewY + y * state.viewScale
    };
  }

  function screenToWorld(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var sx = (clientX - rect.left) * dpr;
    var sy = (clientY - rect.top) * dpr;
    return {
      x: (sx - state.viewX) / state.viewScale,
      y: (sy - state.viewY) / state.viewScale
    };
  }

  function buildStars() {
    var variant = getVariant();
    var rng = mulberry32((state.seed ^ 0x9e3779b9) >>> 0);
    var lod = getLod();
    state.stars = [];
    for (var i = 0; i < lod.stars; i++) {
      state.stars.push({
        x: rng() * WORLD_W,
        y: rng() * WORLD_H,
        size: 0.7 + rng() * 2.4,
        alpha: 0.12 + rng() * 0.58,
        rgb: variant.starRgb,
        twinkle: rng() * TAU,
        drift: rng()
      });
    }
  }

  function buildNebula() {
    var variant = getVariant();
    var lod = getLod();
    var rng = mulberry32((state.seed ^ state.shapeSeed ^ (state.variantIndex + 1) * 1637) >>> 0);
    var prev = state.nebula;
    var radius = controlInt(controls.radius, 230);
    var nebula = {
      x: prev ? prev.x : WORLD_W * 0.5,
      y: prev ? prev.y : WORLD_H * 0.52,
      radius: radius,
      rgb: variant.cloudRgbs[Math.floor(rng() * variant.cloudRgbs.length)],
      seedA: rng() * TAU,
      seedB: rng() * TAU,
      seedC: rng() * TAU,
      seedD: rng() * TAU,
      driftA: rng() * TAU,
      driftB: rng() * TAU,
      plumes: [],
      knots: [],
      ribbons: [],
      discharges: []
    };

    for (var i = 0; i < lod.plumeCount; i++) {
      nebula.plumes.push({
        angle: rng() * TAU,
        dist: radius * (0.06 + Math.pow(rng(), 0.85) * 0.54),
        rx: radius * (0.24 + rng() * 0.50),
        ry: radius * (0.12 + rng() * 0.26),
        alpha: 0.035 + rng() * 0.055,
        phase: rng() * TAU,
        drift: 0.10 + rng() * 0.26,
        spin: (rng() - 0.5) * 0.12,
        squish: 0.45 + rng() * 0.45
      });
    }

    for (var k = 0; k < 6; k++) {
      nebula.knots.push({
        angle: rng() * TAU,
        dist: radius * (0.04 + rng() * 0.28),
        r: radius * (0.10 + rng() * 0.16),
        alpha: 0.05 + rng() * 0.08,
        phase: rng() * TAU,
        drift: 0.20 + rng() * 0.30
      });
    }

    for (var r = 0; r < 12; r++) {
      nebula.ribbons.push({
        angle: rng() * TAU,
        bend: (rng() - 0.5) * 0.9,
        radiusMul: 0.24 + rng() * 0.48,
        width: 0.30 + rng() * 0.45,
        alpha: 0.02 + rng() * 0.04,
        phase: rng() * TAU
      });
    }

    state.nebula = nebula;
    updateTexts();
  }

  function sampleRadius(nebula, angle) {
    var distortion = controlRatio(controls.distortion, 54);
    var variant = getVariant();
    var wobble =
      Math.sin(angle * 2.0 + nebula.seedA + state.time * 0.08) * 0.10 +
      Math.sin(angle * 3.6 + nebula.seedB - state.time * 0.05) * 0.07 +
      Math.sin(angle * 6.8 + nebula.seedC) * 0.04 +
      Math.sin(angle * 11.0 + nebula.seedD) * 0.02;
    var flatten = Math.cos(angle - nebula.driftA) * 0.05 * variant.shapeMul;
    return nebula.radius * (1 + (wobble * variant.shapeMul + flatten) * distortion);
  }

  function buildOutlinePoints(nebula) {
    var lod = getLod();
    var pts = [];
    for (var i = 0; i <= lod.outlineSteps; i++) {
      var a = (i / lod.outlineSteps) * TAU;
      var r = sampleRadius(nebula, a);
      pts.push({ x: nebula.x + Math.cos(a) * r, y: nebula.y + Math.sin(a) * r, angle: a, radius: r });
    }
    return pts;
  }

  function pathFromPoints(points) {
    if (!points || !points.length) return;
    var s0 = worldToScreen(points[0].x, points[0].y);
    ctx.beginPath();
    ctx.moveTo(s0.x, s0.y);
    for (var i = 1; i < points.length; i++) {
      var s = worldToScreen(points[i].x, points[i].y);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
  }

  function drawGradientEllipse(cx, cy, rx, ry, rgb, alpha, rotation) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation || 0);
    ctx.scale(1, ry / Math.max(1, rx));
    var grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    grad.addColorStop(0, rgba(rgb, alpha));
    grad.addColorStop(0.55, rgba(rgb, alpha * 0.48));
    grad.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function spawnDischarge(forced) {
    var nebula = state.nebula;
    if (!nebula) return;
    var variant = getVariant();
    var rng = mulberry32(((state.seed + state.shapeSeed + ((state.time * 1000) | 0)) ^ 0x6d2b79f5) >>> 0);
    var a = rng() * TAU;
    var dist = nebula.radius * (0.06 + rng() * 0.30);
    var x = nebula.x + Math.cos(a) * dist;
    var y = nebula.y + Math.sin(a) * dist;
    var segs = [];
    var ang = rng() * TAU;
    var totalLen = 0;
    var count = 3 + Math.floor(rng() * 4) + (forced ? 2 : 0);
    for (var i = 0; i < count; i++) {
      var len = 8 + rng() * 22;
      var nx = x + Math.cos(ang) * len;
      var ny = y + Math.sin(ang) * len;
      segs.push({ x1: x, y1: y, x2: nx, y2: ny });
      totalLen += Math.hypot(nx - x, ny - y);
      x = nx;
      y = ny;
      ang += (rng() - 0.5) * 1.45;
      if (Math.hypot(x - nebula.x, y - nebula.y) > nebula.radius * 0.70) break;
    }
    nebula.discharges.push({
      segs: segs,
      totalLen: totalLen,
      life: 0.18 + rng() * 0.18,
      maxLife: 0.18 + rng() * 0.18,
      rgb: variant.sparkRgb
    });
  }

  function stepNebula(dt) {
    if (!state.nebula) return;
    var rate = controlRatio(controls.dischargeRate, 40);
    if (Math.random() < dt * (0.55 + rate * 2.2)) spawnDischarge(false);
    for (var i = state.nebula.discharges.length - 1; i >= 0; i--) {
      state.nebula.discharges[i].life -= dt;
      if (state.nebula.discharges[i].life <= 0) state.nebula.discharges.splice(i, 1);
    }
    while (state.nebula.discharges.length > 8) state.nebula.discharges.shift();
  }

  function drawBackdrop() {
    var variant = getVariant();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, state.screenW, state.screenH);

    var bg = ctx.createLinearGradient(0, 0, 0, state.screenH);
    bg.addColorStop(0, variant.bgTop);
    bg.addColorStop(1, variant.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, state.screenW, state.screenH);

    for (var i = 0; i < state.stars.length; i++) {
      var star = state.stars[i];
      var s = worldToScreen(star.x, star.y);
      var pulse = 0.65 + 0.35 * Math.sin(state.time * (0.7 + star.drift * 1.4) + star.twinkle);
      var alpha = star.alpha * pulse;
      ctx.fillStyle = rgba(star.rgb, alpha);
      ctx.fillRect(s.x, s.y, Math.max(1, star.size * state.viewScale), Math.max(1, star.size * state.viewScale));
      if (star.size > 1.9) {
        ctx.fillStyle = rgba(star.rgb, alpha * 0.10);
        ctx.beginPath();
        ctx.arc(s.x, s.y, star.size * state.viewScale * 3.0, 0, TAU);
        ctx.fill();
      }
    }
  }

  function drawGrid() {
    var step = 100;
    ctx.lineWidth = 1;
    for (var x = 0; x <= WORLD_W; x += step) {
      var a = worldToScreen(x, 0);
      var b = worldToScreen(x, WORLD_H);
      ctx.strokeStyle = "rgba(84,112,182,0.10)";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (var y = 0; y <= WORLD_H; y += step) {
      var c = worldToScreen(0, y);
      var d = worldToScreen(WORLD_W, y);
      ctx.strokeStyle = "rgba(84,112,182,0.10)";
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }
  }

  function drawWorldBounds() {
    var p = worldToScreen(0, 0);
    ctx.strokeStyle = "rgba(116,164,255,0.26)";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, p.y, WORLD_W * state.viewScale, WORLD_H * state.viewScale);
  }

  function drawNebula() {
    var nebula = state.nebula;
    if (!nebula) return;
    var variant = getVariant();
    var outline = buildOutlinePoints(nebula);
    var outerHaze = controlRatio(controls.outerHaze, 64);
    var coreGlow = controlRatio(controls.coreGlow, 58);
    var fringe = controlRatio(controls.fringe, 52);
    var filamentLevel = controlRatio(controls.filaments, 48);
    var lod = getLod();

    var center = worldToScreen(nebula.x, nebula.y);

    drawGradientEllipse(
      center.x,
      center.y,
      nebula.radius * state.viewScale * (1.45 + outerHaze * 0.22) * variant.outerMul,
      nebula.radius * state.viewScale * (0.95 + outerHaze * 0.16),
      nebula.rgb,
      0.06 + outerHaze * 0.08,
      nebula.driftA * 0.25
    );

    for (var i = 0; i < nebula.plumes.length; i++) {
      var plume = nebula.plumes[i];
      var ang = plume.angle + Math.sin(state.time * plume.drift + plume.phase) * 0.22;
      var dist = plume.dist * (1 + Math.sin(state.time * (plume.drift * 0.6) + plume.phase) * 0.07);
      var px = nebula.x + Math.cos(ang) * dist;
      var py = nebula.y + Math.sin(ang * 0.92) * dist * 0.74;
      var screen = worldToScreen(px, py);
      drawGradientEllipse(
        screen.x,
        screen.y,
        plume.rx * state.viewScale * (1.04 + outerHaze * 0.30),
        plume.ry * state.viewScale * plume.squish * (1.02 + outerHaze * 0.16),
        nebula.rgb,
        plume.alpha * (0.60 + outerHaze * 0.70),
        ang + plume.spin * state.time
      );
    }

    ctx.save();
    pathFromPoints(outline);
    ctx.clip();

    for (var p = 0; p < nebula.plumes.length; p++) {
      var plume2 = nebula.plumes[p];
      var ang2 = plume2.angle + Math.sin(state.time * plume2.drift + plume2.phase) * 0.16;
      var dist2 = plume2.dist * (0.92 + Math.sin(state.time * (plume2.drift * 0.7) + plume2.phase) * 0.06);
      var px2 = nebula.x + Math.cos(ang2) * dist2;
      var py2 = nebula.y + Math.sin(ang2 * 1.08) * dist2 * 0.70;
      var screen2 = worldToScreen(px2, py2);
      drawGradientEllipse(
        screen2.x,
        screen2.y,
        plume2.rx * state.viewScale * variant.innerMul,
        plume2.ry * state.viewScale * plume2.squish * variant.innerMul,
        nebula.rgb,
        plume2.alpha * (0.82 + outerHaze * 0.52),
        ang2 + plume2.spin * state.time
      );
    }

    for (var k = 0; k < nebula.knots.length; k++) {
      var knot = nebula.knots[k];
      var ka = knot.angle + Math.sin(state.time * knot.drift + knot.phase) * 0.24;
      var kd = knot.dist * (0.9 + Math.sin(state.time * (knot.drift * 0.8) + knot.phase) * 0.08);
      var kx = nebula.x + Math.cos(ka) * kd;
      var ky = nebula.y + Math.sin(ka) * kd * 0.76;
      var ks = worldToScreen(kx, ky);
      drawGradientEllipse(
        ks.x,
        ks.y,
        knot.r * state.viewScale * (0.90 + coreGlow * 0.60),
        knot.r * state.viewScale * (0.58 + coreGlow * 0.28),
        variant.edgeRgb,
        knot.alpha * (0.30 + coreGlow * 0.80),
        ka
      );
    }

    var ribbonCount = Math.max(0, Math.round(nebula.ribbons.length * filamentLevel));
    for (var r = 0; r < ribbonCount; r++) {
      var ribbon = nebula.ribbons[r];
      var ra = ribbon.angle + Math.sin(state.time * 0.24 + ribbon.phase) * 0.12;
      var rr = nebula.radius * ribbon.radiusMul;
      var start = worldToScreen(nebula.x + Math.cos(ra - ribbon.width) * rr, nebula.y + Math.sin(ra - ribbon.width) * rr * 0.82);
      var end = worldToScreen(nebula.x + Math.cos(ra + ribbon.width) * rr, nebula.y + Math.sin(ra + ribbon.width) * rr * 0.82);
      var mid = worldToScreen(
        nebula.x + Math.cos(ra + ribbon.bend) * rr * 0.38,
        nebula.y + Math.sin(ra + ribbon.bend) * rr * 0.24
      );
      ctx.strokeStyle = rgba(variant.edgeRgb, ribbon.alpha * (0.4 + filamentLevel * 0.9));
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.quadraticCurveTo(mid.x, mid.y, end.x, end.y);
      ctx.stroke();
    }
    ctx.restore();

    pathFromPoints(outline);
    ctx.fillStyle = rgba(nebula.rgb, 0.04 + outerHaze * 0.05);
    ctx.fill();

    pathFromPoints(outline);
    ctx.strokeStyle = rgba(variant.edgeRgb, (0.12 + fringe * 0.18) * variant.edgeMul);
    ctx.lineWidth = 2.1;
    ctx.stroke();

    pathFromPoints(outline);
    ctx.strokeStyle = rgba(variant.edgeRgb, (0.05 + fringe * 0.12) * variant.edgeMul);
    ctx.lineWidth = 5.5;
    ctx.stroke();

    var step = Math.max(1, Math.floor(outline.length / Math.max(1, lod.fringePoints)));
    for (var f = 0; f < outline.length; f += step) {
      var pt = outline[f];
      var outR = pt.radius * (1.03 + fringe * 0.06);
      var fx = nebula.x + Math.cos(pt.angle) * outR;
      var fy = nebula.y + Math.sin(pt.angle) * outR;
      var fs = worldToScreen(fx, fy);
      drawGradientEllipse(
        fs.x,
        fs.y,
        nebula.radius * state.viewScale * (0.06 + fringe * 0.05),
        nebula.radius * state.viewScale * (0.03 + fringe * 0.025),
        variant.edgeRgb,
        0.025 + fringe * 0.06,
        pt.angle
      );
    }

    var centerGlow = 0.10 + coreGlow * 0.18;
    drawGradientEllipse(
      center.x,
      center.y,
      nebula.radius * state.viewScale * (0.42 + coreGlow * 0.20),
      nebula.radius * state.viewScale * (0.24 + coreGlow * 0.10),
      variant.edgeRgb,
      centerGlow,
      nebula.driftB * 0.2
    );

    ctx.fillStyle = "rgba(230,242,255,0.82)";
    ctx.font = Math.max(12, 12 * state.viewScale) + "px Inter, Segoe UI, Arial";
    ctx.fillText(getVariant().name, center.x - nebula.radius * state.viewScale * 0.30, center.y - nebula.radius * state.viewScale - 14);
  }

  function drawDischarges() {
    var nebula = state.nebula;
    if (!nebula) return;
    for (var i = 0; i < nebula.discharges.length; i++) {
      var d = nebula.discharges[i];
      var alpha = d.life / Math.max(0.001, d.maxLife);
      for (var s = 0; s < d.segs.length; s++) {
        var seg = d.segs[s];
        var a = worldToScreen(seg.x1, seg.y1);
        var b = worldToScreen(seg.x2, seg.y2);
        ctx.strokeStyle = rgba(d.rgb, 0.16 * alpha);
        ctx.lineWidth = 5.0 * state.viewScale;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        ctx.strokeStyle = rgba("214,236,255", 0.42 * alpha);
        ctx.lineWidth = 2.2 * state.viewScale;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        ctx.strokeStyle = rgba("255,255,255", 0.22 * alpha);
        ctx.lineWidth = 0.9 * state.viewScale;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  function pickEntity(world) {
    if (!state.nebula) return null;
    var d = Math.hypot(world.x - state.nebula.x, world.y - state.nebula.y);
    if (d <= Math.max(40, state.nebula.radius * 0.18)) return state.nebula;
    return null;
  }

  function updateTexts() {
    var variant = getVariant();
    var radius = controlInt(controls.radius, 230);
    var distortion = Math.round(controlRatio(controls.distortion, 54) * 100);
    var discharges = state.nebula ? state.nebula.discharges.length : 0;
    document.documentElement.style.setProperty("--accent", variant.accent);
    if (texts.title) texts.title.textContent = variant.name;
    if (texts.subtitle) texts.subtitle.textContent = variant.subtitle;
    if (texts.status) texts.status.textContent = "Radius: " + radius + " | Distortion: " + distortion + " | Active discharges: " + discharges + " | Seed: " + state.seed + " | Shape: " + state.shapeSeed;
    if (texts.spawn) texts.spawn.textContent = "Базис остается игровым: одна туманность как зона-аномалия. Меняется не логика радиуса, а только visual body и характер края.";
    if (texts.visual) texts.visual.textContent = variant.visualText;
    if (texts.focus) texts.focus.textContent = variant.focusText;
  }

  function applyPreset(calm) {
    if (!controls.distortion) return;
    if (calm) {
      controls.distortion.value = "34";
      controls.coreGlow.value = "42";
      controls.outerHaze.value = "68";
      controls.fringe.value = "32";
      controls.filaments.value = "28";
      controls.dischargeRate.value = "18";
    } else {
      controls.distortion.value = "72";
      controls.coreGlow.value = "70";
      controls.outerHaze.value = "58";
      controls.fringe.value = "78";
      controls.filaments.value = "74";
      controls.dischargeRate.value = "76";
    }
    buildNebula();
  }

  function bind() {
    for (var i = 0; i < VARIANTS.length; i++) {
      var option = document.createElement("option");
      option.value = String(i);
      option.textContent = VARIANTS[i].name;
      controls.variantSelect.appendChild(option);
    }
    controls.variantSelect.value = String(state.variantIndex);

    controls.variantSelect.addEventListener("change", function () {
      state.variantIndex = Number(controls.variantSelect.value || 0);
      buildStars();
      buildNebula();
    });

    controls.radius.addEventListener("input", buildNebula);
    controls.distortion.addEventListener("input", updateTexts);
    controls.coreGlow.addEventListener("input", updateTexts);
    controls.outerHaze.addEventListener("input", updateTexts);
    controls.fringe.addEventListener("input", updateTexts);
    controls.filaments.addEventListener("input", updateTexts);
    controls.dischargeRate.addEventListener("input", updateTexts);
    controls.lodMode.addEventListener("change", function () {
      buildStars();
      buildNebula();
    });

    controls.randomizeSeed.addEventListener("click", function () {
      state.seed = Math.floor(Math.random() * 0xffffffff);
      buildStars();
      buildNebula();
    });
    controls.randomizeShape.addEventListener("click", function () {
      state.shapeSeed = Math.floor(Math.random() * 0xffffffff);
      buildNebula();
    });
    controls.calmPreset.addEventListener("click", function () { applyPreset(true); });
    controls.stormPreset.addEventListener("click", function () { applyPreset(false); });

    canvas.addEventListener("pointerdown", function (e) {
      var world = screenToWorld(e.clientX, e.clientY);
      var picked = pickEntity(world);
      if (!picked) return;
      state.dragging = {
        ref: picked,
        offsetX: picked.x - world.x,
        offsetY: picked.y - world.y
      };
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!state.dragging) return;
      var world = screenToWorld(e.clientX, e.clientY);
      state.dragging.ref.x = clamp(world.x + state.dragging.offsetX, 120, WORLD_W - 120);
      state.dragging.ref.y = clamp(world.y + state.dragging.offsetY, 120, WORLD_H - 120);
      updateTexts();
    });
    window.addEventListener("pointerup", function () {
      state.dragging = null;
    });
    window.addEventListener("resize", function () {
      resizeCanvas();
      buildStars();
      updateTexts();
    });
  }

  function frame(now) {
    if (!state.lastNow) state.lastNow = now;
    var dt = Math.min(0.05, (now - state.lastNow) / 1000);
    state.lastNow = now;
    state.time += dt;

    stepNebula(dt);
    drawBackdrop();
    drawGrid();
    drawNebula();
    drawDischarges();
    drawWorldBounds();
    updateTexts();

    requestAnimationFrame(frame);
  }

  resizeCanvas();
  bind();
  buildStars();
  buildNebula();
  requestAnimationFrame(frame);
})();
