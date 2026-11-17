// Keyboard + mouse for SOLARA HEAT. WASD/arrows move and drive, the mouse
// aims, click fires the pistol, E steals/enters a car, F punches, Shift
// sprints, P or Escape pauses, M mutes, R restarts after a bust, Enter
// confirms on menus. Edge-triggered actions are consumed with takeActions().

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;
export const ACTION_ENTER = 16;
export const ACTION_PUNCH = 32;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyR: ACTION_RESTART,
  KeyM: ACTION_MUTE,
  KeyE: ACTION_ENTER,
  KeyF: ACTION_PUNCH,
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let hasMouse = false;

  function keyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    const action = KEY_ACTIONS[e.code];
    if (action) actions |= action;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  }

  function keyUp(e) {
    keys.delete(e.code);
  }

  function mouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    mouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;
    hasMouse = true;
  }

  function mouseDownFn(e) {
    mouseMove(e);
    mouseDown = true;
    mouseClicked = true;
    actions |= ACTION_CONFIRM;
  }

  function mouseUpFn() {
    mouseDown = false;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mousedown', mouseDownFn);
  window.addEventListener('mouseup', mouseUpFn);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    /** Movement axis, -1..1 on each axis, from keys. */
    axis() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    get sprint() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    get firing() {
      return mouseDown;
    },
    /** True once per click; consumed by takeClick(). */
    takeClick() {
      const c = mouseClicked;
      mouseClicked = false;
      return c;
    },
    /** Edge-triggered actions since the last call. */
    takeActions() {
      const a = actions;
      actions = 0;
      return a;
    },
    get hasMouse() {
      return hasMouse;
    },
    get mouseX() {
      return mouseX;
    },
    get mouseY() {
      return mouseY;
    },
  };
}
