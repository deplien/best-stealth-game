// The burglar: a small hooded figure who walks, crouches, and makes just enough noise to be
// heard. Movement is slower and near-silent while crouched, and suspicion grows far slower
// against a crouched figure in a beam — but standing steps carry, and a guard close enough
// will turn toward them.

/** Body radius, in logical pixels. */
export const PLAYER_RADIUS = 13;

/** Speeds: a purposeful walk, and the low creep of a crouch. */
const WALK_SPEED = 170;
const CROUCH_SPEED = 96;

/** How far the sound of a step carries: a creep barely leaves the burglar's shadow. */
const WALK_NOISE = 95;
const CROUCH_NOISE = 24;

import { slideMove } from './vision.js';

export function createPlayer(start) {
  return {
    x: start.x,
    y: start.y,
    r: PLAYER_RADIUS,
    facing: -Math.PI / 2,
    crouch: false,
    moving: false,
    noiseRadius: 0,
    stepTimer: 0,
  };
}

/**
 * Advance the burglar one step. `move` is the input direction (each axis -1, 0 or 1);
 * `crouch` whether a crouch key is held. Returns true when a footstep fell this step
 * (the caller plays its sound, spaced by the step timer here).
 */
export function updatePlayer(player, dt, move, crouch, solids) {
  player.crouch = crouch;
  const length = Math.hypot(move.x, move.y);
  player.moving = length > 0;
  if (player.moving) {
    const speed = crouch ? CROUCH_SPEED : WALK_SPEED;
    const dx = (move.x / length) * speed * dt;
    const dy = (move.y / length) * speed * dt;
    slideMove(player, dx, dy, player.r, solids);
    player.facing = Math.atan2(move.y, move.x);
    player.noiseRadius = crouch ? CROUCH_NOISE : WALK_NOISE;
    player.stepTimer -= dt;
    if (player.stepTimer <= 0) {
      player.stepTimer = crouch ? 0.46 : 0.33;
      return true;
    }
  } else {
    player.noiseRadius = 0;
    player.stepTimer = 0.12;
  }
  return false;
}
