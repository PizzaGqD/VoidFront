(function () {
  "use strict";

  if (typeof window === "undefined") return;

  const existing = window.__VOIDFRONT_RUNTIME_CONFIG || {};
  window.__VOIDFRONT_RUNTIME_CONFIG = {
    serverUrl: existing.serverUrl || null,
    authorityMode: existing.authorityMode || "host-client",
    releaseChannel: existing.releaseChannel || "local",
    enableDebugTools: existing.enableDebugTools !== false,
    enablePerfHud: existing.enablePerfHud !== false,
    enableTestUi: existing.enableTestUi !== false,
    yandexSdkEnabled: existing.yandexSdkEnabled === true
  };
})();
