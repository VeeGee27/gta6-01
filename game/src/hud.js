// The HUD and the menus: health and armour bars, cash, wanted stars, the mission
// objective banner, the speedometer, weapon slots, the radio station, the live minimap
// (a canvas that draws the roads, the player, traffic, police and the mission marker),
// and the title, pause, mission-select and busted screens. All DOM; the 3D canvas
// stays a canvas. Text that holds a number is rebuilt only when the number changes.
import { CITY, MISSIONS, ROAD_LINES, WEAPONS } from './config.js';
import { currentMission, currentObjective, missionList } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

const MAP_SIZE = 168;
const MAP_RANGE = 520;

function el(tag, cls, parent, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

export function createHud() {
  const root = document.getElementById('hud');
  const topLeft = el('div', 'hud-topleft', root);
  const bars = el('div', 'hud-bars', topLeft);
  const healthRow = el('div', 'hud-bar-row', bars);
  el('span', 'hud-label', healthRow, 'HEALTH');
  const healthBar = el('div', 'hud-bar', healthRow);
  const healthFill = el('div', 'hud-fill health', healthBar);
  const armorRow = el('div', 'hud-bar-row', bars);
  el('span', 'hud-label', armorRow, 'ARMOUR');
  const armorBar = el('div', 'hud-bar', armorRow);
  const armorFill = el('div', 'hud-fill armor', armorBar);
  const cashRow = el('div', 'hud-cash', topLeft);
  const cash = el('span', 'hud-cash-value', cashRow, '$250');
  el('span', 'hud-cash-label', cashRow, 'CASH');
  const respectRow = el('div', 'hud-respect', topLeft);
  const respect = el('span', 'hud-respect-value', respectRow, '0');
  el('span', 'hud-respect-label', respectRow, 'RESPECT');

  const topRight = el('div', 'hud-topright', root);
  const stars = el('div', 'hud-stars', topRight);
  const starNodes = [];
  for (let i = 0; i < 5; i += 1) {
    starNodes.push(el('span', 'hud-star', stars, '★'));
  }
  const minimap = document.createElement('canvas');
  minimap.id = 'minimap';
  minimap.width = MAP_SIZE;
  minimap.height = MAP_SIZE;
  topRight.appendChild(minimap);

  const objective = el('div', 'hud-objective', root);
  const objectiveTitle = el('div', 'hud-objective-title', objective, '');
  const objectiveLabel = el('div', 'hud-objective-label', objective, '');

  const bottomLeft = el('div', 'hud-bottomleft', root);
  const weapons = el('div', 'hud-weapons', bottomLeft);
  const weaponNodes = WEAPONS.map((w, i) => el('div', 'hud-weapon', weapons, `${i + 1} ${w.name}`));
  const radio = el('div', 'hud-radio', bottomLeft, 'SOLARA FM — Sunset Groove');

  const bottomRight = el('div', 'hud-bottomright', root);
  const speed = el('div', 'hud-speed', bottomRight, '0');
  el('div', 'hud-speed-unit', bottomRight, 'km/h');

  const toast = el('div', 'hud-toast', root, '');
  const vignette = el('div', 'hud-vignette', root);

  const title = el('div', 'hud-screen', root);
  title.id = 'screen-title';
  el('div', 'hud-game-title', title, 'SOLARA BAY');
  el('div', 'hud-game-sub', title, 'An open-world crime story — Rico Vega returns to the bay');
  const titleMenu = el('div', 'hud-menu', title);
  const btnNew = el('button', 'hud-btn', titleMenu, 'NEW GAME');
  const btnContinue = el('button', 'hud-btn', titleMenu, 'CONTINUE');
  const btnMissions = el('button', 'hud-btn', titleMenu, 'MISSIONS');
  el('div', 'hud-controls', title, 'WASD move · Mouse look · E enter car · F punch · Click shoot · 1-4 weapons · Shift sprint · Space handbrake · R radio · M mute · Esc pause');

  const pause = el('div', 'hud-screen hidden', root);
  pause.id = 'screen-pause';
  el('div', 'hud-game-title small', pause, 'PAUSED');
  const pauseMenu = el('div', 'hud-menu', pause);
  const btnResume = el('button', 'hud-btn', pauseMenu, 'RESUME');
  const btnSave = el('button', 'hud-btn', pauseMenu, 'SAVE GAME');
  const btnQuit = el('button', 'hud-btn', pauseMenu, 'QUIT TO TITLE');

  const missionScreen = el('div', 'hud-screen hidden', root);
  missionScreen.id = 'screen-missions';
  el('div', 'hud-game-title small', missionScreen, 'MISSIONS');
  const missionListEl = el('div', 'hud-mission-list', missionScreen);
  const btnMissionBack = el('button', 'hud-btn', missionScreen, 'BACK');

  const busted = el('div', 'hud-screen hidden', root);
  busted.id = 'screen-busted';
  el('div', 'hud-game-title small', busted, 'BUSTED');
  el('div', 'hud-game-sub', busted, 'The SBPD caught you. $200 bail, and the heat is off — for now.');
  const bustedMenu = el('div', 'hud-menu', busted);
  const btnBusted = el('button', 'hud-btn', bustedMenu, 'BACK TO THE BAY');

  const ctx = minimap.getContext('2d');
  let toastTimer = 0;
  let lastCash = -1;
  let lastRespect = -1;
  let lastHealth = -1;
  let lastArmor = -1;
  let lastStars = -1;
  let lastWeapon = -1;
  let lastObjective = '';
  let lastSpeed = -1;

  function showToast(text, seconds = 3) {
    toast.textContent = text;
    toast.classList.add('show');
    toastTimer = seconds;
  }

  function drawMinimap(state) {
    const p = state.player;
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    ctx.fillStyle = 'rgba(10, 18, 34, 0.85)';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    const scale = MAP_SIZE / MAP_RANGE;
    const toMap = (x, z) => [(x - p.x) * scale + MAP_SIZE / 2, (z - p.z) * scale + MAP_SIZE / 2];
    ctx.strokeStyle = '#5a6a7a';
    ctx.lineWidth = 4;
    for (const line of ROAD_LINES) {
      const [x1, y1] = toMap(line, -260);
      const [x2, y2] = toMap(line, 260);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const [x3, y3] = toMap(-260, line);
      const [x4, y4] = toMap(260, line);
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.stroke();
    }
    ctx.fillStyle = '#2a6a8a';
    ctx.fillRect(0, toMap(0, CITY.beachStart)[1], MAP_SIZE, MAP_SIZE);
    for (const marker of state.markers) {
      const [mx, my] = toMap(marker.x, marker.z);
      ctx.fillStyle = '#f7c81a';
      ctx.beginPath();
      ctx.arc(mx, my, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f7c81a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, 11 + Math.sin(state.time * 4) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const car of state.cars) {
      if (car.isPlayer) continue;
      const [cx, cy] = toMap(car.x, car.z);
      ctx.fillStyle = car.isPolice ? '#4a8aff' : '#e8e8e8';
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
    }
    if (state.heli) {
      const [hx, hy] = toMap(state.heli.x, state.heli.z);
      ctx.fillStyle = '#ff4a4a';
      ctx.beginPath();
      ctx.arc(hx, hy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    const [px, py] = toMap(p.x, p.z);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(px, py - 7);
    ctx.lineTo(px - 5, py + 5);
    ctx.lineTo(px + 5, py + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('N', 8, 14);
  }

  function update(state, screen, dt) {
    const p = state.player;
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toast.classList.remove('show');
    }
    if (p.cash !== lastCash) {
      lastCash = p.cash;
      cash.textContent = `$${p.cash.toLocaleString()}`;
    }
    if (p.respect !== lastRespect) {
      lastRespect = p.respect;
      respect.textContent = String(p.respect);
    }
    if (Math.round(p.health) !== lastHealth) {
      lastHealth = Math.round(p.health);
      healthFill.style.width = `${Math.max(0, p.health)}%`;
    }
    if (Math.round(p.armor) !== lastArmor) {
      lastArmor = Math.round(p.armor);
      armorFill.style.width = `${Math.max(0, p.armor)}%`;
    }
    const stars = Math.floor(p.wanted);
    if (stars !== lastStars) {
      lastStars = stars;
      starNodes.forEach((node, i) => {
        node.classList.toggle('lit', i < stars);
      });
    }
    if (p.weapon !== lastWeapon) {
      lastWeapon = p.weapon;
      weaponNodes.forEach((node, i) => {
        node.classList.toggle('active', i === p.weapon);
      });
    }
    const speedKmh = p.inCar ? Math.round(Math.abs(p.inCar.speed) * 3.6) : 0;
    if (speedKmh !== lastSpeed) {
      lastSpeed = speedKmh;
      speed.textContent = String(speedKmh);
    }
    const mission = currentMission(state);
    const obj = currentObjective(state);
    const objText = mission && obj ? `${mission.title} — ${obj.label}` : (state.mission.done.length >= MISSIONS.length ? 'All missions complete — free roam' : 'No mission active — press Q for missions');
    if (objText !== lastObjective) {
      lastObjective = objText;
      objectiveTitle.textContent = mission ? mission.title : 'SOLARA BAY';
      objectiveLabel.textContent = obj ? obj.label : objText;
    }
    radio.textContent = state.radioStationName || 'SOLARA FM — Sunset Groove';
    vignette.style.opacity = p.health < 40 ? String((40 - p.health) / 60) : '0';
    if (screen === SCREEN_PLAY) drawMinimap(state);
    title.classList.toggle('hidden', screen !== SCREEN_TITLE);
    pause.classList.toggle('hidden', screen !== SCREEN_PAUSED);
    missionScreen.classList.toggle('hidden', screen !== 'missions');
    busted.classList.toggle('hidden', screen !== SCREEN_BUSTED);
    root.classList.toggle('playing', screen === SCREEN_PLAY);
  }

  function renderMissionList(state, onStart) {
    missionListEl.innerHTML = '';
    for (const m of missionList(state)) {
      const row = document.createElement('div');
      row.className = `hud-mission-row${m.done ? ' done' : ''}${m.locked ? ' locked' : ''}`;
      const name = document.createElement('span');
      name.textContent = `${m.done ? '✓ ' : ''}${m.title} — $${m.payout}`;
      row.appendChild(name);
      const brief = document.createElement('div');
      brief.className = 'hud-mission-brief';
      brief.textContent = m.briefing;
      row.appendChild(brief);
      if (!m.locked && !m.done) {
        const btn = document.createElement('button');
        btn.className = 'hud-btn small';
        btn.textContent = 'START';
        btn.addEventListener('click', () => onStart(m));
        row.appendChild(btn);
      }
      missionListEl.appendChild(row);
    }
  }

  return {
    update,
    showToast,
    renderMissionList,
    buttons: { btnNew, btnContinue, btnMissions, btnResume, btnSave, btnQuit, btnMissionBack, btnBusted },
    setRadioName(name) {
      radio.textContent = name;
    },
  };
}
