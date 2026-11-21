// The museum guards: each walks a patrol of waypoints with pauses, carries the flashlight
// whose cone vision.js shapes, and thinks in four states — patrol, stare (something caught
// the eye), investigate (a coin's ping, a step too loud) and pursue (the burglar, glimpsed
// clearly, is followed to the last place she was seen). Awareness fills while the burglar is
// in the beam and drains when she is gone, so a near miss can still be recovered from.

import { buildVisionConePolygon, hasLineOfSight, slideMove } from './vision.js';

/** Body radius, in logical pixels. */
export const GUARD_RADIUS = 14;

/** Awareness at which a guard stops and stares, and at which he gives chase. */
const SUSPICIOUS_AT = 0.35;
const PURSUE_AT = 0.62;

/** How fast awareness drains once the beam has lost the burglar, after a short grace. */
const DRAIN_RATE = 0.26;
const DRAIN_GRACE = 0.7;

const INVESTIGATE_SPEED = 102;
const PURSUE_SPEED = 121;

export function createGuard(definition) {
  const first = definition.path[0];
  const second = definition.path[1] ?? first;
  return {
    x: first.x,
    y: first.y,
    r: GUARD_RADIUS,
    facing: Math.atan2(second.y - first.y, second.x - first.x),
    speed: definition.speed,
    path: definition.path,
    pingpong: Boolean(definition.pingpong),
    wpIndex: 1,
    wpDir: 1,
    pauseLeft: 0,
    state: 'patrol',
    awareness: 0,
    unseenFor: 0,
    target: null,
    lookLeft: 0,
    lookBase: 0,
    lastSeen: null,
    countedSuspicion: false,
    moving: false,
    stepTimer: Math.random() * 0.3,
    cone: [],
  };
}

/** Turn a guard's facing toward an angle, no faster than `rate` radians a second. */
function turnToward(guard, angle, rate, dt) {
  let diff = angle - guard.facing;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const maxTurn = rate * dt;
  guard.facing += Math.max(-maxTurn, Math.min(maxTurn, diff));
  return Math.abs(diff) < 0.05;
}

/** Walk toward a point at a speed; true when close enough to call it arrived. */
function walkToward(guard, point, speed, dt, solids) {
  const dx = point.x - guard.x;
  const dy = point.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 5) {
    guard.moving = false;
    return true;
  }
  turnToward(guard, Math.atan2(dy, dx), 3.4, dt);
  const step = Math.min(dist, speed * dt);
  slideMove(guard, (dx / dist) * step, (dy / dist) * step, guard.r, solids);
  guard.moving = true;
  return dist < 9;
}

/** Send the guard back to his round: aim at the nearest waypoint he can see his way to. */
function returnToPatrol(guard, solids) {
  let bestIndex = guard.wpIndex;
  let bestDist = Infinity;
  for (let index = 0; index < guard.path.length; index += 1) {
    const wp = guard.path[index];
    const dist = Math.hypot(wp.x - guard.x, wp.y - guard.y);
    if (dist < bestDist && hasLineOfSight(guard.x, guard.y, wp.x, wp.y, solids)) {
      bestDist = dist;
      bestIndex = index;
    }
  }
  guard.wpIndex = bestIndex;
  guard.state = 'patrol';
  guard.target = null;
}

/**
 * Something made a sound at (x, y) — a coin's ping carries far, a footstep only just.
 * Unless the guard is already chasing, he goes to look.
 */
export function hearNoise(guard, x, y) {
  if (guard.state === 'pursue') return;
  guard.state = 'investigate';
  guard.target = { x, y };
  guard.lookLeft = 0;
  if (guard.awareness < SUSPICIOUS_AT) guard.awareness = SUSPICIOUS_AT;
}

/**
 * Advance one guard. `sense` is vision.js's verdict on the burglar this step (or null when
 * there is no burglar to sense, as on the title screen). Returns event flags for the caller:
 * becameSuspicious (crossed the stare threshold) and caught (awareness reached full).
 */
export function updateGuard(guard, dt, solids, player, sense) {
  const events = { becameSuspicious: false, caught: false };
  guard.moving = false;

  // Awareness: fill in the beam, drain out of it.
  if (sense && sense.seen) {
    const posture = player.crouch ? 0.45 : 1;
    guard.awareness += (0.55 + 0.85 * sense.closeness) * posture * dt;
    guard.unseenFor = 0;
    guard.lastSeen = { x: player.x, y: player.y };
    if (guard.awareness >= SUSPICIOUS_AT && !guard.countedSuspicion) {
      guard.countedSuspicion = true;
      events.becameSuspicious = true;
    }
    if (guard.awareness >= 1) {
      guard.awareness = 1;
      events.caught = true;
    }
  } else {
    guard.unseenFor += dt;
    if (guard.unseenFor > DRAIN_GRACE && guard.awareness > 0) {
      guard.awareness = Math.max(0, guard.awareness - DRAIN_RATE * dt);
      if (guard.awareness < 0.12) guard.countedSuspicion = false;
    }
  }
  const aware = guard.awareness;

  if (sense && sense.seen && aware >= PURSUE_AT && guard.lastSeen) {
    guard.state = 'pursue';
    if (walkToward(guard, guard.lastSeen, PURSUE_SPEED, dt, solids)) {
      turnToward(guard, Math.atan2(player.y - guard.y, player.x - guard.x), 2.2, dt);
    }
  } else if (sense && sense.seen && aware >= SUSPICIOUS_AT) {
    guard.state = 'stare';
    turnToward(guard, Math.atan2(player.y - guard.y, player.x - guard.x), 3.2, dt);
  } else if (guard.state === 'stare' || guard.state === 'pursue') {
    // The beam is empty again: go and look where she was, then settle back to the round.
    if (guard.lastSeen && aware > 0.15) {
      guard.state = 'investigate';
      guard.target = guard.lastSeen;
      guard.lookLeft = 0;
    } else {
      returnToPatrol(guard, solids);
    }
  }

  if (guard.state === 'investigate' && guard.target) {
    if (guard.lookLeft > 0) {
      guard.lookLeft -= dt;
      turnToward(guard, guard.lookBase + Math.sin((1.1 - guard.lookLeft) * 4.2) * 0.7, 2.4, dt);
      if (guard.lookLeft <= 0) returnToPatrol(guard, solids);
    } else if (walkToward(guard, guard.target, INVESTIGATE_SPEED, dt, solids)) {
      guard.lookLeft = 1.1;
      guard.lookBase = guard.facing;
    }
  } else if (guard.state === 'patrol') {
    const wp = guard.path[guard.wpIndex];
    if (guard.pauseLeft > 0) {
      guard.pauseLeft -= dt;
      // While paused, turn gently toward the next leg of the round.
      const next = guard.path[(guard.wpIndex + guard.wpDir + guard.path.length) % guard.path.length];
      turnToward(guard, Math.atan2(next.y - guard.y, next.x - guard.x), 1.5, dt);
    } else if (walkToward(guard, wp, guard.speed, dt, solids)) {
      guard.pauseLeft = wp.pause ?? 0.9;
      if (guard.pingpong) {
        if (guard.wpIndex === guard.path.length - 1) guard.wpDir = -1;
        else if (guard.wpIndex === 0) guard.wpDir = 1;
        guard.wpIndex += guard.wpDir;
      } else {
        guard.wpIndex = (guard.wpIndex + 1) % guard.path.length;
      }
    }
  }

  guard.cone = buildVisionConePolygon(guard.x, guard.y, guard.facing, solids);
  return events;
}

/** The word for a guard's state of mind, for the HUD's alarm lamp and the cone's colour. */
export function guardMood(guard) {
  if (guard.awareness >= 0.75 || guard.state === 'pursue') return 'alert';
  if (guard.awareness >= SUSPICIOUS_AT) return 'suspicious';
  return 'calm';
}
