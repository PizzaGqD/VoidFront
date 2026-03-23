(function () {
  "use strict";

  function install(deps) {
    const state = deps && deps.state;
    const serializeGameState = deps && deps.serializeGameState;
    const applyGameState = deps && deps.applyGameState;
    const getSocketActionDispatchApi = deps && deps.getSocketActionDispatchApi;

    function getMode() {
      return (state && state._authorityMode) || "host-client";
    }

    function isServerAuthority() {
      return getMode() === "server";
    }

    function isHostAuthority() {
      if (isServerAuthority()) return false;
      return !!(state && state._multiIsHost);
    }

    function isRemoteGameplayClient() {
      if (!(state && state._multiSlots)) return false;
      return !isHostAuthority();
    }

    function serializeSnapshot() {
      return typeof serializeGameState === "function" ? serializeGameState() : null;
    }

    function applySnapshot(snap) {
      return typeof applyGameState === "function" ? applyGameState(snap) : null;
    }

    function handleRemoteAction(action) {
      const api = typeof getSocketActionDispatchApi === "function"
        ? getSocketActionDispatchApi()
        : null;
      if (api && typeof api.handlePlayerAction === "function") {
        api.handlePlayerAction(action);
      }
    }

    return {
      getMode,
      isServerAuthority,
      isHostAuthority,
      isRemoteGameplayClient,
      serializeSnapshot,
      applySnapshot,
      handleRemoteAction
    };
  }

  const api = { install };
  if (typeof window !== "undefined") window.AuthorityAdapter = api;
  if (typeof module !== "undefined") module.exports = api;
})();
