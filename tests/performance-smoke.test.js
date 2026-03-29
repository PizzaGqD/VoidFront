const { createAuthoritativeMatchRuntime } = require("../authoritative-match-runtime.js");

function assert(ok, msg) {
  if (!ok) throw new Error("FAIL: " + msg);
}

function tick(runtime, frames) {
  for (let i = 0; i < frames; i++) runtime.tick();
}

function testAuthoritativeRuntimeSmoke() {
  const runtime = createAuthoritativeMatchRuntime({
    roomId: "perf-smoke",
    seed: 77,
    enableLaneFighterWaves: true,
    slots: [
      { id: "human_a", name: "Alpha", colorIndex: 0, spawnIndex: 0 },
      { id: "human_b", name: "Bravo", colorIndex: 1, spawnIndex: 1 },
      { id: null, name: "Bot1", colorIndex: 2, isBot: true, spawnIndex: 2 },
      { id: null, name: "Bot2", colorIndex: 3, isBot: true, spawnIndex: 3 }
    ]
  });
  const start = Date.now();
  tick(runtime, 180);
  const elapsedMs = Date.now() - start;
  assert(runtime.state.players.size === 4, "runtime should keep four players alive in smoke test");
  assert(elapsedMs < 15000, "smoke test should complete in a reasonable time");
  console.log("  [OK] testAuthoritativeRuntimeSmoke");
}

testAuthoritativeRuntimeSmoke();
console.log("All performance-smoke tests passed.");
