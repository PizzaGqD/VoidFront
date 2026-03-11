(function () {
  "use strict";

  function install(deps) {
    const {
      state,
      CFG,
      purchaseUnit,
      shieldRadius,
      getUnitAtkRange,
      getSquadStateFromUnits,
      getFormationOffsets,
      applyFormationToSquad,
      ABILITY_DEFS,
      setAbilityCooldown,
      pushAbilityAnnouncement,
      spawnIonNebulaLocal,
      spawnMeteorLocal,
      spawnBlackHole,
      useActiveShield,
      spawnPirateRaid,
      useGloriousBattleMarch,
      useLoan,
      useRaiderCapture,
      beginTimeRewindSequence,
      applyCard,
      TIME_JUMP_REWIND_SEC
    } = deps;

    function getSquadLogic() {
      return typeof SQUADLOGIC !== "undefined" ? SQUADLOGIC : null;
    }

    function mapWaypoints(action) {
      return Array.isArray(action.waypoints) && action.waypoints.length > 0
        ? action.waypoints.map((w) => ({ x: w.x, y: w.y }))
        : [{ x: action.x, y: action.y }];
    }

    function handlePlayerAction(action) {
      if (!state._multiIsHost) return;
      console.log("[MP-ACTION] host received action:", action.type, "pid=", action.pid, "from remote");

      const squadLogic = getSquadLogic();

      if (action.type === "spawn") {
        const res = purchaseUnit(action.pid, action.unitType || "fighter", action.waypoints);
        console.log("[MP-ACTION] spawn result:", JSON.stringify(res));
        return;
      }

      if (action.type === "purchase") {
        const res = purchaseUnit(action.pid, action.unitType || "fighter", action.waypoints);
        console.log("[MP-ACTION] purchase result:", JSON.stringify(res));
        return;
      }

      if (action.type === "chase") {
        if (squadLogic) {
          for (const lid of action.leaderIds || []) {
            const u = state.units.get(lid);
            if (!u || u.squadId == null) continue;
            squadLogic.issueAttackUnitOrder(state, u.squadId, action.targetUnitId);
          }
          return;
        }
        for (const lid of action.leaderIds || []) {
          const u = state.units.get(lid);
          if (!u) continue;
          u.chaseTargetUnitId = action.targetUnitId;
          u.chaseTargetCityId = undefined;
          u.waypoints = [{ x: action.x, y: action.y }];
          u.waypointIndex = 0;
          u.straightMode = false;
        }
        return;
      }

      if (action.type === "chaseCity") {
        if (squadLogic) {
          for (const lid of action.leaderIds || []) {
            const u = state.units.get(lid);
            if (!u || u.squadId == null) continue;
            squadLogic.issueSiegeOrder(state, u.squadId, action.targetCityId, [{ x: action.x, y: action.y }]);
          }
          return;
        }
        const city = state.players.get(action.targetCityId);
        const minStopR = city ? shieldRadius(city) + 6 : 26;
        for (const lid of action.leaderIds || []) {
          const u = state.units.get(lid);
          if (!u) continue;
          u.chaseTargetCityId = action.targetCityId;
          u.chaseTargetUnitId = undefined;
          const stopR = Math.max(getUnitAtkRange(u), minStopR);
          const cx = city ? city.x : action.x;
          const cy = city ? city.y : action.y;
          const dx = u.x - cx;
          const dy = u.y - cy;
          const dl = Math.hypot(dx, dy) || 1;
          u.waypoints = [{ x: cx + (dx / dl) * stopR, y: cy + (dy / dl) * stopR }];
          u.waypointIndex = 0;
          u.straightMode = false;
        }
        return;
      }

      if (action.type === "attackPirateBase") {
        if (squadLogic) {
          const wp = [{ x: action.x, y: action.y }];
          for (const lid of action.leaderIds || []) {
            const u = state.units.get(lid);
            if (!u || u.squadId == null) continue;
            squadLogic.issuePirateBaseOrder(state, u.squadId, wp);
          }
        }
        return;
      }

      if (action.type === "focusFire") {
        if (squadLogic) {
          for (const lid of action.leaderIds || []) {
            const u = state.units.get(lid);
            if (!u || u.squadId == null) continue;
            const sq = state.squads.get(u.squadId);
            if (sq && sq.combat && sq.combat.mode !== "idle") {
              squadLogic.setSquadFocusTarget(state, u.squadId, action.targetUnitId);
            } else {
              squadLogic.issueAttackUnitOrder(state, u.squadId, action.targetUnitId, []);
            }
          }
        }
        return;
      }

      if (action.type === "move") {
        const wp = mapWaypoints(action);
        if (squadLogic) {
          for (const lid of action.leaderIds || []) {
            const u = state.units.get(lid);
            if (!u || u.squadId == null) continue;
            if (action.capture) squadLogic.issueCaptureOrder(state, u.squadId, action.mineId, wp[0]);
            else squadLogic.issueMoveOrder(state, u.squadId, wp, action.angle);
          }
          return;
        }
        for (const lid of action.leaderIds || []) {
          const u = state.units.get(lid);
          if (!u) continue;
          u.targetFormationAngle = action.angle;
          u.chaseTargetUnitId = undefined;
          u.chaseTargetCityId = undefined;
          for (const v of state.units.values()) {
            if ((v.leaderId || v.id) === lid) {
              v.waypoints = wp.map((w) => ({ x: w.x, y: w.y }));
              v.waypointIndex = 0;
              v.straightMode = false;
            }
          }
        }
        return;
      }

      if (action.type === "formation") {
        const squad = (action.unitIds || []).map((id) => state.units.get(id)).filter(Boolean);
        if (squadLogic) {
          if (squad.length > 0) {
            const squadState = getSquadStateFromUnits(squad);
            if (squadState) {
              squadLogic.setSquadFormation(state, squadState.id, action.formationType || "line", action.formationRows || 3, action.formationPigWidth || 1);
              squadLogic.recalculateFormation(state, squadState.id, { getFormationOffsets }, true);
            }
          }
          return;
        }
        if (squad.length > 0) {
          const leader = squad.find((u) => !u.leaderId) || squad[0];
          const wp = leader.waypoints;
          const idx = leader.waypointIndex ?? 0;
          const dirX = wp && idx < wp.length && wp[idx] ? wp[idx].x - leader.x : null;
          const dirY = wp && idx < wp.length && wp[idx] ? wp[idx].y - leader.y : null;
          applyFormationToSquad(squad, action.formationType || "pig", action.formationRows || 1, dirX, dirY, action.formationPigWidth || 1);
        }
        return;
      }

      if (action.type === "mergeSquad") {
        if (squadLogic) {
          const squadIds = Array.isArray(action.squadIds) ? action.squadIds : [];
          const merged = squadIds.length >= 2
            ? squadLogic.mergeSquads(state, squadIds, action.formationType || "line", action.formationRows || 3, action.formationPigWidth || 1)
            : null;
          if (merged) {
            const waypoints = Array.isArray(action.waypoints) && action.waypoints.length > 0
              ? action.waypoints.map((w) => ({ x: w.x, y: w.y }))
              : [];
            squadLogic.issueMoveOrder(state, merged.id, waypoints, null);
            squadLogic.recalculateFormation(state, merged.id, { getFormationOffsets }, true);
          }
          return;
        }
        const units = (action.unitIds || []).map((id) => state.units.get(id)).filter(Boolean);
        if (units.length >= 2) {
          const leader = units[0];
          const formationType = action.formationType || "pig";
          const formationRows = action.formationRows || 1;
          const pigW = action.formationPigWidth || 1;
          const waypoints = Array.isArray(action.waypoints) && action.waypoints.length > 0
            ? action.waypoints.map((w) => ({ x: w.x, y: w.y }))
            : [{ x: leader.x + 280, y: leader.y }];
          const dx = waypoints[0].x - leader.x;
          const dy = waypoints[0].y - leader.y;
          const dl = Math.hypot(dx, dy) || 1;
          const vx = dx / dl;
          const vy = dy / dl;
          const offsets = getFormationOffsets(units.length, formationType, formationRows, vx, vy, pigW, units);
          const leaderId = leader.id;
          leader.leaderId = null;
          leader.formationType = formationType;
          leader.formationRows = formationRows;
          leader._formationAngle = Math.atan2(vy, vx);
          leader._lastFacingAngle = Math.atan2(vy, vx);
          if (formationType === "pig") leader.formationPigWidth = pigW;
          leader.waypoints = waypoints;
          leader.waypointIndex = 0;
          leader.straightMode = false;
          for (let i = 0; i < units.length; i++) {
            const u = units[i];
            u.leaderId = i === 0 ? null : leaderId;
            u.formationOffsetX = offsets[i]?.x ?? 0;
            u.formationOffsetY = offsets[i]?.y ?? 0;
            u.waypoints = waypoints.map((w) => ({ x: w.x, y: w.y }));
            u.waypointIndex = 0;
            u.straightMode = false;
          }
        }
        return;
      }

      if (action.type === "splitSquad") {
        const allUnits = (action.unitIds || []).map((id) => state.units.get(id)).filter(Boolean);
        if (squadLogic) {
          if (allUnits.length >= 2) {
            const squadState = getSquadStateFromUnits(allUnits);
            if (squadState) {
              const n = allUnits.length;
              const k = Math.floor(n / 2);
              const firstIds = allUnits.slice(0, k).map((u) => u.id);
              const secondIds = allUnits.slice(k).map((u) => u.id);
              const order = squadLogic.cloneOrder(squadState.order);
              const formation = { ...squadState.formation };
              squadLogic.destroySquad(state, squadState.id);
              const firstSquad = squadLogic.createSquad(state, firstIds, {
                formationType: formation.type,
                formationRows: formation.rows,
                formationWidth: formation.width,
                order
              });
              const secondSquad = squadLogic.createSquad(state, secondIds, {
                formationType: formation.type,
                formationRows: formation.rows,
                formationWidth: formation.width,
                order
              });
              if (firstSquad) squadLogic.recalculateFormation(state, firstSquad.id, { getFormationOffsets }, true);
              if (secondSquad) squadLogic.recalculateFormation(state, secondSquad.id, { getFormationOffsets }, true);
            }
          }
          return;
        }
        if (allUnits.length >= 2) {
          const n = allUnits.length;
          const k = Math.floor(n / 2);
          const first = allUnits.slice(0, k);
          const second = allUnits.slice(k);
          const centerIdx = (arr) => Math.min(Math.floor((arr.length - 1) / 2), arr.length - 1);
          const leader1 = state.units.get(action.leader1Id) || first[centerIdx(first)];
          const leader2 = state.units.get(action.leader2Id) || second[centerIdx(second)];
          if (leader1 && leader2) {
            for (const u of first) {
              u.leaderId = leader1.id;
              u.formationOffsetX = 0;
              u.formationOffsetY = 0;
            }
            leader1.leaderId = null;
            for (const u of second) {
              u.leaderId = leader2.id;
              u.formationOffsetX = 0;
              u.formationOffsetY = 0;
            }
            leader2.leaderId = null;
            applyFormationToSquad(first, leader1.formationType || "pig", leader1.formationRows ?? 1, null, null, leader1.formationPigWidth);
            applyFormationToSquad(second, leader2.formationType || "pig", leader2.formationRows ?? 1, null, null, leader2.formationPigWidth);
          }
        }
        return;
      }

      if (action.type === "splitSquadByType") {
        if (squadLogic) {
          const squad = state.squads.get(action.squadId);
          if (squad) {
            const out = squadLogic.splitSquadByType(state, squad.id);
            for (const nextSquad of out) squadLogic.recalculateFormation(state, nextSquad.id, { getFormationOffsets }, true);
          }
        }
        return;
      }

      if (action.type === "useAbility") {
        const def = ABILITY_DEFS.find((d) => d.id === action.abilityId);
        if (def && action.pid != null && !def.oneTime) setAbilityCooldown(action.pid, action.abilityId, def.cooldown);
        pushAbilityAnnouncement(action.pid, action.abilityId);
        if (action.abilityId === "ionNebula") {
          spawnIonNebulaLocal(action.x, action.y, action.pid);
        } else if (action.abilityId === "meteor") {
          spawnMeteorLocal(action.x, action.y, action.angle, action.pid);
        } else if (action.abilityId === "blackHole") {
          spawnBlackHole(action.x, action.y, action.pid);
          const me = state.players.get(action.pid);
          if (me && def) {
            if (!state._abilityCooldownsByPlayer[me.id]) state._abilityCooldownsByPlayer[me.id] = {};
            state._abilityCooldownsByPlayer[me.id].blackHole = state.t + CFG.BLACKHOLE_COOLDOWN;
          }
        } else if (action.abilityId === "activeShield") {
          useActiveShield(action.pid);
        } else if (action.abilityId === "pirateRaid") {
          spawnPirateRaid(action.x, action.y, action.angle ?? 0);
        } else if (action.abilityId === "gloriousBattleMarch") {
          useGloriousBattleMarch(action.pid);
        } else if (action.abilityId === "loan") {
          useLoan(action.pid);
        } else if (action.abilityId === "raiderCapture") {
          useRaiderCapture(action.pid, action.targetCityId);
        } else if (action.abilityId === "timeJump") {
          if (!state._timeSnapshots || state._timeSnapshots.length === 0) return;
          const targetT = Math.max(0, state.t - TIME_JUMP_REWIND_SEC);
          let snap = null;
          for (let i = state._timeSnapshots.length - 1; i >= 0; i--) {
            if (state._timeSnapshots[i].t <= targetT) {
              snap = state._timeSnapshots[i];
              break;
            }
          }
          if (snap) {
            const eliminatedBeforeRewind = [...state.players.values()].filter((p) => p.eliminated).map((p) => p.id);
            beginTimeRewindSequence(action.pid, snap, eliminatedBeforeRewind);
          }
        }
        return;
      }

      if (action.type === "cardChoice") {
        const pl = action.pid != null ? state.players.get(action.pid) : null;
        if (pl && action.card && typeof pl.pendingCardPicks === "number" && pl.pendingCardPicks > 0) {
          applyCard(pl, action.card);
          pl.pendingCardPicks--;
        }
      }
    }

    return {
      handlePlayerAction
    };
  }

  const api = { install };
  if (typeof window !== "undefined") window.SocketActionDispatch = api;
  if (typeof module !== "undefined") module.exports = api;
})();
