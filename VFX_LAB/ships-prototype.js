(function () {
  "use strict";

  var TAU = Math.PI * 2;

  var canvas = document.getElementById("scene");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var controls = {
    palette: document.getElementById("palette"),
    lodMode: document.getElementById("lodMode"),
    distance: document.getElementById("distance"),
    stress: document.getElementById("stress"),
    focusFamily: document.getElementById("focusFamily"),
    focusVariant: document.getElementById("focusVariant"),
    cycleMotion: document.getElementById("cycleMotion"),
    shufflePalette: document.getElementById("shufflePalette"),
    focusAll: document.getElementById("focusAll")
  };

  var texts = {
    title: document.getElementById("shipTitle"),
    status: document.getElementById("statusLine"),
    types: document.getElementById("legendTypes"),
    silhouette: document.getElementById("legendSilhouette"),
    motion: document.getElementById("legendMotion")
  };

  var PALETTES = {
    blue:   { core: "#67a5ff", edge: "#d7e8ff", bright: "#f6fbff", shell: "#091426", hull: "#153057", trim: "#6dabff", glow: "103,165,255", line: "154,202,255" },
    red:    { core: "#ff7f92", edge: "#ffe0e7", bright: "#fff7f9", shell: "#231018", hull: "#5f2031", trim: "#ff98ab", glow: "255,127,146", line: "255,186,198" },
    green:  { core: "#63d39a", edge: "#dcffec", bright: "#f6fff9", shell: "#0a1b17", hull: "#1a4d3d", trim: "#7ce3ad", glow: "99,211,154", line: "154,238,194" },
    purple: { core: "#bb8fff", edge: "#efdeff", bright: "#fcf8ff", shell: "#171124", hull: "#41296c", trim: "#d1b1ff", glow: "187,143,255", line: "223,194,255" },
    amber:  { core: "#ffbb5e", edge: "#ffe6c3", bright: "#fffaf1", shell: "#24180a", hull: "#6a4018", trim: "#ffd38c", glow: "255,187,94", line: "255,220,163" }
  };

  var LOD = {
    near: { micro: true, cuts: true, glow: true, labels: true },
    mid:  { micro: false, cuts: true, glow: true, labels: true },
    far:  { micro: false, cuts: false, glow: false, labels: true }
  };

  var MOTIONS = ["idle", "bank", "sweep"];

  var FAMILIES = [
    { key: "interceptor", name: "Interceptor", note: "Легкий агрессивный перехватчик: острый нос, сухой силуэт, быстрый перед." },
    { key: "escort", name: "Escort", note: "Средний эскорт: стабильный центр массы, охранный силуэт, контролируемая ширина." },
    { key: "breaker", name: "Breaker", note: "Тяжелый штурмовик: широкие плечи, броня, давящий передний объем." },
    { key: "lancer", name: "Lancer", note: "Дальнобойный ланцер: вытянутый нос и узкий ударный профиль." },
    { key: "capital", name: "Capital", note: "Крупный капитал: массивный тоннаж, цитадельное тело, тяжелая корма." }
  ];

  var SHIPS = [
    {
      key: "split-fang",
      family: "interceptor",
      variant: "A",
      name: "Split Fang",
      role: "Interceptor A",
      note: "Forked assault nose with recessed center trench.",
      outer: [[2.82, -0.12], [2.06, -0.28], [1.30, -0.58], [0.46, -0.96], [-0.36, -0.72], [-1.02, -0.30], [-1.26, -0.10], [-1.38, 0], [-1.26, 0.10], [-1.02, 0.30], [-0.36, 0.72], [0.46, 0.96], [1.30, 0.58], [2.06, 0.28], [2.82, 0.12], [2.00, 0], [2.82, -0.12]],
      cutouts: [[[2.16, -0.10], [1.56, -0.06], [1.34, 0], [1.56, 0.06], [2.16, 0.10], [1.86, 0]]],
      lines: [[[1.74, 0], [-0.54, 0]], [[0.78, -0.32], [0.06, -0.72]], [[0.78, 0.32], [0.06, 0.72]]],
      vents: [[-0.98, -0.16], [-0.98, 0.16]]
    },
    {
      key: "basilisk",
      family: "interceptor",
      variant: "B",
      name: "Basilisk",
      role: "Interceptor B",
      note: "Predatory stepped profile with long side jaws.",
      outer: [[2.68, -0.06], [1.84, -0.26], [1.14, -0.70], [0.20, -1.12], [-0.62, -0.82], [-1.28, -0.40], [-1.60, -0.12], [-1.72, 0], [-1.60, 0.12], [-1.28, 0.40], [-0.62, 0.82], [0.20, 1.12], [1.14, 0.70], [1.84, 0.26], [2.68, 0.06]],
      cutouts: [[[1.90, -0.12], [1.28, -0.08], [1.04, 0], [1.28, 0.08], [1.90, 0.12], [1.58, 0]]],
      lines: [[[1.78, 0], [-0.82, 0]], [[0.72, -0.36], [-0.16, -0.82]], [[0.72, 0.36], [-0.16, 0.82]]],
      vents: [[-1.22, -0.18], [-1.22, 0.18]]
    },
    {
      key: "manta-cut",
      family: "escort",
      variant: "A",
      name: "Manta Cut",
      role: "Escort A",
      note: "Curved manta-inspired wing roots with central command slit.",
      outer: [[2.34, 0], [1.42, -0.34], [0.56, -1.12], [-0.18, -1.26], [-0.98, -0.94], [-1.60, -0.28], [-1.78, 0], [-1.60, 0.28], [-0.98, 0.94], [-0.18, 1.26], [0.56, 1.12], [1.42, 0.34]],
      cutouts: [[[1.02, -0.10], [0.46, -0.05], [0.30, 0], [0.46, 0.05], [1.02, 0.10], [0.84, 0]]],
      lines: [[[1.56, 0], [-1.02, 0]], [[0.30, -0.92], [-0.82, -0.46]], [[0.30, 0.92], [-0.82, 0.46]]],
      vents: [[-1.10, -0.14], [-1.10, 0.14]]
    },
    {
      key: "warden-crescent",
      family: "escort",
      variant: "B",
      name: "Warden Crescent",
      role: "Escort B",
      note: "Defensive crescent front and deep rear notch.",
      outer: [[2.22, 0], [1.46, -0.26], [0.68, -0.96], [-0.16, -1.32], [-1.04, -1.00], [-1.74, -0.28], [-1.90, -0.06], [-2.00, 0], [-1.90, 0.06], [-1.74, 0.28], [-1.04, 1.00], [-0.16, 1.32], [0.68, 0.96], [1.46, 0.26]],
      cutouts: [[[0.98, -0.08], [0.40, -0.04], [0.20, 0], [0.40, 0.04], [0.98, 0.08], [0.72, 0]]],
      lines: [[[1.52, 0], [-1.16, 0]], [[0.20, -1.02], [-0.96, -0.56]], [[0.20, 1.02], [-0.96, 0.56]]],
      vents: [[-1.34, -0.18], [-1.34, 0.18]]
    },
    {
      key: "hammer-fork",
      family: "breaker",
      variant: "A",
      name: "Hammer Fork",
      role: "Breaker A",
      note: "Wide armored shoulders and hammer-head command wedge.",
      outer: [[2.56, 0], [1.84, -0.82], [0.94, -1.10], [0.04, -0.98], [-0.78, -0.66], [-1.24, -0.22], [-1.34, 0], [-1.24, 0.22], [-0.78, 0.66], [0.04, 0.98], [0.94, 1.10], [1.84, 0.82]],
      cutouts: [[[1.34, -0.20], [0.78, -0.12], [0.58, 0], [0.78, 0.12], [1.34, 0.20], [1.02, 0]]],
      lines: [[[1.72, 0], [-0.88, 0]], [[0.26, -0.82], [-0.62, -0.56]], [[0.26, 0.82], [-0.62, 0.56]]],
      vents: [[-0.94, -0.22], [-0.94, 0.22], [-0.74, 0]]
    },
    {
      key: "raptor-vault",
      family: "breaker",
      variant: "B",
      name: "Raptor Vault",
      role: "Breaker B",
      note: "Stepped forward skull and lifted dorsal vault.",
      outer: [[2.48, -0.10], [1.84, -0.34], [1.04, -0.82], [0.10, -1.10], [-0.70, -0.84], [-1.26, -0.38], [-1.58, -0.10], [-1.70, 0], [-1.58, 0.10], [-1.26, 0.38], [-0.70, 0.84], [0.10, 1.10], [1.04, 0.82], [1.84, 0.34], [2.48, 0.10]],
      cutouts: [[[1.54, -0.10], [0.92, -0.04], [0.68, 0], [0.92, 0.04], [1.54, 0.10], [1.24, 0]]],
      lines: [[[1.68, 0], [-0.92, 0]], [[0.40, -0.84], [-0.54, -0.58]], [[0.40, 0.84], [-0.54, 0.58]], [[1.06, -0.26], [0.32, 0]], [[1.06, 0.26], [0.32, 0]]],
      vents: [[-1.14, -0.18], [-1.14, 0.18]]
    },
    {
      key: "needle-anvil",
      family: "lancer",
      variant: "A",
      name: "Needle Anvil",
      role: "Lancer A",
      note: "Long spear nose over dense rear mass.",
      outer: [[3.02, 0], [2.14, -0.20], [1.18, -0.52], [0.46, -1.10], [-0.36, -1.02], [-1.08, -0.64], [-1.42, -0.22], [-1.54, 0], [-1.42, 0.22], [-1.08, 0.64], [-0.36, 1.02], [0.46, 1.10], [1.18, 0.52], [2.14, 0.20]],
      cutouts: [[[2.18, -0.08], [1.56, -0.04], [1.22, 0], [1.56, 0.04], [2.18, 0.08], [1.86, 0]]],
      lines: [[[2.18, 0], [-0.92, 0]], [[0.68, -0.66], [-0.38, -0.84]], [[0.68, 0.66], [-0.38, 0.84]]],
      vents: [[-1.10, -0.20], [-1.10, 0.20], [-0.90, 0]]
    },
    {
      key: "talon-rail",
      family: "lancer",
      variant: "B",
      name: "Talon Rail",
      role: "Lancer B",
      note: "Rail-spear nose with hooked inner shoulders.",
      outer: [[3.06, -0.04], [2.20, -0.16], [1.26, -0.52], [0.42, -0.98], [-0.30, -0.88], [-1.04, -0.56], [-1.46, -0.18], [-1.62, 0], [-1.46, 0.18], [-1.04, 0.56], [-0.30, 0.88], [0.42, 0.98], [1.26, 0.52], [2.20, 0.16], [3.06, 0.04]],
      cutouts: [[[2.20, -0.06], [1.58, -0.03], [1.18, 0], [1.58, 0.03], [2.20, 0.06], [1.88, 0]]],
      lines: [[[2.20, 0], [-0.88, 0]], [[0.80, -0.60], [0.10, -0.86]], [[0.80, 0.60], [0.10, 0.86]]],
      vents: [[-1.06, -0.16], [-1.06, 0.16]]
    },
    {
      key: "citadel-spear",
      family: "capital",
      variant: "A",
      name: "Citadel Spear",
      role: "Capital A",
      note: "Heavy citadel body with spearhead bridge.",
      outer: [[2.76, 0], [1.86, -0.66], [1.02, -1.22], [0.14, -1.16], [-0.70, -0.96], [-1.34, -0.48], [-1.68, -0.14], [-1.80, 0], [-1.68, 0.14], [-1.34, 0.48], [-0.70, 0.96], [0.14, 1.16], [1.02, 1.22], [1.86, 0.66]],
      cutouts: [[[1.38, -0.16], [0.82, -0.08], [0.62, 0], [0.82, 0.08], [1.38, 0.16], [1.06, 0]]],
      lines: [[[1.92, 0], [-1.08, 0]], [[0.46, -0.94], [-0.78, -0.54]], [[0.46, 0.94], [-0.78, 0.54]], [[1.12, -0.22], [0.42, 0]], [[1.12, 0.22], [0.42, 0]]],
      vents: [[-1.18, -0.22], [-1.18, 0.22], [-1.34, 0]]
    },
    {
      key: "monolith-pike",
      family: "capital",
      variant: "B",
      name: "Monolith Pike",
      role: "Capital B",
      note: "Massive monolithic pike with deep center incision.",
      outer: [[2.92, 0], [2.02, -0.54], [1.10, -1.22], [0.18, -1.34], [-0.72, -1.02], [-1.46, -0.46], [-1.86, -0.14], [-1.98, 0], [-1.86, 0.14], [-1.46, 0.46], [-0.72, 1.02], [0.18, 1.34], [1.10, 1.22], [2.02, 0.54]],
      cutouts: [[[1.74, -0.14], [1.08, -0.06], [0.88, 0], [1.08, 0.06], [1.74, 0.14], [1.42, 0]]],
      lines: [[[2.02, 0], [-1.20, 0]], [[0.58, -1.02], [-0.90, -0.62]], [[0.58, 1.02], [-0.90, 0.62]], [[1.28, -0.20], [0.48, 0]], [[1.28, 0.20], [0.48, 0]]],
      vents: [[-1.20, -0.22], [-1.20, 0.22], [-1.42, 0]]
    }
  ];

  var state = {
    time: 0,
    paletteKey: controls.palette.value,
    lodMode: controls.lodMode.value,
    distance: Number(controls.distance.value),
    stress: Number(controls.stress.value),
    focusFamily: "all",
    focusVariant: "all",
    motionIndex: 0
  };

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

  function getPalette() {
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

  function getFamilyMeta(key) {
    return FAMILIES.find(function (family) { return family.key === key; }) || FAMILIES[0];
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
  }

  function drawBackdrop(width, height, palette) {
    ctx.clearRect(0, 0, width, height);
    var rgb = hexToRgb(palette.core);
    var grad = ctx.createRadialGradient(width * 0.5, height * 0.15, 0, width * 0.5, height * 0.15, Math.max(width, height) * 0.92);
    grad.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.13)");
    grad.addColorStop(0.40, "rgba(8,13,25,0.80)");
    grad.addColorStop(1, "rgba(3,6,10,0.98)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.strokeStyle = rgbaRgb(palette.line, 0.045);
    ctx.lineWidth = 1;
    var step = 62;
    for (var x = 0.5; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (var y = 0.5; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function pathPolygon(points, scale) {
    ctx.beginPath();
    ctx.moveTo(points[0][0] * scale, points[0][1] * scale);
    for (var i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0] * scale, points[i][1] * scale);
    ctx.closePath();
  }

  function roundedRectPath(x, y, width, height, radius) {
    var r = Math.min(radius, width * 0.5, height * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function scaledPoints(points, scaleMul) {
    var pts = [];
    for (var i = 0; i < points.length; i += 1) pts.push([points[i][0] * scaleMul, points[i][1] * scaleMul]);
    return pts;
  }

  function drawShip(spec, x, y, scale, rotation, palette, lod, idx) {
    ctx.save();
    ctx.translate(x, y);

    var motion = MOTIONS[state.motionIndex];
    if (motion === "idle") {
      ctx.translate(Math.cos(state.time * 0.55 + idx) * 3, Math.sin(state.time * 0.75 + idx * 0.6) * 2.4);
      ctx.rotate(rotation + Math.sin(state.time * 0.32 + idx) * 0.03);
    } else if (motion === "bank") {
      ctx.translate(Math.cos(state.time * 0.9 + idx) * 5, Math.sin(state.time * 1.1 + idx) * 3);
      ctx.rotate(rotation + Math.sin(state.time * 1.1 + idx) * 0.08);
    } else {
      ctx.translate(Math.cos(state.time * 0.7 + idx) * 6, Math.sin(state.time * 0.9 + idx * 0.4) * 4);
      ctx.rotate(rotation + Math.sin(state.time * 0.6 + idx) * 0.05);
    }

    if (lod.glow) {
      var halo = ctx.createRadialGradient(0, 0, 0, 0, 0, scale * 4.4);
      halo.addColorStop(0, rgbaRgb(palette.glow, 0.16));
      halo.addColorStop(1, rgbaRgb(palette.glow, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, scale * 4.4, 0, TAU);
      ctx.fill();
    }

    pathPolygon(spec.outer, scale);
    ctx.fillStyle = rgba(palette.shell, 0.96);
    ctx.fill();
    ctx.strokeStyle = rgba(palette.edge, 0.22);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    var inner = scaledPoints(spec.outer, 0.70);
    ctx.save();
    ctx.translate(scale * 0.14, 0);
    pathPolygon(inner, scale);
    var hullGrad = ctx.createLinearGradient(scale * 1.8, 0, -scale * 1.4, scale * 0.8);
    hullGrad.addColorStop(0, rgba(palette.edge, 0.84));
    hullGrad.addColorStop(0.42, rgba(palette.core, 0.58));
    hullGrad.addColorStop(1, rgba(palette.hull, 0.84));
    ctx.fillStyle = hullGrad;
    ctx.fill();
    ctx.strokeStyle = rgba(palette.bright, 0.18);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    if (lod.cuts) {
      for (var c = 0; c < spec.cutouts.length; c += 1) {
        pathPolygon(spec.cutouts[c], scale);
        ctx.fillStyle = rgba(palette.shell, 1);
        ctx.fill();
      }
    }

    if (lod.cuts) {
      for (var l = 0; l < spec.lines.length; l += 1) {
        ctx.beginPath();
        ctx.moveTo(spec.lines[l][0][0] * scale, spec.lines[l][0][1] * scale);
        ctx.lineTo(spec.lines[l][1][0] * scale, spec.lines[l][1][1] * scale);
        ctx.strokeStyle = rgbaRgb(palette.line, lod.micro ? 0.32 : 0.20);
        ctx.lineWidth = lod.micro ? 1.0 : 0.8;
        ctx.stroke();
      }
    }

    if (lod.micro) {
      for (var p = 0; p < 4; p += 1) {
        var t = p / 3;
        var lineY = (-0.42 + t * 0.84) * scale;
        ctx.beginPath();
        ctx.moveTo(-0.68 * scale, lineY);
        ctx.lineTo(0.84 * scale, lineY * 0.44);
        ctx.strokeStyle = rgba(palette.edge, 0.10);
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    for (var v = 0; v < spec.vents.length; v += 1) {
      var vx = spec.vents[v][0] * scale;
      var vy = spec.vents[v][1] * scale;
      var pulse = 0.72 + 0.28 * Math.sin(state.time * 4.2 + idx + v);
      var eg = ctx.createRadialGradient(vx, vy, 0, vx, vy, scale * 0.42);
      eg.addColorStop(0, rgba(palette.bright, 0.86));
      eg.addColorStop(0.34, rgba(palette.core, 0.72 * pulse));
      eg.addColorStop(1, rgbaRgb(palette.glow, 0));
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(vx, vy, scale * 0.22, 0, TAU);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(scale * 0.28, 0, Math.max(1.4, scale * 0.10), 0, TAU);
    ctx.fillStyle = rgba(palette.bright, 0.94);
    ctx.fill();

    ctx.restore();
  }

  function drawCard(x, y, w, h, palette, active) {
    var grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, active ? "rgba(16,26,48,0.92)" : "rgba(10,16,30,0.88)");
    grad.addColorStop(1, active ? "rgba(7,10,20,0.98)" : "rgba(5,9,18,0.96)");
    ctx.fillStyle = grad;
    ctx.strokeStyle = active ? rgba(palette.edge, 0.26) : "rgba(126,182,255,0.08)";
    ctx.lineWidth = 1.2;
    roundedRectPath(x, y, w, h, 18);
    ctx.fill();
    ctx.stroke();
  }

  function drawCardLabel(x, y, text, tone) {
    ctx.fillStyle = tone || "rgba(235,243,255,0.90)";
    ctx.font = "12px Inter, Segoe UI, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(text, x, y);
  }

  function drawGroupedGrid(palette, lod) {
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    var cols = 5;
    var rows = 2;
    var marginX = 18;
    var topY = 34;
    var familyHeaderH = 34;
    var gapX = 14;
    var gapY = 14;
    var usableH = height - topY - familyHeaderH - 24;
    var cardW = (width - marginX * 2 - gapX * (cols - 1)) / cols;
    var cardH = (usableH - gapY * (rows - 1)) / rows;

    for (var col = 0; col < FAMILIES.length; col += 1) {
      var family = FAMILIES[col];
      var familyShips = SHIPS.filter(function (ship) { return ship.family === family.key; });
      var fx = marginX + col * (cardW + gapX);

      ctx.fillStyle = "rgba(236,243,255,0.92)";
      ctx.font = "13px Inter, Segoe UI, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(family.name, fx + cardW * 0.5, topY);

      ctx.fillStyle = "rgba(176,196,228,0.68)";
      ctx.font = "10px Inter, Segoe UI, Arial, sans-serif";
      ctx.fillText(family.note, fx + cardW * 0.5, topY + 15);

      for (var row = 0; row < familyShips.length; row += 1) {
        var spec = familyShips[row];
        var x = fx;
        var y = topY + familyHeaderH + row * (cardH + gapY);
        drawCard(x, y, cardW, cardH, palette, false);
        var scale = Math.min(cardW, cardH) * (family.key === "capital" ? 0.108 : family.key === "lancer" ? 0.112 : 0.118);
        drawShip(spec, x + cardW * 0.50, y + cardH * 0.54, scale, -0.08 + col * 0.015 - row * 0.03, palette, lod, col * 2 + row);

        if (lod.labels) {
          ctx.fillStyle = "rgba(235,243,255,0.90)";
          ctx.font = "11px Inter, Segoe UI, Arial, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(spec.role, x + cardW * 0.50, y + 20);
          ctx.fillStyle = "rgba(185,204,235,0.74)";
          ctx.font = "10px Inter, Segoe UI, Arial, sans-serif";
          ctx.fillText(spec.name + " / " + spec.variant, x + cardW * 0.50, y + cardH - 14);
        }
      }
    }
  }

  function drawFamilyFocus(palette, lod, familyKey) {
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    var family = getFamilyMeta(familyKey);
    var ships = SHIPS.filter(function (ship) { return ship.family === familyKey; });
    var padding = 26;
    var gap = 18;
    var cardW = (width - padding * 2 - gap) / 2;
    var cardH = height - 120;

    ctx.fillStyle = "rgba(242,247,255,0.94)";
    ctx.font = "18px Inter, Segoe UI, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(family.name, width * 0.5, 38);
    ctx.fillStyle = "rgba(195,214,244,0.80)";
    ctx.font = "12px Inter, Segoe UI, Arial, sans-serif";
    ctx.fillText(family.note, width * 0.5, 58);

    for (var i = 0; i < ships.length; i += 1) {
      var spec = ships[i];
      var x = padding + i * (cardW + gap);
      var y = 74;
      drawCard(x, y, cardW, cardH, palette, true);
      var scale = Math.min(cardW, cardH) * (family.key === "capital" ? 0.16 : family.key === "lancer" ? 0.17 : 0.18);
      drawShip(spec, x + cardW * 0.50, y + cardH * 0.52, scale, -0.05 + i * 0.05, palette, lod, i);
      drawCardLabel(x + 18, y + 24, spec.role);
      drawCardLabel(x + 18, y + 42, spec.name + " / variant " + spec.variant, "rgba(185,204,235,0.74)");
      drawCardLabel(x + 18, y + cardH - 18, spec.note, "rgba(185,204,235,0.68)");
    }
  }

  function drawVariantFocus(palette, lod, spec) {
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    var family = getFamilyMeta(spec.family);

    drawCard(26, 26, width - 52, height - 52, palette, true);
    drawShip(spec, width * 0.50, height * 0.50, Math.min(width, height) * (spec.family === "capital" ? 0.17 : 0.19), -0.04, palette, lod, 0);

    ctx.fillStyle = "rgba(242,247,255,0.94)";
    ctx.font = "18px Inter, Segoe UI, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(spec.name, width * 0.50, 62);

    ctx.fillStyle = "rgba(195,214,244,0.80)";
    ctx.font = "13px Inter, Segoe UI, Arial, sans-serif";
    ctx.fillText(spec.role + " / " + family.name, width * 0.50, 84);

    ctx.fillStyle = "rgba(220,232,255,0.74)";
    ctx.font = "12px Consolas, Segoe UI, monospace";
    ctx.fillText(spec.note, width * 0.50, height - 36);
  }

  function render() {
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    var palette = getPalette();
    var lod = getLod();
    var focused = SHIPS.find(function (ship) { return ship.key === state.focusVariant; });

    drawBackdrop(width, height, palette);

    if (focused) {
      drawVariantFocus(palette, lod, focused);
    } else if (state.focusFamily !== "all") {
      drawFamilyFocus(palette, lod, state.focusFamily);
    } else {
      drawGroupedGrid(palette, lod);
    }

    ctx.fillStyle = "rgba(220,232,255,0.86)";
    ctx.font = "12px Consolas, Segoe UI, monospace";
    ctx.textAlign = "left";
    ctx.fillText("LOD: " + getLodKey().toUpperCase() + " | type: " + state.focusFamily + " | variant: " + state.focusVariant, 18, 24);
    document.documentElement.style.setProperty("--accent", palette.core);

    if (texts.title) {
      if (focused) texts.title.textContent = focused.name;
      else if (state.focusFamily !== "all") texts.title.textContent = getFamilyMeta(state.focusFamily).name;
      else texts.title.textContent = "Ships Prototype 01";
    }
    if (texts.status) {
      texts.status.textContent =
        "Первый корабельный проход: 5 читаемых военных типов и 10 стартовых вариантов. " +
        "Сейчас focus = `" + state.focusFamily + "` / `" + state.focusVariant + "`, LOD = `" + getLodKey().toUpperCase() + "`.";
    }
  }

  function frame(now) {
    if (!frame.last) frame.last = now;
    var dt = Math.min(0.033, (now - frame.last) / 1000);
    frame.last = now;
    state.time += dt;
    render();
    requestAnimationFrame(frame);
  }

  function cyclePalette() {
    var keys = Object.keys(PALETTES);
    var idx = keys.indexOf(state.paletteKey);
    state.paletteKey = keys[(idx + 1) % keys.length];
    controls.palette.value = state.paletteKey;
  }

  function refreshVariantOptions() {
    var current = state.focusVariant;
    controls.focusVariant.innerHTML = "";

    var allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = "All Variants";
    controls.focusVariant.appendChild(allOpt);

    var visibleShips = state.focusFamily === "all"
      ? SHIPS
      : SHIPS.filter(function (ship) { return ship.family === state.focusFamily; });

    visibleShips.forEach(function (ship) {
      var opt = document.createElement("option");
      opt.value = ship.key;
      opt.textContent = getFamilyMeta(ship.family).name + " / " + ship.name;
      controls.focusVariant.appendChild(opt);
    });

    var stillExists = visibleShips.some(function (ship) { return ship.key === current; });
    state.focusVariant = stillExists ? current : "all";
    controls.focusVariant.value = state.focusVariant;
  }

  function bind() {
    var familyAll = document.createElement("option");
    familyAll.value = "all";
    familyAll.textContent = "All Types";
    controls.focusFamily.appendChild(familyAll);

    FAMILIES.forEach(function (family) {
      var opt = document.createElement("option");
      opt.value = family.key;
      opt.textContent = family.name;
      controls.focusFamily.appendChild(opt);
    });

    refreshVariantOptions();

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
    controls.focusFamily.addEventListener("change", function () {
      state.focusFamily = controls.focusFamily.value;
      refreshVariantOptions();
    });
    controls.focusVariant.addEventListener("change", function () {
      state.focusVariant = controls.focusVariant.value;
    });
    controls.cycleMotion.addEventListener("click", function () {
      state.motionIndex = (state.motionIndex + 1) % MOTIONS.length;
    });
    controls.shufflePalette.addEventListener("click", cyclePalette);
    controls.focusAll.addEventListener("click", function () {
      state.focusFamily = "all";
      state.focusVariant = "all";
      controls.focusFamily.value = "all";
      refreshVariantOptions();
    });

    window.addEventListener("resize", resize);
  }

  bind();
  resize();
  requestAnimationFrame(frame);
})();
