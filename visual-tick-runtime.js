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
      drawBgComets,
      updateActivityZones,
      drawTurrets,
      updateCityPopLabels,
      updateSquadLabels,
      updateShipTrails,
      updateCombatUI,
      updateFloatingDamage,
      updateAbilityAnnouncements,
      drawBullets,
      drawStorm,
      drawNebulae,
      drawAbilityStorms,
      drawBlackHoles,
      drawPirateBase,
      drawAbilityZoneEffects,
      drawHyperFlashes,
      drawMeteors,
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
      perfStartStep("zones");
      if (state.zonesEnabled) {
        const isRemote = state._multiSlots && !state._multiIsHost;
        const zoneRedrawThisFrame = !isRemote || (state._frameCtr % 2 === 0);
        for (const p of state.players.values()) {
          const oldHash = p._lastZoneHash;
          if (zoneRedrawThisFrame) redrawZone(p);
          if (p._lastZoneHash !== oldHash || (state._frameCtr % 8 === 0)) rebuildTurrets(p);
        }
        state._zoneFrameCounter = (state._zoneFrameCounter || 0) + 1;
        if (state._zoneFrameCounter % 2 === 0) updateZoneOverlaps();
        updateZoneLights(dt);
        if (state._frameCtr % 3 === 0) updateZoneContacts(dt);
      } else {
        contactGfx.clear();
        for (const p of state.players.values()) {
          if (p.zoneLightGfx) p.zoneLightGfx.clear();
        }
      }
      perfEndStep("zones");

      perfStartStep("visuals");
      const vfc = state._frameCtr;
      if (vfc % 2 === 0) updateShieldVisuals();
      if (vfc % 3 === 0) updateDischarges(dt);
      if (vfc % 4 === 0) pulseStars();
      drawBgComets();
      if (vfc % 4 === 0) updateActivityZones();
      if (vfc % 3 === 0) drawTurrets();
      if (vfc % 2 === 0) updateCityPopLabels();
      if (vfc % 3 === 0) updateSquadLabels();
      if (vfc % 2 === 0) updateShipTrails();
      if (vfc % 3 === 0) updateCombatUI();
      updateFloatingDamage(dt);
      updateAbilityAnnouncements(dt);
      drawBullets();
      drawStorm();
      drawNebulae();
      drawAbilityStorms();
      drawBlackHoles();
      drawPirateBase();
      drawAbilityZoneEffects();
      drawHyperFlashes();
      drawMeteors();
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
      if (vfc % 4 === 0) updateMinimap();
      if (vfc % 3 === 0) updateLeaderboard();
      if (vfc % 2 === 0) updateFog();
      if (vfc % 2 === 0) updateSquadStrip();
      updateSquadControlBox();
      if (vfc % 3 === 0) updateHUD();
      if (vfc % 10 === 0) {
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
