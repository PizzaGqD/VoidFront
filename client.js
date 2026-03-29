(async () => {
  // Сокет и меню — синхронно, ДО любого await, чтобы кнопки работали мгновенно
  const state = {
    _menuMode: window._menuMode || null,
    _myNickname: window._myNickname || null,
    _lobbySlots: [],
    _roomId: null,
    _matchId: null,
    _matchType: null,
    _queueStatus: null,
    _isHost: false,
    _mySlot: null,
    _lobbyList: [],
    _colorEditSlot: null
  };
  const appBootstrapApi = (typeof window !== "undefined" && window.AppBootstrap && window.AppBootstrap.install)
    ? window.AppBootstrap.install({ state })
    : null;
  const platformApi = (typeof window !== "undefined" && window.PlatformAdapter && window.PlatformAdapter.install)
    ? window.PlatformAdapter.install({ storagePrefix: "voidfront" })
    : null;
  const runtimeConfig = (typeof window !== "undefined" && window.__VOIDFRONT_RUNTIME_CONFIG)
    ? window.__VOIDFRONT_RUNTIME_CONFIG
    : {};
  const singleReleaseOnly = runtimeConfig.singleOnly === true || runtimeConfig.authorityMode === "local";
  state._singleReleaseOnly = singleReleaseOnly;
  const debugToolsEnabled = runtimeConfig.enableDebugTools !== false;
  const testUiEnabled = debugToolsEnabled && runtimeConfig.enableTestUi !== false;
  const perfHudEnabled = debugToolsEnabled && runtimeConfig.enablePerfHud !== false;
  const coreMatchStateApi = (typeof window !== "undefined" && window.CoreMatchState && window.CoreMatchState.install)
    ? window.CoreMatchState.install({ state })
    : null;
  const singleProfileApi = (typeof window !== "undefined" && window.SingleProfile && window.SingleProfile.install)
    ? window.SingleProfile.install({ storageKeyPrefix: "voidfront" })
    : null;
  if (platformApi && typeof platformApi.init === "function") {
    try {
      await platformApi.init();
    } catch (err) {
      console.warn("[Platform]", err && err.message ? err.message : err);
    }
  }
  const socketUrlEarly = !singleReleaseOnly && platformApi && typeof platformApi.getServerUrl === "function"
    ? platformApi.getServerUrl()
    : (!singleReleaseOnly ? (window.GAME_SERVER_URL || location.origin) : "");
  let matchSessionApi = !singleReleaseOnly && (typeof window !== "undefined" && window.MatchSession && window.MatchSession.install)
    ? window.MatchSession.install({ state })
    : null;
  const socketSessionApi = !singleReleaseOnly && (typeof window !== "undefined" && window.SocketSession && window.SocketSession.install)
    ? window.SocketSession.install({ state, socketUrl: socketUrlEarly, platformAdapter: platformApi })
    : null;
  const socket = singleReleaseOnly
    ? null
    : (socketSessionApi && socketSessionApi.getSocket ? socketSessionApi.getSocket() : (typeof io !== "undefined" ? io(socketUrlEarly, { transports: ["websocket", "polling"] }) : null));
  state._socket = socket;
  const actionGatewayApi = !singleReleaseOnly && (typeof window !== "undefined" && window.ActionGateway && window.ActionGateway.install)
    ? window.ActionGateway.install({ state, getSocket: () => (socketSessionApi && socketSessionApi.getSocket ? socketSessionApi.getSocket() : state._socket) })
    : null;
  let gameModeControllerApi = null;
  let singleMenuUiApi = null;
  const CardSystemApi = (typeof window !== "undefined" && window.CardSystem) ? window.CardSystem : null;
  function showLoadingAlert() {
    alert("Игра ещё загружается. Подождите 2–3 сек.");
  }

  window.__createRoom = showLoadingAlert;
  window.__joinRoom = showLoadingAlert;
  window.__refreshLobbyList = function () {};

  function isServerAuthorityRemote() {
    return state._authorityMode === "server" && !!(state._multiSlots) && !state._multiIsHost;
  }

  function sendPlayerAction(payload) {
    if (actionGatewayApi && actionGatewayApi.sendPlayerAction) {
      return actionGatewayApi.sendPlayerAction(payload);
    }
    if (!payload || !(state._multiSlots && !state._multiIsHost && state._socket)) return false;
    state._socket.emit("playerAction", payload);
    return true;
  }

  function sendCardState(payload) {
    if (actionGatewayApi && actionGatewayApi.sendCardState) {
      return actionGatewayApi.sendCardState(payload);
    }
    if (!payload || !state._multiIsHost || !state._socket || !state._roomId) return false;
    state._socket.emit("cardState", payload);
    return true;
  }

  function sendMapRegenerate(payload) {
    if (actionGatewayApi && actionGatewayApi.sendMapRegenerate) {
      return actionGatewayApi.sendMapRegenerate(payload);
    }
    if (!(state._multiSlots && state._multiIsHost && state._socket && state._roomId)) return false;
    state._socket.emit("mapRegenerate", payload || {});
    return true;
  }

  function sendChatMessage(text) {
    if (actionGatewayApi && actionGatewayApi.sendChat) {
      return actionGatewayApi.sendChat(text);
    }
    if (!state._socket) return false;
    const normalized = String(text || "").trim();
    if (!normalized) return false;
    state._socket.emit("chat", normalized);
    return true;
  }

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
  const turretB = balance.turret || {};
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
  const CORE_ROSTER_UNIT_TYPES = ["destroyer", "cruiser", "battleship"];
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

    TURRET_SPACING: turretB.spacing ?? 55,
    TURRET_ATTACK_RADIUS: turretB.attackRadius ?? 45,
    TURRET_ATTACK_RATE: turretB.attackRate ?? 1.2,
    TURRET_ATTACK_DMG: turretB.attackDamage ?? 15,
    TURRET_HP_RATIO: turretB.hpRatio ?? 0.35,
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
    MINE_YIELD_PER_SEC: minesB.yieldPerSecond ?? 0.5,
    MINE_ENERGY_PER_SEC: minesB.energyPerSecond ?? 0.3,
    MINE_BASE_YIELD_VALUE: minesB.baseYieldValue ?? 1,
    MINE_XP_YIELD_MUL: minesB.xpYieldMultiplier ?? 1,
    MINE_RICH_MULTIPLIER: minesB.richMultiplier ?? 2.0,
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
    BLACKHOLE_DURATION: bhB.duration ?? 10,
    BLACKHOLE_RADIUS: bhB.radius ?? 400,
    BLACKHOLE_GROWTH_TIME: bhB.growthTime ?? 3,
    BLACKHOLE_HOLD_TIME: (bhB.holdTime ?? 10) + 5,
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

  function toSimSeconds(realSeconds) {
    return Math.max(0, (realSeconds || 0) * (CFG.GAME_SPEED || 1));
  }

  function fromSimSeconds(simSeconds) {
    return Math.max(0, (simSeconds || 0) / Math.max(0.0001, CFG.GAME_SPEED || 1));
  }

  function scaleTimingFields(target, keys) {
    if (!target || !Array.isArray(keys)) return target;
    for (const key of keys) {
      if (typeof target[key] === "number") target[key] = toSimSeconds(target[key]);
    }
    return target;
  }

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
  const netEl = document.getElementById("net");
  const fpsEl = document.getElementById("fps");
  // city/army stats are split into two elements, see updateHUD
  // Removed old sendCount/sendBtn -- now using unit purchase buttons
  const resetCamBtn = document.getElementById("resetCamBtn");
  const regenBtn = document.getElementById("regenBtn");
  const toggleZonesBtn = document.getElementById("toggleZones");
  const toggleGridBtn = document.getElementById("toggleGrid");
  if (toggleGridBtn) toggleGridBtn.style.opacity = CFG.GRID_ENABLED ? "1" : "0.55";
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
  const frontControlBox = document.getElementById("frontControlBox");
  const frontControlSummaryEl = document.getElementById("frontControlSummary");
  const frontWeightInputs = {
    left: document.getElementById("frontWeightLeft"),
    center: document.getElementById("frontWeightCenter"),
    right: document.getElementById("frontWeightRight")
  };
  const frontWeightValueEls = {
    left: document.getElementById("frontWeightLeftVal"),
    center: document.getElementById("frontWeightCenterVal"),
    right: document.getElementById("frontWeightRightVal")
  };
  const frontTargetEls = {
    left: document.getElementById("frontTargetLeft"),
    center: document.getElementById("frontTargetCenter"),
    right: document.getElementById("frontTargetRight")
  };
  const rallyPointBtn = document.getElementById("rallyPointBtn");
  const rallyPointHintEl = document.getElementById("rallyPointHint");

  if (rallyPointBtn) rallyPointBtn.style.display = "none";
  if (rallyPointHintEl) rallyPointHintEl.style.display = "none";
  bindFrontControlBox();

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

  function requireSquadLogic(context) {
    if (typeof SQUADLOGIC === "undefined") {
      throw new Error(`[SQUADLOGIC] Missing in ${context}`);
    }
    return SQUADLOGIC;
  }

  function getAuthoritativeSquadStateForUnit(u) {
    if (!u || u.squadId == null || !state.squads) return null;
    return state.squads.get(u.squadId) || null;
  }

  function isAuthoritativeSquadInCombat(squadState) {
    return !!(squadState && squadState.combat && squadState.combat.mode && squadState.combat.mode !== "idle");
  }

  function isUnitInAuthoritativeCombat(u) {
    return isAuthoritativeSquadInCombat(getAuthoritativeSquadStateForUnit(u));
  }

  function isIndirectControlEnabled() {
    return state._frontControlEnabled !== false;
  }

  function isBotIndirectControlEnabled() {
    if (state._menuBackdropActive) return isIndirectControlEnabled();
    return true;
  }

  function isCoreRosterUnitType(unitTypeKey) {
    return CORE_ROSTER_UNIT_TYPES.includes(unitTypeKey);
  }

  const INDIRECT_TRIPLET_BUNDLE_COSTS = {
    fighter: 150,
    destroyer: 450,
    cruiser: 1800,
    battleship: 5100,
    hyperDestroyer: 12000
  };

  function getPurchaseUnitsPerOrder(bundleUnits) {
    return Math.max(1, bundleUnits | 0);
  }

  function getBaseUnitPurchaseCost(unitTypeKey, bundleUnits = 1) {
    const type = UNIT_TYPES[unitTypeKey];
    if (!type) return 0;
    const unitsPerOrder = getPurchaseUnitsPerOrder(bundleUnits);
    if (isIndirectControlEnabled() && unitsPerOrder === 3 && INDIRECT_TRIPLET_BUNDLE_COSTS[unitTypeKey] != null) {
      return INDIRECT_TRIPLET_BUNDLE_COSTS[unitTypeKey];
    }
    return type.cost || 0;
  }

  function getPurchaseCostWithModifiers(ownerId, unitTypeKey, purchaseCount = 1, bundleUnits = 1) {
    const player = ownerId != null ? state.players.get(ownerId) : null;
    const costMul = player && player.unitCostMul != null ? player.unitCostMul : 1;
    const costPerPurchase = Math.max(1, Math.round(getBaseUnitPurchaseCost(unitTypeKey, bundleUnits) * costMul));
    return {
      costPerPurchase,
      totalCost: costPerPurchase * Math.max(1, purchaseCount | 0)
    };
  }

  function getFrontPlannerApi() {
    return typeof FrontPlanner !== "undefined" ? FrontPlanner : null;
  }

  function getFrontControlCoreId() {
    return state.myPlayerId != null ? state.myPlayerId : 1;
  }

  function getAutoFrontSpecs(coreId) {
    const planner = getFrontPlannerApi();
    if (planner && planner.getSpawnFrontSpecs) return planner.getSpawnFrontSpecs(state, coreId);
    const me = state.players.get(coreId);
    const center = state.centerObjectives || { centerX: me ? me.x : 0, centerY: me ? me.y : 0 };
    return ["left", "center", "right"].map((frontType) => ({
      frontType,
      sourceTag: "front:" + frontType,
      waypoints: frontType === "center"
        ? [{ x: center.centerX || 0, y: center.centerY || 0 }]
        : [{ x: me ? me.x + (frontType === "left" ? -220 : 220) : 0, y: me ? me.y : 0 }]
    }));
  }

  function updateFrontControlBox() {
    if (frontControlBox) frontControlBox.style.display = "none";
  }

  function bindFrontControlBox() {}

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
      sendPlayerAction({
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
      sendPlayerAction({
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
        sendPlayerAction({ type: "splitSquad", unitIds: squad.map(u => u.id) });
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
      sendPlayerAction({ type: "splitSquad", leader1Id: leader1.id, leader2Id: leader2.id, unitIds: squad.map(u => u.id) });
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
      sendPlayerAction({ type: "splitSquadByType", squadId: squadState.id });
    }
  }
  if (splitByTypeBtn) splitByTypeBtn.addEventListener("click", doSplitSquadByType);
  const splitByTypeBtnOne = document.getElementById("splitByTypeBtnOne");
  if (splitByTypeBtnOne) splitByTypeBtnOne.addEventListener("click", doSplitSquadByType);

  function updateSquadControlBox() {
    if (!squadControlBox) return;
    if (isIndirectControlEnabled()) {
      squadControlBox.style.display = "none";
      return;
    }
    const squads = getSelectedSquads();
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
    if (isIndirectControlEnabled()) {
      squadStripEl.innerHTML = "";
      return;
    }
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
  function playMineIncomeSound(creditGain = 0) {
    if (state._menuBackdropActive) return;
    if (creditGain <= 0) return;
    state._mineIncomeSoundBudget = (state._mineIncomeSoundBudget || 0) + creditGain;
    if (state._mineIncomeSoundBudget < 100) return;
    state._mineIncomeSoundBudget -= 100;
    playCollectSound();
  }
  const COLLECT_SOUND_THROTTLE = 0.06;
  function playCollectSound() {
    if (state._menuBackdropActive) return;
    if (!audioCtx || audioCtx.state !== "running") return;
    if (state._lastCollectSoundAt != null && (state.t - state._lastCollectSoundAt) < COLLECT_SOUND_THROTTLE) return;
    state._lastCollectSoundAt = state.t;
    const t0 = audioCtx.currentTime;
    const notes = [1180, 1480];
    const gain = 0.034;
    for (let i = 0; i < notes.length; i++) {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = i === 0 ? "triangle" : "sine";
      const start = t0 + i * 0.022;
      osc.frequency.setValueAtTime(notes[i], start);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gain, start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.048);
      osc.connect(g).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.055);
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
  let sharedMatchBootstrapApi = null;
  function colorForId(id) {
    if (PLAYER_COLORS[id] != null) return PLAYER_COLORS[id];
    const h = (id * 137.508) % 360;
    const { r, g, b } = hslToRgb(h, 78, 55);
    return (r << 16) | (g << 8) | b;
  }
  function nameForId(id) {
    return PLAYER_NAMES[id] ?? ("Bot#" + id);
  }

  sharedMatchBootstrapApi = (typeof window !== "undefined" && window.SharedMatchBootstrap && typeof window.SharedMatchBootstrap.install === "function")
    ? window.SharedMatchBootstrap.install({
        CFG,
        clamp,
        computeInfluencePolygon,
        colorForId,
        nameForId,
        cardSystemApi: CardSystemApi
      })
    : null;

  // ------------------------------------------------------------
  // Pixi App
  // ------------------------------------------------------------
  const LOW_GPU_MODE = !!(
    (typeof navigator !== "undefined" && navigator.deviceMemory && navigator.deviceMemory <= 4) ||
    (typeof navigator !== "undefined" && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
  );
  const DISABLE_PIXI_FILTERS = true;

  function showRendererInitError(err) {
    console.error("[PIXI] Renderer init failed:", err);
    let box = document.getElementById("rendererInitError");
    if (box) return;
    box = document.createElement("div");
    box.id = "rendererInitError";
    box.style.cssText = "position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:#050814;color:#dbe9ff;font-family:Inter,system-ui,sans-serif;padding:24px;text-align:center;";
    box.innerHTML =
      "<div style=\"max-width:640px;background:rgba(7,12,26,0.88);border:1px solid rgba(92,142,255,0.34);border-radius:16px;padding:22px 24px;box-shadow:0 0 28px rgba(41,95,255,0.12)\">" +
      "<div style=\"font-size:22px;font-weight:700;margin-bottom:10px;\">Не удалось запустить графику</div>" +
      "<div style=\"font-size:14px;line-height:1.45;color:rgba(220,232,255,0.88)\">Браузер не смог создать `WebGL` renderer для PIXI. " +
      "Обычно помогает включить аппаратное ускорение, обновить драйвер видеокарты или открыть игру в Chrome/Edge/Firefox без ограничений GPU.</div>" +
      "</div>";
    document.body.appendChild(box);
  }

  const app = new PIXI.Application();
  try {
    await app.init({
      resizeTo: window,
      antialias: !LOW_GPU_MODE,
      background: 0x070a12,
      preference: "webgl"
    });
  } catch (err) {
    showRendererInitError(err);
    return;
  }

  document.body.appendChild(app.canvas);
  app.canvas.style.cssText = "position:fixed;inset:0;z-index:0;transition:opacity 260ms ease;";
  app.canvas.addEventListener("webglcontextlost", (ev) => {
    ev.preventDefault();
    console.error("[PIXI] WebGL context lost");
    try { app.stop(); } catch (_) {}
    showRendererInitError(new Error("WebGL context lost"));
  });

  // ── Procedural SFX (laser, explosion) — audible only when camera close to action ──
  let _audioCtx = null;
  const SOUND_HEAR_RADIUS = 550;
  const LASER_SFX_MIN_ZOOM = 0.18;
  const LASER_SFX_MAX_ZOOM = 0.48;
  const LASER_SFX_MIN_GAP_SEC = 0.02;
  const LASER_SFX_WINDOW_SEC = 0.12;
  const LASER_SFX_MAX_IN_WINDOW = 6;
  let _lastLaserSfxAt = -Infinity;
  let _laserSfxWindowStart = -Infinity;
  let _laserSfxWindowCount = 0;
  function ensureAudioCtx() {
    if (_audioCtx) return _audioCtx;
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return _audioCtx;
  }
  function isNearCamera(wx, wy) {
    if (state._menuBackdropActive) return false;
    const v = state._vp;
    if (!v) return false;
    const cx = (v.x + v.x2) / 2, cy = (v.y + v.y2) / 2;
    return Math.hypot(wx - cx, wy - cy) < SOUND_HEAR_RADIUS;
  }
  function getLaserZoomVolume() {
    const zoom = cam.zoom || CFG.CAMERA_START_ZOOM || 0.22;
    const mix = Math.max(0, Math.min(1, (zoom - LASER_SFX_MIN_ZOOM) / Math.max(0.001, LASER_SFX_MAX_ZOOM - LASER_SFX_MIN_ZOOM)));
    return mix * mix;
  }
  function playLaserSound(fromX, fromY, toX, toY) {
    const mx = (fromX + toX) / 2, my = (fromY + toY) / 2;
    if (!isNearCamera(mx, my)) return;
    const zoomVolume = getLaserZoomVolume();
    if (zoomVolume <= 0.001) return;
    try {
      const ctx = ensureAudioCtx();
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      if ((now - _laserSfxWindowStart) > LASER_SFX_WINDOW_SEC) {
        _laserSfxWindowStart = now;
        _laserSfxWindowCount = 0;
      }
      if ((now - _lastLaserSfxAt) < LASER_SFX_MIN_GAP_SEC) return;
      if (_laserSfxWindowCount >= LASER_SFX_MAX_IN_WINDOW) return;
      _lastLaserSfxAt = now;
      _laserSfxWindowCount++;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      const burstMix = Math.max(0.25, 1 - (_laserSfxWindowCount - 1) * 0.14);
      const startFreq = 1050 + Math.random() * 180;
      const endFreq = 360 + Math.random() * 90;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.05);
      gain.gain.setValueAtTime(0.05 * burstMix * zoomVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now); osc.stop(now + 0.05);
    } catch (_) {}
  }
  function playExplosionSound(x, y) {
    if (!isNearCamera(x, y)) return;
    try {
      const ctx = ensureAudioCtx();
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      const gain = ctx.createGain();
      oscA.type = "triangle";
      oscB.type = "sine";
      oscA.frequency.setValueAtTime(540, now);
      oscA.frequency.exponentialRampToValueAtTime(410, now + 0.085);
      oscB.frequency.setValueAtTime(820, now);
      oscB.frequency.exponentialRampToValueAtTime(620, now + 0.06);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.028, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
      oscA.connect(gain);
      oscB.connect(gain);
      gain.connect(ctx.destination);
      oscA.start(now);
      oscB.start(now);
      oscA.stop(now + 0.10);
      oscB.stop(now + 0.08);
    } catch (_) {}
  }

  // ── Storm Fringe starfield: crisp layers, colder palette, clearer parallax ─
  const starLayer = new PIXI.Container();
  app.stage.addChildAt(starLayer, 0); // behind world
  const starNebulaLayer = new PIXI.Container();
  app.stage.addChildAt(starNebulaLayer, 1); // independent nebula backdrop, above stars and below world

  const STAR_PARALLAX = [0.52, 0.42, 0.34, 0.27, 0.21, 0.16, 0.11, 0.07, 0.04, 0.02];
  const STARS_COUNT = [18, 22, 26, 32, 36, 40, 44, 48, 52, 56];
  const STAR_COLORS = ["#f8fbff", "#e8f0ff", "#d6e0ff", "#c4d0ff", "#dce3ff", "#b9c7ff"];
  const STAR_BASE_ALPHA = [0.34, 0.38, 0.42, 0.48, 0.54, 0.60, 0.68, 0.76, 0.84, 0.92];
  const STAR_LAYER_OPACITY = [0.78, 0.80, 0.82, 0.84, 0.86, 0.88, 0.90, 0.93, 0.96, 1.0];
  const STAR_SIZE_BASE = [0.18, 0.20, 0.24, 0.28, 0.34, 0.40, 0.48, 0.58, 0.70, 0.82];
  const STAR_SIZE_RANGE = [0.16, 0.18, 0.22, 0.26, 0.32, 0.38, 0.46, 0.54, 0.64, 0.76];
  let _starSprites = [];
  let _starPulseData = []; // per-layer pulse metadata
  let _starResizeBound = false;

  function buildStarTexture(seed, layerIndex) {
    const TW = 1600, TH = 1000;
    const cnv = document.createElement("canvas");
    cnv.width = TW; cnv.height = TH;
    const ctx = cnv.getContext("2d");
    if (layerIndex === 0) {
      ctx.fillStyle = "#04070f";
      ctx.fillRect(0, 0, TW, TH);
      ctx.globalAlpha = 1;
    }

    const rng = mulberry32(seed + 0x57AE5 + layerIndex * 7919);
    const count = STARS_COUNT[layerIndex] || 120;
    const sizeBase = STAR_SIZE_BASE[layerIndex] ?? 0.32;
    const sizeRange = STAR_SIZE_RANGE[layerIndex] ?? 0.34;
    const stars = [];
    for (let i = 0; i < count; i++) {
      const x = rng() * TW, y = rng() * TH;
      const r = sizeBase + rng() * sizeRange;
      const a = Math.min(1, (0.22 + rng() * 0.56) * (STAR_BASE_ALPHA[layerIndex] ?? 0.6));
      const col = STAR_COLORS[rng() * STAR_COLORS.length | 0];
      if (r < 0.45) {
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      } else {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 1.9);
        grad.addColorStop(0, col);
        grad.addColorStop(0.38, col);
        grad.addColorStop(1, "transparent");
        ctx.globalAlpha = a;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
      if (r > 0.9) {
        ctx.globalAlpha = a * 0.28;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - r * 2.4, y - 0.35, r * 4.8, 0.7);
        ctx.fillRect(x - 0.35, y - r * 2.4, 0.7, r * 4.8);
      }
      if (r > 1.25 && rng() > 0.58) {
        ctx.globalAlpha = a * 0.10;
        ctx.strokeStyle = "#f4f8ff";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x - r * 1.8, y - r * 1.8);
        ctx.lineTo(x + r * 1.8, y + r * 1.8);
        ctx.moveTo(x - r * 1.8, y + r * 1.8);
        ctx.lineTo(x + r * 1.8, y - r * 1.8);
        ctx.stroke();
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
    if (!_starResizeBound) {
      _starResizeBound = true;
      app.renderer.on("resize", (w, h) => { _starSprites.forEach(s => { s.width = w; s.height = h; }); });
    }
  }

  // Subtle pulse: modulate alpha of each star layer slightly over time
  function pulseStars() {
    const now = performance.now() / 1000;
    for (let L = 0; L < _starSprites.length; L++) {
      const base = STAR_LAYER_OPACITY[L] ?? 0.88;
      const pulse = 0.022 * Math.sin(now * (0.32 + L * 0.11) + L * 1.5);
      _starSprites[L].alpha = base + pulse;
    }
  }

  // Layers
  const world = new PIXI.Container();
  const mapLayer = new PIXI.Container();
  const nebulaLayer = new PIXI.Container();
  const gridLayer = new PIXI.Container();
  const frontLaneLayer = new PIXI.Container();
  const mineLayer = new PIXI.Container();
  const nebulaFxLayer = new PIXI.Container();
  const zonesLayer = new PIXI.Container();
  const resLayer = new PIXI.Container();
  const shipTrailsLayer = new PIXI.Container();
  const unitsLayer = new PIXI.Container();
  const cityLayer = new PIXI.Container();
  const fogLayer = new PIXI.Container();

  const turretLayer = new PIXI.Container();
  const activityZoneLayer = new PIXI.Container();
  const abilityFxLayer = new PIXI.Container();
  const squadLabelsLayer = new PIXI.Container();
  const combatLayer = new PIXI.Container();
  const floatingDamageLayer = new PIXI.Container();
  const bulletsLayer = new PIXI.Container();
  const ghostLayer = new PIXI.Container();
  const pathPreviewLayer = new PIXI.Container();
  const selectionBoxLayer = new PIXI.Container();
  const offMapAmbienceLayer = new PIXI.Container();
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
  const frontLaneGfx = new PIXI.Graphics();
  const frontLaneTextLayer = new PIXI.Container();
  const frontLaneLabelPool = new Map();
  frontLaneLayer.addChild(frontLaneGfx);
  frontLaneLayer.addChild(frontLaneTextLayer);
  const combatDebugLabels = new Map(); // squad:<id> -> PIXI.Text
  world.addChild(mapLayer, nebulaLayer, gridLayer, frontLaneLayer, mineLayer, nebulaFxLayer, zonesLayer, zoneEffectsLayer, turretLayer, activityZoneLayer, abilityFxLayer, shipTrailsLayer, unitsLayer, resLayer, cityLayer, shieldHitEffectsLayer, squadLabelsLayer, combatLayer, floatingDamageLayer, bulletsLayer, ghostLayer, combatDebugLayer);
  nebulaLayer.visible = false;
  nebulaFxLayer.visible = false;
  world.addChild(fogLayer);
  world.addChild(pathPreviewLayer, selectionBoxLayer);
  world.addChild(worldBorderDarkenLayer);
  fogLayer.visible = false;
  app.stage.addChild(world);

  const offMapAmbienceApi =
    (typeof window !== "undefined" && window.OffMapAmbienceRenderer)
      ? window.OffMapAmbienceRenderer
      : null;
  if (offMapAmbienceApi && typeof offMapAmbienceApi.attach === "function") {
    offMapAmbienceApi.attach({
      layer: offMapAmbienceLayer,
      worldWidth: CFG.WORLD_W,
      worldHeight: CFG.WORLD_H,
      screenWidth: app.renderer.width,
      screenHeight: app.renderer.height
    });
  }
  starLayer.addChild(offMapAmbienceLayer);

  const screenFxLayer = new PIXI.Container();
  app.stage.addChild(screenFxLayer);

  const announcementLayer = new PIXI.Container();
  app.stage.addChild(announcementLayer);

  // Glow filter for primitives
  const GlowFilter = PIXI.filters.GlowFilter || (pixiFilters && pixiFilters.GlowFilter);
  function makeGlow(color = 0xffffff, distance = 16, outerStrength = 2) {
    if (DISABLE_PIXI_FILTERS) return null;
    if (LOW_GPU_MODE) return null;
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
    if (offMapAmbienceApi && typeof offMapAmbienceApi.applyCamera === "function") {
      offMapAmbienceApi.applyCamera(cam.x, cam.y, cam.zoom || 0.22, app.renderer.width, app.renderer.height);
    }
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
  let sharedCitySimApi = null;

  function requireSharedCitySimApi() {
    if (!sharedCitySimApi) throw new Error("SharedCitySim runtime is not available");
    return sharedCitySimApi;
  }

  function requireSharedMatchBootstrapApi() {
    if (!sharedMatchBootstrapApi) throw new Error("SharedMatchBootstrap runtime is not available");
    return sharedMatchBootstrapApi;
  }


  /** Terrain type at world (wx, wy). Used for speed multiplier and influence cost. */
  function getTerrainType(wx, wy) {
    return requireSharedCitySimApi().getTerrainType(wx, wy);
  }

  function getTerrainSpeedMultiplier(wx, wy) {
    const type = getTerrainType(wx, wy);
    const t = CFG.TERRAIN_TYPES[type];
    return t ? t.speedMultiplier : 1;
  }

  function getTerrainInfluenceCost(wx, wy) {
    return requireSharedCitySimApi().getTerrainInfluenceCost(wx, wy);
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

  function pointInViewPad(x, y, pad = 0) {
    return rectInView(x, y, x, y, pad);
  }

  function rectInView(x1, y1, x2, y2, pad = 0) {
    const v = state._vp;
    if (!v) return true;
    return !(x2 < (v.x - pad) || x1 > (v.x2 + pad) || y2 < (v.y - pad) || y1 > (v.y2 + pad));
  }

  function pointsBoundsInView(points, pad = 0) {
    if (!Array.isArray(points) || points.length === 0) return false;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of points) {
      if (!point) continue;
      const x = point.x || 0;
      const y = point.y || 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    if (!Number.isFinite(minX)) return false;
    return rectInView(minX, minY, maxX, maxY, pad);
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
  function rebuildZoneGrid() {
    return requireSharedCitySimApi().rebuildZoneGrid();
  }
  function getZoneOwnerFast(x, y) {
    return requireSharedCitySimApi().getZoneOwnerFast(x, y);
  }
  function isInOverlapFast(x, y) {
    return requireSharedCitySimApi().isInOverlapFast(x, y);
  }

  // ---- PIXI helper: safely remove & queue children for deferred destroy ----
  const _destroyQueue = [];
  function getSafePixiDestroyOptions() {
    return {
      children: true,
      texture: false,
      textureSource: false,
      context: false,
      style: false
    };
  }
  function destroyChildren(container) {
    const children = container.removeChildren();
    for (let i = 0; i < children.length; i++) _destroyQueue.push(children[i]);
  }
  function getTransientPixiDestroyOptions() {
    return {
      children: true,
      texture: true,
      textureSource: true,
      context: true,
      style: true
    };
  }
  function destroyTransientChildren(container) {
    const children = container.removeChildren();
    const destroyOptions = getTransientPixiDestroyOptions();
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      try { if (child && child.destroy) child.destroy(destroyOptions); } catch (_) {}
    }
  }
  function flushDestroyQueue() {
    for (let i = 0; i < _destroyQueue.length; i++) {
      const c = _destroyQueue[i];
      try { if (c && c.destroy) c.destroy(getSafePixiDestroyOptions()); } catch (e) {}
    }
    _destroyQueue.length = 0;
  }
  function clearLayerButKeepGraphics(container, keepGraphic) {
    const children = container.removeChildren();
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child === keepGraphic) continue;
      _destroyQueue.push(child);
    }
    if (keepGraphic) {
      if (typeof keepGraphic.clear === "function") keepGraphic.clear();
      container.addChild(keepGraphic);
    }
  }
  function clearTransientWorldFxLayers() {
    clearLayerButKeepGraphics(zoneEffectsLayer, contactGfx);
    clearLayerButKeepGraphics(shieldHitEffectsLayer, shieldHitEffectsGfx);
    destroyChildren(shipTrailsLayer);
  }

  /** Compute influence zone polygon: 96 rays, budget burns by terrain cost per step. */
  function computeInfluencePolygon(cx, cy, pop) {
    return requireSharedCitySimApi().computeInfluencePolygon(cx, cy, pop);
  }


  /** Transparent playfield base: starfield supplies the background. */
  function makeMapTexture() {
    const W = CFG.MAP_TEX_W;
    const H = CFG.MAP_TEX_H;
    const cnv = document.createElement("canvas");
    cnv.width = W;
    cnv.height = H;
    const tex = PIXI.Texture.from(cnv);
    return tex;
  }

  /** Build a structured nebula texture with cavities and bright cores. */
  function buildNebulaTexture(seed, hue, accentHue) {
    const S = 192;
    const cnv = document.createElement("canvas");
    cnv.width = S; cnv.height = S;
    const ctx = cnv.getContext("2d");
    const img = ctx.createImageData(S, S);
    const d = img.data;
    const rng = mulberry32((seed ^ 0xa53c9e17) >>> 0);
    const accent = accentHue == null ? hue : accentHue;
    const hr = ((hue >> 16) & 0xff), hg = ((hue >> 8) & 0xff), hb = (hue & 0xff);
    const ar = ((accent >> 16) & 0xff), ag = ((accent >> 8) & 0xff), ab = (accent & 0xff);
    const cavities = [];
    const cores = [];
    const silhouetteLobes = [];
    const shapeRot = rng() * Math.PI * 2;
    const shapeCos = Math.cos(shapeRot);
    const shapeSin = Math.sin(shapeRot);
    const shapeScaleX = 0.76 + rng() * 0.62;
    const shapeScaleY = 0.74 + rng() * 0.66;
    const shapeShear = (rng() - 0.5) * 0.50;
    const shapePower = 1.28 + rng() * 1.18;
    const cavityCount = 2 + Math.floor(rng() * 3);
    const coreCount = 2 + Math.floor(rng() * 3);
    const silhouetteLobeCount = 2 + Math.floor(rng() * 4);
    for (let i = 0; i < silhouetteLobeCount; i++) {
      const rot = rng() * Math.PI * 2;
      const ang = rng() * Math.PI * 2;
      const dist = 0.08 + rng() * 0.28;
      silhouetteLobes.push({
        x: Math.cos(ang) * dist * (0.78 + rng() * 0.30),
        y: Math.sin(ang) * dist * (0.62 + rng() * 0.34),
        rx: 0.14 + rng() * 0.22,
        ry: 0.08 + rng() * 0.18,
        cos: Math.cos(rot),
        sin: Math.sin(rot),
        strength: 0.26 + rng() * 0.34
      });
    }
    for (let i = 0; i < cavityCount; i++) {
      const rot = rng() * Math.PI * 2;
      cavities.push({
        x: (rng() - 0.5) * 0.54,
        y: (rng() - 0.5) * 0.40,
        rx: 0.11 + rng() * 0.16,
        ry: 0.08 + rng() * 0.14,
        cos: Math.cos(rot),
        sin: Math.sin(rot),
        strength: 0.72 + rng() * 0.22
      });
    }
    for (let i = 0; i < coreCount; i++) {
      const rot = rng() * Math.PI * 2;
      cores.push({
        x: (rng() - 0.5) * 0.42,
        y: (rng() - 0.5) * 0.34,
        rx: 0.08 + rng() * 0.14,
        ry: 0.07 + rng() * 0.12,
        cos: Math.cos(rot),
        sin: Math.sin(rot),
        strength: 0.76 + rng() * 0.22
      });
    }
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        const nx = x / S, ny = y / S;
        const cx = nx - 0.5, cy = ny - 0.5;
        const rx = cx * shapeCos + cy * shapeSin;
        const ry = -cx * shapeSin + cy * shapeCos;
        const sx = (rx + ry * shapeShear) / shapeScaleX;
        const sy = ry / shapeScaleY;
        const dist = Math.pow(
          Math.pow(Math.abs(sx), shapePower) +
          Math.pow(Math.abs(sy), shapePower),
          1 / shapePower
        ) * 2;
        const n1 = valueNoise(x * 3, y * 3, 0.022, seed);
        const n2 = valueNoise(x * 3, y * 3, 0.046, seed + 999);
        const n3 = valueNoise(x * 3, y * 3, 0.010, seed + 2222);
        const n4 = valueNoise(x * 3, y * 3, 0.090, seed + 4444);
        const n5 = valueNoise(x * 3, y * 3, 0.180, seed + 8888);
        const warp = (n1 - 0.5) * 0.28 + (n2 - 0.5) * 0.14;
        let silhouetteLift = 0;
        let silhouetteRim = 0;
        for (let l = 0; l < silhouetteLobes.length; l++) {
          const lobe = silhouetteLobes[l];
          const dx = cx - lobe.x;
          const dy = cy - lobe.y;
          const qx = dx * lobe.cos + dy * lobe.sin;
          const qy = -dx * lobe.sin + dy * lobe.cos;
          const e = Math.sqrt((qx * qx) / (lobe.rx * lobe.rx) + (qy * qy) / (lobe.ry * lobe.ry));
          const lift = Math.max(0, 1 - e);
          const rim = Math.max(0, 1 - Math.abs(e - 1) / 0.24);
          silhouetteLift = Math.max(silhouetteLift, lift * lobe.strength);
          silhouetteRim = Math.max(silhouetteRim, rim * lobe.strength);
        }
        const outer = Math.max(0, 1 - dist * (0.86 + warp * 0.26) + (n3 - 0.5) * 0.15 + silhouetteLift * 0.42);
        const inner = Math.max(0, 1 - dist * (1.16 + warp * 0.18) + silhouetteLift * 0.20);
        const core = Math.max(0, 1 - dist * (1.64 + n2 * 0.10));
        const halo = Math.max(0, 1 - dist * 0.84);
        const shell = Math.max(0, outer - inner * 0.52) + silhouetteRim * 0.10;
        let cavityField = 0;
        let cavityRim = 0;
        for (let c = 0; c < cavities.length; c++) {
          const cav = cavities[c];
          const dx = cx - cav.x;
          const dy = cy - cav.y;
          const qx = dx * cav.cos + dy * cav.sin;
          const qy = -dx * cav.sin + dy * cav.cos;
          const e = Math.sqrt((qx * qx) / (cav.rx * cav.rx) + (qy * qy) / (cav.ry * cav.ry));
          const cut = Math.max(0, 1 - e);
          const rim = Math.max(0, 1 - Math.abs(e - 1) / 0.22);
          cavityField = Math.max(cavityField, cut * cav.strength);
          cavityRim = Math.max(cavityRim, rim * cav.strength);
        }
        let coreField = 0;
        for (let c = 0; c < cores.length; c++) {
          const coreBlob = cores[c];
          const dx = cx - coreBlob.x;
          const dy = cy - coreBlob.y;
          const qx = dx * coreBlob.cos + dy * coreBlob.sin;
          const qy = -dx * coreBlob.sin + dy * coreBlob.cos;
          const e = Math.sqrt((qx * qx) / (coreBlob.rx * coreBlob.rx) + (qy * qy) / (coreBlob.ry * coreBlob.ry));
          coreField = Math.max(coreField, Math.max(0, 1 - e) * coreBlob.strength);
        }
        const filament = Math.max(0, 1 - Math.abs(n4 - 0.54) * 5.4) * (0.40 + shell * 0.90 + silhouetteRim * 0.38);
        const grain = Math.max(0, 1 - Math.abs(n5 - 0.50) * 3.2) * (0.12 + inner * 0.24);
        const density = 1.04 + n1 * 0.16 + filament * 0.10;
        const edgeFade = Math.pow(clamp((1.02 - dist) / 0.30, 0, 1), 1.6);
        const alpha = Math.min(
          255,
          (
            Math.pow(halo, 2.4) * 24 +
            Math.pow(outer, 1.58) * 126 +
            Math.pow(inner, 1.20) * 118 +
            Math.pow(core, 0.96) * 68 +
            Math.pow(shell, 1.08) * 40 +
            filament * 56 +
            grain * 18
          ) * density * (1 - cavityField * 0.76) * edgeFade
        );
        const toneShift = 0.5 + 0.5 * Math.sin((cx * 2.4 + cy * 1.8 + n3 * 2.1) * Math.PI * 1.3);
        const accentMix = clamp(shell * 0.22 + cavityRim * 0.38 + coreField * 0.52 + silhouetteRim * 0.24, 0, 0.96);
        const baseR = hr * (1 - accentMix) + ar * accentMix;
        const baseG = hg * (1 - accentMix) + ag * accentMix;
        const baseB = hb * (1 - accentMix) + ab * accentMix;
        const warmTone = toneShift * (shell + cavityRim * 0.8);
        const coolTone = (1 - toneShift) * (inner + coreField * 0.4);
        const saturationBoost = 1.06 + shell * 0.10 + coreField * 0.16;
        const coreLift = 0.98 + inner * 0.20 + core * 0.22 + coreField * 0.34;
        d[i] = Math.min(255, baseR * saturationBoost * (coreLift + shell * 0.16) + 22 * warmTone + 12 * cavityRim + 14 * coreField + 18 * filament + 10 * grain) | 0;
        d[i+1] = Math.min(255, baseG * saturationBoost * (1.00 + inner * 0.20 + shell * 0.10) + 14 * warmTone + 14 * coolTone + 10 * coreField + 16 * filament + 8 * grain) | 0;
        d[i+2] = Math.min(255, baseB * saturationBoost * (1.06 + inner * 0.22 + shell * 0.18) + 26 * coolTone + 16 * cavityRim + 16 * coreField + 22 * filament + 12 * grain) | 0;
        d[i+3] = alpha | 0;
      }
    }
    ctx.putImageData(img, 0, 0);
    return PIXI.Texture.from(cnv);
  }

  // Nebulae are treated like a deep decorative backdrop.
  const NEBULA_LAYER_PARALLAX = [0];
  const NEBULA_BACKGROUND_PALETTES = [
    {
      key: "ghost-blue",
      layerColors: [0x20467d, 0x3a6eb0, 0x69a9d8, 0xaed8f3, 0xf2fbff],
      accentColors: [0x8bdcff, 0xf2b2ff]
    },
    {
      key: "ember-red",
      layerColors: [0x431626, 0x7e2841, 0xc65364, 0xf09a6a, 0xffe7be],
      accentColors: [0xff8e5d, 0xffc96f]
    },
    {
      key: "teal-violet",
      layerColors: [0x174156, 0x2b7190, 0x53b1c5, 0xa2e1eb, 0xf3feff],
      accentColors: [0x7df4ff, 0xc893ff]
    },
    {
      key: "royal-dust",
      layerColors: [0x341d58, 0x62338f, 0xa06dca, 0xe0aed3, 0xffece3],
      accentColors: [0xffa980, 0xaec8ff]
    }
  ];
  const NEBULA_VISUAL_VARIANTS = [
    {
      key: "veil-mass",
      cloudColors: [0x4a80ee, 0x6874ff, 0x56a8f6],
      edgeColor: 0xd8ecff,
      sparkColor: 0xaadaff,
      outerMul: 1.08,
      innerMul: 0.96,
      edgeMul: 0.86,
      shapeMul: 0.90,
      turbulenceMul: 0.74,
      plumeDistMul: 1.10,
      plumeScaleMul: 1.14,
      knotScaleMul: 0.92,
      ribbonWidthMul: 0.82,
      bodyAlphaMul: 1.06,
      zoneAlphaMul: 0.86,
      driftMul: 0.84,
      breathMul: 0.80
    },
    {
      key: "storm-heart",
      cloudColors: [0x4860dc, 0x7c5cff, 0x5e84ec],
      edgeColor: 0xdee4ff,
      sparkColor: 0xc6d6ff,
      outerMul: 0.98,
      innerMul: 1.08,
      edgeMul: 1.06,
      shapeMul: 1.08,
      turbulenceMul: 1.30,
      plumeDistMul: 0.92,
      plumeScaleMul: 0.98,
      knotScaleMul: 1.18,
      ribbonWidthMul: 1.16,
      bodyAlphaMul: 1.00,
      zoneAlphaMul: 1.02,
      driftMul: 1.08,
      breathMul: 1.04
    },
    {
      key: "ion-anvil",
      cloudColors: [0x4276d6, 0x5c92ff, 0x6c60e6],
      edgeColor: 0xd2e8ff,
      sparkColor: 0xb6e2ff,
      outerMul: 1.02,
      innerMul: 1.02,
      edgeMul: 1.00,
      shapeMul: 1.14,
      turbulenceMul: 1.08,
      plumeDistMul: 1.18,
      plumeScaleMul: 1.06,
      knotScaleMul: 1.00,
      ribbonWidthMul: 0.94,
      bodyAlphaMul: 0.96,
      zoneAlphaMul: 0.92,
      driftMul: 0.90,
      breathMul: 0.90
    },
    {
      key: "rift-plasma",
      cloudColors: [0x8c4ee0, 0xd06492, 0xff7c5c],
      edgeColor: 0xffe6dc,
      sparkColor: 0xffc09c,
      outerMul: 0.96,
      innerMul: 1.12,
      edgeMul: 1.10,
      shapeMul: 1.00,
      turbulenceMul: 1.42,
      plumeDistMul: 0.84,
      plumeScaleMul: 0.92,
      knotScaleMul: 1.24,
      ribbonWidthMul: 1.22,
      bodyAlphaMul: 1.12,
      zoneAlphaMul: 1.16,
      driftMul: 1.12,
      breathMul: 1.14
    }
  ];
  let nebulaContainers = []; // one PIXI.Container per parallax layer
  let stateNebulaClouds = [];
  let stateNebulaFogWisps = [];

  function tagNebulaBackdropSprite(sp, rng, driftAmount, alphaJitter, scaleJitter) {
    if (!sp) return;
    sp._nebulaAnim = {
      baseX: sp.x,
      baseY: sp.y,
      baseAlpha: sp.alpha,
      baseScaleX: sp.scale.x || 1,
      baseScaleY: sp.scale.y || 1,
      driftX: (rng() - 0.5) * driftAmount,
      driftY: (rng() - 0.5) * driftAmount * 0.7,
      speed: 0.045 + rng() * 0.030,
      phase: rng() * Math.PI * 2,
      alphaJitter: alphaJitter * (0.85 + rng() * 0.35),
      scaleJitter: scaleJitter * (0.85 + rng() * 0.35)
    };
  }

  function animateNebulaBackdrop(timeSec) {
    for (let i = 0; i < nebulaContainers.length; i++) {
      const layerC = nebulaContainers[i];
      if (!layerC) continue;
      const layerWave = Math.sin(timeSec * (0.020 + i * 0.004) + (layerC._animPhase || 0));
      layerC.alpha = 0.95 + layerWave * 0.04;
      for (let j = 0; j < layerC.children.length; j++) {
        const sp = layerC.children[j];
        const anim = sp && sp._nebulaAnim;
        if (!anim) continue;
        const waveA = Math.sin(timeSec * anim.speed + anim.phase);
        const waveB = Math.cos(timeSec * (anim.speed * 0.72) + anim.phase * 1.31);
        sp.position.set(anim.baseX + anim.driftX * waveA, anim.baseY + anim.driftY * waveB);
        sp.alpha = anim.baseAlpha * (0.94 + anim.alphaJitter * (0.5 + 0.5 * waveA));
        sp.scale.set(
          anim.baseScaleX * (1 + anim.scaleJitter * waveB),
          anim.baseScaleY * (1 + anim.scaleJitter * waveA * 0.85)
        );
      }
    }
  }

  function getNebulaVisualVariant(neb) {
    const idx = neb && neb._visualVariantIndex != null ? neb._visualVariantIndex : 0;
    return NEBULA_VISUAL_VARIANTS[idx % NEBULA_VISUAL_VARIANTS.length] || NEBULA_VISUAL_VARIANTS[0];
  }

  function getNebulaVisualDetail() {
    const level = LOD.getLevel(cam.zoom || 0.22);
    if (level === LOD.LEVELS.FAR) {
      return {
        outlineSteps: 20,
        outlineSmoothPasses: 1,
        plumes: 4,
        knots: 2,
        ribbons: 2,
        fringePoints: 5,
        fogWisps: 6,
        maxDischarges: 1,
        dischargeSegMin: 4,
        dischargeSegMax: 6,
        dischargeGlowWidth: 2.8,
        dischargeCoreWidth: 1.4,
        dischargeStride: 3
      };
    }
    if (level === LOD.LEVELS.MID) {
      return {
        outlineSteps: 34,
        outlineSmoothPasses: 2,
        plumes: 7,
        knots: 3,
        ribbons: 4,
        fringePoints: 8,
        fogWisps: 10,
        maxDischarges: 3,
        dischargeSegMin: 6,
        dischargeSegMax: 9,
        dischargeGlowWidth: 3.6,
        dischargeCoreWidth: 1.8,
        dischargeStride: 2
      };
    }
    return {
      outlineSteps: 52,
      outlineSmoothPasses: 3,
      plumes: 10,
      knots: 4,
      ribbons: 6,
      fringePoints: 10,
      fogWisps: 14,
      maxDischarges: 3,
      dischargeSegMin: 8,
      dischargeSegMax: 11,
      dischargeGlowWidth: 4.4,
      dischargeCoreWidth: 2.2,
      dischargeStride: 1
    };
  }

  function initNebulaVisual(neb, variantIndexOverride) {
    if (!neb) return;
    if (variantIndexOverride != null) neb._visualVariantIndex = variantIndexOverride;
    if (neb._visualVariantIndex == null) neb._visualVariantIndex = 0;
    const variant = getNebulaVisualVariant(neb);
    if (neb._shapeSeed == null) {
      neb._shapeSeed = ((((neb.x * 13.17) | 0) * 73856093) ^ (((neb.y * 9.73) | 0) * 19349663) ^ (((neb.radius * 5.31) | 0) * 83492791)) >>> 0;
    }
    const rng = mulberry32((neb._shapeSeed ^ ((neb._visualVariantIndex + 1) * 1637)) >>> 0);
    neb._seedA = neb._seedA ?? (rng() * Math.PI * 2);
    neb._seedB = neb._seedB ?? (rng() * Math.PI * 2);
    neb._seedC = neb._seedC ?? (rng() * Math.PI * 2);
    neb._seedD = neb._seedD ?? (rng() * Math.PI * 2);
    neb._driftA = neb._driftA ?? (rng() * Math.PI * 2);
    neb._driftB = neb._driftB ?? (rng() * Math.PI * 2);
    if (!neb._fillColor) {
      neb._fillColor = variant.cloudColors[Math.floor(rng() * variant.cloudColors.length)];
    }
    if (!Array.isArray(neb._plumes)) {
      neb._plumes = [];
      for (let i = 0; i < 16; i++) {
        neb._plumes.push({
          angle: rng() * Math.PI * 2,
          dist: neb.radius * (0.06 + Math.pow(rng(), 0.85) * 0.54) * (variant.plumeDistMul || 1),
          rx: neb.radius * (0.24 + rng() * 0.50) * (variant.plumeScaleMul || 1),
          ry: neb.radius * (0.12 + rng() * 0.26) * (variant.plumeScaleMul || 1),
          alpha: (0.032 + rng() * 0.052) * (variant.bodyAlphaMul || 1),
          phase: rng() * Math.PI * 2,
          drift: 0.08 + rng() * 0.18,
          squish: 0.45 + rng() * 0.45
        });
      }
    }
    if (!Array.isArray(neb._knots)) {
      neb._knots = [];
      for (let i = 0; i < 6; i++) {
        neb._knots.push({
          angle: rng() * Math.PI * 2,
          dist: neb.radius * (0.04 + rng() * 0.28),
          r: neb.radius * (0.10 + rng() * 0.16) * (variant.knotScaleMul || 1),
          alpha: (0.045 + rng() * 0.072) * (variant.bodyAlphaMul || 1),
          phase: rng() * Math.PI * 2,
          drift: 0.12 + rng() * 0.22
        });
      }
    }
    if (!Array.isArray(neb._ribbons)) {
      neb._ribbons = [];
      for (let i = 0; i < 12; i++) {
        neb._ribbons.push({
          angle: rng() * Math.PI * 2,
          bend: (rng() - 0.5) * 0.9,
          radiusMul: 0.24 + rng() * 0.48,
          width: (0.30 + rng() * 0.45) * (variant.ribbonWidthMul || 1),
          alpha: (0.018 + rng() * 0.036) * (variant.bodyAlphaMul || 1),
          phase: rng() * Math.PI * 2
        });
      }
    }
  }

  function sampleNebulaVisualRadius(neb, angle) {
    const variant = getNebulaVisualVariant(neb);
    const wobble =
      Math.sin(angle * 2.0 + (neb._seedA || 0)) * 0.10 +
      Math.sin(angle * 3.6 + (neb._seedB || 0)) * 0.07 +
      Math.sin(angle * 6.8 + (neb._seedC || 0)) * 0.026 +
      Math.sin(angle * 11.0 + (neb._seedD || 0)) * 0.010;
    const flatten = Math.cos(angle - (neb._driftA || 0)) * 0.042 * variant.shapeMul;
    return neb.radius * (1 + (wobble * variant.shapeMul * (variant.turbulenceMul || 1) + flatten) * 0.40);
  }

  function buildNebulaOutlinePoints(neb, detail, scaleMul = 1) {
    const pts = [];
    for (let i = 0; i <= detail.outlineSteps; i++) {
      const a = (i / detail.outlineSteps) * Math.PI * 2;
      const r = sampleNebulaVisualRadius(neb, a) * scaleMul;
      pts.push({ x: neb.x + Math.cos(a) * r, y: neb.y + Math.sin(a) * r, angle: a, radius: r });
    }
    const smoothPasses = Math.max(0, detail.outlineSmoothPasses || 0);
    if (!smoothPasses || pts.length < 4) return pts;

    let smooth = pts.slice(0, -1).map((pt) => ({ x: pt.x, y: pt.y }));
    for (let pass = 0; pass < smoothPasses; pass++) {
      const next = [];
      for (let i = 0; i < smooth.length; i++) {
        const a = smooth[i];
        const b = smooth[(i + 1) % smooth.length];
        next.push({
          x: a.x * 0.75 + b.x * 0.25,
          y: a.y * 0.75 + b.y * 0.25
        });
        next.push({
          x: a.x * 0.25 + b.x * 0.75,
          y: a.y * 0.25 + b.y * 0.75
        });
      }
      smooth = next;
    }

    const out = smooth.map((pt) => {
      const dx = pt.x - neb.x;
      const dy = pt.y - neb.y;
      return {
        x: pt.x,
        y: pt.y,
        angle: Math.atan2(dy, dx),
        radius: Math.hypot(dx, dy)
      };
    });
    if (out.length) out.push({ ...out[0] });
    return out;
  }

  function getAnimatedNebulaZone(neb) {
    const t = state.t || 0;
    const variant = getNebulaVisualVariant(neb);
    const baseX = neb._baseX ?? neb.x;
    const baseY = neb._baseY ?? neb.y;
    const baseRadius = neb._baseRadius ?? neb.radius;
    const driftMul = variant.driftMul || 1;
    const breathMul = variant.breathMul || 1;
    const driftX =
      Math.sin(t * (neb._floatFreqX || 0.02) + (neb._floatPhaseX || 0)) * (neb._floatAmpX || 0) * driftMul +
      Math.sin(t * (neb._floatFreqX2 || 0.013) + (neb._floatPhaseX2 || 0)) * (neb._floatAmpX2 || 0) * driftMul;
    const driftY =
      Math.cos(t * (neb._floatFreqY || 0.018) + (neb._floatPhaseY || 0)) * (neb._floatAmpY || 0) * driftMul +
      Math.sin(t * (neb._floatFreqY2 || 0.011) + (neb._floatPhaseY2 || 0)) * (neb._floatAmpY2 || 0) * driftMul;
    const breath =
      Math.sin(t * (neb._breathFreq || 0.017) + (neb._breathPhase || 0)) * (neb._breathAmp || 0) * breathMul +
      Math.sin(t * (neb._breathFreq2 || 0.011) + (neb._breathPhase2 || 0)) * (neb._breathAmp2 || 0) * breathMul;
    return {
      x: baseX + driftX,
      y: baseY + driftY,
      radius: baseRadius * (1 + breath)
    };
  }

  function destroyNebulaCachedVisuals(neb) {
    if (!neb) return;
    if (neb._bodyContainer && !neb._bodyContainer.destroyed) {
      if (neb._bodyContainer.parent) neb._bodyContainer.parent.removeChild(neb._bodyContainer);
      neb._bodyContainer.destroy({ children: true });
    }
    if (neb._zoneContainer && !neb._zoneContainer.destroyed) {
      if (neb._zoneContainer.parent) neb._zoneContainer.parent.removeChild(neb._zoneContainer);
      neb._zoneContainer.destroy({ children: true });
    }
    neb._bodyContainer = null;
    neb._zoneContainer = null;
    neb._renderLod = null;
  }

  function invalidateNebulaBodyGraphics() {
    if (state.nebulae && state.nebulae.length) {
      for (const neb of state.nebulae) destroyNebulaCachedVisuals(neb);
    }
    if (state._nebulaBodyGfx && !state._nebulaBodyGfx.destroyed) {
      if (state._nebulaBodyGfx.parent) state._nebulaBodyGfx.parent.removeChild(state._nebulaBodyGfx);
      state._nebulaBodyGfx.destroy();
    }
    if (state._nebulaZoneGfx && !state._nebulaZoneGfx.destroyed) {
      if (state._nebulaZoneGfx.parent) state._nebulaZoneGfx.parent.removeChild(state._nebulaZoneGfx);
      state._nebulaZoneGfx.destroy();
    }
    state._nebulaBodyGfx = null;
    state._nebulaZoneGfx = null;
    state._nebulaBodyLod = null;
  }

  function ensureNebulaCachedVisuals(neb, detail, bodyLod) {
    initNebulaVisual(neb);
    if (
      neb._renderLod === bodyLod &&
      neb._bodyContainer && !neb._bodyContainer.destroyed &&
      neb._zoneContainer && !neb._zoneContainer.destroyed
    ) return;

    destroyNebulaCachedVisuals(neb);

    const variant = getNebulaVisualVariant(neb);
    const fillColor = neb._fillColor || (neb._hue != null ? neb._hue : variant.cloudColors[0]);
    const baseRadius = neb._baseRadius ?? neb.radius;
    const localNeb = { ...neb, x: 0, y: 0, radius: baseRadius };
    const body = new PIXI.Graphics();
    const zone = new PIXI.Graphics();

    const softEllipse = (g, x, y, rx, ry, color, alpha) => {
      g.ellipse(x, y, rx * 1.46, ry * 1.46);
      g.fill({ color, alpha: alpha * 0.10 });
      g.ellipse(x, y, rx * 1.18, ry * 1.18);
      g.fill({ color, alpha: alpha * 0.18 });
      g.ellipse(x, y, rx, ry);
      g.fill({ color, alpha: alpha * 0.32 });
      g.ellipse(x, y, rx * 0.76, ry * 0.76);
      g.fill({ color, alpha: alpha * 0.22 });
    };
    const ribbonStroke = (g, ax, ay, mx, my, bx, by, width, color, alpha) => {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const omt = 1 - t;
        pts.push(
          omt * omt * ax + 2 * omt * t * mx + t * t * bx,
          omt * omt * ay + 2 * omt * t * my + t * t * by
        );
      }
      g.poly(pts);
      g.stroke({ width, color, alpha });
    };

    const outlineFeather = buildNebulaOutlinePoints(localNeb, detail, 1.26 * variant.outerMul);
    const outlineOuter = buildNebulaOutlinePoints(localNeb, detail, 1.12 * variant.outerMul);
    const outline = buildNebulaOutlinePoints(localNeb, detail, 1);
    const outlineInner = buildNebulaOutlinePoints(localNeb, detail, 0.92 * variant.innerMul);
    const outlineCore = buildNebulaOutlinePoints(localNeb, detail, 0.82 * variant.innerMul);
    const bodyAlphaMul = variant.bodyAlphaMul || 1;
    const zoneAlphaMul = variant.zoneAlphaMul || 1;

    body.poly(outlineFeather.flatMap(p => [p.x, p.y]));
    body.fill({ color: fillColor, alpha: 0.022 * bodyAlphaMul });
    body.poly(outlineOuter.flatMap(p => [p.x, p.y]));
    body.fill({ color: fillColor, alpha: 0.042 * bodyAlphaMul });
    body.poly(outline.flatMap(p => [p.x, p.y]));
    body.fill({ color: fillColor, alpha: 0.070 * bodyAlphaMul });
    body.poly(outlineInner.flatMap(p => [p.x, p.y]));
    body.fill({ color: fillColor, alpha: 0.054 * bodyAlphaMul });
    body.poly(outlineCore.flatMap(p => [p.x, p.y]));
    body.fill({ color: fillColor, alpha: 0.030 * bodyAlphaMul });

    for (let i = 0; i < Math.min(detail.plumes, neb._plumes.length); i++) {
      const plume = neb._plumes[i];
      const ang = plume.angle;
      const dist = plume.dist;
      const px = Math.cos(ang) * dist;
      const py = Math.sin(ang * 0.92) * dist * 0.74;
      const rx = plume.rx * (1.02 + 0.18 * variant.outerMul);
      const ry = plume.ry * plume.squish * (1.00 + 0.12 * variant.innerMul);
      softEllipse(body, px, py, rx, ry, fillColor, plume.alpha * 0.95);
    }

    for (let i = 0; i < Math.min(detail.knots, neb._knots.length); i++) {
      const knot = neb._knots[i];
      const ka = knot.angle;
      const kd = knot.dist;
      const kx = Math.cos(ka) * kd;
      const ky = Math.sin(ka) * kd * 0.76;
      softEllipse(body, kx, ky, knot.r * 0.94, knot.r * 0.58, variant.edgeColor, knot.alpha * 0.42 * bodyAlphaMul);
    }

    for (let i = 0; i < Math.min(detail.ribbons, neb._ribbons.length); i++) {
      const ribbon = neb._ribbons[i];
      const ra = ribbon.angle;
      const rr = baseRadius * ribbon.radiusMul;
      const ax = Math.cos(ra - ribbon.width) * rr;
      const ay = Math.sin(ra - ribbon.width) * rr * 0.82;
      const bx = Math.cos(ra + ribbon.width) * rr;
      const by = Math.sin(ra + ribbon.width) * rr * 0.82;
      const mx = Math.cos(ra + ribbon.bend) * rr * 0.38;
      const my = Math.sin(ra + ribbon.bend) * rr * 0.24;
      ribbonStroke(body, ax, ay, mx, my, bx, by, 1.0, variant.edgeColor, ribbon.alpha * 0.88 * bodyAlphaMul);
    }

    body.poly(outline.flatMap(p => [p.x, p.y]));
    body.stroke({ color: variant.edgeColor, width: 0.9, alpha: 0.14 * variant.edgeMul * bodyAlphaMul });

    const fringeStep = Math.max(1, Math.floor(outline.length / Math.max(1, detail.fringePoints)));
    for (let i = 0; i < outline.length; i += fringeStep) {
      const pt = outline[i];
      const outR = pt.radius * (1.02 + 0.04 * variant.edgeMul);
      const fx = Math.cos(pt.angle) * outR;
      const fy = Math.sin(pt.angle) * outR;
      softEllipse(body, fx, fy, baseRadius * 0.075, baseRadius * 0.034, fillColor, 0.050 * bodyAlphaMul);
    }
    softEllipse(body, 0, 0, baseRadius * 0.44, baseRadius * 0.24, variant.edgeColor, 0.16 * bodyAlphaMul);

    const zoneOuter = buildNebulaOutlinePoints(localNeb, detail, 1.12);
    const zoneMid = buildNebulaOutlinePoints(localNeb, detail, 1.05);
    const zoneInner = buildNebulaOutlinePoints(localNeb, detail, 0.98);
    zone.poly(zoneOuter.flatMap(p => [p.x, p.y]));
    zone.fill({ color: fillColor, alpha: 0.010 * zoneAlphaMul });
    zone.poly(zoneMid.flatMap(p => [p.x, p.y]));
    zone.fill({ color: fillColor, alpha: 0.014 * zoneAlphaMul });
    zone.poly(zoneInner.flatMap(p => [p.x, p.y]));
    zone.fill({ color: fillColor, alpha: 0.018 * zoneAlphaMul });
    zone.poly(zoneOuter.flatMap(p => [p.x, p.y]));
    zone.stroke({ color: variant.edgeColor, width: 6.2, alpha: 0.022 * zoneAlphaMul });
    zone.poly(zoneMid.flatMap(p => [p.x, p.y]));
    zone.stroke({ color: variant.edgeColor, width: 3.0, alpha: 0.055 * zoneAlphaMul });
    zone.poly(outline.flatMap(p => [p.x, p.y]));
    zone.stroke({ color: variant.edgeColor, width: 1.0, alpha: 0.15 * variant.edgeMul * zoneAlphaMul });
    for (let i = 0; i < outline.length; i += fringeStep) {
      const pt = outline[i];
      zone.circle(pt.x, pt.y, Math.max(0.8, baseRadius * 0.006));
      zone.fill({ color: variant.edgeColor, alpha: 0.05 * zoneAlphaMul });
    }

    body.cacheAsBitmap = true;
    zone.cacheAsBitmap = true;
    nebulaLayer.addChild(body);
    nebulaFxLayer.addChild(zone);
    neb._bodyContainer = body;
    neb._zoneContainer = zone;
    neb._renderLod = bodyLod;
  }

  function rebuildNebulae() {
    nebulaContainers.forEach(c => { if (c.parent) c.parent.removeChild(c); c.destroy({ children: true }); });
    nebulaContainers = [];
    stateNebulaClouds = [];
    stateNebulaFogWisps = [];
    invalidateNebulaBodyGraphics();

    const rng = mulberry32((mapSeed ^ 0xe3b014) >>> 0);
    const backdropClouds = [];
    const backdropFilaments = [];
    const backdropSwirls = [];
    const backdropVeils = [];
    const fieldLayouts = ["left", "right", "top", "bottom"]
      .map(side => ({ side, sort: rng() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ side }) => {
        if (side === "left") {
          return {
            x: -(0.16 + rng() * 0.24),
            y: 0.10 + rng() * 0.80,
            size: 0.84 + rng() * 0.26,
            jitterX: 46 + rng() * 54,
            jitterY: 56 + rng() * 96
          };
        }
        if (side === "right") {
          return {
            x: 1.16 + rng() * 0.24,
            y: 0.10 + rng() * 0.80,
            size: 0.84 + rng() * 0.26,
            jitterX: 46 + rng() * 54,
            jitterY: 56 + rng() * 96
          };
        }
        if (side === "top") {
          return {
            x: 0.08 + rng() * 0.84,
            y: -(0.18 + rng() * 0.24),
            size: 0.84 + rng() * 0.26,
            jitterX: 72 + rng() * 120,
            jitterY: 44 + rng() * 52
          };
        }
        return {
          x: 0.08 + rng() * 0.84,
          y: 1.18 + rng() * 0.24,
          size: 0.84 + rng() * 0.26,
          jitterX: 72 + rng() * 120,
          jitterY: 44 + rng() * 52
        };
      });
    const nebulaMinX = -CFG.WORLD_W * 0.60;
    const nebulaMaxX = CFG.WORLD_W * 1.60;
    const nebulaMinY = -CFG.WORLD_H * 0.60;
    const nebulaMaxY = CFG.WORLD_H * 1.60;

    const paletteOffset = Math.floor(rng() * NEBULA_BACKGROUND_PALETTES.length);
    for (let i = 0; i < fieldLayouts.length; i++) {
      const layout = fieldLayouts[i];
      const paletteIndex = (paletteOffset + i) % NEBULA_BACKGROUND_PALETTES.length;
      const fieldR = (560 + rng() * 240) * layout.size;
      const centerX = clamp(CFG.WORLD_W * layout.x + (rng() - 0.5) * (layout.jitterX || 80), nebulaMinX, nebulaMaxX);
      const centerY = clamp(CFG.WORLD_H * layout.y + (rng() - 0.5) * (layout.jitterY || 60), nebulaMinY, nebulaMaxY);
      const fieldAxis = rng() * Math.PI * 2;
      const primaryLayer = 0;
      const satelliteCount = rng() < 0.34 ? 0 : 1 + ((rng() * 2) | 0);
      const bodyMode = (rng() * 4) | 0;
      const primaryStretchW =
        bodyMode === 0 ? 1.42 + rng() * 0.34 :
        bodyMode === 1 ? 0.82 + rng() * 0.22 :
        bodyMode === 2 ? 1.04 + rng() * 0.46 :
        1.16 + rng() * 0.54;
      const primaryStretchH =
        bodyMode === 0 ? 0.62 + rng() * 0.18 :
        bodyMode === 1 ? 1.20 + rng() * 0.38 :
        bodyMode === 2 ? 0.72 + rng() * 0.46 :
        0.86 + rng() * 0.56;

      backdropClouds.push({
        cx: centerX,
        cy: centerY,
        r: fieldR * (0.92 + rng() * 0.08),
        stretchW: primaryStretchW,
        stretchH: primaryStretchH,
        rot: rng() * Math.PI * 2,
        alpha: 0.092 + rng() * 0.026,
        paletteIndex,
        isPrimary: true,
        layerIndex: primaryLayer,
        shapeBias: (rng() * 10000) | 0
      });
      for (let c = 0; c < satelliteCount; c++) {
        const ringT = satelliteCount <= 1 ? 0.5 : c / Math.max(1, satelliteCount - 1);
        const ang = fieldAxis + (rng() - 0.5) * Math.PI * 1.45 + ringT * Math.PI * (0.45 + rng() * 0.45);
        const dist = fieldR * (0.015 + rng() * 0.060 + ringT * 0.035);
        const offsetX = Math.cos(ang) * dist;
        const offsetY = Math.sin(ang) * dist * (0.68 + rng() * 0.18);
        const sizeMul = c === 0
          ? (0.54 + rng() * 0.10)
          : (0.26 + rng() * 0.18);
        const alphaMul = c === 0
          ? (0.034 + rng() * 0.010)
          : (0.016 + rng() * 0.010);
        const satMode = (rng() * 4) | 0;
        backdropClouds.push({
          cx: clamp(centerX + offsetX, nebulaMinX, nebulaMaxX),
          cy: clamp(centerY + offsetY, nebulaMinY, nebulaMaxY),
          r: fieldR * sizeMul,
          stretchW:
            satMode === 0 ? 1.28 + rng() * 0.34 :
            satMode === 1 ? 0.74 + rng() * 0.24 :
            0.92 + rng() * 0.42,
          stretchH:
            satMode === 0 ? 0.58 + rng() * 0.18 :
            satMode === 1 ? 1.02 + rng() * 0.32 :
            0.60 + rng() * 0.34,
          rot: ang + (rng() - 0.5) * 0.42,
          alpha: alphaMul,
          paletteIndex,
          isPrimary: false,
          layerIndex: primaryLayer,
          shapeBias: (rng() * 10000) | 0
        });
      }

      const filamentCount = 4 + (layout.size > 0.9 ? 1 : 0);
      for (let f = 0; f < filamentCount; f++) {
        const ang = rng() * Math.PI * 2;
        const dist = fieldR * (0.08 + rng() * 0.20);
        backdropFilaments.push({
          cx: clamp(centerX + Math.cos(ang) * dist, nebulaMinX, nebulaMaxX),
          cy: clamp(centerY + Math.sin(ang) * dist * 0.72, nebulaMinY, nebulaMaxY),
          len: fieldR * (0.72 + rng() * 0.40),
          width: fieldR * (0.12 + rng() * 0.06),
          rot: ang + (rng() - 0.5) * 0.44,
          alpha: 0.040 + rng() * 0.018,
          paletteIndex,
          layerIndex: primaryLayer,
          shapeBias: (rng() * 10000) | 0
        });
      }

      const swirlCount = 4 + (layout.size > 1.0 ? 1 : 0);
      for (let s = 0; s < swirlCount; s++) {
        const ang = rng() * Math.PI * 2;
        const dist = fieldR * (0.04 + rng() * 0.16);
        backdropSwirls.push({
          cx: clamp(centerX + Math.cos(ang) * dist, nebulaMinX, nebulaMaxX),
          cy: clamp(centerY + Math.sin(ang) * dist * 0.68, nebulaMinY, nebulaMaxY),
          r: fieldR * (0.24 + rng() * 0.12),
          stretchW: 1.28 + rng() * 0.26,
          stretchH: 0.44 + rng() * 0.12,
          rot: ang + Math.PI * 0.5 + (rng() - 0.5) * 0.54,
          alpha: 0.044 + rng() * 0.018,
          paletteIndex,
          layerIndex: primaryLayer,
          shapeBias: (rng() * 10000) | 0
        });
      }

      // Wide veil passes created large blurry patches in the foreground.
    }

    stateNebulaClouds = backdropClouds.filter(c => c.isPrimary || c.r >= 300).map(c => ({
      cx: c.cx,
      cy: c.cy,
      r: c.r
    }));
    stateNebulaFogWisps = backdropVeils;

    const blendModes = PIXI && PIXI.BLEND_MODES ? PIXI.BLEND_MODES : null;
    const screenBlend = blendModes && blendModes.SCREEN != null ? blendModes.SCREEN : "screen";
    const normalBlend = blendModes && blendModes.NORMAL != null ? blendModes.NORMAL : "normal";
    const nebulaTextureCache = new Map();
    const SHAPE_VARIANTS = 9;

    function getCachedNebulaTexture(cacheKey, seed, color, accentColor) {
      if (nebulaTextureCache.has(cacheKey)) return nebulaTextureCache.get(cacheKey);
      const tex = buildNebulaTexture(seed >>> 0, color, accentColor);
      nebulaTextureCache.set(cacheKey, tex);
      return tex;
    }

    if (starNebulaLayer.parent !== app.stage) app.stage.addChildAt(starNebulaLayer, Math.min(1, app.stage.children.length));
    starNebulaLayer.removeChildren();

    const renderLayerCount = 1;
    for (let L = 0; L < renderLayerCount; L++) {
      const layerRng = mulberry32((mapSeed ^ ((L + 1) * 0x9e3779b9)) >>> 0);
      const layerC = new PIXI.Container();
      layerC._parallax = NEBULA_LAYER_PARALLAX[L];
      layerC._scaleMul = 1.26;
      layerC._animPhase = layerRng() * Math.PI * 2;
      const bodyBlend = normalBlend;
      const accentBlend = screenBlend || normalBlend;
      for (let n = 0; n < backdropClouds.length; n++) {
        const c = backdropClouds[n];
        if ((c.layerIndex ?? L) !== L) continue;
        const palette = NEBULA_BACKGROUND_PALETTES[c.paletteIndex % NEBULA_BACKGROUND_PALETTES.length];
        const layerColor = palette.layerColors[Math.min(L, palette.layerColors.length - 1)];
        const contrastColor = palette.accentColors[(n + L) % palette.accentColors.length];
        const shapeIdx = (((c.shapeBias || 0) + n * 3) + ((layerRng() * SHAPE_VARIANTS) | 0)) % SHAPE_VARIANTS;
        const offX = (layerRng() - 0.5) * c.r * (0.10 + L * 0.018);
        const offY = (layerRng() - 0.5) * c.r * (0.08 + L * 0.016);
        if (c.isPrimary) {
          const glowColor = palette.accentColors[(n + L + 1) % palette.accentColors.length];
          const glowTex = getCachedNebulaTexture(
            "glow:" + c.paletteIndex + ":" + L + ":" + shapeIdx + ":" + glowColor + ":" + layerColor,
            mapSeed + 30000 + c.paletteIndex * 733 + L * 97 + shapeIdx * 19 + (c.shapeBias || 0),
            glowColor,
            layerColor
          );
          const glow = new PIXI.Sprite(glowTex);
          glow.anchor.set(0.5, 0.5);
          glow.position.set(c.cx + offX * 0.45, c.cy + offY * 0.45);
          glow.width = c.r * (1.66 + L * 0.12) * c.stretchW;
          glow.height = c.r * (1.28 + L * 0.10) * c.stretchH;
          glow.rotation = c.rot + (L - 1) * 0.03;
          glow.alpha = (0.018 + L * 0.006) * (0.86 + layerRng() * 0.10);
          glow.blendMode = accentBlend;
          tagNebulaBackdropSprite(glow, layerRng, Math.min(18, c.r * 0.018), 0.10, 0.018);
          layerC.addChild(glow);

          const coreTex = getCachedNebulaTexture(
            "core:" + c.paletteIndex + ":" + L + ":" + shapeIdx + ":" + contrastColor + ":" + glowColor,
            mapSeed + 36000 + c.paletteIndex * 811 + L * 113 + shapeIdx * 23 + (c.shapeBias || 0),
            contrastColor,
            glowColor
          );
          const core = new PIXI.Sprite(coreTex);
          core.anchor.set(0.5, 0.5);
          core.position.set(c.cx + offX * 0.20, c.cy + offY * 0.20);
          core.width = c.r * (0.92 + L * 0.08) * c.stretchW;
          core.height = c.r * (0.70 + L * 0.06) * c.stretchH;
          core.rotation = c.rot + (layerRng() - 0.5) * 0.14;
          core.alpha = (0.042 + L * 0.012) * (0.88 + layerRng() * 0.10);
          core.blendMode = accentBlend;
          tagNebulaBackdropSprite(core, layerRng, Math.min(12, c.r * 0.010), 0.14, 0.022);
          layerC.addChild(core);
        }
        const tex = getCachedNebulaTexture(
          "cloud:" + c.paletteIndex + ":" + L + ":" + shapeIdx + ":" + layerColor + ":" + contrastColor,
          mapSeed + c.paletteIndex * 1000 + L * 333 + shapeIdx * 811,
          layerColor,
          contrastColor
        );
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5, 0.5);
        sp.position.set(c.cx + offX, c.cy + offY);
        sp.width = c.r * (1.62 + L * 0.12) * c.stretchW * (0.94 + layerRng() * 0.16);
        sp.height = c.r * (1.22 + L * 0.10) * c.stretchH * (0.94 + layerRng() * 0.14);
        sp.rotation = c.rot + (layerRng() - 0.5) * 0.28 + (L - 2) * 0.05;
        sp.alpha = c.alpha * (0.94 + L * 0.08) * (0.96 + layerRng() * 0.12);
        sp.blendMode = bodyBlend;
        tagNebulaBackdropSprite(sp, layerRng, Math.min(16, c.r * 0.016), 0.08, 0.015);
        layerC.addChild(sp);
      }

      for (let f = 0; f < backdropFilaments.length; f++) {
        const filament = backdropFilaments[f];
        if ((filament.layerIndex ?? L) !== L) continue;
        const palette = NEBULA_BACKGROUND_PALETTES[filament.paletteIndex % NEBULA_BACKGROUND_PALETTES.length];
        const filamentColor = palette.accentColors[(f + L) % palette.accentColors.length];
        const baseColor = palette.layerColors[Math.min(L + 1, palette.layerColors.length - 1)];
        const filamentTex = getCachedNebulaTexture(
          "filament:" + filament.paletteIndex + ":" + L + ":" + f + ":" + baseColor + ":" + filamentColor + ":" + (filament.shapeBias || 0),
          mapSeed + 70000 + filament.paletteIndex * 991 + L * 83 + f * 17 + (filament.shapeBias || 0),
          baseColor,
          filamentColor
        );
        const sp = new PIXI.Sprite(filamentTex);
        sp.anchor.set(0.5, 0.5);
        sp.position.set(
          filament.cx + (layerRng() - 0.5) * filament.width * 0.4,
          filament.cy + (layerRng() - 0.5) * filament.width * 0.3
        );
        sp.width = filament.len * (0.94 + layerRng() * 0.12);
        sp.height = filament.width * (0.90 + layerRng() * 0.16);
        sp.rotation = filament.rot + (layerRng() - 0.5) * 0.20;
        sp.alpha = filament.alpha * (0.92 + L * 0.08);
        sp.blendMode = accentBlend;
        tagNebulaBackdropSprite(sp, layerRng, Math.min(10, filament.width * 0.18), 0.10, 0.020);
        layerC.addChild(sp);
      }

      for (let s = 0; s < backdropSwirls.length; s++) {
        const swirl = backdropSwirls[s];
        if ((swirl.layerIndex ?? L) !== L) continue;
        const palette = NEBULA_BACKGROUND_PALETTES[swirl.paletteIndex % NEBULA_BACKGROUND_PALETTES.length];
        const swirlColor = palette.accentColors[(s + L + 1) % palette.accentColors.length];
        const swirlBase = palette.layerColors[Math.min(L + 1, palette.layerColors.length - 1)];
        const swirlTex = getCachedNebulaTexture(
          "swirl:" + swirl.paletteIndex + ":" + L + ":" + s + ":" + swirlBase + ":" + swirlColor + ":" + (swirl.shapeBias || 0),
          mapSeed + 90000 + swirl.paletteIndex * 577 + L * 131 + s * 29 + (swirl.shapeBias || 0),
          swirlBase,
          swirlColor
        );
        const sp = new PIXI.Sprite(swirlTex);
        sp.anchor.set(0.5, 0.5);
        sp.position.set(
          swirl.cx + (layerRng() - 0.5) * swirl.r * 0.12,
          swirl.cy + (layerRng() - 0.5) * swirl.r * 0.10
        );
        sp.width = swirl.r * (1.16 + layerRng() * 0.20) * swirl.stretchW;
        sp.height = swirl.r * (0.92 + layerRng() * 0.16) * swirl.stretchH;
        sp.rotation = swirl.rot + (layerRng() - 0.5) * 0.24;
        sp.alpha = swirl.alpha * (0.98 + L * 0.10);
        sp.blendMode = accentBlend;
        tagNebulaBackdropSprite(sp, layerRng, Math.min(10, swirl.r * 0.08), 0.12, 0.022);
        layerC.addChild(sp);
      }

      const veilCount = Math.max(0, Math.min(backdropVeils.length, 0));
      for (let v = 0; v < veilCount; v++) {
        const veil = backdropVeils[v];
        if (L < (veil.depthMin ?? 0) || L > (veil.depthMax ?? 99)) continue;
        const palette = NEBULA_BACKGROUND_PALETTES[veil.paletteIndex % NEBULA_BACKGROUND_PALETTES.length];
        const veilColor = palette.accentColors[(v + L) % palette.accentColors.length];
        const veilBaseColor = palette.layerColors[Math.max(0, Math.min(palette.layerColors.length - 1, L))];
        const veilShapeIdx = (((veil.shapeBias || 0) + v * 7) + ((layerRng() * SHAPE_VARIANTS) | 0)) % SHAPE_VARIANTS;
        const veilTex = getCachedNebulaTexture(
          "veil:" + veil.paletteIndex + ":" + L + ":" + veilShapeIdx + ":" + veilColor + ":" + veilBaseColor,
          mapSeed + 50000 + veil.paletteIndex * 577 + L * 67 + veilShapeIdx * 223,
          veilBaseColor,
          veilColor
        );
        const veilSp = new PIXI.Sprite(veilTex);
        veilSp.anchor.set(0.5, 0.5);
        veilSp.position.set(
          veil.x + (layerRng() - 0.5) * veil.rx * 0.18,
          veil.y + (layerRng() - 0.5) * veil.rx * 0.10
        );
        veilSp.width = veil.rx * (0.84 + L * 0.06) * (0.92 + layerRng() * 0.12);
        veilSp.height = veil.ry * (0.92 + L * 0.06) * (0.94 + layerRng() * 0.10);
        veilSp.rotation = veil.rot + (layerRng() - 0.5) * 0.24;
        veilSp.alpha = veil.alpha * (0.48 + L * 0.04) * (0.92 + layerRng() * 0.08);
        veilSp.blendMode = bodyBlend;
        tagNebulaBackdropSprite(veilSp, layerRng, Math.min(12, veil.rx * 0.010), 0.06, 0.010);
        layerC.addChild(veilSp);
      }
      starNebulaLayer.addChild(layerC);
      nebulaContainers.push(layerC);
    }

    if (starNebulaLayer.parent === app.stage) {
      app.stage.setChildIndex(starNebulaLayer, Math.min(1, Math.max(0, app.stage.children.length - 1)));
    }
  }

  function applyNebulaParallax() {
    const z = Math.max(0.001, cam.zoom || 0.22);
    const sw = app.renderer.width;
    const sh = app.renderer.height;
    const baseScale = Math.min(sw / CFG.WORLD_W, sh / CFG.WORLD_H);
    const zoomBase = Math.max(0.001, CFG.CAMERA_START_ZOOM || 0.22);
    const zoomScale = Math.pow(z / zoomBase, 0.12);
    for (const c of nebulaContainers) {
      const scale = baseScale * (c._scaleMul || 1) * zoomScale;
      c.scale.set(scale, scale);
      c.position.set(
        (sw - CFG.WORLD_W * scale) * 0.5,
        (sh - CFG.WORLD_H * scale) * 0.5
      );
    }
  }

  let neonEdgeSprite = null;

  function rebuildNeonEdges() {
    if (neonEdgeSprite) {
      if (neonEdgeSprite.parent) neonEdgeSprite.parent.removeChild(neonEdgeSprite);
      if (neonEdgeSprite.destroy) neonEdgeSprite.destroy();
    }
    const W = CFG.WORLD_W, H = CFG.WORLD_H;
    const PAD = 60;
    const g = new PIXI.Graphics();
    g.rect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.stroke({ color: 0x2f84ff, alpha: 0.12, width: 18 });
    g.rect(0, 0, W, H);
    g.stroke({ color: 0x55bbff, alpha: 0.55, width: 4 });
    g.rect(0, 0, W, H);
    g.stroke({ color: 0xdaf2ff, alpha: 0.75, width: 1.5 });
    neonEdgeSprite = g;
    world.addChild(neonEdgeSprite);
  }

  function pulseNeonEdge() {
    if (!neonEdgeSprite) return;
    const t = performance.now() / 1000;
    const pulse = 0.55 + 0.45 * Math.sin(t * 1.2);
    neonEdgeSprite.alpha = pulse;
  }

  /** Electrical discharges: zigzag lightning, mostly along the map edge. */
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
    const r = c.r * (0.18 + rng() * 0.34);
    return { pts: makeZigzag(c.cx, c.cy, c.cx + Math.cos(a) * r, c.cy + Math.sin(a) * r, rng, 6 + (rng() * 5 | 0)), progress: 0, speed: 0.0026 + rng() * 0.0022 };
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
      if (stateNebulaClouds.length > 0 && rng() < 0.84) {
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
    const outsideShadeAlpha = offMapAmbienceApi && typeof offMapAmbienceApi.getOutsideShadeAlpha === "function"
      ? offMapAmbienceApi.getOutsideShadeAlpha()
      : 0.55;
    g.rect(-big, -big, W + big * 2, big);
    g.fill({ color: 0x000000, alpha: outsideShadeAlpha });
    g.rect(-big, H, W + big * 2, big);
    g.fill({ color: 0x000000, alpha: outsideShadeAlpha });
    g.rect(-big, 0, big, H);
    g.fill({ color: 0x000000, alpha: outsideShadeAlpha });
    g.rect(W, 0, big, H);
    g.fill({ color: 0x000000, alpha: outsideShadeAlpha });
  }

  function rebuildMap(optionalSeed) {
    mapSeed = optionalSeed != null ? (optionalSeed >>> 0) : (Date.now() >>> 0);
    initStarfield(mapSeed);
    starLayer.addChild(offMapAmbienceLayer);
    const tex = makeMapTexture();
    if (mapSprite) mapLayer.removeChild(mapSprite);
    mapSprite = new PIXI.Sprite(tex);
    mapSprite.width = CFG.WORLD_W;
    mapSprite.height = CFG.WORLD_H;
    mapSprite.zIndex = 0;
    mapLayer.addChild(mapSprite);
    if (offMapAmbienceApi && typeof offMapAmbienceApi.rebuild === "function") {
      offMapAmbienceApi.rebuild({
        seed: mapSeed,
        worldWidth: CFG.WORLD_W,
        worldHeight: CFG.WORLD_H
      });
    }
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
    const step = Math.round((CFG.GRID_STEP ?? 100) * 1.25);
    function drawGridPath(target) {
      for (let x = 0; x <= CFG.WORLD_W; x += step) {
        target.moveTo(x, 0);
        target.lineTo(x, CFG.WORLD_H);
      }
      for (let y = 0; y <= CFG.WORLD_H; y += step) {
        target.moveTo(0, y);
        target.lineTo(CFG.WORLD_W, y);
      }
    }

    const glow = new PIXI.Graphics();
    drawGridPath(glow);
    glow.stroke({ color: 0x5d89d8, width: 1.53, alpha: 0.10 });
    gridLayer.addChild(glow);

    const g = new PIXI.Graphics();
    drawGridPath(g);
    g.stroke({ color: 0x7ea9e0, width: 0.71, alpha: 0.24 });
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
  if (typeof window !== "undefined" && window.SharedSimState && typeof window.SharedSimState.applyBaseState === "function") {
    window.SharedSimState.applyBaseState(state, CFG);
  } else {
    throw new Error("SharedSimState runtime is not available");
  }
  state._deathBursts = Array.isArray(state._deathBursts) ? state._deathBursts : [];
  if (coreMatchStateApi && typeof coreMatchStateApi.ensureNamespaces === "function") {
    coreMatchStateApi.ensureNamespaces();
  }
  if (!state._soloDifficulty) state._soloDifficulty = "easy";
  if (singleProfileApi && typeof singleProfileApi.ensureProfile === "function") {
    const loadedProfile = singleProfileApi.ensureProfile();
    state._myNickname = state._myNickname || loadedProfile.nickname || "Игрок";
    if (typeof window !== "undefined") window._myNickname = state._myNickname;
  }

  // ------------------------------------------------------------
  // Perf log (to find crash / FPS cause)
  // ------------------------------------------------------------
  const PERF_LOG_INTERVAL = 8;
  const PERF_FRAME_SAMPLES = 120;
  const PERF_TARGET_30_MS = 1000 / 30;
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
    const zoom = cam.zoom || CFG.CAMERA_START_ZOOM || 0.22;
    const vp = state._vp || getViewport();
    const viewportW = vp ? Math.max(0, vp.x2 - vp.x) : (app.screen.width / Math.max(0.001, zoom));
    const viewportH = vp ? Math.max(0, vp.y2 - vp.y) : (app.screen.height / Math.max(0.001, zoom));
    let visibleUnits = 0;
    let visibleTurrets = 0;
    let visibleBullets = 0;
    let visibleRes = 0;
    let visibleMines = 0;
    let visibleMineGems = 0;
    let visibleCities = 0;
    let visiblePirateBases = 0;
    let livePlayers = 0;
    for (const u of state.units.values()) if (inView(u.x || 0, u.y || 0)) visibleUnits++;
    for (const t of state.turrets.values()) if (t && t.hp > 0 && inView(t.x || 0, t.y || 0)) visibleTurrets++;
    for (const b of state.bullets) {
      const bx = b.x || b.fromX || 0;
      const by = b.y || b.fromY || 0;
      if (inView(bx, by)) visibleBullets++;
    }
    for (const r of state.res.values()) if (inView(r.x || 0, r.y || 0)) visibleRes++;
    for (const mine of state.mines.values()) if (inView(mine.x || 0, mine.y || 0)) visibleMines++;
    for (const gem of state.mineGems || []) if (gem && gem.alive && inView(gem.x || 0, gem.y || 0)) visibleMineGems++;
    for (const p of state.players.values()) {
      if (p && !p.eliminated && p.id > 0) livePlayers++;
      if (p && !p.eliminated && inView(p.x || 0, p.y || 0)) visibleCities++;
    }
    for (const pb of state.pirateBases || []) {
      if (pb && pb.hp > 0 && inView(pb.x || 0, pb.y || 0)) visiblePirateBases++;
    }

    const sortedSteps = Object.keys(perfStepAcc)
      .filter(k => perfStepAcc[k] > 0)
      .sort((a, b) => perfStepAcc[b] - perfStepAcc[a]);
    const stepStr = sortedSteps
      .map(k => k + "=" + (perfStepAcc[k] / 1000).toFixed(2) + "s")
      .join(" ");
    const renderTime = (perfStepAcc.visuals || 0) + (perfStepAcc.zones || 0);
    const totalStepTime = sortedSteps.reduce((sum, key) => sum + (perfStepAcc[key] || 0), 0);
    const simTime = Math.max(0, totalStepTime - renderTime);
    const hotspot = sortedSteps.length ? sortedSteps[0] : "—";
    const approxFps = avg > 0 ? Math.round(1000 / Math.max(0.001, avg)) : 0;
    const overBudgetMs = avg - PERF_TARGET_30_MS;
    const budgetState = overBudgetMs > 0 ? ("+" + overBudgetMs.toFixed(1) + "ms over") : (Math.abs(overBudgetMs).toFixed(1) + "ms headroom");
    const bottleneck = renderTime >= simTime ? "render" : "sim";
    const pktSamples = state._netPacketStats && Array.isArray(state._netPacketStats.samples)
      ? state._netPacketStats.samples.slice(-30)
      : [];
    const avgPacketBytes = pktSamples.length > 0
      ? Math.round(pktSamples.reduce((sum, sample) => sum + (sample.size || 0), 0) / pktSamples.length)
      : 0;
    state.perfStats = {
      avgFrameMs: avg,
      maxFrameMs: max,
      units,
      bullets,
      floating,
      resources: res,
      zoom,
      visibleUnits,
      visibleTurrets,
      visibleBullets,
      visibleResources: visibleRes,
      visibleMines,
      visibleMineGems,
      visibleCities,
      visiblePirateBases,
      mineFlowPackets: (state.mineFlowPackets || []).length,
      squads: state.squads ? state.squads.size : 0,
      engagementZones: state.engagementZones ? state.engagementZones.size : 0,
      avgPacketBytes,
      samples: n,
      at: state.t
    };
    perfStepAcc = {};

    const line = `[perf] t=${(state.t / 60).toFixed(1)}min | frame avg=${(avg).toFixed(1)}ms max=${(max).toFixed(0)}ms | units=${units} bullets=${bullets} floatDmg=${floating} res=${res} heap=${mem} | ${stepStr || "—"}`;
    const sceneLine = `[perf:scene] zoom=${zoom.toFixed(3)} screen=${app.screen.width}x${app.screen.height} vp=${Math.round(viewportW)}x${Math.round(viewportH)} zones=${state.zonesEnabled ? "on" : "off"} players=${livePlayers}/${state.players.size} squads=${state.squads ? state.squads.size : 0} fights=${state.engagementZones ? state.engagementZones.size : 0} packets=${(state.mineFlowPackets || []).length} | visible units=${visibleUnits} turrets=${visibleTurrets} bullets=${visibleBullets} res=${visibleRes} mineGems=${visibleMineGems} mines=${visibleMines} cities=${visibleCities} pirateBases=${visiblePirateBases}`;
    const goalLine = `[perf:goal30] fps≈${approxFps} target=30 ${budgetState} | bottleneck=${bottleneck} hotspot=${hotspot} render=${(renderTime / 1000).toFixed(2)}s sim=${(simTime / 1000).toFixed(2)}s`;
    state.perfLog.push(line);
    if (state.perfLog.length > 50) state.perfLog.shift();
    console.log(line);
    console.log(sceneLine);
    console.log(goalLine);

    const perfEl = document.getElementById("perfLog");
    if (perfEl) {
      perfEl.textContent = state.perfLog.slice(-5).join("\n");
      perfEl.title = "Лог производительности. Консоль (F12) — полная история.";
    }
  }

  function makePlayer(id, name, x, y, popStart) {
    const player = requireSharedMatchBootstrapApi().makePlayer(id, name, x, y, popStart);
    const terrain = getTerrainType(x, y);
    player.waterBonus = terrain === "deepWater" || terrain === "shallowWater";
    return player;
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
  const CARD_RARITY_PINS = {
    common: "C", uncommon: "U", rare: "R",
    epic: "E", legendary: "L", mythic: "M"
  };
  const UNIT_ATK_RANGE_MAX_MUL = 3.0;

  const CARD_DEFS = [
    { id: "c1", name: "Плазменная броня", desc: "+8% HP кораблей", rarity: "common", emoji: "🛡️", unitHpMul: 1.08 },
    { id: "c2", name: "Усиленные лазеры", desc: "+8% урон кораблей", rarity: "common", emoji: "🔫", unitDmgMul: 1.08 },
    { id: "c3", name: "Частотный модулятор", desc: "+7% скорострельность", rarity: "common", emoji: "⚡", unitAtkRateMul: 1.07 },
    { id: "c4", name: "Форсаж двигателей", desc: "+7% скорость кораблей", rarity: "common", emoji: "🚀", unitSpeedMul: 1.07 },
    { id: "c5", name: "Перезарядка ядра", desc: "+7% прирост Энергии", rarity: "common", emoji: "⚡", growthMul: 1.07 },
    { id: "c6", name: "Сканер дальности", desc: "+8% дальность атаки", rarity: "common", emoji: "📡", unitAtkRangeMul: 1.08 },
    { id: "c7", name: "Усиление турелей", desc: "+10% HP турелей", rarity: "common", emoji: "🏗️", turretHpMul: 1.10 },
    { id: "c8", name: "Точные орудия", desc: "+10% урон турелей", rarity: "common", emoji: "🎯", turretDmgMul: 1.10 },
    { id: "c9", name: "Экспансия", desc: "+5% скорость зоны влияния", rarity: "common", emoji: "🌐", influenceSpeedMul: 1.05 },
    { id: "c10", name: "Оптимизация добычи", desc: "+10% к добыче шахт", rarity: "common", emoji: "⛏️", mineYieldBonus: 10 },
    { id: "c11", name: "Экономия ресурсов", desc: "-5% стоимость кораблей", rarity: "common", emoji: "💰", unitCostMul: 0.95 },

    { id: "u1", name: "Титановый корпус", desc: "+12% HP кораблей", rarity: "uncommon", emoji: "🛡️", unitHpMul: 1.12 },
    { id: "u2", name: "Фокусированные лазеры", desc: "+12% урон кораблей", rarity: "uncommon", emoji: "🔫", unitDmgMul: 1.12 },
    { id: "u3", name: "Разгон орудий", desc: "+10% скорострельность", rarity: "uncommon", emoji: "⚡", unitAtkRateMul: 1.10 },
    { id: "u4", name: "Ионные двигатели", desc: "+10% скорость кораблей", rarity: "uncommon", emoji: "🚀", unitSpeedMul: 1.10 },
    { id: "u5", name: "Энергоразгон", desc: "+12% прирост Энергии", rarity: "uncommon", emoji: "⚡", growthMul: 1.12 },
    { id: "u6", name: "Дальний радар", desc: "+12% дальность атаки", rarity: "uncommon", emoji: "📡", unitAtkRangeMul: 1.12 },
    { id: "u7", name: "Укреплённые турели", desc: "+18% HP турелей", rarity: "uncommon", emoji: "🏗️", turretHpMul: 1.18 },
    { id: "u8", name: "Тяжёлые орудия", desc: "+15% урон турелей", rarity: "uncommon", emoji: "🎯", turretDmgMul: 1.15 },
    { id: "u9", name: "Терраформирование", desc: "+10% скорость зоны", rarity: "uncommon", emoji: "🌐", influenceSpeedMul: 1.10 },
    { id: "u10", name: "Улучшенная добыча", desc: "+20% к добыче шахт", rarity: "uncommon", emoji: "⛏️", mineYieldBonus: 20 },
    { id: "u11", name: "Оптовые закупки", desc: "-8% стоимость кораблей", rarity: "uncommon", emoji: "💰", unitCostMul: 0.92 },

    { id: "r1", name: "Нанокомпозит", desc: "+18% HP кораблей", rarity: "rare", emoji: "🛡️", unitHpMul: 1.18 },
    { id: "r2", name: "Плазменные пушки", desc: "+18% урон кораблей", rarity: "rare", emoji: "🔫", unitDmgMul: 1.18 },
    { id: "r3", name: "Ускоритель частиц", desc: "+15% скорострельность", rarity: "rare", emoji: "⚡", unitAtkRateMul: 1.15 },
    { id: "r4", name: "Варп-двигатель", desc: "+15% скорость кораблей", rarity: "rare", emoji: "🚀", unitSpeedMul: 1.15 },
    { id: "r5", name: "Энергоядро", desc: "+18% прирост Энергии", rarity: "rare", emoji: "⚡", growthMul: 1.18 },
    { id: "r6", name: "Телескоп", desc: "+18% дальность атаки", rarity: "rare", emoji: "📡", unitAtkRangeMul: 1.18 },
    { id: "r7", name: "Бастион", desc: "+20% HP, +10% радиус турелей", rarity: "rare", emoji: "🏗️", turretHpMul: 1.20, turretRangeMul: 1.10 },
    { id: "r8", name: "Артиллерийские турели", desc: "+20% урон турелей", rarity: "rare", emoji: "🎯", turretDmgMul: 1.20 },
    { id: "r9", name: "Империя", desc: "+18% скорость зоны", rarity: "rare", emoji: "🌐", influenceSpeedMul: 1.18 },
    { id: "r10", name: "Глубокое бурение", desc: "+30% к добыче шахт", rarity: "rare", emoji: "⛏️", mineYieldBonus: 30 },
    { id: "r11", name: "Военный контракт", desc: "-12% стоимость кораблей", rarity: "rare", emoji: "💰", unitCostMul: 0.88 },
    { id: "r12", name: "Дальнобойные турели", desc: "+15% радиус турелей", rarity: "rare", emoji: "📡", turretRangeMul: 1.15 },

    { id: "e1", name: "Квантовая броня", desc: "+25% HP кораблей", rarity: "epic", emoji: "🛡️", unitHpMul: 1.25 },
    { id: "e2", name: "Дезинтеграторы", desc: "+25% урон кораблей", rarity: "epic", emoji: "🔫", unitDmgMul: 1.25 },
    { id: "e3", name: "Гиперзалп", desc: "+22% скорострельность", rarity: "epic", emoji: "⚡", unitAtkRateMul: 1.22 },
    { id: "e4", name: "Гипердрайв", desc: "+22% скорость кораблей", rarity: "epic", emoji: "🚀", unitSpeedMul: 1.22 },
    { id: "e5", name: "Перегрузка ядра", desc: "+25% прирост Энергии", rarity: "epic", emoji: "⚡", growthMul: 1.25 },
    { id: "e6", name: "Система наведения", desc: "+25% дальность атаки", rarity: "epic", emoji: "📡", unitAtkRangeMul: 1.25 },
    { id: "e7", name: "Суперфорт", desc: "+30% урон и HP турелей", rarity: "epic", emoji: "🏗️", turretDmgMul: 1.30, turretHpMul: 1.20 },
    { id: "e8", name: "Доминирование", desc: "+30% скорость зоны", rarity: "epic", emoji: "🌐", influenceSpeedMul: 1.30 },
    { id: "e9", name: "Мульти-прицел", desc: "Каждый патрульный стреляет по +1 цели", rarity: "epic", emoji: "🎯", turretTargetBonus: 1 },
    { id: "e10", name: "Промышленная революция", desc: "-18% стоимость кораблей", rarity: "epic", emoji: "💰", unitCostMul: 0.82 },

    { id: "L1", name: "Нейтронный корпус", desc: "+40% HP кораблей", rarity: "legendary", emoji: "🛡️", unitHpMul: 1.40 },
    { id: "L2", name: "Аннигиляторы", desc: "+40% урон кораблей", rarity: "legendary", emoji: "🔫", unitDmgMul: 1.40 },
    { id: "L3", name: "Тахионный залп", desc: "+35% скорострельность", rarity: "legendary", emoji: "⚡", unitAtkRateMul: 1.35 },
    { id: "L4", name: "Скорость света", desc: "+35% скорость кораблей", rarity: "legendary", emoji: "🚀", unitSpeedMul: 1.35 },
    { id: "L5", name: "Сверхзаряд ядра", desc: "+40% прирост Энергии", rarity: "legendary", emoji: "⚡", growthMul: 1.40 },
    { id: "L6", name: "Всевидящее око", desc: "+40% дальность атаки", rarity: "legendary", emoji: "📡", unitAtkRangeMul: 1.40 },
    { id: "L7", name: "Крепость богов", desc: "+50% HP, +25% радиус турелей", rarity: "legendary", emoji: "🏗️", turretHpMul: 1.50, turretRangeMul: 1.25 },
    { id: "L8", name: "Абсолютная экспансия", desc: "+45% скорость зоны", rarity: "legendary", emoji: "🌐", influenceSpeedMul: 1.45 },
    { id: "L9", name: "Мульти-залп", desc: "Каждый патрульный стреляет по +2 целям", rarity: "legendary", emoji: "🎯", turretTargetBonus: 2 },
    { id: "L10", name: "Нулевая стоимость", desc: "-30% стоимость кораблей", rarity: "legendary", emoji: "💰", unitCostMul: 0.70 },
    { id: "L11", name: "Абсолютно легендарный щит", desc: "+0.5 реген щита/с, +100 Энергии", rarity: "legendary", emoji: "🛡️", shieldRegenBonus: 0.5, populationBonus: 100, maxPicks: 3 },
    { id: "P1", name: "Патрульный", desc: "Патруль по границе зоны. Мультизалп, малый радиус, несколько целей. Получает апгрейды от турелей. Макс. 4", rarity: "legendary", emoji: "🔦", patrolBonus: 1, maxPicks: 4 },

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
    if (card.turretTargetBonus) return "turretTarget";
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
    if (card.turretTargetBonus) {
      p.turretTargetBonus = (p.turretTargetBonus || 0) + card.turretTargetBonus;
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

  const LEGACY_CARD_MULTIPLIER_FIELDS = [
    "unitHpMul", "unitDmgMul", "unitAtkRateMul", "unitSpeedMul", "unitAtkRangeMul",
    "growthMul", "influenceSpeedMul", "turretHpMul", "turretDmgMul", "turretRangeMul", "unitCostMul"
  ];

  function ensurePlayerCardState(p) {
    return CardSystemApi && CardSystemApi.ensurePlayerCardState ? CardSystemApi.ensurePlayerCardState(p) : p;
  }

  function getCardDefById(cardId) {
    return CardSystemApi && CardSystemApi.getCardDef ? CardSystemApi.getCardDef(cardId) : null;
  }

  function getAbilityDefById(abilityId) {
    return CardSystemApi && CardSystemApi.getAbilityDef ? CardSystemApi.getAbilityDef(abilityId) : null;
  }

  function cloneCardStateValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function getCardStatePayloadForPlayer(pid) {
    const p = state.players.get(pid);
    if (!p) return null;
    ensurePlayerCardState(p);
    return {
      pid,
      buffHand: cloneCardStateValue(p.buffHand),
      abilityHand: cloneCardStateValue(p.abilityHand),
      activeBuffs: cloneCardStateValue(p.activeBuffs),
      legendaryBuffs: cloneCardStateValue(p.legendaryBuffs),
      nextCardInstanceId: p.nextCardInstanceId || 1,
      cardStateVersion: p.cardStateVersion || 0
    };
  }

  function emitCardStateForPlayer(pid) {
    if (!state._multiIsHost || !state._roomId) return;
    const payload = getCardStatePayloadForPlayer(pid);
    if (payload) sendCardState(payload);
  }

  function markPlayerCardStateDirty(p, shouldBroadcast) {
    if (!p) return;
    ensurePlayerCardState(p);
    p._cardDerivedDirty = true;
    if (shouldBroadcast !== false) emitCardStateForPlayer(p.id);
  }

  function applyIncomingCardState(payload) {
    if (!payload || payload.pid == null) return;
    const p = state.players.get(payload.pid);
    if (!p) {
      state._pendingCardStatePayloads = state._pendingCardStatePayloads || new Map();
      state._pendingCardStatePayloads.set(payload.pid, cloneCardStateValue(payload));
      return;
    }
    ensurePlayerCardState(p);
    if (payload.buffHand) p.buffHand = cloneCardStateValue(payload.buffHand);
    if (payload.abilityHand) p.abilityHand = cloneCardStateValue(payload.abilityHand);
    if (payload.activeBuffs) p.activeBuffs = cloneCardStateValue(payload.activeBuffs);
    if (payload.legendaryBuffs) p.legendaryBuffs = cloneCardStateValue(payload.legendaryBuffs);
    if (payload.nextCardInstanceId != null) p.nextCardInstanceId = payload.nextCardInstanceId;
    if (payload.cardStateVersion != null) p.cardStateVersion = payload.cardStateVersion;
    p._cardDerivedDirty = true;
  }

  function flushPendingCardStates() {
    const pending = state._pendingCardStatePayloads;
    if (!pending || pending.size === 0) return;
    for (const [pid, payload] of pending.entries()) {
      if (state.players.has(pid)) {
        applyIncomingCardState(payload);
        pending.delete(pid);
      }
    }
  }

  function getAllAppliedCardEntries(p) {
    ensurePlayerCardState(p);
    return [...(p.activeBuffs || []), ...(p.legendaryBuffs || [])];
  }

  function recomputePlayerCardDerivedStats(p) {
    if (!p) return;
    ensurePlayerCardState(p);
    const prevPatrolCount = p._patrolCount || 1;
    const prevRange = p.unitAtkRangeMul || 1;
    const prevUnitHp = p.unitHpMul || 1;

    for (const key of LEGACY_CARD_MULTIPLIER_FIELDS) {
      p[key] = key === "unitCostMul" ? 1 : 1;
    }
    p.mineYieldBonus = p._botMineYieldBonusPct || 0;
    p.turretTargetBonus = 0;
    p.shieldRegenBonus = 0;
    p.attackEffects = {};
    p.attackEffect = null;
    p._patrolCount = 1;

    for (const entry of getAllAppliedCardEntries(p)) {
      const def = getCardDefById(entry.cardId);
      if (!def) continue;
      if (def.mineYieldBonus) p.mineYieldBonus += def.mineYieldBonus;
      if (def.turretTargetBonus) p.turretTargetBonus += def.turretTargetBonus;
      if (def.shieldRegenBonus) p.shieldRegenBonus += def.shieldRegenBonus;
      if (def.patrolBonus) p._patrolCount = Math.min(4, p._patrolCount + def.patrolBonus);
      if (def.attackEffect) {
        p.attackEffects[def.attackEffect] = Math.min(3, (p.attackEffects[def.attackEffect] || 0) + 1);
      }
      for (const field of LEGACY_CARD_MULTIPLIER_FIELDS) {
        if (typeof def[field] !== "number") continue;
        if (field === "unitAtkRangeMul") p[field] = Math.min(UNIT_ATK_RANGE_MAX_MUL, (p[field] || 1) * def[field]);
        else p[field] = (p[field] || 1) * def[field];
      }
    }

    const attackEffectEntries = Object.entries(p.attackEffects);
    p.attackEffect = attackEffectEntries.length > 0 ? attackEffectEntries[attackEffectEntries.length - 1][0] : null;

    p._patrols = p._patrols || [];
    while (p._patrols.length < p._patrolCount) p._patrols.push({ t: p._patrols.length / Math.max(1, p._patrolCount), atkCd: 0 });
    while (p._patrols.length > p._patrolCount) p._patrols.pop();

    p._cardDerivedDirty = false;

    if (prevPatrolCount !== p._patrolCount || prevRange !== p.unitAtkRangeMul || prevUnitHp !== p.unitHpMul) {
      syncUnitsForPlayerCardStats(p.id);
    }
  }

  function syncUnitsForPlayerCardStats(ownerId) {
    const p = state.players.get(ownerId);
    if (!p) return;
    const hpMul = (p.unitHpMul != null ? p.unitHpMul : 1) * getLevelBonusMul(p);
    for (const u of state.units.values()) {
      if (u.owner !== ownerId) continue;
      if (u.baseMaxHp == null) u.baseMaxHp = UNIT_TYPES[u.unitType]?.hp || u.maxHp || u.hp || 1;
      if (u.baseDamage == null) u.baseDamage = UNIT_TYPES[u.unitType]?.damage || u.dmg || 1;
      if (u.baseAttackRate == null) u.baseAttackRate = UNIT_TYPES[u.unitType]?.attackRate || 1;
      if (u.baseAttackRange == null) u.baseAttackRange = UNIT_TYPES[u.unitType]?.attackRange || u.attackRange || 40;
      if (u.baseSpeed == null) u.baseSpeed = UNIT_TYPES[u.unitType]?.speed || u.speed || 9;
      const prevMax = Math.max(1, u.maxHp || u.baseMaxHp);
      const nextMax = Math.max(1, Math.round(u.baseMaxHp * hpMul));
      if (prevMax !== nextMax) {
        const ratio = prevMax > 0 ? (u.hp || prevMax) / prevMax : 1;
        u.maxHp = nextMax;
        u.hp = Math.max(0, Math.min(nextMax, ratio * nextMax));
      } else {
        u.maxHp = nextMax;
      }
      u.dmg = u.baseDamage;
      u.attackRange = u.baseAttackRange;
      u.speed = u.baseSpeed;
    }
  }

  function stepPlayerCardStates() {
    if (!CardSystemApi) return;
    flushPendingCardStates();
    for (const p of state.players.values()) {
      ensurePlayerCardState(p);
      if (p._lastAppliedCardVersion !== p.cardStateVersion) {
        p._cardDerivedDirty = true;
        p._lastAppliedCardVersion = p.cardStateVersion;
      }
      const expired = CardSystemApi.expireTimedBuffs ? CardSystemApi.expireTimedBuffs(p, state.t) : false;
      if (expired) markPlayerCardStateDirty(p);
      if (p._cardDerivedDirty) recomputePlayerCardDerivedStats(p);
    }
  }

  function drawRandomCardForPlayer(p, sourceLabel) {
    if (!CardSystemApi || !p) return null;
    ensurePlayerCardState(p);
    const result = CardSystemApi.drawRandomCardForPlayer(p, { now: state.t, level: p.level || 1, rng: Math.random });
    if (!result || !result.ok) return null;
    markPlayerCardStateDirty(p);
    if (p.id === state.myPlayerId) {
      state._lastCardDrawInfo = {
        cardId: result.instance.cardId,
        source: sourceLabel || "level",
        at: state.t
      };
    }
    return result;
  }

  function grantLevelCardDrops(p, sourceLabel) {
    if (!p) return 0;
    let drops = 0;
    for (let i = 0; i < 2; i++) {
      if (drawRandomCardForPlayer(p, sourceLabel)) drops++;
    }
    if (Math.random() < 0.15 && drawRandomCardForPlayer(p, sourceLabel + ":bonus")) drops++;
    return drops;
  }

  function grantSpecificCardToPlayer(p, cardId, sourceLabel) {
    if (!p || !cardId) return null;
    ensurePlayerCardState(p);
    const def = getCardDefById(cardId);
    if (!def) return null;
    const handKey = def.zone === "ability" ? "abilityHand" : "buffHand";
    const handLimit = def.zone === "ability"
      ? (CardSystemApi ? CardSystemApi.ABILITY_HAND_LIMIT : 10)
      : (CardSystemApi ? CardSystemApi.BUFF_HAND_LIMIT : 30);
    const hand = p[handKey];
    if (!Array.isArray(hand)) return null;
    if (hand.length >= handLimit) {
      const burned = hand.shift();
      p.burnedCards = Array.isArray(p.burnedCards) ? p.burnedCards : [];
      p.burnedCards.push({ instanceId: burned.instanceId, cardId: burned.cardId, burnedAt: state.t });
      while (p.burnedCards.length > 12) p.burnedCards.shift();
    }
    const instance = {
      instanceId: "card_" + p.id + "_" + (p.nextCardInstanceId || 1),
      cardId: def.id,
      zone: def.zone,
      kind: def.kind,
      addedAt: state.t,
      originLevel: null,
      source: sourceLabel || "debug"
    };
    p.nextCardInstanceId = (p.nextCardInstanceId || 1) + 1;
    hand.push(instance);
    p.cardStateVersion = (p.cardStateVersion || 0) + 1;
    markPlayerCardStateDirty(p);
    return instance;
  }

  function activateBuffCardForPlayer(pid, instanceId, shouldBroadcast) {
    if (!CardSystemApi) return { ok: false, reason: "no_card_system" };
    const p = state.players.get(pid);
    if (!p) return { ok: false, reason: "no_player" };
    ensurePlayerCardState(p);
    const result = CardSystemApi.activateBuffCard(p, instanceId, state.t);
    if (!result || !result.ok) return result;
    const def = getCardDefById(result.entry.cardId);
    if (def && def.populationBonus) {
      p.popFloat = (p.popFloat || p.pop || 0) + def.populationBonus;
      p.pop = Math.floor(p.popFloat);
    }
    markPlayerCardStateDirty(p, shouldBroadcast);
    recomputePlayerCardDerivedStats(p);
    return result;
  }

  function consumeAbilityCardForPlayerLocal(pid, instanceId, shouldBroadcast) {
    if (!CardSystemApi) return { ok: false, reason: "no_card_system" };
    const p = state.players.get(pid);
    if (!p) return { ok: false, reason: "no_player" };
    ensurePlayerCardState(p);
    const result = CardSystemApi.consumeAbilityCard(p, instanceId);
    if (!result || !result.ok) return result;
    markPlayerCardStateDirty(p, shouldBroadcast);
    recomputePlayerCardDerivedStats(p);
    return result;
  }

  function getNearestEnemyPlayer(pid) {
    const p = state.players.get(pid);
    if (!p) return null;
    let nearest = null;
    let nearestD = Infinity;
    for (const other of state.players.values()) {
      if (other.id === pid || other.eliminated) continue;
      const d = Math.hypot(other.x - p.x, other.y - p.y);
      if (d < nearestD) {
        nearestD = d;
        nearest = other;
      }
    }
    return nearest;
  }

  function getNearestEnemyMine(pid) {
    const owner = state.players.get(pid);
    if (!owner) return null;
    let best = null;
    let bestD = Infinity;
    for (const mine of state.mines.values()) {
      if (!mine || mine.ownerId == null || mine.ownerId === pid) continue;
      const mineOwner = state.players.get(mine.ownerId);
      if (!mineOwner || mineOwner.eliminated) continue;
      const d = Math.hypot((mine.x || 0) - (owner.x || 0), (mine.y || 0) - (owner.y || 0));
      if (d < bestD) {
        bestD = d;
        best = mine;
      }
    }
    return best;
  }

  function getLaneRaidPointAgainstEnemy(pid, enemy) {
    if (!enemy) return null;
    const center = state.centerObjectives || {};
    const points = getLanePointsForPlayerFront(enemy, "center", {
      x: center.centerX || 0,
      y: center.centerY || 0
    });
    const sample = sampleLanePolylinePoint(points, 0.52);
    return sample ? { x: sample.x, y: sample.y } : null;
  }

  function getEnemyUnitsForBot(pid) {
    const units = [];
    for (const unit of state.units.values()) {
      if (!unit || unit.hp <= 0 || unit.owner === pid) continue;
      units.push(unit);
    }
    return units;
  }

  function getRichestEnemyPlayer(pid) {
    let best = null;
    let bestScore = -Infinity;
    for (const other of state.players.values()) {
      if (!other || other.id === pid || other.eliminated) continue;
      const score = (other.eCredits || 0) * 2 + (other.pop || 0) * 5 + ([...state.mines.values()].filter((mine) => mine.ownerId === other.id).length * 120);
      if (score > bestScore) {
        bestScore = score;
        best = other;
      }
    }
    return best;
  }

  function getBotBestClusterPoint(pid, radius, includeCities) {
    const enemyUnits = getEnemyUnitsForBot(pid);
    const candidates = [];
    for (const unit of enemyUnits) candidates.push({ x: unit.x, y: unit.y, cityId: null });
    if (includeCities) {
      for (const other of state.players.values()) {
        if (!other || other.id === pid || other.eliminated) continue;
        candidates.push({ x: other.x, y: other.y, cityId: other.id });
      }
    }
    if (!candidates.length) {
      const enemy = getNearestEnemyPlayer(pid);
      return enemy ? { x: enemy.x, y: enemy.y, score: 1, targetCityId: enemy.id } : null;
    }
    const r2 = radius * radius;
    let best = null;
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      let score = candidate.cityId != null ? 4 : 0;
      for (const unit of enemyUnits) {
        const dx = unit.x - candidate.x;
        const dy = unit.y - candidate.y;
        if (dx * dx + dy * dy > r2) continue;
        const type = UNIT_TYPES[unit.unitType || "fighter"] || UNIT_TYPES.destroyer;
        score += 1 + ((type.sizeMultiplier || 1) * 0.45) + ((type.cost || 0) / 250);
      }
      if (score > bestScore) {
        bestScore = score;
        best = { x: candidate.x, y: candidate.y, score, targetCityId: candidate.cityId };
      }
    }
    return best;
  }

  function getBotBestLineCast(pid, source, meteorRadius) {
    if (!source) return null;
    const candidates = [];
    for (const unit of getEnemyUnitsForBot(pid)) candidates.push({ x: unit.x, y: unit.y });
    for (const other of state.players.values()) {
      if (!other || other.id === pid || other.eliminated) continue;
      candidates.push({ x: other.x, y: other.y });
    }
    if (!candidates.length) return null;
    let best = null;
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      const hitUnits = collectMeteorPreviewUnitsOnSegment(source.x, source.y, candidate.x, candidate.y, meteorRadius, pid) || [];
      const score = hitUnits.reduce((sum, unit) => {
        const type = UNIT_TYPES[unit.unitType || "fighter"] || UNIT_TYPES.destroyer;
        return sum + 1 + ((type.sizeMultiplier || 1) * 0.5) + ((type.cost || 0) / 220);
      }, 0);
      if (score > bestScore) {
        bestScore = score;
        best = {
          x: candidate.x,
          y: candidate.y,
          angle: Math.atan2(candidate.y - source.y, candidate.x - source.x),
          score
        };
      }
    }
    return best;
  }

  function getBotAbilityPriority(pid, cardDef) {
    if (!cardDef || cardDef.kind !== "ability") return 0;
    const id = cardDef.abilityId;
    if (id === "resourceSurge" || id === "loan") return 100;
    if (id === "raiderCapture") return 96;
    if (id === "thermoNuke") return 95;
    if (id === "orbitalBarrage" || id === "meteorSwarm") return 92;
    if (id === "orbitalStrike" || id === "blackHole" || id === "gravAnchor") return 88;
    if (id === "microBlackHole" || id === "microAnchor" || id === "ionNebula" || id === "ionField") return 82;
    if (id === "minefield" || id === "minefieldLarge") return 76;
    return 70;
  }

  function buildBotAbilityAction(pid, cardDef) {
    const source = state.players.get(pid);
    const profile = getBotProfile(source);
    const target = getNearestEnemyPlayer(pid);
    const abilityDef = getAbilityDefById(cardDef.abilityId);
    if (!abilityDef) return null;
    const action = { pid, abilityId: abilityDef.id };
    if (shouldBotSkipAction(source, (profile.misplayChance || 0) * 0.45)) return null;
    if (abilityDef.id === "resourceSurge" || abilityDef.id === "loan" || abilityDef.targeting === "instant") {
      return action;
    }
    if (abilityDef.id === "resourceRaid") {
      const mine = getNearestEnemyMine(pid);
      if (!mine) return null;
      const jitter = shouldBotSkipAction(source, profile.misplayChance || 0) ? 90 : 16;
      action.x = mine.x + rand(-jitter, jitter);
      action.y = mine.y + rand(-jitter, jitter);
      return action;
    }
    if (abilityDef.id === "pirateRaid") {
      const raidPoint = getLaneRaidPointAgainstEnemy(pid, target);
      if (!raidPoint) return null;
      const jitter = shouldBotSkipAction(source, profile.misplayChance || 0) ? 140 : 24;
      action.x = raidPoint.x + rand(-jitter, jitter);
      action.y = raidPoint.y + rand(-jitter, jitter);
      return action;
    }
    if (abilityDef.id === "raiderCapture") {
      const richest = getRichestEnemyPlayer(pid) || target;
      if (!richest) return null;
      action.targetCityId = richest.id;
      return action;
    }
    if (abilityDef.targeting === "city") {
      if (!target) return null;
      action.targetCityId = target.id;
      return action;
    }
    if (abilityDef.targeting === "point") {
      const radiusByAbility = {
        ionField: 170,
        ionNebula: 190,
        microBlackHole: 140,
        blackHole: 240,
        microAnchor: 160,
        gravAnchor: 230,
        orbitalStrike: 210,
        orbitalBarrage: 250,
        thermoNuke: 280,
        minefield: 150,
        minefieldLarge: 210
      };
      const cluster = getBotBestClusterPoint(pid, radiusByAbility[abilityDef.id] || 180, true);
      const jitter = shouldBotSkipAction(source, profile.misplayChance || 0) ? 150 : 18;
      action.x = ((cluster && cluster.x) || (target ? target.x : (source?.x || 0))) + rand(-jitter, jitter);
      action.y = ((cluster && cluster.y) || (target ? target.y : (source?.y || 0))) + rand(-jitter, jitter);
      return action;
    }
    if (abilityDef.targeting === "angle") {
      const line = getBotBestLineCast(pid, source, abilityDef.id === "meteorSwarm" ? 92 : 76);
      const tx = line ? line.x : (target ? target.x : (source?.x || 0) + 100);
      const ty = line ? line.y : (target ? target.y : (source?.y || 0));
      action.x = tx;
      action.y = ty;
      action.angle = line ? line.angle : (source ? Math.atan2(ty - source.y, tx - source.x) : 0);
      return action;
    }
    return action;
  }

  function castAbilityCardForPlayer(action) {
    if (!CardSystemApi || !action || action.pid == null || !action.instanceId) return { ok: false, reason: "bad_action" };
    const p = state.players.get(action.pid);
    if (!p) return { ok: false, reason: "no_player" };
    ensurePlayerCardState(p);
    const result = CardSystemApi.consumeAbilityCard(p, action.instanceId);
    if (!result || !result.ok) return result;
    const cardDef = getCardDefById(result.entry.cardId);
    if (!cardDef || cardDef.kind !== "ability") return { ok: false, reason: "wrong_type" };
    const abilityAction = {
      pid: action.pid,
      abilityId: cardDef.abilityId,
      x: action.x,
      y: action.y,
      angle: action.angle,
      targetCityId: action.targetCityId,
      frontType: action.frontType
    };
    markPlayerCardStateDirty(p, action.shouldBroadcast);
    executeAbilityAction(abilityAction);
    return { ok: true, cardDef, action: abilityAction };
  }

  function autoPlayBotCardHands(p) {
    if (!p || !state.botPlayerIds || !state.botPlayerIds.has(p.id)) return;
    const profile = getBotProfile(p);
    ensurePlayerCardState(p);
    while (p.buffHand.length > 0 && Math.random() <= (profile.buffAutoPlayChance || 1)) {
      const nextBuff = p.buffHand[0];
      if (!nextBuff) break;
      const activated = activateBuffCardForPlayer(p.id, nextBuff.instanceId);
      if (!activated || !activated.ok) break;
    }
    let castAttempts = 0;
    const castLimit = Math.max(1, profile.maxAbilityCastsPerTick || 2);
    while (p.abilityHand.length > 0 && castAttempts < castLimit) {
      if (Math.random() > (profile.abilityCastChance || 1)) break;
      let castedAny = false;
      const handSnapshot = [...p.abilityHand].sort((a, b) => {
        const defA = a ? getCardDefById(a.cardId) : null;
        const defB = b ? getCardDefById(b.cardId) : null;
        return getBotAbilityPriority(p.id, defB) - getBotAbilityPriority(p.id, defA);
      });
      for (const nextAbility of handSnapshot) {
        const cardDef = nextAbility ? getCardDefById(nextAbility.cardId) : null;
        const action = cardDef ? buildBotAbilityAction(p.id, cardDef) : null;
        if (!action) continue;
        const casted = castAbilityCardForPlayer({
          pid: p.id,
          instanceId: nextAbility.instanceId,
          x: action.x,
          y: action.y,
          angle: action.angle,
          targetCityId: action.targetCityId,
          shouldBroadcast: false
        });
        if (casted && casted.ok) {
          castedAny = true;
          break;
        }
      }
      if (!castedAny) break;
      castAttempts++;
    }
    emitCardStateForPlayer(p.id);
  }

  // ------------------------------------------------------------
  // Visual builders
  // ------------------------------------------------------------
  function makeCityVisual(p) {
    const R = getPlanetRadius(p);
    const city = new PIXI.Graphics();
    const palette = FACTION_VIS.getFactionPalette(p.color);
    const haloR = R * 1.85;
    const shellR = R * 0.96;
    const coreR = R * 0.54;

    city.beginFill(palette.glow || p.color, 0.08);
    city.drawCircle(0, 0, haloR);
    city.endFill();

    city.beginFill(0x050912, 0.92);
    city.drawCircle(0, 0, shellR);
    city.endFill();

    city.lineStyle(1.4, palette.edge, 0.30);
    city.drawCircle(0, 0, shellR);

    city.beginFill(palette.core, 0.16);
    city.drawCircle(0, 0, R * 0.74);
    city.endFill();

    city.beginFill(palette.core, 0.34);
    city.drawCircle(0, 0, coreR);
    city.endFill();

    city.lineStyle(1.1, palette.solid, 0.48);
    city.drawCircle(0, 0, coreR);

    city.beginFill(palette.core, 0.58);
    city.drawCircle(0, 0, R * 0.24);
    city.endFill();

    city.beginFill(0xffffff, 0.82);
    city.drawCircle(0, 0, R * 0.10);
    city.endFill();

    city.lineStyle(0.9, palette.edge, 0.20);
    city.drawCircle(0, 0, R * 0.42);
    city.lineStyle(0.7, palette.edge, 0.14);
    city.drawCircle(0, 0, R * 0.60);

    city.beginFill(0xffffff, 0.18);
    city.drawCircle(-R * 0.10, -R * 0.12, R * 0.18);
    city.endFill();

    const glow = makeGlow(palette.core, 28, 2.2);
    if (glow) city.filters = [glow];
    city.position.set(p.x, p.y);

    const orbitalRings = new PIXI.Graphics();
    const orbitDetail = LOD.getDetail("base", cam.zoom);
    const ringCount = orbitDetail.rings || 2;
    const ringRadii = [R * 1.08, R * 1.34];
    for (let ri = 0; ri < Math.min(ringCount, ringRadii.length); ri++) {
      orbitalRings.lineStyle(0.95, palette.edge, ri === 0 ? 0.22 : 0.16);
      orbitalRings.drawEllipse(0, 0, ringRadii[ri], ringRadii[ri] * 0.42);
    }
    orbitalRings.position.set(p.x, p.y);
    p._orbitalRings = orbitalRings;
    p._orbitalRingPhase = Math.random() * Math.PI * 2;

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

    cityLayer.addChild(orbitalRings, city, label, popLabel, shieldGfx);
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

  function getCoreCollisionRadius(p) {
    const planetR = getPlanetRadius(p);
    const baseInflR = CFG.INFLUENCE_BASE_R || 240;
    const curR = p && p.influenceR ? p.influenceR : baseInflR;
    const growth = Math.max(1, Math.min(2.5, curR / baseInflR));
    return planetR + Math.max(18, planetR * 0.42 + (growth - 1) * 8);
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
    const shell = new PIXI.Graphics();
    const light = new PIXI.Graphics();
    const patrolSpriteLayer = new PIXI.Container();

    zonesLayer.addChild(glow, g, shell);
    zoneEffectsLayer.addChild(light, patrolSpriteLayer);

    p.zoneGfx = g;
    p.zoneGlow = glow;
    p.zoneShellGfx = shell;
    p.zoneLightGfx = light;
    p._patrolSpriteLayer = patrolSpriteLayer;
    p._patrolSprites = [];
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

  const PATROL_LIGHT_SPEED = 0.018;
  const PATROL_ATTACK_R = 170;
  const PATROL_ATTACK_RATE = 1.2;
  const PATROL_DMG = 18;
  const PATROL_BASE_SHOTS = 2;

  function getTurretOrbitRadius(p) {
    const coreR = getCoreCollisionRadius(p);
    const planetR = getPlanetRadius(p);
    const base = coreR + Math.max(34, planetR * 1.72);
    const rangeMul = p && p.turretRangeMul != null ? p.turretRangeMul : 1;
    return base * (1 + Math.max(0, rangeMul - 1) * 0.65);
  }

  function getTurretOrbitState(p, t) {
    const phase = ((((t || 0) % 1) + 1) % 1) * Math.PI * 2 - Math.PI / 2;
    const orbitR = getTurretOrbitRadius(p);
    const nx = Math.cos(phase);
    const ny = Math.sin(phase);
    return {
      x: p.x + nx * orbitR,
      y: p.y + ny * orbitR,
      angle: phase + Math.PI / 2,
      orbitR,
      nx,
      ny
    };
  }

  function getPatrolOrbitState(p, t) {
    const phase = ((((t || 0) % 1) + 1) % 1) * Math.PI * 2 - Math.PI / 2;
    const orbitR = getTurretOrbitRadius(p) + Math.max(22, getPlanetRadius(p) * 1.02);
    return {
      x: p.x + Math.cos(phase) * orbitR,
      y: p.y + Math.sin(phase) * orbitR,
      angle: phase + Math.PI / 2,
      orbitR
    };
  }

  function ensurePatrolSpriteLayer(p) {
    if (p && p._patrolSpriteLayer && !p._patrolSpriteLayer.destroyed && p._patrolSpriteLayer.parent) return p._patrolSpriteLayer;
    const layer = new PIXI.Container();
    zoneEffectsLayer.addChild(layer);
    p._patrolSpriteLayer = layer;
    return layer;
  }

  function syncPatrolSpriteVisuals(p, patrolCount) {
    const list = p._patrolSprites = p._patrolSprites || [];
    if (!p._patrolSpriteLayer || p._patrolSpriteLayer.destroyed || !p._patrolSpriteLayer.parent) {
      list.length = 0;
    }
    const spriteReady = !!(window.DefenseRenderer && DefenseRenderer.isSpriteReady && DefenseRenderer.isSpriteReady("patrol"));
    if (!spriteReady) {
      while (list.length) {
        const visual = list.pop();
        try { DefenseRenderer.destroySpriteVisual(visual); } catch (_) {}
      }
      if (p._patrolSpriteLayer) p._patrolSpriteLayer.visible = false;
      return null;
    }
    const layer = ensurePatrolSpriteLayer(p);
    layer.visible = patrolCount > 0;
    while (list.length > patrolCount) {
      const visual = list.pop();
      try { DefenseRenderer.destroySpriteVisual(visual); } catch (_) {}
    }
    while (list.length < patrolCount) {
      const visual = DefenseRenderer.createSpriteVisual("patrol");
      if (!visual) break;
      layer.addChild(visual);
      list.push(visual);
    }
    return list;
  }

  function updateZoneLights(dt) {
    const patrolDetail = LOD.getDetail("patrol", cam.zoom);
    for (const p of state.players.values()) {
      const patrolCount = p._patrolCount || 0;
      const light = p.zoneLightGfx;
      if (!light || light.destroyed) continue;
      light.clear();
      const patrolSprites = syncPatrolSpriteVisuals(p, patrolCount);
      if (patrolSprites) {
        for (let i = 0; i < patrolSprites.length; i++) patrolSprites[i].visible = false;
      }
      if (patrolCount === 0 || !patrolDetail.shape) continue;
      if (p.color == null) continue;

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

        const head = getPatrolOrbitState(p, t);
        if (patrolDetail.trail) {
          const TAIL_STEPS = 4;
          const TAIL_COVER = 0.040;
          for (let i = TAIL_STEPS; i >= 1; i--) {
            const tailT = ((t - (i / TAIL_STEPS) * TAIL_COVER) + 2) % 1;
            const pt = getPatrolOrbitState(p, tailT);
            const progress = 1 - i / TAIL_STEPS;
            light.beginFill(p.color, progress * 0.14);
            light.drawCircle(pt.x, pt.y, 1.4 + progress * 2.8);
            light.endFill();
          }
        }
        if (patrolDetail.trail) {
          light.lineStyle(0.8, bright, 0.10);
          light.moveTo(p.x, p.y);
          light.lineTo(head.x, head.y);
        }
        const patrolSprite = patrolSprites && patrolSprites[idx] ? patrolSprites[idx] : null;
        const patrolVisible = pointInViewPad(head.x, head.y, 140);
        if (patrolSprite) {
          patrolSprite.visible = patrolVisible;
          if (patrolVisible) {
            DefenseRenderer.updatePatrolSpriteVisual(patrolSprite, {
              x: head.x,
              y: head.y,
              angle: head.angle,
              color: p.color,
              scale: 1,
              outlineAlpha: 0.22,
              lampAlpha: cam.zoom < 0.28 ? 0.32 : 0.58
            });
          }
        } else {
          DefenseRenderer.drawPatrolShape(light, head.x, head.y, head.angle, p.color, cam.zoom);
        }
      }
    }
  }

  // Glow at zone contact points — where two players' borders meet
  const _contactPulse = { t: 0 };
  function updateZoneContacts(dt) {
    contactGfx.clear();
    if (LOD.getLevel(cam.zoom) !== LOD.LEVELS.NEAR) return;

    _contactPulse.t += dt;
    const pulse = 0.55 + 0.45 * Math.sin(_contactPulse.t * Math.PI * 2.5);

    const players = [];
    for (const p of state.players.values()) {
      if (p.influencePolygon && p.influencePolygon.length >= 3 && p.color != null) players.push(p);
    }
    if (players.length < 2) return;

    const THRESHOLD = 42;
    const GLOW_R    = 10;

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
              contactGfx.beginFill(A.color, 0.16 * str);
              contactGfx.drawCircle(pa.x, pa.y, GLOW_R);
              contactGfx.endFill();
              contactGfx.beginFill(B.color, 0.16 * str);
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
    const zoneRadius = (p && p.influenceR) || (CFG.INFLUENCE_BASE_R || 240);
    const visible = rectInView((p.x || 0) - zoneRadius, (p.y || 0) - zoneRadius, (p.x || 0) + zoneRadius, (p.y || 0) + zoneRadius, 140);
    if (p.zoneGfx) p.zoneGfx.visible = visible;
    if (p.zoneGlow) p.zoneGlow.visible = visible;
    if (p.zoneShellGfx) p.zoneShellGfx.visible = visible;
    if (!visible) return;
    const zoom = cam.zoom || CFG.CAMERA_START_ZOOM || 0.22;
    if (state._zoneRenderPlayersCacheFrame !== state._frameCtr) {
      state._zoneRenderPlayersCacheFrame = state._frameCtr;
      state._zoneRenderPlayersCache = [...state.players.values()];
    }
    ZoneRenderer.redraw(p, {
      INFLUENCE_ARMY_MARGIN: CFG.INFLUENCE_ARMY_MARGIN,
      zoom,
      time: state.t,
      players: state._zoneRenderPlayersCache || []
    });
  }

  // ------------------------------------------------------------
  // Border Turrets
  // ------------------------------------------------------------
  function rebuildTurrets(p) {
    const turretCount = 6;
    p._fixedTurretCount = turretCount;
    const turretHpMul = (p.turretHpMul != null ? p.turretHpMul : 1) * getLevelBonusMul(p);
    const maxHp = Math.max(1, Math.round(p.pop * (CFG.TURRET_HP_RATIO ?? 0.1) * turretHpMul));

    const oldTurrets = [];
    for (const tid of (p.turretIds || [])) {
      const t = state.turrets.get(tid);
      if (t) oldTurrets.push(t);
    }
    oldTurrets.sort((a, b) => (a.orbitSlot ?? 0) - (b.orbitSlot ?? 0));

    const newPositions = [];
    for (let i = 0; i < turretCount; i++) {
      const orbitT = i / turretCount;
      const orbit = getTurretOrbitState(p, orbitT + state.t * 0.012);
      newPositions.push({ x: orbit.x, y: orbit.y, nx: orbit.nx, ny: orbit.ny, orbitSlot: i, orbitT });
    }

    const newTurretIds = [];
    const reused = new Set();
    for (const pos of newPositions) {
      let t = oldTurrets.find(ot => !reused.has(ot.id) && (ot.orbitSlot ?? -1) === pos.orbitSlot);
      if (!t) t = oldTurrets.find(ot => !reused.has(ot.id));
      if (t) {
        t.x = pos.x;
        t.y = pos.y;
        t.nx = pos.nx;
        t.ny = pos.ny;
        t.orbitSlot = pos.orbitSlot;
        t.orbitT = pos.orbitT;
        if (!t._diedAt) {
          t.maxHp = maxHp;
          if (t.hp > maxHp) t.hp = maxHp;
        }
        reused.add(t.id);
        newTurretIds.push(t.id);
      } else {
        const tid = state.nextTurretId++;
        const t = {
          id: tid,
          owner: p.id,
          x: pos.x,
          y: pos.y,
          nx: pos.nx,
          ny: pos.ny,
          orbitSlot: pos.orbitSlot,
          orbitT: pos.orbitT,
          hp: maxHp,
          maxHp,
          atkCd: 0,
          gfx: null,
          labelGfx: null,
          radiusGfx: null
        };
        state.turrets.set(tid, t);
        newTurretIds.push(tid);
      }
    }
    for (const t of oldTurrets) {
      if (!reused.has(t.id) && !t._diedAt) {
        if (t.gfx) {
          if (t.gfx.parent) t.gfx.parent.removeChild(t.gfx);
          try { t.gfx.destroy(getSafePixiDestroyOptions()); } catch (_) {}
        }
        if (t.labelGfx) {
          if (t.labelGfx.parent) t.labelGfx.parent.removeChild(t.labelGfx);
          try { t.labelGfx.destroy(); } catch (_) {}
        }
        if (t.radiusGfx) {
          if (t.radiusGfx.parent) t.radiusGfx.parent.removeChild(t.radiusGfx);
          try { t.radiusGfx.destroy(getSafePixiDestroyOptions()); } catch (_) {}
        }
        state.turrets.delete(t.id);
      }
    }
    p.turretIds = newTurretIds;
  }

  function syncTurretOrbit(t, p) {
    if (!t || !p) return;
    const orbitT = (t.orbitT != null ? t.orbitT : ((t.orbitSlot || 0) / Math.max(1, p._fixedTurretCount || 6))) + state.t * 0.012;
    const orbit = getTurretOrbitState(p, orbitT);
    t.x = orbit.x;
    t.y = orbit.y;
    if (!t._aimUntil || state.t > t._aimUntil) {
      t.nx = orbit.nx;
      t.ny = orbit.ny;
    }
  }

  function drawTurrets() {
    const turretSpriteReady = !!(window.DefenseRenderer && DefenseRenderer.isSpriteReady && DefenseRenderer.isSpriteReady("turret"));
    const useSimpleFarTurret = LOD.getLevel(cam.zoom || 0.22) === LOD.LEVELS.FAR;
    for (const t of state.turrets.values()) {
      const p = state.players.get(t.owner);
      if (!p) continue;
      syncTurretOrbit(t, p);
      const offScreen = !inView(t.x, t.y);
      if (offScreen) {
        if (t.gfx) t.gfx.visible = false;
        if (t.radiusGfx) t.radiusGfx.visible = false;
        if (t.labelGfx) t.labelGfx.visible = false;
        if (t._skullGfx) t._skullGfx.visible = false;
        if (t._respawnTxt) t._respawnTxt.visible = false;
        continue;
      }
      const color = p.color;
      const turretRangeMul = p.turretRangeMul != null ? p.turretRangeMul : 1;
      const radius = (CFG.TURRET_ATTACK_RADIUS ?? 45) * turretRangeMul * 1.6;
      const alive = t.hp > 0;
      const hovered = !!(state._hoverWorld && Math.hypot(state._hoverWorld.x - t.x, state._hoverWorld.y - t.y) <= 16);
      if (t.gfx) t.gfx.visible = alive;
      if (t.radiusGfx) t.radiusGfx.visible = alive && hovered;

      if (!t.radiusGfx) {
        t.radiusGfx = new PIXI.Graphics();
        turretLayer.addChild(t.radiusGfx);
      }
      t.radiusGfx.clear();
      if (hovered) DefenseRenderer.drawTurretRadius(t.radiusGfx, t.x, t.y, radius, color, cam.zoom);

      if (!t.gfx) {
        t.gfx = turretSpriteReady ? DefenseRenderer.createSpriteVisual("turret") : new PIXI.Graphics();
        if (t.gfx) turretLayer.addChild(t.gfx);
      }
      if (alive) {
        const hpScale = Math.max(1, Math.sqrt(Math.max(1, p.turretHpMul != null ? p.turretHpMul : 1)));
        const barrelMul = Math.max(1, p.turretDmgMul != null ? p.turretDmgMul : 1);
        if (turretSpriteReady && !useSimpleFarTurret) {
          if (!t.gfx || t.gfx._defenseSpriteKind !== "turret") {
            try {
              if (t.gfx && t.gfx.parent) t.gfx.parent.removeChild(t.gfx);
              if (t.gfx && t.gfx.destroy) t.gfx.destroy(getSafePixiDestroyOptions());
            } catch (_) {}
            t.gfx = DefenseRenderer.createSpriteVisual("turret");
            if (t.gfx) turretLayer.addChild(t.gfx);
          }
          if (t.gfx) {
            DefenseRenderer.updateTurretSpriteVisual(t.gfx, {
              x: t.x,
              y: t.y,
              nx: t.nx || 0,
              ny: t.ny || -1,
              color,
              scale: hpScale,
              outlineAlpha: hovered ? 0.28 : 0.20,
              lampAlpha: cam.zoom < 0.28 ? 0.30 : 0.56
            });
          }
        } else {
          if (!t.gfx || typeof t.gfx.clear !== "function") {
            try {
              if (t.gfx && t.gfx.parent) t.gfx.parent.removeChild(t.gfx);
              if (t.gfx && t.gfx.destroy) t.gfx.destroy(getSafePixiDestroyOptions());
            } catch (_) {}
            t.gfx = new PIXI.Graphics();
            turretLayer.addChild(t.gfx);
          }
          t.gfx.clear();
          DefenseRenderer.drawTurretShape(t.gfx, t.x, t.y, t.nx || 0, t.ny || -1, color, cam.zoom, {
            scale: hpScale,
            barrelMul
          });
        }
      } else {
        if (t.gfx && typeof t.gfx.clear === "function") t.gfx.clear();
        if (t.gfx) t.gfx.visible = true;
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
        t.labelGfx.visible = hovered;
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
        const remain = Math.max(0, Math.ceil(fromSimSeconds(toSimSeconds(60) - (state.t - t._diedAt))));
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
      syncTurretOrbit(t, p);
      t.atkCd -= dt;
      if (t.atkCd > 0) continue;

      const turretRangeMul = p.turretRangeMul != null ? p.turretRangeMul : 1;
      const range = (CFG.TURRET_ATTACK_RADIUS ?? 45) * turretRangeMul * 1.6;
      const range2 = range * range;
      const nearby = queryHash(t.x, t.y, range);
      const candidates = [];
      for (let i = 0; i < nearby.length; i++) {
        const u = nearby[i];
        if (u.owner === t.owner) continue;
        const d = (u.x - t.x) ** 2 + (u.y - t.y) ** 2;
        if (d <= range2) candidates.push({ target: u, d, isTurret: false });
      }
      for (const ot of state.turrets.values()) {
        if (ot.owner === t.owner || ot.hp <= 0) continue;
        const d = (ot.x - t.x) ** 2 + (ot.y - t.y) ** 2;
        if (d <= range2) candidates.push({ target: ot, d, isTurret: true });
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) => a.d - b.d);
        const shotCount = Math.min(candidates.length, 1);
        const turretDmgMul = (p.turretDmgMul != null ? p.turretDmgMul : 1) * getLevelBonusMul(p);
        const dmg = Math.max(1, Math.round((CFG.TURRET_ATTACK_DMG ?? 3) * turretDmgMul));
        t.atkCd = 1 / (CFG.TURRET_ATTACK_RATE ?? 1.2);
        for (let i = 0; i < shotCount; i++) {
          const entry = candidates[i];
          const bestTarget = entry.target;
          const bx = bestTarget.x;
          const by = bestTarget.y;
          const dx = bx - t.x;
          const dy = by - t.y;
          const dl = Math.hypot(dx, dy) || 1;
          t.nx = dx / dl;
          t.ny = dy / dl;
          t._aimUntil = state.t + 0.18;
          if (typeof playLaserSound === "function") playLaserSound(t.x, t.y, bx, by);
          state.bullets.push({
            type: "laser",
            fromX: t.x,
            fromY: t.y,
            toX: bx,
            toY: by,
            color: p.color,
            ownerId: t.owner,
            dmg,
            duration: 0.38,
            progress: 0,
            targetId: bestTarget.id,
            targetType: entry.isTurret ? "turret" : "unit",
            attackEffect: p ? p.attackEffect : null,
            attackEffects: p ? p.attackEffects : null
          });
        }
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
      if (t.hp <= 0 && t._diedAt && state.t - t._diedAt >= toSimSeconds(60)) {
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
      p._patrols = p._patrols || [];
      const rangeMul = p.turretRangeMul != null ? p.turretRangeMul : 1;
      const range = PATROL_ATTACK_R * rangeMul;
      const rate = PATROL_ATTACK_RATE;
      const dmgMul = (p.turretDmgMul != null ? p.turretDmgMul : 1) * getLevelBonusMul(p);
      const dmg = Math.max(1, Math.round(PATROL_DMG * dmgMul));
      const shotCount = PATROL_BASE_SHOTS + (p.turretTargetBonus || 0);
      for (const patrol of p._patrols) {
        patrol.t = ((patrol.t || 0) + dt * PATROL_LIGHT_SPEED) % 1;
        const pos = getPatrolOrbitState(p, patrol.t || 0);
        const nearby = queryHash(pos.x, pos.y, range);
        const enemies = nearby.filter(u => u.owner !== p.id);
        const hasEnemies = enemies.length > 0;
        patrol.atkCd = (patrol.atkCd || 0) - dt;
        if (patrol.atkCd > 0 || !hasEnemies) continue;
        enemies.sort((a, b) => (a.x - pos.x) ** 2 + (a.y - pos.y) ** 2 - ((b.x - pos.x) ** 2 + (b.y - pos.y) ** 2));
        const targets = enemies.slice(0, Math.max(1, shotCount));
        patrol.atkCd = 1 / rate;
        for (let shot = 0; shot < shotCount; shot++) {
          const tgt = targets[shot % targets.length];
          if (!tgt) continue;
          if (typeof playLaserSound === "function") playLaserSound(pos.x, pos.y, tgt.x, tgt.y);
          state.bullets.push({
            type: "laser",
            fromX: pos.x, fromY: pos.y, toX: tgt.x, toY: tgt.y,
            ownerId: p.id,
            dmg,
            color: p.color,
            duration: 0.38,
            progress: 0,
            targetId: tgt.id,
            targetType: "unit",
            attackEffect: p.attackEffect ?? null,
            attackEffects: p.attackEffects ?? null
          });
        }
      }
    }
  }

  function getAdaptiveShipRenderState() {
    if (state._shipRenderStateFrame === state._frameCtr && state._shipRenderStateCache) return state._shipRenderStateCache;
    const zoom = cam.zoom || CFG.CAMERA_START_ZOOM || 0.22;
    const unitCount = state.units ? state.units.size : 0;
    let effectiveZoom = zoom;
    if (unitCount >= 520 && zoom < 0.78) effectiveZoom = Math.min(zoom, 0.10);
    else if (unitCount >= 420 && zoom < 0.62) effectiveZoom = Math.min(zoom, 0.22);
    else if (unitCount >= 320 && zoom < 0.46) effectiveZoom = Math.min(zoom, 0.28);
    state._shipRenderStateFrame = state._frameCtr;
    state._shipRenderStateCache = {
      zoom: effectiveZoom,
      detail: LOD.getDetail("ship", effectiveZoom),
      level: LOD.getLevel(effectiveZoom)
    };
    return state._shipRenderStateCache;
  }

  function getAdaptiveShipRenderZoom() {
    return getAdaptiveShipRenderState().zoom;
  }

  function getAdaptiveShipVisualDetail() {
    return getAdaptiveShipRenderState().detail;
  }

  function getAdaptiveShipLodLevel() {
    return getAdaptiveShipRenderState().level;
  }

  function getShipVisualRedrawInterval(selected, hovered, flashing) {
    if (selected || hovered || flashing) return 1;
    const unitCount = state.units ? state.units.size : 0;
    if (unitCount >= 520) return 10;
    if (unitCount >= 420) return 8;
    if (unitCount >= 300) return 6;
    return 4;
  }

  function getUnitTurnRate(unitType) {
    if (unitType === "fighter") return 6.4;
    if (unitType === "destroyer") return 4.6;
    if (unitType === "cruiser") return 3.1;
    if (unitType === "battleship") return 2.25;
    if (unitType === "hyperDestroyer") return 1.8;
    return 3.8;
  }

  function getUnitVisualTurnRate(u, isLeader) {
    const base = getUnitTurnRate(u && u.unitType ? u.unitType : "destroyer");
    return base * (isLeader ? 1.16 : 1.0);
  }

  function getForwardTurnMoveScale(angleDiff) {
    const turnFrac = Math.min(1, Math.abs(angleDiff) / Math.PI);
    return Math.max(0.22, 1 - turnFrac * 0.78);
  }

  function syncUnitShipFilters(u, shipDetail) {
    if (!u || !u.gfx) return;
    const glowEnabled = !!(shipDetail && shipDetail.glow);
    if (u._lastShipGlowEnabled === glowEnabled) return;
    u._lastShipGlowEnabled = glowEnabled;
    if (glowEnabled) {
      const type = UNIT_TYPES[u.unitType] || UNIT_TYPES.fighter;
      const glowDist = Math.max(2.5, type.sizeMultiplier * 1.5 + 1.5);
      const glow = makeGlow(u.color || 0x888888, glowDist, 0.45);
      u.gfx.filters = glow ? [glow] : [];
    } else {
      u.gfx.filters = [];
    }
  }

  function drawShipShape(g, unitType, col, highlight) {
    ShipRenderer.drawShape(g, unitType, col, highlight, getAdaptiveShipRenderZoom());
  }

  function getShipSpriteRendererApi() {
    return (typeof ShipSpriteRenderer !== "undefined" && ShipSpriteRenderer) ? ShipSpriteRenderer : null;
  }

  function getUnitShipOverlayGfx(u) {
    if (!u || !u.gfx) return null;
    if (u._shipOverlayGfx && !u._shipOverlayGfx.destroyed) return u._shipOverlayGfx;
    return u.gfx;
  }

  function unitVisualUsesSpriteContainer(u) {
    return !!(u && u.gfx && u.gfx._shipBase && !u.gfx._shipBase.destroyed);
  }

  function rebuildUnitVisualKeepingState(u) {
    if (!u || !u.gfx) return;
    const rotation = u.gfx.rotation || 0;
    const visible = u.gfx.visible !== false;
    const filters = Array.isArray(u.gfx.filters) ? u.gfx.filters.slice() : u.gfx.filters;
    destroyUnitVisual(u);
    makeUnitVisual(u);
    if (!u.gfx) return;
    u.gfx.rotation = rotation;
    u.gfx.visible = visible;
    u.gfx.filters = filters || [];
    u._lastShipGlowEnabled = null;
    syncUnitShipFilters(u, getAdaptiveShipVisualDetail());
  }

  function unitHasSpriteVisual(spriteRenderer, u) {
    if (!spriteRenderer || !u || typeof spriteRenderer.hasSpriteType !== "function") return false;
    return !!spriteRenderer.hasSpriteType(u.unitType || "fighter", u.owner);
  }

  function shouldUseSpriteShipVisual(u) {
    const spriteRenderer = getShipSpriteRendererApi();
    if (!unitHasSpriteVisual(spriteRenderer, u)) return false;
    return getAdaptiveShipLodLevel() === "near" && (cam.zoom || 0.22) >= SHIP_SPRITE_MIN_ZOOM * 1.25;
  }

  function updateUnitTrailHistory(u, spd, baseLimit, cadenceSeed) {
    if (!u) return;
    const type = UNIT_TYPES[u.unitType] || UNIT_TYPES.fighter;
    const baseSpeed = Math.max(1, type.speed || 1);
    const speedFrac = clamp(spd / baseSpeed, 0, 2.2);
    if (speedFrac < 0.16) {
      if (u._trail) u._trail.length = 0;
      return;
    }
    const sampleEvery = speedFrac > 1.05 ? 1 : 2;
    if ((cadenceSeed % sampleEvery) !== 0) return;
    if (!u._trail) u._trail = [];
    u._trail.push({ x: u.x, y: u.y });
    const maxTrailPoints = Math.max(5, Math.round(baseLimit * (0.45 + speedFrac * 0.55)));
    if (u._trail.length > maxTrailPoints) u._trail.splice(0, u._trail.length - maxTrailPoints);
  }

  function redrawUnitShipVisual(u, highlight, shipDetail, shipLodLevel) {
    if (!u || !u.gfx) return;
    const spriteRenderer = getShipSpriteRendererApi();
    const actualSpriteVisual = unitVisualUsesSpriteContainer(u);
    if (actualSpriteVisual !== !!u._usesSpriteShipVisual) {
      u._usesSpriteShipVisual = actualSpriteVisual;
    }
    if (actualSpriteVisual && spriteRenderer && typeof spriteRenderer.updateUnitVisual === "function") {
      const ok = spriteRenderer.updateUnitVisual(u.gfx, {
        unitType: u.unitType || "fighter",
        ownerId: u.owner,
        color: u.color || 0x888888,
        highlight,
        zoom: getAdaptiveShipRenderZoom(),
        detail: shipDetail || getAdaptiveShipVisualDetail(),
        lodLevel: shipLodLevel || getAdaptiveShipLodLevel()
      });
      if (ok) return;
      rebuildUnitVisualKeepingState(u);
      if (!u.gfx) return;
      if (unitVisualUsesSpriteContainer(u)) return;
    }
    if (typeof u.gfx.clear !== "function") {
      rebuildUnitVisualKeepingState(u);
      if (!u.gfx || typeof u.gfx.clear !== "function") return;
    }
    u.gfx.clear();
    drawShipShape(u.gfx, u.unitType || "fighter", u.color || 0x888888, highlight);
  }

  function syncUnitShipVisualMode(u) {
    if (!u || !u.gfx) return;
    const spriteRenderer = getShipSpriteRendererApi();
    const actualSpriteVisual = unitVisualUsesSpriteContainer(u);
    if (actualSpriteVisual !== !!u._usesSpriteShipVisual) {
      u._usesSpriteShipVisual = actualSpriteVisual;
    }
    const wantSprite = shouldUseSpriteShipVisual(u);
    if (wantSprite && !u._usesSpriteShipVisual) {
      const unitType = u.unitType || "fighter";
      if (typeof spriteRenderer.requestUnitType === "function") spriteRenderer.requestUnitType(unitType, u.owner);
      if (typeof spriteRenderer.isReady !== "function" || !spriteRenderer.isReady(unitType, u.owner)) return;
    } else if (!wantSprite && !u._usesSpriteShipVisual) {
      return;
    } else if (wantSprite === !!u._usesSpriteShipVisual) {
      return;
    }
    rebuildUnitVisualKeepingState(u);
  }

  function drawUnitOverlayVisuals(u, hovered) {
    const overlay = getUnitShipOverlayGfx(u);
    if (!overlay) return;
    if ((u._activeShieldHp != null && u._activeShieldHp > 0) || (u._activeShieldEffectUntil != null && state.t < u._activeShieldEffectUntil)) {
      const shieldR = getUnitHitRadius(u) + 6;
      const shieldPulse = 0.5 + 0.3 * Math.sin(state.t * 4 + u.id);
      const shieldPct = u._activeShieldHp ? Math.min(1, u._activeShieldHp / ((u.maxHp || 1) * 0.25)) : 0.3;
      overlay.circle(0, 0, shieldR);
      overlay.fill({ color: 0x2266cc, alpha: 0.06 * shieldPct });
      overlay.circle(0, 0, shieldR);
      overlay.stroke({ color: 0x44aaff, width: 2.5, alpha: (0.4 + 0.2 * shieldPulse) * shieldPct });
      overlay.circle(0, 0, shieldR + 3);
      overlay.stroke({ color: 0x88ddff, width: 1, alpha: 0.2 * shieldPct });
    }
    const ownerForMarch = state.players.get(u.owner);
    if (ownerForMarch && state._battleMarchUntil && state._battleMarchUntil[ownerForMarch.id] > state.t) {
      const marchAlpha = 0.15 + 0.1 * Math.sin(state.t * 5 + u.id);
      const trailLen = (UNIT_TYPES[u.unitType]?.sizeMultiplier || 1) * 8 + 6;
      overlay.moveTo(0, 0);
      overlay.lineTo(-trailLen, -3);
      overlay.lineTo(-trailLen, 3);
      overlay.closePath();
      overlay.fill({ color: 0xffaa22, alpha: marchAlpha });
    }
    if (hovered) {
      const hType = UNIT_TYPES[u.unitType] || UNIT_TYPES.fighter;
      const hR = hType.sizeMultiplier * 6 + 8;
      overlay.circle(0, 0, hR);
      overlay.stroke({ color: 0xff4444, width: 2, alpha: 0.8 });
      const hpMax = Math.max(1, u.maxHp || hType.hp || 1);
      const hpFrac = Math.max(0, Math.min(1, (u.hp || 0) / hpMax));
      const barW = Math.max(18, hR * 1.8);
      const barH = 4;
      const barY = -hR - 10;
      const hpColor = hpFrac > 0.5 ? 0x74ff95 : (hpFrac > 0.25 ? 0xffb347 : 0xff5e5e);
      overlay.roundRect(-barW * 0.5, barY, barW, barH, 2);
      overlay.fill({ color: 0x111111, alpha: 0.72 });
      overlay.roundRect(-barW * 0.5 + 0.8, barY + 0.8, Math.max(0, (barW - 1.6) * hpFrac), barH - 1.6, 2);
      overlay.fill({ color: hpColor, alpha: 0.94 });
      overlay.roundRect(-barW * 0.5, barY, barW, barH, 2);
      overlay.stroke({ color: 0xffffff, width: 0.8, alpha: 0.32 });
    }
  }

  function destroyUnitVisual(u) {
    if (!u || !u.gfx) return;
    const spriteRenderer = getShipSpriteRendererApi();
    if (u._usesSpriteShipVisual && spriteRenderer && typeof spriteRenderer.destroyUnitVisual === "function") {
      spriteRenderer.destroyUnitVisual(u.gfx);
    } else {
      if (u.gfx.parent) u.gfx.parent.removeChild(u.gfx);
      u.gfx.destroy(getSafePixiDestroyOptions());
    }
    u.gfx = null;
    u._shipOverlayGfx = null;
    u._usesSpriteShipVisual = false;
  }

  function makeUnitVisual(u) {
    const col = u.color ?? colorForId(u.owner);
    u.color = col;
    const spriteRenderer = getShipSpriteRendererApi();
    let g = null;
    if (shouldUseSpriteShipVisual(u) && unitHasSpriteVisual(spriteRenderer, u)) {
      if (typeof spriteRenderer.requestUnitType === "function") spriteRenderer.requestUnitType(u.unitType || "fighter", u.owner);
    }
    if (spriteRenderer
      && shouldUseSpriteShipVisual(u)
      && unitHasSpriteVisual(spriteRenderer, u)
      && typeof spriteRenderer.isReady === "function"
      && spriteRenderer.isReady(u.unitType || "fighter", u.owner)) {
      g = spriteRenderer.createUnitVisual({
        unitType: u.unitType || "fighter",
        ownerId: u.owner,
        color: col,
        detail: getAdaptiveShipVisualDetail(),
        lodLevel: getAdaptiveShipLodLevel()
      });
      u._usesSpriteShipVisual = !!g;
      u._shipOverlayGfx = g && typeof spriteRenderer.getOverlayGfx === "function" ? spriteRenderer.getOverlayGfx(g) : null;
    }
    if (!g) {
      g = new PIXI.Graphics();
      drawShipShape(g, u.unitType || "fighter", col);
      u._usesSpriteShipVisual = false;
      u._shipOverlayGfx = null;
    }

    g.position.set(u.x, u.y);
    unitsLayer.addChild(g);
    u.gfx = g;
    const shipDetail = getAdaptiveShipVisualDetail();
    u._lastShipLodLevel = getAdaptiveShipLodLevel();
    u._lastShipGlowEnabled = null;
    syncUnitShipFilters(u, shipDetail);
  }

  function updateUnitVisualsOnly() {
    const vfc = state._frameCtr || 0;
    for (const u of state.units.values()) {
      if (!u.gfx) {
        makeUnitVisual(u);
      }
      if (!u.gfx) continue;
      syncUnitShipVisualMode(u);
      const vis = inView(u.x, u.y);
      u.gfx.visible = vis;
      if (vis) {
        u.gfx.position.set(u.x, u.y);
        const spd = Math.hypot(u.vx || 0, u.vy || 0);
        const shipDetail = getAdaptiveShipVisualDetail();
        const shipLodLevel = getAdaptiveShipLodLevel();
        const lodChanged = u._lastShipLodLevel !== shipLodLevel;
        if (u._lastShipLodLevel !== shipLodLevel) {
          u._lastShipLodLevel = shipLodLevel;
          syncUnitShipFilters(u, shipDetail);
        }
        updateUnitTrailHistory(u, spd, 10, vfc + u.id);
        const _tRot = Number.isFinite(u._lastFacingAngle) ? u._lastFacingAngle : Math.atan2(u.vy || 0, u.vx || 0);
        let _dRot = _tRot - u.gfx.rotation;
        while (_dRot > Math.PI) _dRot -= Math.PI * 2;
        while (_dRot < -Math.PI) _dRot += Math.PI * 2;
        const _ts = getUnitVisualTurnRate(u, !u.leaderId) * (state._lastDt || 0.016);
        u.gfx.rotation += Math.abs(_dRot) < _ts ? _dRot : Math.sign(_dRot) * _ts;
        const sel = state.selectedUnitIds.has(u.id);
        const flashing = u._hitFlashT != null && (state.t - u._hitFlashT) < 0.3;
        const hovered = state._hoverTarget && state._hoverTarget.id === u.id;
        const stateChanged = (u._lastSelected !== sel || u._lastFlash !== flashing || u._lastHovered !== hovered);
        const redrawInterval = getShipVisualRedrawInterval(sel, hovered, flashing);
        const needRedraw = lodChanged || stateChanged || (vfc + u.id) % redrawInterval === 0;
        if (needRedraw) {
          u._lastSelected = sel;
          u._lastFlash = flashing;
          u._lastHovered = hovered;
          const col = flashing ? 0xff2222 : (sel ? 0xffffff : (hovered ? 0xff4444 : (u.color || 0x888888)));
          redrawUnitShipVisual(u, col, shipDetail, shipLodLevel);
          drawUnitOverlayVisuals(u, hovered);
        }
      }
    }
  }

  function updateShipTrails() {
    if (!state._shipTrailsGfx || state._shipTrailsGfx.destroyed || state._shipTrailsGfx.parent !== shipTrailsLayer) {
      destroyChildren(shipTrailsLayer);
      state._shipTrailsGfx = new PIXI.Graphics();
      shipTrailsLayer.addChild(state._shipTrailsGfx);
    }
    const g = state._shipTrailsGfx;
    g.clear();
    const shipDetail = getAdaptiveShipVisualDetail();
    const lodLevel = getAdaptiveShipLodLevel();
    if (!shipDetail.trails || cam.zoom < 0.14 || lodLevel === "far") {
      return;
    }
    const simplified = lodLevel !== "near" || cam.zoom < 0.24;
    for (const u of state.units.values()) {
      if (!u._trail || u._trail.length < 2 || !inView(u.x, u.y)) continue;
      const type = UNIT_TYPES[u.unitType] || UNIT_TYPES.fighter;
      const owner = state.players.get(u.owner);
      const trailColor = owner ? (owner.color || colorForId(owner.id)) : (u.color || colorForId(u.owner));
      const speed = Math.hypot(u.vx || 0, u.vy || 0);
      const baseSpeed = Math.max(1, type.speed || 1);
      const speedFrac = clamp(speed / baseSpeed, 0, 1.9);
      if (speedFrac < 0.16) continue;
      const tailPathLen = (type.sizeMultiplier * 30 + 16) * (0.24 + speedFrac * 1.22);
      const trail = u._trail;
      const trailLen = trail.length;
      let remaining = tailPathLen;
      let startIndex = trailLen - 1;
      let startX = trail[trailLen - 1].x || 0;
      let startY = trail[trailLen - 1].y || 0;
      let foundStart = false;
      for (let i = trailLen - 2; i >= 0; i--) {
        const cur = trail[i];
        const next = trail[i + 1];
        const segLen = Math.hypot((next.x || 0) - (cur.x || 0), (next.y || 0) - (cur.y || 0));
        if (segLen <= 0.001) {
          startIndex = i;
          startX = cur.x || 0;
          startY = cur.y || 0;
          continue;
        }
        if (segLen >= remaining) {
          const t = remaining / segLen;
          startIndex = i + 1;
          startX = mfLerp(next.x || 0, cur.x || 0, t);
          startY = mfLerp(next.y || 0, cur.y || 0, t);
          foundStart = true;
          break;
        }
        remaining -= segLen;
        startIndex = i;
        startX = cur.x || 0;
        startY = cur.y || 0;
      }
      const visibleSegments = Math.max(1, trailLen - startIndex);
      const widthBase = simplified ? Math.max(1.35, type.sizeMultiplier * 0.46) : Math.max(1.9, type.sizeMultiplier * 0.74);
      const step = simplified ? 3 : 1;
      let prevX = startX;
      let prevY = startY;
      let visibleIdx = 0;
      for (let i = startIndex; i < trailLen; i += step) {
        const nextPoint = trail[i];
        if (!nextPoint) continue;
        const frac = visibleIdx / Math.max(1, visibleSegments);
        const beamAlpha = (0.08 + frac * (simplified ? 0.14 : 0.22)) * Math.min(1, cam.zoom * 2.7 + 0.34) * (0.92 + speedFrac * 0.26);
        g.lineStyle(widthBase * (0.82 + frac * 1.06) * (0.70 + speedFrac * 0.68), trailColor, beamAlpha);
        g.moveTo(prevX, prevY);
        g.lineTo(nextPoint.x || 0, nextPoint.y || 0);
        if (!simplified || i >= trailLen - 3) {
          g.beginFill(i >= trailLen - 2 ? 0xf1fcff : trailColor, beamAlpha * (simplified ? 0.46 : 0.90));
          g.drawCircle(prevX, prevY, widthBase * (0.36 + frac * 0.28) * (0.84 + speedFrac * 0.12));
          g.endFill();
        }
        prevX = nextPoint.x || 0;
        prevY = nextPoint.y || 0;
        visibleIdx++;
      }
      if (!foundStart && visibleIdx <= 0) continue;
      const head = trail[trailLen - 1];
      g.beginFill(0xffffff, 0.08 + speedFrac * 0.10);
      g.drawCircle(head.x, head.y, widthBase * (0.55 + speedFrac * 0.22));
      g.endFill();
    }
  }

  function updateActivityZones() {
    destroyChildren(activityZoneLayer);
    // No full-zone fill — zone visual is edges-only (real contour + Plexus). Activity range not drawn as fill.
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
      if (p._orbitalRings) {
        p._orbitalRingPhase = (p._orbitalRingPhase || 0) + 0.003;
        p._orbitalRings.rotation = p._orbitalRingPhase;
        p._orbitalRings.position.set(p.x, p.y);
        p._orbitalRings.scale.set(s);
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
      let cx = 0, cy = 0;
      for (const u of squad) {
        cx += u.x;
        cy += u.y;
      }
      cx /= squad.length;
      cy /= squad.length;

      const owner = state.players.get(squad[0].owner);
      const isPirateSquad = squad[0].owner === PIRATE_OWNER_ID;
      const col = owner ? owner.color : (isPirateSquad ? 0xd4875d : 0x888888);

      const maxAtkR = Math.max(...squad.map(u => getUnitAtkRange(u)));
      const maxEngR = Math.max(...squad.map(u => getUnitEngagementRange(u)));
      const spreadR = Math.max(0, ...squad.map(u => Math.hypot(u.x - cx, u.y - cy)));
      const hovered = !!(state._hoverWorld && squad.some((u) => Math.hypot((u.x || 0) - state._hoverWorld.x, (u.y || 0) - state._hoverWorld.y) <= Math.max(26, getUnitHitRadius(u) + 4)));
      const findUnitAt = (px, py) => squad.reduce((b, u) => {
        const d = (u.x - px) ** 2 + (u.y - py) ** 2;
        return d < b.d ? { u, d } : b;
      }, { u: squad[0], d: Infinity }).u;

      if (hovered) {
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
      }

      const barY = cy - 22;
      if (isPirateSquad && hovered) {
        const pirateFlagTxt = new PIXI.Text("🏴‍☠️", {
          fontFamily: "Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, Arial",
          fontSize: 16,
          fill: 0xffffff,
          stroke: 0x000000,
          strokeThickness: 4
        });
        pirateFlagTxt.anchor.set(0.5, 1);
        pirateFlagTxt.position.set(cx, barY - 34);
        squadLabelsLayer.addChild(pirateFlagTxt);
      }
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
    return isUnitInAuthoritativeCombat(u);
  }
  // ^ helper kept for older visual/UI call sites, but reads squad authority

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
        if (!rectInView(cx - r, cy - r, cx + r, cy + r, 120)) continue;

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
        if (!rectInView(cx - r, cy - r - 90, cx + r, cy + r + 30, 120)) continue;

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
      if (!rectInView(cx - 180, cy - 140, cx + 180, cy + 90, 120)) continue;
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

        if (offset > 0) {
          const div = new PIXI.Graphics();
          div.beginFill(0xffffff, 0.8);
          div.drawRect(cx - barW / 2 + offset - 1, cy - lift + 38, 2, barH);
          div.endFill();
          combatLayer.addChild(div);
        }
        offset += segW;
      }
    }
    }
    if (state._forcePreview) {
      const fp = state._forcePreview;
      if (!rectInView(fp.enemyCx - FORCE_PREVIEW_RADIUS, fp.enemyCy - FORCE_PREVIEW_RADIUS - 90, fp.enemyCx + FORCE_PREVIEW_RADIUS, fp.enemyCy + FORCE_PREVIEW_RADIUS, 120)) {
        if (state.floatingDamage.length > 36) state.floatingDamage.splice(0, state.floatingDamage.length - 36);
        return;
      }
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
    destroyTransientChildren(selectionBoxLayer);
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

  let selectionAndOrdersApi = null;
  const SHIP_SPRITE_MIN_ZOOM = 0.42;

  function updatePathPreview() {
    destroyTransientChildren(pathPreviewLayer);
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

  function appendQueuedPathPoint(points, markers, point, type) {
    if (!point) return;
    const prev = points[points.length - 1];
    if (!prev || Math.hypot(prev.x - point.x, prev.y - point.y) > 1) {
      points.push({ x: point.x, y: point.y });
    }
    markers.push({ x: point.x, y: point.y, type: type || "move" });
  }

  function getQueuedOrderAnchorPoint(order) {
    if (!order) return null;
    if (Array.isArray(order.waypoints) && order.waypoints.length > 0) {
      const last = order.waypoints[order.waypoints.length - 1];
      return last ? { x: last.x, y: last.y } : null;
    }
    if (order.type === "capture" && order.mineId != null) {
      const mine = state.mines.get(order.mineId);
      if (mine) return { x: mine.x, y: mine.y };
    }
    if (order.type === "attackUnit" && order.targetUnitId != null) {
      const target = state.units.get(order.targetUnitId);
      if (target && target.hp > 0) return { x: target.x, y: target.y };
    }
    if (order.type === "siege" && order.targetCityId != null) {
      const city = state.players.get(order.targetCityId);
      if (city && !city.eliminated) return { x: city.x, y: city.y };
    }
    if (order.type === "attackPirateBase" || order.targetPirateBase) {
      const pirateBase = typeof getNearestAlivePirateBase === "function" ? getNearestAlivePirateBase(0, 0) : null;
      if (pirateBase) return { x: pirateBase.x, y: pirateBase.y };
      if (state.pirateBase && state.pirateBase.hp > 0) return { x: state.pirateBase.x, y: state.pirateBase.y };
    }
    return null;
  }

  function getDisplayedOrderPath(leader, squadState) {
    const points = [{ x: leader.x, y: leader.y }];
    const markers = [];
    const activeOrder = squadState?.order || null;
    const activeWaypoints = leader.waypoints || activeOrder?.waypoints || [];
    const activeIndex = leader.waypointIndex ?? 0;
    for (let i = activeIndex; i < activeWaypoints.length; i++) {
      appendQueuedPathPoint(points, markers, activeWaypoints[i], activeOrder?.type || "move");
    }
    if (!activeWaypoints.length) {
      const activeAnchor = getQueuedOrderAnchorPoint(activeOrder);
      if (activeAnchor) appendQueuedPathPoint(points, markers, activeAnchor, activeOrder?.type || "move");
    }
    const queue = Array.isArray(activeOrder?.commandQueue) ? activeOrder.commandQueue : [];
    for (const queuedOrder of queue) {
      const queuedAnchor = getQueuedOrderAnchorPoint(queuedOrder);
      if (!queuedAnchor) continue;
      appendQueuedPathPoint(points, markers, queuedAnchor, queuedOrder.type || "move");
    }
    return { points, markers };
  }

  function updateMovingPathPreview() {
    destroyTransientChildren(pathPreviewLayer);
  }

  function getCenterArenaRadius() {
    const centerObjectives = state.centerObjectives || {};
    const centerX = centerObjectives.centerX || CFG.WORLD_W * 0.5;
    const centerY = centerObjectives.centerY || CFG.WORLD_H * 0.5;
    let radius = 210;
    for (const mineId of centerObjectives.centerMineIds || []) {
      const mine = state.mines.get(mineId);
      if (!mine) continue;
      radius = Math.max(radius, Math.hypot((mine.x || 0) - centerX, (mine.y || 0) - centerY) + 90);
    }
    return radius;
  }

  function drawLaneRibbon(g, from, to, color, widthA, widthB, fillAlpha, lineAlpha) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    g.beginFill(color, fillAlpha);
    g.moveTo(from.x + nx * widthA, from.y + ny * widthA);
    g.lineTo(to.x + nx * widthB, to.y + ny * widthB);
    g.lineTo(to.x - nx * widthB, to.y - ny * widthB);
    g.lineTo(from.x - nx * widthA, from.y - ny * widthA);
    g.closePath();
    g.endFill();
    g.lineStyle(1.6, color, lineAlpha);
    g.moveTo(from.x, from.y);
    g.lineTo(to.x, to.y);
  }

  function drawRoundedLaneStroke(g, points, width, color, alpha) {
    if (!Array.isArray(points) || points.length < 2) return;
    g.moveTo(points[0].x || 0, points[0].y || 0);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x || 0, points[i].y || 0);
    try {
      g.stroke({ width, color, alpha, cap: "round", join: "round" });
    } catch (_) {
      g.stroke({ width, color, alpha });
    }
  }

  function buildRoundedLanePolyline(points, cornerRadius = 140, samplesPerCorner = 6) {
    if (!Array.isArray(points) || points.length < 3) return Array.isArray(points) ? points.map((p) => ({ x: p.x || 0, y: p.y || 0 })) : [];
    const out = [{ x: points[0].x || 0, y: points[0].y || 0 }];
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      const inDx = (curr.x || 0) - (prev.x || 0);
      const inDy = (curr.y || 0) - (prev.y || 0);
      const outDx = (next.x || 0) - (curr.x || 0);
      const outDy = (next.y || 0) - (curr.y || 0);
      const inLen = Math.hypot(inDx, inDy) || 1;
      const outLen = Math.hypot(outDx, outDy) || 1;
      const cut = Math.min(cornerRadius, inLen * 0.35, outLen * 0.35);
      const entry = { x: (curr.x || 0) - (inDx / inLen) * cut, y: (curr.y || 0) - (inDy / inLen) * cut };
      const exit = { x: (curr.x || 0) + (outDx / outLen) * cut, y: (curr.y || 0) + (outDy / outLen) * cut };
      const last = out[out.length - 1];
      if (!last || Math.hypot((last.x || 0) - entry.x, (last.y || 0) - entry.y) > 1) out.push(entry);
      for (let step = 1; step <= samplesPerCorner; step++) {
        const t = step / samplesPerCorner;
        const omt = 1 - t;
        out.push({
          x: omt * omt * entry.x + 2 * omt * t * (curr.x || 0) + t * t * exit.x,
          y: omt * omt * entry.y + 2 * omt * t * (curr.y || 0) + t * t * exit.y
        });
      }
    }
    const lastPoint = points[points.length - 1];
    const prevOut = out[out.length - 1];
    if (!prevOut || Math.hypot((prevOut.x || 0) - (lastPoint.x || 0), (prevOut.y || 0) - (lastPoint.y || 0)) > 1) {
      out.push({ x: lastPoint.x || 0, y: lastPoint.y || 0 });
    }
    return out;
  }

  function offsetLanePolyline(points, offset) {
    if (!Array.isArray(points) || points.length < 2 || !offset) return Array.isArray(points) ? points.map((p) => ({ x: p.x || 0, y: p.y || 0 })) : [];
    const out = [];
    for (let i = 0; i < points.length; i++) {
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      const dx = (next.x || 0) - (prev.x || 0);
      const dy = (next.y || 0) - (prev.y || 0);
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      out.push({
        x: (points[i].x || 0) + nx * offset,
        y: (points[i].y || 0) + ny * offset
      });
    }
    return out;
  }

  function polylineLength(points) {
    let total = 0;
    for (let i = 1; i < (points || []).length; i++) {
      total += Math.hypot((points[i].x || 0) - (points[i - 1].x || 0), (points[i].y || 0) - (points[i - 1].y || 0));
    }
    return total;
  }

  function slicePolylineToDistance(points, distance) {
    if (!Array.isArray(points) || points.length === 0) return [];
    if (points.length === 1) return [{ x: points[0].x || 0, y: points[0].y || 0 }];
    const maxDist = Math.max(0, distance || 0);
    const out = [{ x: points[0].x || 0, y: points[0].y || 0 }];
    let walked = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const segLen = Math.hypot((b.x || 0) - (a.x || 0), (b.y || 0) - (a.y || 0));
      if (segLen <= 1e-6) continue;
      if (walked + segLen <= maxDist) {
        out.push({ x: b.x || 0, y: b.y || 0 });
        walked += segLen;
        continue;
      }
      const t = (maxDist - walked) / segLen;
      if (t > 0) {
        out.push({
          x: mfLerp(a.x || 0, b.x || 0, t),
          y: mfLerp(a.y || 0, b.y || 0, t)
        });
      }
      break;
    }
    return out;
  }

  function slicePolylineFromDistance(points, distance) {
    if (!Array.isArray(points) || points.length === 0) return [];
    if (points.length === 1) return [{ x: points[0].x || 0, y: points[0].y || 0 }];
    const maxDist = Math.max(0, distance || 0);
    if (maxDist <= 0) return points.map((point) => ({ x: point.x || 0, y: point.y || 0 }));
    let walked = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const segLen = Math.hypot((b.x || 0) - (a.x || 0), (b.y || 0) - (a.y || 0));
      if (segLen <= 1e-6) continue;
      if (walked + segLen < maxDist) {
        walked += segLen;
        continue;
      }
      const t = Math.max(0, Math.min(1, (maxDist - walked) / segLen));
      const out = [{
        x: mfLerp(a.x || 0, b.x || 0, t),
        y: mfLerp(a.y || 0, b.y || 0, t)
      }];
      out.push({ x: b.x || 0, y: b.y || 0 });
      for (let j = i + 1; j < points.length; j++) {
        out.push({ x: points[j].x || 0, y: points[j].y || 0 });
      }
      return out;
    }
    const last = points[points.length - 1];
    return [{ x: last.x || 0, y: last.y || 0 }];
  }

  function projectPointOnPolyline(points, px, py) {
    let best = null;
    let walked = 0;
    for (let i = 1; i < (points || []).length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const dx = (b.x || 0) - (a.x || 0);
      const dy = (b.y || 0) - (a.y || 0);
      const len2 = dx * dx + dy * dy;
      if (len2 <= 1e-6) continue;
      const t = Math.max(0, Math.min(1, ((px - (a.x || 0)) * dx + (py - (a.y || 0)) * dy) / len2));
      const qx = (a.x || 0) + dx * t;
      const qy = (a.y || 0) + dy * t;
      const dist = Math.hypot(px - qx, py - qy);
      const segLen = Math.sqrt(len2);
      const progress = walked + segLen * t;
      if (!best || dist < best.dist) best = { dist, progress, x: qx, y: qy, angle: Math.atan2(dy, dx) };
      walked += segLen;
    }
    return best;
  }

  function samplePolylineAtDistance(points, distance) {
    if (!Array.isArray(points) || points.length === 0) return { x: 0, y: 0, angle: 0 };
    if (points.length === 1) return { x: points[0].x || 0, y: points[0].y || 0, angle: 0 };
    let walk = Math.max(0, distance || 0);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const dx = (b.x || 0) - (a.x || 0);
      const dy = (b.y || 0) - (a.y || 0);
      const segLen = Math.hypot(dx, dy);
      if (segLen <= 1e-6) continue;
      if (walk <= segLen) {
        const t = walk / segLen;
        return {
          x: mfLerp(a.x || 0, b.x || 0, t),
          y: mfLerp(a.y || 0, b.y || 0, t),
          angle: Math.atan2(dy, dx)
        };
      }
      walk -= segLen;
    }
    const last = points[points.length - 1];
    const prev = points[points.length - 2] || last;
    return {
      x: last.x || 0,
      y: last.y || 0,
      angle: Math.atan2((last.y || 0) - (prev.y || 0), (last.x || 0) - (prev.x || 0))
    };
  }

  function buildPolylineTrailByDistance(points, headDistance, spanDistance, steps) {
    if (!Array.isArray(points) || points.length < 2) return [];
    const head = Math.max(0, headDistance || 0);
    const tail = Math.max(0, head - Math.max(4, spanDistance || 0));
    const sampleCount = Math.max(3, steps | 0);
    const out = [];
    for (let i = 0; i <= sampleCount; i++) {
      const d = mfLerp(tail, head, i / sampleCount);
      const sample = samplePolylineAtDistance(points, d);
      const prev = out[out.length - 1];
      if (prev && Math.hypot((sample.x || 0) - (prev.x || 0), (sample.y || 0) - (prev.y || 0)) <= 0.3) continue;
      out.push({ x: sample.x || 0, y: sample.y || 0 });
    }
    return out;
  }

  function buildElectricPolyline(points, amplitude, phaseSeed = 0) {
    if (!Array.isArray(points) || points.length < 2 || !amplitude) {
      return Array.isArray(points) ? points.map((point) => ({ x: point.x || 0, y: point.y || 0 })) : [];
    }
    const lastIndex = points.length - 1;
    const out = [];
    for (let i = 0; i < points.length; i++) {
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(lastIndex, i + 1)];
      const angle = Math.atan2((next.y || 0) - (prev.y || 0), (next.x || 0) - (prev.x || 0));
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);
      const edgeFade = i === 0 || i === lastIndex ? 0.38 : 1;
      const zig = (((i + phaseSeed) % 2) === 0 ? 1 : -1) * amplitude * edgeFade;
      out.push({
        x: (points[i].x || 0) + perpX * zig,
        y: (points[i].y || 0) + perpY * zig
      });
    }
    return out;
  }

  function drawPolylineStepLights(g, points, color, opts) {
    if (!Array.isArray(points) || points.length < 2) return;
    opts = opts || {};
    const totalLen = polylineLength(points);
    if (totalLen <= 1e-6) return;
    const invZoom = 1 / Math.max(0.001, cam.zoom || 0.22);
    const spacing = Math.max(8, (opts.spacing || 22) * invZoom);
    const radius = Math.max(0.8, (opts.radius || 2.2) * invZoom);
    const speed = opts.speed != null ? opts.speed : 26;
    const alpha = opts.alpha != null ? opts.alpha : 0.24;
    const offset = ((((state.t || 0) * speed * 0.18) + (opts.seed || 0)) % spacing + spacing) % spacing;
    for (let dist = offset; dist <= totalLen; dist += spacing) {
      const sample = samplePolylineAtDistance(points, dist);
      const glowAlpha = alpha * (0.42 + 0.38 * Math.sin((state.t || 0) * 4.8 + dist * 0.04 + (opts.seed || 0)));
      g.circle(sample.x, sample.y, radius * 2.3);
      g.fill({ color, alpha: Math.max(0.02, glowAlpha * 0.34) });
      g.circle(sample.x, sample.y, radius);
      g.fill({ color, alpha: Math.max(0.04, glowAlpha) });
      if (opts.coreColor != null) {
        g.circle(sample.x, sample.y, Math.max(0.7, radius * 0.46));
        g.fill({ color: opts.coreColor, alpha: Math.max(0.06, glowAlpha * 0.78) });
      }
    }
  }

  function drawChargedPressureZone(g, rawPoints, color, halfWidth, opts) {
    if (!Array.isArray(rawPoints) || rawPoints.length < 2) return;
    opts = opts || {};
    drawCorridorPolyline(g, rawPoints, color, halfWidth, {
      fillAlpha: opts.fillAlpha != null ? opts.fillAlpha : 0.0,
      coreAlpha: opts.coreAlpha != null ? opts.coreAlpha : 0.0,
      edgeAlpha: opts.edgeAlpha != null ? opts.edgeAlpha : 0.16,
      lightAlpha: opts.lightAlpha != null ? opts.lightAlpha : 0.0,
      dashSpeed: opts.dashSpeed != null ? opts.dashSpeed : 36,
      cornerRadius: opts.cornerRadius,
      cornerSamples: opts.cornerSamples,
      showEdgeLights: false
    });
    const smoothPoints = buildRoundedLanePolyline(rawPoints, Math.max(54, halfWidth * 0.7), 5);
    drawRoundedLaneStroke(g, smoothPoints, Math.max(halfWidth * 0.08, 4), color, 0.07);
  }

  function drawLanePolylineRibbon(g, points, color, width, fillAlpha, lineAlpha) {
    if (!Array.isArray(points) || points.length < 2) return;
    for (let i = 1; i < points.length; i++) {
      drawLaneRibbon(g, points[i - 1], points[i], color, width, width, fillAlpha, lineAlpha);
    }
  }

  function drawCorridorPolyline(g, rawPoints, color, halfWidth, opts) {
    if (!Array.isArray(rawPoints) || rawPoints.length < 2) return;
    opts = opts || {};
    const invZoom = 1 / Math.max(0.001, cam.zoom || 0.22);
    const smoothPoints = buildRoundedLanePolyline(rawPoints, opts.cornerRadius || Math.max(70, halfWidth * 0.8), opts.cornerSamples || 6);
    const edgeOffset = Math.max(halfWidth - Math.max(8, halfWidth * 0.12), halfWidth * 0.68);
    const edgeA = offsetLanePolyline(smoothPoints, edgeOffset);
    const edgeB = offsetLanePolyline(smoothPoints, -edgeOffset);
    const fillAlpha = opts.fillAlpha != null ? opts.fillAlpha : 0.016;
    const coreAlpha = opts.coreAlpha != null ? opts.coreAlpha : (fillAlpha * 1.55);
    const edgeAlpha = opts.edgeAlpha != null ? opts.edgeAlpha : 0.12;
    const lightAlpha = opts.lightAlpha != null ? opts.lightAlpha : 0.16;
    const dashSpeed = opts.dashSpeed != null ? opts.dashSpeed : 24;
    const dashLen = (opts.dash || 18) * invZoom;
    const gapLen = (opts.gap || 26) * invZoom;

    drawRoundedLaneStroke(g, smoothPoints, halfWidth * 2, color, fillAlpha);
    drawRoundedLaneStroke(g, smoothPoints, Math.max(halfWidth * 0.78, 16), color, coreAlpha);
    drawRoundedLaneStroke(g, edgeA, 1.2 * invZoom, color, edgeAlpha);
    drawRoundedLaneStroke(g, edgeB, 1.2 * invZoom, color, edgeAlpha * 0.94);
    if (opts.showEdgeLights !== false && lightAlpha > 0.001) {
      drawPolylineStepLights(g, edgeA, 0xffffff, {
        spacing: opts.lightSpacing || 22,
        radius: opts.lightRadius || 2.5,
        alpha: lightAlpha,
        speed: dashSpeed,
        coreColor: color,
        seed: 0.7
      });
      drawPolylineStepLights(g, edgeB, color, {
        spacing: opts.lightSpacing || 22,
        radius: opts.lightRadius || 2.5,
        alpha: lightAlpha * 0.92,
        speed: dashSpeed * 0.88 + 6,
        coreColor: 0xffffff,
        seed: 3.1
      });
    }
  }

  function drawLanePressureCap(g, point, angle, width, color) {
    if (!point) return;
    const nx = -Math.sin(angle || 0);
    const ny = Math.cos(angle || 0);
    const half = Math.max(10, width);
    const pulse = 0.5 + 0.5 * Math.sin((state.t || 0) * 5.4 + point.x * 0.01 + point.y * 0.01);
    g.circle(point.x, point.y, Math.max(8, half * (0.18 + pulse * 0.04)));
    g.fill({ color, alpha: 0.09 + pulse * 0.05 });
    g.lineStyle(3.4, color, 0.34);
    g.moveTo(point.x - nx * half, point.y - ny * half);
    g.lineTo(point.x + nx * half, point.y + ny * half);
    g.lineStyle(1.6, 0xffffff, 0.20);
    g.moveTo(point.x - nx * half * 0.88, point.y - ny * half * 0.88);
    g.lineTo(point.x + nx * half * 0.88, point.y + ny * half * 0.88);
    const arm = half * 0.55;
    g.lineStyle(1.2, color, 0.22 + pulse * 0.10);
    g.moveTo(point.x - nx * arm, point.y - ny * arm);
    g.lineTo(point.x - nx * arm * 0.45 + Math.cos(angle || 0) * arm * 0.32, point.y - ny * arm * 0.45 + Math.sin(angle || 0) * arm * 0.32);
    g.moveTo(point.x + nx * arm, point.y + ny * arm);
    g.lineTo(point.x + nx * arm * 0.45 + Math.cos(angle || 0) * arm * 0.32, point.y + ny * arm * 0.45 + Math.sin(angle || 0) * arm * 0.32);
  }

  function getLaneOutsideMeta(sample, preferredOutward) {
    if (!sample) return { sideX: 0, sideY: 0, outward: 1 };
    const sideAngle = (sample.angle || 0) + Math.PI * 0.5;
    const sideX = Math.cos(sideAngle);
    const sideY = Math.sin(sideAngle);
    if (preferredOutward === 1 || preferredOutward === -1) {
      return { sideX, sideY, outward: preferredOutward };
    }
    const centerX = state.centerObjectives?.centerX || CFG.WORLD_W * 0.5;
    const centerY = state.centerObjectives?.centerY || CFG.WORLD_H * 0.5;
    const outward = (((sample.x || 0) - centerX) * sideX + ((sample.y || 0) - centerY) * sideY) >= 0 ? 1 : -1;
    return { sideX, sideY, outward };
  }

  function offsetLaneSampleOutside(sample, laneHalfWidth, extraOffset, preferredOutward) {
    if (!sample) return null;
    const meta = getLaneOutsideMeta(sample, preferredOutward);
    const offset = Math.max(0, laneHalfWidth || 0) + (extraOffset || 0);
    return {
      x: (sample.x || 0) + meta.sideX * meta.outward * offset,
      y: (sample.y || 0) + meta.sideY * meta.outward * offset,
      angle: sample.angle || 0
    };
  }

  function drawOuterLanePressureLine(g, rawPoints, sample, laneHalfWidth, color, preferredOutward) {
    if (!Array.isArray(rawPoints) || rawPoints.length < 2 || !sample) return;
    const invZoom = 1 / Math.max(0.001, cam.zoom || 0.22);
    const smoothPoints = buildRoundedLanePolyline(rawPoints, Math.max(54, laneHalfWidth * 0.7), 5);
    const meta = getLaneOutsideMeta(sample, preferredOutward);
    const outerOffset = (Math.max(0, laneHalfWidth || 0) + 14) * meta.outward;
    const outerLine = offsetLanePolyline(smoothPoints, outerOffset);
    drawRoundedLaneStroke(g, outerLine, 2.2 * invZoom, color, 0.34);
    drawRoundedLaneStroke(g, outerLine, 0.9 * invZoom, 0xffffff, 0.14);
    drawPolylineStepLights(g, outerLine, color, {
      spacing: 18,
      radius: 2.0,
      alpha: 0.16,
      speed: 28,
      coreColor: 0xffffff,
      seed: sample.x * 0.01 + sample.y * 0.02
    });
  }

  function getLaneAnchorEntries() {
    const anchors = [];
    for (const player of state.players.values()) {
      if (!player || player.id == null || player.id <= 0 || player.eliminated) continue;
      anchors.push({
        id: player.id,
        x: player.x || 0,
        y: player.y || 0,
        ownerId: player.id,
        isSectorObjective: false
      });
    }
    for (const objective of state.sectorObjectives || []) {
      if (!objective || objective.anchorId == null) continue;
      anchors.push({
        id: objective.anchorId,
        x: objective.x || 0,
        y: objective.y || 0,
        ownerId: objective.ownerId || null,
        isSectorObjective: true
      });
    }
    return anchors;
  }

  function getLanePointsForPlayerFront(player, frontType, center) {
    if (!player) return [];
    if (frontType === "center") return [{ x: player.x, y: player.y }, { x: center.x, y: center.y }];
    const graph = state.frontGraph && state.frontGraph[player.id] ? state.frontGraph[player.id] : null;
    const path = frontType === "left" ? graph?.leftPath : graph?.rightPath;
    return [{ x: player.x, y: player.y }].concat((path || []).map((point) => ({ x: point.x || 0, y: point.y || 0 })));
  }

  function getFrontLanePressure(ownerId, frontType, points) {
    if (!Array.isArray(points) || points.length < 2) return null;
    let bestProgress = 0;
    let bestSample = null;
    for (const [squadId, entry] of Object.entries(state.squadFrontAssignments || {})) {
      if (!entry || entry.ownerId !== ownerId || entry.frontType !== frontType) continue;
      const squad = state.squads && state.squads.get(Number(squadId));
      if (!squad || typeof SQUADLOGIC === "undefined" || !SQUADLOGIC.getSquadUnits) continue;
      for (const u of SQUADLOGIC.getSquadUnits(state, squad)) {
        const sample = projectPointOnPolyline(points, u.x || 0, u.y || 0);
        if (!sample) continue;
        if (sample.dist > 220) continue;
        if (sample.progress > bestProgress) {
          bestProgress = sample.progress;
          bestSample = sample;
        }
      }
    }
    if (!bestSample || bestProgress <= 0) return null;
    const sliced = slicePolylineToDistance(points, bestProgress);
    return { progress: bestProgress, sample: bestSample, points: sliced };
  }

  function getFrontLaneStrength(ownerId, frontType) {
    let total = 0;
    for (const [squadId, entry] of Object.entries(state.squadFrontAssignments || {})) {
      if (!entry || entry.ownerId !== ownerId || entry.frontType !== frontType) continue;
      const squad = state.squads && state.squads.get(Number(squadId));
      if (!squad || typeof SQUADLOGIC === "undefined" || !SQUADLOGIC.getSquadUnits) continue;
      const units = SQUADLOGIC.getSquadUnits(state, squad);
      if (!units.length) continue;
      total += squadStrength(units);
    }
    return Math.round(total);
  }

  function getOpposingLaneReference(ownerId, frontType) {
    if (frontType !== "left" && frontType !== "right") return null;
    const ownerGraph = state.frontGraph && state.frontGraph[ownerId] ? state.frontGraph[ownerId] : null;
    const targetId = frontType === "left" ? ownerGraph?.leftTargetCoreId : ownerGraph?.rightTargetCoreId;
    if (targetId == null) return null;
    const enemyGraph = state.frontGraph && state.frontGraph[targetId] ? state.frontGraph[targetId] : null;
    if (!enemyGraph) return null;
    if (enemyGraph.leftTargetCoreId === ownerId) return { ownerId: targetId, frontType: "left" };
    if (enemyGraph.rightTargetCoreId === ownerId) return { ownerId: targetId, frontType: "right" };
    return null;
  }

  function sampleLanePolylinePoint(points, t) {
    if (!Array.isArray(points) || points.length === 0) return null;
    if (points.length === 1) return { x: points[0].x, y: points[0].y, angle: 0 };
    const segments = [];
    let totalLen = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const len = Math.hypot((b.x || 0) - (a.x || 0), (b.y || 0) - (a.y || 0));
      if (len <= 1e-6) continue;
      segments.push({ a, b, len });
      totalLen += len;
    }
    if (!segments.length) return { x: points[0].x || 0, y: points[0].y || 0, angle: 0 };
    let walk = totalLen * Math.max(0, Math.min(1, t));
    for (const segment of segments) {
      if (walk <= segment.len) {
        const lt = walk / segment.len;
        const angle = Math.atan2((segment.b.y || 0) - (segment.a.y || 0), (segment.b.x || 0) - (segment.a.x || 0));
        return {
          x: mfLerp(segment.a.x || 0, segment.b.x || 0, lt),
          y: mfLerp(segment.a.y || 0, segment.b.y || 0, lt),
          angle
        };
      }
      walk -= segment.len;
    }
    const last = segments[segments.length - 1];
    return {
      x: last.b.x || 0,
      y: last.b.y || 0,
      angle: Math.atan2((last.b.y || 0) - (last.a.y || 0), (last.b.x || 0) - (last.a.x || 0))
    };
  }

  function createFrontLaneLabelEntry(key) {
    let entry = frontLaneLabelPool.get(key);
    if (entry && entry.root && !entry.root.destroyed) {
      if (entry.root.parent !== frontLaneTextLayer) frontLaneTextLayer.addChild(entry.root);
      return entry;
    }
    const root = new PIXI.Container();
    const glow = new PIXI.Graphics();
    const bg = new PIXI.Graphics();
    const link = new PIXI.Graphics();
    const nameText = new PIXI.Text({
      text: "",
      style: {
        fontFamily: "ui-sans-serif, Arial",
        fontSize: 12,
        fontWeight: "700",
        fill: 0xe8f1ff,
        letterSpacing: 0.5
      }
    });
    const powerText = new PIXI.Text({
      text: "",
      style: {
        fontFamily: "ui-sans-serif, Arial",
        fontSize: 16,
        fontWeight: "900",
        fill: 0xffffff
      }
    });
    nameText.anchor.set(0.5, 1);
    powerText.anchor.set(0.5, 0);
    root.addChild(glow, bg, link, nameText, powerText);
    frontLaneTextLayer.addChild(root);
    entry = {
      root,
      glow,
      bg,
      link,
      nameText,
      powerText,
      layoutW: 0,
      layoutH: 0,
      layoutRadius: 0
    };
    frontLaneLabelPool.set(key, entry);
    return entry;
  }

  function prepareFrontLaneLabelEntry(entry, spec) {
    if (!entry || !spec) return;
    entry.nameText.text = String(spec.owner.name || "Игрок").slice(0, 18);
    entry.powerText.text = `Сила ${spec.strength}`;
    entry.nameText.style.fontSize = spec.nameSize;
    entry.powerText.style.fontSize = spec.powerSize;
    entry.nameText.style.fill = spec.nameFill;
    entry.powerText.style.fill = spec.powerFill;
    const cardW = Math.max(entry.nameText.width * 1.08, entry.powerText.width) + 30;
    const cardH = entry.nameText.height + entry.powerText.height + 20;
    entry.layoutW = cardW;
    entry.layoutH = cardH;
    entry.layoutRadius = Math.hypot(cardW * 0.44, cardH * 0.44);
  }

  function renderFrontLaneLabelEntry(entry, spec) {
    if (!entry || !spec) return;
    const pulse = 0.5 + 0.5 * Math.sin((state.t || 0) * (4.2 + spec.combatGlow * 1.8) + spec.ownerId * 0.73);
    const clashPulse = spec.combatGlow * pulse;
    const halfW = entry.layoutW * 0.5;
    const halfH = entry.layoutH * 0.5;
    const facingX = -spec.sideX * spec.outward;
    const facingY = -spec.sideY * spec.outward;
    const linkLen = 14 + spec.combatGlow * 14;
    const linkBaseX = facingX * (halfW - 14);
    const linkBaseY = facingY * Math.min(halfH - 8, 7);

    entry.root.visible = true;
    entry.root.position.set(spec.x, spec.y);
    entry.root.alpha = spec.alpha;

    entry.glow.clear();
    if (spec.combatGlow > 0.02) {
      entry.glow.roundRect(-halfW - 6, -halfH - 6, entry.layoutW + 12, entry.layoutH + 12, 20);
      entry.glow.fill({ color: spec.glowColor, alpha: 0.07 + clashPulse * 0.12 });
      entry.glow.roundRect(-halfW - 2, -halfH - 2, entry.layoutW + 4, entry.layoutH + 4, 18);
      entry.glow.stroke({ color: 0xffffff, width: 1.2, alpha: 0.10 + clashPulse * 0.18 });
    }

    entry.bg.clear();
    entry.bg.roundRect(-halfW, -halfH, entry.layoutW, entry.layoutH, 18);
    entry.bg.fill({ color: 0x06101a, alpha: 0.78 });
    entry.bg.roundRect(-halfW + 1.5, -halfH + 1.5, entry.layoutW - 3, entry.layoutH - 3, 16);
    entry.bg.fill({ color: spec.glowColor, alpha: 0.10 + spec.combatGlow * 0.14 });
    entry.bg.roundRect(-halfW, -halfH, entry.layoutW, entry.layoutH, 18);
    entry.bg.stroke({ color: spec.glowColor, width: 2.4 + spec.combatGlow * 1.4, alpha: 0.42 + spec.combatGlow * 0.30 });
    entry.bg.roundRect(-halfW + 5, halfH - 8, Math.max(18, entry.layoutW * (0.32 + spec.combatGlow * 0.18)), 3.5, 2);
    entry.bg.fill({ color: spec.glowColor, alpha: 0.40 + clashPulse * 0.22 });
    entry.bg.roundRect(-halfW + 1.2, -halfH + 1.2, entry.layoutW - 2.4, entry.layoutH - 2.4, 16);
    entry.bg.stroke({ color: 0xffffff, width: 0.9, alpha: 0.12 + clashPulse * 0.10 });

    entry.link.clear();
    entry.link.lineStyle(2.2 + spec.combatGlow * 0.8, spec.glowColor, 0.22 + spec.combatGlow * 0.26);
    entry.link.moveTo(linkBaseX, linkBaseY);
    entry.link.lineTo(linkBaseX + facingX * linkLen, linkBaseY + facingY * linkLen);
    entry.link.lineStyle(1.0, 0xffffff, 0.10 + spec.combatGlow * 0.10);
    entry.link.moveTo(linkBaseX + facingX * 2, linkBaseY + facingY * 2);
    entry.link.lineTo(linkBaseX + facingX * (linkLen - 2), linkBaseY + facingY * (linkLen - 2));
    entry.link.beginFill(spec.glowColor, 0.18 + spec.combatGlow * 0.20);
    entry.link.drawCircle(linkBaseX + facingX * linkLen, linkBaseY + facingY * linkLen, 3 + spec.combatGlow * 1.8);
    entry.link.endFill();

    entry.nameText.position.set(0, -2);
    entry.powerText.position.set(0, 2);
    entry.nameText.alpha = 0.92;
    entry.powerText.alpha = 0.96;
  }

  function resolveFrontLaneLabelLayout(labelSpecs) {
    if (!Array.isArray(labelSpecs) || labelSpecs.length === 0) return;
    for (const spec of labelSpecs) {
      spec.x = spec.baseX;
      spec.y = spec.baseY;
      spec.combatGlow = 0;
    }

    for (let i = 0; i < labelSpecs.length; i++) {
      const a = labelSpecs[i];
      for (let j = i + 1; j < labelSpecs.length; j++) {
        const b = labelSpecs[j];
        const opposing = a.enemyKey && b.enemyKey
          && (a.enemyKey === `${b.ownerId}:${b.frontType}` || b.enemyKey === `${a.ownerId}:${a.frontType}`);
        if (!opposing) continue;
        const sampleAx = a.sample ? a.sample.x || 0 : a.baseX;
        const sampleAy = a.sample ? a.sample.y || 0 : a.baseY;
        const sampleBx = b.sample ? b.sample.x || 0 : b.baseX;
        const sampleBy = b.sample ? b.sample.y || 0 : b.baseY;
        const sampleDist = Math.hypot(sampleBx - sampleAx, sampleBy - sampleAy);
        const intensity = clamp(1 - sampleDist / 360, 0, 1) * (a.hasPressure && b.hasPressure ? 1 : 0.65);
        if (intensity <= 0.001) continue;
        const inset = 12 + intensity * 20;
        a.x -= a.sideX * a.outward * inset;
        a.y -= a.sideY * a.outward * inset;
        b.x -= b.sideX * b.outward * inset;
        b.y -= b.sideY * b.outward * inset;
        a.combatGlow = Math.max(a.combatGlow, intensity);
        b.combatGlow = Math.max(b.combatGlow, intensity);
      }
    }

    for (let iter = 0; iter < 7; iter++) {
      for (let i = 0; i < labelSpecs.length; i++) {
        const a = labelSpecs[i];
        for (let j = i + 1; j < labelSpecs.length; j++) {
          const b = labelSpecs[j];
          const dx = (b.x || 0) - (a.x || 0);
          const dy = (b.y || 0) - (a.y || 0);
          let dist = Math.hypot(dx, dy);
          const opposing = a.enemyKey && b.enemyKey
            && (a.enemyKey === `${b.ownerId}:${b.frontType}` || b.enemyKey === `${a.ownerId}:${a.frontType}`);
          const gap = opposing ? 10 : (a.ownerId === b.ownerId ? 22 : 18);
          const minDist = (a.entry?.layoutRadius || 0) + (b.entry?.layoutRadius || 0) + gap;
          if (dist >= minDist) continue;
          let nx = 0;
          let ny = 0;
          if (dist > 0.001) {
            nx = dx / dist;
            ny = dy / dist;
          } else {
            nx = (a.sideX * a.outward) - (b.sideX * b.outward);
            ny = (a.sideY * a.outward) - (b.sideY * b.outward);
            const nl = Math.hypot(nx, ny) || 1;
            nx /= nl;
            ny /= nl;
            dist = 1;
          }
          const push = (minDist - dist) * 0.5;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
      for (const spec of labelSpecs) {
        const backX = spec.baseX - spec.x;
        const backY = spec.baseY - spec.y;
        spec.x += backX * 0.08;
        spec.y += backY * 0.08;
        const driftX = spec.x - spec.baseX;
        const driftY = spec.y - spec.baseY;
        const corridorSide = driftX * (spec.sideX * spec.outward) + driftY * (spec.sideY * spec.outward);
        if (corridorSide < -10) {
          spec.x -= (spec.sideX * spec.outward) * (corridorSide + 10);
          spec.y -= (spec.sideY * spec.outward) * (corridorSide + 10);
        }
        const driftLen = Math.hypot(spec.x - spec.baseX, spec.y - spec.baseY);
        if (driftLen > 96) {
          const scale = 96 / driftLen;
          spec.x = spec.baseX + (spec.x - spec.baseX) * scale;
          spec.y = spec.baseY + (spec.y - spec.baseY) * scale;
        }
      }
    }
  }

  function buildFrontLaneStrengthLabelSpec(owner, frontType, points, t, pressure) {
    const strength = getFrontLaneStrength(owner.id, frontType);
    if (!owner || strength <= 0) return null;
    const sample = pressure && pressure.sample ? pressure.sample : sampleLanePolylinePoint(points, t);
    if (!sample) return null;
    if (!inView(sample.x, sample.y)) return null;
    const sideAngle = sample.angle + Math.PI * 0.5;
    const sideX = Math.cos(sideAngle);
    const sideY = Math.sin(sideAngle);
    const outward = ((sample.x - (state.centerObjectives?.centerX || CFG.WORLD_W * 0.5)) * sideX + (sample.y - (state.centerObjectives?.centerY || CFG.WORLD_H * 0.5)) * sideY) >= 0 ? 1 : -1;
    const enemyLane = getOpposingLaneReference(owner.id, frontType);
    const enemyStrength = enemyLane ? getFrontLaneStrength(enemyLane.ownerId, enemyLane.frontType) : 0;
    const advantage = strength - enemyStrength;
    const zoom = cam.zoom || CFG.CAMERA_START_ZOOM || 0.22;
    const nameSize = Math.round(clamp(11 + (zoom - 0.16) * 12, 11, 18));
    const powerSize = Math.round(clamp(15 + (zoom - 0.16) * 18, 15, 27));
    const glowColor = owner.color || colorForId(owner.id);
    const powerFill = 0xffffff;
    const nameFill = glowColor;
    const outsideMeta = getLaneOutsideMeta(sample);
    const sideOffset = 90 + powerSize * 0.98;
    const backOffset = pressure && pressure.sample ? (42 + powerSize * 0.42) : 12;
    return {
      key: owner.id + ":" + frontType,
      owner,
      ownerId: owner.id,
      frontType,
      enemyKey: enemyLane ? `${enemyLane.ownerId}:${enemyLane.frontType}` : null,
      sample,
      hasPressure: !!(pressure && pressure.sample),
      strength,
      advantage,
      glowColor,
      powerFill,
      nameFill,
      nameSize,
      powerSize,
      sideX: outsideMeta.sideX,
      sideY: outsideMeta.sideY,
      outward: outsideMeta.outward,
      alpha: advantage > 0 ? 0.96 : advantage < 0 ? 0.86 : 0.78,
      baseX: sample.x - Math.cos(sample.angle) * backOffset + outsideMeta.sideX * outsideMeta.outward * sideOffset,
      baseY: sample.y - Math.sin(sample.angle) * backOffset + outsideMeta.sideY * outsideMeta.outward * sideOffset,
      x: 0,
      y: 0,
      combatGlow: 0,
      entry: null
    };
  }

  function updateFrontLaneOverlay() {
    if (!frontLaneGfx) return;
    frontLaneGfx.clear();
    for (const entry of frontLaneLabelPool.values()) {
      if (entry && entry.root && !entry.root.destroyed) entry.root.visible = false;
    }
    if (state._menuBackdropActive) {
      const p1 = state.players.get(1);
      const p2 = state.players.get(2);
      if (p1 && p2) {
        const duelPath = [{ x: p1.x || 0, y: p1.y || 0 }, { x: p2.x || 0, y: p2.y || 0 }];
        if (pointsBoundsInView(duelPath, 220)) {
          drawCorridorPolyline(frontLaneGfx, duelPath, 0x7ea8ff, 125, {
            fillAlpha: 0.0,
            coreAlpha: 0.0,
            edgeAlpha: 0.08,
            lightAlpha: 0.0,
            dashSpeed: 10
          });
        }
      }
      return;
    }
    const planner = getFrontPlannerApi();
    const allCorePlayers = [...state.players.values()].filter((p) => p && p.id > 0);
    const livePlayers = allCorePlayers.filter((p) => !p.eliminated);
    if (allCorePlayers.length === 0) return;

    const centerObjectives = state.centerObjectives || {};
    const center = {
      x: centerObjectives.centerX || CFG.WORLD_W * 0.5,
      y: centerObjectives.centerY || CFG.WORLD_H * 0.5
    };
    const pairEntries = getLaneAnchorEntries();
    const pairs = planner && planner.buildAdjacentCorePairs ? planner.buildAdjacentCorePairs(pairEntries, center) : [];

    for (const pair of pairs) {
      const path = [{ x: pair.a.x || 0, y: pair.a.y || 0 }, { x: pair.b.x || 0, y: pair.b.y || 0 }];
      if (!pointsBoundsInView(path, 220)) continue;
      drawCorridorPolyline(frontLaneGfx, path, 0x6d86cf, 125, {
        fillAlpha: 0.0,
        coreAlpha: 0.0,
        edgeAlpha: 0.07,
        lightAlpha: 0.0,
        dashSpeed: 26
      });
    }

    for (const anchor of pairEntries) {
      const anchorColor = anchor.ownerId ? colorForId(anchor.ownerId) : 0x7db8ff;
      const path = [{ x: anchor.x || 0, y: anchor.y || 0 }, { x: center.x, y: center.y }];
      if (pointsBoundsInView(path, 220)) {
        drawCorridorPolyline(frontLaneGfx, path, anchorColor, anchor.isSectorObjective ? 106 : 110, {
          fillAlpha: 0.0,
          coreAlpha: 0.0,
          edgeAlpha: anchor.isSectorObjective ? 0.07 : 0.08,
          lightAlpha: 0.0,
          dashSpeed: anchor.isSectorObjective ? 20 : 24
        });
      }
    }

    const laneLabelSpecs = [];
    for (const player of livePlayers) {
      const color = player.color || colorForId(player.id);
      const leftPoints = getLanePointsForPlayerFront(player, "left", center);
      const rightPoints = getLanePointsForPlayerFront(player, "right", center);
      const centerPoints = getLanePointsForPlayerFront(player, "center", center);
      const leftPressure = getFrontLanePressure(player.id, "left", leftPoints);
      const rightPressure = getFrontLanePressure(player.id, "right", rightPoints);
      const centerPressure = getFrontLanePressure(player.id, "center", centerPoints);
      if (leftPressure && leftPressure.points.length >= 2 && pointsBoundsInView(leftPressure.points, 140)) {
        drawOuterLanePressureLine(frontLaneGfx, leftPressure.points, leftPressure.sample, 77, color);
        drawLanePressureCap(frontLaneGfx, offsetLaneSampleOutside(leftPressure.sample, 77, 14), leftPressure.sample.angle, 20, color);
      }
      if (rightPressure && rightPressure.points.length >= 2 && pointsBoundsInView(rightPressure.points, 140)) {
        drawOuterLanePressureLine(frontLaneGfx, rightPressure.points, rightPressure.sample, 77, color);
        drawLanePressureCap(frontLaneGfx, offsetLaneSampleOutside(rightPressure.sample, 77, 14), rightPressure.sample.angle, 20, color);
      }
      if (centerPressure && centerPressure.points.length >= 2 && pointsBoundsInView(centerPressure.points, 120)) {
        drawOuterLanePressureLine(frontLaneGfx, centerPressure.points, centerPressure.sample, 60, color, 1);
        drawLanePressureCap(frontLaneGfx, offsetLaneSampleOutside(centerPressure.sample, 60, 14, 1), centerPressure.sample.angle, 18, color);
      }
      const leftLabel = buildFrontLaneStrengthLabelSpec(player, "left", leftPoints, 0.26, leftPressure);
      const rightLabel = buildFrontLaneStrengthLabelSpec(player, "right", rightPoints, 0.26, rightPressure);
      if (leftLabel) laneLabelSpecs.push(leftLabel);
      if (rightLabel) laneLabelSpecs.push(rightLabel);
    }

    for (const spec of laneLabelSpecs) {
      const entry = createFrontLaneLabelEntry(spec.key);
      prepareFrontLaneLabelEntry(entry, spec);
      spec.entry = entry;
    }
    resolveFrontLaneLabelLayout(laneLabelSpecs);
    for (const spec of laneLabelSpecs) {
      renderFrontLaneLabelEntry(spec.entry, spec);
    }

    const arenaRadius = getCenterArenaRadius();
    const pulse = 0.5 + 0.5 * Math.sin((state.t || 0) * 1.4);
    frontLaneGfx.lineStyle(2, 0xd8eeff, 0.14);
    frontLaneGfx.beginFill(0x6ea3ff, 0.038);
    frontLaneGfx.drawCircle(center.x, center.y, arenaRadius);
    frontLaneGfx.endFill();
    frontLaneGfx.lineStyle(1.2, 0xffffff, 0.08 + pulse * 0.03);
    frontLaneGfx.drawCircle(center.x, center.y, arenaRadius * 0.78);
  }

  function normalizeFloatingDamageText(text) {
    if (typeof text !== "string" || !text) return text;
    return text.replace(/-?\d+\.\d+/g, (match) => {
      const value = Number(match);
      if (!Number.isFinite(value)) return match;
      return String(Math.round(value));
    });
  }

  function updateFloatingDamage(dt) {
    destroyTransientChildren(floatingDamageLayer);
    for (let i = state.floatingDamage.length - 1; i >= 0; i--) {
      const fd = state.floatingDamage[i];
      fd.ttl -= dt;
      if (fd.ttl <= 0) {
        state.floatingDamage.splice(i, 1);
        continue;
      }
      const lift = (1 - fd.ttl) * 35;
      if (!rectInView(fd.x - 20, fd.y - lift - 20, fd.x + 20, fd.y + 20, 40)) continue;
      const txt = new PIXI.Text(normalizeFloatingDamageText(fd.text), { fontSize: 18, fill: fd.color, fontWeight: "bold" });
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
      destroyTransientChildren(announcementLayer);
      if (abilityAnnouncementLineEl) {
        abilityAnnouncementLineEl.textContent = "";
        abilityAnnouncementLineEl.classList.remove("visible");
      }
      return;
    }
    const w = app.renderer.width;
    destroyTransientChildren(announcementLayer);
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

  function refreshResourceVisual(r, vx = 0, vy = 0) {
    if (!r || !r.gfx || r.gfx.destroyed) return;
    const root = r.gfx;
    const packet = r._packetGfx;
    const dust = r._dustGfx;
    const speed = Math.hypot(vx, vy);
    let drawX = r.x || 0;
    let drawY = r.y || 0;
    if (packet) packet.rotation = speed > 0.001 ? Math.atan2(vy, vx) * 0.18 : 0;
    if (dust) dust.clear();
    if (r.type === "killPulse") {
      if (packet) packet.clear();
      const age = Math.max(0, (state.t || 0) - (r._spawnedAt || 0));
      const pulseIn = Math.min(1, age / 0.34);
      const pulse = 0.58 + 0.42 * Math.sin(age * 10 + (r.id || 0));
      const intensity = Math.max(1, Math.min(10, r._killCount || 1));
      const payload = Math.max(1, (r._xpValue || 0) + (r._creditValue || 0));
      const size = 8 + intensity * 1.05 + Math.min(7, Math.sqrt(payload) * 0.24);
      let dirX = speed > 0.001 ? (vx / speed) : 1;
      let dirY = speed > 0.001 ? (vy / speed) : 0;
      const routePoints = Array.isArray(r._killPulseRoutePoints) ? r._killPulseRoutePoints : null;
      const routeProgress = Math.max(0, r._killPulseRouteProgress || 0);
      let trailPoints = [];
      if (routePoints && routePoints.length >= 2) {
        const routeHead = samplePolylineAtDistance(routePoints, routeProgress);
        dirX = Math.cos(routeHead.angle || 0);
        dirY = Math.sin(routeHead.angle || 0);
        trailPoints = buildPolylineTrailByDistance(routePoints, routeProgress, size * (6.6 + pulse * 1.2), 8);
      }
      const perpX = -dirY;
      const perpY = dirX;
      const goldColor = 0xffcf63;
      const blueColor = 0x7fd6ff;
      const whiteColor = 0xf7fcff;
      const originX = drawX;
      const originY = drawY;
      if (trailPoints.length < 2) {
        trailPoints = [
          { x: originX - dirX * size * 4.4, y: originY - dirY * size * 4.4 },
          { x: originX, y: originY }
        ];
      }
      const localTrail = trailPoints.map((point) => ({ x: (point.x || 0) - originX, y: (point.y || 0) - originY }));
      const smoothTrail = localTrail.length >= 3
        ? buildRoundedLanePolyline(localTrail, Math.max(7, size * 0.62), 4)
        : localTrail;
      const edgeTrailOffset = size * 0.68;
      const edgeTrailA = buildElectricPolyline(offsetLanePolyline(smoothTrail, edgeTrailOffset), Math.max(0.9, size * 0.08), 0);
      const edgeTrailB = buildElectricPolyline(offsetLanePolyline(smoothTrail, -edgeTrailOffset), Math.max(0.9, size * 0.08), 1);
      drawRoundedLaneStroke(packet, edgeTrailA, Math.max(1.0, size * 0.14), goldColor, 0.12 + pulseIn * 0.04);
      drawRoundedLaneStroke(packet, edgeTrailB, Math.max(1.0, size * 0.14), blueColor, 0.12 + pulseIn * 0.04);
      drawRoundedLaneStroke(packet, edgeTrailA, Math.max(0.7, size * 0.05), whiteColor, 0.08 + pulse * 0.05);
      drawRoundedLaneStroke(packet, edgeTrailB, Math.max(0.7, size * 0.05), whiteColor, 0.08 + pulse * 0.05);
      const squareSize = size * 1.12;
      const halfSquare = squareSize * 0.5;
      packet.roundRect(-halfSquare, -halfSquare, squareSize, squareSize, Math.max(2, size * 0.18));
      packet.fill({ color: 0xf0f6ff, alpha: 0.16 + pulse * 0.08 });
      packet.roundRect(-halfSquare * 0.84, -halfSquare * 0.84, squareSize * 0.84, squareSize * 0.84, Math.max(1.4, size * 0.14));
      packet.fill({ color: goldColor, alpha: 0.26 + pulse * 0.10 });
      packet.roundRect(-halfSquare * 0.68, -halfSquare * 0.68, squareSize * 0.68, squareSize * 0.68, Math.max(1.2, size * 0.12));
      packet.fill({ color: blueColor, alpha: 0.24 + pulse * 0.10 });
      packet.roundRect(-halfSquare * 0.42, -halfSquare * 0.42, squareSize * 0.42, squareSize * 0.42, Math.max(1.0, size * 0.10));
      packet.fill({ color: whiteColor, alpha: 0.50 + pulse * 0.12 });
      packet.roundRect(-halfSquare, -halfSquare, squareSize, squareSize, Math.max(2, size * 0.18));
      packet.stroke({ color: 0xe8f4ff, width: Math.max(1.0, size * 0.06), alpha: 0.28 + pulse * 0.08 });
      const leakSpan = size * (1.48 + pulse * 0.28);
      const leftLeak = [
        { x: -dirX * size * 0.10, y: -dirY * size * 0.10 },
        { x: -dirX * size * 0.42 + perpX * leakSpan * 0.42, y: -dirY * size * 0.42 + perpY * leakSpan * 0.42 },
        { x: -dirX * size * 0.84 + perpX * leakSpan, y: -dirY * size * 0.84 + perpY * leakSpan }
      ];
      const rightLeak = [
        { x: -dirX * size * 0.10, y: -dirY * size * 0.10 },
        { x: -dirX * size * 0.42 - perpX * leakSpan * 0.42, y: -dirY * size * 0.42 - perpY * leakSpan * 0.42 },
        { x: -dirX * size * 0.84 - perpX * leakSpan, y: -dirY * size * 0.84 - perpY * leakSpan }
      ];
      drawRoundedLaneStroke(packet, buildElectricPolyline(leftLeak, size * 0.10, 0), Math.max(1.2, size * 0.14), goldColor, 0.34 + pulse * 0.10);
      drawRoundedLaneStroke(packet, buildElectricPolyline(rightLeak, size * 0.10, 1), Math.max(1.2, size * 0.14), blueColor, 0.34 + pulse * 0.10);
      if (dust && LOD.canDraw("gems")) {
        const dustTrail = smoothTrail.slice(0, Math.max(1, smoothTrail.length - 1));
        const dustCount = Math.min(4, 2 + Math.floor(intensity / 4));
        for (let i = 0; i < dustCount; i++) {
          const idx = Math.max(0, Math.floor((dustTrail.length - 1) * (i / Math.max(1, dustCount - 1))));
          const point = dustTrail[idx] || { x: -dirX * size * (2 + i), y: -dirY * size * (2 + i) };
          const wobble = Math.sin(age * 8 + i * 1.37 + (r._dustSeed || 0)) * size * 0.07;
          const alpha = Math.max(0.04, 0.13 - i * 0.022);
          dust.circle(point.x + perpX * (edgeTrailOffset * 0.82 + wobble), point.y + perpY * (edgeTrailOffset * 0.82 + wobble), Math.max(0.6, size * (0.06 - i * 0.008)));
          dust.fill({ color: goldColor, alpha });
          dust.circle(point.x - perpX * (edgeTrailOffset * 0.82 + wobble), point.y - perpY * (edgeTrailOffset * 0.82 + wobble), Math.max(0.6, size * (0.06 - i * 0.008)));
          dust.fill({ color: i % 2 === 0 ? goldColor : blueColor, alpha });
        }
      }
      packet.rotation = 0;
      root.scale.set(0.96 + pulseIn * 0.05);
      root.alpha = 0.96;
      root.position.set(drawX, drawY);
      return;
    }
    if (r._deathBurst && speed > 0.001) {
      const age = Math.max(0, (state.t || 0) - (r._spawnedAt || 0));
      const arcDur = 0.72;
      const arcFade = Math.max(0, 1 - age / arcDur);
      const arcPow = Math.sin(Math.min(1, age / arcDur) * Math.PI);
      const arc = arcPow * arcFade * (r._arcHeight || 18) * (r._arcSide || 1);
      const nx = vx / speed;
      const ny = vy / speed;
      drawX += -ny * arc;
      drawY += nx * arc;
      if (dust && LOD.canDraw("gems")) {
        const pulse = (state.t || 0) * 10 + (r._dustSeed || 0);
        for (let i = 0; i < 3; i++) {
          const trail = 5 + i * 6;
          const jitter = Math.sin(pulse + i * 1.17) * (1.6 - i * 0.35);
          const alpha = (0.34 - i * 0.09) * arcFade;
          if (alpha <= 0.01) continue;
          dust.circle(-nx * trail, -ny * trail + jitter, Math.max(0.7, 2.2 - i * 0.45));
          dust.fill({ color: 0xffd66b, alpha });
        }
      }
    }
    root.scale.set(1, 1);
    root.alpha = 1;
    root.position.set(drawX, drawY);
  }

  function makeResVisual(r) {
    const root = new PIXI.Container();
    const dust = new PIXI.Graphics();
    const packet = new PIXI.Graphics();
    root.addChild(dust, packet);
    if (r.type === "killPulse") {
      const intensity = Math.max(1, Math.min(8, (r._killCount || 1)));
      const glow = makeGlow(0xf4f8ff, 10 + intensity * 1.2, 0.34 + intensity * 0.028);
      if (glow) packet.filters = [glow];
      r.color = 0xdff4ff;
    } else {
      const isCredit = r.type === "credit";
      const value = isCredit ? (r.value || 1) : (r.xp || 1);
      ResourceFlow.drawPacket(packet, isCredit, value, cam.zoom);
      const glowCfg = ResourceFlow.getPacketGlow(isCredit, value, cam.zoom);
      const glow = glowCfg ? makeGlow(glowCfg.color, glowCfg.distance, glowCfg.outerStrength) : null;
      if (glow) packet.filters = [glow];
      if (isCredit) {
        r.color = FACTION_VIS.RESOURCE_COLORS.money.primary;
      } else {
        r.color = FACTION_VIS.RESOURCE_COLORS.xp.primary;
      }
    }
    root.position.set(r.x, r.y);
    resLayer.addChild(root);
    r.gfx = root;
    r._packetGfx = packet;
    r._dustGfx = dust;
    r._dustSeed = Math.random() * Math.PI * 2;
    refreshResourceVisual(r, 0, 0);
  }

  function queueKillRewardPulse(ownerId, x, y, xpValue, creditValue) {
    if (ownerId == null || !state.players.has(ownerId)) return;
    if (!state._killRewardPulseBatches) state._killRewardPulseBatches = new Map();
    let batch = state._killRewardPulseBatches.get(ownerId);
    if (!batch || state.t >= (batch.flushAt || 0)) {
      if (batch && state.t >= (batch.flushAt || 0)) {
        spawnKillRewardPulse(batch);
      }
      batch = {
        ownerId,
        startAt: state.t,
        flushAt: state.t + 3.0,
        count: 0,
        xp: 0,
        credits: 0,
        sumX: 0,
        sumY: 0
      };
      state._killRewardPulseBatches.set(ownerId, batch);
    }
    batch.count += 1;
    batch.xp += Math.max(0, xpValue || 0);
    batch.credits += Math.max(0, creditValue || 0);
    batch.sumX += x || 0;
    batch.sumY += y || 0;
  }

  function getKillPulseLaneJoinPoint(ownerId, x, y) {
    const owner = state.players.get(ownerId);
    if (!owner) return null;
    const center = {
      x: state.centerObjectives?.centerX || 0,
      y: state.centerObjectives?.centerY || 0
    };
    let best = null;
    for (const frontType of ["left", "center", "right"]) {
      const points = getLanePointsForPlayerFront(owner, frontType, center);
      const sample = projectPointOnPolyline(points, x, y);
      if (!sample) continue;
      const toJoin = [{ x: x || 0, y: y || 0 }];
      if (Math.hypot((sample.x || 0) - (x || 0), (sample.y || 0) - (y || 0)) > 1) {
        toJoin.push({ x: sample.x || 0, y: sample.y || 0 });
      }
      const baseSlice = slicePolylineToDistance(points, sample.progress || 0).reverse();
      const routePoints = mfConcatPointPaths([toJoin, baseSlice]);
      const smoothRoute = routePoints.length >= 3
        ? buildRoundedLanePolyline(routePoints, Math.max(54, Math.min(120, sample.dist + 54)), 5)
        : routePoints;
      const routeLength = polylineLength(smoothRoute);
      if (!best || sample.dist < best.dist) {
        best = {
          x: sample.x,
          y: sample.y,
          angle: sample.angle,
          dist: sample.dist,
          frontType,
          routePoints: smoothRoute,
          routeLength
        };
      }
    }
    return best ? {
      x: best.x,
      y: best.y,
      angle: best.angle,
      frontType: best.frontType,
      routePoints: best.routePoints,
      routeLength: best.routeLength
    } : null;
  }

  function getLaneAbilityFrontOptions(ownerId) {
    const owner = state.players.get(ownerId);
    if (!owner) return [];
    const center = {
      x: state.centerObjectives?.centerX || CFG.WORLD_W * 0.5,
      y: state.centerObjectives?.centerY || CFG.WORLD_H * 0.5
    };
    const options = [];
    for (const frontType of ["left", "center", "right"]) {
      const points = getLanePointsForPlayerFront(owner, frontType, center);
      if (!Array.isArray(points) || points.length < 2) continue;
      const totalLen = polylineLength(points);
      const startDist = Math.min(frontType === "center" ? 300 : 240, totalLen * 0.12);
      const travelPath = slicePolylineFromDistance(points, startDist);
      const spawnPoint = travelPath[0] || points[0];
      const nextPoint = travelPath[1] || points[1] || spawnPoint;
      const angle = Math.atan2((nextPoint.y || 0) - (spawnPoint.y || 0), (nextPoint.x || 0) - (spawnPoint.x || 0));
      options.push({
        ownerId,
        frontType,
        points,
        totalLen,
        laneHalfWidth: frontType === "center" ? 149 : 115,
        spawnPoint,
        previewPoint: sampleLanePolylinePoint(points, frontType === "center" ? 0.26 : 0.22) || spawnPoint,
        angle,
        waypoints: travelPath.slice(1).length > 0 ? travelPath.slice(1) : [{ x: nextPoint.x || spawnPoint.x || 0, y: nextPoint.y || spawnPoint.y || 0 }]
      });
    }
    return options;
  }

  function spawnLaneAbilityUnits(ownerId, frontType, unitTypeKey, count, opts) {
    const option = getLaneAbilityFrontOptions(ownerId).find((entry) => entry.frontType === frontType) || getLaneAbilityFrontOptions(ownerId)[0];
    if (!option || !count) return { ok: false, reason: "no_front" };
    const spawnCount = Math.max(1, count | 0);
    const sourceTag = (opts && opts.sourceTag) || ("ability:" + unitTypeKey + ":" + frontType);
    const sideAngle = option.angle + Math.PI * 0.5;
    const spread = opts && opts.spread != null ? opts.spread : (unitTypeKey === "fighter" ? 26 : 42);
    let spawned = 0;
    for (let i = 0; i < spawnCount; i++) {
      const sideOffset = (i - (spawnCount - 1) * 0.5) * spread;
      const forwardOffset = (opts && opts.forwardStep != null ? opts.forwardStep : 10) * i;
      const sx = option.spawnPoint.x + Math.cos(sideAngle) * sideOffset + Math.cos(option.angle) * forwardOffset;
      const sy = option.spawnPoint.y + Math.sin(sideAngle) * sideOffset + Math.sin(option.angle) * forwardOffset;
      const unit = spawnUnitAt(sx, sy, ownerId, unitTypeKey, cloneWaypointsSafe(option.waypoints), {
        sourceTag,
        frontType: option.frontType,
        autoGroupUntil: (state.t || 0) + 5,
        allowAutoJoinRecentSpawn: true
      });
      if (!unit) continue;
      if (unit.squadId != null) seedFrontAssignment(ownerId, unit.squadId, option.frontType);
      if (opts && typeof opts.mutateUnit === "function") opts.mutateUnit(unit, i, option);
      spawned++;
    }
    return { ok: spawned > 0, spawned, frontType: option.frontType, previewPoint: option.previewPoint };
  }

  function spawnKillRewardPulse(batch) {
    if (!batch || !batch.count || !state.players.has(batch.ownerId)) return;
    if (state.res.size >= (CFG.RES_MAX ?? 520)) {
      const firstId = state.res.keys().next().value;
      if (firstId != null) deleteResource(firstId);
    }
    const owner = state.players.get(batch.ownerId);
    const avgX = batch.sumX / Math.max(1, batch.count);
    const avgY = batch.sumY / Math.max(1, batch.count);
    const totalPayload = Math.max(1, (batch.xp || 0) + (batch.credits || 0));
    const id = state.nextResId++;
    const laneRoute = getKillPulseLaneJoinPoint(batch.ownerId, avgX, avgY);
    const pulse = {
      id,
      type: "killPulse",
      value: totalPayload,
      x: avgX,
      y: avgY,
      color: owner ? (owner.color || colorForId(owner.id)) : 0x9dd7ff,
      gfx: null,
      _spawnedAt: state.t,
      _targetCity: batch.ownerId,
      _visualOnly: true,
      _impulsePacket: true,
      _killCount: batch.count,
      _xpValue: batch.xp || 0,
      _creditValue: batch.credits || 0,
      _laneJoinPoint: laneRoute ? { x: laneRoute.x, y: laneRoute.y, angle: laneRoute.angle, frontType: laneRoute.frontType } : null,
      _killPulseRoutePoints: laneRoute && Array.isArray(laneRoute.routePoints) ? laneRoute.routePoints : null,
      _killPulseRouteLength: laneRoute ? (laneRoute.routeLength || 0) : 0,
      _killPulseRouteProgress: 0
    };
    state.res.set(id, pulse);
    makeResVisual(pulse);
  }

  function flushKillRewardPulses() {
    if (!state._killRewardPulseBatches || state._killRewardPulseBatches.size === 0) return;
    for (const [ownerId, batch] of state._killRewardPulseBatches) {
      if (!batch || state.t < (batch.flushAt || 0)) continue;
      spawnKillRewardPulse(batch);
      state._killRewardPulseBatches.delete(ownerId);
    }
  }

  // ------------------------------------------------------------
  // Fog of war (RenderTexture)
  // ------------------------------------------------------------
  const FOG_BASE_W = Math.max(1, Math.floor(CFG.WORLD_W / 2));
  const FOG_BASE_H = Math.max(1, Math.floor(CFG.WORLD_H / 2));
  const FOG_MAX_DIM = LOW_GPU_MODE ? 1024 : 1536;
  const FOG_RT_SCALE = Math.min(1, FOG_MAX_DIM / Math.max(FOG_BASE_W, FOG_BASE_H));
  const FOG_RT_W = Math.max(1, Math.floor(FOG_BASE_W * FOG_RT_SCALE));
  const FOG_RT_H = Math.max(1, Math.floor(FOG_BASE_H * FOG_RT_SCALE));
  const fogRT = PIXI.RenderTexture.create({
    width: FOG_RT_W,
    height: FOG_RT_H,
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
    if (LOD.getLevel(cam.zoom) !== LOD.LEVELS.NEAR) return;

    const ps = [...state.players.values()];
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        if (a.influenceR + b.influenceR < Math.hypot(a.x - b.x, a.y - b.y)) continue;
        const mx = (a.x + b.x) * 0.5;
        const my = (a.y + b.y) * 0.5;
        if (!isPointInPolygon(mx, my, a.influencePolygon) || !isPointInPolygon(mx, my, b.influencePolygon)) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const rr = Math.max(10, Math.min(70, (a.influenceR + b.influenceR - d) * 0.16));

        overlapG.beginFill(0x4a1520, 0.10);
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
  // ── Fixed spawn positions for duel / 4-player square ──
  function getFixedSpawnPositions(count) {
    return requireSharedMatchBootstrapApi().getFixedSpawnPositions(count);
  }

  // ── Mine placement ──
  let nextMineId = 1;
  const MINE_RESOURCE_TYPES = ["money", "xp"];
  function getMinePrimaryResourceType(mine) {
    return mine && mine.resourceType === "xp" ? "xp" : "money";
  }
  function getMineOutputResourceTypes(mine) {
    return mine && mine.isRich ? MINE_RESOURCE_TYPES : [getMinePrimaryResourceType(mine)];
  }
  function getMineFlowRouteKey(mine, resourceType) {
    return `${mine.id}:${resourceType}`;
  }
  function mineHexPoints(radius, rotation = -Math.PI / 6) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + rotation;
      pts.push(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    return pts;
  }
  function createMine(x, y, ownerId, isRich, resourceType, opts) {
    opts = opts || {};
    const id = nextMineId++;
    const mine = {
      id, x, y,
      ownerId: ownerId || null,
      captureProgress: ownerId ? 1 : 0,
      capturingUnitId: null,
      isRich: !!isRich,
      resourceType: resourceType || "money",
      yieldAcc: 0,
      gfx: null,
      laneRole: opts.laneRole || null,
      pairKey: opts.pairKey || null,
      homeMine: !!opts.homeMine,
      instantLaneTrigger: opts.triggerTo ? { x: opts.triggerTo.x || 0, y: opts.triggerTo.y || 0 } : null,
      sectorObjectiveId: opts.sectorObjectiveId || null
    };
    state.mines.set(id, mine);
    makeMineVisual(mine);
    return mine;
  }

  function clearMineVisuals() {
    for (const mine of state.mines.values()) {
      if (!mine || !mine.gfx) continue;
      if (mine.gfx.parent) mine.gfx.parent.removeChild(mine.gfx);
      mine.gfx.destroy(true);
      mine.gfx = null;
    }
  }

  function destroySectorObjectiveVisual(objective) {
    if (!objective || !objective.gfx) return;
    if (objective.gfx.parent) objective.gfx.parent.removeChild(objective.gfx);
    objective.gfx.destroy(true);
    objective.gfx = null;
  }

  function clearSectorObjectiveVisuals() {
    for (const objective of state.sectorObjectives || []) destroySectorObjectiveVisual(objective);
    state.sectorObjectives = [];
  }

  function createSectorObjective(x, y, opts) {
    opts = opts || {};
    const objective = {
      id: opts.id || ("sector-objective-" + Math.round(x) + "-" + Math.round(y)),
      anchorId: opts.anchorId != null ? opts.anchorId : null,
      x,
      y,
      ownerId: opts.ownerId || null,
      linkedMineIds: Array.isArray(opts.linkedMineIds) ? opts.linkedMineIds.slice() : [],
      captureRadius: opts.captureRadius || Math.max((CFG.MINE_CAPTURE_RADIUS || 140) * 0.9, 120),
      visualRadius: opts.visualRadius || 54,
      gfx: null,
      _visualOwnerId: undefined,
      _touchProtectedUntil: 0
    };
    state.sectorObjectives = state.sectorObjectives || [];
    state.sectorObjectives.push(objective);
    return objective;
  }

  function makeSectorObjectiveVisual(objective) {
    if (!objective) return;
    destroySectorObjectiveVisual(objective);
    const ownerCol = objective.ownerId ? colorForId(objective.ownerId) : 0x7db8ff;
    const accentCol = objective.ownerId ? ownerCol : 0xffd27a;
    const R = objective.visualRadius || 54;
    const c = new PIXI.Container();

    const outerGlow = new PIXI.Graphics();
    outerGlow.circle(0, 0, R + 18);
    outerGlow.fill({ color: ownerCol, alpha: objective.ownerId ? 0.12 : 0.08 });
    c.addChild(outerGlow);
    c._outerGlow = outerGlow;

    const captureRing = new PIXI.Graphics();
    captureRing.circle(0, 0, objective.captureRadius || Math.max((CFG.MINE_CAPTURE_RADIUS || 140) * 0.9, 120));
    captureRing.stroke({ color: ownerCol, width: 1.1, alpha: objective.ownerId ? 0.18 : 0.14 });
    captureRing.circle(0, 0, objective.captureRadius || Math.max((CFG.MINE_CAPTURE_RADIUS || 140) * 0.9, 120));
    captureRing.fill({ color: ownerCol, alpha: objective.ownerId ? 0.018 : 0.012 });
    c.addChild(captureRing);
    c._captureRing = captureRing;

    const shell = new PIXI.Graphics();
    shell.circle(0, 0, R * 0.98);
    shell.fill({ color: 0x08111c, alpha: 0.94 });
    shell.circle(0, 0, R * 0.98);
    shell.stroke({ color: ownerCol, width: 2.0, alpha: 0.74 });
    shell.circle(0, 0, R * 0.72);
    shell.stroke({ color: accentCol, width: 1.1, alpha: 0.42 });
    c.addChild(shell);

    const spokes = new PIXI.Graphics();
    for (let i = 0; i < 4; i++) {
      const ang = Math.PI * 0.25 + i * (Math.PI * 0.5);
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      spokes.moveTo(cos * R * 0.24, sin * R * 0.24);
      spokes.lineTo(cos * R * 0.72, sin * R * 0.72);
    }
    spokes.stroke({ color: accentCol, width: 1.0, alpha: 0.32 });
    c.addChild(spokes);

    const core = new PIXI.Graphics();
    core.poly([
      0, -R * 0.26,
      R * 0.24, 0,
      0, R * 0.26,
      -R * 0.24, 0
    ]);
    core.fill({ color: accentCol, alpha: 0.60 });
    core.poly([
      0, -R * 0.26,
      R * 0.24, 0,
      0, R * 0.26,
      -R * 0.24, 0
    ]);
    core.stroke({ color: 0xffffff, width: 0.9, alpha: 0.32 });
    core.circle(0, 0, R * 0.08);
    core.fill({ color: 0xffffff, alpha: 0.78 });
    c.addChild(core);
    c._core = core;

    const orbitals = new PIXI.Container();
    c.addChild(orbitals);
    c._orbitals = orbitals;
    for (let i = 0; i < 4; i++) {
      const orb = new PIXI.Graphics();
      orb.circle(0, 0, R * 0.06);
      orb.fill({ color: i % 2 === 0 ? accentCol : 0xffffff, alpha: i % 2 === 0 ? 0.48 : 0.34 });
      orb._orbitAngle = (Math.PI * 2 * i) / 4;
      orb._orbitRadius = R * (0.72 + i * 0.06);
      orb._orbitSpeed = 0.22 + i * 0.05;
      orbitals.addChild(orb);
    }

    c.x = objective.x || 0;
    c.y = objective.y || 0;
    objective._visualOwnerId = objective.ownerId || null;
    objective.gfx = c;
    mineLayer.addChild(c);
  }

  function updateSectorObjectiveAmbientVisuals() {
    for (const objective of state.sectorObjectives || []) {
      if (!objective) continue;
      if (!objective.gfx || objective._visualOwnerId !== (objective.ownerId || null)) makeSectorObjectiveVisual(objective);
      const gfx = objective.gfx;
      if (!gfx || gfx.destroyed) continue;
      if (!inView(objective.x, objective.y)) {
        gfx.visible = false;
        continue;
      }
      gfx.visible = true;
      const pulse = 0.5 + 0.5 * Math.sin(state.t * 1.9 + (objective.anchorId || 0) * 0.7);
      const slowPulse = 0.5 + 0.5 * Math.sin(state.t * 0.8 + (objective.anchorId || 0) * 1.13);
      const ownerCol = objective.ownerId ? colorForId(objective.ownerId) : 0x7db8ff;
      const ownedMul = objective.ownerId ? 1 : 0.72;
      if (gfx._outerGlow) {
        gfx._outerGlow.alpha = (0.30 + pulse * 0.22) * ownedMul;
        gfx._outerGlow.scale.set(1 + pulse * 0.05);
      }
      if (gfx._captureRing) {
        gfx._captureRing.alpha = 0.56 + slowPulse * 0.22;
        gfx._captureRing.scale.set(1 + slowPulse * 0.03);
      }
      if (gfx._core) {
        gfx._core.alpha = 0.74 + pulse * 0.22;
        gfx._core.scale.set(1 + pulse * 0.07);
      }
      if (gfx._orbitals) {
        for (const orb of gfx._orbitals.children) {
          const ang = state.t * (orb._orbitSpeed || 0.25) + (orb._orbitAngle || 0);
          const rr = (orb._orbitRadius || 20) * (1 + slowPulse * 0.02);
          orb.position.set(Math.cos(ang) * rr, Math.sin(ang) * rr);
          orb.alpha = 0.32 + pulse * 0.34;
          orb.tint = ownerCol;
        }
      }
    }
  }

  function syncSectorObjectivesFromSnapshot(objectives, isFull) {
    const incoming = Array.isArray(objectives) ? objectives : null;
    if (!incoming) {
      if (isFull) clearSectorObjectiveVisuals();
      return;
    }
    const prevById = new Map((state.sectorObjectives || []).map((objective) => [objective.id, objective]));
    const next = [];
    for (const item of incoming) {
      if (!item || item.id == null) continue;
      const existing = prevById.get(item.id) || {
        id: item.id,
        anchorId: null,
        x: 0,
        y: 0,
        ownerId: null,
        linkedMineIds: [],
        captureRadius: Math.max((CFG.MINE_CAPTURE_RADIUS || 140) * 0.9, 120),
        visualRadius: 54,
        gfx: null,
        _visualOwnerId: undefined,
        _touchProtectedUntil: 0
      };
      prevById.delete(item.id);
      existing.anchorId = item.anchorId != null ? item.anchorId : existing.anchorId;
      existing.x = item.x || 0;
      existing.y = item.y || 0;
      existing.ownerId = item.ownerId || null;
      existing.linkedMineIds = Array.isArray(item.linkedMineIds) ? item.linkedMineIds.slice() : [];
      existing.captureRadius = item.captureRadius || existing.captureRadius;
      existing.visualRadius = item.visualRadius || existing.visualRadius || 54;
      next.push(existing);
    }
    for (const stale of prevById.values()) destroySectorObjectiveVisual(stale);
    state.sectorObjectives = next;
  }

  function placeMines(entries, rndFn) {
    clearMineVisuals();
    clearSectorObjectiveVisuals();
    state.mines.clear();
    nextMineId = 1;
    const cx = CFG.WORLD_W * 0.5, cy = CFG.WORLD_H * 0.5;

    const centerMine = createMine(cx, cy, null, true);
    setPirateBases([{
      id: "pirate-base-center",
      x: cx,
      y: cy,
      hp: 4000,
      maxHp: 4000,
      lastDamagedBy: null,
      gfx: null,
      _emojiGfx: null,
      spawnCd: 0,
      unitLimit: 12,
      atkCd: 0,
      attackRange: Math.round(PIRATE_BASE_ATTACK_RANGE * 1.1),
      orbitCenter: { x: cx, y: cy },
      orbitRadius: 150,
      patrolAngleDeg: 0,
      _respawnTimer: 0,
      _initialSpawned: false
    }]);
    centerMine.ownerId = null;
    centerMine.captureProgress = 0;
    centerMine._captureProtectedUntil = Number.POSITIVE_INFINITY;
    centerMine._pirateLocked = true;
    centerMine._richYieldMultiplier = 3;
    updateMineVisual(centerMine);

    const inflR = CFG.INFLUENCE_R(CFG.POP_START);
    const rnd = rndFn || (() => Math.random());
    const planner = getFrontPlannerApi();
    const laneEntries = entries.map((entry) => ({
      id: entry.ownerId != null ? entry.ownerId : (entry.virtualId != null ? entry.virtualId : null),
      x: entry.pos.x,
      y: entry.pos.y
    }));
    for (const entry of entries) {
      const sp = entry.pos;
      const pid = entry.ownerId;
      const linkedMineIds = [];
      const startCount = CFG.MINE_START_PER_PLAYER;
      for (let m = 0; m < startCount; m++) {
        const baseAngle = Math.atan2(sp.y - cy, sp.x - cx);
        const spread = ((m - (startCount - 1) / 2) / Math.max(1, startCount - 1)) * 1.4;
        const a = baseAngle + spread + (rnd() * 0.15);
        const d = inflR * 0.80 + rnd() * (inflR * 0.12);
        const resType = m < Math.ceil(startCount / 2) ? "money" : "xp";
        const mine = createMine(
          clamp(sp.x + Math.cos(a) * d, 40, CFG.WORLD_W - 40),
          clamp(sp.y + Math.sin(a) * d, 40, CFG.WORLD_H - 40),
          pid, false, resType,
          {
            homeMine: pid != null,
            sectorObjectiveId: pid == null ? (entry.sectorObjectiveId || null) : null
          }
        );
        if (pid == null) linkedMineIds.push(mine.id);
      }
      if (pid == null && entry.sectorObjectiveId) {
        createSectorObjective(sp.x, sp.y, {
          id: entry.sectorObjectiveId,
          anchorId: entry.virtualId != null ? entry.virtualId : null,
          linkedMineIds,
          captureRadius: Math.max((CFG.MINE_CAPTURE_RADIUS || 140) * 0.92, 128)
        });
      }
    }

    const sideLaneMines = planner && planner.buildSideLaneMinePlacements
      ? planner.buildSideLaneMinePlacements(laneEntries, { x: cx, y: cy })
      : [];
    for (const mine of sideLaneMines) {
      createMine(
        clamp(mine.x, 48, CFG.WORLD_W - 48),
        clamp(mine.y, 48, CFG.WORLD_H - 48),
        null,
        false,
        mine.resourceType || "money",
        mine
      );
    }
    refreshPirateBaseOrbitAnchors();
  }

  function makeMineVisual(mine) {
    if (mine.gfx) { mine.gfx.destroy(true); mine.gfx = null; }
    const c = new PIXI.Container();
    const R = (mine.isRich ? 36 : 28) * 2;
    const ownerCol = mine.ownerId ? colorForId(mine.ownerId) : 0x555555;
    const isHybrid = !!mine.isRich;
    const primaryType = getMinePrimaryResourceType(mine);
    const isMoney = !isHybrid && primaryType === "money";
    const moneyCol = FACTION_VIS.RESOURCE_COLORS.money;
    const xpCol = FACTION_VIS.RESOURCE_COLORS.xp;
    const resCol = isMoney ? moneyCol : xpCol;
    const shellCol = mine.ownerId ? ownerCol : (isHybrid ? 0x8fa8ff : resCol.primary);

    const outerGlow = new PIXI.Graphics();
    outerGlow.circle(0, 0, R + 8);
    outerGlow.fill({ color: mine.ownerId ? ownerCol : (isHybrid ? 0x263b5a : resCol.bg), alpha: mine.ownerId ? 0.10 : 0.06 });
    c.addChild(outerGlow);
    c._outerGlow = outerGlow;

    const pulseHalo = new PIXI.Graphics();
    if (isHybrid) {
      pulseHalo.poly(mineHexPoints(R * 0.96));
      pulseHalo.stroke({ color: moneyCol.secondary, width: 1.0, alpha: 0.16 });
      pulseHalo.circle(0, 0, R * 0.88);
      pulseHalo.stroke({ color: xpCol.secondary, width: 0.95, alpha: 0.14 });
    } else if (isMoney) {
      const haloR = R * 0.96;
      pulseHalo.poly(mineHexPoints(haloR));
      pulseHalo.stroke({ color: mine.ownerId ? ownerCol : resCol.secondary, width: 1.2, alpha: 0.20 });
    } else {
      pulseHalo.circle(0, 0, R * 0.92);
      pulseHalo.stroke({ color: mine.ownerId ? ownerCol : resCol.secondary, width: 1.15, alpha: 0.22 });
    }
    c.addChildAt(pulseHalo, 0);
    c._pulseHalo = pulseHalo;

    const bg = new PIXI.Graphics();
    if (isHybrid) {
      const hexR = R * 0.82;
      bg.poly(mineHexPoints(hexR));
      bg.fill({ color: 0x09111b, alpha: 0.94 });
      bg.poly(mineHexPoints(hexR));
      bg.stroke({ color: shellCol, width: 1.8, alpha: 0.76 });
      bg.circle(0, 0, R * 0.60);
      bg.stroke({ color: xpCol.secondary, width: 1.0, alpha: 0.38 });
      bg.circle(0, 0, R * 0.44);
      bg.fill({ color: 0x0e1a28, alpha: 0.70 });
      bg.poly(mineHexPoints(R * 0.30));
      bg.fill({ color: moneyCol.primary, alpha: 0.20 });
      bg.circle(0, 0, R * 0.22);
      bg.fill({ color: xpCol.primary, alpha: 0.22 });
    } else if (isMoney) {
      const hexR = R * 0.78;
      bg.poly(mineHexPoints(hexR));
      bg.fill({ color: 0x0b1018, alpha: 0.92 });
      bg.poly(mineHexPoints(hexR));
      bg.stroke({ color: shellCol, width: 1.7, alpha: 0.72 });
      bg.poly(mineHexPoints(hexR * 0.56));
      bg.fill({ color: resCol.primary, alpha: 0.28 });
      bg.poly(mineHexPoints(hexR * 0.34));
      bg.stroke({ color: resCol.secondary, width: 0.9, alpha: 0.28 });
    } else {
      bg.circle(0, 0, R * 0.76);
      bg.fill({ color: 0x081019, alpha: 0.92 });
      bg.circle(0, 0, R * 0.76);
      bg.stroke({ color: shellCol, width: 1.7, alpha: 0.72 });
      bg.circle(0, 0, R * 0.44);
      bg.stroke({ color: resCol.secondary, width: 0.95, alpha: 0.42 });
      bg.circle(0, 0, R * 0.24);
      bg.fill({ color: resCol.primary, alpha: 0.26 });
      bg.circle(0, 0, R * 0.60);
      bg.stroke({ color: resCol.primary, width: 0.65, alpha: 0.20 });
    }
    c.addChild(bg);

    const coreGlow = new PIXI.Graphics();
    coreGlow.circle(0, 0, R * (mine.isRich ? 0.42 : 0.34));
    coreGlow.fill({ color: isHybrid ? moneyCol.primary : (isMoney ? moneyCol.primary : xpCol.primary), alpha: mine.isRich ? 0.18 : 0.13 });
    c.addChild(coreGlow);
    c._coreGlow = coreGlow;
    if (isHybrid) {
      const secondaryGlow = new PIXI.Graphics();
      secondaryGlow.circle(0, 0, R * 0.34);
      secondaryGlow.fill({ color: xpCol.primary, alpha: 0.14 });
      c.addChild(secondaryGlow);
      c._coreGlowSecondary = secondaryGlow;
    }

    if (mine.isRich) {
      const richCore = new PIXI.Graphics();
      richCore.circle(0, 0, R * 0.22);
      richCore.fill({ color: 0xffe18a, alpha: 0.20 });
      richCore.circle(0, 0, R * 0.15);
      richCore.fill({ color: 0x7fd8ff, alpha: 0.18 });
      richCore.circle(0, 0, R * 0.09);
      richCore.fill({ color: 0xffffff, alpha: 0.58 });
      c.addChild(richCore);
      c._richCore = richCore;
    }

    const orbitals = new PIXI.Container();
    c.addChild(orbitals);
    c._richOrbitals = orbitals;
    const orbitalCount = mine.isRich ? 6 : 4;
    for (let i = 0; i < orbitalCount; i++) {
      const orbitalType = isHybrid ? (i % 2 === 0 ? "money" : "xp") : primaryType;
      const orbRes = orbitalType === "money" ? moneyCol : xpCol;
      const orb = new PIXI.Graphics();
      if (orbitalType === "money") {
        orb.poly(mineHexPoints(R * (mine.isRich ? 0.05 : 0.042)));
        orb.fill({ color: i % 3 === 1 ? 0xffffff : orbRes.primary, alpha: i % 3 === 1 ? 0.52 : 0.66 });
      } else {
        orb.circle(0, 0, R * (mine.isRich ? 0.050 : 0.044));
        orb.fill({ color: i % 3 === 1 ? 0xffffff : (i % 2 === 0 ? orbRes.primary : orbRes.secondary), alpha: i % 3 === 1 ? 0.48 : 0.62 });
      }
      orb._orbitAngle = (Math.PI * 2 * i) / orbitalCount;
      orb._orbitRadius = R * (mine.isRich ? (0.72 + i * 0.045) : (0.66 + i * 0.035));
      orb._orbitSpeed = (mine.isRich ? 0.34 : 0.26) + i * 0.05;
      orb._orbitPhase = i * 1.37;
      orbitals.addChild(orb);
    }

    const core = new PIXI.Graphics();
    if (isHybrid) {
      core.poly(mineHexPoints(R * 0.16));
      core.fill({ color: moneyCol.primary, alpha: 0.60 });
      core.circle(0, 0, R * 0.11);
      core.fill({ color: xpCol.primary, alpha: 0.54 });
      core.circle(0, 0, R * 0.045);
      core.fill({ color: 0xffffff, alpha: 0.72 });
    } else if (isMoney) {
      const rr = R * 0.18;
      core.poly(mineHexPoints(rr));
      core.fill({ color: resCol.primary, alpha: 0.72 });
      core.poly(mineHexPoints(rr));
      core.stroke({ color: resCol.secondary, width: 0.8, alpha: 0.55 });
    } else {
      core.circle(0, 0, R * 0.16);
      core.fill({ color: resCol.primary, alpha: 0.62 });
      core.circle(0, 0, R * 0.07);
      core.fill({ color: 0xffffff, alpha: 0.65 });
    }
    c.addChild(core);

    const captureR = CFG.MINE_CAPTURE_RADIUS || 140;
    const capRing = new PIXI.Graphics();
    capRing.circle(0, 0, captureR);
    capRing.stroke({ color: shellCol, width: 1.0, alpha: 0.14 });
    capRing.circle(0, 0, captureR);
    capRing.fill({ color: mine.ownerId ? ownerCol : resCol.bg, alpha: 0.02 });
    c.addChildAt(capRing, 0);

    if (mine.ownerId && mine.captureProgress >= 1) {
      const ownerGlow = new PIXI.Graphics();
      ownerGlow.circle(0, 0, R * 0.66);
      ownerGlow.fill({ color: ownerCol, alpha: 0.10 });
      c.addChildAt(ownerGlow, 0);
    }

    c.x = mine.x;
    c.y = mine.y;
    c._baseRadius = R;
    mine.gfx = c;
    mineLayer.addChild(c);
  }

  function updateMineVisual(mine) {
    makeMineVisual(mine);
  }

  function updateMineAmbientVisuals() {
    for (const mine of state.mines.values()) {
      const gfx = mine.gfx;
      if (!gfx || gfx.destroyed) continue;
      if (mine._pirateLocked) {
        gfx.visible = false;
        continue;
      }
      if (!inView(mine.x, mine.y)) {
        gfx.visible = false;
        continue;
      }
      gfx.visible = true;
      const pulse = 0.5 + 0.5 * Math.sin(state.t * 2.0 + mine.id * 0.73);
      const slowPulse = 0.5 + 0.5 * Math.sin(state.t * 0.9 + mine.id * 1.91);
      const owned = !!(mine.ownerId && mine.captureProgress >= 1);
      const contestedMul = mine._contested ? 0.65 : 1;

      if (gfx._outerGlow) {
        gfx._outerGlow.alpha = ((owned ? 0.78 : 0.52) + pulse * 0.18) * contestedMul;
        const outerScale = 1 + pulse * (mine.isRich ? 0.024 : 0.016);
        gfx._outerGlow.scale.set(outerScale);
      }
      if (gfx._pulseHalo) {
        gfx._pulseHalo.alpha = (0.42 + pulse * 0.24) * contestedMul;
        const haloScale = 1 + slowPulse * (mine.isRich ? 0.05 : 0.032);
        gfx._pulseHalo.scale.set(haloScale);
      }
      if (gfx._coreGlow) {
        gfx._coreGlow.alpha = (mine.isRich ? 0.90 : 0.64) * (0.52 + pulse * 0.48);
        gfx._coreGlow.scale.set(1 + pulse * (mine.isRich ? 0.09 : 0.05));
      }
      if (gfx._coreGlowSecondary) {
        gfx._coreGlowSecondary.alpha = (mine.isRich ? 0.76 : 0.42) * (0.46 + slowPulse * 0.44);
        gfx._coreGlowSecondary.scale.set(1 + slowPulse * (mine.isRich ? 0.08 : 0.04));
      }
      if (gfx._richCore) {
        gfx._richCore.alpha = 0.72 + pulse * 0.28;
        gfx._richCore.scale.set(1 + pulse * 0.06);
      }
      if (gfx._richOrbitals) {
        gfx._richOrbitals.alpha = (mine.isRich ? 0.66 : 0.44) + slowPulse * (mine.isRich ? 0.18 : 0.10);
        for (let i = 0; i < gfx._richOrbitals.children.length; i++) {
          const orb = gfx._richOrbitals.children[i];
          const ang = state.t * (orb._orbitSpeed || 0.4) + (orb._orbitAngle || 0);
          const rr = (orb._orbitRadius || gfx._baseRadius * 0.82) * (1 + Math.sin(state.t * 1.7 + (orb._orbitPhase || 0)) * 0.04);
          orb.position.set(Math.cos(ang) * rr, Math.sin(ang) * rr);
          orb.alpha = (mine.isRich ? 0.48 : 0.28) + (0.5 + 0.5 * Math.sin(state.t * 4.2 + (orb._orbitPhase || 0))) * (mine.isRich ? 0.40 : 0.24);
        }
      }
    }
    updateSectorObjectiveAmbientVisuals();
  }

  const MINE_FLOW_PHASE_NONE = "none";
  const MINE_FLOW_PHASE_ENTER = "enter";
  const MINE_FLOW_PHASE_HOLD = "hold";
  const MINE_FLOW_PHASE_EXIT = "exit";
  const MINE_FLOW_ANIM_TIME = 2.0;
  const MINE_LANE_TRIGGER_COOLDOWN_SEC = 7.5;

  function mineYieldMul(p) {
    return 1 + ((p && p.mineYieldBonus) || 0) / 100;
  }

  function getMineYieldPerSecond(mine, owner) {
    let rate = (CFG.MINE_YIELD_PER_SEC || 1) * mineYieldMul(owner);
    if (mine && mine.isRich) rate *= (mine._richYieldMultiplier || CFG.MINE_RICH_MULTIPLIER || 1);
    return rate;
  }

  function getMineEnergyPerSecond(mine, owner) {
    let rate = (CFG.MINE_ENERGY_PER_SEC || 0) * mineYieldMul(owner);
    if (mine && mine.isRich) rate *= (mine._richYieldMultiplier || CFG.MINE_RICH_MULTIPLIER || 1);
    return rate;
  }

  function getPlayerMineRates(playerId) {
    let moneyPerSec = 0;
    let xpPerSec = 0;
    let energyPerSec = 0;
    for (const mine of state.mines.values()) {
      if (!mine.ownerId || mine.captureProgress < 1) continue;
      const owner = state.players.get(mine.ownerId);
      if (!owner || owner.pop <= 0) continue;
      const rate = mine._flowRate > 0 ? mine._flowRate : getMineYieldPerSecond(mine, owner);
      const energyRate = getMineEnergyPerSecond(mine, owner);
      const targetId = mine._flowTargetPlayerId || mine.ownerId;
      if (targetId !== playerId) continue;
      energyPerSec += energyRate;
      const xpRate = rate * (CFG.MINE_XP_YIELD_MUL || 1);
      if (mine.isRich) {
        moneyPerSec += rate;
        xpPerSec += xpRate;
      } else if (mine.resourceType === "money") {
        moneyPerSec += rate;
      } else {
        xpPerSec += xpRate;
      }
    }
    return { moneyPerSec, xpPerSec, energyPerSec };
  }

  function getPathSetBounds(paths) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const path of paths || []) {
      if (!Array.isArray(path)) continue;
      for (const point of path) {
        if (!point) continue;
        const x = point.x || 0;
        const y = point.y || 0;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (!Number.isFinite(minX)) return null;
    return { minX, minY, maxX, maxY };
  }

  function distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 <= 1e-6) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    const qx = ax + dx * t;
    const qy = ay + dy * t;
    return Math.hypot(px - qx, py - qy);
  }

  function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 <= 1e-6) return { x: ax, y: ay, t: 0 };
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    return {
      x: ax + dx * t,
      y: ay + dy * t,
      t
    };
  }

  function findLaneMineTriggerOwner(mine) {
    const trigger = mine && mine.instantLaneTrigger;
    if (!mine || !trigger) return null;
    if ((mine._instantLaneTriggerCooldownUntil || 0) > state.t) return null;
    let bestOwnerId = null;
    let bestDist = Infinity;
    for (const u of state.units.values()) {
      if (!u || u.hp <= 0 || u.owner === PIRATE_OWNER_ID) continue;
      if (u.owner === mine.ownerId) continue;
      const owner = state.players.get(u.owner);
      if (!owner || owner.pop <= 0 || owner.eliminated) continue;
      const touchR = Math.max((CFG.MINE_GEM_INTERCEPT_R || 30), getUnitHitRadius(u) + 6);
      const dist = distToSegment(u.x, u.y, mine.x, mine.y, trigger.x, trigger.y);
      if (dist > touchR) continue;
      if (dist < bestDist) {
        bestDist = dist;
        bestOwnerId = u.owner;
      }
    }
    return bestOwnerId;
  }

  function findSectorObjectiveTriggerOwner(objective) {
    if (!objective) return null;
    if ((objective._touchProtectedUntil || 0) > state.t) return null;
    let bestOwnerId = null;
    let bestDist = Infinity;
    const touchR = objective.captureRadius || Math.max((CFG.MINE_CAPTURE_RADIUS || 140) * 0.9, 120);
    for (const u of state.units.values()) {
      if (!u || u.hp <= 0 || u.owner === PIRATE_OWNER_ID) continue;
      const owner = state.players.get(u.owner);
      if (!owner || owner.pop <= 0 || owner.eliminated) continue;
      const dist = Math.hypot((u.x || 0) - (objective.x || 0), (u.y || 0) - (objective.y || 0));
      if (dist > touchR) continue;
      if (dist < bestDist) {
        bestDist = dist;
        bestOwnerId = u.owner;
      }
    }
    return bestOwnerId;
  }

  function setSectorObjectiveOwnerInstantly(objective, ownerId) {
    if (!objective) return false;
    const nextOwnerId = ownerId || null;
    if (objective.ownerId === nextOwnerId) return false;
    objective.ownerId = nextOwnerId;
    objective._touchProtectedUntil = state.t + toSimSeconds(3.5);
    for (const mineId of objective.linkedMineIds || []) {
      const mine = state.mines.get(mineId);
      if (!mine) continue;
      setMineOwnerInstantly(mine, nextOwnerId);
    }
    makeSectorObjectiveVisual(objective);
    return true;
  }

  function stepSectorObjectives() {
    for (const objective of state.sectorObjectives || []) {
      if (!objective) continue;
      if (objective.ownerId != null) {
        const owner = state.players.get(objective.ownerId);
        if (!owner || owner.pop <= 0 || owner.eliminated) {
          setSectorObjectiveOwnerInstantly(objective, null);
          continue;
        }
      }
      const triggerOwnerId = findSectorObjectiveTriggerOwner(objective);
      if (triggerOwnerId != null && triggerOwnerId !== objective.ownerId) {
        setSectorObjectiveOwnerInstantly(objective, triggerOwnerId);
      }
    }
  }

  function setMineOwnerInstantly(mine, ownerId) {
    if (!mine) return false;
    const nextOwnerId = ownerId || null;
    if (mine.ownerId === nextOwnerId && mine.captureProgress >= 1) return false;
    mine.ownerId = nextOwnerId;
    mine.captureProgress = nextOwnerId ? 1 : 0;
    mine._capturingOwner = null;
    mine._captureProtectedUntil = 0;
    mine._instantLaneTriggerCooldownUntil = state.t + toSimSeconds(MINE_LANE_TRIGGER_COOLDOWN_SEC);
    clearMineFlowState(mine);
    updateMineVisual(mine);
    return true;
  }

  function getMineFlowInterceptorSourceId(unit) {
    if (!unit) return null;
    if (unit.squadId != null) return `squad:${unit.squadId}`;
    return `unit:${unit.id}`;
  }

  function getMineFlowSquadIntercept(squad, mine, owner) {
    if (!squad || typeof SQUADLOGIC === "undefined" || !SQUADLOGIC.getSquadUnits || !SQUADLOGIC.getSquadCenter) return null;
    const units = SQUADLOGIC.getSquadUnits(state, squad);
    if (!units || !units.length) return null;
    const interceptorOwner = state.players.get(squad.ownerId);
    if (!interceptorOwner || interceptorOwner.pop <= 0) return null;
    if (squad.ownerId === mine.ownerId) return null;

    const center = SQUADLOGIC.getSquadCenter(state, squad);
    let squadRadius = 0;
    for (const u of units) {
      const hitR = getUnitHitRadius(u);
      const dist = Math.hypot(u.x - center.x, u.y - center.y) + hitR;
      if (dist > squadRadius) squadRadius = dist;
    }
    const touchR = Math.max((CFG.MINE_GEM_INTERCEPT_R || 30), squadRadius * 0.5);
    const d = distToSegment(center.x, center.y, mine.x, mine.y, owner.x, owner.y);
    if (d > touchR) return null;

    const point = closestPointOnSegment(center.x, center.y, mine.x, mine.y, owner.x, owner.y);
    const leader = state.units.get(squad.leaderUnitId) || units[0];
    return {
      unit: leader,
      point,
      sourceId: `squad:${squad.id}`,
      dist: d
    };
  }

  function clearMineFlowState(mine) {
    const hadFlow =
      (mine._flowPhase && mine._flowPhase !== MINE_FLOW_PHASE_NONE) ||
      mine._flowVisualTargetPlayerId != null ||
      mine._flowInterceptUnitId != null ||
      mine._flowInterceptSourceId != null;
    mine._flowRate = 0;
    mine._flowTargetPlayerId = mine.ownerId || null;
    mine._flowVisualTargetPlayerId = null;
    mine._flowInterceptUnitId = null;
    mine._flowInterceptSourceId = null;
    mine._flowInterceptX = null;
    mine._flowInterceptY = null;
    mine._flowInterceptT = null;
    mine._flowPhase = MINE_FLOW_PHASE_NONE;
    mine._flowPhaseStartedAt = state.t;
    if (hadFlow) mine._flowVersion = (mine._flowVersion || 0) + 1;
  }

  function getMineFlowProgress(mine) {
    if (!mine || !mine._flowPhase || mine._flowPhase === MINE_FLOW_PHASE_NONE || mine._flowPhase === MINE_FLOW_PHASE_HOLD) return 1;
    return Math.max(0, Math.min(1, (state.t - (mine._flowPhaseStartedAt || state.t)) / MINE_FLOW_ANIM_TIME));
  }

  function findMineFlowInterceptor(mine, owner) {
    if (!mine || !owner) return null;
    let best = null;
    let bestDist = Infinity;

    if (typeof SQUADLOGIC !== "undefined" && state.squads) {
      for (const squad of state.squads.values()) {
        const intercept = getMineFlowSquadIntercept(squad, mine, owner);
        if (!intercept) continue;
        if (intercept.dist < bestDist) {
          bestDist = intercept.dist;
          best = intercept;
        }
      }
    }

    for (const u of state.units.values()) {
      if (!u || u.hp <= 0 || u.squadId != null) continue;
      if (u.owner === mine.ownerId) continue;
      const interceptorOwner = state.players.get(u.owner);
      if (!interceptorOwner || interceptorOwner.pop <= 0) continue;
      const touchR = Math.max((CFG.MINE_GEM_INTERCEPT_R || 30), getUnitHitRadius(u) + 6);
      const d = distToSegment(u.x, u.y, mine.x, mine.y, owner.x, owner.y);
      if (d > touchR) continue;
      if (d < bestDist) {
        bestDist = d;
        const point = closestPointOnSegment(u.x, u.y, mine.x, mine.y, owner.x, owner.y);
        best = { unit: u, point, sourceId: getMineFlowInterceptorSourceId(u), dist: d };
      }
    }

    return best;
  }

  function updateMineFlowState(mine, owner, interceptor) {
    const phase = mine._flowPhase || MINE_FLOW_PHASE_NONE;
    const progress = getMineFlowProgress(mine);
    if (!mine.ownerId || !owner || owner.pop <= 0) {
      clearMineFlowState(mine);
      return;
    }

    mine._flowRate = getMineYieldPerSecond(mine, owner);
    mine._flowTargetPlayerId = mine.ownerId;

    if (interceptor) {
      const interceptOwnerId = interceptor.unit.owner;
      const sameIntercept =
        (mine._flowVisualTargetPlayerId === interceptOwnerId) &&
        (mine._flowInterceptSourceId === interceptor.sourceId) &&
        (phase === MINE_FLOW_PHASE_ENTER || phase === MINE_FLOW_PHASE_HOLD);

      mine._flowVisualTargetPlayerId = interceptOwnerId;
      mine._flowInterceptUnitId = interceptor.unit.id;
      mine._flowInterceptSourceId = interceptor.sourceId;
      mine._flowTargetPlayerId = interceptOwnerId;

      if (!sameIntercept) {
        mine._flowInterceptX = interceptor.point.x;
        mine._flowInterceptY = interceptor.point.y;
        mine._flowInterceptT = interceptor.point.t;
        mine._flowPhase = MINE_FLOW_PHASE_ENTER;
        mine._flowPhaseStartedAt = state.t;
        mine._flowVersion = (mine._flowVersion || 0) + 1;
      } else if (mine._flowInterceptX == null || mine._flowInterceptY == null || mine._flowInterceptT == null) {
        mine._flowInterceptX = interceptor.point.x;
        mine._flowInterceptY = interceptor.point.y;
        mine._flowInterceptT = interceptor.point.t;
      } else if (phase === MINE_FLOW_PHASE_ENTER && progress >= 1) {
        mine._flowPhase = MINE_FLOW_PHASE_HOLD;
        mine._flowPhaseStartedAt = state.t;
      }
      return;
    }

    if (phase === MINE_FLOW_PHASE_ENTER || phase === MINE_FLOW_PHASE_HOLD) {
      mine._flowPhase = MINE_FLOW_PHASE_EXIT;
      mine._flowPhaseStartedAt = state.t;
      mine._flowVersion = (mine._flowVersion || 0) + 1;
      return;
    }

    if (phase === MINE_FLOW_PHASE_EXIT) {
      if (progress >= 1) clearMineFlowState(mine);
      return;
    }

    mine._flowPhase = MINE_FLOW_PHASE_NONE;
    mine._flowTargetPlayerId = mine.ownerId;
  }

  // ── Mine step: capture + yield ──
  function stepMines(dt) {
    stepSectorObjectives();
    for (const mine of state.mines.values()) {
      const triggerOwnerId = findLaneMineTriggerOwner(mine);
      if (triggerOwnerId != null) setMineOwnerInstantly(mine, triggerOwnerId);
      const ownersInRadius = new Map();
      for (const u of state.units.values()) {
        if (u.owner === PIRATE_OWNER_ID) continue;
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
        if (!owner || owner.pop <= 0) {
          mine.ownerId = null;
          mine.captureProgress = 0;
          clearMineFlowState(mine);
          updateMineVisual(mine);
          continue;
        }

        updateMineFlowState(mine, owner, null);

        const targetPlayer = state.players.get(mine._flowTargetPlayerId || mine.ownerId) || owner;
        const gain = (mine._flowRate || 0) * dt;
        const energyGain = getMineEnergyPerSecond(mine, owner) * dt;
        if ((gain > 0 || energyGain > 0) && targetPlayer && targetPlayer.pop > 0) {
          let moneyGain = 0;
          const xpGain = gain * (CFG.MINE_XP_YIELD_MUL || 1);
          if (mine.isRich) {
            if (gain > 0) {
              targetPlayer.eCredits = (targetPlayer.eCredits || 0) + gain;
              gainXP(targetPlayer, xpGain);
              moneyGain += gain;
            }
          } else if (mine.resourceType === "money") {
            if (gain > 0) {
              targetPlayer.eCredits = (targetPlayer.eCredits || 0) + gain;
              moneyGain += gain;
            }
          } else if (gain > 0) {
            gainXP(targetPlayer, xpGain);
          }
          if (energyGain > 0) {
            targetPlayer.popFloat = (targetPlayer.popFloat || targetPlayer.pop || 0) + energyGain;
            targetPlayer.pop = Math.floor(targetPlayer.popFloat);
          }
          if (targetPlayer.id === state.myPlayerId && moneyGain > 0) playMineIncomeSound(moneyGain);
        }
      } else {
        clearMineFlowState(mine);
      }

      if (mine.gfx) updateMineProgressBar(mine);
    }

    const alivePirateBases = getAlivePirateBases();
    if (alivePirateBases.length > 0) {
      const PIRATE_RESPAWN_CD = toSimSeconds(180);
      for (const pb of alivePirateBases) {
        const basePirateUnits = [...state.units.values()].filter((u) =>
          u.owner === PIRATE_OWNER_ID &&
          u._pirateBaseId === pb.id &&
          !(u._pirateHyperUntil && state.t < u._pirateHyperUntil)
        );
        const pirateCount = basePirateUnits.length;
        if (pb._respawnTimer == null) pb._respawnTimer = 0;
        const needsInitialSpawn = !pb._initialSpawned && pirateCount === 0;

        if (pirateCount === 0) {
          if (needsInitialSpawn) {
            pb._respawnTimer = 0;
          } else if (pb._respawnTimer <= 0) {
            pb._respawnTimer = PIRATE_RESPAWN_CD;
          }

          if (!needsInitialSpawn) pb._respawnTimer -= dt;

          if (needsInitialSpawn || pb._respawnTimer <= 0) {
            pb._respawnTimer = 0;
            pb._initialSpawned = true;
            const oc = pb.orbitCenter || { x: pb.x, y: pb.y };
            const oR = pb.orbitRadius || 280;
            const batchTag = `${pb.id}-${Math.floor(state.t)}`;
            for (let i = 0; i < PIRATE_FULL_SQUAD.length; i++) {
              const t = PIRATE_FULL_SQUAD[i];
              const a = (Math.PI * 2 * i) / PIRATE_FULL_SQUAD.length + Math.random() * 0.2;
              const spawnU = spawnUnitAt(
                oc.x + Math.cos(a) * oR * 0.52,
                oc.y + Math.sin(a) * oR * 0.52,
                PIRATE_OWNER_ID,
                t,
                [],
                { sourceTag: batchTag, autoGroupUntil: state.t + 3, allowAutoJoinRecentSpawn: true }
              );
              if (spawnU) {
                spawnU._piratePatrol = true;
                spawnU._pirateBaseId = pb.id;
              }
            }
          }
        } else {
          pb._respawnTimer = 0;
          pb._initialSpawned = true;
        }

        const oc = pb.orbitCenter || { x: pb.x, y: pb.y };
        const patrolRadius = Math.max(108, (pb.orbitRadius || 260) * 1.15);
        const baseUnderAttack = pb._lastAttackedAt && (state.t - pb._lastAttackedAt) < 5;

        if (typeof SQUADLOGIC !== "undefined") {
          const pirateSquads = [...state.squads.values()].filter((sq) => {
            if (sq.ownerId !== PIRATE_OWNER_ID) return false;
            const leader = state.units.get(sq.leaderUnitId);
            return leader && leader._pirateBaseId === pb.id && SQUADLOGIC.getSquadUnits(state, sq).length > 0;
          });
          for (const squadState of pirateSquads) {
            const leader = state.units.get(squadState.leaderUnitId);
            if (!leader) continue;
            if ((leader._hyperArrivalFlash && state.t < leader._hyperArrivalFlash) || (leader._pirateHyperUntil && state.t < leader._pirateHyperUntil)) continue;
            if (squadState.combat.mode === "approach" || squadState.combat.mode === "engaged") continue;

            if (baseUnderAttack) {
              const defX = pb._attackerX ?? pb.x;
              const defY = pb._attackerY ?? pb.y;
              SQUADLOGIC.issueMoveOrder(state, squadState.id, [{ x: defX, y: defY }], Math.atan2(defY - leader.y, defX - leader.x));
              continue;
            }

            if (squadState._piratePatrolIdx == null) squadState._piratePatrolIdx = 0;
            const patrolPoints = [0, 72, 144, 216, 288].map((deltaDeg) => {
              const ang = degFromTopClockwiseToRad((pb.patrolAngleDeg || 0) + deltaDeg);
              return {
                x: oc.x + Math.cos(ang) * patrolRadius,
                y: oc.y + Math.sin(ang) * patrolRadius
              };
            });
            const target = patrolPoints[squadState._piratePatrolIdx % patrolPoints.length];
            const dist = Math.hypot(leader.x - target.x, leader.y - target.y);
            if (dist < 24) squadState._piratePatrolIdx = (squadState._piratePatrolIdx + 1) % patrolPoints.length;
            const wp = patrolPoints[squadState._piratePatrolIdx % patrolPoints.length];
            SQUADLOGIC.issueMoveOrder(state, squadState.id, [{ x: wp.x, y: wp.y }], Math.atan2(wp.y - leader.y, wp.x - leader.x));
          }
        } else {
          for (const u of basePirateUnits) {
            if ((u._hyperArrivalFlash && state.t < u._hyperArrivalFlash) || (u._pirateHyperUntil && state.t < u._pirateHyperUntil)) continue;
            const cs = u._combatState;
            if (cs === "acquire" || cs === "chase" || cs === "attack" || cs === "siege") continue;
            const baseAngle = degFromTopClockwiseToRad(pb.patrolAngleDeg || 0);
            if (u._patrolAngle == null) u._patrolAngle = baseAngle + (u.id % 7) * 0.22;
            const angSpeed = (u.unitType === "cruiser") ? 0.15 : (u.unitType === "destroyer") ? 0.22 : 0.3;
            u._patrolAngle += angSpeed * dt;
            const pr = patrolRadius * (0.72 + (u.id % 5) * 0.05);
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
    const g = new PIXI.Graphics();
    ResourceFlow.drawPacket(g, gem.isCredit, gem.value, cam.zoom);
    const glowCfg = ResourceFlow.getPacketGlow(gem.isCredit, gem.value, cam.zoom);
    if (glowCfg) {
      const glow = makeGlow(glowCfg.color, glowCfg.distance, glowCfg.outerStrength);
      if (glow) g.filters = [glow];
    }
    g.x = gem.x;
    g.y = gem.y;
    gem.gfx = g;
    resLayer.addChild(g);
  }

  function spawnMineGem(mine, owner, value, isCredit) {
    const id = state.nextResId++;
    const baseSpeed = CFG.MINE_GEM_SPEED * 0.5 * (0.7 + value * 0.15);
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
    return;
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
          if (g.isCredit) {
            target.eCredits = (target.eCredits || 0) + g.value;
          } else {
            gainXP(target, g.value);
          }
        }
        if (target.id === state.myPlayerId) playCollectSound();
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
      if (g.gfx) {
        g.gfx.x = g.x; g.gfx.y = g.y; g.gfx.rotation += dt * 1.5;
        g.gfx.visible = inView(g.x, g.y) && LOD.canDraw("gems");
      }

    }
  }

  const MINE_FLOW_VARIANTS = {
    money: {
      routeStyle: "relay",
      beamDash: [10, 8],
      laneCount: 1,
      laneOffset: 0,
      pulseSpeed: 0.24,
      packetSpeed: 0.23,
      arcBias: 12,
      arcMul: 0.08,
      packetStyle: "chip"
    },
    xp: {
      routeStyle: "relay",
      beamDash: [10, 8],
      laneCount: 1,
      laneOffset: 0,
      pulseSpeed: 0.24,
      packetSpeed: 0.23,
      arcBias: 12,
      arcMul: 0.08,
      packetStyle: "chip"
    }
  };

  function mfClamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function mfLerp(a, b, t) {
    return a + (b - a) * t;
  }

  function getMineFlowVariant(mine, resourceTypeOverride) {
    const resourceType = resourceTypeOverride || getMinePrimaryResourceType(mine);
    return resourceType === "xp" ? MINE_FLOW_VARIANTS.xp : MINE_FLOW_VARIANTS.money;
  }

  function getMineFlowDetail() {
    const level = LOD.getLevel(cam.zoom || 0.22);
    const unitCount = state.units ? state.units.size : 0;
    const squadCount = state.squads ? state.squads.size : 0;
    const packetCount = state.mineFlowPackets ? state.mineFlowPackets.length : 0;
    const isRemote = !!(state._multiSlots && !state._multiIsHost);
    const heavyLoad = unitCount >= 60 || squadCount >= 40 || packetCount >= 24;
    const severeLoad = unitCount >= 110 || squadCount >= 70 || packetCount >= 40;
    if (level === LOD.LEVELS.FAR) {
      return {
        routeSamples: severeLoad ? 4 : (heavyLoad ? 5 : 7),
        maxPacketsPerMine: severeLoad ? 0 : 1,
        maxTotalPackets: severeLoad ? 0 : (heavyLoad ? 10 : 20),
        beamAlpha: severeLoad ? 0.22 : (heavyLoad ? 0.34 : 0.52),
        shimmer: false,
        bridges: false,
        packetScale: severeLoad ? 0 : (heavyLoad ? 0.28 : 0.38),
        updateEveryFrames: severeLoad ? 8 : (heavyLoad ? 6 : 4),
        roughCullPad: heavyLoad ? 180 : 260,
        allowDashes: false,
        simplePackets: true,
        singleLane: true,
        maxRoutes: severeLoad ? 12 : (heavyLoad ? 24 : 48),
        forceGlobalVisible: !severeLoad
      };
    }
    if (level === LOD.LEVELS.MID) {
      return {
        routeSamples: severeLoad ? 4 : (heavyLoad ? 6 : 8),
        maxPacketsPerMine: severeLoad ? 0 : 1,
        maxTotalPackets: severeLoad ? 8 : (heavyLoad ? 16 : 26),
        beamAlpha: severeLoad ? 0.18 : (heavyLoad ? 0.30 : 0.48),
        shimmer: false,
        bridges: false,
        packetScale: severeLoad ? 0.46 : (heavyLoad ? 0.58 : 0.72),
        updateEveryFrames: severeLoad ? 5 : (heavyLoad ? 4 : 3),
        roughCullPad: heavyLoad ? 140 : 180,
        allowDashes: !severeLoad,
        simplePackets: true,
        singleLane: true,
        maxRoutes: severeLoad ? 10 : (heavyLoad ? 16 : 22)
      };
    }
    return {
      routeSamples: severeLoad ? 5 : (heavyLoad ? 7 : 10),
      maxPacketsPerMine: severeLoad ? 0 : (heavyLoad ? 1 : 3),
      maxTotalPackets: severeLoad ? 14 : (heavyLoad ? 24 : 42),
      beamAlpha: severeLoad ? 0.24 : (heavyLoad ? 0.38 : 0.60),
      shimmer: !severeLoad && !heavyLoad,
      bridges: false,
      packetScale: severeLoad ? 0.52 : (heavyLoad ? 0.64 : 0.85),
      updateEveryFrames: severeLoad ? 4 : (heavyLoad ? 3 : 2),
      roughCullPad: heavyLoad ? 180 : 220,
      allowDashes: true,
      simplePackets: severeLoad || heavyLoad || packetCount >= 24,
      singleLane: true,
      maxRoutes: severeLoad ? 12 : (heavyLoad ? 18 : 30)
    };
  }

  function ensureMineFlowVisuals() {
    if (!state._mineFlowBeamGfx || !state._mineFlowBeamGfx.parent) {
      state._mineFlowBeamGfx = new PIXI.Graphics();
      abilityFxLayer.addChild(state._mineFlowBeamGfx);
    }
    if (!state._mineFlowPacketGfx || !state._mineFlowPacketGfx.parent) {
      state._mineFlowPacketGfx = new PIXI.Graphics();
      abilityFxLayer.addChild(state._mineFlowPacketGfx);
    }
  }

  function removeMineFlowPacketsByRouteKey(routeKey) {
    if (!routeKey || !Array.isArray(state.mineFlowPackets) || state.mineFlowPackets.length === 0) return;
    for (let i = state.mineFlowPackets.length - 1; i >= 0; i--) {
      if (state.mineFlowPackets[i] && state.mineFlowPackets[i].routeKey === routeKey) {
        state.mineFlowPackets.splice(i, 1);
      }
    }
  }

  function isMineFlowLikelyVisible(mine, owner, detail) {
    if (detail && detail.forceGlobalVisible) return true;
    const pad = detail.roughCullPad || 220;
    if (pointInViewPad(mine.x, mine.y, pad)) return true;
    if (pointInViewPad(owner.x, owner.y, pad)) return true;
    if (mine._flowInterceptX != null && mine._flowInterceptY != null && pointInViewPad(mine._flowInterceptX, mine._flowInterceptY, pad)) return true;
    if (mine.pairKey) {
      const centerX = state.centerObjectives?.centerX || CFG.WORLD_W * 0.5;
      const centerY = state.centerObjectives?.centerY || CFG.WORLD_H * 0.5;
      const routeMidX = (mine.x + centerX) * 0.5;
      const routeMidY = (mine.y + centerY) * 0.5;
      if (pointInViewPad(routeMidX, routeMidY, Math.max(80, pad * 0.72))) return true;
    }
    return false;
  }

  function mfGetPathLength(points) {
    if (!Array.isArray(points) || points.length < 2) return 0;
    const cached = points._mfPathLength;
    if (Number.isFinite(cached)) return cached;
    const len = polylineLength(points);
    points._mfPathLength = len;
    return len;
  }

  function mfSamplePath(points, t) {
    if (!points || points.length < 2) return { x: 0, y: 0, angle: 0 };
    const pathLength = mfGetPathLength(points);
    if (pathLength <= 1e-6) {
      const a = points[0];
      const b = points[points.length - 1] || a;
      return {
        x: b.x || 0,
        y: b.y || 0,
        angle: Math.atan2((b.y || 0) - (a.y || 0), (b.x || 0) - (a.x || 0))
      };
    }
    return samplePolylineAtDistance(points, mfClamp(t, 0, 1) * pathLength);
  }

  function mfBuildPathSlice(points, t0, t1) {
    if (!points || points.length < 2) return [];
    const from = mfClamp(t0, 0, 1);
    const to = mfClamp(t1, 0, 1);
    if (to <= from) {
      const a = mfSamplePath(points, from);
      const b = mfSamplePath(points, to);
      return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
    }
    const count = Math.max(2, Math.ceil((to - from) * 24));
    const out = [];
    for (let i = 0; i <= count; i++) {
      const s = mfSamplePath(points, mfLerp(from, to, i / count));
      out.push({ x: s.x, y: s.y });
    }
    return out;
  }

  function mfBuildRoutePoints(start, end, seed, variant, detail, laneSign, rerouteMul, channelSign) {
    const points = [];
    const count = detail.routeSamples;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy) || 1;
    const dirX = dx / len;
    const dirY = dy / len;
    const perpX = -dirY;
    const perpY = dirX;
    const seedNorm = ((seed || 0) * 0.6180339887) % 1;
    const seedSign = seedNorm > 0.5 ? 1 : -1;
    const laneOffset = (laneSign || 0) * variant.laneOffset;
    const channelOffset = (channelSign || 0) * (variant.laneCount > 1 ? 11 : 18);
    const ampBase = variant.arcBias + len * variant.arcMul;

    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const baseX = mfLerp(start.x, end.x, t);
      const baseY = mfLerp(start.y, end.y, t);
      let offset = 0;
      if (variant.routeStyle === "relay") {
        offset = Math.sin(Math.PI * t) * (6 + ampBase * 0.18) * seedSign * 0.35 * (0.35 + rerouteMul * 0.65);
      } else if (variant.routeStyle === "arc") {
        offset = Math.sin(Math.PI * t) * (14 + ampBase * 0.68) * seedSign * (0.55 + rerouteMul * 0.60);
      } else if (variant.routeStyle === "braid") {
        offset = Math.sin(Math.PI * t) * (9 + ampBase * 0.25) * seedSign * 0.42;
        offset += Math.sin(t * Math.PI * 4 + state.t * 0.8 + seedNorm * 5) * 4.2 * rerouteMul;
      } else if (variant.routeStyle === "ladder") {
        const sq = Math.sin(t * Math.PI * 4 + seedNorm * 7) >= 0 ? 1 : -1;
        const gate = Math.sin(Math.PI * t) * Math.min(1, Math.max(0, (t - 0.06) / 0.12)) * Math.min(1, Math.max(0, (0.94 - t) / 0.14));
        offset = sq * (6 + ampBase * 0.20) * gate;
      } else if (variant.routeStyle === "siphon") {
        offset = Math.sin(Math.PI * t) * (10 + ampBase * 0.42) * seedSign * 0.5;
        offset += Math.sin(state.t * 1.2 + t * Math.PI * 6 + seedNorm * 6) * 3.5;
      } else {
        offset = Math.sin(Math.PI * t) * (8 + ampBase * 0.22) * seedSign * 0.36;
      }
      offset += laneOffset * Math.sin(Math.PI * t);
      offset += channelOffset * Math.sin(Math.PI * t);
      points.push({
        x: baseX + perpX * offset,
        y: baseY + perpY * offset
      });
    }
    return points;
  }

  function mfBuildLinearPoints(start, end, samples) {
    const points = [];
    const count = Math.max(1, samples | 0);
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      points.push({
        x: mfLerp(start.x || 0, end.x || 0, t),
        y: mfLerp(start.y || 0, end.y || 0, t)
      });
    }
    return points;
  }

  function mfConcatPointPaths(paths) {
    const out = [];
    for (const path of paths || []) {
      if (!Array.isArray(path) || path.length === 0) continue;
      for (let i = 0; i < path.length; i++) {
        if (out.length > 0 && i === 0) {
          const prev = out[out.length - 1];
          const next = path[i];
          if (Math.hypot((prev.x || 0) - (next.x || 0), (prev.y || 0) - (next.y || 0)) <= 0.5) continue;
        }
        out.push(path[i]);
      }
    }
    return out;
  }

  function buildMineOuterLaneRoutePoints(startPoint, targetPoint, mine, detail, variant, laneSign = 0, channelSign = 0) {
    if (!mine || !mine.pairKey || !targetPoint) return null;
    const ids = String(mine.pairKey).split(":").map((id) => Number(id)).filter(Number.isFinite);
    if (ids.length !== 2) return null;
    const a = state.players.get(ids[0]);
    const b = state.players.get(ids[1]);
    if (!a || !b) return null;

    const dx = (b.x || 0) - (a.x || 0);
    const dy = (b.y || 0) - (a.y || 0);
    const len = Math.hypot(dx, dy) || 1;
    const dirX = dx / len;
    const dirY = dy / len;
    const perpX = -dirY;
    const perpY = dirX;
    const midX = ((a.x || 0) + (b.x || 0)) * 0.5;
    const midY = ((a.y || 0) + (b.y || 0)) * 0.5;
    const mineSide = ((mine.x || 0) - midX) * perpX + ((mine.y || 0) - midY) * perpY;
    const baseOffset = Math.max(58, Math.abs(mineSide) + 18);
    const extraOffset =
      (laneSign || 0) * ((variant && variant.laneOffset) || 0) * 0.75 +
      (channelSign || 0) * ((variant && variant.laneCount > 1) ? 7 : 12);

    function projectT(point) {
      return mfClamp((((point.x || 0) - (a.x || 0)) * dx + ((point.y || 0) - (a.y || 0)) * dy) / (len * len), 0, 1);
    }

    function edgePointAt(t, sign) {
      return {
        x: mfLerp(a.x || 0, b.x || 0, t) + perpX * sign * (baseOffset + extraOffset),
        y: mfLerp(a.y || 0, b.y || 0, t) + perpY * sign * (baseOffset + extraOffset)
      };
    }

    const startT = mfClamp(projectT(startPoint), 0.10, 0.90);
    let targetT = projectT(targetPoint);
    if (targetPoint.id === ids[0]) targetT = 0.08;
    else if (targetPoint.id === ids[1]) targetT = 0.92;
    else targetT = mfClamp(targetT, 0.08, 0.92);

    const entryT = targetPoint.id === ids[0]
      ? 0.18
      : targetPoint.id === ids[1]
        ? 0.82
        : (targetT < 0.5 ? mfClamp(targetT + 0.10, 0.18, 0.82) : mfClamp(targetT - 0.10, 0.18, 0.82));

    const center = {
      x: state.centerObjectives?.centerX || CFG.WORLD_W * 0.5,
      y: state.centerObjectives?.centerY || CFG.WORLD_H * 0.5
    };
    const targetToCenterDx = center.x - (targetPoint.x || 0);
    const targetToCenterDy = center.y - (targetPoint.y || 0);
    const targetToCenterLen = Math.hypot(targetToCenterDx, targetToCenterDy) || 1;
    const targetToCenterX = targetToCenterDx / targetToCenterLen;
    const targetToCenterY = targetToCenterDy / targetToCenterLen;
    const posStartEdge = edgePointAt(startT, 1);
    const negStartEdge = edgePointAt(startT, -1);
    const chosenSign = Math.hypot((startPoint.x || 0) - posStartEdge.x, (startPoint.y || 0) - posStartEdge.y)
      <= Math.hypot((startPoint.x || 0) - negStartEdge.x, (startPoint.y || 0) - negStartEdge.y)
      ? 1
      : -1;
    const startEdge = chosenSign > 0 ? posStartEdge : negStartEdge;
    const endEdge = edgePointAt(entryT, chosenSign);
    const startFlowT = mfClamp(startT + Math.sign(entryT - startT || 1) * 0.06, 0.08, 0.92);
    const startFlowEdge = edgePointAt(startFlowT, chosenSign);
    const corridorEntryDist = targetPoint.id != null
      ? Math.min(96, targetToCenterLen * 0.10)
      : Math.min(120, targetToCenterLen * 0.12);
    const corridorEntry = {
      x: (targetPoint.x || 0) + targetToCenterX * corridorEntryDist,
      y: (targetPoint.y || 0) + targetToCenterY * corridorEntryDist
    };
    const corridorShoulder = {
      x: mfLerp(endEdge.x, corridorEntry.x, 0.26),
      y: mfLerp(endEdge.y, corridorEntry.y, 0.26)
    };
    const route = mfConcatPointPaths([
      mfBuildLinearPoints(startPoint, startEdge, 4),
      mfBuildLinearPoints(startEdge, startFlowEdge, 3),
      mfBuildLinearPoints(startFlowEdge, endEdge, 16),
      mfBuildLinearPoints(endEdge, corridorShoulder, 4),
      mfBuildLinearPoints(corridorShoulder, corridorEntry, 4),
      mfBuildLinearPoints(corridorEntry, targetPoint, 4)
    ]);
    return route.length >= 3 ? buildRoundedLanePolyline(route, 76, 5) : route;
  }

  function buildMineCoreLaneRoutePoints(startPoint, targetPlayer, mine, detail, variant, channelSign = 0) {
    if (!targetPlayer) return null;
    const center = {
      x: state.centerObjectives?.centerX || CFG.WORLD_W * 0.5,
      y: state.centerObjectives?.centerY || CFG.WORLD_H * 0.5
    };
    let best = null;
    for (const frontType of ["left", "center", "right"]) {
      const points = getLanePointsForPlayerFront(targetPlayer, frontType, center);
      if (!Array.isArray(points) || points.length < 2) continue;
      const sample = projectPointOnPolyline(points, startPoint.x || 0, startPoint.y || 0);
      if (!sample) continue;
      if (!best || sample.dist < best.sample.dist) best = { frontType, points, sample };
    }
    if (!best) return null;

    const smoothPoints = buildRoundedLanePolyline(best.points, best.frontType === "center" ? 116 : 92, 6);
    const smoothSample = projectPointOnPolyline(smoothPoints, startPoint.x || 0, startPoint.y || 0);
    if (!smoothSample) return null;
    const offsetBase = best.frontType === "center" ? 84 : 70;
    const edgePositive = offsetLanePolyline(smoothPoints, offsetBase);
    const edgeNegative = offsetLanePolyline(smoothPoints, -offsetBase);
    const positiveSample = projectPointOnPolyline(edgePositive, startPoint.x || 0, startPoint.y || 0);
    const negativeSample = projectPointOnPolyline(edgeNegative, startPoint.x || 0, startPoint.y || 0);
    const nearestPositive = !negativeSample || (positiveSample && positiveSample.dist <= negativeSample.dist);
    const chosenSign = nearestPositive ? 1 : -1;
    const chosenBase = nearestPositive ? edgePositive : edgeNegative;
    const chosenBaseSample = nearestPositive ? positiveSample : negativeSample;
    const edgeOffset = chosenSign * (offsetBase + (channelSign || 0) * 10);
    const edgePoints = Math.abs(edgeOffset) === offsetBase ? chosenBase : offsetLanePolyline(smoothPoints, edgeOffset);
    const edgeProgress = chosenBaseSample && Number.isFinite(chosenBaseSample.progress) ? chosenBaseSample.progress : (smoothSample.progress || 0);
    const laneEntry = samplePolylineAtDistance(edgePoints, edgeProgress);
    const backtrack = slicePolylineToDistance(edgePoints, edgeProgress).reverse();
    const corridorEntryDist = Math.min(best.frontType === "center" ? 140 : 96, Math.hypot((targetPlayer.x || 0) - center.x, (targetPlayer.y || 0) - center.y) * 0.16);
    const toCoreDx = (targetPlayer.x || 0) - center.x;
    const toCoreDy = (targetPlayer.y || 0) - center.y;
    const toCoreLen = Math.hypot(toCoreDx, toCoreDy) || 1;
    const ownerShoulder = {
      x: (targetPlayer.x || 0) - (toCoreDx / toCoreLen) * corridorEntryDist,
      y: (targetPlayer.y || 0) - (toCoreDy / toCoreLen) * corridorEntryDist
    };
    const route = mfConcatPointPaths([
      mfBuildLinearPoints(startPoint, laneEntry, 4),
      backtrack,
      mfBuildLinearPoints(backtrack[backtrack.length - 1] || laneEntry, ownerShoulder, 3),
      mfBuildLinearPoints(ownerShoulder, targetPlayer, 3)
    ]);
    return route.length >= 3 ? buildRoundedLanePolyline(route, 82, 5) : route;
  }

  function buildMineFlowRouteGeometry(mine, owner, visualTarget, detail, variant, resourceType, channelSign) {
    if (mine && mine.homeMine && !mine.pairKey) {
      const geom = {
        main: buildMineCoreLaneRoutePoints(
          { x: mine.x, y: mine.y },
          owner,
          mine,
          detail,
          variant,
          channelSign
        ) || mfBuildRoutePoints(
          { x: mine.x, y: mine.y },
          { x: owner.x, y: owner.y },
          mine.id * 11.13,
          variant,
          detail,
          0,
          1,
          channelSign
        ),
        left: null,
        right: null,
        redirect: null
      };
      if (mine._flowInterceptX != null && mine._flowInterceptY != null && visualTarget && visualTarget.id !== mine.ownerId) {
        geom.redirect = buildMineCoreLaneRoutePoints(
          { x: mine._flowInterceptX, y: mine._flowInterceptY },
          visualTarget,
          mine,
          detail,
          variant,
          channelSign
        ) || mfBuildRoutePoints(
          { x: mine._flowInterceptX, y: mine._flowInterceptY },
          { x: visualTarget.x, y: visualTarget.y },
          mine.id * 17.29,
          variant,
          detail,
          0,
          1.15,
          channelSign
        );
      }
      const routePaths = [geom.main];
      if (geom.redirect) routePaths.push(geom.redirect);
      geom.bounds = getPathSetBounds(routePaths);
      return geom;
    }
    const geom = {
      main: buildMineOuterLaneRoutePoints(
        { x: mine.x, y: mine.y },
        owner,
        mine,
        detail,
        variant,
        0,
        channelSign
      ),
      left: null,
      right: null,
      redirect: null
    };
    if (!geom.main) {
      geom.main = buildMineCoreLaneRoutePoints(
        { x: mine.x, y: mine.y },
        owner,
        mine,
        detail,
        variant,
        channelSign
      ) || mfBuildRoutePoints(
        { x: mine.x, y: mine.y },
        { x: owner.x, y: owner.y },
        mine.id * 11.13,
        variant,
        detail,
        0,
        1,
        channelSign
      );
    }
    if (!detail.singleLane && variant.laneCount > 1) {
      geom.left = buildMineOuterLaneRoutePoints({ x: mine.x, y: mine.y }, owner, mine, detail, variant, -1, channelSign)
        || geom.main;
      geom.right = buildMineOuterLaneRoutePoints({ x: mine.x, y: mine.y }, owner, mine, detail, variant, 1, channelSign)
        || geom.main;
    }
    if (mine._flowInterceptX != null && mine._flowInterceptY != null && visualTarget && visualTarget.id !== mine.ownerId) {
      geom.redirect = buildMineOuterLaneRoutePoints(
        { x: mine._flowInterceptX, y: mine._flowInterceptY },
        visualTarget,
        mine,
        detail,
        variant,
        0,
        channelSign
      ) || buildMineCoreLaneRoutePoints(
        { x: mine._flowInterceptX, y: mine._flowInterceptY },
        visualTarget,
        mine,
        detail,
        variant,
        channelSign
      ) || mfBuildRoutePoints(
        { x: mine._flowInterceptX, y: mine._flowInterceptY },
        { x: visualTarget.x, y: visualTarget.y },
        mine.id * 17.29,
        variant,
        detail,
        0,
        1.15,
        channelSign
      );
    }
    const routePaths = [geom.main];
    if (geom.left) routePaths.push(geom.left);
    if (geom.right) routePaths.push(geom.right);
    if (geom.redirect) routePaths.push(geom.redirect);
    geom.bounds = getPathSetBounds(routePaths);
    return geom;
  }

  function getMineFlowRouteGeometry(mine, owner, visualTarget, detail, variant, resourceType, channelSign) {
    mine._flowRouteGeometryCache = mine._flowRouteGeometryCache || new Map();
    const cacheKey = [
      detail.routeSamples || 0,
      detail.singleLane ? 1 : 0,
      mine._flowVersion || 0,
      mine.ownerId || 0,
      visualTarget ? visualTarget.id : 0,
      resourceType || "money",
      channelSign || 0,
      mine.pairKey || "none",
      Math.round(mine.x || 0),
      Math.round(mine.y || 0),
      Math.round(mine._flowInterceptX || 0),
      Math.round(mine._flowInterceptY || 0),
      Math.round((mine._flowInterceptT || 0) * 1000)
    ].join("|");
    let geom = mine._flowRouteGeometryCache.get(cacheKey);
    if (!geom) {
      geom = buildMineFlowRouteGeometry(mine, owner, visualTarget, detail, variant, resourceType, channelSign);
      mine._flowRouteGeometryCache.clear();
      mine._flowRouteGeometryCache.set(cacheKey, geom);
    }
    return geom;
  }

  function buildMineFlowRoute(mine, detail, resourceTypeOverride, channelSign = 0) {
    const owner = state.players.get(mine.ownerId);
    if (!owner || owner.pop <= 0 || mine.captureProgress < 1) return null;
    const resourceType = resourceTypeOverride || getMinePrimaryResourceType(mine);
    const variant = getMineFlowVariant(mine, resourceType);
    const phase = mine._flowPhase || MINE_FLOW_PHASE_NONE;
    const visualTargetId = (phase === MINE_FLOW_PHASE_ENTER || phase === MINE_FLOW_PHASE_HOLD || phase === MINE_FLOW_PHASE_EXIT)
      ? (mine._flowVisualTargetPlayerId || mine.ownerId)
      : mine.ownerId;
    const visualTarget = state.players.get(visualTargetId) || owner;
    const route = {
      key: getMineFlowRouteKey(mine, resourceType),
      mine,
      resourceType,
      owner,
      visualTarget,
      variant,
      channelSign,
      phase,
      phaseProgress: getMineFlowProgress(mine),
      spliceT: mine._flowInterceptT != null ? mfClamp(mine._flowInterceptT, 0.08, 0.96) : 1
    };
    const geom = getMineFlowRouteGeometry(mine, owner, visualTarget, detail, variant, resourceType, channelSign);
    route.main = geom.main;
    route.left = geom.left;
    route.right = geom.right;
    route.redirect = geom.redirect;
    route.bounds = geom.bounds;
    return route;
  }

  function mfTracePath(g, points) {
    if (!points || points.length < 2) return false;
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    return true;
  }

  function mfDrawStroke(g, points, width, color, alpha) {
    if (!mfTracePath(g, points)) return;
    g.stroke({ width, color, alpha });
  }

  function mfDrawDashed(g, points, width, color, alpha, dash, gap, offset) {
    if (!points || points.length < 2) return;
    const dashLen = Math.max(2, dash);
    const gapLen = Math.max(1, gap);
    const cycleLen = dashLen + gapLen;
    let phase = offset || 0;
    for (let i = 1; i < points.length; i++) {
      let ax = points[i - 1].x;
      let ay = points[i - 1].y;
      const bx = points[i].x;
      const by = points[i].y;
      const segDx = bx - ax;
      const segDy = by - ay;
      const segLen = Math.hypot(segDx, segDy);
      if (segLen <= 1e-6) continue;
      if (segLen / Math.max(1, cycleLen) > 28) {
        mfDrawStroke(g, [points[i - 1], points[i]], width, color, alpha * 0.42);
        phase += segLen;
        continue;
      }
      let pos = 0;
      while (pos < segLen) {
        const cyclePos = ((phase % cycleLen) + cycleLen) % cycleLen;
        const on = cyclePos < dashLen;
        const remain = on ? (dashLen - cyclePos) : (cycleLen - cyclePos);
        const safeRemain = Math.max(0.001, remain);
        const step = Math.min(safeRemain, segLen - pos);
        if (on) {
          const t0 = pos / segLen;
          const t1 = (pos + step) / segLen;
          const p0 = { x: ax + segDx * t0, y: ay + segDy * t0 };
          const p1 = { x: ax + segDx * t1, y: ay + segDy * t1 };
          mfDrawStroke(g, [p0, p1], width, color, alpha);
        }
        pos += step;
        phase += step;
      }
    }
  }

  function mfSampleVisualRoute(route, progress, lane) {
    const branch = lane < 0 && route.left ? route.left : (lane > 0 && route.right ? route.right : route.main);
    if (route.phase === MINE_FLOW_PHASE_ENTER || route.phase === MINE_FLOW_PHASE_HOLD) {
      if (route.redirect && progress > route.spliceT) {
        return mfSamplePath(route.redirect, (progress - route.spliceT) / Math.max(0.001, 1 - route.spliceT));
      }
      return mfSamplePath(branch, progress);
    }
    if (route.phase === MINE_FLOW_PHASE_EXIT) {
      const restoreT = mfLerp(route.spliceT, 1, route.phaseProgress);
      return mfSamplePath(branch, progress * restoreT);
    }
    return mfSamplePath(branch, progress);
  }

  function mfBuildPacketTrailPoints(route, progress, lane, span, steps) {
    const clampedProgress = mfClamp(progress, 0, 1);
    const trailSpan = Math.max(0.002, span || 0.03);
    const startProgress = Math.max(0, clampedProgress - trailSpan);
    const sampleCount = Math.max(3, steps | 0);
    const points = [];
    for (let i = 0; i <= sampleCount; i++) {
      const t = mfLerp(startProgress, clampedProgress, i / sampleCount);
      const sample = mfSampleVisualRoute(route, t, lane);
      if (!sample) continue;
      const prev = points[points.length - 1];
      if (prev && Math.hypot((sample.x || 0) - (prev.x || 0), (sample.y || 0) - (prev.y || 0)) <= 0.35) continue;
      points.push({ x: sample.x || 0, y: sample.y || 0 });
    }
    return points;
  }

  function syncMineFlowPackets(routes, detail, dt) {
    for (const route of routes.values()) {
      const mine = route.mine;
      mine._flowLocalVersionSeenByType = mine._flowLocalVersionSeenByType || {};
      mine._flowPacketAccByType = mine._flowPacketAccByType || {};
      if (mine._flowLocalVersionSeenByType[route.resourceType] !== mine._flowVersion) {
        mine._flowLocalVersionSeenByType[route.resourceType] = mine._flowVersion;
        mine._flowPacketAccByType[route.resourceType] = 0;
        removeMineFlowPacketsByRouteKey(route.key);
      }
    }

    const livePerMine = new Map();
    for (let i = state.mineFlowPackets.length - 1; i >= 0; i--) {
      const pkt = state.mineFlowPackets[i];
      const route = routes.get(pkt.routeKey || getMineFlowRouteKey({ id: pkt.mineId }, pkt.resourceType || (pkt.isCredit ? "money" : "xp")));
      if (!route) {
        state.mineFlowPackets.splice(i, 1);
        continue;
      }
      pkt.progress += dt * pkt.speed;
      if (pkt.progress >= 1) {
        state.mineFlowPackets.splice(i, 1);
        continue;
      }
      livePerMine.set(route.key, (livePerMine.get(route.key) || 0) + 1);
    }
    if (detail.maxTotalPackets != null && state.mineFlowPackets.length > detail.maxTotalPackets) {
      state.mineFlowPackets.splice(0, state.mineFlowPackets.length - detail.maxTotalPackets);
    }

    for (const route of routes.values()) {
      const mine = route.mine;
      const rate = Math.max(0.25, mine._flowRate || 0);
      const current = livePerMine.get(route.key) || 0;
      const interval = Math.max(0.20, 0.85 / rate);
      if (mine._flowPacketAccByType[route.resourceType] == null) mine._flowPacketAccByType[route.resourceType] = Math.random() * interval;
      mine._flowPacketAccByType[route.resourceType] += dt;
      let localCount = current;
      if (detail.maxTotalPackets != null && state.mineFlowPackets.length >= detail.maxTotalPackets) continue;
      while (mine._flowPacketAccByType[route.resourceType] >= interval && localCount < detail.maxPacketsPerMine) {
        mine._flowPacketAccByType[route.resourceType] -= interval;
        state.mineFlowPackets.push({
          id: state.nextMineFlowPacketId++,
          routeKey: route.key,
          mineId: mine.id,
          resourceType: route.resourceType,
          progress: 0,
          speed: route.variant.packetSpeed * (0.92 + Math.min(0.24, rate * 0.05)),
          lane: route.variant.laneCount > 1 ? (Math.random() > 0.5 ? 1 : -1) : 0,
          sizeMul: 1 + Math.min(0.20, Math.max(0, rate - 1) * 0.05),
          isCredit: route.resourceType === "money",
          seed: Math.random() * 1000
        });
        localCount++;
      }
    }
  }

  function drawMineFlowPacket(g, route, pkt, detail) {
    const sample = mfSampleVisualRoute(route, pkt.progress, pkt.lane);
    if (!inView(sample.x, sample.y) || !LOD.canDraw("gems")) return;
    const zoom = Math.max(0.001, cam.zoom || 0.22);
    const invZoom = 1 / zoom;
    const farZoomMul = Math.min(1, zoom / 0.28);
    const scale = invZoom * detail.packetScale * pkt.sizeMul * farZoomMul;
    const pulse = 0.7 + 0.3 * Math.sin(state.t * 5 + pkt.seed);
    const coreLen = (pkt.isCredit ? 8 : 7) * scale;
    const width = (pkt.isCredit ? 4.2 : 3.8) * scale;
    const headColor = pkt.isCredit ? 0xffdb70 : 0x86dcff;
    const edgeColor = pkt.isCredit ? 0xfff1b8 : 0xd8f4ff;
    const glowColor = pkt.isCredit ? 0xffb744 : 0x54cfff;
    if (detail.simplePackets) {
      const fallbackTail = mfSampleVisualRoute(route, Math.max(0, pkt.progress - 0.012), pkt.lane) || { x: sample.x - coreLen, y: sample.y };
      drawRoundedLaneStroke(g, [fallbackTail, sample], width * 1.28, glowColor, 0.14 + pulse * 0.06);
      drawRoundedLaneStroke(g, [fallbackTail, sample], Math.max(1, width * 0.56), headColor, 0.48 + pulse * 0.16);
      g.circle(sample.x, sample.y, width * 0.50);
      g.fill({ color: edgeColor, alpha: 0.28 + pulse * 0.12 });
      return;
    }
    const trailSpan = (pkt.isCredit ? 0.032 : 0.028) * (1.05 + pulse * 0.18);
    const trailRaw = mfBuildPacketTrailPoints(route, pkt.progress, pkt.lane, trailSpan, 6);
    const trailPoints = trailRaw.length >= 3
      ? buildRoundedLanePolyline(trailRaw, Math.max(8 * scale, 6), 4)
      : trailRaw;
    const tailHead = trailPoints[trailPoints.length - 1] || sample;
    if (trailPoints.length >= 2) {
      drawRoundedLaneStroke(g, trailPoints, width * 1.9, glowColor, 0.16 + pulse * 0.08);
      const coreTrail = trailPoints.length >= 2 ? trailPoints.slice(Math.max(0, trailPoints.length - 5)) : trailPoints;
      drawRoundedLaneStroke(g, coreTrail, width, headColor, 0.58 + pulse * 0.18);
      drawRoundedLaneStroke(g, coreTrail, Math.max(1, width * 0.32), edgeColor, 0.48 + pulse * 0.12);
    } else {
      const fallbackTail = mfSampleVisualRoute(route, Math.max(0, pkt.progress - 0.01), pkt.lane) || { x: sample.x - coreLen, y: sample.y };
      drawRoundedLaneStroke(g, [fallbackTail, sample], width * 1.9, glowColor, 0.16 + pulse * 0.08);
      drawRoundedLaneStroke(g, [fallbackTail, sample], width, headColor, 0.58 + pulse * 0.18);
      drawRoundedLaneStroke(g, [fallbackTail, sample], Math.max(1, width * 0.32), edgeColor, 0.48 + pulse * 0.12);
    }
    g.circle(
      Number.isFinite(tailHead.x) ? tailHead.x : sample.x,
      Number.isFinite(tailHead.y) ? tailHead.y : sample.y,
      width * 0.52
    );
    g.fill({ color: edgeColor, alpha: 0.34 + pulse * 0.16 });
  }

  function drawMineFlowRoute(g, route, detail) {
    if (route && route.bounds && !rectInView(route.bounds.minX, route.bounds.minY, route.bounds.maxX, route.bounds.maxY, 140)) return;
    const mine = route.mine;
    const variant = route.variant;
    const invZoom = 1 / Math.max(0.001, cam.zoom || 0.22);
    const isMoney = route.resourceType === "money";
    const owner = state.players.get(mine.ownerId);
    const ownerColor = owner ? (owner.color || colorForId(owner.id)) : colorForId(mine.ownerId || 0);
    const visualTarget = state.players.get(mine._flowVisualTargetPlayerId);
    const visualTargetColor = visualTarget ? (visualTarget.color || colorForId(visualTarget.id)) : ownerColor;
    const glowCol = ownerColor;
    const edgeCol = ownerColor;
    const accentCol = ownerColor;
    const interceptColor = visualTargetColor;
    const interceptEdge = visualTargetColor;
    const dash = variant.beamDash;
    const useDashes = detail.allowDashes !== false;

    const spliceT = route.spliceT;
    const enterHold = route.phase === MINE_FLOW_PHASE_ENTER || route.phase === MINE_FLOW_PHASE_HOLD;
    const exit = route.phase === MINE_FLOW_PHASE_EXIT;
    const mainVisibleT = enterHold ? mfLerp(1, spliceT, route.phase === MINE_FLOW_PHASE_HOLD ? 1 : route.phaseProgress) : 1;
    const redirectVisibleT = enterHold ? (route.phase === MINE_FLOW_PHASE_HOLD ? 1 : route.phaseProgress) : (exit ? 1 - route.phaseProgress : 0);
    const mouthPulse = 0.5 + 0.5 * Math.sin(state.t * 5.4 + mine.id * 0.83);

    const visibleMainBase = enterHold
      ? mfBuildPathSlice(route.main, 0, mainVisibleT)
      : (exit ? mfBuildPathSlice(route.main, 0, spliceT) : route.main);
    const exitMainTail = exit ? mfBuildPathSlice(route.main, spliceT, mfLerp(spliceT, 1, route.phaseProgress)) : null;
    const mouth = mfSamplePath(route.main, Math.min(0.07, Math.max(0.03, spliceT * 0.32)));

    mfDrawStroke(g, [{ x: mine.x, y: mine.y }, { x: mouth.x, y: mouth.y }], 1.2 * invZoom, edgeCol, 0.20 * detail.beamAlpha);
    g.circle(mouth.x, mouth.y, (3.4 + mouthPulse * 1.4) * invZoom);
    g.fill({ color: edgeCol, alpha: (0.18 + mouthPulse * 0.10) * detail.beamAlpha });
    g.circle(mouth.x, mouth.y, 1.2 * invZoom);
    g.fill({ color: 0xffffff, alpha: (0.18 + mouthPulse * 0.12) * detail.beamAlpha });

    mfDrawStroke(g, visibleMainBase, 5.4 * invZoom, glowCol, 0.12 * detail.beamAlpha);
    if (useDashes) {
      mfDrawDashed(g, visibleMainBase, 2.0 * invZoom, glowCol, 0.30 * detail.beamAlpha, dash[0] * invZoom * 4, dash[1] * invZoom * 4, -state.t * 36);
      mfDrawDashed(g, visibleMainBase, 0.95 * invZoom, edgeCol, 0.36 * detail.beamAlpha, dash[0] * invZoom * 4, dash[1] * invZoom * 4, -state.t * 44);
    } else {
      mfDrawStroke(g, visibleMainBase, 1.15 * invZoom, edgeCol, 0.24 * detail.beamAlpha);
    }
    if (exitMainTail && exitMainTail.length > 1) {
      mfDrawStroke(g, exitMainTail, 5.4 * invZoom, glowCol, 0.12 * detail.beamAlpha);
      if (useDashes) {
        mfDrawDashed(g, exitMainTail, 2.0 * invZoom, glowCol, 0.30 * detail.beamAlpha, dash[0] * invZoom * 4, dash[1] * invZoom * 4, -state.t * 36);
        mfDrawDashed(g, exitMainTail, 0.95 * invZoom, edgeCol, 0.36 * detail.beamAlpha, dash[0] * invZoom * 4, dash[1] * invZoom * 4, -state.t * 44);
      } else {
        mfDrawStroke(g, exitMainTail, 1.15 * invZoom, edgeCol, 0.24 * detail.beamAlpha);
      }
    }

    if (variant.laneCount > 1 && route.left && route.right) {
      const visibleLeft = enterHold
        ? mfBuildPathSlice(route.left, 0, mainVisibleT)
        : (exit ? mfBuildPathSlice(route.left, 0, spliceT) : route.left);
      const visibleRight = enterHold
        ? mfBuildPathSlice(route.right, 0, mainVisibleT)
        : (exit ? mfBuildPathSlice(route.right, 0, spliceT) : route.right);
      if (useDashes) {
        mfDrawDashed(g, visibleLeft, 1.05 * invZoom, accentCol, 0.34 * detail.beamAlpha, 7 * invZoom, 12 * invZoom, state.t * 24);
        mfDrawDashed(g, visibleRight, 1.05 * invZoom, glowCol, 0.32 * detail.beamAlpha, 7 * invZoom, 12 * invZoom, -state.t * 22);
      }
      if (detail.bridges) {
        const bridgeStep = Math.max(3, Math.floor(Math.min(visibleLeft.length, visibleRight.length) / 7));
        for (let i = bridgeStep; i < visibleLeft.length - 1 && i < visibleRight.length - 1; i += bridgeStep * 2) {
          mfDrawStroke(g, [visibleLeft[i], visibleRight[i]], 0.55 * invZoom, edgeCol, 0.18 * detail.beamAlpha);
        }
      }
    }

    if ((variant.routeStyle === "siphon" || variant.haloNodes) && visibleMainBase.length > 3) {
      const haloSamples = [0.24, 0.46, 0.68];
      for (let hi = 0; hi < haloSamples.length; hi++) {
        const halo = mfSamplePath(route.main, Math.min(mainVisibleT, haloSamples[hi] * Math.max(0.45, spliceT)));
        g.circle(halo.x, halo.y, (4.6 + hi * 1.1) * invZoom);
        g.stroke({ color: edgeCol, width: 0.55 * invZoom, alpha: (0.10 + hi * 0.03) * detail.beamAlpha });
      }
    }

    if (route.redirect && route.redirect.length > 1 && redirectVisibleT > 0.001) {
      const visibleRedirect = mfBuildPathSlice(route.redirect, 0, redirectVisibleT);
      mfDrawStroke(g, visibleRedirect, 5.3 * invZoom, interceptColor, 0.10 * detail.beamAlpha);
      if (useDashes) {
        mfDrawDashed(g, visibleRedirect, 2.0 * invZoom, interceptColor, 0.28 * detail.beamAlpha, dash[0] * invZoom * 4, dash[1] * invZoom * 4, -state.t * 30);
        mfDrawDashed(g, visibleRedirect, 0.95 * invZoom, interceptEdge, 0.58 * detail.beamAlpha, dash[0] * invZoom * 4, dash[1] * invZoom * 4, -state.t * 38);
      } else {
        mfDrawStroke(g, visibleRedirect, 1.10 * invZoom, interceptEdge, 0.24 * detail.beamAlpha);
      }
    }

    if (mine._flowInterceptX != null && mine._flowInterceptY != null && route.phase !== MINE_FLOW_PHASE_NONE) {
      const splicePulse = 0.5 + 0.5 * Math.sin(state.t * 6.2 + mine.id * 1.31);
      g.circle(mine._flowInterceptX, mine._flowInterceptY, (8.2 + splicePulse * 2.6) * invZoom);
      g.stroke({ color: interceptEdge, width: 0.95 * invZoom, alpha: (0.18 + splicePulse * 0.14) * detail.beamAlpha });
      g.circle(mine._flowInterceptX, mine._flowInterceptY, 4.0 * invZoom);
      g.stroke({ color: interceptColor, width: 0.55 * invZoom, alpha: (0.22 + splicePulse * 0.08) * detail.beamAlpha });
      g.circle(mine._flowInterceptX, mine._flowInterceptY, 2.1 * invZoom);
      g.fill({ color: interceptColor, alpha: 0.42 * detail.beamAlpha });
      if (route.redirect && route.redirect.length > 1) {
        const redirectHead = mfSamplePath(route.redirect, Math.min(0.14, Math.max(0.05, redirectVisibleT * 0.24 + 0.05)));
        mfDrawStroke(g, [
          { x: mine._flowInterceptX, y: mine._flowInterceptY },
          { x: redirectHead.x, y: redirectHead.y }
        ], 0.65 * invZoom, interceptEdge, (0.14 + splicePulse * 0.10) * detail.beamAlpha);
      }
    }

    if (detail.shimmer) {
      const pulse = mfSampleVisualRoute(route, (state.t * variant.pulseSpeed + mine.id * 0.13) % 1, 0);
      g.circle(pulse.x, pulse.y, 2.2 * invZoom);
      g.fill({ color: edgeCol, alpha: 0.52 * detail.beamAlpha });
      if (variant.routeStyle === "ladder") {
        const steps = 5;
        for (let i = 1; i < steps; i++) {
          const t = (spliceT * i) / steps;
          const m = mfSamplePath(route.main, t);
          const prev = mfSamplePath(route.main, Math.max(0, t - 0.02));
          const next = mfSamplePath(route.main, Math.min(1, t + 0.02));
          const ang = Math.atan2((next.y || 0) - (prev.y || 0), (next.x || 0) - (prev.x || 0));
          const rungLen = 3.6 * invZoom;
          mfDrawStroke(g, [
            { x: m.x - Math.cos(ang) * rungLen * 0.5, y: m.y - Math.sin(ang) * rungLen * 0.5 },
            { x: m.x + Math.cos(ang) * rungLen * 0.5, y: m.y + Math.sin(ang) * rungLen * 0.5 }
          ], 0.8 * invZoom, accentCol, 0.20 * detail.beamAlpha);
        }
      }
    }
  }

  function updateMineFlowVisuals(dt) {
    try {
      ensureMineFlowVisuals();
      const detail = getMineFlowDetail();
      if (detail.updateEveryFrames > 1 && ((state._frameCtr || 0) % detail.updateEveryFrames) !== 0) return;
      updateMineAmbientVisuals();
      const beamG = state._mineFlowBeamGfx;
      const packetG = state._mineFlowPacketGfx;
      beamG.clear();
      packetG.clear();
      const routes = new Map();
      for (const mine of state.mines.values()) {
        if (!mine.ownerId || mine.captureProgress < 1) continue;
        const owner = state.players.get(mine.ownerId);
        if (!owner) continue;
        if (!isMineFlowLikelyVisible(mine, owner, detail)) continue;
        const outputs = getMineOutputResourceTypes(mine);
        const signs = outputs.length === 2 ? [-1, 1] : [0];
        for (let ri = 0; ri < outputs.length; ri++) {
          if (detail.maxRoutes != null && routes.size >= detail.maxRoutes) break;
          try {
            const route = buildMineFlowRoute(mine, detail, outputs[ri], signs[ri] || 0);
            if (!route) continue;
            routes.set(route.key, route);
          } catch (routeErr) {
            if (!state._mineFlowRouteErrLogged) {
              console.warn("[MINE-VFX] route build error:", routeErr, "mine=", mine.id);
              state._mineFlowRouteErrLogged = true;
            }
          }
        }
        if (detail.maxRoutes != null && routes.size >= detail.maxRoutes) break;
      }

      syncMineFlowPackets(routes, detail, dt);

      for (const route of routes.values()) drawMineFlowRoute(beamG, route, detail);
      for (let i = 0; i < state.mineFlowPackets.length; i++) {
        const pkt = state.mineFlowPackets[i];
        const route = routes.get(pkt.routeKey || getMineFlowRouteKey({ id: pkt.mineId }, pkt.resourceType || (pkt.isCredit ? "money" : "xp")));
        if (route) drawMineFlowPacket(packetG, route, pkt, detail);
      }
    } catch (err) {
      if (!state._mineFlowErrLogged) {
        console.error("[MINE-VFX] updateMineFlowVisuals error:", err);
        state._mineFlowErrLogged = true;
      }
    }
  }

  // ── Nebula placement: background-only visual layer, no gameplay zones ──
  function placeNebulae(rndFn) {
    state.nebulae = [];
    stateNebulaClouds = [];
    stateNebulaFogWisps = [];
    invalidateNebulaBodyGraphics();
  }

  function isInNebula(x, y) {
    return false;
  }

  function stepNebulae(dt) {
    if (!state.nebulae) return;
    const detail = getNebulaVisualDetail();
    for (const neb of state.nebulae) {
      initNebulaVisual(neb);
      const zone = getAnimatedNebulaZone(neb);
      neb._glowPhase = (neb._glowPhase || 0) + dt * 0.24;
      neb._glowAlpha = 0.09;

      const maxDischarges = detail.maxDischarges;
      const spawnRate = 0.0014 + zone.radius * 0.000012;
      if (neb.discharges.length < maxDischarges && Math.random() < dt * spawnRate) {
        const a = Math.random() * Math.PI * 2;
        const d = zone.radius * (0.06 + Math.random() * 0.30);
        const sx = zone.x + Math.cos(a) * d;
        const sy = zone.y + Math.sin(a) * d;
        const segs = [];
        let px = sx, py = sy;
        let angle = Math.random() * Math.PI * 2;
        const segCount = detail.dischargeSegMin + Math.floor(Math.random() * (detail.dischargeSegMax - detail.dischargeSegMin + 1));
        const segLen = 16 + Math.random() * 26;
        const branchChance = cam.zoom > 0.40 ? 0.08 : 0.03;
        const angleJitter = 0.42 + Math.random() * 0.34;
        for (let s = 0; s < segCount; s++) {
          angle += (Math.random() - 0.5) * angleJitter;
          const len = segLen * (0.82 + Math.random() * 0.44);
          const nx = px + Math.cos(angle) * len;
          const ny = py + Math.sin(angle) * len;
          segs.push({ x1: px, y1: py, x2: nx, y2: ny });
          px = nx; py = ny;
          if (Math.random() < branchChance && s < segCount - 1) {
            const ba = angle + (Math.random() < 0.5 ? 0.55 : -0.55) + (Math.random() - 0.5) * 0.32;
            const bl = 10 + Math.random() * 18;
            segs.push({ x1: px, y1: py, x2: px + Math.cos(ba) * bl, y2: py + Math.sin(ba) * bl });
          }
          if (Math.hypot(px - zone.x, py - zone.y) > zone.radius * 0.72) break;
        }
        let totalLen = 0;
        const segsWithLen = segs.map(seg => {
          const l = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
          totalLen += l;
          return { ...seg, cumLen: totalLen };
        });
        const life = 6.2 + Math.random() * 3.8;
        const hue = getNebulaVisualVariant(neb).sparkColor;
        const startX = segs[0].x1, startY = segs[0].y1;
        const lastSeg = segs[segs.length - 1];
        neb.discharges.push({
          segs: segsWithLen,
          totalLen,
          life,
          maxLife: life,
          revealDur: life * 0.58,
          hue,
          startX,
          startY,
          endX: lastSeg.x2,
          endY: lastSeg.y2
        });
      }
      for (let i = neb.discharges.length - 1; i >= 0; i--) {
        neb.discharges[i].life -= dt;
        if (neb.discharges[i].life <= 0) neb.discharges.splice(i, 1);
      }
    }
  }

  function resetWorld() {
    invalidateNebulaBodyGraphics();
    destroyChildren(nebulaLayer);
    destroyChildren(nebulaFxLayer);
    destroyChildren(zonesLayer);
    clearTransientWorldFxLayers();
    destroyChildren(turretLayer);
    destroyChildren(mineLayer);
    destroyChildren(resLayer);
    destroyChildren(unitsLayer);
    destroyChildren(cityLayer);
    destroyChildren(ghostLayer);
    destroyTransientChildren(pathPreviewLayer);
    destroyChildren(squadLabelsLayer);
    destroyChildren(bulletsLayer);
    destroyTransientChildren(floatingDamageLayer);
    destroyChildren(activityZoneLayer);
    destroyChildren(abilityFxLayer);
    destroyChildren(combatLayer);
    destroyChildren(screenFxLayer);
    overlapG = new PIXI.Graphics();
    zonesLayer.addChild(overlapG);

    // Clear state
    state.players.clear();
    state.units.clear();
    state.res.clear();
    state.turrets.clear();
    state.mines.clear();
    state.mineGems = [];
    state.mineFlowPackets = [];
    state._mineIncomeSoundBudget = 0;
    state._killRewardPulseBatches = new Map();
    state._shipBuildQueues = new Map();
    state._laneFighterWaveNextAt = null;
    state._laneFighterWaveIndex = 0;
    state.nebulae = [];
    nextMineId = 1;
    state.nextTurretId = 1;
    state.nextUnitId = 1;
    state.nextResId = 1;
    state.nextMineFlowPacketId = 1;
    state.t = 0;
    state.timeScale = 1;
    state._domTimers = {};
    state._gameOver = false;
    state._pendingFullSnap = null;
    state._pendingSnap = null;
    for (const bh of state._blackHoles || []) destroyBlackHoleVisual(bh);
    state._blackHoles = [];
    for (const strike of state._orbitalStrikes || []) destroyOrbitalStrikeVisual(strike);
    state._orbitalStrikes = [];
    for (const strike of state._thermoNukes || []) destroyThermoNukeVisual(strike);
    state._thermoNukes = [];
    for (const raid of state._pirateRaids || []) destroyPirateRaidVisual(raid);
    state._pirateRaids = [];
    for (const effect of state._economyAbilityFx || []) destroyEconomyAbilityVisual(effect);
    state._economyAbilityFx = [];
    state._randomBlackHoleNextAt = toSimSeconds(300);
    state._randomMeteorNextAt = toSimSeconds(240);
    state._randomMeteorScheduled = [];
    // Reset fog memories
    app.renderer.render(new PIXI.Graphics(), { renderTexture: fogMemRT, clear: true });

    state.ghosts = [];
    state.bullets = [];
    if (state.storm) destroyIonStormVisual(state.storm);
    state.storm = null;
    state._nextStormAt = STORM_STARTUP_DELAY;
    state._ruinSpawns = [];
    state.floatingDamage = [];
    state._deathBursts = [];
    state.selectedUnitIds.clear();
    state.prevInCombatIds.clear();
    state.squads = new Map();
    state.engagementZones = new Map();
    state.nextSquadId = 1;
    state.nextEngagementZoneId = 1;
    state.coreFrontPolicies = {};
    state.frontGraph = {};
    state.squadFrontAssignments = {};
    state.centerObjectives = { centerX: 0, centerY: 0, richMineId: null, centerMineIds: [], pirateBaseIds: [], livePirateBaseIds: [], securedByPlayerId: null, requiredMineCount: 0 };
    state.smoothedFronts = {};
    state.persistentBattles = {};
    state.resourceClusters = [];
    state._soloNoBotAi = false;

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

      placeMines([{ pos: { x: cx, y: topY }, ownerId: 1 }], soloRnd);
      placeNebulae(soloRnd);
      return;
    }

    state._survivalMode = false;
    if (state._quickStartScenario === "stress400") {
      state._soloNoBotAi = true;
      state.botPlayerIds = new Set([2]);

      const mePos = { x: CFG.WORLD_W * 0.22, y: CFG.WORLD_H * 0.50 };
      const botPos = { x: CFG.WORLD_W * 0.78, y: CFG.WORLD_H * 0.50 };

      const me = makePlayer(1, nameForId(1), mePos.x, mePos.y, CFG.POP_START);
      me.color = SOLO_PALETTE[soloIdx];
      PLAYER_COLORS[1] = me.color;
      state.players.set(me.id, me);
      makeCityVisual(me);
      makeZoneVisual(me);

      const bot = makePlayer(2, nameForId(2), botPos.x, botPos.y, CFG.POP_START);
      bot.color = remainingColors[0] ?? SOLO_PALETTE[3];
      PLAYER_COLORS[2] = bot.color;
      state.players.set(bot.id, bot);
      makeCityVisual(bot);
      makeZoneVisual(bot);

      centerOn(me.x, me.y);

      placeMines([{ pos: mePos, ownerId: 1 }, { pos: botPos, ownerId: 2 }], soloRnd);
      placeNebulae(soloRnd);

      for (const mine of state.mines.values()) {
        const keepMineForPlayer = mine.ownerId === 1;
        mine.ownerId = keepMineForPlayer ? 1 : 2;
        mine.captureProgress = 1;
        mine._capturingOwner = null;
        mine._captureProtectedUntil = 0;
        clearMineFlowState(mine);
        updateMineVisual(mine);
        if (mine.gfx) updateMineProgressBar(mine);
      }

      clearPirateBases();

      const spawnStressCorvettes = (ownerId, origin, targetCity, attackTarget, mergeIntoOneSquad) => {
        const count = 400;
        const sourceTag = `stress400-${ownerId}`;
        const spawnedSquadIds = [];
        for (let i = 0; i < count; i++) {
          const band = Math.floor(i / 40);
          const ring = 88 + band * 18 + (i % 5) * 3;
          const angle = (i / Math.max(1, count)) * Math.PI * 2 + band * 0.07;
          const sx = clamp(origin.x + Math.cos(angle) * ring, 50, CFG.WORLD_W - 50);
          const sy = clamp(origin.y + Math.sin(angle) * ring * 0.72, 50, CFG.WORLD_H - 50);
          const holdWp = { x: sx, y: sy };
          const attackWp = {
            x: targetCity.x + Math.cos(angle) * 28,
            y: targetCity.y + Math.sin(angle) * 28
          };
          const u = spawnUnitAt(
            sx,
            sy,
            ownerId,
            "fighter",
            [attackTarget ? attackWp : holdWp],
            { sourceTag, autoGroupUntil: state.t + 6, allowAutoJoinRecentSpawn: true }
          );
          if (!u) continue;
          if (u.squadId != null) spawnedSquadIds.push(u.squadId);
          if (attackTarget && typeof SQUADLOGIC !== "undefined" && u.squadId != null && SQUADLOGIC.issueSiegeOrder) {
            SQUADLOGIC.issueSiegeOrder(state, u.squadId, targetCity.id, [{ x: targetCity.x, y: targetCity.y }]);
          } else {
            u.waypoints = [holdWp];
            u.waypointIndex = 0;
          }
        }
        if (
          mergeIntoOneSquad &&
          typeof SQUADLOGIC !== "undefined" &&
          SQUADLOGIC.mergeSquads &&
          spawnedSquadIds.length > 1
        ) {
          const merged = SQUADLOGIC.mergeSquads(state, [...new Set(spawnedSquadIds)], "line", 8, 1);
          if (merged) {
            if (SQUADLOGIC.issueSiegeOrder && attackTarget) {
              SQUADLOGIC.issueSiegeOrder(state, merged.id, targetCity.id, [{ x: targetCity.x, y: targetCity.y }]);
            }
            if (SQUADLOGIC.recalculateFormation) {
              SQUADLOGIC.recalculateFormation(state, merged.id, { getFormationOffsets }, true);
            }
          }
        }
      };

      spawnStressCorvettes(1, mePos, me, false, false);
      spawnStressCorvettes(2, botPos, me, true, true);
      return;
    }

    const desiredBotCount = state._soloGameMode === "quad" ? 3 : 1;
    state._soloBotCount = desiredBotCount;
    const botCount = desiredBotCount;
    const totalPlayers = 1 + botCount;
    const spawnPositions = getFixedSpawnPositions(4);
    const playerSpawnIdx = Math.max(0, Math.min(spawnPositions.length - 1, state._soloSpawnIndex ?? 0));
    const botSpawnIndices = totalPlayers === 2
      ? [((playerSpawnIdx + 2) % spawnPositions.length)]
      : [0, 1, 2, 3].filter((idx) => idx !== playerSpawnIdx);
    const playerPos = spawnPositions[playerSpawnIdx];
    const botPositions = botSpawnIndices.map((idx) => spawnPositions[idx]).filter(Boolean);

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

    const mineEntries = spawnPositions.map((pos, idx) => {
      if (idx === playerSpawnIdx) return { pos, ownerId: 1, virtualId: idx + 1 };
      const botIdx = botSpawnIndices.indexOf(idx);
      if (botIdx >= 0) return { pos, ownerId: 2 + botIdx, virtualId: idx + 1 };
      return { pos, ownerId: null, virtualId: -(idx + 1), sectorObjectiveId: "sector:" + idx };
    });
    placeMines(mineEntries, soloRnd);
    placeNebulae(soloRnd);
  }

  function resetWorldMulti(slots, slotToPid) {
    state._survivalMode = false;
    state._soloNoBotAi = false;
    let locRand = rand;
    let locRnd = () => Math.random();
    if (state._gameSeed != null) {
      const rng = mulberry32(state._gameSeed);
      locRand = (a, b) => (b - a) * rng() + a;
      locRnd = rng;
    }
    invalidateNebulaBodyGraphics();
    destroyChildren(nebulaLayer);
    destroyChildren(nebulaFxLayer);
    destroyChildren(zonesLayer);
    clearTransientWorldFxLayers();
    destroyChildren(turretLayer);
    destroyChildren(mineLayer);
    destroyChildren(resLayer);
    destroyChildren(unitsLayer);
    destroyChildren(cityLayer);
    destroyChildren(ghostLayer);
    destroyTransientChildren(pathPreviewLayer);
    destroyChildren(squadLabelsLayer);
    destroyChildren(bulletsLayer);
    destroyTransientChildren(floatingDamageLayer);
    destroyChildren(activityZoneLayer);
    destroyChildren(abilityFxLayer);
    destroyChildren(combatLayer);
    destroyChildren(screenFxLayer);
    overlapG = new PIXI.Graphics();
    zonesLayer.addChild(overlapG);

    state.players.clear();
    state.units.clear();
    state.res.clear();
    state.turrets.clear();
    state.mines.clear();
    state.mineGems = [];
    state.mineFlowPackets = [];
    state._mineIncomeSoundBudget = 0;
    state._killRewardPulseBatches = new Map();
    state._shipBuildQueues = new Map();
    state._laneFighterWaveNextAt = null;
    state._laneFighterWaveIndex = 0;
    state.nebulae = [];
    nextMineId = 1;
    state.nextTurretId = 1;
    state.nextUnitId = 1;
    state.nextResId = 1;
    state.nextMineFlowPacketId = 1;
    state.t = 0;
    state.timeScale = 1;
    state._domTimers = {};
    state._gameOver = false;
    state._pendingFullSnap = null;
    state._pendingSnap = null;
    for (const bh of state._blackHoles || []) destroyBlackHoleVisual(bh);
    state._blackHoles = [];
    for (const strike of state._orbitalStrikes || []) destroyOrbitalStrikeVisual(strike);
    state._orbitalStrikes = [];
    for (const strike of state._thermoNukes || []) destroyThermoNukeVisual(strike);
    state._thermoNukes = [];
    for (const raid of state._pirateRaids || []) destroyPirateRaidVisual(raid);
    state._pirateRaids = [];
    for (const effect of state._economyAbilityFx || []) destroyEconomyAbilityVisual(effect);
    state._economyAbilityFx = [];
    state._randomBlackHoleNextAt = toSimSeconds(300);
    state._randomMeteorNextAt = toSimSeconds(240);
    state._randomMeteorScheduled = [];
    app.renderer.render(new PIXI.Graphics(), { renderTexture: fogMemRT, clear: true });
    state.ghosts = [];
    state.bullets = [];
    if (state.storm) destroyIonStormVisual(state.storm);
    state.storm = null;
    state._nextStormAt = STORM_STARTUP_DELAY;
    state._ruinSpawns = [];
    state.floatingDamage = [];
    state._deathBursts = [];
    state.selectedUnitIds.clear();
    state.prevInCombatIds.clear();
    state.squads = new Map();
    state.engagementZones = new Map();
    state.nextSquadId = 1;
    state.nextEngagementZoneId = 1;
    state.coreFrontPolicies = {};
    state.frontGraph = {};
    state.squadFrontAssignments = {};
    state.centerObjectives = { centerX: 0, centerY: 0, richMineId: null, centerMineIds: [], pirateBaseIds: [], livePirateBaseIds: [], securedByPlayerId: null, requiredMineCount: 0 };
    state.smoothedFronts = {};
    state.persistentBattles = {};

    const filledSlotIndices = Object.keys(slotToPid).map(Number).sort((a, b) => a - b);
    const n = filledSlotIndices.length;
    const allSpawns = getFixedSpawnPositions(4);
    const activeSpawnIndices = n === 2 ? [0, 2] : [0, 1, 2, 3];

    const positions = [];
    const mineEntries = [];
    for (let i = 0; i < filledSlotIndices.length; i++) {
      const slotIndex = filledSlotIndices[i];
      const pid = slotToPid[slotIndex];
      const spawnIdx = activeSpawnIndices[i] ?? i;
      const pos = allSpawns[spawnIdx] || allSpawns[0];
      positions.push(pos);
      mineEntries.push({ pos, ownerId: pid, virtualId: spawnIdx + 1 });
      const pl = makePlayer(pid, nameForId(pid), pos.x, pos.y, CFG.POP_START);
      state.players.set(pl.id, pl);
      makeCityVisual(pl);
      makeZoneVisual(pl);
    }
    const me = state.players.get(state.myPlayerId);
    centerOn(me.x, me.y);

    if (n === 2) {
      for (let i = 0; i < allSpawns.length; i++) {
        if (!activeSpawnIndices.includes(i)) {
          mineEntries.push({ pos: allSpawns[i], ownerId: null, virtualId: -(i + 1), sectorObjectiveId: "sector:" + i });
        }
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
      baseMaxHp: type.hp, baseDamage: type.damage, baseAttackRate: type.attackRate, baseAttackRange: type.attackRange, baseSpeed: type.speed,
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
        frontType: opts && opts.frontType ? opts.frontType : null,
        autoGroupUntil: opts && opts.autoGroupUntil != null ? opts.autoGroupUntil : null,
        allowAutoJoinRecentSpawn: !!(opts && opts.allowAutoJoinRecentSpawn),
        order: { type: "move", waypoints: cloneWaypointsSafe(waypoints), holdPoint: null }
      });
    }
    return u;
  }

  const UNIT_CAPS = { fighter: 300, destroyer: 100, cruiser: 50, battleship: 10, hyperDestroyer: 10 };
  const BUILD_QUEUE_INTERVAL = toSimSeconds(1);

  function countPlayerUnits(ownerId, typeKey) {
    let n = 0;
    for (const u of state.units.values()) {
      if (u.owner === ownerId && (u.unitType || "fighter") === typeKey && u.hp > 0) n++;
    }
    return n;
  }

  function getShipBuildQueue(ownerId) {
    state._shipBuildQueues = state._shipBuildQueues || new Map();
    let queue = state._shipBuildQueues.get(ownerId);
    if (!queue) {
      queue = { entries: [], lastQueuedAt: state.t || 0 };
      state._shipBuildQueues.set(ownerId, queue);
    }
    return queue;
  }

  function countQueuedPlayerUnits(ownerId, typeKey) {
    const queue = state._shipBuildQueues ? state._shipBuildQueues.get(ownerId) : null;
    if (!queue || !Array.isArray(queue.entries) || queue.entries.length === 0) return 0;
    const type = UNIT_TYPES[typeKey];
    const squadSize = Math.max(1, type?.squadSize || 1);
    let n = 0;
    for (const entry of queue.entries) {
      if (!entry || entry.unitTypeKey !== typeKey) continue;
      if (entry.kind === "frontTriplet") n += squadSize * 3;
      else n += squadSize;
    }
    return n;
  }

  function queueShipBuild(ownerId, entry) {
    const queue = getShipBuildQueue(ownerId);
    const now = state.t || 0;
    const executeAt = Math.max(now, queue.lastQueuedAt || now) + BUILD_QUEUE_INTERVAL;
    const queued = { ...entry, ownerId, executeAt };
    queue.entries.push(queued);
    queue.lastQueuedAt = executeAt;
    return queued;
  }

  function getUnitPurchaseQuote(ownerId, unitTypeKey, purchaseCount = 1, bundleUnits = 1) {
    const p = state.players.get(ownerId);
    if (!p) return { ok: false, reason: "no_player" };
    const type = UNIT_TYPES[unitTypeKey];
    if (!type) return { ok: false, reason: "unknown_type" };
    const cap = UNIT_CAPS[unitTypeKey] ?? 300;
    const current = countPlayerUnits(ownerId, unitTypeKey);
    const queued = countQueuedPlayerUnits(ownerId, unitTypeKey);
    const squadSize = Math.max(1, type.squadSize || 1);
    const unitsPerOrder = getPurchaseUnitsPerOrder(bundleUnits);
    const requestedUnits = squadSize * Math.max(1, purchaseCount | 0) * unitsPerOrder;
    if (current + queued + requestedUnits > cap) return { ok: false, reason: "cap_reached" };
    const costInfo = getPurchaseCostWithModifiers(ownerId, unitTypeKey, purchaseCount, unitsPerOrder);
    const cost = costInfo.costPerPurchase;
    const totalCost = costInfo.totalCost;
    if ((p.eCredits || 0) < totalCost) return { ok: false, reason: "no_credits" };
    return { ok: true, player: p, type, cap, current, queued, squadSize, unitsPerOrder, costPerPurchase: cost, totalCost };
  }

  function seedFrontAssignment(ownerId, squadId, frontType) {
    if (squadId == null || !frontType) return;
    const graph = state.frontGraph && state.frontGraph[ownerId] ? state.frontGraph[ownerId] : null;
    const targetCoreId = frontType === "left"
      ? graph && graph.leftTargetCoreId
      : frontType === "right"
        ? graph && graph.rightTargetCoreId
        : (state.centerObjectives && state.centerObjectives.securedByPlayerId === ownerId
            ? (graph && Array.isArray(graph.enemyCoreIds) ? (graph.enemyCoreIds[0] || null) : null)
            : null);
    state.squadFrontAssignments = state.squadFrontAssignments || {};
    const existing = state.squadFrontAssignments[squadId] || {};
    const squad = state.squads && state.squads.get(squadId);
    if (squad) squad.frontType = frontType;
    state.squadFrontAssignments[squadId] = {
      squadId,
      ownerId,
      frontId: ownerId + ":" + frontType,
      frontType,
      role: frontType === "center" ? "center" : "pressure",
      originCoreId: ownerId,
      targetCoreId,
      assignedAt: state.t || 0,
      assignmentLockUntil: (state.t || 0) + 3,
      lastIssuedAt: existing.lastIssuedAt || 0,
      lastOrderSignature: existing.lastOrderSignature || ""
    };
  }

  function spawnPurchasedSquad(ownerId, unitTypeKey, waypoints, opts) {
    const p = state.players.get(ownerId);
    const type = UNIT_TYPES[unitTypeKey];
    if (!p || !type) return { ok: false, spawned: 0, squadId: null };

    const n = Math.max(1, type.squadSize || 1);
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
        dmg: type.damage,
        atkCd: rand(0, 1 / (type.attackRate * atkRateMul)),
        attackRange: type.attackRange,
        maxTargets: type.maxTargets,
        speed: type.speed,
        baseMaxHp: type.hp,
        baseDamage: type.damage,
        baseAttackRate: type.attackRate,
        baseAttackRange: type.attackRange,
        baseSpeed: type.speed,
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

    let createdSquad = null;
    if (leaderId != null && typeof SQUADLOGIC !== "undefined" && SQUADLOGIC.createSquad) {
      const unitIds = [];
      for (const u of state.units.values()) {
        if (u.id === leaderId || u.leaderId === leaderId) unitIds.push(u.id);
      }
      createdSquad = SQUADLOGIC.createSquad(state, unitIds, {
        leaderUnitId: leaderId,
        formationType,
        formationRows,
        formationWidth: pigW,
        sourceTag: (opts && opts.sourceTag) || "spawn",
        frontType: opts && opts.frontType ? opts.frontType : null,
        autoGroupUntil: state.t + 3,
        allowAutoJoinRecentSpawn: true,
        order: {
          type: "move",
          waypoints: adjustedPts.map((w) => ({ x: w.x, y: w.y })),
          holdPoint: null
        }
      });
    }

    return { ok: true, spawned: n, squadId: createdSquad ? createdSquad.id : null, leaderId };
  }

  function completeQueuedPurchaseUnit(ownerId, unitTypeKey, waypoints, opts) {
    const spawned = spawnPurchasedSquad(ownerId, unitTypeKey, waypoints, opts);
    if (!spawned.ok) return { ok: false, reason: "spawn_failed" };
    if (opts && opts.frontType && spawned.squadId != null) seedFrontAssignment(ownerId, spawned.squadId, opts.frontType);
    return { ok: true, spawned: spawned.spawned, squadId: spawned.squadId };
  }

  function purchaseUnit(ownerId, unitTypeKey, waypoints, opts) {
    const quote = getUnitPurchaseQuote(ownerId, unitTypeKey, 1);
    if (!quote.ok) return quote;
    quote.player.eCredits -= quote.costPerPurchase;
    const queued = queueShipBuild(ownerId, {
      kind: "single",
      unitTypeKey,
      refundCost: quote.costPerPurchase,
      waypoints: cloneWaypointsSafe(waypoints),
      opts: opts ? {
        sourceTag: opts.sourceTag,
        frontType: opts.frontType,
        autoGroupUntil: opts.autoGroupUntil,
        allowAutoJoinRecentSpawn: !!opts.allowAutoJoinRecentSpawn,
        formationType: opts.formationType,
        formationRows: opts.formationRows,
        formationPigWidth: opts.formationPigWidth
      } : null
    });
    return { ok: true, queued: true, cost: quote.costPerPurchase, eta: Math.max(0, queued.executeAt - (state.t || 0)) };
  }

  function completeQueuedFrontTriplet(ownerId, unitTypeKey) {
    const frontSpecs = getAutoFrontSpecs(ownerId);
    if (!frontSpecs || frontSpecs.length === 0) return { ok: false, reason: "no_fronts" };
    let spawned = 0;
    const squadIds = [];
    const fronts = [];
    for (const spec of frontSpecs) {
      const sourceTag = (spec && spec.sourceTag) || ("front:" + spec.frontType);
      const out = spawnPurchasedSquad(ownerId, unitTypeKey, cloneWaypointsSafe(spec.waypoints), {
        sourceTag,
        frontType: spec.frontType,
        autoGroupUntil: (state.t || 0) + 5,
        allowAutoJoinRecentSpawn: true
      });
      spawned += out.spawned || 0;
      fronts.push({ frontType: spec.frontType, squadId: out.squadId });
      if (out.squadId != null) {
        squadIds.push(out.squadId);
        seedFrontAssignment(ownerId, out.squadId, spec.frontType);
      }
    }
    return { ok: true, spawned, squadIds, fronts };
  }

  function purchaseFrontTriplet(ownerId, unitTypeKey) {
    const quote = getUnitPurchaseQuote(ownerId, unitTypeKey, 1, 3);
    if (!quote.ok) return quote;
    const frontSpecs = getAutoFrontSpecs(ownerId);
    if (!frontSpecs || frontSpecs.length === 0) return { ok: false, reason: "no_fronts" };
    quote.player.eCredits -= quote.totalCost;
    const queued = queueShipBuild(ownerId, {
      kind: "frontTriplet",
      unitTypeKey,
      refundCost: quote.totalCost
    });
    return { ok: true, queued: true, cost: quote.totalCost, eta: Math.max(0, queued.executeAt - (state.t || 0)) };
  }

  function processShipBuildQueues() {
    if (!state._shipBuildQueues || state._shipBuildQueues.size === 0) return;
    const now = state.t || 0;
    for (const [ownerId, queue] of state._shipBuildQueues.entries()) {
      if (!queue || !Array.isArray(queue.entries) || queue.entries.length === 0) continue;
      while (queue.entries.length > 0 && (queue.entries[0].executeAt || 0) <= now) {
        const entry = queue.entries.shift();
        if (!entry) continue;
        let result;
        if (entry.kind === "frontTriplet") result = completeQueuedFrontTriplet(ownerId, entry.unitTypeKey);
        else result = completeQueuedPurchaseUnit(ownerId, entry.unitTypeKey, entry.waypoints, entry.opts || null);
        if (!result || result.ok === false) {
          const player = state.players.get(ownerId);
          if (player && entry.refundCost) player.eCredits = (player.eCredits || 0) + entry.refundCost;
        }
      }
      if (queue.entries.length === 0) queue.lastQueuedAt = now;
    }
  }

  function spawnUnits(ownerId, count, waypoints, opts) {
    return purchaseUnit(ownerId, (opts && opts.unitType) || "fighter", waypoints, opts);
  }

  function spawnXPOrb(x, y, xp, killerOwner, opts) {
    opts = opts || {};
    const maxRes = CFG.RES_MAX ?? 520;
    if (state.res.size >= maxRes) {
      const firstId = state.res.keys().next().value;
      if (firstId != null) deleteResource(firstId);
    }
    const id = state.nextResId++;
    const r = {
      id, type: "orb", xp, x, y, color: 0xffdd44, gfx: null, _spawnedAt: state.t,
      _deathBurst: true,
      _arcHeight: 16 + Math.random() * 10,
      _arcSide: Math.random() < 0.5 ? -1 : 1
    };
    if (killerOwner != null && killerOwner !== undefined) {
      r._targetCity = killerOwner;
      r._interceptProtectUntil = state.t + 1.5;
    }
    if (opts.visualOnly) r._visualOnly = true;
    state.res.set(id, r);
    makeResVisual(r);
  }

  const UNIT_XP_DROPS = { fighter: 1, destroyer: 8, cruiser: 25, battleship: 50, hyperDestroyer: 100 };

  const UNIT_CREDIT_DROPS = { fighter: 5, destroyer: 50, cruiser: 150, battleship: 400, hyperDestroyer: 800 };

  const UNIT_KILL_ENERGY_BONUSES = {
    fighter: { amount: 0.1 * 60, durationSec: 10, label: "+0.1/с 10с" },
    destroyer: { amount: 0.5 * 60, durationSec: 15, label: "+0.5/с 15с" },
    cruiser: { amount: 1 * 60, durationSec: 25, label: "+1/с 25с" },
    battleship: { amount: 4 * 60, durationSec: 60, label: "+4/с 60с" },
    hyperDestroyer: { amount: 10 * 60, durationSec: 120, label: "+10/с 120с" }
  };

  const CORE_DESTROY_ENERGY_REWARD = {
    instantAmount: 200,
    amount: 25 * 60,
    durationSec: 30 * 60,
    label: "+25/с 30м"
  };

  function getActiveGrowthBonusPerMin(player) {
    if (!player) return 0;
    if (player._growthBonuses) player._growthBonuses = player._growthBonuses.filter((bonus) => bonus.expiresAt > state.t);
    return (player._growthBonuses || []).reduce((sum, bonus) => sum + (bonus.amount || 0), 0);
  }

  sharedCitySimApi = (typeof window !== "undefined" && window.SharedCitySim && typeof window.SharedCitySim.install === "function")
    ? window.SharedCitySim.install({
        state,
        CFG,
        fbm,
        clamp,
        isPointInPolygon,
        polygonArea,
        getPlanetRadius,
        shieldRadius,
        xpNeed,
        getActiveGrowthBonusPerMin,
        getMapSeed: () => mapSeed
      })
    : null;

  function addTimedGrowthBonus(player, amountPerMin, durationSec) {
    if (!player || !amountPerMin || !durationSec) return;
    if (!player._growthBonuses) player._growthBonuses = [];
    player._growthBonuses.push({ amount: amountPerMin, expiresAt: state.t + toSimSeconds(durationSec) });
  }

  function killUnit(u, reason = "dead", killerOwner) {
    if (typeof playExplosionSound === "function") playExplosionSound(u.x, u.y);
    state._deathBursts = Array.isArray(state._deathBursts) ? state._deathBursts : [];
    const unitColor = u.color != null
      ? u.color
      : (state.players.get(u.owner)?.color ?? colorForId(u.owner || 0));
    state._deathBursts.push({
      x: u.x,
      y: u.y,
      t0: state.t,
      duration: 0.42 + (UNIT_TYPES[u.unitType]?.sizeMultiplier || 1) * 0.06,
      maxRadius: 16 + (UNIT_TYPES[u.unitType]?.sizeMultiplier || 1) * 18,
      color: unitColor
    });
    if (state._deathBursts.length > 40) state._deathBursts.splice(0, state._deathBursts.length - 40);
    const baseXP = UNIT_XP_DROPS[u.unitType] || 1;
    const xpDrop = Math.max(1, Math.round(baseXP * (0.8 + Math.random() * 0.4)));
    const isPirateKill = killerOwner === PIRATE_OWNER_ID || (killerOwner != null && !state.players.has(killerOwner));
    const rewardTarget = !isPirateKill && killerOwner != null && state.players.has(killerOwner) ? killerOwner : null;
    const creditDrop = UNIT_CREDIT_DROPS[u.unitType] || 3;
    const creditVal = creditDrop > 0 ? Math.max(1, Math.round(creditDrop * (0.6 + Math.random() * 0.8))) : 0;
    if (rewardTarget != null) {
      const killer = state.players.get(rewardTarget);
      if (killer) gainXP(killer, xpDrop);
    }
    if (rewardTarget != null) {
      const killer = state.players.get(rewardTarget);
      if (killer && creditVal > 0) killer.eCredits = (killer.eCredits || 0) + creditVal;
      queueKillRewardPulse(rewardTarget, u.x, u.y, xpDrop, creditVal);
    }

    const p = state.players.get(u.owner);
    if (p) {
      const penalty = u.popPenalty || 1;
      p.popFloat = Math.max(0, p.popFloat - penalty);
      p.pop = Math.floor(p.popFloat);
      p.deadUnits++;
    }
    if (rewardTarget != null && rewardTarget !== u.owner) {
      const kp = state.players.get(rewardTarget);
      const reward = UNIT_KILL_ENERGY_BONUSES[u.unitType];
      if (kp && reward) {
        addTimedGrowthBonus(kp, reward.amount, reward.durationSec);
        state.floatingDamage.push({
          x: u.x,
          y: u.y - 34,
          text: reward.label,
          color: 0x7fe7ff,
          ttl: 1.8
        });
      }
    }

    const myId = u.id;
    const isLeader = u.leaderId === null || u.leaderId === undefined;
    const FORMATION_REBUILD_DELAY = 2.5;

    if (typeof SQUADLOGIC !== "undefined" && u.squadId != null) {
      const squadId = u.squadId;
      destroyUnitVisual(u);
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

    destroyUnitVisual(u);
    state.units.delete(u.id);
  }

  // ------------------------------------------------------------
  // Combat (all ranged, multi-target)
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
    const lvlMul = getRangeLevelMul(p);
    const baseRange = u.baseAttackRange || u.attackRange || 40;
    return baseRange * Math.min(UNIT_ATK_RANGE_MAX_MUL, baseMul) * lvlMul;
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
    const baseSpeed = u.baseSpeed || u.speed || UNIT_TYPES[u.unitType || "fighter"]?.speed || 9;
    return baseSpeed * 1.1 * Math.max(0.5, 1 - classIdx * 0.06);
  }

  function getUnitDmg(u) {
    const p = state.players.get(u.owner);
    const baseDmg = u.baseDamage || u.dmg || 1;
    const dmgMul = (p && p.unitDmgMul != null ? p.unitDmgMul : 1) * getLevelBonusMul(p);
    return Math.max(1, Math.round(baseDmg * dmgMul));
  }

  function getUnitAtkRate(u) {
    const type = UNIT_TYPES[u.unitType] || UNIT_TYPES.fighter;
    const p = state.players.get(u.owner);
    const rateMul = (p && p.unitAtkRateMul != null ? p.unitAtkRateMul : 1);
    const baseAttackRate = u.baseAttackRate || type.attackRate;
    let rate = baseAttackRate * rateMul * getLevelBonusMul(p);
    if (u._cryoSlowUntil && state.t < u._cryoSlowUntil) rate *= (1 - (u._cryoSlowAmount ?? CFG.CRYO_SLOW ?? 0.4));
    if (u._atkReductionUntil && state.t < u._atkReductionUntil) rate *= (1 - (u._atkReductionAmount ?? 0.25));
    return rate;
  }

  function stepCombat(dt) {
    const bulletsFull = state.bullets.length >= MAX_BULLETS;

    for (const u of state.units.values()) {
      if (u._anchorStasisUntil && state.t < u._anchorStasisUntil) {
        u.vx = 0;
        u.vy = 0;
        u.atkCd = Math.max(u.atkCd || 0, 0.12);
        continue;
      }
      if (u._fireDotUntil && state.t < u._fireDotUntil) {
        const fireDmg = (u._fireDotDps || CFG.FIRE_DOT_DPS) * dt;
        applyUnitDamage(u, fireDmg, u._fireDotOwner);
        if (u.hp <= 0) { u.lastDamagedBy = u._fireDotOwner; continue; }
      }
      if (u._cryoSlowUntil && state.t > u._cryoSlowUntil) u._cryoSlowUntil = 0;
      if (u._atkReductionUntil && state.t > u._atkReductionUntil) {
        u._atkReductionUntil = 0;
        u._atkReductionAmount = 0;
      }
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
        ? SQUADLOGIC.getUnitFirePlan(u, state, { getUnitAtkRange, getPlanetRadius, shieldRadius, getCoreCollisionRadius })
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
          const dmg = Math.max(1, Math.round(getUnitDmg(u)));
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

      if (hitTargets.size === 0 && u.owner !== PIRATE_OWNER_ID) {
        const pb = getNearestAlivePirateBase(u.x, u.y, Math.sqrt(atkRange2));
        if (pb) {
          u.atkCd = 1 / getUnitAtkRate(u);
          const dmg = getUnitDmg(u);
          if (typeof playLaserSound === "function") playLaserSound(u.x, u.y, pb.x, pb.y);
          state.bullets.push({
            type: "laser", fromX: u.x, fromY: u.y,
            toX: pb.x, toY: pb.y,
            color: p ? p.color : 0xaa44ff,
            ownerId: u.owner, dmg,
            duration: 0.6, progress: 0,
            targetId: pb.id, targetType: "pirateBase",
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
      if (p.eliminated) continue;
      if (p.pop <= 0) {
        if (p._lastCityAttacker != null) {
          const killer = state.players.get(p._lastCityAttacker);
          if (killer && killer.pop > 0) {
            killer.popFloat += CORE_DESTROY_ENERGY_REWARD.instantAmount;
            killer.pop = Math.floor(killer.popFloat);
            addTimedGrowthBonus(killer, CORE_DESTROY_ENERGY_REWARD.amount, CORE_DESTROY_ENERGY_REWARD.durationSec);
            state.floatingDamage.push({
              x: killer.x,
              y: killer.y - 40,
              text: "+200 энергии, " + CORE_DESTROY_ENERGY_REWARD.label,
              color: 0xffd700,
              ttl: 3.0
            });
          }
        }
        destroyCity(p, p._lastCityAttacker);
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

  function getPirateBaseAttackRange(pb) {
    return Math.max(80, pb && pb.attackRange != null ? pb.attackRange : PIRATE_BASE_ATTACK_RANGE);
  }

  function getPirateBaseShotDamage(target) {
    const unitCfg = UNIT_TYPES[target && target.unitType] || UNIT_TYPES.fighter;
    const maxHp = Math.max(1, target && (target.maxHp || target.baseMaxHp || target.hp) || unitCfg.hp || 1);
    return Math.max(1, Math.round(PIRATE_BASE_ATTACK_FLAT_DMG + maxHp * PIRATE_BASE_ATTACK_MAX_HP_PCT));
  }

  function handlePirateBaseDestroyed(pb) {
    if (!pb) return;
    const killerId = pb.lastDamagedBy;
    const killer = killerId != null ? state.players.get(killerId) : null;
    if (killer) {
      let grantedDrops = 0;
      for (let L = 0; L < 3; L++) {
        killer.level = (killer.level || 1) + 1;
        killer._levelBonusMul = 1 + (killer.level || 1) * 0.01;
        killer.xpNext = xpNeed(killer.level, killer);
        grantedDrops += grantLevelCardDrops(killer, "pirateBaseLevel");
      }
      killer.eCredits = (killer.eCredits || 0) + 2000;
      killer.popFloat = (killer.popFloat || killer.pop || 0) + 150;
      killer.pop = Math.floor(killer.popFloat);
      if (grantedDrops > 0 && state.botPlayerIds && state.botPlayerIds.has(killer.id)) autoPlayBotCardHands(killer);
      state.floatingDamage.push({ x: killer.x, y: killer.y - 54, text: "+3 ур.", color: 0xffdd00, ttl: 2.8 });
      state.floatingDamage.push({ x: killer.x, y: killer.y - 30, text: "+2000€  +150 энергии", color: 0xffd98c, ttl: 3.0 });
    }
    for (const m of state.mines.values()) {
      if (!m.isRich) continue;
      m.ownerId = null;
      m.captureProgress = 0;
      m._capturingOwner = null;
      m._captureProtectedUntil = 0;
      m._pirateLocked = false;
      m._richYieldMultiplier = 3;
      updateMineVisual(m);
      break;
    }
    removePirateBaseVisual(pb);
    const remaining = getPirateBases().filter((entry) => entry && entry.id !== pb.id);
    setPirateBases(remaining);
  }

  function stepPirateBaseDefense(dt) {
    for (const pb of getAlivePirateBases()) {
      pb.atkCd = Math.max(0, (pb.atkCd || 0) - dt);
      if (pb.atkCd > 0) continue;

      const range = getPirateBaseAttackRange(pb);
      const range2 = range * range;
      const nearby = queryHash(pb.x, pb.y, range);
      const candidates = [];
      for (let i = 0; i < nearby.length; i++) {
        const u = nearby[i];
        if (!u || u.hp <= 0 || u.owner === PIRATE_OWNER_ID) continue;
        const d = (u.x - pb.x) ** 2 + (u.y - pb.y) ** 2;
        if (d <= range2) candidates.push({ target: u, d });
      }
      if (!candidates.length) continue;

      candidates.sort((a, b) => a.d - b.d);
      const shotCount = Math.min(PIRATE_BASE_ATTACK_TARGETS, candidates.length);
      const sideOffsets = shotCount >= 4
        ? [-1.8, -0.6, 0.6, 1.8]
        : shotCount === 3
          ? [-1.1, 0, 1.1]
          : shotCount === 2
            ? [-0.9, 0.9]
            : [0];
      pb.atkCd = PIRATE_BASE_ATTACK_COOLDOWN;
      pb._lastShotAt = state.t;

      for (let i = 0; i < shotCount; i++) {
        const target = candidates[i].target;
        const aim = Math.atan2(target.y - pb.y, target.x - pb.x);
        const side = sideOffsets[i] || 0;
        const muzzleForward = 28;
        const muzzleSide = 16 * side;
        const fromX = pb.x + Math.cos(aim) * muzzleForward - Math.sin(aim) * muzzleSide;
        const fromY = pb.y + Math.sin(aim) * muzzleForward + Math.cos(aim) * muzzleSide;
        const dmg = getPirateBaseShotDamage(target);
        if (typeof playLaserSound === "function") playLaserSound(fromX, fromY, target.x, target.y);
        state.bullets.push({
          type: "laser",
          fromX,
          fromY,
          toX: target.x,
          toY: target.y,
          color: PIRATE_BASE_ATTACK_COLOR,
          ownerId: PIRATE_OWNER_ID,
          dmg,
          duration: 0.42,
          progress: 0,
          targetId: target.id,
          targetType: "unit"
        });
      }
    }
  }

  function stepCityDefense(dt) {
    // Planet core no longer auto-fires. Defensive ranged combat now belongs to orbiting turrets.
    for (const p of state.players.values()) p.cityAtkCd = 0;
    stepPirateBaseDefense(dt);
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
          const pb = getPirateBaseById(b.targetId);
          if (!pb || pb.hp <= 0) { state.bullets.splice(i, 1); continue; }
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
            const pb = getPirateBaseById(b.targetId);
            if (pb && pb.hp > 0) {
              pb.hp = Math.max(0, pb.hp - b.dmg);
              pb.lastDamagedBy = b.ownerId;
              pb._lastAttackedAt = state.t;
              pb._attackerX = b.fromX ?? pb.x;
              pb._attackerY = b.fromY ?? pb.y;
              state.floatingDamage.push({ x: pb.x, y: pb.y - 30, text: "-" + b.dmg, color: b.color ?? 0xaa44ff, ttl: 0.9 });
              if (pb.hp <= 0) handlePirateBaseDestroyed(pb);
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
    const isRemote = !!(state._multiSlots && !state._multiIsHost);
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
        if (isRemote && !b._soundPlayed && (b.progress || 0) < 0.1) {
          b._soundPlayed = true;
          if (typeof playLaserSound === "function") playLaserSound(b.fromX || 0, b.fromY || 0, b.toX || 0, b.toY || 0);
        }
        b.progress = (b.progress || 0) + dt / (b.duration || 0.2);
        if (b.progress >= 1) {
          if (isRemote && b.targetType === "unit" && b.targetId != null) {
            const target = state.units.get(b.targetId);
            if (target) {
              target._hitFlashT = state.t;
              state.floatingDamage.push({ x: target.x, y: target.y - 22, text: "-" + (b.dmg || 0), color: b.color ?? 0xaa44ff, ttl: 1.0 });
            }
          } else if (isRemote && b.targetType === "turret" && b.targetId != null) {
            const t = state.turrets.get(b.targetId);
            if (t) state.floatingDamage.push({ x: t.x, y: t.y - 18, text: "-" + (b.dmg || 0), color: 0xaa44ff, ttl: 1.0 });
          } else if (isRemote && b.targetType === "pirateBase") {
            const pb = state.pirateBase;
            if (pb) state.floatingDamage.push({ x: pb.x, y: pb.y - 30, text: "-" + (b.dmg || 0), color: 0xaa44ff, ttl: 0.9 });
          }
          state.bullets.splice(i, 1);
        }
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
    const now = performance.now();
    const zoom = cam.zoom || CFG.CAMERA_START_ZOOM || 0.22;
    if (zoom < 0.34) return;
    const nearOnly = zoom < 0.52;
    for (let i = 0; i < state.bullets.length; i++) {
      const b = state.bullets[i];
      const bx = b.x || b.fromX || 0;
      const by = b.y || b.fromY || 0;
      if (!inView(bx, by)) continue;
      if (nearOnly && !isNearCamera(bx, by)) continue;
      if (!LOD.canDraw("bullets")) break;
      CombatVFX.drawBullet(g, b, zoom, now);
    }
  }

  let _deathBurstGfx = null;
  function drawDeathBursts() {
    if (!_deathBurstGfx || _deathBurstGfx.destroyed) {
      _deathBurstGfx = new PIXI.Graphics();
      bulletsLayer.addChild(_deathBurstGfx);
    }
    _deathBurstGfx.clear();
    if (!state._deathBursts || state._deathBursts.length === 0) return;
    for (let i = state._deathBursts.length - 1; i >= 0; i--) {
      const burst = state._deathBursts[i];
      const elapsed = state.t - burst.t0;
      if (elapsed > burst.duration) {
        state._deathBursts.splice(i, 1);
        continue;
      }
      if (!inView(burst.x, burst.y)) continue;
      const t = elapsed / burst.duration;
      const radius = burst.maxRadius * t;
      const alpha = Math.max(0, 1 - t);
      const r = (burst.color >> 16) & 0xff;
      const g = (burst.color >> 8) & 0xff;
      const b2 = burst.color & 0xff;
      const bright = ((Math.min(255, r + 80) << 16) | (Math.min(255, g + 80) << 8) | Math.min(255, b2 + 80));
      _deathBurstGfx.lineStyle(2, bright, alpha * 0.9);
      _deathBurstGfx.beginFill(burst.color, alpha * 0.3);
      _deathBurstGfx.drawCircle(burst.x, burst.y, radius);
      _deathBurstGfx.endFill();
      _deathBurstGfx.lineStyle(1, 0xffffff, alpha * 0.6);
      _deathBurstGfx.drawCircle(burst.x, burst.y, radius * 0.5);
      const rayCount = 5;
      for (let ray = 0; ray < rayCount; ray++) {
        const angle = (Math.PI * 2 * ray) / rayCount + t * 4.2;
        const inner = radius * 0.28;
        const outer = radius * (0.95 + 0.18 * Math.sin(t * 8 + ray));
        _deathBurstGfx.lineStyle(1.35, bright, alpha * 0.55);
        _deathBurstGfx.moveTo(burst.x + Math.cos(angle) * inner, burst.y + Math.sin(angle) * inner);
        _deathBurstGfx.lineTo(burst.x + Math.cos(angle) * outer, burst.y + Math.sin(angle) * outer);
      }
    }
  }

  function resolveCityEliminationOwnerId(city, killerOwnerId) {
    if (!city) return null;
    const candidateIds = [killerOwnerId, city._lastCityAttacker, city.lastDamagedBy];
    for (const candidateId of candidateIds) {
      if (candidateId == null || candidateId === city.id) continue;
      const candidate = state.players.get(candidateId);
      if (candidate && !candidate.eliminated) return candidate.id;
    }

    let nearestOwnerId = null;
    let nearestDist = Infinity;
    for (const u of state.units.values()) {
      if (!u || u.hp <= 0 || u.owner === city.id) continue;
      const owner = state.players.get(u.owner);
      if (!owner || owner.eliminated) continue;
      const dist = Math.hypot((u.x || 0) - city.x, (u.y || 0) - city.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestOwnerId = owner.id;
      }
    }
    if (nearestOwnerId != null) return nearestOwnerId;

    for (const other of state.players.values()) {
      if (!other || other.id === city.id || other.eliminated) continue;
      const dist = Math.hypot((other.x || 0) - city.x, (other.y || 0) - city.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestOwnerId = other.id;
      }
    }
    return nearestOwnerId;
  }

  function destroyCity(p, killerOwnerId) {
    if (!p || p.eliminated) return;
    const resolvedKillerOwnerId = resolveCityEliminationOwnerId(p, killerOwnerId);
    if (p._orbitalRings) { cityLayer.removeChild(p._orbitalRings); p._orbitalRings = null; }
    if (p.cityGfx) cityLayer.removeChild(p.cityGfx);
    if (p.label) cityLayer.removeChild(p.label);
    if (p.popLabel) cityLayer.removeChild(p.popLabel);
    if (p.shieldGfx) { cityLayer.removeChild(p.shieldGfx); p.shieldGfx = null; }
    if (p.zoneGfx) zonesLayer.removeChild(p.zoneGfx);
    if (p.zoneGlow) zonesLayer.removeChild(p.zoneGlow);
    if (p.zoneShellGfx) zonesLayer.removeChild(p.zoneShellGfx);

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

    for (const mine of state.mines.values()) {
      if (!mine || mine.ownerId !== p.id) continue;
      setMineOwnerInstantly(mine, resolvedKillerOwnerId);
    }

    for (const u of [...state.units.values()]) {
      if (u.owner === p.id) {
        destroyUnitVisual(u);
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
    p.cityGfx = null;
    p.label = null;
    p.popLabel = null;
    p.shieldGfx = null;
    p.zoneGfx = null;
    p.zoneGlow = null;
    p.zoneShellGfx = null;
    p.zoneLightGfx = null;
    p._patrolSpriteLayer = null;
    p._patrolSprites = [];
    p.pop = 0;
    p.popFloat = 0;
    p.shieldHp = 0;
    p.shieldMaxHp = 0;
    p.eliminated = true;
    p.lastDamagedBy = resolvedKillerOwnerId ?? null;
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

  function createUnitMotionContext(u, dt, useSquadLogic) {
    if (u.leaderId && !state.units.get(u.leaderId)) u.leaderId = null;
    const leader = u.leaderId ? state.units.get(u.leaderId) : null;

    const zoneOwner = getZoneOwnerFast(u.x, u.y);
    u._territoryMul = zoneOwner === u.owner ? 1.1 : (zoneOwner !== 0 && zoneOwner !== u.owner ? 0.9 : 1);

    const terrainSpd = getTerrainSpeedMultiplier(u.x, u.y);
    const owner = state.players.get(u.owner);
    let unitSpeedMul = (owner && owner.unitSpeedMul != null ? owner.unitSpeedMul : 1) * getLevelBonusMul(owner);
    if (owner && state._battleMarchUntil && state._battleMarchUntil[owner.id] > state.t) unitSpeedMul *= 1.3;

    const classOrder = ["fighter", "destroyer", "cruiser", "battleship", "hyperDestroyer"];
    const classIdx = classOrder.indexOf(u.unitType || "fighter");
    const individualSpeed = (u.speed || UNIT_TYPES[u.unitType || "fighter"]?.speed || 9) * 1.1 * Math.max(0.5, 1 - classIdx * 0.06);
    const baseSpeed = (useSquadLogic && u.squadId != null)
      ? (SQUADLOGIC.getSquadSpeed(state, u.squadId) || individualSpeed)
      : individualSpeed;

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
    const blackHolePullActive = !!(u._blackHolePullUntil && state.t < u._blackHolePullUntil);
    const moveIndividualPerSec = individualSpeed * speedMuls;
    const blackHolePullSpeed = blackHolePullActive ? Math.max(0, (u._blackHolePullSpeed || 0)) : 0;
    return {
      leader,
      individualSpeed,
      speed,
      moveIndividualPerSec,
      maxMove: speed * dt,
      maxMoveIndividual: moveIndividualPerSec * dt,
      blackHolePullActive,
      blackHolePullSpeed,
      blackHolePullStep: blackHolePullSpeed * dt
    };
  }

  function getCachedUnitMotionContext(u, dt, useSquadLogic, refresh) {
    if (refresh || !u._cachedMotionCtx) {
      u._cachedMotionCtx = createUnitMotionContext(u, dt, useSquadLogic);
      return u._cachedMotionCtx;
    }
    const ctx = u._cachedMotionCtx;
    ctx.maxMove = (ctx.speed || 0) * dt;
    ctx.maxMoveIndividual = (ctx.moveIndividualPerSec || ctx.speed || 0) * dt;
    ctx.blackHolePullStep = ctx.blackHolePullActive ? Math.max(0, (ctx.blackHolePullSpeed || 0) * dt) : 0;
    return ctx;
  }

  function resolveAuthoritativeMovementTarget(u, desired) {
    if (typeof SQUADLOGIC === "undefined") return;
    const combatHelpers = {
      getUnitAtkRange,
      getUnitEngagementRange,
      getUnitBaseSpeed,
      shieldRadius,
      getPlanetRadius,
      getUnitHitRadius
    };
    const movement = SQUADLOGIC.getUnitMovementTarget(u, state, combatHelpers);
    if (movement) {
      desired.tx = movement.tx;
      desired.ty = movement.ty;
      desired.moveMode = movement.moveMode || "formation_move";
    }
    if (u.owner !== PIRATE_OWNER_ID) {
      const pb = getNearestAlivePirateBase(u.x, u.y);
      if (!pb) return;
      const pbDist = Math.hypot(u.x - pb.x, u.y - pb.y);
      const atkR = getUnitAtkRange(u);
      if (pbDist < atkR * 1.5 && desired.moveMode !== "stop") {
        const sq = u.squadId != null ? state.squads?.get(u.squadId) : null;
        if (sq) {
          const sqUnits = SQUADLOGIC.getSquadUnits(state, sq);
          const ui = sqUnits.indexOf(u);
          if (ui >= 0) {
            const angle = (ui / Math.max(1, sqUnits.length)) * Math.PI * 2;
            desired.tx = pb.x + Math.cos(angle) * atkR * 0.85;
            desired.ty = pb.y + Math.sin(angle) * atkR * 0.85;
            desired.moveMode = "squad_anchor";
          }
        }
      }
    }
  }

  function resolveLegacyMovementTarget(u, desired) {
    if (desired.moveMode !== "stop") return;
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
            wtx += lox;
            wty += loy;
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
                nx += lox2;
                ny += loy2;
              } else {
                const fcos2 = Math.cos(fdelta2), fsin2 = Math.sin(fdelta2);
                nx += lox2 * fcos2 - loy2 * fsin2;
                ny += lox2 * fsin2 + loy2 * fcos2;
              }
            }
          }
          desired.tx = nx;
          desired.ty = ny;
          desired.moveMode = "waypoint";
        }
      } else {
        desired.tx = wtx;
        desired.ty = wty;
        desired.moveMode = "waypoint";
      }
    } else if (u.straightMode && (u.vx || u.vy)) {
      desired.tx = u.x + u.vx * 100;
      desired.ty = u.y + u.vy * 100;
      desired.moveMode = "straight";
    }
  }

  function resolveDesiredMovementTarget(u, motionCtx) {
    const desired = { tx: u.x, ty: u.y, moveMode: "stop" };
    if (motionCtx && typeof SQUADLOGIC !== "undefined" && SQUADLOGIC.getUnitMovementTarget) {
      resolveAuthoritativeMovementTarget(u, desired);
    }
    resolveLegacyMovementTarget(u, desired);
    if (motionCtx.blackHolePullActive) {
      desired.tx = u._blackHolePullX != null ? u._blackHolePullX : desired.tx;
      desired.ty = u._blackHolePullY != null ? u._blackHolePullY : desired.ty;
      desired.moveMode = "blackhole_pull";
    }
    return desired;
  }

  function applyHeadingAndMovement(u, desired, motionCtx, dt) {
    let dx = desired.tx - u.x;
    let dy = desired.ty - u.y;
    let dist = Math.hypot(dx, dy);
    const TURN_RATE = getUnitTurnRate(u.unitType || "fighter") * (u.leaderId ? 0.94 : 1.08);

    if (desired.moveMode === "free_chase" && dist > 1) {
      const atkR = getUnitAtkRange(u) * 0.85;
      if (dist <= atkR) {
        desired.moveMode = "stop";
        const faceAngle = Math.atan2(dy, dx);
        u._lastFacingAngle = faceAngle;
        u.vx = Math.cos(faceAngle);
        u.vy = Math.sin(faceAngle);
      }
    }

    if (dist < 2 && desired.moveMode !== "stop") {
      u.vx = motionCtx.leader?.vx || 0;
      u.vy = motionCtx.leader?.vy || 0;
      return;
    }
    if (dist <= 0.5 || desired.moveMode === "stop") return;

    const desiredAngle = Math.atan2(dy, dx);
    let curFacing = u._lastFacingAngle ?? desiredAngle;
    let angleDiff = desiredAngle - curFacing;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const turnStep = TURN_RATE * dt;
    if (Math.abs(angleDiff) > turnStep) curFacing += Math.sign(angleDiff) * turnStep;
    else curFacing = desiredAngle;

    u._lastFacingAngle = curFacing;
    const dirX = Math.cos(curFacing), dirY = Math.sin(curFacing);
    const moveScale = getForwardTurnMoveScale(angleDiff);
    const isFreeChase = desired.moveMode === "free_chase";
    const isBlackHolePull = desired.moveMode === "blackhole_pull";
    const effectiveMax = isBlackHolePull
      ? motionCtx.blackHolePullStep
      : (isFreeChase ? motionCtx.maxMoveIndividual : motionCtx.maxMove);
    const decel = (!isFreeChase && !isBlackHolePull && dist < 20) ? (dist / 20) : 1;
    const moveDist = Math.min(effectiveMax * decel * moveScale, dist);
    if (moveDist > 0.01) {
      u.x += Math.cos(curFacing) * moveDist;
      u.y += Math.sin(curFacing) * moveDist;
    }
    const spd = dt > 0 ? moveDist / dt : 0;
    u.vx = dirX * spd;
    u.vy = dirY * spd;
  }

  function applyFriendlySeparation(u) {
    const uType = UNIT_TYPES[u.unitType] || UNIT_TYPES.fighter;
    const uSize = (uType.sizeMultiplier || 1) * 6 + 8;
    const searchR = uSize + 40;
    const neighbors = queryHash(u.x, u.y, searchR);
    let sx = 0;
    let sy = 0;
    for (let ni = 0; ni < neighbors.length; ni++) {
      const v = neighbors[ni];
      if (v.id === u.id) continue;
      if (v.owner !== u.owner) continue;
      if (u.squadId != null && v.squadId != null && u.squadId === v.squadId) continue;
      const vType = UNIT_TYPES[v.unitType] || UNIT_TYPES.fighter;
      const vSize = (vType.sizeMultiplier || 1) * 6 + 8;
      const minDist = Math.max(MIN_PERSONAL_DIST, (uSize + vSize) * 0.55);
      const sdx = u.x - v.x;
      const sdy = u.y - v.y;
      const sDist = Math.hypot(sdx, sdy);
      if (sDist < minDist && sDist > 0.1) {
        const push = ((minDist - sDist) / minDist) * SEPARATION_PUSH;
        sx += (sdx / sDist) * push;
        sy += (sdy / sDist) * push;
      }
    }
    const sl = Math.hypot(sx, sy);
    if (sl > 2.0) {
      sx *= 2.0 / sl;
      sy *= 2.0 / sl;
    }
    u.x += sx;
    u.y += sy;
  }

  function applyCombatZoneBoundary(u, motionCtx) {
    if (!motionCtx || typeof SQUADLOGIC === "undefined") return;
    const sq = getAuthoritativeSquadStateForUnit(u);
    if (!isAuthoritativeSquadInCombat(sq) || sq.combat.zoneId == null) return;
    const zone = state.engagementZones.get(sq.combat.zoneId);
    const steer = SQUADLOGIC.getZoneBoundarySteer(u.x, u.y, zone);
    if (!steer) return;
    const push = steer.strength * motionCtx.maxMove * 0.8;
    u.x += steer.sx * push;
    u.y += steer.sy * push;
  }

  function applyObstaclePushes(u) {
    for (const cp of state.players.values()) {
      if (cp.eliminated) continue;
      const noFlyR = Math.max(shieldRadius(cp), getCoreCollisionRadius(cp));
      const dToCity = Math.hypot(u.x - cp.x, u.y - cp.y);
      if (dToCity > 0 && dToCity < noFlyR) {
        const scale = noFlyR / dToCity;
        u.x = cp.x + (u.x - cp.x) * scale;
        u.y = cp.y + (u.y - cp.y) * scale;
      }
    }
  }

  function applyEnemyCollision(u, dt) {
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
      if (!isUnitInAuthoritativeCombat(u)) {
        if (typeof SQUADLOGIC !== "undefined" && SQUADLOGIC.recordDamageSource) {
          SQUADLOGIC.recordDamageSource(u, v.id, state);
        } else {
          u._lastDamagedByUnitId = v.id;
          u._lastDamagedAt = state.t;
        }
      }
    }
  }

  function applyFinalWorldClamp(u) {
    const inPirateHyper = u._pirateHyperUntil && state.t < u._pirateHyperUntil;
    if (inPirateHyper) {
      u.x = clamp(u.x, -500, CFG.WORLD_W + 500);
      u.y = clamp(u.y, -500, CFG.WORLD_H + 500);
    } else {
      u.x = clamp(u.x, 0, CFG.WORLD_W);
      u.y = clamp(u.y, 0, CFG.WORLD_H);
    }
  }

  function applyFrontLaneClamp(u) {
    if (typeof SQUADLOGIC === "undefined" || !SQUADLOGIC.getLaneClampForUnit) return;
    const clampPoint = SQUADLOGIC.getLaneClampForUnit(u, state, 12);
    if (!clampPoint) return;
    u.x = clampPoint.x;
    u.y = clampPoint.y;
  }

  function isUnitCombatHot(u) {
    const cs = u && u._combatState;
    return !!(u && (u._engagementZoneId != null || cs === "acquire" || cs === "chase" || cs === "attack" || cs === "siege"));
  }

  function getUnitPerfProfile(u, visible) {
    const unitCount = state.units ? state.units.size : 0;
    const hovered = !!(state._hoverTarget && state._hoverTarget.id === u.id);
    const selected = state.selectedUnitIds ? state.selectedUnitIds.has(u.id) : false;
    const hot = visible || hovered || selected || isUnitCombatHot(u);
    if (unitCount < 260) return { desiredEvery: 1, motionEvery: 1, neighborEvery: 1, obstacleEvery: 1, trailLimit: 16, hot };
    if (hot) return { desiredEvery: 1, motionEvery: 1, neighborEvery: 1, obstacleEvery: 1, trailLimit: unitCount >= 520 ? 8 : 12, hot };
    return {
      desiredEvery: unitCount >= 520 ? 4 : (unitCount >= 380 ? 3 : 2),
      motionEvery: unitCount >= 520 ? 4 : (unitCount >= 380 ? 3 : 2),
      neighborEvery: unitCount >= 520 ? 6 : (unitCount >= 380 ? 4 : 3),
      obstacleEvery: unitCount >= 520 ? 6 : (unitCount >= 380 ? 4 : 3),
      trailLimit: unitCount >= 520 ? 5 : 8,
      hot
    };
  }

  function stepUnits(dt) {
    const useSquadLogic = typeof SQUADLOGIC !== "undefined" && SQUADLOGIC.getUnitMovementTarget;
    // ═══════════════════════════════════════════════════════════════════
    // UNIFIED MOVEMENT PIPELINE v2 — position-based, no force chains
    // Each unit resolves to a single target (tx,ty) then moves toward it
    // ═══════════════════════════════════════════════════════════════════
    for (const u of state.units.values()) {
      if (u._anchorStasisUntil && state.t < u._anchorStasisUntil) {
        u.vx = 0;
        u.vy = 0;
        if (u.gfx) u.gfx.visible = inView(u.x, u.y);
        continue;
      }
      const vis = inView(u.x, u.y);
      if (!u.gfx) makeUnitVisual(u);
      if (u.gfx) syncUnitShipVisualMode(u);
      const perf = getUnitPerfProfile(u, vis);
      const cadenceSeed = (state._frameCtr || 0) + u.id;
      const refreshDesired = perf.desiredEvery <= 1 || (cadenceSeed % perf.desiredEvery) === 0 || !u._cachedDesiredMovement;
      const refreshMotionCtx = perf.motionEvery <= 1 || (cadenceSeed % perf.motionEvery) === 0 || !u._cachedMotionCtx;
      const runNeighborOps = perf.neighborEvery <= 1 || (cadenceSeed % perf.neighborEvery) === 0 || perf.hot;
      const runObstacleOps = perf.obstacleEvery <= 1 || (cadenceSeed % perf.obstacleEvery) === 0 || perf.hot;
      const motionCtx = getCachedUnitMotionContext(u, dt, useSquadLogic, refreshMotionCtx);

      // 1. resolve desired movement target
      const desired = refreshDesired
        ? resolveDesiredMovementTarget(u, motionCtx)
        : (u._cachedDesiredMovement || { tx: u.x, ty: u.y, moveMode: "stop" });
      if (refreshDesired) {
        u._cachedDesiredMovement = { tx: desired.tx, ty: desired.ty, moveMode: desired.moveMode };
      }

      // 2. turning / heading
      // 3. formation movement / forward step toward target
      applyHeadingAndMovement(u, desired, motionCtx, dt);

      // 4. friendly separation
      if (runNeighborOps) applyFriendlySeparation(u);

      // 5. boundary constraints
      if (perf.hot || runNeighborOps) applyCombatZoneBoundary(u, motionCtx);

      // 6. obstacle push / shield push / mine push
      if (runObstacleOps) applyObstaclePushes(u);

      // 7. enemy collision
      if (runNeighborOps) applyEnemyCollision(u, dt);

      // 8. hard lane clamp for flank fronts after all pushes
      applyFrontLaneClamp(u);

      // 9. final clamp
      applyFinalWorldClamp(u);

      if (u.gfx) {
        u.gfx.visible = vis;
        if (vis) {
          const spd = Math.hypot(u.vx || 0, u.vy || 0);
          const shipDetail = getAdaptiveShipVisualDetail();
          const shipLodLevel = getAdaptiveShipLodLevel();
          if (u._lastShipLodLevel !== shipLodLevel) {
            u._lastShipLodLevel = shipLodLevel;
            syncUnitShipFilters(u, shipDetail);
          }
          updateUnitTrailHistory(u, spd, perf.trailLimit, (state._frameCtr + u.id));
          const vfc = state._frameCtr;
          const sel = state.selectedUnitIds.has(u.id);
          const flashing = u._hitFlashT != null && (state.t - u._hitFlashT) < 0.3;
          const hovered = state._hoverTarget && state._hoverTarget.id === u.id;
          const stateChanged = (u._lastSelected !== sel || u._lastFlash !== flashing || u._lastHovered !== hovered);
          const redrawInterval = getShipVisualRedrawInterval(sel, hovered, flashing);
          const needRedraw = stateChanged || (vfc + u.id) % redrawInterval === 0;
          if (needRedraw) {
            u._lastSelected = sel;
            u._lastFlash = flashing;
            u._lastHovered = hovered;
            const col = flashing ? 0xff2222 : (sel ? 0xffffff : (hovered ? 0xff4444 : (u.color || 0x888888)));
            redrawUnitShipVisual(u, col, shipDetail, shipLodLevel);
            drawUnitOverlayVisuals(u, hovered);
          }
          u.gfx.position.set(u.x, u.y);
          const vx = u.vx || 0, vy = u.vy || 0;
          const targetRot = Number.isFinite(u._lastFacingAngle)
            ? u._lastFacingAngle
            : ((vx !== 0 || vy !== 0) ? Math.atan2(vy, vx) : (u.gfx.rotation));
          let curRot = u.gfx.rotation;
          let diff = targetRot - curRot;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const isLeader = !u.leaderId;
          const turnSpeed = getUnitVisualTurnRate(u, isLeader);
          const step = Math.min(Math.PI * 0.5, turnSpeed * (state._lastDt || 0.016));
          if (Math.abs(diff) < step) u.gfx.rotation = targetRot;
          else u.gfx.rotation = curRot + Math.sign(diff) * step;
        } else if (u._trail && (state._frameCtr + u.id) % 8 === 0) {
          u._trail = [];
        }
      }
    }
  }

  // Combat debug labels (authoritative squad state above each leader)
  function updateCombatDebugLabels() {
    const debugEnabled = typeof COMBAT !== "undefined" && COMBAT.DEBUG && COMBAT.DEBUG.enabled;

    if (!debugEnabled || typeof SQUADLOGIC === "undefined" || !SQUADLOGIC.getSquadList || !SQUADLOGIC.getSquadDebugState) {
      // Clear all labels
      for (const [uid, label] of combatDebugLabels) {
        if (label.parent) label.parent.removeChild(label);
        label.destroy();
      }
      combatDebugLabels.clear();
      return;
    }

    function formatOrderDebug(order) {
      if (!order || !order.type || order.type === "idle") return "-";
      const parts = [order.type];
      if (order.targetUnitId != null) parts.push(`u${order.targetUnitId}`);
      if (order.targetCityId != null) parts.push(`c${order.targetCityId}`);
      if (order.mineId != null) parts.push(`m${order.mineId}`);
      if (order.waypointCount) parts.push(`wp${order.waypointCount}`);
      if (order.holdPoint) parts.push("hold");
      return parts.join(":");
    }

    const activeIds = new Set();
    for (const squadState of SQUADLOGIC.getSquadList(state)) {
      const leader = state.units.get(squadState.leaderUnitId);
      if (!leader || leader.hp <= 0) continue;
      if (!inView(leader.x, leader.y)) continue;

      const debugState = SQUADLOGIC.getSquadDebugState(state, squadState.id);
      if (!debugState) continue;

      const labelId = `squad:${debugState.squadId}`;
      activeIds.add(labelId);
      let label = combatDebugLabels.get(labelId);

      if (!label) {
        label = new PIXI.Text({
          text: "",
          style: {
            fontFamily: "monospace",
            fontSize: 10,
            fill: 0xffffff,
            align: "center",
            stroke: { color: 0x000000, width: 2 }
          }
        });
        label.anchor.set(0.5, 1);
        combatDebugLayer.addChild(label);
        combatDebugLabels.set(labelId, label);
      }

      label.text = [
        `SQ${debugState.squadId} ${debugState.mode} combat=${debugState.inCombat ? 1 : 0} lock=${debugState.combatLocked ? 1 : 0}`,
        `zone=${debugState.combatZoneId ?? "-"} targetSq=${debugState.combatTargetSquadId ?? "-"}`,
        `queue=${formatOrderDebug(debugState.queuedOrder)} resume=${formatOrderDebug(debugState.resumeOrder)}`
      ].join("\n");
      label.position.set(leader.x, leader.y - 18);
      label.visible = true;
    }

    // Remove labels for dead/out-of-view squads
    for (const [labelId, label] of combatDebugLabels) {
      if (!activeIds.has(labelId)) {
        if (label.parent) label.parent.removeChild(label);
        label.destroy();
        combatDebugLabels.delete(labelId);
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
        if (vis) refreshResourceVisual(r, r._visualVx || 0, r._visualVy || 0);
      }
    }
  }

  function stepPickups(dt) {
    flushKillRewardPulses();
    const toDelete = [];
    const touchR = CFG.ACTIVITY_RADIUS;

    for (const r of state.res.values()) {
      if (r._targetCity) {
        const p = state.players.get(r._targetCity);
        if (!p) { r._targetCity = null; continue; }
        const prevX = r.x || 0;
        const prevY = r.y || 0;
        const killPulseRouteActive = Array.isArray(r._killPulseRoutePoints)
          && r._killPulseRoutePoints.length >= 2
          && (r._killPulseRouteLength || 0) > 1;
        let targetX = p.x;
        let targetY = p.y;
        if (killPulseRouteActive) {
          const routeTail = r._killPulseRoutePoints[r._killPulseRoutePoints.length - 1];
          targetX = routeTail.x || targetX;
          targetY = routeTail.y || targetY;
        } else if (r._laneJoinPoint) {
          targetX = r._laneJoinPoint.x;
          targetY = r._laneJoinPoint.y;
        }
        const dx = targetX - r.x, dy = targetY - r.y;
        const dl = killPulseRouteActive
          ? Math.max(0, (r._killPulseRouteLength || 0) - (r._killPulseRouteProgress || 0))
          : Math.hypot(dx, dy);
        const minFlyTime = 0.4;
        const canPickup = !r._spawnedAt || (state.t - r._spawnedAt >= minFlyTime);
        if (!killPulseRouteActive && r._laneJoinPoint && dl < 18) {
          r._laneJoinPoint = null;
          continue;
        }
        if (dl < 28 && canPickup) {
          if (!r._visualOnly) {
            if (r.type === "credit") {
              p.eCredits = (p.eCredits || 0) + (r.value || 0);
            } else if (r.type === "orb") {
              gainXP(p, r.xp || 0);
            }
          }
          if (p.id === state.myPlayerId) playCollectSound();
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
        if (r._deathBurst) speed *= 1.45;
        if (r.type === "killPulse") speed *= 1.55;
        if (r._impulsePacket) speed *= 2.05;
        const ease = Math.min(1, 350 / Math.max(dl, 40));
        speed *= (0.35 + 0.65 * ease);
        if (killPulseRouteActive) {
          const routeLength = Math.max(1, r._killPulseRouteLength || polylineLength(r._killPulseRoutePoints));
          r._killPulseRouteLength = routeLength;
          r._killPulseRouteProgress = Math.min(routeLength, (r._killPulseRouteProgress || 0) + speed * dt);
          const sample = samplePolylineAtDistance(r._killPulseRoutePoints, r._killPulseRouteProgress);
          r.x = sample.x;
          r.y = sample.y;
        } else if (dl > 1e-6) {
          r.x += (dx / dl) * speed * dt;
          r.y += (dy / dl) * speed * dt;
        }
        r._visualVx = (r.x - prevX) / Math.max(0.0001, dt);
        r._visualVy = (r.y - prevY) / Math.max(0.0001, dt);
        if (r.gfx) refreshResourceVisual(r, r._visualVx, r._visualVy);
      }

      const interceptProtected = r._interceptProtectUntil && state.t < r._interceptProtectUntil;
      if (!r._visualOnly && (!r._targetCity || !interceptProtected)) {
        const nearby = queryHash(r.x, r.y, touchR);
        for (let i = 0; i < nearby.length; i++) {
          const u = nearby[i];
          if (u.owner === PIRATE_OWNER_ID) continue;
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

      if (!r._visualOnly && !r._targetCity && r.type === "orb") {
        for (const p of state.players.values()) {
          if ((r.x - p.x) ** 2 + (r.y - p.y) ** 2 <= 100) {
            gainXP(p, r.xp || 0);
            if (p.id === state.myPlayerId) playCollectSound();
            toDelete.push(r.id);
            break;
          }
        }
      }
      if (!r._visualOnly && !r._targetCity && r.type === "credit") {
        for (const p of state.players.values()) {
          if ((r.x - p.x) ** 2 + (r.y - p.y) ** 2 <= 100) {
            p.eCredits = (p.eCredits || 0) + (r.value || 0);
            if (p.id === state.myPlayerId) playCollectSound();
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
      const draws = grantLevelCardDrops(p, "levelUp");
      if (draws > 0 && state.botPlayerIds && state.botPlayerIds.has(p.id)) autoPlayBotCardHands(p);
    }
    if (p.id === state.myPlayerId && p.level > prevLevel) levelUpSound();
    p.pendingCardPicks = 0;
  }

  // ------------------------------------------------------------
  // Energy / influence growth
  // ------------------------------------------------------------
  function sampleWaterRatioAround(cx, cy, radius, samples) {
    return requireSharedCitySimApi().sampleWaterRatioAround(cx, cy, radius, samples);
  }

  function stepCities(dt) {
    return requireSharedCitySimApi().stepCities(dt);
  }

  // ------------------------------------------------------------
  // Bots (squad-based AI: farm, attack, expand)
  // ------------------------------------------------------------
  const BOT_TICK = 1.5;
  const BOT_PROFILE_API = (typeof window !== "undefined" && window.BotProfiles) ? window.BotProfiles : null;
  const BOT_SPAWN_INTERVAL = (CFG.BOT_SEND_DELAY ?? 0.6) * 0.5;
  const PIRATE_FULL_SQUAD = ["destroyer", "destroyer", "destroyer", "destroyer", "cruiser", "cruiser", "cruiser", "battleship"];
  function getSelectedBotDifficultyId() {
    return state._soloDifficulty || coreMatchStateApi?.getCurrentMatch?.()?.difficulty || "easy";
  }
  function getBotDifficultyLabel(id) {
    if (id === "superhard") return "супержестко";
    if (id === "hard") return "сложно";
    if (id === "normal") return "нормально";
    return "просто";
  }
  function getBotProfile(player) {
    const fallback = {
      id: "normal",
      thinkIntervalSec: BOT_TICK,
      hiddenStartCreditsBonus: 0,
      decisionQuality: 1,
      misplayChance: 0.12,
      abilityCastChance: 1,
      maxAbilityCastsPerTick: 2,
      buffAutoPlayChance: 1,
      mergeRadius: 500,
      squadDangerTolerance: 1.2,
      buyBurstBonus: 0,
      saveMultiplierMul: 1,
      mineYieldBonusPct: 0,
      xpGainMultiplier: 1,
      archetypeWeights: { aggressor: 1, expander: 1, economist: 1, defensive: 1 }
    };
    const profileId = player && player._botProfileId ? player._botProfileId : getSelectedBotDifficultyId();
    return BOT_PROFILE_API && typeof BOT_PROFILE_API.getProfile === "function"
      ? BOT_PROFILE_API.getProfile(profileId)
      : fallback;
  }
  function getBotWeightedRandom(player, salt) {
    const seed = ((player?.id || 0) * 2654435761 + ((salt || 0) * 1013904223)) >>> 0;
    return ((seed % 10000) / 10000);
  }
  function shouldBotSkipAction(player, baseChance) {
    const profile = getBotProfile(player);
    const chance = Math.max(0, Math.min(1, (baseChance ?? profile.misplayChance ?? 0)));
    return Math.random() < chance;
  }
  function applyCurrentBotDifficulty() {
    if (!state.players || !state.botPlayerIds) return;
    const difficultyId = getSelectedBotDifficultyId();
    for (const pid of state.botPlayerIds) {
      const bot = state.players.get(pid);
      if (!bot) continue;
      const profile = getBotProfile({ _botProfileId: difficultyId });
      bot._botProfileId = difficultyId;
      bot._botDifficultyLabel = profile.label || difficultyId;
      bot._botMineYieldBonusPct = profile.mineYieldBonusPct || 0;
      bot.xpGainMul = profile.xpGainMultiplier || 1;
      if (!bot._botDifficultyApplied) {
        bot.eCredits = Math.max(0, (bot.eCredits || 0) + (profile.hiddenStartCreditsBonus || 0));
        bot._botDifficultyApplied = true;
      }
      recomputePlayerCardDerivedStats(bot);
    }
  }
  function botMergeSmallSquads(pid) {
    const owner = state.players.get(pid);
    const mergeRadius = getBotProfile(owner).mergeRadius || 500;
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
        if (Math.hypot(other.center.x - main.center.x, other.center.y - main.center.y) <= mergeRadius) {
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
      const weights = getBotProfile(p).archetypeWeights || {};
      const total = BOT_ARCHETYPE_KEYS.reduce((sum, key) => sum + Math.max(0.01, weights[key] || 1), 0);
      let target = getBotWeightedRandom(p, 17) * total;
      for (const key of BOT_ARCHETYPE_KEYS) {
        target -= Math.max(0.01, weights[key] || 1);
        if (target <= 0) {
          p._botArchetype = key;
          break;
        }
      }
      if (!p._botArchetype) p._botArchetype = BOT_ARCHETYPE_KEYS[Math.abs(p.id * 7919) % BOT_ARCHETYPE_KEYS.length];
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
    if (state._soloNoBotAi) return;
    for (const p of state.players.values()) {
      if (p.id === state.myPlayerId) continue;
      if (state.botPlayerIds && !state.botPlayerIds.has(p.id)) continue;
      if (p.eliminated || p.pop <= 0) continue;
      const profile = getBotProfile(p);
      p._botAcc = (p._botAcc ?? 0) + dt;
      const tick = p._botAcc >= Math.max(0.45, profile.thinkIntervalSec || BOT_TICK);
      if (tick) p._botAcc = 0;

      if (tick && !isBotIndirectControlEnabled()) botMergeSmallSquads(p.id);
      if (!tick) continue;

      autoPlayBotCardHands(p);

      const arch = botGetArchetype(p);
      const scores = botEvalScores(p, arch);
      const { economyScore, expandScore, attackScore, defendScore, myUnits, ownedMines, weakestEnemy, threatNearBase } = scores;

      const squads = getSquads().filter(s => s.length > 0 && s[0].owner === p.id);
      const myUnitCount = myUnits.length;
      const stagingMinSize = profile.id === "easy" ? 5 : 4;
      const indirectLanes = isBotIndirectControlEnabled();

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
        return enemyPower > squadPower * (profile.squadDangerTolerance || 1.2);
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

      if (!indirectLanes) {
        for (const squad of squads) {
          const leader = squad.find(u => !u.leaderId) || squad[0];
          const squadState = getSquadStateFromUnits(squad);
          if (isAuthoritativeSquadInCombat(squadState)) continue;
          if (squad.length < stagingMinSize) {
            setSquadWaypoint(squad, p.x + rand(-60, 60), p.y + rand(-60, 60));
            continue;
          }
          const wp = leader.waypoints;
          const idle = !wp || (leader.waypointIndex ?? 0) >= wp.length;
          if (!idle && Math.random() > (profile.id === "hard" ? 0.12 : 0.3)) continue;

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
      }

      const credits = p.eCredits || 0;
      const gameTime = state.t || 0;
      const affordType = (key) => {
        if (!UNIT_TYPES[key]) return false;
        if (indirectLanes) return !!getUnitPurchaseQuote(p.id, key, 1, 3).ok;
        return credits >= getPurchaseCostWithModifiers(p.id, key, 1, 1).costPerPurchase;
      };

      let unitToBuy = "destroyer";
      const isEconomist = p._botArchetype === "economist";

      if (myUnitCount < 3 || ownedMines < 2) {
        unitToBuy = "destroyer";
      } else if (gameTime > 360 && affordType("battleship") && Math.random() < 0.25) {
        unitToBuy = "battleship";
      } else if (gameTime > 150 && affordType("cruiser") && Math.random() < 0.35) {
        unitToBuy = "cruiser";
      } else if (affordType("destroyer") && Math.random() < (isEconomist ? 0.35 : 0.6)) {
        unitToBuy = "destroyer";
      }

      const type = UNIT_TYPES[unitToBuy];
      const quote = indirectLanes ? getUnitPurchaseQuote(p.id, unitToBuy, 1, 3) : getUnitPurchaseQuote(p.id, unitToBuy, 1, 1);
      const cost = quote.ok ? quote.totalCost : getPurchaseCostWithModifiers(p.id, unitToBuy, 1, indirectLanes ? 3 : 1).totalCost;
      const saveMultiplier = (isEconomist ? 3.0 : (p._botArchetype === "aggressor" ? 1.2 : 1.8)) * (profile.saveMultiplierMul || 1);
      const savingThreshold = gameTime > 180 ? cost * saveMultiplier : cost;
      if (credits >= cost && (credits >= savingThreshold || myUnitCount < 4)) {
        const mine = nearestUnownedMine();
        const target = mine || weakestEnemy || { x: p.x + rand(-200, 200), y: p.y + rand(-200, 200) };
        const tx = clamp((target.x || 0) + rand(-20, 20), 0, CFG.WORLD_W);
        const ty = clamp((target.y || 0) + rand(-20, 20), 0, CFG.WORLD_H);
        if (indirectLanes) {
          const affordableCount = Math.max(1, Math.floor(credits / Math.max(1, cost)));
          let burstCount = 1;
          if (unitToBuy === "destroyer") burstCount = Math.min(3 + (profile.buyBurstBonus || 0), affordableCount);
          else if (unitToBuy === "cruiser") burstCount = Math.min(2 + Math.min(1, profile.buyBurstBonus || 0), affordableCount);
          else if (unitToBuy === "battleship" && affordableCount >= 2 && credits >= savingThreshold * 1.35) burstCount = Math.min(2 + Math.min(1, profile.buyBurstBonus || 0), affordableCount);
          for (let i = 0; i < burstCount; i++) {
            if (!purchaseFrontTriplet(p.id, unitToBuy).ok) break;
          }
        } else {
          const affordableCount = Math.max(1, Math.floor(credits / cost));
          let burstCount = 1;
          if (unitToBuy === "destroyer") burstCount = Math.min(2 + (profile.buyBurstBonus || 0), affordableCount);
          else if (unitToBuy === "cruiser" && affordableCount >= 2 && Math.random() < 0.35 + (profile.id === "hard" ? 0.15 : 0)) burstCount = Math.min(2 + Math.min(1, profile.buyBurstBonus || 0), affordableCount);
          for (let i = 0; i < burstCount; i++) {
            purchaseUnit(p.id, unitToBuy, [{ x: tx, y: ty }], { sourceTag: "spawn" });
          }
          if (burstCount > 1) botMergeSmallSquads(p.id);
        }
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
  const selectionPointerState = { isPanning: false, panBtn: 0, lastX: 0, lastY: 0 };
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
    if (state._frontControlEnabled !== false) return null;
    let best = null;
    let bestD = Infinity;
    for (const mine of state.mines.values()) {
      if (mine._pirateLocked) continue;
      const R = mine.isRich ? 26 : 18;
      const d = (mine.x - wx) ** 2 + (mine.y - wy) ** 2;
      if (d > R * R) continue;
      if (d < bestD) { bestD = d; best = mine; }
    }
    return best;
  }

  function mineAtWorldAny(wx, wy) {
    let best = null;
    let bestD = Infinity;
    const extraR = 14 / Math.max(0.18, cam.zoom || 0.22);
    for (const mine of state.mines.values()) {
      if (mine._pirateLocked) continue;
      const baseR = mine.isRich ? 34 : 26;
      const hoverR = baseR + extraR;
      const d = (mine.x - wx) ** 2 + (mine.y - wy) ** 2;
      if (d > hoverR * hoverR) continue;
      if (d < bestD) { bestD = d; best = mine; }
    }
    return best;
  }

  function pirateBaseAtWorld(wx, wy) {
    let best = null;
    let bestD = Infinity;
    const hoverR = 52 + 18 / Math.max(0.18, cam.zoom || 0.22);
    for (const pb of getPirateBases()) {
      if (!pb || pb.hp <= 0) continue;
      const d = (pb.x - wx) ** 2 + (pb.y - wy) ** 2;
      if (d > hoverR * hoverR) continue;
      if (d < bestD) { bestD = d; best = pb; }
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

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getMineRealtimeIncome(mine) {
    const owner = mine && mine.ownerId ? state.players.get(mine.ownerId) : null;
    const baseRate = mine && mine._flowRate > 0 ? mine._flowRate : getMineYieldPerSecond(mine, owner);
    const energyRate = getMineEnergyPerSecond(mine, owner);
    const xpRate = baseRate * (CFG.MINE_XP_YIELD_MUL || 1);
    return {
      moneyPerSec: mine && (mine.isRich || mine.resourceType === "money") ? baseRate : 0,
      xpPerSec: mine && (mine.isRich || mine.resourceType !== "money") ? xpRate : 0,
      energyPerSec: energyRate
    };
  }

  function getHoverInspectTarget(wx, wy) {
    const mine = mineAtWorldAny(wx, wy);
    if (mine) return { type: "mine", key: "mine:" + mine.id, mine };
    const pirateBase = pirateBaseAtWorld(wx, wy);
    if (pirateBase) return { type: "pirateBase", key: "pirateBase:" + pirateBase.id, pirateBase };
    const me = state.players.get(state.myPlayerId);
    if (me && me.influencePolygon && me.influencePolygon.length >= 3 && isPointInPolygon(wx, wy, me.influencePolygon)) {
      return { type: "zone", key: "zone:" + me.id, player: me };
    }
    return null;
  }

  function getHoverInspectHtml(target) {
    if (!target) return "";
    if (target.type === "zone") {
      const me = target.player;
      const totalArea = CFG.WORLD_W * CFG.WORLD_H;
      const myArea = polygonArea(me.influencePolygon || []);
      const zonePct = totalArea > 0 ? Math.min(100, (myArea / totalArea) * 100) : 0;
      const xpBonusPct = Math.round(((me.xpGainMul != null ? me.xpGainMul : 1) - 1) * 100);
      return "<div style='font-weight:800;font-size:13px;margin-bottom:6px;color:#eef7ff'>Зона влияния</div>" +
        "<div style='opacity:0.9;line-height:1.35'>Ваша территория контроля. Она растет от энергии ядра и карт экспансии, показывает владение картой и удерживает пространство вокруг базы.</div>" +
        "<div style='margin-top:7px;color:#d7e7ff'>Площадь: <b>" + zonePct.toFixed(1) + "%</b> карты</div>" +
        "<div style='color:#d7e7ff'>Скорость роста: <b>x" + (me.influenceSpeedMul != null ? me.influenceSpeedMul : 1).toFixed(2) + "</b></div>" +
        "<div style='color:" + (xpBonusPct > 0 ? "#90ffb0" : "#c6d4ef") + "'>Бонус XP: <b>" + (xpBonusPct >= 0 ? "+" : "") + xpBonusPct + "%</b></div>";
    }
    if (target.type === "pirateBase") {
      const pb = target.pirateBase;
      const pirateCount = [...state.units.values()].filter((u) => u && u.owner === PIRATE_OWNER_ID && u._pirateBaseId === pb.id && u.hp > 0).length;
      return "<div style='font-weight:800;font-size:13px;margin-bottom:6px;color:#ffe6cb'>Пиратская база</div>" +
        "<div style='opacity:0.9;line-height:1.35'>Спавнит пиратские волны и удерживает центр, пока жива. После уничтожения центр становится намного безопаснее.</div>" +
        "<div style='margin-top:7px;color:#ffd7ba'>HP: <b>" + Math.round(pb.hp || 0) + "/" + Math.round(pb.maxHp || pb.hp || 0) + "</b></div>" +
        "<div style='color:#ffd7ba'>Активных пиратов: <b>" + pirateCount + "</b></div>" +
        "<div style='color:#ffe38a'>Награда: <b>+3 уровня, 2000 € и 150 энергии</b></div>";
    }
    if (target.type === "mine") {
      const mine = target.mine;
      const owner = mine.ownerId ? state.players.get(mine.ownerId) : null;
      const rates = getMineRealtimeIncome(mine);
      const lines = [];
      if (rates.moneyPerSec > 0) lines.push("€ <b>" + rates.moneyPerSec.toFixed(1) + "/с</b>");
      if (rates.xpPerSec > 0) lines.push("XP <b>" + rates.xpPerSec.toFixed(1) + "/с</b>");
      if (rates.energyPerSec > 0) lines.push("⚡ <b>" + rates.energyPerSec.toFixed(1) + "/с</b>");
      const label = mine.isRich ? "Богатая шахта" : (mine.resourceType === "money" ? "Денежная шахта" : "XP шахта");
      return "<div style='font-weight:800;font-size:13px;margin-bottom:6px;color:#fff0b0'>" + label + "</div>" +
        "<div style='opacity:0.9;line-height:1.35'>Постоянно отправляет ресурсы владельцу. Доход ниже считается уже в реальном времени, с учетом текущего бонуса добычи.</div>" +
        "<div style='margin-top:7px;color:#ffe7a4'>Владелец: <b>" + escapeHtml(owner ? owner.name : "Нейтральная") + "</b></div>" +
        "<div style='color:#ffe7a4'>Состояние: <b>" + (mine.captureProgress >= 1 ? "захвачена" : "оспаривается") + "</b></div>" +
        "<div style='color:#fff7d5'>Доход сейчас: " + lines.join(" | ") + "</div>";
    }
    return "";
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
    const timedGrowthBonus = getActiveGrowthBonusPerMin(p);
    const growthMul = p.growthMul != null ? p.growthMul : 1;
    const perMin = (base * (1 - pen) + timedGrowthBonus) * growthMul;
    const turretCount = (p.turretIds || []).filter(tid => { const t = state.turrets.get(tid); return t && t.hp > 0; }).length;
    const cityDmgMul = p.turretDmgMul != null ? p.turretDmgMul : 1;
    const cityDmg = Math.max(1, Math.round(CFG.CITY_ATTACK_DMG * cityDmgMul * (p.waterBonus ? 1.25 : 1) * getLevelBonusMul(p)));
    const infSpdMul = p.influenceSpeedMul != null ? p.influenceSpeedMul : 1;
    const unitHpMul = (p.unitHpMul != null ? p.unitHpMul : 1) * getLevelBonusMul(p);
    const unitDmgMul = (p.unitDmgMul != null ? p.unitDmgMul : 1) * getLevelBonusMul(p);
    const unitSpdMul = (p.unitSpeedMul != null ? p.unitSpeedMul : 1) * getLevelBonusMul(p);
    const unitAtkRMul = (p.unitAtkRateMul != null ? p.unitAtkRateMul : 1) * getLevelBonusMul(p);
    const enemyTurretVolley = Math.max(1, Math.round(CFG.TURRET_ATTACK_DMG * (p.turretDmgMul != null ? p.turretDmgMul : 1) * getLevelBonusMul(p)));
    const myPop = me ? me.pop : 0;
    const myLevel = me ? me.level : 0;
    const myXpNext = me ? me.xpNext : 1;
    const myPerMin = me ? (() => { const b = CFG.GROWTH_BASE_PER_MIN + Math.floor(me.pop / 100) * CFG.GROWTH_PER_100; const penM = Math.min(CFG.ACTIVE_SOLDIER_PENALTY_CAP, (me.activeUnits || 0) * CFG.ACTIVE_SOLDIER_PENALTY_PER); const timedM = getActiveGrowthBonusPerMin(me); return (b * (1 - penM) + timedM) * (me.growthMul != null ? me.growthMul : 1); })() : 0;
    const myTurretVolley = me ? Math.max(1, Math.round(CFG.TURRET_ATTACK_DMG * (me.turretDmgMul != null ? me.turretDmgMul : 1) * getLevelBonusMul(me))) : 0;
    const myInfR = me ? (me.influenceR || 0) : 0;
    const myInfSpd = me ? (me.influenceSpeedMul != null ? me.influenceSpeedMul : 1) : 1;
    const myTurretCount = me ? (me.turretIds || []).filter(tid => { const t = state.turrets.get(tid); return t && t.hp > 0; }).length : 0;
    const ft = UNIT_TYPES.fighter;
    const myUnitHp = me ? Math.round(ft.hp * (me.unitHpMul != null ? me.unitHpMul : 1) * getLevelBonusMul(me)) : 0;
    const myUnitDmg = me ? (ft.damage * (me.unitDmgMul != null ? me.unitDmgMul : 1) * getLevelBonusMul(me)) : 0;
    const myUnitSpd = me ? (ft.speed * (me.unitSpeedMul != null ? me.unitSpeedMul : 1) * getLevelBonusMul(me)) : 0;
    const myUnitAtkR = me ? (ft.attackRate * (me.unitAtkRateMul != null ? me.unitAtkRateMul : 1) * getLevelBonusMul(me)) : 0;
    const enemyMineRates = getPlayerMineRates(p.id);
    const eMineIncPerMin = enemyMineRates.moneyPerSec * 60;
    const eMineEnergyPerMin = enemyMineRates.energyPerSec * 60;
    const eMineXpPerMin = enemyMineRates.xpPerSec * 60;
    const ePopIncPerMin = Math.floor(p.pop / 100) * 60;
    const eEnergyTotalPerMin = perMin + eMineEnergyPerMin;
    const eTotalIncPerMin = Math.round(eMineIncPerMin + ePopIncPerMin);
    const myMineRates = me ? getPlayerMineRates(me.id) : { moneyPerSec: 0, xpPerSec: 0, energyPerSec: 0 };
    const myMineIncPerMin = myMineRates.moneyPerSec * 60;
    const myMineEnergyPerMin = myMineRates.energyPerSec * 60;
    const myMineXpPerMin = myMineRates.xpPerSec * 60;
    const myPopIncPerMin = me ? Math.floor(me.pop / 100) * 60 : 0;
    const myEnergyTotalPerMin = myPerMin + myMineEnergyPerMin;
    const myTotalIncPerMin = Math.round(myMineIncPerMin + myPopIncPerMin);
    const cityPart =
      "<div class='stat-line'><span class='stat-label'>Энергия</span><span class='stat-val'>" + p.pop + statDiffHTML(p.pop, myPop) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Уровень</span><span class='stat-val'>" + p.level + statDiffHTML(p.level, myLevel) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Опыт</span><span class='stat-val'>" + Math.floor(p.xp || 0) + "/" + Math.floor(p.xpNext || 0) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Приток Энергии</span><span class='stat-val'>" + eEnergyTotalPerMin.toFixed(1) + "/мин" + statDiffHTML(eEnergyTotalPerMin, myEnergyTotalPerMin) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Доход</span><span class='stat-val'>" + eTotalIncPerMin + "/мин" + statDiffHTML(eTotalIncPerMin, myTotalIncPerMin) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>XP шахт</span><span class='stat-val'>" + Math.round(eMineXpPerMin) + "/мин" + statDiffHTML(eMineXpPerMin, myMineXpPerMin) + "</span></div>" +
      "<div class='stat-line'><span class='stat-label'>Залп турелей</span><span class='stat-val'>" + enemyTurretVolley + statDiffHTML(enemyTurretVolley, myTurretVolley) + "</span></div>" +
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

  const hoverInspectEl = document.createElement("div");
  hoverInspectEl.id = "holdHoverInspect";
  hoverInspectEl.style.cssText = [
    "position:fixed",
    "display:none",
    "z-index:99999",
    "pointer-events:none",
    "max-width:320px",
    "padding:10px 12px",
    "border-radius:12px",
    "border:1px solid rgba(170,205,255,0.26)",
    "background:rgba(10,16,30,0.92)",
    "box-shadow:0 14px 34px rgba(0,0,0,0.34), 0 0 22px rgba(88,148,255,0.10)",
    "backdrop-filter:blur(8px)",
    "color:#ecf4ff",
    "font:12px/1.35 ui-sans-serif, system-ui, Segoe UI, Arial"
  ].join(";");
  document.body.appendChild(hoverInspectEl);

  function hideHoverInspect() {
    hoverInspectEl.style.display = "none";
  }

  function updateDelayedHoverInfo() {
    const hoverWorld = state._hoverWorld;
    const hoverScreen = state._hoverScreen;
    if (!hoverWorld || !hoverScreen) {
      state._holdInspectKey = null;
      hideHoverInspect();
      return;
    }
    const target = getHoverInspectTarget(hoverWorld.x, hoverWorld.y);
    if (!target) {
      state._holdInspectKey = null;
      hideHoverInspect();
      return;
    }
    const nowMs = performance.now();
    if (state._holdInspectKey !== target.key) {
      state._holdInspectKey = target.key;
      state._holdInspectStartMs = nowMs;
      state._holdInspectAnchor = { x: hoverScreen.x, y: hoverScreen.y };
      hideHoverInspect();
      return;
    }
    const anchor = state._holdInspectAnchor || hoverScreen;
    if (Math.hypot((hoverScreen.x || 0) - anchor.x, (hoverScreen.y || 0) - anchor.y) > 18) {
      state._holdInspectStartMs = nowMs;
      state._holdInspectAnchor = { x: hoverScreen.x, y: hoverScreen.y };
      hideHoverInspect();
      return;
    }
    if ((nowMs - (state._holdInspectStartMs || nowMs)) < 1000) {
      hideHoverInspect();
      return;
    }
    hoverInspectEl.innerHTML = getHoverInspectHtml(target);
    hoverInspectEl.style.display = "block";
    const pad = 16;
    const rect = hoverInspectEl.getBoundingClientRect();
    const left = Math.min(window.innerWidth - rect.width - pad, hoverScreen.x + 18);
    const top = hoverScreen.y + 22 + rect.height > window.innerHeight - pad
      ? hoverScreen.y - rect.height - 16
      : hoverScreen.y + 22;
    hoverInspectEl.style.left = Math.max(pad, left) + "px";
    hoverInspectEl.style.top = Math.max(pad, top) + "px";
  }

  function unitsInRect(x1, y1, x2, y2) {
    return selectionAndOrdersApi ? selectionAndOrdersApi.unitsInRect(x1, y1, x2, y2) : [];
  }

  function getSelectedSquads() {
    return selectionAndOrdersApi ? selectionAndOrdersApi.getSelectedSquads() : [];
  }

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

  app.canvas.addEventListener("pointermove", (e) => {
    const pt = screenToWorld(e.clientX, e.clientY);
    state._hoverScreen = { x: e.clientX, y: e.clientY };
    state._hoverWorld = pt;
  });

  app.canvas.addEventListener("pointerleave", () => {
    state._hoverScreen = null;
    state._holdInspectKey = null;
    hideHoverInspect();
  });

  if (window.SelectionAndOrders && window.SelectionAndOrders.install) {
    selectionAndOrdersApi = window.SelectionAndOrders.install({
      state,
      app,
      cam,
      panState: selectionPointerState,
      applyCamera,
      ensureAudio,
      screenToWorld,
      unitAtWorld,
      unitAtWorldAny,
      cityAtWorld,
      mineAtWorld,
      getSquadStateFromUnits,
      cloneWaypointsSafe,
      getFormationOffsets,
      getFormationCenter,
      getUnitAtkRange,
      getUnitHitRadius,
      shieldRadius,
      closeEnemyCityPanel,
      showEnemyCompare,
      drawDashedSegment,
      destroyChildren,
      pathPreviewLayer,
      drawShipShape,
      getSquads,
      rallyPointHintEl,
      sendPlayerAction
    });
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
      sendMapRegenerate({ seed });
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
    const msg = reason === "cap_reached"
      ? "Лимит юнитов!"
      : reason === "no_fronts"
        ? "Нет доступных фронтов!"
        : "Недостаточно €!";
    state.floatingDamage.push({ x: me.x, y: me.y - 60, text: msg, color: 0xff4444, ttl: 1.5 });
    tickSound(180, 0.08, 0.06);
  }

  function doPurchaseUnit(unitTypeKey) {
    const me = state.players.get(state.myPlayerId);
    if (!me) return false;
    if (!isCoreRosterUnitType(unitTypeKey)) return false;
    if (isServerAuthorityRemote()) {
      sendPlayerAction({ type: "purchaseFrontTriplet", pid: state.myPlayerId, unitType: unitTypeKey });
      state.targetPoints = [];
      return true;
    }
    if (state._multiSlots && !state._multiIsHost && state._socket) {
      sendPlayerAction({ type: "purchaseFrontTriplet", pid: state.myPlayerId, unitType: unitTypeKey });
      const optRes = purchaseFrontTriplet(me.id, unitTypeKey);
      if (!optRes.ok) { showPurchaseError(optRes.reason); return false; }
      state.targetPoints = [];
      return true;
    }
    const res = purchaseFrontTriplet(me.id, unitTypeKey);
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
  if (lvlUpBtn) lvlUpBtn.addEventListener("click", focusCardHud);

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
    const progressEl = document.getElementById("lvlUpProgress");
    const levelTextEl = document.getElementById("lvlUpLevelText");
    const xpTextEl = document.getElementById("lvlUpXpText");
    const handTextEl = document.getElementById("lvlUpHandText");
    if (!me) return;
    ensurePlayerCardState(me);
    const n = (me.buffHand?.length || 0) + (me.abilityHand?.length || 0);
    const xpNext = me.xpNext || 1;
    const pct = Math.min(1, (me.xp || 0) / xpNext);
    if (progressEl) progressEl.style.width = (pct * 100) + "%";
    if (levelTextEl) levelTextEl.textContent = "Ур. " + (me.level || 1);
    if (handTextEl) handTextEl.textContent = "Рука: " + n;
    const gainMod = me.xpGainMul != null && me.xpGainMul !== 1 ? " " + (me.xpGainMul > 1 ? "+" : "") + (Math.round((me.xpGainMul - 1) * 100)) + "%" : "";
    if (xpTextEl) xpTextEl.textContent = "(" + Math.floor(me.xp || 0) + gainMod + ")";
  }

  function focusCardHud() {
    const hud = document.getElementById("cardHud");
    if (!hud) return;
    hud.style.display = "flex";
    hud.style.transform = "translateY(-2px)";
    setTimeout(() => { hud.style.transform = ""; }, 180);
  }

  function isRemoteGameplayClient() {
    return matchSessionApi && typeof matchSessionApi.isRemoteGameplayClient === "function"
      ? matchSessionApi.isRemoteGameplayClient()
      : !!(state._multiSlots && state._socket && !state._multiIsHost);
  }

  function getCardRarityLabel(card) {
    return CARD_RARITY_LABELS[card.rarity] || card.rarity || "карта";
  }

  function getCardRarityPin(rarity) {
    return CARD_RARITY_PINS[rarity] || "?";
  }

  function findPlayerHandCardInstance(player, instanceId) {
    if (!player || !instanceId) return null;
    ensurePlayerCardState(player);
    const buff = Array.isArray(player.buffHand) ? player.buffHand.find((entry) => entry.instanceId === instanceId) : null;
    if (buff) return buff;
    return Array.isArray(player.abilityHand) ? player.abilityHand.find((entry) => entry.instanceId === instanceId) : null;
  }

  function ensureCardPlayFlashOverlay() {
    let overlay = document.getElementById("cardPlayFlashOverlay");
    if (overlay) return overlay;
    const gameWrap = document.getElementById("gameWrap");
    overlay = document.createElement("div");
    overlay.id = "cardPlayFlashOverlay";
    overlay.className = "card-play-flash-overlay";
    (gameWrap || document.body).appendChild(overlay);
    return overlay;
  }

  function triggerCardPlayFlashByRarity(rarity) {
    const overlay = ensureCardPlayFlashOverlay();
    if (!overlay) return;
    const rarityKey = rarity || "common";
    overlay.className = "card-play-flash-overlay rarity-" + rarityKey;
    if (overlay._hideTimer) window.clearTimeout(overlay._hideTimer);
    void overlay.offsetWidth;
    overlay.classList.add("active");
    overlay._hideTimer = window.setTimeout(() => {
      overlay.classList.remove("active");
    }, 1000);
  }

  function appendHandCardTrace(container, className, styleMap) {
    if (!container) return;
    const trace = document.createElement("span");
    trace.className = "hand-card-trace " + className;
    for (const [key, value] of Object.entries(styleMap || {})) {
      trace.style.setProperty(key, value);
    }
    const runner = document.createElement("span");
    runner.className = "hand-card-runner";
    trace.appendChild(runner);
    container.appendChild(trace);
  }

  function createHandCardFx(cardDef) {
    const fx = document.createElement("div");
    fx.className = "hand-card-fx";

    const circuit = document.createElement("div");
    circuit.className = "hand-card-circuit";
    appendHandCardTrace(circuit, "trace-h", { left: "10px", top: "12px", width: "118px", "--runner-duration": "1.55s" });
    appendHandCardTrace(circuit, "trace-v", { left: "128px", top: "12px", height: "28px", "--runner-duration": "1.35s" });
    appendHandCardTrace(circuit, "trace-h", { left: "56px", top: "40px", width: "72px", "--runner-duration": "1.7s" });
    appendHandCardTrace(circuit, "trace-v", { left: "56px", top: "40px", height: "40px", "--runner-duration": "1.4s" });
    appendHandCardTrace(circuit, "trace-h", { left: "22px", top: "80px", width: "106px", "--runner-duration": "1.85s" });
    appendHandCardTrace(circuit, "trace-v", { left: "112px", top: "80px", height: "34px", "--runner-duration": "1.5s" });
    appendHandCardTrace(circuit, "trace-h", { left: "44px", top: "114px", width: "84px", "--runner-duration": "1.65s" });
    fx.appendChild(circuit);

    const lamps = document.createElement("div");
    lamps.className = "hand-card-right-lamps";
    for (let i = 0; i < 5; i++) {
      const lamp = document.createElement("span");
      lamp.className = "hand-card-right-lamp";
      lamp.style.setProperty("--lamp-index", String(i));
      lamps.appendChild(lamp);
    }
    fx.appendChild(lamps);
    return fx;
  }

  function getCardDurationText(card, entry) {
    if (entry && entry.permanent) return "Постоянный";
    if (card.permanent) return "Постоянный";
    if (entry && entry.expiresAt != null) return "Осталось " + Math.max(0, Math.ceil(fromSimSeconds(entry.expiresAt - state.t))) + "с";
    if (card.durationSec) return Math.ceil(fromSimSeconds(card.durationSec)) + "с";
    return "";
  }

  function activateHandCardInstance(instance, activationContext) {
    void activationContext;
    const me = state.players.get(state.myPlayerId);
    if (!me || !instance) return;
    const cardDef = getCardDefById(instance.cardId);
    if (!cardDef) return;
    if (cardDef.kind === "buff") {
      triggerCardPlayFlashByRarity(cardDef.rarity);
      if (isRemoteGameplayClient()) {
        activateBuffCardForPlayer(state.myPlayerId, instance.instanceId, false);
        sendPlayerAction({ type: "activateBuffCard", pid: state.myPlayerId, instanceId: instance.instanceId });
      } else {
        activateBuffCardForPlayer(state.myPlayerId, instance.instanceId);
      }
      return;
    }
    state._pendingAbilityCardInstanceId = instance.instanceId;
    me.pendingAbilityCardId = instance.instanceId;
    if (!cardDef.targeting || cardDef.targeting === "instant") {
      triggerCardPlayFlashByRarity(cardDef.rarity);
      if (isRemoteGameplayClient()) {
        consumeAbilityCardForPlayerLocal(state.myPlayerId, instance.instanceId, false);
        sendPlayerAction({ type: "castAbilityCard", pid: state.myPlayerId, instanceId: instance.instanceId });
      } else {
        castAbilityCardForPlayer({ pid: state.myPlayerId, instanceId: instance.instanceId });
      }
      state._pendingAbilityCardInstanceId = null;
      me.pendingAbilityCardId = null;
      return;
    }
    startAbilityTargeting(cardDef.abilityId);
    focusCardHud();
  }

  function confirmPendingAbilityCardCast(extraPayload) {
    const instanceId = state._pendingAbilityCardInstanceId;
    if (!instanceId) return false;
    const me = state.players.get(state.myPlayerId);
    const instance = findPlayerHandCardInstance(me, instanceId);
    const cardDef = instance ? getCardDefById(instance.cardId) : null;
    const payload = Object.assign({
      type: "castAbilityCard",
      pid: state.myPlayerId,
      instanceId
    }, extraPayload || {});
    if (cardDef) triggerCardPlayFlashByRarity(cardDef.rarity);
    if (isRemoteGameplayClient()) {
      consumeAbilityCardForPlayerLocal(state.myPlayerId, instanceId, false);
      sendPlayerAction(payload);
    } else castAbilityCardForPlayer(payload);
    hideHudTooltip();
    state._pendingAbilityCardInstanceId = null;
    if (me) me.pendingAbilityCardId = null;
    cancelAbilityTargeting();
    return true;
  }

  function isGameplayDropTarget(clientX, clientY) {
    const target = document.elementFromPoint(clientX, clientY);
    if (!target) return false;
    if (target.closest("#hud, #topRightPanel, #bottomRightPanel, #cardHud, #gameChatWrap, #enemyComparePanel, #victoryOverlay, #abilityOverlay, #cardModal, #mainMenu, #nicknameScreen, #lobbyScreen, #multiConnectScreen, #mobileGameHudBar")) {
      return false;
    }
    return !!target.closest("canvas, #gameWrap");
  }

  function getNowMs() {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  function beginCardHudFreeze(ms) {
    state._cardHudFreezeUntilMs = getNowMs() + Math.max(0, ms || 0);
  }

  function isCardHudFrozen() {
    return !!(state._cardHudFreezeUntilMs && getNowMs() < state._cardHudFreezeUntilMs);
  }

  function beginCardHudHoverSuppress(ms) {
    state._cardHudHoverSuppressUntilMs = getNowMs() + Math.max(0, ms || 0);
    clearHoveredHandCard();
  }

  function isCardHudHoverSuppressed() {
    return !!(state._cardHudHoverSuppressUntilMs && getNowMs() < state._cardHudHoverSuppressUntilMs);
  }

  function hideHudTooltip() {
    const tooltipEl = typeof document !== "undefined" ? document.getElementById("hudTooltip") : null;
    if (tooltipEl) tooltipEl.style.display = "none";
  }

  function clearHoveredHandCard(targetCard) {
    if (targetCard) targetCard.classList.remove("is-hovered");
    const card = state._hoveredHandCardEl;
    if (card) card.classList.remove("is-hovered");
    const zoneBody = card && typeof card.closest === "function" ? card.closest(".card-zone-body") : null;
    if (zoneBody) zoneBody.classList.remove("hover-lock");
    if (state._hoveredHandCardCleanup) state._hoveredHandCardCleanup();
    state._hoveredHandCardEl = null;
    state._hoveredHandCardCleanup = null;
    hideHudTooltip();
  }

  function getStableHandCardHoverRect(cardEl) {
    const rect = cardEl.getBoundingClientRect();
    return {
      left: rect.left - 18,
      right: rect.right + 18,
      top: rect.top - 18,
      bottom: rect.bottom + 170
    };
  }

  function pointInStableHandCardRect(cardEl, x, y) {
    const rect = getStableHandCardHoverRect(cardEl);
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function setHoveredHandCard(cardEl) {
    if (!cardEl) return;
    if (isCardHudHoverSuppressed()) return;
    if (state._hoveredHandCardEl === cardEl) return;
    clearHoveredHandCard();
    state._hoveredHandCardEl = cardEl;
    cardEl.classList.add("is-hovered");
    const zoneBody = cardEl.closest(".card-zone-body");
    if (zoneBody) zoneBody.classList.add("hover-lock");

    const onWindowPointerMove = (event) => {
      if (!state._hoveredHandCardEl || state._hoveredHandCardEl !== cardEl) return;
      if (state._draggingCardInstanceId === cardEl.dataset.instanceId) {
        clearHoveredHandCard(cardEl);
        return;
      }
      if (!pointInStableHandCardRect(cardEl, event.clientX, event.clientY)) clearHoveredHandCard(cardEl);
    };
    const onWindowPointerDown = () => clearHoveredHandCard(cardEl);
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerdown", onWindowPointerDown, true);
    state._hoveredHandCardCleanup = () => {
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerdown", onWindowPointerDown, true);
    };
  }

  function bindHandCardHoverState(cardEl) {
    if (!cardEl || cardEl._hoverStateBound) return;
    cardEl._hoverStateBound = true;
    cardEl.addEventListener("pointerenter", () => {
      if (state._draggingCardInstanceId) return;
      if (isCardHudHoverSuppressed()) return;
      setHoveredHandCard(cardEl);
    });
    cardEl.addEventListener("pointerleave", (event) => {
      if (state._draggingCardInstanceId === cardEl.dataset.instanceId) return;
      const x = event.clientX != null ? event.clientX : -99999;
      const y = event.clientY != null ? event.clientY : -99999;
      requestAnimationFrame(() => {
        if (state._hoveredHandCardEl !== cardEl) return;
        if (!pointInStableHandCardRect(cardEl, x, y)) clearHoveredHandCard(cardEl);
      });
    });
  }

  function animateFloatingCardGhost(ghost, targetLeft, targetTop, finalTransform, finalOpacity, done) {
    if (!ghost) {
      if (done) done();
      return;
    }
    ghost.style.transition = "left 130ms cubic-bezier(0.2, 0.8, 0.2, 1), top 130ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 130ms ease, transform 130ms cubic-bezier(0.2, 0.8, 0.2, 1)";
    requestAnimationFrame(() => {
      ghost.style.left = Math.round(targetLeft) + "px";
      ghost.style.top = Math.round(targetTop) + "px";
      if (finalTransform) ghost.style.transform = finalTransform;
      if (finalOpacity != null) ghost.style.opacity = String(finalOpacity);
    });
    window.setTimeout(() => {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
      if (done) done();
    }, 140);
  }

  function animateCardGhostReturn(ghost, sourceRect, done) {
    animateFloatingCardGhost(ghost, sourceRect.left, sourceRect.top, "rotate(0deg) scale(1)", 1, done);
  }

  function animateCardGhostCommit(ghost, done) {
    const currentLeft = parseFloat(ghost.style.left || "0") || 0;
    const currentTop = parseFloat(ghost.style.top || "0") || 0;
    ghost.classList.add("play-commit");
    animateFloatingCardGhost(ghost, currentLeft, currentTop - 42, "rotate(-10deg) scale(0.82)", 0, done);
  }

  function spawnCardActivationBurst(target, rarityKey) {
    if (typeof document === "undefined" || !target || !target.getBoundingClientRect) return;
    const rect = target.getBoundingClientRect();
    const burst = document.createElement("div");
    const rarity = rarityKey || "rare";
    const size = Math.max(72, Math.min(186, Math.max(rect.width, rect.height) * 0.78));
    burst.className = "card-activation-burst rarity-" + rarity;
    burst.style.width = Math.round(size) + "px";
    burst.style.height = Math.round(size) + "px";
    burst.style.left = Math.round(rect.left + rect.width * 0.5) + "px";
    burst.style.top = Math.round(rect.top + rect.height * 0.42) + "px";
    document.body.appendChild(burst);
    window.setTimeout(() => {
      if (burst.parentNode) burst.parentNode.removeChild(burst);
    }, 300);
  }

  function syncHandZoneCountLabel(container) {
    if (!container) return;
    const isAbilityHand = container.id === "abilityHandCards";
    const countEl = document.getElementById(isAbilityHand ? "abilityHandCount" : "buffHandCount");
    if (!countEl) return;
    const limit = isAbilityHand
      ? (CardSystemApi ? CardSystemApi.ABILITY_HAND_LIMIT : 10)
      : (CardSystemApi ? CardSystemApi.BUFF_HAND_LIMIT : 30);
    countEl.textContent = `${container.querySelectorAll(".hand-card").length}/${limit}`;
  }

  function removeHandCardFromLayout(cardEl) {
    if (!cardEl) return;
    const container = cardEl.closest(".card-zone-body");
    if (!container) {
      if (cardEl.parentNode) cardEl.parentNode.removeChild(cardEl);
      return;
    }
    const prevSnapshot = captureHandCardSnapshot(container);
    if (cardEl.parentNode === container) container.removeChild(cardEl);
    beginCardHudHoverSuppress(220);
    container.dataset.stackLayoutKey = "";
    container.dataset.textFitKey = "";
    layoutHandCards(container);
    fitHandCardDescriptions(container);
    syncHandZoneCountLabel(container);
    animateHandCardLayoutTransition(container, prevSnapshot);
  }

  function animateHandCardActivation(cardEl, done) {
    if (!cardEl) {
      if (done) done();
      return;
    }
    clearHoveredHandCard(cardEl);
    beginCardHudFreeze(140);
    beginCardHudHoverSuppress(240);
    const rect = cardEl.getBoundingClientRect();
    spawnCardActivationBurst(cardEl, cardEl.dataset.rarity || "rare");
    const ghost = cardEl.cloneNode(true);
    ghost.classList.remove("is-hovered", "pending-target", "drag-source", "activating-card");
    ghost.classList.add("drag-card-ghost");
    ghost.style.width = rect.width + "px";
    ghost.style.left = rect.left + "px";
    ghost.style.top = rect.top + "px";
    document.body.appendChild(ghost);
    removeHandCardFromLayout(cardEl);
    animateCardGhostCommit(ghost, () => {
      if (done) done();
    });
  }

  function captureHandCardSnapshot(container) {
    const snapshot = new Map();
    if (!container) return snapshot;
    const cards = container.querySelectorAll(".hand-card");
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      snapshot.set(card.dataset.instanceId, {
        rect: card.getBoundingClientRect(),
        card
      });
    }
    return snapshot;
  }

  function animateRemovedHandCards(prevSnapshot, container) {
    if (!prevSnapshot || !prevSnapshot.size || !container) return;
    const nextIds = new Set(Array.from(container.querySelectorAll(".hand-card")).map((card) => card.dataset.instanceId));
    for (const [instanceId, snap] of prevSnapshot.entries()) {
      if (nextIds.has(instanceId) || !snap || !snap.card) continue;
      const ghost = snap.card.cloneNode(true);
      ghost.classList.remove("is-hovered", "pending-target", "drag-source", "activating-card");
      ghost.classList.add("drag-card-ghost");
      ghost.style.width = snap.rect.width + "px";
      ghost.style.left = snap.rect.left + "px";
      ghost.style.top = snap.rect.top + "px";
      document.body.appendChild(ghost);
      animateCardGhostCommit(ghost);
    }
  }

  function animateHandCardLayoutTransition(container, prevSnapshot) {
    if (!container || !prevSnapshot || !prevSnapshot.size) return;
    const cards = container.querySelectorAll(".hand-card");
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const snap = prevSnapshot.get(card.dataset.instanceId);
      if (!snap || !snap.rect) continue;
      const nextRect = card.getBoundingClientRect();
      const dx = snap.rect.left - nextRect.left;
      const dy = snap.rect.top - nextRect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      if (typeof card.animate === "function") {
        card.animate(
          [
            { translate: `${dx}px ${dy}px` },
            { translate: "0px 0px" }
          ],
          {
            duration: 180,
            easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
          }
        );
      }
    }
  }

  function bindCardDragActivation(cardEl, instance, isPendingTarget) {
    if (!cardEl || !instance || isPendingTarget) return;
    cardEl.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target.closest("button")) return;
      event.preventDefault();
      clearHoveredHandCard(cardEl);
      const startX = event.clientX;
      const startY = event.clientY;
      const rect = cardEl.getBoundingClientRect();
      const cardDef = getCardDefById(instance.cardId);
      const keepsCardInHandOnActivate = !!(cardDef && cardDef.kind === "ability" && cardDef.targeting && cardDef.targeting !== "instant");
      let dragging = false;
      let ghost = null;

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (!dragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
          dragging = true;
          state._draggingCardInstanceId = instance.instanceId;
          cardEl.classList.add("drag-source");
          ghost = cardEl.cloneNode(true);
          ghost.classList.remove("drag-source", "pending-target");
          ghost.classList.add("drag-card-ghost");
          ghost.style.width = rect.width + "px";
          ghost.style.left = (startX - rect.width / 2) + "px";
          ghost.style.top = (startY - 42) + "px";
          document.body.appendChild(ghost);
        }
        if (!dragging) return;
        const canDrop = isGameplayDropTarget(moveEvent.clientX, moveEvent.clientY);
        if (ghost) {
          ghost.style.left = (moveEvent.clientX - rect.width / 2) + "px";
          ghost.style.top = (moveEvent.clientY - 42) + "px";
          ghost.classList.toggle("drag-commit", canDrop);
        }
      };

      const finish = (activate) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        state._draggingCardInstanceId = null;
        const sourceRect = cardEl.getBoundingClientRect();
        if (!activate) {
          cardEl.classList.remove("drag-source");
          if (ghost) animateCardGhostReturn(ghost, sourceRect);
          ghost = null;
          return;
        }
        if (keepsCardInHandOnActivate) {
          cardEl.classList.remove("drag-source");
          if (ghost) {
            animateCardGhostCommit(ghost, () => activateHandCardInstance(instance, { fromDrag: true }));
            ghost = null;
          } else {
            activateHandCardInstance(instance, { fromDrag: true });
          }
          return;
        }
        beginCardHudFreeze(140);
        removeHandCardFromLayout(cardEl);
        if (ghost) {
          animateCardGhostCommit(ghost, () => {
            activateHandCardInstance(instance, { fromDrag: true });
          });
          ghost = null;
        } else {
          activateHandCardInstance(instance, { fromDrag: true });
        }
      };

      const onUp = (upEvent) => {
        finish(dragging && isGameplayDropTarget(upEvent.clientX, upEvent.clientY));
      };

      const onCancel = () => finish(false);

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
      window.addEventListener("pointercancel", onCancel, { once: true });
    });
  }

  function createHandCardElement(instance, cardDef, isPendingTarget) {
    const rarityKey = cardDef.rarity || "common";
    const card = document.createElement("div");
    card.className = "hand-card rarity-" + rarityKey + (isPendingTarget ? " pending-target" : "");
    card.dataset.instanceId = instance.instanceId;
    card.dataset.rarity = rarityKey;

    const rarity = document.createElement("div");
    rarity.className = "card-rarity-chip card-rarity-badge " + rarityKey;
    rarity.textContent = getCardRarityPin(rarityKey);
    rarity.title = getCardRarityLabel(cardDef);

    const fx = createHandCardFx(cardDef);

    const header = document.createElement("div");
    header.className = "hand-card-header";

    const icon = document.createElement("div");
    icon.className = "hand-card-icon";
    icon.textContent = cardDef.icon || getCardEmoji(cardDef);

    const title = document.createElement("div");
    title.className = "hand-card-title";
    title.textContent = cardDef.name || "Карта";

    header.appendChild(icon);
    header.appendChild(title);

    const desc = document.createElement("div");
    desc.className = "hand-card-desc";
    desc.textContent = cardDef.desc || "";

    const meta = document.createElement("div");
    meta.className = "hand-card-meta";
    meta.textContent = isPendingTarget ? "ПКМ: отмена наведения" : getCardDurationText(cardDef, null);

    const actions = document.createElement("div");
    actions.className = "hand-card-actions";
    const activateBtn = document.createElement("button");
    activateBtn.type = "button";
    activateBtn.className = "pill";
    activateBtn.textContent = cardDef.kind === "ability"
      ? (isPendingTarget ? "Ждёт цель" : "Активировать")
      : "Активировать";
    activateBtn.disabled = !!isPendingTarget;
    activateBtn.addEventListener("click", () => {
      const keepsCardInHandOnActivate = !!(cardDef.kind === "ability" && cardDef.targeting && cardDef.targeting !== "instant");
      if (keepsCardInHandOnActivate) {
        activateHandCardInstance(instance);
        return;
      }
      animateHandCardActivation(card, () => activateHandCardInstance(instance));
    });
    actions.appendChild(activateBtn);

    card.appendChild(fx);
    card.appendChild(rarity);
    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(meta);
    card.appendChild(actions);
    card.dataset.tooltip = (cardDef.name || "Карта") + "\n" + (cardDef.desc || "") + (isPendingTarget ? "\nПКМ: отмена наведения" : "\nПотяни вверх или нажми «Активировать»");
    bindHandCardHoverState(card);
    bindCardDragActivation(card, instance, isPendingTarget);
    return card;
  }

  function fitTextToBox(el, maxFontPx, minFontPx, stepPx, lineHeight) {
    if (!el || el.clientHeight <= 0) return;
    const maxPx = maxFontPx != null ? maxFontPx : 14;
    const minPx = minFontPx != null ? minFontPx : 10.5;
    const step = Math.max(0.1, stepPx != null ? stepPx : 0.5);
    const lh = lineHeight != null ? lineHeight : 1.35;
    el.style.fontSize = maxPx + "px";
    el.style.lineHeight = String(lh);
    const maxPasses = Math.max(1, Math.ceil((maxPx - minPx) / step) + 1);
    for (let i = 0; i < maxPasses && el.scrollHeight > el.clientHeight + 1; i++) {
      const nextPx = Math.max(minPx, maxPx - step * (i + 1));
      el.style.fontSize = nextPx + "px";
      if (nextPx <= minPx) break;
    }
  }

  function fitHandCardDescriptions(container) {
    if (!container) return;
    const fitKey = `${container.dataset.stackLayoutKey || ""}:${container.childElementCount}`;
    if (container.dataset.textFitKey === fitKey) return;
    const descriptions = container.querySelectorAll(".hand-card-desc");
    for (const descEl of descriptions) fitTextToBox(descEl, 14, 10.5, 0.5, 1.35);
    container.dataset.textFitKey = fitKey;
  }

  function layoutHandCards(container) {
    if (!container) return;
    const cards = Array.from(container.querySelectorAll(".hand-card"));
    if (!cards.length) {
      container.dataset.stackLayoutKey = "";
      return;
    }

    const sampleCard = cards[0];
    const cardWidth = Math.max(1, Math.round(sampleCard.getBoundingClientRect().width || sampleCard.offsetWidth || 128));
    const availableWidth = Math.max(cardWidth, Math.floor(container.clientWidth || container.getBoundingClientRect().width || cardWidth));
    const layoutKey = `${cards.length}:${availableWidth}:${cardWidth}`;
    if (container.dataset.stackLayoutKey === layoutKey) return;
    container.dataset.stackLayoutKey = layoutKey;

    const isAbilityHand = container.id === "abilityHandCards";
    const defaultStep = Math.round(cardWidth * (isAbilityHand ? 0.35 : 0.5));
    const minStep = isAbilityHand ? 2 : 4;
    let step = defaultStep;
    if (cards.length > 1) {
      const fittedStep = Math.floor((availableWidth - cardWidth) / (cards.length - 1));
      step = Math.min(defaultStep, Math.max(minStep, fittedStep));
    }

    const stackedMargin = `${step - cardWidth}px`;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      card.style.marginLeft = i === 0 ? "0px" : stackedMargin;
      card.style.setProperty("--hand-stack-index", String(i + 1));
    }
  }

  function getPlayerStatusBarEntries(me) {
    const entries = [];
    const timed = (until) => (until != null ? Math.max(0, Math.ceil(until - state.t)) : 0);

    for (const entry of [...(me.activeBuffs || []), ...(me.legendaryBuffs || [])]) {
      const cardDef = getCardDefById(entry.cardId);
      if (!cardDef) continue;
      entries.push({
        id: "card:" + entry.instanceId,
        icon: cardDef.icon || getCardEmoji(cardDef),
        title: cardDef.name || "Эффект",
        desc: cardDef.desc || "",
        permanent: !!entry.permanent,
        expiresAt: entry.expiresAt ?? null
      });
    }

    const ownBattleMarchUntil = state._battleMarchUntil && state._battleMarchUntil[me.id];
    if (ownBattleMarchUntil > state.t) {
      entries.push({
        id: "ability:gloriousBattleMarch",
        icon: "🎺",
        title: "Боевой марш",
        desc: "+30% скорости всем кораблям.",
        expiresAt: ownBattleMarchUntil
      });
    }

    const ownFleetBoostUntil = state._fleetBoostUntil && state._fleetBoostUntil[me.id];
    if (ownFleetBoostUntil > state.t) {
      entries.push({
        id: "ability:fleetBoost",
        icon: "⚡",
        title: "Форсаж эскадры",
        desc: "+50% скорости всем своим юнитам.",
        expiresAt: ownFleetBoostUntil
      });
    }

    const ownVoidShieldUntil = state._voidShieldUntil && state._voidShieldUntil[me.id];
    if (ownVoidShieldUntil > state.t) {
      entries.push({
        id: "ability:voidShield",
        icon: "✨",
        title: "Щит пустоты",
        desc: "Временная неуязвимость своих юнитов.",
        expiresAt: ownVoidShieldUntil
      });
    }

    for (const storm of state._abilityStorms || []) {
      if (storm.ownerId !== me.id) continue;
      entries.push({
        id: "storm:" + (storm.spawnedAt || 0) + ":" + storm.x + ":" + storm.y,
        icon: "🌩️",
        title: fromSimSeconds(storm.duration || 0) <= 3.2 ? "Ионное поле" : "Ионный шторм",
        desc: "Активная зона урона и замедления.",
        expiresAt: (storm.spawnedAt || state.t) + (storm.duration || 0)
      });
    }

    for (const hole of state._blackHoles || []) {
      if (hole.ownerId !== me.id) continue;
      entries.push({
        id: "hole:" + (hole.spawnedAt || 0) + ":" + hole.x + ":" + hole.y,
        icon: "🕳️",
        title: "Чёрная дыра",
        desc: "Активная зона притяжения и урона.",
        expiresAt: (hole.spawnedAt || state.t) + (hole.duration || 0)
      });
    }

    const abilityZoneMeta = {
      rift: { icon: "🌀", title: "Разлом", desc: "АоЕ урон и замедление." },
      anchor: { icon: "⚓", title: "Грав. якорь", desc: "Иммобилизация врагов в зоне." },
      timeSlow: { icon: "⏳", title: "Сингулярность", desc: "Сильное замедление врагов в зоне." },
      nano: { icon: "🦠", title: "Нанорой", desc: "DoT и ослабление атаки врагов." },
      minefieldMine: { icon: "🧨", title: "Минное поле", desc: "Активные мины в коридоре." },
      minefieldBlast: { icon: "💥", title: "Подрыв мины", desc: "Краткая вспышка после детонации." }
    };
    for (const zone of state._abilityZoneEffects || []) {
      if (zone.ownerId !== me.id) continue;
      if (zone.type === "minefieldMine" || zone.type === "minefieldBlast") continue;
      const meta = abilityZoneMeta[zone.type];
      if (!meta) continue;
      entries.push({
        id: "zone:" + zone.type + ":" + (zone.spawnedAt || 0) + ":" + zone.x + ":" + zone.y,
        icon: meta.icon,
        title: meta.title,
        desc: meta.desc,
        expiresAt: (zone.spawnedAt || state.t) + (zone.duration || 0)
      });
    }

    for (const mine of state.mines.values()) {
      if (mine.ownerId !== me.id || mine._originalOwner == null || !mine._raidReturnAt || mine._raidReturnAt <= state.t) continue;
      entries.push({
        id: "raidMine:" + mine.id,
        icon: "⛏️",
        title: "Перехват шахты",
        desc: "Временный контроль чужой шахты.",
        expiresAt: mine._raidReturnAt
      });
    }

    entries.sort((a, b) => {
      const aPerm = a.permanent ? 1 : 0;
      const bPerm = b.permanent ? 1 : 0;
      if (aPerm !== bPerm) return aPerm - bPerm;
      return timed(a.expiresAt) - timed(b.expiresAt);
    });
    return entries;
  }

  function createStatusChip(entry) {
    const chip = document.createElement("div");
    chip.className = "active-buff-chip" + (entry.permanent ? " permanent" : "");
    const durationText = entry.permanent ? "Постоянный" : Math.max(0, Math.ceil((entry.expiresAt || state.t) - state.t)) + "с";
    chip.dataset.tooltip = (entry.title || "Эффект") + "\n" + (entry.desc || "") + "\n" + durationText;

    const icon = document.createElement("span");
    icon.className = "active-buff-chip-icon";
    icon.textContent = entry.icon || "✨";
    chip.appendChild(icon);

    const timer = document.createElement("span");
    timer.className = "active-buff-chip-timer";
    timer.textContent = entry.permanent ? "∞" : durationText;
    chip.appendChild(timer);
    return chip;
  }

  function getCardHudRenderKey(me) {
    return JSON.stringify({
      buffHand: (me.buffHand || []).map((entry) => entry.instanceId + ":" + entry.cardId),
      abilityHand: (me.abilityHand || []).map((entry) => entry.instanceId + ":" + entry.cardId),
      pendingAbility: state._pendingAbilityCardInstanceId || null
    });
  }

  function getCardHudStatusKey(activeEntries) {
    return JSON.stringify(activeEntries.map((entry) => (
      entry.id + ":" + (entry.permanent ? "perm" : Math.max(0, Math.ceil((entry.expiresAt || state.t) - state.t)))
    )));
  }

  function renderTopActiveBuffBar(topActiveBuffBar, activeEntries) {
    if (!topActiveBuffBar) return;
    topActiveBuffBar.innerHTML = "";
    topActiveBuffBar.style.display = activeEntries.length > 0 ? "flex" : "none";
    for (const entry of activeEntries) {
      const el = createStatusChip(entry);
      if (el) topActiveBuffBar.appendChild(el);
    }
  }

  function renderHudBuffSummary(host, activeEntries) {
    if (!host) return;
    host.innerHTML = "";
    if (!activeEntries.length) {
      host.innerHTML = "<div class='muted'>Активных баффов нет.</div>";
      return;
    }
    for (const entry of activeEntries) {
      const el = createStatusChip(entry);
      if (el) host.appendChild(el);
    }
  }

  function activateAllBuffCardsForPlayer(pid) {
    const player = state.players.get(pid);
    if (!player) return 0;
    ensurePlayerCardState(player);
    const handSnapshot = Array.isArray(player.buffHand) ? [...player.buffHand] : [];
    if (!handSnapshot.length) return 0;
    beginCardHudFreeze(180);
    beginCardHudHoverSuppress(260);
    triggerCardPlayFlashByRarity("rare");
    const zone = document.getElementById("buffHandZone");
    if (zone) spawnCardActivationBurst(zone, "rare");
    let activated = 0;
    for (const entry of handSnapshot) {
      if (!entry || !entry.instanceId) continue;
      const result = isRemoteGameplayClient()
        ? activateBuffCardForPlayer(pid, entry.instanceId, false)
        : activateBuffCardForPlayer(pid, entry.instanceId);
      if (!result || !result.ok) continue;
      activated++;
      if (isRemoteGameplayClient()) {
        sendPlayerAction({ type: "activateBuffCard", pid, instanceId: entry.instanceId });
      }
    }
    return activated;
  }

  function ensureCardHudControlsBound() {
    if (state._cardHudControlsBound) return;
    state._cardHudControlsBound = true;
    const activateAllBtn = document.getElementById("buffActivateAllBtn");
    if (activateAllBtn) {
      activateAllBtn.addEventListener("click", () => {
        activateAllBuffCardsForPlayer(state.myPlayerId);
      });
    }
  }

  function renderCardHud() {
    const hud = document.getElementById("cardHud");
    const buffHandCards = document.getElementById("buffHandCards");
    const abilityHandCards = document.getElementById("abilityHandCards");
    const topActiveBuffBar = document.getElementById("topActiveBuffBar");
    const hudBuffSummary = document.getElementById("hudBuffSummary");
    const buffHandCount = document.getElementById("buffHandCount");
    const abilityHandCount = document.getElementById("abilityHandCount");
    const buffActivateAllBtn = document.getElementById("buffActivateAllBtn");
    const me = state.players.get(state.myPlayerId);
    if (!hud || !buffHandCards || !abilityHandCards || !me) return;
    ensureCardHudControlsBound();
    ensurePlayerCardState(me);
    hud.style.display = "flex";
    if (buffActivateAllBtn) {
      buffActivateAllBtn.disabled = isCardHudFrozen() || !me.buffHand || me.buffHand.length === 0;
      buffActivateAllBtn.textContent = me.buffHand && me.buffHand.length > 0
        ? "Активировать всё"
        : "Нет баффов";
    }
    if (state._draggingCardInstanceId) return;
    if (isCardHudFrozen()) return;

    const renderKey = getCardHudRenderKey(me);
    const activeEntries = getPlayerStatusBarEntries(me);
    const activeKey = getCardHudStatusKey(activeEntries);
    if (state._cardHudRenderKey === renderKey) {
      layoutHandCards(buffHandCards);
      layoutHandCards(abilityHandCards);
      fitHandCardDescriptions(buffHandCards);
      fitHandCardDescriptions(abilityHandCards);
      if (state._cardHudActiveKey !== activeKey) {
        state._cardHudActiveKey = activeKey;
        renderHudBuffSummary(hudBuffSummary, activeEntries);
      }
      return;
    }
    clearHoveredHandCard();
    state._cardHudRenderKey = renderKey;

    const prevBuffSnapshot = captureHandCardSnapshot(buffHandCards);
    const prevAbilitySnapshot = captureHandCardSnapshot(abilityHandCards);

    buffHandCards.dataset.stackLayoutKey = "";
    abilityHandCards.dataset.stackLayoutKey = "";
    buffHandCards.dataset.textFitKey = "";
    abilityHandCards.dataset.textFitKey = "";
    buffHandCards.innerHTML = "";
    abilityHandCards.innerHTML = "";

    if (buffHandCount) buffHandCount.textContent = `${me.buffHand.length}/${CardSystemApi ? CardSystemApi.BUFF_HAND_LIMIT : 30}`;
    if (abilityHandCount) abilityHandCount.textContent = `${me.abilityHand.length}/${CardSystemApi ? CardSystemApi.ABILITY_HAND_LIMIT : 10}`;

    for (const entry of me.buffHand) {
      const def = getCardDefById(entry.cardId);
      if (!def) continue;
      buffHandCards.appendChild(createHandCardElement(entry, def, false));
    }

    for (const entry of me.abilityHand) {
      const def = getCardDefById(entry.cardId);
      if (!def) continue;
      abilityHandCards.appendChild(createHandCardElement(entry, def, state._pendingAbilityCardInstanceId === entry.instanceId));
    }

    layoutHandCards(buffHandCards);
    layoutHandCards(abilityHandCards);
    fitHandCardDescriptions(buffHandCards);
    fitHandCardDescriptions(abilityHandCards);
    animateRemovedHandCards(prevBuffSnapshot, buffHandCards);
    animateRemovedHandCards(prevAbilitySnapshot, abilityHandCards);
    animateHandCardLayoutTransition(buffHandCards, prevBuffSnapshot);
    animateHandCardLayoutTransition(abilityHandCards, prevAbilitySnapshot);

    state._cardHudActiveKey = activeKey;
    renderHudBuffSummary(hudBuffSummary, activeEntries);
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
    growth: "Прирост Энергии: ядро быстрее восстанавливает Энергию.",
    influence: "Расширение зоны: граница влияния растёт быстрее (штраф за армию всё равно применяется).",
    sendCooldown: "КД отправки: можно чаще отправлять отряды из города.",
    turret: "Турели и патрульные: урон, HP или радиус турелей; патрульные тоже усиливаются этими апгрейдами.",
    turretTarget: "Мультизалп патрульных: каждый патрульный выпускает больше лучей за атаку.",
    popBonus: "Мгновенная Энергия: сразу усиливает ядро и повышает лимит отправки."
  };
  function getCardParamTooltip(card) {
    const keys = Object.keys(card);
    if (card.turretTargetBonus) return CARD_PARAM_TOOLTIPS.turretTarget;
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
    if (card.turretTargetBonus) return "Сейчас: " + (PATROL_BASE_SHOTS + (p.turretTargetBonus || 0)) + " выстр./залп патруля";
    if (card.popBonus) return "Сейчас Энергия: " + p.pop;
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
    focusCardHud();
    return;
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
          if (isServerAuthorityRemote()) {
            sendPlayerAction({ type: "cardChoice", pid: state.myPlayerId, card: card });
            me.pendingCardPicks = picks - 1;
            state._pendingCardChoices = null;
          } else {
            if (state._socket && !state._multiIsHost) {
              sendPlayerAction({ type: "cardChoice", pid: state.myPlayerId, card: card });
            }
            applyCard(me, card);
            me.pendingCardPicks = picks - 1;
            state._pendingCardChoices = null;
          }
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
    renderCardHud();

    const mineRates = getPlayerMineRates(me.id);
    const base = CFG.GROWTH_BASE_PER_MIN + Math.floor(me.pop / 100) * CFG.GROWTH_PER_100;
    const pen = Math.min(CFG.ACTIVE_SOLDIER_PENALTY_CAP, me.activeUnits * CFG.ACTIVE_SOLDIER_PENALTY_PER);
    const timedGrowthBonus = getActiveGrowthBonusPerMin(me);
    const growthMulHUD = me.growthMul != null ? me.growthMul : 1;
    const perMin = (base * (1 - pen) + timedGrowthBonus) * growthMulHUD;
    const energyPerMin = perMin + mineRates.energyPerSec * 60;
    const mineIncPerMin = mineRates.moneyPerSec * 60;
    const popIncPerMin = Math.floor(me.pop / 100) * 60;
    const totalIncPerMin = Math.round(mineIncPerMin + popIncPerMin);

    const energyEl = document.getElementById("energyValue");
    if (energyEl) {
      energyEl.innerHTML = "<span class='resource-value-main'>" + Math.floor(me.pop || 0) + "</span><span class='resource-value-delta'>+" + energyPerMin.toFixed(1) + "/мин</span>";
    }
    const eCreditsEl = document.getElementById("eCreditsValue");
    if (eCreditsEl) {
      eCreditsEl.innerHTML = "<span class='resource-value-main'>" + Math.floor(me.eCredits || 0) + "</span><span class='resource-value-delta'>+" + totalIncPerMin + "/мин</span>";
    }

    document.querySelectorAll(".unit-buy-btn").forEach(btn => {
      const typeKey = btn.dataset.type;
      const type = UNIT_TYPES[typeKey];
      if (!type) return;
      const cost = getPurchaseCostWithModifiers(me.id, typeKey, 1, isIndirectControlEnabled() ? 3 : 1).costPerPurchase;
      const costEl = btn.querySelector(".unit-buy-cost");
      if (costEl) costEl.textContent = cost + " €";
      btn.disabled = (me.eCredits || 0) < cost;
    });

    const turretCount = (me.turretIds || []).filter(tid => { const t = state.turrets.get(tid); return t && t.hp > 0; }).length;
    const cityDmgMulHud = (me.turretDmgMul != null ? me.turretDmgMul : 1) * getLevelBonusMul(me);
    const cityDmg = Math.max(1, Math.round(CFG.TURRET_ATTACK_DMG * cityDmgMulHud));
    const turretHpMulHud = (me.turretHpMul != null ? me.turretHpMul : 1) * getLevelBonusMul(me);
    const turretHp = Math.max(1, Math.round(me.pop * (CFG.TURRET_HP_RATIO ?? 0.1) * turretHpMulHud));
    const turretDmgMulHud2 = (me.turretDmgMul != null ? me.turretDmgMul : 1) * getLevelBonusMul(me);
    const turretDmg = ((CFG.TURRET_ATTACK_DMG ?? 3) * (CFG.TURRET_ATTACK_RATE ?? 1.2) * turretDmgMulHud2).toFixed(1);

    const infSpdMul = me.influenceSpeedMul != null ? me.influenceSpeedMul : 1;
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
    el("hudMining", "⚡ " + mineRates.energyPerSec.toFixed(1) + "/с | € " + mineRates.moneyPerSec.toFixed(1) + "/с | XP " + mineRates.xpPerSec.toFixed(1) + "/с");
    el("hudShield", Math.round(me.shieldHp || 0) + " (" + shieldPct + "%)");
    el("hudZone", zonePct.toFixed(1) + "%");
    el("hudZoneSpeed", "×" + infSpdMul.toFixed(2));
    const zoneFill = document.getElementById("hudZoneFill");
    if (zoneFill) zoneFill.style.width = zonePct + "%";
    el("hudTurretHp", turretHp + " hp");
    el("hudTurretDmg", turretDmg + " dps");
    el("hudCityDmg", String(cityDmg));
    el("hudPatrols", patrolCount);

    const lb = getLevelBonusMul(me);
    const myHpMul = (me.unitHpMul != null ? me.unitHpMul : 1) * lb;
    const myDmgMul = (me.unitDmgMul != null ? me.unitDmgMul : 1) * lb;
    const myAtkRMul = (me.unitAtkRateMul != null ? me.unitAtkRateMul : 1) * lb;
    const mySpdMul = (me.unitSpeedMul != null ? me.unitSpeedMul : 1) * lb;
    const myAtkRangeMul = (me.unitAtkRangeMul != null ? me.unitAtkRangeMul : 1) * getRangeLevelMul(me);
    const fmtM = (v) => "×" + v.toFixed(2);
    el("hudHpMul", fmtM(myHpMul));
    el("hudDmgMul", fmtM(myDmgMul));
    el("hudRateMul", fmtM(myAtkRMul));
    el("hudRangeMul", fmtM(myAtkRangeMul));
    el("hudSpeedMul", fmtM(mySpdMul));

    const hpMulEl = document.getElementById("hudHpMul");
    const dmgMulEl = document.getElementById("hudDmgMul");
    const rateMulEl = document.getElementById("hudRateMul");
    const rangeMulEl = document.getElementById("hudRangeMul");
    const speedMulEl = document.getElementById("hudSpeedMul");
    const colorMul = (e, v) => { if (e) e.style.color = v > 1 ? "#66dd88" : v < 1 ? "#ff5555" : "#aabbcc"; };
    colorMul(hpMulEl, myHpMul);
    colorMul(dmgMulEl, myDmgMul);
    colorMul(rateMulEl, myAtkRMul);
    colorMul(rangeMulEl, myAtkRangeMul);
    colorMul(speedMulEl, mySpdMul);

    const legendaryEl = document.getElementById("hudLegendary");
    if (legendaryEl) {
      const effects = [];
      if (me.legendaryBuffs && me.legendaryBuffs.length > 0) {
        for (const entry of me.legendaryBuffs) {
          const def = getCardDefById(entry.cardId);
          if (def) effects.push(def.name);
        }
      }
      if (me.attackEffects) {
        const effectNames = { chain: "⚡Цепная", cryo: "❄️Крио", fire: "🔥Огонь" };
        for (const [eff, lv] of Object.entries(me.attackEffects)) {
          if (lv > 0) effects.push(effectNames[eff] + " " + lv);
        }
      }
      legendaryEl.textContent = effects.length ? effects.join(", ") : "—";
    }

    // Update buy/batch button enabled/disabled state (credits + unit cap)
    const myId = me.id;
    document.querySelectorAll(".unit-batch-btn").forEach(b => {
      const tk = b.dataset.type;
      const cnt = parseInt(b.dataset.count) || 1;
      const tp = UNIT_TYPES[tk];
      if (!tp) return;
      const unitCost = getPurchaseCostWithModifiers(me.id, tk, 1, isIndirectControlEnabled() ? 3 : 1).costPerPurchase;
      const totalCost = unitCost * cnt;
      const canAfford = (me.eCredits || 0) >= totalCost;
      const cap = UNIT_CAPS[tk] ?? 300;
      const cur = countPlayerUnits(myId, tk);
      const atCap = cur >= cap;
      const enabled = canAfford && !atCap;
      b.textContent = "x" + cnt;
      b.style.opacity = enabled ? "1" : "0.35";
      b.style.pointerEvents = enabled ? "auto" : "none";
      b.title = atCap ? "Лимит: " + cur + "/" + cap : ("Цена: " + totalCost + " €");
    });
    document.querySelectorAll(".unit-buy-btn").forEach(b => {
      const tk = b.dataset.type;
      const tp = UNIT_TYPES[tk];
      if (!tp) return;
      const cost = getPurchaseCostWithModifiers(me.id, tk, 1, isIndirectControlEnabled() ? 3 : 1).costPerPurchase;
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
      if (!tooltipEl) return;
      const row = e.target.closest("[data-tooltip]");
      if (!row) {
        tooltipEl.style.display = "none";
        return;
      }
      tooltipEl.textContent = row.dataset.tooltip;
      tooltipEl.style.display = "block";
      tooltipEl.style.left = Math.min(e.clientX + 12, window.innerWidth - 280) + "px";
      tooltipEl.style.top = (e.clientY + 14) + "px";
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
        { label: "Энергия", my: me.pop, his: enemy.pop },
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
  const STORM_STARTUP_DELAY = 30;

  state.storm = null;
  state._nextStormAt = STORM_STARTUP_DELAY;

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
      particles: [],
      _finalBurstDone: false
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

  function isUnitInsideStormShape(u, s, cosA, sinA) {
    const rx = (u.x - s.x) * cosA + (u.y - s.y) * sinA;
    const ry = -(u.x - s.x) * sinA + (u.y - s.y) * cosA;
    for (const b of s.blobs) {
      if ((rx - b.ox) ** 2 + (ry - b.oy) ** 2 <= b.r * b.r) return true;
    }
    return false;
  }

  function applyStormFinalBurst(s, pct, glyph, color) {
    if (!s || s._finalBurstDone) return;
    s._finalBurstDone = true;
    const cosA = Math.cos(s.rotAngle), sinA = Math.sin(s.rotAngle);
    for (const u of state.units.values()) {
      if (!u || u.hp <= 0) continue;
      if (!isUnitInsideStormShape(u, s, cosA, sinA)) continue;
      const maxHp = Math.max(1, u.maxHp || u.hp || 1);
      const dmg = Math.max(1, Math.round(maxHp * pct));
      u.hp = Math.max(0, u.hp - dmg);
      u.lastDamagedBy = s.ownerId;
      u._hitFlashT = state.t;
      state.floatingDamage.push({ x: u.x, y: u.y - 22, text: "-" + dmg + glyph, color, ttl: 0.85 });
    }
  }

  function applyBlackHoleFinalBurst(bh) {
    if (!bh || bh._finalBurstDone) return;
    bh._finalBurstDone = true;
    const burstRadius = Math.max(1, bh.radius || 0);
    const burstPct = bh.finalBurstPct != null ? bh.finalBurstPct : 0.10;
    for (const u of state.units.values()) {
      if (!u || u.hp <= 0) continue;
      const dx = u.x - bh.x;
      const dy = u.y - bh.y;
      if (dx * dx + dy * dy > burstRadius * burstRadius) continue;
      const maxHp = Math.max(1, u.maxHp || u.hp || 1);
      const dmg = Math.max(1, Math.round(maxHp * burstPct));
      u.hp = Math.max(0, u.hp - dmg);
      u.lastDamagedBy = bh.ownerId;
      u._hitFlashT = state.t;
      state.floatingDamage.push({ x: u.x, y: u.y - 22, text: "-" + dmg + "🕳️", color: 0xff8855, ttl: 0.95 });
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
      applyStormFinalBurst(s, 0.02, "⚡", 0x66ccff);
      destroyIonStormVisual(s);
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
        if (isUnitInsideStormShape(u, s, cosA, sinA)) {
          const dmg = Math.max(1, Math.floor(u.hp * 0.1));
          if (u.hp - dmg < 1) { u.hp = 1; } else { u.hp -= dmg; }
          u._hitFlashT = state.t;
          state.floatingDamage.push({ x: u.x, y: u.y - 22, text: "-" + dmg + "⚡", color: 0x8888ff, ttl: 0.8 });
        }
      }
    }
  }

  function destroyIonStormVisual(s) {
    if (!s) return;
    if (typeof IonStormRenderer !== "undefined" && IonStormRenderer && typeof IonStormRenderer.destroy === "function") {
      IonStormRenderer.destroy(s);
      return;
    }
    if (s.gfx) { s.gfx.parent?.removeChild(s.gfx); s.gfx.destroy(true); s.gfx = null; }
    if (s.emojiContainer) { s.emojiContainer.parent?.removeChild(s.emojiContainer); s.emojiContainer.destroy({ children: true }); s.emojiContainer = null; }
  }

  function hideIonStormVisual(s) {
    if (!s) return;
    if (typeof IonStormRenderer !== "undefined" && IonStormRenderer && typeof IonStormRenderer.hide === "function") {
      IonStormRenderer.hide(s);
      return;
    }
    if (s.gfx) s.gfx.visible = false;
    if (s.emojiContainer) s.emojiContainer.visible = false;
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
    if (!state.nebulae || !state.nebulae.length) {
      nebulaLayer.visible = false;
      nebulaFxLayer.visible = false;
      invalidateNebulaBodyGraphics();
      if (state._nebulaDischargeGfx && !state._nebulaDischargeGfx.destroyed) state._nebulaDischargeGfx.clear();
      return;
    }
    nebulaLayer.visible = true;
    nebulaFxLayer.visible = true;
    const detail = getNebulaVisualDetail();
    const bodyLod = LOD.getLevel(cam.zoom || 0.22);
    if (!state._nebulaBodyGfx || state._nebulaBodyGfx.destroyed || state._nebulaBodyLod !== bodyLod) {
      invalidateNebulaBodyGraphics();
      state._nebulaBodyGfx = new PIXI.Graphics();
      nebulaLayer.addChild(state._nebulaBodyGfx);
      state._nebulaBodyLod = bodyLod;
    }
    if (!state._nebulaDischargeGfx || state._nebulaDischargeGfx.destroyed) {
      state._nebulaDischargeGfx = new PIXI.Graphics();
      nebulaFxLayer.addChild(state._nebulaDischargeGfx);
    }
    const bg = state._nebulaBodyGfx;
    const dg = state._nebulaDischargeGfx;
    if (!bg._drawnForNebulaScene) {
      bg.clear();

      const softEllipse = (g, x, y, rx, ry, color, alpha) => {
        g.ellipse(x, y, rx * 1.18, ry * 1.18);
        g.fill({ color, alpha: alpha * 0.22 });
        g.ellipse(x, y, rx, ry);
        g.fill({ color, alpha: alpha * 0.36 });
        g.ellipse(x, y, rx * 0.76, ry * 0.76);
        g.fill({ color, alpha: alpha * 0.22 });
      };
      const ribbonStroke = (g, ax, ay, mx, my, bx, by, width, color, alpha) => {
        const pts = [];
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          const omt = 1 - t;
          pts.push(
            omt * omt * ax + 2 * omt * t * mx + t * t * bx,
            omt * omt * ay + 2 * omt * t * my + t * t * by
          );
        }
        g.poly(pts);
        g.stroke({ width, color, alpha });
      };

      const fogCount = Math.min(detail.fogWisps, stateNebulaFogWisps.length);
      for (let i = 0; i < fogCount; i++) {
        const fog = stateNebulaFogWisps[i];
        softEllipse(bg, fog.x, fog.y, fog.rx, fog.ry, fog.color, fog.alpha);
        softEllipse(bg, fog.x, fog.y, fog.rx * 0.42, fog.ry * 0.42, fog.edgeColor, fog.alpha * 0.55);
      }
      bg._drawnForNebulaScene = true;
      bg.cacheAsBitmap = true;
    }

    for (const neb of state.nebulae) {
      const zone = getAnimatedNebulaZone(neb);
      ensureNebulaCachedVisuals(neb, detail, bodyLod);
      const vis = inView(zone.x, zone.y);
      const baseRadius = neb._baseRadius ?? neb.radius;
      const scale = zone.radius / Math.max(1, baseRadius);
      if (neb._bodyContainer) {
        neb._bodyContainer.visible = vis;
        neb._bodyContainer.position.set(zone.x, zone.y);
        neb._bodyContainer.scale.set(scale);
      }
      if (neb._zoneContainer) {
        neb._zoneContainer.visible = vis;
        neb._zoneContainer.position.set(zone.x, zone.y);
        neb._zoneContainer.scale.set(scale);
      }
    }

    const dischargeStride = Math.max(1, detail.dischargeStride || 1);
    if (((state._frameCtr || 0) % dischargeStride) !== 0) return;
    dg.clear();

    for (const neb of state.nebulae) {
      const zone = getAnimatedNebulaZone(neb);
      if (!inView(zone.x, zone.y)) continue;
      const revealScale = 0.58;
      for (const d of neb.discharges) {
        const age = d.maxLife - d.life;
        const fadeIn = age < d.maxLife * 0.16 ? age / (d.maxLife * 0.16) : 1;
        const fadeOut = d.life < d.maxLife * 0.30 ? d.life / (d.maxLife * 0.30) : 1;
        const alpha = 0.88 * fadeIn * fadeOut;
        const revealFrac = Math.min(1, age / Math.max(0.001, d.revealDur || (d.maxLife * revealScale)));
        const visibleLen = (d.totalLen || 9999) * revealFrac;
        const hue = d.hue || 0x6699cc;
        let drawn = 0;
        for (const seg of (d.segs || [])) {
          if (drawn >= visibleLen) break;
          const segLen = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1) || 1;
          const segEnd = drawn + segLen;
          let ex = seg.x2;
          let ey = seg.y2;
          if (segEnd > visibleLen) {
            const tf = (visibleLen - drawn) / segLen;
            ex = seg.x1 + (seg.x2 - seg.x1) * tf;
            ey = seg.y1 + (seg.y2 - seg.y1) * tf;
          }
          dg.moveTo(seg.x1, seg.y1);
          dg.lineTo(ex, ey);
          dg.stroke({ color: hue, width: detail.dischargeGlowWidth, alpha: 0.10 * alpha });
          dg.moveTo(seg.x1, seg.y1);
          dg.lineTo(ex, ey);
          dg.stroke({ color: 0xd6ecff, width: detail.dischargeCoreWidth, alpha: 0.24 * alpha });
          dg.moveTo(seg.x1, seg.y1);
          dg.lineTo(ex, ey);
          dg.stroke({ color: 0xffffff, width: Math.max(0.6, detail.dischargeCoreWidth * 0.34), alpha: 0.10 * alpha });
          drawn = segEnd;
        }
      }
    }
  }

  function drawStorm() {
    const s = state.storm;
    if (!s) return;
    if (!inView(s.x, s.y)) {
      hideIonStormVisual(s);
      return;
    }
    const contour = stormContourPoints(s);
    if (typeof IonStormRenderer !== "undefined" && IonStormRenderer && typeof IonStormRenderer.renderStorm === "function") {
      IonStormRenderer.renderStorm(s, {
        layer: world,
        contour,
        simTimeSec: state.t,
        animTimeSec: performance.now() / 1000,
        zoom: cam.zoom || 0.22,
        multiplayerRemote: !!(state._multiSlots && !state._multiIsHost),
        durationSec: STORM_DURATION
      });
    }
  }

  // ------------------------------------------------------------
  // Abilities
  // ------------------------------------------------------------
  const ABILITY_DEFS = (CardSystemApi && CardSystemApi.ABILITY_DEFS) ? CardSystemApi.ABILITY_DEFS : [
    { id: "ionField", name: "Ионное поле", desc: "Короткий ионный шторм на 3с в одной зоне", cooldown: 70, icon: "⚡", targeting: "point" },
    { id: "ionNebula", name: "Ионный шторм", desc: "Легендарный ионный шторм с прежним визуалом", cooldown: 120, icon: "🌩️", targeting: "point" },
    { id: "activeShield", name: "Фронтовой щит", desc: "+25% временного щита всем своим кораблям", cooldown: 75, icon: "🛡️" },
    { id: "fleetBoost", name: "Форсаж эскадры", desc: "+50% скорости всем своим юнитам на 20с", cooldown: 70, icon: "⚡" },
    { id: "resourceSurge", name: "Ресурсный всплеск", desc: "+2200 eCredits мгновенно", cooldown: 150, icon: "💎" },
    { id: "raiderCapture", name: "Похищение энергии", desc: "Крадёт 12% энергии выбранного ядра, но не больше 70", cooldown: 110, icon: "🔌", targeting: "city" },
    { id: "minefield", name: "Малое минное поле", desc: "5 мин ложатся вглубь своего коридора и взрываются по площади", cooldown: 90, icon: "🧨", targeting: "point" },
    { id: "minefieldLarge", name: "Большое минное поле", desc: "25 мин плотным полем уходят вглубь коридора и перекрывают проход", cooldown: 135, icon: "🧨", targeting: "point" },
    { id: "meteor", name: "Линейный метеор", desc: "Один быстрый метеор по линии. Младшая версия дождя.", cooldown: 95, icon: "☄️", targeting: "angle" },
    { id: "meteorSwarm", name: "Метеоритный дождь", desc: "Легендарный залп метеоров по линии", cooldown: 140, icon: "☄️", targeting: "angle" },
    { id: "microBlackHole", name: "Микро-чёрная дыра", desc: "Упрощённая дыра: 5с, радиус и урон в 3 раза меньше", cooldown: 95, icon: "🕳️", targeting: "point" },
    { id: "microAnchor", name: "Микро-якорь", desc: "Короткая стяжка-стазис в небольшой зоне", cooldown: 80, icon: "🧲", targeting: "point" },
    { id: "blackHole", name: "Чёрная дыра", desc: "Легендарная зона притяжения и урона " + CFG.BLACKHOLE_DURATION + "с", cooldown: CFG.BLACKHOLE_COOLDOWN, icon: "🕳️", targeting: "point" },
    { id: "gravAnchor", name: "Грав. якорь", desc: "Легендарная зона стяжки и фиксации врагов", cooldown: 110, icon: "⚓", targeting: "point" },
    { id: "orbitalStrike", name: "Орбитальный удар", desc: "2 залпа по 5 выстрелов в случайные точки выбранной зоны", cooldown: 95, icon: "💥", targeting: "point" },
    { id: "orbitalBarrage", name: "Орбитальная канонада", desc: "10 залпов по 5 выстрелов накрывают зону случайными попаданиями", cooldown: 145, icon: "💥", targeting: "point" },
    { id: "thermoNuke", name: "Термоядерный импульс", desc: "Сверхтяжёлый удар по огромной зоне", cooldown: 200, icon: "☢️", targeting: "point" }
  ];

  state._abilityCooldowns = {};
  state._abilityCooldownsByPlayer = state._abilityCooldownsByPlayer || {};
  state._abilityUsedByPlayer = state._abilityUsedByPlayer || {};
  state._abilityAnnouncements = state._abilityAnnouncements || [];
  state._abilityTargeting = null;
  state._mobileAbilityConfirm = null;
  state._mobileAbilityLockedPreview = null;
  state._abilityStorms = [];
  state._meteorTargeting = null; // {phase:'point'|'angle', x, y, angle}
  state._activeMeteors = [];
  state._orbitalStrikes = [];
  state._thermoNukes = [];
  state._pirateRaids = [];
  state._economyAbilityFx = [];
  state._battleMarchUntil = state._battleMarchUntil || {};
  state._raiderCaptureTargeting = null;
  const PIRATE_OWNER_ID = -1;
  const PIRATE_BASE_ATTACK_RANGE = 260;
  const PIRATE_BASE_ATTACK_TARGETS = 4;
  const PIRATE_BASE_ATTACK_COOLDOWN = 1.15;
  const PIRATE_BASE_ATTACK_FLAT_DMG = 10;
  const PIRATE_BASE_ATTACK_MAX_HP_PCT = 0.03;
  const PIRATE_BASE_ATTACK_COLOR = 0xff8a5c;
  const SURVIVAL_ENEMY_OWNER_ID = 999;

  function getPirateBases() {
    return Array.isArray(state.pirateBases) ? state.pirateBases : [];
  }

  function setPirateBases(bases) {
    state.pirateBases = Array.isArray(bases) ? bases : [];
    state.pirateBase = state.pirateBases[0] || null;
  }

  function refreshPirateBaseOrbitAnchors() {
    const centerMines = [...state.mines.values()].filter((mine) => mine && (mine.isRich || mine.ownerId !== PIRATE_OWNER_ID));
    if (!centerMines.length) return;
    for (const pb of getPirateBases()) {
      if (!pb) continue;
      let bestMine = null;
      let bestDist = Infinity;
      for (const mine of centerMines) {
        const dist = Math.hypot((pb.x || 0) - (mine.x || 0), (pb.y || 0) - (mine.y || 0));
        if (dist < bestDist) {
          bestDist = dist;
          bestMine = mine;
        }
      }
      if (!bestMine) continue;
      pb.orbitCenter = { x: bestMine.x || 0, y: bestMine.y || 0 };
      pb.orbitRadius = Math.max(160, Math.min(330, bestDist * 1.34));
    }
  }

  function getAlivePirateBases() {
    return getPirateBases().filter((pb) => pb && pb.hp > 0);
  }

  function getPirateBaseById(baseId) {
    if (baseId == null) return null;
    return getPirateBases().find((pb) => pb && pb.id === baseId) || null;
  }

  function getNearestAlivePirateBase(x, y, maxRange) {
    let best = null;
    let bestD = maxRange != null ? maxRange * maxRange : Infinity;
    for (const pb of getAlivePirateBases()) {
      const d = (pb.x - x) ** 2 + (pb.y - y) ** 2;
      if (d <= bestD) {
        bestD = d;
        best = pb;
      }
    }
    return best;
  }

  function removePirateBaseVisual(pb) {
    if (!pb) return;
    if (pb.gfx && pb.gfx.parent) pb.gfx.parent.removeChild(pb.gfx);
    if (pb._emojiGfx && pb._emojiGfx.parent) pb._emojiGfx.parent.removeChild(pb._emojiGfx);
    if (pb._timerTxt && pb._timerTxt.parent) pb._timerTxt.parent.removeChild(pb._timerTxt);
    pb.gfx = null;
    pb._emojiGfx = null;
    pb._timerTxt = null;
  }

  function clearPirateBases() {
    for (const pb of getPirateBases()) removePirateBaseVisual(pb);
    setPirateBases([]);
  }

  function degFromTopClockwiseToRad(deg) {
    return ((deg || 0) - 90) * Math.PI / 180;
  }

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
  const abilityTargetHintEl = document.getElementById("abilityTargetHint");
  const abilityConfirmPopupEl = document.getElementById("abilityConfirmPopup");
  const abilityConfirmTitleEl = document.getElementById("abilityConfirmTitle");
  const abilityConfirmTextEl = document.getElementById("abilityConfirmText");
  const abilityConfirmYesEl = document.getElementById("abilityConfirmYes");
  const abilityConfirmNoEl = document.getElementById("abilityConfirmNo");

  function isMobileAbilityConfirmationMode() {
    return typeof window !== "undefined" && isCompactMobileUi() && isMobileViewportLike();
  }

  function setAbilityTargetHint(text) {
    if (!abilityTargetHintEl) return;
    const shouldShow = !!text && !!state._abilityTargeting && isMobileAbilityConfirmationMode();
    abilityTargetHintEl.textContent = shouldShow ? text : "";
    abilityTargetHintEl.style.display = shouldShow ? "block" : "none";
  }

  function getAbilityTargetHintText() {
    if (!state._abilityTargeting || !isMobileAbilityConfirmationMode()) return "";
    if (state._mobileAbilityConfirm) return "Проверь превью и нажми «Да», если все верно.";
    if (state._abilityTargeting === "meteor" || state._abilityTargeting === "spatialRift" || state._abilityTargeting === METEOR_SWARM_ABILITY_ID) {
      if (state._meteorTargeting && state._meteorTargeting.phase === "angle") {
        return "Проведи пальцем, чтобы задать угол, затем тапни еще раз для подтверждения.";
      }
      return "Тапни по карте, чтобы выбрать точку.";
    }
    return "Тапни по карте, чтобы выбрать область, затем подтверди активацию.";
  }

  function syncAbilityTargetHint() {
    setAbilityTargetHint(getAbilityTargetHintText());
  }

  function clearMobileAbilityConfirmation(keepPreview) {
    state._mobileAbilityConfirm = null;
    if (!keepPreview) state._mobileAbilityLockedPreview = null;
    if (abilityConfirmPopupEl) abilityConfirmPopupEl.style.display = "none";
    syncAbilityTargetHint();
  }

  function openMobileAbilityConfirmation(confirmOptions) {
    state._mobileAbilityConfirm = confirmOptions || null;
    if (abilityConfirmTitleEl) abilityConfirmTitleEl.textContent = (confirmOptions && confirmOptions.title) || "Активировать?";
    if (abilityConfirmTextEl) abilityConfirmTextEl.textContent = (confirmOptions && confirmOptions.text) || "Проверь цель и подтверди применение способности.";
    if (abilityConfirmPopupEl) abilityConfirmPopupEl.style.display = confirmOptions ? "flex" : "none";
    syncAbilityTargetHint();
  }

  if (abilityConfirmYesEl) {
    abilityConfirmYesEl.addEventListener("click", () => {
      const confirmState = state._mobileAbilityConfirm;
      if (!confirmState || typeof confirmState.onConfirm !== "function") return;
      clearMobileAbilityConfirmation(false);
      confirmState.onConfirm();
    });
  }
  if (abilityConfirmNoEl) {
    abilityConfirmNoEl.addEventListener("click", () => {
      const confirmState = state._mobileAbilityConfirm;
      clearMobileAbilityConfirmation(false);
      if (confirmState && typeof confirmState.onCancel === "function") confirmState.onCancel();
    });
  }
  if (abilityConfirmPopupEl) {
    abilityConfirmPopupEl.addEventListener("click", (event) => {
      if (event.target !== abilityConfirmPopupEl) return;
      const confirmState = state._mobileAbilityConfirm;
      clearMobileAbilityConfirmation(false);
      if (confirmState && typeof confirmState.onCancel === "function") confirmState.onCancel();
    });
  }

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

    function activateAbilityFromPicker(def) {
      const instantAbilities = {
        activeShield: () => { useActiveShield(state.myPlayerId); },
        fleetBoost: () => { useFleetBoost(state.myPlayerId); },
        resourceSurge: () => { useResourceSurge(state.myPlayerId); }
      };
      if (instantAbilities[def.id]) {
        instantAbilities[def.id]();
        if (def.cooldown) setAbilityCooldown(state.myPlayerId, def.id, def.cooldown);
        pushAbilityAnnouncement(state.myPlayerId, def.id);
        hideAbilityPicker();
        return;
      }
      startAbilityTargeting(def.id);
    }

    for (const def of ABILITY_DEFS) {
      const used = def.oneTime && myUsed.includes(def.id);
      const cd = used ? 1 : (myCds[def.id] ?? 0);
      const cdReal = fromSimSeconds(cd);
      const ready = !used && cd <= 0;
      const card = document.createElement("div");
      card.style.cssText = `
        width:130px;height:190px;background:linear-gradient(180deg,#12143a 0%,#1a1d55 100%);
        border:2px solid ${ready ? "#44aaff" : "#555"};border-radius:12px;cursor:${ready ? "pointer" : "default"};
        display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:8px;
        padding:12px 8px;transition:transform 0.15s,box-shadow 0.15s;
        ${ready ? "box-shadow:0 0 16px #2266ff44;" : "opacity:0.5;"}
      `;
      if (ready) {
        card.onmouseenter = () => { card.style.transform = "scale(1.07)"; card.style.boxShadow = "0 0 28px #44aaffaa"; };
        card.onmouseleave = () => { card.style.transform = ""; card.style.boxShadow = "0 0 16px #2266ff44"; };
      }
      card.innerHTML = `
        <div style="font-size:36px;line-height:1;margin-top:2px;">${def.icon}</div>
        <div style="color:#ddeeff;font-size:13px;font-weight:700;text-align:center;min-height:34px;display:flex;align-items:center;justify-content:center;">${def.name}</div>
        <div style="color:#8899bb;font-size:11px;text-align:center;line-height:1.3;flex:1;display:flex;align-items:flex-start;justify-content:center;">${def.desc}</div>
        <div style="min-height:18px;color:#ff6644;font-size:12px;font-weight:600;text-align:center;">${!ready ? Math.ceil(cdReal) + "с" : "&nbsp;"}</div>
      `;
      if (ready) card.addEventListener("click", () => activateAbilityFromPicker(def));
      abilityCards.appendChild(card);
    }
    abilityOverlay.style.display = "flex";
  }

  function hideAbilityPicker() {
    if (abilityOverlay) abilityOverlay.style.display = "none";
  }

  function startAbilityTargeting(abilityId) {
    hideAbilityPicker();
    clearMobileAbilityConfirmation(false);
    state._abilityTargeting = abilityId;
    state._meteorTargeting = null;
    state._mobileAbilityLockedPreview = null;
    if (abilityId === "meteor") {
      state._meteorTargeting = { phase: "point", x: 0, y: 0, angle: 0 };
    }
    if (abilityId === METEOR_SWARM_ABILITY_ID) {
      state._meteorTargeting = { phase: "point", x: 0, y: 0, angle: 0 };
    }
    if (abilityId === "spatialRift") {
      state._meteorTargeting = { phase: "point", x: 0, y: 0, angle: 0 };
    }
    app.canvas.style.cursor = "crosshair";
    syncAbilityTargetHint();
  }

  function cancelAbilityTargeting() {
    clearMobileAbilityConfirmation(false);
    clearAbilityPreview();
    state._abilityTargeting = null;
    state._meteorTargeting = null;
    state._mobileAbilityLockedPreview = null;
    state._pendingAbilityCardInstanceId = null;
    const me = state.players.get(state.myPlayerId);
    if (me) me.pendingAbilityCardId = null;
    app.canvas.style.cursor = "";
    hideHudTooltip();
    setAbilityTargetHint("");
  }

  function _spawnIonNebulaLocal(wx, wy, ownerId, opts) {
    opts = opts || {};
    const stormRadius = Math.max(80, opts.radius || STORM_RADIUS);
    const stretch = 0.8 + Math.random() * 0.6;
    const rotAngle = Math.random() * Math.PI * 2;
    const blobCount = 4 + Math.floor(Math.random() * 3);
    const blobs = [];
    for (let i = 0; i < blobCount; i++) {
      const t = (i / (blobCount - 1)) - 0.5;
      blobs.push({
        ox: t * stormRadius * stretch * 0.9 + rand(-15, 15),
        oy: rand(-stormRadius * 0.25, stormRadius * 0.25),
        r: stormRadius * (0.45 + Math.random() * 0.25),
        _baseOx: 0, _baseOy: 0, _baseR: 0, _phase: i * 1.3
      });
    }
    for (const b of blobs) { b._baseOx = b.ox; b._baseOy = b.oy; b._baseR = b.r; }
    state._abilityStorms.push({
      x: wx, y: wy, vx: 0, vy: 0,
      spawnedAt: state.t, duration: toSimSeconds(opts.durationSec != null ? opts.durationSec : ION_NEBULA_DURATION_SEC), lastDmgTick: state.t,
      gfx: null, emojiContainer: null,
      rotAngle, stretch, blobs, lastDirChange: state.t, _finalBurstDone: false, ownerId,
      tickDamagePct: opts.tickDamagePct,
      finalBurstPct: opts.finalBurstPct
    });
  }

  function setAbilityCooldown(pid, abilityId, seconds) {
    if (!state._abilityCooldownsByPlayer[pid]) state._abilityCooldownsByPlayer[pid] = {};
    state._abilityCooldownsByPlayer[pid][abilityId] = toSimSeconds(seconds);
  }

  function spawnSpatialRiftLocal(wx, wy, angle, pid) {
    const api = getSpatialRiftAbilityApi();
    const effect = api && typeof api.buildEffect === "function"
      ? api.buildEffect(wx, wy, angle || 0, pid)
      : {
          type: "rift",
          x: wx,
          y: wy,
          angle: angle || 0,
          duration: 23.4,
          collapseAtSec: 18.15,
          radius: 180,
          length: 760,
          ownerId: pid
        };
    scaleTimingFields(effect, ["duration", "collapseAtSec"]);
    state._abilityZoneEffects.push({ ...effect, ownerId: pid, spawnedAt: state.t, gfx: null });
  }

  function useIonNebula(wx, wy, abilityId) {
    const castAbilityId = abilityId || "ionNebula";
    const def = ABILITY_DEFS.find(d => d.id === castAbilityId);
    const spawnOpts = castAbilityId === "ionField"
      ? { durationSec: 3 }
      : null;
    if (isServerAuthorityRemote()) {
      sendPlayerAction({ type: "useAbility", abilityId: castAbilityId, pid: state.myPlayerId, x: wx, y: wy });
    } else if (state._multiSlots && !state._multiIsHost && state._socket) {
      sendPlayerAction({ type: "useAbility", abilityId: castAbilityId, pid: state.myPlayerId, x: wx, y: wy });
    } else {
      _spawnIonNebulaLocal(wx, wy, state.myPlayerId, spawnOpts);
      setAbilityCooldown(state.myPlayerId, castAbilityId, def.cooldown);
      pushAbilityAnnouncement(state.myPlayerId, castAbilityId);
    }
    cancelAbilityTargeting();
  }

  const METEOR_RADIUS = 11;
  const METEOR_AOE_RADIUS = 120;
  const METEOR_PREVIEW_RADIUS = Math.round(METEOR_AOE_RADIUS * 1.25);
  const METEOR_SPEED_PX_PER_S = Math.hypot(CFG.WORLD_W, CFG.WORLD_H) / 11;
  const METEOR_IMPACT_DURATION = 1.85;
  const METEOR_SWARM_ABILITY_ID = "meteorSwarm";
  const METEOR_SWARM_BASE_SPEED_PX_PER_S = Math.hypot(CFG.WORLD_W, CFG.WORLD_H) / 19;
  const METEOR_STYLE_OBSIDIAN_CRIMSON = {
    void: 0x14060a,
    ash: 0x251015,
    corridor: 0x390912,
    crimson: 0x861629,
    crimsonHot: 0xb31e35,
    ember: 0xff7a24,
    emberHot: 0xffa34a,
    emberWhite: 0xffe2b5
  };

  function meteorHash01(seed) {
    const x = Math.sin(seed * 12.9898) * 43758.5453123;
    return x - Math.floor(x);
  }

  function getMeteorSwarmAbilityApi() {
    return (typeof MeteorSwarmAbility !== "undefined" && MeteorSwarmAbility) ? MeteorSwarmAbility : null;
  }

  function getSpatialRiftAbilityApi() {
    return (typeof SpatialRiftAbility !== "undefined" && SpatialRiftAbility) ? SpatialRiftAbility : null;
  }

  function getSpatialRiftRendererApi() {
    return (typeof SpatialRiftRenderer !== "undefined" && SpatialRiftRenderer) ? SpatialRiftRenderer : null;
  }

  function getThermoNukeAbilityApi() {
    return (typeof ThermoNukeAbility !== "undefined" && ThermoNukeAbility) ? ThermoNukeAbility : null;
  }

  function getThermoNukeRendererApi() {
    return (typeof ThermoNukeRenderer !== "undefined" && ThermoNukeRenderer) ? ThermoNukeRenderer : null;
  }

  function getGravAnchorAbilityApi() {
    return (typeof GravAnchorAbility !== "undefined" && GravAnchorAbility) ? GravAnchorAbility : null;
  }

  function getGravAnchorRendererApi() {
    return (typeof GravAnchorRenderer !== "undefined" && GravAnchorRenderer) ? GravAnchorRenderer : null;
  }

  function getNanoSwarmAbilityApi() {
    return (typeof NanoSwarmAbility !== "undefined" && NanoSwarmAbility) ? NanoSwarmAbility : null;
  }

  function getNanoSwarmRendererApi() {
    return (typeof NanoSwarmRenderer !== "undefined" && NanoSwarmRenderer) ? NanoSwarmRenderer : null;
  }

  function getPirateRaidAbilityApi() {
    return (typeof PirateRaidAbility !== "undefined" && PirateRaidAbility) ? PirateRaidAbility : null;
  }

  function getPirateRaidRendererApi() {
    return (typeof PirateRaidRenderer !== "undefined" && PirateRaidRenderer) ? PirateRaidRenderer : null;
  }

  function getEconomyAbilityRendererApi() {
    return (typeof EconomyAbilityRenderer !== "undefined" && EconomyAbilityRenderer) ? EconomyAbilityRenderer : null;
  }

  function isMeteorSwarmStyleKey(styleKey) {
    const api = getMeteorSwarmAbilityApi();
    return !!(api && styleKey && styleKey === api.STYLE_KEY);
  }

  function getMeteorVisualDetail() {
    const hasLod = typeof LOD !== "undefined" && LOD && typeof LOD.getLevel === "function" && LOD.LEVELS;
    const level = hasLod
      ? LOD.getLevel(cam.zoom || 0.22)
      : null;
    if (hasLod && level === LOD.LEVELS.FAR) {
      return {
        corridorFillAlpha: 0.05,
        corridorEdgeAlpha: 0.22,
        centerLineAlpha: 0.14,
        arrowSpacing: 0,
        trailSamples: 4,
        emberCount: 3,
        sparkCount: 2,
        shardCuts: 2,
        debrisCount: 5,
        ringCount: 2,
        trailMul: 0.24
      };
    }
    if (hasLod && level === LOD.LEVELS.MID) {
      return {
        corridorFillAlpha: 0.075,
        corridorEdgeAlpha: 0.32,
        centerLineAlpha: 0.19,
        arrowSpacing: 130,
        trailSamples: 6,
        emberCount: 5,
        sparkCount: 4,
        shardCuts: 3,
        debrisCount: 9,
        ringCount: 3,
        trailMul: 0.29
      };
    }
    return {
      corridorFillAlpha: 0.1,
      corridorEdgeAlpha: 0.44,
      centerLineAlpha: 0.26,
      arrowSpacing: 110,
      trailSamples: 8,
      emberCount: 7,
      sparkCount: 6,
      shardCuts: 4,
      debrisCount: 14,
      ringCount: 4,
      trailMul: 0.34
    };
  }

  function getMeteorAngle(m) {
    return m && m.angle != null ? m.angle : Math.atan2(m?.vy || 0, m?.vx || 1);
  }

  function getMeteorSeed(x, y, angle) {
    const sx = Math.round((x || 0) * 10);
    const sy = Math.round((y || 0) * 10);
    const sa = Math.round((angle || 0) * 1000);
    return ((sx * 73856093) ^ (sy * 19349663) ^ (sa * 83492791)) >>> 0;
  }

  function queueMeteorImpactEffect(m) {
    if (!m) return;
    if (!state._meteorImpactEffects) state._meteorImpactEffects = [];
    state._meteorImpactEffects.push({
      x: m.x,
      y: m.y,
      t0: state.t,
      duration: m.impactDuration || METEOR_IMPACT_DURATION,
      radius: m.aoeR || METEOR_AOE_RADIUS,
      angle: getMeteorAngle(m),
      seed: m.seed != null ? m.seed : getMeteorSeed(m.x, m.y, getMeteorAngle(m)),
      styleKey: m.styleKey || null,
      visualScale: m.visualScale || 1
    });
  }

  function getMeteorTurretHitRadius() {
    return 18;
  }

  function getMeteorPlanetImpactRadius(p) {
    if (!p) return 0;
    return (p.shieldHp || 0) > 0 ? shieldRadius(p) : getPlanetRadius(p) + 4;
  }

  function getMeteorAoeDamage(target) {
    const maxHp = Math.max(1, target?.maxHp || target?.hp || 1);
    return Math.max(1, Math.round(maxHp * 0.5 + 100));
  }

  function getMeteorSegmentCircleHit(ax, ay, bx, by, cx, cy, radius) {
    const r = Math.max(0.001, radius || 0);
    const startDx = ax - cx;
    const startDy = ay - cy;
    if (startDx * startDx + startDy * startDy <= r * r) {
      return { t: 0, x: ax, y: ay };
    }
    const dx = bx - ax;
    const dy = by - ay;
    const a = dx * dx + dy * dy;
    if (a <= 1e-6) return null;
    const b = 2 * (startDx * dx + startDy * dy);
    const c = startDx * startDx + startDy * startDy - r * r;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const sqrtDisc = Math.sqrt(disc);
    const t0 = (-b - sqrtDisc) / (2 * a);
    const t1 = (-b + sqrtDisc) / (2 * a);
    let t = null;
    if (t0 >= 0 && t0 <= 1) t = t0;
    else if (t1 >= 0 && t1 <= 1) t = t1;
    if (t == null) return null;
    return {
      t,
      x: ax + dx * t,
      y: ay + dy * t
    };
  }

  function findMeteorFirstImpactOnSegment(m, ax, ay, bx, by) {
    const meteorR = Math.max(2, m?.radius || METEOR_RADIUS);
    let best = null;

    const tryCandidate = (type, target, cx, cy, radius) => {
      const hit = getMeteorSegmentCircleHit(ax, ay, bx, by, cx, cy, radius + meteorR * 0.75);
      if (!hit) return;
      if (!best || hit.t < best.t) {
        best = { type, target, x: hit.x, y: hit.y, t: hit.t };
      }
    };

    for (const p of state.players.values()) {
      if (!p || p.eliminated) continue;
      tryCandidate("planet", p, p.x, p.y, getMeteorPlanetImpactRadius(p));
    }
    return best;
  }

  function collectMeteorUnitHitsOnSegment(m, ax, ay, bx, by, maxT = 1) {
    const meteorR = Math.max(2, m?.radius || METEOR_RADIUS);
    const hitIds = m._piercedUnitIds || (m._piercedUnitIds = new Set());
    const hits = [];
    for (const u of state.units.values()) {
      if (!u || u.hp <= 0 || hitIds.has(u.id)) continue;
      const hit = getMeteorSegmentCircleHit(ax, ay, bx, by, u.x, u.y, getUnitHitRadius(u) + meteorR * 0.75);
      if (!hit || hit.t > maxT) continue;
      hits.push({ type: "unit", target: u, x: hit.x, y: hit.y, t: hit.t });
    }
    hits.sort((a, b) => a.t - b.t);
    return hits;
  }

  function triggerMeteorPierceImpact(m, hit) {
    if (!m || !hit || !hit.target || hit.target.hp <= 0) return;
    if (!m._piercedUnitIds) m._piercedUnitIds = new Set();
    if (m._piercedUnitIds.has(hit.target.id)) return;
    m._piercedUnitIds.add(hit.target.id);
    queueMeteorImpactEffect({
      ...m,
      x: hit.x,
      y: hit.y
    });
    applyMeteorAoE(m, hit.x, hit.y);
  }

  function applyMeteorAoE(m, impactX, impactY) {
    const aoeR = m.aoeR || METEOR_AOE_RADIUS;
    const aoeR2 = aoeR * aoeR;
    for (const u of [...state.units.values()]) {
      if (!u || u.hp <= 0) continue;
      const dx = u.x - impactX;
      const dy = u.y - impactY;
      if (dx * dx + dy * dy > aoeR2) continue;
      const dmg = getMeteorAoeDamage(u);
      applyUnitDamage(u, dmg, m.ownerId);
      state.floatingDamage.push({ x: u.x, y: u.y - 15, text: "☄️ -" + dmg, color: 0xff7a24, ttl: 0.8 });
      if (u.hp <= 0) killUnit(u, "meteorAoE", m.ownerId);
    }
    for (const t of state.turrets.values()) {
      if (!t || t.hp <= 0) continue;
      const dx = t.x - impactX;
      const dy = t.y - impactY;
      if (dx * dx + dy * dy > aoeR2) continue;
      const dmg = getMeteorAoeDamage(t);
      t.hp = Math.max(0, t.hp - dmg);
      state.floatingDamage.push({ x: t.x, y: t.y - 12, text: "☄️ -" + dmg, color: 0xff7a24, ttl: 0.8 });
      if (t.hp <= 0) {
        t._diedAt = state.t;
        spawnXPOrb(t.x, t.y, 8);
      }
    }
  }

  function detonateMeteor(m, impact) {
    if (!m || !impact) return;
    m.x = impact.x;
    m.y = impact.y;
    if (!m._impactFx) {
      m._impactFx = true;
      queueMeteorImpactEffect(m);
    }
    if (impact.type === "planet") {
      const p = impact.target;
      if (p && !p.eliminated) {
        if ((p.shieldHp || 0) > 0) {
          const dmg = Math.max(1, Math.round((p.shieldMaxHp || p.shieldHp || 1) * 0.25));
          p.shieldHp = Math.max(0, p.shieldHp - dmg);
          if (p.shieldHp === 0) p.shieldRegenCd = SHIELD_REGEN_DELAY;
          pushShieldHitEffect(p.x, p.y, shieldRadius(p), impact.x, impact.y, 0xff6b8d);
          state.floatingDamage.push({ x: impact.x, y: impact.y - 10, text: "☄️🛡 -" + dmg, color: 0xff6b8d, ttl: 1.1 });
        } else {
          const popDmg = Math.max(2, Math.round((p.pop || 1) * 0.25));
          p.popFloat = Math.max(1, (p.popFloat || p.pop || 1) - popDmg);
          p.pop = Math.floor(p.popFloat);
          state.floatingDamage.push({ x: p.x, y: p.y - 36, text: "☄️ -" + popDmg, color: 0xff6b8d, ttl: 1.0 });
        }
      }
    }

    applyMeteorAoE(m, impact.x, impact.y);
    m.alive = false;
  }

  function drawMeteorCorridor(g, cx, cy, angle, halfW, detail, timeSec) {
    const diag = Math.hypot(CFG.WORLD_W, CFG.WORLD_H) + 400;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const sx = cx - cosA * diag;
    const sy = cy - sinA * diag;
    const ex = cx + cosA * diag;
    const ey = cy + sinA * diag;
    const nx = -sinA * halfW;
    const ny = cosA * halfW;

    g.beginFill(METEOR_STYLE_OBSIDIAN_CRIMSON.corridor, detail.corridorFillAlpha * 0.22);
    g.moveTo(sx + nx, sy + ny);
    g.lineTo(ex + nx, ey + ny);
    g.lineTo(ex - nx, ey - ny);
    g.lineTo(sx - nx, sy - ny);
    g.closePath();
    g.endFill();

    g.lineStyle(1.8, METEOR_STYLE_OBSIDIAN_CRIMSON.crimsonHot, detail.corridorEdgeAlpha);
    g.moveTo(sx + nx, sy + ny);
    g.lineTo(ex + nx, ey + ny);
    g.moveTo(sx - nx, sy - ny);
    g.lineTo(ex - nx, ey - ny);

    g.lineStyle(1.1, METEOR_STYLE_OBSIDIAN_CRIMSON.ash, detail.centerLineAlpha * 0.42);
    g.moveTo(sx + nx * 0.2, sy + ny * 0.2);
    g.lineTo(ex + nx * 0.2, ey + ny * 0.2);
    g.moveTo(sx - nx * 0.2, sy - ny * 0.2);
    g.lineTo(ex - nx * 0.2, ey - ny * 0.2);

    g.lineStyle(1.15, METEOR_STYLE_OBSIDIAN_CRIMSON.ember, detail.centerLineAlpha);
    g.moveTo(sx, sy);
    g.lineTo(ex, ey);

    if (detail.arrowSpacing > 0) {
      const arrowSize = 12;
      for (let d = 60; d < diag; d += detail.arrowSpacing) {
        const ax = cx + cosA * d;
        const ay = cy + sinA * d;
        if (ax < -120 || ax > CFG.WORLD_W + 120 || ay < -120 || ay > CFG.WORLD_H + 120) continue;
        const pulse = 0.24 + 0.16 * Math.sin(timeSec * 7 + d * 0.012);
        g.lineStyle(2.1, METEOR_STYLE_OBSIDIAN_CRIMSON.emberHot, pulse);
        g.moveTo(ax - cosA * arrowSize + nx * 0.42, ay - sinA * arrowSize + ny * 0.42);
        g.lineTo(ax, ay);
        g.lineTo(ax - cosA * arrowSize - nx * 0.42, ay - sinA * arrowSize - ny * 0.42);
      }
    }

    return { sx, sy, ex, ey, nx, ny, cosA, sinA };
  }

  function drawObsidianMeteorProjectile(g, m, detail, timeSec) {
    const angle = getMeteorAngle(m);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const nx = -sinA;
    const ny = cosA;
    const radius = (m.radius || METEOR_RADIUS) * (m.visualScale || 1.16);
    const speed = Math.hypot(m.vx || 0, m.vy || 0) || METEOR_SPEED_PX_PER_S;
    const trailLen = Math.min(280, Math.max(92, speed * detail.trailMul));
    const pulse = 0.76 + 0.24 * Math.sin(timeSec * 13 + (m.seed || 0) * 0.0004);

    for (let s = 0; s < detail.trailSamples; s++) {
      const f = detail.trailSamples <= 1 ? 0 : s / (detail.trailSamples - 1);
      const layerLen = trailLen * (0.42 + (1 - f) * 0.42);
      const tailW = radius * (1.8 - f * 0.45);
      const tipX = m.x + cosA * radius * 0.18;
      const tipY = m.y + sinA * radius * 0.18;
      const bx = m.x - cosA * layerLen;
      const by = m.y - sinA * layerLen;
      const mx1 = m.x - cosA * (layerLen * 0.42) + nx * tailW * 0.62;
      const my1 = m.y - sinA * (layerLen * 0.42) + ny * tailW * 0.62;
      const mx2 = m.x - cosA * (layerLen * 0.58) - nx * tailW * 0.62;
      const my2 = m.y - sinA * (layerLen * 0.58) - ny * tailW * 0.62;
      g.beginFill(s === 0 ? METEOR_STYLE_OBSIDIAN_CRIMSON.crimson : METEOR_STYLE_OBSIDIAN_CRIMSON.ash, (1 - f) * 0.12 * pulse);
      g.moveTo(tipX, tipY);
      g.lineTo(mx1, my1);
      g.lineTo(bx, by);
      g.lineTo(mx2, my2);
      g.closePath();
      g.endFill();
    }

    for (let i = 0; i < detail.sparkCount; i++) {
      const seed = (m.seed || 1) + i * 17.13;
      const back = trailLen * (0.16 + meteorHash01(seed + 2) * 0.58);
      const side = (meteorHash01(seed + 4) - 0.5) * radius * 3.4;
      const len = radius * (0.55 + meteorHash01(seed + 6) * 0.9);
      const px = m.x - cosA * back + nx * side;
      const py = m.y - sinA * back + ny * side;
      const ex = px - cosA * len * 0.85;
      const ey = py - sinA * len * 0.85;
      g.lineStyle(1.1 + meteorHash01(seed + 8) * 1.1, METEOR_STYLE_OBSIDIAN_CRIMSON.emberHot, 0.24 + meteorHash01(seed + 10) * 0.28);
      g.moveTo(px, py);
      g.lineTo(ex, ey);
    }

    const bodyBackX = m.x - cosA * radius * 1.75;
    const bodyBackY = m.y - sinA * radius * 1.75;
    const bodyFrontX = m.x + cosA * radius * 0.96;
    const bodyFrontY = m.y + sinA * radius * 0.96;
    g.lineStyle(Math.max(3, radius * 2.35), METEOR_STYLE_OBSIDIAN_CRIMSON.void, 0.96);
    g.moveTo(bodyBackX, bodyBackY);
    g.lineTo(bodyFrontX, bodyFrontY);
    g.lineStyle(Math.max(2, radius * 1.46), METEOR_STYLE_OBSIDIAN_CRIMSON.crimson, 0.92);
    g.moveTo(bodyBackX + cosA * radius * 0.2, bodyBackY + sinA * radius * 0.2);
    g.lineTo(bodyFrontX, bodyFrontY);
    g.lineStyle(Math.max(1.5, radius * 0.74), METEOR_STYLE_OBSIDIAN_CRIMSON.ember, 0.96);
    g.moveTo(m.x - cosA * radius * 0.34, m.y - sinA * radius * 0.34);
    g.lineTo(bodyFrontX + cosA * radius * 0.18, bodyFrontY + sinA * radius * 0.18);

    for (let i = 0; i < detail.shardCuts; i++) {
      const frac = detail.shardCuts <= 1 ? 0.5 : i / (detail.shardCuts - 1);
      const jitter = (meteorHash01((m.seed || 1) + i * 9.7) - 0.5) * radius * 0.28;
      const cx = m.x - cosA * radius * (1.18 - frac * 1.38) + nx * jitter * 0.4;
      const cy = m.y - sinA * radius * (1.18 - frac * 1.38) + ny * jitter * 0.4;
      const half = radius * (0.34 + meteorHash01((m.seed || 1) + i * 11.2) * 0.36);
      g.lineStyle(Math.max(1, radius * 0.14), frac > 0.56 ? METEOR_STYLE_OBSIDIAN_CRIMSON.emberHot : METEOR_STYLE_OBSIDIAN_CRIMSON.crimsonHot, 0.42 + frac * 0.18);
      g.moveTo(cx - nx * half, cy - ny * half);
      g.lineTo(cx + nx * half, cy + ny * half);
    }

    const headX = m.x + cosA * radius * 0.92;
    const headY = m.y + sinA * radius * 0.92;
    g.beginFill(METEOR_STYLE_OBSIDIAN_CRIMSON.emberHot, 0.92);
    g.drawCircle(headX, headY, radius * 0.56);
    g.endFill();
    g.beginFill(METEOR_STYLE_OBSIDIAN_CRIMSON.emberWhite, 0.82);
    g.drawCircle(headX + cosA * radius * 0.08, headY + sinA * radius * 0.08, radius * 0.26);
    g.endFill();

    for (let i = 0; i < detail.emberCount; i++) {
      const seed = (m.seed || 1) + i * 23.7;
      const back = radius * (0.35 + meteorHash01(seed + 1) * 2.2);
      const side = (meteorHash01(seed + 2) - 0.5) * radius * 2.8;
      const px = m.x - cosA * back + nx * side;
      const py = m.y - sinA * back + ny * side;
      const pr = radius * (0.08 + meteorHash01(seed + 3) * 0.16);
      const col = meteorHash01(seed + 4) > 0.55 ? METEOR_STYLE_OBSIDIAN_CRIMSON.emberHot : METEOR_STYLE_OBSIDIAN_CRIMSON.crimsonHot;
      g.beginFill(col, 0.24 + meteorHash01(seed + 5) * 0.26);
      g.drawCircle(px, py, pr);
      g.endFill();
    }
  }

  function drawOrbitalProjectile(g, m, timeSec) {
    const angle = getMeteorAngle(m);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const speed = Math.hypot(m.vx || 0, m.vy || 0) || 1;
    const trailLen = Math.min(170, Math.max(70, speed * 0.2));
    const pulse = 0.7 + 0.3 * Math.sin(timeSec * 15 + m.x * 0.01);
    g.lineStyle(10, 0x6f1b1d, 0.16 * pulse);
    g.moveTo(m.x, m.y);
    g.lineTo(m.x - cosA * trailLen, m.y - sinA * trailLen);
    g.lineStyle(5.2, 0xff7a24, 0.42 * pulse);
    g.moveTo(m.x, m.y);
    g.lineTo(m.x - cosA * trailLen * 0.6, m.y - sinA * trailLen * 0.6);
    g.beginFill(0xffa34a, 0.94);
    g.drawCircle(m.x, m.y, 6.5);
    g.endFill();
    g.beginFill(0xfff1d0, 0.78);
    g.drawCircle(m.x, m.y, 2.5);
    g.endFill();
  }

  function getMeteorVisualScale(aoeRadius) {
    return Math.max(1, (aoeRadius || METEOR_AOE_RADIUS) / Math.max(1, METEOR_AOE_RADIUS));
  }

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
    const aoeRadius = METEOR_PREVIEW_RADIUS;
    state._activeMeteors.push({
      x: sx, y: sy,
      vx: Math.cos(angle) * METEOR_SPEED_PX_PER_S,
      vy: Math.sin(angle) * METEOR_SPEED_PX_PER_S,
      angle,
      radius: METEOR_RADIUS,
      aoeR: aoeRadius,
      ownerId: ownerId === undefined ? state.myPlayerId : ownerId,
      alive: true,
      gfx: null,
      trajGfx: null,
      spawnedAt: state.t,
      impactDuration: METEOR_IMPACT_DURATION,
      styleKey: "signal-bloom",
      visualScale: getMeteorVisualScale(aoeRadius),
      seed: getMeteorSeed(targetX, targetY, angle)
    });
  }

  function getMeteorSwarmPreview(targetX, targetY, ownerId, angle) {
    const api = getMeteorSwarmAbilityApi();
    if (!api || typeof api.buildCast !== "function") return null;
    return api.buildCast(targetX, targetY, ownerId == null ? state.myPlayerId : ownerId, {
      worldW: CFG.WORLD_W,
      worldH: CFG.WORLD_H,
      baseSpeed: METEOR_SWARM_BASE_SPEED_PX_PER_S,
      baseAngle: angle
    });
  }

  function _spawnMeteorSwarmLocal(targetX, targetY, angle, ownerId) {
    const built = getMeteorSwarmPreview(targetX, targetY, ownerId, angle);
    if (!built || !Array.isArray(built.shots) || built.shots.length === 0) return;
    const resolvedOwnerId = ownerId === undefined ? state.myPlayerId : ownerId;
    for (const shot of built.shots) {
      state._activeMeteors.push({
        x: shot.x,
        y: shot.y,
        vx: shot.vx,
        vy: shot.vy,
        angle: shot.angle,
        radius: shot.radius,
        aoeR: shot.aoeR,
        ownerId: resolvedOwnerId,
        alive: true,
        gfx: null,
        trajGfx: null,
        spawnedAt: state.t,
        impactDuration: shot.impactDuration || METEOR_IMPACT_DURATION,
        styleKey: shot.styleKey,
        visualScale: shot.visualScale,
        seed: shot.seed
      });
    }
  }

  function useMeteor(targetX, targetY, angle) {
    const def = ABILITY_DEFS.find(d => d.id === "meteor");
    if (isServerAuthorityRemote()) {
      sendPlayerAction({ type: "useAbility", abilityId: "meteor", pid: state.myPlayerId, x: targetX, y: targetY, angle });
    } else if (state._multiSlots && !state._multiIsHost && state._socket) {
      sendPlayerAction({ type: "useAbility", abilityId: "meteor", pid: state.myPlayerId, x: targetX, y: targetY, angle });
    } else {
      _spawnMeteorLocal(targetX, targetY, angle, state.myPlayerId);
      setAbilityCooldown(state.myPlayerId, "meteor", def.cooldown);
      pushAbilityAnnouncement(state.myPlayerId, "meteor");
    }
    cancelAbilityTargeting();
  }

  const MINEFIELD_SMALL_ID = "minefield";
  const MINEFIELD_LARGE_ID = "minefieldLarge";
  const ORBITAL_BARRAGE_ID = "orbitalBarrage";
  const MINEFIELD_PREVIEW_DARKEN_ALPHA = 0.72;
  const MINEFIELD_BLAST_FADE_SEC = 0.95;

  function getOrbitalStrikeConfig(abilityId, strikeLike) {
    const resolvedId = abilityId || strikeLike?.abilityId || "orbitalStrike";
    if (resolvedId === ORBITAL_BARRAGE_ID) {
      return {
        abilityId: ORBITAL_BARRAGE_ID,
        zoneRadius: 156,
        primaryRadius: 84,
        supportRadius: 72,
        damageBase: 10,
        damageMaxHpPct: 0.06,
        flightDurationSec: 6.0,
        flightVarianceSec: 0.55,
        shotIntervalSec: 0.08,
        salvoGapSec: 2.0,
        impactFadeSec: 1.0,
        salvoCount: 10,
        shotsPerSalvo: 5
      };
    }
    return {
      abilityId: "orbitalStrike",
      zoneRadius: 128,
      primaryRadius: 90,
      supportRadius: 78,
      damageBase: 12,
      damageMaxHpPct: 0.08,
      flightDurationSec: 4.9,
      flightVarianceSec: 0.35,
      shotIntervalSec: 0.06,
      salvoGapSec: 1.05,
      impactFadeSec: 1.0,
      salvoCount: 2,
      shotsPerSalvo: 5
    };
  }

  function getOrbitalStrikeTotalDuration(cfg) {
    return cfg.salvoGapSec * Math.max(0, cfg.salvoCount - 1) +
      cfg.flightDurationSec + cfg.flightVarianceSec +
      cfg.impactFadeSec +
      0.26;
  }

  function getMinefieldConfig(abilityId) {
    if (abilityId === MINEFIELD_LARGE_ID) {
      return {
        abilityId: MINEFIELD_LARGE_ID,
        mineCount: 25,
        duration: toSimSeconds(800),
        armDelay: toSimSeconds(0.35),
        triggerRadius: 13,
        blastRadius: 92,
        damageBase: 26,
        damageMaxHpPct: 0.13,
        blinkSpeed: 9.6,
        previewHalfForward: 96,
        previewHalfSide: 42,
        forwardJitter: 18,
        depthJitterFrac: 0.14,
        sideTightness: 0.56,
        minSpacing: 12
      };
    }
    return {
      abilityId: MINEFIELD_SMALL_ID,
      mineCount: 5,
      duration: toSimSeconds(800),
      armDelay: toSimSeconds(0.35),
      triggerRadius: 14,
      blastRadius: 84,
      damageBase: 22,
      damageMaxHpPct: 0.11,
      blinkSpeed: 7.8,
      previewHalfForward: 60,
      previewHalfSide: 30,
      forwardJitter: 10,
      depthJitterFrac: 0.10,
      sideTightness: 0.48,
      minSpacing: 22
    };
  }

  function getOrbitalStrikeDamage(target, strikeLike) {
    const cfg = getOrbitalStrikeConfig(strikeLike?.abilityId, strikeLike);
    const maxHp = Math.max(1, target?.maxHp || target?.shieldMaxHp || target?.hp || target?.pop || 1);
    return Math.max(1, Math.round((strikeLike?.damageBase ?? cfg.damageBase) + maxHp * (strikeLike?.damageMaxHpPct ?? cfg.damageMaxHpPct)));
  }

  function getOrbitalStrikeOwnerCore(ownerId, fallbackX, fallbackY) {
    const owner = state.players.get(ownerId);
    if (owner && !owner.eliminated) return { x: owner.x, y: owner.y };
    return { x: fallbackX, y: fallbackY };
  }

  function buildOrbitalSalvoTargets(zoneX, zoneY, seed, salvoIndex, cfg) {
    if ((cfg.shotsPerSalvo || 1) <= 1) {
      return [{ primary: true, tx: zoneX, ty: zoneY, radius: cfg.primaryRadius }];
    }
    const targets = [];
    for (let shotIndex = 0; shotIndex < cfg.shotsPerSalvo; shotIndex++) {
      const shotSeed = seed + salvoIndex * 181 + shotIndex * 47 + 19;
      const ang = meteorHash01(shotSeed + 1) * Math.PI * 2;
      const rr = cfg.zoneRadius * (0.14 + Math.pow(meteorHash01(shotSeed + 2), 0.72) * 0.72);
      targets.push({
        primary: shotIndex === 0,
        tx: zoneX + Math.cos(ang) * rr,
        ty: zoneY + Math.sin(ang) * rr * 0.74,
        radius: shotIndex === 0 ? cfg.primaryRadius : cfg.supportRadius
      });
    }
    return targets;
  }

  function getOrbitalPreviewSalvo(ownerId, zoneX, zoneY, abilityId) {
    const cfg = getOrbitalStrikeConfig(abilityId);
    const seed = getMeteorSeed(zoneX, zoneY, ownerId || 0);
    return {
      seed,
      radius: cfg.zoneRadius,
      targets: buildOrbitalSalvoTargets(zoneX, zoneY, seed, 0, cfg)
    };
  }

  function drawOrbitalPreviewFallback(g, cx, cy, radius, shots, timeSec, active) {
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * (active ? 1.15 : 1.45));
    const outerAlpha = active ? (0.34 + pulse * 0.10) : (0.54 + pulse * 0.18);
    const midAlpha = active ? (0.20 + pulse * 0.07) : (0.28 + pulse * 0.10);
    const innerAlpha = active ? (0.12 + pulse * 0.05) : (0.17 + pulse * 0.06);

    g.circle(cx, cy, radius);
    g.stroke({ color: 0xffe1ea, width: active ? 3.2 : 5.2, alpha: outerAlpha });
    g.circle(cx, cy, radius * 0.82);
    g.stroke({ color: 0xff8aa5, width: active ? 1.8 : 2.6, alpha: midAlpha });
    g.circle(cx, cy, radius * 0.62);
    g.stroke({ color: 0xff6b8d, width: active ? 1.0 : 1.4, alpha: innerAlpha });

    const bracketR = radius * 0.84;
    const bracketLen = radius * 0.10;
    const bracketWidth = active ? 1.5 : 2.1;
    const bracketAlpha = active ? 0.18 + pulse * 0.05 : 0.32 + pulse * 0.08;
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1]
    ];
    for (const [sx, sy] of corners) {
      const px = cx + sx * bracketR;
      const py = cy + sy * bracketR;
      g.moveTo(px, py + sy * bracketLen);
      g.lineTo(px, py);
      g.lineTo(px + sx * bracketLen, py);
      g.stroke({ color: 0xffe1ea, width: bracketWidth, alpha: bracketAlpha });
    }

    for (const shot of shots || []) {
      const outerW = shot.primary ? (active ? 1.5 : 1.9) : (active ? 1.1 : 1.4);
      const innerW = shot.primary ? (active ? 1.0 : 1.2) : (active ? 0.8 : 0.95);
      const shotAlpha = active ? (0.18 + pulse * 0.05) : (0.42 + pulse * 0.08);
      const shotColor = shot.primary ? 0xffe1ea : 0xff8aa5;
      g.circle(shot.tx, shot.ty, shot.radius);
      g.stroke({ color: shotColor, width: outerW, alpha: shotAlpha });
      g.circle(shot.tx, shot.ty, shot.radius * 0.72);
      g.stroke({ color: 0xffe1ea, width: innerW, alpha: shotAlpha * 0.7 });
    }
  }

  function drawOrbitalImpactFlashFallback(g, cx, cy, radius, timeSec, fadeAlpha) {
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 12.5 + cx * 0.013 + cy * 0.011);
    const outerR = radius * (0.82 + pulse * 0.22);
    const innerR = radius * (0.42 + pulse * 0.10);
    g.circle(cx, cy, outerR);
    g.stroke({ color: 0xffe1ea, width: 2.4, alpha: 0.34 * fadeAlpha });
    g.circle(cx, cy, innerR);
    g.stroke({ color: 0xff6b8d, width: 1.5, alpha: 0.40 * fadeAlpha });
    g.circle(cx, cy, Math.max(4, radius * 0.18));
    g.fill({ color: 0xffd7df, alpha: 0.26 * fadeAlpha });
  }

  function getRotatedRectCorners(cx, cy, halfForward, halfSide, angle) {
    const fx = Math.cos(angle || 0);
    const fy = Math.sin(angle || 0);
    const sx = -fy;
    const sy = fx;
    return [
      { x: cx - sx * halfSide - fx * halfForward, y: cy - sy * halfSide - fy * halfForward },
      { x: cx + sx * halfSide - fx * halfForward, y: cy + sy * halfSide - fy * halfForward },
      { x: cx + sx * halfSide + fx * halfForward, y: cy + sy * halfSide + fy * halfForward },
      { x: cx - sx * halfSide + fx * halfForward, y: cy - sy * halfSide + fy * halfForward }
    ];
  }

  function drawRotatedSquare(g, corners, color, fillAlpha, strokeAlpha, lineWidth) {
    if (!Array.isArray(corners) || corners.length < 4) return;
    g.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) g.lineTo(corners[i].x, corners[i].y);
    g.closePath();
    g.fill({ color, alpha: fillAlpha });
    g.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) g.lineTo(corners[i].x, corners[i].y);
    g.closePath();
    g.stroke({ color, width: lineWidth, alpha: strokeAlpha, join: "round" });
  }

  function drawClosedPolygon(g, points, color, fillAlpha, strokeAlpha, lineWidth = 2) {
    if (!Array.isArray(points) || points.length < 3) return;
    g.moveTo(points[0].x || 0, points[0].y || 0);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x || 0, points[i].y || 0);
    g.closePath();
    g.fill({ color, alpha: fillAlpha });
    g.moveTo(points[0].x || 0, points[0].y || 0);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x || 0, points[i].y || 0);
    g.closePath();
    g.stroke({ color, width: lineWidth, alpha: strokeAlpha, join: "round" });
  }

  function drawMeteorPreviewGuideLine(g, ax, ay, bx, by, color = 0xffc6d2, alpha = 0.34, opts = null) {
    if (!g) return;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len <= 1e-3) return;
    const lineBackWidth = opts?.backWidth ?? 8;
    const lineWidth = opts?.lineWidth ?? 3.2;
    const arrowLen = opts?.arrowLen ?? 18;
    const arrowHalfW = opts?.arrowHalfW ?? 8;
    const arrowInset = opts?.arrowInset ?? 6;
    const forcedArrowCount = opts?.arrowCount ?? null;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.stroke({ color: 0x16080f, width: lineBackWidth, alpha: alpha * 0.32, cap: "round", join: "round" });
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.stroke({ color, width: lineWidth, alpha, cap: "round", join: "round" });
    const arrowCount = forcedArrowCount != null ? forcedArrowCount : (len > 1200 ? 4 : len > 700 ? 3 : len > 320 ? 2 : 1);
    for (let i = 0; i < arrowCount; i++) {
      const frac = arrowCount === 1 ? 0.58 : (0.28 + i * (0.46 / Math.max(1, arrowCount - 1)));
      const cx = ax + dx * frac;
      const cy = ay + dy * frac;
      const tipX = cx + ux * arrowLen;
      const tipY = cy + uy * arrowLen;
      const baseX = cx - ux * arrowInset;
      const baseY = cy - uy * arrowInset;
      g.moveTo(tipX, tipY);
      g.lineTo(baseX + nx * arrowHalfW, baseY + ny * arrowHalfW);
      g.lineTo(baseX - nx * arrowHalfW, baseY - ny * arrowHalfW);
      g.closePath();
      g.fill({ color, alpha: alpha * 0.9 });
    }
    g.circle(bx, by, 5.5);
    g.fill({ color, alpha: alpha * 0.75 });
  }

  function collectMeteorPreviewUnitsOnSegment(ax, ay, bx, by, meteorRadius, ownerId) {
    const hits = [];
    const seen = new Set();
    for (const u of state.units.values()) {
      if (!u || u.hp <= 0 || seen.has(u.id)) continue;
      if (ownerId != null && u.owner === ownerId) continue;
      const d = distToSegment(u.x, u.y, ax, ay, bx, by);
      const hitR = getUnitHitRadius(u) + Math.max(2, meteorRadius || METEOR_RADIUS) * 0.75;
      if (d > hitR) continue;
      seen.add(u.id);
      hits.push(u);
    }
    return hits;
  }

  function appendUnitsInRadius(list, cx, cy, radius, ownerId) {
    const seen = new Set(list.map((u) => u.id));
    for (const u of state.units.values()) {
      if (!u || u.hp <= 0 || seen.has(u.id)) continue;
      if (ownerId != null && u.owner === ownerId) continue;
      const hitR = radius + getUnitHitRadius(u);
      const dx = u.x - cx;
      const dy = u.y - cy;
      if (dx * dx + dy * dy > hitR * hitR) continue;
      seen.add(u.id);
      list.push(u);
    }
  }

  function drawMeteorPreviewAffectedUnits(g, units, color = 0xff8aa5) {
    if (!g || !Array.isArray(units)) return;
    const pulse = 0.5 + 0.5 * Math.sin((performance.now() / 1000) * 5.2);
    for (const u of units) {
      if (!u || u.hp <= 0) continue;
      const r = getUnitHitRadius(u) + 7;
      g.circle(u.x, u.y, r * 0.92);
      g.fill({ color, alpha: 0.08 + pulse * 0.05 });
      g.circle(u.x, u.y, r);
      g.stroke({ color, width: 2.2, alpha: 0.52 + pulse * 0.22 });
      g.circle(u.x, u.y, r + 5);
      g.stroke({ color: 0xffc4c4, width: 1.2, alpha: 0.22 + pulse * 0.10 });
    }
  }

  function isMinefieldPointValid(option, owner, x, y, pad = 2) {
    const laneSample = projectPointOnPolyline(option.points, x, y);
    if (!laneSample || laneSample.dist > option.laneHalfWidth - pad) return false;
    return !!(owner && owner.influencePolygon && isPointInPolygon(x, y, owner.influencePolygon));
  }

  function getMinefieldSideRatios(cfg) {
    if ((cfg.mineCount || 0) >= 20) return [0, -0.18, 0.18, -0.34, 0.34, -0.50, 0.50, -0.66, 0.66];
    return [0, -0.18, 0.18, -0.34, 0.34, -0.50, 0.50];
  }

  function getMinefieldSearchOffsets(cfg, forwardStep) {
    const out = [0];
    const forwardMax = (cfg.mineCount || 0) >= 20 ? 340 : 210;
    const backwardMax = (cfg.mineCount || 0) >= 20 ? 120 : 70;
    for (let d = forwardStep; d <= forwardMax; d += forwardStep) out.push(d);
    for (let d = forwardStep; d <= backwardMax; d += forwardStep) out.push(-d);
    return out;
  }

  function buildMinefieldPlacementCandidate(owner, option, cfg, anchorProgress, targetX, targetY) {
    const totalLen = Math.max(1, option.totalLen || polylineLength(option.points));
    const clampedProgress = Math.max(0, Math.min(totalLen, anchorProgress || 0));
    const anchorPoint = samplePolylineAtDistance(option.points, clampedProgress);
    const angle = anchorPoint.angle != null ? anchorPoint.angle : option.angle || 0;
    const halfSide = Math.max(16, Math.min(cfg.previewHalfSide || 28, option.laneHalfWidth - 12));
    const halfForward = Math.max(20, cfg.previewHalfForward || 48);
    const centerX = anchorPoint.x;
    const centerY = anchorPoint.y;
    const corners = getRotatedRectCorners(centerX, centerY, halfForward, halfSide, angle);
    const centerOk = isMinefieldPointValid(option, owner, centerX, centerY, 6);
    const candidate = {
      ownerId: owner.id,
      option,
      config: cfg,
      centerX,
      centerY,
      angle,
      anchorProgress: clampedProgress,
      halfSide,
      halfForward,
      corners,
      corridorOk: centerOk,
      zoneOk: !!(owner.influencePolygon && isPointInPolygon(centerX, centerY, owner.influencePolygon)),
      dist: 0,
      snapDist: 0
    };
    candidate.previewMines = buildMinefieldLayout(candidate, targetX, targetY);
    candidate.corridorOk = candidate.previewMines.length > 0;
    candidate.zoneOk = candidate.previewMines.length > 0;
    candidate.centerOk = centerOk;
    candidate.valid = centerOk && candidate.previewMines.length === cfg.mineCount;
    return candidate;
  }

  function findNearestValidMinefieldPlacement(owner, option, cfg, baseProgress, targetX, targetY) {
    const totalLen = Math.max(1, option.totalLen || polylineLength(option.points));
    const maxOffset = Math.min(totalLen, Math.max(120, (cfg.previewHalfForward || 48) * 2.2));
    const step = cfg.mineCount >= 20 ? 18 : 22;
    let bestValid = null;
    let fallback = null;
    for (let offset = 0; offset <= maxOffset; offset += step) {
      const offsets = offset === 0 ? [0] : [-offset, offset];
      for (const delta of offsets) {
        const candidate = buildMinefieldPlacementCandidate(owner, option, cfg, baseProgress + delta, targetX, targetY);
        candidate.snapDist = Math.abs(delta);
        if (!fallback || candidate.snapDist < fallback.snapDist) fallback = candidate;
        if (!candidate.valid) continue;
        if (!bestValid || candidate.snapDist < bestValid.snapDist) bestValid = candidate;
      }
      if (bestValid && bestValid.snapDist <= step) break;
    }
    return bestValid || fallback;
  }

  function getMinefieldAvailabilityPreview(ownerId, abilityId) {
    const owner = state.players.get(ownerId);
    if (!owner) return null;
    const cacheBucket = Math.floor((state.t || 0) * 3);
    const cacheKey = ownerId + ":" + abilityId + ":" + cacheBucket;
    const cached = state._minefieldAvailabilityPreviewCache;
    if (cached && cached.key === cacheKey) return cached.data;
    const cfg = getMinefieldConfig(abilityId);
    const options = getLaneAbilityFrontOptions(ownerId);
    const data = {
      ownerPolygon: owner.influencePolygon || [],
      options: []
    };
    for (const option of options) {
      const totalLen = Math.max(1, option.totalLen || polylineLength(option.points));
      const step = cfg.mineCount >= 20 ? 34 : 40;
      const validSegments = [];
      let validPointCount = 0;
      let current = [];
      for (let progress = 0; progress <= totalLen; progress += step) {
        const sample = samplePolylineAtDistance(option.points, progress);
        const candidate = buildMinefieldPlacementCandidate(owner, option, cfg, progress, sample.x, sample.y);
        if (candidate.centerOk) {
          validPointCount += 1;
          current.push({ x: candidate.centerX, y: candidate.centerY });
        } else if (current.length) {
          validSegments.push(current);
          current = [];
        }
      }
      if (current.length) validSegments.push(current);
      data.options.push({
        frontType: option.frontType,
        laneHalfWidth: option.laneHalfWidth,
        validPointCount,
        validSegments
      });
    }
    state._minefieldAvailabilityPreviewCache = { key: cacheKey, data };
    return data;
  }

  function buildMinefieldLayout(placement, targetX, targetY) {
    if (!placement || !placement.option) return [];
    const cfg = placement.config;
    const owner = state.players.get(placement.ownerId);
    if (!owner) return [];
    const option = placement.option;
    const halfSide = Math.max(12, placement.halfSide || cfg.previewHalfSide || 24);
    const halfForward = Math.max(18, placement.halfForward || cfg.previewHalfForward || 42);
    const pad = 2;
    const sideLimit = Math.max(8, Math.min(option.laneHalfWidth - pad, halfSide) - Math.max(cfg.triggerRadius || 10, 8) - 1);
    const totalLen = Math.max(1, option.totalLen || polylineLength(option.points));
    const anchorProgress = Math.max(0, Math.min(totalLen, placement.anchorProgress != null ? placement.anchorProgress : 0));
    const layout = [];
    const sideRatios = getMinefieldSideRatios(cfg);
    const forwardStep = Math.max(10, Math.min(20, (cfg.minSpacing || 12) * ((cfg.mineCount || 0) >= 20 ? 0.85 : 1.0)));
    const searchOffsets = getMinefieldSearchOffsets(cfg, forwardStep);
    for (const forwardOffset of searchOffsets) {
      const laneProgress = Math.max(0, Math.min(totalLen, anchorProgress + forwardOffset));
      const lanePoint = samplePolylineAtDistance(option.points, laneProgress);
      const localAngle = lanePoint.angle != null ? lanePoint.angle : (placement.angle || 0);
      const nx = -Math.sin(localAngle);
      const ny = Math.cos(localAngle);
      for (const ratio of sideRatios) {
        const sideOffset = ratio * sideLimit * (cfg.sideTightness || 0.5) * 1.8;
        const px = lanePoint.x + nx * sideOffset;
        const py = lanePoint.y + ny * sideOffset;
        if (!isMinefieldPointValid(option, owner, px, py, pad)) continue;
        const tooClose = layout.some((mine) => {
          const dx = mine.x - px;
          const dy = mine.y - py;
          return dx * dx + dy * dy < (cfg.minSpacing || 12) * (cfg.minSpacing || 12);
        });
        if (tooClose) continue;
        layout.push({ x: px, y: py });
        if (layout.length >= cfg.mineCount) return layout;
      }
    }
    return layout;
  }

  function getMinefieldPlacement(ownerId, targetX, targetY, abilityId) {
    const owner = state.players.get(ownerId);
    if (!owner || !owner.influencePolygon || owner.influencePolygon.length < 3) return null;
    const cfg = getMinefieldConfig(abilityId);
    const options = getLaneAbilityFrontOptions(ownerId);
    let best = null;
    for (const option of options) {
      const sample = projectPointOnPolyline(option.points, targetX || 0, targetY || 0);
      if (!sample) continue;
      const anchorProgress = Math.max(0, Math.min(option.totalLen || polylineLength(option.points), sample.progress));
      const candidate = findNearestValidMinefieldPlacement(owner, option, cfg, anchorProgress, targetX, targetY) || buildMinefieldPlacementCandidate(owner, option, cfg, anchorProgress, targetX, targetY);
      candidate.dist = sample.dist;
      if (!best || (candidate.valid && !best.valid) || ((candidate.valid === best.valid) && (candidate.dist + candidate.snapDist * 0.15 < best.dist + best.snapDist * 0.15))) best = candidate;
      if (candidate.valid && candidate.dist <= 8) return candidate;
    }
    return best;
  }

  function getMinefieldMineDamage(target, mine) {
    const maxHp = Math.max(1, target?.maxHp || target?.shieldMaxHp || target?.hp || target?.pop || 1);
    return Math.max(1, Math.round((mine.damageBase || 20) + maxHp * (mine.damageMaxHpPct || 0.10)));
  }

  function spawnMinefieldBlast(mine) {
    const blast = {
      id: "mineBlast:" + ((state._nextAbilityMineId = (state._nextAbilityMineId || 1) + 1)),
      type: "minefieldBlast",
      x: mine.x,
      y: mine.y,
      radius: mine.blastRadius,
      ownerId: mine.ownerId,
      spawnedAt: state.t,
      duration: MINEFIELD_BLAST_FADE_SEC,
      sourceAbilityId: mine.sourceAbilityId
    };
    for (const u of state.units.values()) {
      if (!u || u.hp <= 0) continue;
      if (u.owner === mine.ownerId) continue;
      const hitR = (mine.blastRadius || 0) + Math.max(6, getUnitHitRadius(u) * 0.35);
      const dx = u.x - mine.x;
      const dy = u.y - mine.y;
      if (dx * dx + dy * dy > hitR * hitR) continue;
      const dmg = getMinefieldMineDamage(u, mine);
      applyUnitDamage(u, dmg, mine.ownerId);
      state.floatingDamage.push({ x: u.x, y: u.y - 14, text: "💥 -" + dmg, color: 0xff6b8d, ttl: 0.75 });
      if (u.hp <= 0) killUnit(u, "minefield", mine.ownerId);
    }
    state._abilityZoneEffects.push(blast);
  }

  function deployMinefieldLocal(abilityId, targetX, targetY, ownerId) {
    const placement = getMinefieldPlacement(ownerId, targetX, targetY, abilityId);
    if (!placement || !placement.valid) return { ok: false, reason: "invalid_placement", placement };
    const cfg = placement.config;
    const layout = placement.previewMines && placement.previewMines.length === cfg.mineCount
      ? placement.previewMines
      : buildMinefieldLayout(placement, targetX, targetY);
    if (layout.length !== cfg.mineCount) return { ok: false, reason: "invalid_placement", placement };
    state._nextAbilityMineId = state._nextAbilityMineId || 1;
    for (let i = 0; i < layout.length; i++) {
      const mine = layout[i];
      state._abilityZoneEffects.push({
        id: "mine:" + (state._nextAbilityMineId++),
        type: "minefieldMine",
        sourceAbilityId: abilityId,
        x: mine.x,
        y: mine.y,
        ownerId,
        spawnedAt: state.t,
        duration: cfg.duration,
        armedAt: state.t + cfg.armDelay,
        triggerRadius: cfg.triggerRadius,
        blastRadius: cfg.blastRadius,
        damageBase: cfg.damageBase,
        damageMaxHpPct: cfg.damageMaxHpPct,
        blinkSpeed: cfg.blinkSpeed
      });
    }
    return { ok: true, placement, mineCount: layout.length };
  }

  function buildOrbitalStrikeShots(ownerId, zoneX, zoneY, seed, abilityId) {
    const cfg = getOrbitalStrikeConfig(abilityId);
    const core = getOrbitalStrikeOwnerCore(ownerId, zoneX - cfg.zoneRadius * 2.2, zoneY + cfg.zoneRadius * 1.6);
    const shots = [];
    for (let salvoIndex = 0; salvoIndex < cfg.salvoCount; salvoIndex++) {
      const salvoStart = salvoIndex * cfg.salvoGapSec;
      const salvoTargets = buildOrbitalSalvoTargets(zoneX, zoneY, seed, salvoIndex, cfg);
      for (let shotIndex = 0; shotIndex < salvoTargets.length; shotIndex++) {
        const shotSeed = seed + salvoIndex * 101 + shotIndex * 17 + 13;
        const target = salvoTargets[shotIndex];
        const launchAt = salvoStart + shotIndex * cfg.shotIntervalSec;
        const flightDuration = cfg.flightDurationSec + (meteorHash01(shotSeed + 77) - 0.5) * cfg.flightVarianceSec * 2;
        shots.push({
          salvoIndex,
          shotIndex,
          seed: shotSeed,
          primary: !!target.primary,
          sx: core.x,
          sy: core.y,
          tx: target.tx,
          ty: target.ty,
          radius: target.radius,
          launchAt,
          arriveAt: launchAt + flightDuration,
          impactAt: launchAt + flightDuration,
          fadeDuration: cfg.impactFadeSec,
          resolved: false
        });
      }
    }
    return { coreX: core.x, coreY: core.y, shots, cfg };
  }

  function queueOrbitalStrikeLocal(zoneX, zoneY, ownerId, abilityId = "orbitalStrike") {
    const seed = getMeteorSeed(zoneX, zoneY, ownerId || 0);
    const built = buildOrbitalStrikeShots(ownerId, zoneX, zoneY, seed, abilityId);
    state._orbitalStrikes.push({
      x: zoneX,
      y: zoneY,
      radius: built.cfg.zoneRadius,
      abilityId: built.cfg.abilityId,
      ownerId,
      spawnedAt: state.t,
      duration: getOrbitalStrikeTotalDuration(built.cfg),
      damageBase: built.cfg.damageBase,
      damageMaxHpPct: built.cfg.damageMaxHpPct,
      seed,
      coreX: built.coreX,
      coreY: built.coreY,
      shots: built.shots,
      gfx: null
    });
  }

  function applyOrbitalStrikeImpact(strike, shot) {
    if (!strike || !shot) return;
    const hitR2 = shot.radius * shot.radius;
    for (const u of state.units.values()) {
      if (!u || u.hp <= 0 || u.owner === strike.ownerId) continue;
      const dx = u.x - shot.tx;
      const dy = u.y - shot.ty;
      if (dx * dx + dy * dy > hitR2) continue;
      const dmg = getOrbitalStrikeDamage(u, strike);
      applyUnitDamage(u, dmg, strike.ownerId);
      state.floatingDamage.push({ x: u.x, y: u.y - 14, text: "💥 -" + dmg, color: 0xff6b8d, ttl: 0.8 });
      if (u.hp <= 0) killUnit(u, strike.abilityId || "orbitalStrike", strike.ownerId);
    }
    for (const t of state.turrets.values()) {
      if (!t || t.hp <= 0 || t.ownerId === strike.ownerId) continue;
      const dx = t.x - shot.tx;
      const dy = t.y - shot.ty;
      if (dx * dx + dy * dy > hitR2) continue;
      const dmg = getOrbitalStrikeDamage(t, strike);
      t.hp = Math.max(0, t.hp - dmg);
      state.floatingDamage.push({ x: t.x, y: t.y - 12, text: "💥 -" + dmg, color: 0xff6b8d, ttl: 0.8 });
      if (t.hp <= 0) {
        t._diedAt = state.t;
        spawnXPOrb(t.x, t.y, 8);
      }
    }
    for (const p of state.players.values()) {
      if (!p || p.eliminated || p.id === strike.ownerId) continue;
      const dx = p.x - shot.tx;
      const dy = p.y - shot.ty;
      if (dx * dx + dy * dy > hitR2) continue;
      const dmg = getOrbitalStrikeDamage(p, strike);
      if ((p.shieldHp || 0) > 0) {
        p.shieldHp = Math.max(0, p.shieldHp - dmg);
        if (p.shieldHp === 0) p.shieldRegenCd = SHIELD_REGEN_DELAY;
        pushShieldHitEffect(p.x, p.y, shieldRadius(p), shot.tx, shot.ty, 0xff6b8d);
        state.floatingDamage.push({ x: shot.tx, y: shot.ty - 10, text: "💥🛡 -" + dmg, color: 0xff6b8d, ttl: 1.0 });
      } else {
        const popDmg = Math.max(2, Math.round(dmg * 0.12));
        p.popFloat = Math.max(1, (p.popFloat || p.pop || 1) - popDmg);
        p.pop = Math.floor(p.popFloat);
        state.floatingDamage.push({ x: p.x, y: p.y - 36, text: "💥 -" + popDmg, color: 0xff6b8d, ttl: 0.9 });
      }
    }
  }

  function stepOrbitalStrikes(dt) {
    void dt;
    for (let i = state._orbitalStrikes.length - 1; i >= 0; i--) {
      const strike = state._orbitalStrikes[i];
      const elapsed = state.t - strike.spawnedAt;
      if (elapsed > (strike.duration || getOrbitalStrikeTotalDuration(getOrbitalStrikeConfig(strike.abilityId, strike)))) {
        destroyOrbitalStrikeVisual(strike);
        state._orbitalStrikes.splice(i, 1);
        continue;
      }
      for (const shot of strike.shots || []) {
        if (shot.resolved || elapsed < shot.impactAt) continue;
        shot.resolved = true;
        applyOrbitalStrikeImpact(strike, shot);
      }
    }
  }

  function queueThermoNukeLocal(targetX, targetY, ownerId) {
    const api = getThermoNukeAbilityApi();
    const owner = state.players.get(ownerId);
    const originX = owner && !owner.eliminated ? owner.x : targetX;
    const originY = owner && !owner.eliminated ? owner.y : (targetY - 260);
    const built = api && typeof api.buildCast === "function"
      ? api.buildCast(targetX, targetY, ownerId, { originX, originY })
      : {
          ownerId,
          x: originX,
          y: originY,
          originX,
          originY,
          startX: originX,
          startY: originY,
          targetX,
          targetY,
          dirX: 0,
          dirY: -1,
          vx: 0,
          vy: 0,
          distance: Math.hypot(targetX - originX, targetY - originY),
          flightDuration: 10,
          impactAt: 10,
          impactFadeDuration: 2.6,
          previewRadius: 500,
          impactRadius: 500,
          duration: 20.6,
          resolved: false
        };
    state._thermoNukes.push({
      ...built,
      ownerId,
      spawnedAt: state.t,
      gfx: null,
      trajGfx: null,
      overlayGfx: null
    });
  }

  function applyThermoNukeImpact(strike) {
    if (!strike) return;
    const victims = [];
    const hitR2 = (strike.impactRadius || 500) * (strike.impactRadius || 500);
    for (const u of state.units.values()) {
      if (!u || u.hp <= 0) continue;
      const dx = u.x - strike.targetX;
      const dy = u.y - strike.targetY;
      if (dx * dx + dy * dy <= hitR2) victims.push(u);
    }
    for (const u of victims) {
      const killerOwner = u.owner === strike.ownerId ? null : strike.ownerId;
      u._activeShieldHp = null;
      u.hp = 0;
      u.lastDamagedBy = killerOwner;
      state.floatingDamage.push({
        x: u.x,
        y: u.y - 16,
        text: "☢️ WIPE",
        color: 0xdff3ff,
        ttl: 0.9
      });
      killUnit(u, "thermoNuke", killerOwner);
    }
    for (const p of state.players.values()) {
      if (!p || p.eliminated) continue;
      const dx = p.x - strike.targetX;
      const dy = p.y - strike.targetY;
      if (dx * dx + dy * dy > hitR2) continue;
      if ((p.shieldHp || 0) > 0) {
        p.shieldHp = 0;
        p.shieldRegenCd = SHIELD_REGEN_DELAY;
        pushShieldHitEffect(p.x, p.y, shieldRadius(p), strike.targetX, strike.targetY, 0xf6fbff);
        state.floatingDamage.push({
          x: p.x,
          y: p.y - 42,
          text: "☢️ SHIELD DOWN",
          color: 0xeaf6ff,
          ttl: 1.0
        });
      }
    }
  }

  function stepThermoNukes(dt) {
    void dt;
    for (let i = state._thermoNukes.length - 1; i >= 0; i--) {
      const strike = state._thermoNukes[i];
      const elapsed = state.t - strike.spawnedAt;
      if (!strike.resolved && elapsed >= (strike.impactAt || strike.flightDuration || 10)) {
        strike.resolved = true;
        applyThermoNukeImpact(strike);
      }
      if (elapsed > (strike.duration || ((strike.flightDuration || 10) + (strike.impactFadeDuration || 2.6) + 8))) {
        destroyThermoNukeVisual(strike);
        state._thermoNukes.splice(i, 1);
      }
    }
  }

  const ION_NEBULA_DURATION_SEC = 15;
  const MAX_RENDERED_BLACKHOLES = 4;
  const MAX_RENDERED_BLACKHOLES_REMOTE = 2;
  const MAX_RENDERED_ABILITY_STORMS = 5;
  const MAX_RENDERED_ABILITY_STORMS_REMOTE = 3;
  const SKIP_KEYS = new Set(["gfx", "cityGfx", "zoneGfx", "zoneGlow", "zoneLightGfx", "_patrolSpriteLayer", "_patrolSprites", "label", "shieldGfx", "labelGfx", "radiusGfx", "emojiContainer", "trajGfx", "_polyBuf", "zoneGfx", "zoneGlow"]);

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

  function snapshotStormLike(s) {
    if (!s) return null;
    return {
      x: s.x, y: s.y,
      vx: s.vx || 0, vy: s.vy || 0,
      spawnedAt: s.spawnedAt,
      duration: s.duration,
      lastDirChange: s.lastDirChange,
      lastDmgTick: s.lastDmgTick,
      rotAngle: s.rotAngle,
      stretch: s.stretch,
      _finalBurstDone: !!s._finalBurstDone,
      blobs: (s.blobs || []).map((b) => ({
        ox: b.ox, oy: b.oy, r: b.r,
        _baseOx: b._baseOx, _baseOy: b._baseOy, _baseR: b._baseR, _phase: b._phase
      }))
    };
  }

  function restoreStormLikeSnapshot(s) {
    if (!s) return null;
    return {
      x: s.x, y: s.y,
      vx: s.vx || 0, vy: s.vy || 0,
      spawnedAt: s.spawnedAt,
      duration: s.duration,
      lastDirChange: s.lastDirChange,
      lastDmgTick: s.lastDmgTick,
      rotAngle: s.rotAngle,
      stretch: s.stretch,
      _finalBurstDone: !!s._finalBurstDone,
      blobs: (s.blobs || []).map((b) => ({
        ox: b.ox, oy: b.oy, r: b.r,
        _baseOx: b._baseOx != null ? b._baseOx : b.ox,
        _baseOy: b._baseOy != null ? b._baseOy : b.oy,
        _baseR: b._baseR != null ? b._baseR : b.r,
        _phase: b._phase != null ? b._phase : 0
      })),
      gfx: null,
      emojiContainer: null
    };
  }

  function snapshotBlackHole(bh) {
    if (!bh) return null;
    return {
      x: bh.x, y: bh.y, ownerId: bh.ownerId,
      spawnedAt: bh.spawnedAt,
      duration: bh.duration,
      radius: bh.radius,
      styleKey: bh.styleKey || null,
      damageScale: bh.damageScale != null ? bh.damageScale : 1,
      finalBurstPct: bh.finalBurstPct != null ? bh.finalBurstPct : 0.10,
      phase: bh.phase || 0,
      _finalBurstDone: !!bh._finalBurstDone
    };
  }

  function restoreBlackHoleSnapshot(bh) {
    if (!bh) return null;
    return {
      x: bh.x, y: bh.y, ownerId: bh.ownerId,
      spawnedAt: bh.spawnedAt,
      duration: bh.duration,
      radius: bh.radius,
      styleKey: bh.styleKey || null,
      damageScale: bh.damageScale != null ? bh.damageScale : 1,
      finalBurstPct: bh.finalBurstPct != null ? bh.finalBurstPct : 0.10,
      phase: bh.phase || 0,
      _finalBurstDone: !!bh._finalBurstDone,
      gfx: null,
      debris: []
    };
  }

  function snapshotMeteor(m) {
    if (!m) return null;
    return {
      x: m.x, y: m.y,
      vx: m.vx, vy: m.vy,
      angle: m.angle,
      radius: m.radius,
      aoeR: m.aoeR,
      ownerId: m.ownerId,
      alive: m.alive !== false,
      impactDuration: m.impactDuration,
      styleKey: m.styleKey,
      visualScale: m.visualScale,
      seed: m.seed
    };
  }

  function restoreMeteorSnapshot(m) {
    if (!m) return null;
    return Object.assign({}, m, {
      alive: m.alive !== false,
      gfx: null,
      trajGfx: null
    });
  }

  function snapshotOrbitalStrike(strike) {
    if (!strike) return null;
    return {
      x: strike.x,
      y: strike.y,
      radius: strike.radius,
      abilityId: strike.abilityId,
      ownerId: strike.ownerId,
      spawnedAt: strike.spawnedAt,
      duration: strike.duration,
      damageBase: strike.damageBase,
      damageMaxHpPct: strike.damageMaxHpPct,
      seed: strike.seed,
      coreX: strike.coreX,
      coreY: strike.coreY,
      shots: (strike.shots || []).map((shot) => ({
        salvoIndex: shot.salvoIndex,
        shotIndex: shot.shotIndex,
        seed: shot.seed,
        primary: !!shot.primary,
        sx: shot.sx,
        sy: shot.sy,
        tx: shot.tx,
        ty: shot.ty,
        radius: shot.radius,
        launchAt: shot.launchAt,
        arriveAt: shot.arriveAt,
        impactAt: shot.impactAt,
        fadeDuration: shot.fadeDuration,
        resolved: !!shot.resolved
      }))
    };
  }

  function restoreOrbitalStrikeSnapshot(strike) {
    if (!strike) return null;
    return {
      x: strike.x,
      y: strike.y,
      radius: strike.radius,
      abilityId: strike.abilityId,
      ownerId: strike.ownerId,
      spawnedAt: strike.spawnedAt,
      duration: strike.duration,
      damageBase: strike.damageBase,
      damageMaxHpPct: strike.damageMaxHpPct,
      seed: strike.seed,
      coreX: strike.coreX,
      coreY: strike.coreY,
      shots: (strike.shots || []).map((shot) => ({
        salvoIndex: shot.salvoIndex,
        shotIndex: shot.shotIndex,
        seed: shot.seed,
        primary: !!shot.primary,
        sx: shot.sx,
        sy: shot.sy,
        tx: shot.tx,
        ty: shot.ty,
        radius: shot.radius,
        launchAt: shot.launchAt,
        arriveAt: shot.arriveAt,
        impactAt: shot.impactAt,
        fadeDuration: shot.fadeDuration,
        resolved: !!shot.resolved
      })),
      gfx: null
    };
  }

  function snapshotThermoNuke(strike) {
    if (!strike) return null;
    return {
      ownerId: strike.ownerId,
      spawnedAt: strike.spawnedAt,
      duration: strike.duration,
      seed: strike.seed,
      x: strike.x,
      y: strike.y,
      originX: strike.originX,
      originY: strike.originY,
      startX: strike.startX,
      startY: strike.startY,
      targetX: strike.targetX,
      targetY: strike.targetY,
      dirX: strike.dirX,
      dirY: strike.dirY,
      vx: strike.vx,
      vy: strike.vy,
      distance: strike.distance,
      flightDuration: strike.flightDuration,
      impactAt: strike.impactAt,
      impactFadeDuration: strike.impactFadeDuration,
      previewRadius: strike.previewRadius,
      impactRadius: strike.impactRadius,
      styleKey: strike.styleKey,
      resolved: !!strike.resolved
    };
  }

  function restoreThermoNukeSnapshot(strike) {
    if (!strike) return null;
    return {
      ...strike,
      resolved: !!strike.resolved,
      gfx: null,
      trajGfx: null,
      overlayGfx: null
    };
  }

  function snapshotPirateRaidForTime(strike) {
    return snapshotPirateRaid(strike);
  }

  function restorePirateRaidSnapshotForTime(strike) {
    return restorePirateRaidSnapshot(strike);
  }

  function snapshotEconomyAbilityFx(effect) {
    if (!effect) return null;
    return {
      id: effect.id,
      type: effect.type,
      ownerId: effect.ownerId,
      targetId: effect.targetId,
      ownerColor: effect.ownerColor,
      targetColor: effect.targetColor,
      spawnedAt: effect.spawnedAt,
      duration: effect.duration,
      signalDuration: effect.signalDuration,
      drainDuration: effect.drainDuration,
      burstDuration: effect.burstDuration,
      finishDuration: effect.finishDuration,
      startX: effect.startX,
      startY: effect.startY,
      targetX: effect.targetX,
      targetY: effect.targetY,
      amount: effect.amount,
      variantKey: effect.variantKey
    };
  }

  function restoreEconomyAbilityFxSnapshot(effect) {
    if (!effect) return null;
    return {
      ...effect,
      gfx: null,
      trajGfx: null,
      overlayGfx: null
    };
  }

  function stepMeteors(dt) {
    for (let i = state._activeMeteors.length - 1; i >= 0; i--) {
      const m = state._activeMeteors[i];
      if (!m.alive) { removeMeteorGfx(m); state._activeMeteors.splice(i, 1); continue; }
      const prevX = m.x;
      const prevY = m.y;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      // Off map
      if (m.x < -800 || m.x > CFG.WORLD_W + 800 || m.y < -800 || m.y > CFG.WORLD_H + 800) {
        m.alive = false; removeMeteorGfx(m); state._activeMeteors.splice(i, 1); continue;
      }
      const impact = findMeteorFirstImpactOnSegment(m, prevX, prevY, m.x, m.y);
      const unitHits = collectMeteorUnitHitsOnSegment(m, prevX, prevY, m.x, m.y, impact ? impact.t : 1);
      for (const hit of unitHits) {
        triggerMeteorPierceImpact(m, hit);
      }
      if (impact) detonateMeteor(m, impact);
      if (!m.alive) { removeMeteorGfx(m); state._activeMeteors.splice(i, 1); }
    }
  }

  function removeMeteorGfx(m) {
    if (isMeteorSwarmStyleKey(m?.styleKey) && typeof MeteorSwarmRenderer !== "undefined" && MeteorSwarmRenderer && typeof MeteorSwarmRenderer.destroyMeteor === "function") {
      MeteorSwarmRenderer.destroyMeteor(m);
      return;
    }
    if (typeof MeteorStrikeRenderer !== "undefined" && MeteorStrikeRenderer && typeof MeteorStrikeRenderer.destroyMeteor === "function") {
      MeteorStrikeRenderer.destroyMeteor(m);
      return;
    }
    if (m.gfx) { m.gfx.parent?.removeChild(m.gfx); m.gfx.destroy(true); m.gfx = null; }
    if (m.trajGfx) { m.trajGfx.parent?.removeChild(m.trajGfx); m.trajGfx.destroy(true); m.trajGfx = null; }
  }

  function destroyOrbitalStrikeVisual(strike) {
    if (typeof MeteorStrikeRenderer !== "undefined" && MeteorStrikeRenderer && typeof MeteorStrikeRenderer.destroyOrbitalStrike === "function") {
      MeteorStrikeRenderer.destroyOrbitalStrike(strike);
      return;
    }
    if (strike?.gfx) {
      strike.gfx.parent?.removeChild(strike.gfx);
      strike.gfx.destroy(true);
      strike.gfx = null;
    }
  }

  function destroyThermoNukeVisual(strike) {
    const renderer = getThermoNukeRendererApi();
    if (renderer && typeof renderer.destroyStrike === "function") {
      renderer.destroyStrike(strike);
      return;
    }
    if (strike?.gfx) {
      strike.gfx.parent?.removeChild(strike.gfx);
      strike.gfx.destroy(true);
      strike.gfx = null;
    }
    if (strike?.trajGfx) {
      strike.trajGfx.parent?.removeChild(strike.trajGfx);
      strike.trajGfx.destroy(true);
      strike.trajGfx = null;
    }
    if (strike?.overlayGfx) {
      strike.overlayGfx.parent?.removeChild(strike.overlayGfx);
      strike.overlayGfx.destroy(true);
      strike.overlayGfx = null;
    }
  }

  function destroyPirateRaidVisual(raid) {
    const renderer = getPirateRaidRendererApi();
    if (renderer && typeof renderer.destroyRaid === "function") {
      renderer.destroyRaid(raid);
      return;
    }
    if (raid?.gfx) {
      raid.gfx.parent?.removeChild(raid.gfx);
      raid.gfx.destroy(true);
      raid.gfx = null;
    }
  }

  function destroyEconomyAbilityVisual(effect) {
    const renderer = getEconomyAbilityRendererApi();
    if (renderer && typeof renderer.destroyEffect === "function") {
      renderer.destroyEffect(effect);
      return;
    }
    if (effect?.gfx) {
      effect.gfx.parent?.removeChild(effect.gfx);
      effect.gfx.destroy(true);
      effect.gfx = null;
    }
    if (effect?.trajGfx) {
      effect.trajGfx.parent?.removeChild(effect.trajGfx);
      effect.trajGfx.destroy(true);
      effect.trajGfx = null;
    }
    if (effect?.overlayGfx) {
      effect.overlayGfx.parent?.removeChild(effect.overlayGfx);
      effect.overlayGfx.destroy(true);
      effect.overlayGfx = null;
    }
  }

  function drawMeteors() {
    const timeSec = performance.now() / 1000;
    for (const m of state._activeMeteors) {
      if (isMeteorSwarmStyleKey(m.styleKey) && typeof MeteorSwarmRenderer !== "undefined" && MeteorSwarmRenderer && typeof MeteorSwarmRenderer.renderMeteor === "function") {
        MeteorSwarmRenderer.renderMeteor(m, {
          layer: abilityFxLayer,
          worldW: CFG.WORLD_W,
          worldH: CFG.WORLD_H,
          timeSec,
          zoom: cam.zoom || 0.22
        });
        continue;
      }
      if (typeof MeteorStrikeRenderer !== "undefined" && MeteorStrikeRenderer && typeof MeteorStrikeRenderer.renderMeteor === "function") {
        MeteorStrikeRenderer.renderMeteor(m, {
          layer: abilityFxLayer,
          worldW: CFG.WORLD_W,
          worldH: CFG.WORLD_H,
          timeSec,
          zoom: cam.zoom || 0.22
        });
      } else {
        if (!m.gfx || m.gfx.destroyed) { m.gfx = new PIXI.Graphics(); world.addChild(m.gfx); }
        if (!m.trajGfx || m.trajGfx.destroyed) { m.trajGfx = new PIXI.Graphics(); world.addChild(m.trajGfx); }
      }
    }
  }

  function drawMeteorImpactEffects() {
    if (!state._meteorImpactEffects || !state._meteorImpactEffects.length) return;
    const margin = 100;
    for (let i = state._meteorImpactEffects.length - 1; i >= 0; i--) {
      const fx = state._meteorImpactEffects[i];
      const elapsed = state.t - fx.t0;
      if (elapsed >= fx.duration) {
        if (isMeteorSwarmStyleKey(fx.styleKey) && typeof MeteorSwarmRenderer !== "undefined" && MeteorSwarmRenderer && typeof MeteorSwarmRenderer.destroyImpact === "function") {
          MeteorSwarmRenderer.destroyImpact(fx);
        } else if (typeof MeteorStrikeRenderer !== "undefined" && MeteorStrikeRenderer && typeof MeteorStrikeRenderer.destroyImpact === "function") {
          MeteorStrikeRenderer.destroyImpact(fx);
        } else if (fx.gfx && !fx.gfx.destroyed) {
          fx.gfx.parent?.removeChild(fx.gfx);
          fx.gfx.destroy(true);
        }
        state._meteorImpactEffects.splice(i, 1);
        continue;
      }
      if (fx.x < -margin || fx.x > CFG.WORLD_W + margin || fx.y < -margin || fx.y > CFG.WORLD_H + margin) continue;
      if (isMeteorSwarmStyleKey(fx.styleKey) && typeof MeteorSwarmRenderer !== "undefined" && MeteorSwarmRenderer && typeof MeteorSwarmRenderer.renderImpact === "function") {
        MeteorSwarmRenderer.renderImpact(fx, {
          layer: abilityFxLayer,
          simTimeSec: state.t,
          zoom: cam.zoom || 0.22
        });
        continue;
      }
      if (typeof MeteorStrikeRenderer !== "undefined" && MeteorStrikeRenderer && typeof MeteorStrikeRenderer.renderMeteorImpact === "function") {
        MeteorStrikeRenderer.renderMeteorImpact(fx, {
          layer: abilityFxLayer,
          simTimeSec: state.t,
          zoom: cam.zoom || 0.22
        });
      }
    }
  }

  function drawOrbitalStrikes() {
    if (!state._orbitalOverlayGfx || state._orbitalOverlayGfx.destroyed || state._orbitalOverlayGfx.parent !== abilityFxLayer) {
      state._orbitalOverlayGfx = new PIXI.Graphics();
      abilityFxLayer.addChild(state._orbitalOverlayGfx);
    }
    const overlay = state._orbitalOverlayGfx;
    overlay.clear();
    if (!state._orbitalStrikes || !state._orbitalStrikes.length) return;
    const animTime = performance.now() / 1000;
    for (const strike of state._orbitalStrikes) {
      if (typeof MeteorStrikeRenderer !== "undefined" && MeteorStrikeRenderer && typeof MeteorStrikeRenderer.renderOrbitalStrike === "function") {
        MeteorStrikeRenderer.renderOrbitalStrike(strike, {
          layer: abilityFxLayer,
          simTimeSec: state.t,
          zoom: cam.zoom || 0.22
        });
      }
      const visibleShots = (strike.shots || []).filter((shot) => {
        if (!shot.resolved) return true;
        const impactAge = state.t - (strike.spawnedAt + (shot.impactAt || 0));
        return impactAge <= Math.max(0.001, shot.fadeDuration || ORBITAL_STRIKE_IMPACT_FADE_SEC);
      });
      drawOrbitalPreviewFallback(overlay, strike.x, strike.y, strike.radius, visibleShots, animTime, true);
    }
  }

  function drawThermoNukes() {
    if (!state._thermoNukes || !state._thermoNukes.length) return;
    const renderer = getThermoNukeRendererApi();
    if (!renderer || typeof renderer.renderStrike !== "function") return;
    for (const strike of state._thermoNukes) {
      renderer.renderStrike(strike, {
        layer: abilityFxLayer,
        simTimeSec: state.t,
        zoom: cam.zoom || 0.22
      });
    }
  }

  function drawPirateRaids() {
    if (!state._pirateRaids || !state._pirateRaids.length) return;
    const renderer = getPirateRaidRendererApi();
    if (!renderer || typeof renderer.renderRaid !== "function") return;
    for (const raid of state._pirateRaids) {
      renderer.renderRaid(raid, {
        layer: abilityFxLayer,
        simTimeSec: state.t,
        zoom: cam.zoom || 0.22
      });
    }
  }

  function drawEconomyAbilityFx() {
    if (!state._economyAbilityFx || !state._economyAbilityFx.length) return;
    const renderer = getEconomyAbilityRendererApi();
    if (!renderer || typeof renderer.renderEffect !== "function") return;
    for (let i = state._economyAbilityFx.length - 1; i >= 0; i--) {
      const effect = state._economyAbilityFx[i];
      if (!effect) {
        state._economyAbilityFx.splice(i, 1);
        continue;
      }
      if ((state.t || 0) >= ((effect.spawnedAt || 0) + (effect.duration || 0))) {
        destroyEconomyAbilityVisual(effect);
        state._economyAbilityFx.splice(i, 1);
        continue;
      }
      renderer.renderEffect(effect, {
        layer: abilityFxLayer,
        simTimeSec: state.t,
        zoom: cam.zoom || 0.22,
        worldWidth: CFG.WORLD_W,
        worldHeight: CFG.WORLD_H
      });
    }
  }

  function stepRandomEvents(dt) {
    void dt;
    if (!state._multiIsHost && state._multiSlots) return;
    const W = CFG.WORLD_W, H = CFG.WORLD_H;
    const margin = 200;
    if (state._randomBlackHoleNextAt == null) state._randomBlackHoleNextAt = state.t + toSimSeconds(300);
    if (state.t >= (state._randomBlackHoleNextAt ?? 0)) {
      state._randomBlackHoleNextAt = state.t + toSimSeconds(300);
      const x = margin + Math.random() * (W - 2 * margin);
      const y = margin + Math.random() * (H - 2 * margin);
      spawnBlackHole(x, y, null);
    }
    state._randomMeteorNextAt = Infinity;
    state._randomMeteorScheduled = [];
  }

  function stepAbilityStorms(dt) {
    for (let i = state._abilityStorms.length - 1; i >= 0; i--) {
      const s = state._abilityStorms[i];
      if (state.t - s.spawnedAt > s.duration) {
        applyStormFinalBurst(s, s.finalBurstPct != null ? s.finalBurstPct : 0.02, "⚡", 0x66ccff);
        destroyIonStormVisual(s);
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
        const tickDamagePct = s.tickDamagePct != null ? s.tickDamagePct : 0.10;
        for (const u of state.units.values()) {
          if (u.hp <= 1) continue;
          if (isUnitInsideStormShape(u, s, cosA, sinA)) {
            const dmg = Math.max(1, Math.floor(u.hp * tickDamagePct));
            if (u.hp - dmg < 1) u.hp = 1; else u.hp -= dmg;
            u._hitFlashT = state.t;
            state.floatingDamage.push({ x: u.x, y: u.y - 22, text: "-" + dmg + "⚡", color: 0x8888ff, ttl: 0.8 });
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

  function useFleetBoost(pid) {
    state._fleetBoostUntil = state._fleetBoostUntil || {};
    state._fleetBoostUntil[pid] = state.t + toSimSeconds(20);
  }

  function useResourceSurge(pid) {
    const p = state.players.get(pid);
    if (!p) return;
    p.eCredits = (p.eCredits || 0) + 2200;
    state._economyAbilityFx = state._economyAbilityFx || [];
    state._economyAbilityFx.push({
      id: "econ:" + (state.nextResId++),
      type: "resourceSurge",
      ownerId: pid,
      ownerColor: p.color || 0xffc84b,
      spawnedAt: state.t || 0,
      duration: 4.35,
      burstDuration: 3.75,
      finishDuration: 0.6,
      targetX: p.x || 0,
      targetY: p.y || 0,
      amount: 2200,
      variantKey: "auric-surge",
      gfx: null,
      trajGfx: null,
      overlayGfx: null
    });
  }

  function stepLaneFighterWaves(dt) {
    void dt;
    if (state._laneFighterWaveNextAt == null) {
      state._laneFighterWaveNextAt = 0;
    }
    const waveInterval = toSimSeconds(30);
    while (state.t >= (state._laneFighterWaveNextAt || 0)) {
      for (const player of state.players.values()) {
        if (!player || player.id == null || player.id <= 0 || player.eliminated) continue;
        const wavePlan = [
          { frontType: "left", count: 3 },
          { frontType: "center", count: 3 },
          { frontType: "right", count: 3 }
        ];
        for (const plan of wavePlan) {
          spawnLaneAbilityUnits(player.id, plan.frontType, "fighter", plan.count, {
            sourceTag: "timed:laneFighters:" + player.id + ":" + plan.frontType,
            spread: 22,
            forwardStep: 7,
            allowAutoJoinRecentSpawn: false,
            mutateUnit: (u) => {
              u._autoLaneFighterWave = true;
            }
          });
        }
      }
      state._laneFighterWaveNextAt = (state._laneFighterWaveNextAt || 0) + waveInterval;
      if (waveInterval <= 0) break;
    }
  }

  function useVoidShield(pid) {
    state._voidShieldUntil = state._voidShieldUntil || {};
    state._voidShieldUntil[pid] = state.t + toSimSeconds(3);
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
      spawnSpatialRiftLocal(wx, wy, 0, pid);
    } else if (abilityId === "gravAnchor" || abilityId === "microAnchor") {
      const api = getGravAnchorAbilityApi();
      const isMicroAnchor = abilityId === "microAnchor";
      const effect = api && typeof api.buildEffect === "function"
        ? api.buildEffect(wx, wy, pid, isMicroAnchor
            ? { duration: 7, radius: 220, previewRadius: 220, pullBlend: 0.09 }
            : { duration: 20, radius: 420, previewRadius: 420, pullBlend: 0.065 })
        : {
            type: "anchor",
            x: wx,
            y: wy,
            duration: isMicroAnchor ? 7 : 20,
            radius: isMicroAnchor ? 220 : 420,
            previewRadius: isMicroAnchor ? 220 : 420,
            ownerId: pid,
            pullBlend: isMicroAnchor ? 0.09 : 0.065
          };
      scaleTimingFields(effect, ["duration"]);
      state._abilityZoneEffects.push({ ...effect, ownerId: pid, spawnedAt: state.t, gfx: null });
    } else if (abilityId === "fakeSignature") {
      state._fakeSignatures = state._fakeSignatures || [];
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        state._fakeSignatures.push({ x: wx + Math.cos(ang) * 60, y: wy + Math.sin(ang) * 60, color: state.players.get(pid)?.color || 0x4488ff, expiresAt: state.t + toSimSeconds(15) });
      }
    } else if (abilityId === "timeSingularity") {
      state._abilityZoneEffects.push({ type: "timeSlow", x: wx, y: wy, spawnedAt: state.t, duration: toSimSeconds(8), radius: 200, ownerId: pid, slowPct: 0.6 });
    } else if (abilityId === "nanoSwarm") {
      const api = getNanoSwarmAbilityApi();
      const effect = api && typeof api.buildEffect === "function"
        ? api.buildEffect(wx, wy, pid)
        : { type: "nano", x: wx, y: wy, duration: 20, radius: 240, previewRadius: 240, ownerId: pid, dps: 10, maxHpPctPerSec: 0.025, atkReduction: 0.25 };
      scaleTimingFields(effect, ["duration"]);
      state._abilityZoneEffects.push({ ...effect, ownerId: pid, spawnedAt: state.t, gfx: null });
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
    } else if (abilityId === MINEFIELD_SMALL_ID || abilityId === MINEFIELD_LARGE_ID) {
      const placed = deployMinefieldLocal(abilityId, wx, wy, pid);
      if (!placed || !placed.ok) return placed || { ok: false, reason: "invalid_placement" };
    } else if (abilityId === "resourceRaid") {
      for (const m of state.mines.values()) {
        if (Math.hypot(m.x - wx, m.y - wy) < 100 && m.ownerId !== pid) {
          m._originalOwner = m.ownerId;
          m._raidReturnAt = state.t + 30;
          m.ownerId = pid;
          break;
        }
      }
    } else if (abilityId === METEOR_SWARM_ABILITY_ID) {
      _spawnMeteorSwarmLocal(wx, wy, undefined, pid);
    } else if (abilityId === "orbitalStrike") {
      queueOrbitalStrikeLocal(wx, wy, pid, "orbitalStrike");
    } else if (abilityId === ORBITAL_BARRAGE_ID) {
      queueOrbitalStrikeLocal(wx, wy, pid, ORBITAL_BARRAGE_ID);
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
      queueThermoNukeLocal(wx, wy, pid);
    }

    setAbilityCooldown(pid, abilityId, def.cooldown);
    pushAbilityAnnouncement(pid, abilityId);
    cancelAbilityTargeting();
    return { ok: true };
  }

  function destroyAbilityZoneVisual(zone) {
    if (!zone) return;
    if (zone.type === "rift") {
      const renderer = getSpatialRiftRendererApi();
      if (renderer && typeof renderer.destroyZone === "function") renderer.destroyZone(zone);
      return;
    }
    if (zone.type === "anchor") {
      const renderer = getGravAnchorRendererApi();
      if (renderer && typeof renderer.destroyZone === "function") renderer.destroyZone(zone);
      return;
    }
    if (zone.type === "nano") {
      const renderer = getNanoSwarmRendererApi();
      if (renderer && typeof renderer.destroyZone === "function") renderer.destroyZone(zone);
    }
  }

  function executeAbilityAction(action) {
    if (!action || action.pid == null || !action.abilityId) return { ok: false, reason: "bad_action" };
    const pid = action.pid;
    const abilityId = action.abilityId;
    const def = ABILITY_DEFS.find((d) => d.id === abilityId) || getAbilityDefById(abilityId);
    if (!def) return { ok: false, reason: "unknown_ability" };

    if (abilityId === "ionNebula" || abilityId === "ionField") {
      _spawnIonNebulaLocal(action.x, action.y, pid, abilityId === "ionField" ? { durationSec: 3 } : null);
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === "meteor") {
      _spawnMeteorLocal(action.x, action.y, action.angle || 0, pid);
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === METEOR_SWARM_ABILITY_ID) {
      _spawnMeteorSwarmLocal(action.x, action.y, action.angle, pid);
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === "spatialRift") {
      spawnSpatialRiftLocal(action.x, action.y, action.angle || 0, pid);
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === "blackHole") {
      spawnBlackHole(action.x, action.y, pid);
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || CFG.BLACKHOLE_COOLDOWN);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === "microBlackHole") {
      spawnBlackHole(action.x, action.y, pid, {
        durationSec: 5,
        radius: Math.max(60, CFG.BLACKHOLE_RADIUS / 3),
        styleKey: "blood-meridian",
        damageScale: 1 / 3,
        finalBurstPct: 0.10 / 3
      });
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === "thermoNuke") {
      queueThermoNukeLocal(action.x, action.y, pid);
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === MINEFIELD_SMALL_ID || abilityId === MINEFIELD_LARGE_ID) {
      const placed = deployMinefieldLocal(abilityId, action.x, action.y, pid);
      if (!placed || !placed.ok) return placed || { ok: false, reason: "invalid_placement" };
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === "activeShield") {
      useActiveShield(pid);
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === "pirateRaid") {
      if (!spawnPirateRaid(action.x, action.y, pid)) return { ok: false, reason: "lane_only" };
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === "gloriousBattleMarch") {
      useGloriousBattleMarch(pid);
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === "loan") {
      useLoan(pid);
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === "raiderCapture") {
      useRaiderCapture(pid, action.targetCityId);
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === "cosmicGodHand") {
      useCosmicGodHand(pid, action.targetCityId);
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === "shieldOvercharge") {
      useShieldOvercharge(pid);
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === "fleetBoost") {
      useFleetBoost(pid);
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === "resourceSurge") {
      useResourceSurge(pid);
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === "voidShield") {
      useVoidShield(pid);
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === "sabotage") {
      useSabotage(pid);
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === "emergencyRepair") {
      useEmergencyRepair(pid);
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === "orbitalStrike") {
      queueOrbitalStrikeLocal(action.x, action.y, pid, "orbitalStrike");
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    if (abilityId === ORBITAL_BARRAGE_ID) {
      queueOrbitalStrikeLocal(action.x, action.y, pid, ORBITAL_BARRAGE_ID);
      if (!def.oneTime) setAbilityCooldown(pid, abilityId, def.cooldown || 0);
      pushAbilityAnnouncement(pid, abilityId);
      cancelAbilityTargeting();
      return { ok: true };
    }
    useAbilityAtPoint(abilityId, action.x, action.y, pid);
    return { ok: true };
  }

  function stepAbilityZoneEffects(dt) {
    for (let i = state._abilityZoneEffects.length - 1; i >= 0; i--) {
      const z = state._abilityZoneEffects[i];
      const elapsed = state.t - z.spawnedAt;
      if (elapsed > z.duration) {
        destroyAbilityZoneVisual(z);
        state._abilityZoneEffects.splice(i, 1);
        continue;
      }

      if (z.type === "minefieldMine") {
        if (state.t < (z.armedAt || z.spawnedAt || 0)) continue;
        let triggered = false;
        for (const u of state.units.values()) {
          if (!u || u.hp <= 0) continue;
          if (u.owner === z.ownerId) continue;
          const triggerR = (z.triggerRadius || 0) + Math.max(6, getUnitHitRadius(u) * 0.38);
          const dx = (u.x || 0) - (z.x || 0);
          const dy = (u.y || 0) - (z.y || 0);
          if (dx * dx + dy * dy > triggerR * triggerR) continue;
          triggered = true;
          break;
        }
        if (triggered) {
          spawnMinefieldBlast(z);
          destroyAbilityZoneVisual(z);
          state._abilityZoneEffects.splice(i, 1);
        }
        continue;
      }

      if (z.type === "minefieldBlast") {
        continue;
      }

      if (z.type === "rift") {
        const api = getSpatialRiftAbilityApi();
        if (!api || typeof api.buildRuntime !== "function") continue;
        const runtime = api.buildRuntime(z, elapsed);
        if (!z._collapseApplied && runtime.timeline.flashK > 0.01) {
          z._collapseApplied = true;
          for (const u of [...state.units.values()]) {
            if (u.owner === z.ownerId || u.hp <= 0) continue;
            if (!api.pointInCollapse(z, u.x, u.y)) continue;
            killUnit(u, "spatialRift", z.ownerId);
          }
        }
        if (elapsed >= (z.collapseAtSec != null ? z.collapseAtSec : (api.COLLAPSE_AT_SEC || 6.05))) continue;
        z._hitUnitIds = z._hitUnitIds || {};
        for (const u of state.units.values()) {
          if (u.owner === z.ownerId || u.hp <= 0 || z._hitUnitIds[u.id]) continue;
          const hitInfo = api.getRibbonHitInfo(z, u.x, u.y, runtime);
          if (!hitInfo || !hitInfo.inside) continue;
          const maxHp = Math.max(1, u.maxHp || u.baseMaxHp || u.hp || 1);
          const hitDamage = (z.hitFlat != null ? z.hitFlat : (api.DAMAGE_FLAT || 5)) + maxHp * (z.hitMaxHpPct != null ? z.hitMaxHpPct : (api.DAMAGE_MAX_HP_PCT || 0.5));
          z._hitUnitIds[u.id] = state.t;
          applyUnitDamage(u, hitDamage, z.ownerId);
          if (u.hp <= 0) killUnit(u, "spatialRift", z.ownerId);
        }
        continue;
      }

      for (const u of state.units.values()) {
        if (u.owner === z.ownerId || u.hp <= 0) continue;
        const d = Math.hypot(u.x - z.x, u.y - z.y);
        if (d > z.radius) continue;

        if (z.type === "nano") {
          const maxHp = Math.max(1, u.maxHp || u.baseMaxHp || u.hp || 1);
          const zoneDps = (z.dps || 5) + maxHp * (z.maxHpPctPerSec || 0);
          applyUnitDamage(u, zoneDps * dt, z.ownerId);
          if (z.slowPct) { u._cryoSlowUntil = state.t + 0.5; u._cryoSlowAmount = z.slowPct; }
          if (z.atkReduction) {
            u._atkReductionUntil = state.t + 0.5;
            u._atkReductionAmount = z.atkReduction;
          }
        } else if (z.type === "anchor") {
          const pullBlend = z.pullBlend != null ? z.pullBlend : 0.05;
          u.x = u.x * (1 - pullBlend) + z.x * pullBlend;
          u.y = u.y * (1 - pullBlend) + z.y * pullBlend;
          u.vx = 0;
          u.vy = 0;
          u._anchorStasisUntil = state.t + 0.6;
          u._cryoSlowUntil = state.t + 0.6;
          u._cryoSlowAmount = 1;
          u._atkReductionUntil = state.t + 0.6;
          u._atkReductionAmount = 1;
          if (u.squadId != null && typeof SQUADLOGIC !== "undefined" && SQUADLOGIC && typeof SQUADLOGIC.clearCombatForSquad === "function") {
            SQUADLOGIC.clearCombatForSquad(state, u.squadId, true);
            const sq = state.squads ? state.squads.get(u.squadId) : null;
            if (sq) sq._zoneImmunityUntil = state.t + 0.6;
          }
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

    for (const m of state.mines.values()) {
      if (m._raidReturnAt && state.t >= m._raidReturnAt) {
        m.ownerId = m._originalOwner;
        m._raidReturnAt = undefined;
        m._originalOwner = undefined;
      }
    }

    if (state._fakeSignatures) {
      state._fakeSignatures = state._fakeSignatures.filter(f => state.t < f.expiresAt);
    }
  }

  // ── Black Hole step ──
  if (!state._blackHoles) state._blackHoles = [];

  function spawnBlackHole(x, y, ownerId, opts) {
    opts = opts || {};
    const resolvedRadius = opts.radius != null ? opts.radius : CFG.BLACKHOLE_RADIUS;
    const resolvedStyleKey = opts.styleKey || (resolvedRadius <= Math.max(170, CFG.BLACKHOLE_RADIUS * 0.5) ? "blood-meridian" : "event-horizon-bloom");
    state._blackHoles.push({
      x, y, ownerId,
      spawnedAt: state.t,
      duration: toSimSeconds(opts.durationSec != null ? opts.durationSec : CFG.BLACKHOLE_DURATION),
      radius: resolvedRadius,
      styleKey: resolvedStyleKey,
      damageScale: opts.damageScale != null ? opts.damageScale : 1,
      finalBurstPct: opts.finalBurstPct != null ? opts.finalBurstPct : 0.10,
      gfx: null, phase: 0,
      debris: [],
      _finalBurstDone: false
    });
  }

  function useActiveShield(pid) {
    const p = state.players.get(pid);
    if (!p) return;
    for (const u of state.units.values()) {
      if (u.owner !== pid) continue;
      const shieldAmt = Math.max(1, Math.round((u.maxHp || u.hp) * 0.25));
      u._activeShieldHp = (u._activeShieldHp || 0) + shieldAmt;
      u._activeShieldEffectUntil = state.t + toSimSeconds(2);
    }
    state._activeShieldEffects = state._activeShieldEffects || [];
    state._activeShieldEffects.push({ pid, t0: state.t, duration: toSimSeconds(2) });
  }

  const PIRATE_RAID_HYPER_SPEED_MUL = 4.5;
  const PIRATE_RAID_HYPER_DIST = 180;
  const PIRATE_RAID_ARRIVE_DIST = 320;

  function snapshotPirateRaid(raid) {
    if (!raid) return null;
    return {
      id: raid.id,
      ownerId: raid.ownerId,
      spawnedAt: raid.spawnedAt,
      duration: raid.duration,
      portalDuration: raid.portalDuration,
      hyperDuration: raid.hyperDuration,
      seed: raid.seed,
      styleKey: raid.styleKey,
      paletteKey: raid.paletteKey,
      targetX: raid.targetX,
      targetY: raid.targetY,
      zoneRadius: raid.zoneRadius,
      portalX: raid.portalX,
      portalY: raid.portalY,
      portalDistance: raid.portalDistance,
      sideAngle: raid.sideAngle,
      attackAngle: raid.attackAngle
    };
  }

  function restorePirateRaidSnapshot(raid) {
    if (!raid) return null;
    return {
      ...raid,
      gfx: null
    };
  }

  function isPirateRaidPointOnLane(targetX, targetY) {
    for (const player of state.players.values()) {
      if (!player || player.eliminated) continue;
      const minCoreDist = getPlanetRadius(player) + 130;
      if (Math.hypot((targetX || 0) - (player.x || 0), (targetY || 0) - (player.y || 0)) <= minCoreDist) continue;
      for (const frontType of ["left", "center", "right"]) {
        const center = state.centerObjectives || {};
        const points = getLanePointsForPlayerFront(player, frontType, { x: center.centerX || 0, y: center.centerY || 0 });
        const sample = projectPointOnPolyline(points, targetX || 0, targetY || 0);
        if (!sample) continue;
        const laneHalfWidth = frontType === "center" ? 149 : 115;
        if (sample.dist <= laneHalfWidth) return true;
      }
    }
    return false;
  }

  function getPirateRaidPreview(targetX, targetY, ownerId) {
    if (!isPirateRaidPointOnLane(targetX, targetY)) return null;
    const api = getPirateRaidAbilityApi();
    if (!api || typeof api.buildCast !== "function") return null;
    return api.buildCast(targetX, targetY, ownerId);
  }

  function raidHasEnemyUnitsInZone(raid) {
    const hitR2 = (raid.zoneRadius || PIRATE_RAID_ARRIVE_DIST) * (raid.zoneRadius || PIRATE_RAID_ARRIVE_DIST);
    for (const u of state.units.values()) {
      if (!u || u.hp <= 0 || u.owner === PIRATE_OWNER_ID) continue;
      const dx = u.x - raid.targetX;
      const dy = u.y - raid.targetY;
      if (dx * dx + dy * dy <= hitR2) return true;
    }
    return false;
  }

  function findNearestRaidCity(x, y) {
    let best = null;
    let bestD2 = Infinity;
    for (const p of state.players.values()) {
      if (!p || p.eliminated) continue;
      const dx = p.x - x;
      const dy = p.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = p;
      }
    }
    return best;
  }

  function markPirateRaidSquadStage(leader, stage) {
    if (!leader) return;
    leader._pirateRaidStage = stage;
    if (leader.squadId == null) return;
    for (const u of state.units.values()) {
      if (u && u.squadId === leader.squadId) u._pirateRaidStage = stage;
    }
  }

  function issuePirateRaidSiegeOrder(leader, city) {
    if (!leader || !city) return;
    if (typeof SQUADLOGIC !== "undefined" && leader.squadId != null && SQUADLOGIC.issueSiegeOrder) {
      SQUADLOGIC.issueSiegeOrder(state, leader.squadId, city.id, [{ x: city.x, y: city.y }]);
      markPirateRaidSquadStage(leader, "siege");
      return;
    }
    leader.chaseTargetCityId = city.id;
    leader.chaseTargetUnitId = undefined;
    const minStopR = shieldRadius(city) + 6;
    const stopR = Math.max(getUnitAtkRange(leader) * 0.85, minStopR);
    const dx = leader.x - city.x;
    const dy = leader.y - city.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wp = { x: city.x + (dx / dist) * stopR, y: city.y + (dy / dist) * stopR };
    leader.waypoints = [wp];
    leader.waypointIndex = 0;
    for (const u of state.units.values()) {
      if (!u || u === leader || u.squadId == null || u.squadId !== leader.squadId) continue;
      u.waypoints = [{ x: wp.x, y: wp.y }];
      u.waypointIndex = 0;
    }
    markPirateRaidSquadStage(leader, "siege");
  }

  function spawnPirateRaid(targetX, targetY, ownerId) {
    const built = getPirateRaidPreview(targetX, targetY, ownerId);
    if (!built) return false;
    scaleTimingFields(built, ["duration", "portalDuration", "hyperDuration"]);
    const raidId = `pirate-raid-${state.nextUnitId}`;
    const batchTag = raidId;
    state._pirateRaids.push({
      ...built,
      id: raidId,
      spawnedAt: state.t,
      gfx: null
    });
    for (const ship of built.ships || []) {
      const u = spawnUnitAt(ship.spawnX, ship.spawnY, PIRATE_OWNER_ID, ship.unitType, [{ x: ship.targetX, y: ship.targetY }], {
        sourceTag: batchTag,
        autoGroupUntil: state.t + 3,
        allowAutoJoinRecentSpawn: true
      });
      if (!u) continue;
      u._pirateHyperUntil = state.t + (built.hyperDuration || toSimSeconds(9));
      u.vx = Math.cos(built.attackAngle);
      u.vy = Math.sin(built.attackAngle);
      u._pirateRaidId = raidId;
      u._pirateRaidTargetX = built.targetX;
      u._pirateRaidTargetY = built.targetY;
      u._pirateRaidZoneRadius = built.zoneRadius;
      u._pirateRaidStage = "assault";
    }
    state._hyperFlashes = state._hyperFlashes || [];
    state._hyperFlashes.push({ x: built.portalX, y: built.portalY, t0: state.t, duration: toSimSeconds(1.2) });
    return true;
  }

  function stepPirateRaids(dt) {
    void dt;
    for (let i = state._pirateRaids.length - 1; i >= 0; i--) {
      const raid = state._pirateRaids[i];
      const elapsed = state.t - raid.spawnedAt;
      if (elapsed > (raid.duration || 5.4)) {
        destroyPirateRaidVisual(raid);
        state._pirateRaids.splice(i, 1);
        continue;
      }
      if (raidHasEnemyUnitsInZone(raid)) continue;
      for (const u of state.units.values()) {
        if (!u || u.hp <= 0 || u.owner !== PIRATE_OWNER_ID || u._pirateRaidId !== raid.id) continue;
        if (u.leaderId != null || u._pirateRaidStage === "siege") continue;
        const distToZone = Math.hypot(u.x - raid.targetX, u.y - raid.targetY);
        if (distToZone > Math.max(72, (raid.zoneRadius || PIRATE_RAID_ARRIVE_DIST) * 0.48)) continue;
        const city = findNearestRaidCity(u.x, u.y);
        if (!city) continue;
        issuePirateRaidSiegeOrder(u, city);
      }
    }
    for (const u of state.units.values()) {
      if (!u || u.hp <= 0 || u.owner !== PIRATE_OWNER_ID || u.leaderId != null || !u._pirateRaidId) continue;
      if (isUnitInAuthoritativeCombat(u)) continue;
      const cityTarget = u.chaseTargetCityId != null ? state.players.get(u.chaseTargetCityId) : null;
      const idle = !u.waypoints || (u.waypointIndex ?? 0) >= u.waypoints.length;
      const distToRaidCenter = Math.hypot(u.x - (u._pirateRaidTargetX ?? u.x), u.y - (u._pirateRaidTargetY ?? u.y));
      const reachedRaidCenter = distToRaidCenter <= Math.max(72, (u._pirateRaidZoneRadius || PIRATE_RAID_ARRIVE_DIST) * 0.48);
      const activeRaid = state._pirateRaids.find((raid) => raid.id === u._pirateRaidId) || null;

      if (u._pirateRaidStage !== "siege" && activeRaid && !reachedRaidCenter) continue;
      if (u._pirateRaidStage === "siege" && cityTarget && !cityTarget.eliminated && !idle) continue;

      const city = findNearestRaidCity(u.x, u.y);
      if (!city) continue;
      issuePirateRaidSiegeOrder(u, city);
    }
  }

  function useGloriousBattleMarch(pid) {
    state._battleMarchUntil = state._battleMarchUntil || {};
    state._battleMarchUntil[pid] = state.t + toSimSeconds(30);
  }

  if (!state._loanDebts) state._loanDebts = [];
  function useLoan(pid) {
    const p = state.players.get(pid);
    if (!p) return;
    p.eCredits = (p.eCredits || 0) + 5000;
    state._loanDebts = state._loanDebts || [];
    state._loanDebts.push({ pid, deductAt: state.t + toSimSeconds(180), amount: 7500 });
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
    const steal = Math.max(1, Math.min(70, Math.floor((targetCity.pop || 0) * 0.12)));
    targetCity.popFloat = Math.max(0, (targetCity.popFloat || targetCity.pop || 0) - steal);
    targetCity.pop = Math.floor(targetCity.popFloat);
    p.popFloat = (p.popFloat || p.pop || 0) + steal;
    p.pop = Math.floor(p.popFloat);
    state.floatingDamage.push({ x: targetCity.x, y: targetCity.y - 40, text: "-" + steal + " энерг.", color: 0xff8a66, ttl: 2 });
    state.floatingDamage.push({ x: p.x, y: p.y - 40, text: "+" + steal + " энерг.", color: 0x66ffd5, ttl: 2 });
    state._economyAbilityFx = state._economyAbilityFx || [];
    state._economyAbilityFx.push({
      id: "econ:" + (state.nextResId++),
      type: "energySteal",
      ownerId: pid,
      targetId: targetCityId,
      ownerColor: p.color || 0xff8f48,
      targetColor: targetCity.color || 0x68d8ff,
      spawnedAt: state.t || 0,
      duration: 4.44,
      signalDuration: 0.88,
      drainDuration: 3.0,
      finishDuration: 0.56,
      startX: p.x || 0,
      startY: p.y || 0,
      targetX: targetCity.x || 0,
      targetY: targetCity.y || 0,
      amount: steal,
      variantKey: "eclipse-siphon",
      gfx: null,
      trajGfx: null,
      overlayGfx: null
    });
  }

  function useCosmicGodHand(pid, targetCityId) {
    const caster = state.players.get(pid);
    const targetCity = state.players.get(targetCityId);
    if (!caster || caster.eliminated || !targetCity || targetCity.eliminated || targetCityId === pid) return;
    targetCity._lastCityAttacker = pid;
    targetCity.lastDamagedBy = pid;
    if ((targetCity.shieldHp || 0) > 0) {
      targetCity.shieldHp = 0;
      targetCity.shieldRegenCd = SHIELD_REGEN_DELAY;
      pushShieldHitEffect(targetCity.x, targetCity.y, shieldRadius(targetCity), caster.x, caster.y, caster.color || 0xf2d7ff);
    }
    state.floatingDamage.push({
      x: targetCity.x,
      y: targetCity.y - 52,
      text: "РУКА БОГА",
      color: 0xf6dcff,
      ttl: 1.4
    });
    playExplosionSound(targetCity.x, targetCity.y);
    destroyCity(targetCity, pid);
  }

  function destroyBlackHoleVisual(bh) {
    if (!bh) return;
    if (typeof BlackHoleRenderer !== "undefined" && BlackHoleRenderer && typeof BlackHoleRenderer.destroy === "function") {
      BlackHoleRenderer.destroy(bh);
      return;
    }
    if (bh._bodyContainer && !bh._bodyContainer.destroyed) { bh._bodyContainer.parent?.removeChild(bh._bodyContainer); bh._bodyContainer.destroy({ children: true }); }
    if (bh._debrisGfx && !bh._debrisGfx.destroyed) { bh._debrisGfx.parent?.removeChild(bh._debrisGfx); bh._debrisGfx.destroy(true); }
    bh._bodyContainer = null;
    bh._debrisGfx = null;
  }

  function hideBlackHoleVisual(bh) {
    if (!bh) return;
    if (typeof BlackHoleRenderer !== "undefined" && BlackHoleRenderer && typeof BlackHoleRenderer.hide === "function") {
      BlackHoleRenderer.hide(bh);
      return;
    }
    if (bh._bodyContainer) bh._bodyContainer.visible = false;
    if (bh._debrisGfx) bh._debrisGfx.visible = false;
  }

  function stepBlackHoles(dt) {
    const growTBase = CFG.BLACKHOLE_GROWTH_TIME || 3;
    const fadeTBase = CFG.BLACKHOLE_FADE_TIME || 4;
    for (let i = state._blackHoles.length - 1; i >= 0; i--) {
      const bh = state._blackHoles[i];
      const elapsed = state.t - bh.spawnedAt;
      if (elapsed > bh.duration) {
        applyBlackHoleFinalBurst(bh);
        destroyBlackHoleVisual(bh);
        state._blackHoles.splice(i, 1);
        continue;
      }
      bh.phase += dt;

      const totalT = Math.max(0.1, bh.duration || CFG.BLACKHOLE_DURATION || 10);
      const growT = Math.min(growTBase, totalT * 0.35);
      const fadeT = Math.min(fadeTBase, totalT * 0.35);
      const holdT = Math.max(0, totalT - growT - fadeT);
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

        const influence = Math.max(0, 1 - dist / Math.max(1, curR));
        const pullSpeed = Math.max(
          CFG.BLACKHOLE_GRAVITY * 2.4,
          (bh.radius || curR) * (0.35 + influence * 1.35)
        ) * Math.max(0.55, gravMul);
        if (!u._blackHolePullUntil || u._blackHolePullUntil < state.t + 0.18 || pullSpeed > (u._blackHolePullSpeed || 0)) {
          u._blackHolePullUntil = state.t + 0.18;
          u._blackHolePullX = bh.x;
          u._blackHolePullY = bh.y;
          u._blackHolePullSpeed = pullSpeed;
        }

        const maxHp = Math.max(1, u.maxHp || u.hp || 1);
        const dmg = maxHp * 0.10 * (bh.damageScale != null ? bh.damageScale : 1) * dt;
        u.hp = Math.max(0, u.hp - dmg);
        u.lastDamagedBy = bh.ownerId;
        if (Math.random() < dt * 2) {
          const showDmg = Math.max(1, Math.round(dmg));
          state.floatingDamage.push({ x: u.x, y: u.y - 20, text: "-" + showDmg + "🕳️", color: 0x8800ff, ttl: 0.6 });
        }
      }
    }
  }

  function drawPirateBaseJaggedRing(g, radius, jitter, points, spin, color, width, alpha) {
    for (let i = 0; i <= points; i++) {
      const t = i / points;
      const a = t * Math.PI * 2 + spin;
      const pulse = Math.sin(a * 3.0 + state.t * 0.65) * jitter + Math.cos(a * 5.0 - state.t * 0.42) * jitter * 0.55;
      const rr = radius + pulse;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.stroke({ color, width, alpha });
  }

  function drawPirateBasePlate(g, angle, innerR, outerR, spread, fillColor, strokeColor, fillAlpha, strokeAlpha) {
    const x0 = Math.cos(angle - spread) * innerR;
    const y0 = Math.sin(angle - spread) * innerR;
    const x1 = Math.cos(angle) * outerR;
    const y1 = Math.sin(angle) * outerR;
    const x2 = Math.cos(angle + spread) * innerR;
    const y2 = Math.sin(angle + spread) * innerR;
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.lineTo(x2, y2);
    g.closePath();
    g.fill({ color: fillColor, alpha: fillAlpha });
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.lineTo(x2, y2);
    g.closePath();
    g.stroke({ color: strokeColor, width: 1.1, alpha: strokeAlpha });
  }

  function drawSinglePirateBase(pb) {
    if (!pb || pb.hp <= 0) {
      if (pb && pb.gfx) pb.gfx.visible = false;
      if (pb && pb._emojiGfx) pb._emojiGfx.visible = false;
      if (pb && pb._timerTxt) pb._timerTxt.visible = false;
      return;
    }
    if (!inView(pb.x, pb.y)) {
      if (pb.gfx) pb.gfx.visible = false;
      if (pb._emojiGfx) pb._emojiGfx.visible = false;
      if (pb._timerTxt) pb._timerTxt.visible = false;
      return;
    }
    if (!pb.gfx || pb.gfx.destroyed) {
      pb.gfx = new PIXI.Graphics();
      resLayer.addChild(pb.gfx);
    }
    if (!pb._emojiGfx || pb._emojiGfx.destroyed) {
      pb._emojiGfx = new PIXI.Text({
        text: "🏴‍☠️",
        style: {
          fontFamily: "Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, Arial",
          fontSize: 26,
          stroke: { color: 0x000000, width: 4 }
        }
      });
      pb._emojiGfx.anchor.set(0.5, 1);
      resLayer.addChild(pb._emojiGfx);
    }
    pb.gfx.visible = true;
    pb._emojiGfx.visible = true;
    pb.gfx.position.set(pb.x, pb.y);
    pb.gfx.clear();

    const g = pb.gfx;
    const R = 54;
    const facing = pb.orbitCenter
      ? Math.atan2((pb.orbitCenter.y || 0) - pb.y, (pb.orbitCenter.x || 0) - pb.x)
      : -Math.PI / 2;
    const pulse = 0.5 + 0.5 * Math.sin(state.t * 1.7);
    const shellCol = 0x120d12;
    const hullCol = 0x4b2d27;
    const trimCol = 0xd48c63;
    const glowCol = 0xff9258;
    const hotCol = 0xffe3ab;
    const underAttack = !!(pb._lastAttackedAt && (state.t - pb._lastAttackedAt) < 5);

    const outerHex = [];
    const innerHex = [];
    for (let i = 0; i < 6; i++) {
      const a = facing + Math.PI / 6 + i * (Math.PI * 2 / 6);
      outerHex.push(Math.cos(a) * (R * 0.98), Math.sin(a) * (R * 0.98));
      innerHex.push(Math.cos(a) * (R * 0.48), Math.sin(a) * (R * 0.48));
    }

    g.circle(0, 0, R * 1.34);
    g.fill({ color: glowCol, alpha: 0.04 + pulse * 0.03 });

    g.poly(outerHex);
    g.fill({ color: 0x090b12, alpha: 0.94 });
    g.poly(outerHex);
    g.stroke({ color: trimCol, width: 2.1, alpha: 0.54 });

    g.poly(innerHex);
    g.fill({ color: shellCol, alpha: 0.94 });
    g.poly(innerHex);
    g.stroke({ color: hotCol, width: 1.4, alpha: 0.46 });

    const armAngles = [-2.25, -1.38, -0.42, 0.42, 1.38, 2.25];
    for (let i = 0; i < armAngles.length; i++) {
      const a = facing + armAngles[i];
      const innerR = R * 0.28;
      const outerR = R * 0.86;
      const x0 = Math.cos(a) * innerR;
      const y0 = Math.sin(a) * innerR;
      const x1 = Math.cos(a) * outerR;
      const y1 = Math.sin(a) * outerR;
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke({ color: hullCol, width: 5.8, alpha: 0.96 });
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke({ color: trimCol, width: 1.1, alpha: 0.28 });
      g.circle(x1, y1, R * 0.075);
      g.fill({ color: 0x160f13, alpha: 0.96 });
      g.circle(x1, y1, R * 0.075);
      g.stroke({ color: glowCol, width: 1.0, alpha: 0.34 });
    }

    const mouthSpread = 0.46;
    const mouthOuter = R * 0.78;
    const mouthInner = R * 0.12;
    const mx0 = Math.cos(facing - mouthSpread) * mouthOuter;
    const my0 = Math.sin(facing - mouthSpread) * mouthOuter;
    const mx1 = Math.cos(facing) * mouthInner;
    const my1 = Math.sin(facing) * mouthInner;
    const mx2 = Math.cos(facing + mouthSpread) * mouthOuter;
    const my2 = Math.sin(facing + mouthSpread) * mouthOuter;
    g.moveTo(mx0, my0);
    g.lineTo(mx1, my1);
    g.lineTo(mx2, my2);
    g.closePath();
    g.fill({ color: 0x03050a, alpha: 0.98 });
    g.moveTo(mx0, my0);
    g.lineTo(mx1, my1);
    g.lineTo(mx2, my2);
    g.closePath();
    g.stroke({ color: hotCol, width: 1.5, alpha: 0.42 });

    g.circle(0, 0, R * 0.18);
    g.fill({ color: glowCol, alpha: 0.42 + pulse * 0.10 });
    g.circle(0, 0, R * 0.08);
    g.fill({ color: hotCol, alpha: 0.92 });

    if (underAttack) {
      g.circle(0, 0, R * 1.18);
      g.stroke({ color: 0xff5648, width: 2.0, alpha: 0.24 + pulse * 0.24 });
    }

    const hpBarW = R * 1.9;
    const hpBarH = 5;
    const hpPct = pb.maxHp > 0 ? pb.hp / pb.maxHp : 1;
    g.rect(-hpBarW / 2, -R - 18, hpBarW, hpBarH);
    g.fill({ color: 0x2a0f12, alpha: 0.84 });
    g.rect(-hpBarW / 2, -R - 18, hpBarW * hpPct, hpBarH);
    g.fill({ color: 0xff6a4a, alpha: 0.92 });

    const flagY = pb._respawnTimer > 0 ? pb.y - R - 44 : pb.y - R - 26;
    pb._emojiGfx.position.set(pb.x, flagY);

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
      pb._timerTxt.position.set(pb.x, pb.y - R - 24);
      pb._timerTxt.visible = true;
    } else if (pb._timerTxt) {
      pb._timerTxt.visible = false;
    }
  }

  function drawPirateBase() {
    const pirateBases = getPirateBases();
    if (!pirateBases.length) return;
    for (const pb of pirateBases) drawSinglePirateBase(pb);
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
    const growTBase = CFG.BLACKHOLE_GROWTH_TIME || 3;
    const fadeTBase = CFG.BLACKHOLE_FADE_TIME || 4;
    const smoothTime = (typeof performance !== "undefined" ? performance.now() / 1000 : state.t);
    const remote = !!(state._multiSlots && !state._multiIsHost);
    const renderBudget = remote ? MAX_RENDERED_BLACKHOLES_REMOTE : MAX_RENDERED_BLACKHOLES;
    const visible = [];
    for (const bh of state._blackHoles) {
      if (!inView(bh.x, bh.y)) {
        hideBlackHoleVisual(bh);
        continue;
      }
      visible.push(bh);
    }
    visible.sort((a, b) => ((a.x - cam.x) ** 2 + (a.y - cam.y) ** 2) - ((b.x - cam.x) ** 2 + (b.y - cam.y) ** 2));
    for (let idx = 0; idx < visible.length; idx++) {
      const bh = visible[idx];
      if (idx >= renderBudget) {
        hideBlackHoleVisual(bh);
        continue;
      }
      const totalT = Math.max(0.1, bh.duration || CFG.BLACKHOLE_DURATION || 10);
      const growT = Math.min(growTBase, totalT * 0.35);
      const fadeT = Math.min(fadeTBase, totalT * 0.35);
      const holdT = Math.max(0, totalT - growT - fadeT);
      if (typeof BlackHoleRenderer !== "undefined" && BlackHoleRenderer && typeof BlackHoleRenderer.render === "function") {
        BlackHoleRenderer.render(bh, {
          layer: abilityFxLayer,
          simTimeSec: state.t,
          animTimeSec: smoothTime,
          zoom: cam.zoom || 0.22,
          multiplayerRemote: remote,
          growthTime: growT,
          holdTime: holdT,
          fadeTime: fadeT
        });
      }
    }
  }

  function drawAbilityStorms() {
    const remote = !!(state._multiSlots && !state._multiIsHost);
    const renderBudget = remote ? MAX_RENDERED_ABILITY_STORMS_REMOTE : MAX_RENDERED_ABILITY_STORMS;
    const visible = [];
    for (const s of state._abilityStorms) {
      if (!inView(s.x, s.y)) {
        hideIonStormVisual(s);
        continue;
      }
      visible.push(s);
    }
    visible.sort((a, b) => ((a.x - cam.x) ** 2 + (a.y - cam.y) ** 2) - ((b.x - cam.x) ** 2 + (b.y - cam.y) ** 2));
    for (let idx = 0; idx < visible.length; idx++) {
      const s = visible[idx];
      if (idx >= renderBudget) {
        hideIonStormVisual(s);
        continue;
      }
      const contour = stormContourPoints(s);
      if (typeof IonStormRenderer !== "undefined" && IonStormRenderer && typeof IonStormRenderer.renderStorm === "function") {
        IonStormRenderer.renderStorm(s, {
          layer: world,
          contour,
          simTimeSec: state.t,
          animTimeSec: performance.now() / 1000,
          zoom: cam.zoom || 0.22,
          multiplayerRemote: remote,
          durationSec: s.duration || 10
        });
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
    if (!testUiEnabled) {
      panel.style.display = "none";
      return;
    }
    function isAllowedTestNickname() {
      const nicknameInput = typeof document !== "undefined" ? document.getElementById("nicknameInput") : null;
      const nickname =
        (state._myNickname
          || (typeof window !== "undefined" ? window._myNickname : "")
          || (nicknameInput && nicknameInput.value)
          || "")
          .trim();
      return nickname === "qD319";
    }
    function showIfSolo() {
      panel.style.display = (!state._multiSlots && isAllowedTestNickname()) ? "flex" : "none";
    }
    setInterval(showIfSolo, 1000);
    showIfSolo();

    const btnPop = document.getElementById("testAddPop");
    const btnLvl = document.getElementById("testAddLevel");
    const abilitySelect = document.getElementById("testAbilitySelect");
    const giveAbilityBtn = document.getElementById("testGiveAbilityCard");
    const btnCD = document.getElementById("testNoCooldowns");

    if (abilitySelect) {
      abilitySelect.innerHTML = "";
      for (const def of ABILITY_DEFS) {
        const opt = document.createElement("option");
        opt.value = def.id;
        opt.textContent = (def.icon || "🃏") + " " + def.name;
        abilitySelect.appendChild(opt);
      }
    }

    if (btnPop) btnPop.addEventListener("click", () => {
      const me = state.players.get(state.myPlayerId);
      if (me) { me.popFloat = (me.popFloat || me.pop || 0) + 1000; me.pop = Math.floor(me.popFloat); }
    });
    if (btnLvl) btnLvl.addEventListener("click", () => {
      const me = state.players.get(state.myPlayerId);
      if (!me) return;
      for (let i = 0; i < 10; i++) {
        const gainMul = Math.max(0.0001, me.xpGainMul != null ? me.xpGainMul : 1);
        const missingXp = Math.max(1, (me.xpNext || 1) - (me.xp || 0));
        const rawXpToGrant = Math.max(1, Math.ceil(missingXp / gainMul));
        gainXP(me, rawXpToGrant);
      }
      focusCardHud();
    });
    if (giveAbilityBtn) giveAbilityBtn.addEventListener("click", () => {
      const me = state.players.get(state.myPlayerId);
      const abilityId = abilitySelect && abilitySelect.value ? abilitySelect.value : null;
      if (!me || !abilityId) return;
      grantSpecificCardToPlayer(me, "A_" + abilityId, "testPanel");
      focusCardHud();
    });
    if (btnCD) btnCD.addEventListener("click", () => {
      state._testNoCooldowns = !state._testNoCooldowns;
      btnCD.textContent = state._testNoCooldowns ? "Перезарядки: ВЫКЛ" : "Без перезарядок";
      btnCD.style.borderColor = state._testNoCooldowns ? "#44ff66" : "#44aaff";
    });
  })();

  function drawAbilityZoneEffects() {
    if (!state._zoneGfx || state._zoneGfx.destroyed || state._zoneGfx.parent !== abilityFxLayer) {
      if (state._zoneGfx && !state._zoneGfx.destroyed && state._zoneGfx.parent) state._zoneGfx.parent.removeChild(state._zoneGfx);
      state._zoneGfx = new PIXI.Graphics();
      state._zoneGfx.zIndex = 9999;
      abilityFxLayer.addChild(state._zoneGfx);
    }
    const g = state._zoneGfx;
    g.clear();
    if (!state._abilityZoneEffects || state._abilityZoneEffects.length === 0) return;
    const t = performance.now() / 1000;
    const zoneColors = { rift: 0x8844ff, anchor: 0x44aaff, timeSlow: 0x66ccff, nano: 0x88ff44 };
    for (const z of state._abilityZoneEffects) {
      const visible = z.type === "rift"
        ? (!state._vp || !z.renderBounds || !(
            z.renderBounds.left > state._vp.x2 + 120 ||
            z.renderBounds.left + z.renderBounds.width < state._vp.x - 120 ||
            z.renderBounds.top > state._vp.y2 + 120 ||
            z.renderBounds.top + z.renderBounds.height < state._vp.y - 120
          ))
        : inView(z.x, z.y);
      if (z.type === "minefieldMine") {
        if (!visible) continue;
        const armed = state.t >= (z.armedAt || z.spawnedAt || 0);
        const blink = 0.5 + 0.5 * Math.sin(t * (z.blinkSpeed || 8) + (z.x || 0) * 0.03 + (z.y || 0) * 0.02);
        const coreColor = armed ? 0xff5a5a : 0xffaa66;
        g.circle(z.x, z.y, (z.triggerRadius || 12) * 1.45);
        g.fill({ color: 0x3b0608, alpha: (armed ? 0.12 : 0.08) + blink * 0.06 });
        g.circle(z.x, z.y, Math.max(4.5, (z.triggerRadius || 12) * 0.72));
        g.fill({ color: coreColor, alpha: 0.30 + blink * 0.20 });
        g.circle(z.x, z.y, Math.max(4, (z.triggerRadius || 12) * 0.96));
        g.stroke({ color: coreColor, width: 1.6, alpha: 0.48 + blink * 0.24 });
        g.moveTo(z.x - 4, z.y);
        g.lineTo(z.x + 4, z.y);
        g.moveTo(z.x, z.y - 4);
        g.lineTo(z.x, z.y + 4);
        g.stroke({ color: 0xffffff, width: 1.0, alpha: 0.34 + blink * 0.18 });
        continue;
      }
      if (z.type === "minefieldBlast") {
        if (!visible) continue;
        const elapsed = state.t - z.spawnedAt;
        const blastT = Math.max(0, Math.min(1, elapsed / Math.max(0.001, z.duration || MINEFIELD_BLAST_FADE_SEC)));
        const fadeAlpha = 1 - blastT;
        drawOrbitalImpactFlashFallback(g, z.x, z.y, z.radius || 72, t, fadeAlpha);
        g.circle(z.x, z.y, (z.radius || 72) * (0.52 + blastT * 0.48));
        g.stroke({ color: 0xff7b96, width: 2.0, alpha: 0.30 * fadeAlpha });
        continue;
      }
      if (z.type === "rift") {
        const renderer = getSpatialRiftRendererApi();
        if (renderer && typeof renderer.renderZone === "function") {
          renderer.renderZone(z, {
            layer: abilityFxLayer,
            simTimeSec: state.t,
            animTimeSec: t,
            zoom: cam.zoom || 0.22,
            visible
          });
          continue;
        }
      } else if (z.type === "anchor") {
        const renderer = getGravAnchorRendererApi();
        if (renderer && typeof renderer.renderZone === "function") {
          renderer.renderZone(z, {
            layer: abilityFxLayer,
            simTimeSec: state.t,
            animTimeSec: t,
            zoom: cam.zoom || 0.22,
            visible,
            units: state.units.values(),
            getUnitHitRadius
          });
          continue;
        }
      } else if (z.type === "nano") {
        const renderer = getNanoSwarmRendererApi();
        if (renderer && typeof renderer.renderZone === "function") {
          renderer.renderZone(z, {
            layer: abilityFxLayer,
            simTimeSec: state.t,
            animTimeSec: t,
            zoom: cam.zoom || 0.22,
            visible,
            units: state.units.values(),
            getUnitHitRadius
          });
          continue;
        }
      }
      if (!visible) continue;
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
    if (!state._abilityPreviewScreenGfx || state._abilityPreviewScreenGfx.destroyed) {
      state._abilityPreviewScreenGfx = new PIXI.Graphics();
      screenFxLayer.addChild(state._abilityPreviewScreenGfx);
    }
    if (!state._abilityPreviewText || state._abilityPreviewText.destroyed) {
      state._abilityPreviewText = new PIXI.Text("", {
        fontFamily: "ui-sans-serif, system-ui, Segoe UI, Roboto, Arial",
        fontSize: 17,
        fill: 0xfff0e6,
        fontWeight: "bold",
        stroke: 0x000000,
        strokeThickness: 4
      });
      state._abilityPreviewText.anchor.set(0.5, 1);
      screenFxLayer.addChild(state._abilityPreviewText);
    }
    const g = state._abilityPreviewGfx;
    const screenG = state._abilityPreviewScreenGfx;
    const previewText = state._abilityPreviewText;
    g.clear();
    screenG.clear();
    if (previewText && !previewText.destroyed) {
      previewText.visible = false;
      previewText.text = "";
    }
    const lockedPreview = state._mobileAbilityLockedPreview;
    const msx = lockedPreview && lockedPreview.screenX != null ? lockedPreview.screenX : (state._mouseScreenX ?? selectionPointerState.lastX);
    const msy = lockedPreview && lockedPreview.screenY != null ? lockedPreview.screenY : (state._mouseScreenY ?? selectionPointerState.lastY);
    const mx = lockedPreview && lockedPreview.x != null ? lockedPreview.x : (msx - cam.x) / cam.zoom;
    const my = lockedPreview && lockedPreview.y != null ? lockedPreview.y : (msy - cam.y) / cam.zoom;
    const spatialRiftRenderer = getSpatialRiftRendererApi();
    if (state._abilityTargeting !== "spatialRift" && spatialRiftRenderer && typeof spatialRiftRenderer.destroyPreview === "function") {
      spatialRiftRenderer.destroyPreview(state);
    }

    if (state._abilityTargeting === MINEFIELD_SMALL_ID || state._abilityTargeting === MINEFIELD_LARGE_ID) {
      const me = state.players.get(state.myPlayerId);
      const laneColor = me ? (me.color || colorForId(me.id)) : 0x66aaff;
      const availability = getMinefieldAvailabilityPreview(state.myPlayerId, state._abilityTargeting);
      const placement = getMinefieldPlacement(state.myPlayerId, mx, my, state._abilityTargeting);
      const cfg = getMinefieldConfig(state._abilityTargeting);
      const activeFrontType = placement && placement.option ? placement.option.frontType : null;
      const zoneAngle = placement ? placement.angle : 0;
      const zoneHalfSide = placement ? placement.halfSide : cfg.previewHalfSide;
      const zoneHalfForward = placement ? placement.halfForward : cfg.previewHalfForward;
      const zoneCenterX = placement ? placement.centerX : mx;
      const zoneCenterY = placement ? placement.centerY : my;
      const zoneCorners = placement ? placement.corners : getRotatedRectCorners(zoneCenterX, zoneCenterY, zoneHalfForward, zoneHalfSide, zoneAngle);
      const valid = !!(placement && placement.valid);
      const previewColor = valid ? 0x57ff95 : 0xff6464;
      const activeAvailability = availability && Array.isArray(availability.options)
        ? availability.options.find((entry) => entry.frontType === activeFrontType)
        : null;
      const availablePointCount = activeAvailability ? (activeAvailability.validPointCount || 0) : 0;
      screenG.rect(0, 0, app.screen.width, app.screen.height);
      screenG.fill({ color: 0x04060c, alpha: MINEFIELD_PREVIEW_DARKEN_ALPHA });
      if (availability && Array.isArray(availability.ownerPolygon) && availability.ownerPolygon.length >= 3) {
        drawClosedPolygon(g, availability.ownerPolygon, 0x63ff9d, 0.055, 0.28, 2.8);
      }
      for (const option of getLaneAbilityFrontOptions(state.myPlayerId)) {
        const active = activeFrontType && option.frontType === activeFrontType;
        drawCorridorPolyline(g, option.points, laneColor, option.frontType === "center" ? 98 : 86, {
          fillAlpha: active ? 0.04 : 0.012,
          coreAlpha: active ? 0.08 : 0.03,
          edgeAlpha: active ? 0.22 : 0.08,
          lightAlpha: active ? 0.22 : 0.10,
          dashSpeed: active ? 34 : 18
        });
      }
      if (availability && Array.isArray(availability.options)) {
        for (const optionPreview of availability.options) {
          const active = activeFrontType && optionPreview.frontType === activeFrontType;
          for (const segment of optionPreview.validSegments || []) {
            if (segment.length >= 2) {
              drawCorridorPolyline(g, segment, 0x57ff95, Math.max(28, Math.min((optionPreview.laneHalfWidth || 56) - 8, (cfg.previewHalfSide || 28) + 18)), {
                fillAlpha: active ? 0.34 : 0.18,
                coreAlpha: active ? 0.48 : 0.24,
                edgeAlpha: active ? 0.88 : 0.50,
                lightAlpha: active ? 1.0 : 0.68,
                dashSpeed: active ? 42 : 28
              });
            } else if (segment.length === 1) {
              g.circle(segment[0].x, segment[0].y, Math.max(18, (cfg.previewHalfSide || 28) * 0.6));
              g.fill({ color: 0x57ff95, alpha: active ? 0.28 : 0.16 });
              g.circle(segment[0].x, segment[0].y, Math.max(18, (cfg.previewHalfSide || 28) * 0.6));
              g.stroke({ color: 0xcffff0, width: 2.4, alpha: active ? 0.82 : 0.48 });
            }
            for (const point of segment) {
              g.circle(point.x, point.y, active ? 7 : 5);
              g.fill({ color: 0xbfffd5, alpha: active ? 0.62 : 0.34 });
              g.circle(point.x, point.y, active ? 12 : 9);
              g.stroke({ color: 0x57ff95, width: active ? 2.4 : 1.6, alpha: active ? 0.84 : 0.42 });
            }
          }
        }
      }
      drawRotatedSquare(g, zoneCorners, previewColor, valid ? 0.090 : 0.105, valid ? 0.92 : 0.86, 3.2);
      const previewMines = placement && placement.previewMines && placement.previewMines.length
        ? placement.previewMines
        : [{ x: zoneCenterX, y: zoneCenterY }];
      for (const mine of previewMines) {
        g.circle(mine.x, mine.y, cfg.triggerRadius * 0.95);
        g.fill({ color: previewColor, alpha: valid ? 0.30 : 0.24 });
        g.circle(mine.x, mine.y, cfg.triggerRadius * 1.28);
        g.stroke({ color: valid ? 0xeafff3 : 0xffc4c4, width: 1.2, alpha: valid ? 0.60 : 0.42 });
      }
      if (previewText && !previewText.destroyed) {
        previewText.position.set(msx, msy - 18);
        previewText.visible = true;
        previewText.alpha = 0.96;
        previewText.text = valid
          ? ((state._abilityTargeting === MINEFIELD_LARGE_ID ? "Большое" : "Малое") + ` минное поле: доступно позиций ${Math.max(1, availablePointCount)}`)
          : `Зелёные зоны = можно ставить. Текущий фронт: ${availablePointCount} точек`;
      }
    }

    if (state._abilityTargeting === "ionNebula" || state._abilityTargeting === "ionField") {
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
      const t = performance.now() / 1000;
      if (mt.phase === "point") {
        if (typeof MeteorStrikeRenderer !== "undefined" && MeteorStrikeRenderer && typeof MeteorStrikeRenderer.drawMeteorPreview === "function") {
          MeteorStrikeRenderer.drawMeteorPreview(g, {
            phase: "point",
            mouseX: mx,
            mouseY: my,
            aoeRadius: METEOR_PREVIEW_RADIUS
          }, {
            timeSec: t,
            zoom: cam.zoom || 0.22
          });
        }
      } else if (mt.phase === "angle") {
        const diag = Math.hypot(CFG.WORLD_W, CFG.WORLD_H) + 400;
        const ax = mt.x - Math.cos(mt.angle) * diag;
        const ay = mt.y - Math.sin(mt.angle) * diag;
        const bx = mt.x + Math.cos(mt.angle) * diag;
        const by = mt.y + Math.sin(mt.angle) * diag;
        const predictedImpact = findMeteorFirstImpactOnSegment({ radius: METEOR_RADIUS }, ax, ay, bx, by);
        const impactX = predictedImpact ? predictedImpact.x : mt.x;
        const impactY = predictedImpact ? predictedImpact.y : mt.y;
        const pathUnits = collectMeteorPreviewUnitsOnSegment(ax, ay, impactX, impactY, METEOR_RADIUS, state.myPlayerId);
        appendUnitsInRadius(pathUnits, impactX, impactY, METEOR_PREVIEW_RADIUS, state.myPlayerId);
        if (typeof MeteorStrikeRenderer !== "undefined" && MeteorStrikeRenderer && typeof MeteorStrikeRenderer.drawMeteorPreview === "function") {
          MeteorStrikeRenderer.drawMeteorPreview(g, {
            phase: "angle",
            x: mt.x,
            y: mt.y,
            angle: mt.angle,
            aoeRadius: METEOR_PREVIEW_RADIUS,
            impactX,
            impactY,
            worldW: CFG.WORLD_W,
            worldH: CFG.WORLD_H,
            predictedTargetX: predictedImpact?.target?.x,
            predictedTargetY: predictedImpact?.target?.y,
            predictedTargetRadius: predictedImpact
              ? (predictedImpact.type === "unit"
                ? getUnitHitRadius(predictedImpact.target) + 6
                : getMeteorPlanetImpactRadius(predictedImpact.target) + 6)
              : 0
          }, {
            timeSec: t,
            zoom: cam.zoom || 0.22
          });
        }
        const guideLen = Math.min(diag, Math.max(420, Math.hypot(impactX - mt.x, impactY - mt.y) + 260));
        const guideStartX = impactX - Math.cos(mt.angle) * guideLen;
        const guideStartY = impactY - Math.sin(mt.angle) * guideLen;
        drawMeteorPreviewGuideLine(g, guideStartX, guideStartY, impactX, impactY, 0xff8a8a, 0.58, {
          backWidth: 12,
          lineWidth: 5.2,
          arrowLen: 28,
          arrowHalfW: 12,
          arrowInset: 10,
          arrowCount: 3
        });
        drawMeteorPreviewAffectedUnits(g, pathUnits, 0xff5a5a);
      }
    }

    if (state._abilityTargeting === "spatialRift" && state._meteorTargeting) {
      const mt = state._meteorTargeting;
      const api = getSpatialRiftAbilityApi();
      if (spatialRiftRenderer && typeof spatialRiftRenderer.renderPreview === "function") {
        spatialRiftRenderer.renderPreview(state, {
          phase: mt.phase,
          x: mt.phase === "point" ? mx : mt.x,
          y: mt.phase === "point" ? my : mt.y,
          angle: mt.phase === "angle" ? mt.angle : 0,
          radius: (api && api.RADIUS) || 180,
          length: (api && api.LENGTH) || 760
        }, {
          layer: world,
          timeSec: performance.now() / 1000,
          zoom: cam.zoom || 0.22
        });
      }
    }

    if (state._abilityTargeting === "orbitalStrike" || state._abilityTargeting === ORBITAL_BARRAGE_ID) {
      const t = performance.now() / 1000;
      const preview = getOrbitalPreviewSalvo(state.myPlayerId, mx, my, state._abilityTargeting);
      drawOrbitalPreviewFallback(g, mx, my, preview.radius, preview.targets, t, false);
    }

    if (state._abilityTargeting === "thermoNuke") {
      const t = performance.now() / 1000;
      const renderer = getThermoNukeRendererApi();
      const thermoApi = getThermoNukeAbilityApi();
      const me = state.players.get(state.myPlayerId);
      if (renderer && typeof renderer.drawPreview === "function") {
        renderer.drawPreview(g, {
          x: mx,
          y: my,
          radius: thermoApi && thermoApi.PREVIEW_RADIUS ? thermoApi.PREVIEW_RADIUS : 500,
          originX: me ? me.x : undefined,
          originY: me ? me.y : undefined
        }, {
          timeSec: t,
          zoom: cam.zoom || 0.22
        });
      }
    }

    if (state._abilityTargeting === "pirateRaid") {
      const t = performance.now() / 1000;
      const renderer = getPirateRaidRendererApi();
      const preview = getPirateRaidPreview(mx, my, state.myPlayerId);
      if (renderer && preview && typeof renderer.drawPreview === "function") {
        renderer.drawPreview(g, preview, {
          timeSec: t,
          zoom: cam.zoom || 0.22
        });
      }
    }

    if (state._abilityTargeting === METEOR_SWARM_ABILITY_ID && state._meteorTargeting) {
      const t = performance.now() / 1000;
      const mt = state._meteorTargeting;
      if (mt.phase === "point") {
        const pointPreview = getMeteorSwarmPreview(mx, my, state.myPlayerId);
        if (pointPreview && typeof MeteorSwarmRenderer !== "undefined" && MeteorSwarmRenderer && typeof MeteorSwarmRenderer.drawPreview === "function") {
          MeteorSwarmRenderer.drawPreview(g, {
            x: mx,
            y: my,
            radius: pointPreview.previewRadius || 120,
            shots: []
          }, {
            timeSec: t,
            zoom: cam.zoom || 0.22
          });
        }
      } else if (mt.phase === "angle") {
        const preview = getMeteorSwarmPreview(mt.x, mt.y, state.myPlayerId, mt.angle);
        if (preview && typeof MeteorSwarmRenderer !== "undefined" && MeteorSwarmRenderer && typeof MeteorSwarmRenderer.drawPreview === "function") {
          const affectedUnits = [];
          const affectedIds = new Set();
          const shots = preview.shots.map((shot) => {
            const predictedImpact = findMeteorFirstImpactOnSegment({ radius: shot.radius }, shot.entryX, shot.entryY, shot.exitX, shot.exitY);
            const impactX = predictedImpact ? predictedImpact.x : shot.aimX;
            const impactY = predictedImpact ? predictedImpact.y : shot.aimY;
            const shotUnits = collectMeteorPreviewUnitsOnSegment(shot.entryX, shot.entryY, impactX, impactY, shot.radius, state.myPlayerId);
            appendUnitsInRadius(shotUnits, impactX, impactY, shot.aoeR, state.myPlayerId);
            for (const u of shotUnits) {
              if (!u || affectedIds.has(u.id)) continue;
              affectedIds.add(u.id);
              affectedUnits.push(u);
            }
            return {
              swarmIndex: shot.swarmIndex,
              entryX: shot.entryX,
              entryY: shot.entryY,
              aimX: shot.aimX,
              aimY: shot.aimY,
              aoeR: shot.aoeR,
              previewRadius: shot.aoeR,
              predictedImpactX: impactX,
              predictedImpactY: impactY,
              predictedTargetX: predictedImpact?.target?.x,
              predictedTargetY: predictedImpact?.target?.y,
              predictedTargetRadius: predictedImpact
                ? (predictedImpact.type === "unit"
                  ? getUnitHitRadius(predictedImpact.target) + 6
                  : getMeteorPlanetImpactRadius(predictedImpact.target) + 6)
                : 0
            };
          });
          MeteorSwarmRenderer.drawPreview(g, {
            x: mt.x,
            y: mt.y,
            radius: preview.previewRadius || 120,
            shots: shots
          }, {
            timeSec: t,
            zoom: cam.zoom || 0.22
          });
          for (const shot of shots) {
            drawMeteorPreviewGuideLine(g, shot.entryX, shot.entryY, shot.predictedImpactX, shot.predictedImpactY, 0xff8a8a, shot.swarmIndex === 0 ? 0.34 : 0.24);
          }
          drawMeteorPreviewAffectedUnits(g, affectedUnits, 0xff5a5a);
        }
      }
    }

    if (state._abilityTargeting === "blackHole" || state._abilityTargeting === "microBlackHole") {
      const R = state._abilityTargeting === "microBlackHole" ? Math.max(60, (CFG.BLACKHOLE_RADIUS || 400) / 3) : (CFG.BLACKHOLE_RADIUS || 400);
      const t = performance.now() / 1000;
      const styleKey = state._abilityTargeting === "microBlackHole" ? "blood-meridian" : "event-horizon-bloom";
      if (typeof BlackHoleRenderer !== "undefined" && BlackHoleRenderer && typeof BlackHoleRenderer.drawPreview === "function") {
        BlackHoleRenderer.drawPreview(g, mx, my, R, t, cam.zoom || 0.22, styleKey);
      } else {
        const pulse = 0.5 + 0.3 * Math.sin(t * 1.5);
        g.circle(mx, my, R);
        g.stroke({ color: 0xd8c7ff, width: 2.5, alpha: 0.3 + 0.2 * pulse });
      }
      const affectedUnits = [];
      appendUnitsInRadius(affectedUnits, mx, my, R, null);
      drawMeteorPreviewAffectedUnits(g, affectedUnits, 0xff5a5a);
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
    if (state._abilityTargeting === "raiderCapture" || state._abilityTargeting === "cosmicGodHand") {
      const t = performance.now() / 1000;
      const isGodHand = state._abilityTargeting === "cosmicGodHand";
      if (!isGodHand) {
        screenG.rect(0, 0, app.screen.width, app.screen.height);
        screenG.fill({ color: 0x02040a, alpha: 0.64 });
      }
      for (const p of state.players.values()) {
        if (p.eliminated || p.id === state.myPlayerId) continue;
        const playerPhase = Number(p.id) || 0;
        const pr = getPlanetRadius(p);
        const pR = pr + 40;
        const hovered = (p.x - mx) ** 2 + (p.y - my) ** 2 <= pR * pR;
        const pulse = 0.4 + 0.3 * Math.sin(t * 3 + playerPhase * 0.13);
        const targetRadius = pr + (hovered ? 92 : 78);
        const primaryColor = isGodHand
          ? (hovered ? 0xf2d8ff : 0xe8c2ff)
          : (hovered ? 0xffb295 : 0xff5a2b);
        const secondaryColor = isGodHand
          ? 0xffffff
          : (hovered ? 0xfff1e8 : 0xffd4bd);
        if (!isGodHand) {
          const sx = p.x * cam.zoom + cam.x;
          const sy = p.y * cam.zoom + cam.y;
          const focusRadius = Math.max(34, targetRadius * cam.zoom);
          const innerRadius = Math.max(18, (pr + 22) * cam.zoom);
          screenG.circle(sx, sy, focusRadius);
          screenG.fill({ color: hovered ? 0xff9b77 : 0xffc6ad, alpha: hovered ? 0.12 : 0.06 });
          screenG.circle(sx, sy, innerRadius);
          screenG.stroke({ color: hovered ? 0xffd7c8 : 0xff9a68, width: hovered ? 2.4 : 1.6, alpha: hovered ? 0.52 : 0.26 });
          screenG.circle(sx, sy, focusRadius);
          screenG.stroke({ color: hovered ? 0xffc2a8 : 0xff8f5d, width: hovered ? 2.8 : 1.4, alpha: hovered ? 0.36 : 0.16 });
        }
        g.circle(p.x, p.y, targetRadius);
        g.stroke({ color: primaryColor, width: hovered ? 3.2 : 2.0, alpha: hovered ? 0.42 : 0.18 + pulse * 0.08 });
        g.circle(p.x, p.y, targetRadius * 0.76);
        g.stroke({ color: secondaryColor, width: hovered ? 1.8 : 1.1, alpha: hovered ? 0.26 : 0.10 + pulse * 0.04 });
        g.circle(p.x, p.y, pr + (hovered ? 16 : 12));
        g.stroke({ color: primaryColor, width: hovered ? 3.4 : 2.4, alpha: hovered ? 0.92 : 0.54 + pulse * 0.16 });
        g.circle(p.x, p.y, pr + (hovered ? 28 : 22));
        g.stroke({ color: secondaryColor, width: hovered ? 1.8 : 1.2, alpha: hovered ? 0.58 : 0.24 + pulse * 0.12 });
        g.circle(p.x, p.y, pr + 8);
        g.fill({ color: isGodHand ? 0xb88cff : 0xff5a2b, alpha: hovered ? 0.10 : 0.05 });
        const reticleOuter = pr + (hovered ? 42 : 36);
        const reticleInner = pr + 18;
        g.moveTo(p.x - reticleOuter, p.y);
        g.lineTo(p.x - reticleInner, p.y);
        g.moveTo(p.x + reticleInner, p.y);
        g.lineTo(p.x + reticleOuter, p.y);
        g.moveTo(p.x, p.y - reticleOuter);
        g.lineTo(p.x, p.y - reticleInner);
        g.moveTo(p.x, p.y + reticleInner);
        g.lineTo(p.x, p.y + reticleOuter);
        g.stroke({ color: secondaryColor, width: hovered ? 2.4 : 1.6, alpha: hovered ? 0.70 : 0.34 });
        const particleCount = isGodHand ? 8 : (hovered ? 8 : 6);
        const stolen = Math.max(1, Math.min(70, Math.floor((p.pop || 0) * 0.12)));
        if (isGodHand || stolen > 0) {
          for (let i = 0; i < particleCount; i++) {
            const a = (i / particleCount) * Math.PI * 2 + t * (hovered ? 2.6 : 1.9);
            const d = pr + 18 + 10 * Math.sin(t * 4 + i);
            g.circle(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, hovered ? 3.2 : 2.6);
            g.fill({ color: isGodHand ? 0xf3dbff : 0xff9a68, alpha: hovered ? 0.48 : 0.34 });
          }
        }
        if (hovered && !isGodHand && previewText && !previewText.destroyed) {
          const exactEnergy = Math.max(0, Math.round(p.popFloat || p.pop || 0));
          previewText.text = "Энергия: " + exactEnergy;
          previewText.position.set(p.x * cam.zoom + cam.x, p.y * cam.zoom + cam.y - Math.max(56, targetRadius * cam.zoom) - 14);
          previewText.visible = true;
          previewText.alpha = 0.96;
        }
      }
    }
    if (state._abilityTargeting === "gravAnchor" || state._abilityTargeting === "microAnchor") {
      const renderer = getGravAnchorRendererApi();
      const api = getGravAnchorAbilityApi();
      if (renderer && typeof renderer.drawPreview === "function") {
        renderer.drawPreview(g, {
          x: mx,
          y: my,
          radius: state._abilityTargeting === "microAnchor"
            ? 220
            : ((api && (api.PREVIEW_RADIUS || api.RADIUS)) || 420)
        }, {
          timeSec: performance.now() / 1000,
          zoom: cam.zoom || 0.22
        });
      }
    }
    if (state._abilityTargeting === "nanoSwarm") {
      const renderer = getNanoSwarmRendererApi();
      const api = getNanoSwarmAbilityApi();
      if (renderer && typeof renderer.drawPreview === "function") {
        renderer.drawPreview(g, {
          x: mx,
          y: my,
          radius: (api && (api.PREVIEW_RADIUS || api.RADIUS)) || 240
        }, {
          timeSec: performance.now() / 1000,
          zoom: cam.zoom || 0.22
        });
      }
    }
    const genericPointAbilities = {
      fakeSignature:   { radius: 80,  color: 0xaacc44, label: "Сигнатуры" },
      timeSingularity: { radius: 200, color: 0x66ccff, label: "Сингулярность" },
      gravWave:        { radius: 250, color: 0xff8844, label: "Грав. Волна" },
      resourceRaid:    { radius: 100, color: 0xffcc00, label: "Набег" },
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
    if (state._abilityPreviewScreenGfx && !state._abilityPreviewScreenGfx.destroyed) {
      state._abilityPreviewScreenGfx.clear();
    }
    if (state._abilityPreviewText && !state._abilityPreviewText.destroyed) {
      state._abilityPreviewText.visible = false;
      state._abilityPreviewText.text = "";
    }
    const renderer = getSpatialRiftRendererApi();
    if (renderer && typeof renderer.destroyPreview === "function") renderer.destroyPreview(state);
  }

  function getAbilityDisplayName(abilityId) {
    const def = ABILITY_DEFS.find((entry) => entry.id === abilityId);
    return def ? def.name : "способность";
  }

  function updateMeteorTouchAngle(clientX, clientY) {
    if (!state._meteorTargeting || state._meteorTargeting.phase !== "angle") return;
    const wx = (clientX - cam.x) / cam.zoom;
    const wy = (clientY - cam.y) / cam.zoom;
    state._meteorTargeting.angle = Math.atan2(wy - state._meteorTargeting.y, wx - state._meteorTargeting.x);
  }

  function handleAbilityTargetingPrimaryClick(wx, wy) {
    if (!state._abilityTargeting) return false;
    hideHudTooltip();
    if (state._abilityTargeting === "ionNebula" || state._abilityTargeting === "ionField") {
      if (!confirmPendingAbilityCardCast({ x: wx, y: wy })) useIonNebula(wx, wy, state._abilityTargeting);
      return true;
    } else if (state._abilityTargeting === "blackHole" || state._abilityTargeting === "microBlackHole") {
      if (confirmPendingAbilityCardCast({ x: wx, y: wy })) return true;
      const me = state.players.get(state.myPlayerId);
      const abilityId = state._abilityTargeting;
      const cooldownKey = abilityId;
      const cooldownValue = ABILITY_DEFS.find((d) => d.id === abilityId)?.cooldown || CFG.BLACKHOLE_COOLDOWN;
      if (state._multiSlots && !state._multiIsHost && state._socket) {
        sendPlayerAction({ type: "useAbility", abilityId, pid: state.myPlayerId, x: wx, y: wy });
        if (me) {
          if (!state._abilityCooldownsByPlayer[me.id]) state._abilityCooldownsByPlayer[me.id] = {};
          state._abilityCooldownsByPlayer[me.id][cooldownKey] = toSimSeconds(cooldownValue);
        }
      } else {
        if (abilityId === "microBlackHole") {
          spawnBlackHole(wx, wy, state.myPlayerId, {
            durationSec: 5,
            radius: Math.max(60, CFG.BLACKHOLE_RADIUS / 3),
            styleKey: "blood-meridian",
            damageScale: 1 / 3,
            finalBurstPct: 0.10 / 3
          });
        } else {
          spawnBlackHole(wx, wy, state.myPlayerId);
        }
        if (me) {
          if (!state._abilityCooldownsByPlayer[me.id]) state._abilityCooldownsByPlayer[me.id] = {};
          state._abilityCooldownsByPlayer[me.id][cooldownKey] = toSimSeconds(cooldownValue);
        }
        pushAbilityAnnouncement(state.myPlayerId, abilityId);
      }
      cancelAbilityTargeting();
      return true;
    } else if (state._abilityTargeting === "activeShield") {
      if (confirmPendingAbilityCardCast()) return true;
      const def = ABILITY_DEFS.find(d => d.id === "activeShield");
      if (state._multiSlots && !state._multiIsHost && state._socket) {
        sendPlayerAction({ type: "useAbility", abilityId: "activeShield", pid: state.myPlayerId });
      } else {
        useActiveShield(state.myPlayerId);
        if (def) setAbilityCooldown(state.myPlayerId, "activeShield", def.cooldown);
        pushAbilityAnnouncement(state.myPlayerId, "activeShield");
      }
      cancelAbilityTargeting();
      return true;
    } else if (state._abilityTargeting === "loan") {
      if (confirmPendingAbilityCardCast()) return true;
      const def = ABILITY_DEFS.find(d => d.id === "loan");
      if (state._multiSlots && !state._multiIsHost && state._socket) {
        sendPlayerAction({ type: "useAbility", abilityId: "loan", pid: state.myPlayerId });
      } else {
        useLoan(state.myPlayerId);
        if (def) setAbilityCooldown(state.myPlayerId, "loan", def.cooldown);
        pushAbilityAnnouncement(state.myPlayerId, "loan");
      }
      cancelAbilityTargeting();
      return true;
    } else if (state._abilityTargeting === "gloriousBattleMarch") {
      if (confirmPendingAbilityCardCast()) return true;
      const def = ABILITY_DEFS.find(d => d.id === "gloriousBattleMarch");
      if (state._multiSlots && !state._multiIsHost && state._socket) {
        sendPlayerAction({ type: "useAbility", abilityId: "gloriousBattleMarch", pid: state.myPlayerId });
      } else {
        useGloriousBattleMarch(state.myPlayerId);
        if (def) setAbilityCooldown(state.myPlayerId, "gloriousBattleMarch", def.cooldown);
        pushAbilityAnnouncement(state.myPlayerId, "gloriousBattleMarch");
      }
      cancelAbilityTargeting();
      return true;
    } else if (state._abilityTargeting === "raiderCapture" || state._abilityTargeting === "cosmicGodHand") {
      const abilityId = state._abilityTargeting;
      let targetCityId = null;
      for (const p of state.players.values()) {
        if (p.eliminated || p.id === state.myPlayerId) continue;
        const d2 = (wx - p.x) ** 2 + (wy - p.y) ** 2;
        if (d2 <= (getPlanetRadius(p) + 40) ** 2) { targetCityId = p.id; break; }
      }
      if (targetCityId == null) return false;
      if (confirmPendingAbilityCardCast({ targetCityId })) return true;
      const def = ABILITY_DEFS.find(d => d.id === abilityId);
      if (state._multiSlots && !state._multiIsHost && state._socket) {
        sendPlayerAction({ type: "useAbility", abilityId, pid: state.myPlayerId, targetCityId });
      } else {
        if (abilityId === "cosmicGodHand") useCosmicGodHand(state.myPlayerId, targetCityId);
        else useRaiderCapture(state.myPlayerId, targetCityId);
        if (def) setAbilityCooldown(state.myPlayerId, abilityId, def.cooldown);
        pushAbilityAnnouncement(state.myPlayerId, abilityId);
      }
      cancelAbilityTargeting();
      return true;
    } else if (state._abilityTargeting === "pirateRaid") {
      if (confirmPendingAbilityCardCast({ x: wx, y: wy })) return true;
      const def = ABILITY_DEFS.find(d => d.id === "pirateRaid");
      if (state._multiSlots && !state._multiIsHost && state._socket) {
        if (!isPirateRaidPointOnLane(wx, wy)) return false;
        sendPlayerAction({ type: "useAbility", abilityId: "pirateRaid", pid: state.myPlayerId, x: wx, y: wy });
      } else {
        if (!spawnPirateRaid(wx, wy, state.myPlayerId)) return false;
        if (def) setAbilityCooldown(state.myPlayerId, "pirateRaid", def.cooldown);
        pushAbilityAnnouncement(state.myPlayerId, "pirateRaid");
      }
      cancelAbilityTargeting();
      return true;
    } else if (state._abilityTargeting === "meteor") {
      const mt = state._meteorTargeting;
      if (mt.phase === "point") {
        mt.x = wx; mt.y = wy;
        mt.phase = "angle";
        syncAbilityTargetHint();
        return true;
      } else if (mt.phase === "angle") {
        if (!confirmPendingAbilityCardCast({ x: mt.x, y: mt.y, angle: mt.angle })) useMeteor(mt.x, mt.y, mt.angle);
        return true;
      }
    } else if (state._abilityTargeting === "spatialRift") {
      const mt = state._meteorTargeting;
      if (mt.phase === "point") {
        mt.x = wx; mt.y = wy;
        mt.phase = "angle";
        syncAbilityTargetHint();
        return true;
      } else if (mt.phase === "angle") {
        if (confirmPendingAbilityCardCast({ x: mt.x, y: mt.y, angle: mt.angle })) return true;
        const def = ABILITY_DEFS.find(d => d.id === "spatialRift");
        if (state._multiSlots && !state._multiIsHost && state._socket) {
          sendPlayerAction({ type: "useAbility", abilityId: "spatialRift", pid: state.myPlayerId, x: mt.x, y: mt.y, angle: mt.angle });
        } else {
          spawnSpatialRiftLocal(mt.x, mt.y, mt.angle, state.myPlayerId);
          if (def) setAbilityCooldown(state.myPlayerId, "spatialRift", def.cooldown);
          pushAbilityAnnouncement(state.myPlayerId, "spatialRift");
        }
        cancelAbilityTargeting();
        return true;
      }
    } else if (state._abilityTargeting === METEOR_SWARM_ABILITY_ID) {
      const mt = state._meteorTargeting;
      if (mt.phase === "point") {
        mt.x = wx; mt.y = wy;
        mt.phase = "angle";
        syncAbilityTargetHint();
        return true;
      } else if (mt.phase === "angle") {
        if (confirmPendingAbilityCardCast({ x: mt.x, y: mt.y, angle: mt.angle })) return true;
        const def = ABILITY_DEFS.find(d => d.id === METEOR_SWARM_ABILITY_ID);
        if (state._multiSlots && !state._multiIsHost && state._socket) {
          sendPlayerAction({ type: "useAbility", abilityId: METEOR_SWARM_ABILITY_ID, pid: state.myPlayerId, x: mt.x, y: mt.y, angle: mt.angle });
        } else {
          _spawnMeteorSwarmLocal(mt.x, mt.y, mt.angle, state.myPlayerId);
          if (def) setAbilityCooldown(state.myPlayerId, METEOR_SWARM_ABILITY_ID, def.cooldown);
          pushAbilityAnnouncement(state.myPlayerId, METEOR_SWARM_ABILITY_ID);
        }
        cancelAbilityTargeting();
        return true;
      }
    } else if (state._abilityTargeting === MINEFIELD_SMALL_ID || state._abilityTargeting === MINEFIELD_LARGE_ID) {
      const abilityId = state._abilityTargeting;
      const placement = getMinefieldPlacement(state.myPlayerId, wx, wy, abilityId);
      if (!placement || !placement.valid) return false;
      if (confirmPendingAbilityCardCast({ x: wx, y: wy })) return true;
      const def = ABILITY_DEFS.find(d => d.id === abilityId);
      if (state._multiSlots && !state._multiIsHost && state._socket) {
        sendPlayerAction({ type: "useAbility", abilityId, pid: state.myPlayerId, x: wx, y: wy });
      } else {
        const placed = deployMinefieldLocal(abilityId, wx, wy, state.myPlayerId);
        if (!placed || !placed.ok) return false;
        if (def) setAbilityCooldown(state.myPlayerId, abilityId, def.cooldown);
        pushAbilityAnnouncement(state.myPlayerId, abilityId);
      }
      cancelAbilityTargeting();
      return true;
    } else if (state._abilityTargeting === "orbitalStrike" || state._abilityTargeting === ORBITAL_BARRAGE_ID) {
      const abilityId = state._abilityTargeting;
      if (confirmPendingAbilityCardCast({ x: wx, y: wy })) return true;
      if (state._multiSlots && !state._multiIsHost && state._socket) {
        sendPlayerAction({ type: "useAbility", abilityId, pid: state.myPlayerId, x: wx, y: wy });
        cancelAbilityTargeting();
      } else {
        useAbilityAtPoint(abilityId, wx, wy, state.myPlayerId);
      }
      return true;
    } else {
      const pointAbilities = ["gravAnchor", "microAnchor", "fakeSignature", "timeSingularity", "nanoSwarm", "gravWave", "resourceRaid", "thermoNuke", "hyperJump"];
      if (pointAbilities.includes(state._abilityTargeting)) {
        if (confirmPendingAbilityCardCast({ x: wx, y: wy })) return true;
        if (state._multiSlots && !state._multiIsHost && state._socket) {
          sendPlayerAction({ type: "useAbility", abilityId: state._abilityTargeting, pid: state.myPlayerId, x: wx, y: wy });
          cancelAbilityTargeting();
        } else {
          useAbilityAtPoint(state._abilityTargeting, wx, wy, state.myPlayerId);
        }
        return true;
      }
    }
    return false;
  }

  function handleMobileAbilityTouchTap(clientX, clientY) {
    if (!state._abilityTargeting || state._mobileAbilityConfirm) return false;
    const wx = (clientX - cam.x) / cam.zoom;
    const wy = (clientY - cam.y) / cam.zoom;
    const abilityId = state._abilityTargeting;
    const rememberPreview = (worldX, worldY) => {
      state._mouseScreenX = clientX;
      state._mouseScreenY = clientY;
      state._mobileAbilityLockedPreview = { x: worldX, y: worldY, screenX: clientX, screenY: clientY };
    };
    const openConfirm = () => {
      const abilityName = getAbilityDisplayName(abilityId);
      openMobileAbilityConfirmation({
        title: "Активировать «" + abilityName + "»?",
        text: "Проверь область действия и подтверди применение.",
        onConfirm: () => handleAbilityTargetingPrimaryClick(wx, wy),
        onCancel: () => {
          state._mobileAbilityLockedPreview = null;
          syncAbilityTargetHint();
        }
      });
    };
    if (abilityId === "meteor" || abilityId === "spatialRift" || abilityId === METEOR_SWARM_ABILITY_ID) {
      const mt = state._meteorTargeting;
      if (!mt) return false;
      if (mt.phase === "point") {
        mt.x = wx;
        mt.y = wy;
        mt.phase = "angle";
        rememberPreview(wx, wy);
        syncAbilityTargetHint();
        return true;
      }
      if (mt.phase === "angle") {
        rememberPreview(mt.x, mt.y);
        openMobileAbilityConfirmation({
          title: "Активировать «" + getAbilityDisplayName(abilityId) + "»?",
          text: "Проверь точку и траекторию, затем подтверди удар.",
          onConfirm: () => handleAbilityTargetingPrimaryClick(wx, wy),
          onCancel: () => {
            state._mobileAbilityLockedPreview = null;
            syncAbilityTargetHint();
          }
        });
        return true;
      }
    }
    if ((abilityId === MINEFIELD_SMALL_ID || abilityId === MINEFIELD_LARGE_ID) && !getMinefieldPlacement(state.myPlayerId, wx, wy, abilityId)?.valid) {
      return false;
    }
    if (abilityId === "pirateRaid" && !isPirateRaidPointOnLane(wx, wy)) {
      return false;
    }
    if (abilityId === "raiderCapture" || abilityId === "cosmicGodHand") {
      let targetCityId = null;
      for (const p of state.players.values()) {
        if (p.eliminated || p.id === state.myPlayerId) continue;
        const d2 = (wx - p.x) ** 2 + (wy - p.y) ** 2;
        if (d2 <= (getPlanetRadius(p) + 40) ** 2) { targetCityId = p.id; break; }
      }
      if (targetCityId == null) return false;
    }
    rememberPreview(wx, wy);
    openConfirm();
    return true;
  }

  app.canvas.addEventListener("mousedown", (e) => {
    if (!state._abilityTargeting) return;
    if (e.button === 0) {
      e.stopPropagation();
      e.preventDefault();
      const wx = (e.clientX - cam.x) / cam.zoom;
      const wy = (e.clientY - cam.y) / cam.zoom;
      handleAbilityTargetingPrimaryClick(wx, wy);
    }
  }, true);

  app.canvas.addEventListener("mousemove", (e) => {
    state._mouseScreenX = e.clientX;
    state._mouseScreenY = e.clientY;
    if (state._meteorTargeting && state._meteorTargeting.phase === "angle") {
      updateMeteorTouchAngle(e.clientX, e.clientY);
    }
  });

  app.canvas.addEventListener("pointermove", (e) => {
    if (!state._abilityTargeting) return;
    state._mouseScreenX = e.clientX;
    state._mouseScreenY = e.clientY;
    if (e.pointerType === "touch" && state._meteorTargeting && state._meteorTargeting.phase === "angle") {
      updateMeteorTouchAngle(e.clientX, e.clientY);
    }
  }, true);

  app.canvas.addEventListener("pointerdown", (e) => {
    if (!state._abilityTargeting) return;
    if (e.pointerType !== "touch" || !isMobileAbilityConfirmationMode()) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    handleMobileAbilityTouchTap(e.clientX, e.clientY);
  }, true);

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
    const gridState = sharedCitySimApi ? sharedCitySimApi.getZoneGridState() : null;
    const grid = gridState ? gridState.grid : null;
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

    const aliveCorePlayers = [...state.players.values()].filter((p) => p && p.id > 0 && !p.eliminated);
    const enemyCorePlayers = aliveCorePlayers.filter((p) => p.id !== state.myPlayerId);
    if (aliveCorePlayers.length === 1 && aliveCorePlayers[0].id === state.myPlayerId) {
      triggerVictory("Все вражеские города уничтожены!");
      return;
    }
    if (enemyCorePlayers.length === 0) {
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
    if (state._gameOver) return;
    const me = state.players.get(state.myPlayerId);
    const economy = {
      credits: me ? Math.round(me.eCredits || 0) : 0,
      energy: me ? Math.round(me.pop || 0) : 0,
      mines: [...state.mines.values()].filter((mine) => mine.ownerId === state.myPlayerId).length
    };
    const summary = coreMatchStateApi && typeof coreMatchStateApi.finishMatch === "function"
      ? coreMatchStateApi.finishMatch("victory", {
          reason,
          mode: state._soloGameMode === "quad" ? "quad" : "duel",
          difficulty: state._soloDifficulty || "easy",
          durationSec: coreMatchStateApi.getCurrentDurationSec ? coreMatchStateApi.getCurrentDurationSec() : Math.round(state.t || 0),
          economy
        })
      : { reason, mode: state._soloGameMode === "quad" ? "quad" : "duel", difficulty: state._soloDifficulty || "easy", durationSec: Math.round(state.t || 0), economy };
    const rewards = singleProfileApi && typeof singleProfileApi.recordMatch === "function"
      ? singleProfileApi.recordMatch(summary)
      : null;
    if (summary) summary.rewards = rewards;
    state._gameOver = true;
    const overlay = document.getElementById("victoryOverlay");
    const text = document.getElementById("victoryText");
    if (overlay) overlay.style.display = "flex";
    if (text) text.textContent = reason;
    if (singleMenuUiApi && singleMenuUiApi.renderVictorySummary) singleMenuUiApi.renderVictorySummary(summary);
    document.getElementById("dominationTimer").style.display = "none";
    syncPlatformGameplayState();
  }

  function triggerDefeat(reason) {
    if (state._gameOver) return;
    const me = state.players.get(state.myPlayerId);
    const economy = {
      credits: me ? Math.round(me.eCredits || 0) : 0,
      energy: me ? Math.round(me.pop || 0) : 0,
      mines: [...state.mines.values()].filter((mine) => mine.ownerId === state.myPlayerId).length
    };
    const summary = coreMatchStateApi && typeof coreMatchStateApi.finishMatch === "function"
      ? coreMatchStateApi.finishMatch("defeat", {
          reason,
          mode: state._soloGameMode === "quad" ? "quad" : "duel",
          difficulty: state._soloDifficulty || "easy",
          durationSec: coreMatchStateApi.getCurrentDurationSec ? coreMatchStateApi.getCurrentDurationSec() : Math.round(state.t || 0),
          economy
        })
      : { reason, mode: state._soloGameMode === "quad" ? "quad" : "duel", difficulty: state._soloDifficulty || "easy", durationSec: Math.round(state.t || 0), economy };
    const rewards = singleProfileApi && typeof singleProfileApi.recordMatch === "function"
      ? singleProfileApi.recordMatch(summary)
      : null;
    if (summary) summary.rewards = rewards;
    state._gameOver = true;
    const overlay = document.getElementById("victoryOverlay");
    const text = document.getElementById("victoryText");
    const title = overlay?.querySelector(".victory-title");
    if (title) { title.textContent = "ПОРАЖЕНИЕ"; title.style.color = "#ff4444"; }
    if (overlay) overlay.style.display = "flex";
    if (text) text.textContent = reason;
    if (singleMenuUiApi && singleMenuUiApi.renderVictorySummary) singleMenuUiApi.renderVictorySummary(summary);
    document.getElementById("dominationTimer").style.display = "none";
    syncPlatformGameplayState();
  }

  document.getElementById("victoryRestart")?.addEventListener("click", () => {
    const restartMatch = () => {
      state._gameOver = false;
      state._domTimers = {};
      document.getElementById("victoryOverlay").style.display = "none";
      const title = document.querySelector(".victory-title");
      if (title) { title.textContent = "ПОБЕДА!"; title.style.color = "#ffd700"; }
      resetWorld();
      for (const p of state.players.values()) { redrawZone(p); rebuildTurrets(p); }
      syncPlatformGameplayState();
    };
    if (platformApi && typeof platformApi.showFullscreenAd === "function") {
      const shown = platformApi.showFullscreenAd({
        onClose: restartMatch,
        onError: restartMatch
      });
      if (!shown) restartMatch();
      return;
    }
    restartMatch();
  });
  document.getElementById("victoryMenu")?.addEventListener("click", () => {
    const overlay = document.getElementById("victoryOverlay");
    if (overlay) overlay.style.display = "none";
    const title = document.querySelector(".victory-title");
    if (title) { title.textContent = "ПОБЕДА!"; title.style.color = "#ffd700"; }
    if (singleMenuUiApi && singleMenuUiApi.renderResultsPanels) singleMenuUiApi.renderResultsPanels();
    showScreen("mainMenu");
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
  const menuSimBackdropEl = document.getElementById("menuSimBackdrop");
  const menuSimCanvasEl = document.getElementById("menuSimCanvas");
  const rotatePromptEl = document.getElementById("rotatePrompt");
  const mobileGameHudBarEl = document.getElementById("mobileGameHudBar");
  const mobileServiceBtnEl = document.getElementById("mobileServiceBtn");
  const musicPlayerDockEl = document.getElementById("musicPlayerDock");
  const musicPopupBtnEl = document.getElementById("musicPopupBtn");
  const gameMenuBtnEl = document.getElementById("gameMenuBtn");
  const gameTopActionsEl = document.getElementById("gameTopActions");

  const SOLO_PALETTE = [0xff8800, 0xcc2222, 0xddcc00, 0x4488ff, 0x22aa44, 0xaa44cc, 0x44cccc];
  state._soloColorIndex = 0;
  state._soloDifficulty = state._soloDifficulty || "easy";
  state._quickStartScenario = null;
  state._soloNoBotAi = false;

  function getCurrentNicknameValue() {
    return (
      state._myNickname
      || (typeof window !== "undefined" ? window._myNickname : "")
      || (nicknameInputEl ? nicknameInputEl.value : "")
      || ""
    ).trim();
  }

  function isPrivilegedDebugNickname() {
    return getCurrentNicknameValue() === "qD319";
  }

  function isMobileViewportLike() {
    if (typeof window === "undefined") return false;
    const ua = typeof navigator !== "undefined" ? String(navigator.userAgent || "") : "";
    return ("ontouchstart" in window)
      || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)
      || /android|iphone|ipad|ipod|mobile/i.test(ua);
  }

  function shouldShowRotatePrompt() {
    if (!rotatePromptEl || typeof window === "undefined") return false;
    if (!isMobileViewportLike()) return false;
    return window.innerHeight > window.innerWidth;
  }

  function isCompactMobileUi() {
    return false;
  }

  function getMobilePanelElements() {
    return ["hud", "bottomRightPanel"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);
  }

  function setMobileHudMode(mode) {
    const hud = document.getElementById("hud");
    const nextMode = mode === "stats" ? "stats" : "shipyard";
    state._mobileHudMode = nextMode;
    if (!hud) return;
    hud.classList.toggle("hud-mobile-mode-shipyard", nextMode === "shipyard");
    hud.classList.toggle("hud-mobile-mode-stats", nextMode === "stats");
  }

  function syncMobileHudButtons() {
    if (!mobileGameHudBarEl) return;
    mobileGameHudBarEl.querySelectorAll("[data-mobile-panel]").forEach((btn) => {
      const panelId = btn.getAttribute("data-mobile-panel");
      const hudMode = btn.getAttribute("data-mobile-hud-mode");
      const active = panelId === (state._mobileHudOpenPanelId || "")
        && (panelId !== "hud" || hudMode === (state._mobileHudMode || "shipyard"));
      btn.classList.toggle("is-active", active);
    });
  }

  function closeAllMobilePanels() {
    state._mobileHudOpenPanelId = null;
    getMobilePanelElements().forEach((panel) => panel.classList.remove("is-mobile-panel-open"));
    syncMobileHudButtons();
  }

  function openMobilePanel(panelId, options) {
    if (!isCompactMobileUi()) return;
    const opts = options || {};
    state._mobileHudOpenPanelId = panelId || null;
    if (panelId === "hud") setMobileHudMode(opts.hudMode || state._mobileHudMode || "shipyard");
    getMobilePanelElements().forEach((panel) => {
      const shouldOpen = !!panelId && panel.id === panelId;
      panel.classList.toggle("is-mobile-panel-open", shouldOpen);
      if (shouldOpen && panel.tagName === "DETAILS") panel.open = true;
    });
    syncMobileHudButtons();
  }

  function syncMobileUiState() {
    const mobileUi = isCompactMobileUi();
    if (typeof document !== "undefined") document.body.classList.toggle("mobile-ui", mobileUi);
    const gameVisible = !!(gameWrapEl && gameWrapEl.style.display !== "none");
    if (mobileGameHudBarEl) mobileGameHudBarEl.style.display = mobileUi && gameVisible ? "flex" : "none";
    if (gameTopActionsEl) gameTopActionsEl.style.display = gameVisible ? "flex" : "none";
    if (!mobileUi || !gameVisible) {
      closeAllMobilePanels();
      return;
    }
    if (!state._mobileHudInitDone) {
      state._mobileHudInitDone = true;
      setMobileHudMode("shipyard");
      closeAllMobilePanels();
    } else if (state._mobileHudOpenPanelId) {
      openMobilePanel(state._mobileHudOpenPanelId, { hudMode: state._mobileHudMode || "shipyard" });
    } else {
      syncMobileHudButtons();
    }
  }

  function syncPrivilegedUi() {
    const privileged = isPrivilegedDebugNickname();
    const bottomRightPanel = document.getElementById("bottomRightPanel");
    if (bottomRightPanel) bottomRightPanel.style.display = privileged ? "flex" : "none";
    if (mobileServiceBtnEl) mobileServiceBtnEl.style.display = privileged ? "" : "none";
    if (!privileged && state._mobileHudOpenPanelId === "bottomRightPanel") closeAllMobilePanels();
  }

  function syncPlatformGameplayState() {
    syncMobileUiState();
    syncPrivilegedUi();
    syncAbilityTargetHint();
    const showRotatePrompt = shouldShowRotatePrompt();
    if (rotatePromptEl) {
      rotatePromptEl.style.display = showRotatePrompt ? "flex" : "none";
      rotatePromptEl.setAttribute("aria-hidden", showRotatePrompt ? "false" : "true");
    }
    if (showRotatePrompt) pauseGameplay("rotate-prompt");
    else resumeGameplay("rotate-prompt");
    const isGameScreenVisible = !!(gameWrapEl && gameWrapEl.style.display !== "none");
    const shouldMarkGameplayActive = isGameScreenVisible && !state._gameOver && !showRotatePrompt;
    if (platformApi && typeof platformApi.stopGameplay === "function" && !shouldMarkGameplayActive) {
      platformApi.stopGameplay();
    } else if (platformApi && typeof platformApi.startGameplay === "function" && shouldMarkGameplayActive) {
      platformApi.startGameplay();
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("resize", syncPlatformGameplayState);
    window.addEventListener("orientationchange", syncPlatformGameplayState);
  }
  if (typeof document !== "undefined") {
    document.addEventListener("contextmenu", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest("canvas, #gameWrap, #hud, #topRightPanel, #bottomRightPanel, #cardHud, #victoryOverlay, #rotatePrompt, #mobileGameHudBar, #gameTopActions, #musicPlayerDock")) {
        event.preventDefault();
      }
    }, true);
    document.addEventListener("pointerdown", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || !document.body.classList.contains("mobile-ui")) return;
      if (target.closest("#mobileGameHudBar, #hud, #topRightPanel, #bottomRightPanel, #cardHud, #victoryOverlay, #abilityOverlay, #cardModal, #gameChatWrap, #enemyComparePanel, #gameTopActions, #musicPlayerDock")) return;
      if (target.closest("canvas, #gameWrap")) closeAllMobilePanels();
    }, true);
    document.addEventListener("pointerdown", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || !musicPlayerDockEl || !musicPlayerDockEl.classList.contains("popup-open")) return;
      if (target.closest("#musicPlayerDock, #musicPopupBtn")) return;
      musicPlayerDockEl.classList.remove("popup-open");
    }, true);
  }
  if (mobileGameHudBarEl) {
    mobileGameHudBarEl.querySelectorAll(".mobile-game-hud-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const panelId = btn.getAttribute("data-mobile-panel");
        if (!panelId) return;
        const hudMode = btn.getAttribute("data-mobile-hud-mode");
        const sameHudMode = panelId === "hud" && hudMode === (state._mobileHudMode || "shipyard");
        if (state._mobileHudOpenPanelId === panelId && (panelId !== "hud" || sameHudMode)) closeAllMobilePanels();
        else openMobilePanel(panelId, { hudMode });
      });
    });
  }
  if (musicPopupBtnEl && musicPlayerDockEl) {
    musicPopupBtnEl.addEventListener("click", () => {
      musicPlayerDockEl.classList.toggle("popup-open");
    });
  }
  if (gameMenuBtnEl) {
    gameMenuBtnEl.addEventListener("click", () => {
      closeAllMobilePanels();
      if (musicPlayerDockEl) musicPlayerDockEl.classList.remove("popup-open");
      showScreen("mainMenu");
    });
  }

  const menuSimApi = (() => {
    if (!menuSimBackdropEl || !menuSimCanvasEl) return null;
    const ctx = menuSimCanvasEl.getContext("2d", { alpha: true });
    if (!ctx) return null;
    const useRealMenuWorld = true;
    if (useRealMenuWorld) {
      function setVisible(visible) {
        menuSimBackdropEl.style.display = visible ? "block" : "none";
      }
      return { setVisible };
    }

    const SIM_FPS = 30;
    const FRAME_MS = 1000 / SIM_FPS;
    const ARENA_COUNT = 1;
    const UNIT_LIMIT_PER_SIDE = 34;
    const SHOT_LIMIT = 150;
    const STAR_COUNT = 180;
    const TAU = Math.PI * 2;
    const sim = {
      visible: false,
      raf: 0,
      lastNow: 0,
      width: 1,
      height: 1,
      dpr: 1,
      stars: [],
      arenas: [],
      time: 0
    };
    const MENU_SIM_UNIT_TYPES = CORE_ROSTER_UNIT_TYPES.map((key) => {
      const type = UNIT_TYPES[key] || UNIT_TYPES.destroyer;
      return {
        key,
        speed: type.speed * 2.35,
        hp: Math.max(10, Math.round(type.hp * 0.24)),
        damage: Math.max(2, Math.round(type.damage * 0.90)),
        range: type.attackRange * 0.92,
        reload: Math.max(0.18, 1 / Math.max(0.01, type.attackRate)),
        size: 2.2 + (type.sizeMultiplier || 1) * 0.85
      };
    });

    function rnd(min, max) { return min + Math.random() * (max - min); }
    function clamp01(v) { return Math.max(0, Math.min(1, v)); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function hexToRgb(hex) {
      return {
        r: (hex >> 16) & 0xff,
        g: (hex >> 8) & 0xff,
        b: hex & 0xff
      };
    }
    function rgba(hex, a) {
      const c = hexToRgb(hex);
      return "rgba(" + c.r + "," + c.g + "," + c.b + "," + a.toFixed(3) + ")";
    }
    function tracePoly(points) {
      if (!points || points.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.closePath();
    }
    function softEllipse(x, y, rx, ry, color, alpha) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx * 1.46, ry * 1.46, 0, 0, TAU);
      ctx.fillStyle = rgba(color, alpha * 0.10);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y, rx * 1.18, ry * 1.18, 0, 0, TAU);
      ctx.fillStyle = rgba(color, alpha * 0.18);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
      ctx.fillStyle = rgba(color, alpha * 0.32);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y, rx * 0.76, ry * 0.76, 0, 0, TAU);
      ctx.fillStyle = rgba(color, alpha * 0.22);
      ctx.fill();
    }
    function buildStars() {
      sim.stars.length = 0;
      for (let i = 0; i < STAR_COUNT; i++) {
        sim.stars.push({
          x: Math.random() * sim.width,
          y: Math.random() * sim.height,
          r: 0.5 + Math.random() * 1.8,
          a: 0.08 + Math.random() * 0.52,
          t: Math.random() * TAU,
          s: 0.4 + Math.random() * 1.8,
          depth: 0.25 + Math.random() * 0.75
        });
      }
    }
    function createCore(side, x, y, color) {
      return {
        side,
        x,
        y,
        hp: 320,
        maxHp: 320,
        spawnCd: rnd(0.10, 0.30),
        spawnRate: rnd(0.34, 0.50),
        color,
        orbit: Math.random() * TAU,
        pulse: Math.random() * TAU,
        zoneRadius: (CFG.INFLUENCE_BASE_R || 240) * rnd(1.04, 1.16)
      };
    }
    function createMenuNebula(x, y, radius, variantIndex) {
      const neb = {
        x, y, radius,
        _baseX: x,
        _baseY: y,
        _baseRadius: radius,
        _visualVariantIndex: variantIndex
      };
      initNebulaVisual(neb, variantIndex);
      neb._menuFloatPhaseX = Math.random() * TAU;
      neb._menuFloatPhaseY = Math.random() * TAU;
      neb._menuBreathPhase = Math.random() * TAU;
      neb._menuFloatAmpX = radius * rnd(0.02, 0.05);
      neb._menuFloatAmpY = radius * rnd(0.015, 0.04);
      neb._menuBreathAmp = rnd(0.015, 0.035);
      return neb;
    }
    function getMenuNebulaZone(neb, time) {
      return {
        x: (neb._baseX ?? neb.x) + Math.sin(time * 0.08 + (neb._menuFloatPhaseX || 0)) * (neb._menuFloatAmpX || 0),
        y: (neb._baseY ?? neb.y) + Math.cos(time * 0.07 + (neb._menuFloatPhaseY || 0)) * (neb._menuFloatAmpY || 0),
        radius: (neb._baseRadius ?? neb.radius) * (1 + Math.sin(time * 0.12 + (neb._menuBreathPhase || 0)) * (neb._menuBreathAmp || 0))
      };
    }
    function buildArena(index) {
      const bandH = sim.height * 0.44;
      const laneY = sim.height * 0.53;
      const laneTop = laneY - bandH * 0.5;
      const leftX = sim.width * 0.18;
      const rightX = sim.width * 0.82;
      const arena = {
        index,
        y: laneY,
        top: laneTop,
        height: bandH,
        leftX,
        rightX,
        centerX: (leftX + rightX) * 0.5,
        units: [],
        shots: [],
        sparks: [],
        blackHole: null,
        holeUsed: false,
        winner: null,
        winnerTimer: 0,
        roundTime: 0,
        nebulas: []
      };
      arena.leftCore = createCore(0, leftX, laneY + rnd(-28, 18), 0xff8800);
      arena.rightCore = createCore(1, rightX, laneY + rnd(-18, 28), 0x4488ff);
      arena.nebulas = [
        createMenuNebula(arena.centerX + rnd(-70, 10), laneY + rnd(-bandH * 0.16, bandH * 0.10), bandH * rnd(0.26, 0.34), (index * 2) % NEBULA_VISUAL_VARIANTS.length),
        createMenuNebula(arena.centerX + rnd(40, 120), laneY + rnd(-bandH * 0.12, bandH * 0.14), bandH * rnd(0.18, 0.26), (index * 2 + 1) % NEBULA_VISUAL_VARIANTS.length)
      ];
      return arena;
    }
    function rebuildArenas() {
      sim.arenas = [];
      for (let i = 0; i < ARENA_COUNT; i++) sim.arenas.push(buildArena(i));
    }
    function resize() {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      sim.dpr = dpr;
      sim.width = w;
      sim.height = h;
      menuSimCanvasEl.width = Math.round(w * dpr);
      menuSimCanvasEl.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStars();
      rebuildArenas();
    }
    function resetArena(arena) {
      const fresh = buildArena(arena.index);
      arena.y = fresh.y;
      arena.top = fresh.top;
      arena.height = fresh.height;
      arena.leftX = fresh.leftX;
      arena.rightX = fresh.rightX;
      arena.centerX = fresh.centerX;
      arena.leftCore = fresh.leftCore;
      arena.rightCore = fresh.rightCore;
      arena.nebulas = fresh.nebulas;
      arena.units.length = 0;
      arena.shots.length = 0;
      arena.sparks.length = 0;
      arena.blackHole = null;
      arena.holeUsed = false;
      arena.winner = null;
      arena.winnerTimer = 0;
      arena.roundTime = 0;
    }
    function countUnits(arena, side) {
      let n = 0;
      for (let i = 0; i < arena.units.length; i++) if (arena.units[i].side === side && arena.units[i].hp > 0) n++;
      return n;
    }
    function spawnUnit(arena, core) {
      if (!core || core.hp <= 0) return;
      if (countUnits(arena, core.side) >= UNIT_LIMIT_PER_SIDE) return;
      const type = MENU_SIM_UNIT_TYPES[(Math.random() * MENU_SIM_UNIT_TYPES.length) | 0];
      const dir = core.side === 0 ? 1 : -1;
      arena.units.push({
        side: core.side,
        x: core.x + dir * rnd(32, 50),
        y: core.y + rnd(-36, 36),
        vx: 0,
        vy: 0,
        hp: type.hp,
        maxHp: type.hp,
        speed: type.speed * rnd(0.92, 1.08),
        damage: type.damage,
        range: type.range,
        reload: rnd(0.0, type.reload),
        reloadBase: type.reload,
        size: type.size,
        wobble: Math.random() * TAU
      });
    }
    function acquireTarget(arena, unit) {
      let best = null;
      let bestD2 = unit.range * unit.range;
      for (let i = 0; i < arena.units.length; i++) {
        const other = arena.units[i];
        if (other.side === unit.side || other.hp <= 0) continue;
        const dx = other.x - unit.x;
        const dy = other.y - unit.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = { kind: "unit", unit: other };
        }
      }
      const enemyCore = unit.side === 0 ? arena.rightCore : arena.leftCore;
      if (enemyCore && enemyCore.hp > 0) {
        const dx = enemyCore.x - unit.x;
        const dy = enemyCore.y - unit.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2 * 1.4) best = { kind: "core", core: enemyCore };
      }
      return best;
    }
    function spawnShot(arena, unit, target) {
      if (arena.shots.length >= SHOT_LIMIT) return;
      const tx = target.kind === "core" ? target.core.x : target.unit.x;
      const ty = target.kind === "core" ? target.core.y : target.unit.y;
      const dx = tx - unit.x;
      const dy = ty - unit.y;
      const len = Math.hypot(dx, dy) || 1;
      arena.shots.push({
        side: unit.side,
        x: unit.x,
        y: unit.y,
        vx: dx / len * 248,
        vy: dy / len * 248,
        damage: unit.damage,
        life: 1.15,
        target
      });
    }
    function spawnBlackHole(arena) {
      arena.blackHole = {
        x: arena.centerX + rnd(-56, 56),
        y: arena.y + rnd(-arena.height * 0.20, arena.height * 0.20),
        r: rnd(26, 38),
        life: 5.6,
        maxLife: 5.6,
        pull: rnd(150, 220)
      };
      arena.holeUsed = true;
    }
    function applyBlackHoleForce(arena, obj, dt, massMul) {
      if (!arena.blackHole) return;
      const dx = arena.blackHole.x - obj.x;
      const dy = arena.blackHole.y - obj.y;
      const d = Math.hypot(dx, dy) || 1;
      const infl = clamp01(1 - d / (arena.blackHole.r * 6.2));
      if (infl <= 0) return;
      const pull = arena.blackHole.pull * infl * dt * massMul;
      obj.x += dx / d * pull;
      obj.y += dy / d * pull;
    }
    function spawnSpark(arena, x, y, side) {
      if (arena.sparks.length > 90) return;
      const color = side === 0 ? 0xffb980 : 0x9bc6ff;
      arena.sparks.push({
        x,
        y,
        vx: rnd(-26, 26),
        vy: rnd(-26, 26),
        life: rnd(0.24, 0.50),
        maxLife: 0.50,
        color
      });
    }
    function updateArena(arena, dt) {
      arena.roundTime += dt;
      arena.leftCore.orbit += dt * 0.42;
      arena.rightCore.orbit -= dt * 0.42;
      arena.leftCore.pulse += dt * 1.26;
      arena.rightCore.pulse += dt * 1.18;

      if (!arena.winner) {
        const cores = [arena.leftCore, arena.rightCore];
        for (let i = 0; i < cores.length; i++) {
          const core = cores[i];
          if (!core || core.hp <= 0) continue;
          core.spawnCd -= dt;
          if (core.spawnCd <= 0) {
            spawnUnit(arena, core);
            core.spawnCd = core.spawnRate * rnd(0.86, 1.14);
          }
        }
        if (!arena.holeUsed && arena.roundTime > 7.5) spawnBlackHole(arena);
      }

      if (arena.blackHole) {
        arena.blackHole.life -= dt;
        if (arena.blackHole.life <= 0) arena.blackHole = null;
      }

      const laneMinY = arena.top + 20;
      const laneMaxY = arena.top + arena.height - 20;

      for (let i = arena.units.length - 1; i >= 0; i--) {
        const u = arena.units[i];
        if (u.hp <= 0) { arena.units.splice(i, 1); continue; }
        u.reload -= dt;
        const target = acquireTarget(arena, u);
        const enemyCore = u.side === 0 ? arena.rightCore : arena.leftCore;
        const tx = target ? (target.kind === "core" ? target.core.x : target.unit.x) : (enemyCore ? enemyCore.x : u.x);
        const ty = target ? (target.kind === "core" ? target.core.y : target.unit.y) : (enemyCore ? enemyCore.y : u.y);
        const dx = tx - u.x;
        const dy = ty - u.y;
        const d = Math.hypot(dx, dy) || 1;
        if (target && d <= u.range) {
          if (u.reload <= 0) {
            spawnShot(arena, u, target);
            u.reload = u.reloadBase * rnd(0.86, 1.12);
          }
          u.vx *= 0.84;
          u.vy *= 0.84;
        } else {
          const nx = dx / d;
          const ny = dy / d;
          const tangent = Math.sin(arena.roundTime * 0.8 + u.wobble) * 14;
          u.vx += (nx * u.speed - u.vx) * 0.08;
          u.vy += (ny * u.speed * 0.62 + tangent - u.vy) * 0.08;
        }
        u.x += u.vx * dt;
        u.y += u.vy * dt;
        applyBlackHoleForce(arena, u, dt, 1.0);
        u.y = Math.max(laneMinY, Math.min(laneMaxY, u.y));
      }

      for (let i = arena.shots.length - 1; i >= 0; i--) {
        const s = arena.shots[i];
        s.life -= dt;
        if (s.life <= 0) { arena.shots.splice(i, 1); continue; }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        applyBlackHoleForce(arena, s, dt, 0.7);
        const target = s.target;
        if (target.kind === "unit") {
          if (!target.unit || target.unit.hp <= 0) { arena.shots.splice(i, 1); continue; }
          if (Math.hypot(target.unit.x - s.x, target.unit.y - s.y) <= target.unit.size + 4) {
            target.unit.hp -= s.damage;
            for (let j = 0; j < 3; j++) spawnSpark(arena, s.x, s.y, s.side);
            arena.shots.splice(i, 1);
            continue;
          }
        } else if (target.kind === "core") {
          if (!target.core || target.core.hp <= 0) { arena.shots.splice(i, 1); continue; }
          if (Math.hypot(target.core.x - s.x, target.core.y - s.y) <= 24) {
            target.core.hp -= s.damage;
            for (let j = 0; j < 5; j++) spawnSpark(arena, s.x, s.y, s.side);
            arena.shots.splice(i, 1);
            continue;
          }
        }
      }

      for (let i = arena.sparks.length - 1; i >= 0; i--) {
        const p = arena.sparks[i];
        p.life -= dt;
        if (p.life <= 0) { arena.sparks.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
      }

      if (!arena.winner) {
        if (arena.leftCore.hp <= 0 || arena.rightCore.hp <= 0 || arena.roundTime > 30) {
          arena.winner = arena.leftCore.hp > arena.rightCore.hp ? 0 : 1;
          arena.winnerTimer = 3.4;
          arena.blackHole = null;
        }
      } else {
        arena.winnerTimer -= dt;
        if (arena.winnerTimer <= 0) resetArena(arena);
      }
    }
    function buildZonePoints(core, arena, scaleMul) {
      const pts = [];
      const steps = 38;
      const forwardSign = core.side === 0 ? 1 : -1;
      const baseR = core.zoneRadius * scaleMul;
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * TAU;
        const forward = Math.cos(angle) * forwardSign;
        const lateral = Math.abs(Math.sin(angle));
        const wobble =
          Math.sin(angle * 2.0 + core.orbit) * 0.05 +
          Math.sin(angle * 5.0 + core.pulse) * 0.02;
        const radial = baseR * (1 + wobble + Math.max(0, forward) * 0.18 - Math.max(0, -forward) * 0.04);
        pts.push({
          x: core.x + Math.cos(angle) * radial * (1.14 + Math.max(0, forward) * 0.24),
          y: core.y + Math.sin(angle) * radial * (0.88 + lateral * 0.08)
        });
      }
      return pts;
    }
    function drawZone(core, arena) {
      const palette = FACTION_VIS.getFactionPalette(core.color);
      const outer = buildZonePoints(core, arena, 1.06);
      const mid = buildZonePoints(core, arena, 1.0);
      const inner = buildZonePoints(core, arena, 0.92);

      tracePoly(outer);
      ctx.fillStyle = rgba(palette.core, 0.030);
      ctx.fill();
      tracePoly(mid);
      ctx.fillStyle = rgba(palette.core, 0.050);
      ctx.fill();
      tracePoly(inner);
      ctx.fillStyle = rgba(palette.core, 0.034);
      ctx.fill();

      tracePoly(outer);
      ctx.strokeStyle = rgba(palette.edge, 0.06);
      ctx.lineWidth = 10;
      ctx.stroke();
      tracePoly(mid);
      ctx.strokeStyle = rgba(palette.edge, 0.10);
      ctx.lineWidth = 4;
      ctx.stroke();
      tracePoly(mid);
      ctx.strokeStyle = rgba(palette.edge, 0.20);
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
    function drawMenuCore(core) {
      const pulse = 0.82 + 0.18 * Math.sin(core.pulse);
      const palette = FACTION_VIS.getFactionPalette(core.color);
      const radiusRef = getPlanetRadius({ influenceR: core.zoneRadius });
      const haloR = radiusRef * 1.85;
      const shellR = radiusRef * 0.96;
      const coreR = radiusRef * 0.54;

      ctx.beginPath();
      ctx.arc(core.x, core.y, haloR, 0, TAU);
      ctx.fillStyle = rgba(palette.glow || core.color, 0.08);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(core.x, core.y, shellR, 0, TAU);
      ctx.fillStyle = "rgba(5,9,18,0.92)";
      ctx.fill();
      ctx.strokeStyle = rgba(palette.edge, 0.30);
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(core.x, core.y, radiusRef * 0.74, 0, TAU);
      ctx.fillStyle = rgba(palette.core, 0.16);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(core.x, core.y, coreR, 0, TAU);
      ctx.fillStyle = rgba(palette.core, 0.34);
      ctx.fill();
      ctx.strokeStyle = rgba(palette.solid || palette.edge, 0.48);
      ctx.lineWidth = 1.1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(core.x, core.y, radiusRef * 0.24, 0, TAU);
      ctx.fillStyle = rgba(palette.core, 0.58);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(core.x, core.y, radiusRef * 0.10, 0, TAU);
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.fill();

      ctx.strokeStyle = rgba(palette.edge, 0.20);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(core.x, core.y, radiusRef * 0.42, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(core.x, core.y, radiusRef * 0.60, 0, TAU);
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = rgba(palette.edge, 0.14);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(core.x - radiusRef * 0.10, core.y - radiusRef * 0.12, radiusRef * 0.18, 0, TAU);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fill();

      const ringRadii = [radiusRef * 1.08, radiusRef * 1.34];
      for (let i = 0; i < ringRadii.length; i++) {
        ctx.save();
        ctx.translate(core.x, core.y);
        ctx.rotate(core.orbit * (i === 0 ? 0.8 : -0.55));
        ctx.beginPath();
        ctx.ellipse(0, 0, ringRadii[i], ringRadii[i] * 0.42, 0, 0, TAU);
        ctx.strokeStyle = rgba(palette.edge, i === 0 ? 0.22 : 0.16);
        ctx.lineWidth = 0.95;
        ctx.stroke();
        ctx.restore();
      }

      const shieldPct = clamp01(core.hp / core.maxHp);
      const shieldR = radiusRef + 12;
      ctx.beginPath();
      ctx.arc(core.x, core.y, shieldR + 4, 0, TAU);
      ctx.strokeStyle = rgba(core.color, 0.10 * shieldPct * pulse);
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(core.x, core.y, shieldR, 0, TAU);
      ctx.strokeStyle = rgba(core.color, 0.38 * shieldPct * pulse);
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
    function drawNebula(neb) {
      const visual = getMenuNebulaZone(neb, sim.time);
      const variant = getNebulaVisualVariant(neb);
      const fillColor = neb._fillColor || (variant.cloudColors && variant.cloudColors[0]) || 0x3b467a;
      const detail = { outlineSteps: 26, outlineSmoothPasses: 2, plumes: 4, knots: 2, ribbons: 2, fringePoints: 6 };
      const localNeb = { ...neb, x: 0, y: 0, radius: visual.radius };
      const feather = buildNebulaOutlinePoints(localNeb, detail, 1.24 * variant.outerMul);
      const outer = buildNebulaOutlinePoints(localNeb, detail, 1.10 * variant.outerMul);
      const mid = buildNebulaOutlinePoints(localNeb, detail, 1.00);
      const inner = buildNebulaOutlinePoints(localNeb, detail, 0.90 * variant.innerMul);

      ctx.save();
      ctx.translate(visual.x, visual.y);
      tracePoly(feather);
      ctx.fillStyle = rgba(fillColor, 0.024 * (variant.bodyAlphaMul || 1));
      ctx.fill();
      tracePoly(outer);
      ctx.fillStyle = rgba(fillColor, 0.040 * (variant.bodyAlphaMul || 1));
      ctx.fill();
      tracePoly(mid);
      ctx.fillStyle = rgba(fillColor, 0.062 * (variant.bodyAlphaMul || 1));
      ctx.fill();
      tracePoly(inner);
      ctx.fillStyle = rgba(fillColor, 0.042 * (variant.bodyAlphaMul || 1));
      ctx.fill();

      for (let i = 0; i < Math.min(detail.plumes, (neb._plumes || []).length); i++) {
        const plume = neb._plumes[i];
        const ang = plume.angle;
        const dist = plume.dist;
        const px = Math.cos(ang) * dist;
        const py = Math.sin(ang * 0.92) * dist * 0.74;
        softEllipse(px, py, plume.rx * 0.95, plume.ry * plume.squish * 0.84, fillColor, plume.alpha * 0.85);
      }

      tracePoly(mid);
      ctx.strokeStyle = rgba(variant.edgeColor, 0.10 * variant.edgeMul);
      ctx.lineWidth = 0.9;
      ctx.stroke();
      tracePoly(outer);
      ctx.strokeStyle = rgba(variant.edgeColor, 0.05 * variant.edgeMul);
      ctx.lineWidth = 4.8;
      ctx.stroke();
      ctx.restore();
    }
    function drawUnit(u) {
      const palette = FACTION_VIS.getFactionPalette(u.side === 0 ? 0xff8800 : 0x4488ff);
      const dir = u.side === 0 ? 1 : -1;
      ctx.save();
      ctx.translate(u.x, u.y);
      ctx.rotate(Math.atan2(u.vy || 0, u.vx || dir) + (dir > 0 ? 0 : Math.PI));
      ctx.beginPath();
      ctx.moveTo(u.size * 1.60, 0);
      ctx.lineTo(-u.size * 0.95, -u.size * 0.70);
      ctx.lineTo(-u.size * 0.52, 0);
      ctx.lineTo(-u.size * 0.95, u.size * 0.70);
      ctx.closePath();
      ctx.fillStyle = rgba(palette.core, 0.86);
      ctx.fill();
      ctx.strokeStyle = rgba(palette.edge, 0.60);
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-u.size * 0.82, -u.size * 0.18);
      ctx.lineTo(-u.size * 1.52, -u.size * 0.08);
      ctx.moveTo(-u.size * 0.82, u.size * 0.18);
      ctx.lineTo(-u.size * 1.52, u.size * 0.08);
      ctx.strokeStyle = rgba(palette.edge, 0.34);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
    function drawShots(arena) {
      for (let i = 0; i < arena.shots.length; i++) {
        const s = arena.shots[i];
        const palette = FACTION_VIS.getFactionPalette(s.side === 0 ? 0xff8800 : 0x4488ff);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03);
        ctx.strokeStyle = rgba(palette.edge, 0.70);
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }
    function drawBlackHole(arena) {
      if (!arena.blackHole) return;
      const bh = arena.blackHole;
      const life = clamp01(bh.life / bh.maxLife);
      const grow = 1 - life;
      const r = bh.r * (0.9 + grow * 0.2);
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, r * 3.2, 0, TAU);
      ctx.fillStyle = "rgba(90,120,255,0.08)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, r * 1.55, 0, TAU);
      ctx.strokeStyle = "rgba(156,190,255,0.25)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, r, 0, TAU);
      ctx.fillStyle = "rgba(5,7,12,0.98)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, r * 0.52, 0, TAU);
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fill();
    }
    function drawArenaBackdrop(arena) {
      const band = ctx.createLinearGradient(0, arena.top, 0, arena.top + arena.height);
      band.addColorStop(0, "rgba(14,19,34,0)");
      band.addColorStop(0.5, "rgba(20,28,48,0.34)");
      band.addColorStop(1, "rgba(14,19,34,0)");
      ctx.fillStyle = band;
      ctx.fillRect(0, arena.top, sim.width, arena.height);

      const seam = ctx.createLinearGradient(arena.leftX, 0, arena.rightX, 0);
      seam.addColorStop(0, "rgba(255,140,90,0)");
      seam.addColorStop(0.5, "rgba(160,190,255,0.08)");
      seam.addColorStop(1, "rgba(90,160,255,0)");
      ctx.fillStyle = seam;
      ctx.fillRect(0, arena.y - arena.height * 0.18, sim.width, arena.height * 0.36);
    }
    function render() {
      ctx.clearRect(0, 0, sim.width, sim.height);
      const bg = ctx.createLinearGradient(0, 0, 0, sim.height);
      bg.addColorStop(0, "#040812");
      bg.addColorStop(1, "#060a14");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, sim.width, sim.height);

      for (let i = 0; i < sim.stars.length; i++) {
        const s = sim.stars[i];
        const driftX = Math.sin(sim.time * (0.05 + s.depth * 0.09) + s.t) * 8 * s.depth;
        const driftY = Math.cos(sim.time * (0.04 + s.depth * 0.07) + s.t * 0.7) * 5 * s.depth;
        const a = s.a * (0.72 + 0.28 * Math.sin(sim.time * s.s + s.t));
        ctx.fillStyle = "rgba(210,224,255," + a.toFixed(3) + ")";
        ctx.fillRect(s.x + driftX, s.y + driftY, s.r, s.r);
      }

      for (let ai = 0; ai < sim.arenas.length; ai++) {
        const arena = sim.arenas[ai];
        drawArenaBackdrop(arena);
        for (let ni = 0; ni < arena.nebulas.length; ni++) drawNebula(arena.nebulas[ni]);
        drawZone(arena.leftCore, arena);
        drawZone(arena.rightCore, arena);
        drawShots(arena);
        for (let i = 0; i < arena.units.length; i++) drawUnit(arena.units[i]);
        for (let i = 0; i < arena.sparks.length; i++) {
          const p = arena.sparks[i];
          const a = clamp01(p.life / p.maxLife);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.1, 0, TAU);
          ctx.fillStyle = rgba(p.color, a * 0.8);
          ctx.fill();
        }
        drawMenuCore(arena.leftCore);
        drawMenuCore(arena.rightCore);
        drawBlackHole(arena);
      }
    }
    function updateRound(dt) {
      sim.time += dt;
      for (let i = 0; i < sim.arenas.length; i++) updateArena(sim.arenas[i], dt);
    }
    function frame(now) {
      if (!sim.visible) { sim.raf = 0; return; }
      if (document.hidden) {
        sim.lastNow = now;
        sim.raf = requestAnimationFrame(frame);
        return;
      }
      const elapsed = now - sim.lastNow;
      if (elapsed < FRAME_MS - 1) {
        sim.raf = requestAnimationFrame(frame);
        return;
      }
      sim.lastNow = now;
      updateRound(Math.min(0.05, elapsed / 1000));
      render();
      sim.raf = requestAnimationFrame(frame);
    }
    function setVisible(visible) {
      sim.visible = !!visible;
      menuSimBackdropEl.style.display = sim.visible ? "block" : "none";
      if (!sim.visible) {
        if (sim.raf) cancelAnimationFrame(sim.raf);
        sim.raf = 0;
        return;
      }
      if (!sim.width || !sim.height) resize();
      sim.lastNow = performance.now();
      if (!sim.raf) sim.raf = requestAnimationFrame(frame);
    }

    window.addEventListener("resize", resize);
    resize();
    return { setVisible };
  })();

  state._menuBackdropActive = false;
  state._menuBackdropRestartAtMs = 0;

  function setMenuWorldCanvasVisibility(visible, interactive) {
    if (!app || !app.canvas) return;
    app.canvas.style.opacity = visible ? "1" : "0";
    app.canvas.style.pointerEvents = interactive ? "auto" : "none";
  }

  function setMenuBackdropPlayerPosition(player, x, y) {
    if (!player) return;
    player.x = x;
    player.y = y;
    const popRef = player.popFloat || player.pop || CFG.POP_START;
    const poly = computeInfluencePolygon(x, y, popRef);
    player.influencePolygon = poly;
    player.influenceRayDistances = poly.map((pt) => Math.hypot(pt.x - x, pt.y - y));
    player._cachedTargetPoly = poly;
    player._raySmooth = player.influenceRayDistances.slice();
    let maxR = 0;
    for (let i = 0; i < player.influenceRayDistances.length; i++) maxR = Math.max(maxR, player.influenceRayDistances[i] || 0);
    player.influenceR = Math.max(maxR, CFG.INFLUENCE_R(popRef));
  }

  function rebuildMenuBackdropMines(layout) {
    clearMineVisuals();
    state.mines.clear();
    nextMineId = 1;
    state.mineGems = [];
    state.mineFlowPackets = [];
    clearPirateBases();

    const centerMine = createMine(layout.centerX, layout.centerY, null, true);
    centerMine.captureProgress = 0;
    updateMineVisual(centerMine);

    const centerOffsets = [
      { x: -145, y: -58, type: "money" },
      { x: -54, y: 84, type: "xp" },
      { x: 52, y: -88, type: "money" },
      { x: 142, y: 62, type: "xp" }
    ];
    for (const entry of centerOffsets) {
      createMine(layout.centerX + entry.x, layout.centerY + entry.y, null, false, entry.type);
    }

    const baseMineOffsetX = 120;
    const nearBaseMineOffsets = [
      { x: 0, y: -88, type: "money" },
      { x: 36, y: 0, type: "xp" },
      { x: 0, y: 88, type: "money" }
    ];
    for (const entry of nearBaseMineOffsets) {
      createMine(layout.leftX + baseMineOffsetX + entry.x, layout.centerY + entry.y, 1, false, entry.type);
      createMine(layout.rightX - baseMineOffsetX - entry.x, layout.centerY + entry.y, 2, false, entry.type);
    }
  }

  function spawnMenuBackdropWave(ownerId, targetPlayer, count) {
    const owner = state.players.get(ownerId);
    if (!owner || !targetPlayer) return;
    const sourceTag = "menu-wave-" + ownerId + "-" + Math.floor(state.t);
    const dx = targetPlayer.x - owner.x;
    const dy = targetPlayer.y - owner.y;
    const dist = Math.hypot(dx, dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;
    const sideX = -dirY;
    const sideY = dirX;
    const spawnBase = getPlanetRadius(owner) * 1.32;
    const squadIds = [];
    const total = Math.max(1, count || 5);

    for (let i = 0; i < total; i++) {
      const lane = i - (total - 1) * 0.5;
      const sx = owner.x + dirX * spawnBase + sideX * lane * 18;
      const sy = owner.y + dirY * spawnBase + sideY * lane * 18;
      const u = spawnUnitAt(
        sx,
        sy,
        ownerId,
        "fighter",
        [{ x: targetPlayer.x, y: targetPlayer.y }],
        { sourceTag, autoGroupUntil: state.t + 4, allowAutoJoinRecentSpawn: true }
      );
      if (u && u.squadId != null) squadIds.push(u.squadId);
    }

    if (typeof SQUADLOGIC !== "undefined" && SQUADLOGIC.mergeSquads && squadIds.length > 1) {
      const merged = SQUADLOGIC.mergeSquads(state, [...new Set(squadIds)], "line", 3, 1);
      if (merged && SQUADLOGIC.issueSiegeOrder) {
        SQUADLOGIC.issueSiegeOrder(state, merged.id, targetPlayer.id, [{ x: targetPlayer.x, y: targetPlayer.y }]);
        return;
      }
    }
    if (typeof SQUADLOGIC !== "undefined" && SQUADLOGIC.issueSiegeOrder) {
      for (const squadId of [...new Set(squadIds)]) {
        SQUADLOGIC.issueSiegeOrder(state, squadId, targetPlayer.id, [{ x: targetPlayer.x, y: targetPlayer.y }]);
      }
    }
  }

  function stepMenuBackdropScenario() {
    if (!state._menuBackdropActive) return;
    const scenario = state._menuBackdropScenario;
    if (!scenario) return;
    const left = state.players.get(1);
    const right = state.players.get(2);
    if (!left || !right) return;

    if (state.t >= (scenario.nextWaveAt?.left ?? 0)) {
      spawnMenuBackdropWave(1, right, 5);
      scenario.nextWaveAt.left = state.t + 10;
    }
    if (state.t >= (scenario.nextWaveAt?.right ?? 0)) {
      spawnMenuBackdropWave(2, left, 5);
      scenario.nextWaveAt.right = state.t + 10;
    }

    if (state.t >= (scenario.nextBlackHoleAt || 0)) {
      spawnBlackHole(
        scenario.centerX + rand(-scenario.halfW * 0.18, scenario.halfW * 0.18),
        scenario.centerY + rand(-scenario.halfH * 0.16, scenario.halfH * 0.16),
        null
      );
      scenario.nextBlackHoleAt = state.t + 54 + Math.random() * 54;
    }

    if (state.t >= (scenario.nextThermoAt || 0)) {
      const attackerId = Math.random() < 0.5 ? 1 : 2;
      const target = attackerId === 1 ? right : left;
      const tx = target.x + (scenario.centerX - target.x) * 0.32 + rand(-90, 90);
      const ty = scenario.centerY + rand(-scenario.halfH * 0.20, scenario.halfH * 0.20);
      queueThermoNukeLocal(tx, ty, attackerId);
      scenario.nextThermoAt = state.t + 72 + Math.random() * 72;
    }
  }

  function startMenuBackdropBattle() {
    const savedPrefs = {
      soloBotCount: state._soloBotCount,
      soloSpawnIndex: state._soloSpawnIndex,
      soloColorIndex: state._soloColorIndex,
      mapVariation: state._mapVariation,
      customMapSeed: state._customMapSeed,
      soloGameMode: state._soloGameMode,
      quickStartScenario: state._quickStartScenario
    };
    const menuSeed = 0x51f15e;

    state._menuBackdropActive = true;
    state._menuBackdropPrevFrontControlEnabled = state._frontControlEnabled;
    state._frontControlEnabled = false;
    state._menuBackdropScenario = null;
    state._menuBackdropRestartAtMs = 0;
    state._gameOver = false;
    state._runsAuthoritativeSim = false;
    state._multiIsHost = false;
    state._multiSlots = null;
    state._slotToPid = null;
    state._pendingFullSnap = null;
    state._pendingSnap = null;
    state._survivalMode = false;
    state._soloNoBotAi = true;
    state._soloGameMode = "duel";
    state._quickStartScenario = null;
    state.myPlayerId = 1;
    state.botPlayerIds = null;
    state._soloBotCount = 1;
    state._soloSpawnIndex = 0;
    state._soloColorIndex = 0;
    state._mapVariation = 1;
    state._customMapSeed = menuSeed;
    PLAYER_NAMES[1] = "Helios";
    PLAYER_NAMES[2] = "Nyx";

    rebuildMap(menuSeed);
    rebuildGrid();
    resetWorld();

    state._soloBotCount = savedPrefs.soloBotCount;
    state._soloSpawnIndex = savedPrefs.soloSpawnIndex;
    state._soloColorIndex = savedPrefs.soloColorIndex;
    state._mapVariation = savedPrefs.mapVariation;
    state._customMapSeed = savedPrefs.customMapSeed;
    state._soloGameMode = savedPrefs.soloGameMode === "quad" ? "quad" : "duel";
    state._quickStartScenario = savedPrefs.quickStartScenario;

    state._soloNoBotAi = true;
    for (const p of state.players.values()) {
      p.pop = 170;
      p.popFloat = 170;
      p.shieldHp = Math.max(5, p.pop * 2);
      p.shieldMaxHp = p.shieldHp;
      p.eCredits = Math.max(p.eCredits || 0, 2500);
    }

    const p1 = state.players.get(1);
    const p2 = state.players.get(2);
    if (p1 && p2) {
      const layout = {
        centerX: CFG.WORLD_W * 0.5,
        centerY: CFG.WORLD_H * 0.50,
        halfW: 920,
        halfH: 220
      };
      layout.leftX = layout.centerX - 840;
      layout.rightX = layout.centerX + 840;
      setMenuBackdropPlayerPosition(p1, layout.leftX, layout.centerY);
      setMenuBackdropPlayerPosition(p2, layout.rightX, layout.centerY);
      rebuildMenuBackdropMines(layout);
      for (const p of [p1, p2]) {
        redrawZone(p);
        rebuildTurrets(p);
      }
      state._menuBackdropScenario = {
        ...layout,
        nextWaveAt: { left: state.t + 1.2, right: state.t + 6.2 },
        nextBlackHoleAt: state.t + 42,
        nextThermoAt: state.t + 60
      };
      cam.zoom = 0.62;
      centerOn(layout.centerX, layout.centerY);
    }
  }

  function clearMenuBackdropSimulationState() {
    invalidateNebulaBodyGraphics();
    destroyChildren(nebulaLayer);
    destroyChildren(nebulaFxLayer);
    destroyChildren(zonesLayer);
    clearTransientWorldFxLayers();
    destroyChildren(turretLayer);
    destroyChildren(mineLayer);
    destroyChildren(resLayer);
    destroyChildren(unitsLayer);
    destroyChildren(cityLayer);
    destroyChildren(ghostLayer);
    destroyTransientChildren(pathPreviewLayer);
    destroyChildren(squadLabelsLayer);
    destroyChildren(bulletsLayer);
    destroyTransientChildren(floatingDamageLayer);
    destroyChildren(activityZoneLayer);
    destroyChildren(abilityFxLayer);
    destroyChildren(combatLayer);
    destroyChildren(screenFxLayer);
    overlapG = new PIXI.Graphics();
    zonesLayer.addChild(overlapG);

    clearMineVisuals();
    clearPirateBases();

    if (state.storm) destroyIonStormVisual(state.storm);
    state.storm = null;
    for (const storm of state._abilityStorms || []) destroyIonStormVisual(storm);
    state._abilityStorms = [];
    for (const bh of state._blackHoles || []) destroyBlackHoleVisual(bh);
    state._blackHoles = [];
    for (const meteor of state._activeMeteors || []) removeMeteorGfx(meteor);
    state._activeMeteors = [];
    state._meteorImpactEffects = [];
    for (const strike of state._orbitalStrikes || []) destroyOrbitalStrikeVisual(strike);
    state._orbitalStrikes = [];
    for (const strike of state._thermoNukes || []) destroyThermoNukeVisual(strike);
    state._thermoNukes = [];
    for (const raid of state._pirateRaids || []) destroyPirateRaidVisual(raid);
    state._pirateRaids = [];
    for (const effect of state._economyAbilityFx || []) destroyEconomyAbilityVisual(effect);
    state._economyAbilityFx = [];
    for (const zone of state._abilityZoneEffects || []) destroyAbilityZoneVisual(zone);
    state._abilityZoneEffects = [];
    state._fakeSignatures = [];

    if (state._abilityPreviewGfx && !state._abilityPreviewGfx.destroyed) {
      if (state._abilityPreviewGfx.parent) state._abilityPreviewGfx.parent.removeChild(state._abilityPreviewGfx);
      state._abilityPreviewGfx.destroy(true);
      state._abilityPreviewGfx = null;
    }
    if (state._abilityPreviewScreenGfx && !state._abilityPreviewScreenGfx.destroyed) {
      if (state._abilityPreviewScreenGfx.parent) state._abilityPreviewScreenGfx.parent.removeChild(state._abilityPreviewScreenGfx);
      state._abilityPreviewScreenGfx.destroy(true);
      state._abilityPreviewScreenGfx = null;
    }
    if (state._abilityPreviewText && !state._abilityPreviewText.destroyed) {
      if (state._abilityPreviewText.parent) state._abilityPreviewText.parent.removeChild(state._abilityPreviewText);
      state._abilityPreviewText.destroy(true);
      state._abilityPreviewText = null;
    }
    state._zoneGfx = null;

    state.players.clear();
    state.units.clear();
    state.res.clear();
    state.turrets.clear();
    state.mines.clear();
    state.mineGems = [];
    state.mineFlowPackets = [];
    state.ghosts = [];
    state.bullets = [];
    state.floatingDamage = [];
    state._deathBursts = [];
    state._shipBuildQueues = new Map();
    state.selectedUnitIds.clear();
    state.prevInCombatIds.clear();
    state.squads = new Map();
    state.engagementZones = new Map();
    state.nextSquadId = 1;
    state.nextEngagementZoneId = 1;
    state.coreFrontPolicies = {};
    state.frontGraph = {};
    state.squadFrontAssignments = {};
    state.centerObjectives = { centerX: 0, centerY: 0, richMineId: null, centerMineIds: [], pirateBaseIds: [], livePirateBaseIds: [], securedByPlayerId: null, requiredMineCount: 0 };
    state.smoothedFronts = {};
    state.persistentBattles = {};
  }

  function stopMenuBackdropBattle() {
    if (!state._menuBackdropActive) return;
    clearMenuBackdropSimulationState();
    state._menuBackdropActive = false;
    state._frontControlEnabled = state._menuBackdropPrevFrontControlEnabled !== undefined
      ? state._menuBackdropPrevFrontControlEnabled
      : true;
    state._menuBackdropPrevFrontControlEnabled = undefined;
    state._menuBackdropScenario = null;
    state._menuBackdropRestartAtMs = 0;
    state._gameOver = true;
  }

  function stepMenuBackdropCamera(dt) {
    if (!state._menuBackdropActive) return;
    const scenario = state._menuBackdropScenario;
    if (!scenario) return;
    const spanX = scenario.halfW * 2;
    const spanY = scenario.halfH * 2;
    const zoomByWidth = app.renderer.width / spanX;
    const zoomByHeight = app.renderer.height / spanY;
    const targetZoom = Math.max(0.46, Math.min(0.82, Math.min(zoomByWidth, zoomByHeight) * 1.12));
    cam.zoom += (targetZoom - cam.zoom) * Math.min(1, dt * 1.8);
    const targetCamX = app.renderer.width * 0.5 - scenario.centerX * cam.zoom;
    const targetCamY = app.renderer.height * 0.5 - scenario.centerY * cam.zoom;
    cam.x += (targetCamX - cam.x) * Math.min(1, dt * 1.6);
    cam.y += (targetCamY - cam.y) * Math.min(1, dt * 1.6);
    applyCamera();
  }

  function showScreen(visibleId) {
    const ids = ["mainMenu", "nicknameScreen", "soloLobbyScreen", "multiConnectScreen", "lobbyScreen"];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.style.display = id === visibleId ? "flex" : "none";
    }
    if (gameWrapEl) gameWrapEl.style.display = visibleId === "gameWrap" ? "block" : "none";
    const showRealMenuWorld = visibleId === "mainMenu" || visibleId === "nicknameScreen" || visibleId === "soloLobbyScreen";
    if (menuSimBackdropEl) menuSimBackdropEl.classList.toggle("real-world", showRealMenuWorld);
    setMenuWorldCanvasVisibility(visibleId === "gameWrap" || showRealMenuWorld, visibleId === "gameWrap");
    if (menuSimApi && menuSimApi.setVisible) menuSimApi.setVisible(visibleId !== "gameWrap");
    if (showRealMenuWorld) startMenuBackdropBattle();
    else stopMenuBackdropBattle();
    if (coreMatchStateApi && typeof coreMatchStateApi.setScreen === "function") {
      coreMatchStateApi.setScreen(visibleId);
    }
    if (visibleId === "soloLobbyScreen" && typeof window !== "undefined") {
      state._myNickname = state._myNickname || window._myNickname || "";
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
      if (botRow) botRow.style.display = "none";
      if (botPicker) botPicker.innerHTML = "";
    } else {
      const row = document.getElementById("soloColorRow");
      if (row) row.style.display = "none";
      const botRow = document.getElementById("soloBotCountRow");
      if (botRow) botRow.style.display = "none";
    }
    if ((visibleId === "mainMenu" || visibleId === "soloLobbyScreen" || visibleId === "nicknameScreen") && singleMenuUiApi) {
      if (singleMenuUiApi.renderResultsPanels) singleMenuUiApi.renderResultsPanels();
      if (singleMenuUiApi.renderSoloSpawnPicker && visibleId === "soloLobbyScreen") singleMenuUiApi.renderSoloSpawnPicker();
    }
    if (!singleReleaseOnly && visibleId === "multiConnectScreen" && typeof refreshLobbyList === "function") refreshLobbyList();
    if (visibleId === "gameWrap" && platformApi && typeof platformApi.requestFullscreen === "function") {
      platformApi.requestFullscreen();
    }
    if (visibleId !== "gameWrap" && musicPlayerDockEl) {
      musicPlayerDockEl.classList.remove("popup-open");
    }
    syncPlatformGameplayState();
  }
  (function bindMainMenuButtonsEarly() {
    const btnSingle = document.getElementById("btnSingle");
    const btnMulti = document.getElementById("btnMulti");
    const btnTestMap400 = document.getElementById("btnTestMap400");
    const perfRow = document.querySelector(".topright-test-row");
    const perfLogBtn = document.getElementById("togglePerfLog");
    if (btnTestMap400 && !testUiEnabled) btnTestMap400.style.display = "none";
    if (!perfHudEnabled) {
      if (perfRow) perfRow.style.display = "none";
      if (perfLogBtn) perfLogBtn.style.display = "none";
      if (fpsEl) fpsEl.style.display = "none";
      if (netEl) netEl.style.display = "none";
    }
    if (singleReleaseOnly && btnMulti) btnMulti.style.display = "none";
    if (btnSingle) {
      btnSingle.addEventListener("click", () => {
        state._quickStartScenario = null;
        state._menuMode = "single";
      });
    }
    if (btnTestMap400) btnTestMap400.addEventListener("click", () => {
      if (!testUiEnabled) return;
      state._menuMode = "single";
      state._quickStartScenario = "stress400";
      state._soloGameMode = "duel";
      state._mapVariation = 1;
      state._soloBotCount = 1;
      state._customMapSeed = null;
      state._soloSpawnIndex = 0;
      const nick =
        (state._myNickname || (typeof window !== "undefined" && window._myNickname) || nicknameInputEl?.value?.trim() || "Игрок")
          .trim()
          .slice(0, 24) || "Игрок";
      startGameSingle(nick);
    });
  })();

  function refreshLobbyList() {
    if (lobbyUiApi && lobbyUiApi.refreshLobbyList) {
      lobbyUiApi.refreshLobbyList();
    }
  }

  function startGameSingle(nickname) {
    state._authorityMode = "local";
    if (gameModeControllerApi && gameModeControllerApi.enterSinglePlayer) {
      gameModeControllerApi.enterSinglePlayer();
    } else {
      stopMenuBackdropBattle();
      state._gameSeed = null;
      if (matchSessionApi && matchSessionApi.resetForSinglePlayer) matchSessionApi.resetForSinglePlayer();
      state._runsAuthoritativeSim = false;
      state._multiIsHost = false;
      state._multiSlots = null;
      state._slotToPid = null;
      state._pendingFullSnap = null;
      state._pendingSnap = null;
    }
    PLAYER_NAMES[1] = (nickname || "Игрок").trim().slice(0, 24) || "Игрок";
    if (singleProfileApi && typeof singleProfileApi.setNickname === "function") {
      singleProfileApi.setNickname(PLAYER_NAMES[1]);
    }
    state.myPlayerId = 1;
    state.botPlayerIds = null;
    state._gameOver = false;
    state._domTimers = {};
    if (coreMatchStateApi && typeof coreMatchStateApi.beginMatch === "function") {
      coreMatchStateApi.beginMatch({
        mode: state._soloGameMode === "quad" ? "quad" : "duel",
        difficulty: state._soloDifficulty || "easy",
        botCount: state._soloGameMode === "quad" ? 3 : 1,
        playerId: 1,
        seed: state._customMapSeed != null ? state._customMapSeed : null
      });
    }
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
    applyCurrentBotDifficulty();
    if (me) {
      cam.zoom = CFG.CAMERA_START_ZOOM;
      centerOn(me.x, me.y);
      const cx = CFG.WORLD_W / 2, cy = CFG.WORLD_H / 2;
      const dx = cx - me.x, dy = cy - me.y;
      const len = Math.hypot(dx, dy) || 1;
      state.rallyPoint = { x: me.x + (dx / len) * 180, y: me.y + (dy / len) * 180 };
    }
    document.getElementById("net").textContent = "локально • " + getBotDifficultyLabel(state._soloDifficulty || "easy");
    const gameChatWrap = document.getElementById("gameChatWrap");
    if (gameChatWrap) gameChatWrap.style.display = "none";
    if (typeof updateMultiHostOnlyControls === "function") updateMultiHostOnlyControls();
    syncHiddenHostTick();
    syncPlatformGameplayState();
  }

  function startGameMulti(slots, mySlot, matchMeta) {
    state.botPlayerIds = new Set();
    const authorityMode = matchMeta && matchMeta.authorityMode
      ? matchMeta.authorityMode
      : (platformApi && typeof platformApi.getAuthorityMode === "function"
          ? platformApi.getAuthorityMode()
          : "host-client");
    state._authorityMode = authorityMode;
    const filledSlots = [];
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i] || {};
      if (s.id || s.isBot) filledSlots.push(i);
    }
    const slotToPid = {};
    for (const i of filledSlots) slotToPid[i] = i + 1;
    state.myPlayerId = slotToPid[mySlot] || (mySlot + 1);
    const matchContext = {
      roomId: matchMeta && matchMeta.roomId ? matchMeta.roomId : state._roomId,
      matchId: matchMeta && matchMeta.matchId ? matchMeta.matchId : state._matchId,
      matchType: matchMeta && matchMeta.matchType ? matchMeta.matchType : state._matchType,
      authorityMode,
      slots,
      mySlot,
      hostSlot: state._hostSlot,
      isHost: !!state._isHost,
      slotToPid
    };
    if (gameModeControllerApi && gameModeControllerApi.enterMultiplayerMatch) {
      gameModeControllerApi.enterMultiplayerMatch(matchContext);
    } else {
      stopMenuBackdropBattle();
      state._runsAuthoritativeSim = authorityMode === "host-client" ? !!state._isHost : false;
      state._multiIsHost = state._runsAuthoritativeSim;
      state._multiSlots = slots;
      state._slotToPid = slotToPid;
      state._pendingFullSnap = null;
      state._pendingSnap = null;
      if (matchSessionApi && matchSessionApi.beginMatch) matchSessionApi.beginMatch(matchContext);
    }
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
        if (text) { sendChatMessage(text); gameChatInput.value = ""; }
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
    syncHiddenHostTick();
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

  state._pauseReasons = state._pauseReasons || new Set();

  function setRuntimePauseReason(reason, active) {
    if (!reason) return false;
    const reasons = state._pauseReasons;
    const hasReason = reasons.has(reason);
    if (active) {
      if (hasReason) return false;
      reasons.add(reason);
      return true;
    }
    if (!hasReason) return false;
    reasons.delete(reason);
    return true;
  }

  function isRuntimePaused() {
    return !!(state._pauseReasons && state._pauseReasons.size > 0);
  }

  function pauseGameplay(reason) {
    if (!setRuntimePauseReason(reason || "runtime", true)) return;
    if (window.MusicPlayer && typeof window.MusicPlayer.pauseForExternal === "function") {
      window.MusicPlayer.pauseForExternal();
    }
  }

  function resumeGameplay(reason) {
    if (!setRuntimePauseReason(reason || "runtime", false)) return;
    if (window.MusicPlayer && typeof window.MusicPlayer.resumeAfterExternal === "function") {
      window.MusicPlayer.resumeAfterExternal();
    }
  }

  const HIDDEN_HOST_TICK_MS = 50;
  let hiddenHostTickHandle = null;

  function shouldKeepHostSimulationAliveWhileHidden() {
    return !!(
      typeof document !== "undefined" &&
      document.hidden &&
      state._authorityMode === "host-client" &&
      state._multiSlots &&
      state._multiIsHost &&
      state._roomId &&
      !state._gameOver
    );
  }

  function shouldPauseForHiddenPage() {
    if (typeof document === "undefined" || !document.hidden) return false;
    return !shouldKeepHostSimulationAliveWhileHidden();
  }

  window.__voidfrontShowRewardedAd = function (callbacks) {
    if (platformApi && typeof platformApi.showRewardedAd === "function") {
      return platformApi.showRewardedAd(callbacks || {});
    }
    return false;
  };

  document.addEventListener("visibilitychange", () => {
    if (shouldPauseForHiddenPage()) pauseGameplay("document-hidden");
    else resumeGameplay("document-hidden");
    syncHiddenHostTick();
  });

  if (platformApi && typeof platformApi.setLifecycleHandlers === "function") {
    platformApi.setLifecycleHandlers({
      pause: pauseGameplay,
      resume: resumeGameplay
    });
  }

  // ─── Networking: use NET module (net.js) ───
  const PLAYER_LIGHT_SYNC_KEYS = NET.PLAYER_LIGHT_KEYS;
  const PLAYER_FULL_SYNC_KEYS  = NET.PLAYER_FULL_KEYS;
  const UNIT_FULL_SYNC_KEYS    = NET.UNIT_FULL_KEYS;

  const _netSerializer = new NET.SnapshotSerializer();
  const _netSendScheduler = new NET.SendScheduler();
  const _netPing = new NET.PingTracker();
  let snapshotSyncApi = null;
  let socketActionDispatchApi = null;
  let lobbyUiApi = null;
  let remoteClientRuntimeApi = null;
  let hostNetworkRuntimeApi = null;
  let hostSimRuntimeApi = null;
  let visualTickRuntimeApi = null;
  let authorityAdapterApi = null;
  let runtimeObservabilityApi = null;

  const installRuntime = appBootstrapApi && appBootstrapApi.installRuntime
    ? appBootstrapApi.installRuntime
    : function (runtimeGlobal, deps) {
        return runtimeGlobal && runtimeGlobal.install ? runtimeGlobal.install(deps) : null;
      };

  const requireRuntime = appBootstrapApi && appBootstrapApi.requireRuntime
    ? appBootstrapApi.requireRuntime
    : function (api, runtimeName) {
        if (!api) throw new Error(`${runtimeName} is unavailable`);
        return api;
      };

  function serializeGameState() {
    return _netSerializer.serialize(state);
  }

  function applyGameState(snap) {
    requireRuntime(snapshotSyncApi, "SnapshotSync").applyGameState(snap);
  }

  runtimeObservabilityApi = installRuntime(window.RuntimeObservability, {
    state,
    matchSession: matchSessionApi,
    netPing: _netPing,
    netEl,
    fpsEl
  });

  snapshotSyncApi = installRuntime(window.SnapshotSync, {
    state,
    NET,
    CFG,
    PLAYER_COLORS,
    PLAYER_LIGHT_SYNC_KEYS,
    PLAYER_FULL_SYNC_KEYS,
    UNIT_FULL_SYNC_KEYS,
    makePlayer,
    makeCityVisual,
    makeZoneVisual,
    cityLayer,
    zonesLayer,
    zoneEffectsLayer,
    computeInfluencePolygon,
    unitsLayer,
    makeUnitVisual,
    makeResVisual,
    deleteResource,
    turretLayer,
    destroyIonStormVisual,
    removeMeteorGfx,
    destroyOrbitalStrikeVisual,
    destroyThermoNukeVisual,
    destroyPirateRaidVisual,
    destroyEconomyAbilityVisual,
    destroyAbilityZoneVisual,
    makeMineVisual,
    updateMineVisual,
    syncSectorObjectivesFromSnapshot,
    resLayer,
    destroyBlackHoleVisual,
    reportError: runtimeObservabilityApi && runtimeObservabilityApi.captureError
      ? runtimeObservabilityApi.captureError
      : null
  });

  socketActionDispatchApi = installRuntime(window.SocketActionDispatch, {
    state,
    CFG,
    purchaseUnit,
    purchaseFrontTriplet,
    shieldRadius,
    getUnitAtkRange,
    getSquadStateFromUnits,
    getFormationOffsets,
    applyFormationToSquad,
    ABILITY_DEFS,
    setAbilityCooldown,
    pushAbilityAnnouncement,
    spawnIonNebulaLocal: _spawnIonNebulaLocal,
    spawnMeteorLocal: _spawnMeteorLocal,
    spawnBlackHole,
    useActiveShield,
    spawnPirateRaid,
    useGloriousBattleMarch,
    useLoan,
    useRaiderCapture,
    applyCard,
    activateBuffCardForPlayer,
    castAbilityCardForPlayer,
    executeAbilityAction
  });

  lobbyUiApi = installRuntime(window.LobbyUI, {
    state,
    socket,
    socketSession: socketSessionApi,
    actionGateway: actionGatewayApi,
    matchSession: matchSessionApi,
    socketUrl: socketUrlEarly,
    showScreen,
    startGameSingle,
    nicknameInputEl,
    roomCodeInputEl,
    lobbyScreenEl,
    LOBBY_COLORS,
    CFG
  });

  remoteClientRuntimeApi = installRuntime(window.RemoteClientRuntime, {
    state,
    NET,
    CFG,
    netPing: _netPing,
    matchSession: matchSessionApi,
    applyGameState,
    rebuildZoneGrid,
    updateUnitVisualsOnly,
    stepBulletsVisual,
    stepMineGemsRemote,
    stepMineGems,
    inView,
    refreshResourceVisual
  });

  hostNetworkRuntimeApi = installRuntime(window.HostNetworkRuntime, {
    state,
    netSendScheduler: _netSendScheduler,
    serializeGameState
  });

  hostSimRuntimeApi = installRuntime(window.HostSimRuntime, {
    state,
    perfStartStep,
    perfEndStep,
    stepCities,
    rebuildZoneGrid,
    botThink,
    requireSquadLogic,
    getFrontPlannerGlobal: () => (typeof FrontPlanner !== "undefined" ? FrontPlanner : null),
    queryHash,
    getUnitAtkRange,
    getUnitEngagementRange,
    getUnitBaseSpeed,
    shieldRadius,
    getPlanetRadius,
    getUnitHitRadius,
    getFormationOffsets,
    stepUnits,
    stepCombat,
    getSquadLogicGlobal: () => (typeof SQUADLOGIC !== "undefined" ? SQUADLOGIC : null),
    mergeBattleSurvivorsIntoOneSquad,
    applyFormationToSquad,
    stepTurrets,
    stepPatrols,
    stepBullets,
    stepMines,
    stepMineGems,
    stepResourceMagnet,
    stepPickups,
    stepNebulae,
    stepStorm,
    stepAbilityStorms,
    stepBlackHoles,
    stepRandomEvents,
    stepAbilityZoneEffects,
    stepAbilityCooldowns,
    stepLoanDebts,
    stepMeteors,
    stepOrbitalStrikes,
    stepThermoNukes,
    stepPirateRaids,
    stepSurvivalWaves,
    stepLaneFighterWaves
  });

  visualTickRuntimeApi = installRuntime(window.VisualTickRuntime, {
    state,
    perfStartStep,
    perfEndStep,
    redrawZone,
    rebuildTurrets,
    updateZoneOverlaps,
    updateZoneLights,
    updateZoneContacts,
    contactGfx,
    updateShieldVisuals,
    updateDischarges,
    pulseStars,
    updateActivityZones,
    drawTurrets,
    updateCityPopLabels,
    updateSquadLabels,
    updateShipTrails,
    updateCombatUI,
    updateFloatingDamage,
    updateAbilityAnnouncements,
    updateMineFlowVisuals,
    drawBullets,
    drawDeathBursts,
    drawStorm,
    drawNebulae,
    drawAbilityStorms,
    drawBlackHoles,
    drawPirateBase,
    drawAbilityZoneEffects,
    drawHyperFlashes,
    drawMeteors,
    drawOrbitalStrikes,
    drawThermoNukes,
    drawPirateRaids,
    drawEconomyAbilityFx,
    drawMeteorImpactEffects,
    drawAbilityTargetPreview,
    clearAbilityPreview,
    neonEdgeSprite,
    world,
    pulseNeonEdge,
    updateSelectionBox,
    updatePathPreview,
    updateMovingPathPreview,
    updateFrontLaneOverlay,
    updateMinimap,
    updateLeaderboard,
    updateFog,
    updateSquadStrip,
    updateSquadControlBox,
    updateFrontControlBox,
    updateHUD,
    updateDelayedHoverInfo,
    checkVictory,
    updateSurvivalHud,
    updateDominationTimerUI,
    getCombatGlobal: () => (typeof COMBAT !== "undefined" ? COMBAT : null),
    combatDebugGfx,
    getUnitAtkRange,
    inView,
    updateCombatDebugLabels
  });

  authorityAdapterApi = installRuntime(window.AuthorityAdapter, {
    state,
    serializeGameState,
    applyGameState,
    getSocketActionDispatchApi: () => socketActionDispatchApi
  });
  gameModeControllerApi = installRuntime(window.GameModeController, {
    state,
    stopMenuBackdropBattle,
    matchSession: matchSessionApi
  });
  singleMenuUiApi = installRuntime(window.SingleMenuUI, {
    state,
    showScreen,
    startGameSingle,
    nicknameInputEl,
    profileApi: singleProfileApi
  });
  if (singleMenuUiApi && typeof singleMenuUiApi.init === "function") {
    singleMenuUiApi.init();
  }

  if (socketSessionApi) {
    socketSessionApi.on("connect", () => {
      if (runtimeObservabilityApi && runtimeObservabilityApi.logEvent) {
        runtimeObservabilityApi.logEvent("info", "Socket connected", { url: socketUrlEarly });
      }
    });
    socketSessionApi.on("disconnect", (reason) => {
      if (runtimeObservabilityApi && runtimeObservabilityApi.logEvent) {
        runtimeObservabilityApi.logEvent("warn", "Socket disconnected", { reason: reason || null });
      }
    });
    socketSessionApi.on("connect_error", (err) => {
      if (runtimeObservabilityApi && runtimeObservabilityApi.captureError) {
        runtimeObservabilityApi.captureError("socket.connect_error", err, { url: socketUrlEarly });
      }
    });
    socketSessionApi.on("sessionAssigned", (auth) => {
      if (platformApi && platformApi.saveSessionAuth) platformApi.saveSessionAuth(auth);
      if (matchSessionApi && matchSessionApi.setSessionAuth) matchSessionApi.setSessionAuth(auth);
      if (runtimeObservabilityApi && runtimeObservabilityApi.logEvent) {
        runtimeObservabilityApi.logEvent("info", "Session assigned", { sessionId: auth && auth.sessionId ? auth.sessionId : null });
      }
    });
    socketSessionApi.on("reconnectGranted", (data) => {
      if (platformApi && platformApi.saveSessionAuth) platformApi.saveSessionAuth(data);
      if (matchSessionApi && matchSessionApi.setSessionAuth) matchSessionApi.setSessionAuth(data);
      if (matchSessionApi && matchSessionApi.updateLobbyContext) {
        matchSessionApi.updateLobbyContext(data);
        if (Array.isArray(data.slots)) matchSessionApi.applyRoomSnapshot({ slots: data.slots, hostSlot: data.hostSlot });
      }
      if (runtimeObservabilityApi && runtimeObservabilityApi.logEvent) {
        runtimeObservabilityApi.logEvent("warn", "Reconnect granted", {
          matchId: data && data.matchId ? data.matchId : null,
          roomId: data && data.roomId ? data.roomId : null
        });
      }
    });
    socketSessionApi.on("reconnectFailed", (payload) => {
      if (runtimeObservabilityApi && runtimeObservabilityApi.logEvent) {
        runtimeObservabilityApi.logEvent("error", "Reconnect failed", payload || null);
      }
    });
    socketSessionApi.on("net:pong", (seq) => _netPing.onPong(seq));
    socketSessionApi.on("gameStart", (data) => {
      console.log("[MP] gameStart received. _mySlot=", state._mySlot, "_isHost=", state._isHost, "seed=", data.seed);
      state._gameSeed = typeof data.seed === "number" ? data.seed : null;
      if (matchSessionApi && matchSessionApi.updateLobbyContext) matchSessionApi.updateLobbyContext(data);
      if (runtimeObservabilityApi && runtimeObservabilityApi.logEvent) {
        runtimeObservabilityApi.logEvent("info", "Game start", {
          matchId: data && data.matchId ? data.matchId : null,
          matchType: data && data.matchType ? data.matchType : null,
          seed: data && typeof data.seed === "number" ? data.seed : null
        });
      }
      _netPing.start(socket);
      _netSerializer.reset();
      _netSendScheduler.start();
      startGameMulti(data.slots, state._mySlot, data);
    });
    socketSessionApi.on("gameState", (data) => {
      if (!state._firstSnapLogged && data && data.units && data.units.length > 0) {
        state._firstSnapLogged = true;
        console.log("[MP-SYNC] FIRST snap with units:", JSON.stringify(data.units.slice(0, 3)));
        console.log("[MP-SYNC] FIRST snap players:", JSON.stringify(data.players.map(p => ({ id: p.id, name: p.name, color: p.color?.toString(16) }))));
      }
      if (matchSessionApi && matchSessionApi.setPendingSnapshot) matchSessionApi.setPendingSnapshot(data);
      else if (data && data._fullSync) state._pendingFullSnap = data;
      else state._pendingSnap = data;
    });
    socketSessionApi.on("cardState", (payload) => {
      applyIncomingCardState(payload);
    });
    socketSessionApi.on("playerAction", (action) => {
      if (authorityAdapterApi && authorityAdapterApi.handleRemoteAction) {
        authorityAdapterApi.handleRemoteAction(action);
      } else if (socketActionDispatchApi && socketActionDispatchApi.handlePlayerAction) {
        socketActionDispatchApi.handlePlayerAction(action);
      }
    });
    socketSessionApi.on("mapRegenerate", (data) => {
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

  showScreen("mainMenu");
  gameWrapEl.style.display = "none";
  if (platformApi && typeof platformApi.markGameReady === "function") {
    platformApi.markGameReady();
  }

  // ------------------------------------------------------------
  // Main loop
  // ------------------------------------------------------------
  let lastT = performance.now();
  let fpsAcc = 0, fpsN = 0;

  function runGameFrame(now, options) {
    const opts = options || {};
    const includeVisuals = opts.includeVisuals !== false;
    const includePerfHud = opts.includePerfHud !== false;
    const includeDestroyFlush = opts.includeDestroyFlush !== false;
    const frameStart = performance.now();
    let dt = Math.min(0.05, (now - lastT) / 1000);
    dt *= CFG.GAME_SPEED;
    const timeScale = state.timeScale || 1;
    dt *= timeScale;
    lastT = now;
    if (isRuntimePaused()) {
      return;
    }
    if (state._gameOver) {
      return;
    }
    const isRemoteClient = !!(state._multiSlots && !state._multiIsHost);
    const isServerAuthority = isRemoteClient && state._authorityMode === "server";

    if (!isServerAuthority) {
      state.t += dt;
      state._lastDt = dt;
      stepPlayerCardStates();
      processShipBuildQueues();
    } else {
      state._lastDt = dt;
    }

    state._frameCtr = (state._frameCtr || 0) + 1;
    state._vp = getViewport();
    LOD.resetFrameCounts();
    rebuildSpatialHash();

    if (!isRemoteClient) {
      requireRuntime(hostSimRuntimeApi, "HostSimRuntime").step(dt);
    } else {
      if (remoteClientRuntimeApi && remoteClientRuntimeApi.step) {
        remoteClientRuntimeApi.step(dt);
      } else {
        const fallbackInterpMs = Math.max(
          NET.SEND_INTERVAL_MS,
          state._lastRemoteSnapIntervalMs || _netPing.getInterpDurationMs()
        );
        const fallbackRenderDelayMs = Math.max(
          NET.SEND_INTERVAL_MS * 1.5,
          Math.min(120, fallbackInterpMs * 1.5)
        );
        const fallbackSnap = matchSessionApi && matchSessionApi.consumePendingSnapshot
          ? matchSessionApi.consumePendingSnapshot({
            now: performance.now(),
            cadenceMs: Math.max(8, fallbackInterpMs * 0.9),
            bufferLeadMs: fallbackRenderDelayMs,
            maxHoldMs: Math.max(fallbackRenderDelayMs * 1.75, NET.SEND_INTERVAL_MS * 3)
          })
          : (state._pendingFullSnap || state._pendingSnap || null);
        if (fallbackSnap) {
          applyGameState(fallbackSnap);
          state._pendingFullSnap = null;
          state._pendingSnap = null;
        }
      }
    }

    if (!isServerAuthority && hostNetworkRuntimeApi && hostNetworkRuntimeApi.step) hostNetworkRuntimeApi.step(now);

    if (state._menuBackdropActive) stepMenuBackdropScenario();
    if (state._menuBackdropActive) stepMenuBackdropCamera(dt);

    if (includeVisuals) {
      requireRuntime(visualTickRuntimeApi, "VisualTickRuntime").step(dt, now);
      pulseStars();
      animateNebulaBackdrop(state.t);
      if (offMapAmbienceApi && typeof offMapAmbienceApi.step === "function") {
        offMapAmbienceApi.step(dt, state.t, cam.zoom || 0.22);
      }
    }

    if (includePerfHud) {
      fpsAcc += dt;
      fpsN++;
      if (fpsAcc >= 0.5) {
        const fps = Math.round(fpsN / fpsAcc);
        fpsEl.textContent = `fps: ${fps}`;
        fpsAcc = 0;
        fpsN = 0;
      }
    }

    const frameMs = performance.now() - frameStart;
    perfTick(frameMs);
    if (runtimeObservabilityApi && runtimeObservabilityApi.updateNetDebugHud && state._frameCtr % 12 === 0) {
      runtimeObservabilityApi.updateNetDebugHud();
    }

    if (includeDestroyFlush) flushDestroyQueue();
  }

  function stopHiddenHostTick() {
    if (hiddenHostTickHandle != null) {
      clearInterval(hiddenHostTickHandle);
      hiddenHostTickHandle = null;
    }
  }

  function syncHiddenHostTick() {
    if (shouldKeepHostSimulationAliveWhileHidden()) {
      if (hiddenHostTickHandle == null) {
        lastT = performance.now();
        hiddenHostTickHandle = setInterval(() => {
          if (!shouldKeepHostSimulationAliveWhileHidden()) {
            stopHiddenHostTick();
            return;
          }
          if (!state.players || state.players.size === 0) return;
          runGameFrame(performance.now(), {
            includeVisuals: false,
            includePerfHud: false,
            includeDestroyFlush: false
          });
        }, HIDDEN_HOST_TICK_MS);
      }
      return;
    }
    stopHiddenHostTick();
    lastT = performance.now();
  }

  app.ticker.add(() => {
    if (typeof window !== "undefined" && window._pendingSingleStart) {
      const nick = window._pendingSingleStart;
      window._pendingSingleStart = null;
      const msg = document.getElementById("menuLoadingMsg");
      if (msg && msg.parentNode) msg.parentNode.removeChild(msg);
      startGameSingle(nick);
      return;
    }
    if (state._menuBackdropActive && state._gameOver) {
      if (!state._menuBackdropRestartAtMs) state._menuBackdropRestartAtMs = performance.now() + 1600;
      if (performance.now() >= state._menuBackdropRestartAtMs) startMenuBackdropBattle();
      return;
    }
    if (!state.players || state.players.size === 0) return;
    if (shouldKeepHostSimulationAliveWhileHidden()) return;
    runGameFrame(performance.now(), {
      includeVisuals: true,
      includePerfHud: true,
      includeDestroyFlush: true
    });
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
    if (selectionAndOrdersApi && selectionAndOrdersApi.describeOrderPreview) {
      return selectionAndOrdersApi.describeOrderPreview(order);
    }
    return { ghostPath: false, targetHighlight: false };
  }

  function getPerfSummary() {
    const stats = state.perfStats || {};
    const packetSamples = state._netPacketStats && Array.isArray(state._netPacketStats.samples)
      ? state._netPacketStats.samples.slice(-30)
      : [];
    return {
      avgFrameMs: stats.avgFrameMs || 0,
      maxFrameMs: stats.maxFrameMs || 0,
      approxFps: stats.avgFrameMs ? Math.round(1000 / Math.max(0.001, stats.avgFrameMs)) : 0,
      units: stats.units || state.units.size,
      bullets: stats.bullets || state.bullets.length,
      zoom: stats.zoom || cam.zoom || CFG.CAMERA_START_ZOOM || 0.22,
      visibleUnits: stats.visibleUnits || 0,
      visibleTurrets: stats.visibleTurrets || 0,
      visibleBullets: stats.visibleBullets || 0,
      visibleResources: stats.visibleResources || 0,
      visibleMines: stats.visibleMines || 0,
      visibleMineGems: stats.visibleMineGems || 0,
      visibleCities: stats.visibleCities || 0,
      visiblePirateBases: stats.visiblePirateBases || 0,
      squads: stats.squads || (state.squads ? state.squads.size : 0),
      engagementZones: stats.engagementZones || (state.engagementZones ? state.engagementZones.size : 0),
      mineFlowPackets: stats.mineFlowPackets || ((state.mineFlowPackets || []).length),
      avgPacketBytes: stats.avgPacketBytes || (packetSamples.length > 0
        ? Math.round(packetSamples.reduce((sum, sample) => sum + (sample.size || 0), 0) / packetSamples.length)
        : 0),
      lastPerfLines: state.perfLog.slice(-5)
    };
  }

  async function runStress400Benchmark(durationSec) {
    const seconds = Math.max(6, Number(durationSec) || 12);
    state._menuMode = "single";
    state._quickStartScenario = "stress400";
    startGameSingle(state._myNickname || "Benchmark");
    await new Promise((resolve) => setTimeout(resolve, Math.round(seconds * 1000)));
    return {
      scenario: "stress400",
      durationSec: seconds,
      perf: getPerfSummary(),
      cardState: getCardStatePayloadForPlayer(state.myPlayerId)
    };
  }

  if (debugToolsEnabled) {
    window._gameTest = {
      cam,
      centerOn,
      state, spawnXPOrb, killUnit, spawnMineGem, stepResourceMagnet, stepPickups, makeGemVisual,
      getSquads, getFormationOffsets, applyFormationToSquad, spawnUnitAt, getUnitAtkRange, getUnitEngagementRange, queryHash,
      squadLogic: typeof SQUADLOGIC !== "undefined" ? SQUADLOGIC : null,
      makeLogicTestState,
      addLogicTestUnit,
      stepLogicTestState,
      describeOrderPreview,
      getPerfSummary,
      runStress400Benchmark,
      getCardStatePayloadForPlayer
    };
  } else if (typeof window !== "undefined" && window._gameTest) {
    delete window._gameTest;
  }

})();