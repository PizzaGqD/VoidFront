/**
 * ResourceFlow — Visual factory for resource packets (money/xp gems).
 * Money: amber hex-capsule. XP: cyan data-orb.
 * LOD-aware: on far zoom, returns cheap pulse-line markers.
 *
 * Depends on: PIXI, FACTION_VIS, LOD, VFXPool (all on window).
 */
(function () {
  "use strict";

  var RES = FACTION_VIS ? FACTION_VIS.RESOURCE_COLORS : {
    money: { primary: 0xffaa22, secondary: 0xffe088, glow: 0xff9900 },
    xp:    { primary: 0x44ddee, secondary: 0xaaeeff, glow: 0x22ccdd },
  };

  function makeMoneyPacket(g, value, zoom) {
    var detail = LOD.getDetail("gem", zoom || 0.22);
    var sz = Math.min(10, 3.5 + value * 1.2);

    if (!detail.body) {
      g.circle(0, 0, 2.5);
      g.fill({ color: RES.money.primary, alpha: 0.7 });
      return;
    }

    // Hex capsule
    var pts = [];
    for (var i = 0; i < 6; i++) {
      var a = (Math.PI / 3) * i - Math.PI / 6;
      pts.push(Math.cos(a) * sz, Math.sin(a) * sz);
    }
    g.poly(pts);
    g.fill({ color: RES.money.primary, alpha: 0.85 });
    g.poly(pts);
    g.stroke({ color: RES.money.secondary, width: 1.0, alpha: 0.5 });

    // Inner bright core
    g.circle(0, 0, sz * 0.35);
    g.fill({ color: 0xffffff, alpha: 0.25 });
  }

  function makeXPPacket(g, value, zoom) {
    var detail = LOD.getDetail("gem", zoom || 0.22);
    var sz = Math.min(10, 3.5 + value * 1.2);

    if (!detail.body) {
      g.circle(0, 0, 2.5);
      g.fill({ color: RES.xp.primary, alpha: 0.7 });
      return;
    }

    // Data orb
    g.circle(0, 0, sz);
    g.fill({ color: RES.xp.primary, alpha: 0.55 });
    g.circle(0, 0, sz);
    g.stroke({ color: RES.xp.secondary, width: 0.8, alpha: 0.5 });

    // Inner data rings
    g.circle(0, 0, sz * 0.6);
    g.stroke({ color: 0xffffff, width: 0.5, alpha: 0.25 });
    g.circle(0, 0, sz * 0.3);
    g.fill({ color: 0xffffff, alpha: 0.2 });
  }

  /**
   * Create visual for a resource gem/packet.
   * @param {PIXI.Graphics} g - target graphics
   * @param {boolean} isCredit - true for money, false for xp
   * @param {number} value
   * @param {number} zoom
   */
  function drawPacket(g, isCredit, value, zoom) {
    if (isCredit) {
      makeMoneyPacket(g, value, zoom);
    } else {
      makeXPPacket(g, value, zoom);
    }
  }

  /**
   * Get appropriate glow filter config for a resource packet.
   */
  function getPacketGlow(isCredit, value, zoom) {
    var detail = LOD.getDetail("gem", zoom || 0.22);
    if (!detail.glow) return null;
    var col = isCredit ? RES.money.glow : RES.xp.glow;
    var dist = value >= 8 ? 12 : (value >= 4 ? 8 : 5);
    var strength = value >= 8 ? 2.5 : (value >= 4 ? 1.5 : 1.0);
    return { color: col, distance: dist, outerStrength: strength };
  }

  var ResourceFlow = {
    drawPacket: drawPacket,
    getPacketGlow: getPacketGlow,
    RESOURCE_COLORS: RES,
  };

  if (typeof window !== "undefined") window.ResourceFlow = ResourceFlow;
  if (typeof module !== "undefined") module.exports = ResourceFlow;
})();
