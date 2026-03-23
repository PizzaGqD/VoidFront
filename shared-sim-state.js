(function () {
  "use strict";

  function applyBaseState(state, CFG) {
    Object.assign(state, {
      t: 0,
      players: new Map(),
      units: new Map(),
      res: new Map(),
      turrets: new Map(),
      mines: new Map(),
      pirateBases: [],
      mineGems: [],
      mineFlowPackets: [],
      nebulae: [],
      nextTurretId: 1,
      ghosts: [],
      bullets: [],
      nextUnitId: 1,
      nextResId: 1,
      nextMineFlowPacketId: 1,
      fogEnabled: CFG.FOG_ENABLED,
      zonesEnabled: CFG.ZONES_ENABLED,
      targetPoints: [],
      rallyPoint: null,
      rallyPointMode: false,
      _frontControlEnabled: true,
      formationPreview: null,
      orderPreview: null,
      floatingDamage: [],
      selectedUnitIds: new Set(),
      prevInCombatIds: new Set(),
      boxStart: null,
      boxEnd: null,
      squads: new Map(),
      engagementZones: new Map(),
      nextSquadId: 1,
      nextEngagementZoneId: 1,
      coreFrontPolicies: {},
      frontGraph: {},
      squadFrontAssignments: {},
      centerObjectives: {
        centerX: 0,
        centerY: 0,
        richMineId: null,
        centerMineIds: [],
        pirateBaseIds: [],
        livePirateBaseIds: [],
        securedByPlayerId: null,
        requiredMineCount: 0
      },
      smoothedFronts: {},
      squadBinds: {},
      persistentBattles: {},
      perfLog: [],
      perfStats: null,
      timeScale: 1,
      _shipBuildQueues: new Map()
    });
    return state;
  }

  const api = { applyBaseState };
  if (typeof window !== "undefined") window.SharedSimState = api;
  if (typeof module !== "undefined") module.exports = api;
})();
