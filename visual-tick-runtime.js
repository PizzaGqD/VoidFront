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
      updateFrontLaneOverlay,
      updateMinimap,
      updateLeaderboard,
      updateFog,
      updateSquadStrip,
      updateSquadControlBox,
      updateFrontControlBox,
      updateHUD,
      updateDelayedHoverInfo,
      checkVictory,
      updateSurvivalHud,
      updateDominationTimerUI,
      getCombatGlobal,
      combatDebugGfx,
      getUnitAtkRange,
      inView,
      updateCombatDebugLabels
    } = deps;

    function timeCall(name, fn) {
      perfStartStep(name);
      try {
        return fn();
      } finally {
        perfEndStep(name);
      }
    }

    function step(dt, now) {
      const unitCount = state.units ? state.units.size : 0;
      const bulletCount = state.bullets ? state.bullets.length : 0;
      const squadCount = state.squads ? state.squads.size : 0;
      const packetCount = state.mineFlowPackets ? state.mineFlowPackets.length : 0;
      const heavyLoad = unitCount >= 350 || squadCount >= 280 || bulletCount >= 120 || packetCount >= 160;
      const severeLoad = unitCount >= 520 || squadCount >= 420 || bulletCount >= 220 || packetCount >= 240;

      perfStartStep("zones");
      if (state.zonesEnabled) {
        const zoneZoom = Number.isFinite(world?.scale?.x) ? world.scale.x : 0.22;
        const zoneLodLevel = typeof LOD !== "undefined" && LOD && typeof LOD.getLevel === "function"
          ? LOD.getLevel(zoneZoom)
          : "near";
        const zoneLodChanged = state._zoneVisualLodLevel !== zoneLodLevel;
        state._zoneVisualLodLevel = zoneLodLevel;
        const zoneCadenceSec = 3.0;
        const zoneRedrawThisFrame = zoneLodChanged || state._nextZoneVisualRedrawAt == null || (state.t || 0) >= state._nextZoneVisualRedrawAt;
        if (zoneRedrawThisFrame) state._nextZoneVisualRedrawAt = (state.t || 0) + zoneCadenceSec;
        for (const p of state.players.values()) {
          const oldHash = p._lastZoneHash;
          if (zoneRedrawThisFrame) timeCall("zones.redraw", () => redrawZone(p));
          if (p._lastZoneHash !== oldHash || (state._frameCtr % (severeLoad ? 12 : (heavyLoad ? 10 : 8)) === 0)) {
            timeCall("zones.turrets", () => rebuildTurrets(p));
          }
        }
        state._zoneFrameCounter = (state._zoneFrameCounter || 0) + 1;
        if (state._zoneFrameCounter % (severeLoad ? 4 : (heavyLoad ? 3 : 2)) === 0) timeCall("zones.overlaps", () => updateZoneOverlaps());
        timeCall("zones.lights", () => updateZoneLights(dt));
        if (state._frameCtr % (severeLoad ? 5 : (heavyLoad ? 4 : 2)) === 0) timeCall("zones.contacts", () => updateZoneContacts(dt));
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
      if (vfc % 2 === 0) timeCall("vis.shields", () => updateShieldVisuals());
      if (vfc % (heavyLoad ? 5 : 3) === 0) timeCall("vis.discharges", () => updateDischarges(dt));
      if (vfc % (heavyLoad ? 6 : 4) === 0) {
        timeCall("vis.activity", () => {
          pulseStars();
          updateActivityZones();
        });
      }
      if (vfc % (heavyLoad ? 5 : 3) === 0) timeCall("vis.turrets", () => drawTurrets());
      if (vfc % (heavyLoad ? 4 : 2) === 0) timeCall("vis.cityLabels", () => updateCityPopLabels());
      if (vfc % (heavyLoad ? 6 : 3) === 0) timeCall("vis.squadLabels", () => updateSquadLabels());
      if (!severeLoad && vfc % (heavyLoad ? 4 : 2) === 0) timeCall("vis.shipTrails", () => updateShipTrails());
      if (vfc % (heavyLoad ? 4 : 3) === 0) timeCall("vis.combatUi", () => updateCombatUI());
      timeCall("vis.floatAndAnnounce", () => {
        updateFloatingDamage(dt);
        updateAbilityAnnouncements(dt);
      });
      timeCall("vis.mineFlow", () => updateMineFlowVisuals(dt));
      timeCall("vis.bullets", () => drawBullets());
      timeCall("vis.worldFx", () => {
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
      });
      timeCall("vis.overlay", () => {
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
        updateFrontLaneOverlay();
      });
      timeCall("vis.ui", () => {
        if (vfc % (heavyLoad ? 8 : 4) === 0) updateMinimap();
        if (vfc % (heavyLoad ? 5 : 3) === 0) updateLeaderboard();
        if (vfc % (heavyLoad ? 4 : 2) === 0) updateFog();
        if (vfc % (heavyLoad ? 4 : 2) === 0) updateSquadStrip();
        updateSquadControlBox();
        updateFrontControlBox();
        if (vfc % (heavyLoad ? 4 : 3) === 0) updateHUD();
        updateDelayedHoverInfo();
      });
      if (vfc % (heavyLoad ? 15 : 10) === 0) {
        timeCall("vis.victoryUi", () => {
          checkVictory();
          updateSurvivalHud();
          updateDominationTimerUI();
        });
      }

      const combat = getCombatGlobal();
      if (combat && combat.DEBUG && combat.DEBUG.enabled) {
        timeCall("vis.debug", () => {
          combat.drawCombatDebug(combatDebugGfx, state, {
            getUnitAtkRange,
            inView
          });
          updateCombatDebugLabels();
        });
      } else {
        if (combatDebugGfx) combatDebugGfx.clear();
        timeCall("vis.debug", () => updateCombatDebugLabels());
      }

      perfEndStep("visuals");
    }

    return { step };
  }

  const api = { install };
  if (typeof window !== "undefined") window.VisualTickRuntime = api;
  if (typeof module !== "undefined") module.exports = api;
})();
