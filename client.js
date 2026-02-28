(async () => {
  // Сокет и меню — синхронно, ДО любого await, чтобы кнопки работали мгновенно
  const state = {
    _menuMode: window._menuMode || null,
    _myNickname: window._myNickname || null,
    _lobbySlots: [],
    _roomId: null,
    _isHost: false,
    _mySlot: null,
    _lobbyList: []
  };
  const socketUrlEarly = window.GAME_SERVER_URL || location.origin;
  const socket = typeof io !== "undefined" ? io(socketUrlEarly, { transports: ["websocket", "polling"] }) : null;
  state._socket = socket;

  const EARLY_LOBBY_COLORS = [0xff6600,0xcc2222,0xffcc00,0x44aa44,0x4488ff,0xaa44cc,0xff8844,0xee4444,0xdddd00,0x22cc66,0x6699ff,0xcc66aa,0xcc4400,0xaa2222,0xaaaa00,0x228844,0x4466dd,0x8844aa,0xffaa66,0xff6666,0xcccc44,0x66cc88,0x88aaff,0xbb88cc,0x993300,0x881111,0x888800,0x116633,0x2244bb,0x663388,0xdd8844,0xcc5555,0xbbbb66,0x44aa66,0x6688dd,0x9966aa];

  function earlyShowScreen(visibleId) {
    ["mainMenu","nicknameScreen","multiConnectScreen","lobbyScreen"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = id === visibleId ? "flex" : "none";
    });
    const gw = document.getElementById("gameWrap");
    if (gw) gw.style.display = visibleId === "gameWrap" ? "block" : "none";
  }

  function earlyRenderLobby() {
    const slotsEl = document.getElementById("lobbySlots");
    if (!slotsEl) return;
    const slots = state._lobbySlots || [];
    const roomCodeEl = document.getElementById("lobbyRoomCode");
    const hostBadge = document.getElementById("lobbyHostBadge");
    const startBtn = document.getElementById("lobbyStart");
    if (roomCodeEl) { roomCodeEl.textContent = "Код: " + (state._roomId || "").replace("r_",""); roomCodeEl.style.display = "inline-block"; }
    if (hostBadge) hostBadge.style.display = state._isHost ? "inline-block" : "none";
    if (startBtn) startBtn.style.display = state._isHost ? "inline-block" : "none";
    slotsEl.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      const s = slots[i] || {};
      const div = document.createElement("div");
      div.className = "lobby-slot" + (!s.id && !s.isBot ? " empty" : "");
      const colorHex = "#" + (EARLY_LOBBY_COLORS[s.colorIndex||0]||0x888888).toString(16).padStart(6,"0");
      div.innerHTML = '<span class="slot-color" style="background:'+colorHex+'"></span><span class="slot-name">'+(s.name||"Пусто")+'</span>'+(s.isBot?'<span class="slot-badge">Бот</span>':"");
      slotsEl.appendChild(div);
    }
  }

  const getNick = () => (state._myNickname || window._myNickname || "Игрок").trim().slice(0,24) || "Игрок";

  window.__createRoom = function() {
    var btn = document.getElementById("btnCreateRoom");
    if (!socket) { alert("Сервер не подключён. Запустите server.js (node server.js)."); return; }
    state._myNickname = state._myNickname || window._myNickname || "Игрок";
    if (btn) { btn.disabled = true; btn.textContent = "Создаём комнату…"; }
    socket.emit("create", getNick(), function(data) {
      if (btn) { btn.disabled = false; btn.textContent = "Создать комнату (я хост)"; }
      if (data.error) { alert(data.error); return; }
      state._lobbySlots = data.slots; state._mySlot = data.mySlot;
      state._isHost = data.isHost; state._roomId = data.roomId;
      earlyRenderLobby(); earlyShowScreen("lobbyScreen");
    });
  };

  window.__joinRoom = function() {
    if (!socket) { alert("Сервер не подключён."); return; }
    const codeEl = document.getElementById("roomCodeInput");
    const code = (codeEl && codeEl.value || "").trim();
    if (!code) { alert("Введите код комнаты."); return; }
    state._myNickname = state._myNickname || window._myNickname || "Игрок";
    socket.emit("join", code, getNick(), function(data) {
      if (data.error) { alert(data.error); return; }
      state._lobbySlots = data.slots; state._mySlot = data.mySlot;
      state._isHost = data.isHost; state._roomId = data.roomId;
      earlyRenderLobby(); earlyShowScreen("lobbyScreen");
    });
  };

  window.__refreshLobbyList = function() {
    if (!socket) return;
    socket.emit("listRooms", function(list) {
      state._lobbyList = list || [];
      const listEl = document.getElementById("lobbyList");
      if (!listEl) return;
      listEl.innerHTML = "";
      (list || []).forEach(function(r) {
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = "menu-btn lobby-list-item";
        btn.textContent = (r.code||"")+" — "+(r.hostName||"?")+" ("+(r.slotsUsed||0)+"/"+(r.slotsTotal||5)+")";
        btn.addEventListener("click", function() {
          socket.emit("join", r.roomId||r.code, getNick(), function(data) {
            if (data.error) { alert(data.error); return; }
            state._lobbySlots = data.slots; state._mySlot = data.mySlot;
            state._isHost = data.isHost; state._roomId = data.roomId;
            earlyRenderLobby(); earlyShowScreen("lobbyScreen");
          });
        });
        listEl.appendChild(btn);
      });
      if (!list || !list.length) { const p = document.createElement("p"); p.className = "muted"; p.textContent = "Нет открытых комнат."; listEl.appendChild(p); }
    });
  };

  console.log("[Меню] Сокет готов, __createRoom задан (кнопки через onclick в HTML).");

  // ------------------------------------------------------------
  // Balance: load from JSON (all parameters, no magic numbers)
  // ------------------------------------------------------------
  let balance = {};
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch("shared/balance.json", { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) balance = await res.json();
  } catch (e) {
    if (e.name !== "AbortError") console.warn("balance.json:", e.message || "using defaults");
  }

  const w = balance.world || {};
  const camB = balance.camera || {};
  const botsB = balance.bots || {};
  const cityB = balance.city || {};
  const unitB = balance.unit || {};
  const formB = balance.formation || {};
  const terrainB = balance.terrain || {};
  const waterB = balance.waterBonus || {};
  const resB = balance.resources || {};
  const xpB = balance.xp || {};
  const mapB = balance.map || {};
  const fogB = balance.fog || {};
  const zonesB = balance.zones || {};
  const gridB = balance.grid || {};

  const CFG = {
    GAME_SPEED: 4,
    WORLD_W: w.width ?? 5000,
    WORLD_H: w.height ?? 3000,
    CAMERA_START_ZOOM: camB.startZoom ?? 0.35,
    BOTS: 6,
    BOT_THINK_INTERVAL: botsB.thinkIntervalSeconds ?? 0.8,
    BOT_SEND_DELAY: 0.6,

    POP_START: 150,

    GROWTH_BASE_PER_MIN: cityB.baseGrowthPerMinute ?? 2,
    GROWTH_PER_100: cityB.growthPer100Population ?? 1.5,
    ACTIVE_SOLDIER_PENALTY_PER: cityB.activeUnitPenaltyPercent ?? 0.005,
    ACTIVE_SOLDIER_PENALTY_CAP: cityB.activeUnitPenaltyCap ?? 0.5,
    SEND_COOLDOWN_BASE: 0.5,
    SEND_COOLDOWN_PER_UNIT: 2.5,
    SEND_COOLDOWN_MIN: 2,
    SEND_COOLDOWN_MAX: 60,
    INFLUENCE_BASE_R: (cityB.influenceBaseRadius ?? 80) * 3,
    INFLUENCE_POP_FACTOR: cityB.influencePopFactor ?? 1.1,
    INFLUENCE_GROWTH_SPEED: 6.0,
    INFLUENCE_ARMY_MARGIN: 42,

    TURRET_SPACING: 55,
    TURRET_ATTACK_RADIUS: 45,
    TURRET_ATTACK_RATE: 1.2,
    TURRET_ATTACK_DMG: 3,
    TURRET_HP_RATIO: 0.35,
    CITY_DAMAGE_RADIUS: cityB.damageRadius ?? 25,
    CITY_DAMAGE_PER_UNIT_PER_S: cityB.damagePerUnitPerSecond ?? 1.5,
    CITY_ATTACK_RADIUS: 100,
    CITY_ATTACK_RATE: 0.38,
    CITY_ATTACK_DMG: 4,
    CITY_BULLET_SPEED: 60,
    CITY_TARGETS_POP_DIVISOR: 75,

    UNIT_SPEED: unitB.speed ?? 9,
    UNIT_HP: unitB.hp ?? 25,
    UNIT_DMG: unitB.damage ?? 1,
    UNIT_ATK_RATE: unitB.attackRatePerSecond ?? 1.3,
    UNIT_ATK_RANGE: unitB.attackRange ?? 5,
    ACTIVITY_RADIUS: unitB.activityRadius ?? 28,
    UNIT_VISION: unitB.visionRadius ?? 40,
    UNIT_PICKUP: unitB.pickupRadius ?? 7,
    UNIT_POP_PER: unitB.populationPerUnit ?? 8,
    UNIT_DEATH_POP_PENALTY: unitB.deathPopulationPenalty ?? 1,

    FORM_SPACING_X: formB.horizontalSpacing ?? 14,
    FORM_SPACING_Y: formB.verticalSpacing ?? 18,

    TERRAIN_RAYS: terrainB.influenceNumRays ?? 96,
    TERRAIN_STEP: terrainB.influenceStepSize ?? 2,
    TERRAIN_TYPES: terrainB.types || {
      deepWater: { speedMultiplier: 0.3, influenceCost: 3 },
      shallowWater: { speedMultiplier: 0.6, influenceCost: 2 },
      lowland: { speedMultiplier: 1.35, influenceCost: 0.75 },
      hill: { speedMultiplier: 0.9, influenceCost: 1.2 },
      mountain: { speedMultiplier: 0.7, influenceCost: 1.55 }
    },

    WATER_RATIO_THRESHOLD: waterB.waterRatioThreshold ?? 0.4,
    WATER_GROWTH_BONUS: waterB.growthBonus ?? 0.5,
    WATER_PENALTY_REDUCTION: waterB.penaltyReduction ?? 0.15,

    RES_MAGNET_SPEED: resB.magnetSpeed ?? 6,
    RES_SPAWN_PER_S: resB.spawnPerSecond ?? 1.5,
    RES_SPAWN_BURST_EVERY_S: resB.spawnBurstEverySeconds ?? 20,
    RES_SPAWN_BURST_COUNT: resB.spawnBurstCount ?? 50,
    RES_MAX: resB.maxTotal ?? 700,
    RES_CENTER_BIAS: resB.centerBias ?? 0.55,
    RAINBOW_FLEE_SPEED: resB.rainbowFleeSpeed ?? 3,
    RAINBOW_FLEE_DIST: resB.rainbowFleeDistance ?? 30,
    RES_TYPES: (resB.types || []).map(t => ({
      id: t.id,
      xp: t.xp,
      p: t.spawnWeight ?? 0.25,
      color: typeof t.color === "number" ? t.color : parseInt(String(t.color).replace(/^0x/, ""), 16)
    })),
    RES_TYPES_DEFAULT: [
      { id: "blue", xp: 2, p: 0.68, color: 0x66a3ff },
      { id: "green", xp: 8, p: 0.2, color: 0x55ff99 },
      { id: "red", xp: 15, p: 0.09, color: 0xff5a5a },
      { id: "rainbow", xp: 60, p: 0.03, color: 0xffffff }
    ],

    XP_BASE: xpB.baseNextLevel ?? 80,
    XP_PER_LEVEL: xpB.perLevelFactor ?? 8,
    XP_LEVEL_MUL: xpB.levelMultiplier ?? 1.05,

    MAP_TEX_W: mapB.textureWidth ?? 1600,
    MAP_TEX_H: mapB.textureHeight ?? 1000,
    LAND_THRESHOLD: mapB.landThreshold ?? 0.08,
    FALLOFF_STRENGTH: mapB.falloffStrength ?? 1.15,
    FALLOFF_AMOUNT: mapB.falloffAmount ?? 0.65,

    FOG_ENABLED: fogB.enabled !== false,
    FOG_UNSEEN_ALPHA: fogB.unseenAlpha ?? 0.92,
    FOG_SEEN_ALPHA: fogB.seenAlpha ?? 0.55,
    ZONES_ENABLED: zonesB.enabled !== false,
    GRID_ENABLED: gridB.enabled === true,
    GRID_STEP: gridB.step ?? 100,
  };

  if (!CFG.RES_TYPES.length) CFG.RES_TYPES = CFG.RES_TYPES_DEFAULT;
  CFG.INFLUENCE_R = (pop) => CFG.INFLUENCE_BASE_R + CFG.INFLUENCE_POP_FACTOR * pop;

  const PLAYER_NAMES = { 1: "You", 2: "Kindred", 3: "Yoshi", 4: "Bobby", 5: "Garfield", 6: "Raven", 7: "Blitz" };
  const PLAYER_COLORS = { 1: 0xff8800, 2: 0xcc2222, 3: 0xddcc00, 4: 0x4488ff, 5: 0x22aa44, 6: 0xaa44cc, 7: 0x44cccc };

  const LOBBY_COLORS = [
    0xff6600, 0xcc2222, 0xffcc00, 0x44aa44, 0x4488ff, 0xaa44cc,
    0xff8844, 0xee4444, 0xdddd00, 0x22cc66, 0x6699ff, 0xcc66aa,
    0xcc4400, 0xaa2222, 0xaaaa00, 0x228844, 0x4466dd, 0x8844aa,
    0xffaa66, 0xff6666, 0xcccc44, 0x66cc88, 0x88aaff, 0xbb88cc,
    0x993300, 0x881111, 0x888800, 0x116633, 0x2244bb, 0x663388,
    0xdd8844, 0xcc5555, 0xbbbb66, 0x44aa66, 0x6688dd, 0x9966aa
  ];

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------
  const fpsEl = document.getElementById("fps");
  // city/army stats are split into two elements, see updateHUD
  const sendCountEl = document.getElementById("sendCount");
  const sendCountValEl = document.getElementById("sendCountVal");
  const sendBtn = document.getElementById("sendBtn");
  const resetCamBtn = document.getElementById("resetCamBtn");
  const regenBtn = document.getElementById("regenBtn");
  const toggleZonesBtn = document.getElementById("toggleZones");
  const toggleGridBtn = document.getElementById("toggleGrid");
  const leaderboardBody = document.getElementById("leaderboardBody");
  const mergeSquadBtn = document.getElementById("mergeSquadBtn");
  const splitSquadBtn = document.getElementById("splitSquadBtn");
  const formationSelect = document.getElementById("formationSelect");
  const formationRowsEl = document.getElementById("formationRows");
  const formationSelectMulti = document.getElementById("formationSelectMulti");
  const formationRowsMultiEl = document.getElementById("formationRowsMulti");
  const squadControlBox = document.getElementById("squadControlBox");
  const squadControlOne = document.getElementById("squadControlOne");
  const squadControlMulti = document.getElementById("squadControlMulti");
  const squadStripEl = document.getElementById("squadStrip");
  const rallyPointBtn = document.getElementById("rallyPointBtn");
  const rallyPointHintEl = document.getElementById("rallyPointHint");

  if (rallyPointBtn) rallyPointBtn.addEventListener("click", () => {
    state.rallyPointMode = true;
    if (rallyPointHintEl) rallyPointHintEl.textContent = "Кликните по карте — куда по умолчанию идут отряды.";
  });

  sendCountEl.addEventListener("input", () => (sendCountValEl.textContent = sendCountEl.value));

  function applyFormationToSquad(squad, formationType, formationRows, dirX, dirY, formationPigWidth) {
    const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
    let vx, vy;
    if (dirX != null && dirY != null) {
      [vx, vy] = norm(dirX, dirY);
    } else {
      [vx, vy] = leader.waypoints && leader.waypoints.length ? norm(leader.waypoints[0].x - leader.x, leader.waypoints[0].y - leader.y) : norm(1, 0);
    }
    const pigW = formationPigWidth ?? leader.formationPigWidth ?? 1;
    const offsets = getFormationOffsets(squad.length, formationType, formationRows, vx, vy, pigW);
    leader.formationType = formationType;
    leader.formationRows = formationRows;
    if (formationType === "pig") leader.formationPigWidth = pigW;
    for (let i = 0; i < squad.length; i++) {
      const u = squad[i];
      u.formationOffsetX = i === 0 ? 0 : (offsets[i]?.x ?? 0);
      u.formationOffsetY = i === 0 ? 0 : (offsets[i]?.y ?? 0);
    }
  }

  function applyOrDeferFormation(squad, formationType, formationRows, formationPigWidth) {
    const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
    const wp = leader.waypoints;
    const idx = leader.waypointIndex ?? 0;
    const dirX = wp && idx < wp.length && wp[idx] ? wp[idx].x - leader.x : null;
    const dirY = wp && idx < wp.length && wp[idx] ? wp[idx].y - leader.y : null;
    applyFormationToSquad(squad, formationType, formationRows, dirX, dirY, formationPigWidth);
  }

  const formationLineRowEl = document.getElementById("formationLineRow");
  const formationPigRowEl = document.getElementById("formationPigRow");
  const formationPigDepthValEl = document.getElementById("formationPigDepthVal");
  const formationPigWidthValEl = document.getElementById("formationPigWidthVal");
  function getFormationValuesFromUI(single) {
    const sel = single ? formationSelect : formationSelectMulti;
    const rowsEl = single ? formationRowsEl : formationRowsMultiEl;
    const type = (sel && sel.value) || "pig";
    let rows = parseInt(rowsEl?.value ?? 1, 10) || 1;
    let pigW = 1;
    if (type === "pig") {
      const depthEl = single ? formationPigDepthValEl : document.getElementById("formationPigDepthValMulti");
      const widthEl = single ? formationPigWidthValEl : document.getElementById("formationPigWidthValMulti");
      if (depthEl) rows = parseInt(depthEl.textContent, 10) || 3;
      if (widthEl) pigW = parseFloat(widthEl.textContent) || 1;
    }
    return { formationType: type, formationRows: rows, formationPigWidth: pigW };
  }
  function setFormationUIFromLeader(leader) {
    if (!leader) return;
    const type = leader.formationType || "pig";
    const rows = leader.formationRows ?? (type === "line" ? 2 : 3);
    const pigW = leader.formationPigWidth ?? 1;
    if (formationSelect) formationSelect.value = type;
    if (formationRowsEl) formationRowsEl.value = String(rows);
    if (formationPigDepthValEl) formationPigDepthValEl.textContent = String(rows);
    if (formationPigWidthValEl) formationPigWidthValEl.textContent = pigW.toFixed(1);
    if (formationSelectMulti) formationSelectMulti.value = type;
    if (formationRowsMultiEl) formationRowsMultiEl.value = String(rows);
    const pigWElM = document.getElementById("formationPigWidthValMulti");
    const pigDepthM = document.getElementById("formationPigDepthValMulti");
    if (pigDepthM) pigDepthM.textContent = String(rows);
    if (pigWElM) pigWElM.textContent = pigW.toFixed(1);
    if (formationLineRowEl) formationLineRowEl.style.display = type === "line" ? "" : "none";
    if (formationPigRowEl) formationPigRowEl.style.display = type === "pig" ? "" : "none";
    const lineRowM = document.getElementById("formationLineRowMulti");
    const pigRowM = document.getElementById("formationPigRowMulti");
    if (lineRowM) lineRowM.style.display = type === "line" ? "" : "none";
    if (pigRowM) pigRowM.style.display = type === "pig" ? "" : "none";
  }
  function setupFormationButtons(single) {
    const minus = document.getElementById(single ? "formationRowsMinus" : "formationRowsMinusMulti");
    const plus = document.getElementById(single ? "formationRowsPlus" : "formationRowsPlusMulti");
    const rowsEl = single ? formationRowsEl : formationRowsMultiEl;
    const apply = () => {
      const squads = getSelectedSquads();
      if (single && squads.length !== 1) return;
      if (!single && squads.length < 2) return;
      const v = getFormationValuesFromUI(single);
      for (const squad of squads) applyOrDeferFormation(squad, v.formationType, v.formationRows, v.formationPigWidth);
    };
    if (minus && rowsEl) { minus.onclick = () => { const n = Math.max(1, parseInt(rowsEl.value, 10) - 1); rowsEl.value = n; apply(); }; }
    if (plus && rowsEl) { plus.onclick = () => { const n = Math.min(20, parseInt(rowsEl.value, 10) + 1); rowsEl.value = n; apply(); }; }
  }
  function setupPigFormationButtons(single) {
    const depthMinus = document.getElementById(single ? "formationPigDepthMinus" : "formationPigDepthMinusMulti");
    const depthPlus = document.getElementById(single ? "formationPigDepthPlus" : "formationPigDepthPlusMulti");
    const widthMinus = document.getElementById(single ? "formationPigWidthMinus" : "formationPigWidthMinusMulti");
    const widthPlus = document.getElementById(single ? "formationPigWidthPlus" : "formationPigWidthPlusMulti");
    const depthVal = single ? formationPigDepthValEl : document.getElementById("formationPigDepthValMulti");
    const widthVal = single ? formationPigWidthValEl : document.getElementById("formationPigWidthValMulti");
    const apply = () => {
      const squads = getSelectedSquads();
      if (single && squads.length !== 1) return;
      if (!single && squads.length < 2) return;
      const v = getFormationValuesFromUI(single);
      for (const squad of squads) applyOrDeferFormation(squad, v.formationType, v.formationRows, v.formationPigWidth);
    };
    if (depthMinus && depthVal) depthMinus.onclick = () => { const n = Math.max(1, parseInt(depthVal.textContent, 10) - 1); depthVal.textContent = n; apply(); };
    if (depthPlus && depthVal) depthPlus.onclick = () => { const n = Math.min(15, parseInt(depthVal.textContent, 10) + 1); depthVal.textContent = n; apply(); };
    if (widthMinus && widthVal) widthMinus.onclick = () => { const w = Math.max(0.5, (parseFloat(widthVal.textContent) || 1) - 0.2); widthVal.textContent = w.toFixed(1); apply(); };
    if (widthPlus && widthVal) widthPlus.onclick = () => { const w = Math.min(2, (parseFloat(widthVal.textContent) || 1) + 0.2); widthVal.textContent = w.toFixed(1); apply(); };
  }
  if (formationSelect) formationSelect.addEventListener("change", () => {
    const type = formationSelect.value;
    if (formationLineRowEl) formationLineRowEl.style.display = type === "line" ? "" : "none";
    if (formationPigRowEl) formationPigRowEl.style.display = type === "pig" ? "" : "none";
    const squads = getSelectedSquads();
    if (squads.length === 1) { const v = getFormationValuesFromUI(true); applyOrDeferFormation(squads[0], v.formationType, v.formationRows, v.formationPigWidth); }
  });
  setupFormationButtons(true);
  setupFormationButtons(false);
  setupPigFormationButtons(true);
  setupPigFormationButtons(false);
  if (formationSelectMulti) formationSelectMulti.addEventListener("change", () => {
    const type = formationSelectMulti.value;
    const lineRowM = document.getElementById("formationLineRowMulti");
    const pigRowM = document.getElementById("formationPigRowMulti");
    if (lineRowM) lineRowM.style.display = type === "line" ? "" : "none";
    if (pigRowM) pigRowM.style.display = type === "pig" ? "" : "none";
    const squads = getSelectedSquads();
    if (squads.length >= 2) { const v = getFormationValuesFromUI(false); for (const squad of squads) applyOrDeferFormation(squad, v.formationType, v.formationRows, v.formationPigWidth); }
  });
  if (formationRowsEl) formationRowsEl.addEventListener("input", () => {
    const squads = getSelectedSquads();
    if (squads.length !== 1) return;
    const v = getFormationValuesFromUI(true);
    applyOrDeferFormation(squads[0], v.formationType, v.formationRows, v.formationPigWidth);
  });
  if (formationRowsMultiEl) formationRowsMultiEl.addEventListener("input", () => {
    const squads = getSelectedSquads();
    if (squads.length < 2) return;
    const v = getFormationValuesFromUI(false);
    for (const squad of squads) applyOrDeferFormation(squad, v.formationType, v.formationRows, v.formationPigWidth);
  });

  if (mergeSquadBtn) mergeSquadBtn.addEventListener("click", () => {
    const ids = [...state.selectedUnitIds].filter(id => state.units.get(id)?.owner === state.myPlayerId);
    if (ids.length < 2) return;
    const units = ids.map(id => state.units.get(id)).filter(Boolean);
    const leader = units[0];
    const [vx, vy] = norm(1, 0);
    const waypoints = [{ x: leader.x + vx * 280, y: leader.y + vy * 280 }];
    const formationType = (formationSelectMulti && formationSelectMulti.value) || (formationSelect && formationSelect.value) || "pig";
    const formationRows = parseInt(formationRowsMultiEl?.value ?? formationRowsEl?.value ?? 1, 10) || 1;
    const pigW = leader.formationPigWidth ?? 1;
    const offsets = getFormationOffsets(units.length, formationType, formationRows, vx, vy, pigW);
    const leaderId = leader.id;
    leader.leaderId = null;
    leader.formationType = formationType;
    leader.formationRows = formationRows;
    if (formationType === "pig") leader.formationPigWidth = pigW;
    leader.waypoints = waypoints.map(w => ({ x: w.x, y: w.y }));
    leader.waypointIndex = 0;
    leader.straightMode = false;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      u.leaderId = i === 0 ? null : leaderId;
      u.formationOffsetX = i === 0 ? 0 : (offsets[i]?.x ?? 0);
      u.formationOffsetY = i === 0 ? 0 : (offsets[i]?.y ?? 0);
      u.waypoints = waypoints.map(w => ({ x: w.x, y: w.y }));
      u.waypointIndex = 0;
      u.straightMode = false;
    }
    if (state._multiSlots && !state._multiIsHost && state._socket) {
      state._socket.emit("playerAction", {
        type: "mergeSquad",
        pid: state.myPlayerId,
        unitIds: units.map(u => u.id),
        formationType,
        formationRows,
        formationPigWidth: pigW,
        waypoints
      });
    }
  });

  function doSplitSquad() {
    const squads = getSelectedSquads();
    if (squads.length !== 1 || squads[0].length < 2) return;
    const squad = squads[0].slice();
    const n = squad.length;
    const k = Math.floor(n / 2);
    const first = squad.slice(0, k);
    const second = squad.slice(k, n);
    const centerIdx = (arr) => Math.min(Math.floor((arr.length - 1) / 2), arr.length - 1);
    const leader1 = first[centerIdx(first)];
    const leader2 = second[centerIdx(second)];
    for (const u of first) {
      u.leaderId = leader1.id;
      u.formationOffsetX = 0;
      u.formationOffsetY = 0;
    }
    leader1.leaderId = null;
    for (const u of second) {
      u.leaderId = leader2.id;
      u.formationOffsetX = 0;
      u.formationOffsetY = 0;
    }
    leader2.leaderId = null;
    applyFormationToSquad(first, leader1.formationType || "pig", leader1.formationRows ?? 1, null, null, leader1.formationPigWidth);
    applyFormationToSquad(second, leader2.formationType || "pig", leader2.formationRows ?? 1, null, null, leader2.formationPigWidth);
    if (state._multiSlots && !state._multiIsHost && state._socket) {
      state._socket.emit("playerAction", { type: "splitSquad", leader1Id: leader1.id, leader2Id: leader2.id, unitIds: squad.map(u => u.id) });
    }
  }
  if (splitSquadBtn) splitSquadBtn.addEventListener("click", doSplitSquad);
  const splitSquadBtnOne = document.getElementById("splitSquadBtnOne");
  if (splitSquadBtnOne) splitSquadBtnOne.addEventListener("click", doSplitSquad);

  function updateSquadControlBox() {
    const squads = getSelectedSquads();
    if (!squadControlBox) return;
    if (squads.length === 0) {
      squadControlBox.style.display = "none";
      return;
    }
    squadControlBox.style.display = "";
    if (squads.length === 1) {
      if (squadControlOne) squadControlOne.style.display = "";
      if (squadControlMulti) squadControlMulti.style.display = "none";
      const leader = squads[0].find(u => (u.leaderId || u.id) === (squads[0][0].leaderId || squads[0][0].id)) || squads[0][0];
      setFormationUIFromLeader(leader);
    } else {
      if (squadControlOne) squadControlOne.style.display = "none";
      if (squadControlMulti) squadControlMulti.style.display = "";
      if (squads.length >= 2) {
        const leader = squads[0].find(u => (u.leaderId || u.id) === (squads[0][0].leaderId || squads[0][0].id)) || squads[0][0];
        setFormationUIFromLeader(leader);
      }
    }
  }

  function squadStrength(squad) {
    let hp = 0, dps = 0;
    for (const u of squad) {
      hp += u.hp;
      dps += (u.dmg != null ? u.dmg : CFG.UNIT_DMG) * CFG.UNIT_ATK_RATE;
    }
    return Math.round(hp + dps * 4);
  }

  function updateSquadStrip() {
    if (!squadStripEl) return;
    const squads = getSquads().filter(s => s.length > 0 && s[0].owner === state.myPlayerId);
    squadStripEl.innerHTML = "";
    squads.forEach((squad, idx) => {
      const leaderId = squad[0].leaderId || squad[0].id;
      const bindNum = Object.keys(state.squadBinds).find(k => state.squadBinds[k] === leaderId);
      const isSelected = state.selectedUnitIds.has(squad[0].id) || squad.some(u => state.selectedUnitIds.has(u.id));
      const btn = document.createElement("button");
      btn.className = "squad-pill" + (isSelected ? " selected" : "");
      let hp = 0;
      for (const u of squad) hp += u.hp;
      const strength = squadStrength(squad);
      btn.innerHTML = (bindNum ? `[${bindNum}] ` : "") + "Отряд " + squad.length + " · <span class=\"squad-strength\">" + strength + "</span>";
      btn.dataset.leaderId = leaderId;
      btn.addEventListener("click", () => {
        state.selectedUnitIds.clear();
        for (const u of squad) state.selectedUnitIds.add(u.id);
        updateSquadControlBox();
      });
      squadStripEl.appendChild(btn);
    });
  }

  window.addEventListener("keydown", (e) => {
    const digit = e.key >= "1" && e.key <= "9" ? parseInt(e.key, 10) : null;
    if (digit) {
      if (e.ctrlKey || e.metaKey) {
        const squads = getSelectedSquads();
        if (squads.length === 1) {
          state.squadBinds[String(digit)] = squads[0][0].leaderId || squads[0][0].id;
          e.preventDefault();
        }
      } else {
        const lid = state.squadBinds[String(digit)];
        if (lid) {
          state.selectedUnitIds.clear();
          for (const u of state.units.values()) {
            if (u.owner === state.myPlayerId && (u.leaderId || u.id) === lid) state.selectedUnitIds.add(u.id);
          }
          updateSquadControlBox();
          e.preventDefault();
        }
      }
    }
  });

  // ------------------------------------------------------------
  // Audio: tiny tick on XP pickup (no external files)
  // ------------------------------------------------------------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  }
  function tickSound(freq = 880, dur = 0.03, gain = 0.04) {
    if (!audioCtx || audioCtx.state !== "running") return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.01);
  }
  function levelUpSound() {
    if (!audioCtx || audioCtx.state !== "running") return;
    const t0 = audioCtx.currentTime;
    const notes = [523, 659, 784, 1047];
    for (let i = 0; i < notes.length; i++) {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = "triangle";
      const start = t0 + i * 0.08;
      osc.frequency.setValueAtTime(notes[i], start);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.08, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
      osc.connect(g).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    }
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => Math.random() * (b - a) + a;
  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5) >>> 0;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      return ((t ^ (t >>> 22)) >>> 0) / 4294967296;
    };
  }

  function hslToHex(h, s, l) {
    h /= 360;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    const r = Math.round(f(0) * 255), g = Math.round(f(8) * 255), b = Math.round(f(4) * 255);
    return (r << 16) | (g << 8) | b;
  }
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };
  const norm = (dx, dy) => {
    const l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  };

  function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return {
      r: Math.round(255 * f(0)),
      g: Math.round(255 * f(8)),
      b: Math.round(255 * f(4))
    };
  }
  function colorForId(id) {
    if (PLAYER_COLORS[id] != null) return PLAYER_COLORS[id];
    const h = (id * 137.508) % 360;
    const { r, g, b } = hslToRgb(h, 78, 55);
    return (r << 16) | (g << 8) | b;
  }
  function nameForId(id) {
    return PLAYER_NAMES[id] ?? ("Bot#" + id);
  }

  // ------------------------------------------------------------
  // Pixi App
  // ------------------------------------------------------------
	const app = new PIXI.Application();

	await app.init({
	  resizeTo: window,
	  antialias: true,
	  background: 0x070a12
	});

	document.body.appendChild(app.canvas);
	app.canvas.style.cssText = "position:fixed;inset:0;z-index:0;";
  // Layers
  const world = new PIXI.Container();
  const mapLayer = new PIXI.Container();
  const gridLayer = new PIXI.Container();
  const zonesLayer = new PIXI.Container();
  const resLayer = new PIXI.Container();
  const unitsLayer = new PIXI.Container();
  const cityLayer = new PIXI.Container();
  const fogLayer = new PIXI.Container();

  const turretLayer = new PIXI.Container();
  const activityZoneLayer = new PIXI.Container();
  const squadLabelsLayer = new PIXI.Container();
  const combatLayer = new PIXI.Container();
  const floatingDamageLayer = new PIXI.Container();
  const bulletsLayer = new PIXI.Container();
  const ghostLayer = new PIXI.Container();
  const pathPreviewLayer = new PIXI.Container();
  const selectionBoxLayer = new PIXI.Container();
  world.addChild(mapLayer, gridLayer, zonesLayer, turretLayer, resLayer, activityZoneLayer, unitsLayer, cityLayer, squadLabelsLayer, combatLayer, floatingDamageLayer, bulletsLayer, ghostLayer);
  world.addChild(fogLayer);
  world.addChild(pathPreviewLayer, selectionBoxLayer);
  fogLayer.visible = false;
  app.stage.addChild(world);

  // Glow filter for primitives
  const GlowFilter = PIXI.filters.GlowFilter || (pixiFilters && pixiFilters.GlowFilter);
  function makeGlow(color = 0xffffff, distance = 16, outerStrength = 2) {
    if (!GlowFilter) return null;
    return new GlowFilter({
      distance,
      outerStrength,
      innerStrength: 0.0,
      color,
      quality: 0.5
    });
  }

  // Camera state
  const cam = {
    x: 0,
    y: 0,
    zoom: CFG.CAMERA_START_ZOOM
  };

  function applyCamera() {
    world.scale.set(cam.zoom);
    world.position.set(cam.x, cam.y);
  }

  // Center world initially
  function centerOn(x, y) {
    cam.x = app.renderer.width * 0.5 - x * cam.zoom;
    cam.y = app.renderer.height * 0.5 - y * cam.zoom;
    applyCamera();
  }

  // ------------------------------------------------------------
  // Map generation (HoI-ish): land/sea + height shading
  // ------------------------------------------------------------
  let mapSprite = null;
  let mapSeed = (Date.now() >>> 0);

  function hash2(ix, iy, seed) {
    let x = ix | 0, y = iy | 0;
    let h = seed ^ (x * 374761393) ^ (y * 668265263);
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const smoothstep = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;

  function valueNoise(x, y, freq, seed) {
    const fx = x * freq;
    const fy = y * freq;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = smoothstep(fx - x0);
    const ty = smoothstep(fy - y0);

    const v00 = hash2(x0, y0, seed);
    const v10 = hash2(x0 + 1, y0, seed);
    const v01 = hash2(x0, y0 + 1, seed);
    const v11 = hash2(x0 + 1, y0 + 1, seed);

    const a = lerp(v00, v10, tx);
    const b = lerp(v01, v11, tx);
    return lerp(a, b, ty);
  }

  function fbm(x, y, seed) {
    let a = 0.5;
    let f = 1.0;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < 5; i++) {
      const n = valueNoise(x, y, 0.0022 * f, seed + i * 1337);
      sum += n * a;
      norm += a;
      a *= 0.55;
      f *= 2.05;
    }
    return sum / norm;
  }

  /** Terrain type at world (wx, wy). Used for speed multiplier and influence cost. */
  function getTerrainType(wx, wy) {
    const nx = wx / CFG.WORLD_W;
    const ny = wy / CFG.WORLD_H;
    const dx = (nx - 0.52);
    const dy = (ny - 0.52);
    const falloff = Math.sqrt(dx * dx + dy * dy) * (CFG.FALLOFF_STRENGTH || 1.15);
    let n = fbm(wx, wy, mapSeed);
    n = n - falloff * (CFG.FALLOFF_AMOUNT ?? 0.65);
    const lt = CFG.LAND_THRESHOLD ?? 0.08;
    if (n <= lt - 0.08) return "deepWater";
    if (n <= lt) return "shallowWater";
    const t = clamp((n - lt) / 0.55, 0, 1);
    if (t < 0.35) return "lowland";
    if (t < 0.75) return "hill";
    return "mountain";
  }

  function getTerrainSpeedMultiplier(wx, wy) {
    const type = getTerrainType(wx, wy);
    const t = CFG.TERRAIN_TYPES[type];
    return t ? t.speedMultiplier : 1;
  }

  function getTerrainInfluenceCost(wx, wy) {
    const type = getTerrainType(wx, wy);
    const t = CFG.TERRAIN_TYPES[type];
    return t ? t.influenceCost : 1;
  }

  // ---- Viewport culling ----
  function getViewport() {
    const s = world.scale.x || 1;
    const wx = -world.x / s;
    const wy = -world.y / s;
    const ww = app.screen.width / s;
    const wh = app.screen.height / s;
    return { x: wx - 100, y: wy - 100, x2: wx + ww + 100, y2: wy + wh + 100 };
  }
  function inView(x, y) {
    const v = state._vp;
    return v && x >= v.x && x <= v.x2 && y >= v.y && y <= v.y2;
  }

  // ---- Shared spatial hash (rebuilt once per frame) ----
  const SHASH_CELL = 48;
  const _shash = new Map();
  function rebuildSpatialHash() {
    _shash.clear();
    for (const u of state.units.values()) {
      const cx = Math.floor(u.x / SHASH_CELL);
      const cy = Math.floor(u.y / SHASH_CELL);
      const key = cx + cy * 100000;
      let arr = _shash.get(key);
      if (!arr) { arr = []; _shash.set(key, arr); }
      arr.push(u);
    }
  }
  function queryHash(x, y, radius) {
    const out = [];
    const cr = Math.ceil(radius / SHASH_CELL) + 1;
    const bx = Math.floor(x / SHASH_CELL);
    const by = Math.floor(y / SHASH_CELL);
    const r2 = radius * radius;
    for (let oy = -cr; oy <= cr; oy++) {
      for (let ox = -cr; ox <= cr; ox++) {
        const key = (bx + ox) + (by + oy) * 100000;
        const arr = _shash.get(key);
        if (!arr) continue;
        for (const u of arr) {
          if ((u.x - x) ** 2 + (u.y - y) ** 2 <= r2) out.push(u);
        }
      }
    }
    return out;
  }

  // ---- Zone ownership grid (rebuilt each stepCities) ----
  const ZONE_GRID_CELL = 40;
  let _zoneGrid = null, _zoneGridW = 0, _zoneGridH = 0;
  function rebuildZoneGrid() {
    const cw = Math.ceil(CFG.WORLD_W / ZONE_GRID_CELL);
    const ch = Math.ceil(CFG.WORLD_H / ZONE_GRID_CELL);
    if (!_zoneGrid || _zoneGridW !== cw || _zoneGridH !== ch) {
      _zoneGrid = new Int8Array(cw * ch);
      _zoneGridW = cw; _zoneGridH = ch;
    } else {
      _zoneGrid.fill(0);
    }
    for (let gy = 0; gy < ch; gy++) {
      for (let gx = 0; gx < cw; gx++) {
        const wx = (gx + 0.5) * ZONE_GRID_CELL;
        const wy = (gy + 0.5) * ZONE_GRID_CELL;
        let ownerCount = 0, ownerId = 0;
        for (const p of state.players.values()) {
          if (!p.influencePolygon || p.influencePolygon.length < 3) continue;
          const dx = wx - p.x, dy = wy - p.y;
          if (dx * dx + dy * dy > (p.influenceR + ZONE_GRID_CELL) * (p.influenceR + ZONE_GRID_CELL)) continue;
          if (isPointInPolygon(wx, wy, p.influencePolygon)) {
            ownerCount++; ownerId = p.id;
            if (ownerCount >= 2) break;
          }
        }
        _zoneGrid[gy * cw + gx] = ownerCount >= 2 ? -1 : (ownerCount === 1 ? ownerId : 0);
      }
    }
  }
  function getZoneOwnerFast(x, y) {
    if (!_zoneGrid) return 0;
    const gx = Math.floor(x / ZONE_GRID_CELL);
    const gy = Math.floor(y / ZONE_GRID_CELL);
    if (gx < 0 || gx >= _zoneGridW || gy < 0 || gy >= _zoneGridH) return 0;
    const v = _zoneGrid[gy * _zoneGridW + gx];
    return v === -1 ? 0 : v;
  }
  function isInOverlapFast(x, y) {
    if (!_zoneGrid) return false;
    const gx = Math.floor(x / ZONE_GRID_CELL);
    const gy = Math.floor(y / ZONE_GRID_CELL);
    if (gx < 0 || gx >= _zoneGridW || gy < 0 || gy >= _zoneGridH) return false;
    return _zoneGrid[gy * _zoneGridW + gx] === -1;
  }

  // ---- PIXI helper: safely remove & queue children for deferred destroy ----
  const _destroyQueue = [];
  function destroyChildren(container) {
    const children = container.removeChildren();
    for (let i = 0; i < children.length; i++) _destroyQueue.push(children[i]);
  }
  function flushDestroyQueue() {
    for (let i = 0; i < _destroyQueue.length; i++) {
      const c = _destroyQueue[i];
      try { if (c && c.destroy) c.destroy(true); } catch (e) {}
    }
    _destroyQueue.length = 0;
  }

  /** Compute influence zone polygon: 96 rays, budget burns by terrain cost per step. */
  function computeInfluencePolygon(cx, cy, pop) {
    const budgetTotal = CFG.INFLUENCE_R(pop);
    const lowlandCost = CFG.TERRAIN_TYPES.lowland?.influenceCost ?? 0.75;
    const step = CFG.TERRAIN_STEP ?? 2;
    const budget = (budgetTotal * lowlandCost) / step;
    const numRays = CFG.TERRAIN_RAYS ?? 96;
    const points = [];
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2;
      let x = cx, y = cy;
      let b = budget;
      while (b > 0) {
        const cost = getTerrainInfluenceCost(x, y);
        b -= cost;
        if (b <= 0) break;
        x += Math.cos(angle) * step;
        y += Math.sin(angle) * step;
        if (x < 0 || x > CFG.WORLD_W || y < 0 || y > CFG.WORLD_H) break;
      }
      points.push({ x, y });
    }
    return points;
  }

  function isPointInPolygon(px, py, polygon) {
    if (!polygon || polygon.length < 3) return false;
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  function polygonArea(polygon) {
    if (!polygon || polygon.length < 3) return 0;
    let area = 0;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      area += polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
    }
    return Math.abs(area) * 0.5;
  }

  function makeMapTexture() {
    const W = CFG.MAP_TEX_W;
    const H = CFG.MAP_TEX_H;
    const cnv = document.createElement("canvas");
    cnv.width = W;
    cnv.height = H;
    const c = cnv.getContext("2d");
    const img = c.createImageData(W, H);
    const d = img.data;

    // colors
    const deepSea = [12, 24, 46];
    const sea = [18, 38, 72];
    const shelf = [26, 58, 92];

    const low = [70, 105, 68];
    const mid = [92, 126, 76];
    const high = [122, 134, 92];
    const peak = [155, 150, 120];

    function mix(a, b, t) {
      return [
        (a[0] + (b[0] - a[0]) * t),
        (a[1] + (b[1] - a[1]) * t),
        (a[2] + (b[2] - a[2]) * t)
      ];
    }

    const landThreshold = CFG.LAND_THRESHOLD ?? 0.08;
    const falloffStr = CFG.FALLOFF_STRENGTH ?? 1.15;
    const falloffAmt = CFG.FALLOFF_AMOUNT ?? 0.65;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;

        const nx = x / W;
        const ny = y / H;
        const dx = (nx - 0.52);
        const dy = (ny - 0.52);
        const falloff = Math.sqrt(dx * dx + dy * dy) * falloffStr;

        const wx = nx * CFG.WORLD_W;
        const wy = ny * CFG.WORLD_H;
        let n = fbm(wx, wy, mapSeed);
        n = n - falloff * falloffAmt;

        let col;
        if (n <= landThreshold) {
          const t = clamp((n - (-0.8)) / (landThreshold - (-0.8)), 0, 1);
          col = mix(deepSea, sea, t);
          if (n > landThreshold - 0.08) col = mix(col, shelf, 0.55);
        } else {
          const t = clamp((n - landThreshold) / 0.55, 0, 1);
          if (t < 0.35) col = mix(low, mid, t / 0.35);
          else if (t < 0.75) col = mix(mid, high, (t - 0.35) / 0.40);
          else col = mix(high, peak, (t - 0.75) / 0.25);

          // subtle paper/terrain variation
          const vv = valueNoise(wx, wy, 0.01, mapSeed + 999);
          const k = (vv - 0.5) * 0.10;
          col = [col[0] * (1 - k), col[1] * (1 - k), col[2] * (1 - k)];
        }

        d[i + 0] = col[0] | 0;
        d[i + 1] = col[1] | 0;
        d[i + 2] = col[2] | 0;
        d[i + 3] = 255;
      }
    }

    c.putImageData(img, 0, 0);

    // paper overlay (deterministic when state._gameSeed set for multi sync)
    const paperRnd = state._gameSeed != null ? mulberry32(mapSeed + 12345) : null;
    const rnd = paperRnd || Math.random.bind(Math);
    c.globalAlpha = 0.12;
    c.globalCompositeOperation = "multiply";
    c.fillStyle = "#ffffff";
    for (let i = 0; i < 8000; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const a = 0.02 + rnd() * 0.04;
      c.globalAlpha = a;
      c.fillRect(x, y, 1, 1);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";

    const tex = PIXI.Texture.from(cnv);
    tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    return tex;
  }

  function rebuildMap(optionalSeed) {
    mapSeed = optionalSeed != null ? (optionalSeed >>> 0) : (Date.now() >>> 0);
    const tex = makeMapTexture();
    if (mapSprite) mapLayer.removeChild(mapSprite);
    mapSprite = new PIXI.Sprite(tex);
    // scale to world size
    mapSprite.width = CFG.WORLD_W;
    mapSprite.height = CFG.WORLD_H;
    mapLayer.addChild(mapSprite);

    mapLayer.sortableChildren = true;
  }

  // Optional grid overlay (debug)
  function rebuildGrid() {
    gridLayer.removeChildren();
    if (!CFG.GRID_ENABLED) return;
    const g = new PIXI.Graphics();
    g.alpha = 0.08;
    g.lineStyle(1, 0xffffff, 1);

    const step = CFG.GRID_STEP ?? 100;
    for (let x = 0; x <= CFG.WORLD_W; x += step) {
      g.moveTo(x, 0);
      g.lineTo(x, CFG.WORLD_H);
    }
    for (let y = 0; y <= CFG.WORLD_H; y += step) {
      g.moveTo(0, y);
      g.lineTo(CFG.WORLD_W, y);
    }
    gridLayer.addChild(g);
  }

  // ------------------------------------------------------------
  // Game state (local) — дополняем state, созданный в начале (меню/лобби)
  // ------------------------------------------------------------
  Object.assign(state, {
    t: 0,
    players: new Map(),
    units: new Map(),
    res: new Map(),
    turrets: new Map(),
    nextTurretId: 1,
    ghosts: [],
    bullets: [],
    nextUnitId: 1,
    nextResId: 1,
    fogEnabled: CFG.FOG_ENABLED,
    zonesEnabled: CFG.ZONES_ENABLED,
    targetPoints: [],
    rallyPoint: null,
    rallyPointMode: false,
    formationPreview: null,
    floatingDamage: [],
    selectedUnitIds: new Set(),
    prevInCombatIds: new Set(),
    boxStart: null,
    boxEnd: null,
    smoothedFronts: {},
    squadBinds: {},
    persistentBattles: {},
    perfLog: [],
    perfStats: null,
    timeScale: 1,
  });

  // ------------------------------------------------------------
  // Perf log (to find crash / FPS cause)
  // ------------------------------------------------------------
  const PERF_LOG_INTERVAL = 8;
  const PERF_FRAME_SAMPLES = 120;
  let perfAcc = 0;
  let perfFrameTimes = [];
  let perfStepStart = {};
  let perfStepAcc = {};

  function perfStartStep(name) {
    perfStepStart[name] = performance.now();
  }
  function perfEndStep(name) {
    if (perfStepStart[name] != null) {
      const ms = performance.now() - perfStepStart[name];
      perfStepAcc[name] = (perfStepAcc[name] || 0) + ms;
    }
  }
  function perfTick(frameMs) {
    perfFrameTimes.push(frameMs);
    if (perfFrameTimes.length > PERF_FRAME_SAMPLES) perfFrameTimes.shift();
    perfAcc += frameMs / 1000;
    if (perfAcc < PERF_LOG_INTERVAL) return;
    perfAcc = 0;

    const n = perfFrameTimes.length;
    const avg = n ? perfFrameTimes.reduce((a, b) => a + b, 0) / n : 0;
    const max = n ? Math.max(...perfFrameTimes) : 0;
    const units = state.units.size;
    const bullets = state.bullets.length;
    const floating = state.floatingDamage.length;
    const res = state.res.size;
    const mem = typeof performance !== "undefined" && performance.memory
      ? (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + " MB"
      : "n/a";

    const stepStr = Object.keys(perfStepAcc)
      .filter(k => perfStepAcc[k] > 0)
      .sort((a, b) => perfStepAcc[b] - perfStepAcc[a])
      .map(k => k + "=" + (perfStepAcc[k] / 1000).toFixed(2) + "s")
      .join(" ");
    perfStepAcc = {};

    const line = `[perf] t=${(state.t / 60).toFixed(1)}min | frame avg=${(avg).toFixed(1)}ms max=${(max).toFixed(0)}ms | units=${units} bullets=${bullets} floatDmg=${floating} res=${res} heap=${mem} | ${stepStr || "—"}`;
    state.perfLog.push(line);
    if (state.perfLog.length > 50) state.perfLog.shift();
    console.log(line);

    const perfEl = document.getElementById("perfLog");
    if (perfEl) {
      perfEl.textContent = state.perfLog.slice(-5).join("\n");
      perfEl.title = "Лог производительности. Консоль (F12) — полная история.";
    }
  }

  function makePlayer(id, name, x, y, popStart) {
    const terrain = getTerrainType(x, y);
    const onWater = terrain === "deepWater" || terrain === "shallowWater";
    const startPop = (popStart ?? CFG.POP_START) + (onWater ? 30 : 0);
    const color = colorForId(id);
    const displayName = name ?? nameForId(id);
    const poly = computeInfluencePolygon(x, y, startPop);
    let maxR = 0;
    for (const pt of poly) {
      const d = Math.hypot(pt.x - x, pt.y - y);
      if (d > maxR) maxR = d;
    }
    return {
      id,
      name: displayName,
      x, y,
      color,
      pop: startPop,
      popFloat: startPop,
      level: 1,
      xp: 0,
      xpNext: Math.floor(CFG.XP_BASE + CFG.XP_PER_LEVEL * 1 * CFG.XP_LEVEL_MUL),
      _levelBonusMul: 1.01,
      cooldown: 0,
      sendDelay: 0,
      pendingSend: null,
      activeUnits: 0,
      deadUnits: 0,

      influenceR: Math.max(maxR, CFG.INFLUENCE_R(startPop)),
      influencePolygon: poly,
      influenceRayDistances: poly.map(pt => Math.hypot(pt.x - x, pt.y - y)),

      waterBonus: onWater,
      turretIds: [],

      cityGfx: null,
      zoneGfx: null,
      zoneGlow: null,
      label: null
    };
  }

  function getLevelBonusMul(p) {
    return p ? (p._levelBonusMul ?? (1 + (p.level || 1) * 0.01)) : 1;
  }
  function xpNeed(level, p) {
    let base = Math.floor(CFG.XP_BASE + CFG.XP_PER_LEVEL * level * CFG.XP_LEVEL_MUL);
    if (p && typeof p.xpZonePct === "number") {
      if (p.xpZonePct >= 5) base = Math.floor(base * (1 + (p.xpZonePct / 10) * 0.11));
      else base = Math.floor(base * 0.80);
    }
    return Math.max(1, base);
  }

  const CARD_RARITY_WEIGHTS = { common: 46, uncommon: 26, rare: 15, epic: 10, legendary: 3 };
  const UNIT_ATK_RANGE_MAX_MUL = 3.0;
  const CARD_DEFS = [
    { id: "c1", name: "Крепкая броня", desc: "+10% HP юнитов", rarity: "common", unitHpMul: 1.10 },
    { id: "c2", name: "Острые клинки", desc: "+10% урон юнитов", rarity: "common", unitDmgMul: 1.10 },
    { id: "c3", name: "Быстрые руки", desc: "+7% скорость атаки", rarity: "common", unitAtkRateMul: 1.07 },
    { id: "c4", name: "Скороходы", desc: "+7% скорость юнитов", rarity: "common", unitSpeedMul: 1.07 },
    { id: "c5", name: "Рост населения", desc: "+7% рост населения", rarity: "common", growthMul: 1.07 },
    { id: "c6", name: "Расширение", desc: "+5% скорость роста зоны", rarity: "common", influenceSpeedMul: 1.05 },
    { id: "c7", name: "Длинный лук", desc: "+10% зона атаки", rarity: "common", unitAtkRangeMul: 1.10 },
    { id: "c8", name: "Укрепления", desc: "+10% HP турелей", rarity: "common", turretHpMul: 1.10 },
    { id: "c9", name: "Быстрая отправка", desc: "-5% КД отправки", rarity: "common", sendCooldownMul: 0.95 },
    { id: "c10", name: "Меткость", desc: "+7% зона атаки", rarity: "common", unitAtkRangeMul: 1.07 },
    { id: "u1", name: "Тяжёлая броня", desc: "+15% HP юнитов", rarity: "uncommon", unitHpMul: 1.15 },
    { id: "u2", name: "Закалённые клинки", desc: "+15% урон", rarity: "uncommon", unitDmgMul: 1.15 },
    { id: "u3", name: "Ярость", desc: "+10% скорость атаки", rarity: "uncommon", unitAtkRateMul: 1.10 },
    { id: "u4", name: "Марш", desc: "+12% скорость юнитов", rarity: "uncommon", unitSpeedMul: 1.12 },
    { id: "u5", name: "Демография", desc: "+12% рост населения", rarity: "uncommon", growthMul: 1.12 },
    { id: "u6", name: "Фронтир", desc: "+10% рост зоны", rarity: "uncommon", influenceSpeedMul: 1.10 },
    { id: "u7", name: "Баллисты", desc: "+15% зона атаки", rarity: "uncommon", unitAtkRangeMul: 1.15 },
    { id: "u8", name: "Артиллерия", desc: "+15% урон турелей и города", rarity: "uncommon", turretDmgMul: 1.15 },
    { id: "u9", name: "Мобилизация", desc: "-8% КД отправки", rarity: "uncommon", sendCooldownMul: 0.92 },
    { id: "u10", name: "Арбалеты", desc: "+12% зона атаки", rarity: "uncommon", unitAtkRangeMul: 1.12 },
    { id: "r1", name: "Доспехи легиона", desc: "+22% HP юнитов", rarity: "rare", unitHpMul: 1.22 },
    { id: "r2", name: "Клинки чемпионов", desc: "+22% урон", rarity: "rare", unitDmgMul: 1.22 },
    { id: "r3", name: "Берсерк", desc: "+15% скорость атаки", rarity: "rare", unitAtkRateMul: 1.15 },
    { id: "r4", name: "Галоп", desc: "+18% скорость юнитов", rarity: "rare", unitSpeedMul: 1.18 },
    { id: "r5", name: "Бум рождаемости", desc: "+18% рост населения", rarity: "rare", growthMul: 1.18 },
    { id: "r6", name: "Империя", desc: "+18% рост зоны", rarity: "rare", influenceSpeedMul: 1.18 },
    { id: "r7", name: "Катапульты", desc: "+20% зона атаки", rarity: "rare", unitAtkRangeMul: 1.20 },
    { id: "r8", name: "Бастионы", desc: "+20% HP и радиус турелей", rarity: "rare", turretHpMul: 1.20, turretRangeMul: 1.10 },
    { id: "r9", name: "Военная машина", desc: "-12% КД отправки", rarity: "rare", sendCooldownMul: 0.88 },
    { id: "r10", name: "Осадные орудия", desc: "+18% зона атаки", rarity: "rare", unitAtkRangeMul: 1.18 },
    { id: "e1", name: "Небесная броня", desc: "+30% HP юнитов", rarity: "epic", unitHpMul: 1.30 },
    { id: "e2", name: "Клинки богов", desc: "+30% урон", rarity: "epic", unitDmgMul: 1.30 },
    { id: "e3", name: "Ураган ударов", desc: "+25% скорость атаки", rarity: "epic", unitAtkRateMul: 1.25 },
    { id: "e4", name: "Ветер", desc: "+25% скорость юнитов", rarity: "epic", unitSpeedMul: 1.25 },
    { id: "e5", name: "Золотой век", desc: "+25% рост населения", rarity: "epic", growthMul: 1.25 },
    { id: "e6", name: "Владычество", desc: "+30% рост зоны", rarity: "epic", influenceSpeedMul: 1.30 },
    { id: "e7", name: "Громовой залп", desc: "+30% зона атаки", rarity: "epic", unitAtkRangeMul: 1.30 },
    { id: "e8", name: "Суперфорт", desc: "+30% урон и HP турелей/города", rarity: "epic", turretDmgMul: 1.30, turretHpMul: 1.20 },
    { id: "e9", name: "Мгновенный призыв", desc: "-15% КД отправки", rarity: "epic", sendCooldownMul: 0.85 },
    { id: "e10", name: "Артиллерия богов", desc: "+30% зона атаки", rarity: "epic", unitAtkRangeMul: 1.30 },
    { id: "L1", name: "Титановая броня", desc: "+50% HP юнитов", rarity: "legendary", unitHpMul: 1.50 },
    { id: "L2", name: "Клинки Апокалипсиса", desc: "+50% урон юнитов", rarity: "legendary", unitDmgMul: 1.50 },
    { id: "L3", name: "Молниеносная ярость", desc: "+40% скорость атаки", rarity: "legendary", unitAtkRateMul: 1.40 },
    { id: "L4", name: "Скорость света", desc: "+40% скорость юнитов", rarity: "legendary", unitSpeedMul: 1.40 },
    { id: "L5", name: "Эпоха процветания", desc: "+40% рост населения", rarity: "legendary", growthMul: 1.40 },
    { id: "L6", name: "Абсолютная экспансия", desc: "+45% рост зоны", rarity: "legendary", influenceSpeedMul: 1.45 },
    { id: "L7", name: "Око Аполлона", desc: "+45% зона атаки", rarity: "legendary", unitAtkRangeMul: 1.45 },
    { id: "L8", name: "Крепость бога", desc: "+50% HP, +25% радиус турелей", rarity: "legendary", turretHpMul: 1.50, turretRangeMul: 1.25 },
    { id: "L9", name: "Военная машина богов", desc: "-25% КД отправки", rarity: "legendary", sendCooldownMul: 0.75 },
    { id: "L10", name: "Гнев Зевса", desc: "+50% урон турелей и города", rarity: "legendary", turretDmgMul: 1.50 },
    { id: "c11", name: "Заточенные стволы", desc: "+10% урон турелей и города", rarity: "common", turretDmgMul: 1.10 },
    { id: "c12", name: "Дальнобойные орудия", desc: "+8% радиус турелей", rarity: "common", turretRangeMul: 1.08 },
    { id: "u11", name: "Крепкие башни", desc: "+18% HP турелей", rarity: "uncommon", turretHpMul: 1.18 },
    { id: "u12", name: "Точная наводка", desc: "+12% урон турелей и города", rarity: "uncommon", turretDmgMul: 1.12 },
    { id: "r11", name: "Орудия возмездия", desc: "+25% урон турелей и города", rarity: "rare", turretDmgMul: 1.25 },
    { id: "r12", name: "Дальнобойные пушки", desc: "+15% радиус турелей", rarity: "rare", turretRangeMul: 1.15 },
    { id: "e11", name: "Адские турели", desc: "+35% урон, +20% HP турелей/города", rarity: "epic", turretDmgMul: 1.35, turretHpMul: 1.20 },
    { id: "e12", name: "Артиллерия крепости", desc: "+25% радиус, +15% урон турелей/города", rarity: "epic", turretRangeMul: 1.25, turretDmgMul: 1.15 },
    { id: "cp1", name: "Призыв ополченцев", desc: "+15 населения мгновенно", rarity: "common", popBonus: 15 },
    { id: "up1", name: "Вербовка наёмников", desc: "+30 населения мгновенно", rarity: "uncommon", popBonus: 30 },
    { id: "rp1", name: "Массовая мобилизация", desc: "+60 населения мгновенно", rarity: "rare", popBonus: 60 },
    { id: "ep1", name: "Великий призыв", desc: "+100 населения мгновенно", rarity: "epic", popBonus: 100 },
    { id: "Lp1", name: "Армия из ниоткуда", desc: "+200 населения мгновенно", rarity: "legendary", popBonus: 200 }
  ];

  function rollCardRarity() {
    const r = Math.random() * 100;
    if (r < CARD_RARITY_WEIGHTS.legendary) return "legendary";
    if (r < CARD_RARITY_WEIGHTS.legendary + CARD_RARITY_WEIGHTS.epic) return "epic";
    if (r < CARD_RARITY_WEIGHTS.legendary + CARD_RARITY_WEIGHTS.epic + CARD_RARITY_WEIGHTS.rare) return "rare";
    if (r < CARD_RARITY_WEIGHTS.legendary + CARD_RARITY_WEIGHTS.epic + CARD_RARITY_WEIGHTS.rare + CARD_RARITY_WEIGHTS.uncommon) return "uncommon";
    return "common";
  }

  function getCardType(card) {
    const keys = Object.keys(card);
    if (card.popBonus) return "pop";
    if (keys.some(k => k.startsWith("unitHp"))) return "unitHp";
    if (keys.some(k => k.startsWith("unitDmg"))) return "unitDmg";
    if (keys.some(k => k.startsWith("unitAtkRate"))) return "unitAtkRate";
    if (keys.some(k => k.startsWith("unitSpeed"))) return "unitSpeed";
    if (keys.some(k => k.startsWith("unitAtkRange"))) return "unitAtkRange";
    if (keys.some(k => k.startsWith("growth"))) return "growth";
    if (keys.some(k => k.startsWith("influence"))) return "influence";
    if (keys.some(k => k.startsWith("sendCooldown"))) return "sendCooldown";
    if (keys.some(k => k.startsWith("turret"))) return "turret";
    return "other";
  }

  function getRandomCards(count) {
    const byRarity = { common: [], uncommon: [], rare: [], epic: [], legendary: [] };
    for (const c of CARD_DEFS) byRarity[c.rarity].push(c);
    const out = [];
    const usedIds = new Set();
    const usedTypes = new Set();
    for (let i = 0; i < count; i++) {
      const rarity = rollCardRarity();
      let arr = byRarity[rarity].filter(c => !usedIds.has(c.id) && !usedTypes.has(getCardType(c)));
      if (!arr.length) arr = CARD_DEFS.filter(c => !usedIds.has(c.id) && !usedTypes.has(getCardType(c)));
      if (!arr.length) arr = CARD_DEFS.filter(c => !usedIds.has(c.id));
      if (!arr.length) arr = CARD_DEFS;
      const pick = arr[Math.floor(Math.random() * arr.length)];
      usedIds.add(pick.id);
      usedTypes.add(getCardType(pick));
      out.push(pick);
    }
    return out;
  }

  function applyCard(p, card) {
    if (card.popBonus) {
      p.popFloat = (p.popFloat || p.pop) + card.popBonus;
      p.pop = Math.floor(p.popFloat);
      return;
    }
    for (const key of Object.keys(card)) {
      if (key === "id" || key === "name" || key === "desc" || key === "rarity") continue;
      const val = card[key];
      if (typeof val === "number") {
        const prev = p[key] != null ? p[key] : 1;
        let next = key.indexOf("Cooldown") >= 0 ? Math.max(0.5, prev * val) : prev * val;
        if (key === "unitAtkRangeMul") next = Math.min(next, UNIT_ATK_RANGE_MAX_MUL);
        p[key] = next;
      }
    }
  }

  // ------------------------------------------------------------
  // Visual builders
  // ------------------------------------------------------------
  function makeCityVisual(p) {
    const size = 54;
    const city = new PIXI.Graphics();
    city.lineStyle(4, p.color, 1);
    city.beginFill(0x0b0f18, 0.85);
    city.drawRoundedRect(-size/2, -size/2, size, size, 10);
    city.endFill();
    city.beginFill(p.color, 0.75);
    city.drawRoundedRect(-15, -15, 30, 30, 8);
    city.endFill();

    const glow = makeGlow(p.color, 28, 2.2);
    if (glow) city.filters = [glow];
    city.position.set(p.x, p.y);

    const label = new PIXI.Text(p.name, {
      fontFamily: "ui-sans-serif, system-ui, Segoe UI, Roboto, Arial",
      fontSize: 16,
      fill: 0xe9eefc,
      stroke: 0x000000,
      strokeThickness: 4
    });
    label.anchor.set(0.5, 1.0);
    label.position.set(p.x, p.y - size/2 - 4);
    label.alpha = 0.9;

    const popLabel = new PIXI.Text("0", {
      fontFamily: "ui-sans-serif, system-ui, Arial",
      fontSize: 18,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 4
    });
    popLabel.anchor.set(0.5, 0);
    popLabel.position.set(p.x, p.y + size/2 + 4);

    cityLayer.addChild(city, label, popLabel);
    p.cityGfx = city;
    p.label = label;
    p.popLabel = popLabel;
    p.cityAtkCd = 0;
  }

  function makeZoneVisual(p) {
    const g = new PIXI.Graphics();
    const glow = new PIXI.Graphics();

    zonesLayer.addChild(glow, g);

    p.zoneGfx = g;
    p.zoneGlow = glow;
    redrawZone(p);
  }

  function zoneShapeHash(p) {
    const r = p.influenceRayDistances;
    if (!r || r.length === 0) return 0;
    let h = 0;
    for (let i = 0; i < r.length; i += 4) h = (h * 31 + (r[i] | 0)) >>> 0;
    return h;
  }

  function smoothedPoly(pts) {
    if (!pts || pts.length < 3) return pts;
    const n = pts.length;
    const out = [];
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const cur = pts[i];
      const next = pts[(i + 1) % n];
      out.push({
        x: cur.x * 0.6 + prev.x * 0.2 + next.x * 0.2,
        y: cur.y * 0.6 + prev.y * 0.2 + next.y * 0.2
      });
    }
    return out;
  }

  function drawSmoothClosed(gfx, pts) {
    if (!pts || pts.length < 3) return;
    const n = pts.length;
    const midX = (pts[n - 1].x + pts[0].x) / 2;
    const midY = (pts[n - 1].y + pts[0].y) / 2;
    gfx.moveTo(midX, midY);
    for (let i = 0; i < n; i++) {
      const next = pts[(i + 1) % n];
      const mx = (pts[i].x + next.x) / 2;
      const my = (pts[i].y + next.y) / 2;
      gfx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    gfx.closePath();
  }

  function redrawZone(p) {
    if (!p.zoneGfx || !p.zoneGlow || p.zoneGfx.destroyed || p.zoneGlow.destroyed) return;
    const poly = p.influencePolygon;
    if (!poly || poly.length < 3) return;

    const hash = zoneShapeHash(p);
    if (p._lastZoneHash === hash) return;
    p._lastZoneHash = hash;

    p.zoneGfx.clear();
    p.zoneGlow.clear();

    const smoothPoly = smoothedPoly(poly);

    const r = ((p.color >> 16) & 0xff) * 0.55;
    const gr = ((p.color >> 8) & 0xff) * 0.55;
    const b = (p.color & 0xff) * 0.55;
    const darkColor = (Math.min(255, r) << 16) | (Math.min(255, gr) << 8) | Math.min(255, b);

    p.zoneGfx.beginFill(darkColor, 0.52);
    drawSmoothClosed(p.zoneGfx, smoothPoly);
    p.zoneGfx.endFill();

    p.zoneGfx.lineStyle(4, p.color, 0.7);
    drawSmoothClosed(p.zoneGfx, smoothPoly);

    p.zoneGlow.lineStyle(12, p.color, 0.12);
    drawSmoothClosed(p.zoneGlow, smoothPoly);

    const innerScale1 = 0.92;
    const innerPoly1 = smoothPoly.map(pt => ({
      x: p.x + (pt.x - p.x) * innerScale1,
      y: p.y + (pt.y - p.y) * innerScale1
    }));
    p.zoneGfx.lineStyle(2, p.color, 0.35);
    drawSmoothClosed(p.zoneGfx, innerPoly1);

    const margin = CFG.INFLUENCE_ARMY_MARGIN ?? 40;
    const numRays = poly.length;
    const innerPoly = [];
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2;
      const d = Math.max(0, (p.influenceRayDistances && p.influenceRayDistances[i]) ? p.influenceRayDistances[i] - margin : Math.hypot(poly[i].x - p.x, poly[i].y - p.y) - margin);
      innerPoly.push({ x: p.x + Math.cos(angle) * d, y: p.y + Math.sin(angle) * d });
    }
    const smoothInner = smoothedPoly(innerPoly);
    if (smoothInner.length >= 3 && margin > 0) {
      p.zoneGfx.beginFill(0xffffff, 0.12);
      drawSmoothClosed(p.zoneGfx, smoothInner);
      p.zoneGfx.endFill();
      p.zoneGfx.lineStyle(2.5, 0xffff88, 0.5);
      drawSmoothClosed(p.zoneGfx, smoothInner);
    }
  }

  // ------------------------------------------------------------
  // Border Turrets
  // ------------------------------------------------------------
  function rebuildTurrets(p) {
    const poly = p.influencePolygon;
    if (!poly || poly.length < 3) return;
    const margin = CFG.INFLUENCE_ARMY_MARGIN ?? 42;
    const numRays = poly.length;

    const borderPts = [];
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2;
      const outerD = p.influenceRayDistances ? (p.influenceRayDistances[i] ?? 0) : Math.hypot(poly[i].x - p.x, poly[i].y - p.y);
      const d = outerD - margin * 0.5;
      if (d < 25) continue;
      const nx = Math.cos(angle), ny = Math.sin(angle);
      borderPts.push({ x: p.x + nx * d, y: p.y + ny * d, nx, ny });
    }
    if (borderPts.length < 3) return;

    let perim = 0;
    const segLens = [];
    for (let i = 0; i < borderPts.length; i++) {
      const j = (i + 1) % borderPts.length;
      const sl = Math.hypot(borderPts[j].x - borderPts[i].x, borderPts[j].y - borderPts[i].y);
      segLens.push(sl);
      perim += sl;
    }

    const existingCount = (p.turretIds || []).filter(tid => state.turrets.has(tid)).length;
    const fixedCount = p._fixedTurretCount || 0;
    const turretCount = fixedCount > 0 ? fixedCount : Math.max(3, Math.floor(perim / (CFG.TURRET_SPACING ?? 55)));
    if (fixedCount === 0) p._fixedTurretCount = turretCount;
    const stepDist = perim / turretCount;

    const turretHpMul = (p.turretHpMul != null ? p.turretHpMul : 1) * getLevelBonusMul(p);
    const maxHp = Math.max(1, Math.round(p.pop * (CFG.TURRET_HP_RATIO ?? 0.1) * turretHpMul));

    const oldTurrets = new Map();
    for (const tid of (p.turretIds || [])) {
      const t = state.turrets.get(tid);
      if (t) oldTurrets.set(tid, t);
    }

    const newPositions = [];
    let cumDist = 0;
    let nextTarget = 0;
    for (let i = 0; i < borderPts.length && newPositions.length < turretCount; i++) {
      const segLen = segLens[i];
      const j = (i + 1) % borderPts.length;
      while (nextTarget <= cumDist + segLen && newPositions.length < turretCount) {
        const frac = segLen > 0.01 ? (nextTarget - cumDist) / segLen : 0;
        const x = borderPts[i].x + (borderPts[j].x - borderPts[i].x) * frac;
        const y = borderPts[i].y + (borderPts[j].y - borderPts[i].y) * frac;
        const nx = borderPts[i].nx + (borderPts[j].nx - borderPts[i].nx) * frac;
        const ny = borderPts[i].ny + (borderPts[j].ny - borderPts[i].ny) * frac;
        const nl = Math.hypot(nx, ny) || 1;
        newPositions.push({ x, y, nx: nx / nl, ny: ny / nl });
        nextTarget += stepDist;
      }
      cumDist += segLen;
    }

    const matched = new Set();
    const newTurretIds = [];
    for (const pos of newPositions) {
      let bestId = null, bestD = 50 * 50;
      for (const [tid, t] of oldTurrets) {
        if (matched.has(tid)) continue;
        const d = (t.x - pos.x) ** 2 + (t.y - pos.y) ** 2;
        if (d < bestD) { bestD = d; bestId = tid; }
      }
      if (bestId != null) {
        const t = oldTurrets.get(bestId);
        t.x = pos.x; t.y = pos.y; t.nx = pos.nx; t.ny = pos.ny;
        if (!t._diedAt) {
          t.maxHp = maxHp;
          if (t.hp > maxHp) t.hp = maxHp;
        }
        matched.add(bestId);
        newTurretIds.push(bestId);
      } else {
        const tid = state.nextTurretId++;
        const t = { id: tid, owner: p.id, x: pos.x, y: pos.y, nx: pos.nx, ny: pos.ny, hp: maxHp, maxHp, atkCd: 0, gfx: null, labelGfx: null, radiusGfx: null };
        state.turrets.set(tid, t);
        newTurretIds.push(tid);
      }
    }
    for (const [tid, t] of oldTurrets) {
      if (!matched.has(tid) && !t._diedAt) {
        if (t.gfx) turretLayer.removeChild(t.gfx);
        if (t.labelGfx) turretLayer.removeChild(t.labelGfx);
        if (t.radiusGfx) turretLayer.removeChild(t.radiusGfx);
        state.turrets.delete(tid);
      }
    }
    p.turretIds = newTurretIds;
  }

  function drawTurrets() {
    for (const t of state.turrets.values()) {
      const p = state.players.get(t.owner);
      if (!p) continue;
      const offScreen = !inView(t.x, t.y);
      if (offScreen) {
        if (t.gfx) t.gfx.visible = false;
        if (t.radiusGfx) t.radiusGfx.visible = false;
        if (t.labelGfx) t.labelGfx.visible = false;
        continue;
      }
      const color = p.color;
      const turretRangeMul = p.turretRangeMul != null ? p.turretRangeMul : 1;
      const radius = (CFG.TURRET_ATTACK_RADIUS ?? 45) * turretRangeMul * 1.6;
      const alive = t.hp > 0;
      if (t.gfx) t.gfx.visible = alive;
      if (t.radiusGfx) t.radiusGfx.visible = alive;

      if (!t.radiusGfx) {
        t.radiusGfx = new PIXI.Graphics();
        turretLayer.addChild(t.radiusGfx);
      }
      t.radiusGfx.clear();
      t.radiusGfx.beginFill(color, 0.14);
      t.radiusGfx.drawCircle(t.x, t.y, radius);
      t.radiusGfx.endFill();
      t.radiusGfx.lineStyle(2, color, 0.45);
      t.radiusGfx.drawCircle(t.x, t.y, radius);

      if (!t.gfx) {
        t.gfx = new PIXI.Graphics();
        turretLayer.addChild(t.gfx);
      }
      if (alive) {
        t.gfx.clear();
        const col = color;
        const sz = 8;
        t.gfx.beginFill(col, 0.9);
        t.gfx.moveTo(t.x + t.nx * sz * 2, t.y + t.ny * sz * 2);
        t.gfx.lineTo(t.x + t.ny * sz, t.y - t.nx * sz);
        t.gfx.lineTo(t.x - t.ny * sz, t.y + t.nx * sz);
        t.gfx.closePath();
        t.gfx.endFill();
        t.gfx.lineStyle(2, 0xffffff, 0.5);
        t.gfx.moveTo(t.x + t.nx * sz * 2, t.y + t.ny * sz * 2);
        t.gfx.lineTo(t.x + t.ny * sz, t.y - t.nx * sz);
        t.gfx.lineTo(t.x - t.ny * sz, t.y + t.nx * sz);
        t.gfx.closePath();
      } else {
        t.gfx.clear();
        t.gfx.visible = true;
      }

      if (!t.labelGfx) {
        t.labelGfx = new PIXI.Text("", { fontSize: 9, fill: 0xffffff, fontFamily: "monospace" });
        t.labelGfx.anchor.set(0.5, 1);
        turretLayer.addChild(t.labelGfx);
      }
      if (!t._skullGfx) {
        t._skullGfx = new PIXI.Text("💀", { fontSize: 24, fill: 0xffffff });
        t._skullGfx.anchor.set(0.5, 0.5);
        turretLayer.addChild(t._skullGfx);
      }
      if (!t._respawnTxt) {
        t._respawnTxt = new PIXI.Text("0:00", { fontSize: 11, fill: 0xffffff, fontFamily: "monospace" });
        t._respawnTxt.anchor.set(0.5, 1);
        turretLayer.addChild(t._respawnTxt);
      }
      if (alive) {
        t.gfx.visible = true;
        t.labelGfx.visible = true;
        const turretDmgMul = (p.turretDmgMul != null ? p.turretDmgMul : 1) * getLevelBonusMul(p);
        const dps = ((CFG.TURRET_ATTACK_DMG ?? 3) * (CFG.TURRET_ATTACK_RATE ?? 1.2) * turretDmgMul).toFixed(1);
        t.labelGfx.text = t.hp + "hp " + dps + "dps";
        t.labelGfx.position.set(t.x, t.y - 14);
        t._skullGfx.visible = false;
        t._respawnTxt.visible = false;
      } else if (t._diedAt != null) {
        t.gfx.visible = false;
        t.labelGfx.visible = false;
        t._skullGfx.visible = true;
        t._skullGfx.position.set(t.x, t.y);
        const remain = Math.max(0, Math.ceil(60 - (state.t - t._diedAt)));
        const m = Math.floor(remain / 60);
        const s = remain % 60;
        t._respawnTxt.text = m + ":" + (s < 10 ? "0" : "") + s;
        t._respawnTxt.position.set(t.x, t.y - 18);
        t._respawnTxt.visible = true;
      } else {
        t._skullGfx.visible = false;
        t._respawnTxt.visible = false;
      }
    }
  }

  function stepTurrets(dt) {
    for (const t of state.turrets.values()) {
      if (t.hp <= 0) continue;
      const p = state.players.get(t.owner);
      if (!p) continue;
      t.atkCd -= dt;
      if (t.atkCd > 0) continue;

      const turretRangeMul = p.turretRangeMul != null ? p.turretRangeMul : 1;
      const range = (CFG.TURRET_ATTACK_RADIUS ?? 45) * turretRangeMul * 1.6;
      const range2 = range * range;
      const nearby = queryHash(t.x, t.y, range);
      let bestTarget = null, bestD = 1e18;
      let targetIsTurret = false;
      for (let i = 0; i < nearby.length; i++) {
        const u = nearby[i];
        if (u.owner === t.owner) continue;
        const d = (u.x - t.x) ** 2 + (u.y - t.y) ** 2;
        if (d < bestD) { bestD = d; bestTarget = u; targetIsTurret = false; }
      }
      if (!bestTarget) {
        for (const ot of state.turrets.values()) {
          if (ot.owner === t.owner || ot.hp <= 0) continue;
          const d = (ot.x - t.x) ** 2 + (ot.y - t.y) ** 2;
          if (d <= range2 && d < bestD) { bestD = d; bestTarget = ot; targetIsTurret = true; }
        }
      }
      if (bestTarget) {
        const turretDmgMul = (p.turretDmgMul != null ? p.turretDmgMul : 1) * getLevelBonusMul(p);
        const dmg = Math.max(1, Math.round((CFG.TURRET_ATTACK_DMG ?? 3) * turretDmgMul));
        t.atkCd = 1 / (CFG.TURRET_ATTACK_RATE ?? 1.2);
        const bx = bestTarget.x;
        const by = bestTarget.y;
        state.bullets.push({
          fromX: t.x, fromY: t.y, toX: bx, toY: by,
          x: t.x, y: t.y,
          speed: RANGED_BULLET_SPEED,
          hitR: 8,
          ownerId: t.owner,
          dmg,
          color: p.color,
          type: "ranged",
          maxDist: range * 1.5,
          traveled: 0,
          big: true,
          canHitTurrets: targetIsTurret
        });
      }
    }

    const dmgR = 20;
    for (const t of state.turrets.values()) {
      if (t.hp <= 0) continue;
      const nearby = queryHash(t.x, t.y, dmgR);
      let dmg = 0;
      for (let i = 0; i < nearby.length; i++) {
        const u = nearby[i];
        if (u.owner === t.owner) continue;
        dmg += (u.dmg != null ? u.dmg : 1) * dt;
      }
      if (dmg > 0) {
        t.hp = Math.max(0, t.hp - dmg);
        if (t.hp <= 0) {
          spawnXPOrb(t.x, t.y, 8);
          t._diedAt = state.t;
        }
      }
    }

    for (const t of state.turrets.values()) {
      if (t.hp <= 0 && t._diedAt && state.t - t._diedAt >= 60) {
        const p = state.players.get(t.owner);
        if (p && p.pop > 0) {
          const turretHpMul = (p.turretHpMul != null ? p.turretHpMul : 1) * getLevelBonusMul(p);
          t.maxHp = Math.max(1, Math.round(p.pop * (CFG.TURRET_HP_RATIO ?? 0.1) * turretHpMul));
          t.hp = t.maxHp;
          t._diedAt = null;
        }
      }
    }
  }

  function makeUnitVisual(u) {
    const col = u.color ?? colorForId(u.owner);
    u.color = col;
    const g = new PIXI.Graphics();
    g.beginFill(col, 0.9);
    g.drawRoundedRect(-5, -5, 10, 10, 2);
    g.endFill();

    // direction arrow
    g.lineStyle(2, 0xffffff, 0.8);
    g.moveTo(0, 0);
    g.lineTo(10, 0);

    const glow = makeGlow(col, 12, 1.8);
    if (glow) g.filters = [glow];

    g.position.set(u.x, u.y);
    unitsLayer.addChild(g);
    u.gfx = g;
  }

  function updateUnitVisualsOnly() {
    const vfc = state._frameCtr || 0;
    for (const u of state.units.values()) {
      if (!u.gfx) {
        makeUnitVisual(u);
      }
      if (!u.gfx) continue;
      const vis = inView(u.x, u.y);
      u.gfx.visible = vis;
      if (vis) {
        u.gfx.position.set(u.x, u.y);
        u.gfx.rotation = Math.atan2(u.vy || 0, u.vx || 0);
        if ((vfc + u.id) % 8 === 0) {
          const sel = state.selectedUnitIds.has(u.id);
          const flashing = u._hitFlashT != null && (state.t - u._hitFlashT) < 0.3;
          const col = flashing ? 0xff2222 : (sel ? 0xffffff : (u.color || 0x888888));
          u.gfx.clear();
          u.gfx.beginFill(col, 0.9);
          u.gfx.drawRoundedRect(-5, -5, 10, 10, 2);
          u.gfx.endFill();
          u.gfx.lineStyle(2, 0xffffff, 0.8);
          u.gfx.moveTo(0, 0);
          u.gfx.lineTo(10, 0);
        }
      }
    }
  }

  function updateActivityZones() {
    destroyChildren(activityZoneLayer);
    const g = new PIXI.Graphics();
    const R = CFG.ACTIVITY_RADIUS;
    for (const u of state.units.values()) {
      g.beginFill(u.color, 0.12);
      g.drawCircle(u.x, u.y, R);
      g.endFill();
    }
    for (const p of state.players.values()) {
      const cityR = CFG.CITY_ATTACK_RADIUS * (p.waterBonus ? 1.25 : 1);
      g.beginFill(p.color, 0.18);
      g.drawCircle(p.x, p.y, cityR);
      g.endFill();
    }
    activityZoneLayer.addChild(g);
  }

  function updateCityPopLabels() {
    for (const p of state.players.values()) {
      if (p.popLabel) {
        p.popLabel.text = String(p.pop);
      }
      const baseR = CFG.INFLUENCE_BASE_R || 240;
      const curR = p.influenceR || baseR;
      const s = Math.max(1, Math.min(2.5, curR / baseR));
      if (p.cityGfx) {
        p.cityGfx.position.set(p.x, p.y);
        p.cityGfx.scale.set(s);
      }
      if (p.popLabel) p.popLabel.position.set(p.x, p.y + 27 * s + 4);
      if (p.label) p.label.position.set(p.x, p.y - 27 * s - 4);
    }
  }

  function getSquads() {
    const squads = [];
    const seen = new Set();
    for (const u of state.units.values()) {
      const leaderId = u.leaderId || u.id;
      if (seen.has(leaderId)) continue;
      const squad = [];
      for (const v of state.units.values()) {
        const vLeader = v.leaderId || v.id;
        if (vLeader === leaderId) {
          squad.push(v);
          seen.add(v.id);
        }
      }
      if (squad.length > 0) {
        seen.add(leaderId);
        squads.push(squad);
      }
    }
    return squads;
  }

  function updateSquadLabels() {
    destroyChildren(squadLabelsLayer);
    const squads = getSquads();
    for (const squad of squads) {
      if (squad.length === 0) continue;
      let cx = 0, cy = 0, hp = 0, maxHp = 0, dps = 0, effectiveHp = 0, effectiveDps = 0;
      for (const u of squad) {
        cx += u.x;
        cy += u.y;
        hp += u.hp;
        maxHp += CFG.UNIT_HP;
        const unitDps = (u.dmg || 1) * CFG.UNIT_ATK_RATE;
        dps += unitDps;
        const mul = u._territoryMul ?? (() => { const zo = getZoneOwnerFast(u.x, u.y); return zo === u.owner ? 1.1 : (zo !== 0 && zo !== u.owner ? 0.9 : 1); })();
        effectiveHp += u.hp / mul;
        effectiveDps += unitDps * mul;
      }
      cx /= squad.length;
      cy /= squad.length;

      const owner = state.players.get(squad[0].owner);
      const col = owner ? owner.color : 0x888888;

      const meleeR = getPlayerMeleeRange();
      const atkR = getPlayerAtkRange(squad[0].owner);
      const spreadR = Math.max(0, ...squad.map(u => Math.hypot(u.x - cx, u.y - cy)));

      const rg = new PIXI.Graphics();
      if (squad.length >= 3) {
        const hullPts = convexHull(squad.map(u => ({ x: u.x, y: u.y })));
        if (atkR > meleeR + 2 && hullPts.length >= 3) {
          rg.lineStyle(2, col, 0.4);
          rg.beginFill(col, 0.08);
          rg.moveTo(hullPts[0].x + (hullPts[0].x - cx) / (spreadR || 1) * atkR,
                     hullPts[0].y + (hullPts[0].y - cy) / (spreadR || 1) * atkR);
          for (let hi = 1; hi <= hullPts.length; hi++) {
            const hp = hullPts[hi % hullPts.length];
            const dx = hp.x - cx, dy = hp.y - cy;
            const dl = Math.hypot(dx, dy) || 1;
            rg.lineTo(hp.x + (dx / dl) * atkR, hp.y + (dy / dl) * atkR);
          }
          rg.closePath();
          rg.endFill();
        }
        if (hullPts.length >= 3) {
          rg.lineStyle(1.5, 0xffffff, 0.25);
          rg.moveTo(hullPts[0].x + (hullPts[0].x - cx) / (Math.hypot(hullPts[0].x - cx, hullPts[0].y - cy) || 1) * meleeR,
                     hullPts[0].y + (hullPts[0].y - cy) / (Math.hypot(hullPts[0].x - cx, hullPts[0].y - cy) || 1) * meleeR);
          for (let hi = 1; hi <= hullPts.length; hi++) {
            const hp = hullPts[hi % hullPts.length];
            const dx = hp.x - cx, dy = hp.y - cy;
            const dl = Math.hypot(dx, dy) || 1;
            rg.lineTo(hp.x + (dx / dl) * meleeR, hp.y + (dy / dl) * meleeR);
          }
          rg.closePath();
        }
      } else {
        if (atkR > meleeR + 2) {
          rg.lineStyle(2, col, 0.4);
          rg.beginFill(col, 0.08);
          rg.drawCircle(cx, cy, spreadR + atkR);
          rg.endFill();
        }
        rg.lineStyle(1.5, 0xffffff, 0.25);
        rg.drawCircle(cx, cy, spreadR + meleeR);
      }
      squadLabelsLayer.addChild(rg);

      const barW = Math.min(60, Math.max(24, squad.length * 6));
      const barH = 5;
      const barY = cy - 22;
      const hpFrac = maxHp > 0 ? Math.min(1, hp / maxHp) : 1;

      const g = new PIXI.Graphics();
      g.lineStyle(1.5, 0x000000, 0.9);
      g.beginFill(0x222222, 0.7);
      g.drawRoundedRect(cx - barW / 2, barY, barW, barH, 2);
      g.endFill();
      g.lineStyle(0);
      const hpColor = hpFrac > 0.5 ? col : (hpFrac > 0.25 ? 0xffaa00 : 0xff3333);
      g.beginFill(hpColor, 0.9);
      g.drawRoundedRect(cx - barW / 2 + 1, barY + 1, Math.max(0, (barW - 2) * hpFrac), barH - 2, 1);
      g.endFill();
      g.lineStyle(1.5, col, 0.7);
      g.drawRoundedRect(cx - barW / 2, barY, barW, barH, 2);
      squadLabelsLayer.addChild(g);

      const leaderId = squad[0].leaderId || squad[0].id;
      const bindNum = Object.keys(state.squadBinds).find(k => state.squadBinds[k] === leaderId);
      const bindStr = bindNum ? ` [${bindNum}]` : "";
      const strength = Math.round(effectiveHp + effectiveDps * 4);
      const strengthTxt = new PIXI.Text("Сила " + strength, {
        fontFamily: "ui-sans-serif, Arial",
        fontSize: 16,
        fontWeight: "bold",
        fill: 0xffffff,
        stroke: 0x000000,
        strokeThickness: 4
      });
      strengthTxt.anchor.set(0.5, 1);
      strengthTxt.position.set(cx, barY - 2);
      squadLabelsLayer.addChild(strengthTxt);
      const detailTxt = new PIXI.Text("Урон/с: " + Math.round(dps) + ", ХП: " + Math.round(hp) + bindStr, {
        fontFamily: "ui-sans-serif, Arial",
        fontSize: 10,
        fill: 0xcccccc,
        stroke: 0x000000,
        strokeThickness: 3
      });
      detailTxt.anchor.set(0.5, 1);
      detailTxt.position.set(cx, barY - 20);
      squadLabelsLayer.addChild(detailTxt);
    }
  }

  const BATTLE_TOUCH_R2 = CFG.UNIT_VISION * CFG.UNIT_VISION;

  function squadsTouch(a, b) {
    for (const u of a) {
      for (const v of b) {
        if (dist2(u.x, u.y, v.x, v.y) <= BATTLE_TOUCH_R2) return true;
      }
    }
    return false;
  }

  function getBattleClusters() {
    const squads = getSquads().filter(s => s.length > 0);
    const n = squads.length;
    const parent = squads.map((_, i) => i);
    function find(i) { return parent[i] === i ? i : (parent[i] = find(parent[i])); }
    function union(i, j) { parent[find(i)] = find(j); }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (squads[i][0].owner === squads[j][0].owner) continue;
        if (squadsTouch(squads[i], squads[j])) union(i, j);
      }
    }
    const clusters = new Map();
    for (let i = 0; i < n; i++) {
      const r = find(i);
      if (!clusters.has(r)) clusters.set(r, []);
      clusters.get(r).push(squads[i]);
    }
    return [...clusters.values()].filter(c => c.length >= 2);
  }

  function getBattlingSquadPairs() {
    const pairs = [];
    for (const cluster of getBattleClusters()) {
      for (let i = 0; i < cluster.length; i++) {
        for (let j = i + 1; j < cluster.length; j++) {
          if (cluster[i][0].owner !== cluster[j][0].owner) pairs.push({ a: cluster[i], b: cluster[j] });
        }
      }
    }
    return pairs;
  }

  function getUnitsInCombatSet() {
    const set = new Set();
    for (const pb of Object.values(state.persistentBattles)) {
      for (const id of (pb.aIds instanceof Set ? [...pb.aIds] : Object.keys(pb.aIds || {}))) set.add(Number(id) || id);
      for (const id of (pb.bIds instanceof Set ? [...pb.bIds] : Object.keys(pb.bIds || {}))) set.add(Number(id) || id);
    }
    return set;
  }

  function getEnemyIdsInSameBattle(u) {
    const out = new Set();
    for (const pb of Object.values(state.persistentBattles)) {
      const aIds = pb.aIds instanceof Set ? pb.aIds : new Set(Object.keys(pb.aIds || {}).map(Number));
      const bIds = pb.bIds instanceof Set ? pb.bIds : new Set(Object.keys(pb.bIds || {}).map(Number));
      if (aIds.has(u.id)) bIds.forEach(id => out.add(id));
      if (bIds.has(u.id)) aIds.forEach(id => out.add(id));
    }
    return out;
  }

  const CLUSTER_SPACING = 11;

  function buildBattleCache() {
    state._battleCache = new Map();
    const pbList = Object.values(state.persistentBattles);
    for (const pb of pbList) {
      const aIds = pb.aIds instanceof Set ? [...pb.aIds] : Object.keys(pb.aIds || {}).map(Number);
      const bIds = pb.bIds instanceof Set ? [...pb.bIds] : Object.keys(pb.bIds || {}).map(Number);
      const midX = pb.midX, midY = pb.midY;
      let ecxA = 0, ecyA = 0, nA = 0, ecxB = 0, ecyB = 0, nB = 0;
      for (const id of aIds) {
        const eu = state.units.get(id);
        if (eu) { ecxA += eu.x; ecyA += eu.y; nA++; }
      }
      for (const id of bIds) {
        const eu = state.units.get(id);
        if (eu) { ecxB += eu.x; ecyB += eu.y; nB++; }
      }
      if (nA) { ecxA /= nA; ecyA /= nA; } else { ecxA = midX; ecyA = midY; }
      if (nB) { ecxB /= nB; ecyB /= nB; } else { ecxB = midX; ecyB = midY; }
      for (const id of aIds) {
        state._battleCache.set(id, { midX, midY, myIds: aIds, enemyIds: bIds, ecx: ecxB, ecy: ecyB, myCount: aIds.length, enemyCount: bIds.length });
      }
      for (const id of bIds) {
        state._battleCache.set(id, { midX, midY, myIds: bIds, enemyIds: aIds, ecx: ecxA, ecy: ecyA, myCount: bIds.length, enemyCount: aIds.length });
      }
    }
  }

  function getUnitFrontSlot(u) {
    const c = state._battleCache && state._battleCache.get(u.id);
    if (!c) return null;
    const { midX, midY, myIds, enemyIds, ecx, ecy, myCount, enemyCount } = c;
    const idx = myIds.indexOf(u.id);
    if (idx < 0) return null;

    const dx = ecx - u.x, dy = ecy - u.y;
    const dl = Math.hypot(dx, dy) || 1;
    const dirX = dx / dl, dirY = dy / dl;

    const myAtkR = getPlayerAtkRange(u.owner);
    const myMeleeR = getPlayerMeleeRange();
    const isRanged = myAtkR > myMeleeR + 2;

    if (myCount > enemyCount * 1.3 && enemyCount > 0) {
      const angle = (idx / myCount) * Math.PI * 2;
      const overwhelm = myCount >= enemyCount * 3;
      const ringR = overwhelm
        ? Math.max(8, Math.sqrt(enemyCount) * CLUSTER_SPACING * 0.3)
        : isRanged
          ? Math.max(myAtkR * 0.7, Math.sqrt(enemyCount) * CLUSTER_SPACING * 0.5 + myMeleeR)
          : Math.max(15, Math.sqrt(enemyCount) * CLUSTER_SPACING * 0.6 + 8);
      return { tx: ecx + Math.cos(angle) * ringR, ty: ecy + Math.sin(angle) * ringR };
    } else if (myCount < enemyCount * 0.77 && enemyCount > 0) {
      let bestAngle = Math.atan2(u.y - ecx, u.x - ecx);
      let bestScore = -1e18;
      const sectors = 12;
      for (let si = 0; si < sectors; si++) {
        const a = (si / sectors) * Math.PI * 2;
        let enemiesInSector = 0;
        for (const eid of enemyIds) {
          const eu = state.units.get(eid);
          if (!eu) continue;
          const dot = (eu.x - ecx) * Math.cos(a) + (eu.y - ecy) * Math.sin(a);
          if (dot > 0) {
            const perpDist = Math.abs(-(eu.x - ecx) * Math.sin(a) + (eu.y - ecy) * Math.cos(a));
            if (perpDist < 40) enemiesInSector++;
          }
        }
        const score = -enemiesInSector;
        if (score > bestScore) { bestScore = score; bestAngle = a; }
      }
      const breakR = myMeleeR * 0.8;
      let nearestEnemyInDir = null, bestD = 1e18;
      for (const eid of enemyIds) {
        const eu = state.units.get(eid);
        if (!eu) continue;
        const dot = (eu.x - u.x) * Math.cos(bestAngle) + (eu.y - u.y) * Math.sin(bestAngle);
        if (dot > 0) {
          const d = (eu.x - u.x) ** 2 + (eu.y - u.y) ** 2;
          if (d < bestD) { bestD = d; nearestEnemyInDir = eu; }
        }
      }
      if (nearestEnemyInDir) return { tx: nearestEnemyInDir.x, ty: nearestEnemyInDir.y };
      return { tx: ecx + Math.cos(bestAngle) * breakR, ty: ecy + Math.sin(bestAngle) * breakR };
    } else {
      const cols = Math.max(1, Math.ceil(Math.sqrt(myCount)));
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const offX = (col - (cols - 1) * 0.5) * CLUSTER_SPACING;
      const offY = row * CLUSTER_SPACING * 0.7;
      const perpX = -dirY, perpY = dirX;
      const tx = midX + dirX * (8 + offY) + perpX * offX;
      const ty = midY + dirY * (8 + offY) + perpY * offX;
      return { tx, ty };
    }
  }

  function convexHull(points) {
    if (points.length < 3) return points;
    const sorted = [...points].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
    const lower = [];
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
  }
  function cross(o, a, b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  function lineLineIntersect(a1, a2, b1, b2) {
    const dax = a2.x - a1.x, day = a2.y - a1.y;
    const dbx = b2.x - b1.x, dby = b2.y - b1.y;
    const det = dax * dby - day * dbx;
    if (Math.abs(det) < 1e-10) return null;
    const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / det;
    return { x: a1.x + t * dax, y: a1.y + t * day };
  }

  function offsetPolygon(points, R) {
    if (points.length < 3) return points;
    const n = points.length;
    const out = [];
    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n];
      const curr = points[i];
      const next = points[(i + 1) % n];
      const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
      const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
      const l1 = Math.hypot(dx1, dy1) || 1;
      const l2 = Math.hypot(dx2, dy2) || 1;
      const n1x = dy1 / l1, n1y = -dx1 / l1;
      const n2x = dy2 / l2, n2y = -dx2 / l2;
      const p1a = { x: prev.x + n1x * R, y: prev.y + n1y * R };
      const p1b = { x: curr.x + n1x * R, y: curr.y + n1y * R };
      const p2a = { x: curr.x + n2x * R, y: curr.y + n2y * R };
      const p2b = { x: next.x + n2x * R, y: next.y + n2y * R };
      const isec = lineLineIntersect(p1a, p1b, p2a, p2b);
      if (isec) out.push(isec);
      else out.push({ x: curr.x + n1x * R, y: curr.y + n1y * R });
    }
    return out;
  }

  const FORCE_PREVIEW_RADIUS = 180;
  function updateCombatUI() {
    destroyChildren(combatLayer);
    state._forcePreview = null;
    if (state.selectedUnitIds.size > 0 && state._hoverTarget && state._hoverWorld) {
      const ht = state._hoverTarget;
      let enemyCx, enemyCy, enemyHp = 0, myHp = 0;
      const me = state.players.get(state.myPlayerId);
      const myColor = me ? me.color : 0x4488ff;
      if (ht.x != null && ht.y != null) {
        if (ht.owner != null) {
          const enemySquad = getSquads().find(s => s.some(u => u.id === ht.id));
          if (enemySquad) {
            enemyCx = enemySquad.reduce((s, u) => s + u.x, 0) / enemySquad.length;
            enemyCy = enemySquad.reduce((s, u) => s + u.y, 0) / enemySquad.length;
            for (const u of state.units.values()) {
              if (u.owner !== state.myPlayerId && Math.hypot(u.x - enemyCx, u.y - enemyCy) <= FORCE_PREVIEW_RADIUS) enemyHp += u.hp;
            }
          } else { enemyCx = ht.x; enemyCy = ht.y; enemyHp = ht.hp || 0; }
        } else {
          enemyCx = ht.x; enemyCy = ht.y;
          for (const u of state.units.values()) {
            if (u.owner !== state.myPlayerId && Math.hypot(u.x - enemyCx, u.y - enemyCy) <= FORCE_PREVIEW_RADIUS) enemyHp += u.hp;
          }
        }
      }
      if (enemyCx != null) {
        let myTotal = 0;
        for (const id of state.selectedUnitIds) { const u = state.units.get(id); if (u) myTotal += u.hp; }
        if (myTotal > 0 || enemyHp > 0) state._forcePreview = { enemyCx, enemyCy, myHp: myTotal, enemyHp, myColor, enemyColor: ht.color || 0xcc2222 };
      }
    }
    const battles = getBattlingSquadPairs();
    const usedKeys = new Set();
    for (const { a, b } of battles) {
      let ax = 0, ay = 0, bx = 0, by = 0;
      for (const u of a) { ax += u.x; ay += u.y; }
      for (const u of b) { bx += u.x; by += u.y; }
      ax /= a.length; ay /= a.length;
      bx /= b.length; by /= b.length;
      const midX = (ax + bx) * 0.5, midY = (ay + by) * 0.5;
      const frontKey = `${a[0].owner}-${b[0].owner}-${(midX/30)|0}-${(midY/30)|0}`;
      usedKeys.add(frontKey);
      const aIds = new Set(a.map(u => u.id));
      const bIds = new Set(b.map(u => u.id));
      const aAlive = a.some(u => state.units.has(u.id));
      const bAlive = b.some(u => state.units.has(u.id));
      const existing = state.persistentBattles[frontKey];
      let combatZone = existing && existing.combatZone;
      if (!combatZone) {
        let ddx = bx - ax, ddy = by - ay;
        const segLen = Math.hypot(ddx, ddy) || 1;
        ddx /= segLen; ddy /= segLen;
        combatZone = {
          midX, midY,
          frontDirX: -ddy, frontDirY: ddx,
          halfLen: Math.max(segLen * 0.7, 55)
        };
      }
      state.persistentBattles[frontKey] = {
        frontKey, a, b, aIds, bIds,
        midX, midY, ax, ay, bx, by,
        hpA: a.reduce((s, u) => s + u.hp, 0),
        hpB: b.reduce((s, u) => s + u.hp, 0),
        nameA: nameForId(a[0].owner), nameB: nameForId(b[0].owner),
        colorA: a[0].color, colorB: b[0].color,
        aAlive, bAlive,
        combatZone
      };
    }
    for (const k of Object.keys(state.persistentBattles)) {
      const pb = state.persistentBattles[k];
      const aAlive = pb.aIds && (pb.aIds instanceof Set ? [...pb.aIds] : Object.keys(pb.aIds)).some(id => state.units.has(Number(id) || id));
      const bAlive = pb.bIds && (pb.bIds instanceof Set ? [...pb.bIds] : Object.keys(pb.bIds)).some(id => state.units.has(Number(id) || id));
      if (!aAlive || !bAlive) delete state.persistentBattles[k];
    }
    const pbKeys = Object.keys(state.persistentBattles);
    if (pbKeys.length > 25) {
      const toDel = pbKeys.slice(0, pbKeys.length - 25);
      for (const k of toDel) delete state.persistentBattles[k];
    }
    const keys = Object.keys(state.smoothedFronts);
    if (keys.length > 18) {
      for (const k of keys) { if (!usedKeys.has(k)) delete state.smoothedFronts[k]; }
      const remaining = Object.keys(state.smoothedFronts);
      if (remaining.length > 15) for (let i = 0; i < remaining.length - 12; i++) delete state.smoothedFronts[remaining[i]];
    }
    const toDraw = Object.values(state.persistentBattles);
    if (toDraw.length > 0) {
    for (const pb of toDraw) {
      const a = pb.a; const b = pb.b;
      let hpA = pb.hpA, hpB = pb.hpB;
      const aAlive = [...(pb.aIds || [])].some(id => state.units.has(id));
      const bAlive = [...(pb.bIds || [])].some(id => state.units.has(id));
      if (aAlive && bAlive && a.length && b.length) {
        hpA = 0; hpB = 0;
        for (const u of a) if (state.units.has(u.id)) hpA += state.units.get(u.id).hp;
        for (const u of b) if (state.units.has(u.id)) hpB += state.units.get(u.id).hp;
        pb.hpA = hpA; pb.hpB = hpB;
      }
    }

    const BATTLE_CLUSTER_CELL = 120;
    const clusters = new Map();
    for (const pb of toDraw) {
      const zone = pb.combatZone;
      const midX = zone ? zone.midX : pb.midX;
      const midY = zone ? zone.midY : pb.midY;
      const cellKey = `${(midX / BATTLE_CLUSTER_CELL) | 0},${(midY / BATTLE_CLUSTER_CELL) | 0}`;
      let list = clusters.get(cellKey);
      if (!list) { list = []; clusters.set(cellKey, list); }
      list.push(pb);
    }

    for (const list of clusters.values()) {
      let cx = 0, cy = 0;
      const factionHp = {};
      const factionColor = {};
      const factionName = {};
      for (const pb of list) {
        const zone = pb.combatZone;
        cx += zone ? zone.midX : pb.midX;
        cy += zone ? zone.midY : pb.midY;
        for (const u of pb.a) {
          if (!state.units.has(u.id)) continue;
          const uu = state.units.get(u.id);
          factionHp[uu.owner] = (factionHp[uu.owner] || 0) + uu.hp;
          if (!factionColor[uu.owner]) { factionColor[uu.owner] = uu.color; factionName[uu.owner] = nameForId(uu.owner); }
        }
        for (const u of pb.b) {
          if (!state.units.has(u.id)) continue;
          const uu = state.units.get(u.id);
          factionHp[uu.owner] = (factionHp[uu.owner] || 0) + uu.hp;
          if (!factionColor[uu.owner]) { factionColor[uu.owner] = uu.color; factionName[uu.owner] = nameForId(uu.owner); }
        }
      }
      cx /= list.length; cy /= list.length;
      const factions = Object.entries(factionHp).sort((a, b) => b[1] - a[1]);
      if (factions.length === 0) continue;
      const totalHp = factions.reduce((s, f) => s + f[1], 0) || 1;
      const totalUnits = factions.reduce((s, f) => s + f[1], 0);

      const barW = Math.min(250, Math.max(160, totalUnits * 0.15));
      const barH = 20;
      const lift = 72;

      const icon = new PIXI.Text("⚔", { fontSize: 42, fill: 0xffffff, fontWeight: "bold", stroke: 0x000000, strokeThickness: 4 });
      icon.anchor.set(0.5, 1);
      icon.position.set(cx, cy - lift);
      combatLayer.addChild(icon);

      const barBg = new PIXI.Graphics();
      barBg.lineStyle(2, 0xffffff, 0.5);
      barBg.beginFill(0x111111, 0.9);
      barBg.drawRoundedRect(cx - barW / 2, cy - lift + 38, barW, barH, 4);
      barBg.endFill();
      combatLayer.addChild(barBg);

      let offset = 0;
      for (const [pid, hp] of factions) {
        const pct = hp / totalHp;
        const segW = barW * pct;
        const color = factionColor[pid] || 0x888888;
        const seg = new PIXI.Graphics();
        seg.beginFill(color, 1);
        seg.drawRect(cx - barW / 2 + offset, cy - lift + 38, segW, barH);
        seg.endFill();
        combatLayer.addChild(seg);

        if (segW > 30) {
          const lbl = new PIXI.Text(Math.round(hp), { fontSize: 12, fill: 0xffffff, fontWeight: "bold", stroke: 0x000000, strokeThickness: 2 });
          lbl.anchor.set(0.5, 0.5);
          lbl.position.set(cx - barW / 2 + offset + segW / 2, cy - lift + 38 + barH / 2);
          combatLayer.addChild(lbl);
        }
        if (offset > 0) {
          const div = new PIXI.Graphics();
          div.beginFill(0xffffff, 0.8);
          div.drawRect(cx - barW / 2 + offset - 1, cy - lift + 38, 2, barH);
          div.endFill();
          combatLayer.addChild(div);
        }
        offset += segW;
      }

      let nameStr = factions.map(([pid]) => factionName[pid] || "?").join(" vs ");
      const nameLabel = new PIXI.Text(nameStr, { fontSize: 13, fill: 0xffffff, fontWeight: "bold", stroke: 0x000000, strokeThickness: 2 });
      nameLabel.anchor.set(0.5, 0);
      nameLabel.position.set(cx, cy - lift + 38 + barH + 3);
      combatLayer.addChild(nameLabel);
    }
    }
    if (state._forcePreview) {
      const fp = state._forcePreview;
      const circle = new PIXI.Graphics();
      circle.lineStyle(2, 0xffffff, 0.6);
      circle.drawCircle(fp.enemyCx, fp.enemyCy, FORCE_PREVIEW_RADIUS);
      combatLayer.addChild(circle);
      const totalHp = fp.myHp + fp.enemyHp || 1;
      const barW = 160;
      const barH = 18;
      const lift = 70;
      const barBg = new PIXI.Graphics();
      barBg.lineStyle(2, 0xffffff, 0.5);
      barBg.beginFill(0x111111, 0.9);
      barBg.drawRoundedRect(fp.enemyCx - barW / 2, fp.enemyCy - lift, barW, barH, 4);
      barBg.endFill();
      combatLayer.addChild(barBg);
      const myPct = fp.myHp / totalHp;
      const segW = barW * myPct;
      const seg1 = new PIXI.Graphics();
      seg1.beginFill(fp.myColor, 1);
      seg1.drawRect(fp.enemyCx - barW / 2, fp.enemyCy - lift, segW, barH);
      seg1.endFill();
      combatLayer.addChild(seg1);
      const seg2 = new PIXI.Graphics();
      seg2.beginFill(fp.enemyColor, 1);
      seg2.drawRect(fp.enemyCx - barW / 2 + segW, fp.enemyCy - lift, barW - segW, barH);
      seg2.endFill();
      combatLayer.addChild(seg2);
      const icon = new PIXI.Text("⚔", { fontSize: 32, fill: 0xffffff, fontWeight: "bold", stroke: 0x000000, strokeThickness: 3 });
      icon.anchor.set(0.5, 1);
      icon.position.set(fp.enemyCx, fp.enemyCy - lift - 4);
      combatLayer.addChild(icon);
    }
    if (state.floatingDamage.length > 36) state.floatingDamage.splice(0, state.floatingDamage.length - 36);
  }

  function drawDashedSegment(g, ax, ay, bx, by, dash, gap) {
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    let d = 0;
    while (d < len) {
      const x1 = ax + ux * d, y1 = ay + uy * d;
      d += dash;
      const x2 = ax + ux * Math.min(d, len), y2 = ay + uy * Math.min(d, len);
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      d += gap;
    }
  }

  function updateSelectionBox() {
    destroyChildren(selectionBoxLayer);
    if (state.boxStart && state.boxEnd) {
      const g = new PIXI.Graphics();
      const lx = Math.min(state.boxStart.x, state.boxEnd.x);
      const rx = Math.max(state.boxStart.x, state.boxEnd.x);
      const ly = Math.min(state.boxStart.y, state.boxEnd.y);
      const ry = Math.max(state.boxStart.y, state.boxEnd.y);
      g.beginFill(0x00aaff, 0.12);
      g.drawRect(lx, ly, rx - lx, ry - ly);
      g.endFill();
      g.lineStyle(28, 0x00aaff, 0.85);
      g.drawRect(lx, ly, rx - lx, ry - ly);
      selectionBoxLayer.addChild(g);
    }
    const squads = getSelectedSquads();
    for (const id of state.selectedUnitIds) {
      const u = state.units.get(id);
      if (!u) continue;
      const ring = new PIXI.Graphics();
      ring.beginFill(0xffffff, 0.22);
      ring.drawCircle(u.x, u.y, 26);
      ring.endFill();
      selectionBoxLayer.addChild(ring);
      const squad = squads.find(s => s.some(v => v.id === u.id));
      const leader = squad && (squad.find(v => (v.leaderId || v.id) === (squad[0].leaderId || squad[0].id)) || squad[0]);
      if (leader && u.id === leader.id) {
        const dir = Math.atan2(u.vy || 0, u.vx || 0);
        const R = 20;
        const tipX = u.x + Math.cos(dir) * R;
        const tipY = u.y + Math.sin(dir) * R;
        const back = new PIXI.Graphics();
        back.beginFill(0xffffff, 0.95);
        back.moveTo(tipX, tipY);
        back.lineTo(u.x + Math.cos(dir + 2.5) * 12, u.y + Math.sin(dir + 2.5) * 12);
        back.lineTo(u.x + Math.cos(dir - 2.5) * 12, u.y + Math.sin(dir - 2.5) * 12);
        back.closePath();
        back.endFill();
        back.beginFill(0x000000, 0.8);
        back.drawCircle(tipX, tipY, 4);
        back.endFill();
        selectionBoxLayer.addChild(back);
      }
    }
  }

  function updatePathPreview() {
    destroyChildren(pathPreviewLayer);
    const me = state.players.get(state.myPlayerId);
    if (state.formationPreview) {
      const fp = state.formationPreview;
      const squads = getSelectedSquads();
      const cosA = Math.cos(fp.angle);
      const sinA = Math.sin(fp.angle);
      for (const squad of squads) {
        const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
        const formationType = leader.formationType || "pig";
        const formationRows = leader.formationRows || 1;
        const pigW = leader.formationPigWidth ?? 1;
        const offsets = getFormationOffsets(squad.length, formationType, formationRows, cosA, sinA, pigW);
        const ghostG = new PIXI.Graphics();
        ghostG.beginFill(0xffffff, 0.25);
        for (let i = 0; i < offsets.length; i++) {
          const o = offsets[i] || { x: 0, y: 0 };
          ghostG.drawCircle(fp.x + o.x, fp.y + o.y, 10);
        }
        ghostG.endFill();
        pathPreviewLayer.addChild(ghostG);
      }
    }
    if (!me || !state.targetPoints || state.targetPoints.length === 0) return;
    const pts = [{ x: me.x, y: me.y }, ...state.targetPoints];
    const g = new PIXI.Graphics();
    g.lineStyle(6, 0x000000, 0.4);
    for (let i = 0; i < pts.length - 1; i++) {
      g.moveTo(pts[i].x, pts[i].y);
      g.lineTo(pts[i + 1].x, pts[i + 1].y);
    }
    g.lineStyle(4, me.color, 0.85);
    for (let i = 0; i < pts.length - 1; i++) {
      g.moveTo(pts[i].x, pts[i].y);
      g.lineTo(pts[i + 1].x, pts[i + 1].y);
    }
    pathPreviewLayer.addChild(g);
  }

  function drawAnimatedDash(g, points, dash, gap, lineW, color, alpha, timeOffset) {
    const offset = (timeOffset * 60) % (dash + gap);
    for (let seg = 0; seg < points.length - 1; seg++) {
      const ax = points[seg].x, ay = points[seg].y;
      const bx = points[seg + 1].x, by = points[seg + 1].y;
      const sdx = bx - ax, sdy = by - ay;
      const len = Math.hypot(sdx, sdy);
      if (len < 1) continue;
      const ux = sdx / len, uy = sdy / len;
      let d = -offset;
      while (d < len) {
        const start = Math.max(0, d);
        const end = Math.min(len, d + dash);
        if (end > start) {
          g.lineStyle(lineW, color, alpha);
          g.moveTo(ax + ux * start, ay + uy * start);
          g.lineTo(ax + ux * end, ay + uy * end);
        }
        d += dash + gap;
      }
    }
  }

  function updateMovingPathPreview() {
    const allSquads = getSquads();
    const t = state.t;

    for (const squad of allSquads) {
      if (squad.length === 0 || squad[0].owner !== state.myPlayerId) continue;
      const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
      const wp = leader.waypoints;
      const idx = leader.waypointIndex ?? 0;
      if (!wp || idx >= wp.length) continue;

      const isAttack = leader.chaseTargetUnitId != null || leader.chaseTargetCityId != null;
      const ownerP = state.players.get(leader.owner);
      const color = isAttack ? 0xff3333 : (ownerP ? ownerP.color : 0xffffff);
      const alpha = 1.0;
      const lineW = 6;

      const points = [{ x: leader.x, y: leader.y }];
      for (let i = idx; i < wp.length; i++) points.push(wp[i]);

      if (isAttack) {
        let targetX, targetY;
        if (leader.chaseTargetUnitId != null) {
          const tu = state.units.get(leader.chaseTargetUnitId);
          if (tu) { targetX = tu.x; targetY = tu.y; }
        }
        if (targetX == null && leader.chaseTargetCityId != null) {
          const tc = state.players.get(leader.chaseTargetCityId);
          if (tc) { targetX = tc.x; targetY = tc.y; }
        }
        if (targetX != null) {
          points[points.length - 1] = { x: targetX, y: targetY };
        }
      }

      const g = new PIXI.Graphics();
      for (let seg = 0; seg < points.length - 1; seg++) {
        g.lineStyle(7, 0x000000, 0.65);
        g.moveTo(points[seg].x, points[seg].y);
        g.lineTo(points[seg + 1].x, points[seg + 1].y);
        g.lineStyle(5, color, 0.95);
        g.moveTo(points[seg].x, points[seg].y);
        g.lineTo(points[seg + 1].x, points[seg + 1].y);
      }
      drawAnimatedDash(g, points, 14, 6, 2.5, 0xffffff, 0.85, t);

      const lastPt = points[points.length - 1];
      g.lineStyle(0);
      if (isAttack) {
        g.lineStyle(4, 0xff3333, 1);
        g.drawCircle(lastPt.x, lastPt.y, 14);
        g.moveTo(lastPt.x - 10, lastPt.y - 10); g.lineTo(lastPt.x + 10, lastPt.y + 10);
        g.moveTo(lastPt.x + 10, lastPt.y - 10); g.lineTo(lastPt.x - 10, lastPt.y + 10);
      } else {
        g.lineStyle(3, 0xffffff, 1);
        g.beginFill(color, 0.5);
        g.drawCircle(lastPt.x, lastPt.y, 14);
        g.endFill();
      }
      for (let pi = 1; pi < points.length - 1; pi++) {
        const pt = points[pi];
        g.lineStyle(2, 0xffffff, 0.8);
        g.drawCircle(pt.x, pt.y, 6);
      }
      pathPreviewLayer.addChild(g);
    }

    if (state.rallyPoint) {
      const me = state.players.get(state.myPlayerId);
      if (me) {
        const dashG = new PIXI.Graphics();
        dashG.lineStyle(6, 0xcc2222, 0.85);
        drawDashedSegment(dashG, me.x, me.y, state.rallyPoint.x, state.rallyPoint.y, 14, 10);
        pathPreviewLayer.addChild(dashG);
      }
      const flagTxt = new PIXI.Text("🚩", { fontSize: 32, fill: 0xffffff });
      flagTxt.anchor.set(0.5, 1);
      flagTxt.position.set(state.rallyPoint.x, state.rallyPoint.y);
      pathPreviewLayer.addChild(flagTxt);
    }
  }

  function updateFloatingDamage(dt) {
    destroyChildren(floatingDamageLayer);
    for (let i = state.floatingDamage.length - 1; i >= 0; i--) {
      const fd = state.floatingDamage[i];
      fd.ttl -= dt;
      if (fd.ttl <= 0) {
        state.floatingDamage.splice(i, 1);
        continue;
      }
      const lift = (1 - fd.ttl) * 35;
      const txt = new PIXI.Text(fd.text, { fontSize: 18, fill: fd.color, fontWeight: "bold" });
      txt.anchor.set(0.5, 0.5);
      txt.position.set(fd.x, fd.y - lift);
      txt.alpha = fd.ttl;
      floatingDamageLayer.addChild(txt);
    }
    if (state.floatingDamage.length > 36) state.floatingDamage.splice(0, state.floatingDamage.length - 36);
  }

  const MINIMAP_W = 180, MINIMAP_H = 110;
  function updateMinimap() {
    const canvas = document.getElementById("minimapCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = MINIMAP_W;
    canvas.height = MINIMAP_H;

    const scaleX = MINIMAP_W / CFG.WORLD_W;
    const scaleY = MINIMAP_H / CFG.WORLD_H;

    ctx.fillStyle = "rgba(7, 10, 18, 0.95)";
    ctx.fillRect(0, 0, MINIMAP_W, MINIMAP_H);

    ctx.strokeStyle = "rgba(80, 120, 200, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, MINIMAP_W, MINIMAP_H);

    const vpLeft = -cam.x / cam.zoom;
    const vpTop = -cam.y / cam.zoom;
    const vpW = app.renderer.width / cam.zoom;
    const vpH = app.renderer.height / cam.zoom;

    const mx = (vpLeft / CFG.WORLD_W) * MINIMAP_W;
    const my = (vpTop / CFG.WORLD_H) * MINIMAP_H;
    const mw = (vpW / CFG.WORLD_W) * MINIMAP_W;
    const mh = (vpH / CFG.WORLD_H) * MINIMAP_H;

    ctx.fillStyle = "rgba(120, 160, 255, 0.2)";
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = "rgba(200, 220, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, mw, mh);
  }

  function updateLeaderboard() {
    if (!leaderboardBody) return;
    const totalArea = CFG.WORLD_W * CFG.WORLD_H;
    const rows = [];
    for (const p of state.players.values()) {
      const area = polygonArea(p.influencePolygon);
      const pct = totalArea > 0 ? (area / totalArea * 100) : 0;
      rows.push({ name: p.name, pop: p.pop, pct });
    }
    rows.sort((a, b) => b.pop - a.pop);
    leaderboardBody.innerHTML = rows.map((r, i) =>
      `<tr><td>${i + 1}</td><td>${r.name}</td><td>${r.pop}</td><td>${r.pct.toFixed(2)}%</td></tr>`
    ).join("");
  }

  function makeResVisual(r) {
    const g = new PIXI.Graphics();
    const isRainbow = r.type === "rainbow";
    const sz = isRainbow ? 10 + Math.random() * 3 : 6 + Math.random() * 3;

    if (isRainbow) {
      g.beginFill(0xffffff, 0.95);
      g.moveTo(0, -sz);
      g.lineTo(sz * 0.6, -sz * 0.2);
      g.lineTo(sz * 0.9, 0);
      g.lineTo(sz * 0.5, sz * 0.7);
      g.lineTo(0, sz);
      g.lineTo(-sz * 0.5, sz * 0.7);
      g.lineTo(-sz * 0.9, 0);
      g.lineTo(-sz * 0.6, -sz * 0.2);
      g.closePath();
      g.endFill();
      g.lineStyle(1.5, 0xffffff, 0.5);
      g.moveTo(0, -sz);
      g.lineTo(0, sz);
      g.moveTo(-sz * 0.9, 0);
      g.lineTo(sz * 0.9, 0);
    } else {
      const sides = 5 + Math.floor(Math.random() * 3);
      g.beginFill(r.color, 0.95);
      for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const rr = sz * (0.7 + 0.3 * ((i % 2 === 0) ? 1 : 0.6));
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.endFill();
      g.lineStyle(1, 0xffffff, 0.3);
      g.moveTo(-sz * 0.3, -sz * 0.5);
      g.lineTo(sz * 0.2, -sz * 0.2);
    }

    const glowColor = isRainbow ? 0xffffff : r.color;
    const glow = makeGlow(glowColor, isRainbow ? 16 : 12, isRainbow ? 3.5 : 2.5);
    if (glow) g.filters = [glow];
    g.position.set(r.x, r.y);
    resLayer.addChild(g);
    r.gfx = g;
  }

  // ------------------------------------------------------------
  // Fog of war (RenderTexture)
  // ------------------------------------------------------------
  const fogRT = PIXI.RenderTexture.create({
    width: Math.max(1, Math.floor(CFG.WORLD_W / 2)),
    height: Math.max(1, Math.floor(CFG.WORLD_H / 2)),
    resolution: 1
  });
  const fogSprite = new PIXI.Sprite(fogRT);
  fogSprite.width = CFG.WORLD_W;
  fogSprite.height = CFG.WORLD_H;
  fogSprite.alpha = 1.0;
  fogLayer.addChild(fogSprite);

  // This container we render into fogRT:
  const fogDraw = new PIXI.Container();
  const fogBlack = new PIXI.Graphics();
  fogBlack.beginFill(0x000000, 1);
  fogBlack.drawRect(0, 0, fogRT.width, fogRT.height);
  fogBlack.endFill();
  fogDraw.addChild(fogBlack);

  // memory texture: we accumulate discovered areas
  const fogMemRT = PIXI.RenderTexture.create({
    width: fogRT.width,
    height: fogRT.height,
    resolution: 1
  });
  const fogMemSprite = new PIXI.Sprite(fogMemRT);

  // draw masks (white circles on black)
  const fogMaskG = new PIXI.Graphics();
  fogDraw.addChild(fogMaskG);

  // We'll render fog as: unseen=black, seen=dark overlay, visible=transparent
  // Approach:
  // 1) Update fogMemRT by painting visible circles in white (additive).
  // 2) Build current visibility mask in fogRT (black with punched holes).
  // 3) On screen: draw a dark "seen" overlay using fogMemRT alpha, and a darker "unseen" overlay using fogRT alpha.
  //
  // For MVP: simplest:
  // - fogSprite shows "unseen darkness" (fogRT)
  // - an extra seen overlay sprite shows a lighter darkness based on fogMemRT
  const seenOverlaySprite = new PIXI.Sprite(fogMemRT);
  seenOverlaySprite.width = CFG.WORLD_W;
  seenOverlaySprite.height = CFG.WORLD_H;
  seenOverlaySprite.tint = 0x000000;
  seenOverlaySprite.alpha = 0.55;
  fogLayer.addChild(seenOverlaySprite);

  fogSprite.tint = 0x000000;
  fogSprite.alpha = 0.92;

  function worldToFog(x, y) {
    return [
      (x / CFG.WORLD_W) * fogRT.width,
      (y / CFG.WORLD_H) * fogRT.height
    ];
  }

  function updateFog() {
    // Fog of war disabled
  }

  // ------------------------------------------------------------
  // Zones intersection (MVP marker)
  // ------------------------------------------------------------
  // For now: when zones overlap, we draw a neutral translucent circle in overlap area
  // (true hatch later).
  let overlapG = new PIXI.Graphics();
  zonesLayer.addChild(overlapG);

  function updateZoneOverlaps() {
    if (!overlapG || overlapG.destroyed) {
      overlapG = new PIXI.Graphics();
      zonesLayer.addChild(overlapG);
    }
    overlapG.clear();
    if (!state.zonesEnabled) return;

    const ps = [...state.players.values()];
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        if (a.influenceR + b.influenceR < Math.hypot(a.x - b.x, a.y - b.y)) continue;
        const mx = (a.x + b.x) * 0.5;
        const my = (a.y + b.y) * 0.5;
        if (!isPointInPolygon(mx, my, a.influencePolygon) || !isPointInPolygon(mx, my, b.influencePolygon)) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const rr = Math.max(12, Math.min(120, (a.influenceR + b.influenceR - d) * 0.25));

        overlapG.beginFill(0x4a1520, 0.25);
        overlapG.drawCircle(mx, my, rr);
        overlapG.endFill();
      }
    }
  }

  function isInOverlap(x, y) {
    let count = 0;
    for (const p of state.players.values()) {
      if (isPointInPolygon(x, y, p.influencePolygon)) {
        count++;
        if (count >= 2) return true;
      }
    }
    return false;
  }

  function getZoneOwnerAt(x, y) {
    let owner = 0;
    for (const p of state.players.values()) {
      if (isPointInPolygon(x, y, p.influencePolygon)) {
        if (owner) return 0;
        owner = p.id;
      }
    }
    return owner;
  }

  // ------------------------------------------------------------
  // Spawn initial players
  // ------------------------------------------------------------
  function resetWorld() {
    destroyChildren(zonesLayer);
    destroyChildren(turretLayer);
    destroyChildren(resLayer);
    destroyChildren(unitsLayer);
    destroyChildren(cityLayer);
    destroyChildren(ghostLayer);
    destroyChildren(pathPreviewLayer);
    destroyChildren(squadLabelsLayer);
    destroyChildren(bulletsLayer);
    destroyChildren(floatingDamageLayer);
    destroyChildren(activityZoneLayer);
    destroyChildren(combatLayer);
    overlapG = new PIXI.Graphics();
    zonesLayer.addChild(overlapG);

    // Clear state
    state.players.clear();
    state.units.clear();
    state.res.clear();
    state.turrets.clear();
    state.nextTurretId = 1;
    state.nextUnitId = 1;
    state.nextResId = 1;
    state.t = 0;
    state._domTimers = {};
    state._gameOver = false;
    // Reset fog memories
    app.renderer.render(new PIXI.Graphics(), { renderTexture: fogMemRT, clear: true });

    state.ghosts = [];
    state.bullets = [];
    if (state.storm) {
      if (state.storm.gfx) { state.storm.gfx.destroy(true); }
      if (state.storm.emojiContainer) { state.storm.emojiContainer.destroy({ children: true }); }
    }
    state.storm = null;
    state._nextStormAt = 5;
    state._ruinSpawns = [];
    state.floatingDamage = [];
    state.selectedUnitIds.clear();
    state.prevInCombatIds.clear();
    state.smoothedFronts = {};
    state.persistentBattles = {};
    state.resourceClusters = [];

    const me = makePlayer(1, nameForId(1), CFG.WORLD_W * 0.32, CFG.WORLD_H * 0.55, CFG.POP_START);
    state.players.set(me.id, me);
    makeCityVisual(me);
    makeZoneVisual(me);

    const MIN_CITY_DIST = 1100;
    for (let i = 0; i < CFG.BOTS; i++) {
      const id = 2 + i;
      let bx, by, ok;
      for (let attempt = 0; attempt < 80; attempt++) {
        bx = rand(CFG.WORLD_W * 0.12, CFG.WORLD_W * 0.88);
        by = rand(CFG.WORLD_H * 0.12, CFG.WORLD_H * 0.88);
        ok = true;
        for (const p of state.players.values()) {
          if (Math.hypot(bx - p.x, by - p.y) < MIN_CITY_DIST) { ok = false; break; }
        }
        if (ok) break;
      }
      const bot = makePlayer(id, nameForId(id), bx, by, CFG.POP_START);
      state.players.set(bot.id, bot);
      makeCityVisual(bot);
      makeZoneVisual(bot);
    }

    // Camera on me
    centerOn(me.x, me.y);

    state.resourceClusters = [];
    state.resourceClusters.push({
      x: CFG.WORLD_W * 0.5,
      y: CFG.WORLD_H * 0.5,
      radius: 130,
      centerCluster: true
    });
    for (const p of state.players.values()) {
      for (let c = 0; c < 4; c++) {
        const angle = (c / 4) * Math.PI * 2 + Math.random() * 0.8;
        const dist = rand(120, 220);
        state.resourceClusters.push({
          x: p.x + Math.cos(angle) * dist,
          y: p.y + Math.sin(angle) * dist,
          radius: rand(40, 70)
        });
      }
    }
    const numClusters = Math.max(15, Math.floor((CFG.WORLD_W * CFG.WORLD_H) / 220000));
    for (let i = state.resourceClusters.length; i < numClusters; i++) {
      state.resourceClusters.push({
        x: rand(CFG.WORLD_W * 0.05, CFG.WORLD_W * 0.95),
        y: rand(CFG.WORLD_H * 0.05, CFG.WORLD_H * 0.95),
        radius: rand(45, 80)
      });
    }

    // Seed resources in clusters
    for (const cl of state.resourceClusters) {
      const count = cl.centerCluster ? Math.floor(rand(18, 28)) : Math.floor(rand(4, 12));
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * cl.radius;
        const x = clamp(cl.x + Math.cos(angle) * r, 0, CFG.WORLD_W);
        const y = clamp(cl.y + Math.sin(angle) * r, 0, CFG.WORLD_H);
        spawnResourceAt(x, y);
      }
    }
  }

  function resetWorldMulti(slots, slotToPid) {
    let locRand = rand;
    let locRnd = () => Math.random();
    if (state._gameSeed != null) {
      const rng = mulberry32(state._gameSeed);
      locRand = (a, b) => (b - a) * rng() + a;
      locRnd = rng;
    }
    destroyChildren(zonesLayer);
    destroyChildren(turretLayer);
    destroyChildren(resLayer);
    destroyChildren(unitsLayer);
    destroyChildren(cityLayer);
    destroyChildren(ghostLayer);
    destroyChildren(pathPreviewLayer);
    destroyChildren(squadLabelsLayer);
    destroyChildren(bulletsLayer);
    destroyChildren(floatingDamageLayer);
    destroyChildren(activityZoneLayer);
    destroyChildren(combatLayer);
    overlapG = new PIXI.Graphics();
    zonesLayer.addChild(overlapG);

    state.players.clear();
    state.units.clear();
    state.res.clear();
    state.turrets.clear();
    state.nextTurretId = 1;
    state.nextUnitId = 1;
    state.nextResId = 1;
    state.t = 0;
    state._domTimers = {};
    state._gameOver = false;
    app.renderer.render(new PIXI.Graphics(), { renderTexture: fogMemRT, clear: true });
    state.ghosts = [];
    state.bullets = [];
    if (state.storm) {
      if (state.storm.gfx) state.storm.gfx.destroy(true);
      if (state.storm.emojiContainer) state.storm.emojiContainer.destroy({ children: true });
    }
    state.storm = null;
    state._nextStormAt = 5;
    state._ruinSpawns = [];
    state.floatingDamage = [];
    state.selectedUnitIds.clear();
    state.prevInCombatIds.clear();
    state.smoothedFronts = {};
    state.persistentBattles = {};
    state.resourceClusters = [];

    const filledSlotIndices = Object.keys(slotToPid).map(Number).sort((a, b) => a - b);
    const MIN_CITY_DIST = 1100;
    const cx = CFG.WORLD_W * 0.5;
    const cy = CFG.WORLD_H * 0.5;
    const n = filledSlotIndices.length;
    const radius = Math.min(CFG.WORLD_W, CFG.WORLD_H) * 0.38;
    const positions = [];
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + (n > 1 ? locRnd() * 0.15 : 0);
      positions.push({
        x: clamp(cx + Math.cos(angle) * radius, CFG.WORLD_W * 0.08, CFG.WORLD_W * 0.92),
        y: clamp(cy + Math.sin(angle) * radius, CFG.WORLD_H * 0.08, CFG.WORLD_H * 0.92)
      });
    }
    for (let i = 0; i < filledSlotIndices.length; i++) {
      const slotIndex = filledSlotIndices[i];
      const pid = slotToPid[slotIndex];
      const pos = positions[i];
      const pl = makePlayer(pid, nameForId(pid), pos.x, pos.y, CFG.POP_START);
      state.players.set(pl.id, pl);
      makeCityVisual(pl);
      makeZoneVisual(pl);
    }

    const me = state.players.get(state.myPlayerId);
    centerOn(me.x, me.y);
    state.resourceClusters = [];
    state.resourceClusters.push({
      x: CFG.WORLD_W * 0.5,
      y: CFG.WORLD_H * 0.5,
      radius: 130,
      centerCluster: true
    });
    for (const p of state.players.values()) {
      for (let c = 0; c < 4; c++) {
        const angle = (c / 4) * Math.PI * 2 + locRnd() * 0.8;
        const dist = locRand(120, 220);
        state.resourceClusters.push({
          x: p.x + Math.cos(angle) * dist,
          y: p.y + Math.sin(angle) * dist,
          radius: locRand(40, 70)
        });
      }
    }
    const numClusters = Math.max(15, Math.floor((CFG.WORLD_W * CFG.WORLD_H) / 220000));
    for (let i = state.resourceClusters.length; i < numClusters; i++) {
      state.resourceClusters.push({
        x: locRand(CFG.WORLD_W * 0.05, CFG.WORLD_W * 0.95),
        y: locRand(CFG.WORLD_H * 0.05, CFG.WORLD_H * 0.95),
        radius: locRand(45, 80)
      });
    }
    for (const cl of state.resourceClusters) {
      const count = cl.centerCluster ? Math.floor(locRand(18, 28)) : Math.floor(locRand(4, 12));
      for (let i = 0; i < count; i++) {
        const angle = locRnd() * Math.PI * 2;
        const r = locRnd() * cl.radius;
        const x = clamp(cl.x + Math.cos(angle) * r, 0, CFG.WORLD_W);
        const y = clamp(cl.y + Math.sin(angle) * r, 0, CFG.WORLD_H);
        spawnResourceAt(x, y, locRnd);
      }
    }
  }

  // ------------------------------------------------------------
  // Resources
  // ------------------------------------------------------------
  function pickResType(optionalRnd) {
    const r = optionalRnd ? optionalRnd() : Math.random();
    let acc = 0;
    for (const t of CFG.RES_TYPES) {
      acc += t.p;
      if (r <= acc) return t;
    }
    return CFG.RES_TYPES[0];
  }

  function biasedRandomPos() {
    // bias to center
    const cx = CFG.WORLD_W * 0.5;
    const cy = CFG.WORLD_H * 0.5;
    if (Math.random() < CFG.RES_CENTER_BIAS) {
      return [
        clamp(cx + rand(-CFG.WORLD_W * 0.35, CFG.WORLD_W * 0.35), 0, CFG.WORLD_W),
        clamp(cy + rand(-CFG.WORLD_H * 0.35, CFG.WORLD_H * 0.35), 0, CFG.WORLD_H)
      ];
    }
    return [rand(0, CFG.WORLD_W), rand(0, CFG.WORLD_H)];
  }

  function spawnResourceAt(x, y, optionalRnd) {
    const t = pickResType(optionalRnd);
    const id = state.nextResId++;
    const r = {
      id,
      type: t.id,
      xp: t.xp,
      x, y,
      color: t.color,
      gfx: null
    };
    state.res.set(id, r);
    makeResVisual(r);
  }

  function spawnResourceRandom() {
    if (!state.resourceClusters || state.resourceClusters.length === 0) {
      const [x, y] = biasedRandomPos();
      spawnResourceAt(x, y);
      return;
    }
    const clusters = state.resourceClusters;
    const centerClusters = clusters.filter(c => c.centerCluster);
    const otherClusters = clusters.filter(c => !c.centerCluster);
    const totalWeight = (centerClusters.length * 2) + otherClusters.length;
    let r = Math.random() * totalWeight;
    let cl;
    if (r < centerClusters.length * 2) {
      cl = centerClusters[Math.floor(r / 2) % centerClusters.length];
    } else {
      cl = otherClusters[Math.floor((r - centerClusters.length * 2) / 1) % Math.max(1, otherClusters.length)];
    }
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * cl.radius;
    const x = clamp(cl.x + Math.cos(angle) * dist, 0, CFG.WORLD_W);
    const y = clamp(cl.y + Math.sin(angle) * dist, 0, CFG.WORLD_H);
    spawnResourceAt(x, y);
    if (cl.centerCluster && state.res.size < (CFG.RES_MAX ?? 520)) {
      const a2 = Math.random() * Math.PI * 2;
      const d2 = Math.random() * cl.radius;
      spawnResourceAt(clamp(cl.x + Math.cos(a2) * d2, 0, CFG.WORLD_W), clamp(cl.y + Math.sin(a2) * d2, 0, CFG.WORLD_H));
    }
  }

  function deleteResource(rid) {
    const r = state.res.get(rid);
    if (!r) return;
    if (r.gfx) resLayer.removeChild(r.gfx);
    state.res.delete(rid);
  }

  // ------------------------------------------------------------
  // Units
  // ------------------------------------------------------------
  const FORM_ELONGATE = 1.85;

  function pigFormationOffsets(n, dirX, dirY, depth, widthMul) {
    const depthRows = Math.max(1, depth || 3);
    const wMul = Math.max(0.5, Math.min(2, widthMul || 1));
    const sx = (CFG.FORM_SPACING_X || 18) * wMul;
    const sy = CFG.FORM_SPACING_Y;
    const out = [];
    let placed = 0;
    let row = 0;
    while (placed < n && row < depthRows) {
      const inRow = Math.min(row + 1, n - placed);
      for (let c = 0; c < inRow; c++) {
        let x = (c - (inRow - 1) / 2) * sx;
        let y = row * sy * FORM_ELONGATE;
        const angle = Math.atan2(dirY, dirX) + Math.PI / 2;
        const cos = Math.cos(angle), sin = Math.sin(angle);
        out.push({
          x: x * cos - y * sin,
          y: x * sin + y * cos
        });
        placed++;
      }
      row++;
    }
    while (placed < n) {
      const inRow = Math.min(depthRows, n - placed);
      for (let c = 0; c < inRow; c++) {
        let x = (c - (inRow - 1) / 2) * sx;
        let y = row * sy * FORM_ELONGATE;
        const angle = Math.atan2(dirY, dirX) + Math.PI / 2;
        const cos = Math.cos(angle), sin = Math.sin(angle);
        out.push({ x: x * cos - y * sin, y: x * sin + y * cos });
        placed++;
      }
      row++;
    }
    return out;
  }

  function lineFormationOffsets(n, rows, dirX, dirY) {
    const sx = CFG.FORM_SPACING_X;
    const sy = CFG.FORM_SPACING_Y;
    const cols = Math.ceil(n / Math.max(1, rows));
    const out = [];
    let idx = 0;
    for (let r = 0; r < rows && idx < n; r++) {
      for (let c = 0; c < cols && idx < n; c++) {
        const x = (c - (cols - 1) / 2) * sx;
        const y = r * sy;
        const angle = Math.atan2(dirY, dirX) + Math.PI / 2;
        const cos = Math.cos(angle), sin = Math.sin(angle);
        out.push({ x: x * cos - y * sin, y: x * sin + y * cos });
        idx++;
      }
    }
    return out;
  }

  function getFormationOffsets(n, formationType, formationRows, dirX, dirY, formationPigWidth) {
    if (formationType === "line") return lineFormationOffsets(n, Math.max(1, formationRows || 1), dirX, dirY);
    return pigFormationOffsets(n, dirX, dirY, formationRows || 3, formationPigWidth ?? 1);
  }

  function getFormationCenter(offsets) {
    if (!offsets || offsets.length === 0) return { x: 0, y: 0 };
    let cx = 0, cy = 0;
    for (const o of offsets) { cx += o.x; cy += o.y; }
    return { x: cx / offsets.length, y: cy / offsets.length };
  }

  function spawnUnits(ownerId, count, waypoints, opts) {
    const p = state.players.get(ownerId);
    if (!p) return { ok: false, reason: "no_player" };
    if (p.cooldown > 0) return { ok: false, reason: "cooldown" };

    let active = 0;
    for (const u of state.units.values()) if (u.owner === ownerId) active++;
    const maxUnits = Math.max(0, Math.floor(p.pop / 2));
    const maxByPop = Math.floor(p.pop / CFG.UNIT_POP_PER);
    const n = Math.min(count, maxByPop, Math.max(0, maxUnits - active));
    if (n <= 0) return { ok: false, reason: active >= maxUnits ? "unit_cap" : "no_pop" };
    const pts = Array.isArray(waypoints) && waypoints.length > 0 ? waypoints : [{ x: p.x + 100, y: p.y }];
    const first = pts[0];
    const [vx, vy] = norm(first.x - p.x, first.y - p.y);
    const formationType = (opts && opts.formationType) || "line";
    const formationRows = (opts && opts.formationRows) || 2;
    const pigW = (opts && opts.formationPigWidth) ?? 1;
    const offsets = getFormationOffsets(n, formationType, formationRows, vx, vy, pigW);
    const fCenter = getFormationCenter(offsets);
    const adjustedPts = pts.map(w => ({ x: w.x - fCenter.x, y: w.y - fCenter.y }));
    let leaderId = null;

    let cooldown = Math.max(CFG.SEND_COOLDOWN_MIN, Math.min(CFG.SEND_COOLDOWN_MAX, CFG.SEND_COOLDOWN_BASE + n * CFG.SEND_COOLDOWN_PER_UNIT));
    cooldown *= (p.sendCooldownMul != null ? p.sendCooldownMul : 1);
    p.cooldown = Math.max(CFG.SEND_COOLDOWN_MIN * 0.5, cooldown);

    for (let i = 0; i < n; i++) {
      const id = state.nextUnitId++;
      const off = offsets[i] || { x: 0, y: 0 };
      const lb = getLevelBonusMul(p);
      const hpMul = (p.unitHpMul != null ? p.unitHpMul : 1) * lb;
      const dmgMul = (p.unitDmgMul != null ? p.unitDmgMul : 1) * lb;
      const atkRateMul = (p.unitAtkRateMul != null ? p.unitAtkRateMul : 1) * lb;
      const u = {
        id,
        owner: ownerId,
        color: p.color,
        x: p.x + off.x,
        y: p.y + off.y,
        vx, vy,
        hp: Math.round(CFG.UNIT_HP * hpMul),
        dmg: Math.max(1, Math.round(CFG.UNIT_DMG * dmgMul)),
        atkCd: rand(0, 1 / (CFG.UNIT_ATK_RATE * atkRateMul)),
        gfx: null,
        waypoints: adjustedPts.map(w => ({ x: w.x, y: w.y })),
        waypointIndex: 0,
        leaderId: i === 0 ? null : leaderId,
        formationOffsetX: i === 0 ? 0 : off.x,
        formationOffsetY: i === 0 ? 0 : off.y,
        spawnTime: state.t
      };
      if (i === 0) {
        leaderId = id;
        u.formationType = formationType;
        u.formationRows = formationRows;
      }
      state.units.set(id, u);
      makeUnitVisual(u);
    }
    return { ok: true, spawned: n };
  }

  function spawnXPOrb(x, y, xp) {
    const maxRes = CFG.RES_MAX ?? 520;
    if (state.res.size >= maxRes) {
      const firstId = state.res.keys().next().value;
      if (firstId != null) deleteResource(firstId);
    }
    const id = state.nextResId++;
    const r = { id, type: "orb", xp, x, y, color: 0xffdd44, gfx: null };
    state.res.set(id, r);
    makeResVisual(r);
  }

  function killUnit(u, reason = "dead", killerOwner) {
    let xpDrop;
    if (state._gameSeed != null) {
      state._deathCount = (state._deathCount || 0) + 1;
      const rng = mulberry32(state._gameSeed + state._deathCount * 7919 + (u.id || 0));
      xpDrop = reason === "killed" ? (5 + Math.floor(rng() * 6)) : (rng() < 0.5 ? 2 : 5);
    } else {
      xpDrop = reason === "killed" ? (5 + Math.floor(Math.random() * 6)) : (Math.random() < 0.5 ? 2 : 5);
    }
    spawnXPOrb(u.x, u.y, xpDrop);

    const p = state.players.get(u.owner);
    if (p) {
      p.popFloat = Math.max(0, p.popFloat - CFG.UNIT_DEATH_POP_PENALTY);
      p.deadUnits++;
    }
    if (reason === "killed" && killerOwner && killerOwner !== u.owner) {
      const kp = state.players.get(killerOwner);
      if (kp) {
        kp.killGrowthStacks = kp.killGrowthStacks || [];
        kp.killGrowthStacks.push(state.t + 240);
      }
    }

    const myId = u.id;
    const isLeader = u.leaderId === null || u.leaderId === undefined;
    if (isLeader) {
      let newLeader = null;
      for (const v of state.units.values()) {
        if (v.id !== myId && (v.leaderId === myId)) {
          if (!newLeader) newLeader = v;
        }
      }
      if (newLeader) {
        newLeader.leaderId = null;
        newLeader.formationType = u.formationType || "line";
        newLeader.formationRows = u.formationRows || 2;
        newLeader.waypoints = u.waypoints;
        newLeader.waypointIndex = u.waypointIndex;
        newLeader.chaseTargetUnitId = u.chaseTargetUnitId;
        newLeader.chaseTargetCityId = u.chaseTargetCityId;
        for (const v of state.units.values()) {
          if (v.leaderId === myId) v.leaderId = newLeader.id;
        }
      }
    }

    if (u.gfx) unitsLayer.removeChild(u.gfx);
    state.units.delete(u.id);
  }

  // ------------------------------------------------------------
  // Combat (simple)
  // ------------------------------------------------------------
  const COMBAT_ZONE_R2 = CFG.UNIT_VISION * CFG.UNIT_VISION * 2;

  function getPlayerAtkRange(ownerId) {
    const p = state.players.get(ownerId);
    const mul = Math.min(UNIT_ATK_RANGE_MAX_MUL, p && p.unitAtkRangeMul != null ? p.unitAtkRangeMul : 1);
    return CFG.UNIT_VISION * mul;
  }
  function getPlayerMeleeRange() { return CFG.UNIT_VISION; }

  const RANGED_BULLET_SPEED = 160;
  const RANGED_BULLET_HIT_R = 6;

  function stepCombat(dt) {
    const meleeR2 = BATTLE_TOUCH_R2;
    const inCombatSet = getUnitsInCombatSet();

    for (const u of state.units.values()) {
      const atkRateMul = u._territoryMul ?? 1;
      u.atkCd -= dt * atkRateMul;
      const inMelee = inCombatSet.has(u.id);
      if (inMelee) u.combatTimeSec = (u.combatTimeSec || 0) + dt;
      else u.combatTimeSec = 0;

      if (u.atkCd > 0 && !inMelee) continue;

      const atkRange = getPlayerAtkRange(u.owner);
      const atkRange2 = atkRange * atkRange;

      const nearby = queryHash(u.x, u.y, atkRange);
      let meleeTarget = null, meleeD = 1e18;
      let rangedTarget = null, rangedD = 1e18;

      for (let i = 0; i < nearby.length; i++) {
        const t = nearby[i];
        if (t.owner === u.owner) continue;
        const d = (t.x - u.x) ** 2 + (t.y - u.y) ** 2;
        if (d <= meleeR2 && d < meleeD) { meleeD = d; meleeTarget = t; }
        if (d <= atkRange2 && d < rangedD) { rangedD = d; rangedTarget = t; }
      }

      if (!meleeTarget && inMelee) {
        const cache = state._battleCache && state._battleCache.get(u.id);
        const enemyIds = cache ? cache.enemyIds : getEnemyIdsInSameBattle(u);
        for (const id of enemyIds) {
          const t = state.units.get(id);
          if (!t || t.owner === u.owner) continue;
          const d = (t.x - u.x) ** 2 + (t.y - u.y) ** 2;
          if (d <= meleeR2 && d < meleeD) { meleeD = d; meleeTarget = t; }
          if (d <= atkRange2 && d < rangedD) { rangedD = d; rangedTarget = t; }
        }
      }

      let rangedTurretTarget = null, rangedTurretD = 1e18;
      if (atkRange > getPlayerMeleeRange() + 1) {
        for (const t of state.turrets.values()) {
          if (t.owner === u.owner || t.hp <= 0) continue;
          const d = (t.x - u.x) ** 2 + (t.y - u.y) ** 2;
          if (d <= atkRange2 && d < rangedTurretD) { rangedTurretD = d; rangedTurretTarget = t; }
        }
      }

      if (meleeTarget) {
        u.atkCd = 1 / (CFG.UNIT_ATK_RATE * (u._territoryMul ?? 1));
        const dmgMul = 1 + Math.min(1.0, (meleeTarget.combatTimeSec || 0) * 0.035);
        const rawDmg = (u.dmg != null ? u.dmg : CFG.UNIT_DMG) * dmgMul * (u._territoryMul ?? 1) / (meleeTarget._territoryMul ?? 1);
        const dmg = Math.max(1, Math.round(rawDmg));
        meleeTarget.lastDamagedBy = u.owner;
        meleeTarget.hp = Math.max(0, meleeTarget.hp - dmg);
        meleeTarget._hitFlashT = state.t;
        state.floatingDamage.push({
          x: meleeTarget.x, y: meleeTarget.y - 22, text: "-" + dmg, color: 0xff4444, ttl: 1.2
        });
      } else if (rangedTarget && atkRange > getPlayerMeleeRange() + 1) {
        u.atkCd = 2 / (CFG.UNIT_ATK_RATE * (u._territoryMul ?? 1));
        const rawDmg = (u.dmg != null ? u.dmg : CFG.UNIT_DMG) * (u._territoryMul ?? 1) / (rangedTarget._territoryMul ?? 1);
        const dmg = Math.max(1, Math.round(rawDmg));
        const p = state.players.get(u.owner);
        state.bullets.push({
          fromX: u.x, fromY: u.y,
          toX: rangedTarget.x, toY: rangedTarget.y,
          x: u.x, y: u.y,
          speed: RANGED_BULLET_SPEED,
          hitR: RANGED_BULLET_HIT_R,
          targetId: rangedTarget.id,
          dmg,
          color: p ? p.color : 0xffaa00,
          type: "ranged",
          maxDist: atkRange * 1.3,
          traveled: 0,
          ownerId: u.owner,
          canHitTurrets: true
        });
      } else if (rangedTurretTarget && atkRange > getPlayerMeleeRange() + 1) {
        u.atkCd = 2 / (CFG.UNIT_ATK_RATE * (u._territoryMul ?? 1));
        const rawDmg = (u.dmg != null ? u.dmg : CFG.UNIT_DMG) * (u._territoryMul ?? 1);
        const dmg = Math.max(1, Math.round(rawDmg));
        const p = state.players.get(u.owner);
        state.bullets.push({
          fromX: u.x, fromY: u.y,
          toX: rangedTurretTarget.x, toY: rangedTurretTarget.y,
          x: u.x, y: u.y,
          speed: RANGED_BULLET_SPEED,
          hitR: RANGED_BULLET_HIT_R,
          dmg,
          color: p ? p.color : 0xffaa00,
          type: "ranged",
          maxDist: atkRange * 1.3,
          traveled: 0,
          ownerId: u.owner,
          canHitTurrets: true
        });
      }
    }

    for (const u of [...state.units.values()]) {
      if (u.hp <= 0) killUnit(u, "killed", u.lastDamagedBy);
    }

    const dmgPerUnit = CFG.CITY_DAMAGE_PER_UNIT_PER_S * dt;
    const baseInflR = CFG.INFLUENCE_BASE_R || 240;
    for (const p of state.players.values()) {
      const cityScale = Math.max(1, Math.min(2.5, (p.influenceR || baseInflR) / baseInflR));
      const cityHalfSize = 27 * cityScale;
      const cityQueryR = cityHalfSize * 1.5 + 20;
      let damage = 0;
      let topAttacker = null, topDmg = 0;
      const attackerDmg = {};
      const near = queryHash(p.x, p.y, cityQueryR);
      for (let i = 0; i < near.length; i++) {
        const u = near[i];
        if (u.owner === p.id) continue;
        const inSquare = Math.abs(u.x - p.x) <= cityHalfSize && Math.abs(u.y - p.y) <= cityHalfSize;
        if (inSquare) {
          damage += dmgPerUnit;
          attackerDmg[u.owner] = (attackerDmg[u.owner] || 0) + dmgPerUnit;
        }
      }
      if (damage > 0) {
        p.popFloat = Math.max(0, p.popFloat - damage);
        p.pop = Math.floor(p.popFloat);
        for (const [aid, d] of Object.entries(attackerDmg)) {
          if (d > topDmg) { topDmg = d; topAttacker = Number(aid); }
        }
        p._lastCityAttacker = topAttacker;
      }
    }

    stepCityDefense(dt);

    for (const p of [...state.players.values()]) {
      if (p.pop <= 0) {
        if (p._lastCityAttacker != null) {
          const killer = state.players.get(p._lastCityAttacker);
          if (killer && killer.pop > 0) {
            killer.popFloat += 100;
            killer.pop = Math.floor(killer.popFloat);
            if (!killer._growthBonuses) killer._growthBonuses = [];
            killer._growthBonuses.push({ amount: 20, expiresAt: state.t + 180 });
            state.floatingDamage.push({ x: killer.x, y: killer.y - 40, text: "+100 нас, +20 рост!", color: 0xffd700, ttl: 3.0 });
          }
        }
        destroyCity(p);
      }
    }
  }

  function stepCityDefense(dt) {
    const rate = CFG.CITY_ATTACK_RATE;
    for (const p of state.players.values()) {
      p.cityAtkCd = (p.cityAtkCd ?? 0) - dt;
      if (p.cityAtkCd > 0) continue;
      const turretDmgMul = (p.turretDmgMul != null ? p.turretDmgMul : 1) * getLevelBonusMul(p);
      const turretRangeMul = p.turretRangeMul != null ? p.turretRangeMul : 1;
      const cityAtkRadius = CFG.CITY_ATTACK_RADIUS * turretRangeMul * (p.waterBonus ? 1.25 : 1);
      const cityR2 = cityAtkRadius * cityAtkRadius;
      const dmg = Math.max(1, Math.round(CFG.CITY_ATTACK_DMG * turretDmgMul));
      const X = 1 + Math.floor(p.pop / (CFG.CITY_TARGETS_POP_DIVISOR || 75));
      const enemies = [];
      for (const u of state.units.values()) {
        if (u.owner === p.id) continue;
        if (dist2(u.x, u.y, p.x, p.y) <= cityR2) enemies.push(u);
      }
      enemies.sort((a, b) => dist2(a.x, a.y, p.x, p.y) - dist2(b.x, b.y, p.x, p.y));
      const toShoot = enemies.slice(0, X);
      if (toShoot.length > 0) {
        p.cityAtkCd = 1 / rate;
        for (const target of toShoot) {
          state.bullets.push({
            fromX: p.x, fromY: p.y,
            toX: target.x, toY: target.y,
            x: p.x, y: p.y,
            speed: CFG.CITY_BULLET_SPEED,
            hitR: 10,
            ownerId: p.id,
            dmg,
            color: p.color,
            type: "ranged",
            maxDist: cityAtkRadius * 1.3,
            traveled: 0,
            big: true
          });
        }
      }
    }
  }

  function stepBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];

      if (b.type === "ranged") {
        const dx = b.toX - b.x, dy = b.toY - b.y;
        const dl = Math.hypot(dx, dy) || 1;
        const step = b.speed * dt;
        b.x += (dx / dl) * step;
        b.y += (dy / dl) * step;
        b.traveled += step;

        let hit = false;
        const nearby = queryHash(b.x, b.y, b.hitR + 4);
        for (let j = 0; j < nearby.length; j++) {
          const u = nearby[j];
          if (u.owner === b.ownerId) continue;
          if ((b.x - u.x) ** 2 + (b.y - u.y) ** 2 <= b.hitR * b.hitR) {
            u.hp = Math.max(0, u.hp - b.dmg);
            u.lastDamagedBy = b.ownerId;
            u._hitFlashT = state.t;
            state.floatingDamage.push({ x: u.x, y: u.y - 22, text: "-" + b.dmg, color: 0xffaa00, ttl: 1.0 });
            hit = true;
            break;
          }
        }
        if (!hit && b.canHitTurrets) {
          const hitR2 = (b.hitR + 8) * (b.hitR + 8);
          for (const t of state.turrets.values()) {
            if (t.owner === b.ownerId || t.hp <= 0) continue;
            if ((b.x - t.x) ** 2 + (b.y - t.y) ** 2 <= hitR2) {
              t.hp = Math.max(0, t.hp - b.dmg);
              state.floatingDamage.push({ x: t.x, y: t.y - 18, text: "-" + b.dmg, color: 0xffaa00, ttl: 1.0 });
              if (t.hp <= 0) { spawnXPOrb(t.x, t.y, 8); t._diedAt = state.t; }
              hit = true;
              break;
            }
          }
        }
        if (hit || b.traveled > b.maxDist) {
          state.bullets.splice(i, 1);
        }
      } else {
        b.progress = (b.progress || 0) + dt / b.duration;
        if (b.progress >= 1) {
          const u = state.units.get(b.targetId);
          if (u) { u.hp -= b.dmg; if (u.hp <= 0) killUnit(u, "city"); }
          state.bullets.splice(i, 1);
        }
      }
    }
  }

  /** Visual-only bullet simulation for remote clients (no damage, no hit detection). */
  function stepBulletsVisual(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      if (b.type === "ranged") {
        const dx = b.toX - b.x, dy = b.toY - b.y;
        const dl = Math.hypot(dx, dy) || 1;
        const step = (b.speed || 160) * dt;
        b.x += (dx / dl) * step;
        b.y += (dy / dl) * step;
        b.traveled = (b.traveled || 0) + step;
        if (b.traveled > (b.maxDist || 80)) state.bullets.splice(i, 1);
      } else {
        b.progress = (b.progress || 0) + dt / (b.duration || 0.5);
        if (b.progress >= 1) state.bullets.splice(i, 1);
      }
    }
  }

  function drawBullets() {
    destroyChildren(bulletsLayer);
    if (state.bullets.length === 0) return;
    const g = new PIXI.Graphics();
    for (let i = 0; i < state.bullets.length; i++) {
      const b = state.bullets[i];
      if (!inView(b.x || b.fromX, b.y || b.fromY)) continue;
      if (b.type === "ranged") {
        const dx = b.toX - b.fromX, dy = b.toY - b.fromY;
        const dl = Math.hypot(dx, dy) || 1;
        const tx = -(dx / dl) * 6, ty = -(dy / dl) * 6;
        g.lineStyle(2, b.color ?? 0xffaa00, 0.9);
        g.moveTo(b.x, b.y);
        g.lineTo(b.x + tx, b.y + ty);
        g.beginFill(0xffffff, 1);
        g.drawCircle(b.x, b.y, b.big ? 4 : 2.5);
        g.endFill();
      } else {
        const t = Math.min(1, b.progress || 0);
        const x = b.fromX + (b.toX - b.fromX) * t;
        const y = b.fromY + (b.toY - b.fromY) * t;
        g.beginFill(b.color ?? 0xffff00, 1);
        g.drawCircle(x, y, b.big ? 6 : 5);
        g.endFill();
      }
    }
    bulletsLayer.addChild(g);
  }

  function destroyCity(p) {
    if (p.cityGfx) cityLayer.removeChild(p.cityGfx);
    if (p.label) cityLayer.removeChild(p.label);
    if (p.popLabel) cityLayer.removeChild(p.popLabel);
    if (p.zoneGfx) zonesLayer.removeChild(p.zoneGfx);
    if (p.zoneGlow) zonesLayer.removeChild(p.zoneGlow);

    const ghostG = new PIXI.Graphics();
    ghostG.lineStyle(3, 0x555555, 0.8);
    ghostG.beginFill(0x1a1a1a, 0.5);
    ghostG.drawRoundedRect(-27, -27, 54, 54, 10);
    ghostG.endFill();
    ghostG.position.set(p.x, p.y);
    const ghostLabel = new PIXI.Text("☠️", {
      fontFamily: "Arial",
      fontSize: 28,
      fill: 0xffffff
    });
    ghostLabel.anchor.set(0.5, 0.5);
    ghostLabel.position.set(p.x, p.y);
    ghostLayer.addChild(ghostG, ghostLabel);
    state.ghosts.push({ x: p.x, y: p.y, gfx: ghostG, label: ghostLabel });

    for (let i = 0; i < 18; i++) {
      const rx = p.x + rand(-40, 40), ry = p.y + rand(-40, 40);
      spawnXPOrb(rx, ry, 3 + Math.floor(Math.random() * 5));
    }
    if (!state._ruinSpawns) state._ruinSpawns = [];
    state._ruinSpawns.push({ x: p.x, y: p.y, nextSpawn: state.t + 60 });

    for (const u of [...state.units.values()]) {
      if (u.owner === p.id) {
        if (u.gfx) unitsLayer.removeChild(u.gfx);
        state.units.delete(u.id);
      }
    }
    for (const tid of (p.turretIds || [])) {
      const t = state.turrets.get(tid);
      if (t) {
        if (t.gfx) turretLayer.removeChild(t.gfx);
        if (t.labelGfx) turretLayer.removeChild(t.labelGfx);
        if (t.radiusGfx) turretLayer.removeChild(t.radiusGfx);
        state.turrets.delete(tid);
      }
    }
    p.turretIds = [];
    state.players.delete(p.id);
  }

  // ------------------------------------------------------------
  // Movement, resource pickup, rainbow flee
  // ------------------------------------------------------------
  const WAYPOINT_RADIUS = 22;
  const FORMATION_DEAD_ZONE = 1.2;

  function stepUnits(dt) {
    buildBattleCache();

    for (const u of state.units.values()) {
      if (u.leaderId !== null && u.leaderId !== undefined) continue;
      if (u.chaseTargetUnitId != null) {
        const target = state.units.get(u.chaseTargetUnitId);
        if (!target) u.chaseTargetUnitId = undefined;
        else {
          u.waypoints = [{ x: target.x, y: target.y }];
          u.waypointIndex = 0;
          u.straightMode = false;
        }
      }
      if (u.chaseTargetCityId != null) {
        const city = state.players.get(u.chaseTargetCityId);
        if (!city) u.chaseTargetCityId = undefined;
        else {
          u.waypoints = [{ x: city.x, y: city.y }];
          u.waypointIndex = 0;
          u.straightMode = false;
        }
      }
      if (u.chaseTargetUnitId == null && u.chaseTargetCityId == null) {
        const wp = u.waypoints;
        const atDest = !wp || (u.waypointIndex ?? 0) >= wp.length;
        if (atDest) {
          const meleeR = 60;
          for (const cp of state.players.values()) {
            if (cp.id === u.owner) continue;
            if (Math.abs(u.x - cp.x) < meleeR && Math.abs(u.y - cp.y) < meleeR) {
              u.chaseTargetCityId = cp.id;
              break;
            }
          }
        }
      }
    }
    const inCombatSet = getUnitsInCombatSet();

    for (const u of state.units.values()) {
      if (u.leaderId && !state.units.get(u.leaderId)) u.leaderId = null;

      let dx, dy;
      const leader = u.leaderId ? state.units.get(u.leaderId) : null;

      if (inCombatSet.has(u.id)) {
        const slot = getUnitFrontSlot(u);
        if (slot) {
          dx = slot.tx - u.x;
          dy = slot.ty - u.y;
          if (Math.hypot(dx, dy) < FORMATION_DEAD_ZONE) dx = dy = 0;
        } else { dx = 0; dy = 0; }
      } else if (leader && u.leaderId) {
        const tx = leader.x + (u.formationOffsetX ?? 0);
        const ty = leader.y + (u.formationOffsetY ?? 0);
        dx = tx - u.x;
        dy = ty - u.y;
        if (Math.hypot(dx, dy) < FORMATION_DEAD_ZONE) dx = dy = 0;
      } else {
        const wp = u.waypoints;
        const idx = u.waypointIndex ?? 0;
        if (wp && idx >= wp.length) {
          u.straightMode = false;
          dx = 0;
          dy = 0;
        } else if (wp && idx < wp.length) {
          const t = wp[idx];
          dx = t.x - u.x;
          dy = t.y - u.y;
          const dist = Math.hypot(dx, dy);
          if (dist <= WAYPOINT_RADIUS) {
            u.waypointIndex = idx + 1;
            if (u.waypointIndex >= wp.length && u.leaderId == null) {
              const squad = [u];
              for (const v of state.units.values()) if (v.leaderId === u.id) squad.push(v);
              if (u.targetFormationAngle != null) {
                applyFormationToSquad(squad, u.formationType || "pig", u.formationRows || 1, Math.cos(u.targetFormationAngle), Math.sin(u.targetFormationAngle), u.formationPigWidth);
                u.targetFormationAngle = undefined;
              }
            }
            if (u.waypointIndex < wp.length) {
              const next = wp[u.waypointIndex];
              dx = next.x - u.x;
              dy = next.y - u.y;
            } else {
              dx = 0;
              dy = 0;
            }
          }
        } else if (u.straightMode) {
          dx = u.vx * 100;
          dy = u.vy * 100;
        } else {
          dx = (u.waypoints?.[0]?.x ?? u.x + 100) - u.x;
          dy = (u.waypoints?.[0]?.y ?? u.y) - u.y;
        }
      }

      const len = Math.hypot(dx, dy) || 1;
      if (!u.straightMode || Math.hypot(dx, dy) < 1) {
        u.vx = dx / len;
        u.vy = dy / len;
      }

      const zoneOwner = getZoneOwnerFast(u.x, u.y);
      u._territoryMul = zoneOwner === u.owner ? 1.1 : (zoneOwner !== 0 && zoneOwner !== u.owner ? 0.9 : 1);
      const speedMul = getTerrainSpeedMultiplier(u.x, u.y);
      const owner = state.players.get(u.owner);
      const unitSpeedMul = (owner && owner.unitSpeedMul != null ? owner.unitSpeedMul : 1) * getLevelBonusMul(owner);
      const speed = CFG.UNIT_SPEED * speedMul * unitSpeedMul * (u._territoryMul ?? 1);
      if (inCombatSet.has(u.id)) {
        const slot = getUnitFrontSlot(u);
        if (slot) {
          const toX = slot.tx - u.x, toY = slot.ty - u.y;
          const dist = Math.hypot(toX, toY) || 1;
          const move = Math.min(speed * dt * 1.2, dist);
          u.x += (toX / dist) * move;
          u.y += (toY / dist) * move;
        }
      } else {
        u.x += u.vx * speed * dt;
        u.y += u.vy * speed * dt;

        if (u.x < 0 || u.x > CFG.WORLD_W || u.y < 0 || u.y > CFG.WORLD_H) {
        u.x = clamp(u.x, 0, CFG.WORLD_W);
        u.y = clamp(u.y, 0, CFG.WORLD_H);
        if (u.vx > 0 && u.x >= CFG.WORLD_W) u.vx = -Math.abs(u.vx);
        if (u.vx < 0 && u.x <= 0) u.vx = Math.abs(u.vx);
        if (u.vy > 0 && u.y >= CFG.WORLD_H) u.vy = -Math.abs(u.vy);
        if (u.vy < 0 && u.y <= 0) u.vy = Math.abs(u.vy);
        }
      }

      const UNIT_MIN_DIST = 4;
      const atRest = (dx === 0 && dy === 0);
      const nearU = queryHash(u.x, u.y, UNIT_MIN_DIST + 2);
      for (let ni = 0; ni < nearU.length; ni++) {
        const v = nearU[ni];
        if (v.id === u.id) continue;
        const sx = u.x - v.x, sy = u.y - v.y;
        const sd = Math.hypot(sx, sy);
        if (sd < UNIT_MIN_DIST && sd > 0.01) {
          let force = v.owner === u.owner ? 0.8 : 2.5;
          if (atRest) force *= 0.12;
          const push = (UNIT_MIN_DIST - sd) * force * dt;
          u.x += (sx / sd) * push;
          u.y += (sy / sd) * push;
        }
      }

      if (u.gfx) {
        const vis = inView(u.x, u.y);
        u.gfx.visible = vis;
        if (vis) {
          const vfc = state._frameCtr;
          const sel = state.selectedUnitIds.has(u.id);
          const flashing = u._hitFlashT != null && (state.t - u._hitFlashT) < 0.3;
          const hovered = state._hoverTarget && state._hoverTarget.id === u.id;
          const stateChanged = (u._lastSelected !== sel || u._lastFlash !== flashing || u._lastHovered !== hovered);
          const needRedraw = stateChanged || (vfc + u.id) % 4 === 0;
          if (needRedraw) {
            u._lastSelected = sel;
            u._lastFlash = flashing;
            u._lastHovered = hovered;
            const col = flashing ? 0xff2222 : (sel ? 0xffffff : (hovered ? 0xff4444 : (u.color || 0x888888)));
            u.gfx.clear();
            u.gfx.beginFill(col, 0.9);
            u.gfx.drawRoundedRect(-5, -5, 10, 10, 2);
            u.gfx.endFill();
            u.gfx.lineStyle(2, 0xffffff, 0.8);
            u.gfx.moveTo(0, 0);
            u.gfx.lineTo(10, 0);
            if (hovered) {
              u.gfx.lineStyle(2, 0xff4444, 0.8);
              u.gfx.drawCircle(0, 0, 12);
            }
          }
          u.gfx.position.set(u.x, u.y);
          u.gfx.rotation = Math.atan2(u.vy, u.vx);
        }
      }
    }
  }

  function stepSquadMerge(dt) {
    const range2 = CFG.ACTIVITY_RADIUS * CFG.ACTIVITY_RADIUS * 6;
    const squads = getSquads();
    for (let i = 0; i < squads.length; i++) {
      for (let j = i + 1; j < squads.length; j++) {
        const a = squads[i], b = squads[j];
        if (a.length === 0 || b.length === 0) continue;
        const ownerA = a[0].owner, ownerB = b[0].owner;
        if (ownerA !== ownerB) continue;

        const singleUnit = a.length === 1 || b.length === 1;
        let touch = false;
        for (const u of a) {
          for (const v of b) {
            const r2 = singleUnit ? range2 * 2 : range2;
            if (dist2(u.x, u.y, v.x, v.y) <= r2) { touch = true; break; }
          }
          if (touch) break;
        }
        if (!touch) continue;

        let main = a, sub = b;
        if (b.length > a.length) { main = b; sub = a; }
        else if (b.length === a.length) {
          const leaderIdA = a[0].leaderId || a[0].id;
          const leaderIdB = b[0].leaderId || b[0].id;
          if (leaderIdB > leaderIdA) { main = b; sub = a; }
        }
        const mainLeaderId = main[0].leaderId ?? main[0].id;
        const mainLeader = main.find(u => u.id === mainLeaderId) || main[0];
        for (const u of sub) {
          u.leaderId = mainLeaderId;
          u.formationOffsetX = u.x - mainLeader.x;
          u.formationOffsetY = u.y - mainLeader.y;
        }
      }
    }
  }

  function mergeBattleSurvivorsIntoOneSquad() {
    const nowInCombat = getUnitsInCombatSet();
    const justLeft = [];
    for (const id of state.prevInCombatIds) {
      if (!nowInCombat.has(id)) {
        const u = state.units.get(id);
        if (u) justLeft.push(u);
      }
    }
    state.prevInCombatIds.clear();
    for (const id of nowInCombat) state.prevInCombatIds.add(id);

    const byOwner = new Map();
    for (const u of justLeft) {
      if (!byOwner.has(u.owner)) byOwner.set(u.owner, []);
      byOwner.get(u.owner).push(u);
    }
    const touchR2 = CFG.ACTIVITY_RADIUS * CFG.ACTIVITY_RADIUS * 4;
    for (const units of byOwner.values()) {
      if (units.length < 2) continue;
      const n = units.length;
      const parent = units.map((_, i) => i);
      function find(i) { return parent[i] === i ? i : (parent[i] = find(parent[i])); }
      function union(i, j) { parent[find(i)] = find(j); }
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++)
          if (dist2(units[i].x, units[i].y, units[j].x, units[j].y) <= touchR2) union(i, j);
      const comps = new Map();
      for (let i = 0; i < n; i++) {
        const r = find(i);
        if (!comps.has(r)) comps.set(r, []);
        comps.get(r).push(units[i]);
      }
      for (const comp of comps.values()) {
        if (comp.length < 2) continue;
        const leader = comp[0];
        const leaderId = leader.id;
        leader.leaderId = null;
        for (const u of comp) {
          u.leaderId = u.id === leaderId ? null : leaderId;
          u.formationOffsetX = u.x - leader.x;
          u.formationOffsetY = u.y - leader.y;
        }
      }
    }
  }

  function stepResourceMagnet(dt) {
    for (const r of state.res.values()) {
      if (r.type === "rainbow") {
        if (r.gfx) {
          const hue = (state.t * 80 + (r.id || 0) * 40) % 360;
          r.gfx.tint = hslToHex(hue, 0.9, 0.65);
        }
      }

      if (!r._targetCity && !isInOverlapFast(r.x, r.y)) {
        const owner = getZoneOwnerFast(r.x, r.y);
        if (owner) {
          const p = state.players.get(owner);
          if (p) {
            r._targetCity = owner;
          }
        }
      }

      if (r.gfx) {
        const vis = inView(r.x, r.y);
        r.gfx.visible = vis;
        if (vis) r.gfx.position.set(r.x, r.y);
      }
    }
  }

  function stepPickups(dt) {
    const toDelete = [];
    const touchR = CFG.ACTIVITY_RADIUS;

    for (const r of state.res.values()) {
      if (r._targetCity) {
        const p = state.players.get(r._targetCity);
        if (!p) { r._targetCity = null; continue; }
        const dx = p.x - r.x, dy = p.y - r.y;
        const dl = Math.hypot(dx, dy);
        if (dl < 15) {
          gainXP(p, r.xp);
          if (p.id === state.myPlayerId) tickSound(1480, 0.03, 0.04);
          toDelete.push(r.id);
          continue;
        }
        const isRainbow = r.type === "rainbow";
        let speed = isRainbow ? CFG.RES_MAGNET_SPEED * 0.5 : CFG.RES_MAGNET_SPEED * 1.8;
        const terrain = getTerrainType(r.x, r.y);
        if (terrain === "shallowWater" || terrain === "deepWater") speed *= 1.8;
        if (!isRainbow) {
          const zoneOwner = getZoneOwnerFast(r.x, r.y);
          if (zoneOwner === r._targetCity) speed += CFG.RES_MAGNET_SPEED;
        }
        r.x += (dx / dl) * speed * dt;
        r.y += (dy / dl) * speed * dt;
        if (r.gfx) r.gfx.position.set(r.x, r.y);
      }

      const nearby = queryHash(r.x, r.y, touchR);
      for (let i = 0; i < nearby.length; i++) {
        const u = nearby[i];
        if (r._targetCity && r._targetCity === u.owner) continue;
        r._targetCity = u.owner;
        break;
      }

      if (!r._targetCity) {
        for (const p of state.players.values()) {
          if ((r.x - p.x) ** 2 + (r.y - p.y) ** 2 <= 100) {
            gainXP(p, r.xp);
            if (p.id === state.myPlayerId) tickSound(1480, 0.03, 0.04);
            toDelete.push(r.id);
            break;
          }
        }
      }
    }

    for (const id of toDelete) deleteResource(id);
  }

  function isVisibleToAnyPlayer(x, y) {
    for (const p of state.players.values()) {
      if (isPointInPolygon(x, y, p.influencePolygon)) return true;
      for (const u of state.units.values()) {
        if (u.owner !== p.id) continue;
        if (dist2(x, y, u.x, u.y) <= CFG.UNIT_VISION * CFG.UNIT_VISION) return true;
      }
    }
    return false;
  }

  function getNearestThreat(x, y) {
    let best = null;
    let bestD = 1e18;
    const fleeR2 = CFG.RAINBOW_FLEE_DIST * CFG.RAINBOW_FLEE_DIST;
    for (const p of state.players.values()) {
      const d = dist2(x, y, p.x, p.y);
      if (d < bestD && isPointInPolygon(x, y, p.influencePolygon)) {
        bestD = d;
        best = { x: p.x, y: p.y };
      }
    }
    for (const u of state.units.values()) {
      const d = dist2(x, y, u.x, u.y);
      if (d < bestD && d <= CFG.UNIT_VISION * CFG.UNIT_VISION) {
        bestD = d;
        best = { x: u.x, y: u.y };
      }
    }
    if (best && bestD <= fleeR2) return best;
    return null;
  }

  // ------------------------------------------------------------
  // XP / levels (city-centric)
  // ------------------------------------------------------------
  function gainXP(p, amount) {
    const prevLevel = p.level;
    const gainMul = p.xpGainMul != null ? p.xpGainMul : 1;
    p.xp += amount * gainMul;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      if (p.level % 5 === 0) p.rerollCount = (p.rerollCount || 0) + 1;
      p.pop = (p.pop || 0) + 10;
      p.popFloat = (p.popFloat || p.pop) + 10;
      p._levelBonusMul = 1 + p.level * 0.01;
      p.xpNext = xpNeed(p.level, p);
      p.pendingCardPicks = (p.pendingCardPicks || 0) + 1;
    }
    if (p.id === state.myPlayerId && p.level > prevLevel) levelUpSound();
    if (p.id !== state.myPlayerId && (p.pendingCardPicks || 0) > 0 && state.botPlayerIds && state.botPlayerIds.has(p.id)) {
      while (p.pendingCardPicks > 0) {
        const cards = getRandomCards(3);
        const pick = cards[Math.floor(Math.random() * cards.length)];
        applyCard(p, pick);
        p.pendingCardPicks--;
      }
    }
  }

  // ------------------------------------------------------------
  // Population / influence growth
  // ------------------------------------------------------------
  function sampleWaterRatioAround(cx, cy, radius, samples) {
    let water = 0;
    for (let i = 0; i < samples; i++) {
      const a = (i / samples) * Math.PI * 2;
      const x = cx + Math.cos(a) * radius;
      const y = cy + Math.sin(a) * radius;
      const t = getTerrainType(x, y);
      if (t === "deepWater" || t === "shallowWater") water++;
    }
    return water / samples;
  }

  function stepCities(dt) {
    const unitCountByOwner = new Map();
    for (const u of state.units.values()) {
      unitCountByOwner.set(u.owner, (unitCountByOwner.get(u.owner) || 0) + 1);
    }

    for (const p of state.players.values()) {
      if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - dt);
      p.activeUnits = unitCountByOwner.get(p.id) || 0;
      const active = p.activeUnits;

      if (p._waterRatioCache == null || (state._frameCtr || 0) % 120 === 0) {
        p._waterRatioCache = sampleWaterRatioAround(p.x, p.y, 80, 16);
      }
      p.waterBonus = p._waterRatioCache >= CFG.WATER_RATIO_THRESHOLD;

      let base = CFG.GROWTH_BASE_PER_MIN + Math.floor(p.popFloat / 100) * CFG.GROWTH_PER_100;
      if (p.waterBonus) base += CFG.WATER_GROWTH_BONUS;

      let pen = Math.min(CFG.ACTIVE_SOLDIER_PENALTY_CAP, active * CFG.ACTIVE_SOLDIER_PENALTY_PER);
      if (p.waterBonus) pen = Math.max(0, pen - CFG.WATER_PENALTY_REDUCTION);

      p.killGrowthStacks = (p.killGrowthStacks || []).filter(et => et > state.t);
      const killBonus = 0.30 * (p.killGrowthStacks || []).length;
      if (p._growthBonuses) p._growthBonuses = p._growthBonuses.filter(b => b.expiresAt > state.t);
      const cityDestroyBonus = (p._growthBonuses || []).reduce((s, b) => s + b.amount, 0);
      const growthMul = p.growthMul != null ? p.growthMul : 1;
      const perMin = (base * (1 - pen) + killBonus + cityDestroyBonus) * growthMul;
      const perSec = perMin / 60;

      p.popFloat = Math.max(0, p.popFloat + perSec * dt);
      p.pop = Math.floor(p.popFloat);

      const numRays = CFG.TERRAIN_RAYS ?? 96;
      const popBucket = Math.floor(p.popFloat / 5);
      if (popBucket !== p._lastPopBucket) {
        p._lastPopBucket = popBucket;
        p._cachedTargetPoly = computeInfluencePolygon(p.x, p.y, p.popFloat);
      }
      const targetPoly = p._cachedTargetPoly || computeInfluencePolygon(p.x, p.y, p.popFloat);
      if (!p._targetDist || p._targetDist.length !== numRays) p._targetDist = new Array(numRays);
      if (!p._boost || p._boost.length !== numRays) p._boost = new Array(numRays);
      if (!p._polyBuf || p._polyBuf.length !== numRays) {
        p._polyBuf = [];
        for (let i = 0; i < numRays; i++) p._polyBuf.push({ x: 0, y: 0 });
      }
      const targetDist = p._targetDist;
      const boost = p._boost;
      for (let i = 0; i < numRays; i++) {
        const pt = targetPoly[i] || targetPoly[0];
        targetDist[i] = Math.hypot(pt.x - p.x, pt.y - p.y);
      }
      if (!p.influenceRayDistances || p.influenceRayDistances.length !== numRays) {
        p.influenceRayDistances = targetPoly.map(pt => Math.hypot(pt.x - p.x, pt.y - p.y));
      }
      for (let i = 0; i < numRays; i++) boost[i] = 1;
      const activeUnits = p.activeUnits ?? 0;
      const armyPenalty = Math.max(0.1, 1 - activeUnits * 0.0045);
      const influenceSpeedMul = (p.influenceSpeedMul != null ? p.influenceSpeedMul : 1) * armyPenalty;
      for (const other of state.players.values()) {
        if (other.id === p.id || !other.influencePolygon || other.influencePolygon.length < 3) continue;
        const myP = (p.pop || 0) * (p.influenceSpeedMul != null ? p.influenceSpeedMul : 1) * armyPenalty;
        const otherP = (other.pop || 0) * (other.influenceSpeedMul != null ? other.influenceSpeedMul : 1) * Math.max(0.1, 1 - (other.activeUnits ?? 0) * 0.0045);
        if (otherP <= myP) continue;
        for (let i = 0; i < numRays; i++) {
          const angle = (i / numRays) * Math.PI * 2;
          const d = p.influenceRayDistances[i] ?? 0;
          const ex = p.x + Math.cos(angle) * d;
          const ey = p.y + Math.sin(angle) * d;
          if (isPointInPolygon(ex, ey, other.influencePolygon)) boost[i] = 0;
        }
      }
      const speed = (CFG.INFLUENCE_GROWTH_SPEED ?? 0.15) * influenceSpeedMul;
      const maxGrowthDelta = 2;
      let maxR = 0;
      for (let i = 0; i < numRays; i++) {
        const target = targetDist[i] ?? 0;
        let cur = p.influenceRayDistances[i] ?? target;
        const mul = boost[i];
        const lerpFactor = Math.min(1, dt * speed * mul);
        let delta = (target - cur) * lerpFactor;
        delta = delta > 0 ? Math.min(delta, maxGrowthDelta) : Math.max(delta, -maxGrowthDelta);
        cur = Math.max(0, cur + delta);
        p.influenceRayDistances[i] = cur;
        if (cur > maxR) maxR = cur;
      }
      const polyBuf = p._polyBuf;
      for (let i = 0; i < numRays; i++) {
        const angle = (i / numRays) * Math.PI * 2;
        const d = p.influenceRayDistances[i];
        polyBuf[i].x = p.x + Math.cos(angle) * d;
        polyBuf[i].y = p.y + Math.sin(angle) * d;
      }
      p.influencePolygon = polyBuf;
      p.influenceR = maxR;
    }
    const pressure = (pl) => {
      const inflMul = pl.influenceSpeedMul != null ? pl.influenceSpeedMul : 1;
      const armyPenalty = Math.max(0.1, 1 - (pl.activeUnits ?? 0) * 0.0045);
      return (pl.pop || 0) * inflMul * armyPenalty;
    };
    const numRays = CFG.TERRAIN_RAYS ?? 96;
    for (const p of state.players.values()) {
      if (!p._rayTmp || p._rayTmp.length !== numRays) p._rayTmp = new Array(numRays);
      if (!p._raySmooth || p._raySmooth.length !== numRays) {
        p._raySmooth = new Float64Array(numRays);
        for (let i = 0; i < numRays; i++) p._raySmooth[i] = p.influenceRayDistances[i] ?? 0;
      }
      const rt = p._rayTmp;
      for (let i = 0; i < numRays; i++) rt[i] = p.influenceRayDistances[i];
    }
    for (let pass = 0; pass < 2; pass++) {
      for (const p of state.players.values()) {
        const rays = p._rayTmp;
        if (!rays || rays.length !== numRays) continue;
        const myPressure = pressure(p);
        for (const other of state.players.values()) {
          if (other.id === p.id || !other.influencePolygon || other.influencePolygon.length < 3) continue;
          const otherPressure = pressure(other);
          const pushRatio = otherPressure / (myPressure + otherPressure + 1);
          const cx = other.x, cy = other.y;
          const otherR = other.influenceR || 100;
          for (let i = 0; i < numRays; i++) {
            const angle = (i / numRays) * Math.PI * 2;
            const d = rays[i] ?? 0;
            const ex = p.x + Math.cos(angle) * d;
            const ey = p.y + Math.sin(angle) * d;
            if (isPointInPolygon(ex, ey, other.influencePolygon)) {
              const distToOther = Math.hypot(ex - cx, ey - cy);
              const penetration = Math.max(0, otherR - distToOther);
              const targetD = Math.max(10, d - penetration * Math.max(pushRatio, 0.3));
              const smoothFactor = 0.04;
              const delta = (targetD - d) * smoothFactor;
              const maxDelta = 1.5;
              const clamped = delta > 0 ? Math.min(delta, maxDelta) : Math.max(delta, -maxDelta);
              rays[i] = d + clamped;
            }
          }
        }
      }
    }
    for (const p of state.players.values()) {
      const rays = p._rayTmp;
      if (!rays) continue;
      const trm = p.turretRangeMul != null ? p.turretRangeMul : 1;
      const cityR = CFG.CITY_ATTACK_RADIUS * trm * (p.waterBonus ? 1.25 : 1);
      const minZoneR = cityR * 0.5;
      for (let i = 0; i < numRays; i++) {
        if (rays[i] < minZoneR) rays[i] = minZoneR;
      }
      p.influenceRayDistances = rays;
      const polyBuf = p._polyBuf;
      for (let i = 0; i < numRays; i++) {
        const angle = (i / numRays) * Math.PI * 2;
        const d = rays[i];
        polyBuf[i].x = p.x + Math.cos(angle) * d;
        polyBuf[i].y = p.y + Math.sin(angle) * d;
      }
      p.influencePolygon = polyBuf;
      let maxR2 = 0;
      for (let i = 0; i < numRays; i++) {
        const pt = polyBuf[i];
        const dd = Math.hypot(pt.x - p.x, pt.y - p.y);
        if (dd > maxR2) maxR2 = dd;
      }
      p.influenceR = maxR2;
      const totalArea = CFG.WORLD_W * CFG.WORLD_H;
      const zoneArea = polygonArea(p.influencePolygon);
      p.xpZonePct = totalArea > 0 ? (zoneArea / totalArea * 100) : 0;
      p.xpGainMul = p.xpZonePct < 5 ? 1.2 : 1;
      p.xpNext = xpNeed(p.level, p);
      redrawZone(p);
    }
  }

  // ------------------------------------------------------------
  // Bots (squad-based AI: farm, attack, expand)
  // ------------------------------------------------------------
  const BOT_TICK = 1.5;
  const BOT_SPAWN_INTERVAL = (CFG.BOT_SEND_DELAY ?? 0.6) * 0.5;
  function botMergeSmallSquads(pid) {
    const squads = getSquads().filter(s => s.length > 0 && s[0].owner === pid);
    const inCombat = getUnitsInCombatSet();
    const small = squads.filter(s => s.length < 8 && !s.some(u => inCombat.has(u.id)));
    if (small.length < 2) return;
    small.sort((a, b) => b.length - a.length);
    const mainSquad = small[0];
    const mainLeader = mainSquad.find(u => !u.leaderId) || mainSquad[0];
    const mainLeaderId = mainLeader.id;
    for (let i = 1; i < small.length; i++) {
      for (const u of small[i]) {
        u.leaderId = mainLeaderId;
        u.formationOffsetX = u.x - mainLeader.x;
        u.formationOffsetY = u.y - mainLeader.y;
      }
    }
  }

  function botThink(dt) {
    for (const p of state.players.values()) {
      if (p.id === state.myPlayerId) continue;
      if (state.botPlayerIds && !state.botPlayerIds.has(p.id)) continue;
      p._botAcc = (p._botAcc ?? 0) + dt;
      const tick = p._botAcc >= BOT_TICK;
      if (tick) p._botAcc = 0;

      if (tick) botMergeSmallSquads(p.id);

      const squads = getSquads().filter(s => s.length > 0 && s[0].owner === p.id);
      const myUnitCount = squads.reduce((sum, s) => sum + s.length, 0);

      function nearestEnemyCity() {
        let best = null, bestD = 1e18;
        for (const other of state.players.values()) {
          if (other.id === p.id) continue;
          const d = dist2(p.x, p.y, other.x, other.y);
          if (d < bestD) { bestD = d; best = other; }
        }
        return best;
      }
      function nearestResource(outsideZone) {
        let best = null, bestD = 1e18;
        for (const r of state.res.values()) {
          const d = dist2(p.x, p.y, r.x, r.y);
          if (d >= bestD) continue;
          if (outsideZone && getZoneOwnerFast(r.x, r.y) === p.id) continue;
          bestD = d; best = r;
        }
        return best;
      }
      function setSquadWaypoint(squad, x, y) {
        const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
        leader.chaseTargetUnitId = undefined;
        leader.chaseTargetCityId = undefined;
        leader.waypoints = [{ x, y }];
        leader.waypointIndex = 0;
        leader.straightMode = false;
        for (const u of squad) {
          u.waypoints = [{ x, y }];
          u.waypointIndex = 0;
        }
      }

      const enemyCity = nearestEnemyCity();
      const resToFarm = nearestResource(true);
      const distToEnemy = enemyCity ? Math.hypot(enemyCity.x - p.x, enemyCity.y - p.y) : 1e18;

      if (tick) {
        const target = (enemyCity && distToEnemy < 650) ? enemyCity
          : (resToFarm && (!enemyCity || distToEnemy > 500)) ? resToFarm
          : enemyCity || resToFarm || { x: p.x + rand(-400, 400), y: p.y + rand(-400, 400) };
        const wx = target.x != null ? target.x : p.x, wy = target.y != null ? target.y : p.y;
        for (const squad of squads) {
          const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
          const wp = leader.waypoints;
          const idx = leader.waypointIndex ?? 0;
          const idle = !wp || idx >= wp.length;
          const inCombat = getUnitsInCombatSet().has(leader.id);
          if (!inCombat && (idle || p._botAcc === 0)) setSquadWaypoint(squad, wx, wy);
        }
      }

      if (p.sendDelay > 0) {
        p.sendDelay -= dt;
        if (p.sendDelay <= 0 && p.pendingSend) {
          const { count, tx, ty } = p.pendingSend;
          p.pendingSend = null;
          spawnUnits(p.id, count, [{ x: tx, y: ty }]);
        }
        continue;
      }
      if (p.cooldown > 0) continue;
      if (p.pop < CFG.UNIT_POP_PER) continue;

      const wantAttack = enemyCity && distToEnemy < 600;
      const target = wantAttack ? enemyCity : (resToFarm || enemyCity || { x: p.x + (CFG.WORLD_W * 0.5 - p.x) * 0.2 + rand(-200, 200), y: p.y + (CFG.WORLD_H * 0.5 - p.y) * 0.2 + rand(-200, 200) });
      const tx = clamp((target.x || 0) + rand(-30, 30), 0, CFG.WORLD_W);
      const ty = clamp((target.y || 0) + rand(-30, 30), 0, CFG.WORLD_H);
      const maxAvailable = Math.floor(p.pop / CFG.UNIT_POP_PER);
      const desired = Math.max(10, Math.floor(p.pop / (wantAttack ? 16 : 22)));
      if (maxAvailable < 10 && maxAvailable < 3) continue;
      const count = Math.min(desired, maxAvailable);

      p.pendingSend = { count, tx, ty };
      p.sendDelay = BOT_SPAWN_INTERVAL;
    }
  }

  // ------------------------------------------------------------
  // Input: camera, selection, target click
  // ------------------------------------------------------------
  let isPanning = false;
  let panBtn = 0;
  let lastX = 0, lastY = 0;
  const HIT_RADIUS = 28;

  function unitAtWorld(wx, wy) {
    let best = null;
    let bestD = HIT_RADIUS * HIT_RADIUS;
    for (const u of state.units.values()) {
      if (u.owner !== state.myPlayerId) continue;
      const d = (u.x - wx) ** 2 + (u.y - wy) ** 2;
      if (d < bestD) { bestD = d; best = u; }
    }
    return best;
  }

  function unitAtWorldAny(wx, wy) {
    let best = null;
    let bestD = HIT_RADIUS * HIT_RADIUS;
    for (const u of state.units.values()) {
      const d = (u.x - wx) ** 2 + (u.y - wy) ** 2;
      if (d < bestD) { bestD = d; best = u; }
    }
    return best;
  }

  function cityAtWorld(wx, wy) {
    const baseInflR = CFG.INFLUENCE_BASE_R || 240;
    let best = null;
    let bestD = Infinity;
    for (const p of state.players.values()) {
      const cityScale = Math.max(1, Math.min(2.5, (p.influenceR || baseInflR) / baseInflR));
      const R = 27 * cityScale;
      const R2 = R * R;
      const d = (p.x - wx) ** 2 + (p.y - wy) ** 2;
      if (d > R2) continue;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function statDiffHTML(enemyVal, myVal) {
    if (myVal == null || myVal === 0) return "";
    const pct = ((enemyVal - myVal) / myVal) * 100;
    if (Math.abs(pct) < 0.5) return "";
    if (pct > 0) return " <span class='stat-diff stat-diff-red'>↑ (+" + pct.toFixed(1) + "%)</span>";
    return " <span class='stat-diff stat-diff-green'>↓ (" + pct.toFixed(1) + "%)</span>";
  }
  function getEnemyCityStatsHTML(p) {
    const me = state.players.get(state.myPlayerId);
    const base = CFG.GROWTH_BASE_PER_MIN + Math.floor(p.pop / 100) * CFG.GROWTH_PER_100;
    const pen = Math.min(CFG.ACTIVE_SOLDIER_PENALTY_CAP, (p.activeUnits || 0) * CFG.ACTIVE_SOLDIER_PENALTY_PER);
    const killBonus = 0.30 * ((p.killGrowthStacks || []).filter(et => et > state.t).length);
    const cityDestroyBonus = ((p._growthBonuses || []).filter(b => b.expiresAt > state.t)).reduce((s, b) => s + b.amount, 0);
    const growthMul = p.growthMul != null ? p.growthMul : 1;
    const perMin = (base * (1 - pen) + killBonus + cityDestroyBonus) * growthMul;
    const turretCount = (p.turretIds || []).filter(tid => { const t = state.turrets.get(tid); return t && t.hp > 0; }).length;
    const cityDmgMul = p.turretDmgMul != null ? p.turretDmgMul : 1;
    const cityDmg = Math.max(1, Math.round(CFG.CITY_ATTACK_DMG * cityDmgMul * (p.waterBonus ? 1.25 : 1) * getLevelBonusMul(p)));
    const infSpdMul = p.influenceSpeedMul != null ? p.influenceSpeedMul : 1;
    const unitHpMul = (p.unitHpMul != null ? p.unitHpMul : 1) * getLevelBonusMul(p);
    const unitDmgMul = (p.unitDmgMul != null ? p.unitDmgMul : 1) * getLevelBonusMul(p);
    const unitSpdMul = (p.unitSpeedMul != null ? p.unitSpeedMul : 1) * getLevelBonusMul(p);
    const unitAtkRMul = (p.unitAtkRateMul != null ? p.unitAtkRateMul : 1) * getLevelBonusMul(p);
    const unitAtkRngMul = Math.min(UNIT_ATK_RANGE_MAX_MUL, p.unitAtkRangeMul != null ? p.unitAtkRangeMul : 1);
    const meleeR = CFG.UNIT_VISION;
    const atkR = Math.round(CFG.UNIT_VISION * unitAtkRngMul);
    const isRanged = atkR > meleeR + 1;
    const myPop = me ? me.pop : 0;
    const myLevel = me ? me.level : 0;
    const myXpNext = me ? me.xpNext : 1;
    const myPerMin = me ? (() => { const b = CFG.GROWTH_BASE_PER_MIN + Math.floor(me.pop / 100) * CFG.GROWTH_PER_100; const penM = Math.min(CFG.ACTIVE_SOLDIER_PENALTY_CAP, (me.activeUnits || 0) * CFG.ACTIVE_SOLDIER_PENALTY_PER); const killM = 0.30 * ((me.killGrowthStacks || []).filter(et => et > state.t).length); const cityM = ((me._growthBonuses || []).filter(b => b.expiresAt > state.t)).reduce((s, b) => s + b.amount, 0); return (b * (1 - penM) + killM + cityM) * (me.growthMul != null ? me.growthMul : 1); })() : 0;
    const myCityDmg = me ? Math.max(1, Math.round(CFG.CITY_ATTACK_DMG * (me.turretDmgMul != null ? me.turretDmgMul : 1) * getLevelBonusMul(me))) : 0;
    const myInfR = me ? (me.influenceR || 0) : 0;
    const myInfSpd = me ? (me.influenceSpeedMul != null ? me.influenceSpeedMul : 1) : 1;
    const myTurretCount = me ? (me.turretIds || []).filter(tid => { const t = state.turrets.get(tid); return t && t.hp > 0; }).length : 0;
    const myCooldown = me ? (me.cooldown ?? 0) : 0;
    const myUnitHp = me ? Math.round(CFG.UNIT_HP * (me.unitHpMul != null ? me.unitHpMul : 1) * getLevelBonusMul(me)) : 0;
    const myUnitDmg = me ? (CFG.UNIT_DMG * (me.unitDmgMul != null ? me.unitDmgMul : 1) * getLevelBonusMul(me)) : 0;
    const myUnitSpd = me ? (CFG.UNIT_SPEED * (me.unitSpeedMul != null ? me.unitSpeedMul : 1) * getLevelBonusMul(me)) : 0;
    const myUnitAtkR = me ? (CFG.UNIT_ATK_RATE * (me.unitAtkRateMul != null ? me.unitAtkRateMul : 1) * getLevelBonusMul(me)) : 0;
    const cityPart =
      "<div class='stat-line'><span class='stat-label'>Население</span><span class='stat-val'>" + p.pop + statDiffHTML(p.pop, myPop) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Уровень</span><span class='stat-val'>" + p.level + statDiffHTML(p.level, myLevel) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Опыт</span><span class='stat-val'>" + p.xp + "/" + p.xpNext + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Рост</span><span class='stat-val'>" + perMin.toFixed(1) + "/мин" + statDiffHTML(perMin, myPerMin) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Урон города</span><span class='stat-val'>" + cityDmg + statDiffHTML(cityDmg, myCityDmg) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Зона</span><span class='stat-val'>R " + (p.influenceR || 0).toFixed(0) + statDiffHTML(p.influenceR || 0, myInfR) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Скор. зоны</span><span class='stat-val'>×" + infSpdMul.toFixed(2) + statDiffHTML(infSpdMul, myInfSpd) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Турели</span><span class='stat-val'>" + turretCount + statDiffHTML(turretCount, myTurretCount) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>КД</span><span class='stat-val'>" + (p.cooldown ?? 0).toFixed(1) + "с" + statDiffHTML((p.cooldown ?? 0), myCooldown) + "</span></div>";
    const armyPart =
      "<div class='stat-line'><span class='stat-label'>ХП</span><span class='stat-val'>" + Math.round(CFG.UNIT_HP * unitHpMul) + statDiffHTML(Math.round(CFG.UNIT_HP * unitHpMul), myUnitHp) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Урон</span><span class='stat-val'>" + (CFG.UNIT_DMG * unitDmgMul).toFixed(1) + statDiffHTML(CFG.UNIT_DMG * unitDmgMul, myUnitDmg) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Скорость движения</span><span class='stat-val'>" + (CFG.UNIT_SPEED * unitSpdMul).toFixed(1) + statDiffHTML(CFG.UNIT_SPEED * unitSpdMul, myUnitSpd) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Атак/с</span><span class='stat-val'>" + (CFG.UNIT_ATK_RATE * unitAtkRMul).toFixed(1) + statDiffHTML(CFG.UNIT_ATK_RATE * unitAtkRMul, myUnitAtkR) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Р. сцепки</span><span class='stat-val'>" + meleeR + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Р. атаки</span><span class='stat-val'>" + atkR + (isRanged ? " ⚔→" : "") + "</span></div>";
    return "<div class='box stats-columns'>" +
      "<div class='stats-col'><div class='subtitle'>Город</div><div class='me-stats'>" + cityPart + "</div></div>" +
      "<div class='stats-col'><div class='subtitle'>Армия</div><div class='me-stats'>" + armyPart + "</div></div>" +
      "</div>";
  }
  function showEnemyCityPanel(p) {
    const el = document.getElementById("enemyCityPanel");
    const content = document.getElementById("enemyCityPanelContent");
    const titleEl = document.getElementById("enemyCityPanelTitle");
    if (!el || !content) return;
    state._enemyCityPanelPlayerId = p ? p.id : null;
    if (!p) { el.style.display = "none"; return; }
    if (titleEl) titleEl.textContent = (p.name || "Противник");
    content.innerHTML = getEnemyCityStatsHTML(p);
    el.style.display = "block";
  }
  function closeEnemyCityPanel() {
    state._enemyCityPanelPlayerId = null;
    const el = document.getElementById("enemyCityPanel");
    if (el) el.style.display = "none";
  }
  const enemyCityPanelCloseEl = document.getElementById("enemyCityPanelClose");
  if (enemyCityPanelCloseEl) enemyCityPanelCloseEl.addEventListener("click", closeEnemyCityPanel);

  function unitsInRect(x1, y1, x2, y2) {
    const lx = Math.min(x1, x2), rx = Math.max(x1, x2);
    const ly = Math.min(y1, y2), ry = Math.max(y1, y2);
    const out = [];
    for (const u of state.units.values()) {
      if (u.owner !== state.myPlayerId) continue;
      if (u.x >= lx && u.x <= rx && u.y >= ly && u.y <= ry) out.push(u);
    }
    return out;
  }

  function getSelectedSquads() {
    const seen = new Set();
    const squads = [];
    for (const id of state.selectedUnitIds) {
      const u = state.units.get(id);
      if (!u || u.owner !== state.myPlayerId) continue;
      const lid = u.leaderId || u.id;
      if (seen.has(lid)) continue;
      seen.add(lid);
      const squad = [];
      for (const v of state.units.values())
        if ((v.leaderId || v.id) === lid && v.owner === state.myPlayerId) squad.push(v);
      if (squad.length) squads.push(squad);
    }
    return squads;
  }

  app.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  app.canvas.addEventListener("pointerdown", (e) => {
    ensureAudio();
    const btn = e.button;
    const pt = screenToWorld(e.clientX, e.clientY);

    if (btn === 2 || btn === 1) {
      if (btn === 2 && state.selectedUnitIds.size > 0) {
        const squads = getSelectedSquads();
        let cx = 0, cy = 0, n = 0;
        for (const squad of squads) for (const u of squad) { cx += u.x; cy += u.y; n++; }
        if (n) { cx /= n; cy /= n; }
        state.formationPreview = {
          x: pt.x,
          y: pt.y,
          angle: Math.atan2(pt.y - cy, pt.x - cx)
        };
        return;
      }
      isPanning = true;
      panBtn = btn;
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }

    if (btn === 0) {
      if (state.rallyPointMode) {
        state.rallyPoint = { x: pt.x, y: pt.y };
        state.rallyPointMode = false;
        if (rallyPointHintEl) rallyPointHintEl.textContent = "Точка сбора: " + Math.round(pt.x) + ", " + Math.round(pt.y);
        return;
      }
      if (state.selectedUnitIds.size > 0) {
        const enemyUnit = unitAtWorldAny(pt.x, pt.y);
        if (enemyUnit && enemyUnit.owner !== state.myPlayerId) {
          const squads = getSelectedSquads();
          const leaderIds = [];
          for (const squad of squads) {
            const leader = squad.find(v => (v.leaderId || v.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
            leader.chaseTargetUnitId = enemyUnit.id;
            leader.chaseTargetCityId = undefined;
            leader.waypoints = [{ x: enemyUnit.x, y: enemyUnit.y }];
            leader.waypointIndex = 0;
            leader.straightMode = false;
            leaderIds.push(leader.id);
          }
          if (state._multiSlots && !state._multiIsHost && state._socket) {
            state._socket.emit("playerAction", { type: "chase", leaderIds, targetUnitId: enemyUnit.id, x: enemyUnit.x, y: enemyUnit.y });
          }
          return;
        }
        const city = cityAtWorld(pt.x, pt.y);
        if (city && city.id !== state.myPlayerId) {
          const squads = getSelectedSquads();
          const leaderIds = [];
          for (const squad of squads) {
            const leader = squad.find(v => (v.leaderId || v.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
            leader.chaseTargetCityId = city.id;
            leader.chaseTargetUnitId = undefined;
            leader.waypoints = [{ x: city.x, y: city.y }];
            leader.waypointIndex = 0;
            leader.straightMode = false;
            leaderIds.push(leader.id);
          }
          if (state._multiSlots && !state._multiIsHost && state._socket) {
            state._socket.emit("playerAction", { type: "chaseCity", leaderIds, targetCityId: city.id, x: city.x, y: city.y });
          }
          return;
        }
      }
      if (state.selectedUnitIds.size === 0) {
        const city = cityAtWorld(pt.x, pt.y);
        if (city && city.id !== state.myPlayerId) {
          showEnemyCityPanel(city);
          return;
        }
      }
      const u = unitAtWorld(pt.x, pt.y);
      if (u) {
        if (e.ctrlKey || e.metaKey) {
          if (state.selectedUnitIds.has(u.id)) state.selectedUnitIds.delete(u.id);
          else state.selectedUnitIds.add(u.id);
        } else {
          const lid = u.leaderId || u.id;
          state.selectedUnitIds.clear();
          for (const v of state.units.values())
            if ((v.leaderId || v.id) === lid && v.owner === state.myPlayerId) state.selectedUnitIds.add(v.id);
        }
        state.boxStart = null;
        state.boxEnd = null;
        return;
      }
      state.boxStart = { x: pt.x, y: pt.y };
      state.boxEnd = { x: pt.x, y: pt.y };
      if (!e.ctrlKey && !e.metaKey) state.selectedUnitIds.clear();
      closeEnemyCityPanel();
      return;
    }
  });

  window.addEventListener("pointerup", (e) => {
    if (e.button === 0 && state.boxStart && state.boxEnd) {
      const dx = Math.abs(state.boxEnd.x - state.boxStart.x);
      const dy = Math.abs(state.boxEnd.y - state.boxStart.y);
      if (dx > 5 || dy > 5) {
        const inRect = unitsInRect(state.boxStart.x, state.boxStart.y, state.boxEnd.x, state.boxEnd.y);
        for (const u of inRect) state.selectedUnitIds.add(u.id);
      }
      state.boxStart = null;
      state.boxEnd = null;
    }
    if (e.button === 2 && state.formationPreview) {
      const fp = state.formationPreview;
      const squads = getSelectedSquads();
      const leaderIds = [];
      const addWaypoint = e.shiftKey;
      for (const squad of squads) {
        const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
        const fType = leader.formationType || "pig";
        const fRows = leader.formationRows || 1;
        const pigW = leader.formationPigWidth ?? 1;
        const cosA = Math.cos(fp.angle), sinA = Math.sin(fp.angle);
        const offs = getFormationOffsets(squad.length, fType, fRows, cosA, sinA, pigW);
        const fc = getFormationCenter(offs);
        const newPt = { x: fp.x - fc.x, y: fp.y - fc.y };
        const waypoints = addWaypoint ? [...(leader.waypoints || []), newPt] : [newPt];
        leader.targetFormationAngle = fp.angle;
        leader.chaseTargetUnitId = undefined;
        leader.chaseTargetCityId = undefined;
        for (const u of squad) {
          u.waypoints = waypoints.map(w => ({ x: w.x, y: w.y }));
          u.waypointIndex = addWaypoint ? (u.waypointIndex ?? 0) : 0;
          u.straightMode = false;
        }
        leaderIds.push(leader.id);
      }
      if (state._multiSlots && !state._multiIsHost && state._socket) {
        const firstLeader = state.units.get(leaderIds[0]);
        const waypoints = firstLeader ? firstLeader.waypoints : [{ x: fp.x, y: fp.y }];
        state._socket.emit("playerAction", { type: "move", leaderIds, waypoints, x: fp.x, y: fp.y, angle: fp.angle });
      }
      state.formationPreview = null;
    }
    if (e.button === panBtn) {
      isPanning = false;
      panBtn = 0;
    }
  });

  window.addEventListener("pointermove", (e) => {
    if (state.boxStart && e.buttons === 1) {
      state.boxEnd = screenToWorld(e.clientX, e.clientY);
    }
    if (state.formationPreview && (e.buttons & 2)) {
      const w = screenToWorld(e.clientX, e.clientY);
      state.formationPreview.angle = Math.atan2(w.y - state.formationPreview.y, w.x - state.formationPreview.x);
    }
    if (isPanning) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      cam.x += dx;
      cam.y += dy;
      applyCamera();
    }
    const pt = screenToWorld(e.clientX, e.clientY);
    const enemyU = unitAtWorldAny(pt.x, pt.y);
    const enemyC = cityAtWorld(pt.x, pt.y);
    const isEnemyUnit = enemyU && enemyU.owner !== state.myPlayerId;
    const isEnemyCity = enemyC && enemyC.id !== state.myPlayerId;
    if (isEnemyUnit || isEnemyCity) {
      app.canvas.style.cursor = "crosshair";
    } else {
      app.canvas.style.cursor = "default";
    }
    state._hoverTarget = isEnemyUnit ? enemyU : (isEnemyCity ? enemyC : null);
    state._hoverWorld = pt;
    let attackCursorEl = document.getElementById("attackCursorEmoji");
    if (!attackCursorEl) {
      attackCursorEl = document.createElement("div");
      attackCursorEl.id = "attackCursorEmoji";
      attackCursorEl.style.cssText = "position:fixed;pointer-events:none;z-index:9999;font-size:28px;text-shadow:0 0 4px #000, 0 0 8px #000;";
      document.body.appendChild(attackCursorEl);
    }
    if (state.selectedUnitIds.size > 0 && state._hoverTarget) {
      attackCursorEl.textContent = "⚔️";
      attackCursorEl.style.display = "block";
      attackCursorEl.style.left = (e.clientX - 14) + "px";
      attackCursorEl.style.top = (e.clientY - 36) + "px";
    } else {
      attackCursorEl.style.display = "none";
    }
  });

  app.canvas.addEventListener("pointerleave", () => {
    if (state.boxStart) { state.boxStart = null; state.boxEnd = null; }
    if (state.formationPreview) state.formationPreview = null;
    const attackCursorEl = document.getElementById("attackCursorEmoji");
    if (attackCursorEl) attackCursorEl.style.display = "none";
  });

  app.canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const old = cam.zoom;
    const dir = Math.sign(e.deltaY);
    const factor = dir > 0 ? 0.92 : 1.08;
    const newZoom = clamp(old * factor, 0.003, 1.8);

    // zoom to cursor
    const before = screenToWorld(e.clientX, e.clientY);
    cam.zoom = newZoom;
    applyCamera();
    const after = screenToWorld(e.clientX, e.clientY);

    cam.x += (after.x - before.x) * cam.zoom;
    cam.y += (after.y - before.y) * cam.zoom;
    applyCamera();
  }, { passive: false });

  function screenToWorld(sx, sy) {
    // invert camera transform
    const x = (sx - cam.x) / cam.zoom;
    const y = (sy - cam.y) / cam.zoom;
    return { x, y };
  }

  // UI buttons
  resetCamBtn.addEventListener("click", () => {
    const me = state.players.get(state.myPlayerId);
    if (me) centerOn(me.x, me.y);
  });

  regenBtn.addEventListener("click", () => {
    if (state._multiSlots && state._multiIsHost && state._socket && state._roomId) {
      const seed = (Date.now() >>> 0) + Math.floor(Math.random() * 0xffff);
      state._gameSeed = seed;
      state._socket.emit("mapRegenerate", { seed });
      rebuildMap(seed);
      rebuildGrid();
      resetWorldMulti(state._multiSlots, state._slotToPid);
      for (const p of state.players.values()) {
        redrawZone(p);
        rebuildTurrets(p);
      }
      const me = state.players.get(state.myPlayerId);
      if (me) centerOn(me.x, me.y);
      return;
    }
    if (state._multiSlots) return;
    rebuildMap();
    resetWorld();
    for (const p of state.players.values()) {
      redrawZone(p);
      rebuildTurrets(p);
    }
  });

  toggleZonesBtn.addEventListener("click", () => {
    state.zonesEnabled = !state.zonesEnabled;
    if (state.zonesEnabled) {
      for (const p of state.players.values()) p._lastZoneHash = undefined;
    }
    zonesLayer.visible = state.zonesEnabled;
    toggleZonesBtn.style.opacity = state.zonesEnabled ? "1" : "0.55";
  });

  toggleGridBtn.addEventListener("click", () => {
    CFG.GRID_ENABLED = !CFG.GRID_ENABLED;
    rebuildGrid();
    toggleGridBtn.style.opacity = CFG.GRID_ENABLED ? "1" : "0.55";
  });

  const togglePerfLogBtn = document.getElementById("togglePerfLog");
  const perfLogWrap = document.getElementById("perfLogWrap");
  if (togglePerfLogBtn && perfLogWrap) {
    togglePerfLogBtn.addEventListener("click", () => {
      const show = perfLogWrap.style.display !== "block";
      perfLogWrap.style.display = show ? "block" : "none";
      togglePerfLogBtn.style.opacity = show ? "1" : "0.6";
    });
  }

  sendBtn.addEventListener("click", () => {
    const me = state.players.get(state.myPlayerId);
    if (!me) return;
    if (!state.targetPoints) state.targetPoints = state.rallyPoint ? [state.rallyPoint] : [{ x: me.x + 220, y: me.y }];
    if (state.targetPoints.length === 0) state.targetPoints = state.rallyPoint ? [state.rallyPoint] : [{ x: me.x + 220, y: me.y }];
    const want = Number(sendCountEl?.value ?? 3);
    const formationType = (formationSelect && formationSelect.value) || "pig";
    const formationRows = (formationRowsEl && parseInt(formationRowsEl.value, 10)) || 1;
    if (state._multiSlots && !state._multiIsHost && state._socket) {
      console.log("[MP-ACTION] send spawn pid=", state.myPlayerId, "count=", want);
      state._socket.emit("playerAction", { type: "spawn", pid: state.myPlayerId, count: want, waypoints: state.targetPoints, formationType, formationRows });
      state.targetPoints = [];
      return;
    }
    const res = spawnUnits(me.id, want, state.targetPoints, { formationType, formationRows });
    if (res.ok) state.targetPoints = [];
    if (!res.ok) tickSound(220, 0.05, 0.03);
  });

  document.querySelectorAll(".speed-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (state._multiSlots && !state._multiIsHost) return;
      const speed = parseInt(btn.dataset.speed, 10) || 1;
      state.timeScale = speed;
      document.querySelectorAll(".speed-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
  const firstSpeed = document.querySelector(".speed-btn[data-speed='1']");
  if (firstSpeed) firstSpeed.classList.add("active");

  const lvlUpBtn = document.getElementById("lvlUpBtn");
  if (lvlUpBtn) lvlUpBtn.addEventListener("click", openCardModal);

  // ------------------------------------------------------------
  // Spawn resources scheduler
  // ------------------------------------------------------------
  let resAcc = 0;
  let burstAcc = 0;

  function stepResourceSpawn(dt) {
    const maxRes = CFG.RES_MAX ?? 520;
    if (state.res.size >= maxRes) return;
    resAcc += dt * CFG.RES_SPAWN_PER_S;
    while (resAcc >= 1 && state.res.size < maxRes) {
      resAcc -= 1;
      spawnResourceRandom();
    }
    burstAcc += dt;
    if (burstAcc >= CFG.RES_SPAWN_BURST_EVERY_S) {
      burstAcc = 0;
      for (let i = 0; i < CFG.RES_SPAWN_BURST_COUNT && state.res.size < maxRes; i++) spawnResourceRandom();
    }
    if (state._ruinSpawns) {
      for (const ruin of state._ruinSpawns) {
        if (state.t >= ruin.nextSpawn) {
          ruin.nextSpawn = state.t + 60;
          for (let i = 0; i < 12 && state.res.size < maxRes; i++) {
            spawnXPOrb(ruin.x + rand(-35, 35), ruin.y + rand(-35, 35), 2 + Math.floor(Math.random() * 4));
          }
        }
      }
    }
  }

  // ------------------------------------------------------------
  // HUD update
  // ------------------------------------------------------------
  function updateLvlUpButton() {
    const me = state.players.get(state.myPlayerId);
    const btn = document.getElementById("lvlUpBtn");
    const countEl = document.getElementById("lvlUpCount");
    const progressEl = document.getElementById("lvlUpProgress");
    const levelTextEl = document.getElementById("lvlUpLevelText");
    const xpTextEl = document.getElementById("lvlUpXpText");
    if (!btn || !me) return;
    const n = me.pendingCardPicks || 0;
    const xpNext = me.xpNext || 1;
    const pct = Math.min(1, (me.xp || 0) / xpNext);
    if (progressEl) progressEl.style.width = (pct * 100) + "%";
    if (countEl) countEl.textContent = n;
    if (levelTextEl) levelTextEl.textContent = "Ур. " + (me.level || 1);
    const gainMod = me.xpGainMul != null && me.xpGainMul !== 1 ? " " + (me.xpGainMul > 1 ? "+" : "") + (Math.round((me.xpGainMul - 1) * 100)) + "%" : "";
    if (xpTextEl) xpTextEl.textContent = "(" + Math.floor(me.xp || 0) + gainMod + ")";
    btn.classList.toggle("lvlup-btn-gray", n === 0);
    btn.classList.toggle("lvlup-btn-ready", n > 0);
    btn.style.visibility = "visible";
  }

  function getCardEmoji(card) {
    const keys = Object.keys(card);
    if (keys.some(k => k.startsWith("unitHp"))) return "❤️";
    if (keys.some(k => k.startsWith("unitDmg"))) return "⚔️";
    if (keys.some(k => k.startsWith("unitAtkRate"))) return "💥";
    if (keys.some(k => k.startsWith("unitSpeed"))) return "🏃";
    if (keys.some(k => k.startsWith("growth"))) return "📈";
    if (keys.some(k => k.startsWith("influence"))) return "🌐";
    if (keys.some(k => k.startsWith("unitAtkRange"))) return "🏹";
    if (keys.some(k => k.startsWith("turret"))) return "🏰";
    if (keys.some(k => k.startsWith("sendCooldown"))) return "⏩";
    if (card.popBonus) return "👥";
    return "🃏";
  }

  const CARD_PARAM_TOOLTIPS = {
    unitHp: "Здоровье юнитов: больше выдерживают урона в бою.",
    unitDmg: "Урон юнитов: больше урона по врагам и турелям.",
    unitAtkRate: "Скорость атаки: юниты бьют чаще.",
    unitSpeed: "Скорость движения: отряды быстрее доходят до цели.",
    unitAtkRange: "Дальность атаки: юниты могут бить с большего расстояния.",
    growth: "Рост населения: город быстрее набирает население.",
    influence: "Расширение зоны: граница влияния растёт быстрее (штраф за армию всё равно применяется).",
    sendCooldown: "КД отправки: можно чаще отправлять отряды из города.",
    turret: "Турели и город: урон, HP или радиус атаки турелей; урон города.",
    popBonus: "Мгновенное население: сразу добавляет юнитов к лимиту отправки."
  };
  function getCardParamTooltip(card) {
    const keys = Object.keys(card);
    if (card.popBonus) return CARD_PARAM_TOOLTIPS.popBonus;
    if (keys.some(k => k.startsWith("unitHp"))) return CARD_PARAM_TOOLTIPS.unitHp;
    if (keys.some(k => k.startsWith("unitDmg"))) return CARD_PARAM_TOOLTIPS.unitDmg;
    if (keys.some(k => k.startsWith("unitAtkRate"))) return CARD_PARAM_TOOLTIPS.unitAtkRate;
    if (keys.some(k => k.startsWith("unitSpeed"))) return CARD_PARAM_TOOLTIPS.unitSpeed;
    if (keys.some(k => k.startsWith("unitAtkRange"))) return CARD_PARAM_TOOLTIPS.unitAtkRange;
    if (keys.some(k => k.startsWith("growth"))) return CARD_PARAM_TOOLTIPS.growth;
    if (keys.some(k => k.startsWith("influence"))) return CARD_PARAM_TOOLTIPS.influence;
    if (keys.some(k => k.startsWith("sendCooldown"))) return CARD_PARAM_TOOLTIPS.sendCooldown;
    if (keys.some(k => k.startsWith("turret"))) return CARD_PARAM_TOOLTIPS.turret;
    return "";
  }
  function getCardCurrentParamText(p, card) {
    if (!p) return "";
    if (card.popBonus) return "Сейчас население: " + p.pop;
    const keys = Object.keys(card);
    const uHp = (p.unitHpMul != null ? p.unitHpMul : 1) * (p._levelBonusMul ?? 1);
    const uDmg = (p.unitDmgMul != null ? p.unitDmgMul : 1) * (p._levelBonusMul ?? 1);
    if (keys.some(k => k.startsWith("unitHp"))) return "Сейчас: HP " + Math.round(CFG.UNIT_HP * uHp);
    if (keys.some(k => k.startsWith("unitDmg"))) return "Сейчас: урон " + (CFG.UNIT_DMG * uDmg).toFixed(1);
    if (keys.some(k => k.startsWith("unitAtkRate"))) return "Сейчас: ×" + ((p.unitAtkRateMul ?? 1) * (p._levelBonusMul ?? 1)).toFixed(2);
    if (keys.some(k => k.startsWith("unitSpeed"))) return "Сейчас: ×" + ((p.unitSpeedMul ?? 1) * (p._levelBonusMul ?? 1)).toFixed(2);
    if (keys.some(k => k.startsWith("unitAtkRange"))) return "Сейчас: ×" + (p.unitAtkRangeMul ?? 1).toFixed(2);
    if (keys.some(k => k.startsWith("growth"))) return "Сейчас: ×" + (p.growthMul ?? 1).toFixed(2);
    if (keys.some(k => k.startsWith("influence"))) return "Сейчас: ×" + (p.influenceSpeedMul ?? 1).toFixed(2);
    if (keys.some(k => k.startsWith("sendCooldown"))) return "Сейчас: ×" + (p.sendCooldownMul ?? 1).toFixed(2);
    if (keys.some(k => k.startsWith("turret"))) return "Сейчас: урон " + (p.turretDmgMul ?? 1).toFixed(2) + ", HP " + (p.turretHpMul ?? 1).toFixed(2);
    return "";
  }

  function drumHit(ctx, time, vol) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(120, time);
    o.frequency.exponentialRampToValueAtTime(50, time + 0.08);
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    o.connect(g); g.connect(ctx.destination);
    o.start(time); o.stop(time + 0.2);
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.5, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    n.connect(ng); ng.connect(ctx.destination);
    n.start(time); n.stop(time + 0.1);
  }

  function cardPickSound(rarity) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (rarity === "legendary") {
      drumHit(ctx, ctx.currentTime, 0.25);
      drumHit(ctx, ctx.currentTime + 0.15, 0.25);
      drumHit(ctx, ctx.currentTime + 0.30, 0.35);
    } else if (rarity === "epic") {
      drumHit(ctx, ctx.currentTime, 0.18);
      drumHit(ctx, ctx.currentTime + 0.18, 0.22);
    }
  }

  function openCardModal() {
    const me = state.players.get(state.myPlayerId);
    if (!me || (me.pendingCardPicks || 0) <= 0) return;
    const modal = document.getElementById("cardModal");
    const choicesEl = document.getElementById("cardChoices");
    const picksLeftEl = document.getElementById("cardPicksLeft");
    const closeBtn = document.getElementById("cardModalClose");
    if (!modal || !choicesEl) return;

    if (closeBtn) closeBtn.onclick = () => { modal.style.display = "none"; updateLvlUpButton(); };
    const rerollWrap = document.getElementById("cardRerollWrap");
    const rerollCountEl = document.getElementById("cardRerollCount");
    if (rerollWrap) rerollWrap.title = "Реролл: заменить текущие 3 карты на новые случайные. Даётся 1 раз за каждые 5 уровней (уровни 5, 10, 15…).";
    if (rerollWrap) rerollWrap.onclick = () => {
      const rc = me.rerollCount || 0;
      if (rc <= 0) return;
      me.rerollCount = rc - 1;
      state._pendingCardChoices = getRandomCards(3);
      renderPick();
    };

    function renderPick() {
      const picks = me.pendingCardPicks || 0;
      if (picksLeftEl) picksLeftEl.textContent = picks;
      if (rerollCountEl) rerollCountEl.textContent = String(me.rerollCount || 0);
      if (picks <= 0) { modal.style.display = "none"; state._pendingCardChoices = null; updateLvlUpButton(); return; }

      let cards = state._pendingCardChoices;
      if (!cards || cards.length === 0) {
        cards = getRandomCards(3);
        state._pendingCardChoices = cards;
      }
      const hasEpicOrLegendary = cards.some(c => c.rarity === "epic" || c.rarity === "legendary");
      if (hasEpicOrLegendary) {
        const best = cards.find(c => c.rarity === "legendary") || cards.find(c => c.rarity === "epic");
        if (best) cardPickSound(best.rarity);
      }

      choicesEl.innerHTML = "";
      let cardTooltipEl = null;
      for (const card of cards) {
        const emoji = getCardEmoji(card);
        const paramHint = getCardParamTooltip(card);
        const currentText = getCardCurrentParamText(me, card);
        const div = document.createElement("div");
        const flashClass = card.rarity === "legendary" ? " flash" : "";
        div.className = "card-option " + card.rarity + flashClass;
        div.innerHTML = "<div class='card-emoji'>" + emoji + "</div><div class='card-name'>" + (card.name || "").replace(/</g, "&lt;") + "</div><div class='card-desc'>" + (card.desc || "").replace(/</g, "&lt;") + "</div>" + (currentText ? "<div class='card-param-now'>" + currentText.replace(/</g, "&lt;") + "</div>" : "");
        if (paramHint) {
          div.title = paramHint;
          div.addEventListener("mouseenter", (e) => {
            if (cardTooltipEl) cardTooltipEl.remove();
            cardTooltipEl = document.createElement("div");
            cardTooltipEl.className = "card-param-tooltip";
            cardTooltipEl.textContent = paramHint;
            cardTooltipEl.style.cssText = "position:fixed;max-width:260px;padding:10px 12px;background:rgba(0,0,0,0.92);color:#e0e8ff;font-size:12px;border-radius:8px;z-index:10002;pointer-events:none;border:1px solid rgba(120,160,255,0.4);";
            document.body.appendChild(cardTooltipEl);
            const rect = div.getBoundingClientRect();
            cardTooltipEl.style.left = (rect.left + rect.width / 2 - 130) + "px";
            cardTooltipEl.style.top = (rect.top - 8) + "px";
            cardTooltipEl.style.transform = "translateY(-100%)";
          });
          div.addEventListener("mouseleave", () => {
            if (cardTooltipEl) { cardTooltipEl.remove(); cardTooltipEl = null; }
          });
        }
        if (card.rarity === "legendary") {
          setTimeout(() => div.classList.remove("flash"), 300);
        }
        div.addEventListener("click", () => {
          if (cardTooltipEl) { cardTooltipEl.remove(); cardTooltipEl = null; }
          if (state._socket && !state._multiIsHost) {
            state._socket.emit("playerAction", { type: "cardChoice", pid: state.myPlayerId, card: card });
          }
          applyCard(me, card);
          me.pendingCardPicks = picks - 1;
          state._pendingCardChoices = null;
          renderPick();
        });
        choicesEl.appendChild(div);
      }
    }

    modal.style.display = "flex";
    renderPick();
  }

  const cityStatsEl = document.getElementById("cityStats");
  const armyStatsEl = document.getElementById("armyStats");

  function updateHUD() {
    const me = state.players.get(state.myPlayerId);
    if (!me) return;

    updateLvlUpButton();

    const maxSend = Math.max(1, Math.floor(me.pop / CFG.UNIT_POP_PER));
    if (Number(sendCountEl.max) !== maxSend) sendCountEl.max = String(maxSend);
    if (Number(sendCountEl.value) > maxSend) {
      sendCountEl.value = String(maxSend);
      sendCountValEl.textContent = sendCountEl.value;
    }

    const base = CFG.GROWTH_BASE_PER_MIN + Math.floor(me.pop / 100) * CFG.GROWTH_PER_100;
    const pen = Math.min(CFG.ACTIVE_SOLDIER_PENALTY_CAP, me.activeUnits * CFG.ACTIVE_SOLDIER_PENALTY_PER);
    const killBonus = 0.30 * ((me.killGrowthStacks || []).filter(et => et > state.t).length);
    const cityDestroyBonusHUD = ((me._growthBonuses || []).filter(b => b.expiresAt > state.t)).reduce((s, b) => s + b.amount, 0);
    const growthMulHUD = me.growthMul != null ? me.growthMul : 1;
    const perMin = (base * (1 - pen) + killBonus + cityDestroyBonusHUD) * growthMulHUD;
    const maxUnits = Math.max(0, Math.floor(me.pop / 2));

    const turretCount = (me.turretIds || []).filter(tid => { const t = state.turrets.get(tid); return t && t.hp > 0; }).length;
    const cityDmgMul = me.turretDmgMul != null ? me.turretDmgMul : 1;
    const cityDmg = Math.max(1, Math.round(CFG.CITY_ATTACK_DMG * cityDmgMul));

    const infSpdMul = me.influenceSpeedMul != null ? me.influenceSpeedMul : 1;
    if (state._enemyCityPanelPlayerId) {
      const ep = state.players.get(state._enemyCityPanelPlayerId);
      const panelEl = document.getElementById("enemyCityPanel");
      if (ep && panelEl && panelEl.style.display === "block") {
        const content = document.getElementById("enemyCityPanelContent");
        if (content) content.innerHTML = getEnemyCityStatsHTML(ep);
      }
    }
    if (cityStatsEl) cityStatsEl.innerHTML =
      "<div class='stat-line'><span class='stat-label'>Население</span><span class='stat-val'>" + me.pop + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Уровень</span><span class='stat-val'>" + me.level + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Опыт</span><span class='stat-val'>" + me.xp + "/" + me.xpNext + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Рост</span><span class='stat-val'>" + perMin.toFixed(1) + "/мин</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Урон города</span><span class='stat-val'>" + cityDmg + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Зона</span><span class='stat-val'>R " + me.influenceR.toFixed(0) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Скор. зоны</span><span class='stat-val'>×" + infSpdMul.toFixed(2) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Турели</span><span class='stat-val'>" + turretCount + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>КД</span><span class='stat-val'>" + me.cooldown.toFixed(1) + "с</span></div>";

    const unitHpMul = me.unitHpMul != null ? me.unitHpMul : 1;
    const unitDmgMul = me.unitDmgMul != null ? me.unitDmgMul : 1;
    const unitSpdMul = me.unitSpeedMul != null ? me.unitSpeedMul : 1;
    const unitAtkRMul = me.unitAtkRateMul != null ? me.unitAtkRateMul : 1;
    const unitAtkRngMul = Math.min(UNIT_ATK_RANGE_MAX_MUL, me.unitAtkRangeMul != null ? me.unitAtkRangeMul : 1);
    const meleeR = CFG.UNIT_VISION;
    const atkR = Math.round(CFG.UNIT_VISION * unitAtkRngMul);
    const isRanged = atkR > meleeR + 1;

    if (armyStatsEl) armyStatsEl.innerHTML =
      "<div class='stat-line'><span class='stat-label'>В поле</span><span class='stat-val'>" + me.activeUnits + "/" + maxUnits + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>ХП</span><span class='stat-val'>" + Math.round(CFG.UNIT_HP * unitHpMul) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Урон</span><span class='stat-val'>" + (CFG.UNIT_DMG * unitDmgMul).toFixed(1) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Скорость движения</span><span class='stat-val'>" + (CFG.UNIT_SPEED * unitSpdMul).toFixed(1) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Атак/с</span><span class='stat-val'>" + (CFG.UNIT_ATK_RATE * unitAtkRMul).toFixed(1) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Р. сцепки</span><span class='stat-val'>" + meleeR + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Р. атаки</span><span class='stat-val'>" + atkR + (isRanged ? " ⚔→" : "") + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>За юнит</span><span class='stat-val'>" + CFG.UNIT_POP_PER + " нас.</span></div>";
  }

  // ------------------------------------------------------------
  // Storm Front
  // ------------------------------------------------------------
  const STORM_INTERVAL = 180;
  const STORM_DURATION = 60;
  const STORM_RADIUS = 210;
  const STORM_DIR_CHANGE = 10;
  const STORM_SPEED = 30;
  const STORM_DMG_INTERVAL = 0.5;

  state.storm = null;
  state._nextStormAt = 5;

  function isInsideAnyZone(x, y) {
    const owner = getZoneOwnerFast(x, y);
    return owner > 0;
  }

  function spawnStorm() {
    let sx = 0, sy = 0, found = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      sx = rand(200, CFG.WORLD_W - 200);
      sy = rand(200, CFG.WORLD_H - 200);
      if (!isInsideAnyZone(sx, sy)) { found = true; break; }
    }
    if (!found) {
      sx = rand(200, CFG.WORLD_W - 200);
      sy = rand(200, CFG.WORLD_H - 200);
    }
    const angle = Math.random() * Math.PI * 2;
    const rotAngle = Math.random() * Math.PI * 2;
    const stretch = 1.4 + Math.random() * 0.8;
    const blobCount = 4 + Math.floor(Math.random() * 3);
    const blobs = [];
    for (let i = 0; i < blobCount; i++) {
      const t = (i / (blobCount - 1)) - 0.5;
      blobs.push({
        ox: t * STORM_RADIUS * stretch * 0.9 + rand(-15, 15),
        oy: rand(-STORM_RADIUS * 0.25, STORM_RADIUS * 0.25),
        r: STORM_RADIUS * (0.45 + Math.random() * 0.25)
      });
    }
    state.storm = {
      x: sx, y: sy,
      vx: Math.cos(angle) * STORM_SPEED,
      vy: Math.sin(angle) * STORM_SPEED,
      spawnedAt: state.t,
      lastDirChange: state.t,
      lastDmgTick: state.t,
      gfx: null,
      emojiContainer: null,
      rotAngle,
      stretch,
      blobs,
      particles: []
    };
    for (let i = 0; i < 35; i++) {
      state.storm.particles.push({
        ox: rand(-STORM_RADIUS * stretch * 0.6, STORM_RADIUS * stretch * 0.6),
        oy: rand(-STORM_RADIUS * 0.5, STORM_RADIUS * 0.5),
        phase: Math.random() * Math.PI * 2,
        speed: 2 + Math.random() * 4
      });
    }
  }

  function stepStorm(dt) {
    if (!state.storm) {
      if (state.t >= state._nextStormAt) {
        spawnStorm();
      }
      return;
    }
    const s = state.storm;
    if (state.t - s.spawnedAt > STORM_DURATION) {
      if (s.gfx) { s.gfx.parent?.removeChild(s.gfx); s.gfx.destroy(true); }
      if (s.emojiContainer) { s.emojiContainer.parent?.removeChild(s.emojiContainer); s.emojiContainer.destroy({ children: true }); }
      state.storm = null;
      state._nextStormAt = state.t + STORM_INTERVAL;
      return;
    }
    if (state.t - s.lastDirChange > STORM_DIR_CHANGE) {
      let bestX = s.x + rand(-200, 200), bestY = s.y + rand(-200, 200), bestCount = 0;
      const cellSize = 120;
      const densityMap = new Map();
      for (const u of state.units.values()) {
        const key = (Math.floor(u.x / cellSize)) + "," + (Math.floor(u.y / cellSize));
        densityMap.set(key, (densityMap.get(key) || 0) + 1);
      }
      for (const [key, count] of densityMap) {
        if (count > bestCount) {
          const [cx, cy] = key.split(",").map(Number);
          bestCount = count;
          bestX = (cx + 0.5) * cellSize;
          bestY = (cy + 0.5) * cellSize;
        }
      }
      const dx = bestX - s.x, dy = bestY - s.y;
      const dl = Math.hypot(dx, dy) || 1;
      const jitter = 0.3;
      s.vx = (dx / dl + rand(-jitter, jitter)) * STORM_SPEED;
      s.vy = (dy / dl + rand(-jitter, jitter)) * STORM_SPEED;
      const mag = Math.hypot(s.vx, s.vy) || 1;
      s.vx = (s.vx / mag) * STORM_SPEED;
      s.vy = (s.vy / mag) * STORM_SPEED;
      s.lastDirChange = state.t;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.x = Math.max(50, Math.min(CFG.WORLD_W - 50, s.x));
    s.y = Math.max(50, Math.min(CFG.WORLD_H - 50, s.y));

    if (state.t - s.lastDmgTick >= STORM_DMG_INTERVAL) {
      s.lastDmgTick = state.t;
      const cosA = Math.cos(s.rotAngle), sinA = Math.sin(s.rotAngle);
      for (const u of state.units.values()) {
        if (u.hp <= 1) continue;
        const rx = (u.x - s.x) * cosA + (u.y - s.y) * sinA;
        const ry = -(u.x - s.x) * sinA + (u.y - s.y) * cosA;
        let inside = false;
        for (const b of s.blobs) {
          if ((rx - b.ox) ** 2 + (ry - b.oy) ** 2 <= b.r * b.r) { inside = true; break; }
        }
        if (inside) {
          const dmg = Math.max(1, Math.floor(u.hp * 0.1));
          if (u.hp - dmg < 1) { u.hp = 1; } else { u.hp -= dmg; }
          u._hitFlashT = state.t;
          state.floatingDamage.push({ x: u.x, y: u.y - 22, text: "-" + dmg + "⚡", color: 0x8888ff, ttl: 0.8 });
        }
      }
    }
  }

  function stormContourPoints(s) {
    const cosA = Math.cos(s.rotAngle), sinA = Math.sin(s.rotAngle);
    const steps = 64;
    const pts = [];
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      let maxD = 0;
      for (const b of s.blobs) {
        const bwx = b.ox * cosA - b.oy * sinA;
        const bwy = b.ox * sinA + b.oy * cosA;
        const rx = b.r, ry = b.r * 0.75;
        const localDx = dx, localDy = dy;
        const eR = Math.sqrt((localDx * rx) ** 2 + (localDy * ry) ** 2);
        const proj = bwx * dx + bwy * dy;
        const d = proj + eR;
        if (d > maxD) maxD = d;
      }
      pts.push({ x: s.x + dx * maxD, y: s.y + dy * maxD });
    }
    return pts;
  }

  function drawStorm() {
    const s = state.storm;
    if (!s) return;
    if (!inView(s.x, s.y)) {
      if (s.gfx) s.gfx.visible = false;
      if (s.emojiContainer) s.emojiContainer.visible = false;
      return;
    }
    if (!s.gfx || s.gfx.destroyed) {
      s.gfx = new PIXI.Graphics();
      world.addChild(s.gfx);
    }
    if (!s.emojiContainer || s.emojiContainer.destroyed) {
      s.emojiContainer = new PIXI.Container();
      world.addChild(s.emojiContainer);
      for (let i = 0; i < 25; i++) {
        const txt = new PIXI.Text({ text: "⚡", style: { fontSize: 24 + Math.random() * 18, fill: 0xffffff } });
        txt.anchor.set(0.5);
        txt._stormOx = rand(-STORM_RADIUS * s.stretch * 0.6, STORM_RADIUS * s.stretch * 0.6);
        txt._stormOy = rand(-STORM_RADIUS * 0.45, STORM_RADIUS * 0.45);
        txt._stormPhase = Math.random() * Math.PI * 2;
        txt._stormCycle = 0.4 + Math.random() * 0.6;
        s.emojiContainer.addChild(txt);
      }
    }
    s.gfx.visible = true;
    s.emojiContainer.visible = true;
    s.gfx.clear();

    const contour = stormContourPoints(s);
    const shimmer = 0.4 + 0.1 * Math.sin(state.t * 1.5);

    s.gfx.beginFill(0x0d0d25, shimmer);
    s.gfx.moveTo(contour[0].x, contour[0].y);
    for (let i = 1; i < contour.length; i++) s.gfx.lineTo(contour[i].x, contour[i].y);
    s.gfx.closePath();
    s.gfx.endFill();

    s.gfx.beginFill(0x111133, shimmer * 0.5);
    const innerScale = 0.7;
    s.gfx.moveTo(s.x + (contour[0].x - s.x) * innerScale, s.y + (contour[0].y - s.y) * innerScale);
    for (let i = 1; i < contour.length; i++) {
      s.gfx.lineTo(s.x + (contour[i].x - s.x) * innerScale, s.y + (contour[i].y - s.y) * innerScale);
    }
    s.gfx.closePath();
    s.gfx.endFill();

    s.gfx.lineStyle(2.5, 0x5555aa, 0.5);
    s.gfx.moveTo(contour[0].x, contour[0].y);
    for (let i = 1; i < contour.length; i++) s.gfx.lineTo(contour[i].x, contour[i].y);
    s.gfx.closePath();

    const t = state.t;
    const cosA = Math.cos(s.rotAngle), sinA = Math.sin(s.rotAngle);

    for (const ch of s.emojiContainer.children) {
      const lx = ch._stormOx * cosA - ch._stormOy * sinA;
      const ly = ch._stormOx * sinA + ch._stormOy * cosA;
      ch.x = s.x + lx + Math.sin(t * 1.8 + ch._stormPhase) * 6;
      ch.y = s.y + ly + Math.cos(t * 1.8 + ch._stormPhase) * 6;
      const cycle = ((t + ch._stormPhase * 2) % ch._stormCycle) / ch._stormCycle;
      ch.alpha = cycle < 0.5 ? Math.min(1, cycle * 4) : Math.max(0, 1 - (cycle - 0.5) * 4);
    }
  }

  // ------------------------------------------------------------
  // Victory Conditions
  // ------------------------------------------------------------
  const VICTORY_DOMINATION_PCT = 0.50;
  const VICTORY_DOMINATION_TIME = 180;
  state._domTimers = {};
  state._gameOver = false;

  function getZoneCoverage() {
    const grid = _zoneGrid;
    if (!grid) return {};
    const total = grid.length;
    const counts = {};
    for (let i = 0; i < grid.length; i++) {
      const v = grid[i];
      if (v > 0) counts[v] = (counts[v] || 0) + 1;
    }
    const result = {};
    for (const [pid, cnt] of Object.entries(counts)) {
      result[pid] = cnt / total;
    }
    return result;
  }

  state._lastVictoryCheckT = 0;

  function checkVictory() {
    if (state._gameOver) return;
    const me = state.players.get(state.myPlayerId);
    if (!me && state.players.size > 0) {
      triggerDefeat("Ваш город уничтожен!");
      return;
    }
    if (!me) return;

    const realDt = state.t - (state._lastVictoryCheckT || 0);
    state._lastVictoryCheckT = state.t;

    const aliveCount = state.players.size;
    if (aliveCount === 1) {
      triggerVictory("Все вражеские города уничтожены!");
      return;
    }

    const coverage = getZoneCoverage();
    for (const [pidStr, pct] of Object.entries(coverage)) {
      const pid = Number(pidStr);
      if (pct >= VICTORY_DOMINATION_PCT) {
        if (state._domTimers[pid] == null) state._domTimers[pid] = 0;
      }
    }
    for (const pidStr of Object.keys(state._domTimers)) {
      const pid = Number(pidStr);
      const pct = coverage[pid] || 0;
      if (pct >= VICTORY_DOMINATION_PCT) {
        state._domTimers[pid] += realDt;
        if (state._domTimers[pid] >= VICTORY_DOMINATION_TIME) {
          const pName = PLAYER_NAMES[pid] || ("Игрок " + pid);
          if (pid === state.myPlayerId) {
            triggerVictory("Доминация " + (pct * 100).toFixed(0) + "% карты!");
          } else {
            triggerDefeat(pName + " захватил " + (pct * 100).toFixed(0) + "% карты!");
          }
          return;
        }
      }
    }
  }

  function updateDominationTimerUI() {
    const el = document.getElementById("dominationTimer");
    if (!el || state._gameOver) { if (el) el.style.display = "none"; return; }
    let bestPid = null, bestTime = 0, bestPct = 0;
    const coverage = getZoneCoverage();
    for (const [pidStr, accTime] of Object.entries(state._domTimers)) {
      const pid = Number(pidStr);
      const pct = coverage[pid] || 0;
      if (pct >= VICTORY_DOMINATION_PCT && accTime > bestTime) {
        bestPid = pid; bestTime = accTime; bestPct = pct;
      }
    }
    if (bestPid == null) { el.style.display = "none"; return; }
    const remain = Math.max(0, VICTORY_DOMINATION_TIME - bestTime);
    const mm = Math.floor(remain / 60);
    const ss = Math.floor(remain % 60);
    const name = PLAYER_NAMES[bestPid] || ("Игрок " + bestPid);
    const color = (state.players.get(bestPid) || {}).color;
    const hex = color != null ? "#" + color.toString(16).padStart(6, "0") : "#ffe066";
    el.style.display = "block";
    el.innerHTML = "<span style='color:" + hex + "'>" + name + "</span> доминирует (" + (bestPct * 100).toFixed(0) + "%) — <b>" + mm + ":" + String(ss).padStart(2, "0") + "</b>";
  }

  function triggerVictory(reason) {
    state._gameOver = true;
    const overlay = document.getElementById("victoryOverlay");
    const text = document.getElementById("victoryText");
    if (overlay) overlay.style.display = "flex";
    if (text) text.textContent = reason;
    document.getElementById("dominationTimer").style.display = "none";
  }

  function triggerDefeat(reason) {
    state._gameOver = true;
    const overlay = document.getElementById("victoryOverlay");
    const text = document.getElementById("victoryText");
    const title = overlay?.querySelector(".victory-title");
    if (title) { title.textContent = "ПОРАЖЕНИЕ"; title.style.color = "#ff4444"; }
    if (overlay) overlay.style.display = "flex";
    if (text) text.textContent = reason;
    document.getElementById("dominationTimer").style.display = "none";
  }

  document.getElementById("victoryRestart")?.addEventListener("click", () => {
    state._gameOver = false;
    state._domTimers = {};
    document.getElementById("victoryOverlay").style.display = "none";
    const title = document.querySelector(".victory-title");
    if (title) { title.textContent = "ПОБЕДА!"; title.style.color = "#ffd700"; }
    resetWorld();
    for (const p of state.players.values()) { redrawZone(p); rebuildTurrets(p); }
  });

  // ------------------------------------------------------------
  // Menu & Lobby (start game only after choice)
  // ------------------------------------------------------------
  state.myPlayerId = 1;
  state.botPlayerIds = null;
  const gameWrapEl = document.getElementById("gameWrap");
  const mainMenuEl = document.getElementById("mainMenu");
  const nicknameScreenEl = document.getElementById("nicknameScreen");
  const nicknameInputEl = document.getElementById("nicknameInput");
  const multiConnectScreenEl = document.getElementById("multiConnectScreen");
  const lobbyScreenEl = document.getElementById("lobbyScreen");
  const roomCodeInputEl = document.getElementById("roomCodeInput");

  function showScreen(visibleId) {
    const ids = ["mainMenu", "nicknameScreen", "multiConnectScreen", "lobbyScreen"];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.style.display = id === visibleId ? "flex" : "none";
    }
    if (gameWrapEl) gameWrapEl.style.display = visibleId === "gameWrap" ? "block" : "none";
    if (visibleId === "multiConnectScreen" && typeof refreshLobbyList === "function") refreshLobbyList();
  }
  (function bindMainMenuButtonsEarly() {
    const btnSingle = document.getElementById("btnSingle");
    const btnMulti = document.getElementById("btnMulti");
    if (btnMulti) btnMulti.addEventListener("click", () => { state._menuMode = "multi"; showScreen("nicknameScreen"); });
    if (btnSingle) btnSingle.addEventListener("click", () => { state._menuMode = "single"; showScreen("nicknameScreen"); });
  })();

  function refreshLobbyList() {
    if (!socket) return;
    socket.emit("listRooms", (list) => {
      state._lobbyList = list || [];
      console.log("[Лобби] Список комнат:", (list || []).length, list);
      renderLobbyList();
    });
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
        const nick = (state._myNickname || (typeof window !== "undefined" && window._myNickname) || "Игрок").trim().slice(0, 24) || "Игрок";
        socket.emit("join", r.roomId, nick, (data) => {
          if (data.error) { alert(data.error); return; }
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

  function startGameSingle(nickname) {
    state._gameSeed = null;
    state._multiIsHost = false;
    state._multiSlots = null;
    state._slotToPid = null;
    PLAYER_NAMES[1] = (nickname || "Игрок").trim().slice(0, 24) || "Игрок";
    state.myPlayerId = 1;
    state.botPlayerIds = null;
    showScreen("gameWrap");
    rebuildMap();
    rebuildGrid();
    resetWorld();
    for (const p of state.players.values()) {
      redrawZone(p);
      rebuildTurrets(p);
    }
    const me = state.players.get(state.myPlayerId);
    if (me) {
      centerOn(me.x, me.y);
      const cx = CFG.WORLD_W / 2, cy = CFG.WORLD_H / 2;
      const dx = cx - me.x, dy = cy - me.y;
      const len = Math.hypot(dx, dy) || 1;
      state.rallyPoint = { x: me.x + (dx / len) * 180, y: me.y + (dy / len) * 180 };
    }
    document.getElementById("net").textContent = "локально • боты";
    const gameChatWrap = document.getElementById("gameChatWrap");
    if (gameChatWrap) gameChatWrap.style.display = "none";
    if (typeof updateMultiHostOnlyControls === "function") updateMultiHostOnlyControls();
  }

  function startGameMulti(slots, mySlot) {
    state.botPlayerIds = new Set();
    const filledSlots = [];
    for (let i = 0; i < 5; i++) {
      const s = slots[i] || {};
      if (s.id || s.isBot) filledSlots.push(i);
    }
    const slotToPid = {};
    for (const i of filledSlots) slotToPid[i] = i + 1;
    state.myPlayerId = slotToPid[mySlot] || (mySlot + 1);
    console.log("[MP-INIT] mySlot=", mySlot, "myPlayerId=", state.myPlayerId, "isHost=", state._isHost, "filledSlots=", filledSlots, "slotToPid=", JSON.stringify(slotToPid));
    console.log("[MP-INIT] slots=", JSON.stringify(slots));
    for (const i of filledSlots) {
      const pid = slotToPid[i];
      const s = slots[i] || {};
      PLAYER_NAMES[pid] = (s.name || "Игрок").trim().slice(0, 24) || "Игрок";
      PLAYER_COLORS[pid] = LOBBY_COLORS[Math.min(s.colorIndex ?? 0, 35)];
      if (s.isBot) state.botPlayerIds.add(pid);
      console.log("[MP-INIT] slot", i, "-> pid", pid, "name=", PLAYER_NAMES[pid], "colorIndex=", s.colorIndex, "color=", PLAYER_COLORS[pid].toString(16));
    }
    showScreen("gameWrap");
    rebuildMap(state._gameSeed);
    rebuildGrid();
    resetWorldMulti(slots, slotToPid);
    for (const p of state.players.values()) {
      redrawZone(p);
      rebuildTurrets(p);
    }
    const me = state.players.get(state.myPlayerId);
    if (me) {
      centerOn(me.x, me.y);
      const cx = CFG.WORLD_W / 2, cy = CFG.WORLD_H / 2;
      const dx = cx - me.x, dy = cy - me.y;
      const len = Math.hypot(dx, dy) || 1;
      state.rallyPoint = { x: me.x + (dx / len) * 180, y: me.y + (dy / len) * 180 };
    }
    document.getElementById("net").textContent = "мультиплеер";
    state._multiIsHost = state._isHost;
    state._multiSlots = slots;
    state._slotToPid = slotToPid;
    state._gameChatUnread = 0;
    const gameChatWrap = document.getElementById("gameChatWrap");
    if (gameChatWrap) gameChatWrap.style.display = "flex";
    const gameChatBody = document.getElementById("gameChatBody");
    const gameChatBar = document.getElementById("gameChatBar");
    const gameChatUnreadBadge = document.getElementById("gameChatUnreadBadge");
    const gameChatToggle = document.getElementById("gameChatToggle");
    if (gameChatToggle && gameChatWrap) {
      gameChatToggle.addEventListener("click", () => {
        const collapsed = gameChatWrap.classList.toggle("game-chat-collapsed");
        gameChatToggle.textContent = collapsed ? "+" : "−";
        if (!collapsed) {
          state._gameChatUnread = 0;
          if (gameChatUnreadBadge) gameChatUnreadBadge.textContent = "0";
        }
      });
    }
    if (gameChatBar && gameChatWrap) {
      gameChatBar.addEventListener("click", () => {
        gameChatWrap.classList.remove("game-chat-collapsed");
        if (gameChatToggle) gameChatToggle.textContent = "−";
        state._gameChatUnread = 0;
        if (gameChatUnreadBadge) gameChatUnreadBadge.textContent = "0";
      });
    }
    const gameChatSend = document.getElementById("gameChatSend");
    const gameChatInput = document.getElementById("gameChatInput");
    if (gameChatSend && gameChatInput && state._socket) {
      gameChatSend.onclick = () => {
        const text = String(gameChatInput.value || "").trim();
        if (text) { state._socket.emit("chat", text); gameChatInput.value = ""; }
      };
      gameChatInput.onkeydown = (e) => { if (e.key === "Enter") { gameChatSend.click(); } };
    }
    const gameChatEmojiRow = document.getElementById("gameChatEmojiRow");
    const GAME_CHAT_EMOJI = ["😀","😂","👍","❤️","😢","😡","🎉","🔥","💀","⚔️","🏆","👋","😎","🤔","👀","💪","🙏","⭐","✅","❌"];
    if (gameChatEmojiRow && gameChatInput) {
      gameChatEmojiRow.innerHTML = "";
      for (const em of GAME_CHAT_EMOJI) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "game-chat-emoji-btn";
        btn.textContent = em;
        btn.title = em;
        btn.addEventListener("click", () => {
          const start = gameChatInput.selectionStart ?? gameChatInput.value.length;
          const end = gameChatInput.selectionEnd ?? start;
          const v = gameChatInput.value;
          const newV = v.slice(0, start) + em + v.slice(end);
          if (newV.length <= (gameChatInput.maxLength || 200)) {
            gameChatInput.value = newV;
            gameChatInput.focus();
            const pos = start + em.length;
            gameChatInput.setSelectionRange(pos, pos);
          }
        });
        gameChatEmojiRow.appendChild(btn);
      }
    }
    updateMultiHostOnlyControls();
    console.log("[MP-INIT] done. players in state:", [...state.players.keys()]);
  }

  function updateMultiHostOnlyControls() {
    const isMulti = !!(state._multiSlots && state._roomId);
    const onlyHost = isMulti && !state._multiIsHost;
    document.querySelectorAll(".speed-btn").forEach((b) => {
      b.disabled = onlyHost;
      b.style.opacity = onlyHost ? "0.5" : "1";
      b.style.pointerEvents = onlyHost ? "none" : "";
    });
    if (regenBtn) {
      regenBtn.disabled = onlyHost;
      regenBtn.style.opacity = onlyHost ? "0.5" : "1";
      regenBtn.style.pointerEvents = onlyHost ? "none" : "";
      regenBtn.title = onlyHost ? "Только хост может перегенерировать карту" : "";
    }
  }

  // ─── Networking: use NET module (net.js) ───
  const PLAYER_LIGHT_SYNC_KEYS = NET.PLAYER_LIGHT_KEYS;
  const PLAYER_FULL_SYNC_KEYS  = NET.PLAYER_FULL_KEYS;
  const UNIT_SYNC_KEYS         = NET.UNIT_LIGHT_KEYS;
  const UNIT_FULL_SYNC_KEYS    = NET.UNIT_FULL_KEYS;

  const _netSerializer = new NET.SnapshotSerializer();
  const _netSendScheduler = new NET.SendScheduler();
  const _netPing = new NET.PingTracker();

  function serializeGameState() {
    return _netSerializer.serialize(state);
  }

  function applyGameState(snap) {
    if (!snap || state._multiIsHost) return;
    try { _applyGameStateInner(snap); } catch(e) { console.error("[MP-SYNC] ERROR in applyGameState:", e); }
  }
  function _applyGameStateInner(snap) {
    if (state._frameCtr % 300 === 0) {
      console.log("[MP-SYNC] snap seq=", snap._seq ?? "?",
        "players=", (snap.players||[]).length,
        "units=", (snap.units||[]).length,
        snap._fullSync ? "FULL" : "delta");
    }

    state.t = snap.t;
    state._lastSnapT = snap.t;
    state._lastSnapRealTime = Date.now();
    if (snap.timeScale != null) state.timeScale = snap.timeScale;
    if (snap.nextUnitId != null) state.nextUnitId = snap.nextUnitId;
    if (snap.nextResId != null) state.nextResId = snap.nextResId;

    const isRemote = !!(state._multiSlots && !state._multiIsHost);
    const isFull = !!snap._fullSync;

    // ── Players ──
    const wantPlayerIds = new Set((snap.players || []).map((p) => p.id));
    const oldPlayerColors = new Map();
    for (const [id, pl] of state.players) oldPlayerColors.set(id, pl.color);

    for (const p of snap.players || []) {
      let pl = state.players.get(p.id);
      if (!pl) {
        pl = makePlayer(p.id, p.name, p.x, p.y, p.pop ?? CFG.POP_START);
        if (p.color != null) pl.color = p.color;
        state.players.set(pl.id, pl);
        makeCityVisual(pl);
        makeZoneVisual(pl);
      }
      const pKeys = isFull ? PLAYER_FULL_SYNC_KEYS : PLAYER_LIGHT_SYNC_KEYS;
      for (const k of pKeys) {
        if (k === "influenceRayDistances" && isRemote && p.influenceRayDistances) {
          NET.Interp.setZoneTarget(pl, p.influenceRayDistances);
          continue;
        }
        if (p[k] !== undefined) pl[k] = p[k];
      }
      if (isFull) {
        if (p.influencePolygon) pl.influencePolygon = p.influencePolygon;
        if (p.color != null) PLAYER_COLORS[p.id] = p.color;
      }
    }

    for (const p of snap.players || []) {
      const pl = state.players.get(p.id);
      if (!pl || p.color == null) continue;
      if (oldPlayerColors.get(pl.id) === p.color) continue;
      if (pl.cityGfx) { cityLayer.removeChild(pl.cityGfx); pl.cityGfx = null; }
      if (pl.zoneGfx) { zonesLayer.removeChild(pl.zoneGfx); pl.zoneGfx = null; }
      if (pl.zoneGlow) { zonesLayer.removeChild(pl.zoneGlow); pl.zoneGlow = null; }
      makeCityVisual(pl);
      makeZoneVisual(pl);
    }

    for (const id of [...state.players.keys()]) {
      if (!wantPlayerIds.has(id)) {
        const pl = state.players.get(id);
        if (pl && pl.cityGfx) { cityLayer.removeChild(pl.cityGfx); pl.cityGfx = null; }
        if (pl && pl.zoneGfx) { zonesLayer.removeChild(pl.zoneGfx); zonesLayer.removeChild(pl.zoneGlow); pl.zoneGfx = null; pl.zoneGlow = null; }
        state.players.delete(id);
      }
    }

    const numRays = CFG.TERRAIN_RAYS ?? 96;
    for (const pl of state.players.values()) {
      if (pl.influenceRayDistances && pl.influenceRayDistances.length === numRays) {
        if (!pl._polyBuf || pl._polyBuf.length !== numRays) {
          pl._polyBuf = [];
          for (let i = 0; i < numRays; i++) pl._polyBuf.push({ x: 0, y: 0 });
        }
        for (let i = 0; i < numRays; i++) {
          const angle = (i / numRays) * Math.PI * 2;
          const d = pl.influenceRayDistances[i] ?? 0;
          pl._polyBuf[i].x = pl.x + Math.cos(angle) * d;
          pl._polyBuf[i].y = pl.y + Math.sin(angle) * d;
        }
        pl.influencePolygon = pl._polyBuf;
      } else if (!pl.influencePolygon || pl.influencePolygon.length < 3) {
        const popFloat = pl.popFloat != null ? pl.popFloat : pl.pop;
        const poly = computeInfluencePolygon(pl.x, pl.y, popFloat);
        if (poly && poly.length >= 3) {
          pl.influencePolygon = poly;
          pl.influenceRayDistances = poly.map((pt) => Math.hypot(pt.x - pl.x, pt.y - pl.y));
        }
      }
    }

    // ── Units ──
    const wantUnitIds = new Set();
    for (const raw of snap.units || []) {
      const isCompact = Array.isArray(raw);
      const uid = isCompact ? raw[0] : raw.id;

      if (isCompact && raw.length === 2 && raw[1] === NET.DESTROYED_SENTINEL) {
        const dead = state.units.get(uid);
        if (dead) {
          if (dead.gfx) unitsLayer.removeChild(dead.gfx);
          state.units.delete(uid);
        }
        continue;
      }

      wantUnitIds.add(uid);
      let un = state.units.get(uid);

      if (isCompact) {
        const sx = raw[1], sy = raw[2], svx = raw[3], svy = raw[4], shp = raw[5];
        if (!un) continue;
        if (isRemote) {
          NET.Interp.setTarget(un, sx, sy, svx, svy, shp);
        } else {
          un.x = sx; un.y = sy; un.vx = svx; un.vy = svy; un.hp = shp;
        }
      } else {
        if (!un) {
          un = { ...raw, gfx: null };
          state.units.set(un.id, un);
          if (isRemote) {
            NET.Interp.setTarget(un, raw.x, raw.y, raw.vx || 0, raw.vy || 0, raw.hp);
          }
        } else if (isRemote) {
          NET.Interp.setTarget(un, raw.x, raw.y, raw.vx || 0, raw.vy || 0, raw.hp);
          for (const k of UNIT_FULL_SYNC_KEYS) {
            if (k === "x" || k === "y") continue;
            if (raw[k] !== undefined) un[k] = raw[k];
          }
        } else {
          for (const k of UNIT_FULL_SYNC_KEYS) if (raw[k] !== undefined) un[k] = raw[k];
        }
        if (!un.gfx) makeUnitVisual(un);
      }
    }

    if (isFull) {
      for (const id of [...state.units.keys()]) {
        if (!wantUnitIds.has(id)) {
          const u = state.units.get(id);
          if (u && u.gfx) unitsLayer.removeChild(u.gfx);
          state.units.delete(id);
        }
      }
    }

    if (snap.bullets) state.bullets = snap.bullets;

    // ── Resources: full sync = spawn/despawn; zone sync = position update ──
    if (snap.resDelta && !snap.resources) {
      for (const [id, x, y] of snap.resDelta) {
        const res = state.res.get(id);
        if (res) NET.Interp.setResTarget(res, x, y);
      }
    }
    if (snap.resources) {
      const wantResIds = new Set(snap.resources.map(r => r.id));
      for (const r of snap.resources) {
        let res = state.res.get(r.id);
        if (!res) {
          res = { ...r, gfx: null };
          state.res.set(res.id, res);
          makeResVisual(res);
        } else {
          NET.Interp.setResTarget(res, r.x, r.y);
          res.xp = r.xp; res.type = r.type; res.color = r.color;
        }
      }
      for (const id of [...state.res.keys()]) {
        if (!wantResIds.has(id)) deleteResource(id);
      }
    }

    // ── Turrets (full sync only) ──
    if (snap.turrets) {
      const wantTurretIds = new Set(snap.turrets.map(t => t.id));
      for (const t of snap.turrets) {
        let tu = state.turrets.get(t.id);
        if (!tu) {
          tu = { ...t, gfx: null, labelGfx: null, radiusGfx: null, atkCd: 0 };
          state.turrets.set(tu.id, tu);
        } else {
          tu.hp = t.hp; tu.maxHp = t.maxHp; tu.x = t.x; tu.y = t.y;
          if (t._diedAt != null) tu._diedAt = t._diedAt; else delete tu._diedAt;
        }
      }
      for (const id of [...state.turrets.keys()]) {
        if (!wantTurretIds.has(id)) {
          const tu = state.turrets.get(id);
          if (tu && tu.gfx) turretLayer.removeChild(tu.gfx);
          if (tu && tu.labelGfx) turretLayer.removeChild(tu.labelGfx);
          if (tu && tu.radiusGfx) turretLayer.removeChild(tu.radiusGfx);
          state.turrets.delete(id);
        }
      }
    }

    // ── Storm ──
    if (snap.storm !== undefined) {
      if (snap.storm === null) {
        if (state.storm) {
          if (state.storm.gfx) { state.storm.gfx.parent?.removeChild(state.storm.gfx); state.storm.gfx.destroy(true); }
          if (state.storm.emojiContainer) { state.storm.emojiContainer.parent?.removeChild(state.storm.emojiContainer); state.storm.emojiContainer.destroy({ children: true }); }
          state.storm = null;
        }
      } else {
        if (!state.storm) {
          state.storm = { ...snap.storm, gfx: null, emojiContainer: null, particles: [] };
          NET.Interp.setStormTarget(state.storm, snap.storm.x, snap.storm.y, snap.storm.vx, snap.storm.vy);
        } else {
          NET.Interp.setStormTarget(state.storm, snap.storm.x, snap.storm.y, snap.storm.vx, snap.storm.vy);
          if (isFull) {
            state.storm.spawnedAt = snap.storm.spawnedAt;
            state.storm.lastDirChange = snap.storm.lastDirChange;
            state.storm.lastDmgTick = snap.storm.lastDmgTick;
            state.storm.rotAngle = snap.storm.rotAngle;
            state.storm.stretch = snap.storm.stretch;
            state.storm.blobs = snap.storm.blobs;
          }
        }
      }
    }

    if (snap.timeScale != null) {
      document.querySelectorAll(".speed-btn").forEach((b) => {
        const s = parseInt(b.dataset.speed, 10) || 1;
        b.classList.toggle("active", s === state.timeScale);
      });
    }
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
      if (state._menuMode === "single") { startGameSingle(nick); return; }
      showScreen("multiConnectScreen");
    });
    if (multiConnectBack) multiConnectBack.addEventListener("click", () => showScreen("nicknameScreen"));
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupMenuButtons);
  } else {
    setupMenuButtons();
  }

  state._socket = socket;
  console.log("[Лобби] Подключение к серверу:", socketUrlEarly, socket ? "OK" : "io не найден");

  if (socket) {
    socket.on("connect", () => console.log("[Лобби] Socket подключён, id:", socket.id));
    socket.on("connect_error", (err) => console.error("[Лобби] Ошибка подключения:", err.message || err));
    socket.on("disconnect", (reason) => console.log("[Лобби] Socket отключён, причина:", reason));
    socket.on("serverUrl", (url) => { console.log("[Лобби] Адрес сервера для сети:", url); });
  }

  const nickForSocket = () => (state._myNickname || window._myNickname || "Игрок").trim().slice(0, 24) || "Игрок";
  window.__createRoom = function() {
    if (!socket) { alert("Сервер не подключён. Запустите server.js."); return; }
    state._myNickname = state._myNickname || window._myNickname || nicknameInputEl?.value?.trim() || "Игрок";
    socket.emit("create", nickForSocket(), (data) => {
      if (data.error) { alert(data.error); return; }
      state._lobbySlots = data.slots; state._mySlot = data.mySlot;
      state._isHost = data.isHost; state._roomId = data.roomId;
      renderLobby(); showScreen("lobbyScreen");
    });
  };
  window.__joinRoom = function() {
    if (!socket) { alert("Сервер не подключён."); return; }
    const code = (roomCodeInputEl && roomCodeInputEl.value || "").trim();
    if (!code) { alert("Введите код комнаты."); return; }
    state._myNickname = state._myNickname || window._myNickname || nicknameInputEl?.value?.trim() || "Игрок";
    socket.emit("join", code, nickForSocket(), (data) => {
      if (data.error) { alert(data.error); return; }
      state._lobbySlots = data.slots; state._mySlot = data.mySlot;
      state._isHost = data.isHost; state._roomId = data.roomId;
      renderLobby(); showScreen("lobbyScreen");
    });
  };
  window.__refreshLobbyList = refreshLobbyList;

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
    slotsEl.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      const s = slots[i] || {};
      const div = document.createElement("div");
      div.className = "lobby-slot" + (!s.id && !s.isBot ? " empty" : "");
      const colorHex = "#" + (LOBBY_COLORS[s.colorIndex || 0] || 0x888888).toString(16).padStart(6, "0");
      div.innerHTML = "<span class=\"slot-color\" style=\"background:" + colorHex + "\"></span><span class=\"slot-name\">" + (s.name || "Пусто") + "</span>" + (s.isBot ? "<span class=\"slot-badge\">Бот</span>" : "");
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
    const pickerEl = document.getElementById("colorPicker");
    if (pickerEl) {
      pickerEl.innerHTML = "";
      const mySlot = slots[state._mySlot];
      const curColor = (mySlot && mySlot.colorIndex != null) ? mySlot.colorIndex : 0;
      for (let i = 0; i < 36; i++) {
        const sw = document.createElement("div");
        sw.className = "color-swatch" + (i === curColor ? " selected" : "");
        sw.style.background = "#" + (LOBBY_COLORS[i] || 0).toString(16).padStart(6, "0");
        sw.addEventListener("click", () => {
          socket.emit("setColor", i);
          document.querySelectorAll("#colorPicker .color-swatch").forEach((el, j) => el.classList.toggle("selected", j === i));
        });
        pickerEl.appendChild(sw);
      }
    }
  }

  if (socket) {
    socket.on("serverUrl", (url) => {
      state._serverUrl = url;
      if (lobbyScreenEl && lobbyScreenEl.style.display === "flex") renderLobby();
      const urlEl = document.getElementById("lobbyServerUrl");
      if (urlEl) { urlEl.textContent = url; urlEl.title = url; }
    });
    socket.on("slots", (slots) => {
      state._lobbySlots = slots;
      if (lobbyScreenEl && lobbyScreenEl.style.display === "flex") renderLobby();
    });
    socket.on("chat", (msg) => {
      const list = document.getElementById("chatMessages");
      if (list) {
        const div = document.createElement("div");
        div.className = "msg";
        div.innerHTML = "<span class=\"sender\">" + (msg.name || "?") + ":</span> " + (msg.text || "").replace(/</g, "&lt;");
        list.appendChild(div);
        list.scrollTop = list.scrollHeight;
      }
      const gameList = document.getElementById("gameChatMessages");
      if (gameList && state._multiSlots) {
        const d = document.createElement("div");
        d.className = "msg";
        d.innerHTML = "<span class=\"sender\">" + (msg.name || "?") + ":</span> " + (msg.text || "").replace(/</g, "&lt;");
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
    socket.on("net:pong", (seq) => _netPing.onPong(seq));

    socket.on("gameStart", (data) => {
      console.log("[MP] gameStart received. _mySlot=", state._mySlot, "_isHost=", state._isHost, "seed=", data.seed);
      state._gameSeed = typeof data.seed === "number" ? data.seed : null;
      _netPing.start(socket);
      _netSerializer.reset();
      _netSendScheduler.start();
      startGameMulti(data.slots, state._mySlot);
    });
    socket.on("gameState", (data) => {
      if (!state._firstSnapLogged && data && data.units && data.units.length > 0) {
        state._firstSnapLogged = true;
        console.log("[MP-SYNC] FIRST snap with units:", JSON.stringify(data.units.slice(0, 3)));
        console.log("[MP-SYNC] FIRST snap players:", JSON.stringify(data.players.map(p => ({ id: p.id, name: p.name, color: p.color?.toString(16) }))));
      }
      if (data && data._fullSync) {
        state._pendingFullSnap = data;
      } else {
        state._pendingSnap = data;
      }
    });
    socket.on("playerAction", (action) => {
      if (!state._multiIsHost) return;
      console.log("[MP-ACTION] host received action:", action.type, "pid=", action.pid, "from remote");
      if (action.type === "spawn") {
        const res = spawnUnits(action.pid, action.count, action.waypoints, { formationType: action.formationType, formationRows: action.formationRows });
        console.log("[MP-ACTION] spawn result:", JSON.stringify(res));
      } else if (action.type === "chase") {
        for (const lid of (action.leaderIds || [])) {
          const u = state.units.get(lid);
          if (!u) continue;
          u.chaseTargetUnitId = action.targetUnitId;
          u.chaseTargetCityId = undefined;
          u.waypoints = [{ x: action.x, y: action.y }];
          u.waypointIndex = 0;
          u.straightMode = false;
        }
      } else if (action.type === "chaseCity") {
        for (const lid of (action.leaderIds || [])) {
          const u = state.units.get(lid);
          if (!u) continue;
          u.chaseTargetCityId = action.targetCityId;
          u.chaseTargetUnitId = undefined;
          u.waypoints = [{ x: action.x, y: action.y }];
          u.waypointIndex = 0;
          u.straightMode = false;
        }
      } else if (action.type === "move") {
        const wp = Array.isArray(action.waypoints) && action.waypoints.length > 0
          ? action.waypoints.map(w => ({ x: w.x, y: w.y }))
          : [{ x: action.x, y: action.y }];
        for (const lid of (action.leaderIds || [])) {
          const u = state.units.get(lid);
          if (!u) continue;
          u.targetFormationAngle = action.angle;
          u.chaseTargetUnitId = undefined;
          u.chaseTargetCityId = undefined;
          for (const v of state.units.values()) {
            if ((v.leaderId || v.id) === lid) {
              v.waypoints = wp.map(w => ({ x: w.x, y: w.y }));
              v.waypointIndex = 0;
              v.straightMode = false;
            }
          }
        }
      } else if (action.type === "mergeSquad") {
        const units = (action.unitIds || []).map(id => state.units.get(id)).filter(Boolean);
        if (units.length >= 2) {
          const leader = units[0];
          const formationType = action.formationType || "pig";
          const formationRows = action.formationRows || 1;
          const pigW = action.formationPigWidth || 1;
          const waypoints = Array.isArray(action.waypoints) && action.waypoints.length > 0
            ? action.waypoints.map(w => ({ x: w.x, y: w.y }))
            : [{ x: leader.x + 280, y: leader.y }];
          const dx = waypoints[0].x - leader.x, dy = waypoints[0].y - leader.y;
          const dl = Math.hypot(dx, dy) || 1;
          const vx = dx / dl, vy = dy / dl;
          const offsets = getFormationOffsets(units.length, formationType, formationRows, vx, vy, pigW);
          const leaderId = leader.id;
          leader.leaderId = null;
          leader.formationType = formationType;
          leader.formationRows = formationRows;
          if (formationType === "pig") leader.formationPigWidth = pigW;
          leader.waypoints = waypoints;
          leader.waypointIndex = 0;
          leader.straightMode = false;
          for (let i = 0; i < units.length; i++) {
            const u = units[i];
            u.leaderId = i === 0 ? null : leaderId;
            u.formationOffsetX = i === 0 ? 0 : (offsets[i]?.x ?? 0);
            u.formationOffsetY = i === 0 ? 0 : (offsets[i]?.y ?? 0);
            u.waypoints = waypoints.map(w => ({ x: w.x, y: w.y }));
            u.waypointIndex = 0;
            u.straightMode = false;
          }
        }
      } else if (action.type === "splitSquad") {
        const allUnits = (action.unitIds || []).map(id => state.units.get(id)).filter(Boolean);
        if (allUnits.length >= 2) {
          const n = allUnits.length;
          const k = Math.floor(n / 2);
          const first = allUnits.slice(0, k);
          const second = allUnits.slice(k);
          const centerIdx = arr => Math.min(Math.floor((arr.length - 1) / 2), arr.length - 1);
          const leader1 = state.units.get(action.leader1Id) || first[centerIdx(first)];
          const leader2 = state.units.get(action.leader2Id) || second[centerIdx(second)];
          if (leader1 && leader2) {
            for (const u of first) { u.leaderId = leader1.id; u.formationOffsetX = 0; u.formationOffsetY = 0; }
            leader1.leaderId = null;
            for (const u of second) { u.leaderId = leader2.id; u.formationOffsetX = 0; u.formationOffsetY = 0; }
            leader2.leaderId = null;
            applyFormationToSquad(first, leader1.formationType || "pig", leader1.formationRows ?? 1, null, null, leader1.formationPigWidth);
            applyFormationToSquad(second, leader2.formationType || "pig", leader2.formationRows ?? 1, null, null, leader2.formationPigWidth);
          }
        }
      } else if (action.type === "cardChoice") {
        const pl = action.pid != null ? state.players.get(action.pid) : null;
        if (pl && action.card && typeof (pl.pendingCardPicks) === "number" && pl.pendingCardPicks > 0) {
          applyCard(pl, action.card);
          pl.pendingCardPicks--;
        }
      }
    });
    socket.on("mapRegenerate", (data) => {
      if (state._multiIsHost || !state._multiSlots || !state._slotToPid) return;
      const seed = typeof data.seed === "number" ? data.seed : (Date.now() >>> 0);
      state._gameSeed = seed;
      rebuildMap(seed);
      rebuildGrid();
      resetWorldMulti(state._multiSlots, state._slotToPid);
      for (const p of state.players.values()) {
        redrawZone(p);
        rebuildTurrets(p);
      }
      const me = state.players.get(state.myPlayerId);
      if (me) centerOn(me.x, me.y);
    });
  }

  document.getElementById("lobbyCopyUrl").addEventListener("click", () => {
    const url = state._serverUrl || window.location.origin;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById("lobbyCopyUrl");
        if (btn) { const t = btn.textContent; btn.textContent = "Скопировано!"; setTimeout(() => { btn.textContent = t; }, 1500); }
      });
    } else {
      prompt("Скопируйте адрес:", url);
    }
  });
  document.getElementById("lobbyLeave").addEventListener("click", () => {
    if (socket && state._roomId) socket.emit("leave");
    state._roomId = null;
    state._mySlot = null;
    state._isHost = false;
    showScreen("multiConnectScreen");
  });
  document.getElementById("lobbyStart").addEventListener("click", () => {
    if (socket && state._isHost) socket.emit("start", { seed: (Date.now() >>> 0) + Math.floor(Math.random() * 0xffff) });
  });
  const chatInputEl = document.getElementById("chatInput");
  document.getElementById("chatSend").addEventListener("click", () => {
    const t = chatInputEl && chatInputEl.value.trim();
    if (t && socket) { socket.emit("chat", t); chatInputEl.value = ""; }
  });
  if (chatInputEl) chatInputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("chatSend").click(); });

  showScreen("mainMenu");
  gameWrapEl.style.display = "none";

  // ------------------------------------------------------------
  // Main loop
  // ------------------------------------------------------------
  let lastT = performance.now();
  let fpsAcc = 0, fpsN = 0;

  app.ticker.add(() => {
    if (typeof window !== "undefined" && window._pendingSingleStart) {
      const nick = window._pendingSingleStart;
      window._pendingSingleStart = null;
      const msg = document.getElementById("menuLoadingMsg");
      if (msg && msg.parentNode) msg.parentNode.removeChild(msg);
      startGameSingle(nick);
      return;
    }
    if (!state.players || state.players.size === 0) return;
    const frameStart = performance.now();
    const now = frameStart;
    let dt = Math.min(0.05, (now - lastT) / 1000);
    dt *= CFG.GAME_SPEED;
    const timeScale = state.timeScale || 1;
    dt *= timeScale;
    lastT = now;
    if (state._gameOver) {
      return;
    }
    state.t += dt;

    // sim
    state._frameCtr = (state._frameCtr || 0) + 1;
    state._vp = getViewport();
    rebuildSpatialHash();

    const isRemoteClient = !!(state._multiSlots && !state._multiIsHost);

    if (!isRemoteClient) {
      perfStartStep("stepCities");
      stepCities(dt);
      perfEndStep("stepCities");
      if (state._frameCtr % 4 === 0) rebuildZoneGrid();

      perfStartStep("botThink");
      if (state._frameCtr % 2 === 0) botThink(dt);
      perfEndStep("botThink");
      perfStartStep("stepUnits");
      stepUnits(dt);
      perfEndStep("stepUnits");
      perfStartStep("stepCombat");
      stepCombat(dt);
      perfEndStep("stepCombat");
      perfStartStep("mergeBattle");
      mergeBattleSurvivorsIntoOneSquad();
      perfEndStep("mergeBattle");
      perfStartStep("stepTurrets");
      stepTurrets(dt);
      perfEndStep("stepTurrets");
      perfStartStep("stepBullets");
      stepBullets(dt);
      perfEndStep("stepBullets");
      perfStartStep("stepResourceSpawn");
      stepResourceSpawn(dt);
      perfEndStep("stepResourceSpawn");
      perfStartStep("stepResourceMagnet");
      stepResourceMagnet(dt);
      perfEndStep("stepResourceMagnet");
      perfStartStep("stepPickups");
      stepPickups(dt);
      perfEndStep("stepPickups");
      stepStorm(dt);
    } else {
      // ── Remote client: apply pending snapshots, then interpolate ──
      if (state._pendingFullSnap) {
        applyGameState(state._pendingFullSnap);
        state._pendingFullSnap = null;
        state._pendingSnap = null;
      } else if (state._pendingSnap) {
        applyGameState(state._pendingSnap);
        state._pendingSnap = null;
      }
      if (state._frameCtr % 4 === 0) rebuildZoneGrid();

      const interpMs = _netPing.getInterpDurationMs();

      for (const u of state.units.values()) {
        NET.Interp.tickUnit(u, interpMs);
      }
      updateUnitVisualsOnly();

      // Simulate bullets visually — smooth movement between zone syncs (266 ms)
      stepBulletsVisual(dt);

      NET.Interp.tickStorm(state.storm, interpMs);

      const numRays = CFG.TERRAIN_RAYS ?? 96;
      for (const pl of state.players.values()) {
        // Use full zone sync interval (266 ms) for proper linear interpolation
        NET.Interp.tickZoneRays(pl, numRays, NET.ZONE_SYNC_INTERVAL_MS);
        if (pl.influenceRayDistances && pl.influenceRayDistances.length === numRays) {
          if (!pl._polyBuf || pl._polyBuf.length !== numRays) {
            pl._polyBuf = [];
            for (let i = 0; i < numRays; i++) pl._polyBuf.push({ x: 0, y: 0 });
          }
          for (let i = 0; i < numRays; i++) {
            const angle = (i / numRays) * Math.PI * 2;
            const d = pl.influenceRayDistances[i] ?? 0;
            pl._polyBuf[i].x = pl.x + Math.cos(angle) * d;
            pl._polyBuf[i].y = pl.y + Math.sin(angle) * d;
          }
          pl.influencePolygon = pl._polyBuf;
          if (pl._lastZoneHash !== undefined) pl._lastZoneHash = null;
        }
      }

      for (const r of state.res.values()) {
        NET.Interp.tickRes(r, NET.ZONE_SYNC_INTERVAL_MS);
        if (r.gfx) {
          r.gfx.visible = inView(r.x, r.y);
          if (r.gfx.visible) r.gfx.position.set(r.x, r.y);
        }
      }
    }

    // ── Host: send snapshots at fixed 30 Hz (decoupled from render rate) ──
    if (state._multiIsHost && state._socket && state._roomId) {
      const dtMs = (now - (state._lastSendCheck || now));
      state._lastSendCheck = now;
      if (_netSendScheduler.update(dtMs)) {
        const gs = serializeGameState();
        state._socket.emit("gameState", gs);
      }
    }

    // visuals: zones & overlaps (redraw only when shape changed; throttle overlaps)
    perfStartStep("zones");
    if (state.zonesEnabled) {
      const isRemote = state._multiSlots && !state._multiIsHost;
      const zoneRedrawThisFrame = !isRemote || (state._frameCtr % 2 === 0);
      for (const p of state.players.values()) {
        const oldHash = p._lastZoneHash;
        if (zoneRedrawThisFrame) redrawZone(p);
        if (p._lastZoneHash !== oldHash || (state._frameCtr % 8 === 0)) rebuildTurrets(p);
      }
      state._zoneFrameCounter = (state._zoneFrameCounter || 0) + 1;
      if (state._zoneFrameCounter % 2 === 0) updateZoneOverlaps();
    }
    perfEndStep("zones");

    perfStartStep("visuals");
    const vfc = state._frameCtr;
    if (vfc % 3 === 0) updateActivityZones();
    if (vfc % 2 === 0) drawTurrets();
    updateCityPopLabels();
    if (vfc % 2 === 0) updateSquadLabels();
    if (vfc % 2 === 0) updateCombatUI();
    updateFloatingDamage(dt);
    drawBullets();
    drawStorm();
    updateSelectionBox();
    updatePathPreview();
    updateMovingPathPreview();
    if (vfc % 4 === 0) updateMinimap();
    if (vfc % 3 === 0) updateLeaderboard();
    if (vfc % 2 === 0) updateFog();
    if (vfc % 2 === 0) updateSquadStrip();
    updateSquadControlBox();
    if (vfc % 3 === 0) updateHUD();
    if (vfc % 10 === 0) { checkVictory(); updateDominationTimerUI(); }
    perfEndStep("visuals");

    // fps
    fpsAcc += dt;
    fpsN++;
    if (fpsAcc >= 0.5) {
      const fps = Math.round(fpsN / fpsAcc);
      fpsEl.textContent = `fps: ${fps}`;
      fpsAcc = 0;
      fpsN = 0;
    }

    const frameMs = performance.now() - frameStart;
    perfTick(frameMs);

    flushDestroyQueue();
  });

})();