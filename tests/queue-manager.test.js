const { createQueueManager } = require("../queue-manager.js");

function assert(ok, msg) {
  if (!ok) throw new Error("FAIL: " + msg);
}

function testDuelNeedsTwoHumansOrBotTimeout() {
  const queueManager = createQueueManager({ timeoutMs: 1000 });
  queueManager.join("duel", {
    socketId: "socket-a",
    sessionId: "session-a",
    nickname: "A",
    joinedAt: 0
  });
  const initial = queueManager.takeReadyGroup("duel", 500);
  assert(initial == null, "duel does not start before timeout with one human");
  const delayed = queueManager.takeReadyGroup("duel", 1000);
  assert(Array.isArray(delayed) && delayed.length === 1, "duel becomes ready for bot fill after timeout");
  console.log("  [OK] testDuelNeedsTwoHumansOrBotTimeout");
}

function testDuelStartsImmediatelyWithTwoHumans() {
  const queueManager = createQueueManager({ timeoutMs: 1000 });
  queueManager.join("duel", {
    socketId: "socket-a",
    sessionId: "session-a",
    nickname: "A",
    joinedAt: 0
  });
  queueManager.join("duel", {
    socketId: "socket-b",
    sessionId: "session-b",
    nickname: "B",
    joinedAt: 10
  });
  const group = queueManager.takeReadyGroup("duel", 10);
  assert(Array.isArray(group) && group.length === 2, "duel starts immediately with two humans");
  console.log("  [OK] testDuelStartsImmediatelyWithTwoHumans");
}

function testFfa4StatusUsesExplicitRequiredPlayers() {
  const queueManager = createQueueManager({ timeoutMs: 1000 });
  queueManager.join("ffa4", {
    socketId: "socket-a",
    sessionId: "session-a",
    nickname: "A",
    joinedAt: 0
  });
  const status = queueManager.getStatus("ffa4", 100);
  assert(status.requiredPlayers === 4, "ffa4 requires four players");
  assert(status.playersInQueue === 1, "ffa4 reports current queue length");
  console.log("  [OK] testFfa4StatusUsesExplicitRequiredPlayers");
}

function runAll() {
  console.log("queue-manager tests:");
  testDuelNeedsTwoHumansOrBotTimeout();
  testDuelStartsImmediatelyWithTwoHumans();
  testFfa4StatusUsesExplicitRequiredPlayers();
  console.log("All queue-manager tests passed.");
}

runAll();
