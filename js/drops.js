import * as THREE from 'three';

/**
 * Manages floating, spinning wood log item drops in the world
 */
export class ItemDropManager {
  constructor(scene) {
    this.scene = scene;
    this.drops = []; // List of active floating log drops
    
    // Low-poly Cylinder Wood Log Geometry & Materials (Height = 0.45m = 1/4 avatar size ~1.8m)
    this.logGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.45, 8);
    
    this.barkMat = new THREE.MeshStandardMaterial({
      color: 0x6b4226, // Outer bark brown
      flatShading: true,
      roughness: 0.8
    });

    this.topRingGeo = new THREE.CircleGeometry(0.145, 8);
    this.topRingGeo.rotateX(-Math.PI / 2);
    
    this.innerWoodMat = new THREE.MeshStandardMaterial({
      color: 0xd2a679, // Inner wood pale tan
      flatShading: true,
      roughness: 0.6
    });
  }

  /**
   * Spawns floating item drops on the ground at (x, z)
   */
  spawnLogDrop(x, z, groundY, count = 1, dropId = null, itemType = 'log') {
    const id = dropId || `drop_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    
    // Check if dropId already exists to avoid duplicates
    if (this.drops.some(d => d.dropId === id)) return id;

    const group = new THREE.Group();

    if (itemType === 'crafting_bench') {
      // Mini 4-legged Crafting Table Drop
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7, flatShading: true });
      const topGeo = new THREE.BoxGeometry(0.5, 0.08, 0.3);
      const topMesh = new THREE.Mesh(topGeo, woodMat);
      topMesh.castShadow = true;
      group.add(topMesh);

      // Legs
      const legGeo = new THREE.BoxGeometry(0.06, 0.25, 0.06);
      const legPositions = [
        [-0.2, -0.15, -0.1],
        [0.2, -0.15, -0.1],
        [-0.2, -0.15, 0.1],
        [0.2, -0.15, 0.1]
      ];
      legPositions.forEach(p => {
        const leg = new THREE.Mesh(legGeo, woodMat);
        leg.position.set(p[0], p[1], p[2]);
        group.add(leg);
      });
    } else if (itemType === 'wood_box') {
      // Mini Vaulted Wooden Chest Drop
      const boxMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7, flatShading: true });
      const bandMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 });
      const latchMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });

      // Base Box
      const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.26), boxMat);
      boxMesh.position.set(0, -0.04, 0);
      boxMesh.castShadow = true;
      group.add(boxMesh);

      // Vaulted Arched Lid
      const lidGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.38, 12, 1, false, 0, Math.PI);
      lidGeo.rotateZ(Math.PI / 2);
      const lidMesh = new THREE.Mesh(lidGeo, boxMat);
      lidMesh.position.set(0, 0.05, 0);
      lidMesh.castShadow = true;
      group.add(lidMesh);

      // Gold Straps
      [-0.10, 0.10].forEach(sx => {
        const strapArchGeo = new THREE.CylinderGeometry(0.134, 0.134, 0.03, 12, 1, false, 0, Math.PI);
        strapArchGeo.rotateZ(Math.PI / 2);
        const strapArch = new THREE.Mesh(strapArchGeo, bandMat);
        strapArch.position.set(sx, 0.05, 0);
        group.add(strapArch);

        const frontStrap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.01), bandMat);
        frontStrap.position.set(sx, -0.04, 0.132);
        group.add(frontStrap);
      });

      // Latch Lock
      const latchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.03), latchMat);
      latchMesh.position.set(0, 0.03, 0.14);
      group.add(latchMesh);
    } else {
      // Cylinder Log (Size 1/4 avatar size)
      const logMesh = new THREE.Mesh(this.logGeo, this.barkMat);
      logMesh.rotation.z = Math.PI / 2; // Lay horizontal
      logMesh.castShadow = true;
      group.add(logMesh);

      // End Rings on both cylinder caps
      const ring1 = new THREE.Mesh(this.topRingGeo, this.innerWoodMat);
      ring1.position.set(0.226, 0, 0);
      ring1.rotation.z = -Math.PI / 2;
      group.add(ring1);

      const ring2 = new THREE.Mesh(this.topRingGeo, this.innerWoodMat);
      ring2.position.set(-0.226, 0, 0);
      ring2.rotation.z = Math.PI / 2;
      group.add(ring2);
    }

    const startY = groundY + 0.35;
    group.position.set(x, startY, z);
    this.scene.add(group);

    this.drops.push({
      dropId: id,
      group: group,
      x: x,
      z: z,
      currentY: startY,
      vy: 0,
      floatTime: Math.random() * Math.PI * 2,
      count: count,
      itemType: itemType,
      pendingPickup: false
    });

    return id;
  }

  /**
   * Removes a drop from scene by dropId
   */
  removeDrop(dropId) {
    const index = this.drops.findIndex(d => d.dropId === dropId);
    if (index !== -1) {
      const drop = this.drops[index];
      this.scene.remove(drop.group);
      this.drops.splice(index, 1);
    }
  }

  /**
   * Syncs initial drops list from server on join
   */
  syncDropState(dropsList = []) {
    if (!dropsList || !Array.isArray(dropsList)) return;
    dropsList.forEach(d => {
      this.spawnLogDrop(d.x, d.z, d.groundY, d.count, d.dropId, d.itemType || 'log');
    });
  }

  /**
   * Updates floating log rotation, gravity falling onto ground/rigid surfaces, and proximity pickup by player avatar
   */
  update(deltaTime, avatarPos, inventory, networkManager = null, island = null) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];

      // 1. Calculate ground / rigid surface height beneath drop (x, z)
      let terrainY = 0;
      if (island && typeof island.getTerrainHeight === 'function') {
        terrainY = island.getTerrainHeight(drop.x, drop.z);
      }

      let rigidY = terrainY;
      if (island && typeof island.getStructureHeightAndCeiling === 'function') {
        const curY = drop.currentY !== undefined ? drop.currentY : (drop.baseY || terrainY);
        const structPhysics = island.getStructureHeightAndCeiling(drop.x, drop.z, curY);
        if (structPhysics && structPhysics.groundY > -40) {
          rigidY = Math.max(rigidY, structPhysics.groundY);
        }
      }

      // Rest elevation: 0.05m (1/20m subtle hover gap above ground or rigid structure surface)
      const restY = rigidY + 0.05;

      // Initialize height & vertical velocity
      if (drop.currentY === undefined) {
        drop.currentY = drop.baseY || restY;
      }
      if (drop.vy === undefined) {
        drop.vy = 0;
      }

      // 2. Physics Gravity & Falling onto Rigid Surface / Ground
      if (drop.currentY > restY + 0.005) {
        drop.vy -= 14.0 * deltaTime; // Gravity acceleration
        drop.currentY += drop.vy * deltaTime;
        if (drop.currentY <= restY) {
          drop.currentY = restY;
          drop.vy = 0;
        }
      } else if (drop.currentY < restY - 0.05) {
        // If underlying structure was removed or ground height shifted, update currentY to restY
        drop.currentY = restY;
        drop.vy = 0;
      } else {
        drop.currentY = restY;
        drop.vy = 0;
      }

      // 3. Subtle floating & spinning animation
      drop.floatTime += deltaTime * 3.0;
      const bobbing = Math.sin(drop.floatTime) * 0.035; // Gentle 0.035m vertical bobbing
      drop.group.position.set(drop.x, drop.currentY + bobbing, drop.z);
      drop.group.rotation.y += deltaTime * 1.8;

      // 4. Physical Body / Leg Touch Check for player pickup
      const dist = Math.hypot(avatarPos.x - drop.x, avatarPos.z - drop.z);
      const dy = Math.abs(avatarPos.y - drop.currentY);

      if (dist <= 0.70 && dy < 1.2 && !drop.pendingPickup) {
        if (networkManager && networkManager.ws && networkManager.ws.readyState === WebSocket.OPEN) {
          drop.pendingPickup = true;
          networkManager.sendPickupDrop(drop.dropId);
        } else {
          const added = inventory.addItem(drop.itemType || 'log', drop.count);
          if (added) {
            this.scene.remove(drop.group);
            this.drops.splice(i, 1);
          }
        }
      }
    }
  }
}
