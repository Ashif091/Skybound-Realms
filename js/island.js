import * as THREE from 'three';

/**
 * Low-Poly Sky Island with Breakable Trees, Wood Log Block Placing,
 * 360-Degree Uniform Earth Pond Basin, and Environmental Details.
 */
export class SkyIsland {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    
    // Island Dimensions
    this.radiusX = 38;
    this.radiusZ = 26;
    
    // Natural Pond Parameters
    this.pondX = -8;
    this.pondZ = 5;
    this.pondRadius = 5.2; // Inner water basin radius
    
    // Colliders & Interactive Entities
    this.treeColliders = [];
    this.trees = []; // Interactive breakable tree objects
    this.placedBlocks = []; // Wood log blocks placed by player
    this.placedCraftingTables = []; // Interactive breakable Crafting Tables (15 HP)
    this.placedStructures = []; // Wood Wall, Floor, Roof building structures

    // Block Material
    this.blockMat = new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      flatShading: true,
      roughness: 0.7
    });

    // Structure Material (Rich Textured Wood Planks)
    this.woodTexture = this.createWoodTexture();
    this.structureMat = new THREE.MeshStandardMaterial({
      map: this.woodTexture,
      color: 0xb5804c,
      flatShading: true,
      roughness: 0.65,
      metalness: 0.05
    });
    
    this.buildIsland();
    this.buildPond();
    this.buildEnvironmentDetails();
    this.buildGrassTufts();
    
    this.scene.add(this.group);
  }

  createWoodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Base rich wooden log shade
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(0, 0, 256, 256);

    // Draw horizontal wooden log/plank grooves & wood grain details
    for (let y = 0; y < 256; y += 32) {
      // Log edge shadows
      ctx.fillStyle = '#4a2e18';
      ctx.fillRect(0, y, 256, 4);
      ctx.fillStyle = '#a67c52';
      ctx.fillRect(0, y + 4, 256, 2);

      // Wood grain curves
      ctx.strokeStyle = '#674121';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y + 14);
      ctx.bezierCurveTo(80, y + 8, 160, y + 20, 256, y + 12);
      ctx.stroke();

      ctx.strokeStyle = '#7c4e28';
      ctx.beginPath();
      ctx.moveTo(0, y + 24);
      ctx.bezierCurveTo(60, y + 28, 180, y + 18, 256, y + 26);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
  }

  getTerrainHeight(x, z) {
    const distFromCenter = Math.hypot(x / this.radiusX, z / this.radiusZ);
    if (distFromCenter >= 0.95) return -50;

    let baseH = 1.2 + Math.sin(x * 0.12) * Math.cos(z * 0.12) * 0.7 
                     + Math.sin(x * 0.05 + z * 0.08) * 0.8;

    const distPond = Math.hypot(x - this.pondX, z - this.pondZ);
    if (distPond < 8.0) {
      const blend = Math.min(1.0, (8.0 - distPond) / 2.2);
      baseH = THREE.MathUtils.lerp(baseH, 1.6, blend);

      if (distPond < this.pondRadius) {
        const basinFactor = 1.0 - Math.pow(distPond / this.pondRadius, 2);
        baseH -= basinFactor * 1.4;
      }
    }

    if (distFromCenter > 0.84) {
      const edgeFactor = (distFromCenter - 0.84) / (0.95 - 0.84);
      return baseH - Math.pow(edgeFactor, 2) * 12.0;
    }

    return baseH;
  }

  buildIsland() {
    const topGeo = new THREE.PlaneGeometry(80, 56, 44, 32);
    topGeo.rotateX(-Math.PI / 2);

    const pos = topGeo.attributes.position;
    const colors = [];
    const colorTop = new THREE.Color(0x84d96a);
    const colorVariation = new THREE.Color(0x96e07e);
    const colorBasinMud = new THREE.Color(0x42352a);
    const colorCliff = new THREE.Color(0x4a3e35);

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let z = pos.getZ(i);

      let distFromCenter = Math.hypot(x / this.radiusX, z / this.radiusZ);

      if (distFromCenter >= 0.95) {
        const angle = Math.atan2(z / this.radiusZ, x / this.radiusX);
        x = Math.cos(angle) * (this.radiusX * 0.95);
        z = Math.sin(angle) * (this.radiusZ * 0.95);
        pos.setX(i, x);
        pos.setZ(i, z);
        distFromCenter = 0.95;
      }

      const y = this.getTerrainHeight(x, z);
      pos.setY(i, y === -50 ? -10.8 : y);

      let c = colorTop.clone();
      const distPond = Math.hypot(x - this.pondX, z - this.pondZ);

      if (distFromCenter > 0.84) {
        const cliffMix = Math.min(1.0, (distFromCenter - 0.84) / 0.11);
        c.lerp(colorCliff, cliffMix);
      } else if (distPond < this.pondRadius) {
        const pondMix = 1.0 - (distPond / this.pondRadius);
        c.lerp(colorBasinMud, pondMix * 0.75);
      } else {
        const mixRatio = (Math.sin(x * 0.15 + z * 0.15) + 1) * 0.5;
        c.lerp(colorVariation, mixRatio * 0.4);
      }
      colors.push(c.r, c.g, c.b);
    }

    topGeo.computeVertexNormals();
    topGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const topMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.8,
      metalness: 0.05
    });

    const topMesh = new THREE.Mesh(topGeo, topMat);
    topMesh.receiveShadow = true;
    topMesh.castShadow = true;
    this.group.add(topMesh);

    this.terrainMesh = topMesh;

    // Island Underside
    const botGeo = new THREE.ConeGeometry(36, 24, 16, 5, true);
    botGeo.rotateX(Math.PI);
    botGeo.translate(0, -12, 0);

    const bPos = botGeo.attributes.position;
    for (let i = 0; i < bPos.count; i++) {
      const x = bPos.getX(i);
      const z = bPos.getZ(i);
      const y = bPos.getY(i);
      
      if (y > -22) {
        const noise = Math.sin(x * 0.4 + y * 0.2) * Math.cos(z * 0.4) * 2.0;
        bPos.setX(i, x + noise * 0.5);
        bPos.setZ(i, z + Math.sin(y * 0.3) * 1.2);
      } else {
        bPos.setX(i, 0);
        bPos.setZ(i, 0);
        bPos.setY(i, -24);
      }
    }
    botGeo.computeVertexNormals();

    const botMat = new THREE.MeshStandardMaterial({
      color: 0x3d3128,
      flatShading: true,
      roughness: 0.9,
      metalness: 0.1
    });

    const botMesh = new THREE.Mesh(botGeo, botMat);
    this.group.add(botMesh);
  }

  buildPond() {
    const waterRadius = this.pondRadius * 0.96;
    const waterDepth = 1.0;

    const waterGeo = new THREE.CylinderGeometry(waterRadius, waterRadius * 0.85, waterDepth, 24);

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.15,
      transparent: true,
      opacity: 0.85,
      flatShading: true
    });

    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(this.pondX, 1.05 - (waterDepth / 2), this.pondZ);
    this.group.add(waterMesh);

    // 1 Shore Rock
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, flatShading: true, roughness: 0.8 });
    const shoreRockX = this.pondX + 4.9;
    const shoreRockZ = this.pondZ + 0.6;
    const shoreRockY = this.getTerrainHeight(shoreRockX, shoreRockZ);

    const shoreRockGeo = new THREE.DodecahedronGeometry(0.7, 0);
    const shoreRockMesh = new THREE.Mesh(shoreRockGeo, rockMat);
    shoreRockMesh.position.set(shoreRockX, shoreRockY + 0.35, shoreRockZ);
    shoreRockMesh.rotation.set(0.2, 0.5, 0.1);
    shoreRockMesh.castShadow = true;

    this.group.add(shoreRockMesh);
    this.treeColliders.push({ x: shoreRockX, z: shoreRockZ, radius: 0.7 });
  }

  buildEnvironmentDetails() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, flatShading: true });
    const foliageMat1 = new THREE.MeshStandardMaterial({ color: 0x4ade80, flatShading: true });
    const foliageMat2 = new THREE.MeshStandardMaterial({ color: 0x22c55e, flatShading: true });

    // Generate 25 Interactive Breakable Trees on Ground
    const baseTreePositions = [
      [-15, 8], [-20, -10], [-25, 5], [-8, 14], [-26, -2],
      [-18, 15], [-22, -14], [0, 16], [12, -8], [-12, -16],
      [18, 10], [22, -4], [25, 8], [15, 15], [24, -10],
      [8, -18], [-5, -18], [5, 18], [-15, -18], [18, -18],
      [26, 2], [-28, 2], [20, -16], [-22, 12], [28, -6]
    ];

    let count = 0;
    baseTreePositions.forEach(([x, z], index) => {
      const distFromCenter = Math.hypot(x / this.radiusX, z / this.radiusZ);
      const distPond = Math.hypot(x - this.pondX, z - this.pondZ);
      if (distFromCenter > 0.82 || distPond < 7.5) return;

      const y = this.getTerrainHeight(x, z);
      if (y < 0.2) return;

      this.spawnSingleTree(x, z, y, index, trunkMat, foliageMat1, foliageMat2);
      count++;
    });

    // Fill up to 25 trees if any base positions were skipped due to pond/boundary
    let attempts = 0;
    while (this.trees.length < 25 && attempts < 150) {
      attempts++;
      const rx = (Math.random() - 0.5) * 54;
      const rz = (Math.random() - 0.5) * 40;

      const distFromCenter = Math.hypot(rx / this.radiusX, rz / this.radiusZ);
      const distPond = Math.hypot(rx - this.pondX, rz - this.pondZ);
      if (distFromCenter > 0.80 || distPond < 7.5) continue;

      const ry = this.getTerrainHeight(rx, rz);
      if (ry < 0.2) continue;

      const tooClose = this.trees.some(t => Math.hypot(rx - t.x, rz - t.z) < 3.2);
      if (tooClose) continue;

      this.spawnSingleTree(rx, rz, ry, Date.now() + attempts, trunkMat, foliageMat1, foliageMat2);
    }

    // Rocks
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, flatShading: true, roughness: 0.8 });
    
    // Large Rock
    const largeRockX = 6;
    const largeRockZ = -6;
    const largeRockY = this.getTerrainHeight(largeRockX, largeRockZ);
    const largeRockGeo = new THREE.DodecahedronGeometry(2.4, 0);
    const largeRock = new THREE.Mesh(largeRockGeo, rockMat);
    largeRock.scale.set(1.1, 1.45, 1.0);
    largeRock.position.set(largeRockX, largeRockY + 2.4, largeRockZ);
    largeRock.rotation.set(0.3, 0.7, 0.2);
    this.group.add(largeRock);
    this.treeColliders.push({ x: largeRockX, z: largeRockZ, radius: 2.5 });

    // Small Rocks
    const smallRockPositions = [
      [-12, -4], [-2, -10], [14, 6], [18, -12], [-16, 12], [8, 12], [-2, 12]
    ];
    smallRockPositions.forEach(([rx, rz]) => {
      const distPond = Math.hypot(rx - this.pondX, rz - this.pondZ);
      if (distPond < 8.0) return;
      const ry = this.getTerrainHeight(rx, rz);
      if (ry < 0) return;

      const sGeo = new THREE.DodecahedronGeometry(0.38 + Math.random() * 0.15, 0);
      const sMesh = new THREE.Mesh(sGeo, rockMat);
      sMesh.position.set(rx, ry + 0.25, rz);
      this.group.add(sMesh);
      this.treeColliders.push({ x: rx, z: rz, radius: 0.45 });
    });
  }

  spawnSingleTree(x, z, y, treeId, trunkMat, foliageMat1, foliageMat2) {
    const collider = { id: treeId, x, z, radius: 0.75 };
    this.treeColliders.push(collider);

    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, y, z);

    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 2.2, 5);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.1;
    treeGroup.add(trunk);

    const mat = Math.abs(Math.floor(x + z)) % 2 === 0 ? foliageMat1 : foliageMat2;
    const layer1 = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.5, 5), mat);
    layer1.position.y = 2.8;
    
    const layer2 = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.2, 5), mat);
    layer2.position.y = 4.0;

    treeGroup.add(layer1);
    treeGroup.add(layer2);

    const scale = 0.8 + Math.random() * 0.4;
    treeGroup.scale.set(scale, scale, scale);
    this.group.add(treeGroup);

    this.trees.push({
      id: treeId,
      group: treeGroup,
      collider: collider,
      x: x,
      z: z,
      y: y,
      health: 40,    // 40 HP per tree
      maxHealth: 40,
      shakeTimer: 0
    });
  }

  buildGrassTufts() {
    const grassMat1 = new THREE.MeshStandardMaterial({ color: 0x6ee7b7, flatShading: true, roughness: 0.7 });
    const grassMat2 = new THREE.MeshStandardMaterial({ color: 0x4ade80, flatShading: true, roughness: 0.7 });

    const bladeGeo = new THREE.ConeGeometry(0.08, 0.45, 3);
    bladeGeo.translate(0, 0.22, 0);

    const patchCenters = [
      [-16, -6], [-2, 10], [16, -2], [10, -14]
    ];

    patchCenters.forEach(([cx, cz]) => {
      const tuftCount = 35;
      for (let i = 0; i < tuftCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 5.5;
        const rx = cx + Math.cos(angle) * dist;
        const rz = cz + Math.sin(angle) * dist;

        const distFromCenter = Math.hypot(rx / this.radiusX, rz / this.radiusZ);
        const distPond = Math.hypot(rx - this.pondX, rz - this.pondZ);
        if (distFromCenter > 0.80 || distPond < 8.0) continue;

        const ry = this.getTerrainHeight(rx, rz);
        if (ry < 0) continue;

        const tuftGroup = new THREE.Group();
        tuftGroup.position.set(rx, ry, rz);

        const mat = i % 2 === 0 ? grassMat1 : grassMat2;
        const bladeCount = 3 + Math.floor(Math.random() * 3);

        for (let b = 0; b < bladeCount; b++) {
          const blade = new THREE.Mesh(bladeGeo, mat);
          const rotY = (b / bladeCount) * Math.PI * 2 + Math.random() * 0.5;
          const tilt = 0.15 + Math.random() * 0.25;
          blade.rotation.set(tilt, rotY, 0);
          blade.scale.set(0.8 + Math.random() * 0.5, 0.8 + Math.random() * 0.5, 0.8 + Math.random() * 0.5);
          tuftGroup.add(blade);
        }
        this.group.add(tuftGroup);
      }
    });
  }

  /**
   * Attempts to hit/punch tree. Player MUST be within 1/2 avatar height (0.9m from trunk edge)
   * AND facing towards the tree.
   */
  punchTreeNear(avX, avZ, facingAngle) {
    let nearestIndex = -1;
    let minDist = 1.35; // Max 1.35m from tree center (0.9m edge distance = 1/2 avatar height)

    for (let i = 0; i < this.trees.length; i++) {
      const tree = this.trees[i];
      const dist = Math.hypot(avX - tree.x, avZ - tree.z);
      
      // Must be close to tree (within 1/2 player height)
      if (dist <= minDist) {
        // Must face towards tree
        const treeAngle = Math.atan2(tree.x - avX, tree.z - avZ);
        let angleDiff = treeAngle - facingAngle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

        if (Math.abs(angleDiff) <= 0.95) { // Facing within ~54 deg cone towards tree
          nearestIndex = i;
          minDist = dist;
        }
      }
    }

    if (nearestIndex === -1) return null; // Not close enough or not facing tree

    const tree = this.trees[nearestIndex];
    tree.health -= 5; // 5 Damage per bare hand punch (40 max HP = 8 hits total)
    tree.shakeTimer = 0.45; // Trigger wobbling shake animation

    if (tree.health <= 0) { // Tree broken!
      // Remove tree group
      this.group.remove(tree.group);
      
      // Remove collider
      const cIndex = this.treeColliders.indexOf(tree.collider);
      if (cIndex !== -1) this.treeColliders.splice(cIndex, 1);

      // Remove tree record
      this.trees.splice(nearestIndex, 1);

      return { broken: true, x: tree.x, z: tree.z, y: tree.y };
    }

    return { broken: false, x: tree.x, z: tree.z, y: tree.y, health: tree.health, maxHealth: tree.maxHealth };
  }

  /**
   * Applies remote tree hit/damage broadcast from network
   */
  applyRemoteTreeHit(x, z, health, broken) {
    const treeIndex = this.trees.findIndex(t => Math.hypot(t.x - x, t.z - z) < 1.2);
    if (treeIndex === -1) return;

    const tree = this.trees[treeIndex];
    tree.health = health;
    tree.shakeTimer = 0.45; // Wobble animation on all clients

    if (broken || health <= 0) {
      this.group.remove(tree.group);
      const cIndex = this.treeColliders.indexOf(tree.collider);
      if (cIndex !== -1) this.treeColliders.splice(cIndex, 1);
      this.trees.splice(treeIndex, 1);
    }
  }

  /**
   * Syncs initial tree state from server when joining game
   */
  syncTreeState(treeStateList = []) {
    if (!treeStateList || !Array.isArray(treeStateList)) return;
    treeStateList.forEach(tData => {
      if (tData.broken) {
        const treeIndex = this.trees.findIndex(t => Math.hypot(t.x - tData.x, t.z - tData.z) < 1.2);
        if (treeIndex !== -1) {
          const tree = this.trees[treeIndex];
          this.group.remove(tree.group);
          const cIndex = this.treeColliders.indexOf(tree.collider);
          if (cIndex !== -1) this.treeColliders.splice(cIndex, 1);
          this.trees.splice(treeIndex, 1);
        }
      }
    });
  }

  /**
   * Respawns broken trees randomly across valid island land when a new day starts (brings total trees to 25)
   */
  respawnTrees(targetCount = 25) {
    const missingCount = targetCount - this.trees.length;
    if (missingCount <= 0) return;

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, flatShading: true });
    const foliageMat1 = new THREE.MeshStandardMaterial({ color: 0x4ade80, flatShading: true });
    const foliageMat2 = new THREE.MeshStandardMaterial({ color: 0x22c55e, flatShading: true });

    let spawned = 0;
    let attempts = 0;

    while (spawned < missingCount && attempts < 200) {
      attempts++;
      const rx = (Math.random() - 0.5) * 54;
      const rz = (Math.random() - 0.5) * 40;

      const distFromCenter = Math.hypot(rx / this.radiusX, rz / this.radiusZ);
      const distPond = Math.hypot(rx - this.pondX, rz - this.pondZ);
      if (distFromCenter > 0.78 || distPond < 7.5) continue;

      const ry = this.getTerrainHeight(rx, rz);
      if (ry < 0.2) continue;

      // Check distance from existing trees to prevent overlap
      const tooClose = this.trees.some(t => Math.hypot(rx - t.x, rz - t.z) < 3.2);
      if (tooClose) continue;

      const treeId = Date.now() + spawned;
      this.spawnSingleTree(rx, rz, ry, treeId, trunkMat, foliageMat1, foliageMat2);
      spawned++;
    }
  }

  /**
   * Places a 3D Low-Poly Rectangular 4-Legged Wooden Crafting Table on the ground at (x, z)
   * Width = 1.6m (larger rectangular tabletop), Height = 0.9m (1/2 player height), 15 HP, Blueprint Paper on Top.
   */
  placeCraftingBench(x, z, rotationAngle = 0) {
    const y = this.getTerrainHeight(x, z);
    if (y < -1.0) return false;

    const tableId = `bench_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    const benchGroup = new THREE.Group();
    benchGroup.position.set(x, y, z); // Ground level origin
    benchGroup.rotation.y = rotationAngle;

    const legMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, flatShading: true, roughness: 0.8 });
    const topMat = new THREE.MeshStandardMaterial({ color: 0xd2a679, flatShading: true, roughness: 0.6 });
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, flatShading: true, roughness: 0.4 });
    const lineMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, flatShading: true }); // Blueprint blue lines

    // 1. 4 Corner Wooden Legs (Height 0.8m = 1/2 player height)
    const legGeo = new THREE.BoxGeometry(0.14, 0.80, 0.14);
    const legOffsets = [
      [-0.68, -0.36],
      [0.68, -0.36],
      [-0.68, 0.36],
      [0.68, 0.36]
    ];

    legOffsets.forEach(([lx, lz]) => {
      const legMesh = new THREE.Mesh(legGeo, legMat);
      legMesh.position.set(lx, 0.40, lz);
      legMesh.castShadow = true;
      legMesh.receiveShadow = true;
      benchGroup.add(legMesh);
    });

    // 2. Rectangular Wooden Tabletop (1.6m Width x 0.9m Depth x 0.1m Height)
    const topGeo = new THREE.BoxGeometry(1.60, 0.10, 0.90);
    const topMesh = new THREE.Mesh(topGeo, topMat);
    topMesh.position.set(0, 0.85, 0);
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    benchGroup.add(topMesh);

    // 3. Blueprint / Crafting Paper lying flat on top of rectangular tabletop (y = 0.91m)
    const paperGeo = new THREE.BoxGeometry(0.70, 0.01, 0.50);
    const paperMesh = new THREE.Mesh(paperGeo, paperMat);
    paperMesh.position.set(-0.10, 0.905, 0.05);
    paperMesh.rotation.y = 0.12; // Slightly rotated paper
    paperMesh.castShadow = true;
    benchGroup.add(paperMesh);

    // Blueprint Grid Line Accents on top of Paper
    for (let i = -1; i <= 1; i++) {
      const lineGeo = new THREE.BoxGeometry(0.60, 0.005, 0.03);
      const lineMesh = new THREE.Mesh(lineGeo, lineMat);
      lineMesh.position.set(-0.10, 0.912, 0.05 + i * 0.12);
      lineMesh.rotation.y = 0.12;
      benchGroup.add(lineMesh);
    }

    this.group.add(benchGroup);

    // Register obstacle collider & table entity (15 HP)
    const collider = { x, z, radius: 0.85 };
    this.treeColliders.push(collider);

    const tableObj = {
      id: tableId,
      group: benchGroup,
      collider: collider,
      x: x,
      z: z,
      y: y,
      type: 'crafting_bench',
      rotationAngle: rotationAngle,
      health: 15,
      maxHealth: 15,
      shakeTimer: 0
    };

    this.placedCraftingTables.push(tableObj);
    benchGroup.userData.structureRef = tableObj;
    this.placedBlocks.push({ mesh: benchGroup, collider, x, z, y, blockType: 'crafting_bench', rotationAngle });

    return true;
  }

  /**
   * Attempts to punch a placed Crafting Table. Takes 5 damage per hit (15 HP max = 3 hits to break).
   * Triggers wobbling shake animation on hit and drops Crafting Table item on break.
   */
  punchCraftingBenchNear(avX, avZ, facingAngle) {
    let nearestIndex = -1;
    let minDist = 1.45;

    for (let i = 0; i < this.placedCraftingTables.length; i++) {
      const table = this.placedCraftingTables[i];
      const dist = Math.hypot(avX - table.x, avZ - table.z);
      if (dist <= minDist) {
        nearestIndex = i;
        minDist = dist;
      }
    }

    if (nearestIndex === -1) return null;

    const table = this.placedCraftingTables[nearestIndex];
    table.health -= 5;
    table.shakeTimer = 0.45; // Trigger wobbling shake animation

    if (table.health <= 0) {
      // Table broken -> Drop crafting_bench item!
      this.group.remove(table.group);
      const cIndex = this.treeColliders.indexOf(table.collider);
      if (cIndex !== -1) this.treeColliders.splice(cIndex, 1);
      this.placedCraftingTables.splice(nearestIndex, 1);

      return { broken: true, x: table.x, z: table.z, y: table.y, itemType: 'crafting_bench' };
    }

    return { broken: false, x: table.x, z: table.z, y: table.y, health: table.health, maxHealth: table.maxHealth, itemType: 'crafting_bench' };
  }

  /**
   * Attempts to punch a placed building structure (Wall, Floor, Roof, Wood Box). 15 HP (3 hits to break).
   * Drops 1 wood log drop when broken (or wood_box + stored items for storage box).
   */
  punchStructureNear(avX, avZ, facingAngle) {
    let nearestIndex = -1;
    let minDist = 1.85;

    for (let i = 0; i < this.placedStructures.length; i++) {
      const struct = this.placedStructures[i];
      const dist = Math.hypot(avX - struct.x, avZ - struct.z);
      if (dist <= minDist) {
        nearestIndex = i;
        minDist = dist;
      }
    }

    if (nearestIndex === -1) return null;

    const struct = this.placedStructures[nearestIndex];
    struct.health = (struct.health !== undefined ? struct.health : 15) - 5;
    struct.shakeTimer = 0.45;

    if (struct.health <= 0) {
      this.group.remove(struct.mesh);
      if (struct.colliders && Array.isArray(struct.colliders)) {
        struct.colliders.forEach(c => {
          const cIndex = this.treeColliders.indexOf(c);
          if (cIndex !== -1) this.treeColliders.splice(cIndex, 1);
        });
      }
      if (struct.collider) {
        const cIndex = this.treeColliders.indexOf(struct.collider);
        if (cIndex !== -1) this.treeColliders.splice(cIndex, 1);
      }
      this.placedStructures.splice(nearestIndex, 1);

      if (struct.type === 'wood_box') {
        const itemsToDrop = [{ type: 'wood_box', count: 1 }];
        if (struct.storage && Array.isArray(struct.storage)) {
          struct.storage.forEach(sItem => {
            if (sItem && sItem.type && sItem.count > 0) {
              itemsToDrop.push({ type: sItem.type, count: sItem.count });
            }
          });
        }
        return { broken: true, x: struct.x, z: struct.z, y: struct.y, itemsToDrop, itemType: 'wood_box', structType: 'wood_box' };
      }

      return { broken: true, x: struct.x, z: struct.z, y: struct.y, itemType: 'log', structType: struct.type };
    }

    return { broken: false, x: struct.x, z: struct.z, y: struct.y, health: struct.health, maxHealth: 15, itemType: struct.type || 'log', structType: struct.type };
  }

  /**
   * Checks if player is close to any placed Crafting Table (within 1.5m)
   */
  getNearCraftingBench(avX, avZ) {
    return this.placedCraftingTables.some(t => Math.hypot(avX - t.x, avZ - t.z) <= 1.6);
  }

  /**
   * Places a 3D Wood Wall Structure (2.7m wide x 2.7m tall = 1.5x player height)
   * Uses tight 0.15m colliders along wall centerline so players can walk right up to touch the wall surface.
   */
  placeWoodWall(x, z, rotationAngle = 0) {
    const y = this.getTerrainHeight(x, z);
    if (y < -1.0) return false;

    const wallGroup = new THREE.Group();
    wallGroup.position.set(x, y + 1.35, z); // Vertical center at 1.35m
    wallGroup.rotation.y = rotationAngle;

    const wallGeo = new THREE.BoxGeometry(2.70, 2.70, 0.18);
    const wallMesh = new THREE.Mesh(wallGeo, this.structureMat);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    wallGroup.add(wallMesh);

    // Wall Frame Border Accent
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, flatShading: true });
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.14, 0.22), frameMat);
    topFrame.position.y = 1.30;
    wallGroup.add(topFrame);

    this.group.add(wallGroup);

    // 5 Tight Colliders (radius 0.15m) along wall length so players touch wall surface without passing through
    const px = Math.cos(rotationAngle);
    const pz = -Math.sin(rotationAngle);
    const colliders = [
      { x: x, z: z, radius: 0.15 },
      { x: x - px * 0.55, z: z - pz * 0.55, radius: 0.15 },
      { x: x + px * 0.55, z: z + pz * 0.55, radius: 0.15 },
      { x: x - px * 1.05, z: z - pz * 1.05, radius: 0.15 },
      { x: x + px * 1.05, z: z + pz * 1.05, radius: 0.15 }
    ];
    colliders.forEach(c => this.treeColliders.push(c));

    this.placedStructures.push({ mesh: wallGroup, colliders, x, z, y, type: 'wood_wall', rotationAngle, health: 15, shakeTimer: 0 });
    wallGroup.userData.structureRef = this.placedStructures[this.placedStructures.length - 1];

    return true;
  }

  /**
   * Places a 3D Wood Wall with Window Cutout & Openable Window Shutters (2.7m wide x 2.7m tall)
   * Open window allows full 100% clear sight through the window hole to the outside world!
   */
  placeWoodWallWindow(x, z, rotationAngle = 0) {
    const y = this.getTerrainHeight(x, z);
    if (y < -1.0) return false;

    const wallGroup = new THREE.Group();
    wallGroup.position.set(x, y + 1.35, z);
    wallGroup.rotation.y = rotationAngle;

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, flatShading: true });
    const shutterMat = new THREE.MeshStandardMaterial({ color: 0x6e4223, flatShading: true, roughness: 0.7 });

    // 1. Bottom Panel (2.7m wide x 0.85m tall)
    const botMesh = new THREE.Mesh(new THREE.BoxGeometry(2.70, 0.85, 0.18), this.structureMat);
    botMesh.position.set(0, -0.925, 0);
    botMesh.castShadow = true;
    botMesh.receiveShadow = true;
    wallGroup.add(botMesh);

    // 2. Top Header Panel (2.7m wide x 0.85m tall)
    const topMesh = new THREE.Mesh(new THREE.BoxGeometry(2.70, 0.85, 0.18), this.structureMat);
    topMesh.position.set(0, 0.925, 0);
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    wallGroup.add(topMesh);

    // 3. Left Pillar (0.85m wide x 1.0m tall)
    const leftMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.18), this.structureMat);
    leftMesh.position.set(-0.925, 0, 0);
    leftMesh.castShadow = true;
    leftMesh.receiveShadow = true;
    wallGroup.add(leftMesh);

    // 4. Right Pillar (0.85m wide x 1.0m tall)
    const rightMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.18), this.structureMat);
    rightMesh.position.set(0.925, 0, 0);
    rightMesh.castShadow = true;
    rightMesh.receiveShadow = true;
    wallGroup.add(rightMesh);

    // 5. Window Frame Accent Border (Hollow border framing the 1.0m x 1.0m cutout)
    const windowFrameGroup = new THREE.Group();
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.05, 0.22), frameMat);
    topFrame.position.set(0, 0.50, 0);
    topFrame.castShadow = true;
    topFrame.receiveShadow = true;
    windowFrameGroup.add(topFrame);

    const botFrame = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.06, 0.24), frameMat);
    botFrame.position.set(0, -0.50, 0);
    botFrame.castShadow = true;
    botFrame.receiveShadow = true;
    windowFrameGroup.add(botFrame);

    const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.98, 0.22), frameMat);
    leftFrame.position.set(-0.50, 0, 0);
    leftFrame.castShadow = true;
    leftFrame.receiveShadow = true;
    windowFrameGroup.add(leftFrame);

    const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.98, 0.22), frameMat);
    rightFrame.position.set(0.50, 0, 0);
    rightFrame.castShadow = true;
    rightFrame.receiveShadow = true;
    windowFrameGroup.add(rightFrame);

    wallGroup.add(windowFrameGroup);

    // 6. Interactive Left & Right Window Shutters (Openable / Closeable on right-click)
    const leftShutter = new THREE.Group();
    leftShutter.position.set(-0.48, 0, 0);
    const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.92, 0.04), shutterMat);
    leftPanel.position.set(0.23, 0, 0);
    leftPanel.castShadow = true;
    leftShutter.add(leftPanel);
    wallGroup.add(leftShutter);

    const rightShutter = new THREE.Group();
    rightShutter.position.set(0.48, 0, 0);
    const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.92, 0.04), shutterMat);
    rightPanel.position.set(-0.23, 0, 0);
    rightPanel.castShadow = true;
    rightShutter.add(rightPanel);
    wallGroup.add(rightShutter);

    this.group.add(wallGroup);

    // 5 Tight Colliders (radius 0.15m) along wall length
    const px = Math.cos(rotationAngle);
    const pz = -Math.sin(rotationAngle);
    const colliders = [
      { x: x, z: z, radius: 0.15 },
      { x: x - px * 0.55, z: z - pz * 0.55, radius: 0.15 },
      { x: x + px * 0.55, z: z + pz * 0.55, radius: 0.15 },
      { x: x - px * 1.05, z: z - pz * 1.05, radius: 0.15 },
      { x: x + px * 1.05, z: z + pz * 1.05, radius: 0.15 }
    ];
    colliders.forEach(c => this.treeColliders.push(c));

    this.placedStructures.push({
      mesh: wallGroup,
      leftShutter: leftShutter,
      rightShutter: rightShutter,
      colliders: colliders,
      x: x,
      z: z,
      y: y,
      type: 'wood_wall_window',
      rotationAngle: rotationAngle,
      isOpen: false,
      health: 15,
      shakeTimer: 0
    });
    wallGroup.userData.structureRef = this.placedStructures[this.placedStructures.length - 1];

    return true;
  }

  /**
   * Places a 3D Wood Wall with Doorway Opening & Interactive Swinging Wooden Door (2.7m wide x 2.7m tall)
   * Costs 4 Wood Logs. Door opens and closes on right click!
   */
  placeWoodWallDoor(x, z, rotationAngle = 0) {
    const y = this.getTerrainHeight(x, z);
    if (y < -1.0) return false;

    const wallGroup = new THREE.Group();
    wallGroup.position.set(x, y + 1.35, z);
    wallGroup.rotation.y = rotationAngle;

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, flatShading: true });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x7c4e28, flatShading: true, roughness: 0.65 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.2 });

    // 1. Top Header Panel above doorway (2.7m wide x 0.6m tall)
    const topMesh = new THREE.Mesh(new THREE.BoxGeometry(2.70, 0.60, 0.18), this.structureMat);
    topMesh.position.set(0, 1.05, 0);
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    wallGroup.add(topMesh);

    // 2. Left Pillar (0.80m wide x 2.10m tall)
    const leftMesh = new THREE.Mesh(new THREE.BoxGeometry(0.80, 2.10, 0.18), this.structureMat);
    leftMesh.position.set(-0.95, -0.30, 0);
    leftMesh.castShadow = true;
    leftMesh.receiveShadow = true;
    wallGroup.add(leftMesh);

    // 3. Right Pillar (0.80m wide x 2.10m tall)
    const rightMesh = new THREE.Mesh(new THREE.BoxGeometry(0.80, 2.10, 0.18), this.structureMat);
    rightMesh.position.set(0.95, -0.30, 0);
    rightMesh.castShadow = true;
    rightMesh.receiveShadow = true;
    wallGroup.add(rightMesh);

    // 4. Doorway Frame Arch Accent (1.1m wide x 2.1m tall opening)
    const doorArch = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.12, 0.22), frameMat);
    doorArch.position.set(0, 0.75, 0);
    wallGroup.add(doorArch);

    // 5. Interactive Wooden Door Hinge Group (Pivot at left pillar edge x = -0.55m)
    const doorHinge = new THREE.Group();
    doorHinge.position.set(-0.55, -0.30, 0);

    const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(1.08, 2.05, 0.08), doorMat);
    doorPanel.position.set(0.54, 0, 0);
    doorPanel.castShadow = true;
    doorPanel.receiveShadow = true;
    doorHinge.add(doorPanel);

    // Door Handle Brass Knobs (Front & Back)
    const handleKnobFront = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), handleMat);
    handleKnobFront.position.set(0.95, 0, 0.06);
    doorHinge.add(handleKnobFront);

    const handleKnobBack = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), handleMat);
    handleKnobBack.position.set(0.95, 0, -0.06);
    doorHinge.add(handleKnobBack);

    wallGroup.add(doorHinge);

    this.group.add(wallGroup);

    // Colliders: Left pillar, Right pillar, and Center Door colliders (blocking passage when closed)
    const px = Math.cos(rotationAngle);
    const pz = -Math.sin(rotationAngle);

    const leftColliders = [
      { x: x - px * 0.75, z: z - pz * 0.75, radius: 0.15 },
      { x: x - px * 1.10, z: z - pz * 1.10, radius: 0.15 }
    ];
    const rightColliders = [
      { x: x + px * 0.75, z: z + pz * 0.75, radius: 0.15 },
      { x: x + px * 1.10, z: z + pz * 1.10, radius: 0.15 }
    ];
    const centerColliders = [
      { x: x - px * 0.25, z: z - pz * 0.25, radius: 0.15 },
      { x: x + px * 0.25, z: z + pz * 0.25, radius: 0.15 }
    ];

    const allColliders = [...leftColliders, ...rightColliders, ...centerColliders];
    allColliders.forEach(c => this.treeColliders.push(c));

    this.placedStructures.push({
      mesh: wallGroup,
      doorHinge: doorHinge,
      colliders: allColliders,
      centerColliders: centerColliders,
      x: x,
      z: z,
      y: y,
      type: 'wood_wall_door',
      rotationAngle: rotationAngle,
      isOpen: false,
      health: 15,
      shakeTimer: 0
    });
    wallGroup.userData.structureRef = this.placedStructures[this.placedStructures.length - 1];

    return true;
  }

  /**
   * Toggles nearest door or window open/close within range of (avX, avZ).
   * Enforces distance, height layer, facing direction, and placement precedence.
   */
  toggleDoorOrWindowNear(avX, avZ, avY = 0, avRot = 0, cameraPitch = 0, hasPlaceableItem = false) {
    let nearest = null;
    let minDist = hasPlaceableItem ? 1.7 : 2.5; // Tighter range when holding a buildable item

    // Facing direction vector of avatar (sin(rot), cos(rot))
    const dirX = Math.sin(avRot);
    const dirZ = Math.cos(avRot);

    for (let i = 0; i < this.placedStructures.length; i++) {
      const s = this.placedStructures[i];
      if (s.type === 'wood_wall_door' || s.type === 'wood_wall_window') {
        const dx = s.x - avX;
        const dz = s.z - avZ;
        const dist = Math.hypot(dx, dz);
        if (dist >= minDist) continue;

        // Facing check: avatar must be facing TOWARDS the window/door
        const dot = (dirX * dx + dirZ * dz) / (dist || 1);
        if (dot < 0.35) continue; // Not facing towards structure (must be within ~65 deg angle)

        if (s.type === 'wood_wall_window') {
          // Height/Layer check: User must be looking/standing near window height (y + 0.85m to y + 1.85m)
          const eyeY = avY + 1.62;
          const windowCenterY = s.y + 1.35;
          if (Math.abs(eyeY - windowCenterY) > 1.2) continue; // Too high or too low relative to window cutout
        }

        minDist = dist;
        nearest = s;
      }
    }

    if (!nearest) return null;

    nearest.isOpen = !nearest.isOpen;

    if (nearest.type === 'wood_wall_door') {
      // Swing door hinge 90 deg (1.57 rad)
      nearest.doorHinge.rotation.y = nearest.isOpen ? Math.PI / 2 : 0;

      // Enable/disable center colliders based on door state
      if (nearest.isOpen) {
        // Remove center colliders from treeColliders so player can walk through
        if (nearest.centerColliders) {
          nearest.centerColliders.forEach(c => {
            const idx = this.treeColliders.indexOf(c);
            if (idx !== -1) this.treeColliders.splice(idx, 1);
          });
        }
      } else {
        // Re-add center colliders if missing
        if (nearest.centerColliders) {
          nearest.centerColliders.forEach(c => {
            if (!this.treeColliders.includes(c)) this.treeColliders.push(c);
          });
        }
      }
    } else if (nearest.type === 'wood_wall_window') {
      // Swing window shutters 80 deg
      if (nearest.leftShutter) nearest.leftShutter.rotation.y = nearest.isOpen ? -1.4 : 0;
      if (nearest.rightShutter) nearest.rightShutter.rotation.y = nearest.isOpen ? 1.4 : 0;
    }

    return { isOpen: nearest.isOpen, type: nearest.type };
  }

  /**
   * Calculates structure floor ground heights and roof ceiling heights at (x, z) for physics
   */
  getStructureHeightAndCeiling(x, z, avY) {
    let groundY = -50;
    let ceilingY = 999;

    for (let i = 0; i < this.placedStructures.length; i++) {
      const s = this.placedStructures[i];
      // 2.7m x 2.7m footprint check with rotation angle
      const dx = x - s.x;
      const dz = z - s.z;
      const localX = dx * Math.cos(-s.rotationAngle) - dz * Math.sin(-s.rotationAngle);
      const localZ = dx * Math.sin(-s.rotationAngle) + dz * Math.cos(-s.rotationAngle);

      if (Math.abs(localX) <= 1.40 && Math.abs(localZ) <= 1.40) {
        if (s.type === 'wood_roof') {
          const roofBottom = s.y + 2.63; // Bottom surface of roof panel at y + 2.63m
          const roofTop = s.y + 2.77;    // Top surface of roof panel at y + 2.77m

          // Ceiling check: Avatar head is below roof bottom
          if (avY + 1.8 <= roofBottom + 0.35) {
            ceilingY = Math.min(ceilingY, roofBottom);
          }
          // Ground check: Avatar is standing/falling on top of roof
          if (avY >= roofTop - 0.45) {
            groundY = Math.max(groundY, roofTop);
          }
        } else if (s.type === 'wood_floor') {
          const floorTop = s.y + 0.12;
          if (avY >= s.y - 0.2) {
            groundY = Math.max(groundY, floorTop);
          }
        }
      }
    }

    return { groundY, ceilingY };
  }

  /**
   * Places a 3D Wood Floor Structure (2.7m x 2.7m flat ground panel = 1.5x player height)
   */
  placeWoodFloor(x, z, rotationAngle = 0) {
    const y = this.getTerrainHeight(x, z);
    if (y < -1.0) return false;

    const floorGroup = new THREE.Group();
    floorGroup.position.set(x, y + 0.06, z);
    floorGroup.rotation.y = rotationAngle;

    const floorGeo = new THREE.BoxGeometry(2.70, 0.12, 2.70);
    const floorMesh = new THREE.Mesh(floorGeo, this.structureMat);
    floorMesh.receiveShadow = true;
    floorMesh.castShadow = true;
    floorGroup.add(floorMesh);

    this.group.add(floorGroup);

    this.placedStructures.push({ mesh: floorGroup, x, z, y, type: 'wood_floor', rotationAngle, health: 15, shakeTimer: 0 });
    floorGroup.userData.structureRef = this.placedStructures[this.placedStructures.length - 1];
    return true;
  }

  /**
   * Places a 3D Wood Roof Structure (2.7m x 2.7m top ceiling panel on top of walls at height y + 2.7m)
   */
  placeWoodRoof(x, z, rotationAngle = 0) {
    const y = this.getTerrainHeight(x, z);
    if (y < -1.0) return false;

    const roofGroup = new THREE.Group();
    roofGroup.position.set(x, y + 2.70, z);
    roofGroup.rotation.y = rotationAngle;

    const roofGeo = new THREE.BoxGeometry(2.70, 0.14, 2.70);
    const roofMesh = new THREE.Mesh(roofGeo, this.structureMat);
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    roofGroup.add(roofMesh);

    this.group.add(roofGroup);

    this.placedStructures.push({ mesh: roofGroup, x, z, y, type: 'wood_roof', rotationAngle, health: 15, shakeTimer: 0 });
    roofGroup.userData.structureRef = this.placedStructures[this.placedStructures.length - 1];
    return true;
  }

  /**
   * Places a 3D High-Detail Wooden Storage Chest (1.0m wide x 0.70m high x 0.65m deep) with 6 storage slots.
   * Features a vaulted arched lid, dual gold/metal bands with rivets, corner braces, front latch buckle, and back hinges
   * matching the reference image from all viewing angles.
   */
  placeWoodBox(x, z, rotationAngle = 0, initialStorage = null) {
    const y = this.getTerrainHeight(x, z);
    if (y < -1.0) return false;

    const boxGroup = new THREE.Group();
    boxGroup.position.set(x, y, z);
    boxGroup.rotation.y = rotationAngle;

    // --- Materials ---
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, flatShading: true, roughness: 0.75 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, flatShading: true, roughness: 0.85 });
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xd97706, flatShading: true, roughness: 0.5, metalness: 0.4 });
    const rivetMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, flatShading: true, roughness: 0.3, metalness: 0.8 });
    const latchMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, flatShading: true, roughness: 0.3, metalness: 0.7 });
    const hingeMat = new THREE.MeshStandardMaterial({ color: 0x475569, flatShading: true, roughness: 0.4, metalness: 0.7 });

    // 1. Base Wooden Box Body (1.00m W x 0.42m H x 0.65m D)
    const baseGeo = new THREE.BoxGeometry(0.96, 0.42, 0.61);
    const baseMesh = new THREE.Mesh(baseGeo, woodMat);
    baseMesh.position.set(0, 0.21, 0);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    boxGroup.add(baseMesh);

    // Inner Dark Plank Grooves on Front & Back
    const grooveGeo = new THREE.BoxGeometry(0.92, 0.02, 0.62);
    const groove1 = new THREE.Mesh(grooveGeo, darkWoodMat);
    groove1.position.set(0, 0.14, 0);
    boxGroup.add(groove1);
    const groove2 = new THREE.Mesh(grooveGeo, darkWoodMat);
    groove2.position.set(0, 0.28, 0);
    boxGroup.add(groove2);

    // 2. Vaulted Barrel Arched Lid Top
    const lidRadius = 0.31;
    const lidLength = 0.96;
    const lidGeo = new THREE.CylinderGeometry(lidRadius, lidRadius, lidLength, 16, 1, false, 0, Math.PI);
    lidGeo.rotateZ(Math.PI / 2);
    const lidMesh = new THREE.Mesh(lidGeo, woodMat);
    lidMesh.position.set(0, 0.42, 0);
    lidMesh.castShadow = true;
    lidMesh.receiveShadow = true;
    boxGroup.add(lidMesh);

    // Lid End Cap Sides (Flat semi-circles on left and right)
    const endCapGeo = new THREE.CircleGeometry(lidRadius, 16, 0, Math.PI);
    const leftCap = new THREE.Mesh(endCapGeo, woodMat);
    leftCap.position.set(-0.481, 0.42, 0);
    leftCap.rotation.y = -Math.PI / 2;
    boxGroup.add(leftCap);

    const rightCap = new THREE.Mesh(endCapGeo, woodMat);
    rightCap.position.set(0.481, 0.42, 0);
    rightCap.rotation.y = Math.PI / 2;
    boxGroup.add(rightCap);

    // 3. Horizontal Mid-Rim Frame Band separating Lid & Base (1.00m W x 0.04m H x 0.66m D)
    const rimMesh = new THREE.Mesh(new THREE.BoxGeometry(1.00, 0.04, 0.66), bandMat);
    rimMesh.position.set(0, 0.42, 0);
    rimMesh.castShadow = true;
    boxGroup.add(rimMesh);

    // 4. 4 Vertical Corner Metal Strips with 3 Rivet Studs each
    const cornerOffsets = [
      [-0.48, 0.31],
      [0.48, 0.31],
      [-0.48, -0.31],
      [0.48, -0.31]
    ];
    const cornerGeo = new THREE.BoxGeometry(0.06, 0.43, 0.06);
    const rivetGeo = new THREE.SphereGeometry(0.014, 6, 6);

    cornerOffsets.forEach(([cx, cz]) => {
      const cornerMesh = new THREE.Mesh(cornerGeo, bandMat);
      cornerMesh.position.set(cx, 0.215, cz);
      cornerMesh.castShadow = true;
      boxGroup.add(cornerMesh);

      // 3 Rivets on each corner strip
      [0.08, 0.215, 0.35].forEach(ry => {
        const rivet = new THREE.Mesh(rivetGeo, rivetMat);
        const rx = cx > 0 ? cx + 0.025 : cx - 0.025;
        const rz = cz > 0 ? cz + 0.025 : cz - 0.025;
        rivet.position.set(rx, ry, rz);
        boxGroup.add(rivet);
      });
    });

    // 5. Dual Vertical Brass/Metal Straps (with Rivet Studs & Back Hinges)
    const strapXPositions = [-0.26, 0.26];
    strapXPositions.forEach(sx => {
      // Arched Strap Segment over Lid
      const strapArchGeo = new THREE.CylinderGeometry(lidRadius + 0.008, lidRadius + 0.008, 0.06, 16, 1, false, 0, Math.PI);
      strapArchGeo.rotateZ(Math.PI / 2);
      const strapArch = new THREE.Mesh(strapArchGeo, bandMat);
      strapArch.position.set(sx, 0.42, 0);
      boxGroup.add(strapArch);

      // Front Vertical Strap
      const frontStrap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.43, 0.015), bandMat);
      frontStrap.position.set(sx, 0.215, 0.312);
      boxGroup.add(frontStrap);

      // Back Vertical Strap
      const backStrap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.43, 0.015), bandMat);
      backStrap.position.set(sx, 0.215, -0.312);
      boxGroup.add(backStrap);

      // Front Rivets
      const frontRivet1 = new THREE.Mesh(rivetGeo, rivetMat);
      frontRivet1.position.set(sx, 0.12, 0.322);
      boxGroup.add(frontRivet1);
      const frontRivet2 = new THREE.Mesh(rivetGeo, rivetMat);
      frontRivet2.position.set(sx, 0.32, 0.322);
      boxGroup.add(frontRivet2);

      // Top Arch Rivets
      for (let angle = 0.3; angle <= Math.PI - 0.3; angle += 0.8) {
        const ry = 0.42 + Math.sin(angle) * (lidRadius + 0.015);
        const rz = Math.cos(angle) * (lidRadius + 0.015);
        const archRivet = new THREE.Mesh(rivetGeo, rivetMat);
        archRivet.position.set(sx, ry, rz);
        boxGroup.add(archRivet);
      }

      // Back Hinges
      const hingePlate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.03), hingeMat);
      hingePlate.position.set(sx, 0.42, -0.32);
      boxGroup.add(hingePlate);

      // Hinge Pin
      const hingePin = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 8), hingeMat);
      hingePin.rotation.z = Math.PI / 2;
      hingePin.position.set(sx, 0.42, -0.33);
      boxGroup.add(hingePin);
    });

    // 6. Front Lock Latch & Buckle
    const latchPlate = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 0.035), latchMat);
    latchPlate.position.set(0, 0.38, 0.33);
    latchPlate.castShadow = true;
    boxGroup.add(latchPlate);

    const buckleOuter = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.04), latchMat);
    buckleOuter.position.set(0, 0.33, 0.34);
    boxGroup.add(buckleOuter);

    const keyhole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 8), rivetMat);
    keyhole.rotation.x = Math.PI / 2;
    keyhole.position.set(0, 0.33, 0.35);
    boxGroup.add(keyhole);

    this.group.add(boxGroup);

    // Collider
    const collider = { x, z, radius: 0.50 };
    this.treeColliders.push(collider);

    const boxId = `box_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    this.placedStructures.push({
      id: boxId,
      mesh: boxGroup,
      collider: collider,
      x: x,
      z: z,
      y: y,
      type: 'wood_box',
      rotationAngle: rotationAngle,
      health: 15,
      shakeTimer: 0,
      storage: (initialStorage && Array.isArray(initialStorage) && initialStorage.length === 6)
        ? JSON.parse(JSON.stringify(initialStorage))
        : Array.from({ length: 6 }, () => null)
    });
    boxGroup.userData.structureRef = this.placedStructures[this.placedStructures.length - 1];

    return true;
  }

  /**
   * Checks if player is close to any placed Wooden Storage Box (within 1.8m)
   */
  getNearWoodBox(avX, avZ) {
    let nearest = null;
    let minDist = 1.8;

    for (let i = 0; i < this.placedStructures.length; i++) {
      const s = this.placedStructures[i];
      if (s.type === 'wood_box') {
        const dist = Math.hypot(avX - s.x, avZ - s.z);
        if (dist <= minDist) {
          minDist = dist;
          nearest = s;
        }
      }
    }

    return nearest;
  }

  /**
   * Syncs placed blocks from server on join
   */
  syncPlacedBlocks(blocksList = []) {
    if (!blocksList || !Array.isArray(blocksList)) return;
    blocksList.forEach(b => {
      const rot = b.rotationAngle || b.rot || 0;
      const type = b.blockType || 'crafting_bench';

      // Deduplicate: Skip if block already exists at position, but sync box storage if needed
      const existing = this.placedStructures.find(s => Math.hypot(s.x - b.x, s.z - b.z) < 0.4 && s.type === type);
      if (existing) {
        if (type === 'wood_box' && b.storage && Array.isArray(b.storage)) {
          existing.storage = JSON.parse(JSON.stringify(b.storage));
        }
        return;
      }
      if (this.placedCraftingTables.some(t => Math.hypot(t.x - b.x, t.z - b.z) < 0.4 && type === 'crafting_bench')) return;
      if (this.placedBlocks.some(pb => Math.hypot(pb.x - b.x, pb.z - b.z) < 0.4)) return;

      if (type === 'crafting_bench') {
        this.placeCraftingBench(b.x, b.z, rot);
      } else if (type === 'wood_wall') {
        this.placeWoodWall(b.x, b.z, rot);
      } else if (type === 'wood_wall_window') {
        this.placeWoodWallWindow(b.x, b.z, rot);
      } else if (type === 'wood_wall_door') {
        this.placeWoodWallDoor(b.x, b.z, rot);
      } else if (type === 'wood_floor') {
        this.placeWoodFloor(b.x, b.z, rot);
      } else if (type === 'wood_roof') {
        this.placeWoodRoof(b.x, b.z, rot);
      } else if (type === 'wood_box') {
        this.placeWoodBox(b.x, b.z, rot, b.storage);
      } else {
        this.placeWoodBlock(b.x, b.z);
      }
    });
  }

  /**
   * Removes a placed block, crafting table, or structure at (x, z) from scene and physics
   */
  removeBlockAt(x, z, blockType) {
    // 1. Check in placedCraftingTables
    if (blockType === 'crafting_bench' || !blockType) {
      const idx = this.placedCraftingTables.findIndex(t => Math.hypot(t.x - x, t.z - z) < 1.85);
      if (idx !== -1) {
        const table = this.placedCraftingTables[idx];
        this.group.remove(table.group);
        const cIdx = this.treeColliders.indexOf(table.collider);
        if (cIdx !== -1) this.treeColliders.splice(cIdx, 1);
        this.placedCraftingTables.splice(idx, 1);
        return true;
      }
    }

    // 2. Check in placedStructures
    const sIdx = this.placedStructures.findIndex(s =>
      Math.hypot(s.x - x, s.z - z) < 1.85 &&
      (!blockType || blockType === 'log' || s.type === blockType)
    );
    if (sIdx !== -1) {
      const struct = this.placedStructures[sIdx];
      this.group.remove(struct.mesh);
      if (struct.colliders && Array.isArray(struct.colliders)) {
        struct.colliders.forEach(c => {
          const cIdx = this.treeColliders.indexOf(c);
          if (cIdx !== -1) this.treeColliders.splice(cIdx, 1);
        });
      }
      if (struct.collider) {
        const cIdx = this.treeColliders.indexOf(struct.collider);
        if (cIdx !== -1) this.treeColliders.splice(cIdx, 1);
      }
      this.placedStructures.splice(sIdx, 1);
      return true;
    }

    // 3. Check in placedBlocks
    const bIdx = this.placedBlocks.findIndex(b => Math.hypot(b.x - x, b.z - z) < 1.85);
    if (bIdx !== -1) {
      const block = this.placedBlocks[bIdx];
      this.group.remove(block.mesh);
      if (block.collider) {
        const cIdx = this.treeColliders.indexOf(block.collider);
        if (cIdx !== -1) this.treeColliders.splice(cIdx, 1);
      }
      this.placedBlocks.splice(bIdx, 1);
      return true;
    }

    return false;
  }

  /**
   * Places a low-poly Wood Log Block on the ground at (x, z)
   */
  placeWoodBlock(x, z) {
    const y = this.getTerrainHeight(x, z);
    if (y < -1.0) return false;

    const blockGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
    const blockMesh = new THREE.Mesh(blockGeo, this.blockMat);
    blockMesh.position.set(x, y + 0.425, z);
    blockMesh.castShadow = true;
    blockMesh.receiveShadow = true;

    this.group.add(blockMesh);

    // Register obstacle collider for placed block
    const collider = { x, z, radius: 0.55 };
    this.treeColliders.push(collider);
    this.placedBlocks.push({ mesh: blockMesh, collider, x, z, y });

    return true;
  }

  /**
   * Updates tree, crafting table, and structure wobbling animations
   */
  update(deltaTime) {
    this.trees.forEach((tree) => {
      if (tree.shakeTimer > 0) {
        tree.shakeTimer -= deltaTime;
        const decay = tree.shakeTimer / 0.45;
        tree.group.rotation.z = Math.sin(tree.shakeTimer * 45) * 0.22 * decay;
        tree.group.rotation.x = Math.cos(tree.shakeTimer * 35) * 0.14 * decay;
      } else {
        tree.group.rotation.z = 0;
        tree.group.rotation.x = 0;
      }
    });

    this.placedCraftingTables.forEach((table) => {
      if (table.shakeTimer > 0) {
        table.shakeTimer -= deltaTime;
        const decay = table.shakeTimer / 0.45;
        table.group.rotation.z = Math.sin(table.shakeTimer * 45) * 0.18 * decay;
        table.group.rotation.x = Math.cos(table.shakeTimer * 35) * 0.12 * decay;
      } else {
        table.group.rotation.z = 0;
        table.group.rotation.x = 0;
      }
    });

    this.placedStructures.forEach((struct) => {
      if (struct.shakeTimer > 0) {
        struct.shakeTimer -= deltaTime;
        const decay = struct.shakeTimer / 0.45;
        struct.mesh.rotation.z = Math.sin(struct.shakeTimer * 45) * 0.18 * decay;
        struct.mesh.rotation.x = Math.cos(struct.shakeTimer * 35) * 0.12 * decay;
      } else {
        struct.mesh.rotation.z = 0;
        struct.mesh.rotation.x = 0;
      }
    });
  }
}
