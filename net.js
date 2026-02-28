/**
 * NetEngine — networking module for Hoi2D multiplayer.
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
  const FULL_SYNC_EVERY        = 30;                             // every 30 ticks ≈ 1 s
  const ZONE_SYNC_EVERY        = 8;                              // zone rays every 8 ticks
  const ZONE_SYNC_INTERVAL_MS  = ZONE_SYNC_EVERY * SEND_INTERVAL_MS; // ~266 ms
  const TELEPORT_DIST          = 400;                            // snap instead of lerp
  const MAX_EXTRAP_SEC         = 0.20;                           // clamp extrapolation
  const PING_INTERVAL_MS       = 2000;                           // how often to ping
  const DESTROYED_SENTINEL     = -1;                             // compact[1] === -1

  const PLAYER_LIGHT_KEYS = [
    "id", "x", "y", "pop", "popFloat", "activeUnits",
    "influenceR", "influenceRayDistances"
  ];
  const PLAYER_SYNC_KEYS = [
    "id", "name", "x", "y", "pop", "popFloat", "level", "xp", "xpNext",
    "cooldown", "sendDelay", "activeUnits", "deadUnits", "influenceR",
    "turretIds", "waterBonus", "color",
    "turretDmgMul", "turretHpMul", "turretRangeMul",
    "unitHpMul", "unitDmgMul", "unitSpeedMul",
    "unitAtkRateMul", "unitAtkRangeMul",
    "growthMul", "influenceSpeedMul", "sendCooldownMul",
    "pendingCardPicks", "xpZonePct", "xpGainMul",
    "_levelBonusMul", "rerollCount"
  ];
  const PLAYER_FULL_KEYS = [
    ...PLAYER_SYNC_KEYS, "influencePolygon", "influenceRayDistances"
  ];
  const UNIT_LIGHT_KEYS = ["id", "x", "y", "vx", "vy", "hp"];
  const UNIT_FULL_KEYS = [
    "id", "owner", "x", "y", "vx", "vy", "hp", "dmg", "atkCd",
    "leaderId", "formationOffsetX", "formationOffsetY", "color",
    "chaseTargetUnitId", "chaseTargetCityId",
    "waypoints", "waypointIndex", "formationType", "formationRows",
    "formationPigWidth", "straightMode"
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
        players,
        units,
        // Bullets in every packet — short-lived, need smooth visual on remote clients
        bullets: state.bullets.slice()
      };

      if (isZoneSync && !isFull) {
        // Zone sync (every ~266 ms): compact resource positions for smooth movement
        const resDelta = [];
        for (const r of state.res.values()) {
          resDelta.push([r.id, roundN(r.x, 10), roundN(r.y, 10)]);
        }
        gs.resDelta = resDelta;
      }

      if (isFull) {
        gs.timeScale = state.timeScale ?? 1;
        gs.nextResId = state.nextResId;

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
          resources.push({ id: r.id, type: r.type, xp: r.xp,
                           x: r.x, y: r.y, color: r.color });
        }
        gs.resources = resources;
      }

      gs.storm = this._serializeStorm(state);
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
     * Per-frame resource tick: interpolates position from → to over intervalMs.
     */
    tickRes(res, intervalMs) {
      if (res._interpStart == null) return;
      const elapsed = performance.now() - res._interpStart;
      const t = clamp(elapsed / Math.max(intervalMs, 1), 0, 1);
      const fromX = res._interpFromX ?? res._interpToX;
      const fromY = res._interpFromY ?? res._interpToY;
      res.x = lerpVal(fromX, res._interpToX, t);
      res.y = lerpVal(fromY, res._interpToY, t);
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
