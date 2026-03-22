(function () {
  "use strict";

  function safeGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (_) {
      // Ignore storage failures and keep session in memory.
    }
  }

  function safeRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (_) {
      // Ignore storage failures.
    }
  }

  function install(options) {
    const opts = options || {};
    const prefix = opts.storagePrefix || "voidfront";
    const sessionKey = prefix + ".sessionAuth";
    let platformId = (typeof window !== "undefined" && window.YaGames) ? "yandex-games" : "web-default";
    let lastSessionAuth = null;

    function init() {
      if (typeof window !== "undefined" && window.YaGames) {
        platformId = "yandex-games";
      }
      return Promise.resolve({ platformId });
    }

    function getServerUrl() {
      if (typeof window === "undefined" || typeof location === "undefined") return "";
      return window.GAME_SERVER_URL || location.origin;
    }

    function getSessionAuth() {
      if (lastSessionAuth) return { ...lastSessionAuth };
      const raw = safeGet(sessionKey);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        if (!parsed.sessionId || !parsed.reconnectToken) return null;
        lastSessionAuth = parsed;
        return { ...parsed };
      } catch (_) {
        return null;
      }
    }

    function saveSessionAuth(auth) {
      if (!auth || !auth.sessionId || !auth.reconnectToken) return null;
      const normalized = {
        sessionId: String(auth.sessionId),
        reconnectToken: String(auth.reconnectToken),
        nickname: auth.nickname ? String(auth.nickname) : null
      };
      lastSessionAuth = normalized;
      safeSet(sessionKey, JSON.stringify(normalized));
      return { ...normalized };
    }

    function clearSessionAuth() {
      lastSessionAuth = null;
      safeRemove(sessionKey);
    }

    return {
      init,
      getPlatformId: function () { return platformId; },
      isYandexGames: function () { return platformId === "yandex-games"; },
      getServerUrl,
      getSessionAuth,
      saveSessionAuth,
      clearSessionAuth
    };
  }

  const api = { install };
  if (typeof window !== "undefined") window.PlatformAdapter = api;
  if (typeof module !== "undefined") module.exports = api;
})();
