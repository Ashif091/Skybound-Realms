import * as THREE from 'three';
import { SkyIsland } from './island.js';
import { Avatar, getRandomAvatarColors } from './avatar.js';
import { GameControls } from './controls.js';
import { DayNightCycle } from './daynight.js';
import { InventorySystem } from './inventory.js';
import { ItemDropManager } from './drops.js';
import { NetworkManager } from './network.js';

class GameApp {
  constructor() {
    this.container = document.getElementById('game-container');
    this.deathOverlay = document.getElementById('death-overlay');
    this.btnRestart = document.getElementById('btn-restart');
    
    // Scene Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x38bdf8); // Initial day sky color
    this.scene.fog = new THREE.FogExp2(0x38bdf8, 0.005);

    // Camera Setup
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      600
    );

    // WebGL Renderer Setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // Enable High Quality Dynamic PCF Soft Shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Lighting Setup
    this.setupLighting();

    // 12-Minute Day & Night Cycle System
    this.dayNight = new DayNightCycle(this.scene);
    this.dayNight.onNewDayCallback = () => {
      if (this.island) this.island.respawnTrees(25);
      if (this.networkManager) this.networkManager.send({ type: 'respawnTrees' });
    };

    // Inventory & Item Drops System
    this.inventory = new InventorySystem();
    this.inventory.gameApp = this;
    this.playerHp = 100;
    this.hpRegenTimer = 0;
    this.inventory.updateHealth(this.playerHp, 100);
    this.itemDropManager = new ItemDropManager(this.scene);

    // Screen Shake FX
    this.screenShakeTimer = 0;
    this.screenShakeIntensity = 0;

    // Build World Environment
    this.island = new SkyIsland(this.scene);

    // Structure Placement Rotation Angle (R key changes this by 90 degrees)
    this.buildRotationAngle = 0;

    // Translucent White Wireframe Preview Mesh for Building Placement
    this.previewGeo = new THREE.BoxGeometry(1, 1, 1);
    this.previewEdges = new THREE.EdgesGeometry(this.previewGeo);
    this.previewMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    this.buildPreviewMesh = new THREE.LineSegments(this.previewEdges, this.previewMat);
    this.buildPreviewMesh.visible = false;
    this.scene.add(this.buildPreviewMesh);

    // Player identity — populated after auth
    this.selectedColors = getRandomAvatarColors(); // temporary until auth
    this.playerName = 'Player';
    this.playerEmail = null; // set after login/register

    // Build Avatar immediately at start for 3D preview behind modal
    this.avatar = new Avatar(this.scene, this.selectedColors, this.playerName);
    const startY = this.island.getTerrainHeight(-15, 0);
    this.avatar.reset(-15, 0, startY);

    // Set initial camera position above ground behind avatar
    this.camera.position.set(-15, startY + 2.8, 8.5);
    this.camera.lookAt(-15, startY + 1.5, 0);

    // Controls System (Will be instantiated upon joining world)
    this.controls = null;

    // 3D Raycaster & Screen-Center Mouse NDC for Precision Crosshair Dot Targeting
    this.raycaster = new THREE.Raycaster();
    this.mouseNDC = new THREE.Vector2(0, 0);

    // Multiplayer Network Manager
    this.networkManager = new NetworkManager(this);

    // Setup Auth Screen Modal UI
    this.setupAuthModal();

    // Clock
    this.clock = new THREE.Clock();

    // Setup Restart Listeners
    this.setupRestartHandler();

    // Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());

    // Start Render Loop
    this.animate();
  }

  rotatePlacementPreview() {
    // 6 Angle steps (60 degrees / Math.PI / 3 radians per step)
    this.buildRotationAngle = (this.buildRotationAngle + Math.PI / 3) % (Math.PI * 2);
    if (this.inventory) {
      const degrees = Math.round((this.buildRotationAngle * 180) / Math.PI) % 360;
      this.inventory.showToast(`Placement Rotation: +${degrees}° (6-Axis)`);
    }
  }

  setupAuthModal() {
    const authModal  = document.getElementById('auth-modal');
    const connecting = document.getElementById('auth-connecting');

    const showError = (formId, msg) => {
      const el = document.getElementById(formId + '-error');
      if (el) { el.textContent = msg; el.classList.remove('hidden'); }
    };
    const hideError = (formId) => {
      const el = document.getElementById(formId + '-error');
      if (el) el.classList.add('hidden');
    };
    const setLoading = (on) => {
      if (connecting) connecting.classList.toggle('hidden', !on);
      ['btn-login','btn-register'].forEach(id => {
        const b = document.getElementById(id);
        if (b) b.disabled = on;
      });
    };

    const onAuthSuccess = async (data) => {
      // Apply identity from server
      this.playerName    = data.username;
      this.playerEmail   = data.email;
      this.selectedColors = data.colors;

      // Rebuild avatar with authenticated colors & name
      if (this.avatar) {
        this.avatar.group.removeFromParent();
      }
      this.avatar = new Avatar(this.scene, this.selectedColors, this.playerName);
      const startY = this.island.getTerrainHeight(-15, 0);
      this.avatar.reset(-15, 0, startY);

      // Restore inventory if server sent saved state
      if (this.inventory && data.inventory) {
        this.inventory.restoreSlots(data.inventory);
      }
      if (this.inventory && data.playerHp !== undefined) {
        this.playerHp = data.playerHp;
        this.inventory.updateHealth(this.playerHp, 100);
      }
      if (this.inventory) {
        this.inventory.setAvatarName(this.playerName);
      }

      // Hide auth modal
      if (authModal) authModal.classList.add('hidden');
      const lockOverlay = document.getElementById('lock-overlay');
      if (lockOverlay) lockOverlay.style.display = 'none';

      // Instantiate Controls System
      if (!this.controls) {
        this.controls = new GameControls(
          this.camera,
          this.renderer.domElement,
          this.avatar,
          this.inventory,
          this
        );
      }

      // Send join packet to enter game world
      this.networkManager.joinWorld(this.playerEmail);

      // Auto-save inventory every 30 seconds
      this._invSaveInterval = setInterval(() => {
        if (this.inventory && this.networkManager && this.playerEmail) {
          this.networkManager.sendSaveInventory(
            this.inventory.getSlots(),
            this.playerHp
          );
        }
      }, 30000);

      // Save on page unload
      window.addEventListener('beforeunload', () => {
        if (this.inventory && this.networkManager && this.playerEmail) {
          this.networkManager.sendSaveInventory(
            this.inventory.getSlots(),
            this.playerHp
          );
        }
      });

      // Request Pointer Lock
      try {
        if (document.body.requestPointerLock) document.body.requestPointerLock();
      } catch (_) {}
    };

    // ── Login Button ──────────────────────────────────────────────────────
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
      btnLogin.addEventListener('click', async (e) => {
        e.preventDefault();
        hideError('login');
        const email    = (document.getElementById('login-email')?.value || '').trim();
        const password = (document.getElementById('login-password')?.value || '');
        if (!email || !password) { showError('login', 'Please fill in all fields.'); return; }

        setLoading(true);
        try {
          await this.networkManager.connect();
          const data = await this.networkManager.sendLogin(email, password);
          await onAuthSuccess(data);
        } catch (err) {
          showError('login', err.message || 'Login failed. Check connection.');
        } finally {
          setLoading(false);
        }
      });
    }

    // ── Register Button ───────────────────────────────────────────────────
    const btnRegister = document.getElementById('btn-register');
    if (btnRegister) {
      btnRegister.addEventListener('click', async (e) => {
        e.preventDefault();
        hideError('reg');
        const username = (document.getElementById('reg-username')?.value || '').trim();
        const email    = (document.getElementById('reg-email')?.value || '').trim();
        const password = (document.getElementById('reg-password')?.value || '');
        if (!username || !email || !password) { showError('reg', 'Please fill in all fields.'); return; }

        setLoading(true);
        try {
          await this.networkManager.connect();
          const data = await this.networkManager.sendRegister(email, username, password);
          await onAuthSuccess(data);
        } catch (err) {
          showError('reg', err.message || 'Registration failed. Check connection.');
        } finally {
          setLoading(false);
        }
      });
    }

    // Allow Enter key to submit
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && authModal && !authModal.classList.contains('hidden')) {
        const loginVisible = !document.getElementById('form-login')?.classList.contains('hidden');
        if (loginVisible) btnLogin?.click();
        else btnRegister?.click();
      }
    });
  }

  setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x86efac, 0.65);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);
  }

  triggerScreenShake(duration = 0.35, intensity = 0.20) {
    this.screenShakeTimer = duration;
    this.screenShakeIntensity = intensity;
  }

  /**
   * Called on Left Mouse Click -> Punch Tree, Crafting Bench, or Building Structure
   */
  onPunchLeftClick() {
    if (!this.avatar || this.avatar.isDead || (this.inventory && (this.inventory.isOpen || this.inventory.isTableOpen))) return;

    const avX = this.avatar.position.x;
    const avZ = this.avatar.position.z;
    const facingAngle = this.avatar.rotation;

    // Broadcast punch animation to network
    if (this.networkManager) {
      this.networkManager.sendPunch();
    }

    // 1. Check hitting Crafting Bench nearby -> Drops crafting_bench on break!
    const benchRes = this.island.punchCraftingBenchNear(avX, avZ, facingAngle);
    if (benchRes) {
      this.triggerScreenShake(0.2, 0.12);
      if (benchRes.broken) {
        const dropId = this.itemDropManager.spawnLogDrop(benchRes.x, benchRes.z, benchRes.y, 1, null, 'crafting_bench');
        if (this.networkManager) {
          this.networkManager.sendDropLog(dropId, benchRes.x, benchRes.z, benchRes.y, 1, 'crafting_bench');
          this.networkManager.sendBlockBroken(benchRes.x, benchRes.z, 'crafting_bench');
        }
      }
      return;
    }

    // 2. Check hitting Building Structure nearby (Wall, Floor, Roof, Wood Box) -> Drops item(s) on break!
    const structRes = this.island.punchStructureNear(avX, avZ, facingAngle);
    if (structRes) {
      this.triggerScreenShake(0.2, 0.12);
      if (structRes.broken) {
        if (structRes.itemsToDrop && Array.isArray(structRes.itemsToDrop)) {
          structRes.itemsToDrop.forEach(dropItem => {
            const dropId = this.itemDropManager.spawnLogDrop(
              structRes.x + (Math.random() - 0.5) * 0.4,
              structRes.z + (Math.random() - 0.5) * 0.4,
              structRes.y,
              dropItem.count,
              null,
              dropItem.type
            );
            if (this.networkManager) {
              this.networkManager.sendDropLog(dropId, structRes.x, structRes.z, structRes.y, dropItem.count, dropItem.type);
            }
          });
        } else {
          const dropId = this.itemDropManager.spawnLogDrop(structRes.x, structRes.z, structRes.y, 1, null, structRes.itemType || 'log');
          if (this.networkManager) {
            this.networkManager.sendDropLog(dropId, structRes.x, structRes.z, structRes.y, 1, structRes.itemType || 'log');
          }
        }
        if (this.networkManager) {
          this.networkManager.sendBlockBroken(structRes.x, structRes.z, structRes.structType || structRes.type || structRes.itemType || 'wood_box', structRes.y);
        }
      }
      return;
    }

    // 3. Must be close to tree (within 1/2 player height) AND facing towards the tree
    const res = this.island.punchTreeNear(avX, avZ, facingAngle);

    if (res) {
      // Send tree hit & damage update to server for 100% synchronized world state
      if (this.networkManager) {
        this.networkManager.sendTreeHit(res.x || avX, res.z || avZ, res.health || 0, res.broken || false);
      }

      if (res.broken) {
        // Tree broken -> Spawn floating cylinder wood log drop & sync across network
        const dropId = this.itemDropManager.spawnLogDrop(res.x, res.z, res.y, 3, null, 'log');
        if (this.networkManager) {
          this.networkManager.sendDropLog(dropId, res.x, res.z, res.y, 3, 'log');
        }
      }
    }
  }

  /**
   * Performs a 3D Raycast from center crosshair dot (camera view center).
   * Returns { hit, structure } where:
   *   hit      = THREE.Intersection (has .point, .distance, .object)
   *   structure = matched placedStructure or placedCraftingTable entry (or null for terrain)
   */
  getCrosshairTarget(maxDistance = 6.0) {
    if (!this.camera || !this.island || !this.island.group) return { hit: null, structure: null };
    this.raycaster.setFromCamera(this.mouseNDC, this.camera);

    const intersects = this.raycaster.intersectObject(this.island.group, true);
    for (let i = 0; i < intersects.length; i++) {
      const hit = intersects[i];
      if (hit.distance > maxDistance) continue;

      // Walk up the ancestor chain to find a mesh tagged with userData.structureRef
      let obj = hit.object;
      while (obj) {
        if (obj.userData && obj.userData.structureRef) {
          return { hit, structure: obj.userData.structureRef };
        }
        obj = obj.parent;
      }

      // No tagged structure ancestor — terrain or untagged mesh
      return { hit, structure: null };
    }
    return { hit: null, structure: null };
  }

  /**
   * Called on Right Mouse Click -> Open Crafting Table UI or Place Structure / Drop Item
   */
  onPlaceRightClick() {
    if (this.avatar.isDead || (this.inventory && (this.inventory.isOpen || this.inventory.isStorageOpen))) return;

    const avX = this.avatar.position.x;
    const avZ = this.avatar.position.z;
    const avRot = this.avatar.rotation;

    const activeItem = this.inventory ? this.inventory.getActiveItem() : null;
    const placeableTypes = ['crafting_bench', 'wood_box', 'wood_wall', 'wood_wall_window', 'wood_wall_door', 'wood_floor', 'wood_roof', 'wood_stairs'];
    const hasPlaceableItem = activeItem && activeItem.count > 0 && placeableTypes.includes(activeItem.type);

    // --- If holding a buildable item (wireframe preview active): ONLY PLACE, skip all other interactions ---
    if (hasPlaceableItem) {
      const { hit } = this.getCrosshairTarget(6.0);
      let dropX = avX + Math.sin(avRot) * 1.6;
      let dropZ = avZ + Math.cos(avRot) * 1.6;
      let groundY = this.island.getTerrainHeight(dropX, dropZ);
      if (hit && hit.point) {
        dropX = hit.point.x;
        dropZ = hit.point.z;
        groundY = this.island.getTerrainHeight(dropX, dropZ);
      }
      const placementAngle = (this.avatar.rotation + this.buildRotationAngle) % (Math.PI * 2);

      // Smart Edge & Grid Snapping
      const snap = this.island.getSnappedBuildPosition(dropX, dropZ, activeItem.type, placementAngle);
      if (snap.snapped) {
        dropX = snap.x;
        dropZ = snap.z;
        groundY = snap.y;
      }

      if (activeItem.type === 'crafting_bench') {
        this.island.placeCraftingBench(dropX, dropZ, placementAngle);
        if (this.networkManager) this.networkManager.sendBlockPlaced(dropX, dropZ, placementAngle, 'crafting_bench', groundY);
        this.inventory.useActiveItem();
      } else if (activeItem.type === 'wood_box') {
        this.island.placeWoodBox(dropX, dropZ, placementAngle);
        if (this.networkManager) this.networkManager.sendBlockPlaced(dropX, dropZ, placementAngle, 'wood_box', groundY);
        this.inventory.useActiveItem();
      } else if (activeItem.type === 'wood_wall') {
        this.island.placeWoodWall(dropX, dropZ, placementAngle, groundY);
        if (this.networkManager) this.networkManager.sendBlockPlaced(dropX, dropZ, placementAngle, 'wood_wall', groundY);
        this.inventory.useActiveItem();
      } else if (activeItem.type === 'wood_wall_window') {
        this.island.placeWoodWallWindow(dropX, dropZ, placementAngle, groundY);
        if (this.networkManager) this.networkManager.sendBlockPlaced(dropX, dropZ, placementAngle, 'wood_wall_window', groundY);
        this.inventory.useActiveItem();
      } else if (activeItem.type === 'wood_wall_door') {
        this.island.placeWoodWallDoor(dropX, dropZ, placementAngle, groundY);
        if (this.networkManager) this.networkManager.sendBlockPlaced(dropX, dropZ, placementAngle, 'wood_wall_door', groundY);
        this.inventory.useActiveItem();
      } else if (activeItem.type === 'wood_floor') {
        this.island.placeWoodFloor(dropX, dropZ, placementAngle, groundY);
        if (this.networkManager) this.networkManager.sendBlockPlaced(dropX, dropZ, placementAngle, 'wood_floor', groundY);
        this.inventory.useActiveItem();
      } else if (activeItem.type === 'wood_roof') {
        this.island.placeWoodRoof(dropX, dropZ, placementAngle, groundY);
        if (this.networkManager) this.networkManager.sendBlockPlaced(dropX, dropZ, placementAngle, 'wood_roof', groundY);
        this.inventory.useActiveItem();
      } else if (activeItem.type === 'wood_stairs') {
        this.island.placeWoodStairs(dropX, dropZ, placementAngle, groundY);
        if (this.networkManager) this.networkManager.sendBlockPlaced(dropX, dropZ, placementAngle, 'wood_stairs', groundY);
        this.inventory.useActiveItem();
      }
      if (this.networkManager && this.inventory) {
        this.networkManager.sendSaveInventory(this.inventory.getSlots(), this.playerHp || 100);
      }
      return;
    }

    // --- Empty hand / non-build item: use crosshair raycast to identify targeted structure ---
    const { hit, structure } = this.getCrosshairTarget(5.0);

    // 1. If crosshair hits a Storage Box — open it
    if (structure && structure.type === 'wood_box') {
      if (this.inventory) this.inventory.openStorageBoxModal(structure);
      return;
    }

    // 2. If crosshair hits a Crafting Bench — open crafting UI
    if (structure && structure.type === 'crafting_bench') {
      if (this.inventory) this.inventory.openCraftingTableModal();
      return;
    }

    // 3. If crosshair hits a Door or Window Wall — toggle open/close
    if (structure && (structure.type === 'wood_wall_door' || structure.type === 'wood_wall_window')) {
      const wasOpen = structure.isOpen;
      structure.isOpen = !structure.isOpen;
      if (structure.type === 'wood_wall_door') {
        structure.doorHinge.rotation.y = structure.isOpen ? Math.PI / 2 : 0;
        if (structure.isOpen) {
          if (structure.centerColliders) {
            structure.centerColliders.forEach(c => {
              const idx = this.island.treeColliders.indexOf(c);
              if (idx !== -1) this.island.treeColliders.splice(idx, 1);
            });
          }
        } else {
          if (structure.centerColliders) {
            structure.centerColliders.forEach(c => {
              if (!this.island.treeColliders.includes(c)) this.island.treeColliders.push(c);
            });
          }
        }
      } else {
        if (structure.leftShutter) structure.leftShutter.rotation.y = structure.isOpen ? -1.4 : 0;
        if (structure.rightShutter) structure.rightShutter.rotation.y = structure.isOpen ? 1.4 : 0;
      }
      if (this.inventory) {
        const actionName = structure.type === 'wood_wall_door' ? 'Door' : 'Window Shutter';
        this.inventory.showToast(`${actionName} ${structure.isOpen ? 'Opened' : 'Closed'}!`);
      }
      return;
    }

    // 4. Drop a log item (non-build active item)
    if (activeItem && activeItem.count > 0 && activeItem.type === 'log') {
      let dropX = avX + Math.sin(avRot) * 1.6;
      let dropZ = avZ + Math.cos(avRot) * 1.6;
      const groundY = this.island.getTerrainHeight(dropX, dropZ);
      if (hit && hit.point) { dropX = hit.point.x; dropZ = hit.point.z; }
      const dropId = this.itemDropManager.spawnLogDrop(dropX, dropZ, groundY, 1, null, 'log');
      if (this.networkManager) this.networkManager.sendDropLog(dropId, dropX, dropZ, groundY, 1, 'log');
      this.inventory.useActiveItem();
    }
  }

  /**
   * Called when a remote player punches -> Check PvP hit proximity & apply knockback + screen shake
   */
  onRemotePlayerPunched(remotePlayer) {
    if (!this.avatar || this.avatar.isDead) return;

    const dist = this.avatar.position.distanceTo(remotePlayer.position);
    // If within 2.2m punch range, take PvP damage, knockback, and screen shake
    if (dist <= 2.2) {
      this.playerHp = Math.max(0, this.playerHp - 15);
      this.inventory.updateHealth(this.playerHp, 100);

      // Apply Knockback Impulse to Avatar (flies backward from hit source)
      this.avatar.applyKnockback(remotePlayer.position.x, remotePlayer.position.z, 9.0);

      // Trigger Camera Screen Shake FX
      this.triggerScreenShake(0.35, 0.22);

      // Flinch remote player visual model
      if (remotePlayer && remotePlayer.takeHit) {
        remotePlayer.takeHit();
      }

      if (this.playerHp <= 0) {
        if (!this.avatar.isDead) {
          this.avatar.isDead = true;
          this.handlePlayerDeath(false);
        }
      }
    }
  }

  handlePlayerDeath(isVoidDeath = false) {
    let dropX = this.avatar ? this.avatar.position.x : 0;
    let dropZ = this.avatar ? this.avatar.position.z : 0;
    let dropY = (this.island && this.avatar) ? this.island.getTerrainHeight(dropX, dropZ) : 1.0;

    const isVoid = isVoidDeath || dropY < -1.0 || (this.avatar && this.avatar.position.y < -1.0);

    if (this.inventory) {
      if (isVoid) {
        // Void Death: Delete/clear all held items (do NOT drop back to ground!)
        this.inventory.clearAllItems(this.networkManager);
      } else if (this.itemDropManager) {
        // Normal Death on land: drop items at position
        this.inventory.dropAllItems(dropX, dropZ, dropY, this.itemDropManager, this.networkManager);
      }
    }
  }

  setupRestartHandler() {
    const triggerRestart = () => {
      if (this.avatar.isDead) {
        const startY = this.island.getTerrainHeight(-15, 0);
        this.avatar.reset(-15, 0, startY);
        this.playerHp = 100;
        this.inventory.updateHealth(100, 100);
        this.deathOverlay.classList.add('hidden');
        if (document.body.requestPointerLock) {
          document.body.requestPointerLock();
        }
      }
    };

    if (this.btnRestart) {
      this.btnRestart.addEventListener('click', triggerRestart);
    }
    if (this.deathOverlay) {
      this.deathOverlay.addEventListener('click', triggerRestart);
    }

    window.addEventListener('keydown', (e) => {
      if (this.avatar.isDead && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        triggerRestart();
      }
    });
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const deltaTime = Math.min(this.clock.getDelta(), 0.1);

    // 1. Day/Night Celestial & Lighting Update
    if (this.dayNight) {
      const avPos = this.avatar ? this.avatar.position : null;
      this.dayNight.update(deltaTime, this.ambientLight, this.hemiLight, avPos);
    }

    // 2. Island Wobble & Tree Wobbling Animation Update
    this.island.update(deltaTime);

    // 3. Floating Log Drops Animation & Avatar Proximity Pickup
    if (this.avatar) {
      this.itemDropManager.update(deltaTime, this.avatar.position, this.inventory, this.networkManager);

      // 4. Terrain Height Check for Avatar Physics
      const terrainY = this.island.getTerrainHeight(this.avatar.position.x, this.avatar.position.z);

      // 5. Avatar Motion & Tree Collision Update
      this.avatar.update(deltaTime, terrainY, this.island.treeColliders, this.camera, this.island);

      // 6. Health Auto-Regeneration (+1 HP every 30 seconds)
      if (!this.avatar.isDead && this.playerHp < 100) {
        this.hpRegenTimer += deltaTime;
        if (this.hpRegenTimer >= 30.0) {
          this.hpRegenTimer = 0;
          this.playerHp = Math.min(100, this.playerHp + 1);
          this.inventory.updateHealth(this.playerHp, 100);
        }
      }

      // 7. Death Check UI Trigger
      if (this.avatar.isDead) {
        if (!this.wasDeadLastFrame) {
          this.wasDeadLastFrame = true;
          const isVoidDeath = (this.avatar.position.y < -10.0);
          this.handlePlayerDeath(isVoidDeath);
        }
        if (this.deathOverlay.classList.contains('hidden')) {
          this.deathOverlay.classList.remove('hidden');
          if (document.exitPointerLock) {
            document.exitPointerLock();
          }
        }
      } else {
        this.wasDeadLastFrame = false;
      }

      // 8. Controls & Camera Update (with terrain clipping prevention)
      if (this.controls) {
        const cameraTerrainY = this.island.getTerrainHeight(this.camera.position.x, this.camera.position.z);
        this.controls.update(deltaTime, cameraTerrainY);
      }

      // 9. Update Structure Placement White Wireframe Preview Mesh & Center Crosshair Dot UI
      const crosshairEl = document.getElementById('crosshair-dot');
      if (crosshairEl) {
        const isPlaying = !this.avatar.isDead && (this.controls && this.controls.isLocked) && (!this.inventory || !this.inventory.isOpen);
        crosshairEl.classList.toggle('hidden', !isPlaying);
      }

      if (!this.avatar.isDead && this.inventory && !this.inventory.isOpen) {
        const activeItem = this.inventory.getActiveItem();
        const buildTypes = ['crafting_bench', 'wood_box', 'wood_wall', 'wood_wall_window', 'wood_wall_door', 'wood_floor', 'wood_roof', 'wood_stairs'];
        if (activeItem && buildTypes.includes(activeItem.type)) {
          const rot = this.avatar.rotation;
          let px = this.avatar.position.x + Math.sin(rot) * 1.6;
          let pz = this.avatar.position.z + Math.cos(rot) * 1.6;
          let gy = this.island.getTerrainHeight(px, pz);

          const { hit } = this.getCrosshairTarget(6.0);
          if (hit && hit.point) {
            px = hit.point.x;
            pz = hit.point.z;
            gy = this.island.getTerrainHeight(px, pz);
          }

          const placementAngle = (this.avatar.rotation + this.buildRotationAngle) % (Math.PI * 2);
          const snap = this.island ? this.island.getSnappedBuildPosition(px, pz, activeItem.type, placementAngle) : null;
          if (snap && snap.snapped) {
            px = snap.x;
            pz = snap.z;
            gy = snap.y;
          }

          this.buildPreviewMesh.visible = true;
          this.buildPreviewMesh.rotation.y = placementAngle;

          if (activeItem.type === 'crafting_bench') {
            this.buildPreviewMesh.scale.set(1.6, 0.9, 0.9);
            this.buildPreviewMesh.position.set(px, gy + 0.45, pz);
          } else if (activeItem.type === 'wood_box') {
            this.buildPreviewMesh.scale.set(0.85, 0.65, 0.85);
            this.buildPreviewMesh.position.set(px, gy + 0.325, pz);
          } else if (activeItem.type === 'wood_wall' || activeItem.type === 'wood_wall_window' || activeItem.type === 'wood_wall_door') {
            this.buildPreviewMesh.scale.set(2.7, 2.7, 0.18);
            this.buildPreviewMesh.position.set(px, gy + 1.35, pz);
          } else if (activeItem.type === 'wood_floor') {
            this.buildPreviewMesh.scale.set(2.7, 0.12, 2.7);
            this.buildPreviewMesh.position.set(px, gy + 0.06, pz);
          } else if (activeItem.type === 'wood_roof') {
            this.buildPreviewMesh.scale.set(2.7, 0.14, 2.7);
            this.buildPreviewMesh.position.set(px, gy + 2.7, pz);
          } else if (activeItem.type === 'wood_stairs') {
            this.buildPreviewMesh.scale.set(2.7, 2.7, 2.7);
            this.buildPreviewMesh.position.set(px, gy + 1.35, pz);
          }
        } else if (this.buildPreviewMesh) {
          this.buildPreviewMesh.visible = false;
        }
      } else if (this.buildPreviewMesh) {
        this.buildPreviewMesh.visible = false;
      }
    }

    // 10. Remote Players & Network Updates
    if (this.networkManager) {
      this.networkManager.update(deltaTime, this.camera);
    }

    // 11. Mini 3D Avatar Projection Render
    if (this.inventory && this.avatar) {
      this.inventory.updateMiniAvatar(deltaTime, this.avatar);
    }

    // 12. Camera Screen Shake FX
    if (this.screenShakeTimer > 0) {
      this.screenShakeTimer -= deltaTime;
      const decay = Math.max(0, this.screenShakeTimer / 0.35);
      this.camera.position.x += (Math.random() - 0.5) * 2 * this.screenShakeIntensity * decay;
      this.camera.position.y += (Math.random() - 0.5) * 2 * this.screenShakeIntensity * decay;
    }

    // 13. Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Start Application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
