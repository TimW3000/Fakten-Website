/* ============================================================
   NEON STRIKE — vertikaler Weltraum-Shooter
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 640;
  const SHIP_W = 34, SHIP_H = 34;
  const SHIP_Y = H - 70;
  const MOVE_SPEED = 420;
  const FIRE_INTERVAL = 0.16;
  const BULLET_SPEED = 820;
  const SHIELD_DURATION = 5;
  const SPREAD_DURATION = 7;

  let ship, bullets, enemyBullets, enemies, powerups, particles, popups, stars;
  let score = 0, elapsed = 0, wave = 1;
  let spawnTimer = 0, fireTimer = 0, powerupTimer = 0;
  let shakeT = 0;
  let moveDir = 0; // -1,0,1 keyboard
  let dragTargetX = null;

  function onStart() {
    ship = { x: W / 2 - SHIP_W / 2, shielded: false, shieldTime: 0, spreadTime: 0 };
    bullets = []; enemyBullets = []; enemies = []; powerups = []; particles = []; popups = [];
    stars = [];
    for (let i = 0; i < 60; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: 0.6 + Math.random() * 1.6, tw: Math.random() * Math.PI * 2, vy: 30 + Math.random() * 60 });
    score = 0; elapsed = 0; wave = 1;
    spawnTimer = 0.8; fireTimer = 0; powerupTimer = 12 + Math.random() * 5;
    shakeT = 0; moveDir = 0; dragTargetX = null;
    Arcade.setHud("score", 0);
    Arcade.setHud("wave", 1);
  }

  function spawnEnemy() {
    const big = Math.random() < 0.28;
    if (big) {
      enemies.push({
        kind: "saucer", x: 40 + Math.random() * (W - 80), y: -40, w: 46, h: 30,
        hp: 3, maxHp: 3, vy: 70 + Math.random() * 30, fireT: 1 + Math.random() * 2, phase: Math.random() * Math.PI * 2
      });
    } else {
      enemies.push({
        kind: "drone", x: 30 + Math.random() * (W - 60), y: -24, w: 24, h: 24,
        hp: 1, maxHp: 1, vy: 130 + Math.random() * 70, phase: Math.random() * Math.PI * 2
      });
    }
  }
  function spawnPowerup() {
    const kind = Math.random() < 0.5 ? "shield" : "spread";
    powerups.push({ kind: kind, x: 30 + Math.random() * (W - 60), y: -20, r: 12, t: Math.random() * Math.PI * 2 });
  }
  function spawnParticles(x, y, color, n) {
    for (let i = 0; i < (n || 18); i++) {
      const ang = Math.random() * Math.PI * 2, spd = 60 + Math.random() * 220;
      particles.push({ x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0.4 + Math.random() * 0.35, maxLife: 0.75, color: color });
    }
  }
  function spawnPopup(x, y, text, color) { popups.push({ x: x, y: y, text: text, color: color, life: 0.7, maxLife: 0.7 }); }

  function fireBullets() {
    const nose = { x: ship.x + SHIP_W / 2, y: SHIP_Y };
    if (ship.spreadTime > 0) {
      bullets.push({ x: nose.x, y: nose.y, vx: 0, vy: -BULLET_SPEED });
      bullets.push({ x: nose.x, y: nose.y, vx: -180, vy: -BULLET_SPEED });
      bullets.push({ x: nose.x, y: nose.y, vx: 180, vy: -BULLET_SPEED });
    } else {
      bullets.push({ x: nose.x, y: nose.y, vx: 0, vy: -BULLET_SPEED });
    }
    Arcade.beep(680, 900, 0.05, "square", 0.06);
  }

  function onUpdate(dt) {
    elapsed += dt;
    wave = Math.floor(elapsed / 15) + 1;
    Arcade.setHud("wave", wave);

    if (dragTargetX != null) {
      const dx = dragTargetX - (ship.x + SHIP_W / 2);
      ship.x += Arcade.clamp(dx, -MOVE_SPEED * dt, MOVE_SPEED * dt);
    } else {
      ship.x += moveDir * MOVE_SPEED * dt;
    }
    ship.x = Arcade.clamp(ship.x, 6, W - SHIP_W - 6);

    if (ship.shielded) { ship.shieldTime -= dt; if (ship.shieldTime <= 0) ship.shielded = false; }
    if (ship.spreadTime > 0) ship.spreadTime -= dt;

    fireTimer -= dt;
    if (fireTimer <= 0) { fireBullets(); fireTimer = FIRE_INTERVAL; }

    stars.forEach(function (s) { s.y += s.vy * dt; if (s.y > H) { s.y = -4; s.x = Math.random() * W; } });

    spawnTimer -= dt;
    const spawnInterval = Math.max(1.0 - elapsed * 0.012, 0.38);
    if (spawnTimer <= 0) { spawnEnemy(); spawnTimer = spawnInterval + Math.random() * 0.25; }
    powerupTimer -= dt;
    if (powerupTimer <= 0) { spawnPowerup(); powerupTimer = 15 + Math.random() * 8; }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < -10 || b.x < -10 || b.x > W + 10) { bullets.splice(i, 1); continue; }
    }
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.y += b.vy * dt;
      if (b.y > H + 10) { enemyBullets.splice(i, 1); continue; }
      if (Arcade.circlesOverlap(ship.x + SHIP_W / 2, SHIP_Y + SHIP_H / 2, SHIP_W / 2, b.x, b.y, 5)) {
        enemyBullets.splice(i, 1);
        if (ship.shielded) { spawnParticles(b.x, b.y, Arcade.theme().powerupA, 10); continue; }
        crash();
        return;
      }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.y += e.vy * dt;
      e.phase += dt * 2;
      e.x += Math.sin(e.phase) * 22 * dt;
      e.x = Arcade.clamp(e.x, 4, W - e.w - 4);

      if (e.kind === "saucer") {
        e.fireT -= dt;
        if (e.fireT <= 0) {
          enemyBullets.push({ x: e.x + e.w / 2, y: e.y + e.h, vy: 220 + wave * 8 });
          e.fireT = 1.4 + Math.random() * 1.6;
        }
      }

      if (Arcade.rectsOverlap(ship.x, SHIP_Y, SHIP_W, SHIP_H, e.x, e.y, e.w, e.h)) {
        if (ship.shielded) {
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, Arcade.theme().powerupA);
          enemies.splice(i, 1);
          continue;
        }
        crash();
        return;
      }

      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (Arcade.rectsOverlap(b.x - 3, b.y - 8, 6, 16, e.x, e.y, e.w, e.h)) {
          bullets.splice(j, 1);
          e.hp -= 1;
          spawnParticles(b.x, b.y, Arcade.theme().player, 6);
          if (e.hp <= 0) {
            const pts = e.kind === "saucer" ? 40 : 10;
            score += pts;
            Arcade.setHud("score", Math.floor(score));
            spawnPopup(e.x + e.w / 2, e.y, "+" + pts, Arcade.theme().collectible);
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.kind === "saucer" ? Arcade.theme().hazardB : Arcade.theme().hazardA, 26);
            Arcade.beep(300, 90, 0.14, "sawtooth", 0.14);
            enemies.splice(i, 1);
          }
          break;
        }
      }
      if (i < enemies.length && enemies[i] === e && e.y > H + 20) enemies.splice(i, 1);
    }

    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += 90 * dt; p.t += dt * 3;
      if (Arcade.circlesOverlap(ship.x + SHIP_W / 2, SHIP_Y + SHIP_H / 2, SHIP_W / 2, p.x, p.y, p.r)) {
        if (p.kind === "shield") {
          ship.shielded = true; ship.shieldTime = SHIELD_DURATION;
          spawnPopup(p.x, p.y, "SCHILD", Arcade.theme().powerupA);
          spawnParticles(p.x, p.y, Arcade.theme().powerupA);
        } else {
          ship.spreadTime = SPREAD_DURATION;
          spawnPopup(p.x, p.y, "SPREAD", Arcade.theme().powerupB);
          spawnParticles(p.x, p.y, Arcade.theme().powerupB);
        }
        Arcade.beep(220, 1100, 0.28, "sawtooth", 0.1);
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
      p.life -= dt; p.y -= 30 * dt;
      if (p.life <= 0) popups.splice(i, 1);
    }
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
  }

  function crash() {
    spawnParticles(ship.x + SHIP_W / 2, SHIP_Y + SHIP_H / 2, Arcade.theme().hazardB, 30);
    shakeT = 0.35;
    Arcade.beep(300, 40, 0.4, "sawtooth", 0.18);
    Arcade.endRun(score);
  }

  function drawShip(ctx, x, y, glow) {
    const th = Arcade.theme();
    ctx.save();
    if (!Arcade.isRetro()) { ctx.shadowColor = th.player; ctx.shadowBlur = glow || 18; }
    ctx.fillStyle = th.player;
    ctx.beginPath();
    ctx.moveTo(x + SHIP_W / 2, y);
    ctx.lineTo(x + SHIP_W, y + SHIP_H);
    ctx.lineTo(x + SHIP_W / 2, y + SHIP_H * 0.72);
    ctx.lineTo(x, y + SHIP_H);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = Arcade.isRetro() ? "rgba(0,0,0,0.3)" : "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }

  let bgGradient = null, bgGradientFor = null;
  function onDraw(ctx, w, h) {
    const th = Arcade.theme();
    const retro = Arcade.isRetro();
    ctx.save();
    if (shakeT > 0) ctx.translate((Math.random() - 0.5) * 10 * (shakeT / 0.35), (Math.random() - 0.5) * 10 * (shakeT / 0.35));
    ctx.clearRect(-20, -20, w + 40, h + 40);
    if (!bgGradient || bgGradientFor !== th) {
      bgGradient = ctx.createLinearGradient(0, 0, 0, h);
      bgGradient.addColorStop(0, th.bgTop); bgGradient.addColorStop(1, th.bgBottom);
      bgGradientFor = th;
    }
    ctx.fillStyle = bgGradient; ctx.fillRect(-20, -20, w + 40, h + 40);

    stars.forEach(function (s) {
      if (retro) {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2.2, 0, Math.PI * 2); ctx.fill();
      } else {
        const a = 0.3 + 0.5 * Math.abs(Math.sin(elapsed * 2 + s.tw));
        ctx.fillStyle = "rgba(232,230,255," + a.toFixed(2) + ")";
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
    });

    bullets.forEach(function (b) {
      ctx.save();
      ctx.strokeStyle = th.player + "59"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + 12); ctx.stroke();
      ctx.strokeStyle = th.player; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + 12); ctx.stroke();
      ctx.restore();
    });
    enemyBullets.forEach(function (b) {
      ctx.save();
      ctx.fillStyle = th.hazardA;
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    powerups.forEach(function (p) {
      const color = p.kind === "shield" ? th.powerupA : th.powerupB;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.t);
      ctx.strokeStyle = color + "4d";
      ctx.lineWidth = 7;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2, px = Math.cos(ang) * p.r, pyy = Math.sin(ang) * p.r;
        if (i === 0) ctx.moveTo(px, pyy); else ctx.lineTo(px, pyy);
      }
      ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    });

    enemies.forEach(function (e) {
      const color = e.kind === "saucer" ? th.hazardB : th.hazardA;
      ctx.save();
      ctx.fillStyle = color;
      if (e.kind === "saucer") {
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2 + 4, e.h / 2 + 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(e.x + e.w / 2, e.y + e.h + 4);
        ctx.lineTo(e.x + e.w + 4, e.y - 3);
        ctx.lineTo(e.x + e.w / 2, e.y + e.h * 0.28);
        ctx.lineTo(e.x - 4, e.y - 3);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(e.x + e.w / 2, e.y + e.h);
        ctx.lineTo(e.x + e.w, e.y);
        ctx.lineTo(e.x + e.w / 2, e.y + e.h * 0.28);
        ctx.lineTo(e.x, e.y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
      if (e.maxHp > 1) {
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(e.x, e.y - 6, e.w, 3);
        ctx.fillStyle = th.powerupA;
        ctx.fillRect(e.x, e.y - 6, e.w * (e.hp / e.maxHp), 3);
      }
    });

    if (ship.shielded) {
      const pulse = 4 + Math.sin(elapsed * 10) * 2;
      ctx.save();
      ctx.strokeStyle = th.powerupA; ctx.lineWidth = 2;
      if (!retro) { ctx.shadowColor = th.powerupA; ctx.shadowBlur = 12; }
      ctx.beginPath(); ctx.arc(ship.x + SHIP_W / 2, SHIP_Y + SHIP_H / 2, SHIP_W / 2 + 10 + pulse * 0.3, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    drawShip(ctx, ship.x, SHIP_Y);

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
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { moveDir = -1; dragTargetX = null; }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { moveDir = 1; dragTargetX = null; }
  }
  function onKeyUp(e) {
    if ((e.key === "ArrowLeft" || e.key === "a" || e.key === "A") && moveDir === -1) moveDir = 0;
    if ((e.key === "ArrowRight" || e.key === "d" || e.key === "D") && moveDir === 1) moveDir = 0;
  }
  function pointerToX(clientX) {
    const rect = Arcade.canvas.getBoundingClientRect();
    return (clientX - rect.left) * (W / rect.width);
  }
  function onPointerDown(e) { if (e.cancelable) e.preventDefault(); dragTargetX = pointerToX(e.clientX); }
  function onPointerMove(e) { if (dragTargetX != null) dragTargetX = pointerToX(e.clientX); }
  function onPointerUp() { dragTargetX = null; }

  Arcade.registerGame({
    id: "strike",
    name: "Neon Strike",
    tagline: "Weltraum-Shooter, Wellen abballern",
    accent: "#ff2bd6",
    canvasW: W,
    canvasH: H,
    description: "Dein Schiff schießt automatisch. Weiche Gegnern und ihrem Feuer aus.<br>Grüne Kapseln geben ein Schild, magenta Kapseln kurzzeitig Streufeuer. Größere Gegner brauchen mehrere Treffer.",
    controlsHint: "Bewegen: ← → / A D · oder Ziehen mit Maus/Finger",
    startLabel: "Angriff starten",
    hud: [{ id: "score", label: "Score" }, { id: "best", label: "Best" }, { id: "wave", label: "Welle" }],
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
