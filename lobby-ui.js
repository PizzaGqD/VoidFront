(function () {
  "use strict";

  function install(deps) {
    const {
      state,
      socket,
      socketUrl,
      showScreen,
      startGameSingle,
      nicknameInputEl,
      roomCodeInputEl,
      lobbyScreenEl,
      LOBBY_COLORS,
      CFG
    } = deps;

    function nickForSocket() {
      return (state._myNickname || window._myNickname || "Игрок").trim().slice(0, 24) || "Игрок";
    }

    function renderLobby() {
      const slotsEl = document.getElementById("lobbySlots");
      const hostBadge = document.getElementById("lobbyHostBadge");
      const roomCodeEl = document.getElementById("lobbyRoomCode");
      const startBtn = document.getElementById("lobbyStart");
      if (!slotsEl) return;
      const slots = state._lobbySlots || [];
      roomCodeEl.textContent = "Код: " + (state._roomId || "").replace("r_", "");
      roomCodeEl.style.display = "inline-block";
      hostBadge.style.display = state._isHost ? "inline-block" : "none";
      startBtn.style.display = state._isHost ? "inline-block" : "none";
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

      const spawnBySlot = new Map();
      const spawnTaken = new Map();
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i] || {};
        if (!s.id && !s.isBot) continue;
        const sp = s.spawnIndex != null ? s.spawnIndex : i;
        spawnBySlot.set(i, sp);
        spawnTaken.set(sp, i);
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

        if (occupied) {
          const curSpawn = spawnBySlot.get(i) ?? i;
          const sel = document.createElement("select");
          sel.className = "slot-spawn-select";
          sel.title = "Позиция спавна";
          for (let sp = 0; sp < slots.length; sp++) {
            const opt = document.createElement("option");
            opt.value = sp;
            opt.textContent = "Поз. " + (sp + 1);
            const takenBy = spawnTaken.get(sp);
            if (takenBy != null && takenBy !== i) opt.disabled = true;
            if (sp === curSpawn) opt.selected = true;
            sel.appendChild(opt);
          }
          const canChange = state._isHost || i === state._mySlot;
          sel.disabled = !canChange;
          const slotIdx = i;
          sel.addEventListener("change", () => {
            const newSp = parseInt(sel.value, 10);
            if (state._isHost && slotIdx !== state._mySlot) socket.emit("setSlotSpawn", slotIdx, newSp);
            else socket.emit("setSpawn", newSp);
          });
          div.appendChild(sel);
        }

        if (state._isHost && i > 0) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "menu-btn secondary";
          btn.style.fontSize = "12px";
          btn.textContent = s.isBot ? "Убрать бота" : "Бот";
          btn.addEventListener("click", () => {
            socket.emit("setSlot", i, !s.isBot);
          });
          div.appendChild(btn);
        }
        slotsEl.appendChild(div);
      }

      const spawnMapEl = document.getElementById("lobbySpawnMap");
      if (spawnMapEl) {
        const SPAWN_COUNT = slots.length || 6;
        const W = (typeof CFG !== "undefined" ? CFG.WORLD_W : 7200) || 7200;
        const H = (typeof CFG !== "undefined" ? CFG.WORLD_H : 4320) || 4320;
        const wCx = W * 0.5;
        const wCy = H * 0.5;
        const wR = Math.min(W, H) * 0.38;
        const spawns = [];
        for (let i = 0; i < SPAWN_COUNT; i++) {
          const angle = (i / SPAWN_COUNT) * Math.PI * 2 - Math.PI / 2;
          spawns.push({ x: wCx + Math.cos(angle) * wR, y: wCy + Math.sin(angle) * wR });
        }
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
        ctx.arc(offX + wCx * scale, offY + wCy * scale, wR * scale, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(100,150,255,0.15)";
        ctx.lineWidth = 1;
        ctx.stroke();

        const DOT_R = 16;
        for (let i = 0; i < spawns.length; i++) {
          const px = offX + spawns[i].x * scale;
          const py = offY + spawns[i].y * scale;
          const ownerSlot = spawnTaken.get(i);
          const occupied = ownerSlot != null;
          const slotData = occupied ? (slots[ownerSlot] || {}) : null;
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
          ctx.fillText(String(i + 1), px, py + 1);

          if (occupied && slotData) {
            const label = slotData.name || (slotData.isBot ? "Бот" : "");
            if (label) {
              ctx.fillStyle = "rgba(255,255,255,0.7)";
              ctx.font = "11px sans-serif";
              ctx.fillText(label.length > 8 ? label.slice(0, 7) + "…" : label, px, py + DOT_R + 12);
            }
          }
        }

        const canEditSpawn = targetSlot != null && (state._isHost || targetSlot === state._mySlot);
        spawnMapEl.style.cursor = canEditSpawn ? "pointer" : "default";
        spawnMapEl.onclick = canEditSpawn ? (ev) => {
          const rect = spawnMapEl.getBoundingClientRect();
          const mx = ev.clientX - rect.left;
          const my = ev.clientY - rect.top;
          let hitSpawn = -1;
          let bestDist2 = (DOT_R + 8) * (DOT_R + 8);
          for (let i = 0; i < spawns.length; i++) {
            const px = offX + spawns[i].x * scale;
            const py = offY + spawns[i].y * scale;
            const dx = mx - px;
            const dy = my - py;
            const d2 = dx * dx + dy * dy;
            if (d2 <= bestDist2) {
              const takenBy = spawnTaken.get(i);
              if (takenBy == null || takenBy === targetSlot) {
                bestDist2 = d2;
                hitSpawn = i;
              }
            }
          }
          if (hitSpawn < 0) return;
          if (state._isHost && targetSlot !== state._mySlot) socket.emit("setSlotSpawn", targetSlot, hitSpawn);
          else socket.emit("setSpawn", hitSpawn);
        } : null;
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
              if (state._isHost && targetSlot !== state._mySlot) socket.emit("setSlotColor", targetSlot, colorIdx);
              else socket.emit("setColor", colorIdx);
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
          const nick = nickForSocket();
          socket.emit("join", r.roomId, nick, (data) => {
            if (data.error) {
              alert(data.error);
              return;
            }
            state._lobbySlots = data.slots;
            state._mySlot = data.mySlot;
            state._isHost = data.isHost;
            state._roomId = data.roomId;
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
      if (!socket) return;
      socket.emit("listRooms", (list) => {
        state._lobbyList = list || [];
        console.log("[Лобби] Список комнат:", (list || []).length, list);
        renderLobbyList();
      });
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
      if (soloLobbyBack) soloLobbyBack.addEventListener("click", () => showScreen("nicknameScreen"));
      if (soloLobbyStart) soloLobbyStart.addEventListener("click", () => {
        const nick = state._myNickname || (typeof window !== "undefined" && window._myNickname) || "Игрок";
        state._quickStartScenario = null;
        startGameSingle(nick);
      });
      if (soloSpawnPicker) {
        const total = 6;
        for (let i = 0; i < total; i++) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "menu-btn " + (i === (state._soloSpawnIndex ?? 0) ? "primary" : "secondary");
          btn.style.minWidth = "44px";
          btn.textContent = String(i + 1);
          btn.addEventListener("click", () => {
            state._soloSpawnIndex = i;
            soloSpawnPicker.querySelectorAll("button").forEach((b, j) => {
              b.className = "menu-btn " + (j === i ? "primary" : "secondary");
              b.style.minWidth = "44px";
            });
          });
          soloSpawnPicker.appendChild(btn);
        }
      }

      const MAP_TYPES = [
        { id: 1, label: "Стандарт", desc: "Сбалансированная карта" },
        { id: 2, label: "Тесная", desc: "Плотная, ранние конфликты" },
        { id: 3, label: "Открытая", desc: "Большие расстояния, редкие ресурсы" },
        { id: 4, label: "Узкие фронты", desc: "Проходы и узкости" },
        { id: 5, label: "Хаос", desc: "Случайные кластеры, непредсказуемо" }
      ];
      const soloMapVariationPicker = document.getElementById("soloMapVariationPicker");
      if (soloMapVariationPicker) {
        for (const mt of MAP_TYPES) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "menu-btn " + (mt.id === (state._mapVariation ?? 1) ? "primary" : "secondary");
          btn.style.minWidth = "80px";
          btn.textContent = mt.label;
          btn.title = mt.desc;
          btn.addEventListener("click", () => {
            state._mapVariation = mt.id;
            soloMapVariationPicker.querySelectorAll("button").forEach((b, j) => {
              b.className = "menu-btn " + (MAP_TYPES[j].id === mt.id ? "primary" : "secondary");
            });
          });
          soloMapVariationPicker.appendChild(btn);
        }
      }

      const seedInput = document.getElementById("soloMapSeedInput");
      const rerollBtn = document.getElementById("soloMapReroll");
      if (rerollBtn) {
        rerollBtn.addEventListener("click", () => {
          const newSeed = (Date.now() >>> 0) ^ (Math.random() * 0xffffffff >>> 0);
          if (seedInput) seedInput.value = newSeed;
          state._customMapSeed = newSeed;
        });
      }
      if (seedInput) {
        seedInput.addEventListener("input", () => {
          const val = seedInput.value.trim();
          state._customMapSeed = val ? (parseInt(val, 10) || 0) : null;
        });
      }

      const soloModePicker = document.getElementById("soloModePicker");
      if (soloModePicker) {
        const modes = [{ id: "standard", label: "Стандарт" }, { id: "survival", label: "Выживание" }];
        const current = state._soloGameMode || "standard";
        modes.forEach((m, j) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "menu-btn " + (m.id === current ? "primary" : "secondary");
          btn.textContent = m.label;
          btn.addEventListener("click", () => {
            state._soloGameMode = m.id;
            soloModePicker.querySelectorAll("button").forEach((b, i) => {
              b.className = "menu-btn " + (modes[i].id === m.id ? "primary" : "secondary");
            });
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
        socket.emit("create", nickForSocket(), (data) => {
          if (data.error) {
            alert(data.error);
            return;
          }
          state._lobbySlots = data.slots;
          state._mySlot = data.mySlot;
          state._isHost = data.isHost;
          state._roomId = data.roomId;
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
        socket.emit("join", code, nickForSocket(), (data) => {
          if (data.error) {
            alert(data.error);
            return;
          }
          state._lobbySlots = data.slots;
          state._mySlot = data.mySlot;
          state._isHost = data.isHost;
          state._roomId = data.roomId;
          renderLobby();
          showScreen("lobbyScreen");
        });
      };

      window.__refreshLobbyList = refreshLobbyList;
    }

    function bindSocketUi() {
      state._socket = socket;
      console.log("[Лобби] Подключение к серверу:", socketUrl, socket ? "OK" : "io не найден");
      if (!socket) return;

      socket.on("connect", () => console.log("[Лобби] Socket подключён, id:", socket.id));
      socket.on("connect_error", (err) => console.error("[Лобби] Ошибка подключения:", err.message || err));
      socket.on("disconnect", (reason) => console.log("[Лобби] Socket отключён, причина:", reason));
      socket.on("serverUrl", (url) => {
        console.log("[Лобби] Адрес сервера для сети:", url);
        state._serverUrl = url;
        if (lobbyScreenEl && lobbyScreenEl.style.display === "flex") renderLobby();
        const urlEl = document.getElementById("lobbyServerUrl");
        if (urlEl) {
          urlEl.textContent = url;
          urlEl.title = url;
        }
      });
      socket.on("slots", (slots) => {
        state._lobbySlots = slots;
        if (lobbyScreenEl && lobbyScreenEl.style.display === "flex") renderLobby();
      });
      socket.on("chat", (msg) => {
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
          if (socket && state._roomId) socket.emit("leave");
          state._roomId = null;
          state._mySlot = null;
          state._isHost = false;
          showScreen("multiConnectScreen");
        });
      }

      const startBtn = document.getElementById("lobbyStart");
      if (startBtn) {
        startBtn.addEventListener("click", () => {
          if (socket && state._isHost) socket.emit("start", { seed: (Date.now() >>> 0) + Math.floor(Math.random() * 0xffff) });
        });
      }

      const chatInputEl = document.getElementById("chatInput");
      const chatSendBtn = document.getElementById("chatSend");
      if (chatSendBtn) {
        chatSendBtn.addEventListener("click", () => {
          const t = chatInputEl && chatInputEl.value.trim();
          if (t && socket) {
            socket.emit("chat", t);
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

    return {
      refreshLobbyList,
      renderLobby
    };
  }

  const api = { install };
  if (typeof window !== "undefined") window.LobbyUI = api;
  if (typeof module !== "undefined") module.exports = api;
})();
