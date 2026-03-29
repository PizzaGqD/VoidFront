(function () {
  "use strict";

  function install(deps) {
    const state = deps && deps.state;
    const showScreen = deps && deps.showScreen;
    const startGameSingle = deps && deps.startGameSingle;
    const nicknameInputEl = deps && deps.nicknameInputEl;
    const profileApi = deps && deps.profileApi;

    function getSoloModeConfig(modeId) {
      return modeId === "quad"
        ? { id: "quad", label: "1v1v1v1", description: "Ты против трёх ботов", botCount: 3, spawnCount: 4 }
        : { id: "duel", label: "1v1", description: "Ты против одного бота", botCount: 1, spawnCount: 4 };
    }

    function getDifficultyOptions() {
      return [
        { id: "easy", label: "Просто", hint: "Ошибается чаще и медленнее думает" },
        { id: "normal", label: "Нормально", hint: "Базовый честный соперник" },
        { id: "hard", label: "Сложно", hint: "Лучше решения и маленький скрытый бонус" },
        { id: "superhard", label: "Супержестко", hint: "Очень агрессивный macro + spell usage" }
      ];
    }

    function getDifficultyLabel(id) {
      if (id === "superhard") return "Супержестко";
      if (id === "hard") return "Сложно";
      if (id === "normal") return "Нормально";
      return "Просто";
    }

    function getNickname() {
      return (state._myNickname || window._myNickname || nicknameInputEl?.value || "").trim().slice(0, 24) || "Игрок";
    }

    function shouldAskNickname() {
      const profile = profileApi ? profileApi.getProfile() : null;
      const history = profile && Array.isArray(profile.history) ? profile.history : [];
      return history.length === 0;
    }

    function renderSoloSpawnPicker() {
      const soloSpawnPicker = document.getElementById("soloSpawnPicker");
      if (!soloSpawnPicker) return;
      soloSpawnPicker.innerHTML = "";
      const mode = getSoloModeConfig(state._soloGameMode);
      const total = mode.spawnCount;
      const current = Math.max(0, Math.min(total - 1, state._soloSpawnIndex ?? 0));
      state._soloSpawnIndex = current;
      for (let i = 0; i < total; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "menu-btn " + (i === current ? "primary" : "secondary");
        btn.style.minWidth = "48px";
        btn.textContent = String(i + 1);
        btn.addEventListener("click", function () {
          state._soloSpawnIndex = i;
          renderSoloSpawnPicker();
        });
        soloSpawnPicker.appendChild(btn);
      }
    }

    function renderSoloModePicker() {
      const soloModePicker = document.getElementById("soloModePicker");
      if (!soloModePicker) return;
      soloModePicker.innerHTML = "";
      const modes = [
        { id: "duel", label: "1v1", subtitle: "Один сильный бот" },
        { id: "quad", label: "1v1v1v1", subtitle: "Три бота на карте" }
      ];
      const current = state._soloGameMode || "duel";
      modes.forEach(function (mode) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "menu-btn " + (mode.id === current ? "primary" : "secondary");
        btn.textContent = mode.label;
        btn.title = mode.subtitle;
        btn.addEventListener("click", function () {
          state._soloGameMode = mode.id;
          state._soloBotCount = getSoloModeConfig(mode.id).botCount;
          renderSoloModePicker();
          renderSoloSpawnPicker();
        });
        soloModePicker.appendChild(btn);
      });
    }

    function renderDifficultyPicker() {
      const wrap = document.getElementById("soloDifficultyPicker");
      if (!wrap) return;
      wrap.innerHTML = "";
      const current = state._soloDifficulty || "easy";
      const options = getDifficultyOptions();
      options.forEach(function (option) {
        const unlocked = !profileApi || profileApi.isDifficultyUnlocked(option.id);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "menu-btn " + (current === option.id ? "primary" : "secondary");
        btn.textContent = option.label;
        btn.title = unlocked ? option.hint : "Откроется победами";
        btn.disabled = !unlocked;
        if (!unlocked) btn.classList.add("menu-btn-locked");
        btn.addEventListener("click", function () {
          if (!unlocked) return;
          state._soloDifficulty = option.id;
          renderDifficultyPicker();
        });
        wrap.appendChild(btn);
      });
    }

    function renderProfileSummary() {
      const host = document.getElementById("singleProfileSummary");
      if (!host) return;
      const profile = profileApi ? profileApi.getProfile() : null;
      if (!profile) {
        host.innerHTML = "";
        return;
      }
      const unlocked = Object.keys(profile.unlockedDifficulties)
        .filter(function (id) { return profile.unlockedDifficulties[id]; })
        .map(getDifficultyLabel)
        .join(" / ");
      host.innerHTML =
        "<div class='single-meta-grid'>" +
          "<div><span class='muted'>Игрок</span><b>" + profile.nickname + "</b></div>" +
          "<div><span class='muted'>Уровень</span><b>" + profile.level + "</b></div>" +
          "<div><span class='muted'>XP</span><b>" + profile.xp + "</b></div>" +
          "<div><span class='muted'>Победы</span><b>" + profile.wins + "</b></div>" +
          "<div><span class='muted'>Поражения</span><b>" + profile.losses + "</b></div>" +
          "<div><span class='muted'>Открыто</span><b>" + unlocked + "</b></div>" +
        "</div>";
    }

    function renderResultsHistory() {
      const host = document.getElementById("singleResultsHistory");
      if (!host) return;
      const profile = profileApi ? profileApi.getProfile() : null;
      const history = profile && Array.isArray(profile.history) ? profile.history.slice(0, 4) : [];
      host.innerHTML = "";
      if (!history.length) {
        host.innerHTML = "<div class='muted'>Сыграй первый матч, и история появится здесь.</div>";
        return;
      }
      history.forEach(function (entry) {
        const row = document.createElement("div");
        row.className = "single-history-row";
        const outcome = entry.outcome === "victory" ? "Победа" : "Поражение";
        const mode = entry.mode === "quad" ? "1v1v1v1" : "1v1";
        const difficulty = getDifficultyLabel(entry.difficulty);
        row.innerHTML =
          "<div class='single-history-top'><b>" + outcome + "</b><span>" + mode + " • " + difficulty + "</span></div>" +
          "<div class='single-history-bottom'><span>" + Math.max(0, entry.durationSec || 0) + " сек</span><span>+" + ((entry.rewards && entry.rewards.xpGained) || 0) + " XP</span></div>";
        host.appendChild(row);
      });
    }

    function renderResultsPanels() {
      renderProfileSummary();
      renderResultsHistory();
      renderDifficultyPicker();
    }

    function renderVictorySummary(summary) {
      const statsEl = document.getElementById("victoryStats");
      const rewardsEl = document.getElementById("victoryRewards");
      const profile = profileApi ? profileApi.getProfile() : null;
      if (statsEl) {
        const economy = summary && summary.economy ? summary.economy : {};
        statsEl.innerHTML =
          "<div><span class='muted'>Режим</span><b>" + ((summary && summary.mode === "quad") ? "1v1v1v1" : "1v1") + "</b></div>" +
          "<div><span class='muted'>Сложность</span><b>" +
            getDifficultyLabel(summary && summary.difficulty) +
          "</b></div>" +
          "<div><span class='muted'>Время</span><b>" + Math.max(0, (summary && summary.durationSec) || 0) + " сек</b></div>" +
          "<div><span class='muted'>Кредиты</span><b>" + Math.round(economy.credits || 0) + "</b></div>";
      }
      if (rewardsEl) {
        const rewards = summary && summary.rewards ? summary.rewards : null;
        const unlocks = rewards && Array.isArray(rewards.newUnlocks) && rewards.newUnlocks.length
          ? " • открыто: " + rewards.newUnlocks.map(getDifficultyLabel).join(", ")
          : "";
        rewardsEl.innerHTML = rewards
          ? "<div><span class='muted'>Награда</span><b>+" + ((rewards.rewards && rewards.rewards.xpGained) || 0) + " XP</b></div>" +
            "<div><span class='muted'>Профиль</span><b>ур. " + (profile ? profile.level : 1) + unlocks + "</b></div>"
          : "";
      }
    }

    function bindMenuButtons() {
      const btnSingle = document.getElementById("btnSingle");
      const nicknameBack = document.getElementById("nicknameBack");
      const nicknameOk = document.getElementById("nicknameOk");
      const soloLobbyBack = document.getElementById("soloLobbyBack");
      const soloLobbyStart = document.getElementById("soloLobbyStart");
      const profileReset = document.getElementById("singleProfileReset");
      const profilePanel = document.getElementById("singleProfilePanel");
      const historyPanel = document.getElementById("singleHistoryPanel");
      function bindAccordion(detailsEl, peerEl) {
        if (!detailsEl || !peerEl) return;
        detailsEl.addEventListener("toggle", function () {
          if (detailsEl.open) peerEl.open = false;
        });
      }
      if (btnSingle) btnSingle.addEventListener("click", function () {
        state._menuMode = "single";
        showScreen(shouldAskNickname() ? "nicknameScreen" : "soloLobbyScreen");
      });
      if (nicknameBack) nicknameBack.addEventListener("click", function () {
        showScreen("mainMenu");
      });
      if (nicknameOk) nicknameOk.addEventListener("click", function () {
        const nick = getNickname();
        state._myNickname = nick;
        window._myNickname = nick;
        if (profileApi) profileApi.setNickname(nick);
        renderProfileSummary();
        showScreen("soloLobbyScreen");
      });
      if (soloLobbyBack) soloLobbyBack.addEventListener("click", function () {
        showScreen(shouldAskNickname() ? "nicknameScreen" : "mainMenu");
      });
      if (soloLobbyStart) soloLobbyStart.addEventListener("click", function () {
        state._quickStartScenario = null;
        state._mapVariation = 1;
        state._soloBotCount = getSoloModeConfig(state._soloGameMode).botCount;
        state._customMapSeed = null;
        startGameSingle(getNickname());
      });
      if (profileReset) profileReset.addEventListener("click", function () {
        if (!profileApi) return;
        profileApi.resetProfile();
        state._myNickname = "";
        window._myNickname = "";
        if (nicknameInputEl) nicknameInputEl.value = "";
        renderResultsPanels();
        showScreen("nicknameScreen");
      });
      bindAccordion(profilePanel, historyPanel);
      bindAccordion(historyPanel, profilePanel);
    }

    function init() {
      if (profileApi) {
        const profile = profileApi.ensureProfile();
        state._myNickname = state._myNickname || profile.nickname || "Игрок";
        window._myNickname = state._myNickname;
        if (nicknameInputEl && !nicknameInputEl.value) nicknameInputEl.value = state._myNickname;
      }
      if (!state._soloGameMode) state._soloGameMode = "duel";
      if (!state._soloDifficulty) state._soloDifficulty = "easy";
      if (state._soloSpawnIndex == null) state._soloSpawnIndex = 0;
      bindMenuButtons();
      renderSoloModePicker();
      renderSoloSpawnPicker();
      renderResultsPanels();
    }

    return {
      init,
      getSoloModeConfig,
      renderSoloModePicker,
      renderSoloSpawnPicker,
      renderDifficultyPicker,
      renderProfileSummary,
      renderResultsHistory,
      renderResultsPanels,
      renderVictorySummary
    };
  }

  const api = { install };
  if (typeof window !== "undefined") window.SingleMenuUI = api;
  if (typeof module !== "undefined") module.exports = api;
})();
