/**
 * UTILS — Pure math, color, and geometry helpers for VoidFront.
 * No game state, no DOM, no side effects.
 */
(function () {
  "use strict";

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const rand = (a, b) => Math.random() * (b - a) + a;

  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5) >>> 0;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      return ((t ^ (t >>> 22)) >>> 0) / 4294967296;
    };
  }

  function hslToHex(h, s, l) {
    h /= 360;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    const r = Math.round(f(0) * 255), g = Math.round(f(8) * 255), b = Math.round(f(4) * 255);
    return (r << 16) | (g << 8) | b;
  }

  function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return {
      r: Math.round(255 * f(0)),
      g: Math.round(255 * f(8)),
      b: Math.round(255 * f(4))
    };
  }

  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };

  const norm = (dx, dy) => {
    const l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  };

  function isPointInPolygon(px, py, polygon) {
    if (!polygon || polygon.length < 3) return false;
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  function polygonArea(polygon) {
    if (!polygon || polygon.length < 3) return 0;
    let area = 0;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      area += polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
    }
    return Math.abs(area) * 0.5;
  }

  const UTILS = {
    clamp, rand, mulberry32,
    hslToHex, hslToRgb,
    dist2, norm,
    isPointInPolygon, polygonArea
  };

  if (typeof window !== "undefined") window.UTILS = UTILS;
  if (typeof module !== "undefined") module.exports = UTILS;
})();
