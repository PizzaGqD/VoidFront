/**
 * FACTION_VISUALS — Color palette system for VoidFront factions.
 * Each faction has: core, edge, solid, soft colors for consistent tactical sci-fi look.
 * Pure data + helper functions. No game state, no DOM, no PIXI dependency.
 */
(function () {
  "use strict";

  const NAMED_PALETTES = {
    blue:   { core: 0x4488ff, edge: 0x2266dd, solid: 0x88bbff, soft: 0x1a2d4d, glow: 0x3377ee },
    red:    { core: 0xcc3333, edge: 0xaa2222, solid: 0xff6666, soft: 0x3d1a1a, glow: 0xbb2222 },
    orange: { core: 0xff8800, edge: 0xcc6600, solid: 0xffaa44, soft: 0x3d2a11, glow: 0xee7700 },
    green:  { core: 0x22aa44, edge: 0x118833, solid: 0x66cc88, soft: 0x1a2d1f, glow: 0x229944 },
    purple: { core: 0xaa44cc, edge: 0x882299, solid: 0xcc88ee, soft: 0x2d1a33, glow: 0x9933bb },
    cyan:   { core: 0x44cccc, edge: 0x229999, solid: 0x88dddd, soft: 0x1a2d2d, glow: 0x33bbbb },
    yellow: { core: 0xddcc00, edge: 0xaa9900, solid: 0xeedd44, soft: 0x33301a, glow: 0xccbb00 },
    pink:   { core: 0xcc66aa, edge: 0xaa4488, solid: 0xee88cc, soft: 0x331a28, glow: 0xbb5599 },
  };

  function hexR(c) { return (c >> 16) & 0xff; }
  function hexG(c) { return (c >> 8) & 0xff; }
  function hexB(c) { return c & 0xff; }
  function rgb(r, g, b) { return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff); }

  function darken(c, factor) {
    return rgb(
      Math.round(hexR(c) * factor),
      Math.round(hexG(c) * factor),
      Math.round(hexB(c) * factor)
    );
  }

  function lighten(c, amount) {
    return rgb(
      Math.min(255, hexR(c) + amount),
      Math.min(255, hexG(c) + amount),
      Math.min(255, hexB(c) + amount)
    );
  }

  function desaturate(c, factor) {
    const r = hexR(c), g = hexG(c), b = hexB(c);
    const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
    const f = 1 - factor;
    return rgb(
      Math.round(r * f + gray * factor),
      Math.round(g * f + gray * factor),
      Math.round(b * f + gray * factor)
    );
  }

  function colorDistance(a, b) {
    const dr = hexR(a) - hexR(b);
    const dg = hexG(a) - hexG(b);
    const db = hexB(a) - hexB(b);
    return dr * dr + dg * dg + db * db;
  }

  /**
   * Get the closest named palette for a given hex color.
   * Falls back to auto-generating a palette from the raw color.
   */
  function getFactionPalette(playerColor) {
    if (playerColor == null) return NAMED_PALETTES.blue;

    let bestKey = null;
    let bestDist = Infinity;
    for (const key in NAMED_PALETTES) {
      const d = colorDistance(playerColor, NAMED_PALETTES[key].core);
      if (d < bestDist) { bestDist = d; bestKey = key; }
    }

    if (bestDist < 12000) return NAMED_PALETTES[bestKey];

    return {
      core: playerColor,
      edge: darken(playerColor, 0.7),
      solid: lighten(playerColor, 60),
      soft: darken(desaturate(playerColor, 0.5), 0.25),
      glow: darken(playerColor, 0.85),
    };
  }

  const RESOURCE_COLORS = {
    money: { primary: 0xffaa22, secondary: 0xffe088, glow: 0xff9900, bg: 0x3d2a0a },
    xp:    { primary: 0x44ddee, secondary: 0xaaeeff, glow: 0x22ccdd, bg: 0x0a2a33 },
  };

  const FACTION_VIS = {
    NAMED_PALETTES,
    RESOURCE_COLORS,
    getFactionPalette,
    darken,
    lighten,
    desaturate,
    hexR, hexG, hexB, rgb,
  };

  if (typeof window !== "undefined") window.FACTION_VIS = FACTION_VIS;
  if (typeof module !== "undefined") module.exports = FACTION_VIS;
})();
