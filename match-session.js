(function () {
  "use strict";

  function inferMatchType(slots) {
    const occupied = Array.isArray(slots)
      ? slots.filter((slot) => slot && (slot.id || slot.isBot)).length
      : 0;
    return occupied >= 4 ? "ffa4" : "duel";
  }

  function install(deps) {
    const state = deps && deps.state;
    const updateMultiHostOnlyControls = deps && deps.updateMultiHostOnlyControls;
    const multiplayer = state._multiplayer = state._multiplayer || {
      roomId: null,
      matchId: null,
      matchType: null,
      queueStatus: null,
      slots: null,
      mySlot: null,
      hostSlot: null,
      isHost: false,
      sessionId: null,
      reconnectToken: null,
      pendingFullSnap: null,
      pendingSnap: null
    };

    function syncLegacyFields() {
      state._roomId = multiplayer.roomId;
      state._matchId = multiplayer.matchId;
      state._matchType = multiplayer.matchType;
      state._queueStatus = multiplayer.queueStatus;
      state._lobbySlots = multiplayer.slots || state._lobbySlots || [];
      state._multiSlots = multiplayer.slots;
      state._mySlot = multiplayer.mySlot;
      state._hostSlot = multiplayer.hostSlot;
      state._isHost = multiplayer.isHost;
      state._multiIsHost = multiplayer.isHost;
      state._sessionId = multiplayer.sessionId;
      state._reconnectToken = multiplayer.reconnectToken;
      state._pendingFullSnap = multiplayer.pendingFullSnap;
      state._pendingSnap = multiplayer.pendingSnap;
      if (typeof updateMultiHostOnlyControls === "function") updateMultiHostOnlyControls();
    }

    function applyRoomSnapshot(payload) {
      const data = Array.isArray(payload) ? { slots: payload } : (payload || {});
      multiplayer.slots = Array.isArray(data.slots) ? data.slots : [];
      multiplayer.hostSlot = Number.isInteger(data.hostSlot) ? data.hostSlot : multiplayer.hostSlot;
      if (multiplayer.mySlot != null && multiplayer.hostSlot != null && multiplayer.hostSlot >= 0) {
        multiplayer.isHost = multiplayer.hostSlot === multiplayer.mySlot;
      }
      if (!multiplayer.matchType) multiplayer.matchType = inferMatchType(multiplayer.slots);
      syncLegacyFields();
      return multiplayer.slots;
    }

    function updateLobbyContext(data) {
      const payload = data || {};
      multiplayer.roomId = payload.roomId || multiplayer.roomId;
      if (payload.matchId) multiplayer.matchId = payload.matchId;
      if (payload.matchType) multiplayer.matchType = payload.matchType;
      if (Number.isInteger(payload.mySlot)) multiplayer.mySlot = payload.mySlot;
      if (typeof payload.isHost === "boolean") multiplayer.isHost = payload.isHost;
      if (Number.isInteger(payload.hostSlot)) multiplayer.hostSlot = payload.hostSlot;
      if (Array.isArray(payload.slots)) multiplayer.slots = payload.slots;
      if (!multiplayer.matchType) multiplayer.matchType = inferMatchType(multiplayer.slots);
      syncLegacyFields();
    }

    function beginMatch(payload) {
      const data = payload || {};
      multiplayer.roomId = data.roomId || multiplayer.roomId;
      multiplayer.matchId = data.matchId || multiplayer.matchId || ("room:" + (multiplayer.roomId || "local"));
      multiplayer.matchType = data.matchType || multiplayer.matchType || inferMatchType(data.slots || multiplayer.slots);
      multiplayer.slots = Array.isArray(data.slots) ? data.slots : (multiplayer.slots || []);
      if (Number.isInteger(data.mySlot)) multiplayer.mySlot = data.mySlot;
      if (Number.isInteger(data.hostSlot)) multiplayer.hostSlot = data.hostSlot;
      if (typeof data.isHost === "boolean") multiplayer.isHost = data.isHost;
      multiplayer.pendingFullSnap = null;
      multiplayer.pendingSnap = null;
      syncLegacyFields();
      return {
        roomId: multiplayer.roomId,
        matchId: multiplayer.matchId,
        matchType: multiplayer.matchType,
        slots: multiplayer.slots,
        mySlot: multiplayer.mySlot,
        isHost: multiplayer.isHost
      };
    }

    function resetForSinglePlayer() {
      multiplayer.roomId = null;
      multiplayer.matchId = null;
      multiplayer.matchType = null;
      multiplayer.queueStatus = null;
      multiplayer.slots = null;
      multiplayer.mySlot = null;
      multiplayer.hostSlot = null;
      multiplayer.isHost = false;
      multiplayer.pendingFullSnap = null;
      multiplayer.pendingSnap = null;
      syncLegacyFields();
    }

    function setQueueStatus(status) {
      multiplayer.queueStatus = status || null;
      syncLegacyFields();
      return multiplayer.queueStatus;
    }

    function clearQueueStatus() {
      multiplayer.queueStatus = null;
      syncLegacyFields();
    }

    function setPendingSnapshot(snap) {
      if (!snap) return;
      if (snap._fullSync) multiplayer.pendingFullSnap = snap;
      else multiplayer.pendingSnap = snap;
      syncLegacyFields();
    }

    function consumePendingSnapshot() {
      let snap = null;
      if (multiplayer.pendingFullSnap) {
        snap = multiplayer.pendingFullSnap;
        multiplayer.pendingFullSnap = null;
        multiplayer.pendingSnap = null;
      } else if (multiplayer.pendingSnap) {
        snap = multiplayer.pendingSnap;
        multiplayer.pendingSnap = null;
      }
      syncLegacyFields();
      return snap;
    }

    function setSessionAuth(auth) {
      if (!auth) return;
      if (auth.sessionId) multiplayer.sessionId = auth.sessionId;
      if (auth.reconnectToken) multiplayer.reconnectToken = auth.reconnectToken;
      syncLegacyFields();
    }

    function getSessionAuth() {
      if (!multiplayer.sessionId || !multiplayer.reconnectToken) return null;
      return {
        sessionId: multiplayer.sessionId,
        reconnectToken: multiplayer.reconnectToken
      };
    }

    function isRemoteGameplayClient() {
      return !!(multiplayer.slots && !multiplayer.isHost);
    }

    syncLegacyFields();

    return {
      inferMatchType,
      applyRoomSnapshot,
      updateLobbyContext,
      beginMatch,
      resetForSinglePlayer,
      setQueueStatus,
      clearQueueStatus,
      setPendingSnapshot,
      consumePendingSnapshot,
      setSessionAuth,
      getSessionAuth,
      isRemoteGameplayClient,
      getState: function () { return multiplayer; }
    };
  }

  const api = { install };
  if (typeof window !== "undefined") window.MatchSession = api;
  if (typeof module !== "undefined") module.exports = api;
})();
