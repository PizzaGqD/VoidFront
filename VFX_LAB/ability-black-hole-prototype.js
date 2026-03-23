(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var canvas = document.getElementById("scene");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var controls = {
    variant: document.getElementById("variant"),
    lodMode: document.getElementById("lodMode"),
    tempo: document.getElementById("tempo"),
    scale: document.getElementById("scale"),
    density: document.getElementById("density"),
    backdrop: document.getElementById("backdrop"),
    cycleVariant: document.getElementById("cycleVariant"),
    triggerCast: document.getElementById("triggerCast"),
    triggerCollapse: document.getElementById("triggerCollapse"),
    randomizeSeed: document.getElementById("randomizeSeed")
  };

  var texts = {
    title: document.getElementById("variantTitle"),
    subtitle: document.getElementById("variantSubtitle"),
    status: document.getElementById("statusLine"),
    gameplay: document.getElementById("legendGameplay"),
    read: document.getElementById("legendRead"),
    focus: document.getElementById("legendFocus")
  };

  var VARIANTS = [
    {
      key: "horizon-bloom",
      name: "Event Horizon Bloom",
      note: "Ирис из гравитационных лепестков: фиолетово-синяя корона, тяжелый halo и почти цветочное раскрытие сингулярности.",
      read: "Самый царственный и ceremonial вариант. Хорошо продает силу и редкость способности.",
      focus: "Смотрим на богатство лепестков, ширину силуэта и ощущение, что чёрная дыра действительно раскрывается как космический цветок.",
      gameplay: "Подходит для hero-cast способности, где важно ощущение короны, статуса и большого сценического присутствия.",
      accent: "#8a73ff",
      shell: "bloom",
      shardMode: "petal",
      ringTilt: 0.46,
      bgTop: "12,16,36",
      bgBottom: "2,4,12",
      star: "196,218,255",
      nebula: "60,46,118",
      halo: "122,92,255",
      rim: "222,206,255",
      core: "10,8,22",
      hot: "255,248,255",
      flash: "231,222,255",
      ember: "132,106,255"
    },
    {
      key: "cathedral-lens",
      name: "Cathedral Lens",
      note: "Световой витраж вокруг сингулярности: золотые дуги, орбитальные окна и ощущение священной гравитационной машины.",
      read: "Самый архитектурный и дорогой вариант. У него другая фантазия, не звериная, а монументальная.",
      focus: "Фокус на арочных кольцах, stained-glass вспышках и величественном, почти религиозном силуэте.",
      gameplay: "Подходит, если чёрная дыра должна восприниматься не как хаос, а как controlled cosmic judgment.",
      accent: "#d3a55a",
      shell: "cathedral",
      shardMode: "window",
      ringTilt: 0.30,
      bgTop: "24,18,14",
      bgBottom: "7,4,6",
      star: "255,228,188",
      nebula: "116,74,24",
      halo: "206,153,72",
      rim: "255,241,214",
      core: "14,10,8",
      hot: "255,251,232",
      flash: "255,236,190",
      ember: "255,184,96"
    },
    {
      key: "blood-meridian",
      name: "Blood Meridian",
      note: "Багровая плазменная пасть с рваными огненными языками, горячими embers и очень агрессивной фазой схлопывания.",
      read: "Самый злой и насильственный вариант. Читается как destructive feast, а не как чистая физика.",
      focus: "Фокус на огненных выбросах, ember-ореоле и brutal collapse flash.",
      gameplay: "Подходит, если способность должна пугать и ощущаться как прямой приговор, а не как техно-анomaly.",
      accent: "#d64f64",
      shell: "maelstrom",
      shardMode: "ember",
      ringTilt: 0.58,
      bgTop: "34,10,16",
      bgBottom: "10,3,6",
      star: "255,200,212",
      nebula: "110,18,36",
      halo: "226,72,102",
      rim: "255,214,220",
      core: "18,4,8",
      hot: "255,242,224",
      flash: "255,190,198",
      ember: "255,104,76"
    },
    {
      key: "cryo-halo",
      name: "Cryo Halo",
      note: "Ледяной ореол с кристаллами, шестиугольными преломлениями и холодной синей вспышкой, будто пространство трескается от мороза.",
      read: "Самый неожиданный по тону вариант. Не огонь и не мрак, а deadly cryogenic vacuum.",
      focus: "Фокус на crystal shards, шестиугольной структуре и очень чистой холодной вспышке при касте.",
      gameplay: "Подходит, если хочется читаемого и редкого sci-fi образа, который не сливается с обычными фиолетовыми космо-VFX.",
      accent: "#69c7ff",
      shell: "cryo",
      shardMode: "crystal",
      ringTilt: 0.40,
      bgTop: "7,20,30",
      bgBottom: "2,7,14",
      star: "210,244,255",
      nebula: "24,94,132",
      halo: "82,198,255",
      rim: "230,252,255",
      core: "6,18,28",
      hot: "242,252,255",
      flash: "206,244,255",
      ember: "120,234,255"
    },
    {
      key: "obsidian-crown",
      name: "Obsidian Crown",
      note: "Чёрный венец из шипов и каменных осколков: тяжелая тьма, фиолетовая подкладка и очень плотный силуэт вокруг ядра.",
      read: "Самый массивный и предметный вариант. Здесь вокруг сингулярности ощущается твердая, почти артефактная корона.",
      focus: "Фокус на crown-spikes, каменных орбитах и brutal scale reading на среднем расстоянии.",
      gameplay: "Подходит, если способность должна иметь темный royal silhouette и быть читаемой даже без мелкой анимации.",
      accent: "#7a63ff",
      shell: "crown",
      shardMode: "rock",
      ringTilt: 0.52,
      bgTop: "10,10,22",
      bgBottom: "3,3,8",
      star: "206,212,255",
      nebula: "50,36,116",
      halo: "104,86,225",
      rim: "232,226,255",
      core: "5,5,10",
      hot: "245,244,255",
      flash: "210,208,255",
      ember: "126,102,255"
    },
    {
      key: "prism-maw",
      name: "Prism Maw",
      note: "Призматическая глотка: белая сердцевина, радужный дисперсный ореол и цветовые расколы, будто линза рвет свет по спектру.",
      read: "Самый exotic и impossible вариант. Не мрак, а оптическое безумие вокруг абсолютной пустоты.",
      focus: "Фокус на chromatic wedges, spectrum splits и сиянии, которое делает силуэт непохожим вообще ни на что другое в игре.",
      gameplay: "Подходит, если нужен по-настоящему уникальный endgame-style эффект с сильной оптической идентичностью.",
      accent: "#d89cff",
      shell: "prism",
      shardMode: "prism",
      ringTilt: 0.34,
      bgTop: "14,12,28",
      bgBottom: "4,4,12",
      star: "232,228,255",
      nebula: "88,54,132",
      halo: "210,120,255",
      rim: "255,255,255",
      core: "8,8,12",
      hot: "255,255,255",
      flash: "255,245,255",
      ember: "104,214,255",
      prismA: "255,118,176",
      prismB: "112,220,255",
      prismC: "255,226,120"
    }
  ];

  var state = {
    time: 0,
    lastTs: 0,
    variantIndex: 0,
    seed: 14417,
    cycleStart: 0,
    stars: [],
    shards: [],
    ships: [],
    lastStageKey: ""
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

  function easeOutCubic(v) {
    var t = clamp01(v);
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInCubic(v) {
    var t = clamp01(v);
    return t * t * t;
  }

  function fract(v) {
    return v - Math.floor(v);
  }

  function pingPong(v) {
    var t = fract(v);
    return t < 0.5 ? t * 2 : (1 - t) * 2;
  }

  function rgba(rgb, alpha) {
    return "rgba(" + rgb + "," + alpha + ")";
  }

  function rgb(rgb) {
    return "rgb(" + rgb + ")";
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = seed + 0x6d2b79f5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function noise(seed) {
    var x = Math.sin(seed * 127.1 + seed * seed * 0.019) * 43758.5453123;
    return x - Math.floor(x);
  }

  function getVariant() {
    return VARIANTS[state.variantIndex] || VARIANTS[0];
  }

  function getTempo() {
    return Number(controls.tempo.value || 100) / 100;
  }

  function getScale() {
    return Number(controls.scale.value || 76) / 100;
  }

  function getDensity() {
    return Number(controls.density.value || 100) / 100;
  }

  function getBackdropLevel() {
    return Number(controls.backdrop.value || 92) / 100;
  }

  function getLodKey() {
    if (controls.lodMode.value !== "auto") return controls.lodMode.value;
    var width = canvas.clientWidth || 0;
    if (width < 680) return "far";
    if (width < 1100) return "mid";
    return "near";
  }

  function getLodSpec() {
    var key = getLodKey();
    if (key === "far") {
      return { stars: 0.55, shards: 0.48, ships: 0.65, rings: 0.70, petals: 0.60 };
    }
    if (key === "mid") {
      return { stars: 0.80, shards: 0.78, ships: 0.84, rings: 0.88, petals: 0.82 };
    }
    return { stars: 1.00, shards: 1.00, ships: 1.00, rings: 1.00, petals: 1.00 };
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    var width = Math.max(320, Math.floor(rect.width));
    var height = Math.max(420, Math.floor(rect.height));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildField();
  }

  function rebuildField() {
    var width = Math.max(1, canvas.clientWidth || 1);
    var height = Math.max(1, canvas.clientHeight || 1);
    var rng = mulberry32((state.seed ^ ((state.variantIndex + 1) * 982451653)) >>> 0);
    state.stars = [];
    state.shards = [];
    state.ships = [];

    var starCount = Math.max(100, Math.round(width * height / 7000));
    for (var i = 0; i < starCount; i++) {
      state.stars.push({
        x: rng(),
        y: rng(),
        r: 0.5 + rng() * 1.8,
        a: 0.08 + rng() * 0.48,
        depth: 0.2 + rng() * 0.9,
        phase: rng() * TAU
      });
    }

    for (var s = 0; s < 96; s++) {
      state.shards.push({
        orbit: 0.88 + rng() * 1.32,
        angle: rng() * TAU,
        speed: 0.18 + rng() * 0.72,
        size: 0.5 + rng() * 1.5,
        wobble: rng() * TAU,
        lean: rng() * 2 - 1
      });
    }

    for (var sh = 0; sh < 11; sh++) {
      state.ships.push({
        orbit: 1.45 + rng() * 1.35,
        angle: rng() * TAU,
        speed: 0.07 + rng() * 0.13,
        size: 0.72 + rng() * 0.42,
        tilt: rng() * 2 - 1,
        owner: sh % 2,
        trail: 0.45 + rng() * 0.55
      });
    }
  }

  function populateVariantSelect() {
    controls.variant.innerHTML = "";
    for (var i = 0; i < VARIANTS.length; i++) {
      var option = document.createElement("option");
      option.value = String(i);
      option.textContent = (i + 1) + ". " + VARIANTS[i].name;
      controls.variant.appendChild(option);
    }
    controls.variant.value = String(state.variantIndex);
  }

  function updateTexts() {
    var variant = getVariant();
    document.documentElement.style.setProperty("--accent", variant.accent);
    if (texts.title) texts.title.textContent = "Ability Black Hole Prototype 01 - " + variant.name;
    if (texts.subtitle) texts.subtitle.textContent = variant.note;
    if (texts.gameplay) texts.gameplay.textContent = variant.gameplay;
    if (texts.read) texts.read.textContent = variant.read;
    if (texts.focus) texts.focus.textContent = variant.focus;
  }

  function setCyclePhase(phase) {
    var cfg = getCycleConfig();
    var local = 0;
    if (phase === "collapse") local = cfg.cast + cfg.hold + 0.02;
    state.cycleStart = state.time - local / getTempo();
  }

  function getCycleConfig() {
    return {
      cast: 1.12,
      hold: 4.40,
      collapse: 1.84
    };
  }

  function getTimeline() {
    var cfg = getCycleConfig();
    var total = cfg.cast + cfg.hold + cfg.collapse;
    var local = (state.time - state.cycleStart) * getTempo();
    local = ((local % total) + total) % total;
    var castT = 0;
    var holdT = 0;
    var collapseT = 0;
    var stage = "cast";

    if (local < cfg.cast) {
      stage = "cast";
      castT = local / cfg.cast;
    } else if (local < cfg.cast + cfg.hold) {
      stage = "sustain";
      holdT = (local - cfg.cast) / cfg.hold;
    } else {
      stage = "collapse";
      collapseT = (local - cfg.cast - cfg.hold) / cfg.collapse;
    }

    var openK = 0;
    if (stage === "cast") {
      openK = easeOutCubic(smoothstep(0.12, 0.82, castT));
    } else if (stage === "sustain") {
      openK = 1;
    } else {
      openK = 1 - easeInCubic(smoothstep(0.12, 0.90, collapseT));
    }

    var effectK = 0;
    if (stage === "cast") {
      effectK = easeOutCubic(smoothstep(0.24, 0.92, castT));
    } else if (stage === "sustain") {
      effectK = 1;
    } else {
      effectK = 1 - easeInCubic(smoothstep(0.02, 0.72, collapseT));
    }

    var pointK = 0;
    if (stage === "cast") {
      pointK = 1 - smoothstep(0.08, 0.44, castT);
    } else if (stage === "collapse") {
      pointK = smoothstep(0.68, 0.98, collapseT);
    }

    var radiusMul = 0.035 + openK * 0.965;
    var castFlash = stage === "cast" ? (1 - smoothstep(0.03, 0.24, castT)) * 1.15 : 0;
    var castRing = stage === "cast" ? smoothstep(0.10, 0.34, castT) * (1 - smoothstep(0.42, 0.70, castT)) : 0;
    var holdPulse = 0.5 + 0.5 * Math.sin(state.time * 2.2);
    var collapseFlash = stage === "collapse" ? smoothstep(0.72, 0.90, collapseT) * (1 - smoothstep(0.94, 1.00, collapseT)) * 1.45 : 0;
    var collapseRing = stage === "collapse" ? smoothstep(0.78, 0.92, collapseT) * (1 - smoothstep(0.95, 1.00, collapseT)) : 0;
    var implodeK = stage === "collapse" ? smoothstep(0.18, 1.00, collapseT) : 0;

    return {
      stage: stage,
      castT: castT,
      holdT: holdT,
      collapseT: collapseT,
      openK: openK,
      effectK: effectK,
      pointK: pointK,
      radiusMul: radiusMul,
      castFlash: castFlash,
      castRing: castRing,
      holdPulse: holdPulse,
      collapseFlash: collapseFlash,
      collapseRing: collapseRing,
      implodeK: implodeK
    };
  }

  function drawGlow(x, y, rx, ry, rgbValue, alpha, rotation) {
    if (alpha <= 0 || rx <= 0 || ry <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation || 0);
    ctx.scale(rx, ry);
    var gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, rgba(rgbValue, alpha));
    gradient.addColorStop(0.55, rgba(rgbValue, alpha * 0.32));
    gradient.addColorStop(1, rgba(rgbValue, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawRing(x, y, radius, color, alpha, width) {
    if (alpha <= 0 || radius <= 0) return;
    ctx.save();
    ctx.lineWidth = width;
    ctx.strokeStyle = rgba(color, alpha);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawEllipseRing(x, y, rx, ry, rotation, color, alpha, width) {
    if (alpha <= 0 || rx <= 0 || ry <= 0) return;
    ctx.save();
    ctx.lineWidth = width;
    ctx.strokeStyle = rgba(color, alpha);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rotation || 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawArc(x, y, radius, start, end, color, alpha, width) {
    if (alpha <= 0 || radius <= 0) return;
    ctx.save();
    ctx.lineWidth = width;
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(x, y, radius, start, end);
    ctx.stroke();
    ctx.restore();
  }

  function drawBackground(variant, cx, cy, baseRadius, timeline, lod) {
    var width = canvas.clientWidth || 1;
    var height = canvas.clientHeight || 1;
    var backdrop = getBackdropLevel();
    var bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, rgba(variant.bgTop, 0.96));
    bg.addColorStop(1, rgba(variant.bgBottom, 1.0));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    drawGlow(width * 0.20, height * 0.16, width * 0.26, height * 0.18, variant.nebula, 0.16 * backdrop, 0.1);
    drawGlow(width * 0.82, height * 0.18, width * 0.18, height * 0.14, variant.halo, 0.10 * backdrop, -0.2);
    drawGlow(width * 0.28, height * 0.82, width * 0.22, height * 0.20, variant.nebula, 0.08 * backdrop, 0.4);

    var starCount = Math.round(state.stars.length * lod.stars);
    for (var i = 0; i < starCount; i++) {
      var star = state.stars[i];
      if (!star) continue;
      var px = star.x * width;
      var py = star.y * height;
      var dx = px - cx;
      var dy = py - cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var lens = smoothstep(baseRadius * 1.1, baseRadius * 4.2, dist);
      var drift = 1 - lens;
      px += dx / Math.max(12, dist) * drift * 22;
      py += dy / Math.max(12, dist) * drift * 22;
      var twinkle = 0.7 + 0.3 * Math.sin(state.time * (0.6 + star.depth) + star.phase);
      ctx.fillStyle = rgba(variant.star, star.a * twinkle);
      ctx.beginPath();
      ctx.arc(px, py, star.r, 0, TAU);
      ctx.fill();
    }

    for (var r = 0; r < 4; r++) {
      var ringFrac = r / 3;
      var radius = baseRadius * (1.8 + ringFrac * 1.2 + timeline.openK * 0.15);
      drawEllipseRing(cx, cy, radius, radius * lerp(0.46, 0.62, ringFrac), 0.14 + r * 0.07, variant.halo, 0.03 + r * 0.02, 1.2 + r * 0.3);
    }
  }

  function drawObserverShips(variant, cx, cy, baseRadius, timeline, lod) {
    var shipCount = Math.max(4, Math.round(state.ships.length * lod.ships));
    for (var i = 0; i < shipCount; i++) {
      var ship = state.ships[i];
      if (!ship) continue;
      var orbit = baseRadius * ship.orbit * (1 - timeline.implodeK * 0.14);
      var angle = ship.angle + state.time * ship.speed * (ship.owner === 0 ? 1 : -1);
      var stretch = 0.56 + ship.tilt * 0.1;
      var x = cx + Math.cos(angle) * orbit;
      var y = cy + Math.sin(angle) * orbit * stretch;
      var dx = cx - x;
      var dy = cy - y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = dx / len;
      var ny = dy / len;
      var tx = -ny;
      var ty = nx;
      var size = baseRadius * 0.038 * ship.size;
      var trailLen = size * (6 + 7 * ship.trail) * (0.4 + timeline.openK * 0.8);
      var hullColor = ship.owner === 0 ? variant.rim : variant.flash;

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = rgba(variant.ember, 0.16 + timeline.castFlash * 0.12);
      ctx.lineWidth = Math.max(1, size * 0.42);
      ctx.beginPath();
      ctx.moveTo(x - nx * size * 0.2, y - ny * size * 0.2);
      ctx.lineTo(x - nx * trailLen, y - ny * trailLen);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = rgba(hullColor, 0.88);
      ctx.strokeStyle = rgba(variant.halo, 0.30);
      ctx.lineWidth = Math.max(1, size * 0.20);
      ctx.beginPath();
      ctx.moveTo(x + nx * size * 1.4, y + ny * size * 1.4);
      ctx.lineTo(x - nx * size * 1.0 + tx * size * 0.82, y - ny * size * 1.0 + ty * size * 0.82);
      ctx.lineTo(x - nx * size * 0.4, y - ny * size * 0.6);
      ctx.lineTo(x - nx * size * 1.0 - tx * size * 0.82, y - ny * size * 1.0 - ty * size * 0.82);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawAccretionDisk(variant, cx, cy, baseRadius, timeline, lod) {
    var open = timeline.openK;
    var anim = state.time * (0.22 + getTempo() * 0.06);
    var diskRx = baseRadius * (1.70 + open * 0.28);
    var diskRy = baseRadius * (0.34 + open * 0.08);
    var tilt = variant.ringTilt + anim * 0.04;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    drawGlow(cx, cy, diskRx * 0.94, diskRy * 2.8, variant.halo, 0.12 + timeline.castFlash * 0.24, tilt);
    drawGlow(cx, cy, diskRx * 0.72, diskRy * 2.0, variant.ember, 0.18 + timeline.holdPulse * 0.10, tilt);
    drawGlow(cx, cy, diskRx * 0.48, diskRy * 1.4, variant.flash, 0.08 + timeline.collapseFlash * 0.24, tilt);
    ctx.restore();

    var ringCount = Math.max(3, Math.round((5 + getDensity() * 3) * lod.rings));
    for (var i = 0; i < ringCount; i++) {
      var frac = i / Math.max(1, ringCount - 1);
      var rx = diskRx * (0.58 + frac * 0.62);
      var ry = diskRy * (0.42 + frac * 0.64);
      drawEllipseRing(cx, cy, rx, ry, tilt + frac * 0.12, variant.rim, 0.08 + frac * 0.05 + timeline.castFlash * 0.04, 1.1 + frac * 0.9);
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    var grad = ctx.createLinearGradient(-diskRx, 0, diskRx, 0);
    grad.addColorStop(0, rgba(variant.ember, 0));
    grad.addColorStop(0.24, rgba(variant.halo, 0.26));
    grad.addColorStop(0.52, rgba(variant.flash, 0.42));
    grad.addColorStop(0.78, rgba(variant.ember, 0.22));
    grad.addColorStop(1, rgba(variant.ember, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, diskRx, diskRy, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawCore(variant, cx, cy, baseRadius, timeline) {
    var open = timeline.openK;
    var radius = baseRadius * (0.54 + open * 0.10);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    drawGlow(cx, cy, radius * 2.2, radius * 2.2, variant.halo, 0.10 + timeline.castFlash * 0.22 + timeline.collapseFlash * 0.14, 0);
    drawGlow(cx, cy, radius * 1.32, radius * 1.32, variant.flash, 0.06 + timeline.collapseFlash * 0.24, 0);
    ctx.restore();

    ctx.save();
    var outer = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.08);
    outer.addColorStop(0, rgba(variant.core, 0.06));
    outer.addColorStop(0.48, rgba(variant.core, 0.82));
    outer.addColorStop(0.82, rgba(variant.core, 0.96));
    outer.addColorStop(1, rgba("0,0,0", 1));
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.06, 0, TAU);
    ctx.fill();
    ctx.restore();

    var rimAlpha = 0.20 + timeline.castFlash * 0.34 + timeline.collapseFlash * 0.28;
    drawRing(cx, cy, radius * 0.98, variant.rim, rimAlpha, Math.max(1.2, baseRadius * 0.025));
    drawRing(cx, cy, radius * 0.82, variant.flash, 0.08 + timeline.holdPulse * 0.06, Math.max(1, baseRadius * 0.010));

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.time * 0.40);
    for (var i = 0; i < 3; i++) {
      var frac = i / 3;
      ctx.strokeStyle = rgba(variant.hot, 0.06 + frac * 0.03 + timeline.collapseFlash * 0.08);
      ctx.lineWidth = Math.max(1, baseRadius * (0.014 + frac * 0.006));
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * (0.46 + frac * 0.10), radius * (0.18 + frac * 0.03), i * 0.94, 0.15, Math.PI + 0.35);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOrbitShards(variant, cx, cy, baseRadius, timeline, lod) {
    var count = Math.max(16, Math.round((40 + getDensity() * 26) * lod.shards));
    for (var i = 0; i < count; i++) {
      var shard = state.shards[i];
      if (!shard) continue;
      var orbit = baseRadius * shard.orbit * (1 - timeline.implodeK * 0.12);
      var angle = shard.angle + state.time * shard.speed * (variant.key === "blood-meridian" ? 1.6 : 0.9) + shard.lean * 0.15 * timeline.holdPulse;
      var x = cx + Math.cos(angle) * orbit;
      var y = cy + Math.sin(angle) * orbit * (0.58 + 0.08 * Math.sin(shard.wobble));
      var size = baseRadius * 0.034 * shard.size * (0.78 + timeline.openK * 0.42);
      drawShardSprite(variant, x, y, size, angle + shard.wobble, timeline);
    }
  }

  function drawShardSprite(variant, x, y, size, angle, timeline) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = "screen";
    if (variant.shardMode === "petal") {
      drawGlow(0, 0, size * 1.8, size * 0.66, variant.ember, 0.14 + timeline.castFlash * 0.10, 0);
      ctx.strokeStyle = rgba(variant.rim, 0.38);
      ctx.lineWidth = Math.max(1, size * 0.20);
      ctx.beginPath();
      ctx.moveTo(size * 1.5, 0);
      ctx.quadraticCurveTo(size * 0.2, size * 0.7, -size * 1.2, 0);
      ctx.quadraticCurveTo(size * 0.2, -size * 0.7, size * 1.5, 0);
      ctx.stroke();
    } else if (variant.shardMode === "window") {
      ctx.fillStyle = rgba(variant.flash, 0.15);
      ctx.strokeStyle = rgba(variant.rim, 0.42);
      ctx.lineWidth = Math.max(1, size * 0.18);
      ctx.beginPath();
      ctx.rect(-size * 0.8, -size * 0.55, size * 1.6, size * 1.1);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.55);
      ctx.lineTo(0, size * 0.55);
      ctx.moveTo(-size * 0.8, 0);
      ctx.lineTo(size * 0.8, 0);
      ctx.stroke();
    } else if (variant.shardMode === "ember") {
      drawGlow(0, 0, size * 1.4, size * 1.2, variant.ember, 0.18 + timeline.holdPulse * 0.05, 0);
      ctx.fillStyle = rgba(variant.flash, 0.34);
      ctx.beginPath();
      ctx.moveTo(size * 0.9, 0);
      ctx.lineTo(0, size * 0.4);
      ctx.lineTo(-size * 1.1, 0);
      ctx.lineTo(0, -size * 0.4);
      ctx.closePath();
      ctx.fill();
    } else if (variant.shardMode === "crystal") {
      ctx.fillStyle = rgba(variant.flash, 0.16);
      ctx.strokeStyle = rgba(variant.rim, 0.48);
      ctx.lineWidth = Math.max(1, size * 0.18);
      ctx.beginPath();
      ctx.moveTo(size * 1.0, 0);
      ctx.lineTo(size * 0.2, size * 0.7);
      ctx.lineTo(-size * 0.9, size * 0.2);
      ctx.lineTo(-size * 0.2, -size * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (variant.shardMode === "rock") {
      ctx.fillStyle = rgba(variant.core, 0.92);
      ctx.strokeStyle = rgba(variant.halo, 0.34);
      ctx.lineWidth = Math.max(1, size * 0.16);
      ctx.beginPath();
      ctx.moveTo(size * 0.8, 0);
      ctx.lineTo(size * 0.3, size * 0.7);
      ctx.lineTo(-size * 0.5, size * 0.8);
      ctx.lineTo(-size * 0.9, 0.1 * size);
      ctx.lineTo(-size * 0.3, -size * 0.7);
      ctx.lineTo(size * 0.5, -size * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (variant.shardMode === "prism") {
      drawGlow(0, 0, size * 1.7, size * 1.1, variant.prismB || variant.ember, 0.10, 0);
      ctx.strokeStyle = rgba(variant.prismA || variant.halo, 0.38);
      ctx.lineWidth = Math.max(1, size * 0.18);
      ctx.beginPath();
      ctx.moveTo(size * 1.0, 0);
      ctx.lineTo(-size * 0.4, size * 0.7);
      ctx.lineTo(-size * 0.8, -size * 0.2);
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = rgba(variant.prismC || variant.flash, 0.28);
      ctx.beginPath();
      ctx.moveTo(size * 0.7, 0.12 * size);
      ctx.lineTo(-size * 0.5, size * 0.52);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBloomShell(variant, cx, cy, baseRadius, timeline, lod) {
    var petalCount = Math.max(6, Math.round((8 + getDensity() * 2) * lod.petals));
    for (var i = 0; i < petalCount; i++) {
      var frac = i / petalCount;
      var angle = frac * TAU + state.time * 0.18;
      var dist = baseRadius * (1.30 + 0.08 * Math.sin(state.time * 1.4 + frac * 8));
      var px = cx + Math.cos(angle) * dist;
      var py = cy + Math.sin(angle) * dist;
      var rx = baseRadius * (0.54 + 0.10 * timeline.holdPulse);
      var ry = baseRadius * (0.17 + 0.03 * Math.sin(angle * 3 + state.time));
      drawGlow(px, py, rx, ry, variant.halo, 0.16 + timeline.castFlash * 0.14, angle);
      drawArc(cx, cy, dist, angle - 0.34, angle + 0.34, variant.rim, 0.18, Math.max(1.2, baseRadius * 0.015));
    }
  }

  function drawCathedralShell(variant, cx, cy, baseRadius, timeline, lod) {
    var bandCount = Math.max(3, Math.round(5 * lod.rings));
    for (var i = 0; i < bandCount; i++) {
      var frac = i / Math.max(1, bandCount - 1);
      var radius = baseRadius * (1.12 + frac * 0.64);
      drawArc(cx, cy, radius, Math.PI * (0.08 + frac * 0.03), Math.PI * (0.92 - frac * 0.03), variant.rim, 0.12 + frac * 0.08, Math.max(1.4, baseRadius * 0.014));
      drawArc(cx, cy, radius, -Math.PI * (0.92 - frac * 0.03), -Math.PI * (0.08 + frac * 0.03), variant.ember, 0.08 + frac * 0.04, Math.max(1.2, baseRadius * 0.010));
    }

    var windowCount = Math.max(6, Math.round((8 + getDensity() * 2) * lod.petals));
    for (var w = 0; w < windowCount; w++) {
      var wFrac = w / windowCount;
      var ang = wFrac * TAU + state.time * 0.07;
      var dist = baseRadius * 1.52;
      var x = cx + Math.cos(ang) * dist;
      var y = cy + Math.sin(ang) * dist * 0.82;
      drawGlow(x, y, baseRadius * 0.20, baseRadius * 0.08, variant.flash, 0.12 + timeline.holdPulse * 0.04, ang);
    }

    drawGlow(cx, cy - baseRadius * 1.10, baseRadius * 0.62, baseRadius * 0.12, variant.flash, 0.10 + timeline.castFlash * 0.10, 0);
    drawGlow(cx, cy + baseRadius * 1.10, baseRadius * 0.62, baseRadius * 0.12, variant.halo, 0.08 + timeline.castFlash * 0.08, 0);
  }

  function drawMaelstromShell(variant, cx, cy, baseRadius, timeline, lod) {
    var tongueCount = Math.max(7, Math.round((10 + getDensity() * 3) * lod.petals));
    ctx.save();
    ctx.strokeStyle = rgba(variant.ember, 0.28 + timeline.castFlash * 0.14);
    ctx.lineWidth = Math.max(1.2, baseRadius * 0.018);
    ctx.lineCap = "round";
    for (var i = 0; i < tongueCount; i++) {
      var frac = i / tongueCount;
      var angle = frac * TAU + state.time * 0.32;
      var r0 = baseRadius * 1.02;
      var r1 = baseRadius * (1.42 + 0.22 * noise(i * 2.1 + state.time));
      var r2 = baseRadius * (1.64 + 0.24 * noise(i * 7.4 + state.time * 0.5));
      var x0 = cx + Math.cos(angle) * r0;
      var y0 = cy + Math.sin(angle) * r0;
      var x1 = cx + Math.cos(angle + 0.16) * r1;
      var y1 = cy + Math.sin(angle + 0.16) * r1;
      var x2 = cx + Math.cos(angle + 0.08 * Math.sin(i + state.time)) * r2;
      var y2 = cy + Math.sin(angle + 0.08 * Math.sin(i + state.time)) * r2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x1, y1, x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    drawGlow(cx, cy, baseRadius * 2.3, baseRadius * 2.0, variant.ember, 0.08 + timeline.holdPulse * 0.06, 0);
  }

  function drawCryoShell(variant, cx, cy, baseRadius, timeline, lod) {
    var spokeCount = Math.max(6, Math.round((8 + getDensity() * 2) * lod.petals));
    ctx.save();
    ctx.strokeStyle = rgba(variant.rim, 0.36);
    ctx.lineWidth = Math.max(1.1, baseRadius * 0.012);
    for (var i = 0; i < spokeCount; i++) {
      var angle = i / spokeCount * TAU + state.time * 0.09;
      var x0 = cx + Math.cos(angle) * baseRadius * 0.88;
      var y0 = cy + Math.sin(angle) * baseRadius * 0.88;
      var x1 = cx + Math.cos(angle) * baseRadius * 1.66;
      var y1 = cy + Math.sin(angle) * baseRadius * 1.66;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.restore();

    for (var h = 0; h < 3; h++) {
      var mul = 1.08 + h * 0.28;
      drawEllipseRing(cx, cy, baseRadius * mul, baseRadius * mul * 0.92, h * 0.12 + state.time * 0.03, variant.rim, 0.10 + h * 0.04, Math.max(1.2, baseRadius * 0.010));
    }
  }

  function drawCrownShell(variant, cx, cy, baseRadius, timeline, lod) {
    var spikeCount = Math.max(7, Math.round((10 + getDensity() * 2) * lod.petals));
    ctx.save();
    ctx.fillStyle = rgba(variant.core, 0.90);
    ctx.strokeStyle = rgba(variant.halo, 0.28 + timeline.castFlash * 0.10);
    ctx.lineWidth = Math.max(1, baseRadius * 0.013);
    ctx.beginPath();
    for (var i = 0; i < spikeCount; i++) {
      var frac = i / spikeCount;
      var angle = frac * TAU + state.time * 0.08;
      var inner = baseRadius * 1.08;
      var outer = baseRadius * (1.46 + 0.16 * noise(i * 6.1 + state.time));
      var x0 = cx + Math.cos(angle - 0.12) * inner;
      var y0 = cy + Math.sin(angle - 0.12) * inner;
      var x1 = cx + Math.cos(angle) * outer;
      var y1 = cy + Math.sin(angle) * outer;
      var x2 = cx + Math.cos(angle + 0.12) * inner;
      var y2 = cy + Math.sin(angle + 0.12) * inner;
      if (i === 0) ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    drawGlow(cx, cy, baseRadius * 2.4, baseRadius * 1.6, variant.halo, 0.08 + timeline.holdPulse * 0.05, 0);
  }

  function drawPrismShell(variant, cx, cy, baseRadius, timeline, lod) {
    var wedgeCount = Math.max(6, Math.round((8 + getDensity() * 2) * lod.petals));
    var colors = [variant.prismA || variant.halo, variant.prismB || variant.ember, variant.prismC || variant.flash];
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (var i = 0; i < wedgeCount; i++) {
      var frac = i / wedgeCount;
      var angle = frac * TAU + state.time * 0.12;
      var color = colors[i % colors.length];
      var outer = baseRadius * 1.86;
      var inner = baseRadius * 1.04;
      ctx.fillStyle = rgba(color, 0.08 + timeline.castFlash * 0.08);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle - 0.10) * inner, cy + Math.sin(angle - 0.10) * inner);
      ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      ctx.lineTo(cx + Math.cos(angle + 0.10) * inner, cy + Math.sin(angle + 0.10) * inner);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    drawEllipseRing(cx, cy, baseRadius * 1.34, baseRadius * 0.88, state.time * 0.12, variant.prismA || variant.halo, 0.16, Math.max(1.1, baseRadius * 0.010));
    drawEllipseRing(cx, cy, baseRadius * 1.52, baseRadius * 0.98, -state.time * 0.10, variant.prismB || variant.ember, 0.14, Math.max(1.1, baseRadius * 0.010));
    drawEllipseRing(cx, cy, baseRadius * 1.74, baseRadius * 1.10, state.time * 0.08, variant.prismC || variant.flash, 0.12, Math.max(1.1, baseRadius * 0.010));
  }

  function drawSingularitySeed(variant, cx, cy, maxRadius, timeline) {
    var seedAlpha = Math.max(timeline.pointK, timeline.castFlash * 0.9, timeline.collapseFlash * 0.9);
    if (seedAlpha <= 0.001) return;

    var flashBias = Math.max(timeline.castFlash, timeline.collapseFlash);
    var dotRadius = maxRadius * (0.018 + timeline.pointK * 0.028 + flashBias * 0.012);
    var haloRadius = maxRadius * (0.18 + timeline.pointK * 0.62 + flashBias * 0.26);
    var spokeCount = 10;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    drawGlow(cx, cy, haloRadius, haloRadius, variant.flash, 0.10 + seedAlpha * 0.34, 0);
    drawGlow(cx, cy, haloRadius * 1.35, haloRadius * 0.42, variant.ember, 0.06 + seedAlpha * 0.20, state.time * 0.18);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = rgba(variant.hot, 0.16 + seedAlpha * 0.42);
    ctx.lineWidth = Math.max(1, maxRadius * 0.010);
    ctx.lineCap = "round";
    for (var i = 0; i < spokeCount; i++) {
      var angle = (i / spokeCount) * TAU + state.time * 0.22;
      var r0 = dotRadius * 1.4;
      var r1 = haloRadius * (0.66 + 0.12 * Math.sin(state.time * 2.0 + i));
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
      ctx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = rgba(variant.hot, 0.56 + seedAlpha * 0.34);
    ctx.beginPath();
    ctx.arc(cx, cy, dotRadius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawVariantShell(variant, cx, cy, baseRadius, timeline, lod) {
    if (variant.shell === "bloom") {
      drawBloomShell(variant, cx, cy, baseRadius, timeline, lod);
    } else if (variant.shell === "cathedral") {
      drawCathedralShell(variant, cx, cy, baseRadius, timeline, lod);
    } else if (variant.shell === "maelstrom") {
      drawMaelstromShell(variant, cx, cy, baseRadius, timeline, lod);
    } else if (variant.shell === "cryo") {
      drawCryoShell(variant, cx, cy, baseRadius, timeline, lod);
    } else if (variant.shell === "crown") {
      drawCrownShell(variant, cx, cy, baseRadius, timeline, lod);
    } else if (variant.shell === "prism") {
      drawPrismShell(variant, cx, cy, baseRadius, timeline, lod);
    }
  }

  function drawCastFlash(variant, cx, cy, baseRadius, timeline) {
    if (timeline.castFlash <= 0.001 && timeline.castRing <= 0.001) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    drawGlow(cx, cy, baseRadius * (2.2 + timeline.castFlash * 1.8), baseRadius * (2.2 + timeline.castFlash * 1.8), variant.flash, 0.16 + timeline.castFlash * 0.44, 0);
    drawGlow(cx, cy, baseRadius * (3.6 + timeline.castFlash * 2.2), baseRadius * (1.0 + timeline.castFlash * 0.5), variant.ember, 0.08 + timeline.castFlash * 0.18, state.time * 0.12);
    ctx.restore();
    drawRing(cx, cy, baseRadius * (1.4 + timeline.castRing * 3.8), variant.flash, 0.34 * (1 - timeline.castRing), Math.max(2, baseRadius * 0.024));
    drawRing(cx, cy, baseRadius * (1.0 + timeline.castRing * 2.4), variant.halo, 0.22 * (1 - timeline.castRing), Math.max(1.4, baseRadius * 0.012));
  }

  function drawCollapseFlash(variant, cx, cy, baseRadius, timeline) {
    if (timeline.collapseFlash <= 0.001 && timeline.collapseRing <= 0.001) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    drawGlow(cx, cy, baseRadius * (2.0 - timeline.implodeK * 0.8), baseRadius * (2.0 - timeline.implodeK * 0.8), variant.flash, 0.14 + timeline.collapseFlash * 0.46, 0);
    drawGlow(cx, cy, baseRadius * (2.8 + timeline.collapseFlash * 1.4), baseRadius * (0.82 + timeline.collapseFlash * 0.18), variant.halo, 0.06 + timeline.collapseFlash * 0.20, state.time * 0.16);
    ctx.restore();
    drawRing(cx, cy, baseRadius * (0.6 + timeline.collapseRing * 3.1), variant.flash, 0.38 * (1 - timeline.collapseRing), Math.max(2.4, baseRadius * 0.028));
    drawRing(cx, cy, baseRadius * (0.4 + timeline.collapseRing * 2.0), variant.ember, 0.18 * (1 - timeline.collapseRing), Math.max(1.4, baseRadius * 0.012));
  }

  function drawStageOverlay(variant, cx, cy, baseRadius, timeline) {
    var width = canvas.clientWidth || 1;
    var height = canvas.clientHeight || 1;
    if (timeline.castFlash > 0.001) {
      ctx.fillStyle = rgba(variant.flash, 0.03 + timeline.castFlash * 0.05);
      ctx.fillRect(0, 0, width, height);
    }
    if (timeline.collapseFlash > 0.001) {
      ctx.fillStyle = rgba(variant.halo, 0.02 + timeline.collapseFlash * 0.06);
      ctx.fillRect(0, 0, width, height);
    }
    drawCastFlash(variant, cx, cy, baseRadius, timeline);
    drawCollapseFlash(variant, cx, cy, baseRadius, timeline);
  }

  function render() {
    var width = canvas.clientWidth || 1;
    var height = canvas.clientHeight || 1;
    var variant = getVariant();
    var timeline = getTimeline();
    var lod = getLodSpec();
    var maxRadius = Math.min(width, height) * (0.13 + getScale() * 0.08);
    var baseRadius = maxRadius * timeline.radiusMul;
    var fieldRadius = Math.max(maxRadius * 0.26, maxRadius * (0.24 + timeline.radiusMul * 0.76));
    var cx = width * 0.50;
    var cy = height * 0.56;

    drawBackground(variant, cx, cy, fieldRadius, timeline, lod);
    drawObserverShips(variant, cx, cy, fieldRadius, timeline, lod);
    drawSingularitySeed(variant, cx, cy, maxRadius, timeline);

    ctx.save();
    ctx.globalAlpha = Math.max(0.08, timeline.effectK);
    drawVariantShell(variant, cx, cy, baseRadius, timeline, lod);
    drawAccretionDisk(variant, cx, cy, baseRadius, timeline, lod);
    drawOrbitShards(variant, cx, cy, baseRadius, timeline, lod);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = Math.max(0.18, 0.24 + timeline.openK * 0.76);
    drawCore(variant, cx, cy, baseRadius, timeline);
    ctx.restore();

    drawStageOverlay(variant, cx, cy, maxRadius, timeline);
    updateStatusLine(variant, timeline);
  }

  function updateStatusLine(variant, timeline) {
    var stageKey = variant.key + ":" + timeline.stage;
    if (state.lastStageKey === stageKey) return;
    state.lastStageKey = stageKey;
    if (!texts.status) return;
    var stageText = "Cast flash";
    if (timeline.stage === "sustain") stageText = "Sustain loop";
    if (timeline.stage === "collapse") stageText = "Collapse flash";
    texts.status.textContent = variant.name + " | " + stageText + " | LOD: " + getLodKey() + " | Seed: " + state.seed;
  }

  function frame(ts) {
    var now = ts * 0.001;
    if (!state.lastTs) state.lastTs = now;
    var dt = Math.min(0.05, Math.max(0.001, now - state.lastTs));
    state.lastTs = now;
    state.time += dt;
    render();
    requestAnimationFrame(frame);
  }

  controls.variant.addEventListener("change", function () {
    state.variantIndex = Math.max(0, Math.min(VARIANTS.length - 1, Number(controls.variant.value) || 0));
    state.lastStageKey = "";
    rebuildField();
    updateTexts();
  });

  controls.cycleVariant.addEventListener("click", function () {
    state.variantIndex = (state.variantIndex + 1) % VARIANTS.length;
    controls.variant.value = String(state.variantIndex);
    state.lastStageKey = "";
    rebuildField();
    updateTexts();
  });

  controls.triggerCast.addEventListener("click", function () {
    state.lastStageKey = "";
    setCyclePhase("cast");
  });

  controls.triggerCollapse.addEventListener("click", function () {
    state.lastStageKey = "";
    setCyclePhase("collapse");
  });

  controls.randomizeSeed.addEventListener("click", function () {
    state.seed = ((Math.random() * 0x7fffffff) | 0) >>> 0;
    state.lastStageKey = "";
    rebuildField();
  });

  controls.lodMode.addEventListener("change", function () {
    state.lastStageKey = "";
  });

  controls.tempo.addEventListener("input", function () {
    state.lastStageKey = "";
  });

  controls.scale.addEventListener("input", function () {
    state.lastStageKey = "";
  });

  controls.density.addEventListener("input", function () {
    state.lastStageKey = "";
  });

  controls.backdrop.addEventListener("input", function () {
    state.lastStageKey = "";
  });

  populateVariantSelect();
  updateTexts();
  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(frame);
})();
