// The Night Vault: boot and the one loop. The burglar is read from the keys every frame, the
// museum advances in fixed 1/60 s steps, and the renderer paints what is there. Screens:
// title, play, paused, caught, level complete and heist complete.
//
// ?shot=start|play|alert|end (with &seed=N) stages a fixed scene instead of running the loop,
// paints it twice and sets window.__shotReady for a screenshot — the same convention as the
// kit's starter, with the scenes set by hand below so every capture shows the game's real
// pieces: cones, cover, guards, the diamond and the door.
import { LEVELS, VIEW, borderSolids, hallSolids } from './levels.js';
import { circleCollides, buildVisionConePolygon, sensePlayer } from './vision.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RETRY, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayer } from './player.js';
import { createGuard, guardMood, hearNoise, updateGuard } from './guard.js';
import { createRenderer } from './render.js';

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
const STEP = 1 / 60;
/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;
/** How far a thrown coin can fly, and how far its ping carries to a guard's ear. */
const COIN_THROW_RANGE = 280;
const COIN_PING_RADIUS = 300;
/** How close to the pedestal the burglar must come to lift the diamond. */
const STEAL_RADIUS = 46;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

/** A fresh run of one hall: bodies placed, cones unbuilt, the diamond on its pedestal. */
function loadLevel(index) {
  const level = LEVELS[index];
  return {
    screen: 'play',
    levelIndex: index,
    level,
    walls: borderSolids(level.exit),
    solids: hallSolids(level),
    guards: level.guards.map((definition) => createGuard(definition)),
    player: createPlayer(level.playerStart),
    coinsThrown: [],
    coinsLeft: level.coins,
    hasDiamond: false,
    detection: 0,
    maxMood: 'calm',
    spotted: 0,
    time: 0,
    timeNow: 0,
    totals: { time: 0, spotted: 0, coinsLeft: 0 },
  };
}

/** The rectangle of floor inside the exit door's gap: stepping into it ends the hall. */
function exitZone(level) {
  const exit = level.exit;
  if (exit.side === 'right') return { x: exit.x - 16, y: exit.y, w: exit.w + 16, h: exit.h };
  if (exit.side === 'top') return { x: exit.x, y: exit.y - 6, w: exit.w, h: exit.h + 22 };
  return { x: exit.x, y: exit.y - 16, w: exit.w, h: exit.h + 16 };
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

/** Throw a coin toward a logical point: it flies until a wall or its range stops it. */
function throwCoin(state, target) {
  if (state.coinsLeft <= 0) return;
  const player = state.player;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 12) return;
  const reach = Math.min(dist, COIN_THROW_RANGE);
  let land = { x: player.x + (dx / dist) * reach, y: player.y + (dy / dist) * reach };
  // Walk the flight path in small steps; the coin lands at the last free spot.
  const steps = Math.ceil(reach / 6);
  for (let index = 1; index <= steps; index += 1) {
    const point = { x: player.x + (dx / dist) * ((reach * index) / steps), y: player.y + (dy / dist) * ((reach * index) / steps) };
    if (circleCollides(point.x, point.y, 7, state.solids)) break;
    land = point;
  }
  state.coinsThrown.push(land);
  state.coinsLeft -= 1;
  audio.playCoinPing();
  for (const guard of state.guards) {
    if (Math.hypot(guard.x - land.x, guard.y - land.y) < COIN_PING_RADIUS) hearNoise(guard, land.x, land.y);
  }
}

/** Advance the museum one fixed step while the burglar is at work. */
function stepPlay(state, input, dt) {
  state.time += dt;
  const player = state.player;

  const click = input.takeClick();
  if (click) {
    const point = renderer.toLogical(click.clientX, click.clientY);
    throwCoin(state, point);
  }

  const stepped = updatePlayer(player, dt, input.axis(), input.crouchHeld(), state.solids);
  if (stepped) audio.playPlayerFootstep(player.crouch);
  // The burglar stays inside the museum: the exit gaps are doorways, not escapes from the world.
  player.x = Math.max(player.r, Math.min(VIEW.width - player.r, player.x));
  player.y = Math.max(VIEW.hudHeight + player.r, Math.min(VIEW.height - player.r, player.y));

  // Loud steps turn nearby heads.
  if (player.moving && player.noiseRadius > 30) {
    for (const guard of state.guards) {
      const dist = Math.hypot(guard.x - player.x, guard.y - player.y);
      if (dist < player.noiseRadius + guard.r) hearNoise(guard, player.x, player.y);
    }
  }

  // The diamond, lifted quietly.
  if (!state.hasDiamond) {
    const gem = state.level.diamond;
    if (Math.hypot(player.x - gem.x, player.y - gem.y) < STEAL_RADIUS) {
      state.hasDiamond = true;
      audio.playGemChime();
      announce('Diamond stolen. Reach the exit unseen.');
    }
  }

  let caught = false;
  let detection = 0;
  let maxMood = 'calm';
  for (const guard of state.guards) {
    const sense = sensePlayer(guard, player, state.solids);
    const events = updateGuard(guard, dt, state.solids, player, sense);
    if (events.becameSuspicious) {
      state.spotted += 1;
      audio.playSuspicionSting();
    }
    if (events.caught) caught = true;
    detection = Math.max(detection, guard.awareness);
    const mood = guardMood(guard);
    if (mood === 'alert') maxMood = 'alert';
    else if (mood === 'suspicious' && maxMood === 'calm') maxMood = 'suspicious';
  }
  state.detection = detection;
  state.maxMood = maxMood;
  audio.playGuardFootstepsPannedByDistance(state.guards, player, dt);

  if (caught) {
    state.screen = 'caught';
    audio.playAlarm();
    announce('Caught. Press R to try the hall again.');
    return;
  }

  if (state.hasDiamond && pointInRect(player.x, player.y, exitZone(state.level))) {
    state.totals.time += state.time;
    state.totals.spotted += state.spotted;
    state.totals.coinsLeft += state.coinsLeft;
    audio.playExitChime();
    if (state.levelIndex === LEVELS.length - 1) {
      state.screen = 'heistComplete';
      announce('Heist complete. The Star Diamond is yours.');
    } else {
      state.screen = 'levelComplete';
      announce('Hall cleared. Press Enter for the next hall.');
    }
  }
}

/** Patrol-only advance for the title backdrop: guards walk their rounds, sensing no one. */
function stepBackdrop(state, dt) {
  for (const guard of state.guards) updateGuard(guard, dt, state.solids, state.player, null);
}

function announce(message) {
  status.textContent = message;
}

/** Set a guard's pose by hand for a screenshot scene. */
function poseGuard(guard, x, y, facing, awareness, state) {
  guard.x = x;
  guard.y = y;
  guard.facing = facing;
  guard.awareness = awareness;
  guard.state = state;
  guard.cone = [];
}

/**
 * Stage one of the four screenshot scenes on a fresh state. Guards are walked forward a few
 * seconds or posed outright; the burglar is placed mid-story. Same seed, same frame.
 */
function stageShot(name) {
  if (name === 'play') {
    const state = loadLevel(0);
    // The near guard sweeps the middle lane, his beam raking the case she hides behind.
    poseGuard(state.guards[0], 700, 270, Math.PI * 0.94, 0.1, 'patrol');
    // The far guard has heard her coin and gone to look, suspicion up, beam orange.
    poseGuard(state.guards[1], 250, 712, 0, 0.5, 'investigate');
    state.guards[1].target = { x: 430, y: 700 };
    state.coinsThrown.push({ x: 430, y: 700 });
    state.coinsLeft = 2;
    state.player.x = 640;
    state.player.y = 514;
    state.player.crouch = true;
    state.player.facing = -Math.PI / 2;
    state.detection = 0.5;
    state.maxMood = 'suspicious';
    state.time = 47;
    for (const guard of state.guards) guard.cone = buildVisionConePolygon(guard.x, guard.y, guard.facing, state.solids);
    return state;
  }
  if (name === 'alert') {
    const state = loadLevel(0);
    // Caught mid-dash below a case, the gem already in her pocket, the beam full on her.
    state.player.x = 400;
    state.player.y = 505;
    state.player.facing = Math.PI * 0.85;
    poseGuard(state.guards[0], 520, 545, Math.atan2(505 - 545, 400 - 520), 0.9, 'pursue');
    poseGuard(state.guards[1], 1080, 560, Math.PI, 0.2, 'patrol');
    state.hasDiamond = true;
    state.detection = 0.9;
    state.maxMood = 'alert';
    state.spotted = 1;
    state.time = 83;
    for (const guard of state.guards) guard.cone = buildVisionConePolygon(guard.x, guard.y, guard.facing, state.solids);
    return state;
  }
  if (name === 'end') {
    const state = loadLevel(2);
    for (let index = 0; index < 3 * 60; index += 1) stepBackdrop(state, STEP);
    state.hasDiamond = true;
    state.totals = { time: 214, spotted: 3, coinsLeft: 1 };
    state.screen = 'heistComplete';
    return state;
  }
  // start: the title over a living first hall.
  const state = loadLevel(0);
  for (let index = 0; index < 3.5 * 60; index += 1) stepBackdrop(state, STEP);
  state.screen = 'title';
  return state;
}

function runShot(name) {
  const state = stageShot(name);
  state.timeNow = 1.25;
  let painted = 0;
  function paint() {
    renderer.draw(state);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let state = loadLevel(0);
  state.screen = 'title';
  let accumulator = 0;
  let last = performance.now();

  function startRun() {
    const fresh = loadLevel(0);
    fresh.screen = 'play';
    state = fresh;
    announce('Hall One. Steal the Star Diamond, then reach the exit unseen.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_PAUSE) {
      if (state.screen === 'play') {
        state.screen = 'paused';
        announce('Paused.');
      } else if (state.screen === 'paused') {
        state.screen = 'play';
        announce('Playing.');
      }
    }
    if (actions & ACTION_CONFIRM) {
      if (state.screen === 'title' || state.screen === 'heistComplete') startRun();
      else if (state.screen === 'levelComplete') {
        const next = loadLevel(state.levelIndex + 1);
        next.totals = state.totals;
        next.screen = 'play';
        state = next;
        announce(`${state.level.name}. Steal the Star Diamond, then reach the exit unseen.`);
      }
    }
    if (actions & ACTION_RETRY && state.screen === 'caught') {
      const retry = loadLevel(state.levelIndex);
      retry.totals = state.totals;
      retry.screen = 'play';
      state = retry;
      announce(`${state.level.name}. Again — quieter this time.`);
    }
    // A click begins the night from the title, and nowhere else: in play it throws a coin.
    if (state.screen === 'title' && input.takeClick()) startRun();
    // Clicks on the other panels are spent: one must never become a coin on the next hall.
    if (state.screen !== 'play' && state.screen !== 'title') input.takeClick();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    state.timeNow = now / 1000;
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (state.screen === 'play') {
      while (accumulator >= STEP && state.screen === 'play') {
        stepPlay(state, input, STEP);
        accumulator -= STEP;
      }
    } else if (state.screen === 'title' || state.screen === 'heistComplete') {
      while (accumulator >= STEP) {
        stepBackdrop(state, STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(state);
  }

  window.addEventListener('keydown', () => audio.unlock(), { once: false });
  canvas.addEventListener('pointerdown', () => audio.unlock());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'play') {
      state.screen = 'paused';
      announce('Paused.');
    }
  });

  announce('The Night Vault. Press Enter or click to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
