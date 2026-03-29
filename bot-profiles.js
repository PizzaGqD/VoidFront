(function () {
  "use strict";

  const PROFILES = {
    easy: {
      id: "easy",
      label: "Просто",
      thinkIntervalSec: 2.9,
      hiddenStartCreditsBonus: 0,
      decisionQuality: 0.58,
      misplayChance: 0.46,
      abilityCastChance: 0.44,
      maxAbilityCastsPerTick: 1,
      buffAutoPlayChance: 0.72,
      mergeRadius: 380,
      squadDangerTolerance: 0.98,
      buyBurstBonus: 0,
      saveMultiplierMul: 1.18,
      mineYieldBonusPct: 0,
      xpGainMultiplier: 1,
      archetypeWeights: {
        aggressor: 0.9,
        expander: 1.15,
        economist: 1.0,
        defensive: 1.25
      }
    },
    normal: {
      id: "normal",
      label: "Нормально",
      thinkIntervalSec: 1.55,
      hiddenStartCreditsBonus: 40,
      decisionQuality: 0.92,
      misplayChance: 0.16,
      abilityCastChance: 0.82,
      maxAbilityCastsPerTick: 2,
      buffAutoPlayChance: 1,
      mergeRadius: 500,
      squadDangerTolerance: 1.18,
      buyBurstBonus: 0,
      saveMultiplierMul: 1,
      mineYieldBonusPct: 6,
      xpGainMultiplier: 1.05,
      archetypeWeights: {
        aggressor: 1,
        expander: 1,
        economist: 1,
        defensive: 1
      }
    },
    hard: {
      id: "hard",
      label: "Сложно",
      thinkIntervalSec: 1.0,
      hiddenStartCreditsBonus: 140,
      decisionQuality: 1.08,
      misplayChance: 0.07,
      abilityCastChance: 1,
      maxAbilityCastsPerTick: 3,
      buffAutoPlayChance: 1,
      mergeRadius: 560,
      squadDangerTolerance: 1.34,
      buyBurstBonus: 1,
      saveMultiplierMul: 0.92,
      mineYieldBonusPct: 12,
      xpGainMultiplier: 1.1,
      archetypeWeights: {
        aggressor: 1.1,
        expander: 1,
        economist: 0.95,
        defensive: 0.95
      }
    },
    superhard: {
      id: "superhard",
      label: "Супержестко",
      thinkIntervalSec: 0.72,
      hiddenStartCreditsBonus: 260,
      decisionQuality: 1.22,
      misplayChance: 0.02,
      abilityCastChance: 1,
      maxAbilityCastsPerTick: 4,
      buffAutoPlayChance: 1,
      mergeRadius: 640,
      squadDangerTolerance: 1.48,
      buyBurstBonus: 2,
      saveMultiplierMul: 0.84,
      mineYieldBonusPct: 20,
      xpGainMultiplier: 1.18,
      archetypeWeights: {
        aggressor: 1.18,
        expander: 1.02,
        economist: 1.04,
        defensive: 0.92
      }
    }
  };

  const ORDERED_IDS = ["easy", "normal", "hard", "superhard"];

  function cloneProfile(profile) {
    return JSON.parse(JSON.stringify(profile));
  }

  function getProfile(id) {
    const key = typeof id === "string" ? id : "easy";
    return cloneProfile(PROFILES[key] || PROFILES.easy);
  }

  function listProfiles() {
    return ORDERED_IDS.map(getProfile);
  }

  const api = {
    ORDERED_IDS: ORDERED_IDS.slice(),
    getProfile,
    listProfiles
  };

  if (typeof window !== "undefined") window.BotProfiles = api;
  if (typeof module !== "undefined") module.exports = api;
})();
