(function () {
  "use strict";

  function install(deps) {
    const state = deps && deps.state;
    const socketUrl = deps && deps.socketUrl;
    const platformAdapter = deps && deps.platformAdapter;
    const initialSessionAuth = platformAdapter && typeof platformAdapter.getSessionAuth === "function"
      ? platformAdapter.getSessionAuth()
      : null;
    const listeners = new Map();
    const socket = (typeof io !== "undefined")
      ? io(socketUrl, { transports: ["websocket", "polling"] })
      : null;

    function subscribe(eventName, handler) {
      if (!eventName || typeof handler !== "function") return function () {};
      const bucket = listeners.get(eventName) || new Set();
      bucket.add(handler);
      listeners.set(eventName, bucket);
      return function () { bucket.delete(handler); };
    }

    function publish(eventName) {
      const bucket = listeners.get(eventName);
      if (!bucket || bucket.size === 0) return;
      const args = Array.prototype.slice.call(arguments, 1);
      for (const handler of bucket) {
        try {
          handler.apply(null, args);
        } catch (err) {
          console.error("[SocketSession]", eventName, err);
        }
      }
    }

    function emit() {
      if (!socket) return false;
      socket.emit.apply(socket, arguments);
      return true;
    }

    if (state) state._socket = socket;

    if (socket) {
      socket.on("connect", function () {
        publish("connect", socket);
        const auth = initialSessionAuth || (platformAdapter && platformAdapter.getSessionAuth ? platformAdapter.getSessionAuth() : null);
        if (auth && auth.sessionId && auth.reconnectToken) {
          socket.emit("reconnectAttempt", auth);
        }
      });
      socket.on("disconnect", function (reason) { publish("disconnect", reason); });
      socket.on("connect_error", function (err) { publish("connect_error", err); });

      const proxiedEvents = [
        "serverUrl",
        "slots",
        "startRejected",
        "chat",
        "net:pong",
        "gameStart",
        "gameState",
        "cardState",
        "playerAction",
        "mapRegenerate",
        "queueStatus",
        "matchFound",
        "sessionAssigned",
        "reconnectGranted",
        "reconnectFailed"
      ];
      for (const eventName of proxiedEvents) {
        socket.on(eventName, function () {
          const firstArg = arguments[0];
          if ((eventName === "sessionAssigned" || eventName === "reconnectGranted")
            && platformAdapter
            && typeof platformAdapter.saveSessionAuth === "function"
            && firstArg) {
            platformAdapter.saveSessionAuth(firstArg);
          }
          const args = [eventName].concat(Array.prototype.slice.call(arguments));
          publish.apply(null, args);
        });
      }
    }

    return {
      getSocket: function () { return socket; },
      getUrl: function () { return socketUrl; },
      on: subscribe,
      emit: emit
    };
  }

  const api = { install };
  if (typeof window !== "undefined") window.SocketSession = api;
  if (typeof module !== "undefined") module.exports = api;
})();
