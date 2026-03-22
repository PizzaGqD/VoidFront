(function () {
  "use strict";

  function install(deps) {
    const state = deps && deps.state;

    function ensureNamespaces() {
      if (!state) return null;
      state._app = state._app || {};
      state._multiplayer = state._multiplayer || {};
      return state._app;
    }

    function installRuntime(runtimeGlobal, runtimeDeps) {
      if (!runtimeGlobal || typeof runtimeGlobal.install !== "function") return null;
      return runtimeGlobal.install(runtimeDeps);
    }

    function requireRuntime(api, runtimeName) {
      if (!api) throw new Error((runtimeName || "Runtime") + " is unavailable");
      return api;
    }

    ensureNamespaces();

    return {
      ensureNamespaces,
      installRuntime,
      requireRuntime
    };
  }

  const api = { install };
  if (typeof window !== "undefined") window.AppBootstrap = api;
  if (typeof module !== "undefined") module.exports = api;
})();
