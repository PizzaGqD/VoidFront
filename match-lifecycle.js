const { normalizeMatchType } = require("./bot-fill-policy");

function inferMatchTypeFromSlots(slots) {
  const occupied = Array.isArray(slots)
    ? slots.filter((slot) => slot && (slot.id || slot.isBot)).length
    : 0;
  return occupied >= 4 ? "ffa4" : "duel";
}

function createMatchRecord(options) {
  const opts = options || {};
  return {
    matchId: opts.matchId,
    roomId: opts.roomId,
    matchType: normalizeMatchType(opts.matchType || inferMatchTypeFromSlots(opts.slots)),
    authorityMode: opts.authorityMode || "host-client",
    seed: opts.seed,
    createdAt: Date.now(),
    startedAt: Date.now()
  };
}

function buildGameStartPayload(options) {
  const opts = options || {};
  return {
    roomId: opts.roomId || null,
    matchId: opts.matchId || null,
    matchType: normalizeMatchType(opts.matchType || inferMatchTypeFromSlots(opts.slots)),
    authorityMode: opts.authorityMode || "host-client",
    seed: opts.seed,
    slots: Array.isArray(opts.slots) ? opts.slots : [],
    sessionId: opts.sessionId || null,
    reconnectToken: opts.reconnectToken || null,
    reconnected: !!opts.reconnected
  };
}

module.exports = {
  inferMatchTypeFromSlots,
  createMatchRecord,
  buildGameStartPayload
};
