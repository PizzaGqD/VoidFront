/**
 * NOISE — Procedural noise for VoidFront map generation.
 * Pure functions: hash, value noise, fractal Brownian motion.
 * No game state, no DOM, no side effects.
 */
(function () {
  "use strict";

  function hash2(ix, iy, seed) {
    let x = ix | 0, y = iy | 0;
    let h = seed ^ (x * 374761393) ^ (y * 668265263);
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  const smoothstep = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;

  function valueNoise(x, y, freq, seed) {
    const fx = x * freq;
    const fy = y * freq;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = smoothstep(fx - x0);
    const ty = smoothstep(fy - y0);

    const v00 = hash2(x0, y0, seed);
    const v10 = hash2(x0 + 1, y0, seed);
    const v01 = hash2(x0, y0 + 1, seed);
    const v11 = hash2(x0 + 1, y0 + 1, seed);

    const a = lerp(v00, v10, tx);
    const b = lerp(v01, v11, tx);
    return lerp(a, b, ty);
  }

  function fbm(x, y, seed) {
    let a = 0.5;
    let f = 1.0;
    let sum = 0;
    let nrm = 0;
    for (let i = 0; i < 5; i++) {
      const n = valueNoise(x, y, 0.0022 * f, seed + i * 1337);
      sum += n * a;
      nrm += a;
      a *= 0.55;
      f *= 2.05;
    }
    return sum / nrm;
  }

  const NOISE = { hash2, smoothstep, lerp, valueNoise, fbm };

  if (typeof window !== "undefined") window.NOISE = NOISE;
  if (typeof module !== "undefined") module.exports = NOISE;
})();
