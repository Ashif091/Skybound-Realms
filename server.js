import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { MongoClient } from 'mongodb';

// ── Load .env ──────────────────────────────────────────────────────────────
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
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
const PORT       = parseInt(process.env.PORT || '3000', 10);
const MONGO_URI  = process.env.MONGODB_URI || '';

// ── Helpers ────────────────────────────────────────────────────────────────
function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/** Deterministic avatar colors from email hash — same email = same look always */
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

// ── MongoDB Collections (set after connect) ────────────────────────────────
let dbUsers        = null;  // Collection: users
let dbInventories  = null;  // Collection: inventories
let dbWorld        = null;  // Collection: world (single document, _id: 'main')

// ── In-memory world state (loaded from MongoDB on start) ───────────────────
const worldState = {
  trees:        new Map(),
  drops:        new Map(),
  placedBlocks: []
};

// ── In-memory users cache (avoids round-trip on every join/message) ─────────
const usersCache = new Map(); // email -> { username, passwordHash, colors, createdAt }

// ── Runtime players map ────────────────────────────────────────────────────
const players = new Map(); // playerId -> { ws, data, email }

// ── Save throttle for world ────────────────────────────────────────────────
let saveWorldTimer = null;
let worldDirty = false; // Only true when world state has actually changed since last DB load/save

function scheduleSaveWorld() {
  worldDirty = true; // Mark that something changed
  if (saveWorldTimer) clearTimeout(saveWorldTimer);
  saveWorldTimer = setTimeout(() => saveWorldToDB(), 2000);
}

const WORLD_FILE = path.join(process.cwd(), 'data', 'world.json');

function saveWorldToFile() {
  try {
    const dir = path.dirname(WORLD_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = {
      trees: Array.from(worldState.trees.values()),
      drops: Array.from(worldState.drops.values()),
      placedBlocks: worldState.placedBlocks
    };
    fs.writeFileSync(WORLD_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[FILE] Failed to save world file:', err.message);
  }
}

function loadWorldFromFile() {
  try {
    if (!fs.existsSync(WORLD_FILE)) return;
    const raw = fs.readFileSync(WORLD_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (data.placedBlocks && Array.isArray(data.placedBlocks)) {
      worldState.placedBlocks = data.placedBlocks;
    }
    if (data.trees && Array.isArray(data.trees)) {
      data.trees.forEach(t => {
        const key = `${Math.round(t.x * 10) / 10}_${Math.round(t.z * 10) / 10}`;
        worldState.trees.set(key, t);
      });
    }
    console.log(`[FILE] Loaded world fallback from data/world.json: ${worldState.placedBlocks.length} placed block(s).`);
  } catch (err) {
    console.error('[FILE] Failed to load world file:', err.message);
  }
}

async function saveWorldToDB() {
  if (!worldDirty) return; // Nothing changed — skip to avoid overwriting a manual DB clear
  saveWorldToFile(); // Always maintain file backup
  if (!dbWorld) return;
  try {
    await dbWorld.replaceOne(
      { _id: 'main' },
      {
        _id: 'main',
        trees:        Array.from(worldState.trees.values()),
        drops:        Array.from(worldState.drops.values()),
        placedBlocks: worldState.placedBlocks,
        updatedAt:    new Date()
      },
      { upsert: true }
    );
    worldDirty = false; // Reset after successful save
    console.log('[SAVE] World state saved to MongoDB.');
  } catch (err) {
    console.error('[SAVE] Failed to save world:', err.message);
  }
}

// ── Save inventory for a player ────────────────────────────────────────────
async function saveInventoryToDB(email, slots, playerHp) {
  if (!email || !dbInventories) return;
  try {
    await dbInventories.replaceOne(
      { email },
      { email, slots, playerHp: playerHp ?? 100, updatedAt: new Date() },
      { upsert: true }
    );
  } catch (err) {
    console.error(`[SAVE] Failed to save inventory for ${email}:`, err.message);
  }
}

// ── MongoDB Connect & Seed world state ────────────────────────────────────
async function connectMongo() {
  if (!MONGO_URI) {
    console.warn('[MONGO] No MONGODB_URI set — running with local file persistence.');
    loadWorldFromFile();
    return false;
  }

  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 8000 });

  try {
    await client.connect();
    const db = client.db(); // Uses DB name from the URI ('skybound_realms')
    console.log(`[MONGO] Connected to: ${db.databaseName}`);

    dbUsers       = db.collection('users');
    dbInventories = db.collection('inventories');
    dbWorld       = db.collection('world');

    // Create indexes for fast lookups
    await dbUsers.createIndex({ email: 1 }, { unique: true });
    await dbUsers.createIndex({ username: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
    await dbInventories.createIndex({ email: 1 }, { unique: true });

    // ── Load all users into in-memory cache ──────────────────────────────
    const allUsers = await dbUsers.find({}).toArray();
    allUsers.forEach(u => usersCache.set(u.email, {
      username:     u.username,
      passwordHash: u.passwordHash,
      colors:       u.colors,
      createdAt:    u.createdAt
    }));
    console.log(`[MONGO] Loaded ${usersCache.size} user account(s) into cache.`);

    // ── Load world state ─────────────────────────────────────────────────
    const worldDoc = await dbWorld.findOne({ _id: 'main' });
    if (worldDoc) {
      (worldDoc.trees || []).forEach(t => {
        const key = `${Math.round(t.x * 10) / 10}_${Math.round(t.z * 10) / 10}`;
        worldState.trees.set(key, t);
      });
      (worldDoc.drops || []).forEach(d => worldState.drops.set(d.dropId, d));
      const cleanedBlocks = [];
      (worldDoc.placedBlocks || []).forEach(b => {
        const dup = cleanedBlocks.some(existing =>
          Math.hypot(existing.x - b.x, existing.z - b.z) < 0.3 &&
          Math.abs((existing.y || 0) - (b.y || 0)) < 0.3 &&
          existing.blockType === b.blockType
        );
        if (!dup) cleanedBlocks.push(b);
      });
      worldState.placedBlocks = cleanedBlocks;
      console.log(`[MONGO] Loaded world: ${worldState.trees.size} trees, ${worldState.drops.size} drops, ${worldState.placedBlocks.length} placed block(s).`);
    } else {
      console.log('[MONGO] No existing world document in DB — checking local file fallback.');
      loadWorldFromFile();
    }

    return true;
  } catch (err) {
    console.error('[MONGO] Connection failed:', err.message);
    console.warn('[MONGO] Server running with local file persistence.');
    loadWorldFromFile();
    return false;
  }
}

// ── WebSocket Server (started after DB connects) ───────────────────────────
async function startServer() {
  await connectMongo();

  const wss = new WebSocketServer({ port: PORT });
  console.log(`[SERVER] Skybound Realms game server running on port ${PORT}`);

  // ── HTTP Admin Server (port 3001) for live world management ────────────────
  const adminServer = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'POST' && req.url === '/admin/reset-world') {
      // 1. Clear in-memory placed blocks
      worldState.placedBlocks = [];
      worldDirty = true; // force save of the cleared state
      // 2. Persist cleared state to DB and file
      await saveWorldToDB();
      // 3. Broadcast cleared world to all connected clients
      const json = JSON.stringify({ type: 'init', yourId: null, players: [], trees: [], drops: [], placedBlocks: [] });
      for (const [, p] of players) {
        if (p.ws.readyState === 1) {
          p.ws.send(JSON.stringify({ type: 'worldReset', placedBlocks: [] }));
        }
      }
      console.log('[ADMIN] World placed blocks reset via HTTP endpoint.');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'placedBlocks cleared and broadcast to all clients.' }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  adminServer.listen(3001, () => console.log('[ADMIN] Admin HTTP server on port 3001'));

  wss.on('connection', ws => {
    let playerId   = null;
    let playerEmail = null;

    ws.on('message', async raw => {
      let data;
      try { data = JSON.parse(raw.toString()); } catch (_) { return; }

      // ── AUTH: Register ─────────────────────────────────────────────────
      if (data.type === 'register') {
        const { email, username, password } = data;

        if (!email || !username || !password)
          return ws.send(JSON.stringify({ type: 'authError', message: 'All fields are required.' }));
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          return ws.send(JSON.stringify({ type: 'authError', message: 'Invalid email address.' }));
        if (username.length < 3 || username.length > 16 || !/^[a-zA-Z0-9_]+$/.test(username))
          return ws.send(JSON.stringify({ type: 'authError', message: 'Username: 3–16 chars, letters/numbers/underscore only.' }));
        if (password.length < 6)
          return ws.send(JSON.stringify({ type: 'authError', message: 'Password must be at least 6 characters.' }));

        const emailKey = email.toLowerCase().trim();

        if (usersCache.has(emailKey))
          return ws.send(JSON.stringify({ type: 'authError', message: 'This email is already registered. Please log in.' }));

        // Case-insensitive username uniqueness check
        const usernameLower = username.toLowerCase();
        const usernameTaken = Array.from(usersCache.values()).some(u => u.username.toLowerCase() === usernameLower);
        if (usernameTaken)
          return ws.send(JSON.stringify({ type: 'authError', message: `Username "${username}" is already taken.` }));

        const colors     = colorsFromEmail(emailKey);
        const createdAt  = new Date().toISOString();
        const passwordHash = sha256(password);

        const userRecord = { email: emailKey, username, passwordHash, colors, createdAt };

        // Persist to MongoDB
        if (dbUsers) {
          try {
            await dbUsers.insertOne(userRecord);
          } catch (err) {
            if (err.code === 11000) {
              return ws.send(JSON.stringify({ type: 'authError', message: 'Email or username already taken.' }));
            }
            console.error('[DB] Register error:', err.message);
            return ws.send(JSON.stringify({ type: 'authError', message: 'Server error during registration.' }));
          }
        }

        // Update cache
        usersCache.set(emailKey, { username, passwordHash, colors, createdAt });
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

      // ── AUTH: Login ────────────────────────────────────────────────────
      if (data.type === 'login') {
        const { email, password } = data;
        if (!email || !password)
          return ws.send(JSON.stringify({ type: 'authError', message: 'Email and password are required.' }));

        const emailKey = email.toLowerCase().trim();
        const record   = usersCache.get(emailKey);

        if (!record)
          return ws.send(JSON.stringify({ type: 'authError', message: 'No account found with that email.' }));
        if (record.passwordHash !== sha256(password))
          return ws.send(JSON.stringify({ type: 'authError', message: 'Incorrect password.' }));

        // Load saved inventory from MongoDB
        let savedInv = null;
        if (dbInventories) {
          try {
            savedInv = await dbInventories.findOne({ email: emailKey });
          } catch (err) {
            console.error('[DB] Inventory load error:', err.message);
          }
        }

        console.log(`[LOGIN] ${record.username} <${emailKey}>`);
        return ws.send(JSON.stringify({
          type:      'authSuccess',
          username:  record.username,
          colors:    record.colors,
          email:     emailKey,
          inventory: savedInv ? savedInv.slots : null,
          playerHp:  savedInv ? (savedInv.playerHp || 100) : 100
        }));
      }

      // ── JOIN (after auth success) ──────────────────────────────────────
      if (data.type === 'join') {
        if (!data.email || !usersCache.has(data.email))
          return ws.send(JSON.stringify({ type: 'error', message: 'Must authenticate first.' }));

        playerId    = `player_${Math.random().toString(36).substring(2, 9)}`;
        playerEmail = data.email;

        const record     = usersCache.get(playerEmail);
        const playerData = {
          id:         playerId,
          name:       record.username,
          colors:     record.colors,
          x:          data.x || -15,
          y:          data.y || 5,
          z:          data.z || 0,
          rotation:   data.rotation || 0,
          isGrounded: true
        };

        players.set(playerId, { ws, data: playerData, email: playerEmail });

        const existingPlayers = Array.from(players.values())
          .filter(p => p.data.id !== playerId)
          .map(p => p.data);

        // Always fetch placedBlocks fresh from DB so clients always see the real persisted state
        let freshBlocks = worldState.placedBlocks; // fallback: in-memory
        if (dbWorld) {
          try {
            const worldDoc = await dbWorld.findOne({ _id: 'main' }, { projection: { placedBlocks: 1 } });
            if (worldDoc && Array.isArray(worldDoc.placedBlocks)) {
              freshBlocks = worldDoc.placedBlocks;
              worldState.placedBlocks = freshBlocks; // keep in-memory in sync with DB
              worldDirty = false; // in-memory now matches DB — no save needed
              console.log(`[JOIN] Loaded ${freshBlocks.length} placed block(s) fresh from DB for ${playerData.name}.`);
            }
          } catch (err) {
            console.error('[JOIN] Failed to load placedBlocks from DB, using in-memory fallback:', err.message);
          }
        }

        ws.send(JSON.stringify({
          type:         'init',
          yourId:       playerId,
          players:      existingPlayers,
          trees:        Array.from(worldState.trees.values()),
          drops:        Array.from(worldState.drops.values()),
          placedBlocks: freshBlocks
        }));

        broadcast({ type: 'playerJoined', player: playerData }, playerId);
        console.log(`[JOIN] ${playerData.name} (${playerId}). Online: ${players.size}`);
        return;
      }


      // ── In-game messages (require joined player) ───────────────────────
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
          worldDirty = true; // Mark world dirty so saveWorldToDB persists to MongoDB
          const dupIdx = worldState.placedBlocks.findIndex(b =>
            Math.hypot(b.x - data.x, b.z - data.z) < 0.4 &&
            Math.abs((b.y || 0) - (data.y || 0)) < 0.4 &&
            b.blockType === (data.blockType || 'crafting_bench')
          );
          const existingStorage = (dupIdx !== -1) ? worldState.placedBlocks[dupIdx].storage : null;
          const block = {
            x: data.x,
            y: data.y !== undefined ? data.y : 0,
            z: data.z,
            rot: data.rot || 0,
            blockType: data.blockType || 'crafting_bench',
            storage: data.storage || existingStorage || (data.blockType === 'wood_box' ? Array(6).fill(null) : null)
          };
          if (dupIdx !== -1) {
            worldState.placedBlocks[dupIdx] = block;
          } else {
            worldState.placedBlocks.push(block);
          }
          await saveWorldToDB();
          broadcast({ type: 'blockPlacedSync', ...block }, playerId);
          break;
        }

        case 'boxStorageUpdate': {
          worldDirty = true;
          let block = worldState.placedBlocks.find(b =>
            b.blockType === 'wood_box' && Math.hypot(b.x - data.x, b.z - data.z) < 1.0
          );
          if (!block) {
            let minDist = 1.85;
            worldState.placedBlocks.forEach(b => {
              if (b.blockType === 'wood_box') {
                const dist = Math.hypot(b.x - data.x, b.z - data.z);
                if (dist < minDist) {
                  minDist = dist;
                  block = b;
                }
              }
            });
          }
          if (block) {
            block.storage = data.storage;
            await saveWorldToDB();
          } else {
            console.warn(`[SERVER] boxStorageUpdate: No box found near x=${data.x}, z=${data.z}`);
          }
          broadcast({ type: 'boxStorageSync', x: data.x, z: data.z, storage: data.storage }, playerId);
          break;
        }

        case 'doorToggle': {
          worldDirty = true;
          // Update isOpen on the matching placed block in world state
          const doorBlock = worldState.placedBlocks.find(b =>
            b.blockType === data.blockType &&
            Math.hypot(b.x - data.x, b.z - data.z) < 1.0 &&
            Math.abs((b.y || 0) - (data.y || 0)) < 1.0
          );
          if (doorBlock) {
            doorBlock.isOpen = data.isOpen;
            scheduleSaveWorld(); // persist the open/close state
          }
          // Broadcast to all OTHER players so they see the door/window move
          broadcast({ type: 'doorToggleSync', x: data.x, y: data.y, z: data.z, blockType: data.blockType, isOpen: data.isOpen }, playerId);
          break;
        }



        case 'blockBroken': {
          worldDirty = true;
          const targetType = data.blockType;
          let removedCount = 0;

          // Only remove placed structures if a valid structure blockType was targeted (NOT tree or log hits)
          if (targetType && targetType !== 'tree' && targetType !== 'log') {
            for (let i = worldState.placedBlocks.length - 1; i >= 0; i--) {
              const b = worldState.placedBlocks[i];
              if (b.blockType === targetType) {
                const distXZ = Math.hypot(b.x - data.x, b.z - data.z);
                const distY = Math.abs((b.y || 0) - (data.y || 0));
                if (distXZ < 1.5 && (data.y === undefined || distY < 1.5)) {
                  worldState.placedBlocks.splice(i, 1);
                  removedCount++;
                  break;
                }
              }
            }
          }

          if (removedCount > 0) {
            await saveWorldToDB();
          }
          broadcast({ type: 'blockBrokenSync', x: data.x, y: data.y, z: data.z, blockType: data.blockType }, playerId);
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
            await saveInventoryToDB(playerEmail, data.slots, data.playerHp);
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

    ws.on('close', async () => {
      if (playerId && players.has(playerId)) {
        const entry = players.get(playerId);
        console.log(`[LEAVE] ${entry.data.name} (${playerId})`);
        players.delete(playerId);
        broadcast({ type: 'playerLeft', id: playerId });
        if (worldDirty) await saveWorldToDB(); // only save if something actually changed
      }
    });

    ws.on('error', err => console.error('WS error:', err));
  });
}

function broadcast(msgObj, excludeId = null) {
  const json = JSON.stringify(msgObj);
  for (const [id, p] of players) {
    if (id !== excludeId && p.ws.readyState === 1) p.ws.send(json);
  }
}

// ── Periodic world auto-save to MongoDB (every 60 seconds) ─────────────────
setInterval(() => {
  if (!worldDirty) return; // Nothing changed — skip
  saveWorldToDB().then(() => console.log('[AUTO-SAVE] World persisted to MongoDB.'));
}, 60000);

// ── Start ──────────────────────────────────────────────────────────────────
startServer().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
