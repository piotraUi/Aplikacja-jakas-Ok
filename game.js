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
    outline: "#ccc",
  },
];

function getCharacterById(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}

// ---------- Rysowanie dinozaura ----------
// Rysuje dinozaura tak, że stopy stoją na y=0. dir=1 patrzy w prawo, dir=-1 w lewo.
function drawDino(ctx, dino, x, y, legPhase, blink, dir) {
  const s = dino.scale;
  const facing = dir || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * facing, s);

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

  // Nogi (animacja chodu)
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

// Bąbelek czatu/emotki nad głową
function drawBubble(ctx, text, x, y, big) {
  ctx.save();
  ctx.font = big ? "22px 'Segoe UI', sans-serif" : "13px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  const w = Math.min(ctx.measureText(text).width + 20, 220);
  const h = big ? 34 : 22;
  const bx = x - w / 2;
  const by = y - h;

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#cfd8e3";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, 10);
  ctx.fill();
  ctx.stroke();

  // ogonek bąbelka
  ctx.beginPath();
  ctx.moveTo(x - 6, by + h);
  ctx.lineTo(x + 6, by + h);
  ctx.lineTo(x, by + h + 8);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.fillStyle = "#234";
  ctx.fillText(text, x, by + h / 2 + (big ? 7 : 4), w - 10);
  ctx.restore();
}

// Podglądy w ekranie wyboru
function renderPreview(canvas, dino) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawDino(ctx, dino, canvas.width / 2 - 10, canvas.height - 20, 0, false, 1);
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
  // Serwer serwuje statyczne pliki i WebSocket na tym samym porcie, więc
  // domyślnie łączymy się z tym samym źródłem, z którego wczytano stronę.
  if (location.protocol === "http:" || location.protocol === "https:") {
    const proto = location.protocol === "https:" ? "wss://" : "ws://";
    return `${proto}${location.host}`;
  }
  return "ws://localhost:8080";
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
const otherPlayers = new Map(); // id -> { name, character, x, y, dir, bubble }
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
        if (state) {
          state.x = msg.x;
          state.y = msg.y;
        }
        otherPlayers.clear();
        for (const p of msg.players) {
          otherPlayers.set(p.id, { name: p.name, character: p.character, x: p.x, y: p.y, dir: p.dir, bubble: null });
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
      otherPlayers.set(msg.id, { name: msg.name, character: msg.character, x: msg.x, y: msg.y, dir: msg.dir, bubble: null });
      updateOnlineLabel();
      break;
    case "left":
      otherPlayers.delete(msg.id);
      updateOnlineLabel();
      break;
    case "move": {
      const p = otherPlayers.get(msg.id);
      if (p) {
        p.x = msg.x;
        p.y = msg.y;
        p.dir = msg.dir;
      }
      break;
    }
    case "chat": {
      addChatLine(msg.id === myId ? myName : msg.name, msg.text);
      const p = msg.id === myId ? null : otherPlayers.get(msg.id);
      const bubble = { text: msg.text, big: false, expiresAt: performance.now() + 4000 };
      if (p) p.bubble = bubble;
      else if (msg.id === myId && state) state.bubble = bubble;
      break;
    }
    case "emote": {
      const p = msg.id === myId ? null : otherPlayers.get(msg.id);
      const bubble = { text: msg.emoji, big: true, expiresAt: performance.now() + 2200 };
      if (p) p.bubble = bubble;
      else if (msg.id === myId && state) state.bubble = bubble;
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
  startGame(selectedCharacter);
  await connect(myName, selectedCharacter);
  showScreen(gameScreen);
  startBtn.disabled = false;
});

document.getElementById("leave-btn").addEventListener("click", () => {
  stopGame();
  disconnect();
  updateConnLabel("🔌 Niepołączono");
  showScreen(selectScreen);
});

// ---------- Gra (swobodne chodzenie + interakcje społeczne) ----------
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const heartsLabel = document.getElementById("hearts-label");
const highfiveBtn = document.getElementById("highfive-btn");
const highfiveToast = document.getElementById("highfive-toast");
const chatLog = document.getElementById("chat-log");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");

const GROUND_TOP = 150;
const GROUND_BOTTOM = 390;
const X_MIN = 40;
const X_MAX = 860;
const MOVE_SPEED = 3.2;
const HIGHFIVE_RANGE = 70;

let heartsCount = 0;
let state = null;
let rafId = null;
const keys = new Set();

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
  heartsCount++;
  heartsLabel.textContent = "🤝 Przybite piątki: " + heartsCount;
  flashToast(highfiveToast, `🖐 Ty i ${otherName} przybiliście piątkę!`);
}

function addChatLine(name, text) {
  const line = document.createElement("div");
  line.className = "chat-line";
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = name + ": ";
  line.appendChild(who);
  line.appendChild(document.createTextNode(text));
  chatLog.appendChild(line);
  while (chatLog.children.length > 60) chatLog.removeChild(chatLog.firstChild);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function startGame(dino) {
  state = {
    dino,
    x: 450,
    y: 260,
    dir: 1,
    moving: false,
    legPhase: 0,
    blinkTimer: 0,
    blink: false,
    running: true,
    lastMoveSent: 0,
    lastSentX: null,
    lastSentY: null,
    highfiveTargetId: null,
    bubble: null,
  };
  chatLog.innerHTML = "";
  heartsCount = 0;
  heartsLabel.textContent = "🤝 Przybite piątki: 0";
  updateOnlineLabel();
  if (rafId) cancelAnimationFrame(rafId);
  loop();
}

function stopGame() {
  if (state) state.running = false;
  if (rafId) cancelAnimationFrame(rafId);
  highfiveBtn.classList.add("hidden");
}

const MOVE_KEYS = new Set([
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "KeyW", "KeyA", "KeyS", "KeyD",
]);

window.addEventListener("keydown", (e) => {
  if (document.activeElement === chatInput) return;
  if (MOVE_KEYS.has(e.code)) {
    e.preventDefault();
    keys.add(e.code);
  } else if (e.code === "Space") {
    e.preventDefault();
    sendEmote("👋");
  }
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
});

document.querySelectorAll(".emote-btn").forEach((btn) => {
  btn.addEventListener("click", () => sendEmote(btn.dataset.emoji));
});

function sendEmote(emoji) {
  if (!state || !state.running) return;
  state.bubble = { text: emoji, big: true, expiresAt: performance.now() + 2200 };
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "emote", emoji }));
  }
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = chatInput.value.trim().slice(0, 140);
  chatInput.value = "";
  if (!text || !state) return;
  state.bubble = { text, big: false, expiresAt: performance.now() + 4000 };
  if (ws && ws.readyState === WebSocket.OPEN) {
    // serwer odeśle tę wiadomość również do nadawcy (handleServerMessage doda ją do logu)
    ws.send(JSON.stringify({ type: "chat", text }));
  } else {
    addChatLine(myName, text);
  }
});

highfiveBtn.addEventListener("click", () => {
  const targetId = state && state.highfiveTargetId;
  if (!targetId) return;
  localHighfiveCooldown.set(targetId, Date.now() + 5000);
  highfiveBtn.classList.add("hidden");
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "highfive", targetId }));
  }
});

function update() {
  const s = state;

  let vx = 0;
  let vy = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) vx -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) vx += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) vy -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) vy += 1;

  s.moving = vx !== 0 || vy !== 0;
  if (s.moving) {
    const len = Math.hypot(vx, vy) || 1;
    s.x += (vx / len) * MOVE_SPEED;
    s.y += (vy / len) * MOVE_SPEED;
    s.x = Math.min(X_MAX, Math.max(X_MIN, s.x));
    s.y = Math.min(GROUND_BOTTOM, Math.max(GROUND_TOP, s.y));
    if (vx > 0) s.dir = 1;
    else if (vx < 0) s.dir = -1;
    s.legPhase += 0.28;
  }

  s.blinkTimer++;
  if (s.blinkTimer > 90) {
    s.blink = true;
    if (s.blinkTimer > 96) {
      s.blink = false;
      s.blinkTimer = 0;
    }
  }

  if (s.bubble && performance.now() > s.bubble.expiresAt) s.bubble = null;
  for (const p of otherPlayers.values()) {
    if (p.bubble && performance.now() > p.bubble.expiresAt) p.bubble = null;
  }

  const now = performance.now();
  if (
    ws && ws.readyState === WebSocket.OPEN &&
    now - s.lastMoveSent > 90 &&
    (s.lastSentX !== s.x || s.lastSentY !== s.y)
  ) {
    s.lastMoveSent = now;
    s.lastSentX = s.x;
    s.lastSentY = s.y;
    ws.send(JSON.stringify({ type: "move", x: s.x, y: s.y, dir: s.dir }));
  }

  updateHighfiveTarget();
}

function updateHighfiveTarget() {
  const s = state;
  let bestId = null;
  let bestDist = Infinity;
  const now = Date.now();

  for (const [id, p] of otherPlayers) {
    const dist = Math.hypot(p.x - s.x, p.y - s.y);
    const cooldownUntil = localHighfiveCooldown.get(id) || 0;
    if (dist <= HIGHFIVE_RANGE && now >= cooldownUntil && dist < bestDist) {
      bestDist = dist;
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
  const headY = target.y - 78 * targetDino.scale;
  const scaleX = canvas.clientWidth / canvas.width;
  const scaleY = canvas.clientHeight / canvas.height;

  highfiveBtn.style.left = canvas.offsetLeft + target.x * scaleX + "px";
  highfiveBtn.style.top = canvas.offsetTop + headY * scaleY + "px";
  highfiveBtn.classList.remove("hidden");
}

function drawScene() {
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_TOP + 20);
  grad.addColorStop(0, "#cdeeff");
  grad.addColorStop(1, "#eafff2");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, GROUND_TOP + 20);

  const groundGrad = ctx.createLinearGradient(0, GROUND_TOP, 0, canvas.height);
  groundGrad.addColorStop(0, "#cdeecb");
  groundGrad.addColorStop(1, "#aee0a8");
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, GROUND_TOP, canvas.width, canvas.height - GROUND_TOP);

  ctx.strokeStyle = "#9fcf9a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_TOP);
  ctx.lineTo(canvas.width, GROUND_TOP);
  ctx.stroke();
}

function render() {
  const s = state;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawScene();

  const all = [{ x: s.x, y: s.y, dino: s.dino, dir: s.dir, name: myName, bubble: s.bubble, legPhase: s.legPhase, blink: s.blink, isSelf: true }];
  const t = performance.now() / 160;
  for (const p of otherPlayers.values()) {
    all.push({
      x: p.x, y: p.y, dino: getCharacterById(p.character), dir: p.dir,
      name: p.name, bubble: p.bubble, legPhase: t, blink: false, isSelf: false,
    });
  }
  all.sort((a, b) => a.y - b.y);

  for (const pl of all) {
    drawDino(ctx, pl.dino, pl.x, pl.y, pl.legPhase, pl.blink, pl.dir);
    drawNameTag(ctx, pl.name, pl.x, pl.y - 78 * pl.dino.scale - 12);
    if (pl.bubble) drawBubble(ctx, pl.bubble.text, pl.x, pl.y - 78 * pl.dino.scale - 34, pl.bubble.big);
  }
}

function loop() {
  if (!state || !state.running) return;
  update();
  render();
  rafId = requestAnimationFrame(loop);
}
