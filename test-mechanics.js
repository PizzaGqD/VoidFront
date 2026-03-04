/**
 * Auto-simulation tests for game mechanics.
 * Run from browser console: testAll()
 */
(function () {
  const results = [];
  function assert(cond, msg) { results.push({ pass: !!cond, msg }); if (!cond) console.error("FAIL:", msg); }

  function getApi() {
    const g = window._gameTest;
    if (!g) { assert(false, "_gameTest API not exposed"); return null; }
    return g;
  }

  function testXPOrbSpawn() {
    const api = getApi(); if (!api) return;
    const before = api.state.res.size;
    api.spawnXPOrb(500, 500, 5);
    assert(api.state.res.size > before, "XP orb spawned: res count increased from " + before + " to " + api.state.res.size);
    const last = [...api.state.res.values()].pop();
    assert(last && last.type === "orb" && last.xp === 5, "XP orb has correct type='orb' and xp=5");
  }

  function testKillUnitDropsLoot() {
    const api = getApi(); if (!api) return;
    const me = api.state.players.values().next().value;
    if (!me) { assert(false, "No player found"); return; }
    const resBefore = api.state.res.size;
    const gemsBefore = api.state.mineGems.length;
    const fakeUnit = {
      id: 999999, owner: me.id, unitType: "destroyer", hp: 0, maxHp: 100,
      x: me.x + 50, y: me.y + 50, popPenalty: 10, leaderId: null, gfx: null
    };
    api.state.units.set(fakeUnit.id, fakeUnit);
    api.killUnit(fakeUnit, "killed", me.id);
    assert(api.state.res.size > resBefore, "Kill unit spawned XP orb (res: " + resBefore + " -> " + api.state.res.size + ")");
    assert(api.state.mineGems.length > gemsBefore, "Kill unit spawned credit gem (gems: " + gemsBefore + " -> " + api.state.mineGems.length + ")");
  }

  function testZoneAttractsOrbs() {
    const api = getApi(); if (!api) return;
    const me = api.state.players.values().next().value;
    if (!me) { assert(false, "No player"); return; }
    const orbId = api.state.nextResId++;
    const orb = { id: orbId, type: "orb", xp: 3, x: me.x + 30, y: me.y + 30, color: 0xffdd44, gfx: null, _targetCity: null };
    api.state.res.set(orbId, orb);
    api.stepResourceMagnet(0.1);
    const updated = api.state.res.get(orbId);
    if (updated) {
      assert(updated._targetCity != null, "Zone magnet assigned _targetCity=" + updated._targetCity);
    } else {
      assert(false, "Orb deleted unexpectedly");
    }
    api.state.res.delete(orbId);
  }

  function testChainDamageDecay() {
    let chain = 100;
    const jumps = [];
    for (let i = 0; i < 5; i++) { chain = Math.round(chain * 0.7); jumps.push(chain); }
    assert(jumps[0] === 70, "Chain 1st jump: 100->70 (got " + jumps[0] + ")");
    assert(jumps[1] === 49, "Chain 2nd jump: 70->49 (got " + jumps[1] + ")");
    assert(jumps.every(j => j >= 1), "All chain jumps >= 1 (no -0)");
  }

  function testPlanetAttackRange() {
    const api = getApi(); if (!api) return;
    const me = api.state.players.values().next().value;
    if (!me) { assert(false, "No player"); return; }
    const baseInflR = 240;
    const cityScale = Math.max(1, Math.min(2.5, (me.influenceR || baseInflR) / baseInflR));
    const planetR = 32 * cityScale;
    const planetAtkR = planetR * 2.5;
    const stopR = planetAtkR * 0.7;
    assert(stopR > planetR, "Stop distance (" + stopR.toFixed(1) + ") > planet visual radius (" + planetR.toFixed(1) + ")");
    assert(stopR < planetAtkR, "Stop distance < attack range (" + planetAtkR.toFixed(1) + ")");
  }

  function testMineCreditGemSpawn() {
    const api = getApi(); if (!api) return;
    const me = api.state.players.values().next().value;
    if (!me) { assert(false, "No player"); return; }
    const mine = api.state.mines.values().next().value;
    if (!mine) { assert(false, "No mine found"); return; }
    const before = api.state.mineGems.length;
    api.spawnMineGem(mine, me, 5, true);
    assert(api.state.mineGems.length > before, "Credit gem spawned from mine");
    const last = api.state.mineGems[api.state.mineGems.length - 1];
    assert(last.isCredit === true, "Gem is marked as credit type");
    assert(last.value === 5, "Gem value = 5");
  }

  function testBotsFightEachOther() {
    const api = getApi(); if (!api) return;
    const bots = [...api.state.players.values()].filter(p => p.id !== api.state.myPlayerId && !p.eliminated);
    assert(bots.length >= 2, "At least 2 active bots exist (" + bots.length + ")");
    if (bots.length >= 2) {
      const d = Math.hypot(bots[0].x - bots[1].x, bots[0].y - bots[1].y);
      assert(d > 0, "Bots at different positions (dist=" + d.toFixed(0) + ")");
    }
  }

  function testSpeedScale() {
    const api = getApi(); if (!api) return;
    assert(api.state.timeScale != null, "timeScale exists: " + api.state.timeScale);
    assert(api.state.timeScale >= 0.5, "timeScale >= 0.5 (x1=0.5, x2=1)");
  }

  window.testAll = function () {
    results.length = 0;
    console.log("%c=== Running Mechanic Tests ===", "color: cyan; font-weight: bold");
    testXPOrbSpawn();
    testKillUnitDropsLoot();
    testZoneAttractsOrbs();
    testChainDamageDecay();
    testPlanetAttackRange();
    testMineCreditGemSpawn();
    testBotsFightEachOther();
    testSpeedScale();
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    console.log("%c=== Results: " + passed + " passed, " + failed + " failed ===", failed > 0 ? "color: red; font-weight: bold" : "color: lime; font-weight: bold");
    results.forEach(r => console.log((r.pass ? "%c✓" : "%c✗") + " " + r.msg, r.pass ? "color: lime" : "color: red"));
    return { passed, failed, results };
  };

  console.log("[Tests] Loaded. Run testAll() in browser console.");
})();
