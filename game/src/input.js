// Solmar Bay — input: keyboard state plus the mouse, read fresh every frame.
// Actions are edge-triggered (pressed this frame); movement is level-triggered.

export const ACTION_CONFIRM = 1 << 0; // Enter / Space / click to advance
export const ACTION_PAUSE = 1 << 1; // Esc or P
export const ACTION_ENTER_CAR = 1 << 2; // E
export const ACTION_INTERACT = 1 << 3; // E doubles as interact
export const ACTION_MUTE = 1 << 4; // M
export const ACTION_SAVE = 1 << 5; // F5 is the browser; use Q to quick-save
export const ACTION_MISSIONS = 1 << 6; // Tab shows the mission list

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let actions = 0;

  function keyName(event) {
    // Lowercase everything: 'Enter' -> 'enter', 'ArrowUp' -> 'arrowup',
    // 'Shift' -> 'shift', so the checks below never miss a key by case.
    return event.key.toLowerCase();
  }

  window.addEventListener('keydown', (event) => {
    const key = keyName(event);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(key)) event.preventDefault();
    if (!event.repeat) {
      pressed.add(key);
      if (key === 'enter' || key === ' ') actions |= ACTION_CONFIRM;
      if (key === 'escape' || key === 'p') actions |= ACTION_PAUSE;
      if (key === 'e') actions |= ACTION_ENTER_CAR | ACTION_INTERACT;
      if (key === 'm') actions |= ACTION_MUTE;
      if (key === 'q') actions |= ACTION_SAVE;
      if (key === 'tab') actions |= ACTION_MISSIONS;
    }
    keys.add(key);
  });
  window.addEventListener('keyup', (event) => keys.delete(keyName(event)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
      actions |= ACTION_CONFIRM;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** WASD/arrows as a -1..1 movement vector (x right, y down). */
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    /** Shift held: run on foot. */
    running() {
      return keys.has('shift');
    },
    /** Throttle 0..1 (W/up), brake 0..1 (S/down), steer -1..1 (A/D). */
    drive() {
      const throttle = keys.has('w') || keys.has('arrowup') ? 1 : 0;
      const brake = keys.has('s') || keys.has('arrowdown') ? 1 : 0;
      let steer = 0;
      if (keys.has('a') || keys.has('arrowleft')) steer -= 1;
      if (keys.has('d') || keys.has('arrowright')) steer += 1;
      return { throttle, brake, steer };
    },
    /** True while the left mouse button is held (firing). */
    firing() {
      return mouse.down;
    },
    /** True only on the frame the mouse was clicked. */
    mouseClicked() {
      return mouse.clicked;
    },
    mouse() {
      return mouse;
    },
    /** Edge-triggered actions since the last take; clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      mouse.clicked = false;
      return taken;
    },
    /** Which keys were pressed this frame (for menu shortcuts). */
    takePressed() {
      const taken = new Set(pressed);
      pressed.clear();
      return taken;
    },
  };
}
