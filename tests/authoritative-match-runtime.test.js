const NET = require("../net.js");
const { createAuthoritativeMatchRuntime } = require("../authoritative-match-runtime.js");
const CardSystem = require("../card-system.js");

function assert(ok, msg) {
  if (!ok) throw new Error("FAIL: " + msg);
}

function makeRuntime(options) {
  const opts = options || {};
  return createAuthoritativeMatchRuntime({
    roomId: "room-auth-test",
    seed: 12345,
    enableLaneFighterWaves: opts.enableLaneFighterWaves === true,
    slots: opts.slots || [
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

function testBotOpeningPurchaseUsesFrontTriplet() {
  const runtime = makeRuntime({
    slots: [
      { id: "socket_a", name: "Alpha", colorIndex: 0 },
      { id: null, name: "Bot", colorIndex: 1, isBot: true }
    ]
  });
  runtime.state.players.get(2).eCredits = 2000;
  tick(runtime, 420);

  const frontSquads = [...runtime.state.squads.values()].filter((squad) =>
    squad &&
    squad.ownerId === 2 &&
    typeof squad.sourceTag === "string" &&
    squad.sourceTag.startsWith("front:")
  );
  assert(frontSquads.length >= 3, "bot opening purchase creates front-tagged triplet squads");
  const frontTypes = new Set(frontSquads.map((squad) => squad.frontType).filter(Boolean));
  assert(frontTypes.size === 3, "bot opening purchase spreads across left, center, and right fronts");
  assert(frontTypes.has("left") && frontTypes.has("center") && frontTypes.has("right"), "bot opening purchase preserves all three triplet fronts");
  const centerWaypoint = frontSquads
    .filter((squad) => squad.frontType === "center")
    .flatMap((squad) => Array.isArray(squad.order?.waypoints) ? [squad.order.waypoints[0]] : [])
    .find(Boolean);
  assert(centerWaypoint, "bot opening center triplet keeps an explicit center waypoint");
  assert(
    Math.abs(centerWaypoint.x - runtime.state.centerObjectives.centerX) < 2 &&
      Math.abs(centerWaypoint.y - runtime.state.centerObjectives.centerY) < 2,
    "bot opening center triplet first heads to the map center"
  );
  console.log("  [OK] testBotOpeningPurchaseUsesFrontTriplet");
}

function testLaneFighterWaveKeepsCenterFrontAssignment() {
  const runtime = makeRuntime({ enableLaneFighterWaves: true });
  tick(runtime, 5);

  const timedSquads = [...runtime.state.squads.values()].filter((squad) =>
    squad &&
    squad.ownerId === 1 &&
    typeof squad.sourceTag === "string" &&
    squad.sourceTag.startsWith("timed:laneFighters:1:")
  );
  const centerSquad = timedSquads.find((squad) => squad.sourceTag === "timed:laneFighters:1:center");
  assert(centerSquad, "lane fighter wave spawns a dedicated center squad for player 1");
  assert(centerSquad.frontType === "center", "center wave squad stores explicit center frontType on the authoritative server");
  assert(
    runtime.state.squadFrontAssignments &&
      runtime.state.squadFrontAssignments[centerSquad.id] &&
      runtime.state.squadFrontAssignments[centerSquad.id].frontType === "center",
    "center wave squad keeps center front assignment in authoritative state"
  );
  console.log("  [OK] testLaneFighterWaveKeepsCenterFrontAssignment");
}

function testFourPlayerBottomRightCenterWaveMovesTowardMapCenter() {
  const runtime = makeRuntime({
    enableLaneFighterWaves: true,
    slots: [
      { id: "socket_a", name: "Alpha", colorIndex: 0 },
      { id: "socket_b", name: "Bravo", colorIndex: 1 },
      { id: "socket_c", name: "Charlie", colorIndex: 2 },
      { id: "socket_d", name: "Delta", colorIndex: 3 }
    ]
  });
  tick(runtime, 5);

  const player = runtime.state.players.get(3);
  const centerSquad = [...runtime.state.squads.values()].find((squad) =>
    squad &&
    squad.ownerId === 3 &&
    squad.sourceTag === "timed:laneFighters:3:center"
  );
  assert(player && centerSquad, "bottom-right player center wave squad exists in 4-player authoritative runtime");
  const firstWaypoint = Array.isArray(centerSquad.order?.waypoints) ? centerSquad.order.waypoints[0] : null;
  assert(firstWaypoint, "center wave keeps an initial waypoint");
  assert(firstWaypoint.x < player.x - 80, "bottom-right center wave first heads left toward map center instead of straight up a side lane");
  assert(firstWaypoint.y < player.y - 80, "bottom-right center wave first heads upward toward map center");
  console.log("  [OK] testFourPlayerBottomRightCenterWaveMovesTowardMapCenter");
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

function testHpBuffUpdatesExistingAndFutureShips() {
  const runtime = makeRuntime();
  const player = runtime.state.players.get(1);
  player.eCredits = 10000;

  runtime.enqueueAction({
    type: "purchase",
    unitType: "destroyer",
    waypoints: [{ x: 3000, y: 1800 }],
    _senderSlot: 0,
    _senderPlayerId: 1
  });
  tick(runtime, 40);

  const firstUnit = getUnitsFor(runtime, 1)[0];
  const hpBefore = firstUnit.maxHp;

  CardSystem.ensurePlayerCardState(player);
  player.buffHand.push({
    instanceId: "hp_test_buff",
    cardId: "c1",
    zone: "buff",
    kind: "buff",
    addedAt: runtime.state.t
  });
  player.cardStateVersion = (player.cardStateVersion || 0) + 1;

  runtime.enqueueAction({
    type: "activateBuffCard",
    instanceId: "hp_test_buff",
    _senderSlot: 0,
    _senderPlayerId: 1
  });
  tick(runtime, 5);

  const buffedFirstUnit = runtime.state.units.get(firstUnit.id);
  assert(buffedFirstUnit.maxHp > hpBefore, "existing ships receive HP buff immediately on server");

  runtime.enqueueAction({
    type: "purchase",
    unitType: "destroyer",
    waypoints: [{ x: 3200, y: 1800 }],
    _senderSlot: 0,
    _senderPlayerId: 1
  });
  tick(runtime, 40);

  const newestUnit = getUnitsFor(runtime, 1).reduce((latest, unit) => {
    if (!latest) return unit;
    return unit.id > latest.id ? unit : latest;
  }, null);
  assert(newestUnit && newestUnit.maxHp === buffedFirstUnit.maxHp, "future ships spawn with the same HP buff applied");
  console.log("  [OK] testHpBuffUpdatesExistingAndFutureShips");
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
  tick(runtime, 120);

  const enemyAfter = runtime.state.units.get(enemyUnit.id);
  assert(Array.isArray(runtime.state._blackHoles) && runtime.state._blackHoles.length > 0, "black hole is spawned in authoritative state");
  assert(!enemyAfter || enemyAfter.hp < hpBefore, "black hole damages units inside its radius on the server");
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

function testDisabledAbilitiesAreRejected() {
  const runtime = makeRuntime();
  tick(runtime, 30);
  const tBefore = runtime.state.t;
  for (const abilityId of ["droneSwarm", "frigateWarp", "timeJump"]) {
    runtime.enqueueAction({
      type: "useAbility",
      abilityId,
      frontType: "center",
      _senderSlot: 0,
      _senderPlayerId: 1
    });
    tick(runtime, 3);
  }
  const snap = serialize(runtime);
  const cooldowns = runtime.state._abilityCooldownsByPlayer[1] || {};
  const summonedUnits = [...runtime.state.units.values()].filter((unit) => unit && (unit._fighterWingSummon || unit._frigateSummon));
  assert(summonedUnits.length === 0, "disabled abilities do not spawn summon-marked units");
  assert(cooldowns.droneSwarm == null && cooldowns.frigateWarp == null && cooldowns.timeJump == null, "disabled abilities do not start cooldowns");
  assert(runtime.state.t >= tBefore, "disabled time jump does not rewind authoritative time");
  assert(!snap.abilityCooldownsByPlayer || !snap.abilityCooldownsByPlayer["1"] || (snap.abilityCooldownsByPlayer["1"].droneSwarm == null && snap.abilityCooldownsByPlayer["1"].frigateWarp == null && snap.abilityCooldownsByPlayer["1"].timeJump == null), "disabled abilities are absent from serialized cooldown state");
  console.log("  [OK] testDisabledAbilitiesAreRejected");
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
  const primaryShot = runtime.state._orbitalStrikes[0]?.shots?.find((shot) => shot.primary) || runtime.state._orbitalStrikes[0]?.shots?.[0];
  if (primaryShot) {
    enemy.x = primaryShot.tx;
    enemy.y = primaryShot.ty;
    enemy.waypoints = [{ x: primaryShot.tx, y: primaryShot.ty }];
  }
  tick(runtime, 120);

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
  tick(runtime, 130);

  assert(Array.isArray(snapBeforeImpact.thermoNukes) && snapBeforeImpact.thermoNukes.length === 1, "thermo nuke is serialized into snapshot before impact");
  assert(!runtime.state.units.has(enemy.id), "thermo nuke removes enemy units inside impact radius on server");
  console.log("  [OK] testThermoNukeSerializesAndKillsEnemy");
}

function testServerBootstrapBuildsWorldStructures() {
  const runtime = makeRuntime();
  const serializer = new NET.SnapshotSerializer();
  serializer.tickCount = 14;
  const snap = serializer.serialize(runtime.state);
  assert(runtime.state.mines.size >= 7, "server bootstrap creates lane and core mines");
  assert(Array.isArray(runtime.state.sectorObjectives) && runtime.state.sectorObjectives.length === 2, "server bootstrap creates duel sector objectives");
  assert(runtime.state.turrets.size === 12, "server bootstrap creates six turrets per player");
  assert(runtime.state.pirateBase && runtime.state.pirateBase.hp > 0, "server bootstrap creates center pirate base");
  assert(Array.isArray(snap.mines) && snap.mines.length === runtime.state.mines.size, "world mines serialize into snapshot");
  assert(Array.isArray(snap.turrets) && snap.turrets.length === runtime.state.turrets.size, "world turrets serialize into snapshot");
  assert(Array.isArray(snap.sectorObjectives) && snap.sectorObjectives.length === runtime.state.sectorObjectives.length, "sector objectives serialize into snapshot");
  console.log("  [OK] testServerBootstrapBuildsWorldStructures");
}

function testStartingMineEconomyAdvancesCreditsAndXp() {
  const runtime = makeRuntime();
  const player = runtime.state.players.get(1);
  const creditsBefore = player.eCredits;
  const xpBefore = player.xp;
  tick(runtime, 240);
  assert(player.eCredits > creditsBefore, "starting owned mines generate credits on the server");
  assert(player.xp > xpBefore, "starting owned xp mines generate experience on the server");
  console.log("  [OK] testStartingMineEconomyAdvancesCreditsAndXp");
}

function testInitialLaneFighterWavesSpawnOnServer() {
  const runtime = makeRuntime({ enableLaneFighterWaves: true });
  tick(runtime, 2);

  const p1Fighters = getUnitsFor(runtime, 1).filter((unit) => unit.unitType === "fighter" && unit._autoLaneFighterWave);
  const p2Fighters = getUnitsFor(runtime, 2).filter((unit) => unit.unitType === "fighter" && unit._autoLaneFighterWave);

  assert(p1Fighters.length === 9, "server runtime spawns three opening fighters per front for player one");
  assert(p2Fighters.length === 9, "server runtime spawns three opening fighters per front for player two");
  console.log("  [OK] testInitialLaneFighterWavesSpawnOnServer");
}

function testFrontPlannerPushesOpeningWaveTowardEnemy() {
  const runtime = makeRuntime({ enableLaneFighterWaves: true });
  const enemyCore = runtime.state.players.get(2);
  tick(runtime, 2);

  const fighter = getUnitsFor(runtime, 1).find((unit) => unit.unitType === "fighter" && unit._autoLaneFighterWave);
  const beforeDist = Math.hypot(enemyCore.x - fighter.x, enemyCore.y - fighter.y);
  tick(runtime, 150);
  const moved = runtime.state.units.get(fighter.id);
  const afterDist = Math.hypot(enemyCore.x - moved.x, enemyCore.y - moved.y);

  assert(afterDist < beforeDist, "front planner keeps opening wave advancing toward enemy core");
  console.log("  [OK] testFrontPlannerPushesOpeningWaveTowardEnemy");
}

function runAll() {
  console.log("authoritative-match-runtime tests:");
  testPurchaseFrontTripletSpawnsServerUnits();
  testBotOpeningPurchaseUsesFrontTriplet();
  testLaneFighterWaveKeepsCenterFrontAssignment();
  testFourPlayerBottomRightCenterWaveMovesTowardMapCenter();
  testMoveActionRepathsServerOwnedSquad();
  testHpBuffUpdatesExistingAndFutureShips();
  testBlackHoleActionMutatesAuthoritativeState();
  testIonFieldSerializesAndDamagesEnemy();
  testGravAnchorSerializesAndPinsEnemy();
  testDisabledAbilitiesAreRejected();
  testOrbitalStrikeSerializesAndDamagesEnemy();
  testMinefieldSerializesAndDetonatesEnemy();
  testThermoNukeSerializesAndKillsEnemy();
  testServerBootstrapBuildsWorldStructures();
  testStartingMineEconomyAdvancesCreditsAndXp();
  testInitialLaneFighterWavesSpawnOnServer();
  testFrontPlannerPushesOpeningWaveTowardEnemy();
  console.log("All authoritative-match-runtime tests passed.");
}

runAll();
