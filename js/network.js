import { RemotePlayer } from './remotePlayer.js';

/**
 * Client-Side WebSocket Network Manager for Real-Time Multiplayer + Auth
 */
export class NetworkManager {
  constructor(gameApp) {
    this.gameApp = gameApp;
    this.ws = null;
    this.localPlayerId = null;
    this.remotePlayers = new Map(); // id -> RemotePlayer instance

    this.updateRateLimit = 0;
    this._pendingAuth = null; // { type, email, username?, password, resolve, reject }
  }

  // ── Connection ────────────────────────────────────────────────────────────
  connect() {
    let wsUrl = (import.meta.env.VITE_WS_URL || '').trim();
    if (!wsUrl) {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = location.hostname || 'localhost';
      const port = import.meta.env.VITE_WS_PORT || '3000';
      wsUrl = `${protocol}//${host}:${port}`;
    }
    console.log(`Connecting to WebSocket server at ${wsUrl}...`);

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err) {
      console.warn('WebSocket connection failed:', err);
      return Promise.reject(err);
    }

    return new Promise((resolve, reject) => {
      this.ws.onopen = () => {
        console.log('WebSocket connected!');
        resolve();
      };
      this.ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
        reject(err);
      };
      this.ws.onclose = () => {
        console.log('WebSocket disconnected.');
      };
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (err) {
          console.error('Error parsing network message:', err);
        }
      };
    });
  }

  // ── Auth Helpers ──────────────────────────────────────────────────────────
  sendLogin(email, password) {
    return new Promise((resolve, reject) => {
      this._pendingAuth = { resolve, reject };
      this.send({ type: 'login', email, password });
    });
  }

  sendRegister(email, username, password) {
    return new Promise((resolve, reject) => {
      this._pendingAuth = { resolve, reject };
      this.send({ type: 'register', email, username, password });
    });
  }

  /** Called after authSuccess to actually join the game world */
  joinWorld(email) {
    const avatar = this.gameApp.avatar;
    this.send({
      type: 'join',
      email,
      x: avatar ? avatar.position.x : -15,
      y: avatar ? avatar.position.y : 5,
      z: avatar ? avatar.position.z : 0,
      rotation: avatar ? avatar.rotation : 0
    });
  }

  // ── Message Handler ───────────────────────────────────────────────────────
  handleMessage(msg) {
    switch (msg.type) {
      case 'authSuccess': {
        if (this._pendingAuth) {
          this._pendingAuth.resolve(msg);
          this._pendingAuth = null;
        }
        break;
      }

      case 'authError': {
        if (this._pendingAuth) {
          this._pendingAuth.reject(new Error(msg.message));
          this._pendingAuth = null;
        }
        break;
      }

      case 'init': {
        this.localPlayerId = msg.yourId;
        console.log(`Assigned player ID: ${this.localPlayerId}`);

        // Spawn existing remote players
        if (msg.players) {
          msg.players.forEach(pData => {
            if (pData.id !== this.localPlayerId && !this.remotePlayers.has(pData.id)) {
              const remoteP = new RemotePlayer(this.gameApp.scene, pData);
              this.remotePlayers.set(pData.id, remoteP);
            }
          });
        }

        // Sync world state
        if (this.gameApp.island && msg.trees) this.gameApp.island.syncTreeState(msg.trees);
        if (this.gameApp.itemDropManager && msg.drops) this.gameApp.itemDropManager.syncDropState(msg.drops);
        if (this.gameApp.island && msg.placedBlocks) this.gameApp.island.syncPlacedBlocks(msg.placedBlocks);
        break;
      }

      case 'playerJoined': {
        if (msg.player.id !== this.localPlayerId && !this.remotePlayers.has(msg.player.id)) {
          const remoteP = new RemotePlayer(this.gameApp.scene, msg.player);
          this.remotePlayers.set(msg.player.id, remoteP);
          console.log(`Player joined: ${msg.player.name}`);
        }
        break;
      }

      case 'playerMoved': {
        if (msg.id !== this.localPlayerId && this.remotePlayers.has(msg.id)) {
          this.remotePlayers.get(msg.id).updateData(msg);
        }
        break;
      }

      case 'playerPunched': {
        if (msg.id !== this.localPlayerId && this.remotePlayers.has(msg.id)) {
          const remoteP = this.remotePlayers.get(msg.id);
          remoteP.punch();
          if (this.gameApp.onRemotePlayerPunched) this.gameApp.onRemotePlayerPunched(remoteP);
        }
        break;
      }

      case 'treeHitSync': {
        if (this.gameApp.island) this.gameApp.island.applyRemoteTreeHit(msg.x, msg.z, msg.health, msg.broken);
        break;
      }

      case 'dropLogSync': {
        if (this.gameApp.itemDropManager) {
          this.gameApp.itemDropManager.spawnLogDrop(msg.x, msg.z, msg.groundY, msg.count, msg.dropId, msg.itemType || 'log');
        }
        break;
      }

      case 'blockPlacedSync': {
        if (this.gameApp.island) this.gameApp.island.syncPlacedBlocks([msg]);
        break;
      }

      case 'blockBrokenSync': {
        if (this.gameApp.island) this.gameApp.island.removeBlockAt(msg.x, msg.z, msg.blockType, msg.y);
        break;
      }

      case 'worldReset': {
        // Server cleared all placed blocks — remove every placed structure from the scene
        if (this.gameApp.island) {
          const island = this.gameApp.island;
          // Remove all placed structure meshes from scene
          [...island.placedStructures].forEach(s => {
            if (s.mesh) island.group.remove(s.mesh);
            if (s.group) island.group.remove(s.group);
            if (s.colliders) s.colliders.forEach(c => {
              const idx = island.treeColliders.indexOf(c);
              if (idx !== -1) island.treeColliders.splice(idx, 1);
            });
            if (s.collider) {
              const idx = island.treeColliders.indexOf(s.collider);
              if (idx !== -1) island.treeColliders.splice(idx, 1);
            }
          });
          island.placedStructures = [];
          // Remove all crafting tables/boxes
          [...island.placedCraftingTables].forEach(t => {
            if (t.group) island.group.remove(t.group);
            if (t.collider) {
              const idx = island.treeColliders.indexOf(t.collider);
              if (idx !== -1) island.treeColliders.splice(idx, 1);
            }
          });
          island.placedCraftingTables = [];
          console.log('[WORLD] Server reset world — all placed structures cleared.');
        }
        break;
      }

      case 'doorToggleSync': {
        // Apply door/window open state on remote clients
        if (this.gameApp.island) {
          const island = this.gameApp.island;
          const s = island.placedStructures.find(s =>
            Math.hypot(s.x - msg.x, s.z - msg.z) < 1.0 &&
            Math.abs((s.y || 0) - (msg.y || 0)) < 1.0 &&
            s.type === msg.blockType
          );
          if (s) {
            s.isOpen = msg.isOpen;
            if (s.type === 'wood_wall_door') {
              s.doorHinge.rotation.y = s.isOpen ? Math.PI / 2 : 0;
              if (s.centerColliders) {
                if (s.isOpen) {
                  s.centerColliders.forEach(c => {
                    const idx = island.treeColliders.indexOf(c);
                    if (idx !== -1) island.treeColliders.splice(idx, 1);
                  });
                } else {
                  s.centerColliders.forEach(c => {
                    if (!island.treeColliders.includes(c)) island.treeColliders.push(c);
                  });
                }
              }
            } else if (s.type === 'wood_wall_window') {
              if (s.leftShutter) s.leftShutter.rotation.y = s.isOpen ? -1.4 : 0;
              if (s.rightShutter) s.rightShutter.rotation.y = s.isOpen ? 1.4 : 0;
            }
          }
        }
        break;
      }

      case 'boxStorageSync': {
        if (this.gameApp && this.gameApp.island) {
          const box = this.gameApp.island.getNearWoodBox(msg.x, msg.z);
          if (box) {
            box.storage = msg.storage;
            if (this.gameApp.inventory && this.gameApp.inventory.isStorageOpen && this.gameApp.inventory.activeStorageBox === box) {
              this.gameApp.inventory.renderStorageBoxUI();
            }
          }
        }
        break;
      }



      case 'pickupSuccess': {
        if (this.gameApp.inventory && this.gameApp.itemDropManager) {
          this.gameApp.inventory.addItem(msg.itemType || 'log', msg.count);
          this.gameApp.itemDropManager.removeDrop(msg.dropId);
          this.sendSaveInventory(this.gameApp.inventory.getSlots(), this.gameApp.playerHp || 100);
        }
        break;
      }

      case 'dropRemoved': {
        if (this.gameApp.itemDropManager) this.gameApp.itemDropManager.removeDrop(msg.dropId);
        break;
      }

      case 'treesRespawnedSync': {
        // Server sent authoritative tree positions — spawn exactly those on every client
        if (this.gameApp.island) {
          this.gameApp.island.respawnTrees(25, msg.trees || null);
        }
        break;
      }

      case 'playerLeft': {
        if (this.remotePlayers.has(msg.id)) {
          this.remotePlayers.get(msg.id).destroy();
          this.remotePlayers.delete(msg.id);
          console.log(`Player left: ${msg.id}`);
        }
        break;
      }
    }
  }

  // ── Send helpers ──────────────────────────────────────────────────────────
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  sendMove(pos, rotation, isGrounded) {
    this.send({
      type: 'move',
      x: Math.round(pos.x * 100) / 100,
      y: Math.round(pos.y * 100) / 100,
      z: Math.round(pos.z * 100) / 100,
      rotation: Math.round(rotation * 100) / 100,
      isGrounded
    });
  }

  sendPunch() {
    if (this.gameApp.avatar) {
      const pos = this.gameApp.avatar.position;
      const rot = this.gameApp.avatar.rotation;
      this.send({ type: 'punch', x: Math.round(pos.x * 100) / 100, y: Math.round(pos.y * 100) / 100, z: Math.round(pos.z * 100) / 100, rotation: Math.round(rot * 100) / 100 });
    } else {
      this.send({ type: 'punch' });
    }
  }

  sendTreeHit(x, z, health, broken) {
    this.send({ type: 'treeHit', x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, health, broken });
  }

  sendDropLog(dropId, x, z, groundY, count = 1, itemType = 'log') {
    this.send({ type: 'dropLog', dropId, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, groundY: Math.round(groundY * 100) / 100, count, itemType });
  }

  sendPickupDrop(dropId) {
    this.send({ type: 'pickupDrop', dropId });
  }

  sendBlockPlaced(x, z, rot = 0, blockType = 'crafting_bench', y = null) {
    this.send({
      type: 'blockPlaced',
      x: Math.round(x * 100) / 100,
      y: y !== null ? Math.round(y * 100) / 100 : undefined,
      z: Math.round(z * 100) / 100,
      rot: Math.round(rot * 100) / 100,
      blockType
    });
  }

  sendBlockBroken(x, z, blockType, y = null) {
    this.send({
      type: 'blockBroken',
      x: Math.round(x * 100) / 100,
      y: y !== null ? Math.round(y * 100) / 100 : undefined,
      z: Math.round(z * 100) / 100,
      blockType
    });
  }

  sendDoorToggle(x, z, y, blockType, isOpen) {
    this.send({
      type: 'doorToggle',
      x: Math.round(x * 100) / 100,
      y: y !== null ? Math.round(y * 100) / 100 : undefined,
      z: Math.round(z * 100) / 100,
      blockType,
      isOpen
    });
  }

  sendSaveInventory(slots, playerHp) {
    this.send({ type: 'saveInventory', slots, playerHp });
  }

  sendBoxStorageUpdate(x, z, storage) {
    this.send({
      type: 'boxStorageUpdate',
      x: Math.round(x * 100) / 100,
      z: Math.round(z * 100) / 100,
      storage
    });
  }

  // ── Update loop ───────────────────────────────────────────────────────────
  update(deltaTime, camera) {
    this.remotePlayers.forEach(remoteP => remoteP.update(deltaTime, camera));

    this.updateRateLimit += deltaTime;
    if (this.updateRateLimit >= 0.033) {
      this.updateRateLimit = 0;
      if (this.gameApp.avatar) {
        this.sendMove(this.gameApp.avatar.position, this.gameApp.avatar.rotation, this.gameApp.avatar.isGrounded);
      }
    }
  }
}
