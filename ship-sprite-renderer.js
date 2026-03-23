(function () {
  "use strict";

  var BLEND_MODES = (typeof PIXI !== "undefined" && PIXI.BLEND_MODES) ? PIXI.BLEND_MODES : null;
  var ADD_BLEND = BLEND_MODES && BLEND_MODES.ADD != null ? BLEND_MODES.ADD : "add";
  var NORMAL_BLEND = BLEND_MODES && BLEND_MODES.NORMAL != null ? BLEND_MODES.NORMAL : "normal";
  var HALF_PI = Math.PI * 0.5;
  var PIRATE_OWNER_ID = -1;

  function shipCfg(basePath, worldWidth, extras) {
    var cfg = {
      textureSize: 512,
      worldWidth: worldWidth,
      localRotation: HALF_PI,
      outlineAlpha: 0.26,
      outlineScale: 1.028,
      emissiveAlpha: 0.0,
      accentAlpha: 0.0,
      selectedOutlineAlpha: 0.48,
      hoverOutlineAlpha: 0.36,
      flashOutlineAlpha: 0.58,
      basePath: basePath
    };
    if (extras) {
      for (var key in extras) {
        if (Object.prototype.hasOwnProperty.call(extras, key)) cfg[key] = extras[key];
      }
    }
    return cfg;
  }

  var SHIP_SPRITES = {
    fighter: shipCfg("assets/Ships/Players/Fighter.png", 36, {
      outlineAlpha: 0.18,
      selectedOutlineAlpha: 0.32,
      hoverOutlineAlpha: 0.25,
      flashOutlineAlpha: 0.36
    }),
    destroyer: shipCfg("assets/Ships/Players/Layers/destroyer.base.png", 74, {
      emissiveAlpha: 0.92,
      accentAlpha: 0.28,
      selectedAccentAlpha: 0.44,
      hoverAccentAlpha: 0.36,
      flashAccentAlpha: 0.52,
      emissivePath: "assets/Ships/Players/Layers/destroyer.emissive.png",
      accentPath: "assets/Ships/Players/Layers/destroyer.accent.png"
    }),
    cruiser: shipCfg("assets/Ships/Players/Cruiser.png", 108, {
      outlineAlpha: 0.18,
      selectedOutlineAlpha: 0.31,
      hoverOutlineAlpha: 0.24,
      flashOutlineAlpha: 0.35
    }),
    battleship: shipCfg("assets/Ships/Players/Layers/battleship.base.png", 154, {
      emissiveAlpha: 0.90,
      accentAlpha: 0.23,
      selectedAccentAlpha: 0.38,
      hoverAccentAlpha: 0.31,
      flashAccentAlpha: 0.46,
      emissivePath: "assets/Ships/Players/Layers/battleship.emissive.png",
      accentPath: "assets/Ships/Players/Layers/battleship.accent.png"
    }),
    hyperDestroyer: shipCfg("assets/Ships/Aliens/destroyer.png", 194, {
      outlineAlpha: 0.20,
      selectedOutlineAlpha: 0.34,
      hoverOutlineAlpha: 0.28,
      flashOutlineAlpha: 0.40
    }),
    "pirate:fighter": shipCfg("assets/Ships/Pirates/Type 2.png", 31, {
      outlineAlpha: 0.16,
      selectedOutlineAlpha: 0.28,
      hoverOutlineAlpha: 0.22
    }),
    "pirate:destroyer": shipCfg("assets/Ships/Pirates/Type 2.png", 52, {
      outlineAlpha: 0.16,
      selectedOutlineAlpha: 0.28,
      hoverOutlineAlpha: 0.22
    }),
    "pirate:cruiser": shipCfg("assets/Ships/Pirates/Type 1.png", 76, {
      outlineAlpha: 0.16,
      selectedOutlineAlpha: 0.29,
      hoverOutlineAlpha: 0.23
    }),
    "pirate:battleship": shipCfg("assets/Ships/Pirates/Type 1.png", 108, {
      outlineAlpha: 0.16,
      selectedOutlineAlpha: 0.29,
      hoverOutlineAlpha: 0.23
    }),
    "pirate:hyperDestroyer": shipCfg("assets/Ships/Pirates/Type 1.png", 136, {
      outlineAlpha: 0.18,
      selectedOutlineAlpha: 0.32,
      hoverOutlineAlpha: 0.25
    })
  };

  var _textureCache = Object.create(null);
  var _loadPromises = Object.create(null);

  function isTextureReady(texture) {
    if (!texture) return false;
    if (texture.width > 1 || texture.height > 1) return true;
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

  function getSpriteKey(unitType, ownerId) {
    if (ownerId === PIRATE_OWNER_ID && SHIP_SPRITES["pirate:" + unitType]) return "pirate:" + unitType;
    return SHIP_SPRITES[unitType] ? unitType : null;
  }

  function getSpriteConfig(unitType, ownerId) {
    var spriteKey = getSpriteKey(unitType, ownerId);
    return spriteKey ? SHIP_SPRITES[spriteKey] : null;
  }

  function getTextureRequests(cfg) {
    var requests = [requestTexture(cfg.basePath)];
    if (cfg.emissivePath) requests.push(requestTexture(cfg.emissivePath));
    if (cfg.accentPath) requests.push(requestTexture(cfg.accentPath));
    return requests;
  }

  function requestUnitType(unitType, ownerId) {
    var cfg = getSpriteConfig(unitType, ownerId);
    if (!cfg) return null;
    return Promise.all(getTextureRequests(cfg)).then(function () {
      return isReady(unitType, ownerId);
    });
  }

  function isReady(unitType, ownerId) {
    var cfg = getSpriteConfig(unitType, ownerId);
    if (!cfg) return false;
    if (!getTexture(cfg.basePath)) return false;
    if (cfg.emissivePath && !getTexture(cfg.emissivePath)) return false;
    if (cfg.accentPath && !getTexture(cfg.accentPath)) return false;
    return true;
  }

  function hasSpriteType(unitType, ownerId) {
    return !!getSpriteConfig(unitType, ownerId);
  }

  function setSpriteLayout(sprite, scale, localRotation, scaleMul) {
    if (!sprite) return;
    sprite.anchor.set(0.5, 0.5);
    sprite.rotation = localRotation || 0;
    sprite.scale.set(scale * (scaleMul || 1));
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

  function getOutlineUnitKey(unitType) {
    if (!unitType) return "destroyer";
    return typeof unitType === "string" && unitType.indexOf("pirate:") === 0
      ? unitType.slice(7)
      : unitType;
  }

  function drawOutlineHull(gfx, unitType, worldSize, color, alpha) {
    if (!gfx || gfx.destroyed) return;
    var key = getOutlineUnitKey(unitType);
    var length = Math.max(18, worldSize || 64);
    var width = length * 0.26;
    var points;
    if (key === "fighter") {
      width = length * 0.34;
      points = [
        0, -length * 0.56,
        width * 0.70, -length * 0.10,
        width * 0.48, length * 0.34,
        0, length * 0.50,
        -width * 0.48, length * 0.34,
        -width * 0.70, -length * 0.10
      ];
    } else if (key === "cruiser") {
      width = length * 0.30;
      points = [
        0, -length * 0.58,
        width * 0.34, -length * 0.40,
        width * 0.80, -length * 0.02,
        width * 0.72, length * 0.34,
        width * 0.22, length * 0.54,
        -width * 0.22, length * 0.54,
        -width * 0.72, length * 0.34,
        -width * 0.80, -length * 0.02,
        -width * 0.34, -length * 0.40
      ];
    } else if (key === "battleship") {
      width = length * 0.33;
      points = [
        0, -length * 0.58,
        width * 0.28, -length * 0.45,
        width * 0.88, -length * 0.08,
        width * 0.76, length * 0.38,
        width * 0.22, length * 0.58,
        -width * 0.22, length * 0.58,
        -width * 0.76, length * 0.38,
        -width * 0.88, -length * 0.08,
        -width * 0.28, -length * 0.45
      ];
    } else if (key === "hyperDestroyer") {
      width = length * 0.31;
      points = [
        0, -length * 0.60,
        width * 0.54, -length * 0.34,
        width * 0.94, 0,
        width * 0.72, length * 0.44,
        width * 0.20, length * 0.60,
        -width * 0.20, length * 0.60,
        -width * 0.72, length * 0.44,
        -width * 0.94, 0,
        -width * 0.54, -length * 0.34
      ];
    } else {
      points = [
        0, -length * 0.58,
        width * 0.30, -length * 0.42,
        width * 0.76, -length * 0.06,
        width * 0.66, length * 0.40,
        width * 0.18, length * 0.56,
        -width * 0.18, length * 0.56,
        -width * 0.66, length * 0.40,
        -width * 0.76, -length * 0.06,
        -width * 0.30, -length * 0.42
      ];
    }
    gfx.clear();
    gfx.poly(points);
    gfx.stroke({ color: color, width: Math.max(1.7, length * 0.040), alpha: alpha, join: "round" });
    gfx.poly(points);
    gfx.stroke({ color: 0xffffff, width: Math.max(0.7, length * 0.012), alpha: Math.min(0.24, alpha * 0.42), join: "round" });
    gfx.poly(points);
    gfx.fill({ color: color, alpha: Math.min(alpha * 0.18, 0.06) });
  }

  function drawShipLights(gfx, unitType, worldSize, color, alpha) {
    if (!gfx || gfx.destroyed) return;
    var key = getOutlineUnitKey(unitType);
    var length = Math.max(18, worldSize || 64);
    var beam = length * (key === "fighter" ? 0.18 : key === "battleship" ? 0.26 : 0.22);
    var frontY = -length * 0.18;
    var midY = length * 0.08;
    var lampR = Math.max(1.1, length * 0.026);
    var tailR = Math.max(0.9, length * 0.020);
    gfx.clear();
    gfx.circle(-beam, frontY, lampR);
    gfx.fill({ color: 0xffffff, alpha: alpha * 0.95 });
    gfx.circle(beam, frontY, lampR);
    gfx.fill({ color: color, alpha: alpha });
    gfx.circle(-beam * 0.82, midY, tailR);
    gfx.fill({ color: color, alpha: alpha * 0.58 });
    gfx.circle(beam * 0.82, midY, tailR);
    gfx.fill({ color: color, alpha: alpha * 0.58 });
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

  function ensureVisual(container, unitType, ownerId) {
    var spriteKey = getSpriteKey(unitType, ownerId);
    var cfg = spriteKey ? SHIP_SPRITES[spriteKey] : null;
    if (!cfg || !container) return null;
    if (!isReady(unitType, ownerId)) return null;
    if (container._shipSpriteConfigKey === spriteKey && container._shipBase && !container._shipBase.destroyed) {
      return cfg;
    }

    destroyChildren(container);

    var scale = cfg.worldWidth / cfg.textureSize;
    var outline = new PIXI.Graphics();
    var base = new PIXI.Sprite(getTexture(cfg.basePath));
    var accent = cfg.accentPath ? new PIXI.Sprite(getTexture(cfg.accentPath)) : null;
    var emissive = cfg.emissivePath ? new PIXI.Sprite(getTexture(cfg.emissivePath)) : null;
    var lights = new PIXI.Graphics();
    var overlay = new PIXI.Graphics();

    outline.rotation = cfg.localRotation || 0;
    lights.rotation = cfg.localRotation || 0;
    setSpriteLayout(base, scale, cfg.localRotation);
    setSpriteLayout(accent, scale, cfg.localRotation);
    setSpriteLayout(emissive, scale, cfg.localRotation);

    outline.blendMode = NORMAL_BLEND;
    base.blendMode = NORMAL_BLEND;
    if (accent) accent.blendMode = NORMAL_BLEND;
    if (emissive) emissive.blendMode = NORMAL_BLEND;

    container.addChild(outline, base);
    if (accent) container.addChild(accent);
    if (emissive) container.addChild(emissive);
    container.addChild(lights);
    container.addChild(overlay);
    container._shipSpriteConfigKey = spriteKey;
    container._shipOutline = outline;
    container._shipBase = base;
    container._shipAccent = accent;
    container._shipEmissive = emissive;
    container._shipLights = lights;
    container._shipOverlayGfx = overlay;
    return cfg;
  }

  function updateUnitVisual(container, opts) {
    if (!container || !opts) return false;
    var unitType = opts.unitType;
    var ownerId = opts.ownerId;
    var cfg = ensureVisual(container, unitType, ownerId);
    if (!cfg) return false;

    var detail = opts.detail || {};
    var highlight = opts.highlight;
    var teamColor = opts.color != null ? opts.color : 0xffffff;
    var tintColor = highlight != null ? highlight : teamColor;
    var outlineAlpha = cfg.outlineAlpha != null ? cfg.outlineAlpha : 0.16;
    var accentAlpha = cfg.accentAlpha != null ? cfg.accentAlpha : 0.0;
    var emissiveAlpha = cfg.emissiveAlpha != null ? cfg.emissiveAlpha : 0.0;
    var lampAlpha = cfg.lampAlpha != null ? cfg.lampAlpha : 0.64;
    var level = opts.lodLevel || "near";

    if (highlight === 0xffffff) {
      outlineAlpha = cfg.selectedOutlineAlpha != null ? cfg.selectedOutlineAlpha : outlineAlpha * 1.65;
      accentAlpha = cfg.selectedAccentAlpha != null ? cfg.selectedAccentAlpha : accentAlpha * 1.55;
      emissiveAlpha = Math.max(emissiveAlpha, 0.98);
    } else if (highlight === 0xff2222) {
      outlineAlpha = cfg.flashOutlineAlpha != null ? cfg.flashOutlineAlpha : outlineAlpha * 1.9;
      accentAlpha = cfg.flashAccentAlpha != null ? cfg.flashAccentAlpha : accentAlpha * 1.8;
      emissiveAlpha = Math.max(emissiveAlpha, 1.0);
    } else if (highlight != null) {
      outlineAlpha = cfg.hoverOutlineAlpha != null ? cfg.hoverOutlineAlpha : outlineAlpha * 1.35;
      accentAlpha = cfg.hoverAccentAlpha != null ? cfg.hoverAccentAlpha : accentAlpha * 1.3;
      emissiveAlpha = Math.max(emissiveAlpha, cfg.emissivePath ? 0.97 : 0.0);
    }

    if (level === "far" || detail.fullShape === false) {
      outlineAlpha *= 0.72;
      accentAlpha *= 0.38;
      emissiveAlpha *= 0.88;
      lampAlpha *= 0.35;
    } else if (level === "mid") {
      outlineAlpha *= 0.88;
      accentAlpha *= 0.72;
      emissiveAlpha *= 0.95;
      lampAlpha *= 0.68;
    }

    if (container._shipOutline && !container._shipOutline.destroyed) {
      drawOutlineHull(container._shipOutline, unitType, cfg.worldWidth, tintColor, outlineAlpha);
      container._shipOutline.visible = outlineAlpha > 0.01;
    }
    container._shipBase.tint = 0xffffff;
    container._shipBase.alpha = 1.0;
    if (container._shipAccent && !container._shipAccent.destroyed) {
      container._shipAccent.tint = tintColor;
      container._shipAccent.alpha = accentAlpha;
      container._shipAccent.visible = accentAlpha > 0.01;
    }
    if (container._shipEmissive && !container._shipEmissive.destroyed) {
      container._shipEmissive.tint = tintColor;
      container._shipEmissive.alpha = emissiveAlpha;
      container._shipEmissive.visible = emissiveAlpha > 0.01;
    }
    if (container._shipLights && !container._shipLights.destroyed) {
      drawShipLights(container._shipLights, unitType, cfg.worldWidth, teamColor, lampAlpha);
      container._shipLights.visible = lampAlpha > 0.01;
    }
    if (container._shipOverlayGfx && !container._shipOverlayGfx.destroyed) container._shipOverlayGfx.clear();
    return true;
  }

  function createUnitVisual(opts) {
    if (!opts || !hasSpriteType(opts.unitType, opts.ownerId) || !isReady(opts.unitType, opts.ownerId)) return null;
    var container = new PIXI.Container();
    container.sortableChildren = false;
    updateUnitVisual(container, opts);
    return container;
  }

  function getOverlayGfx(container) {
    if (!container || !container._shipOverlayGfx || container._shipOverlayGfx.destroyed) return null;
    return container._shipOverlayGfx;
  }

  function destroyUnitVisual(container) {
    if (!container) return;
    if (container.parent) container.parent.removeChild(container);
    container.destroy(getDestroyOptions());
  }

  var api = {
    hasSpriteType: hasSpriteType,
    isReady: isReady,
    requestUnitType: requestUnitType,
    createUnitVisual: createUnitVisual,
    updateUnitVisual: updateUnitVisual,
    getOverlayGfx: getOverlayGfx,
    destroyUnitVisual: destroyUnitVisual,
    getSpriteKey: getSpriteKey,
    SHIP_SPRITES: SHIP_SPRITES
  };

  ["fighter", "destroyer", "cruiser", "battleship", "hyperDestroyer"].forEach(function (unitType) {
    requestUnitType(unitType, 1);
    requestUnitType(unitType, PIRATE_OWNER_ID);
  });

  if (typeof window !== "undefined") window.ShipSpriteRenderer = api;
  if (typeof module !== "undefined") module.exports = api;
})();
