(function () {
  const audio = document.getElementById("bgMusic");
  if (!audio) return;

  const DEFAULT_TRACK_FILES = [
    "Cold Orbit Command (2).mp3",
    "Cold star.mp3",
    "Door to stars.mp3",
    "Electros.mp3",
    "Engage the hyper.mp3",
    "Gravitational Echoes.mp3",
    "Hello void.mp3",
    "Isolate.mp3",
    "Last step to the stars.mp3",
    "Pneumonic.mp3",
    "Q-D-3-1-9.mp3",
    "Remnants.mp3",
    "See you on eclipse side feat. datreya.mp3",
    "See you on sun side feat. datreya.mp3",
    "See you on theremin side feat. datreya.mp3",
    "Shatter of meteor.mp3",
    "Stars.exe.mp3",
    "UFO context.mp3",
    "VOID.mp3"
  ];
  const runtimeConfig = typeof window !== "undefined" ? (window.__VOIDFRONT_RUNTIME_CONFIG || {}) : {};
  const TRACK_FILES = Array.isArray(runtimeConfig.musicPlaylist) && runtimeConfig.musicPlaylist.length
    ? runtimeConfig.musicPlaylist.filter((fileName) => typeof fileName === "string" && fileName.trim())
    : DEFAULT_TRACK_FILES;

  const STORAGE_KEY_VOLUME = "voidfront.music.volume";
  const STORAGE_KEY_SHUFFLE = "voidfront.music.shuffle";
  const STORAGE_KEY_REPEAT = "voidfront.music.repeat";
  const STORAGE_KEY_ENABLED = "voidfront.music.enabled";
  const DEFAULT_VOLUME = 0.35;

  const tracks = TRACK_FILES.map((fileName) => ({
    fileName,
    title: fileName.replace(/\.mp3$/i, "")
  }));

  const playBtn = document.getElementById("mpPlay");
  const prevBtn = document.getElementById("mpPrev");
  const nextBtn = document.getElementById("mpNext");
  const shuffleBtn = document.getElementById("mpShuffle");
  const repeatBtn = document.getElementById("mpRepeat");
  const trackName = document.getElementById("mpTrackName");
  const trackSub = document.getElementById("mpTrackSub");
  const progressTrack = document.getElementById("mpProgressTrack");
  const progressFill = document.getElementById("mpProgressFill");
  const progressThumb = document.getElementById("mpProgressThumb");
  const timeNow = document.getElementById("mpTimeNow");
  const timeDur = document.getElementById("mpTimeDur");
  const volumeSlider = document.getElementById("mpVolume");
  const menuMusicToggleBtn = document.getElementById("menuMusicToggle");

  if (
    !tracks.length ||
    !playBtn ||
    !prevBtn ||
    !nextBtn ||
    !shuffleBtn ||
    !repeatBtn ||
    !progressTrack ||
    !progressFill ||
    !progressThumb ||
    !volumeSlider
  ) {
    return;
  }

  let currentIndex = Math.floor(Math.random() * tracks.length);
  let musicEnabled = readSavedBoolean(STORAGE_KEY_ENABLED, true);
  let wantsPlayback = musicEnabled;
  let autoplayBlocked = false;
  let recoverAttempts = 0;
  let isSeeking = false;
  let seekPointerId = null;
  let lastSeekClientX = 0;
  let shuffleEnabled = readSavedBoolean(STORAGE_KEY_SHUFFLE, false);
  let repeatEnabled = readSavedBoolean(STORAGE_KEY_REPEAT, false);
  let externalPauseDepth = 0;
  let shouldResumeAfterExternalPause = false;
  const playbackHistory = [];

  audio.preload = "auto";
  audio.autoplay = true;
  audio.loop = repeatEnabled;
  audio.muted = false;
  audio.playsInline = true;
  audio.volume = readSavedVolume();
  volumeSlider.value = String(Math.round(audio.volume * 100));

  function readSavedVolume() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_VOLUME);
      if (raw == null) return DEFAULT_VOLUME;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return DEFAULT_VOLUME;
      return Math.max(0, Math.min(1, parsed));
    } catch (_err) {
      return DEFAULT_VOLUME;
    }
  }

  function readSavedBoolean(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return raw === "1";
    } catch (_err) {
      return fallback;
    }
  }

  function saveValue(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_err) {
      // Ignore storage issues, player still works in memory.
    }
  }

  function normalizeIndex(index) {
    return ((index % tracks.length) + tracks.length) % tracks.length;
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function formatTime(value) {
    if (!Number.isFinite(value) || value < 0) return "0:00";
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return minutes + ":" + String(seconds).padStart(2, "0");
  }

  function makeAssetUrl(fileName) {
    return "assets/" + encodeURIComponent(fileName);
  }

  function getRandomIndex(excludeIndex) {
    if (tracks.length <= 1) return excludeIndex;
    let nextIndex = excludeIndex;
    while (nextIndex === excludeIndex) {
      nextIndex = Math.floor(Math.random() * tracks.length);
    }
    return nextIndex;
  }

  function getNextIndex() {
    return shuffleEnabled ? getRandomIndex(currentIndex) : normalizeIndex(currentIndex + 1);
  }

  function updateToggleButton(button, active, labelWhenOff, labelWhenOn) {
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.textContent = active ? labelWhenOn : labelWhenOff;
  }

  function updateModeButtons() {
    updateToggleButton(shuffleBtn, shuffleEnabled, "Mix", "Mix");
    updateToggleButton(repeatBtn, repeatEnabled, "Loop", "Loop");
    audio.loop = repeatEnabled;
  }

  function updateMusicToggleButton() {
    if (!menuMusicToggleBtn) return;
    menuMusicToggleBtn.textContent = musicEnabled ? "Выкл музыку" : "Вкл музыку";
    menuMusicToggleBtn.setAttribute("aria-pressed", musicEnabled ? "true" : "false");
  }

  function setProgressVisual(progress01) {
    const percent = clamp01(progress01) * 100;
    progressFill.style.width = percent + "%";
    progressThumb.style.left = percent + "%";
  }

  function updateTrackMeta() {
    const track = tracks[currentIndex];
    if (trackName) trackName.textContent = track.title;
    if (!trackSub) return;

    const flags = [];
    if (shuffleEnabled) flags.push("mix");
    if (repeatEnabled) flags.push("loop");

    let status = "Трек " + (currentIndex + 1) + " / " + tracks.length;
    if (flags.length) status += " • " + flags.join(" • ");

    if (autoplayBlocked && wantsPlayback && audio.paused) {
      status += " • браузер временно блокирует автостарт";
    } else if (wantsPlayback && !audio.paused) {
      status += " • играет";
    } else if (wantsPlayback) {
      status += " • загрузка";
    } else {
      status += " • пауза";
    }

    trackSub.textContent = status;
  }

  function updatePlayButton() {
    const isPlaying = !audio.paused && !audio.ended;
    playBtn.innerHTML = isPlaying ? "&#10074;&#10074;" : "&#9654;";
    playBtn.title = isPlaying ? "Пауза" : "Играть";
  }

  function updateProgressUi(forcedTime) {
    const duration = audio.duration || 0;
    const currentTime = forcedTime != null ? forcedTime : (audio.currentTime || 0);
    const progress = duration > 0 ? currentTime / duration : 0;

    setProgressVisual(progress);
    if (timeNow) timeNow.textContent = formatTime(currentTime);
    if (timeDur) timeDur.textContent = formatTime(duration);
  }

  function updateMediaSession() {
    if (!("mediaSession" in navigator) || typeof MediaMetadata !== "function") return;
    const track = tracks[currentIndex];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: "VoidFront OST",
      album: "VoidFront"
    });
    navigator.mediaSession.playbackState = audio.paused ? "paused" : "playing";
  }

  function attemptPlay() {
    if (!wantsPlayback) {
      updatePlayButton();
      updateTrackMeta();
      return Promise.resolve(false);
    }

    const playPromise = audio.play();
    if (!playPromise || typeof playPromise.then !== "function") {
      autoplayBlocked = false;
      updatePlayButton();
      updateTrackMeta();
      updateMediaSession();
      return Promise.resolve(true);
    }

    return playPromise.then(() => {
      autoplayBlocked = false;
      recoverAttempts = 0;
      updatePlayButton();
      updateTrackMeta();
      updateMediaSession();
      return true;
    }).catch((err) => {
      autoplayBlocked = !!(err && err.name === "NotAllowedError");
      updatePlayButton();
      updateTrackMeta();
      updateMediaSession();
      return false;
    });
  }

  function loadTrack(index, options) {
    const opts = options || {};
    const nextIndex = normalizeIndex(index);
    if (opts.recordHistory !== false && tracks.length > 1 && nextIndex !== currentIndex) {
      playbackHistory.push(currentIndex);
      if (playbackHistory.length > 50) playbackHistory.shift();
    }

    currentIndex = nextIndex;
    const track = tracks[currentIndex];
    audio.loop = repeatEnabled;
    audio.src = makeAssetUrl(track.fileName);
    audio.load();

    if (trackName) trackName.textContent = track.title;
    if (timeNow) timeNow.textContent = "0:00";
    if (timeDur) timeDur.textContent = "0:00";
    setProgressVisual(0);
    updateTrackMeta();
    updatePlayButton();
    updateModeButtons();
    updateMediaSession();

    if (opts.autoPlay !== false && wantsPlayback) {
      attemptPlay();
    }
  }

  function play() {
    if (!musicEnabled) {
      updateMusicToggleButton();
      return;
    }
    wantsPlayback = true;
    attemptPlay();
  }

  function pause() {
    wantsPlayback = false;
    autoplayBlocked = false;
    audio.pause();
    updatePlayButton();
    updateTrackMeta();
    updateMediaSession();
  }

  function toggle() {
    if (!audio.paused && !audio.ended) pause();
    else play();
  }

  function setMusicEnabled(enabled) {
    musicEnabled = !!enabled;
    saveValue(STORAGE_KEY_ENABLED, musicEnabled ? "1" : "0");
    if (!musicEnabled) {
      pause();
    } else {
      wantsPlayback = true;
      attemptPlay();
    }
    updateMusicToggleButton();
  }

  function toggleMusicEnabled() {
    setMusicEnabled(!musicEnabled);
  }

  function pauseForExternal() {
    externalPauseDepth += 1;
    if (externalPauseDepth === 1) {
      shouldResumeAfterExternalPause = wantsPlayback && !audio.paused;
      pause();
    }
  }

  function resumeAfterExternal() {
    if (externalPauseDepth > 0) externalPauseDepth -= 1;
    if (externalPauseDepth === 0 && shouldResumeAfterExternalPause) {
      shouldResumeAfterExternalPause = false;
      play();
    }
  }

  function next() {
    recoverAttempts = 0;
    loadTrack(getNextIndex());
  }

  function prev() {
    if ((audio.currentTime || 0) > 5) {
      audio.currentTime = 0;
      updateProgressUi();
      if (wantsPlayback) attemptPlay();
      return;
    }

    recoverAttempts = 0;
    if (playbackHistory.length) {
      const previousIndex = playbackHistory.pop();
      loadTrack(previousIndex, { recordHistory: false });
      return;
    }

    loadTrack(normalizeIndex(currentIndex - 1));
  }

  function toggleShuffle() {
    shuffleEnabled = !shuffleEnabled;
    saveValue(STORAGE_KEY_SHUFFLE, shuffleEnabled ? "1" : "0");
    updateModeButtons();
    updateTrackMeta();
  }

  function toggleRepeat() {
    repeatEnabled = !repeatEnabled;
    saveValue(STORAGE_KEY_REPEAT, repeatEnabled ? "1" : "0");
    updateModeButtons();
    updateTrackMeta();
  }

  function retryAutoplayOnInteraction() {
    if (!wantsPlayback || !audio.paused) return;
    attemptPlay();
  }

  function seekFromClientX(clientX, commit) {
    const duration = audio.duration || 0;
    const rect = progressTrack.getBoundingClientRect();
    if (rect.width <= 0 || duration <= 0) {
      updateProgressUi();
      return;
    }

    const ratio = clamp01((clientX - rect.left) / rect.width);
    const newTime = ratio * duration;
    setProgressVisual(ratio);
    if (timeNow) timeNow.textContent = formatTime(newTime);
    if (timeDur) timeDur.textContent = formatTime(duration);
    if (commit) {
      audio.currentTime = newTime;
    }
  }

  function beginSeek(event) {
    const duration = audio.duration || 0;
    if (duration <= 0) return;

    isSeeking = true;
    seekPointerId = event.pointerId;
    lastSeekClientX = event.clientX;
    seekFromClientX(lastSeekClientX, true);
  }

  function moveSeek(event) {
    if (!isSeeking || event.pointerId !== seekPointerId) return;
    lastSeekClientX = event.clientX;
    seekFromClientX(lastSeekClientX, true);
  }

  function endSeek(event) {
    if (!isSeeking || event.pointerId !== seekPointerId) return;
    if (Number.isFinite(event.clientX) && event.clientX > 0) {
      lastSeekClientX = event.clientX;
    }
    seekFromClientX(lastSeekClientX, true);
    isSeeking = false;
    seekPointerId = null;
    updateProgressUi();
  }

  playBtn.addEventListener("click", toggle);
  nextBtn.addEventListener("click", next);
  prevBtn.addEventListener("click", prev);
  shuffleBtn.addEventListener("click", toggleShuffle);
  repeatBtn.addEventListener("click", toggleRepeat);
  if (menuMusicToggleBtn) menuMusicToggleBtn.addEventListener("click", toggleMusicEnabled);

  volumeSlider.addEventListener("input", () => {
    audio.volume = Math.max(0, Math.min(1, Number(volumeSlider.value) / 100));
    saveValue(STORAGE_KEY_VOLUME, String(audio.volume));
  });

  progressTrack.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    beginSeek(event);
  });
  progressTrack.addEventListener("click", (event) => {
    if (isSeeking) return;
    seekFromClientX(event.clientX, true);
    updateProgressUi();
  });

  document.addEventListener("pointermove", moveSeek);
  document.addEventListener("pointerup", endSeek);
  document.addEventListener("pointercancel", endSeek);

  audio.addEventListener("timeupdate", () => {
    if (isSeeking) return;
    updateProgressUi();
  });
  audio.addEventListener("loadedmetadata", updateProgressUi);
  audio.addEventListener("durationchange", updateProgressUi);
  audio.addEventListener("canplay", () => {
    updateProgressUi();
    if (wantsPlayback && audio.paused) attemptPlay();
  });
  audio.addEventListener("playing", () => {
    autoplayBlocked = false;
    updatePlayButton();
    updateTrackMeta();
    updateMediaSession();
  });
  audio.addEventListener("pause", () => {
    updatePlayButton();
    updateTrackMeta();
    updateMediaSession();
  });
  audio.addEventListener("ended", () => {
    if (repeatEnabled) return;
    next();
  });
  audio.addEventListener("error", () => {
    recoverAttempts += 1;
    if (recoverAttempts >= tracks.length) {
      wantsPlayback = false;
      autoplayBlocked = false;
      updatePlayButton();
      if (trackSub) trackSub.textContent = "Не удалось загрузить треки плейлиста";
      return;
    }
    loadTrack(getNextIndex());
  });

  document.addEventListener("pointerdown", retryAutoplayOnInteraction, { passive: true });
  document.addEventListener("keydown", retryAutoplayOnInteraction);
  window.addEventListener("focus", retryAutoplayOnInteraction);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) retryAutoplayOnInteraction();
  });

  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play", play);
      navigator.mediaSession.setActionHandler("pause", pause);
      navigator.mediaSession.setActionHandler("previoustrack", prev);
      navigator.mediaSession.setActionHandler("nexttrack", next);
    } catch (_err) {
      // Some browsers expose mediaSession but support only part of the API.
    }
  }

  updateModeButtons();
  updateMusicToggleButton();
  loadTrack(currentIndex, { recordHistory: false });
  if (musicEnabled) {
    setTimeout(() => attemptPlay(), 0);
    setTimeout(() => attemptPlay(), 300);
  }

  window.MusicPlayer = {
    getTracks: () => tracks.slice(),
    getCurrentIndex: () => currentIndex,
    isMusicEnabled: () => musicEnabled,
    isShuffleEnabled: () => shuffleEnabled,
    isRepeatEnabled: () => repeatEnabled,
    play,
    pause,
    toggle,
    setMusicEnabled,
    toggleMusicEnabled,
    next,
    prev,
    toggleShuffle,
    toggleRepeat,
    pauseForExternal,
    resumeAfterExternal
  };
})();
