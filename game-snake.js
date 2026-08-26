/* ============================================================
   NEON SNAKE — klassisches Snake im Neon-Look
   ============================================================ */
(function () {
  "use strict";

  const CELL = 24, COLS = 20, ROWS = 20;
  const W = CELL * COLS, H = CELL * ROWS;
  const START_INTERVAL = 0.14, MIN_INTERVAL = 0.062;

  let snake, dir, nextDir, food, bonus, bonusTimer, bonusSpawnTimer, particles, popups;
  let score = 0, moveTimer = 0, interval = START_INTERVAL;
  let shakeT = 0;
  let swipeStart = null;

  function onStart() {
    snake = [];
    const cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2);
    for (let i = 0; i < 4; i++) snake.push({ x: cx - i, y: cy });
    dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 };
    particles = []; popups = [];
    score = 0; moveTimer = 0; interval = START_INTERVAL; shakeT = 0;
    bonus = null; bonusTimer = 0; bonusSpawnTimer = 9 + Math.random() * 6;
    food = spawnFood();
    Arcade.setHud("score", 0);
    Arcade.setHud("length", snake.length);
  }

  function occupied(x, y, extra) {
    for (let i = 0; i < snake.length; i++) if (snake[i].x === x && snake[i].y === y) return true;
    if (extra && extra.x === x && extra.y === y) return true;
    return false;
  }

  function spawnFood() {
    let x, y, tries = 0;
    do { x = Math.floor(Math.random() * COLS); y = Math.floor(Math.random() * ROWS); tries++; }
    while (occupied(x, y) && tries < 200);
    return { x: x, y: y };
  }

  function spawnBonus() {
    let x, y, tries = 0;
    do { x = Math.floor(Math.random() * COLS); y = Math.floor(Math.random() * ROWS); tries++; }
    while ((occupied(x, y) || (food && food.x === x && food.y === y)) && tries < 200);
    bonus = { x: x, y: y };
    bonusTimer = 6;
  }

  function spawnParticles(x, y, color, n) {
    for (let i = 0; i < (n || 16); i++) {
      const ang = Math.random() * Math.PI * 2, spd = 60 + Math.random() * 180;
      particles.push({ x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0.4 + Math.random() * 0.3, maxLife: 0.7, color: color });
    }
  }
  function spawnPopup(x, y, text, color) { popups.push({ x: x, y: y, text: text, color: color, life: 0.6, maxLife: 0.6 }); }

  function onUpdate(dt) {
    moveTimer -= dt;
    if (bonus) {
      bonusTimer -= dt;
      if (bonusTimer <= 0) bonus = null;
    }
    bonusSpawnTimer -= dt;
    if (!bonus && bonusSpawnTimer <= 0) { spawnBonus(); bonusSpawnTimer = 14 + Math.random() * 8; }

    if (moveTimer <= 0) {
      moveTimer = interval;
      dir = nextDir;
      const head = snake[0];
      const nx = head.x + dir.x, ny = head.y + dir.y;

      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) { crash(); return; }
      for (let i = 0; i < snake.length; i++) {
        if (snake[i].x === nx && snake[i].y === ny) { crash(); return; }
      }

      snake.unshift({ x: nx, y: ny });

      let grew = false;
      if (food && nx === food.x && ny === food.y) {
        score += 10;
        spawnPopup(nx * CELL + CELL / 2, ny * CELL + CELL / 2, "+10", "#fff500");
        spawnParticles(nx * CELL + CELL / 2, ny * CELL + CELL / 2, "#fff500", 14);
        Arcade.beep(680, 1080, 0.08, "triangle", 0.12);
        food = spawnFood();
        grew = true;
      }
      if (bonus && nx === bonus.x && ny === bonus.y) {
        score += 50;
        spawnPopup(nx * CELL + CELL / 2, ny * CELL + CELL / 2, "+50", "#ff2bd6");
        spawnParticles(nx * CELL + CELL / 2, ny * CELL + CELL / 2, "#ff2bd6", 22);
        Arcade.beep(220, 1100, 0.28, "sawtooth", 0.1);
        bonus = null;
        grew = true;
      }
      if (!grew) snake.pop();

      interval = Math.max(MIN_INTERVAL, START_INTERVAL - snake.length * 0.0028);
      Arcade.setHud("score", Math.floor(score));
      Arcade.setHud("length", snake.length);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.life -= dt; p.y -= 25 * dt;
      if (p.life <= 0) popups.splice(i, 1);
    }
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
  }

  function crash() {
    const head = snake[0];
    spawnParticles(head.x * CELL + CELL / 2, head.y * CELL + CELL / 2, "#ff2bd6", 26);
    shakeT = 0.3;
    Arcade.beep(300, 40, 0.4, "sawtooth", 0.18);
    Arcade.endRun(score);
  }

  function roundCell(ctx, gx, gy, pad, color, glow) {
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = glow || 10;
    ctx.fillStyle = color;
    const r = 5;
    const x = gx * CELL + pad, y = gy * CELL + pad, s = CELL - pad * 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + s, y, x + s, y + s, r);
    ctx.arcTo(x + s, y + s, x, y + s, r);
    ctx.arcTo(x, y + s, x, y, r);
    ctx.arcTo(x, y, x + s, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function onDraw(ctx, w, h) {
    ctx.save();
    if (shakeT > 0) ctx.translate((Math.random() - 0.5) * 8 * (shakeT / 0.3), (Math.random() - 0.5) * 8 * (shakeT / 0.3));
    ctx.clearRect(-20, -20, w + 40, h + 40);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0c0620"); bg.addColorStop(1, "#05030f");
    ctx.fillStyle = bg; ctx.fillRect(-20, -20, w + 40, h + 40);

    ctx.strokeStyle = "rgba(0,246,255,0.06)"; ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, h); ctx.stroke(); }
    for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(w, y * CELL); ctx.stroke(); }

    if (food) roundCell(ctx, food.x, food.y, 5, "#fff500", 14);
    if (bonus) {
      const pulse = bonusTimer < 2 ? Math.abs(Math.sin(bonusTimer * 10)) : 1;
      ctx.globalAlpha = 0.5 + pulse * 0.5;
      roundCell(ctx, bonus.x, bonus.y, 3, "#ff2bd6", 20);
      ctx.globalAlpha = 1;
    }

    snake.forEach(function (seg, i) {
      const t = i / snake.length;
      const color = i === 0 ? "#00f6ff" : "rgba(0,246,255," + (0.95 - t * 0.55).toFixed(2) + ")";
      roundCell(ctx, seg.x, seg.y, 2, color, i === 0 ? 16 : 6);
    });

    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    });
    ctx.save();
    ctx.font = "600 13px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
    popups.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    });
    ctx.restore(); ctx.globalAlpha = 1;
    ctx.restore();
  }

  function setDir(x, y) {
    if (snake.length > 1 && dir.x === -x && dir.y === -y) return;
    nextDir = { x: x, y: y };
  }

  function onKeyDown(e) {
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") { e.preventDefault(); setDir(0, -1); }
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") { e.preventDefault(); setDir(0, 1); }
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { e.preventDefault(); setDir(-1, 0); }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { e.preventDefault(); setDir(1, 0); }
  }

  function onPointerDown(e) {
    if (e.cancelable) e.preventDefault();
    swipeStart = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e) {
    if (!swipeStart) return;
    const dx = e.clientX - swipeStart.x, dy = e.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
    else setDir(0, dy > 0 ? 1 : -1);
  }

  Arcade.registerGame({
    id: "snake",
    name: "Neon Snake",
    tagline: "Fressen, wachsen, nicht crashen",
    accent: "#00f6ff",
    canvasW: W,
    canvasH: H,
    description: "Sammle die gelben Orbs und wachse. Wände und der eigene Schwanz sind tödlich.<br>Magenta Bonus-Orbs geben mehr Punkte, verschwinden aber wieder.",
    controlsHint: "Richtung: Pfeiltasten / WASD · oder Wischen mit dem Finger",
    startLabel: "Los geht's",
    hud: [{ id: "score", label: "Score" }, { id: "best", label: "Best" }, { id: "length", label: "Länge" }],
    onStart: onStart,
    onUpdate: onUpdate,
    onDraw: onDraw,
    onKeyDown: onKeyDown,
    onPointerDown: onPointerDown,
    onPointerUp: onPointerUp
  });
})();
