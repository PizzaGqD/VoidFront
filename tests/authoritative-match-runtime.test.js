const NET = require("../net.js");
const { createAuthoritativeMatchRuntime } = require("../authoritative-match-runtime.js");

function assert(ok, msg) {
  if (!ok) throw new Error("FAIL: " + msg);
}

function makeRuntime() {
  return createAuthoritativeMatchRuntime({
    roomId: "room-auth-test",
    seed: 12345,
    slots: [
      { id: "socket_a", name: "Alpha", colorIndex: 0 },
      { id: "socket_b", name: "Bravo", colorIndex: 1 }
    ]
  });
}

function tick(runtime, frames) {
  for (let i = 0; i < frames; i++) runtime.tick();
}

function getUnitsFor(runtime, ownerId) {
  return [...runtime.state.units.values()].filter((unit) => unit.owner === ownerId);
}

function serialize(runtime) {
  const serializer = new NET.SnapshotSerializer();
  return serializer.serialize(runtime.state);
}

function testPurchaseFrontTripletSpawnsServerUnits() {
  const runtime = makeRuntime();
  runtime.state.players.get(1).eCredits = 5000;

  runtime.enqueueAction({
    type: "purchaseFrontTriplet",
    unitType: "destroyer",
    _senderSlot: 0,
    _senderPlayerId: 1
  });
  tick(runtime, 40);

  const ownUnits = getUnitsFor(runtime, 1);
  assert(ownUnits.length === 3, "server runtime spawns three destroyers for front triplet");
  assert(ownUnits.every((unit) => unit.unitType === "destroyer"), "spawned units preserve requested type");
  assert(ownUnits.every((unit) => unit.squadId != null), "spawned units are attached to squads");
  console.log("  [OK] testPurchaseFrontTripletSpawnsServerUnits");
}

function testMoveActionRepathsServerOwnedSquad() {
  const runtime = makeRuntime();
  runtime.state.players.get(1).eCredits = 5000;
  runtime.enqueueAction({
    type: "purchase",
    unitType: "destroyer",
    waypoints: [{ x: 3000, y: 1800 }],
    _senderSlot: 0,
    _senderPlayerId: 1
  });
  tick(runtime, 40);

  const unit = getUnitsFor(runtime, 1)[0];
  const before = { x: unit.x, y: unit.y };
  const target = { x: 4200, y: 2600 };
  runtime.enqueueAction({
    type: "move",
    leaderIds: [unit.id],
    waypoints: [target],
    _senderSlot: 0,
    _senderPlayerId: 1
  });
  tick(runtime, 90);

  const moved = runtime.state.units.get(unit.id);
  const beforeDist = Math.hypot(target.x - before.x, target.y - before.y);
  const afterDist = Math.hypot(target.x - moved.x, target.y - moved.y);
  assert(afterDist < beforeDist, "authoritative move action advances unit toward new target");
  console.log("  [OK] testMoveActionRepathsServerOwnedSquad");
}

function testBlackHoleActionMutatesAuthoritativeState() {
  const runtime = makeRuntime();
  runtime.state.players.get(1).eCredits = 5000;
  runtime.state.players.get(2).eCredits = 5000;
  runtime.enqueueAction({
    type: "purchase",
    unitType: "destroyer",
    waypoints: [{ x: 3600, y: 2160 }],
    _senderSlot: 0,
    _senderPlayerId: 1
  });
  runtime.enqueueAction({
    type: "purchase",
    unitType: "destroyer",
    waypoints: [{ x: 3600, y: 2160 }],
    _senderSlot: 1,
    _senderPlayerId: 2
  });
  tick(runtime, 40);

  const enemyUnit = getUnitsFor(runtime, 2)[0];
  enemyUnit.x = 3600;
  enemyUnit.y = 2160;
  enemyUnit.vx = 0;
  enemyUnit.vy = 0;
  const hpBefore = enemyUnit.hp;

  runtime.enqueueAction({
    type: "useAbility",
    abilityId: "blackHole",
    x: 3600,
    y: 2160,
    _senderSlot: 0,
    _senderPlayerId: 1
  });
  tick(runtime, 45);

  const enemyAfter = runtime.state.units.get(enemyUnit.id);
  assert(Array.isArray(runtime.state._blackHoles) && runtime.state._blackHoles.length > 0, "black hole is spawned in authoritative state");
  assert(enemyAfter && enemyAfter.hp < hpBefore, "black hole damages units inside its radius on the server");
  console.log("  [OK] testBlackHoleActionMutatesAuthoritativeState");
}

function testIonFieldSerializesAndDamagesEnemy() {
  const runtime = makeRuntime();
  runtime.state.players.get(1).eCredits = 5000;
  runtime.state.players.get(2).eCredits = 5000;
  runtime.enqueueAction({
    type: "purchase",
    unitType: "destroyer",
    waypoints: [{ x: 2800, y: 1800 }],
    _senderSlot: 0,
    _senderPlayerId: 1
  });
  runtime.enqueueAction({
    type: "purchase",
    unitType: "destroyer",
    waypoints: [{ x: 2800, y: 1800 }],
    _senderSlot: 1,
    _senderPlayerId: 2
  });
  tick(runtime, 40);

  const enemy = getUnitsFor(runtime, 2)[0];
  enemy.x = 2800;
  enemy.y = 1800;
  const hpBefore = enemy.hp;

  runtime.enqueueAction({
    type: "useAbility",
    abilityId: "ionField",
    x: 2800,
    y: 1800,
    _senderSlot: 0,
    _senderPlayerId: 1
  });
  tick(runtime, 30);

  const snap = serialize(runtime);
  const enemyAfter = runtime.state.units.get(enemy.id);
  assert(Array.isArray(runtime.state._abilityStorms) && runtime.state._abilityStorms.length === 1, "ion field storm exists in authoritative state");
  assert(Array.isArray(snap.abilityStorms) && snap.abilityStorms.length === 1, "ion field is serialized into snapshot");
  assert(enemyAfter && enemyAfter.hp < hpBefore, "ion field damages enemy units on server");
  console.log("  [OK] testIonFieldSerializesAndDamagesEnemy");
}

function testGravAnchorSerializesAndPinsEnemy() {
  const runtime = makeRuntime();
  runtime.state.players.get(1).eCredits = 5000;
  runtime.state.players.get(2).eCredits = 5000;
  runtime.enqueueAction({
    type: "purchase",
    unitType: "destroyer",
    waypoints: [{ x: 3200, y: 1800 }],
    _senderSlot: 1,
    _senderPlayerId: 2
  });
  tick(runtime, 40);

  const enemy = getUnitsFor(runtime, 2)[0];
  enemy.x = 3300;
  enemy.y = 1800;
  enemy.vx = 10;
  enemy.vy = 0;
  const before = { x: enemy.x, y: enemy.y };

  runtime.enqueueAction({
    type: "useAbility",
    abilityId: "gravAnchor",
    x: 3000,
    y: 1800,
    _senderSlot: 0,
    _senderPlayerId: 1
  });
  tick(runtime, 10);

  const enemyAfter = runtime.state.units.get(enemy.id);
  const snap = serialize(runtime);
  assert(Array.isArray(runtime.state._abilityZoneEffects) && runtime.state._abilityZoneEffects.some((z) => z.type === "anchor"), "grav anchor zone exists in authoritative state");
  assert(Array.isArray(snap.abilityZoneEffects) && snap.abilityZoneEffects.some((z) => z.type === "anchor"), "grav anchor zone is serialized into snapshot");
  assert(enemyAfter && enemyAfter.x < before.x, "grav anchor pulls enemy toward the center");
  assert(enemyAfter && enemyAfter._anchorStasisUntil > runtime.state.t, "grav anchor applies stasis to enemy");
  console.log("  [OK] testGravAnchorSerializesAndPinsEnemy");
}

function testDroneSwarmSpawnsFightersAndSetsCooldown() {
  const runtime = makeRuntime();
  runtime.enqueueAction({
    type: "useAbility",
    abilityId: "droneSwarm",
    frontType: "center",
    _senderSlot: 0,
    _senderPlayerId: 1
  });
  tick(runtime, 5);

  const ownUnits = getUnitsFor(runtime, 1);
  const fighters = ownUnits.filter((unit) => unit.unitType === "fighter");
  const snap = serialize(runtime);
  const cooldowns = runtime.state._abilityCooldownsByPlayer[1] || {};
  assert(fighters.length === 6, "drone swarm spawns six fighters on server");
  assert(cooldowns.droneSwarm > 0, "drone swarm cooldown is tracked in authoritative state");
  assert(snap.abilityCooldownsByPlayer && snap.abilityCooldownsByPlayer["1"] && snap.abilityCooldownsByPlayer["1"].droneSwarm > 0, "drone swarm cooldown is serialized into snapshot");
  console.log("  [OK] testDroneSwarmSpawnsFightersAndSetsCooldown");
}

function testOrbitalStrikeSerializesAndDamagesEnemy() {
  const runtime = makeRuntime();
  runtime.state.players.get(1).eCredits = 5000;
  runtime.state.players.get(2).eCredits = 5000;
  runtime.enqueueAction({
    type: "purchase",
    unitType: "destroyer",
    waypoints: [{ x: 3400, y: 2000 }],
    _senderSlot: 1,
    _senderPlayerId: 2
  });
  tick(runtime, 40);

  const enemy = getUnitsFor(runtime, 2)[0];
  enemy.x = 3400;
  enemy.y = 2000;
  enemy.waypoints = [{ x: 3400, y: 2000 }];
  enemy.waypointIndex = 0;
  enemy.vx = 0;
  enemy.vy = 0;
  const hpBefore = enemy.hp;

  runtime.enqueueAction({
    type: "useAbility",
    abilityId: "orbitalStrike",
    x: 3400,
    y: 2000,
    _senderSlot: 0,
    _senderPlayerId: 1
  });
  tick(runtime, 5);
  const snapBeforeImpact = serialize(runtime);
  tick(runtime, 70);

  const enemyAfter = runtime.state.units.get(enemy.id);
  assert(Array.isArray(snapBeforeImpact.orbitalStrikes) && snapBeforeImpact.orbitalStrikes.length === 1, "orbital strike is serialized into snapshot before impact");
  assert(!enemyAfter || enemyAfter.hp < hpBefore, "orbital strike damages enemy units on server");
  console.log("  [OK] testOrbitalStrikeSerializesAndDamagesEnemy");
}

function testMinefieldSerializesAndDetonatesEnemy() {
  const runtime = makeRuntime();
  runtime.state.players.get(1).eCredits = 5000;
  runtime.state.players.get(2).eCredits = 5000;
  runtime.enqueueAction({
    type: "purchase",
    unitType: "destroyer",
    waypoints: [{ x: 3600, y: 2100 }],
    _senderSlot: 1,
    _senderPlayerId: 2
  });
  tick(runtime, 40);

  const enemy = getUnitsFor(runtime, 2)[0];
  enemy.x = 3600;
  enemy.y = 2100;
  enemy.waypoints = [{ x: 3600, y: 2100 }];
  enemy.waypointIndex = 0;
  enemy.vx = 0;
  enemy.vy = 0;
  const hpBefore = enemy.hp;

  runtime.enqueueAction({
    type: "useAbility",
    abilityId: "minefield",
    x: 3600,
    y: 2100,
    _senderSlot: 0,
    _senderPlayerId: 1
  });
  tick(runtime, 10);
  const snapBeforeDetonation = serialize(runtime);
  tick(runtime, 40);

  const enemyAfter = runtime.state.units.get(enemy.id);
  assert(Array.isArray(snapBeforeDetonation.abilityZoneEffects) && snapBeforeDetonation.abilityZoneEffects.some((z) => z.type === "minefieldMine"), "minefield mines are serialized into snapshot");
  assert(!enemyAfter || enemyAfter.hp < hpBefore, "minefield detonation damages enemy units on server");
  console.log("  [OK] testMinefieldSerializesAndDetonatesEnemy");
}

function testThermoNukeSerializesAndKillsEnemy() {
  const runtime = makeRuntime();
  runtime.state.players.get(1).eCredits = 5000;
  runtime.state.players.get(2).eCredits = 5000;
  runtime.enqueueAction({
    type: "purchase",
    unitType: "destroyer",
    waypoints: [{ x: 3800, y: 2200 }],
    _senderSlot: 1,
    _senderPlayerId: 2
  });
  tick(runtime, 40);

  const enemy = getUnitsFor(runtime, 2)[0];
  enemy.x = 3800;
  enemy.y = 2200;
  enemy.waypoints = [{ x: 3800, y: 2200 }];
  enemy.waypointIndex = 0;
  enemy.vx = 0;
  enemy.vy = 0;

  runtime.enqueueAction({
    type: "useAbility",
    abilityId: "thermoNuke",
    x: 3800,
    y: 2200,
    _senderSlot: 0,
    _senderPlayerId: 1
  });
  tick(runtime, 5);
  const snapBeforeImpact = serialize(runtime);
  tick(runtime, 110);

  assert(Array.isArray(snapBeforeImpact.thermoNukes) && snapBeforeImpact.thermoNukes.length === 1, "thermo nuke is serialized into snapshot before impact");
  assert(!runtime.state.units.has(enemy.id), "thermo nuke removes enemy units inside impact radius on server");
  console.log("  [OK] testThermoNukeSerializesAndKillsEnemy");
}

function testTimeJumpRewindsAuthoritativeState() {
  const runtime = makeRuntime();
  tick(runtime, 2020);
  const unitsBeforeSummon = runtime.state.units.size;

  runtime.enqueueAction({
    type: "useAbility",
    abilityId: "droneSwarm",
    frontType: "center",
    _senderSlot: 0,
    _senderPlayerId: 1
  });
  tick(runtime, 5);
  const unitsAfterSummon = runtime.state.units.size;
  assert(unitsAfterSummon > unitsBeforeSummon, "summon modifies state before rewind");

  runtime.enqueueAction({
    type: "useAbility",
    abilityId: "timeJump",
    _senderSlot: 0,
    _senderPlayerId: 1
  });
  tick(runtime, 2);

  assert(runtime.state.t < 20, "time jump rewinds simulation time on server");
  assert(runtime.state.units.size === unitsBeforeSummon, "time jump restores previous authoritative player state");
  console.log("  [OK] testTimeJumpRewindsAuthoritativeState");
}

function runAll() {
  console.log("authoritative-match-runtime tests:");
  testPurchaseFrontTripletSpawnsServerUnits();
  testMoveActionRepathsServerOwnedSquad();
  testBlackHoleActionMutatesAuthoritativeState();
  testIonFieldSerializesAndDamagesEnemy();
  testGravAnchorSerializesAndPinsEnemy();
  testDroneSwarmSpawnsFightersAndSetsCooldown();
  testOrbitalStrikeSerializesAndDamagesEnemy();
  testMinefieldSerializesAndDetonatesEnemy();
  testThermoNukeSerializesAndKillsEnemy();
  testTimeJumpRewindsAuthoritativeState();
  console.log("All authoritative-match-runtime tests passed.");
}

runAll();
