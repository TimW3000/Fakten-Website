(function () {
  "use strict";

  /* ============================================================
     FIREBASE
     Selbe Realtime-Database, die schon fürs Kuriositäten-Kabinett
     lief. Der Highscore landet in einem eigenen Zweig "leaderboard",
     damit die alten Fakten-Daten unangetastet bleiben.
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
      setDbStatus("Archiv nicht erreichbar — nur lokaler Highscore.");
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
     GAME
     ============================================================ */
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const scoreVal = document.getElementById("scoreVal");
  const livesVal = document.getElementById("livesVal");
  const comboVal = document.getElementById("comboVal");
  const startOverlay = document.getElementById("startOverlay");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const pauseOverlay = document.getElementById("pauseOverlay");
  const finalScoreEl = document.getElementById("finalScore");
  const personalBestLine = document.getElementById("personalBestLine");
  const initialsInput = document.getElementById("initials");
  const submitScoreBtn = document.getElementById("submitScoreBtn");
  const highscoreForm = document.getElementById("highscoreForm");

  const PLAYER_W = 76;
  const PLAYER_H = 20;
  const PLAYER_Y = H - 46;
  const PLAYER_SPEED = 7;

  const GOOD_COLOR_A = "#D3AC72";
  const GOOD_COLOR_B = "#8C6A2F";
  const BAD_COLOR = "#A13D34";

  let state = "idle"; // idle | playing | paused | over
  let player = { x: W / 2 - PLAYER_W / 2, vx: 0 };
  let items = [];
  let score = 0;
  let lives = 3;
  let combo = 1;
  let elapsed = 0;
  let spawnTimer = 0;
  let lastTs = 0;
  let flash = 0;
  let keys = { left: false, right: false };
  let personalBest = Number(localStorage.getItem("kabinettSammlerBest") || 0);

  function resetGame() {
    player.x = W / 2 - PLAYER_W / 2;
    player.vx = 0;
    items = [];
    score = 0;
    lives = 3;
    combo = 1;
    elapsed = 0;
    spawnTimer = 0;
    flash = 0;
    updateHud();
  }

  function updateHud() {
    scoreVal.textContent = score;
    comboVal.textContent = "x" + combo;
    livesVal.textContent = "❤".repeat(Math.max(lives, 0)) + "♡".repeat(Math.max(3 - lives, 0));
  }

  function spawnItem() {
    const isBad = Math.random() < 0.28;
    const r = isBad ? 15 : 13;
    const difficultyBoost = Math.min(elapsed / 45, 1.8);
    const vy = (isBad ? 130 : 110) + difficultyBoost * 90 + Math.random() * 40;
    items.push({
      x: r + Math.random() * (W - r * 2),
      y: -r,
      r: r,
      vy: vy,
      bad: isBad,
      spin: Math.random() * Math.PI * 2
    });
  }

  function update(dt) {
    elapsed += dt;

    if (keys.left) player.vx = -PLAYER_SPEED;
    else if (keys.right) player.vx = PLAYER_SPEED;
    else player.vx *= 0.7;
    player.x += player.vx * (dt * 60);
    player.x = Math.max(0, Math.min(W - PLAYER_W, player.x));

    const spawnInterval = Math.max(0.9 - elapsed * 0.01, 0.32);
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnItem();
      spawnTimer = spawnInterval;
    }

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy * dt;
      it.spin += dt * 2;

      const caughtX = it.x + it.r > player.x && it.x - it.r < player.x + PLAYER_W;
      const caughtY = it.y + it.r > PLAYER_Y && it.y - it.r < PLAYER_Y + PLAYER_H;

      if (caughtX && caughtY) {
        items.splice(i, 1);
        if (it.bad) {
          lives -= 1;
          combo = 1;
          flash = 0.25;
          if (lives <= 0) {
            endGame();
            return;
          }
        } else {
          score += 10 * combo;
          combo += 1;
        }
        updateHud();
        continue;
      }

      if (it.y - it.r > H) {
        items.splice(i, 1);
        if (!it.bad) {
          combo = 1;
          updateHud();
        }
      }
    }

    if (flash > 0) flash = Math.max(0, flash - dt);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 40; i++) {
      const gx = (i * 97) % W;
      const gy = (i * 53 + (elapsed * 10)) % H;
      ctx.fillStyle = "rgba(184,147,91,0.08)";
      ctx.fillRect(gx, gy, 1, 1);
    }
    ctx.restore();

    items.forEach(function (it) {
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.spin);
      if (it.bad) {
        ctx.fillStyle = BAD_COLOR;
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const ang = (s / 6) * Math.PI * 2;
          const rr = s % 2 === 0 ? it.r : it.r * 0.55;
          const px = Math.cos(ang) * rr;
          const py = Math.sin(ang) * rr;
          if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        const grad = ctx.createRadialGradient(-it.r * 0.3, -it.r * 0.3, 1, 0, 0, it.r);
        grad.addColorStop(0, GOOD_COLOR_A);
        grad.addColorStop(1, GOOD_COLOR_B);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, it.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(237,228,211,0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    });

    ctx.save();
    ctx.fillStyle = "#D3AC72";
    ctx.strokeStyle = "#7C2C26";
    ctx.lineWidth = 2;
    roundRect(ctx, player.x, PLAYER_Y, PLAYER_W, PLAYER_H, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(20,35,28,0.25)";
    roundRect(ctx, player.x + 6, PLAYER_Y + 5, PLAYER_W - 12, 4, 2);
    ctx.fill();
    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = "rgba(161,61,52," + (flash * 1.6).toFixed(2) + ")";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
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
    finalScoreEl.textContent = score;
    if (score > personalBest) {
      personalBest = score;
      localStorage.setItem("kabinettSammlerBest", String(personalBest));
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

  document.getElementById("startBtn").addEventListener("click", startGame);
  document.getElementById("restartBtn").addEventListener("click", startGame);
  document.getElementById("resumeBtn").addEventListener("click", resumeGame);

  submitScoreBtn.addEventListener("click", function () {
    const name = (initialsInput.value || "???").trim().toUpperCase().slice(0, 3) || "???";
    submitScore(name, score);
    highscoreForm.style.display = "none";
  });

  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = true;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = true;
    if (e.key === "Escape") {
      if (state === "playing") pauseGame();
      else if (state === "paused") resumeGame();
    }
  });
  window.addEventListener("keyup", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = false;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = false;
  });

  function pointerToPlayerX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const scale = W / rect.width;
    return (clientX - rect.left) * scale - PLAYER_W / 2;
  }

  canvas.addEventListener("mousemove", function (e) {
    if (state !== "playing") return;
    player.x = Math.max(0, Math.min(W - PLAYER_W, pointerToPlayerX(e.clientX)));
    player.vx = 0;
  });

  canvas.addEventListener("touchmove", function (e) {
    if (state !== "playing") return;
    e.preventDefault();
    const t = e.touches[0];
    player.x = Math.max(0, Math.min(W - PLAYER_W, pointerToPlayerX(t.clientX)));
    player.vx = 0;
  }, { passive: false });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pauseGame();
  });

  draw();
  tryInitFirebase();
  initLeaderboard();
})();
