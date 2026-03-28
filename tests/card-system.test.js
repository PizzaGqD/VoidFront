const CardSystem = require("../card-system.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function makePlayer() {
  return CardSystem.ensurePlayerCardState({
    id: 1,
    nextCardInstanceId: 1,
    buffHand: [],
    abilityHand: [],
    activeBuffs: [],
    legendaryBuffs: [],
    burnedCards: [],
    cardStateVersion: 0
  });
}

function makeRng(values) {
  let idx = 0;
  return function () {
    const v = values[idx % values.length];
    idx += 1;
    return v;
  };
}

function fillHandWith(player, cardId, count, nowBase) {
  const def = CardSystem.getCardDef(cardId);
  for (let i = 0; i < count; i++) {
    const instance = {
      instanceId: "test_" + i,
      cardId,
      zone: def.zone,
      kind: def.kind,
      addedAt: (nowBase || 0) + i
    };
    if (def.zone === "ability") player.abilityHand.push(instance);
    else player.buffHand.push(instance);
  }
}

function testBuffOverflowBurnsOldest() {
  const player = makePlayer();
  fillHandWith(player, "c1", CardSystem.BUFF_HAND_LIMIT, 10);
  const drawn = CardSystem.drawRandomCardForPlayer(player, { now: 999, rng: makeRng([0.0, 0.0, 0.0]) });
  assert(drawn.ok, "buff overflow: draw succeeds");
  assert(player.buffHand.length === CardSystem.BUFF_HAND_LIMIT, "buff overflow: hand stays capped");
  assert(player.buffHand[0].instanceId === "test_1", "buff overflow: oldest card burned first");
  assert(player.burnedCards.length === 1, "buff overflow: burn log updated");
}

function testAbilityOverflowBurnsOldest() {
  const player = makePlayer();
  fillHandWith(player, "A_activeShield", CardSystem.ABILITY_HAND_LIMIT, 10);
  const drawn = CardSystem.drawRandomCardForPlayer(player, { now: 999, rng: makeRng([0.95, 0.2, 0.0]) });
  assert(drawn.ok, "ability overflow: draw succeeds");
  assert(player.abilityHand.length === CardSystem.ABILITY_HAND_LIMIT, "ability overflow: hand stays capped");
  assert(player.abilityHand[0].instanceId === "test_1", "ability overflow: oldest ability burned first");
}

function testActivateTemporaryBuffMovesToActive() {
  const player = makePlayer();
  const def = CardSystem.getCardDef("c1");
  player.buffHand.push({
    instanceId: "buff_1",
    cardId: def.id,
    zone: def.zone,
    kind: def.kind,
    addedAt: 10
  });
  const out = CardSystem.activateBuffCard(player, "buff_1", 50);
  assert(out.ok, "activate temp buff: succeeds");
  assert(player.buffHand.length === 0, "activate temp buff: removed from hand");
  assert(player.activeBuffs.length === 1, "activate temp buff: moved to active list");
  assert(player.activeBuffs[0].expiresAt > 50, "activate temp buff: has expiration");
}

function testLegendaryBuffMovesToPermanent() {
  const player = makePlayer();
  const def = CardSystem.getCardDef("L1");
  player.buffHand.push({
    instanceId: "legend_1",
    cardId: def.id,
    zone: def.zone,
    kind: def.kind,
    addedAt: 10
  });
  const out = CardSystem.activateBuffCard(player, "legend_1", 50);
  assert(out.ok, "activate legendary buff: succeeds");
  assert(player.legendaryBuffs.length === 1, "activate legendary buff: moved to permanent list");
  assert(player.legendaryBuffs[0].permanent === true, "activate legendary buff: marked permanent");
}

function testExpireTimedBuffsRemovesExpired() {
  const player = makePlayer();
  player.activeBuffs.push(
    { instanceId: "a1", cardId: "c1", startedAt: 0, expiresAt: 5, permanent: false },
    { instanceId: "a2", cardId: "c2", startedAt: 0, expiresAt: 15, permanent: false }
  );
  const changed = CardSystem.expireTimedBuffs(player, 10);
  assert(changed, "expire buffs: reports change");
  assert(player.activeBuffs.length === 1, "expire buffs: removes expired entries");
  assert(player.activeBuffs[0].instanceId === "a2", "expire buffs: keeps still-active entries");
}

function testAbilityCatalogMatchesStageThreeLineup() {
  assert(!!CardSystem.getAbilityDef("ionNebula"), "stage3 lineup: ion storm restored");
  assert(!!CardSystem.getAbilityDef("ionField"), "stage3 lineup: short ion field exists");
  assert(!!CardSystem.getAbilityDef("minefield"), "stage3 lineup: small minefield exists");
  assert(!!CardSystem.getAbilityDef("minefieldLarge"), "stage3 lineup: large minefield exists");
  assert(!!CardSystem.getAbilityDef("microBlackHole"), "stage3 lineup: micro black hole exists");
  assert(!!CardSystem.getAbilityDef("gravAnchor"), "stage3 lineup: grav anchor restored");
  assert(!!CardSystem.getAbilityDef("microAnchor"), "stage3 lineup: junior grav anchor exists");
  assert(!!CardSystem.getAbilityDef("orbitalStrike"), "stage3 lineup: small orbital strike exists");
  assert(!!CardSystem.getAbilityDef("orbitalBarrage"), "stage3 lineup: orbital barrage exists");
  assert(!CardSystem.getAbilityDef("droneSwarm"), "stage3 lineup: fighter wing disabled");
  assert(!CardSystem.getAbilityDef("frigateWarp"), "stage3 lineup: frigate summon disabled");
  assert(!CardSystem.getAbilityDef("timeJump"), "stage3 lineup: time jump disabled");
  assert(!CardSystem.getAbilityDef("pirateRaid"), "stage3 lineup: pirate raid removed");
  assert(!CardSystem.getAbilityDef("cosmicGodHand"), "stage3 lineup: god hand removed");
  assert(!CardSystem.getAbilityDef("resourceRaid"), "stage3 lineup: mine raid removed");
  assert(!CardSystem.getAbilityDef("impulseBomb"), "stage3 lineup: impulse bomb removed");
}

function run() {
  const tests = [
    testBuffOverflowBurnsOldest,
    testAbilityOverflowBurnsOldest,
    testActivateTemporaryBuffMovesToActive,
    testLegendaryBuffMovesToPermanent,
    testExpireTimedBuffsRemovesExpired,
    testAbilityCatalogMatchesStageThreeLineup
  ];
  console.log("card-system tests:");
  for (const test of tests) {
    test();
    console.log("  [OK] " + test.name);
  }
  console.log("All card-system tests passed.");
}

run();
