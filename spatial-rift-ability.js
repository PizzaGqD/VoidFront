(function () {
  "use strict";

  var Common = (typeof window !== "undefined" && window.AbilityVfxCommon) ? window.AbilityVfxCommon : null;

  var STYLE_KEY = "parallax-gash";
  var PALETTE_KEY = "violet";
  var VARIANT = {
    key: STYLE_KEY,
    name: "Parallax Gash",
    profile: [0, -0.38, -0.22, -0.08, 0.04, 0.18, 0.20, 0.06, 0],
    widthMul: 1.08,
    tendrils: 13,
    debris: 24,
    innerStars: 34,
    haloMul: 1.28,
    sparkMul: 1.32
  };

  var TIMELINE_SCALE = 3.0;
  var DURATION_SEC = 7.8 * TIMELINE_SCALE;
  var RADIUS = 180;
  var LENGTH = 760;
  var DAMAGE_FLAT = 5;
  var DAMAGE_MAX_HP_PCT = 0.50;
  var COLLAPSE_AT_SEC = 6.05 * TIMELINE_SCALE;
  var COLLAPSE_NODE_SPACING = 84;

  function clamp01(v) {
    if (Common && typeof Common.clamp01 === "function") return Common.clamp01(v);
    return Math.max(0, Math.min(1, v));
  }

  function lerp(a, b, t) {
    if (Common && typeof Common.lerp === "function") return Common.lerp(a, b, t);
    return a + (b - a) * t;
  }

  function smoothstep(a, b, v) {
    if (Common && typeof Common.smoothstep === "function") return Common.smoothstep(a, b, v);
    var t = clamp01((v - a) / Math.max(0.0001, b - a));
    return t * t * (3 - 2 * t);
  }

  function getSeed(x, y, angle, ownerId) {
    var sx = Math.round((x || 0) * 10);
    var sy = Math.round((y || 0) * 10);
    var sa = Math.round(((angle || 0) * 1000));
    var so = Math.round(ownerId || 0);
    return ((sx * 73856093) ^ (sy * 19349663) ^ (sa * 83492791) ^ (so * 2654435761)) >>> 0;
  }

  function buildGeom(x, y, angle, radius, length) {
    return {
      centerX: x,
      centerY: y,
      angle: angle || 0,
      radius: Math.max(40, radius || RADIUS),
      length: Math.max(120, length || LENGTH)
    };
  }

  function buildTimeline(elapsedSec) {
    var loop = Math.max(0, Math.min(DURATION_SEC, elapsedSec || 0));
    var s = TIMELINE_SCALE;
    var openSparkT = clamp01((loop - 0.00 * s) / (0.95 * s));
    var openSparkK = 1 - smoothstep(0.92 * s, 1.16 * s, loop);
    var openRevealT = clamp01((loop - 0.98 * s) / (1.18 * s));
    var openK = smoothstep(0.98 * s, 2.06 * s, loop);
    var activeK = openK * (1 - smoothstep(5.65 * s, 6.45 * s, loop));
    var pulseK = smoothstep(4.85 * s, 5.45 * s, loop) * (1 - smoothstep(5.75 * s, 6.20 * s, loop));
    var closeSparkT = clamp01((loop - 5.55 * s) / (0.92 * s));
    var closeSparkK = smoothstep(5.42 * s, 5.66 * s, loop) * (1 - smoothstep(6.42 * s, 6.70 * s, loop));
    var foldK = smoothstep(5.95 * s, 6.28 * s, loop) * (1 - smoothstep(6.95 * s, 7.40 * s, loop));
    var flashK = smoothstep(6.05 * s, 6.28 * s, loop) * (1 - smoothstep(6.28 * s, 6.70 * s, loop));
    return {
      loop: loop,
      openSparkT: openSparkT,
      openSparkK: openSparkK,
      openRevealT: openRevealT,
      openK: openK,
      activeK: activeK,
      pulseK: pulseK,
      closeSparkT: closeSparkT,
      closeSparkK: closeSparkK,
      foldK: foldK,
      flashK: flashK
    };
  }

  function buildCenterline(geom, variant) {
    var points = [];
    var dirX = Math.cos(geom.angle);
    var dirY = Math.sin(geom.angle);
    var nx = -dirY;
    var ny = dirX;
    var profile = (variant && variant.profile) || VARIANT.profile;
    for (var i = 0; i < profile.length; i++) {
      var t = profile.length <= 1 ? 0 : i / (profile.length - 1);
      var along = (t - 0.5) * geom.length;
      var side = geom.radius * profile[i] * 0.76;
      points.push({
        x: geom.centerX + dirX * along + nx * side,
        y: geom.centerY + dirY * along + ny * side,
        t: t
      });
    }
    return points;
  }

  function sampleLine(points, subdivisions) {
    var out = [];
    if (!Array.isArray(points) || points.length === 0) return out;
    var segs = Math.max(1, points.length - 1);
    var divs = Math.max(1, subdivisions || 1);
    for (var i = 0; i < segs; i++) {
      var a = points[i];
      var b = points[i + 1];
      for (var s = 0; s < divs; s++) {
        var localT = s / divs;
        out.push({
          x: lerp(a.x, b.x, localT),
          y: lerp(a.y, b.y, localT),
          t: (i + localT) / segs
        });
      }
    }
    out.push({
      x: points[points.length - 1].x,
      y: points[points.length - 1].y,
      t: 1
    });
    return out;
  }

  function getLinePoint(points, t) {
    if (!Array.isArray(points) || points.length === 0) return { x: 0, y: 0, t: 0 };
    if (points.length === 1) return { x: points[0].x, y: points[0].y, t: clamp01(t) };
    var scaled = clamp01(t) * (points.length - 1);
    var idx = Math.min(points.length - 2, Math.floor(scaled));
    var localT = scaled - idx;
    return {
      x: lerp(points[idx].x, points[idx + 1].x, localT),
      y: lerp(points[idx].y, points[idx + 1].y, localT),
      t: clamp01(t)
    };
  }

  function getLineTangent(points, t) {
    var a = getLinePoint(points, Math.max(0, clamp01(t) - 0.02));
    var b = getLinePoint(points, Math.min(1, clamp01(t) + 0.02));
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  function getEndFade(t) {
    return smoothstep(0.03, 0.18, t) * (1 - smoothstep(0.82, 0.97, t));
  }

  function getVisibleHalfWidth(t, geom, variant, timeline) {
    var style = variant || VARIANT;
    var time = timeline || { openK: 1 };
    var base = geom.radius * 0.050 * (style.widthMul || 1);
    var taper = Math.pow(Math.sin(Math.PI * clamp01(t)), 0.92);
    var midBulge = 0.86 + 0.18 * Math.sin(Math.PI * t);
    var scarNoise = 0.94 + 0.14 * Math.sin(t * Math.PI * 6 + (style.widthMul || 1) * 3.7);
    return Math.max(2.2, base * (0.20 + 0.80 * taper) * midBulge * scarNoise * (0.90 + (time.openK || 0) * 0.14));
  }

  function buildWoundGeometry(geom, variant, timeline) {
    var centerline = sampleLine(buildCenterline(geom, variant), 10);
    var left = [];
    var right = [];
    var halfWidths = [];
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;

    for (var i = 0; i < centerline.length; i++) {
      var p = centerline[i];
      var tan;
      if (i === 0) tan = { x: centerline[1].x - p.x, y: centerline[1].y - p.y };
      else if (i === centerline.length - 1) tan = { x: p.x - centerline[i - 1].x, y: p.y - centerline[i - 1].y };
      else tan = { x: centerline[i + 1].x - centerline[i - 1].x, y: centerline[i + 1].y - centerline[i - 1].y };
      var len = Math.hypot(tan.x, tan.y) || 1;
      var tx = tan.x / len;
      var ty = tan.y / len;
      var nx = -ty;
      var ny = tx;
      var half = getVisibleHalfWidth(p.t, geom, variant, timeline);
      halfWidths.push(half);

      var lx = p.x + nx * half;
      var ly = p.y + ny * half;
      var rx = p.x - nx * half;
      var ry = p.y - ny * half;
      left.push({ x: lx, y: ly, t: p.t });
      right.push({ x: rx, y: ry, t: p.t });

      minX = Math.min(minX, lx, rx);
      minY = Math.min(minY, ly, ry);
      maxX = Math.max(maxX, lx, rx);
      maxY = Math.max(maxY, ly, ry);
    }

    return {
      centerline: centerline,
      left: left,
      right: right,
      polygon: left.concat(right.slice().reverse()),
      halfWidths: halfWidths,
      bounds: { minX: minX, minY: minY, maxX: maxX, maxY: maxY }
    };
  }

  function getClosestRibbonInfo(px, py, wound) {
    var bestDist = Infinity;
    var bestT = 0;
    var bestHalf = wound && wound.halfWidths && wound.halfWidths.length ? wound.halfWidths[0] : 1;
    var points = wound && wound.centerline ? wound.centerline : [];
    var segCount = Math.max(1, points.length - 1);

    for (var i = 0; i < points.length - 1; i++) {
      var a = points[i];
      var b = points[i + 1];
      var vx = b.x - a.x;
      var vy = b.y - a.y;
      var len2 = vx * vx + vy * vy;
      var localT = len2 <= 0.0001 ? 0 : ((px - a.x) * vx + (py - a.y) * vy) / len2;
      localT = clamp01(localT);
      var qx = a.x + vx * localT;
      var qy = a.y + vy * localT;
      var dx = px - qx;
      var dy = py - qy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestT = (i + localT) / segCount;
        bestHalf = lerp(wound.halfWidths[i], wound.halfWidths[i + 1], localT);
      }
    }

    return { dist: bestDist, t: bestT, half: bestHalf };
  }

  function getRiftSegmentAlpha(t, timeline) {
    var revealThreshold = 1 - ((timeline && timeline.openRevealT) || 0);
    var reveal = smoothstep(revealThreshold - 0.12, revealThreshold + 0.02, t);
    if (timeline && timeline.openK >= 0.999) reveal = 1;
    var collapse = timeline && timeline.closeSparkK > 0.001
      ? smoothstep(timeline.closeSparkT - 0.10, timeline.closeSparkT + 0.03, t)
      : 1;
    return clamp01(reveal * collapse * ((timeline && timeline.activeK) || 0));
  }

  function getCollapseNodes(geom, radius, variant) {
    var centerline = sampleLine(buildCenterline(geom, variant), 12);
    var totalLength = 0;
    for (var i = 0; i < centerline.length - 1; i++) {
      totalLength += Math.hypot(centerline[i + 1].x - centerline[i].x, centerline[i + 1].y - centerline[i].y);
    }
    var spacing = Math.max(42, Math.min(COLLAPSE_NODE_SPACING, radius * 0.52));
    var count = Math.max(5, Math.ceil(totalLength / Math.max(1, spacing)) + 1);
    var out = [];
    for (var n = 0; n < count; n++) {
      var t = count <= 1 ? 0 : n / (count - 1);
      var p = getLinePoint(centerline, t);
      out.push({
        x: p.x,
        y: p.y,
        t: t,
        radius: radius
      });
    }
    return out;
  }

  function getRenderBounds(geom, radius, variant) {
    var centerline = sampleLine(buildCenterline(geom, variant), 12);
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    for (var i = 0; i < centerline.length; i++) {
      minX = Math.min(minX, centerline[i].x);
      minY = Math.min(minY, centerline[i].y);
      maxX = Math.max(maxX, centerline[i].x);
      maxY = Math.max(maxY, centerline[i].y);
    }
    var margin = Math.max(radius + 160, 340);
    return {
      left: minX - margin,
      top: minY - margin,
      width: (maxX - minX) + margin * 2,
      height: (maxY - minY) + margin * 2
    };
  }

  function buildEffect(x, y, angle, ownerId, opts) {
    var options = opts || {};
    var radius = Math.max(40, options.radius || RADIUS);
    var length = Math.max(120, options.length || LENGTH);
    var geom = buildGeom(x, y, angle || 0, radius, length);
    return {
      type: "rift",
      styleKey: STYLE_KEY,
      paletteKey: PALETTE_KEY,
      ownerId: ownerId || 0,
      seed: options.seed != null ? options.seed : getSeed(x, y, angle || 0, ownerId || 0),
      x: x,
      y: y,
      angle: angle || 0,
      duration: Math.max(0.2, options.duration || DURATION_SEC),
      radius: radius,
      previewRadius: radius,
      length: length,
      hitFlat: options.hitFlat != null ? options.hitFlat : DAMAGE_FLAT,
      hitMaxHpPct: options.hitMaxHpPct != null ? options.hitMaxHpPct : DAMAGE_MAX_HP_PCT,
      collapseAtSec: options.collapseAtSec != null ? options.collapseAtSec : COLLAPSE_AT_SEC,
      collapseNodeRadius: options.collapseNodeRadius != null ? options.collapseNodeRadius : radius,
      collapseNodes: getCollapseNodes(geom, options.collapseNodeRadius != null ? options.collapseNodeRadius : radius, VARIANT),
      renderBounds: getRenderBounds(geom, radius, VARIANT)
    };
  }

  function buildRuntime(effect, elapsedSec) {
    var geom = buildGeom(effect.x, effect.y, effect.angle, effect.radius, effect.length);
    var timeline = buildTimeline(elapsedSec);
    var wound = buildWoundGeometry(geom, VARIANT, timeline);
    return {
      geom: geom,
      timeline: timeline,
      wound: wound,
      variant: VARIANT
    };
  }

  function getRibbonHitInfo(effect, x, y, runtime) {
    var rt = runtime || buildRuntime(effect, 0);
    var info = getClosestRibbonInfo(x, y, rt.wound);
    var life = getRiftSegmentAlpha(info.t, rt.timeline) * getEndFade(info.t);
    return {
      inside: life > 0.02 && info.dist <= info.half * 1.18,
      dist: info.dist,
      half: info.half,
      t: info.t,
      life: life
    };
  }

  function pointInCollapse(effect, x, y) {
    var nodes = Array.isArray(effect && effect.collapseNodes) ? effect.collapseNodes : [];
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var dx = x - node.x;
      var dy = y - node.y;
      var r = Math.max(1, node.radius || effect.collapseNodeRadius || effect.radius || RADIUS);
      if (dx * dx + dy * dy <= r * r) return true;
    }
    return false;
  }

  var api = {
    STYLE_KEY: STYLE_KEY,
    PALETTE_KEY: PALETTE_KEY,
    VARIANT: VARIANT,
    DURATION_SEC: DURATION_SEC,
    TIMELINE_SCALE: TIMELINE_SCALE,
    RADIUS: RADIUS,
    LENGTH: LENGTH,
    DAMAGE_FLAT: DAMAGE_FLAT,
    DAMAGE_MAX_HP_PCT: DAMAGE_MAX_HP_PCT,
    COLLAPSE_AT_SEC: COLLAPSE_AT_SEC,
    clamp01: clamp01,
    lerp: lerp,
    smoothstep: smoothstep,
    getSeed: getSeed,
    buildGeom: buildGeom,
    buildTimeline: buildTimeline,
    buildCenterline: buildCenterline,
    sampleLine: sampleLine,
    getLinePoint: getLinePoint,
    getLineTangent: getLineTangent,
    getEndFade: getEndFade,
    getVisibleHalfWidth: getVisibleHalfWidth,
    buildWoundGeometry: buildWoundGeometry,
    getClosestRibbonInfo: getClosestRibbonInfo,
    getRiftSegmentAlpha: getRiftSegmentAlpha,
    getCollapseNodes: getCollapseNodes,
    getRenderBounds: getRenderBounds,
    buildRuntime: buildRuntime,
    buildEffect: buildEffect,
    getRibbonHitInfo: getRibbonHitInfo,
    pointInCollapse: pointInCollapse
  };

  if (typeof window !== "undefined") window.SpatialRiftAbility = api;
  if (typeof module !== "undefined") module.exports = api;
})();
