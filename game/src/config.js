// Solara Bay — shared constants: city layout, districts, cars, weapons, missions.
// One clear job: every tunable number and every piece of game data lives here so the
// other modules read it instead of hard-coding their own copies.
export const STEP = 1 / 60;

export const CITY = {
  size: 480,
  half: 240,
  roadSpacing: 60,
  roadWidth: 12,
  sidewalkWidth: 3,
  beachStart: 240,
  sandDepth: 60,
  seaStart: 300,
  seaFar: 700,
  blockSize: 48,
};

export const ROAD_LINES = [-240, -180, -120, -60, 0, 60, 120, 180, 240];

export const DISTRICTS = {
  downtown: { x0: -120, z0: -120, x1: 120, z1: 120, name: 'Downtown', minH: 22, maxH: 58, palette: [0x8f7fb8, 0x6f7f9e, 0xa08a7a, 0x7a8ba0, 0x9a8f7a] },
  marina: { x0: -240, z0: 120, x1: 240, z1: 240, name: 'Marina', minH: 8, maxH: 20, palette: [0xe8d8b0, 0xd8c8a8, 0xc8b898, 0xf0e0c0, 0xd8b898] },
  oldtown: { x0: -240, z0: -240, x1: 240, z1: -120, name: 'Old Town', minH: 6, maxH: 14, palette: [0xc8a878, 0xb89868, 0xd8b088, 0xa88858, 0xc09878] },
};

export const PALETTE = {
  skyTop: 0x2e4a7a,
  skyMid: 0xe8965a,
  skyLow: 0xf7c873,
  sun: 0xffd9a0,
  sea: 0x2a6a8a,
  sand: 0xe8d5a8,
  grass: 0x6a8a5a,
  road: 0x3a3a42,
  roadLine: 0xe8d878,
  sidewalk: 0x9a9a92,
  buildingGlass: 0x4a6a8a,
  palmTrunk: 0x8a6a4a,
  palmLeaf: 0x3a7a3a,
  police: 0x1a2a4a,
  policeLightRed: 0xff2222,
  policeLightBlue: 0x2266ff,
  taxi: 0xf7c81a,
};

export const CAR_MODELS = [
  { id: 'sedan', name: 'Vela Sedan', color: 0x8a2a2a, topSpeed: 34, accel: 16, grip: 2.6, len: 4.4, wid: 1.9, h: 1.35 },
  { id: 'coupe', name: 'Sol Coupe', color: 0x2a5a8a, topSpeed: 38, accel: 19, grip: 2.9, len: 4.2, wid: 1.85, h: 1.25 },
  { id: 'suv', name: 'Brisa SUV', color: 0x3a3a3a, topSpeed: 30, accel: 13, grip: 2.2, len: 4.8, wid: 2.0, h: 1.8 },
  { id: 'taxi', name: 'Bay Taxi', color: 0xf7c81a, topSpeed: 32, accel: 14, grip: 2.5, len: 4.4, wid: 1.9, h: 1.45 },
  { id: 'truck', name: 'Cargo Hauler', color: 0x7a7a7a, topSpeed: 26, accel: 10, grip: 1.9, len: 5.6, wid: 2.1, h: 2.2 },
  { id: 'sports', name: 'Cometa GT', color: 0xc81a3a, topSpeed: 46, accel: 24, grip: 3.2, len: 4.3, wid: 1.95, h: 1.15 },
  { id: 'police', name: 'SBPD Interceptor', color: 0x1a2a4a, topSpeed: 42, accel: 22, grip: 3.0, len: 4.5, wid: 1.95, h: 1.4 },
];

export const WEAPONS = [
  { id: 'fists', name: 'Fists', damage: 15, range: 2.2, rate: 0.45, auto: false },
  { id: 'pistol', name: 'Pistol', damage: 25, range: 45, rate: 0.28, auto: false },
  { id: 'smg', name: 'SMG', damage: 14, range: 38, rate: 0.09, auto: true },
  { id: 'shotgun', name: 'Shotgun', damage: 60, range: 18, rate: 0.9, auto: false },
];

export const WANTED = {
  maxStars: 5,
  decayDelay: 14,
  decayRate: 0.5,
  crimeHeat: { stealCar: 1.0, hitPed: 1.5, shoot: 1.0, killPed: 2.0, speedNearPolice: 0.4 },
  policePerStar: [0, 1, 2, 3, 4, 5],
  roadblockAt: 3,
  heliAt: 4,
};

export const MISSIONS = [
  {
    id: 'm1', title: 'First Wheels', contact: 'Mara Solis',
    briefing: 'Rico, welcome to Solara Bay. Mara here. A red Cometa GT is parked on Marina Row — take it and bring it to my garage on Harbor Street. Don\'t scratch it. Much.',
    objectives: [
      { type: 'goto', label: 'Reach the Cometa GT on Marina Row', pos: [150, 210], radius: 6 },
      { type: 'enterCar', label: 'Get in the Cometa GT', carId: 'sports' },
      { type: 'driveTo', label: 'Drive the Cometa to Mara\'s garage', pos: [-150, 210], radius: 8 },
    ],
    payout: 400, respect: 10,
  },
  {
    id: 'm2', title: 'Bayview Delivery', contact: 'Mara Solis',
    briefing: 'A package needs to reach the Old Town market in 90 seconds. The SBPD is out in force, so keep it clean — or at least keep it fast.',
    objectives: [
      { type: 'driveTo', label: 'Deliver the package to Old Town market', pos: [-150, -180], radius: 8, time: 90 },
    ],
    payout: 650, respect: 12,
  },
  {
    id: 'm3', title: 'Tail the Courier', contact: 'Mara Solis',
    briefing: 'A courier is moving product through Downtown. Follow him — stay close enough to see him, far enough that he never sees you.',
    objectives: [
      { type: 'tail', label: 'Tail the courier through Downtown', target: 'courier', minDist: 10, maxDist: 45, duration: 40 },
    ],
    payout: 800, respect: 15,
  },
  {
    id: 'm4', title: 'Dockside Pickup', contact: 'Mara Solis',
    briefing: 'Three crates are waiting on the Marina docks. Grab them all and bring them back to the garage. Watch the harbour patrol.',
    objectives: [
      { type: 'collect', label: 'Collect the crates at the Marina docks', items: [[80, 272], [90, 277], [100, 272]], radius: 5 },
    ],
    payout: 900, respect: 15,
  },
  {
    id: 'm5', title: 'Heat on the Strip', contact: 'Mara Solis',
    briefing: 'You made the front page, Rico. The SBPD wants you. Stay out of their hands for a full minute and they will lose interest.',
    objectives: [
      { type: 'survive', label: 'Lose the SBPD — survive 60 seconds at 2 stars', stars: 2, duration: 60 },
    ],
    payout: 1000, respect: 20,
  },
  {
    id: 'm6', title: 'Rooftop Standoff', contact: 'Mara Solis',
    briefing: 'The Vipers took the Marina rooftop. Five of them, armed. Take them down and the Marina is ours.',
    objectives: [
      { type: 'eliminate', label: 'Eliminate the 5 Vipers on the Marina rooftop', count: 5, area: [120, 210], radius: 30 },
    ],
    payout: 1400, respect: 25,
  },
  {
    id: 'm7', title: 'Midnight Grand Prix', contact: 'Mara Solis',
    briefing: 'Street race, three laps around the bay. Beat the pack and the whole city will know your name.',
    objectives: [
      { type: 'race', label: 'Win the Midnight Grand Prix — 3 laps', checkpoints: [[180, 180], [-180, 180], [-180, -180], [180, -180]], laps: 3 },
    ],
    payout: 2000, respect: 30,
  },
  {
    id: 'm8', title: 'The Solara Heist', contact: 'Mara Solis',
    briefing: 'The big one. Downtown bank, the vault, and a clean getaway. Get in, get the cash, and lose a four-star tail to the safehouse.',
    objectives: [
      { type: 'goto', label: 'Reach the Downtown bank', pos: [30, 30], radius: 8 },
      { type: 'collect', label: 'Grab the vault cash', items: [[30, 30]], radius: 6 },
      { type: 'escape', label: 'Escape the 4-star tail — reach the safehouse', pos: [-210, 210], radius: 10, stars: 4 },
    ],
    payout: 5000, respect: 50,
  },
];

export const CONTROLS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  sprint: 'ShiftLeft', jump: 'Space', enterCar: 'KeyE', punch: 'KeyF',
  weapon1: 'Digit1', weapon2: 'Digit2', weapon3: 'Digit3', weapon4: 'Digit4',
  handbrake: 'Space', horn: 'KeyH', radio: 'KeyR', mute: 'KeyM',
  pause: 'Escape', mission: 'KeyM', map: 'KeyN',
};

export const SAVE_KEY = 'solara-bay-save-v1';

export const PLAYER = {
  walkSpeed: 6, sprintSpeed: 10, jumpSpeed: 8, gravity: 22,
  radius: 0.6, height: 1.8, health: 100, armor: 50,
};
