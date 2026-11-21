// Geometry and eyesight: line of sight between two points, the raycast fan that shapes a
// flashlight's cone around cover, whether a guard can see the burglar, and the circle-versus-
// rectangle movement every body in the museum uses. Nothing here knows about the game state;
// it answers questions about points, angles and solid rectangles.

/** A flashlight cone's reach, in logical pixels, and its half-angle in radians (a 70° beam). */
export const CONE_RANGE = 235;
export const CONE_HALF_ANGLE = (35 * Math.PI) / 180;

/** How many rays fan across a cone when its polygon is built; more rays, smoother edges. */
const CONE_RAYS = 36;

/** The shortest distance along the segment (x0,y0)-(x1,y1) at which it meets a rect, or Infinity. */
function segmentRectDistance(x0, y0, x1, y1, rect) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let tMin = 0;
  let tMax = 1;
  // Slab test: clip the segment against the rectangle's x span, then its y span.
  if (Math.abs(dx) < 1e-9) {
    if (x0 < rect.x || x0 > rect.x + rect.w) return Infinity;
  } else {
    let t1 = (rect.x - x0) / dx;
    let t2 = (rect.x + rect.w - x0) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return Infinity;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y0 < rect.y || y0 > rect.y + rect.h) return Infinity;
  } else {
    let t1 = (rect.y - y0) / dy;
    let t2 = (rect.y + rect.h - y0) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return Infinity;
  }
  return tMin * Math.hypot(dx, dy);
}

/** True when nothing solid stands between two points. */
export function hasLineOfSight(x0, y0, x1, y1, solids) {
  const length = Math.hypot(x1 - x0, y1 - y0);
  for (let index = 0; index < solids.length; index += 1) {
    const hit = segmentRectDistance(x0, y0, x1, y1, solids[index]);
    if (hit < length - 0.5) return false;
  }
  return true;
}

/** How far a ray travels from (x, y) along `angle` before it meets something solid. */
export function raycastDistance(x, y, angle, maxDistance, solids) {
  const x1 = x + Math.cos(angle) * maxDistance;
  const y1 = y + Math.sin(angle) * maxDistance;
  let best = maxDistance;
  for (let index = 0; index < solids.length; index += 1) {
    const hit = segmentRectDistance(x, y, x1, y1, solids[index]);
    if (hit < best) best = hit;
  }
  return best;
}

/**
 * The polygon of a flashlight cone: the guard's position plus the endpoints of a fan of rays
 * across the beam, each stopped by the first solid it meets, with extra rays aimed at nearby
 * cover corners so the beam's edges hug the cases instead of leaking past them.
 */
export function buildVisionConePolygon(x, y, facing, solids) {
  const angles = [];
  for (let index = 0; index <= CONE_RAYS; index += 1) {
    angles.push(facing - CONE_HALF_ANGLE + (2 * CONE_HALF_ANGLE * index) / CONE_RAYS);
  }
  for (let index = 0; index < solids.length; index += 1) {
    const rect = solids[index];
    const corners = [
      [rect.x, rect.y],
      [rect.x + rect.w, rect.y],
      [rect.x, rect.y + rect.h],
      [rect.x + rect.w, rect.y + rect.h],
    ];
    for (const [cx, cy] of corners) {
      const dist = Math.hypot(cx - x, cy - y);
      if (dist > CONE_RANGE + 40 || dist < 1) continue;
      const angle = Math.atan2(cy - y, cx - x);
      let diff = angle - facing;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      // Push the corner's angle on the fan's own branch of the circle (facing ± the
      // difference), never the raw atan2 value: a corner just past the ±π seam would
      // otherwise sort to the fan's far end and stretch the polygon across the hall.
      if (Math.abs(diff) < CONE_HALF_ANGLE + 0.05) angles.push(facing + diff - 0.004, facing + diff + 0.004);
    }
  }
  angles.sort((a, b) => a - b);
  const points = [{ x, y }];
  for (const angle of angles) {
    const dist = raycastDistance(x, y, angle, CONE_RANGE, solids);
    points.push({ x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist });
  }
  return points;
}

/**
 * Whether a guard sees the player: inside the beam's reach and angle, with a clear line of
 * sight. Returns how close the player is to the beam's heart (1 at the guard's feet, 0 at the
 * rim), which the guard turns into how fast suspicion grows.
 */
export function sensePlayer(guard, player, solids) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > CONE_RANGE) return { seen: false, closeness: 0 };
  let diff = Math.atan2(dy, dx) - guard.facing;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > CONE_HALF_ANGLE) return { seen: false, closeness: 0 };
  if (!hasLineOfSight(guard.x, guard.y, player.x, player.y, solids)) return { seen: false, closeness: 0 };
  return { seen: true, closeness: 1 - dist / CONE_RANGE };
}

/** True when a circle overlaps any solid rectangle. */
export function circleCollides(cx, cy, radius, solids) {
  for (let index = 0; index < solids.length; index += 1) {
    const rect = solids[index];
    const nearX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
    const nearY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
    if (Math.hypot(cx - nearX, cy - nearY) < radius) return true;
  }
  return false;
}

/**
 * Move a circle by (dx, dy), one axis at a time, so it slides along the cover it bumps into
 * instead of sticking to it. Mutates and returns the body.
 */
export function slideMove(body, dx, dy, radius, solids) {
  if (dx !== 0) {
    const nextX = body.x + dx;
    if (!circleCollides(nextX, body.y, radius, solids)) body.x = nextX;
  }
  if (dy !== 0) {
    const nextY = body.y + dy;
    if (!circleCollides(body.x, nextY, radius, solids)) body.y = nextY;
  }
  return body;
}
