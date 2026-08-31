/* ============================================================
   NEON PONG — Paddle gegen KI, Endlos-Rallye
   ============================================================ */
(function () {
  "use strict";

  const W = 560, H = 360;
  const PADDLE_W = 12, PADDLE_H = 74;
  const PLAYER_X = 22, AI_X = W - 22 - PADDLE_W;
  const PLAYER_SPEED = 420;
  const BASE_BALL_SPEED = 280;
  const MAX_BALL_SPEED = 620;
  const BASE_AI_SPEED = 220;
  const MAX_AI_SPEED = 480;

  let player, ai, ball, particles, popups;
  let score = 0, elapsed = 0;
  let shakeT = 0;
  let moveDir = 0;
  let dragTargetY = null;

  function serveBall(towardPlayer) {
    const speed = BASE_BALL_SPEED;
    const ang = (Math.random() * 0.6 - 0.3);
    const dirX = towardPlayer ? -1 : 1;
    return { x: W / 2, y: H / 2, vx: Math.cos(ang) * speed * dirX, vy: Math.sin(ang) * speed, speed: speed };
  }

  function onStart() {
    player = { y: H / 2 - PADDLE_H / 2 };
    ai = { y: H / 2 - PADDLE_H / 2 };
    ball = serveBall(Math.random() < 0.5);
    particles = []; popups = [];
    score = 0; elapsed = 0; shakeT = 0; moveDir = 0; dragTargetY = null;
    Arcade.setHud("score", 0);
    Arcade.setHud("speed", "x1.0");
  }

  function spawnParticles(x, y, color, n) {
    for (let i = 0; i < (n || 16); i++) {
      const ang = Math.random() * Math.PI * 2, spd = 60 + Math.random() * 200;
      particles.push({ x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0.4 + Math.random() * 0.3, maxLife: 0.7, color: color });
    }
  }
  function spawnPopup(x, y, text, color) { popups.push({ x: x, y: y, text: text, color: color, life: 0.6, maxLife: 0.6 }); }

  function onUpdate(dt) {
    elapsed += dt;
    const aiSpeed = Math.min(MAX_AI_SPEED, BASE_AI_SPEED + elapsed * 5);
    Arcade.setHud("speed", "x" + (aiSpeed / BASE_AI_SPEED).toFixed(1));

    if (dragTargetY != null) {
      const dy = dragTargetY - (player.y + PADDLE_H / 2);
      player.y += Arcade.clamp(dy, -PLAYER_SPEED * dt, PLAYER_SPEED * dt);
    } else {
      player.y += moveDir * PLAYER_SPEED * dt;
    }
    player.y = Arcade.clamp(player.y, 4, H - PADDLE_H - 4);

    const aiTarget = ball.y - PADDLE_H / 2 + Math.sin(elapsed * 3) * 6;
    const aiDelta = aiTarget - ai.y;
    ai.y += Arcade.clamp(aiDelta, -aiSpeed * dt, aiSpeed * dt);
    ai.y = Arcade.clamp(ai.y, 4, H - PADDLE_H - 4);

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.y - 8 < 0) { ball.y = 8; ball.vy *= -1; }
    if (ball.y + 8 > H) { ball.y = H - 8; ball.vy *= -1; }

    if (ball.vx < 0 && Arcade.rectsOverlap(ball.x - 8, ball.y - 8, 16, 16, PLAYER_X, player.y, PADDLE_W, PADDLE_H)) {
      const hit = (ball.y - (player.y + PADDLE_H / 2)) / (PADDLE_H / 2);
      ball.speed = Math.min(MAX_BALL_SPEED, ball.speed + 22);
      const ang = hit * (Math.PI / 3);
      ball.vx = Math.cos(ang) * ball.speed;
      ball.vy = Math.sin(ang) * ball.speed;
      ball.x = PLAYER_X + PADDLE_W + 9;
      spawnParticles(ball.x, ball.y, Arcade.theme().player, 8);
      Arcade.beep(300, 520, 0.06, "square", 0.09);
    }
    if (ball.vx > 0 && Arcade.rectsOverlap(ball.x - 8, ball.y - 8, 16, 16, AI_X, ai.y, PADDLE_W, PADDLE_H)) {
      const hit = (ball.y - (ai.y + PADDLE_H / 2)) / (PADDLE_H / 2);
      ball.speed = Math.min(MAX_BALL_SPEED, ball.speed + 22);
      const ang = hit * (Math.PI / 3);
      ball.vx = -Math.cos(ang) * ball.speed;
      ball.vy = Math.sin(ang) * ball.speed;
      ball.x = AI_X - 9;
      spawnParticles(ball.x, ball.y, Arcade.theme().ai, 8);
      Arcade.beep(300, 520, 0.06, "square", 0.09);
    }

    if (ball.x < -12) {
      crash();
      return;
    }
    if (ball.x > W + 12) {
      score += 100;
      Arcade.setHud("score", Math.floor(score));
      spawnPopup(W / 2, H / 2, "+100", Arcade.theme().collectible);
      spawnParticles(W - 20, ball.y, Arcade.theme().collectible, 20);
      Arcade.beep(680, 1080, 0.1, "triangle", 0.13);
      ball = serveBall(false);
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
    spawnParticles(4, ball.y, Arcade.theme().hazardB, 24);
    shakeT = 0.3;
    Arcade.beep(300, 40, 0.4, "sawtooth", 0.18);
    Arcade.endRun(score);
  }

  let bgGradient = null, bgGradientFor = null;
  function onDraw(ctx, w, h) {
    const th = Arcade.theme();
    const retro = Arcade.isRetro();
    ctx.save();
    if (shakeT > 0) ctx.translate((Math.random() - 0.5) * 8 * (shakeT / 0.3), (Math.random() - 0.5) * 8 * (shakeT / 0.3));
    ctx.clearRect(-20, -20, w + 40, h + 40);
    if (!bgGradient || bgGradientFor !== th) {
      bgGradient = ctx.createLinearGradient(0, 0, 0, h);
      bgGradient.addColorStop(0, th.bgTop); bgGradient.addColorStop(1, th.bgBottom);
      bgGradientFor = th;
    }
    ctx.fillStyle = bgGradient; ctx.fillRect(-20, -20, w + 40, h + 40);

    ctx.strokeStyle = retro ? "rgba(255,255,255,0.6)" : "rgba(232,230,255,0.25)"; ctx.lineWidth = 3;
    ctx.setLineDash([14, 12]);
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
    ctx.setLineDash([]);

    ctx.save();
    if (!retro) { ctx.shadowColor = th.player; ctx.shadowBlur = 16; }
    ctx.fillStyle = th.player;
    ctx.fillRect(PLAYER_X, player.y, PADDLE_W, PADDLE_H);
    ctx.restore();

    ctx.save();
    if (!retro) { ctx.shadowColor = th.ai; ctx.shadowBlur = 16; }
    ctx.fillStyle = th.ai;
    ctx.fillRect(AI_X, ai.y, PADDLE_W, PADDLE_H);
    ctx.restore();

    ctx.save();
    if (!retro) { ctx.shadowColor = th.collectible; ctx.shadowBlur = 14; }
    ctx.fillStyle = th.collectible;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    });
    ctx.save();
    ctx.font = "700 20px 'Orbitron', sans-serif"; ctx.textAlign = "center";
    popups.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    });
    ctx.restore(); ctx.globalAlpha = 1;
    ctx.restore();
  }

  function onKeyDown(e) {
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") { moveDir = -1; dragTargetY = null; }
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") { moveDir = 1; dragTargetY = null; }
  }
  function onKeyUp(e) {
    if ((e.key === "ArrowUp" || e.key === "w" || e.key === "W") && moveDir === -1) moveDir = 0;
    if ((e.key === "ArrowDown" || e.key === "s" || e.key === "S") && moveDir === 1) moveDir = 0;
  }
  function pointerToY(clientY) {
    const rect = Arcade.canvas.getBoundingClientRect();
    return (clientY - rect.top) * (H / rect.height);
  }
  function onPointerDown(e) { if (e.cancelable) e.preventDefault(); dragTargetY = pointerToY(e.clientY); }
  function onPointerMove(e) { if (dragTargetY != null) dragTargetY = pointerToY(e.clientY); }
  function onPointerUp() { dragTargetY = null; }

  Arcade.registerGame({
    id: "pong",
    name: "Neon Pong",
    tagline: "Endlos-Rallye gegen die KI",
    accent: "#7c3aed",
    canvasW: W,
    canvasH: H,
    description: "Halte den Ball im Spiel. Jeder Punkt gegen die KI bringt +100 — die KI wird mit der Zeit schneller.<br>Verpasst du den Ball einmal, ist der Run vorbei.",
    controlsHint: "Bewegen: ↑ ↓ / W S · oder Ziehen mit Maus/Finger",
    startLabel: "Anspielen",
    hud: [{ id: "score", label: "Score" }, { id: "best", label: "Best" }, { id: "speed", label: "KI-Tempo" }],
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
