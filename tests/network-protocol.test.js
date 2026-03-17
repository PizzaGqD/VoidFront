/**
 * Network protocol contract tests.
 * Validates snapshot structure (light/full), delta compression,
 * sequence numbers, and JSON roundtrip — without loading client.js.
 *
 * Run:  node tests/network-protocol.test.js
 */

const NET = require("../net.js");
const assert = (ok, msg) => { if (!ok) throw new Error("FAIL: " + msg); };

// ─── Helpers: minimal game state stubs ──────────────────────────

function makeState(unitCount) {
  const players = new Map();
  players.set(0, {
    id: 0, name: "P1", x: 100, y: 100,
    pop: 150, popFloat: 150, level: 1, xp: 0, xpNext: 80,
    cooldown: 0, sendDelay: 0, activeUnits: unitCount, deadUnits: 0,
    influenceR: 80, influenceRayDistances: Array(96).fill(80),
    influencePolygon: Array(96).fill(null).map((_, i) => {
      const a = (i / 96) * Math.PI * 2;
      return { x: 100 + Math.cos(a) * 80, y: 100 + Math.sin(a) * 80 };
    }),
    turretIds: [], waterBonus: false, color: 0xff6600,
    turretDmgMul: 1, turretHpMul: 1, turretRangeMul: 1,
    unitHpMul: 1, unitDmgMul: 1, unitSpeedMul: 1,
    unitAtkRateMul: 1, unitAtkRangeMul: 1,
    growthMul: 1, influenceSpeedMul: 1, sendCooldownMul: 1,
    pendingCardPicks: 0, xpZonePct: 0, xpGainMul: 1,
    _levelBonusMul: 1, rerollCount: 0,
    buffHand: [{ instanceId: "b1", cardId: "c1", zone: "buff", kind: "buff", addedAt: 10 }],
    abilityHand: [{ instanceId: "a1", cardId: "A_activeShield", zone: "ability", kind: "ability", addedAt: 12 }],
    activeBuffs: [{ instanceId: "ab1", cardId: "c2", startedAt: 20, expiresAt: 60, permanent: false }],
    legendaryBuffs: [{ instanceId: "lb1", cardId: "L1", startedAt: 10, expiresAt: null, permanent: true }],
    nextCardInstanceId: 3,
    cardStateVersion: 4
  });

  const units = new Map();
  for (let i = 1; i <= unitCount; i++) {
    units.set(i, {
      id: i, owner: 0, x: 50 + i, y: 50 + i,
      vx: 0.5, vy: -0.3, hp: 25, dmg: 1, atkCd: 0,
      leaderId: 1, formationOffsetX: 0, formationOffsetY: 0,
      color: 0xff6600, chaseTargetUnitId: undefined,
      chaseTargetCityId: undefined, waypoints: [{ x: 200, y: 200 }],
      waypointIndex: 0, formationType: "pig", formationRows: 1,
      formationPigWidth: undefined, straightMode: false
    });
  }

  const turrets = new Map();
  const res = new Map();
  res.set(1, { id: 1, type: "blue", xp: 2, x: 20, y: 20, color: 0x66a3ff });

  return {
    t: 100, nextUnitId: unitCount + 1, nextResId: 10,
    timeScale: 1, players, units, turrets, res,
    bullets: [], storm: null,
    coreFrontPolicies: {
      0: {
        left: { weight: 30, mode: "push" },
        center: { weight: 40, mode: "hold" },
        right: { weight: 30, mode: "push" }
      }
    },
    frontGraph: {
      0: {
        leftTargetCoreId: 2,
        rightTargetCoreId: 3,
        enemyCoreIds: [2, 3],
        centerMode: "fanout"
      }
    },
    squadFrontAssignments: {
      7: {
        squadId: 7,
        ownerId: 0,
        frontType: "center",
        targetCoreId: 2
      }
    },
    centerObjectives: {
      centerX: 500,
      centerY: 500,
      richMineId: 10,
      centerMineIds: [10, 11, 12],
      pirateBaseIds: ["pb1"],
      livePirateBaseIds: ["pb1"],
      securedByPlayerId: null,
      requiredMineCount: 3
    }
  };
}

// ─── Test 1: Light snapshot has required fields, no resources ────

function testLightSnapshot() {
  const ser = new NET.SnapshotSerializer();
  const state = makeState(3);
  const snap = ser.serialize(state);

  assert(typeof snap._seq === "number", "light: _seq is number");
  assert(typeof snap._st === "number", "light: _st (server time) is number");
  assert(snap._seq === 1, "light: first seq = 1");
  assert(typeof snap.t === "number", "light: game time (t) is number");
  assert(typeof snap.nextUnitId === "number", "light: nextUnitId is number");
  assert(Array.isArray(snap.players), "light: players is array");
  assert(Array.isArray(snap.units), "light: units is array");
  assert(snap._fullSync === false, "light: _fullSync = false");
  assert(snap.players[0].buffHand === undefined, "light: card hand omitted");
  assert(snap.resources === undefined, "light: resources omitted (delta)");
  assert(snap.turrets === undefined, "light: turrets omitted (delta)");
  // Bullets are in EVERY packet now for smooth visuals
  assert(Array.isArray(snap.bullets), "light: bullets always present");

  console.log("  [OK] testLightSnapshot");
}

// ─── Test 2: Compact unit format [id, x, y, vx, vy, hp] ────────

function testCompactUnitFormat() {
  const ser = new NET.SnapshotSerializer();
  const state = makeState(2);
  const snap = ser.serialize(state);

  assert(snap.units.length > 0, "compact: has units");
  const u = snap.units[0];
  assert(Array.isArray(u), "compact: unit is array");
  assert(u.length === 6, "compact: [id, x, y, vx, vy, hp]");
  assert(typeof u[0] === "number", "compact: id is number");
  assert(typeof u[1] === "number", "compact: x is number");
  assert(typeof u[5] === "number", "compact: hp is number");

  console.log("  [OK] testCompactUnitFormat");
}

// ─── Test 3: Full snapshot has resources, turrets, all unit keys ─

function testFullSnapshot() {
  const ser = new NET.SnapshotSerializer();
  const state = makeState(2);

  let snap;
  for (let i = 0; i < NET.FULL_SYNC_EVERY; i++) {
    snap = ser.serialize(state);
  }

  assert(snap._fullSync === true, "full: _fullSync = true");
  assert(snap._seq === NET.FULL_SYNC_EVERY, "full: seq = FULL_SYNC_EVERY");
  assert(Array.isArray(snap.resources), "full: resources present");
  assert(Array.isArray(snap.turrets), "full: turrets present");
  assert(Array.isArray(snap.bullets), "full: bullets always present");
  assert(Array.isArray(snap.players[0].buffHand), "full: buff hand present");
  assert(Array.isArray(snap.players[0].abilityHand), "full: ability hand present");
  assert(Array.isArray(snap.players[0].activeBuffs), "full: active buffs present");
  assert(Array.isArray(snap.players[0].legendaryBuffs), "full: legendary buffs present");
  assert(snap.players[0].cardStateVersion === 4, "full: card version preserved");
  assert(snap.nextResId != null, "full: nextResId present");
  assert(snap.timeScale != null, "full: timeScale present");
  assert(snap.resDelta === undefined, "full: resDelta omitted (has full resources)");
  assert(snap.coreFrontPolicies[0].center.mode === "hold", "full: front policies present");
  assert(snap.frontGraph[0].centerMode === "fanout", "full: front graph present");
  assert(snap.squadFrontAssignments[7].targetCoreId === 2, "full: squad front assignments present");
  assert(snap.centerObjectives.richMineId === 10, "full: center objectives present");

  const u = snap.units[0];
  assert(!Array.isArray(u), "full: unit is object (not compact)");
  assert(typeof u.id === "number" && typeof u.owner === "number",
    "full: unit has id and owner");

  console.log("  [OK] testFullSnapshot");
}

// ─── Test 3b: Zone sync has resDelta and bullets ─────────────────

function testZoneSyncPayload() {
  const ser = new NET.SnapshotSerializer();
  const state = makeState(2);

  let snap;
  for (let i = 0; i < NET.ZONE_SYNC_EVERY; i++) {
    snap = ser.serialize(state);
  }

  assert(snap._fullSync === false, "zone: not a full sync");
  assert(Array.isArray(snap.bullets), "zone: bullets present");
  assert(Array.isArray(snap.resDelta), "zone: resDelta present");
  assert(snap.resDelta.length > 0, "zone: resDelta has entries");
  const entry = snap.resDelta[0];
  assert(Array.isArray(entry) && entry.length >= 3, "zone: resDelta entry = [id, x, y, ?targetCity]");
  assert(snap.resources === undefined, "zone: no full resources (only resDelta)");

  console.log("  [OK] testZoneSyncPayload");
}

// ─── Test 4: Delta compression — unchanged units are omitted ────

function testDeltaCompression() {
  const ser = new NET.SnapshotSerializer();
  const state = makeState(5);

  ser.serialize(state);
  const snap2 = ser.serialize(state);
  assert(snap2.units.length === 0,
    "delta: unchanged units omitted (got " + snap2.units.length + ")");

  state.units.get(3).x += 10;
  const snap3 = ser.serialize(state);
  assert(snap3.units.length === 1, "delta: only changed unit sent");
  assert(snap3.units[0][0] === 3, "delta: changed unit id = 3");

  console.log("  [OK] testDeltaCompression");
}

// ─── Test 5: Destroyed unit sentinel ────────────────────────────

function testDestroyedSentinel() {
  const ser = new NET.SnapshotSerializer();
  const state = makeState(3);

  ser.serialize(state);
  state.units.delete(2);
  const snap = ser.serialize(state);

  const destroyed = snap.units.find(u => Array.isArray(u) && u[0] === 2);
  assert(destroyed, "destroyed: sentinel present for unit 2");
  assert(destroyed.length === 2 && destroyed[1] === NET.DESTROYED_SENTINEL,
    "destroyed: format is [id, -1]");

  console.log("  [OK] testDestroyedSentinel");
}

// ─── Test 6: Sequence numbers increment ─────────────────────────

function testSequenceNumbers() {
  const ser = new NET.SnapshotSerializer();
  const state = makeState(1);

  const s1 = ser.serialize(state);
  const s2 = ser.serialize(state);
  const s3 = ser.serialize(state);

  assert(s1._seq === 1 && s2._seq === 2 && s3._seq === 3,
    "seq: monotonically increasing (got " + [s1._seq, s2._seq, s3._seq] + ")");

  console.log("  [OK] testSequenceNumbers");
}

// ─── Test 7: JSON roundtrip preserves structure ─────────────────

function testJsonRoundtrip() {
  const ser = new NET.SnapshotSerializer();
  const state = makeState(2);
  let snap;
  for (let i = 0; i < NET.FULL_SYNC_EVERY; i++) {
    snap = ser.serialize(state);
  }

  const rt = JSON.parse(JSON.stringify(snap));
  assert(rt._seq === snap._seq, "roundtrip: _seq preserved");
  assert(rt._st === snap._st, "roundtrip: _st preserved");
  assert(rt._fullSync === snap._fullSync, "roundtrip: _fullSync preserved");
  assert(rt.t === snap.t, "roundtrip: t preserved");

  if (snap.units.length > 0) {
    assert(rt.units[0][0] === snap.units[0][0], "roundtrip: compact unit id");
    assert(rt.units[0][5] === snap.units[0][5], "roundtrip: compact unit hp");
  }
  assert(rt.coreFrontPolicies["0"].center.mode === "hold", "roundtrip: front policy preserved");
  assert(rt.centerObjectives.centerMineIds.length === 3, "roundtrip: center objectives preserved");

  console.log("  [OK] testJsonRoundtrip");
}

// ─── Test 8: Light payload smaller than full ────────────────────

function testPayloadSize() {
  const ser = new NET.SnapshotSerializer();
  const state = makeState(10);

  const light = ser.serialize(state);
  let full;
  for (let i = 1; i < NET.FULL_SYNC_EVERY; i++) {
    state.units.get(1).x += 0.01;
    full = ser.serialize(state);
  }

  const lightStr = JSON.stringify(light);
  const fullStr = JSON.stringify(full);
  assert(lightStr.length < fullStr.length,
    "size: light (" + lightStr.length + ") < full (" + fullStr.length + ")");

  console.log("  [OK] testPayloadSize");
}

// ─── Test 9b: setZoneTarget / tickZoneRays interpolates linearly ─

function testZoneInterpolation() {
  const numRays = 4;
  const player = {
    influenceRayDistances: [10, 10, 10, 10],
    _polyBuf: null
  };
  const newRays = [20, 20, 20, 20];

  NET.Interp.setZoneTarget(player, newRays);
  assert(player._fromRayDistances[0] === 10, "zone interp: from = old value");
  assert(player._toRayDistances[0] === 20, "zone interp: to = new value");
  assert(typeof player._rayInterpStart === "number", "zone interp: start time set");

  // Simulate near end of interval — rays should be near target
  player._rayInterpStart -= NET.ZONE_SYNC_INTERVAL_MS * 0.95;
  NET.Interp.tickZoneRays(player, numRays, NET.ZONE_SYNC_INTERVAL_MS);
  assert(player.influenceRayDistances[0] > 18, "zone interp: 95% of way to target");
  assert(player.influenceRayDistances[0] < 20.01, "zone interp: not overshot");

  console.log("  [OK] testZoneInterpolation");
}

// ─── Test 9: SendScheduler respects rate ────────────────────────

function testSendScheduler() {
  const sch = new NET.SendScheduler(30);
  sch.start();

  assert(!sch.update(10), "scheduler: 10ms < 33ms, no send");
  assert(!sch.update(10), "scheduler: 20ms < 33ms, no send");
  assert(sch.update(15), "scheduler: 35ms >= 33ms, send");
  assert(!sch.update(5), "scheduler: accumulator reset, no send");

  console.log("  [OK] testSendScheduler");
}

// ─── Test 10: PingTracker computes RTT ──────────────────────────

function testPingTracker() {
  const pt = new NET.PingTracker();
  assert(pt.rtt === 50, "ping: initial rtt = 50");
  assert(typeof pt.getInterpDurationMs() === "number", "ping: getInterpDurationMs returns number");
  assert(pt.getInterpDurationMs() > 0, "ping: interp duration > 0");

  console.log("  [OK] testPingTracker");
}

// ─── Test 11: Interpolation setTarget / tickUnit ────────────────

function testInterpolation() {
  const unit = { x: 0, y: 0, vx: 0, vy: 0, hp: 25 };

  NET.Interp.setTarget(unit, 100, 200, 1, 2, 24);

  assert(unit._interpFromX === 0, "interp: fromX saved");
  assert(unit._interpFromY === 0, "interp: fromY saved");
  assert(unit._interpToX === 100, "interp: toX set");
  assert(unit._interpToY === 200, "interp: toY set");
  assert(unit.hp === 24, "interp: hp updated immediately");
  assert(typeof unit._interpStart === "number", "interp: _interpStart set");

  console.log("  [OK] testInterpolation");
}

// ─── Run all ────────────────────────────────────────────────────

function runAll() {
  console.log("network-protocol tests:");
  testLightSnapshot();
  testCompactUnitFormat();
  testFullSnapshot();
  testZoneSyncPayload();
  testDeltaCompression();
  testDestroyedSentinel();
  testSequenceNumbers();
  testJsonRoundtrip();
  testPayloadSize();
  testZoneInterpolation();
  testSendScheduler();
  testPingTracker();
  testInterpolation();
  console.log("All tests passed.");
}

runAll();
