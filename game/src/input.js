// Keyboard and mouse input. Held keys are read every frame; one-shot presses (enter
// car, punch, weapon switch, pause, radio, mute) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost and never counted twice.
// Mouse movement steers the third-person camera through pointer lock on the canvas.
export const ACT_ENTER = 1;
export const ACT_PUNCH = 2;
export const ACT_PAUSE = 4;
export const ACT_RADIO = 8;
export const ACT_MUTE = 16;
export const ACT_MISSION = 32;
export const ACT_CONFIRM = 64;

const PRESS = {
  KeyE: ACT_ENTER,
  KeyF: ACT_PUNCH,
  Escape: ACT_PAUSE,
  KeyP: ACT_PAUSE,
  KeyR: ACT_RADIO,
  KeyM: ACT_MUTE,
  KeyQ: ACT_MISSION,
  Space: ACT_CONFIRM,
  Enter: ACT_CONFIRM,
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let locked = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    const flag = PRESS[event.code];
    if (flag !== undefined) actions |= flag;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (event) => {
    if (!locked) return;
    mouseDX += event.movementX || 0;
    mouseDY += event.movementY || 0;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) mouseDown = true;
    if (!locked && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });

  return {
    held(code) {
      return keys.has(code);
    },
    moveX() {
      return mouseDX;
    },
    moveY() {
      return mouseDY;
    },
    firing() {
      return mouseDown;
    },
    takeMouse() {
      const dx = mouseDX;
      const dy = mouseDY;
      mouseDX = 0;
      mouseDY = 0;
      return { dx, dy };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
