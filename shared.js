/* ============================================================
   NEON ARCADE — shared runtime
   Firebase-Leaderboard, Audio, generischer Spiel-Loop, Hub/Overlays.
   Jedes Spiel registriert sich über Arcade.registerGame({...}).
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Theme ---------- */
  const THEMES = {
    neon: {
      bgTop: "#0c0620", bgBottom: "#05030f",
      ground: "#00f6ff", groundDim: "#7c3aed",
      player: "#00f6ff", playerAccent: "#e8e6ff",
      hazardA: "#ff7a1a", hazardB: "#ff2bd6",
      collectible: "#fff500", powerupA: "#39ff88", powerupB: "#ff2bd6",
      particleLight: "#e8e6ff", ai: "#ff2bd6"
    },
    retro: {
      bgTop: "#5c94fc", bgBottom: "#a8d8ff",
      ground: "#8b5a2b", groundDim: "#5c3a1a",
      player: "#e53935", playerAccent: "#ffe0b2",
      hazardA: "#6d4c1c", hazardB: "#43a047",
      collectible: "#ffd700", powerupA: "#4caf50", powerupB: "#ff9800",
      particleLight: "#ffffff", ai: "#3a3a3a"
    }
  };
  let currentTheme = localStorage.getItem("arcadeTheme") === "retro" ? "retro" : "neon";
  function theme() { return THEMES[currentTheme]; }
  function applyThemeAttr() {
    document.documentElement.setAttribute("data-theme", currentTheme);
    const btn = document.getElementById("themeToggleBtn");
    if (btn) btn.textContent = currentTheme === "retro" ? "🕹️ Neon" : "🍄 Retro";
    const hubTitle = document.getElementById("hubTitle");
    if (hubTitle) hubTitle.textContent = currentTheme === "retro" ? "PIXEL QUEST" : "NEON ARCADE";
  }
  function toggleTheme() {
    currentTheme = currentTheme === "retro" ? "neon" : "retro";
    localStorage.setItem("arcadeTheme", currentTheme);
    applyThemeAttr();
  }

  /* ---------- Firebase ---------- */
  const firebaseConfig = {
    apiKey: "AIzaSyDV_JiF7JuHUtrwXRuiNCLodJh_NamRwFQ",
    authDomain: "fakten-website.firebaseapp.com",
    databaseURL: "https://fakten-website-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "fakten-website",
    storageBucket: "fakten-website.firebasestorage.app",
    messagingSenderId: "489067963407"
  };

  let db = null;
  let firebaseEnabled = false;
  let leaderboardRef = null;

  function tryInitFirebase() {
    try {
      firebase.initializeApp(firebaseConfig);
      db = firebase.database();
      firebaseEnabled = true;
    } catch (e) {
      firebaseEnabled = false;
    }
  }

  function setDbStatus(text) {
    const el = document.getElementById("dbStatus");
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function renderLeaderboard(entries) {
    const list = document.getElementById("leaderboardList");
    list.innerHTML = "";
    if (!entries.length) {
      list.innerHTML = '<li class="leaderboard-empty">Noch keine Einträge — sei der Erste.</li>';
      return;
    }
    entries.forEach(function (entry, i) {
      const li = document.createElement("li");
      li.innerHTML =
        '<span class="rank">' + (i + 1) + '.</span>' +
        '<span class="name">' + escapeHtml(entry.name || "???") + '</span>' +
        '<span class="points">' + entry.score + '</span>';
      list.appendChild(li);
    });
  }

  function watchLeaderboard(gameId) {
    if (leaderboardRef) leaderboardRef.off();
    if (!firebaseEnabled) {
      setDbStatus("Offline-Modus — nur lokaler Highscore.");
      renderLeaderboard([]);
      return;
    }
    leaderboardRef = db.ref("leaderboard/" + gameId).orderByChild("score").limitToLast(10);
    leaderboardRef.on("value", function (snap) {
      const entries = [];
      snap.forEach(function (child) { entries.push(child.val()); });
      entries.sort(function (a, b) { return b.score - a.score; });
      renderLeaderboard(entries);
      setDbStatus("Verbunden — globale Bestenliste live.");
    }, function () {
      setDbStatus("Server nicht erreichbar — nur lokaler Highscore.");
      renderLeaderboard([]);
    });
  }

  function submitScore(gameId, name, score) {
    if (!firebaseEnabled) return;
    db.ref("leaderboard/" + gameId).push({ name: name, score: score, ts: Date.now() });
  }

  /* ---------- Audio ---------- */
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { audioCtx = null; }
    } else if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function beep(freqStart, freqEnd, duration, type, volume) {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.linearRampToValueAtTime(freqEnd, t0 + duration);
    gain.gain.setValueAtTime(volume || 0.14, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + duration);
  }

  function noiseBurst(duration, volume) {
    if (!audioCtx) return;
    const bufferSize = Math.floor(audioCtx.sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(volume || 0.15, audioCtx.currentTime);
    src.connect(gain).connect(audioCtx.destination);
    src.start();
  }

  /* ---------- Helpers ---------- */
  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function circlesOverlap(ax, ay, ar, bx, by, br) {
    const dx = ax - bx, dy = ay - by, r = ar + br;
    return dx * dx + dy * dy < r * r;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ---------- Core orchestrator ---------- */
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const hubOverlay = document.getElementById("hubOverlay");
  const hubGrid = document.getElementById("hubGrid");
  const startOverlay = document.getElementById("startOverlay");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const pauseOverlay = document.getElementById("pauseOverlay");
  const gameWrap = document.getElementById("gameWrap");
  const hudRow = document.getElementById("hudRow");
  const activeGameLabel = document.getElementById("activeGameLabel");
  const finalScoreEl = document.getElementById("finalScore");
  const personalBestLine = document.getElementById("personalBestLine");
  const initialsInput = document.getElementById("initials");
  const submitScoreBtn = document.getElementById("submitScoreBtn");
  const highscoreForm = document.getElementById("highscoreForm");
  const startTitle = document.getElementById("startTitle");
  const startDesc = document.getElementById("startDesc");
  const startControls = document.getElementById("startControls");
  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");
  const backToHubBtn = document.getElementById("backToHubBtn");
  const gameOverBackBtn = document.getElementById("gameOverBackBtn");

  const games = {};
  const gameOrder = [];
  let activeGame = null;
  let screen = "hub"; // hub | start | playing | paused | over
  let lastTs = 0;
  let currentScore = 0;

  function setHudFields(fields) {
    hudRow.innerHTML = "";
    fields.forEach(function (f) {
      const div = document.createElement("div");
      div.className = "hud-item";
      div.innerHTML = '<span class="hud-label">' + f.label + '</span><b id="hud_' + f.id + '">' + (f.value != null ? f.value : 0) + '</b>';
      hudRow.appendChild(div);
    });
  }

  function setHud(id, value) {
    const el = document.getElementById("hud_" + id);
    if (el) el.textContent = value;
  }

  function registerGame(def) {
    games[def.id] = def;
    gameOrder.push(def.id);
  }

  function buildHub() {
    hubGrid.innerHTML = "";
    gameOrder.forEach(function (id) {
      const g = games[id];
      const card = document.createElement("button");
      card.className = "hub-card";
      card.style.setProperty("--accent", g.accent);
      card.innerHTML =
        '<span class="hub-card-name">' + g.name + '</span>' +
        '<span class="hub-card-tagline">' + g.tagline + '</span>';
      card.addEventListener("click", function () { openGame(id); });
      hubGrid.appendChild(card);
    });
  }

  function showOnly(el) {
    [hubOverlay, startOverlay, gameOverOverlay, pauseOverlay].forEach(function (o) {
      if (o === el) o.classList.remove("hidden"); else o.classList.add("hidden");
    });
  }

  function openGame(id) {
    activeGame = games[id];
    screen = "start";
    canvas.width = activeGame.canvasW;
    canvas.height = activeGame.canvasH;
    gameWrap.style.maxWidth = activeGame.canvasW + "px";
    activeGameLabel.textContent = activeGame.name;
    hudRow.classList.remove("hidden");
    setHudFields(activeGame.hud);
    startTitle.textContent = activeGame.name;
    startDesc.innerHTML = activeGame.description;
    startControls.textContent = activeGame.controlsHint;
    startBtn.textContent = activeGame.startLabel || "Starten";
    watchLeaderboard(id);
    if (activeGame.onLoad) activeGame.onLoad();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    showOnly(startOverlay);
  }

  function backToHub() {
    activeGame = null;
    screen = "hub";
    hudRow.classList.add("hidden");
    activeGameLabel.textContent = "";
    showOnly(hubOverlay);
  }

  function loop(ts) {
    if (screen !== "playing" || !activeGame) return;
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    dt = Math.min(dt, 0.05);
    lastTs = ts;
    activeGame.onUpdate(dt);
    if (screen === "playing") {
      activeGame.onDraw(ctx, canvas.width, canvas.height);
      requestAnimationFrame(loop);
    }
  }

  function startRun() {
    ensureAudio();
    activeGame.onStart();
    screen = "playing";
    lastTs = 0;
    showOnly(null);
    highscoreForm.style.display = "flex";
    requestAnimationFrame(loop);
  }

  function endRun(score) {
    screen = "over";
    currentScore = Math.floor(score);
    activeGame.onDraw(ctx, canvas.width, canvas.height);
    finalScoreEl.textContent = currentScore;
    const bestKey = "arcadeBest_" + activeGame.id;
    let best = Number(localStorage.getItem(bestKey) || 0);
    if (currentScore > best) {
      best = currentScore;
      localStorage.setItem(bestKey, String(best));
      personalBestLine.textContent = "Neuer persönlicher Rekord!";
    } else {
      personalBestLine.textContent = "Persönlicher Rekord: " + best;
    }
    setHud("best", best);
    showOnly(gameOverOverlay);
    initialsInput.value = "";
    initialsInput.focus();
  }

  function pauseRun() {
    if (screen !== "playing") return;
    screen = "paused";
    showOnly(pauseOverlay);
  }

  function resumeRun() {
    if (screen !== "paused") return;
    screen = "playing";
    showOnly(null);
    lastTs = 0;
    requestAnimationFrame(loop);
  }

  startBtn.addEventListener("click", startRun);
  restartBtn.addEventListener("click", startRun);
  backToHubBtn.addEventListener("click", backToHub);
  gameOverBackBtn.addEventListener("click", backToHub);
  document.getElementById("resumeBtn").addEventListener("click", resumeRun);

  function submitWithName(rawName) {
    const name = (rawName || "???").trim().toUpperCase().slice(0, 3) || "???";
    submitScore(activeGame.id, name, currentScore);
    highscoreForm.style.display = "none";
  }

  submitScoreBtn.addEventListener("click", function () {
    submitWithName(initialsInput.value);
  });

  document.querySelectorAll(".quick-name-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      submitWithName(btn.dataset.name);
    });
  });

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (screen === "playing") pauseRun();
      else if (screen === "paused") resumeRun();
      return;
    }
    if (screen === "playing" && activeGame && activeGame.onKeyDown) activeGame.onKeyDown(e);
  });
  window.addEventListener("keyup", function (e) {
    if (screen === "playing" && activeGame && activeGame.onKeyUp) activeGame.onKeyUp(e);
  });
  canvas.addEventListener("pointerdown", function (e) {
    if (screen === "playing" && activeGame && activeGame.onPointerDown) activeGame.onPointerDown(e);
  });
  window.addEventListener("pointerup", function (e) {
    if (activeGame && activeGame.onPointerUp) activeGame.onPointerUp(e);
  });
  canvas.addEventListener("pointermove", function (e) {
    if (screen === "playing" && activeGame && activeGame.onPointerMove) activeGame.onPointerMove(e);
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pauseRun();
  });

  const themeToggleBtn = document.getElementById("themeToggleBtn");
  if (themeToggleBtn) themeToggleBtn.addEventListener("click", toggleTheme);

  window.Arcade = {
    registerGame: registerGame,
    setHud: setHud,
    ensureAudio: ensureAudio,
    beep: beep,
    noiseBurst: noiseBurst,
    rectsOverlap: rectsOverlap,
    circlesOverlap: circlesOverlap,
    clamp: clamp,
    endRun: endRun,
    canvas: canvas,
    ctx: ctx,
    theme: theme,
    isRetro: function () { return currentTheme === "retro"; },
    ready: function () {
      applyThemeAttr();
      tryInitFirebase();
      buildHub();
      showOnly(hubOverlay);
    }
  };
})();
