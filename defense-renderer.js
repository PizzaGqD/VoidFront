/**
 * DefenseRenderer — Clean sci-fi turret and patrol visuals for VoidFront.
 * Provides shape drawing functions used by client.js drawTurrets / patrol code.
 *
 * Depends on: PIXI, FACTION_VIS, LOD (all on window).
 */
(function () {
  "use strict";

  var BLEND_MODES = (typeof PIXI !== "undefined" && PIXI.BLEND_MODES) ? PIXI.BLEND_MODES : null;
  var NORMAL_BLEND = BLEND_MODES && BLEND_MODES.NORMAL != null ? BLEND_MODES.NORMAL : "normal";
  var HALF_PI = Math.PI * 0.5;
  var DEFENSE_SPRITES = {
    patrol: {
      path: "assets/Ships/Players/patrol.png",
      textureSize: 512,
      worldWidth: 34,
      localRotation: HALF_PI
    },
    turret: {
      path: "assets/Ships/Players/Turret.png",
      textureSize: 512,
      worldWidth: 30,
      localRotation: HALF_PI
    }
  };
  var _textureCache = Object.create(null);
  var _loadPromises = Object.create(null);

  function isTextureReady(texture) {
    if (!texture) return false;
    if ((texture.width || 0) > 1 || (texture.height || 0) > 1) return true;
    var source = texture.source || texture.baseTexture || null;
    if (!source) return false;
    return !!(source.valid && ((source.width || 0) > 1 || (source.height || 0) > 1));
  }

  function getTexture(path) {
    var texture = _textureCache[path];
    return isTextureReady(texture) ? texture : null;
  }

  function requestTexture(path) {
    if (!path || typeof PIXI === "undefined") return null;
    if (isTextureReady(_textureCache[path])) return Promise.resolve(_textureCache[path]);
    if (_loadPromises[path]) return _loadPromises[path];
    if (PIXI.Assets && typeof PIXI.Assets.load === "function") {
      _loadPromises[path] = PIXI.Assets.load(path).then(function (asset) {
        _textureCache[path] = asset && asset.texture ? asset.texture : asset;
        return _textureCache[path];
      }).catch(function () {
        _textureCache[path] = null;
        return null;
      }).finally(function () {
        delete _loadPromises[path];
      });
      return _loadPromises[path];
    }
    if (PIXI.Texture && typeof PIXI.Texture.from === "function") {
      _textureCache[path] = PIXI.Texture.from(path);
      return Promise.resolve(_textureCache[path]);
    }
    return null;
  }

  function getDestroyOptions() {
    return {
      children: true,
      texture: false,
      textureSource: false,
      context: false,
      style: false
    };
  }

  function setSpriteLayout(sprite, scale, localRotation) {
    if (!sprite) return;
    sprite.anchor.set(0.5, 0.5);
    sprite.rotation = localRotation || 0;
    sprite.scale.set(scale);
  }

  function getDefenseSpriteConfig(kind) {
    return kind ? DEFENSE_SPRITES[kind] || null : null;
  }

  function hasSpriteType(kind) {
    return !!getDefenseSpriteConfig(kind);
  }

  function isSpriteReady(kind) {
    var cfg = getDefenseSpriteConfig(kind);
    return !!(cfg && getTexture(cfg.path));
  }

  function requestSprite(kind) {
    var cfg = getDefenseSpriteConfig(kind);
    if (!cfg) return null;
    return requestTexture(cfg.path);
  }

  function destroyChildren(container) {
    if (!container || typeof container.removeChildren !== "function") return;
    var removed = container.removeChildren();
    for (var i = 0; i < removed.length; i++) {
      if (removed[i] && !removed[i].destroyed && typeof removed[i].destroy === "function") {
        removed[i].destroy(getDestroyOptions());
      }
    }
  }

  function drawDefenseOutline(gfx, kind, worldSize, color, alpha) {
    if (!gfx || gfx.destroyed) return;
    var length = Math.max(16, worldSize || 28);
    var width = kind === "turret" ? length * 0.44 : length * 0.34;
    var points = kind === "turret"
      ? [
          0, -length * 0.52,
          width * 0.52, -length * 0.12,
          width * 0.62, length * 0.24,
          width * 0.26, length * 0.56,
          -width * 0.26, length * 0.56,
          -width * 0.62, length * 0.24,
          -width * 0.52, -length * 0.12
        ]
      : [
          0, -length * 0.58,
          width * 0.62, -length * 0.16,
          width * 0.50, length * 0.34,
          width * 0.18, length * 0.56,
          -width * 0.18, length * 0.56,
          -width * 0.50, length * 0.34,
          -width * 0.62, -length * 0.16
        ];
    gfx.clear();
    gfx.poly(points);
    gfx.stroke({ color: color, width: Math.max(1.1, length * 0.05), alpha: alpha, join: "round" });
    gfx.poly(points);
    gfx.fill({ color: color, alpha: Math.min(alpha * 0.10, 0.035) });
  }

  function drawDefenseLights(gfx, kind, worldSize, color, alpha) {
    if (!gfx || gfx.destroyed) return;
    var length = Math.max(16, worldSize || 28);
    var beam = kind === "turret" ? length * 0.24 : length * 0.30;
    var frontY = kind === "turret" ? -length * 0.08 : -length * 0.14;
    var midY = kind === "turret" ? length * 0.18 : length * 0.10;
    var lampR = Math.max(1.0, length * 0.05);
    gfx.clear();
    gfx.circle(-beam, frontY, lampR);
    gfx.fill({ color: 0xffffff, alpha: alpha * 0.95 });
    gfx.circle(beam, frontY, lampR);
    gfx.fill({ color: color, alpha: alpha });
    gfx.circle(0, midY, lampR * 0.7);
    gfx.fill({ color: color, alpha: alpha * 0.52 });
  }

  function ensureSpriteVisual(container, kind) {
    var cfg = getDefenseSpriteConfig(kind);
    if (!cfg || !container || !isSpriteReady(kind)) return null;
    if (container._defenseSpriteKind === kind && container._baseSprite && !container._baseSprite.destroyed) {
      return cfg;
    }
    destroyChildren(container);
    var scale = cfg.worldWidth / cfg.textureSize;
    var outline = new PIXI.Graphics();
    var base = new PIXI.Sprite(getTexture(cfg.path));
    var lights = new PIXI.Graphics();
    outline.rotation = cfg.localRotation || 0;
    lights.rotation = cfg.localRotation || 0;
    setSpriteLayout(base, scale, cfg.localRotation);
    base.blendMode = NORMAL_BLEND;
    container.addChild(outline, base, lights);
    container._defenseSpriteKind = kind;
    container._defenseConfig = cfg;
    container._outlineGfx = outline;
    container._baseSprite = base;
    container._lightsGfx = lights;
    return cfg;
  }

  function createSpriteVisual(kind) {
    if (!hasSpriteType(kind) || !isSpriteReady(kind)) return null;
    var container = new PIXI.Container();
    container.sortableChildren = false;
    ensureSpriteVisual(container, kind);
    return container;
  }

  function updateSpriteVisual(container, kind, opts) {
    if (!container || !opts) return false;
    var cfg = ensureSpriteVisual(container, kind);
    if (!cfg) return false;
    var worldSize = (cfg.worldWidth || 28) * Math.max(0.9, opts.scale || 1);
    var rotation = opts.rotation || 0;
    var color = opts.color != null ? opts.color : 0xffffff;
    var outlineAlpha = opts.outlineAlpha != null ? opts.outlineAlpha : 0.20;
    var lampAlpha = opts.lampAlpha != null ? opts.lampAlpha : 0.60;
    container.position.set(opts.x || 0, opts.y || 0);
    container.rotation = rotation;
    if (container._baseSprite && !container._baseSprite.destroyed) {
      var textureScale = worldSize / cfg.worldWidth;
      container._baseSprite.scale.set((cfg.worldWidth / cfg.textureSize) * textureScale);
      container._baseSprite.alpha = opts.alpha != null ? opts.alpha : 1;
    }
    if (container._outlineGfx && !container._outlineGfx.destroyed) {
      drawDefenseOutline(container._outlineGfx, kind, worldSize, color, outlineAlpha);
      container._outlineGfx.visible = outlineAlpha > 0.01;
    }
    if (container._lightsGfx && !container._lightsGfx.destroyed) {
      drawDefenseLights(container._lightsGfx, kind, worldSize, color, lampAlpha);
      container._lightsGfx.visible = lampAlpha > 0.01;
    }
    return true;
  }

  function updateTurretSpriteVisual(container, opts) {
    var nx = opts && opts.nx != null ? opts.nx : 0;
    var ny = opts && opts.ny != null ? opts.ny : -1;
    var rotation = Math.atan2(ny, nx);
    return updateSpriteVisual(container, "turret", {
      x: opts && opts.x,
      y: opts && opts.y,
      rotation: rotation,
      color: opts && opts.color,
      scale: opts && opts.scale,
      alpha: opts && opts.alpha,
      outlineAlpha: opts && opts.outlineAlpha,
      lampAlpha: opts && opts.lampAlpha
    });
  }

  function updatePatrolSpriteVisual(container, opts) {
    return updateSpriteVisual(container, "patrol", {
      x: opts && opts.x,
      y: opts && opts.y,
      rotation: opts && opts.angle,
      color: opts && opts.color,
      scale: opts && opts.scale,
      alpha: opts && opts.alpha,
      outlineAlpha: opts && opts.outlineAlpha,
      lampAlpha: opts && opts.lampAlpha
    });
  }

  function destroySpriteVisual(container) {
    if (!container) return;
    if (container.parent) container.parent.removeChild(container);
    if (container.destroy) container.destroy(getDestroyOptions());
  }

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
  function drawTurretShape(g, x, y, nx, ny, color, zoom, opts) {
    var options = opts || {};
    var palette = FACTION_VIS.getFactionPalette(color);
    var detail = LOD.getDetail("turret", zoom);
    var scale = Math.max(0.7, options.scale || 1);
    var barrelMul = Math.max(0.75, options.barrelMul || 1);
    var sz = (detail.shape === "dot" ? 4.5 : 8.5) * scale;

    if (detail.shape === "dot") {
      var half = Math.max(2.4, 3.1 * scale);
      var barrelLen = Math.max(5.5, 8.5 * scale * barrelMul);
      g.beginFill(palette.core, 0.12);
      g.drawCircle(x, y, 5.6 * scale);
      g.endFill();
      g.beginFill(0x081020, 0.92);
      g.drawRect(x - half - 1, y - half - 1, (half + 1) * 2, (half + 1) * 2);
      g.endFill();
      g.beginFill(palette.core, 0.88);
      g.drawRect(x - half, y - half, half * 2, half * 2);
      g.endFill();
      g.lineStyle(Math.max(1.2, 1.4 * scale), palette.solid, 0.9);
      g.moveTo(x, y);
      g.lineTo(x + nx * barrelLen, y + ny * barrelLen);
      g.beginFill(0xffffff, 0.88);
      g.drawCircle(x, y, Math.max(1.2, 1.3 * scale));
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

    g.lineStyle(1.8 * Math.max(0.9, scale * 0.9), palette.solid, 0.58);
    g.moveTo(x, y);
    g.lineTo(x + nx * sz * 2.35 * barrelMul, y + ny * sz * 2.35 * barrelMul);

    g.lineStyle(1.0, palette.edge, 0.28);
    g.moveTo(x + nx * sz * 1.4, y + ny * sz * 1.4);
    g.lineTo(x + perpX * sz * 0.7, y + perpY * sz * 0.7);
    g.lineTo(x - nx * sz * 0.8, y - ny * sz * 0.8);
    g.lineTo(x - perpX * sz * 0.7, y - perpY * sz * 0.7);
    g.closePath();

    g.beginFill(0xffffff, 0.88);
    g.drawCircle(x + nx * sz * 0.10, y + ny * sz * 0.10, Math.max(1.8, 1.8 * scale));
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
    hasSpriteType: hasSpriteType,
    isSpriteReady: isSpriteReady,
    requestSprite: requestSprite,
    createSpriteVisual: createSpriteVisual,
    updateTurretSpriteVisual: updateTurretSpriteVisual,
    updatePatrolSpriteVisual: updatePatrolSpriteVisual,
    destroySpriteVisual: destroySpriteVisual,
  };

  requestSprite("patrol");
  requestSprite("turret");

  if (typeof window !== "undefined") window.DefenseRenderer = DefenseRenderer;
  if (typeof module !== "undefined") module.exports = DefenseRenderer;
})();
