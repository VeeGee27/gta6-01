// Builds the 3D city of Solara Bay into the scene: ground, the road grid, sidewalks,
// buildings with lit windows, the beach, the pier, the sea, palms, streetlights and
// traffic lights, plus the golden-hour sun, sky and fog. Returns the colliders (building
// boxes the player and cars must not pass through), the road graph the traffic AI drives
// on, and the spawn points. Everything is procedural — no texture or model file is loaded.
import * as THREE from 'three';
import { CITY, DISTRICTS, PALETTE, ROAD_LINES } from './config.js';

function facadeTexture(base, litRatio, random) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 6;
  const rows = 14;
  const w = 128 / cols;
  const h = 256 / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = random.next() < litRatio;
      ctx.fillStyle = lit ? '#ffd98a' : '#2a3a4a';
      ctx.fillRect(c * w + 3, r * h + 4, w - 6, h - 8);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roadTexture(horizontal) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3a3a42';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#e8d878';
  if (horizontal) {
    // Centre line along U (the road's length for an east-west road).
    ctx.fillRect(0, 30, 28, 4);
    ctx.fillRect(36, 30, 28, 4);
  } else {
    // Centre line along V (the road's length for a north-south road).
    ctx.fillRect(30, 0, 4, 28);
    ctx.fillRect(30, 36, 4, 28);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, random) {
  const colliders = [];
  const roadGraph = { nodes: [], edges: [] };
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  // Sky, fog and golden-hour light.
  scene.background = new THREE.Color(0xf7b26a);
  scene.fog = new THREE.Fog(0xe8a06a, 180, 620);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
  sun.position.set(-120, 90, -160);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0x8aa8d8, 0x8a6a4a, 0.9);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffc890, 0.35);
  scene.add(amb);

  // Sun disc low in the west, and a few flat clouds.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe8b0, fog: false }),
  );
  sunDisc.position.set(-420, 70, -380);
  sunDisc.lookAt(0, 40, 0);
  group.add(sunDisc);
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffe0c0, transparent: true, opacity: 0.85, fog: false });
  for (let i = 0; i < 9; i += 1) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(random.range(18, 34), 8, 6), cloudMat);
    cloud.scale.y = 0.32;
    cloud.position.set(random.range(-420, 420), random.range(90, 150), random.range(-420, 200));
    group.add(cloud);
  }

  // Ground: grass base, sand strip, and the sea plane beyond the beach.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.size + 400, CITY.size + 400),
    new THREE.MeshLambertMaterial({ color: 0x5a7a4a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.size + 400, CITY.sandDepth + 20),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, CITY.beachStart + CITY.sandDepth / 2);
  sand.receiveShadow = true;
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.size + 600, CITY.seaFar - CITY.seaStart),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.01, (CITY.seaStart + CITY.seaFar) / 2);
  group.add(sea);

  // Roads: dark strips along every grid line, with a dashed centre line texture.
  // The north-south road is a plane whose length runs along Z (rotation.x only); the
  // east-west road's length runs along X and needs the centre line drawn along U.
  const vRoadTex = roadTexture(false);
  const hRoadTex = roadTexture(true);
  const vRoadMat = new THREE.MeshLambertMaterial({ map: vRoadTex });
  const hRoadMat = new THREE.MeshLambertMaterial({ map: hRoadTex });
  for (const line of ROAD_LINES) {
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, CITY.size), vRoadMat.clone());
    vRoad.material.map = vRoadTex.clone();
    vRoad.material.map.repeat.set(1, CITY.size / 12);
    vRoad.material.map.needsUpdate = true;
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(line, 0.04, 0);
    vRoad.receiveShadow = true;
    group.add(vRoad);
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(CITY.size, CITY.roadWidth), hRoadMat.clone());
    hRoad.material.map = hRoadTex.clone();
    hRoad.material.map.repeat.set(CITY.size / 12, 1);
    hRoad.material.map.needsUpdate = true;
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, 0.04, line);
    hRoad.receiveShadow = true;
    group.add(hRoad);
  }

  // Sidewalks: lighter strips hugging each road.
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  for (const line of ROAD_LINES) {
    for (const side of [-1, 1]) {
      const off = CITY.roadWidth / 2 + CITY.sidewalkWidth / 2;
      const vWalk = new THREE.Mesh(new THREE.PlaneGeometry(CITY.sidewalkWidth, CITY.size), walkMat);
      vWalk.rotation.x = -Math.PI / 2;
      vWalk.position.set(line + side * off, 0.06, 0);
      vWalk.receiveShadow = true;
      group.add(vWalk);
      const hWalk = new THREE.Mesh(new THREE.PlaneGeometry(CITY.size, CITY.sidewalkWidth), walkMat);
      hWalk.rotation.x = -Math.PI / 2;
      hWalk.position.set(0, 0.06, line + side * off);
      hWalk.receiveShadow = true;
      group.add(hWalk);
    }
  }

  // Buildings: one or two per block, height and colour by district, facades with lit windows.
  const districts = Object.values(DISTRICTS);
  function districtFor(x, z) {
    for (const d of districts) {
      if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
    }
    return DISTRICTS.downtown;
  }
  const facadeCache = new Map();
  function facadeFor(color, lit) {
    const key = `${color}-${lit}`;
    if (!facadeCache.has(key)) {
      const hex = `#${color.toString(16).padStart(6, '0')}`;
      facadeCache.set(key, facadeTexture(hex, lit, random));
    }
    return facadeCache.get(key);
  }
  let buildingCount = 0;
  for (let gx = 0; gx < ROAD_LINES.length - 1; gx += 1) {
    for (let gz = 0; gz < ROAD_LINES.length - 1; gz += 1) {
      const x0 = ROAD_LINES[gx] + CITY.roadWidth / 2 + CITY.sidewalkWidth;
      const x1 = ROAD_LINES[gx + 1] - CITY.roadWidth / 2 - CITY.sidewalkWidth;
      const z0 = ROAD_LINES[gz] + CITY.roadWidth / 2 + CITY.sidewalkWidth;
      const z1 = ROAD_LINES[gz + 1] - CITY.roadWidth / 2 - CITY.sidewalkWidth;
      if (z0 >= CITY.beachStart) continue;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const d = districtFor(cx, cz);
      const count = random.next() < 0.45 ? 2 : 1;
      for (let b = 0; b < count; b += 1) {
        const w = random.range(14, Math.max(16, (x1 - x0) / count - 4));
        const dep = random.range(12, Math.max(14, z1 - z0 - 6));
        const h = random.range(d.minH, d.maxH);
        const color = random.pick(d.palette);
        const bx = count === 1 ? cx : x0 + (b + 0.5) * ((x1 - x0) / count);
        const bz = cz + random.range(-4, 4);
        const mat = new THREE.MeshLambertMaterial({ map: facadeFor(color, 0.45) });
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), mat);
        building.position.set(bx, h / 2, bz);
        building.castShadow = true;
        building.receiveShadow = true;
        group.add(building);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.5, dep + 0.6),
          new THREE.MeshLambertMaterial({ color: 0x4a4a52 }),
        );
        roof.position.set(bx, h + 0.25, bz);
        group.add(roof);
        colliders.push({ x0: bx - w / 2, x1: bx + w / 2, z0: bz - dep / 2, z1: bz + dep / 2 });
        buildingCount += 1;
      }
    }
  }

  // Beach palms, pier and streetlights.
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });
  function addPalm(x, z) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
    trunk.position.y = 3.5;
    trunk.rotation.z = random.range(-0.08, 0.08);
    palm.add(trunk);
    for (let i = 0; i < 6; i += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.6, 7.2, Math.sin(a) * 1.6);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      palm.add(leaf);
    }
    palm.position.set(x, 0, z);
    palm.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(palm);
  }
  for (let x = -230; x <= 230; x += 18) {
    if (random.next() < 0.8) addPalm(x + random.range(-3, 3), CITY.beachStart + random.range(4, 50));
  }
  for (let i = 0; i < 24; i += 1) {
    const x = random.pick(ROAD_LINES);
    const z = random.range(-220, 220);
    addPalm(x + (random.next() < 0.5 ? -1 : 1) * (CITY.roadWidth / 2 + CITY.sidewalkWidth + 2), z);
  }
  // Pier out into the sea.
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(10, 1, 90),
    new THREE.MeshLambertMaterial({ color: 0x8a6a4a }),
  );
  pier.position.set(60, 1.2, CITY.seaStart + 20);
  pier.castShadow = true;
  group.add(pier);
  for (let z = CITY.seaStart; z < CITY.seaStart + 60; z += 12) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 6), trunkMat);
    post.position.set(56, 0.5, z);
    group.add(post);
    const post2 = post.clone();
    post2.position.x = 64;
    group.add(post2);
  }

  // Streetlights along the roads.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a32 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe8a0 });
  for (const line of ROAD_LINES) {
    for (let t = -210; t <= 210; t += 60) {
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), poleMat);
        pole.position.set(line + side * (CITY.roadWidth / 2 + 1), 3.5, t);
        group.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
        lamp.position.set(line + side * (CITY.roadWidth / 2 + 1), 7.1, t);
        group.add(lamp);
      }
    }
  }

  // Road graph: every grid intersection is a node; neighbours along a road are edges.
  const nodeId = new Map();
  for (const x of ROAD_LINES) {
    for (const z of ROAD_LINES) {
      const id = roadGraph.nodes.length;
      nodeId.set(`${x},${z}`, id);
      roadGraph.nodes.push({ x, z });
    }
  }
  for (const x of ROAD_LINES) {
    for (let i = 0; i < ROAD_LINES.length - 1; i += 1) {
      const a = nodeId.get(`${x},${ROAD_LINES[i]}`);
      const b = nodeId.get(`${x},${ROAD_LINES[i + 1]}`);
      roadGraph.edges.push([a, b]);
    }
  }
  for (const z of ROAD_LINES) {
    for (let i = 0; i < ROAD_LINES.length - 1; i += 1) {
      const a = nodeId.get(`${ROAD_LINES[i]},${z}`);
      const b = nodeId.get(`${ROAD_LINES[i + 1]},${z}`);
      roadGraph.edges.push([a, b]);
    }
  }

  return {
    colliders,
    roadGraph,
    buildingCount,
    spawns: {
      player: { x: 0, z: 30 },
      garage: { x: -150, z: 210 },
      bank: { x: 30, z: 30 },
      safehouse: { x: -210, z: 210 },
      docks: { x: 180, z: 225 },
    },
  };
}
