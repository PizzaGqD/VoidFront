const DEFAULT_QUEUE_BOT_FILL_MS = 30000;

function normalizeMatchType(matchType) {
  return matchType === "ffa4" ? "ffa4" : "duel";
}

function getRequiredPlayers(matchType) {
  return normalizeMatchType(matchType) === "ffa4" ? 4 : 2;
}

function getMatchLabel(matchType) {
  return normalizeMatchType(matchType) === "ffa4" ? "1v1v1v1" : "1v1";
}

function shouldFillWithBots(options) {
  const opts = options || {};
  const matchType = normalizeMatchType(opts.matchType);
  const humanCount = Math.max(0, opts.humanCount | 0);
  if (humanCount <= 0 || humanCount >= getRequiredPlayers(matchType)) return false;
  const oldestJoinedAt = Number(opts.oldestJoinedAt || 0);
  const now = Number(opts.now || Date.now());
  const timeoutMs = Number(opts.timeoutMs || DEFAULT_QUEUE_BOT_FILL_MS);
  if (!Number.isFinite(oldestJoinedAt) || oldestJoinedAt < 0) return false;
  return (now - oldestJoinedAt) >= timeoutMs;
}

module.exports = {
  DEFAULT_QUEUE_BOT_FILL_MS,
  normalizeMatchType,
  getRequiredPlayers,
  getMatchLabel,
  shouldFillWithBots
};
