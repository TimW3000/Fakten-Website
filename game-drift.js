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

  let player, cars, boosts, shields, magnets, slicks, particles, popups, laneMarks, roadside;
  let score = 0, distance = 0, speed = BASE_SPEED, elapsed = 0;
  let spawnTimer = 0, boostTimer = 0, shieldSpawnTimer = 0, magnetSpawnTimer = 0, slickTimer = 0, boostBonusT = 0;
  let shakeT = 0;
  let steer = 0; // -1, 0, 1 from keyboard
  let dragTargetX = null;

  function onStart() {
    player = { x: W / 2 - CAR_W / 2, vx: 0, shielded: false, shieldTime: 0, magnetTime: 0, slickTime: 0, trail: [] };
    cars = []; boosts = []; shields = []; magnets = []; slicks = []; particles = []; popups = [];
    laneMarks = [];
    for (let i = 0; i < 10; i++) laneMarks.push(i * 70);
    roadside = [];
    for (let i = 0; i < 16; i++) roadside.push({ y: i * 60, side: Math.random() < 0.5 ? "l" : "r", h: 30 + Math.random() * 40 });
    score = 0; distance = 0; speed = BASE_SPEED; elapsed = 0;
    spawnTimer = 1; boostTimer = 1.8; shieldSpawnTimer = 13 + Math.random() * 5;
    magnetSpawnTimer = 15 + Math.random() * 8; slickTimer = 9 + Math.random() * 5; boostBonusT = 0;
    shakeT = 0; steer = 0; dragTargetX = null;
    Arcade.setHud("score", 0);
    Arcade.setHud("speed", "x1.0");
  }

  function spawnCar() {
    const roll = Math.random();
    const th = Arcade.theme();
    if (roll < 0.2) {
      // Truck: breit, langsamer, schwerer auszuweichen
      const w = ROAD_W * 0.55;
      const x = Arcade.clamp(ROAD_LEFT + Math.random() * (ROAD_W - w), ROAD_LEFT, ROAD_RIGHT - w);
      cars.push({ kind: "truck", x: x, y: -CAR_H * 1.6, w: w, h: CAR_H * 1.5, color: th.hazardA, vxSelf: 0 });
    } else if (roll < 0.42) {
      // Schlingerer: driftet seitlich hin und her
      const w = CAR_W;
      const x = Arcade.clamp(ROAD_LEFT + Math.random() * (ROAD_W - w), ROAD_LEFT, ROAD_RIGHT - w);
      cars.push({ kind: "swerve", x: x, y: -CAR_H, w: w, h: CAR_H, color: th.hazardB, phase: Math.random() * Math.PI * 2 });
    } else {
      const w = CAR_W + Math.random() * 8;
      const x = Arcade.clamp(ROAD_LEFT + Math.random() * (ROAD_W - w), ROAD_LEFT, ROAD_RIGHT - w);
      const hue = Math.random() < 0.5 ? th.hazardB : th.hazardA;
      cars.push({ kind: "normal", x: x, y: -CAR_H, w: w, h: CAR_H + Math.random() * 10, color: hue });
    }
  }
  function spawnBoost() {
    boosts.push({ x: ROAD_LEFT + 20 + Math.random() * (ROAD_W - 40), y: -20, r: 10, t: Math.random() * Math.PI * 2 });
  }
  function spawnShield() {
    shields.push({ x: ROAD_LEFT + 20 + Math.random() * (ROAD_W - 40), y: -20, r: 12, t: Math.random() * Math.PI * 2 });
  }
  function spawnMagnet() {
    magnets.push({ x: ROAD_LEFT + 20 + Math.random() * (ROAD_W - 40), y: -20, r: 12, t: Math.random() * Math.PI * 2 });
  }
  function spawnSlick() {
    const w = 70 + Math.random() * 40;
    slicks.push({ x: Arcade.clamp(ROAD_LEFT + Math.random() * (ROAD_W - w), ROAD_LEFT, ROAD_RIGHT - w), y: -30, w: w, h: 26 });
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

    const control = player.slickTime > 0 ? 0.4 : 1;
    if (dragTargetX != null) {
      const dx = dragTargetX - (player.x + CAR_W / 2);
      player.x += Arcade.clamp(dx, -420 * control * dt, 420 * control * dt);
    } else {
      player.vx += steer * STEER_ACCEL * control * dt;
      player.vx *= STEER_FRICTION;
      player.vx = Arcade.clamp(player.vx, -MAX_VX, MAX_VX);
      player.x += player.vx * dt;
    }
    player.x = Arcade.clamp(player.x, ROAD_LEFT + 4, ROAD_RIGHT - CAR_W - 4);

    if (player.shielded) {
      player.shieldTime -= dt;
      if (player.shieldTime <= 0) player.shielded = false;
    }
    if (player.magnetTime > 0) player.magnetTime -= dt;
    if (player.slickTime > 0) player.slickTime -= dt;

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
    magnetSpawnTimer -= dt;
    if (magnetSpawnTimer <= 0) { spawnMagnet(); magnetSpawnTimer = 17 + Math.random() * 9; }
    slickTimer -= dt;
    if (slickTimer <= 0) { spawnSlick(); slickTimer = 10 + Math.random() * 6; }

    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      c.y += speed * dt;
      if (c.kind === "swerve") {
        c.phase += dt * 2.6;
        const drift = Math.sin(c.phase) * 90 * dt;
        c.x = Arcade.clamp(c.x + drift, ROAD_LEFT, ROAD_RIGHT - c.w);
      }
      if (Arcade.rectsOverlap(player.x, PLAYER_Y, CAR_W, CAR_H, c.x, c.y, c.w, c.h)) {
        if (player.shielded) {
          spawnParticles(c.x + c.w / 2, c.y + c.h / 2, Arcade.theme().powerupA);
          cars.splice(i, 1);
          continue;
        }
        crash();
        return;
      }
      if (c.y > H + 10) cars.splice(i, 1);
    }

    const playerCx = player.x + CAR_W / 2, playerCy = PLAYER_Y + CAR_H / 2;
    for (let i = boosts.length - 1; i >= 0; i--) {
      const b = boosts[i];
      b.y += speed * dt; b.t += dt * 4;
      if (player.magnetTime > 0) {
        const dx = playerCx - b.x, dy = playerCy - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 200 && dist > 1) { b.x += (dx / dist) * 460 * dt; b.y += (dy / dist) * 460 * dt; }
      }
      if (Arcade.circlesOverlap(player.x + CAR_W / 2, PLAYER_Y + CAR_H / 2, CAR_W / 2, b.x, b.y, b.r)) {
        score += 25;
        boostBonusT = 1.6;
        spawnPopup(b.x, b.y, "+25 BOOST", Arcade.theme().collectible);
        spawnParticles(b.x, b.y, Arcade.theme().collectible);
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
        spawnPopup(s.x, s.y, "SCHILD", Arcade.theme().powerupA);
        spawnParticles(s.x, s.y, Arcade.theme().powerupA);
        Arcade.beep(220, 1100, 0.28, "sawtooth", 0.1);
        shields.splice(i, 1);
        continue;
      }
      if (s.y > H + 10) shields.splice(i, 1);
    }

    for (let i = magnets.length - 1; i >= 0; i--) {
      const m = magnets[i];
      m.y += speed * dt; m.t += dt * 3;
      if (Arcade.circlesOverlap(player.x + CAR_W / 2, PLAYER_Y + CAR_H / 2, CAR_W / 2, m.x, m.y, m.r)) {
        player.magnetTime = 7;
        spawnPopup(m.x, m.y, "MAGNET", Arcade.theme().powerupB);
        spawnParticles(m.x, m.y, Arcade.theme().powerupB);
        Arcade.beep(220, 1100, 0.28, "sawtooth", 0.1);
        magnets.splice(i, 1);
        continue;
      }
      if (m.y > H + 10) magnets.splice(i, 1);
    }

    for (let i = slicks.length - 1; i >= 0; i--) {
      const sl = slicks[i];
      sl.y += speed * dt;
      if (!sl.hit && Arcade.rectsOverlap(player.x, PLAYER_Y, CAR_W, CAR_H, sl.x, sl.y, sl.w, sl.h)) {
        sl.hit = true;
        player.slickTime = 2;
        spawnPopup(player.x + CAR_W / 2, PLAYER_Y, "GLATT!", Arcade.theme().hazardA);
        Arcade.beep(180, 120, 0.2, "sawtooth", 0.08);
      }
      if (sl.y > H + 10) slicks.splice(i, 1);
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
    spawnParticles(player.x + CAR_W / 2, PLAYER_Y + CAR_H / 2, Arcade.theme().hazardB);
    shakeT = 0.35;
    Arcade.beep(300, 40, 0.4, "sawtooth", 0.18);
    Arcade.endRun(score);
  }

  function drawRoad(ctx) {
    const th = Arcade.theme();
    const retro = Arcade.isRetro();

    if (retro) {
      ctx.fillStyle = th.hazardB;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = th.ground;
      ctx.fillRect(ROAD_LEFT, 0, ROAD_W, H);
      ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ROAD_LEFT, 0); ctx.lineTo(ROAD_LEFT, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ROAD_RIGHT, 0); ctx.lineTo(ROAD_RIGHT, H); ctx.stroke();
    } else {
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
    }

    ctx.strokeStyle = retro ? "rgba(255,255,255,0.75)" : "rgba(232,230,255,0.4)";
    ctx.lineWidth = 4;
    ctx.setLineDash([26, 22]);
    laneMarks.forEach(function (y) {
      ctx.beginPath(); ctx.moveTo(W / 2, y); ctx.lineTo(W / 2, y + 26); ctx.stroke();
    });
    ctx.setLineDash([]);

    if (retro) {
      roadside.forEach(function (r) {
        const cx = (r.side === "l" ? ROAD_LEFT - 16 : ROAD_RIGHT + 16);
        ctx.fillStyle = "#2e7031";
        ctx.beginPath(); ctx.arc(cx, r.y + r.h / 2, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = th.hazardB;
        ctx.beginPath(); ctx.arc(cx, r.y + r.h / 2 - 6, 13, 0, Math.PI * 2); ctx.fill();
      });
    } else {
      ctx.fillStyle = "rgba(124,58,237,0.35)";
      roadside.forEach(function (r) {
        const x = r.side === "l" ? ROAD_LEFT - 26 : ROAD_RIGHT + 10;
        ctx.fillRect(x, r.y, 16, r.h);
      });
    }
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
    const th = Arcade.theme();
    const retro = Arcade.isRetro();
    ctx.save();
    if (shakeT > 0) ctx.translate((Math.random() - 0.5) * 10 * (shakeT / 0.35), (Math.random() - 0.5) * 10 * (shakeT / 0.35));
    ctx.clearRect(-20, -20, w + 40, h + 40);
    drawRoad(ctx);

    boosts.forEach(function (b) {
      const by = b.y + Math.sin(b.t) * 3;
      ctx.save();
      ctx.translate(b.x, by); ctx.rotate(retro ? 0 : b.t);
      ctx.fillStyle = th.collectible;
      if (!retro) {
        ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.arc(0, 0, b.r * 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (retro) {
        ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1.5; ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(0, -b.r); ctx.lineTo(b.r, 0); ctx.lineTo(0, b.r); ctx.lineTo(-b.r, 0); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    });
    shields.forEach(function (s) {
      const sy = s.y + Math.sin(s.t) * 3;
      ctx.save();
      ctx.translate(s.x, sy); ctx.rotate(s.t * 0.5);
      ctx.strokeStyle = th.powerupA + "4d"; ctx.lineWidth = 7;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2, px = Math.cos(ang) * s.r, pyy = Math.sin(ang) * s.r;
        if (i === 0) ctx.moveTo(px, pyy); else ctx.lineTo(px, pyy);
      }
      ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = th.powerupA; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    });
    magnets.forEach(function (m) {
      const my = m.y + Math.sin(m.t) * 3;
      ctx.save();
      ctx.translate(m.x, my); ctx.rotate(m.t * 0.5);
      ctx.strokeStyle = th.powerupB + "4d"; ctx.lineWidth = 7;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2, px = Math.cos(ang) * m.r, pyy = Math.sin(ang) * m.r;
        if (i === 0) ctx.moveTo(px, pyy); else ctx.lineTo(px, pyy);
      }
      ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = th.powerupB; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    });
    slicks.forEach(function (sl) {
      ctx.save();
      ctx.fillStyle = "rgba(10,10,20,0.55)";
      ctx.beginPath();
      ctx.ellipse(sl.x + sl.w / 2, sl.y + sl.h / 2, sl.w / 2, sl.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    });

    cars.forEach(function (c) {
      if (c.kind === "truck") {
        ctx.save();
        ctx.fillStyle = c.color;
        ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(c.x, c.y, c.w, c.h);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillRect(c.x + c.w * 0.1, c.y + c.h * 0.08, c.w * 0.8, c.h * 0.18);
        ctx.restore();
      } else {
        drawCar(ctx, c.x, c.y, c.w, c.h, c.color);
      }
    });

    if (!retro) {
      player.trail.forEach(function (t, i) {
        const a = (i / player.trail.length) * 0.3;
        ctx.fillStyle = "rgba(0,246,255," + a.toFixed(2) + ")";
        ctx.beginPath(); ctx.arc(t.x, t.y, 6, 0, Math.PI * 2); ctx.fill();
      });
    }
    if (player.shielded) {
      const pulse = 4 + Math.sin(elapsed * 10) * 2;
      ctx.save();
      ctx.strokeStyle = th.powerupA; ctx.lineWidth = 2;
      if (!retro) { ctx.shadowColor = th.powerupA; ctx.shadowBlur = 12; }
      ctx.strokeRect(player.x - 6 - pulse * 0.3, PLAYER_Y - 6 - pulse * 0.3, CAR_W + 12 + pulse * 0.6, CAR_H + 12 + pulse * 0.6);
      ctx.restore();
    }
    drawCar(ctx, player.x, PLAYER_Y, CAR_W, CAR_H, th.player, !retro);

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
    description: "Steuere deinen Neon-Wagen durch den Verkehr — auch breite Laster und schlingernde Fahrer. Ein Zusammenstoß beendet den Run.<br>Kristalle geben Bonuspunkte und Boost, Schilde machen unverwundbar, Magnete ziehen Boosts an. Ölflecken machen die Lenkung kurz rutschig.",
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
