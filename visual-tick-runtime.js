(function () {
  "use strict";

  function install(deps) {
    const {
      state,
      perfStartStep,
      perfEndStep,
      redrawZone,
      rebuildTurrets,
      updateZoneOverlaps,
      updateZoneLights,
      updateZoneContacts,
      contactGfx,
      updateShieldVisuals,
      updateDischarges,
      pulseStars,
      updateActivityZones,
      drawTurrets,
      updateCityPopLabels,
      updateSquadLabels,
      updateShipTrails,
      updateCombatUI,
      updateFloatingDamage,
      updateAbilityAnnouncements,
      updateMineFlowVisuals,
      drawBullets,
      drawStorm,
      drawNebulae,
      drawAbilityStorms,
      drawBlackHoles,
      drawPirateBase,
      drawAbilityZoneEffects,
      drawHyperFlashes,
      drawMeteors,
      drawOrbitalStrikes,
      drawThermoNukes,
      drawPirateRaids,
      drawMeteorImpactEffects,
      drawTimeRewindFx,
      drawAbilityTargetPreview,
      clearAbilityPreview,
      neonEdgeSprite,
      world,
      pulseNeonEdge,
      updateSelectionBox,
      updatePathPreview,
      updateMovingPathPreview,
      updateMinimap,
      updateLeaderboard,
      updateFog,
      updateSquadStrip,
      updateSquadControlBox,
      updateHUD,
      checkVictory,
      updateSurvivalHud,
      updateDominationTimerUI,
      getCombatGlobal,
      combatDebugGfx,
      getUnitAtkRange,
      inView,
      updateCombatDebugLabels
    } = deps;

    function step(dt, now) {
      const unitCount = state.units ? state.units.size : 0;
      const bulletCount = state.bullets ? state.bullets.length : 0;
      const heavyLoad = unitCount >= 450 || bulletCount >= 220;
      const severeLoad = unitCount >= 700 || bulletCount >= 420;

      perfStartStep("zones");
      if (state.zonesEnabled) {
        const isRemote = state._multiSlots && !state._multiIsHost;
        const zoneRedrawThisFrame = !isRemote || (state._frameCtr % (heavyLoad ? 3 : 2) === 0);
        for (const p of state.players.values()) {
          const oldHash = p._lastZoneHash;
          if (zoneRedrawThisFrame) redrawZone(p);
          if (p._lastZoneHash !== oldHash || (state._frameCtr % (heavyLoad ? 12 : 8) === 0)) rebuildTurrets(p);
        }
        state._zoneFrameCounter = (state._zoneFrameCounter || 0) + 1;
        if (state._zoneFrameCounter % (heavyLoad ? 3 : 2) === 0) updateZoneOverlaps();
        updateZoneLights(dt);
        if (state._frameCtr % (heavyLoad ? 5 : 3) === 0) updateZoneContacts(dt);
      } else {
        contactGfx.clear();
        for (const p of state.players.values()) {
          if (p.zoneGfx) p.zoneGfx.clear();
          if (p.zoneGlow) p.zoneGlow.clear();
          if (p.zoneShellGfx) p.zoneShellGfx.clear();
          if (p.zoneLightGfx) p.zoneLightGfx.clear();
        }
      }
      perfEndStep("zones");

      perfStartStep("visuals");
      const vfc = state._frameCtr;
      if (vfc % 2 === 0) updateShieldVisuals();
      if (vfc % (heavyLoad ? 5 : 3) === 0) updateDischarges(dt);
      if (vfc % (heavyLoad ? 6 : 4) === 0) pulseStars();
      if (vfc % (heavyLoad ? 6 : 4) === 0) updateActivityZones();
      if (vfc % (heavyLoad ? 5 : 3) === 0) drawTurrets();
      if (vfc % (heavyLoad ? 4 : 2) === 0) updateCityPopLabels();
      if (vfc % (heavyLoad ? 6 : 3) === 0) updateSquadLabels();
      if (!severeLoad && vfc % (heavyLoad ? 4 : 2) === 0) updateShipTrails();
      if (vfc % (heavyLoad ? 4 : 3) === 0) updateCombatUI();
      updateFloatingDamage(dt);
      updateAbilityAnnouncements(dt);
      updateMineFlowVisuals(dt);
      drawBullets();
      drawStorm();
      if (!severeLoad || vfc % 2 === 0) drawNebulae();
      if (!severeLoad || vfc % 2 === 0) drawAbilityStorms();
      if (!severeLoad || vfc % 2 === 0) drawBlackHoles();
      if (!severeLoad || vfc % 2 === 0) drawPirateBase();
      if (!severeLoad || vfc % 2 === 0) drawAbilityZoneEffects();
      if (!severeLoad || vfc % 2 === 0) drawHyperFlashes();
      drawMeteors();
      drawOrbitalStrikes();
      drawThermoNukes();
      drawPirateRaids();
      drawMeteorImpactEffects();
      drawTimeRewindFx(now / 1000);
      if (state._abilityTargeting) drawAbilityTargetPreview();
      else clearAbilityPreview();
      if (neonEdgeSprite) {
        if (neonEdgeSprite.parent) neonEdgeSprite.parent.removeChild(neonEdgeSprite);
        world.addChild(neonEdgeSprite);
      }
      pulseNeonEdge();
      updateSelectionBox();
      updatePathPreview();
      updateMovingPathPreview();
      if (vfc % (heavyLoad ? 8 : 4) === 0) updateMinimap();
      if (vfc % (heavyLoad ? 5 : 3) === 0) updateLeaderboard();
      if (vfc % (heavyLoad ? 4 : 2) === 0) updateFog();
      if (vfc % (heavyLoad ? 4 : 2) === 0) updateSquadStrip();
      updateSquadControlBox();
      if (vfc % (heavyLoad ? 4 : 3) === 0) updateHUD();
      if (vfc % (heavyLoad ? 15 : 10) === 0) {
        checkVictory();
        updateSurvivalHud();
        updateDominationTimerUI();
      }

      const combat = getCombatGlobal();
      if (combat && combat.DEBUG && combat.DEBUG.enabled) {
        combat.drawCombatDebug(combatDebugGfx, state, {
          getUnitAtkRange,
          inView
        });
        updateCombatDebugLabels();
      } else {
        if (combatDebugGfx) combatDebugGfx.clear();
        updateCombatDebugLabels();
      }

      perfEndStep("visuals");
    }

    return { step };
  }

  const api = { install };
  if (typeof window !== "undefined") window.VisualTickRuntime = api;
  if (typeof module !== "undefined") module.exports = api;
})();
