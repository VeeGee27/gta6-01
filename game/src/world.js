// The game's shared state, with no drawing and no browser in it: the player, the cars,
// the pedestrians, the police, the wanted level, the mission progress and the clock.
// Every system reads and writes this one object, so the loop can step them in a fixed
// order and the HUD can read the same numbers the simulation uses. Nothing here knows
// about screens, sound or the DOM; events are queued as plain strings for the loop.
import { CITY, PLAYER, ROAD_LINES } from './config.js';

export const EVENT_SHOT = 'shot';
export const EVENT_CRASH = 'crash';
export const EVENT_MISSION_DONE = 'missionDone';
export const EVENT_MISSION_FAIL = 'missionFail';
export const EVENT_WANTED_UP = 'wantedUp';
export const EVENT_WANTED_CLEAR = 'wantedClear';
export const EVENT_BUSTED = 'busted';
export const EVENT_WASTED = 'wasted';
export const EVENT_PICKUP = 'pickup';
export const EVENT_RADIO = 'radio';

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function angleTo(ax, az, bx, bz) {
  return Math.atan2(bx - ax, bz - az);
}

export function nearestRoadCoord(value) {
  let best = ROAD_LINES[0];
  let bestD = Math.abs(value - best);
  for (const line of ROAD_LINES) {
    const d = Math.abs(value - line);
    if (d < bestD) {
      bestD = d;
      best = line;
    }
  }
  return best;
}

export function onRoad(x, z) {
  const half = CITY.roadWidth / 2 + CITY.sidewalkWidth;
  const nearX = ROAD_LINES.some((line) => Math.abs(x - line) <= half);
  const nearZ = ROAD_LINES.some((line) => Math.abs(z - line) <= half);
  return { x: nearX, z: nearZ };
}

export function districtAt(x, z) {
  if (z >= 120) return 'marina';
  if (z <= -120) return 'oldtown';
  return 'downtown';
}

export function createGame(random) {
  const state = {
    random,
    time: 0,
    started: false,
    paused: false,
    over: false,
    busted: false,
    screen: 'title',
    player: {
      x: 0, z: 30, y: 0, heading: 0, velY: 0, onGround: true,
      health: PLAYER.health, armor: PLAYER.armor,
      cash: 250, respect: 0, weapon: 1, inCar: null,
      wanted: 0, wantedTimer: 0, hiddenTimer: 0,
    },
    camera: { yaw: 0, pitch: 0.32, dist: 9 },
    cars: [],
    peds: [],
    policeCars: [],
    heli: null,
    rivals: [],
    mission: {
      index: 0, active: false, objective: 0,
      timer: 0, collected: 0, eliminated: 0, tailTime: 0,
      raceLap: 0, raceCheckpoint: 0, done: [],
    },
    courier: null,
    markers: [],
    events: [],
    shake: 0,
    flash: 0,
    radioStation: 0,
    muted: false,
    stats: { carsStolen: 0, pedsHit: 0, shotsFired: 0, missionsDone: 0 },
  };

  function reset() {
    state.time = 0;
    state.started = false;
    state.paused = false;
    state.over = false;
    state.busted = false;
    state.screen = 'title';
    const p = state.player;
    p.x = 0; p.z = 30; p.y = 0; p.heading = 0; p.velY = 0; p.onGround = true;
    p.health = PLAYER.health; p.armor = PLAYER.armor;
    p.cash = 250; p.respect = 0; p.weapon = 1; p.inCar = null;
    p.wanted = 0; p.wantedTimer = 0; p.hiddenTimer = 0;
    state.camera.yaw = 0; state.camera.pitch = 0.32; state.camera.dist = 9;
    state.cars.length = 0;
    state.peds.length = 0;
    state.policeCars.length = 0;
    state.heli = null;
    state.rivals.length = 0;
    state.mission.index = 0;
    state.mission.active = false;
    state.mission.objective = 0;
    state.mission.timer = 0;
    state.mission.collected = 0;
    state.mission.eliminated = 0;
    state.mission.tailTime = 0;
    state.mission.raceLap = 0;
    state.mission.raceCheckpoint = 0;
    state.mission.done = [];
    state.courier = null;
    state.markers.length = 0;
    state.events.length = 0;
    state.shake = 0;
    state.flash = 0;
    state.radioStation = 0;
    state.stats.carsStolen = 0;
    state.stats.pedsHit = 0;
    state.stats.shotsFired = 0;
    state.stats.missionsDone = 0;
  }

  function emit(event) {
    state.events.push(event);
  }

  function takeEvents() {
    const taken = state.events.slice();
    state.events.length = 0;
    return taken;
  }

  reset();
  return { state, reset, emit, takeEvents };
}
