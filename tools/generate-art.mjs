/**
 * Pixel-art asset generator. Run `npm run art` to (re)bake the
 * committed binary spritesheets:
 *
 *   packages/client/public/assets/tiles.png    — 64×64 tile atlas
 *   packages/client/public/assets/players.png  — 64×64 player sheet
 *   packages/client/src/render/atlas.json      — frame indices (source of truth)
 *
 * Everything is drawn in logical 16×16 pixels scaled 4× so it reads as
 * chunky pixel art. Deterministic: same script, same bytes.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_DIR = join(ROOT, "packages", "client", "public", "assets");
const ATLAS_JSON = join(ROOT, "packages", "client", "src", "render", "atlas.json");

const TILE = 64; // final pixels per tile
const SCALE = 4; // logical pixel → final pixels
const L = TILE / SCALE; // 16 logical pixels per tile side

// ── tiny drawing kit ───────────────────────────────────────────────

function makeImage(width, height) {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

function setPx(img, x, y, [r, g, b, a = 255]) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = r;
  img.data[i + 1] = g;
  img.data[i + 2] = b;
  img.data[i + 3] = a;
}

/** Fill a rect in LOGICAL pixels within a tile cell at (cellX, cellY). */
function rect(img, cellX, cellY, lx, ly, lw, lh, color) {
  for (let y = 0; y < lh * SCALE; y++) {
    for (let x = 0; x < lw * SCALE; x++) {
      setPx(img, cellX + lx * SCALE + x, cellY + ly * SCALE + y, color);
    }
  }
}

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** Deterministic PRNG (mulberry32). */
function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function writePng(img, path) {
  const png = new PNG({ width: img.width, height: img.height });
  Buffer.from(img.data).copy(png.data);
  writeFileSync(path, PNG.sync.write(png));
}

// ── tile painters (each paints one 64×64 cell) ─────────────────────

/** Brick floor: offset courses with bevels, per-brick shade, chips. */
function paintBrickFloor(img, cx, cy, seed, hue, sat, light) {
  const r = rng(seed);
  rect(img, cx, cy, 0, 0, L, L, hslToRgb(hue, sat, light - 9)); // mortar
  for (let course = 0; course < 4; course++) {
    const y = course * 4;
    const offset = course % 2 === 0 ? 0 : -4;
    for (let b = 0; b < 3; b++) {
      const x = offset + b * 8;
      const x0 = Math.max(x, 0);
      const x1 = Math.min(x + 7, L);
      if (x1 <= x0) continue;
      const w = x1 - x0;
      const shade = light + (r() - 0.5) * 9;
      rect(img, cx, cy, x0, y, w, 3, hslToRgb(hue, sat, shade));
      rect(img, cx, cy, x0, y, w, 1, hslToRgb(hue, sat, shade + 8)); // top bevel
      rect(img, cx, cy, x0, y + 2, w, 1, hslToRgb(hue, sat, shade - 7)); // bottom bevel
      if (r() < 0.3) {
        // chipped corner
        rect(img, cx, cy, x0 + Math.floor(r() * (w - 1)), y + 1, 1, 1, hslToRgb(hue, sat, shade - 12));
      }
    }
  }
}

/** Rock wall: near-black mass, cracks, mineral glints. */
function paintWall(img, cx, cy, seed, withFace) {
  const r = rng(seed);
  rect(img, cx, cy, 0, 0, L, L, hslToRgb(258, 22, 8));
  // wandering cracks
  for (let c = 0; c < 3; c++) {
    let x = Math.floor(r() * L);
    let y = 0;
    while (y < L) {
      rect(img, cx, cy, x, y, 1, 1, hslToRgb(258, 26, 4));
      y += 1;
      x += r() < 0.5 ? -1 : 1;
      x = Math.max(0, Math.min(L - 1, x));
    }
  }
  // mineral glints
  for (let g = 0; g < 5; g++) {
    rect(img, cx, cy, Math.floor(r() * L), Math.floor(r() * L), 1, 1, hslToRgb(262, 18, 16));
  }
  if (withFace) {
    // visible stone-course face on the bottom quarter
    for (let row = 0; row < 2; row++) {
      const y = L - 4 + row * 2;
      const offset = row % 2 === 0 ? 0 : -3;
      for (let b = 0; b < 4; b++) {
        const x0 = Math.max(offset + b * 5, 0);
        const x1 = Math.min(offset + b * 5 + 4, L);
        if (x1 <= x0) continue;
        const shade = 16 + (r() - 0.5) * 5;
        rect(img, cx, cy, x0, y, x1 - x0, 2, hslToRgb(258, 16, shade));
        rect(img, cx, cy, x0, y, x1 - x0, 1, hslToRgb(258, 16, shade + 6));
      }
    }
    rect(img, cx, cy, 0, L - 4, L, 1, hslToRgb(258, 20, 22)); // face top lip
  }
}

/** Cliff face: strata bands with cracks; `tall` covers the whole tile. */
function paintCliffFace(img, cx, cy, seed, tall) {
  const r = rng(seed);
  const bands = tall ? L : L / 2;
  for (let y = 0; y < bands; y++) {
    const band = Math.floor(y / 3);
    const shade = 30 - band * 3 + (y % 3 === 2 ? -8 : 0) + (r() - 0.5) * 3;
    rect(img, cx, cy, 0, y, L, 1, hslToRgb(262, 18, Math.max(8, shade)));
  }
  // vertical cracks through the strata
  for (let c = 0; c < 3; c++) {
    const x = 1 + Math.floor(r() * (L - 2));
    for (let y = Math.floor(r() * 3); y < bands; y += 1 + Math.floor(r() * 2)) {
      rect(img, cx, cy, x, y, 1, 1, hslToRgb(262, 20, 10));
    }
  }
  // bright top lip (the ledge edge above) and drop shadow at the base
  rect(img, cx, cy, 0, 0, L, 1, hslToRgb(262, 22, 48));
  const shadowY = bands;
  for (let x = 0; x < L; x++) {
    setPxRegion(img, cx, cy, x, shadowY, [0, 0, 0, 110]);
    setPxRegion(img, cx, cy, x, shadowY + 1, [0, 0, 0, 60]);
  }
}

function setPxRegion(img, cellX, cellY, lx, ly, color) {
  for (let y = 0; y < SCALE; y++) {
    for (let x = 0; x < SCALE; x++) {
      setPx(img, cellX + lx * SCALE + x, cellY + ly * SCALE + y, color);
    }
  }
}

/** Rim highlight overlays, one per S/E/W bitmask combination. */
function paintRim(img, cx, cy, mask) {
  const bright = hslToRgb(262, 24, 62);
  const soft = [...hslToRgb(262, 20, 45), 160];
  if (mask & 1) {
    rect(img, cx, cy, 0, L - 1, L, 1, bright);
    for (let x = 0; x < L; x++) setPxRegion(img, cx, cy, x, L - 2, soft);
  }
  if (mask & 2) {
    rect(img, cx, cy, L - 1, 0, 1, L, bright);
    for (let y = 0; y < L; y++) setPxRegion(img, cx, cy, L - 2, y, soft);
  }
  if (mask & 4) {
    rect(img, cx, cy, 0, 0, 1, L, bright);
    for (let y = 0; y < L; y++) setPxRegion(img, cx, cy, 1, y, soft);
  }
}

/** Stairway: purple treads with risers and side rails. */
function paintStairs(img, cx, cy) {
  for (let t = 0; t < 4; t++) {
    const y = t * 4;
    rect(img, cx, cy, 0, y, L, 3, hslToRgb(275, 42, 38 - t * 2)); // tread
    rect(img, cx, cy, 0, y, L, 1, hslToRgb(275, 46, 52 - t * 2)); // tread lip
    rect(img, cx, cy, 0, y + 3, L, 1, hslToRgb(275, 40, 20)); // riser
  }
  rect(img, cx, cy, 0, 0, 1, L, hslToRgb(275, 35, 24)); // rails
  rect(img, cx, cy, L - 1, 0, 1, L, hslToRgb(275, 35, 24));
}

// ── player sprite ──────────────────────────────────────────────────

// 16×16 logical pixels. O outline, h hood highlight, H hood, F face
// shadow, E eyes, C cloak, c cloak shadow, B boots, b boot highlight.
const PLAYER_PIXELS = [
  "................",
  ".....OOOOOO.....",
  "....OhhhhhhO....",
  "...OhhHHHHhhO...",
  "...OhHHHHHHhO...",
  "...OHHFFFFHHO...",
  "...OHFEFFEFHO...",
  "...OHFFFFFFHO...",
  "...OOHFFFFHOO...",
  "...OChHHHHhCO...",
  "..OCCCCCCCCCCO..",
  "..OcCCCCCCCCcO..",
  "..OcCCCCCCCCcO..",
  "...OccCCCCccO...",
  "...OBbO..ObBO...",
  "....OOO..OOO....",
];

const PLAYER_PALETTES = [
  // self: gold
  { O: "#241a10", h: "#f4cc6a", H: "#dfa93a", F: "#3a2c22", E: "#ffe9b0", C: "#c08a26", c: "#96691c", B: "#503c28", b: "#6e5438" },
  // peer: blue
  { O: "#101a24", h: "#8ed2ec", H: "#4fa6cc", F: "#26303c", E: "#d9f2ff", C: "#3a7d9c", c: "#2c6079", B: "#39394a", b: "#4d4d63" },
];

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function paintPlayer(img, cx, cy, palette) {
  for (let row = 0; row < PLAYER_PIXELS.length; row++) {
    const line = PLAYER_PIXELS[row];
    for (let col = 0; col < line.length; col++) {
      const cell = line[col];
      if (cell === ".") continue;
      rect(img, cx, cy, col, row, 1, 1, hexToRgb(palette[cell]));
    }
  }
}

// ── atlas assembly ─────────────────────────────────────────────────

const COLS = 8;
const ROWS = 5;
const frameXY = (index) => [(index % COLS) * TILE, Math.floor(index / COLS) * TILE];

const atlas = {
  tileSize: TILE,
  frames: {
    floor: [0, 1, 2, 3],
    sanctuary: [8, 9, 10, 11],
    wall: [16, 17],
    wallFace: [18, 19],
    stairs: 20,
    faceTall: [24, 25],
    faceShort: [26, 27],
    /** rim frame = rimBase + bitmask (S=1, E=2, W=4), masks 1..7 */
    rimBase: 31,
  },
  players: { self: 0, peer: 1 },
};

const tiles = makeImage(COLS * TILE, ROWS * TILE);

atlas.frames.floor.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  paintBrickFloor(tiles, x, y, 0xf100 + i, 262, 14, 42);
});
atlas.frames.sanctuary.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  paintBrickFloor(tiles, x, y, 0x5a0 + i, 165, 34, 40);
});
atlas.frames.wall.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  paintWall(tiles, x, y, 0xa110 + i, false);
});
atlas.frames.wallFace.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  paintWall(tiles, x, y, 0xfa5e + i, true);
});
{
  const [x, y] = frameXY(atlas.frames.stairs);
  paintStairs(tiles, x, y);
}
atlas.frames.faceTall.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  paintCliffFace(tiles, x, y, 0xc11f + i, true);
});
atlas.frames.faceShort.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  paintCliffFace(tiles, x, y, 0xc15f + i, false);
});
for (let mask = 1; mask <= 7; mask++) {
  const [x, y] = frameXY(atlas.frames.rimBase + mask);
  paintRim(tiles, x, y, mask);
}

const players = makeImage(2 * TILE, TILE);
paintPlayer(players, 0, 0, PLAYER_PALETTES[0]);
paintPlayer(players, TILE, 0, PLAYER_PALETTES[1]);

mkdirSync(ASSET_DIR, { recursive: true });
writePng(tiles, join(ASSET_DIR, "tiles.png"));
writePng(players, join(ASSET_DIR, "players.png"));
writeFileSync(ATLAS_JSON, JSON.stringify(atlas, null, 2) + "\n");

console.log(`wrote ${join(ASSET_DIR, "tiles.png")} (${tiles.width}×${tiles.height})`);
console.log(`wrote ${join(ASSET_DIR, "players.png")} (${players.width}×${players.height})`);
console.log(`wrote ${ATLAS_JSON}`);
