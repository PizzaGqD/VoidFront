const FrontPlanner = require("../front-planner.js");
const SQUADLOGIC = require("../squad-logic.js");
const FORMATIONS = require("../formations.js");

function assert(ok, msg) {
  if (!ok) throw new Error("FAIL: " + msg);
}

function makeState() {
  return {
    t: 0,
    players: new Map(),
    units: new Map(),
    turrets: new Map(),
    squads: new Map(),
    engagementZones: new Map(),
    mines: new Map(),
    pirateBases: [],
    pirateBase: null,
    botPlayerIds: new Set(),
    nextSquadId: 1,
    nextEngagementZoneId: 1
  };
}

function addPlayer(state, id, x, y) {
  state.players.set(id, { id, x, y, eliminated: false });
}

function addMine(state, spec) {
  state.mines.set(spec.id, {
    id: spec.id,
    x: spec.x,
    y: spec.y,
    ownerId: spec.ownerId ?? null,
    captureProgress: spec.captureProgress ?? 0,
    isRich: !!spec.isRich,
    resourceType: spec.resourceType || "money"
  });
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

function createSquad(state, unitSpecs, opts = {}) {
  const ids = unitSpecs.map((spec) => addUnit(state, spec).id);
  const squad = SQUADLOGIC.createSquad(state, ids, { order: { type: "idle", waypoints: [] }, ...opts });
  SQUADLOGIC.recalculateFormation(state, squad.id, { getFormationOffsets }, true);
  return squad;
}

function testCenterPlannerAttacksPiratesFirst() {
  const state = makeState();
  addPlayer(state, 1, 0, -240);
  addPlayer(state, 2, 240, 140);
  addPlayer(state, 3, -240, 140);
  addMine(state, { id: 1, x: 0, y: 0, isRich: true, ownerId: null, captureProgress: 0 });
  addMine(state, { id: 2, x: 80, y: 0, ownerId: null, captureProgress: 0 });
  addMine(state, { id: 3, x: -80, y: 0, ownerId: null, captureProgress: 0 });
  state.pirateBases = [{ id: "pb1", x: 0, y: 80, hp: 4000, orbitCenter: { x: 0, y: 0 } }];
  state.pirateBase = state.pirateBases[0];
  const squad = createSquad(state, [
    { id: 1, owner: 1, x: 0, y: -210 },
    { id: 2, owner: 1, x: 12, y: -210 }
  ]);

  FrontPlanner.step(state, 0.1, { squadLogic: SQUADLOGIC, getFormationOffsets });

  assert(state.squadFrontAssignments[squad.id].frontType === "center", "single squad is assigned to center front");
  assert(state.squads.get(squad.id).order.type === "attackPirateBase", "center planner attacks pirate base before mines");
  console.log("  [OK] testCenterPlannerAttacksPiratesFirst");
}

function testCenterPirateRoutePassesThroughArenaCenter() {
  const state = makeState();
  addPlayer(state, 1, -180, -210);
  addPlayer(state, 2, 180, -210);
  addPlayer(state, 3, 260, 80);
  addPlayer(state, 4, 0, 250);
  addPlayer(state, 5, -260, 80);
  addMine(state, { id: 1, x: 0, y: 0, isRich: true, ownerId: null, captureProgress: 0 });
  addMine(state, { id: 2, x: 82, y: -18, ownerId: null, captureProgress: 0 });
  addMine(state, { id: 3, x: -74, y: 26, ownerId: null, captureProgress: 0 });
  state.pirateBases = [{ id: "pb1", x: 92, y: 150, hp: 4000, orbitCenter: { x: 0, y: 0 } }];
  state.pirateBase = state.pirateBases[0];
  const squad = createSquad(state, [
    { id: 6, owner: 1, x: -120, y: -120 },
    { id: 7, owner: 1, x: -108, y: -116 }
  ], {
    sourceTag: FrontPlanner.frontSourceTag("center")
  });

  FrontPlanner.step(state, 0.1, { squadLogic: SQUADLOGIC, getFormationOffsets });

  const order = state.squads.get(squad.id).order;
  assert(order.type === "attackPirateBase", "center lane still prioritizes pirate base on five-player maps");
  assert(Array.isArray(order.waypoints) && order.waypoints.length >= 2, "pirate route keeps intermediate arena waypoint");
  assert(order.waypoints.some((point) =>
    Math.abs(point.x - state.centerObjectives.centerX) <= 2 &&
    Math.abs(point.y - state.centerObjectives.centerY) <= 2
  ), "pirate route enters arena center before diving to angled pirate base");
  console.log("  [OK] testCenterPirateRoutePassesThroughArenaCenter");
}

function testCenterSecuredSplitsTowardEnemyCores() {
  const state = makeState();
  addPlayer(state, 1, 0, -240);
  addPlayer(state, 2, 240, 140);
  addPlayer(state, 3, -240, 140);
  addMine(state, { id: 1, x: 0, y: 0, isRich: true, ownerId: 1, captureProgress: 1 });
  addMine(state, { id: 2, x: 80, y: 0, ownerId: 1, captureProgress: 1 });
  addMine(state, { id: 3, x: -80, y: 0, ownerId: 1, captureProgress: 1 });
  state.pirateBases = [{ id: "pb1", x: 0, y: 80, hp: 0, orbitCenter: { x: 0, y: 0 } }];
  state.pirateBase = state.pirateBases[0];
  const squad = createSquad(state, [
    { id: 11, owner: 1, x: 0, y: -210 },
    { id: 12, owner: 1, x: 12, y: -210 },
    { id: 13, owner: 1, x: -12, y: -210 },
    { id: 14, owner: 1, x: 24, y: -210 }
  ]);

  FrontPlanner.step(state, 0.1, { squadLogic: SQUADLOGIC, getFormationOffsets });
  FrontPlanner.step(state, 0.1, { squadLogic: SQUADLOGIC, getFormationOffsets });

  const centerAssignments = Object.values(state.squadFrontAssignments).filter((entry) => entry && entry.ownerId === 1 && entry.frontType === "center");
  const targetIds = centerAssignments.map((entry) => entry.targetCoreId).filter((id) => id != null).sort();

  assert(state.centerObjectives.securedByPlayerId === 1, "owned center marks center as secured");
  assert(state.squads.size >= 2, "secured center can split squad into detachments");
  assert(targetIds.includes(2) && targetIds.includes(3), "center detachments fan out to remaining enemy cores");
  console.log("  [OK] testCenterSecuredSplitsTowardEnemyCores");
}

function testBaseDefenseBubbleOverridesAndResumesRoute() {
  const state = makeState();
  addPlayer(state, 1, 0, -240);
  addPlayer(state, 2, 240, 140);
  addPlayer(state, 3, -240, 140);
  addMine(state, { id: 1, x: 0, y: 0, isRich: true, ownerId: null, captureProgress: 0 });
  addMine(state, { id: 2, x: 80, y: 0, ownerId: null, captureProgress: 0 });
  addMine(state, { id: 3, x: -80, y: 0, ownerId: null, captureProgress: 0 });
  const squad = createSquad(state, [
    { id: 21, owner: 1, x: 0, y: -190 },
    { id: 22, owner: 1, x: 14, y: -190 }
  ], {
    sourceTag: FrontPlanner.frontSourceTag("left")
  });
  addUnit(state, { id: 90, owner: 2, x: 10, y: -120, hp: 100 });

  FrontPlanner.step(state, 0.1, { squadLogic: SQUADLOGIC, getFormationOffsets });
  const defendOrder = state.squads.get(squad.id).order;
  assert(defendOrder.type === "attackUnit", "near-core threat temporarily overrides lane order");
  assert(defendOrder.strictLaneApproach === true, "side-lane defense keeps lane lock while reacting to core threats");

  state.units.get(90).hp = 0;
  FrontPlanner.step(state, 0.1, { squadLogic: SQUADLOGIC, getFormationOffsets });

  const resumed = state.squads.get(squad.id);
  assert(resumed.order.type === "siege", "after threat is gone squad returns to its lane route");
  assert(state.squadFrontAssignments[squad.id].frontType === "left", "defense bubble does not retag the squad");
  console.log("  [OK] testBaseDefenseBubbleOverridesAndResumesRoute");
}

function testCenterFallsThroughToEnemyCoreWhenNoCenterTargetsRemain() {
  const state = makeState();
  addPlayer(state, 1, 0, -240);
  addPlayer(state, 2, 240, 140);
  addPlayer(state, 3, -240, 140);
  const squad = createSquad(state, [
    { id: 31, owner: 1, x: 0, y: -210 },
    { id: 32, owner: 1, x: 12, y: -210 }
  ]);

  FrontPlanner.step(state, 0.1, { squadLogic: SQUADLOGIC, getFormationOffsets });

  const order = state.squads.get(squad.id).order;
  assert(order.type === "siege", "center planner falls through to enemy core when center is already clear");
  assert(order.targetCityId === 2 || order.targetCityId === 3, "center planner picks any live enemy core");
  assert(Array.isArray(order.waypoints) && order.waypoints.length >= 2, "center fallback path still routes through center");
  console.log("  [OK] testCenterFallsThroughToEnemyCoreWhenNoCenterTargetsRemain");
}

function testCenterSecuredStopsRetargetingOwnedMines() {
  const state = makeState();
  addPlayer(state, 1, 0, -240);
  addPlayer(state, 2, 240, 140);
  addPlayer(state, 3, -240, 140);
  addMine(state, { id: 1, x: 0, y: 0, isRich: true, ownerId: 1, captureProgress: 1 });
  addMine(state, { id: 2, x: 80, y: 0, ownerId: 1, captureProgress: 1 });
  addMine(state, { id: 3, x: -80, y: 0, ownerId: 1, captureProgress: 1 });
  state.pirateBases = [{ id: "pb1", x: 0, y: 80, hp: 0, orbitCenter: { x: 0, y: 0 } }];
  state.pirateBase = state.pirateBases[0];
  const squad = createSquad(state, [
    { id: 61, owner: 1, x: -40, y: -40 },
    { id: 62, owner: 1, x: -28, y: -28 }
  ], {
    sourceTag: FrontPlanner.frontSourceTag("center")
  });

  FrontPlanner.step(state, 0.1, { squadLogic: SQUADLOGIC, getFormationOffsets });

  const centerEntries = Object.values(state.squadFrontAssignments).filter((entry) => entry && entry.ownerId === 1 && entry.frontType === "center");
  const targetOrders = centerEntries
    .map((entry) => state.squads.get(entry.squadId))
    .filter(Boolean)
    .map((sq) => sq.order);
  assert(state.centerObjectives.securedByPlayerId === 1, "secured center is detected from owned mines");
  assert(targetOrders.length > 0, "secured center keeps at least one center assignment alive");
  assert(targetOrders.every((order) => order.type === "siege"), "secured center no longer keeps squads circling owned mines");
  assert(targetOrders.some((order) => order.targetCityId === 2 || order.targetCityId === 3), "secured center pushes toward any live enemy core");
  console.log("  [OK] testCenterSecuredStopsRetargetingOwnedMines");
}

function testSideLaneRoutesThroughEliminatedCore() {
  const state = makeState();
  addPlayer(state, 1, 0, -240);
  addPlayer(state, 2, 240, 0);
  addPlayer(state, 3, 0, 240);
  addPlayer(state, 4, -240, 0);
  state.players.get(2).eliminated = true;
  const squad = createSquad(state, [
    { id: 41, owner: 1, x: 0, y: -210 },
    { id: 42, owner: 1, x: 10, y: -210 }
  ], {
    sourceTag: FrontPlanner.frontSourceTag("right")
  });

  FrontPlanner.step(state, 0.1, { squadLogic: SQUADLOGIC, getFormationOffsets });

  const order = state.squads.get(squad.id).order;
  assert(order.type === "siege", "side lane keeps siege order through dead waypoint");
  assert(order.targetCityId === 3, "side lane retargets to next live core after eliminated one");
  assert(Array.isArray(order.waypoints) && order.waypoints.length >= 2, "dead core remains as intermediate waypoint");
  assert(Math.round(order.waypoints[0].x) === 240 && Math.round(order.waypoints[0].y) === 0, "first waypoint is eliminated core position");
  console.log("  [OK] testSideLaneRoutesThroughEliminatedCore");
}

function testSideLaneProgressDoesNotResetToDeadCore() {
  const state = makeState();
  addPlayer(state, 1, 0, -240);
  addPlayer(state, 2, 240, 0);
  addPlayer(state, 3, 0, 240);
  addPlayer(state, 4, -240, 0);
  state.players.get(2).eliminated = true;
  const squad = createSquad(state, [
    { id: 51, owner: 1, x: 230, y: -10 },
    { id: 52, owner: 1, x: 238, y: -2 }
  ], {
    sourceTag: FrontPlanner.frontSourceTag("right")
  });

  FrontPlanner.step(state, 0.1, { squadLogic: SQUADLOGIC, getFormationOffsets });
  state.squads.get(squad.id).order.waypoints = [{ x: 0, y: 240 }];

  state.t += 2.0;
  FrontPlanner.step(state, 0.1, { squadLogic: SQUADLOGIC, getFormationOffsets });

  const order = state.squads.get(squad.id).order;
  assert(order.type === "siege", "partial side-lane progress remains a siege order");
  assert(order.waypoints.length === 1, "progressed route is not reset to the dead core waypoint");
  assert(Math.round(order.waypoints[0].x) === 0 && Math.round(order.waypoints[0].y) === 240, "remaining waypoint still points to next live core");
  console.log("  [OK] testSideLaneProgressDoesNotResetToDeadCore");
}

function testExplicitFrontTypeKeepsLaneForNonFrontSourceTags() {
  const state = makeState();
  addPlayer(state, 1, 0, -240);
  addPlayer(state, 2, 240, 0);
  addPlayer(state, 3, 0, 240);
  addPlayer(state, 4, -240, 0);
  const squad = createSquad(state, [
    { id: 61, owner: 1, x: 4, y: -214 },
    { id: 62, owner: 1, x: 16, y: -206 }
  ], {
    sourceTag: "timed:laneFighters:1:right",
    frontType: "right"
  });

  FrontPlanner.step(state, 0.1, { squadLogic: SQUADLOGIC, getFormationOffsets });

  const entry = state.squadFrontAssignments[squad.id];
  const order = state.squads.get(squad.id).order;
  assert(entry && entry.frontType === "right", "explicit squad frontType preserves right-lane assignment");
  assert(order.type === "siege", "explicit frontType still produces a side-lane siege order");
  assert(order.targetCityId === 2 || order.targetCityId === 3, "side-lane order targets a live flank enemy core");
  assert(Array.isArray(order.waypoints) && order.waypoints.length > 0, "side-lane order keeps route waypoints");
  console.log("  [OK] testExplicitFrontTypeKeepsLaneForNonFrontSourceTags");
}

function runAll() {
  console.log("center-planner tests:");
  testCenterPlannerAttacksPiratesFirst();
  testCenterPirateRoutePassesThroughArenaCenter();
  testCenterSecuredSplitsTowardEnemyCores();
  testBaseDefenseBubbleOverridesAndResumesRoute();
  testCenterFallsThroughToEnemyCoreWhenNoCenterTargetsRemain();
  testCenterSecuredStopsRetargetingOwnedMines();
  testSideLaneRoutesThroughEliminatedCore();
  testSideLaneProgressDoesNotResetToDeadCore();
  testExplicitFrontTypeKeepsLaneForNonFrontSourceTags();
  console.log("All center-planner tests passed.");
}

runAll();
