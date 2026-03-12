(function () {
  "use strict";

  var TAU = Math.PI * 2;

  var canvas = document.getElementById("scene");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var controls = {
    variantSelect: document.getElementById("variantSelect"),
    palette: document.getElementById("palette"),
    lodMode: document.getElementById("lodMode"),
    distance: document.getElementById("distance"),
    stress: document.getElementById("stress"),
    pulsePressure: document.getElementById("pulsePressure"),
    randomizeCenters: document.getElementById("randomizeCenters"),
    resetCenters: document.getElementById("resetCenters")
  };

  var texts = {
    variantTitle: document.getElementById("variantTitle"),
    status: document.getElementById("statusLine"),
    real: document.getElementById("legendReal"),
    pressure: document.getElementById("legendPressure"),
    interaction: document.getElementById("legendInteraction")
  };

  var PALETTES = {
    blue: {
      weak:  { core: "#67a5ff", edge: "#d6e7ff", bright: "#f5fbff", shell: "#0a1529", glow: "103,165,255", line: "154,202,255" },
      strong:{ core: "#ff7b89", edge: "#ffd9df", bright: "#fff5f7", shell: "#23121a", glow: "255,123,137", line: "255,170,180" }
    },
    red: {
      weak:  { core: "#ff7f92", edge: "#ffe1e7", bright: "#fff7f9", shell: "#271018", glow: "255,127,146", line: "255,186,198" },
      strong:{ core: "#74b6ff", edge: "#ddeeff", bright: "#f6fbff", shell: "#101d2e", glow: "116,182,255", line: "171,213,255" }
    },
    green: {
      weak:  { core: "#63d39a", edge: "#dcffec", bright: "#f6fff9", shell: "#0a1d18", glow: "99,211,154", line: "154,238,194" },
      strong:{ core: "#ff945f", edge: "#ffe3d2", bright: "#fff8f2", shell: "#25140d", glow: "255,148,95", line: "255,194,155" }
    },
    purple: {
      weak:  { core: "#bb8fff", edge: "#efdeff", bright: "#fcf8ff", shell: "#171124", glow: "187,143,255", line: "223,194,255" },
      strong:{ core: "#7fd8c8", edge: "#dbfff8", bright: "#f6fffd", shell: "#0f1d1c", glow: "127,216,200", line: "178,243,235" }
    },
    amber: {
      weak:  { core: "#ffbb5e", edge: "#ffe6c3", bright: "#fffaf1", shell: "#25190b", glow: "255,187,94", line: "255,220,163" },
      strong:{ core: "#8eaaff", edge: "#e0e9ff", bright: "#f7faff", shell: "#10192b", glow: "142,170,255", line: "188,205,255" }
    }
  };

  var LOD = {
    near: {
      samples: 112,
      shellLayers: 2,
      nodeDensityMul: 1,
      sparkMul: 1,
      electricSteps: 4,
      flashes: true
    },
    mid: {
      samples: 74,
      shellLayers: 1,
      nodeDensityMul: 0.65,
      sparkMul: 0.55,
      electricSteps: 3,
      flashes: true
    },
    far: {
      samples: 42,
      shellLayers: 1,
      nodeDensityMul: 0.34,
      sparkMul: 0.22,
      electricSteps: 2,
      flashes: false
    }
  };

  var VARIANTS = [
    {
      key: "membrane",
      name: "01. Plexus Membrane",
      title: "Plexus Membrane",
      realText: "Реальный контур тоже продавливается. Визуальная мембрана лишь повторяет это и добавляет поверх клиентский Plexus.",
      pressureText: "Спокойные участки: медленные пульс-круги на узлах. Под давлением круги исчезают, а фронт превращается в электрические кресты, искры и короткие вспышки.",
      interactionText: "Тяни центры зон для изменения угла контакта и силы продавливания. Этот вариант самый базовый и тактически читаемый.",
      auraDepth: 18,
      noiseAmp: 10,
      shellWidth: 7,
      realPressureAmp: 40,
      visualPressureAmp: 30,
      driftAmp: 4,
      driftSpeed: 0.22,
      nodeCount: 22,
      crossSpan: 2,
      calmCircleRadius: 6,
      sparkCount: 4,
      frontArcAlpha: 0.24,
      weaveAlpha: 0.12
    },
    {
      key: "braid",
      name: "02. Braided Current",
      title: "Braided Current",
      realText: "Контур зоны живет медленно и мягко. Продавливание сохраняется в authoritative contour, а визуал тянется вдоль фронта как сплетенный ток.",
      pressureText: "На спокойном участке виден мягкий braid-Plexus. На фронте давления braid схлопывается и дает больше электрических пересечений.",
      interactionText: "Хорошо показывает течение вдоль границы. Ближе к игре, если нужен живой, но не слишком жесткий образ.",
      auraDepth: 24,
      noiseAmp: 15,
      shellWidth: 8,
      realPressureAmp: 38,
      visualPressureAmp: 34,
      driftAmp: 5,
      driftSpeed: 0.26,
      nodeCount: 20,
      crossSpan: 3,
      calmCircleRadius: 5,
      sparkCount: 3,
      frontArcAlpha: 0.18,
      weaveAlpha: 0.22
    },
    {
      key: "siege",
      name: "03. Siege Net",
      title: "Siege Net",
      realText: "Контур слабой зоны под давлением будто осаждается. Реальная геометрия фронта сжимается, а сеть сверху лишь подчеркивает это.",
      pressureText: "Сетка на спокойных участках ровная. В зоне давления узлы начинают давать жесткие электрические X-пересечения и короткие белые пробои.",
      interactionText: "Лучше всего подходит для более сурового mil-tech, где важен образ осады и dominance.",
      auraDepth: 16,
      noiseAmp: 8,
      shellWidth: 6,
      realPressureAmp: 44,
      visualPressureAmp: 36,
      driftAmp: 3,
      driftSpeed: 0.18,
      nodeCount: 24,
      crossSpan: 2,
      calmCircleRadius: 4,
      sparkCount: 5,
      frontArcAlpha: 0.26,
      weaveAlpha: 0.08
    },
    {
      key: "ion-shear",
      name: "04. Ion Shear",
      title: "Ion Shear",
      realText: "Реальный фронт давления режет слабую зону. Визуально это подается как сдвиговый ion shear поверх authoritative contour.",
      pressureText: "Круги есть только вне зоны контакта. На pressure front появляются быстрые боковые пересечения, короткие дуги и резкие электрические срезы.",
      interactionText: "Хороший компромисс между 'живым полем' и агрессивным боевым ощущением.",
      auraDepth: 20,
      noiseAmp: 11,
      shellWidth: 7,
      realPressureAmp: 42,
      visualPressureAmp: 38,
      driftAmp: 4,
      driftSpeed: 0.24,
      nodeCount: 18,
      crossSpan: 4,
      calmCircleRadius: 4,
      sparkCount: 4,
      frontArcAlpha: 0.30,
      weaveAlpha: 0.10
    },
    {
      key: "storm-seam",
      name: "05. Storm Seam",
      title: "Storm Seam",
      realText: "Продавливание читается как штормовой шов между двумя полями. Логика давления реальная, электрический seam — локальный.",
      pressureText: "Почти весь интерес сосредоточен на seam: там убывают calm nodes и растет плотность искр и вспышек.",
      interactionText: "Нужен, если хочется сделать фронт столкновения зон отдельным драматичным событием.",
      auraDepth: 18,
      noiseAmp: 13,
      shellWidth: 7,
      realPressureAmp: 40,
      visualPressureAmp: 42,
      driftAmp: 5,
      driftSpeed: 0.28,
      nodeCount: 16,
      crossSpan: 3,
      calmCircleRadius: 5,
      sparkCount: 7,
      frontArcAlpha: 0.34,
      weaveAlpha: 0.06
    },
    {
      key: "fracture-web",
      name: "06. Fracture Web",
      title: "Fracture Web",
      realText: "Слабая зона будто получает трещину по реальному фронту давления. Visual web живет поверх, но shape-продавливание остается authoritative.",
      pressureText: "Спокойная паутина тонкая. На front появляется более частое крестовое переплетение и жесткие трещины с электрическими пробросами.",
      interactionText: "Это более техногенная и опасная версия, хорошо годится для доминирования вражеской зоны.",
      auraDepth: 14,
      noiseAmp: 8,
      shellWidth: 5,
      realPressureAmp: 48,
      visualPressureAmp: 40,
      driftAmp: 3,
      driftSpeed: 0.20,
      nodeCount: 26,
      crossSpan: 4,
      calmCircleRadius: 3,
      sparkCount: 6,
      frontArcAlpha: 0.22,
      weaveAlpha: 0.14
    },
    {
      key: "arc-bastion",
      name: "07. Arc Bastion",
      title: "Arc Bastion",
      realText: "Реальный контур работает как крепость под давлением. Локальный слой выглядит как сетка укрепленных электрических арок.",
      pressureText: "Цветные узловые круги остаются только вдали от фронта. Под давлением бастионные арки дают короткие белые arc-блики.",
      interactionText: "Почти милитари-щитовая версия, если хочется крепкой и дорогой подачи зоны влияния.",
      auraDepth: 16,
      noiseAmp: 7,
      shellWidth: 6,
      realPressureAmp: 46,
      visualPressureAmp: 32,
      driftAmp: 2,
      driftSpeed: 0.16,
      nodeCount: 18,
      crossSpan: 2,
      calmCircleRadius: 4,
      sparkCount: 4,
      frontArcAlpha: 0.36,
      weaveAlpha: 0.08
    },
    {
      key: "conductive-foam",
      name: "08. Conductive Foam",
      title: "Conductive Foam",
      realText: "Slow float выражен сильнее: кромка кажется вспененным проводящим материалом, но продавливание все равно привязано к реальной зоне.",
      pressureText: "В спокойствии много мягких bubble-пульсов на узлах. В давлении пузырьки пропадают и превращаются в хаотичные sparks/crossings.",
      interactionText: "Самая 'живая' и органичная версия из набора, если нужен less rigid sci-fi.",
      auraDepth: 26,
      noiseAmp: 18,
      shellWidth: 9,
      realPressureAmp: 34,
      visualPressureAmp: 38,
      driftAmp: 6,
      driftSpeed: 0.32,
      nodeCount: 24,
      crossSpan: 3,
      calmCircleRadius: 7,
      sparkCount: 5,
      frontArcAlpha: 0.18,
      weaveAlpha: 0.24
    },
    {
      key: "razor-mesh",
      name: "09. Razor Mesh",
      title: "Razor Mesh",
      realText: "Реальный фронт давления виден как срез. Локальная сетка поверх него более тонкая и режущая, без лишней мягкости.",
      pressureText: "Спокойствие почти сухое. На pressure front появляются острые диагональные пересечения и короткие вспышки с высоким контрастом.",
      interactionText: "Если хочется почти UI-подобной ясности и very clean aggressive read, это один из лучших вариантов.",
      auraDepth: 12,
      noiseAmp: 6,
      shellWidth: 4,
      realPressureAmp: 50,
      visualPressureAmp: 34,
      driftAmp: 2,
      driftSpeed: 0.15,
      nodeCount: 20,
      crossSpan: 5,
      calmCircleRadius: 2.5,
      sparkCount: 3,
      frontArcAlpha: 0.28,
      weaveAlpha: 0.05
    },
    {
      key: "overcharge-veil",
      name: "10. Overcharge Veil",
      title: "Overcharge Veil",
      realText: "Veil медленно плавает вокруг authoritative contour, но в месте давления выглядит как перегруженный разогретый фронт.",
      pressureText: "Вне давления видны мягкие halo circles на Plexus nodes. На front возникает overcharge: вспышки, искры, crossed links и короткие ослепляющие пробои.",
      interactionText: "Самая эффектная версия, если нужен прямой wow-factor без потери идеи real contour + local VFX.",
      auraDepth: 28,
      noiseAmp: 16,
      shellWidth: 10,
      realPressureAmp: 38,
      visualPressureAmp: 44,
      driftAmp: 5,
      driftSpeed: 0.30,
      nodeCount: 22,
      crossSpan: 4,
      calmCircleRadius: 7,
      sparkCount: 8,
      frontArcAlpha: 0.40,
      weaveAlpha: 0.18
    }
  ];

  var state = {
    time: 0,
    paletteKey: controls.palette.value,
    variantIndex: 0,
    lodMode: controls.lodMode.value,
    distance: Number(controls.distance.value),
    stress: Number(controls.stress.value),
    pressurePulse: 0,
    dragging: null,
    zones: null
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(a, b, x) {
    if (a === b) return x >= b ? 1 : 0;
    var t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function fract(v) {
    return v - Math.floor(v);
  }

  function seeded(seed) {
    return fract(Math.sin(seed * 127.1 + 311.7) * 43758.5453123);
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

  function rgba(hex, alpha) {
    var rgb = hexToRgb(hex);
    return "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + alpha + ")";
  }

  function rgbaRgb(rgb, alpha) {
    return "rgba(" + rgb + "," + alpha + ")";
  }

  function layeredNoise(seed, angle, time) {
    return (
      Math.sin(angle * 2.8 + time * 1.2 + seed * 0.13) * 0.56 +
      Math.cos(angle * 5.1 - time * 0.72 + seed * 0.27) * 0.29 +
      Math.sin(angle * 9.5 + time * 0.35 + seed * 0.08) * 0.15
    );
  }

  function getVariant() {
    return VARIANTS[state.variantIndex] || VARIANTS[0];
  }

  function getPaletteSet() {
    return PALETTES[state.paletteKey] || PALETTES.blue;
  }

  function getLodKey() {
    if (state.lodMode !== "auto") return state.lodMode;
    if (state.distance > 72 || state.stress > 78) return "far";
    if (state.distance > 38 || state.stress > 42) return "mid";
    return "near";
  }

  function getLod() {
    return LOD[getLodKey()];
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
    if (!state.zones) resetZones();
  }

  function resetZones() {
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    var r = Math.min(width, height);
    state.zones = {
      weak: {
        id: "weak",
        x: width * 0.40,
        y: height * 0.58,
        radius: r * 0.22,
        strength: 0.58,
        seed: 21
      },
      strong: {
        id: "strong",
        x: width * 0.66,
        y: height * 0.44,
        radius: r * 0.26,
        strength: 1.00,
        seed: 83
      }
    };
  }

  function randomizeCenters() {
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    state.zones.weak.x = width * (0.28 + seeded(state.time * 17.1) * 0.22);
    state.zones.weak.y = height * (0.48 + seeded(state.time * 21.2) * 0.20);
    state.zones.strong.x = width * (0.56 + seeded(state.time * 31.4) * 0.20);
    state.zones.strong.y = height * (0.30 + seeded(state.time * 27.3) * 0.24);
  }

  function drawBackdrop(width, height, weakPalette) {
    ctx.clearRect(0, 0, width, height);
    var glow = hexToRgb(weakPalette.core);
    var grad = ctx.createRadialGradient(width * 0.5, height * 0.18, 0, width * 0.5, height * 0.18, Math.max(width, height) * 0.95);
    grad.addColorStop(0, "rgba(" + glow.r + "," + glow.g + "," + glow.b + ",0.14)");
    grad.addColorStop(0.40, "rgba(7,12,22,0.78)");
    grad.addColorStop(1, "rgba(3,6,10,0.98)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    var i;
    for (i = 0; i < 160; i += 1) {
      var sx = seeded(i * 1.31) * width;
      var sy = seeded(i * 3.19) * height;
      var pulse = 0.72 + 0.28 * Math.sin(state.time * (0.3 + seeded(i * 5.7)) + i);
      ctx.fillStyle = "rgba(220,232,255," + (0.10 + seeded(i * 4.1) * 0.22 * pulse).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(sx, sy, 0.7 + seeded(i * 2.3) * 1.8, 0, TAU);
      ctx.fill();
    }

    ctx.save();
    ctx.strokeStyle = rgbaRgb(weakPalette.line, 0.04);
    ctx.lineWidth = 1;
    var step = 60;
    var x;
    var y;
    for (x = 0.5; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (y = 0.5; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function pathSmooth(points) {
    if (!points || points.length < 3) return;
    var last = points[points.length - 1];
    var first = points[0];
    ctx.beginPath();
    ctx.moveTo((last.x + first.x) * 0.5, (last.y + first.y) * 0.5);
    for (var i = 0; i < points.length; i += 1) {
      var cur = points[i];
      var next = points[(i + 1) % points.length];
      ctx.quadraticCurveTo(cur.x, cur.y, (cur.x + next.x) * 0.5, (cur.y + next.y) * 0.5);
    }
    ctx.closePath();
  }

  function buildBaseReal(zone, count, variant) {
    var samples = [];
    var total = 0;
    for (var i = 0; i < count; i += 1) {
      var angle = (i / count) * TAU;
      var baseShape = 1
        + Math.sin(angle * 2 + zone.seed * 0.03) * 0.07
        + Math.cos(angle * 3 - zone.seed * 0.01) * 0.05
        + Math.sin(angle * 5 + zone.seed * 0.05) * 0.025;
      var drift = Math.sin(state.time * variant.driftSpeed + angle * 2.4 + zone.seed) * variant.driftAmp;
      var radius = zone.radius * baseShape + drift;
      total += radius;
      samples.push({
        angle: angle,
        baseR: radius,
        nx: Math.cos(angle),
        ny: Math.sin(angle),
        pressure: 0,
        realR: radius,
        realX: 0,
        realY: 0,
        shellR: 0,
        shellX: 0,
        shellY: 0,
        tangentX: -Math.sin(angle),
        tangentY: Math.cos(angle)
      });
    }
    zone.avgRadius = total / Math.max(1, count);
    return samples;
  }

  function pressureAtSample(sample, weakZone, strongZone, variant) {
    var dx = strongZone.x - (weakZone.x + sample.nx * sample.baseR);
    var dy = strongZone.y - (weakZone.y + sample.ny * sample.baseR);
    var dist = Math.hypot(dx, dy) || 1;
    var dirX = dx / dist;
    var dirY = dy / dist;
    var facing = clamp(sample.nx * dirX + sample.ny * dirY, 0, 1);
    var reach = strongZone.avgRadius + Math.max(90, strongZone.radius * 0.80);
    var proximity = smoothstep(reach, strongZone.avgRadius * 0.50, dist);
    var pulse = 1 + state.pressurePulse * 0.8;
    return proximity * Math.pow(facing, 1.55) * pulse;
  }

  function solveContours(weakZone, strongZone, variant, lod) {
    var strongBase = buildBaseReal(strongZone, lod.samples, variant);
    var weakBase = buildBaseReal(weakZone, lod.samples, variant);
    var i;

    for (i = 0; i < strongBase.length; i += 1) {
      var sStrong = strongBase[i];
      var strongBulge = pressureAtSample(sStrong, strongZone, weakZone, variant) * variant.realPressureAmp * 0.08;
      sStrong.realR = sStrong.baseR + strongBulge;
      sStrong.realX = strongZone.x + sStrong.nx * sStrong.realR;
      sStrong.realY = strongZone.y + sStrong.ny * sStrong.realR;
    }

    for (i = 0; i < weakBase.length; i += 1) {
      var sWeak = weakBase[i];
      var pressure = pressureAtSample(sWeak, weakZone, strongZone, variant);
      sWeak.pressure = pressure;
      sWeak.realR = sWeak.baseR - pressure * variant.realPressureAmp;
      sWeak.realR = Math.max(weakZone.radius * 0.42, sWeak.realR);
      sWeak.realX = weakZone.x + sWeak.nx * sWeak.realR;
      sWeak.realY = weakZone.y + sWeak.ny * sWeak.realR;
    }

    for (i = 0; i < strongBase.length; i += 1) {
      var strongNoise = layeredNoise(strongZone.seed + 13, strongBase[i].angle, state.time * 0.9);
      strongBase[i].shellR = strongBase[i].realR + variant.auraDepth + strongNoise * variant.noiseAmp * 0.65;
      strongBase[i].shellX = strongZone.x + strongBase[i].nx * strongBase[i].shellR;
      strongBase[i].shellY = strongZone.y + strongBase[i].ny * strongBase[i].shellR;
    }

    for (i = 0; i < weakBase.length; i += 1) {
      var noise = layeredNoise(weakZone.seed + 17, weakBase[i].angle, state.time * (1.1 + variant.weaveAlpha));
      var calmPulse = Math.sin(state.time * 1.8 + weakBase[i].angle * 4.0) * 1.6;
      var offset = variant.auraDepth + noise * variant.noiseAmp + calmPulse - weakBase[i].pressure * variant.visualPressureAmp;
      weakBase[i].shellR = weakBase[i].realR + offset;
      weakBase[i].shellX = weakZone.x + weakBase[i].nx * weakBase[i].shellR;
      weakBase[i].shellY = weakZone.y + weakBase[i].ny * weakBase[i].shellR;
    }

    return { weak: weakBase, strong: strongBase };
  }

  function extractPoints(samples, keyX, keyY) {
    var pts = [];
    for (var i = 0; i < samples.length; i += 1) {
      pts.push({ x: samples[i][keyX], y: samples[i][keyY] });
    }
    return pts;
  }

  function drawZoneFill(points, palette, alphaMul) {
    var cx = 0;
    var cy = 0;
    for (var i = 0; i < points.length; i += 1) {
      cx += points[i].x;
      cy += points[i].y;
    }
    cx /= Math.max(1, points.length);
    cy /= Math.max(1, points.length);
    var fill = ctx.createRadialGradient(cx, cy, 0, cx, cy, 260);
    fill.addColorStop(0, rgbaRgb(palette.glow, 0.10 * alphaMul));
    fill.addColorStop(0.60, rgbaRgb(palette.glow, 0.03 * alphaMul));
    fill.addColorStop(1, rgbaRgb(palette.glow, 0));
    pathSmooth(points);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawRealContour(points, palette, alpha, width) {
    pathSmooth(points);
    ctx.strokeStyle = rgba(palette.edge, alpha);
    ctx.lineWidth = width;
    ctx.setLineDash([8, 7]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawShell(points, palette, variant, layerScale, alphaMul) {
    var width = Math.max(1.4, variant.shellWidth * layerScale);
    pathSmooth(points);
    ctx.strokeStyle = rgbaRgb(palette.glow, 0.12 * alphaMul);
    ctx.lineWidth = width * 1.9;
    ctx.stroke();

    pathSmooth(points);
    ctx.strokeStyle = rgba(palette.bright, 0.24 * alphaMul);
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function buildNodes(samples, variant, lod) {
    var wanted = Math.max(4, Math.round(variant.nodeCount * lod.nodeDensityMul));
    var step = Math.max(1, Math.floor(samples.length / wanted));
    var nodes = [];
    for (var i = 0; i < samples.length; i += step) {
      nodes.push(samples[i]);
    }
    return nodes;
  }

  function drawCalmPlexus(nodes, palette, variant) {
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      var a = nodes[i];
      var b = nodes[(i + 1) % nodes.length];
      ctx.beginPath();
      ctx.moveTo(a.shellX, a.shellY);
      ctx.lineTo(b.shellX, b.shellY);
      ctx.strokeStyle = rgbaRgb(palette.line, 0.16);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (i = 0; i < nodes.length; i += 1) {
      if (nodes[i].pressure > 0.18) continue;
      var pulse = 0.72 + 0.28 * Math.sin(state.time * 2.4 + nodes[i].angle * 6.0);
      ctx.beginPath();
      ctx.arc(nodes[i].shellX, nodes[i].shellY, variant.calmCircleRadius * pulse, 0, TAU);
      ctx.strokeStyle = rgbaRgb(palette.glow, 0.14 + pulse * 0.08);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(nodes[i].shellX, nodes[i].shellY, 2.1, 0, TAU);
      ctx.fillStyle = rgba(palette.bright, 0.72);
      ctx.fill();
    }
  }

  function drawElectricLine(x0, y0, x1, y1, palette, alpha, steps) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    var dx = x1 - x0;
    var dy = y1 - y0;
    var len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len;
    var ny = dx / len;
    for (var s = 1; s < steps; s += 1) {
      var t = s / steps;
      var jitter = Math.sin(state.time * 30 + t * 20 + x0 * 0.01 + y0 * 0.01) * 4;
      ctx.lineTo(x0 + dx * t + nx * jitter, y0 + dy * t + ny * jitter);
    }
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = rgbaRgb(palette.glow, alpha);
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = rgba(palette.bright, alpha * 0.46);
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  function drawSparkBurst(node, palette, variant, lod, countMul) {
    var count = Math.max(1, Math.round(variant.sparkCount * lod.sparkMul * countMul));
    for (var i = 0; i < count; i += 1) {
      var phase = state.time * (8 + i) + node.angle * 11 + i * 1.7;
      var angle = node.angle + Math.sin(phase) * 0.9 + (i - count * 0.5) * 0.12;
      var len = 8 + Math.sin(phase * 1.2) * 4 + node.pressure * 10;
      var x1 = node.shellX + Math.cos(angle) * len;
      var y1 = node.shellY + Math.sin(angle) * len;
      drawElectricLine(node.shellX, node.shellY, x1, y1, palette, 0.20 + node.pressure * 0.35, lod.electricSteps);
    }
  }

  function drawPressurePlexus(nodes, palette, variant, lod) {
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (node.pressure <= 0.12) continue;
      var next = nodes[(i + 1) % nodes.length];
      var cross = nodes[(i + variant.crossSpan) % nodes.length];
      var prev = nodes[(i - 1 + nodes.length) % nodes.length];

      drawElectricLine(node.shellX, node.shellY, next.shellX, next.shellY, palette, 0.18 + node.pressure * 0.28, lod.electricSteps);
      drawElectricLine(node.shellX, node.shellY, cross.shellX, cross.shellY, palette, 0.10 + node.pressure * 0.30, lod.electricSteps);

      ctx.beginPath();
      ctx.moveTo(prev.shellX, prev.shellY);
      ctx.lineTo(next.shellX, next.shellY);
      ctx.strokeStyle = rgba(palette.bright, 0.08 + node.pressure * 0.18);
      ctx.lineWidth = 0.8;
      ctx.stroke();

      drawSparkBurst(node, palette, variant, lod, 1);

      if (lod.flashes && seeded(i * 9.13 + Math.floor(state.time * 8)) > 0.72) {
        ctx.beginPath();
        ctx.arc(node.shellX, node.shellY, 10 + node.pressure * 18, 0, TAU);
        ctx.fillStyle = rgba(palette.bright, 0.05 + node.pressure * 0.10);
        ctx.fill();
      }
    }
  }

  function drawWeave(samples, palette, variant) {
    if (variant.weaveAlpha <= 0.01) return;
    var step = Math.max(2, Math.floor(samples.length / 18));
    for (var i = 0; i < samples.length; i += step) {
      var s = samples[i];
      var swing = Math.sin(state.time * 2.1 + s.angle * 5.0) * 14;
      var endX = s.shellX + s.tangentX * (24 + swing * 0.3);
      var endY = s.shellY + s.tangentY * (24 + swing * 0.3);
      var ctrlX = s.shellX + s.tangentX * 10 + s.nx * swing * 0.7;
      var ctrlY = s.shellY + s.tangentY * 10 + s.ny * swing * 0.7;
      ctx.beginPath();
      ctx.moveTo(s.shellX, s.shellY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
      ctx.strokeStyle = rgbaRgb(palette.line, variant.weaveAlpha);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawPressureFront(samples, palette, variant) {
    for (var i = 0; i < samples.length; i += 1) {
      var s = samples[i];
      if (s.pressure <= 0.08) continue;
      ctx.beginPath();
      ctx.arc(s.realX, s.realY, 6 + s.pressure * 16, s.angle - 0.55, s.angle + 0.55);
      ctx.strokeStyle = rgba(palette.bright, variant.frontArcAlpha * s.pressure);
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
  }

  function drawCenter(zone, palette, label, isStrong) {
    var r = isStrong ? 12 : 10;
    var grad = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, 32);
    grad.addColorStop(0, rgba(palette.bright, 0.18));
    grad.addColorStop(0.38, rgbaRgb(palette.glow, 0.18));
    grad.addColorStop(1, rgbaRgb(palette.glow, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, 32, 0, TAU);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(zone.x, zone.y, r, 0, TAU);
    ctx.fillStyle = rgba(palette.core, 0.95);
    ctx.fill();
    ctx.strokeStyle = rgba(palette.edge, 0.42);
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = "rgba(220,232,255,0.86)";
    ctx.font = "12px Inter, Segoe UI, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, zone.x, zone.y - 18);
  }

  function drawScene() {
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    var variant = getVariant();
    var paletteSet = getPaletteSet();
    var weakPalette = paletteSet.weak;
    var strongPalette = paletteSet.strong;
    var lod = getLod();
    var weakZone = state.zones.weak;
    var strongZone = state.zones.strong;

    drawBackdrop(width, height, weakPalette);

    var solved = solveContours(weakZone, strongZone, variant, lod);
    var weakRealPts = extractPoints(solved.weak, "realX", "realY");
    var strongRealPts = extractPoints(solved.strong, "realX", "realY");
    var weakShellPts = extractPoints(solved.weak, "shellX", "shellY");
    var strongShellPts = extractPoints(solved.strong, "shellX", "shellY");

    drawZoneFill(strongRealPts, strongPalette, 0.9);
    drawZoneFill(weakRealPts, weakPalette, 1.0);

    for (var layer = 0; layer < lod.shellLayers; layer += 1) {
      drawShell(strongShellPts, strongPalette, variant, 1 - layer * 0.24, 0.90 - layer * 0.18);
      drawShell(weakShellPts, weakPalette, variant, 1 - layer * 0.20, 1 - layer * 0.16);
    }

    drawRealContour(strongRealPts, strongPalette, 0.58, 1.2);
    drawRealContour(weakRealPts, weakPalette, 0.64, 1.2);

    drawWeave(solved.strong, strongPalette, variant);
    drawWeave(solved.weak, weakPalette, variant);

    drawPressureFront(solved.weak, strongPalette, variant);

    var strongNodes = buildNodes(solved.strong, variant, lod);
    var weakNodes = buildNodes(solved.weak, variant, lod);

    drawCalmPlexus(strongNodes, strongPalette, variant);
    drawCalmPlexus(weakNodes, weakPalette, variant);
    drawPressurePlexus(weakNodes, strongPalette, variant, lod);

    drawCenter(weakZone, weakPalette, "weak", false);
    drawCenter(strongZone, strongPalette, "strong", true);

    ctx.fillStyle = "rgba(220,232,255,0.88)";
    ctx.font = "12px Consolas, Segoe UI, monospace";
    ctx.textAlign = "left";
    ctx.fillText("Drag zone centers. Pressure front suppresses calm node circles and switches to electric Plexus intersections.", 18, 26);
    ctx.fillText("LOD: " + getLodKey().toUpperCase() + " | variant: " + variant.name + " | gameplay contour = authoritative", 18, 46);
  }

  function updateTexts() {
    var variant = getVariant();
    if (texts.variantTitle) texts.variantTitle.textContent = variant.title;
    if (texts.real) texts.real.textContent = variant.realText;
    if (texts.pressure) texts.pressure.textContent = variant.pressureText;
    if (texts.interaction) texts.interaction.textContent = variant.interactionText;
    if (texts.status) {
      texts.status.textContent =
        "Тяни центры зон мышью. Реальный contour продавливается сильной зоной, а локальный VFX подчеркивает это Plexus-электричеством и вспышками. " +
        "LOD: " + getLodKey().toUpperCase() + ".";
    }
    document.documentElement.style.setProperty("--accent", getPaletteSet().weak.core);
  }

  function frame(now) {
    if (!frame.last) frame.last = now;
    var dt = Math.min(0.033, (now - frame.last) / 1000);
    frame.last = now;
    state.time += dt;
    state.pressurePulse = Math.max(0, state.pressurePulse - dt * 0.7);
    drawScene();
    updateTexts();
    requestAnimationFrame(frame);
  }

  function pointerPos(event) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function pickZone(pos) {
    var names = ["weak", "strong"];
    for (var i = names.length - 1; i >= 0; i -= 1) {
      var z = state.zones[names[i]];
      if (Math.hypot(pos.x - z.x, pos.y - z.y) <= 20) return names[i];
    }
    return null;
  }

  function bind() {
    VARIANTS.forEach(function (variant, index) {
      var opt = document.createElement("option");
      opt.value = String(index);
      opt.textContent = variant.name;
      controls.variantSelect.appendChild(opt);
    });

    controls.variantSelect.addEventListener("change", function () {
      state.variantIndex = Number(controls.variantSelect.value) || 0;
    });
    controls.palette.addEventListener("change", function () {
      state.paletteKey = controls.palette.value;
    });
    controls.lodMode.addEventListener("change", function () {
      state.lodMode = controls.lodMode.value;
    });
    controls.distance.addEventListener("input", function () {
      state.distance = Number(controls.distance.value);
    });
    controls.stress.addEventListener("input", function () {
      state.stress = Number(controls.stress.value);
    });
    controls.pulsePressure.addEventListener("click", function () {
      state.pressurePulse = 1;
    });
    controls.randomizeCenters.addEventListener("click", function () {
      randomizeCenters();
    });
    controls.resetCenters.addEventListener("click", function () {
      resetZones();
    });

    canvas.addEventListener("pointerdown", function (event) {
      var pos = pointerPos(event);
      state.dragging = pickZone(pos);
      if (!state.dragging) return;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", function (event) {
      if (!state.dragging) return;
      var pos = pointerPos(event);
      var zone = state.zones[state.dragging];
      zone.x = clamp(pos.x, 80, canvas.clientWidth - 80);
      zone.y = clamp(pos.y, 80, canvas.clientHeight - 80);
    });
    canvas.addEventListener("pointerup", function () {
      state.dragging = null;
    });
    canvas.addEventListener("pointerleave", function () {
      state.dragging = null;
    });

    window.addEventListener("resize", resize);
  }

  bind();
  resize();
  requestAnimationFrame(frame);
})();
