(function () {
  "use strict";

  /* ============================================================
     FIREBASE
     Selbe Realtime-Database wie beim Vorgänger-Projekt, eigener
     "leaderboard"-Zweig für die globale Bestenliste.
     ============================================================ */
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

  function initLeaderboard() {
    if (!firebaseEnabled) {
      setDbStatus("Offline-Modus — nur lokaler Highscore.");
      renderLeaderboard([]);
      return;
    }
    const ref = db.ref("leaderboard").orderByChild("score").limitToLast(10);
    ref.on("value", function (snap) {
      const entries = [];
      snap.forEach(function (child) {
        entries.push(child.val());
      });
      entries.sort(function (a, b) { return b.score - a.score; });
      renderLeaderboard(entries);
      setDbStatus("Verbunden — globale Bestenliste live.");
    }, function () {
      setDbStatus("Server nicht erreichbar — nur lokaler Highscore.");
      renderLeaderboard([]);
    });
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

  function submitScore(name, score) {
    if (!firebaseEnabled) return;
    db.ref("leaderboard").push({
      name: name,
      score: score,
      ts: Date.now()
    });
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  /* ============================================================
     AUDIO — kleine prozedurale Synth-SFX, keine externen Dateien
     ============================================================ */
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        audioCtx = null;
      }
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

  function playSfx(name, level) {
    if (!audioCtx) return;
    switch (name) {
      case "jump": beep(320, 640, 0.12, "square", 0.12); break;
      case "doublejump": beep(520, 940, 0.1, "square", 0.1); break;
      case "duck": beep(160, 90, 0.09, "sine", 0.08); break;
      case "collect": beep(680 + (level || 1) * 55, 1080 + (level || 1) * 55, 0.09, "triangle", 0.13); break;
      case "shield": beep(220, 1100, 0.28, "sawtooth", 0.1); break;
      case "crash": beep(300, 40, 0.4, "sawtooth", 0.18); break;
    }
  }

  /* ============================================================
     GAME — Neon Rush (side-scrolling reflex runner)
     ============================================================ */
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const GROUND_Y = H - 70;

  const scoreVal = document.getElementById("scoreVal");
  const bestVal = document.getElementById("bestVal");
  const speedVal = document.getElementById("speedVal");
  const comboVal = document.getElementById("comboVal");
  const startOverlay = document.getElementById("startOverlay");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const pauseOverlay = document.getElementById("pauseOverlay");
  const finalScoreEl = document.getElementById("finalScore");
  const personalBestLine = document.getElementById("personalBestLine");
  const initialsInput = document.getElementById("initials");
  const submitScoreBtn = document.getElementById("submitScoreBtn");
  const highscoreForm = document.getElementById("highscoreForm");

  const PLAYER_X = 130;
  const PLAYER_W_STAND = 30;
  const PLAYER_H_STAND = 44;
  const PLAYER_H_DUCK = 24;
  const DUCK_CLEARANCE = 30;
  const GRAVITY = 2400;
  const JUMP_VELOCITY = -840;
  const DOUBLE_JUMP_VELOCITY = -700;
  const BASE_SPEED = 340;
  const MAX_SPEED = 940;
  const SHIELD_DURATION = 5;

  let state = "idle"; // idle | playing | paused | over
  let player, obstacles, shards, powerups, particles, popups, groundLines, skyline, stars;
  let score = 0;
  let distance = 0;
  let speed = BASE_SPEED;
  let elapsed = 0;
  let spawnTimer = 0;
  let shardTimer = 0;
  let powerupTimer = 0;
  let comboStreak = 1;
  let lastTs = 0;
  let shakeT = 0;
  let personalBest = Number(localStorage.getItem("neonRushBest") || 0);
  bestVal.textContent = personalBest;

  let keys = { duck: false };

  function resetGame() {
    player = {
      y: GROUND_Y - PLAYER_H_STAND,
      vy: 0,
      ducking: false,
      grounded: true,
      jumpsUsed: 0,
      shielded: false,
      shieldTime: 0,
      duckSfxPlayed: false,
      trail: []
    };
    obstacles = [];
    shards = [];
    powerups = [];
    particles = [];
    popups = [];
    groundLines = [];
    for (let i = 0; i < 24; i++) groundLines.push(i * 40);
    skyline = [];
    for (let i = 0; i < 14; i++) {
      skyline.push({
        x: i * 90 + Math.random() * 40,
        h: 40 + Math.random() * 120,
        w: 26 + Math.random() * 30
      });
    }
    stars = [];
    for (let i = 0; i < 50; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * (GROUND_Y - 150) + 20,
        r: 0.6 + Math.random() * 1.4,
        tw: Math.random() * Math.PI * 2
      });
    }
    score = 0;
    distance = 0;
    speed = BASE_SPEED;
    elapsed = 0;
    spawnTimer = 1.1;
    shardTimer = 1.6;
    powerupTimer = 11 + Math.random() * 4;
    comboStreak = 1;
    shakeT = 0;
    comboVal.textContent = "x1";
    updateHud();
  }

  function updateHud() {
    scoreVal.textContent = Math.floor(score);
    speedVal.textContent = "x" + (speed / BASE_SPEED).toFixed(1);
  }

  function playerHeight() {
    return player.ducking ? PLAYER_H_DUCK : PLAYER_H_STAND;
  }

  function spawnObstacle() {
    const kind = Math.random() < 0.55 ? "low" : "high";
    if (kind === "low") {
      const w = 26 + Math.random() * 22;
      obstacles.push({
        kind: "low",
        x: W + w,
        w: w,
        h: 38 + Math.random() * 30,
        y: 0
      });
    } else {
      const w = 60 + Math.random() * 40;
      const h = 24 + Math.random() * 10;
      const bottomY = GROUND_Y - PLAYER_H_DUCK - DUCK_CLEARANCE;
      obstacles.push({
        kind: "high",
        x: W + w,
        w: w,
        h: h,
        y: bottomY - h
      });
    }
  }

  function spawnShard() {
    const high = Math.random() < 0.5;
    shards.push({
      x: W + 20,
      y: high ? GROUND_Y - PLAYER_H_STAND - 50 - Math.random() * 40 : GROUND_Y - 16,
      r: 8,
      t: Math.random() * Math.PI * 2
    });
  }

  function spawnPowerup() {
    powerups.push({
      x: W + 20,
      y: GROUND_Y - PLAYER_H_STAND - 30 - Math.random() * 70,
      r: 12,
      t: Math.random() * Math.PI * 2
    });
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 22; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 80 + Math.random() * 260;
      particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        color: color
      });
    }
  }

  function spawnPopup(x, y, text, color) {
    popups.push({ x: x, y: y, text: text, color: color, life: 0.7, maxLife: 0.7 });
  }

  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function update(dt) {
    elapsed += dt;
    speed = Math.min(MAX_SPEED, BASE_SPEED + elapsed * 14);
    distance += speed * dt;
    score += (speed * dt) / 8;
    updateHud();

    // player physics — ducking intent resolved BEFORE gravity/ground snap,
    // so height + position stay consistent within the same frame
    player.ducking = keys.duck && player.grounded;
    if (player.ducking && !player.duckSfxPlayed) {
      playSfx("duck");
      player.duckSfxPlayed = true;
    } else if (!player.ducking) {
      player.duckSfxPlayed = false;
    }
    const h = playerHeight();

    if (player.grounded) {
      // Feet bleiben am Boden verankert, egal ob die Höhe gerade durch
      // Ducken wechselt — keine Schwerkraft-Integration nötig, solange
      // wir schon stehen (verhindert das "Kopf bleibt oben"-Flackern).
      player.y = GROUND_Y - h;
      player.vy = 0;
    } else {
      player.vy += GRAVITY * dt;
      player.y += player.vy * dt;
      if (player.y >= GROUND_Y - h) {
        player.y = GROUND_Y - h;
        player.vy = 0;
        player.grounded = true;
        player.jumpsUsed = 0;
      }
    }

    if (player.shielded) {
      player.shieldTime -= dt;
      if (player.shieldTime <= 0) player.shielded = false;
    }

    player.trail.push({ x: PLAYER_X, y: player.y + h / 2, h: h });
    if (player.trail.length > 6) player.trail.shift();

    // ground scroll
    for (let i = 0; i < groundLines.length; i++) {
      groundLines[i] -= speed * dt;
      if (groundLines[i] < -40) groundLines[i] += 24 * 40;
    }
    skyline.forEach(function (s) { s.x -= speed * 0.35 * dt; });
    if (skyline.length && skyline[0].x < -60) {
      const last = skyline[skyline.length - 1];
      skyline.shift();
      skyline.push({ x: last.x + 90 + Math.random() * 40, h: 40 + Math.random() * 120, w: 26 + Math.random() * 30 });
    }
    stars.forEach(function (s) {
      s.x -= speed * 0.12 * dt;
      if (s.x < -4) s.x = W + 4;
    });

    // spawn
    spawnTimer -= dt;
    const spawnInterval = Math.max(1.15 - elapsed * 0.012, 0.55);
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = spawnInterval + Math.random() * 0.3;
    }
    shardTimer -= dt;
    if (shardTimer <= 0) {
      spawnShard();
      shardTimer = 1.3 + Math.random() * 1.4;
    }
    powerupTimer -= dt;
    if (powerupTimer <= 0) {
      spawnPowerup();
      powerupTimer = 16 + Math.random() * 10;
    }

    const pY = player.y;

    // obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speed * dt;
      const oy = o.kind === "low" ? GROUND_Y - o.h : o.y;
      if (rectsOverlap(PLAYER_X, pY, PLAYER_W_STAND, h, o.x, oy, o.w, o.h)) {
        if (player.shielded) {
          spawnParticles(o.x + o.w / 2, oy + o.h / 2, "#39ff88");
          obstacles.splice(i, 1);
          continue;
        }
        crash();
        return;
      }
      if (o.x + o.w < -10) obstacles.splice(i, 1);
    }

    // shards
    for (let i = shards.length - 1; i >= 0; i--) {
      const s = shards[i];
      s.x -= speed * dt;
      s.t += dt * 4;
      const sy = s.y + Math.sin(s.t) * 4;
      if (rectsOverlap(PLAYER_X, pY, PLAYER_W_STAND, h, s.x - s.r, sy - s.r, s.r * 2, s.r * 2)) {
        const pts = 20 + (comboStreak - 1) * 10;
        score += pts;
        spawnPopup(s.x, sy, "+" + pts, "#fff500");
        spawnParticles(s.x, sy, "#fff500");
        playSfx("collect", comboStreak);
        comboStreak = Math.min(comboStreak + 1, 9);
        comboVal.textContent = "x" + comboStreak;
        shards.splice(i, 1);
        continue;
      }
      if (s.x < -20) {
        shards.splice(i, 1);
        if (comboStreak > 1) {
          comboStreak = 1;
          comboVal.textContent = "x1";
        }
      }
    }

    // powerups (shield)
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.x -= speed * dt;
      p.t += dt * 3;
      if (rectsOverlap(PLAYER_X, pY, PLAYER_W_STAND, h, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)) {
        player.shielded = true;
        player.shieldTime = SHIELD_DURATION;
        spawnPopup(p.x, p.y, "SCHILD", "#39ff88");
        spawnParticles(p.x, p.y, "#39ff88");
        playSfx("shield");
        powerups.splice(i, 1);
        continue;
      }
      if (p.x < -20) powerups.splice(i, 1);
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // popups
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.life -= dt;
      p.y -= 30 * dt;
      if (p.life <= 0) popups.splice(i, 1);
    }

    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
  }

  function crash() {
    spawnParticles(PLAYER_X + PLAYER_W_STAND / 2, player.y + playerHeight() / 2, "#ff2bd6");
    shakeT = 0.35;
    playSfx("crash");
    endGame();
  }

  function drawGrid() {
    const intensity = 0.3 + 0.3 * Math.min(1, (speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED));
    ctx.strokeStyle = "rgba(0,246,255," + Math.min(0.9, intensity + 0.2).toFixed(2) + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(W, GROUND_Y);
    ctx.stroke();

    ctx.strokeStyle = "rgba(124,58,237," + intensity.toFixed(2) + ")";
    ctx.lineWidth = 1;
    groundLines.forEach(function (gx) {
      ctx.beginPath();
      ctx.moveTo(gx, GROUND_Y);
      ctx.lineTo(gx - 60, H);
      ctx.stroke();
    });

    for (let y = GROUND_Y; y < H; y += 14) {
      ctx.strokeStyle = "rgba(0,246,255," + (intensity * 0.4 * (1 - (y - GROUND_Y) / (H - GROUND_Y))).toFixed(2) + ")";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  function drawStars() {
    stars.forEach(function (s) {
      const a = 0.3 + 0.5 * Math.abs(Math.sin(elapsed * 2 + s.tw));
      ctx.fillStyle = "rgba(232,230,255," + a.toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawSkyline() {
    const sunX = W * 0.78, sunY = GROUND_Y - 150, sunR = 90;
    const grad = ctx.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR);
    grad.addColorStop(0, "#fff500");
    grad.addColorStop(0.5, "#ff2bd6");
    grad.addColorStop(1, "#7c3aed");
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = grad;
    ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
    ctx.fillStyle = "#05030f";
    for (let y = -sunR; y < sunR; y += 10) {
      if (Math.floor(y / 10) % 2 === 0) continue;
      ctx.fillRect(sunX - sunR, sunY + y, sunR * 2, 5);
    }
    ctx.restore();

    ctx.fillStyle = "rgba(124,58,237,0.28)";
    skyline.forEach(function (s) {
      ctx.fillRect(s.x, GROUND_Y - s.h, s.w, s.h);
    });
  }

  function drawPlayer() {
    const h = playerHeight();
    const y = player.y;

    player.trail.forEach(function (t, i) {
      const a = (i / player.trail.length) * 0.25;
      ctx.fillStyle = "rgba(0,246,255," + a.toFixed(2) + ")";
      ctx.fillRect(t.x, t.y - t.h / 2, PLAYER_W_STAND, t.h);
    });

    if (player.shielded) {
      const pulse = 4 + Math.sin(elapsed * 10) * 2;
      ctx.save();
      ctx.strokeStyle = "rgba(57,255,136,0.7)";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#39ff88";
      ctx.shadowBlur = 12;
      ctx.strokeRect(PLAYER_X - 6 - pulse * 0.3, y - 6 - pulse * 0.3, PLAYER_W_STAND + 12 + pulse * 0.6, h + 12 + pulse * 0.6);
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = "#00f6ff";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#00f6ff";
    ctx.fillRect(PLAYER_X, y, PLAYER_W_STAND, h);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#e8e6ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(PLAYER_X, y, PLAYER_W_STAND, h);
    ctx.restore();
  }

  function drawObstacles() {
    obstacles.forEach(function (o) {
      const isLow = o.kind === "low";
      const oy = isLow ? GROUND_Y - o.h : o.y;
      const color = isLow ? "#ff7a1a" : "#ff2bd6";
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = color;
      ctx.fillRect(o.x, oy, o.w, o.h);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(o.x, oy, o.w, o.h);
      ctx.restore();
    });
  }

  function drawShards() {
    shards.forEach(function (s) {
      const sy = s.y + Math.sin(s.t) * 4;
      ctx.save();
      ctx.translate(s.x, sy);
      ctx.rotate(s.t);
      ctx.shadowColor = "#fff500";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#fff500";
      ctx.beginPath();
      ctx.moveTo(0, -s.r);
      ctx.lineTo(s.r, 0);
      ctx.lineTo(0, s.r);
      ctx.lineTo(-s.r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  function drawPowerups() {
    powerups.forEach(function (p) {
      const py = p.y + Math.sin(p.t) * 5;
      ctx.save();
      ctx.translate(p.x, py);
      ctx.rotate(p.t * 0.5);
      ctx.shadowColor = "#39ff88";
      ctx.shadowBlur = 16;
      ctx.strokeStyle = "#39ff88";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const px = Math.cos(ang) * p.r, pyy = Math.sin(ang) * p.r;
        if (i === 0) ctx.moveTo(px, pyy); else ctx.lineTo(px, pyy);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawParticles() {
    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    });
  }

  function drawPopups() {
    ctx.save();
    ctx.font = "600 13px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    popups.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    });
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.save();
    if (shakeT > 0) {
      ctx.translate((Math.random() - 0.5) * 10 * (shakeT / 0.35), (Math.random() - 0.5) * 10 * (shakeT / 0.35));
    }
    ctx.clearRect(-20, -20, W + 40, H + 40);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0c0620");
    bg.addColorStop(1, "#05030f");
    ctx.fillStyle = bg;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    drawStars();
    drawSkyline();
    drawGrid();
    drawShards();
    drawPowerups();
    drawObstacles();
    drawPlayer();
    drawParticles();
    drawPopups();
    ctx.restore();
  }

  function loop(ts) {
    if (state !== "playing") return;
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    dt = Math.min(dt, 0.05);
    lastTs = ts;

    update(dt);
    if (state === "playing") {
      draw();
      requestAnimationFrame(loop);
    }
  }

  function startGame() {
    ensureAudio();
    resetGame();
    state = "playing";
    lastTs = 0;
    startOverlay.classList.add("hidden");
    gameOverOverlay.classList.add("hidden");
    pauseOverlay.classList.add("hidden");
    highscoreForm.style.display = "flex";
    requestAnimationFrame(loop);
  }

  function endGame() {
    state = "over";
    draw();
    const finalScore = Math.floor(score);
    finalScoreEl.textContent = finalScore;
    if (finalScore > personalBest) {
      personalBest = finalScore;
      localStorage.setItem("neonRushBest", String(personalBest));
      bestVal.textContent = personalBest;
      personalBestLine.textContent = "Neuer persönlicher Rekord!";
    } else {
      personalBestLine.textContent = "Persönlicher Rekord: " + personalBest;
    }
    gameOverOverlay.classList.remove("hidden");
    initialsInput.value = "";
    initialsInput.focus();
  }

  function pauseGame() {
    if (state !== "playing") return;
    state = "paused";
    pauseOverlay.classList.remove("hidden");
  }

  function resumeGame() {
    if (state !== "paused") return;
    state = "playing";
    pauseOverlay.classList.add("hidden");
    lastTs = 0;
    requestAnimationFrame(loop);
  }

  function jump() {
    if (state !== "playing" || player.ducking) return;
    if (player.grounded) {
      player.vy = JUMP_VELOCITY;
      player.grounded = false;
      player.jumpsUsed = 1;
      playSfx("jump");
    } else if (player.jumpsUsed < 2) {
      player.vy = DOUBLE_JUMP_VELOCITY;
      player.jumpsUsed = 2;
      spawnParticles(PLAYER_X + PLAYER_W_STAND / 2, player.y + PLAYER_H_STAND, "#00f6ff");
      playSfx("doublejump");
    }
  }

  document.getElementById("startBtn").addEventListener("click", startGame);
  document.getElementById("restartBtn").addEventListener("click", startGame);
  document.getElementById("resumeBtn").addEventListener("click", resumeGame);

  submitScoreBtn.addEventListener("click", function () {
    const name = (initialsInput.value || "???").trim().toUpperCase().slice(0, 3) || "???";
    submitScore(name, Math.floor(score));
    highscoreForm.style.display = "none";
  });

  window.addEventListener("keydown", function (e) {
    if (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
      e.preventDefault();
      jump();
    }
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      keys.duck = true;
    }
    if (e.key === "Escape") {
      if (state === "playing") pauseGame();
      else if (state === "paused") resumeGame();
    }
  });
  window.addEventListener("keyup", function (e) {
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      keys.duck = false;
    }
  });

  // Pointer/Touch: kurzes Tippen = Springen, Halten = Ducken
  const TAP_THRESHOLD = 160;
  let pointerActive = false;
  let pointerDownAt = 0;
  let holdTimer = null;

  canvas.addEventListener("pointerdown", function (e) {
    if (state !== "playing") return;
    if (e.cancelable) e.preventDefault();
    pointerActive = true;
    pointerDownAt = performance.now();
    clearTimeout(holdTimer);
    holdTimer = setTimeout(function () {
      if (pointerActive) keys.duck = true;
    }, TAP_THRESHOLD);
  });

  function pointerEnd() {
    clearTimeout(holdTimer);
    if (pointerActive) {
      const held = performance.now() - pointerDownAt;
      if (held < TAP_THRESHOLD) jump();
    }
    pointerActive = false;
    keys.duck = false;
  }
  window.addEventListener("pointerup", pointerEnd);
  window.addEventListener("pointercancel", pointerEnd);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pauseGame();
  });

  resetGame();
  draw();
  tryInitFirebase();
  initLeaderboard();
})();
