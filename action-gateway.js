(function () {
  "use strict";

  function install(deps) {
    const state = deps && deps.state;
    const getSocket = deps && deps.getSocket;

    function socket() {
      return typeof getSocket === "function" ? getSocket() : null;
    }

    function emit(eventName) {
      const activeSocket = socket();
      if (!activeSocket) return false;
      activeSocket.emit.apply(activeSocket, arguments);
      return true;
    }

    function emitWithAck(eventName, args, callback) {
      const activeSocket = socket();
      if (!activeSocket) {
        if (typeof callback === "function") callback({ error: "Сервер не подключён." });
        return false;
      }
      const emitArgs = [eventName].concat(Array.isArray(args) ? args : []);
      if (typeof callback === "function") emitArgs.push(callback);
      activeSocket.emit.apply(activeSocket, emitArgs);
      return true;
    }

    function sendPlayerAction(payload) {
      if (!payload) return false;
      if (!(state && state._multiSlots && !state._multiIsHost)) return false;
      return emit("playerAction", payload);
    }

    function sendCardState(payload) {
      if (!payload) return false;
      if (!(state && state._multiIsHost && state._roomId)) return false;
      return emit("cardState", payload);
    }

    function sendMapRegenerate(payload) {
      if (!(state && state._multiSlots && state._multiIsHost && state._roomId)) return false;
      return emit("mapRegenerate", payload || {});
    }

    function sendChat(text) {
      const normalized = String(text || "").trim();
      if (!normalized) return false;
      return emit("chat", normalized);
    }

    function createRoom(nickname, callback) {
      return emitWithAck("create", [nickname], callback);
    }

    function joinRoom(roomId, nickname, callback) {
      return emitWithAck("join", [roomId, nickname], callback);
    }

    function listRooms(callback) {
      return emitWithAck("listRooms", [], callback);
    }

    function leaveRoom() {
      return emit("leave");
    }

    function startRoom(seed) {
      return emit("start", { seed: seed });
    }

    function setSlot(slotIndex, isBot) {
      return emit("setSlot", slotIndex, !!isBot);
    }

    function setColor(colorIndex) {
      return emit("setColor", colorIndex);
    }

    function setSlotColor(slotIndex, colorIndex) {
      return emit("setSlotColor", slotIndex, colorIndex);
    }

    function setSpawn(spawnIndex) {
      return emit("setSpawn", spawnIndex);
    }

    function setSlotSpawn(slotIndex, spawnIndex) {
      return emit("setSlotSpawn", slotIndex, spawnIndex);
    }

    function queueJoin(matchType, nickname) {
      return emit("queueJoin", { matchType: matchType, nickname: nickname });
    }

    function queueLeave() {
      return emit("queueLeave");
    }

    return {
      emit,
      emitWithAck,
      sendPlayerAction,
      sendCardState,
      sendMapRegenerate,
      sendChat,
      createRoom,
      joinRoom,
      listRooms,
      leaveRoom,
      startRoom,
      setSlot,
      setColor,
      setSlotColor,
      setSpawn,
      setSlotSpawn,
      queueJoin,
      queueLeave
    };
  }

  const api = { install };
  if (typeof window !== "undefined") window.ActionGateway = api;
  if (typeof module !== "undefined") module.exports = api;
})();
