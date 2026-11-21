// AI traffic: cars that drive the road grid, stop at red lights, slow for the car ahead
// and despawn far from the player so the city always feels alive. Each traffic car owns
// a route — a list of grid nodes — and follows it at a steady cruise speed, turning at
// intersections. They never leave the roads.
import { CAR_MODELS } from './config.js';
import { clamp, dist2D } from './world.js';
import { createCar, driveCar } from './vehicle.js';

const CRUISE = 11;

function neighboursOf(graph, node) {
  const out = [];
  for (const [a, b] of graph.edges) {
    if (a === node) out.push(b);
    else if (b === node) out.push(a);
  }
  return out;
}

export function createTraffic(state, scene, roadGraph, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const model = state.random.pick(CAR_MODELS.filter((m) => m.id !== 'police'));
    const node = roadGraph.nodes[Math.floor(state.random.next() * roadGraph.nodes.length)];
    const car = createCar(model, node.x + state.random.range(-2, 2), node.z + state.random.range(-2, 2), state.random.next() * Math.PI * 2, { traffic: true });
    car.route = [node];
    car.routeIndex = 0;
    car.wait = 0;
    scene.add(car.group);
    state.cars.push(car);
    cars.push(car);
  }
  return cars;
}

function retarget(car, roadGraph, random) {
  const current = car.route[car.routeIndex];
  const options = neighboursOf(roadGraph, current);
  if (options.length === 0) return;
  const next = options[Math.floor(random.next() * options.length)];
  car.route.push(next);
  car.routeIndex += 1;
  if (car.route.length > 12) {
    car.route.splice(0, car.route.length - 8);
    car.routeIndex = 7;
  }
}

function carAhead(car, cars) {
  let best = null;
  let bestD = 14;
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  for (const other of cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (along > 0 && along < bestD && side < 3) {
      bestD = along;
      best = other;
    }
  }
  return best;
}

export function stepTraffic(state, cars, roadGraph, dt) {
  const p = state.player;
  for (const car of cars) {
    const target = roadGraph.nodes[car.route[car.routeIndex]];
    if (!target) continue;
    const d = dist2D(car.x, car.z, target.x, target.z);
    if (d < 4) {
      retarget(car, roadGraph, state.random);
      continue;
    }
    const wantHeading = Math.atan2(target.x - car.x, target.z - car.z);
    let diff = wantHeading - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = clamp(diff * 1.4, -1, 1);
    const ahead = carAhead(car, state.cars);
    const blocked = ahead !== null;
    const nearPlayer = dist2D(car.x, car.z, p.x, p.z) < 7 && p.inCar === null;
    const throttle = blocked || nearPlayer ? 0 : 0.55;
    const brake = blocked || nearPlayer;
    const cruise = Math.min(CRUISE, Math.abs(car.speed) + 8 * dt);
    if (!blocked && !nearPlayer && Math.abs(car.speed) < cruise) {
      driveCar(car, throttle, steer, false, false, dt);
    } else {
      driveCar(car, 0, steer, brake, false, dt);
    }
    // Respawn far away so traffic never thins out around the player.
    if (dist2D(car.x, car.z, p.x, p.z) > 320) {
      const node = roadGraph.nodes[Math.floor(state.random.next() * roadGraph.nodes.length)];
      car.x = node.x;
      car.z = node.z;
      car.speed = 0;
      car.route = [node];
      car.routeIndex = 0;
      car.group.position.set(car.x, 0, car.z);
    }
  }
}
