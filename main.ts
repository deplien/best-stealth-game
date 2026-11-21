// A working best-game-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. A starting point, not a winner: Block Dodger, a
// plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a title screen,
// score, lives and levels, game over and restart, flat colours and no sound. Build your own game
// (any genre, any library you vendor under game/, or none), put your 3 or 4 PNG or JPEG screenshots
// in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Hand-in manifest helpers, authored for The Night Vault: once the copy and the dossier
// write below are done, the entry verifies its own hand-in (every screenshot present and
// non-empty, the dossier under the scorer's size cap) and prints a one-line summary of
// what shipped. measureTree walks a directory recursively and totals its files and bytes.
interface TreeStats {
  files: number;
  bytes: number;
}

function measureTree(dir: string): TreeStats {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) {
      const inner = measureTree(path);
      files += inner.files;
      bytes += inner.bytes;
    } else {
      files += 1;
      bytes += info.size;
    }
  }
  return { files, bytes };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Verify the hand-in before calling it done: every screenshot beside this file must have
// arrived in the output non-empty, and dossier.json must fit the scorer's 1.5 MiB cap.
// Failing loudly here beats handing in a silently broken entry.
const DOSSIER_CAP_BYTES = 1572864; // 1.5 MiB, the scorer's cap on dossier.json.
const shotOutDir = join(out, 'screenshots');
const sourceShotNames = existsSync(join(here, 'screenshots'))
  ? readdirSync(join(here, 'screenshots')).sort()
  : [];
for (const name of sourceShotNames) {
  const copied = join(shotOutDir, name);
  if (!existsSync(copied) || statSync(copied).size === 0) {
    throw new Error(`hand-in check failed: screenshot ${name} is missing or empty in the output`);
  }
}
const dossierBytes = statSync(join(out, 'dossier.json')).size;
if (dossierBytes > DOSSIER_CAP_BYTES) {
  throw new Error(
    `hand-in check failed: dossier.json is ${dossierBytes} bytes, over the ${DOSSIER_CAP_BYTES}-byte cap`,
  );
}
const gameStats = measureTree(join(out, 'game'));
console.log(
  `The Night Vault handed in: ${gameStats.files} game files (${formatBytes(gameStats.bytes)}), ` +
    `${sourceShotNames.length} screenshots, dossier.json ${formatBytes(dossierBytes)} — all checks passed.`,
);
