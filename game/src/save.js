// Saving: the player's progress (missions done, cash, respect, stats and the mute
// setting) lives in localStorage under one key, so Continue on the title screen picks
// up where the last session left off. Storage can be off (private windows); then the
// save lasts this visit only and nothing breaks.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  const data = {
    cash: state.player.cash,
    respect: state.player.respect,
    missionsDone: state.mission.done.slice(),
    stats: { ...state.stats },
    muted: state.muted,
    savedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function applySave(state, data) {
  if (!data) return;
  if (typeof data.cash === 'number') state.player.cash = data.cash;
  if (typeof data.respect === 'number') state.player.respect = data.respect;
  if (Array.isArray(data.missionsDone)) state.mission.done = data.missionsDone.slice();
  if (data.stats && typeof data.stats === 'object') {
    Object.assign(state.stats, data.stats);
  }
  if (typeof data.muted === 'boolean') state.muted = data.muted;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
