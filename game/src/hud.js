// The heads-up display: a deep-navy bar with ivory and gold text across the top of the hall —
// hall name, the night's objective, the detection meter filling ivory to amber to red, the
// alarm lamp that mirrors the most worried guard, coins and the clock — and the panels that
// open and close the night: title, caught, hall cleared, and the heist complete.

import { VIEW } from './levels.js';

const NAVY = '#0b1130';
const PANEL = 'rgba(10, 16, 38, 0.94)';
const IVORY = '#f3ead2';
const GOLD = '#e8c766';
const MUTED = '#8fa1cc';
const EMERALD = '#7dffb0';
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Seconds as a clock: 0:47, 3:32. */
export function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function text(ctx, value, x, y, font, colour, align = 'left') {
  ctx.font = font;
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

/** The top bar. Drawn in logical coordinates over the hall. */
export function drawHudBar(ctx, state) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, VIEW.width, VIEW.hudHeight);
  ctx.fillStyle = 'rgba(201, 162, 39, 0.85)';
  ctx.fillRect(0, VIEW.hudHeight - 2, VIEW.width, 2);

  text(ctx, `${state.level.name} — ${state.level.sub}`, 20, 29, `600 19px ${FONT}`, IVORY);

  // The objective, in the middle: the gem first, then the door.
  if (!state.hasDiamond) {
    const cx = 640;
    ctx.fillStyle = '#bffbff';
    ctx.beginPath();
    ctx.moveTo(cx - 88, 22);
    ctx.lineTo(cx - 82, 28);
    ctx.lineTo(cx - 85, 35);
    ctx.lineTo(cx - 91, 35);
    ctx.lineTo(cx - 94, 28);
    ctx.closePath();
    ctx.fill();
    text(ctx, 'Steal the Star Diamond', cx - 74, 29, `16px ${FONT}`, IVORY);
  } else {
    text(ctx, 'Reach the EXIT — stay unseen', 640, 29, `600 16px ${FONT}`, EMERALD, 'center');
  }

  // The detection meter: how close the night is to ending badly.
  text(ctx, 'DETECTION', 846, 17, `600 9.5px ${FONT}`, MUTED);
  ctx.fillStyle = '#1a2247';
  ctx.fillRect(846, 25, 190, 12);
  if (state.detection > 0.005) {
    const grad = ctx.createLinearGradient(846, 0, 1036, 0);
    grad.addColorStop(0, '#efe6c8');
    grad.addColorStop(0.55, '#f5b942');
    grad.addColorStop(1, '#ef4444');
    ctx.fillStyle = grad;
    ctx.fillRect(846, 25, Math.min(190, state.detection * 190), 12);
  }
  ctx.strokeStyle = '#39406e';
  ctx.lineWidth = 1;
  ctx.strokeRect(846, 25, 190, 12);
  // A gloss line along the meter's top edge, so the fill reads as glass over light.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
  ctx.fillRect(847, 26, 188, 3);

  // The alarm lamp, mirroring the most worried guard.
  const lampColour = state.maxMood === 'alert' ? '#ef4444' : state.maxMood === 'suspicious' ? '#f59e0b' : '#2c3a5e';
  ctx.save();
  if (state.maxMood !== 'calm') {
    ctx.shadowColor = lampColour;
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = lampColour;
  ctx.beginPath();
  ctx.arc(1064, 29, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#46538a';
  ctx.strokeRect(1055, 20, 18, 18);

  // Coins left, then the clock.
  ctx.fillStyle = '#f2c94c';
  ctx.beginPath();
  ctx.arc(1106, 28, 7, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, `× ${state.coinsLeft}`, 1118, 29, `16px ${FONT}`, IVORY);
  text(ctx, formatTime(state.time), 1260, 29, `16px ${FONT}`, IVORY, 'right');
}

/** A centred panel box; returns its geometry for the caller's lines. */
function panelBox(ctx, width, height) {
  const x = (VIEW.width - width) / 2;
  const y = VIEW.hudHeight + (VIEW.height - VIEW.hudHeight - height) / 2;
  ctx.fillStyle = 'rgba(4, 6, 16, 0.55)';
  ctx.fillRect(0, VIEW.hudHeight, VIEW.width, VIEW.height - VIEW.hudHeight);
  ctx.fillStyle = PANEL;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 14);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232, 199, 102, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 7, y + 7, width - 14, height - 14, 10);
  ctx.stroke();
  return { x, y, width, height, cx: VIEW.width / 2 };
}

/** The screen's panel, if the screen has one. */
export function drawPanel(ctx, state) {
  const now = state.timeNow ?? 0;
  const pulse = 0.65 + 0.35 * Math.sin(now * 3);
  if (state.screen === 'title') {
    const box = panelBox(ctx, 680, 400);
    ctx.save();
    ctx.shadowColor = 'rgba(232, 199, 102, 0.55)';
    ctx.shadowBlur = 18;
    text(ctx, 'THE NIGHT VAULT', box.cx, box.y + 62, `700 46px ${FONT}`, GOLD, 'center');
    ctx.restore();
    ctx.fillStyle = 'rgba(232, 199, 102, 0.6)';
    ctx.fillRect(box.cx - 150, box.y + 94, 300, 2);
    text(ctx, 'Tonight, the Star Diamond leaves its pedestal —', box.cx, box.y + 128, `17px ${FONT}`, IVORY, 'center');
    text(ctx, 'quietly, if you are quick and patient and unseen.', box.cx, box.y + 154, `17px ${FONT}`, IVORY, 'center');
    const controls = [
      'Move — WASD or the arrow keys',
      'Sneak — hold Shift: slow, quiet, harder to see',
      'Throw a coin — click: guards go and look',
      'Pause — P',
    ];
    controls.forEach((line, index) => {
      text(ctx, line, box.cx, box.y + 200 + index * 27, `15px ${FONT}`, '#b9c6e8', 'center');
    });
    ctx.globalAlpha = pulse;
    text(ctx, 'Press Enter or click to begin', box.cx, box.y + 348, `600 16px ${FONT}`, EMERALD, 'center');
    ctx.globalAlpha = 1;
  } else if (state.screen === 'caught') {
    const box = panelBox(ctx, 560, 280);
    text(ctx, 'CAUGHT!', box.cx, box.y + 58, `800 42px ${FONT}`, '#ff6b5e', 'center');
    text(ctx, 'A flashlight found you, and the alarm did the rest.', box.cx, box.y + 112, `16px ${FONT}`, IVORY, 'center');
    text(ctx, `${state.level.name} · ${formatTime(state.time)} · spotted ${state.spotted}×`, box.cx, box.y + 152, `15px ${FONT}`, MUTED, 'center');
    ctx.globalAlpha = pulse;
    text(ctx, 'Press R to try the hall again', box.cx, box.y + 224, `600 16px ${FONT}`, EMERALD, 'center');
    ctx.globalAlpha = 1;
  } else if (state.screen === 'levelComplete') {
    const box = panelBox(ctx, 560, 280);
    text(ctx, 'HALL CLEARED', box.cx, box.y + 58, `700 38px ${FONT}`, GOLD, 'center');
    text(ctx, 'The diamond is in your pocket and the hall is none the wiser.', box.cx, box.y + 112, `16px ${FONT}`, IVORY, 'center');
    text(ctx, `Time ${formatTime(state.time)} · spotted ${state.spotted}× · coins left ${state.coinsLeft}`, box.cx, box.y + 152, `15px ${FONT}`, MUTED, 'center');
    ctx.globalAlpha = pulse;
    text(ctx, 'Press Enter for the next hall', box.cx, box.y + 224, `600 16px ${FONT}`, EMERALD, 'center');
    ctx.globalAlpha = 1;
  } else if (state.screen === 'heistComplete') {
    const box = panelBox(ctx, 620, 320);
    text(ctx, 'THE VAULT IS EMPTY', box.cx, box.y + 62, `700 40px ${FONT}`, GOLD, 'center');
    const line = state.totals.spotted === 0 ? 'The Star Diamond is yours — and no one saw a thing.' : 'The Star Diamond is yours.';
    text(ctx, line, box.cx, box.y + 118, `17px ${FONT}`, IVORY, 'center');
    text(ctx, `Total time ${formatTime(state.totals.time)} · spotted ${state.totals.spotted}× · coins left ${state.totals.coinsLeft}`, box.cx, box.y + 162, `15px ${FONT}`, MUTED, 'center');
    ctx.globalAlpha = pulse;
    text(ctx, 'Press Enter to play again', box.cx, box.y + 262, `600 16px ${FONT}`, EMERALD, 'center');
    ctx.globalAlpha = 1;
  } else if (state.screen === 'paused') {
    const box = panelBox(ctx, 340, 150);
    text(ctx, 'PAUSED', box.cx, box.y + 55, `700 30px ${FONT}`, IVORY, 'center');
    text(ctx, 'P to resume', box.cx, box.y + 102, `15px ${FONT}`, MUTED, 'center');
  }
}
