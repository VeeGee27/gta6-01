// The screenshot scenes behind ?shot=cover|street|mission|chase. Each one stages a real
// game state — a driving chase, a street on foot, a mission in progress, a police chase
// at dusk — then the loop runs the simulation forward a fixed number of steps so traffic,
// pedestrians and police settle into place, and the frame is what the game really looks
// like. The same seed always gives the same frame. Sets window.__shotReady when done.
// The camera is the gameplay follow camera (updateCamera in main.js); these scenes set
// the player's position and the camera yaw so the follow camera frames the action: the
// player always stands or drives ON a road or sidewalk, never inside a block, so the
// frame shows streets, buildings and people instead of a blank wall or empty grass.
import * as THREE from 'three';
import { createCar, modelById } from './vehicle.js';
import { addWanted } from './police.js';
import { startMission } from './missions.js';

const SHOT_NAMES = ['cover', 'street', 'mission', 'chase'];

export function shotName(params) {
  const name = params.get('shot');
  return SHOT_NAMES.includes(name) ? name : null;
}

function policeAhead(state, scene, x, z, heading) {
  const car = createCar(modelById('police'), x, z, heading, { police: true });
  scene.add(car.group);
  state.cars.push(car);
  state.policeCars.push(car);
  return car;
}

function crateMesh(x, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.4, 1.4),
    new THREE.MeshLambertMaterial({ color: 0xc8a038 }),
  );
  mesh.position.set(x, 0.7, z);
  mesh.castShadow = true;
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.15, 1.5),
    new THREE.MeshLambertMaterial({ color: 0x8a6a20 }),
  );
  lid.position.y = 0.75;
  mesh.add(lid);
  return mesh;
}

export function stageShot(name, deps) {
  const { state, scene, roadGraph, camera, spawnParkedCars, spawnTrafficCars, spawnPeds } = deps;
  const p = state.player;
  state.started = true;
  state.screen = 'play';
  if (name === 'cover') {
    // Driving chase down Marina Row: sports car, 3 stars, police ahead as a roadblock,
    // traffic on the road, mission 1 active.
    const car = spawnParkedCars('sports', 0, 180, Math.PI);
    p.inCar = car;
    car.isPlayer = true;
    car.speed = 26;
    p.x = car.x;
    p.z = car.z;
    p.heading = Math.PI;
    state.camera.yaw = Math.PI;
    state.camera.pitch = 0.3;
    addWanted(state, 3);
    startMission(state, scene, 0);
    policeAhead(state, scene, -3, 120, 0);
    policeAhead(state, scene, 4, 132, Math.PI);
    spawnTrafficCars(8);
    camera.position.set(0, 7, 158);
    camera.lookAt(0, 2, 190);
    return { frames: 150, camera: 'follow' };
  }
  if (name === 'street') {
    // On foot on the edge of road x=0, looking north down the street: buildings on
    // both sides, a taxi waiting, pedestrians on the sidewalk.
    p.x = 5;
    p.z = 30;
    p.heading = Math.PI;
    state.camera.yaw = Math.PI;
    state.camera.pitch = 0.28;
    spawnParkedCars('taxi', 3, -6, Math.PI);
    spawnParkedCars('sedan', -3, -40, 0);
    spawnTrafficCars(10);
    spawnPeds(30);
    camera.position.set(5, 5, 42);
    camera.lookAt(5, 1.5, 20);
    return { frames: 120, camera: 'follow' };
  }
  if (name === 'mission') {
    // Mission 4 in progress: collecting crates on the Marina beach by the pier. The
    // crates are real gold boxes on the sand; the sea and pier are ahead of the player.
    startMission(state, scene, 3);
    p.x = 90;
    p.z = 258;
    p.heading = 0;
    state.camera.yaw = 0;
    state.camera.pitch = 0.3;
    for (const [cx, cz] of [[80, 272], [90, 277], [100, 272]]) {
      scene.add(crateMesh(cx, cz));
    }
    spawnPeds(16);
    spawnTrafficCars(6);
    camera.position.set(90, 8, 242);
    camera.lookAt(90, 1.5, 280);
    return { frames: 120, camera: 'follow' };
  }
  // chase: four-star tail at dusk, helicopter overhead, roadblock ahead.
  addWanted(state, 4);
  const car = spawnParkedCars('sports', -60, 60, Math.PI / 2);
  p.inCar = car;
  car.isPlayer = true;
  car.speed = 30;
  p.x = car.x;
  p.z = car.z;
  p.heading = Math.PI / 2;
  state.camera.yaw = Math.PI / 2;
  state.camera.pitch = 0.32;
  startMission(state, scene, 7);
  policeAhead(state, scene, -60, 0, Math.PI);
  policeAhead(state, scene, -52, 12, Math.PI);
  camera.position.set(-72, 9, 44);
  camera.lookAt(-48, 2, 72);
  return { frames: 150, camera: 'follow' };
}

export function modelForShot(name) {
  return modelById(name === 'cover' || name === 'chase' ? 'sports' : 'sedan');
}
