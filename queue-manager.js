const {
  normalizeMatchType,
  getRequiredPlayers,
  shouldFillWithBots,
  DEFAULT_QUEUE_BOT_FILL_MS
} = require("./bot-fill-policy");

function createQueueManager(options) {
  const opts = options || {};
  const timeoutMs = Number(opts.timeoutMs || DEFAULT_QUEUE_BOT_FILL_MS);
  const queues = {
    duel: [],
    ffa4: []
  };

  function allQueues() {
    return [queues.duel, queues.ffa4];
  }

  function removeSocket(socketId) {
    for (const queue of allQueues()) {
      const next = queue.filter((entry) => entry.socketId !== socketId);
      queue.splice(0, queue.length, ...next);
    }
  }

  function removeSession(sessionId) {
    for (const queue of allQueues()) {
      const next = queue.filter((entry) => entry.sessionId !== sessionId);
      queue.splice(0, queue.length, ...next);
    }
  }

  function join(matchType, entry) {
    const type = normalizeMatchType(matchType);
    removeSocket(entry.socketId);
    if (entry.sessionId) removeSession(entry.sessionId);
    queues[type].push({
      matchType: type,
      socketId: entry.socketId,
      sessionId: entry.sessionId || null,
      nickname: entry.nickname || "Игрок",
      joinedAt: entry.joinedAt != null ? entry.joinedAt : Date.now()
    });
    return getStatus(type);
  }

  function leaveBySocket(socketId) {
    removeSocket(socketId);
  }

  function getStatus(matchType, now) {
    const type = normalizeMatchType(matchType);
    const snapshot = queues[type].slice();
    const oldestJoinedAt = snapshot.length ? snapshot[0].joinedAt : null;
    return {
      active: snapshot.length > 0,
      matchType: type,
      playersInQueue: snapshot.length,
      requiredPlayers: getRequiredPlayers(type),
      botFillAfterMs: timeoutMs,
      oldestJoinedAt,
      canFillWithBots: shouldFillWithBots({
        matchType: type,
        humanCount: snapshot.length,
        oldestJoinedAt,
        now: now || Date.now(),
        timeoutMs
      })
    };
  }

  function takeReadyGroup(matchType, now) {
    const type = normalizeMatchType(matchType);
    const queue = queues[type];
    const requiredPlayers = getRequiredPlayers(type);
    if (queue.length >= requiredPlayers) {
      return queue.splice(0, requiredPlayers);
    }
    const oldestJoinedAt = queue.length ? queue[0].joinedAt : null;
    if (shouldFillWithBots({
      matchType: type,
      humanCount: queue.length,
      oldestJoinedAt,
      now: now || Date.now(),
      timeoutMs
    })) {
      return queue.splice(0, queue.length);
    }
    return null;
  }

  return {
    join,
    leaveBySocket,
    removeSession,
    getStatus,
    takeReadyGroup,
    queues
  };
}

module.exports = {
  createQueueManager
};
