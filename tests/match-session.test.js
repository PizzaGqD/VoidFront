const MatchSession = require("../match-session.js");

function assert(ok, msg) {
  if (!ok) throw new Error("FAIL: " + msg);
}

function createSession() {
  const state = {};
  const api = MatchSession.install({ state });
  api.beginMatch({ roomId: "room-test", matchId: "match-test", matchType: "duel", slots: [{ id: 1 }, { id: 2 }] });
  return { state, api };
}

function testFullSyncReplacesQueuedDeltas() {
  const { api } = createSession();
  api.setPendingSnapshot({ _seq: 1, _arrivalAt: 0, units: [] });
  api.setPendingSnapshot({ _seq: 2, _arrivalAt: 10, units: [] });
  api.setPendingSnapshot({ _seq: 10, _arrivalAt: 20, _fullSync: true, units: [{ id: 7 }] });
  const statsBefore = api.getNetDebugStats();
  assert(statsBefore.queueLength === 1, "full sync replaces older queued deltas");
  const snap = api.consumePendingSnapshot({ now: 100, cadenceMs: 33 });
  assert(snap && snap._seq === 10, "full sync is consumed immediately");
  const statsAfter = api.getNetDebugStats();
  assert(statsAfter.applied === 1, "apply counter increments");
  console.log("  [OK] testFullSyncReplacesQueuedDeltas");
}

function testDeltaCadenceWaitsBeforeApplyingNextPacket() {
  const { api } = createSession();
  api.setPendingSnapshot({ _seq: 1, _arrivalAt: 0, units: [] });
  const first = api.consumePendingSnapshot({ now: 0, cadenceMs: 33 });
  assert(first && first._seq === 1, "first packet applies immediately");
  api.setPendingSnapshot({ _seq: 2, _arrivalAt: 5, units: [] });
  const tooEarly = api.consumePendingSnapshot({ now: 10, cadenceMs: 33 });
  assert(tooEarly == null, "second delta waits for cadence window");
  const onTime = api.consumePendingSnapshot({ now: 40, cadenceMs: 33 });
  assert(onTime && onTime._seq === 2, "second delta applies after cadence window");
  console.log("  [OK] testDeltaCadenceWaitsBeforeApplyingNextPacket");
}

function testSnapshotQueueTracksDropsAndSeqGaps() {
  const { api } = createSession();
  for (let i = 1; i <= 10; i++) {
    api.setPendingSnapshot({ _seq: i * 2, _arrivalAt: i * 5, units: [] });
  }
  const stats = api.getNetDebugStats();
  assert(stats.queueLength === 8, "snapshot queue is capped");
  assert(stats.dropped === 2, "overflow drops oldest deltas");
  assert(stats.seqGap === 9, "sequence gaps are accumulated");
  console.log("  [OK] testSnapshotQueueTracksDropsAndSeqGaps");
}

function testBufferLeadDelaysFreshSingleDelta() {
  const { api } = createSession();
  api.setPendingSnapshot({ _seq: 1, _arrivalAt: 0, units: [] });
  const tooFresh = api.consumePendingSnapshot({ now: 10, cadenceMs: 33, bufferLeadMs: 25, maxHoldMs: 60 });
  assert(tooFresh == null, "fresh single delta is held for buffer lead");
  const ready = api.consumePendingSnapshot({ now: 26, cadenceMs: 33, bufferLeadMs: 25, maxHoldMs: 60 });
  assert(ready && ready._seq === 1, "single delta applies once buffer lead is satisfied");
  console.log("  [OK] testBufferLeadDelaysFreshSingleDelta");
}

function runAll() {
  console.log("match-session tests:");
  testFullSyncReplacesQueuedDeltas();
  testDeltaCadenceWaitsBeforeApplyingNextPacket();
  testSnapshotQueueTracksDropsAndSeqGaps();
  testBufferLeadDelaysFreshSingleDelta();
  console.log("All match-session tests passed.");
}

runAll();
