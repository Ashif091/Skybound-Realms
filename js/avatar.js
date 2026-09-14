import * as THREE from 'three';

export const AVATAR_PALETTES = {
  shirts: [0x00b4d8, 0xef4444, 0x10b981, 0x8b5cf6, 0xf59e0b, 0xec4899, 0x3b82f6, 0x14b8a6, 0x6366f1],
  pants: [0x3f51b5, 0x1e293b, 0x475569, 0x7c2d12, 0x064e3b, 0x581c87, 0x1e1b4b],
  skin: [0xe5b799, 0xf5d0b5, 0xd4a373, 0x8d5524, 0xc68642, 0xe0ac69, 0xffdbac],
  hair: [0x3e2723, 0x1a1a1a, 0x78350f, 0xca8a04, 0xb45309, 0x451a03]
};

export function getRandomAvatarColors() {
  return {
    shirt: AVATAR_PALETTES.shirts[Math.floor(Math.random() * AVATAR_PALETTES.shirts.length)],
    pants: AVATAR_PALETTES.pants[Math.floor(Math.random() * AVATAR_PALETTES.pants.length)],
    skin: AVATAR_PALETTES.skin[Math.floor(Math.random() * AVATAR_PALETTES.skin.length)],
    hair: AVATAR_PALETTES.hair[Math.floor(Math.random() * AVATAR_PALETTES.hair.length)]
  };
}

/**
 * Minecraft Steve Style Player Avatar
 * Features refined skin tone, white/blue eyes, nose & mouth details,
 * customizable shirt, pants & hair colors, and 3D Overhead Name Badge.
 */
export class Avatar {
  constructor(scene, colors = null, name = 'Steve') {
    this.scene = scene;
    this.name = name;
    this.colors = colors || getRandomAvatarColors();
    
    // Avatar Root Group
    this.group = new THREE.Group();
    
    // Physics & Movement State
    this.position = new THREE.Vector3(-15, 5, 0); // Start on lush plains
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotation = 0; // Facing angle in radians
    this.targetRotation = 0;
    
    this.isGrounded = true;
    this.moveSpeed = 0;
    this.animTime = 0;

    this.isDead = false;
    this.radius = 0.45; // Avatar collision radius
    
    this.punchTimer = 0;
    
    this.buildMesh();
    this.createNameTag(name);
    this.scene.add(this.group);
  }

  punch() {
    this.punchTimer = 0.28;
  }

  applyKnockback(fromX, fromZ, force = 8.0) {
    const dx = this.position.x - fromX;
    const dz = this.position.z - fromZ;
    let len = Math.hypot(dx, dz);
    if (len < 0.001) len = 1;
    
    // Velocity impulse away from hit source
    this.velocity.x += (dx / len) * force;
    this.velocity.z += (dz / len) * force;
    this.velocity.y = Math.max(this.velocity.y, 4.0); // Upward pop effect
    this.isGrounded = false;
  }

  rebuildColors(newColors) {
    this.colors = newColors;
    // Remove existing children from group
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    this.buildMesh();
    this.createNameTag(this.name);
  }

  updateNameTag(newName) {
    this.name = newName;
    if (this.nameTagMesh) {
      this.group.remove(this.nameTagMesh);
    }
    this.createNameTag(newName);
  }

  buildMesh() {
    const skinColor = this.colors.skin || 0xe5b799;
    const shirtColor = this.colors.shirt || 0x00b4d8;
    const pantsColor = this.colors.pants || 0x3f51b5;
    const hairColor = this.colors.hair || 0x3e2723;

    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, flatShading: true, roughness: 0.6 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, flatShading: true, roughness: 0.5 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, flatShading: true, roughness: 0.7 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, flatShading: true, roughness: 0.5 });
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, flatShading: true, roughness: 0.8 });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true });
    const eyePupilMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5, flatShading: true });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x7a5238, flatShading: true });
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x543725, flatShading: true });

    // 1. Torso / Body (Cyan Teal Shirt)
    const torsoGeo = new THREE.BoxGeometry(0.70, 0.85, 0.38);
    this.torso = new THREE.Mesh(torsoGeo, shirtMat);
    this.torso.position.y = 1.10;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    // 2. Head (Sitting directly connected on top of torso with ZERO gap)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.425, 0); // Directly connected to torso top
    this.torso.add(this.headGroup);

    const headGeo = new THREE.BoxGeometry(0.50, 0.50, 0.50);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.position.y = 0.25;
    this.headGroup.add(headMesh);

    // Hair Top (Slightly larger height/position to prevent coplanar face Z-fighting reflection glitch on head top)
    const hairTopGeo = new THREE.BoxGeometry(0.53, 0.22, 0.53);
    const hairTop = new THREE.Mesh(hairTopGeo, hairMat);
    hairTop.position.set(0, 0.415, 0);
    this.headGroup.add(hairTop);

    // Hair Forehead Fringe
    const hairFringeGeo = new THREE.BoxGeometry(0.52, 0.10, 0.12);
    const hairFringe = new THREE.Mesh(hairFringeGeo, hairMat);
    hairFringe.position.set(0, 0.41, 0.20);
    this.headGroup.add(hairFringe);

    // Hair Back & Sides
    const hairBackGeo = new THREE.BoxGeometry(0.52, 0.26, 0.26);
    const hairBack = new THREE.Mesh(hairBackGeo, hairMat);
    hairBack.position.set(0, 0.25, -0.13);
    this.headGroup.add(hairBack);

    // --- Face Details: Minecraft Eyes (White Sclera + Blue/Purple Pupil) ---
    const eyeWhiteGeo = new THREE.BoxGeometry(0.09, 0.07, 0.02);
    const eyePupilGeo = new THREE.BoxGeometry(0.09, 0.07, 0.02);

    // Left Eye (Outer White, Inner Blue Pupil)
    const leftEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    leftEyeWhite.position.set(-0.18, 0.25, 0.252);
    this.headGroup.add(leftEyeWhite);

    const leftEyePupil = new THREE.Mesh(eyePupilGeo, eyePupilMat);
    leftEyePupil.position.set(-0.09, 0.25, 0.252);
    this.headGroup.add(leftEyePupil);

    // Right Eye (Inner Blue Pupil, Outer White)
    const rightEyePupil = new THREE.Mesh(eyePupilGeo, eyePupilMat);
    rightEyePupil.position.set(0.09, 0.25, 0.252);
    this.headGroup.add(rightEyePupil);

    const rightEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    rightEyeWhite.position.set(0.18, 0.25, 0.252);
    this.headGroup.add(rightEyeWhite);

    // --- Face Details: Nose & Mouth ---
    // Nose Accent (Center between eyes)
    const noseGeo = new THREE.BoxGeometry(0.12, 0.06, 0.02);
    const noseMesh = new THREE.Mesh(noseGeo, noseMat);
    noseMesh.position.set(0, 0.18, 0.252);
    this.headGroup.add(noseMesh);

    // Mouth / Beard Line (Directly under nose)
    const mouthGeo = new THREE.BoxGeometry(0.24, 0.06, 0.02);
    const mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
    mouthMesh.position.set(0, 0.11, 0.252);
    this.headGroup.add(mouthMesh);

    // 3. Left & Right Sleeved Arms (Zero-Gap Connection)
    // Left Arm
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.38, 0.35, 0); // Shoulder pivot flush against torso
    
    const sleeveGeo = new THREE.BoxGeometry(0.24, 0.28, 0.24);
    const leftSleeve = new THREE.Mesh(sleeveGeo, shirtMat);
    leftSleeve.position.set(-0.07, -0.14, 0);
    this.leftArmGroup.add(leftSleeve);

    const armSkinGeo = new THREE.BoxGeometry(0.24, 0.47, 0.24);
    const leftArmSkin = new THREE.Mesh(armSkinGeo, skinMat);
    leftArmSkin.position.set(-0.07, -0.505, 0);
    this.leftArmGroup.add(leftArmSkin);

    this.torso.add(this.leftArmGroup);

    // Right Arm
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.38, 0.35, 0); // Shoulder pivot flush against torso
    
    const rightSleeve = new THREE.Mesh(sleeveGeo, shirtMat);
    const rightSleeveMesh = new THREE.Mesh(sleeveGeo, shirtMat);
    rightSleeveMesh.position.set(0.07, -0.14, 0);
    this.rightArmGroup.add(rightSleeveMesh);

    const rightArmSkin = new THREE.Mesh(armSkinGeo, skinMat);
    rightArmSkin.position.set(0.07, -0.505, 0);
    this.rightArmGroup.add(rightArmSkin);

    this.torso.add(this.rightArmGroup);

    // 4. Left & Right Legs (Indigo Pants + Grey Shoes, Zero-Gap Connection)
    const legPantsGeo = new THREE.BoxGeometry(0.28, 0.62, 0.28);
    const shoeBottomGeo = new THREE.BoxGeometry(0.28, 0.14, 0.28);

    // Left Leg
    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-0.17, 0.68, 0); // Hip pivot inside torso bottom

    const leftPants = new THREE.Mesh(legPantsGeo, pantsMat);
    leftPants.position.y = -0.31;
    this.leftLegGroup.add(leftPants);

    const leftShoe = new THREE.Mesh(shoeBottomGeo, shoeMat);
    leftShoe.position.y = -0.69;
    this.leftLegGroup.add(leftShoe);

    this.group.add(this.leftLegGroup);

    // Right Leg
    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(0.17, 0.68, 0); // Hip pivot inside torso bottom

    const rightPants = new THREE.Mesh(legPantsGeo, pantsMat);
    rightPants.position.y = -0.31;
    this.rightLegGroup.add(rightPants);

    const rightShoe = new THREE.Mesh(shoeBottomGeo, shoeMat);
    rightShoe.position.y = -0.69;
    this.rightLegGroup.add(rightShoe);

    this.group.add(this.rightLegGroup);

    // Set shadow options across character mesh
    this.group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  /**
   * Creates 3D Overhead Name Badge Texture above Head
   */
  createNameTag(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Translucent Dark Pill Background (Cross-browser rounded rect)
    const x = 8, y = 8, w = 240, h = 48, r = 12;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fill();

    // Cyan Border
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Name Text
    ctx.font = 'bold 22px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const planeGeo = new THREE.PlaneGeometry(1.6, 0.4);
    const planeMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide
    });

    this.nameTagMesh = new THREE.Mesh(planeGeo, planeMat);
    this.nameTagMesh.position.set(0, 2.35, 0);
    this.group.add(this.nameTagMesh);
  }

  /**
   * Updates avatar position, facing angle, tree collision, and void death check
   */
  update(deltaTime, currentTerrainHeight, treeColliders = [], camera = null, island = null) {
    if (this.isDead) return;

    // Billboard Overhead Name Tag toward Camera
    if (this.nameTagMesh && camera) {
      this.nameTagMesh.lookAt(camera.position);
    }

    // Smooth rotation interpolation without vibration
    let rotDiff = this.targetRotation - this.rotation;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    this.rotation += rotDiff * Math.min(1.0, 25 * deltaTime);
    this.group.rotation.y = this.rotation;

    // Apply Velocity
    this.position.x += this.velocity.x * deltaTime;
    this.position.z += this.velocity.z * deltaTime;

    // Damping horizontal knockback velocity
    this.velocity.x *= Math.pow(0.001, deltaTime);
    this.velocity.z *= Math.pow(0.001, deltaTime);
    if (Math.abs(this.velocity.x) < 0.01) this.velocity.x = 0;
    if (Math.abs(this.velocity.z) < 0.01) this.velocity.z = 0;

    // Tree Obstacle Collision Resolution
    treeColliders.forEach((tree) => {
      const dx = this.position.x - tree.x;
      const dz = this.position.z - tree.z;
      const dist = Math.hypot(dx, dz);
      const minDist = this.radius + tree.radius;

      if (dist < minDist && dist > 0.001) {
        const overlap = minDist - dist;
        this.position.x += (dx / dist) * overlap;
        this.position.z += (dz / dist) * overlap;
      }
    });

    // Calculate structure floor ground heights and roof ceiling heights
    let effectiveGroundY = currentTerrainHeight;
    let ceilingY = 999;

    if (island && typeof island.getStructureHeightAndCeiling === 'function') {
      const structPhysics = island.getStructureHeightAndCeiling(this.position.x, this.position.z, this.position.y);
      if (structPhysics.groundY > effectiveGroundY) {
        effectiveGroundY = structPhysics.groundY;
      }
      ceilingY = structPhysics.ceilingY;
    }

    // Pre-movement Strict Roof Ceiling Head Collision (Capping upward jump before passing through)
    if (this.position.y + 1.8 >= ceilingY) {
      this.position.y = ceilingY - 1.8;
      if (this.velocity.y > 0) {
        this.velocity.y = 0;
      }
    }

    // Smooth Terrain / Floor / Roof / Stairs Height Snap & Gravity
    const targetY = effectiveGroundY;

    // Unground immediately when stepping off cliff edge into deep drop-off
    if (targetY < -1.0 || targetY < this.position.y - 1.2) {
      this.isGrounded = false;
    }

    const yDiff = targetY - this.position.y;

    if (this.isGrounded) {
      // High-speed step-up response when walking up slopes & connected stairs
      const lerpSpeed = (yDiff > 0 && yDiff <= 0.85) ? 35 : 22;
      this.position.y += yDiff * Math.min(1.0, lerpSpeed * deltaTime);
      if (Math.abs(yDiff) < 0.005) {
        this.position.y = targetY;
      }
      this.velocity.y = 0;
    } else {
      // Apply gravity when falling off edge or jumping
      this.position.y += this.velocity.y * deltaTime;
      this.velocity.y -= 26 * deltaTime;

      if (this.position.y <= targetY && targetY >= -1.0) {
        this.position.y = targetY;
        this.velocity.y = 0;
        this.isGrounded = true;
      }
    }

    // Post-movement Strict Roof Ceiling Head Collision (Zero clipping guaranteed)
    if (this.position.y + 1.8 >= ceilingY) {
      this.position.y = ceilingY - 1.8;
      if (this.velocity.y > 0) {
        this.velocity.y = 0;
      }
    }

    // Void Death Check (Fell off floating island into void)
    if (this.position.y < -15.0) {
      this.isDead = true;
    }

    this.group.position.copy(this.position);

    // Procedural Limb Walking Animation
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    
    if (horizontalSpeed > 0.1 && this.isGrounded) {
      this.animTime += deltaTime * horizontalSpeed * 2.8;
      const legAngle = Math.sin(this.animTime) * 0.5;
      const armAngle = Math.sin(this.animTime) * 0.5;

      // Legs swing opposite
      this.leftLegGroup.rotation.x = legAngle;
      this.rightLegGroup.rotation.x = -legAngle;

      // Arms swing opposite to legs
      this.leftArmGroup.rotation.x = -armAngle;
      this.rightArmGroup.rotation.x = armAngle;

      // Smooth subtle torso bobbing
      this.torso.position.y = 1.10 + Math.abs(Math.sin(this.animTime * 2)) * 0.04;
    } else {
      // Idle Pose Restoration
      this.animTime += deltaTime * 2;
      const idleBob = Math.sin(this.animTime) * 0.015;

      this.leftLegGroup.rotation.x *= 0.85;
      this.rightLegGroup.rotation.x *= 0.85;
      this.leftArmGroup.rotation.x *= 0.85;
      this.rightArmGroup.rotation.x *= 0.85;

      this.torso.position.y = 1.10 + idleBob;
    }

    // Right Arm Punch Swing Override
    if (this.punchTimer > 0) {
      this.punchTimer -= deltaTime;
      const punchProgress = (0.28 - this.punchTimer) / 0.28;
      const punchSwing = Math.sin(punchProgress * Math.PI) * 2.1;
      this.rightArmGroup.rotation.x = -punchSwing;
      this.rightArmGroup.rotation.z = Math.sin(punchProgress * Math.PI) * 0.45;
    }
  }

  jump() {
    if (this.isGrounded && !this.isDead) {
      this.velocity.y = 9.5;
      this.isGrounded = false;
    }
  }

  reset(x = -15, z = 0, terrainHeight = 2) {
    this.position.set(x, terrainHeight, z);
    this.velocity.set(0, 0, 0);
    this.rotation = 0;
    this.targetRotation = 0;
    this.isDead = false;
  }
}
