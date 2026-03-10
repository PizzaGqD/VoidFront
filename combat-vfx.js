/**
 * CombatVFX — Clean sci-fi tracer and bullet rendering for VoidFront.
 * Thin faction-colored tracers, subtle hit impulses, LOD-aware.
 *
 * Depends on: PIXI, FACTION_VIS, LOD (all on window).
 */
(function () {
  "use strict";

  /**
   * Draw a single bullet/tracer into a shared Graphics batch.
   * @param {PIXI.Graphics} g - shared graphics for the frame
   * @param {object} b - bullet object
   * @param {number} zoom - camera zoom
   * @param {number} now - performance.now() for pulse
   */
  function drawBullet(g, b, zoom, now) {
    var detail = LOD.getDetail("bullet", zoom || 0.22);
    var palette = FACTION_VIS.getFactionPalette(b.color || 0xffaa44);

    if (b.type === "laser") {
      var t = Math.min(1, b.progress || 0);
      var tipX = b.fromX + (b.toX - b.fromX) * t;
      var tipY = b.fromY + (b.toY - b.fromY) * t;
      var col = b.color || 0xaa44ff;
      var big = b.big;
      var fadeIn = Math.min(1, t * 5);
      var fadeOut = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      var fade = fadeIn * fadeOut;

      if (detail.glow) {
        g.moveTo(b.fromX, b.fromY); g.lineTo(tipX, tipY);
        g.stroke({ color: col, width: big ? 16 : 10, alpha: 0.08 * fade });
      }
      g.moveTo(b.fromX, b.fromY); g.lineTo(tipX, tipY);
      g.stroke({ color: col, width: big ? 4 : 2.5, alpha: 0.75 * fade });
      g.moveTo(b.fromX, b.fromY); g.lineTo(tipX, tipY);
      g.stroke({ color: 0xffffff, width: big ? 1.5 : 0.8, alpha: 0.8 * fade });

      if (detail.hitFlash) {
        g.circle(tipX, tipY, big ? 3 : 2);
        g.fill({ color: 0xffffff, alpha: 0.6 * fade });
      }

    } else if (b.type === "ranged") {
      var dx = b.toX - b.fromX, dy = b.toY - b.fromY;
      var dl = Math.hypot(dx, dy) || 1;
      var tx = -(dx / dl) * 5, ty = -(dy / dl) * 5;
      var bCol = palette.core;

      if (b.aoe) {
        var borderFade = b._fadeAlpha != null ? b._fadeAlpha : 1;
        // Thin tracer line
        g.moveTo(b.x, b.y); g.lineTo(b.x + tx * 2.5, b.y + ty * 2.5);
        g.stroke({ color: bCol, width: 1.5, alpha: 0.55 * borderFade });
        // Bright tip
        g.circle(b.x, b.y, 2.0);
        g.fill({ color: bCol, alpha: 0.85 * borderFade });
      } else {
        var bPulse = 0.75 + 0.25 * Math.sin(now / 120 + (b.x || 0) * 0.1);
        // Trail line
        g.moveTo(b.x, b.y); g.lineTo(b.x + tx, b.y + ty);
        g.stroke({ color: bCol, width: 1.8, alpha: 0.7 * bPulse });
        // Bright head
        g.circle(b.x, b.y, b.big ? 3 : 2);
        g.fill({ color: bCol, alpha: 0.9 });
        if (detail.glow) {
          g.circle(b.x, b.y, 5);
          g.fill({ color: bCol, alpha: 0.08 * bPulse });
        }
      }

    } else {
      var pt = Math.min(1, b.progress || 0);
      var px = b.fromX + (b.toX - b.fromX) * pt;
      var py = b.fromY + (b.toY - b.fromY) * pt;
      g.circle(px, py, b.big ? 4 : 3);
      g.fill({ color: b.color || 0xffff00, alpha: 0.9 });
    }
  }

  var CombatVFX = {
    drawBullet: drawBullet,
  };

  if (typeof window !== "undefined") window.CombatVFX = CombatVFX;
  if (typeof module !== "undefined") module.exports = CombatVFX;
})();
