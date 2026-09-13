import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ── Load .env ──────────────────────────────────────────────────────────────
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?s*$/);
      if (match) {
        let value = match[2] || '';
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[match[1]]) process.env[match[1]] = value.trim();
      }
    });
  }
} catch (_) {}

// ── Constants ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const WORLD_FILE = path.join(DATA_DIR, 'world.json');
const INV_FILE   = path.join(DATA_DIR, 'inventories.json');

// ── Ensure data/ directory exists ─────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Helpers ────────────────────────────────────────────────────────────────
function readJSON(file, fallback = {}) {
  try {
    const raw = fs.readFileSync(file, 'utf8').trim();
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/** Deterministic avatar colors derived from email hash — same email = same look */
function colorsFromEmail(email) {
  const h = sha256(email);
  const shirts = [0x00b4d8, 0xef4444, 0x10b981, 0x8b5cf6, 0xf59e0b, 0xec4899, 0x3b82f6, 0x14b8a6, 0x6366f1];
  const pants  = [0x3f51b5, 0x1e293b, 0x475569, 0x7c2d12, 0x064e3b, 0x581c87, 0x1e1b4b];
  const skin   = [0xe5b799, 0xf5d0b5, 0xd4a373, 0x8d5524, 0xc68642, 0xe0ac69, 0xffdbac];
  const hair   = [0x3e2723, 0x1a1a1a, 0x78350f, 0xca8a04, 0xb45309, 0x451a03];
  const n = (hex, arr) => arr[parseInt(hex, 16) % arr.length];
  return {
    shirt: n(h.slice(0, 4), shirts),
    pants: n(h.slice(4, 8), pants),
    skin:  n(h.slice(8, 12), skin),
    hair:  n(h.slice(12, 16), hair)
  };
}

// ── Load persistent data ───────────────────────────────────────────────────
const users      = readJSON(USERS_FILE, {});          // { [email]: { username, passwordHash, colors, createdAt } }
const inventories = readJSON(INV_FILE, {});           // { [email]: { slots, playerHp } }

const worldRaw   = readJSON(WORLD_FILE, { trees: [], drops: [], placedBlocks: [] });
const worldState = {
  trees:        new Map(worldRaw.trees.map(t => [`${Math.round(t.x * 10) / 10}_${Math.round(t.z * 10) / 10}`, t])),
  drops:        new Map(worldRaw.drops.map(d => [d.dropId, d])),
  placedBlocks: worldRaw.placedBlocks || []
};

console.log(`[STORAGE] Directory: ${DATA_DIR}`);
console.log(`[STORAGE] Loaded ${Object.keys(users).length} user account(s).`);
console.log(`[STORAGE] Loaded ${Object.keys(inventories).length} saved inventory(ies).`);
console.log(`[STORAGE] Loaded world state: ${worldState.trees.size} trees, ${worldState.drops.size} drops, ${worldState.placedBlocks.length} placed block(s).`);

let saveWorldTimer = null;
function scheduleSaveWorld() {
  if (saveWorldTimer) clearTimeout(saveWorldTimer);
  saveWorldTimer = setTimeout(() => {
    writeJSON(WORLD_FILE, {
      trees:        Array.from(worldState.trees.values()),
      drops:        Array.from(worldState.drops.values()),
      placedBlocks: worldState.placedBlocks
    });
    console.log('[SAVE] World state saved to disk.');
  }, 2000);
}

function saveInventoryForEmail(email, slots, playerHp) {
  if (!email) return;
  inventories[email] = { slots, playerHp: playerHp ?? 100 };
  writeJSON(INV_FILE, inventories);
}

// ── Runtime players map ────────────────────────────────────────────────────
const players = new Map(); // playerId -> { ws, data, email }

// ── WebSocket Server ───────────────────────────────────────────────────────
const wss = new WebSocketServer({ port: PORT });
console.log(`[SERVER] Game Server running on port ${PORT}`);

wss.on('connection', ws => {
  let playerId = null;
  let playerEmail = null;

  ws.on('message', raw => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch (_) { return; }

    // ── AUTH: Register ───────────────────────────────────────────────────
    if (data.type === 'register') {
      const { email, username, password } = data;

      if (!email || !username || !password) {
        return ws.send(JSON.stringify({ type: 'authError', message: 'All fields are required.' }));
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return ws.send(JSON.stringify({ type: 'authError', message: 'Invalid email address.' }));
      }
      if (username.length < 3 || username.length > 16 || !/^[a-zA-Z0-9_]+$/.test(username)) {
        return ws.send(JSON.stringify({ type: 'authError', message: 'Username: 3-16 chars, letters/numbers/underscore only.' }));
      }
      if (password.length < 6) {
        return ws.send(JSON.stringify({ type: 'authError', message: 'Password must be at least 6 characters.' }));
      }

      const emailKey = email.toLowerCase().trim();

      // Check email already registered
      if (users[emailKey]) {
        return ws.send(JSON.stringify({ type: 'authError', message: 'This email is already registered. Please log in.' }));
      }

      // Check username uniqueness
      const usernameTaken = Object.values(users).some(u => u.username.toLowerCase() === username.toLowerCase());
      if (usernameTaken) {
        return ws.send(JSON.stringify({ type: 'authError', message: `Username "${username}" is already taken.` }));
      }

      const colors = colorsFromEmail(emailKey);
      users[emailKey] = {
        username,
        passwordHash: sha256(password),
        colors,
        createdAt: new Date().toISOString()
      };
      writeJSON(USERS_FILE, users);

      console.log(`[REGISTER] ${username} <${emailKey}>`);
      return ws.send(JSON.stringify({
        type: 'authSuccess',
        username,
        colors,
        email: emailKey,
        inventory: null,
        playerHp: 100
      }));
    }

    // ── AUTH: Login ──────────────────────────────────────────────────────
    if (data.type === 'login') {
      const { email, password } = data;
      if (!email || !password) {
        return ws.send(JSON.stringify({ type: 'authError', message: 'Email and password are required.' }));
      }
      const emailKey = email.toLowerCase().trim();
      const record = users[emailKey];
      if (!record) {
        return ws.send(JSON.stringify({ type: 'authError', message: 'No account found with that email.' }));
      }
      if (record.passwordHash !== sha256(password)) {
        return ws.send(JSON.stringify({ type: 'authError', message: 'Incorrect password.' }));
      }

      const savedInv = inventories[emailKey] || null;
      console.log(`[LOGIN] ${record.username} <${emailKey}>`);
      return ws.send(JSON.stringify({
        type: 'authSuccess',
        username: record.username,
        colors: record.colors,
        email: emailKey,
        inventory: savedInv ? savedInv.slots : null,
        playerHp: savedInv ? (savedInv.playerHp || 100) : 100
      }));
    }

    // ── JOIN (after auth success) ────────────────────────────────────────
    if (data.type === 'join') {
      if (!data.email || !users[data.email]) {
        return ws.send(JSON.stringify({ type: 'error', message: 'Must authenticate first.' }));
      }

      playerId = `player_${Math.random().toString(36).substring(2, 9)}`;
      playerEmail = data.email;

      const record = users[playerEmail];
      const playerData = {
        id: playerId,
        name: record.username,
        colors: record.colors,
        x: data.x || -15,
        y: data.y || 5,
        z: data.z || 0,
        rotation: data.rotation || 0,
        isGrounded: true
      };

      players.set(playerId, { ws, data: playerData, email: playerEmail });

      const existingPlayers = Array.from(players.values())
        .filter(p => p.data.id !== playerId)
        .map(p => p.data);

      ws.send(JSON.stringify({
        type: 'init',
        yourId: playerId,
        players: existingPlayers,
        trees: Array.from(worldState.trees.values()),
        drops: Array.from(worldState.drops.values()),
        placedBlocks: worldState.placedBlocks
      }));

      broadcast({ type: 'playerJoined', player: playerData }, playerId);
      console.log(`[JOIN] ${playerData.name} (${playerId}). Total: ${players.size}`);
      return;
    }

    // ── In-game messages (require joined player) ─────────────────────────
    if (!playerId || !players.has(playerId)) return;

    switch (data.type) {
      case 'move': {
        const p = players.get(playerId);
        p.data.x = data.x; p.data.y = data.y; p.data.z = data.z;
        p.data.rotation = data.rotation; p.data.isGrounded = data.isGrounded;
        broadcast({ type: 'playerMoved', id: playerId, x: data.x, y: data.y, z: data.z, rotation: data.rotation, isGrounded: data.isGrounded }, playerId);
        break;
      }

      case 'punch': {
        const p = players.get(playerId);
        broadcast({ type: 'playerPunched', id: playerId,
          x: data.x ?? p.data.x, y: data.y ?? p.data.y, z: data.z ?? p.data.z,
          rotation: data.rotation ?? p.data.rotation }, playerId);
        break;
      }

      case 'treeHit': {
        const key = `${Math.round(data.x * 10) / 10}_${Math.round(data.z * 10) / 10}`;
        worldState.trees.set(key, { x: data.x, z: data.z, health: data.health, broken: data.broken });
        scheduleSaveWorld();
        broadcast({ type: 'treeHitSync', x: data.x, z: data.z, health: data.health, broken: data.broken }, playerId);
        break;
      }

      case 'dropLog': {
        const drop = { dropId: data.dropId, x: data.x, z: data.z, groundY: data.groundY, count: data.count || 1, itemType: data.itemType || 'log' };
        worldState.drops.set(data.dropId, drop);
        scheduleSaveWorld();
        broadcast({ type: 'dropLogSync', ...drop }, playerId);
        break;
      }

      case 'blockPlaced': {
        const block = { x: data.x, z: data.z, rot: data.rot || 0, blockType: data.blockType || 'crafting_bench' };
        worldState.placedBlocks.push(block);
        scheduleSaveWorld();
        broadcast({ type: 'blockPlacedSync', ...block }, playerId);
        break;
      }

      case 'blockBroken': {
        // Remove block from placedBlocks by position and type
        const idx = worldState.placedBlocks.findIndex(b =>
          Math.hypot(b.x - data.x, b.z - data.z) < 1.0 && (!data.blockType || b.blockType === data.blockType)
        );
        if (idx !== -1) {
          worldState.placedBlocks.splice(idx, 1);
          scheduleSaveWorld();
        }
        broadcast({ type: 'blockBrokenSync', x: data.x, z: data.z, blockType: data.blockType }, playerId);
        break;
      }

      case 'pickupDrop': {
        if (worldState.drops.has(data.dropId)) {
          const drop = worldState.drops.get(data.dropId);
          worldState.drops.delete(data.dropId);
          scheduleSaveWorld();
          ws.send(JSON.stringify({ type: 'pickupSuccess', dropId: data.dropId, count: drop.count, itemType: drop.itemType || 'log' }));
          broadcast({ type: 'dropRemoved', dropId: data.dropId }, playerId);
        }
        break;
      }

      case 'saveInventory': {
        if (playerEmail && data.slots !== undefined) {
          saveInventoryForEmail(playerEmail, data.slots, data.playerHp);
        }
        break;
      }

      case 'respawnTrees': {
        worldState.trees.clear();
        scheduleSaveWorld();
        broadcast({ type: 'treesRespawnedSync' }, playerId);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (playerId && players.has(playerId)) {
      const entry = players.get(playerId);
      console.log(`[LEAVE] ${entry.data.name} (${playerId})`);
      players.delete(playerId);
      broadcast({ type: 'playerLeft', id: playerId });
    }
  });

  ws.on('error', err => console.error('WS error:', err));
});

function broadcast(msgObj, excludeId = null) {
  const json = JSON.stringify(msgObj);
  for (const [id, p] of players) {
    if (id !== excludeId && p.ws.readyState === 1) p.ws.send(json);
  }
}

// ── Periodic inventory auto-save (every 60 seconds) ───────────────────────
setInterval(() => {
  let saved = 0;
  // Save inventories for all connected players is handled via 'saveInventory' messages
  // This just ensures the file is consistent
  writeJSON(INV_FILE, inventories);
  writeJSON(WORLD_FILE, {
    trees:        Array.from(worldState.trees.values()),
    drops:        Array.from(worldState.drops.values()),
    placedBlocks: worldState.placedBlocks
  });
  console.log('[AUTO-SAVE] World + inventories saved.');
}, 60000);
