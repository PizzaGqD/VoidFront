(function () {
  "use strict";

  function install(deps) {
    const {
      state,
      socket: directSocket,
      socketSession,
      actionGateway,
      matchSession,
      socketUrl,
      showScreen,
      startGameSingle,
      nicknameInputEl,
      roomCodeInputEl,
      lobbyScreenEl,
      LOBBY_COLORS,
      CFG
    } = deps;
    const socket = socketSession && socketSession.getSocket ? socketSession.getSocket() : directSocket;

    function nickForSocket() {
      return (state._myNickname || window._myNickname || "Игрок").trim().slice(0, 24) || "Игрок";
    }

    function createRoomRequest(callback) {
      if (actionGateway && actionGateway.createRoom) return actionGateway.createRoom(nickForSocket(), callback);
      if (!socket) return false;
      socket.emit("create", nickForSocket(), callback);
      return true;
    }

    function joinRoomRequest(roomId, callback) {
      if (actionGateway && actionGateway.joinRoom) return actionGateway.joinRoom(roomId, nickForSocket(), callback);
      if (!socket) return false;
      socket.emit("join", roomId, nickForSocket(), callback);
      return true;
    }

    function refreshLobbyRequest(callback) {
      if (actionGateway && actionGateway.listRooms) return actionGateway.listRooms(callback);
      if (!socket) return false;
      socket.emit("listRooms", callback);
      return true;
    }

    function sendChat(text) {
      if (actionGateway && actionGateway.sendChat) return actionGateway.sendChat(text);
      if (!socket) return false;
      socket.emit("chat", text);
      return true;
    }

    function applyRoomSnapshot(payload) {
      if (matchSession && matchSession.applyRoomSnapshot) {
        matchSession.applyRoomSnapshot(payload);
        return;
      }
      const data = Array.isArray(payload) ? { slots: payload } : (payload || {});
      state._lobbySlots = Array.isArray(data.slots) ? data.slots : [];
      state._hostSlot = Number.isInteger(data.hostSlot) ? data.hostSlot : null;
      if (state._mySlot != null && state._hostSlot != null && state._hostSlot >= 0) {
        state._isHost = state._hostSlot === state._mySlot;
      } else if (state._hostSlot == null || state._hostSlot < 0) {
        state._isHost = false;
      }
    }

    function getSoloModeConfig(modeId) {
      return modeId === "quad"
        ? { id: "quad", label: "3 бота", formatLabel: "1v1v1v1", playerCount: 4, botCount: 3, spawnCount: 4 }
        : { id: "duel", label: "1 бот", formatLabel: "1v1", playerCount: 2, botCount: 1, spawnCount: 4 };
    }

    function getPreviewSpawnPositions(count, worldW, worldH) {
      const cx = worldW * 0.5;
      const cy = worldH * 0.5;
      const halfSide = Math.min(worldW, worldH) * 0.28;
      return [
        { x: cx - halfSide, y: cy - halfSide },
        { x: cx + halfSide, y: cy - halfSide },
        { x: cx + halfSide, y: cy + halfSide },
        { x: cx - halfSide, y: cy + halfSide }
      ];
    }

    function renderLobby() {
      const slotsEl = document.getElementById("lobbySlots");
      const hostBadge = document.getElementById("lobbyHostBadge");
      const roomCodeEl = document.getElementById("lobbyRoomCode");
      const startBtn = document.getElementById("lobbyStart");
      const formatTitleEl = document.getElementById("lobbyFormatTitle");
      const formatHintEl = document.getElementById("lobbyFormatHint");
      const spawnMapTitleEl = document.getElementById("lobbySpawnMapTitle");
      const spawnMapHintEl = document.getElementById("lobbySpawnMapHint");
      if (!slotsEl) return;
      const slots = state._lobbySlots || [];
      roomCodeEl.textContent = "Код: " + (state._roomId || "").replace("r_", "");
      roomCodeEl.style.display = "inline-block";
      hostBadge.style.display = state._isHost ? "inline-block" : "none";
      startBtn.style.display = state._isHost ? "inline-block" : "none";
      const occupiedSlots = slots
        .map((slot, index) => ({ slot: slot || {}, index }))
        .filter((entry) => !!(entry.slot.id || entry.slot.isBot));
      const occupiedCount = occupiedSlots.length;
      const canStart = occupiedCount === 2 || occupiedCount === 4;
      if (startBtn) {
        startBtn.disabled = !canStart;
        startBtn.style.opacity = canStart ? "1" : "0.5";
        startBtn.textContent = occupiedCount === 4 ? "Начать 1v1v1v1" : (occupiedCount === 2 ? "Начать 1v1" : "Нужен полный формат");
        startBtn.title = canStart ? "" : "Нужно ровно 2 или 4 занятых слота.";
      }
      if (formatTitleEl) {
        formatTitleEl.textContent = occupiedCount === 4 ? "Квадратная схватка 1v1v1v1" : (occupiedCount === 2 ? "Дуэль 1v1" : "Ожидание состава");
      }
      if (formatHintEl) {
        formatHintEl.textContent = occupiedCount === 4
          ? "Четыре базы по углам. Центр и два фланга быстро становятся общей зоной конфликта."
          : occupiedCount === 2
            ? "Две базы занимают противоположные углы той же квадратной карты. Два пустых сектора остаются нейтральными и работают как фланговые линии."
            : "Соберите либо 2, либо 4 занятых слота. Другие составы не запускаются.";
      }
      if (spawnMapTitleEl) {
        spawnMapTitleEl.textContent = occupiedCount === 4 ? "Карта квадрата 1v1v1v1" : (occupiedCount === 2 ? "Карта дуэли 1v1" : "Карта спавнов");
      }
      if (spawnMapHintEl) {
        spawnMapHintEl.textContent = occupiedCount === 4
          ? "Фиксированный квадрат: северо-запад, северо-восток, юго-восток, юго-запад."
          : occupiedCount === 2
            ? "Фиксированная дуэль: тот же квадрат, но два противоположных угла остаются пустыми нейтральными секторами."
            : "Расположение фиксировано: дуэль по углам, 4 игрока квадратом.";
      }
      const urlEl = document.getElementById("lobbyServerUrl");
      const urlHintEl = document.getElementById("lobbyUrlHint");
      const url = state._serverUrl || window.location.origin;
      if (urlEl) {
        urlEl.textContent = url;
        urlEl.title = url;
        if (urlHintEl) {
          urlHintEl.style.display = (!state._serverUrl && url.indexOf("localhost") !== -1 && state._isHost) ? "block" : "none";
        }
      }

      const requestedEditSlot = state._colorEditSlot != null ? state._colorEditSlot : state._mySlot;
      const targetSlot = (requestedEditSlot != null && slots[requestedEditSlot] && (slots[requestedEditSlot].id || slots[requestedEditSlot].isBot))
        ? requestedEditSlot
        : state._mySlot;

      slotsEl.innerHTML = "";
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i] || {};
        const occupied = !!(s.id || s.isBot);
        const div = document.createElement("div");
        div.className = "lobby-slot" + (occupied ? "" : " empty");
        const colorHex = "#" + (LOBBY_COLORS[s.colorIndex || 0] || 0x888888).toString(16).padStart(6, "0");

        const colorSpan = document.createElement("span");
        colorSpan.className = "slot-color";
        colorSpan.style.background = colorHex;
        const canSelectThisSlot = occupied && (state._isHost || i === state._mySlot);
        if (canSelectThisSlot) {
          colorSpan.style.cursor = "pointer";
          colorSpan.title = i === state._mySlot ? "Выбрать свой цвет" : "Выбрать цвет для этого слота";
          if (i === targetSlot) colorSpan.style.boxShadow = "0 0 0 3px #fff";
          const slotIdx = i;
          colorSpan.addEventListener("click", () => {
            state._colorEditSlot = slotIdx;
            renderLobby();
          });
        }
        div.appendChild(colorSpan);

        const nameSpan = document.createElement("span");
        nameSpan.className = "slot-name";
        nameSpan.textContent = s.name || "Пусто";
        div.appendChild(nameSpan);

        if (s.isBot) {
          const badge = document.createElement("span");
          badge.className = "slot-badge";
          badge.textContent = "Бот";
          div.appendChild(badge);
        }

        if (state._isHost && i > 0) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "menu-btn secondary";
          btn.style.fontSize = "12px";
          btn.textContent = s.isBot ? "Убрать бота" : "Бот";
          btn.addEventListener("click", () => {
            if (actionGateway && actionGateway.setSlot) actionGateway.setSlot(i, !s.isBot);
          });
          div.appendChild(btn);
        }
        slotsEl.appendChild(div);
      }

      const spawnMapEl = document.getElementById("lobbySpawnMap");
      if (spawnMapEl) {
        const W = (typeof CFG !== "undefined" ? CFG.WORLD_W : 7200) || 7200;
        const H = (typeof CFG !== "undefined" ? CFG.WORLD_H : 4320) || 4320;
        const wCx = W * 0.5;
        const wCy = H * 0.5;
        const spawns = getPreviewSpawnPositions(4, W, H);
        const occupiedSpawnIndices = occupiedCount === 2 ? [0, 2] : [0, 1, 2, 3];
        const cw = spawnMapEl.width;
        const ch = spawnMapEl.height;
        const ctx = spawnMapEl.getContext("2d");
        ctx.fillStyle = "#0a0c1a";
        ctx.fillRect(0, 0, cw, ch);

        const pad = 30;
        const scaleX = (cw - pad * 2) / W;
        const scaleY = (ch - pad * 2) / H;
        const scale = Math.min(scaleX, scaleY);
        const offX = (cw - W * scale) / 2;
        const offY = (ch - H * scale) / 2;

        ctx.beginPath();
        ctx.arc(offX + wCx * scale, offY + wCy * scale, Math.min(W, H) * 0.08 * scale, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(100,150,255,0.18)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const DOT_R = 16;
        for (let i = 0; i < spawns.length; i++) {
          const px = offX + spawns[i].x * scale;
          const py = offY + spawns[i].y * scale;
          const ownerEntry = occupiedSlots[occupiedSpawnIndices.indexOf(i)] || null;
          const ownerSlot = ownerEntry ? ownerEntry.index : null;
          const occupied = !!ownerEntry;
          const slotData = ownerEntry ? ownerEntry.slot : null;
          const color = occupied ? "#" + (LOBBY_COLORS[slotData.colorIndex || 0] || 0x888888).toString(16).padStart(6, "0") : "#334";
          const borderColor = occupied ? "rgba(255,255,255,0.5)" : "#556";

          ctx.beginPath();
          ctx.arc(px, py, DOT_R, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = occupied ? 2 : 1;
          ctx.stroke();

          if (ownerSlot === targetSlot) {
            ctx.beginPath();
            ctx.arc(px, py, DOT_R + 5, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255,255,255,0.85)";
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (!occupied && targetSlot != null) {
            ctx.beginPath();
            ctx.arc(px, py, DOT_R + 3, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(120,170,255,0.22)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          ctx.fillStyle = occupied ? "#fff" : "#889";
          ctx.font = "bold 13px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String((ownerSlot != null ? ownerSlot : i) + 1), px, py + 1);

          if (occupied && slotData) {
            const label = slotData.name || (slotData.isBot ? "Бот" : "");
            if (label) {
              ctx.fillStyle = "rgba(255,255,255,0.7)";
              ctx.font = "11px sans-serif";
              ctx.fillText(label.length > 8 ? label.slice(0, 7) + "…" : label, px, py + DOT_R + 12);
            }
          }
        }

        spawnMapEl.style.cursor = "default";
        spawnMapEl.onclick = null;
      }

      const pickerEl = document.getElementById("colorPicker");
      if (pickerEl) {
        pickerEl.innerHTML = "";
        const targetData = slots[targetSlot] || {};
        const curColor = targetData.colorIndex != null ? targetData.colorIndex : 0;

        const usedColors = new Set();
        for (let j = 0; j < slots.length; j++) {
          const sl = slots[j] || {};
          if ((sl.id || sl.isBot) && j !== targetSlot) usedColors.add(sl.colorIndex);
        }

        const label = document.getElementById("colorPickerLabel");
        if (label) {
          if (state._isHost && targetSlot !== state._mySlot) {
            const tName = targetData.name || (targetData.isBot ? "Бот" : "Слот " + (targetSlot + 1));
            label.textContent = "Цвет для: " + tName;
          } else {
            label.textContent = "Ваш цвет:";
          }
        }

        for (let i = 0; i < 36; i++) {
          const sw = document.createElement("div");
          const taken = usedColors.has(i);
          sw.className = "color-swatch" + (i === curColor ? " selected" : "") + (taken ? " taken" : "");
          sw.style.background = "#" + (LOBBY_COLORS[i] || 0).toString(16).padStart(6, "0");
          if (taken) {
            sw.style.opacity = "0.25";
            sw.style.cursor = "default";
            sw.title = "Занят";
          } else {
            const colorIdx = i;
            sw.addEventListener("click", () => {
              if (state._isHost && targetSlot !== state._mySlot) {
                if (actionGateway && actionGateway.setSlotColor) actionGateway.setSlotColor(targetSlot, colorIdx);
              } else if (actionGateway && actionGateway.setColor) {
                actionGateway.setColor(colorIdx);
              }
            });
          }
          pickerEl.appendChild(sw);
        }
      }
    }

    function renderLobbyList() {
      const listEl = document.getElementById("lobbyList");
      if (!listEl) return;
      const list = state._lobbyList || [];
      listEl.innerHTML = "";
      for (const r of list) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "menu-btn lobby-list-item";
        btn.textContent = r.code + " — " + r.hostName + " (" + r.slotsUsed + "/" + r.slotsTotal + ")";
        btn.addEventListener("click", () => {
          if (!socket) return;
          joinRoomRequest(r.roomId, (data) => {
            if (data.error) {
              alert(data.error);
              return;
            }
            if (matchSession && matchSession.updateLobbyContext) matchSession.updateLobbyContext(data);
            else {
              state._lobbySlots = data.slots;
              state._mySlot = data.mySlot;
              state._isHost = data.isHost;
              state._hostSlot = Number.isInteger(data.hostSlot) ? data.hostSlot : null;
              state._roomId = data.roomId;
            }
            renderLobby();
            showScreen("lobbyScreen");
          });
        });
        listEl.appendChild(btn);
      }
      if (list.length === 0) {
        const p = document.createElement("p");
        p.className = "muted";
        p.textContent = "Нет открытых комнат. Создайте свою.";
        listEl.appendChild(p);
      }
    }

    function refreshLobbyList() {
      refreshLobbyRequest((list) => {
        state._lobbyList = list || [];
        console.log("[Лобби] Список комнат:", (list || []).length, list);
        renderLobbyList();
      });
    }

    function renderQueueStatus() {
      const textEl = document.getElementById("queueStatusText");
      const leaveBtn = document.getElementById("btnQueueLeave");
      const duelBtn = document.getElementById("btnQueueDuel");
      const ffaBtn = document.getElementById("btnQueueFfa4");
      const queue = state._queueStatus || null;
      const active = !!(queue && queue.active);
      if (leaveBtn) leaveBtn.style.display = active ? "inline-block" : "none";
      if (duelBtn) duelBtn.disabled = active;
      if (ffaBtn) ffaBtn.disabled = active;
      if (!textEl) return;
      if (!active) {
        textEl.textContent = "Выбери режим, и сервер начнет подбор матча. Если людей не хватит, через время недостающие слоты будут заполнены ботами.";
        return;
      }
      const modeLabel = queue.matchType === "ffa4" ? "1v1v1v1" : "1v1";
      const queued = queue.playersInQueue || 0;
      const required = queue.requiredPlayers || (queue.matchType === "ffa4" ? 4 : 2);
      const suffix = queue.canFillWithBots
        ? " Таймаут истек: матч может быть добит ботами."
        : " Ищем живых игроков, затем при необходимости добавим ботов.";
      textEl.textContent = "Очередь " + modeLabel + ": " + queued + "/" + required + "." + suffix;
    }

    function setupMenuButtons() {
      const btnSingle = document.getElementById("btnSingle");
      const btnMulti = document.getElementById("btnMulti");
      const nicknameBack = document.getElementById("nicknameBack");
      const nicknameOk = document.getElementById("nicknameOk");
      const multiConnectBack = document.getElementById("multiConnectBack");
      if (!btnMulti) {
        console.error("[Меню] Кнопка #btnMulti не найдена. Проверьте, что index.html загружен целиком.");
        return;
      }
      if (btnSingle) btnSingle.addEventListener("click", () => { state._menuMode = "single"; showScreen("nicknameScreen"); });
      if (btnMulti) btnMulti.addEventListener("click", () => { state._menuMode = "multi"; showScreen("nicknameScreen"); });
      if (nicknameBack) nicknameBack.addEventListener("click", () => showScreen("mainMenu"));
      if (nicknameOk) nicknameOk.addEventListener("click", () => {
        const nick = (nicknameInputEl && nicknameInputEl.value || "").trim().slice(0, 24) || "Игрок";
        state._myNickname = nick;
        if (state._menuMode === "single") {
          showScreen("soloLobbyScreen");
          return;
        }
        showScreen("multiConnectScreen");
      });
      if (multiConnectBack) multiConnectBack.addEventListener("click", () => showScreen("nicknameScreen"));

      const soloLobbyBack = document.getElementById("soloLobbyBack");
      const soloLobbyStart = document.getElementById("soloLobbyStart");
      const soloSpawnPicker = document.getElementById("soloSpawnPicker");
      const renderSoloSpawnPicker = () => {
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
          btn.style.minWidth = "44px";
          btn.textContent = String(i + 1);
          btn.addEventListener("click", () => {
            state._soloSpawnIndex = i;
            renderSoloSpawnPicker();
          });
          soloSpawnPicker.appendChild(btn);
        }
      };
      if (soloLobbyBack) soloLobbyBack.addEventListener("click", () => showScreen("nicknameScreen"));
      if (soloLobbyStart) soloLobbyStart.addEventListener("click", () => {
        const nick = state._myNickname || (typeof window !== "undefined" && window._myNickname) || "Игрок";
        state._quickStartScenario = null;
        state._mapVariation = 1;
        state._soloBotCount = getSoloModeConfig(state._soloGameMode).botCount;
        state._customMapSeed = null;
        startGameSingle(nick);
      });
      renderSoloSpawnPicker();

      const soloModePicker = document.getElementById("soloModePicker");
      if (soloModePicker) {
        const modes = [
          { id: "duel", label: "1 бот", subtitle: "Формат 1v1" },
          { id: "quad", label: "3 бота", subtitle: "Формат 1v1v1v1" }
        ];
        const current = state._soloGameMode || "duel";
        modes.forEach((m, j) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "menu-btn " + (m.id === current ? "primary" : "secondary");
          btn.textContent = m.label;
          btn.title = m.subtitle;
          btn.addEventListener("click", () => {
            state._soloGameMode = m.id;
            state._soloBotCount = getSoloModeConfig(m.id).botCount;
            soloModePicker.querySelectorAll("button").forEach((b, i) => {
              b.className = "menu-btn " + (modes[i].id === m.id ? "primary" : "secondary");
            });
            renderSoloSpawnPicker();
          });
          soloModePicker.appendChild(btn);
        });
      }
    }

    function bindGlobalActions() {
      window.__createRoom = function () {
        if (!socket) {
          alert("Сервер не подключён. Запустите server.js.");
          return;
        }
        state._myNickname = state._myNickname || window._myNickname || nicknameInputEl?.value?.trim() || "Игрок";
        createRoomRequest((data) => {
          if (data.error) {
            alert(data.error);
            return;
          }
          if (matchSession && matchSession.updateLobbyContext) matchSession.updateLobbyContext(data);
          else {
            state._lobbySlots = data.slots;
            state._mySlot = data.mySlot;
            state._isHost = data.isHost;
            state._hostSlot = Number.isInteger(data.hostSlot) ? data.hostSlot : null;
            state._roomId = data.roomId;
          }
          renderLobby();
          showScreen("lobbyScreen");
        });
      };

      window.__joinRoom = function () {
        if (!socket) {
          alert("Сервер не подключён.");
          return;
        }
        const code = (roomCodeInputEl && roomCodeInputEl.value || "").trim();
        if (!code) {
          alert("Введите код комнаты.");
          return;
        }
        state._myNickname = state._myNickname || window._myNickname || nicknameInputEl?.value?.trim() || "Игрок";
        joinRoomRequest(code, (data) => {
          if (data.error) {
            alert(data.error);
            return;
          }
          if (matchSession && matchSession.updateLobbyContext) matchSession.updateLobbyContext(data);
          else {
            state._lobbySlots = data.slots;
            state._mySlot = data.mySlot;
            state._isHost = data.isHost;
            state._roomId = data.roomId;
          }
          renderLobby();
          showScreen("lobbyScreen");
        });
      };

      window.__refreshLobbyList = refreshLobbyList;
    }

    function bindSocketUi() {
      state._socket = socket;
      console.log("[Лобби] Подключение к серверу:", socketUrl, socket ? "OK" : "io не найден");
      if (!socketSession) return;

      socketSession.on("connect", () => console.log("[Лобби] Socket подключён, id:", socket && socket.id));
      socketSession.on("connect_error", (err) => console.error("[Лобби] Ошибка подключения:", err.message || err));
      socketSession.on("disconnect", (reason) => console.log("[Лобби] Socket отключён, причина:", reason));
      socketSession.on("serverUrl", (url) => {
        console.log("[Лобби] Адрес сервера для сети:", url);
        state._serverUrl = url;
        if (lobbyScreenEl && lobbyScreenEl.style.display === "flex") renderLobby();
        const urlEl = document.getElementById("lobbyServerUrl");
        if (urlEl) {
          urlEl.textContent = url;
          urlEl.title = url;
        }
      });
      socketSession.on("slots", (payload) => {
        applyRoomSnapshot(payload);
        if (lobbyScreenEl && lobbyScreenEl.style.display === "flex") renderLobby();
      });
      socketSession.on("queueStatus", (payload) => {
        if (matchSession && matchSession.setQueueStatus) matchSession.setQueueStatus(payload);
        else state._queueStatus = payload || null;
        renderQueueStatus();
      });
      socketSession.on("matchFound", (payload) => {
        if (matchSession && matchSession.updateLobbyContext) {
          matchSession.updateLobbyContext(payload);
          if (Array.isArray(payload.slots)) matchSession.applyRoomSnapshot({ slots: payload.slots, hostSlot: payload.hostSlot });
        } else {
          state._roomId = payload.roomId || state._roomId;
          state._matchId = payload.matchId || state._matchId;
          state._matchType = payload.matchType || state._matchType;
        }
        renderQueueStatus();
      });
      socketSession.on("reconnectGranted", (payload) => {
        if (payload && Array.isArray(payload.slots)) {
          applyRoomSnapshot({ slots: payload.slots, hostSlot: payload.hostSlot });
          renderLobby();
        }
      });
      socketSession.on("startRejected", (message) => {
        alert(message || "Матч можно запускать только в формате 1v1 или 1v1v1v1.");
      });
      socketSession.on("chat", (msg) => {
        const safeText = (msg.text || "").replace(/</g, "&lt;");
        const safeName = msg.name || "?";
        const list = document.getElementById("chatMessages");
        if (list) {
          const div = document.createElement("div");
          div.className = "msg";
          div.innerHTML = "<span class=\"sender\">" + safeName + ":</span> " + safeText;
          list.appendChild(div);
          list.scrollTop = list.scrollHeight;
        }
        const gameList = document.getElementById("gameChatMessages");
        if (gameList && state._multiSlots) {
          const d = document.createElement("div");
          d.className = "msg";
          d.innerHTML = "<span class=\"sender\">" + safeName + ":</span> " + safeText;
          gameList.appendChild(d);
          while (gameList.children.length > 100) gameList.removeChild(gameList.firstChild);
          gameList.scrollTop = gameList.scrollHeight;
          const wrap = document.getElementById("gameChatWrap");
          const collapsed = wrap && wrap.classList.contains("game-chat-collapsed");
          const isOwn = (msg.name || "") === (state._myNickname || "");
          if (collapsed && !isOwn) {
            state._gameChatUnread = (state._gameChatUnread || 0) + 1;
            const badge = document.getElementById("gameChatUnreadBadge");
            if (badge) badge.textContent = state._gameChatUnread > 99 ? "99+" : String(state._gameChatUnread);
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = ctx.createOscillator();
              const g = ctx.createGain();
              osc.connect(g);
              g.connect(ctx.destination);
              osc.frequency.value = 880;
              osc.type = "sine";
              g.gain.setValueAtTime(0.08, ctx.currentTime);
              g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
              osc.start(ctx.currentTime);
              osc.stop(ctx.currentTime + 0.12);
            } catch (_) {}
          }
        }
      });
    }

    function bindLobbyButtons() {
      const queueDuelBtn = document.getElementById("btnQueueDuel");
      const queueFfaBtn = document.getElementById("btnQueueFfa4");
      const queueLeaveBtn = document.getElementById("btnQueueLeave");
      if (queueDuelBtn) {
        queueDuelBtn.addEventListener("click", () => {
          state._myNickname = state._myNickname || window._myNickname || nicknameInputEl?.value?.trim() || "Игрок";
          if (actionGateway && actionGateway.queueJoin) actionGateway.queueJoin("duel", nickForSocket());
        });
      }
      if (queueFfaBtn) {
        queueFfaBtn.addEventListener("click", () => {
          state._myNickname = state._myNickname || window._myNickname || nicknameInputEl?.value?.trim() || "Игрок";
          if (actionGateway && actionGateway.queueJoin) actionGateway.queueJoin("ffa4", nickForSocket());
        });
      }
      if (queueLeaveBtn) {
        queueLeaveBtn.addEventListener("click", () => {
          if (actionGateway && actionGateway.queueLeave) actionGateway.queueLeave();
          if (matchSession && matchSession.clearQueueStatus) matchSession.clearQueueStatus();
          else state._queueStatus = null;
          renderQueueStatus();
        });
      }

      const copyUrlBtn = document.getElementById("lobbyCopyUrl");
      if (copyUrlBtn) {
        copyUrlBtn.addEventListener("click", () => {
          const url = state._serverUrl || window.location.origin;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
              const btn = document.getElementById("lobbyCopyUrl");
              if (btn) {
                const t = btn.textContent;
                btn.textContent = "Скопировано!";
                setTimeout(() => {
                  btn.textContent = t;
                }, 1500);
              }
            });
          } else {
            prompt("Скопируйте адрес:", url);
          }
        });
      }

      const leaveBtn = document.getElementById("lobbyLeave");
      if (leaveBtn) {
        leaveBtn.addEventListener("click", () => {
          if (actionGateway && actionGateway.leaveRoom) actionGateway.leaveRoom();
          state._roomId = null;
          state._mySlot = null;
          state._isHost = false;
          showScreen("multiConnectScreen");
        });
      }

      const startBtn = document.getElementById("lobbyStart");
      if (startBtn) {
        startBtn.addEventListener("click", () => {
          const slots = state._lobbySlots || [];
          const occupiedCount = slots.filter((s) => s && (s.id || s.isBot)).length;
          if (occupiedCount !== 2 && occupiedCount !== 4) {
            alert("Матч можно запускать только в формате 1v1 или 1v1v1v1.");
            return;
          }
          if (actionGateway && actionGateway.startRoom && state._isHost) {
            actionGateway.startRoom((Date.now() >>> 0) + Math.floor(Math.random() * 0xffff));
          }
        });
      }

      const chatInputEl = document.getElementById("chatInput");
      const chatSendBtn = document.getElementById("chatSend");
      if (chatSendBtn) {
        chatSendBtn.addEventListener("click", () => {
          const t = chatInputEl && chatInputEl.value.trim();
          if (t) {
            sendChat(t);
            chatInputEl.value = "";
          }
        });
      }
      if (chatInputEl) {
        chatInputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && chatSendBtn) chatSendBtn.click();
        });
      }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupMenuButtons);
    else setupMenuButtons();
    bindGlobalActions();
    bindSocketUi();
    bindLobbyButtons();
    renderQueueStatus();

    return {
      refreshLobbyList,
      renderLobby
    };
  }

  const api = { install };
  if (typeof window !== "undefined") window.LobbyUI = api;
  if (typeof module !== "undefined") module.exports = api;
})();
