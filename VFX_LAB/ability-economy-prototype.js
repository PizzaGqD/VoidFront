(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var canvas = document.getElementById("scene");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var controls = {
    mode: document.getElementById("mode"),
    stealVariant: document.getElementById("stealVariant"),
    burstVariant: document.getElementById("burstVariant"),
    routeSide: document.getElementById("routeSide"),
    lodMode: document.getElementById("lodMode"),
    burstTarget: document.getElementById("burstTarget"),
    tempo: document.getElementById("tempo"),
    density: document.getElementById("density"),
    signalTail: document.getElementById("signalTail"),
    cycleSteal: document.getElementById("cycleSteal"),
    cycleBurst: document.getElementById("cycleBurst"),
    triggerSteal: document.getElementById("triggerSteal"),
    triggerBurst: document.getElementById("triggerBurst"),
    triggerBoth: document.getElementById("triggerBoth"),
    swapRoles: document.getElementById("swapRoles")
  };

  var texts = {
    title: document.getElementById("variantTitle"),
    subtitle: document.getElementById("variantSubtitle"),
    status: document.getElementById("statusLine"),
    steal: document.getElementById("legendSteal"),
    burst: document.getElementById("legendBurst"),
    focus: document.getElementById("legendFocus")
  };

  var COLORS = {
    bgA: "#040812",
    bgB: "#071021",
    fieldFill: "#081120",
    fieldBorder: "#1f3658",
    corridorGlow: "66,140,255",
    corridorCore: "178,220,255",
    thief: { fill: "#ff8f48", edge: "#ffe0b0", glow: "255,143,72", dark: "#4a2410" },
    victim: { fill: "#68d8ff", edge: "#e1f7ff", glow: "104,216,255", dark: "#103347" },
    ghost: { fill: "#30384f", edge: "#7787a8", glow: "90,116,168", dark: "#111723" },
    signal: { fill: "#ff4259", edge: "#ffd6dd", glow: "255,66,89" },
    gold: { fill: "#ffcb54", edge: "#fff0b7", glow: "255,203,84" }
  };

  var STEAL_VARIANTS = [
    {
      key: "scarlet-arc",
      name: "01. Scarlet Arc",
      note: "Самый чистый вариант: длинный тонкий сигнал и ровная обратная packet-chain по большой внешней дуге.",
      read: "Это базовый кандидат, если `Воровство энергии` должно читаться сразу и без лишнего шума: дуга, пробой, отток, всос.",
      routeStyle: "single",
      signalStyle: "needle",
      chainStyle: "packet",
      victimFx: "crack",
      thiefFx: "pulse",
      ctrlA: 0.04,
      ctrlB: -0.04,
      outset: 0.46,
      midOut: 0.72,
      startOut: 0.24,
      endOut: 0.22,
      laneOffset: 0
    },
    {
      key: "parasite-ribbon",
      name: "02. Parasite Ribbon",
      note: "Красный сигнал мягче и шире, а обратно идет почти непрерывная siphon-лента с частыми переливами цвета жертвы.",
      read: "Подходит, если эффект хочется сделать более живым и паразитическим, а не просто сигналом и набором пакетов.",
      routeStyle: "ribbon",
      signalStyle: "ribbon",
      chainStyle: "ribbon",
      victimFx: "sparks",
      thiefFx: "ring",
      ctrlA: 0.00,
      ctrlB: 0.00,
      outset: 0.54,
      midOut: 0.82,
      startOut: 0.28,
      endOut: 0.25,
      laneOffset: 0
    },
    {
      key: "relay-heist",
      name: "03. Relay Heist",
      note: "Дуга разбита на две relay-фазы: сигнал идет секциями, а энергия возвращается ступенчатым военным handoff-потоком.",
      read: "Хороший вариант, если хочется чуть больше tactical tech-language и меньше органического сифона.",
      routeStyle: "relay",
      signalStyle: "segmented",
      chainStyle: "relay",
      victimFx: "crackSparks",
      thiefFx: "beacon",
      ctrlA: 0.02,
      ctrlB: 0.03,
      outset: 0.42,
      midOut: 0.66,
      startOut: 0.22,
      endOut: 0.20,
      laneOffset: 0
    },
    {
      key: "braid-siphon",
      name: "04. Braid Siphon",
      note: "Основной маршрут остается дугой, но сама энергия возвращается по двум переплетенным дорожкам, будто поток сшивает маршрут обратно.",
      read: "Лучше всего продает идею долгого siphon-процесса, а не мгновенного импульса.",
      routeStyle: "braid",
      signalStyle: "forked",
      chainStyle: "braid",
      victimFx: "shell",
      thiefFx: "spin",
      ctrlA: -0.03,
      ctrlB: 0.04,
      outset: 0.58,
      midOut: 0.90,
      startOut: 0.26,
      endOut: 0.26,
      laneOffset: 11
    },
    {
      key: "harpoon-sweep",
      name: "05. Harpoon Sweep",
      note: "Более агрессивный и длинный harpoon-route: сигнал как багровый гарпун, а обратный поток идет более острыми shard-пакетами.",
      read: "Если у способности должен быть злой, колющий характер, это самый сильный кандидат среди arc-вариантов.",
      routeStyle: "hook",
      signalStyle: "harpoon",
      chainStyle: "shard",
      victimFx: "static",
      thiefFx: "snap",
      ctrlA: 0.06,
      ctrlB: 0.06,
      outset: 0.68,
      midOut: 0.86,
      startOut: 0.30,
      endOut: 0.32,
      laneOffset: 4
    },
    {
      key: "eclipse-siphon",
      name: "06. Eclipse Siphon",
      note: "Самая большая дуга в линии: почти орбитальный обход, halo-узлы на траектории и тяжелый финальный всос в ядро-вор.",
      read: "Это самый зрелищный вариант семьи. Нужен, если effect должен тянуть почти на легендарный уровень, но без потери маршрута.",
      routeStyle: "orbital",
      signalStyle: "eclipse",
      chainStyle: "halo",
      victimFx: "overload",
      thiefFx: "eclipse",
      ctrlA: 0.00,
      ctrlB: 0.00,
      outset: 0.78,
      midOut: 1.08,
      startOut: 0.34,
      endOut: 0.34,
      laneOffset: 0
    }
  ];

  var BURST_VARIANTS = [
    {
      key: "ledger-draft",
      name: "01. Ledger Draft",
      note: "Чистый денежный вектор: почти прямая подача из угла и аккуратные квадратные плашки в ядро.",
      read: "Базовый вариант на читаемость. Хорошо проверяет, нужен ли burst-у вообще более сложный маршрут, чем прямой заход.",
      routeStyle: "straight",
      packetStyle: "bill",
      sourceFx: "flare",
      arrivalFx: "ring",
      laneOffset: 0,
      arcOut: 0.00,
      sourceOut: 0.22
    },
    {
      key: "convoy-run",
      name: "02. Convoy Run",
      note: "Поток ведет себя как колонна: сначала короткий run вдоль границы, затем плотный заход в ядро с тяжелыми денежными плитками.",
      read: "Подходит, если хочется чуть больше логистики и ощущения, что богатство реально везут с внешнего края карты.",
      routeStyle: "rail",
      packetStyle: "plate",
      sourceFx: "vault",
      arrivalFx: "stack",
      laneOffset: 0,
      arcOut: 0.18,
      sourceOut: 0.24
    },
    {
      key: "mint-comets",
      name: "03. Mint Comets",
      note: "Из угла влетают золотые comet-полосы с длинным хвостом, а сама траектория имеет мягкую shallow arc-подачу.",
      read: "Самый быстрый и зрелищный кандидат среди burst-вариантов, если нужны не просто купюры, а дорогой поток золота.",
      routeStyle: "arc",
      packetStyle: "comet",
      sourceFx: "fan",
      arrivalFx: "flare",
      laneOffset: 0,
      arcOut: 0.26,
      sourceOut: 0.30
    },
    {
      key: "treasury-ladder",
      name: "04. Treasury Ladder",
      note: "Весь поток подается релейно: ступени, короткие cross-ticks и почти табличный расчет богатства на входе в ядро.",
      read: "Если хочется более tech-economic язык вместо просто золотой плазмы, этот вариант работает лучше всего.",
      routeStyle: "rail",
      packetStyle: "ladder",
      sourceFx: "mint",
      arrivalFx: "doubleRing",
      laneOffset: 0,
      arcOut: 0.12,
      sourceOut: 0.20
    },
    {
      key: "crown-influx",
      name: "05. Crown Influx",
      note: "Поток идет двумя смещенными дорожками, которые сходятся в ядре, словно золотая корона складывается внутрь.",
      read: "Самый ceremonial вариант. Хорошо подходит, если resource burst должен чувствоваться именно как богато оформленный приток.",
      routeStyle: "arc",
      packetStyle: "crown",
      sourceFx: "crown",
      arrivalFx: "doubleRing",
      laneOffset: 9,
      arcOut: 0.18,
      sourceOut: 0.28
    },
    {
      key: "auric-surge",
      name: "06. Auric Surge",
      note: "Из угла сначала раскрывается широкая золотая волна, а затем внутрь летят тяжелые ingot-пакеты по самой плотной траектории.",
      read: "Это самый жирный вариант линии. Нужен, если burst должен ощущаться как крупный приток, а не просто UI-награда.",
      routeStyle: "surge",
      packetStyle: "ingot",
      sourceFx: "vault",
      arrivalFx: "stack",
      laneOffset: 4,
      arcOut: 0.32,
      sourceOut: 0.36
    }
  ];

  var state = {
    time: 0,
    stars: [],
    swapped: false,
    stealFx: null,
    burstFx: null,
    lastAutoAt: -999,
    stealIndex: 0,
    burstIndex: 0
  };

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(a, b, value) {
    var t = clamp01((value - a) / Math.max(0.0001, b - a));
    return t * t * (3 - 2 * t);
  }

  function easeOutCubic(t) {
    var v = 1 - clamp01(t);
    return 1 - v * v * v;
  }

  function easeInCubic(t) {
    var v = clamp01(t);
    return v * v * v;
  }

  function easeOutQuad(t) {
    var v = clamp01(t);
    return 1 - (1 - v) * (1 - v);
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

  function distance(a, b) {
    var dx = (b.x || 0) - (a.x || 0);
    var dy = (b.y || 0) - (a.y || 0);
    return Math.hypot(dx, dy);
  }

  function lerpPoint(a, b, t) {
    return { x: lerp(a.x || 0, b.x || 0, t), y: lerp(a.y || 0, b.y || 0, t) };
  }

  function pushFromCenter(point, center, amount) {
    var dx = (point.x || 0) - (center.x || 0);
    var dy = (point.y || 0) - (center.y || 0);
    var len = Math.hypot(dx, dy) || 1;
    return {
      x: (point.x || 0) + dx / len * amount,
      y: (point.y || 0) + dy / len * amount
    };
  }

  function cubicPoint(p0, p1, p2, p3, t) {
    var inv = 1 - t;
    return {
      x: inv * inv * inv * p0.x + 3 * inv * inv * t * p1.x + 3 * inv * t * t * p2.x + t * t * t * p3.x,
      y: inv * inv * inv * p0.y + 3 * inv * inv * t * p1.y + 3 * inv * t * t * p2.y + t * t * t * p3.y
    };
  }

  function buildCubicPoints(p0, p1, p2, p3, samples) {
    var out = [];
    var count = Math.max(6, samples || 18);
    for (var i = 0; i <= count; i++) out.push(cubicPoint(p0, p1, p2, p3, i / count));
    return out;
  }

  function concatPaths(parts) {
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var list = parts[i];
      if (!list || !list.length) continue;
      for (var j = 0; j < list.length; j++) {
        if (out.length) {
          var prev = out[out.length - 1];
          if (distance(prev, list[j]) < 0.4) continue;
        }
        out.push({ x: list[j].x, y: list[j].y });
      }
    }
    return out;
  }

  function makeRoute(points) {
    var lengths = [0];
    var total = 0;
    for (var i = 1; i < points.length; i++) {
      total += distance(points[i - 1], points[i]);
      lengths.push(total);
    }
    return { points: points, lengths: lengths, total: total };
  }

  function sampleRoute(route, distanceValue) {
    if (!route || !route.points || route.points.length < 2) return { x: 0, y: 0, angle: 0 };
    var d = Math.max(0, Math.min(route.total, distanceValue));
    for (var i = 1; i < route.points.length; i++) {
      var prev = route.lengths[i - 1];
      var next = route.lengths[i];
      if (d <= next || i === route.points.length - 1) {
        var seg = Math.max(0.0001, next - prev);
        var t = clamp01((d - prev) / seg);
        var a = route.points[i - 1];
        var b = route.points[i];
        return {
          x: lerp(a.x, b.x, t),
          y: lerp(a.y, b.y, t),
          angle: Math.atan2(b.y - a.y, b.x - a.x)
        };
      }
    }
    var last = route.points[route.points.length - 1];
    var before = route.points[route.points.length - 2];
    return { x: last.x, y: last.y, angle: Math.atan2(last.y - before.y, last.x - before.x) };
  }

  function buildRouteSegment(route, fromDistance, toDistance, steps) {
    var from = Math.max(0, Math.min(route.total, fromDistance));
    var to = Math.max(0, Math.min(route.total, toDistance));
    var count = Math.max(2, steps || 8);
    var out = [];
    for (var i = 0; i <= count; i++) {
      var d = lerp(from, to, i / count);
      var sample = sampleRoute(route, d);
      out.push({ x: sample.x, y: sample.y });
    }
    return out;
  }

  function buildRouteSegmentOffset(route, fromDistance, toDistance, steps, offset) {
    var from = Math.max(0, Math.min(route.total, fromDistance));
    var to = Math.max(0, Math.min(route.total, toDistance));
    var count = Math.max(2, steps || 8);
    var out = [];
    for (var i = 0; i <= count; i++) {
      var d = lerp(from, to, i / count);
      var sample = sampleRoute(route, d);
      var perpX = -Math.sin(sample.angle || 0);
      var perpY = Math.cos(sample.angle || 0);
      out.push({ x: sample.x + perpX * offset, y: sample.y + perpY * offset });
    }
    return out;
  }

  function drawSmoothStroke(points, width, color, alpha) {
    if (!points || points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length - 1; i++) {
      var mx = (points[i].x + points[i + 1].x) * 0.5;
      var my = (points[i].y + points[i + 1].y) * 0.5;
      ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.strokeStyle = color.indexOf("#") === 0 ? rgbaHex(color, alpha) : rgba(color, alpha);
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function drawSmoothFill(points, color, alpha) {
    if (!points || points.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length - 1; i++) {
      var mx = (points[i].x + points[i + 1].x) * 0.5;
      var my = (points[i].y + points[i + 1].y) * 0.5;
      ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.fillStyle = color.indexOf("#") === 0 ? rgbaHex(color, alpha) : rgba(color, alpha);
    ctx.fill();
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    var width = Math.max(640, Math.floor(rect.width));
    var height = Math.max(480, Math.floor(rect.height));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildStars(width, height);
  }

  function rebuildStars(width, height) {
    state.stars = [];
    var count = Math.max(90, Math.floor(width * height / 14000));
    for (var i = 0; i < count; i++) {
      state.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.4 + Math.random() * 1.5,
        alpha: 0.08 + Math.random() * 0.34,
        drift: 0.08 + Math.random() * 0.72
      });
    }
  }

  function getTempo() {
    return Number(controls.tempo.value || 100) / 100;
  }

  function getDensity() {
    return Number(controls.density.value || 92) / 100;
  }

  function getSignalTail() {
    return Number(controls.signalTail.value || 82) / 100;
  }

  function getLodKey() {
    if (controls.lodMode.value !== "auto") return controls.lodMode.value;
    var budget = getTempo() * 0.56 + getDensity() * 0.44;
    if (budget >= 1.10) return "far";
    if (budget >= 0.90) return "mid";
    return "near";
  }

  function getLodSpec() {
    var key = getLodKey();
    if (key === "far") {
      return { key: key, routeSamples: 10, previewAlpha: 0.55, packetMul: 0.48, sparkMul: 0.46, trailMul: 0.34, haloMul: 0.55 };
    }
    if (key === "mid") {
      return { key: key, routeSamples: 15, previewAlpha: 0.75, packetMul: 0.72, sparkMul: 0.72, trailMul: 0.68, haloMul: 0.78 };
    }
    return { key: key, routeSamples: 22, previewAlpha: 1.00, packetMul: 1.00, sparkMul: 1.00, trailMul: 1.00, haloMul: 1.00 };
  }

  function getStealVariant() {
    return STEAL_VARIANTS[state.stealIndex] || STEAL_VARIANTS[0];
  }

  function getBurstVariant() {
    return BURST_VARIANTS[state.burstIndex] || BURST_VARIANTS[0];
  }

  function getScene() {
    var width = canvas.clientWidth || 1280;
    var height = canvas.clientHeight || 720;
    var field = {
      x: width * 0.18,
      y: height * 0.16,
      w: width * 0.64,
      h: height * 0.62
    };
    var pad = Math.max(62, Math.min(width, height) * 0.075);
    var inset = Math.max(54, Math.min(field.w, field.h) * 0.10);
    var center = { x: field.x + field.w * 0.5, y: field.y + field.h * 0.5 };
    var corners = {
      tl: { key: "tl", x: field.x - pad, y: field.y - pad },
      tr: { key: "tr", x: field.x + field.w + pad, y: field.y - pad },
      br: { key: "br", x: field.x + field.w + pad, y: field.y + field.h + pad },
      bl: { key: "bl", x: field.x - pad, y: field.y + field.h + pad }
    };
    var cores = {
      tl: { key: "tl", x: field.x + inset, y: field.y + inset },
      tr: { key: "tr", x: field.x + field.w - inset, y: field.y + inset },
      br: { key: "br", x: field.x + field.w - inset, y: field.y + field.h - inset },
      bl: { key: "bl", x: field.x + inset, y: field.y + field.h - inset }
    };
    var thief = state.swapped ? cores.tr : cores.tl;
    var victim = state.swapped ? cores.bl : cores.br;
    var ghosts = state.swapped ? [cores.tl, cores.br] : [cores.tr, cores.bl];
    return {
      width: width,
      height: height,
      field: field,
      pad: pad,
      center: center,
      corners: corners,
      thief: thief,
      victim: victim,
      ghosts: ghosts
    };
  }

  function drawBackground(scene) {
    var grad = ctx.createLinearGradient(0, 0, 0, scene.height);
    grad.addColorStop(0, COLORS.bgA);
    grad.addColorStop(1, COLORS.bgB);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, scene.width, scene.height);

    var haze = ctx.createRadialGradient(scene.width * 0.50, scene.height * 0.46, 0, scene.width * 0.50, scene.height * 0.46, scene.width * 0.70);
    haze.addColorStop(0, "rgba(82,118,255,0.07)");
    haze.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, scene.width, scene.height);

    for (var i = 0; i < state.stars.length; i++) {
      var star = state.stars[i];
      ctx.beginPath();
      ctx.fillStyle = "rgba(220,232,255," + star.alpha + ")";
      ctx.arc(
        star.x + Math.sin(state.time * star.drift + i) * 4,
        star.y + Math.cos(state.time * star.drift * 0.7 + i * 1.7) * 3,
        star.r,
        0,
        TAU
      );
      ctx.fill();
    }
  }

  function drawCorridor(points, widthMul) {
    drawSmoothStroke(points, 26 * widthMul, COLORS.corridorGlow, 0.12);
    drawSmoothStroke(points, 14 * widthMul, COLORS.corridorGlow, 0.17);
    drawSmoothStroke(points, 6 * widthMul, COLORS.corridorCore, 0.22);
  }

  function drawField(scene) {
    var field = scene.field;
    ctx.fillStyle = COLORS.fieldFill;
    ctx.strokeStyle = rgbaHex("#25476d", 0.86);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(field.x, field.y, field.w, field.h, 26);
    ctx.fill();
    ctx.stroke();

    var center = scene.center;
    drawCorridor([
      { x: field.x + 30, y: center.y - 50 },
      { x: center.x - 60, y: center.y - 24 },
      { x: center.x + 60, y: center.y + 24 },
      { x: field.x + field.w - 30, y: center.y + 50 }
    ], 1.0);
    drawCorridor([
      { x: field.x + 58, y: field.y + 54 },
      { x: center.x - 40, y: center.y - 18 },
      { x: field.x + field.w - 56, y: field.y + field.h - 52 }
    ], 0.92);
    drawCorridor([
      { x: field.x + field.w - 58, y: field.y + 54 },
      { x: center.x + 42, y: center.y - 8 },
      { x: field.x + 56, y: field.y + field.h - 54 }
    ], 0.92);

    ctx.strokeStyle = "rgba(148,190,255,0.08)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 8]);
    for (var i = 1; i < 4; i++) {
      var x = field.x + field.w * i / 4;
      ctx.beginPath();
      ctx.moveTo(x, field.y + 16);
      ctx.lineTo(x, field.y + field.h - 16);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawCore(core, palette, extraPulse, label) {
    var pulse = 0.5 + 0.5 * Math.sin(state.time * 3.0 + core.x * 0.01 + core.y * 0.013);
    var radius = 16 + (extraPulse || 0) * 5;
    ctx.beginPath();
    ctx.fillStyle = rgba(palette.glow, 0.12 + pulse * 0.08 + (extraPulse || 0) * 0.06);
    ctx.arc(core.x, core.y, radius + 16, 0, TAU);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = palette.dark;
    ctx.arc(core.x, core.y, radius, 0, TAU);
    ctx.fill();

    ctx.beginPath();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = palette.edge;
    ctx.arc(core.x, core.y, radius, 0, TAU);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = palette.fill;
    ctx.arc(core.x, core.y, radius * 0.46, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "rgba(226,238,255,0.9)";
    ctx.font = "11px Inter, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, core.x, core.y - radius - 12);
  }

  function drawCoreAura(core, glow, strength) {
    var alpha = Math.max(0, strength || 0);
    if (alpha <= 0) return;
    ctx.beginPath();
    ctx.fillStyle = rgba(glow, 0.06 + alpha * 0.12);
    ctx.arc(core.x, core.y, 32 + alpha * 20, 0, TAU);
    ctx.fill();
  }

  function drawRing(core, color, glow, progress, mul) {
    var ring = easeOutCubic(progress);
    var sizeMul = mul || 1;
    ctx.beginPath();
    ctx.arc(core.x, core.y, (22 + ring * 28) * sizeMul, 0, TAU);
    ctx.strokeStyle = rgba(glow, 0.22 * (1 - progress));
    ctx.lineWidth = (5 - progress * 2.8) * sizeMul;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(core.x, core.y, (18 + ring * 20) * sizeMul, 0, TAU);
    ctx.strokeStyle = rgbaHex(color, 0.65 * (1 - progress));
    ctx.lineWidth = 2 * sizeMul;
    ctx.stroke();
  }

  function drawSignalHead(sample, angle, style, size) {
    ctx.save();
    ctx.translate(sample.x, sample.y);
    ctx.rotate(angle || 0);
    if (style === "harpoon") {
      ctx.beginPath();
      ctx.fillStyle = rgba(COLORS.signal.glow, 0.24);
      ctx.moveTo(size * 1.45, 0);
      ctx.lineTo(-size * 0.80, -size * 0.95);
      ctx.lineTo(-size * 0.54, 0);
      ctx.lineTo(-size * 0.80, size * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = COLORS.signal.fill;
      ctx.moveTo(size * 1.12, 0);
      ctx.lineTo(-size * 0.52, -size * 0.64);
      ctx.lineTo(-size * 0.22, 0);
      ctx.lineTo(-size * 0.52, size * 0.64);
      ctx.closePath();
      ctx.fill();
    } else if (style === "eclipse") {
      ctx.beginPath();
      ctx.fillStyle = rgba(COLORS.signal.glow, 0.18);
      ctx.arc(0, 0, size * 1.30, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = COLORS.signal.fill;
      ctx.arc(0, 0, size * 0.58, 0, TAU);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.fillStyle = rgba(COLORS.signal.glow, 0.22);
      ctx.roundRect(-size * 1.0, -size * 0.75, size * 2.0, size * 1.5, size * 0.45);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = COLORS.signal.fill;
      ctx.roundRect(-size * 0.60, -size * 0.36, size * 1.2, size * 0.72, size * 0.22);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawStealPacket(sample, angle, style, size, alpha) {
    ctx.save();
    ctx.translate(sample.x, sample.y);
    ctx.rotate(angle || 0);
    if (style === "shard") {
      ctx.beginPath();
      ctx.fillStyle = rgba(COLORS.signal.glow, alpha * 0.20);
      ctx.moveTo(size * 1.05, 0);
      ctx.lineTo(0, -size * 0.76);
      ctx.lineTo(-size * 0.94, 0);
      ctx.lineTo(0, size * 0.76);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = rgbaHex(COLORS.victim.fill, alpha * 0.36);
      ctx.moveTo(size * 0.72, 0);
      ctx.lineTo(0, -size * 0.52);
      ctx.lineTo(-size * 0.64, 0);
      ctx.lineTo(0, size * 0.52);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = rgbaHex(COLORS.signal.fill, alpha * 0.34);
      ctx.rect(-size * 0.22, -size * 0.14, size * 0.44, size * 0.28);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.fillStyle = rgba(COLORS.signal.glow, alpha * 0.16);
      ctx.roundRect(-size, -size * 0.66, size * 2, size * 1.32, size * 0.34);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = rgbaHex(COLORS.victim.fill, alpha * 0.28);
      ctx.roundRect(-size * 0.70, -size * 0.42, size * 1.40, size * 0.84, size * 0.24);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = rgbaHex(COLORS.signal.fill, alpha * 0.30);
      ctx.roundRect(-size * 0.36, -size * 0.22, size * 0.72, size * 0.44, size * 0.14);
      ctx.fill();
      if (style === "halo") {
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.92, 0, TAU);
        ctx.strokeStyle = rgba(COLORS.signal.glow, alpha * 0.18);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawBurstPacket(sample, angle, style, size, alpha) {
    ctx.save();
    ctx.translate(sample.x, sample.y);
    ctx.rotate(angle || 0);
    if (style === "ingot") {
      ctx.beginPath();
      ctx.fillStyle = rgba(COLORS.gold.glow, alpha * 0.22);
      ctx.roundRect(-size * 1.00, -size * 0.62, size * 2.00, size * 1.24, size * 0.28);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = rgbaHex(COLORS.gold.fill, alpha);
      ctx.roundRect(-size * 0.72, -size * 0.40, size * 1.44, size * 0.80, size * 0.20);
      ctx.fill();
    } else if (style === "comet") {
      ctx.beginPath();
      ctx.fillStyle = rgba(COLORS.gold.glow, alpha * 0.18);
      ctx.moveTo(size * 1.30, 0);
      ctx.lineTo(-size * 0.84, -size * 0.58);
      ctx.lineTo(-size * 0.42, 0);
      ctx.lineTo(-size * 0.84, size * 0.58);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = rgbaHex(COLORS.gold.fill, alpha * 0.92);
      ctx.moveTo(size * 0.92, 0);
      ctx.lineTo(-size * 0.54, -size * 0.38);
      ctx.lineTo(-size * 0.18, 0);
      ctx.lineTo(-size * 0.54, size * 0.38);
      ctx.closePath();
      ctx.fill();
    } else if (style === "crown") {
      ctx.beginPath();
      ctx.fillStyle = rgba(COLORS.gold.glow, alpha * 0.18);
      ctx.roundRect(-size, -size * 0.66, size * 2, size * 1.32, size * 0.34);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = rgbaHex(COLORS.gold.fill, alpha);
      ctx.moveTo(-size * 0.74, size * 0.34);
      ctx.lineTo(-size * 0.48, -size * 0.46);
      ctx.lineTo(0, size * 0.10);
      ctx.lineTo(size * 0.48, -size * 0.46);
      ctx.lineTo(size * 0.74, size * 0.34);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.fillStyle = rgba(COLORS.gold.glow, alpha * 0.18);
      ctx.roundRect(-size, -size * 0.72, size * 2, size * 1.44, size * 0.34);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = rgbaHex(COLORS.gold.fill, alpha);
      ctx.roundRect(-size * 0.72, -size * 0.46, size * 1.44, size * 0.92, size * 0.24);
      ctx.fill();
      if (style === "plate" || style === "ladder") {
        ctx.beginPath();
        ctx.strokeStyle = rgbaHex(COLORS.gold.edge, alpha * 0.88);
        ctx.lineWidth = 1.2;
        ctx.roundRect(-size * 0.72, -size * 0.46, size * 1.44, size * 0.92, size * 0.24);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function hermitePoint(p0, p1, p2, p3, t, tension) {
    var tt = t * t;
    var ttt = tt * t;
    var mScale = (1 - (tension || 0)) * 0.5;
    var m1x = ((p2.x || 0) - (p0.x || 0)) * mScale;
    var m1y = ((p2.y || 0) - (p0.y || 0)) * mScale;
    var m2x = ((p3.x || 0) - (p1.x || 0)) * mScale;
    var m2y = ((p3.y || 0) - (p1.y || 0)) * mScale;
    var h00 = 2 * ttt - 3 * tt + 1;
    var h10 = ttt - 2 * tt + t;
    var h01 = -2 * ttt + 3 * tt;
    var h11 = ttt - tt;
    return {
      x: h00 * (p1.x || 0) + h10 * m1x + h01 * (p2.x || 0) + h11 * m2x,
      y: h00 * (p1.y || 0) + h10 * m1y + h01 * (p2.y || 0) + h11 * m2y
    };
  }

  function buildHermiteChain(points, samplesPerSegment, tension) {
    if (!points || points.length < 2) return points ? points.slice() : [];
    var out = [];
    var samples = Math.max(4, samplesPerSegment || 10);
    for (var i = 0; i < points.length - 1; i++) {
      var p0 = points[Math.max(0, i - 1)];
      var p1 = points[i];
      var p2 = points[i + 1];
      var p3 = points[Math.min(points.length - 1, i + 2)];
      for (var j = 0; j <= samples; j++) {
        if (i > 0 && j === 0) continue;
        out.push(hermitePoint(p0, p1, p2, p3, j / samples, tension));
      }
    }
    return out;
  }

  function makePerimeterPoint(scene, a, b, t, outMul) {
    return pushFromCenter(lerpPoint(a, b, t), scene.center, scene.pad * outMul);
  }

  function resolveStealSide(scene) {
    var value = controls.routeSide.value || "auto";
    if (value !== "auto") return value;
    if (scene.thief.key === "tl" && scene.victim.key === "br") return "clockwise";
    if (scene.thief.key === "tr" && scene.victim.key === "bl") return "counter";
    return "clockwise";
  }

  function getCornerOrder(side) {
    return side === "counter" ? ["tl", "bl", "br", "tr"] : ["tl", "tr", "br", "bl"];
  }

  function getPerimeterKeys(startKey, endKey, side) {
    var order = getCornerOrder(side);
    var startIndex = order.indexOf(startKey);
    var endIndex = order.indexOf(endKey);
    var keys = [];
    var idx = startIndex;
    while (idx !== endIndex) {
      keys.push(order[idx]);
      idx = (idx + 1) % order.length;
    }
    keys.push(order[endIndex]);
    return keys;
  }

  function buildStealRoute(scene, variant, lod) {
    var start = scene.thief;
    var end = scene.victim;
    var side = resolveStealSide(scene);
    var keys = getPerimeterKeys(start.key, end.key, side);
    var c0 = scene.corners[keys[0]];
    var c1 = scene.corners[keys[1]];
    var c2 = scene.corners[keys[2]];
    var center = scene.center;
    var pad = scene.pad;
    var entry = pushFromCenter(lerpPoint(start, c0, 0.48), center, pad * (variant.startOut + 0.16));
    var exit = pushFromCenter(lerpPoint(end, c2, 0.48), center, pad * (variant.endOut + 0.16));
    var edgeA0 = makePerimeterPoint(scene, c0, c1, 0.18, variant.outset + 0.04);
    var edgeA1 = makePerimeterPoint(scene, c0, c1, 0.64 + variant.ctrlA * 0.14, variant.outset + 0.10);
    var apex = pushFromCenter(c1, center, pad * (variant.midOut + 0.08));
    var edgeB0 = makePerimeterPoint(scene, c1, c2, 0.34 + variant.ctrlB * 0.14, variant.outset + 0.10);
    var edgeB1 = makePerimeterPoint(scene, c1, c2, 0.82, variant.outset + 0.04);
    var anchors;
    var tension = 0.52;
    var samples = Math.max(5, lod.routeSamples - 2);

    if (variant.routeStyle === "relay") {
      anchors = [
        start,
        entry,
        makePerimeterPoint(scene, c0, c1, 0.32, variant.outset + 0.02),
        edgeA1,
        pushFromCenter(lerpPoint(c0, c1, 0.92), center, pad * (variant.outset * 0.96)),
        pushFromCenter(lerpPoint(c1, c2, 0.10), center, pad * (variant.outset * 0.96)),
        edgeB0,
        edgeB1,
        exit,
        end
      ];
      tension = 0.68;
    } else if (variant.routeStyle === "hook") {
      anchors = [
        start,
        entry,
        edgeA0,
        edgeA1,
        apex,
        pushFromCenter(lerpPoint(c1, c2, 0.62), center, pad * (variant.outset + 0.18)),
        pushFromCenter(lerpPoint(c1, c2, 0.90), center, pad * (variant.outset + 0.10)),
        exit,
        end
      ];
      tension = 0.58;
    } else if (variant.routeStyle === "orbital") {
      anchors = [
        start,
        entry,
        makePerimeterPoint(scene, c0, c1, 0.26, variant.outset + 0.18),
        makePerimeterPoint(scene, c0, c1, 0.70, variant.outset + 0.24),
        pushFromCenter(c1, center, pad * (variant.midOut + 0.32)),
        makePerimeterPoint(scene, c1, c2, 0.30, variant.outset + 0.24),
        makePerimeterPoint(scene, c1, c2, 0.74, variant.outset + 0.18),
        exit,
        end
      ];
      tension = 0.40;
    } else {
      anchors = [
        start,
        entry,
        edgeA0,
        edgeA1,
        apex,
        edgeB0,
        edgeB1,
        exit,
        end
      ];
    }

    return makeRoute(buildHermiteChain(anchors, samples, tension));
  }

  function buildBurstRoute(scene, targetCore, variant, lod) {
    var center = scene.center;
    var corner = scene.corners[targetCore.key];
    var source = pushFromCenter(corner, center, 54 + scene.pad * variant.sourceOut);
    var cornerGate = pushFromCenter(lerpPoint(source, corner, 0.42), center, scene.pad * 0.08);
    var inner = lerpPoint(corner, targetCore, 0.20);
    var samples = Math.max(5, lod.routeSamples - 3);
    var anchors;
    var tension = 0.58;

    if (variant.routeStyle === "straight") {
      anchors = [source, cornerGate, inner, targetCore];
      tension = 0.74;
    } else if (variant.routeStyle === "rail") {
      var rail = {
        x: corner.x + (corner.x < center.x ? 1 : -1) * scene.pad * 0.44,
        y: corner.y + (corner.y < center.y ? 1 : -1) * scene.pad * 0.08
      };
      var handoff = lerpPoint(rail, targetCore, 0.26);
      anchors = [source, cornerGate, rail, handoff, inner, targetCore];
      tension = 0.64;
    } else if (variant.routeStyle === "surge") {
      var swell = pushFromCenter(lerpPoint(corner, targetCore, 0.34), center, scene.pad * (variant.arcOut + 0.06));
      var swell2 = lerpPoint(swell, targetCore, 0.52);
      anchors = [source, cornerGate, corner, swell, swell2, inner, targetCore];
      tension = 0.46;
    } else {
      var arcA = pushFromCenter(lerpPoint(corner, targetCore, 0.28), center, scene.pad * (variant.arcOut + 0.04));
      var arcB = pushFromCenter(lerpPoint(corner, targetCore, 0.58), center, scene.pad * (variant.arcOut * 0.74));
      anchors = [source, cornerGate, arcA, arcB, inner, targetCore];
      tension = 0.50;
    }

    return makeRoute(buildHermiteChain(anchors, samples, tension));
  }

  function drawRoutePreview(route, color, alpha, width, offset) {
    var points = offset ? buildRouteSegmentOffset(route, 0, route.total, 18, offset) : route.points;
    drawSmoothStroke(points, (width || 3) + 6, color, alpha * 0.08);
    drawSmoothStroke(points, width || 3, color, alpha);
  }

  function drawStealPreview(route, variant, lod) {
    var alpha = 0.12 * lod.previewAlpha;
    if (variant.chainStyle === "braid") {
      drawRoutePreview(route, COLORS.signal.fill, alpha, 1.8, variant.laneOffset);
      drawRoutePreview(route, COLORS.victim.fill, alpha * 0.95, 1.8, -variant.laneOffset);
      return;
    }
    drawRoutePreview(route, COLORS.signal.fill, alpha, 2.2, 0);
  }

  function drawBurstPreview(route, variant, lod) {
    var alpha = 0.10 * lod.previewAlpha;
    if (variant.packetStyle === "crown") {
      drawRoutePreview(route, COLORS.gold.fill, alpha, 1.8, variant.laneOffset);
      drawRoutePreview(route, COLORS.gold.edge, alpha * 0.88, 1.8, -variant.laneOffset);
      return;
    }
    drawRoutePreview(route, COLORS.gold.fill, alpha, 2.0, 0);
  }

  function drawDashedStroke(points, width, color, alpha, stride) {
    if (!points || points.length < 2) return;
    var step = Math.max(2, stride || 3);
    for (var i = 1; i < points.length; i += step) {
      var seg = [points[i - 1], points[i]];
      drawSmoothStroke(seg, width, color, alpha);
    }
  }

  function drawVictimReaction(core, variant, impactT, drainT, lod) {
    var sparkMul = lod.sparkMul;
    if (variant.victimFx === "crack" || variant.victimFx === "crackSparks") {
      var crack = clamp01(1 - impactT + drainT * 0.2);
      for (var i = 0; i < 7; i++) {
        var ang = -1.1 + i * 0.36 + Math.sin(i * 1.7 + state.time * 10) * 0.08;
        var len = 18 + i * 4 + crack * 18;
        ctx.beginPath();
        ctx.moveTo(core.x, core.y);
        ctx.lineTo(core.x + Math.cos(ang) * len, core.y + Math.sin(ang) * len);
        ctx.strokeStyle = rgba(COLORS.signal.glow, 0.08 + crack * 0.18);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    if (variant.victimFx === "sparks" || variant.victimFx === "crackSparks" || variant.victimFx === "static" || variant.victimFx === "overload") {
      var count = Math.max(4, Math.floor(9 * sparkMul));
      for (var j = 0; j < count; j++) {
        var ang2 = state.time * (2.1 + j * 0.02) + j * 0.7;
        var orbit = 22 + Math.sin(state.time * 5 + j * 0.8) * 5;
        var x = core.x + Math.cos(ang2) * orbit;
        var y = core.y + Math.sin(ang2) * orbit;
        var dx = Math.cos(ang2 + 0.4) * (5 + j * 0.4);
        var dy = Math.sin(ang2 + 0.4) * (5 + j * 0.4);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + dx, y + dy);
        ctx.strokeStyle = rgba(COLORS.signal.glow, 0.12 + drainT * 0.16);
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
    }
    if (variant.victimFx === "shell" || variant.victimFx === "overload") {
      drawRing(core, COLORS.signal.fill, COLORS.signal.glow, 0.18 + (1 - impactT) * 0.36, 0.72 + lod.haloMul * 0.12);
    }
  }

  function drawThiefReaction(core, variant, phaseT, lod) {
    var base = 0.28 + Math.sin(state.time * 7) * 0.07 + phaseT * 0.10;
    drawCoreAura(core, COLORS.signal.glow, base);
    if (variant.thiefFx === "ring" || variant.thiefFx === "spin" || variant.thiefFx === "eclipse") {
      var orbitR = 28 + Math.sin(state.time * 2.6) * 2;
      var count = variant.thiefFx === "eclipse" ? 3 : 2;
      for (var i = 0; i < count; i++) {
        var angle = state.time * (variant.thiefFx === "spin" ? 3.0 : 1.6) + i * TAU / count;
        var x = core.x + Math.cos(angle) * orbitR;
        var y = core.y + Math.sin(angle) * orbitR;
        ctx.beginPath();
        ctx.fillStyle = rgba(COLORS.signal.glow, 0.10 + lod.haloMul * 0.06);
        ctx.arc(x, y, 2.5 + (variant.thiefFx === "eclipse" ? 1.4 : 0), 0, TAU);
        ctx.fill();
      }
    }
  }

  function drawStealSignal(route, variant, lod, elapsed, signalDur) {
    var signalT = clamp01(elapsed / signalDur);
    var headDistance = easeOutCubic(signalT) * route.total;
    var tailLen = route.total * (0.10 + getSignalTail() * 0.12);
    var seg = buildRouteSegment(route, Math.max(0, headDistance - tailLen), headDistance, Math.max(8, lod.routeSamples));
    if (variant.signalStyle === "segmented") {
      drawDashedStroke(seg, 5, COLORS.signal.fill, 0.24, 2);
      drawDashedStroke(seg, 2.2, COLORS.signal.edge, 0.78, 2);
    } else if (variant.signalStyle === "forked") {
      drawSmoothStroke(buildRouteSegmentOffset(route, Math.max(0, headDistance - tailLen), headDistance, lod.routeSamples, variant.laneOffset || 8), 3.4, COLORS.signal.fill, 0.20);
      drawSmoothStroke(buildRouteSegmentOffset(route, Math.max(0, headDistance - tailLen), headDistance, lod.routeSamples, -(variant.laneOffset || 8)), 2.1, COLORS.victim.fill, 0.14);
      drawSmoothStroke(seg, 1.2, COLORS.signal.edge, 0.82);
    } else if (variant.signalStyle === "ribbon") {
      drawSmoothStroke(seg, 13 * lod.trailMul, COLORS.signal.glow, 0.08);
      drawSmoothStroke(seg, 6.2, COLORS.signal.fill, 0.18);
      drawSmoothStroke(seg, 2.0, COLORS.signal.edge, 0.76);
    } else if (variant.signalStyle === "harpoon") {
      drawSmoothStroke(seg, 11 * lod.trailMul, COLORS.signal.glow, 0.10);
      drawSmoothStroke(seg, 4.8, COLORS.signal.fill, 0.22);
      drawSmoothStroke(seg, 1.4, COLORS.signal.edge, 0.84);
    } else if (variant.signalStyle === "eclipse") {
      drawSmoothStroke(seg, 16 * lod.trailMul, COLORS.signal.glow, 0.07);
      drawSmoothStroke(seg, 6.6, COLORS.signal.fill, 0.18);
      drawSmoothStroke(seg, 1.5, COLORS.signal.edge, 0.84);
    } else {
      drawSmoothStroke(seg, 11 * lod.trailMul, COLORS.signal.glow, 0.07);
      drawSmoothStroke(seg, 4.0, COLORS.signal.fill, 0.20);
      drawSmoothStroke(seg, 1.4, COLORS.signal.edge, 0.88);
    }
    var head = sampleRoute(route, headDistance);
    drawSignalHead(head, head.angle, variant.signalStyle, variant.signalStyle === "harpoon" ? 9 : 8);
  }

  function drawStealChain(route, variant, lod, drainT) {
    var density = getDensity();
    var count = Math.max(6, Math.floor((variant.chainStyle === "ribbon" ? 11 : 16) * lod.packetMul));
    var spacing = lerp(68, 30, density);
    var travel = drainT * (route.total + spacing * count);
    for (var i = 0; i < count; i++) {
      var along = travel - i * spacing;
      if (along < 0 || along > route.total) continue;
      var headD = route.total - along;
      var offset = 0;
      if (variant.chainStyle === "braid") offset = (i % 2 ? 1 : -1) * (variant.laneOffset || 10);
      if (variant.chainStyle === "halo") offset = Math.sin(i * 0.8 + state.time * 2.4) * 4;
      if (variant.chainStyle === "shard") offset = Math.sin(i * 0.65) * 3;
      var tailD = Math.min(route.total, headD + lerp(34, 52, lod.trailMul));
      var packetSeg = buildRouteSegmentOffset(route, tailD, headD, Math.max(6, lod.routeSamples - 4), offset);

      if (variant.chainStyle === "ribbon") {
        drawSmoothStroke(packetSeg, 10 * lod.trailMul, COLORS.signal.glow, 0.05);
        drawSmoothStroke(packetSeg, 5.4, COLORS.victim.fill, 0.13);
        drawSmoothStroke(packetSeg, 2.2, COLORS.signal.fill, 0.16);
      } else {
        drawSmoothStroke(packetSeg, 7.2 * lod.trailMul, COLORS.signal.glow, 0.05);
        drawSmoothStroke(packetSeg, 3.0, COLORS.victim.fill, 0.13);
        drawSmoothStroke(packetSeg, 1.3, COLORS.signal.fill, 0.18);
      }

      if (variant.chainStyle === "relay") {
        var tickCount = Math.max(2, Math.floor(4 * lod.packetMul));
        for (var t = 0; t < tickCount; t++) {
          var tickD = lerp(tailD, headD, t / Math.max(1, tickCount - 1));
          var tick = sampleRoute(route, tickD);
          var perpX = -Math.sin(tick.angle || 0);
          var perpY = Math.cos(tick.angle || 0);
          ctx.beginPath();
          ctx.moveTo(tick.x - perpX * 4, tick.y - perpY * 4);
          ctx.lineTo(tick.x + perpX * 4, tick.y + perpY * 4);
          ctx.strokeStyle = rgba(COLORS.signal.glow, 0.18);
          ctx.lineWidth = 1.0;
          ctx.stroke();
        }
      }

      var packet = sampleRoute(route, headD);
      var perpX2 = -Math.sin(packet.angle || 0);
      var perpY2 = Math.cos(packet.angle || 0);
      packet.x += perpX2 * offset;
      packet.y += perpY2 * offset;
      drawStealPacket(packet, packet.angle + Math.PI, variant.chainStyle, variant.chainStyle === "ribbon" ? 7.6 : 6.4, 0.62);
    }
  }

  function drawBurstSource(source, variant, lod, progress) {
    var alpha = (0.18 + (1 - progress) * 0.20) * lod.haloMul;
    if (variant.sourceFx === "fan" || variant.sourceFx === "crown") {
      for (var i = 0; i < 3; i++) {
        var angle = -0.7 + i * 0.7 + Math.sin(state.time * 4 + i) * 0.06;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(source.x + Math.cos(angle) * 34, source.y + Math.sin(angle) * 34);
        ctx.strokeStyle = rgba(COLORS.gold.glow, alpha);
        ctx.lineWidth = 2.1;
        ctx.stroke();
      }
    }
    if (variant.sourceFx === "vault" || variant.sourceFx === "mint") {
      ctx.beginPath();
      ctx.arc(source.x, source.y, 14 + (1 - progress) * 10, 0, TAU);
      ctx.strokeStyle = rgba(COLORS.gold.glow, alpha);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.fillStyle = rgba(COLORS.gold.glow, 0.10 + alpha * 0.26);
    ctx.arc(source.x, source.y, 9 + (1 - progress) * 5, 0, TAU);
    ctx.fill();
  }

  function drawBurstArrival(core, variant, progress) {
    if (variant.arrivalFx === "doubleRing") {
      drawRing(core, COLORS.gold.fill, COLORS.gold.glow, progress, 1.0);
      drawRing(core, COLORS.gold.edge, COLORS.gold.glow, clamp01(progress + 0.18), 0.74);
      return;
    }
    if (variant.arrivalFx === "stack") {
      drawRing(core, COLORS.gold.fill, COLORS.gold.glow, progress, 0.92);
      drawCoreAura(core, COLORS.gold.glow, 0.30 * (1 - progress));
      return;
    }
    if (variant.arrivalFx === "flare") {
      drawRing(core, COLORS.gold.fill, COLORS.gold.glow, progress, 1.08);
      ctx.beginPath();
      ctx.fillStyle = rgba(COLORS.gold.glow, 0.18 * (1 - progress));
      ctx.arc(core.x, core.y, 16 + (1 - progress) * 18, 0, TAU);
      ctx.fill();
      return;
    }
    drawRing(core, COLORS.gold.fill, COLORS.gold.glow, progress, 1.0);
  }

  function drawBurstFlow(route, variant, lod, progress) {
    var ramp = easeInCubic(progress);
    var count = Math.max(7, Math.floor((variant.packetStyle === "comet" ? 16 : 20) * lod.packetMul));
    var spacing = lerp(56, 18, 0.18 + ramp * 0.82);
    var travel = progress * (route.total + spacing * count);
    for (var i = 0; i < count; i++) {
      var along = travel - i * spacing;
      if (along < 0 || along > route.total) continue;
      var laneOffset = 0;
      if (variant.packetStyle === "crown") laneOffset = (i % 2 ? 1 : -1) * (variant.laneOffset || 8);
      if (variant.packetStyle === "ingot") laneOffset = Math.sin(i * 0.6) * (variant.laneOffset || 4);
      var head = sampleRoute(route, along);
      var perpX = -Math.sin(head.angle || 0);
      var perpY = Math.cos(head.angle || 0);
      head.x += perpX * laneOffset;
      head.y += perpY * laneOffset;
      var tail = Math.max(0, along - lerp(24, 40, lod.trailMul));
      var seg = buildRouteSegmentOffset(route, tail, along, Math.max(5, lod.routeSamples - 6), laneOffset);
      drawSmoothStroke(seg, 7.2 * lod.trailMul, COLORS.gold.glow, 0.05 + ramp * 0.07);
      drawSmoothStroke(seg, 3.0, COLORS.gold.fill, 0.14 + ramp * 0.10);
      drawSmoothStroke(seg, 1.1, COLORS.gold.edge, 0.18 + ramp * 0.12);
      if (variant.packetStyle === "ladder") {
        var tick = sampleRoute(route, along);
        ctx.beginPath();
        ctx.moveTo(tick.x - perpX * 5, tick.y - perpY * 5);
        ctx.lineTo(tick.x + perpX * 5, tick.y + perpY * 5);
        ctx.strokeStyle = rgba(COLORS.gold.glow, 0.18 + ramp * 0.10);
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }
      drawBurstPacket(head, head.angle, variant.packetStyle, 5.0 + ramp * 1.8, 0.42 + ramp * 0.46);
    }
  }

  function triggerSteal() {
    state.stealFx = { startedAt: state.time };
    state.lastAutoAt = state.time;
  }

  function triggerBurst() {
    state.burstFx = { startedAt: state.time, target: controls.burstTarget.value || "thief" };
    state.lastAutoAt = state.time;
  }

  function ensurePlayback() {
    if (state.time - state.lastAutoAt < 1.0) return;
    if (state.stealFx || state.burstFx) return;
    var mode = controls.mode.value || "both";
    if (mode === "steal") triggerSteal();
    else if (mode === "burst") triggerBurst();
    else {
      triggerSteal();
      triggerBurst();
    }
  }

  function drawEnergySteal(scene, lod) {
    if (!state.stealFx) return;
    var variant = getStealVariant();
    var tempo = getTempo();
    var signalDur = 0.88 / tempo;
    var drainDur = 3.0 / tempo;
    var finishDur = 0.56 / tempo;
    var elapsed = state.time - state.stealFx.startedAt;
    var route = buildStealRoute(scene, variant, lod);
    drawStealPreview(route, variant, lod);

    if (elapsed >= signalDur + drainDur + finishDur) {
      state.stealFx = null;
      return;
    }

    if (elapsed < signalDur) drawStealSignal(route, variant, lod, elapsed, signalDur);
    var impactT = clamp01((elapsed - signalDur) / 0.30);
    var drainT = clamp01((elapsed - signalDur) / drainDur);
    if (elapsed >= signalDur) drawVictimReaction(scene.victim, variant, impactT, drainT, lod);
    if (elapsed >= signalDur && elapsed < signalDur + drainDur) drawStealChain(route, variant, lod, drainT);
    if (elapsed >= signalDur) drawThiefReaction(scene.thief, variant, clamp01((elapsed - signalDur) / (drainDur + finishDur)), lod);
    var finishT = clamp01((elapsed - signalDur - drainDur) / finishDur);
    if (finishT > 0) drawRing(scene.thief, COLORS.signal.fill, COLORS.signal.glow, finishT, variant.thiefFx === "eclipse" ? 1.18 : 1.0);
  }

  function drawResourceBurst(scene, lod) {
    if (!state.burstFx) return;
    var variant = getBurstVariant();
    var tempo = getTempo();
    var burstDur = 3.0 / tempo;
    var finishDur = 0.50 / tempo;
    var elapsed = state.time - state.burstFx.startedAt;
    var targetCore = state.burstFx.target === "victim" ? scene.victim : scene.thief;
    var route = buildBurstRoute(scene, targetCore, variant, lod);
    drawBurstPreview(route, variant, lod);

    if (elapsed >= burstDur + finishDur) {
      state.burstFx = null;
      return;
    }

    var progress = clamp01(elapsed / burstDur);
    drawBurstSource(route.points[0], variant, lod, progress);
    if (elapsed < burstDur) drawBurstFlow(route, variant, lod, progress);
    var finishT = clamp01((elapsed - burstDur) / finishDur);
    if (finishT > 0) drawBurstArrival(targetCore, variant, finishT);
  }

  function drawSceneLabels(scene, lod) {
    var stealVariant = getStealVariant();
    var burstVariant = getBurstVariant();
    var stealRoute = buildStealRoute(scene, stealVariant, lod);
    var targetCore = (controls.burstTarget.value || "thief") === "victim" ? scene.victim : scene.thief;
    var burstRoute = buildBurstRoute(scene, targetCore, burstVariant, lod);
    ctx.fillStyle = "rgba(205,221,255,0.82)";
    ctx.font = "12px Inter, Segoe UI, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Steal arc: " + stealVariant.name + " / " + stealRoute.total.toFixed(0) + " px / LOD " + lod.key.toUpperCase(), scene.field.x, scene.field.y - 20);
    ctx.fillText("Burst flow: " + burstVariant.name + " / nearest corner -> " + ((targetCore === scene.thief) ? "thief" : "victim"), scene.field.x, scene.field.y + scene.field.h + 28);
    var source = burstRoute.points[0];
    ctx.fillStyle = "rgba(255,240,190,0.9)";
    ctx.fillText("source", source.x + 10, source.y - 6);
  }

  function drawFrame() {
    var scene = getScene();
    var lod = getLodSpec();
    drawBackground(scene);
    drawField(scene);
    for (var i = 0; i < scene.ghosts.length; i++) drawCore(scene.ghosts[i], COLORS.ghost, 0.02, "IDLE");
    drawCore(scene.thief, COLORS.thief, 0.06, "THIEF");
    drawCore(scene.victim, COLORS.victim, 0.04, "VICTIM");
    drawEnergySteal(scene, lod);
    drawResourceBurst(scene, lod);
    drawSceneLabels(scene, lod);
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

  function updateTexts() {
    var stealVariant = getStealVariant();
    var burstVariant = getBurstVariant();
    var lodKey = getLodKey();
    var routeLabel = controls.routeSide.value === "counter"
      ? "через левый/нижний обход"
      : (controls.routeSide.value === "clockwise" ? "через верхний/правый обход" : "по автоматическому дуговому обходу");
    texts.title.textContent = "Ability Economy Prototype 01 - " + stealVariant.name + " + " + burstVariant.name;
    texts.subtitle.textContent = "Steal сейчас идет " + routeLabel + " и остается преимущественно дугой, а Burst использует собственный route language из ближайшего угла карты.";
    texts.steal.textContent = stealVariant.note + " " + stealVariant.read;
    texts.burst.textContent = burstVariant.note + " " + burstVariant.read;
    texts.focus.textContent = "LOD " + lodKey.toUpperCase() + ": near держит больше trail/halo/packets, mid режет насыщенность, far оставляет только самые читаемые формы маршрута и головы потока.";
    texts.status.textContent = "Economy lab: Steal = " + stealVariant.name + ", Burst = " + burstVariant.name + ", LOD " + lodKey.toUpperCase() + ".";
  }

  function frame(now) {
    if (!frame._last) frame._last = now;
    var dt = Math.min(0.033, (now - frame._last) / 1000);
    frame._last = now;
    state.time += dt;
    ensurePlayback();
    drawFrame();
    requestAnimationFrame(frame);
  }

  syncSelect(controls.stealVariant, STEAL_VARIANTS);
  syncSelect(controls.burstVariant, BURST_VARIANTS);
  controls.stealVariant.value = String(state.stealIndex);
  controls.burstVariant.value = String(state.burstIndex);

  controls.stealVariant.addEventListener("change", function () {
    state.stealIndex = Math.max(0, Math.min(STEAL_VARIANTS.length - 1, Number(controls.stealVariant.value) || 0));
    updateTexts();
  });
  controls.burstVariant.addEventListener("change", function () {
    state.burstIndex = Math.max(0, Math.min(BURST_VARIANTS.length - 1, Number(controls.burstVariant.value) || 0));
    updateTexts();
  });
  controls.cycleSteal.addEventListener("click", function () {
    state.stealIndex = (state.stealIndex + 1) % STEAL_VARIANTS.length;
    controls.stealVariant.value = String(state.stealIndex);
    updateTexts();
  });
  controls.cycleBurst.addEventListener("click", function () {
    state.burstIndex = (state.burstIndex + 1) % BURST_VARIANTS.length;
    controls.burstVariant.value = String(state.burstIndex);
    updateTexts();
  });
  controls.triggerSteal.addEventListener("click", triggerSteal);
  controls.triggerBurst.addEventListener("click", triggerBurst);
  controls.triggerBoth.addEventListener("click", function () {
    triggerSteal();
    triggerBurst();
  });
  controls.swapRoles.addEventListener("click", function () {
    state.swapped = !state.swapped;
    triggerSteal();
    triggerBurst();
  });

  [
    controls.mode,
    controls.routeSide,
    controls.lodMode,
    controls.burstTarget,
    controls.tempo,
    controls.density,
    controls.signalTail
  ].forEach(function (control) {
    control.addEventListener("input", updateTexts);
    control.addEventListener("change", updateTexts);
  });

  window.addEventListener("resize", resize);
  resize();
  updateTexts();
  triggerSteal();
  triggerBurst();
  requestAnimationFrame(frame);
})();
