/**
 * NetEngine — networking module for VoidFront multiplayer.
 *
 * Architecture:
 *   Host (authoritative) runs simulation, sends snapshots at fixed 30 Hz.
 *   Remote clients buffer snapshots and interpolate between them for smooth rendering.
 *
 * Sync schedule (host → clients):
 *   Every tick  (33 ms) — unit delta, players (basic), storm, bullets
 *   Every 8 ticks (266 ms) — zone rays, compact resource positions
 *   Every 30 ticks (1 s)  — full unit objects, turrets, full resources, all player data
 */
(function () {
  "use strict";

  // ─── Protocol constants ─────────────────────────────────────────

  const SEND_RATE_HZ           = 30;
  const SEND_INTERVAL_MS       = 1000 / SEND_RATE_HZ;           // ~33.3 ms
  const FULL_SYNC_EVERY        = 15;                             // every 15 ticks ≈ 0.5 s
  const ZONE_SYNC_EVERY        = 8;                              // zone rays every 8 ticks
  const ZONE_SYNC_INTERVAL_MS  = ZONE_SYNC_EVERY * SEND_INTERVAL_MS; // ~266 ms
  const TELEPORT_DIST          = 400;                            // snap instead of lerp
  const MAX_EXTRAP_SEC         = 0.30;                           // clamp extrapolation
  const PING_INTERVAL_MS       = 2000;                           // how often to ping
  const DESTROYED_SENTINEL     = -1;                             // compact[1] === -1

  const PLAYER_LIGHT_KEYS = [
    "id", "x", "y", "pop", "popFloat", "eCredits", "activeUnits",
    "influenceR", "influenceRayDistances", "eliminated"
  ];
  const PLAYER_SYNC_KEYS = [
    "id", "name", "x", "y", "pop", "popFloat", "eCredits",
    "level", "xp", "xpNext",
    "activeUnits", "deadUnits", "influenceR",
    "turretIds", "waterBonus", "color",
    "turretDmgMul", "turretHpMul", "turretRangeMul",
    "unitHpMul", "unitDmgMul", "unitSpeedMul",
    "unitAtkRateMul", "unitAtkRangeMul",
    "growthMul", "influenceSpeedMul", "unitCostMul",
    "pendingCardPicks", "xpZonePct", "xpGainMul",
    "_levelBonusMul", "rerollCount",
    "shieldHp", "shieldMaxHp", "shieldRegenCd", "shieldRegenBonus", "_cardPicksCount",
    "mineYieldBonus", "cityTargetBonus", "turretTargetBonus", "attackEffect", "attackEffects",
    "_patrolCount", "_patrols", "eliminated"
  ];
  const PLAYER_FULL_KEYS = [
    ...PLAYER_SYNC_KEYS,
    "influencePolygon", "influenceRayDistances",
    "buffHand", "abilityHand", "activeBuffs", "legendaryBuffs",
    "nextCardInstanceId", "cardStateVersion"
  ];
  const UNIT_LIGHT_KEYS = ["id", "x", "y", "vx", "vy", "hp"];
  const UNIT_FULL_KEYS = [
    "id", "owner", "x", "y", "vx", "vy", "hp", "maxHp", "dmg", "atkCd",
    "unitType", "attackRange", "maxTargets", "speed", "popPenalty",
    "leaderId", "formationOffsetX", "formationOffsetY", "color",
    "chaseTargetUnitId", "chaseTargetCityId",
    "waypoints", "waypointIndex", "formationType", "formationRows",
    "formationPigWidth", "straightMode",
    "_cryoSlowUntil", "_cryoSlowAmount", "_fireDotUntil", "_fireDotDps",
    "regenPerSec", "orbitTarget", "_activeShieldHp", "_hyperArrivalFlash", "_pirateHyperUntil",
    "squadId", "_combatState", "_orderType", "_formationAngle", "_lastFacingAngle"
  ];

  // ─── Utility ─────────────────────────────────────────────────────

  function roundN(v, n) { return Math.round(v * n) / n; }
  function lerpVal(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // ─── PingTracker ─────────────────────────────────────────────────

  class PingTracker {
    constructor() {
      this.rtt           = 50;
      this.smoothRtt     = 50;
      this.jitter        = 10;
      this._samples      = [];
      this._maxSamples   = 20;
      this._seq          = 0;
      this._pending      = new Map();
      this._intervalId   = null;
    }

    start(socket) {
      this.stop();
      this._socket = socket;
      this._sendPing();
      this._intervalId = setInterval(() => this._sendPing(), PING_INTERVAL_MS);
    }

    stop() {
      if (this._intervalId != null) clearInterval(this._intervalId);
      this._intervalId = null;
      this._pending.clear();
    }

    _sendPing() {
      if (!this._socket) return;
      const seq = ++this._seq;
      this._pending.set(seq, performance.now());
      this._socket.emit("net:ping", seq);
    }

    onPong(seq) {
      const sent = this._pending.get(seq);
      if (sent == null) return;
      this._pending.delete(seq);
      const rtt = performance.now() - sent;

      this._samples.push(rtt);
      if (this._samples.length > this._maxSamples) this._samples.shift();

      const avg = this._samples.reduce((a, b) => a + b, 0) / this._samples.length;
      const variance = this._samples.reduce((s, v) => s + (v - avg) ** 2, 0) / this._samples.length;
      this.rtt = rtt;
      this.smoothRtt = avg;
      this.jitter = Math.sqrt(variance);
    }

    getInterpDurationMs() {
      return SEND_INTERVAL_MS + clamp(this.jitter, 0, 60);
    }
  }

  // ─── SendScheduler ──────────────────────────────────────────────

  class SendScheduler {
    constructor(rateHz) {
      this.intervalMs  = 1000 / (rateHz || SEND_RATE_HZ);
      this.accumulator = 0;
      this.running     = false;
    }
    start()  { this.running = true; this.accumulator = 0; }
    stop()   { this.running = false; this.accumulator = 0; }
    update(dtMs) {
      if (!this.running) return false;
      this.accumulator += dtMs;
      if (this.accumulator >= this.intervalMs) {
        this.accumulator -= this.intervalMs;
        if (this.accumulator > this.intervalMs * 3) this.accumulator = 0;
        return true;
      }
      return false;
    }
  }

  // ─── SnapshotSerializer (host side) ──────────────────────────────

  class SnapshotSerializer {
    constructor() {
      this.seq       = 0;
      this.tickCount = 0;
      this._prev     = new Map();
      this._dt       = { pos: 0.5, vel: 0.01, hp: 0.1 };
    }

    reset() {
      this.seq = 0;
      this.tickCount = 0;
      this._prev.clear();
    }

    serialize(state) {
      this.tickCount++;
      const seq        = ++this.seq;
      const isFull     = (this.tickCount % FULL_SYNC_EVERY === 0);
      const isZoneSync = isFull || (this.tickCount % ZONE_SYNC_EVERY === 0);
      const serverTime = performance.now();
      const pKeys      = isFull ? PLAYER_FULL_KEYS : PLAYER_LIGHT_KEYS;

      const players = [];
      for (const p of state.players.values()) {
        const o = {};
        for (const k of pKeys) {
          if (k === "influenceRayDistances" && !isZoneSync) continue;
          if (p[k] !== undefined) o[k] = p[k];
        }
        players.push(o);
      }

      let units;
      if (isFull) {
        units = [];
        for (const u of state.units.values()) {
          const o = {};
          for (const k of UNIT_FULL_KEYS) if (u[k] !== undefined) o[k] = u[k];
          units.push(o);
        }
        this._rebuildPrev(state);
      } else {
        units = this._deltaUnits(state);
      }

      const gs = {
        _seq: seq,
        _st: serverTime,
        _fullSync: isFull,
        t: state.t,
        nextUnitId: state.nextUnitId,
        timeScale: state.timeScale ?? 1,
        players,
        units,
        // Bullets in every packet — short-lived, need smooth visual on remote clients
        bullets: state.bullets.slice()
      };

      if (state.mines && state.mines.size > 0) {
        gs.mineFlows = [];
        for (const m of state.mines.values()) {
          if (!m.ownerId || m.captureProgress < 1) continue;
          gs.mineFlows.push({
            id: m.id,
            rate: roundN(m._flowRate || 0, 1000),
            targetPlayerId: m._flowTargetPlayerId,
            visualTargetPlayerId: m._flowVisualTargetPlayerId,
            interceptUnitId: m._flowInterceptUnitId,
            interceptX: m._flowInterceptX != null ? roundN(m._flowInterceptX, 10) : null,
            interceptY: m._flowInterceptY != null ? roundN(m._flowInterceptY, 10) : null,
            interceptT: m._flowInterceptT != null ? roundN(m._flowInterceptT, 1000) : null,
            phase: m._flowPhase || "none",
            phaseStartedAt: m._flowPhaseStartedAt != null ? roundN(m._flowPhaseStartedAt, 1000) : state.t,
            version: m._flowVersion || 0
          });
        }
      }

      if (isZoneSync && !isFull) {
        const resDelta = [];
        for (const r of state.res.values()) {
          const entry = [r.id, roundN(r.x, 10), roundN(r.y, 10)];
          if (r._targetCity != null) entry.push(r._targetCity);
          resDelta.push(entry);
        }
        gs.resDelta = resDelta;
      }

      if (isFull) {
        gs.nextResId = state.nextResId;
        gs.nextEngagementZoneId = state.nextEngagementZoneId;

        const turrets = [];
        for (const t of state.turrets.values()) {
          const o = { id: t.id, owner: t.owner, x: t.x, y: t.y,
                      nx: t.nx, ny: t.ny, hp: t.hp, maxHp: t.maxHp };
          if (t._diedAt != null) o._diedAt = t._diedAt;
          turrets.push(o);
        }
        gs.turrets = turrets;

        const resources = [];
        for (const r of state.res.values()) {
          const ro = { id: r.id, type: r.type, xp: r.xp,
                       x: r.x, y: r.y, color: r.color };
          if (r.type === "credit") {
            ro.value = r.value;
            if (r._targetCity != null) ro._targetCity = r._targetCity;
            if (r._interceptProtectUntil != null) ro._interceptProtectUntil = r._interceptProtectUntil;
            if (r.isCredit) ro.isCredit = true;
            if (r._visualOnly) ro._visualOnly = true;
          }
          if (r.type === "orb" && r._targetCity != null) {
            ro._targetCity = r._targetCity;
            if (r._interceptProtectUntil != null) ro._interceptProtectUntil = r._interceptProtectUntil;
            if (r._visualOnly) ro._visualOnly = true;
          }
          resources.push(ro);
        }
        gs.resources = resources;

        gs.squads = [];
        if (state.squads && state.squads.size > 0) {
          for (const sq of state.squads.values()) {
            gs.squads.push({
              id: sq.id, leaderUnitId: sq.leaderUnitId,
              unitIds: sq.unitIds ? sq.unitIds.slice() : [],
              ownerId: sq.ownerId,
              formation: {
                type: sq.formation?.type || "line",
                rows: sq.formation?.rows || 3,
                facing: roundN(sq.formation?.facing || 0, 1000),
                targetFacing: sq.formation?.targetFacing != null ? roundN(sq.formation.targetFacing, 1000) : undefined,
                pigWidth: sq.formation?.pigWidth,
                dirty: sq.formation?.dirty
              },
              combat: {
                mode: sq.combat?.mode || "idle",
                zoneId: sq.combat?.zoneId,
                focusTargetUnitId: sq.combat?.focusTargetUnitId,
                queuedOrder: sq.combat?.queuedOrder || null,
                resumeOrder: sq.combat?.resumeOrder || null,
                combatTargetSquadId: sq.combat?.combatTargetSquadId ?? null
              },
              anchor: sq.anchor ? { x: roundN(sq.anchor.x, 10), y: roundN(sq.anchor.y, 10) } : null,
              order: sq.order ? {
                type: sq.order.type || "idle",
                waypoints: (sq.order.waypoints || []).map(w => ({ x: roundN(w.x, 10), y: roundN(w.y, 10) })),
                holdPoint: sq.order.holdPoint ? { x: roundN(sq.order.holdPoint.x, 10), y: roundN(sq.order.holdPoint.y, 10) } : null,
                targetUnitId: sq.order.targetUnitId,
                targetCityId: sq.order.targetCityId,
                targetPirateBase: !!sq.order.targetPirateBase,
                mineId: sq.order.mineId
              } : null
            });
          }
        }

        gs.engagementZones = [];
        if (state.engagementZones && state.engagementZones.size > 0) {
          for (const z of state.engagementZones.values()) {
            gs.engagementZones.push({
              id: z.id, squadIds: z.squadIds ? z.squadIds.slice() : [],
              anchorX: z.anchorX != null ? roundN(z.anchorX, 10) : null,
              anchorY: z.anchorY != null ? roundN(z.anchorY, 10) : null,
              radius: roundN(z.radius || 0, 10),
              displayRadius: roundN(z.displayRadius || 0, 10),
              createdAt: z.createdAt, owners: z.owners || [],
              balanceSegments: z.balanceSegments || []
            });
          }
        }

        if (state.coreFrontPolicies) {
          gs.coreFrontPolicies = JSON.parse(JSON.stringify(state.coreFrontPolicies));
        }
        if (state.frontGraph) {
          gs.frontGraph = JSON.parse(JSON.stringify(state.frontGraph));
        }
        if (state.squadFrontAssignments) {
          gs.squadFrontAssignments = JSON.parse(JSON.stringify(state.squadFrontAssignments));
        }
        if (state.centerObjectives) {
          gs.centerObjectives = JSON.parse(JSON.stringify(state.centerObjectives));
        }
      }

      if (state._shieldHitEffects && state._shieldHitEffects.length > 0) {
        gs.shieldHitEffects = state._shieldHitEffects.map(e => ({
          px: roundN(e.px, 10), py: roundN(e.py, 10),
          hitX: roundN(e.hitX, 10), hitY: roundN(e.hitY, 10),
          color: e.color, t0: roundN(e.t0, 100), duration: e.duration
        }));
      }
      if (state._abilityAnnouncements && state._abilityAnnouncements.length > 0) {
        gs.abilityAnnouncements = state._abilityAnnouncements
          .filter(a => (a.ttl != null ? a.ttl : 4.5) - (state.t - (a.t0 || state.t)) > 0.5)
          .map(a => ({
            text: a.text,
            ttlRemaining: Math.max(0.5, (a.ttl != null ? a.ttl : 4.5) - (state.t - (a.t0 || state.t)))
          }))
          .slice(-5);
      }
      if (state._timeRewindFx && state._timeRewindFx.active) {
        gs.timeRewindFx = {
          token: state._timeRewindFx.token || 0,
          triggeredByPid: state._timeRewindFx.usedByPid,
          rewindSeconds: state._timeRewindFx.rewindSeconds || 60,
          applied: !!state._timeRewindFx.applied
        };
      }

      gs.storm = this._serializeStorm(state);

      if (state.mines && state.mines.size > 0) {
        gs.mines = [];
        for (const m of state.mines.values()) {
          gs.mines.push({
            id: m.id, x: roundN(m.x, 10), y: roundN(m.y, 10),
            ownerId: m.ownerId, captureProgress: roundN(m.captureProgress, 100),
            capturingUnitId: m.capturingUnitId, isRich: m.isRich,
            resourceType: m.resourceType || "money"
          });
        }
      }

      if (state._blackHoles && state._blackHoles.length > 0) {
        gs.blackHoles = state._blackHoles.map(bh => ({
          x: roundN(bh.x, 10), y: roundN(bh.y, 10),
          ownerId: bh.ownerId,
          spawnedAt: roundN(bh.spawnedAt, 100),
          duration: bh.duration,
          radius: bh.radius
        }));
      }
      if (state.pirateBase && state.pirateBase.hp > 0) {
        gs.pirateBase = {
          x: roundN(state.pirateBase.x, 10), y: roundN(state.pirateBase.y, 10),
          hp: roundN(state.pirateBase.hp, 10), maxHp: state.pirateBase.maxHp,
          orbitCenter: state.pirateBase.orbitCenter, orbitRadius: state.pirateBase.orbitRadius
        };
      } else {
        gs.pirateBase = null;
      }
      if (state._battleMarchUntil && Object.keys(state._battleMarchUntil).length > 0) {
        gs.battleMarchUntil = { ...state._battleMarchUntil };
      }

      if (state._hyperFlashes && state._hyperFlashes.length > 0) {
        gs.hyperFlashes = state._hyperFlashes.map(f => ({
          x: roundN(f.x, 10), y: roundN(f.y, 10),
          t0: roundN(f.t0, 100), duration: f.duration
        }));
      }

      if (state._activeMeteors && state._activeMeteors.length > 0) {
        gs.meteors = state._activeMeteors.map(m => ({
          x: roundN(m.x, 10), y: roundN(m.y, 10),
          vx: roundN(m.vx, 100), vy: roundN(m.vy, 100),
          angle: roundN(m.angle ?? 0, 1000),
          radius: m.radius, aoeR: m.aoeR,
          ownerId: m.ownerId, alive: m.alive,
          impactDuration: m.impactDuration,
          styleKey: m.styleKey,
          visualScale: m.visualScale,
          seed: m.seed
        }));
      }
      if (state._orbitalStrikes && state._orbitalStrikes.length > 0) {
        gs.orbitalStrikes = state._orbitalStrikes.map(strike => ({
          x: roundN(strike.x, 10),
          y: roundN(strike.y, 10),
          radius: strike.radius,
          ownerId: strike.ownerId,
          spawnedAt: roundN(strike.spawnedAt, 100),
          duration: strike.duration,
          seed: strike.seed,
          coreX: roundN(strike.coreX, 10),
          coreY: roundN(strike.coreY, 10),
          shots: (strike.shots || []).map(shot => ({
            salvoIndex: shot.salvoIndex,
            shotIndex: shot.shotIndex,
            seed: shot.seed,
            primary: !!shot.primary,
            sx: roundN(shot.sx, 10),
            sy: roundN(shot.sy, 10),
            tx: roundN(shot.tx, 10),
            ty: roundN(shot.ty, 10),
            radius: shot.radius,
            launchAt: roundN(shot.launchAt, 1000),
            arriveAt: roundN(shot.arriveAt, 1000),
            impactAt: roundN(shot.impactAt, 1000),
            fadeDuration: shot.fadeDuration,
            resolved: !!shot.resolved
          }))
        }));
      }
      if (state._thermoNukes && state._thermoNukes.length > 0) {
        gs.thermoNukes = state._thermoNukes.map(strike => ({
          ownerId: strike.ownerId,
          spawnedAt: roundN(strike.spawnedAt, 100),
          duration: strike.duration,
          seed: strike.seed,
          x: roundN(strike.x, 10),
          y: roundN(strike.y, 10),
          originX: roundN(strike.originX, 10),
          originY: roundN(strike.originY, 10),
          startX: roundN(strike.startX, 10),
          startY: roundN(strike.startY, 10),
          targetX: roundN(strike.targetX, 10),
          targetY: roundN(strike.targetY, 10),
          dirX: roundN(strike.dirX, 1000),
          dirY: roundN(strike.dirY, 1000),
          vx: roundN(strike.vx, 100),
          vy: roundN(strike.vy, 100),
          distance: roundN(strike.distance, 10),
          flightDuration: roundN(strike.flightDuration, 1000),
          impactAt: roundN(strike.impactAt, 1000),
          impactFadeDuration: strike.impactFadeDuration,
          previewRadius: strike.previewRadius,
          impactRadius: strike.impactRadius,
          styleKey: strike.styleKey,
          resolved: !!strike.resolved
        }));
      }
      if (state._pirateRaids && state._pirateRaids.length > 0) {
        gs.pirateRaids = state._pirateRaids.map(raid => ({
          id: raid.id,
          ownerId: raid.ownerId,
          spawnedAt: roundN(raid.spawnedAt, 100),
          duration: raid.duration,
          portalDuration: raid.portalDuration,
          hyperDuration: raid.hyperDuration,
          seed: raid.seed,
          styleKey: raid.styleKey,
          paletteKey: raid.paletteKey,
          targetX: roundN(raid.targetX, 10),
          targetY: roundN(raid.targetY, 10),
          zoneRadius: raid.zoneRadius,
          portalX: roundN(raid.portalX, 10),
          portalY: roundN(raid.portalY, 10),
          portalDistance: roundN(raid.portalDistance, 10),
          sideAngle: roundN(raid.sideAngle, 1000),
          attackAngle: roundN(raid.attackAngle, 1000)
        }));
      }
      if (state._abilityStorms && state._abilityStorms.length > 0) {
        gs.abilityStorms = state._abilityStorms.map(s => ({
          x: roundN(s.x, 10), y: roundN(s.y, 10),
          spawnedAt: roundN(s.spawnedAt, 100),
          duration: s.duration,
          rotAngle: roundN(s.rotAngle, 100),
          stretch: roundN(s.stretch, 100)
        }));
      }
      if (state._abilityCooldownsByPlayer && Object.keys(state._abilityCooldownsByPlayer).length > 0) {
        gs.abilityCooldownsByPlayer = {};
        for (const pid of Object.keys(state._abilityCooldownsByPlayer)) {
          gs.abilityCooldownsByPlayer[pid] = { ...state._abilityCooldownsByPlayer[pid] };
        }
      }
      if (state._abilityUsedByPlayer && Object.keys(state._abilityUsedByPlayer).length > 0) {
        gs.abilityUsedByPlayer = {};
        for (const pid of Object.keys(state._abilityUsedByPlayer)) {
          gs.abilityUsedByPlayer[pid] = (state._abilityUsedByPlayer[pid] || []).slice();
        }
      }

      return gs;
    }

    _rebuildPrev(state) {
      this._prev.clear();
      for (const u of state.units.values()) {
        this._prev.set(u.id, {
          x: roundN(u.x, 10), y: roundN(u.y, 10),
          vx: roundN(u.vx || 0, 1000), vy: roundN(u.vy || 0, 1000),
          hp: roundN(u.hp, 10)
        });
      }
    }

    _deltaUnits(state) {
      const out  = [];
      const dead = new Set(this._prev.keys());
      const dt   = this._dt;

      for (const u of state.units.values()) {
        dead.delete(u.id);
        const x  = roundN(u.x, 10);
        const y  = roundN(u.y, 10);
        const vx = roundN(u.vx || 0, 1000);
        const vy = roundN(u.vy || 0, 1000);
        const hp = roundN(u.hp, 10);

        const prev = this._prev.get(u.id);
        if (prev) {
          const dp = Math.abs(x - prev.x) + Math.abs(y - prev.y);
          const dv = Math.abs(vx - prev.vx) + Math.abs(vy - prev.vy);
          const dh = Math.abs(hp - prev.hp);
          if (dp < dt.pos && dv < dt.vel && dh < dt.hp) continue;
        }

        out.push([u.id, x, y, vx, vy, hp]);
        this._prev.set(u.id, { x, y, vx, vy, hp });
      }

      for (const id of dead) {
        out.push([id, DESTROYED_SENTINEL]);
        this._prev.delete(id);
      }

      return out;
    }

    _serializeStorm(state) {
      const s = state.storm;
      if (!s) return null;
      return {
        x: s.x, y: s.y, vx: s.vx, vy: s.vy,
        spawnedAt: s.spawnedAt, lastDirChange: s.lastDirChange,
        lastDmgTick: s.lastDmgTick,
        rotAngle: s.rotAngle, stretch: s.stretch, blobs: s.blobs
      };
    }
  }

  // ─── Interpolation helpers (remote client side) ──────────────────

  const Interp = {
    /**
     * Called when a new server snapshot arrives for this unit.
     * Saves current visual position as "from" and sets the server target.
     */
    setTarget(unit, x, y, vx, vy, hp) {
      unit._interpFromX = unit.x;
      unit._interpFromY = unit.y;
      unit._interpToX   = x;
      unit._interpToY   = y;
      unit._srvVx       = vx;
      unit._srvVy       = vy;
      unit._interpStart = performance.now();
      if (hp != null) unit.hp = hp;
    },

    /**
     * Per-unit tick: smoothly moves from _interpFrom toward _interpTo,
     * then extrapolates with velocity if the next snapshot is late.
     */
    tickUnit(unit, interpDurationMs) {
      if (unit._interpStart == null) return;

      const elapsed = performance.now() - unit._interpStart;
      const fromX   = unit._interpFromX ?? unit._interpToX;
      const fromY   = unit._interpFromY ?? unit._interpToY;
      const toX     = unit._interpToX;
      const toY     = unit._interpToY;
      const dist    = Math.hypot(toX - fromX, toY - fromY);

      if (dist > TELEPORT_DIST) {
        unit.x = toX;
        unit.y = toY;
        return;
      }

      if (elapsed <= interpDurationMs) {
        const t = clamp(elapsed / interpDurationMs, 0, 1);
        unit.x = lerpVal(fromX, toX, t);
        unit.y = lerpVal(fromY, toY, t);
      } else {
        const extra = Math.min((elapsed - interpDurationMs) / 1000, MAX_EXTRAP_SEC);
        unit.x = toX + (unit._srvVx || 0) * extra;
        unit.y = toY + (unit._srvVy || 0) * extra;
      }

      unit.vx = unit._srvVx || 0;
      unit.vy = unit._srvVy || 0;
    },

    /** Same idea for the storm entity. */
    setStormTarget(storm, x, y, vx, vy) {
      storm._interpFromX = storm.x;
      storm._interpFromY = storm.y;
      storm._interpToX   = x;
      storm._interpToY   = y;
      storm._srvVx       = vx;
      storm._srvVy       = vy;
      storm._interpStart = performance.now();
    },

    tickStorm(storm, interpDurationMs) {
      if (!storm || storm._interpStart == null) return;
      const elapsed = performance.now() - storm._interpStart;
      const fromX = storm._interpFromX ?? storm._interpToX;
      const fromY = storm._interpFromY ?? storm._interpToY;

      if (elapsed <= interpDurationMs) {
        const t = clamp(elapsed / interpDurationMs, 0, 1);
        storm.x = lerpVal(fromX, storm._interpToX, t);
        storm.y = lerpVal(fromY, storm._interpToY, t);
      } else {
        const extra = Math.min((elapsed - interpDurationMs) / 1000, MAX_EXTRAP_SEC);
        storm.x = storm._interpToX + (storm._srvVx || 0) * extra;
        storm.y = storm._interpToY + (storm._srvVy || 0) * extra;
      }
      storm.vx = storm._srvVx || 0;
      storm.vy = storm._srvVy || 0;
    },

    /**
     * Called when a zone sync arrives with new ray distances.
     * Saves the current interpolated rays as "from" and the new server values as "to".
     * tickZoneRays will then interpolate linearly over ZONE_SYNC_INTERVAL_MS.
     */
    setZoneTarget(player, newRays) {
      player._fromRayDistances = player.influenceRayDistances
        ? player.influenceRayDistances.slice()
        : newRays.slice();
      player._toRayDistances  = newRays.slice();
      player._rayInterpStart  = performance.now();
    },

    /**
     * Per-frame zone interpolation.
     * Linearly moves from _fromRayDistances → _toRayDistances over intervalMs.
     * This gives smooth zone shape changes between zone syncs.
     */
    /**
     * Called when a resource position update arrives (resDelta or full sync).
     * Saves current position as "from" and the server value as "to".
     */
    setResTarget(res, x, y) {
      res._interpFromX = res.x;
      res._interpFromY = res.y;
      res._interpToX   = x;
      res._interpToY   = y;
      res._interpStart = performance.now();
    },

    /**
     * Per-frame resource tick: interpolates position from → to over intervalMs,
     * then extrapolates toward _targetCity if set (for credits / XP orbs).
     */
    tickRes(res, intervalMs, players) {
      if (res._interpStart == null) return;
      const elapsed = performance.now() - res._interpStart;
      const t = clamp(elapsed / Math.max(intervalMs, 1), 0, 1);
      const fromX = res._interpFromX ?? res._interpToX;
      const fromY = res._interpFromY ?? res._interpToY;
      res.x = lerpVal(fromX, res._interpToX, t);
      res.y = lerpVal(fromY, res._interpToY, t);

      if (t >= 1 && res._targetCity != null && players) {
        const p = players.get(res._targetCity);
        if (p) {
          const dx = p.x - res.x, dy = p.y - res.y;
          const dl = Math.hypot(dx, dy);
          if (dl > 5) {
            const extrapSec = Math.min((elapsed - intervalMs) / 1000, MAX_EXTRAP_SEC);
            const speed = 90;
            res.x += (dx / dl) * speed * extrapSec;
            res.y += (dy / dl) * speed * extrapSec;
          }
        }
      }
    },

    tickZoneRays(player, numRays, intervalMs) {
      if (!player._toRayDistances) return;
      if (!player.influenceRayDistances || player.influenceRayDistances.length !== numRays)
        player.influenceRayDistances = player._toRayDistances.slice();

      const elapsed = performance.now() - (player._rayInterpStart || 0);
      const t = clamp(elapsed / Math.max(intervalMs, 1), 0, 1);

      for (let i = 0; i < numRays; i++) {
        const from = player._fromRayDistances
          ? (player._fromRayDistances[i] ?? 0)
          : (player._toRayDistances[i] ?? 0);
        const to = player._toRayDistances[i] ?? 0;
        player.influenceRayDistances[i] = lerpVal(from, to, t);
      }
    }
  };

  // ─── Public API ──────────────────────────────────────────────────

  const NET = {
    SEND_RATE_HZ,
    SEND_INTERVAL_MS,
    FULL_SYNC_EVERY,
    ZONE_SYNC_EVERY,
    ZONE_SYNC_INTERVAL_MS,
    TELEPORT_DIST,
    MAX_EXTRAP_SEC,
    DESTROYED_SENTINEL,
    PING_INTERVAL_MS,

    PLAYER_LIGHT_KEYS,
    PLAYER_SYNC_KEYS,
    PLAYER_FULL_KEYS,
    UNIT_LIGHT_KEYS,
    UNIT_FULL_KEYS,

    PingTracker,
    SendScheduler,
    SnapshotSerializer,
    Interp,

    lerpVal,
    clamp,
    roundN
  };

  if (typeof window !== "undefined") window.NET = NET;
  if (typeof module !== "undefined") module.exports = NET;
})();
