/**
 * FACTION_VISUALS — Shared color helpers for VoidFront visuals.
 * Pure data + conversion utilities; safe to reuse from any renderer.
 */
(function () {
  "use strict";

  const FACTION_VISUALS = Object.freeze({
    blue:   { core: "88,144,255", edge: "150,190,255", solid: "#72a4ff", soft: "185,220,255", line: "120,170,255" },
    red:    { core: "255,90,110", edge: "255,160,170", solid: "#ff6c7a", soft: "255,210,218", line: "255,130,150" },
    orange: { core: "255,165,70", edge: "255,214,140", solid: "#ffb14a", soft: "255,229,190", line: "255,190,90" },
    green:  { core: "80,198,124", edge: "148,230,176", solid: "#52c77b", soft: "196,238,207", line: "112,214,148" },
    purple: { core: "186,104,240", edge: "221,176,255", solid: "#b774ff", soft: "235,214,255", line: "204,150,255" },
    cyan:   { core: "86,208,214", edge: "164,236,240", solid: "#60d6dc", soft: "210,247,249", line: "118,220,228" },
    yellow: { core: "224,196,72", edge: "246,229,146", solid: "#e5cb57", soft: "250,242,192", line: "235,212,104" },
    pink:   { core: "224,116,170", edge: "244,182,214", solid: "#e780b2", soft: "251,220,234", line: "234,146,192" },
  });

  const NAMED_PALETTES = Object.freeze({
    blue:   { core: 0x4488ff, edge: 0x2266dd, solid: 0x88bbff, soft: 0x1a2d4d, glow: 0x3377ee, line: 0x78aaff },
    red:    { core: 0xcc3333, edge: 0xaa2222, solid: 0xff6666, soft: 0x3d1a1a, glow: 0xbb2222, line: 0xee6677 },
    orange: { core: 0xff8800, edge: 0xcc6600, solid: 0xffaa44, soft: 0x3d2a11, glow: 0xee7700, line: 0xffbb55 },
    green:  { core: 0x22aa44, edge: 0x118833, solid: 0x66cc88, soft: 0x1a2d1f, glow: 0x229944, line: 0x66d080 },
    purple: { core: 0xaa44cc, edge: 0x882299, solid: 0xcc88ee, soft: 0x2d1a33, glow: 0x9933bb, line: 0xc37ae2 },
    cyan:   { core: 0x44cccc, edge: 0x229999, solid: 0x88dddd, soft: 0x1a2d2d, glow: 0x33bbbb, line: 0x6dd7dc },
    yellow: { core: 0xddcc00, edge: 0xaa9900, solid: 0xeedd44, soft: 0x33301a, glow: 0xccbb00, line: 0xe5d84f },
    pink:   { core: 0xcc66aa, edge: 0xaa4488, solid: 0xee88cc, soft: 0x331a28, glow: 0xbb5599, line: 0xdf82bd },
  });

  const RESOURCE_VISUALS = Object.freeze({
    money: { solid: "#ffd16a", core: "255,209,106", soft: "255,227,168", line: "255,185,88" },
    xp:    { solid: "#75d8ff", core: "117,216,255", soft: "185,238,255", line: "110,190,255" },
  });

  const RESOURCE_COLORS = Object.freeze({
    money: { primary: 0xffaa22, secondary: 0xffe088, glow: 0xff9900, bg: 0x3d2a0a },
    xp:    { primary: 0x44ddee, secondary: 0xaaeeff, glow: 0x22ccdd, bg: 0x0a2a33 },
  });

  function clampByte(v) {
    return Math.max(0, Math.min(255, Math.round(v)));
  }

  function hexR(c) { return (c >> 16) & 0xff; }
  function hexG(c) { return (c >> 8) & 0xff; }
  function hexB(c) { return c & 0xff; }
  function rgb(r, g, b) { return ((clampByte(r) & 0xff) << 16) | ((clampByte(g) & 0xff) << 8) | (clampByte(b) & 0xff); }

  function normalizeHexString(hex) {
    const raw = String(hex == null ? "" : hex).trim().replace(/^#/, "");
    if (raw.length === 3) return raw.split("").map(function (ch) { return ch + ch; }).join("");
    return raw.padStart(6, "0").slice(0, 6);
  }

  function hexToCss(hex) {
    if (typeof hex === "number") return "#" + (hex >>> 0).toString(16).padStart(6, "0").slice(-6);
    return "#" + normalizeHexString(hex);
  }

  function hexToRgb(hex) {
    const clean = normalizeHexString(typeof hex === "number" ? hexToCss(hex) : hex);
    return {
      r: parseInt(clean.slice(0, 2), 16) || 0,
      g: parseInt(clean.slice(2, 4), 16) || 0,
      b: parseInt(clean.slice(4, 6), 16) || 0,
    };
  }

  function rgbToString(r, g, b) {
    return clampByte(r) + "," + clampByte(g) + "," + clampByte(b);
  }

  function rgbStringToObject(value) {
    if (typeof value === "number") {
      return { r: hexR(value), g: hexG(value), b: hexB(value) };
    }
    const parts = String(value == null ? "" : value).split(",").map(function (v) { return clampByte(Number(v)); });
    return {
      r: parts[0] || 0,
      g: parts[1] || 0,
      b: parts[2] || 0,
    };
  }

  function rgbStringToHex(value) {
    const rgbObj = rgbStringToObject(value);
    return rgb(rgbObj.r, rgbObj.g, rgbObj.b);
  }

  function rgbaFromHex(hex, alpha) {
    const rgbObj = hexToRgb(hex);
    const a = alpha == null ? 1 : alpha;
    return "rgba(" + rgbObj.r + "," + rgbObj.g + "," + rgbObj.b + "," + a + ")";
  }

  function rgbaFromRgbString(value, alpha) {
    const rgbObj = rgbStringToObject(value);
    const a = alpha == null ? 1 : alpha;
    return "rgba(" + rgbObj.r + "," + rgbObj.g + "," + rgbObj.b + "," + a + ")";
  }

  function darken(c, factor) {
    return rgb(
      hexR(c) * factor,
      hexG(c) * factor,
      hexB(c) * factor
    );
  }

  function lighten(c, amount) {
    return rgb(
      hexR(c) + amount,
      hexG(c) + amount,
      hexB(c) + amount
    );
  }

  function desaturate(c, factor) {
    const r = hexR(c), g = hexG(c), b = hexB(c);
    const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
    const f = 1 - factor;
    return rgb(
      r * f + gray * factor,
      g * f + gray * factor,
      b * f + gray * factor
    );
  }

  function colorDistance(a, b) {
    const dr = hexR(a) - hexR(b);
    const dg = hexG(a) - hexG(b);
    const db = hexB(a) - hexB(b);
    return dr * dr + dg * dg + db * db;
  }

  function getClosestNamedKey(playerColor) {
    if (playerColor == null) return "blue";
    let bestKey = "blue";
    let bestDist = Infinity;
    for (const key in NAMED_PALETTES) {
      const d = colorDistance(playerColor, NAMED_PALETTES[key].core);
      if (d < bestDist) {
        bestDist = d;
        bestKey = key;
      }
    }
    return bestKey;
  }

  function buildAutoVisuals(playerColor) {
    const core = playerColor >>> 0;
    const edge = lighten(darken(core, 0.82), 18);
    const line = lighten(core, 28);
    const soft = lighten(desaturate(core, 0.3), 90);
    return {
      core: rgbToString(hexR(core), hexG(core), hexB(core)),
      edge: rgbToString(hexR(edge), hexG(edge), hexB(edge)),
      solid: hexToCss(lighten(core, 20)),
      soft: rgbToString(hexR(soft), hexG(soft), hexB(soft)),
      line: rgbToString(hexR(line), hexG(line), hexB(line)),
    };
  }

  function getFactionKey(playerColor) {
    return getClosestNamedKey(playerColor);
  }

  function getFactionVisuals(playerColor) {
    if (playerColor == null) return FACTION_VISUALS.blue;
    const key = getClosestNamedKey(playerColor);
    if (colorDistance(playerColor, NAMED_PALETTES[key].core) < 12000) return FACTION_VISUALS[key];
    return buildAutoVisuals(playerColor);
  }

  /**
   * Returns the numeric PIXI-friendly palette used by the current renderers.
   * This intentionally preserves existing visuals while the new string-based
   * visual language is phased in incrementally.
   */
  function getFactionPalette(playerColor) {
    if (playerColor == null) return NAMED_PALETTES.blue;

    const key = getClosestNamedKey(playerColor);
    if (colorDistance(playerColor, NAMED_PALETTES[key].core) < 12000) return NAMED_PALETTES[key];

    return {
      core: playerColor,
      edge: darken(playerColor, 0.7),
      solid: lighten(playerColor, 60),
      soft: darken(desaturate(playerColor, 0.5), 0.25),
      glow: darken(playerColor, 0.85),
      line: lighten(playerColor, 40),
    };
  }

  function getResourceVisual(type) {
    return RESOURCE_VISUALS[type] || RESOURCE_VISUALS.money;
  }

  function getResourceColors(type) {
    return RESOURCE_COLORS[type] || RESOURCE_COLORS.money;
  }

  const FACTION_VIS = {
    FACTION_VISUALS,
    NAMED_PALETTES,
    RESOURCE_VISUALS,
    RESOURCE_COLORS,
    getFactionKey,
    getFactionVisuals,
    getFactionPalette,
    getResourceVisual,
    getResourceColors,
    hexToCss,
    hexToRgb,
    rgbToString,
    rgbStringToObject,
    rgbStringToHex,
    rgbaFromHex,
    rgbaFromRgbString,
    darken,
    lighten,
    desaturate,
    hexR, hexG, hexB, rgb,
  };

  if (typeof window !== "undefined") window.FACTION_VIS = FACTION_VIS;
  if (typeof module !== "undefined") module.exports = FACTION_VIS;
})();
