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
    moneyVariantSelect: document.getElementById("moneyVariantSelect"),
    xpVariantSelect: document.getElementById("xpVariantSelect"),
    backdropVariantSelect: document.getElementById("backdropVariantSelect"),
    lodMode: document.getElementById("lodMode"),
    packetRate: document.getElementById("packetRate"),
    shipCount: document.getElementById("shipCount"),
    redirectSoftness: document.getElementById("redirectSoftness"),
    backdropNebula: document.getElementById("backdropNebula"),
    beamPulse: document.getElementById("beamPulse"),
    cometRate: document.getElementById("cometRate"),
    flareRate: document.getElementById("flareRate"),
    pulseHarvest: document.getElementById("pulseHarvest"),
    shuffleShips: document.getElementById("shuffleShips"),
    randomizeLayout: document.getElementById("randomizeLayout")
  };

  var texts = {
    variantTitle: document.getElementById("variantTitle"),
    variantSubtitle: document.getElementById("variantSubtitle"),
    status: document.getElementById("statusLine"),
    logic: document.getElementById("legendLogic"),
    redirect: document.getElementById("legendRedirect"),
    focus: document.getElementById("legendFocus")
  };

  var RESOURCE = {
    money: {
      name: "Money",
      primary: "#ffbe54",
      secondary: "#ffe6a2",
      accent: "#79e67a",
      glow: "255,190,84",
      pulse: "121,230,122",
      dim: "46,32,11"
    },
    xp: {
      name: "XP",
      primary: "#56d6ff",
      secondary: "#d8f0ff",
      accent: "#ff6f93",
      glow: "86,214,255",
      pulse: "255,111,147",
      dim: "11,24,37"
    }
  };

  var CORE = {
    player: { name: "Player Core", fill: "#ff9838", edge: "#ffe0a7", glow: "255,152,56", faint: "80,40,10" },
    enemy: { name: "Enemy Core", fill: "#56cbff", edge: "#d5f2ff", glow: "86,203,255", faint: "11,28,40" }
  };

  var INTERCEPT = {
    hostile: {
      core: "#ff5d68",
      edge: "#ffd2d8",
      glow: "255,93,104"
    },
    friendly: {
      core: "#79e67a",
      edge: "#d9ffe2",
      glow: "121,230,122"
    }
  };

  var LODS = {
    near: {
      routeSamples: 46,
      maxPacketsPerMine: 12,
      packetTrail: 4,
      beamAlpha: 1,
      sparkles: true,
      shimmer: true,
      packetScale: 1,
      laneMul: 1
    },
    mid: {
      routeSamples: 28,
      maxPacketsPerMine: 7,
      packetTrail: 2,
      beamAlpha: 0.75,
      sparkles: true,
      shimmer: false,
      packetScale: 0.86,
      laneMul: 0.82
    },
    far: {
      routeSamples: 14,
      maxPacketsPerMine: 3,
      packetTrail: 0,
      beamAlpha: 0.52,
      sparkles: false,
      shimmer: false,
      packetScale: 0.68,
      laneMul: 0.66
    }
  };

  var VARIANTS = [
    {
      key: "relay-conveyor",
      name: "01. Relay Conveyor",
      subtitle: "Чистый tactical-conveyor: ровный dashed beam, стабильный пульсар и плотные чип-пакеты.",
      routeStyle: "relay",
      beamDash: [10, 8],
      laneCount: 1,
      laneOffset: 0,
      pulseSpeed: 0.24,
      packetSpeed: 0.23,
      arcBias: 12,
      arcMul: 0.08,
      packetStyle: "chip",
      logicText: "Шахты просто тикают доходом, а визуально это выглядит как аккуратный relay-conveyor с пакетами по одной магистрали.",
      redirectText: "Перехватчик на трассе мягко перетягивает магистраль на свое ядро без ломки логики дохода.",
      focusText: "Фокус на читаемости: мало шума, четкая линия, ясный packet traffic и хороший силуэт на mid/far."
    },
    {
      key: "arc-caravan",
      name: "02. Arc Caravan",
      subtitle: "Поток идет мягкой дугой, как будто шахта sling-апит ресурсный караван в ядро.",
      routeStyle: "arc",
      beamDash: [7, 10],
      laneCount: 1,
      laneOffset: 0,
      pulseSpeed: 0.19,
      packetSpeed: 0.19,
      arcBias: 22,
      arcMul: 0.15,
      packetStyle: "prism",
      logicText: "Пакеты остаются клиентскими, но траектория становится более премиальной: arc travel вместо прямой конвейерной нити.",
      redirectText: "Когда враг влезает в arc, сама дуга начинает перепривязываться к ядру перехватчика и тянет караван за собой.",
      focusText: "Фокус на мягкой премиальности: красивые арки, крупнее handoff-пакеты и больше ощущения логистики."
    },
    {
      key: "braid-lattice",
      name: "03. Braid Lattice",
      subtitle: "Двойная braided-магистраль: пакеты пересаживаются между двумя дорожками у самой кромки луча.",
      routeStyle: "braid",
      beamDash: [8, 6],
      laneCount: 2,
      laneOffset: 8,
      pulseSpeed: 0.27,
      packetSpeed: 0.24,
      arcBias: 18,
      arcMul: 0.11,
      packetStyle: "paired",
      logicText: "Один доход, но визуально он разбивается на braided duplex-lanes, чтобы поток читался богаче и живее.",
      redirectText: "Вражеский ship не телепортирует пакеты, а переливает braided beam на новый target lane плавным переназначением.",
      focusText: "Фокус на sci-fi ткани канала: две полосы, редкие handoff-переливы и более насыщенный near LOD."
    },
    {
      key: "pulse-ladder",
      name: "04. Pulse Ladder",
      subtitle: "Луч раскладывается на relay-ступени, а пакеты как будто перескакивают между секциями.",
      routeStyle: "ladder",
      beamDash: [4, 8],
      laneCount: 1,
      laneOffset: 0,
      pulseSpeed: 0.22,
      packetSpeed: 0.20,
      arcBias: 14,
      arcMul: 0.09,
      packetStyle: "relay",
      logicText: "Логический income непрерывен, а визуально канал строится как ladder relay с короткими узловыми прыжками.",
      redirectText: "Перехват ship-ом выглядит как смена relay-owner: ladder секции одна за другой перевешиваются на другое ядро.",
      focusText: "Фокус на node handoff и сильной читаемости even на far: луч не расползается, а остается стройной ladder-структурой."
    },
    {
      key: "siphon-bloom",
      name: "05. Siphon Bloom",
      subtitle: "Самый живой вариант: мягкий siphon channel, bloom-всплески и более органичный packet stream.",
      routeStyle: "siphon",
      beamDash: [12, 8],
      laneCount: 1,
      laneOffset: 0,
      pulseSpeed: 0.16,
      packetSpeed: 0.17,
      arcBias: 18,
      arcMul: 0.13,
      packetStyle: "droplet",
      logicText: "Доход все так же абстрактный, но визуально шахта будто siphon-ом высасывает ресурс и вдыхает его в ядро.",
      redirectText: "При блокировке channel не ломается резко, а мягко переливается к новому центру с bloom на точке переключения.",
      focusText: "Фокус на атмосферности: более живая линия, мягкие bloom nodes и мягкий redirect вместо резкой смены."
    },
    {
      key: "vector-handoff",
      name: "06. Vector Handoff",
      subtitle: "Чистый военный handoff: короткие packet bursts, жёстче vector beam и понятная relay-передача.",
      routeStyle: "relay",
      beamDash: [14, 6],
      laneCount: 1,
      laneOffset: 0,
      pulseSpeed: 0.30,
      packetSpeed: 0.28,
      arcBias: 10,
      arcMul: 0.07,
      packetStyle: "relay",
      logicText: "Шахта дает income как обычно, а клиент показывает более сухой vector handoff с короткими burst-передачами.",
      redirectText: "При перехвате channel смотрится как принудительный handoff на hostile relay-owner с ярким intercept splice.",
      focusText: "Фокус на tactical sci-fi: жёстче beam, резче pulses и лучше читаемый hostile splice."
    },
    {
      key: "prism-weft",
      name: "07. Prism Weft",
      subtitle: "Тонкое плетение двух дорожек, где resource packets иногда стекаются в маленькие prism-узлы.",
      routeStyle: "braid",
      beamDash: [6, 9],
      laneCount: 2,
      laneOffset: 10,
      pulseSpeed: 0.21,
      packetSpeed: 0.22,
      arcBias: 20,
      arcMul: 0.12,
      packetStyle: "prism",
      logicText: "Логический поток простой, но визуально распускается в пару weft-дорожек с редкими сборками в prism handoff-пакеты.",
      redirectText: "Hostile ship не просто режет канал, а вшивает новый target в ткань потока, оставляя явный splice point.",
      focusText: "Фокус на элегантной сетке канала: нежная braid-структура, локальные handoff-узлы и хорошие mid-LOD silhouettes."
    },
    {
      key: "halo-siphon",
      name: "08. Halo Siphon",
      subtitle: "Вокруг узлов появляются halo-кольца, а сам луч выглядит как мягкий siphon-ствол с редкими bloom packet-ами.",
      routeStyle: "siphon",
      beamDash: [10, 10],
      laneCount: 1,
      laneOffset: 0,
      pulseSpeed: 0.14,
      packetSpeed: 0.15,
      arcBias: 24,
      arcMul: 0.16,
      packetStyle: "droplet",
      logicText: "Income абстрактный, а halo-сигнатуры вокруг маршрута делают шахту более ritual/energy driven без изменения логики.",
      redirectText: "При перехвате halo вокруг splice point краснеет, а siphon trunk за несколько секунд переучреждает hostile branch.",
      focusText: "Фокус на атмосферном энергетическом канале: мягкий bloom, halo-rings и спокойный, тяжёлый resource drift."
    }
  ];

  var BACKDROP_VARIANTS = [
    {
      key: "quiet-void",
      name: "01. Quiet Void",
      gradientTop: "#040813",
      gradientBottom: "#02050d",
      starCountMul: 0.92,
      starAlphaMul: 0.86,
      starSizeMul: 0.92,
      gridAlpha: 0.12,
      deepCount: 7,
      deepHueSet: ["72,108,255", "102,86,255", "88,136,255"],
      nearNebulas: [
        { x: 250, y: 170, r: 110, hue: "118,88,255", alpha: 0.07 },
        { x: 790, y: 520, r: 170, hue: "82,116,255", alpha: 0.08 }
      ],
      cometMul: 0.38,
      flareMul: 0.22,
      cometSpeedMul: 0.82,
      cometLenMul: 0.88,
      flareSizeMul: 0.86,
      dustBands: []
    },
    {
      key: "blue-shelf",
      name: "02. Blue Shelf",
      gradientTop: "#050917",
      gradientBottom: "#030711",
      starCountMul: 1.00,
      starAlphaMul: 0.92,
      starSizeMul: 0.98,
      gridAlpha: 0.14,
      deepCount: 10,
      deepHueSet: ["70,112,255", "88,146,255", "64,92,212", "106,126,255"],
      nearNebulas: [
        { x: 220, y: 190, r: 150, hue: "94,122,255", alpha: 0.10 },
        { x: 650, y: 470, r: 230, hue: "82,138,255", alpha: 0.11 },
        { x: 1030, y: 310, r: 150, hue: "112,136,255", alpha: 0.09 }
      ],
      cometMul: 0.32,
      flareMul: 0.26,
      cometSpeedMul: 0.84,
      cometLenMul: 0.92,
      flareSizeMul: 0.94,
      dustBands: [
        { x: 0.58, y: 0.44, rx: 250, ry: 90, rot: 0.32, hue: "74,110,180", alpha: 0.030 },
        { x: 0.36, y: 0.68, rx: 220, ry: 78, rot: -0.22, hue: "46,82,148", alpha: 0.024 }
      ]
    },
    {
      key: "comet-run",
      name: "03. Comet Run",
      gradientTop: "#040712",
      gradientBottom: "#02050c",
      starCountMul: 0.84,
      starAlphaMul: 0.80,
      starSizeMul: 0.92,
      gridAlpha: 0.10,
      deepCount: 5,
      deepHueSet: ["82,104,232", "112,92,222"],
      nearNebulas: [
        { x: 310, y: 160, r: 120, hue: "108,88,220", alpha: 0.06 },
        { x: 970, y: 540, r: 170, hue: "74,104,214", alpha: 0.06 }
      ],
      cometMul: 0.98,
      flareMul: 0.18,
      cometSpeedMul: 1.28,
      cometLenMul: 1.42,
      flareSizeMul: 0.78,
      dustBands: [
        { x: 0.52, y: 0.24, rx: 280, ry: 46, rot: -0.44, hue: "32,46,78", alpha: 0.030 }
      ]
    },
    {
      key: "aurora-veil",
      name: "04. Aurora Veil",
      gradientTop: "#050918",
      gradientBottom: "#03060f",
      starCountMul: 1.08,
      starAlphaMul: 0.88,
      starSizeMul: 1.00,
      gridAlpha: 0.13,
      deepCount: 8,
      deepHueSet: ["74,146,255", "106,96,255", "86,168,214", "126,112,255"],
      nearNebulas: [
        { x: 270, y: 220, r: 180, hue: "88,154,255", alpha: 0.08 },
        { x: 820, y: 300, r: 190, hue: "126,102,255", alpha: 0.09 },
        { x: 980, y: 590, r: 160, hue: "76,172,214", alpha: 0.07 }
      ],
      cometMul: 0.28,
      flareMul: 0.34,
      cometSpeedMul: 0.86,
      cometLenMul: 0.96,
      flareSizeMul: 1.06,
      dustBands: [
        { x: 0.24, y: 0.42, rx: 320, ry: 64, rot: 1.26, hue: "82,178,255", alpha: 0.040 },
        { x: 0.48, y: 0.46, rx: 360, ry: 72, rot: 1.18, hue: "122,116,255", alpha: 0.034 },
        { x: 0.74, y: 0.40, rx: 300, ry: 60, rot: 1.30, hue: "76,210,196", alpha: 0.030 }
      ]
    },
    {
      key: "rift-bloom",
      name: "05. Rift Bloom",
      gradientTop: "#060714",
      gradientBottom: "#02040b",
      starCountMul: 1.00,
      starAlphaMul: 0.90,
      starSizeMul: 1.04,
      gridAlpha: 0.15,
      deepCount: 11,
      deepHueSet: ["146,88,255", "82,156,255", "184,86,224", "102,112,255"],
      nearNebulas: [
        { x: 220, y: 170, r: 160, hue: "148,92,255", alpha: 0.10 },
        { x: 720, y: 500, r: 220, hue: "86,148,255", alpha: 0.11 },
        { x: 1040, y: 280, r: 180, hue: "186,84,224", alpha: 0.10 }
      ],
      cometMul: 0.36,
      flareMul: 0.58,
      cometSpeedMul: 0.90,
      cometLenMul: 1.00,
      flareSizeMul: 1.26,
      dustBands: [
        { x: 0.54, y: 0.56, rx: 240, ry: 88, rot: -0.10, hue: "124,70,196", alpha: 0.032 },
        { x: 0.38, y: 0.28, rx: 180, ry: 64, rot: 0.42, hue: "70,112,188", alpha: 0.026 }
      ]
    },
    {
      key: "storm-fringe",
      name: "06. Storm Fringe",
      gradientTop: "#04070f",
      gradientBottom: "#010308",
      starCountMul: 0.96,
      starAlphaMul: 0.78,
      starSizeMul: 0.94,
      gridAlpha: 0.11,
      deepCount: 9,
      deepHueSet: ["76,112,196", "92,104,182", "118,98,202"],
      nearNebulas: [
        { x: 240, y: 230, r: 150, hue: "86,118,212", alpha: 0.07 },
        { x: 640, y: 540, r: 210, hue: "74,102,176", alpha: 0.09 },
        { x: 1080, y: 320, r: 140, hue: "108,96,190", alpha: 0.07 }
      ],
      cometMul: 0.52,
      flareMul: 0.20,
      cometSpeedMul: 1.04,
      cometLenMul: 1.10,
      flareSizeMul: 0.82,
      dustBands: [
        { x: 0.50, y: 0.22, rx: 380, ry: 54, rot: -0.34, hue: "34,46,74", alpha: 0.034 },
        { x: 0.58, y: 0.72, rx: 340, ry: 58, rot: 0.24, hue: "42,56,86", alpha: 0.030 },
        { x: 0.20, y: 0.54, rx: 260, ry: 44, rot: -0.62, hue: "56,72,120", alpha: 0.024 }
      ]
    }
  ];

  var state = {
    time: 0,
    lastNow: 0,
    moneyVariantIndex: 0,
    xpVariantIndex: 2,
    backdropVariantIndex: 5,
    stars: [],
    nebulas: [],
    deepNebulas: [],
    backdropDustBands: [],
    bgComets: [],
    bgFlares: [],
    packets: [],
    flashes: [],
    dragging: null,
    routes: new Map(),
    cores: {
      player: { id: "player", x: 430, y: 600 },
      enemy: { id: "enemy", x: 930, y: 170 }
    },
    mines: [],
    ships: [],
    dpr: 1,
    screenW: 0,
    screenH: 0,
    viewScale: 1,
    viewX: 0,
    viewY: 0
  };

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
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

  function rgba(rgb, alpha) {
    return "rgba(" + rgb + "," + alpha.toFixed(3) + ")";
  }

  function controlRatio(control, fallback) {
    if (!control) return fallback;
    return clamp(Number(control.value || (fallback * 100)), 0, 100) / 100;
  }

  function pathLine(points) {
    if (!points || points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  }

  function strokePoints(points, width, color, alpha, dash, dashOffset) {
    if (!points || points.length < 2) return;
    pathLine(points);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    if (dash && dash.length) {
      ctx.setLineDash(dash);
      ctx.lineDashOffset = dashOffset || 0;
    } else {
      ctx.setLineDash([]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  function fillCircle(x, y, r, color, alpha) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function strokeCircle(x, y, r, width, color, alpha) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawHex(x, y, r, fillColor, fillAlpha, strokeColor, strokeAlpha, rotation) {
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = rotation + (TAU / 6) * i;
      var px = x + Math.cos(a) * r;
      var py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (fillAlpha > 0) {
      ctx.globalAlpha = fillAlpha;
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    if (strokeAlpha > 0) {
      ctx.globalAlpha = strokeAlpha;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = Math.max(0.8 / state.viewScale, r * 0.14);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function distToSegment(px, py, ax, ay, bx, by) {
    var dx = bx - ax;
    var dy = by - ay;
    var len2 = dx * dx + dy * dy;
    if (len2 <= 1e-6) return Math.hypot(px - ax, py - ay);
    var t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
    var qx = ax + dx * t;
    var qy = ay + dy * t;
    return Math.hypot(px - qx, py - qy);
  }

  function closestPointOnSegment(px, py, ax, ay, bx, by) {
    var dx = bx - ax;
    var dy = by - ay;
    var len2 = dx * dx + dy * dy;
    if (len2 <= 1e-6) return { x: ax, y: ay, t: 0 };
    var t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
    return {
      x: ax + dx * t,
      y: ay + dy * t,
      t: t
    };
  }

  function getVariant(resourceType) {
    var index = resourceType === "xp" ? state.xpVariantIndex : state.moneyVariantIndex;
    return VARIANTS[index] || VARIANTS[0];
  }

  function getVariantMix() {
    return {
      money: getVariant("money"),
      xp: getVariant("xp")
    };
  }

  function getBackdropVariant() {
    return BACKDROP_VARIANTS[state.backdropVariantIndex] || BACKDROP_VARIANTS[0];
  }

  function getInterceptPalette(route) {
    var targetId = route && route.interceptAnim
      ? route.interceptAnim.targetCoreId
      : (route && route.desiredCore ? route.desiredCore.id : (route && route.blocker ? route.blocker.owner : "enemy"));
    return targetId === "player" ? INTERCEPT.friendly : INTERCEPT.hostile;
  }

  function getLodKey() {
    var mode = controls.lodMode.value;
    if (mode && mode !== "auto") return mode;
    if (state.viewScale > 0.82) return "near";
    if (state.viewScale > 0.54) return "mid";
    return "far";
  }

  function getLod() {
    return LODS[getLodKey()] || LODS.near;
  }

  function resizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    var cssW = Math.max(1, canvas.clientWidth || window.innerWidth);
    var cssH = Math.max(1, canvas.clientHeight || window.innerHeight);
    var wantW = Math.round(cssW * dpr);
    var wantH = Math.round(cssH * dpr);
    if (canvas.width !== wantW || canvas.height !== wantH) {
      canvas.width = wantW;
      canvas.height = wantH;
    }
    state.dpr = dpr;
    state.screenW = wantW;
    state.screenH = wantH;
    state.viewScale = Math.min(wantW / WORLD_W, wantH / WORLD_H) * 0.95;
    state.viewX = (wantW - WORLD_W * state.viewScale) * 0.5;
    state.viewY = (wantH - WORLD_H * state.viewScale) * 0.5;
  }

  function screenToWorld(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var sx = (clientX - rect.left) * state.dpr;
    var sy = (clientY - rect.top) * state.dpr;
    return {
      x: (sx - state.viewX) / state.viewScale,
      y: (sy - state.viewY) / state.viewScale
    };
  }

  function setAccent() {
    var mix = getVariantMix();
    var accent = mix.money.key === mix.xp.key ? RESOURCE.money.primary : RESOURCE.xp.primary;
    document.documentElement.style.setProperty("--accent", accent);
  }

  function seedBackdrop() {
    var variant = getBackdropVariant();
    state.stars = [];
    state.backdropDustBands = [];
    var starPalette = variant.key === "rift-bloom"
      ? ["#ffffff", "#dce7ff", "#a9c7ff", "#e0c9ff", "#ffcce2"]
      : (variant.key === "aurora-veil"
        ? ["#ffffff", "#dff6ff", "#a9dcff", "#b9c7ff", "#c6fff4"]
        : ["#ffffff", "#ffffff", "#ddeeff", "#a8ccff", "#ffe8c8", "#c8b8ff"]);
    var starCount = Math.round(240 * (variant.starCountMul || 1));
    for (var i = 0; i < starCount; i++) {
      state.stars.push({
        x: seeded(i * 1.13) * WORLD_W,
        y: seeded(i * 2.37) * WORLD_H,
        size: (0.8 + seeded(i * 3.61) * 2.8) * (variant.starSizeMul || 1),
        alpha: (0.2 + seeded(i * 4.77) * 0.6) * (variant.starAlphaMul || 1),
        drift: seeded(i * 5.11) * TAU,
        color: starPalette[i % starPalette.length]
      });
    }
    state.nebulas = (variant.nearNebulas || []).map(function (neb) {
      return { x: neb.x, y: neb.y, r: neb.r, hue: neb.hue, alpha: neb.alpha };
    });
    state.deepNebulas = [];
    state.bgComets = [];
    state.bgFlares = [];
    var hueSet = variant.deepHueSet || ["72,108,255", "102,86,255", "88,136,255", "126,92,255", "86,124,216"];
    for (var b = 0; b < (variant.dustBands || []).length; b++) {
      var band = variant.dustBands[b];
      state.backdropDustBands.push({
        x: band.x,
        y: band.y,
        rx: band.rx,
        ry: band.ry,
        rot: band.rot,
        hue: band.hue,
        alpha: band.alpha,
        drift: 0.08 + seeded(300 + b * 3.7) * 0.22,
        phase: seeded(330 + b * 5.1) * TAU
      });
    }
    for (var n = 0; n < (variant.deepCount || 9); n++) {
      state.deepNebulas.push({
        x: seeded(60 + n * 4.7),
        y: seeded(90 + n * 5.1),
        r: 160 + seeded(120 + n * 2.3) * 260,
        hue: hueSet[n % hueSet.length],
        alpha: 0.018 + seeded(160 + n * 3.1) * 0.020,
        drift: 0.15 + seeded(200 + n * 2.9) * 0.42,
        phase: seeded(220 + n * 4.2) * TAU,
        depth: 0.35 + seeded(260 + n * 5.7) * 0.60
      });
    }
  }

  function spawnBackdropComet() {
    var variant = getBackdropVariant();
    if (state.bgComets.length >= 3) return;
    var edge = Math.floor(Math.random() * 4);
    var w = canvas.clientWidth || window.innerWidth || 1280;
    var h = canvas.clientHeight || window.innerHeight || 720;
    var x = 0;
    var y = 0;
    var vx = 0;
    var vy = 0;
    var speed = (140 + Math.random() * 120) * (variant.cometSpeedMul || 1);
    if (edge === 0) {
      x = -120;
      y = Math.random() * h * 0.9;
      vx = speed;
      vy = (Math.random() - 0.5) * 35;
    } else if (edge === 1) {
      x = w + 120;
      y = Math.random() * h * 0.9;
      vx = -speed;
      vy = (Math.random() - 0.5) * 35;
    } else if (edge === 2) {
      x = Math.random() * w;
      y = -120;
      vx = (Math.random() - 0.5) * 40;
      vy = speed;
    } else {
      x = Math.random() * w;
      y = h + 120;
      vx = (Math.random() - 0.5) * 40;
      vy = -speed;
    }
    var life = 3.2 + Math.random() * 2.2;
    state.bgComets.push({
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      len: (90 + Math.random() * 120) * (variant.cometLenMul || 1),
      life: life,
      maxLife: life,
      radius: 2 + Math.random() * 2.2,
      hue: variant.key === "rift-bloom"
        ? (Math.random() < 0.5 ? "226,210,255" : "196,214,255")
        : (variant.key === "aurora-veil"
          ? (Math.random() < 0.5 ? "198,236,255" : "190,255,235")
          : (Math.random() < 0.5 ? "210,228,255" : "196,214,255"))
    });
  }

  function spawnBackdropFlare() {
    var variant = getBackdropVariant();
    if (state.bgFlares.length >= 2) return;
    var w = canvas.clientWidth || window.innerWidth || 1280;
    var h = canvas.clientHeight || window.innerHeight || 720;
    var life = 4.5 + Math.random() * 4.5;
    state.bgFlares.push({
      x: w * (0.12 + Math.random() * 0.76),
      y: h * (0.10 + Math.random() * 0.70),
      r: (80 + Math.random() * 130) * (variant.flareSizeMul || 1),
      life: life,
      maxLife: life,
      hue: variant.key === "rift-bloom"
        ? (Math.random() < 0.5 ? "196,122,255" : "128,176,255")
        : (variant.key === "aurora-veil"
          ? (Math.random() < 0.5 ? "132,200,255" : "132,255,224")
          : (Math.random() < 0.5 ? "134,176,255" : "162,140,255"))
    });
  }

  function updateBackdrop(dt) {
    // Cold-only, low-alpha backdrop so it stays below gameplay nebula readability.
    var variant = getBackdropVariant();
    var cometRate = controlRatio(controls.cometRate, 0.34);
    var flareRate = controlRatio(controls.flareRate, 0.22);
    if (Math.random() < dt * (0.06 + cometRate * 0.48) * (variant.cometMul || 1)) spawnBackdropComet();
    if (Math.random() < dt * (0.03 + flareRate * 0.18) * (variant.flareMul || 1)) spawnBackdropFlare();

    for (var i = state.bgComets.length - 1; i >= 0; i--) {
      var comet = state.bgComets[i];
      comet.x += comet.vx * dt;
      comet.y += comet.vy * dt;
      comet.life -= dt;
      if (comet.life <= 0 || comet.x < -260 || comet.x > state.screenW + 260 || comet.y < -260 || comet.y > state.screenH + 260) {
        state.bgComets.splice(i, 1);
      }
    }

    for (var f = state.bgFlares.length - 1; f >= 0; f--) {
      state.bgFlares[f].life -= dt;
      if (state.bgFlares[f].life <= 0) state.bgFlares.splice(f, 1);
    }
  }

  function makeMine(id, x, y, resourceType, rich, owner) {
    return {
      id: id,
      x: x,
      y: y,
      owner: owner || "player",
      resourceType: resourceType,
      rich: !!rich,
      seed: seeded(id * 4.13),
      emitAcc: seeded(id * 2.19) * 0.4,
      pulse: seeded(id * 7.27) * TAU,
      displayTarget: null
    };
  }

  function resetLayout(randomize) {
    var jitter = randomize ? 1 : 0;
    state.cores.player.x = 430 + (jitter ? (seeded(11.2) - 0.5) * 120 : 0);
    state.cores.player.y = 595 + (jitter ? (seeded(12.9) - 0.5) * 90 : 0);
    state.cores.enemy.x = 930 + (jitter ? (seeded(13.7) - 0.5) * 150 : 0);
    state.cores.enemy.y = 170 + (jitter ? (seeded(15.1) - 0.5) * 80 : 0);

    state.mines = [
      makeMine(1, 170 + (jitter ? (seeded(20.1) - 0.5) * 40 : 0), 190 + (jitter ? (seeded(21.2) - 0.5) * 35 : 0), "money", true, "player"),
      makeMine(2, 320 + (jitter ? (seeded(22.5) - 0.5) * 40 : 0), 300 + (jitter ? (seeded(23.9) - 0.5) * 35 : 0), "xp", false, "player"),
      makeMine(3, 610 + (jitter ? (seeded(24.7) - 0.5) * 40 : 0), 220 + (jitter ? (seeded(26.3) - 0.5) * 35 : 0), "money", false, "player"),
      makeMine(4, 790 + (jitter ? (seeded(27.7) - 0.5) * 45 : 0), 340 + (jitter ? (seeded(28.9) - 0.5) * 45 : 0), "xp", true, "player"),
      makeMine(5, 245 + (jitter ? (seeded(30.1) - 0.5) * 35 : 0), 520 + (jitter ? (seeded(31.4) - 0.5) * 35 : 0), "money", false, "player")
    ];
    for (var i = 0; i < state.mines.length; i++) {
      state.mines[i].displayTarget = { x: state.cores.player.x, y: state.cores.player.y };
    }

    state.ships = [];
    for (var si = 0; si < 5; si++) {
      state.ships.push({
        id: "ship-" + si,
        owner: "enemy",
        x: 0,
        y: 0,
        anchorX: 510 + (si - 2) * 58,
        anchorY: 360 + (si % 2 === 0 ? -18 : 24),
        rx: 96 + si * 18,
        ry: 42 + si * 9,
        speed: 0.42 + si * 0.05,
        phase: seeded(si * 4.9) * TAU,
        drift: seeded(si * 5.7) * TAU,
        blockR: 34 + si * 3
      });
    }
    state.packets = [];
    state.flashes = [];
  }

  function shuffleShips() {
    for (var i = 0; i < state.ships.length; i++) {
      var ship = state.ships[i];
      ship.anchorX = 470 + seeded(100 + i * 3.1) * 300;
      ship.anchorY = 250 + seeded(120 + i * 4.3) * 260;
      ship.rx = 70 + seeded(140 + i * 2.7) * 100;
      ship.ry = 32 + seeded(150 + i * 3.3) * 60;
      ship.phase = seeded(160 + i * 6.1) * TAU;
      ship.drift = seeded(180 + i * 7.3) * TAU;
    }
  }

  function pickEntity(pos) {
    var best = null;
    var bestD = 28;
    var keys = ["player", "enemy"];
    for (var i = 0; i < keys.length; i++) {
      var core = state.cores[keys[i]];
      var dc = Math.hypot(pos.x - core.x, pos.y - core.y);
      if (dc < bestD) { bestD = dc; best = { kind: "core", ref: core }; }
    }
    for (var m = 0; m < state.mines.length; m++) {
      var mine = state.mines[m];
      var dm = Math.hypot(pos.x - mine.x, pos.y - mine.y);
      if (dm < bestD) { bestD = dm; best = { kind: "mine", ref: mine }; }
    }
    var activeShips = Math.round(Number(controls.shipCount.value || 3));
    for (var s = 0; s < activeShips; s++) {
      var ship = state.ships[s];
      var ds = Math.hypot(pos.x - ship.x, pos.y - ship.y);
      if (ds < bestD) { bestD = ds; best = { kind: "ship", ref: ship }; }
    }
    return best;
  }

  function bind() {
    function fillVariantSelect(select) {
      if (!select) return;
      for (var i = 0; i < VARIANTS.length; i++) {
        var option = document.createElement("option");
        option.value = String(i);
        option.textContent = VARIANTS[i].name;
        select.appendChild(option);
      }
    }

    function fillBackdropSelect(select) {
      if (!select) return;
      for (var i = 0; i < BACKDROP_VARIANTS.length; i++) {
        var option = document.createElement("option");
        option.value = String(i);
        option.textContent = BACKDROP_VARIANTS[i].name;
        select.appendChild(option);
      }
    }

    fillVariantSelect(controls.moneyVariantSelect);
    fillVariantSelect(controls.xpVariantSelect);
    fillBackdropSelect(controls.backdropVariantSelect);

    if (controls.moneyVariantSelect) {
      controls.moneyVariantSelect.value = String(state.moneyVariantIndex);
      controls.moneyVariantSelect.addEventListener("change", function () {
        state.moneyVariantIndex = Number(controls.moneyVariantSelect.value || 0);
        setAccent();
        updateTexts();
      });
    }
    if (controls.xpVariantSelect) {
      controls.xpVariantSelect.value = String(state.xpVariantIndex);
      controls.xpVariantSelect.addEventListener("change", function () {
        state.xpVariantIndex = Number(controls.xpVariantSelect.value || 0);
        setAccent();
        updateTexts();
      });
    }
    if (controls.backdropVariantSelect) {
      controls.backdropVariantSelect.value = String(state.backdropVariantIndex);
      controls.backdropVariantSelect.addEventListener("change", function () {
        state.backdropVariantIndex = Number(controls.backdropVariantSelect.value || 0);
        seedBackdrop();
      });
    }
    controls.pulseHarvest.addEventListener("click", function () {
      for (var i = 0; i < state.mines.length; i++) state.mines[i].emitAcc += 0.9;
      for (var j = 0; j < state.mines.length; j++) {
        state.flashes.push({
          x: state.mines[j].x,
          y: state.mines[j].y,
          r: 18,
          alpha: 0.22,
          color: state.mines[j].resourceType === "money" ? RESOURCE.money.primary : RESOURCE.xp.primary
        });
      }
    });
    controls.shuffleShips.addEventListener("click", shuffleShips);
    controls.randomizeLayout.addEventListener("click", function () {
      resetLayout(true);
      shuffleShips();
    });

    canvas.addEventListener("pointerdown", function (e) {
      var world = screenToWorld(e.clientX, e.clientY);
      var picked = pickEntity(world);
      if (picked) {
        state.dragging = {
          ref: picked.ref,
          offsetX: picked.ref.x - world.x,
          offsetY: picked.ref.y - world.y
        };
      }
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!state.dragging) return;
      var world = screenToWorld(e.clientX, e.clientY);
      state.dragging.ref.x = clamp(world.x + state.dragging.offsetX, 60, WORLD_W - 60);
      state.dragging.ref.y = clamp(world.y + state.dragging.offsetY, 60, WORLD_H - 60);
      if (state.dragging.ref.anchorX != null) {
        state.dragging.ref.anchorX = state.dragging.ref.x;
        state.dragging.ref.anchorY = state.dragging.ref.y;
      }
    });
    window.addEventListener("pointerup", function () {
      state.dragging = null;
    });
    window.addEventListener("resize", resizeCanvas);
  }

  function updateTexts() {
    var mix = getVariantMix();
    var same = mix.money.key === mix.xp.key;
    if (texts.variantTitle) {
      texts.variantTitle.textContent = same
        ? mix.money.name
        : "Money: " + mix.money.name + " | XP: " + mix.xp.name;
    }
    if (texts.variantSubtitle) {
      texts.variantSubtitle.textContent = same
        ? mix.money.subtitle
        : "Money идет через " + mix.money.name + ", а XP идет через " + mix.xp.name + ". Так можно сразу оценить, как смешиваются два VFX-направления в одной сцене.";
    }
    if (texts.logic) {
      texts.logic.textContent = same
        ? mix.money.logicText
        : "Money: " + mix.money.logicText + " XP: " + mix.xp.logicText;
    }
    if (texts.redirect) {
      texts.redirect.textContent = same
        ? mix.money.redirectText
        : "Money: " + mix.money.redirectText + " XP: " + mix.xp.redirectText;
    }
    if (texts.focus) {
      texts.focus.textContent = same
        ? mix.money.focusText
        : "Money focus: " + mix.money.focusText + " XP focus: " + mix.xp.focusText;
    }
  }

  function updateShips(dt) {
    var activeShips = Math.round(Number(controls.shipCount.value || 3));
    for (var i = 0; i < activeShips; i++) {
      if (state.dragging && state.dragging.ref === state.ships[i]) continue;
      var ship = state.ships[i];
      ship.phase += dt * ship.speed;
      ship.x = ship.anchorX + Math.cos(ship.phase + ship.drift) * ship.rx;
      ship.y = ship.anchorY + Math.sin(ship.phase * 1.35 + ship.drift * 0.4) * ship.ry + Math.sin(ship.phase * 2.1) * 12;
    }
  }

  function findBlockingShip(mine, ownerCore) {
    var activeShips = Math.round(Number(controls.shipCount.value || 3));
    var best = null;
    var bestD = Infinity;
    for (var i = 0; i < activeShips; i++) {
      var ship = state.ships[i];
      if (ship.owner === mine.owner) continue;
      var d = distToSegment(ship.x, ship.y, mine.x, mine.y, ownerCore.x, ownerCore.y);
      if (d <= ship.blockR + 24 && d < bestD) {
        bestD = d;
        best = ship;
      }
    }
    return best;
  }

  function updateInterceptState(mine, ownerCore, blocker) {
    var blockerId = blocker ? blocker.id : null;
    if (!mine._interceptState) {
      mine._interceptState = {
        activeBlockerId: null,
        anim: null
      };
    }
    var stateObj = mine._interceptState;
    if (stateObj.anim && stateObj.anim.phase === "exit" && state.time - stateObj.anim.startedAt > 2.05) {
      stateObj.anim = null;
    }

    if (blocker) {
      var intercept = closestPointOnSegment(blocker.x, blocker.y, mine.x, mine.y, ownerCore.x, ownerCore.y);
      if (blockerId !== stateObj.activeBlockerId || !stateObj.anim || stateObj.anim.phase === "exit") {
        stateObj.anim = {
          blockerId: blocker.id,
          startedAt: state.time,
          point: { x: intercept.x, y: intercept.y },
          targetCoreId: blocker.owner,
          returnCoreId: ownerCore.id,
          t: intercept.t,
          phase: "enter"
        };
      } else {
        stateObj.anim.point.x = intercept.x;
        stateObj.anim.point.y = intercept.y;
        stateObj.anim.targetCoreId = blocker.owner;
        stateObj.anim.returnCoreId = ownerCore.id;
        stateObj.anim.t = intercept.t;
      }
    } else if (stateObj.activeBlockerId && stateObj.anim) {
      stateObj.anim = {
        blockerId: null,
        startedAt: state.time,
        point: { x: stateObj.anim.point.x, y: stateObj.anim.point.y },
        targetCoreId: stateObj.anim.targetCoreId,
        returnCoreId: ownerCore.id,
        t: stateObj.anim.t,
        phase: "exit"
      };
    }
    stateObj.activeBlockerId = blockerId;
  }

  function buildRoutePoints(route, variant, lod, laneSign) {
    var points = [];
    var count = lod.routeSamples;
    var start = route.routeStart || route.mine;
    var end = route.routeEnd || route.displayTarget;
    var dx = end.x - start.x;
    var dy = end.y - start.y;
    var len = Math.hypot(dx, dy) || 1;
    var dirX = dx / len;
    var dirY = dy / len;
    var perpX = -dirY;
    var perpY = dirX;
    var seedSign = route.mine.seed > 0.5 ? 1 : -1;
    var laneOffset = (laneSign || 0) * variant.laneOffset * lod.laneMul;
    var rerouteMul = 0.35 + route.rerouteK * 0.95;
    var ampBase = variant.arcBias + len * variant.arcMul;

    for (var i = 0; i <= count; i++) {
      var t = i / count;
      var baseX = lerp(start.x, end.x, t);
      var baseY = lerp(start.y, end.y, t);
      var offset = 0;
      if (variant.routeStyle === "relay") {
        offset = Math.sin(Math.PI * t) * (6 + ampBase * 0.18) * seedSign * 0.35 * rerouteMul;
      } else if (variant.routeStyle === "arc") {
        offset = Math.sin(Math.PI * t) * (14 + ampBase * 0.68) * seedSign * (0.55 + route.rerouteK * 0.6);
      } else if (variant.routeStyle === "braid") {
        offset = Math.sin(Math.PI * t) * (9 + ampBase * 0.26) * seedSign * 0.4;
        offset += Math.sin(t * TAU * 2 + state.time * 0.8 + route.mine.seed * 4) * 5;
      } else if (variant.routeStyle === "ladder") {
        var sq = Math.sin(t * Math.PI * 4 + route.mine.seed * 5) >= 0 ? 1 : -1;
        var gate = smoothstep(0.08, 0.18, t) * smoothstep(0.92, 0.80, t);
        offset = sq * (6 + ampBase * 0.20) * gate;
      } else if (variant.routeStyle === "siphon") {
        offset = Math.sin(Math.PI * t) * (10 + ampBase * 0.42) * seedSign * 0.5;
        offset += Math.sin(state.time * 1.2 + t * TAU * 3 + route.mine.seed * 5) * 3.5;
      }
      offset += laneOffset * Math.sin(Math.PI * t);

      points.push({
        x: baseX + perpX * offset,
        y: baseY + perpY * offset
      });
    }
    return points;
  }

  function buildPathSlice(points, t0, t1) {
    if (!points || points.length < 2) return [];
    var from = clamp(t0, 0, 1);
    var to = clamp(t1, 0, 1);
    if (to <= from) return [samplePath(points, from), samplePath(points, to)];
    var count = Math.max(2, Math.ceil((to - from) * 22));
    var out = [];
    for (var i = 0; i <= count; i++) {
      var t = lerp(from, to, i / count);
      var sample = samplePath(points, t);
      out.push({ x: sample.x, y: sample.y });
    }
    return out;
  }

  function sampleSplicedRoute(route, t, lane) {
    var progress = clamp(t, 0, 1);
    var branch = route.main;
    if (lane != null && route.left && route.right) branch = lane < 0 ? route.left : route.right;
    var spliceT = clamp(route.interceptT, 0.08, 0.96);

    if (route.interceptPhase === "exit" && route.interceptT != null) {
      var restoreT = lerp(spliceT, 1, getInterceptAnimProgress(route));
      return samplePath(branch, progress * restoreT);
    }

    if (!route.rerouted || !route.redirect || route.interceptT == null) {
      return samplePath(branch, progress);
    }

    if (progress <= spliceT) {
      return samplePath(branch, progress);
    }
    return samplePath(route.redirect, (progress - spliceT) / Math.max(0.001, 1 - spliceT));
  }

  function getInterceptAnimProgress(route) {
    if (!route || !route.interceptAnim) return 1;
    return clamp((state.time - route.interceptAnim.startedAt) / 2, 0, 1);
  }

  function samplePath(points, t) {
    if (!points || points.length < 2) return { x: 0, y: 0, angle: 0 };
    var scaled = clamp(t, 0, 1) * (points.length - 1);
    var i0 = Math.floor(scaled);
    var i1 = Math.min(points.length - 1, i0 + 1);
    var frac = scaled - i0;
    var a = points[i0];
    var b = points[i1];
    var x = lerp(a.x, b.x, frac);
    var y = lerp(a.y, b.y, frac);
    return {
      x: x,
      y: y,
      angle: Math.atan2(b.y - a.y, b.x - a.x)
    };
  }

  function buildRoutes(dt) {
    var lod = getLod();
    var routes = new Map();
    for (var i = 0; i < state.mines.length; i++) {
      var mine = state.mines[i];
      var variant = getVariant(mine.resourceType);
      var ownerCore = state.cores[mine.owner];
      var blocker = findBlockingShip(mine, ownerCore);
      updateInterceptState(mine, ownerCore, blocker);
      var desiredCore = blocker ? state.cores[blocker.owner] : ownerCore;
      var interceptAnim = mine._interceptState ? mine._interceptState.anim : null;
      var rerouteK = blocker ? 1 : 0;
      var visualRerouted = !!blocker || !!interceptAnim;
      var route = {
        mine: mine,
        blocker: blocker,
        ownerCore: ownerCore,
        desiredCore: desiredCore,
        variant: variant,
        displayTarget: { x: ownerCore.x, y: ownerCore.y },
        rerouteK: rerouteK,
        rerouted: !!blocker,
        visualRerouted: visualRerouted,
        interceptAnim: interceptAnim,
        interceptPhase: interceptAnim ? interceptAnim.phase : "none",
        interceptT: interceptAnim ? interceptAnim.t : 1
      };
      route.routeStart = mine;
      route.routeEnd = ownerCore;
      route.main = buildRoutePoints(route, variant, lod, 0);
      if (variant.laneCount > 1) {
        route.left = buildRoutePoints(route, variant, lod, -1);
        route.right = buildRoutePoints(route, variant, lod, 1);
      }
      if (visualRerouted && interceptAnim) {
        var redirectCore = state.cores[interceptAnim.targetCoreId] || desiredCore;
        route.redirect = buildRoutePoints({
          mine: mine,
          routeStart: { x: interceptAnim.point.x, y: interceptAnim.point.y, seed: mine.seed },
          routeEnd: redirectCore,
          rerouteK: 1
        }, variant, lod, 0);
      } else {
        route.redirect = null;
      }
      routes.set(mine.id, route);
    }
    return routes;
  }

  function spawnPackets(dt, routes) {
    var lod = getLod();
    var traffic = Number(controls.packetRate.value || 80) / 80;
    for (var i = 0; i < state.mines.length; i++) {
      var mine = state.mines[i];
      var variant = getVariant(mine.resourceType);
      var interval = (mine.rich ? 0.68 : 0.92) / traffic;
      mine.emitAcc += dt;

      var liveCount = 0;
      for (var p = 0; p < state.packets.length; p++) {
        if (state.packets[p].mineId === mine.id) liveCount++;
      }

      while (mine.emitAcc >= interval) {
        mine.emitAcc -= interval;
        if (liveCount >= lod.maxPacketsPerMine) continue;
        state.packets.push({
          mineId: mine.id,
          resourceType: mine.resourceType,
          progress: 0,
          speed: variant.packetSpeed * (0.85 + Math.random() * 0.35),
          lane: variant.laneCount > 1 ? (Math.random() > 0.5 ? 1 : -1) : 0,
          styleSeed: Math.random() * 1000,
          value: mine.rich ? 1.24 : 0.92
        });
        liveCount++;
      }
    }
  }

  function updatePackets(dt, routes) {
    for (var i = state.packets.length - 1; i >= 0; i--) {
      var packet = state.packets[i];
      var route = routes.get(packet.mineId);
      if (!route) {
        state.packets.splice(i, 1);
        continue;
      }
      packet.progress += dt * packet.speed;
      if (packet.progress >= 1) {
        var targetCore = route.rerouted ? route.desiredCore : route.ownerCore;
        state.flashes.push({
          x: targetCore.x,
          y: targetCore.y,
          r: 12 + packet.value * 8,
          alpha: 0.18,
          color: packet.resourceType === "money" ? RESOURCE.money.primary : RESOURCE.xp.primary
        });
        state.packets.splice(i, 1);
      }
    }
  }

  function updateFlashes(dt) {
    for (var i = state.flashes.length - 1; i >= 0; i--) {
      state.flashes[i].r += dt * 28;
      state.flashes[i].alpha -= dt * 0.20;
      if (state.flashes[i].alpha <= 0.001) state.flashes.splice(i, 1);
    }
  }

  function drawBackdrop() {
    var variant = getBackdropVariant();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, state.screenW, state.screenH);

    var screenGrad = ctx.createLinearGradient(0, 0, 0, state.screenH);
    screenGrad.addColorStop(0, variant.gradientTop || "#040813");
    screenGrad.addColorStop(1, variant.gradientBottom || "#02050d");
    ctx.fillStyle = screenGrad;
    ctx.fillRect(0, 0, state.screenW, state.screenH);

    var hazeK = controlRatio(controls.backdropNebula, 0.58);
    var depthK = controlRatio(controls.redirectSoftness, 0.56);
    for (var db = 0; db < state.backdropDustBands.length; db++) {
      var band = state.backdropDustBands[db];
      var driftBandX = Math.cos(state.time * band.drift + band.phase) * 24 * depthK;
      var driftBandY = Math.sin(state.time * (band.drift * 0.75) + band.phase * 1.1) * 10 * depthK;
      ctx.save();
      ctx.translate(state.screenW * band.x + driftBandX, state.screenH * band.y + driftBandY);
      ctx.rotate(band.rot);
      var bandGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, band.rx);
      bandGrad.addColorStop(0, rgba(band.hue, band.alpha * hazeK));
      bandGrad.addColorStop(0.52, rgba(band.hue, band.alpha * 0.52 * hazeK));
      bandGrad.addColorStop(1, rgba(band.hue, 0));
      ctx.fillStyle = bandGrad;
      ctx.scale(1, band.ry / Math.max(1, band.rx));
      ctx.beginPath();
      ctx.arc(0, 0, band.rx, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    for (var dn = 0; dn < state.deepNebulas.length; dn++) {
      var deep = state.deepNebulas[dn];
      var driftX = Math.cos(state.time * deep.drift + deep.phase) * 18 * deep.depth * depthK;
      var driftY = Math.sin(state.time * (deep.drift * 0.8) + deep.phase * 1.2) * 10 * deep.depth * depthK;
      var sx = state.screenW * deep.x + driftX;
      var sy = state.screenH * deep.y + driftY;
      var sr = deep.r * (0.50 + depthK * 0.85);
      var deepGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      deepGrad.addColorStop(0, rgba(deep.hue, deep.alpha * hazeK));
      deepGrad.addColorStop(0.54, rgba(deep.hue, deep.alpha * 0.52 * hazeK));
      deepGrad.addColorStop(1, rgba(deep.hue, 0));
      ctx.fillStyle = deepGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, TAU);
      ctx.fill();
    }

    for (var n = 0; n < state.nebulas.length; n++) {
      var neb = state.nebulas[n];
      var cx = state.viewX + neb.x * state.viewScale;
      var cy = state.viewY + neb.y * state.viewScale;
      var r = neb.r * state.viewScale;
      var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, rgba(neb.hue, neb.alpha * (0.42 + hazeK * 0.58)));
      grad.addColorStop(1, rgba(neb.hue, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.fill();
    }

    for (var fi = 0; fi < state.bgFlares.length; fi++) {
      var flare = state.bgFlares[fi];
      var age = 1 - flare.life / Math.max(0.001, flare.maxLife);
      var appear = age < 0.22 ? age / 0.22 : 1;
      var fade = flare.life < flare.maxLife * 0.32 ? flare.life / (flare.maxLife * 0.32) : 1;
      var alpha = appear * fade * (0.55 + 0.45 * Math.sin(state.time * 0.7 + fi));
      var flareGrad = ctx.createRadialGradient(flare.x, flare.y, 0, flare.x, flare.y, flare.r);
      flareGrad.addColorStop(0, rgba("240,246,255", 0.05 * alpha));
      flareGrad.addColorStop(0.18, rgba(flare.hue, 0.06 * alpha));
      flareGrad.addColorStop(0.52, rgba(flare.hue, 0.03 * alpha));
      flareGrad.addColorStop(1, rgba(flare.hue, 0));
      ctx.fillStyle = flareGrad;
      ctx.beginPath();
      ctx.arc(flare.x, flare.y, flare.r, 0, TAU);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(state.viewX, state.viewY);
    ctx.scale(state.viewScale, state.viewScale);

    ctx.strokeStyle = "rgba(74,112,196," + ((variant.gridAlpha || 0.12) * (0.58 + hazeK * 0.42)).toFixed(3) + ")";
    ctx.lineWidth = 1 / state.viewScale;
    for (var x = 0; x <= WORLD_W; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_H);
      ctx.stroke();
    }
    for (var y = 0; y <= WORLD_H; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_W, y);
      ctx.stroke();
    }

    for (var i = 0; i < state.stars.length; i++) {
      var star = state.stars[i];
      var pulse = 0.75 + 0.25 * Math.sin(state.time * (0.4 + (i % 7) * 0.06) + star.drift);
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size / state.viewScale, 0, TAU);
      ctx.fillStyle = star.color || "rgba(234,240,255," + ((star.alpha * pulse) * 0.95).toFixed(3) + ")";
      if (star.color) ctx.globalAlpha = (star.alpha * pulse) * 0.95;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    for (var ci = 0; ci < state.bgComets.length; ci++) {
      var comet = state.bgComets[ci];
      var len = Math.hypot(comet.vx, comet.vy) || 1;
      var nx = -comet.vx / len;
      var ny = -comet.vy / len;
      for (var step = 0; step <= 8; step++) {
        var t = step / 8;
        var px = comet.x + nx * comet.len * t;
        var py = comet.y + ny * comet.len * t;
        var alphaTail = (1 - t) * 0.09 * (comet.life / comet.maxLife);
        var rr = comet.radius + (1 - t) * 4;
        ctx.beginPath();
        ctx.arc(px, py, rr, 0, TAU);
        ctx.fillStyle = rgba(comet.hue, alphaTail);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(comet.x, comet.y, comet.radius + 1, 0, TAU);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(comet.x, comet.y, Math.max(1.1, comet.radius * 0.42), 0, TAU);
      ctx.fillStyle = "rgba(235,242,255,0.78)";
      ctx.fill();
    }
  }

  function drawCore(coreKey, core, lod) {
    var col = CORE[coreKey];
    fillCircle(core.x, core.y, 42 / state.viewScale, rgba(col.glow, 0.08), 1);
    strokeCircle(core.x, core.y, 24 / state.viewScale, 2.4 / state.viewScale, col.edge, 0.55);
    strokeCircle(core.x, core.y, 16 / state.viewScale, 1.2 / state.viewScale, col.fill, 0.7);
    fillCircle(core.x, core.y, 13 / state.viewScale, col.fill, 0.85);
    fillCircle(core.x, core.y, 5 / state.viewScale, "#ffffff", 0.55);

    if (lod !== LODS.far) {
      ctx.fillStyle = "#dce8ff";
      ctx.globalAlpha = 0.8;
      ctx.font = (12 / state.viewScale).toFixed(2) + "px Inter, Segoe UI, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(col.name, core.x, core.y - 34 / state.viewScale);
      ctx.globalAlpha = 1;
    }
  }

  function drawMine(mine, route, lod) {
    var res = RESOURCE[mine.resourceType];
    var baseR = (mine.rich ? 20 : 16) / state.viewScale;
    var shellR = baseR * 1.8;

    fillCircle(mine.x, mine.y, shellR + 7 / state.viewScale, rgba(res.glow, 0.06), 1);
    if (mine.resourceType === "money") {
      drawHex(mine.x, mine.y, shellR, "#0c111a", 0.95, res.primary, 0.7, Math.PI / 6);
      drawHex(mine.x, mine.y, baseR * 0.75, res.primary, 0.26, res.secondary, 0.35, Math.PI / 6);
    } else {
      fillCircle(mine.x, mine.y, shellR, "#081019", 0.94);
      strokeCircle(mine.x, mine.y, shellR, 1.6 / state.viewScale, res.primary, 0.72);
      strokeCircle(mine.x, mine.y, shellR * 0.58, 0.8 / state.viewScale, res.secondary, 0.34);
    }

    fillCircle(mine.x, mine.y, baseR * 0.54, res.primary, mine.rich ? 0.48 : 0.36);
    fillCircle(mine.x, mine.y, baseR * 0.18, "#ffffff", 0.38);

    if (lod.sparkles) {
      for (var i = 0; i < 4; i++) {
        var a = state.time * (0.8 + i * 0.14) + mine.pulse + i * (TAU / 4);
        var orbit = shellR * (0.76 + i * 0.08);
        var sx = mine.x + Math.cos(a) * orbit;
        var sy = mine.y + Math.sin(a) * orbit;
        fillCircle(sx, sy, (1.2 + i * 0.25) / state.viewScale, i % 2 === 0 ? res.primary : res.accent, 0.65);
      }
    }

    if (route) {
      var mouth = samplePath(route.main, 0.06);
      strokePoints(
        [{ x: mine.x, y: mine.y }, { x: mouth.x, y: mouth.y }],
        1.4 / state.viewScale,
        res.secondary,
        0.22 * lod.beamAlpha,
        null,
        0
      );
    }
  }

  function drawShip(ship, active) {
    var glow = ship.owner === "enemy" ? CORE.enemy.glow : CORE.player.glow;
    var edge = ship.owner === "enemy" ? CORE.enemy.edge : CORE.player.edge;
    var body = ship.owner === "enemy" ? CORE.enemy.fill : CORE.player.fill;
    fillCircle(ship.x, ship.y, 8 / state.viewScale, rgba(glow, 0.06), 1);
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(state.time * 0.7 + ship.phase);
    ctx.beginPath();
    ctx.moveTo(11 / state.viewScale, 0);
    ctx.lineTo(-8 / state.viewScale, 5 / state.viewScale);
    ctx.lineTo(-5 / state.viewScale, 0);
    ctx.lineTo(-8 / state.viewScale, -5 / state.viewScale);
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.globalAlpha = 0.84;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.9 / state.viewScale;
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
    if (active) strokeCircle(ship.x, ship.y, ship.blockR / state.viewScale, 0.8 / state.viewScale, edge, 0.15);
  }

  function drawRoute(route, variant, lod) {
    var res = RESOURCE[route.mine.resourceType];
    var interceptCol = getInterceptPalette(route);
    var dash = variant.beamDash;
    var pulseMul = Number(controls.beamPulse.value || 58) / 58;
    var pulseAlpha = (0.18 + route.rerouteK * 0.18) * lod.beamAlpha;
    var spliceT = clamp(route.interceptT != null ? route.interceptT : 1, 0.08, 1);
    var animK = getInterceptAnimProgress(route);
    var isExiting = route.interceptPhase === "exit";
    var mainVisibleT = route.rerouted ? lerp(1, spliceT, animK) : 1;
    var redirectVisibleT = route.rerouted ? animK : (isExiting ? 1 - animK : 0);
    var visibleMain = route.rerouted
      ? buildPathSlice(route.main, 0, mainVisibleT)
      : (isExiting ? buildPathSlice(route.main, 0, spliceT) : buildPathSlice(route.main, 0, 1));
    var exitMainTail = isExiting ? buildPathSlice(route.main, spliceT, lerp(spliceT, 1, animK)) : null;

    function drawPrimaryBeam(points) {
      strokePoints(points, 5.5 / state.viewScale, rgba(res.glow, 0.12), 1.0 * lod.beamAlpha, null, 0);
      strokePoints(points, 2.1 / state.viewScale, rgba(res.glow, 0.30), 1.0 * lod.beamAlpha, dash, -state.time * (36 + pulseMul * 14));
      strokePoints(points, 0.95 / state.viewScale, res.secondary, 0.34 * lod.beamAlpha, dash, -state.time * (46 + pulseMul * 18));
    }

    function drawSideBeam(points, color, dashOffset) {
      strokePoints(points, 1.15 / state.viewScale, color, 0.7 * lod.beamAlpha, dash, dashOffset);
    }

    drawPrimaryBeam(visibleMain);
    if (exitMainTail && exitMainTail.length > 1) drawPrimaryBeam(exitMainTail);

    if (variant.laneCount > 1 && route.left && route.right) {
      var visibleLeft = route.rerouted
        ? buildPathSlice(route.left, 0, mainVisibleT)
        : (isExiting ? buildPathSlice(route.left, 0, spliceT) : buildPathSlice(route.left, 0, 1));
      var visibleRight = route.rerouted
        ? buildPathSlice(route.right, 0, mainVisibleT)
        : (isExiting ? buildPathSlice(route.right, 0, spliceT) : buildPathSlice(route.right, 0, 1));
      var exitLeftTail = isExiting ? buildPathSlice(route.left, spliceT, lerp(spliceT, 1, animK)) : null;
      var exitRightTail = isExiting ? buildPathSlice(route.right, spliceT, lerp(spliceT, 1, animK)) : null;
      drawSideBeam(visibleLeft, rgba(res.pulse, 0.34), state.time * 20);
      drawSideBeam(visibleRight, rgba(res.glow, 0.34), -state.time * 20);
      if (exitLeftTail && exitLeftTail.length > 1) drawSideBeam(exitLeftTail, rgba(res.pulse, 0.34), state.time * 20);
      if (exitRightTail && exitRightTail.length > 1) drawSideBeam(exitRightTail, rgba(res.glow, 0.34), -state.time * 20);
      if (lod.sparkles) {
        var bridgeStep = Math.max(2, Math.floor(visibleLeft.length / 8));
        for (var bi = bridgeStep; bi < visibleLeft.length - 1 && bi < visibleRight.length - 1; bi += bridgeStep * 2) {
          strokePoints(
            [visibleLeft[bi], visibleRight[bi]],
            0.55 / state.viewScale,
            rgba(res.glow, 0.16),
            0.9 * lod.beamAlpha,
            null,
            0
          );
        }
      }
    }

    if (lod.shimmer) {
      var shimmerT = 0.5 + 0.5 * Math.sin(state.time * 1.7 + route.mine.seed * 12.3);
      if (shimmerT > 0.92) {
        var a = samplePath(route.main, (0.24 + route.mine.seed * 0.08) * spliceT);
        var b = samplePath(route.main, (0.40 + route.mine.seed * 0.09) * spliceT);
        strokePoints(
          [a, b],
          0.7 / state.viewScale,
          rgba(res.pulse, 0.24),
          1,
          [5 / state.viewScale, 12 / state.viewScale],
          -state.time * 40
        );
      }
    }

    var pulse = sampleSplicedRoute(route, (state.time * variant.pulseSpeed + route.mine.seed) % 1, 0);
    fillCircle(pulse.x, pulse.y, (lod === LODS.far ? 2.4 : 3.8) / state.viewScale, rgba(res.glow, 0.18), 1);
    fillCircle(pulse.x, pulse.y, 1.8 / state.viewScale, res.secondary, pulseAlpha * pulseMul + 0.18);

    if (route.visualRerouted) {
      if (route.blocker) {
        strokeCircle(route.blocker.x, route.blocker.y, (route.blocker.blockR + 10) / state.viewScale, 0.95 / state.viewScale, interceptCol.core, 0.28);
        fillCircle(route.blocker.x, route.blocker.y, 2.4 / state.viewScale, interceptCol.core, 0.42);
      }
      if (route.interceptAnim) {
        strokeCircle(route.interceptAnim.point.x, route.interceptAnim.point.y, 8 / state.viewScale, 0.95 / state.viewScale, interceptCol.edge, 0.28);
        fillCircle(route.interceptAnim.point.x, route.interceptAnim.point.y, 2.2 / state.viewScale, interceptCol.core, 0.46);
      }
      if (route.redirect && route.redirect.length > 1 && redirectVisibleT > 0.001) {
        var visibleRedirect = buildPathSlice(route.redirect, 0, redirectVisibleT);
        strokePoints(visibleRedirect, 5.5 / state.viewScale, rgba(interceptCol.glow, 0.10), 0.95 * lod.beamAlpha, null, 0);
        strokePoints(visibleRedirect, 2.2 / state.viewScale, rgba(interceptCol.glow, 0.26), 0.95 * lod.beamAlpha, dash, -state.time * (30 + pulseMul * 10));
        strokePoints(visibleRedirect, 1.0 / state.viewScale, interceptCol.edge, 0.58 * lod.beamAlpha, dash, -state.time * (38 + pulseMul * 12));
      }
    }

    drawInterceptAnimation(route, lod);
  }

  function drawInterceptAnimation(route, lod) {
    var anim = route.interceptAnim;
    if (!anim) return;
    var targetCore = state.cores[anim.targetCoreId];
    if (!targetCore) return;

    var elapsed = state.time - anim.startedAt;
    if (elapsed < 0 || elapsed > 2.35) return;

    var pt = anim.point;
    var interceptCol = getInterceptPalette(route);
    var animK = getInterceptAnimProgress(route);
    var isExiting = route.interceptPhase === "exit";
    var lodMul = lod === LODS.near ? 1 : (lod === LODS.mid ? 0.72 : 0.45);
    var res = RESOURCE[route.mine.resourceType];

    strokeCircle(pt.x, pt.y, (10 + 4 * (0.5 + 0.5 * Math.sin(state.time * 6))) / state.viewScale, 1.25 / state.viewScale, interceptCol.edge, 0.32 * lodMul);
    fillCircle(pt.x, pt.y, 3.4 / state.viewScale, interceptCol.core, 0.78 * lodMul);

    if (route.blocker) {
      strokeCircle(route.blocker.x, route.blocker.y, (route.blocker.blockR + 12) / state.viewScale, 1.1 / state.viewScale, interceptCol.core, 0.34 * lodMul);
      fillCircle(route.blocker.x, route.blocker.y, 3.1 / state.viewScale, interceptCol.core, 0.48 * lodMul);
    }

    if (route.redirect && route.redirect.length > 1) {
      var hostileHead = samplePath(route.redirect, isExiting ? 1 - animK : animK);
      fillCircle(hostileHead.x, hostileHead.y, 5.4 / state.viewScale, rgba(interceptCol.glow, 0.18), 1);
      fillCircle(hostileHead.x, hostileHead.y, 2.3 / state.viewScale, interceptCol.edge, 0.82 * lodMul);
    } else {
      var approxHead = {
        x: lerp(pt.x, targetCore.x, animK),
        y: lerp(pt.y, targetCore.y, animK)
      };
      fillCircle(approxHead.x, approxHead.y, 5.4 / state.viewScale, rgba(interceptCol.glow, 0.18), 1);
      fillCircle(approxHead.x, approxHead.y, 2.3 / state.viewScale, interceptCol.edge, 0.82 * lodMul);
    }

    if (isExiting) {
      var spliceT = clamp(route.interceptT != null ? route.interceptT : anim.t, 0.08, 1);
      var returnHead = samplePath(route.main, lerp(spliceT, 1, animK));
      fillCircle(returnHead.x, returnHead.y, 5.1 / state.viewScale, rgba(res.glow, 0.16), 1);
      fillCircle(returnHead.x, returnHead.y, 2.1 / state.viewScale, res.secondary, 0.80 * lodMul);
    }
  }

  function drawPacket(packet, route, variant, lod) {
    var res = RESOURCE[packet.resourceType];
    var sample = sampleSplicedRoute(route, packet.progress, packet.lane);
    var scale = lod.packetScale * packet.value / state.viewScale;
    var pulse = 0.75 + 0.25 * Math.sin(state.time * 4 + packet.styleSeed);

    if (lod.packetTrail > 0) {
      for (var i = lod.packetTrail; i >= 1; i--) {
        var prev = sampleSplicedRoute(route, clamp(packet.progress - i * 0.018, 0, 1), packet.lane);
        fillCircle(prev.x, prev.y, (0.8 + i * 0.28) * scale, rgba(res.glow, 0.06 * (1 - i / (lod.packetTrail + 1))), 1);
      }
    }

    ctx.save();
    ctx.translate(sample.x, sample.y);
    ctx.rotate(sample.angle + packet.styleSeed * 0.3);

    if (lod === LODS.far) {
      fillCircle(0, 0, 2.0 * scale, res.primary, 0.72);
      ctx.restore();
      return;
    }

    if (packet.resourceType === "money") {
      if (variant.packetStyle === "prism" || variant.packetStyle === "relay") {
        drawHex(0, 0, 4.6 * scale, res.primary, 0.84, res.secondary, 0.45, Math.PI / 6);
      } else if (variant.packetStyle === "paired") {
        drawHex(-2.4 * scale, 0, 3.4 * scale, res.primary, 0.66, res.secondary, 0.32, Math.PI / 6);
        drawHex(2.4 * scale, 0, 2.7 * scale, res.accent, 0.52, res.secondary, 0.22, Math.PI / 6);
      } else if (variant.packetStyle === "droplet") {
        fillCircle(0, 0, 4.8 * scale, res.primary, 0.52);
        drawHex(0, 0, 3.4 * scale, res.secondary, 0.22, res.secondary, 0.24, Math.PI / 6);
      } else {
        ctx.beginPath();
        ctx.roundRect(-5.0 * scale, -3.1 * scale, 10.0 * scale, 6.2 * scale, 2.2 * scale);
        ctx.fillStyle = res.primary;
        ctx.globalAlpha = 0.80;
        ctx.fill();
        ctx.strokeStyle = res.secondary;
        ctx.lineWidth = 0.9 * scale;
        ctx.globalAlpha = 0.42;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      fillCircle(0, 0, 1.3 * scale, "#ffffff", 0.26 * pulse);
    } else {
      if (variant.packetStyle === "paired") {
        fillCircle(-2.2 * scale, 0, 3.2 * scale, res.primary, 0.42);
        fillCircle(2.0 * scale, 0, 2.2 * scale, res.accent, 0.30);
      } else if (variant.packetStyle === "relay") {
        ctx.beginPath();
        ctx.moveTo(0, -4.8 * scale);
        ctx.lineTo(4.0 * scale, 0);
        ctx.lineTo(0, 4.8 * scale);
        ctx.lineTo(-4.0 * scale, 0);
        ctx.closePath();
        ctx.fillStyle = res.primary;
        ctx.globalAlpha = 0.56;
        ctx.fill();
        ctx.strokeStyle = res.secondary;
        ctx.lineWidth = 0.9 * scale;
        ctx.globalAlpha = 0.36;
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        fillCircle(0, 0, 4.4 * scale, res.primary, variant.packetStyle === "droplet" ? 0.38 : 0.50);
        strokeCircle(0, 0, 4.4 * scale, 0.8 * scale, res.secondary, 0.38);
      }
      fillCircle(0, 0, 1.5 * scale, res.accent, 0.22 * pulse);
      fillCircle(0, 0, 0.95 * scale, "#ffffff", 0.34);
    }
    ctx.restore();
  }

  function drawFlashes() {
    for (var i = 0; i < state.flashes.length; i++) {
      var fx = state.flashes[i];
      fillCircle(fx.x, fx.y, fx.r / state.viewScale, fx.color, fx.alpha * 0.18);
      strokeCircle(fx.x, fx.y, fx.r * 0.68 / state.viewScale, 1.0 / state.viewScale, fx.color, fx.alpha * 0.42);
    }
  }

  function drawSceneWorld() {
    var lod = getLod();
    ctx.save();
    ctx.translate(state.viewX, state.viewY);
    ctx.scale(state.viewScale, state.viewScale);

    var routes = state.routes;
    routes.forEach(function (route) { drawRoute(route, route.variant, lod); });
    for (var i = 0; i < state.mines.length; i++) drawMine(state.mines[i], routes.get(state.mines[i].id), lod);
    for (var p = 0; p < state.packets.length; p++) {
      var route = routes.get(state.packets[p].mineId);
      if (route) drawPacket(state.packets[p], route, route.variant, lod);
    }
    drawFlashes();

    var activeShips = Math.round(Number(controls.shipCount.value || 3));
    for (var s = 0; s < activeShips; s++) {
      var ship = state.ships[s];
      var active = false;
      routes.forEach(function (route) {
        if (route.blocker === ship) active = true;
      });
      drawShip(ship, active);
    }

    drawCore("player", state.cores.player, lod);
    drawCore("enemy", state.cores.enemy, lod);
    ctx.restore();
  }

  function updateStatus() {
    var mix = getVariantMix();
    var backdrop = getBackdropVariant();
    var rerouted = 0;
    state.routes.forEach(function (route) { if (route.rerouted) rerouted++; });
    var lodKey = getLodKey().toUpperCase();
    var haze = Math.round(controlRatio(controls.backdropNebula, 0.58) * 100);
    var depth = Math.round(controlRatio(controls.redirectSoftness, 0.56) * 100);
    var comet = Math.round(controlRatio(controls.cometRate, 0.34) * 100);
    var flare = Math.round(controlRatio(controls.flareRate, 0.22) * 100);
    texts.status.textContent =
      "Money: " + mix.money.name + " | XP: " + mix.xp.name +
      " | BG: " + backdrop.name +
      " | LOD " + lodKey +
      " | visual packets are client-only | rerouted lanes: " + rerouted +
      " | haze " + haze + "% parallax " + depth + "% comet " + comet + "% flare " + flare + "%" +
      " | prod audit: stars use layered parallax, nebulae use slower deep factors";
  }

  function frame(now) {
    resizeCanvas();
    if (!state.lastNow) state.lastNow = now;
    var dt = Math.min(0.033, (now - state.lastNow) / 1000);
    state.lastNow = now;
    state.time += dt;

    updateShips(dt);
    state.routes = buildRoutes(dt);
    spawnPackets(dt, state.routes);
    updatePackets(dt, state.routes);
    updateFlashes(dt);
    updateBackdrop(dt);

    drawBackdrop();
    drawSceneWorld();
    updateStatus();
    requestAnimationFrame(frame);
  }

  state.moneyVariantIndex = 0;
  state.xpVariantIndex = 2;
  seedBackdrop();
  resetLayout(false);
  bind();
  setAccent();
  updateTexts();
  requestAnimationFrame(frame);
})();
