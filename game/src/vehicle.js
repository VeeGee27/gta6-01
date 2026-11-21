// Cars: building them from boxes and cylinders, and driving them. One clear job: the
// car models (six civilian models plus the police interceptor), the arcade physics
// (engine, steering, brake, handbrake drift, damage and smoke), and entering / exiting.
// A car is a THREE.Group with a body, a cabin, four wheels and headlights; the physics
// moves it on the ground plane and the wheels spin and steer to match.
import * as THREE from 'three';
import { CAR_MODELS } from './config.js';
import { clamp } from './world.js';

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14141a });

export function modelById(id) {
  return CAR_MODELS.find((m) => m.id === id) || CAR_MODELS[0];
}

export function buildCarMesh(model, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: model.color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(model.wid, model.h * 0.55, model.len), paint);
  body.position.y = model.h * 0.42;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(model.wid * 0.82, model.h * 0.5, model.len * 0.48), glass);
  cabin.position.set(0, model.h * 0.85, -model.len * 0.05);
  cabin.castShadow = true;
  group.add(cabin);
  const wheels = [];
  const wx = model.wid / 2 - 0.08;
  const wz = model.len / 2 - 0.75;
  for (const [x, z] of [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  for (const x of [-model.wid / 2 + 0.3, model.wid / 2 - 0.3]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.1), lightMat);
    lamp.position.set(x, model.h * 0.45, model.len / 2 + 0.02);
    group.add(lamp);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(model.wid * 0.5, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    bar.position.set(0, model.h * 1.15, 0);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.3, model.h * 1.15, 0);
    red.name = 'lightRed';
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.set(0.3, model.h * 1.15, 0);
    blue.name = 'lightBlue';
    group.add(blue);
  }
  return { group, wheels };
}

export function createCar(model, x, z, heading, opts = {}) {
  const { group, wheels } = buildCarMesh(model, opts.police === true);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  return {
    model,
    group,
    wheels,
    x, z, heading,
    speed: 0,
    steer: 0,
    damage: 0,
    smoking: false,
    isPlayer: opts.player === true,
    isPolice: opts.police === true,
    isTraffic: opts.traffic === true,
    parked: opts.parked === true,
    driver: opts.driver || null,
    horn: 0,
  };
}

/** Arcade step: throttle, steering and brake from -1..1, handbrake true/false. */
export function driveCar(car, throttle, steerInput, brake, handbrake, dt) {
  const m = car.model;
  const maxSpeed = m.topSpeed * (1 - car.damage * 0.45);
  if (throttle > 0) car.speed += m.accel * throttle * dt;
  else if (throttle < 0) car.speed += m.accel * 0.7 * throttle * dt;
  if (brake) car.speed -= Math.sign(car.speed) * 26 * dt;
  if (!throttle && !brake) car.speed -= Math.sign(car.speed) * 6 * dt;
  if (Math.abs(car.speed) < 0.15 && !throttle) car.speed = 0;
  car.speed = clamp(car.speed, -maxSpeed * 0.45, maxSpeed);
  const grip = handbrake ? m.grip * 0.45 : m.grip;
  const targetSteer = steerInput * 0.55;
  car.steer += (targetSteer - car.steer) * Math.min(1, 10 * dt);
  const turnRate = car.steer * grip * clamp(Math.abs(car.speed) / 12, 0, 1) * (car.speed >= 0 ? 1 : -1);
  car.heading += turnRate * dt * (handbrake ? 1.6 : 1);
  const forward = car.speed * dt;
  car.x += Math.sin(car.heading) * forward;
  car.z += Math.cos(car.heading) * forward;
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  for (let i = 0; i < car.wheels.length; i += 1) {
    const wheel = car.wheels[i];
    wheel.rotation.x += (car.speed * dt) / 0.36;
    if (i < 2) wheel.rotation.y = car.steer * 0.7;
  }
  if (car.damage > 0.55 && !car.smoking) car.smoking = true;
}

export function damageCar(car, amount) {
  car.damage = clamp(car.damage + amount, 0, 1);
  if (car.damage >= 1) {
    car.speed = 0;
    return true;
  }
  return false;
}
