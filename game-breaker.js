/* ============================================================
   NEON BREAKER — Arkanoid/Breakout
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 640;
  const PADDLE_Y = H - 46;
  const PADDLE_H = 14;
  const PADDLE_W_BASE = 90;
  const PADDLE_SPEED = 520;
  const BALL_R = 7;
  const BASE_BALL_SPEED = 300;
  const ROWS = 6, COLS = 8;
  const BRICK_MARGIN = 10, BRICK_GAP = 5, BRICK_TOP = 66, BRICK_H = 20;
  const BRICK_W = (W - BRICK_MARGIN * 2 - BRICK_GAP * (COLS - 1)) / COLS;
  const ROW_COLORS = ["#ff2bd6", "#ff7a1a", "#fff500", "#39ff88", "#00f6ff", "#7c3aed"];

  let paddle, balls, bricks, powerups, particles, popups;
  let score = 0, level = 1, lives = 3, elapsed = 0;
  let wideTime = 0;
  let shakeT = 0;
  let moveDir = 0;
  let dragTargetX = null;
  let launched = false;

  function paddleW() { return wideTime > 0 ? PADDLE_W_BASE * 1.6 : PADDLE_W_BASE; }

  function buildBricks() {
    bricks = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const toughChance = Math.min(0.15 + level * 0.05, 0.5);
        const hp = r < 2 && Math.random() < toughChance + 0.2 ? 2 : (Math.random() < toughChance ? 2 : 1);
        bricks.push({
          x: BRICK_MARGIN + c * (BRICK_W + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          w: BRICK_W, h: BRICK_H, hp: hp, maxHp: hp, row: r
        });
      }
    }
  }

  function newBall(vx, vy) {
    const speed = BASE_BALL_SPEED + (level - 1) * 28;
    return { x: W / 2, y: PADDLE_Y - BALL_R - 2, vx: vx != null ? vx : 0, vy: vy != null ? vy : -speed, speed: speed };
  }

  function onStart() {
    paddle = { x: W / 2 - PADDLE_W_BASE / 2 };
    balls = [newBall(0, 0)];
    powerups = []; particles = []; popups = [];
    score = 0; level = 1; lives = 3; elapsed = 0;
    wideTime = 0; shakeT = 0; moveDir = 0; dragTargetX = null; launched = false;
    buildBricks();
    Arcade.setHud("score", 0);
    Arcade.setHud("level", 1);
    Arcade.setHud("lives", "❤❤❤");
  }

  function livesDisplay() { return "❤".repeat(Math.max(lives, 0)) + "♡".repeat(Math.max(3 - lives, 0)); }

  function launchBall() {
    if (launched) return;
    launched = true;
    const speed = BASE_BALL_SPEED + (level - 1) * 28;
    const ang = -Math.PI / 2 + (Math.random() * 0.5 - 0.25);
    balls[0].vx = Math.cos(ang) * speed;
    balls[0].vy = Math.sin(ang) * speed;
    balls[0].speed = speed;
  }

  function spawnParticles(x, y, color, n) {
    for (let i = 0; i < (n || 16); i++) {
      const ang = Math.random() * Math.PI * 2, spd = 60 + Math.random() * 200;
      particles.push({ x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0.4 + Math.random() * 0.3, maxLife: 0.7, color: color });
    }
  }
  function spawnPopup(x, y, text, color) { popups.push({ x: x, y: y, text: text, color: color, life: 0.6, maxLife: 0.6 }); }
  function spawnPowerup(x, y) {
    const kind = Math.random() < 0.5 ? "wide" : "multi";
    powerups.push({ kind: kind, x: x, y: y, r: 10, t: 0 });
  }

  function onUpdate(dt) {
    elapsed += dt;

    if (dragTargetX != null) {
      paddle.x = Arcade.clamp(dragTargetX - paddleW() / 2, 6, W - paddleW() - 6);
    } else {
      paddle.x += moveDir * PADDLE_SPEED * dt;
      paddle.x = Arcade.clamp(paddle.x, 6, W - paddleW() - 6);
    }

    if (wideTime > 0) { wideTime -= dt; }

    if (!launched) {
      balls[0].x = paddle.x + paddleW() / 2;
      balls[0].y = PADDLE_Y - BALL_R - 2;
    }

    for (let bi = balls.length - 1; bi >= 0; bi--) {
      const b = balls[bi];
      if (!launched) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x - BALL_R < 0) { b.x = BALL_R; b.vx *= -1; }
      if (b.x + BALL_R > W) { b.x = W - BALL_R; b.vx *= -1; }
      if (b.y - BALL_R < 0) { b.y = BALL_R; b.vy *= -1; }

      const pw = paddleW();
      if (b.vy > 0 && Arcade.rectsOverlap(b.x - BALL_R, b.y - BALL_R, BALL_R * 2, BALL_R * 2, paddle.x, PADDLE_Y, pw, PADDLE_H)) {
        const hit = (b.x - (paddle.x + pw / 2)) / (pw / 2);
        const ang = -Math.PI / 2 + hit * (Math.PI / 3);
        b.vx = Math.cos(ang) * b.speed;
        b.vy = Math.sin(ang) * b.speed;
        b.y = PADDLE_Y - BALL_R - 1;
        Arcade.beep(300, 500, 0.06, "square", 0.08);
      }

      for (let i = bricks.length - 1; i >= 0; i--) {
        const br = bricks[i];
        if (!Arcade.rectsOverlap(b.x - BALL_R, b.y - BALL_R, BALL_R * 2, BALL_R * 2, br.x, br.y, br.w, br.h)) continue;
        const overlapX = Math.min(b.x + BALL_R - br.x, br.x + br.w - (b.x - BALL_R));
        const overlapY = Math.min(b.y + BALL_R - br.y, br.y + br.h - (b.y - BALL_R));
        if (overlapX < overlapY) b.vx *= -1; else b.vy *= -1;
        br.hp -= 1;
        spawnParticles(br.x + br.w / 2, br.y + br.h / 2, ROW_COLORS[br.row % ROW_COLORS.length], 8);
        Arcade.beep(500, 260, 0.08, "triangle", 0.1);
        if (br.hp <= 0) {
          const pts = br.maxHp * 12;
          score += pts;
          Arcade.setHud("score", Math.floor(score));
          spawnPopup(br.x + br.w / 2, br.y + br.h / 2, "+" + pts, "#fff500");
          if (Math.random() < 0.12) spawnPowerup(br.x + br.w / 2, br.y + br.h / 2);
          bricks.splice(i, 1);
        }
        break;
      }

      if (b.y - BALL_R > H) {
        balls.splice(bi, 1);
      }
    }

    if (launched && balls.length === 0) {
      lives -= 1;
      Arcade.setHud("lives", livesDisplay());
      if (lives <= 0) { crash(); return; }
      shakeT = 0.25;
      balls = [newBall(0, 0)];
      launched = false;
    }

    if (bricks.length === 0) {
      level += 1;
      Arcade.setHud("level", level);
      spawnPopup(W / 2, H / 2, "LEVEL " + level, "#00f6ff");
      buildBricks();
      balls = [newBall(0, 0)];
      launched = false;
      wideTime = 0;
    }

    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += 120 * dt; p.t += dt * 3;
      const pw = paddleW();
      if (Arcade.circlesOverlap(paddle.x + pw / 2, PADDLE_Y + PADDLE_H / 2, pw / 2, p.x, p.y, p.r)) {
        if (p.kind === "wide") { wideTime = 9; spawnPopup(p.x, p.y, "BREIT", "#00f6ff"); }
        else {
          const src = balls[0] || newBall();
          balls.push(newBall(-src.speed * 0.6, -src.speed * 0.8));
          balls.push(newBall(src.speed * 0.6, -src.speed * 0.8));
          spawnPopup(p.x, p.y, "MULTI-BALL", "#ff2bd6");
        }
        Arcade.beep(220, 1100, 0.28, "sawtooth", 0.1);
        spawnParticles(p.x, p.y, "#39ff88");
        powerups.splice(i, 1);
        continue;
      }
      if (p.y > H + 10) powerups.splice(i, 1);
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
    shakeT = 0.35;
    Arcade.beep(300, 40, 0.4, "sawtooth", 0.18);
    Arcade.endRun(score);
  }

  function onDraw(ctx, w, h) {
    ctx.save();
    if (shakeT > 0) ctx.translate((Math.random() - 0.5) * 8 * (shakeT / 0.35), (Math.random() - 0.5) * 8 * (shakeT / 0.35));
    ctx.clearRect(-20, -20, w + 40, h + 40);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0c0620"); bg.addColorStop(1, "#05030f");
    ctx.fillStyle = bg; ctx.fillRect(-20, -20, w + 40, h + 40);

    bricks.forEach(function (br) {
      const color = ROW_COLORS[br.row % ROW_COLORS.length];
      ctx.save();
      ctx.shadowColor = color; ctx.shadowBlur = br.hp > 1 ? 18 : 10;
      ctx.fillStyle = color; ctx.globalAlpha = br.hp > 1 ? 1 : 0.75;
      ctx.fillRect(br.x, br.y, br.w, br.h);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1;
      ctx.strokeRect(br.x, br.y, br.w, br.h);
      ctx.restore();
    });

    powerups.forEach(function (p) {
      const color = p.kind === "wide" ? "#00f6ff" : "#ff2bd6";
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.t);
      ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2, px = Math.cos(ang) * p.r, pyy = Math.sin(ang) * p.r;
        if (i === 0) ctx.moveTo(px, pyy); else ctx.lineTo(px, pyy);
      }
      ctx.closePath(); ctx.stroke();
      ctx.restore();
    });

    const pw = paddleW();
    ctx.save();
    ctx.shadowColor = "#00f6ff"; ctx.shadowBlur = 16; ctx.fillStyle = "#00f6ff";
    ctx.fillRect(paddle.x, PADDLE_Y, pw, PADDLE_H);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.strokeRect(paddle.x, PADDLE_Y, pw, PADDLE_H);
    ctx.restore();

    balls.forEach(function (b) {
      ctx.save();
      ctx.shadowColor = "#fff500"; ctx.shadowBlur = 14; ctx.fillStyle = "#fff500";
      ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    });
    ctx.save();
    ctx.font = "600 14px 'Orbitron', sans-serif"; ctx.textAlign = "center";
    popups.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    });
    ctx.restore(); ctx.globalAlpha = 1;

    if (!launched) {
      ctx.save();
      ctx.font = "500 12px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
      ctx.fillStyle = "rgba(232,230,255,0.7)";
      ctx.fillText("Leertaste / Klicken zum Start", W / 2, PADDLE_Y - 40);
      ctx.restore();
    }
    ctx.restore();
  }

  function onKeyDown(e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { moveDir = -1; dragTargetX = null; }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { moveDir = 1; dragTargetX = null; }
    if (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W") { e.preventDefault(); launchBall(); }
  }
  function onKeyUp(e) {
    if ((e.key === "ArrowLeft" || e.key === "a" || e.key === "A") && moveDir === -1) moveDir = 0;
    if ((e.key === "ArrowRight" || e.key === "d" || e.key === "D") && moveDir === 1) moveDir = 0;
  }
  function pointerToX(clientX) {
    const rect = Arcade.canvas.getBoundingClientRect();
    return (clientX - rect.left) * (W / rect.width);
  }
  function onPointerDown(e) {
    if (e.cancelable) e.preventDefault();
    dragTargetX = pointerToX(e.clientX);
    launchBall();
  }
  function onPointerMove(e) { if (dragTargetX != null) dragTargetX = pointerToX(e.clientX); }
  function onPointerUp() { dragTargetX = null; }

  Arcade.registerGame({
    id: "breaker",
    name: "Neon Breaker",
    tagline: "Arkanoid mit Paddle & Ball",
    accent: "#39ff88",
    canvasW: W,
    canvasH: H,
    description: "Zerstöre alle Blöcke, ohne den Ball fallen zu lassen. 3 Bälle, dann ist Schluss.<br>Cyan-Kapseln machen das Paddle breiter, magenta Kapseln teilen den Ball. Nach jedem Level wird es schneller.",
    controlsHint: "Bewegen: ← → / A D / Ziehen · Start: ␣ / Klicken",
    startLabel: "Level 1 starten",
    hud: [{ id: "score", label: "Score" }, { id: "best", label: "Best" }, { id: "level", label: "Level" }, { id: "lives", label: "Leben" }],
    onStart: onStart,
    onUpdate: onUpdate,
    onDraw: onDraw,
    onKeyDown: onKeyDown,
    onKeyUp: onKeyUp,
    onPointerDown: onPointerDown,
    onPointerMove: onPointerMove,
    onPointerUp: onPointerUp
  });
})();
