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
      getFrontPlannerGlobal,
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
      stepOrbitalStrikes,
      stepThermoNukes,
      stepPirateRaids,
      stepSurvivalWaves,
      stepLaneFighterWaves
    } = deps;

    function shouldRunPhase(counterKey, interval) {
      const every = Math.max(1, interval || 1);
      if (every <= 1) {
        state[counterKey] = 0;
        return true;
      }
      if (state[counterKey] == null) {
        state[counterKey] = 0;
        return true;
      }
      state[counterKey] += 1;
      if (state[counterKey] >= every) {
        state[counterKey] = 0;
        return true;
      }
      return false;
    }

    function getThrottleProfile() {
      const units = state.units ? state.units.size : 0;
      const squads = state.squads ? state.squads.size : 0;
      const bullets = state.bullets ? state.bullets.length : 0;
      const superExtremeLoad = units >= 300 || squads >= 220 || bullets >= 90;
      const extremeLoad = units >= 220 || squads >= 150 || bullets >= 55;
      const heavyLoad = units >= 120 || squads >= 80 || bullets >= 20;
      return {
        cityInterval: superExtremeLoad ? 3 : (heavyLoad ? 2 : 1),
        plannerInterval: superExtremeLoad ? 5 : (extremeLoad ? 4 : (heavyLoad ? 2 : 1)),
        engagementInterval: extremeLoad ? 3 : (heavyLoad ? 2 : 1),
        combatInterval: superExtremeLoad ? 2 : 1
      };
    }

    function step(dt) {
      const throttle = getThrottleProfile();
      state._cityStepAccumDt = (state._cityStepAccumDt || 0) + dt;
      if (shouldRunPhase("_cityStepCounter", throttle.cityInterval)) {
        perfStartStep("stepCities");
        stepCities(state._cityStepAccumDt || dt);
        perfEndStep("stepCities");
        state._cityStepAccumDt = 0;
        if (state._frameCtr % 4 === 0) rebuildZoneGrid();
      }

      perfStartStep("botThink");
      if (state._frameCtr % 2 === 0) botThink(dt);
      perfEndStep("botThink");

      const squadLogic = requireSquadLogic("authoritative combat pipeline");
      const frontPlanner = getFrontPlannerGlobal ? getFrontPlannerGlobal() : null;
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
      const postSyncThrottle = getThrottleProfile();
      if (!state._menuBackdropActive && frontPlanner && typeof frontPlanner.step === "function" && shouldRunPhase("_frontPlannerCounter", postSyncThrottle.plannerInterval)) {
        perfStartStep("frontPlanner");
        frontPlanner.step(state, dt, {
          squadLogic,
          getFormationOffsets
        });
        perfEndStep("frontPlanner");
      }
      if (shouldRunPhase("_engagementZoneCounter", postSyncThrottle.engagementInterval)) {
        perfStartStep("buildEngagementZones");
        squadLogic.buildEngagementZones(state, combatPipelineHelpers);
        perfEndStep("buildEngagementZones");
      }
      perfStartStep("updateSquadCombatState");
      squadLogic.updateSquadCombatState(state, combatPipelineHelpers);
      perfEndStep("updateSquadCombatState");
      state._combatUpdateAccumDt = (state._combatUpdateAccumDt || 0) + dt;
      state._resumeUpdateAccumDt = (state._resumeUpdateAccumDt || 0) + dt;
      if (shouldRunPhase("_combatUpdateCounter", postSyncThrottle.combatInterval)) {
        perfStartStep("updateCombat");
        squadLogic.updateCombat(state, state._combatUpdateAccumDt || dt, combatPipelineHelpers);
        perfEndStep("updateCombat");
        state._combatUpdateAccumDt = 0;
        perfStartStep("updateResumeOrders");
        squadLogic.updateResumeOrders(state, state._resumeUpdateAccumDt || dt, combatPipelineHelpers);
        perfEndStep("updateResumeOrders");
        state._resumeUpdateAccumDt = 0;
      }

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
      stepOrbitalStrikes(dt);
      stepThermoNukes(dt);
      stepPirateRaids(dt);
      stepSurvivalWaves(dt);
      if (typeof stepLaneFighterWaves === "function") stepLaneFighterWaves(dt);
    }

    return { step };
  }

  const api = { install };
  if (typeof window !== "undefined") window.HostSimRuntime = api;
  if (typeof module !== "undefined") module.exports = api;
})();
