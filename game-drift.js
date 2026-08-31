/* ============================================================
   NEON DRIFT — Spurwechsel-Rennspiel, Verkehr ausweichen
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 640;
  const ROAD_W = 320;
  const ROAD_LEFT = (W - ROAD_W) / 2;
  const ROAD_RIGHT = ROAD_LEFT + ROAD_W;

  const CAR_W = 42, CAR_H = 66;
  const PLAYER_Y = H - 120;
  const STEER_ACCEL = 1800;
  const STEER_FRICTION = 0.86;
  const MAX_VX = 460;
  const BASE_SPEED = 260;
  const MAX_SPEED = 780;
  const SHIELD_DURATION = 5;

  let player, cars, boosts, shields, particles, popups, laneMarks, roadside;
  let score = 0, distance = 0, speed = BASE_SPEED, elapsed = 0;
  let spawnTimer = 0, boostTimer = 0, shieldSpawnTimer = 0, boostBonusT = 0;
  let shakeT = 0;
  let steer = 0; // -1, 0, 1 from keyboard
  let dragTargetX = null;

  function onStart() {
    player = { x: W / 2 - CAR_W / 2, vx: 0, shielded: false, shieldTime: 0, trail: [] };
    cars = []; boosts = []; shields = []; particles = []; popups = [];
    laneMarks = [];
    for (let i = 0; i < 10; i++) laneMarks.push(i * 70);
    roadside = [];
    for (let i = 0; i < 16; i++) roadside.push({ y: i * 60, side: Math.random() < 0.5 ? "l" : "r", h: 30 + Math.random() * 40 });
    score = 0; distance = 0; speed = BASE_SPEED; elapsed = 0;
    spawnTimer = 1; boostTimer = 1.8; shieldSpawnTimer = 13 + Math.random() * 5; boostBonusT = 0;
    shakeT = 0; steer = 0; dragTargetX = null;
    Arcade.setHud("score", 0);
    Arcade.setHud("speed", "x1.0");
  }

  function spawnCar() {
    const w = CAR_W + Math.random() * 8;
    const x = Arcade.clamp(ROAD_LEFT + Math.random() * (ROAD_W - w), ROAD_LEFT, ROAD_RIGHT - w);
    const hue = Math.random() < 0.5 ? "#ff2bd6" : "#ff7a1a";
    cars.push({ x: x, y: -CAR_H, w: w, h: CAR_H + Math.random() * 10, color: hue });
  }
  function spawnBoost() {
    boosts.push({ x: ROAD_LEFT + 20 + Math.random() * (ROAD_W - 40), y: -20, r: 10, t: Math.random() * Math.PI * 2 });
  }
  function spawnShield() {
    shields.push({ x: ROAD_LEFT + 20 + Math.random() * (ROAD_W - 40), y: -20, r: 12, t: Math.random() * Math.PI * 2 });
  }
  function spawnParticles(x, y, color) {
    for (let i = 0; i < 22; i++) {
      const ang = Math.random() * Math.PI * 2, spd = 80 + Math.random() * 260;
      particles.push({ x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0.5 + Math.random() * 0.4, maxLife: 0.9, color: color });
    }
  }
  function spawnPopup(x, y, text, color) { popups.push({ x: x, y: y, text: text, color: color, life: 0.7, maxLife: 0.7 }); }

  function onUpdate(dt) {
    elapsed += dt;
    const rampSpeed = Math.min(MAX_SPEED, BASE_SPEED + elapsed * 16);
    if (boostBonusT > 0) { boostBonusT -= dt; speed = Math.min(MAX_SPEED + 220, rampSpeed + 220); }
    else speed = rampSpeed;
    distance += speed * dt;
    score += (speed * dt) / 9;
    Arcade.setHud("score", Math.floor(score));
    Arcade.setHud("speed", "x" + (speed / BASE_SPEED).toFixed(1));

    if (dragTargetX != null) {
      const dx = dragTargetX - (player.x + CAR_W / 2);
      player.x += Arcade.clamp(dx, -420 * dt, 420 * dt);
    } else {
      player.vx += steer * STEER_ACCEL * dt;
      player.vx *= STEER_FRICTION;
      player.vx = Arcade.clamp(player.vx, -MAX_VX, MAX_VX);
      player.x += player.vx * dt;
    }
    player.x = Arcade.clamp(player.x, ROAD_LEFT + 4, ROAD_RIGHT - CAR_W - 4);

    if (player.shielded) {
      player.shieldTime -= dt;
      if (player.shieldTime <= 0) player.shielded = false;
    }

    player.trail.push({ x: player.x + CAR_W / 2, y: PLAYER_Y + CAR_H });
    if (player.trail.length > 8) player.trail.shift();

    for (let i = 0; i < laneMarks.length; i++) {
      laneMarks[i] += speed * dt;
      if (laneMarks[i] > H) laneMarks[i] -= 10 * 70;
    }
    roadside.forEach(function (r) {
      r.y += speed * 0.9 * dt;
      if (r.y > H) { r.y -= 16 * 60; r.side = Math.random() < 0.5 ? "l" : "r"; r.h = 30 + Math.random() * 40; }
    });

    spawnTimer -= dt;
    const spawnInterval = Math.max(1.0 - elapsed * 0.012, 0.42);
    if (spawnTimer <= 0) { spawnCar(); spawnTimer = spawnInterval + Math.random() * 0.35; }
    boostTimer -= dt;
    if (boostTimer <= 0) { spawnBoost(); boostTimer = 1.6 + Math.random() * 1.6; }
    shieldSpawnTimer -= dt;
    if (shieldSpawnTimer <= 0) { spawnShield(); shieldSpawnTimer = 16 + Math.random() * 8; }

    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      c.y += speed * dt;
      if (Arcade.rectsOverlap(player.x, PLAYER_Y, CAR_W, CAR_H, c.x, c.y, c.w, c.h)) {
        if (player.shielded) {
          spawnParticles(c.x + c.w / 2, c.y + c.h / 2, "#39ff88");
          cars.splice(i, 1);
          continue;
        }
        crash();
        return;
      }
      if (c.y > H + 10) cars.splice(i, 1);
    }

    for (let i = boosts.length - 1; i >= 0; i--) {
      const b = boosts[i];
      b.y += speed * dt; b.t += dt * 4;
      if (Arcade.circlesOverlap(player.x + CAR_W / 2, PLAYER_Y + CAR_H / 2, CAR_W / 2, b.x, b.y, b.r)) {
        score += 25;
        boostBonusT = 1.6;
        spawnPopup(b.x, b.y, "+25 BOOST", "#00f6ff");
        spawnParticles(b.x, b.y, "#00f6ff");
        Arcade.beep(680, 1080, 0.09, "triangle", 0.13);
        boosts.splice(i, 1);
        continue;
      }
      if (b.y > H + 10) boosts.splice(i, 1);
    }

    for (let i = shields.length - 1; i >= 0; i--) {
      const s = shields[i];
      s.y += speed * dt; s.t += dt * 3;
      if (Arcade.circlesOverlap(player.x + CAR_W / 2, PLAYER_Y + CAR_H / 2, CAR_W / 2, s.x, s.y, s.r)) {
        player.shielded = true; player.shieldTime = SHIELD_DURATION;
        spawnPopup(s.x, s.y, "SCHILD", "#39ff88");
        spawnParticles(s.x, s.y, "#39ff88");
        Arcade.beep(220, 1100, 0.28, "sawtooth", 0.1);
        shields.splice(i, 1);
        continue;
      }
      if (s.y > H + 10) shields.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.life -= dt; p.y -= 30 * dt;
      if (p.life <= 0) popups.splice(i, 1);
    }
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
  }

  function crash() {
    spawnParticles(player.x + CAR_W / 2, PLAYER_Y + CAR_H / 2, "#ff2bd6");
    shakeT = 0.35;
    Arcade.beep(300, 40, 0.4, "sawtooth", 0.18);
    Arcade.endRun(score);
  }

  function drawRoad(ctx) {
    ctx.fillStyle = "#0c0620";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#120a2c";
    ctx.fillRect(ROAD_LEFT, 0, ROAD_W, H);

    ctx.strokeStyle = "rgba(0,246,255,0.55)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00f6ff"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(ROAD_LEFT, 0); ctx.lineTo(ROAD_LEFT, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ROAD_RIGHT, 0); ctx.lineTo(ROAD_RIGHT, H); ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(232,230,255,0.4)";
    ctx.lineWidth = 4;
    ctx.setLineDash([26, 22]);
    laneMarks.forEach(function (y) {
      ctx.beginPath(); ctx.moveTo(W / 2, y); ctx.lineTo(W / 2, y + 26); ctx.stroke();
    });
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(124,58,237,0.35)";
    roadside.forEach(function (r) {
      const x = r.side === "l" ? ROAD_LEFT - 26 : ROAD_RIGHT + 10;
      ctx.fillRect(x, r.y, 16, r.h);
    });
  }

  function carPath(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x + w * 0.15, y);
    ctx.lineTo(x + w * 0.85, y);
    ctx.lineTo(x + w, y + h * 0.2);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + h * 0.2);
    ctx.closePath();
  }
  function drawCar(ctx, x, y, w, h, color, useBlur) {
    ctx.save();
    if (useBlur) {
      ctx.shadowColor = color; ctx.shadowBlur = 20;
    } else {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = color;
      carPath(ctx, x - 3, y - 3, w + 6, h + 6);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = color;
    carPath(ctx, x, y, w, h);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(x + w * 0.15, y + h * 0.15, w * 0.7, h * 0.22);
    ctx.restore();
  }

  function onDraw(ctx, w, h) {
    ctx.save();
    if (shakeT > 0) ctx.translate((Math.random() - 0.5) * 10 * (shakeT / 0.35), (Math.random() - 0.5) * 10 * (shakeT / 0.35));
    ctx.clearRect(-20, -20, w + 40, h + 40);
    drawRoad(ctx);

    boosts.forEach(function (b) {
      const by = b.y + Math.sin(b.t) * 3;
      ctx.save();
      ctx.translate(b.x, by); ctx.rotate(b.t);
      ctx.fillStyle = "#00f6ff";
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(0, 0, b.r * 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(0, -b.r); ctx.lineTo(b.r, 0); ctx.lineTo(0, b.r); ctx.lineTo(-b.r, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    });
    shields.forEach(function (s) {
      const sy = s.y + Math.sin(s.t) * 3;
      ctx.save();
      ctx.translate(s.x, sy); ctx.rotate(s.t * 0.5);
      ctx.strokeStyle = "rgba(57,255,136,0.3)"; ctx.lineWidth = 7;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2, px = Math.cos(ang) * s.r, pyy = Math.sin(ang) * s.r;
        if (i === 0) ctx.moveTo(px, pyy); else ctx.lineTo(px, pyy);
      }
      ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = "#39ff88"; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    });

    cars.forEach(function (c) { drawCar(ctx, c.x, c.y, c.w, c.h, c.color); });

    player.trail.forEach(function (t, i) {
      const a = (i / player.trail.length) * 0.3;
      ctx.fillStyle = "rgba(0,246,255," + a.toFixed(2) + ")";
      ctx.beginPath(); ctx.arc(t.x, t.y, 6, 0, Math.PI * 2); ctx.fill();
    });
    if (player.shielded) {
      const pulse = 4 + Math.sin(elapsed * 10) * 2;
      ctx.save();
      ctx.strokeStyle = "rgba(57,255,136,0.7)"; ctx.lineWidth = 2;
      ctx.shadowColor = "#39ff88"; ctx.shadowBlur = 12;
      ctx.strokeRect(player.x - 6 - pulse * 0.3, PLAYER_Y - 6 - pulse * 0.3, CAR_W + 12 + pulse * 0.6, CAR_H + 12 + pulse * 0.6);
      ctx.restore();
    }
    drawCar(ctx, player.x, PLAYER_Y, CAR_W, CAR_H, "#00f6ff", true);

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

  function onKeyDown(e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { steer = -1; dragTargetX = null; }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { steer = 1; dragTargetX = null; }
  }
  function onKeyUp(e) {
    if ((e.key === "ArrowLeft" || e.key === "a" || e.key === "A") && steer === -1) steer = 0;
    if ((e.key === "ArrowRight" || e.key === "d" || e.key === "D") && steer === 1) steer = 0;
  }
  function pointerToX(clientX) {
    const rect = Arcade.canvas.getBoundingClientRect();
    return (clientX - rect.left) * (W / rect.width);
  }
  function onPointerDown(e) {
    if (e.cancelable) e.preventDefault();
    dragTargetX = pointerToX(e.clientX);
  }
  function onPointerMove(e) {
    if (dragTargetX != null) dragTargetX = pointerToX(e.clientX);
  }
  function onPointerUp() { dragTargetX = null; }

  Arcade.registerGame({
    id: "drift",
    name: "Neon Drift",
    tagline: "Verkehr ausweichen, Boost jagen",
    accent: "#ff7a1a",
    canvasW: W,
    canvasH: H,
    description: "Steuere deinen Neon-Wagen durch den Verkehr. Ein Zusammenstoß beendet den Run.<br>Cyan-Kristalle geben Bonuspunkte und einen kurzen Boost, grüne Schilde machen dich kurz unverwundbar.",
    controlsHint: "Lenken: ← → / A D · oder Ziehen mit Maus/Finger",
    startLabel: "Losfahren",
    hud: [{ id: "score", label: "Score" }, { id: "best", label: "Best" }, { id: "speed", label: "Tempo" }],
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
