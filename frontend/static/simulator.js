// AeroSign — Flying AI 3D Drone Simulator (Three.js client)
//
// Receives gesture commands via WebSocket and animates a quadcopter drone
// inside a 3D city scene with mission objectives, sound, and multiple
// camera views. Designed to be controllable by hand gestures or keyboard.

import * as THREE from "three";

// ---------------------------------------------------------------------------
// DOM hooks
// ---------------------------------------------------------------------------
const sceneEl    = document.getElementById("scene-container");
const camStatus  = document.getElementById("cam-status");
const gestureEl  = document.getElementById("gesture-name");
const altEl      = document.getElementById("hud-altitude");
const spdEl      = document.getElementById("hud-speed");
const hdgEl      = document.getElementById("hud-heading");
const colEl      = document.getElementById("hud-collisions");

// Mission HUD
const ringsEl    = document.getElementById("mission-rings");
const timerEl    = document.getElementById("mission-timer");
const scoreEl    = document.getElementById("mission-score");
const camModeEl  = document.getElementById("cam-mode");
const muteBtn    = document.getElementById("sound-toggle");

// Completion overlay
const completeEl = document.getElementById("mission-complete");
const finalTime  = document.getElementById("final-time");
const finalCol   = document.getElementById("final-collisions");
const finalScore = document.getElementById("final-score");
const restartBtn = document.getElementById("restart-btn");

// Minimap canvas
const minimapCanvas = document.getElementById("minimap");
const minimapCtx    = minimapCanvas.getContext("2d");

// ---------------------------------------------------------------------------
// Three.js scene
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(sceneEl.clientWidth, sceneEl.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
sceneEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b6ff);
scene.fog = new THREE.Fog(0x87b6ff, 60, 220);

// Three camera modes share one PerspectiveCamera; we just relocate it.
const camera = new THREE.PerspectiveCamera(60, sceneEl.clientWidth / sceneEl.clientHeight, 0.1, 800);
camera.position.set(0, 12, 22);
camera.lookAt(0, 4, 0);

// Lights
scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x2a3a1a, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(40, 60, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -80;
sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 200;
scene.add(sun);

// Ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: 0x355c2a, roughness: 0.95 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(200, 40, 0x4a7a36, 0x2c4a1f);
grid.position.y = 0.01;
scene.add(grid);

// ---------------------------------------------------------------------------
// Obstacles (buildings)
// ---------------------------------------------------------------------------
const obstacles = [];
function addBuilding(x, z, w, h, d, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
  );
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  obstacles.push(mesh);

  const winMat = new THREE.MeshStandardMaterial({
    color: 0xffe599, emissive: 0x554a14, emissiveIntensity: 0.4, roughness: 0.3,
  });
  const stripGeom = new THREE.PlaneGeometry(w * 0.85, h * 0.85);
  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(stripGeom, winMat);
    strip.position.set(x + side * (d / 2 + 0.01), h / 2, z);
    strip.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    scene.add(strip);
  }
}
addBuilding(-20, -15, 6, 14, 6, 0x9aa8c2);
addBuilding(  0, -25, 8, 22, 8, 0x6f8aa8);
addBuilding( 22, -12, 5, 10, 5, 0xb7a784);
addBuilding(-30,  10, 7, 16, 7, 0x8898b3);
addBuilding( 18,  20, 9, 18, 9, 0x7c8aab);
addBuilding( 35,  -5, 6, 12, 6, 0xa9b3c8);
addBuilding(-15,  25, 5,  8, 5, 0xc6b48a);

// ---------------------------------------------------------------------------
// Rings (mission objective)
// ---------------------------------------------------------------------------
const RING_POSITIONS = [
  new THREE.Vector3(-8,  5, -6),
  new THREE.Vector3( 10, 7, -4),
  new THREE.Vector3( 12, 10, 12),
  new THREE.Vector3(-12, 6, 14),
];
const rings = [];
function buildRing(pos) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.16, 16, 48),
    new THREE.MeshStandardMaterial({
      color: 0xffaa00, emissive: 0xff8800, emissiveIntensity: 0.7, roughness: 0.4,
    }),
  );
  ring.position.copy(pos);
  ring.rotation.y = Math.PI / 2;
  ring.castShadow = true;
  ring.userData.collected = false;
  ring.userData.pulseUntil = 0;
  scene.add(ring);
  rings.push(ring);
}
RING_POSITIONS.forEach(buildRing);

// ---------------------------------------------------------------------------
// Drone model
// ---------------------------------------------------------------------------
const drone = new THREE.Group();
drone.position.set(0, 4, 0);
scene.add(drone);

const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f2738, metalness: 0.4, roughness: 0.4 });
const armMat  = new THREE.MeshStandardMaterial({ color: 0x2c3550, metalness: 0.5, roughness: 0.5 });

const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 1.2), bodyMat);
body.castShadow = true;
drone.add(body);

const led = new THREE.Mesh(
  new THREE.SphereGeometry(0.1, 12, 12),
  new THREE.MeshStandardMaterial({ color: 0x5cf0a1, emissive: 0x5cf0a1, emissiveIntensity: 1.2 }),
);
led.position.y = 0.22;
drone.add(led);

// Red nose cone — shows which way is forward (drone's local -Z direction)
const nose = new THREE.Mesh(
  new THREE.ConeGeometry(0.18, 0.5, 12),
  new THREE.MeshStandardMaterial({
    color: 0xff5566, emissive: 0xff2244, emissiveIntensity: 0.7, roughness: 0.4,
  }),
);
nose.rotation.x = -Math.PI / 2;
nose.position.set(0, 0.08, -0.85);
nose.castShadow = true;
drone.add(nose);

// Arms + rotors
const rotors = [];
const armOffsets = [[1,1],[-1,1],[-1,-1],[1,-1]];
for (const [ax, az] of armOffsets) {
  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, Math.hypot(ax, az) * 1.4, 10),
    armMat,
  );
  arm.castShadow = true;
  arm.position.set(ax / 2, 0, az / 2);
  arm.rotation.z = Math.PI / 2;
  arm.lookAt(new THREE.Vector3(ax, 0, az));
  drone.add(arm);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16), armMat);
  hub.position.set(ax, 0.06, az);
  drone.add(hub);

  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.03, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }),
  );
  blade.position.set(ax, 0.14, az);
  drone.add(blade);
  rotors.push(blade);
}

// Shadow disc under the drone
const shadowDisc = new THREE.Mesh(
  new THREE.CircleGeometry(1.2, 24),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
);
shadowDisc.rotation.x = -Math.PI / 2;
scene.add(shadowDisc);

// FPV camera anchor — an empty group at the front of the drone
const fpvAnchor = new THREE.Object3D();
fpvAnchor.position.set(0, 0.25, -0.4);
drone.add(fpvAnchor);

// ---------------------------------------------------------------------------
// Drone state + tunables
// ---------------------------------------------------------------------------
const drone_state = {
  pos: new THREE.Vector3(0, 4, 0),
  vel: new THREE.Vector3(0, 0, 0),
  yaw: 0,
  rotorSpin: 0,
  collisions: 0,
  landed: false,
};

const DRONE_RADIUS = 1.1;
const ACCEL_HORIZ  = 4.5;
const ACCEL_VERT   = 3.0;
const YAW_RATE     = 1.1;
const DAMP_HORIZ   = 0.86;
const DAMP_VERT    = 0.80;
const MAX_SPEED    = 9.0;
const GESTURE_HOLD_MS = 120;

// ---------------------------------------------------------------------------
// Gesture pipeline
// ---------------------------------------------------------------------------
let rawGesture       = "none";
let activeGesture    = "none";
let candidateGesture = "none";
let candidateSince   = 0;

function updateActiveGesture(now) {
  if (rawGesture === activeGesture) {
    candidateGesture = activeGesture;
    return;
  }
  if (rawGesture !== candidateGesture) {
    candidateGesture = rawGesture;
    candidateSince = now;
    return;
  }
  if (now - candidateSince >= GESTURE_HOLD_MS) {
    activeGesture = candidateGesture;
    gestureEl.textContent = activeGesture.toUpperCase();
  }
}

function intentFromGesture(g) {
  switch (g) {
    case "forward":  return { fwd:  1, vert:  0, yaw:  0 };
    case "backward": return { fwd: -1, vert:  0, yaw:  0 };
    case "up":       return { fwd:  0, vert:  1, yaw:  0 };
    case "down":     return { fwd:  0, vert: -1, yaw:  0 };
    case "left":     return { fwd:  0, vert:  0, yaw:  1 };
    case "right":    return { fwd:  0, vert:  0, yaw: -1 };
    case "land":     return { fwd:  0, vert: -1, yaw:  0, land: true };
    case "hover":    return { fwd:  0, vert:  0, yaw:  0, hover: true };
    case "none":
    default:         return { fwd:  0, vert:  0, yaw:  0 };
  }
}

// ---------------------------------------------------------------------------
// Sound system (Web Audio — synthesized, no asset files)
// ---------------------------------------------------------------------------
const audio = {
  ctx: null,
  rotorOsc: null,
  rotorGain: null,
  master: null,
  muted: false,
};

function ensureAudio() {
  if (audio.ctx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audio.ctx = new Ctx();

  audio.master = audio.ctx.createGain();
  audio.master.gain.value = audio.muted ? 0 : 0.7;
  audio.master.connect(audio.ctx.destination);

  // Rotor hum: sawtooth + low-pass for that buzzy quadcopter sound.
  audio.rotorOsc = audio.ctx.createOscillator();
  audio.rotorOsc.type = "sawtooth";
  audio.rotorOsc.frequency.value = 60;

  const filter = audio.ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 400;
  filter.Q.value = 6;

  audio.rotorGain = audio.ctx.createGain();
  audio.rotorGain.gain.value = 0.0;

  audio.rotorOsc.connect(filter);
  filter.connect(audio.rotorGain);
  audio.rotorGain.connect(audio.master);
  audio.rotorOsc.start();
}

function setRotorIntensity(speed01) {
  if (!audio.ctx || audio.muted) return;
  // Map [0, 1] -> frequency [55, 140] Hz and gain [0.05, 0.22]
  const t = THREE.MathUtils.clamp(speed01, 0, 1);
  audio.rotorOsc.frequency.linearRampToValueAtTime(55 + t * 85, audio.ctx.currentTime + 0.1);
  audio.rotorGain.gain.linearRampToValueAtTime(0.05 + t * 0.17, audio.ctx.currentTime + 0.1);
}

function playPickup() {
  if (!audio.ctx || audio.muted) return;
  const t0 = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  osc.type = "triangle";
  const gain = audio.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
  osc.frequency.setValueAtTime(660, t0);
  osc.frequency.exponentialRampToValueAtTime(1320, t0 + 0.18);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(t0);
  osc.stop(t0 + 0.4);
}

function playThud() {
  if (!audio.ctx || audio.muted) return;
  const t0 = audio.ctx.currentTime;
  const bufSize = 0.18 * audio.ctx.sampleRate;
  const buffer = audio.ctx.createBuffer(1, bufSize, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 2);
  }
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 280;
  const gain = audio.ctx.createGain();
  gain.gain.value = 0.6;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  src.start(t0);
}

function playComplete() {
  if (!audio.ctx || audio.muted) return;
  const t0 = audio.ctx.currentTime;
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = audio.ctx.createOscillator();
    osc.type = "triangle";
    const gain = audio.ctx.createGain();
    const start = t0 + i * 0.12;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(start);
    osc.stop(start + 0.55);
  });
}

function toggleMute() {
  audio.muted = !audio.muted;
  if (audio.master) {
    audio.master.gain.value = audio.muted ? 0 : 0.7;
  }
  muteBtn.textContent = audio.muted ? "🔇 Sound off" : "🔊 Sound on";
  muteBtn.classList.toggle("muted", audio.muted);
}
muteBtn.addEventListener("click", () => {
  ensureAudio();
  toggleMute();
});
// First user interaction unlocks the AudioContext (browser policy).
window.addEventListener("pointerdown", ensureAudio, { once: true });
window.addEventListener("keydown",     ensureAudio, { once: true });

// ---------------------------------------------------------------------------
// Mission state
// ---------------------------------------------------------------------------
const mission = {
  collected: 0,
  total: rings.length,
  startedAt: 0,
  elapsed: 0,
  finished: false,
};

function startMissionTimer() {
  if (mission.startedAt === 0) mission.startedAt = performance.now();
}

function resetMission() {
  mission.collected = 0;
  mission.startedAt = 0;
  mission.elapsed = 0;
  mission.finished = false;
  drone_state.pos.set(0, 4, 0);
  drone_state.vel.set(0, 0, 0);
  drone_state.yaw = 0;
  drone_state.collisions = 0;
  for (const ring of rings) {
    ring.visible = true;
    ring.userData.collected = false;
    ring.material.emissiveIntensity = 0.7;
    ring.scale.setScalar(1);
  }
  completeEl.classList.add("hidden");
}
restartBtn.addEventListener("click", resetMission);

function computeScore() {
  const timeSec = mission.elapsed / 1000;
  const base = 1000;
  const timePenalty = Math.floor(timeSec * 8);
  const collisionPenalty = drone_state.collisions * 50;
  return Math.max(100, base - timePenalty - collisionPenalty);
}

function finishMission() {
  if (mission.finished) return;
  mission.finished = true;
  finalTime.textContent  = (mission.elapsed / 1000).toFixed(1) + "s";
  finalCol.textContent   = String(drone_state.collisions);
  finalScore.textContent = String(computeScore());
  completeEl.classList.remove("hidden");
  playComplete();
}

// ---------------------------------------------------------------------------
// Collision + pickup
// ---------------------------------------------------------------------------
function resolveCollisions(pos) {
  let collided = false;
  for (const ob of obstacles) {
    const half = new THREE.Vector3(
      ob.geometry.parameters.width / 2,
      ob.geometry.parameters.height / 2,
      ob.geometry.parameters.depth / 2,
    );
    const min = ob.position.clone().sub(half);
    const max = ob.position.clone().add(half);
    const clamped = new THREE.Vector3(
      Math.max(min.x, Math.min(pos.x, max.x)),
      Math.max(min.y, Math.min(pos.y, max.y)),
      Math.max(min.z, Math.min(pos.z, max.z)),
    );
    const diff = pos.clone().sub(clamped);
    const dist = diff.length();
    if (dist < DRONE_RADIUS) {
      if (dist === 0) pos.x += DRONE_RADIUS;
      else { diff.normalize().multiplyScalar(DRONE_RADIUS - dist); pos.add(diff); }
      collided = true;
    }
  }
  return collided;
}

function checkRingPickups(now) {
  for (const ring of rings) {
    if (ring.userData.collected) continue;
    const d = drone_state.pos.distanceTo(ring.position);
    if (d < 2.2) {
      ring.userData.collected = true;
      ring.userData.pulseUntil = now + 400;
      mission.collected += 1;
      playPickup();
      startMissionTimer();
      if (mission.collected >= mission.total) {
        // Freeze elapsed at the moment of completion.
        mission.elapsed = performance.now() - mission.startedAt;
        finishMission();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Camera modes — cycle with C key
// ---------------------------------------------------------------------------
const CAM_MODES = ["chase", "fpv", "top"];
let camModeIdx = 0;
function camMode() { return CAM_MODES[camModeIdx]; }
function cycleCamMode() {
  camModeIdx = (camModeIdx + 1) % CAM_MODES.length;
  camModeEl.textContent = camMode();
}
camModeEl.textContent = camMode();

function updateCamera() {
  const mode = camMode();
  if (mode === "chase") {
    const offset = new THREE.Vector3(0, 4, 12).applyAxisAngle(new THREE.Vector3(0, 1, 0), drone_state.yaw);
    const desired = drone_state.pos.clone().add(offset);
    camera.position.lerp(desired, 0.10);
    camera.lookAt(drone_state.pos.x, drone_state.pos.y + 1, drone_state.pos.z);
    return;
  }
  if (mode === "fpv") {
    // Anchor in front of the drone, looking further forward.
    fpvAnchor.getWorldPosition(camera.position);
    const fwd = new THREE.Vector3(-Math.sin(drone_state.yaw), 0, -Math.cos(drone_state.yaw));
    const lookAt = camera.position.clone().add(fwd.multiplyScalar(20));
    lookAt.y -= 0.5;
    camera.lookAt(lookAt);
    return;
  }
  if (mode === "top") {
    const desired = drone_state.pos.clone().add(new THREE.Vector3(0, 40, 0));
    camera.position.lerp(desired, 0.15);
    camera.lookAt(drone_state.pos.x, 0, drone_state.pos.z);
    return;
  }
}

// ---------------------------------------------------------------------------
// Minimap (2D canvas)
// ---------------------------------------------------------------------------
function drawMinimap() {
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;
  minimapCtx.fillStyle = "rgba(10, 16, 32, 0.85)";
  minimapCtx.fillRect(0, 0, w, h);

  // World -> minimap mapping: world is [-90, 90] on X/Z, map to [0, w].
  const worldHalf = 90;
  const toMap = (x, z) => [
    (x + worldHalf) / (worldHalf * 2) * w,
    (z + worldHalf) / (worldHalf * 2) * h,
  ];

  // Obstacles (gray rectangles)
  minimapCtx.fillStyle = "rgba(150, 165, 200, 0.45)";
  for (const ob of obstacles) {
    const [mx, my] = toMap(ob.position.x, ob.position.z);
    const ws = ob.geometry.parameters.width  / (worldHalf * 2) * w;
    const hs = ob.geometry.parameters.depth  / (worldHalf * 2) * h;
    minimapCtx.fillRect(mx - ws / 2, my - hs / 2, ws, hs);
  }

  // Rings
  for (const ring of rings) {
    const [mx, my] = toMap(ring.position.x, ring.position.z);
    minimapCtx.beginPath();
    minimapCtx.arc(mx, my, 4, 0, Math.PI * 2);
    minimapCtx.fillStyle = ring.userData.collected ? "rgba(255,255,255,0.25)" : "#ffaa00";
    minimapCtx.fill();
  }

  // Drone — triangle pointing in its facing direction
  const [dx, dy] = toMap(drone_state.pos.x, drone_state.pos.z);
  minimapCtx.save();
  minimapCtx.translate(dx, dy);
  // Minimap Y axis matches world Z axis. Drone faces -Z (so toward minimap -Y).
  // Three.js positive yaw rotates CCW from above; on the minimap (Y down)
  // we negate yaw to keep the indicator pointing the right way.
  minimapCtx.rotate(-drone_state.yaw);
  minimapCtx.fillStyle = "#5cf0a1";
  minimapCtx.beginPath();
  minimapCtx.moveTo(0, -7);
  minimapCtx.lineTo(5, 5);
  minimapCtx.lineTo(-5, 5);
  minimapCtx.closePath();
  minimapCtx.fill();
  minimapCtx.restore();

  // Border
  minimapCtx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  minimapCtx.lineWidth = 1;
  minimapCtx.strokeRect(0.5, 0.5, w - 1, h - 1);
}

// ---------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
let lastSpeedForSound = 0;

function tick() {
  const dt  = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();
  updateActiveGesture(now);
  const intent = intentFromGesture(activeGesture);

  // Start mission timer once any control intent appears.
  const hasIntent = intent.fwd !== 0 || intent.vert !== 0 || intent.yaw !== 0;
  if (hasIntent && mission.startedAt === 0 && !mission.finished) {
    startMissionTimer();
  }

  // Yaw
  drone_state.yaw += intent.yaw * YAW_RATE * dt;

  // Forward direction in world (drone's local -Z, away from chase camera)
  const fwdDir = new THREE.Vector3(-Math.sin(drone_state.yaw), 0, -Math.cos(drone_state.yaw));

  drone_state.vel.addScaledVector(fwdDir, intent.fwd * ACCEL_HORIZ * dt);
  drone_state.vel.y += intent.vert * ACCEL_VERT * dt;

  // Damping. During explicit hover, dampen horizontals harder so the drone
  // stops sliding around when the user shows an open palm.
  const horizDamp = intent.hover ? 0.5 : DAMP_HORIZ;
  const dampH = Math.pow(horizDamp, dt);
  const dampV = Math.pow(DAMP_VERT,  dt);
  drone_state.vel.x *= dampH;
  drone_state.vel.z *= dampH;
  drone_state.vel.y *= dampV;

  // Explicit hover holds altitude — no gravity, vertical velocity pulled to 0.
  // Otherwise apply a mild gravity bias so an inattentive pilot drifts down.
  if (intent.hover) {
    drone_state.vel.y *= Math.pow(0.2, dt);
  } else if (intent.vert === 0 && !intent.land) {
    drone_state.vel.y -= 0.4 * dt;
  }

  // Speed clamp
  const horizSpd = Math.hypot(drone_state.vel.x, drone_state.vel.z);
  if (horizSpd > MAX_SPEED) {
    drone_state.vel.x *= MAX_SPEED / horizSpd;
    drone_state.vel.z *= MAX_SPEED / horizSpd;
  }
  drone_state.vel.y = THREE.MathUtils.clamp(drone_state.vel.y, -MAX_SPEED, MAX_SPEED);

  // Integrate
  drone_state.pos.addScaledVector(drone_state.vel, dt);

  // Ground clamp
  if (drone_state.pos.y < 0.6) {
    drone_state.pos.y = 0.6;
    if (drone_state.vel.y < 0) drone_state.vel.y = 0;
    drone_state.landed = true;
  } else {
    drone_state.landed = false;
  }

  // Play area bounds
  drone_state.pos.x = THREE.MathUtils.clamp(drone_state.pos.x, -90, 90);
  drone_state.pos.z = THREE.MathUtils.clamp(drone_state.pos.z, -90, 90);

  // Obstacle collisions
  if (resolveCollisions(drone_state.pos)) {
    drone_state.collisions += 1;
    drone_state.vel.multiplyScalar(0.3);
    playThud();
  }
  checkRingPickups(now);

  // Update drone visuals
  drone.position.copy(drone_state.pos);
  drone.rotation.y = drone_state.yaw;

  const localVel = drone_state.vel.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -drone_state.yaw);
  drone.rotation.x = THREE.MathUtils.clamp(localVel.z * 0.04, -0.4, 0.4);
  drone.rotation.z = THREE.MathUtils.clamp(localVel.x * 0.04, -0.4, 0.4);

  drone_state.rotorSpin += dt * (drone_state.landed ? 4 : 35);
  for (let i = 0; i < rotors.length; i++) {
    rotors[i].rotation.y = drone_state.rotorSpin * (i % 2 === 0 ? 1 : -1);
  }

  shadowDisc.position.set(drone_state.pos.x, 0.02, drone_state.pos.z);
  const altitudeFade = THREE.MathUtils.clamp(1 - drone_state.pos.y / 30, 0.05, 0.6);
  shadowDisc.material.opacity = altitudeFade;
  shadowDisc.scale.setScalar(1 + drone_state.pos.y * 0.03);

  // Rings: gentle spin + collected fade-out pulse
  for (const ring of rings) {
    ring.rotation.z += dt * 1.2;
    if (ring.userData.collected && ring.visible) {
      const remaining = ring.userData.pulseUntil - now;
      if (remaining > 0) {
        const k = remaining / 400;
        ring.scale.setScalar(1 + (1 - k) * 1.2);
        ring.material.opacity = k;
        ring.material.transparent = true;
        ring.material.emissiveIntensity = 1.6;
      } else {
        ring.visible = false;
      }
    }
  }

  // Cameras
  updateCamera();

  // Mission HUD
  if (mission.startedAt > 0 && !mission.finished) {
    mission.elapsed = now - mission.startedAt;
  }
  ringsEl.textContent = `${mission.collected} / ${mission.total}`;
  timerEl.textContent = (mission.elapsed / 1000).toFixed(1) + "s";
  scoreEl.textContent = String(computeScore());

  // Flight HUD
  altEl.textContent = drone_state.pos.y.toFixed(1) + " m";
  spdEl.textContent = drone_state.vel.length().toFixed(1) + " m/s";
  hdgEl.textContent = ((((drone_state.yaw * 180) / Math.PI) % 360 + 360) % 360).toFixed(0) + "°";
  colEl.textContent = String(drone_state.collisions);

  // Sound: rotor pitch follows drone speed
  const speedNorm = THREE.MathUtils.clamp(drone_state.vel.length() / MAX_SPEED, 0, 1);
  // Smooth the value so the pitch glides instead of stepping.
  lastSpeedForSound = lastSpeedForSound * 0.85 + speedNorm * 0.15;
  setRotorIntensity(0.35 + lastSpeedForSound * 0.65);

  // Minimap
  drawMinimap();

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
window.addEventListener("resize", () => {
  const w = sceneEl.clientWidth;
  const h = sceneEl.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

// ---------------------------------------------------------------------------
// WebSocket — gesture feed from Python backend
// ---------------------------------------------------------------------------
function connectGestureSocket() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/ws/gesture`);
  ws.onopen = () => {
    camStatus.textContent = "live";
    camStatus.className = "status-dot ok";
  };
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      rawGesture = msg.gesture || "none";
      if (!msg.camera_ok) {
        camStatus.textContent = "no camera";
        camStatus.className = "status-dot fail";
      } else {
        camStatus.textContent = "live";
        camStatus.className = "status-dot ok";
      }
    } catch (e) { /* ignore */ }
  };
  ws.onclose = () => {
    camStatus.textContent = "reconnecting…";
    camStatus.className = "status-dot pending";
    setTimeout(connectGestureSocket, 1500);
  };
  ws.onerror = () => ws.close();
}
connectGestureSocket();

// ---------------------------------------------------------------------------
// Keyboard fallback + camera/sound shortcuts
// ---------------------------------------------------------------------------
const keyMap = {
  "ArrowUp": "forward", "ArrowDown": "backward",
  "ArrowLeft": "left",  "ArrowRight": "right",
  "w": "up", "s": "down", " ": "hover", "l": "land",
};
window.addEventListener("keydown", (e) => {
  if (e.key === "c" || e.key === "C") { cycleCamMode(); return; }
  if (e.key === "m" || e.key === "M") { ensureAudio(); toggleMute(); return; }
  if (e.key === "r" || e.key === "R") { resetMission(); return; }
  const g = keyMap[e.key];
  if (g) { rawGesture = g; e.preventDefault(); }
});
window.addEventListener("keyup", (e) => {
  if (keyMap[e.key]) rawGesture = "hover";
});
