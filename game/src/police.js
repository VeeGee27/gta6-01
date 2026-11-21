// The wanted system and the SBPD: stars that rise with crimes and fade when the player
// stays hidden, patrol cars that chase and ram, roadblocks at three stars, and the Air One
// helicopter at four stars. Getting busted (caught on foot) or wasted (health zero) sends
// the player to the hospital and costs cash. Police cars use the same car physics as the
// player's, steering toward the player and ramming to stop them.
import * as THREE from 'three';
import { CAR_MODELS, WANTED } from './config.js';
import { clamp, dist2D } from './world.js';
import { createCar, damageCar, driveCar, modelById } from './vehicle.js';

export function addWanted(state, amount) {
  const p = state.player;
  const before = Math.floor(p.wanted);
  p.wanted = clamp(p.wanted + amount, 0, WANTED.maxStars);
  p.wantedTimer = 0;
  p.hiddenTimer = 0;
  if (Math.floor(p.wanted) > before) {
    state.events.push('wantedUp');
  }
}

export function buildHeliMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 4.2), bodyMat);
  body.castShadow = true;
  group.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 1.2), new THREE.MeshLambertMaterial({ color: 0x2a4a6a }));
  glass.position.set(0, 0.2, 1.6);
  group.add(glass);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 0.9;
  rotor.name = 'rotor';
  group.add(rotor);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 3.4), bodyMat);
  tail.position.set(0, 0.3, -3.4);
  group.add(tail);
  const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.6, 26, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
  spot.position.y = -13;
  spot.name = 'spot';
  group.add(spot);
  return group;
}

function spawnPoliceCar(state, scene) {
  const p = state.player;
  const model = modelById('police');
  const a = state.random.next() * Math.PI * 2;
  const x = p.x + Math.sin(a) * 55;
  const z = p.z + Math.cos(a) * 55;
  const car = createCar(model, x, clamp(z, -235, 235), Math.atan2(p.x - x, p.z - z), { police: true });
  scene.add(car.group);
  state.cars.push(car);
  state.policeCars.push(car);
  return car;
}

function spawnHeli(state, scene) {
  const p = state.player;
  const mesh = buildHeliMesh();
  mesh.position.set(p.x + 20, 42, p.z - 20);
  scene.add(mesh);
  state.heli = { mesh, x: p.x + 20, z: p.z - 20, y: 42, rotor: 0 };
}

function removePoliceCar(state, scene, car) {
  scene.remove(car.group);
  state.cars = state.cars.filter((c) => c !== car);
  state.policeCars = state.policeCars.filter((c) => c !== car);
}

export function stepPolice(state, scene, dt) {
  const p = state.player;
  const stars = Math.floor(p.wanted);
  if (p.wanted <= 0) {
    for (const car of [...state.policeCars]) removePoliceCar(state, scene, car);
    if (state.heli) {
      scene.remove(state.heli.mesh);
      state.heli = null;
    }
    return;
  }
  p.wantedTimer += dt;
  const nearPolice = state.policeCars.some((c) => dist2D(c.x, c.z, p.x, p.z) < 25);
  if (!nearPolice) p.hiddenTimer += dt;
  else p.hiddenTimer = 0;
  if (p.hiddenTimer > WANTED.decayDelay) {
    p.wanted = clamp(p.wanted - WANTED.decayRate * dt, 0, WANTED.maxStars);
    if (p.wanted <= 0) {
      state.events.push('wantedClear');
      p.wanted = 0;
    }
  }
  const wantCount = WANTED.policePerStar[stars] || 0;
  while (state.policeCars.length < wantCount) spawnPoliceCar(state, scene);
  while (state.policeCars.length > wantCount) {
    const car = state.policeCars[state.policeCars.length - 1];
    removePoliceCar(state, scene, car);
  }
  if (stars >= WANTED.heliAt && !state.heli) spawnHeli(state, scene);
  if (stars < WANTED.heliAt && state.heli) {
    scene.remove(state.heli.mesh);
    state.heli = null;
  }
  for (const car of state.policeCars) {
    const wantHeading = Math.atan2(p.x - car.x, p.z - car.z);
    let diff = wantHeading - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = clamp(diff * 1.6, -1, 1);
    const d = dist2D(car.x, car.z, p.x, p.z);
    const throttle = d > 6 ? 0.95 : 0.4;
    driveCar(car, throttle, steer, false, false, dt);
    const red = car.group.getObjectByName('lightRed');
    const blue = car.group.getObjectByName('lightBlue');
    const phase = Math.floor(state.time * 6) % 2 === 0;
    if (red) red.material.color.setHex(phase ? 0xff2222 : 0x441111);
    if (blue) blue.material.color.setHex(phase ? 0x111133 : 0x2266ff);
    if (d < 3.2) {
      if (p.inCar) {
        damageCar(p.inCar, 0.02);
        p.inCar.speed *= 0.92;
        state.shake = Math.max(state.shake, 0.35);
      } else {
        p.health -= 18 * dt;
        state.shake = Math.max(state.shake, 0.5);
        if (p.health <= 0) {
          state.events.push('busted');
        }
      }
    }
    if (dist2D(car.x, car.z, p.x, p.z) > 400) {
      const a = state.random.next() * Math.PI * 2;
      car.x = p.x + Math.sin(a) * 55;
      car.z = p.z + Math.cos(a) * 55;
      car.group.position.set(car.x, 0, car.z);
    }
  }
  if (state.heli) {
    const h = state.heli;
    h.rotor += dt * 22;
    const rotor = h.mesh.getObjectByName('rotor');
    if (rotor) rotor.rotation.y = h.rotor;
    const tx = p.x + 12;
    const tz = p.z - 12;
    h.x += (tx - h.x) * Math.min(1, 0.8 * dt);
    h.z += (tz - h.z) * Math.min(1, 0.8 * dt);
    h.mesh.position.set(h.x, 42 + Math.sin(state.time * 1.4) * 1.5, h.z);
    h.mesh.rotation.y = Math.atan2(p.x - h.x, p.z - h.z);
  }
}

export function bustPlayer(state, scene) {
  const p = state.player;
  p.cash = Math.max(0, p.cash - 200);
  p.health = 100;
  p.armor = 0;
  p.wanted = 0;
  if (p.inCar) {
    p.inCar.isPlayer = false;
    p.inCar = null;
  }
  p.x = 0;
  p.z = -60;
  p.y = 0;
  for (const car of [...state.policeCars]) removePoliceCar(state, scene, car);
  if (state.heli) {
    scene.remove(state.heli.mesh);
    state.heli = null;
  }
  state.busted = true;
  state.screen = 'busted';
}
