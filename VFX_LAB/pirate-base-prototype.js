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
    threat: document.getElementById("threat"),
    frigateCount: document.getElementById("frigateCount"),
    drift: document.getElementById("drift"),
    cycleVariant: document.getElementById("cycleVariant"),
    shufflePalette: document.getElementById("shufflePalette"),
    frigateBurst: document.getElementById("frigateBurst")
  };

  var texts = {
    title: document.getElementById("variantTitle"),
    status: document.getElementById("statusLine"),
    variants: document.getElementById("legendVariants"),
    frigate: document.getElementById("legendFrigate"),
    scene: document.getElementById("legendScene")
  };

  var PALETTES = {
    teal:   { core: "#6ce0d2", edge: "#d7fffb", bright: "#f3fffd", shell: "#07161c", hull: "#12363d", trim: "#7bf0e2", glow: "108,224,210", line: "159,247,238" },
    amber:  { core: "#ffb968", edge: "#ffe8c5", bright: "#fffaf1", shell: "#231708", hull: "#5f3a16", trim: "#ffd08d", glow: "255,185,104", line: "255,223,172" },
    violet: { core: "#c198ff", edge: "#f0e4ff", bright: "#fbf8ff", shell: "#150e25", hull: "#40296d", trim: "#d8b8ff", glow: "193,152,255", line: "227,202,255" },
    red:    { core: "#ff7b89", edge: "#ffe0e6", bright: "#fff7f8", shell: "#210f15", hull: "#5f2132", trim: "#ff9aa8", glow: "255,123,137", line: "255,188,197" },
    green:  { core: "#75dd96", edge: "#e2ffea", bright: "#f8fffb", shell: "#0a1810", hull: "#1b4d31", trim: "#91f0af", glow: "117,221,150", line: "182,247,201" }
  };

  var VARIANTS = [
    {
      key: "shard-bastion",
      name: "Shard Bastion",
      note: "Собранная из обломков крепость: острые ребра, щитовые пластины, тяжелый фронт.",
      silhouette: "Лучше всего читается как defensive pirate hub с броневыми лепестками и сдержанной агрессией.",
      scene: "Фрегаты держат широкий орбитальный коридор и периодически ныряют под фронтальные пластины.",
      rings: 2, arms: 6, petals: 7, spikes: 14, asymmetry: 0.10, dockBias: 0.30, halo: 1.00, fracture: 1.25
    },
    {
      key: "scrap-halo",
      name: "Scrap Halo",
      note: "Кольцевая свалка-док: внешнее рваное кольцо и яркое перегруженное ядро.",
      silhouette: "Хорошо работает на среднем плане: видно, что база живет за счет кольца, троса и подвесных модулей.",
      scene: "Фрегаты непрерывно прошивают кольцо, будто база собирает и тут же выпускает рейдеров.",
      rings: 3, arms: 5, petals: 5, spikes: 11, asymmetry: 0.22, dockBias: 0.75, halo: 1.22, fracture: 0.95
    },
    {
      key: "rift-anchor",
      name: "Rift Anchor",
      note: "Массивный якорь с разрезом в центре: ощущение гравитационного захвата и глубины.",
      silhouette: "Даёт самый \"космический\" образ: тяжелое тело, внутренний разлом и длинные якорные лучи.",
      scene: "Фрегаты делают вытянутые проходы вдоль разлома и возвращаются в доки по длинной дуге.",
      rings: 1, arms: 4, petals: 4, spikes: 8, asymmetry: 0.28, dockBias: 0.55, halo: 0.90, fracture: 1.55
    },
    {
      key: "pulse-furnace",
      name: "Pulse Furnace",
      note: "Реакторная печь с пульсирующими радиаторами и жесткими тепловыми ребрами.",
      silhouette: "Лучше всего продает идею агрессивного производства: база как военный завод, а не просто склад.",
      scene: "Фрегаты вылетают короткими пачками, на вылете читаются тепловые вспышки и узкие реакторные прорези.",
      rings: 2, arms: 8, petals: 6, spikes: 12, asymmetry: 0.08, dockBias: 0.44, halo: 1.15, fracture: 0.78
    },
    {
      key: "maw-dock",
      name: "Maw Dock",
      note: "База-пасть: широкий передний зев, глубокий внутренний провал и хищный контур.",
      silhouette: "Самый характерный рейдерский образ. Если нужен пиратский характер без милитари-строгости, это лидер.",
      scene: "Фрегаты заходят прямо через передний разрез, отчего вся база выглядит как хищник на засаде.",
      rings: 1, arms: 5, petals: 8, spikes: 16, asymmetry: 0.34, dockBias: 0.88, halo: 0.96, fracture: 1.38
    },
    {
      key: "hook-rig",
      name: "Hook Rig",
      note: "Крюки, мачты и подвесные секции: ощущение дальнего рейдового узла и буксирной станции.",
      silhouette: "Даёт хорошую асимметрию и ощущение \"грязной инженерии\" без потери читаемости на фоне.",
      scene: "Фрегаты двигаются цепочкой между крюками и наружными пилонами, как будто база постоянно собирает новую добычу.",
      rings: 2, arms: 7, petals: 5, spikes: 10, asymmetry: 0.42, dockBias: 0.92, halo: 1.08, fracture: 1.12
    }
  ];

  var state = {
    time: 0,
    burstUntil: 0,
    stars: [],
    variantIndex: 0
  };

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(a, b, t) {
    var x = clamp01((t - a) / Math.max(0.0001, b - a));
    return x * x * (3 - 2 * x);
  }

  function hexToRgb(hex) {
    var clean = String(hex || "#000000").replace("#", "");
    var value = parseInt(clean, 16) || 0;
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }

  function rgba(hex, alpha) {
    var rgb = hexToRgb(hex);
    return "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + alpha + ")";
  }

  function rgbaRgb(rgb, alpha) {
    return "rgba(" + rgb + "," + alpha + ")";
  }

  function getPalette() {
    return PALETTES[controls.palette.value] || PALETTES.teal;
  }

  function getVariant() {
    return VARIANTS[state.variantIndex] || VARIANTS[0];
  }

  function getLodKey() {
    if (controls.lodMode.value !== "auto") return controls.lodMode.value;
    var threat = Number(controls.threat.value) / 100;
    var frigates = Number(controls.frigateCount.value);
    if (threat > 0.72 || frigates > 17) return "far";
    if (threat > 0.4 || frigates > 11) return "mid";
    return "near";
  }

  function rebuildStars(width, height) {
    state.stars = [];
    var count = Math.max(70, Math.floor((width * height) / 13000));
    for (var i = 0; i < count; i++) {
      state.stars.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.5 + Math.random() * 1.5,
        alpha: 0.12 + Math.random() * 0.48,
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

  function drawBackdrop(width, height, palette, variant) {
    var rgb = hexToRgb(palette.core);
    var grad = ctx.createRadialGradient(width * 0.56, height * 0.36, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.72);
    grad.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.14)");
    grad.addColorStop(0.40, "rgba(7,12,23,0.88)");
    grad.addColorStop(1, "rgba(2,5,10,0.98)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    for (var i = 0; i < state.stars.length; i++) {
      var star = state.stars[i];
      var drift = Number(controls.drift.value) / 100;
      var sx = star.x * width + Math.sin(state.time * (0.04 + star.depth * 0.12) + i * 1.7) * drift * 10 * star.depth;
      var sy = star.y * height + Math.cos(state.time * (0.05 + star.depth * 0.09) + i * 1.9) * drift * 7 * star.depth;
      var twinkle = 0.72 + Math.sin(state.time * (0.6 + star.depth) + i * 3.1) * 0.28;
      ctx.beginPath();
      ctx.fillStyle = "rgba(230,240,255," + (star.alpha * twinkle) + ")";
      ctx.arc(sx, sy, star.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var n = 0; n < 3; n++) {
      var hazeX = width * (0.18 + n * 0.28) + Math.sin(state.time * (0.08 + n * 0.03)) * 24;
      var hazeY = height * (0.26 + n * 0.18) + Math.cos(state.time * (0.06 + n * 0.02)) * 18;
      var hazeR = Math.min(width, height) * (0.18 + n * 0.05) * variant.halo;
      var haze = ctx.createRadialGradient(hazeX, hazeY, 0, hazeX, hazeY, hazeR);
      haze.addColorStop(0, rgbaRgb(palette.glow, 0.08 - n * 0.02));
      haze.addColorStop(1, rgbaRgb(palette.glow, 0));
      ctx.fillStyle = haze;
      ctx.beginPath();
      ctx.arc(hazeX, hazeY, hazeR, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawJaggedRing(cx, cy, radius, thickness, points, jitter, color, alpha, spin) {
    ctx.beginPath();
    for (var i = 0; i <= points; i++) {
      var t = i / points;
      var angle = t * TAU + spin;
      var pulse = Math.sin(angle * 3.0 + state.time * 0.22) * jitter + Math.cos(angle * 5.0 - state.time * 0.17) * jitter * 0.6;
      var rr = radius + pulse;
      var x = cx + Math.cos(angle) * rr;
      var y = cy + Math.sin(angle) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.lineWidth = thickness;
    ctx.strokeStyle = rgba(color, alpha);
    ctx.stroke();
  }

  function drawBase(cx, cy, scale, palette, variant, lodKey) {
    var threat = Number(controls.threat.value) / 100;
    var pulse = 0.5 + 0.5 * Math.sin(state.time * (0.7 + variant.fracture * 0.12));
    var coreR = scale * lerp(0.22, 0.28, pulse);
    var shellR = scale * (0.58 + variant.asymmetry * 0.22);
    var fractureBias = variant.fracture;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 1.1);
    glow.addColorStop(0, rgba(palette.core, 0.30));
    glow.addColorStop(0.35, rgba(palette.core, 0.12));
    glow.addColorStop(1, rgba(palette.core, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, scale * 1.1, 0, TAU);
    ctx.fill();
    ctx.restore();

    for (var ringIdx = 0; ringIdx < variant.rings; ringIdx++) {
      var ringR = scale * (0.48 + ringIdx * 0.16);
      drawJaggedRing(cx, cy, ringR, 1.2 + ringIdx * 0.5, 56, scale * 0.03 * fractureBias, palette.trim, 0.26 - ringIdx * 0.04, state.time * 0.06 * (ringIdx % 2 === 0 ? 1 : -1));
    }

    for (var arm = 0; arm < variant.arms; arm++) {
      var armT = arm / variant.arms;
      var baseAngle = armT * TAU + variant.asymmetry * Math.sin(arm * 1.7) + state.time * 0.03;
      var armLen = scale * (0.42 + (arm % 2) * 0.11 + variant.dockBias * 0.12);
      var innerR = scale * 0.16;
      var armW = scale * (0.05 + (arm % 3) * 0.012);
      var bend = Math.sin(baseAngle * 2.0 + state.time * 0.35) * scale * 0.06 * variant.asymmetry;
      var x0 = cx + Math.cos(baseAngle) * innerR;
      var y0 = cy + Math.sin(baseAngle) * innerR;
      var x1 = cx + Math.cos(baseAngle) * armLen - Math.sin(baseAngle) * bend;
      var y1 = cy + Math.sin(baseAngle) * armLen + Math.cos(baseAngle) * bend;
      ctx.lineCap = "round";
      ctx.strokeStyle = rgba(palette.hull, 0.9);
      ctx.lineWidth = armW;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      ctx.strokeStyle = rgba(palette.trim, 0.42);
      ctx.lineWidth = Math.max(1, armW * 0.24);
      ctx.beginPath();
      ctx.moveTo(lerp(x0, x1, 0.18), lerp(y0, y1, 0.18));
      ctx.lineTo(x1, y1);
      ctx.stroke();

      var nodeR = scale * (0.06 + (arm % 2) * 0.01 + variant.dockBias * 0.02);
      ctx.beginPath();
      ctx.fillStyle = rgba(palette.edge, 0.14 + pulse * 0.12);
      ctx.arc(x1, y1, nodeR, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = rgba(palette.trim, 0.58);
      ctx.stroke();
    }

    for (var petal = 0; petal < variant.petals; petal++) {
      var petalAngle = (petal / variant.petals) * TAU + state.time * 0.05 * (petal % 2 === 0 ? 1 : -1);
      var petalR = shellR * (0.82 + Math.sin(petalAngle * 3.0) * variant.asymmetry * 0.35);
      var petalLen = scale * (0.18 + (petal % 3) * 0.03);
      var px = cx + Math.cos(petalAngle) * petalR;
      var py = cy + Math.sin(petalAngle) * petalR;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(petalAngle);
      ctx.beginPath();
      ctx.moveTo(-petalLen * 0.55, -petalLen * 0.30);
      ctx.lineTo(petalLen * 0.95, 0);
      ctx.lineTo(-petalLen * 0.55, petalLen * 0.30);
      ctx.closePath();
      ctx.fillStyle = rgba(palette.hull, 0.74);
      ctx.fill();
      ctx.strokeStyle = rgba(palette.trim, 0.48);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    for (var spike = 0; spike < variant.spikes; spike++) {
      var spikeA = (spike / variant.spikes) * TAU + Math.sin(spike * 0.9) * variant.asymmetry;
      var spikeIn = scale * (0.56 + (spike % 4) * 0.02);
      var spikeOut = spikeIn + scale * (0.07 + (spike % 2) * 0.04) * fractureBias;
      var sx0 = cx + Math.cos(spikeA) * spikeIn;
      var sy0 = cy + Math.sin(spikeA) * spikeIn;
      var sx1 = cx + Math.cos(spikeA) * spikeOut;
      var sy1 = cy + Math.sin(spikeA) * spikeOut;
      ctx.strokeStyle = rgba(palette.edge, 0.22);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx0, sy0);
      ctx.lineTo(sx1, sy1);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.time * 0.06 * (variant.key === "rift-anchor" ? -1 : 1));
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * TAU;
      var rr = coreR * (i % 2 === 0 ? 1.18 : 0.72);
      var x = Math.cos(a) * rr;
      var y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = rgba(palette.core, 0.62);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgba(palette.bright, 0.72);
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.fillStyle = rgba(palette.bright, 0.84);
    ctx.arc(cx, cy, scale * 0.05 * (1 + pulse * 0.6), 0, TAU);
    ctx.fill();

    if (lodKey !== "far") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var fil = 0; fil < 3 + Math.round(threat * 3); fil++) {
        var filA = state.time * (0.35 + fil * 0.12) + fil * 2.0;
        var filR = scale * (0.14 + fil * 0.05);
        ctx.strokeStyle = rgbaRgb(palette.glow, 0.08 + fil * 0.02);
        ctx.lineWidth = 1 + fil * 0.35;
        ctx.beginPath();
        ctx.arc(cx, cy, filR, filA, filA + 0.9 + variant.dockBias * 0.4);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawFrigate(x, y, angle, scale, palette, alpha) {
    var hull = [
      [2.5, 0], [1.2, -0.54], [0.18, -0.96], [-0.74, -0.62], [-1.22, -0.16],
      [-1.36, 0], [-1.22, 0.16], [-0.74, 0.62], [0.18, 0.96], [1.2, 0.54]
    ];

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    ctx.beginPath();
    for (var i = 0; i < hull.length; i++) {
      var point = hull[i];
      if (i === 0) ctx.moveTo(point[0], point[1]);
      else ctx.lineTo(point[0], point[1]);
    }
    ctx.closePath();
    ctx.fillStyle = rgba(palette.hull, 0.86 * alpha);
    ctx.fill();
    ctx.strokeStyle = rgba(palette.edge, 0.68 * alpha);
    ctx.lineWidth = 0.18;
    ctx.stroke();

    ctx.strokeStyle = rgba(palette.trim, 0.84 * alpha);
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    ctx.moveTo(1.55, 0);
    ctx.lineTo(-0.72, 0);
    ctx.moveTo(0.58, -0.42);
    ctx.lineTo(-0.24, -0.72);
    ctx.moveTo(0.58, 0.42);
    ctx.lineTo(-0.24, 0.72);
    ctx.stroke();

    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rgbaRgb(palette.glow, 0.54 * alpha);
    ctx.lineWidth = 0.22;
    ctx.beginPath();
    ctx.moveTo(-1.04, -0.18);
    ctx.lineTo(-1.86, -0.08);
    ctx.moveTo(-1.04, 0.18);
    ctx.lineTo(-1.86, 0.08);
    ctx.stroke();
    ctx.restore();
  }

  function drawFrigateSwarm(cx, cy, scale, palette, variant, lodKey) {
    var count = Number(controls.frigateCount.value);
    var threat = Number(controls.threat.value) / 100;
    var drift = Number(controls.drift.value) / 100;
    var burstMul = state.time < state.burstUntil ? 1.35 : 1;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < count; i++) {
      var lane = (i % 3) / 3;
      var orbitR = scale * (0.88 + lane * 0.18 + threat * 0.16);
      var speed = (0.24 + lane * 0.08 + threat * 0.12) * burstMul;
      var angle = state.time * speed + (i / count) * TAU;
      var wave = Math.sin(state.time * (0.9 + i * 0.07) + i * 2.3) * scale * (0.04 + drift * 0.08);
      var dive = smoothstep(0.55, 1, Math.sin(state.time * (0.6 + i * 0.03) + i * 1.4) * 0.5 + 0.5);
      var rr = orbitR - dive * scale * (0.22 + variant.dockBias * 0.12);
      var x = cx + Math.cos(angle) * rr - Math.sin(angle) * wave;
      var y = cy + Math.sin(angle) * rr + Math.cos(angle) * wave;
      var tangential = angle + Math.PI * 0.5 + Math.sin(state.time * 0.8 + i) * 0.14;
      var frigateScale = scale * (0.034 + lane * 0.004);
      var trailX = x - Math.cos(tangential) * scale * 0.10;
      var trailY = y - Math.sin(tangential) * scale * 0.10;

      ctx.strokeStyle = rgbaRgb(palette.glow, (lodKey === "far" ? 0.08 : 0.16) + dive * 0.06);
      ctx.lineWidth = lodKey === "far" ? 1 : 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(trailX, trailY);
      ctx.stroke();

      drawFrigate(x, y, tangential, frigateScale, palette, 0.86);
    }
    ctx.restore();
  }

  function drawVariantStrip(width, height, palette) {
    var pad = 22;
    var cardW = (width - pad * 2) / VARIANTS.length;
    var y = height - 66;
    for (var i = 0; i < VARIANTS.length; i++) {
      var variant = VARIANTS[i];
      var x = pad + i * cardW + cardW * 0.5;
      var active = i === state.variantIndex;
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.54;
      ctx.fillStyle = "rgba(8,12,22,0.78)";
      ctx.strokeStyle = active ? rgba(palette.trim, 0.55) : "rgba(140,160,210,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x - cardW * 0.46, y - 18, cardW * 0.92, 44, 12);
      ctx.fill();
      ctx.stroke();

      drawBase(x, y + 4, 18, palette, variant, "far");

      ctx.fillStyle = active ? "#eff7ff" : "#9bb0d6";
      ctx.font = "11px Segoe UI, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(variant.name, x, y + 37);
      ctx.restore();
    }
  }

  function updateTexts() {
    var variant = getVariant();
    var frigates = Number(controls.frigateCount.value);
    texts.title.textContent = "Pirate Base Prototype 01 - " + variant.name;
    texts.status.textContent = variant.name + ": " + variant.note + " Frigates on screen: " + frigates + ".";
    texts.variants.textContent =
      "6 вариантов: " +
      VARIANTS.map(function (item, idx) {
        return (idx === state.variantIndex ? "[" + item.name + "]" : item.name);
      }).join(", ") + ".";
    texts.frigate.textContent = "Фрегаты остаются единым классом: острый нос, сухой корпус, длинный реакторный шлейф и быстрые круговые заходы вокруг станции.";
    texts.scene.textContent = variant.scene + " LOD: " + getLodKey() + ".";
  }

  function render() {
    var width = canvas.clientWidth || 1;
    var height = canvas.clientHeight || 1;
    var palette = getPalette();
    var variant = getVariant();
    var lodKey = getLodKey();
    var centerX = width * 0.5;
    var centerY = height * 0.48;
    var baseScale = Math.min(width, height) * 0.23;

    drawBackdrop(width, height, palette, variant);
    drawBase(centerX, centerY, baseScale, palette, variant, lodKey);
    drawFrigateSwarm(centerX, centerY, baseScale, palette, variant, lodKey);
    drawVariantStrip(width, height, palette);
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
    var idx = Math.floor(Math.random() * keys.length);
    controls.palette.value = keys[idx];
    updateTexts();
  });

  controls.frigateBurst.addEventListener("click", function () {
    state.burstUntil = state.time + 6;
  });

  window.addEventListener("resize", resize);
  resize();
  updateTexts();
  requestAnimationFrame(tick);
})();
