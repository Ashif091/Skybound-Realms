import * as THREE from 'three';

/**
 * Remote Multiplayer Player Avatar
 * Features unique custom skin palette colors, smooth position/rotation interpolation,
 * walking animation, arm punch swing, and 3D Overhead Name Badge.
 */
export class RemotePlayer {
  constructor(scene, data) {
    this.scene = scene;
    this.id = data.id;
    this.name = data.name || 'Player';
    this.colors = data.colors || {};

    this.group = new THREE.Group();
    this.position = new THREE.Vector3(data.x || -15, data.y || 5, data.z || 0);
    this.targetPosition = new THREE.Vector3().copy(this.position);
    this.rotation = data.rotation || 0;
    this.targetRotation = data.rotation || 0;

    this.animTime = 0;
    this.punchTimer = 0;
    this.isMoving = false;

    this.buildMesh();
    this.createNameTag();

    this.group.position.copy(this.position);
    this.group.rotation.y = this.rotation;
    this.scene.add(this.group);
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

    // 1. Torso
    const torsoGeo = new THREE.BoxGeometry(0.70, 0.85, 0.38);
    this.torso = new THREE.Mesh(torsoGeo, shirtMat);
    this.torso.position.y = 1.10;
    this.group.add(this.torso);

    // 2. Head
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.425, 0);
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

    // Hair Fringe
    const hairFringeGeo = new THREE.BoxGeometry(0.52, 0.10, 0.12);
    const hairFringe = new THREE.Mesh(hairFringeGeo, hairMat);
    hairFringe.position.set(0, 0.41, 0.20);
    this.headGroup.add(hairFringe);

    // Hair Back
    const hairBackGeo = new THREE.BoxGeometry(0.52, 0.26, 0.26);
    const hairBack = new THREE.Mesh(hairBackGeo, hairMat);
    hairBack.position.set(0, 0.25, -0.13);
    this.headGroup.add(hairBack);

    // Eyes
    const eyeWhiteGeo = new THREE.BoxGeometry(0.09, 0.07, 0.02);
    const eyePupilGeo = new THREE.BoxGeometry(0.09, 0.07, 0.02);

    const leftEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    leftEyeWhite.position.set(-0.18, 0.25, 0.252);
    this.headGroup.add(leftEyeWhite);

    const leftEyePupil = new THREE.Mesh(eyePupilGeo, eyePupilMat);
    leftEyePupil.position.set(-0.09, 0.25, 0.252);
    this.headGroup.add(leftEyePupil);

    const rightEyePupil = new THREE.Mesh(eyePupilGeo, eyePupilMat);
    rightEyePupil.position.set(0.09, 0.25, 0.252);
    this.headGroup.add(rightEyePupil);

    const rightEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    rightEyeWhite.position.set(0.18, 0.25, 0.252);
    this.headGroup.add(rightEyeWhite);

    // Nose & Mouth
    const noseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.02), noseMat);
    noseMesh.position.set(0, 0.18, 0.252);
    this.headGroup.add(noseMesh);

    const mouthMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.02), mouthMat);
    mouthMesh.position.set(0, 0.11, 0.252);
    this.headGroup.add(mouthMesh);

    // 3. Arms
    const sleeveGeo = new THREE.BoxGeometry(0.24, 0.28, 0.24);
    const armSkinGeo = new THREE.BoxGeometry(0.24, 0.47, 0.24);

    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.38, 0.35, 0);
    const leftSleeve = new THREE.Mesh(sleeveGeo, shirtMat);
    leftSleeve.position.set(-0.07, -0.14, 0);
    this.leftArmGroup.add(leftSleeve);
    const leftArmSkin = new THREE.Mesh(armSkinGeo, skinMat);
    leftArmSkin.position.set(-0.07, -0.505, 0);
    this.leftArmGroup.add(leftArmSkin);
    this.torso.add(this.leftArmGroup);

    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.38, 0.35, 0);
    const rightSleeve = new THREE.Mesh(sleeveGeo, shirtMat);
    rightSleeve.position.set(0.07, -0.14, 0);
    this.rightArmGroup.add(rightSleeve);
    const rightArmSkin = new THREE.Mesh(armSkinGeo, skinMat);
    rightArmSkin.position.set(0.07, -0.505, 0);
    this.rightArmGroup.add(rightArmSkin);
    this.torso.add(this.rightArmGroup);

    // 4. Legs
    const legPantsGeo = new THREE.BoxGeometry(0.28, 0.62, 0.28);
    const shoeBottomGeo = new THREE.BoxGeometry(0.28, 0.14, 0.28);

    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-0.17, 0.68, 0);
    const leftPants = new THREE.Mesh(legPantsGeo, pantsMat);
    leftPants.position.y = -0.31;
    this.leftLegGroup.add(leftPants);
    const leftShoe = new THREE.Mesh(shoeBottomGeo, shoeMat);
    leftShoe.position.y = -0.69;
    this.leftLegGroup.add(leftShoe);
    this.group.add(this.leftLegGroup);

    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(0.17, 0.68, 0);
    const rightPants = new THREE.Mesh(legPantsGeo, pantsMat);
    rightPants.position.y = -0.31;
    this.rightLegGroup.add(rightPants);
    const rightShoe = new THREE.Mesh(shoeBottomGeo, shoeMat);
    rightShoe.position.y = -0.69;
    this.rightLegGroup.add(rightShoe);
    this.group.add(this.rightLegGroup);

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
  createNameTag() {
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

    // Border
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Name Text
    ctx.font = 'bold 22px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.name, 128, 32);

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

  punch() {
    this.punchTimer = 0.28;
  }

  takeHit() {
    this.hitTimer = 0.35;
  }

  updateData(data) {
    this.targetPosition.set(data.x, data.y, data.z);
    this.targetRotation = data.rotation;
  }

  update(deltaTime, camera) {
    // Position Lerp Interpolation
    const distToTarget = this.position.distanceTo(this.targetPosition);
    this.isMoving = distToTarget > 0.08;

    this.position.lerp(this.targetPosition, Math.min(1.0, 15 * deltaTime));
    
    // Rotation Lerp Interpolation
    let rotDiff = this.targetRotation - this.rotation;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    this.rotation += rotDiff * Math.min(1.0, 15 * deltaTime);

    this.group.position.copy(this.position);
    this.group.rotation.y = this.rotation;

    // Billboard Overhead Name Tag toward Camera
    if (this.nameTagMesh && camera) {
      this.nameTagMesh.lookAt(camera.position);
    }

    // Walking Animation
    if (this.isMoving) {
      this.animTime += deltaTime * 12.0;
      const legAngle = Math.sin(this.animTime) * 0.5;
      const armAngle = Math.sin(this.animTime) * 0.5;

      this.leftLegGroup.rotation.x = legAngle;
      this.rightLegGroup.rotation.x = -legAngle;
      this.leftArmGroup.rotation.x = -armAngle;
      this.rightArmGroup.rotation.x = armAngle;
    } else {
      this.animTime += deltaTime * 2;
      this.leftLegGroup.rotation.x *= 0.85;
      this.rightLegGroup.rotation.x *= 0.85;
      this.leftArmGroup.rotation.x *= 0.85;
      this.rightArmGroup.rotation.x *= 0.85;
    }

    // Right Arm Punch Swing Animation
    if (this.punchTimer > 0) {
      this.punchTimer -= deltaTime;
      const punchProgress = (0.28 - this.punchTimer) / 0.28;
      const punchSwing = Math.sin(punchProgress * Math.PI) * 2.1;
      this.rightArmGroup.rotation.x = -punchSwing;
      this.rightArmGroup.rotation.z = Math.sin(punchProgress * Math.PI) * 0.45;
    }

    // Getting Hit Flinch Tilt Animation
    if (this.hitTimer > 0) {
      this.hitTimer -= deltaTime;
      const decay = this.hitTimer / 0.35;
      this.torso.rotation.x = -0.35 * Math.sin(decay * Math.PI);
    } else if (this.punchTimer <= 0) {
      this.torso.rotation.x = 0;
    }
  }

  destroy() {
    this.scene.remove(this.group);
  }
}
