// Pedestrians: people walking the sidewalks, crossing at corners, fleeing when scared
// (gunshots, a car bearing down, a police chase nearby) and milling near mission spots.
// They are simple readable figures in varied clothes, so the streets feel inhabited.
// A pedestrian that is hit by a car is knocked down and raises the wanted level.
import * as THREE from 'three';
import { CITY, ROAD_LINES } from './config.js';
import { clamp, dist2D } from './world.js';

const SHIRTS = [0xe8a878, 0x7ab8e8, 0x9ad89a, 0xe8e8e8, 0xc89ad8, 0x8a8a9a, 0xd8b878, 0x6a9a8a];
const PANTS = [0x2a2a32, 0x4a3a2a, 0x3a4a5a, 0x5a5a5a];

export function buildPedMesh(random) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: random.pick(SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: random.pick(PANTS) });
  const skin = new THREE.MeshLambertMaterial({ color: random.pick([0xd8a878, 0xa87858, 0xe8c8a8, 0x8a5a3a]) });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), shirt);
  torso.position.y = 1.1;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
  head.position.y = 1.62;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), pants);
  legL.position.set(-0.14, 0.38, 0);
  legL.name = 'legL';
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  legR.name = 'legR';
  group.add(legR);
  return group;
}

export function createPedestrians(state, scene, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const mesh = buildPedMesh(state.random);
    const line = state.random.pick(ROAD_LINES);
    const along = state.random.range(-230, 230);
    const side = state.random.next() < 0.5 ? -1 : 1;
    const off = CITY.roadWidth / 2 + CITY.sidewalkWidth / 2;
    const vertical = state.random.next() < 0.5;
    const x = vertical ? line + side * off : along;
    const z = vertical ? along : line + side * off;
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh,
      x, z,
      heading: state.random.next() * Math.PI * 2,
      speed: state.random.range(1.2, 2.2),
      state: 'walk',
      fleeX: 0, fleeZ: 0,
      walkPhase: state.random.next() * 6,
      down: false,
      downTimer: 0,
    });
  }
  return peds;
}

function sidewalkTarget(ped, random) {
  const line = random.pick(ROAD_LINES);
  const along = random.range(-230, 230);
  const side = random.next() < 0.5 ? -1 : 1;
  const off = CITY.roadWidth / 2 + CITY.sidewalkWidth / 2;
  if (random.next() < 0.5) return { x: line + side * off, z: along };
  return { x: along, z: line + side * off };
}

export function stepPedestrians(state, peds, dt) {
  const p = state.player;
  const danger = state.events.includes('shot') || p.wanted >= 2;
  for (const ped of peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.down = false;
        ped.state = 'walk';
        ped.mesh.rotation.x = 0;
        ped.mesh.position.y = 0;
      }
      continue;
    }
    const dPlayer = dist2D(ped.x, ped.z, p.x, p.z);
    let scared = danger && dPlayer < 40;
    if (p.inCar && Math.abs(p.inCar.speed) > 12 && dPlayer < 10) scared = true;
    if (scared && ped.state !== 'flee') {
      ped.state = 'flee';
      const away = Math.atan2(ped.x - p.x, ped.z - p.z);
      ped.fleeX = ped.x + Math.sin(away) * 30;
      ped.fleeZ = ped.z + Math.cos(away) * 30;
    }
    let tx;
    let tz;
    let speed = ped.speed;
    if (ped.state === 'flee') {
      tx = ped.fleeX;
      tz = ped.fleeZ;
      speed = 5.5;
      if (dist2D(ped.x, ped.z, tx, tz) < 3 || dPlayer > 50) ped.state = 'walk';
    } else {
      if (!ped.tx || dist2D(ped.x, ped.z, ped.tx, ped.tz) < 3) {
        const t = sidewalkTarget(ped, state.random);
        ped.tx = t.x;
        ped.tz = t.z;
      }
      tx = ped.tx;
      tz = ped.tz;
    }
    const want = Math.atan2(tx - ped.x, tz - ped.z);
    let diff = want - ped.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.heading += clamp(diff, -2.4 * dt, 2.4 * dt);
    ped.x += Math.sin(ped.heading) * speed * dt;
    ped.z += Math.cos(ped.heading) * speed * dt;
    ped.x = clamp(ped.x, -238, 238);
    ped.z = clamp(ped.z, -238, 330);
    ped.walkPhase += dt * speed * 3;
    const swing = Math.sin(ped.walkPhase) * 0.45;
    const legL = ped.mesh.getObjectByName('legL');
    const legR = ped.mesh.getObjectByName('legR');
    if (legL) legL.rotation.x = swing;
    if (legR) legR.rotation.x = -swing;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
  }
}

export function knockDownPed(state, ped) {
  if (ped.down) return false;
  ped.down = true;
  ped.downTimer = 6;
  ped.mesh.rotation.x = Math.PI / 2;
  ped.mesh.position.y = 0.3;
  state.stats.pedsHit += 1;
  return true;
}
