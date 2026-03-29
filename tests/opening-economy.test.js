const balance = require("../shared/balance.json");

function assert(ok, msg) {
  if (!ok) throw new Error("FAIL: " + msg);
}

function testOpeningEconomyBaseline() {
  assert(balance.eCredits.startingAmount >= 200, "starting credits should allow an opener");
  assert(balance.mines.startingMinesPerPlayer >= 2, "players should start with owned mines");
  assert(balance.mines.yieldPerSecond > 0, "mines should generate credits");
  console.log("  [OK] testOpeningEconomyBaseline");
}

function testCoreRosterCurve() {
  const units = balance.unitTypes;
  assert(units.destroyer.cost < units.cruiser.cost, "destroyer should be cheaper than cruiser");
  assert(units.cruiser.cost < units.battleship.cost, "cruiser should be cheaper than battleship");
  assert(units.destroyer.speed > units.battleship.speed, "destroyer should be faster than battleship");
  console.log("  [OK] testCoreRosterCurve");
}

testOpeningEconomyBaseline();
testCoreRosterCurve();
console.log("All opening-economy tests passed.");
