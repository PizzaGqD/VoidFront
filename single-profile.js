(function () {
  "use strict";

  function makeMemoryStorage() {
    const data = new Map();
    return {
      getItem(key) {
        return data.has(key) ? data.get(key) : null;
      },
      setItem(key, value) {
        data.set(key, String(value));
      },
      removeItem(key) {
        data.delete(key);
      }
    };
  }

  function safeBrowserStorage() {
    if (typeof window === "undefined" || !window.localStorage) return makeMemoryStorage();
    try {
      const key = "__voidfront_profile_probe__";
      window.localStorage.setItem(key, "1");
      window.localStorage.removeItem(key);
      return window.localStorage;
    } catch (_) {
      return makeMemoryStorage();
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function makeDefaultProfile() {
    return {
      version: 1,
      nickname: "Игрок",
      xp: 0,
      level: 1,
      wins: 0,
      losses: 0,
      totalMatches: 0,
      unlockedDifficulties: {
        easy: true,
        normal: false,
        hard: false,
        superhard: false
      },
      history: []
    };
  }

  function xpNeededForLevel(level) {
    const lvl = Math.max(1, level | 0);
    return 120 + (lvl - 1) * 55;
  }

  function normalizeProfile(raw) {
    const base = makeDefaultProfile();
    const value = raw && typeof raw === "object" ? raw : {};
    const out = {
      ...base,
      ...value,
      unlockedDifficulties: {
        ...base.unlockedDifficulties,
        ...(value.unlockedDifficulties || {})
      },
      history: Array.isArray(value.history) ? value.history.slice(0, 20) : []
    };
    out.level = Math.max(1, Number(out.level) || 1);
    out.xp = Math.max(0, Number(out.xp) || 0);
    out.wins = Math.max(0, Number(out.wins) || 0);
    out.losses = Math.max(0, Number(out.losses) || 0);
    out.totalMatches = Math.max(0, Number(out.totalMatches) || (out.wins + out.losses));
    if (out.wins >= 1) out.unlockedDifficulties.normal = true;
    if (out.wins >= 3) out.unlockedDifficulties.hard = true;
    if (out.wins >= 6) out.unlockedDifficulties.superhard = true;
    return out;
  }

  function calculateMatchRewards(result) {
    const payload = result || {};
    const victory = payload.outcome === "victory";
    const difficulty = payload.difficulty || "easy";
    const mode = payload.mode || "duel";
    let xp = victory ? 110 : 45;
    if (difficulty === "normal") xp += victory ? 35 : 15;
    if (difficulty === "hard") xp += victory ? 70 : 28;
    if (difficulty === "superhard") xp += victory ? 120 : 45;
    if (mode === "quad") xp += victory ? 25 : 12;
    return {
      xpGained: xp
    };
  }

  function createProfileService(options) {
    const opts = options || {};
    const storage = opts.storage || safeBrowserStorage();
    const storageKey = opts.storageKey || "voidfront.single.profile";
    let profile = null;

    function loadProfile() {
      if (profile) return clone(profile);
      const raw = storage.getItem(storageKey);
      if (!raw) {
        profile = makeDefaultProfile();
        return clone(profile);
      }
      try {
        profile = normalizeProfile(JSON.parse(raw));
      } catch (_) {
        profile = makeDefaultProfile();
      }
      return clone(profile);
    }

    function saveProfile() {
      if (!profile) loadProfile();
      storage.setItem(storageKey, JSON.stringify(profile));
      return clone(profile);
    }

    function ensureProfile() {
      return loadProfile();
    }

    function getProfile() {
      return loadProfile();
    }

    function setNickname(nickname) {
      if (!profile) loadProfile();
      const value = String(nickname || "").trim().slice(0, 24) || "Игрок";
      profile.nickname = value;
      saveProfile();
      return value;
    }

    function getUnlockedDifficultyIds() {
      if (!profile) loadProfile();
      return Object.keys(profile.unlockedDifficulties).filter((id) => profile.unlockedDifficulties[id]);
    }

    function isDifficultyUnlocked(id) {
      if (!profile) loadProfile();
      const key = String(id || "easy");
      return !!profile.unlockedDifficulties[key];
    }

    function recordMatch(result) {
      if (!profile) loadProfile();
      const payload = result || {};
      const rewards = calculateMatchRewards(payload);
      const beforeLevel = profile.level;
      const newUnlocks = [];

      profile.totalMatches += 1;
      if (payload.outcome === "victory") profile.wins += 1;
      else profile.losses += 1;

      profile.xp += rewards.xpGained;
      while (profile.xp >= xpNeededForLevel(profile.level)) {
        profile.xp -= xpNeededForLevel(profile.level);
        profile.level += 1;
      }

      if (profile.wins >= 1 && !profile.unlockedDifficulties.normal) {
        profile.unlockedDifficulties.normal = true;
        newUnlocks.push("normal");
      }
      if (profile.wins >= 3 && !profile.unlockedDifficulties.hard) {
        profile.unlockedDifficulties.hard = true;
        newUnlocks.push("hard");
      }
      if (profile.wins >= 6 && !profile.unlockedDifficulties.superhard) {
        profile.unlockedDifficulties.superhard = true;
        newUnlocks.push("superhard");
      }

      const historyEntry = {
        at: Date.now(),
        outcome: payload.outcome || "defeat",
        mode: payload.mode || "duel",
        difficulty: payload.difficulty || "easy",
        durationSec: Math.max(0, Number(payload.durationSec) || 0),
        economy: payload.economy || null,
        rewards
      };
      profile.history.unshift(historyEntry);
      profile.history = profile.history.slice(0, 12);
      saveProfile();

      return {
        profile: clone(profile),
        rewards,
        newUnlocks,
        leveledUp: profile.level > beforeLevel
      };
    }

    function resetProfile() {
      profile = makeDefaultProfile();
      saveProfile();
      return clone(profile);
    }

    return {
      ensureProfile,
      getProfile,
      saveProfile,
      setNickname,
      getUnlockedDifficultyIds,
      isDifficultyUnlocked,
      recordMatch,
      resetProfile
    };
  }

  function install(options) {
    return createProfileService({
      storageKey: (options && options.storageKeyPrefix ? options.storageKeyPrefix : "voidfront") + ".single.profile"
    });
  }

  const api = {
    install,
    createProfileService,
    xpNeededForLevel,
    calculateMatchRewards
  };

  if (typeof window !== "undefined") window.SingleProfile = api;
  if (typeof module !== "undefined") module.exports = api;
})();
