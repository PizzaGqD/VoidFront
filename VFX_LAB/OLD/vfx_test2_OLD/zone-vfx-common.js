(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var DEFAULT_VARIANT = {
    variantId: "00",
    title: "Zone Variant",
    subtitle: "Local shell over authoritative zone contour.",
    style: "lattice",
    auraDepth: 18,
    noiseAmp: 10,
    pressureAmp: 24,
    pressureInset: 34,
    shellWidth: 8,
    flowSpeed: 1,
    nodeDensity: 1,
    spikeLen: 16,
    ribbonLen: 34,
    localFormula: "Authoritative contour stays unchanged. Local shell rides on top and is client-only.",
    pressureNote: "Dominant zone compresses only the visual shell of the weaker zone.",
    shipNote: "Ships use a completely new silhouette language for zone readability tests."
  };

  var variant = Object.assign({}, DEFAULT_VARIANT, window.ZONE_VARIANT_CONFIG || {});

  var canvas = document.getElementById("scene");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var controls = {
    palette: document.getElementById("palette"),
    lodMode: document.getElementById("lodMode"),
    distance: document.getElementById("distance"),
    stress: document.getElementById("stress"),
    pulsePressure: document.getElementById("pulsePressure"),
    motionBurst: document.getElementById("motionBurst")
  };

  var textEls = {
    status: document.getElementById("statusLine"),
    variantTitle: document.getElementById("variantTitle"),
    variantSubtitle: document.getElementById("variantSubtitle"),
    real: document.getElementById("legendReal"),
    local: document.getElementById("legendLocal"),
    ships: document.getElementById("legendShips")
  };

  var PALETTES = {
    blue: {
      weak:  { core: "#67a5ff", edge: "#d7e8ff", bright: "#f6fbff", shell: "#0a1529", armor: "#16345f", trim: "#6eaefc", glow: "103,165,255", line: "152,200,255" },
      strong:{ core: "#ff7b89", edge: "#ffd8df", bright: "#fff6f7", shell: "#23121a", armor: "#5d2030", trim: "#ff92a0", glow: "255,123,137", line: "255,168,177" }
    },
    red: {
      weak:  { core: "#ff7f92", edge: "#ffe0e7", bright: "#fff7f9", shell: "#261019", armor: "#5d2031", trim: "#ff9bae", glow: "255,127,146", line: "255,180,194" },
      strong:{ core: "#6db5ff", edge: "#ddeeff", bright: "#f6fbff", shell: "#101c2e", armor: "#1b406e", trim: "#90c4ff", glow: "109,181,255", line: "164,209,255" }
    },
    green: {
      weak:  { core: "#63d39a", edge: "#dbffeb", bright: "#f5fff9", shell: "#0b1d18", armor: "#1a5140", trim: "#7fe0ac", glow: "99,211,154", line: "157,238,197" },
      strong:{ core: "#ff905f", edge: "#ffe1d1", bright: "#fff8f3", shell: "#24140d", armor: "#6a3219", trim: "#ffae88", glow: "255,144,95", line: "255,190,155" }
    },
    purple: {
      weak:  { core: "#bb8fff", edge: "#efdeff", bright: "#fcf8ff", shell: "#171124", armor: "#432a6c", trim: "#d0afff", glow: "187,143,255", line: "221,194,255" },
      strong:{ core: "#7fd6c6", edge: "#dbfff8", bright: "#f6fffd", shell: "#0f1d1c", armor: "#1f544e", trim: "#95ebdb", glow: "127,214,198", line: "176,242,233" }
    },
    amber: {
      weak:  { core: "#ffbb5e", edge: "#ffe6c2", bright: "#fffaf1", shell: "#25190b", armor: "#6a4018", trim: "#ffd18a", glow: "255,187,94", line: "255,219,162" },
      strong:{ core: "#88a8ff", edge: "#dfe9ff", bright: "#f7faff", shell: "#10182b", armor: "#243b70", trim: "#aac1ff", glow: "136,168,255", line: "181,202,255" }
    }
  };

  var LOD = {
    near: {
      samples: 90,
      shellLayers: 2,
      connectorStep: 6,
      nodes: 14,
      ribbons: 16,
      shards: 12,
      pulses: 12,
      shipMicro: true
    },
    mid: {
      samples: 58,
      shellLayers: 1,
      connectorStep: 9,
      nodes: 8,
      ribbons: 8,
      shards: 7,
      pulses: 7,
      shipMicro: false
    },
    far: {
      samples: 34,
      shellLayers: 1,
      connectorStep: 14,
      nodes: 0,
      ribbons: 0,
      shards: 4,
      pulses: 4,
      shipMicro: false
    }
  };

  var SHIP_LIBRARY = {
    prong: {
      outer: [[2.65, -0.08], [1.92, -0.48], [0.88, -0.68], [0.18, -1.06], [-0.62, -0.72], [-1.12, -0.28], [-1.34, 0], [-1.12, 0.28], [-0.62, 0.72], [0.18, 1.06], [0.88, 0.68], [1.92, 0.48], [2.65, 0.08], [1.80, 0], [2.65, -0.08]],
      armor: [[1.82, 0], [1.04, -0.34], [0.14, -0.58], [-0.54, -0.42], [-0.84, -0.14], [-0.96, 0], [-0.84, 0.14], [-0.54, 0.42], [0.14, 0.58], [1.04, 0.34]],
      cutout: [[2.00, -0.16], [1.48, -0.10], [1.28, 0], [1.48, 0.10], [2.00, 0.16], [1.80, 0]],
      plates: [
        [[1.18, -0.34], [0.62, -0.24], [0.08, -0.54], [0.72, -0.48]],
        [[1.18, 0.34], [0.62, 0.24], [0.08, 0.54], [0.72, 0.48]],
        [[0.02, -0.58], [-0.48, -0.42], [-0.76, -0.12], [-0.28, -0.08]],
        [[0.02, 0.58], [-0.48, 0.42], [-0.76, 0.12], [-0.28, 0.08]]
      ],
      vents: [[-0.96, -0.20], [-0.96, 0.20]]
    },
    anvil: {
      outer: [[2.36, 0], [1.64, -0.74], [0.62, -1.06], [-0.32, -0.98], [-1.06, -0.64], [-1.42, -0.18], [-1.42, 0.18], [-1.06, 0.64], [-0.32, 0.98], [0.62, 1.06], [1.64, 0.74]],
      armor: [[1.68, 0], [1.02, -0.40], [0.26, -0.62], [-0.42, -0.56], [-0.90, -0.30], [-1.06, -0.08], [-1.06, 0.08], [-0.90, 0.30], [-0.42, 0.56], [0.26, 0.62], [1.02, 0.40]],
      cutout: [[1.26, -0.18], [0.72, -0.12], [0.54, 0], [0.72, 0.12], [1.26, 0.18], [1.02, 0]],
      plates: [
        [[1.22, -0.46], [0.56, -0.28], [0.00, -0.56], [0.74, -0.64]],
        [[1.22, 0.46], [0.56, 0.28], [0.00, 0.56], [0.74, 0.64]],
        [[-0.02, -0.64], [-0.46, -0.50], [-0.88, -0.18], [-0.36, -0.12]],
        [[-0.02, 0.64], [-0.46, 0.50], [-0.88, 0.18], [-0.36, 0.12]]
      ],
      vents: [[-1.04, -0.24], [-1.04, 0.24], [-0.82, 0]]
    },
    ray: {
      outer: [[2.42, 0], [1.54, -0.38], [0.74, -0.98], [-0.06, -1.20], [-0.86, -0.84], [-1.56, -0.20], [-1.74, 0], [-1.56, 0.20], [-0.86, 0.84], [-0.06, 1.20], [0.74, 0.98], [1.54, 0.38]],
      armor: [[1.54, 0], [0.92, -0.22], [0.20, -0.58], [-0.44, -0.68], [-1.00, -0.36], [-1.18, -0.08], [-1.18, 0.08], [-1.00, 0.36], [-0.44, 0.68], [0.20, 0.58], [0.92, 0.22]],
      cutout: [[1.04, -0.10], [0.56, -0.06], [0.38, 0], [0.56, 0.06], [1.04, 0.10], [0.86, 0]],
      plates: [
        [[1.00, -0.22], [0.40, -0.14], [-0.04, -0.50], [0.56, -0.40]],
        [[1.00, 0.22], [0.40, 0.14], [-0.04, 0.50], [0.56, 0.40]],
        [[-0.14, -0.74], [-0.62, -0.56], [-1.00, -0.18], [-0.40, -0.18]],
        [[-0.14, 0.74], [-0.62, 0.56], [-1.00, 0.18], [-0.40, 0.18]]
      ],
      vents: [[-1.18, -0.18], [-1.18, 0.18]]
    }
  };

  var stars = [];
  var state = {
    time: 0,
    paletteKey: controls.palette ? controls.palette.value : "blue",
    lodMode: controls.lodMode ? controls.lodMode.value : "auto",
    distance: controls.distance ? Number(controls.distance.value) : 18,
    stress: controls.stress ? Number(controls.stress.value) : 18,
    pressurePulse: 0,
    motionBurst: 0
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
    var raw = String(hex || "#000000").replace("#", "");
    var value = parseInt(raw, 16) || 0;
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
      Math.sin(angle * 2.8 + time * 1.2 + seed * 0.17) * 0.55 +
      Math.cos(angle * 5.1 - time * 0.8 + seed * 0.31) * 0.30 +
      Math.sin(angle * 9.2 + time * 0.35 + seed * 0.09) * 0.15
    );
  }

  function makeStars() {
    stars.length = 0;
    for (var i = 0; i < 190; i += 1) {
      stars.push({
        x: seeded(i * 1.17),
        y: seeded(i * 3.91),
        size: 0.7 + seeded(i * 6.23) * 2.1,
        alpha: 0.10 + seeded(i * 7.19) * 0.34,
        speed: 0.45 + seeded(i * 2.73) * 0.95
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
  }

  function getPaletteSet() {
    return PALETTES[state.paletteKey] || PALETTES.blue;
  }

  function getLodKey() {
    if (state.lodMode && state.lodMode !== "auto") return state.lodMode;
    if (state.distance > 72 || state.stress > 78) return "far";
    if (state.distance > 36 || state.stress > 42) return "mid";
    return "near";
  }

  function getLod() {
    return LOD[getLodKey()];
  }

  function drawBackdrop(width, height, weakPalette) {
    ctx.clearRect(0, 0, width, height);

    var bg = ctx.createRadialGradient(width * 0.50, height * 0.18, 0, width * 0.50, height * 0.18, Math.max(width, height) * 0.95);
    var rgb = hexToRgb(weakPalette.core);
    bg.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.12)");
    bg.addColorStop(0.38, "rgba(8,13,25,0.78)");
    bg.addColorStop(1, "rgba(3,6,10,0.98)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    for (var i = 0; i < stars.length; i += 1) {
      var star = stars[i];
      var pulse = 0.72 + 0.28 * Math.sin(state.time * star.speed + star.x * 13);
      ctx.fillStyle = "rgba(220,232,255," + (star.alpha * pulse).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(star.x * width, star.y * height, star.size, 0, TAU);
      ctx.fill();
    }

    ctx.save();
    ctx.strokeStyle = rgbaRgb(weakPalette.line, 0.045);
    ctx.lineWidth = 1;
    var step = 58;
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
    var mx = (last.x + first.x) * 0.5;
    var my = (last.y + first.y) * 0.5;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    for (var i = 0; i < points.length; i += 1) {
      var cur = points[i];
      var next = points[(i + 1) % points.length];
      var nx = (cur.x + next.x) * 0.5;
      var ny = (cur.y + next.y) * 0.5;
      ctx.quadraticCurveTo(cur.x, cur.y, nx, ny);
    }
    ctx.closePath();
  }

  function pathPoly(points) {
    if (!points || points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (var i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
  }

  function createScene(width, height) {
    return {
      weak: {
        cx: width * 0.42,
        cy: height * 0.58,
        radius: Math.min(width, height) * 0.20,
        seed: 21,
        strength: 0.48
      },
      strong: {
        cx: width * 0.64,
        cy: height * 0.46,
        radius: Math.min(width, height) * 0.24,
        seed: 83,
        strength: 1.00
      }
    };
  }

  function buildRealSamples(zone, count) {
    var samples = [];
    var totalR = 0;
    for (var i = 0; i < count; i += 1) {
      var angle = (i / count) * TAU;
      var shape = 1
        + Math.sin(angle * 2.0 + zone.seed * 0.03) * 0.09
        + Math.cos(angle * 3.0 - zone.seed * 0.02) * 0.055
        + Math.sin(angle * 5.0 + zone.seed * 0.01) * 0.028;
      var radius = zone.radius * shape;
      totalR += radius;
      var nx = Math.cos(angle);
      var ny = Math.sin(angle);
      samples.push({
        angle: angle,
        realR: radius,
        nx: nx,
        ny: ny,
        x: zone.cx + nx * radius,
        y: zone.cy + ny * radius,
        pressure: 0,
        shellOffset: 0,
        shellX: 0,
        shellY: 0,
        tangentX: -ny,
        tangentY: nx
      });
    }
    zone.avgRadius = totalR / Math.max(1, count);
    return samples;
  }

  function samplePressure(sample, weakZone, strongZone) {
    var dx = strongZone.cx - sample.x;
    var dy = strongZone.cy - sample.y;
    var dist = Math.hypot(dx, dy) || 1;
    var dirX = dx / dist;
    var dirY = dy / dist;
    var facing = clamp(sample.nx * dirX + sample.ny * dirY, 0, 1);
    var pressureReach = strongZone.avgRadius + Math.max(80, strongZone.radius * 0.90);
    var proximity = smoothstep(pressureReach, strongZone.avgRadius * 0.56, dist);
    var dominance = clamp((strongZone.strength - weakZone.strength) / 0.52, 0, 1);
    var pulse = 1 + state.pressurePulse * 0.7;
    return proximity * Math.pow(facing, 1.45) * dominance * pulse;
  }

  function buildShellSamples(zone, realSamples, lod, stylePalette, pressureSource, isWeak) {
    var output = [];
    var motionMul = 1 + state.motionBurst * 0.8;
    for (var i = 0; i < realSamples.length; i += 1) {
      var s = realSamples[i];
      var flow = layeredNoise(zone.seed + 13, s.angle, state.time * variant.flowSpeed * motionMul);
      var ripple = Math.sin(state.time * (1.8 + zone.seed * 0.003) + s.angle * 3.0) * 0.50;
      var baseOffset = variant.auraDepth + (flow * 0.70 + ripple * 0.30) * variant.noiseAmp;
      var pressure = 0;
      if (isWeak && pressureSource) pressure = samplePressure(s, zone, pressureSource);
      var offset = baseOffset - pressure * variant.pressureAmp;
      offset = clamp(offset, -variant.pressureInset, variant.auraDepth + variant.noiseAmp * 1.5);
      output.push({
        angle: s.angle,
        nx: s.nx,
        ny: s.ny,
        tangentX: s.tangentX,
        tangentY: s.tangentY,
        x: s.x,
        y: s.y,
        pressure: pressure,
        shellOffset: offset,
        shellX: s.x + s.nx * offset,
        shellY: s.y + s.ny * offset
      });
    }
    return output;
  }

  function extractPoints(samples, useShell) {
    var pts = [];
    for (var i = 0; i < samples.length; i += 1) {
      pts.push({
        x: useShell ? samples[i].shellX : samples[i].x,
        y: useShell ? samples[i].shellY : samples[i].y
      });
    }
    return pts;
  }

  function drawZoneFill(realPoints, palette, alphaMul) {
    var cx = 0;
    var cy = 0;
    var i;
    for (i = 0; i < realPoints.length; i += 1) {
      cx += realPoints[i].x;
      cy += realPoints[i].y;
    }
    cx /= Math.max(1, realPoints.length);
    cy /= Math.max(1, realPoints.length);
    var fill = ctx.createRadialGradient(cx, cy, 0, cx, cy, 220);
    fill.addColorStop(0, rgbaRgb(palette.glow, 0.10 * alphaMul));
    fill.addColorStop(0.6, rgbaRgb(palette.glow, 0.03 * alphaMul));
    fill.addColorStop(1, rgbaRgb(palette.glow, 0));
    pathSmooth(realPoints);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawAuthoritativeContour(realPoints, palette, width) {
    pathSmooth(realPoints);
    ctx.strokeStyle = rgba(palette.edge, 0.62);
    ctx.lineWidth = width;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawShellBase(shellPoints, palette, width, alphaMul) {
    pathSmooth(shellPoints);
    ctx.strokeStyle = rgbaRgb(palette.glow, 0.12 * alphaMul);
    ctx.lineWidth = width * 1.9;
    ctx.stroke();

    pathSmooth(shellPoints);
    ctx.strokeStyle = rgba(palette.bright, 0.34 * alphaMul);
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function drawConnectors(samples, palette, lod, mode) {
    for (var i = 0; i < samples.length; i += lod.connectorStep) {
      var s = samples[i];
      var alpha = mode === "weak" ? 0.08 + s.pressure * 0.22 : 0.10;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.shellX, s.shellY);
      ctx.strokeStyle = rgbaRgb(palette.line, alpha);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawLattice(samples, palette, lod) {
    if (lod.nodes <= 0) return;
    var step = Math.max(1, Math.floor(samples.length / lod.nodes));
    var nodes = [];
    var i;
    for (i = 0; i < samples.length; i += step) nodes.push(samples[i]);
    for (i = 0; i < nodes.length; i += 1) {
      var next = nodes[(i + 1) % nodes.length];
      ctx.beginPath();
      ctx.moveTo(nodes[i].shellX, nodes[i].shellY);
      ctx.lineTo(next.shellX, next.shellY);
      ctx.strokeStyle = rgbaRgb(palette.line, 0.20);
      ctx.lineWidth = 1;
      ctx.stroke();

      var skip = nodes[(i + 2) % nodes.length];
      ctx.beginPath();
      ctx.moveTo(nodes[i].shellX, nodes[i].shellY);
      ctx.lineTo(skip.shellX, skip.shellY);
      ctx.strokeStyle = rgbaRgb(palette.line, 0.10);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    for (i = 0; i < nodes.length; i += 1) {
      ctx.beginPath();
      ctx.arc(nodes[i].shellX, nodes[i].shellY, 2.4, 0, TAU);
      ctx.fillStyle = rgba(palette.bright, 0.84);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(nodes[i].shellX, nodes[i].shellY, 8.5, 0, TAU);
      ctx.fillStyle = rgbaRgb(palette.glow, 0.08);
      ctx.fill();
    }
  }

  function drawFluid(samples, palette, lod) {
    var pass;
    for (pass = 0; pass < lod.shellLayers + 1; pass += 1) {
      var pts = [];
      for (var i = 0; i < samples.length; i += 1) {
        var s = samples[i];
        var offset = Math.sin(state.time * (1.8 + pass * 0.5) + s.angle * (3 + pass)) * (8 - pass * 2);
        pts.push({
          x: s.shellX + s.tangentX * offset * 0.35,
          y: s.shellY + s.tangentY * offset * 0.35
        });
      }
      pathSmooth(pts);
      ctx.strokeStyle = rgbaRgb(palette.glow, 0.10 + pass * 0.04);
      ctx.lineWidth = Math.max(1.4, variant.shellWidth - pass * 2.0);
      ctx.stroke();
    }
  }

  function drawShards(samples, palette, lod) {
    if (lod.shards <= 0) return;
    var step = Math.max(1, Math.floor(samples.length / lod.shards));
    for (var i = 0; i < samples.length; i += step) {
      var s = samples[i];
      var left = samples[(i - 1 + samples.length) % samples.length];
      var right = samples[(i + 1) % samples.length];
      var tipX = s.shellX + s.nx * (variant.spikeLen * (1 - s.pressure * 0.55));
      var tipY = s.shellY + s.ny * (variant.spikeLen * (1 - s.pressure * 0.55));
      ctx.beginPath();
      ctx.moveTo(left.shellX, left.shellY);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(right.shellX, right.shellY);
      ctx.closePath();
      ctx.fillStyle = rgbaRgb(palette.glow, 0.10 + s.pressure * 0.10);
      ctx.fill();
      ctx.strokeStyle = rgba(palette.edge, 0.16);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawRibbons(samples, palette, lod) {
    if (lod.ribbons <= 0) return;
    var step = Math.max(1, Math.floor(samples.length / lod.ribbons));
    for (var i = 0; i < samples.length; i += step) {
      var s = samples[i];
      var len = variant.ribbonLen * (1 - s.pressure * 0.35);
      var bend = Math.sin(state.time * 2.0 + s.angle * 4.0) * 18;
      var endX = s.shellX + s.tangentX * len + s.nx * bend * 0.18;
      var endY = s.shellY + s.tangentY * len + s.ny * bend * 0.18;
      var ctrlX = s.shellX + s.tangentX * len * 0.4 + s.nx * bend;
      var ctrlY = s.shellY + s.tangentY * len * 0.4 + s.ny * bend;
      ctx.beginPath();
      ctx.moveTo(s.shellX, s.shellY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
      ctx.strokeStyle = rgbaRgb(palette.line, 0.14);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  function drawGravSkin(samples, palette, lod) {
    var points = extractPoints(samples, false);
    var inner1 = [];
    var inner2 = [];
    for (var i = 0; i < samples.length; i += 1) {
      inner1.push({ x: samples[i].x + samples[i].nx * (samples[i].shellOffset * 0.30), y: samples[i].y + samples[i].ny * (samples[i].shellOffset * 0.30) });
      inner2.push({ x: samples[i].x + samples[i].nx * (samples[i].shellOffset * 0.62), y: samples[i].y + samples[i].ny * (samples[i].shellOffset * 0.62) });
    }
    pathSmooth(inner1);
    ctx.strokeStyle = rgbaRgb(palette.line, 0.10);
    ctx.lineWidth = 1.1;
    ctx.stroke();
    pathSmooth(inner2);
    ctx.strokeStyle = rgbaRgb(palette.glow, 0.12);
    ctx.lineWidth = 1.4;
    ctx.stroke();

    for (i = 0; i < samples.length; i += lod.connectorStep) {
      var s = samples[i];
      if (s.pressure <= 0.02) continue;
      ctx.beginPath();
      ctx.arc(s.shellX, s.shellY, 12 + s.pressure * 18, s.angle - 0.7, s.angle + 0.7);
      ctx.strokeStyle = rgba(palette.bright, 0.12 + s.pressure * 0.20);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawPulseCrown(samples, palette, lod) {
    if (lod.pulses <= 0) return;
    var step = Math.max(1, Math.floor(samples.length / lod.pulses));
    for (var i = 0; i < samples.length; i += step) {
      var s = samples[i];
      var pulse = 0.45 + 0.55 * Math.sin(state.time * 2.8 + s.angle * 8);
      var len = variant.spikeLen * (0.55 + pulse * 0.65);
      ctx.beginPath();
      ctx.moveTo(s.shellX, s.shellY);
      ctx.lineTo(s.shellX + s.nx * len, s.shellY + s.ny * len);
      ctx.strokeStyle = rgbaRgb(palette.line, 0.10 + pulse * 0.16);
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(s.shellX + s.nx * len, s.shellY + s.ny * len, 2.0 + pulse * 1.5, 0, TAU);
      ctx.fillStyle = rgba(palette.bright, 0.25 + pulse * 0.35);
      ctx.fill();
    }
  }

  function drawPressureFront(weakSamples, weakPalette, strongPalette) {
    var hotspot = null;
    var maxPressure = 0;
    for (var i = 0; i < weakSamples.length; i += 1) {
      if (weakSamples[i].pressure > maxPressure) {
        maxPressure = weakSamples[i].pressure;
        hotspot = weakSamples[i];
      }
    }
    if (!hotspot || maxPressure < 0.02) return;
    ctx.beginPath();
    ctx.arc(hotspot.x, hotspot.y, 20 + maxPressure * 44, 0, TAU);
    ctx.fillStyle = rgbaRgb(strongPalette.glow, 0.08 + maxPressure * 0.10);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hotspot.shellX, hotspot.shellY, 10 + maxPressure * 18, hotspot.angle - 0.9, hotspot.angle + 0.9);
    ctx.strokeStyle = rgba(strongPalette.bright, 0.18 + maxPressure * 0.18);
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }

  function drawZoneVisual(samples, palette, lod, isWeak) {
    var shellPoints = extractPoints(samples, true);
    drawShellBase(shellPoints, palette, variant.shellWidth, isWeak ? 1 : 1.15);
    drawConnectors(samples, palette, lod, isWeak ? "weak" : "strong");

    if (variant.style === "lattice") drawLattice(samples, palette, lod);
    else if (variant.style === "fluid") drawFluid(samples, palette, lod);
    else if (variant.style === "shards") drawShards(samples, palette, lod);
    else if (variant.style === "ribbons") drawRibbons(samples, palette, lod);
    else if (variant.style === "gravskin") drawGravSkin(samples, palette, lod);
    else if (variant.style === "pulse") drawPulseCrown(samples, palette, lod);
  }

  function drawShip(specKey, x, y, scale, angle, palette, lod, kindBias) {
    var spec = SHIP_LIBRARY[specKey];
    if (!spec) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    var halo = ctx.createRadialGradient(0, 0, 0, 0, 0, scale * 4.2);
    halo.addColorStop(0, rgbaRgb(palette.glow, 0.14 + kindBias * 0.04));
    halo.addColorStop(1, rgbaRgb(palette.glow, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, scale * 4.2, 0, TAU);
    ctx.fill();

    ctx.scale(scale, scale);

    pathPoly(spec.outer);
    ctx.fillStyle = rgba(palette.shell, 0.96);
    ctx.fill();
    ctx.strokeStyle = rgba(palette.edge, 0.20);
    ctx.lineWidth = 0.08;
    ctx.stroke();

    pathPoly(spec.armor);
    var armorGrad = ctx.createLinearGradient(1.8, 0, -1.2, 0.8);
    armorGrad.addColorStop(0, rgba(palette.edge, 0.82));
    armorGrad.addColorStop(0.35, rgba(palette.trim, 0.56));
    armorGrad.addColorStop(1, rgba(palette.armor, 0.85));
    ctx.fillStyle = armorGrad;
    ctx.fill();
    ctx.strokeStyle = rgba(palette.bright, 0.18);
    ctx.lineWidth = 0.06;
    ctx.stroke();

    pathPoly(spec.cutout);
    ctx.fillStyle = rgba(palette.shell, 1);
    ctx.fill();

    for (var i = 0; i < spec.plates.length; i += 1) {
      pathPoly(spec.plates[i]);
      ctx.fillStyle = rgba(palette.armor, 0.58);
      ctx.fill();
      if (lod.shipMicro) {
        ctx.strokeStyle = rgba(palette.edge, 0.12);
        ctx.lineWidth = 0.04;
        ctx.stroke();
      }
    }

    for (i = 0; i < spec.vents.length; i += 1) {
      var vx = spec.vents[i][0];
      var vy = spec.vents[i][1];
      var ventGlow = ctx.createRadialGradient(vx, vy, 0, vx, vy, 0.38);
      var pulse = 0.72 + 0.28 * Math.sin(state.time * 4.2 + i);
      ventGlow.addColorStop(0, rgba(palette.bright, 0.82));
      ventGlow.addColorStop(0.35, rgba(palette.core, 0.64 * pulse));
      ventGlow.addColorStop(1, rgbaRgb(palette.glow, 0));
      ctx.fillStyle = ventGlow;
      ctx.beginPath();
      ctx.arc(vx, vy, 0.22, 0, TAU);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(0.26, 0, 0.10, 0, TAU);
    ctx.fillStyle = rgba(palette.bright, 0.92);
    ctx.fill();

    ctx.restore();
  }

  function drawShips(scene, weakPalette, strongPalette, lod) {
    var t = state.time;
    var weakShips = [
      { key: "prong", x: scene.weak.cx - 30, y: scene.weak.cy - scene.weak.radius * 0.56, scale: 22, ang: -0.18 },
      { key: "anvil", x: scene.weak.cx - scene.weak.radius * 0.28, y: scene.weak.cy + scene.weak.radius * 0.16, scale: 24, ang: 0.06 },
      { key: "ray", x: scene.weak.cx + scene.weak.radius * 0.18, y: scene.weak.cy - scene.weak.radius * 0.06, scale: 21, ang: 0.20 }
    ];
    var strongShips = [
      { key: "anvil", x: scene.strong.cx + scene.strong.radius * 0.24, y: scene.strong.cy - scene.strong.radius * 0.14, scale: 26, ang: Math.PI + 0.08 },
      { key: "prong", x: scene.strong.cx - scene.strong.radius * 0.18, y: scene.strong.cy + scene.strong.radius * 0.28, scale: 22, ang: Math.PI - 0.18 }
    ];
    var i;
    for (i = 0; i < weakShips.length; i += 1) {
      var ws = weakShips[i];
      drawShip(ws.key, ws.x + Math.cos(t * 0.7 + i) * 4, ws.y + Math.sin(t * 0.6 + i) * 3, ws.scale, ws.ang + Math.sin(t * 0.4 + i) * 0.03, weakPalette, lod, 0);
    }
    for (i = 0; i < strongShips.length; i += 1) {
      var ss = strongShips[i];
      drawShip(ss.key, ss.x + Math.cos(t * 0.6 + i) * 5, ss.y + Math.sin(t * 0.5 + i) * 4, ss.scale, ss.ang + Math.sin(t * 0.45 + i) * 0.03, strongPalette, lod, 1);
    }
  }

  function drawLabels(scene, weakPalette, strongPalette) {
    ctx.fillStyle = "rgba(220,232,255,0.86)";
    ctx.font = "12px Inter, Segoe UI, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Weak zone / real contour unchanged", scene.weak.cx - scene.weak.radius * 0.86, scene.weak.cy - scene.weak.radius - 30);
    ctx.fillStyle = rgba(strongPalette.edge, 0.84);
    ctx.fillText("Strong zone / visual dominance source", scene.strong.cx - scene.strong.radius * 0.86, scene.strong.cy - scene.strong.radius - 30);
  }

  function render() {
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    var paletteSet = getPaletteSet();
    var weakPalette = paletteSet.weak;
    var strongPalette = paletteSet.strong;
    var lod = getLod();
    var scene = createScene(width, height);

    drawBackdrop(width, height, weakPalette);

    var strongReal = buildRealSamples(scene.strong, lod.samples);
    var weakReal = buildRealSamples(scene.weak, lod.samples);
    var strongShell = buildShellSamples(scene.strong, strongReal, lod, strongPalette, null, false);
    var weakShell = buildShellSamples(scene.weak, weakReal, lod, weakPalette, scene.strong, true);

    drawZoneFill(extractPoints(strongReal, false), strongPalette, 0.85);
    drawZoneFill(extractPoints(weakReal, false), weakPalette, 1);

    drawZoneVisual(strongShell, strongPalette, lod, false);
    drawZoneVisual(weakShell, weakPalette, lod, true);
    drawPressureFront(weakShell, weakPalette, strongPalette);

    drawAuthoritativeContour(extractPoints(strongReal, false), strongPalette, 1.2);
    drawAuthoritativeContour(extractPoints(weakReal, false), weakPalette, 1.2);

    drawShips(scene, weakPalette, strongPalette, lod);
    drawLabels(scene, weakPalette, strongPalette);

    ctx.fillStyle = "rgba(220,232,255,0.86)";
    ctx.font = "12px Consolas, Segoe UI, monospace";
    ctx.fillText("REAL ZONE = server/gameplay contour | LOCAL VFX = client-only shell with LOD", 18, 26);
    ctx.fillText("Current LOD: " + getLodKey().toUpperCase() + " | distance " + state.distance + " | stress " + state.stress, 18, 46);

    if (textEls.status) {
      textEls.status.textContent =
        "Real contour is unchanged. Local shell is client-only and gets compressed where the stronger zone dominates. " +
        "LOD: " + getLodKey().toUpperCase() + ".";
    }

    document.documentElement.style.setProperty("--accent", weakPalette.core);
  }

  function tick(now) {
    if (!tick.last) tick.last = now;
    var dt = Math.min(0.033, (now - tick.last) / 1000);
    tick.last = now;
    state.time += dt;
    state.pressurePulse = Math.max(0, state.pressurePulse - dt * 0.65);
    state.motionBurst = Math.max(0, state.motionBurst - dt * 0.45);
    render();
    requestAnimationFrame(tick);
  }

  function bindControls() {
    if (controls.palette) {
      controls.palette.addEventListener("change", function () {
        state.paletteKey = controls.palette.value;
      });
    }
    if (controls.lodMode) {
      controls.lodMode.addEventListener("change", function () {
        state.lodMode = controls.lodMode.value;
      });
    }
    if (controls.distance) {
      controls.distance.addEventListener("input", function () {
        state.distance = Number(controls.distance.value);
      });
    }
    if (controls.stress) {
      controls.stress.addEventListener("input", function () {
        state.stress = Number(controls.stress.value);
      });
    }
    if (controls.pulsePressure) {
      controls.pulsePressure.addEventListener("click", function () {
        state.pressurePulse = 1;
      });
    }
    if (controls.motionBurst) {
      controls.motionBurst.addEventListener("click", function () {
        state.motionBurst = 1;
      });
    }
  }

  function populateText() {
    if (textEls.variantTitle) textEls.variantTitle.textContent = variant.title;
    if (textEls.variantSubtitle) textEls.variantSubtitle.textContent = variant.subtitle;
    if (textEls.real) textEls.real.textContent = variant.localFormula;
    if (textEls.local) textEls.local.textContent = variant.pressureNote;
    if (textEls.ships) textEls.ships.textContent = variant.shipNote;
  }

  bindControls();
  populateText();
  makeStars();
  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(tick);
})();
