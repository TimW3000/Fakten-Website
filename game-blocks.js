/* ============================================================
   NEON BLOCKS — Fallblock-Puzzle
   ============================================================ */
(function () {
  "use strict";

  const CELL = 26, COLS = 10, ROWS = 18;
  const W = CELL * COLS, H = CELL * ROWS;
  const SOFT_INTERVAL = 0.045;

  const SHAPES = {
    I: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[2, 0], [2, 1], [2, 2], [2, 3]], [[0, 2], [1, 2], [2, 2], [3, 2]], [[1, 0], [1, 1], [1, 2], [1, 3]]],
    O: [[[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]]],
    T: [[[1, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [1, 2]], [[1, 0], [0, 1], [1, 1], [1, 2]]],
    S: [[[1, 0], [2, 0], [0, 1], [1, 1]], [[1, 0], [1, 1], [2, 1], [2, 2]], [[1, 0], [2, 0], [0, 1], [1, 1]], [[1, 0], [1, 1], [2, 1], [2, 2]]],
    Z: [[[0, 0], [1, 0], [1, 1], [2, 1]], [[2, 0], [1, 1], [2, 1], [1, 2]], [[0, 0], [1, 0], [1, 1], [2, 1]], [[2, 0], [1, 1], [2, 1], [1, 2]]],
    J: [[[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [2, 2]], [[1, 0], [1, 1], [0, 2], [1, 2]]],
    L: [[[2, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [1, 2], [2, 2]], [[0, 1], [1, 1], [2, 1], [0, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]]]
  };
  const TYPES = ["I", "O", "T", "S", "Z", "J", "L"];
  function typeColor(type) {
    const th = Arcade.theme();
    return ({ I: th.player, O: th.collectible, T: th.powerupB, S: th.powerupA, Z: th.hazardB, J: th.ai, L: th.hazardA })[type];
  }

  let board, cur, next, particles, popups;
  let score = 0, lines = 0, level = 1;
  let dropTimer = 0, softDrop = false;
  let gameOver = false;
  let shakeT = 0;

  function newBoard() {
    const b = [];
    for (let r = 0; r < ROWS; r++) b.push(new Array(COLS).fill(null));
    return b;
  }
  function randomType() { return TYPES[Math.floor(Math.random() * TYPES.length)]; }
  function spawnPiece(type) {
    return { type: type, rot: 0, x: 3, y: -1 };
  }

  function onStart() {
    board = newBoard();
    particles = []; popups = [];
    score = 0; lines = 0; level = 1;
    dropTimer = dropInterval(); softDrop = false;
    gameOver = false; shakeT = 0;
    cur = spawnPiece(randomType());
    next = randomType();
    Arcade.setHud("score", 0);
    Arcade.setHud("lines", 0);
    Arcade.setHud("level", 1);
  }

  function dropInterval() { return Math.max(0.9 - (level - 1) * 0.07, 0.14); }

  function cellsOf(piece) {
    return SHAPES[piece.type][piece.rot].map(function (c) { return [piece.x + c[0], piece.y + c[1]]; });
  }
  function fits(piece) {
    const cells = cellsOf(piece);
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i][0], r = cells[i][1];
      if (c < 0 || c >= COLS || r >= ROWS) return false;
      if (r >= 0 && board[r][c]) return false;
    }
    return true;
  }

  function tryMove(dx, dy) {
    const p = { type: cur.type, rot: cur.rot, x: cur.x + dx, y: cur.y + dy };
    if (fits(p)) { cur = p; return true; }
    return false;
  }
  function tryRotate() {
    const p = { type: cur.type, rot: (cur.rot + 1) % 4, x: cur.x, y: cur.y };
    if (fits(p)) { cur = p; return true; }
    p.x = cur.x - 1; if (fits(p)) { cur = p; return true; }
    p.x = cur.x + 1; if (fits(p)) { cur = p; return true; }
    return false;
  }

  function ghostY() {
    let gy = cur.y;
    while (fits({ type: cur.type, rot: cur.rot, x: cur.x, y: gy + 1 })) gy++;
    return gy;
  }

  function spawnParticles(x, y, color, n) {
    for (let i = 0; i < (n || 16); i++) {
      const ang = Math.random() * Math.PI * 2, spd = 60 + Math.random() * 200;
      particles.push({ x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0.4 + Math.random() * 0.3, maxLife: 0.7, color: color });
    }
  }
  function spawnPopup(x, y, text, color) { popups.push({ x: x, y: y, text: text, color: color, life: 0.7, maxLife: 0.7 }); }

  function lockPiece() {
    const color = cur.type;
    const cells = cellsOf(cur);
    let outOfBounds = false;
    cells.forEach(function (c) {
      if (c[1] < 0) { outOfBounds = true; return; }
      board[c[1]][c[0]] = color;
    });
    Arcade.beep(240, 160, 0.07, "square", 0.09);
    if (outOfBounds) { crash(); return; }

    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every(function (v) { return v !== null; })) {
        spawnParticles(W / 2, r * CELL + CELL / 2, typeColor(board[r][Math.floor(COLS / 2)]) || Arcade.theme().collectible, 20);
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(null));
        cleared++;
        r++;
      }
    }
    if (cleared > 0) {
      lines += cleared;
      const pts = [0, 100, 300, 500, 800][cleared] * level;
      score += pts;
      spawnPopup(W / 2, H / 2, "+" + pts, Arcade.theme().collectible);
      Arcade.beep(500, 900, 0.15, "triangle", 0.13);
      const newLevel = Math.floor(lines / 10) + 1;
      if (newLevel !== level) { level = newLevel; spawnPopup(W / 2, H / 2 - 30, "LEVEL " + level, Arcade.theme().player); }
      Arcade.setHud("score", score);
      Arcade.setHud("lines", lines);
      Arcade.setHud("level", level);
    }

    cur = spawnPiece(next);
    next = randomType();
    if (!fits(cur)) { crash(); return; }
    dropTimer = dropInterval();
  }

  function onUpdate(dt) {
    if (gameOver) return;
    dropTimer -= dt;
    const interval = softDrop ? SOFT_INTERVAL : dropInterval();
    if (dropTimer <= 0) {
      if (tryMove(0, 1)) {
        if (softDrop) { score += 1; Arcade.setHud("score", score); }
      } else {
        lockPiece();
      }
      dropTimer = interval;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.life -= dt; p.y -= 20 * dt;
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

  function hardDrop() {
    if (gameOver) return;
    let n = 0;
    while (tryMove(0, 1)) n++;
    score += n * 2;
    Arcade.setHud("score", score);
    lockPiece();
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

    ctx.strokeStyle = retro ? "rgba(255,255,255,0.2)" : "rgba(232,230,255,0.06)"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= COLS; c++) { ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); }
    for (let r = 0; r <= ROWS; r++) { ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); }
    ctx.stroke();

    function cell(c, r, color, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha != null ? alpha : 1;
      ctx.fillStyle = color;
      ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      ctx.strokeStyle = retro ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      ctx.restore();
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) cell(c, r, typeColor(board[r][c]));
      }
    }

    if (!gameOver) {
      const gy = ghostY();
      cellsOf({ type: cur.type, rot: cur.rot, x: cur.x, y: gy }).forEach(function (p) {
        if (p[1] >= 0) cell(p[0], p[1], typeColor(cur.type), 0.2);
      });
      cellsOf(cur).forEach(function (p) {
        if (p[1] >= 0) cell(p[0], p[1], typeColor(cur.type));
      });
    }

    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    });
    ctx.save();
    ctx.font = "700 15px " + (retro ? "'Press Start 2P', monospace" : "'Orbitron', sans-serif");
    ctx.textAlign = "center";
    popups.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    });
    ctx.restore(); ctx.globalAlpha = 1;
    ctx.restore();
  }

  function onKeyDown(e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { e.preventDefault(); tryMove(-1, 0); }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { e.preventDefault(); tryMove(1, 0); }
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") { e.preventDefault(); tryRotate(); }
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") { softDrop = true; }
    if (e.key === " ") { e.preventDefault(); hardDrop(); }
  }
  function onKeyUp(e) {
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") { softDrop = false; }
  }

  let touchStartX = null, touchStartY = null, touchMoved = false;
  function onPointerDown(e) {
    if (e.cancelable) e.preventDefault();
    touchStartX = e.clientX; touchStartY = e.clientY; touchMoved = false;
  }
  function onPointerMove(e) {
    if (touchStartX == null) return;
    const dx = e.clientX - touchStartX;
    if (Math.abs(dx) > 28) {
      tryMove(dx > 0 ? 1 : -1, 0);
      touchStartX = e.clientX;
      touchMoved = true;
    }
  }
  function onPointerUp(e) {
    if (touchStartX == null) return;
    const dy = e.clientY - touchStartY;
    if (!touchMoved) {
      if (dy > 40) hardDrop(); else tryRotate();
    }
    touchStartX = null; touchStartY = null;
  }

  Arcade.registerGame({
    id: "blocks",
    name: "Neon Blocks",
    tagline: "Fallende Blöcke, volle Reihen",
    accent: "#ff2bd6",
    canvasW: W,
    canvasH: H,
    description: "Sortiere die fallenden Teile so, dass volle Reihen entstehen — sie verschwinden und bringen Punkte.<br>Je mehr Reihen auf einmal, desto mehr Punkte. Mit steigendem Level wird es schneller.",
    controlsHint: "Bewegen: ← → · Drehen: ↑ · Weich fallen: ↓ · Hart fallen: ␣ · Touch: Wischen/Tippen",
    startLabel: "Spiel starten",
    hud: [{ id: "score", label: "Score" }, { id: "best", label: "Best" }, { id: "lines", label: "Reihen" }, { id: "level", label: "Level" }],
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
