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
    var sz = detail.shape === "dot" ? 4.5 : 8.5;

    if (detail.shape === "dot") {
      g.beginFill(palette.core, 0.16);
      g.drawCircle(x, y, 6.2);
      g.endFill();
      g.beginFill(palette.core, 0.85);
      g.drawCircle(x, y, sz);
      g.endFill();
      g.beginFill(0xffffff, 0.85);
      g.drawCircle(x, y, 1.6);
      g.endFill();
      return;
    }

    var perpX = -ny, perpY = nx;
    g.beginFill(palette.core, 0.10);
    g.drawCircle(x, y, sz * 1.5);
    g.endFill();

    if (detail.connectionLine) {
      g.lineStyle(1.2, palette.edge, 0.22);
      g.moveTo(x - nx * sz * 2.4, y - ny * sz * 2.4);
      g.lineTo(x - nx * sz * 0.95, y - ny * sz * 0.95);
    }

    g.beginFill(0x081020, 0.90);
    g.moveTo(x + nx * sz * 1.4, y + ny * sz * 1.4);
    g.lineTo(x + perpX * sz * 0.7, y + perpY * sz * 0.7);
    g.lineTo(x - nx * sz * 0.8, y - ny * sz * 0.8);
    g.lineTo(x - perpX * sz * 0.7, y - perpY * sz * 0.7);
    g.closePath();
    g.endFill();

    g.beginFill(palette.core, 0.82);
    g.moveTo(x + nx * sz * 0.95, y + ny * sz * 0.95);
    g.lineTo(x + perpX * sz * 0.40, y + perpY * sz * 0.40);
    g.lineTo(x - nx * sz * 0.50, y - ny * sz * 0.50);
    g.lineTo(x - perpX * sz * 0.40, y - perpY * sz * 0.40);
    g.closePath();
    g.endFill();

    g.lineStyle(1.8, palette.solid, 0.58);
    g.moveTo(x, y);
    g.lineTo(x + nx * sz * 2.35, y + ny * sz * 2.35);

    g.lineStyle(1.0, palette.edge, 0.28);
    g.moveTo(x + nx * sz * 1.4, y + ny * sz * 1.4);
    g.lineTo(x + perpX * sz * 0.7, y + perpY * sz * 0.7);
    g.lineTo(x - nx * sz * 0.8, y - ny * sz * 0.8);
    g.lineTo(x - perpX * sz * 0.7, y - perpY * sz * 0.7);
    g.closePath();

    g.beginFill(0xffffff, 0.88);
    g.drawCircle(x + nx * sz * 0.10, y + ny * sz * 0.10, 1.8);
    g.endFill();
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

    g.beginFill(palette.core, detail.glow ? 0.018 : 0.010);
    g.drawCircle(x, y, radius);
    g.endFill();

    g.lineStyle(1.4, palette.edge, 0.10);
    g.drawCircle(x, y, radius);

    var segments = 24;
    var dashArc = (Math.PI * 2) / segments * 0.6;
    g.lineStyle(1.0, palette.solid, 0.22);
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
    var sz = 8 * (detail.sizeMul || 1);
    var cos = Math.cos(angle), sin = Math.sin(angle);

    g.beginFill(palette.core, 0.10);
    g.drawCircle(x, y, sz * 1.15);
    g.endFill();

    // Larger arrow/diamond
    g.beginFill(palette.core, 0.7);
    g.moveTo(x + cos * sz * 1.8, y + sin * sz * 1.8);
    g.lineTo(x + (-sin) * sz * 0.7, y + cos * sz * 0.7);
    g.lineTo(x - cos * sz * 1.0, y - sin * sz * 1.0);
    g.lineTo(x - (-sin) * sz * 0.7, y - cos * sz * 0.7);
    g.closePath();
    g.endFill();

    g.lineStyle(1.1, palette.solid, 0.55);
    g.moveTo(x + cos * sz * 1.8, y + sin * sz * 1.8);
    g.lineTo(x + (-sin) * sz * 0.7, y + cos * sz * 0.7);
    g.lineTo(x - cos * sz * 1.0, y - sin * sz * 1.0);
    g.lineTo(x - (-sin) * sz * 0.7, y - cos * sz * 0.7);
    g.closePath();

    g.beginFill(0xffffff, 0.85);
    g.drawCircle(x + cos * sz * 0.2, y + sin * sz * 0.2, Math.max(1.6, sz * 0.18));
    g.endFill();
  }

  var DefenseRenderer = {
    drawTurretShape: drawTurretShape,
    drawTurretRadius: drawTurretRadius,
    drawPatrolShape: drawPatrolShape,
  };

  if (typeof window !== "undefined") window.DefenseRenderer = DefenseRenderer;
  if (typeof module !== "undefined") module.exports = DefenseRenderer;
})();
