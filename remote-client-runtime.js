(function () {
  "use strict";

  function install(deps) {
    const {
      state,
      NET,
      CFG,
      netPing,
      matchSession,
      applyGameState,
      rebuildZoneGrid,
      updateUnitVisualsOnly,
      stepBulletsVisual,
      stepMineGemsRemote,
      stepMineGems,
      inView,
      refreshResourceVisual
    } = deps;

    function step(dt) {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const interpMs = Math.max(
        NET.SEND_INTERVAL_MS,
        state._lastRemoteSnapIntervalMs || netPing.getInterpDurationMs()
      );
      const renderDelayMs = Math.max(
        NET.SEND_INTERVAL_MS * 1.5,
        Math.min(120, interpMs * 1.5)
      );
      const nextSnap = matchSession && matchSession.consumePendingSnapshot
        ? matchSession.consumePendingSnapshot({
          now,
          cadenceMs: Math.max(8, interpMs * 0.9),
          bufferLeadMs: renderDelayMs,
          maxHoldMs: Math.max(renderDelayMs * 1.75, NET.SEND_INTERVAL_MS * 3)
        })
        : (state._pendingFullSnap || state._pendingSnap || null);
      if (nextSnap) {
        applyGameState(nextSnap);
        if (!matchSession || !matchSession.consumePendingSnapshot) {
          state._pendingFullSnap = null;
          state._pendingSnap = null;
        }
      }

      if (state._frameCtr % 4 === 0) rebuildZoneGrid();

      for (const u of state.units.values()) {
        NET.Interp.tickUnit(u, interpMs);
      }
      updateUnitVisualsOnly();

      // Simulate bullets visually between zone syncs.
      stepBulletsVisual(dt);

      stepMineGemsRemote(dt);
      stepMineGems(dt);

      NET.Interp.tickStorm(state.storm, interpMs);

      const numRays = CFG.TERRAIN_RAYS ?? 96;
      for (const pl of state.players.values()) {
        NET.Interp.tickZoneRays(pl, numRays, NET.ZONE_SYNC_INTERVAL_MS);
        if (pl.influenceRayDistances && pl.influenceRayDistances.length === numRays) {
          if (!pl._polyBuf || pl._polyBuf.length !== numRays) {
            pl._polyBuf = [];
            for (let i = 0; i < numRays; i++) pl._polyBuf.push({ x: 0, y: 0 });
          }
          for (let i = 0; i < numRays; i++) {
            const angle = (i / numRays) * Math.PI * 2;
            const d = pl.influenceRayDistances[i] ?? 0;
            pl._polyBuf[i].x = pl.x + Math.cos(angle) * d;
            pl._polyBuf[i].y = pl.y + Math.sin(angle) * d;
          }
          pl.influencePolygon = pl._polyBuf;
          if (pl._lastZoneHash !== undefined) pl._lastZoneHash = null;
        }
      }

      for (const r of state.res.values()) {
        NET.Interp.tickRes(r, NET.ZONE_SYNC_INTERVAL_MS, state.players);
        if (r.gfx) {
          r.gfx.visible = inView(r.x, r.y);
          if (r.gfx.visible) {
            r.gfx.position.set(r.x, r.y);
            if (typeof refreshResourceVisual === "function") refreshResourceVisual(r, r._visualVx || 0, r._visualVy || 0);
          }
        }
      }
    }

    return { step };
  }

  const api = { install };
  if (typeof window !== "undefined") window.RemoteClientRuntime = api;
  if (typeof module !== "undefined") module.exports = api;
})();
