const SocketActionDispatch = require("../socket-action-dispatch.js");
const FrontPlanner = require("../front-planner.js");
const SQUADLOGIC = require("../squad-logic.js");
const FORMATIONS = require("../formations.js");

global.FrontPlanner = FrontPlanner;
global.SQUADLOGIC = SQUADLOGIC;

function assert(ok, msg) {
  if (!ok) throw new Error("FAIL: " + msg);
}

function getFormationOffsets(count, formationType, rows, dirX, dirY, widthScale, units) {
  const facing = Math.atan2(dirY ?? 0, dirX ?? 1);
  const unitTypes = Array.isArray(units) && units.length
    ? units.map((u) => u.unitType || "fighter")
    : Array.from({ length: count }, () => "fighter");
  return FORMATIONS.getFormationOffsets(unitTypes, formationType, rows, facing, widthScale);
}

function makeState() {
  return {
    t: 0,
    _multiIsHost: true,
    _multiSlots: [{}, {}],
    _slotToPid: { 0: 1, 1: 2 },
    players: new Map([
      [1, { id: 1, x: 0, y: -100, eliminated: false }],
      [2, { id: 2, x: 100, y: 0, eliminated: false }]
    ]),
    units: new Map(),
    squads: new Map(),
    engagementZones: new Map(),
    turrets: new Map(),
    mines: new Map(),
    pirateBases: [],
    nextSquadId: 1,
    nextEngagementZoneId: 1
  };
}

function addUnit(state, spec) {
  const unit = {
    id: spec.id,
    owner: spec.owner,
    unitType: "fighter",
    x: spec.x,
    y: spec.y,
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
  };
  state.units.set(unit.id, unit);
  return unit;
}

function createSquad(state, specs) {
  const ids = specs.map((spec) => addUnit(state, spec).id);
  const squad = SQUADLOGIC.createSquad(state, ids, { order: { type: "idle", waypoints: [] } });
  SQUADLOGIC.recalculateFormation(state, squad.id, { getFormationOffsets }, true);
  return squad;
}

function makeDispatch(state) {
  return SocketActionDispatch.install({
    state,
    CFG: {},
    purchaseUnit: () => ({ ok: true }),
    purchaseFrontTriplet: () => ({ ok: true, squadIds: [1, 2, 3] }),
    shieldRadius: () => 0,
    getUnitAtkRange: (u) => u.attackRange || 60,
    getSquadStateFromUnits: (squad) => (squad && squad[0] && squad[0].squadId != null ? state.squads.get(squad[0].squadId) : null),
    getFormationOffsets,
    applyFormationToSquad: () => {},
    ABILITY_DEFS: {},
    setAbilityCooldown: () => {},
    pushAbilityAnnouncement: () => {},
    spawnIonNebulaLocal: () => {},
    spawnMeteorLocal: () => {},
    spawnBlackHole: () => {},
    useActiveShield: () => {},
    spawnPirateRaid: () => {},
    useGloriousBattleMarch: () => {},
    useLoan: () => {},
    useRaiderCapture: () => {},
    beginTimeRewindSequence: () => {},
    applyCard: () => {},
    TIME_JUMP_REWIND_SEC: 60,
    activateBuffCardForPlayer: () => {},
    castAbilityCardForPlayer: () => {},
    executeAbilityAction: () => {}
  });
}

function testSenderTripleSpawnStaysScopedToOwnPlayer() {
  const state = makeState();
  const calls = [];
  const dispatch = SocketActionDispatch.install({
    state,
    CFG: {},
    purchaseUnit: () => ({ ok: true }),
    purchaseFrontTriplet: (pid, unitType) => {
      calls.push({ pid, unitType });
      return { ok: true };
    },
    shieldRadius: () => 0,
    getUnitAtkRange: (u) => u.attackRange || 60,
    getSquadStateFromUnits: (squad) => (squad && squad[0] && squad[0].squadId != null ? state.squads.get(squad[0].squadId) : null),
    getFormationOffsets,
    applyFormationToSquad: () => {},
    ABILITY_DEFS: {},
    setAbilityCooldown: () => {},
    pushAbilityAnnouncement: () => {},
    spawnIonNebulaLocal: () => {},
    spawnMeteorLocal: () => {},
    spawnBlackHole: () => {},
    useActiveShield: () => {},
    spawnPirateRaid: () => {},
    useGloriousBattleMarch: () => {},
    useLoan: () => {},
    useRaiderCapture: () => {},
    beginTimeRewindSequence: () => {},
    applyCard: () => {},
    TIME_JUMP_REWIND_SEC: 60,
    activateBuffCardForPlayer: () => {},
    castAbilityCardForPlayer: () => {},
    executeAbilityAction: () => {}
  });

  dispatch.handlePlayerAction({
    type: "purchaseFrontTriplet",
    coreId: 1,
    unitType: "fighter",
    _senderPlayerId: 2
  });

  assert(calls.length === 1, "triple spawn action is forwarded once");
  assert(calls[0].pid === 2, "host resolves purchaseFrontTriplet to sender pid");
  assert(calls[0].unitType === "fighter", "requested unit type is preserved");
  console.log("  [OK] testSenderTripleSpawnStaysScopedToOwnPlayer");
}

function testSenderCannotMoveForeignSquad() {
  const state = makeState();
  const ownSquad = createSquad(state, [
    { id: 1, owner: 1, x: 0, y: -80 },
    { id: 2, owner: 1, x: 12, y: -80 }
  ]);
  createSquad(state, [
    { id: 3, owner: 2, x: 100, y: -10 },
    { id: 4, owner: 2, x: 112, y: -10 }
  ]);
  const dispatch = makeDispatch(state);

  dispatch.handlePlayerAction({
    type: "move",
    leaderIds: [ownSquad.leaderUnitId],
    waypoints: [{ x: 300, y: 300 }],
    _senderPlayerId: 2
  });

  const unchanged = state.squads.get(ownSquad.id);
  assert(unchanged.order.type === "idle", "foreign sender cannot change someone else's squad order");
  console.log("  [OK] testSenderCannotMoveForeignSquad");
}

function runAll() {
  console.log("multiplayer-front-actions tests:");
  testSenderTripleSpawnStaysScopedToOwnPlayer();
  testSenderCannotMoveForeignSquad();
  console.log("All multiplayer-front-actions tests passed.");
}

runAll();
