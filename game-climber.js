/* ============================================================
   NEON CLIMBER — endloser Vertikal-Hüpfer
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 640;
  const ANCHOR_Y = H * 0.42;
  const PLAYER_W = 30, PLAYER_H = 30;
  const GRAVITY = 1400;
  const BOUNCE_V = -650;
  const SPRING_V = -980;
  const BOOST_V = -1500;
  const MOVE_ACCEL = 1600;
  const MOVE_FRICTION = 0.9;
  const MAX_VX = 340;

  let player, platforms, hazards, boosters, particles, popups;
  let camTop = 0, maxHeight = 0, score = 0, elapsed = 0;
  let highestSpawned = 0;
  let hazardTimer = 0, boosterTimer = 0;
  let shakeT = 0;
  let steer = 0;
  let dragTargetX = null;

  function reset() {
    player = { x: W / 2 - PLAYER_W / 2, y: ANCHOR_Y, vx: 0, vy: BOUNCE_V, squash: 0 };
    platforms = [];
    hazards = []; boosters = []; particles = []; popups = [];
    camTop = 0; maxHeight = 0; score = 0; elapsed = 0;
    shakeT = 0; steer = 0; dragTargetX = null;

    let y = ANCHOR_Y + 50;
    platforms.push({ x: W / 2 - 34, y: y, w: 68, kind: "normal", vx: 0, alive: true });
    while (y > -H * 2) {
      y -= 60 + Math.random() * 50;
      spawnPlatformAt(y);
    }
    highestSpawned = y;
    hazardTimer = 6 + Math.random() * 4;
    boosterTimer = 14 + Math.random() * 8;

    Arcade.setHud("score", 0);
    Arcade.setHud("height", 0);
  }

  function spawnPlatformAt(y) {
    const w = 60 + Math.random() * 20;
    const x = 10 + Math.random() * (W - w - 20);
    const roll = Math.random();
    let kind = "normal";
    if (roll < 0.12) kind = "spring";
    else if (roll < 0.30) kind = "breakable";
    else if (roll < 0.48) kind = "moving";
    platforms.push({ x: x, y: y, w: w, kind: kind, vx: kind === "moving" ? (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 40) : 0, alive: true });
  }

  function spawnParticles(x, y, color, n) {
    for (let i = 0; i < (n || 16); i++) {
      const ang = Math.random() * Math.PI * 2, spd = 60 + Math.random() * 220;
      particles.push({ x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0.4 + Math.random() * 0.35, maxLife: 0.75, color: color });
    }
  }
  function spawnPopup(x, y, text, color) { popups.push({ x: x, y: y, text: text, color: color, life: 0.6, maxLife: 0.6 }); }

  function onStart() { reset(); }

  function onUpdate(dt) {
    elapsed += dt;

    if (dragTargetX != null) {
      const dx = dragTargetX - (player.x + PLAYER_W / 2);
      player.x += Arcade.clamp(dx, -420 * dt, 420 * dt);
    } else {
      player.vx += steer * MOVE_ACCEL * dt;
      player.vx *= MOVE_FRICTION;
      player.vx = Arcade.clamp(player.vx, -MAX_VX, MAX_VX);
      player.x += player.vx * dt;
    }
    if (player.x < -PLAYER_W) player.x = W;
    if (player.x > W) player.x = -PLAYER_W;

    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.squash > 0) player.squash = Math.max(0, player.squash - dt * 6);

    if (player.vy > 0) {
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        if (!p.alive) continue;
        const px = player.x + PLAYER_W / 2;
        const feetPrev = player.y - player.vy * dt + PLAYER_H;
        const feetNow = player.y + PLAYER_H;
        if (px > p.x - 6 && px < p.x + p.w + 6 && feetPrev <= p.y + 6 && feetNow >= p.y) {
          if (p.kind === "breakable") {
            p.alive = false;
            spawnParticles(p.x + p.w / 2, p.y, Arcade.theme().hazardA, 14);
            player.vy = BOUNCE_V;
          } else if (p.kind === "spring") {
            player.vy = SPRING_V;
            spawnPopup(p.x + p.w / 2, p.y, "BOING!", Arcade.theme().powerupB);
          } else {
            player.vy = BOUNCE_V;
          }
          player.squash = 1;
          Arcade.beep(220, 440, 0.08, "square", 0.1);
          break;
        }
      }
    }

    platforms.forEach(function (p) {
      if (p.kind === "moving") {
        p.x += p.vx * dt;
        if (p.x < 6) { p.x = 6; p.vx *= -1; }
        if (p.x + p.w > W - 6) { p.x = W - 6 - p.w; p.vx *= -1; }
      }
    });

    const desiredCamTop = player.y - ANCHOR_Y;
    if (desiredCamTop < camTop) camTop = desiredCamTop;

    const h = Math.max(0, Math.floor(-camTop / 4));
    if (h > maxHeight) {
      maxHeight = h;
      score = maxHeight;
      Arcade.setHud("score", score);
      Arcade.setHud("height", h + "m");
    }

    while (highestSpawned > camTop - 200) {
      highestSpawned -= 60 + Math.random() * 60;
      spawnPlatformAt(highestSpawned);
    }
    for (let i = platforms.length - 1; i >= 0; i--) {
      if (platforms[i].y > camTop + H + 60) platforms.splice(i, 1);
    }

    hazardTimer -= dt;
    if (hazardTimer <= 0) {
      hazards.push({ x: Math.random() < 0.5 ? -30 : W + 30, y: camTop - 40 - Math.random() * 200, vx: (Math.random() < 0.5 ? 1 : -1) * (60 + Math.random() * 40), r: 14, t: 0 });
      hazardTimer = 7 + Math.random() * 5;
    }
    for (let i = hazards.length - 1; i >= 0; i--) {
      const hz = hazards[i];
      hz.x += hz.vx * dt;
      hz.t += dt * 4;
      if (hz.y > camTop + H + 60 || hz.x < -60 || hz.x > W + 60) { hazards.splice(i, 1); continue; }
      if (Arcade.circlesOverlap(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, PLAYER_W / 2, hz.x, hz.y, hz.r)) {
        crash();
        return;
      }
    }

    boosterTimer -= dt;
    if (boosterTimer <= 0) {
      boosters.push({ x: 30 + Math.random() * (W - 60), y: camTop - 100 - Math.random() * 300, r: 13, t: Math.random() * Math.PI * 2 });
      boosterTimer = 18 + Math.random() * 10;
    }
    for (let i = boosters.length - 1; i >= 0; i--) {
      const b = boosters[i];
      b.t += dt * 3;
      if (b.y > camTop + H + 60) { boosters.splice(i, 1); continue; }
      if (Arcade.circlesOverlap(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, PLAYER_W / 2, b.x, b.y, b.r)) {
        player.vy = BOOST_V;
        spawnPopup(b.x, b.y, "BOOST!", Arcade.theme().powerupA);
        spawnParticles(b.x, b.y, Arcade.theme().powerupA, 20);
        Arcade.beep(220, 1100, 0.3, "sawtooth", 0.12);
        boosters.splice(i, 1);
      }
    }

    if (player.y - camTop > H + 40) { crash(); return; }

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
    spawnParticles(player.x + PLAYER_W / 2, player.y - camTop + PLAYER_H / 2, Arcade.theme().hazardB, 26);
    shakeT = 0.3;
    Arcade.beep(300, 40, 0.4, "sawtooth", 0.18);
    Arcade.endRun(score);
  }

  function platColor(kind) {
    const th = Arcade.theme();
    if (kind === "spring") return th.powerupB;
    if (kind === "breakable") return th.hazardA;
    if (kind === "moving") return th.collectible;
    return th.ground;
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

    platforms.forEach(function (p) {
      if (!p.alive) return;
      const sy = p.y - camTop;
      if (sy < -20 || sy > h + 20) return;
      const color = platColor(p.kind);
      ctx.save();
      if (!retro) { ctx.shadowColor = color; ctx.shadowBlur = 10; }
      ctx.fillStyle = color;
      ctx.fillRect(p.x, sy, p.w, 12);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = retro ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(p.x, sy, p.w, 12);
      ctx.restore();
    });

    hazards.forEach(function (hz) {
      const sy = hz.y - camTop;
      if (sy < -30 || sy > h + 30) return;
      ctx.save();
      ctx.translate(hz.x, sy); ctx.rotate(Math.sin(hz.t) * 0.3);
      ctx.fillStyle = th.hazardB;
      if (!retro) { ctx.shadowColor = th.hazardB; ctx.shadowBlur = 12; }
      ctx.beginPath();
      ctx.moveTo(0, -hz.r); ctx.lineTo(hz.r, hz.r * 0.6); ctx.lineTo(-hz.r, hz.r * 0.6);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    });

    boosters.forEach(function (b) {
      const sy = b.y - camTop;
      if (sy < -20 || sy > h + 20) return;
      ctx.save();
      ctx.translate(b.x, sy); ctx.rotate(b.t * 0.4);
      ctx.strokeStyle = th.powerupA + "4d"; ctx.lineWidth = 7;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2, px = Math.cos(ang) * b.r, pyy = Math.sin(ang) * b.r;
        if (i === 0) ctx.moveTo(px, pyy); else ctx.lineTo(px, pyy);
      }
      ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = th.powerupA; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    });

    const psy = player.y - camTop;
    const squashY = player.squash * 8;
    ctx.save();
    if (!retro) { ctx.shadowColor = th.player; ctx.shadowBlur = 16; }
    ctx.fillStyle = th.player;
    ctx.fillRect(player.x, psy + squashY, PLAYER_W, PLAYER_H - squashY);
    ctx.shadowBlur = 0;
    if (retro) {
      ctx.fillStyle = th.playerAccent;
      ctx.fillRect(player.x + 4, psy + squashY + 4, PLAYER_W - 8, 6);
    }
    ctx.strokeStyle = retro ? "rgba(0,0,0,0.3)" : "#fff";
    ctx.lineWidth = 1.5; ctx.strokeRect(player.x, psy + squashY, PLAYER_W, PLAYER_H - squashY);
    ctx.restore();

    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - camTop - 2, 4, 4);
      ctx.globalAlpha = 1;
    });
    ctx.save();
    ctx.font = "600 13px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
    popups.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y - camTop);
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
  function onPointerDown(e) { if (e.cancelable) e.preventDefault(); dragTargetX = pointerToX(e.clientX); }
  function onPointerMove(e) { if (dragTargetX != null) dragTargetX = pointerToX(e.clientX); }
  function onPointerUp() { dragTargetX = null; }

  Arcade.registerGame({
    id: "climber",
    name: "Neon Climber",
    tagline: "Endlos nach oben hüpfen",
    accent: "#39ff88",
    canvasW: W,
    canvasH: H,
    description: "Dein Held springt automatisch — du steuerst nur links/rechts.<br>Grüne Federn geben Extra-Schub, braune Blöcke brechen nach einem Sprung. Fällst du aus dem Bild, ist der Run vorbei.",
    controlsHint: "Bewegen: ← → / A D · oder Ziehen mit Maus/Finger",
    startLabel: "Loshüpfen",
    hud: [{ id: "score", label: "Score" }, { id: "best", label: "Best" }, { id: "height", label: "Höhe" }],
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
