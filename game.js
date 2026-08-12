"use strict";

// ---------- Postacie dinozaurów ----------
const CHARACTERS = [
  {
    id: "piotrusia",
    name: "Piotrusia",
    color: "#5fc26b",
    belly: "#d9ffe0",
    earSize: 0,
    hasBow: true,
    bowColor: "#ff6ec7",
    scale: 1.0,
    desc: "Zwinna i skoczna",
    jumpPower: -9.5,
    speedMul: 1.0,
  },
  {
    id: "bartusia",
    name: "Bartusia",
    color: "#3fa9c9",
    belly: "#daffff",
    earSize: 0,
    hasBow: true,
    bowColor: "#ffd23f",
    scale: 1.0,
    desc: "Szybka biegaczka",
    jumpPower: -9,
    speedMul: 1.1,
  },
  {
    id: "alan",
    name: "Alan",
    color: "#2b2b2b",
    belly: "#5a5a5a",
    earSize: 0,
    hasBow: false,
    scale: 1.05,
    desc: "Czarny i tajemniczy",
    jumpPower: -10,
    speedMul: 1.0,
  },
  {
    id: "daniel",
    name: "Daniel",
    color: "#f5f5f5",
    belly: "#ffffff",
    earSize: 22,
    hasBow: false,
    scale: 1.45,
    desc: "Wielki, białe uszy",
    jumpPower: -8.5,
    speedMul: 0.9,
    outline: "#ccc",
  },
];

// ---------- Rysowanie dinozaura ----------
// Rysuje dinozaura tak, że stopy stoją na y=0, patrzy w prawo.
function drawDino(ctx, dino, x, y, legPhase, blink) {
  const s = dino.scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);

  const bodyColor = dino.color;
  const bellyColor = dino.belly;
  const outline = dino.outline || "#1a1a1a";

  ctx.lineWidth = 2.5 / s * s; // keep visually consistent
  ctx.strokeStyle = outline;

  // Ogon
  ctx.beginPath();
  ctx.moveTo(-18, -18);
  ctx.quadraticCurveTo(-42, -8, -46, -26);
  ctx.quadraticCurveTo(-30, -22, -18, -30);
  ctx.closePath();
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.stroke();

  // Nogi (animacja biegu)
  const legOffset = Math.sin(legPhase) * 6;
  ctx.fillStyle = bodyColor;
  // noga tylna
  ctx.beginPath();
  ctx.roundRect(-14, -12 + legOffset * 0.3, 8, 14, 3);
  ctx.fill();
  ctx.stroke();
  // noga przednia
  ctx.beginPath();
  ctx.roundRect(4, -12 - legOffset * 0.3, 8, 14, 3);
  ctx.fill();
  ctx.stroke();

  // Tułów
  ctx.beginPath();
  ctx.ellipse(-4, -32, 26, 20, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.stroke();

  // Brzuszek
  ctx.beginPath();
  ctx.ellipse(-4, -24, 16, 11, 0, 0, Math.PI * 2);
  ctx.fillStyle = bellyColor;
  ctx.fill();

  // Głowa
  ctx.beginPath();
  ctx.ellipse(20, -46, 15, 13, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.stroke();

  // Pyszczek
  ctx.beginPath();
  ctx.ellipse(32, -42, 8, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.stroke();

  // Uszy (duże tylko u Daniela)
  if (dino.earSize > 0) {
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(14, -58, dino.earSize * 0.55, dino.earSize, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(26, -58, dino.earSize * 0.55, dino.earSize, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // wnętrze uszu
    ctx.fillStyle = "#ffd6d6";
    ctx.beginPath();
    ctx.ellipse(14, -56, dino.earSize * 0.28, dino.earSize * 0.6, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(26, -56, dino.earSize * 0.28, dino.earSize * 0.6, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Grzbiet - kolce
  ctx.fillStyle = bodyColor;
  for (const dx of [-16, -6, 4, 12]) {
    ctx.beginPath();
    ctx.moveTo(dx, -48);
    ctx.lineTo(dx + 4, -58);
    ctx.lineTo(dx + 8, -48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Oko
  ctx.fillStyle = "#1a1a1a";
  if (!blink) {
    ctx.beginPath();
    ctx.ellipse(26, -47, 2.2, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(23.5, -47);
    ctx.lineTo(28.5, -47);
    ctx.stroke();
  }

  // Kokardka (dziewczynki)
  if (dino.hasBow) {
    ctx.fillStyle = dino.bowColor;
    ctx.beginPath();
    ctx.moveTo(8, -60);
    ctx.lineTo(0, -66);
    ctx.lineTo(0, -54);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, -60);
    ctx.lineTo(16, -66);
    ctx.lineTo(16, -54);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, -60, 3, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// Podglądy w ekranie wyboru
function renderPreview(canvas, dino) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawDino(ctx, dino, canvas.width / 2 - 10, canvas.height - 20, 0, false);
}

// ---------- Ekran wyboru postaci ----------
const grid = document.getElementById("character-grid");
const startBtn = document.getElementById("start-btn");
let selectedCharacter = null;

CHARACTERS.forEach((dino) => {
  const card = document.createElement("div");
  card.className = "char-card";
  card.innerHTML = `
    <canvas width="120" height="110"></canvas>
    <div class="name">${dino.name}</div>
    <div class="desc">${dino.desc}</div>
  `;
  const canvas = card.querySelector("canvas");
  renderPreview(canvas, dino);

  card.addEventListener("click", () => {
    document.querySelectorAll(".char-card").forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    selectedCharacter = dino;
    startBtn.disabled = false;
  });

  grid.appendChild(card);
});

// ---------- Przełączanie ekranów ----------
const selectScreen = document.getElementById("select-screen");
const gameScreen = document.getElementById("game-screen");
const gameoverScreen = document.getElementById("gameover-screen");

function showScreen(screen) {
  [selectScreen, gameScreen, gameoverScreen].forEach((s) => s.classList.add("hidden"));
  screen.classList.remove("hidden");
}

startBtn.addEventListener("click", () => {
  if (!selectedCharacter) return;
  showScreen(gameScreen);
  startGame(selectedCharacter);
});

document.getElementById("retry-btn").addEventListener("click", () => {
  showScreen(gameScreen);
  startGame(selectedCharacter);
});

document.getElementById("change-btn").addEventListener("click", () => {
  showScreen(selectScreen);
});

// ---------- Gra ----------
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const scoreLabel = document.getElementById("score-label");
const bestLabel = document.getElementById("best-label");
const finalScoreEl = document.getElementById("final-score");

const GROUND_Y = 250;
let bestScore = Number(localStorage.getItem("dinoBiegRekord") || 0);
bestLabel.textContent = "Rekord: " + bestScore;

let state = null;
let rafId = null;

function startGame(dino) {
  state = {
    dino,
    y: 0,
    vy: 0,
    onGround: true,
    legPhase: 0,
    speed: 5 * dino.speedMul,
    obstacles: [],
    eggs: [],
    spawnTimer: 60,
    eggTimer: 140,
    score: 0,
    blinkTimer: 0,
    blink: false,
    running: true,
  };
  finalScoreEl.textContent = "";
  if (rafId) cancelAnimationFrame(rafId);
  loop();
}

function jump() {
  if (!state || !state.running) return;
  if (state.onGround) {
    state.vy = state.dino.jumpPower;
    state.onGround = false;
  }
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    jump();
  }
});
canvas.addEventListener("pointerdown", jump);

function spawnObstacle() {
  const kinds = [
    { w: 18, h: 30, color: "#7a8b6d" },
    { w: 26, h: 22, color: "#8b7a6d" },
  ];
  const k = kinds[Math.floor(Math.random() * kinds.length)];
  state.obstacles.push({ x: canvas.width + 20, w: k.w, h: k.h, color: k.color });
}

function spawnEgg() {
  state.eggs.push({ x: canvas.width + 20, y: GROUND_Y - 70 - Math.random() * 40, collected: false });
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function update() {
  const s = state;
  s.speed += 0.0025; // stopniowe przyspieszanie
  s.legPhase += 0.28 * (s.onGround ? 1 : 0.4);

  // fizyka skoku
  s.vy += 0.55;
  s.y += s.vy;
  if (s.y >= 0) {
    s.y = 0;
    s.vy = 0;
    s.onGround = true;
  }

  // mrugnięcie
  s.blinkTimer++;
  if (s.blinkTimer > 90) {
    s.blink = true;
    if (s.blinkTimer > 96) {
      s.blink = false;
      s.blinkTimer = 0;
    }
  }

  // spawn przeszkód
  s.spawnTimer--;
  if (s.spawnTimer <= 0) {
    spawnObstacle();
    s.spawnTimer = Math.max(45, 90 - s.speed * 4);
  }
  s.eggTimer--;
  if (s.eggTimer <= 0) {
    spawnEgg();
    s.eggTimer = 160 + Math.random() * 80;
  }

  const dinoScale = s.dino.scale;
  const dinoX = 90;
  const dinoW = 46 * dinoScale;
  const dinoH = 62 * dinoScale;
  const dinoBoxX = dinoX - dinoW / 2 + 8;
  const dinoBoxY = GROUND_Y + s.y - dinoH;

  // przeszkody
  for (const ob of s.obstacles) {
    ob.x -= s.speed;
    if (rectsOverlap(dinoBoxX, dinoBoxY, dinoW - 14, dinoH, ob.x, GROUND_Y - ob.h, ob.w, ob.h)) {
      gameOver();
      return;
    }
  }
  s.obstacles = s.obstacles.filter((o) => o.x + o.w > -10);

  // jajka
  for (const egg of s.eggs) {
    egg.x -= s.speed;
    if (!egg.collected && rectsOverlap(dinoBoxX, dinoBoxY, dinoW - 14, dinoH, egg.x, egg.y, 18, 18)) {
      egg.collected = true;
      s.score += 50;
    }
  }
  s.eggs = s.eggs.filter((e) => e.x > -20 && !e.collected);

  s.score += 0.15;
  scoreLabel.textContent = "Wynik: " + Math.floor(s.score);
}

function drawGround() {
  ctx.fillStyle = "#cdeecb";
  ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
  ctx.strokeStyle = "#9fcf9a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(canvas.width, GROUND_Y);
  ctx.stroke();
}

function drawObstacle(ob) {
  ctx.fillStyle = ob.color;
  ctx.beginPath();
  ctx.moveTo(ob.x, GROUND_Y);
  ctx.lineTo(ob.x + ob.w / 2, GROUND_Y - ob.h);
  ctx.lineTo(ob.x + ob.w, GROUND_Y);
  ctx.closePath();
  ctx.fill();
}

function drawEgg(egg) {
  ctx.fillStyle = "#ffe082";
  ctx.strokeStyle = "#e0a800";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(egg.x + 9, egg.y + 9, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function render() {
  const s = state;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // niebo
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  grad.addColorStop(0, "#cdeeff");
  grad.addColorStop(1, "#f2fff2");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, GROUND_Y);

  drawGround();

  for (const ob of s.obstacles) drawObstacle(ob);
  for (const egg of s.eggs) drawEgg(egg);

  drawDino(ctx, s.dino, 90, GROUND_Y + s.y, s.legPhase, s.blink);
}

function loop() {
  if (!state.running) return;
  update();
  if (state.running) {
    render();
    rafId = requestAnimationFrame(loop);
  }
}

function gameOver() {
  state.running = false;
  const finalScore = Math.floor(state.score);
  if (finalScore > bestScore) {
    bestScore = finalScore;
    localStorage.setItem("dinoBiegRekord", String(bestScore));
    bestLabel.textContent = "Rekord: " + bestScore;
  }
  finalScoreEl.textContent = `${state.dino.name} zdobył(a) ${finalScore} punktów!`;
  showScreen(gameoverScreen);
}
