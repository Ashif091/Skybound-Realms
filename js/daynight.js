import * as THREE from 'three';

/**
 * Real-Time Synced 12-Minute Day & Night Cycle System (6 min Day, 6 min Night)
 * & 30-Minute Weather Cycle (5 mins Rain per 30 mins)
 * Synchronized directly to real-world system clock time (Date.now()).
 */
export class DayNightCycle {
  constructor(scene) {
    this.scene = scene;
    
    // Cycle Durations (6 mins Day, 6 mins Night = 12 mins Total)
    this.dayDuration = 360;   // 360 seconds (6 minutes)
    this.nightDuration = 360; // 360 seconds (6 minutes)
    this.cycleDuration = this.dayDuration + this.nightDuration; // 720 seconds (12 minutes)
    
    // 30-Minute Rain Weather Cycle (1800 seconds)
    this.rainCycleDuration = 1800; // 30 minutes
    this.rainWindowDuration = 300;  // 5 minutes rain window (starts at minute 25 = 1500s)
    this.currentRainIntensity = 0.0;

    this.orbitRadius = 150;

    this.initCelestialBodies();
    this.initStarfield();
    this.initClouds();
    this.initRainSystem();
  }

  initCelestialBodies() {
    this.celestialGroup = new THREE.Group();

    // 1. Sun (Bright Warm Sphere + Directional Light + Shadows)
    const sunGeo = new THREE.SphereGeometry(6, 12, 12);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffbdb });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);

    // Sun Glow Halo
    const sunHaloGeo = new THREE.SphereGeometry(9, 12, 12);
    const sunHaloMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.35
    });
    this.sunHalo = new THREE.Mesh(sunHaloGeo, sunHaloMat);
    this.sunMesh.add(this.sunHalo);

    // Sun Directional Light with High Quality PCF Soft Shadows
    this.sunLight = new THREE.DirectionalLight(0xfff5d6, 0.95);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 1.0;
    this.sunLight.shadow.camera.far = 450;
    this.sunLight.shadow.camera.left = -65;
    this.sunLight.shadow.camera.right = 65;
    this.sunLight.shadow.camera.top = 65;
    this.sunLight.shadow.camera.bottom = -65;
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 0.02;

    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.celestialGroup.add(this.sunMesh);

    // 2. Moon (Pale Silver Sphere + Cool Blue Light + Shadows)
    const moonGeo = new THREE.SphereGeometry(4.5, 10, 10);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);

    // Moon Glow Halo
    const moonHaloGeo = new THREE.SphereGeometry(6.8, 10, 10);
    const moonHaloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.25
    });
    this.moonHalo = new THREE.Mesh(moonHaloGeo, moonHaloMat);
    this.moonMesh.add(this.moonHalo);

    // Moon Directional Light with Soft Night Shadows
    this.moonLight = new THREE.DirectionalLight(0x93c5fd, 0.35);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.width = 2048;
    this.moonLight.shadow.mapSize.height = 2048;
    this.moonLight.shadow.camera.near = 1.0;
    this.moonLight.shadow.camera.far = 450;
    this.moonLight.shadow.camera.left = -65;
    this.moonLight.shadow.camera.right = 65;
    this.moonLight.shadow.camera.top = 65;
    this.moonLight.shadow.camera.bottom = -65;
    this.moonLight.shadow.bias = -0.0003;
    this.moonLight.shadow.normalBias = 0.02;

    this.scene.add(this.moonLight);
    this.scene.add(this.moonLight.target);

    this.celestialGroup.add(this.moonMesh);
    this.scene.add(this.celestialGroup);
  }

  /**
   * Generates twinkling night sky stars
   */
  initStarfield() {
    const starCount = 450;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starScales = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);

      const r = 210 + Math.random() * 20;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = Math.abs(r * Math.sin(phi) * Math.sin(theta)) + 15;
      const z = r * Math.cos(phi);

      starPositions[i * 3] = x;
      starPositions[i * 3 + 1] = y;
      starPositions[i * 3 + 2] = z;
      starScales[i] = 1.0 + Math.random() * 2.0;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    this.starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.2,
      transparent: true,
      opacity: 0.0,
      sizeAttenuation: true
    });

    this.starPoints = new THREE.Points(starGeo, this.starMaterial);
    this.scene.add(this.starPoints);
  }

  /**
   * Generates floating 3D volumetric low-poly clouds
   */
  initClouds() {
    this.cloudGroup = new THREE.Group();
    this.clouds = [];

    this.cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      transparent: true,
      opacity: 0.75,
      roughness: 0.9
    });

    const cloudCount = 18;
    for (let i = 0; i < cloudCount; i++) {
      const singleCloud = new THREE.Group();

      // Compound cloud puff boxes
      const puffCount = 5 + Math.floor(Math.random() * 4);
      for (let p = 0; p < puffCount; p++) {
        const w = 6 + Math.random() * 8;
        const h = 3 + Math.random() * 4;
        const d = 5 + Math.random() * 7;
        const geo = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geo, this.cloudMaterial);
        mesh.position.set(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 10
        );
        singleCloud.add(mesh);
      }

      const x = (Math.random() - 0.5) * 140;
      const z = (Math.random() - 0.5) * 120;
      const y = 45 + Math.random() * 20;

      singleCloud.position.set(x, y, z);
      this.cloudGroup.add(singleCloud);

      this.clouds.push({
        group: singleCloud,
        speed: 1.2 + Math.random() * 1.8,
        startX: x
      });
    }

    this.scene.add(this.cloudGroup);
  }

  /**
   * Generates 3D falling rain particles
   */
  initRainSystem() {
    const particleCount = 2000;
    const rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = Math.random() * 50;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }

    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.rainMaterial = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.45,
      transparent: true,
      opacity: 0.0,
      sizeAttenuation: true
    });

    this.rainParticles = new THREE.Points(rainGeo, this.rainMaterial);
    this.scene.add(this.rainParticles);
  }

  /**
   * Updates celestial orbits, weather, clouds, sky colors, fog, and rain
   */
  update(deltaTime, ambientLight, hemiLight, avatarPos = null) {
    // Real-world clock time calculation (synced to system Date.now())
    const now = new Date();
    const realSecondsToday = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
    
    // Cycle is 720 seconds (12 mins total):
    // 0s to 360s = DAY (6 mins), starting at 12:00am, 12:12am, 12:24am...
    // 360s to 720s = NIGHT (6 mins), starting at 12:06am, 12:18am, 12:30am...
    this.time = realSecondsToday % this.cycleDuration;
    
    // Normalized cycle progress (0.0 to 1.0)
    const progress = this.time / this.cycleDuration;

    // Angle around celestial orbit (0 to 2*PI)
    const sunAngle = progress * Math.PI * 2;
    const moonAngle = sunAngle + Math.PI;

    // Sun Position (rises in east, sets in west)
    this.sunMesh.position.set(
      Math.cos(sunAngle) * this.orbitRadius,
      Math.sin(sunAngle) * this.orbitRadius,
      Math.sin(sunAngle * 0.5) * 30
    );

    // Moon Position (opposite to sun)
    this.moonMesh.position.set(
      Math.cos(moonAngle) * this.orbitRadius,
      Math.sin(moonAngle) * this.orbitRadius,
      Math.sin(moonAngle * 0.5) * 30
    );

    // Sync Directional Lights with Celestial Bodies
    this.sunLight.position.copy(this.sunMesh.position);
    this.moonLight.position.copy(this.moonMesh.position);

    // Center shadow frustum around player avatar (or island center)
    const targetX = avatarPos ? avatarPos.x : 0;
    const targetZ = avatarPos ? avatarPos.z : 0;
    this.sunLight.target.position.set(targetX, 0, targetZ);
    this.moonLight.target.position.set(targetX, 0, targetZ);
    this.sunLight.target.updateMatrixWorld();
    this.moonLight.target.updateMatrixWorld();

    // Sun elevation factor (-1 to +1)
    const sunHeightRatio = Math.sin(sunAngle);
    const isDayNow = sunHeightRatio > 0;

    if (isDayNow && !this.wasDay) {
      if (this.onNewDayCallback) {
        this.onNewDayCallback();
      }
    }
    this.wasDay = isDayNow;

    // Active Shadow Switch: Sun vs Moon
    if (sunHeightRatio > 0.0) {
      this.sunLight.castShadow = true;
      this.moonLight.castShadow = false;
    } else {
      this.sunLight.castShadow = false;
      this.moonLight.castShadow = true;
    }

    // ── 30-Minute Rain Weather Cycle Calculation ─────────────────────────────
    // Rain occurs for 5 minutes (300s) during minutes 25..30 of every 30-min block
    const rainCycleTime = realSecondsToday % this.rainCycleDuration; // 0s to 1800s
    const rainStartTime = 1500; // 25th minute mark (1500 seconds)
    let rainIntensity = 0.0;

    if (rainCycleTime >= rainStartTime) {
      const rainElapsed = rainCycleTime - rainStartTime; // 0s to 300s (5 minutes)
      
      if (rainElapsed < 180) { // Minute 0 to 3: Rain begins light, ramps up to heavy intensity by 3rd minute
        rainIntensity = rainElapsed / 180;
      } else if (rainElapsed <= 240) { // Minute 3 to 4: Peak heavy rain downpour
        rainIntensity = 1.0;
      } else { // Minute 4 to 5: Rain eases off and stops completely by 5th minute (300s)
        rainIntensity = 1.0 - ((rainElapsed - 240) / 60);
      }
    }

    rainIntensity = Math.max(0.0, Math.min(1.0, rainIntensity));
    this.currentRainIntensity = rainIntensity;

    // ── Color Palettes ───────────────────────────────────────────────────────
    const daySky = new THREE.Color(0x38bdf8);      // Bright vibrant day blue
    const sunsetSky = new THREE.Color(0xf97316);   // Golden orange sunset/sunrise
    const nightSky = new THREE.Color(0x070a13);    // Deep midnight star sky
    const stormSky = new THREE.Color(0x334155);    // Dark slate gray storm sky

    let targetSkyColor = new THREE.Color();
    let starOpacity = 0;
    let sunIntensity = 0;
    let moonIntensity = 0;
    let ambientIntensity = 0.75;

    if (sunHeightRatio > 0.15) {
      // FULL DAYTIME
      targetSkyColor.copy(daySky);
      starOpacity = 0;
      sunIntensity = 0.95;
      moonIntensity = 0;
      ambientIntensity = 0.8;
      this.sunLight.color.setHex(0xfff5d6);
      if (hemiLight) {
        hemiLight.color.setHex(0xe0f2fe);
        hemiLight.groundColor.setHex(0x86efac);
      }
    } else if (sunHeightRatio >= -0.15 && sunHeightRatio <= 0.15) {
      // SUNSET / SUNRISE TRANSITION (Golden hour long dynamic shadows!)
      const t = (sunHeightRatio + 0.15) / 0.3; // 0 (night boundary) to 1 (day boundary)
      if (t > 0.5) {
        targetSkyColor.copy(sunsetSky).lerp(daySky, (t - 0.5) * 2);
      } else {
        targetSkyColor.copy(nightSky).lerp(sunsetSky, t * 2);
      }
      starOpacity = (1 - t) * 0.7;
      sunIntensity = t * 0.6;
      moonIntensity = (1 - t) * 0.25;
      ambientIntensity = 0.35 + t * 0.4;
      this.sunLight.color.setHex(0xffaa55); // Warm golden sunset light
      if (hemiLight) {
        hemiLight.color.setHex(0xfde047);
        hemiLight.groundColor.setHex(0x4ade80);
      }
    } else {
      // FULL NIGHTTIME (Stars visible, moon casts cool night shadows!)
      targetSkyColor.copy(nightSky);
      starOpacity = 0.95;
      sunIntensity = 0;
      moonIntensity = 0.35;
      ambientIntensity = 0.25;
      this.moonLight.color.setHex(0x93c5fd);
      if (hemiLight) {
        hemiLight.color.setHex(0x1e3a8a);
        hemiLight.groundColor.setHex(0x064e3b);
      }
    }

    // Blend storm sky color during rain
    if (rainIntensity > 0) {
      targetSkyColor.lerp(stormSky, rainIntensity * 0.75);
      ambientIntensity *= (1.0 - rainIntensity * 0.4);
      starOpacity *= (1.0 - rainIntensity);
    }

    // Apply smooth color lerp to Scene background & Fog
    this.scene.background.lerp(targetSkyColor, 0.05);
    if (this.scene.fog) {
      this.scene.fog.color.lerp(targetSkyColor, 0.05);
    }

    // Apply Light Intensities
    this.sunLight.intensity = sunIntensity * (1.0 - rainIntensity * 0.5);
    this.moonLight.intensity = moonIntensity * (1.0 - rainIntensity * 0.5);
    if (ambientLight) {
      ambientLight.intensity = THREE.MathUtils.lerp(ambientLight.intensity, ambientIntensity, 0.05);
    }

    // Apply Starfield Opacity
    this.starMaterial.opacity = THREE.MathUtils.lerp(this.starMaterial.opacity, starOpacity, 0.05);
    if (this.starPoints) {
      this.starPoints.rotation.y += deltaTime * 0.005;
    }

    // ── Update 3D Rain Particle System ──────────────────────────────────────
    if (this.rainParticles && this.rainMaterial) {
      this.rainMaterial.opacity = THREE.MathUtils.lerp(this.rainMaterial.opacity, rainIntensity * 0.8, 0.05);

      if (rainIntensity > 0) {
        const positions = this.rainParticles.geometry.attributes.position.array;
        const fallSpeed = (30 + rainIntensity * 25) * deltaTime;

        for (let i = 0; i < positions.length / 3; i++) {
          positions[i * 3 + 1] -= fallSpeed;
          if (positions[i * 3 + 1] < 0) {
            positions[i * 3 + 1] = 45 + Math.random() * 20;
            positions[i * 3] = (Math.random() - 0.5) * 80;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
          }
        }
        this.rainParticles.geometry.attributes.position.needsUpdate = true;
      }
    }

    // ── Update Dynamic Clouds & Opacity ──────────────────────────────────────
    if (this.clouds && this.cloudMaterial) {
      const targetCloudColor = new THREE.Color(0xffffff);
      const stormCloudColor = new THREE.Color(0x334155);
      const nightCloudColor = new THREE.Color(0x1e293b);

      if (rainIntensity > 0) {
        targetCloudColor.lerp(stormCloudColor, rainIntensity * 0.85);
      } else if (!isDayNow) {
        targetCloudColor.lerp(nightCloudColor, 0.7);
      }

      this.cloudMaterial.color.lerp(targetCloudColor, 0.05);

      let targetOpacity = 0.7 + rainIntensity * 0.25;
      if (!isDayNow && rainIntensity === 0) targetOpacity = 0.45;
      this.cloudMaterial.opacity = THREE.MathUtils.lerp(this.cloudMaterial.opacity, targetOpacity, 0.05);

      // Drift clouds across the sky
      this.clouds.forEach(c => {
        c.group.position.x += c.speed * deltaTime;
        if (c.group.position.x > 90) {
          c.group.position.x = -90;
        }
      });
    }
  }
}
