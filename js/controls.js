import * as THREE from 'three';

/**
 * Minecraft-Style Pointer Lock Mouse, Hotbar & Inventory Keyboard Controls
 */
export class GameControls {
  constructor(camera, domElement, avatar, inventory, gameApp) {
    this.camera = camera;
    this.domElement = domElement;
    this.avatar = avatar;
    this.inventory = inventory;
    this.gameApp = gameApp;

    // Pointer Lock & Camera View States
    this.isLocked = false;
    this.isFirstPerson = false; // Toggle via Key V (First-Person Eye View vs Third-Person)

    // 3rd Person Viewpoint Notification Tracking (1 min initial, 6 mins repeat)
    this.thirdPersonTimer = 0;
    this.nextNotificationTarget = 60; // 60s (1 min) initial threshold
    this.viewNotificationTimer = null;

    // Minecraft Mouse Look Angles
    this.cameraYaw = 0;
    this.cameraPitch = 0.25;
    this.cameraDistance = 8.5;
    this.mouseSensitivity = 0.0025;

    // Keyboard Key States
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false
    };

    // Immediately request pointer lock on the canvas
    this.requestPointerLock();

    this.initEventListeners();
  }

  requestPointerLock() {
    try {
      const target = this.domElement || document.body;
      if (target.requestPointerLock) {
        target.requestPointerLock();
      }
    } catch (err) {
      console.warn('Pointer lock request failed:', err);
    }
  }

  initEventListeners() {
    const overlay = document.getElementById('lock-overlay');

    const requestLock = (e) => {
      const joinModal = document.getElementById('join-modal');
      if (joinModal && !joinModal.classList.contains('hidden')) return;

      if (overlay) overlay.style.display = 'none';

      if (!this.inventory || !this.inventory.isOpen) {
        this.requestPointerLock();
      }
    };

    this.domElement.addEventListener('click', requestLock);
    if (overlay) {
      overlay.addEventListener('click', requestLock);
    }

    // Pointer Lock Change Listener
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = (
        document.pointerLockElement === document.body ||
        document.pointerLockElement === this.domElement
      );
      const joinModal = document.getElementById('join-modal');
      const isJoinOpen = joinModal && !joinModal.classList.contains('hidden');

      if (overlay) {
        if (isJoinOpen || this.isLocked || (this.inventory && this.inventory.isOpen)) {
          overlay.style.display = 'none';
        } else {
          overlay.style.display = 'flex';
        }
      }
    });

    // Mouse Movement (Minecraft Look) — only when pointer locked
    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;

      const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
      const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;

      this.cameraYaw -= movementX * this.mouseSensitivity;
      this.cameraPitch += movementY * this.mouseSensitivity;

      if (this.isFirstPerson) {
        const maxPitch = Math.PI / 2.2;
        const minPitch = -Math.PI / 2.2;
        this.cameraPitch = Math.max(minPitch, Math.min(maxPitch, this.cameraPitch));
      } else {
        const maxPitch = Math.PI / 2.3;
        const minPitch = 0.08;
        this.cameraPitch = Math.max(minPitch, Math.min(maxPitch, this.cameraPitch));
      }
    });

    // Prevent browser context menu on right click
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse Clicks for Punching (Left Click) & Placing (Right Click)
    window.addEventListener('mousedown', (e) => {
      if (this.inventory && this.inventory.isOpen) return;
      // Only handle game clicks when we have pointer lock (not clicking UI)
      if (!this.isLocked) return;

      if (e.button === 0) { // Left Mouse Click -> Punch Hand Animation & Hit Tree
        this.avatar.punch();
        if (this.gameApp && this.gameApp.onPunchLeftClick) {
          this.gameApp.onPunchLeftClick();
        }
      } else if (e.button === 2) { // Right Mouse Click -> Place Block
        if (this.gameApp && this.gameApp.onPlaceRightClick) {
          this.gameApp.onPlaceRightClick();
        }
      }
    });

    // Keyboard Down — works regardless of pointer lock so WASD always moves player
    window.addEventListener('keydown', (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

      // Hotbar Number Keys 1-6
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].includes(e.code)) {
        const slotIdx = parseInt(e.code.replace('Digit', ''), 10) - 1;
        if (this.inventory) this.inventory.selectHotbar(slotIdx);
        return;
      }

      // Key V: Toggle Viewpoint Mode (First-Person Eye View vs Third-Person View)
      if (e.code === 'KeyV') {
        this.isFirstPerson = !this.isFirstPerson;
        this.thirdPersonTimer = 0;
        this.nextNotificationTarget = 60;
        this.hideViewpointNotification();

        if (this.isFirstPerson) {
          this.cameraPitch = 0; // Reset pitch to level eye height
        } else {
          this.cameraPitch = 0.25; // Restore 3rd person default angle
        }
        if (this.inventory && this.inventory.showToast) {
          this.inventory.showToast(this.isFirstPerson ? 'View: First-Person (Eye View)' : 'View: Third-Person');
        }
        return;
      }

      // Key E: Toggle Full Inventory
      if (e.code === 'KeyE') {
        if (this.inventory) this.inventory.toggleInventory();
        return;
      }

      // Key Escape: Close Storage Box, Crafting Table, or Inventory
      if (e.code === 'Escape') {
        if (this.inventory && this.inventory.isStorageOpen) {
          this.inventory.closeStorageBoxModal();
          return;
        }
        if (this.inventory && this.inventory.isTableOpen) {
          this.inventory.closeCraftingTableModal();
          return;
        }
        if (this.inventory && this.inventory.isOpen) {
          this.inventory.toggleInventory();
          return;
        }
      }

      if (this.inventory && (this.inventory.isOpen || this.inventory.isTableOpen || this.inventory.isStorageOpen)) return; // Ignore movement when modal open

      switch (e.code) {
        case 'KeyW': case 'ArrowUp': this.keys.forward = true; break;
        case 'KeyS': case 'ArrowDown': this.keys.backward = true; break;
        case 'KeyA': case 'ArrowLeft': this.keys.left = true; break;
        case 'KeyD': case 'ArrowRight': this.keys.right = true; break;
        case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = true; break;
        case 'Space':
          e.preventDefault();
          this.avatar.jump();
          break;
        case 'KeyR':
          if (this.gameApp && this.gameApp.rotatePlacementPreview) {
            this.gameApp.rotatePlacementPreview();
          }
          break;
      }
    });

    // Keyboard Up
    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': this.keys.forward = false; break;
        case 'KeyS': case 'ArrowDown': this.keys.backward = false; break;
        case 'KeyA': case 'ArrowLeft': this.keys.left = false; break;
        case 'KeyD': case 'ArrowRight': this.keys.right = false; break;
        case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = false; break;
      }
    });

    // Mouse Wheel Zoom
    window.addEventListener('wheel', (e) => {
      if (!this.isLocked || this.isFirstPerson) return;
      this.cameraDistance += e.deltaY * 0.008;
      this.cameraDistance = Math.max(3.5, Math.min(18.0, this.cameraDistance));
    });
  }

  update(deltaTime, terrainHeightAtCamera = 0) {
    if (this.inventory && this.inventory.isOpen) {
      this.avatar.velocity.x = 0;
      this.avatar.velocity.z = 0;
      return;
    }

    // 1. Calculate Input Direction Vectors
    let moveForward = 0;
    let moveRight = 0;

    if (this.keys.forward) moveForward += 1;
    if (this.keys.backward) moveForward -= 1;
    if (this.keys.right) moveRight -= 1;
    if (this.keys.left) moveRight += 1;

    const walkSpeed = 4.0;
    const sprintSpeed = 6.8;
    const currentSpeed = this.keys.sprint ? sprintSpeed : walkSpeed;

    // Minecraft Mouse Look: Avatar body ALWAYS faces camera look direction
    this.avatar.targetRotation = this.cameraYaw;

    if (moveForward !== 0 || moveRight !== 0) {
      const inputAngle = Math.atan2(moveRight, moveForward);
      const moveAngle = this.cameraYaw + inputAngle;
      
      this.avatar.velocity.x = Math.sin(moveAngle) * currentSpeed;
      this.avatar.velocity.z = Math.cos(moveAngle) * currentSpeed;
    } else {
      this.avatar.velocity.x *= 0.82;
      this.avatar.velocity.z *= 0.82;
    }

    if (this.isFirstPerson) {
      // First-Person Mode: Hide local avatar body so camera inside head isn't obstructed
      if (this.avatar && this.avatar.group) {
        this.avatar.group.visible = false;
      }

      // Position camera directly at user eye level (1.62m above ground)
      const eyePos = new THREE.Vector3(
        this.avatar.position.x,
        this.avatar.position.y + 1.62,
        this.avatar.position.z
      );

      const lookX = Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch);
      const lookY = -Math.sin(this.cameraPitch);
      const lookZ = Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch);

      const targetLook = new THREE.Vector3(
        eyePos.x + lookX * 10,
        eyePos.y + lookY * 10,
        eyePos.z + lookZ * 10
      );

      this.camera.position.copy(eyePos);
      this.camera.lookAt(targetLook);
    } else {
      // Third-Person Mode: Ensure avatar body is visible
      if (this.avatar && this.avatar.group) {
        this.avatar.group.visible = true;
      }

      const avatarPos = this.avatar.position.clone();
      avatarPos.y += 1.5;

      const horizontalDist = this.cameraDistance * Math.cos(this.cameraPitch);
      const verticalDist = this.cameraDistance * Math.sin(this.cameraPitch);

      const targetCamX = avatarPos.x - Math.sin(this.cameraYaw) * horizontalDist;
      const targetCamZ = avatarPos.z - Math.cos(this.cameraYaw) * horizontalDist;
      
      let targetCamY = avatarPos.y + verticalDist;
      const minCamY = terrainHeightAtCamera + 1.2;
      if (targetCamY < minCamY) {
        targetCamY = minCamY;
      }

      const targetCamPos = new THREE.Vector3(targetCamX, targetCamY, targetCamZ);

      // Smooth camera lerp
      this.camera.position.lerp(targetCamPos, Math.min(1.0, 16 * deltaTime));
      this.camera.lookAt(avatarPos);
    }

    // ── 3rd Person Viewpoint Hint Notification Tracking ──────────────────────
    if (!this.isFirstPerson && this.isLocked) {
      this.thirdPersonTimer += deltaTime;
      if (this.thirdPersonTimer >= this.nextNotificationTarget) {
        this.showViewpointNotification();
        this.nextNotificationTarget += 360; // Repeat after 6 minutes (360 seconds)
      }
    } else if (this.isFirstPerson) {
      if (this.thirdPersonTimer > 0) {
        this.thirdPersonTimer = 0;
        this.nextNotificationTarget = 60;
        this.hideViewpointNotification();
      }
    }
  }

  showViewpointNotification() {
    let el = document.getElementById('viewpoint-hint-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'viewpoint-hint-banner';
      el.className = 'viewpoint-hint-banner';
      el.innerHTML = `
        <div class="viewpoint-hint-content">
          <span class="viewpoint-icon">👁️</span>
          <span>Press <kbd>V</kbd> to switch to 1st Person View</span>
        </div>
      `;
      document.body.appendChild(el);
    }

    el.classList.add('show');

    // Auto-hide after 4 seconds
    if (this.viewNotificationTimer) clearTimeout(this.viewNotificationTimer);
    this.viewNotificationTimer = setTimeout(() => {
      this.hideViewpointNotification();
    }, 4000);
  }

  hideViewpointNotification() {
    const el = document.getElementById('viewpoint-hint-banner');
    if (el) {
      el.classList.remove('show');
    }
    if (this.viewNotificationTimer) {
      clearTimeout(this.viewNotificationTimer);
      this.viewNotificationTimer = null;
    }
  }
}
