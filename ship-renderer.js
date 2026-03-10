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

    if (!detail.fullShape) {
      // FAR LOD: simple triangle dot
      g.poly([s * 1.2, 0, -s * 0.5, -s * 0.5, -s * 0.5, s * 0.5]);
      g.fill({ color: fillCol, alpha: 0.8 });
      return;
    }

    var accentColor = palette ? palette.solid : 0xffffff;

    if (unitType === "fighter") {
      // Compact swept-wing
      g.poly([s * 1.8, 0, s * 0.2, -s * 0.55, -s * 0.7, -s * 0.75, -s * 0.35, 0, -s * 0.7, s * 0.75, s * 0.2, s * 0.55]);
      g.fill({ color: fillCol, alpha: 0.9 });
      g.moveTo(s * 1.8, 0); g.lineTo(-s * 0.05, 0);
      g.stroke({ color: accentColor, width: 0.8, alpha: 0.45 });
    } else if (unitType === "destroyer") {
      // Angular hull with side sponsons
      g.poly([s * 2, 0, s * 0.6, -s * 0.45, -s * 0.2, -s * 0.85, -s * 0.8, -s * 0.55, -s * 0.9, -s * 0.2,
              -s * 0.9, s * 0.2, -s * 0.8, s * 0.55, -s * 0.2, s * 0.85, s * 0.6, s * 0.45]);
      g.fill({ color: fillCol, alpha: 0.9 });
      g.moveTo(s * 2, 0); g.lineTo(-s * 0.15, 0);
      g.stroke({ color: accentColor, width: 1.0, alpha: 0.45 });
      // Sponson accents
      g.moveTo(s * 0.3, -s * 0.55); g.lineTo(-s * 0.4, -s * 0.55);
      g.stroke({ color: accentColor, width: 0.7, alpha: 0.3 });
      g.moveTo(s * 0.3, s * 0.55); g.lineTo(-s * 0.4, s * 0.55);
      g.stroke({ color: accentColor, width: 0.7, alpha: 0.3 });
    } else if (unitType === "cruiser") {
      // Broad armored hull
      g.poly([s * 2, 0, s * 0.7, -s * 0.5, 0, -s * 0.9, -s * 0.6, -s * 1.0, -s * 1.0, -s * 0.65,
              -s * 1.0, s * 0.65, -s * 0.6, s * 1.0, 0, s * 0.9, s * 0.7, s * 0.5]);
      g.fill({ color: fillCol, alpha: 0.9 });
      g.moveTo(s * 2, 0); g.lineTo(-s * 0.25, 0);
      g.stroke({ color: accentColor, width: 1.2, alpha: 0.45 });
      // Weapon arrays
      g.moveTo(0.15 * s, -s * 0.65); g.lineTo(-s * 0.6, -s * 0.65);
      g.stroke({ color: accentColor, width: 0.8, alpha: 0.3 });
      g.moveTo(0.15 * s, s * 0.65); g.lineTo(-s * 0.6, s * 0.65);
      g.stroke({ color: accentColor, width: 0.8, alpha: 0.3 });
    } else if (unitType === "battleship") {
      // Massive wedge with command bridge
      g.poly([s * 2.2, 0, s * 1.0, -s * 0.55, 0.1 * s, -s * 1.05, -s * 0.5, -s * 1.1, -s * 1.1, -s * 0.75,
              -s * 1.1, s * 0.75, -s * 0.5, s * 1.1, 0.1 * s, s * 1.05, s * 1.0, s * 0.55]);
      g.fill({ color: fillCol, alpha: 0.9 });
      g.moveTo(s * 2.2, 0); g.lineTo(-s * 0.3, 0);
      g.stroke({ color: accentColor, width: 1.5, alpha: 0.45 });
      // Command bridge
      g.circle(0, 0, s * 0.22);
      g.fill({ color: accentColor, alpha: 0.25 });
    } else if (unitType === "hyperDestroyer") {
      // Largest: broad dreadnought with energy core
      g.poly([s * 2.5, 0, s * 1.2, -s * 0.5, s * 0.3, -s * 1.15, -s * 0.5, -s * 1.2, -s * 1.0, -s * 0.9,
              -s * 1.2, -s * 0.35, -s * 1.2, s * 0.35, -s * 1.0, s * 0.9, -s * 0.5, s * 1.2,
              s * 0.3, s * 1.15, s * 1.2, s * 0.5]);
      g.fill({ color: fillCol, alpha: 0.9 });
      g.moveTo(s * 2.5, 0); g.lineTo(-s * 0.4, 0);
      g.stroke({ color: accentColor, width: 1.8, alpha: 0.45 });
      // Energy core
      var coreColor = palette ? palette.glow : 0x66ccff;
      g.circle(0, 0, s * 0.32);
      g.fill({ color: coreColor, alpha: 0.45 });
      g.circle(s * 0.8, 0, s * 0.14);
      g.fill({ color: coreColor, alpha: 0.35 });
    } else {
      g.poly([s * 2, 0, -s, -s, -s, s]);
      g.fill({ color: fillCol, alpha: 0.9 });
      g.moveTo(s * 2, 0); g.lineTo(-s * 0.3, 0);
      g.stroke({ color: accentColor, width: 1, alpha: 0.5 });
    }
  }

  var ShipRenderer = {
    drawShape: drawShape,
    getShipSize: getShipSize,
    UNIT_SIZE: UNIT_SIZE,
  };

  if (typeof window !== "undefined") window.ShipRenderer = ShipRenderer;
  if (typeof module !== "undefined") module.exports = ShipRenderer;
})();
