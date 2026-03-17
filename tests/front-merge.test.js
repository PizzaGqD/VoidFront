const SQUADLOGIC = require("../squad-logic.js");
const FORMATIONS = require("../formations.js");

function assert(ok, msg) {
  if (!ok) throw new Error("FAIL: " + msg);
}

function makeState() {
  return {
    t: 10,
    players: new Map([
      [1, { id: 1, x: 0, y: -200, eliminated: false }],
      [2, { id: 2, x: 240, y: 120, eliminated: false }]
    ]),
    units: new Map(),
    squads: new Map(),
    engagementZones: new Map(),
    nextSquadId: 1,
    nextEngagementZoneId: 1
  };
}

function addUnit(state, id, owner, x, y) {
  state.units.set(id, {
    id,
    owner,
    unitType: "fighter",
    x,
    y,
    vx: 0,
    vy: 0,
    hp: 100,
    maxHp: 100,
    dmg: 10,
    attackRange: 60,
    attackRate: 1,
    maxTargets: 1,
    speed: 20,
    formationOffsetX: 0,
    formationOffsetY: 0,
    leaderId: null,
    squadId: null,
    atkCd: 0
  });
}

function getFormationOffsets(count, formationType, rows, dirX, dirY, widthScale, units) {
  const facing = Math.atan2(dirY ?? 0, dirX ?? 1);
  const unitTypes = Array.isArray(units) && units.length
    ? units.map((u) => u.unitType || "fighter")
    : Array.from({ length: count }, () => "fighter");
  return FORMATIONS.getFormationOffsets(unitTypes, formationType, rows, facing, widthScale);
}

function testFrontLaneSquadsStaySeparateOnSpawn() {
  const state = makeState();
  addUnit(state, 1, 1, 0, -170);
  addUnit(state, 2, 1, 12, -170);
  const first = SQUADLOGIC.createSquad(state, [1, 2], {
    sourceTag: "front:left",
    autoGroupUntil: 0,
    order: { type: "siege", targetCityId: 2, waypoints: [{ x: 240, y: 120 }] }
  });
  SQUADLOGIC.recalculateFormation(state, first.id, { getFormationOffsets }, true);

  addUnit(state, 3, 1, 70, -130);
  const second = SQUADLOGIC.createSquad(state, [3], {
    sourceTag: "front:left",
    autoGroupUntil: state.t + 2,
    allowAutoJoinRecentSpawn: true,
    order: { type: "siege", targetCityId: 2, waypoints: [{ x: 240, y: 120 }] }
  });

  assert(second.id !== first.id, "new front lane unit keeps its own technical squad");
  assert(state.squads.size === 2, "front lane spawn no longer auto-merges into route group");
  assert(state.squads.get(first.id).unitIds.length === 2, "existing front lane squad stays unchanged");
  assert(state.squads.get(second.id).unitIds.length === 1, "new spawn remains its own unit wrapper");
  console.log("  [OK] testFrontLaneSquadsStaySeparateOnSpawn");
}

function testFrontLaneSquadsStaySeparateAfterMeeting() {
  const state = makeState();
  addUnit(state, 11, 1, 0, -170);
  addUnit(state, 12, 1, 10, -170);
  const first = SQUADLOGIC.createSquad(state, [11, 12], {
    sourceTag: "front:right",
    autoGroupUntil: 0,
    order: { type: "siege", targetCityId: 2, waypoints: [{ x: 240, y: 120 }] }
  });
  addUnit(state, 13, 1, 260, 140);
  addUnit(state, 14, 1, 272, 140);
  const second = SQUADLOGIC.createSquad(state, [13, 14], {
    sourceTag: "front:right",
    autoGroupUntil: 0,
    order: { type: "siege", targetCityId: 2, waypoints: [{ x: 240, y: 120 }] }
  });

  state.units.get(13).x = 90;
  state.units.get(13).y = -110;
  state.units.get(14).x = 102;
  state.units.get(14).y = -110;
  SQUADLOGIC.mergeRouteCompatibleSquads(state);

  assert(state.squads.size === 2, "same-front route squads do not merge after meeting anymore");
  assert(state.squads.get(first.id), "first front lane squad still exists");
  assert(state.squads.get(second.id), "second front lane squad still exists");
  console.log("  [OK] testFrontLaneSquadsStaySeparateAfterMeeting");
}

function runAll() {
  console.log("front-merge tests:");
  testFrontLaneSquadsStaySeparateOnSpawn();
  testFrontLaneSquadsStaySeparateAfterMeeting();
  console.log("All front-merge tests passed.");
}

runAll();
