/* ============================================================
   NEON FEVER — Rhythmus-Spiel, Noten im Takt treffen
   ============================================================ */
(function () {
  "use strict";

  const W = 400, H = 600;
  const LANES = 4;
  const LANE_W = W / LANES;
  const TARGET_Y = H - 100;
  const BASE_BPM = 128, MAX_BPM = 175, BPM_RAMP_TIME = 150;
  const PERFECT_PX = 16, GOOD_PX = 34;
  const KEYS = ["d", "f", "j", "k"];
  const KEY_LABELS = ["D", "F", "J", "K"];

  let notes, particles, popups, laneFlash, laneDown, pointerLane;
  let score = 0, combo = 0, maxCombo = 0, fever = 100, elapsed = 0;
  let beatTimer = 0, tickCount = 0;
  let gameOver = false;
  let shakeT = 0;

  function currentBPM() { return Math.min(MAX_BPM, BASE_BPM + (elapsed / BPM_RAMP_TIME) * (MAX_BPM - BASE_BPM)); }
  function currentBeat() { return 60 / currentBPM(); }
  function currentNoteSpeed() { return TARGET_Y / (2 * currentBeat()); }

  function laneColor(i) {
    const th = Arcade.theme();
    return [th.player, th.collectible, th.powerupA, th.powerupB][i % 4];
  }

  function onStart() {
    notes = []; particles = []; popups = [];
    laneFlash = [0, 0, 0, 0]; laneDown = [false, false, false, false]; pointerLane = null;
    score = 0; combo = 0; maxCombo = 0; fever = 100; elapsed = 0;
    beatTimer = currentBeat(); tickCount = 0;
    gameOver = false; shakeT = 0;
    Arcade.setHud("score", 0);
    Arcade.setHud("combo", 0);
    Arcade.setHud("fever", "100%");
    Arcade.setHud("bpm", Math.round(currentBPM()));
  }

  function spawnParticles(x, y, color, n) {
    for (let i = 0; i < (n || 14); i++) {
      const ang = Math.random() * Math.PI * 2, spd = 50 + Math.random() * 160;
      particles.push({ x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0.35 + Math.random() * 0.25, maxLife: 0.6, color: color });
    }
  }
  function spawnPopup(x, y, text, color) { popups.push({ x: x, y: y, text: text, color: color, life: 0.5, maxLife: 0.5 }); }

  function laneX(i) { return i * LANE_W + LANE_W / 2; }

  function spawnBeatNotes() {
    tickCount++;
    const density = Math.min(0.55, 0.18 + elapsed * 0.006);
    const beat = currentBeat();
    for (let i = 0; i < LANES; i++) {
      if (Math.random() < density) {
        const roll = Math.random();
        if (roll < 0.12) {
          notes.push({ lane: i, y: -20, judged: false, kind: "hold", holdDuration: (1 + Math.random()) * beat, holding: false, holdProgress: 0, completed: false });
        } else if (roll < 0.16) {
          notes.push({ lane: i, y: -20, judged: false, kind: "power" });
        } else {
          notes.push({ lane: i, y: -20, judged: false, kind: "tap" });
        }
      }
    }
    if (tickCount % 2 === 0) Arcade.beep(110, 90, 0.06, "square", 0.05);
    Arcade.setHud("bpm", Math.round(currentBPM()));
  }

  function judgeLane(lane) {
    if (gameOver) return;
    laneFlash[lane] = 1;
    let best = null, bestDist = Infinity;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (n.judged || n.lane !== lane) continue;
      if (n.kind === "hold" && n.holding) continue;
      const dist = Math.abs(n.y - TARGET_Y);
      if (dist < bestDist) { bestDist = dist; best = n; }
    }
    if (!best || bestDist > GOOD_PX) return;

    if (best.kind === "power") {
      best.judged = true;
      const pts = 200;
      score += pts; combo++; fever = Math.min(100, fever + 5);
      maxCombo = Math.max(maxCombo, combo);
      spawnPopup(laneX(lane), TARGET_Y - 30, "POWER +200", Arcade.theme().collectible);
      spawnParticles(laneX(lane), TARGET_Y, Arcade.theme().collectible, 30);
      Arcade.beep(900, 1400, 0.12, "sawtooth", 0.14);
      Arcade.setHud("score", score);
      Arcade.setHud("combo", combo);
      Arcade.setHud("fever", Math.round(fever) + "%");
      return;
    }

    if (best.kind === "hold" && !best.holding) {
      const mult = 1 + Math.min(3, Math.floor(combo / 10) * 0.5);
      const pts = Math.round(40 * mult);
      score += pts; combo++; fever = Math.min(100, fever + 1);
      maxCombo = Math.max(maxCombo, combo);
      best.holding = true;
      best.y = TARGET_Y;
      spawnPopup(laneX(lane), TARGET_Y - 30, "HALTEN...", Arcade.theme().powerupB);
      spawnParticles(laneX(lane), TARGET_Y, laneColor(lane), 10);
      Arcade.beep(500, 700, 0.08, "triangle", 0.1);
      Arcade.setHud("score", score);
      Arcade.setHud("combo", combo);
      Arcade.setHud("fever", Math.round(fever) + "%");
      return;
    }

    best.judged = true;
    const mult = 1 + Math.min(3, Math.floor(combo / 10) * 0.5);
    if (bestDist <= PERFECT_PX) {
      const pts = Math.round(100 * mult);
      score += pts; combo++; fever = Math.min(100, fever + 2);
      spawnPopup(laneX(lane), TARGET_Y - 30, "PERFECT", Arcade.theme().collectible);
      Arcade.beep(700, 1000, 0.07, "triangle", 0.11);
    } else {
      const pts = Math.round(50 * mult);
      score += pts; combo++; fever = Math.min(100, fever + 1);
      spawnPopup(laneX(lane), TARGET_Y - 30, "GOOD", Arcade.theme().powerupA);
      Arcade.beep(500, 650, 0.07, "triangle", 0.09);
    }
    maxCombo = Math.max(maxCombo, combo);
    spawnParticles(laneX(lane), TARGET_Y, laneColor(lane), 12);
    Arcade.setHud("score", score);
    Arcade.setHud("combo", combo);
    Arcade.setHud("fever", Math.round(fever) + "%");
  }

  function releaseLane(lane) {
    laneDown[lane] = false;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (n.kind === "hold" && n.holding && !n.completed && !n.judged && n.lane === lane) {
        combo = 0; fever = Math.max(0, fever - 8);
        spawnPopup(laneX(lane), TARGET_Y - 30, "LOSGELASSEN", Arcade.theme().hazardB);
        Arcade.setHud("combo", 0);
        Arcade.setHud("fever", Math.max(0, Math.round(fever)) + "%");
        n.judged = true;
        if (fever <= 0) { crash(); }
      }
    }
  }

  function onUpdate(dt) {
    if (gameOver) return;
    elapsed += dt;
    beatTimer -= dt;
    if (beatTimer <= 0) { spawnBeatNotes(); beatTimer += currentBeat() / 2; }

    const noteSpeed = currentNoteSpeed();
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      if (n.judged) { notes.splice(i, 1); continue; }
      if (n.kind === "hold" && n.holding) {
        if (laneDown[n.lane]) {
          n.holdProgress += dt;
          if (n.holdProgress >= n.holdDuration) {
            const pts = 150;
            score += pts; combo++; fever = Math.min(100, fever + 3);
            maxCombo = Math.max(maxCombo, combo);
            spawnPopup(laneX(n.lane), TARGET_Y - 30, "HOLD!", Arcade.theme().powerupB);
            spawnParticles(laneX(n.lane), TARGET_Y, laneColor(n.lane), 18);
            Arcade.beep(600, 1200, 0.15, "triangle", 0.12);
            Arcade.setHud("score", score);
            Arcade.setHud("combo", combo);
            Arcade.setHud("fever", Math.round(fever) + "%");
            n.judged = true; n.completed = true;
          }
        }
        continue;
      }
      n.y += noteSpeed * dt;
      if (n.y - TARGET_Y > GOOD_PX) {
        combo = 0; fever -= 15;
        spawnPopup(laneX(n.lane), TARGET_Y - 30, "MISS", Arcade.theme().hazardB);
        Arcade.setHud("combo", 0);
        Arcade.setHud("fever", Math.max(0, Math.round(fever)) + "%");
        notes.splice(i, 1);
        if (fever <= 0) { crash(); return; }
      }
    }

    for (let i = 0; i < LANES; i++) if (laneFlash[i] > 0) laneFlash[i] = Math.max(0, laneFlash[i] - dt * 4);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.life -= dt; p.y -= 35 * dt;
      if (p.life <= 0) popups.splice(i, 1);
    }
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
  }

  function crash() {
    gameOver = true;
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

    for (let i = 1; i < LANES; i++) {
      ctx.strokeStyle = retro ? "rgba(255,255,255,0.25)" : "rgba(232,230,255,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(i * LANE_W, 0); ctx.lineTo(i * LANE_W, H); ctx.stroke();
    }

    for (let i = 0; i < LANES; i++) {
      const a = laneFlash[i] * 0.25;
      if (a > 0) { ctx.fillStyle = laneColor(i) + "40"; ctx.fillRect(i * LANE_W, 0, LANE_W, H); }
    }

    ctx.strokeStyle = retro ? "rgba(0,0,0,0.4)" : "rgba(232,230,255,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, TARGET_Y); ctx.lineTo(W, TARGET_Y); ctx.stroke();

    ctx.font = "700 14px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    for (let i = 0; i < LANES; i++) {
      ctx.save();
      ctx.strokeStyle = laneColor(i); ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.strokeRect(i * LANE_W + 10, TARGET_Y - 16, LANE_W - 20, 32);
      ctx.globalAlpha = 1;
      ctx.fillStyle = laneColor(i);
      ctx.fillText(KEY_LABELS[i], laneX(i), TARGET_Y + 46);
      ctx.restore();
    }

    const noteSpeedForDraw = currentNoteSpeed();
    notes.forEach(function (n) {
      if (n.judged) return;
      ctx.save();
      if (n.kind === "hold" && n.holding) {
        const remainPx = Math.max(0, (n.holdDuration - n.holdProgress) * noteSpeedForDraw);
        const color = laneColor(n.lane);
        if (!retro) { ctx.shadowColor = color; ctx.shadowBlur = 12; }
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.75 + 0.25 * Math.abs(Math.sin(elapsed * 8));
        ctx.fillRect(n.lane * LANE_W + 16, TARGET_Y - remainPx, LANE_W - 32, remainPx);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = retro ? "rgba(0,0,0,0.3)" : "#fff";
        ctx.lineWidth = 1.2;
        ctx.strokeRect(n.lane * LANE_W + 16, TARGET_Y - remainPx, LANE_W - 32, remainPx);
        ctx.restore();
        return;
      }
      const color = n.kind === "power" ? Arcade.theme().collectible : laneColor(n.lane);
      if (n.kind === "hold") {
        const tailPx = n.holdDuration * noteSpeedForDraw;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(n.lane * LANE_W + 16, n.y - tailPx, LANE_W - 32, tailPx);
        ctx.globalAlpha = 1;
      }
      if (!retro) { ctx.shadowColor = color; ctx.shadowBlur = n.kind === "power" ? 16 : 10; }
      ctx.fillStyle = color;
      if (n.kind === "power") {
        ctx.globalAlpha = 0.7 + 0.3 * Math.abs(Math.sin(elapsed * 10));
      }
      ctx.fillRect(n.lane * LANE_W + 12, n.y - 9, LANE_W - 24, 18);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.strokeStyle = retro ? "rgba(0,0,0,0.3)" : "#fff";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(n.lane * LANE_W + 12, n.y - 9, LANE_W - 24, 18);
      ctx.restore();
    });

    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    });
    ctx.save();
    ctx.font = "700 14px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
    popups.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    });
    ctx.restore(); ctx.globalAlpha = 1;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(10, 10, 100, 10);
    ctx.fillStyle = fever > 30 ? th.powerupA : th.hazardB;
    ctx.fillRect(10, 10, Math.max(0, fever), 10);
    ctx.restore();
    ctx.restore();
  }

  function onKeyDown(e) {
    const k = e.key.toLowerCase();
    const idx = KEYS.indexOf(k);
    if (idx >= 0) {
      e.preventDefault();
      if (!laneDown[idx]) { laneDown[idx] = true; judgeLane(idx); }
    }
  }
  function onKeyUp(e) {
    const k = e.key.toLowerCase();
    const idx = KEYS.indexOf(k);
    if (idx >= 0) releaseLane(idx);
  }

  function onPointerDown(e) {
    if (e.cancelable) e.preventDefault();
    const rect = Arcade.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const lane = Arcade.clamp(Math.floor(x / LANE_W), 0, LANES - 1);
    pointerLane = lane;
    laneDown[lane] = true;
    judgeLane(lane);
  }
  function onPointerUp() {
    if (pointerLane != null) { releaseLane(pointerLane); pointerLane = null; }
  }

  Arcade.registerGame({
    id: "fever",
    name: "Neon Fever",
    tagline: "Noten im Takt treffen",
    accent: "#7c3aed",
    canvasW: W,
    canvasH: H,
    description: "Triff die Noten genau auf der Ziellinie im richtigen Takt.<br>Perfekt bringt mehr Punkte als Gut, Combos erhöhen den Multiplikator. Lange Noten musst du halten, bis der Balken aufgebraucht ist — zu früh loslassen kostet Fever. Goldene Power-Noten geben einen dicken Bonus. Das Tempo steigt mit der Zeit. Verpasste Noten kosten Fever — bei 0% ist der Run vorbei.",
    controlsHint: "Spuren: D F J K (gedrückt halten für lange Noten) · oder auf die jeweilige Spur tippen/halten",
    startLabel: "Takt starten",
    hud: [{ id: "score", label: "Score" }, { id: "best", label: "Best" }, { id: "combo", label: "Combo" }, { id: "fever", label: "Fever" }, { id: "bpm", label: "BPM" }],
    onStart: onStart,
    onUpdate: onUpdate,
    onDraw: onDraw,
    onKeyDown: onKeyDown,
    onKeyUp: onKeyUp,
    onPointerDown: onPointerDown,
    onPointerUp: onPointerUp
  });
})();
