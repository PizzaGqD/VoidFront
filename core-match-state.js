(function () {
  "use strict";

  function install(deps) {
    const state = deps && deps.state;

    function ensureNamespaces() {
      if (!state) return null;
      state._coreMatch = state._coreMatch || {
        current: null,
        lastResult: null
      };
      state._uiState = state._uiState || {
        screen: "mainMenu"
      };
      return state._coreMatch;
    }

    function setScreen(screenId) {
      ensureNamespaces();
      state._uiState.screen = screenId || "mainMenu";
      return state._uiState.screen;
    }

    function beginMatch(config) {
      const core = ensureNamespaces();
      const payload = config || {};
      core.current = {
        mode: payload.mode || "duel",
        difficulty: payload.difficulty || "easy",
        seed: payload.seed != null ? payload.seed : null,
        botCount: payload.botCount != null ? payload.botCount : 1,
        playerId: payload.playerId != null ? payload.playerId : 1,
        startedAtMs: Date.now(),
        startedAtSimTime: state && typeof state.t === "number" ? state.t : 0,
        outcome: null
      };
      return { ...core.current };
    }

    function getCurrentMatch() {
      const core = ensureNamespaces();
      return core.current ? { ...core.current } : null;
    }

    function getCurrentDurationSec(nowMs) {
      const core = ensureNamespaces();
      if (!core.current || core.current.startedAtMs == null) return 0;
      return Math.max(0, Math.round(((nowMs != null ? nowMs : Date.now()) - core.current.startedAtMs) / 1000));
    }

    function finishMatch(outcome, details) {
      const core = ensureNamespaces();
      const payload = details || {};
      const current = core.current || {
        mode: payload.mode || "duel",
        difficulty: payload.difficulty || "easy",
        startedAtMs: Date.now(),
        startedAtSimTime: 0
      };
      const summary = {
        ...current,
        outcome: outcome || "defeat",
        finishedAtMs: Date.now(),
        durationSec: payload.durationSec != null ? payload.durationSec : getCurrentDurationSec(Date.now()),
        reason: payload.reason || "",
        economy: payload.economy || null,
        rewards: payload.rewards || null
      };
      core.current = { ...current, outcome: summary.outcome };
      core.lastResult = summary;
      return { ...summary };
    }

    function getLastResult() {
      const core = ensureNamespaces();
      return core.lastResult ? { ...core.lastResult } : null;
    }

    ensureNamespaces();

    return {
      ensureNamespaces,
      setScreen,
      beginMatch,
      finishMatch,
      getCurrentMatch,
      getCurrentDurationSec,
      getLastResult
    };
  }

  const api = { install };
  if (typeof window !== "undefined") window.CoreMatchState = api;
  if (typeof module !== "undefined") module.exports = api;
})();
