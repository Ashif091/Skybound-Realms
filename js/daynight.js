import * as THREE from 'three';

/**
 * Real-Time Synced 12-Minute Day & Night Cycle System (6 min Day, 6 min Night)
 * Synchronized directly to real-world system clock time (Date.now()).
 * Example: 12:00am = Day Start, 12:06am = Night Start, 12:12am = Day Start...
 */
export class DayNightCycle {
  constructor(scene) {
    this.scene = scene;
    
    // Cycle Durations (6 mins Day, 6 mins Night = 12 mins Total)
    this.dayDuration = 360;  // 360 seconds (6 minutes)
    this.nightDuration = 360; // 360 seconds (6 minutes)
    this.cycleDuration = this.dayDuration + this.nightDuration; // 720 seconds (12 minutes)
    
    this.orbitRadius = 150;

    this.initCelestialBodies();
    this.initStarfield();
  }

  initCelestialBodies() {
    this.celestialGroup = new THREE.Group();

    // 1. Sun (Bright Warm Sphere + Directional Light)
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

    this.sunLight = new THREE.DirectionalLight(0xfff5d6, 0.9);
    this.sunLight.castShadow = true;
    this.sunMesh.add(this.sunLight);

    this.celestialGroup.add(this.sunMesh);

    // 2. Moon (Pale Silver Sphere + Cool Blue Light)
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

    this.moonLight = new THREE.DirectionalLight(0x93c5fd, 0.25);
    this.moonMesh.add(this.moonLight);

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
   * Updates celestial orbits, sky background colors, fog, and star opacity based on Real-World Clock Time
   */
  update(deltaTime, ambientLight, hemiLight) {
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

    // Sun elevation factor (-1 to +1)
    const sunHeightRatio = Math.sin(sunAngle);
    const isDayNow = sunHeightRatio > 0;

    if (isDayNow && !this.wasDay) {
      if (this.onNewDayCallback) {
        this.onNewDayCallback();
      }
    }
    this.wasDay = isDayNow;

    // Color Palettes
    const daySky = new THREE.Color(0x38bdf8);      // Bright vibrant day blue
    const sunsetSky = new THREE.Color(0xf97316);   // Golden orange sunset/sunrise
    const nightSky = new THREE.Color(0x070a13);    // Deep midnight star sky

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
      if (hemiLight) {
        hemiLight.color.setHex(0xe0f2fe);
        hemiLight.groundColor.setHex(0x86efac);
      }
    } else if (sunHeightRatio >= -0.15 && sunHeightRatio <= 0.15) {
      // SUNSET / SUNRISE TRANSITION
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
      if (hemiLight) {
        hemiLight.color.setHex(0xfde047);
        hemiLight.groundColor.setHex(0x4ade80);
      }
    } else {
      // FULL NIGHTTIME (Stars visible!)
      targetSkyColor.copy(nightSky);
      starOpacity = 0.95;
      sunIntensity = 0;
      moonIntensity = 0.35;
      ambientIntensity = 0.25;
      if (hemiLight) {
        hemiLight.color.setHex(0x1e3a8a); // Deep blue night sky light
        hemiLight.groundColor.setHex(0x064e3b); // Soft dark meadow ground light
      }
    }

    // Apply smooth color lerp to Scene background & Fog
    this.scene.background.lerp(targetSkyColor, 0.05);
    if (this.scene.fog) {
      this.scene.fog.color.lerp(targetSkyColor, 0.05);
    }

    // Apply Light Intensities
    this.sunLight.intensity = sunIntensity;
    this.moonLight.intensity = moonIntensity;
    if (ambientLight) {
      ambientLight.intensity = THREE.MathUtils.lerp(ambientLight.intensity, ambientIntensity, 0.05);
    }

    // Apply Starfield Opacity
    this.starMaterial.opacity = THREE.MathUtils.lerp(this.starMaterial.opacity, starOpacity, 0.05);

    // Subtle star rotation for living sky feel
    if (this.starPoints) {
      this.starPoints.rotation.y += deltaTime * 0.005;
    }
  }
}
