// The renderer: paints the museum from the game state each frame, and owns the mapping
// between the game's logical 1280x800 space and the real canvas (letterboxed, device-pixel
// sharp). Night is the point: a deep indigo carpet, warm pools under the lamps, walnut-and-
// brass display cases, and flashlight cones with a bright heart that fades at the rim —
// so lit ground, safe shadow, cover and danger can all be told apart at a glance.

import { VIEW } from './levels.js';
import { CONE_RANGE } from './vision.js';
import { guardMood } from './guard.js';
import { drawHudBar, drawPanel } from './hud.js';

/** The night museum's colours, in one place so the mood stays consistent. */
export const PALETTE = {
  backdrop: '#070a16',
  carpet: '#171e3a',
  carpetAlt: 'rgba(255, 255, 255, 0.028)',
  carpetMotif: 'rgba(216, 164, 65, 0.055)',
  wall: '#252d49',
  wallEdge: 'rgba(216, 164, 65, 0.4)',
  caseWood: '#4a3220',
  caseTop: '#5f422a',
  caseTrim: '#d9a441',
  caseGlass: 'rgba(170, 220, 255, 0.10)',
  caseShine: 'rgba(220, 240, 255, 0.13)',
  crateWood: '#6b5133',
  crateBrace: '#3f2f1c',
  lampGlow: 'rgba(255, 190, 110, 0.16)',
  exitGreen: '#12b76a',
  exitDeep: '#0e6b3f',
  exitText: '#7dffb0',
  diamond: '#bffbff',
  diamondGlow: 'rgba(140, 240, 255, 0.5)',
  guardBody: '#26355e',
  guardRim: '#3d548c',
  guardCap: '#16224a',
  guardFace: '#f0dcc0',
  playerBody: '#12141f',
  playerScarf: '#19d3c5',
  coin: '#f2c94c',
  shadow: 'rgba(0, 0, 0, 0.35)',
};

/** Cone colours by the guard's mood: [heart, rim] stops of the beam's radial gradient. */
const CONE_COLOURS = {
  calm: ['rgba(255, 216, 130, 0.40)', 'rgba(255, 190, 90, 0.04)'],
  suspicious: ['rgba(255, 158, 64, 0.50)', 'rgba(255, 130, 40, 0.05)'],
  alert: ['rgba(255, 92, 72, 0.55)', 'rgba(255, 60, 40, 0.06)'],
};

/** Artefact tints cycled through the display cases: a vase, a mask, a statue, a bowl. */
const ARTEFACT_TINTS = ['#c9a86a', '#7fb4a8', '#b8b0a0', '#a88fc0'];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  /** Size the canvas to its element (device-pixel sharp, capped at 2x) and fit the view. */
  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    offsetX = (canvas.width - VIEW.width * scale) / 2;
    offsetY = (canvas.height - VIEW.height * scale) / 2;
  }

  /** A client's mouse position in logical coordinates (for coin throws). */
  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * canvas.width;
    const py = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x: (px - offsetX) / scale, y: (py - offsetY) / scale };
  }

  function drawFloor() {
    ctx.fillStyle = PALETTE.carpet;
    ctx.fillRect(0, VIEW.hudHeight, VIEW.width, VIEW.height - VIEW.hudHeight);
    const tile = 80;
    for (let row = 0; row * tile < VIEW.height; row += 1) {
      for (let col = 0; col * tile < VIEW.width; col += 1) {
        if ((row + col) % 2 === 0) continue;
        ctx.fillStyle = PALETTE.carpetAlt;
        ctx.fillRect(col * tile, VIEW.hudHeight + row * tile, tile, tile);
      }
    }
    // A small gold diamond motif at the heart of every other tile.
    ctx.fillStyle = PALETTE.carpetMotif;
    for (let row = 0; row * tile < VIEW.height; row += 1) {
      for (let col = 0; col * tile < VIEW.width; col += 1) {
        if ((row + col) % 2 !== 0) continue;
        const cx = col * tile + tile / 2;
        const cy = VIEW.hudHeight + row * tile + tile / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 7);
        ctx.lineTo(cx + 7, cy);
        ctx.lineTo(cx, cy + 7);
        ctx.lineTo(cx - 7, cy);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawLampPools(state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const lamp of state.level.lamps) {
      const grad = ctx.createRadialGradient(lamp.x, lamp.y, 10, lamp.x, lamp.y, lamp.r);
      grad.addColorStop(0, PALETTE.lampGlow);
      grad.addColorStop(1, 'rgba(255, 190, 110, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(lamp.x - lamp.r, lamp.y - lamp.r, lamp.r * 2, lamp.r * 2);
      // A warm heart at the lamp's centre, so the pool falls off like real lamplight.
      const core = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, lamp.r * 0.42);
      core.addColorStop(0, 'rgba(255, 205, 130, 0.15)');
      core.addColorStop(1, 'rgba(255, 205, 130, 0)');
      ctx.fillStyle = core;
      const coreSize = lamp.r * 0.42;
      ctx.fillRect(lamp.x - coreSize, lamp.y - coreSize, coreSize * 2, coreSize * 2);
    }
    ctx.restore();
  }

  function drawCones(state) {
    for (const guard of state.guards) {
      if (guard.cone.length < 3) continue;
      const [heart, rim] = CONE_COLOURS[guardMood(guard)];
      const grad = ctx.createRadialGradient(guard.x, guard.y, 8, guard.x, guard.y, CONE_RANGE);
      grad.addColorStop(0, heart);
      grad.addColorStop(0.45, heart.replace(/[\d.]+\)$/, '0.16)'));
      grad.addColorStop(1, rim);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(guard.cone[0].x, guard.cone[0].y);
      for (let index = 1; index < guard.cone.length; index += 1) ctx.lineTo(guard.cone[index].x, guard.cone[index].y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawWalls(state) {
    ctx.fillStyle = PALETTE.wall;
    for (const wall of state.walls) ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.strokeStyle = PALETTE.wallEdge;
    ctx.lineWidth = 1.5;
    for (const wall of state.walls) {
      if (wall.w > wall.h) {
        ctx.beginPath();
        ctx.moveTo(wall.x, wall.y + wall.h - 3);
        ctx.lineTo(wall.x + wall.w, wall.y + wall.h - 3);
        ctx.stroke();
      }
    }
  }

  function drawExit(state) {
    const exit = state.level.exit;
    ctx.save();
    ctx.shadowColor = '#34f5a2';
    ctx.shadowBlur = state.hasDiamond ? 22 : 10;
    ctx.fillStyle = PALETTE.exitDeep;
    ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
    ctx.fillStyle = PALETTE.exitGreen;
    const inset = 4;
    ctx.fillRect(exit.x + inset, exit.y + inset, exit.w - inset * 2, exit.h - inset * 2);
    ctx.restore();
    ctx.fillStyle = PALETTE.exitText;
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (exit.side === 'right') {
      ctx.save();
      ctx.translate(exit.x + exit.w / 2, exit.y + exit.h / 2);
      ctx.rotate(Math.PI / 2);
      ctx.fillText('EXIT', 0, 0);
      ctx.restore();
    } else {
      ctx.fillText('EXIT', exit.x + exit.w / 2, exit.y + exit.h / 2 + 1);
    }
  }

  function drawPedestalAndDiamond(state, now) {
    const { pedestal, diamond } = state.level;
    ctx.fillStyle = PALETTE.shadow;
    ctx.fillRect(pedestal.x + 4, pedestal.y + 6, pedestal.w, pedestal.h);
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(pedestal.x, pedestal.y, pedestal.w, pedestal.h);
    ctx.strokeStyle = PALETTE.caseTrim;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pedestal.x + 1, pedestal.y + 1, pedestal.w - 2, pedestal.h - 2);
    if (state.hasDiamond) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(diamond.x, diamond.y, 2, diamond.x, diamond.y, 48);
    halo.addColorStop(0, PALETTE.diamondGlow);
    halo.addColorStop(1, 'rgba(140, 240, 255, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(diamond.x - 48, diamond.y - 48, 96, 96);
    ctx.restore();
    // The Star Diamond itself: a bright cut gem.
    ctx.fillStyle = PALETTE.diamond;
    ctx.beginPath();
    ctx.moveTo(diamond.x, diamond.y - 11);
    ctx.lineTo(diamond.x + 9, diamond.y - 2);
    ctx.lineTo(diamond.x + 5, diamond.y + 11);
    ctx.lineTo(diamond.x - 5, diamond.y + 11);
    ctx.lineTo(diamond.x - 9, diamond.y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(diamond.x - 9, diamond.y - 2);
    ctx.lineTo(diamond.x + 9, diamond.y - 2);
    ctx.moveTo(diamond.x, diamond.y - 11);
    ctx.lineTo(diamond.x, diamond.y + 11);
    ctx.stroke();
    // Twinkling four-point sparkles.
    for (let index = 0; index < 2; index += 1) {
      const phase = now * 2.4 + index * 1.9;
      const alpha = 0.35 + 0.65 * Math.abs(Math.sin(phase));
      const sx = diamond.x + (index === 0 ? -16 : 15);
      const sy = diamond.y + (index === 0 ? -13 : -6);
      const size = 5 + 2.5 * Math.abs(Math.sin(phase));
      ctx.fillStyle = `rgba(230, 255, 255, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(sx, sy - size);
      ctx.lineTo(sx + size * 0.28, sy - size * 0.28);
      ctx.lineTo(sx + size, sy);
      ctx.lineTo(sx + size * 0.28, sy + size * 0.28);
      ctx.lineTo(sx, sy + size);
      ctx.lineTo(sx - size * 0.28, sy + size * 0.28);
      ctx.lineTo(sx - size, sy);
      ctx.lineTo(sx - size * 0.28, sy - size * 0.28);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawCases(state) {
    state.level.cases.forEach((rect, index) => {
      ctx.fillStyle = PALETTE.shadow;
      ctx.fillRect(rect.x + 5, rect.y + 7, rect.w, rect.h);
      ctx.fillStyle = PALETTE.caseWood;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = PALETTE.caseTop;
      ctx.fillRect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8);
      ctx.strokeStyle = PALETTE.caseTrim;
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
      ctx.fillStyle = PALETTE.caseGlass;
      ctx.fillRect(rect.x + 10, rect.y + 10, rect.w - 20, rect.h - 20);
      // The artefact inside: a small tinted silhouette, different in every case.
      ctx.fillStyle = ARTEFACT_TINTS[index % ARTEFACT_TINTS.length];
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      if (rect.h > rect.w) {
        ctx.fillRect(cx - 5, cy - 16, 10, 32);
        ctx.beginPath();
        ctx.arc(cx, cy - 20, 7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.ellipse(cx, cy + 4, 13, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(cx - 3, cy - 14, 6, 12);
      }
      // A pale shine streak across the glass, and a thinner companion beside it.
      ctx.fillStyle = PALETTE.caseShine;
      ctx.beginPath();
      ctx.moveTo(rect.x + rect.w * 0.18, rect.y + rect.h - 8);
      ctx.lineTo(rect.x + rect.w * 0.42, rect.y + 8);
      ctx.lineTo(rect.x + rect.w * 0.58, rect.y + 8);
      ctx.lineTo(rect.x + rect.w * 0.34, rect.y + rect.h - 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(220, 240, 255, 0.07)';
      ctx.beginPath();
      ctx.moveTo(rect.x + rect.w * 0.62, rect.y + rect.h - 8);
      ctx.lineTo(rect.x + rect.w * 0.78, rect.y + 8);
      ctx.lineTo(rect.x + rect.w * 0.85, rect.y + 8);
      ctx.lineTo(rect.x + rect.w * 0.69, rect.y + rect.h - 8);
      ctx.closePath();
      ctx.fill();
    });
    for (const crate of state.level.crates) {
      ctx.fillStyle = PALETTE.shadow;
      ctx.fillRect(crate.x + 5, crate.y + 7, crate.w, crate.h);
      ctx.fillStyle = PALETTE.crateWood;
      ctx.fillRect(crate.x, crate.y, crate.w, crate.h);
      ctx.strokeStyle = PALETTE.crateBrace;
      ctx.lineWidth = 4;
      ctx.strokeRect(crate.x + 3, crate.y + 3, crate.w - 6, crate.h - 6);
      ctx.beginPath();
      ctx.moveTo(crate.x + 4, crate.y + 4);
      ctx.lineTo(crate.x + crate.w - 4, crate.y + crate.h - 4);
      ctx.moveTo(crate.x + crate.w - 4, crate.y + 4);
      ctx.lineTo(crate.x + 4, crate.y + crate.h - 4);
      ctx.stroke();
    }
  }

  function drawCoins(state) {
    for (const coin of state.coinsThrown) {
      ctx.strokeStyle = 'rgba(242, 201, 76, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.coin;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fillRect(coin.x - 2, coin.y - 3, 2.5, 2.5);
    }
  }

  function drawGuardFigure(guard, now) {
    const mood = guardMood(guard);
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(guard.x + 3, guard.y + 6, 13, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.guardBody;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.guardRim;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 12.5, guard.facing + 2.2, guard.facing - 2.2, true);
    ctx.stroke();
    // Cap: a dark half-disc toward the facing, with a brass brim dot.
    ctx.fillStyle = PALETTE.guardCap;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 9.5, guard.facing - 1.9, guard.facing + 1.9);
    ctx.lineTo(guard.x, guard.y);
    ctx.closePath();
    ctx.fill();
    const fx = guard.x + Math.cos(guard.facing) * 6;
    const fy = guard.y + Math.sin(guard.facing) * 6;
    ctx.fillStyle = PALETTE.guardFace;
    ctx.beginPath();
    ctx.arc(fx, fy, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.caseTrim;
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(guard.facing) * 12, guard.y + Math.sin(guard.facing) * 12, 1.8, 0, Math.PI * 2);
    ctx.fill();
    if (mood !== 'calm') {
      const bob = Math.sin(now * 4 + guard.x) * 2;
      ctx.font = mood === 'alert' ? '800 25px system-ui, sans-serif' : '800 21px system-ui, sans-serif';
      ctx.fillStyle = mood === 'alert' ? '#ff5040' : '#ffb340';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(mood === 'alert' ? '!' : '?', guard.x, guard.y - 30 + bob);
    }
  }

  function drawPlayerFigure(state) {
    const player = state.player;
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(player.x + 3, player.y + 6, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (player.noiseRadius > 30) {
      ctx.strokeStyle = 'rgba(160, 200, 255, 0.10)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.noiseRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.save();
    ctx.translate(player.x, player.y);
    if (player.crouch) ctx.scale(1, 0.85);
    ctx.fillStyle = PALETTE.playerBody;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    // The jewel-teal scarf, worn at the back of the hood.
    ctx.strokeStyle = PALETTE.playerScarf;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, 9.5, player.facing + Math.PI - 0.85, player.facing + Math.PI + 0.85);
    ctx.stroke();
    ctx.fillStyle = '#05070d';
    ctx.beginPath();
    ctx.arc(Math.cos(player.facing) * 4.5, Math.sin(player.facing) * 4.5, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // The detection arc over her head: how seen she is right now.
    if (state.detection > 0.03 && state.screen === 'play') {
      const colour = state.detection < 0.35 ? '#efe6c8' : state.detection < 0.75 ? '#f5b942' : '#ef4444';
      ctx.strokeStyle = 'rgba(10, 14, 30, 0.65)';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 21, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = colour;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 21, -Math.PI / 2, -Math.PI / 2 + state.detection * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawVignette() {
    const grad = ctx.createRadialGradient(640, 428, 430, 640, 428, 920);
    grad.addColorStop(0, 'rgba(3, 5, 16, 0)');
    grad.addColorStop(1, 'rgba(3, 5, 16, 0.52)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  /** Paint the whole state. */
  function draw(state) {
    fit();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    const now = state.timeNow ?? 0;
    drawFloor();
    drawLampPools(state);
    drawCones(state);
    drawWalls(state);
    drawExit(state);
    drawPedestalAndDiamond(state, now);
    drawCases(state);
    drawCoins(state);
    for (const guard of state.guards) drawGuardFigure(guard, now);
    drawPlayerFigure(state);
    drawVignette();
    drawHudBar(ctx, state);
    drawPanel(ctx, state);
  }

  return { draw, toLogical };
}
