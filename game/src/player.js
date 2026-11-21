// The player on foot: WASD movement relative to the camera, sprint, jump, punch and
// aim/shoot, plus the third-person camera that follows them (and the car when driving).
// The player is a simple readable figure — torso, head, legs that swing as they walk —
// so the screenshots show a person, not a floating camera.
import * as THREE from 'three';
import { CONTROLS, PLAYER, WEAPONS } from './config.js';
import { clamp, dist2D } from './world.js';

export function buildPlayerMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a878 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2a6a8a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a32 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.26, 0.12, 12), new THREE.MeshLambertMaterial({ color: 0xc81a3a }));
  cap.position.y = 1.9;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.26), pants);
  legL.position.set(-0.17, 0.4, 0);
  legL.name = 'legL';
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  legR.name = 'legR';
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.2), shirt);
  armL.position.set(-0.42, 1.15, 0);
  armL.name = 'armL';
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  armR.name = 'armR';
  group.add(armR);
  return group;
}

export function createPlayer(state, scene) {
  const mesh = buildPlayerMesh();
  scene.add(mesh);
  return { mesh, walkPhase: 0 };
}

function collideWithBuildings(state, x, z, colliders) {
  for (const c of colliders) {
    if (x > c.x0 - PLAYER.radius && x < c.x1 + PLAYER.radius && z > c.z0 - PLAYER.radius && z < c.z1 + PLAYER.radius) {
      return true;
    }
  }
  return false;
}

/** One step of on-foot movement. Returns true when the player is moving. */
export function stepPlayer(state, player, input, colliders, dt) {
  const p = state.player;
  const cam = state.camera;
  const fwd = (input.held(CONTROLS.forward) ? 1 : 0) - (input.held(CONTROLS.back) ? 1 : 0);
  const strafe = (input.held(CONTROLS.right) ? 1 : 0) - (input.held(CONTROLS.left) ? 1 : 0);
  const sprint = input.held(CONTROLS.sprint);
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const sin = Math.sin(cam.yaw);
  const cos = Math.cos(cam.yaw);
  let mx = sin * fwd + cos * strafe;
  let mz = cos * fwd - sin * strafe;
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len;
    mz /= len;
    const nx = p.x + mx * speed * dt;
    const nz = p.z + mz * speed * dt;
    if (!collideWithBuildings(state, nx, p.z, colliders)) p.x = nx;
    if (!collideWithBuildings(state, p.x, nz, colliders)) p.z = nz;
    p.heading = Math.atan2(mx, mz);
    player.walkPhase += dt * speed * 1.6;
  }
  if (input.held(CONTROLS.jump) && p.onGround) {
    p.velY = PLAYER.jumpSpeed;
    p.onGround = false;
  }
  p.velY -= PLAYER.gravity * dt;
  p.y += p.velY * dt;
  if (p.y <= 0) {
    p.y = 0;
    p.velY = 0;
    p.onGround = true;
  }
  p.x = clamp(p.x, -238, 238);
  p.z = clamp(p.z, -238, 330);
  const mesh = player.mesh;
  mesh.position.set(p.x, p.y, p.z);
  mesh.rotation.y = p.heading;
  const swing = len > 0 ? Math.sin(player.walkPhase) * 0.5 : 0;
  const legL = mesh.getObjectByName('legL');
  const legR = mesh.getObjectByName('legR');
  const armL = mesh.getObjectByName('armL');
  const armR = mesh.getObjectByName('armR');
  if (legL) legL.rotation.x = swing;
  if (legR) legR.rotation.x = -swing;
  if (armL) armL.rotation.x = -swing * 0.7;
  if (armR) armR.rotation.x = swing * 0.7;
  return len > 0;
}

/** The third-person camera: behind the player (or the car), mouse-look, collision-free. */
export function updateCamera(state, camera, dt) {
  const cam = state.camera;
  const p = state.player;
  const target = p.inCar ? p.inCar : null;
  let tx;
  let tz;
  let ty;
  if (target) {
    tx = target.x;
    tz = target.z;
    ty = 1.6;
    cam.dist = 11;
  } else {
    tx = p.x;
    tz = p.z;
    ty = 1.6;
    cam.dist = 9;
  }
  const cx = tx - Math.sin(cam.yaw) * cam.dist * Math.cos(cam.pitch);
  const cz = tz - Math.cos(cam.yaw) * cam.dist * Math.cos(cam.pitch);
  const cy = ty + Math.sin(cam.pitch) * cam.dist + 1.2;
  camera.position.set(cx, Math.max(cy, 1.2), cz);
  camera.lookAt(tx, ty + 0.6, tz);
}

export function nearestCar(state, maxDist) {
  const p = state.player;
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.isPolice) continue;
    const d = dist2D(p.x, p.z, car.x, car.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function weaponOf(state) {
  return WEAPONS[state.player.weapon] || WEAPONS[1];
}
