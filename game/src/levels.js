// The three museum halls of The Night Vault: where the walls, display cases, crates, lamps,
// guards, diamond and exit of each hall are. Everything is placed in the game's one logical
// space, 1280x800, with the HUD bar across the top 56 pixels and the hall below it. Patrol
// waypoints sit in the open lanes between the cases, so a guard's round can be learned by
// watching it once — patience, not luck, is the way through.

/** The one logical space every file shares: width, height, and the HUD bar's height. */
export const VIEW = { width: 1280, height: 800, hudHeight: 56 };

/** Wall thickness of every hall's border, in logical pixels. */
const WALL = 24;

/**
 * The border walls of a hall, with a gap cut where the exit door is. `exit` is the gap's
 * rectangle inside the wall itself; the two wall pieces on either side of it stay solid.
 */
export function borderSolids(exit) {
  const top = VIEW.hudHeight;
  const solids = [];
  if (exit.side === 'right') {
    solids.push({ x: 0, y: top, w: VIEW.width, h: WALL }); // top wall, whole
    solids.push({ x: 0, y: VIEW.height - WALL, w: VIEW.width, h: WALL }); // bottom wall, whole
    solids.push({ x: 0, y: top, w: WALL, h: VIEW.height - top }); // left wall, whole
    solids.push({ x: VIEW.width - WALL, y: top, w: WALL, h: exit.y - top }); // right, above door
    solids.push({ x: VIEW.width - WALL, y: exit.y + exit.h, w: WALL, h: VIEW.height - (exit.y + exit.h) }); // right, below
  } else if (exit.side === 'top') {
    solids.push({ x: 0, y: top, w: exit.x, h: WALL }); // top wall, left of door
    solids.push({ x: exit.x + exit.w, y: top, w: VIEW.width - (exit.x + exit.w), h: WALL }); // top, right of door
    solids.push({ x: 0, y: VIEW.height - WALL, w: VIEW.width, h: WALL });
    solids.push({ x: 0, y: top, w: WALL, h: VIEW.height - top });
    solids.push({ x: VIEW.width - WALL, y: top, w: WALL, h: VIEW.height - top });
  } else {
    // side === 'bottom'
    solids.push({ x: 0, y: top, w: VIEW.width, h: WALL });
    solids.push({ x: 0, y: VIEW.height - WALL, w: exit.x, h: WALL }); // bottom wall, left of door
    solids.push({ x: exit.x + exit.w, y: VIEW.height - WALL, w: VIEW.width - (exit.x + exit.w), h: WALL }); // bottom, right
    solids.push({ x: 0, y: top, w: WALL, h: VIEW.height - top });
    solids.push({ x: VIEW.width - WALL, y: top, w: WALL, h: VIEW.height - top });
  }
  return solids;
}

/** Every solid a body or a light ray can hit in a hall: border, cases, crates and the pedestal. */
export function hallSolids(level) {
  return [...borderSolids(level.exit), ...level.cases, ...level.crates, level.pedestal];
}

export const LEVELS = [
  {
    name: 'Hall One',
    sub: 'The Marble Hall',
    playerStart: { x: 92, y: 712 },
    diamond: { x: 640, y: 326 },
    pedestal: { x: 622, y: 308, w: 36, h: 36 },
    exit: { side: 'right', x: 1256, y: 352, w: 24, h: 72 },
    cases: [
      { x: 170, y: 170, w: 210, h: 62 },
      { x: 535, y: 170, w: 210, h: 62 },
      { x: 900, y: 170, w: 210, h: 62 },
      { x: 170, y: 430, w: 210, h: 62 },
      { x: 535, y: 430, w: 210, h: 62 },
      { x: 900, y: 430, w: 210, h: 62 },
    ],
    crates: [
      { x: 330, y: 610, w: 70, h: 70 },
      { x: 880, y: 610, w: 70, h: 70 },
    ],
    lamps: [
      { x: 320, y: 326, r: 180 },
      { x: 960, y: 326, r: 180 },
      { x: 640, y: 150, r: 160 },
      { x: 640, y: 650, r: 175 },
      { x: 1150, y: 388, r: 130 },
    ],
    guards: [
      {
        speed: 80,
        path: [
          { x: 120, y: 128, pause: 1.1 },
          { x: 1170, y: 128, pause: 1.1 },
          { x: 1170, y: 270, pause: 0.8 },
          { x: 120, y: 270, pause: 0.8 },
        ],
      },
      {
        speed: 74,
        path: [
          { x: 120, y: 560, pause: 1.0 },
          { x: 1170, y: 560, pause: 1.0 },
          { x: 1170, y: 712, pause: 1.2 },
          { x: 120, y: 712, pause: 1.2 },
        ],
      },
    ],
    coins: 3,
  },
  {
    name: 'Hall Two',
    sub: 'The Sculpture Wing',
    playerStart: { x: 92, y: 712 },
    diamond: { x: 318, y: 326 },
    pedestal: { x: 300, y: 308, w: 36, h: 36 },
    exit: { side: 'top', x: 1064, y: 56, w: 72, h: 24 },
    cases: [
      { x: 150, y: 160, w: 64, h: 150 },
      { x: 420, y: 160, w: 240, h: 62 },
      { x: 820, y: 160, w: 64, h: 150 },
      { x: 960, y: 160, w: 180, h: 62 },
      { x: 150, y: 470, w: 240, h: 62 },
      { x: 560, y: 430, w: 64, h: 210 },
      { x: 900, y: 470, w: 240, h: 62 },
    ],
    crates: [
      { x: 330, y: 640, w: 70, h: 70 },
      { x: 1010, y: 620, w: 70, h: 70 },
    ],
    lamps: [
      { x: 640, y: 326, r: 180 },
      { x: 1000, y: 600, r: 165 },
      { x: 250, y: 600, r: 165 },
    ],
    guards: [
      {
        speed: 82,
        path: [
          { x: 420, y: 120, pause: 1.0 },
          { x: 1170, y: 120, pause: 1.0 },
          { x: 1170, y: 340, pause: 0.9 },
          { x: 420, y: 340, pause: 0.9 },
        ],
      },
      {
        speed: 76,
        path: [
          { x: 120, y: 420, pause: 1.1 },
          { x: 480, y: 420, pause: 0.7 },
          { x: 480, y: 712, pause: 1.1 },
          { x: 120, y: 712, pause: 1.1 },
        ],
      },
      {
        speed: 86,
        path: [
          { x: 700, y: 560, pause: 0.8 },
          { x: 1170, y: 560, pause: 1.0 },
          { x: 1170, y: 712, pause: 0.8 },
          { x: 700, y: 712, pause: 1.0 },
        ],
      },
    ],
    coins: 3,
  },
  {
    name: 'Hall Three',
    sub: 'The Vault Gallery',
    playerStart: { x: 92, y: 122 },
    diamond: { x: 640, y: 400 },
    pedestal: { x: 622, y: 382, w: 36, h: 36 },
    exit: { side: 'bottom', x: 1130, y: 776, w: 72, h: 24 },
    cases: [
      { x: 170, y: 160, w: 200, h: 62 },
      { x: 540, y: 160, w: 200, h: 62 },
      { x: 910, y: 160, w: 200, h: 62 },
      { x: 330, y: 330, w: 62, h: 180 },
      { x: 890, y: 330, w: 62, h: 180 },
      { x: 170, y: 580, w: 200, h: 62 },
      { x: 540, y: 580, w: 200, h: 62 },
      { x: 910, y: 580, w: 200, h: 62 },
    ],
    crates: [
      { x: 120, y: 340, w: 64, h: 64 },
      { x: 1096, y: 340, w: 64, h: 64 },
    ],
    lamps: [
      { x: 320, y: 400, r: 175 },
      { x: 960, y: 400, r: 175 },
      { x: 640, y: 640, r: 170 },
      { x: 640, y: 140, r: 160 },
    ],
    guards: [
      {
        speed: 84,
        path: [
          { x: 120, y: 120, pause: 1.0 },
          { x: 1170, y: 120, pause: 1.0 },
          { x: 1170, y: 270, pause: 0.8 },
          { x: 120, y: 270, pause: 0.8 },
        ],
      },
      {
        speed: 78,
        path: [
          { x: 440, y: 420, pause: 0.9 },
          { x: 440, y: 712, pause: 1.1 },
          { x: 120, y: 712, pause: 0.9 },
          { x: 120, y: 420, pause: 1.1 },
        ],
      },
      {
        speed: 78,
        path: [
          { x: 840, y: 420, pause: 0.9 },
          { x: 840, y: 712, pause: 1.1 },
          { x: 1170, y: 712, pause: 0.9 },
          { x: 1170, y: 420, pause: 1.1 },
        ],
      },
      {
        speed: 92,
        pingpong: true,
        path: [
          { x: 440, y: 540, pause: 0.7 },
          { x: 840, y: 540, pause: 0.7 },
        ],
      },
    ],
    coins: 4,
  },
];
