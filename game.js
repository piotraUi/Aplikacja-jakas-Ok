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

function getCharacterById(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}

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

  ctx.lineWidth = 2.5;
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
  ctx.beginPath();
  ctx.roundRect(-14, -12 + legOffset * 0.3, 8, 14, 3);
  ctx.fill();
  ctx.stroke();
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

function drawNameTag(ctx, name, x, y) {
  ctx.save();
  ctx.font = "bold 13px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  const w = ctx.measureText(name).width + 12;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 16, w, 20, 8);
  ctx.fill();
  ctx.fillStyle = "#234";
  ctx.fillText(name, x, y - 2);
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
const nameInput = document.getElementById("name-input");
const serverInput = document.getElementById("server-input");
const connStatus = document.getElementById("conn-status");
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

function defaultServerUrl() {
  const proto = location.protocol === "https:" ? "wss://" : "ws://";
  const host = location.hostname || "localhost";
  return `${proto}${host}:8080`;
}
serverInput.value = defaultServerUrl();
nameInput.value = "Gracz" + Math.floor(Math.random() * 900 + 100);

// ---------- Przełączanie ekranów ----------
const selectScreen = document.getElementById("select-screen");
const gameScreen = document.getElementById("game-screen");

function showScreen(screen) {
  [selectScreen, gameScreen].forEach((s) => s.classList.add("hidden"));
  screen.classList.remove("hidden");
}

// ---------- Sieć (multiplayer WebSocket) ----------
let ws = null;
let myId = null;
let myName = "";
const otherPlayers = new Map(); // id -> { name, character, worldX }
const localHighfiveCooldown = new Map(); // id -> timestamp do kiedy schowany przycisk

function updateConnLabel(text) {
  connStatus.textContent = text;
}

function updateOnlineLabel() {
  const label = document.getElementById("online-label");
  if (label) label.textContent = "Online: " + (otherPlayers.size + 1);
}

function connect(name, character) {
  return new Promise((resolve) => {
    const url = (serverInput.value || "").trim() || defaultServerUrl();
    let socket;
    try {
      socket = new WebSocket(url);
    } catch {
      updateConnLabel("⚠️ Nieprawidłowy adres serwera — gra solo");
      resolve(false);
      return;
    }

    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        updateConnLabel("⚠️ Brak odpowiedzi serwera — gra solo");
        try { socket.close(); } catch {}
        resolve(false);
      }
    }, 4000);

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "join", name, character: character.id }));
    });

    socket.addEventListener("message", (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === "welcome") {
        myId = msg.id;
        otherPlayers.clear();
        for (const p of msg.players) {
          otherPlayers.set(p.id, { name: p.name, character: p.character, worldX: p.worldX });
        }
        updateOnlineLabel();
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          updateConnLabel("✅ Połączono z serwerem");
          resolve(true);
        }
        return;
      }
      handleServerMessage(msg);
    });

    socket.addEventListener("close", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        updateConnLabel("⚠️ Nie udało się połączyć — gra solo");
        resolve(false);
      }
    });

    socket.addEventListener("error", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        updateConnLabel("⚠️ Błąd połączenia — gra solo");
        resolve(false);
      }
    });

    ws = socket;
  });
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case "joined":
      otherPlayers.set(msg.id, { name: msg.name, character: msg.character, worldX: msg.worldX });
      updateOnlineLabel();
      break;
    case "left":
      otherPlayers.delete(msg.id);
      updateOnlineLabel();
      break;
    case "move": {
      const p = otherPlayers.get(msg.id);
      if (p) p.worldX = msg.worldX;
      break;
    }
    case "highfived":
      if (msg.a === myId || msg.b === myId) {
        const otherName = msg.a === myId ? msg.bName : msg.aName;
        onHighfived(otherName);
      }
      break;
  }
}

function disconnect() {
  if (ws) {
    try { ws.close(); } catch {}
  }
  ws = null;
  myId = null;
  otherPlayers.clear();
}

startBtn.addEventListener("click", async () => {
  if (!selectedCharacter) return;
  startBtn.disabled = true;
  myName = (nameInput.value || "Gracz").trim().slice(0, 16) || "Gracz";
  updateConnLabel("🔌 Łączenie...");
  await connect(myName, selectedCharacter);
  showScreen(gameScreen);
  startBtn.disabled = false;
  startGame(selectedCharacter);
});

document.getElementById("leave-btn").addEventListener("click", () => {
  stopGame();
  disconnect();
  updateConnLabel("🔌 Niepołączono");
  showScreen(selectScreen);
});

// ---------- Gra ----------
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const scoreLabel = document.getElementById("score-label");
const highfiveBtn = document.getElementById("highfive-btn");
const highfiveToast = document.getElementById("highfive-toast");
const stumbleToast = document.getElementById("stumble-toast");
const gameWrap = document.getElementById("game-wrap");

const GROUND_Y = 250;
const HIGHFIVE_RANGE = 90;

let state = null;
let rafId = null;

function flashToast(el, text) {
  el.textContent = text;
  el.classList.remove("hidden");
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.add("hidden"), 1600);
}

function onHighfived(otherName) {
  if (state) state.score += 100;
  flashToast(highfiveToast, `🖐 Ty i ${otherName} przybiliście piątkę! +100`);
}

function startGame(dino) {
  state = {
    dino,
    y: 0,
    vy: 0,
    onGround: true,
    legPhase: 0,
    speed: 5 * dino.speedMul,
    worldX: 0,
    stumbleTimer: 0,
    obstacles: [],
    eggs: [],
    spawnTimer: 60,
    eggTimer: 140,
    score: 0,
    blinkTimer: 0,
    blink: false,
    running: true,
    lastMoveSent: 0,
    highfiveTargetId: null,
  };
  updateOnlineLabel();
  if (rafId) cancelAnimationFrame(rafId);
  loop();
}

function stopGame() {
  if (state) state.running = false;
  if (rafId) cancelAnimationFrame(rafId);
  highfiveBtn.classList.add("hidden");
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

highfiveBtn.addEventListener("click", () => {
  const targetId = state && state.highfiveTargetId;
  if (!targetId) return;
  localHighfiveCooldown.set(targetId, Date.now() + 5000);
  highfiveBtn.classList.add("hidden");
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "highfive", targetId }));
  }
});

function spawnObstacle() {
  const kinds = [
    { w: 18, h: 30, color: "#7a8b6d" },
    { w: 26, h: 22, color: "#8b7a6d" },
  ];
  const k = kinds[Math.floor(Math.random() * kinds.length)];
  state.obstacles.push({ x: canvas.width + 20, w: k.w, h: k.h, color: k.color, hit: false });
}

function spawnEgg() {
  state.eggs.push({ x: canvas.width + 20, y: GROUND_Y - 70 - Math.random() * 40, collected: false });
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function triggerStumble() {
  const s = state;
  s.stumbleTimer = 45;
  s.worldX = Math.max(0, s.worldX - 40);
  s.score = Math.max(0, s.score - 10);
  flashToast(stumbleToast, "🐾 Potknięcie! -10");
}

function update() {
  const s = state;
  s.speed = Math.min(s.speed + 0.0025, 11 * s.dino.speedMul);
  const effSpeed = s.stumbleTimer > 0 ? s.speed * 0.35 : s.speed;
  if (s.stumbleTimer > 0) s.stumbleTimer--;

  s.legPhase += 0.28 * (s.onGround ? 1 : 0.4);
  s.worldX += effSpeed;

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
    ob.x -= effSpeed;
    if (!ob.hit && rectsOverlap(dinoBoxX, dinoBoxY, dinoW - 14, dinoH, ob.x, GROUND_Y - ob.h, ob.w, ob.h)) {
      ob.hit = true;
      triggerStumble();
    }
  }
  s.obstacles = s.obstacles.filter((o) => o.x + o.w > -10);

  // jajka
  for (const egg of s.eggs) {
    egg.x -= effSpeed;
    if (!egg.collected && rectsOverlap(dinoBoxX, dinoBoxY, dinoW - 14, dinoH, egg.x, egg.y, 18, 18)) {
      egg.collected = true;
      s.score += 50;
    }
  }
  s.eggs = s.eggs.filter((e) => e.x > -20 && !e.collected);

  s.score += 0.15;
  scoreLabel.textContent = "Wynik: " + Math.floor(s.score);

  // wysyłanie pozycji do serwera
  const now = performance.now();
  if (ws && ws.readyState === WebSocket.OPEN && now - s.lastMoveSent > 120) {
    s.lastMoveSent = now;
    ws.send(JSON.stringify({ type: "move", worldX: s.worldX }));
  }

  updateHighfiveTarget();
}

function updateHighfiveTarget() {
  const s = state;
  let bestId = null;
  let bestDiff = Infinity;
  const now = Date.now();

  for (const [id, p] of otherPlayers) {
    const diff = p.worldX - s.worldX;
    const cooldownUntil = localHighfiveCooldown.get(id) || 0;
    if (diff > 0 && diff <= HIGHFIVE_RANGE && now >= cooldownUntil && diff < bestDiff) {
      bestDiff = diff;
      bestId = id;
    }
  }

  s.highfiveTargetId = bestId;

  if (!bestId) {
    highfiveBtn.classList.add("hidden");
    return;
  }

  const target = otherPlayers.get(bestId);
  const targetDino = getCharacterById(target.character);
  const screenX = 90 + bestDiff;
  const headY = GROUND_Y - 78 * targetDino.scale;
  const scaleX = canvas.clientWidth / canvas.width;
  const scaleY = canvas.clientHeight / canvas.height;

  highfiveBtn.style.left = canvas.offsetLeft + screenX * scaleX + "px";
  highfiveBtn.style.top = canvas.offsetTop + headY * scaleY + "px";
  highfiveBtn.classList.remove("hidden");
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

  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  grad.addColorStop(0, "#cdeeff");
  grad.addColorStop(1, "#f2fff2");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, GROUND_Y);

  drawGround();

  for (const ob of s.obstacles) drawObstacle(ob);
  for (const egg of s.eggs) drawEgg(egg);

  // inni gracze (bez skoku, tylko animacja biegu, na podstawie różnicy pozycji w świecie)
  const t = performance.now() / 160;
  for (const [, p] of otherPlayers) {
    const diff = p.worldX - s.worldX;
    const screenX = 90 + diff;
    if (screenX < -60 || screenX > canvas.width + 60) continue;
    const otherDino = getCharacterById(p.character);
    drawDino(ctx, otherDino, screenX, GROUND_Y, t, false);
    drawNameTag(ctx, p.name, screenX, GROUND_Y - 78 * otherDino.scale - 12);
  }

  drawDino(ctx, s.dino, 90, GROUND_Y + s.y, s.legPhase, s.blink);
}

function loop() {
  if (!state || !state.running) return;
  update();
  render();
  rafId = requestAnimationFrame(loop);
}
