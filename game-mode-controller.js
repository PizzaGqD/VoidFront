(function () {
  "use strict";

  function install(deps) {
    const state = deps && deps.state;
    const stopMenuBackdropBattle = deps && deps.stopMenuBackdropBattle;
    const matchSession = deps && deps.matchSession;

    function enterSinglePlayer() {
      if (typeof stopMenuBackdropBattle === "function") stopMenuBackdropBattle();
      if (matchSession && typeof matchSession.resetForSinglePlayer === "function") {
        matchSession.resetForSinglePlayer();
      }
      state._authorityMode = "local";
      state._runsAuthoritativeSim = false;
      state._gameSeed = null;
      state._multiIsHost = false;
      state._multiSlots = null;
      state._slotToPid = null;
      state._remoteSnapshotClock = null;
      state._lastRemoteSnapIntervalMs = null;
      state._pendingFullSnap = null;
      state._pendingSnap = null;
    }

    function enterMultiplayerMatch(context) {
      const data = context || {};
      const authorityMode = data.authorityMode || state._authorityMode || "host-client";
      const runsAuthoritativeSim = authorityMode === "host-client" ? !!(data.isHost != null ? data.isHost : state._isHost) : false;
      if (typeof stopMenuBackdropBattle === "function") stopMenuBackdropBattle();
      if (matchSession && typeof matchSession.beginMatch === "function") {
        matchSession.beginMatch({
          ...data,
          authorityMode,
          runsAuthoritativeSim
        });
      }
      state._authorityMode = authorityMode;
      state._runsAuthoritativeSim = runsAuthoritativeSim;
      state._multiIsHost = runsAuthoritativeSim;
      state._multiSlots = data.slots || null;
      state._slotToPid = data.slotToPid || null;
      state._remoteSnapshotClock = null;
      state._lastRemoteSnapIntervalMs = null;
      state._pendingFullSnap = null;
      state._pendingSnap = null;
    }

    return {
      enterSinglePlayer,
      enterMultiplayerMatch
    };
  }

  const api = { install };
  if (typeof window !== "undefined") window.GameModeController = api;
  if (typeof module !== "undefined") module.exports = api;
})();
