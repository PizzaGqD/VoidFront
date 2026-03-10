/**
 * VFXPool — Object pool for reusable PIXI visual objects.
 * Avoids per-frame create/destroy overhead for temporary visuals
 * like resource packets, tracers, hit flashes, pulses.
 *
 * Depends on PIXI being loaded globally.
 */
(function () {
  "use strict";

  const CAPS = {
    gem:      200,
    tracer:   100,
    hitFlash:  50,
    pulse:     80,
    generic:  100,
  };

  const pools = {};
  const stats = { gets: 0, releases: 0, creates: 0 };

  function getPool(type) {
    if (!pools[type]) pools[type] = [];
    return pools[type];
  }

  function get(type, factoryFn) {
    const pool = getPool(type);
    stats.gets++;
    if (pool.length > 0) {
      const obj = pool.pop();
      obj.visible = true;
      obj._poolType = type;
      return obj;
    }
    stats.creates++;
    const obj = factoryFn ? factoryFn() : new PIXI.Graphics();
    obj._poolType = type;
    return obj;
  }

  function release(obj) {
    if (!obj) return;
    const type = obj._poolType || "generic";
    const pool = getPool(type);
    const cap = CAPS[type] || CAPS.generic;

    obj.visible = false;
    obj.position.set(0, 0);
    obj.rotation = 0;
    obj.scale.set(1, 1);
    obj.alpha = 1;

    if (pool.length < cap) {
      pool.push(obj);
      stats.releases++;
    } else {
      if (obj.parent) obj.parent.removeChild(obj);
      obj.destroy({ children: true });
    }
  }

  function releaseAndRemove(obj, parent) {
    if (!obj) return;
    if (parent && obj.parent === parent) parent.removeChild(obj);
    else if (obj.parent) obj.parent.removeChild(obj);
    release(obj);
  }

  function clearPool(type) {
    const pool = getPool(type);
    for (const obj of pool) {
      if (obj.parent) obj.parent.removeChild(obj);
      obj.destroy({ children: true });
    }
    pool.length = 0;
  }

  function clearAll() {
    for (const type in pools) clearPool(type);
  }

  function getStats() {
    const sizes = {};
    for (const type in pools) sizes[type] = pools[type].length;
    return { ...stats, poolSizes: sizes };
  }

  const VFXPool = {
    CAPS,
    get,
    release,
    releaseAndRemove,
    clearPool,
    clearAll,
    getStats,
  };

  if (typeof window !== "undefined") window.VFXPool = VFXPool;
  if (typeof module !== "undefined") module.exports = VFXPool;
})();
