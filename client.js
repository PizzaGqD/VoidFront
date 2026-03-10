(async () => {
  // Сокет и меню — синхронно, ДО любого await, чтобы кнопки работали мгновенно
  const state = {
    _menuMode: window._menuMode || null,
    _myNickname: window._myNickname || null,
    _lobbySlots: [],
    _roomId: null,
    _isHost: false,
    _mySlot: null,
    _lobbyList: [],
    _colorEditSlot: null
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
    for (let i = 0; i < 6; i++) {
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
        btn.textContent = (r.code||"")+" — "+(r.hostName||"?")+" ("+(r.slotsUsed||0)+"/"+(r.slotsTotal||6)+")";
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
  // Build version & changelog
  // ------------------------------------------------------------
  const BUILD_VERSION = "BUILD 1.6a";
  const BUILD_CHANGELOG = [
    { version: "BUILD 0.1a-0.5a", date: "2026-03-08", changes: [
      "Mines, formations, movement, RTS input, VoidFront branding"
    ]},
    { version: "BUILD 0.6a-0.8a", date: "2026-03-08", changes: [
      "Squad engagement, combat formation, hitbox/SHIFT/HUD fixes"
    ]},
    { version: "BUILD 0.9a", date: "2026-03-08", changes: [
      "Fix: same-squad collision/separation fully disabled — formation slot is sole authority",
      "Fix: squad combat propagation — damage to any member alerts entire squad",
      "Fix: threat detection no longer range-limited (if it hit you, you find it)",
      "Add: unit caps per type (300/100/50/10/10) with HUD counter badges",
      "Add: batch buttons moved under unit shop, show unit label + ×count",
      "Fix: no-credits/cap-reached shows floating message + sound (no cursor change)"
    ]},
    { version: "BUILD 1.0a", date: "2026-03-08", changes: [
      "ARCH: Movement Authority Hierarchy — single movement source per frame (siege > squad formation > individual combat > waypoint)",
      "ARCH: Squad followers ALWAYS use formation slots — never break to individual chase",
      "ARCH: formations.js decides COMBAT vs MOVE mode based on squad engagement phase (approach → tight, engaged → combat slots)",
      "FIX: Chase waypoint hysteresis — leader waypoints update only when target moves >30px, eliminates per-frame jitter",
      "FIX: Squad merge applies proper formation geometry instead of raw scattered positions",
      "FIX: Squad regroup — entire squad transitions to REGROUP after combat ends, prevents idle→acquire flip-flop",
      "FIX: COMBAT formation graceful fallback to MOVE positioning when engagement anchor not yet established",
      "FIX: stepSquadMerge throttled to ~4/sec — reduces merge churn and formation resets",
      "Behavior: Squad-centric combat — followers maintain formation during battle, fire from formation slots",
      "Behavior: Approach phase keeps tight formation; engaged phase spreads to combat slots around enemy anchor"
    ]},
    { version: "BUILD 1.1a", date: "2026-03-08", changes: [
      "FIX: Formation hold — followers snap to exact slot position instead of drifting with leader velocity",
      "FIX: Inter-row formation spacing accounts for different unit type hitboxes (fighter→destroyer gap)",
      "ADD: Engagement radius — separate from attack range, grows at 0.9x coefficient for range upgrades",
      "ADD: Engagement radius drawn as orange zone for selected squads (visible when range upgraded)",
      "ADD: x10/x100 batch buttons directly below each unit class button",
      "ADD: Music player — 4 unique tracks, random start, prev/next, progress bar with seek"
    ]},
    { version: "BUILD 1.2a", date: "2026-03-08", changes: [
      "ARCH: Removed legacy persistentBattles/inCombatSet — all combat logic via _combatState from combat.js",
      "ARCH: OBB (oriented bounding box) hitboxes — collision boxes match ship shape, not just circles",
      "ARCH: Mass-based collision — big ships barely move from small ones (proportional to sizeMultiplier)",
      "COMBAT: Siege interruptible — enemy ships attacking you during siege trigger fight, then resume siege",
      "COMBAT: Fight on the way — units en route to planet engage enemies, then continue to target",
      "COMBAT: Per-type firing — fighters/destroyers fire while moving, cruiser+ must be stationary",
      "COMBAT: Smart focus fire — small targets get focused by squad, large targets get fire distributed",
      "COMBAT: Auto-engage on hitbox contact — enemy hitbox overlap triggers combat automatically",
      "COMBAT: Weak enemy push — enemies can overlap slightly, just prevents exact stacking",
      "FIX: Delayed formation rebuild — 2.5s gap before filling dead unit's formation slot",
      "FIX: Music player MIME type — server now serves .mp3 with correct audio/mpeg type",
      "FIX: Orbit uses combat target directly instead of legacy _battleCache"
    ]},
    { version: "BUILD 1.3a", date: "2026-03-09", changes: [
      "FIX: Eliminated all formation teleport snaps — units now move smoothly to slots via capped moveDist",
      "FIX: formation_hold no longer snaps followers to slot position; uses smooth interpolation",
      "FIX: Waypoint final-stop no longer snaps 35px; unit decelerates naturally to destination",
      "FIX: Removed FORMATION_TARGET_THRESHOLD (25px) instant snap for formation/squad_anchor modes",
      "ARCH: combat.js updateSquadEngagement no longer calls redundant SQUADLOGIC.step(dt=0)",
      "ARCH: squad-logic.js confirmed as single source of truth for combat lock, zone membership, order buffering",
      "COMBAT: Engagement zones correctly expand to include new squads entering join radius",
      "COMBAT: Queued orders preserved through combat lock, applied after regroup completes",
      "COMBAT: Post-combat regroup holds position at battle center, no random drift",
      "TEST: Added 5 new tests — no-teleport, no-drift, stable-slots, smooth-followers, hitbox-spacing"
    ]},
    { version: "BUILD 1.4a", date: "2026-03-09", changes: [
      "ARCH: Full rewrite — formations.js is pure geometry, combat.js is fire-plan only, squad-logic.js is single brain",
      "ARCH: client.js stepUnits unified to ONE movement path: decel zone at 20px, 2px epsilon, never snap",
      "COMBAT: Engaged mode = FREE CHASE — no formation, each unit picks nearest enemy and chases at own speed",
      "COMBAT: Engagement zones persist across ticks, merge when squads overlap, dissolve when no enemies remain",
      "COMBAT: No regroup phase — zone dissolves → immediately resume queued/saved order or hold position",
      "COMBAT: Order locking — all orders buffered to queuedOrder while in combat (approach/engaged)",
      "COMBAT: Siege interrupt saves order as resumeOrder, resumes after combat ends",
      "FORMATION: Fixed-spacing per unit type (fighter 16px, destroyer 32px, cruiser 48px, battleship 64px, hyperDestroyer 80px)",
      "FORMATION: Line, wedge, circle types — pure offset calculation, no game state",
      "FORMATION: Leader position = formation anchor; followers compute slot as leader.xy + rotatedOffset",
      "MOVEMENT: Individual speed in free_chase mode — fast units no longer capped by slow squadmates during combat",
      "BOT: Aggressive squad merging — 500px radius, immediate merge after burst purchase, no more 1-unit squads",
      "FIX: Removed all legacy movement branches (formation_hold snap, WAYPOINT_STOP_DIST snap, dual combat state machine)",
      "TEST: Rewrote all tests for new API — engagement, free-chase, no-snap, order buffer, stable slots (20 tests)"
    ]},
    { version: "BUILD 1.5a", date: "2026-03-10", changes: [
      "FIX: Slot count desync — server had 6 slots, client iterated only 5 in startGameMulti, renderLobby, mine placement",
      "ARCH: Lobby spawn selection moved to dedicated 3rd column with numbered map preview",
      "ARCH: Spawn position chosen via dropdown per slot instead of click-on-map",
      "ARCH: Unique colors enforced server-side — auto-assign on join/bot-add, reject duplicates on setColor",
      "ARCH: Unique spawn positions enforced server-side — auto-assign on join/bot-add",
      "ARCH: Host can override any slot's color (setSlotColor) and spawn (setSlotSpawn)",
      "ARCH: gameState relay restricted to host only (server security fix)",
      "ARCH: Project naming unified to VoidFront (package.json, server console, net.js, README)"
    ]},
    { version: "BUILD 1.6a", date: "2026-03-10", changes: [
      "ARCH: Extracted utils.js — pure math/color/geometry helpers (clamp, rand, mulberry32, hslToHex, hslToRgb, dist2, norm, isPointInPolygon, polygonArea)",
      "ARCH: Extracted noise.js — procedural noise (hash2, smoothstep, lerp, valueNoise, fbm)",
      "ARCH: client.js imports via destructuring from window.UTILS / window.NOISE — all call sites unchanged"
    ]}
  ];
  {
    const badge = document.getElementById("gameVersionBadge");
    if (badge) {
      badge.textContent = BUILD_VERSION;
      badge.title = BUILD_CHANGELOG.map(e =>
        e.version + " (" + e.date + ")\n" + e.changes.map(c => "  • " + c).join("\n")
      ).join("\n\n");
    }
  }

  // Music Player — 4 unique tracks, random start, progress bar with seek
  const MusicPlayer = (() => {
    const audio = document.getElementById("bgMusic");
    if (!audio) return null;
    const tracks = [
      { file: "assets/Celestial%20Archive%20of%20the%20First%20Dawn.mp3", name: "Celestial Archive of the First Dawn" },
      { file: "assets/Celestial%20Archive%20of%20the%20First%20Dawn%20(1).mp3", name: "Celestial Archive II" },
      { file: "assets/Gravitational%20Echoes.mp3", name: "Gravitational Echoes" },
      { file: "assets/Gravitational%20Hush.mp3", name: "Gravitational Hush" }
    ];
    let idx = Math.floor(Math.random() * tracks.length);
    let started = false;
    let seeking = false;
    let userUnlocked = false;
    let pendingPlay = false;
    let trackErrorRecovering = false;
    audio.volume = 0.35;
    audio.loop = false;
    audio.autoplay = true;
    audio.muted = true;

    const playBtn = document.getElementById("mpPlay");
    const prevBtn = document.getElementById("mpPrev");
    const nextBtn = document.getElementById("mpNext");
    const trackName = document.getElementById("mpTrackName");
    const volSlider = document.getElementById("mpVolume");
    const menuBtn = document.getElementById("btnMusicToggle");
    const progressBar = document.getElementById("mpProgress");
    const timeNow = document.getElementById("mpTimeNow");
    const timeDur = document.getElementById("mpTimeDur");

    function fmtTime(s) {
      if (!isFinite(s) || s < 0) return "0:00";
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return m + ":" + String(sec).padStart(2, "0");
    }

    function loadTrack(i) {
      idx = ((i % tracks.length) + tracks.length) % tracks.length;
      audio.src = tracks[idx].file;
      audio.load();
      if (trackName) trackName.textContent = tracks[idx].name;
      if (progressBar) progressBar.value = 0;
      if (timeNow) timeNow.textContent = "0:00";
      if (timeDur) timeDur.textContent = "0:00";
    }
    function syncButtonsPlaying(isPlaying) {
      if (playBtn) playBtn.innerHTML = isPlaying ? "&#9646;&#9646;" : "&#9654;";
      if (menuBtn) {
        if (isPlaying) menuBtn.classList.remove("muted");
        else menuBtn.classList.add("muted");
      }
    }
    function syncMuteState() {
      audio.muted = !userUnlocked;
    }
    function attemptPlay() {
      if (!pendingPlay) return;
      syncMuteState();
      audio.play().then(() => {
        started = true;
        pendingPlay = false;
        syncButtonsPlaying(true);
      }).catch(() => {
        syncButtonsPlaying(false);
      });
    }
    function unlockAudio() {
      userUnlocked = true;
      syncMuteState();
      if (!pendingPlay && audio.paused) pendingPlay = true;
      attemptPlay();
    }
    function play() {
      pendingPlay = true;
      attemptPlay();
    }
    function pause() {
      pendingPlay = false;
      audio.pause();
      syncButtonsPlaying(false);
    }
    function toggle() { audio.paused ? play() : pause(); }
    function next() { pendingPlay = true; loadTrack(idx + 1); attemptPlay(); }
    function prev() { pendingPlay = true; loadTrack(idx - 1); attemptPlay(); }

    let lastEndedAt = 0;
    audio.addEventListener("ended", () => {
      const dur = audio.duration || 0;
      const cur = audio.currentTime || 0;
      const now = performance.now();
      if (dur > 0 && cur < dur * 0.95) return;
      if (now - lastEndedAt < 500) return;
      lastEndedAt = now;
      next();
    });
    audio.addEventListener("canplay", () => { errorCount = 0; attemptPlay(); });
    let errorCount = 0;
    audio.addEventListener("error", () => {
      if (trackErrorRecovering) return;
      errorCount++;
      if (errorCount >= tracks.length) {
        console.warn("[Music] All tracks failed to load, stopping.");
        return;
      }
      trackErrorRecovering = true;
      setTimeout(() => {
        next();
        trackErrorRecovering = false;
      }, 1000);
    });
    audio.addEventListener("timeupdate", () => {
      if (seeking) return;
      const dur = audio.duration || 0;
      const cur = audio.currentTime || 0;
      if (timeNow) timeNow.textContent = fmtTime(cur);
      if (timeDur) timeDur.textContent = fmtTime(dur);
      if (progressBar && dur > 0) progressBar.value = Math.round((cur / dur) * 1000);
    });
    audio.addEventListener("loadedmetadata", () => {
      if (timeDur) timeDur.textContent = fmtTime(audio.duration || 0);
    });

    if (progressBar) {
      progressBar.addEventListener("input", () => { seeking = true; });
      progressBar.addEventListener("change", () => {
        const dur = audio.duration || 0;
        if (dur > 0) audio.currentTime = (progressBar.value / 1000) * dur;
        seeking = false;
      });
    }
    if (playBtn) playBtn.addEventListener("click", () => { unlockAudio(); toggle(); });
    if (nextBtn) nextBtn.addEventListener("click", () => { unlockAudio(); next(); });
    if (prevBtn) prevBtn.addEventListener("click", () => { unlockAudio(); prev(); });
    if (volSlider) volSlider.addEventListener("input", () => { audio.volume = volSlider.value / 100; });
    if (menuBtn) menuBtn.addEventListener("click", (e) => { e.stopPropagation(); unlockAudio(); toggle(); });

    loadTrack(idx);
    pendingPlay = true;
    attemptPlay();
    function tryStart() {
      if (userUnlocked && started) return;
      unlockAudio();
      if (audio.paused) play();
    }
    document.addEventListener("pointerdown", tryStart, { once: false, passive: true });
    document.addEventListener("keydown", tryStart, { once: false });
    document.addEventListener("touchstart", tryStart, { once: false, passive: true });

    return { tracks, next, prev, toggle, addTrack(file, name) { tracks.push({ file, name }); } };
  })();

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
  const formB = balance.formation || {};
  const terrainB = balance.terrain || {};
  const waterB = balance.waterBonus || {};
  const xpB = balance.xp || {};
  const mapB = balance.map || {};
  const fogB = balance.fog || {};
  const zonesB = balance.zones || {};
  const gridB = balance.grid || {};
  const minesB = balance.mines || {};
  const eCreditsB = balance.eCredits || {};
  const nebulaB = balance.nebula || {};
  const bhB = balance.blackHole || {};
  const chainB = balance.chainLightning || {};
  const cryoB = balance.cryoEffect || {};
  const fireB = balance.fireEffect || {};
  const unitTypesB = balance.unitTypes || {};

  // Load combat module config from balance.json
  if (typeof COMBAT !== "undefined" && COMBAT.loadConfig) {
    COMBAT.loadConfig(balance);
  }
  if (typeof SQUADLOGIC !== "undefined" && SQUADLOGIC.loadConfig) {
    SQUADLOGIC.loadConfig(balance);
  }
  
  // Load formations module config from balance.json
  if (typeof FORMATIONS !== "undefined" && FORMATIONS.loadConfig) {
    FORMATIONS.loadConfig(balance);
  }

  const UNIT_BOUNDING_MUL = { fighter: 1.8, destroyer: 2, cruiser: 2, battleship: 2.2, hyperDestroyer: 2.5 };

  const UNIT_OBB_ASPECT = {
    fighter:        { lengthMul: 1.3,  widthMul: 0.55 },
    destroyer:      { lengthMul: 1.45, widthMul: 0.7  },
    cruiser:        { lengthMul: 1.5,  widthMul: 0.85 },
    battleship:     { lengthMul: 1.65, widthMul: 0.95 },
    hyperDestroyer: { lengthMul: 1.85, widthMul: 1.0  },
  };

  function getUnitOBB(u) {
    const type = UNIT_TYPES[u.unitType] || UNIT_TYPES.fighter;
    const s = type.sizeMultiplier * 6 + 6;
    const asp = UNIT_OBB_ASPECT[u.unitType] || UNIT_OBB_ASPECT.fighter;
    const halfL = s * asp.lengthMul;
    const halfW = s * asp.widthMul;
    const angle = u._lastFacingAngle || 0;
    return { cx: u.x, cy: u.y, halfL, halfW, angle, cosA: Math.cos(angle), sinA: Math.sin(angle) };
  }

  function getUnitBoundingR(u) {
    const type = UNIT_TYPES[u.unitType] || UNIT_TYPES.fighter;
    const s = type.sizeMultiplier * 6 + 6;
    const asp = UNIT_OBB_ASPECT[u.unitType] || UNIT_OBB_ASPECT.fighter;
    return Math.hypot(s * asp.lengthMul, s * asp.widthMul);
  }

  function obbOverlap(a, b) {
    const dx = b.cx - a.cx, dy = b.cy - a.cy;
    const axes = [
      { x: a.cosA, y: a.sinA },
      { x: -a.sinA, y: a.cosA },
      { x: b.cosA, y: b.sinA },
      { x: -b.sinA, y: b.cosA }
    ];
    let minOv = Infinity, mAx = 0, mAy = 0;
    for (let i = 0; i < 4; i++) {
      const ax = axes[i].x, ay = axes[i].y;
      const dist = Math.abs(dx * ax + dy * ay);
      const projA = a.halfL * Math.abs(a.cosA * ax + a.sinA * ay) +
                    a.halfW * Math.abs(-a.sinA * ax + a.cosA * ay);
      const projB = b.halfL * Math.abs(b.cosA * ax + b.sinA * ay) +
                    b.halfW * Math.abs(-b.sinA * ax + b.cosA * ay);
      const ov = projA + projB - dist;
      if (ov <= 0) return null;
      if (ov < minOv) { minOv = ov; mAx = ax; mAy = ay; }
    }
    const dot = dx * mAx + dy * mAy;
    const sign = dot < 0 ? 1 : -1;
    return { overlap: minOv, nx: mAx * sign, ny: mAy * sign };
  }
  const UNIT_TYPE_ORDER = ["fighter","destroyer","cruiser","battleship","hyperDestroyer"];
  const UNIT_TYPES = {};
  for (const key of UNIT_TYPE_ORDER) {
    const t = unitTypesB[key] || {};
    UNIT_TYPES[key] = {
      key,
      name: t.name || key,
      squadSize: t.squadSize ?? 1,
      cost: t.cost ?? 100,
      hp: t.hp ?? 25,
      damage: t.damage ?? 1,
      attackRate: t.attackRate ?? 1,
      speed: t.speed ?? 9,
      attackRange: t.attackRange ?? 40,
      maxTargets: t.maxTargets ?? 1,
      popPenaltyPerUnit: t.popPenaltyPerUnit ?? 1,
      sizeMultiplier: t.sizeMultiplier ?? 1,
      orbitTarget: !!t.orbitTarget,
      formationType: t.formationType || null,
      formationRows: t.formationRows ?? 3
    };
  }

  const CFG = {
    GAME_SPEED: 2.5,
    WORLD_W: w.width ?? 5000,
    WORLD_H: w.height ?? 3000,
    MAX_PLAYERS: w.maxPlayers ?? 6,
    CAMERA_START_ZOOM: camB.startZoom ?? 0.22,
    BOTS: botsB.count ?? 5,
    BOT_THINK_INTERVAL: botsB.thinkIntervalSeconds ?? 0.8,
    BOT_SEND_DELAY: 0.6,

    POP_START: cityB.startPopulation ?? 150,
    ECREDITS_START: eCreditsB.startingAmount ?? 200,

    GROWTH_BASE_PER_MIN: cityB.baseGrowthPerMinute ?? 2,
    GROWTH_PER_100: cityB.growthPer100Population ?? 1.5,
    ACTIVE_SOLDIER_PENALTY_PER: cityB.activeUnitPenaltyPercent ?? 0.005,
    ACTIVE_SOLDIER_PENALTY_CAP: cityB.activeUnitPenaltyCap ?? 0.5,
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
    PLANET_ATTACK_R_MUL: cityB.planetAttackRadiusMul ?? 2.5,
    CITY_ATTACK_RADIUS: 200,
    CITY_ATTACK_RATE: cityB.cityAttackRate ?? 0.38,
    CITY_ATTACK_DMG: cityB.cityAttackDamage ?? 4,
    CITY_BULLET_SPEED: 60,
    CITY_BASE_TARGETS: cityB.cityAttackTargets ?? 1,

    MINE_CAPTURE_RADIUS: minesB.captureRadius ?? 50,
    MINE_CAPTURE_PROTECTION: minesB.captureProtectionSeconds ?? 5,
    MINE_CAPTURE_TIME: minesB.captureTimeSeconds ?? 3,
    MINE_YIELD_PER_SEC: minesB.yieldPerSecond ?? 5,
    MINE_BASE_YIELD_VALUE: minesB.baseYieldValue ?? 1,
    MINE_RICH_MULTIPLIER: minesB.richMultiplier ?? 2.5,
    MINE_GEM_SPEED: minesB.gemSpeed ?? 200,
    MINE_GEM_INTERCEPT_R: minesB.gemInterceptRadius ?? 30,
    MINE_MAX_GEMS: minesB.maxGemsPerMine ?? 10,
    MINE_START_PER_PLAYER: minesB.startingMinesPerPlayer ?? 2,
    MINE_NEUTRAL_PER_PLAYER: minesB.neutralMinesPerPlayer ?? 2,
    MINE_TOTAL: minesB.totalMines ?? 25,

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

    NEBULA_CENTER_RADIUS: nebulaB.centerRadius ?? 210,
    NEBULA_EXTRA_COUNT: nebulaB.extraCount ?? 3,
    NEBULA_EXTRA_R_MIN: nebulaB.extraRadiusMin ?? 140,
    NEBULA_EXTRA_R_MAX: nebulaB.extraRadiusMax ?? 200,
    NEBULA_SPEED_PENALTY: nebulaB.speedPenalty ?? 0.5,
    NEBULA_DMG_TAKEN_BONUS: nebulaB.damageTakenBonus ?? 0.25,
    NEBULA_ATK_RATE_BONUS: nebulaB.attackRateBonus ?? 0.1,
    NEBULA_ATK_RANGE_BONUS: nebulaB.attackRangeBonus ?? 0.1,
    NEBULA_DMG_BONUS: nebulaB.damageBonus ?? 0.1,
    NEBULA_DISCHARGE_LIFE: nebulaB.dischargeLifetime ?? 0.3,
    NEBULA_DISCHARGE_SEGS: nebulaB.dischargeSegments ?? 5,

    BLACKHOLE_COOLDOWN: bhB.cooldown ?? 180,
    BLACKHOLE_DURATION: bhB.duration ?? 17,
    BLACKHOLE_RADIUS: bhB.radius ?? 400,
    BLACKHOLE_GROWTH_TIME: bhB.growthTime ?? 3,
    BLACKHOLE_HOLD_TIME: bhB.holdTime ?? 10,
    BLACKHOLE_FADE_TIME: bhB.fadeTime ?? 4,
    BLACKHOLE_MIN_DPS: bhB.minDamagePerSec ?? 1,
    BLACKHOLE_MAX_DPS: bhB.maxDamagePerSec ?? 10,
    BLACKHOLE_GRAVITY: bhB.gravityStrength ?? 70,

    ACTIVITY_RADIUS: 35,
    CHAIN_BOUNCE_R: chainB.bounceRadius ?? 60,
    CHAIN_DECAY: chainB.damageDecay ?? 0.25,
    CHAIN_MAX_BOUNCES: chainB.maxBounces ?? 3,
    CRYO_SLOW: cryoB.slowPercent ?? 0.4,
    CRYO_DURATION: cryoB.duration ?? 2,
    FIRE_DOT_DPS: fireB.dotDamagePerSec ?? 3,
    FIRE_DURATION: fireB.duration ?? 3,

    XP_BASE: xpB.baseNextLevel ?? 160,
    XP_PER_LEVEL: xpB.perLevelFactor ?? 16,
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
  // Removed old sendCount/sendBtn -- now using unit purchase buttons
  const resetCamBtn = document.getElementById("resetCamBtn");
  const regenBtn = document.getElementById("regenBtn");
  const toggleZonesBtn = document.getElementById("toggleZones");
  const toggleGridBtn = document.getElementById("toggleGrid");
  const leaderboardBody = document.getElementById("leaderboardBody");
  const mergeSquadBtn = document.getElementById("mergeSquadBtn");
  const splitSquadBtn = document.getElementById("splitSquadBtn");
  const splitByTypeBtn = document.getElementById("splitByTypeBtn");
  const formationSelect = document.getElementById("formationSelect");
  const formationRowsEl = document.getElementById("formationRows");
  const formationSelectMulti = document.getElementById("formationSelectMulti");
  const formationRowsMultiEl = document.getElementById("formationRowsMulti");
  const squadControlBox = document.getElementById("squadControlBox");
  const squadControlOne = document.getElementById("squadControlOne");
  const squadControlMulti = document.getElementById("squadControlMulti");
  const squadStripEl = document.getElementById("squadStripRight") || document.getElementById("squadStrip");
  const rallyPointBtn = document.getElementById("rallyPointBtn");
  const rallyPointHintEl = document.getElementById("rallyPointHint");

  if (rallyPointBtn) rallyPointBtn.addEventListener("click", () => {
    state.rallyPointMode = true;
    if (rallyPointHintEl) rallyPointHintEl.textContent = "Кликните по карте — куда по умолчанию идут отряды.";
  });

  // sendCountEl removed -- using unit shop buttons now

  function cloneWaypointsSafe(waypoints) {
    return Array.isArray(waypoints) ? waypoints.map(w => ({ x: w.x, y: w.y })) : [];
  }

  function getSquadStateFromUnits(squad) {
    if (!squad || squad.length === 0) return null;
    if (typeof SQUADLOGIC === "undefined" || !SQUADLOGIC.syncSquadsFromState) return null;
    SQUADLOGIC.syncSquadsFromState(state);
    return squad[0].squadId != null ? state.squads.get(squad[0].squadId) : null;
  }

  function applyFormationToSquad(squad, formationType, formationRows, dirX, dirY, formationPigWidth) {
    const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
    let vx, vy;
    if (dirX != null && dirY != null) {
      [vx, vy] = norm(dirX, dirY);
    } else if (leader._lastFacingAngle != null) {
      vx = Math.cos(leader._lastFacingAngle);
      vy = Math.sin(leader._lastFacingAngle);
    } else {
      [vx, vy] = leader.waypoints && leader.waypoints.length ? norm(leader.waypoints[0].x - leader.x, leader.waypoints[0].y - leader.y) : norm(1, 0);
    }
    const pigW = formationPigWidth ?? leader.formationPigWidth ?? 1;
    const offsets = getFormationOffsets(squad.length, formationType, formationRows, vx, vy, pigW, squad);
    leader.formationType = formationType;
    leader.formationRows = formationRows;
    leader._formationAngle = Math.atan2(vy, vx);
    if (formationType === "pig") leader.formationPigWidth = pigW;
    for (let i = 0; i < squad.length; i++) {
      const u = squad[i];
      u.formationOffsetX = offsets[i]?.x ?? 0;
      u.formationOffsetY = offsets[i]?.y ?? 0;
    }
    const squadState = getSquadStateFromUnits(squad);
    if (squadState && typeof SQUADLOGIC !== "undefined") {
      SQUADLOGIC.setSquadFormation(state, squadState.id, formationType, formationRows, pigW);
      squadState.formation.facing = Math.atan2(vy, vx);
      squadState.anchor.desiredFacing = squadState.formation.facing;
      SQUADLOGIC.requestFormationRecalc(state, squadState.id, true);
      SQUADLOGIC.recalculateFormation(state, squadState.id, { getFormationOffsets }, true);
    }
  }

  function applyOrDeferFormation(squad, formationType, formationRows, formationPigWidth) {
    const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
    const wp = leader.waypoints;
    const idx = leader.waypointIndex ?? 0;
    const dirX = wp && idx < wp.length && wp[idx] ? wp[idx].x - leader.x : null;
    const dirY = wp && idx < wp.length && wp[idx] ? wp[idx].y - leader.y : null;
    applyFormationToSquad(squad, formationType, formationRows, dirX, dirY, formationPigWidth);
    // Sync to host in multiplayer: host applies to authoritative state → full sync distributes
    if (state._multiSlots && !state._multiIsHost && state._socket) {
      state._socket.emit("playerAction", {
        type: "formation",
        pid: state.myPlayerId,
        leaderId: leader.id,
        unitIds: squad.map(u => u.id),
        formationType,
        formationRows,
        formationPigWidth: formationPigWidth || 1
      });
    }
  }

  const formationLineRowEl = document.getElementById("formationLineRow");
  const formationPigRowEl = document.getElementById("formationPigRow");
  const formationPigDepthValEl = document.getElementById("formationPigDepthVal");
  const formationPigWidthValEl = document.getElementById("formationPigWidthVal");
  function getFormationValuesFromUI(single) {
    const sel = single ? formationSelect : formationSelectMulti;
    const rowsEl = single ? formationRowsEl : formationRowsMultiEl;
    const type = (sel && sel.value) || "line";
    let rows = parseInt(rowsEl?.value ?? 3, 10) || 3;
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
    const type = leader.formationType || "line";
    const rows = leader.formationRows ?? 3;
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
    const squads = getSelectedSquads();
    if (squads.length < 2 || typeof SQUADLOGIC === "undefined") return;
    const squadIds = squads.map(sq => sq[0]?.squadId).filter(id => id != null);
    if (squadIds.length < 2) return;
    const leader = squads[0][0];
    const [vx, vy] = norm(1, 0);
    const waypoints = [{ x: leader.x + vx * 280, y: leader.y + vy * 280 }];
    const formationType = (formationSelectMulti && formationSelectMulti.value) || (formationSelect && formationSelect.value) || "line";
    const formationRows = parseInt(formationRowsMultiEl?.value ?? formationRowsEl?.value ?? 3, 10) || 3;
    const pigW = leader.formationPigWidth ?? 1;
    const merged = SQUADLOGIC.mergeSquads(state, squadIds, formationType, formationRows, pigW);
    if (merged) {
      SQUADLOGIC.issueMoveOrder(state, merged.id, waypoints, Math.atan2(vy, vx));
      SQUADLOGIC.recalculateFormation(state, merged.id, { getFormationOffsets }, true);
    }
    if (state._multiSlots && !state._multiIsHost && state._socket) {
      state._socket.emit("playerAction", {
        type: "mergeSquad",
        pid: state.myPlayerId,
        squadIds,
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
    if (typeof SQUADLOGIC !== "undefined") {
      const squadState = getSquadStateFromUnits(squads[0]);
      if (!squadState) return;
      const squad = squads[0].slice();
      const n = squad.length;
      const k = Math.floor(n / 2);
      const firstIds = squad.slice(0, k).map(u => u.id);
      const secondIds = squad.slice(k, n).map(u => u.id);
      const order = SQUADLOGIC.cloneOrder(squadState.order);
      const formation = { ...squadState.formation };
      SQUADLOGIC.destroySquad(state, squadState.id);
      const firstSquad = SQUADLOGIC.createSquad(state, firstIds, {
        formationType: formation.type,
        formationRows: formation.rows,
        formationWidth: formation.width,
        order
      });
      const secondSquad = SQUADLOGIC.createSquad(state, secondIds, {
        formationType: formation.type,
        formationRows: formation.rows,
        formationWidth: formation.width,
        order
      });
      if (firstSquad) SQUADLOGIC.recalculateFormation(state, firstSquad.id, { getFormationOffsets }, true);
      if (secondSquad) SQUADLOGIC.recalculateFormation(state, secondSquad.id, { getFormationOffsets }, true);
      if (state._multiSlots && !state._multiIsHost && state._socket) {
        state._socket.emit("playerAction", { type: "splitSquad", unitIds: squad.map(u => u.id) });
      }
      return;
    }
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
  function doSplitSquadByType() {
    const squads = getSelectedSquads();
    if (squads.length !== 1 || typeof SQUADLOGIC === "undefined") return;
    const squadState = getSquadStateFromUnits(squads[0]);
    if (!squadState) return;
    const out = SQUADLOGIC.splitSquadByType(state, squadState.id);
    for (const nextSquad of out) {
      SQUADLOGIC.recalculateFormation(state, nextSquad.id, { getFormationOffsets }, true);
    }
    if (state._multiSlots && !state._multiIsHost && state._socket) {
      state._socket.emit("playerAction", { type: "splitSquadByType", squadId: squadState.id });
    }
  }
  if (splitByTypeBtn) splitByTypeBtn.addEventListener("click", doSplitSquadByType);
  const splitByTypeBtnOne = document.getElementById("splitByTypeBtnOne");
  if (splitByTypeBtnOne) splitByTypeBtnOne.addEventListener("click", doSplitSquadByType);

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
      const ut = UNIT_TYPES[u.unitType] || UNIT_TYPES.fighter;
      dps += (u.dmg != null ? u.dmg : ut.damage) * ut.attackRate;
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
      btn.type = "button";
      btn.className = "squad-pill" + (isSelected ? " selected" : "");
      let hp = 0;
      for (const u of squad) hp += u.hp;
      const strength = squadStrength(squad);
      btn.innerHTML = (bindNum ? `[${bindNum}] ` : "") + "Отряд " + squad.length + " · <span class=\"squad-strength\">" + strength + "</span>";
      btn.dataset.leaderId = leaderId;
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Look up fresh squad at click time to avoid stale references
        const lid = parseInt(btn.dataset.leaderId);
        const freshSquad = [];
        const ldr = state.units.get(lid);
        if (ldr && ldr.hp > 0) freshSquad.push(ldr);
        for (const uu of state.units.values()) {
          if (uu.leaderId === lid && uu.hp > 0) freshSquad.push(uu);
        }
        if (freshSquad.length === 0) return;
        state.selectedUnitIds.clear();
        for (const uu of freshSquad) state.selectedUnitIds.add(uu.id);
        updateSquadControlBox();
        updateSelectionBox();
      });
      squadStripEl.appendChild(btn);
    });
  }

  window.addEventListener("keydown", (e) => {
    // F2: Toggle combat debug overlay
    if (e.key === "F2") {
      if (typeof COMBAT !== "undefined" && COMBAT.toggleDebug) {
        const enabled = COMBAT.toggleDebug();
        console.log("[Combat Debug] " + (enabled ? "ENABLED" : "DISABLED"));
        e.preventDefault();
        return;
      }
    }
    
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

  // ── Version ──────────────────────────────────────────────────
  const GAME_VERSION = "0.5A";

  // ------------------------------------------------------------
  // Helpers (imported from utils.js / noise.js)
  // ------------------------------------------------------------
  const { clamp, rand, mulberry32, hslToHex, hslToRgb,
          dist2, norm, isPointInPolygon, polygonArea } = window.UTILS;
  const { hash2, valueNoise, fbm } = window.NOISE;
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

  // ── Procedural SFX (laser, explosion) — audible only when camera close to action ──
  let _audioCtx = null;
  const SOUND_HEAR_RADIUS = 550;
  function ensureAudioCtx() {
    if (_audioCtx) return _audioCtx;
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return _audioCtx;
  }
  function isNearCamera(wx, wy) {
    const v = state._vp;
    if (!v) return false;
    const cx = (v.x + v.x2) / 2, cy = (v.y + v.y2) / 2;
    return Math.hypot(wx - cx, wy - cy) < SOUND_HEAR_RADIUS;
  }
  function playLaserSound(fromX, fromY, toX, toY) {
    const mx = (fromX + toX) / 2, my = (fromY + toY) / 2;
    if (!isNearCamera(mx, my)) return;
    try {
      const ctx = ensureAudioCtx();
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.06);
    } catch (_) {}
  }
  function playExplosionSound(x, y) {
    if (!isNearCamera(x, y)) return;
    try {
      const ctx = ensureAudioCtx();
      if (ctx.state === "suspended") ctx.resume();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        const t = i / ctx.sampleRate;
        d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 25);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      src.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      src.start(ctx.currentTime);
    } catch (_) {}
  }

  // ── Starfield: 5 layers, 20% stars each, parallax 0.25 → 0.05 ───────────
  const starLayer = new PIXI.Container();
  app.stage.addChildAt(starLayer, 0); // behind world

  const STAR_PARALLAX = [0.45, 0.38, 0.32, 0.26, 0.20, 0.15, 0.11, 0.07, 0.04, 0.02];
  const STARS_COUNT = [32, 32, 48, 48, 56, 56, 64, 64, 64, 64];
  const STAR_COLORS = ["#ffffff","#ffffff","#ffffff","#ddeeff","#a8ccff","#ffe8c8","#ffd0a8","#c8b8ff","#ffcccc"];
  let _starSprites = [];
  let _starPulseData = []; // per-layer pulse metadata

  function buildStarTexture(seed, layerIndex) {
    const TW = 1600, TH = 1000;
    const cnv = document.createElement("canvas");
    cnv.width = TW; cnv.height = TH;
    const ctx = cnv.getContext("2d");
    if (layerIndex === 0) {
      ctx.fillStyle = "#07091a";
      ctx.fillRect(0, 0, TW, TH);
      const dustRng = mulberry32(seed + 0xDEAD);
      const dustColors = ["#0a1228", "#120a22", "#0a0f1e", "#14091a", "#091418"];
      for (let d = 0; d < 6; d++) {
        const dx = dustRng() * TW, dy = dustRng() * TH;
        const dr = 120 + dustRng() * 200;
        const grad = ctx.createRadialGradient(dx, dy, 0, dx, dy, dr);
        const col = dustColors[d % dustColors.length];
        grad.addColorStop(0, col);
        grad.addColorStop(1, "transparent");
        ctx.globalAlpha = 0.3 + dustRng() * 0.25;
        ctx.fillStyle = grad;
        ctx.fillRect(dx - dr, dy - dr, dr * 2, dr * 2);
      }
      ctx.globalAlpha = 1;
    }

    const rng = mulberry32(seed + 0x57AE5 + layerIndex * 7919);
    const count = STARS_COUNT[layerIndex] || 120;
    const isFront = layerIndex >= 7;
    const globalShrink = 0.9;
    const frontShrink = isFront ? 0.7 : 1.0;
    const sizeBase  = (0.2 + layerIndex * 0.25) * globalShrink * frontShrink;
    const sizeRange = (0.5 + layerIndex * 0.6) * globalShrink * frontShrink;
    const stars = [];
    for (let i = 0; i < count; i++) {
      const x = rng() * TW, y = rng() * TH;
      const r = sizeBase + rng() * sizeRange;
      const a = 0.3 + rng() * 0.6;
      const col = STAR_COLORS[rng() * STAR_COLORS.length | 0];
      ctx.globalAlpha = a;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (r > 1.4) {
        ctx.globalAlpha = a * 0.25;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - r * 2.5, y - 0.5, r * 5, 1);
        ctx.fillRect(x - 0.5, y - r * 2.5, 1, r * 5);
      }
      stars.push({ phase: rng() * Math.PI * 2, speed: 0.3 + rng() * 0.7 });
    }
    ctx.globalAlpha = 1;
    return { tex: PIXI.Texture.from(cnv), stars };
  }

  function initStarfield(seed) {
    _starSprites.forEach(s => { starLayer.removeChild(s); s.destroy(); });
    _starSprites = [];
    _starPulseData = [];
    for (let L = 0; L < 10; L++) {
      const { tex, stars } = buildStarTexture(seed, L);
      const sp = new PIXI.TilingSprite({ texture: tex, width: app.renderer.width, height: app.renderer.height });
      starLayer.addChild(sp);
      _starSprites.push(sp);
      _starPulseData.push(stars);
    }
    app.renderer.on("resize", (w, h) => { _starSprites.forEach(s => { s.width = w; s.height = h; }); });
  }

  // Subtle pulse: modulate alpha of each star layer slightly over time
  function pulseStars() {
    const now = performance.now() / 1000;
    for (let L = 0; L < _starSprites.length; L++) {
      const base = L === 0 ? 1.0 : 1.0;
      const pulse = 0.03 * Math.sin(now * (0.4 + L * 0.15) + L * 1.5);
      _starSprites[L].alpha = base + pulse;
    }
  }

  // Layers
  const world = new PIXI.Container();
  const mapLayer = new PIXI.Container();
  const gridLayer = new PIXI.Container();
  const zonesLayer = new PIXI.Container();
  const resLayer = new PIXI.Container();
  const shipTrailsLayer = new PIXI.Container();
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
  // Zone visual effects: running border lights and contact glows (above zone fill, below units)
  const zoneEffectsLayer = new PIXI.Container();
  const contactGfx = new PIXI.Graphics();
  zoneEffectsLayer.addChild(contactGfx);
  const shieldHitEffectsGfx = new PIXI.Graphics();
  const shieldHitEffectsLayer = new PIXI.Container();
  shieldHitEffectsLayer.addChild(shieldHitEffectsGfx);
  const worldBorderDarkenLayer = new PIXI.Container();
  
  // Combat debug overlay (F2 to toggle)
  const combatDebugGfx = new PIXI.Graphics();
  const combatDebugLayer = new PIXI.Container();
  combatDebugLayer.addChild(combatDebugGfx);
  const combatDebugLabels = new Map(); // unitId -> PIXI.Text
  world.addChild(mapLayer, gridLayer, zonesLayer, zoneEffectsLayer, turretLayer, activityZoneLayer, shipTrailsLayer, unitsLayer, resLayer, cityLayer, shieldHitEffectsLayer, squadLabelsLayer, combatLayer, floatingDamageLayer, bulletsLayer, ghostLayer, combatDebugLayer);
  world.addChild(fogLayer);
  world.addChild(pathPreviewLayer, selectionBoxLayer);
  world.addChild(worldBorderDarkenLayer);
  fogLayer.visible = false;
  app.stage.addChild(world);

  const announcementLayer = new PIXI.Container();
  app.stage.addChild(announcementLayer);

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
    for (let L = 0; L < _starSprites.length; L++) {
      const f = STAR_PARALLAX[L] ?? 0.15;
      _starSprites[L].tilePosition.x = -cam.x * f;
      _starSprites[L].tilePosition.y = -cam.y * f;
    }
    applyNebulaParallax();
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


  /** Glass base only: dark, semi-transparent so starfield shows through. */
  function makeMapTexture() {
    const W = CFG.MAP_TEX_W;
    const H = CFG.MAP_TEX_H;
    const cnv = document.createElement("canvas");
    cnv.width = W;
    cnv.height = H;
    const c = cnv.getContext("2d");
    // Slight gradient: darker corners, very subtle center
    const g = c.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.55);
    g.addColorStop(0, "rgba(6, 8, 22, 0.28)");
    g.addColorStop(1, "rgba(4, 6, 18, 0.38)");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    const tex = PIXI.Texture.from(cnv);
    return tex;
  }

  /** Build an irregular nebula texture using noise on canvas. */
  function buildNebulaTexture(seed, hue) {
    const S = 256;
    const cnv = document.createElement("canvas");
    cnv.width = S; cnv.height = S;
    const ctx = cnv.getContext("2d");
    const img = ctx.createImageData(S, S);
    const d = img.data;
    const rng = mulberry32(seed);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        const nx = x / S, ny = y / S;
        const cx = nx - 0.5, cy = ny - 0.5;
        const dist = Math.sqrt(cx * cx + cy * cy) * 2;
        const n1 = valueNoise(x * 3, y * 3, 0.03, seed);
        const n2 = valueNoise(x * 3, y * 3, 0.06, seed + 999) * 0.5;
        const shape = Math.max(0, 1 - dist * (0.8 + n1 * 0.6) - n2 * 0.3);
        const alpha = shape * shape * 255;
        const hr = ((hue >> 16) & 0xff), hg = ((hue >> 8) & 0xff), hb = (hue & 0xff);
        d[i] = hr; d[i+1] = hg; d[i+2] = hb; d[i+3] = alpha | 0;
      }
    }
    ctx.putImageData(img, 0, 0);
    return PIXI.Texture.from(cnv);
  }

  const NEBULA_HUES = [0x1a2a6e, 0x2a1a5e, 0x3a2aae, 0x1a4a6e, 0x4a2a8e];
  const NEBULA_LAYER_PARALLAX = [0.003, 0.006, 0.009, 0.012, 0.015];
  let nebulaContainers = []; // one PIXI.Container per parallax layer
  let stateNebulaClouds = [];

  function rebuildNebulae() {
    nebulaContainers.forEach(c => { if (c.parent) c.parent.removeChild(c); c.destroy({ children: true }); });
    nebulaContainers = [];
    stateNebulaClouds = [];

    const rng = mulberry32(mapSeed ^ 0xe3b014);
    const numClouds = 3 + (rng() > 0.5 ? 1 : 0);
    const clouds = [];
    for (let n = 0; n < numClouds; n++) {
      clouds.push({
        cx: CFG.WORLD_W * (0.15 + rng() * 0.70),
        cy: CFG.WORLD_H * (0.15 + rng() * 0.70),
        r: 320 + rng() * 120
      });
    }
    const numChains = 2 + (rng() > 0.5 ? 1 : 0);
    for (let ch = 0; ch < numChains; ch++) {
      const startX = CFG.WORLD_W * (0.2 + rng() * 0.6);
      const startY = CFG.WORLD_H * (0.2 + rng() * 0.6);
      const angle = rng() * Math.PI * 2;
      const step = 160 + rng() * 140;
      const chainLen = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < chainLen; i++) {
        clouds.push({
          cx: clamp(startX + Math.cos(angle) * step * i + (rng() - 0.5) * 60, 100, CFG.WORLD_W - 100),
          cy: clamp(startY + Math.sin(angle) * step * i + (rng() - 0.5) * 60, 100, CFG.WORLD_H - 100),
          r: 150 + rng() * 90
        });
      }
    }
    stateNebulaClouds = clouds;

    for (let L = 0; L < 5; L++) {
      const layerC = new PIXI.Container();
      layerC._parallax = NEBULA_LAYER_PARALLAX[L];
      layerC._basePivotX = 0; layerC._basePivotY = 0;
      const hue = NEBULA_HUES[L];
      for (let n = 0; n < clouds.length; n++) {
        const c = clouds[n];
        const tex = buildNebulaTexture(mapSeed + n * 1000 + L * 333, hue);
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5, 0.5);
        const offX = (rng() - 0.5) * c.r * 0.35;
        const offY = (rng() - 0.5) * c.r * 0.35;
        sp.position.set(c.cx + offX, c.cy + offY);
        const stretchW = 0.7 + rng() * 0.8 + L * 0.06;
        const stretchH = 0.6 + rng() * 0.7 + L * 0.08;
        sp.width = c.r * 2.4 * stretchW;
        sp.height = c.r * 2.4 * stretchH;
        sp.rotation = rng() * Math.PI * 2;
        sp.alpha = 0.35 + L * 0.08;
        layerC.addChild(sp);
      }
      const idx = mapLayer.children.indexOf(mapSprite);
      mapLayer.addChildAt(layerC, idx >= 0 ? idx + 1 + L : L);
      nebulaContainers.push(layerC);
    }
  }

  function applyNebulaParallax() {
    const cx = cam.x / cam.zoom, cy = cam.y / cam.zoom;
    for (const c of nebulaContainers) {
      const f = c._parallax || 0;
      c.pivot.set(cx * f, cy * f);
    }
  }

  let neonEdgeSprite = null;

  function rebuildNeonEdges() {
    if (neonEdgeSprite) { if (neonEdgeSprite.parent) neonEdgeSprite.parent.removeChild(neonEdgeSprite); neonEdgeSprite.destroy(); }
    const W = CFG.WORLD_W, H = CFG.WORLD_H;
    const PAD = 60;
    const cnv = document.createElement("canvas");
    cnv.width = W + PAD * 2;
    cnv.height = H + PAD * 2;
    const ctx = cnv.getContext("2d");

    // Single core line with glow via shadow
    ctx.shadowColor = "#55bbff";
    ctx.shadowBlur = 30;
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "#55bbff";
    ctx.lineWidth = 4;
    ctx.strokeRect(PAD, PAD, W, H);

    ctx.globalAlpha = 1;
    const tex = PIXI.Texture.from(cnv);
    neonEdgeSprite = new PIXI.Sprite(tex);
    neonEdgeSprite.position.set(-PAD, -PAD);
    world.addChild(neonEdgeSprite);
  }

  function pulseNeonEdge() {
    if (!neonEdgeSprite) return;
    const t = performance.now() / 1000;
    const pulse = 0.55 + 0.45 * Math.sin(t * 1.2);
    neonEdgeSprite.alpha = pulse;
  }

  /** Electrical discharges: zigzag lightning, along map edge and inside nebulae. */
  let dischargeGfx = null;
  let _dischargeSpawnAcc = 0;
  const DISCHARGE_SPAWN_INTERVAL = 1.8;

  function makeZigzag(x1, y1, x2, y2, rng, segs) {
    const pts = [{ x: x1, y: y1 }];
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const mx = x1 + (x2 - x1) * t + (rng() - 0.5) * 60;
      const my = y1 + (y2 - y1) * t + (rng() - 0.5) * 60;
      pts.push({ x: mx, y: my });
    }
    pts.push({ x: x2, y: y2 });
    return pts;
  }

  function spawnDischarge(rng) {
    const W = CFG.WORLD_W, H = CFG.WORLD_H;
    const edge = rng() * 4 | 0;
    let x1, y1, x2, y2;
    const len = 80 + rng() * 160;
    if (edge === 0)      { x1 = rng() * W; y1 = 0;  x2 = x1 + (rng()-0.5)*200; y2 = len; }
    else if (edge === 1) { x1 = W; y1 = rng() * H;   x2 = W - len; y2 = y1 + (rng()-0.5)*200; }
    else if (edge === 2) { x1 = rng() * W; y1 = H;   x2 = x1 + (rng()-0.5)*200; y2 = H - len; }
    else                 { x1 = 0; y1 = rng() * H;   x2 = len; y2 = y1 + (rng()-0.5)*200; }
    return { pts: makeZigzag(x1, y1, x2, y2, rng, 6 + (rng()*4|0)), progress: 0, speed: 0.008 + rng() * 0.006 };
  }

  function spawnNebulaDischarge(rng) {
    if (stateNebulaClouds.length === 0) return null;
    const c = stateNebulaClouds[rng() * stateNebulaClouds.length | 0];
    const a = rng() * Math.PI * 2;
    const r = c.r * (0.1 + rng() * 0.4);
    return { pts: makeZigzag(c.cx, c.cy, c.cx + Math.cos(a)*r, c.cy + Math.sin(a)*r, rng, 4 + (rng()*4|0)), progress: 0, speed: 0.003 + rng() * 0.003 };
  }

  function updateDischarges(dt) {
    if (!state.discharges) state.discharges = [];
    if (!dischargeGfx) {
      dischargeGfx = new PIXI.Graphics();
      world.addChild(dischargeGfx);
    }
    const list = state.discharges;
    _dischargeSpawnAcc += dt;
    if (_dischargeSpawnAcc >= DISCHARGE_SPAWN_INTERVAL) {
      _dischargeSpawnAcc = 0;
      const rng = mulberry32((mapSeed >>> 0) + (state._frameCtr || 0) * 7);
      if (stateNebulaClouds.length > 0 && rng() < 0.65) {
        const d = spawnNebulaDischarge(rng);
        if (d) list.push(d);
      } else {
        list.push(spawnDischarge(rng));
      }
    }
    for (let i = list.length - 1; i >= 0; i--) {
      list[i].progress += list[i].speed;
      if (list[i].progress >= 1) list.splice(i, 1);
    }
    dischargeGfx.clear();
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const pts = d.pts;
      const visSegs = Math.ceil(d.progress * (pts.length - 1));
      const alpha = d.progress < 0.1 ? d.progress / 0.1 : d.progress > 0.85 ? (1 - d.progress) / 0.15 : 1;
      dischargeGfx.lineStyle(6, 0x4488ff, 0.15 * alpha);
      dischargeGfx.moveTo(pts[0].x, pts[0].y);
      for (let s = 1; s <= visSegs && s < pts.length; s++) dischargeGfx.lineTo(pts[s].x, pts[s].y);
      dischargeGfx.lineStyle(2.5, 0x88ccff, 0.7 * alpha);
      dischargeGfx.moveTo(pts[0].x, pts[0].y);
      for (let s = 1; s <= visSegs && s < pts.length; s++) dischargeGfx.lineTo(pts[s].x, pts[s].y);
      dischargeGfx.lineStyle(1, 0xeeffff, 0.95 * alpha);
      dischargeGfx.moveTo(pts[0].x, pts[0].y);
      for (let s = 1; s <= visSegs && s < pts.length; s++) dischargeGfx.lineTo(pts[s].x, pts[s].y);
    }
  }

  let worldBorderDarkenGfx = null;
  function drawWorldBorderDarken() {
    if (!worldBorderDarkenLayer) return;
    if (!worldBorderDarkenGfx) {
      worldBorderDarkenGfx = new PIXI.Graphics();
      worldBorderDarkenLayer.addChild(worldBorderDarkenGfx);
    }
    const g = worldBorderDarkenGfx;
    g.clear();
    const W = CFG.WORLD_W, H = CFG.WORLD_H;
    const big = 2e5;
    g.rect(-big, -big, W + big * 2, big);
    g.fill({ color: 0x000000, alpha: 0.55 });
    g.rect(-big, H, W + big * 2, big);
    g.fill({ color: 0x000000, alpha: 0.55 });
    g.rect(-big, -big, big, H + big * 2);
    g.fill({ color: 0x000000, alpha: 0.55 });
    g.rect(W, -big, big, H + big * 2);
    g.fill({ color: 0x000000, alpha: 0.55 });
  }

  function rebuildMap(optionalSeed) {
    mapSeed = optionalSeed != null ? (optionalSeed >>> 0) : (Date.now() >>> 0);
    initStarfield(mapSeed);
    const tex = makeMapTexture();
    if (mapSprite) mapLayer.removeChild(mapSprite);
    mapSprite = new PIXI.Sprite(tex);
    mapSprite.width = CFG.WORLD_W;
    mapSprite.height = CFG.WORLD_H;
    mapLayer.addChild(mapSprite);
    if (!state._bgCometLayer) {
      state._bgCometLayer = new PIXI.Graphics();
      mapLayer.addChildAt(state._bgCometLayer, 0);
    }
    state._bgComets = [];
    state._bgCometNextAt = 0;

    drawWorldBorderDarken();
    rebuildNebulae();
    rebuildNeonEdges();
    state.discharges = state.discharges || [];
    mapLayer.sortableChildren = true;
  }

  // Optional grid overlay (debug) + axis labels
  function rebuildGrid() {
    gridLayer.removeChildren();
    if (!CFG.GRID_ENABLED) return;
    const step = CFG.GRID_STEP ?? 100;
    const g = new PIXI.Graphics();
    g.alpha = 0.12;
    g.lineStyle(1, 0xffffff, 0.5);
    for (let x = 0; x <= CFG.WORLD_W; x += step) {
      g.moveTo(x, 0);
      g.lineTo(x, CFG.WORLD_H);
    }
    for (let y = 0; y <= CFG.WORLD_H; y += step) {
      g.moveTo(0, y);
      g.lineTo(CFG.WORLD_W, y);
    }
    gridLayer.addChild(g);

    const labelStyle = { fontSize: 11, fill: 0x8899aa };
    for (let x = 0; x <= CFG.WORLD_W; x += step) {
      const num = Math.floor(x / step) + 1;
      const txt = new PIXI.Text({ text: String(num), style: labelStyle });
      txt.anchor.set(0.5, 1);
      txt.x = x; txt.y = -4;
      gridLayer.addChild(txt);
    }
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let y = 0; y <= CFG.WORLD_H; y += step) {
      const idx = Math.floor(y / step);
      const letter = letters[idx % letters.length] + (idx >= 26 ? String(Math.floor(idx / 26) + 1) : "");
      const txt = new PIXI.Text({ text: letter, style: labelStyle });
      txt.anchor.set(1, 0.5);
      txt.x = -6; txt.y = y;
      gridLayer.addChild(txt);
    }
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
    mines: new Map(),
    mineGems: [],
    nebulae: [],
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
    orderPreview: null,
    floatingDamage: [],
    selectedUnitIds: new Set(),
    prevInCombatIds: new Set(),
    boxStart: null,
    boxEnd: null,
    squads: new Map(),
    engagementZones: new Map(),
    nextSquadId: 1,
    nextEngagementZoneId: 1,
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
      eCredits: CFG.ECREDITS_START,
      level: 1,
      xp: 0,
      xpNext: Math.floor(CFG.XP_BASE + CFG.XP_PER_LEVEL * 1 * CFG.XP_LEVEL_MUL),
      _levelBonusMul: 1.01,
      activeUnits: 0,
      deadUnits: 0,

      influenceR: Math.max(maxR, CFG.INFLUENCE_R(startPop)),
      influencePolygon: poly,
      influenceRayDistances: poly.map(pt => Math.hypot(pt.x - x, pt.y - y)),

      waterBonus: onWater,
      turretIds: [],

      mineYieldBonus: 0,
      unitCostMul: 1,
      cityTargetBonus: 0,
      attackEffect: null,
      attackEffects: {},

      unitHpMul: 1, unitDmgMul: 1, unitAtkRateMul: 1,
      unitSpeedMul: 1, unitAtkRangeMul: 1,
      growthMul: 1, influenceSpeedMul: 1,
      turretHpMul: 1, turretDmgMul: 1, turretRangeMul: 1,

      shieldHp: Math.max(5, startPop * 2),
      shieldMaxHp: Math.max(5, startPop * 2),
      shieldRegenCd: 0,

      pendingCardPicks: 0,
      rerollCount: 0,
      xpZonePct: 0,
      xpGainMul: 1,

      _patrolCount: 1,
      _patrols: [{ t: 0, atkCd: 0 }],

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

  const CARD_RARITY_WEIGHTS = { common: 45, uncommon: 28, rare: 15, epic: 8, legendary: 3, mythic: 1 };
  const CARD_RARITY_COLORS = {
    common: 0x888888, uncommon: 0x22aa44, rare: 0x4488dd,
    epic: 0x9944cc, legendary: 0xddcc00, mythic: 0xdd4400
  };
  const CARD_RARITY_LABELS = {
    common: "Обычная", uncommon: "Необычная", rare: "Редкая",
    epic: "Эпическая", legendary: "Легендарная", mythic: "Абсолютно Легендарная"
  };
  const UNIT_ATK_RANGE_MAX_MUL = 3.0;

  const CARD_DEFS = [
    { id: "c1", name: "Плазменная броня", desc: "+8% HP кораблей", rarity: "common", emoji: "🛡️", unitHpMul: 1.08 },
    { id: "c2", name: "Усиленные лазеры", desc: "+8% урон кораблей", rarity: "common", emoji: "🔫", unitDmgMul: 1.08 },
    { id: "c3", name: "Частотный модулятор", desc: "+7% скорострельность", rarity: "common", emoji: "⚡", unitAtkRateMul: 1.07 },
    { id: "c4", name: "Форсаж двигателей", desc: "+7% скорость кораблей", rarity: "common", emoji: "🚀", unitSpeedMul: 1.07 },
    { id: "c5", name: "Колонизация", desc: "+7% рост населения", rarity: "common", emoji: "👥", growthMul: 1.07 },
    { id: "c6", name: "Сканер дальности", desc: "+8% дальность атаки", rarity: "common", emoji: "📡", unitAtkRangeMul: 1.08 },
    { id: "c7", name: "Усиление турелей", desc: "+10% HP турелей", rarity: "common", emoji: "🏗️", turretHpMul: 1.10 },
    { id: "c8", name: "Точные орудия", desc: "+10% урон турелей", rarity: "common", emoji: "🎯", turretDmgMul: 1.10 },
    { id: "c9", name: "Экспансия", desc: "+5% скорость зоны влияния", rarity: "common", emoji: "🌐", influenceSpeedMul: 1.05 },
    { id: "c10", name: "Оптимизация добычи", desc: "+1 к добыче шахт", rarity: "common", emoji: "⛏️", mineYieldBonus: 1 },
    { id: "c11", name: "Экономия ресурсов", desc: "-5% стоимость кораблей", rarity: "common", emoji: "💰", unitCostMul: 0.95 },

    { id: "u1", name: "Титановый корпус", desc: "+12% HP кораблей", rarity: "uncommon", emoji: "🛡️", unitHpMul: 1.12 },
    { id: "u2", name: "Фокусированные лазеры", desc: "+12% урон кораблей", rarity: "uncommon", emoji: "🔫", unitDmgMul: 1.12 },
    { id: "u3", name: "Разгон орудий", desc: "+10% скорострельность", rarity: "uncommon", emoji: "⚡", unitAtkRateMul: 1.10 },
    { id: "u4", name: "Ионные двигатели", desc: "+10% скорость кораблей", rarity: "uncommon", emoji: "🚀", unitSpeedMul: 1.10 },
    { id: "u5", name: "Демографический бум", desc: "+12% рост населения", rarity: "uncommon", emoji: "👥", growthMul: 1.12 },
    { id: "u6", name: "Дальний радар", desc: "+12% дальность атаки", rarity: "uncommon", emoji: "📡", unitAtkRangeMul: 1.12 },
    { id: "u7", name: "Укреплённые турели", desc: "+18% HP турелей", rarity: "uncommon", emoji: "🏗️", turretHpMul: 1.18 },
    { id: "u8", name: "Тяжёлые орудия", desc: "+15% урон турелей", rarity: "uncommon", emoji: "🎯", turretDmgMul: 1.15 },
    { id: "u9", name: "Терраформирование", desc: "+10% скорость зоны", rarity: "uncommon", emoji: "🌐", influenceSpeedMul: 1.10 },
    { id: "u10", name: "Улучшенная добыча", desc: "+2 к добыче шахт", rarity: "uncommon", emoji: "⛏️", mineYieldBonus: 2 },
    { id: "u11", name: "Оптовые закупки", desc: "-8% стоимость кораблей", rarity: "uncommon", emoji: "💰", unitCostMul: 0.92 },

    { id: "r1", name: "Нанокомпозит", desc: "+18% HP кораблей", rarity: "rare", emoji: "🛡️", unitHpMul: 1.18 },
    { id: "r2", name: "Плазменные пушки", desc: "+18% урон кораблей", rarity: "rare", emoji: "🔫", unitDmgMul: 1.18 },
    { id: "r3", name: "Ускоритель частиц", desc: "+15% скорострельность", rarity: "rare", emoji: "⚡", unitAtkRateMul: 1.15 },
    { id: "r4", name: "Варп-двигатель", desc: "+15% скорость кораблей", rarity: "rare", emoji: "🚀", unitSpeedMul: 1.15 },
    { id: "r5", name: "Массовая колонизация", desc: "+18% рост населения", rarity: "rare", emoji: "👥", growthMul: 1.18 },
    { id: "r6", name: "Телескоп", desc: "+18% дальность атаки", rarity: "rare", emoji: "📡", unitAtkRangeMul: 1.18 },
    { id: "r7", name: "Бастион", desc: "+20% HP, +10% радиус турелей", rarity: "rare", emoji: "🏗️", turretHpMul: 1.20, turretRangeMul: 1.10 },
    { id: "r8", name: "Артиллерийские турели", desc: "+20% урон турелей", rarity: "rare", emoji: "🎯", turretDmgMul: 1.20 },
    { id: "r9", name: "Империя", desc: "+18% скорость зоны", rarity: "rare", emoji: "🌐", influenceSpeedMul: 1.18 },
    { id: "r10", name: "Глубокое бурение", desc: "+3 к добыче шахт", rarity: "rare", emoji: "⛏️", mineYieldBonus: 3 },
    { id: "r11", name: "Военный контракт", desc: "-12% стоимость кораблей", rarity: "rare", emoji: "💰", unitCostMul: 0.88 },
    { id: "r12", name: "Дальнобойные турели", desc: "+15% радиус турелей", rarity: "rare", emoji: "📡", turretRangeMul: 1.15 },

    { id: "e1", name: "Квантовая броня", desc: "+25% HP кораблей", rarity: "epic", emoji: "🛡️", unitHpMul: 1.25 },
    { id: "e2", name: "Дезинтеграторы", desc: "+25% урон кораблей", rarity: "epic", emoji: "🔫", unitDmgMul: 1.25 },
    { id: "e3", name: "Гиперзалп", desc: "+22% скорострельность", rarity: "epic", emoji: "⚡", unitAtkRateMul: 1.22 },
    { id: "e4", name: "Гипердрайв", desc: "+22% скорость кораблей", rarity: "epic", emoji: "🚀", unitSpeedMul: 1.22 },
    { id: "e5", name: "Золотой век", desc: "+25% рост населения", rarity: "epic", emoji: "👥", growthMul: 1.25 },
    { id: "e6", name: "Система наведения", desc: "+25% дальность атаки", rarity: "epic", emoji: "📡", unitAtkRangeMul: 1.25 },
    { id: "e7", name: "Суперфорт", desc: "+30% урон и HP турелей", rarity: "epic", emoji: "🏗️", turretDmgMul: 1.30, turretHpMul: 1.20 },
    { id: "e8", name: "Доминирование", desc: "+30% скорость зоны", rarity: "epic", emoji: "🌐", influenceSpeedMul: 1.30 },
    { id: "e9", name: "Мульти-прицел", desc: "Планета стреляет по +1 цели", rarity: "epic", emoji: "🎯", cityTargetBonus: 1 },
    { id: "e10", name: "Промышленная революция", desc: "-18% стоимость кораблей", rarity: "epic", emoji: "💰", unitCostMul: 0.82 },

    { id: "L1", name: "Нейтронный корпус", desc: "+40% HP кораблей", rarity: "legendary", emoji: "🛡️", unitHpMul: 1.40 },
    { id: "L2", name: "Аннигиляторы", desc: "+40% урон кораблей", rarity: "legendary", emoji: "🔫", unitDmgMul: 1.40 },
    { id: "L3", name: "Тахионный залп", desc: "+35% скорострельность", rarity: "legendary", emoji: "⚡", unitAtkRateMul: 1.35 },
    { id: "L4", name: "Скорость света", desc: "+35% скорость кораблей", rarity: "legendary", emoji: "🚀", unitSpeedMul: 1.35 },
    { id: "L5", name: "Эпоха процветания", desc: "+40% рост населения", rarity: "legendary", emoji: "👥", growthMul: 1.40 },
    { id: "L6", name: "Всевидящее око", desc: "+40% дальность атаки", rarity: "legendary", emoji: "📡", unitAtkRangeMul: 1.40 },
    { id: "L7", name: "Крепость богов", desc: "+50% HP, +25% радиус турелей", rarity: "legendary", emoji: "🏗️", turretHpMul: 1.50, turretRangeMul: 1.25 },
    { id: "L8", name: "Абсолютная экспансия", desc: "+45% скорость зоны", rarity: "legendary", emoji: "🌐", influenceSpeedMul: 1.45 },
    { id: "L9", name: "Мульти-залп", desc: "Планета стреляет по +2 целям", rarity: "legendary", emoji: "🎯", cityTargetBonus: 2 },
    { id: "L10", name: "Нулевая стоимость", desc: "-30% стоимость кораблей", rarity: "legendary", emoji: "💰", unitCostMul: 0.70 },
    { id: "L11", name: "Абсолютно легендарный щит", desc: "+0.5 реген щита/с, +100 населения", rarity: "legendary", emoji: "🛡️", shieldRegenBonus: 0.5, populationBonus: 100, maxPicks: 3 },
    { id: "P1", name: "Патрульный", desc: "Патруль по границе зоны. Двойной выстрел, малый радиус, несколько целей. Получает апгрейды от турелей. Макс. 4", rarity: "legendary", emoji: "🔦", patrolBonus: 1, maxPicks: 4 },

    { id: "M1", name: "Цепная молния", desc: "Лазеры перескакивают на врагов (−25%/скачок). Ур. 2: 6 скачков. Ур. 3: 9 скачков", rarity: "mythic", emoji: "⚡", attackEffect: "chain" },
    { id: "M2", name: "Криозаряды", desc: "Замедление 40% (2с). Ур. 2: 55% (3с). Ур. 3: 70% (4с)", rarity: "mythic", emoji: "❄️", attackEffect: "cryo" },
    { id: "M3", name: "Плазменное пламя", desc: "Поджог 3 ур/с (3с). Ур. 2: 5 ур/с (4с). Ур. 3: 8 ур/с (5с)", rarity: "mythic", emoji: "🔥", attackEffect: "fire" }
  ];

  function rollCardRarity() {
    const r = Math.random() * 100;
    let acc = 0;
    for (const rarity of ["mythic","legendary","epic","rare","uncommon","common"]) {
      acc += CARD_RARITY_WEIGHTS[rarity] || 0;
      if (r < acc) return rarity;
    }
    return "common";
  }

  function getCardType(card) {
    if (card.attackEffect) return "attackEffect_" + card.attackEffect;
    if (card.shieldRegenBonus) return "shieldRegen";
    if (card.patrolBonus) return "patrol";
    if (card.popBonus) return "pop";
    if (card.mineYieldBonus) return "mineYield";
    if (card.unitCostMul) return "unitCost";
    if (card.cityTargetBonus) return "cityTarget";
    const keys = Object.keys(card);
    if (keys.some(k => k.startsWith("unitHp"))) return "unitHp";
    if (keys.some(k => k.startsWith("unitDmg") && !k.startsWith("unitDmgMul"))) return "unitDmg";
    if (keys.includes("unitDmgMul")) return "unitDmg";
    if (keys.some(k => k.startsWith("unitAtkRate"))) return "unitAtkRate";
    if (keys.some(k => k.startsWith("unitSpeed"))) return "unitSpeed";
    if (keys.some(k => k.startsWith("unitAtkRange"))) return "unitAtkRange";
    if (keys.some(k => k.startsWith("growth"))) return "growth";
    if (keys.some(k => k.startsWith("influence"))) return "influence";
    if (keys.some(k => k.startsWith("turret"))) return "turret";
    return "other";
  }

  function getRandomCards(count, player) {
    const picks = (player && player._cardPicksCount) || {};
    const allowed = c => !c.maxPicks || (picks[c.id] || 0) < c.maxPicks;
    const out = [];
    const usedBuffIds = new Set();
    for (let i = 0; i < count; i++) {
      const rarity = rollCardRarity();
      const pool = CARD_DEFS.filter(c => c.rarity === rarity && allowed(c) && !usedBuffIds.has(c.id) && !c.patrolBonus);
      if (pool.length < 2) {
        const fallback = CARD_DEFS.filter(c => allowed(c) && !usedBuffIds.has(c.id) && !c.patrolBonus);
        if (fallback.length >= 2) {
          rarity = fallback[0].rarity;
        }
      }
      const available = CARD_DEFS.filter(c => c.rarity === rarity && allowed(c) && !usedBuffIds.has(c.id) && !c.patrolBonus);
      if (available.length < 2) {
        const any = CARD_DEFS.filter(c => allowed(c) && !usedBuffIds.has(c.id) && !c.patrolBonus);
        if (any.length >= 2) {
          const a = any.splice(Math.floor(Math.random() * any.length), 1)[0];
          const bPool = any.filter(c => getCardType(c) !== getCardType(a));
          const b = bPool.length ? bPool[Math.floor(Math.random() * bPool.length)] : any[Math.floor(Math.random() * any.length)];
          usedBuffIds.add(a.id); usedBuffIds.add(b.id);
          const maxRarity = RARITY_ORDER.indexOf(a.rarity) > RARITY_ORDER.indexOf(b.rarity) ? a.rarity : b.rarity;
          out.push({ dual: true, rarity: maxRarity, buffs: [a, b] });
          continue;
        }
        if (any.length === 1) { usedBuffIds.add(any[0].id); out.push({ dual: true, rarity: any[0].rarity, buffs: [any[0], any[0]] }); continue; }
        continue;
      }
      const a = available.splice(Math.floor(Math.random() * available.length), 1)[0];
      const bPool = available.filter(c => getCardType(c) !== getCardType(a));
      const b = bPool.length ? bPool[Math.floor(Math.random() * bPool.length)] : available[Math.floor(Math.random() * available.length)];
      usedBuffIds.add(a.id); usedBuffIds.add(b.id);
      out.push({ dual: true, rarity, buffs: [a, b] });
    }
    return out;
  }
  const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];

  function applyCard(p, card) {
    if (card.dual && card.buffs) {
      for (const buff of card.buffs) applySingleBuff(p, buff);
      return;
    }
    applySingleBuff(p, card);
  }

  function applySingleBuff(p, card) {
    if (card.maxPicks != null) {
      p._cardPicksCount = p._cardPicksCount || {};
      p._cardPicksCount[card.id] = (p._cardPicksCount[card.id] || 0) + 1;
    }
    if (card.shieldRegenBonus != null) {
      p.shieldRegenBonus = (p.shieldRegenBonus || 0) + card.shieldRegenBonus;
      if (card.populationBonus != null) {
        p.popFloat = (p.popFloat || p.pop || 0) + card.populationBonus;
        p.pop = Math.floor(p.popFloat);
      }
      return;
    }
    if (card.patrolBonus) {
      p._patrolCount = Math.min(4, (p._patrolCount || 0) + 1);
      p._patrols = p._patrols || [];
      while (p._patrols.length < p._patrolCount) {
        p._patrols.push({ t: p._patrols.length / 4, atkCd: 0 });
      }
      return;
    }
    if (card.popBonus) {
      p.popFloat = (p.popFloat || p.pop) + card.popBonus;
      p.pop = Math.floor(p.popFloat);
      return;
    }
    if (card.mineYieldBonus) {
      p.mineYieldBonus = (p.mineYieldBonus || 0) + card.mineYieldBonus;
      return;
    }
    if (card.cityTargetBonus) {
      p.cityTargetBonus = (p.cityTargetBonus || 0) + card.cityTargetBonus;
      return;
    }
    if (card.attackEffect) {
      if (!p.attackEffects) p.attackEffects = {};
      const cur = p.attackEffects[card.attackEffect] || 0;
      if (cur < 3) p.attackEffects[card.attackEffect] = cur + 1;
      p.attackEffect = card.attackEffect;
      return;
    }
    for (const key of Object.keys(card)) {
      if (["id","name","desc","rarity","emoji","maxPicks"].includes(key)) continue;
      const val = card[key];
      if (typeof val === "number") {
        const prev = p[key] != null ? p[key] : 1;
        let next = prev * val;
        if (key === "unitAtkRangeMul") next = Math.min(next, UNIT_ATK_RANGE_MAX_MUL);
        p[key] = next;
      }
    }
  }

  // ------------------------------------------------------------
  // Visual builders
  // ------------------------------------------------------------
  function makeCityVisual(p) {
    const R = getPlanetRadius(p);
    const city = new PIXI.Graphics();
    const seed = (state._gameSeed ?? 0) + p.id * 7919;
    const rng = mulberry32(seed);

    // Dark core
    city.beginFill(0x020408, 1);
    city.drawCircle(0, 0, R);
    city.endFill();

    // Smooth gradient — many layers dark → bright (player color)
    const layers = 16;
    for (let k = 0; k <= layers; k++) {
      const frac = k / layers;
      const r = R * (0.2 + frac * 0.8);
      const t = frac * frac;
      const a = 0.03 + t * 0.4;
      const col = frac < 0.35 ? darkenColor(p.color, 0.12) : (frac < 0.65 ? darkenColor(p.color, 0.4) : p.color);
      city.beginFill(col, a);
      city.drawCircle(0, 0, r);
      city.endFill();
    }

    // Random "continents" — irregular blobs per planet
    const numBlobs = 4 + Math.floor(rng() * 5);
    for (let b = 0; b < numBlobs; b++) {
      const angle = rng() * Math.PI * 2;
      const dist = R * (0.15 + rng() * 0.5);
      const bx = Math.cos(angle) * dist;
      const by = Math.sin(angle) * dist;
      const br = R * (0.12 + rng() * 0.22);
      const blobCol = darkenColor(p.color, 0.25 + rng() * 0.2);
      city.beginFill(blobCol, 0.08 + rng() * 0.12);
      city.drawCircle(bx, by, br);
      city.endFill();
    }

    // Crisp edge
    city.lineStyle(2.5, p.color, 0.95);
    city.drawCircle(0, 0, R);
    city.lineStyle(8, p.color, 0.12);
    city.drawCircle(0, 0, R + 3);

    const glow = makeGlow(p.color, 45, 3);
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
    label.position.set(p.x, p.y - R - 6);
    label.alpha = 0.9;

    const popLabel = new PIXI.Text("0", {
      fontFamily: "ui-sans-serif, system-ui, Arial",
      fontSize: 18,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 4
    });
    popLabel.anchor.set(0.5, 0);
    popLabel.position.set(p.x, p.y + R + 6);

    // Shield graphic (separate from planet body — updated each frame)
    const shieldGfx = new PIXI.Graphics();
    shieldGfx.position.set(p.x, p.y);

    cityLayer.addChild(city, label, popLabel, shieldGfx);
    p.cityGfx = city;
    p.label = label;
    p.popLabel = popLabel;
    p.shieldGfx = shieldGfx;
    p.cityAtkCd = 0;

    // Initialise shield HP
    const maxSh = Math.max(5, (p.pop || 1) * 5);
    if (p.shieldHp === undefined) { p.shieldHp = maxSh; p.shieldMaxHp = maxSh; }
    p.shieldRegenCd = p.shieldRegenCd ?? 0;
  }

  function getPlanetRadius(p) {
    const baseInflR = CFG.INFLUENCE_BASE_R || 240;
    const curR = p.influenceR || baseInflR;
    const s = Math.max(1, Math.min(2.5, curR / baseInflR));
    return 16 * s;
  }

  function shieldRadius(p) {
    return getPlanetRadius(p) + 12;
  }

  function darkenColor(c, factor) {
    const r = Math.max(0, ((c >> 16) & 0xff) * factor | 0);
    const g = Math.max(0, ((c >> 8) & 0xff) * factor | 0);
    const b = Math.max(0, (c & 0xff) * factor | 0);
    return (r << 16) | (g << 8) | b;
  }

  function pushShieldHitEffect(px, py, sR, fromX, fromY, color) {
    if (!state._shieldHitEffects) state._shieldHitEffects = [];
    const dx = fromX - px, dy = fromY - py;
    const d = Math.hypot(dx, dy) || 1;
    const hitX = px + (dx / d) * sR;
    const hitY = py + (dy / d) * sR;
    state._shieldHitEffects.push({ px, py, hitX, hitY, color, t0: state.t, duration: 0.6 });
  }

  function updateShieldVisuals() {
    const now = performance.now() / 1000;
    for (const p of state.players.values()) {
      const g = p.shieldGfx;
      if (!g || g.destroyed) continue;
      const maxSh = p.shieldMaxHp || 1;
      const sh    = p.shieldHp || 0;
      g.visible = sh > 0;
      g.clear();
      if (sh <= 0) continue;

      const pct   = sh / maxSh;
      const sR    = shieldRadius(p);
      const pulse = 0.6 + 0.4 * Math.sin(now * 2.5);

      // Glow around shield
      g.lineStyle(14, p.color, 0.18 * pct * pulse);
      g.drawCircle(0, 0, sR + 4);

      // Main shield ring
      g.lineStyle(4, p.color, 0.9 * pct * pulse);
      g.drawCircle(0, 0, sR);

      // Inner subtle fill
      g.beginFill(p.color, 0.04 * pct);
      g.drawCircle(0, 0, sR);
      g.endFill();
    }
    shieldHitEffectsGfx.clear();
    if (state._shieldHitEffects) {
      for (let i = state._shieldHitEffects.length - 1; i >= 0; i--) {
        const e = state._shieldHitEffects[i];
        if (state.t - e.t0 >= e.duration) { state._shieldHitEffects.splice(i, 1); continue; }
        const fade = 1 - (state.t - e.t0) / e.duration;
        const flashAlpha = Math.min(1, (state.t - e.t0) < 0.08 ? 1 : fade * 0.9);
        shieldHitEffectsGfx.beginFill(e.color, flashAlpha * 0.5);
        shieldHitEffectsGfx.drawCircle(e.hitX, e.hitY, 8);
        shieldHitEffectsGfx.endFill();
        const steps = 8;
        for (let k = 0; k < steps; k++) {
          const t0 = k / steps, t1 = (k + 1) / steps;
          const x0 = e.hitX + (e.px - e.hitX) * t0, y0 = e.hitY + (e.py - e.hitY) * t0;
          const x1 = e.hitX + (e.px - e.hitX) * t1, y1 = e.hitY + (e.py - e.hitY) * t1;
          const alpha = (0.5 + 0.5 * (1 - t0)) * fade * (e.color === 0xaa44ff ? 0.95 : 0.85);
          shieldHitEffectsGfx.lineStyle(4 + k * 0.8, e.color, alpha);
          shieldHitEffectsGfx.moveTo(x0, y0);
          shieldHitEffectsGfx.lineTo(x1, y1);
        }
      }
    }
  }

  function makeZoneVisual(p) {
    const g = new PIXI.Graphics();
    const glow = new PIXI.Graphics();
    const light = new PIXI.Graphics();

    zonesLayer.addChild(glow, g);
    zoneEffectsLayer.addChild(light);

    p.zoneGfx = g;
    p.zoneGlow = glow;
    p.zoneLightGfx = light;
    p._lightT = Math.random(); // stagger each player's light position
    redrawZone(p);
  }

  // ── Zone border perimeter helpers ──────────────────────────────
  function calcPerim(poly) {
    let totalLen = 0;
    const segs = new Float32Array(poly.length);
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      const sl = Math.hypot(poly[j].x - poly[i].x, poly[j].y - poly[i].y);
      segs[i] = sl;
      totalLen += sl;
    }
    return { segs, totalLen };
  }

  function getPolyPerimeterPoint(poly, segs, totalLen, t) {
    const target = ((t % 1) + 1) % 1 * totalLen;
    let acc = 0;
    for (let i = 0; i < poly.length; i++) {
      const sl = segs[i];
      if (acc + sl >= target) {
        const frac = sl > 0 ? (target - acc) / sl : 0;
        const j = (i + 1) % poly.length;
        return {
          x: poly[i].x + (poly[j].x - poly[i].x) * frac,
          y: poly[i].y + (poly[j].y - poly[i].y) * frac
        };
      }
      acc += sl;
    }
    return { x: poly[0].x, y: poly[0].y };
  }

  const PATROL_LIGHT_SPEED = 0.009;
  const PATROL_ATTACK_R = 85;
  const PATROL_ATTACK_RATE = 1.2;
  const PATROL_DMG = 3;

  function updateZoneLights(dt) {
    const TAIL_STEPS = 12;
    const TAIL_COVER = 0.05;

    for (const p of state.players.values()) {
      const patrolCount = p._patrolCount || 0;
      const light = p.zoneLightGfx;
      if (!light || light.destroyed) continue;
      light.clear();
      if (patrolCount === 0) continue;

      const poly = p.influencePolygon;
      if (!poly || poly.length < 3 || p.color == null) continue;

      if (!p._perimCache || p._perimCache.hash !== p._lastZoneHash) {
        p._perimCache = { hash: p._lastZoneHash, ...calcPerim(poly) };
      }
      const { segs, totalLen } = p._perimCache;
      if (totalLen < 1) continue;

      p._patrols = p._patrols || [];
      const r = (p.color >> 16) & 0xff;
      const g = (p.color >> 8) & 0xff;
      const b = p.color & 0xff;
      const bright = ((Math.min(255, r + 80) << 16) | (Math.min(255, g + 80) << 8) | Math.min(255, b + 80));

      const isRemote = !!(state._multiSlots && !state._multiIsHost);
      const PATROL_INTERP_MS = 250;
      for (let idx = 0; idx < patrolCount; idx++) {
        const patrol = p._patrols[idx];
        if (!patrol) continue;
        let t = patrol.t;
        if (isRemote && patrol._interpStart != null) {
          const elapsed = performance.now() - patrol._interpStart;
          const frac = Math.min(1, elapsed / PATROL_INTERP_MS);
          let from = patrol._interpFromT ?? t;
          let to = patrol._interpToT ?? t;
          let d = to - from;
          if (d > 0.5) d -= 1;
          if (d < -0.5) d += 1;
          t = ((from + d * frac) % 1 + 1) % 1;
          patrol._interpDisplayT = t;
        }

        for (let i = TAIL_STEPS; i >= 1; i--) {
          const tailT = ((t - (i / TAIL_STEPS) * TAIL_COVER) + 2) % 1;
          const pt = getPolyPerimeterPoint(poly, segs, totalLen, tailT);
          const progress = 1 - i / TAIL_STEPS;
          light.beginFill(p.color, progress * 0.5);
          light.drawCircle(pt.x, pt.y, 2 + progress * 5);
          light.endFill();
        }
        const head = getPolyPerimeterPoint(poly, segs, totalLen, t);
        const rangeMul = p.turretRangeMul != null ? p.turretRangeMul : 1;
        const patrolR = PATROL_ATTACK_R * rangeMul;
        light.lineStyle(1, p.color, 0.12);
        light.drawCircle(head.x, head.y, patrolR);
        light.lineStyle(0);
        light.beginFill(p.color, 0.45);
        light.drawCircle(head.x, head.y, 10);
        light.endFill();
        light.beginFill(bright, 0.75);
        light.drawCircle(head.x, head.y, 5);
        light.endFill();
        light.beginFill(0xffffff, 0.95);
        light.drawCircle(head.x, head.y, 2);
        light.endFill();
      }
    }
  }

  // Glow at zone contact points — where two players' borders meet
  const _contactPulse = { t: 0 };
  function updateZoneContacts(dt) {
    _contactPulse.t += dt;
    const pulse = 0.55 + 0.45 * Math.sin(_contactPulse.t * Math.PI * 2.5);

    contactGfx.clear();

    const players = [];
    for (const p of state.players.values()) {
      if (p.influencePolygon && p.influencePolygon.length >= 3 && p.color != null) players.push(p);
    }
    if (players.length < 2) return;

    const THRESHOLD = 75;   // pixels — considered "touching"
    const GLOW_R    = 22;

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const A = players[i], B = players[j];
        const polyA = A.influencePolygon, polyB = B.influencePolygon;

        for (let ai = 0; ai < polyA.length; ai++) {
          const pa = polyA[ai];
          for (let bi = 0; bi < polyB.length; bi++) {
            const pb = polyB[bi];
            const dx = pa.x - pb.x, dy = pa.y - pb.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < THRESHOLD) {
              const str = (1 - dist / THRESHOLD) * pulse;
              contactGfx.beginFill(A.color, 0.55 * str);
              contactGfx.drawCircle(pa.x, pa.y, GLOW_R);
              contactGfx.endFill();
              contactGfx.beginFill(B.color, 0.55 * str);
              contactGfx.drawCircle(pb.x, pb.y, GLOW_R);
              contactGfx.endFill();
            }
          }
        }
      }
    }
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
    ZoneRenderer.redraw(p, { INFLUENCE_ARMY_MARGIN: CFG.INFLUENCE_ARMY_MARGIN, zoom: cam.zoom });
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
        const sz = 7;
        t.gfx.beginFill(col, 0.9);
        t.gfx.drawRect(t.x - sz, t.y - sz, sz * 2, sz * 2);
        t.gfx.endFill();
        t.gfx.lineStyle(1.5, 0xffffff, 0.5);
        t.gfx.drawRect(t.x - sz, t.y - sz, sz * 2, sz * 2);
        t.gfx.lineStyle(1, 0xffffff, 0.3);
        t.gfx.moveTo(t.x, t.y);
        t.gfx.lineTo(t.x + t.nx * sz * 2.5, t.y + t.ny * sz * 2.5);
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
        const isUnit = !targetIsTurret && bestTarget.x != null && bestTarget.y != null && state.units.has(bestTarget.id);
        state.bullets.push({
          fromX: t.x, fromY: t.y, toX: bx, toY: by,
          x: t.x, y: t.y,
          speed: CFG.CITY_BULLET_SPEED * 0.4,
          hitR: 4,
          ownerId: t.owner,
          dmg,
          color: p.color,
          type: "ranged",
          aoe: true,
          maxDist: range * 1.5,
          traveled: 0,
          big: false,
          canHitTurrets: targetIsTurret,
          targetId: isUnit ? bestTarget.id : undefined,
          targetType: isUnit ? "unit" : undefined
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

  function stepPatrols(dt) {
    for (const p of state.players.values()) {
      if (p.eliminated || (p._patrolCount || 0) === 0) continue;
      const poly = p.influencePolygon;
      if (!poly || poly.length < 3) continue;
      if (!p._perimCache || p._perimCache.hash !== p._lastZoneHash) {
        p._perimCache = { hash: p._lastZoneHash, ...calcPerim(poly) };
      }
      const { segs, totalLen } = p._perimCache;
      if (totalLen < 1) continue;
      p._patrols = p._patrols || [];
      const rangeMul = p.turretRangeMul != null ? p.turretRangeMul : 1;
      const range = PATROL_ATTACK_R * rangeMul;
      const rate = (CFG.TURRET_ATTACK_RATE ?? 1.2) * (p.turretDmgMul != null ? 1 : 1);
      const dmgMul = (p.turretDmgMul != null ? p.turretDmgMul : 1) * getLevelBonusMul(p);
      const dmg = Math.max(1, Math.round(PATROL_DMG * dmgMul));
      for (const patrol of p._patrols) {
        const pos = getPolyPerimeterPoint(poly, segs, totalLen, patrol.t || 0);
        const nearby = queryHash(pos.x, pos.y, range);
        const enemies = nearby.filter(u => u.owner !== p.id);
        const hasEnemies = enemies.length > 0;
        if (!hasEnemies) {
          patrol.t = ((patrol.t || 0) + dt * PATROL_LIGHT_SPEED) % 1;
        }
        patrol.atkCd = (patrol.atkCd || 0) - dt;
        if (patrol.atkCd > 0 || !hasEnemies) continue;
        enemies.sort((a, b) => (a.x - pos.x) ** 2 + (a.y - pos.y) ** 2 - ((b.x - pos.x) ** 2 + (b.y - pos.y) ** 2));
        const targets = enemies.slice(0, 3);
        patrol.atkCd = 1 / rate;
        for (let shot = 0; shot < 2; shot++) {
          const tgt = targets[shot % targets.length];
          if (!tgt) continue;
          state.bullets.push({
            fromX: pos.x, fromY: pos.y, toX: tgt.x, toY: tgt.y,
            x: pos.x, y: pos.y,
            speed: (CFG.CITY_BULLET_SPEED ?? 280) * 0.35,
            hitR: 5,
            ownerId: p.id,
            dmg,
            color: p.color,
            type: "ranged",
            aoe: true,
            maxDist: range * 1.8,
            traveled: 0,
            big: false,
            canHitTurrets: false,
            targetId: tgt.id,
            targetType: "unit"
          });
        }
      }
    }
  }

  function drawShipShape(g, unitType, col, highlight) {
    const type = UNIT_TYPES[unitType] || UNIT_TYPES.fighter;
    const s = type.sizeMultiplier * 6 + 6;
    const fillCol = highlight || col;

    if (unitType === "fighter") {
      g.poly([s * 1.8, 0, -s * 0.8, -s * 0.7, -s * 0.4, 0, -s * 0.8, s * 0.7]);
      g.fill({ color: fillCol, alpha: 0.9 });
      g.moveTo(s * 1.8, 0); g.lineTo(-s * 0.1, 0);
      g.stroke({ color: 0xffffff, width: 0.8, alpha: 0.5 });
    } else if (unitType === "destroyer") {
      g.poly([s * 2, 0, -s * 0.6, -s * 0.9, -s * 0.9, -s * 0.3, -s * 0.9, s * 0.3, -s * 0.6, s * 0.9]);
      g.fill({ color: fillCol, alpha: 0.9 });
      g.moveTo(s * 2, 0); g.lineTo(-s * 0.2, 0);
      g.stroke({ color: 0xffffff, width: 1, alpha: 0.5 });
      g.moveTo(s * 0.6, -s * 0.5); g.lineTo(-s * 0.5, -s * 0.5);
      g.stroke({ color: 0xffffff, width: 0.7, alpha: 0.4 });
      g.moveTo(s * 0.6, s * 0.5); g.lineTo(-s * 0.5, s * 0.5);
      g.stroke({ color: 0xffffff, width: 0.7, alpha: 0.4 });
    } else if (unitType === "cruiser") {
      g.poly([s * 2, 0, s * 0.5, -s * 0.5, -s * 0.5, -s, -s, -s * 0.6, -s, s * 0.6, -s * 0.5, s, s * 0.5, s * 0.5]);
      g.fill({ color: fillCol, alpha: 0.9 });
      g.moveTo(s * 2, 0); g.lineTo(-s * 0.3, 0);
      g.stroke({ color: 0xffffff, width: 1.2, alpha: 0.5 });
      g.moveTo(0, -s * 0.7); g.lineTo(-s * 0.7, -s * 0.7);
      g.stroke({ color: 0xffffff, width: 0.8, alpha: 0.4 });
      g.moveTo(0, s * 0.7); g.lineTo(-s * 0.7, s * 0.7);
      g.stroke({ color: 0xffffff, width: 0.8, alpha: 0.4 });
    } else if (unitType === "battleship") {
      g.poly([s * 2.2, 0, s * 0.8, -s * 0.6, -s * 0.2, -s * 1.1, -s * 1.1, -s * 0.8, -s * 1.1, s * 0.8, -s * 0.2, s * 1.1, s * 0.8, s * 0.6]);
      g.fill({ color: fillCol, alpha: 0.9 });
      g.moveTo(s * 2.2, 0); g.lineTo(-s * 0.3, 0);
      g.stroke({ color: 0xffffff, width: 1.5, alpha: 0.5 });
      g.circle(0, 0, s * 0.25);
      g.fill({ color: 0xffffff, alpha: 0.3 });
    } else if (unitType === "hyperDestroyer") {
      g.poly([s * 2.5, 0, s * 1, -s * 0.5, s * 0.2, -s * 1.2, -s * 0.8, -s * 1, -s * 1.2, -s * 0.4,
              -s * 1.2, s * 0.4, -s * 0.8, s, s * 0.2, s * 1.2, s * 1, s * 0.5]);
      g.fill({ color: fillCol, alpha: 0.9 });
      g.moveTo(s * 2.5, 0); g.lineTo(-s * 0.4, 0);
      g.stroke({ color: 0xffffff, width: 1.8, alpha: 0.5 });
      g.circle(0, 0, s * 0.35);
      g.fill({ color: 0x66ccff, alpha: 0.5 });
      g.circle(s * 0.8, 0, s * 0.15);
      g.fill({ color: 0x66ccff, alpha: 0.4 });
    } else {
      g.poly([s * 2, 0, -s, -s, -s, s]);
      g.fill({ color: fillCol, alpha: 0.9 });
      g.moveTo(s * 2, 0); g.lineTo(-s * 0.3, 0);
      g.stroke({ color: 0xffffff, width: 1, alpha: 0.6 });
    }
  }

  function makeUnitVisual(u) {
    const col = u.color ?? colorForId(u.owner);
    u.color = col;
    const g = new PIXI.Graphics();
    drawShipShape(g, u.unitType || "fighter", col);

    const type = UNIT_TYPES[u.unitType] || UNIT_TYPES.fighter;
    const glowDist = Math.max(3, type.sizeMultiplier * 2 + 2);
    const glow = makeGlow(col, glowDist, 0.8);
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
        const spd = Math.hypot(u.vx || 0, u.vy || 0);
        if (spd > 2 && (vfc + u.id) % 2 === 0) {
          if (!u._trail) u._trail = [];
          u._trail.push({ x: u.x, y: u.y });
          if (u._trail.length > 10) u._trail.shift();
        } else if (spd <= 2 && u._trail) u._trail = [];
        const _tRot = Math.atan2(u.vy || 0, u.vx || 0);
        let _dRot = _tRot - u.gfx.rotation;
        while (_dRot > Math.PI) _dRot -= Math.PI * 2;
        while (_dRot < -Math.PI) _dRot += Math.PI * 2;
        const _ts = (u.unitType === "fighter" ? 8 : 3) * (state._lastDt || 0.016);
        u.gfx.rotation += Math.abs(_dRot) < _ts ? _dRot : Math.sign(_dRot) * _ts;
        if ((vfc + u.id) % 8 === 0) {
          const sel = state.selectedUnitIds.has(u.id);
          const flashing = u._hitFlashT != null && (state.t - u._hitFlashT) < 0.3;
          const col = flashing ? 0xff2222 : (sel ? 0xffffff : (u.color || 0x888888));
          u.gfx.clear();
          drawShipShape(u.gfx, u.unitType || "fighter", u.color || 0x888888, col);
        }
      }
    }
  }

  function updateShipTrails() {
    destroyChildren(shipTrailsLayer);
    const g = new PIXI.Graphics();
    for (const u of state.units.values()) {
      if (!u._trail || u._trail.length < 2 || !inView(u.x, u.y)) continue;
      const col = u.color ?? 0x888888;
      const n = u._trail.length;
      for (let i = 0; i < n - 1; i++) {
        const p = u._trail[i];
        const alpha = (i / n) * 0.25;
        const r = 2 + (i / n) * 2;
        g.beginFill(col, alpha);
        g.drawCircle(p.x, p.y, r);
        g.endFill();
      }
    }
    shipTrailsLayer.addChild(g);
  }

  function updateActivityZones() {
    destroyChildren(activityZoneLayer);
    const g = new PIXI.Graphics();
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
      const baseR = CFG.INFLUENCE_BASE_R || 240;
      const curR = p.influenceR || baseR;
      const s = Math.max(1, Math.min(2.5, curR / baseR));
      if (p.cityGfx) {
        p.cityGfx.position.set(p.x, p.y);
        p.cityGfx.scale.set(s);
      }
      if (p.popLabel) {
        const maxSh = p.shieldMaxHp || 1;
        const sh = Math.round(p.shieldHp || 0);
        const regen = (SHIELD_BASE_REGEN + (p.shieldRegenBonus || 0)).toFixed(1);
        if (sh <= 0 && (p.shieldRegenCd || 0) > 0) {
          const cd = Math.ceil(p.shieldRegenCd);
          p.popLabel.text = `${p.pop}\n💀 щит: ${cd}с`;
        } else {
          p.popLabel.text = `${p.pop}\n🛡 ${sh}/${Math.round(maxSh)}  +${regen}/с`;
        }
        p.popLabel.position.set(p.x, p.y + 27 * s + 4);
      }
      if (p.label) p.label.position.set(p.x, p.y - 27 * s - 4);
    }
  }

  function getSquads() {
    if (typeof SQUADLOGIC !== "undefined" && SQUADLOGIC.syncSquadsFromState) {
      SQUADLOGIC.syncSquadsFromState(state);
      return SQUADLOGIC.getSquadList(state)
        .map((squad) => SQUADLOGIC.getSquadUnits(state, squad))
        .filter((squad) => squad.length > 0);
    }
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
        const utL = UNIT_TYPES[u.unitType] || UNIT_TYPES.fighter;
        maxHp += u.maxHp || utL.hp;
        const unitDps = (u.dmg || utL.damage) * utL.attackRate;
        dps += unitDps;
        const mul = u._territoryMul ?? (() => { const zo = getZoneOwnerFast(u.x, u.y); return zo === u.owner ? 1.1 : (zo !== 0 && zo !== u.owner ? 0.9 : 1); })();
        effectiveHp += u.hp * mul;
        effectiveDps += unitDps * mul;
      }
      cx /= squad.length;
      cy /= squad.length;

      const owner = state.players.get(squad[0].owner);
      const col = owner ? owner.color : 0x888888;

      const maxAtkR = Math.max(...squad.map(u => getUnitAtkRange(u)));
      const maxEngR = Math.max(...squad.map(u => getUnitEngagementRange(u)));
      const spreadR = Math.max(0, ...squad.map(u => Math.hypot(u.x - cx, u.y - cy)));
      const findUnitAt = (px, py) => squad.reduce((b, u) => {
        const d = (u.x - px) ** 2 + (u.y - py) ** 2;
        return d < b.d ? { u, d } : b;
      }, { u: squad[0], d: Infinity }).u;

      const rg = new PIXI.Graphics();
      if (squad.length >= 3) {
        const hullPts = convexHull(squad.map(u => ({ x: u.x, y: u.y })));
        if (maxAtkR > 5 && hullPts.length >= 3) {
          const smoothPts = [];
          for (let hi = 0; hi < hullPts.length; hi++) {
            const hp = hullPts[hi];
            const hpNext = hullPts[(hi + 1) % hullPts.length];
            const r = getUnitAtkRange(findUnitAt(hp.x, hp.y));
            const rNext = getUnitAtkRange(findUnitAt(hpNext.x, hpNext.y));
            smoothPts.push({ x: hp.x, y: hp.y, r });
            const mx = (hp.x + hpNext.x) / 2, my = (hp.y + hpNext.y) / 2;
            smoothPts.push({ x: mx, y: my, r: (r + rNext) / 2 });
          }
          rg.lineStyle(2, col, 0.4);
          rg.beginFill(col, 0.08);
          for (let i = 0; i < smoothPts.length; i++) {
            const p = smoothPts[i];
            const dx = p.x - cx, dy = p.y - cy;
            const dl = Math.hypot(dx, dy) || 1;
            const ox = p.x + (dx / dl) * p.r, oy = p.y + (dy / dl) * p.r;
            if (i === 0) rg.moveTo(ox, oy);
            else rg.lineTo(ox, oy);
          }
          rg.closePath();
          rg.endFill();

          if (maxEngR < maxAtkR - 1) {
            const engSmooth = [];
            for (let hi = 0; hi < hullPts.length; hi++) {
              const hp = hullPts[hi];
              const hpNext = hullPts[(hi + 1) % hullPts.length];
              const r = getUnitEngagementRange(findUnitAt(hp.x, hp.y));
              const rNext = getUnitEngagementRange(findUnitAt(hpNext.x, hpNext.y));
              engSmooth.push({ x: hp.x, y: hp.y, r });
              const mx = (hp.x + hpNext.x) / 2, my = (hp.y + hpNext.y) / 2;
              engSmooth.push({ x: mx, y: my, r: (r + rNext) / 2 });
            }
            rg.lineStyle(1.5, 0xff8800, 0.35);
            rg.beginFill(0xff8800, 0.03);
            for (let i = 0; i < engSmooth.length; i++) {
              const p = engSmooth[i];
              const dx = p.x - cx, dy = p.y - cy;
              const dl = Math.hypot(dx, dy) || 1;
              const ox = p.x + (dx / dl) * p.r, oy = p.y + (dy / dl) * p.r;
              if (i === 0) rg.moveTo(ox, oy); else rg.lineTo(ox, oy);
            }
            rg.closePath();
            rg.endFill();
          }
        }
      } else {
        rg.lineStyle(2, col, 0.4);
        rg.beginFill(col, 0.08);
        rg.drawCircle(cx, cy, spreadR + maxAtkR);
        rg.endFill();

        if (maxEngR < maxAtkR - 1) {
          rg.lineStyle(1.5, 0xff8800, 0.35);
          rg.beginFill(0xff8800, 0.03);
          rg.drawCircle(cx, cy, spreadR + maxEngR);
          rg.endFill();
        }
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

  function squadsTouch(a, b) {
    for (const u of a) {
      const uType = UNIT_TYPES[u.unitType] || UNIT_TYPES.fighter;
      const engageR = uType.attackRange * 0.5;
      for (const v of b) {
        const vType = UNIT_TYPES[v.unitType] || UNIT_TYPES.fighter;
        const vEngageR = vType.attackRange * 0.5;
        const maxR = Math.max(engageR, vEngageR);
        if (dist2(u.x, u.y, v.x, v.y) <= maxR * maxR) return true;
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

  function isUnitInCombat(u) {
    const cs = u._combatState;
    return cs === "acquire" || cs === "chase" || cs === "attack" || cs === "siege";
  }
  // ^ helper used inline at multiple call sites

  const CLUSTER_SPACING = 11;

  // buildBattleCache removed — orbit uses engagement anchor from combat.js

  // findNearestEnemy and getUnitFrontSlot removed — dead code after persistentBattles cleanup

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
    if (typeof SQUADLOGIC !== "undefined") {
      if (state.selectedUnitIds.size > 0 && state._hoverTarget && state._hoverWorld) {
        const ht = state._hoverTarget;
        let enemyCx, enemyCy, enemyHp = 0;
        const me = state.players.get(state.myPlayerId);
        const myColor = me ? me.color : 0x4488ff;
        if (ht.x != null && ht.y != null) {
          enemyCx = ht.x;
          enemyCy = ht.y;
          for (const u of state.units.values()) {
            if (u.owner !== state.myPlayerId && Math.hypot(u.x - enemyCx, u.y - enemyCy) <= FORCE_PREVIEW_RADIUS) enemyHp += u.hp;
          }
        }
        let myTotal = 0;
        for (const id of state.selectedUnitIds) {
          const u = state.units.get(id);
          if (u) myTotal += u.hp;
        }
        if (enemyCx != null && (myTotal > 0 || enemyHp > 0)) {
          state._forcePreview = { enemyCx, enemyCy, myHp: myTotal, enemyHp, myColor, enemyColor: ht.color || 0xcc2222 };
        }
      }

      const zones = SQUADLOGIC.getZoneList(state);
      const zoneArr = [...zones];
      const mergedPairs = [];
      for (let i = 0; i < zoneArr.length; i++) {
        for (let j = i + 1; j < zoneArr.length; j++) {
          const za = zoneArr[i], zb = zoneArr[j];
          const dist = Math.hypot(za.anchorX - zb.anchorX, za.anchorY - zb.anchorY);
          if (dist < (za.displayRadius || za.radius || 70) + (zb.displayRadius || zb.radius || 70)) {
            mergedPairs.push([i, j]);
          }
        }
      }

      const mergedIndices = new Set();
      for (const [i, j] of mergedPairs) { mergedIndices.add(i); mergedIndices.add(j); }

      const pulse = 0.25 + 0.15 * Math.sin(state.t * 2.5);
      const dashPhase = (state.t * 40) % 24;

      function drawZoneDashedCircle(gfx, cx, cy, r, otherZones) {
        const steps = 96;
        let inSeg = false;
        let sx = 0, sy = 0;
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          const px = cx + Math.cos(a) * r;
          const py = cy + Math.sin(a) * r;
          let inside = false;
          for (const oz of otherZones) {
            const or = oz.displayRadius || oz.radius || 70;
            if (Math.hypot(px - oz.anchorX, py - oz.anchorY) < or - 2) { inside = true; break; }
          }
          if (!inside) {
            if (!inSeg) { sx = px; sy = py; inSeg = true; gfx.moveTo(px, py); }
            else gfx.lineTo(px, py);
          } else {
            inSeg = false;
          }
        }
      }

      for (let zi = 0; zi < zoneArr.length; zi++) {
        const zone = zoneArr[zi];
        const cx = zone.anchorX;
        const cy = zone.anchorY;
        const r = zone.displayRadius || zone.radius || 70;

        const others = [];
        if (mergedIndices.has(zi)) {
          for (const [a, b] of mergedPairs) {
            if (a === zi) others.push(zoneArr[b]);
            if (b === zi) others.push(zoneArr[a]);
          }
        }

        const ring = new PIXI.Graphics();
        if (others.length > 0) {
          drawZoneDashedCircle(ring, cx, cy, r, others);
        } else {
          const segments = 48;
          for (let i = 0; i < segments; i++) {
            const a0 = (i / segments) * Math.PI * 2;
            const a1 = ((i + 0.5) / segments) * Math.PI * 2;
            ring.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
            ring.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
          }
        }
        ring.stroke({ color: 0xff2222, width: 2.5, alpha: pulse });

        const glow = new PIXI.Graphics();
        if (others.length > 0) {
          drawZoneDashedCircle(glow, cx, cy, r, others);
        } else {
          glow.circle(cx, cy, r);
        }
        glow.stroke({ color: 0xff0000, width: 6, alpha: pulse * 0.3 });
        combatLayer.addChild(glow);
        combatLayer.addChild(ring);

        const zoneAge = state.t - (zone.createdAt || 0);
        if (zoneAge < 1.0) {
          const flashAlpha = (1.0 - zoneAge) * 0.35;
          const flash = new PIXI.Graphics();
          flash.circle(cx, cy, r * 1.1);
          flash.fill({ color: 0xff4400, alpha: flashAlpha });
          combatLayer.addChild(flash);
        }
      }

      for (const zone of zones) {
        const factions = (zone.balanceSegments || []).filter(seg => seg.power > 0);
        const cx = zone.anchorX;
        const cy = zone.anchorY;
        const r = zone.displayRadius || zone.radius || 70;

        if (!factions.length) continue;
        const totalPower = factions.reduce((sum, seg) => sum + seg.power, 0) || 1;
        const barW = Math.min(260, Math.max(150, r * 1.3));
        const barH = 16;
        const lift = r + 30;

        const icon = new PIXI.Text({ text: "⚔", style: { fontSize: 36, fill: 0xffffff, fontWeight: "bold", stroke: { color: 0x000000, width: 4 } } });
        icon.anchor.set(0.5, 1);
        icon.position.set(cx, cy - lift);
        combatLayer.addChild(icon);

        const barBg = new PIXI.Graphics();
        barBg.roundRect(cx - barW / 2, cy - lift + 12, barW, barH, 4);
        barBg.fill({ color: 0x111111, alpha: 0.85 });
        barBg.stroke({ color: 0xffffff, width: 2, alpha: 0.45 });
        combatLayer.addChild(barBg);

        let barOffset = 0;
        for (const seg of factions) {
          const pct = seg.power / totalPower;
          const segW = barW * pct;
          const owner = state.players.get(seg.ownerId);
          const color = owner ? owner.color : 0x888888;
          const fill = new PIXI.Graphics();
          fill.rect(cx - barW / 2 + barOffset, cy - lift + 12, segW, barH);
          fill.fill({ color, alpha: 1 });
          combatLayer.addChild(fill);
          barOffset += segW;
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
      }
      if (state.floatingDamage.length > 36) state.floatingDamage.splice(0, state.floatingDamage.length - 36);
      return;
    }
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
      if (!aAlive || !bAlive) {
        if (pb._unlockAt == null) pb._unlockAt = state.t + 5;
        if (state.t < pb._unlockAt) continue;
        delete state.persistentBattles[k];
        continue;
      }
      pb._unlockAt = null;

      let anyClose = false;
      const aList = pb.aIds instanceof Set ? [...pb.aIds] : Object.keys(pb.aIds).map(Number);
      const bList = pb.bIds instanceof Set ? [...pb.bIds] : Object.keys(pb.bIds).map(Number);
      outer: for (const aid of aList) {
        const au = state.units.get(aid);
        if (!au) continue;
        const disR = getUnitAtkRange(au) * 1.5;
        const disR2 = disR * disR;
        for (const bid of bList) {
          const bu = state.units.get(bid);
          if (!bu) continue;
          if ((au.x - bu.x) ** 2 + (au.y - bu.y) ** 2 <= disR2) { anyClose = true; break outer; }
        }
      }
      if (!anyClose) delete state.persistentBattles[k];
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
    const attackTargets = new Set();
    for (const sq of squads) {
      const leader = sq.find(v => !v.leaderId) || sq[0];
      if (leader.chaseTargetUnitId != null) attackTargets.add("u:" + leader.chaseTargetUnitId);
      if (leader.chaseTargetCityId != null) attackTargets.add("c:" + leader.chaseTargetCityId);
    }
    const pulse = 0.4 + 0.35 * Math.sin(performance.now() / 250);
    for (const key of attackTargets) {
      const tg = new PIXI.Graphics();
      if (key.startsWith("u:")) {
        const tu = state.units.get(parseInt(key.slice(2)));
        if (tu && tu.hp > 0) {
          const r = getUnitHitRadius(tu) + 10;
          tg.circle(tu.x, tu.y, r);
          tg.stroke({ color: 0xff2222, width: 2.5, alpha: pulse });
          tg.circle(tu.x, tu.y, r + 4);
          tg.stroke({ color: 0xff4444, width: 1, alpha: pulse * 0.4 });
        }
      } else {
        const cid = parseInt(key.slice(2));
        const tc = state.players.get(cid);
        if (tc && !tc.eliminated) {
          const r = getPlanetRadius(tc) + 8;
          tg.circle(tc.x, tc.y, r);
          tg.stroke({ color: 0xff2222, width: 3, alpha: pulse });
          tg.circle(tc.x, tc.y, r + 5);
          tg.stroke({ color: 0xff4444, width: 1.5, alpha: pulse * 0.4 });
        }
      }
      selectionBoxLayer.addChild(tg);
    }
  }

  function updatePathPreview() {
    destroyChildren(pathPreviewLayer);
    const me = state.players.get(state.myPlayerId);
    const order = state.orderPreview;
    if (order && order.type === "move" && state.formationPreview) {
      const fp = state.formationPreview;
      const squads = getSelectedSquads();
      const cosA = Math.cos(fp.angle);
      const sinA = Math.sin(fp.angle);
      for (const squad of squads) {
        const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
        const formationType = leader.formationType || "line";
        const formationRows = fp.dragRows != null ? fp.dragRows : (leader.formationRows || 3);
        const pigW = fp.dragWidth != null ? fp.dragWidth : (leader.formationPigWidth ?? 1);

        let offsets;
        if (typeof FORMATIONS !== "undefined" && FORMATIONS.getFormationOffsets) {
          const unitTypes = squad.map(u => u.unitType || "fighter");
          offsets = FORMATIONS.getFormationOffsets(unitTypes, formationType, formationRows, fp.angle, pigW);
        } else {
          offsets = getFormationOffsets(squad.length, formationType, formationRows, cosA, sinA, pigW, squad);
        }

        let sqcx = 0, sqcy = 0;
        for (const u of squad) { sqcx += u.x; sqcy += u.y; }
        sqcx /= squad.length; sqcy /= squad.length;
        const dashLine = new PIXI.Graphics();
        dashLine.lineStyle(2.5, 0x66aaff, 0.45);
        drawDashedSegment(dashLine, sqcx, sqcy, fp.x, fp.y, 10, 7);
        pathPreviewLayer.addChild(dashLine);

        for (let i = 0; i < offsets.length; i++) {
          const o = offsets[i] || { x: 0, y: 0 };
          const u = squad[i] || squad[0];
          const unitType = u.unitType || "fighter";
          const uHitR = getUnitHitRadius(u);
          const ghostG = new PIXI.Graphics();
          drawShipShape(ghostG, unitType, 0xffffff, 0xffffff);
          ghostG.alpha = 0.3;
          ghostG.position.set(fp.x + o.x, fp.y + o.y);
          ghostG.rotation = fp.angle;
          ghostG.circle(0, 0, uHitR);
          ghostG.stroke({ color: 0xffffff, width: 1, alpha: 0.15 });
          pathPreviewLayer.addChild(ghostG);
        }
      }
    } else if (order && (order.type === "attackUnit" || order.type === "attackCity" || order.type === "attackPirateBase" || order.type === "capture")) {
      const squads = getSelectedSquads();
      let scx = 0, scy = 0, scnt = 0;
      for (const sq of squads) for (const u of sq) { scx += u.x; scy += u.y; scnt++; }
      if (scnt) { scx /= scnt; scy /= scnt; }

      let tx = order.x, ty = order.y;
      let highlightColor = 0xff3333;
      let highlightR = 20;

      if (order.type === "attackUnit") {
        const target = state.units.get(order.targetUnitId);
        if (target) { tx = target.x; ty = target.y; highlightR = getUnitHitRadius(target) + 8; }
      } else if (order.type === "attackCity") {
        const city = state.players.get(order.targetCityId);
        if (city) { tx = city.x; ty = city.y; highlightR = shieldRadius(city) + 12; }
      } else if (order.type === "attackPirateBase" && state.pirateBase) {
        tx = state.pirateBase.x; ty = state.pirateBase.y; highlightR = 40;
      } else if (order.type === "capture") {
        highlightColor = 0x33aaff; highlightR = 28;
      }

      const dashG = new PIXI.Graphics();
      dashG.lineStyle(3, highlightColor, 0.65);
      drawDashedSegment(dashG, scx, scy, tx, ty, 12, 8);
      pathPreviewLayer.addChild(dashG);

      const g = new PIXI.Graphics();
      const pulse = 0.8 + Math.sin(performance.now() * 0.006) * 0.2;
      g.circle(tx, ty, highlightR * pulse);
      g.stroke({ color: highlightColor, width: 2.5, alpha: 0.7 });
      g.circle(tx, ty, 4);
      g.fill({ color: highlightColor, alpha: 0.6 });
      pathPreviewLayer.addChild(g);
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
      const leader = squad.find(u => !u.leaderId) || squad[0];
      const isAttack = leader.chaseTargetUnitId != null || leader.chaseTargetCityId != null || leader._orderType === "attackUnit" || leader._orderType === "siege";

      if (isAttack) {
        let targetPos = null;
        if (leader.chaseTargetUnitId != null) {
          let tu = state.units.get(leader.chaseTargetUnitId);
          if (!tu || tu.hp <= 0) {
            tu = null;
            const deadTarget = state.units.get(leader.chaseTargetUnitId);
            const targetSquadId = deadTarget ? deadTarget.squadId : null;
            if (targetSquadId != null) {
              const tSq = state.squads.get(targetSquadId);
              if (tSq) {
                for (const uid of tSq.unitIds) {
                  const su = state.units.get(uid);
                  if (su && su.hp > 0) { tu = su; break; }
                }
              }
            }
          }
          if (tu) targetPos = { x: tu.x, y: tu.y };
        } else if (leader.chaseTargetCityId != null) {
          const city = state.players.get(leader.chaseTargetCityId);
          if (city) targetPos = { x: city.x, y: city.y };
          if (!targetPos && state.pirateBase && state.pirateBase.hp > 0) targetPos = { x: state.pirateBase.x, y: state.pirateBase.y };
        }
        if (targetPos) {
          const atkPts = [{ x: leader.x, y: leader.y }, targetPos];
          const ag = new PIXI.Graphics();
          for (let seg = 0; seg < atkPts.length - 1; seg++) {
            ag.lineStyle(7, 0x000000, 0.65);
            ag.moveTo(atkPts[seg].x, atkPts[seg].y);
            ag.lineTo(atkPts[seg + 1].x, atkPts[seg + 1].y);
            ag.lineStyle(5, 0xff3333, 0.95);
            ag.moveTo(atkPts[seg].x, atkPts[seg].y);
            ag.lineTo(atkPts[seg + 1].x, atkPts[seg + 1].y);
          }
          drawAnimatedDash(ag, atkPts, 14, 6, 2.5, 0xffaaaa, 0.85, t);
          ag.lineStyle(3, 0xff3333, 1);
          ag.beginFill(0xff3333, 0.5);
          ag.drawCircle(targetPos.x, targetPos.y, 14);
          ag.endFill();
          pathPreviewLayer.addChild(ag);
        }
        continue;
      }

      const wp = leader.waypoints;
      const idx = leader.waypointIndex ?? 0;
      if (!wp || idx >= wp.length) continue;

      const isCapture = leader._captureTarget === true;
      const ownerP = state.players.get(leader.owner);
      const color = isCapture ? 0x33aaff : (ownerP ? ownerP.color : 0xffffff);

      const points = [{ x: leader.x, y: leader.y }];
      for (let i = idx; i < wp.length; i++) points.push(wp[i]);

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
      if (isCapture) {
        g.lineStyle(3, 0x33aaff, 1);
        g.beginFill(0x33aaff, 0.35);
        g.drawCircle(lastPt.x, lastPt.y, 18);
        g.endFill();
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

  const abilityAnnouncementLineEl = document.getElementById("abilityAnnouncementLine");
  function updateAbilityAnnouncements(dt) {
    if (!state._abilityAnnouncements || state._abilityAnnouncements.length === 0) {
      announcementLayer.removeChildren();
      if (abilityAnnouncementLineEl) {
        abilityAnnouncementLineEl.textContent = "";
        abilityAnnouncementLineEl.classList.remove("visible");
      }
      return;
    }
    const w = app.renderer.width;
    announcementLayer.removeChildren();
    let latest = null;
    for (let i = state._abilityAnnouncements.length - 1; i >= 0; i--) {
      const a = state._abilityAnnouncements[i];
      a.ttl = (a.ttl != null ? a.ttl : 4.5) - dt;
      if (a.ttl <= 0) {
        state._abilityAnnouncements.splice(i, 1);
        continue;
      }
      if (!latest) latest = a;
      const txt = new PIXI.Text(a.text, { fontSize: 15, fill: 0xeeeeff, fontWeight: "bold", fontFamily: "Arial" });
      txt.anchor.set(0.5, 0);
      txt.position.set(w / 2, 42 + (state._abilityAnnouncements.length - 1 - i) * 24);
      txt.alpha = Math.min(1, a.ttl);
      announcementLayer.addChild(txt);
    }
    if (abilityAnnouncementLineEl && latest) {
      abilityAnnouncementLineEl.textContent = latest.text;
      abilityAnnouncementLineEl.classList.add("visible");
    }
    while (state._abilityAnnouncements.length > 8) state._abilityAnnouncements.shift();
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
    leaderboardBody.onclick = (e) => {
      const tr = e.target.closest("tr");
      if (!tr || !tr.dataset.pid) return;
      showEnemyCompare(tr.dataset.pid);
    };
    const totalArea = CFG.WORLD_W * CFG.WORLD_H;
    const rows = [];
    for (const p of state.players.values()) {
      const area = polygonArea(p.influencePolygon);
      const pct = totalArea > 0 ? (area / totalArea * 100) : 0;
      rows.push({ id: p.id, name: p.name, pop: p.pop, pct });
    }
    rows.sort((a, b) => b.pop - a.pop);
    leaderboardBody.innerHTML = rows.map((r, i) =>
      `<tr data-pid="${r.id}" style="cursor:pointer"><td>${i + 1}</td><td>${r.name}</td><td>${r.pop}</td><td>${r.pct.toFixed(2)}%</td></tr>`
    ).join("");
  }

  function makeResVisual(r) {
    if (r.type === "credit") {
      const val = r.value || 1;
      const fontSize = Math.min(36, Math.max(14, 8 + val * 0.8));
      const g = new PIXI.Container();
      const txt = new PIXI.Text({ text: "€", style: { fontSize, fill: 0xffdd44, fontWeight: "bold", fontFamily: "Arial" } });
      txt.anchor.set(0.5);
      g.addChild(txt);
      if (val >= 15 && makeGlow) {
        const glow = makeGlow(0xffdd44, 12, 2);
        if (glow) g.filters = [glow];
      }
      g.position.set(r.x, r.y);
      resLayer.addChild(g);
      r.gfx = g;
      return;
    }
    const g = new PIXI.Graphics();
    const xpVal = r.xp || 1;
    const col = gemColorForValue(Math.min(10, xpVal));
    r.color = col;
    const sz = gemSizeForValue(Math.min(10, xpVal));
    const shape = Math.floor(Math.random() * 5);

    if (xpVal >= 10) {
      g.poly([0, -sz, sz * 0.6, -sz * 0.2, sz * 0.9, 0, sz * 0.5, sz * 0.7, 0, sz, -sz * 0.5, sz * 0.7, -sz * 0.9, 0, -sz * 0.6, -sz * 0.2]);
      g.fill({ color: col, alpha: 0.95 });
      g.circle(0, 0, sz * 0.25);
      g.fill({ color: 0xffffff, alpha: 0.35 });
    } else if (shape === 0) {
      g.poly([0, -sz, sz * 0.6, -sz * 0.2, sz * 0.4, sz * 0.8, -sz * 0.4, sz * 0.8, -sz * 0.6, -sz * 0.2]);
      g.fill({ color: col, alpha: 0.95 });
    } else if (shape === 1) {
      g.poly([0, -sz, sz * 0.7, 0, 0, sz, -sz * 0.7, 0]);
      g.fill({ color: col, alpha: 0.95 });
    } else if (shape === 2) {
      g.poly([sz * 0.3, -sz, sz * 0.8, -sz * 0.3, sz * 0.5, sz * 0.6, -sz * 0.5, sz * 0.6, -sz * 0.8, -sz * 0.3, -sz * 0.3, -sz]);
      g.fill({ color: col, alpha: 0.95 });
    } else if (shape === 3) {
      g.poly([0, -sz, sz * 0.5, -sz * 0.5, sz * 0.3, sz * 0.3, 0, sz * 0.9, -sz * 0.3, sz * 0.3, -sz * 0.5, -sz * 0.5]);
      g.fill({ color: col, alpha: 0.95 });
    } else {
      g.poly([0, -sz * 0.9, sz * 0.8, -sz * 0.3, sz * 0.6, sz * 0.7, -sz * 0.6, sz * 0.7, -sz * 0.8, -sz * 0.3]);
      g.fill({ color: col, alpha: 0.95 });
    }
    g.moveTo(-sz * 0.15, -sz * 0.6);
    g.lineTo(sz * 0.1, -sz * 0.25);
    g.stroke({ color: 0xffffff, width: 0.8, alpha: 0.5 });

    const glowDist = xpVal >= 10 ? 14 : (xpVal >= 5 ? 9 : 5);
    const glow = makeGlow(col, glowDist, xpVal >= 10 ? 2.5 : 1.5);
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
  // ── Fixed spawn positions (equidistant around center) ──
  function getFixedSpawnPositions(count) {
    const cx = CFG.WORLD_W * 0.5, cy = CFG.WORLD_H * 0.5;
    const radius = Math.min(CFG.WORLD_W, CFG.WORLD_H) * 0.38;
    const out = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      out.push({
        x: clamp(cx + Math.cos(angle) * radius, CFG.WORLD_W * 0.08, CFG.WORLD_W * 0.92),
        y: clamp(cy + Math.sin(angle) * radius, CFG.WORLD_H * 0.08, CFG.WORLD_H * 0.92)
      });
    }
    return out;
  }

  // ── Mine placement ──
  let nextMineId = 1;
  function createMine(x, y, ownerId, isRich) {
    const id = nextMineId++;
    const mine = {
      id, x, y,
      ownerId: ownerId || null,
      captureProgress: ownerId ? 1 : 0,
      capturingUnitId: null,
      isRich: !!isRich,
      yieldAcc: 0,
      gfx: null
    };
    state.mines.set(id, mine);
    makeMineVisual(mine);
    return mine;
  }

  function placeMines(entries, rndFn) {
    state.mines.clear();
    nextMineId = 1;
    const cx = CFG.WORLD_W * 0.5, cy = CFG.WORLD_H * 0.5;

    const centerMine = createMine(cx, cy, null, true);
    const pirateBaseOffset = 160;
    state.pirateBase = {
      x: cx + pirateBaseOffset, y: cy, hp: 4000, maxHp: 4000, lastDamagedBy: null,
      gfx: null, _emojiGfx: null, spawnCd: 0, unitLimit: 12,
      orbitCenter: { x: cx, y: cy }, orbitRadius: pirateBaseOffset + 40,
      _respawnTimer: 0, _initialSpawned: false
    };
    centerMine.ownerId = PIRATE_OWNER_ID;
    centerMine.captureProgress = 1;
    centerMine._captureProtectedUntil = 0;
    updateMineVisual(centerMine);

    const inflR = CFG.INFLUENCE_R(CFG.POP_START);
    const r = rndFn || (() => Math.random());
    for (const entry of entries) {
      const sp = entry.pos;
      const pid = entry.ownerId;
      for (let m = 0; m < CFG.MINE_START_PER_PLAYER; m++) {
        const baseAngle = Math.atan2(sp.y - cy, sp.x - cx);
        const spread = ((m - (CFG.MINE_START_PER_PLAYER - 1) / 2) / Math.max(1, CFG.MINE_START_PER_PLAYER - 1)) * 1.2;
        const a = baseAngle + spread + (r() * 0.15);
        const d = inflR * 0.85 + r() * (inflR * 0.1);
        createMine(
          clamp(sp.x + Math.cos(a) * d, 40, CFG.WORLD_W - 40),
          clamp(sp.y + Math.sin(a) * d, 40, CFG.WORLD_H - 40),
          pid, false
        );
      }
      for (let m = 0; m < CFG.MINE_NEUTRAL_PER_PLAYER; m++) {
        const baseAngle = Math.atan2(sp.y - cy, sp.x - cx);
        const spread = ((m - (CFG.MINE_NEUTRAL_PER_PLAYER - 1) / 2) / Math.max(1, CFG.MINE_NEUTRAL_PER_PLAYER - 1)) * 1.5;
        const a = baseAngle + spread + Math.PI + (r() * 0.2);
        const d = inflR * 1.2 + r() * (inflR * 0.3);
        createMine(
          clamp(sp.x + Math.cos(a) * d, 40, CFG.WORLD_W - 40),
          clamp(sp.y + Math.sin(a) * d, 40, CFG.WORLD_H - 40),
          null, false
        );
      }
    }
  }

  function makeMineVisual(mine) {
    if (mine.gfx) { mine.gfx.destroy(true); mine.gfx = null; }
    const c = new PIXI.Container();
    const R = (mine.isRich ? 36 : 28) * 2;
    const ownerCol = mine.ownerId ? colorForId(mine.ownerId) : 0x555555;

    const outerGlow = new PIXI.Graphics();
    outerGlow.circle(0, 0, R + 12);
    outerGlow.fill({ color: mine.ownerId ? ownerCol : 0x333344, alpha: mine.ownerId ? 0.15 : 0.08 });
    c.addChild(outerGlow);

    const bg = new PIXI.Graphics();
    bg.rect(-R, -R, R * 2, R * 2);
    bg.fill({ color: 0x111118, alpha: 0.9 });
    bg.stroke({ color: mine.ownerId ? ownerCol : 0x666688, width: 3 });
    c.addChild(bg);

    const innerCircle = new PIXI.Graphics();
    innerCircle.circle(0, 0, R * 0.55);
    innerCircle.fill({ color: mine.isRich ? 0xffcc00 : (mine.ownerId ? ownerCol : 0x888899), alpha: 0.5 });
    innerCircle.stroke({ color: mine.isRich ? 0xffaa00 : 0x999999, width: 2 });
    c.addChild(innerCircle);

    if (mine.isRich) {
      const sparkle = new PIXI.Graphics();
      sparkle.circle(0, 0, R * 0.25);
      sparkle.fill({ color: 0xffee88, alpha: 0.35 });
      c.addChild(sparkle);
    }

    const icon = new PIXI.Text({
      text: mine.isRich ? "💎" : "⛏️",
      style: { fontSize: mine.isRich ? 40 : 32 }
    });
    icon.anchor.set(0.5);
    icon.y = -1;
    c.addChild(icon);

    const captureR = CFG.MINE_CAPTURE_RADIUS || 140;
    const capRing = new PIXI.Graphics();
    capRing.circle(0, 0, captureR);
    capRing.stroke({ color: mine.ownerId ? ownerCol : 0x556688, width: 1.5, alpha: 0.25 });
    capRing.circle(0, 0, captureR);
    capRing.fill({ color: mine.ownerId ? ownerCol : 0x334466, alpha: 0.04 });
    c.addChildAt(capRing, 0);

    if (mine.ownerId && mine.captureProgress >= 1) {
      const ownerGlow = new PIXI.Graphics();
      ownerGlow.circle(0, 0, R * 0.8);
      ownerGlow.fill({ color: ownerCol, alpha: 0.18 });
      c.addChildAt(ownerGlow, 0);

      const flag = new PIXI.Text({ text: "🚩", style: { fontSize: 12 } });
      flag.anchor.set(0.5);
      flag.position.set(R * 0.7, -R * 0.7);
      c.addChild(flag);
    }

    c.x = mine.x;
    c.y = mine.y;
    mine.gfx = c;
    resLayer.addChild(c);
  }

  function updateMineVisual(mine) {
    makeMineVisual(mine);
  }

  // ── Mine step: capture + yield ──
  function stepMines(dt) {
    for (const mine of state.mines.values()) {
      const ownersInRadius = new Map();
      for (const u of state.units.values()) {
        if (Math.hypot(u.x - mine.x, u.y - mine.y) <= CFG.MINE_CAPTURE_RADIUS) {
          if (mine.ownerId && u.owner === mine.ownerId) continue;
          ownersInRadius.set(u.owner, (ownersInRadius.get(u.owner) || 0) + 1);
        }
      }
      const ownerIds = [...ownersInRadius.keys()];
      const contested = ownerIds.length > 1;
      const unitInRadiusOwner = ownerIds.length === 1 ? ownerIds[0] : null;
      const unitInRadius = unitInRadiusOwner != null;

      const protected_ = (mine._captureProtectedUntil != null) && state.t < mine._captureProtectedUntil;
      mine._contested = contested;
      if (contested) {
        mine._capturingOwner = null;
      }
      if (!protected_ && !contested && unitInRadius && mine.ownerId !== unitInRadiusOwner) {
        if (mine.ownerId && mine.captureProgress >= 1) {
          mine.captureProgress = Math.max(0, mine.captureProgress - dt / CFG.MINE_CAPTURE_TIME);
          if (mine.captureProgress <= 0) {
            mine.ownerId = null;
            mine.captureProgress = 0;
            mine._capturingOwner = unitInRadiusOwner;
            updateMineVisual(mine);
          }
        } else {
          mine._capturingOwner = unitInRadiusOwner;
          mine.captureProgress = Math.min(1, mine.captureProgress + dt / CFG.MINE_CAPTURE_TIME);
          if (mine.captureProgress >= 1) {
            mine.ownerId = unitInRadiusOwner;
            mine.captureProgress = 1;
            mine._capturingOwner = null;
            mine._captureProtectedUntil = state.t + (CFG.MINE_CAPTURE_PROTECTION || 5);
            updateMineVisual(mine);
          }
        }
      } else if (!protected_ && !contested && !unitInRadius && !mine.ownerId && mine.captureProgress > 0) {
        mine.captureProgress = Math.max(0, mine.captureProgress - dt / (CFG.MINE_CAPTURE_TIME * 2));
        if (mine.captureProgress <= 0) mine._capturingOwner = null;
      }

      if (mine.ownerId && mine.captureProgress >= 1) {
        const owner = state.players.get(mine.ownerId);
        if (!owner || owner.pop <= 0) { mine.ownerId = null; mine.captureProgress = 0; updateMineVisual(mine); continue; }

        const maxGems = CFG.MINE_MAX_GEMS || 10;
        let activeGems = 0;
        for (const gm of state.mineGems) {
          if (gm.alive && gm._mineId === mine.id) activeGems++;
        }

        const totalVal = (CFG.MINE_BASE_YIELD_VALUE * 0.7 + (owner.mineYieldBonus || 0)) * (mine.isRich ? CFG.MINE_RICH_MULTIPLIER : 1);
        const spawnInterval = Math.max(0.5, 2.5 - totalVal * 0.15);
        mine.yieldAcc += dt;
        while (mine.yieldAcc >= spawnInterval) {
          mine.yieldAcc -= spawnInterval;
          const batchVal = totalVal * spawnInterval;
          if (activeGems >= maxGems) {
            const oldest = state.mineGems.find(g => g.alive && g._mineId === mine.id);
            if (oldest) oldest.value += batchVal;
          } else {
            const isCredit = Math.random() < 0.45;
            const variedVal = batchVal * (0.6 + Math.random() * 0.8);
            spawnMineGem(mine, owner, variedVal, isCredit);
            activeGems++;
          }
        }
      }

      if (mine.gfx) updateMineProgressBar(mine);
    }

    if (state.pirateBase && state.pirateBase.hp > 0) {
      const PIRATE_RESPAWN_CD = 180;
      let pirateCount = 0;
      for (const u of state.units.values()) if (u.owner === PIRATE_OWNER_ID && !(u._pirateHyperUntil && state.t < u._pirateHyperUntil)) pirateCount++;

      if (state.pirateBase._respawnTimer == null) state.pirateBase._respawnTimer = 0;

      const needsInitialSpawn = !state.pirateBase._initialSpawned && pirateCount === 0;

      if (pirateCount === 0) {
        if (needsInitialSpawn) {
          state.pirateBase._respawnTimer = 0;
        } else if (state.pirateBase._respawnTimer <= 0) {
          state.pirateBase._respawnTimer = PIRATE_RESPAWN_CD;
        }

        if (!needsInitialSpawn) state.pirateBase._respawnTimer -= dt;

        if (needsInitialSpawn || state.pirateBase._respawnTimer <= 0) {
          state.pirateBase._respawnTimer = 0;
          state.pirateBase._initialSpawned = true;
          const oc = state.pirateBase.orbitCenter || { x: state.pirateBase.x, y: state.pirateBase.y };
          const oR = state.pirateBase.orbitRadius || 200;
          const batchTag = `pirate-base-${Math.floor(state.t)}`;
          for (let i = 0; i < PIRATE_FULL_SQUAD.length; i++) {
            const t = PIRATE_FULL_SQUAD[i];
            const a = (Math.PI * 2 * i) / PIRATE_FULL_SQUAD.length + Math.random() * 0.2;
            const spawnU = spawnUnitAt(
              oc.x + Math.cos(a) * oR * 0.3,
              oc.y + Math.sin(a) * oR * 0.3,
              PIRATE_OWNER_ID,
              t,
              [],
              { sourceTag: batchTag, autoGroupUntil: state.t + 3, allowAutoJoinRecentSpawn: true }
            );
            if (spawnU) spawnU._piratePatrol = true;
          }
        }
      } else {
        state.pirateBase._respawnTimer = 0;
        state.pirateBase._initialSpawned = true;
      }
      const oc = state.pirateBase.orbitCenter || { x: state.pirateBase.x, y: state.pirateBase.y };
      const oR = state.pirateBase.orbitRadius || 200;
      const patrolHalf = (CFG.MINE_CAPTURE_RADIUS || 140) * 2;
      const baseUnderAttack = state.pirateBase._lastAttackedAt && (state.t - state.pirateBase._lastAttackedAt) < 5;
      if (typeof SQUADLOGIC !== "undefined") {
        const pirateSquads = [...state.squads.values()].filter((sq) => sq.ownerId === PIRATE_OWNER_ID && SQUADLOGIC.getSquadUnits(state, sq).length > 0);
        for (const squadState of pirateSquads) {
          const leader = state.units.get(squadState.leaderUnitId);
          if (!leader) continue;
          if ((leader._hyperArrivalFlash && state.t < leader._hyperArrivalFlash) || (leader._pirateHyperUntil && state.t < leader._pirateHyperUntil)) continue;
          if (squadState.combat.mode === "approach" || squadState.combat.mode === "engaged") continue;

          if (baseUnderAttack) {
            const defX = state.pirateBase._attackerX ?? state.pirateBase.x;
            const defY = state.pirateBase._attackerY ?? state.pirateBase.y;
            SQUADLOGIC.issueMoveOrder(state, squadState.id, [{ x: defX, y: defY }], Math.atan2(defY - leader.y, defX - leader.x));
            continue;
          }

          if (squadState._piratePatrolIdx == null) squadState._piratePatrolIdx = squadState.id % 4;
          const corners = [
            { x: oc.x - patrolHalf, y: oc.y - patrolHalf },
            { x: oc.x + patrolHalf, y: oc.y - patrolHalf },
            { x: oc.x + patrolHalf, y: oc.y + patrolHalf },
            { x: oc.x - patrolHalf, y: oc.y + patrolHalf }
          ];
          const target = corners[squadState._piratePatrolIdx % 4];
          const dist = Math.hypot(leader.x - target.x, leader.y - target.y);
          if (dist < 40) squadState._piratePatrolIdx = (squadState._piratePatrolIdx + 1) % 4;
          const wp = corners[squadState._piratePatrolIdx % 4];
          SQUADLOGIC.issueMoveOrder(state, squadState.id, [{ x: wp.x, y: wp.y }], Math.atan2(wp.y - leader.y, wp.x - leader.x));
        }
      } else {
        for (const u of state.units.values()) {
          if (u.owner !== PIRATE_OWNER_ID) continue;
          if ((u._hyperArrivalFlash && state.t < u._hyperArrivalFlash) || (u._pirateHyperUntil && state.t < u._pirateHyperUntil)) continue;
          const cs = u._combatState;
          if (cs === "acquire" || cs === "chase" || cs === "attack" || cs === "siege") continue;
          if (!u._patrolAngle) u._patrolAngle = Math.atan2(u.y - oc.y, u.x - oc.x);
          const angSpeed = (u.unitType === "cruiser") ? 0.15 : (u.unitType === "destroyer") ? 0.22 : 0.3;
          u._patrolAngle += angSpeed * dt;
          const pr = oR * (0.6 + (u.id % 5) * 0.08);
          const cosA = Math.cos(u._patrolAngle), sinA = Math.sin(u._patrolAngle);
          const tx = oc.x + cosA * pr;
          const ty = oc.y + sinA * pr;
          const lead = 35;
          const wpX = tx - sinA * lead;
          const wpY = ty + cosA * lead;
          u.waypoints = [{ x: wpX, y: wpY }];
          u.waypointIndex = 0;
        }
      }
    }
  }

  function updateMineProgressBar(mine) {
    if (!mine.gfx) return;
    let bar = mine.gfx._progressBar;
    const contested = mine._contested;
    if (mine.captureProgress > 0 && mine.captureProgress < 1 && !contested) {
      const R = (mine.isRich ? 36 : 28) * 2;
      if (!bar) {
        bar = new PIXI.Graphics();
        mine.gfx.addChild(bar);
        mine.gfx._progressBar = bar;
      }
      bar.clear();
      const w = R * 2, h = 5;
      bar.rect(-w / 2, R + 4, w, h);
      bar.fill({ color: 0x222222, alpha: 0.7 });
      const capCol = mine._capturingOwner ? colorForId(mine._capturingOwner) : 0x00ff88;
      bar.rect(-w / 2, R + 4, w * mine.captureProgress, h);
      bar.fill({ color: capCol, alpha: 0.9 });
      bar.visible = true;
    } else if (bar) {
      bar.visible = false;
    }
  }

  const GEM_COLORS_BY_TIER = {
    1: [0x88ff88, 0x66dd66, 0xaaff99, 0x55cc88],
    2: [0x44ddff, 0x66ccee, 0x33bbdd, 0x55eeff],
    3: [0xffcc00, 0xffaa22, 0xeebb11, 0xffdd44],
    4: [0xff6644, 0xff4488, 0xff8844, 0xee5533],
    5: [0xdd44ff, 0xcc33ee, 0xbb55ff, 0xaa22dd]
  };
  const GEM_RAINBOW = [0xff4444, 0xff8800, 0xffdd00, 0x44ff44, 0x44ddff, 0x4488ff, 0xbb44ff, 0xff44bb];

  function gemColorForValue(value) {
    if (value >= 10) return GEM_RAINBOW[Math.floor(Math.random() * GEM_RAINBOW.length)];
    if (value >= 6) { const colors = GEM_COLORS_BY_TIER[5]; return colors[Math.floor(Math.random() * colors.length)]; }
    if (value >= 4) { const colors = GEM_COLORS_BY_TIER[4]; return colors[Math.floor(Math.random() * colors.length)]; }
    const tier = Math.min(3, Math.max(1, Math.round(value)));
    const colors = GEM_COLORS_BY_TIER[tier] || GEM_COLORS_BY_TIER[1];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function gemSizeForValue(value) {
    return Math.min(14, 4 + value * 2 + Math.random() * 1.5);
  }

  function makeGemVisual(gem) {
    const sz = gemSizeForValue(gem.value);
    const g = new PIXI.Graphics();

    if (gem.isCredit) {
      const fontSize = Math.min(48, Math.max(12, 10 + gem.value * 3));
      const euroText = new PIXI.Text({ text: "€", style: { fontSize, fill: 0xffdd44, fontWeight: "bold", fontFamily: "Arial" } });
      euroText.anchor.set(0.5);
      g.addChild(euroText);
      if (gem.value >= 8) {
        const glow = makeGlow(0xffdd44, 16, 3);
        if (glow) g.filters = [glow];
      } else if (gem.value >= 4) {
        const glow = makeGlow(0xffcc22, 8, 1.5);
        if (glow) g.filters = [glow];
      }
    } else {
      const col = gemColorForValue(gem.value);
      const shape = Math.floor(Math.random() * 5);
      if (shape === 0) {
        g.poly([0, -sz, sz * 0.6, -sz * 0.2, sz * 0.4, sz * 0.8, -sz * 0.4, sz * 0.8, -sz * 0.6, -sz * 0.2]);
        g.fill({ color: col, alpha: 0.95 });
      } else if (shape === 1) {
        g.poly([0, -sz, sz * 0.7, 0, 0, sz, -sz * 0.7, 0]);
        g.fill({ color: col, alpha: 0.95 });
      } else if (shape === 2) {
        g.poly([sz * 0.3, -sz, sz * 0.8, -sz * 0.3, sz * 0.5, sz * 0.6, -sz * 0.5, sz * 0.6, -sz * 0.8, -sz * 0.3, -sz * 0.3, -sz]);
        g.fill({ color: col, alpha: 0.95 });
      } else if (shape === 3) {
        g.poly([0, -sz, sz * 0.5, -sz * 0.5, sz * 0.3, sz * 0.3, 0, sz * 0.9, -sz * 0.3, sz * 0.3, -sz * 0.5, -sz * 0.5]);
        g.fill({ color: col, alpha: 0.95 });
      } else {
        g.poly([0, -sz * 0.9, sz * 0.8, -sz * 0.3, sz * 0.6, sz * 0.7, -sz * 0.6, sz * 0.7, -sz * 0.8, -sz * 0.3]);
        g.fill({ color: col, alpha: 0.95 });
      }
      if (gem.value >= 10) {
        g.circle(0, 0, sz * 0.25);
        g.fill({ color: 0xffffff, alpha: 0.35 });
      }
      const glowDist = gem.value >= 10 ? 14 : (gem.value >= 5 ? 10 : 6);
      const glow = makeGlow(col, glowDist, gem.value >= 10 ? 2.8 : 1.8);
      if (glow) g.filters = [glow];
    }

    g.x = gem.x;
    g.y = gem.y;
    gem.gfx = g;
    resLayer.addChild(g);
  }

  function spawnMineGem(mine, owner, value, isCredit) {
    const id = state.nextResId++;
    const baseSpeed = CFG.MINE_GEM_SPEED * (0.7 + value * 0.15);
    const jitter = baseSpeed * (0.95 + Math.random() * 0.1);
    const gem = {
      id, x: mine.x, y: mine.y,
      targetPlayerId: owner.id,
      _mineId: mine.id,
      value: value,
      isCredit: !!isCredit,
      speed: jitter,
      drift: (Math.random() - 0.5) * 12,
      alive: true,
      gfx: null
    };
    makeGemVisual(gem);
    state.mineGems.push(gem);
  }

  function removeGemVisual(g) {
    if (g.gfx) { resLayer.removeChild(g.gfx); g.gfx.destroy(true); g.gfx = null; }
  }

  function stepMineGemsRemote(dt) {
    for (const mine of state.mines.values()) {
      if (!mine.ownerId || mine.captureProgress < 1) continue;
      const owner = state.players.get(mine.ownerId);
      if (!owner || owner.pop <= 0) continue;

      if (!mine._remoteGemAcc) mine._remoteGemAcc = Math.random() * 2;
      mine._remoteGemAcc += dt;
      const totalVal = (CFG.MINE_BASE_YIELD_VALUE * 0.7 + (owner.mineYieldBonus || 0)) * (mine.isRich ? CFG.MINE_RICH_MULTIPLIER : 1);
      const spawnInterval = Math.max(0.5, 2.5 - totalVal * 0.15);
      if (mine._remoteGemAcc >= spawnInterval) {
        mine._remoteGemAcc -= spawnInterval;
        const batchVal = totalVal * spawnInterval;
        const isCredit = Math.random() < 0.45;
        const variedVal = batchVal * (0.6 + Math.random() * 0.8);
        const gem = {
          id: state.nextResId++,
          x: mine.x, y: mine.y,
          targetPlayerId: owner.id,
          _mineId: mine.id,
          value: variedVal,
          isCredit: !!isCredit,
          speed: CFG.MINE_GEM_SPEED * (0.7 + variedVal * 0.15) * (0.95 + Math.random() * 0.1),
          drift: (Math.random() - 0.5) * 12,
          alive: true,
          _visualOnly: true,
          gfx: null
        };
        makeGemVisual(gem);
        state.mineGems.push(gem);
      }
    }
  }

  function stepMineGems(dt) {
    for (let i = state.mineGems.length - 1; i >= 0; i--) {
      const g = state.mineGems[i];
      if (!g.alive) { removeGemVisual(g); state.mineGems.splice(i, 1); continue; }
      const target = state.players.get(g.targetPlayerId);
      if (!target || target.pop <= 0) { g.alive = false; removeGemVisual(g); state.mineGems.splice(i, 1); continue; }

      const dx = target.x - g.x, dy = target.y - g.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 15) {
        if (!g._visualOnly) {
          target.eCredits = (target.eCredits || 0) + g.value;
          if (!g.isCredit) gainXP(target, g.value);
        }
        if (target.id === state.myPlayerId) tickSound(1480, 0.03, 0.04);
        g.alive = false;
        removeGemVisual(g);
        state.mineGems.splice(i, 1);
        continue;
      }

      const spd = g.speed * dt;
      const nx = dx / dist, ny = dy / dist;
      const perpX = -ny, perpY = nx;
      g.x += nx * spd + perpX * g.drift * dt;
      g.y += ny * spd + perpY * g.drift * dt;
      if (g.gfx) { g.gfx.x = g.x; g.gfx.y = g.y; g.gfx.rotation += dt * 1.5; }

      let intercepted = false;
      const gemProtected = g._interceptProtectUntil && state.t < g._interceptProtectUntil;
      for (const u of state.units.values()) {
        if (u.owner === g.targetPlayerId) continue;
        if (gemProtected) continue;
        const uHR = getUnitHitRadius(u);
        if (Math.hypot(u.x - g.x, u.y - g.y) < uHR + 4) {
          const interceptor = state.players.get(u.owner);
          if (interceptor) {
            g.targetPlayerId = u.owner;
            g._interceptProtectUntil = state.t + 1.0;
            intercepted = true;
            break;
          }
        }
      }
    }
  }

  // ── Nebula placement (static, not moving); none in or touching initial influence zones ──
  function placeNebulae(rndFn) {
    const rnd = rndFn || (() => Math.random());
    state.nebulae = [];
    const baseInflR = CFG.INFLUENCE_BASE_R || 240;
    function nebulaTouchesAnyInitialZone(cx, cy, r) {
      for (const p of state.players.values()) {
        if (p.eliminated) continue;
        const zoneR = p.influenceR ?? baseInflR;
        if (Math.hypot(cx - p.x, cy - p.y) <= r + zoneR) return true;
      }
      return false;
    }
    const NEBULA_HUE_PALETTE = [0x2a1a5e, 0x1a4a6e, 0x1a5e3a, 0x6e2a1a, 0x6e5e1a];
    function pickNebulaHue() {
      return NEBULA_HUE_PALETTE[Math.floor(rnd() * NEBULA_HUE_PALETTE.length)];
    }
    if (stateNebulaClouds && stateNebulaClouds.length) {
      for (const c of stateNebulaClouds) {
        if (nebulaTouchesAnyInitialZone(c.cx, c.cy, c.r)) continue;
        state.nebulae.push({ x: c.cx, y: c.cy, radius: c.r, discharges: [], _hue: pickNebulaHue() });
      }
    } else {
      const cx = CFG.WORLD_W * 0.5, cy = CFG.WORLD_H * 0.5;
      const cand = [{ x: cx, y: cy, radius: CFG.NEBULA_CENTER_RADIUS }];
      for (let i = 0; i < CFG.NEBULA_EXTRA_COUNT; i++) {
        const a = ((i + 0.5) / CFG.NEBULA_EXTRA_COUNT) * Math.PI * 2;
        const d = Math.min(CFG.WORLD_W, CFG.WORLD_H) * (0.18 + rnd() * 0.12);
        const r = CFG.NEBULA_EXTRA_R_MIN + rnd() * (CFG.NEBULA_EXTRA_R_MAX - CFG.NEBULA_EXTRA_R_MIN);
        cand.push({ x: clamp(cx + Math.cos(a) * d, r + 20, CFG.WORLD_W - r - 20), y: clamp(cy + Math.sin(a) * d, r + 20, CFG.WORLD_H - r - 20), radius: r });
      }
      for (const c of cand) {
        if (nebulaTouchesAnyInitialZone(c.x, c.y, c.r)) continue;
        state.nebulae.push({ x: c.x, y: c.y, radius: c.r, discharges: [], _hue: pickNebulaHue() });
      }
    }
  }

  function isInNebula(x, y) {
    if (!state.nebulae || !state.nebulae.length) return false;
    for (const neb of state.nebulae) {
      const d2 = (x - neb.x) ** 2 + (y - neb.y) ** 2;
      if (d2 <= neb.radius * neb.radius) return true;
    }
    return false;
  }

  function stepNebulae(dt) {
    if (!state.nebulae) return;
    for (const neb of state.nebulae) {
      neb._glowPhase = (neb._glowPhase || 0) + dt * 0.008;
      neb._glowAlpha = 0.09;

      const maxDischarges = 5;
      const spawnRate = 0.008 + neb.radius * 0.00006;
      if (neb.discharges.length < maxDischarges && Math.random() < dt * spawnRate) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * neb.radius * 0.4;
        const sx = neb.x + Math.cos(a) * d;
        const sy = neb.y + Math.sin(a) * d;
        const segs = [];
        let px = sx, py = sy;
        let angle = Math.random() * Math.PI * 2;
        const variety = Math.random();
        let segCount, segLen, branchChance, angleJitter;
        if (variety < 0.3) {
          segCount = 2 + Math.floor(Math.random() * 3);
          segLen = 5 + Math.random() * 12;
          branchChance = 0.1;
          angleJitter = 0.8;
        } else if (variety < 0.7) {
          segCount = 4 + Math.floor(Math.random() * 4);
          segLen = 8 + Math.random() * 20;
          branchChance = 0.4;
          angleJitter = 1.2;
        } else {
          segCount = 6 + Math.floor(Math.random() * 5);
          segLen = 12 + Math.random() * 25;
          branchChance = 0.5;
          angleJitter = 1.6;
        }
        for (let s = 0; s < segCount; s++) {
          angle += (Math.random() - 0.5) * angleJitter;
          const len = segLen * (0.7 + Math.random() * 0.6);
          const nx = px + Math.cos(angle) * len;
          const ny = py + Math.sin(angle) * len;
          segs.push({ x1: px, y1: py, x2: nx, y2: ny });
          px = nx; py = ny;
          if (Math.random() < branchChance && s < segCount - 1) {
            const ba = angle + (Math.random() < 0.5 ? 0.7 : -0.7) + (Math.random() - 0.5) * 0.5;
            const bl = 4 + Math.random() * 12;
            segs.push({ x1: px, y1: py, x2: px + Math.cos(ba) * bl, y2: py + Math.sin(ba) * bl });
          }
        }
        let totalLen = 0;
        const segsWithLen = segs.map(seg => {
          const l = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
          totalLen += l;
          return { ...seg, cumLen: totalLen };
        });
        const life = 4.0 + Math.random() * 4.0;
        const baseHue = neb._hue != null ? neb._hue : 0x4488cc;
        const hue = Math.random() < 0.4 ? (baseHue | 0x444444) : (Math.random() < 0.7 ? baseHue : (baseHue + 0x222222));
        const startX = segs[0].x1, startY = segs[0].y1;
        const lastSeg = segs[segs.length - 1];
        neb.discharges.push({ segs: segsWithLen, totalLen, life, maxLife: life, hue, startX, startY, endX: lastSeg.x2, endY: lastSeg.y2 });
      }
      for (let i = neb.discharges.length - 1; i >= 0; i--) {
        neb.discharges[i].life -= dt;
        if (neb.discharges[i].life <= 0) neb.discharges.splice(i, 1);
      }
    }
  }

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
    state.mines.clear();
    state.mineGems = [];
    state.nebulae = [];
    nextMineId = 1;
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
    state.squads = new Map();
    state.engagementZones = new Map();
    state.nextSquadId = 1;
    state.nextEngagementZoneId = 1;
    state.smoothedFronts = {};
    state.persistentBattles = {};
    state.resourceClusters = [];

    const soloIdx = state._soloColorIndex ?? 0;
    const remainingColors = SOLO_PALETTE.filter((_, i) => i !== soloIdx);

    const mapVar = state._mapVariation ?? 1;
    const baseSeed = state._customMapSeed != null ? state._customMapSeed : (mapVar * 7919 + 31337);
    const mapSeedLocal = baseSeed >>> 0;
    const soloRnd = mulberry32(mapSeedLocal);

    if (state._soloGameMode === "survival") {
      state._survivalMode = true;
      state._survivalWave = 0;
      state._survivalWaveNextAt = 60;
      state._survivalStartTime = 0;
      PLAYER_COLORS[SURVIVAL_ENEMY_OWNER_ID] = 0xcc4444;

      const cx = CFG.WORLD_W * 0.5;
      const topY = CFG.WORLD_H * 0.12;
      const me = makePlayer(1, nameForId(1), cx, topY, CFG.POP_START);
      me.color = SOLO_PALETTE[soloIdx];
      PLAYER_COLORS[1] = me.color;
      state.players.set(me.id, me);
      makeCityVisual(me);
      makeZoneVisual(me);

      centerOn(me.x, me.y);
      state._timeSnapshots = [];
      state._lastTimeSnapshotAt = 0;
      state._timeJumpAvailableAt = 61;

      placeMines([{ pos: { x: cx, y: topY }, ownerId: 1 }], soloRnd);
      placeNebulae(soloRnd);
      return;
    }

    state._survivalMode = false;
    const botCount = Math.max(1, Math.min(5, state._soloBotCount ?? 2));
    const totalPlayers = 1 + botCount;
    const spawnPositions = getFixedSpawnPositions(totalPlayers);
    const playerSpawnIdx = Math.min(totalPlayers - 1, Math.max(0, state._soloSpawnIndex ?? 0));
    const playerPos = spawnPositions[playerSpawnIdx];
    const botPositions = spawnPositions.filter((_, i) => i !== playerSpawnIdx);

    const me = makePlayer(1, nameForId(1), playerPos.x, playerPos.y, CFG.POP_START);
    me.color = SOLO_PALETTE[soloIdx];
    PLAYER_COLORS[1] = me.color;
    state.players.set(me.id, me);
    makeCityVisual(me);
    makeZoneVisual(me);

    for (let i = 0; i < botCount; i++) {
      const id = 2 + i;
      const pos = botPositions[i] || spawnPositions[(i + 1) % totalPlayers];
      const bot = makePlayer(id, nameForId(id), pos.x, pos.y, CFG.POP_START);
      bot.color = remainingColors[i % remainingColors.length];
      PLAYER_COLORS[bot.id] = bot.color;
      state.players.set(bot.id, bot);
      makeCityVisual(bot);
      makeZoneVisual(bot);
    }

    centerOn(me.x, me.y);

    state._timeSnapshots = [];
    state._lastTimeSnapshotAt = 0;
    state._timeJumpAvailableAt = state.players.size * 61;

    const orderedSpawns = [playerPos, ...botPositions];
    placeMines(orderedSpawns.map((pos, i) => ({ pos, ownerId: i + 1 })), soloRnd);
    placeNebulae(soloRnd);
  }

  function resetWorldMulti(slots, slotToPid) {
    state._survivalMode = false;
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
    state.mines.clear();
    state.mineGems = [];
    state.nebulae = [];
    nextMineId = 1;
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
    state.squads = new Map();
    state.engagementZones = new Map();
    state.nextSquadId = 1;
    state.nextEngagementZoneId = 1;
    state.smoothedFronts = {};
    state.persistentBattles = {};

    const filledSlotIndices = Object.keys(slotToPid).map(Number).sort((a, b) => a - b);
    const n = filledSlotIndices.length;
    const allSpawns = getFixedSpawnPositions(CFG.MAX_PLAYERS);

    const positions = [];
    const mineEntries = [];
    for (let i = 0; i < filledSlotIndices.length; i++) {
      const slotIndex = filledSlotIndices[i];
      const pid = slotToPid[slotIndex];
      const slotData = slots[slotIndex];
      const spIdx = (slotData && slotData.spawnIndex != null) ? slotData.spawnIndex : i;
      const pos = allSpawns[spIdx] || allSpawns[i] || allSpawns[0];
      positions.push(pos);
      mineEntries.push({ pos, ownerId: pid });
      const pl = makePlayer(pid, nameForId(pid), pos.x, pos.y, CFG.POP_START);
      state.players.set(pl.id, pl);
      makeCityVisual(pl);
      makeZoneVisual(pl);
    }
    state._timeSnapshots = [];
    state._lastTimeSnapshotAt = 0;
    state._timeJumpAvailableAt = state.players.size * 61;

    const me = state.players.get(state.myPlayerId);
    centerOn(me.x, me.y);

    for (let i = 0; i < CFG.MAX_PLAYERS; i++) {
      if (!(slotToPid[i] != null)) {
        const slotData = (slots || [])[i];
        const spIdx = (slotData && slotData.spawnIndex != null) ? slotData.spawnIndex : i;
        const pos = allSpawns[spIdx] || allSpawns[i] || allSpawns[0];
        mineEntries.push({ pos, ownerId: null });
      }
    }
    placeMines(mineEntries, locRnd);
    placeNebulae();
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
    if (r.gfx) {
      resLayer.removeChild(r.gfx);
      if (r.gfx.destroy) r.gfx.destroy(true);
    }
    state.res.delete(rid);
  }

  // ------------------------------------------------------------
  // Units
  // ------------------------------------------------------------
  const FORM_ELONGATE = 1.85;
  const FORM_MIN_SPACING = 60;

  function pigFormationOffsets(n, dirX, dirY, depth, widthMul, sizeMul, hitSpacing) {
    const depthRows = Math.max(1, depth || 3);
    const wMul = Math.max(0.5, Math.min(2, widthMul || 1));
    const sm = sizeMul || 1;
    const hs = hitSpacing || FORM_MIN_SPACING;
    const sx = Math.max((CFG.FORM_SPACING_X || 18) * wMul * sm, hs * wMul);
    const sy = Math.max(CFG.FORM_SPACING_Y * sm, hs);
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

  const FORM_TYPE_ORDER = ["fighter", "destroyer", "cruiser", "battleship", "hyperDestroyer"];

  function lineFormationOffsets(n, rows, dirX, dirY, sizeMul, hitSpacing) {
    const sm = sizeMul || 1;
    const hs = hitSpacing || FORM_MIN_SPACING;
    const sx = Math.max((CFG.FORM_SPACING_X || 18) * sm, hs);
    const sy = Math.max((CFG.FORM_SPACING_Y || 22) * sm, hs);
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

  function lineFormationOffsetsByType(squad, dirX, dirY) {
    const order = FORM_TYPE_ORDER;
    const formationOrder = [];
    for (const k of order) {
      for (const u of squad) if ((u.unitType || "fighter") === k) formationOrder.push(u);
    }
    const angle = Math.atan2(dirY, dirX) + Math.PI / 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);

    const rows = [];
    for (let j = 0; j < formationOrder.length; ) {
      const rowType = formationOrder[j].unitType || "fighter";
      const row = [];
      while (j < formationOrder.length && (formationOrder[j].unitType || "fighter") === rowType) {
        row.push(formationOrder[j++]);
      }
      let maxRowHitR = 0;
      for (const ru of row) {
        const hr = getUnitHitRadius(ru);
        if (hr > maxRowHitR) maxRowHitR = hr;
      }
      const maxSm = Math.max(...row.map(unit => Math.max(1, (UNIT_TYPES[unit.unitType] || UNIT_TYPES.fighter).sizeMultiplier * 0.7 + 0.5)), 1);
      const hitSp = maxRowHitR * 2 + 8;
      const sx = Math.max((CFG.FORM_SPACING_X || 18) * maxSm, hitSp);
      rows.push({ units: row, maxHitR: maxRowHitR, sx });
    }

    const offsetsInOrder = [];
    let yAcc = 0;
    for (let ri = 0; ri < rows.length; ri++) {
      const r = rows[ri];
      if (ri > 0) {
        const gap = rows[ri - 1].maxHitR + r.maxHitR + 10;
        yAcc += gap;
      }
      for (let c = 0; c < r.units.length; c++) {
        const x = (c - (r.units.length - 1) / 2) * r.sx;
        const y = yAcc;
        offsetsInOrder.push({ x: x * cos - y * sin, y: x * sin + y * cos });
      }
    }

    const out = [];
    for (const u of squad) {
      const idx = formationOrder.indexOf(u);
      out.push(offsetsInOrder[idx] || { x: 0, y: 0 });
    }
    return out;
  }

  function getFormationOffsets(n, formationType, formationRows, dirX, dirY, formationPigWidth, squad) {
    let sizeMul = 1;
    let maxHitR = 12;
    if (squad && squad.length > 0) {
      let maxSz = 0;
      for (const u of squad) {
        const t = UNIT_TYPES[u.unitType] || UNIT_TYPES.fighter;
        if (t.sizeMultiplier > maxSz) maxSz = t.sizeMultiplier;
        const hr = (t.sizeMultiplier * 6 + 6) * (UNIT_BOUNDING_MUL[u.unitType || "fighter"] ?? 1.8);
        if (hr > maxHitR) maxHitR = hr;
      }
      sizeMul = Math.max(1, maxSz * 0.6 + 0.4);
    }
    const hitSpacing = maxHitR * 2 + 8;
    if (formationType === "lineByType" && squad && squad.length > 0) return lineFormationOffsetsByType(squad, dirX, dirY);
    if (formationType === "line") return lineFormationOffsets(n, Math.max(1, formationRows || 1), dirX, dirY, sizeMul, hitSpacing);
    return pigFormationOffsets(n, dirX, dirY, formationRows || 3, formationPigWidth ?? 1, sizeMul, hitSpacing);
  }

  function getFormationCenter(offsets) {
    if (!offsets || offsets.length === 0) return { x: 0, y: 0 };
    let cx = 0, cy = 0;
    for (const o of offsets) { cx += o.x; cy += o.y; }
    return { x: cx / offsets.length, y: cy / offsets.length };
  }

  function spawnUnitAt(sx, sy, ownerId, unitTypeKey, waypoints, opts) {
    const type = UNIT_TYPES[unitTypeKey];
    if (!type) return null;
    const id = state.nextUnitId++;
    const u = {
      id, owner: ownerId,
      color: ownerId === PIRATE_OWNER_ID ? 0x886622 : (state.players.get(ownerId)?.color ?? colorForId(ownerId)),
      unitType: unitTypeKey,
      x: sx, y: sy, vx: 0, vy: 0,
      hp: type.hp, maxHp: type.hp, dmg: type.damage, atkCd: 0,
      attackRange: type.attackRange, maxTargets: type.maxTargets, speed: type.speed,
      orbitTarget: type.orbitTarget, popPenalty: type.popPenaltyPerUnit,
      regenPerSec: 0, gfx: null,
      waypoints: Array.isArray(waypoints) ? waypoints.map(w => ({ x: w.x, y: w.y })) : [{ x: sx + 50, y: sy }],
      waypointIndex: 0, leaderId: null, formationOffsetX: 0, formationOffsetY: 0,
      spawnTime: state.t, _cryoSlowUntil: 0, _fireDotUntil: 0, _fireDotDps: 0
    };
    state.units.set(id, u);
    makeUnitVisual(u);
    if (typeof SQUADLOGIC !== "undefined" && SQUADLOGIC.createSquad) {
      SQUADLOGIC.createSquad(state, [id], {
        leaderUnitId: id,
        formationType: u.formationType || "line",
        formationRows: u.formationRows ?? 3,
        formationWidth: u.formationPigWidth ?? 1,
        sourceTag: opts && opts.sourceTag ? opts.sourceTag : null,
        autoGroupUntil: opts && opts.autoGroupUntil != null ? opts.autoGroupUntil : null,
        allowAutoJoinRecentSpawn: !!(opts && opts.allowAutoJoinRecentSpawn),
        order: { type: "move", waypoints: cloneWaypointsSafe(waypoints), holdPoint: null }
      });
    }
    return u;
  }

  const UNIT_CAPS = { fighter: 300, destroyer: 100, cruiser: 50, battleship: 10, hyperDestroyer: 10 };

  function countPlayerUnits(ownerId, typeKey) {
    let n = 0;
    for (const u of state.units.values()) {
      if (u.owner === ownerId && (u.unitType || "fighter") === typeKey && u.hp > 0) n++;
    }
    return n;
  }

  function purchaseUnit(ownerId, unitTypeKey, waypoints, opts) {
    const p = state.players.get(ownerId);
    if (!p) return { ok: false, reason: "no_player" };
    const type = UNIT_TYPES[unitTypeKey];
    if (!type) return { ok: false, reason: "unknown_type" };
    const cap = UNIT_CAPS[unitTypeKey] ?? 300;
    const current = countPlayerUnits(ownerId, unitTypeKey);
    if (current >= cap) return { ok: false, reason: "cap_reached" };
    const costMul = p.unitCostMul != null ? p.unitCostMul : 1;
    const cost = Math.max(1, Math.round(type.cost * costMul));
    if ((p.eCredits || 0) < cost) return { ok: false, reason: "no_credits" };

    p.eCredits -= cost;

    const n = type.squadSize;
    const pts = Array.isArray(waypoints) && waypoints.length > 0 ? waypoints : [{ x: p.x + 100, y: p.y }];
    const first = pts[0];
    const [vx, vy] = norm(first.x - p.x, first.y - p.y);
    const formationType = type.formationType || (opts && opts.formationType) || "line";
    const formationRows = type.formationRows || (opts && opts.formationRows) || 3;
    const pigW = (opts && opts.formationPigWidth) ?? 1;
    const virtualSquad = n > 0 ? Array.from({ length: n }, () => ({ unitType: unitTypeKey })) : [];
    const offsets = getFormationOffsets(n, formationType, formationRows, vx, vy, pigW, virtualSquad.length ? virtualSquad : undefined);
    const fCenter = getFormationCenter(offsets);
    const adjustedPts = pts.map(w => ({ x: w.x - fCenter.x, y: w.y - fCenter.y }));
    let leaderId = null;

    const lb = getLevelBonusMul(p);
    const hpMul = (p.unitHpMul != null ? p.unitHpMul : 1) * lb;
    const dmgMul = (p.unitDmgMul != null ? p.unitDmgMul : 1) * lb;
    const atkRateMul = (p.unitAtkRateMul != null ? p.unitAtkRateMul : 1) * lb;

    const REGEN_ROLL_CHANCE = 0.012;
    for (let i = 0; i < n; i++) {
      const id = state.nextUnitId++;
      const off = offsets[i] || { x: 0, y: 0 };
      let regenPerSec = 0;
      for (let r = 0; r < 3; r++) { if (Math.random() < REGEN_ROLL_CHANCE) regenPerSec++; }
      // Spawn outside planet radius + 20%, in the direction of the rally/waypoint
      const pR = getPlanetRadius(p);
      const spawnR = pR * 1.2;
      const spawnX = p.x + vx * spawnR + off.x;
      const spawnY = p.y + vy * spawnR + off.y;
      const u = {
        id,
        owner: ownerId,
        color: p.color,
        unitType: unitTypeKey,
        x: spawnX,
        y: spawnY,
        vx, vy,
        hp: Math.round(type.hp * hpMul),
        maxHp: Math.round(type.hp * hpMul),
        dmg: Math.max(1, Math.round(type.damage * dmgMul)),
        atkCd: rand(0, 1 / (type.attackRate * atkRateMul)),
        attackRange: type.attackRange,
        maxTargets: type.maxTargets,
        speed: type.speed,
        orbitTarget: type.orbitTarget,
        popPenalty: type.popPenaltyPerUnit,
        regenPerSec,
        gfx: null,
        waypoints: adjustedPts.map(w => ({ x: w.x, y: w.y })),
        waypointIndex: 0,
        leaderId: i === 0 ? null : leaderId,
        formationOffsetX: off.x,
        formationOffsetY: off.y,
        spawnTime: state.t,
        _cryoSlowUntil: 0,
        _fireDotUntil: 0, _fireDotDps: 0
      };
      if (i === 0) {
        leaderId = id;
        u.formationType = formationType;
        u.formationRows = formationRows;
        u._formationAngle = Math.atan2(vy, vx);
        u._lastFacingAngle = Math.atan2(vy, vx);
      }
      state.units.set(id, u);
      makeUnitVisual(u);
    }

    if (leaderId != null && typeof SQUADLOGIC !== "undefined" && SQUADLOGIC.createSquad) {
      const unitIds = [];
      for (const u of state.units.values()) {
        if (u.id === leaderId || u.leaderId === leaderId) unitIds.push(u.id);
      }
      SQUADLOGIC.createSquad(state, unitIds, {
        leaderUnitId: leaderId,
        formationType,
        formationRows,
        formationWidth: pigW,
        sourceTag: (opts && opts.sourceTag) || "spawn",
        autoGroupUntil: state.t + 3,
        allowAutoJoinRecentSpawn: true,
        order: {
          type: "move",
          waypoints: adjustedPts.map((w) => ({ x: w.x, y: w.y })),
          holdPoint: null
        }
      });
    }

    return { ok: true, spawned: n, cost };
  }

  function spawnUnits(ownerId, count, waypoints, opts) {
    return purchaseUnit(ownerId, (opts && opts.unitType) || "fighter", waypoints, opts);
  }

  function spawnXPOrb(x, y, xp, killerOwner) {
    const maxRes = CFG.RES_MAX ?? 520;
    if (state.res.size >= maxRes) {
      const firstId = state.res.keys().next().value;
      if (firstId != null) deleteResource(firstId);
    }
    const id = state.nextResId++;
    const r = { id, type: "orb", xp, x, y, color: 0xffdd44, gfx: null, _spawnedAt: state.t };
    if (killerOwner != null && killerOwner !== undefined) {
      r._targetCity = killerOwner;
      r._interceptProtectUntil = state.t + 1.5;
    }
    state.res.set(id, r);
    makeResVisual(r);
  }

  const UNIT_XP_DROPS = { fighter: 1, destroyer: 8, cruiser: 25, battleship: 50, hyperDestroyer: 100 };

  const UNIT_CREDIT_DROPS = { fighter: 5, destroyer: 50, cruiser: 150, battleship: 400, hyperDestroyer: 800 };

  function killUnit(u, reason = "dead", killerOwner) {
    if (typeof playExplosionSound === "function") playExplosionSound(u.x, u.y);
    const baseXP = UNIT_XP_DROPS[u.unitType] || 1;
    const xpDrop = Math.max(1, Math.round(baseXP * (0.8 + Math.random() * 0.4)));
    spawnXPOrb(u.x + (Math.random() - 0.5) * 10, u.y + (Math.random() - 0.5) * 10, xpDrop, killerOwner);
    const creditDrop = UNIT_CREDIT_DROPS[u.unitType] || 3;
    if (creditDrop > 0) {
      const creditVal = Math.max(1, Math.round(creditDrop * (0.6 + Math.random() * 0.8)));
      const id = state.nextResId++;
      const rx = u.x + (Math.random() - 0.5) * 12, ry = u.y + (Math.random() - 0.5) * 12;
      const creditOrb = {
        id, type: "credit", value: creditVal, x: rx, y: ry,
        color: 0xffdd44, gfx: null, _spawnedAt: state.t, isCredit: true,
        _targetCity: killerOwner != null ? killerOwner : undefined,
        _interceptProtectUntil: killerOwner != null ? state.t + 1.5 : undefined
      };
      if (state.res.size >= (CFG.RES_MAX ?? 520)) {
        const firstId = state.res.keys().next().value;
        if (firstId != null) deleteResource(firstId);
      }
      state.res.set(id, creditOrb);
      makeResVisual(creditOrb);
    }

    const p = state.players.get(u.owner);
    if (p) {
      const penalty = u.popPenalty || 1;
      p.popFloat = Math.max(0, p.popFloat - penalty);
      p.pop = Math.floor(p.popFloat);
      p.deadUnits++;
    }
    if (reason === "killed" && killerOwner && killerOwner !== u.owner) {
      const kp = state.players.get(killerOwner);
      if (kp) {
        kp.killGrowthStacks = kp.killGrowthStacks || [];
        kp.killGrowthStacks.push(state.t + 240);
        kp._growthBonuses = kp._growthBonuses || [];
        kp._growthBonuses.push({ amount: 1, expiresAt: state.t + 60 });
      }
    }

    const myId = u.id;
    const isLeader = u.leaderId === null || u.leaderId === undefined;
    const FORMATION_REBUILD_DELAY = 2.5;

    if (typeof SQUADLOGIC !== "undefined" && u.squadId != null) {
      const squadId = u.squadId;
      if (u.gfx) unitsLayer.removeChild(u.gfx);
      state.units.delete(u.id);
      const squad = state.squads.get(squadId);
      if (squad) {
        squad.unitIds = squad.unitIds.filter((id) => id !== u.id);
        if (squad.unitIds.length === 0) state.squads.delete(squadId);
        else {
          if (squad.leaderUnitId === u.id) squad.leaderUnitId = squad.unitIds[0];
          SQUADLOGIC.requestFormationRecalc(state, squadId, true);
        }
      }
      return;
    }

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
        newLeader._formationRebuildAt = state.t + FORMATION_REBUILD_DELAY;
        for (const v of state.units.values()) {
          if (v.leaderId === myId) v.leaderId = newLeader.id;
        }
      }
    } else {
      const leader = state.units.get(u.leaderId);
      if (leader) {
        leader._formationRebuildAt = state.t + FORMATION_REBUILD_DELAY;
      }
    }

    if (u.gfx) unitsLayer.removeChild(u.gfx);
    state.units.delete(u.id);
  }

  // ------------------------------------------------------------
  // Combat (all ranged, multi-target, nebula bonuses)
  // ------------------------------------------------------------
  function getUnitHitRadius(u) {
    const type = UNIT_TYPES[u.unitType] || UNIT_TYPES.fighter;
    const s = type.sizeMultiplier * 6 + 6;
    const mul = UNIT_BOUNDING_MUL[u.unitType] ?? UNIT_BOUNDING_MUL.fighter;
    return s * mul;
  }

  const MAX_BULLETS = 800;

  function applyUnitDamage(u, dmg, sourceOwnerId) {
    if (state._voidShieldUntil && state._voidShieldUntil[u.owner] && state.t < state._voidShieldUntil[u.owner]) return;
    let dmgLeft = dmg;
    if (u._activeShieldHp != null && u._activeShieldHp > 0) {
      const shieldTake = Math.min(u._activeShieldHp, dmgLeft);
      u._activeShieldHp -= shieldTake;
      dmgLeft -= shieldTake;
      if (u._activeShieldHp <= 0) u._activeShieldHp = null;
    }
    if (dmgLeft > 0) u.hp = Math.max(0, u.hp - dmgLeft);
    u.lastDamagedBy = sourceOwnerId;
  }

  function getRangeLevelMul(p) {
    return p ? (1 + (p.level || 1) * 0.005) : 1;
  }

  function getUnitAtkRange(u) {
    const p = state.players.get(u.owner);
    const baseMul = p && p.unitAtkRangeMul != null ? p.unitAtkRangeMul : 1;
    const nebMul = isInNebula(u.x, u.y) ? (1 + CFG.NEBULA_ATK_RANGE_BONUS) : 1;
    const lvlMul = getRangeLevelMul(p);
    return (u.attackRange || 40) * Math.min(UNIT_ATK_RANGE_MAX_MUL, baseMul) * nebMul * lvlMul;
  }

  const ENGAGEMENT_GROWTH_COEFF = 0.9;
  function getUnitEngagementRange(u) {
    const baseRange = u.attackRange || 40;
    const currentRange = getUnitAtkRange(u);
    return baseRange + (currentRange - baseRange) * ENGAGEMENT_GROWTH_COEFF;
  }

  function getUnitBaseSpeed(u) {
    const classOrder = ["fighter", "destroyer", "cruiser", "battleship", "hyperDestroyer"];
    const classIdx = classOrder.indexOf(u.unitType || "fighter");
    return (u.speed || UNIT_TYPES[u.unitType || "fighter"]?.speed || 9) * 1.1 * Math.max(0.5, 1 - classIdx * 0.06);
  }

  function getUnitDmg(u) {
    const nebMul = isInNebula(u.x, u.y) ? (1 + CFG.NEBULA_DMG_BONUS) : 1;
    return Math.max(1, Math.round((u.dmg || 1) * nebMul));
  }

  function getUnitAtkRate(u) {
    const type = UNIT_TYPES[u.unitType] || UNIT_TYPES.fighter;
    const p = state.players.get(u.owner);
    const rateMul = (p && p.unitAtkRateMul != null ? p.unitAtkRateMul : 1);
    const nebMul = isInNebula(u.x, u.y) ? (1 + CFG.NEBULA_ATK_RATE_BONUS) : 1;
    let rate = type.attackRate * rateMul * nebMul * getLevelBonusMul(p);
    if (u._cryoSlowUntil && state.t < u._cryoSlowUntil) rate *= (1 - (u._cryoSlowAmount ?? CFG.CRYO_SLOW ?? 0.4));
    return rate;
  }

  function stepCombat(dt) {
    const bulletsFull = state.bullets.length >= MAX_BULLETS;

    for (const u of state.units.values()) {
      if (u._fireDotUntil && state.t < u._fireDotUntil) {
        const fireDmg = (u._fireDotDps || CFG.FIRE_DOT_DPS) * dt;
        applyUnitDamage(u, fireDmg, u._fireDotOwner);
        if (u.hp <= 0) { u.lastDamagedBy = u._fireDotOwner; continue; }
      }
      if (u._cryoSlowUntil && state.t > u._cryoSlowUntil) u._cryoSlowUntil = 0;
      if (u.hp > 0 && (u.regenPerSec || 0) > 0 && u.hp < (u.maxHp || 999999)) {
        let regen = u.regenPerSec * dt;
        if (u._cryoSlowUntil && state.t < u._cryoSlowUntil) regen *= 0.5;
        u.hp = Math.min(u.maxHp || u.hp, u.hp + regen);
      }

      u.atkCd -= dt;
      if (u.atkCd > 0) continue;
      if (bulletsFull) continue;

      const p = state.players.get(u.owner);
      const atkRange = getUnitAtkRange(u);
      const atkRange2 = atkRange * atkRange;
      const firePlan = (typeof SQUADLOGIC !== "undefined" && SQUADLOGIC.getUnitFirePlan)
        ? SQUADLOGIC.getUnitFirePlan(u, state, { getUnitAtkRange, getPlanetRadius, shieldRadius })
        : null;

      if (firePlan && firePlan.type === "city" && firePlan.city) {
        const city = firePlan.city;
        u.atkCd = 1 / getUnitAtkRate(u);
        const dmg = getUnitDmg(u);
        if (typeof playLaserSound === "function") playLaserSound(u.x, u.y, city.x, city.y);
        state.bullets.push({
          type: "laser", fromX: u.x, fromY: u.y,
          toX: city.x, toY: city.y,
          color: p ? p.color : 0xaa44ff,
          ownerId: u.owner, dmg,
          duration: 0.6, progress: 0,
          targetId: city.id, targetType: "city",
          attackEffect: p ? p.attackEffect : null,
          attackEffects: p ? p.attackEffects : null
        });
        continue;
      }

      const hitTargets = new Set();
      if (firePlan && firePlan.type === "units" && Array.isArray(firePlan.targets) && firePlan.targets.length > 0) {
        u.atkCd = 1 / getUnitAtkRate(u);
        const hitR = getUnitHitRadius(u) * 0.6;
        const facing = u._lastFacingAngle ?? 0;
        const hpAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5, Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
        for (let ti = 0; ti < firePlan.targets.length; ti++) {
          const tgt = firePlan.targets[ti];
          hitTargets.add(tgt.id);
          const nebDmgTaken = isInNebula(tgt.x, tgt.y) ? (1 + CFG.NEBULA_DMG_TAKEN_BONUS) : 1;
          const dmg = Math.max(1, Math.round(getUnitDmg(u) * nebDmgTaken));
          const hpA = facing + hpAngles[ti % hpAngles.length];
          const fromX = firePlan.targets.length > 1 ? u.x + Math.cos(hpA) * hitR : u.x;
          const fromY = firePlan.targets.length > 1 ? u.y + Math.sin(hpA) * hitR : u.y;
          if (typeof playLaserSound === "function") playLaserSound(fromX, fromY, tgt.x, tgt.y);
          state.bullets.push({
            type: "laser", fromX, fromY,
            toX: tgt.x, toY: tgt.y,
            color: p ? p.color : 0xaa44ff,
            ownerId: u.owner, dmg,
            sourceUnitId: u.id,
            duration: 0.6, progress: 0,
            targetId: tgt.id, targetType: "unit",
            attackEffect: p ? p.attackEffect : null,
            attackEffects: p ? p.attackEffects : null
          });
        }
      } else if (firePlan && firePlan.type === "turret" && firePlan.turret) {
        const t = firePlan.turret;
        u.atkCd = 1 / getUnitAtkRate(u);
        const dmg = getUnitDmg(u);
        if (typeof playLaserSound === "function") playLaserSound(u.x, u.y, t.x, t.y);
        state.bullets.push({
          type: "laser", fromX: u.x, fromY: u.y,
          toX: t.x, toY: t.y,
          color: p ? p.color : 0xaa44ff,
          ownerId: u.owner, dmg,
          duration: 0.6, progress: 0,
          targetId: t.id, targetType: "turret",
          attackEffect: p ? p.attackEffect : null,
          attackEffects: p ? p.attackEffects : null
        });
      }

      if (hitTargets.size === 0 && u.owner !== PIRATE_OWNER_ID && state.pirateBase && state.pirateBase.hp > 0) {
        const pb = state.pirateBase;
        const d2base = (u.x - pb.x) ** 2 + (u.y - pb.y) ** 2;
        if (d2base <= atkRange2) {
          u.atkCd = 1 / getUnitAtkRate(u);
          const dmg = getUnitDmg(u);
          if (typeof playLaserSound === "function") playLaserSound(u.x, u.y, pb.x, pb.y);
          state.bullets.push({
            type: "laser", fromX: u.x, fromY: u.y,
            toX: pb.x, toY: pb.y,
            color: p ? p.color : 0xaa44ff,
            ownerId: u.owner, dmg,
            duration: 0.6, progress: 0,
            targetId: "pirateBase", targetType: "pirateBase",
            attackEffect: p ? p.attackEffect : null,
            attackEffects: p ? p.attackEffects : null
          });
        }
      }

    }

    for (const u of [...state.units.values()]) {
      if (u.hp <= 0) killUnit(u, "killed", u.lastDamagedBy);
    }

    // Proximity city damage removed — ships only damage planets via explicit attack order (laser)

    stepShields(dt);
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

  // Shield HP = pop × 5; regen = 5 + 0.7% maxHp / sec, starts 30s after breaking
  const SHIELD_REGEN_DELAY = 30;

  const SHIELD_BASE_REGEN = 0.5;
  function stepShields(dt) {
    for (const p of state.players.values()) {
      if (p.eliminated) continue;
      const maxSh = Math.max(5, (p.pop ?? 1) * 2);
      p.shieldMaxHp = maxSh;
      if (p.shieldHp === undefined) { p.shieldHp = maxSh; p.shieldRegenCd = 0; }

      const regenPerSec = SHIELD_BASE_REGEN + (p.shieldRegenBonus ?? 0);
      if (p.shieldHp > 0) {
        if (p.shieldHp < maxSh && regenPerSec > 0) {
          p.shieldHp = Math.min(maxSh, p.shieldHp + regenPerSec * dt);
        }
      } else {
        p.shieldRegenCd = (p.shieldRegenCd ?? SHIELD_REGEN_DELAY) - dt;
        if (p.shieldRegenCd <= 0 && regenPerSec > 0) {
          p.shieldRegenCd = 0;
          p.shieldHp = Math.min(maxSh, (p.shieldHp || 0) + regenPerSec * dt);
        }
      }
    }
  }

  function stepCityDefense(dt) {
    const rate = CFG.CITY_ATTACK_RATE;
    for (const p of state.players.values()) {
      p.cityAtkCd = (p.cityAtkCd ?? 0) - dt;
      if (p.cityAtkCd > 0) continue;
      const turretDmgMul = (p.turretDmgMul != null ? p.turretDmgMul : 1) * getLevelBonusMul(p);
      const dmg = Math.max(1, Math.round(CFG.CITY_ATTACK_DMG * turretDmgMul));
      const X = CFG.CITY_BASE_TARGETS + (p.cityTargetBonus || 0);
      const enemies = [];
      for (const u of state.units.values()) {
        if (u.owner === p.id) continue;
        if (isUnitInPlayerZone(u, p)) enemies.push(u);
      }
      enemies.sort((a, b) => dist2(a.x, a.y, p.x, p.y) - dist2(b.x, b.y, p.x, p.y));
      const toShoot = enemies.slice(0, X);
      if (toShoot.length > 0) {
        p.cityAtkCd = 1 / rate;
        const cityBulletSpeed = 20;
        const zoneR = p.influenceR || CFG.INFLUENCE_BASE_R || 240;
        const maxFlightTime = zoneR / cityBulletSpeed;
        for (const target of toShoot) {
          state.bullets.push({
            type: "ranged",
            x: p.x, y: p.y,
            fromX: p.x, fromY: p.y,
            toX: target.x, toY: target.y,
            color: p.color,
            ownerId: p.id,
            dmg,
            speed: cityBulletSpeed,
            traveled: 0,
            maxDist: Math.hypot(target.x - p.x, target.y - p.y) + 40,
            aoe: true,
            big: true,
            spawnTime: state.t,
            maxFlightTime
          });
        }
      }
    }
  }

  function isUnitInPlayerZone(u, p) {
    const poly = p.influencePolygon;
    if (!poly || poly.length < 3) {
      const r = p.influenceR || CFG.INFLUENCE_BASE_R || 240;
      return dist2(u.x, u.y, p.x, p.y) <= r * r;
    }
    return isPointInPolygon(u.x, u.y, poly);
  }

  function stepBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];

      // ── Laser beam (unit ranged / city laser): progress-based, damage at end ──
        if (b.type === "laser") {
        if (b.targetType === "unit" && b.targetId != null) {
          const u = state.units.get(b.targetId);
          if (!u) { state.bullets.splice(i, 1); continue; }
        } else if (b.targetType === "city" && b.targetId != null) {
          const p = state.players.get(b.targetId);
          if (!p || p.eliminated) { state.bullets.splice(i, 1); continue; }
        } else if (b.targetType === "turret" && b.targetId != null) {
          const t = state.turrets.get(b.targetId);
          if (!t || t.hp <= 0) { state.bullets.splice(i, 1); continue; }
        } else if (b.targetType === "pirateBase") {
          if (!state.pirateBase || state.pirateBase.hp <= 0) { state.bullets.splice(i, 1); continue; }
        }
        b.progress = (b.progress || 0) + dt / (b.duration || 0.2);
        if (b.progress >= 1) {
          if (b.targetType === "unit") {
            const u = state.units.get(b.targetId);
            if (u && u.owner !== b.ownerId) {
              let dmgLeft = b.dmg;
              if (u._activeShieldHp != null && u._activeShieldHp > 0) {
                const shieldTake = Math.min(u._activeShieldHp, dmgLeft);
                u._activeShieldHp -= shieldTake;
                dmgLeft -= shieldTake;
                if (u._activeShieldHp <= 0) u._activeShieldHp = null;
              }
              if (dmgLeft > 0) u.hp = Math.max(0, u.hp - dmgLeft);
              u.lastDamagedBy = b.ownerId;
              u._hitFlashT = state.t;
              // Record threat for combat state machine
              if (typeof SQUADLOGIC !== "undefined" && SQUADLOGIC.recordDamageSource && b.sourceUnitId != null) {
                SQUADLOGIC.recordDamageSource(u, b.sourceUnitId, state);
              } else if (typeof COMBAT !== "undefined" && COMBAT.recordDamageSource && b.sourceUnitId != null) {
                COMBAT.recordDamageSource(u, b.sourceUnitId, state);
              }
              state.floatingDamage.push({ x: u.x, y: u.y - 22, text: "-" + b.dmg, color: b.color ?? 0xaa44ff, ttl: 1.0 });
              const efx = b.attackEffects || {};
              const cryoLv = efx.cryo || (b.attackEffect === "cryo" ? 1 : 0);
              const fireLv = efx.fire || (b.attackEffect === "fire" ? 1 : 0);
              const chainLv = efx.chain || (b.attackEffect === "chain" ? 1 : 0);
              if (cryoLv > 0) {
                const dur = [2, 3, 4][cryoLv - 1];
                const slow = [0.4, 0.55, 0.7][cryoLv - 1];
                u._cryoSlowUntil = state.t + dur;
                u._cryoSlowAmount = slow;
              }
              if (fireLv > 0) {
                const dur = [3, 4, 5][fireLv - 1];
                const dps = [3, 5, 8][fireLv - 1];
                u._fireDotUntil = state.t + dur;
                u._fireDotDps = dps;
                u._fireDotOwner = b.ownerId;
              }
              if (chainLv > 0 && !b._chainDepth) {
                let chainDmg = b.dmg;
                let lastX = u.x, lastY = u.y;
                const hitIds = new Set([u.id]);
                const maxBounces = CFG.CHAIN_MAX_BOUNCES * chainLv;
                for (let bounce = 0; bounce < maxBounces; bounce++) {
                  chainDmg = Math.round(chainDmg * 0.7);
                  if (chainDmg < 1) break;
                  let bestTarget = null, bestD = CFG.CHAIN_BOUNCE_R * CFG.CHAIN_BOUNCE_R;
                  for (const v of state.units.values()) {
                    if (v.owner === b.ownerId || hitIds.has(v.id)) continue;
                    const d2 = (v.x - lastX) ** 2 + (v.y - lastY) ** 2;
                    if (d2 < bestD) { bestD = d2; bestTarget = v; }
                  }
                  if (!bestTarget) break;
                  hitIds.add(bestTarget.id);
                  applyUnitDamage(bestTarget, chainDmg, b.ownerId);
                  bestTarget._hitFlashT = state.t;
                  if (typeof playLaserSound === "function") playLaserSound(lastX, lastY, bestTarget.x, bestTarget.y);
                  state.bullets.push({
                    type: "laser", fromX: lastX, fromY: lastY,
                    toX: bestTarget.x, toY: bestTarget.y,
                    color: 0x44aaff, ownerId: b.ownerId, dmg: 0,
                    duration: 0.15, progress: 0.5,
                    targetId: bestTarget.id, targetType: "unit",
                    _chainDepth: bounce + 1
                  });
                  state.floatingDamage.push({ x: bestTarget.x, y: bestTarget.y - 22, text: "⚡-" + chainDmg, color: 0x44aaff, ttl: 0.8 });
                  lastX = bestTarget.x; lastY = bestTarget.y;
                }
              }
            }
          } else if (b.targetType === "turret") {
            const t = state.turrets.get(b.targetId);
            if (t && t.owner !== b.ownerId) {
              t.hp = Math.max(0, t.hp - b.dmg);
              state.floatingDamage.push({ x: t.x, y: t.y - 18, text: "-" + b.dmg, color: b.color ?? 0xaa44ff, ttl: 1.0 });
              if (t.hp <= 0) { spawnXPOrb(t.x, t.y, 8); t._diedAt = state.t; }
            }
          } else if (b.targetType === "pirateBase") {
            if (state.pirateBase && state.pirateBase.hp > 0) {
              state.pirateBase.hp = Math.max(0, state.pirateBase.hp - b.dmg);
              state.pirateBase.lastDamagedBy = b.ownerId;
              state.pirateBase._lastAttackedAt = state.t;
              state.pirateBase._attackerX = b.fromX ?? state.pirateBase.x;
              state.pirateBase._attackerY = b.fromY ?? state.pirateBase.y;
              state.floatingDamage.push({ x: state.pirateBase.x, y: state.pirateBase.y - 30, text: "-" + b.dmg, color: b.color ?? 0xaa44ff, ttl: 0.9 });
              if (state.pirateBase.hp <= 0) {
                const killerId = state.pirateBase.lastDamagedBy;
                const killer = killerId != null ? state.players.get(killerId) : null;
                if (killer) {
                  for (let L = 0; L < 10; L++) {
                    killer.level = (killer.level || 1) + 1;
                    killer.pendingCardPicks = (killer.pendingCardPicks || 0) + 1;
                    killer._levelBonusMul = 1 + (killer.level || 1) * 0.01;
                    killer.xpNext = xpNeed(killer.level, killer);
                  }
                  state.floatingDamage.push({ x: killer.x, y: killer.y - 50, text: "+10 ур.!", color: 0xffdd00, ttl: 3 });
                }
                for (const m of state.mines.values()) {
                  if (m.isRich) { m.ownerId = null; m.captureProgress = 0; m._capturingOwner = null; m._captureProtectedUntil = 0; updateMineVisual(m); break; }
                }
                if (state.pirateBase.gfx && state.pirateBase.gfx.parent) state.pirateBase.gfx.parent.removeChild(state.pirateBase.gfx);
                if (state.pirateBase._emojiGfx && state.pirateBase._emojiGfx.parent) state.pirateBase._emojiGfx.parent.removeChild(state.pirateBase._emojiGfx);
                state.pirateBase.gfx = null;
                state.pirateBase._emojiGfx = null;
                state.pirateBase = null;
              }
            }
          } else if (b.targetType === "city") {
            const p = state.players.get(b.targetId);
            if (p && p.id !== b.ownerId) {
              p._lastCityAttacker = b.ownerId;
              if ((p.shieldHp || 0) > 0) {
                pushShieldHitEffect(p.x, p.y, shieldRadius(p), b.fromX, b.fromY, b.color ?? 0xaa44ff);
                p.shieldHp = Math.max(0, p.shieldHp - b.dmg);
                if (p.shieldHp === 0) p.shieldRegenCd = SHIELD_REGEN_DELAY;
                state.floatingDamage.push({ x: b.toX, y: b.toY - 10, text: "💥🛡 -" + b.dmg, color: b.color ?? 0xaa44ff, ttl: 0.9 });
              } else {
                p.popFloat = Math.max(0, (p.popFloat || p.pop || 0) - b.dmg * 0.1);
                p.pop = Math.floor(p.popFloat);
                state.floatingDamage.push({ x: p.x, y: p.y - 40, text: "-" + b.dmg, color: b.color ?? 0xff4444, ttl: 0.9 });
              }
            }
          }
          state.bullets.splice(i, 1);
        }
        continue;
      }

      if (b.type === "ranged") {
        if (b.targetType === "unit" && b.targetId != null) {
          const u = state.units.get(b.targetId);
          if (!u) { state.bullets.splice(i, 1); continue; }
          const range = (CFG.TURRET_ATTACK_RADIUS ?? 45) * 1.6 * 1.5;
          const owner = state.players.get(b.ownerId);
          const tr = owner && owner.turretRangeMul != null ? owner.turretRangeMul : 1;
          const maxR = range * tr;
          const tx = b.fromX ?? b.x, ty = b.fromY ?? b.y;
          if ((u.x - tx) ** 2 + (u.y - ty) ** 2 > maxR * maxR) { state.bullets.splice(i, 1); continue; }
        }
        const dx = b.toX - b.x, dy = b.toY - b.y;
        const dl = Math.hypot(dx, dy) || 1;
        const step = b.speed * dt;
        b.x += (dx / dl) * step;
        b.y += (dy / dl) * step;
        b.traveled += step;

        // ── Shield intercept: AOE projectiles can hit shields ──
        if (b.aoe) {
          let shieldHit = false;
          for (const p of state.players.values()) {
            if (p.id === b.ownerId || (p.shieldHp || 0) <= 0) continue;
            const sR = shieldRadius(p) + 1;
            if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 <= sR * sR) {
              pushShieldHitEffect(p.x, p.y, sR - 1, b.x, b.y, p.color);
              p.shieldHp = Math.max(0, p.shieldHp - b.dmg);
              if (p.shieldHp === 0) p.shieldRegenCd = SHIELD_REGEN_DELAY;
              state.floatingDamage.push({ x: p.x, y: p.y - 40, text: "🛡 -" + b.dmg, color: p.color, ttl: 0.9 });
              shieldHit = true;
              break;
            }
          }
          if (shieldHit) { state.bullets.splice(i, 1); continue; }
        }

        let hit = false;
        // AOE hit: damage all units in radius
        if (b.aoe) {
          const aoeR = (b.hitR || 8) * 2.5;
          const nearby = queryHash(b.x, b.y, aoeR + 20);
          for (let j = 0; j < nearby.length; j++) {
            const u = nearby[j];
            if (u.owner === b.ownerId) continue;
            const uHitR = getUnitHitRadius(u);
            if ((b.x - u.x) ** 2 + (b.y - u.y) ** 2 <= (aoeR + uHitR) * (aoeR + uHitR)) {
              applyUnitDamage(u, b.dmg, b.ownerId);
              u._hitFlashT = state.t;
              state.floatingDamage.push({ x: u.x, y: u.y - 22, text: "-" + b.dmg, color: 0xffaa00, ttl: 1.0 });
              hit = true; // continue hitting — don't break
            }
          }
        } else {
        const nearby = queryHash(b.x, b.y, b.hitR + 20);
        for (let j = 0; j < nearby.length; j++) {
          const u = nearby[j];
          if (u.owner === b.ownerId) continue;
          const uHitR = getUnitHitRadius(u);
          const totalR = b.hitR + uHitR;
          if ((b.x - u.x) ** 2 + (b.y - u.y) ** 2 <= totalR * totalR) {
            applyUnitDamage(u, b.dmg, b.ownerId);
            u._hitFlashT = state.t;
            state.floatingDamage.push({ x: u.x, y: u.y - 22, text: "-" + b.dmg, color: 0xffaa00, ttl: 1.0 });
            hit = true;
            break;
          }
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
        if (hit) {
          state.bullets.splice(i, 1);
        } else if (b.traveled > b.maxDist) {
          state.bullets.splice(i, 1);
        }
      } else {
        // Legacy arc-type bullet (city lob)
        b.progress = (b.progress || 0) + dt / b.duration;
        if (b.progress >= 1) {
          const u = state.units.get(b.targetId);
          if (u) { u.hp -= b.dmg; if (u.hp <= 0) killUnit(u, "city", b.ownerId); }
          state.bullets.splice(i, 1);
        }
      }
    }
  }

  /** Visual-only bullet simulation for remote clients (no damage, no hit detection). */
  function stepBulletsVisual(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      if (b.type === "laser") {
        if (b.targetType === "unit" && b.targetId != null && !state.units.has(b.targetId)) {
          state.bullets.splice(i, 1); continue;
        }
        if (b.targetType === "city" && b.targetId != null) {
          const p = state.players.get(b.targetId);
          if (!p || p.eliminated) { state.bullets.splice(i, 1); continue; }
        }
        b.progress = (b.progress || 0) + dt / (b.duration || 0.2);
        if (b.progress >= 1) state.bullets.splice(i, 1);
      } else if (b.type === "ranged") {
        const dx = b.toX - b.x, dy = b.toY - b.y;
        const dl = Math.hypot(dx, dy) || 1;
        const step = (b.speed || 160) * dt;
        b.x += (dx / dl) * step;
        b.y += (dy / dl) * step;
        b.traveled = (b.traveled || 0) + step;
        if (b.big && b.aoe) {
          const owner = state.players.get(b.ownerId);
          const zoneR = owner ? (owner.influenceR || 240) : 300;
          const flightTime = state.t - (b.spawnTime ?? state.t);
          const ttlExpired = flightTime >= 60;
          let atBoundary = false;
          if (owner) {
            const dFromCenter = Math.hypot(b.x - owner.x, b.y - owner.y);
            if (dFromCenter >= zoneR) atBoundary = true;
            else if (owner.influencePolygon && owner.influencePolygon.length >= 3 && !isPointInPolygon(b.x, b.y, owner.influencePolygon)) atBoundary = true;
          }
          if (ttlExpired || atBoundary) state.bullets.splice(i, 1);
        } else if (b.traveled > (b.maxDist || 80)) {
          state.bullets.splice(i, 1);
        }
      } else {
        b.progress = (b.progress || 0) + dt / (b.duration || 0.5);
        if (b.progress >= 1) state.bullets.splice(i, 1);
      }
    }
  }

  let _bulletsGfx = null;
  function drawBullets() {
    if (!_bulletsGfx || _bulletsGfx.destroyed) {
      _bulletsGfx = new PIXI.Graphics();
      bulletsLayer.addChild(_bulletsGfx);
    }
    _bulletsGfx.clear();
    if (state.bullets.length === 0) return;
    const g = _bulletsGfx;
    for (let i = 0; i < state.bullets.length; i++) {
      const b = state.bullets[i];

      if (b.type === "laser") {
        const t = Math.min(1, b.progress || 0);
        const tipX = b.fromX + (b.toX - b.fromX) * t;
        const tipY = b.fromY + (b.toY - b.fromY) * t;
        if (!inView(tipX, tipY) && !inView(b.fromX, b.fromY)) continue;

        const col = b.color ?? 0xaa44ff;
        const big = b.big;
        const fadeIn = Math.min(1, t * 5);
        const fadeOut = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
        const fade = fadeIn * fadeOut;

        g.moveTo(b.fromX, b.fromY); g.lineTo(tipX, tipY);
        g.stroke({ color: col, width: big ? 22 : 14, alpha: 0.1 * fade });
        g.moveTo(b.fromX, b.fromY); g.lineTo(tipX, tipY);
        g.stroke({ color: col, width: big ? 10 : 7, alpha: 0.3 * fade });
        g.moveTo(b.fromX, b.fromY); g.lineTo(tipX, tipY);
        g.stroke({ color: col, width: big ? 4 : 2.5, alpha: 0.85 * fade });
        g.moveTo(b.fromX, b.fromY); g.lineTo(tipX, tipY);
        g.stroke({ color: 0xffffff, width: big ? 2 : 1, alpha: 0.9 * fade });

        g.circle(tipX, tipY, big ? 4 : 2.5);
        g.fill({ color: 0xffffff, alpha: 0.7 * fade });

      } else if (b.type === "ranged") {
        if (!inView(b.x || b.fromX, b.y || b.fromY)) continue;
        const dx = b.toX - b.fromX, dy = b.toY - b.fromY;
        const dl = Math.hypot(dx, dy) || 1;
        const tx = -(dx / dl) * 6, ty = -(dy / dl) * 6;
        const bPulse = 0.7 + 0.3 * Math.sin(performance.now() / 100 + (b.x || 0) * 0.1);
        const bCol = b.color ?? 0xffaa44;
        // City shots: small bullet + trail only (no glow circles)
        if (b.aoe) {
          const borderFade = b._fadeAlpha != null ? b._fadeAlpha : 1;
          g.lineStyle(3, bCol, 0.4 * bPulse * borderFade);
          g.moveTo(b.x, b.y); g.lineTo(b.x + tx * 3, b.y + ty * 3);
          g.lineStyle(1.5, bCol, 0.6 * bPulse * borderFade);
          g.moveTo(b.x, b.y); g.lineTo(b.x + tx * 2, b.y + ty * 2);
          g.beginFill(bCol, 0.9 * borderFade);
          g.drawCircle(b.x, b.y, 2.5);
          g.endFill();
        } else {
          g.beginFill(bCol, 0.12 * bPulse);
          g.drawCircle(b.x, b.y, 7);
          g.endFill();
          g.lineStyle(2, bCol, 0.9);
          g.moveTo(b.x, b.y); g.lineTo(b.x + tx, b.y + ty);
          g.beginFill(bCol, 1);
          g.drawCircle(b.x, b.y, b.big ? 4 : 2.5);
          g.endFill();
        }

      } else {
        if (!inView(b.fromX, b.fromY)) continue;
        const t = Math.min(1, b.progress || 0);
        const x = b.fromX + (b.toX - b.fromX) * t;
        const y = b.fromY + (b.toY - b.fromY) * t;
        g.beginFill(b.color ?? 0xffff00, 1);
        g.drawCircle(x, y, b.big ? 6 : 5);
        g.endFill();
      }
    }
  }

  function destroyCity(p) {
    if (p.cityGfx) cityLayer.removeChild(p.cityGfx);
    if (p.label) cityLayer.removeChild(p.label);
    if (p.popLabel) cityLayer.removeChild(p.popLabel);
    if (p.shieldGfx) { cityLayer.removeChild(p.shieldGfx); p.shieldGfx = null; }
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
  const movB = balance.movement || {};
  const WAYPOINT_RADIUS = movB.waypointRadius ?? 28;
  const WAYPOINT_STOP_DIST = movB.waypointStopDist ?? 35;
  const FORMATION_DEAD_ZONE = movB.formationDeadZone ?? 14;
  const FORMATION_ARRIVAL_R = 20;
  const FORMATION_COOLDOWN = movB.formationCooldown ?? 0.5;
  const FORMATION_TARGET_THRESHOLD = movB.formationTargetThreshold ?? 25;
  const MAX_FORMATION_FORCE = movB.maxFormationForce ?? 0.3;
  const MIN_PERSONAL_DIST = movB.minPersonalDist ?? 16;
  const SEPARATION_PUSH = movB.separationPush ?? 0.5;

  function stepUnits(dt) {
    const useSquadLogic = typeof SQUADLOGIC !== "undefined" && SQUADLOGIC.getUnitMovementTarget;
    // ═══════════════════════════════════════════════════════════════════
    // UNIFIED MOVEMENT PIPELINE v2 — position-based, no force chains
    // Each unit resolves to a single target (tx,ty) then moves toward it
    // ═══════════════════════════════════════════════════════════════════
    for (const u of state.units.values()) {
      if (u.leaderId && !state.units.get(u.leaderId)) u.leaderId = null;
      const leader = u.leaderId ? state.units.get(u.leaderId) : null;

      // ── 1. SPEED CALCULATION (squad speed from cache) ─────────────
      const zoneOwner = getZoneOwnerFast(u.x, u.y);
      u._territoryMul = zoneOwner === u.owner ? 1.1 : (zoneOwner !== 0 && zoneOwner !== u.owner ? 0.9 : 1);
      const terrainSpd = getTerrainSpeedMultiplier(u.x, u.y);
      const owner = state.players.get(u.owner);
      let unitSpeedMul = (owner && owner.unitSpeedMul != null ? owner.unitSpeedMul : 1) * getLevelBonusMul(owner);
      if (owner && state._battleMarchUntil && state._battleMarchUntil[owner.id] > state.t) unitSpeedMul *= 1.3;
      const classOrder = ["fighter", "destroyer", "cruiser", "battleship", "hyperDestroyer"];
      const classIdx = classOrder.indexOf(u.unitType || "fighter");
      const individualSpeed = (u.speed || UNIT_TYPES[u.unitType || "fighter"]?.speed || 9) * 1.1 * Math.max(0.5, 1 - classIdx * 0.06);
      let baseSpeed;
      if (useSquadLogic && u.squadId != null) {
        baseSpeed = SQUADLOGIC.getSquadSpeed(state, u.squadId) || individualSpeed;
      } else {
        baseSpeed = individualSpeed;
      }
      const cryoSpd = (u._cryoSlowUntil && state.t < u._cryoSlowUntil) ? (1 - (u._cryoSlowAmount || CFG.CRYO_SLOW)) : 1;
      let hyperMul = 1;
      if (u._pirateHyperUntil && state.t < u._pirateHyperUntil) {
        const wpH = u.waypoints;
        const tgtH = wpH && wpH.length ? wpH[0] : null;
        hyperMul = tgtH && Math.hypot(tgtH.x - u.x, tgtH.y - u.y) > PIRATE_RAID_HYPER_DIST ? PIRATE_RAID_HYPER_SPEED_MUL : 1;
      }
      const fleetBoostMul = (state._fleetBoostUntil && state._fleetBoostUntil[u.owner] && state.t < state._fleetBoostUntil[u.owner]) ? 1.5 : 1;
      const speedMuls = terrainSpd * unitSpeedMul * (u._territoryMul ?? 1) * cryoSpd * hyperMul * fleetBoostMul;
      const speed = baseSpeed * speedMuls;
      const maxMove = speed * dt;
      const maxMoveIndividual = individualSpeed * speedMuls * dt;

      // ── 2. RESOLVE TARGET POSITION ────────────────────────────────
      let tx = u.x, ty = u.y;
      let moveMode = "stop"; // stop | combat | orbit | formation | waypoint | straight

      const attackingShield = u.chaseTargetCityId != null && (() => {
        const c = state.players.get(u.chaseTargetCityId);
        return c && (c.shieldHp || 0) > 0;
      })();

      const combatHelpers = { getUnitAtkRange, getUnitEngagementRange, getUnitBaseSpeed, shieldRadius, getPlanetRadius, getUnitHitRadius };

      if (useSquadLogic) {
        const movement = SQUADLOGIC.getUnitMovementTarget(u, state, combatHelpers);
        if (movement) {
          tx = movement.tx;
          ty = movement.ty;
          moveMode = movement.moveMode || "formation_move";
        }
        if (state.pirateBase && state.pirateBase.hp > 0 && u.owner !== PIRATE_OWNER_ID) {
          const pb = state.pirateBase;
          const pbDist = Math.hypot(u.x - pb.x, u.y - pb.y);
          const atkR = getUnitAtkRange(u);
          if (pbDist < atkR * 1.5 && moveMode !== "stop") {
            const sq = u.squadId != null ? state.squads?.get(u.squadId) : null;
            if (sq) {
              const sqUnits = SQUADLOGIC.getSquadUnits(state, sq);
              const ui = sqUnits.indexOf(u);
              if (ui >= 0) {
                const angle = (ui / Math.max(1, sqUnits.length)) * Math.PI * 2;
                tx = pb.x + Math.cos(angle) * atkR * 0.85;
                ty = pb.y + Math.sin(angle) * atkR * 0.85;
                moveMode = "squad_anchor";
              }
            }
          }
        }
      }

      if (moveMode === "stop") {
        const wp = u.waypoints;
        const idx = u.waypointIndex ?? 0;
        if (wp && idx < wp.length) {
          const margin = 60;
          const wt = wp[idx];
          let wtx = clamp(wt.x, margin, CFG.WORLD_W - margin);
          let wty = clamp(wt.y, margin, CFG.WORLD_H - margin);
          const hasChaseTarget = u.chaseTargetUnitId != null || u.chaseTargetCityId != null;
          if (!u.leaderId && !hasChaseTarget) {
            const lox = u.formationOffsetX ?? 0;
            const loy = u.formationOffsetY ?? 0;
            if (lox !== 0 || loy !== 0) {
              const fdelta = (u._lastFacingAngle ?? 0) - (u._formationAngle ?? 0);
              if (Math.abs(fdelta) < 0.01) {
                wtx += lox; wty += loy;
              } else {
                const fcos = Math.cos(fdelta), fsin = Math.sin(fdelta);
                wtx += lox * fcos - loy * fsin;
                wty += lox * fsin + loy * fcos;
              }
            }
          }
          const wDist = Math.hypot(wtx - u.x, wty - u.y);
          if (wDist <= WAYPOINT_RADIUS) {
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
              const nw = wp[u.waypointIndex];
              let nx = clamp(nw.x, margin, CFG.WORLD_W - margin);
              let ny = clamp(nw.y, margin, CFG.WORLD_H - margin);
              if (!u.leaderId && !hasChaseTarget) {
                const lox2 = u.formationOffsetX ?? 0;
                const loy2 = u.formationOffsetY ?? 0;
                if (lox2 !== 0 || loy2 !== 0) {
                  const fdelta2 = (u._lastFacingAngle ?? 0) - (u._formationAngle ?? 0);
                  if (Math.abs(fdelta2) < 0.01) {
                    nx += lox2; ny += loy2;
                  } else {
                    const fcos2 = Math.cos(fdelta2), fsin2 = Math.sin(fdelta2);
                    nx += lox2 * fcos2 - loy2 * fsin2;
                    ny += lox2 * fsin2 + loy2 * fcos2;
                  }
                }
              }
              tx = nx;
              ty = ny;
              moveMode = "waypoint";
            }
          } else {
            tx = wtx;
            ty = wty;
            moveMode = "waypoint";
          }
        } else if (u.straightMode && (u.vx || u.vy)) {
          tx = u.x + u.vx * 100;
          ty = u.y + u.vy * 100;
          moveMode = "straight";
        }
      }

      // ── 3. MOVE TOWARD TARGET (with ship turning) ─────────────────
      let dx = tx - u.x, dy = ty - u.y;
      let dist = Math.hypot(dx, dy);
      const TURN_RATE = 4.5;

      if (moveMode === "free_chase" && dist > 1) {
        const atkR = getUnitAtkRange(u) * 0.85;
        if (dist <= atkR) {
          moveMode = "stop";
          const faceAngle = Math.atan2(dy, dx);
          u._lastFacingAngle = faceAngle;
          u.vx = Math.cos(faceAngle);
          u.vy = Math.sin(faceAngle);
        }
      }

      if (dist < 2 && moveMode !== "stop") {
        u.vx = leader?.vx || 0;
        u.vy = leader?.vy || 0;
      } else if (dist > 0.5 && moveMode !== "stop") {
        const desiredAngle = Math.atan2(dy, dx);
        let curFacing = u._lastFacingAngle ?? desiredAngle;
        let angleDiff = desiredAngle - curFacing;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const turnStep = TURN_RATE * dt;
        if (Math.abs(angleDiff) > turnStep) {
          curFacing += Math.sign(angleDiff) * turnStep;
        } else {
          curFacing = desiredAngle;
        }
        u._lastFacingAngle = curFacing;
        const dirX = Math.cos(curFacing), dirY = Math.sin(curFacing);
        u.vx = dirX;
        u.vy = dirY;

        const facingDot = Math.cos(angleDiff);
        const moveScale = Math.max(0, facingDot);

        const isFreeChase = moveMode === "free_chase";
        const effectiveMax = isFreeChase ? maxMoveIndividual : maxMove;
        const decel = (!isFreeChase && dist < 20) ? (dist / 20) : 1;
        const moveDist = Math.min(effectiveMax * decel * moveScale, dist);
        if (moveDist > 0.01) {
          u.x += Math.cos(curFacing) * moveDist;
          u.y += Math.sin(curFacing) * moveDist;
        }
        const spd = dt > 0 ? moveDist / dt : 0;
        u.vx = dirX * spd;
        u.vy = dirY * spd;
      }

      // ── 4. SEPARATION (size-aware, prevents small ships falling under big ones)
      {
        const uType = UNIT_TYPES[u.unitType] || UNIT_TYPES.fighter;
        const uSize = (uType.sizeMultiplier || 1) * 6 + 8;
        const searchR = uSize + 40;
        const neighbors = queryHash(u.x, u.y, searchR);
        let sx = 0, sy = 0;
        for (let ni = 0; ni < neighbors.length; ni++) {
          const v = neighbors[ni];
          if (v.id === u.id) continue;
          const vType = UNIT_TYPES[v.unitType] || UNIT_TYPES.fighter;
          const vSize = (vType.sizeMultiplier || 1) * 6 + 8;
          const minDist = (uSize + vSize) * 0.7;
          const sdx = u.x - v.x, sdy = u.y - v.y;
          const sDist = Math.hypot(sdx, sdy);
          if (sDist < minDist && sDist > 0.1) {
            const isEnemy = v.owner !== u.owner;
            const push = ((minDist - sDist) / minDist) * (isEnemy ? 1.2 : 0.5);
            sx += (sdx / sDist) * push;
            sy += (sdy / sDist) * push;
          }
        }
        const sl = Math.hypot(sx, sy);
        if (sl > 2.0) { sx *= 2.0 / sl; sy *= 2.0 / sl; }
        u.x += sx;
        u.y += sy;
      }

      // ── 4b. ZONE BOUNDARY CONTAINMENT ──
      if (useSquadLogic && u.squadId != null && u._combatState && u._combatState !== "idle") {
        const sq = state.squads.get(u.squadId);
        if (sq && sq.combat.zoneId != null) {
          const zone = state.engagementZones.get(sq.combat.zoneId);
          const steer = SQUADLOGIC.getZoneBoundarySteer(u.x, u.y, zone);
          if (steer) {
            const push = steer.strength * maxMove * 0.8;
            u.x += steer.sx * push;
            u.y += steer.sy * push;
          }
        }
      }

      // ── 5. SHIELD PUSH + MINE PUSH + WORLD CLAMP ─────────────────
      for (const cp of state.players.values()) {
        if (cp.eliminated) continue;
        const noFlyR = shieldRadius(cp);
        const dToCity = Math.hypot(u.x - cp.x, u.y - cp.y);
        if (dToCity > 0 && dToCity < noFlyR) {
          const scale = noFlyR / dToCity;
          u.x = cp.x + (u.x - cp.x) * scale;
          u.y = cp.y + (u.y - cp.y) * scale;
        }
      }
      const mineR = (CFG.MINE_CAPTURE_RADIUS || 140) * 0.35;
      for (const mine of state.mines.values()) {
        const dToMine = Math.hypot(u.x - mine.x, u.y - mine.y);
        if (dToMine > 0 && dToMine < mineR) {
          const scale = mineR / dToMine;
          u.x = mine.x + (u.x - mine.x) * scale;
          u.y = mine.y + (u.y - mine.y) * scale;
        }
      }
      const inPirateHyper = u._pirateHyperUntil && state.t < u._pirateHyperUntil;
      if (inPirateHyper) {
        u.x = clamp(u.x, -500, CFG.WORLD_W + 500);
        u.y = clamp(u.y, -500, CFG.WORLD_H + 500);
      } else {
        u.x = clamp(u.x, 0, CFG.WORLD_W);
        u.y = clamp(u.y, 0, CFG.WORLD_H);
      }

      // ── 6. HITBOX COLLISION (enemies only, mass-based) ─────────────
      // Friendly units pass through each other completely.
      // Enemy OBB collision blocks and pushes units apart.
      {
        const uBR = getUnitBoundingR(u);
        const searchR = uBR * 2 + 15;
        const nearU = queryHash(u.x, u.y, searchR);
        const massU = u.sizeMultiplier || 1;
        const obbA = getUnitOBB(u);
        for (let ni = 0; ni < nearU.length; ni++) {
          const v = nearU[ni];
          if (v.id === u.id || v.owner === u.owner) continue;
          const roughD = Math.abs(u.x - v.x) + Math.abs(u.y - v.y);
          if (roughD > searchR) continue;
          const obbB = getUnitOBB(v);
          const hit = obbOverlap(obbA, obbB);
          if (!hit) continue;
          const massV = v.sizeMultiplier || 1;
          const massRatio = massV / (massU + massV);
          const push = Math.min(hit.overlap * 0.15 * dt, hit.overlap * 0.04) * massRatio;
          u.x += hit.nx * push;
          u.y += hit.ny * push;
          if (u._combatState === "idle" || u._combatState === "move") {
            if (typeof SQUADLOGIC !== "undefined" && SQUADLOGIC.recordDamageSource) {
              SQUADLOGIC.recordDamageSource(u, v.id, state);
            } else {
              u._lastDamagedByUnitId = v.id;
              u._lastDamagedAt = state.t;
            }
          }
        }
      }

      if (u.gfx) {
        const vis = inView(u.x, u.y);
        u.gfx.visible = vis;
        const spd = Math.hypot(u.vx || 0, u.vy || 0);
        if (spd > 2 && (state._frameCtr + u.id) % 2 === 0) {
          if (!u._trail) u._trail = [];
          u._trail.push({ x: u.x, y: u.y });
          if (u._trail.length > 10) u._trail.shift();
        } else if (spd <= 2 && u._trail) u._trail = [];
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
            drawShipShape(u.gfx, u.unitType || "fighter", u.color || 0x888888, col);
            if ((u._activeShieldHp != null && u._activeShieldHp > 0) || (u._activeShieldEffectUntil != null && state.t < u._activeShieldEffectUntil)) {
              const shieldR = getUnitHitRadius(u) + 6;
              const shieldPulse = 0.5 + 0.3 * Math.sin(state.t * 4 + u.id);
              const shieldPct = u._activeShieldHp ? Math.min(1, u._activeShieldHp / ((u.maxHp || 1) * 0.25)) : 0.3;
              u.gfx.circle(0, 0, shieldR);
              u.gfx.fill({ color: 0x2266cc, alpha: 0.06 * shieldPct });
              u.gfx.circle(0, 0, shieldR);
              u.gfx.stroke({ color: 0x44aaff, width: 2.5, alpha: (0.4 + 0.2 * shieldPulse) * shieldPct });
              u.gfx.circle(0, 0, shieldR + 3);
              u.gfx.stroke({ color: 0x88ddff, width: 1, alpha: 0.2 * shieldPct });
            }
            const ownerForMarch = state.players.get(u.owner);
            if (ownerForMarch && state._battleMarchUntil && state._battleMarchUntil[ownerForMarch.id] > state.t) {
              const marchAlpha = 0.15 + 0.1 * Math.sin(state.t * 5 + u.id);
              const trailLen = (UNIT_TYPES[u.unitType]?.sizeMultiplier || 1) * 8 + 6;
              u.gfx.moveTo(0, 0);
              u.gfx.lineTo(-trailLen, -3);
              u.gfx.lineTo(-trailLen, 3);
              u.gfx.closePath();
              u.gfx.fill({ color: 0xffaa22, alpha: marchAlpha });
            }
            if (hovered) {
              const hType = UNIT_TYPES[u.unitType] || UNIT_TYPES.fighter;
              const hR = hType.sizeMultiplier * 6 + 8;
              u.gfx.circle(0, 0, hR);
              u.gfx.stroke({ color: 0xff4444, width: 2, alpha: 0.8 });
            }
          }
          u.gfx.position.set(u.x, u.y);
          const vx = u.vx || 0, vy = u.vy || 0;
          const targetRot = (vx !== 0 || vy !== 0) ? Math.atan2(vy, vx) : (u.gfx.rotation);
          let curRot = u.gfx.rotation;
          let diff = targetRot - curRot;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const isLeader = !u.leaderId;
          const baseTurnSpeed = (u.unitType === "fighter" ? 8 : u.unitType === "destroyer" ? 5 : u.unitType === "cruiser" ? 3.5 : 2.5);
          const turnSpeed = isLeader ? baseTurnSpeed * 2.2 : baseTurnSpeed;
          const step = Math.min(Math.PI * 0.5, turnSpeed * (state._lastDt || 0.016));
          if (Math.abs(diff) < step) u.gfx.rotation = targetRot;
          else u.gfx.rotation = curRot + Math.sign(diff) * step;
        }
      }
    }
  }

  // Combat debug labels (shows state above each unit)
  function updateCombatDebugLabels() {
    const debugEnabled = typeof COMBAT !== "undefined" && COMBAT.DEBUG && COMBAT.DEBUG.enabled;
    
    if (!debugEnabled) {
      // Clear all labels
      for (const [uid, label] of combatDebugLabels) {
        if (label.parent) label.parent.removeChild(label);
        label.destroy();
      }
      combatDebugLabels.clear();
      return;
    }
    
    const activeIds = new Set();
    for (const u of state.units.values()) {
      if (u.hp <= 0) continue;
      if (!inView(u.x, u.y)) continue;
      
      activeIds.add(u.id);
      let label = combatDebugLabels.get(u.id);
      
      if (!label) {
        label = new PIXI.Text({
          text: "",
          style: {
            fontFamily: "monospace",
            fontSize: 10,
            fill: 0xffffff,
            stroke: { color: 0x000000, width: 2 }
          }
        });
        label.anchor.set(0.5, 1);
        combatDebugLayer.addChild(label);
        combatDebugLabels.set(u.id, label);
      }
      
      const stateLabel = COMBAT.getStateLabel ? COMBAT.getStateLabel(u) : "?";
      let targetDist = "";
      if (u._currentTargetId != null) {
        const tgt = state.units.get(u._currentTargetId);
        if (tgt) targetDist = ` d${Math.round(Math.hypot(tgt.x - u.x, tgt.y - u.y))}`;
      }
      const targetInfo = u._currentTargetId != null ? `>${u._currentTargetId}${targetDist}` : "";
      const cityInfo = u._siegeTargetId != null ? `[S]` : "";
      const cdInfo = u.atkCd > 0 ? ` cd${u.atkCd.toFixed(1)}` : "";
      // Squad engagement info for leaders
      const engLabel = (!u.leaderId && COMBAT.getEngagementLabel) ? COMBAT.getEngagementLabel(u) : "";
      // Phase indicator for followers
      let phaseTag = "";
      if (u.leaderId) {
        const sqLdr = state.units.get(u.leaderId);
        if (sqLdr && sqLdr._squadCombatPhase) phaseTag = sqLdr._squadCombatPhase === "engaged" ? " E" : " A";
      }
      label.text = `${stateLabel}${targetInfo}${cityInfo}${cdInfo}${engLabel}${phaseTag}`;
      label.position.set(u.x, u.y - 15);
      label.visible = true;
    }
    
    // Remove labels for dead/out-of-view units
    for (const [uid, label] of combatDebugLabels) {
      if (!activeIds.has(uid)) {
        if (label.parent) label.parent.removeChild(label);
        label.destroy();
        combatDebugLabels.delete(uid);
      }
    }
  }

  function stepSquadMerge(dt) {
    if (typeof SQUADLOGIC !== "undefined") return;
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
        mainLeader._formationAngle = mainLeader._lastFacingAngle ?? 0;
        for (const u of sub) {
          u.leaderId = mainLeaderId;
        }
        const mergedSquad = [...main, ...sub];
        applyFormationToSquad(mergedSquad, mainLeader.formationType || "lineByType", mainLeader.formationRows || 1, null, null, mainLeader.formationPigWidth);
      }
    }
  }

  function mergeBattleSurvivorsIntoOneSquad() {
    if (typeof SQUADLOGIC !== "undefined") return;
    const nowInCombat = new Set();
    for (const u of state.units.values()) {
      const cs = u._combatState;
      if (cs === "acquire" || cs === "chase" || cs === "attack" || cs === "siege") nowInCombat.add(u.id);
    }
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
        leader._formationAngle = leader._lastFacingAngle ?? 0;
        for (const u of comp) {
          u.leaderId = u.id === leaderId ? null : leaderId;
        }
        applyFormationToSquad(comp, leader.formationType || "lineByType", leader.formationRows || 1, null, null, leader.formationPigWidth);
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
      if ((r.type === "orb" || r.type === "credit") && !r._targetCity && !isInOverlapFast(r.x, r.y)) {
        const owner = getZoneOwnerFast(r.x, r.y);
        if (owner) {
          const p = state.players.get(owner);
          if (p) r._targetCity = owner;
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
        const minFlyTime = 0.4;
        const canPickup = !r._spawnedAt || (state.t - r._spawnedAt >= minFlyTime);
        if (dl < 28 && canPickup) {
          if (r.type === "credit") {
            p.eCredits = (p.eCredits || 0) + (r.value || 0);
          } else {
            gainXP(p, r.xp || 0);
          }
          if (p.id === state.myPlayerId) tickSound(1480, 0.03, 0.04);
          toDelete.push(r.id);
          continue;
        }
        const isRainbow = r.type === "rainbow";
        const magnetSpeed = CFG.RES_MAGNET_SPEED ?? 60;
        let speed = isRainbow ? magnetSpeed * 0.5 : magnetSpeed * 1.2;
        const terrain = getTerrainType(r.x, r.y);
        if (terrain === "shallowWater" || terrain === "deepWater") speed *= 1.4;
        if (!isRainbow) {
          const zoneOwner = getZoneOwnerFast(r.x, r.y);
          if (zoneOwner === r._targetCity) speed += magnetSpeed * 0.6;
        }
        const ease = Math.min(1, 350 / Math.max(dl, 40));
        speed *= (0.35 + 0.65 * ease);
        r.x += (dx / dl) * speed * dt;
        r.y += (dy / dl) * speed * dt;
        if (r.gfx) r.gfx.position.set(r.x, r.y);
      }

      const interceptProtected = r._interceptProtectUntil && state.t < r._interceptProtectUntil;
      if (!r._targetCity || !interceptProtected) {
        const nearby = queryHash(r.x, r.y, touchR);
        for (let i = 0; i < nearby.length; i++) {
          const u = nearby[i];
          if (r._targetCity && r._targetCity === u.owner) continue;
          if (interceptProtected && u.owner !== r._targetCity) continue;
          const uHR = getUnitHitRadius(u);
          const d2 = (u.x - r.x) ** 2 + (u.y - r.y) ** 2;
          if (d2 <= (uHR + 4) * (uHR + 4)) {
            r._targetCity = u.owner;
            r._interceptProtectUntil = state.t + 1.0;
            break;
          }
        }
      }

      if (!r._targetCity && r.type === "orb") {
        for (const p of state.players.values()) {
          if ((r.x - p.x) ** 2 + (r.y - p.y) ** 2 <= 100) {
            gainXP(p, r.xp || 0);
            if (p.id === state.myPlayerId) tickSound(1480, 0.03, 0.04);
            toDelete.push(r.id);
            break;
          }
        }
      }
      if (!r._targetCity && r.type === "credit") {
        for (const p of state.players.values()) {
          if ((r.x - p.x) ** 2 + (r.y - p.y) ** 2 <= 100) {
            p.eCredits = (p.eCredits || 0) + (r.value || 0);
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
        if (dist2(x, y, u.x, u.y) <= (u.attackRange || 40) * (u.attackRange || 40)) return true;
      }
    }
    return false;
  }

  function getNearestThreat(x, y) {
    let best = null;
    let bestD = 1e18;
    const fleeR2 = (CFG.RAINBOW_FLEE_DIST || 200) * (CFG.RAINBOW_FLEE_DIST || 200);
    for (const p of state.players.values()) {
      const d = dist2(x, y, p.x, p.y);
      if (d < bestD && isPointInPolygon(x, y, p.influencePolygon)) {
        bestD = d;
        best = { x: p.x, y: p.y };
      }
    }
    for (const u of state.units.values()) {
      const d = dist2(x, y, u.x, u.y);
      if (d < bestD && d <= (u.attackRange || 40) * (u.attackRange || 40)) {
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
        const cards = getRandomCards(3, p);
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

      const popCreditPerSec = Math.floor(p.pop / 100);
      if (popCreditPerSec > 0) {
        p.eCredits = (p.eCredits || 0) + popCreditPerSec * dt;
      }

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
        const otherR = other.influenceR || 0;
        const distToOther = Math.hypot(p.x - other.x, p.y - other.y);
        const maxPossibleReach = (p.influenceR || 0) + 20;
        if (distToOther > maxPossibleReach + otherR) continue;
        for (let i = 0; i < numRays; i++) {
          const angle = (i / numRays) * Math.PI * 2;
          const d = p.influenceRayDistances[i] ?? 0;
          const ex = p.x + Math.cos(angle) * d;
          const ey = p.y + Math.sin(angle) * d;
          const dToOther = (ex - other.x) ** 2 + (ey - other.y) ** 2;
          if (dToOther > otherR * otherR) continue;
          if (isPointInPolygon(ex, ey, other.influencePolygon)) boost[i] = 0;
        }
      }
      const speed = (CFG.INFLUENCE_GROWTH_SPEED ?? 0.15) * influenceSpeedMul;
      const maxGrowthDelta = 2;
      let maxR = 0;
      const pR = getPlanetRadius(p);
      const minInflR = Math.max(pR * 3, (p.shieldHp || 0) > 0 ? shieldRadius(p) + 3 : 0);
      for (let i = 0; i < numRays; i++) {
        const target = targetDist[i] ?? 0;
        let cur = p.influenceRayDistances[i] ?? target;
        const mul = boost[i];
        const lerpFactor = Math.min(1, dt * speed * mul);
        let delta = (target - cur) * lerpFactor;
        delta = delta > 0 ? Math.min(delta, maxGrowthDelta) : Math.max(delta, -maxGrowthDelta);
        cur = Math.max(minInflR, cur + delta);
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
  const PIRATE_FULL_SQUAD = ["fighter", "fighter", "fighter", "fighter", "fighter", "destroyer", "destroyer", "cruiser"];
  function botMergeSmallSquads(pid) {
    if (typeof SQUADLOGIC !== "undefined") {
      const squads = getSquads().filter(s => s.length > 0 && s[0].owner === pid);
      const mergeable = squads
        .map((s) => ({ units: s, squadId: s[0].squadId, center: s.reduce((acc, u) => ({ x: acc.x + u.x, y: acc.y + u.y }), { x: 0, y: 0 }) }))
        .filter((entry) => entry.squadId != null)
        .map((entry) => ({ ...entry, center: { x: entry.center.x / entry.units.length, y: entry.center.y / entry.units.length } }))
        .filter((entry) => {
          const squadState = state.squads.get(entry.squadId);
          return squadState && (!squadState.combat.mode || squadState.combat.mode === "idle");
        });
      if (mergeable.length < 2) return;
      mergeable.sort((a, b) => b.units.length - a.units.length);
      const main = mergeable[0];
      const toMerge = [main.squadId];
      for (let i = 1; i < mergeable.length; i++) {
        const other = mergeable[i];
        if (Math.hypot(other.center.x - main.center.x, other.center.y - main.center.y) <= 500) {
          toMerge.push(other.squadId);
        }
      }
      if (toMerge.length >= 2) {
        const merged = SQUADLOGIC.mergeSquads(state, toMerge, "line", 3, 1);
        if (merged) SQUADLOGIC.recalculateFormation(state, merged.id, { getFormationOffsets }, true);
      }
      return;
    }
    const squads = getSquads().filter(s => s.length > 0 && s[0].owner === pid);
    const isInCombat = u => { const cs = u._combatState; return cs === "acquire" || cs === "chase" || cs === "attack" || cs === "siege"; };
    const mergeable = squads.filter(s => !s.some(isInCombat));
    if (mergeable.length < 2) return;
    mergeable.sort((a, b) => b.length - a.length);
    const mainSquad = mergeable[0];
    const mainLeader = mainSquad.find(u => !u.leaderId) || mainSquad[0];
    const mainLeaderId = mainLeader.id;
    mainLeader._formationAngle = mainLeader._lastFacingAngle ?? 0;
    for (let i = 1; i < mergeable.length; i++) {
      for (const u of mergeable[i]) {
        u.leaderId = mainLeaderId;
        u.formationOffsetX = u.x - mainLeader.x;
        u.formationOffsetY = u.y - mainLeader.y;
      }
    }
  }

  const BOT_ARCHETYPES = {
    aggressor:  { attackW: 1.8, expandW: 0.6, defendW: 0.8, economyW: 0.5 },
    expander:   { attackW: 0.7, expandW: 1.8, defendW: 0.9, economyW: 1.2 },
    economist:  { attackW: 0.5, expandW: 1.0, defendW: 1.0, economyW: 2.0 },
    defensive:  { attackW: 0.6, expandW: 0.8, defendW: 2.0, economyW: 1.0 }
  };
  const BOT_ARCHETYPE_KEYS = Object.keys(BOT_ARCHETYPES);

  function botGetArchetype(p) {
    if (!p._botArchetype) {
      p._botArchetype = BOT_ARCHETYPE_KEYS[Math.abs(p.id * 7919) % BOT_ARCHETYPE_KEYS.length];
    }
    return BOT_ARCHETYPES[p._botArchetype];
  }

  function botEvalScores(p, arch) {
    const myUnits = [];
    let myHp = 0;
    for (const u of state.units.values()) {
      if (u.owner === p.id && u.hp > 0) { myUnits.push(u); myHp += u.hp; }
    }
    const ownedMines = [...state.mines.values()].filter(m => m.ownerId === p.id).length;
    const totalMines = state.mines.size || 1;
    const gameTime = state.t || 0;

    let nearestEnemyDist = 1e18, weakestEnemy = null, weakestEnemyHp = 1e18;
    let nearestThreatDist = 1e18, threatNearBase = false;
    for (const other of state.players.values()) {
      if (other.id === p.id || other.eliminated) continue;
      const d = Math.hypot(other.x - p.x, other.y - p.y);
      if (d < nearestEnemyDist) nearestEnemyDist = d;
      if (other.pop < weakestEnemyHp) { weakestEnemyHp = other.pop; weakestEnemy = other; }
      for (const u of state.units.values()) {
        if (u.owner !== other.id || u.hp <= 0) continue;
        const ud = Math.hypot(u.x - p.x, u.y - p.y);
        if (ud < nearestThreatDist) nearestThreatDist = ud;
        if (ud < (p.influenceR || 300)) threatNearBase = true;
      }
    }

    const economyScore = (1 - ownedMines / totalMines) * 100 * arch.economyW;
    const expandScore = (ownedMines < 3 ? 80 : ownedMines < 5 ? 40 : 10) * arch.expandW;
    const attackPower = myHp > 0 ? myHp / Math.max(1, weakestEnemyHp * 5) : 0;
    const attackScore = Math.min(100, attackPower * 60 + (gameTime > 120 ? 20 : 0)) * arch.attackW;
    const defendScore = (threatNearBase ? 90 : nearestThreatDist < 600 ? 50 : 10) * arch.defendW;

    return { economyScore, expandScore, attackScore, defendScore, myUnits, ownedMines, weakestEnemy, threatNearBase, nearestThreatDist };
  }

  function botThink(dt) {
    for (const p of state.players.values()) {
      if (p.id === state.myPlayerId) continue;
      if (state.botPlayerIds && !state.botPlayerIds.has(p.id)) continue;
      p._botAcc = (p._botAcc ?? 0) + dt;
      const tick = p._botAcc >= BOT_TICK;
      if (tick) p._botAcc = 0;

      if (tick) botMergeSmallSquads(p.id);
      if (!tick) continue;

      const arch = botGetArchetype(p);
      const scores = botEvalScores(p, arch);
      const { economyScore, expandScore, attackScore, defendScore, myUnits, ownedMines, weakestEnemy, threatNearBase } = scores;

      const squads = getSquads().filter(s => s.length > 0 && s[0].owner === p.id);
      const myUnitCount = myUnits.length;
      const stagingMinSize = 4;

      function estimatePower(units) {
        let total = 0;
        for (const u of units) {
          const rate = UNIT_TYPES[u.unitType || "fighter"]?.attackRate ?? 1;
          total += (u.hp || 0) + (u.dmg || 1) * rate * 40;
        }
        return Math.max(1, total);
      }

      function getEnemyPowerNear(x, y, ownerId, radius = 260) {
        let zoneThreat = 0;
        if (state.engagementZones) {
          for (const zone of state.engagementZones.values()) {
            if (Math.hypot(zone.anchorX - x, zone.anchorY - y) > zone.radius + radius) continue;
            for (const [otherOwnerId, power] of Object.entries(zone.powerByOwner || {})) {
              if (Number(otherOwnerId) !== ownerId) zoneThreat += power || 0;
            }
          }
        }
        if (zoneThreat > 0) return zoneThreat;
        let total = 0;
        const r2 = radius * radius;
        for (const u of state.units.values()) {
          if (u.owner === ownerId || u.hp <= 0) continue;
          const d2u = (u.x - x) ** 2 + (u.y - y) ** 2;
          if (d2u > r2) continue;
          const rate = UNIT_TYPES[u.unitType || "fighter"]?.attackRate ?? 1;
          total += (u.hp || 0) + (u.dmg || 1) * rate * 40;
        }
        return total;
      }

      function isDangerousForSquad(squad, x, y) {
        const squadPower = estimatePower(squad);
        const enemyPower = getEnemyPowerNear(x, y, squad[0]?.owner ?? p.id);
        return enemyPower > squadPower * 1.2;
      }

      function setSquadWaypoint(squad, x, y) {
        const leader = squad.find(u => !u.leaderId) || squad[0];
        if (isDangerousForSquad(squad, x, y)) return;
        if (typeof SQUADLOGIC !== "undefined" && leader.squadId != null) {
          SQUADLOGIC.issueMoveOrder(state, leader.squadId, [{ x, y }], Math.atan2(y - leader.y, x - leader.x));
          return;
        }
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

      function attackCity(squad, city) {
        const leader = squad.find(u => !u.leaderId) || squad[0];
        if (isDangerousForSquad(squad, city.x, city.y)) return;
        if (typeof SQUADLOGIC !== "undefined" && leader.squadId != null) {
          SQUADLOGIC.issueSiegeOrder(state, leader.squadId, city.id, [{ x: city.x, y: city.y }]);
          return;
        }
        leader.chaseTargetCityId = city.id;
        leader.chaseTargetUnitId = undefined;
        const minStopR = shieldRadius(city) + 6;
        const stopR = Math.max(getUnitAtkRange(leader) * 0.85, minStopR);
        const dx = leader.x - city.x, dy = leader.y - city.y;
        const dl = Math.hypot(dx, dy) || 1;
        const wp = { x: city.x + (dx / dl) * stopR, y: city.y + (dy / dl) * stopR };
        leader.waypoints = [wp];
        leader.waypointIndex = 0;
        for (const u of squad) { if (u !== leader) { u.waypoints = [{ x: wp.x, y: wp.y }]; u.waypointIndex = 0; } }
      }

      const bestAction = Math.max(economyScore, expandScore, attackScore, defendScore);
      const nearestUnownedMine = () => {
        let best = null, bestD = 1e18;
        for (const m of state.mines.values()) {
          if (m.ownerId === p.id) continue;
          const d = dist2(p.x, p.y, m.x, m.y);
          if (d < bestD) { bestD = d; best = m; }
        }
        return best;
      };

      for (const squad of squads) {
        const leader = squad.find(u => !u.leaderId) || squad[0];
        const lcs = leader._combatState;
        if (lcs === "acquire" || lcs === "chase" || lcs === "attack" || lcs === "siege") continue;
        if (squad.length < stagingMinSize) {
          setSquadWaypoint(squad, p.x + rand(-60, 60), p.y + rand(-60, 60));
          continue;
        }
        const wp = leader.waypoints;
        const idle = !wp || (leader.waypointIndex ?? 0) >= wp.length;
        if (!idle && Math.random() > 0.3) continue;

        if (bestAction === defendScore && threatNearBase) {
          setSquadWaypoint(squad, p.x + rand(-80, 80), p.y + rand(-80, 80));
        } else if (bestAction === attackScore && weakestEnemy) {
          attackCity(squad, weakestEnemy);
        } else if (bestAction === expandScore || bestAction === economyScore) {
          const mine = nearestUnownedMine();
          if (mine) {
            setSquadWaypoint(squad, mine.x, mine.y);
          } else if (weakestEnemy) {
            attackCity(squad, weakestEnemy);
          }
        }
      }

      const credits = p.eCredits || 0;
      const gameTime = state.t || 0;
      const costMul = p.unitCostMul != null ? p.unitCostMul : 1;
      const affordType = (key) => { const t = UNIT_TYPES[key]; return t && credits >= Math.max(1, Math.round(t.cost * costMul)); };

      let unitToBuy = "fighter";
      const isEconomist = p._botArchetype === "economist";

      if (myUnitCount < 3 || ownedMines < 2) {
        unitToBuy = "fighter";
      } else if (gameTime > 480 && affordType("hyperDestroyer") && Math.random() < 0.25) {
        unitToBuy = "hyperDestroyer";
      } else if (gameTime > 300 && affordType("battleship") && Math.random() < 0.3) {
        unitToBuy = "battleship";
      } else if (gameTime > 150 && affordType("cruiser") && Math.random() < 0.35) {
        unitToBuy = "cruiser";
      } else if (gameTime > 60 && affordType("destroyer") && Math.random() < (isEconomist ? 0.3 : 0.5)) {
        unitToBuy = "destroyer";
      }

      const type = UNIT_TYPES[unitToBuy];
      const cost = Math.max(1, Math.round(type.cost * costMul));
      const saveMultiplier = isEconomist ? 3.0 : (p._botArchetype === "aggressor" ? 1.2 : 1.8);
      const savingThreshold = gameTime > 180 ? cost * saveMultiplier : cost;
      if (credits >= cost && (credits >= savingThreshold || myUnitCount < 4)) {
        const mine = nearestUnownedMine();
        const target = mine || weakestEnemy || { x: p.x + rand(-200, 200), y: p.y + rand(-200, 200) };
        const tx = clamp((target.x || 0) + rand(-20, 20), 0, CFG.WORLD_W);
        const ty = clamp((target.y || 0) + rand(-20, 20), 0, CFG.WORLD_H);
        const affordableCount = Math.max(1, Math.floor(credits / cost));
        let burstCount = 1;
        if (unitToBuy === "fighter") burstCount = Math.min(4, affordableCount);
        else if (unitToBuy === "destroyer") burstCount = Math.min(2, affordableCount);
        else if (unitToBuy === "cruiser" && affordableCount >= 2 && Math.random() < 0.35) burstCount = 2;
        for (let i = 0; i < burstCount; i++) {
          purchaseUnit(p.id, unitToBuy, [{ x: tx, y: ty }], { sourceTag: "spawn" });
        }
        if (burstCount > 1) botMergeSmallSquads(p.id);
      }

      if (p._levelUpCards && p._levelUpCards.length > 0) {
        const cardIdx = Math.floor(Math.random() * p._levelUpCards.length);
        if (typeof applyLevelUpCard === "function") applyLevelUpCard(p.id, cardIdx);
      }
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

  function mineAtWorld(wx, wy) {
    let best = null;
    let bestD = Infinity;
    for (const mine of state.mines.values()) {
      const R = mine.isRich ? 40 : 32;
      const d = (mine.x - wx) ** 2 + (mine.y - wy) ** 2;
      if (d > R * R) continue;
      if (d < bestD) { bestD = d; best = mine; }
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
    const pct = ((myVal - enemyVal) / enemyVal) * 100;
    if (Math.abs(pct) < 1) return " <span style='color:#888;font-size:9px'>=</span>";
    if (pct > 0) return " <span style='color:#4f4;font-size:9px'>↑+" + Math.round(pct) + "%</span>";
    return " <span style='color:#f44;font-size:9px'>↓" + Math.round(pct) + "%</span>";
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
    const myPop = me ? me.pop : 0;
    const myLevel = me ? me.level : 0;
    const myXpNext = me ? me.xpNext : 1;
    const myPerMin = me ? (() => { const b = CFG.GROWTH_BASE_PER_MIN + Math.floor(me.pop / 100) * CFG.GROWTH_PER_100; const penM = Math.min(CFG.ACTIVE_SOLDIER_PENALTY_CAP, (me.activeUnits || 0) * CFG.ACTIVE_SOLDIER_PENALTY_PER); const killM = 0.30 * ((me.killGrowthStacks || []).filter(et => et > state.t).length); const cityM = ((me._growthBonuses || []).filter(b => b.expiresAt > state.t)).reduce((s, b) => s + b.amount, 0); return (b * (1 - penM) + killM + cityM) * (me.growthMul != null ? me.growthMul : 1); })() : 0;
    const myCityDmg = me ? Math.max(1, Math.round(CFG.CITY_ATTACK_DMG * (me.turretDmgMul != null ? me.turretDmgMul : 1) * getLevelBonusMul(me))) : 0;
    const myInfR = me ? (me.influenceR || 0) : 0;
    const myInfSpd = me ? (me.influenceSpeedMul != null ? me.influenceSpeedMul : 1) : 1;
    const myTurretCount = me ? (me.turretIds || []).filter(tid => { const t = state.turrets.get(tid); return t && t.hp > 0; }).length : 0;
    const ft = UNIT_TYPES.fighter;
    const myUnitHp = me ? Math.round(ft.hp * (me.unitHpMul != null ? me.unitHpMul : 1) * getLevelBonusMul(me)) : 0;
    const myUnitDmg = me ? (ft.damage * (me.unitDmgMul != null ? me.unitDmgMul : 1) * getLevelBonusMul(me)) : 0;
    const myUnitSpd = me ? (ft.speed * (me.unitSpeedMul != null ? me.unitSpeedMul : 1) * getLevelBonusMul(me)) : 0;
    const myUnitAtkR = me ? (ft.attackRate * (me.unitAtkRateMul != null ? me.unitAtkRateMul : 1) * getLevelBonusMul(me)) : 0;
    const eMineCount = [...state.mines.values()].filter(m => m.ownerId === p.id).length;
    const eMineIncPerMin = eMineCount * ((CFG.MINE_BASE_YIELD_VALUE * 0.7) + (p.mineYieldBonus || 0)) / Math.max(0.5, 2.5) * 60;
    const ePopIncPerMin = Math.floor(p.pop / 100) * 60;
    const eTotalIncPerMin = Math.round(eMineIncPerMin + ePopIncPerMin);
    const myMineCountC = [...state.mines.values()].filter(m => m.ownerId === (me ? me.id : -1)).length;
    const myMineIncPerMin = me ? myMineCountC * ((CFG.MINE_BASE_YIELD_VALUE * 0.7) + (me.mineYieldBonus || 0)) / Math.max(0.5, 2.5) * 60 : 0;
    const myPopIncPerMin = me ? Math.floor(me.pop / 100) * 60 : 0;
    const myTotalIncPerMin = Math.round(myMineIncPerMin + myPopIncPerMin);
    const cityPart =
      "<div class='stat-line'><span class='stat-label'>Население</span><span class='stat-val'>" + p.pop + statDiffHTML(p.pop, myPop) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Уровень</span><span class='stat-val'>" + p.level + statDiffHTML(p.level, myLevel) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Опыт</span><span class='stat-val'>" + Math.floor(p.xp || 0) + "/" + Math.floor(p.xpNext || 0) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Рост</span><span class='stat-val'>" + perMin.toFixed(1) + "/мин" + statDiffHTML(perMin, myPerMin) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Доход</span><span class='stat-val'>" + eTotalIncPerMin + "/мин" + statDiffHTML(eTotalIncPerMin, myTotalIncPerMin) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Урон города</span><span class='stat-val'>" + cityDmg + statDiffHTML(cityDmg, myCityDmg) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Зона</span><span class='stat-val'>R " + (p.influenceR || 0).toFixed(0) + statDiffHTML(p.influenceR || 0, myInfR) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Скор. зоны</span><span class='stat-val'>×" + infSpdMul.toFixed(2) + statDiffHTML(infSpdMul, myInfSpd) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Турели</span><span class='stat-val'>" + turretCount + statDiffHTML(turretCount, myTurretCount) + "</span></div>";
    const eFt = UNIT_TYPES.fighter;
    const armyPart =
      "<div class='stat-line'><span class='stat-label'>ХП (истр.)</span><span class='stat-val'>" + Math.round(eFt.hp * unitHpMul) + statDiffHTML(Math.round(eFt.hp * unitHpMul), myUnitHp) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Урон (истр.)</span><span class='stat-val'>" + (eFt.damage * unitDmgMul).toFixed(1) + statDiffHTML(eFt.damage * unitDmgMul, myUnitDmg) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Скорость (истр.)</span><span class='stat-val'>" + (eFt.speed * unitSpdMul).toFixed(1) + statDiffHTML(eFt.speed * unitSpdMul, myUnitSpd) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Атак/с (истр.)</span><span class='stat-val'>" + (eFt.attackRate * unitAtkRMul).toFixed(1) + statDiffHTML(eFt.attackRate * unitAtkRMul, myUnitAtkR) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Дальность</span><span class='stat-val'>" + eFt.attackRange + "</span></div>";
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
    state._enemyCityPanelPinned = false;
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
        const enemyUnit = unitAtWorldAny(pt.x, pt.y);
        const city = cityAtWorld(pt.x, pt.y);
        if (enemyUnit && enemyUnit.owner !== state.myPlayerId) {
          state.orderPreview = { type: "attackUnit", targetUnitId: enemyUnit.id, x: enemyUnit.x, y: enemyUnit.y };
          state.formationPreview = null;
          return;
        }
        if (city && city.id !== state.myPlayerId) {
          state.orderPreview = { type: "attackCity", targetCityId: city.id, x: city.x, y: city.y };
          state.formationPreview = null;
          return;
        }
        if (state.pirateBase && state.pirateBase.hp > 0) {
          const pbd = Math.hypot(pt.x - state.pirateBase.x, pt.y - state.pirateBase.y);
          if (pbd < 50) {
            state.orderPreview = { type: "attackPirateBase", x: state.pirateBase.x, y: state.pirateBase.y };
            state.formationPreview = null;
            return;
          }
        }
        const clickedMine = mineAtWorld(pt.x, pt.y);
        if (clickedMine) {
          state.orderPreview = { type: "capture", mineId: clickedMine.id, x: clickedMine.x, y: clickedMine.y };
          state.formationPreview = null;
          return;
        }
        const squads = getSelectedSquads();
        let cx = 0, cy = 0, n = 0;
        for (const squad of squads) for (const u of squad) { cx += u.x; cy += u.y; n++; }
        if (n) { cx /= n; cy /= n; }
        state.orderPreview = { type: "move", x: pt.x, y: pt.y };
        state._rmbHoldStart = performance.now();
        state._rmbHoldPt = { x: pt.x, y: pt.y, cx, cy, screenX: e.clientX, screenY: e.clientY };
        state.formationPreview = null;
        return;
      }
      isPanning = true;
      panBtn = btn;
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }

    if (btn === 0) {
      if (state._abilityTargeting) return;
      if (state.rallyPointMode) {
        state.rallyPoint = { x: pt.x, y: pt.y };
        state.rallyPointMode = false;
        if (rallyPointHintEl) rallyPointHintEl.textContent = "Точка сбора: " + Math.round(pt.x) + ", " + Math.round(pt.y);
        return;
      }
      if (state.selectedUnitIds.size > 0) {
        const clickedMine = mineAtWorld(pt.x, pt.y);
        if (clickedMine && clickedMine.ownerId !== state.myPlayerId) {
          const squads = getSelectedSquads();
          for (const squad of squads) {
            const leader = squad.find(v => (v.leaderId || v.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
            leader.chaseTargetUnitId = undefined;
            leader.chaseTargetCityId = undefined;
            leader.waypoints = [{ x: clickedMine.x, y: clickedMine.y }];
            leader.waypointIndex = 0;
            leader.straightMode = false;
            for (const u of squad) {
              if (u !== leader) {
                u.waypoints = [{ x: clickedMine.x, y: clickedMine.y }];
                u.waypointIndex = 0;
              }
            }
          }
          return;
        }
      }
      if (state.selectedUnitIds.size === 0) {
        const city = cityAtWorld(pt.x, pt.y);
        if (city && city.id !== state.myPlayerId) {
          showEnemyCompare(city.id);
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
    if (e.button === 2) {
      state._rmbHoldStart = null;
      state._rmbHoldPt = null;
    }
    if (e.button === 2 && state.orderPreview) {
      const order = state.orderPreview;
      const squads = getSelectedSquads();
      const leaderIds = [];
      const clearSquadCombat = (squad) => {
        if (typeof COMBAT !== "undefined" && COMBAT.clearCombatState) {
          for (const u of squad) COMBAT.clearCombatState(u);
        }
      };
      if (typeof SQUADLOGIC !== "undefined") {
        if (order.type === "move" && state.formationPreview) {
          const fp = state.formationPreview;
          const addWaypoint = e.shiftKey;
          for (const squad of squads) {
            const squadState = getSquadStateFromUnits(squad);
            if (!squadState) continue;
            const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
            const fType = leader.formationType || "line";
            const fRows = fp.dragRows != null ? fp.dragRows : (leader.formationRows || 3);
            const pigW = fp.dragWidth != null ? fp.dragWidth : (leader.formationPigWidth ?? 1);
            const baseWaypoints = addWaypoint ? cloneWaypointsSafe(squadState.order?.waypoints) : [];
            baseWaypoints.push({ x: fp.x, y: fp.y });
            SQUADLOGIC.setSquadFormation(state, squadState.id, fType, fRows, pigW);
            SQUADLOGIC.issueMoveOrder(state, squadState.id, baseWaypoints, fp.angle);
            SQUADLOGIC.recalculateFormation(state, squadState.id, { getFormationOffsets }, true);
            leaderIds.push(leader.id);
          }
          if (state._multiSlots && !state._multiIsHost && state._socket) {
            state._socket.emit("playerAction", { type: "move", leaderIds, waypoints: [{ x: fp.x, y: fp.y }], x: fp.x, y: fp.y, angle: fp.angle });
          }
        } else if (order.type === "move" && !state.formationPreview) {
          const addWaypoint = e.shiftKey;
          for (const squad of squads) {
            const squadState = getSquadStateFromUnits(squad);
            if (!squadState) continue;
            const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
            const baseWaypoints = addWaypoint ? cloneWaypointsSafe(squadState.order?.waypoints) : [];
            baseWaypoints.push({ x: order.x, y: order.y });
            SQUADLOGIC.issueMoveOrder(state, squadState.id, baseWaypoints, Math.atan2(order.y - leader.y, order.x - leader.x));
            leaderIds.push(leader.id);
          }
          if (state._multiSlots && !state._multiIsHost && state._socket) {
            state._socket.emit("playerAction", { type: "move", leaderIds, waypoints: [{ x: order.x, y: order.y }], x: order.x, y: order.y });
          }
        } else if (order.type === "attackUnit") {
          const target = state.units.get(order.targetUnitId);
          if (target) {
            const addWaypoint = e.shiftKey;
            for (const squad of squads) {
              const squadState = getSquadStateFromUnits(squad);
              if (!squadState) continue;
              const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
              const baseWaypoints = addWaypoint ? cloneWaypointsSafe(squadState.order?.waypoints) : [];
              if (addWaypoint) baseWaypoints.push({ x: target.x, y: target.y });
              SQUADLOGIC.issueAttackUnitOrder(state, squadState.id, target.id, baseWaypoints);
              leaderIds.push(leader.id);
            }
            if (state._multiSlots && !state._multiIsHost && state._socket) {
              state._socket.emit("playerAction", { type: "chase", leaderIds, targetUnitId: target.id, x: target.x, y: target.y });
            }
          }
        } else if (order.type === "attackCity") {
          const city = state.players.get(order.targetCityId);
          if (city) {
            const addWaypoint = e.shiftKey;
            for (const squad of squads) {
              const squadState = getSquadStateFromUnits(squad);
              if (!squadState) continue;
              const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
              const baseWaypoints = addWaypoint ? cloneWaypointsSafe(squadState.order?.waypoints) : [];
              baseWaypoints.push({ x: city.x, y: city.y });
              SQUADLOGIC.issueSiegeOrder(state, squadState.id, city.id, baseWaypoints);
              leaderIds.push(leader.id);
            }
            if (state._multiSlots && !state._multiIsHost && state._socket) {
              state._socket.emit("playerAction", { type: "chaseCity", leaderIds, targetCityId: city.id, x: city.x, y: city.y });
            }
          }
        } else if (order.type === "attackPirateBase" && state.pirateBase) {
          const addWaypoint = e.shiftKey;
          for (const squad of squads) {
            const squadState = getSquadStateFromUnits(squad);
            if (!squadState) continue;
            const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
            const baseWaypoints = addWaypoint ? cloneWaypointsSafe(squadState.order?.waypoints) : [];
            baseWaypoints.push({ x: state.pirateBase.x, y: state.pirateBase.y });
            SQUADLOGIC.issueMoveOrder(state, squadState.id, baseWaypoints, Math.atan2(state.pirateBase.y - leader.y, state.pirateBase.x - leader.x));
            leaderIds.push(leader.id);
          }
        } else if (order.type === "capture") {
          const addWaypoint = e.shiftKey;
          for (const squad of squads) {
            const squadState = getSquadStateFromUnits(squad);
            if (!squadState) continue;
            const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
            const baseWaypoints = addWaypoint ? cloneWaypointsSafe(squadState.order?.waypoints) : [];
            baseWaypoints.push({ x: order.x, y: order.y });
            SQUADLOGIC.issueCaptureOrder(state, squadState.id, order.mineId, { x: order.x, y: order.y }, baseWaypoints);
            leaderIds.push(leader.id);
          }
          if (state._multiSlots && !state._multiIsHost && state._socket) {
            state._socket.emit("playerAction", { type: "move", leaderIds, waypoints: [{ x: order.x, y: order.y }], x: order.x, y: order.y, mineId: order.mineId, capture: true });
          }
        }
        state.formationPreview = null;
        state.orderPreview = null;
        return;
      }
      if (order.type === "move" && state.formationPreview) {
        const fp = state.formationPreview;
        const addWaypoint = e.shiftKey;
        for (const squad of squads) {
          clearSquadCombat(squad);
          const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
          const fType = leader.formationType || "line";
          const fRows = fp.dragRows != null ? fp.dragRows : (leader.formationRows || 1);
          const pigW = fp.dragWidth != null ? fp.dragWidth : (leader.formationPigWidth ?? 1);
          const cosA = Math.cos(fp.angle), sinA = Math.sin(fp.angle);
          const offs = getFormationOffsets(squad.length, fType, fRows, cosA, sinA, pigW, squad);
          const fc = getFormationCenter(offs);
          const newPt = { x: fp.x - fc.x, y: fp.y - fc.y };
          const waypoints = addWaypoint ? [...(leader.waypoints || []), newPt] : [newPt];
          leader.targetFormationAngle = fp.angle;
          if (fp.dragRows != null) leader.formationRows = fRows;
          if (fp.dragWidth != null) leader.formationPigWidth = pigW;
          leader.chaseTargetUnitId = undefined;
          leader.chaseTargetCityId = undefined;
          leader._captureTarget = undefined;
          for (const u of squad) {
            u.waypoints = waypoints.map(w => ({ x: w.x, y: w.y }));
            u.waypointIndex = addWaypoint ? (u.waypointIndex ?? 0) : 0;
            u.straightMode = false;
            u.chaseTargetUnitId = undefined;
            u.chaseTargetCityId = undefined;
          }
          leaderIds.push(leader.id);
        }
        if (state._multiSlots && !state._multiIsHost && state._socket) {
          const firstLeader = state.units.get(leaderIds[0]);
          const waypoints = firstLeader ? firstLeader.waypoints : [{ x: fp.x, y: fp.y }];
          state._socket.emit("playerAction", { type: "move", leaderIds, waypoints, x: fp.x, y: fp.y, angle: fp.angle });
        }
      } else if (order.type === "move" && !state.formationPreview) {
        const addWaypoint = e.shiftKey;
        const wp = { x: order.x, y: order.y };
        for (const squad of squads) {
          clearSquadCombat(squad);
          const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
          leader.chaseTargetUnitId = undefined;
          leader.chaseTargetCityId = undefined;
          leader._captureTarget = undefined;
          if (addWaypoint) {
            leader.waypoints = [...(leader.waypoints || []), wp];
          } else {
            leader.waypoints = [wp];
            leader.waypointIndex = 0;
          }
          leader.straightMode = false;
          for (const u of squad) {
            u.waypoints = leader.waypoints.map(w => ({ x: w.x, y: w.y }));
            u.waypointIndex = addWaypoint ? (u.waypointIndex ?? 0) : 0;
            u.straightMode = false;
            u.chaseTargetUnitId = undefined;
            u.chaseTargetCityId = undefined;
          }
          leaderIds.push(leader.id);
        }
        if (state._multiSlots && !state._multiIsHost && state._socket) {
          state._socket.emit("playerAction", { type: "move", leaderIds, waypoints: [wp], x: order.x, y: order.y });
        }
      } else if (order.type === "attackUnit") {
        const target = state.units.get(order.targetUnitId);
        const addWaypoint = e.shiftKey;
        if (target) {
          for (const squad of squads) {
            if (!addWaypoint) clearSquadCombat(squad);
            const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
            leader.chaseTargetUnitId = target.id;
            leader.chaseTargetCityId = undefined;
            leader._captureTarget = undefined;
            if (addWaypoint) {
              leader.waypoints = [...(leader.waypoints || []), { x: target.x, y: target.y }];
            } else {
              leader.waypoints = [{ x: target.x, y: target.y }];
              leader.waypointIndex = 0;
            }
            leader.straightMode = false;
            leaderIds.push(leader.id);
          }
          if (state._multiSlots && !state._multiIsHost && state._socket) {
            state._socket.emit("playerAction", { type: "chase", leaderIds, targetUnitId: target.id, x: target.x, y: target.y });
          }
        }
      } else if (order.type === "attackCity") {
        const city = state.players.get(order.targetCityId);
        const addWaypoint = e.shiftKey;
        if (city) {
          const minStopR = shieldRadius(city) + 6;
          for (const squad of squads) {
            if (!addWaypoint) clearSquadCombat(squad);
            const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
            leader.chaseTargetCityId = city.id;
            leader.chaseTargetUnitId = undefined;
            leader._captureTarget = undefined;
            const stopR = Math.max(getUnitAtkRange(leader) * 0.85, minStopR);
            const ddx = leader.x - city.x, ddy = leader.y - city.y;
            const dl = Math.hypot(ddx, ddy) || 1;
            const wp = { x: city.x + (ddx / dl) * stopR, y: city.y + (ddy / dl) * stopR };
            if (addWaypoint) {
              leader.waypoints = [...(leader.waypoints || []), wp];
            } else {
              leader.waypoints = [wp];
              leader.waypointIndex = 0;
            }
            leader.straightMode = false;
            leaderIds.push(leader.id);
          }
          if (state._multiSlots && !state._multiIsHost && state._socket) {
            state._socket.emit("playerAction", { type: "chaseCity", leaderIds, targetCityId: city.id, x: city.x, y: city.y });
          }
        }
      } else if (order.type === "capture") {
        const addWaypoint = e.shiftKey;
        for (const squad of squads) {
          if (!addWaypoint) clearSquadCombat(squad);
          const leader = squad.find(u => (u.leaderId || u.id) === (squad[0].leaderId || squad[0].id)) || squad[0];
          leader.chaseTargetUnitId = undefined;
          leader.chaseTargetCityId = undefined;
          leader._captureTarget = true;
          const capWp = { x: order.x, y: order.y };
          if (addWaypoint) {
            leader.waypoints = [...(leader.waypoints || []), capWp];
          } else {
            leader.waypoints = [capWp];
            leader.waypointIndex = 0;
          }
          leader.straightMode = false;
          for (const u of squad) {
            if (addWaypoint) {
              u.waypoints = [...(u.waypoints || []), capWp];
            } else {
              u.waypoints = [capWp];
              u.waypointIndex = 0;
            }
            u.straightMode = false;
            u.chaseTargetUnitId = undefined;
            u.chaseTargetCityId = undefined;
          }
          leaderIds.push(leader.id);
        }
        if (state._multiSlots && !state._multiIsHost && state._socket) {
          state._socket.emit("playerAction", { type: "move", leaderIds, waypoints: [{ x: order.x, y: order.y }], x: order.x, y: order.y });
        }
      }
      state.formationPreview = null;
      state.orderPreview = null;
    }
    if (e.button === panBtn) {
      isPanning = false;
      panBtn = 0;
    }
  });

  window.addEventListener("pointermove", (e) => {
    state._mouseScreenX = e.clientX;
    state._mouseScreenY = e.clientY;
    if (state.boxStart && e.buttons === 1 && !state._abilityTargeting) {
      state.boxEnd = screenToWorld(e.clientX, e.clientY);
    }
    if (state._rmbHoldStart && (e.buttons & 2) && !state.formationPreview) {
      const held = performance.now() - state._rmbHoldStart;
      if (held >= 150) {
        const hp = state._rmbHoldPt;
        state.formationPreview = {
          x: hp.x, y: hp.y,
          angle: Math.atan2(hp.y - hp.cy, hp.x - hp.cx),
          startX: hp.screenX, startY: hp.screenY,
          dragRows: null, dragWidth: null
        };
        state._rmbHoldStart = null;
        state._rmbHoldPt = null;
      }
    }
    if (state.formationPreview && (e.buttons & 2)) {
      const w = screenToWorld(e.clientX, e.clientY);
      const fp = state.formationPreview;
      fp.angle = Math.atan2(w.y - fp.y, w.x - fp.x);
      const screenDx = e.clientX - fp.startX;
      const screenDy = e.clientY - fp.startY;
      const dragDist = Math.hypot(screenDx, screenDy);
      if (dragDist > 20) {
        const cosA = Math.cos(fp.angle), sinA = Math.sin(fp.angle);
        const along = Math.abs(screenDx * cosA + screenDy * sinA);
        const perp = Math.abs(-screenDx * sinA + screenDy * cosA);
        fp.dragRows = Math.max(1, Math.min(10, Math.round(along / 40)));
        fp.dragWidth = Math.max(0.8, Math.min(3, 0.8 + perp / 80));
      }
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
    state._rmbHoldStart = null;
    state._rmbHoldPt = null;
    if (state.formationPreview) state.formationPreview = null;
    if (state.orderPreview) state.orderPreview = null;
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

  function showPurchaseError(reason) {
    const me = state.players.get(state.myPlayerId);
    if (!me) return;
    const msg = reason === "cap_reached" ? "Лимит юнитов!" : "Недостаточно ⚡€!";
    state.floatingDamage.push({ x: me.x, y: me.y - 60, text: msg, color: 0xff4444, ttl: 1.5 });
    tickSound(180, 0.08, 0.06);
  }

  function doPurchaseUnit(unitTypeKey) {
    const me = state.players.get(state.myPlayerId);
    if (!me) return false;
    const wps = (state.targetPoints && state.targetPoints.length > 0)
      ? state.targetPoints
      : (state.rallyPoint ? [state.rallyPoint] : [{ x: me.x + 220, y: me.y }]);
    if (state._multiSlots && !state._multiIsHost && state._socket) {
      state._socket.emit("playerAction", { type: "purchase", pid: state.myPlayerId, unitType: unitTypeKey, waypoints: wps });
      const optRes = purchaseUnit(me.id, unitTypeKey, wps);
      if (!optRes.ok) { showPurchaseError(optRes.reason); return false; }
      state.targetPoints = [];
      return true;
    }
    const res = purchaseUnit(me.id, unitTypeKey, wps);
    if (res.ok) { state.targetPoints = []; return true; }
    showPurchaseError(res.reason);
    return false;
  }

  document.querySelectorAll(".unit-buy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const typeKey = btn.dataset.type;
      if (typeKey) doPurchaseUnit(typeKey);
    });
  });

  document.querySelectorAll(".unit-batch-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const tk = btn.dataset.type;
      const count = parseInt(btn.dataset.count) || 10;
      for (let i = 0; i < count; i++) {
        if (!doPurchaseUnit(tk)) break;
      }
    });
  });

  // 1-5 keys reserved for Ctrl-group bindings only (no spawn hotkeys)

  document.querySelectorAll(".speed-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (state._multiSlots && !state._multiIsHost) return;
      const speed = parseInt(btn.dataset.speed, 10) || 1;
      state.timeScale = speed;
      document.querySelectorAll(".speed-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
  state.timeScale = 1;
  const defaultSpeedBtn = document.querySelector(".speed-btn[data-speed='1']");
  if (defaultSpeedBtn) defaultSpeedBtn.classList.add("active");
  else document.querySelector(".speed-btn[data-speed='1']")?.classList.add("active");

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
    if (card.attackEffect) {
      const lv = (p.attackEffects && p.attackEffects[card.attackEffect]) || 0;
      return lv >= 3 ? "МАКС (ур. 3/3)" : "Сейчас: ур. " + lv + "/3";
    }
    if (card.popBonus) return "Сейчас население: " + p.pop;
    const keys = Object.keys(card);
    const uHp = (p.unitHpMul != null ? p.unitHpMul : 1) * (p._levelBonusMul ?? 1);
    const uDmg = (p.unitDmgMul != null ? p.unitDmgMul : 1) * (p._levelBonusMul ?? 1);
    if (keys.some(k => k.startsWith("unitHp"))) return "Сейчас: HP (истр.) " + Math.round(UNIT_TYPES.fighter.hp * uHp);
    if (keys.some(k => k.startsWith("unitDmg"))) return "Сейчас: урон (истр.) " + (UNIT_TYPES.fighter.damage * uDmg).toFixed(1);
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
      state._pendingCardChoices = getRandomCards(3, state.players.get(state.myPlayerId));
      renderPick();
    };

    function renderPick() {
      const picks = me.pendingCardPicks || 0;
      if (picksLeftEl) picksLeftEl.textContent = picks;
      if (rerollCountEl) rerollCountEl.textContent = String(me.rerollCount || 0);
      if (picks <= 0) { modal.style.display = "none"; state._pendingCardChoices = null; updateLvlUpButton(); return; }

      let cards = state._pendingCardChoices;
      if (!cards || cards.length === 0) {
        cards = getRandomCards(3, state.players.get(state.myPlayerId));
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
        const div = document.createElement("div");
        const flashClass = (card.rarity === "legendary" || card.rarity === "mythic") ? " flash" : "";
        div.className = "card-option " + card.rarity + flashClass;
        div.dataset.rarity = card.rarity;
        const rarityLabel = CARD_RARITY_LABELS[card.rarity] || card.rarity;

        let cardHTML = "<div class='card-rarity-label card-rarity-" + card.rarity + "'>" + rarityLabel + "</div>";
        if (card.dual && card.buffs) {
          const emojis = card.buffs.map(b => b.emoji || getCardEmoji(b)).join("");
          cardHTML += "<div class='card-emoji'>" + emojis + "</div>";
          for (const buff of card.buffs) {
            const currText = getCardCurrentParamText(me, buff);
            cardHTML += "<div class='card-dual-buff'>" +
              "<div class='card-name'>" + (buff.name || "").replace(/</g, "&lt;") + "</div>" +
              "<div class='card-desc'>" + (buff.desc || "").replace(/</g, "&lt;") + "</div>" +
              (currText ? "<div class='card-param-now'>" + currText.replace(/</g, "&lt;") + "</div>" : "") +
              "</div>";
          }
        } else {
          const emoji = getCardEmoji(card);
          const currentText = getCardCurrentParamText(me, card);
          const cardEmoji = card.emoji || emoji;
          cardHTML += "<div class='card-emoji'>" + cardEmoji + "</div>" +
            "<div class='card-name'>" + (card.name || "").replace(/</g, "&lt;") + "</div>" +
            "<div class='card-desc'>" + (card.desc || "").replace(/</g, "&lt;") + "</div>" +
            (currentText ? "<div class='card-param-now'>" + currentText.replace(/</g, "&lt;") + "</div>" : "");
        }
        div.innerHTML = cardHTML;
        const paramHint = card.dual ? card.buffs.map(b => getCardParamTooltip(b)).filter(Boolean).join("\n") : getCardParamTooltip(card);
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

  function updateHUD() {
    const me = state.players.get(state.myPlayerId);
    if (!me) return;

    updateLvlUpButton();

    const eCreditsEl = document.getElementById("eCreditsValue");
    if (eCreditsEl) {
      const myMineCountForInc = [...state.mines.values()].filter(m => m.ownerId === me.id).length;
      const mineIncPerMin = myMineCountForInc * ((CFG.MINE_BASE_YIELD_VALUE * 0.7) + (me.mineYieldBonus || 0)) / Math.max(0.5, 2.5) * 60;
      const popIncPerMin = Math.floor(me.pop / 100) * 60;
      const totalIncPerMin = Math.round(mineIncPerMin + popIncPerMin);
      eCreditsEl.textContent = Math.floor(me.eCredits || 0) + "  (+" + totalIncPerMin + "/мин)";
    }

    document.querySelectorAll(".unit-buy-btn").forEach(btn => {
      const typeKey = btn.dataset.type;
      const type = UNIT_TYPES[typeKey];
      if (!type) return;
      const costMul = me.unitCostMul != null ? me.unitCostMul : 1;
      const cost = Math.max(1, Math.round(type.cost * costMul));
      const costEl = btn.querySelector(".unit-buy-cost");
      if (costEl) costEl.textContent = cost + " ⚡€";
      btn.disabled = (me.eCredits || 0) < cost;
    });

    const base = CFG.GROWTH_BASE_PER_MIN + Math.floor(me.pop / 100) * CFG.GROWTH_PER_100;
    const pen = Math.min(CFG.ACTIVE_SOLDIER_PENALTY_CAP, me.activeUnits * CFG.ACTIVE_SOLDIER_PENALTY_PER);
    const killBonus = 0.30 * ((me.killGrowthStacks || []).filter(et => et > state.t).length);
    const cityDestroyBonusHUD = ((me._growthBonuses || []).filter(b => b.expiresAt > state.t)).reduce((s, b) => s + b.amount, 0);
    const growthMulHUD = me.growthMul != null ? me.growthMul : 1;
    const perMin = (base * (1 - pen) + killBonus + cityDestroyBonusHUD) * growthMulHUD;

    const turretCount = (me.turretIds || []).filter(tid => { const t = state.turrets.get(tid); return t && t.hp > 0; }).length;
    const cityDmgMulHud = (me.turretDmgMul != null ? me.turretDmgMul : 1) * getLevelBonusMul(me);
    const cityDmg = Math.max(1, Math.round(CFG.CITY_ATTACK_DMG * cityDmgMulHud));
    const turretHpMulHud = (me.turretHpMul != null ? me.turretHpMul : 1) * getLevelBonusMul(me);
    const turretHp = Math.max(1, Math.round(me.pop * (CFG.TURRET_HP_RATIO ?? 0.1) * turretHpMulHud));
    const turretDmgMulHud2 = (me.turretDmgMul != null ? me.turretDmgMul : 1) * getLevelBonusMul(me);
    const turretDmg = ((CFG.TURRET_ATTACK_DMG ?? 3) * (CFG.TURRET_ATTACK_RATE ?? 1.2) * turretDmgMulHud2).toFixed(1);

    const infSpdMul = me.influenceSpeedMul != null ? me.influenceSpeedMul : 1;
    const myMineCount = [...state.mines.values()].filter(m => m.ownerId === me.id).length;
    const mineYieldPerSec = ((CFG.MINE_BASE_YIELD_VALUE * 0.7) + (me.mineYieldBonus || 0)) / Math.max(0.5, 2.5);
    const popCreditPerSecHud = Math.floor(me.pop / 100);
    const shieldPct = me.shieldMaxHp > 0 ? Math.round((me.shieldHp / me.shieldMaxHp) * 100) : 0;
    const totalArea = CFG.WORLD_W * CFG.WORLD_H;
    const myArea = polygonArea(me.influencePolygon);
    const zonePct = totalArea > 0 ? Math.min(100, (myArea / totalArea * 100)) : 0;

    const patrolCount = me._patrolCount || 0;

    if (state._enemyCityPanelPlayerId) {
      const ep = state.players.get(state._enemyCityPanelPlayerId);
      const panelEl = document.getElementById("enemyCityPanel");
      if (ep && panelEl && panelEl.style.display === "block") {
        const content = document.getElementById("enemyCityPanelContent");
        if (content) content.innerHTML = getEnemyCityStatsHTML(ep);
      }
    }

    const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    el("hudPop", me.pop + " (+" + popCreditPerSecHud + "€/с)");
    el("hudGrowth", perMin.toFixed(1));
    el("hudMining", mineYieldPerSec.toFixed(1) + "/с × " + myMineCount);
    el("hudShield", Math.round(me.shieldHp || 0) + " (" + shieldPct + "%)");
    el("hudZone", zonePct.toFixed(1) + "%");
    el("hudZoneSpeed", "×" + infSpdMul.toFixed(2));
    const zoneFill = document.getElementById("hudZoneFill");
    if (zoneFill) zoneFill.style.width = zonePct + "%";
    el("hudTurretHp", turretHp + " hp");
    el("hudTurretDmg", turretDmg + " dps");
    el("hudCityDmg", cityDmg + " ×" + (CFG.CITY_BASE_TARGETS + (me.cityTargetBonus || 0)));
    el("hudPatrols", patrolCount);

    const lb = getLevelBonusMul(me);
    const myDmgMul = (me.unitDmgMul != null ? me.unitDmgMul : 1) * lb;
    const myAtkRMul = (me.unitAtkRateMul != null ? me.unitAtkRateMul : 1) * lb;
    const mySpdMul = (me.unitSpeedMul != null ? me.unitSpeedMul : 1) * lb;
    const myAtkRangeMul = (me.unitAtkRangeMul != null ? me.unitAtkRangeMul : 1) * getRangeLevelMul(me);
    const fmtM = (v) => "×" + v.toFixed(2);
    el("hudDmgMul", fmtM(myDmgMul));
    el("hudRateMul", fmtM(myAtkRMul));
    el("hudRangeMul", fmtM(myAtkRangeMul));
    el("hudSpeedMul", fmtM(mySpdMul));

    const dmgMulEl = document.getElementById("hudDmgMul");
    const rateMulEl = document.getElementById("hudRateMul");
    const rangeMulEl = document.getElementById("hudRangeMul");
    const speedMulEl = document.getElementById("hudSpeedMul");
    const colorMul = (e, v) => { if (e) e.style.color = v > 1 ? "#66dd88" : v < 1 ? "#ff5555" : "#aabbcc"; };
    colorMul(dmgMulEl, myDmgMul);
    colorMul(rateMulEl, myAtkRMul);
    colorMul(rangeMulEl, myAtkRangeMul);
    colorMul(speedMulEl, mySpdMul);

    const legendaryEl = document.getElementById("hudLegendary");
    if (legendaryEl) {
      const effects = [];
      if (me.attackEffects) {
        const effectNames = { chain: "⚡Цепная", cryo: "❄️Крио", fire: "🔥Огонь" };
        for (const [eff, lv] of Object.entries(me.attackEffects)) {
          if (lv > 0) effects.push(effectNames[eff] + " " + lv);
        }
      }
      legendaryEl.textContent = effects.length ? effects.join(", ") : "—";
    }

    // Update buy/batch button enabled/disabled state (credits + unit cap)
    const costMul = me.unitCostMul != null ? me.unitCostMul : 1;
    const myId = me.id;
    document.querySelectorAll(".unit-batch-btn").forEach(b => {
      const tk = b.dataset.type;
      const cnt = parseInt(b.dataset.count) || 1;
      const tp = UNIT_TYPES[tk];
      if (!tp) return;
      const unitCost = Math.max(1, Math.round(tp.cost * costMul));
      const totalCost = unitCost * cnt;
      const canAfford = (me.eCredits || 0) >= totalCost;
      const cap = UNIT_CAPS[tk] ?? 300;
      const cur = countPlayerUnits(myId, tk);
      const atCap = cur >= cap;
      const enabled = canAfford && !atCap;
      b.style.opacity = enabled ? "1" : "0.35";
      b.style.pointerEvents = enabled ? "auto" : "none";
      b.title = atCap ? "Лимит: " + cur + "/" + cap : totalCost + " ⚡€";
    });
    document.querySelectorAll(".unit-buy-btn").forEach(b => {
      const tk = b.dataset.type;
      const tp = UNIT_TYPES[tk];
      if (!tp) return;
      const cost = Math.max(1, Math.round(tp.cost * costMul));
      const cap = UNIT_CAPS[tk] ?? 300;
      const cur = countPlayerUnits(myId, tk);
      const atCap = cur >= cap;
      const canAfford = (me.eCredits || 0) >= cost;
      b.style.opacity = (canAfford && !atCap) ? "1" : "0.45";
      const countSpan = b.querySelector(".unit-count-badge");
      if (countSpan) countSpan.textContent = cur + "/" + cap;
    });
  }

  // ─── Tooltip for HUD stat rows ───────────────────────────────
  {
    const tooltipEl = document.getElementById("hudTooltip");
    document.addEventListener("pointerover", (e) => {
      const row = e.target.closest("[data-tooltip]");
      if (!row || !tooltipEl) return;
      tooltipEl.textContent = row.dataset.tooltip;
      tooltipEl.style.display = "block";
    });
    document.addEventListener("pointermove", (e) => {
      if (tooltipEl && tooltipEl.style.display === "block") {
        tooltipEl.style.left = Math.min(e.clientX + 12, window.innerWidth - 280) + "px";
        tooltipEl.style.top = (e.clientY + 14) + "px";
      }
    });
    document.addEventListener("pointerout", (e) => {
      const row = e.target.closest("[data-tooltip]");
      if (row && tooltipEl) tooltipEl.style.display = "none";
    });
  }

  // ─── Enemy comparison panel ─────────────────────────────────
  function showEnemyCompare(enemyId) {
    const me = state.players.get(state.myPlayerId);
    const enemy = state.players.get(enemyId);
    if (!me || !enemy) return;
    const panel = document.getElementById("enemyComparePanel");
    const nameEl = document.getElementById("compareEnemyName");
    const rowsEl = document.getElementById("compareRows");
    if (!panel || !rowsEl) return;

    nameEl.textContent = enemy.name || ("Игрок " + enemyId);
    const lb = getLevelBonusMul(me);
    const elb = getLevelBonusMul(enemy);
    const totalArea = CFG.WORLD_W * CFG.WORLD_H;
    const myZonePct = totalArea > 0 ? (polygonArea(me.influencePolygon) / totalArea * 100) : 0;
    const eZonePct = totalArea > 0 ? (polygonArea(enemy.influencePolygon) / totalArea * 100) : 0;
    const eTurretCount = (enemy.turretIds || []).filter(tid => { const t = state.turrets.get(tid); return t && t.hp > 0; }).length;
    const myTurretCount = (me.turretIds || []).filter(tid => { const t = state.turrets.get(tid); return t && t.hp > 0; }).length;
    const eMyMines = [...state.mines.values()].filter(m => m.ownerId === me.id).length;
    const eEnemyMines = [...state.mines.values()].filter(m => m.ownerId === enemy.id).length;

    const sections = [
      { title: "🌍 Планета", stats: [
        { label: "Население", my: me.pop, his: enemy.pop },
        { label: "Уровень", my: me.level, his: enemy.level },
        { label: "Щит", my: Math.round(me.shieldHp || 0), his: Math.round(enemy.shieldHp || 0) },
        { label: "Зона %", my: myZonePct.toFixed(1), his: eZonePct.toFixed(1) },
        { label: "Шахты", my: eMyMines, his: eEnemyMines }
      ]},
      { title: "🏰 Оборона", stats: [
        { label: "Турели", my: myTurretCount, his: eTurretCount },
        { label: "Юниты", my: me.activeUnits || 0, his: enemy.activeUnits || 0 }
      ]},
      { title: "🚀 Флот", stats: [
        { label: "Урон ×", my: ((me.unitDmgMul || 1) * lb).toFixed(2), his: ((enemy.unitDmgMul || 1) * elb).toFixed(2) },
        { label: "Скоростр. ×", my: ((me.unitAtkRateMul || 1) * lb).toFixed(2), his: ((enemy.unitAtkRateMul || 1) * elb).toFixed(2) },
        { label: "Скорость ×", my: ((me.unitSpeedMul || 1) * lb).toFixed(2), his: ((enemy.unitSpeedMul || 1) * elb).toFixed(2) },
        { label: "Дальность ×", my: ((me.unitAtkRangeMul || 1) * getRangeLevelMul(me)).toFixed(2), his: ((enemy.unitAtkRangeMul || 1) * getRangeLevelMul(enemy)).toFixed(2) }
      ]}
    ];

    let html = "";
    for (const sec of sections) {
      html += "<div class='compare-section-title'>" + sec.title + "</div>";
      html += sec.stats.map(s => {
        const myV = parseFloat(s.my), hisV = parseFloat(s.his);
        const diff = myV - hisV;
        const cls = diff > 0 ? "positive" : diff < 0 ? "negative" : "neutral";
        const sign = diff > 0 ? "+" : "";
        return "<div class='compare-row'><span class='compare-label'>" + s.label +
          "</span><span class='compare-val'>" + s.my +
          "</span><span class='compare-vs'>vs</span><span class='compare-val'>" + s.his +
          "</span><span class='compare-diff " + cls + "'>" + sign + diff.toFixed(1) + "</span></div>";
      }).join("");
    }
    rowsEl.innerHTML = html;

    const topPanel = document.getElementById("topRightPanel");
    panel.style.top = (topPanel ? topPanel.offsetTop + topPanel.offsetHeight + 8 : 200) + "px";
    panel.style.display = "block";
    panel._openedAt = performance.now();
  }

  document.getElementById("compareClose")?.addEventListener("click", () => {
    const panel = document.getElementById("enemyComparePanel");
    if (panel) panel.style.display = "none";
  });

  document.addEventListener("pointerdown", (e) => {
    const panel = document.getElementById("enemyComparePanel");
    if (!panel || panel.style.display !== "block") return;
    if (panel._openedAt && (performance.now() - panel._openedAt) < 200) return;
    if (!panel.contains(e.target) && !e.target.closest("#topRightPanel") && !e.target.closest(".topright-leaderboard")) {
      panel.style.display = "none";
    }
  });

  // ------------------------------------------------------------
  // Storm Front
  // ------------------------------------------------------------
  const STORM_INTERVAL = 540;
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

    // Morph storm shape over time
    const t = state.t;
    for (let i = 0; i < s.blobs.length; i++) {
      const b = s.blobs[i];
      if (!b._baseOx) { b._baseOx = b.ox; b._baseOy = b.oy; b._baseR = b.r; b._phase = i * 1.3; }
      b.ox = b._baseOx + Math.sin(t * 0.3 + b._phase) * 20;
      b.oy = b._baseOy + Math.cos(t * 0.25 + b._phase * 0.7) * 15;
      b.r = b._baseR * (0.85 + 0.15 * Math.sin(t * 0.4 + b._phase * 1.5));
    }

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

  function drawNebulae() {
    if (!state.nebulae || !state.nebulae.length) return;
    const t = (typeof performance !== "undefined" ? performance.now() / 1000 : state.t);
    const wobbleFreq = 0.04;
    const wobbleAmp = 1;

    for (const neb of state.nebulae) {
      if (!neb._bodyContainer || neb._bodyContainer.destroyed) {
        if (!neb._radiusPhase) neb._radiusPhase = Math.random() * Math.PI * 2;
        const fillColor = neb._hue != null ? neb._hue : 0x223355;
        const strokeColor = neb._hue != null ? neb._hue : 0x4488cc;
        const c = new PIXI.Container();
        c.position.set(neb.x, neb.y);
        const g = new PIXI.Graphics();
        g.circle(0, 0, 1);
        g.fill({ color: fillColor, alpha: 0.05 });
        const steps = 64;
        for (let s = 0; s < steps; s++) {
          const a1 = (s / steps) * Math.PI * 2;
          const a2 = ((s + 1) / steps) * Math.PI * 2;
          g.moveTo(Math.cos(a1), Math.sin(a1));
          g.lineTo(Math.cos(a2), Math.sin(a2));
        }
        g.stroke({ color: strokeColor, width: 2 / Math.max(1, neb.radius), alpha: 0.35 });
        c.addChild(g);
        combatLayer.addChild(c);
        neb._bodyContainer = c;
      }
      const rWobble = neb.radius + Math.sin(t * wobbleFreq + (neb._radiusPhase || 0)) * wobbleAmp;
      neb._bodyContainer.visible = inView(neb.x, neb.y);
      neb._bodyContainer.position.set(neb.x, neb.y);
      neb._bodyContainer.scale.set(rWobble);
    }

    if (!state._nebulaDischargeGfx || state._nebulaDischargeGfx.destroyed) {
      state._nebulaDischargeGfx = new PIXI.Graphics();
      combatLayer.addChild(state._nebulaDischargeGfx);
    }
    state._nebulaDischargeGfx.clear();
    const dg = state._nebulaDischargeGfx;
    for (const neb of state.nebulae) {
      if (!inView(neb.x, neb.y)) continue;
      for (const d of neb.discharges) {
        const age = d.maxLife - d.life;
        const lifeFrac = d.life / d.maxLife;
        const fadeIn = age < d.maxLife * 0.2 ? age / (d.maxLife * 0.2) : 1;
        const fadeOut = lifeFrac < 0.25 ? lifeFrac / 0.25 : 1;
        const alpha = 0.92 * fadeIn * fadeOut;
        const revealFrac = age < d.maxLife * 0.2 ? age / (d.maxLife * 0.2) : 1;
        const visibleLen = (d.totalLen || 9999) * revealFrac;
        const hue = d.hue || 0x6699cc;
        let drawn = 0;
        for (const seg of (d.segs || [])) {
          if (drawn >= visibleLen) break;
          const segLen = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
          const segEnd = drawn + segLen;
          let ex = seg.x2, ey = seg.y2;
          if (segEnd > visibleLen) {
            const tf = (visibleLen - drawn) / segLen;
            ex = seg.x1 + (seg.x2 - seg.x1) * tf;
            ey = seg.y1 + (seg.y2 - seg.y1) * tf;
          }
          dg.moveTo(seg.x1, seg.y1);
          dg.lineTo(ex, ey);
          dg.stroke({ color: hue, width: 4.5, alpha: 0.22 * alpha });
          dg.moveTo(seg.x1, seg.y1);
          dg.lineTo(ex, ey);
          dg.stroke({ color: 0xaaddff, width: 2.5, alpha: 0.45 * alpha });
          dg.moveTo(seg.x1, seg.y1);
          dg.lineTo(ex, ey);
          dg.stroke({ color: 0xccddff, width: 0.8, alpha: 0.22 * alpha });
          drawn = segEnd;
        }
      }
    }
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
      for (let i = 0; i < 20; i++) {
        const txt = new PIXI.Text({ text: "⚡", style: { fontSize: 22 + Math.random() * 16, fill: 0xffffff } });
        txt.anchor.set(0.5);
        txt._stormOx = rand(-STORM_RADIUS * s.stretch * 0.55, STORM_RADIUS * s.stretch * 0.55);
        txt._stormOy = rand(-STORM_RADIUS * 0.4, STORM_RADIUS * 0.4);
        txt._stormPhase = Math.random() * Math.PI * 2;
        txt._stormCycle = 0.4 + Math.random() * 0.6;
        s.emojiContainer.addChild(txt);
      }
    }
    s.gfx.visible = true;
    s.emojiContainer.visible = true;
    s.gfx.clear();

    const contour = stormContourPoints(s);
    const t = state.t;
    const shimmer = 0.5 + 0.12 * Math.sin(t * 1.5);

    // Outer glow layer
    const outerContour = contour.map(pt => ({
      x: s.x + (pt.x - s.x) * 1.12,
      y: s.y + (pt.y - s.y) * 1.12
    }));
    s.gfx.beginFill(0x161640, shimmer * 0.2);
    s.gfx.moveTo(outerContour[0].x, outerContour[0].y);
    for (let i = 1; i < outerContour.length; i++) s.gfx.lineTo(outerContour[i].x, outerContour[i].y);
    s.gfx.closePath();
    s.gfx.endFill();

    // Core nebula fill
    s.gfx.beginFill(0x1e1e55, shimmer * 0.45);
    s.gfx.moveTo(contour[0].x, contour[0].y);
    for (let i = 1; i < contour.length; i++) s.gfx.lineTo(contour[i].x, contour[i].y);
    s.gfx.closePath();
    s.gfx.endFill();

    // Soft nebula edge
    s.gfx.lineStyle(6, 0x3355aa, 0.18 * shimmer);
    s.gfx.moveTo(contour[0].x, contour[0].y);
    for (let i = 1; i < contour.length; i++) s.gfx.lineTo(contour[i].x, contour[i].y);
    s.gfx.closePath();

    // Emoji lightning
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
  // Abilities
  // ------------------------------------------------------------
  const ABILITY_DEFS = [
    { id: "ionNebula", name: "Ионная туманность", desc: "Гроза в зоне 10с: урон + замедление", cooldown: 120, icon: "🌩️", targeting: "point" },
    { id: "meteor", name: "Сверхбыстрый метеор", desc: "Метеор сквозь карту, 25% по планете", cooldown: 120, icon: "☄️", targeting: "angle" },
    { id: "timeJump", name: "Временной скачок", desc: "Отмотка на 1 мин назад (разово)", cooldown: 0, oneTime: true, icon: "⏪" },
    { id: "blackHole", name: "Чёрная дыра", desc: "Засасывает и повреждает юнитов " + CFG.BLACKHOLE_DURATION + "с", cooldown: CFG.BLACKHOLE_COOLDOWN, icon: "🕳️", targeting: "point" },
    { id: "activeShield", name: "Активный Щит", desc: "Щит +25% от макс. HP всем кораблям", cooldown: 90, icon: "🛡️" },
    { id: "pirateRaid", name: "Налёт Пиратов", desc: "Пираты атакуют всех (5+2+1)", cooldown: 150, icon: "🏴‍☠️", targeting: "point" },
    { id: "gloriousBattleMarch", name: "Боевой Марш", desc: "+30% скорости всем кораблям 30с", cooldown: 60, icon: "🎺" },
    { id: "raiderCapture", name: "Рейдерский захват", desc: "Ворует 10% населения врага", cooldown: 120, icon: "⚔️", targeting: "city" },
    { id: "loan", name: "Заём", desc: "+5000€. Через 3 мин вычтет 7500€", cooldown: 300, icon: "💰" },
    { id: "spatialRift", name: "Разлом", desc: "АоЕ урон + замедление 10с", cooldown: 100, icon: "🌀", targeting: "point" },
    { id: "gravAnchor", name: "Грав. Якорь", desc: "Иммобилизация врагов в радиусе 5с", cooldown: 90, icon: "⚓", targeting: "point" },
    { id: "shieldOvercharge", name: "Перегрузка Щитов", desc: "Полное восстановление щита города", cooldown: 120, icon: "🔋" },
    { id: "droneSwarm", name: "Рой Дронов", desc: "8 временных истребителей (30с)", cooldown: 90, icon: "🐝" },
    { id: "fakeSignature", name: "Ложная Сигнатура", desc: "Призрачный флот отвлекает врага 15с", cooldown: 80, icon: "👻", targeting: "point" },
    { id: "fleetBoost", name: "Ускорение Флота", desc: "+50% скорости всем юнитам 20с", cooldown: 70, icon: "⚡" },
    { id: "resourceSurge", name: "Ресурсный Всплеск", desc: "+3000 eCredits мгновенно", cooldown: 180, icon: "💎" },
    { id: "timeSingularity", name: "Сингулярность", desc: "Замедление врагов -60% в зоне 8с", cooldown: 110, icon: "⏳", targeting: "point" },
    { id: "orbitalStrike", name: "Орбитальный Удар", desc: "Линейный удар через карту", cooldown: 130, icon: "💥", targeting: "angle" },
    { id: "voidShield", name: "Щит Пустоты", desc: "Неуязвимость всех юнитов 3с", cooldown: 150, icon: "✨" },
    { id: "nanoSwarm", name: "Нанорой", desc: "DoT + -25% атаки врагов в зоне 10с", cooldown: 100, icon: "🦠", targeting: "point" },
    { id: "hyperJump", name: "Гиперскачок", desc: "Телепорт своих юнитов в точку", cooldown: 90, icon: "🚀", targeting: "point" },
    { id: "sabotage", name: "Диверсия", desc: "Уничтожает 20% eCredits ближайшего врага", cooldown: 120, icon: "💣" },
    { id: "emergencyRepair", name: "Аварийный Ремонт", desc: "Полное исцеление всех юнитов", cooldown: 180, icon: "🔧" },
    { id: "gravWave", name: "Грав. Волна", desc: "Отталкивает всех врагов от точки", cooldown: 80, icon: "🌊", targeting: "point" },
    { id: "resourceRaid", name: "Перехват Шахты", desc: "Захватывает вражескую шахту на 30с", cooldown: 150, icon: "⛏️", targeting: "point" },
    { id: "thermoNuke", name: "Термоядерный Импульс", desc: "Огромный АоЕ урон, -50% и по своим!", cooldown: 200, icon: "☢️", targeting: "point" }
  ];

  state._abilityCooldowns = {};
  state._abilityCooldownsByPlayer = state._abilityCooldownsByPlayer || {};
  state._abilityUsedByPlayer = state._abilityUsedByPlayer || {};
  state._abilityAnnouncements = state._abilityAnnouncements || [];
  state._abilityTargeting = null;
  state._timeSnapshots = state._timeSnapshots || [];
  state._lastTimeSnapshotAt = state._lastTimeSnapshotAt ?? 0;
  state._abilityStorms = [];
  state._meteorTargeting = null; // {phase:'point'|'angle', x, y, angle}
  state._activeMeteors = [];
  state._battleMarchUntil = state._battleMarchUntil || {};
  state._raiderCaptureTargeting = null;
  const PIRATE_OWNER_ID = -1;
  const SURVIVAL_ENEMY_OWNER_ID = 999;

  function pushAbilityAnnouncement(pid, abilityId) {
    const p = state.players.get(pid);
    const def = ABILITY_DEFS.find(d => d.id === abilityId);
    const playerName = p ? (p.name || "Игрок " + pid) : ("Игрок " + pid);
    const abilityName = def ? def.name : abilityId;
    state._abilityAnnouncements.push({
      text: playerName + " применил способность «" + abilityName + "»",
      ttl: 4.5,
      t0: state.t
    });
    while (state._abilityAnnouncements.length > 8) state._abilityAnnouncements.shift();
  }

  const abilityOverlay = document.getElementById("abilityOverlay");
  const abilityPanel = document.getElementById("abilityPanel");
  const abilityCards = document.getElementById("abilityCards");
  const abilityClose = document.getElementById("abilityClose");
  const abilitiesBtn = document.getElementById("abilitiesBtn");

  if (abilitiesBtn) {
    abilitiesBtn.disabled = false;
    abilitiesBtn.addEventListener("click", () => {
      if (state._abilityTargeting) { cancelAbilityTargeting(); return; }
      showAbilityPicker();
    });
  }
  if (abilityClose) abilityClose.addEventListener("click", hideAbilityPicker);
  if (abilityOverlay) abilityOverlay.addEventListener("click", (e) => {
    if (e.target === abilityOverlay) hideAbilityPicker();
  });

  function showAbilityPicker() {
    if (!abilityOverlay || !abilityCards) return;
    abilityCards.innerHTML = "";
    const myCds = state._abilityCooldownsByPlayer[state.myPlayerId] || state._abilityCooldowns || {};
    const myUsed = state._abilityUsedByPlayer[state.myPlayerId] || [];
    const timeJumpAvailableAt = state._timeJumpAvailableAt ?? 0;
    for (const def of ABILITY_DEFS) {
      const used = def.oneTime && myUsed.includes(def.id);
      const onCooldownStart = def.id === "timeJump" && state.t < timeJumpAvailableAt;
      const cd = used ? 1 : (myCds[def.id] ?? 0);
      const ready = !used && cd <= 0 && !onCooldownStart;
      const card = document.createElement("div");
      card.style.cssText = `
        width:130px;height:190px;background:linear-gradient(180deg,#12143a 0%,#1a1d55 100%);
        border:2px solid ${ready ? "#44aaff" : "#555"};border-radius:12px;cursor:${ready ? "pointer" : "not-allowed"};
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
        padding:12px 8px;transition:transform 0.15s,box-shadow 0.15s;
        ${ready ? "box-shadow:0 0 16px #2266ff44;" : "opacity:0.5;"}
      `;
      if (ready) {
        card.onmouseenter = () => { card.style.transform = "scale(1.07)"; card.style.boxShadow = "0 0 28px #44aaffaa"; };
        card.onmouseleave = () => { card.style.transform = ""; card.style.boxShadow = "0 0 16px #2266ff44"; };
      }
      card.innerHTML = `
        <div style="font-size:36px;">${def.icon}</div>
        <div style="color:#ddeeff;font-size:13px;font-weight:700;text-align:center;">${def.name}</div>
        <div style="color:#8899bb;font-size:11px;text-align:center;line-height:1.3;">${def.desc}</div>
        ${!ready ? `<div style="color:#ff6644;font-size:12px;font-weight:600;">${def.id === "timeJump" && state.t < timeJumpAvailableAt ? "через " + Math.ceil(timeJumpAvailableAt - state.t) + "с" : Math.ceil(cd) + "с"}</div>` : ""}
      `;
      if (ready) {
        card.addEventListener("click", () => {
          const instantAbilities = {
            timeJump: () => useTimeJump(),
            loan: () => { useLoan(state.myPlayerId); },
            activeShield: () => { useActiveShield(state.myPlayerId); },
            gloriousBattleMarch: () => { useGloriousBattleMarch(state.myPlayerId); },
            shieldOvercharge: () => { useShieldOvercharge(state.myPlayerId); },
            droneSwarm: () => { useDroneSwarm(state.myPlayerId); },
            fleetBoost: () => { useFleetBoost(state.myPlayerId); },
            resourceSurge: () => { useResourceSurge(state.myPlayerId); },
            voidShield: () => { useVoidShield(state.myPlayerId); },
            sabotage: () => { useSabotage(state.myPlayerId); },
            emergencyRepair: () => { useEmergencyRepair(state.myPlayerId); }
          };
          if (instantAbilities[def.id]) {
            instantAbilities[def.id]();
            if (def.cooldown) setAbilityCooldown(state.myPlayerId, def.id, def.cooldown);
            pushAbilityAnnouncement(state.myPlayerId, def.id);
            hideAbilityPicker();
            return;
          }
          startAbilityTargeting(def.id);
        });
      }
      abilityCards.appendChild(card);
    }
    abilityOverlay.style.display = "flex";
  }

  function hideAbilityPicker() {
    if (abilityOverlay) abilityOverlay.style.display = "none";
  }

  function startAbilityTargeting(abilityId) {
    hideAbilityPicker();
    state._abilityTargeting = abilityId;
    state._meteorTargeting = null;
    if (abilityId === "meteor") {
      state._meteorTargeting = { phase: "point", x: 0, y: 0, angle: 0 };
    }
    if (abilityId === "pirateRaid") {
      state._meteorTargeting = { phase: "point", x: 0, y: 0, angle: 0 };
    }
    app.canvas.style.cursor = "crosshair";
  }

  function cancelAbilityTargeting() {
    state._abilityTargeting = null;
    state._meteorTargeting = null;
    app.canvas.style.cursor = "";
  }

  function _spawnIonNebulaLocal(wx, wy) {
    const stretch = 0.8 + Math.random() * 0.6;
    const rotAngle = Math.random() * Math.PI * 2;
    const blobCount = 4 + Math.floor(Math.random() * 3);
    const blobs = [];
    for (let i = 0; i < blobCount; i++) {
      const t = (i / (blobCount - 1)) - 0.5;
      blobs.push({
        ox: t * STORM_RADIUS * stretch * 0.9 + rand(-15, 15),
        oy: rand(-STORM_RADIUS * 0.25, STORM_RADIUS * 0.25),
        r: STORM_RADIUS * (0.45 + Math.random() * 0.25),
        _baseOx: 0, _baseOy: 0, _baseR: 0, _phase: i * 1.3
      });
    }
    for (const b of blobs) { b._baseOx = b.ox; b._baseOy = b.oy; b._baseR = b.r; }
    state._abilityStorms.push({
      x: wx, y: wy, vx: 0, vy: 0,
      spawnedAt: state.t, duration: 10, lastDmgTick: state.t,
      gfx: null, emojiContainer: null,
      rotAngle, stretch, blobs, lastDirChange: state.t
    });
  }

  function setAbilityCooldown(pid, abilityId, seconds) {
    if (!state._abilityCooldownsByPlayer[pid]) state._abilityCooldownsByPlayer[pid] = {};
    state._abilityCooldownsByPlayer[pid][abilityId] = seconds;
  }
  function useIonNebula(wx, wy) {
    const def = ABILITY_DEFS.find(d => d.id === "ionNebula");
    if (state._multiSlots && !state._multiIsHost && state._socket) {
      state._socket.emit("playerAction", { type: "useAbility", abilityId: "ionNebula", pid: state.myPlayerId, x: wx, y: wy });
    } else {
      _spawnIonNebulaLocal(wx, wy);
      setAbilityCooldown(state.myPlayerId, "ionNebula", def.cooldown);
      pushAbilityAnnouncement(state.myPlayerId, "ionNebula");
    }
    cancelAbilityTargeting();
  }

  const METEOR_RADIUS = 11;
  const METEOR_AOE_RADIUS = 30;
  const METEOR_SPEED_PX_PER_S = Math.hypot(CFG.WORLD_W, CFG.WORLD_H) / 22;

  function _spawnMeteorLocal(targetX, targetY, angle, ownerId) {
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    let tMin = Infinity;
    if (cosA > 0.001) { const t = targetX / cosA; if (t > 0 && t < tMin) tMin = t; }
    if (cosA < -0.001) { const t = (targetX - CFG.WORLD_W) / cosA; if (t > 0 && t < tMin) tMin = t; }
    if (sinA > 0.001) { const t = targetY / sinA; if (t > 0 && t < tMin) tMin = t; }
    if (sinA < -0.001) { const t = (targetY - CFG.WORLD_H) / sinA; if (t > 0 && t < tMin) tMin = t; }
    if (tMin === Infinity || tMin <= 0) tMin = Math.hypot(CFG.WORLD_W, CFG.WORLD_H);
    const sx = targetX - cosA * tMin;
    const sy = targetY - sinA * tMin;
    state._activeMeteors.push({
      x: sx, y: sy,
      vx: Math.cos(angle) * METEOR_SPEED_PX_PER_S,
      vy: Math.sin(angle) * METEOR_SPEED_PX_PER_S,
      angle,
      radius: METEOR_RADIUS,
      aoeR: METEOR_AOE_RADIUS,
      ownerId: ownerId ?? state.myPlayerId,
      alive: true, gfx: null, trajGfx: null
    });
  }

  function useMeteor(targetX, targetY, angle) {
    const def = ABILITY_DEFS.find(d => d.id === "meteor");
    if (state._multiSlots && !state._multiIsHost && state._socket) {
      state._socket.emit("playerAction", { type: "useAbility", abilityId: "meteor", pid: state.myPlayerId, x: targetX, y: targetY, angle });
    } else {
      _spawnMeteorLocal(targetX, targetY, angle, state.myPlayerId);
      setAbilityCooldown(state.myPlayerId, "meteor", def.cooldown);
      pushAbilityAnnouncement(state.myPlayerId, "meteor");
    }
    cancelAbilityTargeting();
  }

  const TIME_JUMP_REWIND_SEC = 60;
  const TIME_SNAPSHOT_INTERVAL = 5;
  const TIME_SNAPSHOT_MAX = 15;
  const SKIP_KEYS = new Set(["gfx", "cityGfx", "zoneGfx", "zoneGlow", "zoneLightGfx", "label", "shieldGfx", "labelGfx", "radiusGfx", "emojiContainer", "trajGfx", "_polyBuf", "zoneGfx", "zoneGlow"]);

  function cloneForSnapshot(obj) {
    const out = {};
    for (const k of Object.keys(obj)) {
      if (SKIP_KEYS.has(k)) continue;
      out[k] = obj[k];
    }
    try {
      return JSON.parse(JSON.stringify(out));
    } catch (_) {
      return out;
    }
  }

  function saveTimeSnapshot() {
    const inSolo = !state._multiSlots;
    const inMpHost = state._multiIsHost && state._multiSlots;
    if (!inSolo && !inMpHost || state._timeSnapshots == null) return;
    const now = state.t;
    if (now < (state._timeJumpAvailableAt ?? 0)) return;
    if (now - state._lastTimeSnapshotAt < TIME_SNAPSHOT_INTERVAL) return;
    state._lastTimeSnapshotAt = now;
    const players = [];
    for (const p of state.players.values()) {
      players.push(cloneForSnapshot(p));
    }
    const units = [];
    for (const u of state.units.values()) {
      units.push(cloneForSnapshot(u));
    }
    const turrets = [];
    for (const t of state.turrets.values()) {
      turrets.push(cloneForSnapshot(t));
    }
    const bullets = state.bullets.map(b => ({ ...b }));
    const res = [];
    for (const r of state.res.values()) {
      res.push(cloneForSnapshot(r));
    }
    state._timeSnapshots.push({
      t: now,
      nextUnitId: state.nextUnitId,
      nextResId: state.nextResId,
      players,
      units,
      turrets,
      bullets,
      res
    });
    while (state._timeSnapshots.length > TIME_SNAPSHOT_MAX) state._timeSnapshots.shift();
  }

  function markAbilityUsed(pid, abilityId) {
    if (!state._abilityUsedByPlayer[pid]) state._abilityUsedByPlayer[pid] = [];
    if (!state._abilityUsedByPlayer[pid].includes(abilityId)) state._abilityUsedByPlayer[pid].push(abilityId);
  }

  function restoreFromTimeSnapshot(snap, eliminatedBeforeRewind, usedByPid) {
    const destroyGfx = (o) => {
      if (o && o.gfx && o.gfx.parent) o.gfx.parent.removeChild(o.gfx);
      if (o && o.gfx && o.gfx.destroy) o.gfx.destroy(true);
    };
    for (const p of state.players.values()) {
      if (p.cityGfx && p.cityGfx.parent) p.cityGfx.parent.removeChild(p.cityGfx);
      if (p.zoneGfx && p.zoneGfx.parent) p.zoneGfx.parent.removeChild(p.zoneGfx);
      if (p.zoneGlow && p.zoneGlow.parent) p.zoneGlow.parent.removeChild(p.zoneGlow);
      if (p.zoneLightGfx && p.zoneLightGfx.parent) p.zoneLightGfx.parent.removeChild(p.zoneLightGfx);
      if (p.shieldGfx && p.shieldGfx.parent) p.shieldGfx.parent.removeChild(p.shieldGfx);
    }
    for (const u of state.units.values()) destroyGfx(u);
    for (const t of state.turrets.values()) {
      destroyGfx(t);
      if (t.labelGfx && t.labelGfx.parent) t.labelGfx.parent.removeChild(t.labelGfx);
      if (t.radiusGfx && t.radiusGfx.parent) t.radiusGfx.parent.removeChild(t.radiusGfx);
    }
    for (const r of state.res.values()) destroyGfx(r);

    state.players.clear();
    state.units.clear();
    state.turrets.clear();
    state.bullets.length = 0;
    state.res.clear();
    state.t = snap.t;
    state.nextUnitId = snap.nextUnitId;
    state.nextResId = snap.nextResId;

    for (const o of snap.players) {
      const p = { ...o, cityGfx: null, zoneGfx: null, zoneGlow: null, zoneLightGfx: null, shieldGfx: null, label: null };
      state.players.set(p.id, p);
      if (eliminatedBeforeRewind.includes(p.id)) {
        if (!state.botPlayerIds) state.botPlayerIds = new Set();
        state.botPlayerIds.add(p.id);
        p._isBot = true;
      }
      makeCityVisual(p);
      makeZoneVisual(p);
    }
    for (const o of snap.units) {
      const u = { ...o, gfx: null };
      state.units.set(u.id, u);
      makeUnitVisual(u);
    }
    for (const o of snap.turrets) {
      const t = { ...o, gfx: null, labelGfx: null, radiusGfx: null };
      state.turrets.set(t.id, t);
    }
    for (const b of snap.bullets) state.bullets.push({ ...b });
    for (const o of snap.res) {
      const r = { ...o, gfx: null };
      state.res.set(r.id, r);
      makeResVisual(r);
    }
    markAbilityUsed(usedByPid, "timeJump");
    state._abilityStorms = [];
    state._activeMeteors = [];
    rebuildGrid();
    for (const p of state.players.values()) {
      redrawZone(p);
      if (typeof rebuildTurrets === "function") rebuildTurrets(p);
    }
  }

  function useTimeJump() {
    const def = ABILITY_DEFS.find(d => d.id === "timeJump");
    if (!def || def.oneTime && (state._abilityUsedByPlayer[state.myPlayerId] || []).includes("timeJump")) return;
    if (state._multiSlots && !state._multiIsHost && state._socket) {
      state._socket.emit("playerAction", { type: "useAbility", abilityId: "timeJump", pid: state.myPlayerId });
      cancelAbilityTargeting();
      hideAbilityPicker();
      return;
    }
    const availableAt = state._timeJumpAvailableAt ?? 0;
    if (state.t < availableAt) {
      cancelAbilityTargeting();
      hideAbilityPicker();
      return;
    }
    if (!state._timeSnapshots || state._timeSnapshots.length === 0) {
      cancelAbilityTargeting();
      hideAbilityPicker();
      return;
    }
    const targetT = Math.max(0, state.t - TIME_JUMP_REWIND_SEC);
    let snap = null;
    for (let i = state._timeSnapshots.length - 1; i >= 0; i--) {
      if (state._timeSnapshots[i].t <= targetT) {
        snap = state._timeSnapshots[i];
        break;
      }
    }
    if (!snap) {
      cancelAbilityTargeting();
      hideAbilityPicker();
      return;
    }
    const eliminatedBeforeRewind = [...state.players.values()].filter(p => p.eliminated).map(p => p.id);
    restoreFromTimeSnapshot(snap, eliminatedBeforeRewind, state.myPlayerId);
    pushAbilityAnnouncement(state.myPlayerId, "timeJump");
    cancelAbilityTargeting();
    hideAbilityPicker();
  }

  function stepMeteors(dt) {
    for (let i = state._activeMeteors.length - 1; i >= 0; i--) {
      const m = state._activeMeteors[i];
      if (!m.alive) { removeMeteorGfx(m); state._activeMeteors.splice(i, 1); continue; }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      // Off map
      if (m.x < -800 || m.x > CFG.WORLD_W + 800 || m.y < -800 || m.y > CFG.WORLD_H + 800) {
        m.alive = false; removeMeteorGfx(m); state._activeMeteors.splice(i, 1); continue;
      }
      const aR = m.aoeR || METEOR_AOE_RADIUS;
      const aR2 = aR * aR;
      for (const u of state.units.values()) {
        if (u.hp <= 0) continue;
        if ((u.x - m.x) ** 2 + (u.y - m.y) ** 2 <= aR2) {
          const maxHp = u.maxHp || 1;
          const dmg = Math.max(1, Math.floor(maxHp * 0.75));
          u.hp = Math.max(0, u.hp - dmg);
          u.lastDamagedBy = m.ownerId;
          state.floatingDamage.push({ x: u.x, y: u.y - 15, text: "💥 -" + dmg, color: 0xff4400, ttl: 0.7 });
          if (!m._impactFx) {
            m._impactFx = true;
            if (!state._meteorImpactEffects) state._meteorImpactEffects = [];
            state._meteorImpactEffects.push({ x: m.x, y: m.y, t0: state.t, duration: 0.5 });
          }
        }
      }
      for (const t of state.turrets.values()) {
        if (t.hp <= 0) continue;
        if ((t.x - m.x) ** 2 + (t.y - m.y) ** 2 <= aR2) {
          if (!m._impactFx) {
            m._impactFx = true;
            if (!state._meteorImpactEffects) state._meteorImpactEffects = [];
            state._meteorImpactEffects.push({ x: m.x, y: m.y, t0: state.t, duration: 0.5 });
          }
          state.floatingDamage.push({ x: t.x, y: t.y - 12, text: "💥", color: 0xff4400, ttl: 0.7 });
          t.hp = 0;
          t._diedAt = state.t;
          spawnXPOrb(t.x, t.y, 8);
        }
      }
      // Hit shield only (meteors pass through planets)
      for (const p of state.players.values()) {
        if (p.eliminated) continue;
        if ((p.shieldHp || 0) <= 0) continue;
        const sR = shieldRadius(p);
        const dist = Math.hypot(m.x - p.x, m.y - p.y);
        if (dist <= sR + aR) {
          if (!m._impactFx) {
            m._impactFx = true;
            if (!state._meteorImpactEffects) state._meteorImpactEffects = [];
            state._meteorImpactEffects.push({ x: m.x, y: m.y, t0: state.t, duration: 0.5 });
          }
          const dmg = Math.max(1, Math.round(p.shieldHp * 0.25));
          p.shieldHp = Math.max(0, p.shieldHp - dmg);
          if (p.shieldHp === 0) p.shieldRegenCd = SHIELD_REGEN_DELAY;
          state.floatingDamage.push({ x: m.x, y: m.y - 10, text: "💥🛡 -" + dmg, color: 0xff4400, ttl: 1.2 });
          m.alive = false; break;
        }
      }
      if (!m.alive) { removeMeteorGfx(m); state._activeMeteors.splice(i, 1); }
    }
  }

  function removeMeteorGfx(m) {
    if (m.gfx) { m.gfx.parent?.removeChild(m.gfx); m.gfx.destroy(true); m.gfx = null; }
    if (m.trajGfx) { m.trajGfx.parent?.removeChild(m.trajGfx); m.trajGfx.destroy(true); m.trajGfx = null; }
  }

  function drawMeteors() {
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 80);
    const diag = Math.hypot(CFG.WORLD_W, CFG.WORLD_H) + 400;
    for (const m of state._activeMeteors) {
      const ang = m.angle ?? Math.atan2(m.vy, m.vx);
      const cosA = Math.cos(ang), sinA = Math.sin(ang);
      const halfW = m.aoeR || METEOR_AOE_RADIUS;

      // Trajectory corridor — full AOE width, 50% transparent
      if (!m.trajGfx || m.trajGfx.destroyed) { m.trajGfx = new PIXI.Graphics(); world.addChild(m.trajGfx); }
      m.trajGfx.clear();
      const tStartX = m.x - cosA * diag, tStartY = m.y - sinA * diag;
      const tEndX = m.x + cosA * diag, tEndY = m.y + sinA * diag;
      // Corridor fill (4 corners of a rectangle along the trajectory)
      const nx = -sinA * halfW, ny = cosA * halfW;
      m.trajGfx.beginFill(0xff2200, 0.12);
      m.trajGfx.moveTo(tStartX + nx, tStartY + ny);
      m.trajGfx.lineTo(tEndX + nx, tEndY + ny);
      m.trajGfx.lineTo(tEndX - nx, tEndY - ny);
      m.trajGfx.lineTo(tStartX - nx, tStartY - ny);
      m.trajGfx.closePath();
      m.trajGfx.endFill();
      // Edge lines
      m.trajGfx.lineStyle(1.5, 0xff4400, 0.5);
      m.trajGfx.moveTo(tStartX + nx, tStartY + ny);
      m.trajGfx.lineTo(tEndX + nx, tEndY + ny);
      m.trajGfx.moveTo(tStartX - nx, tStartY - ny);
      m.trajGfx.lineTo(tEndX - nx, tEndY - ny);
      // Center line
      m.trajGfx.lineStyle(1, 0xff6600, 0.3);
      m.trajGfx.moveTo(tStartX, tStartY); m.trajGfx.lineTo(tEndX, tEndY);
      // Direction arrows along trajectory (every 120px ahead of meteor)
      const arrowSpacing = 120;
      const arrowSize = 10;
      for (let d = 60; d < diag; d += arrowSpacing) {
        const ax = m.x + cosA * d, ay = m.y + sinA * d;
        if (ax < -100 || ax > CFG.WORLD_W + 100 || ay < -100 || ay > CFG.WORLD_H + 100) continue;
        const apulse = 0.3 + 0.2 * Math.sin(performance.now() / 200 + d * 0.01);
        m.trajGfx.lineStyle(2, 0xff6600, apulse);
        m.trajGfx.moveTo(ax - cosA * arrowSize + nx * 0.6, ay - sinA * arrowSize + ny * 0.6);
        m.trajGfx.lineTo(ax, ay);
        m.trajGfx.lineTo(ax - cosA * arrowSize - nx * 0.6, ay - sinA * arrowSize - ny * 0.6);
      }

      // Meteor body
      if (!m.gfx || m.gfx.destroyed) { m.gfx = new PIXI.Graphics(); world.addChild(m.gfx); }
      m.gfx.clear();
      m.gfx.beginFill(0xff4400, 0.08 * pulse);
      m.gfx.drawCircle(m.x, m.y, halfW);
      m.gfx.endFill();
      m.gfx.beginFill(0xff4400, 0.2 * pulse);
      m.gfx.drawCircle(m.x, m.y, m.radius * 2.5);
      m.gfx.endFill();
      m.gfx.beginFill(0xff6600, 0.55 * pulse);
      m.gfx.drawCircle(m.x, m.y, m.radius * 1.5);
      m.gfx.endFill();
      m.gfx.beginFill(0xffcc44, 0.9);
      m.gfx.drawCircle(m.x, m.y, m.radius);
      m.gfx.endFill();
      m.gfx.beginFill(0xffffff, 0.8);
      m.gfx.drawCircle(m.x, m.y, m.radius * 0.4);
      m.gfx.endFill();
      // Trail — long multi-segment glow
      const spd = Math.hypot(m.vx, m.vy) || 1;
      const trailLen = spd * 0.45;
      const tdx = -(m.vx / spd), tdy = -(m.vy / spd);
      const steps = 8;
      for (let s = 0; s < steps; s++) {
        const f = s / steps;
        const lx = m.x + tdx * trailLen * f;
        const ly = m.y + tdy * trailLen * f;
        const alpha = (1 - f) * 0.08 * pulse;
        const rad = m.radius * (1.5 + (1 - f) * 2);
        m.gfx.beginFill(0xff2200, alpha);
        m.gfx.drawCircle(lx, ly, rad);
        m.gfx.endFill();
      }
      m.gfx.lineStyle(m.radius * 2.5, 0xff4400, 0.1);
      m.gfx.moveTo(m.x, m.y); m.gfx.lineTo(m.x + tdx * trailLen * 0.5, m.y + tdy * trailLen * 0.5);
      m.gfx.lineStyle(m.radius * 1.2, 0xff8844, 0.25);
      m.gfx.moveTo(m.x, m.y); m.gfx.lineTo(m.x + tdx * trailLen * 0.35, m.y + tdy * trailLen * 0.35);
    }
  }

  function drawMeteorImpactEffects() {
    if (!state._meteorImpactEffects || !state._meteorImpactEffects.length) return;
    const W = CFG.WORLD_W, H = CFG.WORLD_H;
    const margin = 100;
    for (let i = state._meteorImpactEffects.length - 1; i >= 0; i--) {
      const fx = state._meteorImpactEffects[i];
      const elapsed = state.t - fx.t0;
      if (elapsed >= fx.duration) {
        if (fx.gfx && !fx.gfx.destroyed) { fx.gfx.parent?.removeChild(fx.gfx); fx.gfx.destroy(true); }
        state._meteorImpactEffects.splice(i, 1);
        continue;
      }
      const f = elapsed / fx.duration;
      const alpha = 1 - f;
      const r = (METEOR_AOE_RADIUS || 30) * (0.5 + 0.5 * (1 - f));
      if (fx.x < -margin || fx.x > W + margin || fx.y < -margin || fx.y > H + margin) continue;
      if (!fx.gfx || fx.gfx.destroyed) { fx.gfx = new PIXI.Graphics(); world.addChild(fx.gfx); }
      fx.gfx.clear();
      fx.gfx.beginFill(0xff4400, alpha * 0.4);
      fx.gfx.drawCircle(fx.x, fx.y, r);
      fx.gfx.endFill();
      fx.gfx.beginFill(0xff8800, alpha * 0.25);
      fx.gfx.drawCircle(fx.x, fx.y, r * 0.6);
      fx.gfx.endFill();
    }
  }

  function stepRandomEvents(dt) {
    if (!state._multiIsHost && state._multiSlots) return;
    const W = CFG.WORLD_W, H = CFG.WORLD_H;
    const margin = 200;
    if (state.t >= (state._randomBlackHoleNextAt ?? 0)) {
      state._randomBlackHoleNextAt = state.t + 300;
      const x = margin + Math.random() * (W - 2 * margin);
      const y = margin + Math.random() * (H - 2 * margin);
      spawnBlackHole(x, y, null);
    }
    if (!state._randomMeteorScheduled) state._randomMeteorScheduled = [];
    if (state.t >= (state._randomMeteorNextAt ?? 0)) {
      state._randomMeteorNextAt = state.t + 240;
      const angles = [Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2];
      for (let i = 0; i < 3; i++) {
        state._randomMeteorScheduled.push({ spawnAt: state.t + i * 2, angle: angles[i] });
      }
    }
    for (let i = state._randomMeteorScheduled.length - 1; i >= 0; i--) {
      const s = state._randomMeteorScheduled[i];
      if (state.t < s.spawnAt) continue;
      state._randomMeteorScheduled.splice(i, 1);
      const edge = Math.floor(Math.random() * 4);
      let sx, sy, tx, ty;
      if (edge === 0) { sx = Math.random() * W; sy = -100; tx = W * 0.5 + (Math.random() - 0.5) * W * 0.6; ty = H * 0.5; }
      else if (edge === 1) { sx = W + 100; sy = Math.random() * H; tx = W * 0.5; ty = H * 0.5 + (Math.random() - 0.5) * H * 0.6; }
      else if (edge === 2) { sx = Math.random() * W; sy = H + 100; tx = W * 0.5 + (Math.random() - 0.5) * W * 0.6; ty = H * 0.5; }
      else { sx = -100; sy = Math.random() * H; tx = W * 0.5; ty = H * 0.5 + (Math.random() - 0.5) * H * 0.6; }
      const angle = Math.atan2(ty - sy, tx - sx) + (Math.random() - 0.5) * 0.4;
      _spawnMeteorLocal(tx, ty, angle, null);
    }
  }

  function stepBgComets(dt) {
    if (!state._bgComets) state._bgComets = [];
    if (state._bgCometNextAt === undefined) state._bgCometNextAt = 0;
    if (state._bgCometNextAt > 0 && state.t >= state._bgCometNextAt && state._bgComets.length < 4) {
      const W = CFG.WORLD_W, H = CFG.WORLD_H;
      const edge = Math.floor(Math.random() * 4);
      let x, y, vx, vy;
      const speed = 80 + Math.random() * 100;
      if (edge === 0) {
        x = Math.random() * W;
        y = -80;
        vx = (Math.random() - 0.5) * 40;
        vy = speed;
      } else if (edge === 1) {
        x = W + 80;
        y = Math.random() * H;
        vx = -speed;
        vy = (Math.random() - 0.5) * 40;
      } else if (edge === 2) {
        x = Math.random() * W;
        y = H + 80;
        vx = (Math.random() - 0.5) * 40;
        vy = -speed;
      } else {
        x = -80;
        y = Math.random() * H;
        vx = speed;
        vy = (Math.random() - 0.5) * 40;
      }
      const tailLen = 40 + Math.random() * 80;
      const life = 18 + Math.random() * 12;
      state._bgComets.push({ x, y, vx, vy, tailLen, life, maxLife: life });
      state._bgCometNextAt = state.t + 8 + Math.random() * 7;
    }
    for (let i = state._bgComets.length - 1; i >= 0; i--) {
      const c = state._bgComets[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.life -= dt;
      const margin = 400;
      if (c.life <= 0 || c.x < -margin || c.x > CFG.WORLD_W + margin || c.y < -margin || c.y > CFG.WORLD_H + margin) {
        state._bgComets.splice(i, 1);
      }
    }
  }

  function drawBgComets() {
    if (!state._bgCometLayer || !state._bgComets || !state._bgComets.length) return;
    const g = state._bgCometLayer;
    g.clear();
    const W = CFG.WORLD_W, H = CFG.WORLD_H;
    for (const c of state._bgComets) {
      const len = Math.hypot(c.vx, c.vy) || 1;
      const nx = -c.vx / len;
      const ny = -c.vy / len;
      const tx = c.x + nx * c.tailLen;
      const ty = c.y + ny * c.tailLen;
      for (let s = 0; s <= 8; s++) {
        const f = s / 8;
        const px = c.x + (tx - c.x) * f;
        const py = c.y + (ty - c.y) * f;
        const alpha = (1 - f) * 0.2 * (c.life / c.maxLife);
        const rad = 2 + (1 - f) * 6;
        g.circle(px, py, rad);
        g.fill({ color: 0xaaccff, alpha });
      }
      g.circle(c.x, c.y, 4);
      g.fill({ color: 0xffffff, alpha: 0.9 });
      g.circle(c.x, c.y, 2);
      g.fill({ color: 0xeeeeff, alpha: 1 });
    }
  }

  function stepAbilityStorms(dt) {
    for (let i = state._abilityStorms.length - 1; i >= 0; i--) {
      const s = state._abilityStorms[i];
      if (state.t - s.spawnedAt > s.duration) {
        if (s.gfx) { s.gfx.parent?.removeChild(s.gfx); s.gfx.destroy(true); }
        if (s.emojiContainer) { s.emojiContainer.parent?.removeChild(s.emojiContainer); s.emojiContainer.destroy({ children: true }); }
        state._abilityStorms.splice(i, 1);
        continue;
      }
      // Morph shape
      const t = state.t;
      for (const b of s.blobs) {
        b.ox = b._baseOx + Math.sin(t * 0.3 + b._phase) * 20;
        b.oy = b._baseOy + Math.cos(t * 0.25 + b._phase * 0.7) * 15;
        b.r = b._baseR * (0.85 + 0.15 * Math.sin(t * 0.4 + b._phase * 1.5));
      }
      // Damage
      if (state.t - s.lastDmgTick >= STORM_DMG_INTERVAL) {
        s.lastDmgTick = state.t;
        const cosA = Math.cos(s.rotAngle), sinA = Math.sin(s.rotAngle);
        for (const u of state.units.values()) {
          if (u.hp <= 1) continue;
          const rx = (u.x - s.x) * cosA + (u.y - s.y) * sinA;
          const ry = -(u.x - s.x) * sinA + (u.y - s.y) * cosA;
          for (const b of s.blobs) {
            if ((rx - b.ox) ** 2 + (ry - b.oy) ** 2 <= b.r * b.r) {
              const dmg = Math.max(1, Math.floor(u.hp * 0.1));
              if (u.hp - dmg < 1) u.hp = 1; else u.hp -= dmg;
              u._hitFlashT = state.t;
              state.floatingDamage.push({ x: u.x, y: u.y - 22, text: "-" + dmg + "⚡", color: 0x8888ff, ttl: 0.8 });
              break;
            }
          }
        }
      }
    }
  }

  // ── New Ability Implementations ──
  state._abilityZoneEffects = state._abilityZoneEffects || [];

  function useShieldOvercharge(pid) {
    const p = state.players.get(pid);
    if (!p) return;
    p.shieldHp = p.shieldMaxHp || (p.pop * 2);
    p.shieldRegenCd = 0;
  }

  function useDroneSwarm(pid) {
    const p = state.players.get(pid);
    if (!p) return;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const sx = p.x + Math.cos(ang) * 80;
      const sy = p.y + Math.sin(ang) * 80;
      const u = spawnUnitAt(sx, sy, pid, "fighter", [{ x: p.x + rand(-200, 200), y: p.y + rand(-200, 200) }]);
      if (u) {
        u._droneExpires = state.t + 30;
        u.hp = Math.round(u.hp * 0.6);
        u.maxHp = u.hp;
      }
    }
  }

  function useFleetBoost(pid) {
    state._fleetBoostUntil = state._fleetBoostUntil || {};
    state._fleetBoostUntil[pid] = state.t + 20;
  }

  function useResourceSurge(pid) {
    const p = state.players.get(pid);
    if (p) p.eCredits = (p.eCredits || 0) + 3000;
  }

  function useVoidShield(pid) {
    state._voidShieldUntil = state._voidShieldUntil || {};
    state._voidShieldUntil[pid] = state.t + 3;
  }

  function useSabotage(pid) {
    const p = state.players.get(pid);
    if (!p) return;
    let nearest = null, nearestD = 1e18;
    for (const other of state.players.values()) {
      if (other.id === pid || other.eliminated) continue;
      const d = Math.hypot(other.x - p.x, other.y - p.y);
      if (d < nearestD) { nearestD = d; nearest = other; }
    }
    if (nearest) {
      const stolen = Math.round((nearest.eCredits || 0) * 0.2);
      nearest.eCredits = Math.max(0, (nearest.eCredits || 0) - stolen);
      state.floatingDamage.push({ x: nearest.x, y: nearest.y - 30, text: "-" + stolen + "€!", color: 0xff4444, ttl: 2.5 });
    }
  }

  function useEmergencyRepair(pid) {
    for (const u of state.units.values()) {
      if (u.owner !== pid || u.hp <= 0) continue;
      u.hp = u.maxHp || u.hp;
    }
  }

  function useAbilityAtPoint(abilityId, wx, wy, pid) {
    const def = ABILITY_DEFS.find(d => d.id === abilityId);
    if (!def) return;

    if (abilityId === "spatialRift") {
      state._abilityZoneEffects.push({ type: "rift", x: wx, y: wy, spawnedAt: state.t, duration: 10, radius: 180, ownerId: pid, dps: 8, slowPct: 0.4 });
    } else if (abilityId === "gravAnchor") {
      state._abilityZoneEffects.push({ type: "anchor", x: wx, y: wy, spawnedAt: state.t, duration: 5, radius: 150, ownerId: pid });
    } else if (abilityId === "fakeSignature") {
      state._fakeSignatures = state._fakeSignatures || [];
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        state._fakeSignatures.push({ x: wx + Math.cos(ang) * 60, y: wy + Math.sin(ang) * 60, color: state.players.get(pid)?.color || 0x4488ff, expiresAt: state.t + 15 });
      }
    } else if (abilityId === "timeSingularity") {
      state._abilityZoneEffects.push({ type: "timeSlow", x: wx, y: wy, spawnedAt: state.t, duration: 8, radius: 200, ownerId: pid, slowPct: 0.6 });
    } else if (abilityId === "nanoSwarm") {
      state._abilityZoneEffects.push({ type: "nano", x: wx, y: wy, spawnedAt: state.t, duration: 10, radius: 160, ownerId: pid, dps: 5, atkReduction: 0.25 });
    } else if (abilityId === "gravWave") {
      for (const u of state.units.values()) {
        if (u.owner === pid || u.hp <= 0) continue;
        const dx = u.x - wx, dy = u.y - wy;
        const d = Math.hypot(dx, dy);
        if (d < 250 && d > 1) {
          const push = 120 * (1 - d / 250);
          u.x += (dx / d) * push;
          u.y += (dy / d) * push;
        }
      }
    } else if (abilityId === "resourceRaid") {
      for (const m of state.mines.values()) {
        if (Math.hypot(m.x - wx, m.y - wy) < 100 && m.ownerId !== pid) {
          m._originalOwner = m.ownerId;
          m._raidReturnAt = state.t + 30;
          m.ownerId = pid;
          break;
        }
      }
    } else if (abilityId === "hyperJump") {
      if (state.selectedUnitIds.size === 0) return;
      for (const uid of state.selectedUnitIds) {
        const u = state.units.get(uid);
        if (!u || u.owner !== pid) continue;
        u.x = wx + rand(-40, 40);
        u.y = wy + rand(-40, 40);
        u.waypoints = [{ x: u.x, y: u.y }];
        u.waypointIndex = 0;
      }
    } else if (abilityId === "thermoNuke") {
      const nukeR = 250;
      for (const u of state.units.values()) {
        if (u.hp <= 0) continue;
        const d = Math.hypot(u.x - wx, u.y - wy);
        if (d < nukeR) {
          const dmgMul = u.owner === pid ? 0.5 : 1.0;
          const dmg = Math.round(80 * (1 - d / nukeR) * dmgMul);
          applyUnitDamage(u, dmg, pid);
        }
      }
      for (const p of state.players.values()) {
        if (p.eliminated) continue;
        const d = Math.hypot(p.x - wx, p.y - wy);
        if (d < nukeR) {
          const popDmg = Math.round(30 * (1 - d / nukeR));
          p.popFloat = Math.max(1, (p.popFloat || p.pop) - popDmg);
          p.pop = Math.floor(p.popFloat);
        }
      }
    }

    setAbilityCooldown(pid, abilityId, def.cooldown);
    pushAbilityAnnouncement(pid, abilityId);
    cancelAbilityTargeting();
  }

  function stepAbilityZoneEffects(dt) {
    for (let i = state._abilityZoneEffects.length - 1; i >= 0; i--) {
      const z = state._abilityZoneEffects[i];
      const elapsed = state.t - z.spawnedAt;
      if (elapsed > z.duration) { state._abilityZoneEffects.splice(i, 1); continue; }

      for (const u of state.units.values()) {
        if (u.owner === z.ownerId || u.hp <= 0) continue;
        const d = Math.hypot(u.x - z.x, u.y - z.y);
        if (d > z.radius) continue;

        if (z.type === "rift" || z.type === "nano") {
          applyUnitDamage(u, (z.dps || 5) * dt, z.ownerId);
          if (z.slowPct) { u._cryoSlowUntil = state.t + 0.5; u._cryoSlowAmount = z.slowPct; }
          if (z.atkReduction) u._atkReductionUntil = state.t + 0.5;
        } else if (z.type === "anchor") {
          u.x = u.x * 0.95 + z.x * 0.05;
          u.y = u.y * 0.95 + z.y * 0.05;
        } else if (z.type === "timeSlow") {
          u._cryoSlowUntil = state.t + 0.5;
          u._cryoSlowAmount = z.slowPct;
        }
      }
    }

    if (state._fleetBoostUntil) {
      for (const pid of Object.keys(state._fleetBoostUntil)) {
        if (state.t > state._fleetBoostUntil[pid]) delete state._fleetBoostUntil[pid];
      }
    }

    for (let i = (state._activeMeteors?.length ?? 0) - 1; i >= 0; i--) {
      const m = state._activeMeteors[i];
      if (m.type === "orbital") {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (m.x < -200 || m.x > CFG.WORLD_W + 200 || m.y < -200 || m.y > CFG.WORLD_H + 200) {
          state._activeMeteors.splice(i, 1);
          continue;
        }
        for (const u of state.units.values()) {
          if (u.owner === m.ownerId || u.hp <= 0) continue;
          if (Math.hypot(u.x - m.x, u.y - m.y) < 40) {
            applyUnitDamage(u, 50, m.ownerId);
          }
        }
      }
    }

    for (const m of state.mines.values()) {
      if (m._raidReturnAt && state.t >= m._raidReturnAt) {
        m.ownerId = m._originalOwner;
        m._raidReturnAt = undefined;
        m._originalOwner = undefined;
      }
    }

    for (const u of [...state.units.values()]) {
      if (u._droneExpires && state.t >= u._droneExpires) {
        killUnit(u, "expired", null);
      }
    }

    if (state._fakeSignatures) {
      state._fakeSignatures = state._fakeSignatures.filter(f => state.t < f.expiresAt);
    }
  }

  // ── Black Hole step ──
  if (!state._blackHoles) state._blackHoles = [];

  function spawnBlackHole(x, y, ownerId) {
    state._blackHoles.push({
      x, y, ownerId,
      spawnedAt: state.t,
      duration: CFG.BLACKHOLE_DURATION,
      radius: CFG.BLACKHOLE_RADIUS,
      gfx: null, phase: 0,
      debris: []
    });
  }

  function useActiveShield(pid) {
    const p = state.players.get(pid);
    if (!p) return;
    for (const u of state.units.values()) {
      if (u.owner !== pid) continue;
      const shieldAmt = Math.max(1, Math.round((u.maxHp || u.hp) * 0.25));
      u._activeShieldHp = (u._activeShieldHp || 0) + shieldAmt;
      u._activeShieldEffectUntil = state.t + 2;
    }
    state._activeShieldEffects = state._activeShieldEffects || [];
    state._activeShieldEffects.push({ pid, t0: state.t, duration: 2 });
  }

  const PIRATE_RAID_CORRIDOR_HALFW = 55;
  const PIRATE_RAID_SPAWN_DIST = Math.hypot(CFG.WORLD_W, CFG.WORLD_H) * 0.65 + 400;
  const PIRATE_RAID_HYPER_SPEED_MUL = 4.5;
  const PIRATE_RAID_HYPER_DIST = 320;
  const PIRATE_RAID_ARRIVE_DIST = 320;
  function spawnPirateRaid(targetX, targetY, angle) {
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    const types = ["fighter", "fighter", "fighter", "fighter", "fighter", "destroyer", "destroyer", "cruiser"];
    const wpX = targetX + (Math.random() - 0.5) * 80;
    const wpY = targetY + (Math.random() - 0.5) * 80;
    const batchTag = `pirate-raid-${state.nextUnitId}`;
    for (const unitTypeKey of types) {
      const spread = (Math.random() - 0.5) * 100;
      const perpX = -sinA * spread, perpY = cosA * spread;
      const sx = targetX - cosA * PIRATE_RAID_SPAWN_DIST + perpX;
      const sy = targetY - sinA * PIRATE_RAID_SPAWN_DIST + perpY;
      const u = spawnUnitAt(sx, sy, PIRATE_OWNER_ID, unitTypeKey, [{ x: wpX, y: wpY }], {
        sourceTag: batchTag,
        autoGroupUntil: state.t + 3,
        allowAutoJoinRecentSpawn: true
      });
      if (u) {
        u._pirateHyperUntil = state.t + 45;
        u.vx = cosA;
        u.vy = sinA;
      }
    }
    state._hyperFlashes = state._hyperFlashes || [];
    state._hyperFlashes.push({ x: targetX - cosA * PIRATE_RAID_SPAWN_DIST * 0.5, y: targetY - sinA * PIRATE_RAID_SPAWN_DIST * 0.5, t0: state.t, duration: 1.2 });
  }

  function useGloriousBattleMarch(pid) {
    state._battleMarchUntil = state._battleMarchUntil || {};
    state._battleMarchUntil[pid] = state.t + 30;
  }

  if (!state._loanDebts) state._loanDebts = [];
  function useLoan(pid) {
    const p = state.players.get(pid);
    if (!p) return;
    p.eCredits = (p.eCredits || 0) + 5000;
    state._loanDebts = state._loanDebts || [];
    state._loanDebts.push({ pid, deductAt: state.t + 180, amount: 7500 });
  }
  function stepLoanDebts(dt) {
    if (!state._loanDebts || !state._loanDebts.length) return;
    for (let i = state._loanDebts.length - 1; i >= 0; i--) {
      const d = state._loanDebts[i];
      if (state.t < d.deductAt) continue;
      const p = state.players.get(d.pid);
      if (p) p.eCredits = (p.eCredits || 0) - d.amount;
      state._loanDebts.splice(i, 1);
    }
  }

  const SURVIVAL_MAX_ENEMIES = 250;
  const SURVIVAL_WAVE_INTERVAL = 60;
  function stepSurvivalWaves(dt) {
    if (!state._survivalMode) return;
    if (state.t < (state._survivalWaveNextAt ?? 0)) return;
    state._survivalWave = (state._survivalWave ?? 0) + 1;
    state._survivalWaveNextAt = state.t + SURVIVAL_WAVE_INTERVAL;

    let enemyCount = 0;
    for (const u of state.units.values()) if (u.owner === SURVIVAL_ENEMY_OWNER_ID) enemyCount++;
    if (enemyCount >= SURVIVAL_MAX_ENEMIES) return;

    const me = state.players.get(1);
    if (!me) return;

    const basePerWave = 4;
    const extraPerWave = 2;
    let N = Math.min(basePerWave + state._survivalWave * extraPerWave, SURVIVAL_MAX_ENEMIES - enemyCount);
    const fighterType = UNIT_TYPES.fighter;
    const waveMul = 1 + (state._survivalWave - 1) * 0.08;

    for (let i = 0; i < N; i++) {
      const x = CFG.WORLD_W * (0.15 + 0.7 * Math.random());
      const y = CFG.WORLD_H + 50;
      const waypoints = [{ x: me.x, y: me.y }];
      const u = spawnUnitAt(x, y, SURVIVAL_ENEMY_OWNER_ID, "fighter", waypoints);
      if (u) {
        u.chaseTargetCityId = 1;
        u.hp = Math.round((u.maxHp || fighterType.hp) * waveMul);
        u.maxHp = u.hp;
        u.dmg = Math.max(1, Math.round((u.dmg || fighterType.damage) * waveMul));
      }
    }
  }

  function useRaiderCapture(pid, targetCityId) {
    const p = state.players.get(pid);
    const targetCity = state.players.get(targetCityId);
    if (!p || !targetCity || targetCity.eliminated || targetCityId === pid) return;
    const steal = Math.max(1, Math.floor((targetCity.pop || 0) * 0.1));
    targetCity.popFloat = Math.max(0, (targetCity.popFloat || targetCity.pop || 0) - steal);
    targetCity.pop = Math.floor(targetCity.popFloat);
    p.popFloat = (p.popFloat || p.pop || 0) + steal;
    p.pop = Math.floor(p.popFloat);
    state.floatingDamage.push({ x: targetCity.x, y: targetCity.y - 40, text: "-" + steal + " нас.", color: 0xff4444, ttl: 2 });
    state.floatingDamage.push({ x: p.x, y: p.y - 40, text: "+" + steal + " нас.", color: 0x44ff44, ttl: 2 });
  }

  function stepBlackHoles(dt) {
    const growT = CFG.BLACKHOLE_GROWTH_TIME || 3;
    const holdT = CFG.BLACKHOLE_HOLD_TIME || 10;
    const fadeT = CFG.BLACKHOLE_FADE_TIME || 4;
    for (let i = state._blackHoles.length - 1; i >= 0; i--) {
      const bh = state._blackHoles[i];
      const elapsed = state.t - bh.spawnedAt;
      if (elapsed > bh.duration) {
        if (bh._bodyContainer && !bh._bodyContainer.destroyed) { bh._bodyContainer.parent?.removeChild(bh._bodyContainer); bh._bodyContainer.destroy({ children: true }); }
        if (bh._debrisGfx && !bh._debrisGfx.destroyed) { bh._debrisGfx.parent?.removeChild(bh._debrisGfx); bh._debrisGfx.destroy(true); }
        bh._bodyContainer = null;
        bh._debrisGfx = null;
        state._blackHoles.splice(i, 1);
        continue;
      }
      bh.phase += dt;

      let sizeFrac;
      if (elapsed < growT) {
        sizeFrac = elapsed / growT;
      } else if (elapsed < growT + holdT) {
        sizeFrac = 1;
      } else {
        sizeFrac = Math.max(0, 1 - (elapsed - growT - holdT) / fadeT);
      }
      const curR = bh.radius * sizeFrac;
      bh._curRadius = curR;
      bh._sizeFrac = sizeFrac;

      if (!bh.debris) bh.debris = [];
      if (bh.debris.length < 25 && Math.random() < dt * 3) {
        const ang = Math.random() * Math.PI * 2;
        const dr = curR * (1.2 + Math.random() * 0.8);
        bh.debris.push({
          x: bh.x + Math.cos(ang) * dr,
          y: bh.y + Math.sin(ang) * dr,
          life: 2 + Math.random() * 2,
          maxLife: 2 + Math.random() * 2,
          size: 1 + Math.random() * 2
        });
      }
      for (let j = bh.debris.length - 1; j >= 0; j--) {
        const d = bh.debris[j];
        d.life -= dt;
        const dx = bh.x - d.x, dy = bh.y - d.y;
        const dist = Math.hypot(dx, dy) || 1;
        const speed = 45 * (1 + (1 - d.life / d.maxLife));
        d.x += (dx / dist) * speed * dt;
        d.y += (dy / dist) * speed * dt;
        if (d.life <= 0 || dist < curR * 0.3) bh.debris.splice(j, 1);
      }

      const gravMul = sizeFrac * sizeFrac;
      for (const u of state.units.values()) {
        const dx = bh.x - u.x, dy = bh.y - u.y;
        const dist = Math.hypot(dx, dy);
        if (dist > curR || dist < 1) continue;

        const pull = CFG.BLACKHOLE_GRAVITY * (1 - dist / curR) * gravMul * dt;
        u.x += (dx / dist) * pull;
        u.y += (dy / dist) * pull;

        const dmgT = dist / curR;
        const dmg = (CFG.BLACKHOLE_MAX_DPS * (1 - dmgT) + CFG.BLACKHOLE_MIN_DPS * dmgT) * sizeFrac * dt;
        u.hp -= dmg;
        u.lastDamagedBy = bh.ownerId;
        if (Math.random() < dt * 2) {
          const showDmg = Math.max(1, Math.round(dmg));
          state.floatingDamage.push({ x: u.x, y: u.y - 20, text: "-" + showDmg + "🕳️", color: 0x8800ff, ttl: 0.6 });
        }
      }
    }
  }

  function drawPirateBase() {
    if (!state.pirateBase || state.pirateBase.hp <= 0) {
      if (state.pirateBase && state.pirateBase.gfx) state.pirateBase.gfx.visible = false;
      if (state.pirateBase && state.pirateBase._emojiGfx) state.pirateBase._emojiGfx.visible = false;
      return;
    }
    const pb = state.pirateBase;
    if (!inView(pb.x, pb.y)) {
      if (pb.gfx) pb.gfx.visible = false;
      if (pb._emojiGfx) pb._emojiGfx.visible = false;
      return;
    }
    if (!pb.gfx || pb.gfx.destroyed) {
      pb.gfx = new PIXI.Graphics();
      resLayer.addChild(pb.gfx);
    }
    if (!pb._emojiGfx || pb._emojiGfx.destroyed) {
      pb._emojiGfx = new PIXI.Text({ text: "🏴‍☠️", style: { fontSize: 36 } });
      pb._emojiGfx.anchor.set(0.5);
      resLayer.addChild(pb._emojiGfx);
    }
    pb.gfx.visible = true;
    pb._emojiGfx.visible = true;
    pb.gfx.position.set(pb.x, pb.y);
    pb._emojiGfx.position.set(pb.x, pb.y - 2);
    pb.gfx.clear();
    const R = 46;
    const g = pb.gfx;
    g.moveTo(0, -R);
    g.lineTo(R * 0.87, R * 0.5);
    g.lineTo(-R * 0.87, R * 0.5);
    g.closePath();
    g.fill({ color: 0x111111, alpha: 0.92 });
    g.moveTo(0, -R);
    g.lineTo(R * 0.87, R * 0.5);
    g.lineTo(-R * 0.87, R * 0.5);
    g.closePath();
    g.stroke({ color: 0xaa6622, width: 3 });
    g.moveTo(0, -R * 0.55);
    g.lineTo(R * 0.48, R * 0.28);
    g.lineTo(-R * 0.48, R * 0.28);
    g.closePath();
    g.stroke({ color: 0xcc8833, width: 1.5, alpha: 0.5 });
    const hpBarW = R * 1.6, hpBarH = 5;
    const hpPct = pb.maxHp > 0 ? pb.hp / pb.maxHp : 1;
    g.rect(-hpBarW / 2, -R - 16, hpBarW, hpBarH);
    g.fill({ color: 0x331111, alpha: 0.8 });
    g.rect(-hpBarW / 2, -R - 16, hpBarW * hpPct, hpBarH);
    g.fill({ color: 0xcc4422, alpha: 0.9 });

    if (pb._respawnTimer > 0) {
      if (!pb._timerTxt || pb._timerTxt.destroyed) {
        pb._timerTxt = new PIXI.Text({ text: "", style: { fontSize: 14, fill: 0xffcc44, fontFamily: "monospace", fontWeight: "bold", stroke: { color: 0x000000, width: 3 } } });
        pb._timerTxt.anchor.set(0.5, 1);
        resLayer.addChild(pb._timerTxt);
      }
      const secs = Math.ceil(pb._respawnTimer);
      const min = Math.floor(secs / 60);
      const sec = secs % 60;
      pb._timerTxt.text = "⏱ " + min + ":" + (sec < 10 ? "0" : "") + sec;
      pb._timerTxt.position.set(pb.x, pb.y - R - 22);
      pb._timerTxt.visible = true;
    } else if (pb._timerTxt) {
      pb._timerTxt.visible = false;
    }
  }

  function drawHyperFlashes() {
    if (!state._hyperFlashes || !state._hyperFlashes.length) return;
    if (!state._hyperFlashGfx || state._hyperFlashGfx.destroyed) {
      state._hyperFlashGfx = new PIXI.Graphics();
      combatLayer.addChild(state._hyperFlashGfx);
    }
    const g = state._hyperFlashGfx;
    g.clear();
    for (let i = state._hyperFlashes.length - 1; i >= 0; i--) {
      const f = state._hyperFlashes[i];
      const elapsed = state.t - f.t0;
      if (elapsed > f.duration) { state._hyperFlashes.splice(i, 1); continue; }
      const t = elapsed / f.duration;
      const alpha = (1 - t) * 0.7;
      const r1 = 20 + t * 160;
      const r2 = 10 + t * 80;
      g.circle(f.x, f.y, r1);
      g.fill({ color: 0x4488ff, alpha: alpha * 0.15 });
      g.circle(f.x, f.y, r2);
      g.fill({ color: 0x88ccff, alpha: alpha * 0.3 });
      g.circle(f.x, f.y, r2 * 0.3);
      g.fill({ color: 0xffffff, alpha: alpha * 0.6 });
      for (let s = 0; s < 6; s++) {
        const a = (s / 6) * Math.PI * 2 + t * 3;
        const len = r1 * (0.5 + t * 0.5);
        g.moveTo(f.x, f.y);
        g.lineTo(f.x + Math.cos(a) * len, f.y + Math.sin(a) * len);
        g.stroke({ color: 0x66aaff, width: 2, alpha: alpha * 0.4 });
      }
    }
    for (const u of state.units.values()) {
      if (u._hyperArrivalFlash && state.t < u._hyperArrivalFlash) {
        const left = u._hyperArrivalFlash - state.t;
        const a = Math.min(1, left) * 0.5;
        g.circle(u.x, u.y, 15 + (1 - left) * 20);
        g.fill({ color: 0x4488ff, alpha: a * 0.3 });
        g.circle(u.x, u.y, 8);
        g.fill({ color: 0xaaddff, alpha: a * 0.5 });
      }
    }
  }

  function drawBlackHoles() {
    const growT = CFG.BLACKHOLE_GROWTH_TIME || 3;
    const holdT = CFG.BLACKHOLE_HOLD_TIME || 10;
    const fadeT = CFG.BLACKHOLE_FADE_TIME || 4;
    const smoothTime = (typeof performance !== "undefined" ? performance.now() / 1000 : state.t);
    for (const bh of state._blackHoles) {
      if (!inView(bh.x, bh.y)) {
        if (bh._bodyContainer) bh._bodyContainer.visible = false;
        if (bh._debrisGfx) bh._debrisGfx.visible = false;
        continue;
      }
      const elapsed = state.t - bh.spawnedAt;
      let sizeFracTarget;
      if (elapsed < growT) sizeFracTarget = elapsed / growT;
      else if (elapsed < growT + holdT) sizeFracTarget = 1;
      else sizeFracTarget = Math.max(0, 1 - (elapsed - growT - holdT) / fadeT);
      bh._drawSizeFrac = (bh._drawSizeFrac != null ? bh._drawSizeFrac * 0.92 + sizeFracTarget * 0.08 : sizeFracTarget);
      const sizeFrac = bh._drawSizeFrac;
      const alpha = sizeFrac;
      const R = (bh._curRadius != null ? bh._curRadius : bh.radius * sizeFrac);
      if (R < 2) continue;

      if (!bh._bodyContainer || bh._bodyContainer.destroyed) {
        const c = new PIXI.Container();
        c.position.set(bh.x, bh.y);
        const g = new PIXI.Graphics();
        const numArms = 8;
        for (let arm = 0; arm < numArms; arm++) {
          const baseAngle = (arm / numArms) * Math.PI * 2;
          const spiralSegs = 48;
          const armLen = 0.55 + (arm % 3) * 0.18;
          const armColor = arm % 2 === 0 ? 0xaaccff : 0xffccaa;
          const armColorDim = arm % 2 === 0 ? 0x6688bb : 0xbb8866;
          for (let s = 0; s < spiralSegs; s++) {
            const frac = s / spiralSegs;
            const tightness = 4 + (arm % 2) * 1.2;
            const sAngle = baseAngle + frac * tightness;
            const sR = 0.18 + frac * armLen;
            const x1 = Math.cos(sAngle) * sR, y1 = Math.sin(sAngle) * sR;
            const frac2 = (s + 1) / spiralSegs;
            const sAngle2 = baseAngle + frac2 * tightness;
            const sR2 = 0.18 + frac2 * armLen;
            const x2 = Math.cos(sAngle2) * sR2, y2 = Math.sin(sAngle2) * sR2;
            const w = Math.max(0.5, 3 * (1 - frac * 0.85)) / 80;
            const armAlpha = 0.5 * (1 - frac * 0.88);
            g.moveTo(x1, y1); g.lineTo(x2, y2);
            g.stroke({ color: armColorDim, width: w + 2 / 80, alpha: armAlpha * 0.35 });
            g.moveTo(x1, y1); g.lineTo(x2, y2);
            g.stroke({ color: armColor, width: w, alpha: armAlpha });
          }
        }
        for (let ring = 3; ring >= 0; ring--) {
          const rr = 0.22 + ring * 0.06;
          const ringA = ring === 0 ? 0.8 : (0.4 - ring * 0.08);
          const col = ring === 0 ? 0xffeedd : ring === 1 ? 0xccddee : ring === 2 ? 0xeecc99 : 0x886644;
          g.circle(0, 0, rr);
          g.stroke({ color: col, width: (ring === 0 ? 4 : 2.5) / 80, alpha: ringA });
        }
        g.circle(0, 0, 0.18);
        g.fill({ color: 0x000000, alpha: 1 });
        g.circle(0, 0, 0.2);
        g.stroke({ color: 0xccddee, width: 2.5 / 80, alpha: 0.85 });
        for (let wi = 0; wi < 16; wi++) {
          const wAngle = (wi / 16) * Math.PI * 2 + wi * 0.25;
          const wLen = 0.75 + (wi % 4) * 0.18;
          const stR = 0.32;
          const sx = Math.cos(wAngle) * stR, sy = Math.sin(wAngle) * stR;
          const ex = Math.cos(wAngle + 0.35) * wLen, ey = Math.sin(wAngle + 0.35) * wLen;
          const wispColor = wi % 3 === 0 ? 0xaaccff : (wi % 3 === 1 ? 0xffccaa : 0xddccbb);
          g.moveTo(sx, sy); g.lineTo(ex, ey);
          g.stroke({ color: wispColor, width: 1 / 80, alpha: 0.18 });
        }
        c.addChild(g);
        combatLayer.addChild(c);
        bh._bodyContainer = c;
        bh._debrisGfx = new PIXI.Graphics();
        combatLayer.addChild(bh._debrisGfx);
      }

      bh._bodyContainer.visible = true;
      if (bh._drawX == null) { bh._drawX = bh.x; bh._drawY = bh.y; }
      bh._drawX = bh._drawX * 0.9 + bh.x * 0.1;
      bh._drawY = bh._drawY * 0.9 + bh.y * 0.1;
      bh._bodyContainer.position.set(bh._drawX, bh._drawY);
      bh._bodyContainer.scale.set(R);
      bh._bodyContainer.rotation = smoothTime * 0.25;
      bh._bodyContainer.alpha = alpha;

      bh._debrisGfx.visible = true;
      bh._debrisGfx.clear();
      if (bh.debris && bh.debris.length) {
        for (const d of bh.debris) {
          const lifeFrac = d.life / d.maxLife;
          bh._debrisGfx.circle(d.x, d.y, d.size ?? 1.5);
          bh._debrisGfx.fill({ color: (d.x + d.y < bh.x + bh.y ? 0x88aacc : 0xccaa88), alpha: 0.4 * lifeFrac * alpha });
        }
      }
      const spawnFrac = Math.min(1, elapsed / growT);
      if (spawnFrac < 1) {
        const tearSpan = R * 3.0 * (1 - spawnFrac);
        const tearA = alpha * (1 - spawnFrac * 0.6);
        if (tearSpan > 3) {
          const slowPhase = smoothTime * 0.25;
          for (let h = 0; h < 8; h++) {
            const ang = (h / 8) * Math.PI * 2 + slowPhase * 0.15;
            const tipR = tearSpan * (0.8 + (h % 3) * 0.15);
            const c1A = ang + 0.3 * ((h % 2) * 2 - 1), c2A = ang + 0.15 * ((h % 2) * 2 - 1);
            const c1R = tipR * 0.4, c2R = tipR * 0.75;
            bh._debrisGfx.moveTo(bh.x, bh.y);
            bh._debrisGfx.bezierCurveTo(bh.x + Math.cos(c1A) * c1R, bh.y + Math.sin(c1A) * c1R, bh.x + Math.cos(c2A) * c2R, bh.y + Math.sin(c2A) * c2R, bh.x + Math.cos(ang) * tipR, bh.y + Math.sin(ang) * tipR);
            bh._debrisGfx.stroke({ color: h % 2 === 0 ? 0x7799bb : 0xbb9977, width: 2, alpha: tearA * 0.5 });
          }
        }
      }
    }
  }

  function drawAbilityStorms() {
    const t = state.t;
    for (const s of state._abilityStorms) {
      if (!inView(s.x, s.y)) {
        if (s.gfx) s.gfx.visible = false;
        if (s.emojiContainer) s.emojiContainer.visible = false;
        continue;
      }
      if (!s.gfx || s.gfx.destroyed) {
        s.gfx = new PIXI.Graphics();
        world.addChild(s.gfx);
      }
      if (!s.emojiContainer || s.emojiContainer.destroyed) {
        s.emojiContainer = new PIXI.Container();
        world.addChild(s.emojiContainer);
        for (let i = 0; i < 16; i++) {
          const txt = new PIXI.Text({ text: "⚡", style: { fontSize: 18 + Math.random() * 14, fill: 0xffffff } });
          txt.anchor.set(0.5);
          txt._stormPhase = Math.random() * Math.PI * 2;
          txt._stormCycle = 0.6 + Math.random() * 0.8;
          txt._seed = i * 7919 + 1;
          s.emojiContainer.addChild(txt);
        }
      }
      s.gfx.visible = true;
      s.emojiContainer.visible = true;
      s.gfx.clear();
      const contour = stormContourPoints(s);
      const shimmer = 0.5 + 0.12 * Math.sin(t * 1.2);
      const outerContour = contour.map(pt => ({ x: s.x + (pt.x - s.x) * 1.06, y: s.y + (pt.y - s.y) * 1.06 }));
      s.gfx.beginFill(0x1e1e55, shimmer * 0.45);
      s.gfx.moveTo(outerContour[0].x, outerContour[0].y);
      for (let j = 1; j < outerContour.length; j++) s.gfx.lineTo(outerContour[j].x, outerContour[j].y);
      s.gfx.closePath();
      s.gfx.endFill();
      s.gfx.lineStyle(6, 0x3355aa, 0.18 * shimmer);
      s.gfx.moveTo(contour[0].x, contour[0].y);
      for (let j = 1; j < contour.length; j++) s.gfx.lineTo(contour[j].x, contour[j].y);
      s.gfx.closePath();
      const R = STORM_RADIUS * s.stretch;
      for (const ch of s.emojiContainer.children) {
        const smoothSlot = (t * 0.4 + ch._stormPhase * 10 + ch._seed) % 24;
        const ang = (smoothSlot / 24) * Math.PI * 2 + (ch._seed % 7) * 0.9;
        const r = R * (0.25 + ((ch._seed * 13) % 70) / 100);
        const targetX = s.x + Math.cos(ang) * r + Math.sin(t * 2 + ch._seed * 0.1) * 8;
        const targetY = s.y + Math.sin(ang) * r * 0.5 + Math.cos(t * 1.7 + ch._seed * 0.07) * 8;
        ch.x = ch.x * 0.85 + targetX * 0.15;
        ch.y = ch.y * 0.85 + targetY * 0.15;
        const cycle = ((t + ch._stormPhase * 2) % ch._stormCycle) / ch._stormCycle;
        ch.alpha = 0.5 + 0.5 * (cycle < 0.5 ? Math.min(1, cycle * 2.5) : Math.max(0, 1 - (cycle - 0.5) * 2.5));
      }
    }
  }

  state._testNoCooldowns = false;

  function stepAbilityCooldowns(dt) {
    if (state._testNoCooldowns) {
      for (const pid in state._abilityCooldownsByPlayer) {
        for (const key in state._abilityCooldownsByPlayer[pid]) state._abilityCooldownsByPlayer[pid][key] = 0;
      }
      return;
    }
    for (const pid in state._abilityCooldownsByPlayer) {
      const cds = state._abilityCooldownsByPlayer[pid];
      for (const key in cds) {
        if (cds[key] > 0) cds[key] -= dt;
      }
    }
  }

  // Test panel (solo only)
  (function initTestPanel() {
    const panel = document.getElementById("testPanel");
    if (!panel) return;
    function showIfSolo() {
      if (!state._multiSlots) panel.style.display = "flex";
      else panel.style.display = "none";
    }
    const _origResetWorld = typeof resetWorld === "function" ? resetWorld : null;
    setInterval(showIfSolo, 1000);
    showIfSolo();

    const btnPop = document.getElementById("testAddPop");
    const btnLvl = document.getElementById("testAddLevel");
    const btnCD = document.getElementById("testNoCooldowns");

    if (btnPop) btnPop.addEventListener("click", () => {
      const me = state.players.get(state.myPlayerId);
      if (me) { me.popFloat = (me.popFloat || me.pop || 0) + 1000; me.pop = Math.floor(me.popFloat); }
    });
    if (btnLvl) btnLvl.addEventListener("click", () => {
      const me = state.players.get(state.myPlayerId);
      if (me) { me.level = (me.level || 0) + 100; me.xp = me.xp || 0; }
    });
    if (btnCD) btnCD.addEventListener("click", () => {
      state._testNoCooldowns = !state._testNoCooldowns;
      btnCD.textContent = state._testNoCooldowns ? "Перезарядки: ВЫКЛ" : "Без перезарядок";
      btnCD.style.borderColor = state._testNoCooldowns ? "#44ff66" : "#44aaff";
    });
  })();

  function drawAbilityZoneEffects() {
    if (!state._abilityZoneEffects || state._abilityZoneEffects.length === 0) return;
    if (!state._zoneGfx || state._zoneGfx.destroyed) {
      state._zoneGfx = new PIXI.Graphics();
      state._zoneGfx.zIndex = 9999;
      app.stage.addChild(state._zoneGfx);
    }
    const g = state._zoneGfx;
    g.clear();
    const t = performance.now() / 1000;
    const zoneColors = { rift: 0x8844ff, anchor: 0x44aaff, timeSlow: 0x66ccff, nano: 0x88ff44 };
    for (const z of state._abilityZoneEffects) {
      if (!inView(z.x, z.y)) continue;
      const elapsed = state.t - z.spawnedAt;
      const fadeAlpha = Math.min(1, Math.max(0, 1 - (elapsed / z.duration - 0.8) * 5));
      const c = zoneColors[z.type] || 0xffffff;
      const pulse = 0.3 + 0.2 * Math.sin(t * 3);
      g.circle(z.x, z.y, z.radius);
      g.stroke({ color: c, width: 2, alpha: (0.3 + pulse * 0.2) * fadeAlpha });
      g.circle(z.x, z.y, z.radius * 0.6);
      g.stroke({ color: c, width: 1, alpha: 0.15 * fadeAlpha });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t * (z.type === "anchor" ? -1 : 1);
        const d = z.radius * (0.5 + 0.3 * Math.sin(t * 2 + i));
        g.circle(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, 3);
        g.fill({ color: c, alpha: 0.3 * fadeAlpha });
      }
    }

    if (state._fakeSignatures) {
      for (const f of state._fakeSignatures) {
        if (!inView(f.x, f.y)) continue;
        const remaining = f.expiresAt - state.t;
        const alpha = Math.min(1, remaining / 2) * (0.4 + 0.2 * Math.sin(t * 3));
        g.circle(f.x, f.y, 12);
        g.fill({ color: f.color, alpha: alpha * 0.5 });
        g.circle(f.x, f.y, 20);
        g.stroke({ color: f.color, width: 1.5, alpha: alpha * 0.3 });
      }
    }
  }

  function drawAbilityTargetPreview() {
    if (!state._abilityTargeting) { clearAbilityPreview(); return; }
    if (!state._abilityPreviewGfx || state._abilityPreviewGfx.destroyed) {
      state._abilityPreviewGfx = new PIXI.Graphics();
      world.addChild(state._abilityPreviewGfx);
    }
    const g = state._abilityPreviewGfx;
    g.clear();
    const msx = state._mouseScreenX ?? lastX;
    const msy = state._mouseScreenY ?? lastY;
    const mx = (msx - cam.x) / cam.zoom;
    const my = (msy - cam.y) / cam.zoom;

    if (state._abilityTargeting === "ionNebula") {
      const t = performance.now() / 1000;
      const pulse = 0.5 + 0.3 * Math.sin(t * 2);
      g.circle(mx, my, STORM_RADIUS);
      g.fill({ color: 0x1133aa, alpha: 0.06 + 0.02 * Math.sin(t * 1.5) });
      g.circle(mx, my, STORM_RADIUS);
      g.stroke({ color: 0x44aaff, width: 2.5, alpha: 0.3 + 0.2 * pulse });
      const r2 = STORM_RADIUS * (0.7 + 0.1 * Math.sin(t * 3));
      g.circle(mx, my, r2);
      g.stroke({ color: 0x66ccff, width: 1.5, alpha: 0.15 + 0.1 * pulse });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t * 0.5;
        const px = mx + Math.cos(a) * STORM_RADIUS * 0.9;
        const py = my + Math.sin(a) * STORM_RADIUS * 0.9;
        g.circle(px, py, 3);
        g.fill({ color: 0x88ddff, alpha: 0.3 + 0.2 * Math.sin(t * 4 + i) });
      }
      for (const u of state.units.values()) {
        if (u.owner === state.myPlayerId || u.hp <= 0) continue;
        if ((u.x - mx) ** 2 + (u.y - my) ** 2 <= STORM_RADIUS * STORM_RADIUS) {
          g.circle(u.x, u.y, 7);
          g.fill({ color: 0xff2222, alpha: 0.35 });
          g.circle(u.x, u.y, 10);
          g.stroke({ color: 0xff4444, width: 1, alpha: 0.25 });
        }
      }
    }

    if (state._abilityTargeting === "meteor" && state._meteorTargeting) {
      const mt = state._meteorTargeting;
      if (mt.phase === "point") {
        g.beginFill(0xff4400, 0.12);
        g.drawCircle(mx, my, METEOR_RADIUS * 3);
        g.endFill();
        g.lineStyle(2, 0xff6600, 0.7);
        g.drawCircle(mx, my, METEOR_RADIUS);
      } else if (mt.phase === "angle") {
        const ang = mt.angle;
        const cosA = Math.cos(ang), sinA = Math.sin(ang);
        const diag = Math.hypot(CFG.WORLD_W, CFG.WORLD_H);
        const sx = mt.x - cosA * diag;
        const sy = mt.y - sinA * diag;
        const ex = mt.x + cosA * diag;
        const ey = mt.y + sinA * diag;
        const halfW = METEOR_AOE_RADIUS;
        // Corridor fill (rectangle along trajectory)
        const nx = -sinA * halfW, ny = cosA * halfW;
        g.beginFill(0xff2200, 0.12);
        g.moveTo(sx + nx, sy + ny);
        g.lineTo(ex + nx, ey + ny);
        g.lineTo(ex - nx, ey - ny);
        g.lineTo(sx - nx, sy - ny);
        g.closePath();
        g.endFill();
        // Edge lines
        g.lineStyle(1.5, 0xff4400, 0.5);
        g.moveTo(sx + nx, sy + ny); g.lineTo(ex + nx, ey + ny);
        g.moveTo(sx - nx, sy - ny); g.lineTo(ex - nx, ey - ny);
        // Center line
        g.lineStyle(1, 0xff6600, 0.3);
        g.moveTo(sx, sy); g.lineTo(ex, ey);
        // Direction arrows along trajectory
        const arrowSpacing = 100;
        const arrowSize = 12;
        for (let d = 0; d < diag * 2; d += arrowSpacing) {
          const ax = sx + cosA * d, ay = sy + sinA * d;
          if (ax < -200 || ax > CFG.WORLD_W + 200 || ay < -200 || ay > CFG.WORLD_H + 200) continue;
          const ap = 0.35 + 0.25 * Math.sin(performance.now() / 200 + d * 0.01);
          g.lineStyle(2.5, 0xff8800, ap);
          g.moveTo(ax - cosA * arrowSize + nx * 0.5, ay - sinA * arrowSize + ny * 0.5);
          g.lineTo(ax, ay);
          g.lineTo(ax - cosA * arrowSize - nx * 0.5, ay - sinA * arrowSize - ny * 0.5);
        }
        // Target point marker
        g.lineStyle(3, 0xff8800, 0.9);
        g.drawCircle(mt.x, mt.y, 8);
        // Highlight units on path
        for (const u of state.units.values()) {
          if (u.hp <= 0) continue;
          const perpDist = Math.abs((u.x - sx) * sinA - (u.y - sy) * cosA);
          if (perpDist <= halfW + 6) {
            g.beginFill(0xff2222, 0.4);
            g.drawCircle(u.x, u.y, 6);
            g.endFill();
          }
        }
        // Indicate shield hit
        for (const p of state.players.values()) {
          if (p.eliminated || (p.shieldHp || 0) <= 0) continue;
          const perpDist = Math.abs((p.x - sx) * sinA - (p.y - sy) * cosA);
          const sR = shieldRadius(p);
          if (perpDist <= sR + halfW) {
            g.lineStyle(3, 0xff0000, 0.6);
            g.drawCircle(p.x, p.y, sR + 5);
          }
        }
      }
    }

    if (state._abilityTargeting === "blackHole") {
      const R = CFG.BLACKHOLE_RADIUS || 400;
      const t = performance.now() / 1000;
      const pulse = 0.5 + 0.3 * Math.sin(t * 1.5);
      g.circle(mx, my, R);
      g.fill({ color: 0x110022, alpha: 0.08 + 0.03 * Math.sin(t) });
      g.circle(mx, my, R);
      g.stroke({ color: 0x8844cc, width: 2.5, alpha: 0.3 + 0.2 * pulse });
      g.circle(mx, my, R * 0.6);
      g.stroke({ color: 0xaa66ee, width: 1.5, alpha: 0.15 });
      g.circle(mx, my, R * 0.3);
      g.fill({ color: 0x220044, alpha: 0.12 });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + t * 0.8;
        const d = R * (0.4 + 0.5 * ((i % 3) / 3));
        const px = mx + Math.cos(a) * d, py = my + Math.sin(a) * d;
        g.circle(px, py, 2.5);
        g.fill({ color: 0xaa88ff, alpha: 0.25 + 0.15 * Math.sin(t * 3 + i) });
      }
    }
    if (state._abilityTargeting === "activeShield") {
      const t = performance.now() / 1000;
      const p = 0.5 + 0.3 * Math.sin(t * 2.5);
      for (const u of state.units.values()) {
        if (u.owner !== state.myPlayerId || u.hp <= 0) continue;
        const r = getUnitHitRadius(u) + 10;
        const shieldVal = Math.max(1, Math.round((u.maxHp || u.hp) * 0.25));
        g.circle(u.x, u.y, r);
        g.stroke({ color: 0x44ccff, width: 2, alpha: 0.4 + 0.2 * p });
        g.circle(u.x, u.y, r + 4);
        g.stroke({ color: 0x2288cc, width: 1, alpha: 0.2 });
      }
    }
    if (state._abilityTargeting === "pirateRaid" && state._meteorTargeting) {
      const mt = state._meteorTargeting;
      const t = performance.now() / 1000;
      if (mt.phase === "point") {
        const p = 0.5 + 0.3 * Math.sin(t * 2);
        g.circle(mx, my, PIRATE_RAID_ARRIVE_DIST);
        g.fill({ color: 0x553300, alpha: 0.06 });
        g.circle(mx, my, PIRATE_RAID_ARRIVE_DIST);
        g.stroke({ color: 0xaa7733, width: 2, alpha: 0.3 + 0.2 * p });
        g.circle(mx, my, 20);
        g.fill({ color: 0xffaa22, alpha: 0.3 });
        g.circle(mx, my, 20);
        g.stroke({ color: 0xffcc44, width: 2, alpha: 0.6 });
      } else if (mt.phase === "angle") {
        const ang = mt.angle;
        const cosA = Math.cos(ang), sinA = Math.sin(ang);
        const arrX = mt.x - cosA * PIRATE_RAID_ARRIVE_DIST;
        const arrY = mt.y - sinA * PIRATE_RAID_ARRIVE_DIST;
        g.circle(mt.x, mt.y, PIRATE_RAID_ARRIVE_DIST);
        g.fill({ color: 0x553300, alpha: 0.05 });
        g.circle(mt.x, mt.y, PIRATE_RAID_ARRIVE_DIST);
        g.stroke({ color: 0xaa7733, width: 2, alpha: 0.25 });
        g.moveTo(arrX, arrY);
        g.lineTo(mt.x, mt.y);
        g.stroke({ color: 0xffaa44, width: 2, alpha: 0.5 });
        for (let i = 0; i < 5; i++) {
          const frac = i / 5 + ((t * 0.5) % 0.2);
          if (frac > 1) continue;
          const ax = arrX + (mt.x - arrX) * frac;
          const ay = arrY + (mt.y - arrY) * frac;
          g.moveTo(ax - cosA * 8 - sinA * 6, ay - sinA * 8 + cosA * 6);
          g.lineTo(ax, ay);
          g.lineTo(ax - cosA * 8 + sinA * 6, ay - sinA * 8 - cosA * 6);
          g.stroke({ color: 0xffcc44, width: 2, alpha: 0.4 });
        }
        g.circle(arrX, arrY, 25);
        g.fill({ color: 0x4488ff, alpha: 0.15 + 0.1 * Math.sin(t * 3) });
        g.circle(arrX, arrY, 25);
        g.stroke({ color: 0x66aaff, width: 2, alpha: 0.4 });
        g.circle(mt.x, mt.y, 10);
        g.fill({ color: 0xffaa22, alpha: 0.4 });
      }
    }
    if (state._abilityTargeting === "loan") {
      const t = performance.now() / 1000;
      const p = 0.5 + 0.3 * Math.sin(t * 2);
      g.circle(mx, my, 30);
      g.fill({ color: 0x228833, alpha: 0.08 + 0.04 * p });
      g.circle(mx, my, 30);
      g.stroke({ color: 0x44cc66, width: 2, alpha: 0.4 + 0.2 * p });
    }
    if (state._abilityTargeting === "gloriousBattleMarch") {
      const t = performance.now() / 1000;
      const p = 0.5 + 0.3 * Math.sin(t * 2);
      for (const u of state.units.values()) {
        if (u.owner !== state.myPlayerId || u.hp <= 0) continue;
        const r = getUnitHitRadius(u);
        const rot = u.gfx ? u.gfx.rotation : 0;
        const trailLen = r * 2.5;
        g.moveTo(u.x, u.y);
        g.lineTo(u.x - Math.cos(rot) * trailLen, u.y - Math.sin(rot) * trailLen);
        g.stroke({ color: 0xffaa00, width: 3, alpha: 0.2 + 0.15 * p });
        g.circle(u.x, u.y, r + 5);
        g.stroke({ color: 0xffcc44, width: 1.5, alpha: 0.35 + 0.15 * p });
      }
    }
    if (state._abilityTargeting === "raiderCapture") {
      const t = performance.now() / 1000;
      for (const p of state.players.values()) {
        if (p.eliminated || p.id === state.myPlayerId) continue;
        const pR = getPlanetRadius(p) + 40;
        if ((p.x - mx) ** 2 + (p.y - my) ** 2 <= pR * pR) {
          const pr = getPlanetRadius(p);
          const pulse = 0.4 + 0.3 * Math.sin(t * 3);
          g.circle(p.x, p.y, pr + 12);
          g.stroke({ color: 0xff4422, width: 3, alpha: pulse });
          g.circle(p.x, p.y, pr + 20);
          g.stroke({ color: 0xff6644, width: 1.5, alpha: pulse * 0.5 });
          const stolen = Math.round((p.population || 0) * 0.1);
          if (stolen > 0) {
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * Math.PI * 2 + t * 2;
              const d = pr + 16 + 8 * Math.sin(t * 4 + i);
              g.circle(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 3);
              g.fill({ color: 0xff8844, alpha: 0.4 });
            }
          }
        }
      }
    }
    const genericPointAbilities = {
      spatialRift:     { radius: 180, color: 0x8844ff, label: "Разлом" },
      gravAnchor:      { radius: 150, color: 0x44aaff, label: "Грав. Якорь" },
      fakeSignature:   { radius: 80,  color: 0xaacc44, label: "Сигнатуры" },
      timeSingularity: { radius: 200, color: 0x66ccff, label: "Сингулярность" },
      nanoSwarm:       { radius: 160, color: 0x88ff44, label: "Нанорой" },
      gravWave:        { radius: 250, color: 0xff8844, label: "Грав. Волна" },
      resourceRaid:    { radius: 100, color: 0xffcc00, label: "Набег" },
      thermoNuke:      { radius: 250, color: 0xff2200, label: "Термоядерный" },
      orbitalStrike:   { radius: 120, color: 0xff6600, label: "Орб. Удар" },
      hyperJump:       { radius: 60,  color: 0x44ffaa, label: "Гиперскачок" }
    };
    const gpa = genericPointAbilities[state._abilityTargeting];
    if (gpa) {
      const t = performance.now() / 1000;
      const pulse = 0.5 + 0.3 * Math.sin(t * 2.5);
      g.circle(mx, my, gpa.radius);
      g.stroke({ color: gpa.color, width: 2, alpha: 0.3 + 0.2 * pulse });
      g.circle(mx, my, gpa.radius * 0.7);
      g.stroke({ color: gpa.color, width: 1, alpha: 0.15 + 0.1 * pulse });
    }
  }

  function clearAbilityPreview() {
    if (state._abilityPreviewGfx && !state._abilityPreviewGfx.destroyed) {
      state._abilityPreviewGfx.clear();
    }
  }

  app.canvas.addEventListener("mousedown", (e) => {
    if (!state._abilityTargeting) return;
    if (e.button === 0) {
      e.stopPropagation();
      e.preventDefault();
      const wx = (e.clientX - cam.x) / cam.zoom;
      const wy = (e.clientY - cam.y) / cam.zoom;
      if (state._abilityTargeting === "ionNebula") {
        useIonNebula(wx, wy);
      } else if (state._abilityTargeting === "blackHole") {
        const me = state.players.get(state.myPlayerId);
        if (state._multiSlots && !state._multiIsHost && state._socket) {
          state._socket.emit("playerAction", { type: "useAbility", abilityId: "blackHole", pid: state.myPlayerId, x: wx, y: wy });
          if (me) {
            if (!state._abilityCooldownsByPlayer[me.id]) state._abilityCooldownsByPlayer[me.id] = {};
            state._abilityCooldownsByPlayer[me.id]["blackHole"] = state.t + CFG.BLACKHOLE_COOLDOWN;
          }
        } else {
          spawnBlackHole(wx, wy, state.myPlayerId);
          if (me) {
            if (!state._abilityCooldownsByPlayer[me.id]) state._abilityCooldownsByPlayer[me.id] = {};
            state._abilityCooldownsByPlayer[me.id]["blackHole"] = state.t + CFG.BLACKHOLE_COOLDOWN;
          }
          pushAbilityAnnouncement(state.myPlayerId, "blackHole");
        }
        cancelAbilityTargeting();
      } else if (state._abilityTargeting === "activeShield") {
        const def = ABILITY_DEFS.find(d => d.id === "activeShield");
        if (state._multiSlots && !state._multiIsHost && state._socket) {
          state._socket.emit("playerAction", { type: "useAbility", abilityId: "activeShield", pid: state.myPlayerId });
        } else {
          useActiveShield(state.myPlayerId);
          if (def) setAbilityCooldown(state.myPlayerId, "activeShield", def.cooldown);
          pushAbilityAnnouncement(state.myPlayerId, "activeShield");
        }
        cancelAbilityTargeting();
      } else if (state._abilityTargeting === "loan") {
        const def = ABILITY_DEFS.find(d => d.id === "loan");
        if (state._multiSlots && !state._multiIsHost && state._socket) {
          state._socket.emit("playerAction", { type: "useAbility", abilityId: "loan", pid: state.myPlayerId });
        } else {
          useLoan(state.myPlayerId);
          if (def) setAbilityCooldown(state.myPlayerId, "loan", def.cooldown);
          pushAbilityAnnouncement(state.myPlayerId, "loan");
        }
        cancelAbilityTargeting();
      } else if (state._abilityTargeting === "gloriousBattleMarch") {
        const def = ABILITY_DEFS.find(d => d.id === "gloriousBattleMarch");
        if (state._multiSlots && !state._multiIsHost && state._socket) {
          state._socket.emit("playerAction", { type: "useAbility", abilityId: "gloriousBattleMarch", pid: state.myPlayerId });
        } else {
          useGloriousBattleMarch(state.myPlayerId);
          if (def) setAbilityCooldown(state.myPlayerId, "gloriousBattleMarch", def.cooldown);
          pushAbilityAnnouncement(state.myPlayerId, "gloriousBattleMarch");
        }
        cancelAbilityTargeting();
      } else if (state._abilityTargeting === "raiderCapture") {
        let targetCityId = null;
        for (const p of state.players.values()) {
          if (p.eliminated || p.id === state.myPlayerId) continue;
          const d2 = (wx - p.x) ** 2 + (wy - p.y) ** 2;
          if (d2 <= (getPlanetRadius(p) + 40) ** 2) { targetCityId = p.id; break; }
        }
        if (targetCityId != null) {
          const def = ABILITY_DEFS.find(d => d.id === "raiderCapture");
          if (state._multiSlots && !state._multiIsHost && state._socket) {
            state._socket.emit("playerAction", { type: "useAbility", abilityId: "raiderCapture", pid: state.myPlayerId, targetCityId });
          } else {
            useRaiderCapture(state.myPlayerId, targetCityId);
            if (def) setAbilityCooldown(state.myPlayerId, "raiderCapture", def.cooldown);
            pushAbilityAnnouncement(state.myPlayerId, "raiderCapture");
          }
          cancelAbilityTargeting();
        }
      } else if (state._abilityTargeting === "pirateRaid") {
        const mt = state._meteorTargeting;
        if (mt && mt.phase === "point") {
          mt.x = wx; mt.y = wy; mt.phase = "angle";
        } else if (mt && mt.phase === "angle") {
          const def = ABILITY_DEFS.find(d => d.id === "pirateRaid");
          if (state._multiSlots && !state._multiIsHost && state._socket) {
            state._socket.emit("playerAction", { type: "useAbility", abilityId: "pirateRaid", pid: state.myPlayerId, x: mt.x, y: mt.y, angle: mt.angle });
          } else {
            spawnPirateRaid(mt.x, mt.y, mt.angle);
            if (def) setAbilityCooldown(state.myPlayerId, "pirateRaid", def.cooldown);
            pushAbilityAnnouncement(state.myPlayerId, "pirateRaid");
          }
          cancelAbilityTargeting();
        }
      } else if (state._abilityTargeting === "meteor") {
        const mt = state._meteorTargeting;
        if (mt.phase === "point") {
          mt.x = wx; mt.y = wy;
          mt.phase = "angle";
        } else if (mt.phase === "angle") {
          useMeteor(mt.x, mt.y, mt.angle);
        }
      } else {
        const pointAbilities = ["spatialRift", "gravAnchor", "fakeSignature", "timeSingularity", "nanoSwarm", "gravWave", "resourceRaid", "thermoNuke", "orbitalStrike", "hyperJump"];
        if (pointAbilities.includes(state._abilityTargeting)) {
          if (state._abilityTargeting === "orbitalStrike") {
            if (!state._meteorTargeting || state._meteorTargeting.phase === "point") {
              state._meteorTargeting = { phase: "angle", x: wx, y: wy, angle: 0 };
            } else if (state._meteorTargeting.phase === "angle") {
              const ang = state._meteorTargeting.angle || 0;
              state._activeMeteors = state._activeMeteors || [];
              for (let i = 0; i < 5; i++) {
                const offAng = ang + (i - 2) * 0.15;
                const sx = wx - Math.cos(offAng) * 800;
                const sy = wy - Math.sin(offAng) * 800;
                state._activeMeteors.push({
                  type: "orbital", x: sx, y: sy,
                  vx: Math.cos(offAng) * 500, vy: Math.sin(offAng) * 500,
                  ownerId: state.myPlayerId, spawnedAt: state.t
                });
              }
              const def = ABILITY_DEFS.find(d => d.id === "orbitalStrike");
              if (def) setAbilityCooldown(state.myPlayerId, "orbitalStrike", def.cooldown);
              pushAbilityAnnouncement(state.myPlayerId, "orbitalStrike");
              cancelAbilityTargeting();
            }
          } else {
            useAbilityAtPoint(state._abilityTargeting, wx, wy, state.myPlayerId);
          }
        }
      }
    }
  }, true);

  app.canvas.addEventListener("mousemove", (e) => {
    if (state._meteorTargeting && state._meteorTargeting.phase === "angle") {
      const wx = (e.clientX - cam.x) / cam.zoom;
      const wy = (e.clientY - cam.y) / cam.zoom;
      state._meteorTargeting.angle = Math.atan2(wy - state._meteorTargeting.y, wx - state._meteorTargeting.x);
    }
  });

  app.canvas.addEventListener("mousemove", (e) => {
    if (state._abilityTargeting === "orbitalStrike" && state._meteorTargeting && state._meteorTargeting.phase === "angle") {
      const wx = (e.clientX - cam.x) / cam.zoom;
      const wy = (e.clientY - cam.y) / cam.zoom;
      state._meteorTargeting.angle = Math.atan2(wy - state._meteorTargeting.y, wx - state._meteorTargeting.x);
    }
  });

  app.canvas.addEventListener("contextmenu", (e) => {
    if (state._abilityTargeting) {
      e.preventDefault();
      cancelAbilityTargeting();
    }
  });

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
      if (state._survivalMode) {
        const elapsed = (state._survivalStartTime != null ? state.t - state._survivalStartTime : state.t) || 0;
        const mm = Math.floor(elapsed / 60);
        const ss = Math.floor(elapsed % 60);
        triggerDefeat("Выживание: вы продержались " + mm + " мин " + ss + " сек. Волна " + (state._survivalWave ?? 0) + ".");
      } else {
        triggerDefeat("Ваш город уничтожен!");
      }
      return;
    }
    if (!me) return;

    if (state._survivalMode) return;

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

  function updateSurvivalHud() {
    const el = document.getElementById("survivalHud");
    if (!el) return;
    if (!state._survivalMode || state._gameOver) { el.style.display = "none"; return; }
    const elapsed = (state._survivalStartTime != null ? state.t - state._survivalStartTime : state.t) || 0;
    const mm = Math.floor(elapsed / 60);
    const ss = Math.floor(elapsed % 60);
    el.style.display = "block";
    el.textContent = "Волна " + (state._survivalWave ?? 0) + "  |  Время " + mm + ":" + String(ss).padStart(2, "0");
  }

  function updateDominationTimerUI() {
    const el = document.getElementById("dominationTimer");
    if (!el || state._gameOver) { if (el) el.style.display = "none"; return; }
    if (state._survivalMode) { el.style.display = "none"; return; }
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

  const SOLO_PALETTE = [0xff8800, 0xcc2222, 0xddcc00, 0x4488ff, 0x22aa44, 0xaa44cc, 0x44cccc];
  state._soloColorIndex = 0;

  function showScreen(visibleId) {
    const ids = ["mainMenu", "nicknameScreen", "soloLobbyScreen", "multiConnectScreen", "lobbyScreen"];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.style.display = id === visibleId ? "flex" : "none";
    }
    if (gameWrapEl) gameWrapEl.style.display = visibleId === "gameWrap" ? "block" : "none";
    if (visibleId === "soloLobbyScreen" && typeof window !== "undefined") {
      state._myNickname = state._myNickname || window._myNickname || "";
    }
    if (visibleId === "nicknameScreen" && state._menuMode === "single") {
      const row = document.getElementById("soloColorRow");
      const picker = document.getElementById("soloColorPicker");
      if (row) row.style.display = "block";
      if (picker) {
        picker.innerHTML = "";
        SOLO_PALETTE.forEach((hex, i) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "color-swatch";
          btn.style.cssText = "width:32px;height:32px;border-radius:50%;border:2px solid " + (i === (state._soloColorIndex ?? 0) ? "#fff" : "rgba(255,255,255,0.3)") + ";cursor:pointer";
          btn.style.background = "#" + hex.toString(16).padStart(6, "0");
          btn.addEventListener("click", () => {
            state._soloColorIndex = i;
            picker.querySelectorAll("button").forEach((b, j) => { b.style.borderColor = j === i ? "#fff" : "rgba(255,255,255,0.3)"; });
          });
          picker.appendChild(btn);
        });
      }
      const botRow = document.getElementById("soloBotCountRow");
      const botPicker = document.getElementById("soloBotCountPicker");
      if (botRow) botRow.style.display = "block";
      if (botPicker) {
        botPicker.innerHTML = "";
        const current = Math.max(1, Math.min(4, state._soloBotCount ?? 2));
        for (let n = 1; n <= 4; n++) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "menu-btn " + (n === current ? "primary" : "secondary");
          btn.style.minWidth = "44px";
          btn.textContent = String(n);
          btn.addEventListener("click", () => {
            state._soloBotCount = n;
            botPicker.querySelectorAll("button").forEach((b, j) => {
              const v = j + 1;
              b.className = "menu-btn " + (v === n ? "primary" : "secondary");
              b.style.minWidth = "44px";
            });
          });
          botPicker.appendChild(btn);
        }
      }
    } else {
      const row = document.getElementById("soloColorRow");
      if (row) row.style.display = "none";
      const botRow = document.getElementById("soloBotCountRow");
      if (botRow) botRow.style.display = "none";
    }
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
    const seedForMap = state._customMapSeed != null ? state._customMapSeed : undefined;
    rebuildMap(seedForMap);
    rebuildGrid();
    resetWorld();
    for (const p of state.players.values()) {
      redrawZone(p);
      rebuildTurrets(p);
    }
    const me = state.players.get(state.myPlayerId);
    if (me) {
      cam.zoom = CFG.CAMERA_START_ZOOM;
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
    for (let i = 0; i < slots.length; i++) {
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
      cam.zoom = CFG.CAMERA_START_ZOOM;
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
        if (k === "_patrols" && isRemote && Array.isArray(p._patrols)) {
          pl._patrols = pl._patrols || [];
          for (let i = 0; i < p._patrols.length; i++) {
            const src = p._patrols[i];
            let dst = pl._patrols[i];
            if (!dst) { dst = { t: 0 }; pl._patrols.push(dst); }
            dst._interpFromT = dst._interpDisplayT ?? dst.t ?? 0;
            dst._interpToT = (src && typeof src.t === "number") ? src.t : dst.t;
            dst._interpStart = performance.now();
            dst.t = dst._interpToT;
            if (src && src.atkCd != null) dst.atkCd = src.atkCd;
          }
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
      if (pl.zoneLightGfx) { zoneEffectsLayer.removeChild(pl.zoneLightGfx); pl.zoneLightGfx = null; }
      makeCityVisual(pl);
      makeZoneVisual(pl);
    }

    for (const id of [...state.players.keys()]) {
      if (!wantPlayerIds.has(id)) {
        const pl = state.players.get(id);
        if (pl && pl.cityGfx) { cityLayer.removeChild(pl.cityGfx); pl.cityGfx = null; }
        if (pl && pl.zoneGfx) { zonesLayer.removeChild(pl.zoneGfx); zonesLayer.removeChild(pl.zoneGlow); pl.zoneGfx = null; pl.zoneGlow = null; }
        if (pl && pl.zoneLightGfx) { zoneEffectsLayer.removeChild(pl.zoneLightGfx); pl.zoneLightGfx = null; }
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

    if (snap.shieldHitEffects) {
      if (!state._shieldHitEffects) state._shieldHitEffects = [];
      for (const e of snap.shieldHitEffects) {
        const exists = state._shieldHitEffects.some(ex =>
          Math.abs(ex.t0 - e.t0) < 0.05 && Math.abs(ex.hitX - e.hitX) < 2 && Math.abs(ex.hitY - e.hitY) < 2);
        if (!exists) state._shieldHitEffects.push({ ...e });
      }
    }
    if (snap.abilityAnnouncements) {
      if (!state._abilityAnnouncements) state._abilityAnnouncements = [];
      for (const a of snap.abilityAnnouncements) {
        const dup = state._abilityAnnouncements.some(ex => ex.text === a.text && (ex.t0 || 0) > state.t - 3);
        if (!dup) state._abilityAnnouncements.push({ text: a.text, ttl: a.ttlRemaining ?? 4, t0: state.t });
      }
      while (state._abilityAnnouncements.length > 8) state._abilityAnnouncements.shift();
    }

    // ── Resources: full sync = spawn/despawn; zone sync = position update ──
    if (snap.resDelta && !snap.resources) {
      for (const entry of snap.resDelta) {
        const [id, x, y, targetCity] = entry;
        const res = state.res.get(id);
        if (res) {
          NET.Interp.setResTarget(res, x, y);
          if (targetCity !== undefined) res._targetCity = targetCity;
        }
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
          if (r.value != null) res.value = r.value;
          if (r._targetCity !== undefined) res._targetCity = r._targetCity;
          if (r._interceptProtectUntil !== undefined) res._interceptProtectUntil = r._interceptProtectUntil;
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

    // Sync meteors from host
    if (snap.meteors) {
      // Clean up old graphics
      for (const m of state._activeMeteors) removeMeteorGfx(m);
      state._activeMeteors = snap.meteors.map(m => ({
        ...m, gfx: null, trajGfx: null
      }));
    } else if (snap._fullSync) {
      for (const m of state._activeMeteors) removeMeteorGfx(m);
      state._activeMeteors = [];
    }

    // Sync ability storms from host (visual only on remote)
    if (snap.abilityStorms && !state._multiIsHost) {
      // Just update count for visual rendering — remote clients don't sim damage
      while (state._abilityStorms.length > snap.abilityStorms.length) {
        const s = state._abilityStorms.pop();
        if (s.gfx) { s.gfx.parent?.removeChild(s.gfx); s.gfx.destroy(true); }
        if (s.emojiContainer) { s.emojiContainer.parent?.removeChild(s.emojiContainer); s.emojiContainer.destroy({ children: true }); }
      }
    }

    if (snap.abilityCooldownsByPlayer) {
      state._abilityCooldownsByPlayer = {};
      for (const pid of Object.keys(snap.abilityCooldownsByPlayer)) {
        state._abilityCooldownsByPlayer[pid] = { ...snap.abilityCooldownsByPlayer[pid] };
      }
    }
    if (snap.abilityUsedByPlayer) {
      state._abilityUsedByPlayer = {};
      for (const pid of Object.keys(snap.abilityUsedByPlayer)) {
        state._abilityUsedByPlayer[pid] = (snap.abilityUsedByPlayer[pid] || []).slice();
      }
    }

    if (snap.mines) {
      const wantMineIds = new Set(snap.mines.map(m => m.id));
      for (const m of snap.mines) {
        let mine = state.mines.get(m.id);
        if (!mine) {
          mine = { ...m, gfx: null, yieldAcc: 0 };
          state.mines.set(mine.id, mine);
          makeMineVisual(mine);
        } else {
          const changed = mine.ownerId !== m.ownerId || mine.captureProgress !== m.captureProgress;
          mine.ownerId = m.ownerId;
          mine.captureProgress = m.captureProgress;
          mine.capturingUnitId = m.capturingUnitId;
          if (changed) updateMineVisual(mine);
        }
      }
      for (const id of [...state.mines.keys()]) {
        if (!wantMineIds.has(id)) {
          const mine = state.mines.get(id);
          if (mine && mine.gfx) resLayer.removeChild(mine.gfx);
          state.mines.delete(id);
        }
      }
    }

    if (snap.blackHoles && !state._multiIsHost) {
      state._blackHoles = snap.blackHoles.map(bh => ({
        ...bh, _bodyContainer: null, _debrisGfx: null, phase: 0
      }));
    }
    if (snap.pirateBase) {
      if (!state.pirateBase) state.pirateBase = { x: 0, y: 0, hp: 4000, maxHp: 4000, gfx: null, _emojiGfx: null, spawnCd: 0, unitLimit: 12 };
      state.pirateBase.x = snap.pirateBase.x;
      state.pirateBase.y = snap.pirateBase.y;
      state.pirateBase.hp = snap.pirateBase.hp;
      state.pirateBase.maxHp = snap.pirateBase.maxHp;
      if (snap.pirateBase.orbitCenter) state.pirateBase.orbitCenter = snap.pirateBase.orbitCenter;
      if (snap.pirateBase.orbitRadius) state.pirateBase.orbitRadius = snap.pirateBase.orbitRadius;
    } else if (snap.hasOwnProperty("pirateBase")) {
      if (state.pirateBase && state.pirateBase._emojiGfx) {
        state.pirateBase._emojiGfx.destroy();
      }
      state.pirateBase = null;
    }
    if (snap.battleMarchUntil) state._battleMarchUntil = { ...snap.battleMarchUntil };
    if (snap.hyperFlashes) state._hyperFlashes = snap.hyperFlashes;
    if (snap.nextEngagementZoneId != null) state.nextEngagementZoneId = snap.nextEngagementZoneId;

    // ── Squads sync ──
    if (snap.squads && typeof SQUADLOGIC !== "undefined") {
      if (!state.squads) state.squads = new Map();
      const wantSquadIds = new Set(snap.squads.map(s => s.id));
      for (const sq of snap.squads) {
        let existing = state.squads.get(sq.id);
        if (!existing) {
          existing = {
            id: sq.id, leaderUnitId: sq.leaderUnitId,
            unitIds: sq.unitIds || [],
            ownerId: sq.ownerId,
            formation: { type: "line", rows: 3, facing: 0, dirty: false, dirtyAt: 0 },
            combat: { mode: "idle", zoneId: null, _disengageTimer: null, queuedOrder: null, resumeOrder: null },
            anchor: { x: 0, y: 0 },
            order: { type: "idle", waypoints: [], holdPoint: null }
          };
          state.squads.set(sq.id, existing);
        }
        existing.leaderUnitId = sq.leaderUnitId;
        existing.unitIds = sq.unitIds || [];
        existing.ownerId = sq.ownerId;
        if (sq.formation) {
          existing.formation.type = sq.formation.type || "line";
          existing.formation.rows = sq.formation.rows || 3;
          existing.formation.facing = sq.formation.facing || 0;
          if (sq.formation.targetFacing != null) existing.formation.targetFacing = sq.formation.targetFacing;
          if (sq.formation.pigWidth != null) existing.formation.pigWidth = sq.formation.pigWidth;
        }
        if (sq.combat) {
          existing.combat.mode = sq.combat.mode || "idle";
          existing.combat.zoneId = sq.combat.zoneId;
        }
        if (sq.anchor) {
          existing.anchor.x = sq.anchor.x;
          existing.anchor.y = sq.anchor.y;
        }
        if (sq.order) {
          existing.order.type = sq.order.type || "idle";
          existing.order.waypoints = sq.order.waypoints || [];
          existing.order.holdPoint = sq.order.holdPoint || null;
          existing.order.targetUnitId = sq.order.targetUnitId;
          existing.order.targetCityId = sq.order.targetCityId;
          existing.order.mineId = sq.order.mineId;
        }
        for (const uid of existing.unitIds) {
          const u = state.units.get(uid);
          if (u) {
            u.squadId = sq.id;
            u.leaderId = uid === sq.leaderUnitId ? null : sq.leaderUnitId;
          }
        }
      }
      for (const id of [...state.squads.keys()]) {
        if (!wantSquadIds.has(id)) state.squads.delete(id);
      }
      if (state.nextSquadId == null || state.nextSquadId <= Math.max(...wantSquadIds, 0)) {
        state.nextSquadId = Math.max(...wantSquadIds, 0) + 1;
      }
    }

    // ── Engagement zones sync ──
    if (snap.engagementZones) {
      if (!state.engagementZones) state.engagementZones = new Map();
      const wantZoneIds = new Set(snap.engagementZones.map(z => z.id));
      for (const z of snap.engagementZones) {
        let existing = state.engagementZones.get(z.id);
        if (!existing) {
          existing = { id: z.id, squadIds: [], anchorX: null, anchorY: null, radius: 0, displayRadius: 0, createdAt: state.t };
          state.engagementZones.set(z.id, existing);
        }
        existing.squadIds = z.squadIds || [];
        existing.anchorX = z.anchorX;
        existing.anchorY = z.anchorY;
        existing.radius = z.radius;
        existing.displayRadius = z.displayRadius;
        existing.createdAt = z.createdAt;
        existing.owners = z.owners || [];
        existing.balanceSegments = z.balanceSegments || [];
      }
      for (const id of [...state.engagementZones.keys()]) {
        if (!wantZoneIds.has(id)) state.engagementZones.delete(id);
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
      if (state._menuMode === "single") { showScreen("soloLobbyScreen"); return; }
      showScreen("multiConnectScreen");
    });
    if (multiConnectBack) multiConnectBack.addEventListener("click", () => showScreen("nicknameScreen"));

    const soloLobbyBack = document.getElementById("soloLobbyBack");
    const soloLobbyStart = document.getElementById("soloLobbyStart");
    const soloSpawnPicker = document.getElementById("soloSpawnPicker");
    if (soloLobbyBack) soloLobbyBack.addEventListener("click", () => showScreen("nicknameScreen"));
    if (soloLobbyStart) soloLobbyStart.addEventListener("click", () => {
      const nick = state._myNickname || (typeof window !== "undefined" && window._myNickname) || "Игрок";
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
        const newSeed = (Date.now() >>> 0) ^ (Math.random() * 0xFFFFFFFF >>> 0);
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
    const spawnBySlot = new Map();
    const spawnTaken = new Map();
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i] || {};
      if (!s.id && !s.isBot) continue;
      const sp = s.spawnIndex != null ? s.spawnIndex : i;
      spawnBySlot.set(i, sp);
      spawnTaken.set(sp, i);
    }

    slotsEl.innerHTML = "";
    const editSlot = state._colorEditSlot != null ? state._colorEditSlot : state._mySlot;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i] || {};
      const occupied = !!(s.id || s.isBot);
      const div = document.createElement("div");
      div.className = "lobby-slot" + (occupied ? "" : " empty");
      const colorHex = "#" + (LOBBY_COLORS[s.colorIndex || 0] || 0x888888).toString(16).padStart(6, "0");

      const colorSpan = document.createElement("span");
      colorSpan.className = "slot-color";
      colorSpan.style.background = colorHex;
      if (state._isHost && occupied) {
        colorSpan.style.cursor = "pointer";
        colorSpan.title = "Выбрать цвет для этого слота";
        if (i === editSlot) {
          colorSpan.style.boxShadow = "0 0 0 3px #fff";
        }
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
        const canChange = state._isHost || (i === state._mySlot);
        sel.disabled = !canChange;
        const slotIdx = i;
        sel.addEventListener("change", () => {
          const newSp = parseInt(sel.value);
          if (state._isHost && slotIdx !== state._mySlot) {
            socket.emit("setSlotSpawn", slotIdx, newSp);
          } else {
            socket.emit("setSpawn", newSp);
          }
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
      const wCx = W * 0.5, wCy = H * 0.5;
      const wR = Math.min(W, H) * 0.38;
      const spawns = [];
      for (let i = 0; i < SPAWN_COUNT; i++) {
        const angle = (i / SPAWN_COUNT) * Math.PI * 2 - Math.PI / 2;
        spawns.push({ x: wCx + Math.cos(angle) * wR, y: wCy + Math.sin(angle) * wR });
      }
      const cw = spawnMapEl.width, ch = spawnMapEl.height;
      const ctx = spawnMapEl.getContext("2d");
      ctx.fillStyle = "#0a0c1a";
      ctx.fillRect(0, 0, cw, ch);

      const pad = 30;
      const scaleX = (cw - pad * 2) / W, scaleY = (ch - pad * 2) / H;
      const scale = Math.min(scaleX, scaleY);
      const offX = (cw - W * scale) / 2, offY = (ch - H * scale) / 2;

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
      spawnMapEl.onclick = null;
    }

    const pickerEl = document.getElementById("colorPicker");
    if (pickerEl) {
      pickerEl.innerHTML = "";
      const targetSlot = editSlot != null ? editSlot : state._mySlot;
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
              socket.emit("setSlotColor", targetSlot, colorIdx);
            } else {
              socket.emit("setColor", colorIdx);
            }
          });
        }
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
        const res = purchaseUnit(action.pid, action.unitType || "fighter", action.waypoints);
        console.log("[MP-ACTION] spawn result:", JSON.stringify(res));
      } else if (action.type === "purchase") {
        const res = purchaseUnit(action.pid, action.unitType || "fighter", action.waypoints);
        console.log("[MP-ACTION] purchase result:", JSON.stringify(res));
      } else if (action.type === "chase") {
        if (typeof SQUADLOGIC !== "undefined") {
          for (const lid of (action.leaderIds || [])) {
            const u = state.units.get(lid);
            if (!u || u.squadId == null) continue;
            SQUADLOGIC.issueAttackUnitOrder(state, u.squadId, action.targetUnitId);
          }
          return;
        }
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
        if (typeof SQUADLOGIC !== "undefined") {
          for (const lid of (action.leaderIds || [])) {
            const u = state.units.get(lid);
            if (!u || u.squadId == null) continue;
            SQUADLOGIC.issueSiegeOrder(state, u.squadId, action.targetCityId, [{ x: action.x, y: action.y }]);
          }
          return;
        }
        const city = state.players.get(action.targetCityId);
        const minStopR = city ? shieldRadius(city) + 6 : 26;
        for (const lid of (action.leaderIds || [])) {
          const u = state.units.get(lid);
          if (!u) continue;
          u.chaseTargetCityId = action.targetCityId;
          u.chaseTargetUnitId = undefined;
          const stopR = Math.max(getUnitAtkRange(u), minStopR);
          const cx = city ? city.x : action.x, cy = city ? city.y : action.y;
          const dx = u.x - cx, dy = u.y - cy;
          const dl = Math.hypot(dx, dy) || 1;
          u.waypoints = [{ x: cx + (dx / dl) * stopR, y: cy + (dy / dl) * stopR }];
          u.waypointIndex = 0;
          u.straightMode = false;
        }
      } else if (action.type === "move") {
        if (typeof SQUADLOGIC !== "undefined") {
          const wp = Array.isArray(action.waypoints) && action.waypoints.length > 0
            ? action.waypoints.map(w => ({ x: w.x, y: w.y }))
            : [{ x: action.x, y: action.y }];
          for (const lid of (action.leaderIds || [])) {
            const u = state.units.get(lid);
            if (!u || u.squadId == null) continue;
            if (action.capture) SQUADLOGIC.issueCaptureOrder(state, u.squadId, action.mineId, wp[0]);
            else SQUADLOGIC.issueMoveOrder(state, u.squadId, wp, action.angle);
          }
          return;
        }
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
      } else if (action.type === "formation") {
        if (typeof SQUADLOGIC !== "undefined") {
          const squad = (action.unitIds || []).map(id => state.units.get(id)).filter(Boolean);
          if (squad.length > 0) {
            const squadState = getSquadStateFromUnits(squad);
            if (squadState) {
              SQUADLOGIC.setSquadFormation(state, squadState.id, action.formationType || "line", action.formationRows || 3, action.formationPigWidth || 1);
              SQUADLOGIC.recalculateFormation(state, squadState.id, { getFormationOffsets }, true);
            }
          }
          return;
        }
        const squad = (action.unitIds || []).map(id => state.units.get(id)).filter(Boolean);
        if (squad.length > 0) {
          const leader = squad.find(u => !u.leaderId) || squad[0];
          const wp = leader.waypoints;
          const idx = leader.waypointIndex ?? 0;
          const dirX = wp && idx < wp.length && wp[idx] ? wp[idx].x - leader.x : null;
          const dirY = wp && idx < wp.length && wp[idx] ? wp[idx].y - leader.y : null;
          applyFormationToSquad(squad, action.formationType || "pig", action.formationRows || 1, dirX, dirY, action.formationPigWidth || 1);
        }
      } else if (action.type === "mergeSquad") {
        if (typeof SQUADLOGIC !== "undefined") {
          const squadIds = Array.isArray(action.squadIds) ? action.squadIds : [];
          const merged = squadIds.length >= 2
            ? SQUADLOGIC.mergeSquads(state, squadIds, action.formationType || "line", action.formationRows || 3, action.formationPigWidth || 1)
            : null;
          if (merged) {
            const waypoints = Array.isArray(action.waypoints) && action.waypoints.length > 0
              ? action.waypoints.map(w => ({ x: w.x, y: w.y }))
              : [];
            SQUADLOGIC.issueMoveOrder(state, merged.id, waypoints, null);
            SQUADLOGIC.recalculateFormation(state, merged.id, { getFormationOffsets }, true);
          }
          return;
        }
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
          const offsets = getFormationOffsets(units.length, formationType, formationRows, vx, vy, pigW, units);
          const leaderId = leader.id;
          leader.leaderId = null;
          leader.formationType = formationType;
          leader.formationRows = formationRows;
          leader._formationAngle = Math.atan2(vy, vx);
          leader._lastFacingAngle = Math.atan2(vy, vx);
          if (formationType === "pig") leader.formationPigWidth = pigW;
          leader.waypoints = waypoints;
          leader.waypointIndex = 0;
          leader.straightMode = false;
          for (let i = 0; i < units.length; i++) {
            const u = units[i];
            u.leaderId = i === 0 ? null : leaderId;
            u.formationOffsetX = offsets[i]?.x ?? 0;
            u.formationOffsetY = offsets[i]?.y ?? 0;
            u.waypoints = waypoints.map(w => ({ x: w.x, y: w.y }));
            u.waypointIndex = 0;
            u.straightMode = false;
          }
        }
      } else if (action.type === "splitSquad") {
        if (typeof SQUADLOGIC !== "undefined") {
          const allUnits = (action.unitIds || []).map(id => state.units.get(id)).filter(Boolean);
          if (allUnits.length >= 2) {
            const squadState = getSquadStateFromUnits(allUnits);
            if (squadState) {
              const n = allUnits.length;
              const k = Math.floor(n / 2);
              const firstIds = allUnits.slice(0, k).map(u => u.id);
              const secondIds = allUnits.slice(k).map(u => u.id);
              const order = SQUADLOGIC.cloneOrder(squadState.order);
              const formation = { ...squadState.formation };
              SQUADLOGIC.destroySquad(state, squadState.id);
              const firstSquad = SQUADLOGIC.createSquad(state, firstIds, {
                formationType: formation.type,
                formationRows: formation.rows,
                formationWidth: formation.width,
                order
              });
              const secondSquad = SQUADLOGIC.createSquad(state, secondIds, {
                formationType: formation.type,
                formationRows: formation.rows,
                formationWidth: formation.width,
                order
              });
              if (firstSquad) SQUADLOGIC.recalculateFormation(state, firstSquad.id, { getFormationOffsets }, true);
              if (secondSquad) SQUADLOGIC.recalculateFormation(state, secondSquad.id, { getFormationOffsets }, true);
            }
          }
          return;
        }
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
      } else if (action.type === "splitSquadByType") {
        if (typeof SQUADLOGIC !== "undefined") {
          const squad = state.squads.get(action.squadId);
          if (squad) {
            const out = SQUADLOGIC.splitSquadByType(state, squad.id);
            for (const nextSquad of out) SQUADLOGIC.recalculateFormation(state, nextSquad.id, { getFormationOffsets }, true);
          }
          return;
        }
      } else if (action.type === "useAbility") {
        const def = ABILITY_DEFS.find(d => d.id === action.abilityId);
        if (def && action.pid != null && !def.oneTime) setAbilityCooldown(action.pid, action.abilityId, def.cooldown);
        pushAbilityAnnouncement(action.pid, action.abilityId);
        if (action.abilityId === "ionNebula") {
          _spawnIonNebulaLocal(action.x, action.y);
        } else if (action.abilityId === "meteor") {
          _spawnMeteorLocal(action.x, action.y, action.angle, action.pid);
        } else if (action.abilityId === "blackHole") {
          spawnBlackHole(action.x, action.y, action.pid);
          const me = state.players.get(action.pid);
          if (me && def) {
            if (!state._abilityCooldownsByPlayer[me.id]) state._abilityCooldownsByPlayer[me.id] = {};
            state._abilityCooldownsByPlayer[me.id]["blackHole"] = state.t + CFG.BLACKHOLE_COOLDOWN;
          }
        } else if (action.abilityId === "activeShield") {
          useActiveShield(action.pid);
        } else if (action.abilityId === "pirateRaid") {
          spawnPirateRaid(action.x, action.y, action.angle ?? 0);
        } else if (action.abilityId === "gloriousBattleMarch") {
          useGloriousBattleMarch(action.pid);
        } else if (action.abilityId === "loan") {
          useLoan(action.pid);
        } else if (action.abilityId === "raiderCapture") {
          useRaiderCapture(action.pid, action.targetCityId);
        } else if (action.abilityId === "timeJump") {
          if (!state._timeSnapshots || state._timeSnapshots.length === 0) { /* no snapshot */ }
          else {
            const targetT = Math.max(0, state.t - TIME_JUMP_REWIND_SEC);
            let snap = null;
            for (let i = state._timeSnapshots.length - 1; i >= 0; i--) {
              if (state._timeSnapshots[i].t <= targetT) {
                snap = state._timeSnapshots[i];
                break;
              }
            }
            if (snap) {
              const eliminatedBeforeRewind = [...state.players.values()].filter(p => p.eliminated).map(p => p.id);
              restoreFromTimeSnapshot(snap, eliminatedBeforeRewind, action.pid);
            }
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
    state._lastDt = dt;

    if (typeof saveTimeSnapshot === "function") saveTimeSnapshot();

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

      perfStartStep("combatStateMachine");
      if (typeof SQUADLOGIC !== "undefined" && SQUADLOGIC.step) {
        SQUADLOGIC.step(state, dt, {
          queryHash,
          getUnitAtkRange,
          getUnitEngagementRange,
          getUnitBaseSpeed,
          shieldRadius,
          getPlanetRadius,
          getUnitHitRadius,
          getFormationOffsets
        });
      } else if (typeof COMBAT !== "undefined" && COMBAT.stepCombatSystem) {
        COMBAT.stepCombatSystem(state, dt, {
          queryHash,
          getUnitAtkRange,
          getUnitEngagementRange,
          getUnitBaseSpeed,
          shieldRadius,
          getPlanetRadius,
          getUnitHitRadius
        });
      }
      perfEndStep("combatStateMachine");

      perfStartStep("stepUnits");
      stepUnits(dt);
      perfEndStep("stepUnits");
      perfStartStep("stepCombat");
      stepCombat(dt);
      perfEndStep("stepCombat");
      perfStartStep("mergeBattle");
      if (typeof SQUADLOGIC !== "undefined") {
        for (const u of state.units.values()) {
          if (u._formationRebuildAt != null && state.t >= u._formationRebuildAt && u.squadId != null) {
            u._formationRebuildAt = undefined;
            SQUADLOGIC.requestFormationRecalc(state, u.squadId, false);
            SQUADLOGIC.recalculateFormation(state, u.squadId, { getFormationOffsets }, false);
          }
        }
      } else {
        mergeBattleSurvivorsIntoOneSquad();
        for (const u of state.units.values()) {
          if (u._formationRebuildAt != null && u.leaderId == null && state.t >= u._formationRebuildAt) {
            u._formationRebuildAt = undefined;
            const squad = [u];
            for (const v of state.units.values()) if (v.leaderId === u.id) squad.push(v);
            if (squad.length > 1) {
              applyFormationToSquad(squad, u.formationType || "line", u.formationRows || 3, null, null, u.formationPigWidth);
            }
          }
        }
      }
      perfEndStep("mergeBattle");
      perfStartStep("stepTurrets");
      stepTurrets(dt);
      perfEndStep("stepTurrets");
      stepPatrols(dt);
      perfStartStep("stepBullets");
      stepBullets(dt);
      perfEndStep("stepBullets");
      stepMines(dt);
      stepMineGems(dt);
      stepResourceMagnet(dt);
      stepPickups(dt);
      stepNebulae(dt);
      stepStorm(dt);
      stepAbilityStorms(dt);
      stepBlackHoles(dt);
      stepRandomEvents(dt);
      stepAbilityZoneEffects(dt);
      stepAbilityCooldowns(dt);
      stepLoanDebts(dt);
      stepMeteors(dt);
      stepBgComets(dt);
      stepSurvivalWaves(dt);
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

      stepMineGemsRemote(dt);
      stepMineGems(dt);

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
        NET.Interp.tickRes(r, NET.ZONE_SYNC_INTERVAL_MS, state.players);
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
        const payload = JSON.stringify(gs);
        const size = payload.length;
        if (!state._netPacketStats) state._netPacketStats = { samples: [], lastLog: 0 };
        const st = state._netPacketStats;
        st.samples.push({ size, full: !!gs._fullSync, t: state.t });
        if (st.samples.length > 120) st.samples.shift();
        if (state.t - st.lastLog >= 10) {
          st.lastLog = state.t;
          const recent = st.samples.slice(-30);
          const avg = recent.reduce((s, x) => s + x.size, 0) / recent.length;
          const fulls = recent.filter(x => x.full).length;
          const line = `[NET-PKT] size=${size} avg30=${Math.round(avg)} fullSyncs=${fulls} units=${(gs.units||[]).length}`;
          console.log(line);
          if (typeof window !== "undefined") {
            window._lastNetPacketLog = line;
            window._netPacketSamples = st.samples;
          }
        }
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
      // Running border lights (every frame, smooth animation)
      updateZoneLights(dt);
      // Zone contact glow (throttled — zones move slowly)
      if (state._frameCtr % 3 === 0) updateZoneContacts(dt);
    } else {
      // Hide effects when zones are toggled off
      contactGfx.clear();
      for (const p of state.players.values()) {
        if (p.zoneLightGfx) p.zoneLightGfx.clear();
      }
    }
    perfEndStep("zones");

    perfStartStep("visuals");
    const vfc = state._frameCtr;
    if (vfc % 2 === 0) updateShieldVisuals();
    if (vfc % 3 === 0) updateDischarges(dt);
    if (vfc % 4 === 0) pulseStars();
    drawBgComets();
    if (vfc % 4 === 0) updateActivityZones();
    if (vfc % 3 === 0) drawTurrets();
    if (vfc % 2 === 0) updateCityPopLabels();
    if (vfc % 3 === 0) updateSquadLabels();
    if (vfc % 2 === 0) updateShipTrails();
    if (vfc % 3 === 0) updateCombatUI();
    updateFloatingDamage(dt);
    updateAbilityAnnouncements(dt);
    drawBullets();
    if (vfc % 2 === 0) { drawStorm(); drawNebulae(); }
    if (vfc % 2 === 0) { drawAbilityStorms(); drawBlackHoles(); drawPirateBase(); drawAbilityZoneEffects(); }
    drawHyperFlashes();
    drawMeteors();
    drawMeteorImpactEffects();
    if (state._abilityTargeting) drawAbilityTargetPreview();
    else clearAbilityPreview();
    if (neonEdgeSprite) {
      if (neonEdgeSprite.parent) neonEdgeSprite.parent.removeChild(neonEdgeSprite);
      world.addChild(neonEdgeSprite);
    }
    pulseNeonEdge();
    updateSelectionBox();
    updatePathPreview();
    updateMovingPathPreview();
    if (vfc % 4 === 0) updateMinimap();
    if (vfc % 3 === 0) updateLeaderboard();
    if (vfc % 2 === 0) updateFog();
    if (vfc % 2 === 0) updateSquadStrip();
    updateSquadControlBox();
    if (vfc % 3 === 0) updateHUD();
    if (vfc % 10 === 0) { checkVictory(); updateSurvivalHud(); updateDominationTimerUI(); }
    
    // Combat debug overlay (F2)
    if (typeof COMBAT !== "undefined" && COMBAT.DEBUG && COMBAT.DEBUG.enabled) {
      COMBAT.drawCombatDebug(combatDebugGfx, state, {
        getUnitAtkRange,
        inView
      });
      updateCombatDebugLabels();
    } else {
      if (combatDebugGfx) combatDebugGfx.clear();
      updateCombatDebugLabels();
    }
    
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

  function makeLogicTestState() {
    return {
      t: 0,
      units: new Map(),
      players: new Map(),
      turrets: new Map(),
      squads: new Map(),
      engagementZones: new Map(),
      nextSquadId: 1,
      nextEngagementZoneId: 1
    };
  }

  function addLogicTestUnit(testState, spec) {
    const unit = {
      id: spec.id,
      owner: spec.owner ?? 1,
      unitType: spec.unitType || "fighter",
      x: spec.x ?? 0,
      y: spec.y ?? 0,
      vx: 0,
      vy: 0,
      hp: spec.hp ?? 100,
      maxHp: spec.maxHp ?? spec.hp ?? 100,
      dmg: spec.dmg ?? 10,
      attackRange: spec.attackRange ?? 60,
      attackRate: spec.attackRate ?? 1,
      maxTargets: spec.maxTargets ?? 1,
      speed: spec.speed ?? 20,
      formationOffsetX: spec.formationOffsetX ?? 0,
      formationOffsetY: spec.formationOffsetY ?? 0,
      leaderId: spec.leaderId ?? null,
      squadId: spec.squadId,
      atkCd: 0
    };
    testState.units.set(unit.id, unit);
    return unit;
  }

  function stepLogicTestState(testState, dt) {
    testState.t += dt;
    SQUADLOGIC.step(testState, dt, {
      getUnitAtkRange: (u) => u.attackRange || 60,
      getUnitEngagementRange: (u) => u.attackRange || 60,
      shieldRadius: () => 0,
      getPlanetRadius: () => 32,
      getUnitHitRadius: () => 10,
      getFormationOffsets
    });
  }

  function describeOrderPreview(order) {
    if (!order) return { ghostPath: false, targetHighlight: false };
    return {
      ghostPath: order.type === "move" || order.type === "capture",
      targetHighlight: order.type === "attackUnit" || order.type === "attackCity"
    };
  }

  window._gameTest = {
    state, spawnXPOrb, killUnit, spawnMineGem, stepResourceMagnet, stepPickups, makeGemVisual,
    getSquads, getFormationOffsets, applyFormationToSquad, spawnUnitAt, getUnitAtkRange, getUnitEngagementRange, queryHash,
    squadLogic: typeof SQUADLOGIC !== "undefined" ? SQUADLOGIC : null,
    makeLogicTestState,
    addLogicTestUnit,
    stepLogicTestState,
    describeOrderPreview
  };

})();