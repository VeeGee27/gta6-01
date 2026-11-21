// Solara Bay — boot and the one loop. The game moves between five screens (title,
// play, paused, missions, busted); in play, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one) and the renderer paints what is there.
// ?seed=N fixes the city and the traffic. ?shot=cover|street|mission|chase (with
// &seed=N) stages that scene instead of the title screen, runs it forward a fixed
// number of frames and sets window.__shotReady for a screenshot.
import * as THREE from 'three';
import { CITY, CONTROLS, ROAD_LINES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createGame, dist2D, clamp, EVENT_BUSTED, EVENT_WASTED } from './world.js';
import { ACT_ENTER, ACT_PUNCH, ACT_PAUSE, ACT_RADIO, ACT_MUTE, ACT_MISSION, ACT_CONFIRM, createInput } from './input.js';
import { buildCity } from './city.js';
import { createPlayer, stepPlayer, updateCamera, nearestCar, weaponOf } from './player.js';
import { createCar, driveCar, damageCar, modelById } from './vehicle.js';
import { createTraffic, stepTraffic } from './traffic.js';
import { createPedestrians, stepPedestrians, knockDownPed } from './pedestrians.js';
import { addWanted, stepPolice, bustPlayer } from './police.js';
import { startMission, stepMissions, currentMission, abortMission } from './missions.js';
import { createHud, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_BUSTED } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, applySave } from './save.js';
import { createEffects } from './effects.js';
import { createRenderer } from './render.js';
import { shotName, stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = shotName(params);
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const game = createGame(random);
const state = game.state;
const { renderer, camera } = createRenderer(canvas);
const scene = new THREE.Scene();
const city = buildCity(scene, random);
const player = createPlayer(state, scene);
const hud = createHud();
const audio = createAudio();
const effects = createEffects(scene);
const input = createInput(canvas);
const saved = loadSave();
if (saved) applySave(state, saved);
audio.setMuted(state.muted);

let trafficCars = [];
let peds = [];
let shotFrames = 0;
let shotDone = false;
let shootCooldown = 0;
let punchCooldown = 0;

function spawnParkedCars(modelId, x, z, heading) {
  const model = modelById(modelId);
  const car = createCar(model, x, z, heading, { parked: true });
  scene.add(car.group);
  state.cars.push(car);
  return car;
}

function spawnParkedRow() {
  const spots = [
    ['sedan', 24, 12, 0], ['coupe', 24, 48, 0], ['suv', -24, -12, Math.PI],
    ['taxi', 84, 12, 0], ['truck', -84, 48, Math.PI], ['sports', 150, 210, Math.PI / 2],
    ['sedan', -150, 210, 0], ['coupe', 120, -120, Math.PI / 2], ['suv', -120, 120, 0],
    ['sedan', 60, -60, Math.PI], ['taxi', -60, 60, Math.PI / 2], ['sports', 180, -180, 0],
  ];
  for (const [id, x, z, h] of spots) spawnParkedCars(id, x, z, h);
}

function spawnTrafficCars(count) {
  trafficCars = createTraffic(state, scene, city.roadGraph, count);
}

function spawnPeds(count) {
  peds = createPedestrians(state, scene, count);
  state.peds = peds;
}

function enterCar() {
  const p = state.player;
  if (p.inCar) {
    const car = p.inCar;
    car.isPlayer = false;
    p.inCar = null;
    p.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.4;
    p.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.4;
    p.y = 0;
    player.mesh.visible = true;
    return;
  }
  const car = nearestCar(state, 4.5);
  if (!car) return;
  p.inCar = car;
  car.isPlayer = true;
  car.parked = false;
  player.mesh.visible = false;
  state.stats.carsStolen += 1;
  addWanted(state, 1.0);
  audio.click();
}

function shootAt() {
  const p = state.player;
  const weapon = weaponOf(state);
  if (shootCooldown > 0) return;
  shootCooldown = weapon.rate;
  state.stats.shotsFired += 1;
  audio.gunshot();
  const ox = p.inCar ? p.inCar.x : p.x;
  const oz = p.inCar ? p.inCar.z : p.z;
  const heading = p.inCar ? p.inCar.heading : state.camera.yaw;
  const mx = ox + Math.sin(heading) * 1.5;
  const mz = oz + Math.cos(heading) * 1.5;
  effects.muzzle(mx, 1.4, mz, heading);
  if (p.wanted < 1) addWanted(state, 1.0);
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  let best = null;
  let bestD = weapon.range;
  for (const rival of state.rivals) {
    if (!rival.alive) continue;
    const dx = rival.x - ox;
    const dz = rival.z - oz;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (along > 0 && along < bestD && side < 2.5) {
      bestD = along;
      best = { kind: 'rival', ref: rival };
    }
  }
  for (const ped of peds) {
    if (ped.down) continue;
    const dx = ped.x - ox;
    const dz = ped.z - oz;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (along > 0 && along < bestD && side < 2) {
      bestD = along;
      best = { kind: 'ped', ref: ped };
    }
  }
  if (!best) return;
  if (best.kind === 'rival') {
    best.ref.health -= weapon.damage;
    effects.burst(best.ref.x, 1.2, best.ref.z, 6, 0xff4a4a, 4, 0.4, 0.8);
    if (best.ref.health <= 0) {
      best.ref.alive = false;
      state.mission.eliminated += 1;
    }
  } else {
    knockDownPed(state, best.ref);
    addWanted(state, 2.0);
  }
}

function punchAt() {
  const p = state.player;
  if (punchCooldown > 0 || p.inCar) return;
  punchCooldown = 0.45;
  audio.punch();
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  for (const ped of peds) {
    if (ped.down) continue;
    const dx = ped.x - p.x;
    const dz = ped.z - p.z;
    if (dx * fx + dz * fz > 0 && dist2D(p.x, p.z, ped.x, ped.z) < 2.2) {
      knockDownPed(state, ped);
      addWanted(state, 1.5);
      return;
    }
  }
  for (const rival of state.rivals) {
    if (!rival.alive) continue;
    const dx = rival.x - p.x;
    const dz = rival.z - p.z;
    if (dx * fx + dz * fz > 0 && dist2D(p.x, p.z, rival.x, rival.z) < 2.2) {
      rival.health -= 15;
      if (rival.health <= 0) {
        rival.alive = false;
        state.mission.eliminated += 1;
      }
      return;
    }
  }
}

function collideCarWithBuildings(car) {
  for (const c of city.colliders) {
    if (car.x > c.x0 - 1 && car.x < c.x1 + 1 && car.z > c.z0 - 1 && car.z < c.z1 + 1) {
      return true;
    }
  }
  return false;
}

function stepCar(dt) {
  const p = state.player;
  const car = p.inCar;
  if (!car) return;
  const fwd = (input.held(CONTROLS.forward) ? 1 : 0) - (input.held(CONTROLS.back) ? 1 : 0);
  const steer = (input.held(CONTROLS.right) ? 1 : 0) - (input.held(CONTROLS.left) ? 1 : 0);
  const brake = input.held(CONTROLS.back) && car.speed > 1;
  const handbrake = input.held(CONTROLS.handbrake);
  const prevX = car.x;
  const prevZ = car.z;
  driveCar(car, fwd, steer, brake, handbrake, dt);
  if (collideCarWithBuildings(car)) {
    car.x = prevX;
    car.z = prevZ;
    if (Math.abs(car.speed) > 8) {
      audio.crash();
      state.shake = Math.max(state.shake, 0.4);
      damageCar(car, 0.08);
    }
    car.speed *= 0.3;
    car.group.position.set(car.x, 0, car.z);
  }
  car.x = clamp(car.x, -238, 238);
  car.z = clamp(car.z, -238, 330);
  p.x = car.x;
  p.z = car.z;
  p.heading = car.heading;
  if (Math.abs(car.speed) > 6 && Math.random() < 0.35) {
    effects.dust(car.x - Math.sin(car.heading) * 2, 0, car.z - Math.cos(car.heading) * 2);
  }
  if (car.smoking && Math.random() < 0.5) {
    effects.spawn(car.x, 1.2, car.z, 0, 2, 0, 1.2, 1.8, 0x3a3a3a);
  }
  for (const ped of peds) {
    if (ped.down) continue;
    if (dist2D(car.x, car.z, ped.x, ped.z) < 2.2 && Math.abs(car.speed) > 3) {
      knockDownPed(state, ped);
      addWanted(state, 1.5);
      audio.crash();
    }
  }
  audio.setEngine(Math.abs(car.speed) / car.model.topSpeed);
}

function handleActions() {
  const actions = input.takeActions();
  const mouse = input.takeMouse();
  state.camera.yaw -= mouse.dx * 0.0032;
  state.camera.pitch = clamp(state.camera.pitch + mouse.dy * 0.0022, 0.05, 1.1);
  if (state.screen === SCREEN_TITLE) {
    if (actions & ACT_CONFIRM) startPlay(false);
    return;
  }
  if (state.screen === SCREEN_PAUSED) {
    if (actions & ACT_PAUSE) resumePlay();
    return;
  }
  if (state.screen === 'missions') {
    if (actions & ACT_MISSION || actions & ACT_PAUSE) resumePlay();
    return;
  }
  if (state.screen === SCREEN_BUSTED) {
    if (actions & ACT_CONFIRM) {
      state.busted = false;
      state.screen = SCREEN_PLAY;
    }
    return;
  }
  if (actions & ACT_ENTER) enterCar();
  if (actions & ACT_PUNCH) punchAt();
  if (actions & ACT_PAUSE) {
    state.screen = SCREEN_PAUSED;
    state.paused = true;
  }
  if (actions & ACT_MISSION) state.screen = 'missions';
  if (actions & ACT_RADIO) {
    const name = audio.nextStation();
    hud.setRadioName(name);
    hud.showToast(name);
  }
  if (actions & ACT_MUTE) {
    state.muted = !state.muted;
    audio.setMuted(state.muted);
    hud.showToast(state.muted ? 'Sound muted' : 'Sound on');
  }
  if (input.held(CONTROLS.weapon1)) state.player.weapon = 0;
  else if (input.held(CONTROLS.weapon2)) state.player.weapon = 1;
  else if (input.held(CONTROLS.weapon3)) state.player.weapon = 2;
  else if (input.held(CONTROLS.weapon4)) state.player.weapon = 3;
  if (input.firing()) shootAt();
}

function startPlay(continueSave) {
  audio.ensure();
  audio.startRadio();
  state.started = true;
  state.screen = SCREEN_PLAY;
  status.textContent = 'Playing. WASD to move, E to enter a car, Q for missions.';
  if (!continueSave) {
    state.player.cash = 250;
    state.player.respect = 0;
    state.mission.done = [];
  }
  hud.showToast('Welcome to Solara Bay — press Q for missions', 4);
}

function resumePlay() {
  state.screen = SCREEN_PLAY;
  state.paused = false;
}

function step(dt) {
  state.time += dt;
  shootCooldown = Math.max(0, shootCooldown - dt);
  punchCooldown = Math.max(0, punchCooldown - dt);
  state.shake = Math.max(0, state.shake - dt * 1.4);
  state.flash = Math.max(0, state.flash - dt * 2);
  if (state.screen !== SCREEN_PLAY) return;
  const p = state.player;
  if (p.inCar) stepCar(dt);
  else stepPlayer(state, player, input, city.colliders, dt);
  stepTraffic(state, trafficCars, city.roadGraph, dt);
  stepPedestrians(state, peds, dt);
  stepPolice(state, scene, dt);
  stepMissions(state, scene, dt);
  effects.step(dt);
  audio.setSiren(state.policeCars.length > 0, state.time);
  for (const event of game.takeEvents()) {
    if (event === 'missionDone') {
      audio.missionDone();
      const m = MISSIONS_DONE_TEXT(state);
      hud.showToast(m, 5);
      writeSave(state);
    } else if (event === 'missionFail') {
      hud.showToast('Mission failed — press Q to retry', 4);
    } else if (event === 'pickup') {
      audio.pickup();
    } else if (event === 'wantedUp') {
      hud.showToast(`Wanted level ${Math.floor(p.wanted)} — the SBPD is on you`, 3);
    } else if (event === 'wantedClear') {
      hud.showToast('You lost them. The heat is off.', 3);
    } else if (event === 'busted') {
      bustPlayer(state, scene);
    }
  }
  if (p.health <= 0 && state.screen === SCREEN_PLAY) {
    bustPlayer(state, scene);
  }
}

function MISSIONS_DONE_TEXT(state) {
  const done = state.mission.done.length;
  return `Mission complete! ${done} of 8 done.`;
}

function frame(now) {
  requestAnimationFrame(frame);
  if (shot && !shotDone) {
    shotFrames += 1;
    step(STEP);
    updateCamera(state, camera, STEP);
    hud.update(state, SCREEN_PLAY, STEP);
    renderer.render(scene, camera);
    const need = stageShotFrames;
    if (shotFrames >= need) {
      shotDone = true;
      window.__shotReady = true;
    }
    return;
  }
  const dt = Math.min((now - lastNow) / 1000, MAX_FRAME);
  lastNow = now;
  handleActions();
  let acc = dt;
  while (acc >= STEP) {
    step(STEP);
    acc -= STEP;
  }
  if (state.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * state.shake;
    camera.position.y += (Math.random() - 0.5) * state.shake;
  }
  updateCamera(state, camera, dt);
  hud.update(state, state.screen, dt);
  renderer.render(scene, camera);
}

let lastNow = performance.now();
let stageShotFrames = 120;

function wireButtons() {
  const b = hud.buttons;
  b.btnNew.addEventListener('click', () => { audio.ensure(); startPlay(false); });
  b.btnContinue.addEventListener('click', () => { audio.ensure(); startPlay(true); });
  b.btnMissions.addEventListener('click', () => {
    state.screen = 'missions';
    hud.renderMissionList(state, (m) => {
      const idx = MISSIONS_INDEX(m.id);
      startMission(state, scene, idx);
      state.screen = SCREEN_PLAY;
      hud.showToast(`${m.title} — ${m.briefing}`, 6);
    });
  });
  b.btnResume.addEventListener('click', resumePlay);
  b.btnSave.addEventListener('click', () => {
    writeSave(state);
    hud.showToast('Game saved', 2);
  });
  b.btnQuit.addEventListener('click', () => {
    writeSave(state);
    state.screen = SCREEN_TITLE;
  });
  b.btnMissionBack.addEventListener('click', () => { state.screen = SCREEN_TITLE; });
  b.btnBusted.addEventListener('click', () => {
    state.busted = false;
    state.screen = SCREEN_PLAY;
  });
}

function MISSIONS_INDEX(id) {
  const list = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'];
  return list.indexOf(id);
}

// Boot.
spawnParkedRow();
spawnTrafficCars(22);
spawnPeds(34);
wireButtons();
hud.renderMissionList(state, () => {});
status.textContent = 'Solara Bay. Press Space or click New Game to start.';

if (shot) {
  const result = stageShot(shot, {
    state, scene, roadGraph: city.roadGraph, camera,
    spawnParkedCars,
    spawnTrafficCars,
    spawnPeds,
  });
  stageShotFrames = result.frames;
  state.radioStationName = 'SOLARA FM — Sunset Groove';
  hud.setRadioName('SOLARA FM — Sunset Groove');
} else {
  state.radioStationName = 'SOLARA FM — Sunset Groove';
}
requestAnimationFrame(frame);
