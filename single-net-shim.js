(function () {
  "use strict";

  function SnapshotSerializer() {}
  SnapshotSerializer.prototype.serialize = function () { return null; };
  SnapshotSerializer.prototype.reset = function () {};

  function SendScheduler() {}
  SendScheduler.prototype.start = function () {};
  SendScheduler.prototype.stop = function () {};
  SendScheduler.prototype.step = function () {};

  function PingTracker() {
    this._interpMs = 33;
  }
  PingTracker.prototype.start = function () {};
  PingTracker.prototype.stop = function () {};
  PingTracker.prototype.onPong = function () {};
  PingTracker.prototype.getInterpDurationMs = function () {
    return this._interpMs;
  };

  const api = {
    SEND_INTERVAL_MS: 33,
    ZONE_SYNC_INTERVAL_MS: 100,
    PLAYER_LIGHT_KEYS: [],
    PLAYER_FULL_KEYS: [],
    UNIT_FULL_KEYS: [],
    SnapshotSerializer,
    SendScheduler,
    PingTracker,
    Interp: {
      tickUnit: function () {},
      tickStorm: function () {},
      tickZoneRays: function () {},
      tickRes: function () {}
    }
  };

  if (typeof window !== "undefined") window.NET = api;
  if (typeof module !== "undefined") module.exports = api;
})();
