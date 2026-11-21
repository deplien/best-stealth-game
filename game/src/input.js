// Keyboard and mouse input. Held keys give a movement direction and whether the burglar is
// crouched; one-shot presses (confirm, retry, pause) are queued as bit flags and taken once
// by the loop; mouse clicks are remembered in client coordinates for the loop to turn into
// coin throws, so a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_RETRY = 2;
export const ACTION_PAUSE = 4;

const CONFIRM = new Set(['Enter', 'Space']);
const RETRY = new Set(['KeyR']);
const PAUSE = new Set(['KeyP', 'Escape']);
const CROUCH = new Set(['ShiftLeft', 'ShiftRight', 'KeyC']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let click = null;

  window.addEventListener('keydown', (event) => {
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (RETRY.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RETRY;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    }
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur,
  // and drop any queued click too — it belongs to a moment the player no longer remembers.
  window.addEventListener('blur', () => {
    held.clear();
    click = null;
  });
  target.addEventListener('pointerdown', (event) => {
    click = { clientX: event.clientX, clientY: event.clientY };
  });

  return {
    /** The held movement keys as a direction: each axis -1, 0 or 1 (not normalised). */
    axis() {
      const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    /** True while a crouch key (Shift or C) is held down. */
    crouchHeld() {
      for (const code of CROUCH) if (held.has(code)) return true;
      return false;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The last click's client coordinates, or null; taking it clears it. */
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
  };
}
