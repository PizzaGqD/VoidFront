const CardSystem = require("../card-system.js");

function assert(ok, msg) {
  if (!ok) throw new Error("FAIL: " + msg);
}

function testCoreAbilityCatalog() {
  const ids = [
    "activeShield",
    "fleetBoost",
    "resourceSurge",
    "blackHole",
    "gravAnchor",
    "meteorSwarm",
    "thermoNuke"
  ];
  for (const id of ids) {
    const def = CardSystem.getAbilityDef(id);
    assert(!!def, "missing ability def for " + id);
    assert((def.cooldown || 0) > 0, "cooldown must be positive for " + id);
    assert(typeof def.desc === "string" && def.desc.length > 10, "ability description must be readable for " + id);
  }
  console.log("  [OK] testCoreAbilityCatalog");
}

function testAbilityCardsMirrorAbilities() {
  const def = CardSystem.getCardDef("A_blackHole");
  assert(!!def, "black hole ability card should exist");
  assert(def.abilityId === "blackHole", "ability card should point to blackHole");
  console.log("  [OK] testAbilityCardsMirrorAbilities");
}

testCoreAbilityCatalog();
testAbilityCardsMirrorAbilities();
console.log("All ability-power tests passed.");
