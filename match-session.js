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
    const multiplayerDefaults = {
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
      snapshotQueue: [],
      snapshotStats: null,
      pendingFullSnap: null,
      pendingSnap: null
    };
    const multiplayer = state._multiplayer = Object.assign(
      {},
      multiplayerDefaults,
      state._multiplayer || {}
    );

    function makeSnapshotStats() {
      return {
        received: 0,
        applied: 0,
        dropped: 0,
        fullReceived: 0,
        deltaReceived: 0,
        queuePeak: 0,
        queueLength: 0,
        lastReceivedSeq: null,
        lastAppliedSeq: null,
        seqGap: 0,
        lastReceiveAt: null,
        lastAppliedAt: null,
        lastArrivalGapMs: null,
        lastBufferLeadMs: null,
        lastHeadAgeMs: null
      };
    }

    multiplayer.snapshotQueue = Array.isArray(multiplayer.snapshotQueue) ? multiplayer.snapshotQueue : [];
    multiplayer.snapshotStats = multiplayer.snapshotStats || makeSnapshotStats();

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
      state._snapshotQueueLength = multiplayer.snapshotQueue.length;
      state._snapshotStats = multiplayer.snapshotStats;
      state._pendingFullSnap = multiplayer.pendingFullSnap;
      state._pendingSnap = multiplayer.pendingSnap;
      if (typeof updateMultiHostOnlyControls === "function") updateMultiHostOnlyControls();
    }

    function clearSnapshotPipeline() {
      multiplayer.snapshotQueue = [];
      multiplayer.snapshotStats = makeSnapshotStats();
      multiplayer.pendingFullSnap = null;
      multiplayer.pendingSnap = null;
    }

    function resetSnapshots() {
      clearSnapshotPipeline();
      syncLegacyFields();
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
      clearSnapshotPipeline();
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
      clearSnapshotPipeline();
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
      const now = snap._arrivalAt != null
        ? snap._arrivalAt
        : (typeof performance !== "undefined" ? performance.now() : Date.now());
      const stats = multiplayer.snapshotStats || (multiplayer.snapshotStats = makeSnapshotStats());
      stats.received += 1;
      if (snap._fullSync) stats.fullReceived += 1;
      else stats.deltaReceived += 1;
      if (stats.lastReceivedSeq != null && snap._seq != null && snap._seq > stats.lastReceivedSeq + 1) {
        stats.seqGap += (snap._seq - stats.lastReceivedSeq - 1);
      }
      if (stats.lastReceiveAt != null) stats.lastArrivalGapMs = now - stats.lastReceiveAt;
      stats.lastReceivedSeq = snap._seq ?? stats.lastReceivedSeq;
      stats.lastReceiveAt = now;
      if (snap._fullSync) {
        multiplayer.snapshotQueue = [{ snap, arrivalAt: now, full: true, seq: snap._seq ?? null }];
        multiplayer.pendingFullSnap = snap;
        multiplayer.pendingSnap = null;
      } else {
        multiplayer.snapshotQueue.push({ snap, arrivalAt: now, full: false, seq: snap._seq ?? null });
        multiplayer.pendingSnap = snap;
        while (multiplayer.snapshotQueue.length > 8) {
          multiplayer.snapshotQueue.shift();
          stats.dropped += 1;
        }
      }
      stats.queueLength = multiplayer.snapshotQueue.length;
      if (stats.queueLength > stats.queuePeak) stats.queuePeak = stats.queueLength;
      syncLegacyFields();
    }

    function consumePendingSnapshot(options) {
      const opts = options || {};
      const stats = multiplayer.snapshotStats || (multiplayer.snapshotStats = makeSnapshotStats());
      if (!multiplayer.snapshotQueue.length) return null;
      const now = opts.now != null ? opts.now : (typeof performance !== "undefined" ? performance.now() : Date.now());
      const cadenceMs = Math.max(1, opts.cadenceMs != null ? opts.cadenceMs : 33);
      const bufferLeadMs = Math.max(0, opts.bufferLeadMs != null ? opts.bufferLeadMs : 0);
      const maxHoldMs = Math.max(cadenceMs, opts.maxHoldMs != null ? opts.maxHoldMs : Math.max(cadenceMs * 2, bufferLeadMs * 2));
      const head = multiplayer.snapshotQueue[0];
      const headAgeMs = Math.max(0, now - (head.arrivalAt != null ? head.arrivalAt : now));
      const elapsedSinceApply = stats.lastAppliedAt != null ? (now - stats.lastAppliedAt) : Infinity;
      const hasAppliedBefore = stats.applied > 0;
      const shouldApply = !!head.full
        || !!opts.force
        || multiplayer.snapshotQueue.length > 2
        || (
          !hasAppliedBefore
            ? headAgeMs >= Math.min(bufferLeadMs, cadenceMs)
            : (
                headAgeMs >= maxHoldMs
                || (multiplayer.snapshotQueue.length > 1 && (elapsedSinceApply >= cadenceMs * 0.75 || headAgeMs >= bufferLeadMs))
                || (elapsedSinceApply >= cadenceMs && headAgeMs >= bufferLeadMs)
              )
        );
      if (!shouldApply) return null;
      const next = multiplayer.snapshotQueue.shift();
      let snap = next ? next.snap : null;
      multiplayer.pendingFullSnap = null;
      multiplayer.pendingSnap = null;
      for (const entry of multiplayer.snapshotQueue) {
        if (entry.full) multiplayer.pendingFullSnap = entry.snap;
        else multiplayer.pendingSnap = entry.snap;
      }
      if (snap) {
        stats.applied += 1;
        stats.lastAppliedSeq = next.seq;
        stats.lastAppliedAt = now;
      }
      stats.lastBufferLeadMs = bufferLeadMs;
      stats.lastHeadAgeMs = headAgeMs;
      stats.queueLength = multiplayer.snapshotQueue.length;
      syncLegacyFields();
      return snap;
    }

    function getNetDebugStats() {
      const stats = multiplayer.snapshotStats || makeSnapshotStats();
      return {
        ...stats,
        matchId: multiplayer.matchId,
        matchType: multiplayer.matchType,
        roomId: multiplayer.roomId,
        queueLength: multiplayer.snapshotQueue.length
      };
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
      resetSnapshots,
      setPendingSnapshot,
      consumePendingSnapshot,
      getNetDebugStats,
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
