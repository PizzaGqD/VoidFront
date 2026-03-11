(function () {
  "use strict";

  function install(deps) {
    const {
      state,
      app,
      cam,
      panState,
      applyCamera,
      ensureAudio,
      screenToWorld,
      unitAtWorld,
      unitAtWorldAny,
      cityAtWorld,
      mineAtWorld,
      getSquadStateFromUnits,
      cloneWaypointsSafe,
      getFormationOffsets,
      getFormationCenter,
      getUnitAtkRange,
      getUnitHitRadius,
      shieldRadius,
      closeEnemyCityPanel,
      showEnemyCompare,
      drawDashedSegment,
      destroyChildren,
      pathPreviewLayer,
      drawShipShape,
      getSquads,
      rallyPointHintEl
    } = deps;

    function getCombatApi() {
      return typeof COMBAT !== "undefined" ? COMBAT : null;
    }

    function getSquadLogicApi() {
      return typeof SQUADLOGIC !== "undefined" ? SQUADLOGIC : null;
    }

    function getFormationsApi() {
      return typeof FORMATIONS !== "undefined" ? FORMATIONS : null;
    }

    function unitsInRect(x1, y1, x2, y2) {
      const lx = Math.min(x1, x2), rx = Math.max(x1, x2);
      const ly = Math.min(y1, y2), ry = Math.max(y1, y2);
      const out = [];
      for (const u of state.units.values()) {
        if (u.owner !== state.myPlayerId) continue;
        if (u.x >= lx && u.x <= rx && u.y >= ly && u.y <= ry) out.push(u);
      }
      return out;
    }

    function getSelectedSquads() {
      const seen = new Set();
      const squads = [];
      for (const id of state.selectedUnitIds) {
        const u = state.units.get(id);
        if (!u || u.owner !== state.myPlayerId) continue;
        const lid = u.leaderId || u.id;
        if (seen.has(lid)) continue;
        seen.add(lid);
        const squad = [];
        for (const v of state.units.values()) {
          if ((v.leaderId || v.id) === lid && v.owner === state.myPlayerId) squad.push(v);
        }
        if (squad.length) squads.push(squad);
      }
      return squads;
    }

    function describeOrderPreview(order) {
      if (!order) return { ghostPath: false, targetHighlight: false };
      return {
        ghostPath: order.type === "move" || order.type === "capture",
        targetHighlight: order.type === "attackUnit" || order.type === "attackCity"
      };
    }

    function updatePathPreview() {
      destroyChildren(pathPreviewLayer);
      const me = state.players.get(state.myPlayerId);
      const order = state.orderPreview;
      if (order && order.type === "move" && state.formationPreview) {
        const fp = state.formationPreview;
        const squads = getSelectedSquads();
        const cosA = Math.cos(fp.angle);
        const sinA = Math.sin(fp.angle);
        for (const squad of squads) {
          const leader = squad.find((u) => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
          const formationType = leader.formationType || "line";
          const formationRows = fp.dragRows != null ? fp.dragRows : (leader.formationRows || 3);
          const pigW = fp.dragWidth != null ? fp.dragWidth : (leader.formationPigWidth ?? 1);

          let offsets;
          const formationsApi = getFormationsApi();
          if (formationsApi && formationsApi.getFormationOffsets) {
            const unitTypes = squad.map((u) => u.unitType || "fighter");
            offsets = formationsApi.getFormationOffsets(unitTypes, formationType, formationRows, fp.angle, pigW);
          } else {
            offsets = getFormationOffsets(squad.length, formationType, formationRows, cosA, sinA, pigW, squad);
          }

          let sqcx = 0, sqcy = 0;
          for (const u of squad) {
            sqcx += u.x;
            sqcy += u.y;
          }
          sqcx /= squad.length;
          sqcy /= squad.length;
          const dashLine = new PIXI.Graphics();
          dashLine.lineStyle(2.5, 0x66aaff, 0.45);
          drawDashedSegment(dashLine, sqcx, sqcy, fp.x, fp.y, 10, 7);
          pathPreviewLayer.addChild(dashLine);

          for (let i = 0; i < offsets.length; i++) {
            const o = offsets[i] || { x: 0, y: 0 };
            const u = squad[i] || squad[0];
            const unitType = u.unitType || "fighter";
            const uHitR = getUnitHitRadius(u);
            const ghostG = new PIXI.Graphics();
            drawShipShape(ghostG, unitType, 0xffffff, 0xffffff);
            ghostG.alpha = 0.3;
            ghostG.position.set(fp.x + o.x, fp.y + o.y);
            ghostG.rotation = fp.angle;
            ghostG.circle(0, 0, uHitR);
            ghostG.stroke({ color: 0xffffff, width: 1, alpha: 0.15 });
            pathPreviewLayer.addChild(ghostG);
          }
        }
      } else if (order && (order.type === "attackUnit" || order.type === "attackCity" || order.type === "attackPirateBase" || order.type === "focusFire" || order.type === "capture")) {
        const squads = getSelectedSquads();
        let scx = 0, scy = 0, scnt = 0;
        for (const sq of squads) {
          for (const u of sq) {
            scx += u.x;
            scy += u.y;
            scnt++;
          }
        }
        if (scnt) {
          scx /= scnt;
          scy /= scnt;
        }

        let tx = order.x, ty = order.y;
        let highlightColor = 0xff3333;
        let highlightR = 20;

        if (order.type === "attackUnit") {
          const target = state.units.get(order.targetUnitId);
          if (target) {
            tx = target.x;
            ty = target.y;
            highlightR = getUnitHitRadius(target) + 8;
          }
        } else if (order.type === "focusFire") {
          const target = state.units.get(order.targetUnitId);
          if (target) {
            tx = target.x;
            ty = target.y;
            highlightR = getUnitHitRadius(target) + 12;
          }
        } else if (order.type === "attackCity") {
          const city = state.players.get(order.targetCityId);
          if (city) {
            tx = city.x;
            ty = city.y;
            highlightR = shieldRadius(city) + 12;
          }
        } else if (order.type === "attackPirateBase" && state.pirateBase) {
          tx = state.pirateBase.x;
          ty = state.pirateBase.y;
          highlightR = 40;
        } else if (order.type === "capture") {
          highlightColor = 0x33aaff;
          highlightR = 28;
        }

        const dashG = new PIXI.Graphics();
        dashG.lineStyle(3, highlightColor, 0.65);
        drawDashedSegment(dashG, scx, scy, tx, ty, 12, 8);
        pathPreviewLayer.addChild(dashG);

        const g = new PIXI.Graphics();
        const pulse = 0.8 + Math.sin(performance.now() * 0.006) * 0.2;
        g.circle(tx, ty, highlightR * pulse);
        g.stroke({ color: highlightColor, width: 2.5, alpha: 0.7 });
        g.circle(tx, ty, 4);
        g.fill({ color: highlightColor, alpha: 0.6 });
        pathPreviewLayer.addChild(g);
      }
      if (!me || !state.targetPoints || state.targetPoints.length === 0) return;
      const pts = [{ x: me.x, y: me.y }, ...state.targetPoints];
      const g = new PIXI.Graphics();
      g.lineStyle(6, 0x000000, 0.4);
      for (let i = 0; i < pts.length - 1; i++) {
        g.moveTo(pts[i].x, pts[i].y);
        g.lineTo(pts[i + 1].x, pts[i + 1].y);
      }
      g.lineStyle(4, me.color, 0.85);
      for (let i = 0; i < pts.length - 1; i++) {
        g.moveTo(pts[i].x, pts[i].y);
        g.lineTo(pts[i + 1].x, pts[i + 1].y);
      }
      pathPreviewLayer.addChild(g);
    }

    function clearSquadCombat(squad) {
      const combatApi = getCombatApi();
      if (combatApi && combatApi.clearCombatState) {
        for (const u of squad) combatApi.clearCombatState(u);
      }
    }

    app.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    app.canvas.addEventListener("pointerdown", (e) => {
      ensureAudio();
      const btn = e.button;
      const pt = screenToWorld(e.clientX, e.clientY);

      if (btn === 2 || btn === 1) {
        if (btn === 2 && state.selectedUnitIds.size > 0) {
          const selectedSquads = getSquadLogicApi() ? getSelectedSquads() : [];
          const selectedCombatSquads = selectedSquads.filter((sq) => {
            const sqState = getSquadStateFromUnits(sq);
            return sqState && sqState.combat && sqState.combat.mode !== "idle";
          });
          const enemyUnit = unitAtWorldAny(pt.x, pt.y);
          const city = cityAtWorld(pt.x, pt.y);
          if (enemyUnit && enemyUnit.owner !== state.myPlayerId) {
            state.orderPreview = selectedCombatSquads.length > 0
              ? { type: "focusFire", targetUnitId: enemyUnit.id, x: enemyUnit.x, y: enemyUnit.y }
              : { type: "attackUnit", targetUnitId: enemyUnit.id, x: enemyUnit.x, y: enemyUnit.y };
            state.formationPreview = null;
            return;
          }
          if (city && city.id !== state.myPlayerId) {
            state.orderPreview = { type: "attackCity", targetCityId: city.id, x: city.x, y: city.y };
            state.formationPreview = null;
            return;
          }
          if (state.pirateBase && state.pirateBase.hp > 0) {
            const pbd = Math.hypot(pt.x - state.pirateBase.x, pt.y - state.pirateBase.y);
            if (pbd < 50) {
              state.orderPreview = { type: "attackPirateBase", x: state.pirateBase.x, y: state.pirateBase.y };
              state.formationPreview = null;
              return;
            }
          }
          const clickedMine = mineAtWorld(pt.x, pt.y);
          if (clickedMine) {
            state.orderPreview = { type: "capture", mineId: clickedMine.id, x: clickedMine.x, y: clickedMine.y };
            state.formationPreview = null;
            return;
          }
          const squads = getSelectedSquads();
          let cx = 0, cy = 0, n = 0;
          for (const squad of squads) {
            for (const u of squad) {
              cx += u.x;
              cy += u.y;
              n++;
            }
          }
          if (n) {
            cx /= n;
            cy /= n;
          }
          state.orderPreview = { type: "move", x: pt.x, y: pt.y };
          state._rmbHoldStart = performance.now();
          state._rmbHoldPt = { x: pt.x, y: pt.y, cx, cy, screenX: e.clientX, screenY: e.clientY };
          state.formationPreview = null;
          return;
        }
        panState.isPanning = true;
        panState.panBtn = btn;
        panState.lastX = e.clientX;
        panState.lastY = e.clientY;
        return;
      }

      if (btn === 0) {
        if (state._abilityTargeting) return;
        if (state.rallyPointMode) {
          state.rallyPoint = { x: pt.x, y: pt.y };
          state.rallyPointMode = false;
          if (rallyPointHintEl) rallyPointHintEl.textContent = "Точка сбора: " + Math.round(pt.x) + ", " + Math.round(pt.y);
          return;
        }
        if (state.selectedUnitIds.size > 0) {
          const clickedMine = mineAtWorld(pt.x, pt.y);
          if (clickedMine && clickedMine.ownerId !== state.myPlayerId) {
            const squads = getSelectedSquads();
            for (const squad of squads) {
              const leader = squad.find((v) => (v.leaderId || v.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
              leader.chaseTargetUnitId = undefined;
              leader.chaseTargetCityId = undefined;
              leader.waypoints = [{ x: clickedMine.x, y: clickedMine.y }];
              leader.waypointIndex = 0;
              leader.straightMode = false;
              for (const u of squad) {
                if (u !== leader) {
                  u.waypoints = [{ x: clickedMine.x, y: clickedMine.y }];
                  u.waypointIndex = 0;
                }
              }
            }
            return;
          }
        }
        if (state.selectedUnitIds.size === 0) {
          const city = cityAtWorld(pt.x, pt.y);
          if (city && city.id !== state.myPlayerId) {
            showEnemyCompare(city.id);
            return;
          }
        }
        const u = unitAtWorld(pt.x, pt.y);
        if (u) {
          if (e.ctrlKey || e.metaKey) {
            if (state.selectedUnitIds.has(u.id)) state.selectedUnitIds.delete(u.id);
            else state.selectedUnitIds.add(u.id);
          } else {
            const lid = u.leaderId || u.id;
            state.selectedUnitIds.clear();
            for (const v of state.units.values()) {
              if ((v.leaderId || v.id) === lid && v.owner === state.myPlayerId) state.selectedUnitIds.add(v.id);
            }
          }
          state.boxStart = null;
          state.boxEnd = null;
          return;
        }
        state.boxStart = { x: pt.x, y: pt.y };
        state.boxEnd = { x: pt.x, y: pt.y };
        if (!e.ctrlKey && !e.metaKey) state.selectedUnitIds.clear();
        closeEnemyCityPanel();
      }
    });

    window.addEventListener("pointerup", (e) => {
      if (e.button === 0 && state.boxStart && state.boxEnd) {
        const dx = Math.abs(state.boxEnd.x - state.boxStart.x);
        const dy = Math.abs(state.boxEnd.y - state.boxStart.y);
        if (dx > 5 || dy > 5) {
          const inRect = unitsInRect(state.boxStart.x, state.boxStart.y, state.boxEnd.x, state.boxEnd.y);
          for (const u of inRect) state.selectedUnitIds.add(u.id);
        }
        state.boxStart = null;
        state.boxEnd = null;
      }
      if (e.button === 2) {
        state._rmbHoldStart = null;
        state._rmbHoldPt = null;
      }
      if (e.button === 2 && state.orderPreview) {
        const order = state.orderPreview;
        const squads = getSelectedSquads();
        const leaderIds = [];
        const squadLogic = getSquadLogicApi();
        if (squadLogic) {
          if (order.type === "move" && state.formationPreview) {
            const fp = state.formationPreview;
            const addWaypoint = e.shiftKey;
            for (const squad of squads) {
              const squadState = getSquadStateFromUnits(squad);
              if (!squadState) continue;
              const leader = squad.find((u) => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
              const fType = leader.formationType || "line";
              const fRows = fp.dragRows != null ? fp.dragRows : (leader.formationRows || 3);
              const pigW = fp.dragWidth != null ? fp.dragWidth : (leader.formationPigWidth ?? 1);
              const baseWaypoints = addWaypoint ? cloneWaypointsSafe(squadState.order?.waypoints) : [];
              baseWaypoints.push({ x: fp.x, y: fp.y });
              squadLogic.setSquadFormation(state, squadState.id, fType, fRows, pigW);
              squadLogic.issueMoveOrder(state, squadState.id, baseWaypoints, fp.angle);
              squadLogic.recalculateFormation(state, squadState.id, { getFormationOffsets }, true);
              leaderIds.push(leader.id);
            }
            if (state._multiSlots && !state._multiIsHost && state._socket) {
              state._socket.emit("playerAction", { type: "move", leaderIds, waypoints: [{ x: fp.x, y: fp.y }], x: fp.x, y: fp.y, angle: fp.angle });
            }
          } else if (order.type === "move" && !state.formationPreview) {
            const addWaypoint = e.shiftKey;
            for (const squad of squads) {
              const squadState = getSquadStateFromUnits(squad);
              if (!squadState) continue;
              const leader = squad.find((u) => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
              const baseWaypoints = addWaypoint ? cloneWaypointsSafe(squadState.order?.waypoints) : [];
              baseWaypoints.push({ x: order.x, y: order.y });
              squadLogic.issueMoveOrder(state, squadState.id, baseWaypoints, Math.atan2(order.y - leader.y, order.x - leader.x));
              leaderIds.push(leader.id);
            }
            if (state._multiSlots && !state._multiIsHost && state._socket) {
              state._socket.emit("playerAction", { type: "move", leaderIds, waypoints: [{ x: order.x, y: order.y }], x: order.x, y: order.y });
            }
          } else if (order.type === "attackUnit") {
            const target = state.units.get(order.targetUnitId);
            if (target) {
              const addWaypoint = e.shiftKey;
              for (const squad of squads) {
                const squadState = getSquadStateFromUnits(squad);
                if (!squadState) continue;
                const leader = squad.find((u) => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
                const baseWaypoints = addWaypoint ? cloneWaypointsSafe(squadState.order?.waypoints) : [];
                if (addWaypoint) baseWaypoints.push({ x: target.x, y: target.y });
                squadLogic.issueAttackUnitOrder(state, squadState.id, target.id, baseWaypoints);
                leaderIds.push(leader.id);
              }
              if (state._multiSlots && !state._multiIsHost && state._socket) {
                state._socket.emit("playerAction", { type: "chase", leaderIds, targetUnitId: target.id, x: target.x, y: target.y });
              }
            }
          } else if (order.type === "focusFire") {
            const target = state.units.get(order.targetUnitId);
            if (target) {
              let usedFocus = false;
              for (const squad of squads) {
                const squadState = getSquadStateFromUnits(squad);
                if (!squadState) continue;
                const leader = squad.find((u) => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
                if (squadState.combat && squadState.combat.mode !== "idle") {
                  squadLogic.setSquadFocusTarget(state, squadState.id, target.id);
                  leaderIds.push(leader.id);
                  usedFocus = true;
                } else {
                  squadLogic.issueAttackUnitOrder(state, squadState.id, target.id, []);
                  leaderIds.push(leader.id);
                }
              }
              if (state._multiSlots && !state._multiIsHost && state._socket) {
                state._socket.emit("playerAction", { type: usedFocus ? "focusFire" : "chase", leaderIds, targetUnitId: target.id, x: target.x, y: target.y });
              }
            }
          } else if (order.type === "attackCity") {
            const city = state.players.get(order.targetCityId);
            if (city) {
              const addWaypoint = e.shiftKey;
              for (const squad of squads) {
                const squadState = getSquadStateFromUnits(squad);
                if (!squadState) continue;
                const leader = squad.find((u) => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
                const baseWaypoints = addWaypoint ? cloneWaypointsSafe(squadState.order?.waypoints) : [];
                baseWaypoints.push({ x: city.x, y: city.y });
                squadLogic.issueSiegeOrder(state, squadState.id, city.id, baseWaypoints);
                leaderIds.push(leader.id);
              }
              if (state._multiSlots && !state._multiIsHost && state._socket) {
                state._socket.emit("playerAction", { type: "chaseCity", leaderIds, targetCityId: city.id, x: city.x, y: city.y });
              }
            }
          } else if (order.type === "attackPirateBase" && state.pirateBase) {
            const addWaypoint = e.shiftKey;
            for (const squad of squads) {
              const squadState = getSquadStateFromUnits(squad);
              if (!squadState) continue;
              const leader = squad.find((u) => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
              const baseWaypoints = addWaypoint ? cloneWaypointsSafe(squadState.order?.waypoints) : [];
              baseWaypoints.push({ x: state.pirateBase.x, y: state.pirateBase.y });
              squadLogic.issuePirateBaseOrder(state, squadState.id, baseWaypoints);
              leaderIds.push(leader.id);
            }
            if (state._multiSlots && !state._multiIsHost && state._socket) {
              state._socket.emit("playerAction", { type: "attackPirateBase", leaderIds, x: state.pirateBase.x, y: state.pirateBase.y });
            }
          } else if (order.type === "capture") {
            const addWaypoint = e.shiftKey;
            for (const squad of squads) {
              const squadState = getSquadStateFromUnits(squad);
              if (!squadState) continue;
              const leader = squad.find((u) => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
              const baseWaypoints = addWaypoint ? cloneWaypointsSafe(squadState.order?.waypoints) : [];
              baseWaypoints.push({ x: order.x, y: order.y });
              squadLogic.issueCaptureOrder(state, squadState.id, order.mineId, { x: order.x, y: order.y }, baseWaypoints);
              leaderIds.push(leader.id);
            }
            if (state._multiSlots && !state._multiIsHost && state._socket) {
              state._socket.emit("playerAction", { type: "move", leaderIds, waypoints: [{ x: order.x, y: order.y }], x: order.x, y: order.y, mineId: order.mineId, capture: true });
            }
          }
          state.formationPreview = null;
          state.orderPreview = null;
          return;
        }
        if (order.type === "move" && state.formationPreview) {
          const fp = state.formationPreview;
          const addWaypoint = e.shiftKey;
          for (const squad of squads) {
            clearSquadCombat(squad);
            const leader = squad.find((u) => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
            const fType = leader.formationType || "line";
            const fRows = fp.dragRows != null ? fp.dragRows : (leader.formationRows || 1);
            const pigW = fp.dragWidth != null ? fp.dragWidth : (leader.formationPigWidth ?? 1);
            const cosA = Math.cos(fp.angle), sinA = Math.sin(fp.angle);
            const offs = getFormationOffsets(squad.length, fType, fRows, cosA, sinA, pigW, squad);
            const fc = getFormationCenter(offs);
            const newPt = { x: fp.x - fc.x, y: fp.y - fc.y };
            const waypoints = addWaypoint ? [...(leader.waypoints || []), newPt] : [newPt];
            leader.targetFormationAngle = fp.angle;
            if (fp.dragRows != null) leader.formationRows = fRows;
            if (fp.dragWidth != null) leader.formationPigWidth = pigW;
            leader.chaseTargetUnitId = undefined;
            leader.chaseTargetCityId = undefined;
            leader._captureTarget = undefined;
            for (const u of squad) {
              u.waypoints = waypoints.map((w) => ({ x: w.x, y: w.y }));
              u.waypointIndex = addWaypoint ? (u.waypointIndex ?? 0) : 0;
              u.straightMode = false;
              u.chaseTargetUnitId = undefined;
              u.chaseTargetCityId = undefined;
            }
            leaderIds.push(leader.id);
          }
          if (state._multiSlots && !state._multiIsHost && state._socket) {
            const firstLeader = state.units.get(leaderIds[0]);
            const waypoints = firstLeader ? firstLeader.waypoints : [{ x: fp.x, y: fp.y }];
            state._socket.emit("playerAction", { type: "move", leaderIds, waypoints, x: fp.x, y: fp.y, angle: fp.angle });
          }
        } else if (order.type === "move" && !state.formationPreview) {
          const addWaypoint = e.shiftKey;
          const wp = { x: order.x, y: order.y };
          for (const squad of squads) {
            clearSquadCombat(squad);
            const leader = squad.find((u) => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
            leader.chaseTargetUnitId = undefined;
            leader.chaseTargetCityId = undefined;
            leader._captureTarget = undefined;
            if (addWaypoint) leader.waypoints = [...(leader.waypoints || []), wp];
            else {
              leader.waypoints = [wp];
              leader.waypointIndex = 0;
            }
            leader.straightMode = false;
            for (const u of squad) {
              u.waypoints = leader.waypoints.map((w) => ({ x: w.x, y: w.y }));
              u.waypointIndex = addWaypoint ? (u.waypointIndex ?? 0) : 0;
              u.straightMode = false;
              u.chaseTargetUnitId = undefined;
              u.chaseTargetCityId = undefined;
            }
            leaderIds.push(leader.id);
          }
          if (state._multiSlots && !state._multiIsHost && state._socket) {
            state._socket.emit("playerAction", { type: "move", leaderIds, waypoints: [wp], x: order.x, y: order.y });
          }
        } else if (order.type === "attackUnit") {
          const target = state.units.get(order.targetUnitId);
          const addWaypoint = e.shiftKey;
          if (target) {
            for (const squad of squads) {
              if (!addWaypoint) clearSquadCombat(squad);
              const leader = squad.find((u) => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
              leader.chaseTargetUnitId = target.id;
              leader.chaseTargetCityId = undefined;
              leader._captureTarget = undefined;
              if (addWaypoint) leader.waypoints = [...(leader.waypoints || []), { x: target.x, y: target.y }];
              else {
                leader.waypoints = [{ x: target.x, y: target.y }];
                leader.waypointIndex = 0;
              }
              leader.straightMode = false;
              leaderIds.push(leader.id);
            }
            if (state._multiSlots && !state._multiIsHost && state._socket) {
              state._socket.emit("playerAction", { type: "chase", leaderIds, targetUnitId: target.id, x: target.x, y: target.y });
            }
          }
        } else if (order.type === "attackCity") {
          const city = state.players.get(order.targetCityId);
          const addWaypoint = e.shiftKey;
          if (city) {
            const minStopR = shieldRadius(city) + 6;
            for (const squad of squads) {
              if (!addWaypoint) clearSquadCombat(squad);
              const leader = squad.find((u) => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
              leader.chaseTargetCityId = city.id;
              leader.chaseTargetUnitId = undefined;
              leader._captureTarget = undefined;
              const stopR = Math.max(getUnitAtkRange(leader) * 0.85, minStopR);
              const ddx = leader.x - city.x, ddy = leader.y - city.y;
              const dl = Math.hypot(ddx, ddy) || 1;
              const wp = { x: city.x + (ddx / dl) * stopR, y: city.y + (ddy / dl) * stopR };
              if (addWaypoint) leader.waypoints = [...(leader.waypoints || []), wp];
              else {
                leader.waypoints = [wp];
                leader.waypointIndex = 0;
              }
              leader.straightMode = false;
              leaderIds.push(leader.id);
            }
            if (state._multiSlots && !state._multiIsHost && state._socket) {
              state._socket.emit("playerAction", { type: "chaseCity", leaderIds, targetCityId: city.id, x: city.x, y: city.y });
            }
          }
        } else if (order.type === "capture") {
          const addWaypoint = e.shiftKey;
          for (const squad of squads) {
            if (!addWaypoint) clearSquadCombat(squad);
            const leader = squad.find((u) => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
            leader.chaseTargetUnitId = undefined;
            leader.chaseTargetCityId = undefined;
            leader._captureTarget = true;
            const capWp = { x: order.x, y: order.y };
            if (addWaypoint) leader.waypoints = [...(leader.waypoints || []), capWp];
            else {
              leader.waypoints = [capWp];
              leader.waypointIndex = 0;
            }
            leader.straightMode = false;
            for (const u of squad) {
              if (addWaypoint) u.waypoints = [...(u.waypoints || []), capWp];
              else {
                u.waypoints = [capWp];
                u.waypointIndex = 0;
              }
              u.straightMode = false;
              u.chaseTargetUnitId = undefined;
              u.chaseTargetCityId = undefined;
            }
            leaderIds.push(leader.id);
          }
          if (state._multiSlots && !state._multiIsHost && state._socket) {
            state._socket.emit("playerAction", { type: "move", leaderIds, waypoints: [{ x: order.x, y: order.y }], x: order.x, y: order.y });
          }
        }
        state.formationPreview = null;
        state.orderPreview = null;
      }
      if (e.button === panState.panBtn) {
        panState.isPanning = false;
        panState.panBtn = 0;
      }
    });

    window.addEventListener("pointermove", (e) => {
      state._mouseScreenX = e.clientX;
      state._mouseScreenY = e.clientY;
      if (state.boxStart && e.buttons === 1 && !state._abilityTargeting) {
        state.boxEnd = screenToWorld(e.clientX, e.clientY);
      }
      if (state._rmbHoldStart && (e.buttons & 2) && !state.formationPreview) {
        const held = performance.now() - state._rmbHoldStart;
        if (held >= 150) {
          const hp = state._rmbHoldPt;
          state.formationPreview = {
            x: hp.x, y: hp.y,
            angle: Math.atan2(hp.y - hp.cy, hp.x - hp.cx),
            startX: hp.screenX, startY: hp.screenY,
            dragRows: null, dragWidth: null
          };
          state._rmbHoldStart = null;
          state._rmbHoldPt = null;
        }
      }
      if (state.formationPreview && (e.buttons & 2)) {
        const w = screenToWorld(e.clientX, e.clientY);
        const fp = state.formationPreview;
        fp.angle = Math.atan2(w.y - fp.y, w.x - fp.x);
        const screenDx = e.clientX - fp.startX;
        const screenDy = e.clientY - fp.startY;
        const dragDist = Math.hypot(screenDx, screenDy);
        if (dragDist > 20) {
          const cosA = Math.cos(fp.angle), sinA = Math.sin(fp.angle);
          const along = Math.abs(screenDx * cosA + screenDy * sinA);
          const perp = Math.abs(-screenDx * sinA + screenDy * cosA);
          fp.dragRows = Math.max(1, Math.min(10, Math.round(along / 40)));
          fp.dragWidth = Math.max(0.8, Math.min(3, 0.8 + perp / 80));
        }
      }
      if (panState.isPanning) {
        const dx = e.clientX - panState.lastX;
        const dy = e.clientY - panState.lastY;
        panState.lastX = e.clientX;
        panState.lastY = e.clientY;
        cam.x += dx;
        cam.y += dy;
        applyCamera();
      }
      const pt = screenToWorld(e.clientX, e.clientY);
      const enemyU = unitAtWorldAny(pt.x, pt.y);
      const enemyC = cityAtWorld(pt.x, pt.y);
      const isEnemyUnit = enemyU && enemyU.owner !== state.myPlayerId;
      const isEnemyCity = enemyC && enemyC.id !== state.myPlayerId;
      app.canvas.style.cursor = (isEnemyUnit || isEnemyCity) ? "crosshair" : "default";
      state._hoverTarget = isEnemyUnit ? enemyU : (isEnemyCity ? enemyC : null);
      state._hoverWorld = pt;
      let attackCursorEl = document.getElementById("attackCursorEmoji");
      if (!attackCursorEl) {
        attackCursorEl = document.createElement("div");
        attackCursorEl.id = "attackCursorEmoji";
        attackCursorEl.style.cssText = "position:fixed;pointer-events:none;z-index:9999;font-size:28px;text-shadow:0 0 4px #000, 0 0 8px #000;";
        document.body.appendChild(attackCursorEl);
      }
      if (state.selectedUnitIds.size > 0 && state._hoverTarget) {
        attackCursorEl.textContent = "⚔️";
        attackCursorEl.style.display = "block";
        attackCursorEl.style.left = (e.clientX - 14) + "px";
        attackCursorEl.style.top = (e.clientY - 36) + "px";
      } else {
        attackCursorEl.style.display = "none";
      }
    });

    app.canvas.addEventListener("pointerleave", () => {
      if (state.boxStart) {
        state.boxStart = null;
        state.boxEnd = null;
      }
      state._rmbHoldStart = null;
      state._rmbHoldPt = null;
      if (state.formationPreview) state.formationPreview = null;
      if (state.orderPreview) state.orderPreview = null;
      const attackCursorEl = document.getElementById("attackCursorEmoji");
      if (attackCursorEl) attackCursorEl.style.display = "none";
    });

    return {
      unitsInRect,
      getSelectedSquads,
      updatePathPreview,
      describeOrderPreview
    };
  }

  const api = { install };
  if (typeof window !== "undefined") window.SelectionAndOrders = api;
  if (typeof module !== "undefined") module.exports = api;
})();
