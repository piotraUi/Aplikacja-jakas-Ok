"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

// Serwuje statyczne pliki gry (index.html/style.css/game.js) i obsługuje
// WebSocket na tym samym serwerze HTTP, żeby całość dało się wdrożyć jako
// jedną usługę na hostingu.
const server = http.createServer((req, res) => {
  const reqPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const filePath = path.join(PUBLIC_DIR, path.normalize(reqPath).replace(/^(\.\.[/\\])+/, ""));
  const ext = path.extname(filePath);

  if (!MIME_TYPES[ext]) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

const PROXIMITY = 90; // maks. odległość (w px świata) uznawana za "od tyłu"
const HIGHFIVE_COOLDOWN_MS = 5000;

const players = new Map(); // id -> { id, name, character, worldX, ws }
const highfiveCooldowns = new Map(); // "id1|id2" -> timestamp ostatniego przybicia

let nextId = 1;

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function send(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function broadcast(obj, exceptId) {
  for (const p of players.values()) {
    if (p.id === exceptId) continue;
    send(p.ws, obj);
  }
}

wss.on("connection", (ws) => {
  const id = String(nextId++);
  let player = null;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "join") {
      const name = String(msg.name || "Gracz").slice(0, 16) || "Gracz";
      const character = String(msg.character || "piotrusia").slice(0, 20);
      player = { id, name, character, worldX: 0, ws };
      players.set(id, player);

      send(ws, {
        type: "welcome",
        id,
        players: [...players.values()]
          .filter((p) => p.id !== id)
          .map((p) => ({ id: p.id, name: p.name, character: p.character, worldX: p.worldX })),
      });

      broadcast({ type: "joined", id, name, character, worldX: 0 }, id);
      return;
    }

    if (!player) return;

    if (msg.type === "move") {
      const worldX = Number(msg.worldX);
      if (Number.isFinite(worldX)) {
        player.worldX = worldX;
        broadcast({ type: "move", id, worldX: player.worldX }, id);
      }
      return;
    }

    if (msg.type === "highfive") {
      const targetId = String(msg.targetId || "");
      const target = players.get(targetId);
      if (!target || targetId === id) return;

      const dist = Math.abs(target.worldX - player.worldX);
      if (dist > PROXIMITY) return; // serwer potwierdza bliskość

      const key = pairKey(id, targetId);
      const now = Date.now();
      const last = highfiveCooldowns.get(key) || 0;
      if (now - last < HIGHFIVE_COOLDOWN_MS) return;
      highfiveCooldowns.set(key, now);

      const payload = { type: "highfived", a: id, b: targetId, aName: player.name, bName: target.name };
      send(player.ws, payload);
      send(target.ws, payload);
      return;
    }
  });

  ws.on("close", () => {
    if (player) {
      players.delete(id);
      broadcast({ type: "left", id });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Serwer Dino Bieg (multiplayer) działa na porcie ${PORT}`);
});
