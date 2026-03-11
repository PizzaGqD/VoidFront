(function () {
  "use strict";

  function install(deps) {
    const {
      state,
      perfStartStep,
      perfEndStep,
      stepCities,
      rebuildZoneGrid,
      botThink,
      requireSquadLogic,
      queryHash,
      getUnitAtkRange,
      getUnitEngagementRange,
      getUnitBaseSpeed,
      shieldRadius,
      getPlanetRadius,
      getUnitHitRadius,
      getFormationOffsets,
      stepUnits,
      stepCombat,
      getSquadLogicGlobal,
      mergeBattleSurvivorsIntoOneSquad,
      applyFormationToSquad,
      stepTurrets,
      stepPatrols,
      stepBullets,
      stepMines,
      stepMineGems,
      stepResourceMagnet,
      stepPickups,
      stepNebulae,
      stepStorm,
      stepAbilityStorms,
      stepBlackHoles,
      stepRandomEvents,
      stepAbilityZoneEffects,
      stepAbilityCooldowns,
      stepLoanDebts,
      stepMeteors,
      stepBgComets,
      stepSurvivalWaves
    } = deps;

    function step(dt) {
      perfStartStep("stepCities");
      stepCities(dt);
      perfEndStep("stepCities");
      if (state._frameCtr % 4 === 0) rebuildZoneGrid();

      perfStartStep("botThink");
      if (state._frameCtr % 2 === 0) botThink(dt);
      perfEndStep("botThink");

      const squadLogic = requireSquadLogic("authoritative combat pipeline");
      const combatPipelineHelpers = {
        queryHash,
        getUnitAtkRange,
        getUnitEngagementRange,
        getUnitBaseSpeed,
        shieldRadius,
        getPlanetRadius,
        getUnitHitRadius,
        getFormationOffsets
      };

      perfStartStep("syncSquads");
      squadLogic.syncSquadsFromState(state);
      perfEndStep("syncSquads");
      perfStartStep("buildEngagementZones");
      squadLogic.buildEngagementZones(state, combatPipelineHelpers);
      perfEndStep("buildEngagementZones");
      perfStartStep("updateSquadCombatState");
      squadLogic.updateSquadCombatState(state, combatPipelineHelpers);
      perfEndStep("updateSquadCombatState");
      perfStartStep("updateCombat");
      squadLogic.updateCombat(state, dt, combatPipelineHelpers);
      perfEndStep("updateCombat");
      perfStartStep("updateResumeOrders");
      squadLogic.updateResumeOrders(state, dt, combatPipelineHelpers);
      perfEndStep("updateResumeOrders");

      perfStartStep("stepUnits");
      stepUnits(dt);
      perfEndStep("stepUnits");
      perfStartStep("stepCombat");
      stepCombat(dt);
      perfEndStep("stepCombat");

      perfStartStep("mergeBattle");
      const squadLogicGlobal = getSquadLogicGlobal();
      if (squadLogicGlobal) {
        for (const u of state.units.values()) {
          if (u._formationRebuildAt != null && state.t >= u._formationRebuildAt && u.squadId != null) {
            u._formationRebuildAt = undefined;
            squadLogicGlobal.requestFormationRecalc(state, u.squadId, false);
            squadLogicGlobal.recalculateFormation(state, u.squadId, { getFormationOffsets }, false);
          }
        }
      } else {
        mergeBattleSurvivorsIntoOneSquad();
        for (const u of state.units.values()) {
          if (u._formationRebuildAt != null && u.leaderId == null && state.t >= u._formationRebuildAt) {
            u._formationRebuildAt = undefined;
            const squad = [u];
            for (const v of state.units.values()) {
              if (v.leaderId === u.id) squad.push(v);
            }
            if (squad.length > 1) {
              applyFormationToSquad(squad, u.formationType || "line", u.formationRows || 3, null, null, u.formationPigWidth);
            }
          }
        }
      }
      perfEndStep("mergeBattle");

      perfStartStep("stepTurrets");
      stepTurrets(dt);
      perfEndStep("stepTurrets");
      stepPatrols(dt);
      perfStartStep("stepBullets");
      stepBullets(dt);
      perfEndStep("stepBullets");
      stepMines(dt);
      stepMineGems(dt);
      stepResourceMagnet(dt);
      stepPickups(dt);
      stepNebulae(dt);
      stepStorm(dt);
      stepAbilityStorms(dt);
      stepBlackHoles(dt);
      stepRandomEvents(dt);
      stepAbilityZoneEffects(dt);
      stepAbilityCooldowns(dt);
      stepLoanDebts(dt);
      stepMeteors(dt);
      stepBgComets(dt);
      stepSurvivalWaves(dt);
    }

    return { step };
  }

  const api = { install };
  if (typeof window !== "undefined") window.HostSimRuntime = api;
  if (typeof module !== "undefined") module.exports = api;
})();
