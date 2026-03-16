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

  var THERMO_PALETTE = {
    core: "#84d6ff",
    trim: "#f6fbff",
    line: "#56b1ff",
    dark: "#08111f",
    hull: "#133046",
    glow: "132,214,255"
  };

  var OWNER_COLORS = [
    { fill: "#5caeff", edge: "#e0f1ff" },
    { fill: "#ff879f", edge: "#ffe4ea" },
    { fill: "#8ce38a", edge: "#ecffe9" },
    { fill: "#ffc26e", edge: "#fff1d6" }
  ];

  var EFFECTS = [
    {
      id: "pirateRaid",
      name: "Pirate Raid",
      gameplay: "Разлом открывается на линии налета, из него вываливается рейдерская пачка 5+2+1 и быстро врезается в выбранную точку.",
      focus: "Смотрим читаемость разлома, чувство волны вылета и то, насколько хорошо продается рейдерский вход до начала реального боя."
    },
    {
      id: "thermoNuke",
      name: "Thermo Nuclear Impulse",
      gameplay: "Из ядра стартует ракета и в точке детонации полностью стирает любые корабли любого класса и любого игрока внутри радиуса.",
      focus: "Смотрим мощность телеграфа, путь ракеты от ядра и тот самый абсолютный wipe-момент, после которого зона читается как мертвая."
    },
    {
      id: "nanoSwarm",
      name: "Nano Swarm",
      gameplay: "Плотное DoT-облако держит область, разъедает корабли и визуально ломает ощущение безопасной стрельбы внутри зоны.",
      focus: "Смотрим язык самого облака, коррозию корпуса, подавление атаки и читаемую границу опасной зоны."
    }
  ];

  var VARIANTS_BY_EFFECT = {
    pirateRaid: [
      {
        key: "void-breach",
        name: "Void Breach",
        note: "Чистый вытянутый разлом с плотной линзой и собранным вылетом эскорта.",
        read: "Самый понятный и базовый вариант: хорошо продает spatial breach и контролируемый рейдерский вход.",
        aperture: 1.00,
        jagged: 0.08,
        petals: 0,
        teeth: 0,
        miniRifts: 0,
        lightning: 0,
        braces: 0,
        sail: 0.18,
        funnel: 0.10,
        trail: 0.20
      },
      {
        key: "maw-gate",
        name: "Maw Gate",
        note: "Разлом ощущается пастью: зубья, темное нутро и агрессивный выталкивающий импульс.",
        read: "Лучший кандидат, если хочется максимум пиратского характера и хищного силуэта.",
        aperture: 0.94,
        jagged: 0.24,
        petals: 7,
        teeth: 12,
        miniRifts: 0,
        lightning: 0,
        braces: 0,
        sail: 0.34,
        funnel: 0.16,
        trail: 0.24
      },
      {
        key: "chain-slit",
        name: "Chain Slit",
        note: "Главный разрез поддерживается двумя вспомогательными трещинами, будто налет прошивает пространство пакетом.",
        read: "Хорошо продает coordinated strike и ощущение, что налет идет не из одной дырки, а из цепочки разломов.",
        aperture: 0.88,
        jagged: 0.12,
        petals: 0,
        teeth: 2,
        miniRifts: 2,
        lightning: 2,
        braces: 0,
        sail: 0.22,
        funnel: 0.08,
        trail: 0.18
      },
      {
        key: "smuggler-dock",
        name: "Smuggler Dock",
        note: "Рваный техно-портал с ребрами, фиксаторами и грубым индустриальным выбросом искр.",
        read: "Подходит, если пиратов хочется показать именно как грязную флотилию, выходящую из нелегального шлюза.",
        aperture: 1.06,
        jagged: 0.16,
        petals: 0,
        teeth: 0,
        miniRifts: 0,
        lightning: 0,
        braces: 6,
        sail: 0.28,
        funnel: 0.14,
        trail: 0.28
      },
      {
        key: "blood-horizon",
        name: "Blood Horizon",
        note: "Разлом раскрывается широкой алой раной с длинным горячим парусом и тяжелым натиском.",
        read: "Если налет должен ощущаться как событие уровня ультимейта, этот вариант сразу выглядит дороже и опаснее.",
        aperture: 1.18,
        jagged: 0.12,
        petals: 5,
        teeth: 4,
        miniRifts: 1,
        lightning: 1,
        braces: 0,
        sail: 0.40,
        funnel: 0.22,
        trail: 0.26
      },
      {
        key: "storm-ferry",
        name: "Storm Ferry",
        note: "Вход держится электрическим тоннелем, вокруг постоянно гуляют разряды и вихревая воронка.",
        read: "Самый нервный и подвижный вариант. Хорошо подходит для нестабильного хаотичного налета.",
        aperture: 0.96,
        jagged: 0.20,
        petals: 4,
        teeth: 0,
        miniRifts: 1,
        lightning: 7,
        braces: 0,
        sail: 0.16,
        funnel: 0.36,
        trail: 0.22
      }
    ],
    thermoNuke: [
      {
        key: "zero-halo",
        name: "Zero Halo",
        note: "Чистый бело-синий superweapon: аккуратный знак радиации, ровная ракета и мягкий ореол уничтожения.",
        read: "Базовый кандидат для финала, если нужен дорогой, собранный и читаемый nuclear-strike без лишней грязи.",
        arcLift: 146,
        trail: 0.16,
        ringCount: 4,
        rayCount: 10,
        embers: 14,
        shells: 3,
        halo: 0.18,
        darkCore: false,
        crown: false
      },
      {
        key: "reactor-spear",
        name: "Reactor Spear",
        note: "Ракета выглядит как прямой носитель ядра: длинный пунктир, холодное ядро и более жесткий след до детонации.",
        read: "Лучше всего продает саму ракету как носитель супероружия, а не абстрактный импульс.",
        arcLift: 132,
        trail: 0.22,
        ringCount: 3,
        rayCount: 8,
        embers: 12,
        shells: 2,
        halo: 0.14,
        darkCore: false,
        crown: false
      },
      {
        key: "azure-sanction",
        name: "Azure Sanction",
        note: "Взрыв больше похож на ядерную санкцию из белого и ледяного синего света с коротким остаточным жаром.",
        read: "Самый технологичный и холодный вариант. Хорошо подходит под white-blue nuclear fantasy.",
        arcLift: 154,
        trail: 0.18,
        ringCount: 5,
        rayCount: 14,
        embers: 16,
        shells: 4,
        halo: 0.22,
        darkCore: false,
        crown: true
      },
      {
        key: "null-drop",
        name: "Null Drop",
        note: "После вспышки быстро открывается короткий вакуумный провал, будто центр удара вырывает воздух и свет из пространства.",
        read: "Нужен, если в термоядерном импульсе важно чувство brief vacuum-collapse после основного white flash.",
        arcLift: 140,
        trail: 0.16,
        ringCount: 4,
        rayCount: 12,
        embers: 10,
        shells: 3,
        halo: 0.16,
        darkCore: true,
        crown: false
      },
      {
        key: "sapphire-cathedral",
        name: "Sapphire Cathedral",
        note: "Больше структурных колец, стройная пунктирная дуга и ощущение high-order doomsday weapon из ядра.",
        read: "Если нужен почти сакральный superweapon-язык, это самый выразительный и дорогой вариант.",
        arcLift: 176,
        trail: 0.15,
        ringCount: 6,
        rayCount: 16,
        embers: 10,
        shells: 5,
        halo: 0.20,
        darkCore: false,
        crown: true
      },
      {
        key: "quietus-engine",
        name: "Quietus Engine",
        note: "Ракета приходит тяжелее, удар мягко нарастает и затем стирает флот почти бесшумным белым ядром с коротким heat-afterglow.",
        read: "Подходит, если wipe должен ощущаться не как хаос, а как неизбежное controlled extinction событие.",
        arcLift: 150,
        trail: 0.19,
        ringCount: 5,
        rayCount: 11,
        embers: 18,
        shells: 4,
        halo: 0.18,
        darkCore: true,
        crown: false
      }
    ],
    nanoSwarm: [
      {
        key: "grey-goo",
        name: "Grey Goo",
        note: "Плотная масса микрочастиц и блеклый коррозионный туман, который физически съедает корпус.",
        read: "Лучший вариант, если НАНОРОЙ должен ощущаться именно как технологическая чума, а не магический газ.",
        fog: 0.26,
        cells: 26,
        tendrils: 8,
        shards: 0,
        telemetry: false,
        eclipse: false,
        halo: 0.14
      },
      {
        key: "hunter-fog",
        name: "Hunter Fog",
        note: "Облако живет как хищник: длинные усики тянутся к кораблям, а ядро будто преследует цель внутри зоны.",
        read: "Самый агрессивный вариант. Хорошо продает, что облако не просто висит, а actively hunts targets.",
        fog: 0.22,
        cells: 18,
        tendrils: 14,
        shards: 4,
        telemetry: false,
        eclipse: false,
        halo: 0.18
      },
      {
        key: "prism-spore",
        name: "Prism Spore",
        note: "Светящиеся ячейки и спороподобные сгустки делают облако более биотехнологичным и экзотическим.",
        read: "Подходит, если хочется чуть более alien-настроения без потери sci-fi читаемости.",
        fog: 0.18,
        cells: 32,
        tendrils: 6,
        shards: 2,
        telemetry: false,
        eclipse: false,
        halo: 0.22
      },
      {
        key: "razor-mist",
        name: "Razor Mist",
        note: "Облако не мягкое, а режущее: больше шардов, полос и сухой механической коррозии.",
        read: "Хорошо работает, если НАНОРОЙ должен ощущаться как micro-blade storm, а не классический туман.",
        fog: 0.14,
        cells: 12,
        tendrils: 5,
        shards: 20,
        telemetry: false,
        eclipse: false,
        halo: 0.12
      },
      {
        key: "lattice-bloom",
        name: "Lattice Bloom",
        note: "Внутри облака видны сетки, бракетты и цифровые соты, как будто зона управляется роем-алгоритмом.",
        read: "Лучшая подача для более \"умного\" нанооблака с читаемым debuff и high-tech характером.",
        fog: 0.16,
        cells: 24,
        tendrils: 8,
        shards: 6,
        telemetry: true,
        eclipse: false,
        halo: 0.20
      },
      {
        key: "eclipse-mites",
        name: "Eclipse Mites",
        note: "Темное ядро и яркие укусы по краям делают облако опасным даже в силуэте, без лишней молочной дымки.",
        read: "Самый контрастный и мрачный вариант. Хорошо читается на темной карте и не растворяется в фоне.",
        fog: 0.20,
        cells: 20,
        tendrils: 10,
        shards: 10,
        telemetry: false,
        eclipse: true,
        halo: 0.16
      }
    ]
  };

  var state = {
    time: 0,
    cycleOrigin: 0,
    effectIndex: 0,
    stars: [],
    variantByEffect: {
      pirateRaid: 0,
      thermoNuke: 0,
      nanoSwarm: 0
    }
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

  function quadraticPoint(a, b, c, t) {
    var ab = lerp(a, b, t);
    var bc = lerp(b, c, t);
    return lerp(ab, bc, t);
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

  function getEffect() {
    return EFFECTS[state.effectIndex] || EFFECTS[0];
  }

  function getVariantList(effectId) {
    return VARIANTS_BY_EFFECT[effectId] || [];
  }

  function getVariantIndex(effectId) {
    var list = getVariantList(effectId);
    var index = state.variantByEffect[effectId] || 0;
    if (!list.length) return 0;
    return Math.max(0, Math.min(list.length - 1, index));
  }

  function getVariant() {
    var effect = getEffect();
    var list = getVariantList(effect.id);
    return list[getVariantIndex(effect.id)] || list[0];
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
    if (radius > 0.80 || tempo > 1.08) return "far";
    if (radius > 0.56 || tempo > 0.84) return "mid";
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

    var haze = ctx.createRadialGradient(width * 0.60, height * 0.42, 0, width * 0.60, height * 0.42, Math.max(width, height) * 0.58);
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

  function drawCore(x, y, radius, palette) {
    var grad = ctx.createRadialGradient(x, y, radius * 0.08, x, y, radius);
    grad.addColorStop(0, rgbaHex(palette.trim, 0.84));
    grad.addColorStop(0.34, rgbaHex(palette.core, 0.34));
    grad.addColorStop(1, rgbaHex(palette.core, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
    drawRing(x, y, radius * 0.56, palette.trim, 0.42, 2);
  }

  function drawTargetArea(cx, cy, radius, palette, variantPower) {
    var pulse = 0.5 + 0.5 * Math.sin(state.time * (1.0 + variantPower * 0.3));
    drawRing(cx, cy, radius, palette.line, 0.18 + pulse * 0.10, 2.2);
    drawRing(cx, cy, radius * 0.72, palette.core, 0.08 + pulse * 0.06, 1.2);
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

  function drawRadiationPreview(x, y, radius, palette, alpha, spin) {
    var phase = spin || 0;
    var hubR = radius * 0.15;
    var bladeInner = radius * 0.27;
    var bladeOuter = radius * 0.78;
    var bladeWidth = 0.56;
    var pulse = 0.5 + 0.5 * Math.sin(state.time * 1.8);

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fillStyle = rgbaHex(palette.dark, 0.08 * alpha);
    ctx.fill();

    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -state.time * 18;
    drawRing(x, y, radius, palette.trim, (0.18 + pulse * 0.12) * alpha, 2.4);
    ctx.setLineDash([]);
    drawRing(x, y, radius * 0.84, palette.core, 0.12 * alpha, 1.2);

    for (var i = 0; i < 3; i++) {
      var ang = phase + (i / 3) * TAU - Math.PI * 0.5;
      var bladeGrad = ctx.createRadialGradient(x, y, bladeInner * 0.8, x, y, bladeOuter);
      bladeGrad.addColorStop(0, rgbaHex(palette.trim, 0.28 * alpha));
      bladeGrad.addColorStop(0.45, rgbaHex(palette.core, 0.16 * alpha));
      bladeGrad.addColorStop(1, rgbaHex(palette.core, 0));
      ctx.fillStyle = bladeGrad;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang - bladeWidth * 0.36) * bladeInner, y + Math.sin(ang - bladeWidth * 0.36) * bladeInner);
      ctx.arc(x, y, bladeOuter, ang - bladeWidth * 0.5, ang + bladeWidth * 0.5);
      ctx.arc(x, y, bladeInner, ang + bladeWidth * 0.28, ang - bladeWidth * 0.28, true);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = rgbaHex(palette.trim, (0.24 + pulse * 0.08) * alpha);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, bladeOuter * 0.92, ang - bladeWidth * 0.28, ang + bladeWidth * 0.28);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(x, y, hubR * 2.2, 0, TAU);
    ctx.fillStyle = rgbaHex(palette.core, 0.10 * alpha);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, hubR, 0, TAU);
    ctx.fillStyle = rgbaHex(palette.trim, 0.76 * alpha);
    ctx.fill();
    drawRing(x, y, hubR * 1.56, palette.trim, 0.36 * alpha, 1.4);
    drawTelemetryBrackets(x, y, radius * 0.82, palette, (0.18 + pulse * 0.06) * alpha, 1.2);
    ctx.restore();
  }

  function drawIrregularContour(x, y, radius, wobble, points, color, alpha, width, spin) {
    ctx.beginPath();
    for (var i = 0; i <= points; i++) {
      var t = i / Math.max(1, points);
      var ang = t * TAU + (spin || 0);
      var wave = Math.sin(ang * 3.0 + state.time * 0.9) * wobble + Math.cos(ang * 5.0 - state.time * 0.7) * wobble * 0.58;
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

  function drawThermoBlastBloom(x, y, killRadius, fade, expand, flashK, palette, variant) {
    var blastR = killRadius * (0.28 + expand * 1.02);
    var coreR = killRadius * (0.14 + expand * 0.22);
    var petalCount = Math.max(6, Math.floor(variant.rayCount * 0.45));
    var shellCount = Math.max(3, variant.ringCount || variant.shells || 3);
    var plume = ctx.createRadialGradient(x, y, 0, x, y, blastR * 1.24);
    plume.addColorStop(0, rgbaHex(palette.trim, 0.94 * flashK));
    plume.addColorStop(0.12, rgbaHex(palette.trim, 0.52 * fade));
    plume.addColorStop(0.34, rgbaHex(palette.core, (0.26 + variant.halo * 0.14) * fade));
    plume.addColorStop(0.62, rgbaHex(palette.core, 0.12 * fade));
    plume.addColorStop(1, rgbaHex(palette.core, 0));
    ctx.fillStyle = plume;
    ctx.beginPath();
    ctx.arc(x, y, blastR * 1.24, 0, TAU);
    ctx.fill();

    for (var p = 0; p < petalCount; p++) {
      var ang = (p / petalCount) * TAU + expand * 0.26 + (p % 2 === 0 ? 0.08 : -0.08);
      var lobeDist = blastR * (0.18 + (p % 3) * 0.05);
      var lobeR = blastR * (0.26 + (p % 4) * 0.04);
      var lx = x + Math.cos(ang) * lobeDist;
      var ly = y + Math.sin(ang) * lobeDist;
      var lobeGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, lobeR);
      lobeGrad.addColorStop(0, rgbaHex(palette.trim, 0.14 * fade));
      lobeGrad.addColorStop(0.38, rgbaHex(palette.core, 0.12 * fade));
      lobeGrad.addColorStop(1, rgbaHex(palette.core, 0));
      ctx.fillStyle = lobeGrad;
      ctx.beginPath();
      ctx.arc(lx, ly, lobeR, 0, TAU);
      ctx.fill();
    }

    if (variant.darkCore) {
      ctx.fillStyle = rgbaHex(palette.dark, 0.18 * fade);
      ctx.beginPath();
      ctx.arc(x, y, blastR * 0.74, 0, TAU);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(x, y, coreR, 0, TAU);
    ctx.fillStyle = rgbaHex(palette.trim, 0.18 * fade);
    ctx.fill();

    var vacuumK = smoothstep(0.10, 0.34, expand) * (1 - smoothstep(0.62, 0.94, expand));
    if (vacuumK > 0.001) {
      ctx.fillStyle = rgbaHex(palette.dark, (0.16 + (variant.darkCore ? 0.08 : 0.03)) * vacuumK);
      ctx.beginPath();
      ctx.arc(x, y, blastR * (0.22 + vacuumK * 0.16), 0, TAU);
      ctx.fill();
      drawRing(x, y, blastR * (0.20 + vacuumK * 0.18), palette.trim, 0.16 * vacuumK, 1.2);
    }

    for (var s = 0; s < shellCount; s++) {
      var frac = shellCount <= 1 ? 0 : s / (shellCount - 1);
      var shellR = blastR * (0.76 + frac * 0.60);
      drawIrregularContour(x, y, shellR, shellR * 0.03 * (1.0 + frac * 0.4), 52, s % 2 === 0 ? palette.trim : palette.core, (0.28 - frac * 0.04) * fade, 2.0 + frac * 0.7, s * 0.2 + expand * 0.18);
    }

    drawRing(x, y, killRadius * (0.82 + expand * 0.26), palette.trim, 0.58 * fade, 4.8);
    drawRing(x, y, killRadius * (0.60 + expand * 0.18), palette.core, 0.24 * fade, 2.4);
    drawRing(x, y, blastR * 1.18, palette.core, 0.08 * fade, 1.2);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(expand * 0.32);
    ctx.scale(1, 0.62);
    drawRing(0, 0, blastR * 0.96, palette.trim, 0.16 * fade, 2.6);
    drawRing(0, 0, blastR * 1.22, palette.core, 0.10 * fade, 1.4);
    ctx.restore();
  }

  function drawBurstRays(x, y, count, innerRadius, outerRadius, color, alpha, width, spin) {
    for (var i = 0; i < count; i++) {
      var ang = (i / count) * TAU + (spin || 0);
      ctx.strokeStyle = rgbaHex(color, alpha * (0.7 + (i % 3) * 0.15));
      ctx.lineWidth = width || 1.2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * innerRadius, y + Math.sin(ang) * innerRadius);
      ctx.lineTo(x + Math.cos(ang) * outerRadius, y + Math.sin(ang) * outerRadius);
      ctx.stroke();
    }
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
    } else if (classKey === "carrier") {
      ctx.moveTo(5.0, 0);
      ctx.lineTo(2.8, -1.18);
      ctx.lineTo(-0.2, -1.38);
      ctx.lineTo(-2.8, -0.86);
      ctx.lineTo(-4.0, 0);
      ctx.lineTo(-2.8, 0.86);
      ctx.lineTo(-0.2, 1.38);
      ctx.lineTo(2.8, 1.18);
    } else {
      ctx.moveTo(5.4, 0);
      ctx.lineTo(2.5, -1.16);
      ctx.lineTo(0.4, -1.66);
      ctx.lineTo(-1.8, -1.14);
      ctx.lineTo(-3.6, -0.36);
      ctx.lineTo(-4.2, 0);
      ctx.lineTo(-3.6, 0.36);
      ctx.lineTo(-1.8, 1.14);
      ctx.lineTo(0.4, 1.66);
      ctx.lineTo(2.5, 1.16);
    }
    ctx.closePath();
  }

  function drawShipSilhouette(x, y, angle, scale, classKey, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    traceShipHullPath(classKey);
    ctx.fillStyle = "rgba(246,250,255," + (0.84 * alpha) + ")";
    ctx.fill();
    ctx.strokeStyle = "rgba(184,224,255," + (0.46 * alpha) + ")";
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

    ctx.strokeStyle = rgbaHex(colors.fill, 0.28 * hullAlpha);
    ctx.lineWidth = 0.22;
    ctx.beginPath();
    ctx.moveTo(-1.1, -0.16);
    ctx.lineTo(-2.0, -0.08);
    ctx.moveTo(-1.1, 0.16);
    ctx.lineTo(-2.0, 0.08);
    ctx.stroke();

    ctx.restore();
  }

  function drawDebrisField(x, y, radius, count, angle, palette, alpha) {
    for (var i = 0; i < count; i++) {
      var seed = 17 + i * 23;
      var ang = angle + (hash01(seed + radius) - 0.5) * 2.6;
      var dist = radius * (0.18 + hash01(seed + 1) * 0.86);
      var len = 4 + hash01(seed + 2) * 12;
      var px = x + Math.cos(ang) * dist;
      var py = y + Math.sin(ang) * dist;
      ctx.strokeStyle = i % 2 === 0 ? rgbaHex(palette.trim, alpha * 0.28) : rgba(palette.glow, alpha * 0.20);
      ctx.lineWidth = 1.0 + hash01(seed + 3) * 1.2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
      ctx.stroke();
    }
  }

  function drawPirateRift(x, y, angle, radius, palette, variant, openK) {
    var perpAngle = angle + Math.PI * 0.5;
    var openRadius = radius * (0.42 + openK * 0.72) * variant.aperture;
    var slitRadius = openRadius * (0.30 + openK * 0.36);
    var halo = ctx.createRadialGradient(x, y, 0, x, y, openRadius * 1.6);
    halo.addColorStop(0, rgbaHex(palette.trim, 0.22 * openK));
    halo.addColorStop(0.26, rgbaHex(palette.core, 0.16 * openK));
    halo.addColorStop(1, rgbaHex(palette.core, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, openRadius * 1.6, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(perpAngle + Math.sin(state.time * 0.22) * variant.jagged * 0.5);

    if (variant.funnel > 0.01) {
      for (var f = 0; f < 3; f++) {
        ctx.strokeStyle = rgba(palette.glow, (0.08 + f * 0.04) * openK);
        ctx.lineWidth = 1.2 + f * 0.9;
        ctx.beginPath();
        ctx.ellipse(0, 0, openRadius * (1.04 + f * 0.10), slitRadius * (0.82 + f * 0.16), 0, 0, TAU);
        ctx.stroke();
      }
    }

    ctx.fillStyle = rgbaHex(palette.dark, 0.92 * openK);
    ctx.beginPath();
    ctx.ellipse(0, 0, openRadius, slitRadius, 0, 0, TAU);
    ctx.fill();

    for (var i = 0; i < 2; i++) {
      var wobble = Math.sin(state.time * (2.0 + i * 0.3) + i * 1.7) * slitRadius * (0.24 + variant.jagged * 0.4);
      ctx.strokeStyle = i === 0 ? rgbaHex(palette.trim, 0.74 * openK) : rgbaHex(palette.core, 0.34 * openK);
      ctx.lineWidth = i === 0 ? 2.8 : 5.4;
      ctx.beginPath();
      ctx.moveTo(-openRadius * 0.82, wobble);
      ctx.bezierCurveTo(-openRadius * 0.24, -slitRadius * 0.84, openRadius * 0.24, slitRadius * 0.84, openRadius * 0.82, -wobble);
      ctx.stroke();
    }

    for (var p = 0; p < variant.petals; p++) {
      var petalAng = (p / Math.max(1, variant.petals)) * TAU + state.time * 0.12 * (p % 2 === 0 ? 1 : -1);
      var petalR = openRadius * 1.06;
      var px = Math.cos(petalAng) * petalR;
      var py = Math.sin(petalAng) * slitRadius * 1.6;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(petalAng);
      ctx.beginPath();
      ctx.moveTo(-openRadius * 0.12, -openRadius * 0.04);
      ctx.lineTo(openRadius * 0.24, 0);
      ctx.lineTo(-openRadius * 0.12, openRadius * 0.04);
      ctx.closePath();
      ctx.fillStyle = rgbaHex(palette.trim, 0.28 * openK);
      ctx.fill();
      ctx.restore();
    }

    for (var t = 0; t < variant.teeth; t++) {
      var toothT = variant.teeth <= 1 ? 0.5 : t / (variant.teeth - 1);
      var tx = lerp(-openRadius * 0.82, openRadius * 0.82, toothT);
      var toothDir = t % 2 === 0 ? -1 : 1;
      ctx.strokeStyle = rgbaHex(palette.trim, 0.36 * openK);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(tx, toothDir * slitRadius * 0.42);
      ctx.lineTo(tx + openRadius * 0.05, toothDir * slitRadius * 0.86);
      ctx.stroke();
    }

    for (var b = 0; b < variant.braces; b++) {
      var braceAng = (b / Math.max(1, variant.braces)) * TAU + state.time * 0.04;
      var braceR = openRadius * (1.18 + (b % 2) * 0.08);
      var bx = Math.cos(braceAng) * braceR;
      var by = Math.sin(braceAng) * slitRadius * 2.1;
      ctx.strokeStyle = rgbaHex(palette.line, 0.28 * openK);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx * 0.72, by * 0.72);
      ctx.stroke();
    }

    ctx.restore();

    for (var m = 0; m < variant.miniRifts; m++) {
      var side = m % 2 === 0 ? -1 : 1;
      var offs = radius * (0.36 + m * 0.08);
      drawRing(x + Math.cos(perpAngle) * offs * side, y + Math.sin(perpAngle) * offs * side, openRadius * 0.34, palette.trim, 0.16 * openK, 1.6);
      drawRing(x + Math.cos(perpAngle) * offs * side, y + Math.sin(perpAngle) * offs * side, openRadius * 0.22, palette.core, 0.14 * openK, 1.1);
    }

    for (var j = 0; j < variant.lightning; j++) {
      var jAng = angle + (hash01(j + 91) - 0.5) * 1.4;
      var startR = openRadius * (0.74 + hash01(j + 21) * 0.30);
      var endR = openRadius * (1.22 + hash01(j + 33) * 0.42);
      var sx = x + Math.cos(jAng) * startR;
      var sy = y + Math.sin(jAng) * startR;
      var mx = x + Math.cos(jAng + 0.12) * (startR + endR) * 0.5 + Math.sin(state.time * 2.0 + j) * 8;
      var my = y + Math.sin(jAng + 0.12) * (startR + endR) * 0.5 - Math.cos(state.time * 2.0 + j) * 8;
      var ex = x + Math.cos(jAng) * endR;
      var ey = y + Math.sin(jAng) * endR;
      ctx.strokeStyle = rgbaHex(palette.trim, 0.22 * openK);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(mx, my);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
  }

  function drawPirateRaid(width, height, palette, variant, lodKey) {
    var tempo = getTempo();
    var radius = lerp(92, 170, getRadiusFactor());
    var targetX = width * 0.72;
    var targetY = height * 0.50;
    var angle = -0.48;
    var dist = lerp(280, 360, getRadiusFactor());
    var riftX = targetX - Math.cos(angle) * dist;
    var riftY = targetY - Math.sin(angle) * dist;
    var nx = -Math.sin(angle);
    var ny = Math.cos(angle);
    var prepSec = 0.70 / Math.max(0.46, tempo);
    var flightSec = 1.56 / Math.max(0.52, tempo);
    var waveSec = 1.10 / Math.max(0.52, tempo);
    var cooldownSec = 0.72;
    var totalCycleSec = prepSec + flightSec + waveSec + cooldownSec;
    var cycleSec = ((state.time - state.cycleOrigin) % totalCycleSec + totalCycleSec) % totalCycleSec;
    var openK = smoothstep(0.04, prepSec * 0.82, cycleSec) * (1 - smoothstep(prepSec + flightSec + waveSec * 0.72, totalCycleSec - 0.02, cycleSec));
    var raidGlow = 0.5 + 0.5 * Math.sin(state.time * 1.4);
    var corridorHalfW = radius * 0.26;
    var arrivalR = radius * 0.76;
    var shipData = [
      { classKey: "fighter", size: 6.2, lane: -2.8, owner: 0, launch: 0.14 },
      { classKey: "fighter", size: 6.0, lane: -1.8, owner: 0, launch: 0.22 },
      { classKey: "fighter", size: 6.0, lane: -0.9, owner: 1, launch: 0.30 },
      { classKey: "fighter", size: 6.2, lane: 0.2, owner: 0, launch: 0.38 },
      { classKey: "fighter", size: 6.0, lane: 1.2, owner: 1, launch: 0.46 },
      { classKey: "destroyer", size: 8.8, lane: -1.4, owner: 2, launch: 0.56 },
      { classKey: "destroyer", size: 8.8, lane: 0.8, owner: 2, launch: 0.68 },
      { classKey: "cruiser", size: 11.6, lane: 0.0, owner: 3, launch: 0.82 }
    ];

    drawTargetArea(targetX, targetY, arrivalR, palette, variant.aperture);
    drawTelemetryBrackets(targetX, targetY, arrivalR * 0.76, palette, 0.16 + raidGlow * 0.08, 1.5);

    ctx.fillStyle = rgba(palette.glow, variant.trail * 0.42 * openK);
    ctx.beginPath();
    ctx.moveTo(riftX + nx * corridorHalfW, riftY + ny * corridorHalfW);
    ctx.lineTo(targetX + nx * corridorHalfW * 0.8, targetY + ny * corridorHalfW * 0.8);
    ctx.lineTo(targetX - nx * corridorHalfW * 0.8, targetY - ny * corridorHalfW * 0.8);
    ctx.lineTo(riftX - nx * corridorHalfW, riftY - ny * corridorHalfW);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = rgbaHex(palette.trim, 0.20 * openK);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(riftX, riftY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();

    for (var c = 0; c < 6; c++) {
      var frac = (c + 1) / 7;
      var px = lerp(riftX, targetX, frac);
      var py = lerp(riftY, targetY, frac);
      var arrowScale = 12 + c * 1.4;
      ctx.strokeStyle = rgbaHex(palette.trim, (0.10 + frac * 0.08) * openK);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px - Math.cos(angle) * arrowScale - nx * arrowScale * 0.36, py - Math.sin(angle) * arrowScale - ny * arrowScale * 0.36);
      ctx.lineTo(px, py);
      ctx.lineTo(px - Math.cos(angle) * arrowScale + nx * arrowScale * 0.36, py - Math.sin(angle) * arrowScale + ny * arrowScale * 0.36);
      ctx.stroke();
    }

    drawPirateRift(riftX, riftY, angle, radius * 0.42, palette, variant, openK);

    for (var i = 0; i < shipData.length; i++) {
      var ship = shipData[i];
      var launchAt = prepSec * (0.24 + ship.launch * 0.76);
      var arriveAt = launchAt + flightSec * (0.72 + i * 0.04);
      var skirmishAge = cycleSec - arriveAt;
      var spawnAge = cycleSec - launchAt;
      var laneSpread = ship.lane * 14;
      var baseStartX = riftX - Math.cos(angle) * 26 + nx * laneSpread;
      var baseStartY = riftY - Math.sin(angle) * 26 + ny * laneSpread;
      var endX = targetX + nx * laneSpread * 0.52 + Math.cos(angle) * 12;
      var endY = targetY + ny * laneSpread * 0.52 + Math.sin(angle) * 12;
      if (spawnAge >= 0 && spawnAge <= arriveAt - launchAt) {
        var travel = clamp01(spawnAge / Math.max(0.001, arriveAt - launchAt));
        var eased = smoothstep(0, 1, travel);
        var sway = Math.sin(state.time * (1.4 + i * 0.1) + i * 1.3) * variant.funnel * 18 * (1 - eased * 0.68);
        var x = lerp(baseStartX, endX, eased) + nx * sway;
        var y = lerp(baseStartY, endY, eased) + ny * sway;
        var trailLen = ship.size * (3.8 + variant.sail * 5 + eased * 2);
        drawShipTrail(x, y, angle, trailLen, palette.trim, variant.trail + 0.12, ship.classKey === "fighter" ? 1.5 : 2.2);
        if (variant.sail > 0.01) {
          drawShipTrail(x - nx * ship.size * 0.18, y - ny * ship.size * 0.18, angle, trailLen * (0.54 + variant.sail), palette.core, variant.sail * 0.18, 1.1);
          drawShipTrail(x + nx * ship.size * 0.18, y + ny * ship.size * 0.18, angle, trailLen * (0.54 + variant.sail), palette.core, variant.sail * 0.18, 1.1);
        }
        drawShipSprite(x, y, angle, ship.size, ship.classKey, ship.owner, 1);
      }
      if (skirmishAge >= 0 && skirmishAge <= waveSec) {
        var skirmishK = 1 - smoothstep(0, waveSec, skirmishAge);
        var holdX = endX + Math.cos(angle + Math.PI * 0.5) * Math.sin(skirmishAge * 2.4 + i) * 18;
        var holdY = endY + Math.sin(angle + Math.PI * 0.5) * Math.sin(skirmishAge * 2.4 + i) * 18;
        drawShipSprite(holdX, holdY, angle + Math.sin(skirmishAge * 2 + i) * 0.12, ship.size, ship.classKey, ship.owner, skirmishK);
        if (i < 5) {
          ctx.strokeStyle = rgbaHex(palette.trim, 0.34 * skirmishK);
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(holdX, holdY);
          ctx.lineTo(holdX + Math.cos(angle + 0.26 + i * 0.08) * 34, holdY + Math.sin(angle + 0.26 + i * 0.08) * 34);
          ctx.stroke();
        }
      }
    }

    if (cycleSec > prepSec + flightSec * 0.54) {
      var salvoK = 1 - smoothstep(prepSec + flightSec * 0.54, totalCycleSec - 0.08, cycleSec);
      drawBurstRays(targetX, targetY, 10, 16, arrivalR * (0.62 + raidGlow * 0.12), palette.trim, 0.12 * salvoK, 1.4, state.time * 0.16);
      drawDebrisField(targetX, targetY, arrivalR * 0.68, lodKey === "far" ? 8 : 14, angle, palette, 0.52 * salvoK);
    }
  }

  function drawMissileBody(x, y, angle, scale, palette, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    var bodyGrad = ctx.createLinearGradient(-11, 0, 10, 0);
    bodyGrad.addColorStop(0, rgbaHex(palette.dark, 0.94 * alpha));
    bodyGrad.addColorStop(0.46, rgbaHex(palette.core, 0.88 * alpha));
    bodyGrad.addColorStop(1, rgbaHex(palette.trim, 0.96 * alpha));

    ctx.beginPath();
    ctx.moveTo(11.2, 0);
    ctx.lineTo(6.8, -2.8);
    ctx.lineTo(-5.8, -2.8);
    ctx.lineTo(-8.8, -1.6);
    ctx.lineTo(-10.4, 0);
    ctx.lineTo(-8.8, 1.6);
    ctx.lineTo(-5.8, 2.8);
    ctx.lineTo(6.8, 2.8);
    ctx.closePath();
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = rgbaHex(palette.trim, 0.82 * alpha);
    ctx.lineWidth = 0.55;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(11.2, 0);
    ctx.lineTo(7.0, -2.3);
    ctx.lineTo(7.0, 2.3);
    ctx.closePath();
    ctx.fillStyle = rgbaHex(palette.trim, 0.92 * alpha);
    ctx.fill();

    ctx.fillStyle = rgbaHex(palette.dark, 0.58 * alpha);
    ctx.fillRect(-5.6, -1.5, 8.0, 3.0);

    ctx.fillStyle = rgbaHex(palette.trim, 0.24 * alpha);
    ctx.fillRect(-4.8, -0.28, 6.6, 0.56);

    ctx.beginPath();
    ctx.moveTo(-2.8, -2.8);
    ctx.lineTo(-7.2, -5.2);
    ctx.lineTo(-5.0, -1.5);
    ctx.closePath();
    ctx.fillStyle = rgbaHex(palette.trim, 0.48 * alpha);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-2.8, 2.8);
    ctx.lineTo(-7.2, 5.2);
    ctx.lineTo(-5.0, 1.5);
    ctx.closePath();
    ctx.fillStyle = rgbaHex(palette.trim, 0.48 * alpha);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(4.1, 0, 1.55, 0, TAU);
    ctx.fillStyle = rgbaHex(palette.trim, 0.92 * alpha);
    ctx.fill();

    var flame = ctx.createLinearGradient(-13, 0, -5.6, 0);
    flame.addColorStop(0, rgbaHex(palette.core, 0));
    flame.addColorStop(0.34, rgbaHex(palette.core, 0.32 * alpha));
    flame.addColorStop(1, rgbaHex(palette.trim, 0.72 * alpha));
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(-5.8, -1.3);
    ctx.lineTo(-11.8, -0.6);
    ctx.lineTo(-14.4, 0);
    ctx.lineTo(-11.8, 0.6);
    ctx.lineTo(-5.8, 1.3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawThermoNuke(width, height, palette, variant, lodKey) {
    var tempo = getTempo();
    var thermoPalette = THERMO_PALETTE;
    var killRadius = lerp(132, 250, getRadiusFactor());
    var coreX = width * 0.22;
    var coreY = height * 0.74;
    var targetX = width * 0.72;
    var targetY = height * 0.46;
    var startX = coreX + 26;
    var startY = coreY - 10;
    var ctrlX = lerp(startX, targetX, 0.42);
    var ctrlY = Math.min(startY, targetY) - variant.arcLift;
    var chargeSec = 1.72 / Math.max(0.80, tempo);
    var flightSec = 1.08 / Math.max(0.58, tempo);
    var detSec = 1.66 / Math.max(0.82, tempo);
    var cooldownSec = 0.90;
    var totalCycleSec = chargeSec + flightSec + detSec + cooldownSec;
    var cycleSec = ((state.time - state.cycleOrigin) % totalCycleSec + totalCycleSec) % totalCycleSec;
    var launchAge = cycleSec - chargeSec;
    var impactAge = cycleSec - chargeSec - flightSec;
    var missileVisible = launchAge >= 0 && launchAge <= flightSec + 0.03;
    var strikeGlow = 0.5 + 0.5 * Math.sin(state.time * 0.9);
    var previewAlpha = 1 - smoothstep(0, detSec * 0.12, Math.max(0, impactAge));
    var pathAlpha = missileVisible
      ? 0.20 + 0.10 * (1 - clamp01(launchAge / Math.max(0.001, flightSec)))
      : smoothstep(0.08, chargeSec * 0.84, cycleSec) * 0.26;
    var shipSet = [
      { x: targetX - killRadius * 0.34, y: targetY - killRadius * 0.18, size: 9.6, cls: "destroyer", owner: 0, inside: true },
      { x: targetX + killRadius * 0.24, y: targetY - killRadius * 0.26, size: 12.2, cls: "cruiser", owner: 1, inside: true },
      { x: targetX - killRadius * 0.12, y: targetY + killRadius * 0.18, size: 7.2, cls: "fighter", owner: 2, inside: true },
      { x: targetX + killRadius * 0.08, y: targetY + killRadius * 0.06, size: 14.2, cls: "battleship", owner: 3, inside: true },
      { x: targetX + killRadius * 0.52, y: targetY + killRadius * 0.22, size: 11.4, cls: "carrier", owner: 0, inside: true },
      { x: targetX - killRadius * 0.96, y: targetY + killRadius * 0.34, size: 10.2, cls: "destroyer", owner: 1, inside: false },
      { x: targetX + killRadius * 1.02, y: targetY - killRadius * 0.18, size: 8.0, cls: "fighter", owner: 2, inside: false }
    ];

    drawCore(coreX, coreY, 42, thermoPalette);
    drawRing(coreX, coreY, 62, thermoPalette.core, 0.10 + strikeGlow * 0.06, 1.2);
    drawRadiationPreview(targetX, targetY, killRadius, thermoPalette, previewAlpha * 0.78, state.time * 0.14);

    if (pathAlpha > 0.001) {
      ctx.save();
      ctx.setLineDash([9, 10]);
      ctx.lineDashOffset = -state.time * 28;
      ctx.strokeStyle = rgbaHex(thermoPalette.trim, pathAlpha);
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, targetX, targetY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = rgbaHex(thermoPalette.core, pathAlpha * 0.46);
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, targetX, targetY);
      ctx.stroke();
      ctx.restore();
    }

    for (var cr = 0; cr < 3; cr++) {
      var chargeCenter = chargeSec * (0.32 + cr * 0.16);
      var chargePulse = 1 - clamp01(Math.abs(cycleSec - chargeCenter) / (chargeSec * 0.42 + 0.12));
      drawRing(coreX, coreY, 20 + cr * 12, thermoPalette.trim, 0.06 + chargePulse * 0.16, 1.4 + chargePulse * 1.2);
    }

    for (var s = 0; s < shipSet.length; s++) {
      var ship = shipSet[s];
      var fade = ship.inside ? 1 - smoothstep(0, detSec * 0.16, Math.max(0, impactAge)) : 1;
      var alpha = ship.inside ? Math.max(0.08, fade) : 0.86;
      drawShipSprite(ship.x, ship.y, -0.18 + s * 0.1, ship.size, ship.cls, ship.owner, alpha);
      if (ship.inside && impactAge >= 0 && impactAge <= detSec * 0.40) {
        var deathK = 1 - smoothstep(0, detSec * 0.40, impactAge);
        drawShipSilhouette(ship.x, ship.y, -0.18 + s * 0.1, ship.size * (1.04 + (1 - deathK) * 0.08), ship.cls, deathK);
      }
    }

    if (missileVisible) {
      var travel = clamp01(launchAge / Math.max(0.001, flightSec));
      var eased = Math.pow(travel, 1.85);
      var mx = quadraticPoint(startX, ctrlX, targetX, eased);
      var my = quadraticPoint(startY, ctrlY, targetY, eased);
      var backT = Math.max(0, eased - 0.12);
      var tailX = quadraticPoint(startX, ctrlX, targetX, backT);
      var tailY = quadraticPoint(startY, ctrlY, targetY, backT);
      var headT = Math.min(1, eased + 0.03);
      var headRefX = quadraticPoint(startX, ctrlX, targetX, headT);
      var headRefY = quadraticPoint(startY, ctrlY, targetY, headT);
      var angle = Math.atan2(headRefY - my, headRefX - mx);
      var trailFade = 1 - smoothstep(0.84, 1.0, travel);
      ctx.lineCap = "round";
      ctx.strokeStyle = rgba(thermoPalette.glow, (variant.trail + 0.08) * 0.36 * trailFade);
      ctx.lineWidth = 7.6;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, mx, my);
      ctx.stroke();
      ctx.save();
      ctx.setLineDash([8, 10]);
      ctx.lineDashOffset = -state.time * 34;
      ctx.strokeStyle = rgbaHex(thermoPalette.trim, (variant.trail + 0.14) * trailFade);
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.quadraticCurveTo(lerp(tailX, ctrlX, 0.5), lerp(tailY, ctrlY, 0.5), mx, my);
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = rgbaHex(thermoPalette.trim, 0.10 * trailFade);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(mx - Math.cos(angle) * 18, my - Math.sin(angle) * 18);
      ctx.lineTo(mx + Math.cos(angle) * 9, my + Math.sin(angle) * 9);
      ctx.stroke();
      drawMissileBody(mx, my, angle, 1.0 + variant.halo * 0.6, thermoPalette, trailFade);
    }

    if (impactAge >= 0 && impactAge <= detSec) {
      var fade = 1 - smoothstep(0, detSec, impactAge);
      var expand = smoothstep(0, detSec, impactAge);
      var flashK = 1 - smoothstep(0, detSec * 0.22, impactAge);
      var blastR = killRadius * (0.28 + expand * 1.02);
      drawThermoBlastBloom(targetX, targetY, killRadius, fade, expand, flashK, thermoPalette, variant);

      for (var emb = 0; emb < variant.embers; emb++) {
        var embT = emb / Math.max(1, variant.embers - 1);
        var embAng = embT * TAU + impactAge * 0.26 + emb * 0.17;
        var embDist = blastR * (0.36 + embT * 0.82);
        var px = targetX + Math.cos(embAng) * embDist;
        var py = targetY + Math.sin(embAng) * embDist * 0.86;
        ctx.fillStyle = emb % 2 === 0 ? rgbaHex(thermoPalette.trim, 0.12 * fade) : rgbaHex(thermoPalette.core, 0.10 * fade);
        ctx.beginPath();
        ctx.arc(px, py, 1.2 + (emb % 3) * 0.8, 0, TAU);
        ctx.fill();
      }

      drawDebrisField(targetX, targetY, blastR, lodKey === "far" ? 8 : 16, 0, thermoPalette, 0.84 * fade);
    }
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

  function drawNanoSwarm(width, height, palette, variant, lodKey) {
    var tempo = getTempo();
    var radius = lerp(86, 164, getRadiusFactor());
    var zoneX = width * 0.66;
    var zoneY = height * 0.50;
    var cycleSec = ((state.time - state.cycleOrigin) * Math.max(0.48, tempo)) % 6;
    var cloudPulse = 0.5 + 0.5 * Math.sin(cycleSec * 0.9);
    var intensity = 0.64 + cloudPulse * 0.36;
    var shipSet = [
      { x: zoneX - radius * 0.24, y: zoneY - radius * 0.14, size: 11.2, cls: "cruiser", owner: 0, inside: true },
      { x: zoneX + radius * 0.18, y: zoneY - radius * 0.20, size: 8.4, cls: "destroyer", owner: 1, inside: true },
      { x: zoneX + radius * 0.06, y: zoneY + radius * 0.18, size: 7.4, cls: "fighter", owner: 2, inside: true },
      { x: zoneX - radius * 0.30, y: zoneY + radius * 0.24, size: 12.8, cls: "carrier", owner: 3, inside: true },
      { x: zoneX + radius * 0.94, y: zoneY + radius * 0.04, size: 8.6, cls: "destroyer", owner: 0, inside: false }
    ];
    var lobeCount = variant.eclipse ? 6 : 5;
    var cellCount = lodKey === "far" ? Math.max(10, Math.floor(variant.cells * 0.4)) : (lodKey === "mid" ? Math.floor(variant.cells * 0.7) : variant.cells);
    var tendrilCount = lodKey === "far" ? Math.floor(variant.tendrils * 0.5) : variant.tendrils;

    drawTargetArea(zoneX, zoneY, radius, palette, variant.halo * 2.8 + 0.4);
    if (variant.telemetry) drawTelemetryBrackets(zoneX, zoneY, radius * 0.82, palette, 0.22 + cloudPulse * 0.06, 1.5);

    var cloud = ctx.createRadialGradient(zoneX, zoneY, radius * 0.12, zoneX, zoneY, radius * 1.14);
    cloud.addColorStop(0, variant.eclipse ? rgbaHex(palette.dark, 0.62 * intensity) : rgbaHex(palette.trim, 0.10 * intensity));
    cloud.addColorStop(0.22, rgbaHex(palette.core, variant.fog * intensity));
    cloud.addColorStop(0.60, rgbaHex(palette.core, variant.fog * 0.56 * intensity));
    cloud.addColorStop(1, rgbaHex(palette.core, 0));
    ctx.fillStyle = cloud;
    ctx.beginPath();
    ctx.arc(zoneX, zoneY, radius * 1.14, 0, TAU);
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

    for (var sh = 0; sh < variant.shards; sh++) {
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
      var ship = shipSet[t % 4];
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

    for (var i = 0; i < shipSet.length; i++) {
      var target = shipSet[i];
      var insideIntensity = target.inside ? intensity : 0.22;
      drawShipSprite(target.x, target.y, 0.12 + i * 0.14, target.size, target.cls, target.owner, target.inside ? 0.92 : 0.72);
      if (target.inside) {
        drawNanoShipCorrosion(target.x, target.y, target.size, insideIntensity, palette, variant, i * 47 + 13);
        drawRing(target.x, target.y, target.size * 2.1, palette.trim, 0.10 + insideIntensity * 0.08, 1.1);
        drawTelemetryBrackets(target.x, target.y, target.size * 1.84, palette, 0.06 + insideIntensity * 0.08, 1.0);
        ctx.strokeStyle = rgbaHex(palette.trim, 0.10 + insideIntensity * 0.10);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(target.x + target.size * 0.3, target.y);
        ctx.lineTo(target.x + target.size * 2.0, target.y + Math.sin(state.time * 2 + i) * 8);
        ctx.stroke();
      }
    }
  }

  function renderEffect(width, height, palette, effect, variant, lodKey) {
    if (effect.id === "pirateRaid") {
      drawPirateRaid(width, height, palette, variant, lodKey);
      return;
    }
    if (effect.id === "thermoNuke") {
      drawThermoNuke(width, height, palette, variant, lodKey);
      return;
    }
    drawNanoSwarm(width, height, palette, variant, lodKey);
  }

  function drawVariantStrip(width, height, palette) {
    var variants = getVariantList(getEffect().id);
    var activeIndex = getVariantIndex(getEffect().id);
    var pad = 18;
    var slotW = (width - pad * 2) / Math.max(1, variants.length);
    var y = height - 64;
    for (var i = 0; i < variants.length; i++) {
      var active = i === activeIndex;
      var variant = variants[i];
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
    var effect = getEffect();
    var variant = getVariant();
    texts.title.textContent = "Ability Cataclysm Prototype 01 - " + effect.name + " / " + variant.name;
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
    var effect = getEffect();
    var variant = getVariant();
    var lodKey = getLodKey();
    drawBackdrop(width, height, palette);
    renderEffect(width, height, palette, effect, variant, lodKey);
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

  function syncVariantSelect() {
    var effect = getEffect();
    var list = getVariantList(effect.id);
    syncSelect(controls.variant, list);
    controls.variant.value = String(getVariantIndex(effect.id));
  }

  syncSelect(controls.effect, EFFECTS);
  controls.effect.value = String(state.effectIndex);
  syncVariantSelect();

  controls.effect.addEventListener("change", function () {
    state.effectIndex = Math.max(0, Math.min(EFFECTS.length - 1, Number(controls.effect.value) || 0));
    syncVariantSelect();
    updateTexts();
  });

  controls.variant.addEventListener("change", function () {
    var effect = getEffect();
    var list = getVariantList(effect.id);
    state.variantByEffect[effect.id] = Math.max(0, Math.min(list.length - 1, Number(controls.variant.value) || 0));
    updateTexts();
  });

  controls.cycleEffect.addEventListener("click", function () {
    state.effectIndex = (state.effectIndex + 1) % EFFECTS.length;
    controls.effect.value = String(state.effectIndex);
    syncVariantSelect();
    updateTexts();
  });

  controls.cycleVariant.addEventListener("click", function () {
    var effect = getEffect();
    var list = getVariantList(effect.id);
    state.variantByEffect[effect.id] = (getVariantIndex(effect.id) + 1) % Math.max(1, list.length);
    controls.variant.value = String(state.variantByEffect[effect.id]);
    updateTexts();
  });

  controls.triggerPulse.addEventListener("click", function () {
    state.cycleOrigin = state.time;
  });

  window.addEventListener("resize", resize);
  resize();
  updateTexts();
  requestAnimationFrame(tick);
})();
