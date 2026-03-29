const BotProfiles = require("../bot-profiles.js");

function assert(ok, msg) {
  if (!ok) throw new Error("FAIL: " + msg);
}

function testProfilesExist() {
  const profiles = BotProfiles.listProfiles();
  assert(profiles.length === 4, "expected four bot profiles");
  assert(profiles.map((p) => p.id).join(",") === "easy,normal,hard,superhard", "profile ids stay ordered");
  console.log("  [OK] testProfilesExist");
}

function testDifficultyCurvesTrendCorrectly() {
  const easy = BotProfiles.getProfile("easy");
  const normal = BotProfiles.getProfile("normal");
  const hard = BotProfiles.getProfile("hard");
  const superhard = BotProfiles.getProfile("superhard");
  assert(easy.thinkIntervalSec > normal.thinkIntervalSec, "easy thinks slower than normal");
  assert(normal.thinkIntervalSec > hard.thinkIntervalSec, "normal thinks slower than hard");
  assert(hard.thinkIntervalSec > superhard.thinkIntervalSec, "hard thinks slower than superhard");
  assert(easy.maxAbilityCastsPerTick < hard.maxAbilityCastsPerTick, "hard casts more abilities per tick");
  assert(hard.maxAbilityCastsPerTick < superhard.maxAbilityCastsPerTick, "superhard casts more abilities per tick");
  assert(easy.hiddenStartCreditsBonus < hard.hiddenStartCreditsBonus, "hard gets the larger hidden bonus");
  assert(hard.hiddenStartCreditsBonus < superhard.hiddenStartCreditsBonus, "superhard gets the largest hidden bonus");
  console.log("  [OK] testDifficultyCurvesTrendCorrectly");
}

function testProfilesAreCloned() {
  const profile = BotProfiles.getProfile("easy");
  profile.thinkIntervalSec = 999;
  const fresh = BotProfiles.getProfile("easy");
  assert(fresh.thinkIntervalSec !== 999, "profile reads must be cloned");
  console.log("  [OK] testProfilesAreCloned");
}

testProfilesExist();
testDifficultyCurvesTrendCorrectly();
testProfilesAreCloned();
console.log("All bot-difficulty tests passed.");
