const SingleProfile = require("../single-profile.js");
const CoreMatchState = require("../core-match-state.js");

function assert(ok, msg) {
  if (!ok) throw new Error("FAIL: " + msg);
}

function testCoreMatchStateLifecycle() {
  const state = { t: 0 };
  const api = CoreMatchState.install({ state });
  api.beginMatch({ mode: "duel", difficulty: "easy", botCount: 1, playerId: 1 });
  const current = api.getCurrentMatch();
  assert(current.mode === "duel", "current match mode should be duel");
  const finished = api.finishMatch("victory", { durationSec: 321 });
  assert(finished.outcome === "victory", "match outcome should be stored");
  assert(finished.durationSec === 321, "explicit duration should be preserved");
  console.log("  [OK] testCoreMatchStateLifecycle");
}

function testProfileUnlocksProgression() {
  const storage = {
    _data: new Map(),
    getItem(key) { return this._data.has(key) ? this._data.get(key) : null; },
    setItem(key, value) { this._data.set(key, String(value)); },
    removeItem(key) { this._data.delete(key); }
  };
  const api = SingleProfile.createProfileService({ storage, storageKey: "test.profile" });
  api.ensureProfile();
  let result = api.recordMatch({ outcome: "victory", mode: "duel", difficulty: "easy", durationSec: 120 });
  assert(result.profile.unlockedDifficulties.normal === true, "normal should unlock after first victory");
  api.recordMatch({ outcome: "victory", mode: "duel", difficulty: "normal", durationSec: 140 });
  result = api.recordMatch({ outcome: "victory", mode: "quad", difficulty: "normal", durationSec: 180 });
  assert(result.profile.unlockedDifficulties.hard === true, "hard should unlock after three wins");
  api.recordMatch({ outcome: "victory", mode: "duel", difficulty: "hard", durationSec: 150 });
  api.recordMatch({ outcome: "victory", mode: "duel", difficulty: "hard", durationSec: 150 });
  result = api.recordMatch({ outcome: "victory", mode: "quad", difficulty: "hard", durationSec: 190 });
  assert(result.profile.unlockedDifficulties.superhard === true, "superhard should unlock after six wins");
  console.log("  [OK] testProfileUnlocksProgression");
}

testCoreMatchStateLifecycle();
testProfileUnlocksProgression();
console.log("All single-match-flow tests passed.");
