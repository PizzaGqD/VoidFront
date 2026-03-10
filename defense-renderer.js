/**
 * DefenseRenderer — Clean sci-fi turret and patrol visuals for VoidFront.
 * Provides shape drawing functions used by client.js drawTurrets / patrol code.
 *
 * Depends on: PIXI, FACTION_VIS, LOD (all on window).
 */
(function () {
  "use strict";

  /**
   * Draw a turret shape (diamond with direction barrel) into a Graphics object.
   * @param {PIXI.Graphics} g - target graphics (already cleared)
   * @param {number} x - world x
   * @param {number} y - world y
   * @param {number} nx - outward normal x (direction turret faces)
   * @param {number} ny - outward normal y
   * @param {number} color - faction color hex
   * @param {number} zoom - current camera zoom
   */
  function drawTurretShape(g, x, y, nx, ny, color, zoom) {
    var palette = FACTION_VIS.getFactionPalette(color);
    var detail = LOD.getDetail("turret", zoom);
    var sz = 7;

    if (detail.shape === "dot") {
      g.beginFill(palette.core, 0.8);
      g.drawCircle(x, y, 4);
      g.endFill();
      return;
    }

    // Diamond shape
    var perpX = -ny, perpY = nx;
    g.beginFill(palette.core, 0.85);
    g.moveTo(x + nx * sz * 1.4, y + ny * sz * 1.4);
    g.lineTo(x + perpX * sz * 0.7, y + perpY * sz * 0.7);
    g.lineTo(x - nx * sz * 0.8, y - ny * sz * 0.8);
    g.lineTo(x - perpX * sz * 0.7, y - perpY * sz * 0.7);
    g.closePath();
    g.endFill();

    // Direction barrel
    g.lineStyle(1.5, palette.solid, 0.6);
    g.moveTo(x, y);
    g.lineTo(x + nx * sz * 2.2, y + ny * sz * 2.2);

    // Edge highlight
    g.lineStyle(1.0, palette.edge, 0.35);
    g.moveTo(x + nx * sz * 1.4, y + ny * sz * 1.4);
    g.lineTo(x + perpX * sz * 0.7, y + perpY * sz * 0.7);
    g.lineTo(x - nx * sz * 0.8, y - ny * sz * 0.8);
    g.lineTo(x - perpX * sz * 0.7, y - perpY * sz * 0.7);
    g.closePath();
  }

  /**
   * Draw turret attack radius as a dashed segmented circle overlay.
   * @param {PIXI.Graphics} g - target graphics (already cleared)
   * @param {number} x - world x
   * @param {number} y - world y
   * @param {number} radius - attack radius
   * @param {number} color - faction color hex
   * @param {number} zoom - camera zoom
   */
  function drawTurretRadius(g, x, y, radius, color, zoom) {
    var detail = LOD.getDetail("turret", zoom);
    if (!detail.radiusOverlay) return;

    var palette = FACTION_VIS.getFactionPalette(color);

    // Subtle fill
    g.beginFill(palette.core, 0.04);
    g.drawCircle(x, y, radius);
    g.endFill();

    // Dashed circle
    var segments = 24;
    var dashArc = (Math.PI * 2) / segments * 0.6;
    var gapArc = (Math.PI * 2) / segments * 0.4;
    g.lineStyle(1.0, palette.edge, 0.18);
    for (var i = 0; i < segments; i++) {
      var startAngle = i * (Math.PI * 2) / segments;
      var endAngle = startAngle + dashArc;
      g.moveTo(x + Math.cos(startAngle) * radius, y + Math.sin(startAngle) * radius);
      var steps = 4;
      for (var s = 1; s <= steps; s++) {
        var a = startAngle + (endAngle - startAngle) * (s / steps);
        g.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
      }
    }
  }

  /**
   * Draw a patrol unit shape.
   * @param {PIXI.Graphics} g
   * @param {number} x
   * @param {number} y
   * @param {number} angle - direction of movement
   * @param {number} color - faction color
   * @param {number} zoom
   */
  function drawPatrolShape(g, x, y, angle, color, zoom) {
    var detail = LOD.getDetail("patrol", zoom);
    if (!detail.shape) return;

    var palette = FACTION_VIS.getFactionPalette(color);
    var sz = 5;
    var cos = Math.cos(angle), sin = Math.sin(angle);

    // Small arrow/diamond
    g.beginFill(palette.core, 0.7);
    g.moveTo(x + cos * sz * 1.8, y + sin * sz * 1.8);
    g.lineTo(x + (-sin) * sz * 0.7, y + cos * sz * 0.7);
    g.lineTo(x - cos * sz * 1.0, y - sin * sz * 1.0);
    g.lineTo(x - (-sin) * sz * 0.7, y - cos * sz * 0.7);
    g.closePath();
    g.endFill();

    g.lineStyle(0.8, palette.solid, 0.4);
    g.moveTo(x + cos * sz * 1.8, y + sin * sz * 1.8);
    g.lineTo(x + (-sin) * sz * 0.7, y + cos * sz * 0.7);
    g.lineTo(x - cos * sz * 1.0, y - sin * sz * 1.0);
    g.lineTo(x - (-sin) * sz * 0.7, y - cos * sz * 0.7);
    g.closePath();
  }

  var DefenseRenderer = {
    drawTurretShape: drawTurretShape,
    drawTurretRadius: drawTurretRadius,
    drawPatrolShape: drawPatrolShape,
  };

  if (typeof window !== "undefined") window.DefenseRenderer = DefenseRenderer;
  if (typeof module !== "undefined") module.exports = DefenseRenderer;
})();
