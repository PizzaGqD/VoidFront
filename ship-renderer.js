/**
 * ShipRenderer — Clean tactical sci-fi top-down ship silhouettes for VoidFront.
 * 5 ship types with distinct silhouettes readable at RTS scale.
 *
 * Depends on: PIXI, FACTION_VIS, LOD (all on window).
 */
(function () {
  "use strict";

  var UNIT_SIZE = {
    fighter:        { mul: 1.0,  base: 12 },
    destroyer:      { mul: 2.5,  base: 12 },
    cruiser:        { mul: 4.0,  base: 12 },
    battleship:     { mul: 6.0,  base: 12 },
    hyperDestroyer: { mul: 8.0,  base: 12 },
  };

  function getShipSize(unitType) {
    var cfg = UNIT_SIZE[unitType] || UNIT_SIZE.fighter;
    return cfg.mul * 6 + 6;
  }

  function scaledPoints(points, scale) {
    var out = [];
    for (var i = 0; i < points.length; i++) {
      out.push(points[i][0] * scale, points[i][1] * scale);
    }
    return out;
  }

  function drawPoly(g, points, fillColor, fillAlpha, strokeColor, strokeWidth, strokeAlpha) {
    g.poly(points);
    g.fill({ color: fillColor, alpha: fillAlpha });
    if (strokeColor != null && strokeWidth > 0) {
      g.poly(points);
      g.stroke({ color: strokeColor, width: strokeWidth, alpha: strokeAlpha });
    }
  }

  function getHullSpec(unitType) {
    if (unitType === "fighter") {
      return {
        outer: [[2.05, 0], [0.65, -0.44], [-0.30, -0.78], [-0.06, 0], [-0.30, 0.78], [0.65, 0.44]],
        inner: [[1.22, 0], [0.34, -0.24], [-0.14, -0.46], [0.02, 0], [-0.14, 0.46], [0.34, 0.24]],
        spineFrom: [1.35, 0], spineTo: [-0.10, 0], accent: [[0.16, -0.30], [0.16, 0.30]],
        bridge: [0.38, 0], bridgeR: 0.16
      };
    }
    if (unitType === "destroyer") {
      return {
        outer: [[2.15, 0], [0.95, -0.42], [0.10, -0.86], [-0.76, -0.72], [-1.06, -0.22], [-1.06, 0.22], [-0.76, 0.72], [0.10, 0.86], [0.95, 0.42]],
        inner: [[1.36, 0], [0.48, -0.24], [-0.06, -0.52], [-0.56, -0.40], [-0.76, -0.14], [-0.76, 0.14], [-0.56, 0.40], [-0.06, 0.52], [0.48, 0.24]],
        spineFrom: [1.42, 0], spineTo: [-0.34, 0], accent: [[0.28, -0.50], [-0.48, -0.50], [0.28, 0.50], [-0.48, 0.50]],
        bridge: [0.28, 0], bridgeR: 0.17
      };
    }
    if (unitType === "cruiser") {
      return {
        outer: [[2.22, 0], [1.02, -0.50], [0.20, -0.96], [-0.52, -1.04], [-1.08, -0.68], [-1.28, -0.18], [-1.28, 0.18], [-1.08, 0.68], [-0.52, 1.04], [0.20, 0.96], [1.02, 0.50]],
        inner: [[1.46, 0], [0.58, -0.28], [0.02, -0.62], [-0.44, -0.66], [-0.84, -0.44], [-0.98, -0.12], [-0.98, 0.12], [-0.84, 0.44], [-0.44, 0.66], [0.02, 0.62], [0.58, 0.28]],
        spineFrom: [1.44, 0], spineTo: [-0.50, 0], accent: [[0.24, -0.62], [-0.72, -0.62], [0.24, 0.62], [-0.72, 0.62]],
        bridge: [0.20, 0], bridgeR: 0.18
      };
    }
    if (unitType === "battleship") {
      return {
        outer: [[2.34, 0], [1.16, -0.54], [0.22, -1.08], [-0.42, -1.14], [-1.08, -0.82], [-1.36, -0.30], [-1.36, 0.30], [-1.08, 0.82], [-0.42, 1.14], [0.22, 1.08], [1.16, 0.54]],
        inner: [[1.54, 0], [0.66, -0.30], [0.06, -0.70], [-0.34, -0.76], [-0.82, -0.56], [-1.02, -0.18], [-1.02, 0.18], [-0.82, 0.56], [-0.34, 0.76], [0.06, 0.70], [0.66, 0.30]],
        spineFrom: [1.56, 0], spineTo: [-0.62, 0], accent: [[0.16, -0.72], [-0.82, -0.72], [0.16, 0.72], [-0.82, 0.72]],
        bridge: [0.10, 0], bridgeR: 0.20
      };
    }
    if (unitType === "hyperDestroyer") {
      return {
        outer: [[2.52, 0], [1.26, -0.52], [0.36, -1.18], [-0.34, -1.28], [-0.98, -0.98], [-1.32, -0.44], [-1.42, -0.12], [-1.42, 0.12], [-1.32, 0.44], [-0.98, 0.98], [-0.34, 1.28], [0.36, 1.18], [1.26, 0.52]],
        inner: [[1.70, 0], [0.78, -0.28], [0.18, -0.78], [-0.24, -0.90], [-0.74, -0.68], [-0.98, -0.26], [-1.06, -0.08], [-1.06, 0.08], [-0.98, 0.26], [-0.74, 0.68], [-0.24, 0.90], [0.18, 0.78], [0.78, 0.28]],
        spineFrom: [1.72, 0], spineTo: [-0.72, 0], accent: [[0.30, -0.82], [-0.86, -0.82], [0.30, 0.82], [-0.86, 0.82]],
        bridge: [0.16, 0], bridgeR: 0.22,
        core: [0.62, 0], coreR: 0.16
      };
    }
    return {
      outer: [[2.0, 0], [-1.0, -0.8], [-1.0, 0.8]],
      inner: [[1.1, 0], [-0.5, -0.36], [-0.5, 0.36]],
      spineFrom: [1.2, 0], spineTo: [-0.2, 0], accent: null,
      bridge: [0.24, 0], bridgeR: 0.16
    };
  }

  /**
   * Draw a ship silhouette into a Graphics object.
   * @param {PIXI.Graphics} g - target (not cleared — caller does that)
   * @param {string} unitType - fighter/destroyer/cruiser/battleship/hyperDestroyer
   * @param {number} color - faction color hex
   * @param {number} [highlight] - optional highlight override color
   * @param {number} [zoom] - camera zoom for LOD
   */
  function drawShape(g, unitType, color, highlight, zoom) {
    var s = getShipSize(unitType);
    var fillCol = highlight || color;
    var detail = (typeof LOD !== "undefined") ? LOD.getDetail("ship", zoom || 0.22) : { fullShape: true, glow: false };
    var palette = (typeof FACTION_VIS !== "undefined") ? FACTION_VIS.getFactionPalette(color) : null;
    var shellColor = 0x09111d;
    var edgeColor = palette ? palette.edge : 0xaac8ff;
    var accentColor = palette ? palette.solid : 0xffffff;
    var glowColor = palette ? palette.glow : color;
    var spec = getHullSpec(unitType);

    if (!detail.fullShape) {
      drawPoly(g, [s * 1.15, 0, -s * 0.45, -s * 0.44, -s * 0.45, s * 0.44], fillCol, 0.76, null, 0, 0);
      g.circle(s * 0.10, 0, Math.max(1.1, s * 0.11));
      g.fill({ color: 0xffffff, alpha: 0.65 });
      return;
    }

    if (detail.glow) {
      g.circle(0, 0, s * 1.55);
      g.fill({ color: glowColor, alpha: 0.06 });
    }

    drawPoly(g, scaledPoints(spec.outer, s), shellColor, 0.92, edgeColor, 1.0, 0.20);
    drawPoly(g, scaledPoints(spec.inner, s), fillCol, 0.82, accentColor, 0.8, 0.24);

    g.moveTo(spec.spineFrom[0] * s, spec.spineFrom[1] * s);
    g.lineTo(spec.spineTo[0] * s, spec.spineTo[1] * s);
    g.stroke({ color: accentColor, width: 0.9, alpha: 0.42 });

    if (spec.accent) {
      for (var i = 0; i < spec.accent.length; i += 2) {
        g.moveTo(spec.accent[i][0] * s, spec.accent[i][1] * s);
        g.lineTo(spec.accent[i + 1][0] * s, spec.accent[i + 1][1] * s);
        g.stroke({ color: accentColor, width: 0.7, alpha: 0.26 });
      }
    }

    if (spec.core) {
      g.circle(spec.core[0] * s, spec.core[1] * s, spec.coreR * s);
      g.fill({ color: glowColor, alpha: 0.36 });
    }

    g.circle(spec.bridge[0] * s, spec.bridge[1] * s, Math.max(1.4, spec.bridgeR * s));
    g.fill({ color: 0xffffff, alpha: 0.84 });
  }

  var ShipRenderer = {
    drawShape: drawShape,
    getShipSize: getShipSize,
    UNIT_SIZE: UNIT_SIZE,
  };

  if (typeof window !== "undefined") window.ShipRenderer = ShipRenderer;
  if (typeof module !== "undefined") module.exports = ShipRenderer;
})();
