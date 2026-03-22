(function () {
  "use strict";

  const CRASH_STORAGE_KEY = "voidfront:lastCrashReport";
  const MAX_LOG_ENTRIES = 80;

  function readStoredReport() {
    try {
      const raw = window.localStorage ? window.localStorage.getItem(CRASH_STORAGE_KEY) : null;
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeStoredReport(report) {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(CRASH_STORAGE_KEY, JSON.stringify(report));
    } catch (_) {
      // ignore storage failures
    }
  }

  function install(deps) {
    const state = deps && deps.state;
    const matchSession = deps && deps.matchSession;
    const netPing = deps && deps.netPing;
    const netEl = deps && deps.netEl;
    const fpsEl = deps && deps.fpsEl;
    const locationHref = typeof location !== "undefined" ? location.href : "";

    state._runtimeLogBuffer = Array.isArray(state._runtimeLogBuffer) ? state._runtimeLogBuffer : [];

    let netDebugEl = document.getElementById("netDebug");
    if (!netDebugEl && fpsEl && fpsEl.parentNode) {
      netDebugEl = document.createElement("div");
      netDebugEl.id = "netDebug";
      netDebugEl.className = "pill";
      netDebugEl.style.opacity = "0.85";
      netDebugEl.style.fontSize = "11px";
      netDebugEl.style.maxWidth = "360px";
      netDebugEl.style.whiteSpace = "nowrap";
      netDebugEl.style.overflow = "hidden";
      netDebugEl.style.textOverflow = "ellipsis";
      fpsEl.parentNode.insertBefore(netDebugEl, fpsEl.nextSibling);
    }

    function formatErrorLike(err) {
      if (!err) return { message: "Unknown error" };
      if (err instanceof Error) {
        return {
          name: err.name || "Error",
          message: err.message || String(err),
          stack: err.stack || null
        };
      }
      if (typeof err === "object") {
        return {
          name: err.name || "ErrorLike",
          message: err.message || String(err),
          stack: err.stack || null
        };
      }
      return { message: String(err) };
    }

    function logEvent(kind, message, extra) {
      const entry = {
        at: new Date().toISOString(),
        kind: kind || "info",
        message: message || "",
        extra: extra || null
      };
      state._runtimeLogBuffer.push(entry);
      if (state._runtimeLogBuffer.length > MAX_LOG_ENTRIES) {
        state._runtimeLogBuffer.splice(0, state._runtimeLogBuffer.length - MAX_LOG_ENTRIES);
      }
      return entry;
    }

    function getNetSnapshot() {
      const stats = matchSession && matchSession.getNetDebugStats
        ? matchSession.getNetDebugStats()
        : null;
      const packetSamples = state._netPacketStats && Array.isArray(state._netPacketStats.samples)
        ? state._netPacketStats.samples
        : [];
      const recentPacketSamples = packetSamples.slice(-20);
      const avgPacketSize = recentPacketSamples.length
        ? Math.round(recentPacketSamples.reduce(function (sum, sample) { return sum + (sample.size || 0); }, 0) / recentPacketSamples.length)
        : null;
      return {
        role: state._multiSlots ? (state._multiIsHost ? "host" : "remote") : "solo",
        matchId: state._matchId || null,
        matchType: state._matchType || null,
        roomId: state._roomId || null,
        modeLabel: netEl && netEl.textContent ? netEl.textContent : null,
        pingMs: netPing ? Math.round(netPing.smoothRtt || 0) : null,
        jitterMs: netPing ? Math.round(netPing.jitter || 0) : null,
        snapInterpMs: state && state._lastRemoteSnapIntervalMs != null ? Math.round(state._lastRemoteSnapIntervalMs) : null,
        avgPacketSize,
        queueLength: stats ? stats.queueLength : 0,
        received: stats ? stats.received : 0,
        applied: stats ? stats.applied : 0,
        dropped: stats ? stats.dropped : 0,
        seqGap: stats ? stats.seqGap : 0,
        arrivalGapMs: stats && stats.lastArrivalGapMs != null ? Math.round(stats.lastArrivalGapMs) : null,
        lastReceivedSeq: stats ? stats.lastReceivedSeq : null,
        lastAppliedSeq: stats ? stats.lastAppliedSeq : null
      };
    }

    function captureError(scope, err, extra) {
      const formatted = formatErrorLike(err);
      const report = {
        at: new Date().toISOString(),
        scope: scope || "runtime",
        error: formatted,
        extra: extra || null,
        href: locationHref,
        multiplayer: getNetSnapshot(),
        logs: state._runtimeLogBuffer.slice(-40)
      };
      logEvent("error", "[" + report.scope + "] " + formatted.message, extra);
      writeStoredReport(report);
      return report;
    }

    function updateNetDebugHud() {
      if (!netDebugEl) return;
      const snap = getNetSnapshot();
      if (snap.role === "solo") {
        netDebugEl.textContent = "netdbg: solo";
        return;
      }
      netDebugEl.textContent =
        "netdbg: " + snap.role +
        (snap.modeLabel ? " " + snap.modeLabel : "") +
        " ping " + (snap.pingMs != null ? snap.pingMs : "--") + "ms" +
        " jitter " + (snap.jitterMs != null ? snap.jitterMs : "--") + "ms" +
        (snap.snapInterpMs != null ? " snap " + snap.snapInterpMs : "") +
        (snap.avgPacketSize != null ? " pkt " + snap.avgPacketSize : "") +
        " q " + snap.queueLength +
        " rx/app " + snap.received + "/" + snap.applied +
        " drop " + snap.dropped +
        (snap.arrivalGapMs != null ? " gapms " + snap.arrivalGapMs : "") +
        (snap.seqGap ? " gap " + snap.seqGap : "");
    }

    if (!window.__vfObservabilityInstalled) {
      window.__vfObservabilityInstalled = true;
      window.addEventListener("error", function (event) {
        captureError("window.error", event && event.error ? event.error : {
          message: event && event.message ? event.message : "Unhandled error"
        }, {
          filename: event && event.filename ? event.filename : null,
          lineno: event && typeof event.lineno === "number" ? event.lineno : null,
          colno: event && typeof event.colno === "number" ? event.colno : null
        });
      });
      window.addEventListener("unhandledrejection", function (event) {
        captureError("window.unhandledrejection", event ? event.reason : null, null);
      });
    }

    const storedReport = readStoredReport();
    if (storedReport) {
      logEvent("warn", "Found previous stored crash report", {
        scope: storedReport.scope,
        at: storedReport.at
      });
    }

    window.__getVoidFrontCrashReport = function () {
      return readStoredReport();
    };
    window.__clearVoidFrontCrashReport = function () {
      try {
        if (window.localStorage) window.localStorage.removeItem(CRASH_STORAGE_KEY);
      } catch (_) {
        // ignore storage failures
      }
    };

    return {
      logEvent,
      captureError,
      updateNetDebugHud,
      getLastCrashReport: readStoredReport
    };
  }

  const api = { install };
  if (typeof window !== "undefined") window.RuntimeObservability = api;
  if (typeof module !== "undefined") module.exports = api;
})();
