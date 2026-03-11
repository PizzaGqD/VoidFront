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
    var coreCol = palette.core;
    var solidCol = palette.solid;

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
        g.stroke({ color: col, width: big ? 9 : 6, alpha: 0.055 * fade });
      }
      g.moveTo(b.fromX, b.fromY); g.lineTo(tipX, tipY);
      g.stroke({ color: col, width: big ? 2.8 : 1.8, alpha: 0.72 * fade });
      g.moveTo(b.fromX, b.fromY); g.lineTo(tipX, tipY);
      g.stroke({ color: 0xffffff, width: big ? 0.95 : 0.55, alpha: 0.72 * fade });

      if (detail.hitFlash) {
        if (detail.glow) {
          g.circle(tipX, tipY, big ? 8 : 5);
          g.fill({ color: col, alpha: 0.08 * fade });
        }
        g.circle(tipX, tipY, big ? 2.2 : 1.5);
        g.fill({ color: 0xffffff, alpha: 0.52 * fade });
      }

    } else if (b.type === "ranged") {
      var dx = b.toX - b.fromX, dy = b.toY - b.fromY;
      var dl = Math.hypot(dx, dy) || 1;
      var ux = dx / dl, uy = dy / dl;
      var tailLen = b.big ? 13 : (b.aoe ? 10 : 8);
      var tailX = b.x - ux * tailLen;
      var tailY = b.y - uy * tailLen;
      var pulse = 0.72 + 0.28 * Math.sin(now / 160 + (b.x || 0) * 0.03);

      if (b.aoe) {
        var borderFade = b._fadeAlpha != null ? b._fadeAlpha : 1;
        g.moveTo(tailX, tailY); g.lineTo(b.x, b.y);
        g.stroke({ color: coreCol, width: 1.4, alpha: 0.44 * borderFade });
        g.moveTo(tailX + ux * 2.5, tailY + uy * 2.5); g.lineTo(b.x, b.y);
        g.stroke({ color: 0xffffff, width: 0.55, alpha: 0.38 * borderFade });
        g.circle(b.x, b.y, 1.9);
        g.fill({ color: solidCol, alpha: 0.80 * borderFade });
        if (detail.hitFlash) {
          g.circle(b.x, b.y, 4.8);
          g.fill({ color: coreCol, alpha: 0.06 * borderFade });
        }
      } else {
        g.moveTo(tailX, tailY); g.lineTo(b.x, b.y);
        g.stroke({ color: coreCol, width: b.big ? 2.0 : 1.35, alpha: 0.58 * pulse });
        g.moveTo(tailX + ux * 3, tailY + uy * 3); g.lineTo(b.x, b.y);
        g.stroke({ color: 0xffffff, width: 0.62, alpha: 0.46 * pulse });
        g.circle(b.x, b.y, b.big ? 2.4 : 1.8);
        g.fill({ color: solidCol, alpha: 0.84 });
        if (detail.glow) {
          g.circle(b.x, b.y, b.big ? 6.5 : 4.5);
          g.fill({ color: coreCol, alpha: 0.06 * pulse });
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
