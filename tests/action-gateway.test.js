const ActionGateway = require("../action-gateway.js");

function assert(ok, msg) {
  if (!ok) throw new Error("FAIL: " + msg);
}

function createSocket() {
  return {
    calls: [],
    emit(...args) {
      this.calls.push(args);
    }
  };
}

function testSendPlayerActionUsesSingleGateway() {
  const socket = createSocket();
  const state = { _multiSlots: [{}, {}], _multiIsHost: false, _roomId: "r_test" };
  const gateway = ActionGateway.install({ state, getSocket: () => socket });
  gateway.sendPlayerAction({ type: "move", leaderIds: [1] });
  assert(socket.calls.length === 1, "player action forwarded through gateway");
  assert(socket.calls[0][0] === "playerAction", "event name is playerAction");
  console.log("  [OK] testSendPlayerActionUsesSingleGateway");
}

function testHostOnlyEventsStayScoped() {
  const socket = createSocket();
  const state = { _multiSlots: [{}, {}], _multiIsHost: true, _roomId: "r_test" };
  const gateway = ActionGateway.install({ state, getSocket: () => socket });
  gateway.sendCardState({ pid: 1 });
  gateway.sendMapRegenerate({ seed: 42 });
  assert(socket.calls.length === 2, "host-only events use gateway");
  assert(socket.calls[0][0] === "cardState", "cardState routed");
  assert(socket.calls[1][0] === "mapRegenerate", "mapRegenerate routed");
  console.log("  [OK] testHostOnlyEventsStayScoped");
}

function testQueueJoinUsesExplicitMatchType() {
  const socket = createSocket();
  const state = {};
  const gateway = ActionGateway.install({ state, getSocket: () => socket });
  gateway.queueJoin("ffa4", "Alpha");
  assert(socket.calls.length === 1, "queue join sent once");
  assert(socket.calls[0][0] === "queueJoin", "queue join event name preserved");
  assert(socket.calls[0][1].matchType === "ffa4", "queue join keeps explicit match type");
  console.log("  [OK] testQueueJoinUsesExplicitMatchType");
}

function runAll() {
  console.log("action-gateway tests:");
  testSendPlayerActionUsesSingleGateway();
  testHostOnlyEventsStayScoped();
  testQueueJoinUsesExplicitMatchType();
  console.log("All action-gateway tests passed.");
}

runAll();
