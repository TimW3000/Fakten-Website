/* ============================================================
   NEON DUELL — lokales 1-gegen-1 an einer Tastatur
   ============================================================ */
(function () {
  "use strict";

  const W = 560, H = 360;
  const PADDLE_W = 12, PADDLE_H = 74;
  const P1_X = 22, P2_X = W - 22 - PADDLE_W;
  const PLAYER_SPEED = 420;
  const BASE_BALL_SPEED = 280;
  const MAX_BALL_SPEED = 640;
  const WIN_SCORE = 5;
  const WALL_W = 14, WALL_H = 100;

  let p1, p2, balls, particles, popups;
  let pickups, pickupSpawnTimer, growTime;
  let wall, wallActive, wallTimer, wallSpawnTimer;
  let pointsP1 = 0, pointsP2 = 0, rallyHits = 0;
  let matchOver = false, winnerText = "";
  let shakeT = 0;
  let p1Dir = 0, p2Dir = 0;

  function paddleH() { return growTime > 0 ? PADDLE_H * 1.5 : PADDLE_H; }

  function serveBall(towardP1) {
    const speed = BASE_BALL_SPEED;
    const ang = (Math.random() * 0.6 - 0.3);
    const dirX = towardP1 ? -1 : 1;
    return { x: W / 2, y: H / 2, vx: Math.cos(ang) * speed * dirX, vy: Math.sin(ang) * speed, speed: speed };
  }

  function onStart() {
    p1 = { y: H / 2 - PADDLE_H / 2 };
    p2 = { y: H / 2 - PADDLE_H / 2 };
    balls = [serveBall(Math.random() < 0.5)];
    particles = []; popups = [];
    pickups = []; pickupSpawnTimer = 9 + Math.random() * 5; growTime = 0;
    wallActive = false; wall = null; wallTimer = 0; wallSpawnTimer = 15 + Math.random() * 6;
    pointsP1 = 0; pointsP2 = 0; rallyHits = 0;
    matchOver = false; winnerText = "";
    shakeT = 0; p1Dir = 0; p2Dir = 0;
    Arcade.setHud("p1", 0);
    Arcade.setHud("p2", 0);
    Arcade.setHud("rally", 0);
  }

  function spawnPickup() {
    const kind = Math.random() < 0.5 ? "grow" : "multi";
    const x = W * 0.32 + Math.random() * W * 0.36;
    const y = 40 + Math.random() * (H - 80);
    pickups.push({ kind: kind, x: x, y: y, r: 11, t: 0 });
  }
  function spawnWall() {
    wallActive = true;
    wall = { x: W / 2 - WALL_W / 2, y: 30 + Math.random() * (H - 60 - WALL_H) };
    wallTimer = 6;
  }

  function spawnParticles(x, y, color, n) {
    for (let i = 0; i < (n || 16); i++) {
      const ang = Math.random() * Math.PI * 2, spd = 60 + Math.random() * 200;
      particles.push({ x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0.4 + Math.random() * 0.3, maxLife: 0.7, color: color });
    }
  }
  function spawnPopup(x, y, text, color) { popups.push({ x: x, y: y, text: text, color: color, life: 0.6, maxLife: 0.6 }); }

  function onUpdate(dt) {
    if (matchOver) return;

    if (growTime > 0) growTime -= dt;
    const pH = paddleH();

    p1.y += p1Dir * PLAYER_SPEED * dt;
    p1.y = Arcade.clamp(p1.y, 4, H - pH - 4);
    p2.y += p2Dir * PLAYER_SPEED * dt;
    p2.y = Arcade.clamp(p2.y, 4, H - pH - 4);

    pickupSpawnTimer -= dt;
    if (pickups.length === 0 && pickupSpawnTimer <= 0) { spawnPickup(); pickupSpawnTimer = 16 + Math.random() * 7; }
    pickups.forEach(function (p) { p.t += dt * 3; });

    if (wallActive) {
      wallTimer -= dt;
      if (wallTimer <= 0) { wallActive = false; wall = null; wallSpawnTimer = 13 + Math.random() * 7; }
    } else {
      wallSpawnTimer -= dt;
      if (wallSpawnTimer <= 0) spawnWall();
    }

    for (let bi = balls.length - 1; bi >= 0; bi--) {
      const ball = balls[bi];
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.y - 8 < 0) { ball.y = 8; ball.vy *= -1; }
      if (ball.y + 8 > H) { ball.y = H - 8; ball.vy *= -1; }

      if (wallActive && Arcade.rectsOverlap(ball.x - 8, ball.y - 8, 16, 16, wall.x, wall.y, WALL_W, WALL_H)) {
        const overlapX = Math.min(ball.x + 8 - wall.x, wall.x + WALL_W - (ball.x - 8));
        const overlapY = Math.min(ball.y + 8 - wall.y, wall.y + WALL_H - (ball.y - 8));
        if (overlapX < overlapY) { ball.vx *= -1; ball.x += ball.vx > 0 ? 6 : -6; }
        else { ball.vy *= -1; ball.y += ball.vy > 0 ? 6 : -6; }
        spawnParticles(ball.x, ball.y, Arcade.theme().hazardA, 6);
        Arcade.beep(260, 180, 0.06, "square", 0.07);
      }

      if (ball.vx < 0 && Arcade.rectsOverlap(ball.x - 8, ball.y - 8, 16, 16, P1_X, p1.y, PADDLE_W, pH)) {
        const hit = (ball.y - (p1.y + pH / 2)) / (pH / 2);
        ball.speed = Math.min(MAX_BALL_SPEED, ball.speed + 24);
        const ang = hit * (Math.PI / 3);
        ball.vx = Math.cos(ang) * ball.speed;
        ball.vy = Math.sin(ang) * ball.speed;
        ball.x = P1_X + PADDLE_W + 9;
        rallyHits++;
        Arcade.setHud("rally", rallyHits);
        spawnParticles(ball.x, ball.y, Arcade.theme().player, 8);
        Arcade.beep(300, 520, 0.06, "square", 0.09);
      }
      if (ball.vx > 0 && Arcade.rectsOverlap(ball.x - 8, ball.y - 8, 16, 16, P2_X, p2.y, PADDLE_W, pH)) {
        const hit = (ball.y - (p2.y + pH / 2)) / (pH / 2);
        ball.speed = Math.min(MAX_BALL_SPEED, ball.speed + 24);
        const ang = hit * (Math.PI / 3);
        ball.vx = -Math.cos(ang) * ball.speed;
        ball.vy = Math.sin(ang) * ball.speed;
        ball.x = P2_X - 9;
        rallyHits++;
        Arcade.setHud("rally", rallyHits);
        spawnParticles(ball.x, ball.y, Arcade.theme().ai, 8);
        Arcade.beep(300, 520, 0.06, "square", 0.09);
      }

      for (let pi = pickups.length - 1; pi >= 0; pi--) {
        const p = pickups[pi];
        if (Arcade.circlesOverlap(ball.x, ball.y, 8, p.x, p.y, p.r)) {
          if (p.kind === "grow") {
            growTime = 9;
            spawnPopup(p.x, p.y, "BEIDE GROSS", Arcade.theme().powerupA);
          } else {
            balls.push(serveBall(Math.random() < 0.5));
            spawnPopup(p.x, p.y, "MULTI-BALL", Arcade.theme().powerupB);
          }
          spawnParticles(p.x, p.y, p.kind === "grow" ? Arcade.theme().powerupA : Arcade.theme().powerupB, 16);
          Arcade.beep(220, 1100, 0.28, "sawtooth", 0.1);
          pickups.splice(pi, 1);
        }
      }

      if (ball.x < -12) {
        pointsP2++;
        Arcade.setHud("p2", pointsP2);
        spawnPopup(W / 2, H / 2, "PUNKT SPIELER 2", Arcade.theme().ai);
        shakeT = 0.2;
        Arcade.beep(220, 90, 0.2, "sawtooth", 0.12);
        if (pointsP2 >= WIN_SCORE) { finishMatch("SPIELER 2 GEWINNT!"); return; }
        balls.splice(bi, 1);
        continue;
      }
      if (ball.x > W + 12) {
        pointsP1++;
        Arcade.setHud("p1", pointsP1);
        spawnPopup(W / 2, H / 2, "PUNKT SPIELER 1", Arcade.theme().player);
        shakeT = 0.2;
        Arcade.beep(220, 90, 0.2, "sawtooth", 0.12);
        if (pointsP1 >= WIN_SCORE) { finishMatch("SPIELER 1 GEWINNT!"); return; }
        balls.splice(bi, 1);
      }
    }
    if (balls.length === 0) balls.push(serveBall(Math.random() < 0.5));

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

  function finishMatch(text) {
    matchOver = true;
    winnerText = text;
    Arcade.beep(500, 900, 0.35, "triangle", 0.15);
    Arcade.endRun(rallyHits);
  }

  let bgGradient = null, bgGradientFor = null;
  function onDraw(ctx, w, h) {
    const th = Arcade.theme();
    const retro = Arcade.isRetro();
    ctx.save();
    if (shakeT > 0) ctx.translate((Math.random() - 0.5) * 8 * (shakeT / 0.2), (Math.random() - 0.5) * 8 * (shakeT / 0.2));
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

    if (wallActive) {
      ctx.save();
      if (!retro) { ctx.shadowColor = th.hazardA; ctx.shadowBlur = 14; }
      ctx.fillStyle = th.hazardA;
      ctx.globalAlpha = wallTimer < 1.5 ? 0.4 + 0.5 * Math.abs(Math.sin(wallTimer * 12)) : 1;
      ctx.fillRect(wall.x, wall.y, WALL_W, WALL_H);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = retro ? "rgba(0,0,0,0.3)" : "#fff"; ctx.lineWidth = 1.2;
      ctx.strokeRect(wall.x, wall.y, WALL_W, WALL_H);
      ctx.restore();
    }

    pickups.forEach(function (p) {
      const color = p.kind === "grow" ? th.powerupA : th.powerupB;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.t);
      ctx.strokeStyle = color + "4d"; ctx.lineWidth = 7;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2, px = Math.cos(ang) * p.r, pyy = Math.sin(ang) * p.r;
        if (i === 0) ctx.moveTo(px, pyy); else ctx.lineTo(px, pyy);
      }
      ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    });

    const pH = paddleH();
    ctx.save();
    if (!retro) { ctx.shadowColor = th.player; ctx.shadowBlur = 16; }
    ctx.fillStyle = th.player;
    ctx.fillRect(P1_X, p1.y, PADDLE_W, pH);
    ctx.restore();

    ctx.save();
    if (!retro) { ctx.shadowColor = th.ai; ctx.shadowBlur = 16; }
    ctx.fillStyle = th.ai;
    ctx.fillRect(P2_X, p2.y, PADDLE_W, pH);
    ctx.restore();

    balls.forEach(function (ball) {
      ctx.save();
      if (!retro) { ctx.shadowColor = th.collectible; ctx.shadowBlur = 14; }
      ctx.fillStyle = th.collectible;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    });
    ctx.save();
    ctx.font = "700 18px " + (retro ? "'Press Start 2P', monospace" : "'Orbitron', sans-serif");
    ctx.textAlign = "center";
    popups.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    });
    ctx.restore(); ctx.globalAlpha = 1;

    if (matchOver) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, h / 2 - 40, w, 80);
      ctx.font = "700 22px " + (retro ? "'Press Start 2P', monospace" : "'Orbitron', sans-serif");
      ctx.textAlign = "center";
      ctx.fillStyle = th.collectible;
      ctx.fillText(winnerText, w / 2, h / 2 + 8);
      ctx.restore();
    }
    ctx.restore();
  }

  function onKeyDown(e) {
    if (e.key === "w" || e.key === "W") { p1Dir = -1; }
    if (e.key === "s" || e.key === "S") { p1Dir = 1; }
    if (e.key === "ArrowUp") { e.preventDefault(); p2Dir = -1; }
    if (e.key === "ArrowDown") { e.preventDefault(); p2Dir = 1; }
  }
  function onKeyUp(e) {
    if ((e.key === "w" || e.key === "W") && p1Dir === -1) p1Dir = 0;
    if ((e.key === "s" || e.key === "S") && p1Dir === 1) p1Dir = 0;
    if (e.key === "ArrowUp" && p2Dir === -1) p2Dir = 0;
    if (e.key === "ArrowDown" && p2Dir === 1) p2Dir = 0;
  }

  Arcade.registerGame({
    id: "duel",
    name: "Neon Duell",
    tagline: "1 gegen 1 an einer Tastatur",
    accent: "#fff500",
    canvasW: W,
    canvasH: H,
    description: "Zwei Spieler, eine Tastatur. Spieler 1 (links) spielt mit W/S, Spieler 2 (rechts) mit den Pfeiltasten ↑/↓.<br>Wer zuerst " + WIN_SCORE + " Punkte hat, gewinnt. Grüne Kapseln vergrößern beide Paddles, magenta Kapseln bringen einen zweiten Ball ins Spiel, gelegentlich erscheint eine Wand in der Mitte. Der Highscore zählt die Ballwechsel der ganzen Partie.",
    controlsHint: "Spieler 1: W / S · Spieler 2: ↑ / ↓",
    startLabel: "Duell starten",
    hud: [{ id: "p1", label: "Spieler 1" }, { id: "p2", label: "Spieler 2" }, { id: "rally", label: "Rally" }, { id: "best", label: "Bestes Rally" }],
    onStart: onStart,
    onUpdate: onUpdate,
    onDraw: onDraw,
    onKeyDown: onKeyDown,
    onKeyUp: onKeyUp
  });
})();
