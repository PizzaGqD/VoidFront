const SQUADLOGIC = require("../squad-logic.js");
const FORMATIONS = require("../formations.js");

function assert(ok, msg) {
  if (!ok) throw new Error("FAIL: " + msg);
}

function makeState() {
  const state = {
    t: 0,
    units: new Map(),
    players: new Map(),
    turrets: new Map(),
    squads: new Map(),
    engagementZones: new Map(),
    nextSquadId: 1,
    nextEngagementZoneId: 1
  };
  state.players.set(1, { id: 1, x: 0, y: 0, eliminated: false });
  state.players.set(2, { id: 2, x: 800, y: 0, eliminated: false });
  state.players.set(3, { id: 3, x: 800, y: 100, eliminated: false });
  return state;
}

function addUnit(state, spec) {
  const unit = {
    id: spec.id,
    owner: spec.owner,
    unitType: spec.unitType || "fighter",
    x: spec.x,
    y: spec.y,
    vx: 0,
    vy: 0,
    hp: spec.hp ?? 100,
    maxHp: spec.maxHp ?? spec.hp ?? 100,
    dmg: spec.dmg ?? 10,
    attackRange: spec.attackRange ?? 60,
    attackRate: spec.attackRate ?? 1,
    maxTargets: spec.maxTargets ?? 1,
    speed: spec.speed ?? 20,
    formationOffsetX: 0,
    formationOffsetY: 0,
    leaderId: null,
    squadId: null,
    atkCd: 0
  };
  state.units.set(unit.id, unit);
  return unit;
}

function getFormationOffsets(count, formationType, rows, dirX, dirY, widthScale, units) {
  const facing = Math.atan2(dirY ?? 0, dirX ?? 1);
  const unitTypes = Array.isArray(units) && units.length
    ? units.map((u) => u.unitType || "fighter")
    : Array.from({ length: count }, () => "fighter");
  return FORMATIONS.getFormationOffsets(unitTypes, formationType, rows, facing, widthScale);
}

const helpers = {
  getUnitAtkRange: (u) => u.attackRange || 60,
  getUnitEngagementRange: (u) => (u.attackRange || 60) * 0.95,
  getUnitBaseSpeed: (u) => u.speed || 20,
  getUnitHitRadius: () => 10,
  getPlanetRadius: () => 32,
  shieldRadius: () => 0,
  getFormationOffsets
};

function createSquad(state, unitSpecs, opts = {}) {
  const ids = unitSpecs.map((spec) => addUnit(state, spec).id);
  const squad = SQUADLOGIC.createSquad(state, ids, opts);
  assert(!!squad, "squad created");
  SQUADLOGIC.recalculateFormation(state, squad.id, helpers, true);
  return squad;
}

function step(state, seconds, times = 1) {
  const dt = seconds / times;
  for (let i = 0; i < times; i++) {
    state.t += dt;
    SQUADLOGIC.syncSquadsFromState(state);
    SQUADLOGIC.buildEngagementZones(state, helpers);
    SQUADLOGIC.updateSquadCombatState(state, helpers);
    SQUADLOGIC.updateCombat(state, dt, helpers);
    SQUADLOGIC.updateResumeOrders(state, dt, helpers);
  }
}

function getCenter(state, squad) {
  return SQUADLOGIC.getSquadCenter(state, squad);
}

function testLockStartsOnRangeEntry() {
  const state = makeState();
  const a = createSquad(state, [
    { id: 1, owner: 1, x: 100, y: 100, attackRange: 60 }
  ], { order: { type: "move", waypoints: [{ x: 140, y: 100 }] } });
  const b = createSquad(state, [
    { id: 2, owner: 2, x: 148, y: 100, attackRange: 60 }
  ], { order: { type: "idle", waypoints: [] } });

  step(state, 0.1, 1);

  const aDebug = SQUADLOGIC.getSquadDebugState(state, a.id);
  const bDebug = SQUADLOGIC.getSquadDebugState(state, b.id);
  assert(aDebug.inCombat && bDebug.inCombat, "1v1: both squads enter combat");
  assert(aDebug.combatLocked && bDebug.combatLocked, "1v1: combat lock starts");
  assert(aDebug.combatZoneId != null && aDebug.combatZoneId === bDebug.combatZoneId, "1v1: both squads share one combat zone");
  console.log("  [OK] testLockStartsOnRangeEntry");
}

function testThirdSquadJoinsExistingZone() {
  const state = makeState();
  const a = createSquad(state, [
    { id: 11, owner: 1, x: 100, y: 100, attackRange: 80 }
  ], { order: { type: "idle", waypoints: [] } });
  const b = createSquad(state, [
    { id: 12, owner: 2, x: 160, y: 100, attackRange: 80 }
  ], { order: { type: "idle", waypoints: [] } });
  const c = createSquad(state, [
    { id: 13, owner: 2, x: 340, y: 100, attackRange: 80 }
  ], { order: { type: "idle", waypoints: [] } });

  step(state, 0.1, 1);
  state.units.get(13).x = 185;
  state.units.get(13).y = 118;
  step(state, 0.2, 2);

  assert(a.combat.zoneId != null, "join: primary zone exists");
  assert(a.combat.zoneId === b.combat.zoneId, "join: initial enemy shares zone");
  assert(c.combat.zoneId === a.combat.zoneId, "join: third squad is absorbed into same zone");
  console.log("  [OK] testThirdSquadJoinsExistingZone");
}

function testOrderQueuesDuringCombat() {
  const state = makeState();
  const a = createSquad(state, [
    { id: 21, owner: 1, x: 100, y: 100, attackRange: 60 }
  ], { order: { type: "idle", waypoints: [] } });
  createSquad(state, [
    { id: 22, owner: 2, x: 148, y: 100, attackRange: 60 }
  ], { order: { type: "idle", waypoints: [] } });

  step(state, 0.1, 1);
  SQUADLOGIC.issueMoveOrder(state, a.id, [{ x: 320, y: 100 }], 0);

  const debug = SQUADLOGIC.getSquadDebugState(state, a.id);
  assert(debug.inCombat, "queue: squad remains in combat");
  assert(debug.queuedOrder && debug.queuedOrder.type === "move", "queue: move order stored as queuedOrder");
  assert(a.order.type === "idle", "queue: live squad order does not change mid-combat");
  console.log("  [OK] testOrderQueuesDuringCombat");
}

function testQueuedOrderAppliesAfterCombatEnds() {
  const state = makeState();
  const a = createSquad(state, [
    { id: 31, owner: 1, x: 100, y: 100, attackRange: 60 }
  ], { order: { type: "idle", waypoints: [] } });
  createSquad(state, [
    { id: 32, owner: 2, x: 148, y: 100, attackRange: 60, hp: 1 }
  ], { order: { type: "idle", waypoints: [] } });

  step(state, 0.1, 1);
  SQUADLOGIC.issueMoveOrder(state, a.id, [{ x: 320, y: 100 }], 0);
  state.units.get(32).hp = 0;
  step(state, 1.5, 12);

  assert(a.combat.mode === "idle", "queue-resume: squad leaves combat cleanly");
  assert(a.order.type === "move", "queue-resume: queued move becomes active order");
  assert(a.order.waypoints[0] && a.order.waypoints[0].x === 320, "queue-resume: queued waypoint is preserved");
  console.log("  [OK] testQueuedOrderAppliesAfterCombatEnds");
}

function testResumeOrHoldStaysStableAfterCombat() {
  const state = makeState();

  const siegeSquad = createSquad(state, [
    { id: 41, owner: 1, x: 100, y: 100, attackRange: 60 }
  ], {});
  SQUADLOGIC.issueSiegeOrder(state, siegeSquad.id, 3, [{ x: 500, y: 100 }]);
  createSquad(state, [
    { id: 42, owner: 2, x: 145, y: 100, attackRange: 60, hp: 1 }
  ], { order: { type: "idle", waypoints: [] } });

  step(state, 0.1, 1);
  state.units.get(42).hp = 0;
  step(state, 1.5, 12);
  assert(siegeSquad.order.type === "siege", "resume: saved siege order is restored after combat");

  const holdSquad = createSquad(state, [
    { id: 51, owner: 1, x: 200, y: 200, attackRange: 60, speed: 30 },
    { id: 52, owner: 1, x: 214, y: 200, attackRange: 60, speed: 30 }
  ], { order: { type: "idle", waypoints: [] } });
  createSquad(state, [
    { id: 53, owner: 2, x: 246, y: 200, attackRange: 60, hp: 1 }
  ], { order: { type: "idle", waypoints: [] } });

  step(state, 0.1, 1);
  state.units.get(53).hp = 0;
  step(state, 1.5, 12);
  assert(holdSquad.order.holdPoint != null, "hold: no resume order falls back to a hold point");

  const before = getCenter(state, holdSquad);
  step(state, 1.0, 5);
  const after = getCenter(state, holdSquad);
  const drift = Math.hypot(after.x - before.x, after.y - before.y);
  assert(drift < 5, "hold: post-combat idle has no random drift (drift=" + Math.round(drift) + "px)");
  console.log("  [OK] testResumeOrHoldStaysStableAfterCombat");
}

function testSiegeContinuesAfterShieldBreak() {
  const state = makeState();
  state.players.set(4, {
    id: 4,
    x: 220,
    y: 100,
    pop: 100,
    popFloat: 100,
    shieldHp: 0,
    shieldMaxHp: 200,
    eliminated: false
  });

  const siegeSquad = createSquad(state, [
    { id: 61, owner: 1, x: 118, y: 100, unitType: "destroyer", attackRange: 120 }
  ], {});
  SQUADLOGIC.issueSiegeOrder(state, siegeSquad.id, 4, []);

  const plan = SQUADLOGIC.getUnitFirePlan(state.units.get(61), state, helpers);
  assert(plan.type === "city" && plan.city && plan.city.id === 4, "siege: city remains a valid fire target after shield breaks");
  console.log("  [OK] testSiegeContinuesAfterShieldBreak");
}

function runAll() {
  console.log("squad-combat-state tests:");
  testLockStartsOnRangeEntry();
  testThirdSquadJoinsExistingZone();
  testOrderQueuesDuringCombat();
  testQueuedOrderAppliesAfterCombatEnds();
  testResumeOrHoldStaysStableAfterCombat();
  testSiegeContinuesAfterShieldBreak();
  console.log("All squad combat state tests passed.");
}

runAll();
