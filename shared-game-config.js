function createSharedGameConfig() {
  const CFG = {
    WORLD_W: 5000,
    WORLD_H: 3000,
    POP_START: 150,
    ECREDITS_START: 200,
    GROWTH_BASE_PER_MIN: 2,
    GROWTH_PER_100: 1.5,
    ACTIVE_SOLDIER_PENALTY_PER: 0.005,
    ACTIVE_SOLDIER_PENALTY_CAP: 0.5,
    INFLUENCE_BASE_R: 240,
    INFLUENCE_POP_FACTOR: 1.1,
    INFLUENCE_GROWTH_SPEED: 6.0,
    CITY_ATTACK_RADIUS: 200,
    TERRAIN_RAYS: 96,
    TERRAIN_STEP: 2,
    TERRAIN_TYPES: {
      deepWater: { speedMultiplier: 0.3, influenceCost: 3 },
      shallowWater: { speedMultiplier: 0.6, influenceCost: 2 },
      lowland: { speedMultiplier: 1.35, influenceCost: 0.75 },
      hill: { speedMultiplier: 0.9, influenceCost: 1.2 },
      mountain: { speedMultiplier: 0.7, influenceCost: 1.55 }
    },
    WATER_RATIO_THRESHOLD: 0.4,
    WATER_GROWTH_BONUS: 0.5,
    WATER_PENALTY_REDUCTION: 0.15,
    XP_BASE: 160,
    XP_PER_LEVEL: 16,
    XP_LEVEL_MUL: 1.05,
    LAND_THRESHOLD: 0.08,
    FALLOFF_STRENGTH: 1.15,
    FALLOFF_AMOUNT: 0.65,
    FOG_ENABLED: true,
    ZONES_ENABLED: true
  };
  CFG.INFLUENCE_R = function (pop) {
    return CFG.INFLUENCE_BASE_R + CFG.INFLUENCE_POP_FACTOR * pop;
  };
  return CFG;
}

module.exports = {
  createSharedGameConfig
};
