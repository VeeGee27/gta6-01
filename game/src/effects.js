// Effects: dust kicked up by tyres, skid marks, muzzle flashes, explosions and smoke,
// and the screen shake and damage flash the camera feels. Particles are pooled meshes
// reused across frames, so the game allocates nothing while it runs.
import * as THREE from 'three';

const POOL = 220;

export function createEffects(scene) {
  const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  const mesh = new THREE.InstancedMesh(geo, mat, POOL);
  mesh.count = 0;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const parts = [];
  for (let i = 0; i < POOL; i += 1) {
    parts.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, color: new THREE.Color(0xffffff) });
  }
  const dummy = new THREE.Object3D();
  let cursor = 0;

  function spawn(x, y, z, vx, vy, vz, life, size, color) {
    const part = parts[cursor];
    cursor = (cursor + 1) % POOL;
    part.alive = true;
    part.x = x; part.y = y; part.z = z;
    part.vx = vx; part.vy = vy; part.vz = vz;
    part.life = life;
    part.max = life;
    part.size = size;
    part.color.setHex(color);
  }

  function burst(x, y, z, count, color, speed, life, size) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * speed;
      spawn(x, y, z, Math.cos(a) * speed, up, Math.sin(a) * speed, life * (0.6 + Math.random() * 0.6), size, color);
    }
  }

  function muzzle(x, y, z, heading) {
    burst(x + Math.sin(heading) * 1.2, y, z + Math.cos(heading) * 1.2, 5, 0xffd24a, 6, 0.12, 0.9);
  }

  function explosion(x, y, z) {
    burst(x, y + 0.6, z, 40, 0xff7a2a, 14, 0.9, 1.6);
    burst(x, y + 1.2, z, 24, 0x3a3a3a, 7, 1.6, 2.2);
    burst(x, y + 0.4, z, 16, 0xffe8a0, 20, 0.4, 1.1);
  }

  function dust(x, y, z) {
    spawn(x, y + 0.15, z, (Math.random() - 0.5) * 1.6, 0.6, (Math.random() - 0.5) * 1.6, 0.7, 1.4, 0xc8b898);
  }

  function step(dt) {
    let count = 0;
    for (const part of parts) {
      if (!part.alive) continue;
      part.life -= dt;
      if (part.life <= 0) {
        part.alive = false;
        continue;
      }
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.z += part.vz * dt;
      part.vy -= 6 * dt;
      const scale = part.size * (0.5 + (part.life / part.max) * 0.5);
      dummy.position.set(part.x, part.y, part.z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(count, dummy.matrix);
      mesh.setColorAt(count, part.color);
      count += 1;
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  return { spawn, burst, muzzle, explosion, dust, step };
}
