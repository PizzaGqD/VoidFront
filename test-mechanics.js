/**
 * Squad Combat + Formation Tests — v1.4a
 * Tests the rewritten squad-logic / combat / formations pipeline.
 * Run from browser console: testAll()
 */
(function () {
  const results = [];

  function assert(cond, msg) {
    results.push({ pass: !!cond, msg });
    if (!cond) console.error("FAIL:", msg);
  }

  function getApi() {
    const api = window._gameTest;
    if (!api) { assert(false, "_gameTest API not exposed"); return null; }
    if (!api.squadLogic) { assert(false, "SQUADLOGIC API not exposed"); return null; }
    return api;
  }

  function makeHarness() {
    const api = getApi();
    if (!api) return null;
    const state = api.makeLogicTestState();
    state.players.set(1, { id: 1, x: 0, y: 0, color: 0x4488ff });
    state.players.set(2, { id: 2, x: 800, y: 0, color: 0xff4444 });
    state.players.set(3, { id: 3, x: 800, y: 120, color: 0xffaa44 });
    return { api, state, logic: api.squadLogic };
  }

  const helpers = {
    getUnitAtkRange: (u) => u.attackRange || 60,
    getPlanetRadius: () => 32,
    shieldRadius: () => 0,
    getUnitHitRadius: () => 10,
    getUnitEngagementRange: (u) => (u.attackRange || 60) * 0.95
  };

  function createSquad(h, unitSpecs, opts) {
    const ids = [];
    for (const spec of unitSpecs) {
      const unit = h.api.addLogicTestUnit(h.state, spec);
      ids.push(unit.id);
    }
    const squad = h.logic.createSquad(h.state, ids, opts || {});
    h.logic.recalculateFormation(h.state, squad.id, { getFormationOffsets: h.api.getFormationOffsets }, true);
    return squad;
  }

  function step(h, seconds, times) {
    const n = times || 1;
    for (let i = 0; i < n; i++) h.api.stepLogicTestState(h.state, seconds / n);
  }

  // ─── ENGAGEMENT TESTS ──────────────────────────────────────────

  function testEngagedSquadEntersZone() {
    const h = makeHarness(); if (!h) return;
    const a = createSquad(h, [{ id: 1, owner: 1, x: 100, y: 100, unitType: "fighter", attackRange: 60 }], { order: { type: "idle", waypoints: [] } });
    const b = createSquad(h, [{ id: 2, owner: 2, x: 150, y: 100, unitType: "fighter", attackRange: 60 }], { order: { type: "idle", waypoints: [] } });
    step(h, 0.1, 1);
    assert(a.combat.zoneId != null, "Engagement: allied squad got zoneId");
    assert(a.combat.zoneId === b.combat.zoneId, "Engagement: opposing squads share the same zone");
  }

  function testEngagementByRadius() {
    const h = makeHarness(); if (!h) return;
    const a = createSquad(h, [{ id: 3, owner: 1, x: 100, y: 100, unitType: "destroyer", attackRange: 120 }], { order: { type: "idle", waypoints: [] } });
    const b = createSquad(h, [{ id: 4, owner: 2, x: 208, y: 100, unitType: "destroyer", attackRange: 120 }], { order: { type: "idle", waypoints: [] } });
    step(h, 0.1, 1);
    assert(a.combat.zoneId != null && b.combat.zoneId === a.combat.zoneId, "Engagement by radius: enemy within range triggers combat");
  }

  function testMultiSquadZone() {
    const h = makeHarness(); if (!h) return;
    const a = createSquad(h, [{ id: 5, owner: 1, x: 100, y: 100, unitType: "destroyer", attackRange: 120 }], { order: { type: "idle", waypoints: [] } });
    const b = createSquad(h, [{ id: 6, owner: 2, x: 180, y: 100, unitType: "destroyer", attackRange: 120 }], { order: { type: "idle", waypoints: [] } });
    const c = createSquad(h, [{ id: 7, owner: 2, x: 210, y: 130, unitType: "destroyer", attackRange: 120 }], { order: { type: "idle", waypoints: [] } });
    step(h, 0.1, 1);
    assert(a.combat.zoneId != null && a.combat.zoneId === b.combat.zoneId && b.combat.zoneId === c.combat.zoneId, "Multi-squad zone: all squads share one zone");
  }

  function testNoReaggroJitter() {
    const h = makeHarness(); if (!h) return;
    const a = createSquad(h, [{ id: 8, owner: 1, x: 100, y: 100, unitType: "destroyer", attackRange: 120 }], { order: { type: "idle", waypoints: [] } });
    const b = createSquad(h, [{ id: 9, owner: 2, x: 170, y: 100, unitType: "destroyer", attackRange: 120 }], { order: { type: "idle", waypoints: [] } });
    step(h, 0.1, 1);
    const zoneId = a.combat.zoneId;
    step(h, 0.1, 5);
    assert(a.combat.zoneId === zoneId, "No re-aggro jitter: zone persists across ticks");
    assert(a.combat.mode !== "idle", "No re-aggro jitter: squad stays in combat");
  }

  // ─── FREE CHASE TESTS ─────────────────────────────────────────

  function testFreeChaseInEngaged() {
    const h = makeHarness(); if (!h) return;
    createSquad(h, [{ id: 10, owner: 1, x: 100, y: 100, unitType: "fighter", attackRange: 60 }], { order: { type: "idle", waypoints: [] } });
    const enemy = createSquad(h, [{ id: 11, owner: 2, x: 140, y: 100, unitType: "fighter", attackRange: 60 }], { order: { type: "idle", waypoints: [] } });
    step(h, 0.1, 1);
    const u = h.state.units.get(10);
    const mv = h.logic.getUnitMovementTarget(u, h.state, helpers);
    assert(mv.moveMode === "free_chase", "Free chase: engaged unit uses free_chase mode (got: " + mv.moveMode + ")");
    const eu = h.state.units.get(11);
    const dist = Math.hypot(mv.tx - eu.x, mv.ty - eu.y);
    assert(dist < 5, "Free chase: target is enemy position (dist=" + Math.round(dist) + ")");
  }

  function testFreeChaseNoFormation() {
    const h = makeHarness(); if (!h) return;
    createSquad(h, [
      { id: 12, owner: 1, x: 100, y: 100, unitType: "destroyer", attackRange: 120 },
      { id: 13, owner: 1, x: 120, y: 100, unitType: "fighter", attackRange: 60 }
    ], { formationType: "line", formationRows: 3, order: { type: "idle", waypoints: [] } });
    createSquad(h, [{ id: 14, owner: 2, x: 200, y: 100, unitType: "destroyer", attackRange: 120 }], { order: { type: "idle", waypoints: [] } });
    step(h, 0.1, 1);
    const fighter = h.state.units.get(13);
    const mv = h.logic.getUnitMovementTarget(fighter, h.state, helpers);
    assert(mv.moveMode === "free_chase", "Free chase: follower also uses free_chase in engaged mode");
  }

  // ─── NO SNAP TESTS ────────────────────────────────────────────

  function testNoFormationTeleport() {
    const h = makeHarness(); if (!h) return;
    createSquad(h, [
      { id: 15, owner: 1, x: 100, y: 100, unitType: "destroyer", attackRange: 120, speed: 24 },
      { id: 16, owner: 1, x: 120, y: 100, unitType: "destroyer", attackRange: 120, speed: 24 },
      { id: 17, owner: 1, x: 140, y: 100, unitType: "destroyer", attackRange: 120, speed: 24 }
    ], { formationType: "line", formationRows: 3, order: { type: "move", waypoints: [{ x: 400, y: 100 }] } });
    step(h, 0.1, 1);
    const units = h.logic.getSquadUnits(h.state, h.state.squads.values().next().value);
    let maxDelta = 0;
    for (const u of units) {
      const mv = h.logic.getUnitMovementTarget(u, h.state, helpers);
      maxDelta = Math.max(maxDelta, Math.hypot(mv.tx - u.x, mv.ty - u.y));
    }
    assert(maxDelta < 200, "No teleport: movement target within sane distance (" + Math.round(maxDelta) + "px)");
  }

  function testNoJitterOnMovement() {
    const h = makeHarness(); if (!h) return;
    createSquad(h, [
      { id: 18, owner: 1, x: 100, y: 100, unitType: "destroyer", attackRange: 120, speed: 24 },
      { id: 19, owner: 1, x: 86, y: 100, unitType: "destroyer", attackRange: 120, speed: 24 }
    ], { formationType: "line", formationRows: 3, order: { type: "move", waypoints: [{ x: 500, y: 100 }] } });
    step(h, 0.05, 1);
    const follower = h.state.units.get(19);
    const a = h.logic.getUnitMovementTarget(follower, h.state, helpers);
    const b = h.logic.getUnitMovementTarget(follower, h.state, helpers);
    assert(Math.abs(a.tx - b.tx) < 0.001 && Math.abs(a.ty - b.ty) < 0.001, "No jitter: same state gives identical targets");
  }

  // ─── ORDER BUFFER TESTS ───────────────────────────────────────

  function testOrderBufferInCombat() {
    const h = makeHarness(); if (!h) return;
    const a = createSquad(h, [{ id: 20, owner: 1, x: 100, y: 100, unitType: "fighter", attackRange: 60 }], { order: { type: "idle", waypoints: [] } });
    createSquad(h, [{ id: 21, owner: 2, x: 150, y: 100, unitType: "fighter", attackRange: 60 }], { order: { type: "idle", waypoints: [] } });
    step(h, 0.1, 1);
    assert(a.combat.mode !== "idle", "Order buffer: squad is in combat");
    h.logic.issueMoveOrder(h.state, a.id, [{ x: 300, y: 100 }], 0);
    assert(a.combat.queuedOrder && a.combat.queuedOrder.type === "move", "Order buffer: order queued, not applied");
  }

  function testQueuedOrderAppliedAfterCombat() {
    const h = makeHarness(); if (!h) return;
    const a = createSquad(h, [{ id: 22, owner: 1, x: 100, y: 100, unitType: "fighter", attackRange: 60 }], { order: { type: "idle", waypoints: [] } });
    createSquad(h, [{ id: 23, owner: 2, x: 150, y: 100, unitType: "fighter", attackRange: 60 }], { order: { type: "idle", waypoints: [] } });
    step(h, 0.1, 1);
    h.logic.issueMoveOrder(h.state, a.id, [{ x: 300, y: 100 }], 0);
    h.state.units.get(23).hp = 0;
    step(h, 2.0, 10);
    assert(a.combat.mode === "idle", "Queued order: squad returns to idle after enemy dies");
    assert(a.order.type === "move" && a.order.waypoints[0]?.x === 300, "Queued order: queued move applied after combat");
  }

  function testSiegeResumeAfterCombat() {
    const h = makeHarness(); if (!h) return;
    h.state.players.set(3, { id: 3, x: 500, y: 100, pop: 100, eliminated: false });
    const a = createSquad(h, [{ id: 24, owner: 1, x: 100, y: 100, unitType: "fighter", attackRange: 60 }], {});
    h.logic.issueSiegeOrder(h.state, a.id, 3, [{ x: 500, y: 100 }]);
    step(h, 0.1, 1);
    createSquad(h, [{ id: 25, owner: 2, x: 140, y: 100, unitType: "fighter", attackRange: 60 }], { order: { type: "idle", waypoints: [] } });
    step(h, 0.1, 1);
    assert(a.combat.mode !== "idle", "Siege resume: squad enters combat");
    assert(a.combat.resumeOrder && a.combat.resumeOrder.type === "siege", "Siege resume: siege order saved as resumeOrder");
    h.state.units.get(25).hp = 0;
    step(h, 2.0, 10);
    assert(a.order.type === "siege", "Siege resume: siege order resumed after combat");
  }

  // ─── STABLE SLOTS TESTS ───────────────────────────────────────

  function testStableSlotAssignment() {
    const h = makeHarness(); if (!h) return;
    const squad = createSquad(h, [
      { id: 26, owner: 1, x: 100, y: 100, unitType: "destroyer", attackRange: 120 },
      { id: 27, owner: 1, x: 120, y: 100, unitType: "destroyer", attackRange: 120 },
      { id: 28, owner: 1, x: 140, y: 100, unitType: "fighter", attackRange: 60 }
    ], { formationType: "line", formationRows: 3, order: { type: "move", waypoints: [{ x: 400, y: 100 }] } });
    step(h, 0.1, 1);
    const before = squad.formation.slotAssignments.slice();
    step(h, 0.1, 3);
    const after = squad.formation.slotAssignments.slice();
    let changed = false;
    for (let i = 0; i < before.length; i++) { if (before[i] !== after[i]) { changed = true; break; } }
    assert(!changed, "Stable slots: assignment unchanged without deaths");
  }

  function testHitboxSpacing() {
    const h = makeHarness(); if (!h) return;
    createSquad(h, [
      { id: 29, owner: 1, x: 100, y: 100, unitType: "destroyer", attackRange: 120 },
      { id: 30, owner: 1, x: 100, y: 100, unitType: "destroyer", attackRange: 120 },
      { id: 31, owner: 1, x: 100, y: 100, unitType: "fighter", attackRange: 60 }
    ], { formationType: "line", formationRows: 3, order: { type: "move", waypoints: [{ x: 400, y: 100 }] } });
    step(h, 0.1, 1);
    const sq = h.state.squads.values().next().value;
    const units = h.logic.getSquadUnits(h.state, sq);
    const targets = units.map((u) => h.logic.getUnitMovementTarget(u, h.state, helpers));
    let minDist = Infinity;
    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        minDist = Math.min(minDist, Math.hypot(targets[i].tx - targets[j].tx, targets[i].ty - targets[j].ty));
      }
    }
    assert(minDist > 10, "Hitbox spacing: slots have separation (" + Math.round(minDist) + "px > 10px)");
  }

  // ─── SPAWN GROUPING TESTS ────────────────────────────────────

  function testAutoGroupSpawns() {
    const h = makeHarness(); if (!h) return;
    createSquad(h, [{ id: 32, owner: 1, x: 0, y: 0, unitType: "fighter", attackRange: 60 }], {
      sourceTag: "spawn", autoGroupUntil: 3, allowAutoJoinRecentSpawn: true,
      order: { type: "move", waypoints: [{ x: 100, y: 0 }] }
    });
    h.state.t = 1.5;
    createSquad(h, [{ id: 33, owner: 1, x: 0, y: 0, unitType: "destroyer", attackRange: 120 }], {
      sourceTag: "spawn", autoGroupUntil: h.state.t + 3, allowAutoJoinRecentSpawn: true,
      order: { type: "move", waypoints: [{ x: 100, y: 0 }] }
    });
    const ids = new Set([h.state.units.get(32).squadId, h.state.units.get(33).squadId]);
    assert(ids.size === 1, "Auto group: spawns merge into one squad");
  }

  function testSplitByType() {
    const h = makeHarness(); if (!h) return;
    const mixed = createSquad(h, [
      { id: 34, owner: 1, x: 100, y: 100, unitType: "fighter", attackRange: 60 },
      { id: 35, owner: 1, x: 110, y: 100, unitType: "destroyer", attackRange: 120 },
      { id: 36, owner: 1, x: 120, y: 100, unitType: "fighter", attackRange: 60 }
    ], { formationType: "line", formationRows: 3, order: { type: "move", waypoints: [] } });
    const result = h.logic.splitSquadByType(h.state, mixed.id);
    assert(result.length === 2, "Split by type: produces 2 squads");
    assert(result.every((sq) => {
      const units = h.logic.getSquadUnits(h.state, sq);
      return units.every((u) => u.unitType === units[0].unitType);
    }), "Split by type: each squad is homogeneous");
  }

  // ─── POST-COMBAT TESTS ───────────────────────────────────────

  function testNoDriftAfterCombat() {
    const h = makeHarness(); if (!h) return;
    const a = createSquad(h, [
      { id: 37, owner: 1, x: 100, y: 100, unitType: "fighter", attackRange: 60, speed: 30 },
      { id: 38, owner: 1, x: 112, y: 100, unitType: "fighter", attackRange: 60, speed: 30 }
    ], { formationType: "line", formationRows: 3, order: { type: "idle", waypoints: [] } });
    createSquad(h, [{ id: 39, owner: 2, x: 150, y: 100, unitType: "fighter", attackRange: 60 }], { order: { type: "idle", waypoints: [] } });
    step(h, 0.1, 1);
    h.state.units.get(39).hp = 0;
    step(h, 2.0, 10);
    assert(a.combat.mode === "idle", "No drift: squad reaches idle");
    const center = h.logic.getSquadCenter(h.state, a);
    step(h, 1.0, 4);
    const after = h.logic.getSquadCenter(h.state, a);
    const drift = Math.hypot(after.x - center.x, after.y - center.y);
    assert(drift < 5, "No drift: squad stable after combat (drift=" + Math.round(drift) + "px)");
  }

  function testPostCombatHoldPoint() {
    const h = makeHarness(); if (!h) return;
    const a = createSquad(h, [{ id: 40, owner: 1, x: 100, y: 100, unitType: "fighter", attackRange: 60 }], { order: { type: "idle", waypoints: [] } });
    createSquad(h, [{ id: 41, owner: 2, x: 150, y: 100, unitType: "fighter", attackRange: 60 }], { order: { type: "idle", waypoints: [] } });
    step(h, 0.1, 1);
    h.state.units.get(41).hp = 0;
    step(h, 2.0, 10);
    assert(a.combat.mode === "idle", "Post-combat hold: squad is idle");
    assert(a.order.holdPoint != null, "Post-combat hold: squad retains hold point");
  }

  // ─── FIRE PLAN TESTS ─────────────────────────────────────────

  function testFirePlanInCombat() {
    const h = makeHarness(); if (!h) return;
    createSquad(h, [{ id: 42, owner: 1, x: 100, y: 100, unitType: "destroyer", attackRange: 120 }], { order: { type: "idle", waypoints: [] } });
    createSquad(h, [{ id: 43, owner: 2, x: 175, y: 100, unitType: "destroyer", attackRange: 120 }], { order: { type: "idle", waypoints: [] } });
    step(h, 0.1, 2);
    const plan = h.logic.getUnitFirePlan(h.state.units.get(42), h.state, helpers);
    assert(plan.type === "units" && plan.targets.length > 0, "Fire plan: engaged units produce fire plan");
  }

  function testLocalTargetInRange() {
    const h = makeHarness(); if (!h) return;
    createSquad(h, [{ id: 44, owner: 1, x: 100, y: 100, unitType: "fighter", attackRange: 60 }], { order: { type: "attackUnit", targetUnitId: 45, waypoints: [] } });
    createSquad(h, [
      { id: 45, owner: 2, x: 140, y: 100, unitType: "fighter", attackRange: 60 },
      { id: 46, owner: 2, x: 220, y: 100, unitType: "fighter", attackRange: 60 }
    ], { order: { type: "idle", waypoints: [] } });
    step(h, 0.1, 1);
    const plan = h.logic.getUnitFirePlan(h.state.units.get(44), h.state, helpers);
    assert(plan.type === "units" && plan.targets.length === 1 && plan.targets[0].id === 45, "Local target: picks closest in-range enemy");
  }

  // ─── FORMATION COOLDOWN TEST ──────────────────────────────────

  function testFormationRecalcCooldown() {
    const h = makeHarness(); if (!h) return;
    const squad = createSquad(h, [
      { id: 47, owner: 1, x: 100, y: 100, unitType: "fighter", attackRange: 60 },
      { id: 48, owner: 1, x: 110, y: 100, unitType: "fighter", attackRange: 60 }
    ], { formationType: "line", formationRows: 3, order: { type: "idle", waypoints: [] } });
    h.logic.requestFormationRecalc(h.state, squad.id, false);
    const tooSoon = h.logic.recalculateFormation(h.state, squad.id, { getFormationOffsets: h.api.getFormationOffsets }, false);
    h.state.t += 2.1;
    h.logic.requestFormationRecalc(h.state, squad.id, false);
    const ok = h.logic.recalculateFormation(h.state, squad.id, { getFormationOffsets: h.api.getFormationOffsets }, false);
    assert(tooSoon === false, "Recalc cooldown: throttled within cooldown period");
    assert(ok === true, "Recalc cooldown: allowed after cooldown");
  }

  // ─── RUN ALL ──────────────────────────────────────────────────

  window.testAll = function () {
    results.length = 0;
    console.log("%c=== Running Squad Combat Tests (v1.4a) ===", "color: cyan; font-weight: bold");

    testEngagedSquadEntersZone();
    testEngagementByRadius();
    testMultiSquadZone();
    testNoReaggroJitter();
    testFreeChaseInEngaged();
    testFreeChaseNoFormation();
    testNoFormationTeleport();
    testNoJitterOnMovement();
    testOrderBufferInCombat();
    testQueuedOrderAppliedAfterCombat();
    testSiegeResumeAfterCombat();
    testStableSlotAssignment();
    testHitboxSpacing();
    testAutoGroupSpawns();
    testSplitByType();
    testNoDriftAfterCombat();
    testPostCombatHoldPoint();
    testFirePlanInCombat();
    testLocalTargetInRange();
    testFormationRecalcCooldown();

    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass).length;
    console.log("%c=== Results: " + passed + " passed, " + failed + " failed ===",
      failed > 0 ? "color: red; font-weight: bold" : "color: lime; font-weight: bold");
    results.forEach((r) => console.log((r.pass ? "%c\u2713" : "%c\u2717") + " " + r.msg, r.pass ? "color: lime" : "color: red"));
    return { passed, failed, results };
  };

  console.log("[Tests v1.4a] Loaded. Run testAll() in browser console.");
})();
