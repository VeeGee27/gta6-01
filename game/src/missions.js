// Missions: Rico Vega's eight story jobs for Mara Solis, each a list of objectives the
// state machine walks through. Objective types: goto (reach a marker on foot or in a
// car), enterCar (get into a named car), driveTo (reach a marker in a car, optionally
// timed), collect (pick up items), tail (follow a moving target inside a distance band),
// survive (stay alive at a wanted level for a duration), eliminate (shoot rivals),
// race (hit checkpoints in order for laps), escape (reach a marker while wanted).
// Completing a mission pays cash, adds respect and unlocks the next one.
import { MISSIONS } from './config.js';
import { clamp, dist2D } from './world.js';
import { addWanted } from './police.js';
import { createCar, modelById } from './vehicle.js';

export function missionList(state) {
  return MISSIONS.map((m, i) => ({
    ...m,
    done: state.mission.done.includes(m.id),
    locked: i > 0 && !state.mission.done.includes(MISSIONS[i - 1].id),
  }));
}

export function currentMission(state) {
  const m = state.mission;
  if (!m.active) return null;
  return MISSIONS[m.index] || null;
}

export function currentObjective(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  return mission.objectives[state.mission.objective] || null;
}

export function startMission(state, scene, index) {
  const mission = MISSIONS[index];
  if (!mission) return false;
  const m = state.mission;
  m.index = index;
  m.active = true;
  m.objective = 0;
  m.timer = 0;
  m.collected = 0;
  m.eliminated = 0;
  m.tailTime = 0;
  m.raceLap = 0;
  m.raceCheckpoint = 0;
  state.markers.length = 0;
  // Mission-specific setup: the sports car for m1, the courier for m3, rivals for m6.
  if (mission.id === 'm1') {
    const car = createCar(modelById('sports'), 150, 210, Math.PI / 2, { parked: true });
    scene.add(car.group);
    state.cars.push(car);
    state.missionCar = car;
  }
  if (mission.id === 'm3') {
    const car = createCar(modelById('sedan'), 0, -60, 0, { traffic: true });
    car.route = [];
    scene.add(car.group);
    state.cars.push(car);
    state.courier = car;
  }
  if (mission.id === 'm6') {
    state.rivals = [];
    for (let i = 0; i < 5; i += 1) {
      state.rivals.push({
        x: 120 + state.random.range(-20, 20),
        z: 210 + state.random.range(-15, 15),
        health: 50,
        alive: true,
      });
    }
  }
  if (mission.id === 'm5') addWanted(state, 2);
  if (mission.id === 'm8') addWanted(state, 0);
  refreshMarker(state);
  return true;
}

export function refreshMarker(state) {
  const obj = currentObjective(state);
  state.markers.length = 0;
  if (!obj) return;
  if (obj.pos) state.markers.push({ x: obj.pos[0], z: obj.pos[1], radius: obj.radius || 8 });
  else if (obj.items) {
    for (const item of obj.items) state.markers.push({ x: item[0], z: item[1], radius: obj.radius || 5 });
  } else if (obj.checkpoints) {
    const cp = obj.checkpoints[state.mission.raceCheckpoint % obj.checkpoints.length];
    state.markers.push({ x: cp[0], z: cp[1], radius: 10 });
  } else if (obj.target === 'courier' && state.courier) {
    state.markers.push({ x: state.courier.x, z: state.courier.z, radius: 12 });
  } else if (obj.area) {
    state.markers.push({ x: obj.area[0], z: obj.area[1], radius: obj.radius || 30 });
  }
}

function advanceObjective(state, scene) {
  const mission = currentMission(state);
  if (!mission) return;
  state.mission.objective += 1;
  state.mission.timer = 0;
  state.mission.collected = 0;
  if (state.mission.objective >= mission.objectives.length) {
    completeMission(state, scene);
    return;
  }
  refreshMarker(state);
}

function completeMission(state, scene) {
  const mission = currentMission(state);
  if (!mission) return;
  state.player.cash += mission.payout;
  state.player.respect += mission.respect;
  state.stats.missionsDone += 1;
  state.mission.done.push(mission.id);
  state.mission.active = false;
  state.mission.objective = 0;
  state.markers.length = 0;
  if (state.courier) {
    state.courier.isTraffic = true;
    state.courier = null;
  }
  state.events.push('missionDone');
}

function failMission(state) {
  state.mission.active = false;
  state.mission.objective = 0;
  state.markers.length = 0;
  state.courier = null;
  state.events.push('missionFail');
}

export function stepMissions(state, scene, dt) {
  const mission = currentMission(state);
  if (!mission) return;
  const obj = currentObjective(state);
  if (!obj) return;
  const p = state.player;
  const m = state.mission;
  m.timer += dt;
  if (obj.time && m.timer > obj.time) {
    failMission(state);
    return;
  }
  if (obj.type === 'goto' || obj.type === 'driveTo') {
    const [x, z] = obj.pos;
    if (dist2D(p.x, p.z, x, z) < (obj.radius || 8)) advanceObjective(state, scene);
  } else if (obj.type === 'enterCar') {
    if (p.inCar && p.inCar.model.id === obj.carId) advanceObjective(state, scene);
  } else if (obj.type === 'collect') {
    for (let i = 0; i < obj.items.length; i += 1) {
      const item = obj.items[i];
      if (item.taken) continue;
      if (dist2D(p.x, p.z, item[0], item[1]) < (obj.radius || 5)) {
        item.taken = true;
        m.collected += 1;
        state.events.push('pickup');
        state.markers = state.markers.filter((mk) => !(mk.x === item[0] && mk.z === item[1]));
      }
    }
    if (m.collected >= obj.items.length) {
      for (const item of obj.items) item.taken = false;
      advanceObjective(state, scene);
    }
  } else if (obj.type === 'tail') {
    if (!state.courier) {
      failMission(state);
      return;
    }
    const d = dist2D(p.x, p.z, state.courier.x, state.courier.z);
    if (d > obj.maxDist || d < obj.minDist * 0.4) {
      failMission(state);
      return;
    }
    if (d >= obj.minDist && d <= obj.maxDist) m.tailTime += dt;
    if (m.tailTime >= obj.duration) advanceObjective(state, scene);
  } else if (obj.type === 'survive') {
    if (Math.floor(p.wanted) < obj.stars) {
      addWanted(state, 0.5);
    }
    if (m.timer >= obj.duration) {
      p.wanted = 0;
      advanceObjective(state, scene);
    }
  } else if (obj.type === 'eliminate') {
    const alive = state.rivals.filter((r) => r.alive).length;
    if (alive === 0) advanceObjective(state, scene);
  } else if (obj.type === 'race') {
    const cp = obj.checkpoints[m.raceCheckpoint % obj.checkpoints.length];
    if (dist2D(p.x, p.z, cp[0], cp[1]) < 12) {
      m.raceCheckpoint += 1;
      if (m.raceCheckpoint % obj.checkpoints.length === 0) m.raceLap += 1;
      if (m.raceLap >= obj.laps) {
        advanceObjective(state, scene);
        return;
      }
      refreshMarker(state);
    }
  } else if (obj.type === 'escape') {
    if (Math.floor(p.wanted) < obj.stars) addWanted(state, 0.5);
    const [x, z] = obj.pos;
    if (dist2D(p.x, p.z, x, z) < (obj.radius || 10)) {
      p.wanted = 0;
      advanceObjective(state, scene);
    }
  }
  refreshMarker(state);
}

export function abortMission(state) {
  if (!currentMission(state)) return;
  failMission(state);
}
