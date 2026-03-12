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
    stress: document.getElementById("stress"),
    strongPressure: document.getElementById("strongPressure"),
    minRadius: document.getElementById("minRadius"),
    pulsePressure: document.getElementById("pulsePressure"),
    randomizeCenters: document.getElementById("randomizeCenters"),
    resetCenters: document.getElementById("resetCenters")
  };

  var texts = {
    variantTitle: document.getElementById("variantTitle"),
    variantSubtitle: document.getElementById("variantSubtitle"),
    status: document.getElementById("statusLine"),
    real: document.getElementById("legendReal"),
    pressure: document.getElementById("legendPressure"),
    interaction: document.getElementById("legendInteraction")
  };

  var PALETTES = {
    blue: {
      weak:   { core: "#72a4ff", edge: "#96beff", bright: "#eef6ff", shell: "#0b1630", glow: "88,144,255", line: "120,170,255", soft: "24,43,74" },
      strong: { core: "#ff6c7a", edge: "#ffb3bd", bright: "#fff2f4", shell: "#301017", glow: "255,90,110", line: "255,130,150", soft: "74,24,36" }
    },
    green: {
      weak:   { core: "#52c77b", edge: "#94e3ae", bright: "#f2fff6", shell: "#0d2317", glow: "80,198,124", line: "112,214,148", soft: "21,52,35" },
      strong: { core: "#ffb14a", edge: "#ffd89f", bright: "#fff8ef", shell: "#2a1a0d", glow: "255,165,70", line: "255,190,90", soft: "74,46,18" }
    },
    purple: {
      weak:   { core: "#b774ff", edge: "#ddb0ff", bright: "#fdf7ff", shell: "#211331", glow: "186,104,240", line: "204,150,255", soft: "49,28,68" },
      strong: { core: "#60d6dc", edge: "#b4f0f2", bright: "#f4ffff", shell: "#102426", glow: "86,208,214", line: "118,220,228", soft: "24,55,58" }
    },
    amber: {
      weak:   { core: "#e5cb57", edge: "#f2e59b", bright: "#fffdf2", shell: "#2c2610", glow: "224,196,72", line: "235,212,104", soft: "60,54,27" },
      strong: { core: "#90a8d8", edge: "#d9e4ff", bright: "#f7faff", shell: "#151c2b", glow: "126,154,210", line: "176,198,236", soft: "30,38,58" }
    }
  };

  var LOD = {
    near: { samples: 112, shellLayers: 2, rings: 3, markers: true, nodes: 1.0, cracks: 1.0, labels: true },
    mid:  { samples: 74, shellLayers: 1, rings: 2, markers: false, nodes: 0.7, cracks: 0.65, labels: true },
    far:  { samples: 42, shellLayers: 1, rings: 1, markers: false, nodes: 0.35, cracks: 0.25, labels: false }
  };

  var VARIANTS = [
    {
      key: "tactical-bastion",
      name: "01. Tactical Bastion",
      title: "Tactical Bastion",
      subtitle: "Самый близкий к in-game `ZoneRenderer`: real contour стабилен, а visual shell получает тяжелый бастионный clash.",
      realText: "Реальный контур больше не плавает и служит только authoritative pressure shape поверх реальной логики.",
      pressureText: "Теперь конфликт начинается на visual shell: сильная оболочка давит слабую и собирает по фронту короткие бастионные ребра.",
      interactionText: "Базовый production-кандидат, если нужен clean mil-tech и ясная тактическая читаемость.",
      crushMul: 1.04,
      crushBias: 11,
      strongBulge: 4,
      weakAura: 16,
      strongAura: 11,
      shellNoise: 7,
      shellInset: 15,
      shellClashMul: 0.95,
      shellBias: 11,
      shellMinGap: 3,
      strongShellLift: 3,
      calmPulse: 1.2,
      driftAmp: 4,
      driftSpeed: 0.18,
      dashAlpha: 0.22,
      nodeMul: 1.0,
      seamMode: "bastion",
      seamWidth: 1.0,
      crackMul: 0.55,
      spikeMul: 0.20,
      weaveAlpha: 0.04,
      plexusAlpha: 0
    },
    {
      key: "fracture-seam",
      name: "02. Fracture Seam",
      title: "Fracture Seam",
      subtitle: "Более суровый вариант: real contour стабилен, а visual shell ломается и трещит уже на собственном фронте контакта.",
      realText: "Логический радиус не дрейфует и не шумит. Вся живость вынесена в клиентскую оболочку поверх него.",
      pressureText: "Под давлением оболочка дает cracked defensive shell и резко рвется по месту визуального overlap.",
      interactionText: "Хорошо подходит под твой запрос на сильное продавливание и видимый кризис поля.",
      crushMul: 1.16,
      crushBias: 13,
      strongBulge: 5,
      weakAura: 14,
      strongAura: 10,
      shellNoise: 8,
      shellInset: 18,
      shellClashMul: 1.10,
      shellBias: 13,
      shellMinGap: 2,
      strongShellLift: 3,
      calmPulse: 0.8,
      driftAmp: 3,
      driftSpeed: 0.20,
      dashAlpha: 0.18,
      nodeMul: 0.95,
      seamMode: "fracture",
      seamWidth: 1.15,
      crackMul: 1.25,
      spikeMul: 0.28,
      weaveAlpha: 0.08,
      plexusAlpha: 0
    },
    {
      key: "relay-crown",
      name: "03. Relay Crown",
      title: "Relay Crown",
      subtitle: "Тот самый relay-направленный стиль, но теперь корона рождается именно из конфликта visual shell vs visual shell.",
      realText: "Реальный контур держит только pressure geometry. Плавание и relay activity живут уже во внешней оболочке.",
      pressureText: "Когда оболочки встречаются, crown spikes и relay nodes загораются именно на клиентском shell фронте, а не на real contour.",
      interactionText: "Это более зрелищный clean sci-fi вариант без ухода в слишком мягкую плазму.",
      crushMul: 0.98,
      crushBias: 10,
      strongBulge: 4,
      weakAura: 18,
      strongAura: 12,
      shellNoise: 10,
      shellInset: 14,
      shellClashMul: 1.02,
      shellBias: 10,
      shellMinGap: 4,
      strongShellLift: 4,
      calmPulse: 1.8,
      driftAmp: 5,
      driftSpeed: 0.25,
      dashAlpha: 0.24,
      nodeMul: 1.25,
      seamMode: "crown",
      seamWidth: 0.95,
      crackMul: 0.45,
      spikeMul: 1.00,
      weaveAlpha: 0.06,
      plexusAlpha: 0
    },
    {
      key: "plexus-conflict",
      name: "04. Plexus Conflict",
      title: "Plexus Conflict",
      subtitle: "Новый вариант: две visual shell сети сцепляются, дают конфликтующие связи и короткие электрические перебросы при давлении.",
      realText: "Authoritative contour остается спокойным и фиксированным, а клиентские plexus-сети уже конфликтуют поверх него.",
      pressureText: "Когда одна зона давит другую, связи ломаются, перешиваются и коротко переносят напряжение через seam.",
      interactionText: "Это отдельная ветка именно под твой запрос на plexus и конфликтующие связи между зонами.",
      crushMul: 1.06,
      crushBias: 11,
      strongBulge: 5,
      weakAura: 17,
      strongAura: 11,
      shellNoise: 9,
      shellInset: 16,
      shellClashMul: 1.05,
      shellBias: 12,
      shellMinGap: 3,
      strongShellLift: 4,
      calmPulse: 1.5,
      driftAmp: 4,
      driftSpeed: 0.24,
      dashAlpha: 0.22,
      nodeMul: 1.35,
      seamMode: "plexus",
      seamWidth: 1.0,
      crackMul: 0.72,
      spikeMul: 0.18,
      weaveAlpha: 0.10,
      plexusAlpha: 1.0
    },
    {
      key: "siege-weave",
      name: "05. Siege Weave",
      title: "Siege Weave",
      subtitle: "Зона под давлением выглядит как осажденная сеть: real contour стабилен, а visual shell сетка перетягивается к врагу.",
      realText: "Как и в игре, реальный контур остается тактически читаемым. Локальная живость вся вынесена в внешнюю woven shell.",
      pressureText: "Под давлением оболочка не просто мнется, а как будто перетягивается сетью в сторону доминирующей зоны.",
      interactionText: "Компромисс между clean RTS readable и более живым field war поведением.",
      crushMul: 1.10,
      crushBias: 12,
      strongBulge: 6,
      weakAura: 15,
      strongAura: 11,
      shellNoise: 9,
      shellInset: 17,
      shellClashMul: 1.04,
      shellBias: 12,
      shellMinGap: 3,
      strongShellLift: 5,
      calmPulse: 1.0,
      driftAmp: 4,
      driftSpeed: 0.22,
      dashAlpha: 0.20,
      nodeMul: 1.05,
      seamMode: "siege",
      seamWidth: 1.05,
      crackMul: 0.82,
      spikeMul: 0.24,
      weaveAlpha: 0.18,
      plexusAlpha: 0
    },
    {
      key: "null-front",
      name: "06. Null Front",
      title: "Null Front",
      subtitle: "Самый агрессивный вариант: visual shell почти стирается в точке давления и жмется к real contour.",
      realText: "Здесь больше всего чувствуется жесткая logical pressure base из `stepCities()` без лишнего плавания real radius.",
      pressureText: "Фронт контакта становится почти белым разрывом, а слабая оболочка буквально теряет внешний зазор.",
      interactionText: "Лучше всего показывает момент, где одна зона буквально сильно продавила внешний visual shell другой.",
      crushMul: 1.30,
      crushBias: 14,
      strongBulge: 7,
      weakAura: 12,
      strongAura: 10,
      shellNoise: 5,
      shellInset: 22,
      shellClashMul: 1.22,
      shellBias: 14,
      shellMinGap: 1,
      strongShellLift: 6,
      calmPulse: 0.5,
      driftAmp: 2,
      driftSpeed: 0.16,
      dashAlpha: 0.28,
      nodeMul: 0.80,
      seamMode: "null",
      seamWidth: 1.25,
      crackMul: 0.48,
      spikeMul: 0.10,
      weaveAlpha: 0.03,
      plexusAlpha: 0
    }
  ];

  var state = {
    time: 0,
    variantIndex: 2,
    paletteKey: controls.palette.value,
    lodMode: controls.lodMode.value,
    stress: Number(controls.stress.value),
    strongPressure: Number(controls.strongPressure.value),
    minRadiusPct: Number(controls.minRadius.value),
    pressurePulse: 0,
    dragging: null,
    zones: null
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(a, b, x) {
    if (a === b) return x >= b ? 1 : 0;
    var t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
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
      Math.sin(angle * 2.8 + time * 1.15 + seed * 0.17) * 0.55 +
      Math.cos(angle * 5.2 - time * 0.76 + seed * 0.31) * 0.30 +
      Math.sin(angle * 9.3 + time * 0.38 + seed * 0.08) * 0.15
    );
  }

  function pointInPolygon(x, y, poly) {
    var inside = false;
    if (!poly || poly.length < 3) return false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i].x;
      var yi = poly[i].y;
      var xj = poly[j].x;
      var yj = poly[j].y;
      var intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-6) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function getVariant() {
    return VARIANTS[state.variantIndex] || VARIANTS[0];
  }

  function getPaletteSet() {
    return PALETTES[state.paletteKey] || PALETTES.blue;
  }

  function getLodKey() {
    if (state.lodMode !== "auto") return state.lodMode;
    if (state.stress > 76) return "far";
    if (state.stress > 42) return "mid";
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
    var base = Math.min(width, height);
    state.zones = {
      weak: {
        id: "weak",
        x: width * 0.40,
        y: height * 0.60,
        radius: base * 0.20,
        pressureWeight: 86,
        seed: 21
      },
      strong: {
        id: "strong",
        x: width * 0.68,
        y: height * 0.43,
        radius: base * 0.27,
        pressureWeight: state.strongPressure,
        seed: 83
      }
    };
  }

  function randomizeCenters() {
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    state.zones.weak.x = width * (0.26 + seeded(state.time * 17.1) * 0.26);
    state.zones.weak.y = height * (0.44 + seeded(state.time * 21.2) * 0.24);
    state.zones.strong.x = width * (0.54 + seeded(state.time * 31.4) * 0.22);
    state.zones.strong.y = height * (0.26 + seeded(state.time * 27.3) * 0.26);
  }

  function drawBackdrop(width, height, weakPalette) {
    ctx.clearRect(0, 0, width, height);

    var rgb = hexToRgb(weakPalette.core);
    var bg = ctx.createRadialGradient(width * 0.5, height * 0.18, 0, width * 0.5, height * 0.18, Math.max(width, height) * 0.92);
    bg.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.13)");
    bg.addColorStop(0.38, "rgba(8,13,25,0.78)");
    bg.addColorStop(1, "rgba(3,6,10,0.98)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    for (var i = 0; i < 170; i += 1) {
      var sx = seeded(i * 1.31) * width;
      var sy = seeded(i * 3.17) * height;
      var pulse = 0.70 + 0.30 * Math.sin(state.time * (0.25 + seeded(i * 5.7)) + i);
      ctx.fillStyle = "rgba(220,232,255," + (0.08 + seeded(i * 4.1) * 0.18 * pulse).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(sx, sy, 0.7 + seeded(i * 2.3) * 1.7, 0, TAU);
      ctx.fill();
    }

    ctx.save();
    ctx.strokeStyle = rgbaRgb(weakPalette.line, 0.045);
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

  function buildBaseSamples(zone, count, variant) {
    var samples = [];
    var total = 0;
    for (var i = 0; i < count; i += 1) {
      var angle = (i / count) * TAU;
      var baseShape = 1
        + Math.sin(angle * 2 + zone.seed * 0.03) * 0.07
        + Math.cos(angle * 3 - zone.seed * 0.01) * 0.05
        + Math.sin(angle * 5 + zone.seed * 0.05) * 0.025;
      // Real contour stays stable; only the shell layer floats and fights.
      var radius = zone.radius * baseShape;
      total += radius;
      samples.push({
        angle: angle,
        baseR: radius,
        realPressure: 0,
        shellPressure: 0,
        pressure: 0,
        crush: 0,
        shellCrush: 0,
        nx: Math.cos(angle),
        ny: Math.sin(angle),
        tangentX: -Math.sin(angle),
        tangentY: Math.cos(angle),
        realR: radius,
        realX: zone.x + Math.cos(angle) * radius,
        realY: zone.y + Math.sin(angle) * radius,
        shellBaseR: radius,
        shellR: radius,
        shellX: zone.x + Math.cos(angle) * radius,
        shellY: zone.y + Math.sin(angle) * radius
      });
    }
    zone.avgRadius = total / Math.max(1, count);
    return samples;
  }

  function extractPoints(samples, keyX, keyY) {
    var pts = [];
    for (var i = 0; i < samples.length; i += 1) {
      pts.push({ x: samples[i][keyX], y: samples[i][keyY] });
    }
    return pts;
  }

  function applyJellySpread(samples, radiusKey, pressureKey, minFn, maxFn, dragMul) {
    var count = samples.length;
    var nextValues = new Array(count);
    for (var i = 0; i < count; i += 1) {
      var prev = samples[(i - 1 + count) % count];
      var cur = samples[i];
      var next = samples[(i + 1) % count];
      var pressure = cur[pressureKey] || 0;
      var neighborPressure = ((prev[pressureKey] || 0) + (next[pressureKey] || 0)) * 0.5;
      var blended = cur[radiusKey] * 0.54 + prev[radiusKey] * 0.23 + next[radiusKey] * 0.23;
      var jellyDent = (pressure * 0.68 + neighborPressure * 0.32) * dragMul;
      var target = Math.min(cur[radiusKey], blended - jellyDent);
      nextValues[i] = clamp(target, minFn(cur), maxFn(cur));
    }
    for (var j = 0; j < count; j += 1) samples[j][radiusKey] = nextValues[j];
  }

  function solveContours(weakZone, strongZone, variant, lod) {
    var strongBase = buildBaseSamples(strongZone, lod.samples, variant);
    var weakBase = buildBaseSamples(weakZone, lod.samples, variant);
    var strongPressure = state.strongPressure * (1 + state.pressurePulse * 0.25);
    var weakPressure = weakZone.pressureWeight;
    var pushRatio = strongPressure / (strongPressure + weakPressure + 1);
    var minR = weakZone.radius * (state.minRadiusPct * 0.01);
    var stoneForce = Math.pow(pushRatio, 0.60) * (1.05 + state.strongPressure / 260);
    var jellyStress = 0.95 + state.stress * 0.010;
    var pass;
    var i;

    for (pass = 0; pass < 2; pass += 1) {
      var strongPts = extractPoints(strongBase, "realX", "realY");

      for (i = 0; i < weakBase.length; i += 1) {
        var sWeak = weakBase[i];
        var evalR = pass === 0 ? sWeak.baseR : sWeak.realR;
        var ex = weakZone.x + sWeak.nx * evalR;
        var ey = weakZone.y + sWeak.ny * evalR;
        var dx = strongZone.x - ex;
        var dy = strongZone.y - ey;
        var dist = Math.hypot(dx, dy) || 1;
        var dirX = dx / dist;
        var dirY = dy / dist;
        var facing = clamp(sWeak.nx * dirX + sWeak.ny * dirY, 0, 1);
        var proximity = smoothstep(strongZone.avgRadius + weakZone.avgRadius * 0.55, strongZone.avgRadius * 0.48, dist);
        var inside = pointInPolygon(ex, ey, strongPts);
        var contactCore = proximity * Math.pow(facing, 2.55);
        var pressure = proximity * Math.pow(facing, 1.45);
        if (inside) pressure = Math.max(pressure, 0.28 + proximity * 0.72);
        pressure = Math.max(pressure, contactCore);
        pressure *= 0.78 + state.pressurePulse * 0.22;

        var penetration = inside ? Math.max(0, strongZone.avgRadius - dist + 16) : Math.max(0, strongZone.avgRadius * 0.88 - dist);
        var crush =
          penetration * 1.55 * stoneForce * variant.crushMul +
          pressure * variant.crushBias * 1.6 +
          contactCore * (18 + state.strongPressure * 0.06) * jellyStress;
        var targetR = clamp(evalR - crush, minR, sWeak.baseR);
        var smoothFactor = inside ? 0.36 : 0.18;
        sWeak.realR = clamp(lerp(evalR, targetR, smoothFactor), minR, sWeak.baseR + 6);
        sWeak.realX = weakZone.x + sWeak.nx * sWeak.realR;
        sWeak.realY = weakZone.y + sWeak.ny * sWeak.realR;
        sWeak.realPressure = clamp((sWeak.baseR - sWeak.realR) / Math.max(1, sWeak.baseR - minR), 0, 1);
        sWeak.crush = sWeak.baseR - sWeak.realR;
      }

      var weakPts = extractPoints(weakBase, "realX", "realY");
      for (i = 0; i < strongBase.length; i += 1) {
        var sStrong = strongBase[i];
        var sx = strongZone.x + sStrong.nx * sStrong.baseR;
        var sy = strongZone.y + sStrong.ny * sStrong.baseR;
        var sdx = weakZone.x - sx;
        var sdy = weakZone.y - sy;
        var sdist = Math.hypot(sdx, sdy) || 1;
        var sfacing = clamp(sStrong.nx * (sdx / sdist) + sStrong.ny * (sdy / sdist), 0, 1);
        var sprox = smoothstep(weakZone.avgRadius + strongZone.avgRadius * 0.34, weakZone.avgRadius * 0.58, sdist);
        var sinside = pointInPolygon(sx, sy, weakPts);
        var bulge = sprox * sfacing * variant.strongBulge * (sinside ? 1.25 : 0.85);
        sStrong.realR = sStrong.baseR + bulge;
        sStrong.realX = strongZone.x + sStrong.nx * sStrong.realR;
        sStrong.realY = strongZone.y + sStrong.ny * sStrong.realR;
      }
    }

    applyJellySpread(
      weakBase,
      "realR",
      "realPressure",
      function () { return minR; },
      function (sample) { return sample.baseR; },
      (7 + state.strongPressure * 0.035) * jellyStress
    );
    for (i = 0; i < weakBase.length; i += 1) {
      weakBase[i].realX = weakZone.x + weakBase[i].nx * weakBase[i].realR;
      weakBase[i].realY = weakZone.y + weakBase[i].ny * weakBase[i].realR;
      weakBase[i].realPressure = clamp((weakBase[i].baseR - weakBase[i].realR) / Math.max(1, weakBase[i].baseR - minR), 0, 1);
    }

    for (i = 0; i < strongBase.length; i += 1) {
      var strongNoise = layeredNoise(strongZone.seed + 13, strongBase[i].angle, state.time * 0.82);
      var strongPulse = Math.sin(state.time * (variant.driftSpeed * 2.4) + strongBase[i].angle * 4.0 + strongZone.seed) * variant.calmPulse * 0.55;
      strongBase[i].shellBaseR = strongBase[i].realR + variant.strongAura + strongNoise * variant.shellNoise * 0.48 + strongPulse;
      strongBase[i].shellR = strongBase[i].shellBaseR;
      strongBase[i].shellX = strongZone.x + strongBase[i].nx * strongBase[i].shellR;
      strongBase[i].shellY = strongZone.y + strongBase[i].ny * strongBase[i].shellR;
    }

    for (i = 0; i < weakBase.length; i += 1) {
      var weakNoise = layeredNoise(weakZone.seed + 17, weakBase[i].angle, state.time * (0.96 + variant.weaveAlpha));
      var calmPulse = Math.sin(state.time * 1.8 + weakBase[i].angle * 4.0) * variant.calmPulse;
      var offset = variant.weakAura + weakNoise * variant.shellNoise + calmPulse;
      weakBase[i].shellBaseR = Math.max(weakBase[i].realR + variant.shellMinGap, weakBase[i].realR + offset);
      weakBase[i].shellR = weakBase[i].shellBaseR;
      weakBase[i].shellX = weakZone.x + weakBase[i].nx * weakBase[i].shellR;
      weakBase[i].shellY = weakZone.y + weakBase[i].ny * weakBase[i].shellR;
    }

    for (pass = 0; pass < 2; pass += 1) {
      var strongShellPts = extractPoints(strongBase, "shellX", "shellY");

      for (i = 0; i < weakBase.length; i += 1) {
        var shellWeak = weakBase[i];
        var evalShellR = pass === 0 ? shellWeak.shellBaseR : shellWeak.shellR;
        var shellX = weakZone.x + shellWeak.nx * evalShellR;
        var shellY = weakZone.y + shellWeak.ny * evalShellR;
        var shellDx = strongZone.x - shellX;
        var shellDy = strongZone.y - shellY;
        var shellDist = Math.hypot(shellDx, shellDy) || 1;
        var shellDirX = shellDx / shellDist;
        var shellDirY = shellDy / shellDist;
        var shellFacing = clamp(shellWeak.nx * shellDirX + shellWeak.ny * shellDirY, 0, 1);
        var shellReach = strongZone.avgRadius + variant.strongAura + weakZone.avgRadius * 0.32 + variant.weakAura * 0.25;
        var shellProximity = smoothstep(shellReach, strongZone.avgRadius * 0.64, shellDist);
        var shellInside = pointInPolygon(shellX, shellY, strongShellPts);
        var shellCore = shellProximity * Math.pow(shellFacing, 2.35);
        var shellPressure = shellProximity * Math.pow(shellFacing, 1.38);
        if (shellInside) shellPressure = Math.max(shellPressure, 0.34 + shellProximity * 0.66);
        shellPressure = Math.max(shellPressure, shellCore);
        shellPressure *= 0.86 + state.pressurePulse * 0.18;

        var shellPenetration = shellInside
          ? Math.max(0, strongZone.avgRadius + variant.strongAura - shellDist + 14)
          : Math.max(0, strongZone.avgRadius + variant.strongAura * 0.42 - shellDist);
        var shellCrush =
          shellPenetration * 1.85 * stoneForce * variant.shellClashMul +
          shellPressure * variant.shellBias * 1.8 +
          shellCore * (22 + state.strongPressure * 0.08) * jellyStress;
        var minShellR = shellWeak.realR + variant.shellMinGap;
        var shellTarget = clamp(evalShellR - shellCrush, minShellR, shellWeak.shellBaseR + 4);
        var shellSmooth = shellInside ? 0.42 : 0.22;
        shellWeak.shellR = clamp(lerp(evalShellR, shellTarget, shellSmooth), minShellR, shellWeak.shellBaseR + 4);
        shellWeak.shellX = weakZone.x + shellWeak.nx * shellWeak.shellR;
        shellWeak.shellY = weakZone.y + shellWeak.ny * shellWeak.shellR;
        shellWeak.shellCrush = shellWeak.shellBaseR - shellWeak.shellR;
        shellWeak.shellPressure = clamp(
          (shellWeak.shellBaseR - shellWeak.shellR) / Math.max(1, shellWeak.shellBaseR - minShellR),
          0,
          1
        );
        shellWeak.pressure = Math.max(shellWeak.realPressure * 0.65, shellWeak.shellPressure);
      }

      var weakShellPts = extractPoints(weakBase, "shellX", "shellY");
      for (i = 0; i < strongBase.length; i += 1) {
        var shellStrong = strongBase[i];
        var strongEvalShell = pass === 0 ? shellStrong.shellBaseR : shellStrong.shellR;
        var strongShellX = strongZone.x + shellStrong.nx * strongEvalShell;
        var strongShellY = strongZone.y + shellStrong.ny * strongEvalShell;
        var clashDx = weakZone.x - strongShellX;
        var clashDy = weakZone.y - strongShellY;
        var clashDist = Math.hypot(clashDx, clashDy) || 1;
        var clashFacing = clamp(shellStrong.nx * (clashDx / clashDist) + shellStrong.ny * (clashDy / clashDist), 0, 1);
        var clashProx = smoothstep(weakZone.avgRadius + variant.weakAura + 8, weakZone.avgRadius * 0.62, clashDist);
        var shellOverlap = pointInPolygon(strongShellX, strongShellY, weakShellPts);
        var shellLift = clashProx * clashFacing * variant.strongShellLift * (shellOverlap ? 1.2 : 0.7);
        shellStrong.shellR = shellStrong.shellBaseR + shellLift;
        shellStrong.shellX = strongZone.x + shellStrong.nx * shellStrong.shellR;
        shellStrong.shellY = strongZone.y + shellStrong.ny * shellStrong.shellR;
      }
    }

    applyJellySpread(
      weakBase,
      "shellR",
      "shellPressure",
      function (sample) { return sample.realR + variant.shellMinGap; },
      function (sample) { return sample.shellBaseR + 2; },
      (9 + state.strongPressure * 0.045) * jellyStress
    );
    for (i = 0; i < weakBase.length; i += 1) {
      var shellMinR = weakBase[i].realR + variant.shellMinGap;
      weakBase[i].shellR = clamp(weakBase[i].shellR, shellMinR, weakBase[i].shellBaseR + 2);
      weakBase[i].shellX = weakZone.x + weakBase[i].nx * weakBase[i].shellR;
      weakBase[i].shellY = weakZone.y + weakBase[i].ny * weakBase[i].shellR;
      weakBase[i].shellCrush = weakBase[i].shellBaseR - weakBase[i].shellR;
      weakBase[i].shellPressure = clamp(
        (weakBase[i].shellBaseR - weakBase[i].shellR) / Math.max(1, weakBase[i].shellBaseR - shellMinR),
        0,
        1
      );
      weakBase[i].pressure = Math.max(weakBase[i].realPressure * 0.72, weakBase[i].shellPressure);
    }

    return {
      weak: weakBase,
      strong: strongBase,
      minR: minR,
      pushRatio: pushRatio
    };
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
    fill.addColorStop(0, rgbaRgb(palette.glow, 0.11 * alphaMul));
    fill.addColorStop(0.58, rgbaRgb(palette.glow, 0.03 * alphaMul));
    fill.addColorStop(1, rgbaRgb(palette.glow, 0));
    pathSmooth(points);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawCoverageBand(points, palette, alphaMul) {
    pathSmooth(points);
    ctx.strokeStyle = rgbaRgb(palette.glow, 0.10 * alphaMul);
    ctx.lineWidth = 16;
    ctx.stroke();

    pathSmooth(points);
    ctx.strokeStyle = rgba(palette.edge, 0.065 * alphaMul);
    ctx.lineWidth = 9;
    ctx.stroke();
  }

  function scaledPoints(points, cx, cy, scale) {
    var out = [];
    for (var i = 0; i < points.length; i += 1) {
      out.push({
        x: cx + (points[i].x - cx) * scale,
        y: cy + (points[i].y - cy) * scale
      });
    }
    return out;
  }

  function drawInnerRings(points, zone, palette, lod, alphaMul) {
    var ringScales = [0.70, 0.84, 0.93];
    var ringAlphas = [0.020, 0.032, 0.048];
    var ringWidths = [1.0, 1.3, 1.7];
    var count = Math.min(lod.rings, ringScales.length);
    for (var i = 0; i < count; i += 1) {
      var ringPts = scaledPoints(points, zone.x, zone.y, ringScales[i]);
      pathSmooth(ringPts);
      ctx.strokeStyle = rgba(palette.edge, ringAlphas[i] * alphaMul);
      ctx.lineWidth = ringWidths[i];
      ctx.stroke();
    }
  }

  function drawRadialMarkers(points, zone, palette, lod) {
    if (!lod.markers) return;
    var markerRing = scaledPoints(points, zone.x, zone.y, 0.88);
    var step = Math.max(5, Math.floor(markerRing.length / 16));
    ctx.strokeStyle = rgba(palette.edge, 0.09);
    ctx.lineWidth = 1;
    for (var i = 0; i < markerRing.length; i += step) {
      var p = markerRing[i];
      var dx = p.x - zone.x;
      var dy = p.y - zone.y;
      var dl = Math.hypot(dx, dy) || 1;
      var nx = dx / dl;
      var ny = dy / dl;
      ctx.beginPath();
      ctx.moveTo(p.x - nx * 5, p.y - ny * 5);
      ctx.lineTo(p.x + nx * 5, p.y + ny * 5);
      ctx.stroke();
    }
  }

  function drawDashedEdge(points, palette, variant) {
    pathSmooth(points);
    ctx.strokeStyle = rgbaRgb(palette.glow, variant.dashAlpha);
    ctx.lineWidth = 1.45;
    ctx.setLineDash([9, 7]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawSensorNodes(samples, palette, lod, variant) {
    var desired = Math.max(4, Math.round(14 * variant.nodeMul * lod.nodes));
    var step = Math.max(1, Math.floor(samples.length / desired));
    for (var i = 0; i < samples.length; i += step) {
      var s = samples[i];
      var alpha = 0.08 + (1 - s.pressure) * 0.05;
      var size = 1.8 + s.pressure * 1.6;
      var nx = s.nx * size;
      var ny = s.ny * size;
      var tx = s.tangentX * size * 0.7;
      var ty = s.tangentY * size * 0.7;

      ctx.beginPath();
      ctx.moveTo(s.shellX + nx, s.shellY + ny);
      ctx.lineTo(s.shellX + tx, s.shellY + ty);
      ctx.lineTo(s.shellX - nx, s.shellY - ny);
      ctx.lineTo(s.shellX - tx, s.shellY - ty);
      ctx.closePath();
      ctx.fillStyle = rgbaRgb(palette.glow, alpha);
      ctx.fill();
    }
  }

  function drawWeave(samples, palette, variant) {
    if (variant.weaveAlpha <= 0.01) return;
    var step = Math.max(2, Math.floor(samples.length / 18));
    for (var i = 0; i < samples.length; i += step) {
      var s = samples[i];
      var swing = Math.sin(state.time * 2.0 + s.angle * 4.6) * 14;
      var endX = s.shellX + s.tangentX * 24 + s.nx * swing * 0.24;
      var endY = s.shellY + s.tangentY * 24 + s.ny * swing * 0.24;
      var ctrlX = s.shellX + s.tangentX * 12 + s.nx * swing * 0.8;
      var ctrlY = s.shellY + s.tangentY * 12 + s.ny * swing * 0.8;
      ctx.beginPath();
      ctx.moveTo(s.shellX, s.shellY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
      ctx.strokeStyle = rgbaRgb(palette.line, variant.weaveAlpha);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawElectricLine(x0, y0, x1, y1, palette, alpha, jitterAmp) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    var dx = x1 - x0;
    var dy = y1 - y0;
    var len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len;
    var ny = dx / len;
    var steps = 4;
    for (var s = 1; s < steps; s += 1) {
      var t = s / steps;
      var jitter = Math.sin(state.time * 24 + t * 18 + x0 * 0.01 + y0 * 0.01) * jitterAmp;
      ctx.lineTo(x0 + dx * t + nx * jitter, y0 + dy * t + ny * jitter);
    }
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = rgbaRgb(palette.glow, alpha);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = rgba(palette.bright, alpha * 0.45);
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  function drawPlexusConflict(weakSamples, strongSamples, weakPalette, strongPalette, variant, lod) {
    if (variant.seamMode !== "plexus") return;
    var step = Math.max(1, Math.floor(weakSamples.length / Math.max(10, 18 * lod.nodes)));
    for (var i = 0; i < weakSamples.length; i += step) {
      var weakNode = weakSamples[i];
      if (weakNode.pressure <= 0.12) continue;

      var nextWeak = weakSamples[(i + step) % weakSamples.length];
      drawElectricLine(
        weakNode.shellX,
        weakNode.shellY,
        nextWeak.shellX,
        nextWeak.shellY,
        weakPalette,
        0.10 + weakNode.pressure * 0.16,
        3
      );

      var strongNode = strongSamples[i % strongSamples.length];
      var dist = Math.hypot(strongNode.shellX - weakNode.shellX, strongNode.shellY - weakNode.shellY);
      if (dist > 120) continue;

      drawElectricLine(
        weakNode.shellX,
        weakNode.shellY,
        strongNode.shellX,
        strongNode.shellY,
        strongPalette,
        0.12 + weakNode.pressure * 0.20,
        5
      );

      var midX = (weakNode.shellX + strongNode.shellX) * 0.5;
      var midY = (weakNode.shellY + strongNode.shellY) * 0.5;
      ctx.beginPath();
      ctx.arc(midX, midY, 3 + weakNode.pressure * 5, 0, TAU);
      ctx.fillStyle = rgba(strongPalette.bright, 0.08 + weakNode.pressure * 0.10);
      ctx.fill();
    }
  }

  function drawPressureBands(samples, palette, strongPalette) {
    for (var i = 0; i < samples.length; i += 1) {
      var s = samples[i];
      if (s.pressure <= 0.08) continue;
      ctx.beginPath();
      ctx.arc(s.realX, s.realY, 7 + s.pressure * 17, s.angle - 0.52, s.angle + 0.52);
      ctx.strokeStyle = rgba(strongPalette.bright, 0.10 + s.pressure * 0.18);
      ctx.lineWidth = 2.2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(s.realX, s.realY, 3 + s.pressure * 7, s.angle - 0.35, s.angle + 0.35);
      ctx.strokeStyle = rgba(palette.edge, 0.08 + s.pressure * 0.08);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawSeamSegment(node, next, palette, strongPalette, variant, lod) {
    var alpha = (0.10 + node.pressure * 0.24) * lod.cracks;
    var tAlpha = alpha * (0.9 + Math.sin(state.time * 6 + node.angle * 12) * 0.1);
    var len = 10 + node.pressure * 12;
    var ix = node.shellX - node.nx * (len * 0.55);
    var iy = node.shellY - node.ny * (len * 0.55);
    var ox = node.shellX + node.nx * len;
    var oy = node.shellY + node.ny * len;

    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.lineTo(node.shellX, node.shellY);
    ctx.lineTo(ox, oy);
    ctx.strokeStyle = rgbaRgb(strongPalette.glow, tAlpha);
    ctx.lineWidth = 1.3 * variant.seamWidth;
    ctx.stroke();

    if (variant.seamMode === "fracture" || variant.seamMode === "siege") {
      var cross = 5 + node.pressure * 8 * variant.crackMul;
      ctx.beginPath();
      ctx.moveTo(node.shellX - node.tangentX * cross, node.shellY - node.tangentY * cross);
      ctx.lineTo(node.shellX + node.tangentX * cross, node.shellY + node.tangentY * cross);
      ctx.strokeStyle = rgba(palette.bright, 0.06 + node.pressure * 0.10);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (variant.seamMode === "bastion") {
      var brace = 4 + node.pressure * 7;
      ctx.beginPath();
      ctx.moveTo(node.shellX - node.tangentX * brace, node.shellY - node.tangentY * brace);
      ctx.lineTo(node.shellX - node.tangentX * brace * 0.2 - node.nx * 6, node.shellY - node.tangentY * brace * 0.2 - node.ny * 6);
      ctx.lineTo(node.shellX + node.tangentX * brace, node.shellY + node.tangentY * brace);
      ctx.strokeStyle = rgbaRgb(strongPalette.line, 0.10 + node.pressure * 0.12);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    if (variant.seamMode === "crown") {
      var spike = (8 + node.pressure * 12) * variant.spikeMul;
      ctx.beginPath();
      ctx.moveTo(node.shellX, node.shellY);
      ctx.lineTo(node.shellX + node.nx * spike, node.shellY + node.ny * spike);
      ctx.strokeStyle = rgba(palette.bright, 0.14 + node.pressure * 0.18);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    if (variant.seamMode === "siege" && next) {
      ctx.beginPath();
      ctx.moveTo(node.shellX, node.shellY);
      ctx.quadraticCurveTo(
        (node.shellX + next.shellX) * 0.5 + node.nx * 8,
        (node.shellY + next.shellY) * 0.5 + node.ny * 8,
        next.shellX,
        next.shellY
      );
      ctx.strokeStyle = rgbaRgb(palette.line, 0.08 + node.pressure * 0.12);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawCrushSeam(samples, palette, strongPalette, variant, lod) {
    var step = Math.max(1, Math.floor(samples.length / 28));
    for (var i = 0; i < samples.length; i += step) {
      var node = samples[i];
      if (node.pressure <= 0.12) continue;
      var next = samples[(i + step) % samples.length];
      drawSeamSegment(node, next, palette, strongPalette, variant, lod);
    }
  }

  function drawHotspot(samples, strongPalette, variant) {
    var hotspot = null;
    for (var i = 0; i < samples.length; i += 1) {
      if (!hotspot || samples[i].pressure > hotspot.pressure) hotspot = samples[i];
    }
    if (!hotspot || hotspot.pressure <= 0.06) return;

    var r = 16 + hotspot.pressure * 30;
    var grad = ctx.createRadialGradient(hotspot.shellX, hotspot.shellY, 0, hotspot.shellX, hotspot.shellY, r);
    grad.addColorStop(0, rgba(strongPalette.bright, 0.18 + hotspot.pressure * 0.14));
    grad.addColorStop(0.40, rgbaRgb(strongPalette.glow, 0.11 + hotspot.pressure * 0.10));
    grad.addColorStop(1, rgbaRgb(strongPalette.glow, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(hotspot.shellX, hotspot.shellY, r, 0, TAU);
    ctx.fill();

    if (variant.seamMode === "null") {
      ctx.beginPath();
      ctx.arc(hotspot.shellX, hotspot.shellY, 10 + hotspot.pressure * 18, hotspot.angle - 1.0, hotspot.angle + 1.0);
      ctx.strokeStyle = rgba(strongPalette.bright, 0.26 + hotspot.pressure * 0.16);
      ctx.lineWidth = 3.5;
      ctx.stroke();
    }
  }

  function drawShell(points, palette, alphaMul) {
    pathSmooth(points);
    ctx.strokeStyle = rgbaRgb(palette.glow, 0.12 * alphaMul);
    ctx.lineWidth = 7;
    ctx.stroke();

    pathSmooth(points);
    ctx.strokeStyle = rgba(palette.bright, 0.18 * alphaMul);
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function drawCenter(zone, palette, label, isStrong, lod) {
    if (!lod.labels) return;
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

    ctx.fillStyle = "rgba(220,232,255,0.88)";
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
    strongZone.pressureWeight = state.strongPressure;

    drawBackdrop(width, height, weakPalette);

    var solved = solveContours(weakZone, strongZone, variant, lod);
    var weakRealPts = extractPoints(solved.weak, "realX", "realY");
    var strongRealPts = extractPoints(solved.strong, "realX", "realY");
    var weakShellPts = extractPoints(solved.weak, "shellX", "shellY");
    var strongShellPts = extractPoints(solved.strong, "shellX", "shellY");

    drawZoneFill(strongRealPts, strongPalette, 0.88);
    drawZoneFill(weakRealPts, weakPalette, 1.0);

    drawCoverageBand(strongRealPts, strongPalette, 0.80);
    drawCoverageBand(weakRealPts, weakPalette, 1.0);

    for (var layer = 0; layer < lod.shellLayers; layer += 1) {
      drawShell(strongShellPts, strongPalette, 0.84 - layer * 0.16);
      drawShell(weakShellPts, weakPalette, 1.0 - layer * 0.14);
    }

    drawInnerRings(strongRealPts, strongZone, strongPalette, lod, 0.9);
    drawInnerRings(weakRealPts, weakZone, weakPalette, lod, 1.0);
    drawRadialMarkers(strongRealPts, strongZone, strongPalette, lod);
    drawRadialMarkers(weakRealPts, weakZone, weakPalette, lod);

    drawDashedEdge(strongShellPts, strongPalette, variant);
    drawDashedEdge(weakShellPts, weakPalette, variant);
    drawSensorNodes(solved.strong, strongPalette, lod, variant);
    drawSensorNodes(solved.weak, weakPalette, lod, variant);
    drawWeave(solved.strong, strongPalette, variant);
    drawWeave(solved.weak, weakPalette, variant);
    drawPressureBands(solved.weak, weakPalette, strongPalette);
    drawCrushSeam(solved.weak, weakPalette, strongPalette, variant, lod);
    drawPlexusConflict(solved.weak, solved.strong, weakPalette, strongPalette, variant, lod);
    drawHotspot(solved.weak, strongPalette, variant);

    drawCenter(weakZone, weakPalette, "weak", false, lod);
    drawCenter(strongZone, strongPalette, "strong", true, lod);

    ctx.fillStyle = "rgba(220,232,255,0.88)";
    ctx.font = "12px Consolas, Segoe UI, monospace";
    ctx.textAlign = "left";
    ctx.fillText("Real contour is stable and authoritative. Visual shells float above it and now clash against each other directly.", 18, 26);
    ctx.fillText("LOD: " + getLodKey().toUpperCase() + " | style: " + variant.name + " | weak min radius: " + state.minRadiusPct + "% | strong pressure: " + state.strongPressure, 18, 46);
  }

  function updateTexts() {
    var variant = getVariant();
    if (texts.variantTitle) texts.variantTitle.textContent = variant.title;
    if (texts.variantSubtitle) texts.variantSubtitle.textContent = variant.subtitle;
    if (texts.real) texts.real.textContent = variant.realText;
    if (texts.pressure) texts.pressure.textContent = variant.pressureText;
    if (texts.interaction) texts.interaction.textContent = variant.interactionText;
    if (texts.status) {
      texts.status.textContent =
        "Теперь real contour стабилен, а отдельно visual shell конфликтует с visual shell другой зоны: shell overlap -> shell crush -> seam / plexus response. " +
        "Сейчас активен стиль `" + variant.title + "` и LOD `" + getLodKey().toUpperCase() + "`.";
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
    var keys = ["weak", "strong"];
    for (var i = keys.length - 1; i >= 0; i -= 1) {
      var zone = state.zones[keys[i]];
      if (Math.hypot(pos.x - zone.x, pos.y - zone.y) <= 20) return keys[i];
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
    controls.variantSelect.value = String(state.variantIndex);

    controls.variantSelect.addEventListener("change", function () {
      state.variantIndex = Number(controls.variantSelect.value) || 0;
    });
    controls.palette.addEventListener("change", function () {
      state.paletteKey = controls.palette.value;
    });
    controls.lodMode.addEventListener("change", function () {
      state.lodMode = controls.lodMode.value;
    });
    controls.stress.addEventListener("input", function () {
      state.stress = Number(controls.stress.value);
    });
    controls.strongPressure.addEventListener("input", function () {
      state.strongPressure = Number(controls.strongPressure.value);
    });
    controls.minRadius.addEventListener("input", function () {
      state.minRadiusPct = Number(controls.minRadius.value);
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
