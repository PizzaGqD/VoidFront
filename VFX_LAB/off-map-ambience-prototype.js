(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var WORLD_W = 1560;
  var WORLD_H = 980;
  var FIELD = { x: 250, y: 145, w: 1060, h: 690 };

  var canvas = document.getElementById("scene");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var controls = {
    variantSelect: document.getElementById("variantSelect"),
    lodMode: document.getElementById("lodMode"),
    outerShade: document.getElementById("outerShade"),
    planetScale: document.getElementById("planetScale"),
    fxDensity: document.getElementById("fxDensity"),
    drift: document.getElementById("drift"),
    cycleVariant: document.getElementById("cycleVariant"),
    randomizeSky: document.getElementById("randomizeSky"),
    pulseFringe: document.getElementById("pulseFringe")
  };

  var texts = {
    title: document.getElementById("variantTitle"),
    subtitle: document.getElementById("variantSubtitle"),
    status: document.getElementById("statusLine"),
    gameplay: document.getElementById("legendGameplay"),
    visual: document.getElementById("legendVisual"),
    focus: document.getElementById("legendFocus")
  };

  var VARIANTS = [
    {
      key: "ringed-giants",
      name: "01. Ringed Giants",
      subtitle: "Крупные дальние планеты с кольцами, мягкие пылевые полки и тихий масштабный off-map фон вокруг карты.",
      accent: "#8ebeff",
      bgTop: "#040916",
      bgBottom: "#02050c",
      starRgb: "210,226,255",
      glowRgb: "120,162,245",
      shadeRgb: "6,10,18",
      ringRgb: "214,232,255",
      fxRgb: "168,210,255",
      planetPalette: ["74,96,146", "104,142,214", "164,190,232"],
      planetCount: 4,
      ringChance: 0.95,
      dustCount: 28,
      shardCount: 8,
      relayCount: 0,
      curtainCount: 0,
      riftCount: 0,
      rayCount: 0,
      gameplayText: "Снаружи поля появляется чувство большого космоса, но сами планеты остаются только фоновыми силуэтами и не спорят с объектами на карте.",
      visualText: "Это направление лучше всего продает идею дальнего окружения: массивные тела, кольца и глубокий простор вместо пустой черной рамки.",
      focusText: "Хороший baseline, если хочется просто сделать внешнюю зону богаче и дороже без агрессивных sci-fi эффектов."
    },
    {
      key: "halo-relay",
      name: "02. Halo Relay",
      subtitle: "Вне карты работают навигационные орбиты, сигнальные обручи и редкие маяки, будто поле висит внутри военного транспортного коридора.",
      accent: "#7fe4d7",
      bgTop: "#031015",
      bgBottom: "#01070b",
      starRgb: "190,244,235",
      glowRgb: "68,212,185",
      shadeRgb: "5,12,15",
      ringRgb: "200,255,245",
      fxRgb: "122,250,229",
      planetPalette: ["58,110,112", "90,166,170", "142,208,204"],
      planetCount: 3,
      ringChance: 0.62,
      dustCount: 16,
      shardCount: 6,
      relayCount: 18,
      curtainCount: 0,
      riftCount: 0,
      rayCount: 0,
      gameplayText: "Внешняя часть карты начинает работать как часть навигационной оболочки мира, но главный прямоугольник поля остается самым контрастным и чистым.",
      visualText: "Вместо чисто декоративной пустоты снаружи появляется технический sci-fi язык: орбиты, маяки, сенсорные круги и редкие транзитные дуги.",
      focusText: "Сильное направление, если нужно сделать off-map пространство не только красивым, но и чуть более системным, интерфейсным и осмысленным."
    },
    {
      key: "aurora-shelf",
      name: "03. Aurora Shelf",
      subtitle: "За пределами поля висят холодные плазменные занавеси, длинные световые шлейфы и мягкие атмосферные полки на темном космическом фоне.",
      accent: "#9ea9ff",
      bgTop: "#050915",
      bgBottom: "#02040b",
      starRgb: "212,220,255",
      glowRgb: "128,132,255",
      shadeRgb: "7,9,18",
      ringRgb: "222,230,255",
      fxRgb: "176,188,255",
      planetPalette: ["76,82,152", "112,108,214", "148,162,235"],
      planetCount: 2,
      ringChance: 0.36,
      dustCount: 18,
      shardCount: 4,
      relayCount: 0,
      curtainCount: 8,
      riftCount: 0,
      rayCount: 0,
      gameplayText: "Игрок все еще мгновенно считывает границу поля, но снаружи пространство перестает быть мертвым и получает мягкую атмосферную жизнь.",
      visualText: "Здесь главное не планеты, а плазменные занавеси и плавный световой рельеф вокруг карты, будто поле стоит у края космической полярной бури.",
      focusText: "Полезный вариант, если нужен более поэтичный и атмосферный off-map слой, а не жесткая техногенная декорация."
    },
    {
      key: "debris-tide",
      name: "04. Debris Tide",
      subtitle: "Вне карты дрейфуют обломки, пыль, шардовые хвосты и полуразрушенные спутники, создавая ощущение опасного орбитального мусорного пояса.",
      accent: "#ffb782",
      bgTop: "#090814",
      bgBottom: "#03040a",
      starRgb: "255,224,196",
      glowRgb: "255,153,92",
      shadeRgb: "13,9,11",
      ringRgb: "255,229,210",
      fxRgb: "255,188,132",
      planetPalette: ["112,76,82", "164,108,120", "214,160,132"],
      planetCount: 2,
      ringChance: 0.40,
      dustCount: 22,
      shardCount: 42,
      relayCount: 0,
      curtainCount: 0,
      riftCount: 0,
      rayCount: 0,
      gameplayText: "Снаружи поле ощущается физическим окружением с мусором и обломками, а затемнение помогает не пускать этот шум в саму игровую область.",
      visualText: "Визуальный язык строится на орбитальном мусоре, горячих следах и мертвых спутниках, а не на чистых планетарных видах.",
      focusText: "Подходит, если хочется сделать пространство вне карты чуть более суровым, военным и с явным следом старых сражений."
    },
    {
      key: "rift-lattice",
      name: "05. Rift Lattice",
      subtitle: "Вне поля висят темные миры, тонкие разломные нити, глитчевые дуги и редкие линзы пространства по краям карты.",
      accent: "#ef8fff",
      bgTop: "#090516",
      bgBottom: "#03020a",
      starRgb: "246,214,255",
      glowRgb: "220,108,255",
      shadeRgb: "11,7,16",
      ringRgb: "250,220,255",
      fxRgb: "236,158,255",
      planetPalette: ["88,62,120", "136,78,170", "184,114,210"],
      planetCount: 2,
      ringChance: 0.48,
      dustCount: 12,
      shardCount: 8,
      relayCount: 6,
      curtainCount: 0,
      riftCount: 10,
      rayCount: 0,
      gameplayText: "Внешняя область становится странной и опасной по фантазии, но все активные разломы удерживаются за пределами прямоугольника карты.",
      visualText: "Это уже более stylized sci-fi вариант: не просто космос с планетами, а мир с пространственными швами, слабым глитчем и нестабильными кромками.",
      focusText: "Нужен, если off-map фон должен не только украшать сцену, но и добавлять ощущение аномальности и угрозы вокруг боя."
    },
    {
      key: "eclipse-crown",
      name: "06. Eclipse Crown",
      subtitle: "Карту окружает гигантское затмение, коронные лучи и один доминирующий дальний силуэт, который делает внешний фон особенно кинематографичным.",
      accent: "#f6dd9a",
      bgTop: "#080a14",
      bgBottom: "#020409",
      starRgb: "248,236,206",
      glowRgb: "255,214,122",
      shadeRgb: "8,10,15",
      ringRgb: "255,242,208",
      fxRgb: "255,224,152",
      planetPalette: ["44,48,68", "116,126,174", "180,184,216"],
      planetCount: 2,
      ringChance: 1.0,
      dustCount: 14,
      shardCount: 6,
      relayCount: 0,
      curtainCount: 0,
      riftCount: 4,
      rayCount: 18,
      gameplayText: "Вне карты появляется один мощный композиционный акцент, но затемнение и кадр поля не дают этому затмению перетягивать фокус из боевой зоны.",
      visualText: "Это самый кинематографичный вариант: один большой силуэт, корона света и спокойный драматичный космос за пределами поля.",
      focusText: "Подходит как верхняя граница по выразительности, если хочется почувствовать off-map пространство как полноценную часть постановки кадра."
    }
  ];

  var LODS = {
    near: { stars: 250, hazes: 8, fieldShips: 22 },
    mid: { stars: 170, hazes: 6, fieldShips: 16 },
    far: { stars: 110, hazes: 4, fieldShips: 12 }
  };

  var state = {
    seed: 187230,
    time: 0,
    lastNow: 0,
    variantIndex: 0,
    pulseUntil: 0,
    screenW: 0,
    screenH: 0,
    viewScale: 1,
    viewX: 0,
    viewY: 0,
    stars: [],
    hazes: [],
    planets: [],
    dust: [],
    shards: [],
    relays: [],
    curtains: [],
    rifts: []
  };

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function clamp01(v) {
    return clamp(v, 0, 1);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(a, b, v) {
    var t = clamp01((v - a) / Math.max(0.0001, b - a));
    return t * t * (3 - 2 * t);
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

  function getVariant() {
    return VARIANTS[state.variantIndex] || VARIANTS[0];
  }

  function getLod() {
    var mode = controls.lodMode ? controls.lodMode.value : "auto";
    if (mode === "near" || mode === "mid" || mode === "far") return LODS[mode];
    if (state.viewScale > 0.90) return LODS.near;
    if (state.viewScale > 0.62) return LODS.mid;
    return LODS.far;
  }

  function getPulseK() {
    if (state.time >= state.pulseUntil) return 0;
    return clamp01((state.pulseUntil - state.time) / 2.6);
  }

  function getFieldScreenRect() {
    var p = worldToScreen(FIELD.x, FIELD.y);
    return {
      x: p.x,
      y: p.y,
      w: FIELD.w * state.viewScale,
      h: FIELD.h * state.viewScale
    };
  }

  function resizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    state.screenW = Math.max(1, Math.round(rect.width * dpr));
    state.screenH = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = state.screenW;
    canvas.height = state.screenH;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var margin = 34 * dpr;
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

  function drawGlow(x, y, rx, ry, rgb, alpha, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation || 0);
    ctx.scale(1, ry / Math.max(1, rx));
    var grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    grad.addColorStop(0, rgba(rgb, alpha));
    grad.addColorStop(0.55, rgba(rgb, alpha * 0.44));
    grad.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawRing(x, y, radius, color, alpha, width) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function pickOutsideSpot(rng, pad) {
    var side = Math.floor(rng() * 4);
    var pos;
    if (side === 0) {
      pos = {
        x: FIELD.x - pad - 40 - rng() * 170,
        y: FIELD.y - 40 + rng() * (FIELD.h + 80)
      };
    } else if (side === 1) {
      pos = {
        x: FIELD.x + FIELD.w + pad + 40 + rng() * 170,
        y: FIELD.y - 40 + rng() * (FIELD.h + 80)
      };
    } else if (side === 2) {
      pos = {
        x: FIELD.x - 40 + rng() * (FIELD.w + 80),
        y: FIELD.y - pad - 50 - rng() * 140
      };
    } else {
      pos = {
        x: FIELD.x - 40 + rng() * (FIELD.w + 80),
        y: FIELD.y + FIELD.h + pad + 50 + rng() * 140
      };
    }
    pos.x = clamp(pos.x, -180, WORLD_W + 180);
    pos.y = clamp(pos.y, -180, WORLD_H + 180);
    return pos;
  }

  function rebuildScene() {
    var variant = getVariant();
    var lod = getLod();
    var rng = mulberry32((state.seed ^ ((state.variantIndex + 1) * 92821)) >>> 0);
    var planetScale = controlRatio(controls.planetScale, 100);
    var fxDensity = controlRatio(controls.fxDensity, 58);

    state.stars = [];
    state.hazes = [];
    state.planets = [];
    state.dust = [];
    state.shards = [];
    state.relays = [];
    state.curtains = [];
    state.rifts = [];

    for (var i = 0; i < lod.stars; i++) {
      state.stars.push({
        x: rng() * WORLD_W,
        y: rng() * WORLD_H,
        size: 0.7 + rng() * 2.3,
        alpha: 0.12 + rng() * 0.56,
        depth: 0.24 + rng() * 0.76,
        twinkle: rng() * TAU,
        drift: 0.4 + rng() * 1.4
      });
    }

    for (var h = 0; h < lod.hazes; h++) {
      var hazePos = pickOutsideSpot(rng, 90);
      state.hazes.push({
        x: hazePos.x,
        y: hazePos.y,
        rx: 120 + rng() * 240,
        ry: 80 + rng() * 180,
        alpha: 0.025 + rng() * 0.045,
        rotation: rng() * TAU,
        rgb: h % 2 === 0 ? variant.glowRgb : variant.ringRgb
      });
    }

    if (variant.key === "eclipse-crown") {
      state.planets.push({
        x: FIELD.x + FIELD.w + 210,
        y: FIELD.y + 125,
        radius: 250 * planetScale,
        color: variant.planetPalette[0],
        ringed: true,
        ringRot: -0.34,
        ringTilt: 0.26,
        ringWidth: 0.18,
        depth: 0.92,
        eclipse: true,
        banding: 2
      });
      state.planets.push({
        x: FIELD.x - 150,
        y: FIELD.y + FIELD.h + 135,
        radius: 92 * planetScale,
        color: variant.planetPalette[1],
        ringed: true,
        ringRot: 0.58,
        ringTilt: 0.20,
        ringWidth: 0.10,
        depth: 0.52,
        eclipse: false,
        banding: 3
      });
    } else {
      for (var p = 0; p < variant.planetCount; p++) {
        var radius = (72 + rng() * 140) * planetScale * (p === 0 ? 1.16 : 0.88 + rng() * 0.36);
        var pos = pickOutsideSpot(rng, radius * 0.45);
        state.planets.push({
          x: pos.x,
          y: pos.y,
          radius: radius,
          color: variant.planetPalette[p % variant.planetPalette.length],
          ringed: rng() < variant.ringChance,
          ringRot: (rng() - 0.5) * 1.2,
          ringTilt: 0.16 + rng() * 0.16,
          ringWidth: 0.08 + rng() * 0.10,
          depth: 0.34 + rng() * 0.58,
          eclipse: false,
          banding: 2 + Math.floor(rng() * 3)
        });
      }
    }

    var dustCount = Math.round(variant.dustCount * (0.45 + fxDensity * 0.95));
    for (var d = 0; d < dustCount; d++) {
      var dustPos = pickOutsideSpot(rng, 20 + rng() * 30);
      state.dust.push({
        x: dustPos.x,
        y: dustPos.y,
        len: 18 + rng() * 40,
        angle: (rng() - 0.5) * 1.4 + (dustPos.y < FIELD.y ? 0.16 : -0.16),
        width: 0.7 + rng() * 1.6,
        alpha: 0.05 + rng() * 0.12,
        speed: 0.10 + rng() * 0.42,
        phase: rng() * TAU,
        depth: 0.3 + rng() * 0.7
      });
    }

    var shardCount = Math.round(variant.shardCount * (0.40 + fxDensity));
    for (var s = 0; s < shardCount; s++) {
      var shardPos = pickOutsideSpot(rng, 16 + rng() * 20);
      state.shards.push({
        x: shardPos.x,
        y: shardPos.y,
        len: 12 + rng() * 26,
        angle: rng() * TAU,
        width: 0.8 + rng() * 2.1,
        alpha: 0.06 + rng() * 0.14,
        speed: 0.08 + rng() * 0.30,
        phase: rng() * TAU
      });
    }

    var relayCount = Math.round(variant.relayCount * (0.36 + fxDensity));
    for (var r = 0; r < relayCount; r++) {
      var relayPos = pickOutsideSpot(rng, 26 + rng() * 20);
      state.relays.push({
        x: relayPos.x,
        y: relayPos.y,
        radius: 12 + rng() * 30,
        orbit: 14 + rng() * 24,
        alpha: 0.10 + rng() * 0.18,
        phase: rng() * TAU
      });
    }

    var curtainCount = Math.round(variant.curtainCount * (0.42 + fxDensity));
    for (var c = 0; c < curtainCount; c++) {
      var curtainPos = pickOutsideSpot(rng, 30);
      state.curtains.push({
        x: curtainPos.x,
        y: curtainPos.y,
        width: 80 + rng() * 130,
        height: 180 + rng() * 260,
        alpha: 0.04 + rng() * 0.10,
        phase: rng() * TAU,
        sway: 0.12 + rng() * 0.30
      });
    }

    var riftCount = Math.round(variant.riftCount * (0.36 + fxDensity));
    for (var rf = 0; rf < riftCount; rf++) {
      var riftPos = pickOutsideSpot(rng, 36);
      state.rifts.push({
        x: riftPos.x,
        y: riftPos.y,
        size: 36 + rng() * 84,
        angle: rng() * TAU,
        alpha: 0.08 + rng() * 0.16,
        branches: 3 + Math.floor(rng() * 4),
        phase: rng() * TAU
      });
    }
  }

  function clipOutsideField() {
    var field = getFieldScreenRect();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, state.screenW, state.screenH);
    ctx.rect(field.x, field.y, field.w, field.h);
    ctx.clip("evenodd");
  }

  function clipField() {
    var field = getFieldScreenRect();
    ctx.save();
    ctx.beginPath();
    ctx.rect(field.x, field.y, field.w, field.h);
    ctx.clip();
  }

  function drawBackdrop() {
    var variant = getVariant();
    var drift = controlRatio(controls.drift, 52);

    var bg = ctx.createLinearGradient(0, 0, 0, state.screenH);
    bg.addColorStop(0, variant.bgTop);
    bg.addColorStop(1, variant.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, state.screenW, state.screenH);

    drawGlow(state.screenW * 0.22, state.screenH * 0.12, state.screenW * 0.22, state.screenH * 0.16, variant.glowRgb, 0.06, 0.2);
    drawGlow(state.screenW * 0.80, state.screenH * 0.18, state.screenW * 0.18, state.screenH * 0.12, variant.ringRgb, 0.04, -0.4);

    for (var h = 0; h < state.hazes.length; h++) {
      var haze = state.hazes[h];
      var hs = worldToScreen(haze.x, haze.y);
      drawGlow(
        hs.x,
        hs.y,
        haze.rx * state.viewScale,
        haze.ry * state.viewScale,
        haze.rgb,
        haze.alpha,
        haze.rotation
      );
    }

    for (var i = 0; i < state.stars.length; i++) {
      var star = state.stars[i];
      var offset = Math.sin(state.time * (0.10 + star.depth * 0.12) * (0.3 + drift) + star.twinkle) * star.depth * 6;
      var sx = worldToScreen(star.x + offset, star.y + Math.cos(star.twinkle + state.time * 0.06 * star.drift) * star.depth * 4);
      var pulse = 0.65 + 0.35 * Math.sin(state.time * (0.5 + star.drift) + star.twinkle);
      var size = Math.max(1, star.size * state.viewScale);
      ctx.fillStyle = rgba(variant.starRgb, star.alpha * pulse);
      if (size <= 1.2) {
        ctx.fillRect(sx.x, sx.y, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(sx.x, sx.y, size * 0.52, 0, TAU);
        ctx.fill();
        if (size > 2.0) {
          ctx.fillStyle = rgba(variant.starRgb, star.alpha * pulse * 0.10);
          ctx.beginPath();
          ctx.arc(sx.x, sx.y, size * 2.4, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  function drawPlanet(planet, variant, pulseK) {
    var center = worldToScreen(planet.x, planet.y);
    var r = planet.radius * state.viewScale;

    if (planet.eclipse && variant.rayCount > 0) {
      for (var i = 0; i < variant.rayCount; i++) {
        var rayAng = (i / variant.rayCount) * TAU + state.time * 0.02 + i * 0.06;
        var rayInner = r * 0.90;
        var rayOuter = r * (1.40 + (i % 3) * 0.10);
        ctx.strokeStyle = rgba(variant.fxRgb, 0.05 + pulseK * 0.04);
        ctx.lineWidth = r * 0.04;
        ctx.beginPath();
        ctx.moveTo(center.x + Math.cos(rayAng) * rayInner, center.y + Math.sin(rayAng) * rayInner);
        ctx.lineTo(center.x + Math.cos(rayAng) * rayOuter, center.y + Math.sin(rayAng) * rayOuter);
        ctx.stroke();
      }
      drawGlow(center.x, center.y, r * 1.54, r * 1.54, variant.fxRgb, 0.08 + pulseK * 0.04, 0);
    }

    if (planet.ringed) {
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(planet.ringRot);
      ctx.strokeStyle = rgba(variant.ringRgb, 0.12 + planet.depth * 0.06);
      ctx.lineWidth = Math.max(1, r * planet.ringWidth);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.52, r * planet.ringTilt, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = rgba(variant.fxRgb, 0.06 + planet.depth * 0.04);
      ctx.lineWidth = Math.max(1, r * planet.ringWidth * 2.2);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.38, r * planet.ringTilt * 0.88, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    var haloRgb = planet.eclipse ? variant.ringRgb : variant.fxRgb;
    drawGlow(center.x, center.y, r * 1.24, r * 1.24, haloRgb, 0.05 + planet.depth * 0.05, 0);

    var grad = ctx.createRadialGradient(center.x - r * 0.28, center.y - r * 0.34, r * 0.12, center.x, center.y, r);
    if (planet.eclipse) {
      grad.addColorStop(0, rgba("212,212,232", 0.10));
      grad.addColorStop(0.22, rgba("88,92,120", 0.16));
      grad.addColorStop(0.55, rgba(planet.color, 0.84));
      grad.addColorStop(1, rgba("10,10,18", 0.98));
    } else {
      grad.addColorStop(0, rgba(variant.ringRgb, 0.28));
      grad.addColorStop(0.18, rgba(planet.color, 0.92));
      grad.addColorStop(0.68, rgba(planet.color, 0.86));
      grad.addColorStop(1, rgba(variant.shadeRgb, 0.82));
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, TAU);
    ctx.clip();
    for (var b = 0; b < planet.banding; b++) {
      var yy = center.y - r * 0.54 + (b + 0.7) * (r * 1.02 / Math.max(1, planet.banding));
      ctx.strokeStyle = rgba(variant.ringRgb, 0.08 + b * 0.02);
      ctx.lineWidth = r * 0.10;
      ctx.beginPath();
      ctx.ellipse(center.x - r * 0.06, yy, r * 1.08, r * 0.22, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, TAU);
    ctx.strokeStyle = rgba(variant.ringRgb, planet.eclipse ? 0.16 : 0.22);
    ctx.lineWidth = Math.max(1, r * 0.018);
    ctx.stroke();

    if (planet.ringed) {
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(planet.ringRot);
      ctx.strokeStyle = rgba(variant.ringRgb, 0.26 + pulseK * 0.06);
      ctx.lineWidth = Math.max(1, r * planet.ringWidth * 0.9);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.52, r * planet.ringTilt, 0, 0.04 * Math.PI, 0.96 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawDust() {
    var variant = getVariant();
    var drift = controlRatio(controls.drift, 52);
    for (var i = 0; i < state.dust.length; i++) {
      var p = state.dust[i];
      var sway = Math.sin(state.time * (0.4 + p.speed * (0.7 + drift)) + p.phase) * 18 * p.depth;
      var x = p.x + Math.cos(p.angle + Math.PI * 0.5) * sway;
      var y = p.y + Math.sin(p.angle + Math.PI * 0.5) * sway * 0.6;
      var s = worldToScreen(x, y);
      var len = p.len * state.viewScale;
      var ang = p.angle + Math.sin(state.time * p.speed + p.phase) * 0.08;
      ctx.strokeStyle = rgba(variant.fxRgb, p.alpha);
      ctx.lineWidth = p.width * state.viewScale;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(ang) * len * 0.5, s.y - Math.sin(ang) * len * 0.5);
      ctx.lineTo(s.x + Math.cos(ang) * len * 0.5, s.y + Math.sin(ang) * len * 0.5);
      ctx.stroke();
    }
  }

  function drawShards() {
    var variant = getVariant();
    for (var i = 0; i < state.shards.length; i++) {
      var shard = state.shards[i];
      var t = state.time * shard.speed + shard.phase;
      var x = shard.x + Math.cos(t) * 10;
      var y = shard.y + Math.sin(t * 0.8) * 8;
      var s = worldToScreen(x, y);
      var len = shard.len * state.viewScale;
      var ang = shard.angle + Math.sin(t) * 0.18;
      ctx.strokeStyle = rgba(variant.ringRgb, shard.alpha);
      ctx.lineWidth = shard.width * state.viewScale;
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(ang) * len * 0.3, s.y - Math.sin(ang) * len * 0.3);
      ctx.lineTo(s.x + Math.cos(ang) * len, s.y + Math.sin(ang) * len);
      ctx.stroke();
    }
  }

  function drawRelays(pulseK) {
    var variant = getVariant();
    for (var i = 0; i < state.relays.length; i++) {
      var relay = state.relays[i];
      var s = worldToScreen(relay.x, relay.y);
      var orbit = relay.orbit * state.viewScale;
      var pulse = 0.5 + 0.5 * Math.sin(state.time * 1.5 + relay.phase);
      ctx.save();
      ctx.setLineDash([6, 7]);
      ctx.lineDashOffset = -state.time * 12;
      ctx.strokeStyle = rgba(variant.fxRgb, relay.alpha * 0.7);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, orbit, 0, TAU);
      ctx.stroke();
      ctx.restore();
      drawRing(s.x, s.y, relay.radius * state.viewScale, variant.ringRgb, relay.alpha + pulseK * 0.05, 1.3);
      drawGlow(s.x, s.y, orbit * 0.8, orbit * 0.8, variant.fxRgb, 0.03 + pulse * 0.03 + pulseK * 0.02, 0);
      ctx.fillStyle = rgba(variant.ringRgb, 0.42 + pulse * 0.16);
      ctx.beginPath();
      ctx.arc(
        s.x + Math.cos(state.time * 0.8 + relay.phase) * orbit,
        s.y + Math.sin(state.time * 0.8 + relay.phase) * orbit,
        Math.max(1, state.viewScale * 2.0),
        0,
        TAU
      );
      ctx.fill();
    }
  }

  function drawCurtains() {
    var variant = getVariant();
    var drift = controlRatio(controls.drift, 52);
    for (var i = 0; i < state.curtains.length; i++) {
      var curtain = state.curtains[i];
      var s = worldToScreen(curtain.x, curtain.y);
      var swing = Math.sin(state.time * curtain.sway * (0.5 + drift) + curtain.phase) * 24 * state.viewScale;
      var rx = curtain.width * state.viewScale;
      var ry = curtain.height * state.viewScale;
      drawGlow(s.x + swing, s.y, rx, ry, variant.fxRgb, curtain.alpha, 0.02 + Math.sin(curtain.phase) * 0.06);
      drawGlow(s.x - swing * 0.4, s.y, rx * 0.65, ry * 0.82, variant.ringRgb, curtain.alpha * 0.58, -0.08);
    }
  }

  function drawRifts(pulseK) {
    var variant = getVariant();
    for (var i = 0; i < state.rifts.length; i++) {
      var rift = state.rifts[i];
      var s = worldToScreen(rift.x, rift.y);
      var size = rift.size * state.viewScale;
      var pulse = 0.5 + 0.5 * Math.sin(state.time * 1.6 + rift.phase);
      drawGlow(s.x, s.y, size * 0.84, size * 0.36, variant.fxRgb, 0.04 + pulse * 0.04, rift.angle);
      ctx.strokeStyle = rgba(variant.ringRgb, rift.alpha + pulseK * 0.05);
      ctx.lineWidth = 1.4;
      for (var b = 0; b < rift.branches; b++) {
        var dir = rift.angle + (b - (rift.branches - 1) * 0.5) * 0.28 + Math.sin(state.time * 0.8 + b + rift.phase) * 0.08;
        var len = size * (0.34 + b * 0.12);
        var mx = s.x + Math.cos(dir) * len * 0.5 + Math.sin(state.time * 1.2 + b) * 10;
        var my = s.y + Math.sin(dir) * len * 0.5 - Math.cos(state.time * 1.1 + b) * 8;
        var ex = s.x + Math.cos(dir) * len;
        var ey = s.y + Math.sin(dir) * len;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(mx, my);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    }
  }

  function drawOffMapBackground() {
    var pulseK = getPulseK();
    var variant = getVariant();

    clipOutsideField();

    for (var p = 0; p < state.planets.length; p++) drawPlanet(state.planets[p], variant, pulseK);
    drawDust();
    drawCurtains();
    drawShards();
    drawRelays(pulseK);
    drawRifts(pulseK);

    ctx.restore();
  }

  function drawFieldInterior() {
    var field = getFieldScreenRect();
    var variant = getVariant();
    var lod = getLod();
    var pulseK = getPulseK();
    var drift = controlRatio(controls.drift, 52);
    var routeA = [
      { x: FIELD.x + 110, y: FIELD.y + FIELD.h * 0.38 },
      { x: FIELD.x + FIELD.w * 0.32, y: FIELD.y + FIELD.h * 0.34 },
      { x: FIELD.x + FIELD.w * 0.62, y: FIELD.y + FIELD.h * 0.58 },
      { x: FIELD.x + FIELD.w - 130, y: FIELD.y + FIELD.h * 0.54 }
    ];
    var routeB = [
      { x: FIELD.x + 130, y: FIELD.y + FIELD.h * 0.68 },
      { x: FIELD.x + FIELD.w * 0.34, y: FIELD.y + FIELD.h * 0.58 },
      { x: FIELD.x + FIELD.w * 0.52, y: FIELD.y + FIELD.h * 0.30 },
      { x: FIELD.x + FIELD.w - 160, y: FIELD.y + FIELD.h * 0.32 }
    ];
    var zones = [
      { x: FIELD.x + 270, y: FIELD.y + 240, r: 92, color: variant.fxRgb },
      { x: FIELD.x + 590, y: FIELD.y + 398, r: 116, color: variant.ringRgb },
      { x: FIELD.x + 860, y: FIELD.y + 238, r: 84, color: variant.fxRgb }
    ];

    var innerGrad = ctx.createLinearGradient(field.x, field.y, field.x, field.y + field.h);
    innerGrad.addColorStop(0, rgba("10,16,30", 0.82));
    innerGrad.addColorStop(1, rgba("5,8,16", 0.94));
    ctx.fillStyle = innerGrad;
    ctx.fillRect(field.x, field.y, field.w, field.h);

    clipField();

    drawGlow(field.x + field.w * 0.18, field.y + field.h * 0.20, field.w * 0.20, field.h * 0.12, variant.glowRgb, 0.06, 0.2);
    drawGlow(field.x + field.w * 0.78, field.y + field.h * 0.22, field.w * 0.14, field.h * 0.18, variant.ringRgb, 0.03, -0.2);

    for (var gx = FIELD.x; gx <= FIELD.x + FIELD.w; gx += 80) {
      var ga = worldToScreen(gx, FIELD.y);
      var gb = worldToScreen(gx, FIELD.y + FIELD.h);
      ctx.strokeStyle = "rgba(88,120,180,0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ga.x, ga.y);
      ctx.lineTo(gb.x, gb.y);
      ctx.stroke();
    }
    for (var gy = FIELD.y; gy <= FIELD.y + FIELD.h; gy += 80) {
      var gc = worldToScreen(FIELD.x, gy);
      var gd = worldToScreen(FIELD.x + FIELD.w, gy);
      ctx.strokeStyle = "rgba(88,120,180,0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gc.x, gc.y);
      ctx.lineTo(gd.x, gd.y);
      ctx.stroke();
    }

    ctx.strokeStyle = rgba(variant.fxRgb, 0.16);
    ctx.lineWidth = 2;
    for (var r = 0; r < 2; r++) {
      var route = r === 0 ? routeA : routeB;
      ctx.beginPath();
      for (var j = 0; j < route.length; j++) {
        var point = worldToScreen(route[j].x, route[j].y);
        if (j === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    }

    for (var z = 0; z < zones.length; z++) {
      var zone = zones[z];
      var zs = worldToScreen(zone.x, zone.y);
      var radius = zone.r * state.viewScale;
      var pulse = 0.5 + 0.5 * Math.sin(state.time * (1.1 + z * 0.18));
      drawGlow(zs.x, zs.y, radius * 1.18, radius * 1.18, zone.color, 0.08 + pulse * 0.04, 0);
      drawRing(zs.x, zs.y, radius, zone.color, 0.22 + pulse * 0.10, 2.0);
      drawRing(zs.x, zs.y, radius * 0.72, variant.ringRgb, 0.14 + pulse * 0.06, 1.0);
      drawRing(zs.x, zs.y, radius * 0.24, variant.ringRgb, 0.28, 1.6);
    }

    function drawBase(x, y, rgb) {
      var bs = worldToScreen(x, y);
      var size = 18 * state.viewScale;
      drawGlow(bs.x, bs.y, 46 * state.viewScale, 46 * state.viewScale, rgb, 0.10 + pulseK * 0.03, 0);
      ctx.fillStyle = rgba(rgb, 0.76);
      ctx.fillRect(bs.x - size, bs.y - size, size * 2, size * 2);
      ctx.strokeStyle = rgba(variant.ringRgb, 0.60);
      ctx.lineWidth = 1.6;
      ctx.strokeRect(bs.x - size, bs.y - size, size * 2, size * 2);
    }

    drawBase(FIELD.x + 70, FIELD.y + FIELD.h * 0.50, "96,160,255");
    drawBase(FIELD.x + FIELD.w - 70, FIELD.y + FIELD.h * 0.46, "255,132,162");

    function drawMovingFleet(route, count, speed, color, sizeBase) {
      for (var i = 0; i < count; i++) {
        var rawT = ((state.time * speed * (0.5 + drift)) + i / count) % 1;
        var t = rawT < 0 ? rawT + 1 : rawT;
        var point = getPointOnPolyline(route, t);
        var ahead = getPointOnPolyline(route, Math.min(1, t + 0.02));
        var angle = Math.atan2(ahead.y - point.y, ahead.x - point.x);
        var s = worldToScreen(point.x, point.y);
        var size = (sizeBase + (i % 3) * 1.2) * state.viewScale;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(angle);
        ctx.fillStyle = rgba(color, 0.88);
        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.7, -size * 0.48);
        ctx.lineTo(-size * 0.5, 0);
        ctx.lineTo(-size * 0.7, size * 0.48);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba(variant.ringRgb, 0.34);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    }

    drawMovingFleet(routeA, Math.max(6, Math.floor(lod.fieldShips * 0.5)), 0.16, "116,190,255", 4.0);
    drawMovingFleet(routeB, Math.max(5, Math.floor(lod.fieldShips * 0.4)), 0.12, "255,144,172", 4.3);

    drawGlow(field.x + field.w * 0.78, field.y + field.h * 0.72, field.w * 0.08, field.h * 0.05, variant.glowRgb, 0.05, -0.2);

    ctx.restore();
  }

  function getPointOnPolyline(points, t) {
    if (!points || points.length === 0) return { x: 0, y: 0 };
    if (points.length === 1) return { x: points[0].x, y: points[0].y };
    var lengths = [];
    var total = 0;
    for (var i = 0; i < points.length - 1; i++) {
      var ax = points[i].x;
      var ay = points[i].y;
      var bx = points[i + 1].x;
      var by = points[i + 1].y;
      var len = Math.hypot(bx - ax, by - ay);
      lengths.push(len);
      total += len;
    }
    var target = clamp01(t) * total;
    var acc = 0;
    for (var j = 0; j < lengths.length; j++) {
      if (acc + lengths[j] >= target) {
        var local = (target - acc) / Math.max(0.0001, lengths[j]);
        return {
          x: lerp(points[j].x, points[j + 1].x, local),
          y: lerp(points[j].y, points[j + 1].y, local)
        };
      }
      acc += lengths[j];
    }
    return points[points.length - 1];
  }

  function drawOutsideShade() {
    var variant = getVariant();
    var field = getFieldScreenRect();
    var shade = controlRatio(controls.outerShade, 60);

    ctx.fillStyle = rgba(variant.shadeRgb, shade);
    ctx.fillRect(0, 0, state.screenW, field.y);
    ctx.fillRect(0, field.y, field.x, field.h);
    ctx.fillRect(field.x + field.w, field.y, state.screenW - (field.x + field.w), field.h);
    ctx.fillRect(0, field.y + field.h, state.screenW, state.screenH - (field.y + field.h));

    ctx.strokeStyle = rgba(variant.ringRgb, 0.16);
    ctx.lineWidth = 2;
    ctx.strokeRect(field.x, field.y, field.w, field.h);
  }

  function drawFieldChrome() {
    var variant = getVariant();
    var field = getFieldScreenRect();
    var pulseK = getPulseK();
    var glowAlpha = 0.18 + pulseK * 0.16;

    drawGlow(field.x + field.w * 0.5, field.y, field.w * 0.28, 20, variant.fxRgb, 0.06 + pulseK * 0.03, 0);
    drawGlow(field.x + field.w * 0.5, field.y + field.h, field.w * 0.28, 20, variant.fxRgb, 0.04 + pulseK * 0.02, 0);

    ctx.strokeStyle = rgba(variant.ringRgb, 0.26 + pulseK * 0.10);
    ctx.lineWidth = 2;
    ctx.strokeRect(field.x, field.y, field.w, field.h);

    var corner = 26;
    ctx.strokeStyle = rgba(variant.fxRgb, glowAlpha);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(field.x, field.y + corner);
    ctx.lineTo(field.x, field.y);
    ctx.lineTo(field.x + corner, field.y);
    ctx.moveTo(field.x + field.w - corner, field.y);
    ctx.lineTo(field.x + field.w, field.y);
    ctx.lineTo(field.x + field.w, field.y + corner);
    ctx.moveTo(field.x, field.y + field.h - corner);
    ctx.lineTo(field.x, field.y + field.h);
    ctx.lineTo(field.x + corner, field.y + field.h);
    ctx.moveTo(field.x + field.w - corner, field.y + field.h);
    ctx.lineTo(field.x + field.w, field.y + field.h);
    ctx.lineTo(field.x + field.w, field.y + field.h - corner);
    ctx.stroke();

    ctx.fillStyle = "#edf5ff";
    ctx.font = Math.max(12, 12 * state.viewScale) + "px Inter, Segoe UI, Arial";
    ctx.fillText("PLAYABLE AREA", field.x + 12, field.y - 12);
    ctx.fillStyle = "rgba(220,228,246,0.68)";
    ctx.fillText("OFF-MAP", field.x - 74, field.y - 12);
    ctx.fillText("OFF-MAP", field.x + field.w + 12, field.y - 12);
  }

  function drawOutsideHighlights() {
    var variant = getVariant();
    var pulseK = getPulseK();
    clipOutsideField();

    if (variant.key === "halo-relay") {
      drawRelays(pulseK * 0.7 + 0.25);
    } else if (variant.key === "aurora-shelf") {
      drawCurtains();
    } else if (variant.key === "rift-lattice" || variant.key === "eclipse-crown") {
      drawRifts(pulseK * 0.7 + 0.22);
    }

    ctx.restore();
  }

  function updateTexts() {
    var variant = getVariant();
    var outerShade = Math.round(controlRatio(controls.outerShade, 60) * 100);
    var planetScale = Math.round(controlRatio(controls.planetScale, 100) * 100);
    var fxDensity = Math.round(controlRatio(controls.fxDensity, 58) * 100);
    document.documentElement.style.setProperty("--accent", variant.accent);
    if (texts.title) texts.title.textContent = "Off-Map Ambience Prototype 01 - " + variant.name;
    if (texts.subtitle) texts.subtitle.textContent = variant.subtitle;
    if (texts.status) {
      texts.status.textContent =
        "Outer shade: " + outerShade + "% | Planets: " + state.planets.length +
        " | FX density: " + fxDensity + "% | Planet scale: " + planetScale +
        "% | Seed: " + state.seed;
    }
    if (texts.gameplay) texts.gameplay.textContent = variant.gameplayText;
    if (texts.visual) texts.visual.textContent = variant.visualText;
    if (texts.focus) texts.focus.textContent = variant.focusText;
  }

  function render() {
    drawBackdrop();
    drawOffMapBackground();
    drawFieldInterior();
    drawOutsideShade();
    drawFieldChrome();
    drawOutsideHighlights();
    updateTexts();
  }

  function tick(now) {
    if (!state.lastNow) state.lastNow = now;
    var dt = Math.min(0.05, (now - state.lastNow) / 1000);
    state.lastNow = now;
    state.time += dt;
    render();
    requestAnimationFrame(tick);
  }

  function syncVariantSelect() {
    controls.variantSelect.innerHTML = "";
    for (var i = 0; i < VARIANTS.length; i++) {
      var option = document.createElement("option");
      option.value = String(i);
      option.textContent = VARIANTS[i].name;
      controls.variantSelect.appendChild(option);
    }
    controls.variantSelect.value = String(state.variantIndex);
  }

  function bind() {
    syncVariantSelect();

    controls.variantSelect.addEventListener("change", function () {
      state.variantIndex = Math.max(0, Math.min(VARIANTS.length - 1, Number(controls.variantSelect.value) || 0));
      rebuildScene();
      updateTexts();
    });

    controls.lodMode.addEventListener("change", function () {
      rebuildScene();
      updateTexts();
    });

    controls.outerShade.addEventListener("input", updateTexts);
    controls.drift.addEventListener("input", updateTexts);

    controls.planetScale.addEventListener("input", function () {
      rebuildScene();
      updateTexts();
    });

    controls.fxDensity.addEventListener("input", function () {
      rebuildScene();
      updateTexts();
    });

    controls.cycleVariant.addEventListener("click", function () {
      state.variantIndex = (state.variantIndex + 1) % VARIANTS.length;
      controls.variantSelect.value = String(state.variantIndex);
      rebuildScene();
      updateTexts();
    });

    controls.randomizeSky.addEventListener("click", function () {
      state.seed = Math.floor(Math.random() * 0xffffffff);
      rebuildScene();
      updateTexts();
    });

    controls.pulseFringe.addEventListener("click", function () {
      state.pulseUntil = state.time + 2.6;
    });

    window.addEventListener("resize", function () {
      resizeCanvas();
      rebuildScene();
      updateTexts();
    });
  }

  resizeCanvas();
  bind();
  rebuildScene();
  updateTexts();
  requestAnimationFrame(tick);
})();
