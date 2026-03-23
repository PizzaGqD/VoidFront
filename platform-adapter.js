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

  function getRuntimeConfig() {
    if (typeof window === "undefined") return {};
    return window.__VOIDFRONT_RUNTIME_CONFIG || {};
  }

  function getQueryFlag(name) {
    if (typeof window === "undefined" || typeof location === "undefined") return false;
    try {
      return new URLSearchParams(location.search).get(name) === "1";
    } catch (_) {
      return false;
    }
  }

  function shouldUseYandexSdk() {
    if (typeof window === "undefined" || typeof location === "undefined") return false;
    const runtimeConfig = getRuntimeConfig();
    if (runtimeConfig.yandexSdkEnabled === false || getQueryFlag("disableYandexSdk")) return false;
    if (runtimeConfig.forceYandexSdk === true || getQueryFlag("forceYandexSdk")) return true;
    const host = String(location.hostname || "");
    const referrer = typeof document !== "undefined" ? String(document.referrer || "") : "";
    if (typeof window.YandexGamesSDKEnvironment !== "undefined") return true;
    if (/yandex\./i.test(host) || /yandex\./i.test(referrer)) return true;
    return false;
  }

  function loadYandexSdkScript() {
    if (typeof window === "undefined" || typeof document === "undefined") return Promise.resolve(null);
    if (window.YaGames) return Promise.resolve(window.YaGames);
    if (window.__voidfrontYandexSdkPromise) return window.__voidfrontYandexSdkPromise;
    window.__voidfrontYandexSdkPromise = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = "https://yandex.ru/games/sdk/v2";
      script.async = true;
      script.onload = function () {
        resolve(window.YaGames || null);
      };
      script.onerror = function () {
        reject(new Error("Failed to load Yandex Games SDK"));
      };
      document.head.appendChild(script);
    });
    return window.__voidfrontYandexSdkPromise;
  }

  function install(options) {
    const opts = options || {};
    const prefix = opts.storagePrefix || "voidfront";
    const sessionKey = prefix + ".sessionAuth";
    let platformId = "web-default";
    let lastSessionAuth = null;
    let ysdk = null;
    let ysdkInitPromise = null;
    let lifecycleHandlers = {
      pause: function () {},
      resume: function () {}
    };

    async function init() {
      if (shouldUseYandexSdk()) {
        try {
          await loadYandexSdkScript();
        } catch (err) {
          console.warn("[Platform] Yandex SDK load failed:", err && err.message ? err.message : err);
          return { platformId, ysdk: null };
        }
      }
      if (typeof window !== "undefined" && window.YaGames) {
        platformId = "yandex-games";
        if (!ysdkInitPromise) {
          ysdkInitPromise = window.YaGames.init()
            .then(function (instance) {
              ysdk = instance || null;
              return { platformId, ysdk };
            })
            .catch(function (err) {
              console.warn("[Platform] YaGames.init failed:", err && err.message ? err.message : err);
              ysdk = null;
              return { platformId, ysdk: null };
            });
        }
        return ysdkInitPromise;
      }
      return { platformId, ysdk: null };
    }

    function getServerUrl() {
      if (typeof window === "undefined" || typeof location === "undefined") return "";
      const runtimeConfig = getRuntimeConfig();
      return runtimeConfig.serverUrl || window.GAME_SERVER_URL || location.origin;
    }

    function getAuthorityMode() {
      const runtimeConfig = getRuntimeConfig();
      return runtimeConfig.authorityMode || "host-client";
    }

    function setLifecycleHandlers(handlers) {
      lifecycleHandlers = {
        pause: handlers && typeof handlers.pause === "function" ? handlers.pause : function () {},
        resume: handlers && typeof handlers.resume === "function" ? handlers.resume : function () {}
      };
    }

    function pauseGameplay(reason) {
      try { lifecycleHandlers.pause(reason || "platform"); } catch (_) {}
    }

    function resumeGameplay(reason) {
      try { lifecycleHandlers.resume(reason || "platform"); } catch (_) {}
    }

    function getSdk() {
      return ysdk;
    }

    async function markGameReady() {
      if (!ysdk) return false;
      try {
        if (ysdk.features && ysdk.features.LoadingAPI && typeof ysdk.features.LoadingAPI.ready === "function") {
          await ysdk.features.LoadingAPI.ready();
          return true;
        }
      } catch (err) {
        console.warn("[Platform] LoadingAPI.ready failed:", err && err.message ? err.message : err);
      }
      return false;
    }

    function showFullscreenAd(callbacks) {
      if (!ysdk || !ysdk.adv || typeof ysdk.adv.showFullscreenAdv !== "function") {
        if (callbacks && typeof callbacks.onClose === "function") callbacks.onClose(false);
        return false;
      }
      ysdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: function () {
            pauseGameplay("fullscreen-ad");
            if (callbacks && typeof callbacks.onOpen === "function") callbacks.onOpen();
          },
          onClose: function (wasShown) {
            resumeGameplay("fullscreen-ad");
            if (callbacks && typeof callbacks.onClose === "function") callbacks.onClose(!!wasShown);
          },
          onError: function (error) {
            resumeGameplay("fullscreen-ad");
            if (callbacks && typeof callbacks.onError === "function") callbacks.onError(error);
          }
        }
      });
      return true;
    }

    function showRewardedAd(callbacks) {
      if (!ysdk || !ysdk.adv || typeof ysdk.adv.showRewardedVideo !== "function") {
        if (callbacks && typeof callbacks.onClose === "function") callbacks.onClose(false);
        return false;
      }
      ysdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: function () {
            pauseGameplay("rewarded-ad");
            if (callbacks && typeof callbacks.onOpen === "function") callbacks.onOpen();
          },
          onRewarded: function () {
            if (callbacks && typeof callbacks.onRewarded === "function") callbacks.onRewarded();
          },
          onClose: function () {
            resumeGameplay("rewarded-ad");
            if (callbacks && typeof callbacks.onClose === "function") callbacks.onClose(true);
          },
          onError: function (error) {
            resumeGameplay("rewarded-ad");
            if (callbacks && typeof callbacks.onError === "function") callbacks.onError(error);
          }
        }
      });
      return true;
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
      getAuthorityMode,
      getSdk,
      setLifecycleHandlers,
      pauseGameplay,
      resumeGameplay,
      markGameReady,
      showFullscreenAd,
      showRewardedAd,
      getSessionAuth,
      saveSessionAuth,
      clearSessionAuth
    };
  }

  const api = { install };
  if (typeof window !== "undefined") window.PlatformAdapter = api;
  if (typeof module !== "undefined") module.exports = api;
})();
