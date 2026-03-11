(function () {
  "use strict";

  function install(deps) {
    const {
      state,
      netSendScheduler,
      serializeGameState
    } = deps;

    function step(now) {
      if (!(state._multiIsHost && state._socket && state._roomId)) return;

      const dtMs = now - (state._lastSendCheck || now);
      state._lastSendCheck = now;
      if (!netSendScheduler.update(dtMs)) return;

      const gs = serializeGameState();
      const payload = JSON.stringify(gs);
      const size = payload.length;
      if (!state._netPacketStats) state._netPacketStats = { samples: [], lastLog: 0 };
      const st = state._netPacketStats;
      st.samples.push({ size, full: !!gs._fullSync, t: state.t });
      if (st.samples.length > 120) st.samples.shift();

      if (state.t - st.lastLog >= 10) {
        st.lastLog = state.t;
        const recent = st.samples.slice(-30);
        const avg = recent.reduce((sum, sample) => sum + sample.size, 0) / recent.length;
        const fulls = recent.filter((sample) => sample.full).length;
        const line = `[NET-PKT] size=${size} avg30=${Math.round(avg)} fullSyncs=${fulls} units=${(gs.units || []).length}`;
        console.log(line);
        if (typeof window !== "undefined") {
          window._lastNetPacketLog = line;
          window._netPacketSamples = st.samples;
        }
      }

      state._socket.emit("gameState", gs);
    }

    return { step };
  }

  const api = { install };
  if (typeof window !== "undefined") window.HostNetworkRuntime = api;
  if (typeof module !== "undefined") module.exports = api;
})();
