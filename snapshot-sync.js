(function () {
  "use strict";

  function install(deps) {
    const {
      state,
      NET,
      CFG,
      PLAYER_COLORS,
      PLAYER_LIGHT_SYNC_KEYS,
      PLAYER_FULL_SYNC_KEYS,
      UNIT_FULL_SYNC_KEYS,
      makePlayer,
      makeCityVisual,
      makeZoneVisual,
      cityLayer,
      zonesLayer,
      zoneEffectsLayer,
      computeInfluencePolygon,
      unitsLayer,
      makeUnitVisual,
      makeResVisual,
      deleteResource,
      turretLayer,
      destroyIonStormVisual,
      removeMeteorGfx,
      destroyOrbitalStrikeVisual,
      destroyThermoNukeVisual,
      destroyPirateRaidVisual,
      destroyEconomyAbilityVisual,
      destroyAbilityZoneVisual,
      makeMineVisual,
      updateMineVisual,
      syncSectorObjectivesFromSnapshot,
      resLayer,
      destroyBlackHoleVisual,
      reportError
    } = deps;

    function applyGameState(snap) {
      if (!snap || state._multiIsHost) return;
      try {
        applyGameStateInner(snap);
      } catch (e) {
        console.error("[MP-SYNC] ERROR in applyGameState:", e);
        if (typeof reportError === "function") {
          reportError("snapshot-sync.applyGameState", e, {
            seq: snap._seq ?? null,
            fullSync: !!snap._fullSync,
            units: Array.isArray(snap.units) ? snap.units.length : 0,
            players: Array.isArray(snap.players) ? snap.players.length : 0
          });
        }
      }
    }

    function deriveInterpDuration(entity, snap, fallbackMs, options) {
      const opts = options || {};
      const fallback = Math.max(8, fallbackMs || NET.SEND_INTERVAL_MS);
      let durationMs = fallback;
      if (
        entity
        && entity._lastNetServerTime != null
        && snap
        && snap._st != null
        && snap._st > entity._lastNetServerTime
      ) {
        durationMs = snap._st - entity._lastNetServerTime;
      } else if (
        entity
        && entity._lastNetSeq != null
        && snap
        && snap._seq != null
        && snap._seq > entity._lastNetSeq
      ) {
        durationMs = (snap._seq - entity._lastNetSeq) * NET.SEND_INTERVAL_MS;
      }
      durationMs = NET.clamp(
        durationMs,
        opts.minMs != null ? opts.minMs : Math.max(8, fallback * 0.7),
        opts.maxMs != null ? opts.maxMs : Math.max(fallback * 3.5, fallback + 32)
      );
      if (entity && snap) {
        if (snap._seq != null) entity._lastNetSeq = snap._seq;
        if (snap._st != null) entity._lastNetServerTime = snap._st;
        entity._lastInterpDurationMs = durationMs;
      }
      return durationMs;
    }

    function cloneStormBlob(blob) {
      if (!blob) return null;
      return {
        ox: blob.ox || 0,
        oy: blob.oy || 0,
        r: blob.r || 0,
        _baseOx: blob._baseOx != null ? blob._baseOx : (blob.ox || 0),
        _baseOy: blob._baseOy != null ? blob._baseOy : (blob.oy || 0),
        _baseR: blob._baseR != null ? blob._baseR : (blob.r || 0),
        _phase: blob._phase != null ? blob._phase : 0
      };
    }

    function createStormFromSnapshot(storm) {
      if (!storm) return null;
      return {
        x: storm.x || 0,
        y: storm.y || 0,
        vx: storm.vx || 0,
        vy: storm.vy || 0,
        spawnedAt: storm.spawnedAt || 0,
        duration: storm.duration || 0,
        lastDirChange: storm.lastDirChange || storm.spawnedAt || 0,
        lastDmgTick: storm.lastDmgTick || storm.spawnedAt || 0,
        rotAngle: storm.rotAngle || 0,
        stretch: storm.stretch || 1,
        ownerId: storm.ownerId,
        tickDamagePct: storm.tickDamagePct,
        finalBurstPct: storm.finalBurstPct,
        _finalBurstDone: !!storm._finalBurstDone,
        blobs: Array.isArray(storm.blobs) ? storm.blobs.map(cloneStormBlob).filter(Boolean) : [],
        gfx: null,
        emojiContainer: null
      };
    }

    function applyStormSnapshot(target, storm) {
      if (!target || !storm) return;
      target.x = storm.x || 0;
      target.y = storm.y || 0;
      target.vx = storm.vx || 0;
      target.vy = storm.vy || 0;
      target.spawnedAt = storm.spawnedAt || 0;
      target.duration = storm.duration || 0;
      target.lastDirChange = storm.lastDirChange || storm.spawnedAt || 0;
      target.lastDmgTick = storm.lastDmgTick || storm.spawnedAt || 0;
      target.rotAngle = storm.rotAngle || 0;
      target.stretch = storm.stretch || 1;
      target.ownerId = storm.ownerId;
      target.tickDamagePct = storm.tickDamagePct;
      target.finalBurstPct = storm.finalBurstPct;
      target._finalBurstDone = !!storm._finalBurstDone;
      target.blobs = Array.isArray(storm.blobs) ? storm.blobs.map(cloneStormBlob).filter(Boolean) : [];
    }

    function applyGameStateInner(snap) {
      if (state._frameCtr % 300 === 0) {
        console.log(
          "[MP-SYNC] snap seq=",
          snap._seq ?? "?",
          "players=",
          (snap.players || []).length,
          "units=",
          (snap.units || []).length,
          snap._fullSync ? "FULL" : "delta"
        );
      }

      state.t = snap.t;
      state._lastSnapT = snap.t;
      state._lastSnapRealTime = Date.now();
      if (snap.timeScale != null) state.timeScale = snap.timeScale;
      if (snap.nextUnitId != null) state.nextUnitId = snap.nextUnitId;
      if (snap.nextResId != null) state.nextResId = snap.nextResId;

      const isRemote = !!(state._multiSlots && !state._multiIsHost);
      const isFull = !!snap._fullSync;
      const remoteUnitInterpMs = deriveInterpDuration(
        state._remoteSnapshotClock || (state._remoteSnapshotClock = {}),
        snap,
        NET.SEND_INTERVAL_MS,
        { minMs: 12, maxMs: 180 }
      );
      state._lastRemoteSnapIntervalMs = remoteUnitInterpMs;

      const wantPlayerIds = new Set((snap.players || []).map((p) => p.id));
      const oldPlayerColors = new Map();
      for (const [id, pl] of state.players) oldPlayerColors.set(id, pl.color);

      for (const p of snap.players || []) {
        let pl = state.players.get(p.id);
        if (!pl) {
          pl = makePlayer(p.id, p.name, p.x, p.y, p.pop ?? CFG.POP_START);
          if (p.color != null) pl.color = p.color;
          state.players.set(pl.id, pl);
          if (!p.eliminated) {
            makeCityVisual(pl);
            makeZoneVisual(pl);
          }
        }
        const pKeys = isFull ? PLAYER_FULL_SYNC_KEYS : PLAYER_LIGHT_SYNC_KEYS;
        for (const k of pKeys) {
          if (k === "influenceRayDistances" && isRemote && p.influenceRayDistances) {
            const zoneInterpMs = deriveInterpDuration(pl, snap, NET.ZONE_SYNC_INTERVAL_MS, {
              minMs: NET.ZONE_SYNC_INTERVAL_MS * 0.5,
              maxMs: NET.ZONE_SYNC_INTERVAL_MS * 3
            });
            NET.Interp.setZoneTarget(pl, p.influenceRayDistances, zoneInterpMs);
            continue;
          }
          if (k === "_patrols" && isRemote && Array.isArray(p._patrols)) {
            pl._patrols = pl._patrols || [];
            for (let i = 0; i < p._patrols.length; i++) {
              const src = p._patrols[i];
              let dst = pl._patrols[i];
              if (!dst) {
                dst = { t: 0 };
                pl._patrols.push(dst);
              }
              dst._interpFromT = dst._interpDisplayT ?? dst.t ?? 0;
              dst._interpToT = src && typeof src.t === "number" ? src.t : dst.t;
              dst._interpStart = performance.now();
              dst._interpDurationMs = Math.max(12, remoteUnitInterpMs);
              dst.t = dst._interpToT;
              if (src && src.atkCd != null) dst.atkCd = src.atkCd;
            }
            continue;
          }
          if (p[k] !== undefined) pl[k] = p[k];
        }
        if (isFull) {
          if (p.influencePolygon) pl.influencePolygon = p.influencePolygon;
          if (p.color != null) PLAYER_COLORS[p.id] = p.color;
        }
      }

      for (const p of snap.players || []) {
        const pl = state.players.get(p.id);
        if (!pl || p.color == null) continue;
        if (oldPlayerColors.get(pl.id) === p.color) continue;
        if (pl.cityGfx) {
          cityLayer.removeChild(pl.cityGfx);
          pl.cityGfx = null;
        }
        if (pl.zoneGfx) {
          zonesLayer.removeChild(pl.zoneGfx);
          pl.zoneGfx = null;
        }
        if (pl.zoneGlow) {
          zonesLayer.removeChild(pl.zoneGlow);
          pl.zoneGlow = null;
        }
        if (pl.zoneLightGfx) {
          zoneEffectsLayer.removeChild(pl.zoneLightGfx);
          pl.zoneLightGfx = null;
        }
        makeCityVisual(pl);
        makeZoneVisual(pl);
      }

      for (const pl of state.players.values()) {
        if (pl.eliminated) {
          if (pl.cityGfx) {
            cityLayer.removeChild(pl.cityGfx);
            pl.cityGfx = null;
          }
          if (pl.zoneGfx) {
            zonesLayer.removeChild(pl.zoneGfx);
            pl.zoneGfx = null;
          }
          if (pl.zoneGlow) {
            zonesLayer.removeChild(pl.zoneGlow);
            pl.zoneGlow = null;
          }
          if (pl.zoneLightGfx) {
            zoneEffectsLayer.removeChild(pl.zoneLightGfx);
            pl.zoneLightGfx = null;
          }
          if (pl.shieldGfx) {
            cityLayer.removeChild(pl.shieldGfx);
            pl.shieldGfx = null;
          }
          if (pl.popLabel && pl.popLabel.parent) {
            pl.popLabel.parent.removeChild(pl.popLabel);
            pl.popLabel = null;
          }
          if (pl.label && pl.label.parent) {
            pl.label.parent.removeChild(pl.label);
            pl.label = null;
          }
          continue;
        }
        if (!pl.cityGfx) makeCityVisual(pl);
        if (!pl.zoneGfx) makeZoneVisual(pl);
      }

      for (const id of [...state.players.keys()]) {
        if (!wantPlayerIds.has(id)) {
          const pl = state.players.get(id);
          if (pl && pl.cityGfx) {
            cityLayer.removeChild(pl.cityGfx);
            pl.cityGfx = null;
          }
          if (pl && pl.zoneGfx) {
            zonesLayer.removeChild(pl.zoneGfx);
            zonesLayer.removeChild(pl.zoneGlow);
            pl.zoneGfx = null;
            pl.zoneGlow = null;
          }
          if (pl && pl.zoneLightGfx) {
            zoneEffectsLayer.removeChild(pl.zoneLightGfx);
            pl.zoneLightGfx = null;
          }
          state.players.delete(id);
        }
      }

      const numRays = CFG.TERRAIN_RAYS ?? 96;
      for (const pl of state.players.values()) {
        if (pl.influenceRayDistances && pl.influenceRayDistances.length === numRays) {
          if (!pl._polyBuf || pl._polyBuf.length !== numRays) {
            pl._polyBuf = [];
            for (let i = 0; i < numRays; i++) pl._polyBuf.push({ x: 0, y: 0 });
          }
          for (let i = 0; i < numRays; i++) {
            const angle = (i / numRays) * Math.PI * 2;
            const d = pl.influenceRayDistances[i] ?? 0;
            pl._polyBuf[i].x = pl.x + Math.cos(angle) * d;
            pl._polyBuf[i].y = pl.y + Math.sin(angle) * d;
          }
          pl.influencePolygon = pl._polyBuf;
        } else if (!pl.influencePolygon || pl.influencePolygon.length < 3) {
          const popFloat = pl.popFloat != null ? pl.popFloat : pl.pop;
          const poly = computeInfluencePolygon(pl.x, pl.y, popFloat);
          if (poly && poly.length >= 3) {
            pl.influencePolygon = poly;
            pl.influenceRayDistances = poly.map((pt) => Math.hypot(pt.x - pl.x, pt.y - pl.y));
          }
        }
      }

      const wantUnitIds = new Set();
      for (const raw of snap.units || []) {
        const isCompact = Array.isArray(raw);
        const uid = isCompact ? raw[0] : raw.id;

        if (isCompact && raw.length === 2 && raw[1] === NET.DESTROYED_SENTINEL) {
          const dead = state.units.get(uid);
          if (dead) {
            if (state.floatingDamage) {
              state.floatingDamage.push({ x: dead.x, y: dead.y - 16, text: "💥", color: dead.color || 0xff4444, ttl: 0.8 });
            }
            if (!state._deathBursts) state._deathBursts = [];
            state._deathBursts.push({ x: dead.x, y: dead.y, color: dead.color || 0xff4444, t0: state.t, duration: 0.4, maxRadius: 18 });
            if (dead.gfx) unitsLayer.removeChild(dead.gfx);
            state.units.delete(uid);
          }
          continue;
        }

        wantUnitIds.add(uid);
        let un = state.units.get(uid);

        if (isCompact) {
          const sx = raw[1], sy = raw[2], svx = raw[3], svy = raw[4], shp = raw[5];
          if (!un) continue;
          if (isRemote) {
            const unitInterpMs = deriveInterpDuration(un, snap, remoteUnitInterpMs, {
              minMs: 12,
              maxMs: 220
            });
            NET.Interp.setTarget(un, sx, sy, svx, svy, shp, unitInterpMs);
          }
          else {
            un.x = sx;
            un.y = sy;
            un.vx = svx;
            un.vy = svy;
            un.hp = shp;
          }
        } else {
          if (!un) {
            un = { ...raw, gfx: null };
            state.units.set(un.id, un);
            if (isRemote) {
              const unitInterpMs = deriveInterpDuration(un, snap, remoteUnitInterpMs, {
                minMs: 12,
                maxMs: 220
              });
              NET.Interp.setTarget(un, raw.x, raw.y, raw.vx || 0, raw.vy || 0, raw.hp, unitInterpMs);
            }
          } else if (isRemote) {
            const unitInterpMs = deriveInterpDuration(un, snap, remoteUnitInterpMs, {
              minMs: 12,
              maxMs: 220
            });
            NET.Interp.setTarget(un, raw.x, raw.y, raw.vx || 0, raw.vy || 0, raw.hp, unitInterpMs);
            for (const k of UNIT_FULL_SYNC_KEYS) {
              if (k === "x" || k === "y") continue;
              if (raw[k] !== undefined) un[k] = raw[k];
            }
          } else {
            for (const k of UNIT_FULL_SYNC_KEYS) {
              if (raw[k] !== undefined) un[k] = raw[k];
            }
          }
          if (!un.gfx) makeUnitVisual(un);
        }
      }

      if (isFull) {
        for (const id of [...state.units.keys()]) {
          if (!wantUnitIds.has(id)) {
            const u = state.units.get(id);
            if (u) {
              if (state.floatingDamage) {
                state.floatingDamage.push({ x: u.x, y: u.y - 16, text: "💥", color: u.color || 0xff4444, ttl: 0.8 });
              }
              if (!state._deathBursts) state._deathBursts = [];
              state._deathBursts.push({ x: u.x, y: u.y, color: u.color || 0xff4444, t0: state.t, duration: 0.4, maxRadius: 18 });
              if (u.gfx) unitsLayer.removeChild(u.gfx);
            }
            state.units.delete(id);
          }
        }
      }

      if (snap.bullets) state.bullets = snap.bullets;

      if (snap.shieldHitEffects) {
        if (!state._shieldHitEffects) state._shieldHitEffects = [];
        for (const e of snap.shieldHitEffects) {
          const exists = state._shieldHitEffects.some(
            (ex) =>
              Math.abs(ex.t0 - e.t0) < 0.05 &&
              Math.abs(ex.hitX - e.hitX) < 2 &&
              Math.abs(ex.hitY - e.hitY) < 2
          );
          if (!exists) state._shieldHitEffects.push({ ...e });
        }
      }
      if (snap.abilityAnnouncements) {
        if (!state._abilityAnnouncements) state._abilityAnnouncements = [];
        for (const a of snap.abilityAnnouncements) {
          const dup = state._abilityAnnouncements.some((ex) => ex.text === a.text && (ex.t0 || 0) > state.t - 3);
          if (!dup) state._abilityAnnouncements.push({ text: a.text, ttl: a.ttlRemaining ?? 4, t0: state.t });
        }
        while (state._abilityAnnouncements.length > 8) state._abilityAnnouncements.shift();
      }

      if (snap.resDelta && !snap.resources) {
        for (const entry of snap.resDelta) {
          const [id, x, y, targetCity] = entry;
          const res = state.res.get(id);
          if (res) {
            const resInterpMs = deriveInterpDuration(res, snap, NET.ZONE_SYNC_INTERVAL_MS, {
              minMs: NET.ZONE_SYNC_INTERVAL_MS * 0.45,
              maxMs: NET.ZONE_SYNC_INTERVAL_MS * 3
            });
            NET.Interp.setResTarget(res, x, y, resInterpMs);
            if (targetCity !== undefined) res._targetCity = targetCity;
          }
        }
      }
      if (snap.resources) {
        const wantResIds = new Set(snap.resources.map((r) => r.id));
        for (const r of snap.resources) {
          let res = state.res.get(r.id);
          if (!res) {
            res = { ...r, gfx: null };
            state.res.set(res.id, res);
            makeResVisual(res);
          } else {
            const resInterpMs = deriveInterpDuration(res, snap, NET.ZONE_SYNC_INTERVAL_MS, {
              minMs: NET.ZONE_SYNC_INTERVAL_MS * 0.45,
              maxMs: NET.ZONE_SYNC_INTERVAL_MS * 3
            });
            NET.Interp.setResTarget(res, r.x, r.y, resInterpMs);
            res.xp = r.xp;
            res.type = r.type;
            res.color = r.color;
            if (r.value != null) res.value = r.value;
            if (r._targetCity !== undefined) res._targetCity = r._targetCity;
            if (r._interceptProtectUntil !== undefined) res._interceptProtectUntil = r._interceptProtectUntil;
            res._visualOnly = !!r._visualOnly;
          }
        }
        for (const id of [...state.res.keys()]) {
          if (!wantResIds.has(id)) deleteResource(id);
        }
      }

      if (snap.turrets) {
        const wantTurretIds = new Set(snap.turrets.map((t) => t.id));
        for (const t of snap.turrets) {
          let tu = state.turrets.get(t.id);
          if (!tu) {
            tu = { ...t, gfx: null, labelGfx: null, radiusGfx: null, atkCd: 0 };
            state.turrets.set(tu.id, tu);
          } else {
            tu.hp = t.hp;
            tu.maxHp = t.maxHp;
            tu.x = t.x;
            tu.y = t.y;
            if (t._diedAt != null) tu._diedAt = t._diedAt;
            else delete tu._diedAt;
          }
        }
        for (const id of [...state.turrets.keys()]) {
          if (!wantTurretIds.has(id)) {
            const tu = state.turrets.get(id);
            if (tu && tu.gfx) turretLayer.removeChild(tu.gfx);
            if (tu && tu.labelGfx) turretLayer.removeChild(tu.labelGfx);
            if (tu && tu.radiusGfx) turretLayer.removeChild(tu.radiusGfx);
            state.turrets.delete(id);
          }
        }
      }

      if (snap.storm !== undefined) {
        if (snap.storm === null) {
          if (state.storm) {
            destroyIonStormVisual(state.storm);
            state.storm = null;
          }
        } else if (!state.storm) {
          state.storm = { ...snap.storm, gfx: null, particles: [] };
          const stormInterpMs = deriveInterpDuration(state.storm, snap, remoteUnitInterpMs, {
            minMs: 12,
            maxMs: 220
          });
          NET.Interp.setStormTarget(state.storm, snap.storm.x, snap.storm.y, snap.storm.vx, snap.storm.vy, stormInterpMs);
        } else {
          const stormInterpMs = deriveInterpDuration(state.storm, snap, remoteUnitInterpMs, {
            minMs: 12,
            maxMs: 220
          });
          NET.Interp.setStormTarget(state.storm, snap.storm.x, snap.storm.y, snap.storm.vx, snap.storm.vy, stormInterpMs);
          if (isFull) {
            state.storm.spawnedAt = snap.storm.spawnedAt;
            state.storm.lastDirChange = snap.storm.lastDirChange;
            state.storm.lastDmgTick = snap.storm.lastDmgTick;
            state.storm.rotAngle = snap.storm.rotAngle;
            state.storm.stretch = snap.storm.stretch;
            state.storm.blobs = snap.storm.blobs;
          }
        }
      }

      if (snap.meteors) {
        for (const m of state._activeMeteors) removeMeteorGfx(m);
        state._activeMeteors = snap.meteors.map((m) => ({ ...m, gfx: null, trajGfx: null }));
      } else if (state._activeMeteors && state._activeMeteors.length) {
        for (const m of state._activeMeteors) removeMeteorGfx(m);
        state._activeMeteors = [];
      }

      if (snap.orbitalStrikes) {
        for (const strike of state._orbitalStrikes || []) destroyOrbitalStrikeVisual(strike);
        state._orbitalStrikes = snap.orbitalStrikes.map((strike) => ({
          ...strike,
          shots: (strike.shots || []).map((shot) => ({ ...shot })),
          gfx: null
        }));
      } else if (state._orbitalStrikes && state._orbitalStrikes.length) {
        for (const strike of state._orbitalStrikes || []) destroyOrbitalStrikeVisual(strike);
        state._orbitalStrikes = [];
      }

      if (snap.thermoNukes) {
        for (const strike of state._thermoNukes || []) destroyThermoNukeVisual(strike);
        state._thermoNukes = snap.thermoNukes.map((strike) => ({
          ...strike,
          gfx: null,
          trajGfx: null,
          overlayGfx: null
        }));
      } else if (state._thermoNukes && state._thermoNukes.length) {
        for (const strike of state._thermoNukes || []) destroyThermoNukeVisual(strike);
        state._thermoNukes = [];
      }

      if (snap.pirateRaids) {
        for (const raid of state._pirateRaids || []) destroyPirateRaidVisual(raid);
        state._pirateRaids = snap.pirateRaids.map((raid) => ({
          ...raid,
          gfx: null
        }));
      } else if (state._pirateRaids && state._pirateRaids.length) {
        for (const raid of state._pirateRaids || []) destroyPirateRaidVisual(raid);
        state._pirateRaids = [];
      }

      if (snap.economyAbilityFx) {
        for (const effect of state._economyAbilityFx || []) destroyEconomyAbilityVisual(effect);
        state._economyAbilityFx = snap.economyAbilityFx.map((effect) => ({
          ...effect,
          gfx: null,
          trajGfx: null,
          overlayGfx: null
        }));
      } else if (state._economyAbilityFx && state._economyAbilityFx.length) {
        for (const effect of state._economyAbilityFx || []) destroyEconomyAbilityVisual(effect);
        state._economyAbilityFx = [];
      }

      if (snap.abilityZoneEffects) {
        for (const zone of state._abilityZoneEffects || []) destroyAbilityZoneVisual(zone);
        state._abilityZoneEffects = snap.abilityZoneEffects.map((zone) => ({
          ...zone,
          gfx: null
        }));
      } else if (state._abilityZoneEffects && state._abilityZoneEffects.length) {
        for (const zone of state._abilityZoneEffects || []) destroyAbilityZoneVisual(zone);
        state._abilityZoneEffects = [];
      }

      if (snap.abilityStorms && !state._multiIsHost) {
        while (state._abilityStorms.length > snap.abilityStorms.length) {
          const s = state._abilityStorms.pop();
          destroyIonStormVisual(s);
        }
        for (let i = 0; i < snap.abilityStorms.length; i++) {
          const incoming = snap.abilityStorms[i];
          const current = state._abilityStorms[i];
          const sameStorm = current
            && Math.abs((current.spawnedAt || 0) - (incoming.spawnedAt || 0)) < 0.0001
            && Math.abs((current.x || 0) - (incoming.x || 0)) < 8
            && Math.abs((current.y || 0) - (incoming.y || 0)) < 8;
          if (!sameStorm) {
            if (current) destroyIonStormVisual(current);
            state._abilityStorms[i] = createStormFromSnapshot(incoming);
            continue;
          }
          applyStormSnapshot(current, incoming);
        }
      } else if (state._abilityStorms && state._abilityStorms.length && !state._multiIsHost) {
        for (const s of state._abilityStorms) destroyIonStormVisual(s);
        state._abilityStorms = [];
      }

      if (snap.abilityCooldownsByPlayer) {
        state._abilityCooldownsByPlayer = {};
        for (const pid of Object.keys(snap.abilityCooldownsByPlayer)) {
          state._abilityCooldownsByPlayer[pid] = { ...snap.abilityCooldownsByPlayer[pid] };
        }
      }
      if (snap.abilityUsedByPlayer) {
        state._abilityUsedByPlayer = {};
        for (const pid of Object.keys(snap.abilityUsedByPlayer)) {
          state._abilityUsedByPlayer[pid] = (snap.abilityUsedByPlayer[pid] || []).slice();
        }
      }

      if (snap.mines) {
        const wantMineIds = new Set(snap.mines.map((m) => m.id));
        for (const m of snap.mines) {
          let mine = state.mines.get(m.id);
          if (!mine) {
            mine = { ...m, gfx: null, yieldAcc: 0 };
            state.mines.set(mine.id, mine);
            makeMineVisual(mine);
          } else {
            const nextResourceType = m.resourceType || "money";
            const changed =
              mine.x !== m.x ||
              mine.y !== m.y ||
              mine.ownerId !== m.ownerId ||
              mine.captureProgress !== m.captureProgress ||
              mine.isRich !== !!m.isRich ||
              mine.resourceType !== nextResourceType;
            mine.x = m.x;
            mine.y = m.y;
            mine.ownerId = m.ownerId;
            mine.captureProgress = m.captureProgress;
            mine.capturingUnitId = m.capturingUnitId;
            mine.isRich = !!m.isRich;
            mine.resourceType = nextResourceType;
            if (m.homeMine != null) mine.homeMine = m.homeMine;
            if (m.pairKey != null) mine.pairKey = m.pairKey;
            if (m.laneRole != null) mine.laneRole = m.laneRole;
            if (changed) updateMineVisual(mine);
          }
        }
        for (const id of [...state.mines.keys()]) {
          if (!wantMineIds.has(id)) {
            const mine = state.mines.get(id);
            if (mine && mine.gfx) {
              if (mine.gfx.parent) mine.gfx.parent.removeChild(mine.gfx);
              mine.gfx.destroy(true);
            }
            state.mines.delete(id);
          }
        }
      }

      if (snap.mineFlows) {
        const wantedFlowIds = new Set();
        for (const f of snap.mineFlows) {
          wantedFlowIds.add(f.id);
          const mine = state.mines.get(f.id);
          if (!mine) continue;
          mine._flowRate = f.rate || 0;
          mine._flowTargetPlayerId = f.targetPlayerId != null ? f.targetPlayerId : mine.ownerId;
          mine._flowVisualTargetPlayerId = f.visualTargetPlayerId != null ? f.visualTargetPlayerId : null;
          mine._flowInterceptUnitId = f.interceptUnitId != null ? f.interceptUnitId : null;
          mine._flowInterceptX = f.interceptX != null ? f.interceptX : null;
          mine._flowInterceptY = f.interceptY != null ? f.interceptY : null;
          mine._flowInterceptT = f.interceptT != null ? f.interceptT : null;
          mine._flowPhase = f.phase || "none";
          mine._flowPhaseStartedAt = f.phaseStartedAt != null ? f.phaseStartedAt : state.t;
          mine._flowVersion = f.version || 0;
        }
        for (const mine of state.mines.values()) {
          if (mine.ownerId && mine.captureProgress >= 1 && !wantedFlowIds.has(mine.id)) {
            mine._flowRate = 0;
            mine._flowTargetPlayerId = mine.ownerId;
            mine._flowVisualTargetPlayerId = null;
            mine._flowInterceptUnitId = null;
            mine._flowInterceptX = null;
            mine._flowInterceptY = null;
            mine._flowInterceptT = null;
            mine._flowPhase = "none";
            mine._flowPhaseStartedAt = state.t;
          }
        }
      } else if (snap._fullSync) {
        for (const mine of state.mines.values()) {
          mine._flowRate = 0;
          mine._flowTargetPlayerId = mine.ownerId;
          mine._flowVisualTargetPlayerId = null;
          mine._flowInterceptUnitId = null;
          mine._flowInterceptX = null;
          mine._flowInterceptY = null;
          mine._flowInterceptT = null;
          mine._flowPhase = "none";
          mine._flowPhaseStartedAt = state.t;
        }
      }

      if (!state._multiIsHost) {
        if (snap.blackHoles) {
          const prevBlackHoles = state._blackHoles || [];
          const nextBlackHoles = [];
          for (let i = 0; i < snap.blackHoles.length; i++) {
            const incoming = snap.blackHoles[i];
            const prev = prevBlackHoles[i];
            if (prev) {
              prev.x = incoming.x;
              prev.y = incoming.y;
              prev.ownerId = incoming.ownerId;
              prev.spawnedAt = incoming.spawnedAt;
              prev.duration = incoming.duration;
              prev.radius = incoming.radius;
              prev.styleKey = incoming.styleKey || null;
              prev.damageScale = incoming.damageScale != null ? incoming.damageScale : 1;
              prev.finalBurstPct = incoming.finalBurstPct != null ? incoming.finalBurstPct : 0.1;
              nextBlackHoles.push(prev);
            } else {
              nextBlackHoles.push({ ...incoming, _bodyContainer: null, _debrisGfx: null, phase: 0 });
            }
          }
          for (let i = snap.blackHoles.length; i < prevBlackHoles.length; i++) destroyBlackHoleVisual(prevBlackHoles[i]);
          state._blackHoles = nextBlackHoles;
        } else if (state._blackHoles && state._blackHoles.length) {
          for (const bh of state._blackHoles) destroyBlackHoleVisual(bh);
          state._blackHoles = [];
        }
      }

      if (snap.pirateBase) {
        if (!state.pirateBase) {
          state.pirateBase = { x: 0, y: 0, hp: 4000, maxHp: 4000, gfx: null, _emojiGfx: null, spawnCd: 0, unitLimit: 12 };
        }
        state.pirateBase.x = snap.pirateBase.x;
        state.pirateBase.y = snap.pirateBase.y;
        state.pirateBase.hp = snap.pirateBase.hp;
        state.pirateBase.maxHp = snap.pirateBase.maxHp;
        if (snap.pirateBase.orbitCenter) state.pirateBase.orbitCenter = snap.pirateBase.orbitCenter;
        if (snap.pirateBase.orbitRadius) state.pirateBase.orbitRadius = snap.pirateBase.orbitRadius;
      } else if (Object.prototype.hasOwnProperty.call(snap, "pirateBase")) {
        if (state.pirateBase && state.pirateBase._emojiGfx) {
          state.pirateBase._emojiGfx.destroy();
        }
        state.pirateBase = null;
      }
      if (snap.battleMarchUntil) state._battleMarchUntil = { ...snap.battleMarchUntil };
      if (snap.hyperFlashes) state._hyperFlashes = snap.hyperFlashes;
      if (snap.nextEngagementZoneId != null) state.nextEngagementZoneId = snap.nextEngagementZoneId;
      if (snap.coreFrontPolicies) state.coreFrontPolicies = JSON.parse(JSON.stringify(snap.coreFrontPolicies));
      else if (isFull) state.coreFrontPolicies = {};
      if (snap.frontGraph) state.frontGraph = JSON.parse(JSON.stringify(snap.frontGraph));
      else if (isFull) state.frontGraph = {};
      if (snap.squadFrontAssignments) state.squadFrontAssignments = JSON.parse(JSON.stringify(snap.squadFrontAssignments));
      else if (isFull) state.squadFrontAssignments = {};
      if (snap.centerObjectives) state.centerObjectives = JSON.parse(JSON.stringify(snap.centerObjectives));
      else if (isFull) state.centerObjectives = { centerX: 0, centerY: 0, richMineId: null, centerMineIds: [], pirateBaseIds: [], livePirateBaseIds: [], securedByPlayerId: null, requiredMineCount: 0 };
      if (typeof syncSectorObjectivesFromSnapshot === "function") syncSectorObjectivesFromSnapshot(snap.sectorObjectives, isFull);

      if (snap.squads && typeof SQUADLOGIC !== "undefined") {
        if (!state.squads) state.squads = new Map();
        const wantSquadIds = new Set(snap.squads.map((s) => s.id));
        for (const sq of snap.squads) {
          let existing = state.squads.get(sq.id);
          if (!existing) {
            existing = {
              id: sq.id,
              leaderUnitId: sq.leaderUnitId,
              unitIds: sq.unitIds || [],
              ownerId: sq.ownerId,
              formation: { type: "line", rows: 3, facing: 0, dirty: false, dirtyAt: 0 },
              combat: { mode: "idle", zoneId: null, _disengageTimer: null, queuedOrder: null, resumeOrder: null, combatTargetSquadId: null },
              anchor: { x: 0, y: 0 },
              order: { type: "idle", waypoints: [], holdPoint: null }
            };
            state.squads.set(sq.id, existing);
          }
          existing.leaderUnitId = sq.leaderUnitId;
          existing.unitIds = sq.unitIds || [];
          existing.ownerId = sq.ownerId;
          if (sq.formation) {
            existing.formation.type = sq.formation.type || "line";
            existing.formation.rows = sq.formation.rows || 3;
            existing.formation.facing = sq.formation.facing || 0;
            if (sq.formation.targetFacing != null) existing.formation.targetFacing = sq.formation.targetFacing;
            if (sq.formation.pigWidth != null) existing.formation.pigWidth = sq.formation.pigWidth;
          }
          if (sq.combat) {
            existing.combat.mode = sq.combat.mode || "idle";
            existing.combat.zoneId = sq.combat.zoneId;
            existing.combat.focusTargetUnitId = sq.combat.focusTargetUnitId;
            existing.combat.queuedOrder = sq.combat.queuedOrder || null;
            existing.combat.resumeOrder = sq.combat.resumeOrder || null;
            existing.combat.combatTargetSquadId = sq.combat.combatTargetSquadId ?? null;
          }
          if (sq.anchor) {
            existing.anchor.x = sq.anchor.x;
            existing.anchor.y = sq.anchor.y;
          }
          if (sq.order) {
            existing.order.type = sq.order.type || "idle";
            existing.order.waypoints = sq.order.waypoints || [];
            existing.order.holdPoint = sq.order.holdPoint || null;
            existing.order.targetUnitId = sq.order.targetUnitId;
            existing.order.targetCityId = sq.order.targetCityId;
            existing.order.targetPirateBase = !!sq.order.targetPirateBase;
            existing.order.mineId = sq.order.mineId;
          }
          for (const uid of existing.unitIds) {
            const u = state.units.get(uid);
            if (u) {
              u.squadId = sq.id;
              u.leaderId = uid === sq.leaderUnitId ? null : sq.leaderUnitId;
            }
          }
        }
        for (const id of [...state.squads.keys()]) {
          if (!wantSquadIds.has(id)) state.squads.delete(id);
        }
        if (state.nextSquadId == null || state.nextSquadId <= Math.max(...wantSquadIds, 0)) {
          state.nextSquadId = Math.max(...wantSquadIds, 0) + 1;
        }
      }

      if (snap.engagementZones) {
        if (!state.engagementZones) state.engagementZones = new Map();
        const wantZoneIds = new Set(snap.engagementZones.map((z) => z.id));
        for (const z of snap.engagementZones) {
          let existing = state.engagementZones.get(z.id);
          if (!existing) {
            existing = { id: z.id, squadIds: [], anchorX: null, anchorY: null, radius: 0, displayRadius: 0, createdAt: state.t };
            state.engagementZones.set(z.id, existing);
          }
          existing.squadIds = z.squadIds || [];
          existing.anchorX = z.anchorX;
          existing.anchorY = z.anchorY;
          existing.radius = z.radius;
          existing.displayRadius = z.displayRadius;
          existing.createdAt = z.createdAt;
          existing.owners = z.owners || [];
          existing.balanceSegments = z.balanceSegments || [];
        }
        for (const id of [...state.engagementZones.keys()]) {
          if (!wantZoneIds.has(id)) state.engagementZones.delete(id);
        }
      }

      if (snap.timeScale != null) {
        document.querySelectorAll(".speed-btn").forEach((b) => {
          const s = parseInt(b.dataset.speed, 10) || 1;
          b.classList.toggle("active", s === state.timeScale);
        });
      }
    }

    return {
      applyGameState
    };
  }

  const api = { install };
  if (typeof window !== "undefined") window.SnapshotSync = api;
  if (typeof module !== "undefined") module.exports = api;
})();
